import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Award, 
  FileText, 
  Clock, 
  Repeat, 
  Link2, 
  Flame, 
  Cloud, 
  RefreshCw, 
  ChevronDown, 
  Check, 
  X, 
  ExternalLink, 
  Plus, 
  Trash2, 
  LogOut,
  LogIn,
  Lock,
  ShieldCheck,
  User
} from 'lucide-react';
import Logo from './Logo';
import DriveModal from './DriveModal';
import AuthModal from './AuthModal';
import LockedFeatureOverlay from './LockedFeatureOverlay';
import DriveNotesDemoModal from './DriveNotesDemoModal';
import { ThemeProvider, useTheme, FEATURE_COLORS } from '../context/ThemeContext';
import { DataProvider, useData } from '../context/DataContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import RollingNumber from './RollingNumber';
import { sanitizeUrl } from '../utils/security';
import { isDemoUser, getDemoRemainingSeconds, clearDemoSession } from '../../auth-guard';

export const STORAGE_KEY_PREFIX = 'studyflow_data_';

// Navigation Tab Definitions for Multi-Page Routing
export const NAV_TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/index.html', pathRegex: /^\/(index\.html)?$/ },
  { id: 'routine', name: 'Daily Routine', icon: Clock, href: '/routine.html', pathRegex: /\/routine\.html$/ },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon, href: '/calendar.html', pathRegex: /\/calendar\.html$/ },
  { id: 'syllabus', name: 'Subjects & Syllabus', icon: BookOpen, href: '/syllabus.html', pathRegex: /\/syllabus\.html$/, isProtected: true },
  { id: 'revision', name: 'Revision Queue', icon: Repeat, href: '/revision.html', pathRegex: /\/revision\.html$/, isProtected: true },
  { id: 'radar', name: 'Exam Radar', icon: CalendarIcon, href: '/radar.html', pathRegex: /\/radar\.html$/, isProtected: true },
  { id: 'skills', name: 'Skill Tracker', icon: Award, href: '/skills.html', pathRegex: /\/skills\.html$/, isProtected: true },
  { id: 'notes', name: 'Drive Notes', icon: FileText, href: '/notes.html', pathRegex: /\/notes\.html$/, isProtected: true },
  { id: 'timer', name: 'Focus Timer', icon: Clock, href: '/timer.html', pathRegex: /\/timer\.html$/ },
];

export const LOCKED_TAB_IDS = ['syllabus', 'revision', 'radar', 'skills', 'notes'];

// Persistent Shared Top Header
export function SharedHeader({ onOpenDriveModal, onOpenLinksModal, onOpenDriveNotesDemoModal }) {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks } = useData();
  const { isAuthenticated, userProfile, signOut, openAuthModal, isDemo } = useAuth();
  
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [demoRemainingSec, setDemoRemainingSec] = useState(() => getDemoRemainingSeconds());
  
  const themeDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Live 1-second interval for 7-minute demo session countdown
  useEffect(() => {
    if (!isDemo) return;

    const tick = () => {
      const remaining = getDemoRemainingSeconds();
      setDemoRemainingSec(remaining);
      if (remaining <= 0) {
        clearDemoSession();
        window.location.replace('/login.html?expired=true');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isDemo]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target)) {
        setThemeDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  const demoMins = Math.floor(demoRemainingSec / 60);
  const demoSecs = demoRemainingSec % 60;
  const formattedDemoTimer = `${String(demoMins).padStart(2, '0')}:${String(demoSecs).padStart(2, '0')}`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-theme-border bg-theme-bg/85 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand Logo - Navigates to Dashboard index.html */}
        <div className="shrink-0">
          <a href="/index.html" className="focus:outline-none">
            <Logo />
          </a>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
          
          {/* Formatted Date */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs text-theme-muted font-medium">
            <CalendarIcon className="w-3.5 h-3.5 text-theme-accent" />
            <span className="font-mono-numbers text-theme-text">{todayFormatted}</span>
          </div>

          {/* Live Streak Counter */}
          <div 
            title={`Study Streak: ${streakData?.streakCount || 0} days active! Keep it up.`}
            className="streak-flame-badge group flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-default"
          >
            <div className="relative">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-flame-flicker" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
            </div>
            <span className="font-mono-numbers font-bold text-xs sm:text-sm text-amber-500">
              <RollingNumber value={streakData?.streakCount || 0} duration={700} />
            </span>
            <span className="hidden sm:inline text-xs text-amber-600/90 dark:text-amber-400/90 font-medium">
              days streak
            </span>
          </div>

          {/* Live 7-Minute Demo Sandbox Countdown Pill */}
          {isDemo && (
            <div 
              id="demo-timer-pill"
              title="7-minute isolated demo sandbox session. Resets automatically on expiration."
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 text-amber-400 hover:border-amber-400/60 shadow-sm cursor-default select-none animate-pulse-soft"
            >
              <span className="text-xs sm:text-sm">⏱️</span>
              <span className="font-mono-numbers font-bold text-xs sm:text-sm tracking-wide text-amber-300 dark:text-amber-200">
                Demo: {formattedDemoTimer}
              </span>
            </div>
          )}

          {/* Quick Links Hub Modal Launcher */}
          <button
            onClick={onOpenLinksModal}
            title="Open Important Links & Resource Hub"
            className="top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border hover:border-theme-accent/40 text-xs font-medium text-theme-muted hover:text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95 shadow-sm"
          >
            <Link2 className="w-3.5 h-3.5 text-theme-accent" />
            <span className="hidden md:inline">Links</span>
            {(importantLinks || []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-theme-bg text-theme-accent border border-theme-accent/20 font-mono-numbers">
                {(importantLinks || []).length}
              </span>
            )}
          </button>

          {/* Google Drive Status & "Drive Synced" Badge */}
          {isAuthenticated && !isDemo ? (
            <div className="flex items-center gap-1.5">
              <div
                onClick={onOpenDriveModal}
                title="Google Drive is connected and synchronized with your account"
                className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-xs font-semibold shadow-sm cursor-pointer hover:bg-emerald-500/15 transition-all"
              >
                <div className="relative flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-theme-surface bg-emerald-400"></span>
                </div>
                <span className="hidden sm:inline font-semibold">Drive Synced</span>
              </div>

              <button
                onClick={syncNowToDrive}
                title="Sync now to personal Google Drive"
                className="top-action-link p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                if (isDemo) {
                  if (onOpenDriveNotesDemoModal) onOpenDriveNotesDemoModal();
                } else {
                  openAuthModal('general');
                }
              }}
              title={isDemo ? "Drive Notes disabled in demo mode" : "Sign in with Google to enable Drive cloud synchronization"}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-theme-border/60 bg-theme-surface/60 text-theme-muted hover:text-theme-text text-xs font-medium shadow-sm cursor-pointer transition-all"
            >
              <Cloud className="w-4 h-4 text-theme-muted" />
              <span className="text-[11px]">{isDemo ? 'Drive Locked' : 'Drive Sync'}</span>
            </div>
          )}

          {/* User Profile OR Clean Sign-In Button */}
          {isAuthenticated && userProfile ? (
            <div className="flex items-center gap-1.5">
              {/* Profile Dropdown Launcher */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 px-2 sm:px-2.5 py-1 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs shadow-sm transition-all active:scale-95 focus:outline-none"
                  title={`Signed in as ${userProfile.name} (${userProfile.email})`}
                >
                  {userProfile.picture ? (
                    <img 
                      src={userProfile.picture} 
                      alt={userProfile.name} 
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/30"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 text-white font-bold flex items-center justify-center text-[10px]">
                      {(userProfile.name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline font-semibold text-theme-text truncate max-w-[100px]">
                    {userProfile.name?.split(' ')[0] || 'Student'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-theme-muted transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile & Sign Out Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown p-3 shadow-2xl z-50 animate-fadeIn border border-theme-border">
                    {/* User Info Header */}
                    <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-theme-border/60">
                      {userProfile.picture ? (
                        <img 
                          src={userProfile.picture} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/30" 
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 text-white font-bold flex items-center justify-center text-xs">
                          {(userProfile.name || 'S').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-theme-text truncate">{userProfile.name}</p>
                        <p className="text-[11px] text-theme-muted truncate">{userProfile.email}</p>
                      </div>
                    </div>

                    {/* Session Indicator */}
                    <div className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-medium mb-2 flex items-center gap-1.5 ${
                      isDemo 
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' 
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`}></span>
                      <span>{isDemo ? 'Demo Sandbox (7 Min Limit)' : 'Persistent Session Active (1 Year)'}</span>
                    </div>

                    {/* Sign Out Option */}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>{isDemo ? 'End Demo Preview' : 'Sign Out'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Sign Out Action Button */}
              <button
                onClick={() => signOut()}
                title={isDemo ? "End Demo Session" : "Sign Out of Study Tracker and Revoke Google Session"}
                className="top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-rose-500/10 border border-theme-border hover:border-rose-500/30 text-xs font-semibold text-theme-muted hover:text-rose-400 transition-all duration-200 active:scale-95 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">{isDemo ? 'Exit Demo' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            /* Clean Sign-In Button for Guests */
            <button
              onClick={() => openAuthModal('general')}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200 hover:brightness-105 active:scale-95 cursor-pointer"
              title="Sign in with Google to unlock all features"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Appearance / Theme Dropdown */}
          <div className="relative" ref={themeDropdownRef}>
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="top-action-link flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-medium text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
              aria-label="Toggle Theme"
              title={`Active Theme: ${currentThemeMeta.name}`}
            >
              {(() => {
                const ThemeIcon = currentThemeMeta.icon || Sparkles;
                return <ThemeIcon className="w-3.5 h-3.5 text-theme-accent" />;
              })()}
              <span className="hidden sm:inline font-semibold">
                {currentThemeMeta.name}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform duration-200 ${themeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {themeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown p-2 shadow-2xl z-50 animate-fadeIn border border-theme-border">
                <div className="px-3 py-2 border-b border-theme-border/60 mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
                    Display Appearance
                  </p>
                  <p className="text-xs text-theme-text/80 mt-0.5">
                    Saved automatically across all pages
                  </p>
                </div>

                <div className="space-y-1">
                  {themes.map((t) => {
                    const isSelected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          setThemeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-theme-accent/10 text-theme-text font-semibold border border-theme-accent/30'
                            : 'hover:bg-theme-cardHover text-theme-muted hover:text-theme-text'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-5 h-5 rounded-lg flex items-center justify-center border border-white/10 shrink-0"
                            style={{ backgroundColor: t.bgColor }}
                          >
                            <span 
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: t.primaryColor }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-theme-text font-medium">{t.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-theme-surface text-theme-muted border border-theme-border/60">
                                {t.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-theme-muted mt-0.5 leading-snug">
                              {t.description}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-theme-accent shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}

// Top Tab Navigation Bar linking to dedicated HTML files
export function SharedNavBar({ activeTabId, onOpenDriveNotesDemoModal }) {
  const { exams, getTodayRevisionQueue, routineSlots } = useData();
  const { isAuthenticated, openAuthModal, isDemo } = useAuth();
  const { isFeatureCoded } = useTheme();

  const urgentCount = (exams || []).filter(e => {
    if (e.isCompleted) return false;
    const diffDays = (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  const dueRevisionCount = getTodayRevisionQueue ? getTodayRevisionQueue().length : 0;
  const pendingRoutineSlots = (routineSlots || []).filter(s => !s.completed).length;

  return (
    <div className="mb-6 overflow-x-auto pb-1 sm:pb-0">
      <nav className="flex space-x-1 sm:space-x-2 p-1.5 rounded-2xl glass-panel border border-theme-border w-max min-w-full sm:min-w-0" aria-label="Study Tracker Navigation">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;
          const isDemoLockedNotes = isDemo && tab.id === 'notes';
          const isGuestLocked = !isAuthenticated && LOCKED_TAB_IDS.includes(tab.id);
          const isLocked = isDemoLockedNotes || isGuestLocked;
          const featureMeta = FEATURE_COLORS[tab.id];

          const activeStyle = isActive && isFeatureCoded && featureMeta
            ? { backgroundColor: featureMeta.hex, boxShadow: `0 8px 24px -4px ${featureMeta.glow}` }
            : undefined;

          const handleClick = (e) => {
            if (isDemoLockedNotes) {
              e.preventDefault();
              if (onOpenDriveNotesDemoModal) {
                onOpenDriveNotesDemoModal();
              }
              return;
            }
            if (isGuestLocked) {
              e.preventDefault();
              openAuthModal(tab.id, tab.href);
              return;
            }
          };

          return (
            <a
              key={tab.id}
              href={tab.href}
              onClick={handleClick}
              style={activeStyle}
              className={`nav-tab-item flex items-center space-x-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out relative whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-theme-accent text-white shadow-glow-accent font-semibold'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
              } ${isLocked ? 'cursor-pointer hover:border-amber-500/40' : ''}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
              <span>{tab.name}</span>

              {/* Padlock Icon Visual Cue for Locked Drive Notes in Demo Mode */}
              {isDemoLockedNotes && (
                <span 
                  title="Drive Notes disabled in demo mode"
                  className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold ml-0.5"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span className="text-[8px] uppercase tracking-wider">Locked</span>
                </span>
              )}

              {/* Padlock Icon Visual Cue for Locked Tabs in Guest Mode */}
              {!isDemo && isGuestLocked && (
                <span 
                  title="Sign in with Google required"
                  className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold ml-0.5"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span className="hidden xl:inline text-[8px] uppercase tracking-wider">Locked</span>
                </span>
              )}

              {/* Status Counters */}
              {!isLocked && tab.id === 'routine' && pendingRoutineSlots > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                  isActive ? 'bg-white text-indigo-700' : 'bg-theme-accent text-white'
                }`}>
                  {pendingRoutineSlots}
                </span>
              )}

              {!isLocked && tab.id === 'revision' && dueRevisionCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                  isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
                }`}>
                  {dueRevisionCount}
                </span>
              )}

              {!isLocked && tab.id === 'radar' && urgentCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                  isActive ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
                }`}>
                  {urgentCount}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

// Persistent Footer
export function SharedFooter() {
  return (
    <footer className="mt-auto border-t border-theme-border/60 py-4 text-center text-xs text-theme-muted">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="flex items-center gap-1.5">
          <span>StudyFlow</span>
          <span>•</span>
          <span>Personal Daily Study & Skill Tracker</span>
        </p>
        <p className="text-[11px] font-mono-numbers">
          Client-Side Google Drive API v3 (GIS) & Persistent Local Storage Active
        </p>
      </div>
    </footer>
  );
}

// Quick Links Modal Component
export function QuickLinksModal({ isOpen, onClose }) {
  const { importantLinks, addImportantLink, deleteImportantLink } = useData();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState('common');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    addImportantLink({
      title: title.trim(),
      url: url.trim(),
      scope,
      description: description.trim()
    });
    setTitle('');
    setUrl('');
    setDescription('');
    setIsAddOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-theme-border shrink-0">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-theme-accent" />
            <h3 className="font-display font-bold text-base text-theme-text">
              Quick Links & Academic Resources
            </h3>
          </div>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-text p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {(importantLinks || []).map((link) => (
            <div 
              key={link.id} 
              className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border flex items-start justify-between gap-3 hover:border-theme-accent/30 transition-all"
            >
              <div className="min-w-0 flex-1">
                <a 
                  href={sanitizeUrl(link.url)}
                  target="_blank" 
                  rel="noreferrer" 
                  className="font-semibold text-xs text-theme-text hover:text-theme-accent flex items-center gap-1.5 transition-colors"
                >
                  <span className="truncate">{link.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 text-theme-muted" />
                </a>
                {link.description && (
                  <p className="text-[11px] text-theme-muted mt-0.5 line-clamp-2">{link.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteImportantLink(link.id)}
                className="text-theme-muted hover:text-rose-400 p-1 rounded-lg transition-colors shrink-0"
                title="Remove link"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {(!importantLinks || importantLinks.length === 0) && (
            <p className="text-center text-xs text-theme-muted py-6">No links saved yet.</p>
          )}

          {isAddOpen ? (
            <form onSubmit={handleAdd} className="p-3.5 rounded-xl bg-theme-surface border border-theme-accent/40 space-y-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Link Title (e.g. Course Portal)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
              />
              <input
                type="url"
                required
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
              />
              <input
                type="text"
                placeholder="Notes / description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action px-3 py-1.5 rounded-lg bg-theme-accent text-white font-semibold shadow-sm"
                >
                  Add Resource
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-full py-2 rounded-xl border border-dashed border-theme-border hover:border-theme-accent/60 text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4 text-theme-accent" />
              <span>Add Resource Link</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Master Application Layout Wrapper
export function AppLayout({ activeTabId, children }) {
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  const [isDriveNotesDemoModalOpen, setIsDriveNotesDemoModalOpen] = useState(false);
  const { isAuthenticated, isDemo } = useAuth();

  const isGuestLockedTab = !isAuthenticated && LOCKED_TAB_IDS.includes(activeTabId);
  const isDemoLockedNotes = isDemo && activeTabId === 'notes';

  useEffect(() => {
    if (isDemo && activeTabId === 'notes') {
      setIsDriveNotesDemoModalOpen(true);
    }
  }, [isDemo, activeTabId]);

  useEffect(() => {
    const feature = activeTabId || 'dashboard';
    document.documentElement.setAttribute('data-active-feature', feature);
  }, [activeTabId]);

  return (
    <div 
      className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-200"
      data-active-feature={activeTabId || 'dashboard'}
    >
      
      {/* Top Header */}
      <SharedHeader 
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onOpenLinksModal={() => setIsLinksModalOpen(true)}
        onOpenDriveNotesDemoModal={() => setIsDriveNotesDemoModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs Bar */}
        <SharedNavBar 
          activeTabId={activeTabId} 
          onOpenDriveNotesDemoModal={() => setIsDriveNotesDemoModalOpen(true)}
        />

        {/* Page Content Container: If locked tab in guest mode, render frosted glass locked overlay */}
        <div className="transition-all duration-300 animate-tab-enter">
          {isDemoLockedNotes ? (
            <div className="relative min-h-[520px] rounded-3xl overflow-hidden p-8 flex flex-col items-center justify-center text-center glass-panel border border-theme-border/80 shadow-2xl backdrop-blur-2xl bg-theme-surface/90">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
                <Lock className="w-8 h-8" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                <span>Demo Sandbox Restriction</span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-theme-text tracking-tight mb-2">
                Drive Notes Disabled in Demo Mode
              </h2>
              <p className="text-xs sm:text-sm text-theme-muted max-w-md mx-auto mb-6 leading-relaxed">
                Saving files requires an authentic Google Account with personal Google Drive storage. Sign in with Google to upload and manage notes.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => setIsDriveNotesDemoModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  Sign In with Google
                </button>
                <a
                  href="/index.html"
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all text-center"
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          ) : isGuestLockedTab ? (
            <LockedFeatureOverlay featureKey={activeTabId}>
              {children}
            </LockedFeatureOverlay>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Shared Footer */}
      <SharedFooter />

      {/* Google Drive Integration Modal */}
      <DriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
      />

      {/* Quick Links Modal */}
      <QuickLinksModal
        isOpen={isLinksModalOpen}
        onClose={() => setIsLinksModalOpen(false)}
      />

      {/* Sign In to Unlock Modal */}
      <AuthModal />

      {/* Drive Notes Demo Disabled Modal */}
      <DriveNotesDemoModal
        isOpen={isDriveNotesDemoModalOpen}
        onClose={() => setIsDriveNotesDemoModalOpen(false)}
      />

    </div>
  );
}

// Multi-Page Initializer Helper
export function initPage(Component, activeTabId) {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <AppLayout activeTabId={activeTabId}>
              <Component />
            </AppLayout>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
