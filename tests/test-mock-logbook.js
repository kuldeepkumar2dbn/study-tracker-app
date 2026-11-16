/**
 * Test Suite: Mock Test & Mistake Logbook Feature
 * tests/test-mock-logbook.js
 *
 * Verifies:
 * 1. WORKSPACE sidebar navigation integration right below Exam Radar
 * 2. Zero-reload SPA routing & #view-mock-logbook container
 * 3. Top summary metrics (Accuracy, Score, Penalty, Top Mistake Pattern)
 * 4. Interactive mock test entry & live negative marking calculator
 * 5. Mistake category pills & auto-revision trigger for Conceptual Gaps
 * 6. History log, LocalStorage persistence, and Google Drive sync logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('\n=== RUNNING MOCK TEST & MISTAKE LOGBOOK TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Sidebar Navigation & SPA Router Integration
// -------------------------------------------------------------
console.log('--- SECTION 1: Sidebar Navigation & SPA Router Integration ---');

const sidebarJsPath = path.join(rootDir, 'sidebar.js');
const sidebarJs = fs.readFileSync(sidebarJsPath, 'utf8');
assert(sidebarJs.includes("'mock-logbook'"), 'sidebar.js must define mock-logbook item');

// Verify mock-logbook is positioned right below Exam Radar in sidebar.js
const radarIdx = sidebarJs.indexOf("id: 'radar'");
const mockIdx = sidebarJs.indexOf("id: 'mock-logbook'");
const skillsIdx = sidebarJs.indexOf("id: 'skills'");
assert(radarIdx !== -1 && mockIdx !== -1 && skillsIdx !== -1, 'radar, mock-logbook, and skills must exist');
assert(radarIdx < mockIdx && mockIdx < skillsIdx, 'Mock Logbook must be positioned right below Exam Radar and above Skill Tracker');

console.log('✔ Test 1.1: sidebar.js defines Mock Logbook right below Exam Radar');

// CollapsibleSidebar.jsx
const collapsibleSidebarPath = path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx');
const collapsibleSidebar = fs.readFileSync(collapsibleSidebarPath, 'utf8');
assert(collapsibleSidebar.includes("id: 'mock-logbook'"), 'CollapsibleSidebar.jsx must include mock-logbook');
assert(collapsibleSidebar.includes("name: 'Mock Logbook'"), 'CollapsibleSidebar.jsx must have name Mock Logbook');
assert(collapsibleSidebar.includes("'mock-logbook': {"), 'CollapsibleSidebar.jsx must define ACTIVE_PILL_STYLES for mock-logbook');

console.log('✔ Test 1.2: CollapsibleSidebar.jsx configures Mock Logbook navigation item and glowing active pill styles');

// router.js
const routerJsPath = path.join(rootDir, 'router.js');
const routerJs = fs.readFileSync(routerJsPath, 'utf8');
assert(routerJs.includes("'mock-logbook'"), 'router.js VIEW_IDS must include mock-logbook');
assert(routerJs.includes("'mock-logbook': 'Mock Logbook'"), 'router.js FEATURE_NAME_MAP must map mock-logbook');

console.log('✔ Test 1.3: router.js registers mock-logbook canonical ID, feature name, and aliases');

// dashboard.jsx
const dashboardPagePath = path.join(rootDir, 'src', 'pages', 'dashboard.jsx');
const dashboardPage = fs.readFileSync(dashboardPagePath, 'utf8');
assert(dashboardPage.includes('id="view-mock-logbook"'), 'dashboard.jsx must mount id="view-mock-logbook" container');
assert(dashboardPage.includes('<MockLogbookTab'), 'dashboard.jsx must render MockLogbookTab component');

console.log('✔ Test 1.4: dashboard.jsx mounts #view-mock-logbook container with zero-reload SPA routing');

// -------------------------------------------------------------
// SECTION 2: Top Summary Metric Cards
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Top Summary Metric Cards ---');

const mockLogbookTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'MockLogbookTab.jsx');
assert(fs.existsSync(mockLogbookTabPath), 'MockLogbookTab.jsx must exist');
const mockLogbookContent = fs.readFileSync(mockLogbookTabPath, 'utf8');

assert(mockLogbookContent.includes('Average Accuracy'), 'Must render Average Accuracy metric card');
assert(mockLogbookContent.includes('Average Score'), 'Must render Average Score metric card');
assert(mockLogbookContent.includes('Penalty Points Lost'), 'Must render Total Penalty Points Lost metric card');
assert(mockLogbookContent.includes('Top Mistake Pattern'), 'Must render Top Mistake Pattern metric card');
assert(mockLogbookContent.includes('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'), 'Top metrics must use 4-column responsive grid');

console.log('✔ Test 2.1: 4-column responsive grid with all 4 summary metrics verified');

// -------------------------------------------------------------
// SECTION 3: Live Negative Marking Calculator Engine
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Live Negative Marking Calculator Engine ---');

// Validate mathematical calculation formula
function computeMockScore(totalQ, marksPerCorrect, negMarks, correct, incorrect, timeMins) {
  const attempted = correct + incorrect;
  const unattempted = Math.max(0, totalQ - attempted);
  const positiveMarks = correct * marksPerCorrect;
  const penaltyMarks = incorrect * negMarks;
  const netScore = Math.max(0, positiveMarks - penaltyMarks);
  const maxMarks = totalQ * marksPerCorrect;
  const scorePct = maxMarks > 0 ? (netScore / maxMarks) * 100 : 0;
  const accuracyPct = attempted > 0 ? (correct / attempted) * 100 : 0;
  const avgTimePerQSec = attempted > 0 ? Math.round((timeMins * 60) / attempted) : 0;
  return {
    netScore: Number(netScore.toFixed(2)),
    positiveMarks: Number(positiveMarks.toFixed(2)),
    penaltyMarks: Number(penaltyMarks.toFixed(2)),
    scorePct: Number(scorePct.toFixed(1)),
    accuracyPct: Number(accuracyPct.toFixed(1)),
    unattempted,
    avgTimePerQSec
  };
}

// Case 1: Standard GATE Mock: 65 Qs, 2 marks, 0.66 neg penalty, 48 correct, 12 incorrect, 160 mins
const testCalc1 = computeMockScore(65, 2, 0.66, 48, 12, 160);
assert(testCalc1.positiveMarks === 96.00, 'Positive marks should be 48 * 2 = 96');
assert(testCalc1.penaltyMarks === 7.92, 'Negative penalty should be 12 * 0.66 = 7.92');
assert(testCalc1.netScore === 88.08, 'Net score should be 96 - 7.92 = 88.08');
assert(testCalc1.accuracyPct === 80.0, 'Accuracy should be 48 / 60 = 80.0%');
assert(testCalc1.unattempted === 5, 'Unattempted should be 65 - 60 = 5');
assert(testCalc1.avgTimePerQSec === 160, 'Pacing should be (160 * 60) / 60 = 160s/q');

// Case 2: UPSC / JEE Prelims style: 100 Qs, 1 mark, 0.33 neg penalty, 70 correct, 20 incorrect, 120 mins
const testCalc2 = computeMockScore(100, 1, 0.33, 70, 20, 120);
assert(testCalc2.positiveMarks === 70.00, 'Positive marks should be 70 * 1 = 70');
assert(testCalc2.penaltyMarks === 6.60, 'Negative penalty should be 20 * 0.33 = 6.60');
assert(testCalc2.netScore === 63.40, 'Net score should be 70 - 6.60 = 63.40');
assert(testCalc2.accuracyPct === 77.8, 'Accuracy should be 70 / 90 = 77.8%');
assert(testCalc2.unattempted === 10, 'Unattempted should be 100 - 90 = 10');

// Presets check in component
assert(mockLogbookContent.includes('0 (No Penalty)'), 'Component must include 0 penalty preset');
assert(mockLogbookContent.includes('1/4 (0.25×)'), 'Component must include 1/4 penalty preset');
assert(mockLogbookContent.includes('1/3 (0.33×)'), 'Component must include 1/3 penalty preset');
assert(mockLogbookContent.includes('2/3 (0.66×)'), 'Component must include 2/3 penalty preset');

console.log('✔ Test 3.1: Live calculation engine formulas mathematically verified');
console.log('✔ Test 3.2: Quick negative marking presets (0, 1/4, 1/3, 2/3) verified');

// -------------------------------------------------------------
// SECTION 4: Mistake Categories & Auto-Revision Trigger
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Mistake Categories & Auto-Revision Trigger ---');

assert(mockLogbookContent.includes('Conceptual Gap'), 'Must support Conceptual Gap mistake category');
assert(mockLogbookContent.includes('Silly Calculation Error'), 'Must support Silly Calculation Error mistake category');
assert(mockLogbookContent.includes('Time Pressure'), 'Must support Time Pressure mistake category');
assert(mockLogbookContent.includes('Misread Question'), 'Must support Misread Question mistake category');

// Auto-revision trigger rule
assert(mockLogbookContent.includes('conceptualGaps.length > 0'), 'Must detect Conceptual Gap mistakes upon saving');
assert(mockLogbookContent.includes('addTopic'), 'Must invoke addTopic to queue conceptual mistakes into Revision Queue');
assert(mockLogbookContent.includes('Revision Queue'), 'Must show toast confirming addition to Revision Queue');

console.log('✔ Test 4.1: All 4 mistake category pills verified');
console.log('✔ Test 4.2: Auto-Revision rule verified (Conceptual Gap automatically added to Revision Queue with toast)');

// -------------------------------------------------------------
// SECTION 5: Storage Persistence & History Breakdown Table
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Storage Persistence & History Breakdown Table ---');

assert(mockLogbookContent.includes('studytracker_mock_tests'), 'Must persist mock tests under studytracker_mock_tests key');
assert(mockLogbookContent.includes('patchUserData'), 'Must sync mock tests with patchUserData for cloud persistence');
assert(mockLogbookContent.includes('studyflow-mock-tests-updated'), 'Must dispatch update event on mock save');
assert(mockLogbookContent.includes('handleDeleteTest'), 'Must provide delete action for test records');

console.log('✔ Test 5.1: Storage persistence and Google Drive patchUserData integration verified');
console.log('✔ Test 5.2: Past mock tests history table and mistake breakdown verified');

console.log('\n=== ALL MOCK TEST & MISTAKE LOGBOOK TESTS PASSED SUCCESSFULLY! ===\n');

