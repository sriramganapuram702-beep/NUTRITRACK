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
import { toast } from 'sonner';

export default function WaterTrackerPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
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

      const res = await fetch(`/api/journal?date=${date}`);
      const data = await res.json();
      if (data) {
        setWaterEntries(data.waterEntries || []);
        setTotalWater(data.totals?.water || 0);
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
    if (amount <= 0) return;
    setIsAdding(true);
    try {
      const res = await fetch('/api/journal/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, amount_ml: amount }),
      });
      if (!res.ok) throw new Error('Failed to log water');
      toast.success(`+${amount} ml logged!`);
      fetchWaterData();
    } catch {
      toast.error('Error logging water');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteWater = async (id: string) => {
    try {
      const res = await fetch(`/api/journal/water/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Water log entry deleted.');
        fetchWaterData();
      }
    } catch {
      toast.error('Error removing entry');
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
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold">
                <Calendar className="w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <button
                onClick={() => {
                  const d = new Date(date + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
            >
              Today
            </button>
          </div>

          {/* Main Visual Water Card */}
          <div className="bg-gradient-to-br from-blue-50 via-sky-50/50 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 p-6 md:p-8 rounded-3xl border border-blue-100 dark:border-blue-900/40 shadow-xs flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold">
                <Droplets className="w-3.5 h-3.5" />
                💧 Water Today
              </div>

              <div className="space-y-1">
                <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {totalWater.toLocaleString()} <span className="text-lg text-slate-400 font-medium">/ {waterTarget.toLocaleString()} ml</span>
                </div>
                <p className="text-xs text-slate-500">
                  {percentage >= 100
                    ? '🎉 Goal achieved! Excellent hydration throughout your day.'
                    : `${waterTarget - totalWater} ml remaining to hit your target.`}
                </p>
              </div>

              {/* Quick Increment Buttons per spec */}
              <div className="pt-2 flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {[250, 500, 750].map((amt) => (
                  <button
                    key={amt}
                    disabled={isAdding}
                    onClick={() => handleAddWater(amt)}
                    className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition disabled:opacity-50"
                  >
                    +{amt} ml
                  </button>
                ))}
              </div>
            </div>

            {/* Circular Visual Indicator */}
            <div className="shrink-0 flex flex-col items-center">
              <CircularProgress
                value={percentage}
                size={140}
                strokeWidth={12}
                color="#3b82f6"
              >
                <Droplets className="w-7 h-7 text-blue-500 mb-1" />
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {percentage}%
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Hydrated</span>
              </CircularProgress>
            </div>
          </div>

          {/* Custom Amount Form */}
          <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Log Custom Water Volume
            </h3>
            <div className="flex gap-3">
              <input
                type="number"
                step="50"
                min="50"
                max="3000"
                value={customAmount}
                onChange={(e) => setCustomAmount(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="Amount in ml (e.g. 350)"
              />
              <button
                disabled={isAdding || customAmount <= 0}
                onClick={() => handleAddWater(customAmount)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition disabled:opacity-50 shrink-0"
              >
                Log Entry
              </button>
            </div>
          </div>

          {/* Water Entries History */}
          <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              Water Intake Log ({waterEntries.length} entries)
            </h3>

            {waterEntries.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No water entries logged yet for this date.
              </p>
            ) : (
              <div className="space-y-2">
                {waterEntries.map((entry) => {
                  const time = new Date(entry.logged_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                          💧
                        </div>
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            +{entry.amount_ml} ml
                          </span>
                          <span className="block text-[11px] text-slate-400">{time}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteWater(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
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
