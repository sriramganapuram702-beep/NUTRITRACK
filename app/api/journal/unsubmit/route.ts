import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date = new Date().toISOString().split('T')[0] } = body;

    const db = getDatabase();

    const dailyLog = db
      .prepare('SELECT id FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as { id: string } | undefined;

    if (!dailyLog) {
      return NextResponse.json({ error: 'Daily log not found' }, { status: 404 });
    }

    db.prepare('UPDATE daily_logs SET is_submitted = 0, updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      dailyLog.id
    );

    return NextResponse.json({
      success: true,
      message: 'Day unlocked for editing. Remember to re-submit when finished.',
    });
  } catch (error) {
    console.error('Error unlocking day:', error);
    return NextResponse.json({ error: 'Failed to unlock day' }, { status: 500 });
  }
}
