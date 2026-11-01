/**
 * Automated Test Suite for User Feedback Form & Real-Time Traffic / Feature Analytics
 * (tests/test-feedback-telemetry.js)
 *
 * Verifies:
 * 1. Configuration & Fallback Helpers (telemetry-config.js, admin-config.js)
 * 2. Anonymous Persistent Visitor ID & logFeatureUse pipeline (telemetry.js)
 * 3. Feedback Submission & Storage (sendFeedback, getFeedbackInbox)
 * 4. Sidebar Feedback Button & FeedbackModal UI (CollapsibleSidebar.jsx, FeedbackModal.jsx)
 * 5. Admin Portal Super Admin Cards: Website Traffic & Student Feedback Inbox (AdminPortal.jsx)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TELEMETRY_ENDPOINT,
  isTelemetryConfigured,
  safeSendTelemetry
} from '../src/config/telemetry-config.js';
import {
  getVisitorId,
  getDeviceType,
  logFeatureUse,
  sendFeedback,
  getTelemetryAnalytics,
  getFeedbackInbox,
  TELEMETRY_STORAGE_KEY,
  FEEDBACK_INBOX_KEY
} from '../src/utils/telemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

console.log('\n--- STARTING FEEDBACK & TELEMETRY TEST SUITE ---\n');

test('1. Configuration & Fallback Helper: TELEMETRY_ENDPOINT and safeSendTelemetry', async () => {
  assert(typeof TELEMETRY_ENDPOINT === 'string' && TELEMETRY_ENDPOINT.length > 0);
  assert.strictEqual(isTelemetryConfigured("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL"), false);
  assert.strictEqual(isTelemetryConfigured("YOUR_EXEC_URL_HERE"), false);
  assert.strictEqual(isTelemetryConfigured(""), false);
  assert.strictEqual(isTelemetryConfigured("https://script.google.com/macros/s/xyz/exec"), true);

  // safeSendTelemetry fails silently when unconfigured without throwing errors
  const fallbackResult = await safeSendTelemetry({ type: 'telemetry' }, "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL");
  assert.strictEqual(fallbackResult.success, false);
  assert.strictEqual(fallbackResult.fallback, true);

  // admin-config.js re-exports TELEMETRY_URL and TELEMETRY_ENDPOINT
  const adminCfgPath = path.join(rootDir, 'admin-config.js');
  const adminCfgContent = fs.readFileSync(adminCfgPath, 'utf8');
  assert(adminCfgContent.includes('export const TELEMETRY_URL'), 'admin-config.js exports TELEMETRY_URL');
  assert(adminCfgContent.includes('export const TELEMETRY_ENDPOINT'), 'admin-config.js exports TELEMETRY_ENDPOINT');
  assert(adminCfgContent.includes('isTelemetryConfigured'), 'admin-config.js exports isTelemetryConfigured');
});

test('2. Anonymous Persistent Visitor ID Generation & Storage', () => {
  // Mock localStorage
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };

  const id1 = getVisitorId();
  assert(id1.startsWith('usr_'), `Visitor ID must start with "usr_", got: ${id1}`);
  assert.strictEqual(store['study_visitor_id'], id1, 'Visitor ID must be stored in localStorage');

  // Second call must return the exact same persistent visitor ID
  const id2 = getVisitorId();
  assert.strictEqual(id2, id1, 'Subsequent getVisitorId calls must return the persisted ID');
});

test('3. logFeatureUse records engagement & computes ranked analytics', () => {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };
  global.window = {
    dispatchEvent: () => {}
  };

  // Log several feature uses
  logFeatureUse('Page Visit');
  logFeatureUse('Focus Timer');
  logFeatureUse('Focus Timer');
  logFeatureUse('Daily Routine');
  logFeatureUse('Daily Routine');
  logFeatureUse('Daily Routine');
  logFeatureUse('Subjects & Syllabus');

  const analytics = getTelemetryAnalytics();
  assert(analytics.totalVisitors >= 1, 'Total visitors must be at least 1');
  assert(analytics.totalInteractions >= 7, 'Total interactions must be at least 7');

  // Verify ranking: Daily Routine (3) > Focus Timer (2) > Syllabus (1)
  assert(Array.isArray(analytics.rankedFeatures), 'rankedFeatures must be an array');
  const routineRank = analytics.rankedFeatures.find(f => f.feature === 'Daily Routine');
  const timerRank = analytics.rankedFeatures.find(f => f.feature === 'Focus Timer');
  const syllabusRank = analytics.rankedFeatures.find(f => f.feature === 'Subjects & Syllabus');

  assert(routineRank && routineRank.count === 3, 'Daily Routine count must be 3');
  assert(timerRank && timerRank.count === 2, 'Focus Timer count must be 2');
  assert(syllabusRank && syllabusRank.count === 1, 'Subjects & Syllabus count must be 1');
  assert(routineRank.percentage > 0, 'Percentage must be greater than 0');
});

test('4. sendFeedback records student feedback messages in inbox', async () => {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; }
  };
  global.window = {
    dispatchEvent: () => {}
  };

  const payload = {
    email: 'student@studyflow.local',
    rating: 5,
    category: '💡 Feature Idea',
    message: 'Add dark mode toggle to the mobile bottom bar.'
  };

  const result = await sendFeedback(payload);
  assert.strictEqual(result.success, true);
  assert(result.entry.id.startsWith('FB-'), 'Feedback entry ID must start with FB-');
  assert.strictEqual(result.entry.rating, 5);
  assert.strictEqual(result.entry.category, '💡 Feature Idea');
  assert.strictEqual(result.entry.message, 'Add dark mode toggle to the mobile bottom bar.');

  const inbox = getFeedbackInbox();
  assert.strictEqual(inbox.length, 1, 'Inbox must contain 1 feedback entry');
  assert.strictEqual(inbox[0].email, 'student@studyflow.local');
  assert.strictEqual(inbox[0].rating, 5);
});

test('5. CollapsibleSidebar has Feedback button placed directly below Focus Timer with chat-bubble icon', () => {
  const sidebarPath = path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  assert(content.includes('MessageSquare'), 'Sidebar imports MessageSquare chat-bubble icon');
  assert(content.includes('sidebar-feedback-btn'), 'Sidebar contains #sidebar-feedback-btn');
  assert(content.includes('FeedbackModal'), 'Sidebar renders FeedbackModal');
  assert(content.includes('Feedback'), 'Sidebar contains Feedback label');
  assert(content.includes('logFeatureUse'), 'Sidebar integrates logFeatureUse');
  assert(content.includes("logFeatureUse('Page Visit')"), 'Sidebar calls logFeatureUse("Page Visit") on mount');

  // Verify ordering: Focus Timer comes before Feedback
  const timerIndex = content.indexOf("name: 'Focus Timer'");
  const feedbackBtnIndex = content.indexOf('sidebar-feedback-btn');
  assert(timerIndex > 0 && feedbackBtnIndex > timerIndex, 'Feedback button must be placed directly below Focus Timer');

  // Confirmation toast check
  assert(content.includes('Thank you! Your feedback has been sent directly to the developer.'), 'Contains required confirmation toast message');
});

test('6. FeedbackModal component has 5 stars, category pills, textarea, and submit button', () => {
  const modalPath = path.join(rootDir, 'src', 'components', 'FeedbackModal.jsx');
  assert(fs.existsSync(modalPath), 'FeedbackModal.jsx file exists');
  const content = fs.readFileSync(modalPath, 'utf8');

  assert(content.includes('Send Feedback or Feature Request'), 'Modal has title "Send Feedback or Feature Request"');
  assert(content.includes('Star') && content.includes('[1, 2, 3, 4, 5]'), 'Modal renders 5 clickable interactive stars');
  assert(content.includes('💡 Feature Idea'), 'Modal contains [💡 Feature Idea] pill');
  assert(content.includes('🐞 Bug Report'), 'Modal contains [🐞 Bug Report] pill');
  assert(content.includes('💬 General Feedback'), 'Modal contains [💬 General Feedback] pill');
  assert(content.includes("Tell us what you'd like improved or added..."), 'Modal contains textarea placeholder');
  assert(content.includes('Submit Feedback'), 'Modal contains submit button');
});

test('7. AdminPortal implements Website Traffic & Student Feedback Inbox cards accessible to Super Admin', () => {
  const portalPath = path.join(rootDir, 'src', 'components', 'AdminPortal.jsx');
  const content = fs.readFileSync(portalPath, 'utf8');

  // Super Admin validation
  assert(content.includes('kuldeepkumarncc2dbn@gmail.com'), 'Contains Super Admin email check');

  // Card A: Website Traffic & Feature Popularity
  assert(content.includes('Website Traffic & Feature Popularity'), 'Card A: Contains "Website Traffic & Feature Popularity" header');
  assert(content.includes('Total Visitors'), 'Card A: Contains "Total Visitors" metric');
  assert(content.includes('Total Feature Interactions'), 'Card A: Contains "Total Feature Interactions" metric');
  assert(content.includes('telemetryData.rankedFeatures'), 'Card A: Ranks features by popularity');

  // Card B: Student Feedback Inbox
  assert(content.includes('Student Feedback Inbox'), 'Card B: Contains "Student Feedback Inbox" header');
  assert(content.includes('No feedback received yet.'), 'Card B: Contains empty state "No feedback received yet."');
  assert(content.includes('feedbackList.map'), 'Card B: Maps feedback feed with email, star rating, category, and message');
});

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

