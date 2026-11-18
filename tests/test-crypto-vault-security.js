/**
 * Test Suite: AES-256-GCM Crypto Vault, Strict CSP, 15-Min Idle Auto-Lock & Encrypted Backups
 * tests/test-crypto-vault-security.js
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

console.log('\n=== RUNNING AES-256-GCM VAULT, STRICT CSP & IDLE AUTO-LOCK TEST SUITE ===\n');

// Setup simulated browser storage & window event bus
const localMap = new Map();
const sessionMap = new Map();
const windowListeners = new Map();
const dispatchedEvents = [];

globalThis.localStorage = {
  get length() { return localMap.size; },
  key: (i) => Array.from(localMap.keys())[i] ?? null,
  getItem: (k) => (localMap.has(k) ? localMap.get(k) : null),
  setItem: (k, v) => localMap.set(k, String(v)),
  removeItem: (k) => localMap.delete(k),
  clear: () => localMap.clear()
};
globalThis.sessionStorage = {
  get length() { return sessionMap.size; },
  key: (i) => Array.from(sessionMap.keys())[i] ?? null,
  getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
  setItem: (k, v) => sessionMap.set(k, String(v)),
  removeItem: (k) => sessionMap.delete(k),
  clear: () => sessionMap.clear()
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.window = {
  addEventListener: (type, fn) => {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type).add(fn);
  },
  removeEventListener: (type, fn) => {
    windowListeners.get(type)?.delete(fn);
  },
  dispatchEvent: (evt) => {
    dispatchedEvents.push(evt);
    windowListeners.get(evt.type)?.forEach((fn) => fn(evt));
  }
};

let lastFetchPayload = null;
let lastFetchUrl = null;
globalThis.fetch = async (url, init = {}) => {
  lastFetchUrl = String(url);
  if (init.method === 'POST') {
    try { lastFetchPayload = JSON.parse(init.body); } catch { lastFetchPayload = null; }
  }
  return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => JSON.stringify({ success: true }) };
};

const vault = await import(`file://${path.join(rootDir, 'crypto-vault.js').replace(/\\/g, '/')}`);
const sec = await import(`file://${path.join(rootDir, 'security-privacy.js').replace(/\\/g, '/')}`);

// -------------------------------------------------------------
// SECTION 1: Client-Side AES-256-GCM Encryption (crypto-vault.js)
// -------------------------------------------------------------
console.log('--- SECTION 1: Client-Side AES-256-GCM Encryption (crypto-vault.js) ---');

assert(vault.PBKDF2_ITERATIONS >= 100000, 'PBKDF2 iterations must be >= 100,000');
assert(vault.IV_LENGTH_BYTES === 12, 'AES-GCM IV length must be 12 bytes');

const sampleSensitive = {
  username: 'kuldeep_secure',
  age: 22,
  city: 'New Delhi',
  notes: ['Confidential study strategy'],
  mockTests: [{ id: 'm1', title: 'GATE Full Mock #1', mistakes: 'Sign error in Laplace' }]
};
const secret = 'SuperSecretPassphrase#2026';

const ct1 = await vault.encryptPayload(sampleSensitive, secret);
const ct2 = await vault.encryptPayload(sampleSensitive, secret);
assert(typeof ct1 === 'string' && ct1.length > 60, 'encryptPayload must return non-empty Base64 ciphertext');
assert(ct1 !== ct2, 'Random 12-byte IV & salt must produce unique ciphertexts for identical plaintext');
assert(!ct1.includes('kuldeep_secure') && !ct1.includes('Laplace'), 'Ciphertext must not leak plaintext strings');
assert(vault.isEncryptedPayload(ct1) === true, 'isEncryptedPayload must recognize encrypted vault Base64');

const decrypted = await vault.decryptPayload(ct1, secret);
assert(
  decrypted.username === 'kuldeep_secure' &&
  decrypted.age === 22 &&
  decrypted.mockTests[0].mistakes === 'Sign error in Laplace',
  'decryptPayload must accurately restore original object'
);

// Wrong secret must fail GCM auth tag check
let wrongSecretFailed = false;
try {
  await vault.decryptPayload(ct1, 'WrongSecretKey');
} catch {
  wrongSecretFailed = true;
}
assert(wrongSecretFailed === true, 'AES-256-GCM decryption must reject wrong secret');

// Graceful fallback for legacy unencrypted JSON during migration
const legacyJson = JSON.stringify({ username: 'legacy_student', age: 20 });
assert(vault.isEncryptedPayload(legacyJson) === false, 'Legacy JSON must not be misidentified as ciphertext');
const legacyLoaded = await vault.decryptPayload(legacyJson, secret);
assert(legacyLoaded.username === 'legacy_student' && legacyLoaded.age === 20, 'decryptPayload must gracefully fall back to legacy unencrypted JSON');

// Sensitive localStorage keys save & load
await vault.saveEncryptedStorageItem('studytracker_flashcards', [{ q: 'FFT complexity?', a: 'O(N log N)' }], secret);
const rawStoredFlashcards = localStorage.getItem('studytracker_flashcards');
assert(vault.isEncryptedPayload(rawStoredFlashcards) === true, 'saveEncryptedStorageItem must store encrypted ciphertext in localStorage');
const loadedFlashcards = await vault.loadEncryptedStorageItem('studytracker_flashcards', secret);
assert(loadedFlashcards[0].a === 'O(N log N)', 'loadEncryptedStorageItem must decrypt sensitive storage item');

// Cloud sync encryption & decryption + legacy Drive fallback
const syncDoc = {
  userId: 'u_123',
  streak: 9,
  studentProfile: { username: 'kuldeep_secure', age: 22, city: 'Delhi' },
  mockTests: [{ id: 'm1', scorePct: 88 }],
  flashcards: [{ q: 'Nyquist rate', a: '2 * fmax' }],
  notes: [{ id: 'n1', body: 'Private formula sheet' }]
};
const encryptedCloudDoc = await vault.encryptSensitiveFieldsForSync(syncDoc, secret);
assert(encryptedCloudDoc._encryptedVault && encryptedCloudDoc._encryptedVault.algorithm === 'AES-256-GCM', 'Cloud sync doc must wrap sensitive sections in _encryptedVault');
assert(
  encryptedCloudDoc.studentProfile === undefined &&
  encryptedCloudDoc.mockTests === undefined &&
  encryptedCloudDoc.flashcards === undefined &&
  encryptedCloudDoc.notes === undefined,
  'Plaintext sensitive fields must be stripped before Google Drive upload'
);
assert(encryptedCloudDoc.streak === 9, 'Non-sensitive metadata must remain intact');

const restoredCloudDoc = await vault.decryptSensitiveFieldsFromSync(encryptedCloudDoc, secret);
assert(
  restoredCloudDoc.studentProfile.city === 'Delhi' &&
  restoredCloudDoc.mockTests[0].scorePct === 88 &&
  restoredCloudDoc.flashcards[0].a === '2 * fmax' &&
  restoredCloudDoc.notes[0].body === 'Private formula sheet',
  'decryptSensitiveFieldsFromSync must restore all encrypted sensitive sections'
);

const legacyCloudDoc = { userId: 'u_legacy', notes: [{ id: 'n0', body: 'Unencrypted legacy note' }] };
const legacyRestored = await vault.decryptSensitiveFieldsFromSync(legacyCloudDoc, secret);
assert(legacyRestored.notes[0].body === 'Unencrypted legacy note', 'Legacy unencrypted Drive JSON must hydrate gracefully');
console.log('✔ Test 1.1: PBKDF2 + AES-256-GCM encryption, random 12-byte IV, storage & Drive sync encryption, and legacy fallback verified');

// -------------------------------------------------------------
// SECTION 2: Strict Content-Security-Policy (vercel.json)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Strict Content-Security-Policy (vercel.json) ---');

const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8'));
const headerMap = Object.fromEntries((vercelConfig?.headers?.[0]?.headers || []).map((h) => [h.key, h.value]));
assert(headerMap['X-Frame-Options'] === 'DENY', 'vercel.json must enforce X-Frame-Options: DENY');
assert(headerMap['X-Content-Type-Options'] === 'nosniff', 'vercel.json must enforce X-Content-Type-Options: nosniff');

const csp = headerMap['Content-Security-Policy'] || '';
const connectMatch = csp.match(/connect-src\s+([^;]+)/i);
assert(Boolean(connectMatch), 'vercel.json CSP must define connect-src directive');
const connectSources = connectMatch[1].trim().split(/\s+/).sort();
const expectedConnectSources = [
  "'self'",
  'https://accounts.google.com',
  'https://script.google.com',
  'https://script.googleusercontent.com',
  'https://www.googleapis.com'
].sort();
assert(
  JSON.stringify(connectSources) === JSON.stringify(expectedConnectSources),
  `connect-src must strictly equal ${expectedConnectSources.join(' ')}, got: ${connectSources.join(' ')}`
);
console.log('✔ Test 2.1: Strict CSP connect-src whitelist, X-Frame-Options: DENY, and X-Content-Type-Options: nosniff verified');

// -------------------------------------------------------------
// SECTION 3: 15-Minute Idle Auto-Lock (security-privacy.js)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: 15-Minute Idle Auto-Lock (security-privacy.js) ---');

assert(sec.IDLE_AUTO_LOCK_MS === 15 * 60 * 1000, 'Default idle auto-lock timeout must be exactly 15 minutes (900,000ms)');
assert(
  sec.IDLE_ACTIVITY_EVENTS.includes('mousemove') &&
  sec.IDLE_ACTIVITY_EVENTS.includes('keydown') &&
  sec.IDLE_ACTIVITY_EVENTS.includes('touchstart'),
  'Idle auto-lock must monitor mousemove, keydown, and touchstart events'
);

await sec.setAppPin('2468');
assert(sessionStorage.getItem('studytracker_unlocked') === 'true', 'Unlocking / setting PIN must set studytracker_unlocked=true');
assert(sec.isAppLocked() === false, 'App must be unlocked right after setting PIN');

// Test fast idle timeout (80ms) with activity reset and eventual lock
sec.startIdleAutoLock(80);
assert(sec.isIdleAutoLockRunning() === true, 'Idle auto-lock timer must be active');
await new Promise((r) => setTimeout(r, 45));
// Simulate mousemove activity to reset timer
window.dispatchEvent(new CustomEvent('mousemove'));
await new Promise((r) => setTimeout(r, 50));
assert(sec.isAppLocked() === false, 'User mousemove activity must reset the idle timer');

// Wait past 80ms with no activity -> must clear sessionStorage studytracker_unlocked & re-lock
await new Promise((r) => setTimeout(r, 110));
assert(sessionStorage.getItem('studytracker_unlocked') === null, 'Idle auto-lock must clear sessionStorage studytracker_unlocked');
assert(sec.isAppLocked() === true, 'App must be locked after idle timeout expires');
assert(
  dispatchedEvents.some((e) => e.type === 'studyflow-pin-changed' && e.detail?.locked === true && e.detail?.reason === 'idle_timeout'),
  'Idle auto-lock must dispatch studyflow-pin-changed event to re-display PIN lock overlay'
);

sec.removeAppPin();
console.log('✔ Test 3.1: 15-minute idle auto-lock (mousemove/keydown/touchstart reset, studytracker_unlocked removal, overlay re-display) verified');

// -------------------------------------------------------------
// SECTION 4: Encrypted Backup Option (.enc.json) & Delete My Data
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Encrypted Vault Backup (.enc.json) & Delete My Data ---');

localStorage.setItem('studytracker_student_profile', JSON.stringify({ username: 'kuldeep_vault', age: 22 }));
localStorage.setItem('studytracker_mock_tests', JSON.stringify([{ id: 'm9', title: 'Mock #9', accuracyPct: 92 }]));

const encExport = await sec.exportEncryptedVaultBackup('MyBackupPass#99');
assert(encExport.success === true && encExport.filename.endsWith('.enc.json'), 'exportEncryptedVaultBackup must generate .enc.json filename');
assert(encExport.envelope.algorithm === 'AES-256-GCM' && vault.isEncryptedPayload(encExport.envelope.ciphertext), 'Export envelope must hold AES-256-GCM ciphertext');

const restoredBackup = await sec.decryptEncryptedVaultBackup(encExport.envelope, 'MyBackupPass#99');
assert(
  restoredBackup.records.studytracker_student_profile.username === 'kuldeep_vault' &&
  restoredBackup.records.studytracker_mock_tests[0].accuracyPct === 92,
  'Encrypted Vault Backup (.enc.json) must decrypt back to all local study records'
);

// Verify ProfileTab.jsx UI exposes both Encrypted Vault Backup (.enc.json) and standard JSON export + Delete My Data
const profileTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'ProfileTab.jsx'), 'utf8');
assert(
  profileTab.includes('id="export-encrypted-vault-btn"') &&
  profileTab.includes('Encrypted Vault Backup (.enc.json)') &&
  profileTab.includes('id="export-data-json-btn"') &&
  profileTab.includes('1-Click Export My Data (.json)'),
  '#view-profile must offer both Encrypted Vault Backup (.enc.json) and standard JSON export'
);
assert(
  profileTab.includes('id="wipe-local-and-leaderboard-btn"') &&
  profileTab.includes('deleteLeaderboardDataAndWipeLocal(TELEMETRY_URL'),
  '#view-profile Delete My Data button must wipe local storage and send authenticated delete request to TELEMETRY_URL'
);

// Verify deleteLeaderboardDataAndWipeLocal clears localStorage & sends authenticated POST to TELEMETRY_URL
lastFetchPayload = null;
const wipeRes = await sec.deleteLeaderboardDataAndWipeLocal(undefined, { studentId: 'stu_vault_test' });
assert(wipeRes.success === true && wipeRes.requestSent === true, 'Delete My Data must send authenticated delete request');
assert(lastFetchUrl.includes('script.google.com') && lastFetchPayload?.type === 'delete_leaderboard_entry', 'Delete request must hit TELEMETRY_URL with delete_leaderboard_entry');
assert(localStorage.length === 0 && sessionStorage.length === 0, 'Delete My Data must wipe all localStorage and sessionStorage keys');
console.log('✔ Test 4.1: Encrypted Vault Backup (.enc.json), standard JSON export, and authenticated Delete My Data verified');

console.log('\n=== ALL AES-256-GCM VAULT, STRICT CSP & IDLE AUTO-LOCK TESTS PASSED SUCCESSFULLY! ===\n');
