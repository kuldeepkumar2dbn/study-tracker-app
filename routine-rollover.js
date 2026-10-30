/**
 * Routine Rollover & Backlog Carryover Manager (routine-rollover.js)
 * StudyFlow Zero-Backend Architecture
 *
 * SPECIFICATIONS:
 * 1. DATA LAYER:
 *    - When carrying over uncompleted tasks (!block.completed):
 *      * Set block.carriedOver = true.
 *      * Store the original date: block.carriedFromDate = lastActiveDate.
 * 2. END-OF-DAY ROLLOVER:
 *    - Purges completed routine blocks.
 *    - Verifies syllabus topic completion for completed blocks.
 *    - Carries over uncompleted tasks with carriedOver and carriedFromDate.
 *    - Merges tomorrowPlan items scheduled for <= todayStr.
 *    - Resets todayLoggedHours = 0.0 while preserving streak and dailyActivity.
 * 3. COMPLETION BEHAVIOR:
 *    - Cleans up carriedOver flag upon task completion so history has no stale badges.
 */

import { getActiveUserId, getLocalDateString } from './auth-guard.js';
import { 
  handleEndOfDayRollover as storageHandleRollover,
  checkAndTriggerEndOfDayRollover as storageCheckRollover,
  getUserData,
  patchUserData
} from './storage-helper.js';
import { completeRoutineTaskWithSyllabusSync } from './src/utils/routineSyllabusSync.js';

/**
 * Transforms uncompleted tasks to carried-over backlog items
 *
 * @param {Array} routine Array of routine blocks
 * @param {string} lastActiveDate Date the task was carried from (YYYY-MM-DD)
 * @returns {Array} Uncompleted blocks tagged with carriedOver and carriedFromDate
 */
export function carryOverUncompletedTasks(routine = [], lastActiveDate = null) {
  if (!Array.isArray(routine)) return [];
  const fromDate = lastActiveDate || getLocalDateString(new Date());

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

/**
 * Executes full end-of-day rollover and cleanup
 */
export function handleEndOfDayRollover(userId, customTodayStr = null) {
  return storageHandleRollover(userId, customTodayStr);
}

/**
 * Checks if a new day has arrived and triggers rollover if needed
 */
export function checkAndTriggerEndOfDayRollover(userId, customTodayStr = null) {
  return storageCheckRollover(userId, customTodayStr);
}

/**
 * Completes a routine task, synchronizes syllabus completion if linked,
 * and cleans up the carriedOver flag so archived history does not carry stale badges.
 */
export function completeRoutineTask({
  routine = [],
  subjects = [],
  completedToday = [],
  slotId = null,
  userId = null
}) {
  return completeRoutineTaskWithSyllabusSync({
    routine,
    subjects,
    completedToday,
    slotId,
    userId
  });
}

export default {
  carryOverUncompletedTasks,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover,
  completeRoutineTask
};

