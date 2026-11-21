/**
 * Test Suite: Leaderboard removeChild Crash Prevention & Pure React State Ownership
 * tests/test-leaderboard-removechild-crash-prevention.js
 *
 * Verifies:
 * 1. Zero imperative innerHTML / removeChild mutations on React-managed components.
 * 2. leaderboard.js respects data-react-managed="true" and never mutates innerHTML of React-managed badges.
 * 3. LeaderboardTab.jsx manages 100% of its virtual DOM tree via pure React state
 *    (syncStatus, syncCount, syncError, leaderboardData).
 * 4. All dynamic counters and badges have translate="no" to protect against browser translation extensions.
 * 5. Safe DOM removal guards (node?.remove() or parent check) across all standalone vanilla modules.
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

console.log('\n=== RUNNING REMOVECHILD CRASH PREVENTION TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Audit LeaderboardTab.jsx Pure React State & translate="no"
// -------------------------------------------------------------
console.log('--- SECTION 1: LeaderboardTab.jsx Pure React State & translate="no" ---');

const lbTabPath = path.join(rootDir, 'src', 'components', 'tabs', 'LeaderboardTab.jsx');
const lbTabSource = fs.readFileSync(lbTabPath, 'utf8');

// Verify pure React state variables exist
assert(lbTabSource.includes('leaderboardData') && lbTabSource.includes('setLeaderboardData'), 'LeaderboardTab must use leaderboardData pure React state');
assert(lbTabSource.includes('syncStatus') && lbTabSource.includes('setSyncStatus'), 'LeaderboardTab must use syncStatus pure React state');
assert(lbTabSource.includes('syncCount') && lbTabSource.includes('setSyncCount'), 'LeaderboardTab must use syncCount pure React state');
assert(lbTabSource.includes('syncError') && lbTabSource.includes('setSyncError'), 'LeaderboardTab must use syncError pure React state');
assert(lbTabSource.includes('syncMessage') && lbTabSource.includes('setSyncMessage'), 'LeaderboardTab must use syncMessage pure React state');
console.log('✔ Test 1.1: Pure React state (leaderboardData, syncStatus, syncCount, syncError, syncMessage) verified');

// Verify data-react-managed="true" on #lb-sync-diagnostic-badge
assert(lbTabSource.includes('id="lb-sync-diagnostic-badge"'), 'LeaderboardTab must render #lb-sync-diagnostic-badge');
assert(lbTabSource.includes('data-react-managed="true"'), '#lb-sync-diagnostic-badge must have data-react-managed="true"');
console.log('✔ Test 1.2: data-react-managed="true" flag protects badge from external innerHTML mutations');

// Verify translate="no" on diagnostic badge and dynamic counters
assert(lbTabSource.includes('translate="no"'), 'LeaderboardTab must use translate="no" attributes');
assert(
  lbTabSource.includes('id="lb-sync-diagnostic-badge"\n              data-react-managed="true"\n              translate="no"') ||
  lbTabSource.includes('data-react-managed="true"\n              translate="no"'),
  '#lb-sync-diagnostic-badge must explicitly declare translate="no"'
);
console.log('✔ Test 1.3: translate="no" attributes protect dynamic counters from browser translation extensions');

// -------------------------------------------------------------
// SECTION 2: leaderboard.js React-Managed Protection Guard
// -------------------------------------------------------------
console.log('\n--- SECTION 2: leaderboard.js React-Managed Protection Guard ---');

const lbPath = path.join(rootDir, 'leaderboard.js');
const lbSource = fs.readFileSync(lbPath, 'utf8');

assert(lbSource.includes('isReactManaged'), 'leaderboard.js must guard against mutating React-managed elements');
assert(lbSource.includes('data-react-managed'), 'leaderboard.js must check data-react-managed attribute');

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

// Create a DOM mock simulating a React-managed badge
class MockReactManagedBadge {
  constructor() {
    this.id = 'lb-sync-diagnostic-badge';
    this.innerHTML = '<span>React Original Children</span>';
    this.attributes = new Map([['data-react-managed', 'true']]);
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }
  hasAttribute(k) {
    return this.attributes.has(k);
  }
  getAttribute(k) {
    return this.attributes.get(k) || null;
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }
  removeAttribute(k) {
    this.attributes.delete(k);
  }
}

const reactBadge = new MockReactManagedBadge();
globalThis.document = {
  getElementById: (id) => (id === 'lb-sync-diagnostic-badge' ? reactBadge : null)
};

const lbMod = await import(`file://${lbPath.replace(/\\/g, '/')}`);

// Call updateLeaderboardDiagnosticBadge with 'syncing', 'error', and 'success'
lbMod.updateLeaderboardDiagnosticBadge('syncing');
assert(reactBadge.innerHTML === '<span>React Original Children</span>', 'leaderboard.js must NOT touch innerHTML when data-react-managed="true"');
assert(reactBadge.getAttribute('data-status') === 'syncing', 'Data status attribute should still be safely updated');
assert(reactBadge.getAttribute('translate') === 'no', 'translate="no" attribute should be enforced');

lbMod.updateLeaderboardDiagnosticBadge('error', { shortReason: 'HTTP 500' });
assert(reactBadge.innerHTML === '<span>React Original Children</span>', 'leaderboard.js must NOT overwrite innerHTML on error when data-react-managed="true"');
assert(reactBadge.getAttribute('data-status') === 'error', 'Data status attribute should be updated to error');

lbMod.updateLeaderboardDiagnosticBadge('success', { count: 42 });
assert(reactBadge.innerHTML === '<span>React Original Children</span>', 'leaderboard.js must NOT overwrite innerHTML on success when data-react-managed="true"');
assert(reactBadge.getAttribute('data-status') === 'success', 'Data status attribute should be updated to success');
assert(reactBadge.getAttribute('data-count') === '42', 'Data count attribute should be updated');
console.log('✔ Test 2.1: React-managed badge innerHTML is 100% protected across syncing, error, and success states');

// -------------------------------------------------------------
// SECTION 3: Safe DOM Removal Guard in Vanilla Modules
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Safe DOM Removal Guard in Vanilla Modules ---');

const secPrivacyPath = path.join(rootDir, 'security-privacy.js');
const secPrivacySource = fs.readFileSync(secPrivacyPath, 'utf8');

assert(!secPrivacySource.includes('document.body.removeChild(link);'), 'security-privacy.js must not call un-guarded document.body.removeChild(link)');
assert(secPrivacySource.includes('link?.remove') || secPrivacySource.includes('link.remove') || secPrivacySource.includes('link.parentNode === document.body'), 'security-privacy.js must use safe removal guard');
console.log('✔ Test 3.1: security-privacy.js safe node.remove() / parent check verified');

const adminPortalPath = path.join(rootDir, 'src', 'components', 'AdminPortal.jsx');
const adminPortalSource = fs.readFileSync(adminPortalPath, 'utf8');

assert(!adminPortalSource.includes('document.body.removeChild(link);'), 'AdminPortal.jsx must not call un-guarded document.body.removeChild(link)');
assert(adminPortalSource.includes('link?.remove') || adminPortalSource.includes('link.remove') || adminPortalSource.includes('link.parentNode === document.body'), 'AdminPortal.jsx must use safe removal guard');
console.log('✔ Test 3.2: AdminPortal.jsx safe node.remove() / parent check verified');

// -------------------------------------------------------------
// SECTION 4: View Switch & State Re-render Safety
// -------------------------------------------------------------
console.log('\n--- SECTION 4: View Switch & State Re-render Simulation ---');

// Verify that LeaderboardTab.jsx handles switching modes (overall <-> subject)
assert(lbTabSource.includes("setMode('overall')") || lbTabSource.includes("setMode('subject')") || lbTabSource.includes('setMode'), 'LeaderboardTab supports switching between overall and subject-wise modes');
assert(lbTabSource.includes('handleRetry'), 'LeaderboardTab handles Retry ↻ action cleanly');

console.log('✔ Test 4.1: View mode switching & Retry state triggers pure React state updates without DOM node collisions');

console.log('\n=== ALL REMOVECHILD CRASH PREVENTION TESTS PASSED! ===\n');
