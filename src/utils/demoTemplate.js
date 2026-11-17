/**
 * Clean Zero-State Session Template (src/utils/demoTemplate.js)
 * Guarantees fresh accounts and preview sessions start from clean zero values
 * with zero hardcoded dummy tasks, exams, notes, or fake streaks.
 */
import { getLocalDateString } from './dateUtils.js';

export const DEMO_STORAGE_PREFIX = 'demo_tracker_data_';
export const DEMO_SESSION_DURATION_MS = 7 * 60 * 1000; // 7 minutes

export const DEMO_KEYS = {
  IS_DEMO: 'is_demo_user',
  END_TIME: 'demo_session_end'
};

const todayDateStr = () => getLocalDateString(new Date());

export function getFreshDemoTemplateData() {
  return {
    subjects: [],
    exams: [],
    routine_slots: [],
    weekly_goals: [],
    skills: [],
    streak: {
      streakCount: 0,
      lastActiveDate: null,
      todayHours: 0.0,
      dailyTarget: 4.0,
      todayLogDate: todayDateStr(),
      weeklyVelocityHours: 0.0,
      weeklyLog: [
        { day: 'Mon', hours: 0, target: 4.0 },
        { day: 'Tue', hours: 0, target: 4.0 },
        { day: 'Wed', hours: 0, target: 4.0 },
        { day: 'Thu', hours: 0, target: 4.0 },
        { day: 'Fri', hours: 0, target: 4.0 },
        { day: 'Sat', hours: 0, target: 4.0 },
        { day: 'Sun', hours: 0, target: 4.0 }
      ]
    },
    dailyActivity: {},
    daily_target_mins: 240,
    weekly_target_hrs: 28,
    important_links: [],
    notes: [],
    tomorrow_plan: [],
    tomorrowPlan: [],
    timer_history: [],
    drive_files: []
  };
}
