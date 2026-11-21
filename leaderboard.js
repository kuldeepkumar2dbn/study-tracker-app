/**
 * Real-Time Student Leaderboard Engine (leaderboard.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Uses TELEMETRY_URL from admin-config.js to synchronize and fetch
 * Top 100 Overall and Top 100 Subject-Wise student rankings in real time.
 */

import { TELEMETRY_URL, isTelemetryConfigured, getLoggedInUserProfile } from './admin-config.js';
import { sanitizeText, stripHtmlTags, getOrCreateUserSecret } from './security-privacy.js';
import { isUserAuthenticated } from './auth-guard.js';

export { TELEMETRY_URL, sanitizeText, getOrCreateUserSecret, isUserAuthenticated };

/**
 * Determines whether the caller is permitted to push entries to the public Leaderboard.
 * Syncing is permitted whenever optedIn === true (even if a student hasn't opened #view-profile yet,
 * their default leaderboard profile is auto-initialized so their logged hours push to the shared sheet).
 * Demo sandbox sessions (isDemo === true) remain blocked to prevent test data pollution.
 *
 * @param {Object} [userData={}]
 * @param {Object} [options={}]
 * @returns {boolean}
 */
export function canSyncToLeaderboard(userData = {}, options = {}) {
  if (options?.isAuthenticated === false || userData?.isGuest === true || options?.isGuest === true) {
    return false;
  }

  const candidateProfile = options?.userProfile !== undefined
    ? options.userProfile
    : (userData?.userProfile !== undefined
      ? userData.userProfile
      : ((userData?.sub || userData?.email) ? userData : undefined));

  if (candidateProfile && (candidateProfile.isDemo === true || candidateProfile.sub === 'demo_sandbox_user')) {
    return false;
  }
  if (userData?.isDemo === true || options?.isDemo === true) {
    return false;
  }

  const candidateId = String(options?.studentId || options?.userId || userData?.studentId || userData?.userId || '').trim();
  if (candidateId === 'demo_sandbox_user' || candidateId === 'guest') {
    return false;
  }

  // Allow syncing whenever optedIn is true (or defaulted to true)
  const optedIn = options?.optedIn !== undefined
    ? Boolean(options.optedIn)
    : (userData?.optedIn !== undefined ? Boolean(userData.optedIn) : true);

  if (!optedIn) {
    return false;
  }

  // Allow syncing if explicit studentId/userId is present or user is authenticated
  if (candidateId) {
    return true;
  }

  if (typeof isUserAuthenticated === 'function' && isUserAuthenticated(candidateProfile)) {
    return true;
  }

  return false;
}

export const LEADERBOARD_SETTINGS_KEY = 'studytracker_leaderboard_settings';
export const LEADERBOARD_CACHE_KEY = 'studytracker_leaderboard_cache';
export const LEADERBOARD_SELF_KEY = 'studytracker_leaderboard_self';
export const STUDENT_PROFILE_KEY = 'studytracker_student_profile';
export const LIVE_HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (180,000ms)

/**
 * Reads persisted student profile (username, targetExam, showOnLeaderboard) from localStorage.
 * When autoInit is true, creates a clean default profile if none exists yet.
 */
export function getStoredStudentProfile(autoInit = false, userProfile = null) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }

  if (autoInit) {
    const studentId = getStudentId(userProfile);
    const profile = userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);
    const cleanHandle = profile?.email
      ? `@${String(profile.email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15)}`
      : (profile?.name ? `@${String(profile.name).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15)}` : `@scholar_${studentId.slice(-4)}`);
    const initial = {
      userId: studentId,
      studentId: studentId,
      username: cleanHandle,
      displayName: cleanHandle,
      showOnLeaderboard: true,
      optedIn: true,
      targetExam: 'General Studies'
    };
    try {
      localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify(initial));
    } catch {}
    return initial;
  }

  return null;
}

export const COMMON_LEADERBOARD_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Computer Science',
  'Signals & Systems',
  'Reasoning',
  'General Studies'
];

/**
 * Computes a deterministic integer hash string for persistent user identification.
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates or retrieves a persistent, unique student ID for leaderboard attribution.
 * Prefers signed-in Google email hash or sub, or persistent usr_ UUID in localStorage
 * so two different devices/accounts NEVER collide on the same row.
 */
export function getStudentId(userProfile = null) {
  const profile = userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);

  if (profile?.email && profile.email !== 'demo@studyflow.local') {
    const cleanEmail = String(profile.email).trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 10);
    const emailHash = hashString(cleanEmail);
    const id = `usr_${emailPrefix}_${emailHash}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('study_user_id', id);
        localStorage.setItem('studytracker_user_id', id);
      } catch {}
    }
    return id;
  }

  if (profile?.sub && profile.sub !== 'demo_sandbox_user') {
    const subHash = hashString(String(profile.sub).trim());
    const id = `usr_sub_${subHash}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('study_user_id', id);
        localStorage.setItem('studytracker_user_id', id);
      } catch {}
    }
    return id;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      let storedId = localStorage.getItem('studytracker_user_id') || localStorage.getItem('study_user_id') || localStorage.getItem('study_visitor_id');
      if (storedId && storedId !== 'usr_anonymous' && storedId !== 'guest' && storedId !== 'demo_sandbox_user') {
        return storedId;
      }
      const randomPart = Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 6);
      const newId = `usr_${Date.now().toString(36)}_${randomPart}`;
      localStorage.setItem('studytracker_user_id', newId);
      localStorage.setItem('study_user_id', newId);
      localStorage.setItem('study_visitor_id', newId);
      return newId;
    } catch {
      // ignore
    }
  }

  return 'usr_' + Math.random().toString(36).substring(2, 10);
}

export const getUserId = getStudentId;

/**
 * Reads persisted leaderboard display name, opt-in privacy toggle, and auto-refresh setting.
 * Auto-initializes student profile if not present so optedIn === true by default.
 */
export function getLeaderboardSettings(userProfile = null) {
  const profile = userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);
  const studentProfile = getStoredStudentProfile(false, profile);
  const profileHandle = studentProfile?.username
    ? `@${String(studentProfile.username).replace(/^@+/, '').trim()}`
    : '';

  const fallbackName = profileHandle ||
    ((profile?.name && String(profile.name).trim())
      ? String(profile.name).trim()
      : (profile?.email ? String(profile.email).split('@')[0] : 'Focused Scholar'));

  const defaults = {
    displayName: fallbackName,
    optedIn: studentProfile?.showOnLeaderboard !== undefined ? Boolean(studentProfile.showOnLeaderboard) : true,
    liveAutoRefresh: true
  };

  if (typeof localStorage === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(LEADERBOARD_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      displayName: (typeof parsed.displayName === 'string' && parsed.displayName.trim())
        ? parsed.displayName.trim()
        : (profileHandle || defaults.displayName),
      optedIn: parsed.optedIn !== undefined ? Boolean(parsed.optedIn) : defaults.optedIn,
      liveAutoRefresh: parsed.liveAutoRefresh !== undefined ? Boolean(parsed.liveAutoRefresh) : defaults.liveAutoRefresh
    };
  } catch {
    return defaults;
  }
}

/**
 * Saves leaderboard display name / privacy / live-refresh settings.
 */
export function saveLeaderboardSettings(updates = {}, userProfile = null) {
  const current = getLeaderboardSettings(userProfile);
  const next = {
    ...current,
    ...updates
  };
  if (typeof next.displayName === 'string') {
    next.displayName = next.displayName.trim() || current.displayName || 'Focused Scholar';
  }
  next.optedIn = Boolean(next.optedIn);
  next.liveAutoRefresh = Boolean(next.liveAutoRefresh);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEADERBOARD_SETTINGS_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Could not persist leaderboard settings:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-leaderboard-settings-changed', {
      detail: next
    }));
  }

  return next;
}

/**
 * Populates the Subject Selector dropdown from data.subjectsList / subjects + common subjects.
 */
export function getAvailableSubjects(dataOrSubjects = null) {
  const result = [];
  const seen = new Set();

  const pushUnique = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  };

  // Support data.subjectsList, data.subjects, or raw array of strings/objects
  if (Array.isArray(dataOrSubjects)) {
    dataOrSubjects.forEach((item) => {
      pushUnique(typeof item === 'string' ? item : item?.name || item?.title);
    });
  } else if (dataOrSubjects && typeof dataOrSubjects === 'object') {
    const list = dataOrSubjects.subjectsList || dataOrSubjects.subjects || [];
    if (Array.isArray(list)) {
      list.forEach((item) => {
        pushUnique(typeof item === 'string' ? item : item?.name || item?.title);
      });
    }
  }

  // Append common subjects
  COMMON_LEADERBOARD_SUBJECTS.forEach(pushUnique);

  return result;
}

/**
 * Computes normalized subject-to-hours map from user's subjects list or explicit map.
 */
function extractSubjectHoursMap(userData = {}) {
  const map = {};

  if (userData?.subjectHours && typeof userData.subjectHours === 'object') {
    Object.entries(userData.subjectHours).forEach(([name, hrs]) => {
      const clean = String(name || '').trim();
      if (clean) {
        map[clean] = Math.max(0, Number(Number(hrs || 0).toFixed(1)));
      }
    });
  }

  const subjectsArr = Array.isArray(userData?.subjectsList)
    ? userData.subjectsList
    : (Array.isArray(userData?.subjects) ? userData.subjects : []);

  subjectsArr.forEach((s) => {
    if (!s || typeof s !== 'object') return;
    const name = String(s.name || s.title || '').trim();
    if (!name) return;
    const hrs = Number(s.completedHours ?? s.hours ?? s.studiedHours ?? 0);
    if (!Number.isNaN(hrs)) {
      map[name] = Math.max(map[name] || 0, Number(hrs.toFixed(1)));
    }
  });

  return map;
}

/**
 * Builds the canonical student payload for leaderboard synchronization.
 */
export function buildStudentLeaderboardPayload(userData = {}, options = {}) {
  const profile = options.userProfile || userData.userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);
  const settings = getLeaderboardSettings(profile);
  const studentProfile = options.studentProfile || userData.studentProfile || getStoredStudentProfile();

  const rawUsername = options.username || userData.username || studentProfile?.username || '';
  const cleanUsername = stripHtmlTags(String(rawUsername || '')).trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
  const profileHandle = cleanUsername ? `@${cleanUsername}` : '';
  const targetExam = stripHtmlTags(String(
    options.targetExam ||
    userData.targetExam ||
    studentProfile?.resolvedTargetExam ||
    studentProfile?.targetExam ||
    ''
  )).trim();

  const studentId = options.studentId || userData.studentId || getStudentId(profile);
  const userSecret = options.userSecret || userData.userSecret || getOrCreateUserSecret();
  const displayName = stripHtmlTags(
    (options.displayName !== undefined && String(options.displayName).trim())
      ? String(options.displayName).trim()
      : ((userData.displayName !== undefined && String(userData.displayName).trim())
        ? String(userData.displayName).trim()
        : (profileHandle || settings.displayName))
  );
  const optedIn = options.optedIn !== undefined
    ? Boolean(options.optedIn)
    : (userData.optedIn !== undefined
      ? Boolean(userData.optedIn)
      : (studentProfile?.showOnLeaderboard !== undefined ? Boolean(studentProfile.showOnLeaderboard) : settings.optedIn));

  const subjectHours = extractSubjectHoursMap(userData);
  const subjectsTotal = Object.values(subjectHours).reduce((acc, h) => acc + (Number(h) || 0), 0);

  const streakObj = userData.streakData || {};
  const streak = Math.max(0, Number(
    options.streak ?? userData.streak ?? streakObj.streakCount ?? 0
  ) || 0);

  const todayHours = Math.max(0, Number(
    options.todayHours ?? userData.todayLoggedHours ?? userData.todayHours ?? streakObj.todayHours ?? 0
  ) || 0);

  let weeklyHours = Number(
    options.weeklyHours ?? userData.weeklyHours ?? userData.weeklyVelocityHours ?? streakObj.weeklyVelocityHours
  );
  if (Number.isNaN(weeklyHours) || weeklyHours < todayHours) {
    // Derive from dailyActivity over last 7 days if available
    if (userData.dailyActivity && typeof userData.dailyActivity === 'object') {
      const now = new Date();
      let sumMins = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        sumMins += Number(userData.dailyActivity[key] || 0);
      }
      weeklyHours = Math.max(todayHours, Number((sumMins / 60).toFixed(1)));
    } else {
      weeklyHours = todayHours;
    }
  }
  weeklyHours = Number(Math.max(0, weeklyHours).toFixed(1));

  // Determine live studying state and active subject
  let timerRunning = false;
  let timerSubject = '';
  if (typeof localStorage !== 'undefined') {
    try {
      timerRunning = localStorage.getItem('is_timer_running') === 'true';
      timerSubject = localStorage.getItem('focus_timer_subject') || '';
    } catch {
      // ignore
    }
  }

  const isLiveNow = options.isLiveNow !== undefined
    ? Boolean(options.isLiveNow)
    : (userData.isLiveNow !== undefined ? Boolean(userData.isLiveNow) : timerRunning);

  const firstSubjectName = Object.keys(subjectHours)[0] || COMMON_LEADERBOARD_SUBJECTS[0];
  const activeSubject = stripHtmlTags(String(
    options.activeSubject ||
    userData.activeSubject ||
    timerSubject ||
    firstSubjectName
  )).trim() || COMMON_LEADERBOARD_SUBJECTS[0];

  // Ensure activeSubject has at least today's hours reflected if not already present
  if (activeSubject && subjectHours[activeSubject] === undefined) {
    subjectHours[activeSubject] = Number(todayHours.toFixed(1));
  }

  return {
    type: 'leaderboard_sync',
    action: 'leaderboard_sync',
    userId: studentId,
    studentId,
    userSecret,
    username: cleanUsername || undefined,
    displayName,
    targetExam: targetExam || undefined,
    optedIn,
    weeklyHours,
    totalHours: Number(Math.max(weeklyHours, subjectsTotal).toFixed(1)),
    todayHours: Number(todayHours.toFixed(1)),
    streak,
    streakDays: streak,
    activeSubject,
    lastSubject: activeSubject,
    isLiveNow,
    subjectHours,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Reads the locally saved self leaderboard entry.
 */
export function getLocalSelfEntry() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEADERBOARD_SELF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Syncs the current student's study hours, streak, subject breakdown, and live status
 * to the Leaderboard endpoint (TELEMETRY_URL).
 *
 * @param {string} [endpoint=TELEMETRY_URL]
 * @param {Object} [userData={}]
 * @param {Object} [options={}] - e.g. { activeSubject, isLiveNow, displayName, optedIn }
 * @returns {Promise<{success: boolean, payload: Object, syncedAt: string, skipped?: boolean}>}
 */
export async function syncStudentToLeaderboard(endpoint = TELEMETRY_URL, userData = {}, options = {}) {
  // Prevent guest / unauthenticated sessions from pushing entries to the public Leaderboard sheet
  if (!canSyncToLeaderboard(userData, options)) {
    return {
      success: false,
      blocked: true,
      skipped: true,
      reason: 'auth_required',
      error: 'Sign in with Google to sync your study hours to the public Leaderboard.'
    };
  }

  const targetUrl = endpoint || TELEMETRY_URL;
  const payload = buildStudentLeaderboardPayload(userData, options);

  // Persist local self state so rankings update immediately on screen
  if (typeof localStorage !== 'undefined') {
    try {
      if (payload.optedIn) {
        localStorage.setItem(LEADERBOARD_SELF_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(LEADERBOARD_SELF_KEY);
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-leaderboard-synced', {
      detail: { payload, syncedAt: payload.updatedAt }
    }));
  }

  if (!isTelemetryConfigured(targetUrl) || typeof fetch === 'undefined') {
    return {
      success: true,
      localOnly: true,
      payload,
      syncedAt: payload.updatedAt
    };
  }

  // Dispatch POST to Google Apps Script Web App
  try {
    // Using text/plain avoids CORS preflight OPTIONS on Google Apps Script while preserving JSON body
    await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    return {
      success: true,
      payload,
      syncedAt: payload.updatedAt
    };
  } catch {
    // Fallback to silent no-cors POST if CORS headers are restricted
    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      return {
        success: true,
        noCorsFallback: true,
        payload,
        syncedAt: payload.updatedAt
      };
    } catch (err) {
      console.warn('Leaderboard background sync failed silently:', err);
      return {
        success: false,
        payload,
        syncedAt: payload.updatedAt,
        error: err?.message || 'Network error'
      };
    }
  }
}

/**
 * Normalizes a raw student row returned by StudyTracker_Admin_DB (Google Apps Script) or cache.
 * Strictly zero fake/mock/sample students are ever generated.
 */
function normalizeLeaderboardEntry(raw, mode = 'overall', subject = '') {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.optedIn === false) return null;

  const studentId = String(raw.userId || raw.studentId || raw.id || raw.email || raw.displayName || '').trim();
  if (!studentId) return null;

  const rawUsername = raw.username ? stripHtmlTags(String(raw.username)).trim().replace(/^@+/, '') : '';
  const displayName = stripHtmlTags(String(
    raw.displayName || (rawUsername ? `@${rawUsername}` : '') || raw.name || 'Student'
  )).trim() || 'Student';
  const targetExam = stripHtmlTags(String(raw.targetExam || raw.resolvedTargetExam || '')).trim();
  const subjectHours = (raw.subjectHours && typeof raw.subjectHours === 'object') ? raw.subjectHours : {};

  let hours = 0;
  if (mode === 'subject' && subject) {
    const targetLower = subject.trim().toLowerCase();
    // Exact or case-insensitive / partial match in subjectHours
    let matchedHrs = null;
    for (const [k, v] of Object.entries(subjectHours)) {
      const kLower = k.trim().toLowerCase();
      if (kLower === targetLower || kLower.includes(targetLower) || targetLower.includes(kLower)) {
        matchedHrs = Number(v) || 0;
        break;
      }
    }
    if (matchedHrs !== null) {
      hours = matchedHrs;
    } else if (raw.subject && String(raw.subject).trim().toLowerCase() === targetLower && raw.hours !== undefined) {
      hours = Number(raw.hours) || 0;
    } else if (raw.activeSubject && String(raw.activeSubject).trim().toLowerCase().includes(targetLower)) {
      hours = Number(raw.hours ?? raw.weeklyHours ?? 0) || 0;
    } else {
      hours = 0;
    }
  } else {
    hours = Number(raw.weeklyHours ?? raw.hours ?? raw.totalHours ?? 0) || 0;
  }

  const streak = Math.max(0, Number(raw.streakDays ?? raw.streak ?? raw.streakCount ?? 0) || 0);
  const activeSubject = stripHtmlTags(String(raw.activeSubject || raw.currentSubject || raw.lastSubject || subject || 'General Studies')).trim() || 'General Studies';

  // Check if updated recently (within last 45 mins) when considering isLiveNow
  let isLiveNow = Boolean(raw.isLiveNow);
  if (isLiveNow && raw.updatedAt) {
    const ageMs = Date.now() - new Date(raw.updatedAt).getTime();
    if (!Number.isNaN(ageMs) && ageMs > 90 * 60 * 1000) {
      isLiveNow = false;
    }
  }

  return {
    userId: studentId,
    studentId,
    username: rawUsername || (displayName.startsWith('@') ? displayName.slice(1) : ''),
    displayName,
    targetExam,
    hours: Number(Math.max(0, hours).toFixed(1)),
    weeklyHours: Number(Math.max(0, Number(raw.weeklyHours ?? raw.hours ?? 0) || 0).toFixed(1)),
    totalHours: Number(Math.max(0, Number(raw.totalHours ?? raw.weeklyHours ?? raw.hours ?? 0) || 0).toFixed(1)),
    streak,
    streakDays: streak,
    activeSubject,
    lastSubject: String(raw.lastSubject || activeSubject).trim(),
    isLiveNow,
    subjectHours,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * Updates or dispatches sync diagnostics for #lb-sync-diagnostic-badge.
 * - 'syncing' / 'loading': Pulsing amber dot, "Syncing Sheet..."
 * - 'success': Green dot, "🟢 Sheet: [X] students • [HH:MM:SS]"
 * - 'error': Subtle rose/red interactive badge, "🔴 Sync Error: [message]  Retry ↻"
 *
 * Supports both signatures:
 * - updateLeaderboardDiagnosticBadge(status, { count, timestamp, message, shortReason, errorMsg, title })
 * - updateLeaderboardDiagnosticBadge({ status, count, timestamp, message, shortReason, errorMsg, title })
 *
 * @param {'syncing'|'loading'|'success'|'error'|Object} statusOrOptions
 * @param {Object} [options={}]
 * @returns {{status: string, count: number, timestamp: string, message: string, title: string}}
 */
export function updateLeaderboardDiagnosticBadge(statusOrOptions, options = {}) {
  let status = 'idle';
  let count = 0;
  let timestamp = '';
  let message = '';
  let shortReason = '';
  let errorMsg = '';
  let title = '';

  if (typeof statusOrOptions === 'object' && statusOrOptions !== null) {
    status = statusOrOptions.status || 'idle';
    count = statusOrOptions.count !== undefined ? statusOrOptions.count : 0;
    timestamp = statusOrOptions.timestamp || '';
    message = statusOrOptions.message || '';
    shortReason = statusOrOptions.shortReason || '';
    errorMsg = statusOrOptions.errorMsg || '';
    title = statusOrOptions.title || '';
  } else {
    status = statusOrOptions || 'idle';
    count = options.count !== undefined ? options.count : 0;
    timestamp = options.timestamp || '';
    message = options.message || '';
    shortReason = options.shortReason || '';
    errorMsg = options.errorMsg || '';
    title = options.title || '';
  }

  const now = new Date();
  const timeStr = timestamp || [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');

  let textContent = message;
  let fullTitle = title;
  let displayHtml = '';
  const isSyncingOrLoading = status === 'syncing' || status === 'loading';

  if (isSyncingOrLoading) {
    textContent = 'Syncing Sheet...';
    fullTitle = fullTitle || 'Fetching real-time rankings from Google Apps Script...';
    displayHtml = '<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span><span>Syncing Sheet...</span>';
  } else if (status === 'success') {
    const studentsLabel = `${count} student${count === 1 ? '' : 's'}`;
    textContent = `🟢 Sheet: ${studentsLabel} • ${timeStr}`;
    fullTitle = fullTitle || `Successfully fetched ${count} student rankings from Google Sheets at ${timeStr}`;
    displayHtml = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span><span>Sheet: ${studentsLabel} • ${timeStr}</span>`;
  } else if (status === 'error') {
    const rawErr = shortReason || errorMsg || (message ? message.replace(/^🔴\s*Sync Error:\s*/, '') : '') || 'Network error';
    const cleanErr = rawErr.replace(/\s*Retry\s*↻.*$/, '').trim();
    textContent = `🔴 Sync Error: ${cleanErr}  Retry ↻`;
    fullTitle = fullTitle || `Sync Error: ${cleanErr}. Click or press Enter/Space to retry.`;
    displayHtml = `<span class="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0"></span><span class="text-rose-500 font-semibold truncate">Sync Error: ${cleanErr}</span><span class="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors shrink-0">Retry ↻</span>`;
  }

  if (typeof document !== 'undefined') {
    const badge = document.getElementById('lb-sync-diagnostic-badge');
    if (badge) {
      badge.innerHTML = displayHtml;
      badge.setAttribute('title', fullTitle);
      badge.setAttribute('data-status', status);
      badge.setAttribute('data-count', String(count));

      if (status === 'error') {
        if (badge.classList) {
          badge.classList.remove('cursor-default');
          badge.classList.add('cursor-pointer', 'hover:bg-rose-500/20', 'active:scale-95', 'transition-all');
        }
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        const ariaLabel = `Leaderboard sync error: ${textContent.replace(/^🔴\s*/, '')}. Click to retry`;
        badge.setAttribute('aria-label', ariaLabel);

        const triggerRetry = (evt) => {
          if (evt) {
            if (typeof evt.preventDefault === 'function') evt.preventDefault();
            if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
          }
          // Immediately transition badge to "loading" ("Syncing Sheet...")
          updateLeaderboardDiagnosticBadge('loading', { message: 'Syncing Sheet...' });

          // Re-trigger Leaderboard sync & fetch
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('studyflow-leaderboard-retry-requested'));
            if (typeof window.refreshLeaderboardView === 'function') {
              window.refreshLeaderboardView();
            } else if (typeof window.fetchTop100Leaderboard === 'function') {
              window.fetchTop100Leaderboard();
            } else if (typeof fetchLeaderboard === 'function') {
              fetchLeaderboard(TELEMETRY_URL, { mode: 'overall' }).catch(() => {});
            }
          }
        };

        badge.onclick = triggerRetry;
        badge.onkeydown = (e) => {
          if (e && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) {
            triggerRetry(e);
          }
        };
      } else if (isSyncingOrLoading || status === 'success') {
        badge.onclick = null;
        badge.onkeydown = null;
        badge.removeAttribute('role');
        badge.removeAttribute('tabindex');
        badge.removeAttribute('aria-label');
        if (badge.classList) {
          badge.classList.remove('cursor-pointer', 'hover:bg-rose-500/20', 'active:scale-95');
          badge.classList.add('cursor-default');
        }
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('studyflow-leaderboard-diagnostic-updated', {
      detail: {
        status,
        count,
        timestamp: timeStr,
        message: textContent,
        title: fullTitle
      }
    }));
  }

  return { status, count, timestamp: timeStr, message: textContent, title: fullTitle };
}

/**
 * Fetches Top 100 Overall or Subject-Wise student rankings from TELEMETRY_URL,
 * merges the current user's live local state if opted in, and returns sorted rankings.
 *
 * @param {string} [endpoint=TELEMETRY_URL]
 * @param {Object} [options={}]
 * @param {'overall'|'subject'} [options.mode='overall']
 * @param {string} [options.subject='']
 * @param {number} [options.limit=100]
 * @param {Object} [options.currentUserData=null]
 * @returns {Promise<{rankings: Array, currentUserRank: Object|null, totalParticipants: number, source: string, fetchedAt: string, diagnostic: Object|null}>}
 */
export async function fetchLeaderboard(
  endpoint = TELEMETRY_URL,
  { mode = 'overall', subject = '', limit = 100, currentUserData = null } = {}
) {
  const targetUrl = endpoint || TELEMETRY_URL;
  const normalizedMode = mode === 'subject' ? 'subject' : 'overall';
  const cleanSubject = normalizedMode === 'subject' ? String(subject || '').trim() : '';
  const maxEntries = Math.max(1, Math.min(100, Number(limit) || 100));

  let rawEntries = null;
  let source = 'live';
  let diagnostic = null;

  // 1. Attempt live GET fetch from TELEMETRY_URL
  if (isTelemetryConfigured(targetUrl) && typeof fetch !== 'undefined') {
    // Show pulsing amber dot before fetching
    diagnostic = updateLeaderboardDiagnosticBadge('syncing', { message: 'Syncing Sheet...' });

    try {
      const separator = targetUrl.includes('?') ? '&' : '?';
      const timestamp = Date.now();
      const queryUrl = `${targetUrl}${separator}action=leaderboard&type=leaderboard&mode=${encodeURIComponent(normalizedMode)}&subject=${encodeURIComponent(cleanSubject)}&limit=${maxEntries}&t=${timestamp}`;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

      const res = await fetch(queryUrl, {
        method: 'GET',
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res && res.ok) {
        const text = await res.text();
        const isHtml = /<html\b|<!DOCTYPE\b|<body\b/i.test(text);

        if (isHtml) {
          const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
          const snippet = titleMatch ? titleMatch[1].trim() : 'Google HTML permission error';
          diagnostic = updateLeaderboardDiagnosticBadge('error', {
            shortReason: 'HTML permission error',
            message: '🔴 Sync Error: HTML permission error',
            title: `Google Apps Script returned an HTML permission error instead of JSON: ${snippet}`
          });
        } else {
          try {
            const parsed = JSON.parse(text);
            let candidate = null;

            if (Array.isArray(parsed)) {
              candidate = parsed;
            } else if (parsed && typeof parsed === 'object') {
              if (normalizedMode === 'subject' && cleanSubject) {
                if (Array.isArray(parsed.bySubject?.[cleanSubject])) {
                  candidate = parsed.bySubject[cleanSubject];
                } else if (Array.isArray(parsed.data?.bySubject?.[cleanSubject])) {
                  candidate = parsed.data.bySubject[cleanSubject];
                }
              }
              if (!candidate) {
                candidate = Array.isArray(parsed.overallTop100)
                  ? parsed.overallTop100
                  : (Array.isArray(parsed.data?.overallTop100)
                    ? parsed.data.overallTop100
                    : (Array.isArray(parsed.rankings)
                      ? parsed.rankings
                      : (Array.isArray(parsed.leaderboard)
                        ? parsed.leaderboard
                        : (Array.isArray(parsed.data)
                          ? parsed.data
                          : null))));
              }
            }

            if (Array.isArray(candidate)) {
              rawEntries = candidate;
              source = 'live';

              const count = candidate.length;
              const now = new Date();
              const timeStr = [
                String(now.getHours()).padStart(2, '0'),
                String(now.getMinutes()).padStart(2, '0'),
                String(now.getSeconds()).padStart(2, '0')
              ].join(':');

              diagnostic = updateLeaderboardDiagnosticBadge('success', {
                count,
                timestamp: timeStr,
                message: `🟢 Sheet: ${count} student${count === 1 ? '' : 's'} • ${timeStr}`,
                title: `Successfully fetched ${count} student rankings from Google Sheets at ${timeStr}`
              });

              // Cache live results
              if (typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({
                    mode: normalizedMode,
                    subject: cleanSubject,
                    entries: rawEntries,
                    fetchedAt: new Date().toISOString()
                  }));
                } catch {
                  // ignore
                }
              }
            } else {
              diagnostic = updateLeaderboardDiagnosticBadge('error', {
                shortReason: 'Unexpected schema',
                message: '🔴 Sync Error: Unexpected schema',
                title: 'Google Apps Script JSON response did not contain an array of student rankings'
              });
            }
          } catch (jsonErr) {
            diagnostic = updateLeaderboardDiagnosticBadge('error', {
              shortReason: 'Invalid JSON',
              message: '🔴 Sync Error: Invalid JSON',
              title: `Failed to parse response as JSON: ${jsonErr.message || ''} (${text.slice(0, 100)})`
            });
          }
        }
      } else {
        const errReason = `HTTP ${res?.status || 'Unknown'}`;
        diagnostic = updateLeaderboardDiagnosticBadge('error', {
          shortReason: errReason,
          message: `🔴 Sync Error: ${errReason}`,
          title: `Google Apps Script returned HTTP status ${res?.status || ''} ${res?.statusText || ''}`.trim()
        });
      }
    } catch (fetchErr) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const isTimeout = fetchErr?.name === 'AbortError';
      const errReason = isOffline ? 'Offline' : (isTimeout ? 'Timeout' : (fetchErr?.message || 'Network error'));
      diagnostic = updateLeaderboardDiagnosticBadge('error', {
        shortReason: errReason,
        message: `🔴 Sync Error: ${errReason}`,
        title: `Fetch failed connecting to Google Apps Script: ${fetchErr?.message || errReason}`
      });
    }
  } else if (!isTelemetryConfigured(targetUrl)) {
    diagnostic = updateLeaderboardDiagnosticBadge('error', {
      shortReason: 'URL not configured',
      message: '🔴 Sync Error: URL not configured',
      title: 'TELEMETRY_URL is not configured in admin-config.js'
    });
  }

  // 2. Fallback to cached live response if matching mode/subject
  if (!rawEntries && typeof localStorage !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.mode === normalizedMode && cached.subject === cleanSubject && Array.isArray(cached.entries) && cached.entries.length > 0) {
          rawEntries = cached.entries;
          source = 'cached';
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Strictly zero fake/mock fallback rows: if StudyTracker_Admin_DB Leaderboard tab is empty, display only real rows
  if (!rawEntries) {
    rawEntries = [];
    source = 'live';
  }

  // 4. Normalize and deduplicate by studentId/userId (ignoring any stale cached preview rows)
  const byId = new Map();
  rawEntries.forEach((row) => {
    if (row?.isCohortPreview || String(row?.studentId || row?.userId || '').startsWith('cohort_')) return;
    const normalized = normalizeLeaderboardEntry(row, normalizedMode, cleanSubject);
    if (normalized) {
      // In subject mode, only include entries with >0 hours for that subject
      if (normalizedMode === 'overall' || normalized.hours > 0) {
        byId.set(normalized.studentId, normalized);
      }
    }
  });

  // 5. Merge current logged-in student's real live entry ONLY if Google-authenticated, opted in, AND has real activity
  const settings = getLeaderboardSettings(currentUserData?.userProfile);
  const currentStudentId = currentUserData?.userId || currentUserData?.studentId || getStudentId(currentUserData?.userProfile);
  const canMergeSelf = canSyncToLeaderboard(currentUserData || {}, {});
  const effectiveOptIn = canMergeSelf && (
    currentUserData?.optedIn !== undefined
      ? Boolean(currentUserData.optedIn)
      : settings.optedIn
  );

  if (effectiveOptIn) {
    const selfRaw = currentUserData
      ? buildStudentLeaderboardPayload(currentUserData)
      : getLocalSelfEntry();

    if (selfRaw) {
      const normalizedSelf = normalizeLeaderboardEntry(selfRaw, normalizedMode, cleanSubject);
      const hasRealActivity = normalizedSelf && (
        normalizedSelf.hours > 0 ||
        normalizedSelf.isLiveNow === true ||
        byId.has(currentStudentId)
      );
      if (hasRealActivity) {
        const existing = byId.get(currentStudentId);
        byId.set(currentStudentId, {
          ...(existing || {}),
          ...normalizedSelf,
          userId: currentStudentId,
          studentId: currentStudentId,
          displayName: normalizedSelf.displayName || settings.displayName,
          isCurrentUser: true
        });
      }
    }
  } else {
    // Student opted out: remove them from displayed rankings
    byId.delete(currentStudentId);
  }

  // 6. Sort descending by hours, then streak, then displayName
  const sorted = Array.from(byId.values()).sort((a, b) => {
    if (b.hours !== a.hours) return b.hours - a.hours;
    if (b.streak !== a.streak) return b.streak - a.streak;
    return a.displayName.localeCompare(b.displayName);
  });

  const totalParticipants = sorted.length;

  // Assign 1-based rank and mark current user
  let currentUserRank = null;
  const fullRanked = sorted.map((entry, idx) => {
    const isMe = entry.studentId === currentStudentId || entry.userId === currentStudentId;
    const rankedEntry = {
      ...entry,
      rank: idx + 1,
      isCurrentUser: isMe
    };
    if (isMe) {
      currentUserRank = rankedEntry;
    }
    return rankedEntry;
  });

  const rankings = fullRanked.slice(0, maxEntries);

  return {
    rankings,
    currentUserRank,
    totalParticipants,
    mode: normalizedMode,
    subject: cleanSubject,
    source,
    fetchedAt: new Date().toISOString(),
    diagnostic
  };
}

export const fetchTop100Leaderboard = fetchLeaderboard;

/**
 * Counts how many leaderboard entries are actively studying live right now.
 */
export function getLiveStudyingCount(rankings = []) {
  if (!Array.isArray(rankings)) return 0;
  return rankings.filter((entry) => entry && entry.isLiveNow === true).length;
}

/**
 * Filters leaderboard entries for the "Live Study Room" presence filter bar:
 * - liveOnly: only entries where isLiveNow === true
 * - sameSubjectOnly: only entries whose activeSubject matches currentUserSubject
 * - searchQuery: optional student name / subject / rank substring match
 */
export function filterLeaderboardEntries(
  rankings = [],
  { liveOnly = false, sameSubjectOnly = false, currentUserSubject = '', searchQuery = '' } = {}
) {
  if (!Array.isArray(rankings)) return [];

  const targetSubject = String(currentUserSubject || '').trim().toLowerCase();
  const query = String(searchQuery || '').trim().toLowerCase();

  return rankings.filter((entry) => {
    if (!entry) return false;

    if (liveOnly && entry.isLiveNow !== true) {
      return false;
    }

    if (sameSubjectOnly && targetSubject) {
      const entrySubject = String(entry.activeSubject || '').trim().toLowerCase();
      const matchesSubject =
        entrySubject === targetSubject ||
        entrySubject.includes(targetSubject) ||
        targetSubject.includes(entrySubject);
      if (!matchesSubject) {
        return false;
      }
    }

    if (query) {
      const matchesQuery =
        String(entry.displayName || '').toLowerCase().includes(query) ||
        String(entry.activeSubject || '').toLowerCase().includes(query) ||
        String(entry.rank || '').includes(query);
      if (!matchesQuery) {
        return false;
      }
    }

    return true;
  });
}

// =========================================================================
// 3-Minute Focus Timer Live Presence Heartbeat
// =========================================================================
let _heartbeatTimerId = null;
let _heartbeatEndpoint = TELEMETRY_URL;
let _heartbeatPayloadProvider = null;
let _heartbeatActive = false;

/**
 * Starts the 3-minute live presence heartbeat when the Focus Timer starts or resumes.
 * Immediately syncs the student as `isLiveNow: true` so they appear as
 * `🟢 Studying [Active Subject]` in the Live Study Room, then repeats every 3 minutes.
 *
 * @param {string} [endpoint=TELEMETRY_URL]
 * @param {Function|Object} [getCurrentStatsPayload] - Callback returning current study stats payload (or payload object)
 * @param {number} [intervalMs=LIVE_HEARTBEAT_INTERVAL_MS] - Heartbeat interval (defaults to 3 minutes)
 */
export function startLivePresenceHeartbeat(
  endpoint = TELEMETRY_URL,
  getCurrentStatsPayload = null,
  intervalMs = LIVE_HEARTBEAT_INTERVAL_MS,
  options = {}
) {
  // Clear any existing heartbeat to prevent duplicate intervals
  if (_heartbeatTimerId !== null) {
    clearInterval(_heartbeatTimerId);
    _heartbeatTimerId = null;
  }

  // Block guest / unauthenticated sessions from pushing live presence pings to public Leaderboard
  const initialStats = typeof getCurrentStatsPayload === 'function'
    ? getCurrentStatsPayload()
    : (getCurrentStatsPayload || {});
  if (!canSyncToLeaderboard(initialStats, options)) {
    _heartbeatActive = false;
    return {
      active: false,
      blocked: true,
      reason: 'auth_required'
    };
  }

  _heartbeatEndpoint = endpoint || TELEMETRY_URL;
  _heartbeatPayloadProvider = getCurrentStatsPayload;
  _heartbeatActive = true;

  const dispatchHeartbeatPing = () => {
    const rawStats = typeof _heartbeatPayloadProvider === 'function'
      ? _heartbeatPayloadProvider()
      : (_heartbeatPayloadProvider || {});
    const safeStats = (rawStats && typeof rawStats === 'object') ? rawStats : {};

    let fallbackSubject = '';
    if (typeof localStorage !== 'undefined') {
      try {
        fallbackSubject = localStorage.getItem('focus_timer_subject') || '';
      } catch {
        // ignore
      }
    }

    const activeSubject = safeStats.activeSubject || fallbackSubject || undefined;

    return syncStudentToLeaderboard(_heartbeatEndpoint, safeStats, {
      isLiveNow: true,
      activeSubject
    });
  };

  // Immediate live presence ping upon starting/resuming Focus Timer
  dispatchHeartbeatPing();

  // Repeat every 3 minutes while timer runs
  const safeInterval = Math.max(1000, Number(intervalMs) || LIVE_HEARTBEAT_INTERVAL_MS);
  _heartbeatTimerId = setInterval(() => {
    dispatchHeartbeatPing();
  }, safeInterval);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-presence-heartbeat', {
      detail: { active: true, intervalMs: safeInterval }
    }));
  }

  return {
    active: true,
    intervalMs: safeInterval
  };
}

/**
 * Stops the 3-minute live presence heartbeat when the Focus Timer pauses or stops.
 * Optionally emits an idle presence update (`isLiveNow: false`) so peers see `Last studied: [Subject]`.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.sendIdlePing=true]
 */
export function stopLivePresenceHeartbeat({ sendIdlePing = true } = {}) {
  const wasActive = _heartbeatActive || _heartbeatTimerId !== null;

  if (_heartbeatTimerId !== null) {
    clearInterval(_heartbeatTimerId);
    _heartbeatTimerId = null;
  }
  _heartbeatActive = false;

  if (sendIdlePing && (wasActive || _heartbeatPayloadProvider)) {
    const rawStats = typeof _heartbeatPayloadProvider === 'function'
      ? _heartbeatPayloadProvider()
      : (_heartbeatPayloadProvider || getLocalSelfEntry() || {});
    const safeStats = (rawStats && typeof rawStats === 'object') ? rawStats : {};

    syncStudentToLeaderboard(_heartbeatEndpoint || TELEMETRY_URL, safeStats, {
      isLiveNow: false,
      activeSubject: safeStats.activeSubject
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-presence-heartbeat', {
      detail: { active: false }
    }));
  }

  return { active: false };
}

/**
 * Returns whether the live presence heartbeat interval is currently active.
 */
export function isLivePresenceHeartbeatRunning() {
  return Boolean(_heartbeatActive && _heartbeatTimerId !== null);
}

// Expose global bindings for vanilla script/console access
/**
 * Renders Top 100 Leaderboard rows using a single DocumentFragment batch DOM update.
 * Off-screen rows benefit from content-visibility: auto, and appending in a single
 * batch eliminates layout recalculations, delivering smooth 60fps scrolling.
 *
 * @param {Array} entries Array of student ranking objects
 * @param {HTMLElement} [container] Target <tbody> element
 * @param {Object} [options]
 * @returns {DocumentFragment|null}
 */
export function renderLeaderboardFragment(entries = [], container = null, options = {}) {
  if (typeof document === 'undefined') {
    return null;
  }

  const fragment = document.createDocumentFragment();
  const currentStudentId = options?.currentStudentId || getStudentId();

  (entries || []).forEach((student) => {
    if (!student) return;
    const isMe = Boolean(student.isCurrentUser || student.studentId === currentStudentId);
    const tr = document.createElement('tr');
    tr.className = 'leaderboard-row transition-colors';
    tr.setAttribute('data-rank', String(student.rank || ''));
    tr.setAttribute('data-current-user', isMe ? 'true' : 'false');
    tr.style.backgroundColor = isMe ? 'var(--bg-sidebar)' : 'transparent';
    tr.style.borderBottom = '1px solid var(--border-glow)';
    if (isMe) {
      tr.style.outline = '2px solid var(--primary)';
      tr.style.outlineOffset = '-2px';
    }

    // Rank (#)
    const tdRank = document.createElement('td');
    tdRank.className = 'py-3.5 px-4 font-mono-numbers font-extrabold text-sm';
    const rankBadge = document.createElement('span');
    rankBadge.className = 'inline-flex items-center justify-center min-w-[34px] px-2 py-0.5 rounded-lg text-xs font-bold';
    rankBadge.style.backgroundColor = isMe ? 'var(--primary)' : 'var(--bg-sidebar)';
    rankBadge.style.color = isMe ? '#FFFFFF' : 'var(--text-main)';
    rankBadge.style.border = '1px solid var(--border-glow)';
    rankBadge.textContent = `#${student.rank}`;
    tdRank.appendChild(rankBadge);
    tr.appendChild(tdRank);

    // Student Name + Badges
    const tdName = document.createElement('td');
    tdName.className = 'py-3.5 px-4';
    const nameWrap = document.createElement('div');
    nameWrap.className = 'flex flex-wrap items-center gap-2';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'font-bold text-sm font-mono-numbers truncate max-w-[200px] sm:max-w-xs';
    nameSpan.style.color = 'var(--text-main)';
    nameSpan.textContent = student.displayName || 'Anonymous Student';
    nameWrap.appendChild(nameSpan);

    if (isMe) {
      const youBadge = document.createElement('span');
      youBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider';
      youBadge.style.backgroundColor = 'var(--primary)';
      youBadge.style.color = '#FFFFFF';
      youBadge.style.border = '1px solid var(--border-glow)';
      youBadge.textContent = 'You';
      nameWrap.appendChild(youBadge);
    }

    if (student.targetExam) {
      const examBadge = document.createElement('span');
      examBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold';
      examBadge.style.backgroundColor = 'var(--bg-card)';
      examBadge.style.border = '1px solid var(--border-glow)';
      examBadge.style.color = 'var(--text-muted)';
      examBadge.textContent = student.targetExam;
      nameWrap.appendChild(examBadge);
    }
    tdName.appendChild(nameWrap);
    tr.appendChild(tdName);

    // Status / Current Subject
    const tdStatus = document.createElement('td');
    tdStatus.className = 'py-3.5 px-4';
    const statusWrap = document.createElement('div');
    statusWrap.className = 'flex items-center gap-2 text-xs font-medium';
    statusWrap.style.color = 'var(--text-muted)';
    if (student.isLiveNow) {
      const liveDot = document.createElement('span');
      liveDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      statusWrap.appendChild(liveDot);
      const liveText = document.createElement('span');
      liveText.className = 'font-bold text-emerald-400';
      liveText.textContent = student.activeSubject ? `Studying ${student.activeSubject}` : 'Studying Now';
      statusWrap.appendChild(liveText);
    } else {
      const subjSpan = document.createElement('span');
      subjSpan.textContent = student.activeSubject || student.targetExam || 'General Studies';
      statusWrap.appendChild(subjSpan);
    }
    tdStatus.appendChild(statusWrap);
    tr.appendChild(tdStatus);

    // Streak
    const tdStreak = document.createElement('td');
    tdStreak.className = 'py-3.5 px-4 text-center font-mono-numbers font-bold text-xs';
    tdStreak.style.color = student.streak > 0 ? 'var(--primary)' : 'var(--text-muted)';
    tdStreak.textContent = student.streak > 0 ? `🔥 ${student.streak}d` : '0d';
    tr.appendChild(tdStreak);

    // Hours Logged
    const tdHours = document.createElement('td');
    tdHours.className = 'py-3.5 px-4 text-right font-mono-numbers font-bold text-sm';
    tdHours.style.color = 'var(--text-main)';
    tdHours.textContent = `${Number(student.studyHours || 0).toFixed(1)}h`;
    tr.appendChild(tdHours);

    fragment.appendChild(tr);
  });

  if (container && typeof container.appendChild === 'function') {
    container.innerHTML = '';
    container.appendChild(fragment);
  }

  return fragment;
}

if (typeof window !== 'undefined') {
  window.syncStudentToLeaderboard = syncStudentToLeaderboard;
  window.fetchLeaderboard = fetchLeaderboard;
  window.fetchTop100Leaderboard = fetchTop100Leaderboard;
  window.updateLeaderboardDiagnosticBadge = updateLeaderboardDiagnosticBadge;
  window.getStudentId = getStudentId;
  window.getUserId = getUserId;
  window.renderLeaderboardFragment = renderLeaderboardFragment;
  window.startLivePresenceHeartbeat = startLivePresenceHeartbeat;
  window.stopLivePresenceHeartbeat = stopLivePresenceHeartbeat;
  window.StudyLeaderboard = {
    TELEMETRY_URL,
    LIVE_HEARTBEAT_INTERVAL_MS,
    COMMON_LEADERBOARD_SUBJECTS,
    canSyncToLeaderboard,
    isUserAuthenticated,
    getStudentId,
    getUserId,
    getLeaderboardSettings,
    saveLeaderboardSettings,
    getAvailableSubjects,
    buildStudentLeaderboardPayload,
    syncStudentToLeaderboard,
    fetchLeaderboard,
    fetchTop100Leaderboard,
    updateLeaderboardDiagnosticBadge,
    getLiveStudyingCount,
    filterLeaderboardEntries,
    renderLeaderboardFragment,
    startLivePresenceHeartbeat,
    stopLivePresenceHeartbeat,
    isLivePresenceHeartbeatRunning
  };
}

export default {
  TELEMETRY_URL,
  LEADERBOARD_SETTINGS_KEY,
  LEADERBOARD_CACHE_KEY,
  LIVE_HEARTBEAT_INTERVAL_MS,
  COMMON_LEADERBOARD_SUBJECTS,
  canSyncToLeaderboard,
  isUserAuthenticated,
  getStudentId,
  getUserId,
  getLeaderboardSettings,
  saveLeaderboardSettings,
  getAvailableSubjects,
  buildStudentLeaderboardPayload,
  syncStudentToLeaderboard,
  fetchLeaderboard,
  fetchTop100Leaderboard,
  updateLeaderboardDiagnosticBadge,
  getLiveStudyingCount,
  filterLeaderboardEntries,
  renderLeaderboardFragment,
  startLivePresenceHeartbeat,
  stopLivePresenceHeartbeat,
  isLivePresenceHeartbeatRunning
};
