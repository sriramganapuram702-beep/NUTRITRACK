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
  Scale,
  Dumbbell,
  Flame,
  Check,
  Activity,
  Heart,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { ActivityLevel, FitnessGoal, Gender, Profile, User } from '@/lib/types';
import { calculatePersonalizedTargets } from '@/lib/nutrition';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

const FITNESS_GOALS: { id: FitnessGoal; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; badge: string }[] = [
  {
    id: 'Maintain Weight',
    title: 'Maintain Weight',
    desc: 'Keep current weight, boost metabolic vitality & stay energized',
    icon: Scale,
    badge: 'Balanced Targets',
  },
  {
    id: 'Gain Weight / Muscle',
    title: 'Gain Weight / Muscle',
    desc: 'Build lean muscle mass with high protein and caloric surplus',
    icon: Dumbbell,
    badge: 'Caloric Surplus',
  },
  {
    id: 'Lose Weight',
    title: 'Lose Weight',
    desc: 'Burn fat steadily while preserving lean muscle with smart deficit',
    icon: Flame,
    badge: 'Caloric Deficit',
  },
];

const ACTIVITY_LEVELS: { id: ActivityLevel; title: string; desc: string; freq: string }[] = [
  {
    id: 'Sedentary',
    title: 'Sedentary',
    desc: 'Desk job, driving, minimal exercise',
    freq: 'Little to no exercise',
  },
  {
    id: 'Lightly Active',
    title: 'Lightly Active',
    desc: 'Occasional walks, light physical activity',
    freq: '1–3 sessions / week',
  },
  {
    id: 'Moderately Active',
    title: 'Moderately Active',
    desc: 'Regular gym, running, swimming, or sports',
    freq: '3–5 sessions / week',
  },
  {
    id: 'Very Active',
    title: 'Very Active',
    desc: 'Intense daily training or physical job',
    freq: '6–7 sessions / week',
  },
];

const GENDERS: { id: Gender; label: string; icon: string }[] = [
  { id: 'Male', label: 'Male', icon: '👨' },
  { id: 'Female', label: 'Female', icon: '👩' },
  { id: 'Other', label: 'Other', icon: '👤' },
];

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

  // Apply profile state to form fields
  const applyProfileToForm = (p: Profile) => {
    setProfile(p);
    if (p.full_name) setFullName(p.full_name);
    if (p.age) setAge(p.age);
    if (p.gender) setGender(p.gender);
    if (p.height_cm) setHeightCm(p.height_cm);
    if (p.weight_kg) setWeightKg(p.weight_kg);
    if (p.activity_level) setActivityLevel(p.activity_level);
    if (p.fitness_goal) setFitnessGoal(p.fitness_goal);
    if (p.daily_step_goal) setDailyStepGoal(p.daily_step_goal);

    if (p.calorie_target) setCalorieTarget(p.calorie_target);
    if (p.protein_target) setProteinTarget(p.protein_target);
    if (p.water_target) setWaterTarget(p.water_target);
    if (p.carb_target) setCarbTarget(p.carb_target);
    if (p.fat_target) setFatTarget(p.fat_target);
    if (p.fibre_target) setFibreTarget(p.fibre_target);
  };

  useEffect(() => {
    // 1. FAST INITIAL RENDER: Immediately load cached profile from device storage
    const cachedProfile = clientStorage.getProfile();
    if (cachedProfile) {
      applyProfileToForm(cachedProfile);
      setLoading(false);
    }

    // 2. Fetch authenticated user & server state
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/');
          return;
        }
        setUser(data.user);

        // Check if device storage has a newer profile than the server's ephemeral DB
        const localP = clientStorage.getProfile(data.user.id) || clientStorage.getProfile();
        let effectiveProfile: Profile | null = null;

        if (localP && data.profile) {
          const localTime = new Date(localP.updated_at || localP.created_at || 0).getTime();
          const serverTime = new Date(data.profile.updated_at || data.profile.created_at || 0).getTime();

          if (localTime > serverTime) {
            // Local client profile is newer (user made recent changes that were saved locally)
            effectiveProfile = localP;
            // Silently sync server so serverless DB has the latest updates
            fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localP),
            }).catch(() => {});
          } else {
            effectiveProfile = data.profile;
            clientStorage.saveProfile(data.user.id, data.profile);
          }
        } else if (localP) {
          effectiveProfile = localP;
          fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localP),
          }).catch(() => {});
        } else if (data.profile) {
          effectiveProfile = data.profile;
          clientStorage.saveProfile(data.user.id, data.profile);
        }

        if (effectiveProfile) {
          applyProfileToForm(effectiveProfile);
        }
      })
      .catch(() => {
        if (!cachedProfile) router.push('/');
      })
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

    toast.info('Targets recalculated from Mifflin-St Jeor formulas. Click "Save Changes" to apply.');
  };

  const handleSelectGoal = (goal: FitnessGoal) => {
    setFitnessGoal(goal);
    // Auto calculate targets for the new fitness goal
    const computed = calculatePersonalizedTargets({
      age: Number(age) || 28,
      gender,
      height_cm: Number(heightCm) || 175,
      weight_kg: Number(weightKg) || 72,
      activity_level: activityLevel,
      fitness_goal: goal,
      daily_step_goal: Number(dailyStepGoal) || 10000,
    });
    setCalorieTarget(computed.calorieTarget);
    setProteinTarget(computed.proteinTarget);
    setCarbTarget(computed.carbTarget);
    setFatTarget(computed.fatTarget);
    setFibreTarget(computed.fibreTarget);
    setWaterTarget(computed.waterTarget);
    toast.success(`Goal set to: ${goal}! Daily target adjusted to ${computed.calorieTarget} kcal.`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const nowIso = new Date().toISOString();
    const updatedProfile: Profile = {
      id: profile?.id || `prof_${Date.now()}`,
      user_id: user?.id || profile?.user_id || 'usr_default',
      full_name: fullName.trim() || profile?.full_name || 'User',
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
      created_at: profile?.created_at || nowIso,
      updated_at: nowIso,
    };

    // 1. INSTANT LOCAL CACHING: Save immediately to phone storage so it NEVER reverts back
    clientStorage.saveProfile(user?.id || 'usr_default', updatedProfile);
    setProfile(updatedProfile);

    try {
      // 2. Server persistence & 180-day cookie synchronization
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      if (data.profile) {
        clientStorage.saveProfile(user?.id || data.profile.user_id, data.profile);
        setProfile(data.profile);
      }

      toast.success('Profile and nutrition targets saved permanently!');
    } catch (err: unknown) {
      // Still preserved locally!
      console.warn('Server sync warning:', err);
      toast.success('Profile saved locally on your device!');
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
        <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar
          title="Profile & Settings"
          subtitle="Customize your fitness goals, body attributes, and nutrition targets"
          userEmail={user?.email}
        />

        <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-6 space-y-8">
          <form onSubmit={handleSave} className="space-y-6">

            {/* SECTION 1: FITNESS GOAL (With tactile touch gradients) */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Fitness Goal</h2>
                    <p className="text-xs text-slate-400">Choose your main body composition objective</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Active: {fitnessGoal}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {FITNESS_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = fitnessGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => handleSelectGoal(goal.id)}
                      className={`relative p-5 rounded-2xl text-left border cursor-pointer select-none transition-all duration-200 ${
                        isSelected
                          ? 'gradient-touch-active'
                          : 'gradient-touch-option border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:border-teal-500/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white text-teal-700 flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className={`font-bold text-sm tracking-tight ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {goal.title}
                      </div>

                      <div className={`text-xs mt-1 leading-relaxed ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {goal.desc}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-white/10 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className={`font-semibold ${isSelected ? 'text-white/90' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {goal.badge}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: PERSONAL ATTRIBUTES & BODY STATS */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <UserCog className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Personal Information</h2>
                    <p className="text-xs text-slate-400">Account: {user?.email || 'Active User'}</p>
                  </div>
                </div>
              </div>

              {/* Full Name & Age */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    required
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden transition"
                  />
                </div>
              </div>

              {/* Gender Touch Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {GENDERS.map((g) => {
                    const isSelected = gender === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGender(g.id)}
                        className={`p-3.5 rounded-xl border text-center font-bold text-sm cursor-pointer select-none transition-all duration-200 flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'gradient-touch-active'
                            : 'gradient-touch-option border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-teal-500/40'
                        }`}
                      >
                        <span className="text-base">{g.icon}</span>
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Height, Weight, and Daily Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Daily Step Goal
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    max="50000"
                    value={dailyStepGoal}
                    onChange={(e) => setDailyStepGoal(parseInt(e.target.value) || 10000)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-hidden transition"
                  />
                </div>
              </div>

              {/* Activity Level Touch Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Activity Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACTIVITY_LEVELS.map((lvl) => {
                    const isSelected = activityLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setActivityLevel(lvl.id)}
                        className={`p-4 rounded-2xl border text-left cursor-pointer select-none transition-all duration-200 ${
                          isSelected
                            ? 'gradient-touch-active'
                            : 'gradient-touch-option border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-teal-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {lvl.title}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {lvl.freq}
                          </span>
                        </div>
                        <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                          {lvl.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 3: PERSONALIZED DAILY TARGETS (Manual or Scientific) */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Nutrition & Macro Targets</h2>
                    <p className="text-xs text-slate-400">Scientific Mifflin-St Jeor targets customized to your stats</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRecalculateFormulas}
                  className="px-4 py-2 rounded-xl border border-teal-500/30 hover:border-teal-500/60 bg-teal-500/10 hover:bg-teal-500/20 text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Recalculate Formulas
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={calorieTarget}
                    onChange={(e) => setCalorieTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Daily energy limit</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={proteinTarget}
                    onChange={(e) => setProteinTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Lean mass synthesis</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Carbohydrates (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={carbTarget}
                    onChange={(e) => setCarbTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Daily active energy</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={fatTarget}
                    onChange={(e) => setFatTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Hormonal health</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Dietary Fibre (g)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={fibreTarget}
                    onChange={(e) => setFibreTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Gut microbiome target</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Water (ml)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={waterTarget}
                    onChange={(e) => setWaterTarget(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white text-base focus:border-teal-500 outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Hydration baseline</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-500/5 border border-teal-500/15 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> Changes to your fitness goal and nutrition targets apply instantly to today and future logs. Past historical submissions in your calendar remain preserved.
                </span>
              </div>
            </div>

            {/* SECTION 4: THEME & DISPLAY */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Theme & Display</h2>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <Moon className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Sun className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </div>
                    <div className="text-xs text-slate-400">Switch color theme for eye comfort</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </button>
              </div>
            </div>

            {/* SECTION 5: ACTION BUTTONS (Save & Logout) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl btn-gradient-premium font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Changes...' : 'Save Changes'}</span>
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
