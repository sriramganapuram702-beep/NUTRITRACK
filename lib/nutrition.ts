import {
  ActivityLevel,
  DailyGoalBreakdown,
  DailyRemarks,
  FitnessGoal,
  FoodItem,
  Gender,
  PortionUnit,
} from './types';

export interface CalculatedTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  fibreTarget: number;
  waterTarget: number;
  stepTarget: number;
}

/**
 * Calculates estimated daily targets based on Mifflin-St Jeor formula
 */
export function calculatePersonalizedTargets(params: {
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  fitness_goal: FitnessGoal;
  daily_step_goal?: number;
}): CalculatedTargets {
  const {
    age,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    fitness_goal,
    daily_step_goal = 10000,
  } = params;

  // Mifflin-St Jeor BMR
  let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === 'Male') {
    bmr += 5;
  } else if (gender === 'Female') {
    bmr -= 161;
  } else {
    bmr -= 78; // neutral midpoint
  }

  // Activity Factor
  let activityMultiplier = 1.2; // Sedentary
  if (activity_level === 'Lightly Active') activityMultiplier = 1.375;
  else if (activity_level === 'Moderately Active') activityMultiplier = 1.55;
  else if (activity_level === 'Very Active') activityMultiplier = 1.725;

  const tdee = Math.round(bmr * activityMultiplier);

  // Goal calorie adjustment
  let calorieTarget = tdee;
  if (fitness_goal === 'Lose Weight') {
    calorieTarget = Math.max(1200, tdee - 450);
  } else if (fitness_goal === 'Gain Weight / Muscle') {
    calorieTarget = tdee + 400;
  }

  // Protein targets
  let proteinPerKg = 1.4;
  if (fitness_goal === 'Gain Weight / Muscle') {
    proteinPerKg = 1.8;
  } else if (fitness_goal === 'Lose Weight') {
    proteinPerKg = 1.6;
  }
  const proteinTarget = Math.round(weight_kg * proteinPerKg);

  // Fat targets: ~25% of calories (9 kcal/g)
  const fatCalories = calorieTarget * 0.25;
  const fatTarget = Math.round(fatCalories / 9);

  // Carbohydrate targets: Remaining calories (4 kcal/g)
  const carbCalories = Math.max(0, calorieTarget - (proteinTarget * 4 + fatCalories));
  const carbTarget = Math.round(carbCalories / 4);

  // Fibre target: ~14g per 1000 kcal
  const fibreTarget = Math.max(25, Math.round((calorieTarget / 1000) * 14));

  // Water target: ~35 ml per kg of body weight
  const waterTarget = Math.min(4500, Math.max(2000, Math.round(weight_kg * 35)));

  return {
    bmr: Math.round(bmr),
    tdee,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    fibreTarget,
    waterTarget,
    stepTarget: daily_step_goal,
  };
}

/**
 * Calculates grams equivalent and macros for a portion of a food item
 */
export function calculatePortionMacros(
  food: Pick<
    FoodItem,
    | 'calories_per_100g'
    | 'protein_per_100g'
    | 'carbs_per_100g'
    | 'fat_per_100g'
    | 'fibre_per_100g'
    | 'serving_unit_default'
    | 'serving_weight_grams'
  >,
  portionAmount: number,
  portionUnit: PortionUnit
) {
  let computedWeightG = 100;

  if (portionUnit === 'grams' || portionUnit === 'ml') {
    computedWeightG = portionAmount;
  } else if (portionUnit === 'pieces') {
    computedWeightG = portionAmount * food.serving_weight_grams;
  } else if (portionUnit === 'cups') {
    const cupWeight = food.serving_unit_default === 'cups' ? food.serving_weight_grams : 200;
    computedWeightG = portionAmount * cupWeight;
  } else if (portionUnit === 'servings') {
    computedWeightG = portionAmount * food.serving_weight_grams;
  }

  const multiplier = computedWeightG / 100;

  return {
    computedWeightG: Math.round(computedWeightG),
    calories: Math.round(food.calories_per_100g * multiplier),
    protein: Number((food.protein_per_100g * multiplier).toFixed(1)),
    carbs: Number((food.carbs_per_100g * multiplier).toFixed(1)),
    fat: Number((food.fat_per_100g * multiplier).toFixed(1)),
    fibre: Number((food.fibre_per_100g * multiplier).toFixed(1)),
  };
}

/**
 * Calculates transparent Daily Goal Completion percentage and breakdown
 */
export function calculateDailyGoalCompletion(params: {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  fibre: number;
  fibreTarget: number;
  water: number;
  waterTarget: number;
  steps: number;
  stepTarget: number;
  loggedMealsCount: number;
  discretionaryCount: number;
}): DailyGoalBreakdown {
  const {
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
    loggedMealsCount,
    discretionaryCount,
  } = params;

  // Calorie Score (Weight: 25%)
  let caloriePct = 0;
  let calorieScore = 0;
  if (calorieTarget > 0) {
    const ratio = calories / calorieTarget;
    caloriePct = Math.round(ratio * 100);
    if (ratio >= 0.9 && ratio <= 1.1) {
      calorieScore = 100;
    } else if (ratio < 0.9) {
      calorieScore = Math.min(100, Math.round((ratio / 0.9) * 100));
    } else {
      // Over-eating penalty tapering
      calorieScore = Math.max(0, Math.round(100 - (ratio - 1.1) * 150));
    }
  }

  // Protein Score (Weight: 20%)
  const proteinPct = proteinTarget > 0 ? Math.round((protein / proteinTarget) * 100) : 0;
  const proteinScore = Math.min(100, proteinPct);

  // Fibre Score (Weight: 15%)
  const fibrePct = fibreTarget > 0 ? Math.round((fibre / fibreTarget) * 100) : 0;
  const fibreScore = Math.min(100, fibrePct);

  // Water Score (Weight: 15%)
  const waterPct = waterTarget > 0 ? Math.round((water / waterTarget) * 100) : 0;
  const waterScore = Math.min(100, waterPct);

  // Steps Score (Weight: 15%)
  const stepsPct = stepTarget > 0 ? Math.round((steps / stepTarget) * 100) : 0;
  const stepsScore = Math.min(100, stepsPct);

  // Logging Consistency (Weight: 10%)
  let consistencyScore = 0;
  if (loggedMealsCount >= 3) consistencyScore = 100;
  else if (loggedMealsCount === 2) consistencyScore = 67;
  else if (loggedMealsCount === 1) consistencyScore = 33;

  // Discretionary modifier (neutral penalty if excessive)
  let discretionaryPenalty = 0;
  if (discretionaryCount > 2) {
    discretionaryPenalty = Math.min(10, (discretionaryCount - 2) * 3);
  }

  const rawWeighted =
    calorieScore * 0.25 +
    proteinScore * 0.2 +
    fibreScore * 0.15 +
    waterScore * 0.15 +
    stepsScore * 0.15 +
    consistencyScore * 0.1;

  const overall = Math.max(0, Math.min(100, Math.round(rawWeighted - discretionaryPenalty)));

  return {
    calories: { consumed: calories, target: calorieTarget, pct: caloriePct, score: calorieScore },
    protein: { consumed: protein, target: proteinTarget, pct: proteinPct, score: proteinScore },
    fibre: { consumed: fibre, target: fibreTarget, pct: fibrePct, score: fibreScore },
    water: { consumed: water, target: waterTarget, pct: waterPct, score: waterScore },
    steps: { consumed: steps, target: stepTarget, pct: stepsPct, score: stepsScore },
    consistency: { loggedMeals: loggedMealsCount, score: consistencyScore },
    discretionaryPenalty,
    overall,
  };
}

/**
 * Generates neutral, constructive remarks based on end-of-day intake
 */
export function generateDailyRemarks(params: {
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  fibre: number;
  fibreTarget: number;
  water: number;
  waterTarget: number;
  steps: number;
  stepTarget: number;
  discretionaryCount: number;
}): DailyRemarks {
  const {
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
  } = params;

  let positive: string | undefined;
  let improvement: string | undefined;
  let waterRemark: string | undefined;
  let stepsRemark: string | undefined;
  let discretionaryRemark: string | undefined;

  // Protein Evaluation
  const proteinRatio = proteinTarget > 0 ? protein / proteinTarget : 0;
  if (proteinRatio >= 0.9) {
    positive = 'Your protein intake was close to your target today, supporting recovery and satiety.';
  } else {
    improvement = 'Your protein intake was below your estimated target. Consider incorporating foods like eggs, dal, paneer, or lean proteins.';
  }

  // Fibre Evaluation
  const fibreRatio = fibreTarget > 0 ? fibre / fibreTarget : 0;
  if (fibreRatio < 0.8) {
    if (!improvement) {
      improvement = 'Your fibre intake was below your estimated target. Try adding more vegetables, fruits, or legumes.';
    }
  } else if (!positive && fibreRatio >= 0.9) {
    positive = 'Excellent job meeting your fibre target with wholesome food choices.';
  }

  // Water Evaluation
  const waterRatio = waterTarget > 0 ? water / waterTarget : 0;
  if (waterRatio >= 0.95) {
    waterRemark = 'Great job staying hydrated! You reached your daily water target.';
  } else {
    waterRemark = 'Your water intake was lower than your daily target. Consider keeping a filled bottle nearby tomorrow.';
  }

  // Steps Evaluation
  const stepRatio = stepTarget > 0 ? steps / stepTarget : 0;
  const stepPct = Math.round(stepRatio * 100);
  if (stepRatio >= 1.0) {
    stepsRemark = `You exceeded your step target today with ${steps.toLocaleString()} steps!`;
  } else {
    stepsRemark = `You completed ${stepPct}% of your step goal.`;
  }

  // Discretionary Foods Evaluation (Neutral observation per spec)
  if (discretionaryCount === 0) {
    discretionaryRemark = 'Your intake was focused on minimally processed, whole food sources today.';
  } else if (discretionaryCount <= 2) {
    discretionaryRemark = `You recorded ${discretionaryCount} discretionary food ${discretionaryCount === 1 ? 'item' : 'items'} today in moderation.`;
  } else {
    discretionaryRemark = `Your intake included ${discretionaryCount} discretionary foods today. Consider balancing future meals with more whole foods, vegetables, fruit, fibre and protein.`;
  }

  return {
    positive,
    improvement,
    water: waterRemark,
    steps: stepsRemark,
    discretionary: discretionaryRemark,
    disclaimer:
      'Nutrition values are estimates and may vary based on ingredients, preparation method and portion size. This application is for general informational and tracking purposes and is not a substitute for professional medical or dietary advice.',
  };
}
