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
  ShieldAlert,
  Target,
  Trophy
} from 'lucide-react';
import Logo from './Logo';
import DriveModal from './DriveModal';
import AuthModal from './AuthModal';
import LockedFeatureOverlay from './LockedFeatureOverlay';
import DriveNotesDemoModal from './DriveNotesDemoModal';
import PinLockOverlay from './PinLockOverlay';
import CollapsibleSidebar, { StopwatchIcon, SIDEBAR_ITEMS } from './CollapsibleSidebar';
import { ThemeProvider, useTheme, FEATURE_COLORS } from '../context/ThemeContext';
import { DataProvider, useData } from '../context/DataContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import RollingNumber from './RollingNumber';
import { sanitizeUrl } from '../utils/security';
import { isDemoUser, getDemoRemainingSeconds, clearDemoSession, getActiveUserId } from '../../auth-guard';
import { formatRelativeSyncTime, getLastSyncedTimestamp, verifyOrRequestDriveToken } from '../services/cloud-sync';
import ErrorBoundary from './ErrorBoundary';
import { logFeatureUse } from '../utils/telemetry';
import { 
  getPlatformAnnouncement, 
  getEmergencyKillswitches, 
  isSuperAdmin, 
  canAccessAdmin,
  ADMIN_STORAGE_KEYS,
  TELEMETRY_URL
} from '../../admin-config';
import { syncStudentToLeaderboard } from '../../leaderboard.js';
import { getStudentProfile, getUsernameMonogram } from '../../profile.js';
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
  { id: 'mock-logbook', name: 'Mock Logbook', icon: Target, href: '/mock-logbook.html', pathRegex: /\/mock-logbook\.html$/ },
  { id: 'leaderboard', name: 'Leaderboard', icon: Trophy, href: '/leaderboard.html', pathRegex: /\/leaderboard\.html$/ },
  { id: 'skills', name: 'Skill Tracker', icon: Award, href: '/skills.html', pathRegex: /\/skills\.html$/, isProtected: true },
  { id: 'notes', name: 'Drive Notes', icon: FileText, href: '/notes.html', pathRegex: /\/notes\.html$/, isProtected: true },
  { id: 'timer', name: 'Focus Timer', icon: StopwatchIcon, href: '/timer.html', pathRegex: /\/timer\.html$/, tooltip: 'Focus Timer & Deep Work' },
  { id: 'profile', name: 'My Profile', icon: User, href: '/profile.html', pathRegex: /\/profile\.html$/, tooltip: 'My Student Profile & ID Card' },
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
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks, subjects, dailyActivity } = useData();
  const { isAuthenticated, isGoogleAuthenticated, userProfile, signOut, openAuthModal, isDemo } = useAuth();
  
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [toolsPopoverOpen, setToolsPopoverOpen] = useState(false);
  const [demoRemainingSec, setDemoRemainingSec] = useState(() => getDemoRemainingSeconds());
  const [relativeSyncTime, setRelativeSyncTime] = useState(() => {
    return formatRelativeSyncTime(getLastSyncedTimestamp());
  });
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission());
  const [studentProfile, setStudentProfile] = useState(() => getStudentProfile(userProfile));

  useEffect(() => {
    setStudentProfile(getStudentProfile(userProfile));
    const handleProfileUpdated = (e) => {
      setStudentProfile(e.detail || getStudentProfile(userProfile));
    };
    window.addEventListener('studyflow-student-profile-updated', handleProfileUpdated);
    window.addEventListener('storage', handleProfileUpdated);
    return () => {
      window.removeEventListener('studyflow-student-profile-updated', handleProfileUpdated);
      window.removeEventListener('storage', handleProfileUpdated);
    };
  }, [userProfile]);

  const handleOpenProfileView = (e) => {
    if (e) e.preventDefault();
    setToolsPopoverOpen(false);
    setThemeDropdownOpen(false);
    if (typeof window !== 'undefined') {
      if (window.switchView) {
        window.switchView('profile');
      } else {
        window.location.hash = 'profile';
      }
    }
  };

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
  const toolsPopoverRef = useRef(null);

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
      if (toolsPopoverRef.current && !toolsPopoverRef.current.contains(event.target)) {
        setToolsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerCloudAndLeaderboardSync = () => {
    if (!isGoogleAuthenticated) {
      openAuthModal('general');
      return;
    }
    if (syncNowToDrive) syncNowToDrive();
    syncStudentToLeaderboard(TELEMETRY_URL, {
      userProfile,
      subjectsList: subjects,
      subjects,
      streakData,
      dailyActivity
    });
  };

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
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
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

        {/* Streamlined Header Right Actions: Sync Pill, Tools ▾ Popover, Theme Dropdown, @username Profile Pill */}
        <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
          
          {/* 1. Compact Sync Status Pill */}
          {isAuthenticated && !isDemo ? (
            getEmergencyKillswitches().driveSync === false ? (
              <div
                id="header-sync-status-pill"
                title="Google Drive sync is temporarily disabled by administrator"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-surface text-xs font-semibold text-theme-muted select-none"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Sync Disabled</span>
              </div>
            ) : syncStatus === 'syncing' ? (
              <button
                id="header-sync-status-pill"
                type="button"
                onClick={onOpenDriveModal}
                title="Saving changes to Google Drive..."
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold shadow-sm cursor-pointer animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </button>
            ) : syncStatus === 'synced' ? (
              <button
                id="header-sync-status-pill"
                type="button"
                onClick={handleTriggerCloudAndLeaderboardSync}
                title={`Google Drive Synced (${relativeSyncTime || 'Just now'}). Click to sync now.`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/15 text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95"
              >
                <span>🟢 Synced</span>
              </button>
            ) : syncStatus === 'needs_auth' ? (
              <button
                id="header-sync-status-pill"
                type="button"
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 text-xs font-bold shadow-sm cursor-pointer transition-all"
              >
                <span>🟡 Sync Auth</span>
              </button>
            ) : (
              <button
                id="header-sync-status-pill"
                type="button"
                onClick={onOpenDriveModal}
                title="Offline or local only — progress saved locally to your device"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-cardHover text-xs font-semibold text-theme-muted hover:text-theme-text shadow-sm cursor-pointer transition-all"
              >
                <span>🟢 Local</span>
              </button>
            )
          ) : (
            <button
              id="header-sync-status-pill"
              type="button"
              onClick={() => {
                if (isDemo) {
                  if (onOpenDriveNotesDemoModal) onOpenDriveNotesDemoModal();
                } else {
                  openAuthModal('general');
                }
              }}
              title={isDemo ? `Demo session (${formattedDemoTimer})` : 'Saved locally — click to connect Google Drive sync'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-cardHover text-xs font-semibold text-theme-text shadow-sm cursor-pointer transition-all active:scale-95"
            >
              <span>{isDemo ? `⏱️ ${formattedDemoTimer}` : '🟢 Synced'}</span>
            </button>
          )}

          {/* 2. Single "Tools ▾" Popover (Reminders + Quick Links + Cloud Sync) */}
          <div className="relative" ref={toolsPopoverRef}>
            <button
              id="header-tools-popover-btn"
              type="button"
              onClick={() => {
                setToolsPopoverOpen((prev) => !prev);
                setThemeDropdownOpen(false);
              }}
              aria-expanded={toolsPopoverOpen}
              title="Reminders, Quick Links & Sync Tools"
              className="top-action-link flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-theme-accent" />
              <span>Tools</span>
              <ChevronDown className={`w-3 h-3 text-theme-muted transition-transform duration-200 ${toolsPopoverOpen ? 'rotate-180' : ''}`} />
            </button>

            {toolsPopoverOpen && (
              <div
                id="header-tools-popover-menu"
                className="absolute right-0 mt-2 w-60 rounded-2xl glass-dropdown p-2 shadow-2xl z-50 animate-fadeIn border border-theme-border space-y-1"
              >
                <div className="px-3 py-1.5 border-b border-theme-border/60 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">
                    Workspace Tools
                  </p>
                </div>

                {/* Reminders Toggle inside Tools Popover */}
                <button
                  id="notification-reminder-toggle"
                  type="button"
                  onClick={() => {
                    handleToggleNotifications();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Bell className={`w-3.5 h-3.5 ${notifPermission === 'granted' ? 'text-amber-500' : 'text-theme-muted'}`} />
                    <span>Reminders</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-theme-surface text-theme-muted border border-theme-border'
                  }`}>
                    {notifPermission === 'granted' ? 'Active' : 'Off'}
                  </span>
                </button>

                {/* Quick Links Hub inside Tools Popover */}
                <button
                  id="header-quick-links-btn"
                  type="button"
                  onClick={() => {
                    setToolsPopoverOpen(false);
                    if (onOpenLinksModal) onOpenLinksModal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-theme-accent" />
                    <span>Quick Links</span>
                  </span>
                  {(importantLinks || []).length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-theme-surface text-theme-accent border border-theme-border font-mono-numbers">
                      {(importantLinks || []).length}
                    </span>
                  )}
                </button>

                {/* Sync Now inside Tools Popover */}
                <button
                  id="header-sync-now-btn"
                  type="button"
                  onClick={() => {
                    setToolsPopoverOpen(false);
                    handleTriggerCloudAndLeaderboardSync();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-theme-text hover:bg-theme-cardHover transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className={`w-3.5 h-3.5 text-theme-accent ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sync Now</span>
                  </span>
                  <span className="text-[10px] text-theme-muted font-mono-numbers">
                    {relativeSyncTime || 'Now'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Theme Dropdown Selector */}
          <div className="relative" ref={themeDropdownRef}>
            <button
              id="header-theme-dropdown-btn"
              type="button"
              onClick={() => {
                setThemeDropdownOpen(!themeDropdownOpen);
                setToolsPopoverOpen(false);
              }}
              className="top-action-link flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-medium text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95 shadow-sm focus:outline-none cursor-pointer"
              aria-label="Toggle Theme"
              title={`Active Theme: ${currentThemeMeta.name}`}
            >
              {(() => {
                const ThemeIcon = currentThemeMeta.icon || Sparkles;
                return <ThemeIcon className="w-3.5 h-3.5 text-theme-accent" />;
              })()}
              <span className="hidden md:inline font-semibold">
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
                        data-theme-id={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          setThemeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
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

          {/* 4. @username Profile Pill (or Guest Demo pill when not logged in; clicking opens #view-profile) */}
          <button
            id="header-profile-pill"
            type="button"
            data-target-view="profile"
            onClick={handleOpenProfileView}
            className="flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs shadow-sm transition-all active:scale-95 focus:outline-none cursor-pointer"
            title={
              isGoogleAuthenticated
                ? `Open My Profile (${studentProfile?.handle || '@focused_scholar'})`
                : 'Open My Profile (Read-Only Guest Demo Preview)'
            }
          >
            {isGoogleAuthenticated && userProfile?.picture ? (
              <img 
                src={userProfile.picture} 
                alt={studentProfile?.handle || userProfile.name} 
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/30"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full font-bold flex items-center justify-center text-[10px]"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1px solid var(--border-glow)'
                }}
              >
                {isGoogleAuthenticated
                  ? getUsernameMonogram(studentProfile?.username, userProfile?.name || 'ST')
                  : 'GD'}
              </div>
            )}
            <span className="font-bold text-theme-text font-mono-numbers truncate max-w-[120px]">
              {isGoogleAuthenticated ? (studentProfile?.handle || '@focused_scholar') : 'Guest Demo'}
            </span>
          </button>

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
    <footer className="mt-auto border-t border-theme-border/60 py-4 text-center text-xs text-theme-muted w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
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
  const [currentTabId, setCurrentTabId] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace(/^#\/?/, '');
      if (h) return h;
    }
    return activeTabId || 'dashboard';
  });

  useEffect(() => {
    const handleViewChange = (e) => {
      if (e.detail?.view) {
        setCurrentTabId(e.detail.view);
      }
    };
    window.addEventListener('studyflow-view-changed', handleViewChange);
    const handleHash = () => {
      if (typeof window !== 'undefined') {
        const h = window.location.hash.replace(/^#\/?/, '');
        if (h) setCurrentTabId(h);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => {
      window.removeEventListener('studyflow-view-changed', handleViewChange);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

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

  // Google Calendar Event Created Toast Listener
  const [calendarToast, setCalendarToast] = useState(null);

  useEffect(() => {
    const handleCalendarEvent = (e) => {
      const msg = e.detail?.message || "📅 Event added to your Google Calendar! Reminder set for 30 minutes prior.";
      setCalendarToast(msg);
      const timer = setTimeout(() => {
        setCalendarToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('studyflow-calendar-event-created', handleCalendarEvent);
    return () => window.removeEventListener('studyflow-calendar-event-created', handleCalendarEvent);
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

  const isGuestLockedTab = !isAuthenticated && LOCKED_TAB_IDS.includes(currentTabId);
  const isDemoLockedNotes = isDemo && currentTabId === 'notes';

  // Silent Telemetry tracking on initial mount and tab navigation
  useEffect(() => {
    logFeatureUse('Page Visit');
    const tabFeatureMap = {
      routine: 'Daily Routine',
      calendar: 'Calendar',
      syllabus: 'Subjects & Syllabus',
      revision: 'Revision Queue',
      radar: 'Exam Radar',
      'mock-logbook': 'Mock Logbook',
      skills: 'Skill Tracker',
      notes: 'Drive Notes',
      timer: 'Focus Timer'
    };
    if (activeTabId && tabFeatureMap[activeTabId]) {
      logFeatureUse(tabFeatureMap[activeTabId]);
    }
  }, [activeTabId]);

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
    if (isDemo && currentTabId === 'notes') {
      setIsDriveNotesDemoModalOpen(true);
    }
  }, [isDemo, currentTabId]);

  useEffect(() => {
    const feature = currentTabId || 'dashboard';
    document.documentElement.setAttribute('data-active-feature', feature);
  }, [currentTabId]);

  const isPlatformMaintenanceLocked = killswitches.maintenanceMode && !isAdminUser;

  return (
    <div 
      className="min-h-screen flex flex-col w-full bg-theme-bg text-theme-text transition-colors duration-200"
      data-active-feature={currentTabId || 'dashboard'}
    >
      {/* SHA-256 App PIN Lock-Screen Overlay (blocks workspace on load when PIN is enabled) */}
      <PinLockOverlay />

      {/* Ambient Gradient Mesh Canvas (if not already injected at top of body in static HTML) */}
      {typeof document !== 'undefined' && !document.querySelector('body > .ambient-mesh-canvas') && (
        <div className="ambient-mesh-canvas" aria-hidden="true">
          <div className="mesh-blob blob-1" />
          <div className="mesh-blob blob-2" />
          <div className="mesh-blob blob-3" />
        </div>
      )}
      
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
          <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
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
          <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
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
      <div className="flex-1 flex w-full relative min-h-[calc(100vh-4rem)]">
        {/* Left Collapsible Sidebar Navigation Rail across all pages */}
        <CollapsibleSidebar 
          activeTabId={currentTabId} 
          isExpanded={isSidebarExpanded} 
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => {
            setIsMobileSidebarOpen(false);
            if (typeof document !== 'undefined') document.body.style.overflow = '';
          }}
          onToggle={handleToggleSidebar}
          onOpenDriveNotesDemoModal={() => setIsDriveNotesDemoModalOpen(true)}
          onSelectTab={(tab) => setCurrentTabId(tab)}
        />

        {/* Main Content Area - Desktop margin matches sidebar state with smooth transition */}
        <div 
          id="main-layout-wrapper"
          className={`flex-1 min-w-0 w-full flex flex-col transition-all duration-300 ease-in-out ${
            isSidebarExpanded ? 'md:ml-[250px]' : 'md:ml-16'
          }`}
        >
          <main 
            id="main-content" 
            className="flex-1 w-full max-w-none min-w-0 p-6 pt-5 pb-8"
          >
            {/* Page Content Container: If locked tab in guest mode, render frosted glass locked overlay */}
            <div className="w-full transition-all duration-300 animate-tab-enter">
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
                <LockedFeatureOverlay featureKey={currentTabId}>
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

      {/* Google Calendar Event Created Toast */}
      {calendarToast && (
        <div 
          id="calendar-event-created-toast"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-theme-surface/95 border border-indigo-500/40 text-theme-text p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-slideUp backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0">📅</span>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-theme-text">
                {calendarToast}
              </p>
              <p className="text-[11px] text-theme-muted mt-0.5">
                30-minute advance reminder configured on your calendar.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCalendarToast(null)}
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
