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
  STUDY_USER_PROFILE: 'study_user_profile',
  GOOGLE_USER_PROFILE: 'google_user_profile',
  USER_SUB: 'google_user_sub',
  DRIVE_TOKEN: 'studyflow_drive_token',
  DRIVE_USER: 'studyflow_drive_user',
  SESSION_COOKIE: 'study_session'
};


/**
 * Sanitizes user identity details before storing in persistent storage.
 * Retains ONLY non-sensitive user identity flags (name, avatar/picture, sub, email, logged-in status).
 * Strictly guarantees no OAuth access tokens or authorization secrets are persisted.
 */
export function sanitizeUserIdentity(userData) {
  if (!userData || typeof userData !== 'object') return null;
  return {
    sub: String(userData.sub || ''),
    name: String(userData.name || userData.given_name || 'Student'),
    email: String(userData.email || ''),
    picture: String(userData.picture || userData.avatar || ''),
    isLoggedIn: true,
    isDemo: !!userData.isDemo
  };
}

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
      return sanitizeUserIdentity(parsed);
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function setSessionCookie(userData) {
  if (typeof document === 'undefined') return;
  try {
    const sanitized = sanitizeUserIdentity(userData);
    if (!sanitized) return;
    const jsonStr = JSON.stringify(sanitized);
    const encoded = encodeURIComponent(jsonStr);
    const isSecureContext = window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    // 1-Year Persistent Session Cookie (non-sensitive flags only)
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
          localStorage.removeItem(AUTH_KEYS.STUDY_USER_PROFILE);
          localStorage.removeItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
          localStorage.removeItem(AUTH_KEYS.USER_SUB);
          sessionStorage.removeItem(AUTH_KEYS.USER_PROFILE);
          sessionStorage.removeItem(AUTH_KEYS.STUDY_USER_PROFILE);
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
    // Check emergency kill switch for demo mode
    try {
      const rawKs = localStorage.getItem('admin_killswitches');
      if (rawKs) {
        const parsedKs = JSON.parse(rawKs);
        if (parsedKs && parsedKs.demoMode === false) {
          alert('Instant Demo Mode is temporarily disabled by an administrator.');
          return;
        }
      }
    } catch {}

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
    localStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(demoUser));
    sessionStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(demoUser));
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

function isEmailBanned(email) {
  if (!email || typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('banned_users');
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return false;
    const norm = String(email).trim().toLowerCase();
    return list.some(item => {
      const bEmail = typeof item === 'string' ? item : item?.email;
      return String(bEmail || '').trim().toLowerCase() === norm;
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves the currently signed-in user's profile details.
 * Resolves from study_user_profile, persistent session cookie, or LocalStorage.
 * Keeps storage mechanisms synchronized.
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

    // 1. Check study_user_profile in localStorage / sessionStorage
    const studyRaw = localStorage.getItem(AUTH_KEYS.STUDY_USER_PROFILE) || 
                     sessionStorage.getItem(AUTH_KEYS.STUDY_USER_PROFILE);
    if (studyRaw) {
      const parsedStudy = JSON.parse(studyRaw);
      if (parsedStudy && (parsedStudy.email || parsedStudy.name || parsedStudy.sub)) {
        if (parsedStudy.isDemo && !isDemoUser()) return null;
        if (parsedStudy.email && isEmailBanned(parsedStudy.email)) {
          clearAuthTokens();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('login.html')) {
            window.location.replace('/login.html?banned=true');
          }
          return null;
        }
        return parsedStudy;
      }
    }

    // 2. Check persistent cookie
    const cookieUser = getSessionCookie();
    if (cookieUser && (cookieUser.email || cookieUser.name || cookieUser.sub)) {
      if (cookieUser.isDemo && !isDemoUser()) {
        return null;
      }
      if (cookieUser.email && isEmailBanned(cookieUser.email)) {
        clearAuthTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('login.html')) {
          window.location.replace('/login.html?banned=true');
        }
        return null;
      }
      // Sync into localStorage if not already present
      if (!localStorage.getItem(AUTH_KEYS.USER_PROFILE)) {
        localStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(cookieUser));
        localStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(cookieUser));
        localStorage.setItem(AUTH_KEYS.GOOGLE_USER_PROFILE, JSON.stringify(cookieUser));
        if (cookieUser.sub) localStorage.setItem(AUTH_KEYS.USER_SUB, cookieUser.sub);
      }
      return cookieUser;
    }

    // 3. Check LocalStorage fallback
    const raw = localStorage.getItem(AUTH_KEYS.USER_PROFILE) || localStorage.getItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        if (parsed.isDemo && !isDemoUser()) {
          return null;
        }
        if (parsed.email && isEmailBanned(parsed.email)) {
          clearAuthTokens();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('login.html')) {
            window.location.replace('/login.html?banned=true');
          }
          return null;
        }
        // Sync back into persistent cookie and study_user_profile
        setSessionCookie(parsed);
        localStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(parsed));
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
 * Retrieves the currently active Google Drive OAuth access token from sessionStorage or memory.
 * Never retrieves from long-lived localStorage or cookies.
 */
export function getStoredDriveToken() {
  if (typeof window === 'undefined') return null;
  try {
    // Purge any legacy token from localStorage to guarantee storage compliance
    if (localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || localStorage.getItem(AUTH_KEYS.DRIVE_TOKEN)) {
      localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
      localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    }
    return sessionStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || sessionStorage.getItem(AUTH_KEYS.DRIVE_TOKEN) || null;
  } catch {
    return null;
  }
}

/**
 * Checks if the Google OAuth access token is present in sessionStorage and not expired (1-hour lifespan).
 * NOTE: When this returns false, the user remains logged in! Only Google Drive API sync
 * requires refreshing this access token.
 */
export function isTokenValid() {
  if (typeof window === 'undefined') return false;
  if (isDemoUser()) return false;
  try {
    // Purge any legacy token from localStorage
    if (localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || localStorage.getItem(AUTH_KEYS.DRIVE_TOKEN)) {
      localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
      localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    }

    const token = sessionStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || sessionStorage.getItem(AUTH_KEYS.DRIVE_TOKEN);
    const expiryStr = sessionStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
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
 * - Stores ONLY non-sensitive user identity flags (name, avatar, logged-in status) in persistent storage.
 * - Stores OAuth access tokens strictly in sessionStorage or private memory, NOT in long-lived localStorage or unencrypted client cookies.
 */
export function saveUserSession(userData, token = null, expiresInSec = 3600) {
  if (typeof window === 'undefined') return;
  try {
    // Check if email is blacklisted
    if (userData?.email && isEmailBanned(userData.email)) {
      clearAuthTokens();
      if (typeof window !== 'undefined') {
        window.location.replace('/login.html?banned=true');
      }
      return;
    }

    // Clear demo flags if logging in with genuine Google account
    if (!userData?.isDemo) {
      clearDemoSession();
    }

    // Sanitize user data to retain only non-sensitive identity flags
    const sanitized = sanitizeUserIdentity(userData);

    if (sanitized) {
      // 1. Write non-sensitive user identity flags to persistent 1-year session cookie
      setSessionCookie(sanitized);

      // 2. Save only non-sensitive user identity flags in persistent localStorage
      localStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(sanitized));
      localStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(sanitized));
      sessionStorage.setItem(AUTH_KEYS.STUDY_USER_PROFILE, JSON.stringify(sanitized));
      localStorage.setItem(AUTH_KEYS.GOOGLE_USER_PROFILE, JSON.stringify(sanitized));
      if (sanitized.sub) {
        localStorage.setItem(AUTH_KEYS.USER_SUB, sanitized.sub);
        // Initialize dynamic Zero-State data for real Google user if not already present
        if (!sanitized.isDemo) {
          getOrCreateZeroStateData(sanitized.sub);
        }
      }
    }

    // 3. Guarantee removal of any long-lived or legacy access tokens from persistent localStorage
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(AUTH_KEYS.DRIVE_USER);

    // 4. Save OAuth access token strictly in sessionStorage (short-lived session memory)
    if (token) {
      const expiry = Date.now() + (Number(expiresInSec) || 3600) * 1000;
      sessionStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, token);
      sessionStorage.setItem(AUTH_KEYS.DRIVE_TOKEN, token);
      sessionStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, String(expiry));
      if (sanitized) {
        sessionStorage.setItem(AUTH_KEYS.DRIVE_USER, JSON.stringify(sanitized));
      }
    }
  } catch (e) {
    console.error('Error saving user session:', e);
  }
}

/**
 * Timezone-Safe Local Date Formatter (YYYY-MM-DD)
 */
export function getLocalDateString(date = new Date()) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates the clean initial Zero-State Schema for first-time Google users
 */
export function createZeroStateData(userId) {
  const today = getLocalDateString(new Date());
  return {
    userId: String(userId || ''),
    streak: 0,
    lastActiveDate: null,
    dailyTargetHours: 4.0,
    todayLoggedHours: 0.0,
    todayLogDate: today,
    weeklyVelocityHours: 0.0,
    dailyActivity: {},
    routine: [],
    revisionQueue: [],
    exams: [],
    skills: []
  };
}

/**
 * Retrieves the namespaced storage key for the user's master state document:
 * studyflow_${user.sub}_data
 */
export function getUserDataStorageKey(userId) {
  const id = userId || getActiveUserId();
  if (isDemoUser() || id === 'demo_sandbox_user') {
    return 'demo_tracker_data_master';
  }
  return `studyflow_${id}_data`;
}

/**
 * Checks if studyflow_${user.sub}_data exists in storage.
 * If not (first-time login), initializes and saves the clean zero-state schema.
 * Also performs automatic midnight reset if a new day has arrived.
 */
export function getOrCreateZeroStateData(userId) {
  if (!userId || userId === 'guest') return null;
  if (isDemoUser() || userId === 'demo_sandbox_user') return null;

  const storageKey = `studyflow_${userId}_data`;
  try {
    const raw = localStorage.getItem(storageKey);
    const today = getLocalDateString(new Date());

    if (!raw) {
      const zeroState = createZeroStateData(userId);
      localStorage.setItem(storageKey, JSON.stringify(zeroState));
      return zeroState;
    }

    const data = JSON.parse(raw);
    
    // Auto-Midnight Reset check
    if (data.todayLogDate && data.todayLogDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);

      // Check Streak: If they studied yesterday, keep/increment streak; if they missed yesterday, reset streak to 0.
      if (data.lastActiveDate === yesterdayStr) {
        // Studied yesterday, keep streak
      } else {
        // Missed yesterday, reset streak to 0
        data.streak = 0;
      }

      // Reset todayLoggedHours to 0.0h for the new day
      data.todayLoggedHours = 0.0;
      data.todayLogDate = today;

      localStorage.setItem(storageKey, JSON.stringify(data));
    }

    return data;
  } catch (err) {
    console.error('Error in getOrCreateZeroStateData:', err);
    return null;
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
  const sub = getUserSub() || getActiveUserId();
  if (!sub || sub === 'guest') {
    return `studyflow_data_${baseKey}`;
  }
  if (baseKey === 'data') {
    return `studyflow_${sub}_data`;
  }
  return `studyflow_${sub}_${baseKey}`;
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
    // Clear localStorage non-token flags and purge any legacy token records
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(AUTH_KEYS.USER_PROFILE);
    localStorage.removeItem(AUTH_KEYS.STUDY_USER_PROFILE);
    localStorage.removeItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
    localStorage.removeItem(AUTH_KEYS.USER_SUB);
    localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
    localStorage.removeItem(AUTH_KEYS.DRIVE_USER);

    // Clear sessionStorage tokens
    sessionStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    sessionStorage.removeItem(AUTH_KEYS.STUDY_USER_PROFILE);
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

  const token = sessionStorage.getItem(AUTH_KEYS.ACCESS_TOKEN) || 
                sessionStorage.getItem(AUTH_KEYS.DRIVE_TOKEN) || 
                localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);

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

// Guarantee no legacy OAuth tokens reside in persistent localStorage and synchronize session
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
  } catch {}
  getUserProfile();
}
