/**
 * Multi-Device Cloud Synchronization Engine (cloud-sync.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Background sync between LocalStorage and Google Drive (drive.file scope)
 * 2. Sync file identifier: studyflow_user_data.json
 * 3. Mobile Google Drive Token Verification & Auto-Reauthorization:
 *    - Verifies Google OAuth access_token with drive.file scope on mobile login and page loads
 *    - Calls tokenClient.requestAccessToken({ prompt: '' }) silently, or prompts user if consent is needed
 * 4. Auto-Hydrate from Drive Before Rendering:
 *    - Queries GET https://www.googleapis.com/drive/v3/files?q=name='studyflow_user_data.json' and trashed=false&fields=files(id, name, modifiedTime)
 *    - Downloads GET https://www.googleapis.com/drive/v3/files/${fileId}?alt=media
 *    - Writes directly to studyflow_${userId}_data in localStorage without overwriting cloud data with an empty local zero-state
 *    - Initializes zero-state only if cloud file does not exist
 * 5. Explicit "Sync Cloud Data" / "☁️ Sync Now" bidirectional synchronization:
 *    - Uploads local laptop data if newer, or downloads cloud data if phone is missing data
 * 6. UI Header status badges: "Syncing...", "Synced" / "Drive Synced", "Click to Authorize Drive", and "Offline - Saved locally"
 */

import { 
  requestSilentDriveToken, 
  DEFAULT_GOOGLE_CLIENT_ID, 
  DEFAULT_GOOGLE_SCOPES 
} from './src/services/googleDrive.js';
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
let currentSyncStatus = 'offline'; // 'offline' | 'syncing' | 'synced' | 'needs_auth' | 'error'
let lastSyncedTimestamp = null;
let debounceTimer = null;

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
 * Checks whether an active access token exists and is not expired
 */
export function isAccessTokenValid(token) {
  if (!token) return false;
  if (typeof window === 'undefined') return true;
  try {
    const expiry = sessionStorage.getItem('google_token_expiry');
    if (expiry && Date.now() >= Number(expiry)) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Mobile Google Drive Token Verification & Auto-Reauthorization:
 * - Checks whether a valid Google OAuth access_token exists with drive.file scope.
 * - If missing or expired:
 *   Calls tokenClient.requestAccessToken({ prompt: '' }) silently, or prompts user if consent is needed.
 */
export async function verifyOrRequestDriveToken({ promptUserIfConsentNeeded = false, clientId = DEFAULT_GOOGLE_CLIENT_ID } = {}) {
  let token = getActiveAccessToken();
  const valid = isAccessTokenValid(token);

  if (token && valid) {
    return token;
  }

  // Missing or expired token on mobile: Attempt silent reauthorization first
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    try {
      token = await requestSilentDriveToken(clientId);
      if (token) {
        setSyncStatus('synced');
        return token;
      }
    } catch (silentErr) {
      console.warn('Silent Drive token reauthorization failed on mobile:', silentErr);
    }

    // If silent renewal fails and user interaction is permitted (or needed for consent)
    if (promptUserIfConsentNeeded) {
      return new Promise((resolve) => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId || DEFAULT_GOOGLE_CLIENT_ID,
            scope: DEFAULT_GOOGLE_SCOPES,
            callback: (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                const freshToken = tokenResponse.access_token;
                const expiresIn = Number(tokenResponse.expires_in) || 3600;
                const expiry = Date.now() + expiresIn * 1000;

                sessionStorage.setItem('studyflow_drive_token', freshToken);
                sessionStorage.setItem('google_access_token', freshToken);
                sessionStorage.setItem('google_token_expiry', String(expiry));

                setSyncStatus('synced');
                resolve(freshToken);
              } else {
                setSyncStatus('needs_auth');
                resolve(null);
              }
            },
            error_callback: () => {
              setSyncStatus('needs_auth');
              resolve(null);
            }
          });

          client.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
          console.warn('Interactive Drive authorization failed:', e);
          setSyncStatus('needs_auth');
          resolve(null);
        }
      });
    } else {
      setSyncStatus('needs_auth');
      return null;
    }
  }

  setSyncStatus('needs_auth');
  return null;
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
 * GET https://www.googleapis.com/drive/v3/files?q=name='studyflow_user_data.json' and trashed=false&fields=files(id, name, modifiedTime)
 */
export async function findSyncFile(accessToken) {
  if (!accessToken) return null;
  const query = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,parents)`;

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
    setSyncStatus('needs_auth', { reason: 'token_expired' });
    return null;
  }
}

/**
 * Populates granular scoped storage keys so any component reading them directly is in sync
 */
export function populateGranularStorage(userId, data) {
  if (!userId || !data || typeof localStorage === 'undefined') return;
  try {
    if (Array.isArray(data.routine)) {
      localStorage.setItem(`studyflow_${userId}_routine_slots`, JSON.stringify(data.routine));
    }
    if (Array.isArray(data.exams)) {
      localStorage.setItem(`studyflow_${userId}_exams`, JSON.stringify(data.exams));
    }
    if (Array.isArray(data.skills)) {
      localStorage.setItem(`studyflow_${userId}_skills`, JSON.stringify(data.skills));
    }
    if (Array.isArray(data.subjects)) {
      localStorage.setItem(`studyflow_${userId}_subjects`, JSON.stringify(data.subjects));
    }
    if (Array.isArray(data.weeklyGoals)) {
      localStorage.setItem(`studyflow_${userId}_weekly_goals`, JSON.stringify(data.weeklyGoals));
    }
    if (Array.isArray(data.notes)) {
      localStorage.setItem(`studyflow_${userId}_notes`, JSON.stringify(data.notes));
    }
    if (Array.isArray(data.tomorrowPlan)) {
      localStorage.setItem(`studyflow_${userId}_tomorrow_plan`, JSON.stringify(data.tomorrowPlan));
    }
    if (data.dailyActivity && typeof data.dailyActivity === 'object') {
      localStorage.setItem(`studyflow_${userId}_daily_activity`, JSON.stringify(data.dailyActivity));
    }
    if (data.streak !== undefined || data.todayLoggedHours !== undefined) {
      const streakObj = {
        streakCount: Number(data.streak) || 0,
        lastActiveDate: data.lastActiveDate || null,
        todayHours: Number(data.todayLoggedHours) || 0.0,
        dailyTarget: Number(data.dailyTargetHours) || 4.0,
        todayLogDate: data.todayLogDate || new Date().toISOString().split('T')[0],
        weeklyVelocityHours: Number(data.weeklyVelocityHours) || 0.0
      };
      localStorage.setItem(`studyflow_${userId}_streak`, JSON.stringify(streakObj));
    }
  } catch (e) {
    console.warn('Error populating granular storage keys from cloud:', e);
  }
}

/**
 * Dispatches sync events to notify UI across all tabs
 */
export function dispatchSyncEvents(data) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('studyflow-cloud-sync', {
    detail: { action: 'hydrated', source: 'cloud', data }
  }));
  window.dispatchEvent(new Event('studyflow-data-changed'));
  window.dispatchEvent(new Event('storage'));
}
 
/**
 * SAFE CLOUD SYNC MERGING:
 * When pulling studyflow_user_data.json from Google Drive during login or sync:
 * - Compares timestamps (remote.updatedAt vs local.updatedAt).
 * - Merges the two datasets key-by-key rather than clobbering local storage blindly.
 * - Preserves whichever side has the higher streak.
 * - Preserves the union of all dailyActivity dates (taking max minutes for any overlap).
 * - Preserves non-empty section arrays (subjects, routine, skills, exams, notes, weeklyGoals).
 *
 * @param {Object} remoteData Remote dataset from Google Drive
 * @param {Object} localData Local dataset from LocalStorage
 * @returns {Object} Non-destructively merged dataset
 */
export function mergeCloudAndLocalData(remoteData = {}, localData = {}) {
  const remoteTime = remoteData?.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
  const localTime = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
  const isRemoteNewer = remoteTime >= localTime;

  // Primary dataset is the newer one; secondary supplies missing / older records
  const primary = isRemoteNewer ? (remoteData || {}) : (localData || {});
  const secondary = isRemoteNewer ? (localData || {}) : (remoteData || {});

  // 1. Daily Activity: UNION of all dates, taking max minutes studied for any matching date
  const mergedDailyActivity = {};
  const allDates = new Set([
    ...Object.keys(localData?.dailyActivity || {}),
    ...Object.keys(remoteData?.dailyActivity || {})
  ]);
  for (const date of allDates) {
    const minLocal = Number(localData?.dailyActivity?.[date] || 0);
    const minRemote = Number(remoteData?.dailyActivity?.[date] || 0);
    mergedDailyActivity[date] = Math.max(minLocal, minRemote);
  }

  // 2. Streak: Preserves whichever side has the higher streak
  const streakLocal = Number(localData?.streak ?? 0);
  const streakRemote = Number(remoteData?.streak ?? 0);
  const higherStreak = Math.max(streakLocal, streakRemote);

  // 3. Today Logged Hours: If on same log date, preserve max; else use the newer date's logged hours
  const localLogDate = localData?.todayLogDate;
  const remoteLogDate = remoteData?.todayLogDate;
  let todayLoggedHours = primary.todayLoggedHours !== undefined 
    ? Number(primary.todayLoggedHours) 
    : (secondary.todayLoggedHours !== undefined ? Number(secondary.todayLoggedHours) : 0.0);
  if (localLogDate && remoteLogDate && localLogDate === remoteLogDate) {
    todayLoggedHours = Math.max(Number(localData.todayLoggedHours || 0), Number(remoteData.todayLoggedHours || 0));
  }

  // 4. Arrays (subjects, routine, skills, exams, notes, weeklyGoals):
  // Preserve from primary if non-empty, otherwise take secondary
  const mergeArray = (key) => {
    const pArr = Array.isArray(primary[key]) ? primary[key] : [];
    const sArr = Array.isArray(secondary[key]) ? secondary[key] : [];
    if (pArr.length > 0) return pArr;
    return sArr;
  };

  const merged = {
    ...secondary,
    ...primary,
    dailyActivity: mergedDailyActivity,
    streak: higherStreak,
    todayLoggedHours: todayLoggedHours,
    subjects: mergeArray('subjects'),
    routine: mergeArray('routine'),
    skills: mergeArray('skills'),
    exams: mergeArray('exams'),
    notes: mergeArray('notes'),
    weeklyGoals: mergeArray('weeklyGoals'),
    updatedAt: new Date(Math.max(remoteTime, localTime, Date.now())).toISOString()
  };

  return merged;
}

/**
 * AUTO-HYDRATE FROM DRIVE BEFORE RENDERING (MULTI-DEVICE RESTORATION)
 *
 * When any page loads or upon Google sign-in:
 * 1. Query Google Drive API:
 *    GET https://www.googleapis.com/drive/v3/files?q=name='studyflow_user_data.json' and trashed=false&fields=files(id, name, modifiedTime)
 * 2. If studyflow_user_data.json exists in Drive:
 *    - Download the file content: GET https://www.googleapis.com/drive/v3/files/${fileId}?alt=media
 *    - Key-by-key non-destructive merge: preserves higher streak & union of dailyActivity dates
 *    - Parse JSON and write directly to studyflow_${userId}_data in localStorage.
 *    - Do NOT overwrite cloud data with an empty local zero-state.
 * 3. If file does NOT exist, only then initialize the zero-state.
 *
 * @param {string} accessToken Active Google Drive OAuth token
 * @param {string} userId Unique Google user subject ID (user.sub)
 * @returns {Promise<Object>} Hydration result
 */
export async function hydrateFromCloud(accessToken, userId) {
  if (!userId || userId === 'guest') {
    return { hydrated: false, reason: 'unauthenticated' };
  }
  if (isDemoUser() || userId === 'demo_sandbox_user') {
    return { hydrated: false, reason: 'demo_user' };
  }

  let token = accessToken || getActiveAccessToken();
  if (!token) {
    token = await verifyOrRequestDriveToken();
  }
  if (!token) {
    setSyncStatus('needs_auth');
    return { hydrated: false, reason: 'needs_auth' };
  }

  const masterStorageKey = `studyflow_${userId}_data`;
  setSyncStatus('syncing');

  try {
    // 1. Query Google Drive API v3
    const existingFile = await findSyncFile(token);

    if (existingFile && existingFile.id) {
      // ==========================================
      // CASE A: File Exists in Google Drive
      // ==========================================
      const remoteData = await downloadSyncFile(token, existingFile.id);

      if (remoteData && typeof remoteData === 'object') {
        let localData = null;
        try {
          const raw = localStorage.getItem(masterStorageKey);
          if (raw) localData = JSON.parse(raw);
        } catch {}

        const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
        const localTime = localData && localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

        // Key-by-key safe merge: preserves higher streak & union of dailyActivity dates
        const mergedData = mergeCloudAndLocalData(remoteData, localData);
        mergedData.userId = userId;

        // Populate local storage with merged state
        localStorage.setItem(masterStorageKey, JSON.stringify(mergedData));
        populateGranularStorage(userId, mergedData);
        dispatchSyncEvents(mergedData);

        // Check if phone or local device has empty or unpopulated data
        const isLocalZeroOrEmpty = !localData || 
          (!localData.subjects?.length && (remoteData.subjects?.length > 0)) ||
          (!localData.routine?.length && (remoteData.routine?.length > 0)) ||
          (!localData.skills?.length && (remoteData.skills?.length > 0)) ||
          (!localData.exams?.length && (remoteData.exams?.length > 0));

        // Do NOT overwrite cloud data with an empty local zero-state.
        const shouldHydrateRemote = isLocalZeroOrEmpty || remoteTime >= localTime || !localTime;

        if (shouldHydrateRemote) {
          // If local had a higher streak or extra dailyActivity dates, push merged state back to Drive
          const localHasExtra = (Number(localData?.streak || 0) > Number(remoteData.streak || 0)) ||
            (localData?.dailyActivity && Object.keys(localData.dailyActivity).some(k => !remoteData.dailyActivity?.[k]));
          if (localHasExtra) {
            debounceSaveToDrive(mergedData, 100);
          }
          setSyncStatus('synced', { syncedAt: remoteTime || Date.now() });

          return {
            hydrated: true,
            source: 'remote',
            fileId: existingFile.id,
            data: mergedData
          };
        } else {
          // Local laptop data is genuinely newer: upload merged data to cloud
          debounceSaveToDrive(mergedData, 100);
          setSyncStatus('synced', { syncedAt: Date.now() });
          return {
            hydrated: false,
            source: 'local_newer',
            fileId: existingFile.id,
            data: mergedData
          };
        }
      }
    }

    // ==========================================
    // CASE B: File Does Not Exist in Google Drive
    // Only then initialize the zero-state
    // ==========================================
    let zeroState = getOrCreateZeroStateData(userId) || createZeroStateData(userId);
    zeroState.userId = userId;
    zeroState.updatedAt = new Date().toISOString();
    localStorage.setItem(masterStorageKey, JSON.stringify(zeroState));
    populateGranularStorage(userId, zeroState);

    const createdFile = await createSyncFile(token, zeroState);
    setSyncStatus('synced', { syncedAt: Date.now() });

    return {
      hydrated: true,
      source: 'created_zero_state',
      fileId: createdFile.id,
      data: zeroState
    };
  } catch (err) {
    console.error('Cloud hydration error:', err);
    if (err.message === 'UNAUTHORIZED_DRIVE_TOKEN') {
      setSyncStatus('needs_auth');
    } else {
      setSyncStatus('offline', { error: err.message });
    }
    return { hydrated: false, error: err.message };
  }
}

/**
 * REAL-TIME DEBOUNCED CLOUD SAVE:
 * - Saves immediately to localStorage for zero UI lag
 * - Attaches ISO updatedAt timestamp
 * - Debounces network call to Google Drive (default 2000ms)
 * - Updates existing Drive file via PATCH with uploadType=media
 */
export function debounceSaveToDrive(studyData, delay = 2000) {
  if (isDemoUser()) return;
  const activeUserId = getActiveUserId();
  if (!activeUserId || activeUserId === 'guest') return;

  const storageKey = `studyflow_${activeUserId}_data`;
  const nowIso = new Date().toISOString();

  // 1. Save immediately to LocalStorage for zero UI lag
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

  setSyncStatus('syncing');

  // 2. Debounce the Google Drive network request
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    let token = getActiveAccessToken();
    if (!token) {
      token = await verifyOrRequestDriveToken();
    }
    if (!token) {
      setSyncStatus('needs_auth', { reason: 'no_token' });
      return;
    }

    try {
      let fileId = activeFileId;
      if (!fileId && typeof localStorage !== 'undefined') {
        fileId = localStorage.getItem(SYNC_STORAGE_FILE_ID_KEY);
      }

      if (!fileId) {
        const file = await findSyncFile(token);
        if (file && file.id) {
          fileId = file.id;
        } else {
          const created = await createSyncFile(token, payload);
          fileId = created.id;
        }
      }

      await updateSyncFile(token, fileId, payload);
      setSyncStatus('synced', { syncedAt: Date.now() });
    } catch (err) {
      console.error('Debounced save to Drive failed:', err);
      if (err.message === 'UNAUTHORIZED_DRIVE_TOKEN') {
        setSyncStatus('needs_auth');
      } else {
        setSyncStatus('offline', { error: err.message });
      }
    }
  }, delay);
}

/**
 * EXPLICIT BIDIRECTIONAL "SYNC CLOUD DATA" (☁️ Sync Now)
 *
 * Forces bidirectional sync between local and Google Drive:
 * - Reads cloud file modifiedTime and local data updatedAt.
 * - Uploads local laptop data if newer.
 * - Downloads cloud data if phone or local device is missing data.
 * - Updates the "Drive Synced" badge to "Syncing...", "Synced", or "Click to Authorize Drive".
 *
 * @param {Object} customStudyData Optional override data
 * @returns {Promise<Object>} Sync result
 */
export async function forceBidirectionalSync(customStudyData = null, customUserId = null) {
  if (isDemoUser()) return { success: false, reason: 'demo_user' };
  const userId = customUserId || getActiveUserId();
  if (!userId || userId === 'guest') {
    setSyncStatus('offline', { reason: 'unauthenticated' });
    return { success: false, reason: 'unauthenticated' };
  }

  setSyncStatus('syncing');

  // Verify token or trigger interactive prompt if authorization is missing
  let token = getActiveAccessToken();
  if (!token || !isAccessTokenValid(token)) {
    token = await verifyOrRequestDriveToken({ promptUserIfConsentNeeded: true });
  }

  if (!token) {
    setSyncStatus('needs_auth');
    return { success: false, reason: 'needs_auth' };
  }

  const masterStorageKey = `studyflow_${userId}_data`;
  let localData = customStudyData;
  if (!localData && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(masterStorageKey);
      if (raw) localData = JSON.parse(raw);
    } catch {}
  }

  try {
    const existingFile = await findSyncFile(token);

    if (existingFile && existingFile.id) {
      const remoteData = await downloadSyncFile(token, existingFile.id);
      if (remoteData && typeof remoteData === 'object') {
        const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
        const localTime = localData && localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

        // Key-by-key safe merge: preserves higher streak & union of dailyActivity dates
        const mergedData = mergeCloudAndLocalData(remoteData, localData);
        mergedData.userId = userId;

        localStorage.setItem(masterStorageKey, JSON.stringify(mergedData));
        populateGranularStorage(userId, mergedData);
        dispatchSyncEvents(mergedData);

        // Always update Drive with the merged data if local had changes or streak/dates were merged
        await updateSyncFile(token, existingFile.id, mergedData);
        setSyncStatus('synced', { syncedAt: Date.now() });

        const isLocalMissingData = !localData || 
          (!localData.subjects?.length && remoteData.subjects?.length) ||
          (!localData.routine?.length && remoteData.routine?.length) ||
          (!localData.skills?.length && remoteData.skills?.length) ||
          (!localData.exams?.length && remoteData.exams?.length);

        if (isLocalMissingData || remoteTime >= localTime) {
          return { success: true, action: 'downloaded', data: mergedData };
        } else {
          return { success: true, action: 'uploaded', data: mergedData };
        }
      }
    }

    // Cloud file doesn't exist yet -> upload local data or initialize zero-state
    const payload = localData || getOrCreateZeroStateData(userId) || createZeroStateData(userId);
    payload.userId = userId;
    payload.updatedAt = new Date().toISOString();
    localStorage.setItem(masterStorageKey, JSON.stringify(payload));
    const created = await createSyncFile(token, payload);
    setSyncStatus('synced', { syncedAt: Date.now() });
    return { success: true, action: 'created', fileId: created.id, data: payload };
  } catch (err) {
    console.error('Bidirectional sync error:', err);
    if (err.message === 'UNAUTHORIZED_DRIVE_TOKEN') {
      setSyncStatus('needs_auth');
    } else {
      setSyncStatus('offline', { error: err.message });
    }
    return { success: false, error: err.message };
  }
}

/**
 * Standalone manual sync trigger (alias for forceBidirectionalSync)
 */
export async function syncNow(studyData) {
  return forceBidirectionalSync(studyData);
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
  forceBidirectionalSync,
  verifyOrRequestDriveToken,
  setSyncStatus,
  getSyncStatus,
  getLastSyncedTimestamp,
  formatRelativeSyncTime,
  populateGranularStorage,
  dispatchSyncEvents
};

export default cloudSyncEngine;
