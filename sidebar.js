/**
 * Sidebar Navigation Controller (sidebar.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Organized into 3 clean groups:
 * - DAILY FLOW: Dashboard, Focus Timer, Daily Routine, Calendar
 * - EXAM PREP: Subjects & Syllabus, Revision Queue, Mock Logbook, Exam Radar
 * - GROWTH & SYNC: Skill Tracker, Leaderboard, Drive Notes, My Profile
 */

import { switchView, normalizeViewName } from './router.js';
import { isUserAuthenticated } from './auth-guard.js';

export const GUEST_LOCAL_VIEWS = ['dashboard', 'timer', 'routine', 'calendar', 'mock-logbook'];
export const GUEST_DEMO_VIEWS = ['profile'];
export const GUEST_SYNC_LOCKED_VIEWS = ['leaderboard'];
export const GUEST_LOCKED_VIEWS = ['syllabus', 'revision', 'radar', 'skills', 'notes'];

export const SIDEBAR_GROUPS = [
  {
    id: 'daily-flow',
    label: 'DAILY FLOW',
    items: [
      { id: 'dashboard', name: 'Dashboard', href: '#dashboard', targetView: 'dashboard', guestAccess: 'full', tooltip: 'Dashboard & Overview' },
      { id: 'timer', name: 'Focus Timer', href: '#timer', targetView: 'timer', guestAccess: 'full', tooltip: 'Focus Timer & Deep Work' },
      { id: 'routine', name: 'Daily Routine', href: '#routine', targetView: 'routine', guestAccess: 'full', tooltip: 'Daily Study Routine' },
      { id: 'calendar', name: 'Calendar', href: '#calendar', targetView: 'calendar', guestAccess: 'full', tooltip: 'Academic Calendar' }
    ]
  },
  {
    id: 'exam-prep',
    label: 'EXAM PREP',
    items: [
      { id: 'syllabus', name: 'Subjects & Syllabus', href: '#syllabus', targetView: 'syllabus', isProtected: true, guestAccess: 'locked', guestBadge: '🔒', tooltip: 'Course Syllabus & Subjects' },
      { id: 'revision', name: 'Revision Queue', href: '#revision', targetView: 'revision', isProtected: true, guestAccess: 'locked', guestBadge: '🔒', tooltip: 'Spaced Repetition Queue' },
      { id: 'mock-logbook', name: 'Mock Logbook', href: '#mock-logbook', targetView: 'mock-logbook', guestAccess: 'full', tooltip: 'Mock Test & Mistake Logbook' },
      { id: 'radar', name: 'Exam Radar', href: '#radar', targetView: 'radar', isProtected: true, guestAccess: 'locked', guestBadge: '🔒', tooltip: 'Exam Radar & Deadlines' }
    ]
  },
  {
    id: 'growth-sync',
    label: 'GROWTH & SYNC',
    items: [
      { id: 'skills', name: 'Skill Tracker', href: '#skills', targetView: 'skills', isProtected: true, guestAccess: 'locked', guestBadge: '🔒', tooltip: 'Skill Tracker & Mastery' },
      { id: 'leaderboard', name: 'Leaderboard', href: '#leaderboard', targetView: 'leaderboard', guestAccess: 'sync-locked', requiresAuthForSync: true, guestBadge: '🔒', tooltip: 'Real-Time Student Leaderboard (Sign in to sync)' },
      { id: 'notes', name: 'Drive Notes', href: '#notes', targetView: 'notes', isProtected: true, guestAccess: 'locked', guestBadge: '🔒', tooltip: 'Google Drive Notes Vault' },
      { id: 'profile', name: 'My Profile', href: '#profile', targetView: 'profile', guestAccess: 'demo', guestBadge: 'Demo', tooltip: 'My Student Profile & ID Card' }
    ]
  }
];

export const SIDEBAR_ITEMS = SIDEBAR_GROUPS.flatMap((g) => g.items);

/**
 * Computes the role-based guest access metadata for any sidebar item.
 * - Basic local tools (Dashboard, Focus Timer, Daily Routine, Calendar, Mock Logbook) are fully accessible.
 * - My Profile is accessible in read-only Demo Preview mode and marked with a "Demo" badge.
 * - Leaderboard displays a minimal 🔒 icon for sync gating while allowing read-only browsing.
 * - Drive Notes & protected cloud tabs display a minimal 🔒 icon and gate behind Google Sign-In.
 *
 * @param {string|Object} itemOrId
 * @param {boolean} [authed]
 * @returns {{ accessible: boolean, isLocked: boolean, isSyncLocked: boolean, isDemoPreview: boolean, badge: string|null }}
 */
export function getSidebarGuestState(itemOrId, authed = isUserAuthenticated()) {
  const item = typeof itemOrId === 'string'
    ? SIDEBAR_ITEMS.find((i) => i.id === itemOrId) || { id: itemOrId }
    : (itemOrId || {});

  if (authed) {
    return {
      accessible: true,
      isLocked: false,
      isSyncLocked: false,
      isDemoPreview: false,
      badge: null
    };
  }

  const id = item.id || item.targetView;
  if (id === 'profile' || item.guestAccess === 'demo') {
    return {
      accessible: true,
      isLocked: false,
      isSyncLocked: false,
      isDemoPreview: true,
      badge: 'Demo'
    };
  }

  if (id === 'leaderboard' || item.guestAccess === 'sync-locked' || item.requiresAuthForSync) {
    return {
      accessible: true,
      isLocked: false,
      isSyncLocked: true,
      isDemoPreview: false,
      badge: '🔒'
    };
  }

  if (item.isProtected || GUEST_LOCKED_VIEWS.includes(id)) {
    return {
      accessible: false,
      isLocked: true,
      isSyncLocked: true,
      isDemoPreview: false,
      badge: '🔒'
    };
  }

  return {
    accessible: true,
    isLocked: false,
    isSyncLocked: false,
    isDemoPreview: false,
    badge: null
  };
}

/**
 * Synchronizes guest badge attributes (`data-guest-state`, `data-guest-badge`) on sidebar items.
 */
export function syncSidebarGuestBadges(container = typeof document !== 'undefined' ? document : null, authed = isUserAuthenticated()) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  const triggers = container.querySelectorAll('[data-target-view]');
  triggers.forEach((el) => {
    const viewId = el.getAttribute('data-target-view');
    const state = getSidebarGuestState(viewId, authed);
    el.setAttribute('data-guest-state', authed ? 'authenticated' : (state.isDemoPreview ? 'demo' : (state.isLocked ? 'locked' : (state.isSyncLocked ? 'sync-locked' : 'local'))));
    if (state.badge) {
      el.setAttribute('data-guest-badge', state.badge);
    } else {
      el.removeAttribute('data-guest-badge');
    }
  });
}

export function setupSidebarNav(container = document) {
  if (typeof container === 'undefined' || !container.querySelectorAll) return;

  const triggers = container.querySelectorAll('[data-target-view]');
  triggers.forEach((btn) => {
    if (btn._spaBound) return;
    btn._spaBound = true;

    btn.addEventListener('click', (e) => {
      const targetView = btn.getAttribute('data-target-view');
      if (targetView) {
        e.preventDefault();
        switchView(targetView);
      }
    });
  });
}

export function updateActiveSidebarItem(activeView) {
  if (typeof document === 'undefined') return;
  const canonical = normalizeViewName(activeView);
  const items = document.querySelectorAll('[data-target-view]');
  items.forEach((item) => {
    const view = item.getAttribute('data-target-view');
    if (view === canonical) {
      item.classList.add('is-active', 'active-sidebar-item');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('is-active', 'active-sidebar-item');
      item.removeAttribute('aria-current');
    }
  });
}

export default {
  GUEST_LOCAL_VIEWS,
  GUEST_DEMO_VIEWS,
  GUEST_SYNC_LOCKED_VIEWS,
  GUEST_LOCKED_VIEWS,
  SIDEBAR_GROUPS,
  SIDEBAR_ITEMS,
  getSidebarGuestState,
  syncSidebarGuestBadges,
  setupSidebarNav,
  updateActiveSidebarItem
};
