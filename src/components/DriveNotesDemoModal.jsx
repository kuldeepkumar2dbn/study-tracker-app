import React, { useState } from 'react';
import { 
  Lock, 
  Cloud, 
  X, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  FileText,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriveNotesDemoModal({ isOpen, onClose }) {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
      onClose();
      // If user was on notes.html, reload to display unlocked notes
      window.location.reload();
    } catch (err) {
      console.error('Google Sign-In failed from DriveNotesDemoModal:', err);
      setErrorMessage(err.message || 'Google Sign-In was cancelled or failed.');
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    onClose();
    // If the user is currently on notes.html in demo mode, redirect them to index.html
    if (typeof window !== 'undefined' && window.location.pathname.endsWith('notes.html')) {
      window.location.replace('/index.html');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={handleDismiss}
    >
      <div 
        className="w-full max-w-md rounded-3xl glass-panel border border-theme-border/80 shadow-2xl p-6 sm:p-7 backdrop-blur-2xl bg-theme-surface/95 relative animate-tab-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header & Visual Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3.5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-theme-surface border border-theme-border text-emerald-400 shadow-sm">
              <Cloud className="w-4 h-4" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25 mb-2.5">
            <span>🔒 Demo Mode Restriction</span>
          </div>

          <h3 className="font-display font-extrabold text-xl sm:text-2xl text-theme-text tracking-tight">
            Drive Notes Disabled in Demo Mode
          </h3>

          <p className="text-xs sm:text-sm text-theme-muted mt-2 max-w-sm leading-relaxed">
            Saving files requires an authentic Google Account with personal Google Drive storage. Sign in with Google to upload and manage notes.
          </p>
        </div>

        {/* Informative Highlights */}
        <div className="my-5 p-3.5 rounded-2xl bg-theme-bg/60 border border-theme-border/60 text-xs space-y-2.5">
          <div className="flex items-start gap-2.5 text-theme-text/90">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong>Personal Drive Storage:</strong> Your notes and study PDFs stay 100% inside your personal Google Drive account.
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-theme-text/90">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong>Zero-Backend Privacy:</strong> No external third-party server ever stores your private documents or files.
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Primary Action Button: Continue with Google */}
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

        {/* Secondary: Return to Dashboard */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-full mt-2.5 py-2.5 px-4 rounded-xl hover:bg-theme-cardHover text-xs font-medium text-theme-muted hover:text-theme-text transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Explore Other Features First</span>
        </button>
      </div>
    </div>
  );
}
