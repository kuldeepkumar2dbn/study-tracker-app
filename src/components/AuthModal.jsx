import React, { useState } from 'react';
import { 
  Lock, 
  X, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  ArrowRight,
  Award,
  Calendar,
  Repeat,
  BookOpen,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LOCKED_FEATURE_CONFIGS = {
  radar: {
    id: 'radar',
    name: 'Exam Radar',
    tagline: 'Stay ahead of upcoming exam deadlines & assignment milestones',
    icon: Calendar,
    color: 'rose',
    benefits: [
      'Real-time visual countdown radar with dynamic urgency indicators',
      'Priority milestones for tests, midterms, and homework deadlines',
      'Color-coded urgency flags (Today, Tomorrow, 3d, 7d intervals)',
      'Direct scheduling & seamless calendar synchronization'
    ],
    defaultUrl: '/radar.html'
  },
  exams: {
    id: 'radar',
    name: 'Exam Radar',
    tagline: 'Stay ahead of upcoming exam deadlines & assignment milestones',
    icon: Calendar,
    color: 'rose',
    benefits: [
      'Real-time visual countdown radar with dynamic urgency indicators',
      'Priority milestones for tests, midterms, and homework deadlines',
      'Color-coded urgency flags (Today, Tomorrow, 3d, 7d intervals)',
      'Direct scheduling & seamless calendar synchronization'
    ],
    defaultUrl: '/radar.html'
  },
  revision: {
    id: 'revision',
    name: 'Revision Queue',
    tagline: 'Conquer the forgetting curve with scientifically-timed spaced repetition',
    icon: Repeat,
    color: 'emerald',
    benefits: [
      'Automated daily revision queue based on Ebbinghaus forgetting curve',
      'Systematic D+1, D+3, D+7, and D+30 interval progressions',
      'One-click topic review completion and retention tracking',
      'Synchronized with your personal subjects & syllabus'
    ],
    defaultUrl: '/revision.html'
  },
  skills: {
    id: 'skills',
    name: 'Skill Tracker',
    tagline: 'Track deliberate practice hours & master critical competencies',
    icon: Award,
    color: 'amber',
    benefits: [
      'Deliberate practice logging with target milestone tracking',
      'Visual proficiency progression from Novice to Master',
      'Practice session history with timestamps and notes',
      'Integrated with daily focus timers and study routines'
    ],
    defaultUrl: '/skills.html'
  },
  syllabus: {
    id: 'syllabus',
    name: 'Subjects & Syllabus',
    tagline: 'Comprehensive subject mastery, subtopics, and curated study resources',
    icon: BookOpen,
    color: 'indigo',
    benefits: [
      'Hierarchical course curriculum with chapter progress bars',
      'Curated YouTube lecture vaults with embedded previews',
      'Direct synchronization to your Google Drive lecture notes',
      'Custom weekly study hour targets and topic mastery scoring'
    ],
    defaultUrl: '/syllabus.html'
  },
  subjects: {
    id: 'syllabus',
    name: 'Subjects & Syllabus',
    tagline: 'Comprehensive subject mastery, subtopics, and curated study resources',
    icon: BookOpen,
    color: 'indigo',
    benefits: [
      'Hierarchical course curriculum with chapter progress bars',
      'Curated YouTube lecture vaults with embedded previews',
      'Direct synchronization to your Google Drive lecture notes',
      'Custom weekly study hour targets and topic mastery scoring'
    ],
    defaultUrl: '/syllabus.html'
  },
  notes: {
    id: 'notes',
    name: 'Drive Notes & Document Vault',
    tagline: 'Zero-backend notes, markdown editor & personal Google Drive vault',
    icon: FileText,
    color: 'emerald',
    benefits: [
      'Direct client-side sync to your personal Google Drive storage',
      'Upload and attach PDF, DOCX, TXT, and images up to 25MB',
      'Rich Markdown editor with live preview, tags, and search',
      'Zero external servers: all study documents stay in your Google account'
    ],
    defaultUrl: '/notes.html'
  },
  general: {
    id: 'general',
    name: 'Full Academic Suite',
    tagline: 'Sign in to access your personal academic workspace',
    icon: Sparkles,
    color: 'indigo',
    benefits: [
      'Complete unrestricted access to Drive Notes, Exam Radar, Revision Queue, Skills & Syllabus',
      'Persistent 1-year login session saved in secure cookies',
      'Zero-backend privacy: All files save directly to your Google Drive',
      'Routine, calendar, and focus timer synchronized across devices'
    ],
    defaultUrl: null
  }
};

export default function AuthModal() {
  const { authModalState, closeAuthModal, loginWithGoogle, loginAsDemoStudent } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!authModalState.isOpen) return null;

  const featureKey = authModalState.featureKey || 'general';
  const feature = LOCKED_FEATURE_CONFIGS[featureKey] || LOCKED_FEATURE_CONFIGS.general;
  const FeatureIcon = feature.icon || Lock;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
      closeAuthModal();

      // If a destination URL was requested (e.g. user clicked a specific tab)
      const targetUrl = authModalState.redirectOnSuccess || feature.defaultUrl;
      if (targetUrl && !window.location.pathname.endsWith(targetUrl)) {
        window.location.href = targetUrl;
      } else {
        // Smoothly reload current page to activate unlocked state
        window.location.reload();
      }
    } catch (err) {
      console.error('Modal login failed:', err);
      setErrorMessage(err.message || 'Google Sign-In was cancelled or failed.');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn"
      onClick={closeAuthModal}
    >
      <div 
        className="w-full max-w-md rounded-3xl glass-panel border border-theme-border/80 shadow-2xl p-6 sm:p-7 backdrop-blur-2xl bg-theme-surface/95 relative animate-tab-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-full text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-sky-500/20 to-emerald-500/20 border border-theme-border flex items-center justify-center shadow-inner">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-theme-surface border border-theme-border text-theme-accent">
              <FeatureIcon className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25 mb-2">
            <span>🔒 Login Required</span>
          </div>

          <h3 className="font-display font-extrabold text-xl sm:text-2xl text-theme-text tracking-tight">
            Sign in to unlock {feature.name}
          </h3>

          <p className="text-xs text-theme-muted mt-1.5 max-w-sm leading-relaxed">
            {feature.tagline}
          </p>
        </div>

        {/* Feature Highlights Card */}
        <div className="my-5 p-3.5 rounded-2xl bg-theme-bg/60 border border-theme-border/60 text-xs space-y-2">
          {feature.benefits.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-theme-text/90">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{b}</span>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Primary Action: Continue with Google */}
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

        {/* Instant Demo Sign-In */}
        <button
          type="button"
          onClick={() => {
            loginAsDemoStudent();
            closeAuthModal();
            const targetUrl = authModalState.redirectOnSuccess || feature.defaultUrl;
            if (targetUrl && !window.location.pathname.endsWith(targetUrl)) {
              window.location.href = targetUrl;
            } else {
              window.location.reload();
            }
          }}
          className="w-full mt-2.5 py-3 px-4 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Instant Demo Sign-In (Local Preview)</span>
        </button>

        {/* Privacy & Session Persistence Notice */}
        <div className="mt-4 pt-3 border-t border-theme-border/60 text-center">
          <p className="text-[10px] text-theme-muted leading-relaxed flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Persistent 1-Year Session • Zero External Servers</span>
          </p>
        </div>
      </div>
    </div>
  );
}
