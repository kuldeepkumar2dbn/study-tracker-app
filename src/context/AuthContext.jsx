import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getUserProfile, 
  isAuthenticated as checkIsAuthenticated, 
  isTokenValid, 
  saveUserSession, 
  logout, 
  AUTH_KEYS,
  isDemoUser,
  initDemoSession,
  getDemoRemainingSeconds,
  clearDemoSession
} from '../../auth-guard';
import { DEFAULT_GOOGLE_CLIENT_ID, DEFAULT_GOOGLE_SCOPES } from '../services/googleDrive';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => getUserProfile());
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkIsAuthenticated());
  const [isTokenExpired, setIsTokenExpired] = useState(() => !isTokenValid());
  const [authModalState, setAuthModalState] = useState({
    isOpen: false,
    featureKey: 'general',
    redirectOnSuccess: null
  });

  const refreshAuthState = useCallback(() => {
    const profile = getUserProfile();
    setUserProfile(profile);
    setIsAuthenticated(!!profile);
    setIsTokenExpired(!isTokenValid());
  }, []);

  // Synchronize auth state across browser tabs and storage updates
  useEffect(() => {
    refreshAuthState();

    const handleStorageChange = (e) => {
      if (
        !e.key || 
        e.key === AUTH_KEYS.USER_PROFILE || 
        e.key === AUTH_KEYS.ACCESS_TOKEN || 
        e.key === AUTH_KEYS.TOKEN_EXPIRY
      ) {
        refreshAuthState();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshAuthState]);

  const openAuthModal = useCallback((featureKey = 'general', redirectOnSuccess = null) => {
    setAuthModalState({
      isOpen: true,
      featureKey,
      redirectOnSuccess
    });
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  /**
   * Helper to ensure Google Identity Services SDK is loaded
   */
  const waitForGis = () => {
    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        return resolve(window.google.accounts.oauth2);
      }
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve(window.google.accounts.oauth2);
        } else if (attempts > 35) {
          clearInterval(interval);
          resolve(null);
        }
      }, 150);
    });
  };

  /**
   * Direct GIS Login Flow:
   * Opens Google Identity consent popup, retrieves OAuth access token,
   * fetches user profile details from Google UserInfo endpoint, and
   * writes persistent 1-year cookie (study_session) + localStorage.
   */
  const loginWithGoogle = useCallback(async () => {
    const oauth2 = await waitForGis();
    if (!oauth2) {
      throw new Error('Google Identity Services SDK could not be loaded. Please disable ad-blockers or check your connection.');
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = oauth2.initTokenClient({
          client_id: DEFAULT_GOOGLE_CLIENT_ID,
          scope: DEFAULT_GOOGLE_SCOPES,
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              const accessToken = tokenResponse.access_token;
              const expiresInSec = Number(tokenResponse.expires_in) || 3600;

              let userData = {
                sub: 'user_' + Date.now(),
                name: 'Student',
                email: '',
                picture: ''
              };

              // Fetch Google user profile details
              try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (res.ok) {
                  const profile = await res.json();
                  userData = {
                    sub: profile.sub || userData.sub,
                    name: profile.name || profile.given_name || 'Student',
                    email: profile.email || '',
                    picture: profile.picture || ''
                  };
                }
              } catch (profileErr) {
                console.warn('Could not fetch user profile details:', profileErr);
              }

              // Persist session to cookie (study_session) and localStorage
              saveUserSession(userData, accessToken, expiresInSec);
              refreshAuthState();
              resolve({ user: userData, token: accessToken });
            } else if (tokenResponse && tokenResponse.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Google login was cancelled.'));
            }
          },
          error_callback: (err) => {
            reject(new Error(err?.message || 'Google Sign-In popup encountered an error or was blocked.'));
          }
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }, [refreshAuthState]);

  /**
   * 1-Click / Silent Google Drive Access Token Renewal:
   * When Google OAuth token expires after 1 hour, renews the access token
   * WITHOUT wiping the user's active session or profile details.
   */
  const renewDriveToken = useCallback(async () => {
    const oauth2 = await waitForGis();
    if (!oauth2) {
      throw new Error('Google Identity Services SDK not loaded.');
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = oauth2.initTokenClient({
          client_id: DEFAULT_GOOGLE_CLIENT_ID,
          scope: DEFAULT_GOOGLE_SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              const accessToken = tokenResponse.access_token;
              const expiresInSec = Number(tokenResponse.expires_in) || 3600;

              // Store OAuth access token strictly in sessionStorage
              sessionStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
              sessionStorage.setItem(AUTH_KEYS.DRIVE_TOKEN, accessToken);
              sessionStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, String(Date.now() + expiresInSec * 1000));

              // Guarantee no OAuth tokens leak to persistent localStorage
              localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
              localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
              localStorage.removeItem(AUTH_KEYS.DRIVE_TOKEN);

              refreshAuthState();
              resolve(accessToken);
            } else {
              reject(new Error(tokenResponse?.error || 'Token renewal cancelled'));
            }
          },
          error_callback: (err) => {
            reject(new Error(err?.message || 'Token renewal popup failed'));
          }
        });

        // Request token silently or via simple account selector
        tokenClient.requestAccessToken({ prompt: '' });
      } catch (err) {
        reject(err);
      }
    });
  }, [refreshAuthState]);

  const signOut = useCallback(() => {
    logout(() => {
      refreshAuthState();
      window.location.replace('/index.html');
    });
  }, [refreshAuthState]);

  /**
   * Fast Demo Student Login: Initializes 7-minute isolated sandbox session
   */
  const loginAsDemoStudent = useCallback(() => {
    initDemoSession();
  }, []);

  const isDemo = isDemoUser();

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        isAuthenticated,
        isTokenExpired,
        isDemo,
        authModalState,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        loginAsDemoStudent,
        renewDriveToken,
        signOut,
        refreshAuthState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Graceful fallback if rendered outside AuthProvider
    const profile = getUserProfile();
    return {
      userProfile: profile,
      isAuthenticated: !!profile,
      isTokenExpired: !isTokenValid(),
      isDemo: isDemoUser(),
      authModalState: { isOpen: false, featureKey: 'general', redirectOnSuccess: null },
      openAuthModal: () => {},
      closeAuthModal: () => {},
      loginWithGoogle: async () => {},
      loginAsDemoStudent: () => initDemoSession(),
      renewDriveToken: async () => {},
      signOut: () => logout(),
      refreshAuthState: () => {}
    };
  }
  return context;
}
