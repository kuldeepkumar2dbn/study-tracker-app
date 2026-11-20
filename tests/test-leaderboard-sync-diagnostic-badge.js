/**
 * Test Suite: Leaderboard Sync Diagnostic Badge (#lb-sync-diagnostic-badge)
 * tests/test-leaderboard-sync-diagnostic-badge.js
 *
 * Verifies:
 * 1. Placement of #lb-sync-diagnostic-badge next to #leaderboard-sync-now-btn in #view-leaderboard header.
 * 2. Low-profile compact pill styling (text-[11px] px-2.5 py-1 rounded-full border border-[var(--border-glow)] bg-[var(--bg-card)]).
 * 3. Live fetch telemetry in leaderboard.js:
 *    - Pulsing amber dot "Syncing Sheet..." before fetch.
 *    - Green dot "🟢 Sheet: [X] students • [HH:MM:SS]" on valid JSON response.
 *    - Rose/red badge "🔴 Sync Error: [reason]" with full text in title on network error, HTTP failure, or HTML permission error.
 * 4. CSS theme compatibility including Onyx & Gold ([data-theme="black-gold"]).
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

console.log('\n=== RUNNING LEADERBOARD SYNC DIAGNOSTIC BADGE TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Diagnostic Badge Placement & DOM Structure
// -------------------------------------------------------------
console.log('--- SECTION 1: Diagnostic Badge Placement in Leaderboard Header ---');

const lbTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx');
const lbTab = fs.readFileSync(lbTabPath, 'utf8');

assert(lbTab.includes('id="lb-sync-diagnostic-badge"'), 'LeaderboardTab.jsx must render #lb-sync-diagnostic-badge');
assert(lbTab.includes('id="leaderboard-sync-now-btn"'), 'LeaderboardTab.jsx must render #leaderboard-sync-now-btn');

const syncBtnIdx = lbTab.indexOf('id="leaderboard-sync-now-btn"');
const badgeIdx = lbTab.indexOf('id="lb-sync-diagnostic-badge"');
assert(syncBtnIdx !== -1 && badgeIdx !== -1, 'Both sync button and diagnostic badge must exist');
assert(badgeIdx > syncBtnIdx, '#lb-sync-diagnostic-badge must sit right next to / after #leaderboard-sync-now-btn');
console.log('✔ Test 1.1: #lb-sync-diagnostic-badge positioned directly next to "🔄 Sync My Hours Now" button');

// Verify pill classes
assert(
  lbTab.includes('text-[11px]') &&
  lbTab.includes('px-2.5') &&
  lbTab.includes('py-1') &&
  lbTab.includes('rounded-full'),
  'Badge must use compact low-profile pill styling (text-[11px] px-2.5 py-1 rounded-full)'
);
assert(
  lbTab.includes('border-[var(--border-glow)]') &&
  lbTab.includes('bg-[var(--bg-card)]'),
  'Badge must reference theme CSS variables var(--border-glow) and var(--bg-card)'
);
console.log('✔ Test 1.2: Badge styling classes (compact pill, border-glow, bg-card) verified');

// -------------------------------------------------------------
// SECTION 2: Runtime Engine Telemetry in leaderboard.js
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Runtime Live Fetch & Error Telemetry in leaderboard.js ---');

// Mock localStorage & sessionStorage in Node
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

assert(typeof lbMod.updateLeaderboardDiagnosticBadge === 'function', 'leaderboard.js must export updateLeaderboardDiagnosticBadge');

// 2.1 Syncing State
const syncingRes = lbMod.updateLeaderboardDiagnosticBadge('syncing');
assert(syncingRes.status === 'syncing', 'Syncing state must return status: syncing');
assert(syncingRes.message === 'Syncing Sheet...', 'Syncing message must be "Syncing Sheet..."');
assert(syncingRes.title.includes('Google Apps Script'), 'Syncing title must describe background fetch');
console.log('✔ Test 2.1: updateLeaderboardDiagnosticBadge("syncing") returns pulsing amber dot text');

// 2.2 Success State
const successRes = lbMod.updateLeaderboardDiagnosticBadge('success', { count: 18, timestamp: '14:22:10' });
assert(successRes.status === 'success', 'Success state must return status: success');
assert(successRes.message === '🟢 Sheet: 18 students • 14:22:10', `Expected "🟢 Sheet: 18 students • 14:22:10", got "${successRes.message}"`);
assert(successRes.title.includes('18 student rankings'), 'Success title must detail student count');
console.log('✔ Test 2.2: updateLeaderboardDiagnosticBadge("success") formats exact count and timestamp');

// 2.3 Error State
const errorRes = lbMod.updateLeaderboardDiagnosticBadge('error', {
  shortReason: 'HTTP 403',
  title: 'Google Apps Script returned HTTP 403 Forbidden'
});
assert(errorRes.status === 'error', 'Error state must return status: error');
assert(errorRes.message === '🔴 Sync Error: HTTP 403', `Expected "🔴 Sync Error: HTTP 403", got "${errorRes.message}"`);
assert(errorRes.title === 'Google Apps Script returned HTTP 403 Forbidden', 'Error title must preserve full error details');
console.log('✔ Test 2.3: updateLeaderboardDiagnosticBadge("error") outputs subtle red badge with full hover title');

// 2.4 Live fetchLeaderboard integration with mocked responses
let lastDiagnosticEvent = null;
globalThis.window = {
  dispatchEvent: (event) => {
    if (event.type === 'studyflow-leaderboard-diagnostic-updated') {
      lastDiagnosticEvent = event.detail;
    }
  }
};

// Test valid JSON fetch
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({
    rankings: [
      { studentId: 'u1', displayName: 'Student 1', weeklyHours: 20 },
      { studentId: 'u2', displayName: 'Student 2', weeklyHours: 15 }
    ]
  })
});

const fetchSuccess = await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });
assert(lastDiagnosticEvent && lastDiagnosticEvent.status === 'success', 'Valid JSON response must trigger success diagnostic event');
assert(lastDiagnosticEvent.count === 2, 'Diagnostic count must match 2 students');
assert(lastDiagnosticEvent.message.startsWith('🟢 Sheet: 2 students •'), 'Message must start with "🟢 Sheet: 2 students •"');
console.log('✔ Test 2.4: fetchLeaderboard sets green dot with student count and timestamp on valid JSON');

// Test HTML permission error response from Google Apps Script
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => '<!DOCTYPE html><html><head><title>Google Drive - Access Denied</title></head><body>Sign in to Google</body></html>'
});

await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });
assert(lastDiagnosticEvent && lastDiagnosticEvent.status === 'error', 'HTML response must trigger error diagnostic event');
assert(lastDiagnosticEvent.message.includes('HTML permission error'), 'HTML error message must reflect permission error');
assert(lastDiagnosticEvent.title.includes('Google Drive - Access Denied'), 'HTML title attribute must extract HTML title snippet for hover inspection');
console.log('✔ Test 2.5: Google Apps Script HTML error is caught and displayed as red Sync Error badge with hover details');

// Test network failure
globalThis.fetch = async () => {
  throw new Error('Failed to fetch (net::ERR_INTERNET_DISCONNECTED)');
};

await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });
assert(lastDiagnosticEvent && lastDiagnosticEvent.status === 'error', 'Network failure must trigger error diagnostic event');
assert(lastDiagnosticEvent.message.includes('Sync Error'), 'Message must include "Sync Error"');
assert(lastDiagnosticEvent.title.includes('net::ERR_INTERNET_DISCONNECTED'), 'Hover title must contain exact network exception details');
console.log('✔ Test 2.6: Network disconnection displays subtle red badge with full error text on hover');

// -------------------------------------------------------------
// SECTION 3: CSS Theme Adaptation (Including Onyx & Gold)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: CSS Theme Adaptation & Onyx & Gold ---');

const indexCss = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf8');

assert(indexCss.includes('#lb-sync-diagnostic-badge'), 'src/index.css must define styles for #lb-sync-diagnostic-badge');
assert(
  indexCss.includes('[data-theme="black-gold"] #lb-sync-diagnostic-badge') ||
  indexCss.includes('html[data-theme="black-gold"] #lb-sync-diagnostic-badge'),
  'src/index.css must define Onyx & Gold overrides for #lb-sync-diagnostic-badge'
);
assert(
  indexCss.includes('border-color: #FFFFFF !important') &&
  indexCss.includes('color: #000000 !important'),
  'Onyx & Gold must style badge with stark black text (#000000) and pure white border (#FFFFFF)'
);
console.log('✔ Test 3.1: CSS rules verify black text and white borders for Onyx & Gold theme');

console.log('\n=== ALL LEADERBOARD SYNC DIAGNOSTIC BADGE TESTS PASSED! ===\n');
