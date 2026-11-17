/**
 * Test Suite: Student Profile SPA View & Leaderboard @username Integration
 * tests/test-student-profile.js
 *
 * Verifies:
 * 1. WORKSPACE sidebar "My Profile" item (data-target-view="profile") & Top Header @username pill
 * 2. #view-profile 2-column layout: Live Student ID Card Preview & Edit Profile Form
 * 3. Validation (3-20 alphanumeric/underscore @username, Age 10-99, Bio max 120 chars)
 * 4. Daily Study Goal sync, patchUserData Drive sync, and Leaderboard @username + targetExam sync
 * 5. Code.gs backend support for @username and targetExam
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

console.log('\n=== RUNNING STUDENT PROFILE & @USERNAME TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Sidebar, Router & Top Header Integration
// -------------------------------------------------------------
console.log('--- SECTION 1: Sidebar, Router & Top Header Integration ---');

const sidebarJs = fs.readFileSync(path.join(rootDir, 'sidebar.js'), 'utf8');
assert(sidebarJs.includes("id: 'profile'") && sidebarJs.includes("name: 'My Profile'") && sidebarJs.includes("targetView: 'profile'"), 'sidebar.js must define My Profile item with targetView: profile');

const collapsibleSidebar = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx'), 'utf8');
assert(collapsibleSidebar.includes("id: 'profile'") && collapsibleSidebar.includes("name: 'My Profile'"), 'CollapsibleSidebar.jsx must render My Profile navigation item');
assert(collapsibleSidebar.includes('profile: {'), 'CollapsibleSidebar.jsx must define glowing pill style for profile');

const routerJs = fs.readFileSync(path.join(rootDir, 'router.js'), 'utf8');
assert(routerJs.includes("'profile'") && routerJs.includes("profile: 'My Profile'"), 'router.js must register profile view and My Profile telemetry name');

const dashboardPage = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'dashboard.jsx'), 'utf8');
assert(dashboardPage.includes('id="view-profile"') && dashboardPage.includes('<ProfileTab'), 'dashboard.jsx must mount #view-profile with ProfileTab');

const appShell = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppShell.jsx'), 'utf8');
assert(appShell.includes('id="header-profile-pill"') && appShell.includes('data-target-view="profile"'), 'AppShell.jsx header must render clickable @username profile pill opening #view-profile');
assert(appShell.includes('studentProfile?.handle') && appShell.includes('handleOpenProfileView'), 'Top-right header pill must display @username and switch to #view-profile on click');
console.log('✔ Test 1.1: Sidebar "My Profile", SPA router #view-profile, and Header @username pill verified');

// -------------------------------------------------------------
// SECTION 2: Student Profile 2-Column View & Form UI
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Student Profile 2-Column View & Form UI ---');

const profileTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'ProfileTab.jsx');
assert(fs.existsSync(profileTabPath), 'src/components/tabs/ProfileTab.jsx must exist');
const profileTab = fs.readFileSync(profileTabPath, 'utf8');

// Left Column: Live Student ID Card Preview
assert(profileTab.includes('id="student-id-card-preview"'), 'Must render Live Student ID Card preview');
assert(profileTab.includes('id="profile-monogram-avatar"'), 'Must render circular 2-letter monogram avatar');
assert(profileTab.includes('id="profile-preview-handle"'), 'Must render bold @username handle preview');
assert(profileTab.includes('id="profile-preview-target-badge"'), 'Must render Target Exam / Primary Skill badge');
assert(profileTab.includes('Total Study Hours') && profileTab.includes('Current Streak') && profileTab.includes('Mock Accuracy %'), 'Must render Quick Stats strip (Total Study Hours, Current Streak, Mock Accuracy %)');

// Right Column: Edit Profile Form
assert(profileTab.includes('id="profile-username-input"'), 'Must include Username (@handle) input');
assert(profileTab.includes('id="profile-fullname-input"'), 'Must include Full Name input');
assert(profileTab.includes('id="profile-age-input"') && profileTab.includes('min={10}') && profileTab.includes('max={99}'), 'Must include Age number input (10-99)');
assert(profileTab.includes('id="profile-target-exam-select"') && profileTab.includes('id="profile-custom-target-input"'), 'Must include Target Exam dropdown + custom input');
assert(profileTab.includes('id="profile-daily-goal-input"') && profileTab.includes('setDailyTargetMinutes'), 'Must include Daily Study Goal synced to Dashboard Daily Target');
assert(profileTab.includes('id="profile-bio-input"') && profileTab.includes('maxLength={120}'), 'Must include Short Bio / Study Motto (max 120 chars)');
assert(profileTab.includes('id="profile-leaderboard-visibility-toggle"'), 'Must include Leaderboard Visibility Toggle');
assert(profileTab.includes('Save Profile & Sync'), 'Must include Save Profile & Sync button');
assert(profileTab.includes('Profile saved! Your @username is now live on the Leaderboard.'), 'Must display exact confirmation toast upon save');

// Theme CSS Variables
assert(profileTab.includes('var(--bg-card)') && profileTab.includes('var(--border-glow)') && profileTab.includes('var(--text-main)') && profileTab.includes('var(--primary)'), 'Profile view must use theme CSS variables for Dark & Onyx & Gold compatibility');
console.log('✔ Test 2.1: 2-column Student ID Card Preview, Edit Profile Form, and theme CSS variables verified');

// -------------------------------------------------------------
// SECTION 3: Leaderboard @username, targetExam & Code.gs
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Leaderboard @username, targetExam & Code.gs ---');

const lbTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx'), 'utf8');
assert(lbTab.includes('student.targetExam'), 'LeaderboardTab.jsx must display student targetExam badge in podium and table rows');
assert(lbTab.includes('studyflow-student-profile-updated'), 'LeaderboardTab.jsx must react to studyflow-student-profile-updated events');

const codeGsPath = path.join(rootDir, 'Code.gs');
assert(fs.existsSync(codeGsPath), 'Code.gs must exist in root directory');
const codeGs = fs.readFileSync(codeGsPath, 'utf8');
assert(codeGs.includes('targetExam') && codeGs.includes('formatDisplayName_') && codeGs.includes("'@' + rawUsername"), 'Code.gs must store and serve @username and targetExam');
console.log('✔ Test 3.1: LeaderboardTab.jsx targetExam tags and Code.gs @username backend verified');

// -------------------------------------------------------------
// SECTION 4: Runtime Verification (profile.js + leaderboard.js)
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Runtime Verification (profile.js + leaderboard.js) ---');

const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

let lastPostPayload = null;
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    lastPostPayload = JSON.parse(init.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify({ rankings: [] }) };
};

const profileMod = await import(`file://${path.join(rootDir, 'profile.js').replace(/\\/g, '/')}`);
const lbMod = await import(`file://${path.join(rootDir, 'leaderboard.js').replace(/\\/g, '/')}`);

// 4.1 Username validation & monogram
assert(profileMod.validateUsername('ab').valid === false, 'Username < 3 chars must fail');
assert(profileMod.validateUsername('this_username_is_way_too_long_25').valid === false, 'Username > 20 chars must fail');
assert(profileMod.validateUsername('bad name!').valid === false, 'Username with spaces/symbols must fail');
const validCheck = profileMod.validateUsername('@kuldeep_gate26');
assert(validCheck.valid === true && validCheck.cleaned === 'kuldeep_gate26' && validCheck.handle === '@kuldeep_gate26', 'Valid username must auto-prefix @');
assert(profileMod.getUsernameMonogram('@kuldeep_gate26') === 'KU', 'Monogram must take first 2 letters of @username in uppercase');
console.log('✔ Test 4.1: @username validation (3-20 alphanumeric/underscore) and 2-letter monogram verified');

// 4.2 Save profile & Quick Stats
localStorage.setItem('studytracker_mock_tests', JSON.stringify([
  { id: 'm1', accuracyPct: 84.0 },
  { id: 'm2', accuracyPct: 90.0 }
]));

const saved = profileMod.saveStudentProfile({
  username: 'kuldeep_gate26',
  fullName: 'Kuldeep Kumar',
  age: 22,
  city: 'New Delhi',
  targetExam: 'GATE',
  dailyGoalHours: 6.5,
  bio: 'Consistent 6.5h/day until GATE exam day.',
  showOnLeaderboard: true
});
assert(saved.success === true && saved.profile.handle === '@kuldeep_gate26', 'saveStudentProfile must persist @username');

const loaded = profileMod.getStudentProfile();
assert(loaded.handle === '@kuldeep_gate26' && loaded.age === 22 && loaded.city === 'New Delhi' && loaded.resolvedTargetExam === 'GATE', 'getStudentProfile must hydrate all saved fields');

const stats = profileMod.getStudentQuickStats({
  subjects: [{ name: 'Signals & Systems', completedHours: 14.5 }],
  streakData: { streakCount: 12, todayHours: 2.5, weeklyVelocityHours: 10.0 }
});
assert(stats.totalStudyHours === 14.5 && stats.currentStreak === 12 && stats.mockAccuracyPct === 87.0, 'Quick stats must compute Total Hours, Streak, and Mock Accuracy %');
console.log('✔ Test 4.2: saveStudentProfile, getStudentProfile, and Quick Stats strip calculations verified');

// 4.3 Leaderboard sync uses @username & targetExam from saved profile
await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  studentId: 'usr_profile_test',
  streakData: { streakCount: 12, todayHours: 3.0, weeklyVelocityHours: 24.0 },
  subjectsList: [{ name: 'Signals & Systems', completedHours: 14.5 }]
});
assert(lastPostPayload && lastPostPayload.displayName === '@kuldeep_gate26', 'leaderboard.js must sync displayName as @${profile.username}');
assert(lastPostPayload.targetExam === 'GATE', 'leaderboard.js must include targetExam in sync payload');

const board = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  currentUserData: {
    studentId: 'usr_profile_test',
    streakData: { streakCount: 12, todayHours: 3.0, weeklyVelocityHours: 24.0 }
  }
});
assert(board.currentUserRank && board.currentUserRank.displayName === '@kuldeep_gate26', 'Leaderboard ranking must display student @username');
assert(board.currentUserRank.targetExam === 'GATE', 'Leaderboard ranking must carry student targetExam tag');
console.log('✔ Test 4.3: leaderboard.js automatically syncs and displays @username + targetExam from saved profile');

console.log('\n=== ALL STUDENT PROFILE & @USERNAME TESTS PASSED SUCCESSFULLY! ===\n');

