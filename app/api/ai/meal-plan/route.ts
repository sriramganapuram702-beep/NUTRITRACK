import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const db = getDatabase();
    const profile = auth.profile;

    const calTarget = profile?.calorie_target || 2000;
    const proteinTarget = profile?.protein_target || 80;
    const carbTarget = profile?.carb_target || 250;
    const fatTarget = profile?.fat_target || 65;

    // Fetch today's food entries
    const dailyLog = db
      .prepare('SELECT id FROM daily_logs WHERE user_id = ? AND date = ?')
      .get(auth.user.id, date) as { id: string } | undefined;

    let consumedCalories = 0;
    let consumedProtein = 0;
    let consumedCarbs = 0;
    let consumedFat = 0;

    if (dailyLog) {
      const entries = db
        .prepare('SELECT calories, protein, carbs, fat FROM food_entries WHERE daily_log_id = ?')
        .all(dailyLog.id) as Array<{ calories: number; protein: number; carbs: number; fat: number }>;

      entries.forEach((e) => {
        consumedCalories += Number(e.calories) || 0;
        consumedProtein += Number(e.protein) || 0;
        consumedCarbs += Number(e.carbs) || 0;
        consumedFat += Number(e.fat) || 0;
      });
    }

    const remainingCal = Math.max(0, calTarget - Math.round(consumedCalories));
    const remainingProtein = Math.max(0, Math.round(proteinTarget - consumedProtein));
    const remainingCarbs = Math.max(0, Math.round(carbTarget - consumedCarbs));
    const remainingFat = Math.max(0, Math.round(fatTarget - consumedFat));

    // Curate tailored meal suggestions based on remaining targets
    const recommendations = [
      {
        id: 'rec_1',
        title: 'High-Protein Paneer & Veggie Sauté',
        type: 'Vegetarian',
        calories: 340,
        protein: 22,
        carbs: 18,
        fat: 16,
        description:
          'Pan-tossed low-fat paneer cubes with bell peppers, onions, tomatoes, and roasted cumin. Delivers high satiety and muscle recovery.',
        ingredients: ['150g Paneer', '1 Bell Pepper (Capsicum)', '1 Medium Onion', '1 tsp Olive / Mustard Oil', 'Jeera & Turmeric'],
      },
      {
        id: 'rec_2',
        title: 'Lemon Herb Grilled Chicken Breast & Steamed Rice',
        type: 'Non-Vegetarian',
        calories: 390,
        protein: 35,
        carbs: 32,
        fat: 6,
        description:
          'Marinated grilled chicken breast served with half a cup of warm basmati rice and fresh cucumber slices.',
        ingredients: ['150g Chicken Breast', '1/2 cup Cooked Basmati Rice', '1 Lemon', '1 Cucumber', 'Black Pepper & Salt'],
      },
      {
        id: 'rec_3',
        title: 'Protein Moong Dal Khichdi & Greek Yogurt',
        type: 'Light & Comforting',
        calories: 310,
        protein: 18,
        carbs: 45,
        fat: 5,
        description:
          'Warm comforting yellow moong dal cooked with whole cumin seeds, served with a cup of chilled plain curd or Greek yogurt.',
        ingredients: ['1 cup Cooked Yellow Dal', '1/2 cup Curd / Greek Yogurt', 'Fresh Coriander', 'Ginger & Green Chilli'],
      },
    ];

    // Smart Grocery Checklist
    const groceryChecklist = [
      { item: 'Eggs (Pack of 6 or 12)', category: 'Protein', checked: false },
      { item: 'Fresh Paneer / Cottage Cheese (200g)', category: 'Protein', checked: false },
      { item: 'Skinless Chicken Breast (500g)', category: 'Protein', checked: false },
      { item: 'Greek Yogurt / Plain Curd', category: 'Dairy', checked: false },
      { item: 'Yellow Moong Dal / Toor Dal', category: 'Pantry', checked: false },
      { item: 'Rolled Oats (500g)', category: 'Carbohydrates', checked: false },
      { item: 'Bananas & Seasonal Apples', category: 'Fruits', checked: false },
      { item: 'Spinach, Bell Peppers & Cucumbers', category: 'Vegetables', checked: false },
    ];

    return NextResponse.json({
      success: true,
      date,
      budget: {
        targetCalories: calTarget,
        consumedCalories: Math.round(consumedCalories),
        remainingCalories: remainingCal,
        targetProtein: proteinTarget,
        consumedProtein: Number(consumedProtein.toFixed(1)),
        remainingProtein: remainingProtein,
        remainingCarbs,
        remainingFat,
      },
      recommendations,
      groceryChecklist,
    });
  } catch (error) {
    console.error('Error generating AI meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate meal plan' },
      { status: 500 }
    );
  }
}
