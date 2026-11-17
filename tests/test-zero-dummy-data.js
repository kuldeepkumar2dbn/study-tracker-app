/**
 * Test Suite: Zero Dummy / Placeholder Data & Clean Empty-State Verification
 * tests/test-zero-dummy-data.js
 *
 * Verifies:
 * 1. Complete removal of hardcoded dummy/starter seed data across DataContext, demoTemplate, ConsistencyRadar, Leaderboard, and Code.gs
 * 2. Clean zero-state Dashboard metrics (0.0h, 0 streak, "No deadlines set", 0 revision topics) & 30-day 0.0h Consistency Radar
 * 3. Clean empty-state UI cards with direct CTA buttons across Routine, Mock Logbook, Revision Queue, and Leaderboard
 * 4. Cloud Sync & patchUserData protection against overwriting returning users' real Google Drive data with blank defaults
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

console.log('\n=== RUNNING ZERO DUMMY DATA & CLEAN EMPTY-STATE TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Purge of Hardcoded Dummy / Sample Seed Data
// -------------------------------------------------------------
console.log('--- SECTION 1: Purge of Hardcoded Dummy / Sample Seed Data ---');

const dataContext = fs.readFileSync(path.join(rootDir, 'src', 'context', 'DataContext.jsx'), 'utf8');
assert(!dataContext.includes('Probability & Statistics Midterm'), 'DataContext.jsx must not contain fake Probability & Statistics Midterm exam');
assert(!dataContext.includes('streakCount: 14'), 'DataContext.jsx must not seed streakCount: 14');
assert(!dataContext.includes('AVL Tree Rotations'), 'DataContext.jsx must not contain starter AVL Tree dummy subjects/notes');
assert(!dataContext.includes('LeetCode Problem Archive'), 'DataContext.jsx must not seed dummy importantLinks');
assert(dataContext.includes('const initialSubjects = [];') && dataContext.includes('const initialDeadlines = [];') && dataContext.includes('const initialRoutineSlots = [];'), 'DataContext.jsx initial collections must be empty arrays []');

const demoTemplateMod = await import(`file://${path.join(rootDir, 'src', 'utils', 'demoTemplate.js').replace(/\\/g, '/')}`);
const zeroTemplate = demoTemplateMod.getFreshDemoTemplateData();
assert(zeroTemplate.subjects.length === 0 && zeroTemplate.exams.length === 0 && zeroTemplate.routine_slots.length === 0, 'demoTemplate must start with empty arrays');
assert(zeroTemplate.streak.streakCount === 0 && zeroTemplate.streak.todayHours === 0, 'demoTemplate must start at 0 streak and 0.0h');
assert(Object.keys(zeroTemplate.dailyActivity).length === 0, 'demoTemplate dailyActivity must be empty {}');

const lbJs = fs.readFileSync(path.join(rootDir, 'leaderboard.js'), 'utf8');
assert(!lbJs.includes('COHORT_FIRST_NAMES') && !lbJs.includes('generateCommunityBenchmarkRows'), 'leaderboard.js must not contain fake cohort generator');

const codeGs = fs.readFileSync(path.join(rootDir, 'Code.gs'), 'utf8');
assert(codeGs.includes("StudyTracker_Admin_DB"), 'Code.gs must reference StudyTracker_Admin_DB');
console.log('✔ Test 1.1: All hardcoded dummy tasks, exams, notes, links, streaks, and fake leaderboard cohorts purged');

// -------------------------------------------------------------
// SECTION 2: 30-Day Consistency Radar Zero-State & Empty Leaderboard Runtime
// -------------------------------------------------------------
console.log('\n--- SECTION 2: 30-Day Consistency Radar & Empty Leaderboard Runtime ---');

const radarUtil = await import(`file://${path.join(rootDir, 'src', 'utils', 'consistencyRadar.js').replace(/\\/g, '/')}`);
const emptyRadar = radarUtil.calculate30DayBarGraph({});
assert(emptyRadar.days.length === 30, 'Consistency Radar must render all 30 calendar days');
assert(emptyRadar.activeDaysCount === 0 && emptyRadar.totalHours === 0, 'Empty Consistency Radar must have 0 active days and 0.0h total');
assert(emptyRadar.days.every((d) => d.hours === 0 && d.minutes === 0 && d.heightPercent === 0), 'Every day in empty Consistency Radar must be strictly 0.0h');

// Mock clean empty storage & empty remote Google Sheet Leaderboard
const localMap = new Map();
globalThis.localStorage = {
  get length() { return localMap.size; },
  key: (i) => Array.from(localMap.keys())[i] ?? null,
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ rankings: [], source: 'StudyTracker_Admin_DB' })
});

const lbMod = await import(`file://${path.join(rootDir, 'leaderboard.js').replace(/\\/g, '/')}`);
const emptyBoard = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  currentUserData: {
    studentId: 'fresh_user_01',
    streakData: { streakCount: 0, todayHours: 0, weeklyVelocityHours: 0 },
    subjectsList: []
  }
});
assert(Array.isArray(emptyBoard.rankings) && emptyBoard.rankings.length === 0, 'Empty Leaderboard sheet with 0h fresh user must return strictly 0 fake rows []');
console.log('✔ Test 2.1: 30-Day Consistency Radar renders 0.0h across all 30 days and Leaderboard returns [] with zero mock rows');

// -------------------------------------------------------------
// SECTION 3: Clean Empty-State UI Placeholders & Action CTAs
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Clean Empty-State UI Placeholders & Action CTAs ---');

const dashboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx'), 'utf8');
assert(dashboardTab.includes('No deadlines set'), 'Dashboard Next Deadline card must display "No deadlines set" when empty');
assert(dashboardTab.includes('+ Add Your First Routine Block'), 'Dashboard routine empty state must include "+ Add Your First Routine Block" CTA');

const dailyRoutine = fs.readFileSync(path.join(rootDir, 'src', 'components', 'DailyRoutine.jsx'), 'utf8');
assert(dailyRoutine.includes('+ Add Your First Routine Block'), 'DailyRoutine empty state must include "+ Add Your First Routine Block" CTA');

const mockLogbook = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'MockLogbookTab.jsx'), 'utf8');
assert(mockLogbook.includes('+ Log Your First Mock Test'), 'MockLogbook empty state must include "+ Log Your First Mock Test" CTA');

const revisionTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'RevisionTab.jsx'), 'utf8');
assert(revisionTab.includes('id="revision-queue-empty-state"') && revisionTab.includes('0 Topics Due for Revision Today'), 'RevisionTab must render clean empty-state card with CTA');

const lbTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx'), 'utf8');
assert(lbTab.includes('id="leaderboard-empty-state"') && lbTab.includes('Start Focus Timer to Join the Live Leaderboard'), 'LeaderboardTab must render clean empty-state card with "Start Focus Timer to Join the Live Leaderboard" CTA');
console.log('✔ Test 3.1: All empty-state UI cards and direct action CTAs verified');

// -------------------------------------------------------------
// SECTION 4: Real Data Protection During Cloud Sync & patchUserData
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Real Data Protection During Cloud Sync & patchUserData ---');

const cloudSyncMod = await import(`file://${path.join(rootDir, 'cloud-sync.js').replace(/\\/g, '/')}`);
const storageHelperMod = await import(`file://${path.join(rootDir, 'storage-helper.js').replace(/\\/g, '/')}`);

// 4.1 isBlankZeroState check
assert(cloudSyncMod.isBlankZeroState({ subjects: [], routine: [], exams: [], streak: 0, todayLoggedHours: 0, dailyActivity: {} }) === true, 'Blank defaults must be detected as zero-state');
assert(cloudSyncMod.isBlankZeroState({ subjects: [{ id: 's1', name: 'Signals' }], streak: 0 }) === false, 'Populated subjects must NOT be treated as blank zero-state');
assert(cloudSyncMod.isBlankZeroState({ streak: 3, dailyActivity: { '2026-11-18': 60 } }) === false, 'Active streak/dailyActivity must NOT be treated as blank zero-state');

// 4.2 patchUserData must NOT overwrite returning user's real data with blank defaults
localStorage.setItem('studyflow_user_real_1_data', JSON.stringify({
  userId: 'user_real_1',
  streak: 7,
  todayLoggedHours: 2.5,
  subjects: [{ id: 'sub_real', name: 'Signals & Systems' }],
  routine: [{ id: 'r1', title: 'Morning Practice' }],
  dailyActivity: { '2026-11-18': 150 }
}));

const patchedBlank = storageHelperMod.patchUserData('user_real_1', {
  subjects: [],
  routine: [],
  streak: 0,
  todayLoggedHours: 0,
  dailyActivity: {}
});
assert(patchedBlank.streak === 7 && patchedBlank.subjects.length === 1 && patchedBlank.routine.length === 1, 'patchUserData must refuse to overwrite returning user real data with blank zero-state defaults');

// 4.3 mergeCloudAndLocalData preserves returning user's Google Drive data when new device starts blank
const merged = cloudSyncMod.mergeCloudAndLocalData(
  {
    streak: 11,
    todayLoggedHours: 3.0,
    subjects: [{ id: 'sub_cloud', name: 'Control Systems' }],
    routine: [{ id: 'r_cloud', title: 'Control Revision' }],
    dailyActivity: { '2026-11-17': 180 },
    updatedAt: '2026-11-18T00:00:00.000Z'
  },
  {
    streak: 0,
    todayLoggedHours: 0,
    subjects: [],
    routine: [],
    dailyActivity: {},
    updatedAt: '2026-11-18T01:00:00.000Z'
  }
);
assert(merged.streak === 11 && merged.subjects.length === 1 && merged.routine.length === 1 && merged.dailyActivity['2026-11-17'] === 180, 'Cloud sync merge must preserve returning user Drive data even if fresh local device has newer blank timestamp');
console.log('✔ Test 4.1: Cloud sync and patchUserData real-data protection verified');

console.log('\n=== ALL ZERO DUMMY DATA & CLEAN EMPTY-STATE TESTS PASSED SUCCESSFULLY! ===\n');

