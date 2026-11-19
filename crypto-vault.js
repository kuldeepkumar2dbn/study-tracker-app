/**
 * Client-Side AES-256-GCM Encryption Vault (crypto-vault.js)
 * StudyFlow Zero-Backend Privacy-First Architecture
 *
 * Implements:
 * - Native Web Crypto API PBKDF2 (SHA-256, 100,000 iterations) key derivation
 * - AES-256-GCM authenticated encryption with fresh random 12-byte IV + 16-byte salt
 * - encryptPayload(dataObj, secret) -> Base64 ciphertext
 * - decryptPayload(base64Str, secret) -> decrypted JS object (graceful legacy unencrypted JSON fallback)
 * - Sensitive localStorage & Google Drive sync encryption for profile, mock tests, flashcards & personal notes
 */

export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH_BYTES = 16;
export const IV_LENGTH_BYTES = 12;

export let cachedDerivedKey = null;
export const derivedKeyCache = new Map();
const sessionSaltCache = new Map();

/**
 * Returns the currently active cached PBKDF2-derived CryptoKey from module memory.
 */
export function getCachedDerivedKey() {
  return cachedDerivedKey;
}

/**
 * Clears the session derived key and salt caches (used for tests and user sign-out).
 */
export function clearDerivedKeyCache() {
  cachedDerivedKey = null;
  derivedKeyCache.clear();
  sessionSaltCache.clear();
}

/**
 * Returns or generates a stable session salt for a given secret so subsequent encryptPayload
 * calls reuse the PBKDF2-derived CryptoKey from memory while still generating fresh 12-byte random IVs.
 */
export function getSessionSalt(secret = getDefaultVaultSecret()) {
  const norm = String(secret || '').trim();
  if (!sessionSaltCache.has(norm)) {
    const cryptoApi = getCryptoApi();
    const newSalt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
    sessionSaltCache.set(norm, newSalt);
  }
  return sessionSaltCache.get(norm);
}

const MAGIC_BYTES = [0x53, 0x56, 0x31]; // "SV1" (StudyVault v1)
const HEADER_LENGTH = MAGIC_BYTES.length + SALT_LENGTH_BYTES + IV_LENGTH_BYTES; // 31 bytes

export const SENSITIVE_STORAGE_KEYS = [
  'studytracker_student_profile',
  'studytracker_mock_tests',
  'studytracker_flashcards',
  'studytracker_personal_notes'
];

export const SENSITIVE_SYNC_FIELDS = [
  'studentProfile',
  'mockTests',
  'flashcards',
  'notes'
];

const USER_SECRET_STORAGE_KEY = 'studytracker_user_secret';

function getCryptoApi() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API (crypto.subtle) is unavailable in this environment.');
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64Str) {
  const cleaned = String(base64Str || '').trim();
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(cleaned, 'base64'));
  }
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a secret string and salt using PBKDF2-SHA256.
 * Caches derived keys in module memory (cachedDerivedKey) to eliminate 100,000 PBKDF2 iterations on repeated calls.
 */
async function deriveAes256Key(secret, salt) {
  const cryptoApi = getCryptoApi();
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) {
    throw new Error('Encryption secret is required.');
  }

  const saltKey = bytesToBase64(salt);
  const cacheKey = `${normalizedSecret}:${saltKey}`;

  if (derivedKeyCache.has(cacheKey)) {
    const key = derivedKeyCache.get(cacheKey);
    cachedDerivedKey = key;
    return key;
  }

  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizedSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );

  derivedKeyCache.set(cacheKey, derivedKey);
  cachedDerivedKey = derivedKey;
  return derivedKey;
}

/**
 * Returns or creates the default local vault secret for encrypting sensitive data
 * in localStorage and Google Drive sync payloads.
 */
export function getDefaultVaultSecret(userId = null) {
  let baseSecret = '';
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(USER_SECRET_STORAGE_KEY);
      if (existing && existing.trim().length >= 16) {
        baseSecret = existing.trim();
      } else {
        if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
          baseSecret = globalThis.crypto.randomUUID();
        } else {
          baseSecret = 'vault-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 16);
        }
        localStorage.setItem(USER_SECRET_STORAGE_KEY, baseSecret);
      }
    } catch {
      baseSecret = 'studyflow-ephemeral-vault-key';
    }
  } else {
    baseSecret = 'studyflow-node-vault-key';
  }

  const normalizedUid = userId ? String(userId).trim() : '';
  return normalizedUid ? `${baseSecret}:${normalizedUid}` : baseSecret;
}

/**
 * Checks whether a raw string or wrapped object is an AES-256-GCM vault ciphertext
 * generated by `encryptPayload`.
 */
export function isEncryptedPayload(value) {
  if (!value) return false;

  if (typeof value === 'object' && value.__vault === 'aes-256-gcm-v1' && typeof value.ciphertext === 'string') {
    return isEncryptedPayload(value.ciphertext);
  }

  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }

  // Must be valid Base64 with our SV1 magic header + salt + IV + GCM auth tag (>= 47 bytes)
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return false;
  }

  try {
    const bytes = base64ToBytes(trimmed);
    if (bytes.length < HEADER_LENGTH + 16) return false;
    return (
      bytes[0] === MAGIC_BYTES[0] &&
      bytes[1] === MAGIC_BYTES[1] &&
      bytes[2] === MAGIC_BYTES[2]
    );
  } catch {
    return false;
  }
}

/**
 * Encrypts any JSON-serializable object/value using PBKDF2 + AES-256-GCM with a random 12-byte IV.
 * Reuses the cached session key in memory to eliminate PBKDF2 lag while generating a fresh random IV
 * for each write to maintain cryptographic uniqueness.
 *
 * @param {any} dataObj
 * @param {string} [secret]
 * @returns {Promise<string>} Base64 encoded payload [SV1(3B) | salt(16B) | iv(12B) | ciphertext+tag]
 */
export async function encryptPayload(dataObj, secret = getDefaultVaultSecret()) {
  const cryptoApi = getCryptoApi();
  const salt = getSessionSalt(secret);
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const aesKey = await deriveAes256Key(secret, salt);

  const plaintextBytes = new TextEncoder().encode(JSON.stringify(dataObj));
  const cipherBuffer = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    plaintextBytes
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const packed = new Uint8Array(HEADER_LENGTH + cipherBytes.length);
  packed.set(MAGIC_BYTES, 0);
  packed.set(salt, MAGIC_BYTES.length);
  packed.set(iv, MAGIC_BYTES.length + SALT_LENGTH_BYTES);
  packed.set(cipherBytes, HEADER_LENGTH);

  return bytesToBase64(packed);
}

/**
 * Decrypts a Base64 AES-256-GCM payload created by `encryptPayload`.
 * Gracefully falls back to parsing legacy unencrypted JSON during migration.
 *
 * @param {string|Object} base64Str
 * @param {string} [secret]
 * @returns {Promise<any>}
 */
export async function decryptPayload(base64Str, secret = getDefaultVaultSecret()) {
  if (base64Str === null || base64Str === undefined || base64Str === '') {
    return null;
  }

  // Handle already-parsed plain legacy object or wrapped vault object
  if (typeof base64Str === 'object') {
    if (base64Str.__vault === 'aes-256-gcm-v1' && typeof base64Str.ciphertext === 'string') {
      return decryptPayload(base64Str.ciphertext, secret);
    }
    return base64Str;
  }

  const trimmed = String(base64Str).trim();

  // Graceful fallback for legacy unencrypted JSON strings during migration
  if (!isEncryptedPayload(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid vault payload: neither encrypted AES-256-GCM ciphertext nor valid legacy JSON.');
    }
  }

  const cryptoApi = getCryptoApi();
  const packed = base64ToBytes(trimmed);

  const saltStart = MAGIC_BYTES.length;
  const ivStart = saltStart + SALT_LENGTH_BYTES;
  const salt = packed.slice(saltStart, ivStart);
  const iv = packed.slice(ivStart, HEADER_LENGTH);
  const ciphertext = packed.slice(HEADER_LENGTH);

  const aesKey = await deriveAes256Key(secret, salt);
  const decryptedBuffer = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    ciphertext
  );

  const jsonText = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonText);
}

/**
 * Encrypts and stores a sensitive record directly in localStorage under `key`.
 */
export async function saveEncryptedStorageItem(key, dataObj, secret = getDefaultVaultSecret()) {
  const encrypted = await encryptPayload(dataObj, secret);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, encrypted);
  }
  return encrypted;
}

/**
 * Loads and decrypts a sensitive record from localStorage with graceful fallback
 * if legacy unencrypted JSON is stored under `key`.
 */
export async function loadEncryptedStorageItem(key, secret = getDefaultVaultSecret(), fallback = null) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return await decryptPayload(raw, secret);
  } catch (err) {
    console.warn(`Could not decrypt storage item "${key}":`, err);
    return fallback;
  }
}

/**
 * Persists an AES-256-GCM encrypted vault copy (`studytracker_vault_${key}`) alongside
 * synchronous legacy storage keys so sensitive records remain encrypted at rest.
 */
export async function syncEncryptedVaultMirror(key, dataObj, secret = getDefaultVaultSecret()) {
  if (typeof localStorage === 'undefined' || !key) return null;
  try {
    const encrypted = await encryptPayload(dataObj, secret);
    localStorage.setItem(`studytracker_vault_${key}`, encrypted);
    return encrypted;
  } catch (err) {
    console.warn(`Non-fatal encrypted vault mirror warning for "${key}":`, err);
    return null;
  }
}

/**
 * Encrypts sensitive personal sections (`studentProfile`, `mockTests`, `flashcards`, `notes`)
 * into a single AES-256-GCM `_encryptedVault` envelope before uploading to Google Drive,
 * stripping plaintext copies of those sensitive fields from the cloud payload.
 */
export async function encryptSensitiveFieldsForSync(userData = {}, secret = getDefaultVaultSecret()) {
  if (!userData || typeof userData !== 'object') return userData;

  const sensitiveBundle = {};
  let hasSensitiveData = false;

  for (const field of SENSITIVE_SYNC_FIELDS) {
    if (userData[field] !== undefined) {
      sensitiveBundle[field] = userData[field];
      hasSensitiveData = true;
    }
  }

  if (!hasSensitiveData) {
    return { ...userData };
  }

  const ciphertext = await encryptPayload(sensitiveBundle, secret);
  const sanitizedCloudPayload = { ...userData };
  for (const field of SENSITIVE_SYNC_FIELDS) {
    delete sanitizedCloudPayload[field];
  }

  sanitizedCloudPayload._encryptedVault = {
    version: VAULT_VERSION,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    fields: Object.keys(sensitiveBundle),
    payload: ciphertext,
    encryptedAt: new Date().toISOString()
  };

  return sanitizedCloudPayload;
}

/**
 * Decrypts `_encryptedVault` inside a downloaded Google Drive sync document back into
 * usable `studentProfile`, `mockTests`, `flashcards`, and `notes` fields.
 * Gracefully returns legacy unencrypted Drive JSON as-is if `_encryptedVault` is absent.
 */
export async function decryptSensitiveFieldsFromSync(cloudData = {}, secret = getDefaultVaultSecret()) {
  if (!cloudData || typeof cloudData !== 'object') return cloudData;

  const vault = cloudData._encryptedVault;
  if (!vault || typeof vault.payload !== 'string') {
    // Graceful legacy unencrypted Drive document fallback
    return cloudData;
  }

  try {
    const decryptedBundle = await decryptPayload(vault.payload, secret);
    const hydrated = { ...cloudData };
    delete hydrated._encryptedVault;

    if (decryptedBundle && typeof decryptedBundle === 'object') {
      for (const field of SENSITIVE_SYNC_FIELDS) {
        if (decryptedBundle[field] !== undefined) {
          hydrated[field] = decryptedBundle[field];
        }
      }
    }
    return hydrated;
  } catch (err) {
    console.warn('Could not decrypt _encryptedVault from cloud sync (falling back to available fields):', err);
    return cloudData;
  }
}

/**
 * Migrates any legacy unencrypted sensitive localStorage keys into encrypted vault mirrors
 * on initial app load without breaking synchronous legacy readers.
 */
export async function migrateSensitiveLocalStorageToVault(secret = getDefaultVaultSecret()) {
  if (typeof localStorage === 'undefined') return { migrated: [] };
  const migrated = [];

  for (const key of SENSITIVE_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      if (isEncryptedPayload(raw)) continue;

      const parsed = JSON.parse(raw);
      await syncEncryptedVaultMirror(key, parsed, secret);
      migrated.push(key);
    } catch {
      // Ignore malformed legacy entries
    }
  }

  return { migrated };
}

let _pendingBatchedPatchUpdates = {};
let _batchPatchTimer = null;
let _batchPatchResolvers = [];

/**
 * Debounces localStorage + Google Drive patchUserData writes by 500ms
 * so rapid clicks (like logging tasks or adjusting sliders) batch into a single background write.
 *
 * @param {string} userId
 * @param {Object} updates
 * @param {number} [delay=500]
 * @returns {Promise<Object>}
 */
export function debouncePatchUserData(userId, updates = {}, delay = 500) {
  _pendingBatchedPatchUpdates = { ..._pendingBatchedPatchUpdates, ...updates };

  return new Promise((resolve) => {
    _batchPatchResolvers.push(resolve);

    if (_batchPatchTimer) {
      clearTimeout(_batchPatchTimer);
    }

    _batchPatchTimer = setTimeout(async () => {
      const mergedUpdates = { ..._pendingBatchedPatchUpdates };
      _pendingBatchedPatchUpdates = {};
      const currentResolvers = [..._batchPatchResolvers];
      _batchPatchResolvers = [];

      let result = null;
      try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.patchUserData === 'function') {
          result = globalThis.patchUserData(userId, mergedUpdates);
        } else if (typeof window !== 'undefined' && typeof window.patchUserData === 'function') {
          result = window.patchUserData(userId, mergedUpdates);
        } else {
          const mod = await import('./storage-helper.js').catch(() => null);
          if (mod && typeof mod.patchUserData === 'function') {
            result = mod.patchUserData(userId, mergedUpdates);
          }
        }
      } catch (err) {
        console.warn('Debounced patchUserData batching error:', err);
      }

      currentResolvers.forEach((res) => res(result));
    }, delay);
  });
}

if (typeof window !== 'undefined') {
  window.CryptoVault = {
    VAULT_VERSION,
    PBKDF2_ITERATIONS,
    IV_LENGTH_BYTES,
    SENSITIVE_STORAGE_KEYS,
    SENSITIVE_SYNC_FIELDS,
    get cachedDerivedKey() { return cachedDerivedKey; },
    getCachedDerivedKey,
    clearDerivedKeyCache,
    getSessionSalt,
    debouncePatchUserData,
    getDefaultVaultSecret,
    isEncryptedPayload,
    encryptPayload,
    decryptPayload,
    saveEncryptedStorageItem,
    loadEncryptedStorageItem,
    syncEncryptedVaultMirror,
    encryptSensitiveFieldsForSync,
    decryptSensitiveFieldsFromSync,
    migrateSensitiveLocalStorageToVault
  };
}

export default {
  VAULT_VERSION,
  PBKDF2_ITERATIONS,
  IV_LENGTH_BYTES,
  SENSITIVE_STORAGE_KEYS,
  SENSITIVE_SYNC_FIELDS,
  get cachedDerivedKey() { return cachedDerivedKey; },
  getCachedDerivedKey,
  clearDerivedKeyCache,
  getSessionSalt,
  debouncePatchUserData,
  getDefaultVaultSecret,
  isEncryptedPayload,
  encryptPayload,
  decryptPayload,
  saveEncryptedStorageItem,
  loadEncryptedStorageItem,
  syncEncryptedVaultMirror,
  encryptSensitiveFieldsForSync,
  decryptSensitiveFieldsFromSync,
  migrateSensitiveLocalStorageToVault
};
