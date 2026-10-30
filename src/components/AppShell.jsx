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
  CloudOff,
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
  User,
  Menu,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Bell,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import Logo from './Logo';
import DriveModal from './DriveModal';
import AuthModal from './AuthModal';
import LockedFeatureOverlay from './LockedFeatureOverlay';
import DriveNotesDemoModal from './DriveNotesDemoModal';
import CollapsibleSidebar, { StopwatchIcon, SIDEBAR_ITEMS } from './CollapsibleSidebar';
import { ThemeProvider, useTheme, FEATURE_COLORS } from '../context/ThemeContext';
import { DataProvider, useData } from '../context/DataContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import RollingNumber from './RollingNumber';
import { sanitizeUrl } from '../utils/security';
import { isDemoUser, getDemoRemainingSeconds, clearDemoSession, getActiveUserId } from '../../auth-guard';
import { formatRelativeSyncTime, getLastSyncedTimestamp, verifyOrRequestDriveToken } from '../services/cloud-sync';
import ErrorBoundary from './ErrorBoundary';
import { 
  getPlatformAnnouncement, 
  getEmergencyKillswitches, 
  isSuperAdmin, 
  canAccessAdmin,
  ADMIN_STORAGE_KEYS 
} from '../../admin-config';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  startNotificationScheduler 
} from '../../notifications.js';

export { default as CollapsibleSidebar, StopwatchIcon, SIDEBAR_ITEMS } from './CollapsibleSidebar';

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
  { id: 'timer', name: 'Focus Timer', icon: StopwatchIcon, href: '/timer.html', pathRegex: /\/timer\.html$/, tooltip: 'Focus Timer & Deep Work' },
];

export const LOCKED_TAB_IDS = ['syllabus', 'revision', 'radar', 'skills', 'notes'];

// Persistent Shared Top Header
export function SharedHeader({ 
  onOpenDriveModal, 
  onOpenLinksModal, 
  onOpenDriveNotesDemoModal,
  onToggleSidebar,
  isSidebarExpanded = true
}) {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks } = useData();
  const { isAuthenticated, userProfile, signOut, openAuthModal, isDemo } = useAuth();
  
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [demoRemainingSec, setDemoRemainingSec] = useState(() => getDemoRemainingSeconds());
  const [relativeSyncTime, setRelativeSyncTime] = useState(() => {
    return formatRelativeSyncTime(getLastSyncedTimestamp());
  });
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());

  useEffect(() => {
    const handlePermissionChange = (e) => {
      setNotifPermission(e.detail?.permission || getNotificationPermission());
    };
    window.addEventListener('studyflow-notification-permission-changed', handlePermissionChange);
    return () => window.removeEventListener('studyflow-notification-permission-changed', handlePermissionChange);
  }, []);

  const handleToggleNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
  };

  // Periodically refresh relative time for Drive Sync tooltip
  useEffect(() => {
    const updateRelative = () => {
      setRelativeSyncTime(formatRelativeSyncTime(getLastSyncedTimestamp()));
    };
    updateRelative();
    const interval = setInterval(updateRelative, 10000);
    window.addEventListener('studyflow-cloud-sync-status', updateRelative);
    return () => {
      clearInterval(interval);
      window.removeEventListener('studyflow-cloud-sync-status', updateRelative);
    };
  }, []);
  
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
        
        {/* Brand Logo & Sidebar Hamburger Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            id="sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title={isSidebarExpanded ? "Collapse Sidebar (64px rail)" : "Expand Sidebar (250px drawer)"}
            aria-label="Toggle navigation sidebar"
            aria-expanded={isSidebarExpanded}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-cardHover border border-theme-border/60 transition-all cursor-pointer flex items-center justify-center active:scale-95"
          >
            <Menu className="w-4 h-4" />
          </button>
          <a href="/index.html" className="focus:outline-none flex items-center">
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
            title={streakData?.streakCount === 0 ? "Day 1 - Ready to start!" : `Study Streak: ${streakData?.streakCount || 0} days active! Keep it up.`}
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
              {streakData?.streakCount === 0 ? "0 days streak" : "days streak"}
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

          {/* Study Reminder Notification Toggle */}
          <button
            id="notification-reminder-toggle"
            type="button"
            onClick={handleToggleNotifications}
            title={notifPermission === 'granted' ? "🔔 Study reminders active (30 mins prior)" : "🔔 Enable Study Reminders"}
            className={`top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 shadow-sm cursor-pointer ${
              notifPermission === 'granted'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                : 'bg-theme-surface hover:bg-theme-cardHover border-theme-border text-theme-muted hover:text-theme-text'
            }`}
          >
            <Bell className={`w-3.5 h-3.5 ${notifPermission === 'granted' ? 'text-amber-500 fill-amber-500/20' : 'text-theme-muted'}`} />
            <span className="hidden sm:inline">
              {notifPermission === 'granted' ? "🔔 Reminders Active" : "🔔 Enable Study Reminders"}
            </span>
          </button>

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
            getEmergencyKillswitches().driveSync === false ? (
              <div 
                title="Google Drive sync is temporarily disabled by administrator"
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold shadow-sm select-none"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline font-semibold">Drive Sync Disabled</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {syncStatus === 'syncing' ? (
                  <div
                    onClick={onOpenDriveModal}
                    title="Saving changes to Google Drive..."
                    className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold shadow-sm cursor-pointer transition-all animate-pulse select-none"
                  >
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="hidden sm:inline font-semibold">Syncing...</span>
                  </div>
                ) : syncStatus === 'synced' ? (
                  <div
                    onClick={onOpenDriveModal}
                    title={`Google Drive is connected and synchronized with your account. Last synced: ${relativeSyncTime || 'Just now'}`}
                    className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-xs font-semibold shadow-sm cursor-pointer hover:bg-emerald-500/15 transition-all select-none"
                  >
                    <div className="relative flex items-center justify-center">
                      <Cloud className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-theme-surface bg-emerald-400"></span>
                    </div>
                    <span className="hidden sm:inline font-semibold">Synced</span>
                  </div>
                ) : syncStatus === 'needs_auth' ? (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
                        verifyOrRequestDriveToken({ promptUserIfConsentNeeded: true }).then(t => {
                          if (t && syncNowToDrive) syncNowToDrive();
                        });
                      } else {
                        openAuthModal('general');
                      }
                    }}
                    title="Click to grant Google Drive permission for cloud sync"
                    className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 text-xs font-semibold shadow-sm cursor-pointer transition-all select-none animate-pulse-soft"
                  >
                    <Cloud className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-xs">Click to Authorize Drive</span>
                  </button>
                ) : (
                  <div
                    onClick={onOpenDriveModal}
                    title="Offline or unsynced — all progress saved locally to your device"
                    className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold shadow-sm cursor-pointer hover:bg-amber-500/15 transition-all select-none"
                  >
                    <CloudOff className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline font-semibold">Offline - Saved locally</span>
                  </div>
                )}

                {/* Explicit "Sync Cloud Data" Button in Header */}
                <button
                  id="header-sync-now-btn"
                  onClick={syncNowToDrive}
                  title="Bidirectional Cloud Sync: uploads laptop data if newer, or downloads cloud data if phone is missing data"
                  className="top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border hover:border-theme-accent/40 text-xs font-semibold text-theme-text hover:text-theme-accent transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
                >
                  <span className="text-xs">☁️</span>
                  <span className="font-semibold">Sync Now</span>
                  <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin text-theme-accent' : 'text-theme-muted'}`} />
                </button>
              </div>
            )
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

                    {/* Explicit Sync Cloud Data Action */}
                    {!isDemo && (
                      <button
                        id="dropdown-sync-now-btn"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          if (syncNowToDrive) syncNowToDrive();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-theme-text hover:bg-theme-cardHover transition-colors mb-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <RefreshCw className={`w-3.5 h-3.5 text-theme-accent ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                          <span>☁️ Sync Cloud Data</span>
                        </div>
                        <span className="text-[10px] text-theme-muted font-normal">
                          {syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'needs_auth' ? 'Auth Needed' : 'Offline'}
                        </span>
                      </button>
                    )}

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

// Deprecated: Redundant Horizontal Top Navigation Bar has been removed across all pages
// in favor of the exclusive left collapsible navigation rail (#app-sidebar).
export function SharedNavBar() {
  return null;
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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('studyflow_sidebar_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isAuthenticated, isDemo } = useAuth();
  const { mergeToastMessage, setMergeToastMessage } = useData();

  // Background 30-min Reminder Scheduler
  useEffect(() => {
    const activeUserId = getActiveUserId();
    if (!activeUserId || activeUserId === 'guest') return;
    const scheduler = startNotificationScheduler(activeUserId, 60000);
    return () => scheduler.stop();
  }, []);

  // Tomorrow Plan Auto-Merged Toast Listener
  const [mergedToast, setMergedToast] = useState(null);

  useEffect(() => {
    const handleMerged = (e) => {
      if (e.detail?.message) {
        setMergedToast(e.detail.message);
        const timer = setTimeout(() => setMergedToast(null), 6000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('studyflow-tomorrow-plan-merged', handleMerged);
    return () => window.removeEventListener('studyflow-tomorrow-plan-merged', handleMerged);
  }, []);

  useEffect(() => {
    if (mergeToastMessage) {
      setMergedToast(mergeToastMessage);
      const timer = setTimeout(() => {
        setMergedToast(null);
        if (setMergeToastMessage) setMergeToastMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [mergeToastMessage, setMergeToastMessage]);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileSidebarOpen(prev => !prev);
    } else {
      setIsSidebarExpanded(prev => {
        const next = !prev;
        try {
          localStorage.setItem('studyflow_sidebar_expanded', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  };

  const isGuestLockedTab = !isAuthenticated && LOCKED_TAB_IDS.includes(activeTabId);
  const isDemoLockedNotes = isDemo && activeTabId === 'notes';

  // Global Announcement Banner State
  const [announcement, setAnnouncement] = useState(() => getPlatformAnnouncement());
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState(false);

  useEffect(() => {
    const syncAnnouncement = () => {
      const active = getPlatformAnnouncement();
      setAnnouncement(active);
      if (active) {
        const dismissed = sessionStorage.getItem(`announcement_dismissed_${active.id}`);
        setIsAnnouncementDismissed(dismissed === 'true');
      }
    };
    syncAnnouncement();
    window.addEventListener('studyflow-announcement-changed', syncAnnouncement);
    window.addEventListener('storage', syncAnnouncement);
    return () => {
      window.removeEventListener('studyflow-announcement-changed', syncAnnouncement);
      window.removeEventListener('storage', syncAnnouncement);
    };
  }, []);

  const handleDismissAnnouncement = () => {
    if (announcement) {
      sessionStorage.setItem(`announcement_dismissed_${announcement.id}`, 'true');
      setIsAnnouncementDismissed(true);
    }
  };

  // Access Denied Alert from /admin.html
  const [accessDeniedAlert, setAccessDeniedAlert] = useState(() => {
    if (typeof window === 'undefined') return null;
    const param = new URLSearchParams(window.location.search).get('access_denied');
    const alertMsg = sessionStorage.getItem(ADMIN_STORAGE_KEYS.ACCESS_DENIED_ALERT);
    if (param === 'admin' || alertMsg) {
      sessionStorage.removeItem(ADMIN_STORAGE_KEYS.ACCESS_DENIED_ALERT);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('access_denied');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
      } catch {}
      return alertMsg || "Access Denied: Administrator privileges required.";
    }
    return null;
  });

  // Emergency Controls: Maintenance Mode & Killswitches
  const [killswitches, setKillswitches] = useState(() => getEmergencyKillswitches());
  const [isAdminUser, setIsAdminUser] = useState(() => isSuperAdmin());

  useEffect(() => {
    const syncKillswitches = () => {
      setKillswitches(getEmergencyKillswitches());
      setIsAdminUser(isSuperAdmin());
    };
    syncKillswitches();
    window.addEventListener('studyflow-killswitch-changed', syncKillswitches);
    window.addEventListener('studyflow-role-switched', syncKillswitches);
    window.addEventListener('storage', syncKillswitches);
    return () => {
      window.removeEventListener('studyflow-killswitch-changed', syncKillswitches);
      window.removeEventListener('studyflow-role-switched', syncKillswitches);
      window.removeEventListener('storage', syncKillswitches);
    };
  }, []);

  useEffect(() => {
    if (isDemo && activeTabId === 'notes') {
      setIsDriveNotesDemoModalOpen(true);
    }
  }, [isDemo, activeTabId]);

  useEffect(() => {
    const feature = activeTabId || 'dashboard';
    document.documentElement.setAttribute('data-active-feature', feature);
  }, [activeTabId]);

  const isPlatformMaintenanceLocked = killswitches.maintenanceMode && !isAdminUser;

  return (
    <div 
      className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-200"
      data-active-feature={activeTabId || 'dashboard'}
    >
      
      {/* Top Utility Header */}
      <SharedHeader 
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onOpenLinksModal={() => setIsLinksModalOpen(true)}
        onOpenDriveNotesDemoModal={() => setIsDriveNotesDemoModalOpen(true)}
        onToggleSidebar={handleToggleSidebar}
        isSidebarExpanded={isSidebarExpanded}
      />

      {/* Access Denied Alert Toast */}
      {accessDeniedAlert && (
        <div className="w-full bg-rose-600 text-white py-2.5 px-4 shadow-lg flex items-center justify-between text-xs sm:text-sm font-semibold animate-fadeIn z-50">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
              <span>{accessDeniedAlert}</span>
            </div>
            <button 
              onClick={() => setAccessDeniedAlert(null)}
              className="p-1 hover:bg-white/20 rounded cursor-pointer transition-colors"
              aria-label="Dismiss access alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Global Announcement Banner across all pages */}
      {announcement && !isAnnouncementDismissed && (
        <aside 
          role="alert" 
          aria-label="Platform Announcement"
          className={`w-full py-2 px-4 shadow-md backdrop-blur-md flex items-center justify-between text-xs sm:text-sm font-medium z-40 transition-all border-b ${
            announcement.urgency === 'warning'
              ? 'bg-gradient-to-r from-rose-900/90 via-amber-900/80 to-rose-900/90 border-rose-500/40 text-rose-100'
              : announcement.urgency === 'motivational'
              ? 'bg-gradient-to-r from-emerald-900/90 via-teal-900/80 to-emerald-900/90 border-emerald-500/40 text-emerald-100'
              : 'bg-gradient-to-r from-indigo-900/90 via-blue-900/80 to-indigo-900/90 border-indigo-500/40 text-indigo-100'
          }`}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {announcement.urgency === 'warning' ? (
                <span className="p-1 rounded-lg bg-rose-500/25 text-rose-300 shrink-0"><AlertTriangle className="w-4 h-4" /></span>
              ) : announcement.urgency === 'motivational' ? (
                <span className="p-1 rounded-lg bg-emerald-500/25 text-emerald-300 shrink-0"><Sparkles className="w-4 h-4" /></span>
              ) : (
                <span className="p-1 rounded-lg bg-blue-500/25 text-blue-300 shrink-0"><Bell className="w-4 h-4" /></span>
              )}
              <div className="flex items-center gap-2 truncate">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                  announcement.urgency === 'warning'
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                    : announcement.urgency === 'motivational'
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                    : 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                }`}>
                  {announcement.urgency === 'warning' ? 'Exam Warning' : announcement.urgency === 'motivational' ? 'Motivational' : 'Notice'}
                </span>
                <span className="truncate font-medium">{announcement.text}</span>
              </div>
            </div>
            <button
              onClick={handleDismissAnnouncement}
              title="Dismiss announcement"
              className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0 text-white/80 hover:text-white cursor-pointer"
              aria-label="Close announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Maintenance Mode Super Admin Warning Indicator */}
      {killswitches.maintenanceMode && isAdminUser && (
        <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-300 py-1.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 z-40 select-none">
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>⚠️ Maintenance Mode Active: Regular students see the Platform Updating lock screen. Super Admin bypass enabled.</span>
        </div>
      )}

      {/* Main Body with Left Collapsible Sidebar Navigation Rail and Main View */}
      <div className="flex-1 flex w-full relative">
        {/* Left Collapsible Sidebar Navigation Rail across all pages */}
        <CollapsibleSidebar 
          activeTabId={activeTabId} 
          isExpanded={isSidebarExpanded} 
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => {
            setIsMobileSidebarOpen(false);
            if (typeof document !== 'undefined') document.body.style.overflow = '';
          }}
          onToggle={handleToggleSidebar}
          onOpenDriveNotesDemoModal={() => setIsDriveNotesDemoModalOpen(true)}
        />

        {/* Main Content Area - Desktop margin matches sidebar state with smooth transition */}
        <div 
          id="main-layout-wrapper"
          className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out ${
            isSidebarExpanded ? 'md:ml-[250px]' : 'md:ml-16'
          }`}
        >
          <main 
            id="main-content" 
            className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8"
          >
            {/* Page Content Container: If locked tab in guest mode, render frosted glass locked overlay */}
            <div className="transition-all duration-300 animate-tab-enter">
              {isPlatformMaintenanceLocked ? (
                <div className="relative min-h-[520px] rounded-3xl overflow-hidden p-8 flex flex-col items-center justify-center text-center glass-panel border border-amber-500/40 shadow-2xl backdrop-blur-2xl bg-theme-surface/90">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/40 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
                    <Wrench className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                    <span>Platform Updating</span>
                  </div>
                  <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-theme-text tracking-tight mb-2">
                    Platform Updating
                  </h2>
                  <p className="text-xs sm:text-sm text-theme-muted max-w-md mx-auto mb-6 leading-relaxed">
                    Study Tracker is currently undergoing scheduled maintenance. Please check back shortly. Your personal data, syllabus progress, and notes remain safe in your personal Google account.
                  </p>
                  <div className="flex items-center gap-3">
                    <a
                      href="/login.html"
                      className="px-6 py-2.5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs shadow-lg transition-all"
                    >
                      Go to Sign In
                    </a>
                  </div>
                </div>
              ) : isDemoLockedNotes ? (
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
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </LockedFeatureOverlay>
              ) : (
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              )}
            </div>
          </main>

          {/* Persistent Shared Footer */}
          <SharedFooter />
        </div>
      </div>

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

      {/* Next-Day Auto-Merge Success Toast */}
      {mergedToast && (
        <div 
          id="tomorrow-plan-merged-toast"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-theme-surface/95 border border-amber-500/40 text-theme-text p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-slideUp backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">🌅</span>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-theme-text">
                {mergedToast}
              </p>
              <p className="text-[11px] text-theme-muted mt-0.5">
                Planned topics merged into your Daily Routine for today.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMergedToast(null);
              if (setMergeToastMessage) setMergeToastMessage(null);
            }}
            className="p-1.5 hover:bg-theme-cardHover rounded-lg text-theme-muted hover:text-theme-text transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <AppLayout activeTabId={activeTabId}>
                <ErrorBoundary>
                  <Component />
                </ErrorBoundary>
              </AppLayout>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
