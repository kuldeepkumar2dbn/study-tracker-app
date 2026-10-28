/**
 * Automated Verification Suite for Study Heatmap & Ambient Audio
 * (tests/test-heatmap-ambient-audio.js)
 *
 * Tests:
 * 1. ConsistencyRadar (Heatmap):
 *    - 90-day matrix generation (13 cols x 7 rows for Mon-Sun)
 *    - Exact color scale mapping (0m, 1-45m, 46-90m, 91-180m, 180m+)
 *    - Tooltip format: "[Day, Month Date]: X hours Y mins studied"
 *    - Header summary formatting: "Active Days: [X] / 90 | Current Streak: [Y] Days"
 *    - Data source tracking in studyflow_${userId}_data.dailyActivity
 * 2. Ambient Audio Engine:
 *    - Pure mathematical noise synthesis (Brown noise, rainfall filter)
 *    - Zero external audio files / zero bandwidth
 *    - Volume adjustment (0% to 100%) and master mute toggle
 *    - 2-second gentle fadeout on pause/finish
 *    - AmbientAudioControls pill options: [Off] [Brown Noise] [Rainfall Filter]
 *    - Integration into Focus Timer (TimerTab.jsx) and Video Modal (SubjectsTab.jsx)
 * 3. Module exports:
 *    - dashboard.js exports ConsistencyRadar and helpers
 *    - timer.js exports TimerTab and ambientAudioEngine
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Setup mock window & browser environment for testing Web Audio & LocalStorage
class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData() {
    return this.data;
  }
}

class MockAudioParam {
  constructor(val = 1) {
    this.value = val;
    this.events = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', val, time });
  }
  cancelScheduledValues(time) {
    this.events.push({ type: 'cancelScheduledValues', time });
  }
}

class MockBiquadFilter {
  constructor() {
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
  }
  connect() {}
  disconnect() {}
}

class MockGainNode {
  constructor() {
    this.gain = new MockAudioParam(1);
  }
  connect() {}
  disconnect() {}
}

class MockBufferSource {
  constructor() {
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
  }
  connect() {}
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 10.0;
    this.state = 'running';
    this.destination = {};
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    return new MockBufferSource();
  }
  createBiquadFilter() {
    return new MockBiquadFilter();
  }
  createGain() {
    return new MockGainNode();
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext
};

// Import utilities
import { 
  formatHeatmapTooltip, 
  getActivityColorClass, 
  calculateHeatmapMatrix,
  generateSeedDailyActivity 
} from '../src/utils/consistencyRadar.js';
import { 
  AmbientAudioEngine, 
  ambientAudioEngine, 
  AMBIENT_SOUND_OPTIONS 
} from '../src/utils/ambientAudio.js';

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

console.log('\n--- STARTING HEATMAP & AMBIENT AUDIO TESTS ---\n');

// ==========================================
// PART 1: GITHUB-STYLE STUDY HEATMAP TESTS
// ==========================================

test('Heatmap: Tooltip format matches "[Day, Month Date]: X hours Y mins studied"', () => {
  // Test 145 mins -> 2 hours 25 mins
  const tooltip145 = formatHeatmapTooltip('2026-10-28', 145);
  assert(tooltip145.includes(': 2 hours 25 mins studied'), `Expected "2 hours 25 mins studied", got: "${tooltip145}"`);
  assert(tooltip145.startsWith('Wed, Oct 28'), `Expected day and month in date prefix, got: "${tooltip145}"`);

  // Test 90 mins -> 1 hours 30 mins
  const tooltip90 = formatHeatmapTooltip('2026-10-27', 90);
  assert(tooltip90.includes(': 1 hours 30 mins studied') || tooltip90.includes('1 hour 30 mins studied'), `Got: "${tooltip90}"`);

  // Test 45 mins -> 45 mins
  const tooltip45 = formatHeatmapTooltip('2026-10-26', 45);
  assert(tooltip45.includes(': 45 mins studied'), `Expected 45 mins studied, got: "${tooltip45}"`);

  // Test 0 mins
  const tooltip0 = formatHeatmapTooltip('2026-10-25', 0);
  assert(tooltip0.includes(': 0 mins studied'), `Expected 0 mins studied, got: "${tooltip0}"`);
});

test('Heatmap: Color scale matches exact required thresholds', () => {
  // 0 mins: slate-800/40
  const c0 = getActivityColorClass(0);
  assert(c0.includes('slate-800/40'), `0 mins should use slate-800/40, got: ${c0}`);

  // 1-45 mins: emerald-900/40
  const c30 = getActivityColorClass(30);
  const c45 = getActivityColorClass(45);
  assert(c30.includes('emerald-900/40'), `30 mins should use emerald-900/40, got: ${c30}`);
  assert(c45.includes('emerald-900/40'), `45 mins should use emerald-900/40, got: ${c45}`);

  // 46-90 mins: emerald-700/60
  const c60 = getActivityColorClass(60);
  const c90 = getActivityColorClass(90);
  assert(c60.includes('emerald-700/60'), `60 mins should use emerald-700/60, got: ${c60}`);
  assert(c90.includes('emerald-700/60'), `90 mins should use emerald-700/60, got: ${c90}`);

  // 91-180 mins: emerald-500
  const c120 = getActivityColorClass(120);
  const c180 = getActivityColorClass(180);
  assert(c120.includes('emerald-500'), `120 mins should use emerald-500, got: ${c120}`);
  assert(c180.includes('emerald-500'), `180 mins should use emerald-500, got: ${c180}`);

  // 180+ mins: emerald-400 with glow accent
  const c200 = getActivityColorClass(200);
  assert(c200.includes('emerald-400'), `200 mins should use emerald-400, got: ${c200}`);
  assert(c200.includes('shadow-') || c200.includes('glow'), `180+ mins should have glow shadow, got: ${c200}`);
});

test('Heatmap: calculateHeatmapMatrix creates 13 columns x 7 rows for Mon-Sun', () => {
  const dailyData = {
    '2026-10-28': 145,
    '2026-10-27': 90,
    '2026-10-26': 45
  };
  const matrix = calculateHeatmapMatrix(dailyData, new Date('2026-10-28T12:00:00Z'));
  assert.strictEqual(matrix.weeks.length, 13, 'Expected 13 columns/weeks');
  for (let i = 0; i < matrix.weeks.length; i++) {
    assert.strictEqual(matrix.weeks[i].length, 7, `Column ${i} must have 7 rows for Mon-Sun`);
    for (let day = 0; day < 7; day++) {
      assert.strictEqual(matrix.weeks[i][day].dayOfWeek, day, `Row ${day} should match dayOfWeek (0=Mon, 6=Sun)`);
    }
  }

  assert(matrix.activeDaysCount >= 3, `Expected at least 3 active days, got ${matrix.activeDaysCount}`);
  assert(matrix.totalMinutes >= 280, `Expected at least 280 total minutes, got ${matrix.totalMinutes}`);
  assert(matrix.currentStreak >= 3, `Expected at least 3 streak days, got ${matrix.currentStreak}`);
});

test('Heatmap: Seed activity generator populates 90 days matching streak', () => {
  const seed = generateSeedDailyActivity(7, 2.5);
  const keys = Object.keys(seed);
  assert.strictEqual(keys.length, 90, `Seed activity must cover 90 days, got ${keys.length}`);

  const todayStr = new Date().toISOString().split('T')[0];
  assert(seed[todayStr] >= 150, `Today should reflect study hours, got ${seed[todayStr]}`);
});

test('Heatmap: ConsistencyRadar component file exists and contains required UI elements', () => {
  const compPath = path.join(rootDir, 'src', 'components', 'ConsistencyRadar.jsx');
  assert(fs.existsSync(compPath), 'ConsistencyRadar.jsx exists');

  const content = fs.readFileSync(compPath, 'utf8');
  assert(content.includes('Consistency Radar'), 'Contains "Consistency Radar" title');
  assert(content.includes('Active Days:'), 'Contains "Active Days:" header summary');
  assert(content.includes('/ 90'), 'Contains "/ 90" summary');
  assert(content.includes('Current Streak:'), 'Contains "Current Streak:" header summary');
  assert(content.includes('grid-rows-7'), 'Contains 7 rows for Mon-Sun');
  assert(content.includes('Less') && content.includes('More'), 'Contains intensity scale legend');
});

test('Heatmap: DashboardTab mounts ConsistencyRadar and DataContext tracks dailyActivity', () => {
  const dashPath = path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert(dashContent.includes('import ConsistencyRadar'), 'DashboardTab imports ConsistencyRadar');
  assert(dashContent.includes('<ConsistencyRadar'), 'DashboardTab renders ConsistencyRadar');
  assert(dashContent.includes('dailyActivity'), 'DashboardTab receives dailyActivity');

  const dataCtxPath = path.join(rootDir, 'src', 'context', 'DataContext.jsx');
  const dataCtxContent = fs.readFileSync(dataCtxPath, 'utf8');
  assert(dataCtxContent.includes('dailyActivity'), 'DataContext manages dailyActivity state');
  assert(dataCtxContent.includes('recordDailyActivity'), 'DataContext exposes recordDailyActivity');
  assert(dataCtxContent.includes('studyflow_${activeUserId}_data') || dataCtxContent.includes('masterKey'), 'DataContext saves to studyflow_${userId}_data');
});

// ==========================================
// PART 2: NATIVE WEB AUDIO AMBIENT SOUND GENERATOR
// ==========================================

test('Ambient Audio: AMBIENT_SOUND_OPTIONS provides [Off] [Brown Noise] [Rainfall Filter]', () => {
  assert.strictEqual(AMBIENT_SOUND_OPTIONS.length, 3);
  const ids = AMBIENT_SOUND_OPTIONS.map(o => o.id);
  assert(ids.includes('off'), 'Contains "off" option');
  assert(ids.includes('brown'), 'Contains "brown" option');
  assert(ids.includes('rainfall'), 'Contains "rainfall" option');

  const labels = AMBIENT_SOUND_OPTIONS.map(o => o.label);
  assert(labels.includes('Off'), 'Contains "Off" label');
  assert(labels.includes('Brown Noise'), 'Contains "Brown Noise" label');
  assert(labels.includes('Rainfall Filter'), 'Contains "Rainfall Filter" label');
});

test('Ambient Audio: Synthesizes Brown Noise mathematically using AudioContext buffer', () => {
  const engine = new AmbientAudioEngine();
  engine.initContext();
  assert(engine.ctx !== null, 'AudioContext initialized');

  const brownBuffer = engine.createNoiseBuffer('brown');
  assert(brownBuffer !== null, 'Brown noise buffer created');
  assert.strictEqual(brownBuffer.length, 4 * 44100, '4-second looping buffer generated');

  const data = brownBuffer.getChannelData(0);
  let nonZeroCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (data[i] !== 0) nonZeroCount++;
  }
  assert(nonZeroCount > 900, 'Brown noise values mathematically synthesized');

  engine.setMode('brown', { fadeIn: false });
  assert.strictEqual(engine.getMode(), 'brown');
  assert(engine.isPlaying(), 'Engine is playing');
  assert.strictEqual(engine.filterNode.type, 'lowpass');
});

test('Ambient Audio: Synthesizes Rainfall Filter mathematically using bandpass and pink noise', () => {
  const engine = new AmbientAudioEngine();
  engine.initContext();

  const rainBuffer = engine.createNoiseBuffer('rainfall');
  assert(rainBuffer !== null, 'Rainfall buffer created');
  const data = rainBuffer.getChannelData(0);
  assert(data.length > 0, 'Rainfall data populated');

  engine.setMode('rainfall', { fadeIn: false });
  assert.strictEqual(engine.getMode(), 'rainfall');
  assert(engine.isPlaying(), 'Engine is playing rainfall filter');
  assert.strictEqual(engine.filterNode.type, 'bandpass', 'Uses resonant bandpass filter for rainfall');
  assert.strictEqual(engine.filterNode2.type, 'lowpass', 'Uses lowpass secondary filter to smooth highs');
});

test('Ambient Audio: Volume slider adjusts gain smoothly from 0% to 100%', () => {
  const engine = new AmbientAudioEngine();
  engine.setMode('brown', { fadeIn: false });

  engine.setVolume(0.5);
  assert.strictEqual(engine.getVolume(), 0.5);

  engine.setVolume(1.0);
  assert.strictEqual(engine.getVolume(), 1.0);

  engine.setVolume(0.0);
  assert.strictEqual(engine.getVolume(), 0.0);
});

test('Ambient Audio: Master mute toggle zeroes gain and restores previous volume', () => {
  const engine = new AmbientAudioEngine();
  engine.setMode('brown', { fadeIn: false });
  engine.setVolume(0.8);

  assert.strictEqual(engine.getMuted(), false);
  engine.toggleMute();
  assert.strictEqual(engine.getMuted(), true);
  assert.strictEqual(engine.isPlaying(), false, 'Mute disables active playing state');

  engine.toggleMute();
  assert.strictEqual(engine.getMuted(), false);
  assert.strictEqual(engine.getVolume(), 0.8, 'Volume preserved after unmute');
  assert.strictEqual(engine.isPlaying(), true, 'Engine resumes playing after unmute');
});

test('Ambient Audio: Fades out gently over 2.0s when timer pauses or finishes', () => {
  const engine = new AmbientAudioEngine();
  engine.setMode('brown', { fadeIn: false });

  const gainParam = engine.gainNode.gain;
  engine.fadeOut(2.0);

  // Check that linear ramp to 0.0001 was scheduled for now + 2.0s
  const rampEvent = gainParam.events.find(e => e.type === 'linearRampToValueAtTime');
  assert(rampEvent !== undefined, 'Scheduled linear ramp to silence');
  assert.strictEqual(rampEvent.val, 0.0001, 'Ramped to near-zero silence');
  assert.strictEqual(rampEvent.time, 12.0, 'Ramp duration is exactly 2 seconds (10.0 + 2.0)');
});

test('Ambient Audio: TimerTab implements 2-second fadeout on pause and completion', () => {
  const timerPath = path.join(rootDir, 'src', 'components', 'tabs', 'TimerTab.jsx');
  const timerContent = fs.readFileSync(timerPath, 'utf8');

  assert(timerContent.includes('ambientAudioEngine.fadeOut(2.0)'), 'TimerTab calls ambientAudioEngine.fadeOut(2.0)');
  assert(timerContent.includes('AmbientAudioControls'), 'TimerTab mounts AmbientAudioControls');
});

test('Ambient Audio: SubjectsTab video modal integrates AmbientAudioControls and 2s fadeout', () => {
  const subjectsPath = path.join(rootDir, 'src', 'components', 'tabs', 'SubjectsTab.jsx');
  const subjectsContent = fs.readFileSync(subjectsPath, 'utf8');

  assert(subjectsContent.includes('AmbientAudioControls'), 'SubjectsTab mounts AmbientAudioControls in modal');
  assert(subjectsContent.includes('ambientAudioEngine.fadeOut(2.0)'), 'SubjectsTab video modal closes with 2s fadeout');
});

// ==========================================
// PART 3: ROOT MODULE EXPORTS & BACKWARD COMPATIBILITY
// ==========================================

test('Root Exports: dashboard.js file structure and exports', () => {
  const dashFile = path.join(rootDir, 'dashboard.js');
  assert(fs.existsSync(dashFile), 'dashboard.js exists in root');
  const content = fs.readFileSync(dashFile, 'utf8');
  assert(content.includes('ConsistencyRadar'), 'dashboard.js exports ConsistencyRadar');
  assert(content.includes('formatHeatmapTooltip'), 'dashboard.js exports formatHeatmapTooltip');
  assert(content.includes('getActivityColorClass'), 'dashboard.js exports getActivityColorClass');
  assert(content.includes('generateSeedDailyActivity'), 'dashboard.js exports generateSeedDailyActivity');
  assert(content.includes('DashboardTab'), 'dashboard.js exports DashboardTab');
});

test('Root Exports: timer.js file structure and exports', () => {
  const timerFile = path.join(rootDir, 'timer.js');
  assert(fs.existsSync(timerFile), 'timer.js exists in root');
  const content = fs.readFileSync(timerFile, 'utf8');
  assert(content.includes('TimerTab'), 'timer.js exports TimerTab');
  assert(content.includes('AmbientAudioControls'), 'timer.js exports AmbientAudioControls');
  assert(content.includes('ambientAudioEngine'), 'timer.js exports ambientAudioEngine');
  assert(content.includes('AMBIENT_SOUND_OPTIONS'), 'timer.js exports AMBIENT_SOUND_OPTIONS');
});

test('Cloud Sync: cloud-sync.js persists and restores dailyActivity', () => {
  const cloudSyncPath = path.join(rootDir, 'cloud-sync.js');
  const content = fs.readFileSync(cloudSyncPath, 'utf8');
  assert(content.includes('data.dailyActivity'), 'cloud-sync.js includes dailyActivity in granular storage');
  assert(content.includes('studyflow_${userId}_daily_activity'), 'cloud-sync.js saves to studyflow_${userId}_daily_activity');
});

console.log(`\n========================================`);
console.log(`ALL ${passedCount} HEATMAP & AMBIENT AUDIO TESTS PASSED!`);
console.log(`========================================\n`);
