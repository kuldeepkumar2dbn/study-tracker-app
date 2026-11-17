/**
 * Test Suite: Role-Based Access Gating & Read-Only Demo Preview Mode
 * tests/test-role-based-access-gating.js
 *
 * Verifies:
 * 1. isUserAuthenticated() distinguishes genuine Google OAuth login from Guests & local Demo Sandbox
 * 2. Read-Only Demo Preview Mode in #view-profile & profile.js:
 *    - Guest can open #view-profile and view Live Student ID Card with generic "Guest Demo" badge
 *    - Every input, select, textarea, privacy toggle, and Save Profile & Sync button is disabled with opacity-60 cursor-not-allowed
 *    - Prominent top Demo Preview banner with exact copy & working Sign In with Google CTA
 *    - saveStudentProfile blocks guest saves and unlocks cleanly upon Google OAuth sign-in
 *    - applyProfileDemoMode locks/unlocks DOM controls cleanly on auth transition
 * 3. Locked Feature Gate for Guests (sidebar.js, CollapsibleSidebar.jsx, DashboardTab.jsx, LeaderboardTab.jsx, app.js):
 *    - Basic local tools (Dashboard, Focus Timer, Daily Routine, Calendar) remain accessible
 *    - My Profile is marked as "Demo", Leaderboard sync / Drive Notes / AI Study Coach display minimal 🔒 icons
 *    - Guest sessions are strictly prevented from pushing entries or live heartbeats to StudyTracker_Admin_DB Leaderboard
 * 4. Theme compatibility (Dark themes + Onyx & Gold [data-theme="black-gold"])
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

console.log('\n=== RUNNING ROLE-BASED ACCESS GATING & DEMO PREVIEW TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Static UI & Architecture Verification
// -------------------------------------------------------------
console.log('--- SECTION 1: #view-profile Read-Only Demo Preview & Theme Compatibility ---');

const profileTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'ProfileTab.jsx'), 'utf8');
assert(
  profileTab.includes('isUserAuthenticated'),
  'ProfileTab.jsx must check Google OAuth login status via isUserAuthenticated()'
);
assert(
  profileTab.includes('id="profile-demo-preview-banner"'),
  'ProfileTab.jsx must render top #profile-demo-preview-banner when not logged in'
);
assert(
  profileTab.includes('👀 Demo Preview Mode — Sign in with Google to claim your custom @username, edit your profile, and sync to the Leaderboard'),
  'Demo Preview banner must display exact prompt message'
);
assert(
  profileTab.includes('id="profile-demo-signin-btn"') && profileTab.includes("openAuthModal('profile', '#profile')"),
  'Demo Preview banner must include working Sign In with Google button'
);
assert(
  profileTab.includes('id="profile-guest-demo-badge"') && profileTab.includes('Guest Demo'),
  'Live Student ID Card Preview must show generic "Guest Demo" badge when not logged in'
);
assert(
  profileTab.includes('opacity-60 cursor-not-allowed') && profileTab.includes('disabled={isDemoPreview}'),
  'ProfileTab.jsx must disable inputs/dropdowns/textarea/toggle and apply opacity-60 cursor-not-allowed in Demo Preview'
);
assert(
  profileTab.includes('disabled={isDemoPreview || isSaving || !usernameCheck.valid}'),
  'Save Profile & Sync button must be disabled in Demo Preview mode'
);
assert(
  profileTab.includes('if (isDemoPreview) {') && profileTab.includes('requireAuth: true'),
  'handleSaveProfile must hard-block saves in Demo Preview mode'
);

const indexCss = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf8');
assert(
  indexCss.includes('[data-theme="black-gold"] #profile-demo-preview-banner') &&
  indexCss.includes('[data-theme="black-gold"] #student-profile-form input:disabled'),
  'src/index.css must style Demo Preview banner and disabled form states cleanly for Onyx & Gold theme'
);
console.log('✔ Test 1.1: #view-profile Demo Preview banner, Guest Demo badge, disabled form states, and Onyx & Gold styles verified');

// -------------------------------------------------------------
// SECTION 2: Sidebar, AI Study Coach & Leaderboard Guest Gating UI
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Sidebar, AI Study Coach & Leaderboard Guest Gating UI ---');

const collapsibleSidebar = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx'), 'utf8');
assert(
  collapsibleSidebar.includes('id="sidebar-profile-demo-badge"') && collapsibleSidebar.includes('>Demo<') || collapsibleSidebar.includes('Demo'),
  'CollapsibleSidebar.jsx must mark My Profile as Demo for non-logged-in visitors'
);
assert(
  collapsibleSidebar.includes('isGuestLeaderboardSyncLocked') && collapsibleSidebar.includes('showLockIndicator'),
  'CollapsibleSidebar.jsx must display minimal 🔒 icon next to Leaderboard sync & Drive Notes for guests'
);

const dashboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx'), 'utf8');
assert(
  dashboardTab.includes('id="ai-coach-guest-lock-icon"') && dashboardTab.includes('🔒'),
  'DashboardTab.jsx must display minimal 🔒 icon next to AI Study Coach for guests'
);
assert(
  dashboardTab.includes('id="ai-coach-signin-btn"') && dashboardTab.includes("openAuthModal('ai-coach'"),
  'DashboardTab.jsx must offer Google Sign-In CTA inside gated AI Study Coach diagnostics'
);

const leaderboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx'), 'utf8');
assert(
  leaderboardTab.includes('id="leaderboard-guest-sync-gate"') && leaderboardTab.includes('id="leaderboard-guest-signin-btn"'),
  'LeaderboardTab.jsx must display guest sync lock notice with Sign In with Google CTA'
);
assert(
  leaderboardTab.includes('disabled={isGuestSyncLocked}') && leaderboardTab.includes('disabled={isSyncing || isGuestSyncLocked}'),
  'LeaderboardTab.jsx must disable display name, opt-in toggle, and Sync My Hours Now button for guests'
);

const appShell = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppShell.jsx'), 'utf8');
assert(
  appShell.includes("isGoogleAuthenticated ? (studentProfile?.handle || '@focused_scholar') : 'Guest Demo'"),
  'Top header profile pill must display Guest Demo when visitor is not Google-authenticated'
);
console.log('✔ Test 2.1: Sidebar (Demo + 🔒), AI Study Coach (🔒), Leaderboard sync gate, and Header Guest Demo pill verified');

// -------------------------------------------------------------
// SECTION 3: Runtime Verification (Guest vs Demo Sandbox vs Google OAuth)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Runtime Auth Gating & Leaderboard Sync Blocking ---');

// Simulate browser environment
const localMap = new Map();
const sessionMap = new Map();
const dispatchedEvents = [];

globalThis.localStorage = {
  get length() { return localMap.size; },
  key: (i) => Array.from(localMap.keys())[i] ?? null,
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};
globalThis.sessionStorage = {
  get length() { return sessionMap.size; },
  key: (i) => Array.from(sessionMap.keys())[i] ?? null,
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
  setItem: (k, v) => sessionMap.set(k, String(v)),
  removeItem: (k) => sessionMap.delete(k),
  clear: () => sessionMap.clear()
};
globalThis.document = {
  cookie: '',
  readyState: 'complete',
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {}
};
globalThis.window = {
  location: { protocol: 'https:', hostname: 'studyflow.app', pathname: '/index.html', hash: '#profile' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (evt) => dispatchedEvents.push(evt)
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

let fetchPostCalls = 0;
let lastPostBody = null;
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    const isLeaderboardPost = String(url).includes('script.google.com') || String(init.body || '').includes('leaderboard_sync');
    if (isLeaderboardPost) {
      fetchPostCalls += 1;
      try {
        lastPostBody = JSON.parse(init.body);
      } catch {
        lastPostBody = null;
      }
    }
    return { ok: true, status: 200, json: async () => ({ id: 'mock_file_1', success: true }), text: async () => JSON.stringify({ success: true }) };
  }
  const payload = {
    files: [],
    rankings: [
      { studentId: 'google_real_1', displayName: '@real_student', weeklyHours: 18.5, streak: 7, activeSubject: 'Mathematics', isLiveNow: true }
    ]
  };
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
};

const authGuard = await import(`file://${path.join(rootDir, 'auth-guard.js').replace(/\\/g, '/')}`);
const profileMod = await import(`file://${path.join(rootDir, 'profile.js').replace(/\\/g, '/')}`);
const lbMod = await import(`file://${path.join(rootDir, 'leaderboard.js').replace(/\\/g, '/')}`);
const sidebarMod = await import(`file://${path.join(rootDir, 'sidebar.js').replace(/\\/g, '/')}`);

// 3.1 Guest (Not Logged In)
assert(authGuard.isUserAuthenticated() === false, 'Unauthenticated guest must return isUserAuthenticated() === false');
const guestAccess = profileMod.getProfileAccessState();
assert(
  guestAccess.isAuthenticated === false && guestAccess.isReadOnlyDemo === true && guestAccess.badgeLabel === 'Guest Demo',
  'Guest profile access state must be Read-Only Demo with Guest Demo badge'
);

// Guest cannot save profile
const guestSave = profileMod.saveStudentProfile({
  username: 'guest_hacker',
  fullName: 'Guest User',
  bio: 'Should not save'
});
assert(guestSave.success === false && guestSave.blocked === true && guestSave.reason === 'auth_required', 'saveStudentProfile must block guest writes');
assert(localStorage.getItem('studytracker_student_profile') === null, 'Blocked guest save must not write to localStorage');

// Guest cannot push to public Leaderboard or start live heartbeat
fetchPostCalls = 0;
const guestLbSync = await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  streakData: { streakCount: 3, todayHours: 2.0, weeklyVelocityHours: 8.0 }
});
assert(guestLbSync.success === false && guestLbSync.blocked === true && guestLbSync.reason === 'auth_required', 'syncStudentToLeaderboard must block guest pushes');
assert(fetchPostCalls === 0, 'Guest leaderboard sync must make zero POST requests to StudyTracker_Admin_DB');

const guestHeartbeat = lbMod.startLivePresenceHeartbeat(lbMod.TELEMETRY_URL, () => ({ activeSubject: 'Physics' }));
assert(guestHeartbeat.active === false && guestHeartbeat.blocked === true, 'startLivePresenceHeartbeat must block guest presence pings');
assert(fetchPostCalls === 0, 'Blocked guest heartbeat must make zero POST requests');

// Guest can still fetch & view public Leaderboard without injecting guest row
const guestBoard = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  currentUserData: { isGuest: true, streakData: { todayHours: 5.0, weeklyVelocityHours: 25.0 } }
});
assert(guestBoard.rankings.length === 1 && guestBoard.rankings[0].displayName === '@real_student', 'Guest can view real rankings without injecting guest row');
assert(guestBoard.currentUserRank === null, 'Guest must have null currentUserRank');
console.log('✔ Test 3.1: Guest read-only profile block & public Leaderboard sync block verified');

// 3.2 Local Demo Sandbox Session (still NOT genuine Google OAuth)
sessionStorage.setItem('studyflow_is_demo_mode', 'true');
sessionStorage.setItem('studyflow_demo_end_time', String(Date.now() + 60000));
assert(authGuard.isUserAuthenticated() === false, 'Local Demo Sandbox session must NOT count as Google OAuth authentication');
const demoLbSync = await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  userProfile: { sub: 'demo_sandbox_user', email: 'demo@studyflow.local', isDemo: true }
});
assert(demoLbSync.blocked === true && fetchPostCalls === 0, 'Demo sandbox session must also be blocked from pushing to public Leaderboard');
authGuard.clearDemoSession();
console.log('✔ Test 3.2: Local Demo Sandbox properly stays gated from profile writes & public Leaderboard sync');

// 3.3 Sidebar Guest Access Policy
for (const localView of ['dashboard', 'timer', 'routine', 'calendar']) {
  const s = sidebarMod.getSidebarGuestState(localView, false);
  assert(s.accessible === true && s.isLocked === false && s.badge === null, `Local tool ${localView} must stay accessible to guests without lock badge`);
}
const profileSidebarState = sidebarMod.getSidebarGuestState('profile', false);
assert(profileSidebarState.accessible === true && profileSidebarState.isDemoPreview === true && profileSidebarState.badge === 'Demo', 'My Profile must be accessible in Demo mode with "Demo" badge');

const lbSidebarState = sidebarMod.getSidebarGuestState('leaderboard', false);
assert(lbSidebarState.accessible === true && lbSidebarState.isSyncLocked === true && lbSidebarState.badge === '🔒', 'Leaderboard must show minimal 🔒 icon for guest sync gating');

const notesSidebarState = sidebarMod.getSidebarGuestState('notes', false);
assert(notesSidebarState.accessible === false && notesSidebarState.isLocked === true && notesSidebarState.badge === '🔒', 'Drive Notes must be locked with minimal 🔒 icon for guests');
console.log('✔ Test 3.3: Sidebar role-based access rules (local tools, My Profile Demo, Leaderboard 🔒, Drive Notes 🔒) verified');

// 3.4 DOM applyProfileDemoMode lock -> unlock on Google Sign-In
const makeMockControl = (id) => {
  const classes = new Set();
  const attrs = new Map();
  return {
    id,
    disabled: false,
    value: 'GATE',
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c)
    },
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k)
  };
};
const mockControls = [
  makeMockControl('profile-username-input'),
  makeMockControl('profile-target-exam-select'),
  makeMockControl('profile-bio-input'),
  makeMockControl('profile-leaderboard-visibility-toggle'),
  makeMockControl('save-profile-sync-btn')
];
const mockBanner = { hidden: false };
const mockContainer = {
  querySelector: (sel) => (sel === '#profile-demo-preview-banner' ? mockBanner : mockContainer),
  querySelectorAll: () => mockControls
};

const lockedResult = profileMod.applyProfileDemoMode(mockContainer);
assert(lockedResult.isReadOnlyDemo === true && lockedResult.lockedCount === 5, 'applyProfileDemoMode must lock all 5 controls for guests');
assert(mockBanner.hidden === false, 'Demo banner must be visible for guests');
assert(mockControls.every((c) => c.disabled === true && c.classList.contains('opacity-60') && c.classList.contains('cursor-not-allowed')), 'All controls must have disabled=true and opacity-60 cursor-not-allowed for guests');

// Now simulate Google OAuth Sign-In
authGuard.saveUserSession({
  sub: 'google_oauth_999',
  name: 'Kuldeep Kumar',
  email: 'kuldeep@gmail.com',
  picture: 'https://example.com/avatar.png'
}, 'fake_access_token_xyz', 3600);

assert(authGuard.isUserAuthenticated() === true, 'Authenticated Google user must return isUserAuthenticated() === true');
const unlockedResult = profileMod.applyProfileDemoMode(mockContainer);
assert(unlockedResult.isAuthenticated === true && unlockedResult.isReadOnlyDemo === false, 'applyProfileDemoMode must unlock controls after Google Sign-In');
assert(mockBanner.hidden === true, 'Demo banner must hide automatically after Google Sign-In');
assert(mockControls.every((c) => c.disabled === false && !c.classList.contains('opacity-60') && !c.classList.contains('cursor-not-allowed')), 'All controls must unlock cleanly after Google Sign-In');

// Authenticated Google user CAN save profile and CAN sync to public Leaderboard
const authedSave = profileMod.saveStudentProfile({
  username: 'kuldeep_real',
  fullName: 'Kuldeep Kumar',
  age: 22,
  targetExam: 'GATE',
  dailyGoalHours: 6,
  bio: 'Focused daily grind.',
  showOnLeaderboard: true
});
assert(authedSave.success === true && authedSave.profile.handle === '@kuldeep_real', 'Google-authenticated user must be able to save profile');

fetchPostCalls = 0;
const authedLbSync = await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  streakData: { streakCount: 5, todayHours: 2.5, weeklyVelocityHours: 14.0 },
  subjectsList: [{ name: 'Signals & Systems', completedHours: 14.0 }]
});
assert(authedLbSync.success === true && !authedLbSync.blocked && fetchPostCalls === 1, 'Google-authenticated user must sync cleanly to public Leaderboard');
assert(lastPostBody && lastPostBody.displayName === '@kuldeep_real', 'Authenticated leaderboard sync must carry custom @username');
console.log('✔ Test 3.4: Automatic profile unlock, banner hiding, profile save, and Leaderboard sync upon Google OAuth Sign-In verified');

console.log('\n=== ALL ROLE-BASED ACCESS GATING & DEMO PREVIEW TESTS PASSED SUCCESSFULLY! ===\n');
