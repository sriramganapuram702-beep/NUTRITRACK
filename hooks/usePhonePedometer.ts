'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

interface UsePhonePedometerProps {
  userId?: string;
  date: string;
  initialSteps: number;
  onStepUpdate?: (steps: number) => void;
}

export function usePhonePedometer({
  userId,
  date,
  initialSteps = 0,
  onStepUpdate,
}: UsePhonePedometerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [liveSteps, setLiveSteps] = useState(initialSteps);
  const [lastStepAt, setLastStepAt] = useState<number>(0);

  const stepsRef = useRef(initialSteps);
  const userIdRef = useRef(userId);
  const dateRef = useRef(date);
  const onStepUpdateRef = useRef(onStepUpdate);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  stepsRef.current = liveSteps;
  userIdRef.current = userId;
  dateRef.current = date;
  onStepUpdateRef.current = onStepUpdate;

  // Keep liveSteps in sync with external initialSteps updates
  useEffect(() => {
    if (initialSteps > stepsRef.current) {
      setLiveSteps(initialSteps);
      stepsRef.current = initialSteps;
    }
  }, [initialSteps]);

  // Sync to server with 5s debounce or every 10 steps
  const scheduleServerSync = useCallback((count: number) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      const activeUser = userIdRef.current || 'usr_default';
      const activeDate = dateRef.current;
      clientStorage.saveSteps(activeUser, activeDate, count);

      try {
        await fetch('/api/journal/steps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: activeDate, steps: count }),
        });
      } catch (e) {
        // Preserved in clientStorage
      }
    }, 4000);
  }, []);

  const startTracking = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!('DeviceMotionEvent' in window)) {
      setIsSupported(false);
      toast.error('Device motion sensors not available on this device/browser.');
      return;
    }

    try {
      // iOS 13+ requires explicit permission request on user interaction
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          toast.error('Motion sensor permission denied in browser.');
          return;
        }
      }

      let lastMagnitude = 9.8;
      let lastStepTimestamp = 0;
      const STEP_THRESHOLD = 11.5; // m/s^2 (gravity 9.8 + walking push ~1.7)
      const MIN_STEP_INTERVAL = 300; // ms (maximum ~3.3 steps per second)

      const handleMotion = (event: DeviceMotionEvent) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        const delta = Math.abs(magnitude - lastMagnitude);
        const now = Date.now();

        // Detect walking wave peak
        if (
          magnitude > STEP_THRESHOLD &&
          delta > 1.8 &&
          now - lastStepTimestamp > MIN_STEP_INTERVAL
        ) {
          lastStepTimestamp = now;
          const newStepCount = stepsRef.current + 1;
          stepsRef.current = newStepCount;
          setLiveSteps(newStepCount);
          setLastStepAt(now);

          // Save immediately to client persistent storage
          const resolvedUser = userIdRef.current || 'usr_default';
          clientStorage.saveSteps(resolvedUser, dateRef.current, newStepCount);

          if (onStepUpdateRef.current) {
            onStepUpdateRef.current(newStepCount);
          }

          scheduleServerSync(newStepCount);
        }

        lastMagnitude = magnitude;
      };

      window.addEventListener('devicemotion', handleMotion, { passive: true });
      setIsTracking(true);
      toast.success('🚶 Motion pedometer activated! Steps will count automatically as you move.');

      // Return cleanup
      return () => {
        window.removeEventListener('devicemotion', handleMotion);
      };
    } catch (err) {
      console.warn('Could not start pedometer motion listener:', err);
      toast.error('Motion sensor error. You can still enter steps manually.');
    }
  }, [scheduleServerSync]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    toast.info('Motion pedometer paused.');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  return {
    isTracking,
    isSupported,
    liveSteps,
    lastStepAt,
    startTracking,
    stopTracking,
    setLiveSteps,
  };
}
