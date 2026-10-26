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
  ShieldCheck
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme, FEATURE_COLORS } from '../context/ThemeContext';
import { soundEngine } from '../utils/audio';
import { celebrateTaskCompletion } from '../utils/confetti';
import { canAccessAdmin, AdminAuth } from '../../admin-config';

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
 * 9 Core Views in Clean Order
 * Ensure Skill Tracker appears strictly once
 */
export const SIDEBAR_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/index.html', tooltip: 'Dashboard & Overview' },
  { id: 'routine', name: 'Daily Routine', icon: Clock, href: '/routine.html', tooltip: 'Daily Study Routine' },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon, href: '/calendar.html', tooltip: 'Academic Calendar' },
  { id: 'syllabus', name: 'Subjects & Syllabus', icon: BookOpen, href: '/syllabus.html', isProtected: true, tooltip: 'Course Syllabus & Subjects' },
  { id: 'revision', name: 'Revision Queue', icon: Repeat, href: '/revision.html', isProtected: true, tooltip: 'Spaced Repetition Queue' },
  { id: 'radar', name: 'Exam Radar', icon: CalendarIcon, href: '/radar.html', isProtected: true, tooltip: 'Exam Radar & Deadlines' },
  { id: 'skills', name: 'Skill Tracker', icon: Award, href: '/skills.html', isProtected: true, tooltip: 'Skill Tracker & Mastery' },
  { id: 'notes', name: 'Drive Notes', icon: FileText, href: '/notes.html', isProtected: true, tooltip: 'Google Drive Notes Vault' },
  { id: 'timer', name: 'Focus Timer', icon: StopwatchIcon, href: '/timer.html', tooltip: 'Focus Timer & Deep Work' }
];

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
  onOpenDriveNotesDemoModal
}) {
  const { 
    exams = [], 
    routineSlots = [], 
    getTodayRevisionQueue, 
    addTimerSession, 
    streakData 
  } = useData();

  const { isAuthenticated, openAuthModal, isDemo } = useAuth();
  const { isFeatureCoded } = useTheme();

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
      {/* Mobile Drawer Backdrop Overlay (< 768px) */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* Main Single Primary Navigation Rail */}
      <aside 
        id="app-sidebar"
        aria-label="Sidebar Navigation Rail"
        className={`fixed top-16 bottom-0 left-0 z-40 border-r border-theme-border bg-theme-surface/90 backdrop-blur-xl transition-all duration-300 ease-in-out select-none flex flex-col ${
          isMobileOpen 
            ? 'translate-x-0 shadow-2xl w-[250px]' 
            : '-translate-x-full md:translate-x-0'
        } ${
          isExpanded ? 'md:w-[250px]' : 'md:w-16'
        }`}
      >
        {/* Sidebar Header with Hamburger / Close Toggle */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-theme-border/60 shrink-0">
          {/* Mobile Header: Full title + Close X Button */}
          <div className="md:hidden flex items-center justify-between w-full">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-muted font-display">
              Navigation Rail
            </span>
            <button
              onClick={onCloseMobile}
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

        {/* Navigation Items (Core 9 views in clean order) */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1.5 custom-scrollbar">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTabId;
            const isDemoLockedNotes = isDemo && item.id === 'notes';
            const isGuestLocked = !isAuthenticated && LOCKED_TAB_IDS.includes(item.id);
            const isLocked = isDemoLockedNotes || isGuestLocked;
            const isTimer = item.id === 'timer';

            // Solid glowing pill highlight styling
            const pillStyle = ACTIVE_PILL_STYLES[item.id];
            const itemActiveStyle = isActive && pillStyle ? {
              background: pillStyle.bg,
              boxShadow: pillStyle.shadow,
              borderColor: pillStyle.border
            } : undefined;

            const handleClick = (e) => {
              if (isMobileOpen && onCloseMobile) {
                onCloseMobile();
              }
              if (isDemoLockedNotes) {
                e.preventDefault();
                if (onOpenDriveNotesDemoModal) onOpenDriveNotesDemoModal();
                return;
              }
              if (isGuestLocked) {
                e.preventDefault();
                openAuthModal(item.id, item.href);
                return;
              }
            };

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={handleClick}
                title={!isDrawerExpanded ? item.tooltip : undefined}
                style={itemActiveStyle}
                className={`group relative flex items-center rounded-xl transition-all duration-200 ${
                  isDrawerExpanded ? 'px-3 py-2.5 gap-3' : 'px-0 py-2.5 justify-center'
                } ${
                  isActive
                    ? 'text-white font-semibold border shadow-lg'
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

                      {/* Lock Dot */}
                      {isLocked && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500/30 border border-amber-400 flex items-center justify-center">
                          <Lock className="w-2 h-2 text-amber-300" />
                        </span>
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

                    {/* Routine Pending Badge [Badge: 1] */}
                    {!isLocked && item.id === 'routine' && pendingRoutineCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                        isActive ? 'bg-white text-emerald-800' : 'bg-emerald-500 text-white'
                      }`}>
                        {pendingRoutineCount}
                      </span>
                    )}

                    {/* Revision Due Badge [Badge: 4] */}
                    {!isLocked && item.id === 'revision' && dueRevisionCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                        isActive ? 'bg-white text-purple-900' : 'bg-violet-600 text-white'
                      }`}>
                        {dueRevisionCount}
                      </span>
                    )}

                    {/* Exam Radar Urgent Badge [Badge: 2 or 3] */}
                    {!isLocked && item.id === 'radar' && urgentExamsCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers shrink-0 ${
                        isActive ? 'bg-white text-rose-800' : 'bg-rose-500 text-white'
                      }`}>
                        {urgentExamsCount}
                      </span>
                    )}

                    {/* Lock Indicator for Drive Notes or Guest Tabs */}
                    {isLocked && (
                      <span 
                        title={isDemoLockedNotes ? "Locked in demo mode" : "Sign in with Google required"}
                        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0 ml-auto"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span className="text-[8px] uppercase font-bold tracking-wider">Locked</span>
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
        </nav>

        {/* Dedicated Admin Portal Navigation Link at bottom above profile/footer section */}
        <div className="px-2 py-1.5 shrink-0 border-t border-theme-border/60">
          <a
            id="sidebar-admin-link"
            href="/admin.html"
            style={{ display: hasAdminAccess ? 'flex' : 'none' }}
            onClick={() => {
              if (isMobileOpen && onCloseMobile) onCloseMobile();
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
      </aside>
    </>
  );
}
