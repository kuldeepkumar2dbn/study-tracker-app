/**
 * Google OAuth2 & Identity Services Helper (google-auth.js)
 * Supports Incremental Consent for Google Calendar & Drive Scopes
 */

import { 
  DEFAULT_GOOGLE_CLIENT_ID, 
  DRIVE_FILE_SCOPE, 
  CALENDAR_EVENTS_SCOPE, 
  DEFAULT_GOOGLE_SCOPES,
  initGoogleTokenClient 
} from './src/services/googleDrive.js';
import { getActiveAccessToken } from './cloud-sync.js';

export { 
  DEFAULT_GOOGLE_CLIENT_ID, 
  DRIVE_FILE_SCOPE, 
  CALENDAR_EVENTS_SCOPE, 
  DEFAULT_GOOGLE_SCOPES,
  initGoogleTokenClient 
};

export const SCOPES_STORAGE_KEY = 'google_granted_scopes';

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
      if (s) existingSet.add(s);
    });
    sessionStorage.setItem(SCOPES_STORAGE_KEY, Array.from(existingSet).join(' '));
  } catch (err) {
    console.warn('Error saving granted scopes:', err);
  }
}

/**
 * Checks whether the Google Calendar Events scope is granted.
 * Supports checking a tokenResponse object, a custom scope string, or reading from sessionStorage.
 *
 * @param {Object|string|null} tokenResponseOrScopes
 * @returns {boolean} True if calendar.events scope is granted
 */
export function hasCalendarScope(tokenResponseOrScopes = null) {
  // 1. Direct string check
  if (typeof tokenResponseOrScopes === 'string') {
    return tokenResponseOrScopes.includes(CALENDAR_EVENTS_SCOPE);
  }

  // 2. TokenResponse object check
  if (tokenResponseOrScopes && typeof tokenResponseOrScopes.scope === 'string') {
    return tokenResponseOrScopes.scope.includes(CALENDAR_EVENTS_SCOPE);
  }

  // 3. GIS official helper check if tokenResponse is provided
  if (tokenResponseOrScopes && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.hasGrantedAllScopes) {
    try {
      if (window.google.accounts.oauth2.hasGrantedAllScopes(tokenResponseOrScopes, CALENDAR_EVENTS_SCOPE)) {
        return true;
      }
    } catch {}
  }

  // 4. SessionStorage check
  const granted = getGrantedScopes();
  if (granted && granted.includes(CALENDAR_EVENTS_SCOPE)) {
    return true;
  }

  return false;
}

/**
 * Incremental Consent: Requests Google Calendar scope without disrupting the student's login session.
 *
 * - Checks if calendar scope is already granted.
 * - If not, triggers `tokenClient.requestAccessToken({ scope: CALENDAR_EVENTS_SCOPE, prompt: 'consent' })`.
 * - Updates sessionStorage tokens and granted scopes on success.
 * - Never clears cookie session or user identity data on cancellation or denial.
 *
 * @param {Object} options
 * @param {string} [options.clientId]
 * @param {string} [options.prompt]
 * @returns {Promise<{ success: boolean, granted: boolean, accessToken?: string, error?: string }>}
 */
export async function requestCalendarScope({
  clientId = DEFAULT_GOOGLE_CLIENT_ID,
  prompt = 'consent'
} = {}) {
  // If already granted, resolve immediately
  if (hasCalendarScope()) {
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
        scope: CALENDAR_EVENTS_SCOPE,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            const expiresIn = Number(tokenResponse.expires_in) || 3600;
            const expiry = Date.now() + expiresIn * 1000;

            // Update active access token in sessionStorage without touching long-lived login cookie
            sessionStorage.setItem('studyflow_drive_token', token);
            sessionStorage.setItem('google_access_token', token);
            sessionStorage.setItem('google_token_expiry', String(expiry));

            // Record granted calendar scope
            const scopesGranted = tokenResponse.scope || CALENDAR_EVENTS_SCOPE;
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
              error: tokenResponse?.error_description || tokenResponse?.error || 'Calendar permission was denied or closed.'
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
        error: err?.message || 'Failed to initialize calendar authorization request.'
      });
    }
  });
}

export default {
  CALENDAR_EVENTS_SCOPE,
  DRIVE_FILE_SCOPE,
  DEFAULT_GOOGLE_SCOPES,
  DEFAULT_GOOGLE_CLIENT_ID,
  hasCalendarScope,
  getGrantedScopes,
  saveGrantedScopes,
  requestCalendarScope,
  initGoogleTokenClient
};
