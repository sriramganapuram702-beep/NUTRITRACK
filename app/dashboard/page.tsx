'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flame,
  Plus,
  Droplets,
  Footprints,
  CheckCircle2,
  UtensilsCrossed,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Barcode,
  Award,
} from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { MacroCard } from '@/components/ui/MacroCard';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { FoodSearchModal } from '@/components/journal/FoodSearchModal';
import { PhotoFoodModal } from '@/components/journal/PhotoFoodModal';
import { BarcodeScannerModal } from '@/components/journal/BarcodeScannerModal';
import { MealPlannerModal } from '@/components/dashboard/MealPlannerModal';
import { ShareStreakModal } from '@/components/badges/ShareStreakModal';
import { DailyAuditModal } from '@/components/audit/DailyAuditModal';
import { DailyGoalBreakdown, DailyRemarks, FoodEntry, Profile, User, WaterEntry } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Dashboard Data
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    water: 0,
    steps: 0,
    foodCount: 0,
    discretionaryCount: 0,
  });
  const [targets, setTargets] = useState({
    calorieTarget: 2000,
    proteinTarget: 80,
    carbTarget: 250,
    fatTarget: 65,
    fibreTarget: 28,
    waterTarget: 3000,
    stepTarget: 10000,
  });
  const [breakdown, setBreakdown] = useState<DailyGoalBreakdown>({
    calories: { consumed: 0, target: 2000, pct: 0, score: 0 },
    protein: { consumed: 0, target: 80, pct: 0, score: 0 },
    fibre: { consumed: 0, target: 28, pct: 0, score: 0 },
    water: { consumed: 0, target: 3000, pct: 0, score: 0 },
    steps: { consumed: 0, target: 10000, pct: 0, score: 0 },
    consistency: { loggedMeals: 0, score: 0 },
    discretionaryPenalty: 0,
    overall: 0,
  });
  const [remarks, setRemarks] = useState<DailyRemarks>({
    disclaimer: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Modals
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [mealPlannerOpen, setMealPlannerOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [stepInput, setStepInput] = useState<number>(0);
  const [waterCustomInput, setWaterCustomInput] = useState<number>(250);

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (!meData.authenticated) {
        router.push('/');
        return;
      }
      if (!meData.profile) {
        router.push('/onboarding');
        return;
      }
      setUser(meData.user);
      setProfile(meData.profile);

      // 1. INSTANT PERSISTENCE: Read from phone storage first (never lost across cold starts)
      const localDay = clientStorage.getDayData(meData.user.id, selectedDate);
      if (localDay && (localDay.foodEntries.length > 0 || localDay.waterEntries.length > 0 || localDay.steps > 0)) {
        setFoodEntries(localDay.foodEntries);
        setWaterEntries(localDay.waterEntries);
        const cals = Math.round(localDay.foodEntries.reduce((s, f) => s + f.calories, 0));
        const prot = Number(localDay.foodEntries.reduce((s, f) => s + f.protein, 0).toFixed(1));
        const carbs = Number(localDay.foodEntries.reduce((s, f) => s + f.carbs, 0).toFixed(1));
        const fat = Number(localDay.foodEntries.reduce((s, f) => s + f.fat, 0).toFixed(1));
        const fibre = Number(localDay.foodEntries.reduce((s, f) => s + f.fibre, 0).toFixed(1));
        const water = localDay.waterEntries.reduce((s, w) => s + w.amount_ml, 0);

        setTotals((prev) => ({
          ...prev,
          calories: cals,
          protein: prot,
          carbs,
          fat,
          fibre,
          water,
          steps: localDay.steps,
          foodCount: localDay.foodEntries.length,
        }));
        setStepInput(localDay.steps || 0);
        setIsSubmitted(Boolean(localDay.isSubmitted));
      }

      // 2. Fetch cloud journal details for selected date
      const journalRes = await fetch(`/api/journal?date=${selectedDate}`);
      const journalData = await journalRes.json();
      if (journalData) {
        // Merge safely so local entries (e.g. 2 eggs + banana) are NEVER wiped
        const merged = clientStorage.mergeServerData(
          meData.user.id,
          selectedDate,
          journalData.foodEntries || [],
          journalData.waterEntries || [],
          journalData.totals?.steps || 0
        );

        setFoodEntries(merged.foodEntries);
        setWaterEntries(merged.waterEntries);
        setTargets(journalData.targets || targets);
        setBreakdown(journalData.breakdown || breakdown);
        setRemarks(journalData.remarks || remarks);
        setIsSubmitted(Boolean(journalData.log?.is_submitted || merged.isSubmitted));
        setStepInput(merged.steps);

        const finalCals = Math.round(merged.foodEntries.reduce((s, f) => s + f.calories, 0));
        const finalProt = Number(merged.foodEntries.reduce((s, f) => s + f.protein, 0).toFixed(1));
        const finalCarbs = Number(merged.foodEntries.reduce((s, f) => s + f.carbs, 0).toFixed(1));
        const finalFat = Number(merged.foodEntries.reduce((s, f) => s + f.fat, 0).toFixed(1));
        const finalFibre = Number(merged.foodEntries.reduce((s, f) => s + f.fibre, 0).toFixed(1));
        const finalWater = merged.waterEntries.reduce((s, w) => s + w.amount_ml, 0);

        setTotals({
          calories: finalCals,
          protein: finalProt,
          carbs: finalCarbs,
          fat: finalFat,
          fibre: finalFibre,
          water: finalWater,
          steps: merged.steps,
          foodCount: merged.foodEntries.length,
          discretionaryCount: merged.foodEntries.filter((f) => f.is_discretionary).length,
        });

        // Re-hydrate server if cold restart cleared it
        if (
          merged.foodEntries.length > (journalData.foodEntries?.length || 0) ||
          merged.waterEntries.length > (journalData.waterEntries?.length || 0)
        ) {
          fetch('/api/journal/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: selectedDate,
              foodEntries: merged.foodEntries,
              waterEntries: merged.waterEntries,
              steps: merged.steps,
              isSubmitted: merged.isSubmitted,
            }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [router, selectedDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fast water logger (GUARANTEED: NEVER WIPES FOOD ENTRIES)
  const handleQuickAddWater = async (amount: number) => {
    if (amount <= 0 || !user) return;

    // 1. Save locally FIRST so food entries are completely protected
    const now = new Date().toISOString();
    const entryId = 'wat_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const newEntry: WaterEntry = {
      id: entryId,
      daily_log_id: 'log_' + selectedDate,
      amount_ml: amount,
      logged_at: now,
    };

    clientStorage.saveWaterEntry(user.id, selectedDate, newEntry);
    setWaterEntries((prev) => [...prev, newEntry]);
    setTotals((prev) => ({ ...prev, water: prev.water + amount }));
    toast.success(`+${amount} ml water logged!`);
    setWaterModalOpen(false);

    try {
      await fetch('/api/journal/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, amount_ml: amount }),
      });
      fetchDashboard();
    } catch {
      // Already saved locally
    }
  };

  // Step updater
  const handleSaveSteps = async () => {
    if (!user) return;
    clientStorage.saveSteps(user.id, selectedDate, stepInput);
    setTotals((prev) => ({ ...prev, steps: stepInput }));
    toast.success(`Steps set to ${stepInput.toLocaleString()}`);
    setStepModalOpen(false);

    try {
      await fetch('/api/journal/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, steps: stepInput }),
      });
      fetchDashboard();
    } catch {
      // Saved locally
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Format today's date for display
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar
          title="Dashboard"
          subtitle={formattedDate}
          userEmail={user?.email}
        />

        <div className="max-w-7xl w-full mx-auto px-4 md:px-8 py-6 space-y-8">
          {/* Header Greeting Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formattedDate}
                </span>
                {isSubmitted && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Day Submitted & Audited
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Friend'} 👋
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Track your meals, hydration, and activity to achieve your personalized goals today.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setSearchModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Quick Add Food</span>
              </button>

              <button
                onClick={() => setPhotoModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition flex items-center gap-2"
              >
                <span>📸 Photo Entry</span>
              </button>

              <button
                onClick={() => setBarcodeModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-900"
              >
                <Barcode className="w-4 h-4" />
                <span>Barcode</span>
              </button>

              <button
                onClick={() => setMealPlannerOpen(true)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-900"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>🥗 AI Meal Plan</span>
              </button>

              <button
                onClick={() => setStreakModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition flex items-center gap-1.5 border border-amber-200 dark:border-amber-900"
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span>🏆 Streak</span>
              </button>

              <button
                onClick={() => setWaterModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition flex items-center gap-1.5 border border-blue-200 dark:border-blue-900"
              >
                <Droplets className="w-4 h-4" />
                <span>Water</span>
              </button>

              <button
                onClick={() => router.push('/steps')}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition flex items-center gap-1.5 border border-purple-200 dark:border-purple-900"
                title="Open Phone Motion Sensor Pedometer"
              >
                <Footprints className="w-4 h-4" />
                <span>🚶 Auto Steps</span>
              </button>

              <button
                onClick={() => setAuditModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 shadow-md transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitted ? 'View Food Audit' : 'Submit Day'}</span>
              </button>
            </div>
          </div>

          {/* Daily Goal Completion Card Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Daily Goal Completion
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {breakdown.overall}% Achieved
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Transparent goal metrics derived from today&apos;s calories, protein, fibre, hydration, and physical activity.
                </p>

                {/* Sub-metrics preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Protein</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{breakdown.protein.pct}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Fibre</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{breakdown.fibre.pct}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Water</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{breakdown.water.pct}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Steps</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{breakdown.steps.pct}%</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center">
                <CircularProgress
                  value={breakdown.overall}
                  size={140}
                  strokeWidth={11}
                  color="#10b981"
                >
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    {breakdown.overall}%
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Completed
                  </span>
                </CircularProgress>
              </div>
            </div>

            {/* Quick Today Summary Card */}
            <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-md flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                  Today&apos;s Intake Snapshot
                </span>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-sm">
                    <span className="text-slate-300">Meals Logged</span>
                    <span className="font-bold">{foodEntries.length} items</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-sm">
                    <span className="text-slate-300">Hydration Logged</span>
                    <span className="font-bold">{totals.water} ml</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-sm">
                    <span className="text-slate-300">Steps Recorded</span>
                    <span className="font-bold">{totals.steps.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Discretionary Foods</span>
                    <span className="font-bold text-amber-400">{totals.discretionaryCount} entries</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => router.push('/journal')}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <span>Open Food Journal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Main 7 Key Metric Cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Primary Nutrition & Activity Targets
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Calories */}
              <MacroCard
                title="Calories"
                consumed={totals.calories}
                target={targets.calorieTarget}
                unit="kcal"
                colorClass="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                barColor="bg-emerald-500"
                icon={<Flame className="w-5 h-5" />}
                onClick={() => setSearchModalOpen(true)}
              />

              {/* Protein */}
              <MacroCard
                title="Protein"
                consumed={totals.protein}
                target={targets.proteinTarget}
                unit="g"
                colorClass="bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400"
                barColor="bg-teal-500"
                icon={<span className="text-lg">🥩</span>}
                onClick={() => setSearchModalOpen(true)}
              />

              {/* Carbohydrates */}
              <MacroCard
                title="Carbohydrates"
                consumed={totals.carbs}
                target={targets.carbTarget}
                unit="g"
                colorClass="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                barColor="bg-amber-500"
                icon={<span className="text-lg">🍚</span>}
                onClick={() => setSearchModalOpen(true)}
              />

              {/* Fat */}
              <MacroCard
                title="Fat"
                consumed={totals.fat}
                target={targets.fatTarget}
                unit="g"
                colorClass="bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                barColor="bg-rose-500"
                icon={<span className="text-lg">🥑</span>}
                onClick={() => setSearchModalOpen(true)}
              />

              {/* Fibre */}
              <MacroCard
                title="Dietary Fibre"
                consumed={totals.fibre}
                target={targets.fibreTarget}
                unit="g"
                colorClass="bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400"
                barColor="bg-green-500"
                icon={<span className="text-lg">🥦</span>}
                onClick={() => setSearchModalOpen(true)}
              />

              {/* Water */}
              <MacroCard
                title="Hydration"
                consumed={totals.water}
                target={targets.waterTarget}
                unit="ml"
                colorClass="bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                barColor="bg-blue-500"
                icon={<Droplets className="w-5 h-5" />}
                onClick={() => setWaterModalOpen(true)}
              />

              {/* Steps */}
              <MacroCard
                title="Daily Steps"
                consumed={totals.steps}
                target={targets.stepTarget}
                unit="steps"
                colorClass="bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                barColor="bg-purple-500"
                icon={<Footprints className="w-5 h-5" />}
                onClick={() => setStepModalOpen(true)}
              />

              {/* Discretionary Foods */}
              <div
                onClick={() => router.push('/journal')}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                      <span className="text-lg">🍪</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Discretionary
                      </h3>
                      <p className="text-xs text-slate-400">Limit: ≤ 2 / day</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                    {totals.discretionaryCount}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {totals.discretionaryCount} entries
                </div>
                <p className="text-xs text-slate-500">
                  {totals.discretionaryCount > 2
                    ? 'Consider balancing with more whole foods'
                    : 'Within moderate guidelines'}
                </p>
              </div>
            </div>
          </div>

          {/* Today's Meals Section */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  Today&apos;s Meals
                </h2>
                <p className="text-xs text-slate-400">
                  {foodEntries.length} logged items across meals
                </p>
              </div>

              <button
                onClick={() => router.push('/journal')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Journal</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {foodEntries.length === 0 ? (
              /* Empty State per spec */
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">No meals added yet.</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Start tracking your nutrition today by typing food manually or uploading a food photo.
                </p>
                <button
                  onClick={() => setSearchModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                >
                  + Add Your First Meal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {foodEntries.slice(0, 6).map((food) => (
                  <div
                    key={food.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{food.icon || '🍽️'}</span>
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[140px]">
                          {food.custom_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {food.portion_amount} {food.portion_unit} • {food.meal_type}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {food.calories} kcal
                      </div>
                      <div className="text-[10px] text-slate-400">{food.protein}g P</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End of Page Disclaimer */}
          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav onQuickAddFood={() => setSearchModalOpen(true)} />

      {/* --- MODALS --- */}
      <FoodSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        date={selectedDate}
        userId={user?.id}
        onSuccess={fetchDashboard}
      />

      <PhotoFoodModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        date={selectedDate}
        userId={user?.id}
        onSuccess={fetchDashboard}
      />

      <BarcodeScannerModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        date={selectedDate}
        userId={user?.id}
        onSuccess={fetchDashboard}
      />

      <MealPlannerModal
        isOpen={mealPlannerOpen}
        onClose={() => setMealPlannerOpen(false)}
        date={selectedDate}
        userId={user?.id}
      />

      <ShareStreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
      />

      <DailyAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        date={selectedDate}
        userId={user?.id}
        isSubmitted={isSubmitted}
        totals={totals}
        targets={targets}
        breakdown={breakdown}
        remarks={remarks}
        onRefresh={fetchDashboard}
      />

      {/* Water Quick Add Modal */}
      {waterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-500" />
                Add Water
              </h3>
              <button
                onClick={() => setWaterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Current: {totals.water} / {targets.waterTarget} ml
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[250, 500, 750].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleQuickAddWater(amt)}
                  className="py-3 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs hover:bg-blue-100 transition"
                >
                  +{amt} ml
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                Custom Amount (ml)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="50"
                  min="50"
                  value={waterCustomInput}
                  onChange={(e) => setWaterCustomInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold"
                />
                <button
                  onClick={() => handleQuickAddWater(waterCustomInput)}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Update Modal */}
      {stepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Footprints className="w-5 h-5 text-purple-500" />
                Update Daily Steps
              </h3>
              <button
                onClick={() => setStepModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter your current valid step count for today (replaces current total, target: {targets.stepTarget.toLocaleString()}).
            </p>

            <div>
              <input
                type="number"
                min="0"
                step="100"
                value={stepInput}
                onChange={(e) => setStepInput(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-lg font-bold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setStepModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSteps}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
              >
                Save Steps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
