'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Save,
  Award,
  Activity,
  Play,
  Pause,
  Sparkles,
  Flame,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { User } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

export default function StepTrackerPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<number>(0);
  const [stepTarget, setStepTarget] = useState<number>(10000);
  const [saving, setSaving] = useState(false);

  // Automatic Motion Sensor State
  const [sensorActive, setSensorActive] = useState<boolean>(false);
  const [sensorSupported, setSensorSupported] = useState<boolean>(true);
  const [lastStepTime, setLastStepTime] = useState<number>(0);
  const [stepPulse, setStepPulse] = useState<boolean>(false);
  const stepsRef = useRef<number>(0);
  const userRef = useRef<User | null>(null);
  const dateRef = useRef<string>(date);

  stepsRef.current = steps;
  userRef.current = user;
  dateRef.current = date;

  const fetchStepsData = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/');
        return;
      }
      setUser(authData.user);

      // 1. Load from client persistent storage first (instant, never lost)
      const localDay = clientStorage.getDayData(authData.user.id, date);
      if (localDay && localDay.steps) {
        setSteps(localDay.steps);
      }

      // 2. Fetch from server
      const res = await fetch(`/api/journal?date=${date}`);
      const data = await res.json();
      if (data) {
        const serverSteps = data.totals?.steps || 0;
        const target = data.targets?.stepTarget || 10000;
        setStepTarget(target);

        // Keep highest steps
        const finalSteps = Math.max(localDay.steps || 0, serverSteps);
        setSteps(finalSteps);
        clientStorage.saveSteps(authData.user.id, date, finalSteps);
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

  // Sync steps to server periodically
  const syncStepsToServer = async (stepCount: number) => {
    if (!userRef.current) return;
    clientStorage.saveSteps(userRef.current.id, dateRef.current, stepCount);
    try {
      await fetch('/api/journal/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateRef.current, steps: stepCount }),
      });
    } catch {
      // Saved locally
    }
  };

  // Automatic Step Detection via Device Accelerometer
  const startMotionSensor = async () => {
    if (typeof window === 'undefined') return;

    if (!('DeviceMotionEvent' in window)) {
      toast.error('Device motion sensor not supported on this browser. You can enter steps below.');
      setSensorSupported(false);
      return;
    }

    try {
      // iOS 13+ requires explicit permission request
      if (
        typeof (DeviceMotionEvent as any).requestPermission === 'function'
      ) {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          toast.error('Motion permission denied. Enable motion sensors in phone settings.');
          return;
        }
      }

      let lastMagnitude = 9.8;
      let lastPeakTime = 0;
      const STEP_THRESHOLD = 11.8; // m/s^2 (gravity 9.8 + acceleration ~2.0)
      const MIN_STEP_INTERVAL = 320; // ms (maximum ~3 steps per second)

      const handleMotion = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Step peak detection
        if (
          magnitude > STEP_THRESHOLD &&
          lastMagnitude <= STEP_THRESHOLD &&
          now - lastPeakTime > MIN_STEP_INTERVAL
        ) {
          lastPeakTime = now;
          setLastStepTime(now);

          setSteps((prev) => {
            const next = prev + 1;
            // Visual pulse
            setStepPulse(true);
            setTimeout(() => setStepPulse(false), 200);

            // Auto-sync every 5 steps
            if (next % 5 === 0) {
              syncStepsToServer(next);
            }
            return next;
          });
        }

        lastMagnitude = magnitude;
      };

      window.addEventListener('devicemotion', handleMotion);
      setSensorActive(true);
      toast.success('Live Motion Sensor Activated! Walk with your phone to count steps automatically.');

      // Cleanup ref for pause
      (window as any)._nutritrack_motion_handler = handleMotion;
    } catch (err) {
      console.error('Error starting motion sensor:', err);
      toast.error('Could not activate phone motion sensor.');
    }
  };

  const stopMotionSensor = () => {
    if (typeof window !== 'undefined' && (window as any)._nutritrack_motion_handler) {
      window.removeEventListener('devicemotion', (window as any)._nutritrack_motion_handler);
      delete (window as any)._nutritrack_motion_handler;
    }
    setSensorActive(false);
    syncStepsToServer(stepsRef.current);
    toast.info('Pedometer sensor paused. Steps saved.');
  };

  // Clean up sensor on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && (window as any)._nutritrack_motion_handler) {
        window.removeEventListener('devicemotion', (window as any)._nutritrack_motion_handler);
      }
    };
  }, []);

  const handleManualAdd = (increment: number) => {
    const next = Math.max(0, steps + increment);
    setSteps(next);
    syncStepsToServer(next);
    toast.success(`Updated steps to ${next.toLocaleString()}!`);
  };

  const percentage = stepTarget > 0 ? Math.min(100, Math.round((steps / stepTarget) * 100)) : 0;
  const distanceKm = (steps * 0.00075).toFixed(2); // ~0.75m stride length
  const caloriesBurned = Math.round(steps * 0.04); // ~0.04 kcal per step

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
        <TopBar
          title="Automatic Step & Motion Tracker"
          subtitle="Real-time pedometer using phone movement"
          userEmail={user?.email}
        />

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
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 font-bold text-sm">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition"
            >
              Today
            </button>
          </div>

          {/* Automatic Phone Motion Sensor Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-900/90 via-indigo-900/90 to-slate-900 text-white shadow-xl border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md text-purple-200">
                <Activity className={`w-4 h-4 ${sensorActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                <span>{sensorActive ? 'Live Sensor: ACTIVE 🟢 (Counting Steps)' : 'Sensor: PAUSED ⏸️'}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black">Automatic Walking Pedometer</h2>
              <p className="text-xs text-purple-200/80 max-w-md">
                Keep your phone in your pocket or hand while walking. The phone&apos;s motion sensor automatically detects footsteps and counts your steps!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {sensorActive ? (
                <button
                  type="button"
                  onClick={stopMotionSensor}
                  className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2 transition"
                >
                  <Pause className="w-4 h-4" />
                  Pause Auto Sensor
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startMotionSensor}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition hover:scale-105 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Auto Step Sensor
                </button>
              )}
            </div>
          </div>

          {/* Main Visual Display */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xs">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <CircularProgress
                  value={percentage}
                  size={200}
                  strokeWidth={14}
                  color="#9333ea"
                >
                  <div className={`flex flex-col items-center justify-center transition-transform ${stepPulse ? 'scale-110' : 'scale-100'}`}>
                    <Footprints className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-1" />
                    <span className="text-3xl font-black text-slate-900 dark:text-white">
                      {steps.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      of {stepTarget.toLocaleString()} steps
                    </span>
                  </div>
                </CircularProgress>
              </div>

              {/* Real-Time Metrics */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-lg pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Distance</span>
                  <span className="font-black text-base text-purple-600 dark:text-purple-400">{distanceKm}</span>
                  <span className="text-[10px] text-slate-500 block">km</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Calories</span>
                  <span className="font-black text-base text-amber-600 dark:text-amber-400">{caloriesBurned}</span>
                  <span className="text-[10px] text-slate-500 block">kcal burned</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Goal</span>
                  <span className="font-black text-base text-emerald-600 dark:text-emerald-400">{percentage}%</span>
                  <span className="text-[10px] text-slate-500 block">completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Adjustment Buttons (Optional) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Quick Step Adjustments (if phone was in car or charging):
              </span>
              <span className="text-xs text-slate-400">Tap to add</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleManualAdd(amt)}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs transition border border-slate-200 dark:border-slate-700"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <DisclaimerBanner />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
