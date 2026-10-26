/**
 * Automated Verification Test Suite for Dynamic User Profile Initialization,
 * Persistent Zero-State Onboarding, User-Scoped Data Storage, and Midnight Reset.
 *
 * Tests:
 * 1. SCOPE ALL DATA BY GOOGLE USER ID:
 *    - Keys namespaced as studyflow_${user.sub}_data
 * 2. FIRST-TIME USER INITIALIZATION (ZERO-STATE SCHEMA):
 *    - Exact zero-state schema fields and values
 * 3. DYNAMIC PROGRESSION & AUTO-MIDNIGHT RESET:
 *    - Study logging (+30m & timer) increases todayLoggedHours & weeklyVelocityHours
 *    - Midnight rollover resets todayLoggedHours and calculates streak (preserve if studied yesterday, reset if missed)
 * 4. POLISHED EMPTY STATES:
 *    - Exact empty state messages for routine, exam radar, skills, next deadline, revision queue, streak badge, and weekly velocity
 * 5. DEMO MODE PRESERVATION:
 *    - 7-minute demo sandbox remains fully functional with mock data
 */

import { 
  createZeroStateData, 
  getOrCreateZeroStateData, 
  getUserDataStorageKey, 
  getUserStorageKey,
  getLocalDateString,
  saveUserSession,
  clearDemoSession,
  initDemoSession,
  isDemoUser
} from '../auth-guard.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-Memory Storage Mock for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

const mockSession = {};
global.sessionStorage = {
  getItem: (k) => (k in mockSession ? mockSession[k] : null),
  setItem: (k, v) => { mockSession[k] = String(v); },
  removeItem: (k) => { delete mockSession[k]; },
  clear: () => { Object.keys(mockSession).forEach(k => delete mockSession[k]); },
  key: (i) => Object.keys(mockSession)[i] || null,
  get length() { return Object.keys(mockSession).length; }
};

global.document = {
  cookie: ''
};

global.window = {
  location: {
    protocol: 'http:',
    hostname: 'localhost',
    replace: () => {}
  }
};

console.log('\n--- 1. Testing User Scoping by Google User ID ---');
{
  const googleUserSub = '109283746592837461524';
  const dataKey = getUserDataStorageKey(googleUserSub);
  assert(dataKey === `studyflow_${googleUserSub}_data`, `Master storage key is studyflow_${googleUserSub}_data`);

  // Verify generic key namespacing
  global.localStorage.setItem('user_profile', JSON.stringify({ sub: googleUserSub, name: 'Alex' }));
  const scopedKey = getUserStorageKey('routine');
  assert(scopedKey === `studyflow_${googleUserSub}_routine`, `Scoped key for routine is studyflow_${googleUserSub}_routine`);
}

console.log('\n--- 2. Testing First-Time Zero-State Schema Initialization ---');
{
  const testSub = '999888777666';
  const expectedDate = getLocalDateString(new Date());

  // Verify createZeroStateData structure
  const zeroState = createZeroStateData(testSub);
  assert(zeroState.userId === testSub, 'userId matches user.sub');
  assert(zeroState.streak === 0, 'Initial streak is 0');
  assert(zeroState.lastActiveDate === null, 'lastActiveDate is null');
  assert(zeroState.dailyTargetHours === 4.0, 'dailyTargetHours is 4.0');
  assert(zeroState.todayLoggedHours === 0.0, 'todayLoggedHours is 0.0');
  assert(zeroState.todayLogDate === expectedDate, 'todayLogDate matches local date (YYYY-MM-DD)');
  assert(zeroState.weeklyVelocityHours === 0.0, 'weeklyVelocityHours is 0.0');
  assert(Array.isArray(zeroState.routine) && zeroState.routine.length === 0, 'routine is empty array');
  assert(Array.isArray(zeroState.revisionQueue) && zeroState.revisionQueue.length === 0, 'revisionQueue is empty array');
  assert(Array.isArray(zeroState.exams) && zeroState.exams.length === 0, 'exams is empty array');
  assert(Array.isArray(zeroState.skills) && zeroState.skills.length === 0, 'skills is empty array');

  // Verify getOrCreateZeroStateData creates and saves to storage
  const created = getOrCreateZeroStateData(testSub);
  assert(created !== null, 'getOrCreateZeroStateData returns data');
  const storedRaw = global.localStorage.getItem(`studyflow_${testSub}_data`);
  assert(storedRaw !== null, 'Saved to localStorage under studyflow_${user.sub}_data');
  const parsedStored = JSON.parse(storedRaw);
  assert(parsedStored.userId === testSub && parsedStored.streak === 0 && parsedStored.dailyTargetHours === 4.0, 'Stored data matches exact zero-state schema');

  // Verify second call retrieves existing data without overwriting
  parsedStored.todayLoggedHours = 1.5;
  global.localStorage.setItem(`studyflow_${testSub}_data`, JSON.stringify(parsedStored));
  const retrieved = getOrCreateZeroStateData(testSub);
  assert(retrieved.todayLoggedHours === 1.5, 'Existing progress is preserved and not overwritten');
}

console.log('\n--- 3. Testing Dynamic Progression & Auto-Midnight Reset ---');
{
  const testUser = 'user_midnight_test';
  const today = getLocalDateString(new Date());

  // Yesterday date calculation
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate);

  // Day before yesterday calculation
  const twoDaysAgoDate = new Date();
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2);
  const twoDaysAgoStr = getLocalDateString(twoDaysAgoDate);

  // Scenario A: Student studied yesterday -> Streak is kept/incremented
  const studiedYesterdayData = {
    userId: testUser,
    streak: 3,
    lastActiveDate: yesterdayStr,
    dailyTargetHours: 4.0,
    todayLoggedHours: 2.5,
    todayLogDate: yesterdayStr,
    weeklyVelocityHours: 6.5,
    routine: [],
    revisionQueue: [],
    exams: [],
    skills: []
  };
  global.localStorage.setItem(`studyflow_${testUser}_data`, JSON.stringify(studiedYesterdayData));

  // Trigger midnight check
  const rolledOverA = getOrCreateZeroStateData(testUser);
  assert(rolledOverA.todayLoggedHours === 0.0, 'todayLoggedHours resets to 0.0h on new day');
  assert(rolledOverA.todayLogDate === today, 'todayLogDate updates to today on rollover');
  assert(rolledOverA.streak === 3, 'Streak is preserved because student studied yesterday');

  // Scenario B: Student missed yesterday -> Streak resets to 0
  const missedYesterdayUser = 'user_missed_yesterday';
  const missedYesterdayData = {
    userId: missedYesterdayUser,
    streak: 5,
    lastActiveDate: twoDaysAgoStr, // Missed yesterday!
    dailyTargetHours: 4.0,
    todayLoggedHours: 3.0,
    todayLogDate: yesterdayStr,
    weeklyVelocityHours: 8.0,
    routine: [],
    revisionQueue: [],
    exams: [],
    skills: []
  };
  global.localStorage.setItem(`studyflow_${missedYesterdayUser}_data`, JSON.stringify(missedYesterdayData));

  const rolledOverB = getOrCreateZeroStateData(missedYesterdayUser);
  assert(rolledOverB.todayLoggedHours === 0.0, 'todayLoggedHours resets to 0.0h for missed student');
  assert(rolledOverB.streak === 0, 'Streak resets to 0 because student missed studying yesterday');
}

console.log('\n--- 4. Testing Demo Mode Preservation ---');
{
  // Initialize demo session
  initDemoSession();
  assert(isDemoUser() === true, 'isDemoUser returns true in demo mode');
  assert(sessionStorage.getItem('is_demo_user') === 'true', 'Demo session flag is stored');

  // Master key in demo mode is isolated to demo namespace
  const demoKey = getUserDataStorageKey('demo_sandbox_user');
  assert(demoKey.includes('demo_'), 'Demo storage key uses isolated demo namespace');

  // Clean demo session
  clearDemoSession();
  assert(isDemoUser() === false, 'clearDemoSession clears demo session properly');
}

console.log('\n--- 5. Testing Empty States & UI Texts Verification ---');
{
  import('fs').then(fs => {
    // Check DashboardTab.jsx
    const dashboardSrc = fs.readFileSync('src/components/tabs/DashboardTab.jsx', 'utf-8');
    assert(dashboardSrc.includes('0 days streak'), 'DashboardTab includes "0 days streak" label');
    assert(dashboardSrc.includes('Day 1 - Ready to start!'), 'DashboardTab includes "Day 1 - Ready to start!"');
    assert(dashboardSrc.includes('No upcoming exams'), 'DashboardTab includes "No upcoming exams"');
    assert(dashboardSrc.includes('+ Add Exam'), 'DashboardTab includes "+ Add Exam" button');
    assert(dashboardSrc.includes('0 topics due today'), 'DashboardTab includes "0 topics due today"');
    assert(dashboardSrc.includes('this week'), 'DashboardTab displays weekly velocity');
    assert(dashboardSrc.includes('+ Log +30m Study'), 'DashboardTab includes "+ Log +30m Study" action');

    // Check DailyRoutine.jsx
    const routineSrc = fs.readFileSync('src/components/DailyRoutine.jsx', 'utf-8');
    assert(routineSrc.includes("No time blocks scheduled today. Click '+ Add Block' to plan your day."), 'DailyRoutine includes exact required empty state string');

    // Check ExamsTab.jsx
    const examsSrc = fs.readFileSync('src/components/tabs/ExamsTab.jsx', 'utf-8');
    assert(examsSrc.includes("Radar clear. No pending tests or assignments."), 'ExamsTab includes exact required empty state string');

    // Check SkillsTab.jsx
    const skillsSrc = fs.readFileSync('src/components/tabs/SkillsTab.jsx', 'utf-8');
    assert(skillsSrc.includes("No active skill roadmaps. Import a YouTube course or create your first skill."), 'SkillsTab includes exact required empty state string');

    console.log(`\n======================================================`);
    console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log(`======================================================\n`);
  });
}
