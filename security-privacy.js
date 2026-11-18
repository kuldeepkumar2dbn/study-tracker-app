/**
 * Comprehensive Data Security & User Privacy Engine (security-privacy.js)
 * StudyFlow Zero-Backend Privacy-First Architecture
 *
 * Implements:
 * 1. XSS Sanitization (`sanitizeText`, `stripHtmlTags`, `sanitizeObjectStrings`)
 * 2. App PIN Lock (4–6 Digits) with SHA-256 hashing (`studytracker_pin_hash`)
 * 3. Cryptographic User Ownership Token (`userSecret` via `crypto.randomUUID()`)
 * 4. 1-Click Export My Data (`.json` local backup)
 * 5. Authenticated Leaderboard Deletion (`delete_leaderboard_entry`) & Local Storage Wipe
 */

import { TELEMETRY_URL, isTelemetryConfigured } from './admin-config.js';
import { encryptPayload, decryptPayload, getDefaultVaultSecret } from './crypto-vault.js';

export const PIN_HASH_KEY = 'studytracker_pin_hash';
export const PIN_UNLOCKED_KEY = 'studytracker_unlocked';
export const PIN_UNLOCKED_SESSION_KEY = 'studytracker_pin_unlocked';
export const USER_SECRET_KEY = 'studytracker_user_secret';
export const IDLE_AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes
export const IDLE_ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart'];

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

/**
 * Escapes HTML special characters so untrusted user strings can never execute
 * malicious HTML/script tags when inserted into `innerHTML` or templates.
 *
 * @param {any} input
 * @returns {string}
 */
export function sanitizeText(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Strips script/style blocks, HTML tags, and javascript:/vbscript: schemes
 * for safe plain-text storage and React text-node display.
 *
 * @param {any} input
 * @returns {string}
 */
export function stripHtmlTags(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim();
}

/**
 * Validates a 4 to 6 digit numeric PIN.
 * @param {string} pin
 * @returns {{ valid: boolean, cleaned: string, error: string|null }}
 */
export function validatePinFormat(pin) {
  const cleaned = String(pin || '').trim();
  if (!/^\d{4,6}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'PIN must be 4 to 6 numeric digits.'
    };
  }
  return { valid: true, cleaned, error: null };
}

/**
 * Computes a SHA-256 hex digest of a PIN string using Web Crypto API.
 * Falls back to a pure-JS SHA-256 implementation if `crypto.subtle` is unavailable
 * (e.g., insecure non-localhost HTTP contexts).
 *
 * @param {string} pin
 * @returns {Promise<string>} 64-character lowercase hex SHA-256 digest
 */
export async function hashPinSha256(pin) {
  const text = `studyflow_pin_v1:${String(pin || '')}`;

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback pure-JS SHA-256 (RFC 6234) so PIN hashing still works without crypto.subtle
  return fallbackSha256Hex(text);
}

/**
 * Minimal pure-JS SHA-256 fallback (for environments where crypto.subtle is unavailable).
 */
function fallbackSha256Hex(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Constant-time string comparison to prevent timing leaks when checking PIN hashes.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Checks whether an App PIN Lock hash is currently configured in localStorage.
 */
export function hasAppPin() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const hash = localStorage.getItem(PIN_HASH_KEY);
    return Boolean(hash && hash.length >= 32);
  } catch {
    return false;
  }
}

/**
 * Returns true if the app has an active PIN and has not been unlocked in this session.
 */
export function isAppLocked() {
  if (!hasAppPin()) return false;
  if (typeof sessionStorage === 'undefined') return true;
  try {
    return sessionStorage.getItem(PIN_UNLOCKED_KEY) !== 'true';
  } catch {
    return true;
  }
}

/**
 * Sets a 4–6 digit App PIN Lock by storing its SHA-256 hash in `studytracker_pin_hash`.
 */
export async function setAppPin(pin) {
  const check = validatePinFormat(pin);
  if (!check.valid) {
    return { success: false, error: check.error };
  }

  const hash = await hashPinSha256(check.cleaned);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PIN_HASH_KEY, hash);
  }
  // Keep current active session unlocked while setting PIN so the user isn't abruptly kicked out
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(PIN_UNLOCKED_KEY, 'true');
      sessionStorage.setItem(PIN_UNLOCKED_SESSION_KEY, 'true');
    } catch {
      // ignore
    }
  }

  // Activate 15-minute idle auto-lock watcher now that PIN protection is enabled
  startIdleAutoLock();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-pin-changed', {
      detail: { enabled: true, locked: false }
    }));
  }

  return { success: true, hash };
}

/**
 * Verifies a candidate PIN against `studytracker_pin_hash` and unlocks the session on match.
 */
export async function verifyAppPin(pin) {
  if (!hasAppPin()) return true;
  const check = validatePinFormat(pin);
  if (!check.valid) return false;

  const storedHash = localStorage.getItem(PIN_HASH_KEY) || '';
  const candidateHash = await hashPinSha256(check.cleaned);
  const matched = timingSafeEqual(storedHash, candidateHash);

  if (matched) {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(PIN_UNLOCKED_KEY, 'true');
        sessionStorage.setItem(PIN_UNLOCKED_SESSION_KEY, 'true');
      } catch {
        // ignore
      }
    }
    // Start 15-minute idle auto-lock watcher upon unlock
    startIdleAutoLock();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow-pin-changed', {
        detail: { enabled: true, locked: false }
      }));
    }
  }

  return matched;
}

/**
 * Immediately locks the current session (requires PIN re-entry to continue).
 */
export function lockAppNow(reason = 'manual') {
  if (!hasAppPin()) return false;
  stopIdleAutoLock();
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('studytracker_unlocked');
      sessionStorage.removeItem(PIN_UNLOCKED_SESSION_KEY);
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-pin-changed', {
      detail: { enabled: true, locked: true, reason }
    }));
  }
  return true;
}

/**
 * Removes the App PIN Lock hash from localStorage.
 */
export function removeAppPin() {
  stopIdleAutoLock();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(PIN_HASH_KEY);
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem('studytracker_unlocked');
      sessionStorage.removeItem(PIN_UNLOCKED_SESSION_KEY);
    } catch {
      // ignore
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-pin-changed', {
      detail: { enabled: false, locked: false }
    }));
  }
  return { success: true };
}

// =========================================================================
// 15-Minute Idle Auto-Lock Watcher (mousemove, keydown, touchstart)
// =========================================================================
let _idleLockTimerId = null;
let _idleLockTimeoutMs = IDLE_AUTO_LOCK_MS;
let _idleListenersAttached = false;

function _handleUserActivityForIdleLock() {
  if (!hasAppPin() || isAppLocked()) {
    stopIdleAutoLock();
    return;
  }
  resetIdleAutoLockTimer();
}

/**
 * Resets the active 15-minute idle auto-lock countdown.
 */
export function resetIdleAutoLockTimer() {
  if (_idleLockTimerId !== null) {
    clearTimeout(_idleLockTimerId);
    _idleLockTimerId = null;
  }
  if (!hasAppPin() || isAppLocked()) {
    return false;
  }

  _idleLockTimerId = setTimeout(() => {
    _idleLockTimerId = null;
    if (!hasAppPin()) return;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem('studytracker_unlocked');
        sessionStorage.removeItem(PIN_UNLOCKED_SESSION_KEY);
      } catch {
        // ignore
      }
    }
    stopIdleAutoLock();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow-pin-changed', {
        detail: { enabled: true, locked: true, reason: 'idle_timeout' }
      }));
    }
  }, _idleLockTimeoutMs);

  return true;
}

/**
 * Starts the 15-minute idle auto-lock timer listening to `mousemove`, `keydown`, and `touchstart`
 * when SHA-256 App PIN Lock is enabled.
 *
 * @param {number} [timeoutMs=IDLE_AUTO_LOCK_MS]
 * @returns {{ active: boolean, timeoutMs: number }}
 */
export function startIdleAutoLock(timeoutMs = IDLE_AUTO_LOCK_MS) {
  if (!hasAppPin()) {
    stopIdleAutoLock();
    return { active: false, timeoutMs: _idleLockTimeoutMs };
  }

  _idleLockTimeoutMs = Math.max(50, Number(timeoutMs) || IDLE_AUTO_LOCK_MS);

  if (typeof window !== 'undefined' && !_idleListenersAttached) {
    IDLE_ACTIVITY_EVENTS.forEach((evtName) => {
      window.addEventListener(evtName, _handleUserActivityForIdleLock, { passive: true });
    });
    _idleListenersAttached = true;
  }

  resetIdleAutoLockTimer();
  return { active: true, timeoutMs: _idleLockTimeoutMs };
}

/**
 * Stops the idle auto-lock timer and cleans up activity event listeners.
 */
export function stopIdleAutoLock() {
  if (_idleLockTimerId !== null) {
    clearTimeout(_idleLockTimerId);
    _idleLockTimerId = null;
  }
  if (typeof window !== 'undefined' && _idleListenersAttached) {
    IDLE_ACTIVITY_EVENTS.forEach((evtName) => {
      window.removeEventListener(evtName, _handleUserActivityForIdleLock);
    });
    _idleListenersAttached = false;
  }
  return { active: false };
}

/**
 * Returns whether the 15-minute idle auto-lock timer is currently running.
 */
export function isIdleAutoLockRunning() {
  return _idleLockTimerId !== null;
}

/**
 * Generates or retrieves a persistent per-student cryptographic ownership token (`userSecret`)
 * using `crypto.randomUUID()` so Code.gs can reject spoofed Leaderboard updates/deletions.
 */
export function getOrCreateUserSecret() {
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(USER_SECRET_KEY);
      if (existing && existing.trim().length >= 16) {
        return existing.trim();
      }
    } catch {
      // ignore
    }
  }

  let secret = '';
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    secret = globalThis.crypto.randomUUID();
  } else if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    secret = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } else {
    secret = 'sec-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14);
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(USER_SECRET_KEY, secret);
    } catch {
      // ignore
    }
  }

  return secret;
}

/**
 * Collects all local study records from localStorage for 1-click JSON export.
 * Excludes sensitive OAuth bearer tokens and PIN hashes.
 */
export function collectAllLocalStudyData() {
  const excludedKeys = new Set([
    'google_access_token',
    'drive_access_token',
    'gis_access_token',
    PIN_HASH_KEY,
    USER_SECRET_KEY
  ]);

  const records = {};

  if (typeof localStorage !== 'undefined') {
    try {
      const len = typeof localStorage.length === 'number' ? localStorage.length : 0;
      for (let i = 0; i < len; i++) {
        const key = typeof localStorage.key === 'function' ? localStorage.key(i) : null;
        if (!key || excludedKeys.has(key) || key.startsWith('studytracker_vault_')) continue;
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try {
          records[key] = JSON.parse(raw);
        } catch {
          records[key] = raw;
        }
      }
    } catch (err) {
      console.warn('Error collecting local study data:', err);
    }
  }

  return {
    app: 'StudyFlow Study Tracker Pro',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    privacyNote: 'Generated locally in your browser. Age, City, Notes, and Mock Mistakes stay private.',
    records
  };
}

/**
 * Triggers a 1-click `.json` download of all local study records.
 */
export function exportAllStudyDataAsJson() {
  const payload = collectAllLocalStudyData();
  const jsonString = JSON.stringify(payload, null, 2);
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `studyflow-backup-${dateStamp}.json`;

  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { success: true, filename, payload };
}

/**
 * Encrypts all local study data using PBKDF2 + AES-256-GCM and triggers a 1-click
 * `.enc.json` Encrypted Vault Backup download.
 *
 * @param {string} [passphrase=''] - Optional custom passphrase (defaults to device vault secret)
 * @returns {Promise<{ success: boolean, filename: string, envelope: Object }>}
 */
export async function exportEncryptedVaultBackup(passphrase = '') {
  const payload = collectAllLocalStudyData();
  const customPass = String(passphrase || '').trim();
  const secret = customPass || getDefaultVaultSecret();
  const ciphertext = await encryptPayload(payload, secret);

  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `studyflow-vault-backup-${dateStamp}.enc.json`;
  const envelope = {
    app: 'StudyFlow Study Tracker Pro',
    format: 'studyflow-encrypted-vault',
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    keySource: customPass ? 'passphrase' : 'device-vault-key',
    exportedAt: new Date().toISOString(),
    ciphertext
  };

  const jsonString = JSON.stringify(envelope, null, 2);

  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { success: true, filename, envelope };
}

/**
 * Decrypts a previously exported `.enc.json` Encrypted Vault Backup envelope.
 */
export async function decryptEncryptedVaultBackup(envelopeOrJson, passphrase = '') {
  const parsed = typeof envelopeOrJson === 'string' ? JSON.parse(envelopeOrJson) : envelopeOrJson;
  const secret = String(passphrase || '').trim() || getDefaultVaultSecret();
  if (parsed && typeof parsed === 'object' && typeof parsed.ciphertext === 'string') {
    return decryptPayload(parsed.ciphertext, secret);
  }
  return decryptPayload(parsed, secret);
}

/**
 * Sends an authenticated `delete_leaderboard_entry` request (signed with `userSecret`)
 * to remove the student's row from the public Leaderboard sheet, then wipes all local storage.
 *
 * @param {string} [endpoint=TELEMETRY_URL]
 * @param {Object} [options={}]
 * @param {string} [options.studentId]
 * @param {string} [options.userSecret]
 */
export async function deleteLeaderboardDataAndWipeLocal(
  endpoint = TELEMETRY_URL,
  { studentId = null, userSecret = null } = {}
) {
  const targetUrl = endpoint || TELEMETRY_URL;
  const resolvedSecret = userSecret || getOrCreateUserSecret();

  let resolvedStudentId = studentId;
  if (!resolvedStudentId && typeof localStorage !== 'undefined') {
    try {
      const profileRaw = localStorage.getItem('study_user_profile') || localStorage.getItem('user_profile');
      if (profileRaw) {
        const parsed = JSON.parse(profileRaw);
        resolvedStudentId = parsed?.sub || parsed?.email || null;
      }
      if (!resolvedStudentId) {
        resolvedStudentId = localStorage.getItem('study_visitor_id') || null;
      }
    } catch {
      // ignore
    }
  }

  const deletePayload = {
    type: 'delete_leaderboard_entry',
    action: 'delete_leaderboard_entry',
    studentId: resolvedStudentId || 'usr_anonymous',
    userSecret: resolvedSecret,
    requestedAt: new Date().toISOString()
  };

  let requestSent = false;

  if (isTelemetryConfigured(targetUrl) && typeof fetch !== 'undefined') {
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(deletePayload)
      });
      requestSent = true;
    } catch {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(deletePayload)
        });
        requestSent = true;
      } catch (err) {
        console.warn('Leaderboard delete request failed silently:', err);
      }
    }
  }

  // Wipe local & session storage completely
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-data-wiped', {
      detail: { deletedStudentId: deletePayload.studentId, requestSent }
    }));
  }

  return {
    success: true,
    requestSent,
    payload: deletePayload
  };
}

if (typeof window !== 'undefined') {
  window.sanitizeText = sanitizeText;
  window.SecurityPrivacy = {
    PIN_HASH_KEY,
    PIN_UNLOCKED_KEY,
    PIN_UNLOCKED_SESSION_KEY,
    USER_SECRET_KEY,
    IDLE_AUTO_LOCK_MS,
    IDLE_ACTIVITY_EVENTS,
    sanitizeText,
    stripHtmlTags,
    validatePinFormat,
    hashPinSha256,
    hasAppPin,
    isAppLocked,
    setAppPin,
    verifyAppPin,
    lockAppNow,
    removeAppPin,
    startIdleAutoLock,
    stopIdleAutoLock,
    resetIdleAutoLockTimer,
    isIdleAutoLockRunning,
    getOrCreateUserSecret,
    collectAllLocalStudyData,
    exportAllStudyDataAsJson,
    exportEncryptedVaultBackup,
    decryptEncryptedVaultBackup,
    deleteLeaderboardDataAndWipeLocal
  };
}

export default {
  PIN_HASH_KEY,
  PIN_UNLOCKED_KEY,
  PIN_UNLOCKED_SESSION_KEY,
  USER_SECRET_KEY,
  IDLE_AUTO_LOCK_MS,
  IDLE_ACTIVITY_EVENTS,
  sanitizeText,
  stripHtmlTags,
  validatePinFormat,
  hashPinSha256,
  hasAppPin,
  isAppLocked,
  setAppPin,
  verifyAppPin,
  lockAppNow,
  removeAppPin,
  startIdleAutoLock,
  stopIdleAutoLock,
  resetIdleAutoLockTimer,
  isIdleAutoLockRunning,
  getOrCreateUserSecret,
  collectAllLocalStudyData,
  exportAllStudyDataAsJson,
  exportEncryptedVaultBackup,
  decryptEncryptedVaultBackup,
  deleteLeaderboardDataAndWipeLocal
};

