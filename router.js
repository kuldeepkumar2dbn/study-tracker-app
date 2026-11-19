/**
 * Single Page Application (SPA) View Router (router.js)
 * StudyFlow Zero-Reload Smooth View Navigation Engine
 *
 * Implements:
 * 1. Zero-reload smooth view switching across .app-view containers
 * 2. 250ms CSS fade-and-slide transitions with active-view class
 * 3. Browser back/forward history synchronization via window.location.hash
 * 4. Silent telemetry reporting on feature transitions
 * 5. State preservation for timers, checkboxes, and form inputs
 */

import { logFeatureUse } from './src/utils/telemetry.js';

export const VIEW_IDS = [
  'dashboard',
  'routine',
  'calendar',
  'syllabus',
  'revision',
  'radar',
  'mock-logbook',
  'leaderboard',
  'skills',
  'notes',
  'timer',
  'profile'
];

export const FEATURE_NAME_MAP = {
  dashboard: 'Dashboard',
  routine: 'Daily Routine',
  calendar: 'Calendar',
  syllabus: 'Subjects & Syllabus',
  revision: 'Revision Queue',
  radar: 'Exam Radar',
  'mock-logbook': 'Mock Logbook',
  leaderboard: 'Leaderboard',
  skills: 'Skill Tracker',
  notes: 'Drive Notes',
  timer: 'Focus Timer',
  profile: 'My Profile'
};

const VIEW_ALIASES = {
  subjects: 'syllabus',
  exams: 'radar',
  'exam-radar': 'radar',
  mock: 'mock-logbook',
  logbook: 'mock-logbook',
  'mock-test': 'mock-logbook',
  'mock-tests': 'mock-logbook',
  'mocklogbook': 'mock-logbook',
  rankings: 'leaderboard',
  rank: 'leaderboard',
  top100: 'leaderboard',
  'my-profile': 'profile',
  'student-profile': 'profile',
  account: 'profile',
  index: 'dashboard',
  overview: 'dashboard'
};

/**
 * Normalizes any view identifier, path, or hash to a canonical view ID
 * @param {string} viewName - e.g. '#routine', '/routine.html', 'subjects', 'syllabus'
 * @returns {string} canonical view ID ('dashboard', 'routine', etc.)
 */
export function normalizeViewName(viewName) {
  if (!viewName) return 'dashboard';
  let clean = String(viewName).trim().toLowerCase()
    .replace(/^#\/?/, '')
    .replace(/^\//, '')
    .replace(/\.html$/, '');

  if (clean.includes('#')) {
    clean = clean.split('#').pop();
  }

  if (VIEW_ALIASES[clean]) {
    clean = VIEW_ALIASES[clean];
  }

  return VIEW_IDS.includes(clean) ? clean : 'dashboard';
}

/**
 * Returns the currently active view ID from location hash or default
 * @returns {string} active view ID
 */
export function getCurrentView() {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    return normalizeViewName(hash);
  }
  return 'dashboard';
}

/**
 * Switches the active view without reloading the page.
 * Hides all .app-view elements, displays the target view with .active-view,
 * updates window.location.hash, dispatches custom event, and logs silent telemetry.
 *
 * @param {string} targetView - view name or ID
 * @param {boolean} [updateHash=true] - whether to update location.hash
 * @returns {string} normalized view name
 */
export function switchView(targetView, updateHash = true) {
  const normalized = normalizeViewName(targetView);

  if (typeof document !== 'undefined') {
    // 1. Hide all .app-view elements instantly
    const allViews = document.querySelectorAll('.app-view');
    allViews.forEach((v) => {
      v.classList.remove('active-view');
    });

    // 2. Add active-view to selected target section container
    const targetEl = document.getElementById(`view-${normalized}`) || 
                     document.querySelector(`[data-view="${normalized}"]`);
    if (targetEl) {
      targetEl.classList.add('active-view');
    }

    // 3. Update sidebar active status across all data-target-view triggers
    const sidebarItems = document.querySelectorAll('[data-target-view]');
    sidebarItems.forEach((btn) => {
      const v = btn.getAttribute('data-target-view');
      if (v === normalized) {
        btn.classList.add('active-sidebar-item', 'is-active');
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.classList.remove('active-sidebar-item', 'is-active');
        btn.removeAttribute('aria-current');
      }
    });

    // 4. Update data-active-feature on outer app shell wrapper if present
    const shell = document.querySelector('[data-active-feature]');
    if (shell) {
      shell.setAttribute('data-active-feature', normalized);
    }
  }

  // 5. Update the URL hash for browser back/forward support
  if (updateHash && typeof window !== 'undefined') {
    const currentHash = window.location.hash.replace(/^#\/?/, '');
    if (currentHash !== normalized) {
      window.location.hash = normalized;
    }
  }

  // 6. Send silent telemetry ping for opened feature
  const featureName = FEATURE_NAME_MAP[normalized] || normalized;
  try {
    if (typeof logFeatureUse === 'function') {
      logFeatureUse(featureName);
    } else if (typeof window !== 'undefined' && typeof window.logFeatureUse === 'function') {
      window.logFeatureUse(featureName);
    }
  } catch (err) {
    // Silent fail
  }

  // 7. Dispatch custom event for React components and external integrations
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-view-changed', {
      detail: { view: normalized, featureName }
    }));
  }

  return normalized;
}

/**
 * Returns whether a given view container is currently visible with .active-view.
 * Used for lazy chart rendering and targeted updates.
 *
 * @param {string} viewId
 * @returns {boolean}
 */
export function isViewVisible(viewId) {
  if (typeof document === 'undefined') return true;
  const canonical = normalizeViewName(viewId);
  const el = document.getElementById(`view-${canonical}`) || document.querySelector(`[data-view="${canonical}"]`);
  if (!el) return getCurrentView() === canonical;
  return el.classList.contains('active-view');
}

export function navigateTo(targetView) {
  return switchView(targetView, true);
}

/**
 * Initializes the global SPA router:
 * - Binds hashchange & popstate events
 * - Delegates click on [data-target-view]
 * - Activates initial view from hash
 */
export function initRouter() {
  if (typeof window === 'undefined') return;

  // Global window bindings for vanilla scripts & tests
  window.switchView = switchView;
  window.navigateToView = switchView;
  window.getCurrentView = getCurrentView;
  window.isViewVisible = isViewVisible;
  window.router = {
    switchView,
    navigateTo,
    getCurrentView,
    isViewVisible,
    VIEW_IDS,
    FEATURE_NAME_MAP
  };

  const handleHashChange = () => {
    const view = getCurrentView();
    switchView(view, false);
  };

  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('popstate', handleHashChange);
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('popstate', handleHashChange);

  // Click delegation for any element with data-target-view
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest && e.target.closest('[data-target-view]');
      if (trigger) {
        const view = trigger.getAttribute('data-target-view');
        if (view) {
          e.preventDefault();
          switchView(view, true);
        }
      }
    });

    // Activate initial view on load
    const initialView = getCurrentView();
    switchView(initialView, false);
  }
}

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initRouter());
  } else {
    initRouter();
  }
}

export default {
  VIEW_IDS,
  FEATURE_NAME_MAP,
  normalizeViewName,
  getCurrentView,
  switchView,
  navigateTo,
  isViewVisible,
  initRouter
};

