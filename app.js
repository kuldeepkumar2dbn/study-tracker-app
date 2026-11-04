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
import { applySelectedTheme } from './src/components/tabs/DashboardTab.jsx';

export {
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover,
  applySelectedTheme
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

// Automatically run hydration check and theme pill activation when loaded in browser window
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    try {
      const savedTheme = (typeof localStorage !== 'undefined' && (
        localStorage.getItem('studyflow_app_theme') ||
        localStorage.getItem('studyflow_theme') ||
        localStorage.getItem('theme')
      )) || 'cyberpunk';
      applySelectedTheme(savedTheme);
    } catch (err) {
      console.warn('Error during DOMContentLoaded theme activation in app.js:', err);
    }

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

