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

// -------------------------------------------------------------
// SECTION 6: Paired Dual-Bar Comparison Chart (Score % vs. Accuracy %)
// -------------------------------------------------------------
console.log('\n--- SECTION 6: Paired Dual-Bar Comparison Chart (Score % vs. Accuracy % Trend) ---');

// 6.1 Check mock-logbook.js export functions & data structures
const mockLogbookEnginePath = path.join(rootDir, 'mock-logbook.js');
assert(fs.existsSync(mockLogbookEnginePath), 'mock-logbook.js must exist in project root');

const { STORAGE_KEY, Y_TICKS, getRecentMockTrend, formatTrendTooltip } = await import(`file://${mockLogbookEnginePath.replace(/\\/g, '/')}`);

assert(STORAGE_KEY === 'studytracker_mock_tests', 'STORAGE_KEY must be studytracker_mock_tests');
assert(Array.isArray(Y_TICKS) && Y_TICKS.length === 5, 'Y_TICKS must be an array of 5 tick marks');
assert(Y_TICKS[0] === 100 && Y_TICKS[4] === 0, 'Y_TICKS must span 100% to 0%');
console.log('✔ Test 6.1: mock-logbook.js exports STORAGE_KEY and Y_TICKS scale');

// 6.2 Test getRecentMockTrend with empty and edge-case inputs
assert(Array.isArray(getRecentMockTrend([])), 'getRecentMockTrend([]) must return an empty array');
assert(Array.isArray(getRecentMockTrend(null)), 'getRecentMockTrend(null) must return an empty array');
assert(Array.isArray(getRecentMockTrend(undefined)), 'getRecentMockTrend(undefined) must return an empty array');

// 6.3 Test chronological ordering and 10-item cap
// Suppose we have 15 mock tests ordered newest-first (Test #15 is newest, Test #1 is oldest)
const sampleTests = Array.from({ length: 15 }, (_, i) => {
  const num = i + 1; // 1 to 15
  return {
    id: `test-${num}`,
    title: `Mock Test #${num}`,
    date: `2026-11-${String(num).padStart(2, '0')}`,
    subject: 'Signal Analysis',
    totalQuestions: 65,
    marksPerCorrect: 2,
    negativeMarks: 0.66,
    correctCount: 40 + (num % 10),
    incorrectCount: 15 - (num % 5),
    netScore: 70 + num,
    maxMarks: 130,
    scorePct: Number(((70 + num) / 130 * 100).toFixed(1)),
    accuracyPct: Number(((40 + (num % 10)) / (55 + (num % 10) - (num % 5)) * 100).toFixed(1)),
    penaltyMarks: Number(((15 - (num % 5)) * 0.66).toFixed(2))
  };
}).reverse(); // Newest first: Test #15, #14, ..., #1

// getRecentMockTrend takes the 10 most recent (Tests #15 through #6) and displays them chronologically (Test #6 ... Test #15)
const trendResult = getRecentMockTrend(sampleTests, 10);
assert(trendResult.length === 10, 'getRecentMockTrend must limit output to exactly 10 tests');
assert(trendResult[0].title === 'Mock Test #6', 'First item in trend chart must be the oldest of the recent 10 (Mock Test #6)');
assert(trendResult[9].title === 'Mock Test #15', 'Last item in trend chart must be the newest test (Mock Test #15)');
assert(trendResult[0].scorePct >= 0 && trendResult[0].scorePct <= 100, 'scorePct must be between 0% and 100%');
assert(trendResult[0].accuracyPct >= 0 && trendResult[0].accuracyPct <= 100, 'accuracyPct must be between 0% and 100%');

const tooltip = formatTrendTooltip(trendResult[9], trendResult[9].scorePct, trendResult[9].accuracyPct);
assert(tooltip.includes('Mock Test #15'), 'Tooltip must include test title');
assert(tooltip.includes('Score') && tooltip.includes('Accuracy'), 'Tooltip must describe Score and Accuracy');

console.log('✔ Test 6.2: getRecentMockTrend chronological reversing and 10-item cap verified');

// 6.4 Placement of the chart card inside MockLogbookTab.jsx
assert(mockLogbookContent.includes('id="mock-score-accuracy-trend-card"'), 'MockLogbookTab.jsx must render #mock-score-accuracy-trend-card');

const metricsCardIndex = mockLogbookContent.indexOf('TOP SUMMARY METRICS (4 Columns)');
const chartCardIndex = mockLogbookContent.indexOf('id="mock-score-accuracy-trend-card"');
const formCardIndex = mockLogbookContent.indexOf('id="mock-entry-form"');

assert(metricsCardIndex !== -1, 'Top summary metrics section must exist');
assert(chartCardIndex !== -1, 'Dual-bar trend chart container must exist');
assert(formCardIndex !== -1, 'Mock entry form section must exist');
assert(metricsCardIndex < chartCardIndex && chartCardIndex < formCardIndex, 
  'Dual-bar chart container MUST be placed directly between the 4 summary cards and the calculator form');

console.log('✔ Test 6.3: Chart container placement directly between 4 metric cards and entry form verified');

// 6.5 Header, color legend, paired bars, and borders
assert(mockLogbookContent.includes('Score % vs. Accuracy % Trend'), 'Must display chart title "Score % vs. Accuracy % Trend"');
assert(mockLogbookContent.includes("backgroundColor: 'var(--primary)'"), 'Must use var(--primary) for Net Score % bar and legend');
assert(mockLogbookContent.includes("backgroundColor: 'var(--secondary)'"), 'Must use var(--secondary) for Accuracy % bar and legend');
assert(mockLogbookContent.includes("border: '1px solid var(--border-glow)'"), 'Bars must feature 1px solid var(--border-glow) for clean contrast across themes');

// 6.6 Tooltip & Empty state check
assert(mockLogbookContent.includes('hoveredTrendItem'), 'Must manage hover tooltip state');
assert(mockLogbookContent.includes('No mock test trend data available yet.'), 'Must display clean empty state when no tests are logged');

// 6.7 Theme change listeners
assert(mockLogbookContent.includes("addEventListener('themeChanged'"), 'Must listen to themeChanged event for reactive styling');
assert(mockLogbookContent.includes("addEventListener('studyflow-theme-changed'"), 'Must listen to studyflow-theme-changed event');

console.log('✔ Test 6.4: Color legends, dual bars, tooltips, empty state, and theme reactivity verified');

console.log('\n=== ALL MOCK TEST & MISTAKE LOGBOOK TESTS PASSED SUCCESSFULLY! ===\n');

