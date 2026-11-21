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
 *    - Rose/red badge "🔴 Sync Error: [reason]  Retry ↻" with interactive retry action on click/Enter/Space.
 *    - Interactive state updates: cursor-pointer, role="button", tabindex="0", and cleanup on success/syncing.
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
assert(
  lbTab.includes('Retry ↻'),
  'LeaderboardTab.jsx must render Retry ↻ button when in error state'
);
assert(
  lbTab.includes('cursor-pointer') && lbTab.includes('hover:bg-rose-500/20') && lbTab.includes('active:scale-95'),
  'LeaderboardTab.jsx must style error badge with cursor-pointer hover:bg-rose-500/20 active:scale-95'
);
console.log('✔ Test 1.2: Badge styling classes & Retry action in LeaderboardTab verified');

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

// Create a DOM mock for #lb-sync-diagnostic-badge
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(...names) {
    names.forEach((n) => n.split(/\s+/).forEach((cls) => cls && this.classes.add(cls)));
  }
  remove(...names) {
    names.forEach((n) => n.split(/\s+/).forEach((cls) => cls && this.classes.delete(cls)));
  }
  contains(name) {
    return this.classes.has(name);
  }
}

class MockElement {
  constructor(id) {
    this.id = id;
    this.innerHTML = '';
    this.attributes = new Map();
    this.classList = new MockClassList();
    this.onclick = null;
    this.onkeydown = null;
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }
  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }
  hasAttribute(k) {
    return this.attributes.has(k);
  }
  removeAttribute(k) {
    this.attributes.delete(k);
  }
}

const mockBadge = new MockElement('lb-sync-diagnostic-badge');
globalThis.document = {
  getElementById: (id) => (id === 'lb-sync-diagnostic-badge' ? mockBadge : null)
};

const lbPath = path.join(rootDir, 'leaderboard.js');
const lbMod = await import(`file://${lbPath.replace(/\\/g, '/')}`);

assert(typeof lbMod.updateLeaderboardDiagnosticBadge === 'function', 'leaderboard.js must export updateLeaderboardDiagnosticBadge');

// 2.1 Syncing State
const syncingRes = lbMod.updateLeaderboardDiagnosticBadge('syncing');
assert(syncingRes.status === 'syncing', 'Syncing state must return status: syncing');
assert(syncingRes.message === 'Syncing Sheet...', 'Syncing message must be "Syncing Sheet..."');
assert(syncingRes.title.includes('Google Apps Script'), 'Syncing title must describe background fetch');
assert(mockBadge.onclick === null, 'Badge must not be clickable during syncing state');
assert(mockBadge.classList.contains('cursor-default'), 'Badge must have cursor-default during syncing state');
console.log('✔ Test 2.1: updateLeaderboardDiagnosticBadge("syncing") returns pulsing amber dot text');

// 2.2 Success State
const successRes = lbMod.updateLeaderboardDiagnosticBadge('success', { count: 18, timestamp: '14:22:10' });
assert(successRes.status === 'success', 'Success state must return status: success');
assert(successRes.message === '🟢 Sheet: 18 students • 14:22:10', `Expected "🟢 Sheet: 18 students • 14:22:10", got "${successRes.message}"`);
assert(successRes.title.includes('18 student rankings'), 'Success title must detail student count');
assert(mockBadge.onclick === null, 'Badge must not be clickable during success state');
assert(!mockBadge.classList.contains('cursor-pointer'), 'Badge must not have cursor-pointer during success state');
console.log('✔ Test 2.2: updateLeaderboardDiagnosticBadge("success") formats exact count and timestamp');

// 2.3 Error State & Interactive Retry Action
const errorRes = lbMod.updateLeaderboardDiagnosticBadge('error', {
  shortReason: 'HTTP 403',
  title: 'Google Apps Script returned HTTP 403 Forbidden'
});
assert(errorRes.status === 'error', 'Error state must return status: error');
assert(errorRes.message.includes('🔴 Sync Error: HTTP 403'), `Message should include "🔴 Sync Error: HTTP 403", got "${errorRes.message}"`);
assert(errorRes.message.includes('Retry ↻'), `Message must include "Retry ↻", got "${errorRes.message}"`);
assert(errorRes.title.includes('HTTP 403 Forbidden'), 'Error title must preserve full error details');

// DOM assertions on error state
assert(mockBadge.classList.contains('cursor-pointer'), 'Error badge must have cursor-pointer class');
assert(mockBadge.classList.contains('hover:bg-rose-500/20'), 'Error badge must have hover:bg-rose-500/20 class');
assert(mockBadge.classList.contains('active:scale-95'), 'Error badge must have active:scale-95 class');
assert(mockBadge.getAttribute('role') === 'button', 'Error badge must have role="button"');
assert(mockBadge.getAttribute('tabindex') === '0', 'Error badge must have tabindex="0"');
assert(typeof mockBadge.onclick === 'function', 'Error badge must have an onclick retry handler');
assert(typeof mockBadge.onkeydown === 'function', 'Error badge must have an onkeydown Enter/Space retry handler');
console.log('✔ Test 2.3: updateLeaderboardDiagnosticBadge("error") styles badge with cursor-pointer, role=button, tabindex=0, and Retry ↻');

// Test object signature: updateLeaderboardDiagnosticBadge({ status: 'error', count, errorMsg })
const objRes = lbMod.updateLeaderboardDiagnosticBadge({
  status: 'error',
  count: 0,
  errorMsg: 'Cloudflare timeout'
});
assert(objRes.status === 'error' && objRes.message.includes('Cloudflare timeout') && objRes.message.includes('Retry ↻'), 'Object signature with errorMsg must be supported');
console.log('✔ Test 2.4: updateLeaderboardDiagnosticBadge({ status, count, errorMsg }) signature verified');

// 2.5 Trigger Retry via onclick
let retryEventDispatched = false;
let retryViewCalled = false;
globalThis.window = {
  dispatchEvent: (event) => {
    if (event.type === 'studyflow-leaderboard-diagnostic-updated') {
      lastDiagnosticEvent = event.detail;
    }
    if (event.type === 'studyflow-leaderboard-retry-requested') {
      retryEventDispatched = true;
    }
  },
  refreshLeaderboardView: () => {
    retryViewCalled = true;
  }
};
let lastDiagnosticEvent = null;

// Re-set error badge with window attached
lbMod.updateLeaderboardDiagnosticBadge('error', { shortReason: 'Connection timed out' });
assert(typeof mockBadge.onclick === 'function', 'Badge has onclick retry handler');

// Simulate click on error badge
mockBadge.onclick();
assert(mockBadge.getAttribute('data-status') === 'loading', 'Clicking Retry must immediately transition badge to "loading"');
assert(mockBadge.innerHTML.includes('Syncing Sheet...'), 'Clicking Retry must display "Syncing Sheet..."');
assert(retryEventDispatched === true, 'Clicking Retry must dispatch studyflow-leaderboard-retry-requested event');
assert(retryViewCalled === true, 'Clicking Retry must invoke window.refreshLeaderboardView()');
assert(mockBadge.onclick === null, 'Transitioning to loading must clear badge.onclick');
assert(mockBadge.classList.contains('cursor-default'), 'Transitioning to loading must restore cursor-default');
console.log('✔ Test 2.5: Clicking Retry immediately transitions badge to "loading" (Syncing Sheet...) and re-triggers sync');

// 2.6 Live fetchLeaderboard integration with mocked responses
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
console.log('✔ Test 2.6: fetchLeaderboard sets green dot with student count and timestamp on valid JSON');

// Test HTML permission error response from Google Apps Script
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => '<!DOCTYPE html><html><head><title>Google Drive - Access Denied</title></head><body>Sign in to Google</body></html>'
});

await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });
assert(lastDiagnosticEvent && lastDiagnosticEvent.status === 'error', 'HTML response must trigger error diagnostic event');
assert(lastDiagnosticEvent.message.includes('HTML permission error'), 'HTML error message must reflect permission error');
assert(lastDiagnosticEvent.message.includes('Retry ↻'), 'HTML error message must include Retry ↻');
assert(lastDiagnosticEvent.title.includes('Google Drive - Access Denied'), 'HTML title attribute must extract HTML title snippet for hover inspection');
console.log('✔ Test 2.7: Google Apps Script HTML error is caught and displayed as red Sync Error badge with Retry ↻');

// Test network failure
globalThis.fetch = async () => {
  throw new Error('Failed to fetch (net::ERR_INTERNET_DISCONNECTED)');
};

await lbMod.fetchLeaderboard(lbMod.TELEMETRY_URL, { mode: 'overall' });
assert(lastDiagnosticEvent && lastDiagnosticEvent.status === 'error', 'Network failure must trigger error diagnostic event');
assert(lastDiagnosticEvent.message.includes('Sync Error'), 'Message must include "Sync Error"');
assert(lastDiagnosticEvent.message.includes('Retry ↻'), 'Network failure must include Retry ↻');
assert(lastDiagnosticEvent.title.includes('net::ERR_INTERNET_DISCONNECTED'), 'Hover title must contain exact network exception details');
console.log('✔ Test 2.8: Network disconnection displays subtle red badge with Retry ↻ button');

// -------------------------------------------------------------
// SECTION 3: CSS Theme Adaptation (Including Onyx & Gold)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: CSS Theme Adaptation & Onyx & Gold ---');

const indexCss = fs.readFileSync(path.join(rootDir, 'src', 'index.css'), 'utf8');

assert(indexCss.includes('#lb-sync-diagnostic-badge'), 'src/index.css must define styles for #lb-sync-diagnostic-badge');
assert(
  indexCss.includes('#lb-sync-diagnostic-badge[data-status="error"]'),
  'src/index.css must define interactive cursor/hover styles for error state'
);
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
assert(
  indexCss.includes('[data-theme="black-gold"] #lb-sync-diagnostic-badge span') ||
  indexCss.includes('html[data-theme="black-gold"] #lb-sync-diagnostic-badge span'),
  'Onyx & Gold must enforce black text (#000000) on inner spans'
);
console.log('✔ Test 3.1: CSS rules verify black text and white borders for Onyx & Gold theme');

console.log('\n=== ALL LEADERBOARD SYNC DIAGNOSTIC BADGE TESTS PASSED! ===\n');
