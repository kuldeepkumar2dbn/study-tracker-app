/**
 * Automated Verification Test Suite for Google OAuth Configuration & Scope Audit
 * (tests/test-oauth-scopes-audit.js)
 *
 * Verifies:
 * 1. SCOPE AUDIT: Complete removal of calendar.events from tokenClient initialization.
 * 2. INITIAL LOGIN RESTRICTION: Login strictly requests basic authentication ('openid email profile').
 * 3. DECOUPLED PERMISSIONS: drive.file scope is isolated and only requested incrementally for Drive operations.
 * 4. STORAGE CLEANUP: cleanStorage() purges cached/expired tokens from localStorage.
 * 5. JWT PARSER: Decodes basic user identity without requiring sensitive scopes.
 */

import fs from 'fs';
import path from 'path';
import {
  BASIC_AUTH_SCOPES,
  DRIVE_FILE_SCOPE,
  DEFAULT_GOOGLE_SCOPES,
  cleanStorage,
  parseJwtPayload,
  hasDriveScope,
  requestDriveScope,
  hasCalendarScope,
  requestCalendarScope
} from '../google-auth.js';
import { cleanStorage as cleanStorageFromDrive } from '../src/services/googleDrive.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-Memory Storage Mock
const mockLocalStorage = {};
const mockSessionStorage = {};

global.localStorage = {
  getItem: (k) => (k in mockLocalStorage ? mockLocalStorage[k] : null),
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.sessionStorage = {
  getItem: (k) => (k in mockSessionStorage ? mockSessionStorage[k] : null),
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

console.log('\n================================================================');
console.log('--- 1. SCOPE AUDIT & REMOVAL OF SENSITIVE SCOPES ---');
console.log('================================================================');

// 1.1 Scope Definitions
assert(BASIC_AUTH_SCOPES === 'openid email profile', 'BASIC_AUTH_SCOPES is strictly non-sensitive: "openid email profile"');
assert(DRIVE_FILE_SCOPE === 'https://www.googleapis.com/auth/drive.file', 'DRIVE_FILE_SCOPE is the specific drive.file scope');
assert(DEFAULT_GOOGLE_SCOPES === 'openid email profile https://www.googleapis.com/auth/drive.file', 'DEFAULT_GOOGLE_SCOPES contains ONLY basic auth and drive.file');
assert(!DEFAULT_GOOGLE_SCOPES.includes('calendar'), 'DEFAULT_GOOGLE_SCOPES strictly DOES NOT contain calendar scope');
assert(!BASIC_AUTH_SCOPES.includes('calendar'), 'BASIC_AUTH_SCOPES strictly DOES NOT contain calendar scope');
assert(!BASIC_AUTH_SCOPES.includes('drive'), 'BASIC_AUTH_SCOPES strictly DOES NOT contain drive scope (login decoupled)');

// 1.2 Global Source Code Audit: Ensure NO tokenClient requests calendar.events
const sourceDirs = ['./src', './public', '.'];
const excludeFolders = ['node_modules', '.git', 'dist'];

function scanFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeFolders.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFiles(fullPath, fileList);
    } else if (/\.(jsx?|html)$/.test(entry.name) && !entry.name.includes('test-google-calendar-sync') && !entry.name.includes('test-oauth-scopes-audit')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allProjectFiles = scanFiles('.');
let filesWithCalendarTokenClient = [];
let filesWithCalendarEventsScope = [];

for (const filePath of allProjectFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('initTokenClient') && content.includes('calendar.events')) {
    filesWithCalendarTokenClient.push(filePath);
  }
  if (content.includes('https://www.googleapis.com/auth/calendar.events')) {
    filesWithCalendarEventsScope.push(filePath);
  }
}

assert(filesWithCalendarTokenClient.length === 0, `Zero files initialize tokenClient with calendar.events (found: ${filesWithCalendarTokenClient.join(', ') || 'none'})`);
assert(filesWithCalendarEventsScope.length === 0, `Zero source files reference calendar.events scope (found: ${filesWithCalendarEventsScope.join(', ') || 'none'})`);

console.log('\n================================================================');
console.log('--- 2. DECOUPLED LOGIN & BASIC AUTHENTICATION ---');
console.log('================================================================');

// 2.1 Login page inspection
const loginJsxContent = fs.readFileSync(path.resolve('./src/pages/login.jsx'), 'utf-8');
assert(loginJsxContent.includes('BASIC_AUTH_SCOPES'), 'src/pages/login.jsx uses BASIC_AUTH_SCOPES for login');
assert(!loginJsxContent.includes('DEFAULT_GOOGLE_SCOPES'), 'src/pages/login.jsx does not request DEFAULT_GOOGLE_SCOPES (drive decoupled from login)');
assert(loginJsxContent.includes('gsi-rendered-button'), 'src/pages/login.jsx includes container for official Google Sign-In button (renderButton)');
assert(loginJsxContent.includes('google.accounts.id.initialize'), 'src/pages/login.jsx initializes Google One-Tap / renderButton');
assert(loginJsxContent.includes('google.accounts.id.renderButton'), 'src/pages/login.jsx renders official Google Sign-In button');

// 2.2 JWT Payload Parsing
const testPayload = {
  sub: 'google_user_123456789',
  email: 'student@example.com',
  name: 'Alex Johnson',
  picture: 'https://example.com/avatar.jpg'
};

const encodedPayload = Buffer.from(JSON.stringify(testPayload)).toString('base64');
const fakeJwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.signature`;

const parsed = parseJwtPayload(fakeJwt);
assert(parsed !== null, 'parseJwtPayload decodes JWT payload successfully');
assert(parsed.sub === testPayload.sub, 'Parsed sub matches');
assert(parsed.email === testPayload.email, 'Parsed email matches');
assert(parsed.name === testPayload.name, 'Parsed name matches');
assert(parsed.picture === testPayload.picture, 'Parsed picture matches');

console.log('\n================================================================');
console.log('--- 3. INCREMENTAL DRIVE CONSENT ---');
console.log('================================================================');

// 3.1 hasDriveScope
sessionStorage.clear();
assert(hasDriveScope() === false, 'hasDriveScope returns false when no scopes in session');
assert(hasDriveScope(DRIVE_FILE_SCOPE) === true, 'hasDriveScope returns true for matching scope string');
assert(hasDriveScope({ scope: 'openid email https://www.googleapis.com/auth/drive.file' }) === true, 'hasDriveScope returns true for tokenResponse');

// 3.2 requestDriveScope incremental consent
global.window = {
  google: {
    accounts: {
      oauth2: {
        initTokenClient: ({ scope, callback }) => ({
          requestAccessToken: () => {
            assert(scope === DRIVE_FILE_SCOPE, 'requestDriveScope initializes tokenClient with strictly DRIVE_FILE_SCOPE');
            callback({
              access_token: 'mock_drive_token_xyz',
              scope: scope,
              expires_in: 3600
            });
          }
        })
      }
    }
  }
};

const driveResult = await requestDriveScope();
assert(driveResult && driveResult.success && driveResult.granted, 'requestDriveScope grants Drive scope incrementally');
assert(sessionStorage.getItem('studyflow_drive_token') === 'mock_drive_token_xyz', 'Drive token stored in sessionStorage');

// 3.3 Safe Stubs for legacy calendar calls
assert(hasCalendarScope() === false, 'hasCalendarScope returns false');
const calReq = await requestCalendarScope();
assert(calReq.success === false && calReq.granted === false, 'requestCalendarScope safely rejects without making network/token requests');

console.log('\n================================================================');
console.log('--- 4. STORAGE CLEANUP: PURGING CACHED EXPIRED TOKENS ---');
console.log('================================================================');

localStorage.setItem('google_access_token', 'stale_expired_token_123');
localStorage.setItem('studyflow_drive_token', 'stale_drive_token_456');
localStorage.setItem('google_token_expiry', '1000000000');
localStorage.setItem('google_granted_scopes', 'openid email calendar.events');
sessionStorage.setItem('google_granted_scopes', 'openid email calendar.events');
sessionStorage.setItem('google_access_token', 'stale_session_token');

cleanStorage();

assert(localStorage.getItem('google_access_token') === null, 'cleanStorage removed google_access_token from localStorage');
assert(localStorage.getItem('studyflow_drive_token') === null, 'cleanStorage removed studyflow_drive_token from localStorage');
assert(localStorage.getItem('google_token_expiry') === null, 'cleanStorage removed google_token_expiry from localStorage');
assert(localStorage.getItem('google_granted_scopes') === null, 'cleanStorage removed google_granted_scopes from localStorage');
assert(sessionStorage.getItem('google_granted_scopes') === null, 'cleanStorage purged old session scopes containing calendar');
assert(sessionStorage.getItem('google_access_token') === null, 'cleanStorage purged old session access token');

console.log('\n================================================================');
console.log(`--- RESULTS: ${passedTests} / ${totalTests} TESTS PASSED ---`);
console.log('================================================================\n');

