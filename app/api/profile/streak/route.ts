import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();

    // Query user's daily logs ordered by date DESC
    const rows = db
      .prepare('SELECT date, is_submitted, goal_completion_pct FROM daily_logs WHERE user_id = ? ORDER BY date DESC')
      .all(auth.user.id) as Array<{ date: string; is_submitted: number; goal_completion_pct: number }>;

    let currentStreak = 0;
    const totalDays = rows.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if streak is active (logged today or yesterday)
    const logDates = new Set(rows.map((r) => r.date));

    let checkDate = new Date();
    if (!logDates.has(todayStr) && logDates.has(yesterdayStr)) {
      checkDate = yesterday;
    }

    while (true) {
      const dateKey = checkDate.toISOString().split('T')[0];
      if (logDates.has(dateKey)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Determine Badge Tier
    let badgeTier = 'Starter';
    let badgeIcon = '🌱';
    let badgeColor = 'emerald';

    if (currentStreak >= 30) {
      badgeTier = 'Diamond Master';
      badgeIcon = '💎';
      badgeColor = 'cyan';
    } else if (currentStreak >= 14) {
      badgeTier = 'Gold Champion';
      badgeIcon = '🥇';
      badgeColor = 'amber';
    } else if (currentStreak >= 7) {
      badgeTier = 'Silver Streak';
      badgeIcon = '🥈';
      badgeColor = 'slate';
    } else if (currentStreak >= 3) {
      badgeTier = 'Bronze Achiever';
      badgeIcon = '🥉';
      badgeColor = 'orange';
    }

    const shareText = `🔥 I just hit a ${currentStreak || 1}-Day Nutrition Streak on NutriTrack! 🥑 Tracking my calories, protein, and water every single day. Track yours with me at https://nutritrack-umber-tau.vercel.app`;

    return NextResponse.json({
      success: true,
      streak: {
        currentStreak: Math.max(1, currentStreak),
        totalDaysLogged: totalDays || 1,
        badgeTier,
        badgeIcon,
        badgeColor,
        userName: auth.profile?.full_name || auth.user.email.split('@')[0],
        shareText,
      },
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streak data' },
      { status: 500 }
    );
  }
}
