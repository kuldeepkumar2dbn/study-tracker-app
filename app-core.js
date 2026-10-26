/**
 * Central Shared Application Core (app-core.js)
 * StudyFlow Multi-Page Architecture
 * 
 * Provides:
 * - Persistent Application Layout & Navigation
 * - LocalStorage CRUD Handlers & State Persistence
 * - Google Drive API v3 (GIS) Integration & Sync Logic
 * - Streak Calculation & Rollover Handlers
 * - Modular Component Helpers
 */

export * from './src/components/AppShell.jsx';
export * from './src/services/googleDrive.js';
export * from './auth-guard.js';
export { soundEngine } from './src/utils/audio.js';

import { getUserStorageKey } from './auth-guard.js';

export const STORAGE_PREFIX = 'studyflow_data_';

/**
 * LocalStorage CRUD Handlers (Scoped by authenticated user.sub)
 */
export function getStorageData(key, fallback = null) {
  try {
    const scopedKey = getUserStorageKey(key);
    const raw = localStorage.getItem(scopedKey);
    if (raw !== null) {
      return JSON.parse(raw);
    }
    // Backward-compatible fallback for un-namespaced keys
    const legacyRaw = localStorage.getItem(STORAGE_PREFIX + key);
    return legacyRaw ? JSON.parse(legacyRaw) : fallback;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

export function setStorageData(key, value) {
  try {
    const scopedKey = getUserStorageKey(key);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

export function removeStorageData(key) {
  try {
    const scopedKey = getUserStorageKey(key);
    localStorage.removeItem(scopedKey);
  } catch (err) {
    console.error(`Error removing ${key} from storage:`, err);
  }
}

/**
 * Academic Date & Countdown Helpers
 */
export function getDaysRemaining(targetIso) {
  const target = new Date(targetIso).getTime();
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Timezone-Safe Local Date Formatter
 * Formats a Date object or date string into YYYY-MM-DD in local system time,
 * preventing UTC 1-day shift bugs in positive UTC timezones (e.g. IST UTC+5:30).
 */
export function getLocalDateString(date = new Date()) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Live Streak Calculation
 */
export function calculateStreak(routineSlots = [], currentStreak = 0, lastActiveDate = '') {
  const today = getLocalDateString(new Date());
  const allCompleted = routineSlots.length > 0 && routineSlots.every(s => s.completed);

  if (lastActiveDate !== today && allCompleted) {
    return {
      streakCount: currentStreak + 1,
      lastActiveDate: today
    };
  }

  return {
    streakCount: currentStreak,
    lastActiveDate
  };
}
