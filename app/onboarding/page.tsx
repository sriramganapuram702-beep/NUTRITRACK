'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Sparkles, ArrowRight, UserCheck, ShieldCheck, Check } from 'lucide-react';
import { ActivityLevel, FitnessGoal, Gender } from '@/lib/types';
import { calculatePersonalizedTargets } from '@/lib/nutrition';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState<Gender>('Male');
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(72);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('Moderately Active');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('Maintain Weight');
  const [dailyStepGoal, setDailyStepGoal] = useState<number>(10000);

  // Check auth
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/');
        } else if (data.profile) {
          // Profile already exists, redirect to dashboard
          router.push('/dashboard');
        }
      })
      .catch(() => router.push('/'));
  }, [router]);

  // Live Mifflin-St Jeor targets calculation
  const calculatedTargets = useMemo(() => {
    return calculatePersonalizedTargets({
      age: Number(age) || 25,
      gender,
      height_cm: Number(heightCm) || 170,
      weight_kg: Number(weightKg) || 70,
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
      daily_step_goal: Number(dailyStepGoal) || 10000,
    });
  }, [age, gender, heightCm, weightKg, activityLevel, fitnessGoal, dailyStepGoal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }

    setSubmitting(true);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');

      toast.success('Profile created! Welcome to NutriTrack.');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving profile';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Step 1 of 1 • Profile Setup
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome to NutriTrack
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Tell us about your physical profile and fitness goals to generate your personalized estimated daily nutrition targets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 space-y-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Your Personal Details
            </h2>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Age & Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Age (years)
                </label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  required
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="80"
                  max="250"
                  required
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="350"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Activity Level
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'] as ActivityLevel[]).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setActivityLevel(lvl)}
                      className={`p-3 rounded-2xl border text-left font-medium transition ${
                        activityLevel === lvl
                          ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold">{lvl}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {lvl === 'Sedentary' && 'Desk job, little movement'}
                        {lvl === 'Lightly Active' && '1-3 days exercise/week'}
                        {lvl === 'Moderately Active' && '3-5 days exercise/week'}
                        {lvl === 'Very Active' && '6-7 days heavy training'}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Fitness Goal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Fitness Goal
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['Maintain Weight', 'Gain Weight / Muscle', 'Lose Weight'] as FitnessGoal[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFitnessGoal(g)}
                    className={`p-3 rounded-2xl border text-center font-bold transition ${
                      fitnessGoal === g
                        ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Step Goal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Daily Step Target
              </label>
              <input
                type="number"
                step="500"
                min="1000"
                max="50000"
                value={dailyStepGoal}
                onChange={(e) => setDailyStepGoal(parseInt(e.target.value) || 10000)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Right Column: Live Target Calculations Preview */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/5 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 p-6 md:p-8 rounded-3xl border border-emerald-500/20 dark:border-slate-800 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Calculated For You
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  Estimated Daily Targets
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Derived from Mifflin-St Jeor formula (BMR: {calculatedTargets.bmr} kcal, TDEE: {calculatedTargets.tdee} kcal).
                </p>
              </div>

              {/* Targets Summary Grid */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Calories</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {calculatedTargets.calorieTarget} kcal / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Protein</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    {calculatedTargets.proteinTarget} g / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Carbohydrates</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {calculatedTargets.carbTarget} g / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fat</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {calculatedTargets.fatTarget} g / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dietary Fibre</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {calculatedTargets.fibreTarget} g / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hydration (Water)</span>
                  <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                    {calculatedTargets.waterTarget} ml / day
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Daily Steps</span>
                  <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                    {calculatedTargets.stepTarget.toLocaleString()} steps
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Confirm & Go To Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <DisclaimerBanner />
          </div>
        </form>
      </div>
    </div>
  );
}
