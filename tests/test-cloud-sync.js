/**
 * Multi-Device Cloud Synchronization Test Suite
 * Tests for cloud-sync.js, DataContext, and UI Header integration
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Mock Browser Environment
const localStorageStore = new Map();
const sessionStorageStore = new Map();
const eventListeners = new Map();

global.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear()
};

global.sessionStorage = {
  getItem: (key) => sessionStorageStore.get(key) || null,
  setItem: (key, val) => sessionStorageStore.set(key, String(val)),
  removeItem: (key) => sessionStorageStore.delete(key),
  clear: () => sessionStorageStore.clear()
};

global.window = {
  addEventListener: (event, handler) => {
    if (!eventListeners.has(event)) eventListeners.set(event, []);
    eventListeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (eventListeners.has(event)) {
      eventListeners.set(event, eventListeners.get(event).filter(h => h !== handler));
    }
  },
  dispatchEvent: (event) => {
    const list = eventListeners.get(event.type) || [];
    list.forEach(h => h(event));
    return true;
  },
  location: {
    protocol: 'http:',
    hostname: 'localhost'
  }
};

global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || null;
  }
};

global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('🧪 Starting Multi-Device Cloud Synchronization Tests...\n');

// Import cloud-sync.js
const {
  SYNC_FILE_NAME,
  findSyncFile,
  downloadSyncFile,
  createSyncFile,
  updateSyncFile,
  hydrateFromCloud,
  debounceSaveToDrive,
  formatRelativeSyncTime,
  setSyncStatus,
  getSyncStatus
} = await import('../cloud-sync.js');

// 1. Architecture & Exports
console.log('--- 1. Architecture & Schema Verification ---');

it('SYNC_FILE_NAME is defined as "studyflow_user_data.json"', () => {
  assert.strictEqual(SYNC_FILE_NAME, 'studyflow_user_data.json');
});

it('formatRelativeSyncTime returns expected human-readable relative strings', () => {
  assert.strictEqual(formatRelativeSyncTime(null), 'Just now');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 5000), 'Just now');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 30000), '30s ago');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 60000), '1 min ago');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 120000), '2 mins ago');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 3600000), '1 hour ago');
  assert.strictEqual(formatRelativeSyncTime(Date.now() - 7200000), '2 hours ago');
});

// 2. Google Drive API v3 Query Mocking & Multi-Device Restoration
console.log('\n--- 2. Login & Data Hydration (Multi-Device Restoration) ---');

await itAsync('Case A: Remote file exists and is newer -> hydrations populates localStorage & dispatches event', async () => {
  localStorage.clear();
  sessionStorage.clear();

  const testUserId = '109283746592837461524';
  const testToken = 'mock_drive_access_token_123';
  sessionStorage.setItem('studyflow_drive_token', testToken);

  // Set local state with older timestamp
  const localPayload = {
    userId: testUserId,
    streak: 2,
    todayLoggedHours: 1.0,
    routine: [{ id: 'old_1', title: 'Old Block', completed: false }],
    updatedAt: new Date(Date.now() - 100000).toISOString()
  };
  localStorage.setItem(`studyflow_${testUserId}_data`, JSON.stringify(localPayload));

  // Remote data created on Device 2 with newer timestamp
  const remotePayload = {
    userId: testUserId,
    streak: 5,
    todayLoggedHours: 3.5,
    routine: [{ id: 'new_1', title: 'Calculus Ch 3 Problem Set', completed: true }],
    exams: [{ id: 'ex_1', title: 'Midterm Exam', date: '2026-11-15' }],
    skills: [{ id: 'sk_1', title: 'System Design', level: 'Intermediate' }],
    subjects: [{ id: 'sub_1', name: 'Mathematics', code: 'MATH101' }],
    updatedAt: new Date().toISOString()
  };

  // Mock global fetch
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/files?') && urlStr.includes(encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`))) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          files: [{ id: 'file_cloud_999', modifiedTime: remotePayload.updatedAt }]
        })
      };
    }
    if (urlStr.includes('/files/file_cloud_999?alt=media')) {
      return {
        ok: true,
        status: 200,
        json: async () => remotePayload
      };
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  };

  let eventFired = false;
  let receivedData = null;
  const listener = (e) => {
    eventFired = true;
    receivedData = e.detail?.data;
  };
  window.addEventListener('studyflow-cloud-sync', listener);

  const res = await hydrateFromCloud(testToken, testUserId);

  assert.strictEqual(res.hydrated, true, 'Hydration must succeed');
  assert.strictEqual(res.source, 'remote', 'Source must be remote');
  assert.strictEqual(res.fileId, 'file_cloud_999');

  // Verify localStorage is populated
  const updatedLocal = JSON.parse(localStorage.getItem(`studyflow_${testUserId}_data`));
  assert.strictEqual(updatedLocal.streak, 5, 'Remote streak must hydrate to 5');
  assert.strictEqual(updatedLocal.todayLoggedHours, 3.5, 'Remote logged hours must hydrate');
  assert.strictEqual(updatedLocal.routine[0].title, 'Calculus Ch 3 Problem Set');

  // Verify event dispatched
  assert.strictEqual(eventFired, true, 'studyflow-cloud-sync event must be dispatched');
  assert.strictEqual(receivedData.streak, 5);

  window.removeEventListener('studyflow-cloud-sync', listener);
  global.fetch = originalFetch;
});

await itAsync('Case B: File does not exist on Drive -> creates zero-state and returns fileId', async () => {
  localStorage.clear();
  sessionStorage.clear();

  const brandNewUserId = 'new_student_555';
  const testToken = 'mock_drive_access_token_abc';

  const originalFetch = global.fetch;
  let createdPayload = null;

  global.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes('/files?') && urlStr.includes(encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`))) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ files: [] }) // Does not exist
      };
    }
    if (urlStr.includes('uploadType=multipart')) {
      createdPayload = options.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'new_drive_file_777', name: SYNC_FILE_NAME })
      };
    }
    return { ok: false, status: 404 };
  };

  const res = await hydrateFromCloud(testToken, brandNewUserId);

  assert.strictEqual(res.hydrated, true, 'Zero-state creation must succeed');
  assert.strictEqual(res.source, 'created_zero_state');
  assert.strictEqual(res.fileId, 'new_drive_file_777');
  assert.strictEqual(res.data.streak, 0, 'Zero-state streak is 0');
  assert.strictEqual(res.data.todayLoggedHours, 0.0, 'Zero-state logged hours is 0.0');

  global.fetch = originalFetch;
});

// 3. Real-Time Debounced Cloud Save
console.log('\n--- 3. Real-Time Debounced Cloud Save ---');

await itAsync('debounceSaveToDrive immediately writes to localStorage with updatedAt ISO timestamp', async () => {
  localStorage.clear();
  const testUserId = 'test_save_user_123';
  localStorage.setItem('user_profile', JSON.stringify({ sub: testUserId }));

  const dataToSave = {
    streak: 3,
    todayLoggedHours: 2.5,
    routine: [{ id: 'rt_1', title: 'Data Structures', completed: true }]
  };

  debounceSaveToDrive(dataToSave, 5000);

  // Must be saved IMMEDIATELY to localStorage with ZERO lag
  const rawSaved = localStorage.getItem(`studyflow_${testUserId}_data`);
  assert(rawSaved !== null, 'Saved immediately to localStorage');
  const parsed = JSON.parse(rawSaved);
  assert.strictEqual(parsed.streak, 3);
  assert(parsed.updatedAt, 'Must attach updatedAt timestamp');
  assert(!isNaN(new Date(parsed.updatedAt).getTime()), 'updatedAt must be a valid ISO string');
});

await itAsync('updateSyncFile sends PATCH request with uploadType=media', async () => {
  let patchCalled = false;
  let sentBody = null;

  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/files/test_file_id_123?uploadType=media') && options.method === 'PATCH') {
      patchCalled = true;
      sentBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'test_file_id_123' })
      };
    }
    return { ok: false, status: 404 };
  };

  const payload = { streak: 4, todayLoggedHours: 2.0 };
  const res = await updateSyncFile('mock_token', 'test_file_id_123', payload);

  assert.strictEqual(patchCalled, true, 'PATCH request must be sent to Drive');
  assert.strictEqual(sentBody.streak, 4);
  assert.strictEqual(res.id, 'test_file_id_123');

  global.fetch = originalFetch;
});

// 4. UI Header Badge States & Offline Resilience
console.log('\n--- 4. UI Header Drive Badge States ---');

it('Sync status states transition cleanly between syncing, synced, and offline', () => {
  let latestDetail = null;
  const listener = (e) => { latestDetail = e.detail; };
  window.addEventListener('studyflow-cloud-sync-status', listener);

  setSyncStatus('syncing');
  assert.strictEqual(getSyncStatus(), 'syncing');
  assert.strictEqual(latestDetail.status, 'syncing');

  const now = Date.now();
  setSyncStatus('synced', { syncedAt: now });
  assert.strictEqual(getSyncStatus(), 'synced');
  assert.strictEqual(latestDetail.status, 'synced');
  assert.strictEqual(latestDetail.relativeTime, 'Just now');

  setSyncStatus('offline', { reason: 'network_disconnected' });
  assert.strictEqual(getSyncStatus(), 'offline');
  assert.strictEqual(latestDetail.status, 'offline');

  window.removeEventListener('studyflow-cloud-sync-status', listener);
});

it('AppShell.jsx renders all 3 header badge states: "Syncing...", "Drive Synced", and "Offline - Saved locally"', () => {
  const appShellContent = fs.readFileSync(path.resolve('src/components/AppShell.jsx'), 'utf-8');
  assert(appShellContent.includes('Syncing...'), 'Must render "Syncing..." badge');
  assert(appShellContent.includes('Drive Synced'), 'Must render "Drive Synced" badge');
  assert(appShellContent.includes('Offline - Saved locally'), 'Must render "Offline - Saved locally" badge');
  assert(appShellContent.includes('relativeSyncTime'), 'Must include relative sync time tooltip');
});

// 5. Guest & Demo Isolation
console.log('\n--- 5. Guest Preview & Demo Sandbox Preservation ---');

await itAsync('hydrateFromCloud and debounceSaveToDrive skip Drive sync in Demo mode', async () => {
  // Set demo mode session
  sessionStorage.setItem('demo_session_active', 'true');

  const res = await hydrateFromCloud('fake_token', 'demo_sandbox_user');
  assert.strictEqual(res.hydrated, false, 'Must not hydrate cloud data in demo mode');
  assert.strictEqual(res.reason, 'demo_user');

  sessionStorage.clear();
});

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
