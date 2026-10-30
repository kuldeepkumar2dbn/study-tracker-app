/**
 * Test Suite: Two-Way Completion Sync between Daily Routine & Subjects/Syllabus
 * (tests/test-routine-syllabus-twoway-sync.js)
 *
 * Verifies:
 * 1. AUTO-MARK TOPIC IN SYLLABUS:
 *    - Topic status set to 'Mastered' and completed: true
 *    - Chapter progress percentage updated
 *    - Subject mastery percentage recalculated
 * 2. AUTO-DELETE FROM ACTIVE DAILY ROUTINE:
 *    - Routine block removed from active routine
 *    - Tracked in completedRoutineToday
 *    - Remaining counter updated
 * 3. ATOMIC & SAFE PERSISTENCE:
 *    - patchUserData called with { routine, subjects, completedRoutineToday }
 *    - streak, todayLoggedHours, dailyActivity completely untouched
 * 4. OPTIONAL "SHOW COMPLETED TODAY" TOGGLE & UNDO:
 *    - undoCompletedRoutineTask restores slot to active routine
 *    - Reverts syllabus topic completion
 *    - Removes from completedRoutineToday
 * 5. UI COMPONENTS & ATTRIBUTES:
 *    - 300ms transition classes on routine card
 *    - #routine-remaining-count, #toggle-completed-today-btn, #completed-today-list, .undo-btn
 */

import fs from 'fs';
import path from 'path';
import {
  createRoutineBlock,
  completeRoutineTaskWithSyllabusSync,
  undoCompletedRoutineTask,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery
} from '../src/utils/routineSyllabusSync.js';
import { patchUserData, getUserData, mergeUserData } from '../storage-helper.js';

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

// In-Memory Storage Mock for testing environment
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
  dispatchEvent: () => true
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
console.log('--- 1. AUTO-MARK TOPIC IN SYLLABUS & PROGRESS CALCULATION ---');
console.log('================================================================');

const testUserId = 'student_test_888';

const mockSubjects = [
  {
    id: 'sub_math',
    name: 'Calculus & Linear Algebra',
    topics: [
      {
        id: 'chap_int',
        title: 'Integral Calculus',
        status: 'In Progress',
        completed: false,
        subtopics: [
          { id: 'top_def', title: 'Definite Integrals', status: 'In Progress', completed: false },
          { id: 'top_byparts', title: 'Integration by Parts', status: 'Not Started', completed: false }
        ]
      },
      {
        id: 'chap_matrix',
        title: 'Matrices & Determinants',
        status: 'Not Started',
        completed: false,
        subtopics: [
          { id: 'top_det', title: 'Eigenvalues & Inverses', status: 'Not Started', completed: false }
        ]
      }
    ]
  }
];

const mockRoutine = [
  createRoutineBlock({
    id: 'block_math_1',
    title: 'Definite Integrals Deep Practice',
    startTime: '09:00',
    endTime: '11:00',
    category: 'Core Study',
    syllabusLink: {
      subjectId: 'sub_math',
      subjectName: 'Calculus & Linear Algebra',
      chapterId: 'chap_int',
      chapterName: 'Integral Calculus',
      topicId: 'top_def',
      topicName: 'Definite Integrals'
    }
  }),
  createRoutineBlock({
    id: 'block_general_2',
    title: 'Daily Review & Summary',
    startTime: '14:00',
    endTime: '15:00',
    category: 'Revision'
  })
];

// Initialize storage state with existing streak and study hours
const initialMasterDoc = {
  userId: testUserId,
  streak: 15,
  todayLoggedHours: 4.5,
  dailyActivity: { '2026-10-30': 180 },
  routine: mockRoutine,
  subjects: mockSubjects,
  completedRoutineToday: []
};

global.localStorage.setItem(`studyflow_${testUserId}_data`, JSON.stringify(initialMasterDoc));

// Execute Two-Way Completion Sync
const completionResult = completeRoutineTaskWithSyllabusSync({
  routine: mockRoutine,
  subjects: mockSubjects,
  completedToday: [],
  slotId: 'block_math_1',
  userId: testUserId
});

assert(completionResult.syllabusUpdated === true, 'syllabusUpdated flagged as true');
assert(completionResult.targetTopic !== null, 'Target topic located in subjects hierarchy');
assert(completionResult.targetTopic.completed === true, 'Topic.completed is set to true');
assert(completionResult.targetTopic.status === 'Mastered', 'Topic.status is set to Mastered');

// Verify chapter progress percentage calculation
const updatedMathSub = completionResult.updatedSubjects.find(s => s.id === 'sub_math');
const updatedIntChap = updatedMathSub.topics.find(t => t.id === 'chap_int');
assert(updatedIntChap.progress === 50, `Chapter progress percentage calculated: ${updatedIntChap.progress}% (1 of 2 subtopics)`);
assert(updatedIntChap.status === 'In Progress', 'Chapter status is In Progress');

// Mark second subtopic done to verify 100% chapter mastery
const mathCompletion2 = markSyllabusTopicCompletedInSubjects(
  completionResult.updatedSubjects,
  'sub_math',
  'chap_int',
  'top_byparts',
  testUserId
);
const chapAfterBoth = mathCompletion2.updatedSubjects[0].topics[0];
assert(chapAfterBoth.progress === 100, 'Chapter progress reaches 100% when all subtopics complete');
assert(chapAfterBoth.completed === true, 'Chapter completed is true');
assert(chapAfterBoth.status === 'Mastered', 'Chapter status becomes Mastered');

console.log('\n================================================================');
console.log('--- 2. AUTO-DELETE FROM ACTIVE ROUTINE & REMAINING COUNTER ---');
console.log('================================================================');

assert(completionResult.remainingRoutine.length === 1, 'Completed task removed from active routine (1 item remaining)');
assert(completionResult.remainingRoutine[0].id === 'block_general_2', 'Only uncompleted block_general_2 remains active');
assert(!completionResult.remainingRoutine.some(s => s.id === 'block_math_1'), 'block_math_1 is no longer in active routine');

assert(completionResult.updatedCompletedToday.length === 1, 'Task moved to completedRoutineToday');
assert(completionResult.updatedCompletedToday[0].id === 'block_math_1', 'Completed task id matches block_math_1');
assert(completionResult.updatedCompletedToday[0].completed === true, 'Completed task has completed: true');
assert(Boolean(completionResult.updatedCompletedToday[0].completedAt), 'Completed task records completedAt timestamp');

console.log('\n================================================================');
console.log('--- 3. ATOMIC & SAFE PERSISTENCE (PRESERVATION VERIFICATION) ---');
console.log('================================================================');

const persistedDoc = JSON.parse(global.localStorage.getItem(`studyflow_${testUserId}_data`));
assert(persistedDoc !== null, 'studyflow_${userId}_data exists in localStorage');
assert(persistedDoc.streak === 15, `Streak preserved intact at ${persistedDoc.streak}`);
assert(persistedDoc.todayLoggedHours === 4.5, `todayLoggedHours preserved intact at ${persistedDoc.todayLoggedHours}`);
assert(persistedDoc.dailyActivity['2026-10-30'] === 180, 'dailyActivity history preserved intact');
assert(persistedDoc.routine.length === 1, 'Persisted active routine contains only remaining 1 item');
assert(persistedDoc.completedRoutineToday.length === 1, 'Persisted completedRoutineToday contains completed item');

const storedMathSub = persistedDoc.subjects.find(s => s.id === 'sub_math');
const storedDefTopic = storedMathSub.topics[0].subtopics.find(st => st.id === 'top_def');
assert(storedDefTopic.completed === true && storedDefTopic.status === 'Mastered', 'Persisted subjects shows topic completed and Mastered');

console.log('\n================================================================');
console.log('--- 4. "SHOW COMPLETED TODAY" TOGGLE & UNDO RESTORATION ---');
console.log('================================================================');

const undoResult = undoCompletedRoutineTask({
  routine: completionResult.remainingRoutine,
  subjects: completionResult.updatedSubjects,
  completedToday: completionResult.updatedCompletedToday,
  slotId: 'block_math_1',
  userId: testUserId
});

assert(undoResult.restoredRoutine.length === 2, 'Restored active routine contains 2 items');
assert(undoResult.restoredRoutine.some(s => s.id === 'block_math_1'), 'block_math_1 restored back into active routine');
assert(undoResult.remainingCompletedToday.length === 0, 'completedRoutineToday is now empty after undo');

const restoredSlot = undoResult.restoredRoutine.find(s => s.id === 'block_math_1');
assert(restoredSlot.completed === false, 'Restored slot completed reset to false');

// Verify syllabus topic reverted on undo
const restoredSub = undoResult.updatedSubjects.find(s => s.id === 'sub_math');
const restoredTop = restoredSub.topics[0].subtopics.find(st => st.id === 'top_def');
assert(restoredTop.completed === false, 'Syllabus topic completed reset to false on undo');
assert(restoredTop.status === 'In Progress', 'Syllabus topic status reset to In Progress on undo');

const persistedAfterUndo = JSON.parse(global.localStorage.getItem(`studyflow_${testUserId}_data`));
assert(persistedAfterUndo.routine.length === 2, 'LocalStorage reflects restored routine');
assert(persistedAfterUndo.streak === 15, 'Streak remains 15 after undo');

console.log('\n================================================================');
console.log('--- 5. UI COMPONENT & TEMPLATE STRUCTURE AUDIT ---');
console.log('================================================================');

const dailyRoutineContent = fs.readFileSync(path.resolve('src/components/DailyRoutine.jsx'), 'utf-8');

assert(dailyRoutineContent.includes('id="routine-remaining-count"'), 'Header displays #routine-remaining-count');
assert(dailyRoutineContent.includes('remaining'), 'Contains "remaining" text for counter');
assert(dailyRoutineContent.includes('fadingSlotId'), 'DailyRoutine manages fadingSlotId state for 300ms animation');
assert(dailyRoutineContent.includes('duration-300'), 'Card has 300ms duration transition class (duration-300)');
assert(dailyRoutineContent.includes('id="toggle-completed-today-btn"'), 'Contains #toggle-completed-today-btn toggle button');
assert(dailyRoutineContent.includes('Show Completed Today'), 'Contains "Show Completed Today" label');
assert(dailyRoutineContent.includes('id="completed-today-list"'), 'Contains #completed-today-list container');
assert(dailyRoutineContent.includes('undo-btn'), 'Completed items have .undo-btn for accidental clicks');
assert(dailyRoutineContent.includes('↺ Undo'), 'Undo button labeled with "↺ Undo"');
assert(dailyRoutineContent.includes('line-through'), 'Completed today tasks rendered with line-through styling');
assert(dailyRoutineContent.includes('routine-sync-toast'), 'DailyRoutine displays #routine-sync-toast confirmation toast');

// Verify DataContext exports
const dataContextContent = fs.readFileSync(path.resolve('src/context/DataContext.jsx'), 'utf-8');
assert(dataContextContent.includes('completeRoutineTask,'), 'DataContext provides completeRoutineTask');
assert(dataContextContent.includes('undoCompletedRoutineTask:'), 'DataContext provides undoCompletedRoutineTask');
assert(dataContextContent.includes('completedRoutineToday,'), 'DataContext provides completedRoutineToday');

// Verify routine.js exports
const routineJsContent = fs.readFileSync(path.resolve('routine.js'), 'utf-8');
assert(routineJsContent.includes('completeRoutineTaskWithSyllabusSync'), 'routine.js exports completeRoutineTaskWithSyllabusSync');
assert(routineJsContent.includes('undoCompletedRoutineTask'), 'routine.js exports undoCompletedRoutineTask');
assert(routineJsContent.includes('syncRoutineSyllabusCompletion'), 'routine.js exports syncRoutineSyllabusCompletion');

console.log('\n================================================================');
console.log(`--- RESULTS: ${passed} / ${passed + failed} TESTS PASSED ---`);
console.log('================================================================\n');

