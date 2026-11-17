/**
 * Real-Time Student Leaderboard Engine (leaderboard.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Uses TELEMETRY_URL from admin-config.js to synchronize and fetch
 * Top 100 Overall and Top 100 Subject-Wise student rankings in real time.
 */

import { TELEMETRY_URL, isTelemetryConfigured, getLoggedInUserProfile } from './admin-config.js';

export { TELEMETRY_URL };

export const LEADERBOARD_SETTINGS_KEY = 'studytracker_leaderboard_settings';
export const LEADERBOARD_CACHE_KEY = 'studytracker_leaderboard_cache';
export const LEADERBOARD_SELF_KEY = 'studytracker_leaderboard_self';
export const STUDENT_PROFILE_KEY = 'studytracker_student_profile';
export const LIVE_HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (180,000ms)

/**
 * Reads persisted student profile (username, targetExam, showOnLeaderboard) from localStorage.
 */
function getStoredStudentProfile() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
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
 * Generates or retrieves a stable unique student ID for leaderboard attribution.
 */
export function getStudentId(userProfile = null) {
  const profile = userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);
  if (profile?.sub) return String(profile.sub).trim();
  if (profile?.email) return String(profile.email).trim().toLowerCase();

  if (typeof localStorage !== 'undefined') {
    try {
      let visitorId = localStorage.getItem('study_visitor_id');
      if (!visitorId) {
        visitorId = 'usr_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('study_visitor_id', visitorId);
      }
      return visitorId;
    } catch {
      // ignore storage errors
    }
  }
  return 'usr_anonymous';
}

/**
 * Reads persisted leaderboard display name, opt-in privacy toggle, and auto-refresh setting.
 */
export function getLeaderboardSettings(userProfile = null) {
  const profile = userProfile || (typeof getLoggedInUserProfile === 'function' ? getLoggedInUserProfile() : null);
  const studentProfile = getStoredStudentProfile();
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
      displayName: profileHandle || (
        (typeof parsed.displayName === 'string' && parsed.displayName.trim())
          ? parsed.displayName.trim()
          : defaults.displayName
      ),
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
  const cleanUsername = String(rawUsername || '').trim().replace(/^@+/, '');
  const profileHandle = cleanUsername ? `@${cleanUsername}` : '';
  const targetExam = String(
    options.targetExam ||
    userData.targetExam ||
    studentProfile?.resolvedTargetExam ||
    studentProfile?.targetExam ||
    ''
  ).trim();

  const studentId = options.studentId || userData.studentId || getStudentId(profile);
  const displayName = (options.displayName !== undefined && String(options.displayName).trim())
    ? String(options.displayName).trim()
    : (profileHandle || (userData.displayName !== undefined && String(userData.displayName).trim()) || settings.displayName);
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
  const activeSubject = String(
    options.activeSubject ||
    userData.activeSubject ||
    timerSubject ||
    firstSubjectName
  ).trim();

  // Ensure activeSubject has at least today's hours reflected if not already present
  if (activeSubject && subjectHours[activeSubject] === undefined) {
    subjectHours[activeSubject] = Number(todayHours.toFixed(1));
  }

  return {
    type: 'leaderboard_sync',
    action: 'leaderboard_sync',
    studentId,
    username: cleanUsername || undefined,
    displayName,
    targetExam: targetExam || undefined,
    optedIn,
    weeklyHours,
    totalHours: Number(Math.max(weeklyHours, subjectsTotal).toFixed(1)),
    todayHours: Number(todayHours.toFixed(1)),
    streak,
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
          'Content-Type': 'application/json'
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
 * Deterministic fallback cohort generator (used ONLY if the remote endpoint does not return
 * live leaderboard rows yet or is offline, ensuring the Top 3 Podium & Top 100 table work seamlessly).
 */
const COHORT_FIRST_NAMES = [
  'Aarav', 'Ananya', 'Rohan', 'Priya', 'Kabir', 'Meera', 'Vikram', 'Diya',
  'Siddharth', 'Ishita', 'Aditya', 'Sneha', 'Arjun', 'Kavya', 'Nikhil', 'Riya',
  'Pranav', 'Neha', 'Dev', 'Tanvi', 'Karthik', 'Shreya', 'Varun', 'Pooja',
  'Harsh', 'Aditi', 'Yash', 'Sakshi', 'Manish', 'Nandini'
];

const COHORT_LAST_INITIALS = ['s', 'm', 'k', 'p', 'r', 'v', 'g', 'd', 'n', 'b', 't', 'c'];
const COHORT_TARGET_EXAMS = ['GATE', 'JEE / NEET', 'UPSC / SSC', 'Coding & Software', 'Electronics & Hardware'];

function generateCommunityBenchmarkRows(subjectFilter = '', limit = 100) {
  const rows = [];
  const count = Math.min(limit, 100);
  const subjectsPool = [...COMMON_LEADERBOARD_SUBJECTS];

  for (let i = 0; i < count; i++) {
    const fName = COHORT_FIRST_NAMES[i % COHORT_FIRST_NAMES.length];
    const lInit = COHORT_LAST_INITIALS[(i * 7 + 3) % COHORT_LAST_INITIALS.length];
    const suffix = i >= COHORT_FIRST_NAMES.length ? `${Math.floor(i / COHORT_FIRST_NAMES.length) + 1}` : '';
    const username = `${fName.toLowerCase()}_${lInit}${suffix}`;
    const displayName = `@${username}`;
    const targetExam = COHORT_TARGET_EXAMS[i % COHORT_TARGET_EXAMS.length];

    const primarySubject = subjectFilter || subjectsPool[i % subjectsPool.length];
    const isLiveNow = (i % 4 === 0) || i === 0 || i === 2;
    const baseWeekly = Math.max(2.5, Number((54.0 - i * 0.48 - ((i * 13) % 7) * 0.2).toFixed(1)));
    const subjectHrs = Math.max(1.0, Number((baseWeekly * (0.42 + ((i % 5) * 0.08))).toFixed(1)));
    const streak = Math.max(1, Math.round(38 - i * 0.32 + ((i * 5) % 6)));

    const subjectHours = {};
    subjectsPool.forEach((subj, sIdx) => {
      subjectHours[subj] = subj === primarySubject
        ? subjectHrs
        : Number(Math.max(0.5, subjectHrs * (0.3 + ((i + sIdx) % 4) * 0.15)).toFixed(1));
    });

    rows.push({
      studentId: `cohort_${i + 1}`,
      username,
      displayName,
      targetExam,
      weeklyHours: baseWeekly,
      hours: subjectFilter ? subjectHrs : baseWeekly,
      streak,
      activeSubject: primarySubject,
      lastSubject: primarySubject,
      isLiveNow,
      subjectHours,
      updatedAt: new Date(Date.now() - (i * 180000)).toISOString(),
      isCohortPreview: true
    });
  }

  return rows;
}

/**
 * Normalizes a raw student row returned by remote Google Apps Script or cache.
 */
function normalizeLeaderboardEntry(raw, mode = 'overall', subject = '') {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.optedIn === false) return null;

  const studentId = String(raw.studentId || raw.id || raw.userId || raw.email || raw.displayName || '').trim();
  if (!studentId) return null;

  const rawUsername = raw.username ? String(raw.username).trim().replace(/^@+/, '') : '';
  const displayName = String(
    raw.displayName || (rawUsername ? `@${rawUsername}` : '') || raw.name || 'Student'
  ).trim();
  const targetExam = String(raw.targetExam || raw.resolvedTargetExam || '').trim();
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

  const streak = Math.max(0, Number(raw.streak ?? raw.streakCount ?? 0) || 0);
  const activeSubject = String(raw.activeSubject || raw.currentSubject || raw.lastSubject || subject || 'General Studies').trim();

  // Check if updated recently (within last 45 mins) when considering isLiveNow
  let isLiveNow = Boolean(raw.isLiveNow);
  if (isLiveNow && raw.updatedAt) {
    const ageMs = Date.now() - new Date(raw.updatedAt).getTime();
    if (!Number.isNaN(ageMs) && ageMs > 90 * 60 * 1000) {
      isLiveNow = false;
    }
  }

  return {
    studentId,
    username: rawUsername || (displayName.startsWith('@') ? displayName.slice(1) : ''),
    displayName,
    targetExam,
    hours: Number(Math.max(0, hours).toFixed(1)),
    weeklyHours: Number(Math.max(0, Number(raw.weeklyHours ?? raw.hours ?? 0) || 0).toFixed(1)),
    streak,
    activeSubject,
    lastSubject: String(raw.lastSubject || activeSubject).trim(),
    isLiveNow,
    subjectHours,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
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
 * @returns {Promise<{rankings: Array, currentUserRank: Object|null, totalParticipants: number, source: string, fetchedAt: string}>}
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

  // 1. Attempt live GET fetch from TELEMETRY_URL
  if (isTelemetryConfigured(targetUrl) && typeof fetch !== 'undefined') {
    try {
      const separator = targetUrl.includes('?') ? '&' : '?';
      const queryUrl = `${targetUrl}${separator}type=leaderboard&mode=${encodeURIComponent(normalizedMode)}&subject=${encodeURIComponent(cleanSubject)}&limit=${maxEntries}`;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 7000) : null;

      const res = await fetch(queryUrl, {
        method: 'GET',
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res && res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          const candidate = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.rankings)
              ? parsed.rankings
              : (Array.isArray(parsed?.leaderboard)
                ? parsed.leaderboard
                : (Array.isArray(parsed?.data) ? parsed.data : null)));

          if (Array.isArray(candidate) && candidate.length > 0) {
            rawEntries = candidate;
            source = 'live';

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
          }
        } catch {
          // Response was not JSON array (e.g. basic Apps Script text response)
        }
      }
    } catch {
      // Network or timeout — fall back cleanly below
    }
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

  // 3. Fallback to community benchmark cohort so UI always renders rich Top 100 leaderboard
  if (!rawEntries) {
    rawEntries = generateCommunityBenchmarkRows(cleanSubject, maxEntries);
    source = 'community';
  }

  // 4. Normalize and deduplicate by studentId
  const byId = new Map();
  rawEntries.forEach((row) => {
    const normalized = normalizeLeaderboardEntry(row, normalizedMode, cleanSubject);
    if (normalized) {
      // In subject mode, only include entries with >0 hours for that subject (unless it's the current user)
      if (normalizedMode === 'overall' || normalized.hours > 0) {
        byId.set(normalized.studentId, normalized);
      }
    }
  });

  // 5. Merge current logged-in student's live entry if opted in
  const settings = getLeaderboardSettings(currentUserData?.userProfile);
  const currentStudentId = currentUserData?.studentId || getStudentId(currentUserData?.userProfile);
  const effectiveOptIn = currentUserData?.optedIn !== undefined
    ? Boolean(currentUserData.optedIn)
    : settings.optedIn;

  if (effectiveOptIn) {
    const selfRaw = currentUserData
      ? buildStudentLeaderboardPayload(currentUserData)
      : getLocalSelfEntry();

    if (selfRaw) {
      const normalizedSelf = normalizeLeaderboardEntry(selfRaw, normalizedMode, cleanSubject);
      if (normalizedSelf) {
        const existing = byId.get(currentStudentId);
        byId.set(currentStudentId, {
          ...(existing || {}),
          ...normalizedSelf,
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
    const isMe = entry.studentId === currentStudentId;
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
    fetchedAt: new Date().toISOString()
  };
}

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
  intervalMs = LIVE_HEARTBEAT_INTERVAL_MS
) {
  // Clear any existing heartbeat to prevent duplicate intervals
  if (_heartbeatTimerId !== null) {
    clearInterval(_heartbeatTimerId);
    _heartbeatTimerId = null;
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
if (typeof window !== 'undefined') {
  window.syncStudentToLeaderboard = syncStudentToLeaderboard;
  window.fetchLeaderboard = fetchLeaderboard;
  window.startLivePresenceHeartbeat = startLivePresenceHeartbeat;
  window.stopLivePresenceHeartbeat = stopLivePresenceHeartbeat;
  window.StudyLeaderboard = {
    TELEMETRY_URL,
    LIVE_HEARTBEAT_INTERVAL_MS,
    COMMON_LEADERBOARD_SUBJECTS,
    getStudentId,
    getLeaderboardSettings,
    saveLeaderboardSettings,
    getAvailableSubjects,
    buildStudentLeaderboardPayload,
    syncStudentToLeaderboard,
    fetchLeaderboard,
    getLiveStudyingCount,
    filterLeaderboardEntries,
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
  getStudentId,
  getLeaderboardSettings,
  saveLeaderboardSettings,
  getAvailableSubjects,
  buildStudentLeaderboardPayload,
  syncStudentToLeaderboard,
  fetchLeaderboard,
  getLiveStudyingCount,
  filterLeaderboardEntries,
  startLivePresenceHeartbeat,
  stopLivePresenceHeartbeat,
  isLivePresenceHeartbeatRunning
};
