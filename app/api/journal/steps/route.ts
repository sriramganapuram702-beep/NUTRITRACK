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
    const { date = new Date().toISOString().split('T')[0], steps } = body;

    const stepCount = Number(steps);
    if (isNaN(stepCount) || stepCount < 0) {
      return NextResponse.json({ error: 'Please enter a valid step count.' }, { status: 400 });
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    let dailyLog = db
      .prepare('SELECT id, steps FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as { id: string; steps: number } | undefined;

    if (!dailyLog) {
      const logId = 'log_' + crypto.randomUUID();
      const p = auth.profile;
      db.prepare(`
        INSERT INTO daily_logs (
          id, user_id, date, steps, is_submitted,
          calorie_target_snapshot, protein_target_snapshot, carb_target_snapshot,
          fat_target_snapshot, fibre_target_snapshot, water_target_snapshot, step_target_snapshot,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        auth.user.id,
        date,
        stepCount,
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
    } else {
      // Replaces current daily valid total with latest entered total
      db.prepare('UPDATE daily_logs SET steps = ?, updated_at = ? WHERE id = ?').run(
        stepCount,
        now,
        dailyLog.id
      );
    }

    return NextResponse.json({
      success: true,
      message: `Steps updated to ${stepCount.toLocaleString()}.`,
      steps: stepCount,
    });
  } catch (error) {
    console.error('Error updating steps:', error);
    return NextResponse.json({ error: 'Failed to update steps' }, { status: 500 });
  }
}
