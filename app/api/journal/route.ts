import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculateDailyGoalCompletion, generateDailyRemarks } from '@/lib/nutrition';
import { DailyLog, FoodEntry, MealType, WaterEntry } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const db = getDatabase();
    const now = new Date().toISOString();

    // Find or create daily log for this user & date
    let dailyLog = db
      .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as unknown as DailyLog | undefined;

    if (!dailyLog) {
      const logId = 'log_' + crypto.randomUUID();
      // Initialize with active profile targets if available
      const p = auth.profile;
      db.prepare(`
        INSERT INTO daily_logs (
          id, user_id, date, steps, is_submitted,
          calorie_target_snapshot, protein_target_snapshot, carb_target_snapshot,
          fat_target_snapshot, fibre_target_snapshot, water_target_snapshot, step_target_snapshot,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, 0, 0,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        logId,
        auth.user.id,
        date,
        p?.calorie_target || 2000,
        p?.protein_target || 80,
        p?.carb_target || 250,
        p?.fat_target || 65,
        p?.fibre_target || 28,
        p?.water_target || 3000,
        p?.daily_step_goal || 10000,
        now,
        now
      );

      dailyLog = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(logId) as unknown as DailyLog;
    }

    // Fetch food entries
    const rawFoodEntries = db
      .prepare('SELECT * FROM food_entries WHERE daily_log_id = ? ORDER BY created_at ASC')
      .all(dailyLog.id) as Array<Record<string, unknown>>;

    const foodEntries: FoodEntry[] = rawFoodEntries.map((r) => ({
      id: r.id as string,
      daily_log_id: r.daily_log_id as string,
      meal_type: r.meal_type as MealType,
      food_item_id: (r.food_item_id as string) || undefined,
      custom_name: r.custom_name as string,
      portion_amount: Number(r.portion_amount),
      portion_unit: r.portion_unit as FoodEntry['portion_unit'],
      computed_weight_g: Number(r.computed_weight_g),
      calories: Number(r.calories),
      protein: Number(r.protein),
      carbs: Number(r.carbs),
      fat: Number(r.fat),
      fibre: Number(r.fibre),
      is_discretionary: Boolean(r.is_discretionary),
      icon: (r.icon as string) || '🍽️',
      created_at: r.created_at as string,
    }));

    // Fetch water entries
    const rawWaterEntries = db
      .prepare('SELECT * FROM water_entries WHERE daily_log_id = ? ORDER BY logged_at ASC')
      .all(dailyLog.id) as Array<Record<string, unknown>>;

    const waterEntries: WaterEntry[] = rawWaterEntries.map((r) => ({
      id: r.id as string,
      daily_log_id: r.daily_log_id as string,
      amount_ml: Number(r.amount_ml),
      logged_at: r.logged_at as string,
    }));

    // Calculate totals
    const totals = {
      calories: Math.round(foodEntries.reduce((acc, f) => acc + f.calories, 0)),
      protein: Number(foodEntries.reduce((acc, f) => acc + f.protein, 0).toFixed(1)),
      carbs: Number(foodEntries.reduce((acc, f) => acc + f.carbs, 0).toFixed(1)),
      fat: Number(foodEntries.reduce((acc, f) => acc + f.fat, 0).toFixed(1)),
      fibre: Number(foodEntries.reduce((acc, f) => acc + f.fibre, 0).toFixed(1)),
      water: waterEntries.reduce((acc, w) => acc + w.amount_ml, 0),
      steps: dailyLog.steps || 0,
      foodCount: foodEntries.length,
      discretionaryCount: foodEntries.filter((f) => f.is_discretionary).length,
    };

    // Targets to evaluate against: use snapshot if submitted, or profile target
    const targets = {
      calorieTarget: dailyLog.calorie_target_snapshot || auth.profile?.calorie_target || 2000,
      proteinTarget: dailyLog.protein_target_snapshot || auth.profile?.protein_target || 80,
      carbTarget: dailyLog.carb_target_snapshot || auth.profile?.carb_target || 250,
      fatTarget: dailyLog.fat_target_snapshot || auth.profile?.fat_target || 65,
      fibreTarget: dailyLog.fibre_target_snapshot || auth.profile?.fibre_target || 28,
      waterTarget: dailyLog.water_target_snapshot || auth.profile?.water_target || 3000,
      stepTarget: dailyLog.step_target_snapshot || auth.profile?.daily_step_goal || 10000,
    };

    const uniqueMeals = new Set(foodEntries.map((f) => f.meal_type)).size;

    const breakdown = calculateDailyGoalCompletion({
      calories: totals.calories,
      calorieTarget: targets.calorieTarget,
      protein: totals.protein,
      proteinTarget: targets.proteinTarget,
      fibre: totals.fibre,
      fibreTarget: targets.fibreTarget,
      water: totals.water,
      waterTarget: targets.waterTarget,
      steps: totals.steps,
      stepTarget: targets.stepTarget,
      loggedMealsCount: uniqueMeals,
      discretionaryCount: totals.discretionaryCount,
    });

    const remarks = generateDailyRemarks({
      calories: totals.calories,
      calorieTarget: targets.calorieTarget,
      protein: totals.protein,
      proteinTarget: targets.proteinTarget,
      fibre: totals.fibre,
      fibreTarget: targets.fibreTarget,
      water: totals.water,
      waterTarget: targets.waterTarget,
      steps: totals.steps,
      stepTarget: targets.stepTarget,
      discretionaryCount: totals.discretionaryCount,
    });

    return NextResponse.json({
      log: dailyLog,
      foodEntries,
      waterEntries,
      totals,
      targets,
      breakdown,
      remarks,
    });
  } catch (error) {
    console.error('Error fetching journal:', error);
    return NextResponse.json({ error: 'Failed to fetch journal data' }, { status: 500 });
  }
}
