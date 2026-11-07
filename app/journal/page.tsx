'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UtensilsCrossed,
  Plus,
  Camera,
  Barcode,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  CheckCircle2,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { FoodSearchModal } from '@/components/journal/FoodSearchModal';
import { PhotoFoodModal } from '@/components/journal/PhotoFoodModal';
import { BarcodeScannerModal } from '@/components/journal/BarcodeScannerModal';
import { DailyAuditModal } from '@/components/audit/DailyAuditModal';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { DailyGoalBreakdown, DailyRemarks, FoodEntry, MealType, User } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

const MEAL_SECTIONS: { type: MealType; icon: string; label: string; timeHint: string }[] = [
  { type: 'Breakfast', icon: '🍳', label: 'Breakfast', timeHint: 'Morning • 7:00 AM - 10:00 AM' },
  { type: 'Morning Snack', icon: '🍎', label: 'Morning Snack', timeHint: 'Mid-Morning • 10:30 AM - 12:00 PM' },
  { type: 'Lunch', icon: '🥗', label: 'Lunch', timeHint: 'Afternoon • 12:30 PM - 2:30 PM' },
  { type: 'Evening Snack', icon: '🥜', label: 'Evening Snack', timeHint: 'Late Afternoon • 4:00 PM - 6:00 PM' },
  { type: 'Dinner', icon: '🍲', label: 'Dinner', timeHint: 'Evening • 7:00 PM - 9:30 PM' },
  { type: 'Other', icon: '🍵', label: 'Other / Late Night', timeHint: 'Anytime' },
];

function JournalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(() => {
    return searchParams.get('date') || new Date().toISOString().split('T')[0];
  });

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Totals & targets
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

  const [remarks, setRemarks] = useState<DailyRemarks>({ disclaimer: '' });

  // Modals state
  const [activeMealForAdd, setActiveMealForAdd] = useState<MealType>('Breakfast');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // View mode: 'by-meal' or 'timeline'
  const [viewMode, setViewMode] = useState<'by-meal' | 'timeline'>('by-meal');

  const fetchJournal = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/');
        return;
      }
      setUser(authData.user);

      // 1. INSTANT PERSISTENCE: Load from phone storage first (0ms, survives serverless recycles)
      const localDay = clientStorage.getDayData(authData.user.id, date);
      if (localDay && localDay.foodEntries && localDay.foodEntries.length > 0) {
        setFoodEntries(localDay.foodEntries);
        const cals = Math.round(localDay.foodEntries.reduce((s, f) => s + f.calories, 0));
        const prot = Number(localDay.foodEntries.reduce((s, f) => s + f.protein, 0).toFixed(1));
        const carbs = Number(localDay.foodEntries.reduce((s, f) => s + f.carbs, 0).toFixed(1));
        const fat = Number(localDay.foodEntries.reduce((s, f) => s + f.fat, 0).toFixed(1));
        const fibre = Number(localDay.foodEntries.reduce((s, f) => s + f.fibre, 0).toFixed(1));
        setTotals((prev) => ({
          ...prev,
          calories: cals,
          protein: prot,
          carbs,
          fat,
          fibre,
          foodCount: localDay.foodEntries.length,
          water: localDay.waterEntries?.reduce((s, w) => s + w.amount_ml, 0) || prev.water,
          steps: localDay.steps || prev.steps,
        }));
        setIsSubmitted(Boolean(localDay.isSubmitted));
      }

      // 2. Fetch server journal data
      const res = await fetch(`/api/journal?date=${date}`);
      const data = await res.json();
      if (data) {
        // Merge server and local storage safely (guaranteeing local foods are NEVER wiped)
        const merged = clientStorage.mergeServerData(
          authData.user.id,
          date,
          data.foodEntries || [],
          data.waterEntries || [],
          data.totals?.steps || 0
        );

        setFoodEntries(merged.foodEntries);
        setTargets(data.targets || targets);
        setBreakdown(data.breakdown || breakdown);
        setRemarks(data.remarks || remarks);
        setIsSubmitted(Boolean(data.log?.is_submitted || merged.isSubmitted));

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

        // If local had foods/water that the server was missing (e.g. serverless restart), re-hydrate the server
        if (
          merged.foodEntries.length > (data.foodEntries?.length || 0) ||
          merged.waterEntries.length > (data.waterEntries?.length || 0)
        ) {
          fetch('/api/journal/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date,
              foodEntries: merged.foodEntries,
              waterEntries: merged.waterEntries,
              steps: merged.steps,
              isSubmitted: merged.isSubmitted,
            }),
          }).catch((err) => console.warn('Background sync warning:', err));
        }
      }
    } catch (err) {
      console.error('Failed to load journal:', err);
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setSearchModalOpen(true);
    }
  }, [searchParams]);

  // Date changers
  const shiftDate = (days: number) => {
    const current = new Date(date + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setDate(current.toISOString().split('T')[0]);
  };

  const handleDeleteEntry = async (id: string) => {
    if (isSubmitted) {
      toast.info('This day has been submitted. Click "Edit Day" in the Food Audit to unlock entries.');
      return;
    }

    if (user) {
      // 1. Delete from client storage immediately
      clientStorage.deleteFoodEntry(user.id, date, id);
      setFoodEntries((prev) => prev.filter((f) => f.id !== id));
      toast.success('Food entry removed.');
    }

    try {
      await fetch(`/api/journal/food/${id}`, { method: 'DELETE' });
      fetchJournal();
    } catch {
      // Already deleted locally
    }
  };

  const openAddModal = (meal: MealType) => {
    if (isSubmitted) {
      toast.info('This day has been submitted. Unlock via "Edit Day" in Audit to make changes.');
      return;
    }
    setActiveMealForAdd(meal);
    setSearchModalOpen(true);
  };

  const openPhotoModal = (meal: MealType) => {
    if (isSubmitted) {
      toast.info('This day has been submitted. Unlock via "Edit Day" in Audit to make changes.');
      return;
    }
    setActiveMealForAdd(meal);
    setPhotoModalOpen(true);
  };

  const openBarcodeModal = (meal: MealType) => {
    if (isSubmitted) {
      toast.info('This day has been submitted. Unlock via "Edit Day" in Audit to make changes.');
      return;
    }
    setActiveMealForAdd(meal);
    setBarcodeModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar
          title="Daily Food Journal"
          subtitle={`Log and review meals for ${formattedDate}`}
          userEmail={user?.email}
        />

        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Top Bar with Date Switcher and View Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            {/* Date Switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftDate(-1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs md:text-sm font-bold">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <button
                onClick={() => shiftDate(1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
              >
                Today
              </button>
            </div>

            {/* View Mode & Submit Button */}
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center text-xs font-semibold">
                <button
                  onClick={() => setViewMode('by-meal')}
                  className={`px-3 py-1 rounded-lg transition ${
                    viewMode === 'by-meal'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  Meal Slots
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-3 py-1 rounded-lg transition ${
                    viewMode === 'timeline'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  Food Timeline
                </button>
              </div>

              <button
                onClick={() => setAuditModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitted ? 'Food Audit' : 'Submit Today'}</span>
              </button>
            </div>
          </div>

          {/* Submission Notice Banner if Submitted */}
          {isSubmitted && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Day Submitted & Audited ({breakdown.overall}% Goal Completion)
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Entries are locked for historical consistency. Click &apos;Edit Day&apos; if you need to make corrections.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setAuditModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Day
              </button>
            </div>
          )}

          {/* Day Totals Summary Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Calories</span>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {totals.calories} <span className="text-xs text-slate-400">/ {targets.calorieTarget}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Protein</span>
              <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
                {totals.protein}g <span className="text-xs text-slate-400">/ {targets.proteinTarget}g</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Carbohydrates</span>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {totals.carbs}g <span className="text-xs text-slate-400">/ {targets.carbTarget}g</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Fat</span>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {totals.fat}g <span className="text-xs text-slate-400">/ {targets.fatTarget}g</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Fibre</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {totals.fibre}g <span className="text-xs text-slate-400">/ {targets.fibreTarget}g</span>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: BY MEAL SECTIONS */}
          {viewMode === 'by-meal' ? (
            <div className="space-y-6">
              {MEAL_SECTIONS.map((section) => {
                const entries = foodEntries.filter((f) => f.meal_type === section.type);
                const mealCalories = Math.round(entries.reduce((sum, f) => sum + f.calories, 0));
                const mealProtein = Number(entries.reduce((sum, f) => sum + f.protein, 0).toFixed(1));

                return (
                  <div
                    key={section.type}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 md:p-6 shadow-xs space-y-4"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{section.icon}</span>
                        <div>
                          <h3 className="font-bold text-base text-slate-900 dark:text-white">
                            {section.label}
                          </h3>
                          <span className="text-xs text-slate-400">{section.timeHint}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {entries.length > 0 && (
                          <div className="text-right hidden sm:block">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {mealCalories} kcal
                            </span>
                            <span className="text-[11px] text-slate-400 block">{mealProtein}g protein</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openPhotoModal(section.type)}
                            disabled={isSubmitted}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-teal-600 dark:text-teal-400 transition flex items-center gap-1.5 disabled:opacity-50"
                            title="Add food from photo"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Photo</span>
                          </button>

                          <button
                            onClick={() => openBarcodeModal(section.type)}
                            disabled={isSubmitted}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition flex items-center gap-1.5 disabled:opacity-50"
                            title="Scan packaged food barcode"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Barcode</span>
                          </button>

                          <button
                            onClick={() => openAddModal(section.type)}
                            disabled={isSubmitted}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Add Food</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meal Entries List */}
                    {entries.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No food items logged for {section.label} yet.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {entries.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{item.icon || '🍽️'}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs md:text-sm text-slate-900 dark:text-white">
                                    {item.custom_name}
                                  </span>
                                  {item.is_discretionary && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium">
                                      Discretionary
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">
                                  {item.portion_amount} {item.portion_unit} ({item.computed_weight_g}g)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right text-xs">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {item.calories} kcal
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {item.protein}g P • {item.carbs}g C • {item.fat}g F
                                </div>
                              </div>

                              {!isSubmitted && (
                                <button
                                  onClick={() => handleDeleteEntry(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW MODE 2: DAILY FOOD TIMELINE PER SPEC */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  Chronological Daily Food Timeline
                </h3>
                <p className="text-xs text-slate-400">Visual timeline of all intake throughout the day</p>
              </div>

              {foodEntries.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                  <UtensilsCrossed className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">No meals added to the timeline yet.</p>
                  <button
                    onClick={() => openAddModal('Breakfast')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                  >
                    + Add Food
                  </button>
                </div>
              ) : (
                <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200 dark:before:bg-emerald-950">
                  {MEAL_SECTIONS.map((section) => {
                    const entries = foodEntries.filter((f) => f.meal_type === section.type);
                    if (entries.length === 0) return null;

                    const secCalories = Math.round(entries.reduce((sum, f) => sum + f.calories, 0));
                    const secProtein = Number(entries.reduce((sum, f) => sum + f.protein, 0).toFixed(1));

                    return (
                      <div key={section.type} className="relative space-y-3">
                        {/* Timeline Node Dot */}
                        <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 dark:ring-emerald-950" />

                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{section.icon}</span>
                            <span>{section.label}</span>
                          </h4>

                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {secCalories} kcal • {secProtein}g Protein
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {entries.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3"
                            >
                              <span className="text-2xl">{item.icon || '🍽️'}</span>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                  {item.custom_name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {item.portion_amount} {item.portion_unit}
                                </div>
                                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {item.calories} kcal • {item.protein}g P
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav onQuickAddFood={() => openAddModal('Breakfast')} />

      {/* MODALS */}
      <FoodSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        defaultMeal={activeMealForAdd}
        date={date}
        userId={user?.id}
        onSuccess={fetchJournal}
      />

      <PhotoFoodModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        defaultMeal={activeMealForAdd}
        date={date}
        userId={user?.id}
        onSuccess={fetchJournal}
      />

      <BarcodeScannerModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        defaultMeal={activeMealForAdd}
        date={date}
        userId={user?.id}
        onSuccess={fetchJournal}
      />

      <DailyAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        date={date}
        userId={user?.id}
        isSubmitted={isSubmitted}
        totals={totals}
        targets={targets}
        breakdown={breakdown}
        remarks={remarks}
        onRefresh={fetchJournal}
      />
    </div>
  );
}

export default function JournalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <JournalContent />
    </React.Suspense>
  );
}
