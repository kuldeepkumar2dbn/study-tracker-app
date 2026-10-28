import React, { useState, useRef, useEffect } from 'react';
import { 
  Flame, 
  ChevronDown, 
  Calendar, 
  Check, 
  Cloud, 
  CloudOff,
  RefreshCw,
  Sparkles,
  Zap,
  Link2,
  LogOut
} from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { logout } from '../../auth-guard';
import { formatRelativeSyncTime, getLastSyncedTimestamp } from '../services/cloud-sync';

export default function Navbar({ onOpenDriveModal, onLogoClick, onNavigateTab }) {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks, driveUser } = useData();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [relativeSyncTime, setRelativeSyncTime] = useState(() => {
    return formatRelativeSyncTime(getLastSyncedTimestamp());
  });
  const dropdownRef = useRef(null);

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

  const userProfile = (() => {
    try {
      const raw = localStorage.getItem('user_profile') || localStorage.getItem('google_user_profile') || sessionStorage.getItem('studyflow_drive_user');
      return raw ? JSON.parse(raw) : (driveUser || null);
    } catch {
      return driveUser || null;
    }
  })();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setThemeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formatted current date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  const isConnected = !!driveAccessToken;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-theme-border bg-theme-bg/85 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Study Tracker Brand Logo */}
        <div className="shrink-0">
          <Logo onClick={onLogoClick} />
        </div>

        {/* Center / Right Items: Date, Live Streak, Google Drive Status, Theme Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
          
          {/* Current Date Widget */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs text-theme-muted font-medium">
            <Calendar className="w-3.5 h-3.5 text-theme-accent" />
            <span className="font-mono-numbers text-theme-text">{todayFormatted}</span>
          </div>

          {/* Live Study Streak Counter */}
          <div 
            title={streakData?.streakCount === 0 ? "Day 1 - Ready to start!" : `Study Streak: ${streakData?.streakCount || 0} days active! Keep it up.`}
            className="group flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-default"
          >
            <div className="relative">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-bounce-soft" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
            </div>
            <span className="font-mono-numbers font-bold text-xs sm:text-sm text-amber-500">
              {streakData?.streakCount || 0}
            </span>
            <span className="hidden sm:inline text-xs text-amber-600/90 dark:text-amber-400/90 font-medium">
              {streakData?.streakCount === 0 ? "0 days streak" : "days streak"}
            </span>
          </div>

          {/* Important Links Quick Tab Launcher */}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('links')}
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
          )}

          {/* Google Drive Status & "Drive Synced" Badge */}
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
                title={`Google Drive is connected and synced with your account. Last synced: ${relativeSyncTime || 'Just now'}`}
                className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-xs font-semibold shadow-sm cursor-pointer hover:bg-emerald-500/15 transition-all select-none"
              >
                <div className="relative flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-theme-surface bg-emerald-400"></span>
                </div>
                <span className="hidden sm:inline font-semibold">Drive Synced</span>
              </div>
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

            <button
              onClick={syncNowToDrive}
              title="Sync now to personal Google Drive"
              className="top-action-link p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* User Profile OR Clean Sign-In Button */}
          {userProfile ? (
            <div className="flex items-center gap-1.5">
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

              {/* Hardened Sign Out Button (calls google.accounts.oauth2.revoke) */}
              <button
                onClick={() => logout()}
                title="Sign Out of Study Tracker and Revoke Google Session"
                className="top-action-link flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-rose-500/10 border border-theme-border hover:border-rose-500/30 text-xs font-semibold text-theme-muted hover:text-rose-400 transition-all duration-200 active:scale-95 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <a
              href="/login.html"
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all duration-200 active:scale-95"
            >
              <span>Sign In</span>
            </a>
          )}

          {/* Persistent Theme Toggle Dropdown */}
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

            {/* Dropdown Menu */}
            {themeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown p-2 shadow-2xl z-50 animate-fadeIn border border-theme-border">
                <div className="px-3 py-2 border-b border-theme-border/60 mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
                    Display Appearance
                  </p>
                  <p className="text-xs text-theme-text/80 mt-0.5">
                    Saved automatically to browser
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
