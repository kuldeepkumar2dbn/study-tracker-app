/**
 * Test Suite: Multi-User Leaderboard Synchronization & Remote Sheet Rendering
 * tests/test-multi-user-leaderboard-sync.js
 *
 * Verifies:
 * 1. Unique persistent userId generation (signed-in Google email hash vs persistent usr_ UUID) to prevent device collision.
 * 2. buildStudentLeaderboardPayload carries userId, studentId, userSecret, displayName, totalHours, weeklyHours, streakDays, activeSubject, subjectHours.
 * 3. syncStudentToLeaderboard dispatches POST with Content-Type: text/plain to avoid Apps Script CORS preflight issues.
 * 4. fetchLeaderboard / fetchTop100Leaderboard parses overallTop100, bySubject, rankings without overwriting remote students.
 * 5. Auto-sync on open & manual sync flow with 600ms wait and cache-busting timestamp t.
 * 6. Default Live Study Room filters to OFF so all ranked students are immediately visible.
 * 7. Clean podium and table empty state when 2 real users exist without fake blank rows.
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

console.log('\n=== RUNNING MULTI-USER LEADERBOARD SYNC TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Persistent Unique User ID Generation
// -------------------------------------------------------------
console.log('--- SECTION 1: Unique User ID & Device Collision Prevention ---');

// Mock localStorage in Node
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

const lbPath = path.join(rootDir, 'leaderboard.js');
const lbMod = await import(`file://${lbPath.replace(/\\/g, '/')}`);

// 1.1 Google account email hash
const googleUser1 = { email: 'student1@university.edu', name: 'Student One', sub: 'g_sub_111' };
const googleUser2 = { email: 'student2@university.edu', name: 'Student Two', sub: 'g_sub_222' };
const id1 = lbMod.getStudentId(googleUser1);
const id2 = lbMod.getStudentId(googleUser2);

assert(id1.startsWith('usr_student1_'), 'id1 must be derived deterministically from email');
assert(id2.startsWith('usr_student2_'), 'id2 must be derived deterministically from email');
assert(id1 !== id2, 'Two different Google accounts must NEVER collide on the same userId');
console.log('✔ Test 1.1: Google accounts get deterministic, non-colliding userIds');

// 1.2 Non-Google / unauthenticated device persistent usr_ UUID
mockStore.clear();
const deviceIdA = lbMod.getStudentId(null);
const deviceIdA_cached = lbMod.getStudentId(null);
assert(deviceIdA === deviceIdA_cached, 'Subsequent calls on same device must return persistent cached userId');
assert(deviceIdA.startsWith('usr_'), 'Non-Google userId must start with usr_ prefix');

// Simulate a second independent device
mockStore.clear();
const deviceIdB = lbMod.getStudentId(null);
assert(deviceIdA !== deviceIdB, 'Two independent devices must generate distinct userIds');
console.log('✔ Test 1.2: Independent devices generate unique persistent usr_ userIds');

// 1.3 getUserId alias
assert(typeof lbMod.getUserId === 'function', 'leaderboard.js must export getUserId alias');
assert(lbMod.getUserId(googleUser1) === id1, 'getUserId must return same identifier as getStudentId');
console.log('✔ Test 1.3: getUserId alias verified');

// -------------------------------------------------------------
// SECTION 2: Payload Structure & Content-Type: text/plain
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Payload Schema & CORS-Free text/plain Headers ---');

let postHeaders = null;
let postPayload = null;
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    postHeaders = init.headers;
    postPayload = JSON.parse(init.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify({ rankings: [] }) };
};

const syncPayload = lbMod.buildStudentLeaderboardPayload({
  studentId: 'usr_devA_99',
  userId: 'usr_devA_99',
  displayName: 'Priya Sharma',
  optedIn: true,
  streak: 8,
  todayHours: 2.5,
  weeklyHours: 18.5,
  subjectHours: { Mathematics: 12.0, Physics: 6.5 }
});

assert(syncPayload.userId === 'usr_devA_99', 'Payload must include userId');
assert(syncPayload.studentId === 'usr_devA_99', 'Payload must include studentId');
assert(syncPayload.userSecret && typeof syncPayload.userSecret === 'string', 'Payload must include userSecret ownership token');
assert(syncPayload.displayName === 'Priya Sharma', 'Payload must include displayName');
assert(syncPayload.totalHours >= 18.5, 'Payload must include totalHours');
assert(syncPayload.weeklyHours === 18.5, 'Payload must include weeklyHours');
assert(syncPayload.streakDays === 8 && syncPayload.streak === 8, 'Payload must include streakDays and streak');
assert(syncPayload.activeSubject, 'Payload must include activeSubject');
assert(syncPayload.subjectHours && syncPayload.subjectHours.Mathematics === 12.0, 'Payload must include subjectHours map');
console.log('✔ Test 2.1: buildStudentLeaderboardPayload contains all required sync fields');

// Test syncStudentToLeaderboard dispatches Content-Type: text/plain
const syncRes = await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  studentId: 'usr_devA_99',
  userId: 'usr_devA_99',
  displayName: 'Priya Sharma',
  optedIn: true,
  weeklyHours: 18.5
});
assert(syncRes.success === true, 'syncStudentToLeaderboard must succeed');
assert(postHeaders['Content-Type'].includes('text/plain'), 'syncStudentToLeaderboard must send Content-Type: text/plain to avoid CORS preflight');
console.log('✔ Test 2.2: syncStudentToLeaderboard dispatches with Content-Type: text/plain');

// -------------------------------------------------------------
// SECTION 3: Remote Multi-User Sheets Parsing (No Local Overwriting)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Remote Multi-User Sheets Parsing ---');

// Mock response simulating Google Apps Script returning multiple students in overallTop100
const mockRemoteStudents = [
  { studentId: 'usr_alex_1', displayName: 'Alex Chen', weeklyHours: 40.0, streak: 15, activeSubject: 'Mathematics' },
  { studentId: 'usr_sara_2', displayName: 'Sara Khan', weeklyHours: 25.5, streak: 10, activeSubject: 'Physics' }
];

let capturedGetUrl = '';
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
  }
  capturedGetUrl = String(url);
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      overallTop100: mockRemoteStudents,
      rankings: mockRemoteStudents,
      totalParticipants: 2,
      source: 'StudyTracker_Admin_DB'
    })
  };
};

// Device 3 fetches leaderboard and merges its own hours
const boardResult = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  currentUserData: {
    studentId: 'usr_dev3_local',
    userId: 'usr_dev3_local',
    displayName: 'Local Student',
    optedIn: true,
    weeklyHours: 30.0,
    streak: 7
  }
});

assert(capturedGetUrl.includes('action=leaderboard'), 'Query URL must include action=leaderboard');
assert(capturedGetUrl.includes('type=leaderboard'), 'Query URL must include type=leaderboard');
assert(capturedGetUrl.includes('&t='), 'Query URL must include cache-busting timestamp t');
assert(boardResult.rankings.length === 3, `Expected 3 students (2 remote + 1 local), got ${boardResult.rankings.length}`);
assert(boardResult.rankings[0].displayName === 'Alex Chen' && boardResult.rankings[0].rank === 1, 'Alex Chen (40h) must be #1');
assert(boardResult.rankings[1].displayName === 'Local Student' && boardResult.rankings[1].rank === 2, 'Local Student (30h) must be #2');
assert(boardResult.rankings[2].displayName === 'Sara Khan' && boardResult.rankings[2].rank === 3, 'Sara Khan (25.5h) must be #3');
assert(boardResult.currentUserRank && boardResult.currentUserRank.rank === 2, 'Local student must have rank #2 marked');
console.log('✔ Test 3.1: Remote students from overallTop100 are preserved and ranked alongside local student');

// 3.2 Subject-wise candidate parsing
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({
    bySubject: {
      Physics: [
        { studentId: 'usr_sara_2', displayName: 'Sara Khan', hours: 25.5, streak: 10, activeSubject: 'Physics' }
      ]
    }
  })
});

const subjectResult = await lbMod.fetchTop100Leaderboard(lbMod.TELEMETRY_URL, {
  mode: 'subject',
  subject: 'Physics',
  currentUserData: {
    studentId: 'usr_dev3_local',
    userId: 'usr_dev3_local',
    displayName: 'Local Student',
    optedIn: true,
    weeklyHours: 10.0,
    subjectHours: { Physics: 10.0 }
  }
});

assert(subjectResult.rankings.length === 2, 'Subject rankings must include remote student and local student');
assert(subjectResult.rankings[0].displayName === 'Sara Khan', 'Sara Khan with 25.5h must rank #1 in Physics');
assert(subjectResult.rankings[1].displayName === 'Local Student', 'Local Student with 10h must rank #2 in Physics');
console.log('✔ Test 3.2: bySubject parsing in fetchTop100Leaderboard verified');

// -------------------------------------------------------------
// SECTION 4: LeaderboardTab UI Code Audit
// -------------------------------------------------------------
console.log('\n--- SECTION 4: LeaderboardTab UI Code Audit ---');

const lbTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx'), 'utf8');

// 4.1 Auto-sync on open with 600ms delay & filter reset
assert(lbTab.includes('setLiveOnly(false)') && lbTab.includes('setSameSubjectOnly(false)'), 'LeaderboardTab must reset liveOnly & sameSubjectOnly to false on view open');
assert(lbTab.includes('setTimeout(r, 600)'), 'LeaderboardTab must wait 600ms after pushing hours to let Google Sheets commit write');
assert(lbTab.includes('fetchTop100Leaderboard'), 'LeaderboardTab must import and use fetchTop100Leaderboard');
console.log('✔ Test 4.1: Auto-sync on view open, 600ms commit delay, and filter reset verified');

// 4.2 Clean podium and table rendering when 2 real users exist
assert(lbTab.includes('Rank #{cfg.rank} Open'), 'Podium must render clean open slot for unoccupied podium positions');
assert(lbTab.includes('featured on the podium above. Log hours to expand the Top 100 table!'), 'Table empty state must explain that all students are featured on podium when <= 3 users exist');
console.log('✔ Test 4.2: Clean 2-user podium and table empty state verified without fake blank rows');

// -------------------------------------------------------------
// SECTION 5: Code.gs Backend Compatibility
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Code.gs Backend Compatibility ---');

const codeGs = fs.readFileSync(path.join(rootDir, 'Code.gs'), 'utf8');
assert(codeGs.includes('payload.userId || payload.studentId'), 'Code.gs doPost must accept payload.userId || payload.studentId');
assert(codeGs.includes('payload.streakDays !== undefined ? payload.streakDays :'), 'Code.gs doPost must accept streakDays');
assert(codeGs.includes("params.type || params.action || 'leaderboard'"), 'Code.gs doGet must accept params.action === leaderboard');
assert(codeGs.includes('overallTop100: rankedList'), 'Code.gs doGet must return overallTop100 array');
console.log('✔ Test 5.1: Code.gs accepts userId, streakDays, action=leaderboard, and returns overallTop100');

console.log('\n=== ALL MULTI-USER LEADERBOARD SYNC TESTS PASSED! ===\n');
