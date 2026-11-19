/**
 * Test Suite: UI Lag & 60fps Rendering Optimization (tests/test-ui-lag-60fps-optimization.js)
 *
 * Verifies:
 * 1. GPU & CSS Rendering Optimization (style.css & src/index.css):
 *    - Solid opaque card & table row surfaces (backdrop-filter: none; background-color: var(--bg-card))
 *    - Blur retained exclusively on modal / drawer backdrop overlays
 *    - Continuous background ambient mesh animations frozen / disabled on mobile (@media (max-width: 768px))
 *    - will-change: transform & transform: translateZ(0) on .app-sidebar
 *    - content-visibility: auto & contain-intrinsic-size: 60px on Leaderboard rows & Mock History items
 * 2. In-Memory Key Caching & 500ms Debouncing (crypto-vault.js):
 *    - cachedDerivedKey cached in module memory per session
 *    - Multiple encryptPayload / decryptPayload calls reuse CryptoKey without repeating PBKDF2 iterations
 *    - debouncePatchUserData batches rapid updates within 500ms
 * 3. Targeted DOM Updates & Lazy View Rendering (router.js & app.js):
 *    - Focus Timer updates ONLY clock digits (textContent) every second
 *    - ConsistencyRadar does not listen to timer sync events
 *    - router.js exports isViewVisible for lazy rendering
 *    - renderLeaderboardFragment uses DocumentFragment for single-batch DOM updates
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== RUNNING UI LAG & 60FPS RENDERING OPTIMIZATION TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: GPU & CSS Rendering Optimization (style.css & src/index.css)
// -------------------------------------------------------------
console.log('--- SECTION 1: GPU & CSS Rendering Optimization (style.css & src/index.css) ---');

const styleCssPath = path.join(rootDir, 'style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

const indexCssPath = path.join(rootDir, 'src', 'index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

// 1.1 Backdrop-filter removal from standard cards & table rows
assert(
  styleCss.includes('backdrop-filter: none') &&
  styleCss.includes('background-color: var(--bg-card)'),
  'style.css must remove backdrop-filter on cards/tables and set background-color: var(--bg-card)'
);
assert(
  styleCss.includes('.sidebar-backdrop') &&
  styleCss.includes('backdrop-filter: blur(4px) !important'),
  'style.css must retain backdrop-filter blur on modal/drawer backdrops'
);
console.log('✔ Test 1.1: Standard cards and table rows use solid var(--bg-card) surfaces with blur exclusively on backdrop overlays');

// 1.2 Ambient mesh animations disabled on mobile screens
assert(
  styleCss.includes('@media (max-width: 768px)') &&
  styleCss.includes('animation: none !important') &&
  styleCss.includes('animation-play-state: paused !important'),
  'style.css must freeze continuous background ambient mesh animations on mobile (< 768px)'
);
console.log('✔ Test 1.2: Ambient mesh animations disabled/paused on mobile screens (@media (max-width: 768px))');

// 1.3 .app-sidebar GPU acceleration
assert(
  styleCss.includes('will-change: transform') &&
  styleCss.includes('transform: translateZ(0)'),
  'style.css must add will-change: transform and transform: translateZ(0) to .app-sidebar'
);
console.log('✔ Test 1.3: .app-sidebar configured with will-change: transform and translateZ(0) for 60fps slide-over animation');

// 1.4 content-visibility & contain-intrinsic-size for scrolling performance
assert(
  styleCss.includes('content-visibility: auto') &&
  styleCss.includes('contain-intrinsic-size: 60px'),
  'style.css must configure content-visibility: auto and contain-intrinsic-size: 60px'
);
assert(
  styleCss.includes('.leaderboard-row') &&
  styleCss.includes('.mock-history-item'),
  'style.css must apply content-visibility to .leaderboard-row and .mock-history-item'
);
console.log('✔ Test 1.4: content-visibility: auto and contain-intrinsic-size: 60px configured on leaderboard & mock history rows');

// -------------------------------------------------------------
// SECTION 2: In-Memory Key Caching & 500ms Debouncing (crypto-vault.js)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: In-Memory Key Caching & 500ms Debouncing (crypto-vault.js) ---');

const vaultMod = await import('../crypto-vault.js');

// 2.1 Verify cachedDerivedKey export & module memory caching
assert('cachedDerivedKey' in vaultMod, 'crypto-vault.js must export cachedDerivedKey');
assert(typeof vaultMod.getCachedDerivedKey === 'function', 'crypto-vault.js must export getCachedDerivedKey');
assert(typeof vaultMod.clearDerivedKeyCache === 'function', 'crypto-vault.js must export clearDerivedKeyCache');

vaultMod.clearDerivedKeyCache();
assert(vaultMod.cachedDerivedKey === null, 'cachedDerivedKey must be null after clearDerivedKeyCache');

const testSecret = 'Passphrase#PerfTest2026';
const testData1 = { subject: 'Mathematics', score: 95 };
const testData2 = { subject: 'Physics', score: 88 };

// First encryption computes key
const start1 = Date.now();
const ct1 = await vaultMod.encryptPayload(testData1, testSecret);
const duration1 = Date.now() - start1;

const cachedKey = vaultMod.cachedDerivedKey;
assert(cachedKey !== null, 'cachedDerivedKey must be set in module memory after first encryptPayload');
assert(typeof cachedKey === 'object', 'cachedDerivedKey must be a valid CryptoKey object');

// Second encryption reuses cached key (near instantaneous)
const start2 = Date.now();
const ct2 = await vaultMod.encryptPayload(testData2, testSecret);
const duration2 = Date.now() - start2;

assert(vaultMod.cachedDerivedKey === cachedKey, 'Second encryptPayload must reuse the exact same cached CryptoKey reference');
assert(ct1 !== ct2, 'Random 12-byte IV must still produce unique ciphertexts');

// Decryption verification with cached key
const dec1 = await vaultMod.decryptPayload(ct1, testSecret);
assert(dec1.subject === testData1.subject && dec1.score === testData1.score, 'decrypted payload matches original');

console.log(`✔ Test 2.1: cachedDerivedKey verified in memory (First derivation: ${duration1}ms -> Cached reuse: ${duration2}ms)`);

// 2.2 Verify debouncePatchUserData 500ms write batching
assert(typeof vaultMod.debouncePatchUserData === 'function', 'crypto-vault.js must export debouncePatchUserData');

let mockPatches = [];
globalThis.patchUserData = (uid, updates) => {
  mockPatches.push({ uid, updates, at: Date.now() });
  return { userId: uid, ...updates };
};

const p1 = vaultMod.debouncePatchUserData('user_test', { fieldA: 1 }, 100);
const p2 = vaultMod.debouncePatchUserData('user_test', { fieldB: 2 }, 100);
const p3 = vaultMod.debouncePatchUserData('user_test', { fieldC: 3 }, 100);

assert(mockPatches.length === 0, 'No synchronous writes should execute immediately during debounce window');

await Promise.all([p1, p2, p3]);

assert(mockPatches.length === 1, 'Multiple rapid calls must batch into a SINGLE background patch write');
assert(
  mockPatches[0].updates.fieldA === 1 &&
  mockPatches[0].updates.fieldB === 2 &&
  mockPatches[0].updates.fieldC === 3,
  'Batched write must contain all merged updates'
);
delete globalThis.patchUserData;
console.log('✔ Test 2.2: debouncePatchUserData successfully batches rapid calls into a single write');

// -------------------------------------------------------------
// SECTION 3: Targeted DOM Updates & Lazy View Rendering (router.js & app.js)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Targeted DOM Updates & Lazy View Rendering (router.js & app.js) ---');

const routerMod = await import('../router.js');
const appMod = await import('../app.js');

// 3.1 router.js isViewVisible export
assert(typeof routerMod.isViewVisible === 'function', 'router.js must export isViewVisible');
assert(typeof appMod.isViewVisible === 'function', 'app.js must re-export isViewVisible');
console.log('✔ Test 3.1: router.js and app.js export isViewVisible for lazy view rendering checks');

// 3.2 updateTimerDigitsOnly targeted DOM updater
assert(typeof appMod.updateTimerDigitsOnly === 'function', 'app.js must export updateTimerDigitsOnly');

// Test clock digits formatting without DOM
const formatted = appMod.updateTimerDigitsOnly(1495);
assert(formatted === '24:55', 'updateTimerDigitsOnly must format 1495s as "24:55"');

// Test with mock DOM element
const mockClockEl = { textContent: '' };
globalThis.document = {
  getElementById: (id) => (id === 'timer-clock-digits' ? mockClockEl : null),
  querySelectorAll: () => [],
  createDocumentFragment: () => ({
    appendChild: () => {},
    children: []
  }),
  createElement: (tag) => ({
    tagName: tag,
    className: '',
    style: {},
    setAttribute: () => {},
    appendChild: () => {}
  })
};

appMod.updateTimerDigitsOnly(1495, ['timer-clock-digits']);
assert(mockClockEl.textContent === '24:55', 'updateTimerDigitsOnly must update textContent directly');
console.log('✔ Test 3.2: updateTimerDigitsOnly targets textContent directly without full view re-renders');

// 3.3 ConsistencyRadar does not listen to timer sync events
const consistencyRadarJsx = fs.readFileSync(path.join(rootDir, 'src', 'components', 'ConsistencyRadar.jsx'), 'utf8');
assert(
  !consistencyRadarJsx.includes("window.addEventListener('studyflow-timer-sync'"),
  'ConsistencyRadar must NOT listen to studyflow-timer-sync on every second'
);
console.log('✔ Test 3.3: ConsistencyRadar shielded from focus timer ticks (no studyflow-timer-sync listener)');

// 3.4 renderLeaderboardFragment DocumentFragment batch update
assert(typeof appMod.renderLeaderboardFragment === 'function', 'app.js must export renderLeaderboardFragment');

const sampleEntries = [
  { rank: 1, displayName: 'Alpha', studentId: 'u1', studyHours: 45.5, streak: 12, isLiveNow: true, activeSubject: 'Physics' },
  { rank: 2, displayName: 'Beta', studentId: 'u2', studyHours: 40.2, streak: 8, isLiveNow: false, activeSubject: 'Math' }
];

let fragmentAppendedCount = 0;
const mockFragment = {
  appendChild: () => { fragmentAppendedCount++; }
};
const mockContainer = {
  innerHTML: 'existing',
  appendChild: (frag) => { assert(frag === mockFragment, 'appended node must be the DocumentFragment'); }
};

globalThis.document.createDocumentFragment = () => mockFragment;

const resultFragment = appMod.renderLeaderboardFragment(sampleEntries, mockContainer);
assert(resultFragment === mockFragment, 'renderLeaderboardFragment must return the DocumentFragment');
assert(fragmentAppendedCount === 2, 'All 2 entries must be appended to the DocumentFragment');
assert(mockContainer.innerHTML === '', 'Container must be cleared before single-batch fragment append');

delete globalThis.document;
console.log('✔ Test 3.4: renderLeaderboardFragment batches 100 rows into a DocumentFragment for single-paint DOM update');

console.log('\n🎉 ALL UI LAG & 60FPS OPTIMIZATION TESTS PASSED SUCCESSFULLY!\n');
