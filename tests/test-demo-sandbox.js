import { strict as assert } from 'node:assert';
import { getFreshDemoTemplateData, DEMO_STORAGE_PREFIX, DEMO_KEYS, DEMO_SESSION_DURATION_MS } from '../src/utils/demoTemplate.js';

// Setup Mock DOM Storage Environment for Node
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store.hasOwnProperty(key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

globalThis.sessionStorage = new MockStorage();
globalThis.localStorage = new MockStorage();
globalThis.document = { cookie: '' };
globalThis.window = {
  location: {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/index.html',
    search: '',
    replace: (url) => { window.location.pathname = url; }
  }
};

// Dynamically import auth-guard
const authGuard = await import('../auth-guard.js');

console.log('--- RUNNING 7-MINUTE DEMO SANDBOX SUITE ---');

// Test 1: Fresh Demo State Initialization
{
  // Pre-pollute demo and real storage
  localStorage.setItem('studyflow_data_realuser123_subjects', JSON.stringify([{ id: 'real-1' }]));
  sessionStorage.setItem('demo_tracker_data_custom_garbage', 'old-junk');
  localStorage.setItem('demo_tracker_data_custom_garbage', 'old-junk');

  authGuard.initDemoSession();

  assert.equal(sessionStorage.getItem('is_demo_user'), 'true', 'is_demo_user should be true in sessionStorage');
  assert.equal(localStorage.getItem('is_demo_user'), 'true', 'is_demo_user should be true in localStorage');

  const endTimeStr = sessionStorage.getItem('demo_session_end');
  assert.ok(endTimeStr, 'demo_session_end should be set');
  const endTime = Number(endTimeStr);
  const now = Date.now();
  assert.ok(endTime > now && endTime <= now + 7 * 60 * 1000 + 5000, 'End time should be ~7 minutes from now');

  // Verify old garbage demo keys were wiped
  assert.equal(sessionStorage.getItem('demo_tracker_data_custom_garbage'), null, 'Old demo keys must be wiped');
  assert.equal(localStorage.getItem('demo_tracker_data_custom_garbage'), null, 'Old demo keys in localStorage must be wiped');

  // Verify real user data was completely untouched
  assert.notEqual(localStorage.getItem('studyflow_data_realuser123_subjects'), null, 'Real user data must NEVER be deleted');

  // Verify fresh template data populated
  const subjectsRaw = sessionStorage.getItem('demo_tracker_data_subjects');
  assert.ok(subjectsRaw, 'Template subjects should be populated');
  const subjects = JSON.parse(subjectsRaw);
  assert.ok(subjects.some(s => s.code === 'CS-301'), 'Contains CS-301');

  const examsRaw = sessionStorage.getItem('demo_tracker_data_exams');
  assert.ok(examsRaw, 'Template exams should be populated');
  const exams = JSON.parse(examsRaw);
  assert.ok(exams.some(e => e.title.includes('Midterm')), 'Contains sample midterm');

  const routineRaw = sessionStorage.getItem('demo_tracker_data_routine_slots');
  assert.ok(routineRaw, 'Template routine slots should be populated');
  const routine = JSON.parse(routineRaw);
  assert.equal(routine.length, 5, 'Contains 5 starter routine blocks');

  console.log('✔ Test 1 Passed: Fresh Demo State Initialization & Pristine Template Data');
}

// Test 2: Live Countdown Timer & Expiration Handling
{
  assert.equal(authGuard.isDemoUser(), true, 'isDemoUser should be true when active');
  const remainingSec = authGuard.getDemoRemainingSeconds();
  assert.ok(remainingSec > 400 && remainingSec <= 420, `Remaining seconds should be ~420s (got ${remainingSec})`);

  // Simulate timer expiry: set demo_session_end into the past
  sessionStorage.setItem('demo_session_end', String(Date.now() - 1000));
  localStorage.setItem('demo_session_end', String(Date.now() - 1000));

  assert.equal(authGuard.isDemoUser(), false, 'isDemoUser should be false when expired');
  assert.equal(authGuard.getDemoRemainingSeconds(), 0, 'getDemoRemainingSeconds should be 0 when expired');

  // Verify keys were wiped on expiry check
  assert.equal(sessionStorage.getItem('is_demo_user'), null, 'is_demo_user removed on expiry');
  assert.equal(sessionStorage.getItem('demo_tracker_data_subjects'), null, 'demo subjects removed on expiry');

  console.log('✔ Test 2 Passed: 7-Minute Timer & Expiration Cleanup');
}

// Test 3: Total Data Isolation & Reset Guarantee
{
  // Initialize fresh demo
  authGuard.initDemoSession();
  assert.equal(authGuard.isDemoUser(), true);

  // Storage key namespacing in demo mode
  const key = authGuard.getUserStorageKey('exams');
  assert.equal(key, 'demo_tracker_data_exams', 'getUserStorageKey should strictly return demo namespace in demo mode');

  // Mutate demo data (e.g. user adds a new exam)
  const exams = JSON.parse(sessionStorage.getItem('demo_tracker_data_exams'));
  exams.push({ id: 'dl-user-custom', title: 'Demo User Custom Exam', isCompleted: false });
  sessionStorage.setItem('demo_tracker_data_exams', JSON.stringify(exams));

  // Verify real user storage key is NOT present or touched
  assert.equal(localStorage.getItem('studyflow_data_demo_sandbox_user_exams'), null, 'Never writes to standard studyflow_data_ keys in demo');

  // Verify mutation is in demo
  const mutatedExams = JSON.parse(sessionStorage.getItem('demo_tracker_data_exams'));
  assert.equal(mutatedExams.length, 5, 'Mutated demo exams has 5');

  // Now, re-initialize demo (simulating user clicking Instant Demo Sign-In again)
  authGuard.initDemoSession();

  const resetExams = JSON.parse(sessionStorage.getItem('demo_tracker_data_exams'));
  assert.equal(resetExams.length, 4, 'Demo data must completely reset to pristine starter template');
  assert.ok(!resetExams.some(e => e.id === 'dl-user-custom'), 'Custom user exam must be gone after re-login');

  console.log('✔ Test 3 Passed: Total Data Isolation & Pristine Reset Guarantee');
}

// Test 4: Real User Login Clears Demo Session
{
  assert.equal(authGuard.isDemoUser(), true);
  authGuard.saveUserSession({
    sub: 'real_google_user_999',
    name: 'Real Student',
    email: 'student@university.edu',
    picture: ''
  }, 'mock_oauth_token');

  assert.equal(authGuard.isDemoUser(), false, 'isDemoUser must be false after real user login');
  assert.equal(sessionStorage.getItem('is_demo_user'), null, 'is_demo_user must be removed on real login');
  assert.equal(authGuard.getUserSub(), 'real_google_user_999', 'getUserSub returns real user sub');
  assert.equal(authGuard.getUserStorageKey('subjects'), 'studyflow_data_real_google_user_999_subjects', 'getUserStorageKey returns real user scoped key');

  console.log('✔ Test 4 Passed: Real User Login Cleanly Wipes Demo State');
}

console.log('--- ALL DEMO SANDBOX TESTS PASSED SUCCESSFULLY! ---');
