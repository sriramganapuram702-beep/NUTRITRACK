'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCog,
  Save,
  Moon,
  Sun,
  LogOut,
  Target,
  Shield,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { ActivityLevel, FitnessGoal, Gender, Profile, User } from '@/lib/types';
import { calculatePersonalizedTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState<Gender>('Male');
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(72);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('Moderately Active');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('Maintain Weight');
  const [dailyStepGoal, setDailyStepGoal] = useState<number>(10000);

  // Manual target overrides
  const [calorieTarget, setCalorieTarget] = useState<number>(2400);
  const [proteinTarget, setProteinTarget] = useState<number>(90);
  const [waterTarget, setWaterTarget] = useState<number>(3000);
  const [carbTarget, setCarbTarget] = useState<number>(300);
  const [fatTarget, setFatTarget] = useState<number>(70);
  const [fibreTarget, setFibreTarget] = useState<number>(30);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/');
          return;
        }
        setUser(data.user);
        if (data.profile) {
          const p: Profile = data.profile;
          setProfile(p);
          setFullName(p.full_name);
          setAge(p.age);
          setGender(p.gender);
          setHeightCm(p.height_cm);
          setWeightKg(p.weight_kg);
          setActivityLevel(p.activity_level);
          setFitnessGoal(p.fitness_goal);
          setDailyStepGoal(p.daily_step_goal);

          setCalorieTarget(p.calorie_target);
          setProteinTarget(p.protein_target);
          setWaterTarget(p.water_target);
          setCarbTarget(p.carb_target);
          setFatTarget(p.fat_target);
          setFibreTarget(p.fibre_target);
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleRecalculateFormulas = () => {
    const computed = calculatePersonalizedTargets({
      age: Number(age) || 28,
      gender,
      height_cm: Number(heightCm) || 175,
      weight_kg: Number(weightKg) || 72,
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
      daily_step_goal: Number(dailyStepGoal) || 10000,
    });

    setCalorieTarget(computed.calorieTarget);
    setProteinTarget(computed.proteinTarget);
    setCarbTarget(computed.carbTarget);
    setFatTarget(computed.fatTarget);
    setFibreTarget(computed.fibreTarget);
    setWaterTarget(computed.waterTarget);
    setDailyStepGoal(computed.stepTarget);

    toast.info('Targets recalculated from Mifflin-St Jeor formulas. Save to apply.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          age: Number(age),
          gender,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity_level: activityLevel,
          fitness_goal: fitnessGoal,
          daily_step_goal: Number(dailyStepGoal),
          calorie_target: Number(calorieTarget),
          protein_target: Number(proteinTarget),
          carb_target: Number(carbTarget),
          fat_target: Number(fatTarget),
          fibre_target: Number(fibreTarget),
          water_target: Number(waterTarget),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      toast.success('Profile and daily targets updated successfully!');
      setProfile(data.profile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully.');
      router.push('/');
    } catch {
      toast.error('Logout error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title="Profile & Settings" subtitle="Personal attributes and custom nutrition goals" userEmail={user?.email} />

        <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-6 space-y-8">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Personal Details Card */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-emerald-600" />
                  Personal Information
                </h2>
                <span className="text-xs text-slate-400">Account: {user?.email}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Age (years)
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    required
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    min="80"
                    max="250"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Current Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="350"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Activity Level
                  </label>
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  >
                    <option value="Sedentary">Sedentary (desk job, little exercise)</option>
                    <option value="Lightly Active">Lightly Active (1-3 days exercise/wk)</option>
                    <option value="Moderately Active">Moderately Active (3-5 days exercise/wk)</option>
                    <option value="Very Active">Very Active (6-7 days heavy training)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Fitness Goal
                  </label>
                  <select
                    value={fitnessGoal}
                    onChange={(e) => setFitnessGoal(e.target.value as FitnessGoal)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  >
                    <option value="Maintain Weight">Maintain Weight</option>
                    <option value="Gain Weight / Muscle">Gain Weight / Muscle</option>
                    <option value="Lose Weight">Lose Weight</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                    Daily Step Goal
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    max="50000"
                    value={dailyStepGoal}
                    onChange={(e) => setDailyStepGoal(parseInt(e.target.value) || 10000)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Daily Target Adjustments Card */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    Personalized Daily Targets
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fine-tune targets manually or recalculate using science-backed formulas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRecalculateFormulas}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recalculate Formulas
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={calorieTarget}
                    onChange={(e) => setCalorieTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={proteinTarget}
                    onChange={(e) => setProteinTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Carbohydrates (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={carbTarget}
                    onChange={(e) => setCarbTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={fatTarget}
                    onChange={(e) => setFatTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Dietary Fibre (g)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={fibreTarget}
                    onChange={(e) => setFibreTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Water (ml)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={waterTarget}
                    onChange={(e) => setWaterTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Note: Changes to your targets only apply to current and future days. Past submitted daily reports retain their historical targets.
              </p>
            </div>

            {/* App Preferences & Theme */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance & Theme</h2>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Dark Mode</div>
                    <div className="text-xs text-slate-400">Switch between dark and light themes</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            </div>

            {/* Save Buttons & Logout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
