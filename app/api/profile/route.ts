import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { calculatePersonalizedTargets } from '@/lib/nutrition';
import { ActivityLevel, FitnessGoal, Gender, Profile } from '@/lib/types';

export async function GET() {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ profile: auth.profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      full_name,
      age,
      gender,
      height_cm,
      weight_kg,
      activity_level,
      fitness_goal,
      daily_step_goal,
      // optional manual target overrides
      calorie_target,
      protein_target,
      carb_target,
      fat_target,
      fibre_target,
      water_target,
    } = body;

    if (!full_name || !age || !gender || !height_cm || !weight_kg || !activity_level || !fitness_goal) {
      return NextResponse.json(
        { error: 'Missing required profile fields.' },
        { status: 400 }
      );
    }

    // Calculate baseline personalized targets
    const computed = calculatePersonalizedTargets({
      age: Number(age),
      gender: gender as Gender,
      height_cm: Number(height_cm),
      weight_kg: Number(weight_kg),
      activity_level: activity_level as ActivityLevel,
      fitness_goal: fitness_goal as FitnessGoal,
      daily_step_goal: daily_step_goal ? Number(daily_step_goal) : 10000,
    });

    const finalCalorieTarget = calorie_target ? Number(calorie_target) : computed.calorieTarget;
    const finalProteinTarget = protein_target ? Number(protein_target) : computed.proteinTarget;
    const finalCarbTarget = carb_target ? Number(carb_target) : computed.carbTarget;
    const finalFatTarget = fat_target ? Number(fat_target) : computed.fatTarget;
    const finalFibreTarget = fibre_target ? Number(fibre_target) : computed.fibreTarget;
    const finalWaterTarget = water_target ? Number(water_target) : computed.waterTarget;
    const finalStepTarget = daily_step_goal ? Number(daily_step_goal) : computed.stepTarget;

    const db = getDatabase();
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(auth.user.id) as { id: string } | undefined;

    let profileId: string;
    if (existing) {
      profileId = existing.id;
      db.prepare(`
        UPDATE profiles SET
          full_name = ?,
          age = ?,
          gender = ?,
          height_cm = ?,
          weight_kg = ?,
          activity_level = ?,
          fitness_goal = ?,
          daily_step_goal = ?,
          calorie_target = ?,
          protein_target = ?,
          carb_target = ?,
          fat_target = ?,
          fibre_target = ?,
          water_target = ?,
          updated_at = ?
        WHERE user_id = ?
      `).run(
        full_name,
        Number(age),
        gender,
        Number(height_cm),
        Number(weight_kg),
        activity_level,
        fitness_goal,
        finalStepTarget,
        finalCalorieTarget,
        finalProteinTarget,
        finalCarbTarget,
        finalFatTarget,
        finalFibreTarget,
        finalWaterTarget,
        now,
        auth.user.id
      );
    } else {
      profileId = 'prof_' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO profiles (
          id, user_id, full_name, age, gender, height_cm, weight_kg,
          activity_level, fitness_goal, daily_step_goal,
          calorie_target, protein_target, carb_target, fat_target, fibre_target, water_target,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        profileId,
        auth.user.id,
        full_name,
        Number(age),
        gender,
        Number(height_cm),
        Number(weight_kg),
        activity_level,
        fitness_goal,
        finalStepTarget,
        finalCalorieTarget,
        finalProteinTarget,
        finalCarbTarget,
        finalFatTarget,
        finalFibreTarget,
        finalWaterTarget,
        now
      );
    }

    // Record weight log entry for today
    const existingWeight = db.prepare('SELECT id FROM weight_logs WHERE user_id = ? AND date = ?').get(auth.user.id, today);
    if (existingWeight) {
      db.prepare('UPDATE weight_logs SET weight_kg = ? WHERE user_id = ? AND date = ?').run(Number(weight_kg), auth.user.id, today);
    } else {
      db.prepare('INSERT INTO weight_logs (id, user_id, date, weight_kg, created_at) VALUES (?, ?, ?, ?, ?)').run(
        'wlog_' + crypto.randomUUID(),
        auth.user.id,
        today,
        Number(weight_kg),
        now
      );
    }

    const updatedProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(auth.user.id) as unknown as Profile;

    const response = NextResponse.json({
      success: true,
      message: 'Profile saved successfully.',
      profile: updatedProfile,
    });

    // Set 180-day persistent cookie so all Vercel serverless containers immediately have the updated profile
    const profileCookieVal = Buffer.from(JSON.stringify(updatedProfile)).toString('base64url');
    response.cookies.set({
      name: 'nutritrack_profile',
      value: profileCookieVal,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 180 * 24 * 60 * 60, // 180 days
    });

    return response;
  } catch (error) {
    console.error('Error saving profile:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}

export const PUT = POST;
