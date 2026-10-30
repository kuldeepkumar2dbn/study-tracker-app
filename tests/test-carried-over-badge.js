/**
 * Automated Verification: Visual Amber "Carried Over" Badge & Cleanup Lifecycle
 * (tests/test-carried-over-badge.js)
 *
 * Verifies:
 * 1. DATA LAYER (routine-rollover.js & storage-helper.js):
 *    - Uncompleted tasks carry over with block.carriedOver = true
 *    - Stores original date in block.carriedFromDate = lastActiveDate
 * 2. UI BADGE RENDERING:
 *    - DailyRoutine.jsx renders <span class="... bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Carried Over</span>
 *    - DailyRoutine.jsx card has border-amber-500/30
 *    - DashboardTab.jsx renders <span class="... bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Carried Over</span>
 *    - DashboardTab.jsx card has border-amber-500/30
 * 3. COMPLETION BEHAVIOR:
 *    - Completing carried-over task marks syllabus topic.completed = true if linked
 *    - Prunes from active routine
 *    - Cleans up carriedOver flag so archived task has carriedOver: false & carriedFromDate: null
 */

import fs from 'fs';
import path from 'path';
import {
  carryOverUncompletedTasks,
  handleEndOfDayRollover,
  completeRoutineTask
} from '../routine-rollover.js';
import { completeRoutineTaskWithSyllabusSync } from '../src/utils/routineSyllabusSync.js';

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

// Storage Mock
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
console.log('--- 1. DATA LAYER (routine-rollover.js carryOverUncompletedTasks) ---');
console.log('================================================================');

const sampleRoutine = [
  { id: 't1', title: 'Calculus Limits', completed: true },
  { id: 't2', title: 'Linear Algebra Matrix Rank', completed: false },
  { id: 't3', title: 'Python Decorators Practice', completed: false }
];

const carriedOver = carryOverUncompletedTasks(sampleRoutine, '2026-10-30');

assert(carriedOver.length === 2, `Carried over 2 uncompleted tasks: ${carriedOver.length}`);
assert(!carriedOver.some(t => t.id === 't1'), 'Finished task t1 is NOT carried over');

for (const task of carriedOver) {
  assert(task.completed === false, `Task ${task.id} completed remains false`);
  assert(task.carriedOver === true, `Task ${task.id} has carriedOver: true`);
  assert(task.carriedFromDate === '2026-10-30', `Task ${task.id} has carriedFromDate: "2026-10-30"`);
}

// Test handleEndOfDayRollover persistence with carriedFromDate
const testUserId = 'user_amber_badge_test';
const initialMasterDoc = {
  userId: testUserId,
  streak: 7,
  lastActiveDate: '2026-10-30',
  todayLogDate: '2026-10-30',
  todayLoggedHours: 3.0,
  dailyActivity: { '2026-10-30': 180 },
  routine: [
    { id: 't_done', title: 'Finished Morning Topic', completed: true },
    { 
      id: 't_backlog', 
      title: 'Backlog Chemistry Redox', 
      completed: false,
      syllabusLink: {
        subjectId: 'sub_chem',
        subjectName: 'Organic & Inorganic Chemistry',
        chapterId: 'chap_redox',
        chapterName: 'Electrochemistry',
        topicId: 'top_nernst',
        topicName: 'Nernst Equation'
      }
    }
  ],
  tomorrowPlan: [],
  subjects: [
    {
      id: 'sub_chem',
      name: 'Organic & Inorganic Chemistry',
      topics: [
        {
          id: 'chap_redox',
          title: 'Electrochemistry',
          status: 'In Progress',
          subtopics: [
            { id: 'top_nernst', title: 'Nernst Equation', status: 'In Progress', completed: false }
          ]
        }
      ]
    }
  ],
  completedRoutineToday: []
};

global.localStorage.setItem(`studyflow_${testUserId}_data`, JSON.stringify(initialMasterDoc));

const rolloverRes = handleEndOfDayRollover(testUserId, '2026-10-31');
assert(rolloverRes.rolledOver === true, 'handleEndOfDayRollover succeeded');

const storedData = JSON.parse(global.localStorage.getItem(`studyflow_${testUserId}_data`));
const storedBacklog = storedData.routine.find(r => r.id === 't_backlog');

assert(Boolean(storedBacklog), 't_backlog kept in stored routine');
assert(storedBacklog.carriedOver === true, 'Stored backlog has carriedOver: true');
assert(storedBacklog.carriedFromDate === '2026-10-30', 'Stored backlog has carriedFromDate: "2026-10-30"');

console.log('\n================================================================');
console.log('--- 2. UI BADGE RENDERING (Daily Routine & Dashboard Widget) ---');
console.log('================================================================');

// 2.1 Daily Routine view (src/components/DailyRoutine.jsx)
const dailyRoutineSrc = fs.readFileSync(path.resolve('src/components/DailyRoutine.jsx'), 'utf-8');
assert(dailyRoutineSrc.includes('border-amber-500/30'), 'DailyRoutine.jsx applies border-amber-500/30 soft amber tint');
assert(dailyRoutineSrc.includes('⏳ Carried Over'), 'DailyRoutine.jsx renders "⏳ Carried Over" badge text');
assert(dailyRoutineSrc.includes('bg-amber-500/10'), 'DailyRoutine.jsx uses bg-amber-500/10');
assert(dailyRoutineSrc.includes('text-amber-400'), 'DailyRoutine.jsx uses text-amber-400');
assert(dailyRoutineSrc.includes('border-amber-500/20'), 'DailyRoutine.jsx uses border-amber-500/20');

// 2.2 Dashboard widget (src/components/tabs/DashboardTab.jsx)
const dashboardTabSrc = fs.readFileSync(path.resolve('src/components/tabs/DashboardTab.jsx'), 'utf-8');
assert(dashboardTabSrc.includes('border-amber-500/30'), 'DashboardTab.jsx applies border-amber-500/30 soft amber tint');
assert(dashboardTabSrc.includes('⏳ Carried Over'), 'DashboardTab.jsx renders "⏳ Carried Over" badge text');
assert(dashboardTabSrc.includes('bg-amber-500/10'), 'DashboardTab.jsx uses bg-amber-500/10');
assert(dashboardTabSrc.includes('text-amber-400'), 'DashboardTab.jsx uses text-amber-400');
assert(dashboardTabSrc.includes('border-amber-500/20'), 'DashboardTab.jsx uses border-amber-500/20');

console.log('\n================================================================');
console.log('--- 3. COMPLETION BEHAVIOR & FLAG CLEANUP ---');
console.log('================================================================');

// When completing carried-over task:
const completionRes = completeRoutineTaskWithSyllabusSync({
  routine: storedData.routine,
  subjects: storedData.subjects,
  completedToday: [],
  slotId: 't_backlog',
  userId: testUserId
});

assert(completionRes.syllabusUpdated === true, 'Syllabus updated on completing carried-over task');
assert(completionRes.targetTopic.completed === true, 'Topic completed: true');
assert(completionRes.targetTopic.status === 'Mastered', 'Topic status: Mastered');

// Pruned from active list:
assert(completionRes.remainingRoutine.length === 0, 't_backlog pruned from active routine');

// Cleaned up carriedOver flags on completed task:
const completedItem = completionRes.completedSlot;
assert(completedItem.completed === true, 'completedItem has completed: true');
assert(completedItem.carriedOver === false, 'completedItem cleaned up carriedOver: false');
assert(completedItem.carriedFromDate === null, 'completedItem cleaned up carriedFromDate: null');
assert(completedItem.carriedOverNote === null, 'completedItem cleaned up carriedOverNote: null');

console.log('\n================================================================');
console.log(`--- RESULTS: ${passed} / ${passed + failed} TESTS PASSED ---`);
console.log('================================================================\n');

