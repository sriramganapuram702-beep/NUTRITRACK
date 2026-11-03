import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculatePortionMacros } from '@/lib/nutrition';
import { FoodItem, MealType, PortionUnit } from '@/lib/types';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { portion_amount, portion_unit, meal_type } = body;

    const db = getDatabase();

    // Verify ownership through daily_logs
    const entry = db
      .prepare(`
        SELECT fe.*, dl.user_id, dl.is_submitted
        FROM food_entries fe
        JOIN daily_logs dl ON fe.daily_log_id = dl.id
        WHERE fe.id = ?
      `)
      .get(id) as (Record<string, any> & { user_id: string; food_item_id: string; daily_log_id: string }) | undefined;

    if (!entry || entry.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Food entry not found' }, { status: 404 });
    }

    let calories = Number(entry.calories);
    let protein = Number(entry.protein);
    let carbs = Number(entry.carbs);
    let fat = Number(entry.fat);
    let fibre = Number(entry.fibre);
    let computedWeightG = Number(entry.computed_weight_g);

    const finalAmount = portion_amount !== undefined ? Number(portion_amount) : Number(entry.portion_amount);
    const finalUnit = (portion_unit as PortionUnit) || (entry.portion_unit as PortionUnit);
    const finalMealType = (meal_type as MealType) || (entry.meal_type as MealType);

    if (entry.food_item_id) {
      const food = db
        .prepare('SELECT * FROM food_items WHERE id = ?')
        .get(entry.food_item_id) as FoodItem | undefined;

      if (food) {
        const macros = calculatePortionMacros(food, finalAmount, finalUnit);
        calories = macros.calories;
        protein = macros.protein;
        carbs = macros.carbs;
        fat = macros.fat;
        fibre = macros.fibre;
        computedWeightG = macros.computedWeightG;
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE food_entries SET
        meal_type = ?,
        portion_amount = ?,
        portion_unit = ?,
        computed_weight_g = ?,
        calories = ?,
        protein = ?,
        carbs = ?,
        fat = ?,
        fibre = ?
      WHERE id = ?
    `).run(
      finalMealType,
      finalAmount,
      finalUnit,
      computedWeightG,
      calories,
      protein,
      carbs,
      fat,
      fibre,
      id
    );

    db.prepare('UPDATE daily_logs SET updated_at = ? WHERE id = ?').run(now, entry.daily_log_id);

    const updated = db.prepare('SELECT * FROM food_entries WHERE id = ?').get(id);

    return NextResponse.json({
      success: true,
      message: 'Food entry updated.',
      entry: updated,
    });
  } catch (error) {
    console.error('Error updating food entry:', error);
    return NextResponse.json({ error: 'Failed to update food entry' }, { status: 500 });
  }
}

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
        SELECT fe.id, dl.user_id, fe.daily_log_id
        FROM food_entries fe
        JOIN daily_logs dl ON fe.daily_log_id = dl.id
        WHERE fe.id = ?
      `)
      .get(id) as { id: string; user_id: string; daily_log_id: string } | undefined;

    if (!entry || entry.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Food entry not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM food_entries WHERE id = ?').run(id);
    db.prepare('UPDATE daily_logs SET updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      entry.daily_log_id
    );

    return NextResponse.json({ success: true, message: 'Food entry deleted.' });
  } catch (error) {
    console.error('Error deleting food entry:', error);
    return NextResponse.json({ error: 'Failed to delete food entry' }, { status: 500 });
  }
}
