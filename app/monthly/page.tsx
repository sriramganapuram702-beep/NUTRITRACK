'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Droplets,
  Footprints,
  Scale,
  Award,
  CheckCircle,
  Sparkles,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { User } from '@/lib/types';

interface MonthlyData {
  month: string;
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
    water: number;
    steps: number;
    totalMonthlySteps: number;
    stepGoalAchievedDays: number;
    trackedDaysCount: number;
    totalDaysInMonth: number;
    averageGoalCompletion: number;
    successfulDays: number;
    needingImprovementDays: number;
  };
  body: {
    startingWeight: number;
    currentWeight: number;
    weightChange: number;
    weightLogs: Array<{ date: string; weight_kg: number }>;
  };
  monthlyBreakdown: {
    overall: number;
    nutrition: number;
    protein: number;
    fibre: number;
    water: number;
    steps: number;
    trackingConsistency: number;
    trackedLabel: string;
  };
  dailyChartData: Array<{
    date: string;
    day: string;
    calories: number;
    calorieTarget: number;
    protein: number;
    proteinTarget: number;
    carbs: number;
    fat: number;
    fibre: number;
    water: number;
    waterTarget: number;
    steps: number;
    stepTarget: number;
    completionPct: number;
  }>;
}

export default function MonthlyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Month state (YYYY-MM)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [data, setData] = useState<MonthlyData | null>(null);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/');
        return;
      }
      setUser(authData.user);

      const res = await fetch(`/api/monthly?month=${currentMonth}`);
      const monthlyData = await res.json();
      if (monthlyData) {
        setData(monthlyData);
      }
    } catch (err) {
      console.error('Failed to load monthly data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, router]);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  const changeMonth = (offset: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const [yearStr, monthStr] = currentMonth.split('-');
  const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const averages = data?.averages;
  const breakdown = data?.monthlyBreakdown;
  const body = data?.body;
  const charts = data?.dailyChartData || [];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title="Monthly Progress Analytics" subtitle="Trends, averages, and long-term goal completion" userEmail={user?.email} />

        <div className="max-w-6xl w-full mx-auto px-4 md:px-8 py-6 space-y-8">
          {/* Header & Month Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {monthName} Progress Dashboard
                </h2>
                <p className="text-xs text-slate-400">
                  {breakdown?.trackedLabel || `Tracked days for ${monthName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                {monthName}
              </span>

              <button
                onClick={() => changeMonth(1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 20: MONTHLY 100% PROGRESS HERO PER SPEC */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 p-6 md:p-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center lg:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Monthly Adherence Metric
              </div>

              <div>
                <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  {monthName.split(' ')[0]} Goal Completion
                </h3>
                <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  {breakdown?.overall || 0}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {breakdown?.trackedLabel} • Transparent goal-completion metric, not a medical health score.
                </p>
              </div>

              {/* Progress Breakdown Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Nutrition</span>
                    <span>{breakdown?.nutrition || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.nutrition || 0} color="bg-emerald-500" heightClass="h-1.5" />
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Protein</span>
                    <span>{breakdown?.protein || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.protein || 0} color="bg-teal-500" heightClass="h-1.5" />
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Fibre</span>
                    <span>{breakdown?.fibre || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.fibre || 0} color="bg-amber-500" heightClass="h-1.5" />
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Water</span>
                    <span>{breakdown?.water || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.water || 0} color="bg-blue-500" heightClass="h-1.5" />
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Steps</span>
                    <span>{breakdown?.steps || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.steps || 0} color="bg-purple-500" heightClass="h-1.5" />
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Consistency</span>
                    <span>{breakdown?.trackingConsistency || 0}%</span>
                  </div>
                  <ProgressBar value={breakdown?.trackingConsistency || 0} color="bg-indigo-500" heightClass="h-1.5" />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center">
              <CircularProgress
                value={breakdown?.overall || 0}
                size={150}
                strokeWidth={13}
                color="#10b981"
              >
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {breakdown?.overall || 0}%
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Avg</span>
              </CircularProgress>
            </div>
          </div>

          {/* Section 19: NUTRITION & ACTIVITY & BODY STATS PER SPEC */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Nutrition Averages */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-600" />
                Daily Nutrition Averages
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Daily Calories</span>
                  <span className="font-bold text-slate-900 dark:text-white">{averages?.calories || 0} kcal</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Protein</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">{averages?.protein || 0} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Carbohydrates</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{averages?.carbs || 0} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Fat</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{averages?.fat || 0} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Dietary Fibre</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{averages?.fibre || 0} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Water</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{averages?.water || 0} ml</span>
                </div>
              </div>
            </div>

            {/* 2. Activity Averages */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Footprints className="w-4 h-4 text-purple-600" />
                Activity & Consistency
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Average Daily Steps</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {averages?.steps?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Total Monthly Steps</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {averages?.totalMonthlySteps?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Step Goal Achieved Days</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {averages?.stepGoalAchievedDays || 0} days
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Days Logged / Tracked</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {averages?.trackedDaysCount || 0} / {averages?.totalDaysInMonth || 30}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Successful Days (≥80%)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {averages?.successfulDays || 0} days
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-slate-500">Needing Improvement Days</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {averages?.needingImprovementDays || 0} days
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Body Tracking */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                Body Weight Progress
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-slate-500">Starting Weight</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {body?.startingWeight || 0} kg
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-slate-500">Current Weight</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {body?.currentWeight || 0} kg
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-slate-500">Net Weight Change</span>
                  <span
                    className={`text-base font-bold ${
                      (body?.weightChange || 0) < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (body?.weightChange || 0) > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {(body?.weightChange || 0) > 0 ? `+${body?.weightChange}` : body?.weightChange} kg
                  </span>
                </div>
              </div>

              {body?.weightLogs && body.weightLogs.length > 1 && (
                <div className="h-32 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={body.weightLogs}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight_kg" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* BEAUTIFUL CHARTS SECTION PER SPEC */}
          <div className="space-y-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Monthly Nutritional & Activity Trends
            </h2>

            {charts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  Start tracking today to build your monthly progress.
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  As you log foods, water, and steps across days in {monthName}, interactive analytics charts will plot your trends here.
                </p>
                <button
                  onClick={() => router.push('/journal')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs"
                >
                  + Log Food Today
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Calories Intake vs Target */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Calories vs Target (kcal)
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="calories" fill="#10b981" name="Consumed" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="calorieTarget" stroke="#f59e0b" name="Target" strokeWidth={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Protein Progress Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Daily Protein Intake (g)
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="protein" fill="#14b8a6" name="Protein (g)" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="proteinTarget" stroke="#0d9488" name="Target" strokeWidth={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Steps Progress Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Daily Step Count
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="steps" fill="#a855f7" name="Steps" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Goal Completion Over Time Area Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Daily Goal Completion Trend (%)
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={charts}>
                        <defs>
                          <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="completionPct" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#goalGrad)" name="Completion %" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
