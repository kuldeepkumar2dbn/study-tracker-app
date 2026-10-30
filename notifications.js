/**
 * 30-Minute Prior Browser Notification & Reminder System (notifications.js)
 * StudyFlow Zero-Backend Notification Architecture
 *
 * Implements:
 * 1. Native browser Notification API permission requests
 * 2. 60-second background scheduler
 * 3. 30-minute advance study slot detection
 * 4. Subtle audio chime when active tab is in focus
 * 5. Non-destructive notified status persistence in studyflow_${userId}_data
 */

import { getActiveUserId } from './auth-guard.js';
import { getUserData, patchUserData } from './storage-helper.js';

/**
 * Parses time string (e.g. "10:00" or "09:30") into minutes from midnight (e.g. 600)
 * @param {string} timeStr Time string formatted as HH:mm or within "HH:mm - HH:mm"
 * @returns {number|null} Minutes from midnight or null
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim().split('-')[0].trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Returns current browser Notification permission status
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export function getNotificationPermission() {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests Notification permission from the student via native browser dialog
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow-notification-permission-changed', {
        detail: { permission }
      }));
    }
    return permission;
  } catch (err) {
    console.warn('Notification.requestPermission error:', err);
    return Notification.permission || 'denied';
  }
}

/**
 * Plays a pleasant, subtle 2-tone audio chime if the current browser tab is active
 */
export function playReminderChime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Only play sound if document is visible / tab is active
  if (document.hidden) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // First bell tone: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Second bell tone: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0.15, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.75);

    // Close AudioContext after tones finish
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 1000);
  } catch (e) {
    // Non-blocking fallback if audio context restricted by autoplay policy
  }
}

/**
 * Background Reminder Engine:
 * - Scans active routine items scheduled for today
 * - Calculates reminder time (startTime - 30 minutes)
 * - Dispatches browser notification if within the 30-min window and !item.notified
 * - Marks item.notified = true and updates storage via non-destructive patchUserData
 *
 * @param {string} userId User ID (falls back to getActiveUserId())
 * @param {Date} customNow Optional date for deterministic testing
 * @returns {Array<Object>} List of items for which notifications were triggered
 */
export function checkStudyReminders(userId = null, customNow = null) {
  const targetUserId = userId || getActiveUserId();
  if (!targetUserId || targetUserId === 'guest') return [];

  const now = customNow || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const userData = getUserData(targetUserId);
  const routine = Array.isArray(userData.routine) ? userData.routine : [];

  if (routine.length === 0) return [];

  let hasUpdates = false;
  const notifiedItems = [];

  const updatedRoutine = routine.map(item => {
    // Skip already completed items
    if (item.completed) return item;

    const startMinutes = parseTimeToMinutes(item.startTime || item.timeRange);
    if (startMinutes === null) return item;

    const reminderMinutes = startMinutes - 30;

    // Check if within the 30-minute prior window and not yet notified
    if (currentMinutes >= reminderMinutes && currentMinutes < startMinutes && !item.notified) {
      // 1. Dispatch native browser notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const subject = item.syllabusLink?.subjectName || 'Routine Task';
          const notificationTitle = '⏰ Study Reminder (Starts in 30 mins)';
          const notificationBody = `${item.title} (${subject}) is scheduled at ${item.startTime || item.timeRange}. Get your notes ready!`;

          new Notification(notificationTitle, {
            body: notificationBody,
            icon: '/icons/icon-192.png',
            tag: String(item.id)
          });
        } catch (err) {
          console.warn('Failed to display study reminder notification:', err);
        }
      }

      // 2. Play subtle audio chime if tab is active
      playReminderChime();

      // 3. Mark notified
      hasUpdates = true;
      notifiedItems.push(item);
      return {
        ...item,
        notified: true
      };
    }

    return item;
  });

  // Persist updated routine without touching streaks or other sections
  if (hasUpdates) {
    patchUserData(targetUserId, { routine: updatedRoutine });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow-routine-reminders-updated', {
        detail: { notifiedCount: notifiedItems.length, notifiedItems }
      }));
    }
  }

  return notifiedItems;
}

// Global active interval tracker to avoid duplicate schedulers
let activeSchedulerInterval = null;

/**
 * Starts the 60-second periodic background reminder scheduler
 * @param {string} userId User ID
 * @param {number} intervalMs Check interval in ms (default 60,000ms = 60s)
 * @returns {{ stop: Function }} Cleanup controller
 */
export function startNotificationScheduler(userId = null, intervalMs = 60000) {
  if (activeSchedulerInterval) {
    clearInterval(activeSchedulerInterval);
    activeSchedulerInterval = null;
  }

  // Run initial check on scheduler startup
  try {
    checkStudyReminders(userId);
  } catch (err) {
    console.warn('Initial study reminder check error:', err);
  }

  activeSchedulerInterval = setInterval(() => {
    try {
      checkStudyReminders(userId);
    } catch (err) {
      console.warn('Periodic study reminder check error:', err);
    }
  }, intervalMs);

  return {
    stop: () => {
      if (activeSchedulerInterval) {
        clearInterval(activeSchedulerInterval);
        activeSchedulerInterval = null;
      }
    }
  };
}

export default {
  parseTimeToMinutes,
  getNotificationPermission,
  requestNotificationPermission,
  playReminderChime,
  checkStudyReminders,
  startNotificationScheduler
};
