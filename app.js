/**
 * Main Application Entry & Lifecycle Controller (app.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Root Application Hydration & New-Day Detection
 * 2. Automated End-of-Day Rollover & Daily Routine Cleanup
 * 3. Two-Way Syllabus Completion Sync & Unfinished Task Carryover
 */

import { getActiveUserId, isDemoUser, isUserAuthenticated, syncHeaderAuthControls, getLocalDateString } from './auth-guard.js';
import { 
  getUserData, 
  handleEndOfDayRollover, 
  checkAndTriggerEndOfDayRollover, 
  patchUserData 
} from './storage-helper.js';
import { applySelectedTheme } from './src/components/tabs/DashboardTab.jsx';
import { switchView, navigateTo, getCurrentView, initRouter, VIEW_IDS } from './router.js';
import {
  SIDEBAR_ITEMS,
  GUEST_LOCAL_VIEWS,
  GUEST_DEMO_VIEWS,
  GUEST_SYNC_LOCKED_VIEWS,
  GUEST_LOCKED_VIEWS,
  getSidebarGuestState,
  syncSidebarGuestBadges,
  setupSidebarNav,
  setupMobileSidebar,
  openMobileSidebar,
  closeMobileSidebar,
  toggleMobileSidebar,
  isMobileSidebarOpen,
  updateActiveSidebarItem
} from './sidebar.js';
import { TELEMETRY_URL } from './admin-config.js';
import {
  canSyncToLeaderboard,
  startLivePresenceHeartbeat,
  stopLivePresenceHeartbeat,
  isLivePresenceHeartbeatRunning,
  syncStudentToLeaderboard,
  fetchLeaderboard,
  filterLeaderboardEntries
} from './leaderboard.js';
import {
  getProfileAccessState,
  applyProfileDemoMode
} from './profile.js';
import {
  purgeExpiredExamDeadlines,
  filterActiveExamDeadlines,
  isExamExpired,
  getDaysUntilExam,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
} from './exam-radar.js';
import {
  encryptPayload,
  decryptPayload,
  saveEncryptedStorageItem,
  loadEncryptedStorageItem,
  encryptSensitiveFieldsForSync,
  decryptSensitiveFieldsFromSync,
  migrateSensitiveLocalStorageToVault
} from './crypto-vault.js';
import {
  hasAppPin,
  isAppLocked,
  startIdleAutoLock,
  stopIdleAutoLock,
  isIdleAutoLockRunning,
  IDLE_AUTO_LOCK_MS,
  exportEncryptedVaultBackup
} from './security-privacy.js';

export {
  isUserAuthenticated,
  syncHeaderAuthControls,
  getProfileAccessState,
  applyProfileDemoMode,
  canSyncToLeaderboard,
  GUEST_LOCAL_VIEWS,
  GUEST_DEMO_VIEWS,
  GUEST_SYNC_LOCKED_VIEWS,
  GUEST_LOCKED_VIEWS,
  getSidebarGuestState,
  syncSidebarGuestBadges,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover,
  applySelectedTheme,
  switchView,
  navigateTo,
  getCurrentView,
  initRouter,
  VIEW_IDS,
  SIDEBAR_ITEMS,
  setupSidebarNav,
  setupMobileSidebar,
  openMobileSidebar,
  closeMobileSidebar,
  toggleMobileSidebar,
  isMobileSidebarOpen,
  updateActiveSidebarItem,
  startLivePresenceHeartbeat,
  stopLivePresenceHeartbeat,
  isLivePresenceHeartbeatRunning,
  syncStudentToLeaderboard,
  fetchLeaderboard,
  filterLeaderboardEntries,
  purgeExpiredExamDeadlines,
  filterActiveExamDeadlines,
  isExamExpired,
  getDaysUntilExam,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler,
  encryptPayload,
  decryptPayload,
  saveEncryptedStorageItem,
  loadEncryptedStorageItem,
  encryptSensitiveFieldsForSync,
  decryptSensitiveFieldsFromSync,
  migrateSensitiveLocalStorageToVault,
  startIdleAutoLock,
  stopIdleAutoLock,
  isIdleAutoLockRunning,
  IDLE_AUTO_LOCK_MS,
  exportEncryptedVaultBackup
};

/**
 * Applies role-based guest feature gating across #view-profile and the sidebar.
 */
export function applyGuestAccessGating(authUserProfile = undefined) {
  const authed = isUserAuthenticated(authUserProfile);
  try {
    applyProfileDemoMode(null, authUserProfile);
    syncSidebarGuestBadges(typeof document !== 'undefined' ? document : null, authed);
    syncHeaderAuthControls(typeof document !== 'undefined' ? document : null, authUserProfile);
  } catch (err) {
    console.warn('Non-fatal guest access gating sync warning:', err);
  }
  return { isAuthenticated: authed, isGuestDemo: !authed };
}

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

    try {
      initRouter();
      setupSidebarNav();
      applyGuestAccessGating();

      const handleAuthOrViewGateSync = () => {
        applyGuestAccessGating();
      };
      window.addEventListener('studyflow-auth-changed', handleAuthOrViewGateSync);
      window.addEventListener('studyflow-view-changed', handleAuthOrViewGateSync);
    } catch (err) {
      console.warn('Error during router setup in app.js:', err);
    }

    // Auto-purge expired exam deadlines on initial page load, view switches, and midnight interval
    try {
      purgeExpiredExamDeadlines();
      startMidnightExamPurgeScheduler();

      const handleExamPurgeOnViewSwitch = (e) => {
        const view = String(e?.detail?.view || getCurrentView() || '').toLowerCase();
        if (view === 'radar' || view === 'exam-radar' || view === 'dashboard') {
          purgeExpiredExamDeadlines();
        }
      };
      window.addEventListener('studyflow-view-changed', handleExamPurgeOnViewSwitch);
      window.addEventListener('hashchange', handleExamPurgeOnViewSwitch);
    } catch (err) {
      console.warn('Error initializing expired exam deadline auto-purge in app.js:', err);
    }

    // Initialize 15-minute Idle Auto-Lock watcher when SHA-256 App PIN Lock is enabled
    // and migrate legacy sensitive localStorage entries to AES-256-GCM encrypted vault mirrors
    try {
      if (hasAppPin() && !isAppLocked()) {
        startIdleAutoLock(IDLE_AUTO_LOCK_MS);
      }
      migrateSensitiveLocalStorageToVault().catch(() => {});
    } catch (err) {
      console.warn('Error initializing crypto vault or idle auto-lock in app.js:', err);
    }

    // Resume Focus Timer 3-minute Live Presence Heartbeat ONLY for Google-authenticated users
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('is_timer_running') === 'true') {
        const endTime = Number(localStorage.getItem('focus_timer_end') || 0);
        if (endTime > Date.now() && isUserAuthenticated()) {
          startLivePresenceHeartbeat(TELEMETRY_URL, () => {
            const uid = getActiveUserId();
            const userData = uid && uid !== 'guest' ? getUserData(uid) : {};
            const activeSubject = localStorage.getItem('focus_timer_subject') || userData?.subjects?.[0]?.name || 'General Studies';
            return { ...userData, activeSubject };
          });
        } else {
          stopLivePresenceHeartbeat({ sendIdlePing: false });
        }
      }
    } catch (err) {
      console.warn('Error checking live presence heartbeat on load in app.js:', err);
    }
  });
}

export default {
  initAppHydration,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover
};

