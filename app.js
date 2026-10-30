/**
 * Main Application Entry & Lifecycle Controller (app.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Root Application Hydration & New-Day Detection
 * 2. Automated End-of-Day Rollover & Daily Routine Cleanup
 * 3. Two-Way Syllabus Completion Sync & Unfinished Task Carryover
 */

import { getActiveUserId, isDemoUser, getLocalDateString } from './auth-guard.js';
import { 
  getUserData, 
  handleEndOfDayRollover, 
  checkAndTriggerEndOfDayRollover, 
  patchUserData 
} from './storage-helper.js';

export {
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover
};

/**
 * Executes root app hydration check:
 * Compares todayStr (YYYY-MM-DD in local time) against userData.lastActiveDate.
 * If todayStr > userData.lastActiveDate, executes handleEndOfDayRollover(userId).
 *
 * @param {string} [userId]
 * @param {string} [customTodayStr]
 * @returns {Object}
 */
export function initAppHydration(userId = null, customTodayStr = null) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') {
    return { hydrated: false, rolledOver: false, reason: 'guest_user' };
  }

  const todayStr = customTodayStr || getLocalDateString(new Date());
  const userData = getUserData(targetUserId);

  let rolloverResult = null;
  const lastActive = userData.lastActiveDate;

  // Compare todayStr against userData.lastActiveDate
  if (!lastActive || todayStr > lastActive) {
    rolloverResult = handleEndOfDayRollover(targetUserId, todayStr);
  }

  return {
    hydrated: true,
    rolledOver: Boolean(rolloverResult && rolloverResult.rolledOver),
    rolloverResult,
    todayStr,
    userId: targetUserId
  };
}

// Automatically run hydration check when loaded in browser window
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      if (!isDemoUser()) {
        initAppHydration();
      }
    } catch (err) {
      console.warn('Error during app.js hydration check:', err);
    }
  });
}

export default {
  initAppHydration,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover
};

