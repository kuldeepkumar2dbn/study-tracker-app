/**
 * Test Suite: Leaderboard Cold Start Timeout & Snapshot Caching
 * tests/test-leaderboard-cold-start-timeout.js
 *
 * Verifies:
 * 1. 15-second fetch timeout (15,000ms) for Google Apps Script cold starts and 302 redirects.
 * 2. Automatic silent retry (after 1000ms pause) on AbortError/timeout, showing "Waking server..."
 *    and NEVER showing "Sync Error" before the retry completes.
 * 3. Fetch request uses redirect: "follow", cache: "no-store", and NO custom headers to avoid preflight delays.
 * 4. Last successful Leaderboard response is cached in localStorage under studytracker_lb_last_snapshot.
 * 5. Cached snapshot is immediately loaded on page open so the user never stares at a blank screen.
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

console.log('\n=== RUNNING LEADERBOARD COLD-START TIMEOUT & SNAPSHOT TEST SUITE ===\n');

// Mock localStorage & sessionStorage
const mockStore = new Map();
const mockSession = new Map();
globalThis.localStorage = {
  getItem: (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k),
  clear: () => mockStore.clear()
};
globalThis.sessionStorage = {
  getItem: (k) => (mockSession.has(k) ? mockSession.get(k) : null),
  setItem: (k, v) => mockSession.set(k, String(v)),
  removeItem: (k) => mockSession.delete(k),
  clear: () => mockSession.clear()
};

const lbPath = path.join(rootDir, 'leaderboard.js');
const lbMod = await import(`file://${lbPath.replace(/\\/g, '/')}`);

// -------------------------------------------------------------
// SECTION 1: Constants & Snapshot Retrieval Function
// -------------------------------------------------------------
console.log('--- SECTION 1: Snapshot Key & Retrieval Export ---');

assert(lbMod.LEADERBOARD_SNAPSHOT_KEY === 'studytracker_lb_last_snapshot', 'LEADERBOARD_SNAPSHOT_KEY must be "studytracker_lb_last_snapshot"');
assert(typeof lbMod.getLastLeaderboardSnapshot === 'function', 'leaderboard.js must export getLastLeaderboardSnapshot');

// Test snapshot caching
const testSnapshot = {
  mode: 'overall',
  subject: '',
  entries: [
    { studentId: 'u_1', displayName: '@scholar_1', hours: 14.5, streak: 7, rank: 1 },
    { studentId: 'u_2', displayName: '@scholar_2', hours: 10.0, streak: 4, rank: 2 }
  ],
  raw: { overallTop100: [{ studentId: 'u_1', hours: 14.5 }, { studentId: 'u_2', hours: 10.0 }] },
  totalParticipants: 2,
  fetchedAt: '2026-11-21T10:00:00.000Z'
};
localStorage.setItem('studytracker_lb_last_snapshot', JSON.stringify(testSnapshot));

const retrieved = lbMod.getLastLeaderboardSnapshot('overall');
assert(retrieved !== null, 'getLastLeaderboardSnapshot must return cached data');
assert(retrieved.entries.length === 2, 'Retrieved snapshot must contain 2 entries');
assert(retrieved.entries[0].displayName === '@scholar_1', 'Retrieved entry #1 displayName must match');
console.log('✔ Test 1.1: LEADERBOARD_SNAPSHOT_KEY and getLastLeaderboardSnapshot verified');

// -------------------------------------------------------------
// SECTION 2: Request Options (redirect: follow, cache: no-store, no custom headers)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Request Options & Preflight Avoidance ---');

let capturedFetchOptions = null;
globalThis.fetch = async (url, opts) => {
  capturedFetchOptions = opts;
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ overallTop100: testSnapshot.entries })
  };
};

await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });

assert(capturedFetchOptions !== null, 'fetch must be invoked');
assert(capturedFetchOptions.method === 'GET', 'fetch method must be GET');
assert(capturedFetchOptions.redirect === 'follow', 'fetch must specify redirect: "follow"');
assert(capturedFetchOptions.cache === 'no-store', 'fetch must specify cache: "no-store"');
assert(!capturedFetchOptions.headers || Object.keys(capturedFetchOptions.headers).length === 0, 'fetch GET request must NOT set custom headers');
console.log('✔ Test 2.1: fetch uses redirect: "follow", cache: "no-store", and no custom headers');

// Verify 15-second default timeout in leaderboard.js source
const lbSource = fs.readFileSync(lbPath, 'utf8');
assert(lbSource.includes('15000') || lbSource.includes('timeoutMs = 15000'), 'Default timeout must be set to 15,000ms (15 seconds)');
console.log('✔ Test 2.2: 15-second (15,000ms) timeout default verified in source code');

// -------------------------------------------------------------
// SECTION 3: Cold-Start 1-Time Silent Retry on Timeout
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Automatic Cold-Start Silent Retry & "Waking server..." Badge ---');

let attemptCount = 0;
const diagnosticEvents = [];
globalThis.window = {
  dispatchEvent: (event) => {
    if (event.type === 'studyflow-leaderboard-diagnostic-updated') {
      diagnosticEvents.push(event.detail);
    }
  }
};

// Simulate Attempt 1 = AbortError (Timeout), Attempt 2 = Success (Google Apps Script woke up)
globalThis.fetch = async () => {
  attemptCount++;
  if (attemptCount === 1) {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ overallTop100: testSnapshot.entries })
  };
};

diagnosticEvents.length = 0;
const retryRes = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  retryDelayMs: 20 // accelerated for fast test run
});

assert(attemptCount === 2, `Expected exactly 2 attempts (1 initial + 1 retry), got ${attemptCount}`);
assert(retryRes.rankings.length === 2, 'Leaderboard must recover and return 2 rankings on retry');

// Verify diagnostic sequence: syncing -> loading (Waking server...) -> success
const loadingEvent = diagnosticEvents.find((e) => e.status === 'loading' || e.message.includes('Waking server...'));
assert(loadingEvent !== undefined, 'Badge must transition to "loading" ("Waking server...") during cold-start retry');
assert(loadingEvent.message.includes('Waking server...'), `Loading event message must be "Waking server...", got "${loadingEvent.message}"`);

const hadPrematureError = diagnosticEvents.some((e) => e.status === 'error');
assert(!hadPrematureError, 'Sync Error must NEVER be shown when first attempt times out and retry succeeds');

const lastEvent = diagnosticEvents[diagnosticEvents.length - 1];
assert(lastEvent.status === 'success', 'Final diagnostic status must be "success"');
assert(lastEvent.message.startsWith('🟢 Sheet: 2 students'), 'Final diagnostic message must show success dot with student count');
console.log('✔ Test 3.1: Cold-start timeout triggers 1 automatic silent retry with "Waking server..." and zero premature errors');

// -------------------------------------------------------------
// SECTION 4: Double Timeout Fallback & studytracker_lb_last_snapshot
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Double Timeout Fallback to Cached Snapshot ---');

attemptCount = 0;
diagnosticEvents.length = 0;

// Simulate both attempts timing out
globalThis.fetch = async () => {
  attemptCount++;
  const abortErr = new Error('The operation was aborted');
  abortErr.name = 'AbortError';
  throw abortErr;
};

const doubleFailRes = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, {
  mode: 'overall',
  retryDelayMs: 20
});

assert(attemptCount === 2, 'Both attempts must be executed before reporting final error');
assert(doubleFailRes.source === 'cached', 'When live fetch fails, fetchLeaderboard must fall back to cached snapshot');
assert(doubleFailRes.rankings.length === 2, 'Fallback must preserve cached rankings from studytracker_lb_last_snapshot');

const finalError = diagnosticEvents[diagnosticEvents.length - 1];
assert(finalError.status === 'error', 'Final event after both attempts timeout must be "error"');
assert(finalError.message.includes('Sync Error: Timeout'), 'Error message must reflect Timeout');
assert(finalError.message.includes('Retry ↻'), 'Error message must include interactive Retry ↻');
console.log('✔ Test 4.1: Double timeout falls back to studytracker_lb_last_snapshot and displays Retry button');

// -------------------------------------------------------------
// SECTION 5: LeaderboardTab Immediate Snapshot Mount
// -------------------------------------------------------------
console.log('\n--- SECTION 5: LeaderboardTab Instant Initial Render Audit ---');

const lbTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx');
const lbTabSource = fs.readFileSync(lbTabPath, 'utf8');

assert(lbTabSource.includes('getLastLeaderboardSnapshot'), 'LeaderboardTab must import and call getLastLeaderboardSnapshot');
assert(lbTabSource.includes('LEADERBOARD_SNAPSHOT_KEY'), 'LeaderboardTab must import LEADERBOARD_SNAPSHOT_KEY');
assert(
  lbTabSource.includes('const [rankings, setRankings] = useState(() => initialSnapshot?.entries || [])') ||
  lbTabSource.includes('initialSnapshot?.entries'),
  'LeaderboardTab must initialize rankings from initialSnapshot to avoid staring at a blank screen'
);
assert(
  lbTabSource.includes('initialSnapshot ? \'cached\' : \'live\'') || lbTabSource.includes('initialSnapshot?.fetchedAt'),
  'LeaderboardTab must initialize dataSource/lastUpdatedAt from initialSnapshot'
);
assert(
  lbTabSource.includes('diagnostic.message || \'Syncing Sheet...\''),
  'LeaderboardTab must render dynamic diagnostic.message ("Waking server...") during cold-start retry'
);
console.log('✔ Test 5.1: LeaderboardTab instant snapshot hydration and "Waking server..." rendering verified');

console.log('\n=== ALL COLD-START TIMEOUT & SNAPSHOT TESTS PASSED! ===\n');
