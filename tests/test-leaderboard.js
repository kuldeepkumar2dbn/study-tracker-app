/**
 * Test Suite: Real-Time Student Leaderboard SPA Feature
 * tests/test-leaderboard.js
 *
 * Verifies:
 * 1. WORKSPACE sidebar navigation right below Mock Logbook & SPA router integration
 * 2. Leaderboard Header & Controls (Mode Tabs, Subject Selector, Display Name, Opt-In, Sync Now, Live 30s)
 * 3. Top 3 Podium Cards (Gold/Silver/Bronze) & Ranks #4-#100 Scrollable Table + Sticky Your Current Rank Banner
 * 4. Automatic Background Sync Hooks (+30m Study, Focus Timer Start/Complete, Header Sync Now)
 * 5. Runtime behavior of leaderboard.js (syncStudentToLeaderboard, fetchLeaderboard, getAvailableSubjects)
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

console.log('\n=== RUNNING REAL-TIME LEADERBOARD TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Sidebar Navigation & SPA Router Integration
// -------------------------------------------------------------
console.log('--- SECTION 1: Sidebar Navigation & SPA Router Integration ---');

const sidebarJs = fs.readFileSync(path.join(rootDir, 'sidebar.js'), 'utf8');
assert(sidebarJs.includes("id: 'leaderboard'"), 'sidebar.js must define leaderboard item');
assert(sidebarJs.includes("targetView: 'leaderboard'"), 'sidebar.js must set targetView: leaderboard');

const mockIdx = sidebarJs.indexOf("id: 'mock-logbook'");
const lbIdx = sidebarJs.indexOf("id: 'leaderboard'");
const skillsIdx = sidebarJs.indexOf("id: 'skills'");
assert(mockIdx !== -1 && lbIdx !== -1 && skillsIdx !== -1, 'mock-logbook, leaderboard, and skills must exist in sidebar.js');
assert(mockIdx < lbIdx && lbIdx < skillsIdx, 'Leaderboard must be positioned right below Mock Logbook and above Skill Tracker');
console.log('✔ Test 1.1: sidebar.js places Leaderboard right below Mock Logbook');

const collapsibleSidebar = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx'), 'utf8');
assert(collapsibleSidebar.includes('Trophy'), 'CollapsibleSidebar.jsx must import Trophy icon');
assert(collapsibleSidebar.includes("id: 'leaderboard'"), 'CollapsibleSidebar.jsx must include leaderboard in SIDEBAR_ITEMS');
assert(collapsibleSidebar.includes("name: 'Leaderboard'"), 'CollapsibleSidebar.jsx must label tab Leaderboard');
assert(collapsibleSidebar.includes('leaderboard: {'), 'CollapsibleSidebar.jsx must define active pill style for leaderboard');
const csMockIdx = collapsibleSidebar.indexOf("id: 'mock-logbook'");
const csLbIdx = collapsibleSidebar.indexOf("id: 'leaderboard'");
const csSkillsIdx = collapsibleSidebar.indexOf("id: 'skills'");
assert(csMockIdx < csLbIdx && csLbIdx < csSkillsIdx, 'CollapsibleSidebar.jsx must position Leaderboard directly below Mock Logbook');
console.log('✔ Test 1.2: CollapsibleSidebar.jsx configures Leaderboard with Trophy icon & glowing pill');

const routerJs = fs.readFileSync(path.join(rootDir, 'router.js'), 'utf8');
assert(routerJs.includes("'leaderboard'"), 'router.js VIEW_IDS must include leaderboard');
assert(routerJs.includes("leaderboard: 'Leaderboard'"), 'router.js FEATURE_NAME_MAP must map leaderboard -> Leaderboard for silent telemetry');
console.log('✔ Test 1.3: router.js registers leaderboard view and silent telemetry feature name');

const dashboardPage = fs.readFileSync(path.join(rootDir, 'src', 'pages', 'dashboard.jsx'), 'utf8');
assert(dashboardPage.includes('id="view-leaderboard"'), 'dashboard.jsx must mount #view-leaderboard container');
assert(dashboardPage.includes('<LeaderboardTab'), 'dashboard.jsx must render LeaderboardTab');
assert(dashboardPage.includes("isActiveView={activeView === 'leaderboard'}"), 'dashboard.jsx must pass isActiveView to LeaderboardTab for 30s poller');
console.log('✔ Test 1.4: dashboard.jsx mounts #view-leaderboard zero-reload SPA view');

// -------------------------------------------------------------
// SECTION 2: Leaderboard Header, Controls, Podium & Table UI
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Leaderboard UI Controls, Top 3 Podium & Top 100 Table ---');

const lbTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx');
assert(fs.existsSync(lbTabPath), 'src/components/tabs/LeaderboardTab.jsx must exist');
const lbTab = fs.readFileSync(lbTabPath, 'utf8');

// Mode tabs & Subject dropdown
assert(lbTab.includes('🏆 Overall Top 100'), 'Must render Overall Top 100 mode tab');
assert(lbTab.includes('📚 Subject-Wise Top 100'), 'Must render Subject-Wise Top 100 mode tab');
assert(lbTab.includes('id="leaderboard-subject-select"'), 'Must render subject selector dropdown for Subject-Wise mode');
assert(lbTab.includes('getAvailableSubjects({ subjectsList: subjects })'), 'Subject dropdown must populate from subjectsList + common subjects');

// Display Name, Privacy Opt-In, Sync Now, Live 30s
assert(lbTab.includes('Your Leaderboard Name'), 'Must include inline editable Your Leaderboard Name control');
assert(lbTab.includes('id="leaderboard-optin-toggle"'), 'Must include Opt-In privacy toggle');
assert(lbTab.includes('🔄 Sync My Hours Now'), 'Must include Sync My Hours Now button');
assert(lbTab.includes('POLL_INTERVAL_MS = 30000'), 'Must configure 30s live auto-refresh polling interval');
assert(lbTab.includes('🟢 Live ('), 'Must render toggleable Live (30s) indicator');
console.log('✔ Test 2.1: Header controls (Mode Tabs, Subject Dropdown, Display Name, Opt-In, Sync Now, Live 30s) verified');

// Top 3 Podium Cards
assert(lbTab.includes('id="leaderboard-podium-grid"'), 'Must render Top 3 Podium grid');
assert(lbTab.includes('Gold • #1') && lbTab.includes('Silver • #2') && lbTab.includes('Bronze • #3'), 'Must display Gold (#1), Silver (#2), and Bronze (#3) podium rank badges');
console.log('✔ Test 2.2: Top 3 Podium Cards (Gold, Silver, Bronze, Subject, Streak, Hours) verified');

// Ranks #4 to #100 Table + Highlight + Sticky Rank Banner
assert(lbTab.includes('Ranks #4 to #100'), 'Must display Ranks #4 to #100 scrollable table');
assert(lbTab.includes('Rank (#)') && lbTab.includes('Student Name') && lbTab.includes('Status / Current Subject') && lbTab.includes('Streak') && lbTab.includes('Hours Logged'), 'Table must render all 5 required columns');
assert(lbTab.includes('🟢 Studying {student.activeSubject}'), 'Table must display pulsing green Studying status when isLiveNow is true');
assert(lbTab.includes('Last studied:'), 'Table must display Last studied status when not live');
assert(lbTab.includes('id="leaderboard-sticky-user-rank"') && lbTab.includes('Your Current Rank'), 'Must pin sticky Your Current Rank banner when student row is outside visible viewport');

// Theme CSS variable styling
assert(lbTab.includes('var(--bg-card)') && lbTab.includes('var(--border-glow)') && lbTab.includes('var(--text-main)') && lbTab.includes('var(--primary)'), 'Must style podiums, cards, and rows using theme CSS variables');
console.log('✔ Test 2.3: Ranks #4-#100 table, live indicators, sticky rank banner, and theme variables verified');

// -------------------------------------------------------------
// SECTION 3: Automatic Background Sync Hooks
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Automatic Background Sync Hooks ---');

const dashboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx'), 'utf8');
assert(dashboardTab.includes('syncStudentToLeaderboard') && dashboardTab.includes('TELEMETRY_URL'), 'DashboardTab.jsx must hook syncStudentToLeaderboard on + Log +30m Study');

const timerTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'TimerTab.jsx'), 'utf8');
assert(timerTab.includes('syncStudentToLeaderboard') && timerTab.includes('startLivePresenceHeartbeat') && timerTab.includes('stopLivePresenceHeartbeat'), 'TimerTab.jsx must hook startLivePresenceHeartbeat, stopLivePresenceHeartbeat, and syncStudentToLeaderboard');
assert(timerTab.includes('activeSubject: selectedSubject'), 'TimerTab.jsx must pass selectedSubject as activeSubject');

const appShell = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppShell.jsx'), 'utf8');
assert(appShell.includes('syncStudentToLeaderboard') && appShell.includes('id="header-sync-now-btn"'), 'AppShell.jsx must trigger syncStudentToLeaderboard when Sync Now in header is clicked');

const dataContext = fs.readFileSync(path.join(rootDir, 'src', 'context', 'DataContext.jsx'), 'utf8');
assert(dataContext.includes('syncStudentToLeaderboard'), 'DataContext.jsx syncNowToDrive must also trigger syncStudentToLeaderboard');

console.log('✔ Test 3.1: All 3 automatic background sync hooks (+30m Study, Focus Timer Start/Complete, Header Sync Now) verified');

// -------------------------------------------------------------
// SECTION 4: Runtime Engine Verification (leaderboard.js)
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Runtime Engine Verification (leaderboard.js) ---');

// Mock localStorage in Node for runtime verification
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};

// Mock fetch to simulate live Google Apps Script TELEMETRY_URL GET & POST
let lastPostBody = null;
let lastGetUrl = null;
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    lastPostBody = JSON.parse(init.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'ok' }) };
  }
  lastGetUrl = String(url);
  const mockRemote = [
    { studentId: 's1', displayName: 'Aarav Top', weeklyHours: 42.5, streak: 19, activeSubject: 'Signals & Systems', isLiveNow: true, subjectHours: { 'Signals & Systems': 22.0, Mathematics: 15.0 } },
    { studentId: 's2', displayName: 'Meera Dev', weeklyHours: 36.0, streak: 12, activeSubject: 'Mathematics', isLiveNow: false, subjectHours: { 'Signals & Systems': 10.5, Mathematics: 18.0 } },
    { studentId: 's3', displayName: 'Kabir CS', weeklyHours: 29.0, streak: 9, activeSubject: 'Computer Science', isLiveNow: true, subjectHours: { 'Computer Science': 20.0 } }
  ];
  return { ok: true, status: 200, text: async () => JSON.stringify({ rankings: mockRemote }) };
};

const lbPath = path.join(rootDir, 'leaderboard.js');
const lbModule = await import(`file://${lbPath.replace(/\\/g, '/')}`);

// 4.1 Subject dropdown aggregation
const subjectsList = lbModule.getAvailableSubjects({
  subjectsList: [{ name: 'Operating Systems' }, { name: 'Mathematics' }]
});
assert(subjectsList[0] === 'Operating Systems', 'User subjects from subjectsList must appear first');
assert(subjectsList.includes('Signals & Systems') && subjectsList.includes('General Studies') && subjectsList.includes('Reasoning'), 'Common subjects must be included');
assert(subjectsList.filter((s) => s.toLowerCase() === 'mathematics').length === 1, 'Duplicate subjects must be deduplicated');
console.log('✔ Test 4.1: getAvailableSubjects merges subjectsList with common subjects cleanly');

// 4.2 Sync student payload
const syncRes = await lbModule.syncStudentToLeaderboard(
  lbModule.TELEMETRY_URL,
  {
    studentId: 'me_101',
    displayName: 'Kuldeep Kumar',
    optedIn: true,
    streakData: { streakCount: 14, todayHours: 3.5, weeklyVelocityHours: 39.0 },
    subjectsList: [
      { name: 'Signals & Systems', completedHours: 16.5 },
      { name: 'Mathematics', completedHours: 12.0 }
    ]
  },
  { activeSubject: 'Signals & Systems', isLiveNow: true }
);
assert(syncRes.success === true, 'syncStudentToLeaderboard must succeed');
assert(lastPostBody && lastPostBody.type === 'leaderboard_sync', 'POST payload must use type: leaderboard_sync');
assert(lastPostBody.activeSubject === 'Signals & Systems' && lastPostBody.isLiveNow === true, 'POST payload must include activeSubject and isLiveNow');
console.log('✔ Test 4.2: syncStudentToLeaderboard dispatches normalized payload to TELEMETRY_URL');

// 4.3 Fetch Overall Top 100 & verify current user merged & ranked
const overall = await lbModule.fetchLeaderboard(lbModule.TELEMETRY_URL, {
  mode: 'overall',
  limit: 100,
  currentUserData: {
    studentId: 'me_101',
    displayName: 'Kuldeep Kumar',
    optedIn: true,
    streakData: { streakCount: 14, todayHours: 3.5, weeklyVelocityHours: 39.0 },
    subjectsList: [{ name: 'Signals & Systems', completedHours: 16.5 }]
  }
});
assert(lastGetUrl.includes('type=leaderboard') && lastGetUrl.includes('mode=overall'), 'fetchLeaderboard must query TELEMETRY_URL with mode=overall');
assert(overall.rankings.length === 4, 'Overall rankings must include remote + merged student');
assert(overall.rankings[0].displayName === 'Aarav Top' && overall.rankings[0].rank === 1, 'Rank #1 must be highest weeklyHours student');
assert(overall.rankings[1].displayName === 'Kuldeep Kumar' && overall.rankings[1].rank === 2, 'Current student with 39.0h must rank #2');
console.log('✔ Test 4.3: fetchLeaderboard (Overall Top 100) sorts descending and computes currentUserRank');

// 4.4 Fetch Subject-Wise Top 100
const subjectWise = await lbModule.fetchLeaderboard(lbModule.TELEMETRY_URL, {
  mode: 'subject',
  subject: 'Signals & Systems',
  limit: 100,
  currentUserData: {
    studentId: 'me_101',
    displayName: 'Kuldeep Kumar',
    optedIn: true,
    streakData: { streakCount: 14, todayHours: 3.5, weeklyVelocityHours: 39.0 },
    subjectsList: [{ name: 'Signals & Systems', completedHours: 16.5 }]
  }
});
assert(lastGetUrl.includes('mode=subject') && lastGetUrl.includes('Signals'), 'Subject mode must pass mode=subject & subject query param');
assert(subjectWise.rankings[0].displayName === 'Aarav Top' && subjectWise.rankings[0].hours === 22.0, 'Subject #1 must have 22.0h in Signals & Systems');
assert(subjectWise.rankings[1].displayName === 'Kuldeep Kumar' && subjectWise.rankings[1].hours === 16.5, 'Current user with 16.5h must rank #2 in Signals & Systems');
assert(!subjectWise.rankings.some((r) => r.displayName === 'Kabir CS'), 'Students with 0h in subject must be excluded from Subject-Wise leaderboard');
console.log('✔ Test 4.4: fetchLeaderboard (Subject-Wise Top 100) filters and sorts by subject hours');

// 4.5 Opt-out privacy check
lbModule.saveLeaderboardSettings({ optedIn: false });
const optedOutRes = await lbModule.fetchLeaderboard(lbModule.TELEMETRY_URL, {
  mode: 'overall',
  limit: 100,
  currentUserData: { studentId: 'me_101', displayName: 'Kuldeep Kumar', optedIn: false }
});
assert(!optedOutRes.rankings.some((r) => r.studentId === 'me_101'), 'Opted-out student must not appear on leaderboard');
assert(optedOutRes.currentUserRank === null, 'Opted-out student must have null currentUserRank');
console.log('✔ Test 4.5: Privacy Opt-Out removes student from leaderboard rankings');

// -------------------------------------------------------------
// SECTION 5: Live Study Room Presence Filter Bar & 3-Minute Heartbeat
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Live Study Room Presence Filter Bar & 3-Minute Focus Timer Heartbeat ---');

// 5.1 Placement & UI elements of #live-study-room-filter-bar
const modeTabsIdx = lbTab.indexOf('id="leaderboard-mode-subject"');
const filterBarIdx = lbTab.indexOf('id="live-study-room-filter-bar"');
const displayNameIdx = lbTab.indexOf('id="leaderboard-display-name-input"');
assert(modeTabsIdx !== -1 && filterBarIdx !== -1 && displayNameIdx !== -1, 'Mode tabs, filter bar, and display name controls must exist');
assert(modeTabsIdx < filterBarIdx && filterBarIdx < displayNameIdx, 'Live Study Room filter bar must sit directly below Mode Tabs');

assert(lbTab.includes('id="live-studying-counter-badge"') && lbTab.includes('Studying Live Now'), 'Must render Live Counter Badge');
assert(lbTab.includes('id="filter-live-study-room-btn"') && lbTab.includes('🟢 Live Study Room Only'), 'Must render Live Study Room Only toggle pill');
assert(lbTab.includes('id="filter-same-subject-btn"') && lbTab.includes('🎯 Same Subject as Me'), 'Must render Same Subject as Me toggle pill');
assert(lbTab.includes('id="live-study-room-empty-state"'), 'Must render clean empty-state card when no other peers are live on subject');
assert(lbTab.includes("leading the grind! No other peers are live on"), 'Empty-state card must render the motivating peer message');
console.log('✔ Test 5.1: Live Study Room filter strip, toggle pills, live counter badge, and empty-state card verified');

// 5.2 Focus Timer & app.js 3-minute heartbeat wiring
const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
assert(appJs.includes('startLivePresenceHeartbeat') && appJs.includes('stopLivePresenceHeartbeat'), 'app.js must export and integrate startLivePresenceHeartbeat & stopLivePresenceHeartbeat');
assert(timerTab.includes('startLivePresenceHeartbeat(TELEMETRY_URL, getCurrentStatsPayload)'), 'TimerTab.jsx must call startLivePresenceHeartbeat(TELEMETRY_URL, getCurrentStatsPayload) on start/resume');
assert(timerTab.includes('stopLivePresenceHeartbeat()'), 'TimerTab.jsx must call stopLivePresenceHeartbeat() on pause/stop');
console.log('✔ Test 5.2: Focus Timer & app.js 3-minute presence heartbeat hooks verified');

// 5.3 Runtime tests for filterLeaderboardEntries & getLiveStudyingCount
const samplePool = [
  { rank: 1, studentId: 'a1', displayName: 'Aarav', activeSubject: 'Signals & Systems', isLiveNow: true },
  { rank: 2, studentId: 'a2', displayName: 'Meera', activeSubject: 'Mathematics', isLiveNow: true },
  { rank: 3, studentId: 'a3', displayName: 'Rohan', activeSubject: 'Signals & Systems', isLiveNow: false },
  { rank: 4, studentId: 'a4', displayName: 'Priya', activeSubject: 'Physics', isLiveNow: false }
];

assert(lbModule.getLiveStudyingCount(samplePool) === 2, 'getLiveStudyingCount must count entries where isLiveNow === true');

const liveOnlyFiltered = lbModule.filterLeaderboardEntries(samplePool, { liveOnly: true });
assert(liveOnlyFiltered.length === 2 && liveOnlyFiltered.every((e) => e.isLiveNow === true), 'liveOnly filter must return only active live students');

const sameSubjFiltered = lbModule.filterLeaderboardEntries(samplePool, { sameSubjectOnly: true, currentUserSubject: 'Signals & Systems' });
assert(sameSubjFiltered.length === 2 && sameSubjFiltered.every((e) => e.activeSubject === 'Signals & Systems'), 'sameSubjectOnly filter must match currentUserSubject');

const combinedFiltered = lbModule.filterLeaderboardEntries(samplePool, { liveOnly: true, sameSubjectOnly: true, currentUserSubject: 'Signals & Systems' });
assert(combinedFiltered.length === 1 && combinedFiltered[0].studentId === 'a1', 'Combined liveOnly + sameSubjectOnly filter must return Aarav');

const noMatchFiltered = lbModule.filterLeaderboardEntries(samplePool, { liveOnly: true, sameSubjectOnly: true, currentUserSubject: 'Physics' });
assert(noMatchFiltered.length === 0, 'Combined filter with no live peers on Physics must return 0 matches');
console.log('✔ Test 5.3: getLiveStudyingCount and filterLeaderboardEntries runtime behavior verified');

// 5.4 Runtime tests for 3-minute Live Presence Heartbeat
assert(lbModule.LIVE_HEARTBEAT_INTERVAL_MS === 180000, 'Default presence heartbeat interval must be exactly 3 minutes (180,000ms)');

lbModule.saveLeaderboardSettings({ optedIn: true, displayName: 'Kuldeep Kumar' });
lastPostBody = null;
const hbStart = lbModule.startLivePresenceHeartbeat(
  lbModule.TELEMETRY_URL,
  () => ({
    studentId: 'me_101',
    displayName: 'Kuldeep Kumar',
    activeSubject: 'Signals & Systems',
    streakData: { streakCount: 15, todayHours: 2.0, weeklyVelocityHours: 14.0 }
  })
);
assert(hbStart.active === true && hbStart.intervalMs === 180000, 'startLivePresenceHeartbeat must activate 3-minute interval');
assert(lbModule.isLivePresenceHeartbeatRunning() === true, 'isLivePresenceHeartbeatRunning() must return true while running');
// Give immediate async fetch promise a microtask to run
await new Promise((r) => setTimeout(r, 20));
assert(lastPostBody && lastPostBody.isLiveNow === true && lastPostBody.activeSubject === 'Signals & Systems', 'Heartbeat start must immediately dispatch isLiveNow: true with activeSubject');

lastPostBody = null;
const hbStop = lbModule.stopLivePresenceHeartbeat();
assert(hbStop.active === false && lbModule.isLivePresenceHeartbeatRunning() === false, 'stopLivePresenceHeartbeat must stop interval');
await new Promise((r) => setTimeout(r, 20));
assert(lastPostBody && lastPostBody.isLiveNow === false, 'stopLivePresenceHeartbeat must send isLiveNow: false idle update');
console.log('✔ Test 5.4: startLivePresenceHeartbeat (immediate + 3m interval) & stopLivePresenceHeartbeat runtime verified');

console.log('\n=== ALL REAL-TIME LEADERBOARD TESTS PASSED SUCCESSFULLY! ===\n');

