import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { FoodItem } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';

    const db = getDatabase();

    let sql = 'SELECT * FROM food_items WHERE 1=1';
    const params: (string | number)[] = [];

    if (query) {
      sql += ' AND name LIKE ?';
      params.push(`%${query}%`);
    }

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_discretionary ASC, name ASC LIMIT 60';

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    const foods: FoodItem[] = rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      category: r.category as FoodItem['category'],
      calories_per_100g: Number(r.calories_per_100g),
      protein_per_100g: Number(r.protein_per_100g),
      carbs_per_100g: Number(r.carbs_per_100g),
      fat_per_100g: Number(r.fat_per_100g),
      fibre_per_100g: Number(r.fibre_per_100g),
      serving_unit_default: r.serving_unit_default as FoodItem['serving_unit_default'],
      serving_weight_grams: Number(r.serving_weight_grams),
      is_discretionary: Boolean(r.is_discretionary),
      icon: (r.icon as string) || '🍽️',
    }));

    return NextResponse.json({ foods });
  } catch (error) {
    console.error('Error searching foods:', error);
    return NextResponse.json({ error: 'Failed to search food database' }, { status: 500 });
  }
}
