import React, { useState } from 'react';
import { 
  Lock, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  ArrowLeft,
  Sparkles,
  Calendar,
  Repeat,
  Award,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LOCKED_FEATURE_CONFIGS } from './AuthModal';

export default function LockedFeatureOverlay({ featureKey, children }) {
  const { isAuthenticated, loginWithGoogle, loginAsDemoStudent } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If user is authenticated, render children directly with unrestricted read/write access
  if (isAuthenticated) {
    return children;
  }

  const feature = LOCKED_FEATURE_CONFIGS[featureKey] || LOCKED_FEATURE_CONFIGS.general;
  const FeatureIcon = feature.icon || Lock;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
      // On success, isAuthenticated becomes true and this overlay unmounts immediately!
    } catch (err) {
      console.error('Overlay login error:', err);
      setErrorMessage(err.message || 'Google Sign-In was cancelled or encountered an error.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[580px] rounded-3xl overflow-hidden animate-fadeIn">
      {/* Blurred background preview of the feature interface */}
      <div 
        aria-hidden="true" 
        className="filter blur-md opacity-25 dark:opacity-20 select-none pointer-events-none scale-[0.99] max-h-[750px] overflow-hidden"
      >
        {children}
      </div>

      {/* Elegant frosted-glass locked overlay centered on top */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-theme-bg/50 backdrop-blur-md">
        <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl glass-panel border border-theme-border/80 shadow-2xl backdrop-blur-2xl bg-theme-surface/90 text-center animate-tab-enter">
          
          {/* Padlock Icon with animated glowing ring */}
          <div className="relative mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-indigo-500/20 border border-amber-500/30 shadow-inner">
            <Lock className="w-8 h-8 text-amber-400" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping"></span>
          </div>

          {/* Guest Preview Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            <FeatureIcon className="w-3.5 h-3.5" />
            <span>Guest Preview Mode • Login Required</span>
          </div>

          {/* Heading */}
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-theme-text tracking-tight">
            Sign In to Access {feature.name}
          </h2>

          <p className="text-xs sm:text-sm text-theme-muted mt-2 max-w-md mx-auto leading-relaxed">
            {feature.tagline}
          </p>

          {/* Benefits Checklist */}
          <div className="my-6 p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 text-left space-y-2.5 text-xs">
            {feature.benefits.map((b, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-theme-text/90">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{b}</span>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 text-left animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Continue with Google Action Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 border border-zinc-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
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
              {isLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </span>
          </button>

          {/* Instant Demo Sign-In for Localhost Testing */}
          <button
            type="button"
            onClick={() => {
              loginAsDemoStudent();
            }}
            className="w-full mt-2.5 py-3 px-4 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Instant Demo Sign-In (Local Preview)</span>
          </button>

          {/* Secondary Option: Return to Dashboard */}
          <div className="mt-4 pt-3 border-t border-theme-border/60 flex items-center justify-between text-xs text-theme-muted">
            <a 
              href="/index.html" 
              className="hover:text-theme-text font-medium flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore Dashboard First</span>
            </a>
            <span className="text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>1-Year Persistent Session</span>
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
