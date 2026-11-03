'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Footprints, Calendar, ChevronLeft, ChevronRight, Save, Award, Activity } from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { User } from '@/lib/types';
import { toast } from 'sonner';

export default function StepTrackerPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<number>(0);
  const [stepTarget, setStepTarget] = useState<number>(10000);
  const [inputVal, setInputVal] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const fetchStepsData = useCallback(async () => {
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
        const currentSteps = data.totals?.steps || 0;
        setSteps(currentSteps);
        setInputVal(currentSteps);
        setStepTarget(data.targets?.stepTarget || 10000);
      }
    } catch (err) {
      console.error('Failed to load steps data:', err);
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => {
    fetchStepsData();
  }, [fetchStepsData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/journal/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, steps: inputVal }),
      });
      if (!res.ok) throw new Error('Failed to update steps');
      toast.success(`Today's steps updated to ${inputVal.toLocaleString()}!`);
      setSteps(inputVal);
      fetchStepsData();
    } catch {
      toast.error('Error saving steps');
    } finally {
      setSaving(false);
    }
  };

  const percentage = stepTarget > 0 ? Math.min(100, Math.round((steps / stepTarget) * 100)) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title="Step & Activity Tracker" subtitle="Record and monitor daily movement" userEmail={user?.email} />

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
                <Calendar className="w-4 h-4 text-purple-500" />
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
              className="px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition"
            >
              Today
            </button>
          </div>

          {/* Main Visual Steps Card */}
          <div className="bg-gradient-to-br from-purple-50 via-fuchsia-50/40 to-white dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 p-6 md:p-8 rounded-3xl border border-purple-100 dark:border-purple-900/40 shadow-xs flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold">
                <Footprints className="w-3.5 h-3.5" />
                👟 Daily Movement
              </div>

              <div className="space-y-1">
                <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {steps.toLocaleString()}{' '}
                  <span className="text-lg text-slate-400 font-medium">/ {stepTarget.toLocaleString()} steps</span>
                </div>
                <p className="text-xs text-slate-500">
                  {percentage >= 100
                    ? '🎉 Phenomenal work! Daily step target fully achieved.'
                    : `${Math.max(0, stepTarget - steps).toLocaleString()} steps remaining today.`}
                </p>
              </div>

              <div className="pt-1">
                <ProgressBar value={steps} max={stepTarget} color="bg-purple-600" heightClass="h-2.5" />
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center">
              <CircularProgress
                value={percentage}
                size={140}
                strokeWidth={12}
                color="#9333ea"
              >
                <Footprints className="w-7 h-7 text-purple-500 mb-1" />
                <span className="text-2xl font-black text-slate-900 dark:text-white">{percentage}%</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Step Goal</span>
              </CircularProgress>
            </div>
          </div>

          {/* Update Step Form */}
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Update Step Count
                </h3>
                <p className="text-xs text-slate-400">
                  Enter your latest valid step count from your phone or fitness tracker (updates the daily total).
                </p>
              </div>
              <Activity className="w-5 h-5 text-purple-500" />
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                min="0"
                step="100"
                value={inputVal}
                onChange={(e) => setInputVal(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Update Steps'}</span>
              </button>
            </div>

            {/* Quick preset increment buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[+1000, +2500, +5000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setInputVal((prev) => prev + inc)}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/60 transition"
                >
                  +{inc.toLocaleString()} steps
                </button>
              ))}
            </div>
          </form>

          {/* Activity Notes */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Wearable & Health API Extensibility</p>
            <p>
              Version 1 stores manual step logs with highest-count retention. Future versions can connect directly to Apple Health, Google Health Connect, or Fitbit via the centralized steps API endpoint.
            </p>
          </div>

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
