export type MealType =
  | 'Breakfast'
  | 'Morning Snack'
  | 'Lunch'
  | 'Evening Snack'
  | 'Dinner'
  | 'Other';

export type ActivityLevel =
  | 'Sedentary'
  | 'Lightly Active'
  | 'Moderately Active'
  | 'Very Active';

export type FitnessGoal =
  | 'Maintain Weight'
  | 'Gain Weight / Muscle'
  | 'Lose Weight';

export type Gender = 'Male' | 'Female' | 'Other';

export type PortionUnit = 'grams' | 'ml' | 'pieces' | 'cups' | 'servings';

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  age: number;
  gender: Gender;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  fitness_goal: FitnessGoal;
  daily_step_goal: number;
  calorie_target: number;
  protein_target: number;
  carb_target: number;
  fat_target: number;
  fibre_target: number;
  water_target: number;
  updated_at: string;
}

export interface FoodItem {
  id: string;
  name: string;
  category: 'Protein' | 'Carbohydrates' | 'Fruits' | 'Vegetables' | 'Discretionary';
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fibre_per_100g: number;
  serving_unit_default: PortionUnit;
  serving_weight_grams: number;
  is_discretionary: boolean;
  icon: string;
  created_at?: string;
}

export interface FoodEntry {
  id: string;
  daily_log_id: string;
  meal_type: MealType;
  food_item_id?: string | null;
  custom_name: string;
  portion_amount: number;
  portion_unit: PortionUnit;
  computed_weight_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  is_discretionary: boolean;
  icon?: string;
  created_at: string;
}

export interface WaterEntry {
  id: string;
  daily_log_id: string;
  amount_ml: number;
  logged_at: string;
}

export interface DailyRemarks {
  positive?: string;
  improvement?: string;
  water?: string;
  steps?: string;
  discretionary?: string;
  disclaimer: string;
}

export interface DailyGoalBreakdown {
  calories: { consumed: number; target: number; pct: number; score: number };
  protein: { consumed: number; target: number; pct: number; score: number };
  fibre: { consumed: number; target: number; pct: number; score: number };
  water: { consumed: number; target: number; pct: number; score: number };
  steps: { consumed: number; target: number; pct: number; score: number };
  consistency: { loggedMeals: number; score: number };
  discretionaryPenalty: number;
  overall: number;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  steps: number;
  is_submitted: boolean;
  submitted_at?: string;
  goal_completion_pct?: number;
  remarks_json?: string;
  calorie_target_snapshot?: number;
  protein_target_snapshot?: number;
  carb_target_snapshot?: number;
  fat_target_snapshot?: number;
  fibre_target_snapshot?: number;
  water_target_snapshot?: number;
  step_target_snapshot?: number;
  created_at: string;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}
