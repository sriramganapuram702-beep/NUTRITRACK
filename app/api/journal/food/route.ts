import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculatePortionMacros } from '@/lib/nutrition';
import { FoodItem, MealType, PortionUnit } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date = new Date().toISOString().split('T')[0],
      meal_type,
      food_item_id,
      custom_name,
      portion_amount,
      portion_unit = 'grams',
      calories: explicitCalories,
      protein: explicitProtein,
      carbs: explicitCarbs,
      fat: explicitFat,
      fibre: explicitFibre,
      is_discretionary: explicitDiscretionary,
      icon,
    } = body;

    if (!meal_type || (!food_item_id && !custom_name) || !portion_amount) {
      return NextResponse.json(
        { error: 'Meal type, food item, and portion are required.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Ensure daily log exists
    let dailyLog = db
      .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as { id: string; is_submitted: number } | undefined;

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
      dailyLog = { id: logId, is_submitted: 0 };
    }

    // Determine macros
    let finalName = custom_name || 'Food';
    let finalIcon = icon || '🍽️';
    let computedWeightG = 100;
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fibre = 0;
    let isDiscretionary = 0;

    if (food_item_id) {
      const food = db
        .prepare('SELECT * FROM food_items WHERE id = ?')
        .get(food_item_id) as FoodItem | undefined;

      if (food) {
        finalName = food.name;
        finalIcon = food.icon || '🍽️';
        isDiscretionary = food.is_discretionary ? 1 : 0;
        const macros = calculatePortionMacros(food, Number(portion_amount), portion_unit as PortionUnit);
        computedWeightG = macros.computedWeightG;
        calories = macros.calories;
        protein = macros.protein;
        carbs = macros.carbs;
        fat = macros.fat;
        fibre = macros.fibre;
      }
    } else {
      calories = Number(explicitCalories) || 0;
      protein = Number(explicitProtein) || 0;
      carbs = Number(explicitCarbs) || 0;
      fat = Number(explicitFat) || 0;
      fibre = Number(explicitFibre) || 0;
      isDiscretionary = explicitDiscretionary ? 1 : 0;
      computedWeightG = portion_unit === 'grams' ? Number(portion_amount) : 100;
    }

    const entryId = 'fent_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO food_entries (
        id, daily_log_id, meal_type, food_item_id, custom_name,
        portion_amount, portion_unit, computed_weight_g,
        calories, protein, carbs, fat, fibre,
        is_discretionary, icon, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entryId,
      dailyLog.id,
      meal_type as MealType,
      food_item_id || null,
      finalName,
      Number(portion_amount),
      portion_unit,
      computedWeightG,
      calories,
      protein,
      carbs,
      fat,
      fibre,
      isDiscretionary,
      finalIcon,
      now
    );

    // Update daily log timestamp
    db.prepare('UPDATE daily_logs SET updated_at = ? WHERE id = ?').run(now, dailyLog.id);

    const createdEntry = db.prepare('SELECT * FROM food_entries WHERE id = ?').get(entryId);

    return NextResponse.json({
      success: true,
      message: 'Food item added to journal.',
      entry: createdEntry,
    });
  } catch (error) {
    console.error('Error adding food entry:', error);
    return NextResponse.json({ error: 'Failed to add food entry' }, { status: 500 });
  }
}
