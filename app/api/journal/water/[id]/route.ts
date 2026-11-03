import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDatabase();

    const entry = db
      .prepare(`
        SELECT we.id, dl.user_id, we.daily_log_id
        FROM water_entries we
        JOIN daily_logs dl ON we.daily_log_id = dl.id
        WHERE we.id = ?
      `)
      .get(id) as { id: string; user_id: string; daily_log_id: string } | undefined;

    if (!entry || entry.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Water entry not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM water_entries WHERE id = ?').run(id);
    db.prepare('UPDATE daily_logs SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      entry.daily_log_id
    );

    return NextResponse.json({ success: true, message: 'Water entry deleted.' });
  } catch (error) {
    console.error('Error deleting water entry:', error);
    return NextResponse.json({ error: 'Failed to delete water entry' }, { status: 500 });
  }
}
