// Google Drive Direct Client-Side API v3 Service
// Zero-Backend implementation using Google Identity Services (GIS)

import { validateFileBinarySignature } from '../utils/security.js';

export const FOLDER_NAME = 'MyStudyTracker_Data';
export const DATA_FILE_NAME = 'study_data.json';
export const BASIC_AUTH_SCOPES = 'openid email profile';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DEFAULT_GOOGLE_CLIENT_ID = '316205351069-hnmklkhtlbqufp22dm0poqvo6lfjjs1c.apps.googleusercontent.com';
export const DEFAULT_GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

/**
 * Purges legacy or cached expired access tokens in localStorage
 */
export function cleanStorage() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('studyflow_drive_token');
      localStorage.removeItem('google_token_expiry');
      localStorage.removeItem('google_granted_scopes');
    } catch {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const scopes = sessionStorage.getItem('google_granted_scopes');
      if (scopes && scopes.includes('calendar')) {
        sessionStorage.removeItem('google_granted_scopes');
        sessionStorage.removeItem('google_access_token');
        sessionStorage.removeItem('studyflow_drive_token');
        sessionStorage.removeItem('google_token_expiry');
      }
    } catch {}
  }
}

// Auto-clean storage on load
if (typeof window !== 'undefined') {
  cleanStorage();
}

let tokenClientInstance = null;

/**
 * Initializes GIS OAuth2 Token Client
 * @param {string} clientId Google OAuth 2.0 Web Client ID
 * @param {Function} onTokenSuccess Callback with tokenResponse
 * @param {Function} onError Callback with error
 */
export function initGoogleTokenClient(clientId = DEFAULT_GOOGLE_CLIENT_ID, onTokenSuccess, onError, customScope = DEFAULT_GOOGLE_SCOPES) {
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    if (onError) onError(new Error('Google Identity Services SDK not loaded yet.'));
    return null;
  }

  try {
    tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId || DEFAULT_GOOGLE_CLIENT_ID,
      scope: customScope || DEFAULT_GOOGLE_SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          if (tokenResponse.scope && typeof sessionStorage !== 'undefined') {
            const currentScopes = sessionStorage.getItem('google_granted_scopes') || '';
            const combined = `${currentScopes} ${tokenResponse.scope}`.trim();
            sessionStorage.setItem('google_granted_scopes', combined);
          }
          if (onTokenSuccess) onTokenSuccess(tokenResponse);
        } else if (tokenResponse && tokenResponse.error) {
          if (onError) onError(new Error(tokenResponse.error_description || tokenResponse.error));
        }
      },
      error_callback: (err) => {
        if (onError) onError(err);
      }
    });

    return tokenClientInstance;
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Requests an access token by prompting the Google Sign-in popup
 */
export function requestDriveAccessToken() {
  if (!tokenClientInstance) {
    throw new Error('Google Token Client not initialized. Please configure your Client ID first.');
  }
  tokenClientInstance.requestAccessToken({ prompt: 'consent' });
}

/**
 * Silently requests or refreshes Google OAuth access token in the background.
 * Uses GIS `tokenClient.requestAccessToken({ prompt: '' })` without user prompt,
 * storing the token strictly in sessionStorage to prevent premature logouts.
 *
 * @param {string} clientId
 * @returns {Promise<string>} Fresh access token
 */
export async function requestSilentDriveToken(clientId = DEFAULT_GOOGLE_CLIENT_ID) {
  if (typeof window === 'undefined') {
    throw new Error('Silent token request requires a browser window environment.');
  }

  // Ensure GIS is available
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK not loaded yet.');
  }

  return new Promise((resolve, reject) => {
    try {
      const activeClientId = clientId || DEFAULT_GOOGLE_CLIENT_ID;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: DEFAULT_GOOGLE_SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            const expiresIn = Number(tokenResponse.expires_in) || 3600;
            const expiry = Date.now() + expiresIn * 1000;

            // Store strictly in sessionStorage
            sessionStorage.setItem('studyflow_drive_token', token);
            sessionStorage.setItem('google_access_token', token);
            sessionStorage.setItem('google_token_expiry', String(expiry));
            if (tokenResponse.scope) {
              const currentScopes = sessionStorage.getItem('google_granted_scopes') || '';
              const combined = `${currentScopes} ${tokenResponse.scope}`.trim();
              sessionStorage.setItem('google_granted_scopes', combined);
            }

            // Strictly purge any legacy tokens from persistent localStorage
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('studyflow_drive_token');
            localStorage.removeItem('google_token_expiry');

            resolve(token);
          } else {
            const err = new Error(tokenResponse?.error_description || tokenResponse?.error || 'Silent token refresh failed.');
            err.code = 'DRIVE_TOKEN_EXPIRED';
            reject(err);
          }
        },
        error_callback: (err) => {
          const error = new Error(err?.message || 'Silent token renewal request was rejected.');
          error.code = 'DRIVE_TOKEN_EXPIRED';
          reject(error);
        }
      });

      // Execute background token refresh with no prompt
      client.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}

export const NOTES_PARENT_FOLDER_NAME = 'StudyTracker Notes';
export const DRIVE_FOLDER_MAP_KEY = 'study_drive_folder_map';

/**
 * Retrieves the cached folder map from localStorage under 'study_drive_folder_map'
 */
export function getStoredDriveFolderMap() {
  if (typeof localStorage === 'undefined') return { parentFolderId: null, folders: {} };
  try {
    const raw = localStorage.getItem(DRIVE_FOLDER_MAP_KEY);
    if (!raw) return { parentFolderId: null, folders: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (!parsed.folders) parsed.folders = {};
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse study_drive_folder_map:', e);
  }
  return { parentFolderId: null, folders: {} };
}

/**
 * Persists updated folder map to localStorage under 'study_drive_folder_map'
 */
export function saveStoredDriveFolderMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DRIVE_FOLDER_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save study_drive_folder_map:', e);
  }
}

/**
 * Returns Google Drive web link for a subject folder
 */
export function getSubjectFolderLink(subjectName, fallbackFolderId = null) {
  const cleanSubject = (subjectName || 'General').trim() || 'General';
  const map = getStoredDriveFolderMap();
  if (map.folders && map.folders[cleanSubject]?.webViewLink) {
    return map.folders[cleanSubject].webViewLink;
  }
  const folderId = fallbackFolderId || (map.folders && map.folders[cleanSubject]?.id) || map[cleanSubject];
  if (folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }
  if (map.parentFolderId || map.parentId) {
    return map.parentWebViewLink || `https://drive.google.com/drive/folders/${map.parentFolderId || map.parentId}`;
  }
  return null;
}

/**
 * Checks for or creates the dedicated root data folder "MyStudyTracker_Data"
 */
export async function getOrCreateStudyTrackerFolder(accessToken) {
  const query = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query Google Drive: ${errorText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Folder doesn't exist, create it
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create ${FOLDER_NAME} folder: ${errorText}`);
  }

  const folder = await createResponse.json();
  return folder.id;
}

/**
 * Google Drive Folder Check & Reuse Logic for Subject Notes:
 * Step A: Check if a parent folder named "StudyTracker Notes" exists. If not, create it:
 *         POST https://www.googleapis.com/drive/v3/files
 *         Body: { name: "StudyTracker Notes", mimeType: "application/vnd.google-apps.folder" }
 * Step B: Search if a folder for subjectName already exists inside the "StudyTracker Notes" folder:
 *         GET https://www.googleapis.com/drive/v3/files?q=name='${subjectName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false
 * Step C: If found, reuse its existing folder id.
 * Step D: If not found, create a new folder for the subject with parents: [parentFolderId] and return the new id.
 * Cache discovered folder IDs in localStorage under study_drive_folder_map to prevent redundant API queries.
 *
 * @param {string} accessToken Active Google OAuth access token
 * @param {string} subjectName Name of target subject (e.g. 'Python', 'Mathematics')
 * @returns {Promise<string>} Target Subject Folder ID
 */
export async function getOrCreateSubjectFolder(accessToken, subjectName = 'General') {
  const cleanSubject = (subjectName || 'General').trim() || 'General';
  const map = getStoredDriveFolderMap();

  // Check cache first to prevent redundant API queries
  if (map.folders && map.folders[cleanSubject]?.id) {
    return map.folders[cleanSubject].id;
  }
  if (map[cleanSubject] && typeof map[cleanSubject] === 'string') {
    return map[cleanSubject];
  }

  // Step A: Check if parent folder named "StudyTracker Notes" exists. If not, create it
  let parentFolderId = map.parentFolderId || map.parentId;
  let parentWebViewLink = map.parentWebViewLink;

  if (!parentFolderId) {
    const parentQuery = encodeURIComponent(`name='${NOTES_PARENT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const listParentUrl = `https://www.googleapis.com/drive/v3/files?q=${parentQuery}&fields=files(id,name,webViewLink)`;

    const parentListRes = await fetch(listParentUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (parentListRes.ok) {
      const parentData = await parentListRes.json();
      if (parentData.files && parentData.files.length > 0) {
        parentFolderId = parentData.files[0].id;
        parentWebViewLink = parentData.files[0].webViewLink || `https://drive.google.com/drive/folders/${parentFolderId}`;
      }
    }

    if (!parentFolderId) {
      // Create parent folder "StudyTracker Notes"
      const createParentUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink';
      const createParentRes = await fetch(createParentUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: NOTES_PARENT_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (!createParentRes.ok) {
        const errText = await createParentRes.text();
        throw new Error(`Failed to create "${NOTES_PARENT_FOLDER_NAME}" parent folder: ${errText}`);
      }

      const createdParent = await createParentRes.json();
      parentFolderId = createdParent.id;
      parentWebViewLink = createdParent.webViewLink || `https://drive.google.com/drive/folders/${parentFolderId}`;
    }

    map.parentFolderId = parentFolderId;
    map.parentId = parentFolderId;
    map.parentWebViewLink = parentWebViewLink;
    saveStoredDriveFolderMap(map);
  }

  // Step B: Search if a folder for subjectName already exists inside the "StudyTracker Notes" folder
  const escapedSubject = cleanSubject.replace(/'/g, "\\'");
  const subjectQuery = encodeURIComponent(`name='${escapedSubject}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`);
  const listSubjectUrl = `https://www.googleapis.com/drive/v3/files?q=${subjectQuery}&fields=files(id,name,webViewLink)`;

  const subjectListRes = await fetch(listSubjectUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  let targetFolderId = null;
  let targetWebViewLink = null;

  if (subjectListRes.ok) {
    const subjectData = await subjectListRes.json();
    // Step C: If found, reuse its existing folder id
    if (subjectData.files && subjectData.files.length > 0) {
      targetFolderId = subjectData.files[0].id;
      targetWebViewLink = subjectData.files[0].webViewLink || `https://drive.google.com/drive/folders/${targetFolderId}`;
    }
  }

  // Step D: If not found, create a new folder for the subject with parents: [parentFolderId] and return the new id
  if (!targetFolderId) {
    const createSubjectUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink';
    const createSubjectRes = await fetch(createSubjectUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: cleanSubject,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });

    if (!createSubjectRes.ok) {
      const errText = await createSubjectRes.text();
      throw new Error(`Failed to create subject folder "${cleanSubject}": ${errText}`);
    }

    const createdSubject = await createSubjectRes.json();
    targetFolderId = createdSubject.id;
    targetWebViewLink = createdSubject.webViewLink || `https://drive.google.com/drive/folders/${targetFolderId}`;
  }

  // Cache discovered folder IDs in localStorage under study_drive_folder_map
  const currentMap = getStoredDriveFolderMap();
  currentMap.parentFolderId = parentFolderId;
  currentMap.parentId = parentFolderId;
  currentMap.parentWebViewLink = parentWebViewLink;
  if (!currentMap.folders) currentMap.folders = {};
  currentMap.folders[cleanSubject] = {
    id: targetFolderId,
    name: cleanSubject,
    webViewLink: targetWebViewLink
  };
  currentMap[cleanSubject] = targetFolderId;
  saveStoredDriveFolderMap(currentMap);

  return targetFolderId;
}

/**
 * Serializes and saves entire study tracker state to study_data.json on Google Drive
 */
export async function saveStudyDataToDrive(accessToken, folderId, studyData) {
  const query = encodeURIComponent(`name = '${DATA_FILE_NAME}' and '${folderId}' in parents and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const contentJson = JSON.stringify(studyData, null, 2);

  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
      // Update existing file
      const fileId = listData.files[0].id;
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const updateRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: contentJson
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update study_data.json on Drive');
      }
      return { fileId, updated: true };
    }
  }

  // Create new study_data.json using multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: DATA_FILE_NAME,
    parents: [folderId],
    mimeType: 'application/json'
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    contentJson +
    closeDelimiter;

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const createRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create study_data.json on Drive: ${err}`);
  }

  const newFile = await createRes.json();
  return { fileId: newFile.id, created: true };
}

/**
 * Loads study_data.json from Google Drive folder
 */
export async function loadStudyDataFromDrive(accessToken, folderId) {
  const query = encodeURIComponent(`name = '${DATA_FILE_NAME}' and '${folderId}' in parents and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) return null;
  const listData = await listRes.json();
  if (!listData.files || listData.files.length === 0) return null;

  const fileId = listData.files[0].id;
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!downloadRes.ok) return null;
  return await downloadRes.json();
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB limit
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.txt'];
export const BLOCKED_EXECUTABLE_EXTENSIONS = [
  '.exe', '.bat', '.sh', '.cmd', '.js', '.mjs', '.cjs', '.vbs', '.ps1',
  '.com', '.scr', '.msi', '.jar', '.apk', '.bin', '.app', '.dmg', '.php',
  '.py', '.dll', '.so', '.dylib', '.cgi', '.pl'
];

/**
 * Validates uploaded file size, declared extension, and binary magic-byte signatures.
 * Disallows all SVG, HTML, and executable binary uploads.
 * Rejects files if binary headers do not match declared extensions.
 */
export async function validateUploadedFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }

  // 1. Enforce 25MB file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${sizeMb} MB) exceeds the maximum allowed limit of 25MB.`);
  }

  const lowerName = (file.name || '').toLowerCase();

  // 2. Disallow SVG and HTML explicitly
  if (
    lowerName.endsWith('.svg') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.xhtml') ||
    file.type === 'image/svg+xml' ||
    file.type.includes('html')
  ) {
    throw new Error('Upload rejected: SVG and HTML files are strictly disallowed for security.');
  }

  // 3. Reject executable file extensions explicitly
  const isExecutable = BLOCKED_EXECUTABLE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  if (isExecutable) {
    throw new Error('Upload rejected: Executable and script files are strictly prohibited.');
  }

  // 4. Restrict accepted file types to PDF, Images (PNG, JPG), TXT, and DOCX
  const isAllowedExt = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  const isAllowedMime =
    file.type === 'application/pdf' ||
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'text/plain' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword';

  if (!isAllowedExt && !isAllowedMime) {
    throw new Error('Invalid file type. Only PDF documents, Images (PNG, JPG), TXT, and DOCX files are permitted.');
  }

  // 5. Binary magic-byte header validation (FileReader + Uint8Array)
  await validateFileBinarySignature(file);

  return true;
}

/**
 * Uploads a PDF or Image file directly to Google Drive using Drive v3 multipart upload API
 */
export async function uploadFileToDriveFolder(accessToken, folderId, file) {
  // Validate file size, type, and binary magic-byte signatures
  await validateUploadedFile(file);

  const boundary = '-------StudyTrackerDriveUpload' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const targetFolderId = typeof folderId === 'object' && folderId?.id ? folderId.id : folderId;

  const metadata = {
    name: file.name,
    mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
  };
  if (targetFolderId) {
    metadata.parents = [String(targetFolderId)];
  }

  const metadataPart = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    `Content-Type: ${metadata.mimeType}\r\n\r\n`
  ], { type: 'application/octet-stream' });

  const closePart = new Blob([closeDelimiter], { type: 'application/octet-stream' });

  // Stream file directly in multipart body without allocating entire buffer
  const multipartBlob = new Blob([metadataPart, file, closePart]);

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,mimeType,parents';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBlob
  });

  if (response.status === 401) {
    try {
      sessionStorage.removeItem('studyflow_drive_token');
      sessionStorage.removeItem('google_access_token');
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('studyflow_drive_token');
    } catch {}
    const err = new Error('Google Drive authorization expired (401). Please renew access.');
    err.code = 'DRIVE_TOKEN_EXPIRED';
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive File Upload failed (${response.status}): ${errorText}`);
  }

  const uploadedMeta = await response.json();
  return {
    id: uploadedMeta.id,
    name: uploadedMeta.name || file.name,
    webViewLink: uploadedMeta.webViewLink || `https://drive.google.com/file/d/${uploadedMeta.id}/view`,
    webContentLink: uploadedMeta.webContentLink,
    size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
    type: (file.type && file.type.includes('pdf')) || file.name.endsWith('.pdf') ? 'pdf' : 'image',
    mimeType: file.type || 'application/octet-stream',
    parents: uploadedMeta.parents || (targetFolderId ? [String(targetFolderId)] : []),
    uploadedAt: new Date().toISOString()
  };
}

/**
 * Direct client-side upload helper with silent background token refresh.
 * Fetches stored token strictly from sessionStorage. If expired or authorization is required,
 * triggers silent background token refresh without logging out the user.
 * Automatically organizes files into Subject Folders inside "StudyTracker Notes".
 *
 * @param {File} file File to upload
 * @param {string} subjectName Target subject folder name (e.g. 'Python', 'Mathematics')
 * @returns {Promise<Object>} Uploaded file metadata
 */
export async function uploadDirectToDrive(file, subjectName = 'General') {
  // Purge any legacy token from localStorage to guarantee compliance
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('studyflow_drive_token');
    localStorage.removeItem('google_token_expiry');
  } catch {}

  let token = sessionStorage.getItem('studyflow_drive_token') || sessionStorage.getItem('google_access_token');
  const expiry = sessionStorage.getItem('google_token_expiry');
  const isExpired = !token || (expiry && Date.now() > Number(expiry));

  // If token is missing or expired, attempt silent background refresh
  if (isExpired) {
    try {
      token = await requestSilentDriveToken();
    } catch (silentErr) {
      const err = new Error('Google Drive authorization required. Please authorize Google Drive.');
      err.code = 'DRIVE_TOKEN_EXPIRED';
      throw err;
    }
  }

  const cleanSubject = (subjectName || 'General').trim() || 'General';

  // Ensure target subject folder exists in Google Drive > StudyTracker Notes > [cleanSubject]
  let targetFolderId = null;
  try {
    targetFolderId = await getOrCreateSubjectFolder(token, cleanSubject);
  } catch (folderErr) {
    console.warn(`Could not ensure subject folder for "${cleanSubject}", falling back to root/default:`, folderErr);
  }

  // Attempt upload; if 401 occurs, attempt silent background refresh and retry once
  try {
    const uploaded = await uploadFileToDriveFolder(token, targetFolderId, file);
    uploaded.subject = cleanSubject;
    uploaded.folderId = targetFolderId;
    uploaded.folderLink = getSubjectFolderLink(cleanSubject, targetFolderId);
    return uploaded;
  } catch (uploadErr) {
    if (uploadErr?.code === 'DRIVE_TOKEN_EXPIRED' || uploadErr?.message?.includes('401')) {
      try {
        const refreshedToken = await requestSilentDriveToken();
        const refreshedFolderId = await getOrCreateSubjectFolder(refreshedToken, cleanSubject);
        const uploaded = await uploadFileToDriveFolder(refreshedToken, refreshedFolderId, file);
        uploaded.subject = cleanSubject;
        uploaded.folderId = refreshedFolderId;
        uploaded.folderLink = getSubjectFolderLink(cleanSubject, refreshedFolderId);
        return uploaded;
      } catch (refreshErr) {
        throw uploadErr;
      }
    }
    throw uploadErr;
  }
}
