import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculateDailyGoalCompletion } from '@/lib/nutrition';
import { DailyLog, FoodEntry, WaterEntry } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month') || new Date().toISOString().substring(0, 7); // YYYY-MM

    const db = getDatabase();

    const logs = db
      .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date LIKE ?')
      .all(auth.user.id, `${monthParam}-%`) as unknown as Array<DailyLog>;

    // For each log, get entries
    const logMap = new Map<string, DailyLog>();
    logs.forEach((l) => logMap.set(l.date, l));

    // Calculate days in month
    const [yearStr, monthStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const p = auth.profile;
    const defaultTargets = {
      calorieTarget: p?.calorie_target || 2000,
      proteinTarget: p?.protein_target || 80,
      carbTarget: p?.carb_target || 250,
      fatTarget: p?.fat_target || 65,
      fibreTarget: p?.fibre_target || 28,
      waterTarget: p?.water_target || 3000,
      stepTarget: p?.daily_step_goal || 10000,
    };

    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateKey = `${monthParam}-${dayStr}`;

      const log = logMap.get(dateKey);
      if (!log) {
        days.push({
          date: dateKey,
          dayNumber: day,
          status: 'untracked', // ⚪
          completionPct: 0,
          calories: 0,
          mealCount: 0,
          isSubmitted: false,
        });
        continue;
      }

      // Fetch food and water
      const foods = db
        .prepare('SELECT calories, protein, fibre, meal_type, is_discretionary FROM food_entries WHERE daily_log_id = ?')
        .all(log.id) as unknown as Array<Pick<FoodEntry, 'calories' | 'protein' | 'fibre' | 'meal_type' | 'is_discretionary'>>;

      const waterRows = db
        .prepare('SELECT amount_ml FROM water_entries WHERE daily_log_id = ?')
        .all(log.id) as unknown as Array<Pick<WaterEntry, 'amount_ml'>>;

      const totalCalories = Math.round(foods.reduce((acc, f) => acc + f.calories, 0));
      const totalProtein = foods.reduce((acc, f) => acc + f.protein, 0);
      const totalFibre = foods.reduce((acc, f) => acc + f.fibre, 0);
      const totalWater = waterRows.reduce((acc, w) => acc + w.amount_ml, 0);
      const steps = log.steps || 0;
      const discretionaryCount = foods.filter((f) => f.is_discretionary).length;
      const mealCount = new Set(foods.map((f) => f.meal_type)).size;

      let completionPct = log.goal_completion_pct;

      if (completionPct === null || completionPct === undefined) {
        if (foods.length > 0 || totalWater > 0 || steps > 0) {
          const breakdown = calculateDailyGoalCompletion({
            calories: totalCalories,
            calorieTarget: log.calorie_target_snapshot || defaultTargets.calorieTarget,
            protein: totalProtein,
            proteinTarget: log.protein_target_snapshot || defaultTargets.proteinTarget,
            fibre: totalFibre,
            fibreTarget: log.fibre_target_snapshot || defaultTargets.fibreTarget,
            water: totalWater,
            waterTarget: log.water_target_snapshot || defaultTargets.waterTarget,
            steps,
            stepTarget: log.step_target_snapshot || defaultTargets.stepTarget,
            loggedMealsCount: mealCount,
            discretionaryCount,
          });
          completionPct = breakdown.overall;
        } else {
          completionPct = 0;
        }
      }

      let status: 'achieved' | 'improvement' | 'missed' | 'untracked' = 'untracked';
      if (foods.length === 0 && totalWater === 0 && steps === 0) {
        status = 'untracked'; // ⚪
      } else if (completionPct >= 80) {
        status = 'achieved'; // 🟢
      } else if (completionPct >= 50) {
        status = 'improvement'; // 🟡
      } else {
        status = 'missed'; // 🔴
      }

      days.push({
        date: dateKey,
        dayNumber: day,
        status,
        completionPct,
        calories: totalCalories,
        mealCount,
        isSubmitted: Boolean(log.is_submitted),
      });
    }

    return NextResponse.json({
      month: monthParam,
      days,
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}
