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
  Quote
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { TELEMETRY_URL } from '../../../admin-config.js';
import {
  TARGET_EXAM_PRESETS,
  getStudentProfile,
  saveStudentProfile,
  validateUsername,
  getUsernameMonogram,
  resolveTargetExamDisplay,
  getStudentQuickStats
} from '../../../profile.js';
import {
  saveLeaderboardSettings,
  syncStudentToLeaderboard
} from '../../../leaderboard.js';

export default function ProfileTab() {
  const {
    subjects = [],
    streakData,
    dailyActivity = {},
    dailyTargetMinutes,
    setDailyTargetMinutes
  } = useData();
  const { userProfile } = useAuth();
  const { theme } = useTheme();

  const initialProfile = useMemo(() => {
    const saved = getStudentProfile(userProfile);
    // Sync initial daily goal from Dashboard target if profile hasn't been explicitly saved yet
    if (!saved.updatedAt && dailyTargetMinutes) {
      return {
        ...saved,
        dailyGoalHours: Number((dailyTargetMinutes / 60).toFixed(1))
      };
    }
    return saved;
  }, [userProfile]);

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
  const previewHandle = usernameCheck.cleaned ? `@${usernameCheck.cleaned}` : '@your_handle';
  const monogram = useMemo(
    () => getUsernameMonogram(username, fullName || userProfile?.name || 'ST'),
    [username, fullName, userProfile]
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);

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
        { userId: userProfile?.sub }
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

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.switchView) {
                window.switchView('leaderboard');
              } else if (typeof window !== 'undefined') {
                window.location.hash = 'leaderboard';
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shrink-0"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1.5px solid var(--border-glow)',
              color: 'var(--text-main)'
            }}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>View Public Leaderboard</span>
          </button>
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
              <span className={`w-2 h-2 rounded-full ${showOnLeaderboard ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{showOnLeaderboard ? 'Public on Top 100' : 'Private Mode'}</span>
            </span>
          </div>

          {/* Monogram Avatar + Bold @username + Full Name */}
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
              <h2
                id="profile-preview-handle"
                className="font-display font-extrabold text-xl sm:text-2xl truncate"
                style={{ color: 'var(--text-main)' }}
              >
                {previewHandle}
              </h2>
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--text-muted)' }}
              >
                {fullName.trim() || userProfile?.name || 'StudyFlow Scholar'}
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
            <div className="pb-3" style={{ borderBottom: '1px solid var(--border-glow)' }}>
              <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-main)' }}>
                Edit Profile Details
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Changes update your Student ID card live and sync to your Leaderboard &amp; Daily Target.
              </p>
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
                  className="flex items-center rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: usernameCheck.valid ? '1.5px solid var(--border-glow)' : '1.5px solid #f43f5e'
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
                    minLength={3}
                    maxLength={20}
                    value={username}
                    onChange={(e) => {
                      const rawVal = e.target.value.replace(/^@+/, '');
                      setUsername(rawVal);
                      setFormError(null);
                    }}
                    placeholder="kuldeep_dev"
                    className="w-full py-2.5 pr-3 bg-transparent text-sm font-semibold focus:outline-none"
                    style={{ color: 'var(--text-main)' }}
                  />
                </div>
                <p className="text-[11px]" style={{ color: usernameCheck.valid ? 'var(--text-muted)' : '#f43f5e' }}>
                  {usernameCheck.valid
                    ? `Leaderboard handle: ${usernameCheck.handle}`
                    : usernameCheck.error}
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
                  maxLength={60}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Kuldeep Kumar"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none"
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
                  min={10}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="21"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold font-mono-numbers focus:outline-none"
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
                  maxLength={40}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none"
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
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={dailyGoalHours}
                  onChange={(e) => setDailyGoalHours(e.target.value)}
                  placeholder="6.0"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold font-mono-numbers focus:outline-none"
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
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none cursor-pointer"
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
                  disabled={targetExam !== 'Other'}
                  value={customTargetExam}
                  onChange={(e) => setCustomTargetExam(e.target.value)}
                  placeholder="e.g. Full-Stack Dev / CAT / GRE"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none disabled:opacity-50"
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
                maxLength={120}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 120))}
                placeholder="Consistent 6h/day until exam day."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none resize-none"
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
              className="flex items-center justify-between gap-4 p-4 rounded-xl cursor-pointer select-none"
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
                    Displays your @username, target exam badge, weekly hours, and live studying status.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <input
                  id="profile-leaderboard-visibility-toggle"
                  type="checkbox"
                  checked={showOnLeaderboard}
                  onChange={(e) => setShowOnLeaderboard(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    backgroundColor: showOnLeaderboard ? 'var(--primary)' : 'rgba(148, 163, 184, 0.35)',
                    border: '1.5px solid var(--border-glow)'
                  }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showOnLeaderboard ? 'translate-x-5' : 'translate-x-0.5'
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
                disabled={isSaving || !usernameCheck.valid}
                className="btn-primary-action flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-glow-accent transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1.5px solid var(--border-glow)'
                }}
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving & Syncing...' : 'Save Profile & Sync'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

