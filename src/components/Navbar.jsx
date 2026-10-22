import React, { useState, useRef, useEffect } from 'react';
import { 
  Flame, 
  ChevronDown, 
  Calendar, 
  Check, 
  Cloud, 
  RefreshCw,
  Sparkles,
  Zap,
  Link2
} from 'lucide-react';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

export default function Navbar({ onOpenDriveModal, onLogoClick, onNavigateTab }) {
  const { theme, setTheme, themes, currentThemeMeta } = useTheme();
  const { streakData, driveAccessToken, syncStatus, syncNowToDrive, importantLinks } = useData();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

          {/* Important Links Quick Tab Launcher */}
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('links')}
              title="Open Important Links & Resource Hub"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border hover:border-theme-accent/40 text-xs font-medium text-theme-muted hover:text-theme-text transition-all shadow-sm"
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

          {/* Google Drive Status & Sync Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenDriveModal}
              className={`flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-150 shadow-sm ${
                isConnected
                  ? 'bg-theme-surface border-theme-border text-theme-text hover:border-theme-accent/40'
                  : 'bg-theme-surface/70 border-theme-border text-theme-muted hover:text-theme-text'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Cloud className={`w-4 h-4 ${isConnected ? 'text-theme-accent' : 'text-theme-muted'}`} />
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-theme-surface ${
                  syncStatus === 'synced' ? 'bg-emerald-400' :
                  syncStatus === 'unsaved' ? 'bg-amber-400' :
                  syncStatus === 'syncing' ? 'bg-sky-400 animate-pulse' : 'bg-zinc-500'
                }`}></span>
              </div>
              <span className="hidden sm:inline">
                {isConnected 
                  ? (syncStatus === 'synced' ? 'Drive Synced' : syncStatus === 'unsaved' ? 'Unsaved' : 'Syncing...') 
                  : 'Connect Drive'}
              </span>
            </button>

            {isConnected && (
              <button
                onClick={syncNowToDrive}
                title="Sync now to Google Drive"
                className="p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Persistent Theme Toggle Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-medium text-theme-text transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-theme-accent/30"
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
