/**
 * Hardened Authentication, Session & Token Guard (auth-guard.js)
 * StudyFlow Multi-Page Architecture
 *
 * Implements:
 * - Persistent cookie-based user session (study_session=<user_data>; max-age=31536000; SameSite=Lax; Secure)
 * - Guest Preview Mode with locked features
 * - Separation between application login session and 1-hour Google Drive OAuth access token
 * - GIS Token revocation on logout via google.accounts.oauth2.revoke(token)
 * - User-scoped LocalStorage keys (user.sub) to prevent cross-account data leakage
 */

import { 
  getFreshDemoTemplateData, 
  DEMO_STORAGE_PREFIX, 
  DEMO_KEYS, 
  DEMO_SESSION_DURATION_MS 
} from './src/utils/demoTemplate.js';

export { DEMO_STORAGE_PREFIX, DEMO_KEYS, DEMO_SESSION_DURATION_MS };

export const AUTH_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  USER_PROFILE: 'user_profile',
  GOOGLE_USER_PROFILE: 'google_user_profile',
  USER_SUB: 'google_user_sub',
  DRIVE_TOKEN: 'studyflow_drive_token',
  DRIVE_USER: 'studyflow_drive_user',
  SESSION_COOKIE: 'study_session'
};


/**
 * Cookie Management Helpers for Persistent Session
 */
export function getSessionCookie() {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(?:^|;\s*)study_session=([^;]*)/);
    if (!match) return null;
    const decoded = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decoded);
    if (parsed && (parsed.email || parsed.name || parsed.sub)) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setSessionCookie(userData) {
  if (typeof document === 'undefined') return;
  try {
    const jsonStr = typeof userData === 'string' ? userData : JSON.stringify(userData);
    const encoded = encodeURIComponent(jsonStr);
    const isSecureContext = window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    // 1-Year Persistent Session Cookie
    const cookieString = `study_session=${encoded}; max-age=31536000; path=/; SameSite=Lax${isSecureContext ? '; Secure' : ''}`;
    document.cookie = cookieString;

    // Safety fallback without Secure if browser strictly rejects Secure on non-https local IPs
    if (!document.cookie.includes('study_session=')) {
      document.cookie = `study_session=${encoded}; max-age=31536000; path=/; SameSite=Lax`;
    }
  } catch (e) {
    console.warn('Error setting session cookie:', e);
  }
}

export function deleteSessionCookie() {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = 'study_session=; max-age=0; path=/; SameSite=Lax; Secure';
    document.cookie = 'study_session=; max-age=0; path=/; SameSite=Lax';
    document.cookie = 'study_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  } catch (e) {
    console.warn('Error deleting session cookie:', e);
  }
}

/**
 * Checks whether an active, valid 7-minute demo sandbox session is running
 */
export function isDemoUser() {
  if (typeof window === 'undefined') return false;
  try {
    const isDemo = sessionStorage.getItem(DEMO_KEYS.IS_DEMO) === 'true' || 
                   localStorage.getItem(DEMO_KEYS.IS_DEMO) === 'true';
    if (!isDemo) return false;

    // Validate 7-minute session end time
    const endStr = sessionStorage.getItem(DEMO_KEYS.END_TIME) || localStorage.getItem(DEMO_KEYS.END_TIME);
    if (endStr) {
      const end = Number(endStr);
      if (!isNaN(end) && Date.now() >= end) {
        clearDemoSession();
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns remaining seconds in the active 7-minute demo session (0 if expired or not in demo)
 */
export function getDemoRemainingSeconds() {
  if (typeof window === 'undefined') return 0;
  try {
    const isDemo = sessionStorage.getItem(DEMO_KEYS.IS_DEMO) === 'true' || 
                   localStorage.getItem(DEMO_KEYS.IS_DEMO) === 'true';
    if (!isDemo) return 0;

    const endStr = sessionStorage.getItem(DEMO_KEYS.END_TIME) || localStorage.getItem(DEMO_KEYS.END_TIME);
    if (!endStr) return 0;
    const end = Number(endStr);
    if (isNaN(end)) return 0;
    const diff = end - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  } catch {
    return 0;
  }
}

/**
 * Completely clears all demo storage keys and session flags
 */
export function clearDemoSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DEMO_KEYS.IS_DEMO);
    sessionStorage.removeItem(DEMO_KEYS.END_TIME);
    localStorage.removeItem(DEMO_KEYS.IS_DEMO);
    localStorage.removeItem(DEMO_KEYS.END_TIME);

    // Completely wipe all demo keys from sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('demo_') || k.startsWith('studyflow_demo_') || k.includes('demo_sandbox_user'))) {
        sessionKeysToRemove.push(k);
      }
    }
    sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));

    // Completely wipe all demo keys from localStorage
    const localKeysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('demo_') || k.startsWith('studyflow_demo_') || k.includes('demo_sandbox_user'))) {
        localKeysToRemove.push(k);
      }
    }
    localKeysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear demo profile if it was the active profile
    const raw = localStorage.getItem(AUTH_KEYS.USER_PROFILE) || sessionStorage.getItem(AUTH_KEYS.USER_PROFILE);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p.isDemo || p.sub === 'demo_sandbox_user') {
          deleteSessionCookie();
          localStorage.removeItem(AUTH_KEYS.USER_PROFILE);
          localStorage.removeItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
          localStorage.removeItem(AUTH_KEYS.USER_SUB);
          sessionStorage.removeItem(AUTH_KEYS.USER_PROFILE);
          sessionStorage.removeItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
        }
      } catch {}
    }
  } catch (e) {
    console.error('Error clearing demo session:', e);
  }
}

/**
 * Initializes a brand new 7-minute isolated demo sandbox session
 * Wipes prior demo data, initializes fresh templates, and navigates to index.html
 */
export function initDemoSession() {
  if (typeof window === 'undefined') return;
  try {
    // 1. Completely wipe previous demo data
    clearDemoSession();

    // 2. Set demo flags & 7-minute expiration
    const sessionEnd = Date.now() + DEMO_SESSION_DURATION_MS;
    sessionStorage.setItem(DEMO_KEYS.IS_DEMO, 'true');
    localStorage.setItem(DEMO_KEYS.IS_DEMO, 'true');
    sessionStorage.setItem(DEMO_KEYS.END_TIME, String(sessionEnd));
    localStorage.setItem(DEMO_KEYS.END_TIME, String(sessionEnd));

    // 3. Set demo user profile
    const demoUser = {
      sub: 'demo_sandbox_user',
      name: 'Demo Student',
      email: 'demo@studyflow.local',
      picture: '',
      isDemo: true
    };
    sessionStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(demoUser));
    localStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(demoUser));
    localStorage.setItem(AUTH_KEYS.GOOGLE_USER_PROFILE, JSON.stringify(demoUser));
    localStorage.setItem(AUTH_KEYS.USER_SUB, demoUser.sub);
    setSessionCookie(demoUser);

    // 4. Populate fresh clean default template data into demo namespace
    const templateData = getFreshDemoTemplateData();
    Object.entries(templateData).forEach(([key, value]) => {
      const demoKey = `demo_tracker_data_${key}`;
      const serialized = JSON.stringify(value);
      sessionStorage.setItem(demoKey, serialized);
      localStorage.setItem(demoKey, serialized);
    });

    // 5. Redirect to index.html
    window.location.replace('/index.html');
  } catch (e) {
    console.error('Error initializing demo session:', e);
  }
}

/**
 * Retrieves the currently signed-in user's profile details.
 * Resolves from persistent session cookie first, falling back to LocalStorage.
 * Keeps both storage mechanisms synchronized.
 */
export function getUserProfile() {
  if (typeof window === 'undefined') return null;
  try {
    if (isDemoUser()) {
      return {
        sub: 'demo_sandbox_user',
        name: 'Demo Student',
        email: 'demo@studyflow.local',
        picture: '',
        isDemo: true
      };
    }

    // 1. Check persistent cookie first
    const cookieUser = getSessionCookie();
    if (cookieUser && (cookieUser.email || cookieUser.name || cookieUser.sub)) {
      if (cookieUser.isDemo && !isDemoUser()) {
        return null;
      }
      // Sync into localStorage if not already present
      if (!localStorage.getItem(AUTH_KEYS.USER_PROFILE)) {
        localStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(cookieUser));
        localStorage.setItem(AUTH_KEYS.GOOGLE_USER_PROFILE, JSON.stringify(cookieUser));
        if (cookieUser.sub) localStorage.setItem(AUTH_KEYS.USER_SUB, cookieUser.sub);
      }
      return cookieUser;
    }

    // 2. Check LocalStorage fallback
    const raw = localStorage.getItem(AUTH_KEYS.USER_PROFILE) || localStorage.getItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        if (parsed.isDemo && !isDemoUser()) {
          return null;
        }
        // Sync back into persistent cookie
        setSessionCookie(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error retrieving user profile:', e);
  }
  return null;
}

/**
 * Returns true if an authenticated user session is active (via cookie or localStorage).
 * Stays valid across browser restarts indefinitely until explicit logout.
 */
export function isAuthenticated() {
  return getUserProfile() !== null;
}

/**
 * Checks if the Google OAuth access token is present and not expired (1-hour lifespan).
 * NOTE: When this returns false, the user remains logged in! Only Google Drive API sync
 * requires refreshing this access token.
 */
export function isTokenValid() {
  if (typeof window === 'undefined') return false;
  if (isDemoUser()) return false;
  try {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const expiryStr = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
    if (!token) return false;
    if (expiryStr) {
      const expiry = Number(expiryStr);
      if (!isNaN(expiry) && Date.now() > expiry) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a student's user profile and persistent session.
 * Writes persistent session cookie and updates LocalStorage.
 */
export function saveUserSession(userData, token = null, expiresInSec = 3600) {
  if (typeof window === 'undefined') return;
  try {
    // Clear demo flags if logging in with genuine Google account
    if (!userData?.isDemo) {
      clearDemoSession();
    }

    // 1. Write persistent 1-year session cookie
    setSessionCookie(userData);

    // 2. Save user profile details in localStorage
    localStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(userData));
    localStorage.setItem(AUTH_KEYS.GOOGLE_USER_PROFILE, JSON.stringify(userData));
    if (userData.sub) {
      localStorage.setItem(AUTH_KEYS.USER_SUB, userData.sub);
    }

    // 3. Save OAuth token details if provided
    if (token) {
      localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, token);
      const expiry = Date.now() + (Number(expiresInSec) || 3600) * 1000;
      localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, String(expiry));
      localStorage.setItem(AUTH_KEYS.DRIVE_TOKEN, token);
      sessionStorage.setItem(AUTH_KEYS.DRIVE_TOKEN, token);
      localStorage.setItem(AUTH_KEYS.DRIVE_USER, JSON.stringify(userData));
      sessionStorage.setItem(AUTH_KEYS.DRIVE_USER, JSON.stringify(userData));
    }
  } catch (e) {
    console.error('Error saving user session:', e);
  }
}

/**
 * Retrieves the current authenticated user's unique Google subject ID (sub)
 */
export function getUserSub() {
  if (isDemoUser()) return 'demo_sandbox_user';
  const profile = getUserProfile();
  return profile?.sub || '';
}

/**
 * Retrieves an active unique identifier for the current student session
 */
export function getActiveUserId() {
  try {
    if (isDemoUser()) return 'demo_sandbox_user';
    const profile = getUserProfile();
    if (profile?.sub) return profile.sub;
    if (profile?.id) return profile.id;
    if (profile?.email) return profile.email.replace(/[^a-zA-Z0-9_-]/g, '_');
    return 'guest';
  } catch {
    return 'guest';
  }
}

/**
 * Returns namespaced LocalStorage key based on authenticated user's Google ID (user.sub)
 * If demo user, strictly returns isolated demo namespace
 */
export function getUserStorageKey(baseKey) {
  if (isDemoUser()) {
    return `demo_tracker_data_${baseKey}`;
  }
  const sub = getUserSub();
  return sub ? `studyflow_data_${sub}_${baseKey}` : `studyflow_data_${baseKey}`;
}

/**
 * Soft Auth Validation:
 * Validates whether the user is authenticated.
 * Does NOT perform hard redirects on index.html or locked preview pages.
 */
export function validateAuthToken({ redirect = false } = {}) {
  const authed = isAuthenticated();
  if (!authed && redirect) {
    // Only redirect if specifically requested and NOT on previewable/guest pages
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.endsWith('index.html') && !path.endsWith('/') && !path.endsWith('login.html') && !path.endsWith('privacy.html')) {
        // We allow locked pages to render their frosted glass overlay rather than hard 404 or redirect
      }
    }
  }
  return authed;
}

/**
 * Clears authentication tokens and active user session without wiping non-auth settings
 */
export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  try {
    deleteSessionCookie();
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(AUTH_KEYS.USER_PROFILE);
    localStorage.removeItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
    localStorage.removeItem(AUTH_KEYS.USER_SUB);
    localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
    localStorage.removeItem(AUTH_KEYS.DRIVE_USER);
    sessionStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
    sessionStorage.removeItem(AUTH_KEYS.DRIVE_USER);
  } catch (e) {
    console.error('Error clearing auth tokens:', e);
  }
}

/**
 * Hardened Logout:
 * 1. Calls google.accounts.oauth2.revoke(token) to revoke server-side Google OAuth permissions
 * 2. Clears authentication credentials, user profile from LocalStorage & SessionStorage
 * 3. Deletes the persistent study_session cookie
 * 4. Navigates student to /index.html in Guest Mode
 */
export function logout(onComplete) {
  if (typeof window === 'undefined') return;

  if (isDemoUser()) {
    clearDemoSession();
    if (typeof onComplete === 'function') {
      onComplete();
    } else {
      window.location.replace('/index.html');
    }
    return;
  }

  const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);

  const finalize = () => {
    clearAuthTokens();
    if (typeof onComplete === 'function') {
      onComplete();
    } else {
      window.location.replace('/index.html');
    }
  };

  // If token is present, attempt GIS revocation
  if (token) {
    if (window.google?.accounts?.oauth2?.revoke) {
      try {
        let callbackExecuted = false;
        window.google.accounts.oauth2.revoke(token, () => {
          if (!callbackExecuted) {
            callbackExecuted = true;
            finalize();
          }
        });
        setTimeout(() => {
          if (!callbackExecuted) {
            callbackExecuted = true;
            finalize();
          }
        }, 1000);
        return;
      } catch (err) {
        console.warn('GIS revoke error, falling back to endpoint:', err);
      }
    }

    try {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).catch((e) => {
        console.warn('Endpoint token revoke request failed:', e);
      }).finally(() => {
        finalize();
      });
      return;
    } catch (e) {
      console.warn('Failed to call revoke endpoint:', e);
    }
  }

  // If no token or cannot revoke, finalize immediately
  finalize();
}

// Synchronize session between cookie and localStorage if available
if (typeof window !== 'undefined') {
  getUserProfile();
}
