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
    const monthParam = searchParams.get('month') || new Date().toISOString().substring(0, 7);

    const db = getDatabase();

    // Fetch daily logs for the month
    const logs = db
      .prepare('SELECT * FROM daily_logs WHERE user_id = ? AND date LIKE ? ORDER BY date ASC')
      .all(auth.user.id, `${monthParam}-%`) as unknown as Array<DailyLog>;

    // Fetch weight logs for user
    const weightLogs = db
      .prepare('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY date ASC')
      .all(auth.user.id) as unknown as Array<{ date: string; weight_kg: number }>;

    const [yearStr, monthStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDaysInMonth = new Date(year, month, 0).getDate();

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

    let totalCaloriesSum = 0;
    let totalProteinSum = 0;
    let totalCarbsSum = 0;
    let totalFatSum = 0;
    let totalFibreSum = 0;
    let totalWaterSum = 0;
    let totalStepsSum = 0;
    let trackedDaysCount = 0;
    let stepGoalAchievedDays = 0;
    let successfulDaysCount = 0; // >= 80%
    let improvementDaysCount = 0; // 50-79%
    let totalGoalCompletionSum = 0;

    let nutritionScoreSum = 0;
    let proteinScoreSum = 0;
    let fibreScoreSum = 0;
    let waterScoreSum = 0;
    let stepsScoreSum = 0;

    const dailyChartData = [];

    // Map logs by date
    const logMap = new Map<string, DailyLog>();
    logs.forEach((l) => logMap.set(l.date, l));

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateKey = `${monthParam}-${dayStr}`;
      const log = logMap.get(dateKey);

      if (!log) continue;

      // Foods
      const foods = db
        .prepare('SELECT calories, protein, carbs, fat, fibre, is_discretionary, meal_type FROM food_entries WHERE daily_log_id = ?')
        .all(log.id) as unknown as Array<Pick<FoodEntry, 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'is_discretionary' | 'meal_type'>>;

      // Water
      const waterRows = db
        .prepare('SELECT amount_ml FROM water_entries WHERE daily_log_id = ?')
        .all(log.id) as unknown as Array<Pick<WaterEntry, 'amount_ml'>>;

      const dayCalories = Math.round(foods.reduce((acc, f) => acc + f.calories, 0));
      const dayProtein = Number(foods.reduce((acc, f) => acc + f.protein, 0).toFixed(1));
      const dayCarbs = Number(foods.reduce((acc, f) => acc + f.carbs, 0).toFixed(1));
      const dayFat = Number(foods.reduce((acc, f) => acc + f.fat, 0).toFixed(1));
      const dayFibre = Number(foods.reduce((acc, f) => acc + f.fibre, 0).toFixed(1));
      const dayWater = waterRows.reduce((acc, w) => acc + w.amount_ml, 0);
      const daySteps = log.steps || 0;
      const discretionaryCount = foods.filter((f) => f.is_discretionary).length;
      const mealCount = new Set(foods.map((f) => f.meal_type)).size;

      const calTarget = log.calorie_target_snapshot || defaultTargets.calorieTarget;
      const protTarget = log.protein_target_snapshot || defaultTargets.proteinTarget;
      const fibTarget = log.fibre_target_snapshot || defaultTargets.fibreTarget;
      const watTarget = log.water_target_snapshot || defaultTargets.waterTarget;
      const stTarget = log.step_target_snapshot || defaultTargets.stepTarget;

      const isTracked = foods.length > 0 || dayWater > 0 || daySteps > 0 || Boolean(log.is_submitted);

      if (isTracked) {
        trackedDaysCount++;
        totalCaloriesSum += dayCalories;
        totalProteinSum += dayProtein;
        totalCarbsSum += dayCarbs;
        totalFatSum += dayFat;
        totalFibreSum += dayFibre;
        totalWaterSum += dayWater;
        totalStepsSum += daySteps;

        if (daySteps >= stTarget) {
          stepGoalAchievedDays++;
        }

        const breakdown = calculateDailyGoalCompletion({
          calories: dayCalories,
          calorieTarget: calTarget,
          protein: dayProtein,
          proteinTarget: protTarget,
          fibre: dayFibre,
          fibreTarget: fibTarget,
          water: dayWater,
          waterTarget: watTarget,
          steps: daySteps,
          stepTarget: stTarget,
          loggedMealsCount: mealCount,
          discretionaryCount,
        });

        const overall = log.goal_completion_pct !== null && log.goal_completion_pct !== undefined
          ? log.goal_completion_pct
          : breakdown.overall;

        totalGoalCompletionSum += overall;
        nutritionScoreSum += breakdown.calories.score;
        proteinScoreSum += breakdown.protein.score;
        fibreScoreSum += breakdown.fibre.score;
        waterScoreSum += breakdown.water.score;
        stepsScoreSum += breakdown.steps.score;

        if (overall >= 80) successfulDaysCount++;
        else if (overall >= 50) improvementDaysCount++;

        dailyChartData.push({
          date: dateKey,
          day: dayStr,
          calories: dayCalories,
          calorieTarget: calTarget,
          protein: dayProtein,
          proteinTarget: protTarget,
          carbs: dayCarbs,
          fat: dayFat,
          fibre: dayFibre,
          water: dayWater,
          waterTarget: watTarget,
          steps: daySteps,
          stepTarget: stTarget,
          completionPct: overall,
        });
      }
    }

    const divisor = trackedDaysCount > 0 ? trackedDaysCount : 1;

    // Weight metrics
    let startingWeight = auth.profile?.weight_kg || 0;
    let currentWeight = auth.profile?.weight_kg || 0;
    let weightChange = 0;

    if (weightLogs.length > 0) {
      startingWeight = weightLogs[0].weight_kg;
      currentWeight = weightLogs[weightLogs.length - 1].weight_kg;
      weightChange = Number((currentWeight - startingWeight).toFixed(1));
    }

    const trackingConsistencyPct = Math.round((trackedDaysCount / totalDaysInMonth) * 100);

    const averages = {
      calories: Math.round(totalCaloriesSum / divisor),
      protein: Number((totalProteinSum / divisor).toFixed(1)),
      carbs: Number((totalCarbsSum / divisor).toFixed(1)),
      fat: Number((totalFatSum / divisor).toFixed(1)),
      fibre: Number((totalFibreSum / divisor).toFixed(1)),
      water: Math.round(totalWaterSum / divisor),
      steps: Math.round(totalStepsSum / divisor),
      totalMonthlySteps: totalStepsSum,
      stepGoalAchievedDays,
      trackedDaysCount,
      totalDaysInMonth,
      averageGoalCompletion: Math.round(totalGoalCompletionSum / divisor),
      successfulDays: successfulDaysCount,
      needingImprovementDays: improvementDaysCount,
    };

    const monthlyBreakdown = {
      overall: averages.averageGoalCompletion,
      nutrition: Math.round(nutritionScoreSum / divisor),
      protein: Math.round(proteinScoreSum / divisor),
      fibre: Math.round(fibreScoreSum / divisor),
      water: Math.round(waterScoreSum / divisor),
      steps: Math.round(stepsScoreSum / divisor),
      trackingConsistency: trackingConsistencyPct,
      trackedLabel: `Tracked ${trackedDaysCount} of ${totalDaysInMonth} days.`,
    };

    return NextResponse.json({
      month: monthParam,
      averages,
      body: {
        startingWeight,
        currentWeight,
        weightChange,
        weightLogs,
      },
      monthlyBreakdown,
      dailyChartData,
    });
  } catch (error) {
    console.error('Error fetching monthly progress:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly data' }, { status: 500 });
  }
}
