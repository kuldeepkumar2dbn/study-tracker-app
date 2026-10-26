// Google Drive Direct Client-Side API v3 Service
// Zero-Backend implementation using Google Identity Services (GIS)

import { validateFileBinarySignature } from '../utils/security.js';

export const FOLDER_NAME = 'MyStudyTracker_Data';
export const DATA_FILE_NAME = 'study_data.json';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DEFAULT_GOOGLE_CLIENT_ID = '316205351069-hnmklkhtlbqufp22dm0poqvo6lfjjs1c.apps.googleusercontent.com';
export const DEFAULT_GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

let tokenClientInstance = null;

/**
 * Initializes GIS OAuth2 Token Client
 * @param {string} clientId Google OAuth 2.0 Web Client ID
 * @param {Function} onTokenSuccess Callback with tokenResponse
 * @param {Function} onError Callback with error
 */
export function initGoogleTokenClient(clientId = DEFAULT_GOOGLE_CLIENT_ID, onTokenSuccess, onError) {
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    if (onError) onError(new Error('Google Identity Services SDK not loaded yet.'));
    return null;
  }

  try {
    tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId || DEFAULT_GOOGLE_CLIENT_ID,
      scope: DEFAULT_GOOGLE_SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
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

/**
 * Checks for or creates the dedicated folder "MyStudyTracker_Data"
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

  const metadata = {
    name: file.name,
    mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
  };
  if (folderId) {
    metadata.parents = [folderId];
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

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,mimeType';
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
    uploadedAt: new Date().toISOString()
  };
}

/**
 * Direct client-side upload helper with silent background token refresh.
 * Fetches stored token strictly from sessionStorage. If expired or authorization is required,
 * triggers silent background token refresh without logging out the user.
 */
export async function uploadDirectToDrive(file) {
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

  let folderId = localStorage.getItem('studyflow_drive_folder_id');
  if (!folderId) {
    try {
      folderId = await getOrCreateStudyTrackerFolder(token);
      if (folderId) {
        localStorage.setItem('studyflow_drive_folder_id', folderId);
      }
    } catch (e) {
      console.warn('Could not ensure MyStudyTracker_Data folder, uploading to root:', e);
    }
  }

  // Attempt upload; if 401 occurs, attempt silent background refresh and retry once
  try {
    return await uploadFileToDriveFolder(token, folderId, file);
  } catch (uploadErr) {
    if (uploadErr?.code === 'DRIVE_TOKEN_EXPIRED' || uploadErr?.message?.includes('401')) {
      try {
        const refreshedToken = await requestSilentDriveToken();
        return await uploadFileToDriveFolder(refreshedToken, folderId, file);
      } catch (refreshErr) {
        throw uploadErr;
      }
    }
    throw uploadErr;
  }
}
