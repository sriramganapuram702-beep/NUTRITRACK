'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  UtensilsCrossed,
  Flame,
} from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { DailyAuditModal } from '@/components/audit/DailyAuditModal';
import { DailyGoalBreakdown, DailyRemarks, User } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';

interface CalendarDayData {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  status: 'achieved' | 'improvement' | 'missed' | 'untracked';
  completionPct: number;
  calories: number;
  mealCount: number;
  isSubmitted: boolean;
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Month state (YYYY-MM)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [days, setDays] = useState<CalendarDayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDayData | null>(null);

  // Audit modal state for inspected day
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [inspectedAuditData, setInspectedAuditData] = useState<{
    date: string;
    isSubmitted: boolean;
    totals: any;
    targets: any;
    breakdown: DailyGoalBreakdown;
    remarks: DailyRemarks;
  } | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/');
        return;
      }
      setUser(authData.user);

      const res = await fetch(`/api/calendar?month=${currentMonth}`);
      const data = await res.json();
      const serverDays: CalendarDayData[] = (data && data.days) || [];

      // MERGE CLIENT-PERSISTENT DATA (Guarantees calendar history is preserved forever across years)
      const mergedDays = serverDays.map((day) => {
        const local = clientStorage.getDayData(authData.user.id, day.date);
        if (
          local &&
          (local.foodEntries.length > 0 ||
            local.isSubmitted ||
            local.steps > 0 ||
            local.waterEntries.length > 0)
        ) {
          const localCals = Math.round(local.foodEntries.reduce((s, f) => s + f.calories, 0));
          const localMeals = new Set(local.foodEntries.map((f) => f.meal_type)).size;
          const localPct =
            local.goalCompletionPct ||
            (localCals > 0 ? Math.min(100, Math.round((localCals / 2000) * 100)) : 0);

          let finalStatus: CalendarDayData['status'] = day.status;
          if (finalStatus === 'untracked') {
            if (localPct >= 80) finalStatus = 'achieved';
            else if (localPct >= 50) finalStatus = 'improvement';
            else finalStatus = 'missed';
          }

          return {
            ...day,
            status: finalStatus,
            completionPct: Math.max(day.completionPct || 0, localPct),
            calories: Math.max(day.calories || 0, localCals),
            mealCount: Math.max(day.mealCount || 0, localMeals),
            isSubmitted: Boolean(day.isSubmitted || local.isSubmitted),
          };
        }
        return day;
      });

      setDays(mergedDays);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, router]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const changeMonth = (offset: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleSelectDate = async (day: CalendarDayData) => {
    setSelectedDay(day);

    if (!user) return;

    // 1. Prepare local audit fallback first
    const local = clientStorage.getDayData(user.id, day.date);
    const localCals = Math.round(local.foodEntries.reduce((s, f) => s + f.calories, 0));
    const localProt = Number(local.foodEntries.reduce((s, f) => s + f.protein, 0).toFixed(1));
    const localCarbs = Number(local.foodEntries.reduce((s, f) => s + f.carbs, 0).toFixed(1));
    const localFat = Number(local.foodEntries.reduce((s, f) => s + f.fat, 0).toFixed(1));
    const localFibre = Number(local.foodEntries.reduce((s, f) => s + f.fibre, 0).toFixed(1));
    const localWater = local.waterEntries.reduce((s, w) => s + w.amount_ml, 0);

    const fallbackAudit = {
      date: day.date,
      isSubmitted: Boolean(day.isSubmitted || local.isSubmitted),
      totals: {
        calories: localCals,
        protein: localProt,
        carbs: localCarbs,
        fat: localFat,
        fibre: localFibre,
        water: localWater,
        steps: local.steps || 0,
        discretionaryCount: local.foodEntries.filter((f) => f.is_discretionary).length,
      },
      targets: {
        calorieTarget: 2000,
        proteinTarget: 80,
        carbTarget: 250,
        fatTarget: 65,
        fibreTarget: 28,
        waterTarget: 3000,
        stepTarget: 10000,
      },
      breakdown: {
        calories: { consumed: localCals, target: 2000, pct: Math.min(100, Math.round((localCals / 2000) * 100)), score: 10 },
        protein: { consumed: localProt, target: 80, pct: Math.min(100, Math.round((localProt / 80) * 100)), score: 10 },
        fibre: { consumed: localFibre, target: 28, pct: Math.min(100, Math.round((localFibre / 28) * 100)), score: 10 },
        water: { consumed: localWater, target: 3000, pct: Math.min(100, Math.round((localWater / 3000) * 100)), score: 10 },
        steps: { consumed: local.steps || 0, target: 10000, pct: Math.min(100, Math.round(((local.steps || 0) / 10000) * 100)), score: 10 },
        consistency: { loggedMeals: new Set(local.foodEntries.map((f) => f.meal_type)).size, score: 10 },
        discretionaryPenalty: 0,
        overall: day.completionPct || local.goalCompletionPct || 80,
      },
      remarks: {
        disclaimer: 'NutriTrack automated audit report.',
      },
    };

    setInspectedAuditData(fallbackAudit);

    // 2. Fetch server details
    try {
      const res = await fetch(`/api/journal?date=${day.date}`);
      const data = await res.json();
      if (data && data.log) {
        setInspectedAuditData({
          date: day.date,
          isSubmitted: Boolean(data.log?.is_submitted || local.isSubmitted),
          totals: data.totals || fallbackAudit.totals,
          targets: data.targets || fallbackAudit.targets,
          breakdown: data.breakdown || fallbackAudit.breakdown,
          remarks: data.remarks || fallbackAudit.remarks,
        });
      }
    } catch (err) {
      console.warn('Inspecting day using local storage:', err);
    }
  };

  const [yearStr, monthStr] = currentMonth.split('-');
  const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const monthTitle = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // First day of month day-of-week (0 = Sun, 1 = Mon ... 6 = Sat)
  // Shift to Monday = 0
  const firstDayOfWeek = (monthDate.getDay() + 6) % 7;

  const getStatusBadgeUI = (status: CalendarDayData['status']) => {
    switch (status) {
      case 'achieved':
        return { dot: '🟢', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300', label: 'Goal mostly achieved (≥80%)' };
      case 'improvement':
        return { dot: '🟡', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300', label: 'Needs improvement (50-79%)' };
      case 'missed':
        return { dot: '🔴', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300', label: 'Significant targets missed (<50%)' };
      default:
        return { dot: '⚪', bg: 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 text-slate-400', label: 'Not tracked' };
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title="Tracking Calendar" subtitle="Monthly adherence overview and daily logs" userEmail={user?.email} />

        <div className="max-w-5xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Month Header & Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {monthTitle}
                </h2>
                <p className="text-xs text-slate-400">Click any date to inspect the daily food audit</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Current Month
              </button>

              <button
                onClick={() => changeMonth(1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Status Legend */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-around gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              <span>🟢</span>
              <span className="text-slate-600 dark:text-slate-300">Goal mostly achieved (≥ 80%)</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span>🟡</span>
              <span className="text-slate-600 dark:text-slate-300">Needs improvement (50% – 79%)</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span>🔴</span>
              <span className="text-slate-600 dark:text-slate-300">Significant targets missed (&lt; 50%)</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span>⚪</span>
              <span className="text-slate-400">Not tracked</span>
            </div>
          </div>

          {/* Main Calendar Grid */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            {/* Days of Week Header (Mon-Sun per spec) */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Padding cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`pad-${i}`} className="h-20 md:h-24 rounded-2xl bg-transparent" />
              ))}

              {/* Month Days */}
              {days.map((day) => {
                const ui = getStatusBadgeUI(day.status);
                const isSelected = selectedDay?.date === day.date;

                return (
                  <div
                    key={day.date}
                    onClick={() => handleSelectDate(day)}
                    className={`h-20 md:h-24 p-2 md:p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                      ui.bg
                    } ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 shadow-md'
                        : 'hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-100">
                        {day.dayNumber}
                      </span>
                      <span className="text-xs">{ui.dot}</span>
                    </div>

                    {day.status !== 'untracked' ? (
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-extrabold truncate">
                          {day.completionPct}% Goal
                        </div>
                        <div className="text-[10px] text-slate-500 truncate hidden md:block">
                          {day.calories} kcal • {day.mealCount} meals
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Rest / Untracked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Detail Card Preview */}
          {selectedDay && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{getStatusBadgeUI(selectedDay.status).dot}</span>
                    <span>Report for {selectedDay.date}</span>
                    {selectedDay.isSubmitted && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-bold">
                        Submitted
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getStatusBadgeUI(selectedDay.status).label} • {selectedDay.calories} kcal logged
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/journal?date=${selectedDay.date}`)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Open in Journal
                  </button>

                  <button
                    onClick={() => setAuditModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>View Daily Audit</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav />

      {/* Audit Modal for Clicked Date */}
      {inspectedAuditData && (
        <DailyAuditModal
          isOpen={auditModalOpen}
          onClose={() => setAuditModalOpen(false)}
          date={inspectedAuditData.date}
          userId={user?.id}
          isSubmitted={inspectedAuditData.isSubmitted}
          totals={inspectedAuditData.totals}
          targets={inspectedAuditData.targets}
          breakdown={inspectedAuditData.breakdown}
          remarks={inspectedAuditData.remarks}
          onRefresh={fetchCalendar}
        />
      )}
    </div>
  );
}
