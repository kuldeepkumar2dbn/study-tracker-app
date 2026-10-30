/**
 * Centralized Storage Patch Controller & Non-Destructive State Manager
 * (storage-helper.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Enforces:
 * 1. Strict non-destructive updates & immutable state merging across the entire app
 * 2. Editing any section never wipes existing streaks, study hours, or activity logs
 * 3. Atomic patch controller: patchUserData(userId, updates)
 * 4. Merging nested records like dailyActivity and settings defensively
 * 5. Passes complete merged object to Google Drive background sync (debounceSaveToDrive)
 */

import { debounceSaveToDrive, populateGranularStorage } from './cloud-sync.js';
import { getActiveUserId, isDemoUser } from './auth-guard.js';

/**
 * Reads the full current dataset for a user from LocalStorage
 * @param {string} userId Unique user identifier
 * @returns {Object} Complete current user dataset or empty object
 */
export function getUserData(userId) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') return {};

  const storageKey = `studyflow_${targetUserId}_data`;
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn(`Error reading user data for ${targetUserId}:`, err);
    return {};
  }
}

/**
 * Merges updates into existing user data defensively using immutable object spreading.
 * - Merges nested records (e.g. dailyActivity, settings) instead of overwriting.
 * - Preserves streak unless explicitly updated.
 * - Preserves todayLoggedHours unless explicitly updated.
 * - Updates the updatedAt timestamp.
 *
 * @param {Object} existing Existing user data
 * @param {Object} updates Partial updates to apply
 * @returns {Object} Immutably merged dataset
 */
export function mergeUserData(existing = {}, updates = {}) {
  const existingActivity = (existing && typeof existing.dailyActivity === 'object') ? existing.dailyActivity : {};
  const updatesActivity = (updates && typeof updates.dailyActivity === 'object') ? updates.dailyActivity : {};

  // 1. Ensure nested dailyActivity is merged, not overwritten
  const mergedDailyActivity = {
    ...existingActivity,
    ...updatesActivity
  };

  // If both have dailyActivity, ensure max minutes for matching dates
  if (existing.dailyActivity && updates.dailyActivity) {
    for (const [date, mins] of Object.entries(updates.dailyActivity)) {
      mergedDailyActivity[date] = Math.max(
        Number(existingActivity[date] || 0),
        Number(mins || 0)
      );
    }
  }

  // 2. Preserve streak unless explicitly defined in updates
  const resolvedStreak = updates.streak !== undefined 
    ? updates.streak 
    : (existing.streak ?? (existing.streakCount ?? 0));

  // 3. Preserve todayLoggedHours unless explicitly defined in updates
  const resolvedTodayHours = updates.todayLoggedHours !== undefined 
    ? updates.todayLoggedHours 
    : (existing.todayLoggedHours ?? (existing.todayHours ?? 0.0));

  const updated = {
    ...existing,
    ...updates,
    dailyActivity: mergedDailyActivity,
    streak: resolvedStreak,
    todayLoggedHours: resolvedTodayHours,
    updatedAt: updates.updatedAt || new Date().toISOString()
  };

  // Guard against accidental undefined values wiping existing section arrays
  if (updates.subjects === undefined && existing.subjects) updated.subjects = existing.subjects;
  if (updates.routine === undefined && existing.routine) updated.routine = existing.routine;
  if (updates.tomorrowPlan === undefined && existing.tomorrowPlan) updated.tomorrowPlan = existing.tomorrowPlan;
  if (updates.completedRoutineToday === undefined && existing.completedRoutineToday) updated.completedRoutineToday = existing.completedRoutineToday;
  if (updates.skills === undefined && existing.skills) updated.skills = existing.skills;
  if (updates.exams === undefined && existing.exams) updated.exams = existing.exams;
  if (updates.notes === undefined && existing.notes) updated.notes = existing.notes;
  if (updates.weeklyGoals === undefined && existing.weeklyGoals) updated.weeklyGoals = existing.weeklyGoals;
  if (updates.importantLinks === undefined && existing.importantLinks) updated.importantLinks = existing.importantLinks;

  return updated;
}

/**
 * CENTRALIZED PATCH CONTROLLER
 *
 * - Reads full current dataset from localStorage.getItem(`studyflow_${userId}_data`)
 * - Merges fields using defensive object spreading:
 *   const existing = JSON.parse(localStorage.getItem(`studyflow_${userId}_data`) || "{}");
 *   const updated = {
 *     ...existing,
 *     ...updates,
 *     dailyActivity: {
 *       ...(existing.dailyActivity || {}),
 *       ...(updates.dailyActivity || {})
 *     },
 *     streak: updates.streak !== undefined ? updates.streak : (existing.streak ?? 0),
 *     todayLoggedHours: updates.todayLoggedHours !== undefined ? updates.todayLoggedHours : (existing.todayLoggedHours ?? 0),
 *     updatedAt: new Date().toISOString()
 *   };
 *   localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify(updated));
 * - Passes complete merged object to Google Drive background sync (debounceSaveToDrive(updated))
 *
 * @param {string} userId User ID (falls back to getActiveUserId())
 * @param {Object} updates Partial updates (e.g. { routine: newRoutine })
 * @returns {Object} Complete merged and persisted user dataset
 */
export function patchUserData(userId, updates = {}) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') {
    return null;
  }

  const storageKey = `studyflow_${targetUserId}_data`;
  let existing = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (raw) existing = JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`Error reading existing data before patch for ${targetUserId}:`, err);
  }

  const updated = mergeUserData(existing, updates);
  updated.userId = targetUserId;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (err) {
    console.error(`Error saving patched data to ${storageKey}:`, err);
  }

  // Populate granular scoped storage keys so any components reading them directly stay in sync
  try {
    populateGranularStorage(targetUserId, updated);
  } catch (err) {
    console.warn('Error populating granular storage after patch:', err);
  }

  // Dispatch events to notify UI across all tabs
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow-data-patched', {
        detail: { userId: targetUserId, updates, data: updated }
      }));
      window.dispatchEvent(new Event('studyflow-data-changed'));
      window.dispatchEvent(new Event('storage'));
      if (updates.dailyActivity) {
        window.dispatchEvent(new CustomEvent('studyflow-activity-updated', {
          detail: { dailyActivity: updated.dailyActivity }
        }));
      }
    }
  } catch (err) {
    console.warn('Error dispatching patch events:', err);
  }

  // Pass complete merged object to Google Drive background sync
  if (!isDemoUser() && targetUserId !== 'demo_sandbox_user') {
    try {
      debounceSaveToDrive(updated);
    } catch (err) {
      console.warn('Error triggering debounceSaveToDrive from patchUserData:', err);
    }
  }

  return updated;
}

// Section-specific convenience helpers
export function saveRoutine(userId, newRoutine) {
  return patchUserData(userId, { routine: newRoutine });
}

export function saveSubjects(userId, newSubjects) {
  return patchUserData(userId, { subjects: newSubjects });
}

export function saveSkills(userId, newSkills) {
  return patchUserData(userId, { skills: newSkills });
}

export function saveExams(userId, newExams) {
  return patchUserData(userId, { exams: newExams });
}

export function saveNotes(userId, newNotes) {
  return patchUserData(userId, { notes: newNotes });
}

export function saveTomorrowPlan(userId, newPlans) {
  return patchUserData(userId, { tomorrowPlan: newPlans });
}

export function syncRoutineSyllabusCompletion(userId, { routine, subjects, completedRoutineToday }) {
  return patchUserData(userId, {
    routine,
    subjects,
    completedRoutineToday
  });
}

/**
 * NEXT-DAY AUTO-MERGE ENGINE:
 * - On app initialization / page load across all views:
 *   * Get todayStr = new Date().toLocaleDateString('en-CA') (YYYY-MM-DD).
 *   * Check userData.tomorrowPlan || [].
 *   * Identify items where plan.scheduledDate <= todayStr.
 *   * For each matched item:
 *     - Transform it into an active routine block:
 *       { id: plan.id, title: plan.title, startTime: plan.startTime, endTime: plan.endTime, category: plan.category, syllabusLink: plan.syllabusLink, completed: false, linkType: "syllabus" }
 *     - Append it to userData.routine.
 *   * Remove the migrated items from userData.tomorrowPlan.
 *   * If any items were merged, save via patchUserData(userId, { routine: updatedRoutine, tomorrowPlan: remainingPlans }) so streaks and previous logs remain completely untouched.
 *   * Display a clean toast: "🌅 Tomorrow's planned topics have been merged into your Daily Routine for today!"
 */
export function autoMergeTomorrowPlans(userId) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') {
    return { merged: false, count: 0, updatedRoutine: [], remainingPlans: [] };
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const userData = getUserData(targetUserId);
  const tomorrowPlan = Array.isArray(userData.tomorrowPlan) ? userData.tomorrowPlan : [];

  if (tomorrowPlan.length === 0) {
    return { merged: false, count: 0, updatedRoutine: userData.routine || [], remainingPlans: [] };
  }

  const toMerge = tomorrowPlan.filter(plan => plan && plan.scheduledDate && plan.scheduledDate <= todayStr);
  if (toMerge.length === 0) {
    return { merged: false, count: 0, updatedRoutine: userData.routine || [], remainingPlans: tomorrowPlan };
  }

  const remainingPlans = tomorrowPlan.filter(plan => !plan || !plan.scheduledDate || plan.scheduledDate > todayStr);
  const existingRoutine = Array.isArray(userData.routine) ? [...userData.routine] : [];

  const newBlocks = toMerge.map(plan => {
    const startTime = plan.startTime || '08:00';
    const endTime = plan.endTime || '10:00';
    const hasSyllabus = Boolean(plan.syllabusLink && plan.syllabusLink.subjectId);
    return {
      id: plan.id || ('plan_' + Date.now()),
      title: plan.title || 'Study Session',
      startTime,
      endTime,
      timeRange: `${startTime} - ${endTime}`,
      category: plan.category || 'Core Study',
      syllabusLink: plan.syllabusLink || null,
      completed: false,
      linkType: hasSyllabus ? 'syllabus' : 'routine',
      notified: Boolean(plan.notified),
      calendarEventId: plan.calendarEventId || null
    };
  });

  const updatedRoutine = [...existingRoutine, ...newBlocks];

  patchUserData(targetUserId, {
    routine: updatedRoutine,
    tomorrowPlan: remainingPlans
  });

  // Notify listeners across all views
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('studyflow-tomorrow-plan-merged', {
        detail: {
          count: toMerge.length,
          mergedItems: toMerge,
          message: "🌅 Tomorrow's planned topics have been merged into your Daily Routine for today!"
        }
      }));
    } catch {}
  }

  return {
    merged: true,
    count: toMerge.length,
    mergedItems: toMerge,
    updatedRoutine,
    remainingPlans,
    message: "🌅 Tomorrow's planned topics have been merged into your Daily Routine for today!"
  };
}

export default {
  getUserData,
  mergeUserData,
  patchUserData,
  saveRoutine,
  saveSubjects,
  saveSkills,
  saveExams,
  saveNotes,
  saveTomorrowPlan,
  syncRoutineSyllabusCompletion,
  autoMergeTomorrowPlans
};
