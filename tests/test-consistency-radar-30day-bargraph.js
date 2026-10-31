/**
 * Test Suite: 30-Day Vertical Bar Graph Consistency Radar
 * Verifies:
 * 1. 30 consecutive calendar days ending on today's current date
 * 2. Y-Axis dynamic scale with minimum ceiling of 4 hours
 * 3. 0-minute baseline styling (bg-slate-800/30) vs >0-minute emerald gradient (bg-gradient-to-t from-emerald-600 to-emerald-400)
 * 4. Tooltip format: "[X.X] Hours ([Y] mins) studied on [Day, Month Date]"
 * 5. Top metrics: Active Days (X / 30), Current Streak, 30-Day Total
 * 6. Live refresh on studyDataUpdated and studyflow-activity-updated
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculate30DayBarGraph,
  formatBarTooltip
} from '../src/utils/consistencyRadar.js';

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

console.log('\n--- STARTING 30-DAY VERTICAL BAR GRAPH CONSISTENCY RADAR TESTS ---\n');

test('1. Tooltip formatting: strictly matches "[X.X] Hours ([Y] mins) studied on [Day, Month Date]"', () => {
  // Test 90 mins (1.5h) on Oct 31, 2026
  const tooltip90 = formatBarTooltip('2026-10-31', 90);
  assert.strictEqual(tooltip90, '1.5 Hours (90 mins) studied on Sat, Oct 31');

  // Test 120 mins (2.0h) on Oct 30, 2026
  const tooltip120 = formatBarTooltip('2026-10-30', 120);
  assert.strictEqual(tooltip120, '2.0 Hours (120 mins) studied on Fri, Oct 30');

  // Test 0 mins (0.0h) on Oct 29, 2026
  const tooltip0 = formatBarTooltip('2026-10-29', 0);
  assert.strictEqual(tooltip0, '0.0 Hours (0 mins) studied on Thu, Oct 29');

  // Test 45 mins (0.8h)
  const tooltip45 = formatBarTooltip('2026-10-28', 45);
  assert.strictEqual(tooltip45, '0.8 Hours (45 mins) studied on Wed, Oct 28');
});

test('2. 30 Consecutive calendar days ending on today (reference date)', () => {
  const refDate = new Date('2026-10-31T12:00:00Z');
  const result = calculate30DayBarGraph({}, refDate);

  assert.strictEqual(result.days.length, 30, 'Must produce exactly 30 consecutive calendar days');
  
  // Last day must be today (Oct 31, 2026)
  const lastDay = result.days[29];
  assert.strictEqual(lastDay.dateStr, '2026-10-31', 'Last day must be reference today');
  assert.strictEqual(lastDay.isToday, true, 'Last day isToday flag must be true');

  // First day must be 29 days prior (Oct 2, 2026)
  const firstDay = result.days[0];
  assert.strictEqual(firstDay.dateStr, '2026-10-02', 'First day must be 29 days before reference today');
  assert.strictEqual(firstDay.isToday, false, 'First day isToday flag must be false');

  // Verify chronological continuity: each subsequent day is exactly +1 day
  for (let i = 0; i < 29; i++) {
    const cur = new Date(result.days[i].dateStr);
    const next = new Date(result.days[i + 1].dateStr);
    const diffMs = next.getTime() - cur.getTime();
    assert.strictEqual(diffMs, 24 * 60 * 60 * 1000, `Day ${i} to ${i+1} must be consecutive 24 hours`);
  }
});

test('3. Dynamic Y-Axis scale ceiling enforces minimum of 4 hours', () => {
  const refDate = new Date('2026-10-31T12:00:00Z');

  // Empty activity -> scale ceiling should be 4h
  const emptyResult = calculate30DayBarGraph({}, refDate);
  assert.strictEqual(emptyResult.scaleCeiling, 4, 'Empty activity must have scale ceiling of 4h');

  // Activity with max 2 hours (120 mins) -> scale ceiling still 4h
  const lowResult = calculate30DayBarGraph({ '2026-10-31': 120 }, refDate);
  assert.strictEqual(lowResult.scaleCeiling, 4, 'Max volume 2h must retain minimum 4h ceiling');

  // Activity with 6.5 hours (390 mins) -> scale ceiling scales dynamically to 7h
  const highResult = calculate30DayBarGraph({ '2026-10-31': 390 }, refDate);
  assert(highResult.scaleCeiling >= 6.5, 'Scale ceiling must dynamically scale above 4h when volume exceeds 4h');
  assert.strictEqual(highResult.scaleCeiling, 7, 'Ceiling scales cleanly to next whole hour (7h)');
});

test('4. Bar height calculation: 0 mins has 0% height (baseline pill), >0 mins scales proportionally', () => {
  const refDate = new Date('2026-10-31T12:00:00Z');
  const activity = {
    '2026-10-31': 120, // 2.0h -> 50% with 4h ceiling
    '2026-10-30': 240, // 4.0h -> 100% with 4h ceiling
    '2026-10-29': 0    // 0h -> 0% (baseline pill)
  };

  const result = calculate30DayBarGraph(activity, refDate);
  const day31 = result.days.find(d => d.dateStr === '2026-10-31');
  const day30 = result.days.find(d => d.dateStr === '2026-10-30');
  const day29 = result.days.find(d => d.dateStr === '2026-10-29');

  assert.strictEqual(day29.heightPercent, 0, '0 min day must have 0% heightPercent');
  assert.strictEqual(day31.heightPercent, 50, '2h day with 4h ceiling must be 50%');
  assert.strictEqual(day30.heightPercent, 100, '4h day with 4h ceiling must be 100%');
});

test('5. Top metrics calculation: Active Days (X / 30) and 30-Day Total Study Hours', () => {
  const refDate = new Date('2026-10-31T12:00:00Z');
  const activity = {
    '2026-10-31': 60,  // 1.0h
    '2026-10-30': 90,  // 1.5h
    '2026-10-29': 150, // 2.5h
    '2026-10-01': 300  // 5.0h, but this is 31 days ago (outside 30-day window!)
  };

  const result = calculate30DayBarGraph(activity, refDate);

  // Active days inside 30-day window: 3 (Oct 31, 30, 29)
  assert.strictEqual(result.activeDaysCount, 3, 'Active days count in last 30 days must be 3');

  // Total minutes inside 30-day window: 60 + 90 + 150 = 300 mins (5.0 hours)
  assert.strictEqual(result.totalMinutes, 300, 'Total minutes in last 30 days must be 300');
  assert.strictEqual(result.totalHoursFormatted, '5.0', 'Total hours formatted must be 5.0h');
});

test('6. ConsistencyRadar JSX component contains all required elements and no 90-day mock stats', () => {
  const compPath = path.join(rootDir, 'src', 'components', 'ConsistencyRadar.jsx');
  const content = fs.readFileSync(compPath, 'utf8');

  // Title and badge
  assert(content.includes('Consistency Radar'), 'Contains "Consistency Radar" title');
  assert(content.includes('30-Day Velocity') || content.includes('30-Day'), 'Contains 30-Day Velocity badge');

  // Metrics strip
  assert(content.includes('/ 30'), 'Contains "Active Days: ... / 30" metric');
  assert(content.includes('Current Streak:'), 'Contains "Current Streak:" metric');
  assert(content.includes('Total:'), 'Contains "Total:" hours metric');

  // No old 90-day mock numbers or grid
  assert(!content.includes('/ 90'), 'Old "/ 90" summary must be removed');
  assert(!content.includes('grid-rows-7'), 'Old 90-day 7-row matrix grid must be removed');
  assert(!content.includes('57/90'), 'Mock stats "57/90" must not exist');
  assert(!content.includes('109.4h'), 'Mock stats "109.4h" must not exist');

  // Bar styling
  assert(content.includes('bg-slate-800/30'), 'Contains low muted baseline pill (bg-slate-800/30)');
  assert(content.includes('bg-gradient-to-t from-emerald-600 to-emerald-400'), 'Contains emerald gradient bar');

  // Live Refresh event listener
  assert(content.includes('studyDataUpdated'), 'Listens to "studyDataUpdated" window event');
  assert(content.includes('studyflow-activity-updated'), 'Listens to "studyflow-activity-updated" window event');
});

test('7. DataContext and dashboard.js exports and event triggers', () => {
  // dashboard.js exports
  const dashPath = path.join(rootDir, 'dashboard.js');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert(dashContent.includes('ConsistencyRadar'), 'dashboard.js exports ConsistencyRadar');
  assert(dashContent.includes('formatBarTooltip'), 'dashboard.js exports formatBarTooltip');
  assert(dashContent.includes('calculate30DayBarGraph'), 'dashboard.js exports calculate30DayBarGraph');

  // DataContext dispatches studyDataUpdated
  const ctxPath = path.join(rootDir, 'src', 'context', 'DataContext.jsx');
  const ctxContent = fs.readFileSync(ctxPath, 'utf8');
  assert(ctxContent.includes('studyDataUpdated'), 'DataContext dispatches studyDataUpdated event');
});

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

