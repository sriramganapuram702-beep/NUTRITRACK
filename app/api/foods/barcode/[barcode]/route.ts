import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ barcode: string }> }
) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode } = await params;
    const cleanBarcode = (barcode || '').trim().replace(/[^0-9]/g, '');

    if (!cleanBarcode) {
      return NextResponse.json(
        { error: 'Valid numeric barcode is required.' },
        { status: 400 }
      );
    }

    // Query OpenFoodFacts API (Free open global database)
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`,
      {
        headers: {
          'User-Agent': 'NutriTrack - Android-Web - Version 1.0 (sriramganapuram702@gmail.com)',
        },
      }
    );

    if (!offRes.ok) {
      return NextResponse.json(
        { error: 'Product not found in global database. You can add it manually.' },
        { status: 404 }
      );
    }

    const data = await offRes.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { error: 'Barcode not found in database. Try manual entry.' },
        { status: 404 }
      );
    }

    const p = data.product;
    const n = p.nutriments || {};

    const name = p.product_name || p.product_name_en || p.generic_name || 'Packaged Food';
    const brand = p.brands || '';
    const caloriesPer100g = Math.round(Number(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0));
    const proteinPer100g = Number(Number(n['proteins_100g'] ?? n['proteins'] ?? 0).toFixed(1));
    const carbsPer100g = Number(Number(n['carbohydrates_100g'] ?? n['carbohydrates'] ?? 0).toFixed(1));
    const fatPer100g = Number(Number(n['fat_100g'] ?? n['fat'] ?? 0).toFixed(1));
    const fibrePer100g = Number(Number(n['fiber_100g'] ?? n['fiber'] ?? 0).toFixed(1));
    const servingWeightG = Math.round(Number(p.serving_quantity) || 100);
    const imageUrl = p.image_front_small_url || p.image_url || '';

    // Classify category
    let category = 'Carbohydrates';
    if (proteinPer100g >= 12) category = 'Protein';
    else if (fatPer100g >= 20 || caloriesPer100g >= 400) category = 'Discretionary';

    return NextResponse.json({
      success: true,
      barcode: cleanBarcode,
      product: {
        name: brand ? `${brand} ${name}` : name,
        category,
        brand,
        calories_per_100g: caloriesPer100g,
        protein_per_100g: proteinPer100g,
        carbs_per_100g: carbsPer100g,
        fat_per_100g: fatPer100g,
        fibre_per_100g: fibrePer100g,
        serving_weight_grams: servingWeightG,
        serving_unit_default: 'servings',
        icon: '📦',
        imageUrl,
      },
    });
  } catch (error) {
    console.error('Error querying barcode API:', error);
    return NextResponse.json(
      { error: 'Failed to look up barcode. Please try again.' },
      { status: 500 }
    );
  }
}
