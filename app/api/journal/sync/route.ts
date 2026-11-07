import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { FoodEntry, WaterEntry } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, foodEntries = [], waterEntries = [], steps = 0, isSubmitted = false } = body;

    if (!date) {
      return NextResponse.json({ error: 'Date is required.' }, { status: 400 });
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Ensure daily log exists in database
    let dailyLog = db
      .prepare('SELECT id FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as { id: string } | undefined;

    if (!dailyLog) {
      const logId = 'log_' + crypto.randomUUID();
      const p = auth.profile;
      db.prepare(`
        INSERT INTO daily_logs (
          id, user_id, date, steps, is_submitted,
          calorie_target_snapshot, protein_target_snapshot, carb_target_snapshot,
          fat_target_snapshot, fibre_target_snapshot, water_target_snapshot, step_target_snapshot,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        auth.user.id,
        date,
        steps || 0,
        isSubmitted ? 1 : 0,
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
      dailyLog = { id: logId };
    } else {
      db.prepare('UPDATE daily_logs SET steps = MAX(steps, ?), is_submitted = ?, updated_at = ? WHERE id = ?').run(
        steps || 0,
        isSubmitted ? 1 : 0,
        now,
        dailyLog.id
      );
    }

    // Re-hydrate food entries
    for (const f of foodEntries as FoodEntry[]) {
      if (!f.id || !f.custom_name) continue;
      const existing = db.prepare('SELECT id FROM food_entries WHERE id = ?').get(f.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO food_entries (
            id, daily_log_id, meal_type, food_item_id, custom_name,
            portion_amount, portion_unit, computed_weight_g,
            calories, protein, carbs, fat, fibre,
            is_discretionary, icon, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          f.id,
          dailyLog.id,
          f.meal_type,
          f.food_item_id || null,
          f.custom_name,
          Number(f.portion_amount) || 1,
          f.portion_unit || 'servings',
          Number(f.computed_weight_g) || 100,
          Number(f.calories) || 0,
          Number(f.protein) || 0,
          Number(f.carbs) || 0,
          Number(f.fat) || 0,
          Number(f.fibre) || 0,
          f.is_discretionary ? 1 : 0,
          f.icon || '🍽️',
          f.created_at || now
        );
      }
    }

    // Re-hydrate water entries
    for (const w of waterEntries as WaterEntry[]) {
      if (!w.id || !w.amount_ml) continue;
      const existing = db.prepare('SELECT id FROM water_entries WHERE id = ?').get(w.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO water_entries (id, daily_log_id, amount_ml, logged_at)
          VALUES (?, ?, ?, ?)
        `).run(w.id, dailyLog.id, Number(w.amount_ml) || 250, w.logged_at || now);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Client data synced successfully to cloud database.',
    });
  } catch (error) {
    console.error('Error syncing journal data:', error);
    return NextResponse.json({ error: 'Failed to sync journal data' }, { status: 500 });
  }
}
