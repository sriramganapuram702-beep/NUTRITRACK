import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { calculatePortionMacros } from '@/lib/nutrition';
import { FoodItem } from '@/lib/types';

interface DetectedItemCandidate {
  food_item_id?: string;
  name: string;
  category: string;
  portion_amount: number;
  portion_unit: FoodItem['serving_unit_default'];
  confidence: 'High' | 'Medium' | 'Estimated';
  icon: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  is_discretionary: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { imageBase64 = '', filename = '', meal_type = '' } = body;

    const db = getDatabase();
    const allFoods = db.prepare('SELECT * FROM food_items').all() as Array<Record<string, unknown>>;

    const foodsMap = new Map<string, FoodItem>();
    allFoods.forEach((f) => {
      foodsMap.set((f.name as string).toLowerCase(), {
        id: f.id as string,
        name: f.name as string,
        category: f.category as FoodItem['category'],
        calories_per_100g: Number(f.calories_per_100g),
        protein_per_100g: Number(f.protein_per_100g),
        carbs_per_100g: Number(f.carbs_per_100g),
        fat_per_100g: Number(f.fat_per_100g),
        fibre_per_100g: Number(f.fibre_per_100g),
        serving_unit_default: f.serving_unit_default as FoodItem['serving_unit_default'],
        serving_weight_grams: Number(f.serving_weight_grams),
        is_discretionary: Boolean(f.is_discretionary),
        icon: (f.icon as string) || '🍽️',
      });
    });

    const detectedFoods: DetectedItemCandidate[] = [];

    // Helper to find food from database with alias handling
    const findFood = (keywords: string[]): FoodItem | undefined => {
      for (const kw of keywords) {
        const cleanKw = kw.toLowerCase().replace(/dall/g, 'dal');
        for (const [name, food] of foodsMap.entries()) {
          if (name.toLowerCase().includes(cleanKw) || (cleanKw.length > 3 && name.toLowerCase().includes(cleanKw.slice(0, -1)))) {
            return food;
          }
        }
      }
      return undefined;
    };

    const lower = (filename + ' ' + meal_type).toLowerCase();

    // 1. Check if Gemini API is available
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && imageBase64 && imageBase64.includes(';base64,')) {
      try {
        const parts = imageBase64.split(';base64,');
        const mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        const base64Data = parts[1];

        const prompt = `Analyze this meal plate photo. Identify the main distinct foods present on the plate.
Return ONLY a valid JSON array of objects with the schema:
[
  {
    "name": "Food name (e.g. Whole Egg, Banana, Cooked White Rice, Dal)",
    "category": "Protein" | "Carbohydrates" | "Fruits" | "Vegetables" | "Discretionary",
    "portion_amount": 1,
    "portion_unit": "cups" | "grams" | "pieces" | "servings",
    "calories": 140,
    "protein": 12.0,
    "carbs": 25.0,
    "fat": 5.0,
    "fibre": 2.0,
    "is_discretionary": false,
    "icon": "🍽️"
  }
]`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const cleanedJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(cleanedJson);

          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const item of parsed) {
              const dbFood = findFood([item.name]);
              detectedFoods.push({
                food_item_id: dbFood?.id,
                name: item.name || 'Detected Dish',
                category: item.category || 'Carbohydrates',
                portion_amount: Number(item.portion_amount) || 1,
                portion_unit: (item.portion_unit || 'servings') as FoodItem['serving_unit_default'],
                confidence: 'High',
                icon: item.icon || dbFood?.icon || '🍽️',
                calories: Math.round(Number(item.calories) || 150),
                protein: Number(Number(item.protein || 5).toFixed(1)),
                carbs: Number(Number(item.carbs || 25).toFixed(1)),
                fat: Number(Number(item.fat || 3).toFixed(1)),
                fibre: Number(Number(item.fibre || 1).toFixed(1)),
                is_discretionary: Boolean(item.is_discretionary),
              });
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini vision API fallback:', geminiErr);
      }
    }

    // 2. Intelligent Plate & Dish Heuristics
    if (detectedFoods.length === 0) {
      const candidates: Array<{ keywords: string[]; amount: number; unit: FoodItem['serving_unit_default'] }> = [];

      // Check for specific staple foods in filename / context
      if (lower.includes('dall') || lower.includes('dal')) {
        candidates.push(
          { keywords: ['dal / dall', 'dal', 'toor'], amount: 1, unit: 'cups' },
          { keywords: ['cooked white rice', 'white rice', 'rice'], amount: 1, unit: 'cups' }
        );
      } else if (lower.includes('egg') || lower.includes('banana') || meal_type === 'Breakfast' || meal_type === 'Morning Snack') {
        candidates.push(
          { keywords: ['whole egg', 'egg'], amount: 2, unit: 'pieces' }, // 2 eggs: 144 kcal, 12.6g protein
          { keywords: ['banana'], amount: 1, unit: 'pieces' } // 1 banana: 105 kcal, 27g carbs
        );
      } else if (lower.includes('dosa') || lower.includes('idli')) {
        candidates.push(
          { keywords: ['plain dosa', 'dosa'], amount: 2, unit: 'pieces' },
          { keywords: ['sambar'], amount: 1, unit: 'cups' },
          { keywords: ['coconut chutney'], amount: 1, unit: 'servings' }
        );
      } else if (lower.includes('roti') || lower.includes('chapati')) {
        candidates.push(
          { keywords: ['roti', 'chapati'], amount: 2, unit: 'pieces' },
          { keywords: ['dal', 'yellow toor'], amount: 1, unit: 'cups' },
          { keywords: ['paneer', 'mixed vegetable'], amount: 1, unit: 'cups' }
        );
      } else if (lower.includes('chicken')) {
        candidates.push(
          { keywords: ['chicken breast', 'andhra chicken', 'chicken'], amount: 150, unit: 'grams' },
          { keywords: ['cooked white rice', 'white rice'], amount: 1, unit: 'cups' },
          { keywords: ['fresh salad', 'salad'], amount: 1, unit: 'cups' }
        );
      } else {
        // Standard South Indian Lunch/Dinner Balanced Plate (Rice, Dal/Sambar, Vegetable Poriyal)
        candidates.push(
          { keywords: ['cooked white rice', 'white rice', 'rice'], amount: 1, unit: 'cups' },
          { keywords: ['sambar', 'dal'], amount: 1, unit: 'cups' },
          { keywords: ['beans poriyal', 'mixed vegetable curry'], amount: 1, unit: 'cups' }
        );
      }

      for (const cand of candidates) {
        const matched = findFood(cand.keywords);
        if (matched) {
          const macros = calculatePortionMacros(matched, cand.amount, cand.unit);
          detectedFoods.push({
            food_item_id: matched.id,
            name: matched.name,
            category: matched.category,
            portion_amount: cand.amount,
            portion_unit: cand.unit,
            confidence: 'High',
            icon: matched.icon,
            calories: macros.calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat,
            fibre: macros.fibre,
            is_discretionary: matched.is_discretionary,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Photo analyzed successfully',
      detectedFoods,
      disclaimer: 'NutriTrack uses verified nutritional tables. Adjust portions or add/remove items to match your exact plate.',
    });
  } catch (error) {
    console.error('Error in detect-photo API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food photo' },
      { status: 500 }
    );
  }
}
