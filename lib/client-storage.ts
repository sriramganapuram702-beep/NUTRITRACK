'use client';

/**
 * NutriTrack Unified Client-Side Persistent Storage Engine
 * Guarantees that user food entries, water intake, steps, and daily logs
 * NEVER disappear across serverless cold starts, container restarts, or app closes.
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
  // Get storage key for a user and date
  getKey(userId: string, date: string): string {
    return `${STORAGE_PREFIX}${userId}_${date}`;
  },

  // Get index of all logged dates for user (for Calendar history forever)
  getDatesIndexKey(userId: string): string {
    return `${STORAGE_PREFIX}${userId}_dates_index`;
  },

  // Load a full day's data from phone persistent storage
  getDayData(userId: string, date: string): StoredDayData {
    if (typeof window === 'undefined') {
      return { date, foodEntries: [], waterEntries: [], steps: 0, isSubmitted: false, updatedAt: new Date().toISOString() };
    }

    try {
      const key = this.getKey(userId, date);
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('clientStorage.getDayData error:', e);
    }

    return {
      date,
      foodEntries: [],
      waterEntries: [],
      steps: 0,
      isSubmitted: false,
      updatedAt: new Date().toISOString(),
    };
  },

  // Save full day's data to phone persistent storage
  saveDayData(userId: string, data: StoredDayData): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getKey(userId, data.date);
      localStorage.setItem(key, JSON.stringify(data));

      // Update dates index for permanent Calendar tracking
      const indexKey = this.getDatesIndexKey(userId);
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
    const day = this.getDayData(userId, date);
    const existingIndex = day.foodEntries.findIndex((f) => f.id === entry.id);

    if (existingIndex >= 0) {
      day.foodEntries[existingIndex] = entry;
    } else {
      day.foodEntries.push(entry);
    }

    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Remove a food entry
  deleteFoodEntry(userId: string, date: string, entryId: string): StoredDayData {
    const day = this.getDayData(userId, date);
    day.foodEntries = day.foodEntries.filter((f) => f.id !== entryId);
    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Add a water entry
  saveWaterEntry(userId: string, date: string, entry: WaterEntry): StoredDayData {
    const day = this.getDayData(userId, date);
    const existingIndex = day.waterEntries.findIndex((w) => w.id === entry.id);

    if (existingIndex >= 0) {
      day.waterEntries[existingIndex] = entry;
    } else {
      day.waterEntries.push(entry);
    }

    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Update steps
  saveSteps(userId: string, date: string, steps: number): StoredDayData {
    const day = this.getDayData(userId, date);
    day.steps = Math.max(day.steps, steps);
    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Submit day audit
  submitDay(userId: string, date: string, goalCompletionPct: number): StoredDayData {
    const day = this.getDayData(userId, date);
    day.isSubmitted = true;
    day.submittedAt = new Date().toISOString();
    day.goalCompletionPct = goalCompletionPct;
    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Unlock day audit
  unsubmitDay(userId: string, date: string): StoredDayData {
    const day = this.getDayData(userId, date);
    day.isSubmitted = false;
    day.updatedAt = new Date().toISOString();
    this.saveDayData(userId, day);
    return day;
  },

  // Get all recorded dates for calendar history
  getAllLoggedDates(userId: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const indexKey = this.getDatesIndexKey(userId);
      const raw = localStorage.getItem(indexKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Merge server data with client persistent data
  mergeServerData(userId: string, date: string, serverEntries: FoodEntry[], serverWater: WaterEntry[], serverSteps: number): StoredDayData {
    const local = this.getDayData(userId, date);

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
      isSubmitted: local.isSubmitted,
      submittedAt: local.submittedAt,
      goalCompletionPct: local.goalCompletionPct,
      updatedAt: new Date().toISOString(),
    };

    this.saveDayData(userId, merged);
    return merged;
  },

  // Key for permanent User Profile
  getProfileKey(userId?: string): string {
    return userId ? `${STORAGE_PREFIX}${userId}_user_profile` : `${STORAGE_PREFIX}user_profile`;
  },

  // Save user profile permanently to device storage
  saveProfile(userId: string, profile: Profile): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getProfileKey(userId), JSON.stringify(profile));
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
        const raw = localStorage.getItem(this.getProfileKey(userId));
        if (raw) return JSON.parse(raw);
      }
      const fallback = localStorage.getItem('nutritrack_current_profile');
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  },
};
