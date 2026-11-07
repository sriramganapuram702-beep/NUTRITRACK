'use client';

/**
 * NutriTrack Unified Client-Side Persistent Storage Engine
 * Guarantees that user food entries, water intake, steps, profile goals, and daily logs
 * NEVER disappear across serverless cold starts, container recycles, or app closes.
 */

import { FoodEntry, WaterEntry, MealType, Profile } from './types';

const STORAGE_PREFIX = 'nutritrack_v1_';

export interface StoredDayData {
  date: string;
  foodEntries: FoodEntry[];
  waterEntries: WaterEntry[];
  steps: number;
  isSubmitted: boolean;
  submittedAt?: string;
  goalCompletionPct?: number;
  updatedAt: string;
}

export const clientStorage = {
  // In-memory cache of current active user id
  _activeUserId: null as string | null,

  // Set the current authenticated user ID in memory and persistent storage
  setActiveUser(userId: string): void {
    if (!userId || userId === 'usr_default') return;
    this._activeUserId = userId;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nutritrack_active_user_id', userId);
      } catch (e) {
        console.warn('clientStorage.setActiveUser error:', e);
      }
    }
  },

  // Clear active user on logout
  clearActiveUser(): void {
    this._activeUserId = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nutritrack_active_user_id');
      } catch {}
    }
  },

  // Resolve user id so modals and background calls never write to mismatched keys
  resolveUserId(userId?: string): string {
    if (userId && userId !== 'usr_default') {
      this.setActiveUser(userId);
      return userId;
    }
    if (this._activeUserId) return this._activeUserId;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('nutritrack_active_user_id');
        if (stored) {
          this._activeUserId = stored;
          return stored;
        }
      } catch {}
    }
    return userId || 'usr_default';
  },

  // Universal LOCAL timezone today date string (YYYY-MM-DD)
  // Prevents the UTC bug where early morning hours (e.g. in India/Asia/Europe) switch to yesterday!
  getLocalTodayString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Format any Date object to local YYYY-MM-DD
  formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Get storage key for a user and date
  getKey(userId: string, date: string): string {
    const resolvedUser = this.resolveUserId(userId);
    return `${STORAGE_PREFIX}${resolvedUser}_${date}`;
  },

  // Get index of all logged dates for user (for Calendar history forever)
  getDatesIndexKey(userId: string): string {
    const resolvedUser = this.resolveUserId(userId);
    return `${STORAGE_PREFIX}${resolvedUser}_dates_index`;
  },

  // Load a full day's data from persistent storage
  getDayData(userId: string, date: string): StoredDayData {
    if (typeof window === 'undefined') {
      return {
        date,
        foodEntries: [],
        waterEntries: [],
        steps: 0,
        isSubmitted: false,
        updatedAt: new Date().toISOString(),
      };
    }

    const resolvedUser = this.resolveUserId(userId);
    const primaryKey = this.getKey(resolvedUser, date);

    let result: StoredDayData | null = null;
    try {
      const raw = localStorage.getItem(primaryKey);
      if (raw) {
        result = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('clientStorage.getDayData error:', e);
    }

    // AUTO-MIGRATION SAFEGUARD:
    // If the resolved user is a real user ID, check if any entries were temporarily recorded
    // under 'usr_default' before user session was retrieved, and merge them immediately!
    if (resolvedUser !== 'usr_default') {
      try {
        const fallbackKey = `${STORAGE_PREFIX}usr_default_${date}`;
        const fallbackRaw = localStorage.getItem(fallbackKey);
        if (fallbackRaw) {
          const fallbackData: StoredDayData = JSON.parse(fallbackRaw);
          if (
            (fallbackData.foodEntries && fallbackData.foodEntries.length > 0) ||
            (fallbackData.waterEntries && fallbackData.waterEntries.length > 0) ||
            fallbackData.steps > 0
          ) {
            if (!result) {
              result = { ...fallbackData, date };
            } else {
              const foodMap = new Map<string, FoodEntry>();
              result.foodEntries.forEach((f) => foodMap.set(f.id, f));
              fallbackData.foodEntries.forEach((f) => {
                if (!foodMap.has(f.id)) foodMap.set(f.id, f);
              });
              result.foodEntries = Array.from(foodMap.values());

              const waterMap = new Map<string, WaterEntry>();
              result.waterEntries.forEach((w) => waterMap.set(w.id, w));
              fallbackData.waterEntries.forEach((w) => {
                if (!waterMap.has(w.id)) waterMap.set(w.id, w);
              });
              result.waterEntries = Array.from(waterMap.values());
              result.steps = Math.max(result.steps || 0, fallbackData.steps || 0);
              result.isSubmitted = Boolean(result.isSubmitted || fallbackData.isSubmitted);
            }

            // Save merged result back to primary user storage
            localStorage.setItem(primaryKey, JSON.stringify(result));

            // Clean fallback to prevent duplicate re-merging
            localStorage.removeItem(fallbackKey);
          }
        }
      } catch (err) {
        console.warn('clientStorage fallback migration notice:', err);
      }
    }

    return (
      result || {
        date,
        foodEntries: [],
        waterEntries: [],
        steps: 0,
        isSubmitted: false,
        updatedAt: new Date().toISOString(),
      }
    );
  },

  // Save full day's data to phone persistent storage
  saveDayData(userId: string, data: StoredDayData): void {
    if (typeof window === 'undefined') return;

    try {
      const resolvedUser = this.resolveUserId(userId);
      const key = this.getKey(resolvedUser, data.date);
      localStorage.setItem(key, JSON.stringify(data));

      // Update dates index for permanent Calendar tracking across the year
      const indexKey = this.getDatesIndexKey(resolvedUser);
      const rawIndex = localStorage.getItem(indexKey);
      const dates = rawIndex ? JSON.parse(rawIndex) : [];
      if (!dates.includes(data.date)) {
        dates.push(data.date);
        dates.sort();
        localStorage.setItem(indexKey, JSON.stringify(dates));
      }
    } catch (e) {
      console.warn('clientStorage.saveDayData error:', e);
    }
  },

  // Add or update a food entry
  saveFoodEntry(userId: string, date: string, entry: FoodEntry): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    const existingIndex = day.foodEntries.findIndex((f) => f.id === entry.id);

    if (existingIndex >= 0) {
      day.foodEntries[existingIndex] = entry;
    } else {
      day.foodEntries.push(entry);
    }

    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Remove a food entry
  deleteFoodEntry(userId: string, date: string, entryId: string): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    day.foodEntries = day.foodEntries.filter((f) => f.id !== entryId);
    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Add a water entry
  saveWaterEntry(userId: string, date: string, entry: WaterEntry): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    const existingIndex = day.waterEntries.findIndex((w) => w.id === entry.id);

    if (existingIndex >= 0) {
      day.waterEntries[existingIndex] = entry;
    } else {
      day.waterEntries.push(entry);
    }

    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Update steps
  saveSteps(userId: string, date: string, steps: number): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    day.steps = Math.max(day.steps, steps);
    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Submit day audit
  submitDay(userId: string, date: string, goalCompletionPct: number): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    day.isSubmitted = true;
    day.submittedAt = new Date().toISOString();
    day.goalCompletionPct = goalCompletionPct;
    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Unlock day audit
  unsubmitDay(userId: string, date: string): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const day = this.getDayData(resolvedUser, date);
    day.isSubmitted = false;
    day.updatedAt = new Date().toISOString();
    this.saveDayData(resolvedUser, day);
    return day;
  },

  // Get all recorded dates for calendar history
  getAllLoggedDates(userId: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const resolvedUser = this.resolveUserId(userId);
      const indexKey = this.getDatesIndexKey(resolvedUser);
      const raw = localStorage.getItem(indexKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Merge server data with client persistent data
  // GUARANTEE: Never wipes user entries if serverless lambda is cold-started or empty
  mergeServerData(
    userId: string,
    date: string,
    serverEntries: FoodEntry[],
    serverWater: WaterEntry[],
    serverSteps: number
  ): StoredDayData {
    const resolvedUser = this.resolveUserId(userId);
    const local = this.getDayData(resolvedUser, date);

    // Merge food entries by id (preserving client entries if serverless restarted)
    const foodMap = new Map<string, FoodEntry>();
    serverEntries.forEach((f) => foodMap.set(f.id, f));
    local.foodEntries.forEach((f) => {
      if (!foodMap.has(f.id)) {
        foodMap.set(f.id, f);
      }
    });

    // Merge water entries by id
    const waterMap = new Map<string, WaterEntry>();
    serverWater.forEach((w) => waterMap.set(w.id, w));
    local.waterEntries.forEach((w) => {
      if (!waterMap.has(w.id)) {
        waterMap.set(w.id, w);
      }
    });

    const merged: StoredDayData = {
      date,
      foodEntries: Array.from(foodMap.values()),
      waterEntries: Array.from(waterMap.values()),
      steps: Math.max(local.steps || 0, serverSteps || 0),
      isSubmitted: Boolean(local.isSubmitted),
      submittedAt: local.submittedAt,
      goalCompletionPct: local.goalCompletionPct,
      updatedAt: new Date().toISOString(),
    };

    this.saveDayData(resolvedUser, merged);
    return merged;
  },

  // Key for permanent User Profile
  getProfileKey(userId?: string): string {
    const resolvedUser = this.resolveUserId(userId);
    return `${STORAGE_PREFIX}${resolvedUser}_user_profile`;
  },

  // Save user profile permanently to device storage
  saveProfile(userId: string, profile: Profile): void {
    if (typeof window === 'undefined') return;
    try {
      const resolvedUser = this.resolveUserId(userId);
      localStorage.setItem(this.getProfileKey(resolvedUser), JSON.stringify(profile));
      localStorage.setItem('nutritrack_current_profile', JSON.stringify(profile));
    } catch (e) {
      console.warn('clientStorage.saveProfile error:', e);
    }
  },

  // Load user profile from device storage
  getProfile(userId?: string): Profile | null {
    if (typeof window === 'undefined') return null;
    try {
      if (userId) {
        const resolvedUser = this.resolveUserId(userId);
        const raw = localStorage.getItem(this.getProfileKey(resolvedUser));
        if (raw) return JSON.parse(raw);
      }
      const activeRaw = this._activeUserId ? localStorage.getItem(this.getProfileKey(this._activeUserId)) : null;
      if (activeRaw) return JSON.parse(activeRaw);

      const fallback = localStorage.getItem('nutritrack_current_profile');
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  },
};
