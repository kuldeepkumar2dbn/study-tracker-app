import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Trophy,
  Crown,
  BookOpen,
  Flame,
  RefreshCw,
  Shield,
  Users,
  Radio,
  Clock,
  CheckCircle2,
  Edit3,
  ArrowDownCircle,
  Sparkles,
  Search,
  Lock,
  LogIn
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TELEMETRY_URL } from '../../../admin-config.js';
import {
  getLeaderboardSettings,
  saveLeaderboardSettings,
  getAvailableSubjects,
  syncStudentToLeaderboard,
  fetchLeaderboard,
  fetchTop100Leaderboard,
  getStudentId,
  getUserId,
  filterLeaderboardEntries,
  getLiveStudyingCount
} from '../../../leaderboard.js';

const POLL_INTERVAL_MS = 30000;

export default function LeaderboardTab({ isActiveView = false }) {
  const { subjects = [], streakData, dailyActivity = {} } = useData();
  const { userProfile, isGoogleAuthenticated, openAuthModal } = useAuth();
  const { theme } = useTheme();
  const isGuestSyncLocked = !isGoogleAuthenticated;

  // Persisted display name, opt-in privacy toggle, and live 30s auto-refresh toggle
  const initialSettings = useMemo(() => getLeaderboardSettings(userProfile), [userProfile]);
  const [displayName, setDisplayName] = useState(initialSettings.displayName);
  const [optedIn, setOptedIn] = useState(initialSettings.optedIn);
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(initialSettings.liveAutoRefresh);

  // Mode & subject selection
  const [mode, setMode] = useState('overall'); // 'overall' | 'subject'
  const availableSubjects = useMemo(
    () => getAvailableSubjects({ subjectsList: subjects }),
    [subjects]
  );
  const [selectedSubject, setSelectedSubject] = useState(() => availableSubjects[0] || 'Mathematics');

  // Search filter within Top 100
  const [searchQuery, setSearchQuery] = useState('');

  // Live Study Room presence filters
  const [liveOnly, setLiveOnly] = useState(false);
  const [sameSubjectOnly, setSameSubjectOnly] = useState(false);
  const [timerActiveSubject, setTimerActiveSubject] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('focus_timer_subject') || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  useEffect(() => {
    const syncFocusSubject = () => {
      try {
        const subj = localStorage.getItem('focus_timer_subject') || '';
        setTimerActiveSubject(subj);
      } catch {
        // ignore
      }
    };
    window.addEventListener('studyflow-timer-sync', syncFocusSubject);
    window.addEventListener('studyflow-presence-heartbeat', syncFocusSubject);
    return () => {
      window.removeEventListener('studyflow-timer-sync', syncFocusSubject);
      window.removeEventListener('studyflow-presence-heartbeat', syncFocusSubject);
    };
  }, []);

  // Rankings & sync state
  const [rankings, setRankings] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [dataSource, setDataSource] = useState('live');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [countdownSec, setCountdownSec] = useState(30);
  const [toastMessage, setToastMessage] = useState(null);
  const [, setThemeTick] = useState(0);

  // Track whether the current student's row/podium is visible in the viewport
  const currentUserRowRef = useRef(null);
  const [isMyRowVisible, setIsMyRowVisible] = useState(true);

  const currentStudentId = useMemo(() => getStudentId(userProfile), [userProfile]);

  // Keep selectedSubject valid if availableSubjects changes
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject]);

  // React to external theme events for seamless theme switching (including Onyx & Gold)
  useEffect(() => {
    const handleThemeEvent = () => setThemeTick((t) => t + 1);
    window.addEventListener('themeChanged', handleThemeEvent);
    window.addEventListener('studyflow-theme-changed', handleThemeEvent);
    return () => {
      window.removeEventListener('themeChanged', handleThemeEvent);
      window.removeEventListener('studyflow-theme-changed', handleThemeEvent);
    };
  }, [theme]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Build current user study snapshot for syncing & live rank calculation
  const buildCurrentUserSnapshot = useCallback(() => ({
    userProfile,
    userId: isGuestSyncLocked ? 'guest' : currentStudentId,
    studentId: isGuestSyncLocked ? 'guest' : currentStudentId,
    isGuest: isGuestSyncLocked,
    displayName,
    optedIn: isGuestSyncLocked ? false : optedIn,
    subjectsList: subjects,
    subjects,
    streakData,
    dailyActivity
  }), [userProfile, isGuestSyncLocked, currentStudentId, displayName, optedIn, subjects, streakData, dailyActivity]);

  // Fetch leaderboard rankings from TELEMETRY_URL
  const loadLeaderboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const fetchFn = typeof fetchTop100Leaderboard === 'function' ? fetchTop100Leaderboard : fetchLeaderboard;
      const result = await fetchFn(TELEMETRY_URL, {
        mode,
        subject: mode === 'subject' ? selectedSubject : '',
        limit: 100,
        currentUserData: buildCurrentUserSnapshot()
      });
      setRankings(result.rankings || []);
      setCurrentUserRank(result.currentUserRank || null);
      setTotalParticipants(result.totalParticipants || (result.rankings || []).length);
      setDataSource(result.source || 'live');
      setLastUpdatedAt(result.fetchedAt || new Date().toISOString());
      setCountdownSec(30);
    } catch (err) {
      console.warn('Error loading leaderboard:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [mode, selectedSubject, buildCurrentUserSnapshot]);

  // Default Live Study Room filters to OFF & auto-sync latest hours whenever #view-leaderboard opens
  useEffect(() => {
    if (!isActiveView) return;

    // Ensure presence filters default to OFF so all ranked students are visible
    setLiveOnly(false);
    setSameSubjectOnly(false);

    let isMounted = true;
    const autoSyncOnOpen = async () => {
      if (!isGuestSyncLocked && optedIn) {
        try {
          await syncStudentToLeaderboard(TELEMETRY_URL, buildCurrentUserSnapshot(), {
            displayName: displayName.trim() || 'Focused Scholar',
            optedIn: true,
            activeSubject: mode === 'subject' ? selectedSubject : (subjects[0]?.name || selectedSubject)
          });
          // Wait 600ms for Google Apps Script to commit row write
          await new Promise((r) => setTimeout(r, 600));
        } catch (err) {
          console.warn('Auto-sync on leaderboard open skipped:', err);
        }
      }
      if (isMounted) {
        await loadLeaderboard({ silent: rankings.length > 0 });
      }
    };

    autoSyncOnOpen();

    return () => {
      isMounted = false;
    };
  }, [isActiveView]);

  // Reload when mode, selectedSubject, or opt-in setting changes
  useEffect(() => {
    if (isActiveView) {
      loadLeaderboard({ silent: rankings.length > 0 });
    }
  }, [mode, selectedSubject, optedIn]);

  // Refresh immediately when background hooks or Student Profile save fire
  useEffect(() => {
    const handleSynced = () => {
      loadLeaderboard({ silent: true });
    };
    const handleProfileUpdated = (e) => {
      const updated = e?.detail;
      if (updated?.handle) {
        setDisplayName(updated.handle);
      }
      if (updated?.showOnLeaderboard !== undefined) {
        setOptedIn(Boolean(updated.showOnLeaderboard));
      }
      loadLeaderboard({ silent: true });
    };
    window.addEventListener('studyflow-leaderboard-synced', handleSynced);
    window.addEventListener('studyflow-student-profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('studyflow-leaderboard-synced', handleSynced);
      window.removeEventListener('studyflow-student-profile-updated', handleProfileUpdated);
    };
  }, [loadLeaderboard]);

  // Live 30s Auto-Refresh Poller — ONLY active while viewing #view-leaderboard
  useEffect(() => {
    if (!isActiveView || !liveAutoRefresh) return;

    setCountdownSec(30);

    const pollInterval = setInterval(() => {
      loadLeaderboard({ silent: true });
    }, POLL_INTERVAL_MS);

    const tickInterval = setInterval(() => {
      setCountdownSec((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [isActiveView, liveAutoRefresh, loadLeaderboard]);

  // Observe whether current student's rank card/row is within viewport to control sticky bottom banner
  useEffect(() => {
    if (!currentUserRank) {
      setIsMyRowVisible(false);
      return;
    }

    const node = currentUserRowRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      // If ranked beyond 100 or node not rendered, show sticky banner
      setIsMyRowVisible(currentUserRank.rank <= 3);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]) {
          setIsMyRowVisible(entries[0].isIntersecting);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [currentUserRank, rankings, mode, selectedSubject, searchQuery]);

  // Save inline Display Name
  const handleDisplayNameBlur = () => {
    if (isGuestSyncLocked) return;
    const cleaned = displayName.trim() || 'Focused Scholar';
    setDisplayName(cleaned);
    saveLeaderboardSettings({ displayName: cleaned }, userProfile);
  };

  // Toggle Opt-In privacy control
  const handleToggleOptIn = async () => {
    if (isGuestSyncLocked) {
      openAuthModal('leaderboard', '#leaderboard');
      return;
    }
    const nextOptIn = !optedIn;
    setOptedIn(nextOptIn);
    saveLeaderboardSettings({ optedIn: nextOptIn }, userProfile);

    await syncStudentToLeaderboard(TELEMETRY_URL, buildCurrentUserSnapshot(), {
      optedIn: nextOptIn,
      displayName: displayName.trim() || 'Focused Scholar'
    });

    showToast(
      nextOptIn
        ? 'Opted in! Your study hours are now visible on the Leaderboard.'
        : 'Privacy mode active: You have opted out of the public Leaderboard.'
    );
    await loadLeaderboard({ silent: true });
  };

  // Toggle 30s Live Auto-Refresh
  const handleToggleLiveRefresh = () => {
    const nextLive = !liveAutoRefresh;
    setLiveAutoRefresh(nextLive);
    saveLeaderboardSettings({ liveAutoRefresh: nextLive }, userProfile);
    if (nextLive) {
      setCountdownSec(30);
      loadLeaderboard({ silent: true });
    }
  };

  // Manual "🔄 Sync My Hours Now" button
  const handleSyncNow = async () => {
    if (isGuestSyncLocked) {
      openAuthModal('leaderboard', '#leaderboard');
      return;
    }
    setIsSyncing(true);
    const cleanedName = displayName.trim() || 'Focused Scholar';
    setDisplayName(cleanedName);
    saveLeaderboardSettings({ displayName: cleanedName, optedIn }, userProfile);

    try {
      await syncStudentToLeaderboard(TELEMETRY_URL, buildCurrentUserSnapshot(), {
        displayName: cleanedName,
        optedIn,
        activeSubject: mode === 'subject' ? selectedSubject : (subjects[0]?.name || selectedSubject)
      });
      // Wait 600ms for Google Apps Script to commit row write before fetching
      await new Promise((r) => setTimeout(r, 600));
      await loadLeaderboard({ silent: true });
      showToast('Hours synced to the real-time Leaderboard!');
    } catch (err) {
      console.warn('Manual sync failed:', err);
      await loadLeaderboard({ silent: true });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleJumpToMyRank = () => {
    if (currentUserRowRef.current) {
      currentUserRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Logged-in user's currently selected subject (for "🎯 Same Subject as Me" filter)
  const myActiveSubject = useMemo(() => {
    if (mode === 'subject' && selectedSubject) return selectedSubject;
    if (timerActiveSubject && timerActiveSubject.trim()) return timerActiveSubject.trim();
    return subjects[0]?.name || selectedSubject || 'General Studies';
  }, [mode, selectedSubject, timerActiveSubject, subjects]);

  const liveStudyingCount = useMemo(
    () => getLiveStudyingCount(rankings),
    [rankings]
  );

  const hasPresenceFilter = liveOnly || sameSubjectOnly;

  // Dynamically filtered leaderboard list based on Live Study Room pills & search query
  const filteredRankings = useMemo(
    () =>
      filterLeaderboardEntries(rankings, {
        liveOnly,
        sameSubjectOnly,
        currentUserSubject: myActiveSubject,
        searchQuery
      }),
    [rankings, liveOnly, sameSubjectOnly, myActiveSubject, searchQuery]
  );

  const otherPeersInFiltered = useMemo(
    () =>
      filteredRankings.filter(
        (r) => !(r.isCurrentUser || r.studentId === currentStudentId)
      ),
    [filteredRankings, currentStudentId]
  );

  const showNoPeersEmptyState = Boolean(
    hasPresenceFilter &&
      (filteredRankings.length === 0 || (sameSubjectOnly && otherPeersInFiltered.length === 0))
  );

  // Split Top 3 Podium and Scrollable Table rows dynamically
  const top3 = useMemo(
    () => (hasPresenceFilter ? filteredRankings.slice(0, 3) : rankings.slice(0, 3)),
    [hasPresenceFilter, filteredRankings, rankings]
  );

  const tableRows = useMemo(() => {
    if (hasPresenceFilter) {
      return filteredRankings;
    }
    const rest = rankings.slice(3, 100);
    if (!searchQuery.trim()) return rest;
    return filterLeaderboardEntries(rest, { searchQuery });
  }, [hasPresenceFilter, filteredRankings, rankings, searchQuery]);

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdatedAt) return 'Just now';
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(lastUpdatedAt));
    } catch {
      return 'Just now';
    }
  }, [lastUpdatedAt]);

  // Podium badge configuration for Gold (#1), Silver (#2), Bronze (#3)
  const PODIUM_CONFIG = [
    {
      rank: 1,
      label: 'Gold • #1',
      medal: '🥇',
      accentColor: '#F59E0B',
      badgeBg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      ringStyle: 'rgba(245, 158, 11, 0.45)',
      elevationClass: 'lg:-translate-y-2'
    },
    {
      rank: 2,
      label: 'Silver • #2',
      medal: '🥈',
      accentColor: '#94A3B8',
      badgeBg: 'linear-gradient(135deg, #CBD5E1 0%, #64748B 100%)',
      ringStyle: 'rgba(148, 163, 184, 0.4)',
      elevationClass: ''
    },
    {
      rank: 3,
      label: 'Bronze • #3',
      medal: '🥉',
      accentColor: '#EA580C',
      badgeBg: 'linear-gradient(135deg, #FB923C 0%, #C2410C 100%)',
      ringStyle: 'rgba(234, 88, 12, 0.4)',
      elevationClass: ''
    }
  ];

  const showStickyMyRankBanner = Boolean(
    isActiveView && optedIn && currentUserRank && !isMyRowVisible
  );

  return (
    <div
      id="leaderboard-view-root"
      className="space-y-6 animate-fadeIn w-full max-w-none mx-0 pb-20"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="leaderboard-toast"
          className="fixed top-20 right-6 z-50 max-w-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-slideUp backdrop-blur-md"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* LEADERBOARD HERO & HEADER BANNER */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-7 shadow-glow-card card-glow-hover w-full max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Real-Time Student Rankings • Top 100</span>
              </span>

              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono-numbers"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)',
                  color: 'var(--text-muted)'
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{liveStudyingCount} Studying Live Now</span>
              </span>
            </div>

            <h1
              className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: 'var(--text-main)' }}
            >
              Global & Subject-Wise Leaderboard
            </h1>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Compete with dedicated learners across overall weekly focus hours or climb the Top 100 in your specific exam subject.
            </p>
          </div>

          {/* Live Auto-Refresh Indicator + Last Synced Metadata */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              id="leaderboard-live-toggle-btn"
              type="button"
              onClick={handleToggleLiveRefresh}
              title={liveAutoRefresh ? 'Pause 30s automatic leaderboard polling' : 'Resume 30s automatic leaderboard polling'}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              style={{
                backgroundColor: liveAutoRefresh ? 'var(--primary)' : 'var(--bg-sidebar)',
                color: liveAutoRefresh ? '#FFFFFF' : 'var(--text-main)',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              <span
                className={`w-2 h-2 rounded-full ${liveAutoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}
              />
              <span>
                {liveAutoRefresh ? `🟢 Live (${countdownSec}s)` : '⚪ Live (30s) Paused'}
              </span>
            </button>

            <button
              id="leaderboard-refresh-btn"
              type="button"
              onClick={() => loadLeaderboard({ silent: false })}
              title={`Refresh rankings (Last updated ${formattedLastUpdate})`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="font-mono-numbers">{formattedLastUpdate}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP CONTROL BAR: Mode Tabs, Subject Dropdown, Display Name, Opt-In Toggle, Sync Button */}
      <div
        id="leaderboard-controls-bar"
        className="w-full rounded-2xl p-4 sm:p-5 space-y-4 max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        {/* Row 1: Mode Tabs & Subject Selector Dropdown */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Tabs */}
          <div
            className="inline-flex flex-wrap items-center gap-2 p-1 rounded-xl"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border-glow)'
            }}
            role="tablist"
            aria-label="Leaderboard ranking mode"
          >
            <button
              id="leaderboard-mode-overall"
              type="button"
              role="tab"
              aria-selected={mode === 'overall'}
              onClick={() => setMode('overall')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer"
              style={
                mode === 'overall'
                  ? {
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: '1.5px solid var(--border-glow)'
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--text-main)'
                    }
              }
            >
              <span>🏆 Overall Top 100</span>
            </button>

            <button
              id="leaderboard-mode-subject"
              type="button"
              role="tab"
              aria-selected={mode === 'subject'}
              onClick={() => setMode('subject')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer"
              style={
                mode === 'subject'
                  ? {
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: '1.5px solid var(--border-glow)'
                    }
                  : {
                      backgroundColor: 'transparent',
                      color: 'var(--text-main)'
                    }
              }
            >
              <span>📚 Subject-Wise Top 100</span>
            </button>
          </div>

          {/* Subject Selector Dropdown (shown when Subject-Wise Top 100 is selected) */}
          {mode === 'subject' && (
            <div className="flex items-center gap-2.5 flex-1 md:max-w-sm">
              <label
                htmlFor="leaderboard-subject-select"
                className="text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Subject:</span>
              </label>
              <select
                id="leaderboard-subject-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1.5px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              >
                {availableSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Search Filter */}
          <div className="relative md:w-56">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              id="leaderboard-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find student or subject..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-medium focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            />
          </div>
        </div>

        {/* LIVE STUDY ROOM PRESENCE FILTER BAR (Directly below Mode Tabs) */}
        <div
          id="live-study-room-filter-bar"
          className="pt-3.5 flex flex-wrap items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--border-glow)' }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Counter Badge */}
            <div
              id="live-studying-counter-badge"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold font-mono-numbers"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>🟢 {liveStudyingCount} Studying Live Now</span>
            </div>

            {/* Toggle Pill 1: Live Study Room Only */}
            <button
              id="filter-live-study-room-btn"
              type="button"
              aria-pressed={liveOnly}
              onClick={() => setLiveOnly((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95"
              style={
                liveOnly
                  ? {
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: '1.5px solid var(--border-glow)'
                    }
                  : {
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      border: '1.5px solid var(--border-glow)'
                    }
              }
            >
              <span>🟢 Live Study Room Only</span>
            </button>

            {/* Toggle Pill 2: Same Subject as Me */}
            <button
              id="filter-same-subject-btn"
              type="button"
              aria-pressed={sameSubjectOnly}
              onClick={() => setSameSubjectOnly((prev) => !prev)}
              title={`Filter students actively studying ${myActiveSubject}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer active:scale-95"
              style={
                sameSubjectOnly
                  ? {
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: '1.5px solid var(--border-glow)'
                    }
                  : {
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      border: '1.5px solid var(--border-glow)'
                    }
              }
            >
              <span>🎯 Same Subject as Me</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full max-w-[140px] truncate"
                style={{
                  backgroundColor: sameSubjectOnly ? 'rgba(255,255,255,0.18)' : 'var(--bg-sidebar)',
                  color: sameSubjectOnly ? '#FFFFFF' : 'var(--text-muted)'
                }}
              >
                {myActiveSubject}
              </span>
            </button>
          </div>

          {hasPresenceFilter && (
            <button
              id="clear-live-room-filters-btn"
              type="button"
              onClick={() => {
                setLiveOnly(false);
                setSameSubjectOnly(false);
              }}
              className="px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              Reset Filters ({filteredRankings.length})
            </button>
          )}
        </div>

        {/* Row 2: Display Name, Opt-In Privacy Toggle, and "🔄 Sync My Hours Now" Button */}
        {isGuestSyncLocked && (
          <div
            id="leaderboard-guest-sync-gate"
            className="mt-3 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)',
              color: 'var(--text-main)'
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span>🔒</span>
              <span>Leaderboard sync is locked for guests. Sign in with Google to claim your @username and sync your hours to the public Top 100.</span>
            </div>
            <button
              id="leaderboard-guest-signin-btn"
              type="button"
              onClick={() => openAuthModal('leaderboard', '#leaderboard')}
              className="btn-primary-action inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In with Google</span>
            </button>
          </div>
        )}

        <div
          className="pt-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--border-glow)' }}
        >
          {/* Inline Editable "Your Leaderboard Name" */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <label
              htmlFor="leaderboard-display-name-input"
              className="text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Your Leaderboard Name:</span>
            </label>
            <input
              id="leaderboard-display-name-input"
              type="text"
              disabled={isGuestSyncLocked}
              maxLength={40}
              value={isGuestSyncLocked ? 'Guest Demo' : displayName}
              onChange={(e) => {
                if (isGuestSyncLocked) return;
                setDisplayName(e.target.value);
              }}
              onBlur={handleDisplayNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGuestSyncLocked) {
                  handleDisplayNameBlur();
                  handleSyncNow();
                }
              }}
              placeholder="Enter your display name"
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold w-full sm:w-56 focus:outline-none ${isGuestSyncLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1.5px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            />
          </div>

          {/* Privacy Opt-In Toggle + Sync My Hours Now CTA */}
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="leaderboard-optin-toggle"
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl select-none ${isGuestSyncLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Shield className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                Opt-In
              </span>
              <input
                id="leaderboard-optin-toggle"
                type="checkbox"
                disabled={isGuestSyncLocked}
                checked={isGuestSyncLocked ? false : optedIn}
                onChange={handleToggleOptIn}
                className="sr-only"
              />
              <span
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{
                  backgroundColor: (!isGuestSyncLocked && optedIn) ? 'var(--primary)' : 'rgba(148, 163, 184, 0.35)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    (!isGuestSyncLocked && optedIn) ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </label>

            <button
              id="leaderboard-sync-now-btn"
              type="button"
              disabled={isSyncing || isGuestSyncLocked}
              onClick={handleSyncNow}
              title={isGuestSyncLocked ? 'Sign in with Google to sync your hours to the Leaderboard' : 'Sync your real study hours to the Leaderboard'}
              className={`btn-primary-action flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-glow-accent transition-all ${
                isGuestSyncLocked
                  ? 'opacity-60 cursor-not-allowed'
                  : 'cursor-pointer active:scale-95 disabled:opacity-60'
              }`}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              {isGuestSyncLocked ? <Lock className="w-3.5 h-3.5" /> : <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              <span>{isSyncing ? 'Syncing Hours...' : (isGuestSyncLocked ? '🔒 Sync My Hours Now' : '🔄 Sync My Hours Now')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CLEAN EMPTY-STATE CARD WHEN NO OTHER PEERS ARE LIVE ON SUBJECT */}
      {showNoPeersEmptyState && (
        <div
          id="live-study-room-empty-state"
          className="w-full rounded-2xl p-6 text-center space-y-3 max-w-none mx-0 animate-fadeIn"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mx-auto"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
          </div>
          <p className="font-display font-bold text-base sm:text-lg" style={{ color: 'var(--text-main)' }}>
            You&apos;re leading the grind! No other peers are live on {myActiveSubject} right now—keep your timer running to appear here.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.switchView) {
                  window.switchView('timer');
                } else if (typeof window !== 'undefined') {
                  window.location.hash = 'timer';
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              ⏱️ Open Focus Timer
            </button>
            <button
              type="button"
              onClick={() => {
                setLiveOnly(false);
                setSameSubjectOnly(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                color: 'var(--text-main)',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              View All Top 100
            </button>
          </div>
        </div>
      )}

      {/* CLEAN EMPTY-STATE CARD WHEN 0 REAL RECORDS EXIST IN LEADERBOARD */}
      {!isLoading && rankings.length === 0 && (
        <div
          id="leaderboard-empty-state"
          className="w-full rounded-2xl p-8 text-center space-y-3.5 max-w-none mx-0 animate-fadeIn"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <Trophy className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="font-display font-extrabold text-lg sm:text-xl" style={{ color: 'var(--text-main)' }}>
            No Live Rankings Logged Yet
          </h2>
          <p className="text-xs sm:text-sm max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {mode === 'subject'
              ? `No students have synced study hours for ${selectedSubject} yet. Be the #1 pioneer on the board!`
              : 'Be the first student on the real-time Top 100 Leaderboard! Start a Focus Timer session or log study hours to claim Rank #1.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              id="leaderboard-empty-start-timer-btn"
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.switchView) {
                  window.switchView('timer');
                } else if (typeof window !== 'undefined') {
                  window.location.hash = 'timer';
                }
              }}
              className="btn-primary-action inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              <Clock className="w-4 h-4" />
              <span>Start Focus Timer to Join the Live Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                color: 'var(--text-main)',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>🔄 Sync My Hours Now</span>
            </button>
          </div>
        </div>
      )}

      {/* TOP 3 PODIUM CARDS (Ranks #1, #2, #3) */}
      <section aria-label="Top 3 Podium Rankings" className="w-full max-w-none mx-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2
              className="font-display font-bold text-base tracking-tight"
              style={{ color: 'var(--text-main)' }}
            >
              Top 3 Podium — {mode === 'subject' ? selectedSubject : 'Overall Weekly Leaders'}
            </h2>
          </div>
          <span
            className="text-xs font-mono-numbers font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            Showing Top {rankings.length} of {totalParticipants} students
          </span>
        </div>

        <div
          id="leaderboard-podium-grid"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-none mx-0"
        >
          {PODIUM_CONFIG.map((cfg, idx) => {
            const student = top3[idx];
            if (!student) {
              return (
                <div
                  key={cfg.rank}
                  className="rounded-2xl p-5 flex flex-col items-center justify-center text-center min-h-[168px]"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px dashed var(--border-glow)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span className="text-2xl mb-1">{cfg.medal}</span>
                  <p className="text-xs font-semibold">Rank #{cfg.rank} Open</p>
                </div>
              );
            }

            const isMe = Boolean(student.isCurrentUser || student.studentId === currentStudentId);

            return (
              <div
                key={student.studentId || cfg.rank}
                ref={isMe ? currentUserRowRef : undefined}
                data-rank={cfg.rank}
                className={`relative rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 card-glow-hover ${cfg.elevationClass}`}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: isMe ? '2px solid var(--primary)' : '1.5px solid var(--border-glow)',
                  boxShadow: isMe
                    ? '0 0 0 2px var(--primary), 0 12px 24px -8px rgba(0,0,0,0.25)'
                    : `0 8px 20px -8px ${cfg.ringStyle}`,
                  color: 'var(--text-main)'
                }}
              >
                {/* Top Row: Gold/Silver/Bronze Rank Badge + Streak Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold text-white shadow-sm"
                    style={{ background: cfg.badgeBg }}
                  >
                    <span>{cfg.medal}</span>
                    <span>{cfg.label}</span>
                  </span>

                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono-numbers"
                    style={{
                      backgroundColor: 'var(--bg-sidebar)',
                      border: '1px solid var(--border-glow)',
                      color: 'var(--text-main)'
                    }}
                  >
                    <span>🔥 {student.streak}d</span>
                  </span>
                </div>

                {/* Middle: @username + Target Exam Tag + Active Subject Tag */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className="font-display font-extrabold text-lg font-mono-numbers truncate"
                      style={{ color: 'var(--text-main)' }}
                      title={student.displayName}
                    >
                      {student.displayName}
                    </h3>
                    {isMe && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0"
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          border: '1px solid var(--border-glow)'
                        }}
                      >
                        You
                      </span>
                    )}
                    {student.targetExam && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                        style={{
                          backgroundColor: 'var(--bg-sidebar)',
                          border: '1px solid var(--border-glow)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        🎯 {student.targetExam}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {student.isLiveNow ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-semibold"
                        style={{
                          backgroundColor: 'var(--bg-sidebar)',
                          border: '1px solid var(--border-glow)',
                          color: 'var(--text-main)'
                        }}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="truncate">🟢 Studying {student.activeSubject}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg truncate"
                        style={{
                          backgroundColor: 'var(--bg-sidebar)',
                          border: '1px solid var(--border-glow)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate">{student.activeSubject}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom: Weekly / Subject Hours Logged */}
                <div
                  className="pt-3 flex items-baseline justify-between"
                  style={{ borderTop: '1px solid var(--border-glow)' }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {mode === 'subject' ? `${selectedSubject} Hours` : 'Weekly Focus Hours'}
                  </span>
                  <span
                    className="font-display font-extrabold text-2xl font-mono-numbers"
                    style={{ color: 'var(--text-main)' }}
                  >
                    {Number(student.hours || 0).toFixed(1)}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RANKS #4 TO #100 SCROLLABLE LEADERBOARD TABLE */}
      <section
        aria-label="Ranks 4 to 100 Leaderboard Table"
        className="w-full rounded-2xl overflow-hidden max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        <div
          className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            borderBottom: '1.5px solid var(--border-glow)'
          }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
            <h2
              className="font-display font-bold text-sm sm:text-base"
              style={{ color: 'var(--text-main)' }}
            >
              {hasPresenceFilter
                ? `Live Study Room Matches (${tableRows.length})`
                : 'Ranks #4 to #100'}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            <span>
              {mode === 'subject' ? `Subject: ${selectedSubject}` : 'Overall Weekly Leaderboard'}
            </span>
            {currentUserRank && (
              <button
                type="button"
                onClick={handleJumpToMyRank}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <ArrowDownCircle className="w-3 h-3" />
                <span>My Rank: #{currentUserRank.rank}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div
          id="leaderboard-table-scroll"
          className="w-full overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar"
        >
          <table className="w-full text-left border-collapse">
            <thead
              className="sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                borderBottom: '1.5px solid var(--border-glow)',
                color: 'var(--text-muted)'
              }}
            >
              <tr>
                <th className="py-3 px-4 w-20">Rank (#)</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Status / Current Subject</th>
                <th className="py-3 px-4 text-center w-28">Streak</th>
                <th className="py-3 px-4 text-right w-32">Hours Logged</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length > 0 ? (
                tableRows.map((student) => {
                  const isMe = Boolean(student.isCurrentUser || student.studentId === currentStudentId);
                  return (
                    <tr
                      key={student.studentId || student.rank}
                      ref={isMe ? currentUserRowRef : undefined}
                      data-rank={student.rank}
                      data-current-user={isMe ? 'true' : 'false'}
                      className="leaderboard-row transition-colors"
                      style={{
                        backgroundColor: isMe ? 'var(--bg-sidebar)' : 'transparent',
                        borderBottom: '1px solid var(--border-glow)',
                        outline: isMe ? '2px solid var(--primary)' : 'none',
                        outlineOffset: '-2px'
                      }}
                    >
                      {/* Rank (#) */}
                      <td className="py-3.5 px-4 font-mono-numbers font-extrabold text-sm">
                        <span
                          className="inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 rounded-lg text-xs font-bold"
                          style={
                            isMe
                              ? {
                                  backgroundColor: 'var(--primary)',
                                  color: '#FFFFFF',
                                  border: '1px solid var(--border-glow)'
                                }
                              : {
                                  backgroundColor: 'var(--bg-sidebar)',
                                  color: 'var(--text-main)',
                                  border: '1px solid var(--border-glow)'
                                }
                          }
                        >
                          #{student.rank}
                        </span>
                      </td>

                      {/* Student @username + Target Exam Tag */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="font-bold text-sm font-mono-numbers truncate max-w-[200px] sm:max-w-xs"
                            style={{ color: 'var(--text-main)' }}
                          >
                            {student.displayName}
                          </span>
                          {isMe && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                              style={{
                                backgroundColor: 'var(--primary)',
                                color: '#FFFFFF',
                                border: '1px solid var(--border-glow)'
                              }}
                            >
                              You
                            </span>
                          )}
                          {student.targetExam && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-sidebar)',
                                border: '1px solid var(--border-glow)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              🎯 {student.targetExam}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status / Current Subject */}
                      <td className="py-3.5 px-4 text-xs sm:text-sm">
                        {student.isLiveNow ? (
                          <span
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-semibold text-xs"
                            style={{
                              backgroundColor: 'var(--bg-sidebar)',
                              border: '1px solid var(--border-glow)',
                              color: 'var(--text-main)'
                            }}
                          >
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>🟢 Studying {student.activeSubject}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            Last studied: <strong style={{ color: 'var(--text-main)' }}>{student.lastSubject || student.activeSubject}</strong>
                          </span>
                        )}
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4 text-center font-mono-numbers text-xs sm:text-sm font-bold">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'var(--bg-sidebar)',
                            border: '1px solid var(--border-glow)',
                            color: 'var(--text-main)'
                          }}
                        >
                          🔥 {student.streak}d
                        </span>
                      </td>

                      {/* Hours Logged */}
                      <td
                        className="py-3.5 px-4 text-right font-mono-numbers font-extrabold text-sm"
                        style={{ color: 'var(--text-main)' }}
                      >
                        {Number(student.hours || 0).toFixed(1)}h
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 px-4 text-center text-xs sm:text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {hasPresenceFilter
                      ? `You're leading the grind! No other peers are live on ${myActiveSubject} right now—keep your timer running to appear here.`
                      : searchQuery.trim()
                        ? `No students matching "${searchQuery}" found in Ranks #4–#100.`
                        : (rankings.length > 0
                          ? `All ${rankings.length} ranked student${rankings.length === 1 ? '' : 's'} are featured on the podium above. Log hours to expand the Top 100 table!`
                          : 'Sync your study hours to populate the Top 100 rankings.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* STICKY "YOUR CURRENT RANK" SUMMARY BANNER (Pinned at bottom when student row is outside visible viewport) */}
      {showStickyMyRankBanner && (
        <div
          id="leaderboard-sticky-user-rank"
          className="fixed bottom-4 left-4 right-4 md:left-[264px] z-40 rounded-2xl px-4 sm:px-6 py-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-slideUp backdrop-blur-md"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '2px solid var(--primary)',
            boxShadow: '0 0 0 1px var(--border-glow), 0 16px 32px -8px rgba(0, 0, 0, 0.45)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center px-3 py-1 rounded-xl font-mono-numbers font-extrabold text-sm"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              #{currentUserRank.rank}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Your Current Rank
              </p>
              <p className="text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>
                {currentUserRank.displayName}
                <span className="ml-2 font-mono-numbers text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  • 🔥 {currentUserRank.streak}d • {Number(currentUserRank.hours || 0).toFixed(1)}h
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUserRank.rank <= 100 && (
              <button
                type="button"
                onClick={handleJumpToMyRank}
                className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              >
                Jump to Row
              </button>
            )}
            <button
              type="button"
              onClick={handleSyncNow}
              className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1px solid var(--border-glow)'
              }}
            >
              🔄 Sync Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

