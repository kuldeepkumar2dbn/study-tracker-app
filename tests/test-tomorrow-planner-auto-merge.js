/**
 * Comprehensive Automated Verification Test Suite for Tomorrow's Planner,
 * Syllabus Topic Picking, Next-Day Auto-Merge Engine, and 30-Minute Prior Notifications.
 */

import fs from 'fs';
import path from 'path';
import { 
  getUserData, 
  patchUserData, 
  mergeUserData, 
  autoMergeTomorrowPlans, 
  saveTomorrowPlan 
} from '../storage-helper.js';
import { createZeroStateData, getOrCreateZeroStateData } from '../auth-guard.js';
import { 
  parseTimeToMinutes, 
  checkStudyReminders, 
  getNotificationPermission, 
  requestNotificationPermission 
} from '../notifications.js';

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

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Global Notification Mock
let dispatchedNotifications = [];
global.Notification = class MockNotification {
  static permission = 'granted';
  static requestPermission() {
    return Promise.resolve('granted');
  }
  constructor(title, options) {
    this.title = title;
    this.options = options;
    dispatchedNotifications.push({ title, options });
  }
};

const TEST_USER = 'test_student_1001';

console.log('\n================================================================');
console.log('--- 1. DATA SCHEMA EXTENSION: tomorrowPlan in User Data ---');
console.log('================================================================');

localStorage.clear();

// 1.1 Zero-state schema includes tomorrowPlan
const zeroState = createZeroStateData(TEST_USER);
assert(Array.isArray(zeroState.tomorrowPlan), 'createZeroStateData includes tomorrowPlan array');
assert(zeroState.tomorrowPlan.length === 0, 'tomorrowPlan defaults to empty array');

// 1.2 Saving tomorrowPlan preserves streaks, logged hours, and dailyActivity
const initialData = {
  userId: TEST_USER,
  streak: 9,
  todayLoggedHours: 3.5,
  dailyActivity: { '2026-10-29': 210 },
  routine: [
    { id: 'rt_1', title: 'Morning Math', startTime: '08:00', endTime: '10:00', completed: true }
  ],
  tomorrowPlan: [
    {
      id: 'plan_1',
      title: 'Integration Formulas & Practice',
      startTime: '10:00',
      endTime: '12:00',
      scheduledDate: '2026-10-31',
      category: 'Core Study',
      syllabusLink: {
        subjectId: 'math_1',
        subjectName: 'Calculus',
        chapterId: 'chap_3',
        chapterName: 'Integration',
        topicName: 'Definite Integrals'
      },
      notified: false
    }
  ]
};

localStorage.setItem(`studyflow_${TEST_USER}_data`, JSON.stringify(initialData));

const readBack = getUserData(TEST_USER);
assert(Array.isArray(readBack.tomorrowPlan), 'getUserData returns tomorrowPlan array');
assert(readBack.tomorrowPlan.length === 1, 'tomorrowPlan contains 1 item');
assert(readBack.tomorrowPlan[0].title === 'Integration Formulas & Practice', 'Plan title matches');
assert(readBack.tomorrowPlan[0].startTime === '10:00', 'Plan startTime matches');
assert(readBack.tomorrowPlan[0].endTime === '12:00', 'Plan endTime matches');
assert(readBack.tomorrowPlan[0].scheduledDate === '2026-10-31', 'Plan scheduledDate matches');
assert(readBack.tomorrowPlan[0].category === 'Core Study', 'Plan category matches');
assert(readBack.tomorrowPlan[0].syllabusLink.topicName === 'Definite Integrals', 'Syllabus link topicName matches');
assert(readBack.tomorrowPlan[0].notified === false, 'Plan notified initialized to false');

// 1.3 Non-destructive patchUserData preserves streak and logged hours
patchUserData(TEST_USER, {
  tomorrowPlan: [
    ...readBack.tomorrowPlan,
    {
      id: 'plan_2',
      title: 'Physics Wave Optics',
      startTime: '14:00',
      endTime: '16:00',
      scheduledDate: '2026-10-31',
      category: 'Revision',
      syllabusLink: null,
      notified: false
    }
  ]
});

const patchedData = getUserData(TEST_USER);
assert(patchedData.tomorrowPlan.length === 2, 'tomorrowPlan successfully appended via patchUserData');
assert(patchedData.streak === 9, 'Existing streak count preserved exactly at 9');
assert(patchedData.todayLoggedHours === 3.5, 'Existing todayLoggedHours preserved at 3.5');
assert(patchedData.dailyActivity['2026-10-29'] === 210, 'Existing dailyActivity preserved');
assert(patchedData.routine.length === 1, 'Existing routine items preserved');


console.log('\n================================================================');
console.log('--- 2. NEXT-DAY AUTO-MERGE ENGINE ---');
console.log('================================================================');

// 2.1 Items scheduled on or before todayStr are merged, future items are preserved
const todayStr = new Date().toLocaleDateString('en-CA');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

const mergeTestData = {
  userId: TEST_USER,
  streak: 12,
  todayLoggedHours: 2.0,
  dailyActivity: { [todayStr]: 120 },
  routine: [
    { id: 'today_block_1', title: 'Daily Warmup', startTime: '07:00', endTime: '08:00', completed: false }
  ],
  tomorrowPlan: [
    {
      id: 'plan_merge_1',
      title: 'Calculus Definite Integrals',
      startTime: '10:00',
      endTime: '12:00',
      scheduledDate: todayStr, // Due today! Should merge
      category: 'Core Study',
      syllabusLink: {
        subjectId: 'math_1',
        subjectName: 'Calculus',
        chapterId: 'chap_3',
        chapterName: 'Integration',
        topicName: 'Definite Integrals'
      },
      notified: false
    },
    {
      id: 'plan_merge_2',
      title: 'Organic Chemistry Reactions',
      startTime: '14:00',
      endTime: '15:30',
      scheduledDate: todayStr, // Due today! Should merge (no syllabus link fallback)
      category: 'Problem Solving',
      syllabusLink: null,
      notified: false
    },
    {
      id: 'plan_future_1',
      title: 'Future Wave Optics',
      startTime: '16:00',
      endTime: '18:00',
      scheduledDate: tomorrowStr, // Future date! Should NOT merge yet
      category: 'Revision',
      syllabusLink: null,
      notified: false
    }
  ]
};

localStorage.setItem(`studyflow_${TEST_USER}_data`, JSON.stringify(mergeTestData));

// Execute auto-merge engine
const mergeResult = autoMergeTomorrowPlans(TEST_USER);
assert(mergeResult.merged === true, 'autoMergeTomorrowPlans reports merged: true');
assert(mergeResult.count === 2, '2 items merged into routine');
assert(mergeResult.message.includes("Tomorrow's planned topics have been merged"), 'Clean toast message generated');

// Verify updated dataset
const postMergeData = getUserData(TEST_USER);
assert(postMergeData.routine.length === 3, 'Routine now has 3 total blocks (1 existing + 2 merged)');
assert(postMergeData.tomorrowPlan.length === 1, 'Only future plan remains in tomorrowPlan');
assert(postMergeData.tomorrowPlan[0].id === 'plan_future_1', 'Future plan was preserved');

// Verify merged block 1 schema
const merged1 = postMergeData.routine.find(r => r.id === 'plan_merge_1');
assert(merged1 !== undefined, 'Merged block 1 found in routine');
assert(merged1.title === 'Calculus Definite Integrals', 'Merged block title preserved');
assert(merged1.startTime === '10:00', 'Merged block startTime matches');
assert(merged1.endTime === '12:00', 'Merged block endTime matches');
assert(merged1.category === 'Core Study', 'Merged block category matches');
assert(merged1.completed === false, 'Merged block completed initialized to false');
assert(merged1.linkType === 'syllabus', 'Merged block linkType set to "syllabus"');
assert(merged1.syllabusLink.subjectName === 'Calculus', 'Syllabus link intact');

// Verify unlinked merged block 2 fallback
const merged2 = postMergeData.routine.find(r => r.id === 'plan_merge_2');
assert(merged2 !== undefined, 'Merged block 2 found in routine');
assert(merged2.linkType === 'routine', 'Unlinked block falls back safely to linkType: "routine"');
assert(merged2.category === 'Problem Solving', 'Problem Solving category preserved');

// Verify streaks and logged hours were completely untouched
assert(postMergeData.streak === 12, 'Streak remains untouched at 12');
assert(postMergeData.todayLoggedHours === 2.0, 'todayLoggedHours remains untouched at 2.0');
assert(postMergeData.dailyActivity[todayStr] === 120, 'dailyActivity untouched');

// 2.2 Re-running autoMergeTomorrowPlans when no items are due returns merged: false
const secondMerge = autoMergeTomorrowPlans(TEST_USER);
assert(secondMerge.merged === false, 'Second run merges nothing (merged: false)');
assert(secondMerge.count === 0, 'Count is 0');


console.log('\n================================================================');
console.log('--- 3. 30-MINUTE PRIOR BROWSER NOTIFICATION SYSTEM ---');
console.log('================================================================');

// 3.1 Time Parser tests
assert(parseTimeToMinutes('10:00') === 600, 'parseTimeToMinutes("10:00") === 600');
assert(parseTimeToMinutes('08:30') === 510, 'parseTimeToMinutes("08:30") === 510');
assert(parseTimeToMinutes('10:00 - 12:00') === 600, 'parseTimeToMinutes parses start time from range "10:00 - 12:00"');
assert(parseTimeToMinutes('invalid') === null, 'parseTimeToMinutes handles invalid string gracefully');

// 3.2 Permission helper
assert(getNotificationPermission() === 'granted', 'getNotificationPermission returns "granted"');

// 3.3 Reminder Trigger Window:
// Let task start at 10:00 (startMinutes = 600)
// reminderMinutes = 600 - 30 = 570 (09:30)
const notificationTestData = {
  userId: TEST_USER,
  streak: 5,
  routine: [
    {
      id: 'notif_slot_1',
      title: 'Calculus Deep Work',
      startTime: '10:00',
      endTime: '12:00',
      completed: false,
      notified: false,
      syllabusLink: { subjectName: 'Calculus' }
    },
    {
      id: 'notif_slot_2',
      title: 'Completed Physics',
      startTime: '10:00',
      endTime: '12:00',
      completed: true, // Should be ignored because it is already done
      notified: false
    }
  ]
};

localStorage.setItem(`studyflow_${TEST_USER}_data`, JSON.stringify(notificationTestData));
dispatchedNotifications = [];

// Case A: 09:25 (565 mins) -> Outside window (too early)
const timeEarly = new Date();
timeEarly.setHours(9, 25, 0, 0);
let notified = checkStudyReminders(TEST_USER, timeEarly);
assert(notified.length === 0, 'No notification triggered at 09:25 (outside 30-min window)');
assert(dispatchedNotifications.length === 0, 'No browser notification dispatched');

// Case B: 09:30 (570 mins) -> Exactly 30 minutes prior! Should trigger
const timeReminder = new Date();
timeReminder.setHours(9, 30, 0, 0);
notified = checkStudyReminders(TEST_USER, timeReminder);
assert(notified.length === 1, 'Notification triggered at 09:30 (within 30-min window)');
assert(dispatchedNotifications.length === 1, 'Browser notification dispatched');
assert(dispatchedNotifications[0].title === '⏰ Study Reminder (Starts in 30 mins)', 'Notification title matches requirement');
assert(dispatchedNotifications[0].options.body.includes('Calculus Deep Work'), 'Notification body contains task title');
assert(dispatchedNotifications[0].options.body.includes('Calculus'), 'Notification body contains subject name');
assert(dispatchedNotifications[0].options.icon === '/icons/icon-192.png', 'Notification icon matches /icons/icon-192.png');
assert(dispatchedNotifications[0].options.tag === 'notif_slot_1', 'Notification tag matches slot id');

// Verify slot marked notified: true in storage
const storageAfterNotif = getUserData(TEST_USER);
const slot1After = storageAfterNotif.routine.find(r => r.id === 'notif_slot_1');
assert(slot1After.notified === true, 'Slot marked notified: true in storage');

// Case C: 09:35 (575 mins) -> Within window, but already notified! Should NOT trigger duplicate
dispatchedNotifications = [];
const timeLater = new Date();
timeLater.setHours(9, 35, 0, 0);
notified = checkStudyReminders(TEST_USER, timeLater);
assert(notified.length === 0, 'Duplicate notification prevented when slot.notified === true');
assert(dispatchedNotifications.length === 0, 'Zero duplicate notifications dispatched');

// Case D: 10:00 (600 mins) -> Current time reached start time. Should NOT trigger 30-min reminder
dispatchedNotifications = [];
const timeStart = new Date();
timeStart.setHours(10, 0, 0, 0);
notified = checkStudyReminders(TEST_USER, timeStart);
assert(notified.length === 0, 'No 30-min advance reminder after task has started');


console.log('\n================================================================');
console.log('--- 4. UI STRUCTURE & COMPONENT INTEGRITY CHECKS ---');
console.log('================================================================');

// 4.1 Check routine.js exports
const routineJs = fs.readFileSync(path.join(process.cwd(), 'routine.js'), 'utf8');
assert(routineJs.includes('DailyRoutine'), 'routine.js exports DailyRoutine');
assert(routineJs.includes('RoutineView'), 'routine.js exports RoutineView');
assert(routineJs.includes('TomorrowPlannerModal'), 'routine.js exports TomorrowPlannerModal');
assert(routineJs.includes('autoMergeTomorrowPlans'), 'routine.js exports autoMergeTomorrowPlans');
assert(routineJs.includes('saveTomorrowPlan'), 'routine.js exports saveTomorrowPlan');

// 4.2 Check DailyRoutine.jsx UI elements
const dailyRoutineJsx = fs.readFileSync(path.join(process.cwd(), 'src/components/DailyRoutine.jsx'), 'utf8');
assert(dailyRoutineJsx.includes("Today's Routine"), 'DailyRoutine.jsx includes "Today\'s Routine" tab label');
assert(dailyRoutineJsx.includes("Tomorrow's Plan"), 'DailyRoutine.jsx includes "Tomorrow\'s Plan" tab label');
assert(dailyRoutineJsx.includes('tab-todays-routine'), 'DailyRoutine.jsx contains tab-todays-routine button');
assert(dailyRoutineJsx.includes('tab-tomorrows-plan'), 'DailyRoutine.jsx contains tab-tomorrows-plan button');
assert(dailyRoutineJsx.includes('add-tomorrow-plan-btn'), 'DailyRoutine.jsx contains "+ Plan for Tomorrow" button');
assert(dailyRoutineJsx.includes('tomorrow-plan-card'), 'DailyRoutine.jsx contains tomorrow-plan-card template');
assert(dailyRoutineJsx.includes('handleEditTomorrowPlan'), 'DailyRoutine.jsx includes edit handler for tomorrow plans');
assert(dailyRoutineJsx.includes('deleteTomorrowPlan'), 'DailyRoutine.jsx includes delete handler for tomorrow plans');

// 4.3 Check TomorrowPlannerModal.jsx modal fields
const modalJsx = fs.readFileSync(path.join(process.cwd(), 'src/components/TomorrowPlannerModal.jsx'), 'utf8');
assert(modalJsx.includes('tomorrow-plan-start-time'), 'Modal has start time input');
assert(modalJsx.includes('tomorrow-plan-end-time'), 'Modal has end time input');
assert(modalJsx.includes('tomorrow-subject-select'), 'Modal has subject selector');
assert(modalJsx.includes('tomorrow-chapter-select'), 'Modal has chapter selector');
assert(modalJsx.includes('tomorrow-topic-select'), 'Modal has topic selector');
assert(modalJsx.includes('tomorrow-plan-title'), 'Modal has task title input');
assert(modalJsx.includes('quick-fill-tomorrow-topic-btn'), 'Modal has quick fill topic button');
assert(modalJsx.includes('Core Study'), 'Modal contains Core Study category');
assert(modalJsx.includes('Revision'), 'Modal contains Revision category');
assert(modalJsx.includes('Problem Solving'), 'Modal contains Problem Solving category');
assert(modalJsx.includes('submit-tomorrow-plan-btn'), 'Modal has submit plan button');

// 4.4 Check AppShell.jsx header bell toggle & toast banner
const appShellJsx = fs.readFileSync(path.join(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
assert(appShellJsx.includes('notification-reminder-toggle'), 'AppShell.jsx has notification reminder toggle');
assert(appShellJsx.includes('🔔 Enable Study Reminders'), 'AppShell.jsx has "🔔 Enable Study Reminders" text');
assert(appShellJsx.includes('tomorrow-plan-merged-toast'), 'AppShell.jsx has tomorrow-plan-merged-toast banner');
assert(appShellJsx.includes('startNotificationScheduler'), 'AppShell.jsx boots notification scheduler');

// 4.5 Check public icon
assert(fs.existsSync(path.join(process.cwd(), 'public/icons/icon-192.png')), 'public/icons/icon-192.png exists for browser notifications');

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================\n');
