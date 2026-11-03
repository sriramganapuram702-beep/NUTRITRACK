import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculateDailyGoalCompletion, generateDailyRemarks } from '@/lib/nutrition';
import { DailyLog, FoodEntry, WaterEntry } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date = new Date().toISOString().split('T')[0] } = body;

    const db = getDatabase();
    const now = new Date().toISOString();

    let dailyLog = db
      .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as unknown as DailyLog | undefined;

    if (!dailyLog) {
      const logId = 'log_' + crypto.randomUUID();
      const p = auth.profile;
      db.prepare(`
        INSERT INTO daily_logs (
          id, user_id, date, steps, is_submitted,
          calorie_target_snapshot, protein_target_snapshot, carb_target_snapshot,
          fat_target_snapshot, fibre_target_snapshot, water_target_snapshot, step_target_snapshot,
          created_at, updated_at
        ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    // Freeze / snapshot targets from active profile if not already set
    const p = auth.profile;
    const calorieTarget = dailyLog.calorie_target_snapshot || p?.calorie_target || 2000;
    const proteinTarget = dailyLog.protein_target_snapshot || p?.protein_target || 80;
    const carbTarget = dailyLog.carb_target_snapshot || p?.carb_target || 250;
    const fatTarget = dailyLog.fat_target_snapshot || p?.fat_target || 65;
    const fibreTarget = dailyLog.fibre_target_snapshot || p?.fibre_target || 28;
    const waterTarget = dailyLog.water_target_snapshot || p?.water_target || 3000;
    const stepTarget = dailyLog.step_target_snapshot || p?.daily_step_goal || 10000;

    // Fetch food entries
    const foodRows = db
      .prepare('SELECT * FROM food_entries WHERE daily_log_id = ?')
      .all(dailyLog.id) as Array<Record<string, unknown>>;

    const foods: FoodEntry[] = foodRows.map((r) => ({
      id: r.id as string,
      daily_log_id: r.daily_log_id as string,
      meal_type: r.meal_type as FoodEntry['meal_type'],
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
    const waterRows = db
      .prepare('SELECT * FROM water_entries WHERE daily_log_id = ?')
      .all(dailyLog.id) as Array<Record<string, unknown>>;

    const waterEntries: WaterEntry[] = waterRows.map((r) => ({
      id: r.id as string,
      daily_log_id: r.daily_log_id as string,
      amount_ml: Number(r.amount_ml),
      logged_at: r.logged_at as string,
    }));

    const calories = Math.round(foods.reduce((sum, f) => sum + f.calories, 0));
    const protein = Number(foods.reduce((sum, f) => sum + f.protein, 0).toFixed(1));
    const carbs = Number(foods.reduce((sum, f) => sum + f.carbs, 0).toFixed(1));
    const fat = Number(foods.reduce((sum, f) => sum + f.fat, 0).toFixed(1));
    const fibre = Number(foods.reduce((sum, f) => sum + f.fibre, 0).toFixed(1));
    const water = waterEntries.reduce((sum, w) => sum + w.amount_ml, 0);
    const steps = dailyLog.steps || 0;
    const discretionaryCount = foods.filter((f) => f.is_discretionary).length;
    const uniqueMeals = new Set(foods.map((f) => f.meal_type)).size;

    const breakdown = calculateDailyGoalCompletion({
      calories,
      calorieTarget,
      protein,
      proteinTarget,
      fibre,
      fibreTarget,
      water,
      waterTarget,
      steps,
      stepTarget,
      loggedMealsCount: uniqueMeals,
      discretionaryCount,
    });

    const remarks = generateDailyRemarks({
      calories,
      calorieTarget,
      protein,
      proteinTarget,
      fibre,
      fibreTarget,
      water,
      waterTarget,
      steps,
      stepTarget,
      discretionaryCount,
    });

    db.prepare(`
      UPDATE daily_logs SET
        is_submitted = 1,
        submitted_at = ?,
        goal_completion_pct = ?,
        remarks_json = ?,
        calorie_target_snapshot = ?,
        protein_target_snapshot = ?,
        carb_target_snapshot = ?,
        fat_target_snapshot = ?,
        fibre_target_snapshot = ?,
        water_target_snapshot = ?,
        step_target_snapshot = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      now,
      breakdown.overall,
      JSON.stringify(remarks),
      calorieTarget,
      proteinTarget,
      carbTarget,
      fatTarget,
      fibreTarget,
      waterTarget,
      stepTarget,
      now,
      dailyLog.id
    );

    const updatedLog = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(dailyLog.id);

    return NextResponse.json({
      success: true,
      message: 'Day successfully submitted and audited.',
      log: updatedLog,
      breakdown,
      remarks,
    });
  } catch (error) {
    console.error('Error submitting day:', error);
    return NextResponse.json({ error: 'Failed to submit day' }, { status: 500 });
  }
}
