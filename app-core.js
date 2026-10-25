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
export { soundEngine } from './src/utils/audio.js';

export const STORAGE_PREFIX = 'studyflow_data_';

/**
 * LocalStorage CRUD Handlers
 */
export function getStorageData(key, fallback = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return fallback;
  }
}

export function setStorageData(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

export function removeStorageData(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
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
 * Live Streak Calculation
 */
export function calculateStreak(routineSlots = [], currentStreak = 0, lastActiveDate = '') {
  const today = new Date().toISOString().split('T')[0];
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
