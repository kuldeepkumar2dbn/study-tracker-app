import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Target,
  Clock,
  Flame,
  CheckCircle2,
  Shield,
  Save,
  Sparkles,
  MapPin,
  Calendar,
  Award,
  AlertCircle,
  Trophy,
  Quote,
  Lock,
  Unlock,
  Download,
  Trash2,
  KeyRound,
  ShieldCheck,
  LogOut,
  LogIn,
  Palette
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { applySelectedTheme } from './DashboardTab';
import { TELEMETRY_URL } from '../../../admin-config.js';
import {
  TARGET_EXAM_PRESETS,
  isUserAuthenticated,
  getStudentProfile,
  saveStudentProfile,
  validateUsername,
  getUsernameMonogram,
  resolveTargetExamDisplay,
  getStudentQuickStats
} from '../../../profile.js';
import {
  saveLeaderboardSettings,
  syncStudentToLeaderboard,
  getStudentId
} from '../../../leaderboard.js';
import {
  hasAppPin,
  setAppPin,
  removeAppPin,
  lockAppNow,
  validatePinFormat,
  getOrCreateUserSecret,
  exportAllStudyDataAsJson,
  deleteLeaderboardDataAndWipeLocal
} from '../../../security-privacy.js';

export default function ProfileTab() {
  const {
    subjects = [],
    streakData,
    dailyActivity = {},
    dailyTargetMinutes,
    setDailyTargetMinutes
  } = useData();
  const { userProfile, isAuthenticated, isGoogleAuthenticated, signOut, openAuthModal, isDemo } = useAuth();
  const { theme, setTheme, themes } = useTheme();

  // Role-based access check: non-Google-authenticated visitors view Read-Only Demo Preview Mode
  const isAuthedUser = Boolean(isGoogleAuthenticated && isUserAuthenticated(userProfile));
  const isDemoPreview = !isAuthedUser;
  const disabledFieldClass = isDemoPreview ? 'opacity-60 cursor-not-allowed' : '';

  const initialProfile = useMemo(() => {
    const saved = getStudentProfile(isAuthedUser ? userProfile : null);
    // Sync initial daily goal from Dashboard target if profile hasn't been explicitly saved yet
    if (!saved.updatedAt && dailyTargetMinutes) {
      return {
        ...saved,
        dailyGoalHours: Number((dailyTargetMinutes / 60).toFixed(1))
      };
    }
    return saved;
  }, [userProfile, isAuthedUser]);

  const [username, setUsername] = useState(initialProfile.username);
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [age, setAge] = useState(initialProfile.age === '' ? '' : String(initialProfile.age));
  const [city, setCity] = useState(initialProfile.city);
  const [targetExam, setTargetExam] = useState(initialProfile.targetExam);
  const [customTargetExam, setCustomTargetExam] = useState(initialProfile.customTargetExam);
  const [dailyGoalHours, setDailyGoalHours] = useState(String(initialProfile.dailyGoalHours || 4));
  const [bio, setBio] = useState(initialProfile.bio);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(initialProfile.showOnLeaderboard);

  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [statsTick, setStatsTick] = useState(0);
  const [, setThemeTick] = useState(0);

  // Privacy & Data Security panel states
  const [pinEnabled, setPinEnabled] = useState(() => hasAppPin());
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [confirmWipeStep, setConfirmWipeStep] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [userSecretPreview] = useState(() => {
    const secret = getOrCreateUserSecret();
    return secret ? `${secret.slice(0, 8)}••••${secret.slice(-4)}` : 'Active';
  });

  // Automatically hydrate and unlock profile inputs when the user signs in with Google
  useEffect(() => {
    if (isAuthedUser) {
      const hydrated = getStudentProfile(userProfile);
      setUsername(hydrated.username);
      setFullName(hydrated.fullName);
      setAge(hydrated.age === '' ? '' : String(hydrated.age));
      setCity(hydrated.city);
      setTargetExam(hydrated.targetExam);
      setCustomTargetExam(hydrated.customTargetExam);
      setDailyGoalHours(String(hydrated.dailyGoalHours || 4));
      setBio(hydrated.bio);
      setShowOnLeaderboard(hydrated.showOnLeaderboard);
      setFormError(null);
    }
  }, [isAuthedUser, userProfile]);

  // React to mock logbook updates & theme changes
  useEffect(() => {
    const onStatsUpdate = () => setStatsTick((t) => t + 1);
    const onThemeChange = () => setThemeTick((t) => t + 1);

    window.addEventListener('studyflow-mock-tests-updated', onStatsUpdate);
    window.addEventListener('studyflow-leaderboard-synced', onStatsUpdate);
    window.addEventListener('themeChanged', onThemeChange);
    window.addEventListener('studyflow-theme-changed', onThemeChange);

    return () => {
      window.removeEventListener('studyflow-mock-tests-updated', onStatsUpdate);
      window.removeEventListener('studyflow-leaderboard-synced', onStatsUpdate);
      window.removeEventListener('themeChanged', onThemeChange);
      window.removeEventListener('studyflow-theme-changed', onThemeChange);
    };
  }, [theme]);

  // Live validation & ID Card preview computations
  const usernameCheck = useMemo(() => validateUsername(username), [username]);
  const previewHandle = isDemoPreview
    ? 'Guest Demo'
    : (usernameCheck.cleaned ? `@${usernameCheck.cleaned}` : '@your_handle');
  const monogram = useMemo(
    () => (isDemoPreview ? 'GD' : getUsernameMonogram(username, fullName || userProfile?.name || 'ST')),
    [isDemoPreview, username, fullName, userProfile]
  );
  const targetExamInfo = useMemo(
    () => resolveTargetExamDisplay(targetExam, customTargetExam),
    [targetExam, customTargetExam]
  );

  const quickStats = useMemo(
    () => getStudentQuickStats({ subjects, streakData }),
    [subjects, streakData, statsTick]
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  // App PIN Lock handlers
  const handleSetAppPin = async (e) => {
    e.preventDefault();
    setPinError(null);
    const check = validatePinFormat(newPin);
    if (!check.valid) {
      setPinError(check.error);
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PIN entries do not match.');
      return;
    }

    setIsUpdatingPin(true);
    try {
      const res = await setAppPin(check.cleaned);
      if (res.success) {
        setPinEnabled(true);
        setNewPin('');
        setConfirmPin('');
        showToast('🔒 App PIN Lock enabled (SHA-256 hashed locally).');
      } else {
        setPinError(res.error || 'Could not enable PIN.');
      }
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleRemoveAppPin = () => {
    removeAppPin();
    setPinEnabled(false);
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
    showToast('🔓 App PIN Lock removed.');
  };

  const handleExportData = () => {
    const res = exportAllStudyDataAsJson();
    if (res.success) {
      showToast(`📦 Exported backup: ${res.filename}`);
    }
  };

  const handleDeleteLeaderboardAndWipe = async () => {
    setIsWiping(true);
    try {
      const studentId = getStudentId(userProfile);
      await deleteLeaderboardDataAndWipeLocal(TELEMETRY_URL, { studentId });
      setPinEnabled(false);
      setConfirmWipeStep(false);
      showToast('🗑️ Leaderboard entry deleted and local storage wiped. Reloading...');
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      }, 1200);
    } finally {
      setIsWiping(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Block all edits and saves in Read-Only Demo Preview Mode until Google Sign-In
    if (isDemoPreview) {
      openAuthModal('profile', '#profile');
      return;
    }

    const check = validateUsername(username);
    if (!check.valid) {
      setFormError(check.error);
      return;
    }

    if (age !== '' && (Number(age) < 10 || Number(age) > 99 || Number.isNaN(Number(age)))) {
      setFormError('Age must be a number between 10 and 99.');
      return;
    }

    const parsedGoalHours = Math.max(0.5, Math.min(24, Number(dailyGoalHours) || 4));
    setIsSaving(true);

    try {
      const saveRes = saveStudentProfile(
        {
          username: check.cleaned,
          fullName,
          age,
          city,
          targetExam,
          customTargetExam,
          dailyGoalHours: parsedGoalHours,
          bio,
          showOnLeaderboard
        },
        { userId: userProfile?.sub, requireAuth: true, authUserProfile: userProfile }
      );

      if (!saveRes.success) {
        setFormError(saveRes.error || 'Could not save profile.');
        setIsSaving(false);
        return;
      }

      const savedProfile = saveRes.profile;
      setUsername(savedProfile.username);
      setDailyGoalHours(String(savedProfile.dailyGoalHours));

      // 1. Sync Daily Study Goal with Dashboard's Daily Target card
      if (typeof setDailyTargetMinutes === 'function') {
        setDailyTargetMinutes(Math.round(savedProfile.dailyGoalHours * 60));
      }

      // 2. Sync leaderboard displayName (@username) & visibility settings
      saveLeaderboardSettings(
        {
          displayName: savedProfile.handle,
          optedIn: savedProfile.showOnLeaderboard
        },
        userProfile
      );

      // 3. Push @username + targetExam to Leaderboard sheet immediately
      await syncStudentToLeaderboard(
        TELEMETRY_URL,
        {
          userProfile,
          studentProfile: savedProfile,
          username: savedProfile.username,
          displayName: savedProfile.handle,
          targetExam: savedProfile.resolvedTargetExam,
          optedIn: savedProfile.showOnLeaderboard,
          subjectsList: subjects,
          subjects,
          streakData,
          dailyActivity
        },
        {
          username: savedProfile.username,
          displayName: savedProfile.handle,
          targetExam: savedProfile.resolvedTargetExam,
          optedIn: savedProfile.showOnLeaderboard
        }
      );

      showToast(
        savedProfile.showOnLeaderboard
          ? `Profile saved! Your @username is now live on the Leaderboard.`
          : `Profile saved! Your @username (${savedProfile.handle}) is set to private.`
      );
    } catch (err) {
      console.error('Error saving student profile:', err);
      setFormError('Something went wrong while syncing your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="student-profile-view-root"
      className="space-y-6 animate-fadeIn w-full max-w-none mx-0 pb-10"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="profile-save-toast"
          className="fixed bottom-6 right-6 z-50 max-w-md px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-slideUp backdrop-blur-md"
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

      {/* Prominent Read-Only Demo Preview Mode Banner (shown to non-logged-in visitors) */}
      {isDemoPreview && (
        <div
          id="profile-demo-preview-banner"
          role="region"
          aria-label="Demo Preview Mode Notice"
          className="w-full rounded-2xl p-4 sm:p-5 shadow-glow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '2px solid var(--primary)',
            boxShadow: '0 0 0 1px var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span
              className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1.5px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              Demo
            </span>
            <p className="text-xs sm:text-sm font-bold leading-relaxed" style={{ color: 'var(--text-main)' }}>
              👀 Demo Preview Mode — Sign in with Google to claim your custom @username, edit your profile, and sync to the Leaderboard
            </p>
          </div>
          <button
            id="profile-demo-signin-btn"
            type="button"
            onClick={() => openAuthModal('profile', '#profile')}
            className="btn-primary-action inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shrink-0 transition-all cursor-pointer active:scale-95"
            style={{
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In with Google</span>
          </button>
        </div>
      )}

      {/* Top Header Banner */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-7 shadow-glow-card card-glow-hover w-full max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <User className="w-3.5 h-3.5" />
              <span>Student Identity • Public Leaderboard Handle</span>
            </span>

            <h1
              className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: 'var(--text-main)' }}
            >
              My Student Profile
            </h1>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Claim your unique <strong style={{ color: 'var(--text-main)' }}>@username</strong>, set your target exam and daily study goal, and showcase your verified study stats on the real-time Leaderboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.switchView) {
                  window.switchView('leaderboard');
                } else if (typeof window !== 'undefined') {
                  window.location.hash = 'leaderboard';
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1.5px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>View Public Leaderboard</span>
            </button>

            {isAuthedUser ? (
              <button
                id="profile-signout-btn"
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-rose-500 transition-all cursor-pointer active:scale-95"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1.5px solid #f43f5e'
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                id="profile-signin-btn"
                type="button"
                onClick={() => openAuthModal('profile', '#profile')}
                className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1.5px solid var(--border-glow)'
                }}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2-COLUMN RESPONSIVE PROFILE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-none mx-0 items-start">
        
        {/* LEFT COLUMN: LIVE STUDENT ID CARD PREVIEW */}
        <section
          id="student-id-card-preview"
          aria-label="Live Student ID Card Preview"
          className="lg:col-span-5 rounded-2xl p-6 space-y-5 shadow-glow-card card-glow-hover w-full"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          {/* ID Card Top Bar */}
          <div className="flex items-center justify-between gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-glow)' }}>
            <span className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Student ID Card</span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <span className={`w-2 h-2 rounded-full ${isDemoPreview ? 'bg-amber-500' : (showOnLeaderboard ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')}`} />
              <span>{isDemoPreview ? 'Read-Only Demo' : (showOnLeaderboard ? 'Public on Top 100' : 'Private Mode')}</span>
            </span>
          </div>

          {/* Monogram Avatar + Bold @username (or Guest Demo badge) + Full Name */}
          <div className="flex items-center gap-4">
            <div
              id="profile-monogram-avatar"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-display font-extrabold text-2xl sm:text-3xl tracking-tight shrink-0 shadow-lg select-none"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '2px solid var(--border-glow)'
              }}
            >
              {monogram}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              {isDemoPreview ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    id="profile-guest-demo-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold tracking-tight"
                    style={{
                      backgroundColor: 'var(--bg-sidebar)',
                      border: '1.5px solid var(--border-glow)',
                      color: 'var(--text-main)'
                    }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span id="profile-preview-handle">Guest Demo</span>
                  </span>
                </div>
              ) : (
                <h2
                  id="profile-preview-handle"
                  className="font-display font-extrabold text-xl sm:text-2xl truncate"
                  style={{ color: 'var(--text-main)' }}
                >
                  {previewHandle}
                </h2>
              )}
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {isDemoPreview ? 'Sign in with Google to claim @username' : (fullName.trim() || userProfile?.name || 'StudyFlow Scholar')}
              </p>

              {/* Target Exam / Primary Skill Badge */}
              <div className="pt-1">
                <span
                  id="profile-preview-target-badge"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: '1px solid var(--border-glow)'
                  }}
                >
                  <span>{targetExamInfo.icon}</span>
                  <span>{targetExamInfo.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Age, City & Daily Goal Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {age !== '' && !Number.isNaN(Number(age)) && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono-numbers"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              >
                <Calendar className="w-3 h-3" />
                <span>Age {age}</span>
              </span>
            )}

            {city.trim() && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              >
                <MapPin className="w-3 h-3" />
                <span>{city.trim()}</span>
              </span>
            )}

            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono-numbers"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <Target className="w-3 h-3" />
              <span>Goal: {Number(dailyGoalHours || 4).toFixed(1)}h/day</span>
            </span>
          </div>

          {/* Personal Study Motto / Bio */}
          <div
            className="rounded-xl p-4 space-y-1.5"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border-glow)'
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <Quote className="w-3 h-3" />
              <span>Study Motto / Bio</span>
            </div>
            <p className="text-xs sm:text-sm font-medium italic leading-relaxed" style={{ color: 'var(--text-main)' }}>
              &ldquo;{bio.trim() || 'Consistent daily focus beats last-minute cramming.'}&rdquo;
            </p>
          </div>

          {/* Quick Stats Strip: Total Study Hours, Current Streak, Mock Accuracy % */}
          <div
            id="profile-quick-stats-strip"
            className="grid grid-cols-3 gap-2.5 pt-2"
          >
            <div
              className="rounded-xl p-3 text-center space-y-1"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Clock className="w-4 h-4 mx-auto" style={{ color: 'var(--text-muted)' }} />
              <p className="font-display font-extrabold text-lg font-mono-numbers" style={{ color: 'var(--text-main)' }}>
                {quickStats.totalStudyHours}h
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Total Study Hours
              </p>
            </div>

            <div
              className="rounded-xl p-3 text-center space-y-1"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Flame className="w-4 h-4 mx-auto text-amber-500" />
              <p className="font-display font-extrabold text-lg font-mono-numbers" style={{ color: 'var(--text-main)' }}>
                🔥 {quickStats.currentStreak}d
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Current Streak
              </p>
            </div>

            <div
              className="rounded-xl p-3 text-center space-y-1"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Award className="w-4 h-4 mx-auto text-emerald-500" />
              <p className="font-display font-extrabold text-lg font-mono-numbers" style={{ color: 'var(--text-main)' }}>
                {quickStats.mockAccuracyPct}%
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Mock Accuracy %
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: EDIT PROFILE FORM */}
        <section
          aria-label="Edit Student Profile Form"
          className="lg:col-span-7 rounded-2xl p-6 shadow-glow-card w-full"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1.5px solid var(--border-glow)',
            color: 'var(--text-main)'
          }}
        >
          <form id="student-profile-form" onSubmit={handleSaveProfile} className="space-y-5">
            <div className="pb-3 flex flex-wrap items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-glow)' }}>
              <div>
                <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-main)' }}>
                  Edit Profile Details
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isDemoPreview
                    ? 'Read-only preview — Sign in with Google above to unlock editing and cloud sync.'
                    : 'Changes update your Student ID card live and sync to your Leaderboard & Daily Target.'}
                </p>
              </div>
              {isDemoPreview && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                >
                  <Lock className="w-3 h-3" />
                  <span>Read-Only</span>
                </span>
              )}
            </div>

            {formError && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-500"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1.5px solid #f43f5e'
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Row 1: Username (@handle) & Full Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-username-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Username (@handle) <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center rounded-xl overflow-hidden ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: (isDemoPreview || usernameCheck.valid) ? '1.5px solid var(--border-glow)' : '1.5px solid #f43f5e'
                  }}
                >
                  <span
                    className="pl-3 pr-1.5 text-sm font-extrabold select-none"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    @
                  </span>
                  <input
                    id="profile-username-input"
                    type="text"
                    required
                    disabled={isDemoPreview}
                    minLength={3}
                    maxLength={20}
                    value={isDemoPreview ? 'guest_demo' : username}
                    onChange={(e) => {
                      if (isDemoPreview) return;
                      const rawVal = e.target.value.replace(/^@+/, '');
                      setUsername(rawVal);
                      setFormError(null);
                    }}
                    placeholder="kuldeep_dev"
                    className={`w-full py-2.5 pr-3 bg-transparent text-sm font-semibold focus:outline-none ${disabledFieldClass}`}
                    style={{ color: 'var(--text-main)' }}
                  />
                </div>
                <p className="text-[11px]" style={{ color: (isDemoPreview || usernameCheck.valid) ? 'var(--text-muted)' : '#f43f5e' }}>
                  {isDemoPreview
                    ? 'Sign in with Google to claim your custom @username.'
                    : (usernameCheck.valid
                        ? `Leaderboard handle: ${usernameCheck.handle}`
                        : usernameCheck.error)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-fullname-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Full Name <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  id="profile-fullname-input"
                  type="text"
                  disabled={isDemoPreview}
                  maxLength={60}
                  value={fullName}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setFullName(e.target.value);
                  }}
                  placeholder="e.g. Kuldeep Kumar"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            {/* Row 2: Age, City & Daily Study Goal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-age-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Age (10–99)
                </label>
                <input
                  id="profile-age-input"
                  type="number"
                  disabled={isDemoPreview}
                  min={10}
                  max={99}
                  value={age}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setAge(e.target.value);
                  }}
                  placeholder="21"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold font-mono-numbers focus:outline-none ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-city-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  City <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <input
                  id="profile-city-input"
                  type="text"
                  disabled={isDemoPreview}
                  maxLength={40}
                  value={city}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setCity(e.target.value);
                  }}
                  placeholder="e.g. New Delhi"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-daily-goal-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Daily Study Goal (Hours)
                </label>
                <input
                  id="profile-daily-goal-input"
                  type="number"
                  disabled={isDemoPreview}
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={dailyGoalHours}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setDailyGoalHours(e.target.value);
                  }}
                  placeholder="6.0"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold font-mono-numbers focus:outline-none ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            {/* Row 3: Target Exam / Primary Skill Focus Dropdown + Custom Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-target-exam-select"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Target Exam / Primary Skill Focus
                </label>
                <select
                  id="profile-target-exam-select"
                  disabled={isDemoPreview}
                  value={targetExam}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setTargetExam(e.target.value);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none ${isDemoPreview ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                >
                  {TARGET_EXAM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.icon} {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-custom-target-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  {targetExam === 'Other' ? 'Custom Exam / Skill Title' : 'Custom Focus (when "Other" selected)'}
                </label>
                <input
                  id="profile-custom-target-input"
                  type="text"
                  maxLength={40}
                  disabled={isDemoPreview || targetExam !== 'Other'}
                  value={customTargetExam}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setCustomTargetExam(e.target.value);
                  }}
                  placeholder="e.g. Full-Stack Dev / CAT / GRE"
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${disabledFieldClass}`}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </div>

            {/* Row 4: Short Bio / Study Motto (Max 120 chars) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-bio-input"
                  className="block text-xs font-bold"
                  style={{ color: 'var(--text-main)' }}
                >
                  Short Bio / Study Motto
                </label>
                <span className="text-[11px] font-mono-numbers font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {bio.length} / 120
                </span>
              </div>
              <textarea
                id="profile-bio-input"
                rows={2}
                disabled={isDemoPreview}
                maxLength={120}
                value={bio}
                onChange={(e) => {
                  if (isDemoPreview) return;
                  setBio(e.target.value.slice(0, 120));
                }}
                placeholder="Consistent 6h/day until exam day."
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none resize-none ${disabledFieldClass}`}
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1.5px solid var(--border-glow)',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            {/* Row 5: Leaderboard Visibility Toggle */}
            <label
              htmlFor="profile-leaderboard-visibility-toggle"
              aria-disabled={isDemoPreview}
              className={`flex items-center justify-between gap-4 p-4 rounded-xl select-none ${isDemoPreview ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1.5px solid var(--border-glow)'
              }}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 shrink-0" style={{ color: 'var(--text-main)' }} />
                <div>
                  <p className="text-xs sm:text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                    Show my <span className="font-mono-numbers">{previewHandle}</span> on the Public Top 100 Leaderboard
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {isDemoPreview
                      ? 'Sign in with Google to opt into the Public Top 100 Leaderboard.'
                      : 'Displays your @username, target exam badge, weekly hours, and live studying status.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <input
                  id="profile-leaderboard-visibility-toggle"
                  type="checkbox"
                  disabled={isDemoPreview}
                  checked={isDemoPreview ? false : showOnLeaderboard}
                  onChange={(e) => {
                    if (isDemoPreview) return;
                    setShowOnLeaderboard(e.target.checked);
                  }}
                  className={`sr-only ${disabledFieldClass}`}
                />
                <span
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: (!isDemoPreview && showOnLeaderboard) ? 'var(--primary)' : 'rgba(148, 163, 184, 0.35)',
                    border: '1.5px solid var(--border-glow)'
                  }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      (!isDemoPreview && showOnLeaderboard) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </div>
            </label>

            {/* Submit Button: "Save Profile & Sync" */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                id="save-profile-sync-btn"
                type="submit"
                disabled={isDemoPreview || isSaving || !usernameCheck.valid}
                className={`btn-primary-action flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-glow-accent transition-all ${
                  isDemoPreview
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'
                }`}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1.5px solid var(--border-glow)'
                }}
              >
                {isDemoPreview ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Saving & Syncing...' : 'Save Profile & Sync'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* COLOR THEME APPEARANCE SELECTOR (Moved off Dashboard into Header Dropdown & My Profile) */}
      <section
        id="profile-theme-card"
        aria-label="Color Theme Appearance"
        className="w-full rounded-2xl p-6 space-y-4 shadow-glow-card max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
          <div>
            <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-main)' }}>
              Color Theme &amp; Appearance
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Choose your workspace color theme — also available anytime from the top header dropdown.
            </p>
          </div>
        </div>

        <div id="profile-theme-switcher" className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {(themes || []).map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-theme-id={t.id}
                onClick={() => {
                  setTheme(t.id);
                  applySelectedTheme(t.id);
                }}
                className={`theme-pill w-full flex items-center justify-center text-center truncate gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  isSelected ? 'is-active' : ''
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: '1.5px solid var(--border-glow)'
                      }
                    : {
                        backgroundColor: 'var(--bg-sidebar)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-glow)'
                      }
                }
                title={`Switch to ${t.name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                  style={{ backgroundColor: t.primaryColor }}
                />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* PRIVACY & DATA SECURITY PANEL */}
      <section
        id="privacy-security-panel"
        aria-label="Privacy and Data Security"
        className="w-full rounded-2xl p-6 space-y-6 shadow-glow-card max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4" style={{ borderBottom: '1px solid var(--border-glow)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl" style={{ color: 'var(--text-main)' }}>
                🔒 Privacy &amp; Data Security
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Protect shared-computer sessions, export your full study archive, or erase your public footprint.
              </p>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono-numbers shrink-0"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border-glow)',
              color: 'var(--text-main)'
            }}
            title="Cryptographic ownership token verifying your Leaderboard updates"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Token: {userSecretPreview}</span>
          </span>
        </div>

        {/* Public Leaderboard Data Control Guarantee Badge */}
        <div
          id="privacy-data-scope-badge"
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            border: '1.5px solid var(--border-glow)'
          }}
        >
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>
              Public Leaderboard Data Control — Zero Personal Leaks
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-main)' }}>Age, City, Notes, and Mock Mistakes NEVER leave your private browser/Google Drive</strong>—only your <strong style={{ color: 'var(--text-main)' }}>@username</strong> and study hours are shared if you opt in.
            </p>
          </div>
        </div>

        {/* 2-Column Security Controls: App PIN Lock + Data Export & Erasure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Control 1: App PIN Lock (4–6 Digits, SHA-256 Hashed) */}
          <div
            id="pin-lock-settings"
            className="rounded-2xl p-5 space-y-4"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
                <h3 className="font-display font-bold text-sm sm:text-base" style={{ color: 'var(--text-main)' }}>
                  App PIN Lock (4–6 Digits)
                </h3>
              </div>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                style={{
                  backgroundColor: pinEnabled ? 'var(--primary)' : 'var(--bg-card)',
                  color: pinEnabled ? '#FFFFFF' : 'var(--text-muted)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                {pinEnabled ? '🔒 PIN Active' : '🔓 Disabled'}
              </span>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Ideal for shared or library computers. Your PIN is stored locally as a one-way SHA-256 hash (<code className="font-mono">studytracker_pin_hash</code>) and locks the screen on initial page load.
            </p>

            <form onSubmit={handleSetAppPin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  id="set-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setPinError(null);
                  }}
                  placeholder="Enter 4–6 digit PIN"
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-mono-numbers font-bold focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
                <input
                  id="confirm-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setPinError(null);
                  }}
                  placeholder="Confirm PIN"
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm font-mono-numbers font-bold focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px solid var(--border-glow)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>

              {pinError && (
                <p className="text-xs font-semibold text-rose-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  id="save-pin-btn"
                  type="submit"
                  disabled={isUpdatingPin || newPin.length < 4}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: '1.5px solid var(--border-glow)'
                  }}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{pinEnabled ? 'Update PIN' : 'Enable PIN Lock'}</span>
                </button>

                {pinEnabled && (
                  <>
                    <button
                      id="lock-now-btn"
                      type="button"
                      onClick={() => lockAppNow()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1.5px solid var(--border-glow)'
                      }}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Now</span>
                    </button>

                    <button
                      id="remove-pin-btn"
                      type="button"
                      onClick={handleRemoveAppPin}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-500 transition-all cursor-pointer active:scale-95"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1.5px solid #f43f5e'
                      }}
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Remove PIN</span>
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>

          {/* Control 2: 1-Click Export (.json) & Delete Leaderboard + Wipe Local Storage */}
          <div
            className="rounded-2xl p-5 flex flex-col justify-between gap-4"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            {/* 1-Click Export My Data (.json) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" style={{ color: 'var(--text-main)' }} />
                <h3 className="font-display font-bold text-sm sm:text-base" style={{ color: 'var(--text-main)' }}>
                  Data Portability &amp; Right to Erasure
                </h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Download a full JSON archive of your local study history, mock tests, syllabus, routine, and profile anytime.
              </p>
              <button
                id="export-data-json-btn"
                type="button"
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer active:scale-95"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1.5px solid var(--border-glow)'
                }}
              >
                <Download className="w-4 h-4" />
                <span>1-Click Export My Data (.json)</span>
              </button>
            </div>

            {/* Delete My Leaderboard Data & Wipe Local Storage */}
            <div className="pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--border-glow)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Permanently remove your public Leaderboard row (authenticated with your <code className="font-mono">userSecret</code> token) and erase all local browser data.
              </p>

              {!confirmWipeStep ? (
                <button
                  id="wipe-local-and-leaderboard-btn"
                  type="button"
                  onClick={() => setConfirmWipeStep(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-rose-500 transition-all cursor-pointer active:scale-95"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px solid #f43f5e'
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete My Leaderboard Data &amp; Wipe Local Storage</span>
                </button>
              ) : (
                <div
                  className="p-3 rounded-xl space-y-2.5"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1.5px solid #f43f5e'
                  }}
                >
                  <p className="text-xs font-bold text-rose-500">
                    Confirm permanent erasure? Export a .json backup first if needed.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="confirm-wipe-btn"
                      type="button"
                      disabled={isWiping}
                      onClick={handleDeleteLeaderboardAndWipe}
                      className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-rose-600 text-white cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isWiping ? 'Deleting & Wiping...' : 'Yes, Delete & Wipe Everything'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipeStep(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-sidebar)',
                        border: '1px solid var(--border-glow)',
                        color: 'var(--text-main)'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

