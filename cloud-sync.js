/**
 * Multi-Device Cloud Synchronization Engine (cloud-sync.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Background sync between LocalStorage and Google Drive (drive.file scope)
 * 2. Sync file identifier: studyflow_user_data.json
 * 3. Login & Data Hydration (Multi-Device Restoration)
 *    - Case A: File exists -> download, compare remoteData.updatedAt with localData.updatedAt, hydrate if newer
 *    - Case B: File does not exist -> create zero-state payload on Drive and save fileId
 * 4. Real-time debounced cloud save (debounceSaveToDrive with 2000ms delay):
 *    - Saves immediately to localStorage with ISO updatedAt timestamp
 *    - Updates Drive file via PATCH with uploadType=media
 *    - Silently handles 401 token expiration via GIS requestAccessToken({ prompt: '' }) and retries once
 * 5. UI Header status badges: "Syncing...", "Drive Synced" (with relative time), and "Offline - Saved locally"
 * 6. Isolated Demo mode & Guest preview protection
 */

import { requestSilentDriveToken, DEFAULT_GOOGLE_CLIENT_ID } from './src/services/googleDrive.js';
import { 
  getOrCreateZeroStateData, 
  createZeroStateData, 
  getActiveUserId, 
  isDemoUser,
  getUserDataStorageKey 
} from './auth-guard.js';

export const SYNC_FILE_NAME = 'studyflow_user_data.json';
export const SYNC_STORAGE_FILE_ID_KEY = 'studyflow_cloud_sync_file_id';
export const SYNC_LAST_SYNCED_KEY = 'studyflow_cloud_last_synced_at';
export const SYNC_STATUS_KEY = 'studyflow_cloud_sync_status';

// In-memory sync state
let activeFileId = null;
let currentSyncStatus = 'offline'; // 'offline' | 'syncing' | 'synced' | 'unsaved' | 'error'
let lastSyncedTimestamp = null;
let debounceTimer = null;
let tokenClientInstance = null;

/**
 * Format relative sync time for UI tooltips:
 * e.g. "Just now", "2 mins ago", "1 hour ago"
 */
export function formatRelativeSyncTime(timestamp) {
  if (!timestamp) return 'Just now';
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(time)) return 'Just now';
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} mins ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * Retrieves the currently active Google OAuth access token from sessionStorage
 */
export function getActiveAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('studyflow_drive_token') || 
           sessionStorage.getItem('google_access_token') || 
           null;
  } catch {
    return null;
  }
}

/**
 * Updates the global sync status and notifies active UI subscribers
 */
export function setSyncStatus(status, details = {}) {
  currentSyncStatus = status;
  if (status === 'synced') {
    lastSyncedTimestamp = details.syncedAt || Date.now();
    try {
      localStorage.setItem(SYNC_LAST_SYNCED_KEY, String(lastSyncedTimestamp));
    } catch {}
  }
  try {
    localStorage.setItem(SYNC_STATUS_KEY, status);
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-cloud-sync-status', {
      detail: {
        status,
        lastSyncedTimestamp,
        relativeTime: formatRelativeSyncTime(lastSyncedTimestamp),
        ...details
      }
    }));
  }
}

export function getSyncStatus() {
  return currentSyncStatus;
}

export function getLastSyncedTimestamp() {
  if (!lastSyncedTimestamp && typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(SYNC_LAST_SYNCED_KEY);
    if (saved) lastSyncedTimestamp = Number(saved);
  }
  return lastSyncedTimestamp;
}

/**
 * Queries Google Drive API v3 for studyflow_user_data.json:
 * GET https://www.googleapis.com/drive/v3/files?q=name='studyflow_user_data.json' and trashed=false&fields=files(id, modifiedTime)
 */
export async function findSyncFile(accessToken) {
  if (!accessToken) return null;
  const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,modifiedTime,name,parents)`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    const refreshedToken = await handleSilentTokenRefresh();
    if (refreshedToken) {
      return findSyncFile(refreshedToken);
    }
    throw new Error('UNAUTHORIZED_DRIVE_TOKEN');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive Query failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    activeFileId = data.files[0].id;
    try {
      localStorage.setItem(SYNC_STORAGE_FILE_ID_KEY, activeFileId);
    } catch {}
    return data.files[0];
  }

  return null;
}

/**
 * Downloads file content from Google Drive:
 * GET https://www.googleapis.com/drive/v3/files/${fileId}?alt=media
 */
export async function downloadSyncFile(accessToken, fileId) {
  if (!accessToken || !fileId) return null;
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (response.status === 401) {
    const refreshedToken = await handleSilentTokenRefresh();
    if (refreshedToken) {
      return downloadSyncFile(refreshedToken, fileId);
    }
    throw new Error('UNAUTHORIZED_DRIVE_TOKEN');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Download from Google Drive failed: ${errorText}`);
  }

  return await response.json();
}

/**
 * Creates studyflow_user_data.json on Google Drive via multipart upload
 */
export async function createSyncFile(accessToken, payload, parentFolderId = null) {
  if (!accessToken) throw new Error('Access token is required to create Drive sync file.');

  const boundary = '-------studyflow_sync_boundary_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: SYNC_FILE_NAME,
    mimeType: 'application/json'
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const contentJson = JSON.stringify(payload, null, 2);
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    contentJson +
    closeDelimiter;

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (response.status === 401) {
    const refreshedToken = await handleSilentTokenRefresh();
    if (refreshedToken) {
      return createSyncFile(refreshedToken, payload, parentFolderId);
    }
    throw new Error('UNAUTHORIZED_DRIVE_TOKEN');
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create ${SYNC_FILE_NAME} on Drive: ${err}`);
  }

  const newFile = await response.json();
  activeFileId = newFile.id;
  try {
    localStorage.setItem(SYNC_STORAGE_FILE_ID_KEY, activeFileId);
  } catch {}

  return newFile;
}

/**
 * Updates existing studyflow_user_data.json on Google Drive:
 * PATCH https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media
 */
export async function updateSyncFile(accessToken, fileId, payload) {
  if (!accessToken || !fileId) {
    throw new Error('Access token and fileId are required for updating Drive file.');
  }

  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const contentJson = JSON.stringify(payload, null, 2);

  const response = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: contentJson
  });

  if (response.status === 401) {
    const refreshedToken = await handleSilentTokenRefresh();
    if (refreshedToken) {
      return updateSyncFile(refreshedToken, fileId, payload);
    }
    throw new Error('UNAUTHORIZED_DRIVE_TOKEN');
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update ${SYNC_FILE_NAME} on Drive: ${err}`);
  }

  return await response.json();
}

/**
 * Handles silent token refresh when receiving a 401 from Google Drive API
 */
export async function handleSilentTokenRefresh() {
  if (typeof window === 'undefined') return null;
  try {
    return await requestSilentDriveToken(DEFAULT_GOOGLE_CLIENT_ID);
  } catch (err) {
    console.warn('Silent Drive token refresh failed:', err);
    setSyncStatus('offline', { reason: 'token_expired' });
    return null;
  }
}

/**
 * LOGIN & DATA HYDRATION (MULTI-DEVICE RESTORATION)
 *
 * When a user logs in via Google Identity Services and an access token is acquired:
 * - Query Google Drive API v3 for studyflow_user_data.json
 * - CASE A: File exists -> download, compare remoteData.updatedAt with localData.updatedAt,
 *   hydrate localStorage if remote is newer or local is empty, trigger UI refresh.
 * - CASE B: File does not exist -> initialize clean zero-state, create file on Drive, store fileId.
 *
 * @param {string} accessToken Active Google Drive OAuth token
 * @param {string} userId Unique Google user subject ID (user.sub)
 * @returns {Promise<Object>} Hydration result
 */
export async function hydrateFromCloud(accessToken, userId) {
  if (!accessToken || !userId || userId === 'guest') {
    return { hydrated: false, reason: 'unauthenticated' };
  }
  if (isDemoUser() || userId === 'demo_sandbox_user') {
    return { hydrated: false, reason: 'demo_user' };
  }

  const masterStorageKey = `studyflow_${userId}_data`;
  setSyncStatus('syncing');

  try {
    // 1. Query Google Drive API v3
    const existingFile = await findSyncFile(accessToken);

    if (existingFile && existingFile.id) {
      // ==========================================
      // CASE A: File Exists in Google Drive
      // ==========================================
      const remoteData = await downloadSyncFile(accessToken, existingFile.id);

      if (remoteData && typeof remoteData === 'object') {
        let localData = null;
        try {
          const raw = localStorage.getItem(masterStorageKey);
          if (raw) localData = JSON.parse(raw);
        } catch {}

        const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
        const localTime = localData && localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

        // If remote data is newer or local is empty, populate localStorage with remoteData
        const isRemoteNewer = !localData || !localTime || remoteTime >= localTime;

        if (isRemoteNewer) {
          // Normalize user identity
          remoteData.userId = userId;
          localStorage.setItem(masterStorageKey, JSON.stringify(remoteData));

          // Also populate granular scoped storage keys so any component reading them directly is in sync
          try {
            if (Array.isArray(remoteData.routine)) {
              localStorage.setItem(`studyflow_${userId}_routine_slots`, JSON.stringify(remoteData.routine));
            }
            if (Array.isArray(remoteData.exams)) {
              localStorage.setItem(`studyflow_${userId}_exams`, JSON.stringify(remoteData.exams));
            }
            if (Array.isArray(remoteData.skills)) {
              localStorage.setItem(`studyflow_${userId}_skills`, JSON.stringify(remoteData.skills));
            }
            if (Array.isArray(remoteData.subjects)) {
              localStorage.setItem(`studyflow_${userId}_subjects`, JSON.stringify(remoteData.subjects));
            }
            if (remoteData.streak !== undefined) {
              const streakObj = {
                streakCount: Number(remoteData.streak) || 0,
                lastActiveDate: remoteData.lastActiveDate || null,
                todayHours: Number(remoteData.todayLoggedHours) || 0.0,
                dailyTarget: Number(remoteData.dailyTargetHours) || 4.0,
                todayLogDate: remoteData.todayLogDate || new Date().toISOString().split('T')[0],
                weeklyVelocityHours: Number(remoteData.weeklyVelocityHours) || 0.0
              };
              localStorage.setItem(`studyflow_${userId}_streak`, JSON.stringify(streakObj));
            }
          } catch (e) {
            console.warn('Error populating granular keys from cloud:', e);
          }

          // Trigger UI refresh across all active cards (Streak, Daily Target, Routine, Exams, Syllabus)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studyflow-cloud-sync', {
              detail: { action: 'hydrated', source: 'cloud', data: remoteData }
            }));
            window.dispatchEvent(new Event('studyflow-data-changed'));
            window.dispatchEvent(new Event('storage'));
          }

          setSyncStatus('synced', { syncedAt: remoteTime || Date.now() });
          return {
            hydrated: true,
            source: 'remote',
            fileId: existingFile.id,
            data: remoteData
          };
        } else {
          // Local is newer: upload local data to cloud
          debounceSaveToDrive(localData, 100);
          setSyncStatus('synced', { syncedAt: Date.now() });
          return {
            hydrated: false,
            source: 'local_newer',
            fileId: existingFile.id,
            data: localData
          };
        }
      }
    }

    // ==========================================
    // CASE B: File Does Not Exist in Google Drive
    // ==========================================
    let zeroState = getOrCreateZeroStateData(userId) || createZeroStateData(userId);
    zeroState.updatedAt = new Date().toISOString();

    const createdFile = await createSyncFile(accessToken, zeroState);
    setSyncStatus('synced', { syncedAt: Date.now() });

    return {
      hydrated: true,
      source: 'created_zero_state',
      fileId: createdFile.id,
      data: zeroState
    };
  } catch (err) {
    console.error('Cloud hydration error:', err);
    setSyncStatus('offline', { error: err.message });
    return { hydrated: false, error: err.message };
  }
}

/**
 * REAL-TIME DEBOUNCED CLOUD SAVE:
 * - Saves immediately to localStorage for zero UI lag
 * - Attaches ISO updatedAt timestamp
 * - Debounces network call to Google Drive (default 2000ms)
 * - Updates existing Drive file via PATCH with uploadType=media
 * - Handles 401 token expiration silently and retries once
 *
 * @param {Object} studyData Master data document to persist
 * @param {number} delay Debounce delay in ms (default 2000)
 */
export function debounceSaveToDrive(studyData, delay = 2000) {
  if (isDemoUser()) return;
  const activeUserId = getActiveUserId();
  if (!activeUserId || activeUserId === 'guest') return;

  const storageKey = `studyflow_${activeUserId}_data`;
  const nowIso = new Date().toISOString();

  // 1. Save immediately to LocalStorage for ZERO UI LAG
  const payload = {
    ...studyData,
    userId: activeUserId,
    updatedAt: nowIso
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (e) {
    console.error('Immediate localStorage write error:', e);
  }

  // Set transient UI state
  setSyncStatus('syncing');

  // 2. Debounce the Google Drive network request
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    const token = getActiveAccessToken();
    if (!token) {
      setSyncStatus('offline', { reason: 'no_token' });
      return;
    }

    try {
      let fileId = activeFileId;
      if (!fileId && typeof localStorage !== 'undefined') {
        fileId = localStorage.getItem(SYNC_STORAGE_FILE_ID_KEY);
      }

      if (!fileId) {
        // Query Drive to find existing file or create it
        const file = await findSyncFile(token);
        if (file && file.id) {
          fileId = file.id;
        } else {
          const created = await createSyncFile(token, payload);
          fileId = created.id;
        }
      }

      // Update existing file on Drive
      await updateSyncFile(token, fileId, payload);
      setSyncStatus('synced', { syncedAt: Date.now() });
    } catch (err) {
      console.error('Debounced save to Drive failed:', err);
      // Amber warning "Offline - Saved locally"
      setSyncStatus('offline', { error: err.message });
    }
  }, delay);
}

/**
 * Standalone manual sync trigger
 */
export async function syncNow(studyData) {
  if (isDemoUser()) return;
  const token = getActiveAccessToken();
  const userId = getActiveUserId();
  if (!token || !userId || userId === 'guest') {
    setSyncStatus('offline', { reason: 'unauthenticated' });
    return;
  }

  setSyncStatus('syncing');
  try {
    let fileId = activeFileId || localStorage.getItem(SYNC_STORAGE_FILE_ID_KEY);
    if (!fileId) {
      const file = await findSyncFile(token);
      if (file && file.id) {
        fileId = file.id;
      } else {
        const created = await createSyncFile(token, studyData);
        fileId = created.id;
      }
    }

    const payload = {
      ...studyData,
      userId,
      updatedAt: new Date().toISOString()
    };

    await updateSyncFile(token, fileId, payload);
    setSyncStatus('synced', { syncedAt: Date.now() });
  } catch (err) {
    console.error('Manual Drive sync failed:', err);
    setSyncStatus('offline', { error: err.message });
  }
}

export const cloudSyncEngine = {
  SYNC_FILE_NAME,
  findSyncFile,
  downloadSyncFile,
  createSyncFile,
  updateSyncFile,
  hydrateFromCloud,
  debounceSaveToDrive,
  syncNow,
  setSyncStatus,
  getSyncStatus,
  getLastSyncedTimestamp,
  formatRelativeSyncTime
};

export default cloudSyncEngine;
