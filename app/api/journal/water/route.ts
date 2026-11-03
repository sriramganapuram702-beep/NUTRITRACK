import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date = new Date().toISOString().split('T')[0], amount_ml } = body;

    const amount = Number(amount_ml);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Please enter a valid water amount in ml.' }, { status: 400 });
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    // Ensure daily log
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
      dailyLog = { id: logId };
    }

    const waterId = 'wat_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO water_entries (id, daily_log_id, amount_ml, logged_at)
      VALUES (?, ?, ?, ?)
    `).run(waterId, dailyLog.id, amount, now);

    db.prepare('UPDATE daily_logs SET updated_at = ? WHERE id = ?').run(now, dailyLog.id);

    const created = db.prepare('SELECT * FROM water_entries WHERE id = ?').get(waterId);

    return NextResponse.json({
      success: true,
      message: `Added ${amount} ml of water.`,
      entry: created,
    });
  } catch (error) {
    console.error('Error logging water:', error);
    return NextResponse.json({ error: 'Failed to log water' }, { status: 500 });
  }
}
