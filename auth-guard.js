/**
 * Hardened Authentication & Token Guard (auth-guard.js)
 * StudyFlow Multi-Page Architecture
 *
 * Implements:
 * - Token existence & expiration validation (Date.now() > google_token_expiry)
 * - GIS Token revocation on logout via google.accounts.oauth2.revoke(token)
 * - User-scoped LocalStorage keys (user.sub) to prevent cross-account data leakage
 */

export const AUTH_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  USER_PROFILE: 'user_profile',
  GOOGLE_USER_PROFILE: 'google_user_profile',
  USER_SUB: 'google_user_sub',
  DRIVE_TOKEN: 'studyflow_drive_token',
  DRIVE_USER: 'studyflow_drive_user'
};

/**
 * Retrieves the current authenticated user's unique Google subject ID (sub)
 */
export function getUserSub() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(AUTH_KEYS.USER_PROFILE) || localStorage.getItem(AUTH_KEYS.GOOGLE_USER_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sub) return parsed.sub;
    }
    return localStorage.getItem(AUTH_KEYS.USER_SUB) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Returns namespaced LocalStorage key based on authenticated user's Google ID (user.sub)
 */
export function getUserStorageKey(baseKey) {
  const sub = getUserSub();
  return sub ? `studyflow_data_${sub}_${baseKey}` : `studyflow_data_${baseKey}`;
}

/**
 * Checks whether the current access token is present and unexpired.
 * If expired (Date.now() > google_token_expiry), automatically purges auth tokens and redirects to login.html.
 */
export function validateAuthToken({ redirect = true } = {}) {
  if (typeof window === 'undefined') return true;

  try {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const expiryStr = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);

    // If no token exists
    if (!token) {
      if (redirect && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('privacy.html')) {
        window.location.replace('/login.html');
      }
      return false;
    }

    // Check expiration timestamp
    if (expiryStr) {
      const expiry = Number(expiryStr);
      if (!isNaN(expiry) && Date.now() > expiry) {
        console.warn('Google Access Token has expired. Logging out.');
        clearAuthTokens();
        if (redirect && !window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('privacy.html')) {
          window.location.replace('/login.html');
        }
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error validating auth token:', err);
    return false;
  }
}

/**
 * Clears authentication tokens and active user session without wiping non-auth settings
 */
export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  try {
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
 * 2. Clears authentication credentials and user profile from LocalStorage & SessionStorage
 * 3. Redirects student to login.html
 */
export function logout(onComplete) {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);

  const finalize = () => {
    clearAuthTokens();
    if (typeof onComplete === 'function') {
      onComplete();
    } else {
      window.location.replace('/login.html');
    }
  };

  // If token is present, attempt GIS revocation
  if (token) {
    // 1. GIS SDK revoke method
    if (window.google?.accounts?.oauth2?.revoke) {
      try {
        let callbackExecuted = false;
        window.google.accounts.oauth2.revoke(token, () => {
          if (!callbackExecuted) {
            callbackExecuted = true;
            finalize();
          }
        });
        // Safety timeout in case GIS revoke callback hangs or doesn't resolve
        setTimeout(() => {
          if (!callbackExecuted) {
            callbackExecuted = true;
            finalize();
          }
        }, 1200);
        return;
      } catch (err) {
        console.warn('GIS revoke error, falling back to endpoint:', err);
      }
    }

    // 2. Direct Google OAuth2 Revocation Endpoint Fallback
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

// Auto-run validation if loaded directly in browser document
if (typeof window !== 'undefined') {
  validateAuthToken({ redirect: true });
}
