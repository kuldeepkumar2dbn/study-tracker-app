/**
 * Test Suite: Weekly Velocity Benchmark Widget & Monday - Sunday Accumulator
 * (tests/test-weekly-velocity-benchmark.js)
 *
 * Verifies:
 * 1. Monday to Sunday week boundary calculation (distanceToMonday = (now.getDay() + 6) % 7)
 * 2. Inclusion of Saturday and Sunday within the same 7-day accumulator block
 * 3. Immediate reflection of today's 2.5 logged hours via Math.max(dailyActivity[todayStr], todayLoggedHours * 60)
 * 4. Synchronizing userData.dailyActivity[todayStr] with this value
 * 5. Formatting of total hours: (accumulatedMinutes / 60).toFixed(1)
 * 6. Percentage calculation: Math.min(100, Math.round((totalHours / targetHours) * 100))
 * 7. updateWeeklyVelocityBenchmark updates DOM text `${totalWeeklyHours}h / ${targetHours}h (${percent}%)` and bar width
 * 8. dashboard.js exports and event triggers for studyDataUpdated and focusTimerStateChanged
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculateWeeklyVelocityBenchmark,
  updateWeeklyVelocityBenchmark
} from '../src/utils/weeklyVelocity.js';

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

console.log('\n--- STARTING WEEKLY VELOCITY BENCHMARK TESTS ---\n');

test('1. Week boundary: strictly starts on Monday and covers Monday through Sunday (7 days)', () => {
  // Scenario A: Reference date is Saturday, Oct 31, 2026
  const saturday = new Date('2026-10-31T12:00:00Z');
  const resSat = calculateWeeklyVelocityBenchmark({}, 20, saturday);

  assert.strictEqual(resSat.days.length, 7, 'Must produce exactly 7 days');
  assert.strictEqual(resSat.days[0].day, 'Mon', 'First day of week must be Monday');
  assert.strictEqual(resSat.days[0].dateStr, '2026-10-26', 'Monday must be Oct 26, 2026');
  assert.strictEqual(resSat.days[5].day, 'Sat', 'Saturday must be Day index 5');
  assert.strictEqual(resSat.days[5].dateStr, '2026-10-31', 'Saturday must be Oct 31, 2026');
  assert.strictEqual(resSat.days[6].day, 'Sun', 'Last day of week must be Sunday');
  assert.strictEqual(resSat.days[6].dateStr, '2026-11-01', 'Sunday must be Nov 1, 2026');

  // Scenario B: Reference date is Sunday, Nov 1, 2026 (Sunday belongs to the same Monday-Sunday week!)
  const sunday = new Date('2026-11-01T12:00:00Z');
  const resSun = calculateWeeklyVelocityBenchmark({}, 20, sunday);
  assert.strictEqual(resSun.days[0].dateStr, '2026-10-26', 'Sunday must still be in the week starting Monday Oct 26');
  assert.strictEqual(resSun.days[6].dateStr, '2026-11-01', 'Sunday must be day 7 of this week');

  // Scenario C: Reference date is Monday, Oct 26, 2026
  const monday = new Date('2026-10-26T12:00:00Z');
  const resMon = calculateWeeklyVelocityBenchmark({}, 20, monday);
  assert.strictEqual(resMon.days[0].dateStr, '2026-10-26', 'Monday reference must start on that same Monday');
});

test("2. Immediate reflection of today's 2.5 logged study hours into dailyActivity and accumulator", () => {
  const refDate = new Date('2026-10-31T12:00:00Z'); // Saturday
  const todayStr = '2026-10-31';

  // Student has logged 2.5 hours today, but dailyActivity has 0 or is empty
  const userData = {
    todayLoggedHours: 2.5,
    dailyActivity: {
      '2026-10-26': 120, // Monday: 2.0h (120 mins)
      '2026-10-27': 60,  // Tuesday: 1.0h (60 mins)
      '2026-10-31': 0    // Saturday (today): 0 in dailyActivity
    }
  };

  const result = calculateWeeklyVelocityBenchmark(userData, 20, refDate);

  // userData.dailyActivity[todayStr] must be immediately updated with Math.max(0, 150) = 150
  assert.strictEqual(userData.dailyActivity[todayStr], 150, "dailyActivity[todayStr] must sync to 150 minutes");

  // Accumulated minutes: 120 + 60 + 150 = 330 mins = 5.5 hours
  assert.strictEqual(result.accumulatedMinutes, 330, 'Accumulated minutes must be 330');
  assert.strictEqual(result.totalWeeklyHours, '5.5', 'Total weekly hours must be "5.5"');
  assert.strictEqual(result.totalHours, 5.5, 'Total hours numeric must be 5.5');

  // Percentage for 5.5h / 20h = 27.5% -> 28%
  assert.strictEqual(result.percent, 28, 'Percent must be 28% for 5.5h of 20h');
});

test("3. When dailyActivity already has higher minutes, Math.max preserves the larger value", () => {
  const refDate = new Date('2026-10-31T12:00:00Z');
  const todayStr = '2026-10-31';

  const userData = {
    todayLoggedHours: 2.0, // 120 mins
    dailyActivity: {
      '2026-10-31': 180 // 3.0h (180 mins)
    }
  };

  const result = calculateWeeklyVelocityBenchmark(userData, 20, refDate);
  assert.strictEqual(userData.dailyActivity[todayStr], 180, 'Math.max must keep 180 mins');
  assert.strictEqual(result.totalWeeklyHours, '3.0', 'Total weekly hours must be 3.0');
});

test('4. Saturday and Sunday study hours are properly accumulated in the same block', () => {
  const saturday = new Date('2026-10-31T12:00:00Z');

  const userData = {
    todayLoggedHours: 0,
    dailyActivity: {
      '2026-10-26': 120, // Mon: 2.0h
      '2026-10-30': 180, // Fri: 3.0h
      '2026-10-31': 150, // Sat: 2.5h
      '2026-11-01': 90   // Sun: 1.5h
    }
  };

  const result = calculateWeeklyVelocityBenchmark(userData, 20, saturday);

  // Total: 120 + 180 + 150 + 90 = 540 mins = 9.0 hours
  assert.strictEqual(result.accumulatedMinutes, 540, 'Should accumulate 540 minutes');
  assert.strictEqual(result.totalWeeklyHours, '9.0', 'Should equal 9.0 hours');
  // 9.0 / 20 = 45%
  assert.strictEqual(result.percent, 45, 'Should equal 45% of 20h target');
});

test('5. Real-time DOM updater updateWeeklyVelocityBenchmark updates text and progress bar', () => {
  // Mock a DOM environment
  const mockTextElement = { textContent: '' };
  const mockBarElement = { style: { width: '' } };

  global.document = {
    querySelectorAll: (selector) => {
      if (selector.includes('weekly-velocity-text')) {
        return [mockTextElement];
      }
      if (selector.includes('weekly-velocity-bar')) {
        return [mockBarElement];
      }
      return [];
    }
  };

  const userData = {
    todayLoggedHours: 2.5,
    dailyActivity: {}
  };

  const result = updateWeeklyVelocityBenchmark(userData, 20);

  // Text format: `${totalWeeklyHours}h / ${targetHours}h (${percent}%)`
  const expectedText = `${result.totalWeeklyHours}h / 20h (${result.percent}%)`;
  assert.strictEqual(mockTextElement.textContent, expectedText, `Expected text "${expectedText}", got "${mockTextElement.textContent}"`);
  assert.strictEqual(mockBarElement.style.width, `${result.percent}%`, `Expected style.width "${result.percent}%", got "${mockBarElement.style.width}"`);

  // Clean up global mock
  delete global.document;
});

test('6. UI Components & dashboard.js integration', () => {
  // dashboard.js exports WeeklyVelocity and helpers
  const dashPath = path.join(rootDir, 'dashboard.js');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert(dashContent.includes('WeeklyVelocity'), 'dashboard.js exports WeeklyVelocity');
  assert(dashContent.includes('updateWeeklyVelocityBenchmark'), 'dashboard.js exports updateWeeklyVelocityBenchmark');
  assert(dashContent.includes('calculateWeeklyVelocityBenchmark'), 'dashboard.js exports calculateWeeklyVelocityBenchmark');
  assert(dashContent.includes('studyDataUpdated'), 'dashboard.js listens to studyDataUpdated');
  assert(dashContent.includes('focusTimerStateChanged'), 'dashboard.js listens to focusTimerStateChanged');

  // WeeklyVelocity.jsx exists and has required elements
  const compPath = path.join(rootDir, 'src', 'components', 'WeeklyVelocity.jsx');
  assert(fs.existsSync(compPath), 'WeeklyVelocity.jsx exists');
  const compContent = fs.readFileSync(compPath, 'utf8');
  assert(compContent.includes('Weekly Velocity Benchmark'), 'Contains "Weekly Velocity Benchmark" title');
  assert(compContent.includes('Monday – Sunday Accumulator'), 'Contains "Monday – Sunday Accumulator"');
  assert(compContent.includes('weekly-velocity-text'), 'Contains weekly-velocity-text id');
  assert(compContent.includes('weekly-velocity-bar'), 'Contains weekly-velocity-bar id');
  assert(compContent.includes('studyDataUpdated'), 'Listens to studyDataUpdated');
  assert(compContent.includes('focusTimerStateChanged'), 'Listens to focusTimerStateChanged');

  // DailyRoutine.jsx uses WeeklyVelocity
  const routinePath = path.join(rootDir, 'src', 'components', 'DailyRoutine.jsx');
  const routineContent = fs.readFileSync(routinePath, 'utf8');
  assert(routineContent.includes('<WeeklyVelocity'), 'DailyRoutine.jsx renders WeeklyVelocity component');
  assert(routineContent.includes('dailyActivity'), 'DailyRoutine.jsx passes dailyActivity');

  // DataContext dispatches focusTimerStateChanged
  const dataCtxPath = path.join(rootDir, 'src', 'context', 'DataContext.jsx');
  const dataCtxContent = fs.readFileSync(dataCtxPath, 'utf8');
  assert(dataCtxContent.includes('focusTimerStateChanged'), 'DataContext dispatches focusTimerStateChanged');
});

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

