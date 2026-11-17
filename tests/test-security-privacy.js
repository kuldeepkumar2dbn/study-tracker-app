/**
 * Test Suite: Comprehensive Data Security & User Privacy
 * tests/test-security-privacy.js
 *
 * Verifies:
 * 1. XSS Sanitization (`sanitizeText` & `stripHtmlTags`) across Leaderboard, Profile, Mock Tests, Routine, and Syllabus
 * 2. Privacy & Security Panel in #view-profile (SHA-256 App PIN Lock, Privacy Scope Badge, 1-Click JSON Export, Delete & Wipe)
 * 3. User Ownership Token (`userSecret` via `crypto.randomUUID()`) in leaderboard.js & Code.gs anti-spoofing
 * 4. Vercel Security Headers (`vercel.json`: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
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

console.log('\n=== RUNNING SECURITY & USER PRIVACY TEST SUITE ===\n');

// Mock localStorage & sessionStorage in Node
const localMap = new Map();
globalThis.localStorage = {
  get length() { return localMap.size; },
  key: (i) => Array.from(localMap.keys())[i] ?? null,
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};

const sessionMap = new Map();
globalThis.sessionStorage = {
  get length() { return sessionMap.size; },
  key: (i) => Array.from(sessionMap.keys())[i] ?? null,
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
  setItem: (k, v) => sessionMap.set(k, String(v)),
  removeItem: (k) => sessionMap.delete(k),
  clear: () => sessionMap.clear()
};

let lastFetchPayload = null;
globalThis.fetch = async (url, init = {}) => {
  if (init.method === 'POST') {
    lastFetchPayload = JSON.parse(init.body);
  }
  return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) };
};

const secMod = await import(`file://${path.join(rootDir, 'security-privacy.js').replace(/\\/g, '/')}`);
const profileMod = await import(`file://${path.join(rootDir, 'profile.js').replace(/\\/g, '/')}`);
const lbMod = await import(`file://${path.join(rootDir, 'leaderboard.js').replace(/\\/g, '/')}`);
const mockMod = await import(`file://${path.join(rootDir, 'mock-logbook.js').replace(/\\/g, '/')}`);

// -------------------------------------------------------------
// SECTION 1: XSS Sanitization Across All User Inputs
// -------------------------------------------------------------
console.log('--- SECTION 1: XSS Sanitization Across All User Inputs ---');

const xssVector = `<script>alert("xss")</script><img src=x onerror=alert('pwn')>`;
const escaped = secMod.sanitizeText(xssVector);
assert(!escaped.includes('<script>') && !escaped.includes('<img'), 'sanitizeText must escape HTML tags');
assert(escaped.includes('&lt;script&gt;') && escaped.includes('&quot;xss&quot;'), 'sanitizeText must encode angle brackets and quotes');

const stripped = secMod.stripHtmlTags(`<script>evil()</script>Hello <b>World</b>`);
assert(stripped === 'Hello World', 'stripHtmlTags must strip script blocks and HTML tags cleanly');

// Verify Profile bio/name sanitization
const profSave = profileMod.saveStudentProfile({
  username: 'secure_user',
  fullName: '<b>Kuldeep</b><script>alert(1)</script>',
  city: '<img src=x onerror=alert(1)>Delhi',
  bio: '<script>steal()</script>Focused 6h/day'
});
assert(profSave.success === true, 'Profile save must succeed');
assert(!profSave.profile.fullName.includes('<script>') && !profSave.profile.bio.includes('<script>'), 'Profile fields must strip XSS scripts');
assert(profSave.profile.bio === 'Focused 6h/day', 'Bio must retain clean text after stripping script tags');

// Verify Mock Logbook title/subject sanitization
const trend = mockMod.getRecentMockTrend([
  { id: 'm1', title: '<script>x()</script>GATE Mock #1', subject: '<b>Signals</b>', scorePct: 75, accuracyPct: 85 }
]);
assert(trend[0].title === 'GATE Mock #1' && trend[0].subject === 'Signals', 'mock-logbook.js must sanitize mock titles and subjects');

// Verify source files wire sanitizeText / stripHtmlTags for Routine, Syllabus, Mock Tests
const dataCtx = fs.readFileSync(path.join(rootDir, 'src', 'context', 'DataContext.jsx'), 'utf8');
assert(dataCtx.includes('security-privacy.js') && dataCtx.includes('stripHtmlTags'), 'DataContext.jsx must sanitize Routine tasks and Syllabus chapters');
const mockTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'MockLogbookTab.jsx'), 'utf8');
assert(mockTab.includes('security-privacy.js') && mockTab.includes('stripHtmlTags'), 'MockLogbookTab.jsx must sanitize mock titles and mistake notes');
const secUtil = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'security.js'), 'utf8');
assert(secUtil.includes('sanitizeText') && secUtil.includes('stripHtmlTags'), 'src/utils/security.js must integrate sanitizeText & stripHtmlTags');
console.log('✔ Test 1.1: XSS sanitization verified across Leaderboard, Profile, Mock Tests, Routine, and Syllabus');

// -------------------------------------------------------------
// SECTION 2: SHA-256 App PIN Lock & Lock-Screen Overlay
// -------------------------------------------------------------
console.log('\n--- SECTION 2: SHA-256 App PIN Lock & Lock-Screen Overlay ---');

assert((await secMod.setAppPin('12')).success === false, 'PIN < 4 digits must be rejected');
assert((await secMod.setAppPin('1234567')).success === false, 'PIN > 6 digits must be rejected');
assert((await secMod.setAppPin('abcd')).success === false, 'Non-numeric PIN must be rejected');

const pinRes = await secMod.setAppPin('482910');
assert(pinRes.success === true, 'Valid 6-digit PIN must succeed');
const storedHash = localStorage.getItem('studytracker_pin_hash');
assert(storedHash && storedHash.length === 64 && storedHash !== '482910', 'studytracker_pin_hash must store 64-char SHA-256 hex digest, never plaintext');
assert(secMod.hasAppPin() === true, 'hasAppPin() must return true');

// Simulate fresh page load (empty sessionStorage)
sessionStorage.clear();
assert(secMod.isAppLocked() === true, 'Fresh load with PIN configured must be locked');
assert((await secMod.verifyAppPin('000000')) === false, 'Wrong PIN must fail verification');
assert(secMod.isAppLocked() === true, 'App must remain locked after wrong PIN');
assert((await secMod.verifyAppPin('482910')) === true, 'Correct PIN must unlock app');
assert(secMod.isAppLocked() === false, 'App must be unlocked in session after correct PIN');

secMod.removeAppPin();
assert(secMod.hasAppPin() === false && secMod.isAppLocked() === false, 'removeAppPin() must remove PIN hash and unlock app');

const pinOverlayPath = path.join(rootDir, 'src', 'components', 'PinLockOverlay.jsx');
assert(fs.existsSync(pinOverlayPath), 'PinLockOverlay.jsx must exist');
const appShell = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppShell.jsx'), 'utf8');
assert(appShell.includes('<PinLockOverlay />'), 'AppShell.jsx must mount <PinLockOverlay /> on initial load');
console.log('✔ Test 2.1: SHA-256 App PIN Lock (4-6 digits), Lock Overlay, and Remove PIN verified');

// -------------------------------------------------------------
// SECTION 3: Privacy Panel UI, Export JSON & Ownership Token (`userSecret`)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Privacy Panel, JSON Export, userSecret & Delete/Wipe ---');

const profileTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'ProfileTab.jsx'), 'utf8');
assert(profileTab.includes('id="privacy-security-panel"') && profileTab.includes('Privacy &amp; Data Security'), 'ProfileTab.jsx must render Privacy & Data Security card');
assert(profileTab.includes('Age, City, Notes, and Mock Mistakes NEVER leave your private browser/Google Drive'), 'Must display clear privacy scope guarantee badge');
assert(profileTab.includes('id="export-data-json-btn"') && profileTab.includes('1-Click Export My Data (.json)'), 'Must include 1-Click Export My Data (.json) button');
assert(profileTab.includes('id="remove-pin-btn"') && profileTab.includes('Remove PIN'), 'Must include Remove PIN button');
assert(profileTab.includes('id="wipe-local-and-leaderboard-btn"') && profileTab.includes('Delete My Leaderboard Data'), 'Must include Delete My Leaderboard Data & Wipe Local Storage action');

// Ownership token (userSecret)
const secret1 = secMod.getOrCreateUserSecret();
const secret2 = secMod.getOrCreateUserSecret();
assert(secret1 && secret1.length >= 32 && secret1 === secret2, 'getOrCreateUserSecret() must persist a stable UUID ownership token');

// Verify leaderboard_sync includes userSecret
lastFetchPayload = null;
await lbMod.syncStudentToLeaderboard(lbMod.TELEMETRY_URL, {
  studentId: 'stu_owned_1',
  streakData: { streakCount: 5, todayHours: 2.0, weeklyVelocityHours: 10.0 }
});
assert(lastFetchPayload && lastFetchPayload.userSecret === secret1, 'leaderboard_sync payload must include userSecret ownership token');

// Verify Code.gs enforces userSecret on sync & delete_leaderboard_entry
const codeGs = fs.readFileSync(path.join(rootDir, 'Code.gs'), 'utf8');
assert(codeGs.includes('userSecret') && codeGs.includes('storedSecret !== incomingSecret'), 'Code.gs must reject spoofed updates when userSecret mismatches');
assert(codeGs.includes('delete_leaderboard_entry') && codeGs.includes('sheet.deleteRow'), 'Code.gs must support authenticated delete_leaderboard_entry');

// Verify 1-Click JSON Export excludes sensitive secrets/hashes
localStorage.setItem('studytracker_mock_tests', JSON.stringify([{ id: 't1', title: 'Mock 1' }]));
localStorage.setItem('google_access_token', 'SENSITIVE_TOKEN_DO_NOT_EXPORT');
const exported = secMod.collectAllLocalStudyData();
assert(exported.records.studytracker_mock_tests && exported.records.studytracker_mock_tests.length === 1, 'JSON export must include local study records');
assert(!exported.records.google_access_token && !exported.records.studytracker_user_secret && !exported.records.studytracker_pin_hash, 'JSON export must exclude sensitive OAuth tokens, PIN hashes, and userSecret');

// Verify Delete Leaderboard Entry & Wipe Local Storage
lastFetchPayload = null;
const wipeRes = await secMod.deleteLeaderboardDataAndWipeLocal(lbMod.TELEMETRY_URL, { studentId: 'stu_owned_1' });
assert(wipeRes.success === true && wipeRes.requestSent === true, 'deleteLeaderboardDataAndWipeLocal must send delete request');
assert(lastFetchPayload && lastFetchPayload.type === 'delete_leaderboard_entry' && lastFetchPayload.userSecret === secret1 && lastFetchPayload.studentId === 'stu_owned_1', 'Delete request must include type: delete_leaderboard_entry, studentId, and userSecret');
assert(localStorage.length === 0 && sessionStorage.length === 0, 'Wipe must completely clear localStorage and sessionStorage');
console.log('✔ Test 3.1: Privacy Panel, JSON Export, userSecret Anti-Spoofing, and Authenticated Delete+Wipe verified');

// -------------------------------------------------------------
// SECTION 4: Vercel Security Headers (`vercel.json`)
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Vercel Security Headers (vercel.json) ---');

const vercelJsonPath = path.join(rootDir, 'vercel.json');
assert(fs.existsSync(vercelJsonPath), 'vercel.json must exist at project root');
const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
const headersList = vercelConfig?.headers?.[0]?.headers || [];
const headerMap = Object.fromEntries(headersList.map((h) => [h.key, h.value]));

assert(headerMap['X-Frame-Options'] === 'DENY', 'vercel.json must set X-Frame-Options: DENY');
assert(headerMap['X-Content-Type-Options'] === 'nosniff', 'vercel.json must set X-Content-Type-Options: nosniff');
assert(headerMap['Referrer-Policy'] === 'strict-origin-when-cross-origin', 'vercel.json must set Referrer-Policy: strict-origin-when-cross-origin');
assert(
  headerMap['Permissions-Policy'] &&
    headerMap['Permissions-Policy'].includes('camera=()') &&
    headerMap['Permissions-Policy'].includes('microphone=()') &&
    headerMap['Permissions-Policy'].includes('geolocation=()'),
  'vercel.json must set restrictive Permissions-Policy header'
);
assert(
  headerMap['Content-Security-Policy'] && headerMap['Content-Security-Policy'].includes('https://script.google.com'),
  'vercel.json CSP connect-src must permit TELEMETRY_URL (script.google.com)'
);
console.log('✔ Test 4.1: vercel.json security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP) verified');

console.log('\n=== ALL SECURITY & USER PRIVACY TESTS PASSED SUCCESSFULLY! ===\n');

