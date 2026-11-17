/**
 * Exam Radar Auto-Purge & Countdown Engine (exam-radar.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Implements:
 * 1. Timezone-safe local-midnight date comparison (`examDate >= todayMidnight`)
 * 2. `purgeExpiredExamDeadlines()`: permanently removes exams whose date < todayMidnight
 *    from localStorage and syncs cleaned array via `patchUserData` to Google Drive
 * 3. Automatic midnight check scheduler (`startMidnightExamPurgeScheduler`)
 * 4. Exact local day countdown helper (`getDaysUntilExam`) supporting `Today / 0d remaining`
 */

import { patchUserData, getUserData } from './storage-helper.js';
import { getActiveUserId, getUserStorageKey, isDemoUser } from './auth-guard.js';

export const MIDNIGHT_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds for midnight rollover

/**
 * Returns today's local midnight Date object (`today.setHours(0, 0, 0, 0)`).
 * @param {Date|string|number} [referenceDate=new Date()]
 * @returns {Date}
 */
export function getTodayLocalMidnight(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Parses an exam's target date string or Date into its local-timezone midnight Date.
 * Avoids UTC 1-day shift on date-only strings like "2026-11-18".
 *
 * @param {string|Date|number} dateInput
 * @returns {Date|null}
 */
export function parseExamDateToLocalMidnight(dateInput) {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return null;
    const d = new Date(dateInput.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Handle "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM..." directly in local calendar time
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (!Number.isNaN(localDate.getTime())) {
      return localDate;
    }
  }

  const fallback = new Date(str);
  if (Number.isNaN(fallback.getTime())) return null;
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/**
 * Returns true if the exam's date is strictly before today's local midnight (yesterday or earlier).
 * Exams happening today (`examDate >= todayMidnight`) return false (NOT expired).
 *
 * @param {Object} exam
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export function isExamExpired(exam, referenceDate = new Date()) {
  if (!exam || typeof exam !== 'object') return false;
  const examDate = parseExamDateToLocalMidnight(exam.date || exam.examDate || exam.targetDate);
  if (!examDate) return false;
  const todayMidnight = getTodayLocalMidnight(referenceDate);
  return examDate.getTime() < todayMidnight.getTime();
}

/**
 * Filters an array of exam deadlines into active (`examDate >= todayMidnight`)
 * and expired (`examDate < todayMidnight`) lists.
 *
 * @param {Array} [exams=[]]
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ activeExams: Array, expiredExams: Array, removedCount: number }}
 */
export function filterActiveExamDeadlines(exams = [], referenceDate = new Date()) {
  if (!Array.isArray(exams) || exams.length === 0) {
    return { activeExams: [], expiredExams: [], removedCount: 0 };
  }

  const activeExams = [];
  const expiredExams = [];

  for (const item of exams) {
    if (isExamExpired(item, referenceDate)) {
      expiredExams.push(item);
    } else {
      activeExams.push(item);
    }
  }

  return {
    activeExams,
    expiredExams,
    removedCount: expiredExams.length
  };
}

/**
 * Computes non-negative whole calendar days remaining from today's local midnight.
 * Today returns 0 (`Today / 0d remaining`), tomorrow returns 1, etc.
 *
 * @param {string|Date} dateInput
 * @param {Date} [referenceDate=new Date()]
 * @returns {number}
 */
export function getDaysUntilExam(dateInput, referenceDate = new Date()) {
  const examDate = parseExamDateToLocalMidnight(dateInput);
  if (!examDate) return 0;
  const todayMidnight = getTodayLocalMidnight(referenceDate);
  const diffDays = Math.round((examDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Reads stored exams array for the given userId (or active user) from localStorage.
 */
function readStoredExams(userId = null) {
  if (typeof localStorage === 'undefined') return [];

  const targetId = userId || (typeof getActiveUserId === 'function' ? getActiveUserId() : 'guest');

  try {
    if (typeof isDemoUser === 'function' && isDemoUser()) {
      const demoRaw = sessionStorage.getItem('demo_tracker_data_exams') || localStorage.getItem('demo_tracker_data_exams');
      if (demoRaw) {
        const parsed = JSON.parse(demoRaw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    }

    // 1. Master user document (`studyflow_${userId}_data`)
    if (targetId && targetId !== 'guest') {
      const userData = getUserData(targetId);
      if (userData && Array.isArray(userData.exams)) {
        return userData.exams;
      }
    }

    // 2. Scoped exams key (`studyflow_${userId}_exams`)
    const scopedKey = targetId ? `studyflow_${targetId}_exams` : getUserStorageKey('exams');
    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw);
      if (Array.isArray(parsed)) return parsed;
    }

    // 3. Legacy key (`studyflow_data_exams`)
    const legacyRaw = localStorage.getItem('studyflow_data_exams');
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading exams before purge:', err);
  }

  return [];
}

/**
 * Permanently purges any exam or deadline where `examDate < todayMidnight`
 * from localStorage and syncs the cleaned array via `patchUserData` to Google Drive
 * so expired items never return on reload.
 *
 * @param {Object} [options={}]
 * @param {string|null} [options.userId=null]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {Array|null} [options.examsOverride=null]
 * @returns {{ purged: boolean, removedCount: number, activeExams: Array, expiredExams: Array }}
 */
export function purgeExpiredExamDeadlines({
  userId = null,
  referenceDate = new Date(),
  examsOverride = null
} = {}) {
  const targetId = userId || (typeof getActiveUserId === 'function' ? getActiveUserId() : 'guest');
  const currentExams = Array.isArray(examsOverride) ? examsOverride : readStoredExams(targetId);
  const { activeExams, expiredExams, removedCount } = filterActiveExamDeadlines(currentExams, referenceDate);

  if (removedCount === 0) {
    return {
      purged: false,
      removedCount: 0,
      activeExams,
      expiredExams: []
    };
  }

  // Persist cleaned array back to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const serialized = JSON.stringify(activeExams);
      if (typeof isDemoUser === 'function' && isDemoUser()) {
        sessionStorage.setItem('demo_tracker_data_exams', serialized);
        localStorage.setItem('demo_tracker_data_exams', serialized);
      } else {
        const scopedKey = targetId ? `studyflow_${targetId}_exams` : getUserStorageKey('exams');
        localStorage.setItem(scopedKey, serialized);
        if (localStorage.getItem('studyflow_data_exams') !== null) {
          localStorage.setItem('studyflow_data_exams', serialized);
        }
      }
    } catch (err) {
      console.warn('Error persisting purged exams to localStorage:', err);
    }
  }

  // Sync cleaned exams array to master user record & Google Drive via patchUserData
  if (targetId && targetId !== 'guest' && !(typeof isDemoUser === 'function' && isDemoUser())) {
    try {
      patchUserData(targetId, { exams: activeExams });
    } catch (err) {
      console.warn('Error syncing purged exams via patchUserData:', err);
    }
  }

  // Notify React UI (DataContext, DashboardTab, ExamsTab) immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-exams-purged', {
      detail: { activeExams, expiredExams, removedCount, userId: targetId }
    }));
  }

  return {
    purged: true,
    removedCount,
    activeExams,
    expiredExams
  };
}

// =========================================================================
// Automatic Midnight Check Interval Scheduler
// =========================================================================
let _midnightIntervalId = null;
let _lastCheckedDayKey = '';

function getLocalDayKey(date = new Date()) {
  const d = getTodayLocalMidnight(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Starts a lightweight midnight check interval that automatically triggers
 * `purgeExpiredExamDeadlines()` whenever the local calendar date crosses midnight.
 */
export function startMidnightExamPurgeScheduler({ onPurge = null, intervalMs = MIDNIGHT_CHECK_INTERVAL_MS } = {}) {
  if (_midnightIntervalId !== null) {
    clearInterval(_midnightIntervalId);
    _midnightIntervalId = null;
  }

  _lastCheckedDayKey = getLocalDayKey();

  const checkMidnight = () => {
    const currentDayKey = getLocalDayKey();
    if (currentDayKey !== _lastCheckedDayKey) {
      _lastCheckedDayKey = currentDayKey;
      const result = purgeExpiredExamDeadlines();
      if (typeof onPurge === 'function') {
        onPurge(result);
      }
    }
  };

  _midnightIntervalId = setInterval(checkMidnight, Math.max(1000, Number(intervalMs) || MIDNIGHT_CHECK_INTERVAL_MS));
  return _midnightIntervalId;
}

export function stopMidnightExamPurgeScheduler() {
  if (_midnightIntervalId !== null) {
    clearInterval(_midnightIntervalId);
    _midnightIntervalId = null;
  }
}

if (typeof window !== 'undefined') {
  window.purgeExpiredExamDeadlines = purgeExpiredExamDeadlines;
  window.ExamRadarEngine = {
    getTodayLocalMidnight,
    parseExamDateToLocalMidnight,
    isExamExpired,
    filterActiveExamDeadlines,
    getDaysUntilExam,
    purgeExpiredExamDeadlines,
    startMidnightExamPurgeScheduler,
    stopMidnightExamPurgeScheduler
  };
}

export default {
  MIDNIGHT_CHECK_INTERVAL_MS,
  getTodayLocalMidnight,
  parseExamDateToLocalMidnight,
  isExamExpired,
  filterActiveExamDeadlines,
  getDaysUntilExam,
  purgeExpiredExamDeadlines,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
};

