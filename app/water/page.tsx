'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets, Plus, Trash2, Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { User, WaterEntry } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

export default function WaterTrackerPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => clientStorage.getLocalTodayString());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [totalWater, setTotalWater] = useState<number>(0);
  const [waterTarget, setWaterTarget] = useState<number>(3000);
  const [customAmount, setCustomAmount] = useState<number>(250);
  const [isAdding, setIsAdding] = useState(false);

  const fetchWaterData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/');
        return;
      }
      setUser(authData.user);
      clientStorage.setActiveUser(authData.user.id);

      // 1. Load from local persistent storage (instant, never lost)
      const localDay = clientStorage.getDayData(authData.user.id, date);
      if (localDay && localDay.waterEntries.length > 0) {
        setWaterEntries(localDay.waterEntries);
        const sum = localDay.waterEntries.reduce((s, w) => s + w.amount_ml, 0);
        setTotalWater(sum);
      }

      // 2. Fetch from server and merge
      const res = await fetch(`/api/journal?date=${date}`);
      const data = await res.json();
      if (data) {
        const merged = clientStorage.mergeServerData(
          authData.user.id,
          date,
          data.foodEntries || [],
          data.waterEntries || [],
          data.totals?.steps || 0
        );
        setWaterEntries(merged.waterEntries);
        const total = merged.waterEntries.reduce((s, w) => s + w.amount_ml, 0);
        setTotalWater(total);
        setWaterTarget(data.targets?.waterTarget || 3000);
      }
    } catch (err) {
      console.error('Failed to load water data:', err);
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => {
    fetchWaterData();
  }, [fetchWaterData]);

  const handleAddWater = async (amount: number) => {
    if (amount <= 0 || !user) return;
    setIsAdding(true);

    const now = new Date().toISOString();
    const entryId = 'wat_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const newEntry: WaterEntry = {
      id: entryId,
      daily_log_id: 'log_' + date,
      amount_ml: amount,
      logged_at: now,
    };

    // 1. GUARANTEED PERSISTENCE: Save to phone persistent storage FIRST!
    clientStorage.saveWaterEntry(user.id, date, newEntry);

    // Update UI immediately
    setWaterEntries((prev) => [...prev, newEntry]);
    setTotalWater((prev) => prev + amount);
    toast.success(`+${amount} ml logged! Saved permanently.`);

    // 2. Sync to cloud server API in parallel
    try {
      await fetch('/api/journal/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, amount_ml: amount }),
      });
    } catch {
      // Already saved locally
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteWater = async (id: string) => {
    if (!user) return;
    try {
      // Remove from client storage
      const day = clientStorage.getDayData(user.id, date);
      day.waterEntries = day.waterEntries.filter((w) => w.id !== id);
      clientStorage.saveDayData(user.id, day);

      setWaterEntries((prev) => prev.filter((w) => w.id !== id));
      const newTotal = waterEntries.filter((w) => w.id !== id).reduce((s, w) => s + w.amount_ml, 0);
      setTotalWater(newTotal);
      toast.success('Water log entry deleted.');

      await fetch(`/api/journal/water/${id}`, { method: 'DELETE' });
    } catch {
      // Removed locally
    }
  };

  const percentage = waterTarget > 0 ? Math.min(100, Math.round((totalWater / waterTarget) * 100)) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title="Hydration Tracker" subtitle="Monitor daily water consumption" userEmail={user?.email} />

        <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-6 space-y-6">
          {/* Date Selector */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(date + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  setDate(clientStorage.formatLocalDate(d));
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 font-bold text-sm">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <button
                onClick={() => {
                  const d = new Date(date + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  setDate(clientStorage.formatLocalDate(d));
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => setDate(clientStorage.getLocalTodayString())}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
            >
              Today
            </button>
          </div>

          {/* Main Visual Display */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <CircularProgress
                  value={percentage}
                  size={190}
                  strokeWidth={14}
                  color="#2563eb"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Droplets className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-1" />
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {totalWater.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      of {waterTarget.toLocaleString()} ml
                    </span>
                  </div>
                </CircularProgress>
              </div>

              <div className="w-full max-w-md space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Hydration Progress</span>
                  <span className="text-blue-600 dark:text-blue-400">{percentage}%</span>
                </div>
                <ProgressBar value={totalWater} max={waterTarget} color="bg-blue-600" />
              </div>
            </div>
          </div>

          {/* Quick-Log Buttons */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Quick Log Cups & Glasses:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { amount: 150, label: 'Small Cup (150 ml)' },
                { amount: 250, label: 'Standard Glass (250 ml)' },
                { amount: 500, label: 'Water Bottle (500 ml)' },
                { amount: 750, label: 'Large Flask (750 ml)' },
              ].map((item) => (
                <button
                  key={item.amount}
                  type="button"
                  onClick={() => handleAddWater(item.amount)}
                  disabled={isAdding}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-center transition group disabled:opacity-50"
                >
                  <Droplets className="w-5 h-5 mx-auto text-blue-500 group-hover:scale-110 transition mb-1" />
                  <span className="font-bold text-sm block text-slate-900 dark:text-white">
                    +{item.amount} ml
                  </span>
                  <span className="text-[11px] text-slate-400">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Water Log List */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Water Logs for {date} ({waterEntries.length} entries)
            </h3>
            {waterEntries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No water logged for this day yet.</p>
            ) : (
              <div className="space-y-2">
                {waterEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {entry.amount_ml} ml
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWater(entry.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
