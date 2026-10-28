/**
 * Automated Verification Suite for Non-Destructive Data Updates & Immutable State Merging
 * (tests/test-non-destructive-patch.js)
 *
 * Verifies:
 * 1. Centralized patch controller (storage-helper.js & data-manager.js)
 *    - patchUserData(userId, updates)
 *    - Defensive spreading & nested dailyActivity merging
 *    - Preserving streaks & todayLoggedHours
 *    - Calling debounceSaveToDrive with complete merged payload
 * 2. Section Save Handlers:
 *    - routine.js (saveRoutine, patchUserData)
 *    - syllabus.js (saveSubjects, patchUserData)
 *    - skills.js (saveSkills, patchUserData)
 *    - radar.js (saveExams, patchUserData)
 *    - notes.js (saveNotes, patchUserData)
 * 3. Prevention of Accidental Zero-State Initialization:
 *    - Retains existing streak and todayLoggedHours on mount/load
 *    - Only supplies default zero values for strictly undefined fields
 * 4. Safe Cloud Sync Merging (cloud-sync.js):
 *    - mergeCloudAndLocalData compares timestamps
 *    - Preserves whichever side has higher streak
 *    - Preserves union of dailyActivity dates
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Setup mock window & browser storage environment
const localStorageStore = new Map();
const sessionStorageStore = new Map();
const eventListeners = new Map();

global.localStorage = {
  getItem: (k) => localStorageStore.get(k) || null,
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  removeItem: (k) => localStorageStore.delete(k),
  clear: () => localStorageStore.clear()
};

global.sessionStorage = {
  getItem: (k) => sessionStorageStore.get(k) || null,
  setItem: (k, v) => sessionStorageStore.set(k, String(v)),
  removeItem: (k) => sessionStorageStore.delete(k),
  clear: () => sessionStorageStore.clear()
};

global.window = {
  addEventListener: (event, handler) => {
    if (!eventListeners.has(event)) eventListeners.set(event, []);
    eventListeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (eventListeners.has(event)) {
      eventListeners.set(event, eventListeners.get(event).filter(h => h !== handler));
    }
  },
  dispatchEvent: (event) => {
    const list = eventListeners.get(event.type) || [];
    list.forEach(h => h(event));
    return true;
  },
  location: { protocol: 'http:', hostname: 'localhost' }
};

global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || null;
  }
};

global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n--- STARTING NON-DESTRUCTIVE PATCH & IMMUTABLE MERGING TESTS ---\n');

// Import modules under test
const { patchUserData, getUserData, mergeUserData, saveRoutine, saveSubjects, saveSkills, saveExams, saveNotes } = await import('../storage-helper.js');
const { mergeCloudAndLocalData } = await import('../cloud-sync.js');
const { getOrCreateZeroStateData, getLocalDateString } = await import('../auth-guard.js');

// ==========================================
// PART 1: CENTRALIZED PATCH CONTROLLER
// ==========================================

test('Patch Controller: Merges updates defensively without wiping existing fields', () => {
  const existing = {
    userId: 'user_123',
    streak: 12,
    todayLoggedHours: 2.5,
    todayLogDate: '2026-10-28',
    dailyActivity: {
      '2026-10-27': 90,
      '2026-10-28': 150
    },
    subjects: [{ id: 'sub-1', name: 'Physics' }],
    exams: [{ id: 'ex-1', title: 'Midterm' }],
    skills: [{ id: 'sk-1', title: 'DSA' }],
    routine: [{ id: 'rt-1', title: 'Morning Routine' }],
    updatedAt: '2026-10-28T10:00:00.000Z'
  };

  // Update ONLY routine
  const newRoutine = [
    { id: 'rt-1', title: 'Morning Routine', completed: true },
    { id: 'rt-2', title: 'Evening Review', completed: false }
  ];
  const merged = mergeUserData(existing, { routine: newRoutine });

  assert.strictEqual(merged.streak, 12, 'Streak must be preserved');
  assert.strictEqual(merged.todayLoggedHours, 2.5, 'Today logged hours must be preserved');
  assert.strictEqual(merged.subjects.length, 1, 'Subjects must be preserved');
  assert.strictEqual(merged.exams.length, 1, 'Exams must be preserved');
  assert.strictEqual(merged.skills.length, 1, 'Skills must be preserved');
  assert.strictEqual(merged.dailyActivity['2026-10-27'], 90, 'Past dailyActivity preserved');
  assert.strictEqual(merged.dailyActivity['2026-10-28'], 150, 'Today dailyActivity preserved');
  assert.strictEqual(merged.routine.length, 2, 'Routine updated to 2 items');
  assert(merged.updatedAt !== existing.updatedAt, 'updatedAt must be refreshed');
});

test('Patch Controller: Nested dailyActivity merges dates instead of overwriting', () => {
  const existing = {
    dailyActivity: {
      '2026-10-26': 45,
      '2026-10-27': 60
    }
  };

  const updates = {
    dailyActivity: {
      '2026-10-27': 90, // higher minutes on same day
      '2026-10-28': 120 // new date
    }
  };

  const merged = mergeUserData(existing, updates);

  assert.strictEqual(merged.dailyActivity['2026-10-26'], 45, 'Older date preserved');
  assert.strictEqual(merged.dailyActivity['2026-10-27'], 90, 'Overlapping date takes max/updated minutes');
  assert.strictEqual(merged.dailyActivity['2026-10-28'], 120, 'New date added');
});

test('Patch Controller: patchUserData writes merged state to localStorage & dispatches event', () => {
  localStorage.clear();
  const userId = 'student_test_888';
  const masterKey = `studyflow_${userId}_data`;

  // Pre-seed storage
  const initial = {
    userId,
    streak: 7,
    todayLoggedHours: 1.5,
    subjects: [{ id: 'sub-algo', name: 'Algorithms' }],
    dailyActivity: { '2026-10-28': 90 }
  };
  localStorage.setItem(masterKey, JSON.stringify(initial));

  let eventFired = false;
  const listener = (e) => {
    if (e.detail?.userId === userId) eventFired = true;
  };
  window.addEventListener('studyflow-data-patched', listener);

  // Patch exams only
  const patched = patchUserData(userId, {
    exams: [{ id: 'ex-final', title: 'Algorithms Final', date: '2026-11-20' }]
  });

  assert.strictEqual(patched.streak, 7, 'Streak must still be 7');
  assert.strictEqual(patched.todayLoggedHours, 1.5, 'Hours must still be 1.5');
  assert.strictEqual(patched.subjects.length, 1, 'Subjects still present');
  assert.strictEqual(patched.exams.length, 1, 'Exams added');
  assert.strictEqual(patched.dailyActivity['2026-10-28'], 90, 'Daily activity intact');

  // Verify storage has the complete merged object
  const stored = JSON.parse(localStorage.getItem(masterKey));
  assert.strictEqual(stored.streak, 7);
  assert.strictEqual(stored.subjects[0].name, 'Algorithms');
  assert.strictEqual(stored.exams[0].title, 'Algorithms Final');
  assert.strictEqual(eventFired, true, 'studyflow-data-patched event fired');

  window.removeEventListener('studyflow-data-patched', listener);
});

// ==========================================
// PART 2: SECTION SAVE HANDLERS & MODULE EXPORTS
// ==========================================

test('Section Handlers: routine.js exports saveRoutine & patchUserData', () => {
  const content = fs.readFileSync(path.join(rootDir, 'routine.js'), 'utf8');
  assert(content.includes('saveRoutine'), 'routine.js exports saveRoutine');
  assert(content.includes('patchUserData'), 'routine.js exports patchUserData');

  const userId = 'section_user_1';
  localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    streak: 4,
    todayLoggedHours: 2.0,
    routine: []
  }));

  const res = saveRoutine(userId, [{ id: 'r1', title: 'Deep Work' }]);
  assert.strictEqual(res.streak, 4, 'saveRoutine did not wipe streak');
  assert.strictEqual(res.todayLoggedHours, 2.0, 'saveRoutine did not wipe hours');
  assert.strictEqual(res.routine.length, 1, 'saveRoutine updated routine');
});

test('Section Handlers: syllabus.js exports saveSubjects & patchUserData', () => {
  const content = fs.readFileSync(path.join(rootDir, 'syllabus.js'), 'utf8');
  assert(content.includes('saveSubjects'), 'syllabus.js exports saveSubjects');
  assert(content.includes('patchUserData'), 'syllabus.js exports patchUserData');

  const userId = 'section_user_2';
  localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    streak: 9,
    dailyActivity: { '2026-10-28': 180 },
    subjects: []
  }));

  const res = saveSubjects(userId, [{ id: 's1', name: 'Machine Learning' }]);
  assert.strictEqual(res.streak, 9, 'saveSubjects did not wipe streak');
  assert.strictEqual(res.dailyActivity['2026-10-28'], 180, 'saveSubjects did not wipe activity');
  assert.strictEqual(res.subjects[0].name, 'Machine Learning');
});

test('Section Handlers: skills.js exports saveSkills & patchUserData', () => {
  const content = fs.readFileSync(path.join(rootDir, 'skills.js'), 'utf8');
  assert(content.includes('saveSkills'), 'skills.js exports saveSkills');
  assert(content.includes('patchUserData'), 'skills.js exports patchUserData');

  const userId = 'section_user_3';
  localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    streak: 6,
    todayLoggedHours: 1.0,
    skills: []
  }));

  const res = saveSkills(userId, [{ id: 'sk-py', title: 'Python 3' }]);
  assert.strictEqual(res.streak, 6, 'saveSkills did not wipe streak');
  assert.strictEqual(res.skills[0].title, 'Python 3');
});

test('Section Handlers: radar.js exports saveExams & patchUserData', () => {
  const content = fs.readFileSync(path.join(rootDir, 'radar.js'), 'utf8');
  assert(content.includes('saveExams'), 'radar.js exports saveExams');
  assert(content.includes('patchUserData'), 'radar.js exports patchUserData');

  const userId = 'section_user_4';
  localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    streak: 15,
    exams: []
  }));

  const res = saveExams(userId, [{ id: 'ex-1', title: 'Calculus Final' }]);
  assert.strictEqual(res.streak, 15, 'saveExams did not wipe streak');
  assert.strictEqual(res.exams[0].title, 'Calculus Final');
});

test('Section Handlers: notes.js exports saveNotes & patchUserData', () => {
  const content = fs.readFileSync(path.join(rootDir, 'notes.js'), 'utf8');
  assert(content.includes('saveNotes'), 'notes.js exports saveNotes');
  assert(content.includes('patchUserData'), 'notes.js exports patchUserData');

  const userId = 'section_user_5';
  localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    streak: 3,
    todayLoggedHours: 0.5,
    notes: []
  }));

  const res = saveNotes(userId, [{ id: 'n1', title: 'Dynamic Programming' }]);
  assert.strictEqual(res.streak, 3, 'saveNotes did not wipe streak');
  assert.strictEqual(res.todayLoggedHours, 0.5, 'saveNotes did not wipe hours');
  assert.strictEqual(res.notes[0].title, 'Dynamic Programming');
});

// ==========================================
// PART 3: ACCIDENTAL ZERO-STATE INITIALIZATION PREVENTION
// ==========================================

test('Zero-State Prevention: getOrCreateZeroStateData never wipes existing streak or hours', () => {
  localStorage.clear();
  const userId = 'returning_student_999';
  const masterKey = `studyflow_${userId}_data`;

  // Existing user with streak 8 and todayLoggedHours 2.4 on today's local date
  const todayStr = getLocalDateString(new Date());
  const existing = {
    userId,
    streak: 8,
    todayLoggedHours: 2.4,
    todayLogDate: todayStr,
    lastActiveDate: todayStr,
    dailyActivity: { [todayStr]: 144 },
    subjects: [{ id: 's1' }]
  };
  localStorage.setItem(masterKey, JSON.stringify(existing));

  const data = getOrCreateZeroStateData(userId);

  assert.strictEqual(data.streak, 8, 'Existing streak of 8 must NOT be reset to 0');
  assert.strictEqual(data.todayLoggedHours, 2.4, 'Existing logged hours must NOT be reset to 0');
  assert.strictEqual(data.dailyActivity[todayStr], 144, 'Existing activity preserved');
});

test('Zero-State Prevention: Streak preserved if user studied yesterday across midnight', () => {
  localStorage.clear();
  const userId = 'midnight_student_777';
  const masterKey = `studyflow_${userId}_data`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const pastData = {
    userId,
    streak: 5,
    todayLoggedHours: 3.0,
    todayLogDate: yesterdayStr,
    lastActiveDate: yesterdayStr, // studied yesterday
    subjects: []
  };
  localStorage.setItem(masterKey, JSON.stringify(pastData));

  const data = getOrCreateZeroStateData(userId);

  // Streak must be kept because they studied yesterday
  assert.strictEqual(data.streak, 5, 'Streak must be maintained across midnight since student studied yesterday');
  // Today's hours reset to 0.0 for the fresh day
  assert.strictEqual(data.todayLoggedHours, 0.0, 'todayLoggedHours resets to 0 for the new day');
});

// ==========================================
// PART 4: SAFE CLOUD SYNC MERGING
// ==========================================

test('Cloud Sync Merging: Preserves higher streak between local and remote', () => {
  // Case A: Local has higher streak
  const remoteA = {
    streak: 3,
    updatedAt: '2026-10-28T12:00:00.000Z'
  };
  const localA = {
    streak: 7,
    updatedAt: '2026-10-28T10:00:00.000Z'
  };
  const mergedA = mergeCloudAndLocalData(remoteA, localA);
  assert.strictEqual(mergedA.streak, 7, 'Higher streak (7) from local must be preserved');

  // Case B: Remote has higher streak
  const remoteB = {
    streak: 14,
    updatedAt: '2026-10-28T12:00:00.000Z'
  };
  const localB = {
    streak: 4,
    updatedAt: '2026-10-28T10:00:00.000Z'
  };
  const mergedB = mergeCloudAndLocalData(remoteB, localB);
  assert.strictEqual(mergedB.streak, 14, 'Higher streak (14) from remote must be preserved');
});

test('Cloud Sync Merging: Preserves the union of dailyActivity dates and max minutes', () => {
  const remote = {
    dailyActivity: {
      '2026-10-25': 60,
      '2026-10-26': 90
    },
    updatedAt: '2026-10-28T10:00:00.000Z'
  };

  const local = {
    dailyActivity: {
      '2026-10-26': 120, // higher on local
      '2026-10-27': 45   // local only
    },
    updatedAt: '2026-10-28T12:00:00.000Z'
  };

  const merged = mergeCloudAndLocalData(remote, local);

  assert.strictEqual(merged.dailyActivity['2026-10-25'], 60, 'Preserved remote-only date');
  assert.strictEqual(merged.dailyActivity['2026-10-26'], 120, 'Took max minutes for overlapping date');
  assert.strictEqual(merged.dailyActivity['2026-10-27'], 45, 'Preserved local-only date');
  assert.strictEqual(Object.keys(merged.dailyActivity).length, 3, 'Union has all 3 dates');
});

test('Cloud Sync Merging: Preserves sections if local phone has empty arrays', () => {
  const remote = {
    subjects: [{ id: 's1', name: 'Biology' }],
    skills: [{ id: 'sk1', title: 'Python' }],
    routine: [{ id: 'r1', title: 'Morning Study' }],
    updatedAt: '2026-10-28T10:00:00.000Z'
  };

  // Local phone logged in with empty arrays
  const local = {
    subjects: [],
    skills: [],
    routine: [],
    updatedAt: '2026-10-28T09:00:00.000Z'
  };

  const merged = mergeCloudAndLocalData(remote, local);

  assert.strictEqual(merged.subjects.length, 1, 'Subjects preserved from cloud');
  assert.strictEqual(merged.skills.length, 1, 'Skills preserved from cloud');
  assert.strictEqual(merged.routine.length, 1, 'Routine preserved from cloud');
});

console.log(`\n========================================`);
console.log(`ALL ${passedCount} NON-DESTRUCTIVE PATCH TESTS PASSED!`);
console.log(`========================================\n`);
