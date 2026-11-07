import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { FoodItem } from '@/lib/types';

function normalizeFoodQuery(q: string): string[] {
  const clean = q.toLowerCase().trim();
  const variants = new Set<string>([clean]);

  if (clean.includes('dall')) variants.add(clean.replace(/dall/g, 'dal'));
  if (clean.includes('dal')) variants.add(clean.replace(/dal/g, 'dall'));
  if (clean.endsWith('s') && clean.length > 3) variants.add(clean.slice(0, -1)); // eggs -> egg, rotis -> roti
  if (clean.includes('egg')) variants.add('egg');
  if (clean.includes('banana')) variants.add('banana');
  if (clean.includes('rice')) variants.add('rice');
  if (clean.includes('roti') || clean.includes('chapati')) variants.add('roti');
  if (clean.includes('chicken')) variants.add('chicken');

  return Array.from(variants);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';

    const db = getDatabase();

    let sql = 'SELECT * FROM food_items WHERE 1=1';
    const params: (string | number)[] = [];

    if (query) {
      const variants = normalizeFoodQuery(query);
      const orClauses = variants.map(() => 'LOWER(name) LIKE LOWER(?)').join(' OR ');
      sql += ` AND (${orClauses})`;
      variants.forEach((v) => params.push(`%${v}%`));
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
