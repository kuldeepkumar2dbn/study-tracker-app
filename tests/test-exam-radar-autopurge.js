/**
 * Test Suite: Exam Radar Auto-Purge of Expired Deadlines & Dashboard Sync
 * tests/test-exam-radar-autopurge.js
 *
 * Verifies:
 * 1. Local midnight comparison (`examDate >= todayMidnight` kept, `examDate < todayMidnight` purged)
 * 2. Exams happening today remain active and report `0` days remaining (`Today / 0d remaining`)
 * 3. `purgeExpiredExamDeadlines()` removes expired exams from localStorage and syncs cleaned array via `patchUserData` (including when cleaned array becomes `[]`)
 * 4. Automatic hooks on initial load (`app.js`), view switches (`#view-radar` / `#view-dashboard`), and midnight interval
 * 5. Dashboard "Next Deadline" card displays `"No upcoming deadlines"` + `+ Add Exam` when active list is empty
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('\n=== RUNNING EXAM RADAR AUTO-PURGE TEST SUITE ===\n');

// Mock localStorage & sessionStorage
const localMap = new Map();
globalThis.localStorage = {
  get length() { return localMap.size; },
  key: (i) => Array.from(localMap.keys())[i] ?? null,
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};
const sessionMap = new Map();
globalThis.sessionStorage = {
  get length() { return sessionMap.size; },
  key: (i) => Array.from(sessionMap.keys())[i] ?? null,
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
  setItem: (k, v) => sessionMap.set(k, String(v)),
  removeItem: (k) => sessionMap.delete(k),
  clear: () => sessionMap.clear()
};

const examRadarMod = await import(`file://${path.join(rootDir, 'exam-radar.js').replace(/\\/g, '/')}`);

// -------------------------------------------------------------
// SECTION 1: Local Midnight Boundary Tests
// -------------------------------------------------------------
console.log('--- SECTION 1: Local Midnight Boundary Comparisons ---');

// Reference date: Nov 18, 2026 at 22:30 local time (late evening)
const refDate = new Date(2026, 10, 18, 22, 30, 0, 0);

const expiredOld = { id: 'e-old', title: 'Old Quiz', date: '2026-11-10T09:00:00' };
const expiredYesterday = { id: 'e-yest', title: 'Yesterday Midterm', date: '2026-11-17T23:59:00' };
const activeTodayMorning = { id: 'e-today-am', title: 'Today Morning Exam', date: '2026-11-18T08:00:00' };
const activeTodayDateOnly = { id: 'e-today-ymd', title: 'Today Paper', date: '2026-11-18' };
const activeTomorrow = { id: 'e-tmrw', title: 'Tomorrow Viva', date: '2026-11-19T10:00:00' };
const activeFuture = { id: 'e-fut', title: 'Final Exam', date: '2026-11-25T14:00:00' };

assert(examRadarMod.isExamExpired(expiredOld, refDate) === true, 'Past exam (8 days ago) must be expired');
assert(examRadarMod.isExamExpired(expiredYesterday, refDate) === true, 'Yesterday exam must be expired (< todayMidnight)');
assert(examRadarMod.isExamExpired(activeTodayMorning, refDate) === false, 'Exam happening today morning must NOT be expired (>= todayMidnight)');
assert(examRadarMod.isExamExpired(activeTodayDateOnly, refDate) === false, 'Date-only exam for today must NOT be expired (>= todayMidnight)');
assert(examRadarMod.isExamExpired(activeTomorrow, refDate) === false, 'Tomorrow exam must NOT be expired');

assert(examRadarMod.getDaysUntilExam(activeTodayMorning.date, refDate) === 0, 'Exam happening today must report 0d remaining');
assert(examRadarMod.getDaysUntilExam(activeTomorrow.date, refDate) === 1, 'Tomorrow exam must report 1d remaining');
assert(examRadarMod.getDaysUntilExam(activeFuture.date, refDate) === 7, 'Exam in 7 days must report 7d remaining');

const { activeExams, expiredExams, removedCount } = examRadarMod.filterActiveExamDeadlines(
  [expiredOld, expiredYesterday, activeTodayMorning, activeTodayDateOnly, activeTomorrow, activeFuture],
  refDate
);
assert(removedCount === 2 && expiredExams.length === 2, 'Exactly 2 expired exams must be filtered out');
assert(activeExams.length === 4, 'All 4 today + future exams must remain active');
console.log('✔ Test 1.1: Local midnight boundary comparisons (yesterday purged, today kept as 0d, future kept) verified');

// -------------------------------------------------------------
// SECTION 2: LocalStorage Purge & patchUserData Persistence
// -------------------------------------------------------------
console.log('\n--- SECTION 2: LocalStorage Purge & patchUserData Sync ---');

const uid = 'student_purge_test';
localStorage.setItem(`studyflow_${uid}_data`, JSON.stringify({
  userId: uid,
  streak: 5,
  todayLoggedHours: 2.0,
  subjects: [{ id: 'sub-1', name: 'Signals & Systems' }],
  routine: [{ id: 'rt-1', title: 'Morning Revision' }],
  exams: [expiredYesterday, activeTodayMorning, activeTomorrow],
  dailyActivity: { '2026-11-18': 120 }
}));
localStorage.setItem(`studyflow_${uid}_exams`, JSON.stringify([expiredYesterday, activeTodayMorning, activeTomorrow]));

const purge1 = examRadarMod.purgeExpiredExamDeadlines({ userId: uid, referenceDate: refDate });
assert(purge1.purged === true && purge1.removedCount === 1, 'Must purge 1 expired deadline');
assert(purge1.activeExams.length === 2, 'Must keep today + tomorrow deadlines');

const storedDoc1 = JSON.parse(localStorage.getItem(`studyflow_${uid}_data`));
assert(storedDoc1.exams.length === 2 && !storedDoc1.exams.some((e) => e.id === 'e-yest'), 'Master user doc must permanently remove yesterday exam');
assert(storedDoc1.streak === 5 && storedDoc1.subjects.length === 1, 'Purging expired exams must preserve streak, subjects, and routine');

// Now simulate next week when ALL deadlines have expired -> active list becomes []
const nextMonthRef = new Date(2026, 11, 1, 9, 0, 0, 0);
const purgeAll = examRadarMod.purgeExpiredExamDeadlines({ userId: uid, referenceDate: nextMonthRef });
assert(purgeAll.purged === true && purgeAll.removedCount === 2 && purgeAll.activeExams.length === 0, 'All expired exams must purge cleanly to []');

const storedDoc2 = JSON.parse(localStorage.getItem(`studyflow_${uid}_data`));
assert(Array.isArray(storedDoc2.exams) && storedDoc2.exams.length === 0, 'patchUserData must persist empty exams [] so expired items never return on reload');
assert(storedDoc2.streak === 5 && storedDoc2.subjects.length === 1, 'Purging all expired exams must still preserve all other real user data');
console.log('✔ Test 2.1: purgeExpiredExamDeadlines persists cleaned array (including []) via patchUserData without touching other user data');

// -------------------------------------------------------------
// SECTION 3: Automatic Lifecycle Hooks & Dashboard Sync
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Automatic Lifecycle Hooks & Dashboard Next Deadline Card ---');

const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
assert(appJs.includes('purgeExpiredExamDeadlines()') && appJs.includes('startMidnightExamPurgeScheduler()'), 'app.js must run purgeExpiredExamDeadlines() on load and start midnight interval');
assert(appJs.includes("view === 'radar' || view === 'exam-radar' || view === 'dashboard'"), 'app.js must purge expired exams on switching to Exam Radar or Dashboard');

const dataCtx = fs.readFileSync(path.join(rootDir, 'src', 'context', 'DataContext.jsx'), 'utf8');
assert(dataCtx.includes('purgeExpiredExamDeadlines') && dataCtx.includes('filterActiveExamDeadlines'), 'DataContext.jsx must auto-purge expired exams on init, view switch, hydration, and midnight');

const dashboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx'), 'utf8');
assert(dashboardTab.includes('filterActiveExamDeadlines(safeExams)'), 'Dashboard Next Deadline card must pull from purged active deadlines');
assert(dashboardTab.includes('No upcoming deadlines') && dashboardTab.includes('+ Add Exam'), 'Dashboard Next Deadline card must display "No upcoming deadlines" with "+ Add Exam" when empty');
assert(dashboardTab.includes("0d remaining"), 'Dashboard Next Deadline card must display Today / 0d remaining for exams happening today');

const examsTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'ExamsTab.jsx'), 'utf8');
assert(examsTab.includes('purgeExpiredExamDeadlines()') && examsTab.includes('activeExamsList'), 'ExamsTab.jsx must auto-purge expired exams and render only active deadlines');
console.log('✔ Test 3.1: app.js, DataContext.jsx, DashboardTab.jsx, and ExamsTab.jsx auto-purge hooks & empty state verified');

console.log('\n=== ALL EXAM RADAR AUTO-PURGE TESTS PASSED SUCCESSFULLY! ===\n');

