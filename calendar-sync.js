/**
 * Google Calendar Sync Engine (calendar-sync.js)
 * StudyFlow Zero-Backend Architecture
 *
 * Implements:
 * 1. Synchronizing Daily Routine blocks and Tomorrow's Planner items to Google Calendar.
 * 2. 30-minute advance mobile & lock-screen alarm reminders via Calendar API popup overrides.
 * 3. Local IANA timezone detection & RFC3339 datetime formatting.
 * 4. Storing returned calendarEventId into user data using non-destructive patchUserData.
 * 5. Offline and authorization fallback without blocking local task creation.
 */

import { getActiveAccessToken } from './cloud-sync.js';
import { getUserData, patchUserData } from './storage-helper.js';
import { getActiveUserId } from './auth-guard.js';

export const CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const CALENDAR_PREFERENCE_KEY = 'studyflow_push_to_calendar';
export const DEFAULT_CALENDAR_SUCCESS_MESSAGE = '📅 Event added to your Google Calendar! Reminder set for 30 minutes prior.';

/**
 * Returns the student's local IANA timezone
 * e.g. "Asia/Kolkata", "America/New_York", "Europe/London"
 * @returns {string}
 */
export function getLocalTimeZone() {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
    return 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Formats a date string (YYYY-MM-DD) and time string (HH:mm) into an RFC3339 datetime string
 * with the student's exact local timezone offset (e.g. 2026-10-31T10:00:00+05:30).
 *
 * @param {string} dateStr Date in 'YYYY-MM-DD'
 * @param {string} timeStr Time in 'HH:mm' or 'HH:mm:ss'
 * @returns {string} RFC3339 string
 */
export function formatRFC3339(dateStr, timeStr) {
  if (!dateStr) return '';
  const cleanTime = (timeStr || '08:00').trim();
  const timeParts = cleanTime.split(':');
  const hours = parseInt(timeParts[0] || '0', 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const seconds = parseInt(timeParts[2] || '0', 10);

  const [yearStr, monthStr, dayStr] = dateStr.trim().split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offsetMinutes = pad(Math.abs(offsetMin) % 60);
  const offsetStr = `${sign}${offsetHours}:${offsetMinutes}`;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offsetStr}`;
}

/**
 * Formats event title according to requirement:
 * 📚 Study: [Topic / Block Title] ([Subject Name])
 *
 * @param {string} title Topic or block title
 * @param {string|null} [subjectName] Associated subject name
 * @returns {string} Formatted title
 */
export function formatStudyEventTitle(title, subjectName) {
  const cleanTitle = (title || 'Study Session').trim();
  const cleanSubject = (subjectName || '').trim();
  if (cleanSubject) {
    return `📚 Study: ${cleanTitle} (${cleanSubject})`;
  }
  return `📚 Study: ${cleanTitle}`;
}

/**
 * Constructs Google Calendar Event resource payload with 30-min advance popup reminder
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.startTime
 * @param {string} params.endTime
 * @param {string} params.scheduledDate
 * @param {string|null} [params.subjectName]
 * @param {string|null} [params.description]
 * @returns {Object} Google Calendar Event payload
 */
export function buildCalendarEventPayload({
  title,
  startTime,
  endTime,
  scheduledDate,
  subjectName = null,
  description = null
}) {
  const dateStr = scheduledDate || new Date().toLocaleDateString('en-CA');
  const startStr = startTime || '08:00';
  let endStr = endTime || '10:00';

  // Handle overnight blocks or same-time slots
  let endDateStr = dateStr;
  if (endStr <= startStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const pad = (n) => String(n).padStart(2, '0');
    endDateStr = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;
  }

  const startDateTime = formatRFC3339(dateStr, startStr);
  const endDateTime = formatRFC3339(endDateStr, endStr);
  const timeZone = getLocalTimeZone();
  const summary = formatStudyEventTitle(title, subjectName);

  return {
    summary,
    description: description || `Study session scheduled via StudyFlow (${summary}).`,
    start: {
      dateTime: startDateTime,
      timeZone
    },
    end: {
      dateTime: endDateTime,
      timeZone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 30 }
      ]
    }
  };
}

/**
 * Pushes a study session to Google Calendar via Google Calendar API v3
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.startTime
 * @param {string} params.endTime
 * @param {string} [params.scheduledDate]
 * @param {string|null} [params.subjectName]
 * @param {string|null} [params.description]
 * @param {string|null} [params.accessToken]
 * @returns {Promise<{ success: boolean, eventId?: string, event?: Object, error?: string, status?: number, reason?: string }>}
 */
export async function pushStudySessionToCalendar({
  title,
  startTime,
  endTime,
  scheduledDate,
  subjectName = null,
  description = null,
  accessToken = null
} = {}) {
  // Graceful offline detection
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      success: false,
      reason: 'offline',
      error: 'Device is offline. Task saved locally.'
    };
  }

  const token = accessToken || getActiveAccessToken();
  if (!token) {
    return {
      success: false,
      reason: 'no_token',
      error: 'No active Google OAuth access token found.'
    };
  }

  const payload = buildCalendarEventPayload({
    title,
    startTime,
    endTime,
    scheduledDate,
    subjectName,
    description
  });

  try {
    const response = await fetch(CALENDAR_EVENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        eventId: data.id,
        event: data
      };
    } else {
      let errBody = null;
      try {
        errBody = await response.json();
      } catch {}
      return {
        success: false,
        status: response.status,
        error: errBody?.error?.message || response.statusText || 'Calendar event creation failed.'
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting Google Calendar API.'
    };
  }
}

/**
 * Stores the returned calendarEventId inside the routine or tomorrow plan item
 * using patchUserData so streak and focus hours remain untouched.
 *
 * @param {string} userId
 * @param {Object} options
 * @param {string} options.itemId
 * @param {'routine'|'tomorrowPlan'} [options.itemType]
 * @param {string} options.calendarEventId
 * @returns {Object|null}
 */
export function saveCalendarEventToItem(userId, { itemId, itemType = 'routine', calendarEventId }) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest' || !itemId || !calendarEventId) {
    return null;
  }

  const userData = getUserData(targetUserId);
  if (!userData) return null;

  if (itemType === 'tomorrowPlan') {
    const plans = Array.isArray(userData.tomorrowPlan) ? [...userData.tomorrowPlan] : [];
    const idx = plans.findIndex(p => p && p.id === itemId);
    if (idx !== -1) {
      plans[idx] = { ...plans[idx], calendarEventId };
      return patchUserData(targetUserId, { tomorrowPlan: plans });
    }
  } else {
    const routine = Array.isArray(userData.routine) ? [...userData.routine] : [];
    const idx = routine.findIndex(r => r && r.id === itemId);
    if (idx !== -1) {
      routine[idx] = { ...routine[idx], calendarEventId };
      return patchUserData(targetUserId, { routine });
    }
  }

  return null;
}

/**
 * Reads user's calendar toggle preference from localStorage
 * Default: true if previously checked or saved, else true/false
 * @returns {boolean}
 */
export function getCalendarPreference() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const val = localStorage.getItem(CALENDAR_PREFERENCE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists user's calendar toggle preference in localStorage
 * @param {boolean} enabled
 */
export function setCalendarPreference(enabled) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CALENDAR_PREFERENCE_KEY, String(Boolean(enabled)));
  } catch (err) {
    console.warn('Error saving calendar preference:', err);
  }
}

/**
 * Dispatches a UI success toast event for Google Calendar event creation
 *
 * @param {string} [message]
 */
export function showCalendarSuccessToast(message = DEFAULT_CALENDAR_SUCCESS_MESSAGE) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('studyflow-calendar-event-created', {
        detail: { message }
      }));
    } catch {}
  }
}

export default {
  CALENDAR_EVENTS_ENDPOINT,
  CALENDAR_PREFERENCE_KEY,
  DEFAULT_CALENDAR_SUCCESS_MESSAGE,
  getLocalTimeZone,
  formatRFC3339,
  formatStudyEventTitle,
  buildCalendarEventPayload,
  pushStudySessionToCalendar,
  saveCalendarEventToItem,
  getCalendarPreference,
  setCalendarPreference,
  showCalendarSuccessToast
};
