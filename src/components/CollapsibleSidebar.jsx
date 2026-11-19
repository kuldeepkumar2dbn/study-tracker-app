import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Repeat, 
  Award, 
  FileText, 
  Lock, 
  ChevronLeft, 
  ChevronRight, 
  Menu,
  X,
  Zap,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Target,
  Trophy,
  User
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme, FEATURE_COLORS } from '../context/ThemeContext';
import { soundEngine } from '../utils/audio';
import { celebrateTaskCompletion } from '../utils/confetti';
import { canAccessAdmin, AdminAuth, TELEMETRY_URL } from '../../admin-config';
import { syncStudentToLeaderboard, stopLivePresenceHeartbeat } from '../../leaderboard.js';
import FeedbackModal from './FeedbackModal';
import { logFeatureUse } from '../utils/telemetry';

/**
 * Minimalist Stopwatch / Hourglass SVG icon for Focus Timer
 */
export function StopwatchIcon({ className = "w-4 h-4", active = false }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="14" r="8" />
      <path d="M12 10v4l2.5 1.5" />
      <path d="M10 2h4" />
      <path d="M12 2v4" />
      <path d="M19 7l1.5-1.5" />
    </svg>
  );
}

/**
 * 3 Clean Sidebar Navigation Groups
 * - DAILY FLOW: Dashboard, Focus Timer, Daily Routine, Calendar
 * - EXAM PREP: Subjects & Syllabus, Revision Queue, Mock Logbook, Exam Radar
 * - GROWTH & SYNC: Skill Tracker, Leaderboard, Drive Notes, My Profile
 */
export const SIDEBAR_GROUPS = [
  {
    id: 'daily-flow',
    label: 'DAILY FLOW',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/index.html', tooltip: 'Dashboard & Overview' },
      { id: 'timer', name: 'Focus Timer', icon: StopwatchIcon, href: '/timer.html', tooltip: 'Focus Timer & Deep Work' },
      { id: 'routine', name: 'Daily Routine', icon: Clock, href: '/routine.html', tooltip: 'Daily Study Routine' },
      { id: 'calendar', name: 'Calendar', icon: CalendarIcon, href: '/calendar.html', tooltip: 'Academic Calendar' }
    ]
  },
  {
    id: 'exam-prep',
    label: 'EXAM PREP',
    items: [
      { id: 'syllabus', name: 'Subjects & Syllabus', icon: BookOpen, href: '/syllabus.html', isProtected: true, tooltip: 'Course Syllabus & Subjects' },
      { id: 'revision', name: 'Revision Queue', icon: Repeat, href: '/revision.html', isProtected: true, tooltip: 'Spaced Repetition Queue' },
      { id: 'mock-logbook', name: 'Mock Logbook', icon: Target, href: '/mock-logbook.html', isProtected: false, tooltip: 'Mock Test & Mistake Logbook' },
      { id: 'radar', name: 'Exam Radar', icon: CalendarIcon, href: '/radar.html', isProtected: true, tooltip: 'Exam Radar & Deadlines' }
    ]
  },
  {
    id: 'growth-sync',
    label: 'GROWTH & SYNC',
    items: [
      { id: 'skills', name: 'Skill Tracker', icon: Award, href: '/skills.html', isProtected: true, tooltip: 'Skill Tracker & Mastery' },
      { id: 'leaderboard', name: 'Leaderboard', icon: Trophy, href: '/leaderboard.html', isProtected: false, tooltip: 'Real-Time Student Leaderboard' },
      { id: 'notes', name: 'Drive Notes', icon: FileText, href: '/notes.html', isProtected: true, tooltip: 'Google Drive Notes Vault' },
      { id: 'profile', name: 'My Profile', icon: User, href: '/profile.html', isProtected: false, tooltip: 'My Student Profile & ID Card' }
    ]
  }
];

export const SIDEBAR_ITEMS = SIDEBAR_GROUPS.flatMap((group) => group.items);

export const LOCKED_TAB_IDS = ['syllabus', 'revision', 'radar', 'skills', 'notes'];

/**
 * Solid glowing pill active highlight styles for all 9 views
 */
export const ACTIVE_PILL_STYLES = {
  dashboard: {
    bg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    shadow: '0 0 22px -2px rgba(99, 102, 241, 0.65), 0 4px 14px rgba(79, 70, 229, 0.45)',
    border: 'rgba(165, 180, 252, 0.4)'
  },
  routine: {
    bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    shadow: '0 0 22px -2px rgba(16, 185, 129, 0.65), 0 4px 14px rgba(5, 150, 105, 0.45)',
    border: 'rgba(110, 231, 183, 0.4)'
  },
  calendar: {
    bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    shadow: '0 0 22px -2px rgba(245, 158, 11, 0.65), 0 4px 14px rgba(217, 119, 6, 0.45)',
    border: 'rgba(253, 230, 138, 0.4)'
  },
  syllabus: {
    bg: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
    shadow: '0 0 22px -2px rgba(6, 182, 212, 0.65), 0 4px 14px rgba(8, 145, 178, 0.45)',
    border: 'rgba(165, 243, 252, 0.4)'
  },
  revision: {
    // Solid glowing violet pill on Revision Queue
    bg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
    shadow: '0 0 24px -2px rgba(139, 92, 246, 0.7), 0 4px 14px rgba(124, 58, 237, 0.5)',
    border: 'rgba(196, 181, 253, 0.45)'
  },
  radar: {
    bg: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
    shadow: '0 0 22px -2px rgba(244, 63, 94, 0.65), 0 4px 14px rgba(225, 29, 72, 0.45)',
    border: 'rgba(254, 205, 211, 0.4)'
  },
  'mock-logbook': {
    bg: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
    shadow: '0 0 22px -2px rgba(14, 165, 233, 0.65), 0 4px 14px rgba(2, 132, 199, 0.45)',
    border: 'rgba(186, 230, 253, 0.4)'
  },
  leaderboard: {
    bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    shadow: '0 0 22px -2px rgba(245, 158, 11, 0.65), 0 4px 14px rgba(217, 119, 6, 0.45)',
    border: 'rgba(253, 230, 138, 0.45)'
  },
  skills: {
    bg: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
    shadow: '0 0 22px -2px rgba(168, 85, 247, 0.65), 0 4px 14px rgba(147, 51, 234, 0.45)',
    border: 'rgba(233, 213, 255, 0.4)'
  },
  notes: {
    bg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
    shadow: '0 0 22px -2px rgba(59, 130, 246, 0.65), 0 4px 14px rgba(37, 99, 235, 0.45)',
    border: 'rgba(191, 219, 254, 0.4)'
  },
  timer: {
    bg: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #8b5cf6 100%)',
    shadow: '0 0 26px -2px rgba(139, 92, 246, 0.75), 0 4px 16px rgba(79, 70, 229, 0.5)',
    border: 'rgba(196, 181, 253, 0.5)'
  },
  profile: {
    bg: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
    shadow: '0 0 22px -2px rgba(20, 184, 166, 0.65), 0 4px 14px rgba(13, 148, 136, 0.45)',
    border: 'rgba(153, 246, 228, 0.45)'
  },
  admin: {
    bg: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)',
    shadow: '0 0 26px -2px rgba(245, 158, 11, 0.75), 0 4px 16px rgba(180, 83, 9, 0.5)',
    border: 'rgba(253, 230, 138, 0.5)'
  }
};

export default function CollapsibleSidebar({
  activeTabId = 'dashboard',
  isExpanded = true,
  isMobileOpen = false,
  onCloseMobile,
  onToggle,
  onOpenDriveNotesDemoModal,
  onSelectTab
}) {
  const { 
    exams = [], 
    routineSlots = [], 
    getTodayRevisionQueue, 
    addTimerSession, 
    streakData 
  } = useData();

  const { isAuthenticated, isGoogleAuthenticated, openAuthModal, isDemo } = useAuth();
  const { isFeatureCoded } = useTheme();

  // Feedback Modal and Toast State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Initial Website Mount Telemetry
  useEffect(() => {
    logFeatureUse('Page Visit');
  }, []);

  // Dynamic Admin Portal navigation visibility check (Super Admin or Editor only)
  const [hasAdminAccess, setHasAdminAccess] = useState(() => {
    return typeof AdminAuth !== 'undefined' && typeof AdminAuth.canAccessAdmin === 'function'
      ? AdminAuth.canAccessAdmin()
      : (typeof canAccessAdmin === 'function' ? canAccessAdmin() : false);
  });

  useEffect(() => {
    const checkAccess = () => {
      setHasAdminAccess(
        typeof AdminAuth !== 'undefined' && typeof AdminAuth.canAccessAdmin === 'function'
          ? AdminAuth.canAccessAdmin()
          : (typeof canAccessAdmin === 'function' ? canAccessAdmin() : false)
      );
    };
    checkAccess();
    window.addEventListener('studyflow-role-switched', checkAccess);
    window.addEventListener('studyflow-collaborators-changed', checkAccess);
    window.addEventListener('storage', checkAccess);
    return () => {
      window.removeEventListener('studyflow-role-switched', checkAccess);
      window.removeEventListener('studyflow-collaborators-changed', checkAccess);
      window.removeEventListener('storage', checkAccess);
    };
  }, []);

  // Live Timer Background Session Tracking State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(1500);

  // Sync and tick live timer from localStorage
  useEffect(() => {
    const syncTimer = () => {
      try {
        const running = localStorage.getItem('is_timer_running') === 'true';
        const endStr = localStorage.getItem('focus_timer_end');
        const secondsLeft = Number(localStorage.getItem('focus_seconds_left') || 1500);

        if (running && endStr) {
          const endTime = Number(endStr);
          const diffSec = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          setIsTimerRunning(true);
          setTimerSecondsLeft(diffSec);
          localStorage.setItem('focus_seconds_left', String(diffSec));

          // When timer completes in background
          if (diffSec <= 0) {
            setIsTimerRunning(false);
            localStorage.setItem('is_timer_running', 'false');
            localStorage.removeItem('focus_timer_end');

            // 1. Play gentle completion chime
            soundEngine.playCompletionChime();

            // 2. Automatically log the completed focus time to student's daily study hours
            const totalSec = Number(localStorage.getItem('focus_timer_total_seconds') || 1500);
            const durationMin = Math.round(totalSec / 60) || 25;
            const subject = localStorage.getItem('focus_timer_subject') || 'General';

            if (typeof addTimerSession === 'function') {
              addTimerSession({
                subject,
                durationMin,
                type: 'Deep Work'
              });
            }

            // Stop 3-minute live presence heartbeat and sync completed focus session (Google-authenticated users only)
            stopLivePresenceHeartbeat({ sendIdlePing: false });
            if (isGoogleAuthenticated) {
              syncStudentToLeaderboard(TELEMETRY_URL, {
                streakData: {
                  ...(streakData || {}),
                  todayHours: Number(((streakData?.todayHours || 0) + durationMin / 60).toFixed(1)),
                  weeklyVelocityHours: Number(((streakData?.weeklyVelocityHours || 0) + durationMin / 60).toFixed(1))
                }
              }, {
                activeSubject: subject,
                isLiveNow: false
              });
            }

            // 3. Celebrate
            celebrateTaskCompletion();
            window.dispatchEvent(new Event('studyflow-timer-sync'));
          }
        } else {
          setIsTimerRunning(false);
          setTimerSecondsLeft(secondsLeft);
        }
      } catch (e) {
        console.warn('Error syncing sidebar timer:', e);
      }
    };

    syncTimer();
    const interval = setInterval(syncTimer, 1000);

    const handleSyncEvent = () => syncTimer();
    window.addEventListener('studyflow-timer-sync', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('studyflow-timer-sync', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, [addTimerSession]);

  // Counts for status badges
  const pendingRoutineCount = (routineSlots || []).filter(s => !s.completed).length;
  // Body overflow locking and auto-reset for mobile drawer
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const dueRevisionCount = typeof getTodayRevisionQueue === 'function' ? getTodayRevisionQueue().length : 0;
  const urgentExamsCount = (exams || []).filter(e => {
    if (e.isCompleted) return false;
    const diffDays = (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  const formatTimerClock = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerMinutesLeft = Math.ceil(timerSecondsLeft / 60);
  const isDrawerExpanded = isMobileOpen || isExpanded;

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay (< 768px) with pointer-events protection */}
      <div 
        id="sidebar-backdrop"
        onClick={() => {
          if (onCloseMobile) onCloseMobile();
          if (typeof document !== 'undefined') document.body.style.overflow = '';
        }}
        className={`sidebar-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300 ${
          isMobileOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      />

      {/* Main Single Primary Navigation Rail */}
      <aside 
        id="app-sidebar"
        aria-label="Sidebar Navigation Rail"
        className={`app-sidebar md:sticky fixed top-0 bottom-0 left-0 z-50 md:z-40 border-r border-theme-border bg-theme-surface/95 backdrop-blur-xl transition-all duration-300 ease-in-out select-none flex flex-col shrink-0 h-[100dvh] max-h-[100dvh] overflow-y-auto overflow-x-hidden ${
          isMobileOpen 
            ? 'translate-x-0 shadow-2xl w-[250px]' 
            : '-translate-x-full md:translate-x-0'
        } ${
          isExpanded ? 'md:w-[240px]' : 'md:w-16'
        }`}
        style={{ height: '100dvh', maxHeight: '100dvh' }}
      >
        {/* Sidebar Header with Hamburger / Close Toggle */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-theme-border/60 shrink-0">
          {/* Mobile Header: Full title + Close X Button */}
          <div className="md:hidden flex items-center justify-between w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-muted font-display">
              Navigation Rail
            </span>
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                if (typeof document !== 'undefined') document.body.style.overflow = '';
              }}
              title="Close Drawer"
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
              aria-label="Close navigation drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Header: Workspace title + ChevronLeft (expanded) / Menu (collapsed) */}
          <div className="hidden md:flex items-center justify-between w-full">
            {isExpanded ? (
              <>
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted font-display">
                  Workspace
                </span>
                <button
                  onClick={onToggle}
                  title="Collapse Sidebar (64px rail)"
                  className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="w-full flex justify-center">
                <button
                  onClick={onToggle}
                  title="Expand Sidebar (250px drawer)"
                  className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
                  aria-label="Expand sidebar"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items organized into 3 clean groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
          {SIDEBAR_GROUPS.map((group, groupIdx) => (
            <div key={group.id} data-sidebar-group={group.id} className={groupIdx > 0 ? 'pt-2' : ''}>
              {isDrawerExpanded ? (
                <p
                  className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider opacity-50 select-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.label}
                </p>
              ) : (
                groupIdx > 0 && <div className="my-1.5 mx-2 border-t border-theme-border/50" />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === activeTabId;
                  const isDemoLockedNotes = isDemo && item.id === 'notes';
                  const isGuestLocked = !isAuthenticated && LOCKED_TAB_IDS.includes(item.id);
                  const isLocked = isDemoLockedNotes || isGuestLocked;
                  const isGuestProfileDemo = !isGoogleAuthenticated && item.id === 'profile';
                  const isGuestLeaderboardSyncLocked = !isGoogleAuthenticated && item.id === 'leaderboard';
                  const showLockIndicator = isLocked || isGuestLeaderboardSyncLocked;
                  const isTimer = item.id === 'timer';

                  // Solid glowing pill highlight styling
                  const pillStyle = ACTIVE_PILL_STYLES[item.id];
                  const itemActiveStyle = isActive && pillStyle ? {
                    background: pillStyle.bg,
                    boxShadow: pillStyle.shadow,
                    borderColor: pillStyle.border
                  } : undefined;

                  const handleClick = (e) => {
                    e.preventDefault();
                    logFeatureUse(item.name);
                    if (onCloseMobile && (isMobileOpen || (typeof window !== 'undefined' && window.innerWidth < 768))) {
                      onCloseMobile();
                    }
                    if (typeof document !== 'undefined') {
                      document.body.style.overflow = '';
                    }
                    if (isDemoLockedNotes) {
                      if (onOpenDriveNotesDemoModal) onOpenDriveNotesDemoModal();
                      return;
                    }
                    if (isGuestLocked) {
                      openAuthModal(item.id, `#${item.id}`);
                      return;
                    }

                    if (onSelectTab) {
                      onSelectTab(item.id);
                    }
                    if (typeof window !== 'undefined') {
                      if (window.switchView) {
                        window.switchView(item.id);
                      } else {
                        window.location.hash = item.id;
                      }
                    }
                  };

                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      data-target-view={item.id}
                      onClick={handleClick}
                      title={!isDrawerExpanded ? item.tooltip : undefined}
                      style={itemActiveStyle}
                      className={`group relative flex items-center rounded-xl transition-all duration-200 ${
                        isDrawerExpanded ? 'px-3 py-2 gap-3' : 'px-0 py-2.5 justify-center'
                      } ${
                        isActive
                          ? 'text-white font-semibold border shadow-lg is-active active-sidebar-item'
                          : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
                      } ${
                        isTimer && isTimerRunning && !isActive
                          ? 'border border-violet-500/40 bg-violet-500/10 text-violet-300'
                          : ''
                      }`}
                    >
                      {/* Item Icon */}
                      <div className="relative shrink-0 flex items-center justify-center">
                        <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive 
                            ? 'text-white' 
                            : isTimer && isTimerRunning
                              ? 'text-violet-400'
                              : 'text-theme-muted group-hover:text-theme-text'
                        }`} />

                        {/* Collapsed Rail Indicators */}
                        {!isDrawerExpanded && (
                          <>
                            {/* Live Running Timer: Small pulsing dot & minute counter (● 24m) */}
                            {isTimer && isTimerRunning && (
                              <span 
                                title={`Focus session running: ${timerMinutesLeft}m remaining`}
                                className="absolute -top-1.5 -right-3 flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-violet-600 text-white font-mono-numbers text-[8px] font-bold shadow-sm ring-1 ring-theme-surface"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                <span>{timerMinutesLeft}m</span>
                              </span>
                            )}

                            {/* Routine Pending Dot */}
                            {!isLocked && item.id === 'routine' && pendingRoutineCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-theme-surface" />
                            )}

                            {/* Revision Due Dot */}
                            {!isLocked && item.id === 'revision' && dueRevisionCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-500 ring-2 ring-theme-surface" />
                            )}

                            {/* Exam Urgent Dot */}
                            {!isLocked && item.id === 'radar' && urgentExamsCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-theme-surface" />
                            )}

                            {/* Minimal Lock Dot */}
                            {showLockIndicator && (
                              <span className="absolute -top-1 -right-1.5 text-[9px] leading-none opacity-75" aria-label="Locked">
                                🔒
                              </span>
                            )}

                            {/* Minimal Demo Dot on Collapsed Profile */}
                            {isGuestProfileDemo && (
                              <span
                                title="My Profile (Demo Preview)"
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-theme-surface"
                              />
                            )}
                          </>
                        )}
                      </div>

                      {/* Expanded Drawer: Item Label & Badges */}
                      {isDrawerExpanded && (
                        <>
                          <span className="text-xs font-medium tracking-tight truncate flex-1">
                            {item.name}
                          </span>

                          {/* Focus Timer Live Running Badge: Live ticking seconds (24:15) */}
                          {isTimer && isTimerRunning && (
                            <div 
                              title="Focus session actively running"
                              className={`ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono-numbers font-bold text-[10px] shadow-sm animate-pulse-soft shrink-0 ${
                                isActive
                                  ? 'bg-white/20 border border-white/40 text-white'
                                  : 'bg-violet-500/20 border border-violet-500/40 text-violet-300 dark:text-violet-200'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>{formatTimerClock(timerSecondsLeft)}</span>
                            </div>
                          )}

                          {/* Routine Pending Badge */}
                          {!isLocked && item.id === 'routine' && pendingRoutineCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                              isActive ? 'bg-white text-emerald-800' : 'bg-emerald-500 text-white'
                            }`}>
                              {pendingRoutineCount}
                            </span>
                          )}

                          {/* Revision Due Badge */}
                          {!isLocked && item.id === 'revision' && dueRevisionCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                              isActive ? 'bg-white text-purple-900' : 'bg-violet-600 text-white'
                            }`}>
                              {dueRevisionCount}
                            </span>
                          )}

                          {/* Exam Radar Urgent Badge */}
                          {!isLocked && item.id === 'radar' && urgentExamsCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                              isActive ? 'bg-white text-rose-800' : 'bg-rose-500 text-white'
                            }`}>
                              {urgentExamsCount}
                            </span>
                          )}

                          {/* Read-Only Demo Badge for My Profile when not Google signed in */}
                          {isGuestProfileDemo && (
                            <span
                              id="sidebar-profile-demo-badge"
                              title="Read-only Demo Preview — Sign in with Google to edit"
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ml-auto select-none"
                              style={
                                isActive
                                  ? {
                                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                                      color: '#FFFFFF',
                                      border: '1px solid rgba(255, 255, 255, 0.4)'
                                    }
                                  : {
                                      backgroundColor: 'var(--bg-card)',
                                      color: 'var(--text-main)',
                                      border: '1px solid var(--border-glow)'
                                    }
                              }
                            >
                              Demo
                            </span>
                          )}

                          {/* Minimal 🔒 Icon for Account-Bound / Sync-Locked Tabs */}
                          {showLockIndicator && (
                            <span 
                              title={
                                isDemoLockedNotes
                                  ? "Locked in demo mode"
                                  : isGuestLeaderboardSyncLocked
                                    ? "Leaderboard sync locked — Sign in with Google to sync your hours"
                                    : "Sign in with Google to unlock"
                              }
                              className="text-xs opacity-60 shrink-0 ml-auto select-none"
                              aria-label={isGuestLeaderboardSyncLocked ? "Leaderboard sync locked" : "Locked"}
                            >
                              🔒
                            </span>
                          )}
                        </>
                      )}

                      {/* Tooltip for Collapsed Mode on Desktop Hover */}
                      {!isDrawerExpanded && (
                        <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-theme-surface/95 border border-theme-border shadow-xl text-xs font-medium text-theme-text whitespace-nowrap z-50 pointer-events-none animate-fadeIn">
                          <span>{item.tooltip}</span>
                          {isTimer && isTimerRunning && (
                            <span className="ml-1.5 font-mono-numbers text-violet-400 font-bold">
                              ({formatTimerClock(timerSecondsLeft)})
                            </span>
                          )}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Feedback Navigation Item directly below Focus Timer */}
          <button
            type="button"
            id="sidebar-feedback-btn"
            onClick={() => {
              logFeatureUse('Feedback Modal');
              setIsFeedbackModalOpen(true);
            }}
            title={!isDrawerExpanded ? "Send Feedback" : undefined}
            className={`group relative flex items-center rounded-xl transition-all duration-200 w-full text-left cursor-pointer ${
              isDrawerExpanded ? 'px-3 py-2.5 gap-3' : 'px-0 py-2.5 justify-center'
            } text-theme-muted hover:text-theme-text hover:bg-theme-cardHover`}
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-theme-muted group-hover:text-theme-text transition-transform group-hover:scale-110" />
            </div>
            {isDrawerExpanded && (
              <span className="text-xs font-medium tracking-tight truncate flex-1">
                Feedback
              </span>
            )}
            {!isDrawerExpanded && (
              <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-theme-surface/95 border border-theme-border shadow-xl text-xs font-medium text-theme-text whitespace-nowrap z-50 pointer-events-none animate-fadeIn">
                <span>Feedback</span>
              </div>
            )}
          </button>
        </nav>

        {/* Dedicated Admin Portal Navigation Link at bottom above profile/footer section */}
        <div className="px-2 py-1.5 shrink-0 border-t border-theme-border/60">
          <a
            id="sidebar-admin-link"
            href="/admin.html"
            style={{ display: hasAdminAccess ? 'flex' : 'none' }}
            onClick={() => {
              if (isMobileOpen && onCloseMobile) onCloseMobile();
              if (typeof document !== 'undefined') document.body.style.overflow = '';
            }}
            className={`group relative flex items-center h-10 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
              activeTabId === 'admin'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40 font-semibold'
                : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/30 font-medium'
            }`}
            title="🛡️ Admin Portal"
          >
            <div className="flex items-center justify-center shrink-0 w-5 h-5">
              <ShieldCheck className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>

            {isDrawerExpanded && (
              <span className="ml-2.5 text-xs font-medium tracking-tight truncate flex-1">
                Admin Portal
              </span>
            )}

            {!isDrawerExpanded && (
              <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-theme-surface/95 border border-theme-border shadow-xl text-xs font-medium text-theme-text whitespace-nowrap z-50 pointer-events-none animate-fadeIn">
                <span>🛡️ Admin Portal</span>
              </div>
            )}
          </a>
        </div>

        {/* Sidebar Footer Stats / Quick Ticker */}
        <div className="p-3 border-t border-theme-border/60 shrink-0">
          {isDrawerExpanded ? (
            <div className="p-2.5 rounded-xl bg-theme-bg/60 border border-theme-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-theme-muted font-medium">Daily Focus</span>
              </div>
              <span className="font-mono-numbers font-bold text-xs text-theme-text">
                {streakData?.todayHours || 0}h
              </span>
            </div>
          ) : (
            <div className="flex justify-center" title={`Today: ${streakData?.todayHours || 0}h logged`}>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
          )}
        </div>

        {/* Feedback Form Modal */}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          currentUserEmail={AdminAuth.getUserEmail() || ''}
          onSubmitSuccess={(msg) => {
            setFeedbackToast(msg || "Thank you! Your feedback has been sent directly to the developer.");
            setTimeout(() => setFeedbackToast(null), 4000);
          }}
        />

        {/* Confirmation Toast Upon Feedback Submission */}
        {feedbackToast && (
          <div 
            id="feedback-toast"
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl glass-panel border border-emerald-500/30 bg-emerald-950/90 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-slideUp backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}
      </aside>
    </>
  );
}
