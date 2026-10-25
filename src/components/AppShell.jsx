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
  LogOut
} from 'lucide-react';
import Logo from './Logo';
import DriveModal from './DriveModal';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { DataProvider, useData } from '../context/DataContext';

export const STORAGE_KEY_PREFIX = 'studyflow_data_';

// Navigation Tab Definitions for Multi-Page Routing
export const NAV_TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/index.html', pathRegex: /^\/(index\.html)?$/ },
  { id: 'routine', name: 'Daily Routine', icon: Clock, href: '/routine.html', pathRegex: /\/routine\.html$/ },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon, href: '/calendar.html', pathRegex: /\/calendar\.html$/ },
  { id: 'syllabus', name: 'Subjects & Syllabus', icon: BookOpen, href: '/syllabus.html', pathRegex: /\/syllabus\.html$/ },
  { id: 'revision', name: 'Revision Queue', icon: Repeat, href: '/revision.html', pathRegex: /\/revision\.html$/ },
  { id: 'radar', name: 'Exam Radar', icon: CalendarIcon, href: '/radar.html', pathRegex: /\/radar\.html$/ },
  { id: 'skills', name: 'Skill Tracker', icon: Award, href: '/skills.html', pathRegex: /\/skills\.html$/ },
  { id: 'notes', name: 'Drive Notes', icon: FileText, href: '/notes.html', pathRegex: /\/notes\.html$/ },
  { id: 'timer', name: 'Focus Timer', icon: Clock, href: '/timer.html', pathRegex: /\/timer\.html$/ },
];

// Persistent Shared Top Header
export function SharedHeader({ onOpenDriveModal, onOpenLinksModal }) {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks, driveUser, signOut } = useData();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const userProfile = (() => {
    try {
      const raw = localStorage.getItem('user_profile') || localStorage.getItem('google_user_profile') || sessionStorage.getItem('studyflow_drive_user');
      return raw ? JSON.parse(raw) : (driveUser || null);
    } catch {
      return driveUser || null;
    }
  })();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setThemeDropdownOpen(false);
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

  const isConnected = !!driveAccessToken;

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
            title={`Study Streak: ${streakData.streakCount} days active! Keep it up.`}
            className="group flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-default"
          >
            <div className="relative">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-bounce-soft" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
            </div>
            <span className="font-mono-numbers font-bold text-xs sm:text-sm text-amber-500">
              {streakData.streakCount}
            </span>
            <span className="hidden sm:inline text-xs text-amber-600/90 dark:text-amber-400/90 font-medium">
              days streak
            </span>
          </div>

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
          <div className="flex items-center gap-1.5">
            <div
              onClick={onOpenDriveModal}
              title="Google Drive is connected and synced with your account"
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

          {/* Logged-In Student Profile (Avatar & Name) */}
          <div 
            className="flex items-center space-x-2 px-2 sm:px-2.5 py-1 rounded-xl bg-theme-surface border border-theme-border text-xs shadow-sm"
            title={`Signed in as ${userProfile?.name || 'Student'} (${userProfile?.email || ''})`}
          >
            {userProfile?.picture ? (
              <img 
                src={userProfile.picture} 
                alt={userProfile.name || 'Student'} 
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/30"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 text-white font-bold flex items-center justify-center text-[10px]">
                {(userProfile?.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden md:inline font-semibold text-theme-text truncate max-w-[110px]">
              {userProfile?.name?.split(' ')[0] || 'Student'}
            </span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {}
              window.location.replace('/login.html');
            }}
            title="Sign Out of Study Tracker"
            className="top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-rose-500/10 border border-theme-border hover:border-rose-500/30 text-xs font-semibold text-theme-muted hover:text-rose-400 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>

          {/* Appearance / Clean Mode Toggle Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="top-action-link flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-medium text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
              aria-label="Toggle Theme"
            >
              <div 
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white/20"
                style={{ backgroundColor: currentThemeMeta.primaryColor }}
              />
              <span className="hidden md:inline font-medium">
                {currentThemeMeta.name.split(' ')[0]}
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
export function SharedNavBar({ activeTabId }) {
  const { exams, getTodayRevisionQueue, routineSlots } = useData();

  const urgentCount = exams.filter(e => {
    if (e.isCompleted) return false;
    const diffDays = (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  const dueRevisionCount = getTodayRevisionQueue ? getTodayRevisionQueue().length : 0;
  const pendingRoutineSlots = routineSlots.filter(s => !s.completed).length;

  return (
    <div className="mb-6 overflow-x-auto pb-1 sm:pb-0">
      <nav className="flex space-x-1 sm:space-x-2 p-1.5 rounded-2xl glass-panel border border-theme-border w-max min-w-full sm:min-w-0" aria-label="Study Tracker Navigation">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={`nav-tab-item flex items-center space-x-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out relative whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-theme-accent text-white shadow-glow-accent font-semibold'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
              <span>{tab.name}</span>

              {tab.id === 'routine' && pendingRoutineSlots > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                  isActive ? 'bg-white text-indigo-700' : 'bg-theme-accent text-white'
                }`}>
                  {pendingRoutineSlots}
                </span>
              )}

              {tab.id === 'revision' && dueRevisionCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                  isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
                }`}>
                  {dueRevisionCount}
                </span>
              )}

              {tab.id === 'radar' && urgentCount > 0 && (
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
          Client-Side Google Drive API v3 (GIS) & LocalStorage Active
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
          {importantLinks.map((link) => (
            <div 
              key={link.id} 
              className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border flex items-start justify-between gap-3 hover:border-theme-accent/30 transition-all"
            >
              <div className="min-w-0 flex-1">
                <a 
                  href={link.url} 
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

          {importantLinks.length === 0 && (
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

  // Auth Guard: Redirect to login.html if google_access_token does not exist
  useEffect(() => {
    try {
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        window.location.replace('/login.html');
      }
    } catch {}
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-200">
      
      {/* Top Header */}
      <SharedHeader 
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onOpenLinksModal={() => setIsLinksModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs Bar */}
        <SharedNavBar activeTabId={activeTabId} />

        {/* Page Content Container with smooth enter transition */}
        <div className="transition-all duration-300 animate-tab-enter">
          {children}
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

    </div>
  );
}

// Multi-Page Initializer Helper
export function initPage(Component, activeTabId) {
  if (typeof window !== 'undefined') {
    try {
      if (!localStorage.getItem('google_access_token')) {
        window.location.replace('/login.html');
        return;
      }
    } catch {}
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <DataProvider>
          <AppLayout activeTabId={activeTabId}>
            <Component />
          </AppLayout>
        </DataProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
