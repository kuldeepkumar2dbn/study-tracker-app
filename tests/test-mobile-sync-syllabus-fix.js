/**
 * Comprehensive Test Suite for:
 * 1. Mobile Google Drive Token Verification & Auto-Hydration
 * 2. Explicit "☁️ Sync Now" Bidirectional Synchronization
 * 3. Subjects & Syllabus Defensive Fallbacks and Empty State Card
 * 4. Mobile Navigation Drawer Backdrop Overlay & Body Overflow Reset
 * 5. ErrorBoundary Recovery Card
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock Browser Environment
const localStorageStore = {};
const sessionStorageStore = {};

global.window = {
  location: { reload: () => {}, href: 'http://localhost:5173/syllabus.html' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  google: {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback, error_callback } = {}) => ({
          requestAccessToken: ({ prompt } = {}) => {
            if (prompt === '') {
              if (error_callback) error_callback({ message: 'Silent reauth unavailable' });
            } else if (callback) {
              callback({ access_token: 'fresh_mock_token_456', expires_in: 3600 });
            }
          }
        })
      }
    }
  }
};

global.document = {
  body: {
    style: {
      overflow: ''
    }
  },
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.localStorage = {
  getItem: (key) => (key in localStorageStore ? localStorageStore[key] : null),
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

global.sessionStorage = {
  getItem: (key) => (key in sessionStorageStore ? sessionStorageStore[key] : null),
  setItem: (key, val) => { sessionStorageStore[key] = String(val); },
  removeItem: (key) => { delete sessionStorageStore[key]; },
  clear: () => { Object.keys(sessionStorageStore).forEach(k => delete sessionStorageStore[k]); }
};

global.CustomEvent = class CustomEvent {
  constructor(type, params = {}) {
    this.type = type;
    this.detail = params.detail || {};
  }
};

global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

console.log('--- Starting Mobile Drive Sync & Syllabus Fix Tests ---');

// Test 1: Cloud Sync Module Static & Unit Verification
import {
  SYNC_FILE_NAME,
  findSyncFile,
  downloadSyncFile,
  createSyncFile,
  updateSyncFile,
  hydrateFromCloud,
  forceBidirectionalSync,
  verifyOrRequestDriveToken,
  getActiveAccessToken,
  isAccessTokenValid,
  setSyncStatus,
  getSyncStatus
} from '../cloud-sync.js';

console.log('✓ Test 1: Testing Token Validation and Verification');
assert.strictEqual(isAccessTokenValid(null), false, 'Null token is invalid');
assert.strictEqual(isAccessTokenValid(''), false, 'Empty token is invalid');
assert.strictEqual(isAccessTokenValid('mock_token_123'), true, 'Non-expired token is valid');

// Set expired token
sessionStorage.setItem('google_token_expiry', String(Date.now() - 5000));
assert.strictEqual(isAccessTokenValid('expired_token'), false, 'Past timestamp token detected as expired');
sessionStorage.removeItem('google_token_expiry');

console.log('✓ Test 2: Testing Token Verification Fallback to needs_auth');
sessionStorage.clear();
const verifiedMissing = await verifyOrRequestDriveToken({ promptUserIfConsentNeeded: false });
assert.strictEqual(verifiedMissing, null, 'verifyOrRequestDriveToken returns null without token');
assert.strictEqual(getSyncStatus(), 'needs_auth', 'Sets status to needs_auth when authorization is required');

console.log('✓ Test 3: Testing Auto-Hydrate from Drive Without Overwriting Cloud with Local Zero-State');
const testUserId = 'mobile_user_test_456';
const masterKey = `studyflow_${testUserId}_data`;

// Simulate empty zero-state locally on mobile phone
localStorage.setItem(masterKey, JSON.stringify({
  userId: testUserId,
  streak: 0,
  subjects: [],
  routine: [],
  skills: [],
  exams: [],
  updatedAt: new Date(Date.now() - 100000).toISOString()
}));

// Mock Google Drive fetch responses
let mockDriveFiles = [
  { id: 'drive_file_789', name: 'studyflow_user_data.json', modifiedTime: new Date().toISOString() }
];

let mockRemoteFileContent = {
  userId: testUserId,
  streak: 5,
  subjects: [
    { id: 'sub-cloud-1', name: 'Cloud Architecture & Microservices', topics: [{ id: 'top-1', title: 'OAuth & Token Refresh' }] }
  ],
  routine: [{ id: 'slot-1', title: 'Morning Deep Work', completed: true }],
  skills: [{ id: 'skill-1', name: 'React Mobile Optimization', masteryPct: 75 }],
  exams: [{ id: 'exam-1', name: 'Final Semester Exam', date: '2026-11-15' }],
  updatedAt: new Date().toISOString()
};

global.fetch = async (url, opts = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('files?q=') && opts.headers?.Authorization) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ files: mockDriveFiles })
    };
  }
  if (urlStr.includes('/files/drive_file_789?alt=media')) {
    return {
      ok: true,
      status: 200,
      json: async () => mockRemoteFileContent
    };
  }
  if (urlStr.includes('/upload/drive/v3/files/drive_file_789?uploadType=media')) {
    const body = JSON.parse(opts.body);
    mockRemoteFileContent = body;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'drive_file_789', ...body })
    };
  }
  return { ok: false, status: 404, text: async () => 'Not Found' };
};

const hydrateResult = await hydrateFromCloud('valid_test_token', testUserId);
assert.strictEqual(hydrateResult.hydrated, true, 'hydrateFromCloud succeeds');
assert.strictEqual(hydrateResult.source, 'remote', 'Remote data was hydrated onto mobile device');

// Verify that cloud data was written directly to localStorage
const savedMaster = JSON.parse(localStorage.getItem(masterKey));
assert.strictEqual(savedMaster.subjects.length, 1, 'Cloud subjects populated into localStorage');
assert.strictEqual(savedMaster.subjects[0].name, 'Cloud Architecture & Microservices', 'Exact cloud subject preserved');
assert.strictEqual(savedMaster.streak, 5, 'Cloud streak preserved');
assert.strictEqual(getSyncStatus(), 'synced', 'Sync status is synced after hydration');

// Set user profile so getActiveUserId() identifies the active student
localStorage.setItem('study_user_profile', JSON.stringify({ sub: testUserId, name: 'Mobile Student' }));
localStorage.setItem('user_profile', JSON.stringify({ sub: testUserId, name: 'Mobile Student' }));

// Case: Mobile phone is missing skills and exams, forceBidirectionalSync pulls cloud data
localStorage.setItem(masterKey, JSON.stringify({
  userId: testUserId,
  subjects: [{ id: 'sub-cloud-1', name: 'Cloud Architecture & Microservices' }],
  routine: [],
  skills: [], // Missing skills on phone
  exams: [], // Missing exams on phone
  updatedAt: new Date().toISOString()
}));
sessionStorage.setItem('studyflow_drive_token', 'valid_test_token');

const bidiResult = await forceBidirectionalSync();
assert.strictEqual(bidiResult.success, true, 'forceBidirectionalSync executed successfully');
assert.strictEqual(bidiResult.action, 'downloaded', 'Phone downloaded complete cloud data since it was missing skills/exams');

console.log('✓ Test 5: Verify SubjectsTab and CollapsibleSidebar Code Files');

// Check SubjectsTab.jsx for defensive fallbacks
const subjectsTabContent = fs.readFileSync(path.resolve('src/components/tabs/SubjectsTab.jsx'), 'utf-8');
assert(subjectsTabContent.includes('localStorage.getItem(`studyflow_${activeUserId}_data`) || "{}"'), 'SubjectsTab has defensive localStorage reading');
assert(subjectsTabContent.includes('Array.isArray(userData?.subjects) ? userData.subjects : []'), 'SubjectsTab has defensive subjects array fallback');
assert(subjectsTabContent.includes('id="syllabus-empty-state"'), 'SubjectsTab renders clean styled empty state');
assert(subjectsTabContent.includes("No subjects added yet. Tap '+ Add Subject' to create your first syllabus roadmap."), 'SubjectsTab renders required empty state message');
assert(subjectsTabContent.includes('export const SyllabusView = SubjectsTab'), 'SubjectsTab exports SyllabusView alias');

// Check CollapsibleSidebar.jsx for mobile drawer backdrop and body overflow handling
const sidebarContent = fs.readFileSync(path.resolve('src/components/CollapsibleSidebar.jsx'), 'utf-8');
assert(sidebarContent.includes('id="sidebar-backdrop"'), 'CollapsibleSidebar has explicit #sidebar-backdrop element');
assert(sidebarContent.includes('pointer-events-none'), 'CollapsibleSidebar applies pointer-events: none to hidden backdrop');
assert(sidebarContent.includes('pointer-events-auto'), 'CollapsibleSidebar applies pointer-events-auto to open backdrop');
assert(sidebarContent.includes("document.body.style.overflow = ''"), 'CollapsibleSidebar resets document.body.style.overflow');
assert(sidebarContent.includes("document.body.style.overflow = 'hidden'"), 'CollapsibleSidebar sets hidden overflow only when drawer is open');

// Check AppShell.jsx for ErrorBoundary and Sync buttons
const appShellContent = fs.readFileSync(path.resolve('src/components/AppShell.jsx'), 'utf-8');
assert(appShellContent.includes('id="header-sync-now-btn"'), 'AppShell has explicit ☁️ Sync Now button in header');
assert(appShellContent.includes('id="dropdown-sync-now-btn"'), 'AppShell has explicit Sync Cloud Data button in profile dropdown');
assert(appShellContent.includes('Click to Authorize Drive'), 'AppShell renders Click to Authorize Drive badge when needs_auth');
assert(appShellContent.includes('<ErrorBoundary>'), 'AppShell wraps children and initPage in ErrorBoundary');

// Check ErrorBoundary.jsx exists and has reload action
const errorBoundaryContent = fs.readFileSync(path.resolve('src/components/ErrorBoundary.jsx'), 'utf-8');
assert(errorBoundaryContent.includes('Something went wrong'), 'ErrorBoundary renders "Something went wrong"');
assert(errorBoundaryContent.includes('Reload Page'), 'ErrorBoundary renders "Reload Page" button');
assert(errorBoundaryContent.includes('window.location.reload()'), 'ErrorBoundary handles reload action');

console.log('--- ALL MOBILE DRIVE SYNC & SYLLABUS FIX TESTS PASSED ---');
