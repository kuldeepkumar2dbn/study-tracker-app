/**
 * Student Profile & Identity Manager (profile.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Manages:
 * - @username validation & formatting (3-20 alphanumeric/underscore chars)
 * - Circular 2-letter monogram avatar generation
 * - Age, City, Target Exam / Primary Skill, Daily Study Goal, Bio, Leaderboard Opt-In
 * - LocalStorage persistence, Google Drive sync (patchUserData), and Quick Stats aggregation
 */

import { patchUserData } from './storage-helper.js';
import { getActiveUserId, isUserAuthenticated } from './auth-guard.js';
import { sanitizeText, stripHtmlTags } from './security-privacy.js';
import { syncEncryptedVaultMirror, getDefaultVaultSecret } from './crypto-vault.js';

export { sanitizeText, isUserAuthenticated };

/**
 * Evaluates whether #view-profile should run in Read-Only Demo Preview mode
 * or full authenticated editing mode based on Google OAuth login status.
 *
 * @param {Object|null} [authUserProfile] - Optional profile override
 * @returns {{ isAuthenticated: boolean, isReadOnlyDemo: boolean, badgeLabel: string|null, mode: string }}
 */
export function getProfileAccessState(authUserProfile = undefined) {
  const authed = isUserAuthenticated(authUserProfile);
  return {
    isAuthenticated: authed,
    isReadOnlyDemo: !authed,
    badgeLabel: authed ? null : 'Guest Demo',
    mode: authed ? 'authenticated' : 'demo-preview'
  };
}

/**
 * Applies or removes Read-Only Demo Preview DOM lock states inside #view-profile.
 * Sets `disabled = true` and `opacity-60 cursor-not-allowed` on every input, select,
 * textarea, privacy toggle, and Save Profile & Sync button when the visitor is not signed in.
 *
 * @param {HTMLElement|Document|null} [root]
 * @param {Object|null} [authUserProfile]
 * @returns {{ isAuthenticated: boolean, isReadOnlyDemo: boolean, lockedCount: number }}
 */
export function applyProfileDemoMode(root = null, authUserProfile = undefined) {
  const state = getProfileAccessState(authUserProfile);
  if (typeof document === 'undefined' && !root) {
    return { ...state, lockedCount: 0 };
  }

  const scope = root || document.getElementById('view-profile') || document.getElementById('student-profile-view-root');
  if (!scope || typeof scope.querySelectorAll !== 'function') {
    return { ...state, lockedCount: 0 };
  }

  const form = scope.querySelector('#student-profile-form') || scope;
  const controls = form.querySelectorAll('input, select, textarea, button[type="submit"], #save-profile-sync-btn');
  let lockedCount = 0;

  controls.forEach((el) => {
    if (state.isReadOnlyDemo) {
      el.disabled = true;
      el.setAttribute('aria-disabled', 'true');
      el.classList.add('opacity-60', 'cursor-not-allowed');
      lockedCount += 1;
    } else {
      // Preserve custom-target-input disabled rule if targetExam !== 'Other'
      if (el.id === 'profile-custom-target-input') {
        const targetSelect = form.querySelector('#profile-target-exam-select');
        const isOther = targetSelect ? targetSelect.value === 'Other' : false;
        el.disabled = !isOther;
      } else {
        el.disabled = false;
      }
      el.removeAttribute('aria-disabled');
      el.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

  const banner = scope.querySelector('#profile-demo-preview-banner');
  if (banner) {
    banner.hidden = !state.isReadOnlyDemo;
  }

  return { ...state, lockedCount };
}

export const STUDENT_PROFILE_KEY = 'studytracker_student_profile';
export const MOCK_TESTS_STORAGE_KEY = 'studytracker_mock_tests';

export const TARGET_EXAM_PRESETS = [
  { id: 'JEE / NEET', label: 'JEE / NEET', icon: '⚛️' },
  { id: 'GATE', label: 'GATE', icon: '🎯' },
  { id: 'UPSC / SSC', label: 'UPSC / SSC', icon: '🏛️' },
  { id: 'Coding & Software', label: 'Coding & Software', icon: '💻' },
  { id: 'Electronics & Hardware', label: 'Electronics & Hardware', icon: '🔌' },
  { id: 'Other', label: 'Other', icon: '✨' }
];

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Strips leading @ and non-alphanumeric/underscore characters from raw username input.
 */
export function sanitizeUsername(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
}

/**
 * Validates a student @username (required, 3-20 alphanumeric/underscore characters).
 */
export function validateUsername(raw = '') {
  const trimmed = String(raw || '').trim().replace(/^@+/, '');
  if (!trimmed) {
    return { valid: false, cleaned: '', handle: '', error: 'Username is required (3–20 letters, numbers, or underscores).' };
  }
  if (trimmed.length < 3) {
    return { valid: false, cleaned: trimmed, handle: `@${trimmed}`, error: 'Username must be at least 3 characters.' };
  }
  if (trimmed.length > 20) {
    return { valid: false, cleaned: trimmed.slice(0, 20), handle: `@${trimmed.slice(0, 20)}`, error: 'Username must be 20 characters or fewer.' };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return { valid: false, cleaned: sanitizeUsername(trimmed), handle: `@${sanitizeUsername(trimmed)}`, error: 'Only letters, numbers, and underscores (_) are allowed.' };
  }
  return {
    valid: true,
    cleaned: trimmed,
    handle: `@${trimmed}`,
    error: null
  };
}

/**
 * Ensures @ prefix on any non-empty username string.
 */
export function formatHandle(username = '') {
  const clean = sanitizeUsername(username);
  return clean ? `@${clean}` : '@scholar';
}

/**
 * Generates a 2-letter uppercase monogram from the first 2 letters of @username.
 */
export function getUsernameMonogram(username = '', fallbackName = 'ST') {
  const cleanUser = sanitizeUsername(username).replace(/_/g, '');
  if (cleanUser.length >= 2) {
    return cleanUser.slice(0, 2).toUpperCase();
  }
  if (cleanUser.length === 1) {
    return (cleanUser + 'S').toUpperCase();
  }
  const cleanFallback = String(fallbackName || 'ST').replace(/[^a-zA-Z0-9]/g, '');
  return (cleanFallback.slice(0, 2) || 'ST').toUpperCase();
}

/**
 * Resolves the display target exam / primary skill label and icon.
 */
export function resolveTargetExamDisplay(targetExam = 'GATE', customTargetExam = '') {
  const isOther = targetExam === 'Other';
  const label = isOther
    ? (String(customTargetExam || '').trim() || 'Custom Focus')
    : (String(targetExam || '').trim() || 'GATE');
  const preset = TARGET_EXAM_PRESETS.find((p) => p.id === targetExam);
  return {
    label,
    icon: preset ? preset.icon : '🎯'
  };
}

/**
 * Derives a default clean username from an authenticated Google profile or fallback.
 */
function deriveDefaultUsername(authUserProfile = null) {
  if (authUserProfile?.email) {
    const emailLocal = sanitizeUsername(String(authUserProfile.email).split('@')[0]);
    if (emailLocal.length >= 3) return emailLocal;
  }
  if (authUserProfile?.name) {
    const fromName = sanitizeUsername(String(authUserProfile.name).toLowerCase().replace(/\s+/g, '_'));
    if (fromName.length >= 3) return fromName;
  }
  return 'focused_scholar';
}

/**
 * Reads the persisted Student Profile from localStorage, falling back to auth profile defaults.
 */
export function getStudentProfile(authUserProfile = null) {
  const defaultUsername = deriveDefaultUsername(authUserProfile);
  const defaults = {
    username: defaultUsername,
    handle: `@${defaultUsername}`,
    fullName: authUserProfile?.name ? String(authUserProfile.name).trim() : '',
    age: '',
    city: '',
    targetExam: 'GATE',
    customTargetExam: '',
    resolvedTargetExam: 'GATE',
    dailyGoalHours: 4,
    bio: '',
    showOnLeaderboard: true,
    updatedAt: null
  };

  if (typeof localStorage === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const cleanUsername = sanitizeUsername(parsed.username || defaultUsername) || defaultUsername;
    const targetExam = parsed.targetExam || defaults.targetExam;
    const customTargetExam = String(parsed.customTargetExam || '').trim();
    const { label: resolvedTargetExam } = resolveTargetExamDisplay(targetExam, customTargetExam);

    return {
      username: cleanUsername,
      handle: `@${cleanUsername}`,
      fullName: parsed.fullName !== undefined ? String(parsed.fullName) : defaults.fullName,
      age: parsed.age !== undefined && parsed.age !== null && parsed.age !== '' ? Number(parsed.age) : '',
      city: parsed.city !== undefined ? String(parsed.city) : '',
      targetExam,
      customTargetExam,
      resolvedTargetExam,
      dailyGoalHours: Math.max(0.5, Math.min(24, Number(parsed.dailyGoalHours) || defaults.dailyGoalHours)),
      bio: String(parsed.bio || '').slice(0, 120),
      showOnLeaderboard: parsed.showOnLeaderboard !== undefined ? Boolean(parsed.showOnLeaderboard) : true,
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return defaults;
  }
}

/**
 * Validates and persists the Student Profile to localStorage + Google Drive via patchUserData.
 * Blocks edits and persistence when the visitor is not signed in via Google OAuth.
 */
export function saveStudentProfile(input = {}, { userId = null, requireAuth = false, authUserProfile = undefined, bypassAuthCheck = false } = {}) {
  const shouldEnforceAuth = requireAuth === true || (typeof window !== 'undefined' && bypassAuthCheck !== true);
  if (shouldEnforceAuth && !isUserAuthenticated(authUserProfile)) {
    return {
      success: false,
      blocked: true,
      reason: 'auth_required',
      error: 'Demo Preview Mode is read-only. Sign in with Google to edit and save your profile.'
    };
  }

  const check = validateUsername(input.username);
  if (!check.valid) {
    return { success: false, error: check.error };
  }

  let parsedAge = '';
  if (input.age !== '' && input.age !== null && input.age !== undefined) {
    const numAge = Number(input.age);
    if (Number.isNaN(numAge) || numAge < 10 || numAge > 99) {
      return { success: false, error: 'Age must be between 10 and 99.' };
    }
    parsedAge = Math.round(numAge);
  }

  const dailyGoalHours = Math.max(0.5, Math.min(24, Number(input.dailyGoalHours) || 4));
  const targetExam = stripHtmlTags(String(input.targetExam || 'GATE')).trim() || 'GATE';
  const customTargetExam = stripHtmlTags(String(input.customTargetExam || '')).trim().slice(0, 40);
  const { label: resolvedTargetExam } = resolveTargetExamDisplay(targetExam, customTargetExam);

  const savedProfile = {
    username: check.cleaned,
    handle: check.handle,
    fullName: stripHtmlTags(String(input.fullName || '')).trim().slice(0, 60),
    age: parsedAge,
    city: stripHtmlTags(String(input.city || '')).trim().slice(0, 40),
    targetExam,
    customTargetExam,
    resolvedTargetExam: stripHtmlTags(resolvedTargetExam),
    dailyGoalHours: Number(dailyGoalHours.toFixed(1)),
    bio: stripHtmlTags(String(input.bio || '')).trim().slice(0, 120),
    showOnLeaderboard: input.showOnLeaderboard !== undefined ? Boolean(input.showOnLeaderboard) : true,
    updatedAt: new Date().toISOString()
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(savedProfile));
      syncEncryptedVaultMirror(STUDENT_PROFILE_KEY, savedProfile, getDefaultVaultSecret(userId));
    } catch (e) {
      console.warn('Error saving student profile to localStorage:', e);
    }
  }

  // Sync to Google Drive / master user dataset non-destructively via patchUserData
  try {
    const activeId = userId || (typeof getActiveUserId === 'function' ? getActiveUserId() : null);
    if (activeId && activeId !== 'guest' && typeof patchUserData === 'function') {
      patchUserData(activeId, {
        studentProfile: savedProfile,
        dailyTargetHours: savedProfile.dailyGoalHours
      });
    }
  } catch (e) {
    console.warn('Non-fatal patchUserData warning while saving profile:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-student-profile-updated', {
      detail: savedProfile
    }));
  }

  return { success: true, profile: savedProfile };
}

/**
 * Pulls Total Study Hours, Current Streak, and Mock Accuracy % from localStorage / live state
 * for the Student ID Card preview quick-stats strip.
 */
export function getStudentQuickStats({ subjects = [], streakData = null } = {}) {
  const subjectsHours = Array.isArray(subjects)
    ? subjects.reduce((acc, s) => acc + (Number(s?.completedHours) || 0), 0)
    : 0;
  const weeklyHours = Number(streakData?.weeklyVelocityHours || 0);
  const todayHours = Number(streakData?.todayHours || 0);
  const totalStudyHours = Number(Math.max(subjectsHours, weeklyHours, todayHours).toFixed(1));
  const currentStreak = Math.max(0, Number(streakData?.streakCount || 0));

  let mockAccuracyPct = 0;
  let totalMocks = 0;

  if (typeof localStorage !== 'undefined') {
    try {
      const rawMocks = localStorage.getItem(MOCK_TESTS_STORAGE_KEY);
      if (rawMocks) {
        const mocks = JSON.parse(rawMocks);
        if (Array.isArray(mocks) && mocks.length > 0) {
          totalMocks = mocks.length;
          const sumAcc = mocks.reduce((acc, m) => acc + (Number(m?.accuracyPct) || 0), 0);
          mockAccuracyPct = Number((sumAcc / mocks.length).toFixed(1));
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    totalStudyHours,
    currentStreak,
    mockAccuracyPct,
    totalMocks
  };
}

if (typeof window !== 'undefined') {
  window.StudyProfile = {
    STUDENT_PROFILE_KEY,
    TARGET_EXAM_PRESETS,
    isUserAuthenticated,
    getProfileAccessState,
    applyProfileDemoMode,
    sanitizeUsername,
    validateUsername,
    formatHandle,
    getUsernameMonogram,
    resolveTargetExamDisplay,
    getStudentProfile,
    saveStudentProfile,
    getStudentQuickStats
  };
}

export default {
  STUDENT_PROFILE_KEY,
  TARGET_EXAM_PRESETS,
  USERNAME_REGEX,
  isUserAuthenticated,
  getProfileAccessState,
  applyProfileDemoMode,
  sanitizeUsername,
  validateUsername,
  formatHandle,
  getUsernameMonogram,
  resolveTargetExamDisplay,
  getStudentProfile,
  saveStudentProfile,
  getStudentQuickStats
};

