/**
 * Google OAuth2 & Identity Services Helper (google-auth.js)
 * Clean OAuth Configuration decoupled from sensitive scopes
 *
 * Scopes:
 * - Basic Auth (Login): 'openid email profile' (Non-sensitive, no verification warnings)
 * - Drive Storage (Sync): 'https://www.googleapis.com/auth/drive.file' (Incremental consent only)
 */

import { 
  DEFAULT_GOOGLE_CLIENT_ID, 
  DRIVE_FILE_SCOPE, 
  BASIC_AUTH_SCOPES,
  DEFAULT_GOOGLE_SCOPES,
  initGoogleTokenClient,
  cleanStorage 
} from './src/services/googleDrive.js';
import { getActiveAccessToken } from './cloud-sync.js';

export { 
  DEFAULT_GOOGLE_CLIENT_ID, 
  DRIVE_FILE_SCOPE, 
  BASIC_AUTH_SCOPES,
  DEFAULT_GOOGLE_SCOPES,
  initGoogleTokenClient,
  cleanStorage 
};

export const SCOPES_STORAGE_KEY = 'google_granted_scopes';

/**
 * Parses JWT payload from Google Identity Services credential response (One-Tap / Sign-In Button)
 * @param {string} token JWT token string
 * @returns {Object|null} Decoded JSON payload
 */
export function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Retrieves the space-separated list of currently granted OAuth scopes
 * @returns {string} Granted scopes string
 */
export function getGrantedScopes() {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    return sessionStorage.getItem(SCOPES_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Persists granted scopes string to sessionStorage
 * @param {string} scopeString
 */
export function saveGrantedScopes(scopeString) {
  if (typeof sessionStorage === 'undefined' || !scopeString) return;
  try {
    const existing = sessionStorage.getItem(SCOPES_STORAGE_KEY) || '';
    const newScopes = scopeString.split(/\s+/);
    const existingSet = new Set(existing ? existing.split(/\s+/) : []);
    newScopes.forEach(s => {
      // Exclude any sensitive calendar scopes from being persisted
      if (s && !s.includes('calendar')) existingSet.add(s);
    });
    sessionStorage.setItem(SCOPES_STORAGE_KEY, Array.from(existingSet).join(' '));
  } catch (err) {
    console.warn('Error saving granted scopes:', err);
  }
}

/**
 * Checks whether the drive.file scope is granted
 * @param {Object|string|null} tokenResponseOrScopes
 * @returns {boolean} True if drive.file scope is granted
 */
export function hasDriveScope(tokenResponseOrScopes = null) {
  if (typeof tokenResponseOrScopes === 'string') {
    return tokenResponseOrScopes.includes(DRIVE_FILE_SCOPE);
  }

  if (tokenResponseOrScopes && typeof tokenResponseOrScopes.scope === 'string') {
    return tokenResponseOrScopes.scope.includes(DRIVE_FILE_SCOPE);
  }

  if (tokenResponseOrScopes && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.hasGrantedAllScopes) {
    try {
      if (window.google.accounts.oauth2.hasGrantedAllScopes(tokenResponseOrScopes, DRIVE_FILE_SCOPE)) {
        return true;
      }
    } catch {}
  }

  const granted = getGrantedScopes();
  if (granted && granted.includes(DRIVE_FILE_SCOPE)) {
    return true;
  }

  return false;
}

/**
 * Requests the drive.file scope via incremental consent.
 * Only called when user clicks "☁️ Sync Now" or interacts with Drive Notes.
 *
 * @param {Object} options
 * @param {string} [options.clientId]
 * @param {string} [options.prompt]
 * @returns {Promise<{ success: boolean, granted: boolean, accessToken?: string, error?: string }>}
 */
export async function requestDriveScope({
  clientId = DEFAULT_GOOGLE_CLIENT_ID,
  prompt = 'consent'
} = {}) {
  if (hasDriveScope()) {
    const existingToken = getActiveAccessToken();
    return {
      success: true,
      granted: true,
      accessToken: existingToken
    };
  }

  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    return {
      success: false,
      granted: false,
      error: 'Google Identity Services SDK is not loaded.'
    };
  }

  return new Promise((resolve) => {
    try {
      const activeClientId = clientId || DEFAULT_GOOGLE_CLIENT_ID;

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: DRIVE_FILE_SCOPE,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            const expiresIn = Number(tokenResponse.expires_in) || 3600;
            const expiry = Date.now() + expiresIn * 1000;

            sessionStorage.setItem('studyflow_drive_token', token);
            sessionStorage.setItem('google_access_token', token);
            sessionStorage.setItem('google_token_expiry', String(expiry));

            const scopesGranted = tokenResponse.scope || DRIVE_FILE_SCOPE;
            saveGrantedScopes(scopesGranted);

            resolve({
              success: true,
              granted: true,
              accessToken: token
            });
          } else {
            resolve({
              success: false,
              granted: false,
              error: tokenResponse?.error_description || tokenResponse?.error || 'Drive permission was not granted.'
            });
          }
        },
        error_callback: (err) => {
          resolve({
            success: false,
            granted: false,
            error: err?.message || 'Google OAuth consent popup encountered an error.'
          });
        }
      });

      tokenClient.requestAccessToken({ prompt });
    } catch (err) {
      resolve({
        success: false,
        granted: false,
        error: err?.message || 'Failed to initialize Drive authorization request.'
      });
    }
  });
}

/**
 * Safe backward-compatibility stubs ensuring no calendar scopes are ever requested
 */
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export function hasCalendarScope() {
  return false;
}

export async function requestCalendarScope() {
  return {
    success: false,
    granted: false,
    error: 'Calendar scope removed for Google OAuth verification compliance.'
  };
}

// Automatically clean cached expired tokens from localStorage on load
if (typeof window !== 'undefined') {
  cleanStorage();
}

export default {
  BASIC_AUTH_SCOPES,
  DRIVE_FILE_SCOPE,
  DEFAULT_GOOGLE_SCOPES,
  DEFAULT_GOOGLE_CLIENT_ID,
  cleanStorage,
  parseJwtPayload,
  hasDriveScope,
  requestDriveScope,
  hasCalendarScope,
  requestCalendarScope,
  getGrantedScopes,
  saveGrantedScopes,
  initGoogleTokenClient
};
