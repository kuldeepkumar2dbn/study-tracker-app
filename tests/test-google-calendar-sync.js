/**
 * Automated Test Suite for Google Calendar Sync & 30-Minute Advance Reminders
 * (tests/test-google-calendar-sync.js)
 *
 * Verifies:
 * 1. OAuth Scopes & Incremental Consent (auth.js / google-auth.js)
 * 2. Event Title Formatting, RFC3339 Local Timezone & 30-Min Reminders Override (calendar-sync.js)
 * 3. Calendar API v3 Push & Offline/Permission Fallbacks
 * 4. Data Model Preservation via patchUserData (streaks, logged hours, auto-merge)
 * 5. UI Elements & Toggles in AddRoutineModal and TomorrowPlannerModal
 */

import fs from 'fs';
import path from 'path';
import {
  CALENDAR_EVENTS_SCOPE,
  DRIVE_FILE_SCOPE,
  DEFAULT_GOOGLE_SCOPES,
  hasCalendarScope,
  getGrantedScopes,
  saveGrantedScopes,
  requestCalendarScope
} from '../google-auth.js';
import {
  formatStudyEventTitle,
  formatRFC3339,
  getLocalTimeZone,
  buildCalendarEventPayload,
  pushStudySessionToCalendar,
  saveCalendarEventToItem,
  getCalendarPreference,
  setCalendarPreference,
  showCalendarSuccessToast,
  CALENDAR_PREFERENCE_KEY,
  DEFAULT_CALENDAR_SUCCESS_MESSAGE
} from '../calendar-sync.js';
import { 
  getUserData, 
  patchUserData, 
  autoMergeTomorrowPlans 
} from '../storage-helper.js';
import { createZeroStateData } from '../auth-guard.js';
import { createRoutineBlock } from '../src/utils/routineSyllabusSync.js';

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

// In-Memory Storage Mocks
const mockLocalStorage = {};
const mockSessionStorage = {};
const customEventListeners = {};

global.localStorage = {
  getItem: (k) => (k in mockLocalStorage ? mockLocalStorage[k] : null),
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.sessionStorage = {
  getItem: (k) => (k in mockSessionStorage ? mockSessionStorage[k] : null),
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

let dispatchedEvents = [];
global.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
    const handlers = customEventListeners[event.type] || [];
    handlers.forEach(h => h(event));
    return true;
  },
  addEventListener: (type, handler) => {
    if (!customEventListeners[type]) customEventListeners[type] = [];
    customEventListeners[type].push(handler);
  },
  removeEventListener: (type, handler) => {
    if (customEventListeners[type]) {
      customEventListeners[type] = customEventListeners[type].filter(h => h !== handler);
    }
  }
};

global.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict?.detail || null;
  }
};

try {
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });
  } else {
    global.navigator = { onLine: true };
  }
} catch (e) {
  // Ignore if defined
}

const TEST_USER = 'test_student_calendar_01';

console.log('\n================================================================');
console.log('--- 1. OAUTH SCOPES & INCREMENTAL CONSENT ---');
console.log('================================================================');

// 1.1 Scope Constants
assert(CALENDAR_EVENTS_SCOPE === 'https://www.googleapis.com/auth/calendar.events', 'CALENDAR_EVENTS_SCOPE matches Google Calendar Events endpoint');
assert(DEFAULT_GOOGLE_SCOPES.includes(CALENDAR_EVENTS_SCOPE), 'DEFAULT_GOOGLE_SCOPES includes calendar.events scope');
assert(DEFAULT_GOOGLE_SCOPES.includes(DRIVE_FILE_SCOPE), 'DEFAULT_GOOGLE_SCOPES includes drive.file scope');

// 1.2 hasCalendarScope helper
sessionStorage.clear();
assert(hasCalendarScope() === false, 'hasCalendarScope returns false when no scopes in session');
assert(hasCalendarScope('https://www.googleapis.com/auth/calendar.events') === true, 'hasCalendarScope returns true for matching scope string');
assert(hasCalendarScope({ scope: 'openid email https://www.googleapis.com/auth/calendar.events' }) === true, 'hasCalendarScope returns true for tokenResponse object');
assert(hasCalendarScope({ scope: 'openid email https://www.googleapis.com/auth/drive.file' }) === false, 'hasCalendarScope returns false for tokenResponse without calendar scope');

// 1.3 Scope persistence in sessionStorage
saveGrantedScopes('openid email');
assert(!getGrantedScopes().includes(CALENDAR_EVENTS_SCOPE), 'Initial scopes do not have calendar scope');
saveGrantedScopes(CALENDAR_EVENTS_SCOPE);
assert(hasCalendarScope() === true, 'hasCalendarScope returns true after saveGrantedScopes persists calendar scope to sessionStorage');
assert(getGrantedScopes().includes('openid'), 'saveGrantedScopes preserves previously granted scopes');

// 1.4 requestCalendarScope when already granted
const grantedResult = await requestCalendarScope();
assert(grantedResult && grantedResult.success && grantedResult.granted, 'requestCalendarScope resolves immediately when scope is already granted');

// 1.5 requestCalendarScope incremental consent mock
sessionStorage.clear();
global.window.google = {
  accounts: {
    oauth2: {
      initTokenClient: ({ scope, callback }) => ({
        requestAccessToken: () => {
          callback({
            access_token: 'mock_access_token_incremental_123',
            scope: scope,
            expires_in: 3600
          });
        }
      })
    }
  }
};

const incrementalResult = await requestCalendarScope();
assert(incrementalResult && incrementalResult.success && incrementalResult.granted, 'requestCalendarScope executes incremental consent via GIS');
assert(sessionStorage.getItem('studyflow_drive_token') === 'mock_access_token_incremental_123', 'Access token saved in sessionStorage');
assert(hasCalendarScope() === true, 'Calendar scope recorded in sessionStorage after approval');

// 1.6 User denies consent
sessionStorage.clear();
global.window.google.accounts.oauth2.initTokenClient = ({ callback }) => ({
  requestAccessToken: () => {
    callback({
      error: 'access_denied',
      error_description: 'User dismissed the consent popup'
    });
  }
});
const deniedResult = await requestCalendarScope();
assert(deniedResult && deniedResult.success === false && deniedResult.granted === false, 'requestCalendarScope resolves gracefully without throwing when user denies consent');

console.log('\n================================================================');
console.log('--- 2. EVENT TITLE FORMATTING & TIMEZONE HANDLING ---');
console.log('================================================================');

// 2.1 Title formatting
const titleWithSubject = formatStudyEventTitle('Integration by Parts', 'Calculus');
assert(titleWithSubject === '📚 Study: Integration by Parts (Calculus)', 'formatStudyEventTitle with subject matches 📚 Study: [Topic] ([Subject])');

const titleWithoutSubject = formatStudyEventTitle('Deep Work Session', null);
assert(titleWithoutSubject === '📚 Study: Deep Work Session', 'formatStudyEventTitle without subject formats as 📚 Study: [Topic]');

const titleEmptySubject = formatStudyEventTitle('Review Flashcards', '   ');
assert(titleEmptySubject === '📚 Study: Review Flashcards', 'formatStudyEventTitle with empty subject whitespace handles correctly');

// 2.2 Local IANA timezone
const tz = getLocalTimeZone();
assert(typeof tz === 'string' && tz.length > 0, `Local IANA timezone detected: ${tz}`);

// 2.3 formatRFC3339
const rfcStr = formatRFC3339('2026-10-31', '10:00');
assert(/^2026-10-31T10:00:00[+-]\d{2}:\d{2}$/.test(rfcStr), `formatRFC3339 produces valid RFC3339 datetime: ${rfcStr}`);

// 2.4 buildCalendarEventPayload with 30-min reminders override
const payload = buildCalendarEventPayload({
  title: 'Organic Chemistry Reactions',
  startTime: '14:00',
  endTime: '16:00',
  scheduledDate: '2026-10-31',
  subjectName: 'Chemistry',
  description: 'Practice SN1 and SN2 reaction mechanisms'
});

assert(payload.summary === '📚 Study: Organic Chemistry Reactions (Chemistry)', 'Payload summary matches title specification');
assert(payload.start && payload.start.dateTime && payload.start.timeZone === tz, 'Payload start contains RFC3339 dateTime and timeZone');
assert(payload.end && payload.end.dateTime && payload.end.timeZone === tz, 'Payload end contains RFC3339 dateTime and timeZone');
assert(payload.reminders.useDefault === false, 'Payload overrides default reminders (useDefault: false)');
assert(Array.isArray(payload.reminders.overrides), 'Payload contains overrides array');
assert(payload.reminders.overrides.length === 1, 'Payload has exactly 1 reminder override');
assert(payload.reminders.overrides[0].method === 'popup', 'Reminder override method is popup');
assert(payload.reminders.overrides[0].minutes === 30, 'Reminder override is set exactly 30 minutes prior');

// 2.5 Overnight time blocks handle end date progression
const overnightPayload = buildCalendarEventPayload({
  title: 'Late Night Coding',
  startTime: '23:00',
  endTime: '01:00',
  scheduledDate: '2026-10-31'
});
assert(overnightPayload.start.dateTime.startsWith('2026-10-31T23:00'), 'Overnight block starts on scheduledDate');
assert(overnightPayload.end.dateTime.startsWith('2026-11-01T01:00'), 'Overnight block ends on next day (2026-11-01)');

console.log('\n================================================================');
console.log('--- 3. CALENDAR API v3 PUSH & ERROR HANDLING ---');
console.log('================================================================');

// 3.1 Successful Calendar Event Creation
let fetchCallHistory = [];
global.fetch = async (url, options) => {
  fetchCallHistory.push({ url, options });
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'cal_event_xyz789',
      summary: '📚 Study: Integration (Math)',
      status: 'confirmed',
      htmlLink: 'https://www.google.com/calendar/event?eid=xyz789'
    })
  };
};

sessionStorage.setItem('studyflow_drive_token', 'valid_token_abc');

let pushResult = null;
await pushStudySessionToCalendar({
  title: 'Integration',
  startTime: '10:00',
  endTime: '12:00',
  scheduledDate: '2026-10-31',
  subjectName: 'Math'
}).then(r => { pushResult = r; });

assert(pushResult && pushResult.success === true, 'pushStudySessionToCalendar returns success: true');
assert(pushResult.eventId === 'cal_event_xyz789', 'pushStudySessionToCalendar returns created eventId');
assert(fetchCallHistory.length === 1, 'Made 1 HTTP request to Google Calendar API');
assert(fetchCallHistory[0].url === 'https://www.googleapis.com/calendar/v3/calendars/primary/events', 'POST target is Google Calendar primary events');
assert(fetchCallHistory[0].options.headers.Authorization === 'Bearer valid_token_abc', 'Request contains valid Bearer token');

// 3.2 Offline handling
try { Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }); } catch {}
let offlineResult = null;
await pushStudySessionToCalendar({
  title: 'Offline Test',
  startTime: '08:00',
  endTime: '09:00'
}).then(r => { offlineResult = r; });

assert(offlineResult && offlineResult.success === false, 'Returns failure when offline');
assert(offlineResult.reason === 'offline', 'Returns reason: offline');
try { Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); } catch {}

// 3.3 Missing token handling
sessionStorage.clear();
let noTokenResult = null;
await pushStudySessionToCalendar({
  title: 'No Token Test',
  startTime: '08:00',
  endTime: '09:00'
}).then(r => { noTokenResult = r; });

assert(noTokenResult && noTokenResult.success === false, 'Returns failure when no token available');
assert(noTokenResult.reason === 'no_token', 'Returns reason: no_token');

// 3.4 API Error handling (e.g. 403 Forbidden or 401 Unauthorized)
sessionStorage.setItem('studyflow_drive_token', 'expired_token');
global.fetch = async () => ({
  ok: false,
  status: 403,
  statusText: 'Forbidden',
  json: async () => ({ error: { message: 'Insufficient Permission' } })
});

let apiErrorResult = null;
await pushStudySessionToCalendar({
  title: 'Forbidden Test',
  startTime: '08:00',
  endTime: '09:00'
}).then(r => { apiErrorResult = r; });

assert(apiErrorResult && apiErrorResult.success === false, 'Handles HTTP 403 gracefully without throwing');
assert(apiErrorResult.status === 403, 'Returns HTTP status 403');
assert(apiErrorResult.error === 'Insufficient Permission', 'Captures API error message');

console.log('\n================================================================');
console.log('--- 4. DATA MODEL PERSISTENCE & AUTO-MERGE ---');
console.log('================================================================');

localStorage.clear();

// 4.1 createRoutineBlock supports calendarEventId
const blockWithCal = createRoutineBlock({
  title: 'Electromagnetism Lecture',
  startTime: '09:00',
  endTime: '11:00',
  category: 'Core Study',
  calendarEventId: 'cal_event_physics_101'
});
assert(blockWithCal.calendarEventId === 'cal_event_physics_101', 'createRoutineBlock preserves calendarEventId');

const blockWithoutCal = createRoutineBlock({
  title: 'Standard Math Block'
});
assert(blockWithoutCal.calendarEventId === null, 'createRoutineBlock defaults calendarEventId to null');

// 4.2 Save calendarEventId to routine and tomorrow plan items non-destructively
const baseUserData = {
  userId: TEST_USER,
  streak: 12,
  todayLoggedHours: 4.5,
  dailyActivity: { '2026-10-30': 270 },
  routine: [
    { id: 'rt_100', title: 'Calculus Slot', startTime: '08:00', endTime: '10:00', completed: false }
  ],
  tomorrowPlan: [
    { id: 'plan_200', title: 'Thermodynamics Practice', startTime: '11:00', endTime: '13:00', scheduledDate: '2026-10-31', completed: false }
  ]
};

localStorage.setItem(`studyflow_${TEST_USER}_data`, JSON.stringify(baseUserData));

// Update routine block with calendarEventId
const updatedData1 = saveCalendarEventToItem(TEST_USER, {
  itemId: 'rt_100',
  itemType: 'routine',
  calendarEventId: 'cal_event_calc_999'
});

assert(updatedData1 !== null, 'saveCalendarEventToItem successfully updated routine');
assert(updatedData1.routine[0].calendarEventId === 'cal_event_calc_999', 'Routine item has calendarEventId');
assert(updatedData1.streak === 12, 'Streak is completely preserved at 12');
assert(updatedData1.todayLoggedHours === 4.5, 'Logged hours completely preserved at 4.5');
assert(updatedData1.dailyActivity['2026-10-30'] === 270, 'Daily activity record is intact');

// Update tomorrow plan item with calendarEventId
const updatedData2 = saveCalendarEventToItem(TEST_USER, {
  itemId: 'plan_200',
  itemType: 'tomorrowPlan',
  calendarEventId: 'cal_event_thermo_888'
});

assert(updatedData2 !== null, 'saveCalendarEventToItem successfully updated tomorrowPlan');
assert(updatedData2.tomorrowPlan[0].calendarEventId === 'cal_event_thermo_888', 'Tomorrow plan item has calendarEventId');
assert(updatedData2.streak === 12, 'Streak remains untouched at 12');

// 4.3 Auto-Merge carries forward calendarEventId to routine blocks
const mergeTargetPlan = {
  id: 'plan_merge_test',
  title: 'Quantum Mechanics',
  startTime: '10:00',
  endTime: '12:00',
  scheduledDate: new Date().toLocaleDateString('en-CA'), // Scheduled for today -> will merge!
  category: 'Core Study',
  calendarEventId: 'cal_event_quantum_777'
};

patchUserData(TEST_USER, {
  tomorrowPlan: [mergeTargetPlan]
});

const mergeResult = autoMergeTomorrowPlans(TEST_USER);
assert(mergeResult.merged === true, 'autoMergeTomorrowPlans executed merge');
assert(mergeResult.count === 1, 'Merged 1 item');

const mergedBlock = mergeResult.updatedRoutine.find(b => b.id === 'plan_merge_test');
assert(Boolean(mergedBlock), 'Merged block found in updatedRoutine');
assert(mergedBlock.calendarEventId === 'cal_event_quantum_777', 'autoMergeTomorrowPlans retained calendarEventId on merged routine block');

console.log('\n================================================================');
console.log('--- 5. UI TOGGLES, TOASTS & PREFERENCES ---');
console.log('================================================================');

// 5.1 Calendar preference getter & setter
localStorage.clear();
assert(getCalendarPreference() === false, 'Default preference is false when unset');
setCalendarPreference(true);
assert(getCalendarPreference() === true, 'getCalendarPreference returns true after setCalendarPreference(true)');
assert(localStorage.getItem(CALENDAR_PREFERENCE_KEY) === 'true', 'Preference persisted to localStorage');
setCalendarPreference(false);
assert(getCalendarPreference() === false, 'getCalendarPreference returns false after setCalendarPreference(false)');

// 5.2 Success Toast Notification Dispatch
dispatchedEvents = [];
showCalendarSuccessToast();
assert(dispatchedEvents.length === 1, 'Dispatched custom event');
assert(dispatchedEvents[0].type === 'studyflow-calendar-event-created', 'Event type is studyflow-calendar-event-created');
assert(dispatchedEvents[0].detail.message === DEFAULT_CALENDAR_SUCCESS_MESSAGE, 'Default toast message matches specification: "📅 Event added to your Google Calendar! Reminder set for 30 minutes prior."');

// 5.3 Static file inspection for modal components
const addRoutineModalCode = fs.readFileSync(path.resolve('./src/components/AddRoutineModal.jsx'), 'utf-8');
assert(addRoutineModalCode.includes('routine-push-calendar-toggle'), 'AddRoutineModal contains #routine-push-calendar-toggle checkbox');
assert(addRoutineModalCode.includes('Push to Google Calendar'), 'AddRoutineModal contains "Push to Google Calendar" toggle label');
assert(addRoutineModalCode.includes('30-min phone & lock-screen alarm'), 'AddRoutineModal contains "(30-min phone & lock-screen alarm)" description');
assert(addRoutineModalCode.includes("Rings on your phone's calendar 30 minutes before the session starts"), 'AddRoutineModal contains helper note');
assert(addRoutineModalCode.includes('pushStudySessionToCalendar'), 'AddRoutineModal invokes pushStudySessionToCalendar');

const tomorrowModalCode = fs.readFileSync(path.resolve('./src/components/TomorrowPlannerModal.jsx'), 'utf-8');
assert(tomorrowModalCode.includes('tomorrow-push-calendar-toggle'), 'TomorrowPlannerModal contains #tomorrow-push-calendar-toggle checkbox');
assert(tomorrowModalCode.includes('Push to Google Calendar'), 'TomorrowPlannerModal contains "Push to Google Calendar" toggle label');
assert(tomorrowModalCode.includes('30-min phone & lock-screen alarm'), 'TomorrowPlannerModal contains "(30-min phone & lock-screen alarm)" description');
assert(tomorrowModalCode.includes("Rings on your phone's calendar 30 minutes before the session starts"), 'TomorrowPlannerModal contains helper note');
assert(tomorrowModalCode.includes('pushStudySessionToCalendar'), 'TomorrowPlannerModal invokes pushStudySessionToCalendar');

const appShellCode = fs.readFileSync(path.resolve('./src/components/AppShell.jsx'), 'utf-8');
assert(appShellCode.includes('calendar-event-created-toast'), 'AppShell renders #calendar-event-created-toast container');
assert(appShellCode.includes('studyflow-calendar-event-created'), 'AppShell listens for studyflow-calendar-event-created custom event');

const routineJsCode = fs.readFileSync(path.resolve('./routine.js'), 'utf-8');
assert(routineJsCode.includes('pushStudySessionToCalendar'), 'routine.js exports pushStudySessionToCalendar');
assert(routineJsCode.includes('hasCalendarScope'), 'routine.js exports hasCalendarScope');

console.log('\n================================================================');
console.log(`--- RESULTS: ${passedTests} / ${totalTests} TESTS PASSED ---`);
console.log('================================================================\n');
