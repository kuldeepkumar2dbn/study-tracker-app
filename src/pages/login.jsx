import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ShieldCheck, 
  Cloud, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { ThemeProvider } from '../context/ThemeContext';
import { isAuthenticated, saveUserSession } from '../../auth-guard';
import { DEFAULT_GOOGLE_CLIENT_ID, DEFAULT_GOOGLE_SCOPES } from '../services/googleDrive';

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusText, setStatusText] = useState('');

  // Auto-redirect to dashboard if already authenticated with active session
  useEffect(() => {
    try {
      if (isAuthenticated()) {
        window.location.replace('/index.html');
      }
    } catch (e) {
      console.warn('Auth check error:', e);
    }
  }, []);

  // Helper to ensure GIS SDK is loaded
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

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setIsLoading(true);
    setStatusText('Connecting to Google Identity Services...');

    try {
      const oauth2 = await waitForGis();
      if (!oauth2) {
        throw new Error('Google Identity Services SDK could not be loaded. Please disable ad-blockers or refresh the page.');
      }

      setStatusText('Waiting for approval in Google popup...');

      const tokenClient = oauth2.initTokenClient({
        client_id: DEFAULT_GOOGLE_CLIENT_ID,
        scope: DEFAULT_GOOGLE_SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            const accessToken = tokenResponse.access_token;
            const expiresInSec = Number(tokenResponse.expires_in) || 3600;
            setStatusText('Saving authorization and loading profile...');

            let userData = {
              sub: 'user_' + Date.now(),
              name: 'Student',
              email: '',
              picture: ''
            };

            // Fetch student's profile information from Google
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

            // Write persistent cookie (study_session) and localStorage
            saveUserSession(userData, accessToken, expiresInSec);

            setStatusText('Redirecting to Study Tracker...');
            window.location.replace('/index.html');
          } else if (tokenResponse && tokenResponse.error) {
            setErrorMessage(tokenResponse.error_description || tokenResponse.error || 'Authentication was cancelled.');
            setIsLoading(false);
            setStatusText('');
          }
        },
        error_callback: (err) => {
          console.error('GIS Error Callback:', err);
          setErrorMessage(err.message || 'Google popup was blocked or encountered an error.');
          setIsLoading(false);
          setStatusText('');
        }
      });

      // Prompt for both email identity and Drive file permissions upfront
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during sign-in.');
      setIsLoading(false);
      setStatusText('');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-theme-bg relative overflow-hidden">
      {/* Ambient background glow elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-theme-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Centered Login Card */}
      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        <div className="rounded-3xl glass-panel border border-theme-border/80 shadow-2xl p-6 sm:p-8 backdrop-blur-xl bg-theme-surface/70">
          
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-sky-500/20 to-emerald-500/20 border border-theme-border shadow-inner">
              <LogoMark size={48} />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-theme-text">
                Study Tracker
              </h1>
              <p className="text-xs sm:text-sm text-theme-muted mt-1 max-w-xs mx-auto">
                Personal daily study routines, exam countdowns & Google Drive notes vault
              </p>
            </div>
          </div>

          {/* Privacy & Zero-Backend Architecture highlights */}
          <div className="my-6 space-y-2.5 p-3.5 rounded-2xl bg-theme-bg/60 border border-theme-border/60 text-xs">
            <div className="flex items-start gap-2.5 text-theme-text/90">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Direct Google Drive Sync:</strong> Your notes, files, and tracker data save straight to your personal Drive.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-theme-text/90">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Backend Privacy:</strong> No external servers store your files. Everything stays in your own Google account.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-theme-text/90">
              <FolderLock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Persistent 1-Year Login:</strong> Stay signed in securely until you explicitly log out.
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Status Message */}
          {statusText && (
            <div className="mb-5 p-3 rounded-xl bg-theme-accent/10 border border-theme-accent/30 text-theme-accent text-xs flex items-center justify-center gap-2 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{statusText}</span>
            </div>
          )}

          {/* Google GIS Sign-In Action Button */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 border border-zinc-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 text-zinc-700 animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="text-zinc-800 group-hover:text-black">
              {isLoading ? 'Signing In...' : 'Sign in with Google'}
            </span>
          </button>

          {/* Guest Preview Mode Link */}
          <div className="mt-4 text-center">
            <a
              href="/index.html"
              className="inline-flex items-center gap-1.5 text-xs text-theme-accent hover:underline font-semibold"
            >
              <span>Explore as Guest First</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Footer Notice */}
          <div className="mt-5 pt-4 border-t border-theme-border/60 text-center">
            <p className="text-[11px] text-theme-muted leading-relaxed">
              By continuing, you agree to allow Study Tracker to save notes to your personal Google Drive. 
              Review our <a href="/privacy.html" className="text-theme-accent hover:underline font-medium">Privacy Policy</a>.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    </React.StrictMode>
  );
}
