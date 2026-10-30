/**
 * Automated Verification Test Suite: End-of-Day Rollover & Cleanup Mechanism
 * (tests/test-automated-end-of-day-rollover.js)
 *
 * Verifies:
 * 1. MIDNIGHT / NEW-DAY DETECTOR:
 *    - Detects when todayStr > userData.lastActiveDate
 *    - Triggers handleEndOfDayRollover(userId) automatically
 * 2. END-OF-DAY CLEANUP LOGIC:
 *    - Identifies all completed routine blocks (block.completed === true)
 *    - Verifies completed items linked to syllabus have topic.completed = true in subjects
 *    - PURGES completed blocks from userData.routine
 *    - KEEPS and carries over uncompleted blocks (block.completed === false)
 *    - Tags carried-over blocks with "Carried over from yesterday"
 * 3. TOMORROW PLANNER MERGE:
 *    - Merges items from tomorrowPlan where scheduledDate <= todayStr into userData.routine
 *    - Removes merged items from tomorrowPlan
 * 4. COUNTER & STATS RESET:
 *    - Resets userData.todayLoggedHours = 0.0 for the fresh day
 *    - Does NOT wipe streak or clear dailyActivity heatmap history
 *    - Updates userData.lastActiveDate = todayStr
 *    - Persists changes non-destructively via patchUserData
 * 5. UI BADGE & EXPORT AUDIT:
 *    - Checks .carried-over-badge in DailyRoutine.jsx
 *    - Checks exports across storage-helper.js, routine.js, app-core.js, app.js
 */

import fs from 'fs';
import path from 'path';
import {
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover,
  getUserData,
  patchUserData
} from '../storage-helper.js';
import { initAppHydration } from '../app.js';
import { getLocalDateString } from '../auth-guard.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-Memory Storage Mock for test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

global.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.CustomEvent = class {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts ? opts.detail : null;
  }
};
global.Event = class {
  constructor(name) { this.name = name; }
};

console.log('\n================================================================');
console.log('--- 1. NEW-DAY DETECTOR (todayStr > lastActiveDate) ---');
console.log('================================================================');

const testUserId = 'student_rollover_999';
const yesterdayDateStr = '2026-10-30';
const todayDateStr = '2026-10-31';

const initialSubjects = [
  {
    id: 'sub_algo',
    name: 'Advanced Algorithms',
    topics: [
      {
        id: 'chap_graphs',
        title: 'Graph Theory & Flows',
        status: 'In Progress',
        completed: false,
        subtopics: [
          { id: 'top_bfs', title: 'Breadth First Search', status: 'Mastered', completed: true },
          { id: 'top_dijkstra', title: 'Dijkstra Shortest Path', status: 'In Progress', completed: false },
          { id: 'top_maxflow', title: 'Edmonds-Karp Max Flow', status: 'Not Started', completed: false }
        ]
      }
    ]
  }
];

// Initial user state from yesterday:
// 1 completed task (linked to top_dijkstra), 1 uncompleted task, 1 uncompleted general task
const initialRoutine = [
  {
    id: 'block_completed_dijkstra',
    title: 'Dijkstra Shortest Path Practice',
    startTime: '09:00',
    endTime: '11:00',
    timeRange: '09:00 - 11:00',
    category: 'Core Study',
    completed: true, // COMPLETED
    syllabusLink: {
      subjectId: 'sub_algo',
      subjectName: 'Advanced Algorithms',
      chapterId: 'chap_graphs',
      chapterName: 'Graph Theory & Flows',
      topicId: 'top_dijkstra',
      topicName: 'Dijkstra Shortest Path'
    }
  },
  {
    id: 'block_unfinished_1',
    title: 'Edmonds-Karp Max Flow Proofs',
    startTime: '14:00',
    endTime: '16:00',
    timeRange: '14:00 - 16:00',
    category: 'Core Study',
    completed: false, // UNCOMPLETED
    syllabusLink: {
      subjectId: 'sub_algo',
      subjectName: 'Advanced Algorithms',
      chapterId: 'chap_graphs',
      chapterName: 'Graph Theory & Flows',
      topicId: 'top_maxflow',
      topicName: 'Edmonds-Karp Max Flow'
    }
  },
  {
    id: 'block_unfinished_2',
    title: 'Speed Reading & Paper Summary',
    startTime: '18:00',
    endTime: '19:00',
    timeRange: '18:00 - 19:00',
    category: 'Revision',
    completed: false // UNCOMPLETED
  }
];

// Tomorrow planner queue prepared yesterday for today
const initialTomorrowPlan = [
  {
    id: 'plan_sat_morning',
    title: 'Weekly Problem Set Drill',
    startTime: '10:00',
    endTime: '12:00',
    scheduledDate: '2026-10-31', // Scheduled for today!
    category: 'Problem Solving'
  },
  {
    id: 'plan_sunday_future',
    title: 'Sunday Deep Focus Session',
    startTime: '10:00',
    endTime: '13:00',
    scheduledDate: '2026-11-01', // Future date
    category: 'Core Study'
  }
];

const mockMasterDoc = {
  userId: testUserId,
  streak: 18,
  lastActiveDate: yesterdayDateStr, // Yesterday
  todayLogDate: yesterdayDateStr,
  todayLoggedHours: 5.5,
  dailyActivity: {
    '2026-10-29': 240,
    '2026-10-30': 330
  },
  routine: initialRoutine,
  tomorrowPlan: initialTomorrowPlan,
  subjects: initialSubjects,
  completedRoutineToday: [initialRoutine[0]]
};

global.localStorage.setItem(`studyflow_${testUserId}_data`, JSON.stringify(mockMasterDoc));

// Test detector via checkAndTriggerEndOfDayRollover
const checkResult = checkAndTriggerEndOfDayRollover(testUserId, todayDateStr);
assert(checkResult.rolledOver === true, 'Rollover triggered when todayStr > userData.lastActiveDate');
assert(checkResult.todayStr === todayDateStr, `todayStr set to ${todayDateStr}`);

// Check that calling again on the same day does not duplicate rollover
const recheckResult = checkAndTriggerEndOfDayRollover(testUserId, todayDateStr);
assert(recheckResult.rolledOver === false, 'Subsequent checks on same day do not re-trigger rollover');
assert(recheckResult.reason === 'same_day' || recheckResult.reason === 'already_current', 'Reports already current on same day');

console.log('\n================================================================');
console.log('--- 2. END-OF-DAY CLEANUP LOGIC (PURGE & CARRYOVER) ---');
console.log('================================================================');

// 2.1 Verify syllabus sync for completed blocks
const updatedSubjects = checkResult.updatedSubjects;
const algoSub = updatedSubjects.find(s => s.id === 'sub_algo');
const graphChap = algoSub.topics.find(t => t.id === 'chap_graphs');
const dijkstraTopic = graphChap.subtopics.find(st => st.id === 'top_dijkstra');

assert(dijkstraTopic.completed === true, 'Completed routine topic confirmed completed: true in subjects');
assert(dijkstraTopic.status === 'Mastered', 'Completed routine topic confirmed status: "Mastered" in subjects');
assert(graphChap.progress === 67, `Chapter progress percentage updated to 67% (2 of 3 subtopics): ${graphChap.progress}%`);

// 2.2 Purge completed blocks from active routine
const activeRoutine = checkResult.updatedRoutine;
assert(!activeRoutine.some(b => b.id === 'block_completed_dijkstra'), 'Completed block PURGED from active routine');
assert(checkResult.purgedCompletedCount === 1, 'Purged count reported as 1');

// 2.3 Carry over uncompleted blocks with tag
const carriedOverBlocks = activeRoutine.filter(b => b.carriedOver === true);
assert(carriedOverBlocks.length === 2, `2 unfinished blocks kept and carried over: ${carriedOverBlocks.length}`);
assert(carriedOverBlocks.some(b => b.id === 'block_unfinished_1'), 'block_unfinished_1 carried over');
assert(carriedOverBlocks.some(b => b.id === 'block_unfinished_2'), 'block_unfinished_2 carried over');

for (const block of carriedOverBlocks) {
  assert(block.completed === false, `Carried over block ${block.id} has completed: false`);
  assert(block.carriedOver === true, `Carried over block ${block.id} has carriedOver: true`);
  assert(block.carriedOverNote === 'Carried over from yesterday', `Carried over block has note: "${block.carriedOverNote}"`);
}

console.log('\n================================================================');
console.log('--- 3. TOMORROW PLANNER MERGE ---');
console.log('================================================================');

// 3.1 Check merged tomorrow blocks in routine
assert(checkResult.mergedTomorrowCount === 1, '1 tomorrow plan item merged for today');
const mergedPlan = activeRoutine.find(b => b.id === 'plan_sat_morning');
assert(Boolean(mergedPlan), 'plan_sat_morning successfully merged into active routine');
assert(mergedPlan.title === 'Weekly Problem Set Drill', 'Merged plan title preserved');
assert(mergedPlan.startTime === '10:00' && mergedPlan.endTime === '12:00', 'Merged plan times preserved');
assert(mergedPlan.completed === false, 'Merged plan completed is false');

// 3.2 Check remaining tomorrowPlan
assert(checkResult.remainingTomorrowPlan.length === 1, 'Only future plan remains in tomorrowPlan');
assert(checkResult.remainingTomorrowPlan[0].id === 'plan_sunday_future', 'plan_sunday_future preserved for tomorrow');
assert(checkResult.remainingTomorrowPlan[0].scheduledDate === '2026-11-01', 'Future date intact');

// Total routine count check: 2 carried over + 1 merged tomorrow = 3 total active blocks
assert(activeRoutine.length === 3, `Total active routine blocks for today is 3 (2 carried over + 1 merged): found ${activeRoutine.length}`);

console.log('\n================================================================');
console.log('--- 4. COUNTER & STATS RESET (PRESERVATION VERIFICATION) ---');
console.log('================================================================');

const persistedDoc = JSON.parse(global.localStorage.getItem(`studyflow_${testUserId}_data`));
assert(persistedDoc !== null, 'studyflow_${userId}_data exists in localStorage');
assert(persistedDoc.todayLoggedHours === 0.0, `todayLoggedHours reset to 0.0h for fresh day: ${persistedDoc.todayLoggedHours}`);
assert(persistedDoc.todayLogDate === todayDateStr, `todayLogDate updated to ${todayDateStr}`);
assert(persistedDoc.lastActiveDate === todayDateStr, `lastActiveDate updated to ${todayDateStr}`);

// Strict verification: streak and dailyActivity MUST NOT be wiped
assert(persistedDoc.streak === 18, `Streak preserved intact at ${persistedDoc.streak}`);
assert(persistedDoc.dailyActivity['2026-10-29'] === 240, 'Heatmap history 2026-10-29 preserved intact (240m)');
assert(persistedDoc.dailyActivity['2026-10-30'] === 330, 'Heatmap history 2026-10-30 preserved intact (330m)');
assert(persistedDoc.completedRoutineToday.length === 0, 'completedRoutineToday reset to empty for the fresh day');

console.log('\n================================================================');
console.log('--- 5. APP.JS HYDRATION & LIFECYCLE HOOK ---');
console.log('================================================================');

// Test app.js initAppHydration
const testUser2 = 'student_app_hydration_777';
const user2MasterDoc = {
  userId: testUser2,
  streak: 25,
  lastActiveDate: '2026-10-28', // Old date
  todayLogDate: '2026-10-28',
  todayLoggedHours: 6.0,
  dailyActivity: { '2026-10-28': 360 },
  routine: [
    { id: 'u2_done', title: 'Finished Task', completed: true },
    { id: 'u2_pending', title: 'Unfinished Task', completed: false }
  ],
  tomorrowPlan: [
    { id: 'u2_plan_due', title: 'Planned Task', scheduledDate: '2026-10-31' }
  ]
};

global.localStorage.setItem(`studyflow_${testUser2}_data`, JSON.stringify(user2MasterDoc));

const hydrationResult = initAppHydration(testUser2, '2026-10-31');
assert(hydrationResult.hydrated === true, 'initAppHydration completed successfully');
assert(hydrationResult.rolledOver === true, 'initAppHydration triggered rollover for stale lastActiveDate');

const user2Persisted = JSON.parse(global.localStorage.getItem(`studyflow_${testUser2}_data`));
assert(user2Persisted.lastActiveDate === '2026-10-31', 'user2 lastActiveDate updated to 2026-10-31');
assert(user2Persisted.todayLoggedHours === 0.0, 'user2 todayLoggedHours reset to 0.0');
assert(user2Persisted.streak === 25, 'user2 streak preserved at 25');
assert(user2Persisted.routine.length === 2, 'user2 routine has 2 blocks (1 carried over + 1 merged)');
assert(user2Persisted.routine.some(b => b.id === 'u2_pending' && b.carriedOver === true), 'user2 unfinished task carried over');
assert(!user2Persisted.routine.some(b => b.id === 'u2_done'), 'user2 completed task purged');

console.log('\n================================================================');
console.log('--- 6. UI BADGE & CODEBASE EXPORT AUDIT ---');
console.log('================================================================');

const dailyRoutineContent = fs.readFileSync(path.resolve('src/components/DailyRoutine.jsx'), 'utf-8');
assert(dailyRoutineContent.includes('carried-over-badge'), 'DailyRoutine.jsx renders carried-over-badge');
assert(dailyRoutineContent.includes('Carried over from yesterday'), 'DailyRoutine.jsx contains text "Carried over from yesterday"');

const storageHelperContent = fs.readFileSync(path.resolve('storage-helper.js'), 'utf-8');
assert(storageHelperContent.includes('handleEndOfDayRollover'), 'storage-helper.js exports handleEndOfDayRollover');
assert(storageHelperContent.includes('checkAndTriggerEndOfDayRollover'), 'storage-helper.js exports checkAndTriggerEndOfDayRollover');

const appCoreContent = fs.readFileSync(path.resolve('app-core.js'), 'utf-8');
assert(appCoreContent.includes('handleEndOfDayRollover'), 'app-core.js exports handleEndOfDayRollover');
assert(appCoreContent.includes('checkAndTriggerEndOfDayRollover'), 'app-core.js exports checkAndTriggerEndOfDayRollover');

const appJsContent = fs.readFileSync(path.resolve('app.js'), 'utf-8');
assert(appJsContent.includes('initAppHydration'), 'app.js exports initAppHydration');
assert(appJsContent.includes('handleEndOfDayRollover'), 'app.js exports handleEndOfDayRollover');

const routineJsContent = fs.readFileSync(path.resolve('routine.js'), 'utf-8');
assert(routineJsContent.includes('handleEndOfDayRollover'), 'routine.js exports handleEndOfDayRollover');
assert(routineJsContent.includes('checkAndTriggerEndOfDayRollover'), 'routine.js exports checkAndTriggerEndOfDayRollover');

console.log('\n================================================================');
console.log(`--- RESULTS: ${passed} / ${passed + failed} TESTS PASSED ---`);
console.log('================================================================\n');

