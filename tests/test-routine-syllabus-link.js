/**
 * Automated Verification Test Suite for Daily Routine & Syllabus Linking Workflow
 *
 * Tests:
 * 1. EXTENDED DATA MODEL SCHEMA:
 *    - Validates routine block with id ('block_...'), title, startTime, endTime, category, completed, syllabusLink.
 * 2. SYLLABUS TOPIC CHIP FORMATTING:
 *    - Formats "📚 Python & DSA • Ch 4: AVL Rotations"
 *    - Deep link URL points to syllabus.html#sub_123
 * 3. INCOMPLETE TOPICS SELECTOR:
 *    - Dynamically filters out Mastered/completed subtopics
 * 4. TWO-WAY SYLLABUS COMPLETION SYNC:
 *    - Checking routine block completes the topic in syllabus
 *    - Sets completed: true and status: 'Mastered'
 *    - Recalculates subject mastery percentage
 *    - Updates studyflow_${userId}_data.subjects
 * 5. GRACEFUL FALLBACK & VALIDATION:
 *    - Shows "No syllabus found. Click here to add subjects & topics first." when subjects empty
 *    - Allows creating routine blocks without syllabusLink
 * 6. UI MODAL STRUCTURE:
 *    - Checks all required IDs (#add-routine-modal, #routine-block-title, #routine-start-time,
 *      #routine-end-time, #routine-category-select, #routine-subject-select, #routine-chapter-select,
 *      #routine-topic-select, #quick-fill-topic-btn)
 * 7. ROUTINE.JS EXPORTS:
 *    - Verifies modular exports in routine.js
 */

import fs from 'fs';
import path from 'path';
import {
  createRoutineBlock,
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  calculateSubjectMastery,
  markSyllabusTopicCompletedInSubjects
} from '../src/utils/routineSyllabusSync.js';

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

global.sessionStorage = {
  getItem: (k) => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

console.log('\n--- 1. Testing Routine Block Extended Schema ---');
{
  const block = createRoutineBlock({
    title: 'AVL Rotations & Rebalancing',
    startTime: '08:00',
    endTime: '10:00',
    category: 'Core Study',
    syllabusLink: {
      subjectId: 'sub_123',
      subjectName: 'Python & DSA',
      chapterId: 'chap_4',
      chapterName: 'Binary Trees',
      topicId: 'top_9',
      topicName: 'AVL Rotations'
    }
  });

  assert(block.id.startsWith('block_'), `Routine block id starts with 'block_': ${block.id}`);
  assert(block.title === 'AVL Rotations & Rebalancing', 'Block title matches');
  assert(block.startTime === '08:00', 'startTime is 08:00');
  assert(block.endTime === '10:00', 'endTime is 10:00');
  assert(block.timeRange === '08:00 - 10:00', 'timeRange is 08:00 - 10:00');
  assert(block.category === 'Core Study', 'category is Core Study');
  assert(block.completed === false, 'completed is initialized to false');
  assert(block.syllabusLink !== null, 'syllabusLink object is present');
  assert(block.syllabusLink.subjectId === 'sub_123', 'syllabusLink subjectId matches');
  assert(block.syllabusLink.subjectName === 'Python & DSA', 'syllabusLink subjectName matches');
  assert(block.syllabusLink.chapterId === 'chap_4', 'syllabusLink chapterId matches');
  assert(block.syllabusLink.chapterName === 'Binary Trees', 'syllabusLink chapterName matches');
  assert(block.syllabusLink.topicId === 'top_9', 'syllabusLink topicId matches');
  assert(block.syllabusLink.topicName === 'AVL Rotations', 'syllabusLink topicName matches');
}

console.log('\n--- 2. Testing Syllabus Chip Formatting & Deep Link ---');
{
  const mockSubjects = [
    {
      id: 'sub_123',
      name: 'Python & DSA',
      topics: [
        { id: 'chap_1', title: 'Arrays & Strings' },
        { id: 'chap_2', title: 'Linked Lists' },
        { id: 'chap_3', title: 'Stacks & Queues' },
        { id: 'chap_4', title: 'Binary Trees' }
      ]
    }
  ];

  const syllabusLink = {
    subjectId: 'sub_123',
    subjectName: 'Python & DSA',
    chapterId: 'chap_4',
    chapterName: 'Binary Trees',
    topicId: 'top_9',
    topicName: 'AVL Rotations'
  };

  const label = formatSyllabusChipLabel(syllabusLink, mockSubjects);
  assert(label === '📚 Python & DSA • Ch 4: AVL Rotations', `Chip label correctly formatted: "${label}"`);

  // Explicit chapter with Ch prefix in name
  const syllabusLinkExplicit = {
    subjectId: 'sub_123',
    subjectName: 'Python & DSA',
    chapterId: 'chap_4',
    chapterName: 'Ch 4: Binary Trees',
    topicId: 'top_9',
    topicName: 'AVL Rotations'
  };
  const labelExplicit = formatSyllabusChipLabel(syllabusLinkExplicit, []);
  assert(labelExplicit === '📚 Python & DSA • Ch 4: AVL Rotations', `Chip label handles existing Ch prefix: "${labelExplicit}"`);
}

console.log('\n--- 3. Testing Incomplete Subtopics Selector ---');
{
  const chapterWithSubtopics = {
    id: 'chap_4',
    title: 'Binary Trees',
    subtopics: [
      { id: 'top_1', title: 'Tree Traversals', status: 'Mastered', completed: true },
      { id: 'top_2', title: 'BST Validation', status: 'Mastered' },
      { id: 'top_9', title: 'AVL Rotations', status: 'In Progress', completed: false },
      { id: 'top_10', title: 'Red-Black Invariants', status: 'Not Started', completed: false }
    ]
  };

  const incomplete = getIncompleteSubtopics(chapterWithSubtopics);
  assert(incomplete.length === 2, `Filters out Mastered subtopics, found ${incomplete.length} incomplete`);
  assert(incomplete.some(t => t.id === 'top_9'), 'Contains AVL Rotations');
  assert(incomplete.some(t => t.id === 'top_10'), 'Contains Red-Black Invariants');
  assert(!incomplete.some(t => t.id === 'top_1'), 'Excludes Mastered Tree Traversals');
  assert(!incomplete.some(t => t.id === 'top_2'), 'Excludes Mastered BST Validation');
}

console.log('\n--- 4. Testing Two-Way Syllabus Completion Sync ---');
{
  const userId = 'student_test_101';
  const initialSubjects = [
    {
      id: 'sub_123',
      name: 'Python & DSA',
      topics: [
        {
          id: 'chap_4',
          title: 'Binary Trees',
          status: 'In Progress',
          completed: false,
          subtopics: [
            { id: 'top_8', title: 'BST Insert', status: 'Mastered', completed: true },
            { id: 'top_9', title: 'AVL Rotations', status: 'In Progress', completed: false }
          ]
        }
      ]
    }
  ];

  // Initial mastery: 1 Mastered out of 2 = 50% + 25% (In Progress) = 75%
  const initialMastery = calculateSubjectMastery(initialSubjects[0].topics);

  // Set up mock storage master state
  global.localStorage.setItem(`studyflow_${userId}_data`, JSON.stringify({
    userId,
    subjects: initialSubjects
  }));

  // Perform Two-Way Sync
  const result = markSyllabusTopicCompletedInSubjects(
    initialSubjects,
    'sub_123',
    'chap_4',
    'top_9',
    userId
  );

  const updatedSubject = result.targetSubject;
  const updatedChapter = updatedSubject.topics.find(t => t.id === 'chap_4');
  const updatedTopic = updatedChapter.subtopics.find(st => st.id === 'top_9');

  assert(updatedTopic.completed === true, 'Topic completed is set to true');
  assert(updatedTopic.status === 'Mastered', 'Topic status is set to Mastered');
  assert(updatedChapter.status === 'Mastered', 'Parent chapter is now Mastered since all subtopics are complete');
  assert(result.updatedMasteryPct === 100, `Subject progress bar recalculates to 100%: ${result.updatedMasteryPct}%`);

  // Verify storage persistence to studyflow_${userId}_data.subjects
  const storedMasterDoc = JSON.parse(global.localStorage.getItem(`studyflow_${userId}_data`));
  assert(storedMasterDoc !== null, 'studyflow_${userId}_data exists in storage');
  assert(Array.isArray(storedMasterDoc.subjects), 'subjects exists in studyflow_${userId}_data');
  const storedSub = storedMasterDoc.subjects.find(s => s.id === 'sub_123');
  const storedTop = storedSub.topics[0].subtopics.find(st => st.id === 'top_9');
  assert(storedTop.completed === true && storedTop.status === 'Mastered', 'studyflow_${userId}_data.subjects is properly synchronized');
}

console.log('\n--- 5. Testing Graceful Fallback & Validation ---');
{
  const emptyBlock = createRoutineBlock({
    title: 'Independent Problem Solving Sprint',
    startTime: '14:00',
    endTime: '15:30',
    category: 'Problem Solving'
  });

  assert(emptyBlock.syllabusLink === null, 'syllabusLink defaults cleanly to null when unlinked');
  assert(emptyBlock.title === 'Independent Problem Solving Sprint', 'Routine block without syllabus link retains title');
  assert(emptyBlock.category === 'Problem Solving', 'Problem Solving category preserved');
}

console.log('\n--- 6. Verifying UI Modal and Component IDs in Codebase ---');
{
  const modalFileContent = fs.readFileSync(path.resolve('src/components/AddRoutineModal.jsx'), 'utf-8');
  assert(modalFileContent.includes('id="add-routine-modal"'), 'Modal container has id="add-routine-modal"');
  assert(modalFileContent.includes('id="routine-block-title"'), 'Modal has input id="routine-block-title"');
  assert(modalFileContent.includes('id="routine-start-time"'), 'Modal has input id="routine-start-time"');
  assert(modalFileContent.includes('id="routine-end-time"'), 'Modal has input id="routine-end-time"');
  assert(modalFileContent.includes('id="routine-category-select"'), 'Modal has select id="routine-category-select"');
  assert(modalFileContent.includes('id="routine-subject-select"'), 'Modal has select id="routine-subject-select"');
  assert(modalFileContent.includes('id="routine-chapter-select"'), 'Modal has select id="routine-chapter-select"');
  assert(modalFileContent.includes('id="routine-topic-select"'), 'Modal has select id="routine-topic-select"');
  assert(modalFileContent.includes('id="quick-fill-topic-btn"'), 'Modal has button id="quick-fill-topic-btn"');
  assert(modalFileContent.includes('No syllabus found. Click here to add subjects & topics first.'), 'Modal contains exact fallback text');

  const toastFileContent = fs.readFileSync(path.resolve('src/components/SyllabusSyncToast.jsx'), 'utf-8');
  assert(toastFileContent.includes('id="confirm-syllabus-mark-done-btn"'), 'Toast has id="confirm-syllabus-mark-done-btn"');
  assert(toastFileContent.includes('id="cancel-syllabus-sync-btn"'), 'Toast has id="cancel-syllabus-sync-btn"');
  assert(toastFileContent.includes('Routine block checked!'), 'Toast includes "Routine block checked!"');
  assert(toastFileContent.includes('Yes, Mark Done'), 'Toast includes "Yes, Mark Done" action');
  assert(toastFileContent.includes('Only Routine'), 'Toast includes "Only Routine" action');

  const chipFileContent = fs.readFileSync(path.resolve('src/components/SyllabusRoutineChip.jsx'), 'utf-8');
  assert(chipFileContent.includes('/syllabus.html#'), 'Chip navigates to /syllabus.html#sub_123');
  assert(chipFileContent.includes('stopPropagation'), 'Chip click stops propagation to avoid toggling task');
}

console.log('\n--- 7. Verifying routine.js Module Core Exports ---');
{
  const routineJsContent = fs.readFileSync(path.resolve('routine.js'), 'utf-8');
  assert(routineJsContent.includes('DailyRoutine'), 'routine.js exports DailyRoutine');
  assert(routineJsContent.includes('AddRoutineModal'), 'routine.js exports AddRoutineModal');
  assert(routineJsContent.includes('SyllabusRoutineChip'), 'routine.js exports SyllabusRoutineChip');
  assert(routineJsContent.includes('SyllabusSyncToast'), 'routine.js exports SyllabusSyncToast');
  assert(routineJsContent.includes('formatSyllabusChipLabel'), 'routine.js exports formatSyllabusChipLabel');
  assert(routineJsContent.includes('getIncompleteSubtopics'), 'routine.js exports getIncompleteSubtopics');
  assert(routineJsContent.includes('createRoutineBlock'), 'routine.js exports createRoutineBlock');
  assert(routineJsContent.includes('markSyllabusTopicCompletedInSubjects'), 'routine.js exports markSyllabusTopicCompletedInSubjects');
}

console.log(`\n======================================================`);
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log(`======================================================\n`);
