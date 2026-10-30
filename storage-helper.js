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
import { getActiveUserId, isDemoUser, getLocalDateString } from './auth-guard.js';

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

/**
 * Calculates a subject's overall completion percentage based on its chapters and sub-topics.
 */
function calculateSubjectPercentage(topics = []) {
  if (!topics || topics.length === 0) return 0;
  let totalItems = 0;
  let earnedScore = 0;

  topics.forEach(t => {
    if (t.subtopics && t.subtopics.length > 0) {
      t.subtopics.forEach(st => {
        totalItems += 1;
        if (st.status === 'Mastered' || st.completed) earnedScore += 100;
        else if (st.status === 'In Progress') earnedScore += 50;
      });
    } else {
      totalItems += 1;
      if (t.status === 'Mastered' || t.completed) earnedScore += 100;
      else if (t.status === 'In Progress') earnedScore += 50;
    }
  });

  return totalItems > 0 ? Math.round(earnedScore / totalItems) : 0;
}

/**
 * AUTOMATED END-OF-DAY ROLLOVER & CLEANUP ENGINE
 *
 * SPECIFICATIONS:
 * 1. MIDNIGHT / NEW-DAY DETECTOR:
 *    - Compares todayStr (YYYY-MM-DD in local time) against userData.lastActiveDate.
 *    - If todayStr > userData.lastActiveDate: executes handleEndOfDayRollover(userId).
 * 2. END-OF-DAY CLEANUP LOGIC:
 *    - Identifies all completed routine blocks (block.completed === true).
 *    - Verifies that all completed items linked to a syllabus topic have topic.completed = true in userData.subjects.
 *    - PURGES all completed blocks from userData.routine.
 *    - KEEPS and carries over all uncompleted / remaining blocks (block.completed === false) into the new day's routine so the student's unfinished work is never lost.
 *    - Tags carried-over blocks with a subtle badge or note: "Carried over from yesterday".
 * 3. TOMORROW PLANNER MERGE:
 *    - Merges all items from userData.tomorrowPlan where scheduledDate <= todayStr into userData.routine.
 *    - Removes merged items from userData.tomorrowPlan.
 * 4. COUNTER & STATS RESET:
 *    - Resets userData.todayLoggedHours = 0.0 for the fresh day.
 *    - Does NOT wipe userData.streak or clear the userData.dailyActivity heatmap history.
 *    - Updates userData.lastActiveDate = todayStr.
 *    - Saves changes via patchUserData and syncs to Google Drive.
 *
 * @param {string} userId
 * @param {string} [customTodayStr] Optional simulation date string (YYYY-MM-DD)
 * @returns {Object}
 */
export function carryOverUncompletedTasks(routine = [], lastActiveDate = null) {
  if (!Array.isArray(routine)) return [];
  const fromDate = lastActiveDate || (typeof getLocalDateString === 'function' ? getLocalDateString(new Date()) : new Date().toLocaleDateString('en-CA'));
  return routine
    .filter(block => block && block.completed !== true)
    .map(block => ({
      ...block,
      completed: false,
      carriedOver: true,
      carriedFromDate: block.carriedFromDate || fromDate,
      carriedOverNote: "Carried over from yesterday"
    }));
}

export function handleEndOfDayRollover(userId, customTodayStr = null) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') {
    return { rolledOver: false, reason: 'guest_user' };
  }

  const todayStr = customTodayStr || (typeof getLocalDateString === 'function' ? getLocalDateString(new Date()) : new Date().toLocaleDateString('en-CA'));
  const userData = getUserData(targetUserId);

  const routine = Array.isArray(userData.routine) ? userData.routine : [];
  const subjects = Array.isArray(userData.subjects) ? userData.subjects : [];
  const tomorrowPlan = Array.isArray(userData.tomorrowPlan) ? userData.tomorrowPlan : [];

  // 1. Identify completed routine blocks & uncompleted routine blocks
  const completedBlocks = routine.filter(b => b && b.completed === true);
  const uncompletedBlocks = routine.filter(b => !b || b.completed !== true);

  // 2. Verify that all completed items linked to a syllabus topic have topic.completed = true in userData.subjects
  let updatedSubjects = subjects;
  if (completedBlocks.length > 0 && subjects.length > 0) {
    let anySubjectChanged = false;

    updatedSubjects = subjects.map(s => {
      let subjectModified = false;
      const updatedTopics = (s.topics || []).map(t => {
        let chapterModified = false;

        const matchingBlocks = completedBlocks.filter(b => {
          if (!b.syllabusLink) return false;
          const { subjectId, subjectName, chapterId, chapterName, topicId, topicName } = b.syllabusLink;
          const subMatch = (subjectId && s.id === subjectId) || (subjectName && s.name === subjectName);
          if (!subMatch) return false;
          const chapMatch = (chapterId && t.id === chapterId) || (chapterName && t.title === chapterName);
          const topMatch = (topicId && t.id === topicId) || (topicName && t.title === topicName);
          const hasSubMatch = Array.isArray(t.subtopics) && t.subtopics.some(st =>
            (topicId && st.id === topicId) || (topicName && st.title === topicName) || (topicId && st.title === topicId)
          );
          return chapMatch || topMatch || hasSubMatch;
        });

        if (matchingBlocks.length === 0) return t;

        if (Array.isArray(t.subtopics) && t.subtopics.length > 0) {
          const updatedSubtopics = t.subtopics.map(st => {
            const matchedByCompletedBlock = matchingBlocks.some(b => {
              const { topicId, topicName } = b.syllabusLink;
              return (topicId && st.id === topicId) || (topicName && st.title === topicName) || (topicId && st.title === topicId);
            });
            if (matchedByCompletedBlock && (!st.completed || st.status !== 'Mastered')) {
              chapterModified = true;
              return { ...st, completed: true, status: 'Mastered' };
            }
            return st;
          });

          if (chapterModified) {
            subjectModified = true;
            anySubjectChanged = true;
            const totalSubs = updatedSubtopics.length;
            const completedSubs = updatedSubtopics.filter(st => st.status === 'Mastered' || st.completed).length;
            const allMastered = totalSubs > 0 && completedSubs === totalSubs;
            const anyInProgress = completedSubs > 0 || updatedSubtopics.some(st => st.status === 'In Progress');
            const progressPct = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 100;

            return {
              ...t,
              completed: allMastered,
              status: allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started',
              progress: progressPct,
              percentage: progressPct,
              subtopics: updatedSubtopics
            };
          }
          return t;
        } else {
          subjectModified = true;
          anySubjectChanged = true;
          return {
            ...t,
            completed: true,
            status: 'Mastered',
            progress: 100,
            percentage: 100
          };
        }
      });

      if (subjectModified) {
        const updatedSub = { ...s, topics: updatedTopics };
        updatedSub.completionPercentage = calculateSubjectPercentage(updatedTopics);
        return updatedSub;
      }
      return s;
    });

    if (!anySubjectChanged) {
      updatedSubjects = subjects;
    }
  }

  // 3. KEEP and carry over all uncompleted / remaining blocks into the new day's routine
  // Tag carried-over blocks with carriedOver: true and carriedFromDate: lastActiveDate
  const originalDate = userData.lastActiveDate || userData.todayLogDate || null;
  const carriedOverBlocks = uncompletedBlocks.map(block => ({
    ...block,
    completed: false,
    carriedOver: true,
    carriedFromDate: block.carriedFromDate || originalDate,
    carriedOverNote: "Carried over from yesterday"
  }));

  // 4. TOMORROW PLANNER MERGE:
  // Merge all items from tomorrowPlan where scheduledDate <= todayStr into routine
  const itemsToMerge = tomorrowPlan.filter(plan => plan && plan.scheduledDate && plan.scheduledDate <= todayStr);
  const remainingTomorrowPlan = tomorrowPlan.filter(plan => !plan || !plan.scheduledDate || plan.scheduledDate > todayStr);

  const mergedTomorrowBlocks = itemsToMerge.map(plan => {
    const startTime = plan.startTime || '08:00';
    const endTime = plan.endTime || '10:00';
    const hasSyllabus = Boolean(plan.syllabusLink && (plan.syllabusLink.subjectId || plan.syllabusLink.subjectName));
    return {
      id: plan.id || ('plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
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

  // Combine carried-over blocks and merged tomorrow blocks
  const newDailyRoutine = [...carriedOverBlocks, ...mergedTomorrowBlocks];

  // 5. COUNTER & STATS RESET:
  // Reset todayLoggedHours = 0.0 for the fresh day.
  // Do NOT wipe streak or clear dailyActivity heatmap history.
  // Update lastActiveDate = todayStr.
  const patchPayload = {
    routine: newDailyRoutine,
    tomorrowPlan: remainingTomorrowPlan,
    completedRoutineToday: [],
    todayLoggedHours: 0.0,
    todayLogDate: todayStr,
    lastActiveDate: todayStr
  };

  if (updatedSubjects !== subjects) {
    patchPayload.subjects = updatedSubjects;
  }

  if (userData.streak !== undefined) {
    patchPayload.streak = userData.streak;
  }
  if (userData.dailyActivity !== undefined) {
    patchPayload.dailyActivity = userData.dailyActivity;
  }

  // 6. ATOMIC & SAFE PERSISTENCE:
  const patchedData = patchUserData(targetUserId, patchPayload);

  // Notify listeners across all views
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('studyflow-day-rollover', {
        detail: {
          userId: targetUserId,
          todayStr,
          purgedCompletedCount: completedBlocks.length,
          carriedOverCount: carriedOverBlocks.length,
          mergedTomorrowCount: mergedTomorrowBlocks.length,
          updatedRoutine: newDailyRoutine,
          remainingTomorrowPlan
        }
      }));
      window.dispatchEvent(new Event('studyflow-data-changed'));
    } catch {}
  }

  return {
    rolledOver: true,
    todayStr,
    purgedCompletedCount: completedBlocks.length,
    carriedOverCount: carriedOverBlocks.length,
    mergedTomorrowCount: mergedTomorrowBlocks.length,
    updatedRoutine: newDailyRoutine,
    remainingTomorrowPlan,
    updatedSubjects,
    patchedData
  };
}

/**
 * Checks if a new day has arrived (todayStr > userData.lastActiveDate).
 * If so, triggers handleEndOfDayRollover automatically.
 *
 * @param {string} userId
 * @param {string} [customTodayStr]
 * @returns {Object}
 */
export function checkAndTriggerEndOfDayRollover(userId, customTodayStr = null) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') {
    return { rolledOver: false, reason: 'guest_user' };
  }

  const todayStr = customTodayStr || (typeof getLocalDateString === 'function' ? getLocalDateString(new Date()) : new Date().toLocaleDateString('en-CA'));
  const userData = getUserData(targetUserId);

  const lastDate = userData.lastActiveDate;
  if (!lastDate || todayStr > lastDate) {
    return handleEndOfDayRollover(targetUserId, todayStr);
  }

  return {
    rolledOver: false,
    reason: 'same_day',
    todayStr,
    lastActiveDate: lastDate
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
  autoMergeTomorrowPlans,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover,
  carryOverUncompletedTasks
};
