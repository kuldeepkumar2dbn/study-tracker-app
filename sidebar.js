/**
 * Sidebar Navigation Controller (sidebar.js)
 * StudyFlow Zero-Reload SPA Architecture
 */

import { switchView, normalizeViewName } from './router.js';

export const SIDEBAR_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', href: '#dashboard', targetView: 'dashboard', tooltip: 'Dashboard & Overview' },
  { id: 'routine', name: 'Daily Routine', href: '#routine', targetView: 'routine', tooltip: 'Daily Study Routine' },
  { id: 'calendar', name: 'Calendar', href: '#calendar', targetView: 'calendar', tooltip: 'Academic Calendar' },
  { id: 'syllabus', name: 'Subjects & Syllabus', href: '#syllabus', targetView: 'syllabus', isProtected: true, tooltip: 'Course Syllabus & Subjects' },
  { id: 'revision', name: 'Revision Queue', href: '#revision', targetView: 'revision', isProtected: true, tooltip: 'Spaced Repetition Queue' },
  { id: 'radar', name: 'Exam Radar', href: '#radar', targetView: 'radar', isProtected: true, tooltip: 'Exam Radar & Deadlines' },
  { id: 'mock-logbook', name: 'Mock Logbook', href: '#mock-logbook', targetView: 'mock-logbook', tooltip: 'Mock Test & Mistake Logbook' },
  { id: 'leaderboard', name: 'Leaderboard', href: '#leaderboard', targetView: 'leaderboard', tooltip: 'Real-Time Student Leaderboard' },
  { id: 'skills', name: 'Skill Tracker', href: '#skills', targetView: 'skills', isProtected: true, tooltip: 'Skill Tracker & Mastery' },
  { id: 'notes', name: 'Drive Notes', href: '#notes', targetView: 'notes', isProtected: true, tooltip: 'Google Drive Notes Vault' },
  { id: 'timer', name: 'Focus Timer', href: '#timer', targetView: 'timer', tooltip: 'Focus Timer & Deep Work' },
  { id: 'profile', name: 'My Profile', href: '#profile', targetView: 'profile', tooltip: 'My Student Profile & ID Card' }
];

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
  SIDEBAR_ITEMS,
  setupSidebarNav,
  updateActiveSidebarItem
};

