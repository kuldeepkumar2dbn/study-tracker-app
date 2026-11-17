import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  initGoogleTokenClient, 
  requestDriveAccessToken, 
  getOrCreateStudyTrackerFolder, 
  saveStudyDataToDrive, 
  loadStudyDataFromDrive,
  uploadFileToDriveFolder,
  uploadDirectToDrive,
  getSubjectFolderLink,
  DEFAULT_GOOGLE_CLIENT_ID,
  FOLDER_NAME
} from '../services/googleDrive';
import { extractYouTubeId } from '../utils/youtube';
import { 
  getUserStorageKey, 
  logout, 
  getActiveUserId, 
  isDemoUser, 
  getOrCreateZeroStateData, 
  getUserDataStorageKey 
} from '../../auth-guard';
import { 
  markSyllabusTopicCompletedInSubjects,
  completeRoutineTaskWithSyllabusSync,
  undoCompletedRoutineTask
} from '../utils/routineSyllabusSync';
import { markSkillVideoCompletedInSkills } from '../utils/routineSkillSync';
import { 
  hydrateFromCloud, 
  debounceSaveToDrive, 
  syncNow as cloudSyncNow,
  forceBidirectionalSync,
  verifyOrRequestDriveToken,
  getSyncStatus as getGlobalSyncStatus,
  getLastSyncedTimestamp
} from '../services/cloud-sync';
import { 
  patchUserData, 
  autoMergeTomorrowPlans,
  handleEndOfDayRollover,
  checkAndTriggerEndOfDayRollover
} from '../../storage-helper.js';
import { TELEMETRY_URL } from '../../admin-config.js';
import { syncStudentToLeaderboard } from '../../leaderboard.js';
import { sanitizeText, stripHtmlTags } from '../../security-privacy.js';
import {
  filterActiveExamDeadlines,
  purgeExpiredExamDeadlines,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
} from '../../exam-radar.js';

const DataContext = createContext();

const STORAGE_KEY_PREFIX = 'studyflow_data_';

/**
 * Scoped LocalStorage helpers namespaced by user.sub or demo sandbox
 */
function readScoped(key, fallback) {
  try {
    if (isDemoUser()) {
      const demoKey = `demo_tracker_data_${key}`;
      const saved = sessionStorage.getItem(demoKey) || localStorage.getItem(demoKey);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return fallback;
    }
    const scopedKey = getUserStorageKey(key);
    const saved = localStorage.getItem(scopedKey);
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Backward-compatible fallback for legacy un-scoped key
    const legacy = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (legacy !== null) {
      try {
        localStorage.setItem(scopedKey, legacy);
        return JSON.parse(legacy);
      } catch {}
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function writeScoped(key, val) {
  try {
    if (isDemoUser()) {
      const demoKey = `demo_tracker_data_${key}`;
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      sessionStorage.setItem(demoKey, serialized);
      localStorage.setItem(demoKey, serialized);
      return;
    }
    const scopedKey = getUserStorageKey(key);
    localStorage.setItem(scopedKey, typeof val === 'string' ? val : JSON.stringify(val));
  } catch (e) {
    console.error('Storage write error for', key, e);
  }
}

// Timezone-Safe Local Date Formatter
export function getLocalDateString(date = new Date()) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const todayDateStr = () => getLocalDateString(new Date());
const addDaysDateStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
};

const addDaysIso = (days, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${getLocalDateString(d)}T${String(hour).padStart(2, '0')}:00:00`;
};

// Clean zero-state defaults (zero hardcoded dummy, placeholder, or sample data)
const initialSubjects = [];
const initialDeadlines = [];
const initialRoutineSlots = [];
const initialWeeklyGoals = [];
const initialSkills = [];
const initialImportantLinks = [];
const initialNotes = [];

function createZeroStreakState(dailyTargetHours = 4.0) {
  const target = Number(dailyTargetHours) || 4.0;
  return {
    streakCount: 0,
    lastActiveDate: null,
    todayHours: 0.0,
    dailyTarget: target,
    todayLogDate: todayDateStr(),
    weeklyVelocityHours: 0.0,
    weeklyLog: [
      { day: 'Mon', hours: 0, target },
      { day: 'Tue', hours: 0, target },
      { day: 'Wed', hours: 0, target },
      { day: 'Thu', hours: 0, target },
      { day: 'Fri', hours: 0, target },
      { day: 'Sat', hours: 0, target },
      { day: 'Sun', hours: 0, target }
    ]
  };
}

export function DataProvider({ children }) {
  const isDemo = isDemoUser();
  const activeId = getActiveUserId();
  const initialUserData = (!isDemo && activeId && activeId !== 'guest')
    ? getOrCreateZeroStateData(activeId)
    : null;

  // State: Subjects
  const [subjects, setSubjects] = useState(() => {
    if (isDemo) {
      return readScoped('subjects', initialSubjects);
    }
    if (initialUserData && Array.isArray(initialUserData.subjects) && initialUserData.subjects.length > 0) {
      return initialUserData.subjects;
    }
    return readScoped('subjects', []);
  });

  // State: Exams & Assignment Deadlines (auto-purges expired deadlines < today local midnight)
  const [exams, setExams] = useState(() => {
    let loaded = [];
    if (isDemo) {
      loaded = readScoped('exams', initialDeadlines);
    } else if (initialUserData && Array.isArray(initialUserData.exams)) {
      loaded = initialUserData.exams;
    } else {
      loaded = readScoped('exams', []);
    }
    return filterActiveExamDeadlines(loaded).activeExams;
  });

  // Auto-purge expired exams on mount, on switching to #view-radar / #view-dashboard, and across midnight
  useEffect(() => {
    const runPurge = () => {
      const res = purgeExpiredExamDeadlines({ userId: activeId });
      if (res && res.purged) {
        setExams(res.activeExams);
      } else {
        setExams((prev) => {
          const filtered = filterActiveExamDeadlines(prev);
          return filtered.removedCount > 0 ? filtered.activeExams : prev;
        });
      }
    };

    runPurge();
    startMidnightExamPurgeScheduler({
      onPurge: (res) => {
        if (res && res.purged) setExams(res.activeExams);
      }
    });

    const handlePurgedEvent = (e) => {
      if (Array.isArray(e?.detail?.activeExams)) {
        setExams(e.detail.activeExams);
      }
    };
    const handleViewChange = (e) => {
      const v = String(e?.detail?.view || '').toLowerCase();
      if (v === 'radar' || v === 'exam-radar' || v === 'dashboard') {
        runPurge();
      }
    };

    window.addEventListener('studyflow-exams-purged', handlePurgedEvent);
    window.addEventListener('studyflow-view-changed', handleViewChange);

    return () => {
      stopMidnightExamPurgeScheduler();
      window.removeEventListener('studyflow-exams-purged', handlePurgedEvent);
      window.removeEventListener('studyflow-view-changed', handleViewChange);
    };
  }, [activeId]);

  // State: Daily Routine Slots
  const [routineSlots, setRoutineSlots] = useState(() => {
    if (isDemo) {
      return readScoped('routine_slots', initialRoutineSlots);
    }
    if (initialUserData && Array.isArray(initialUserData.routine)) {
      return initialUserData.routine;
    }
    return readScoped('routine_slots', []);
  });

  // State: Tomorrow's Plan Slots
  const [tomorrowPlan, setTomorrowPlan] = useState(() => {
    if (isDemo) {
      return readScoped('tomorrow_plan', []);
    }
    if (initialUserData && Array.isArray(initialUserData.tomorrowPlan)) {
      return initialUserData.tomorrowPlan;
    }
    return readScoped('tomorrow_plan', []);
  });

  // State: Completed Routine Tasks for Today
  const [completedRoutineToday, setCompletedRoutineToday] = useState(() => {
    if (isDemo) {
      return readScoped('completed_routine_today', []);
    }
    if (initialUserData && Array.isArray(initialUserData.completedRoutineToday)) {
      return initialUserData.completedRoutineToday;
    }
    return readScoped('completed_routine_today', []);
  });

  // Automatic End-of-Day Rollover & Tomorrow Plan Auto-Merge on initialization
  const [mergeToastMessage, setMergeToastMessage] = useState(null);

  useEffect(() => {
    if (activeId && activeId !== 'guest') {
      try {
        const rolloverRes = checkAndTriggerEndOfDayRollover(activeId);
        if (rolloverRes && rolloverRes.rolledOver) {
          setRoutineSlots(rolloverRes.updatedRoutine);
          setTomorrowPlan(rolloverRes.remainingTomorrowPlan);
          if (rolloverRes.updatedSubjects) {
            setSubjects(rolloverRes.updatedSubjects);
          }
          setCompletedRoutineToday([]);
          setStreakData(prev => ({
            ...prev,
            todayHours: 0.0,
            lastActiveDate: rolloverRes.todayStr,
            todayLogDate: rolloverRes.todayStr
          }));
          if (rolloverRes.mergedTomorrowCount > 0) {
            setMergeToastMessage("🌅 Tomorrow's planned topics have been merged into your Daily Routine for today!");
          }
        } else {
          const result = autoMergeTomorrowPlans(activeId);
          if (result && result.merged) {
            setRoutineSlots(result.updatedRoutine);
            setTomorrowPlan(result.remainingPlans);
            setMergeToastMessage(result.message);
          }
        }
      } catch (err) {
        console.warn('Error during end-of-day rollover / auto-merge check:', err);
      }
    }
  }, [activeId]);

  // State: Weekly Goals
  const [weeklyGoals, setWeeklyGoals] = useState(() => {
    if (isDemo) {
      return readScoped('weekly_goals', initialWeeklyGoals);
    }
    return readScoped('weekly_goals', []);
  });

  // Daily & Weekly Targets
  const [dailyTargetMinutes, setDailyTargetMinutesState] = useState(() => {
    if (isDemo) {
      const saved = readScoped('daily_target_mins', 240);
      return Number(saved) || 240;
    }
    if (initialUserData && initialUserData.dailyTargetHours) {
      return Math.round(Number(initialUserData.dailyTargetHours) * 60);
    }
    const saved = readScoped('daily_target_mins', 240);
    return Number(saved) || 240;
  });

  const [weeklyTargetHours, setWeeklyTargetHoursState] = useState(() => {
    if (isDemo) {
      const saved = readScoped('weekly_target_hrs', 28);
      return Number(saved) || 28;
    }
    const saved = readScoped('weekly_target_hrs', 28);
    return Number(saved) || 28;
  });

  // Streak & Activity Log (starts cleanly at 0 streak and 0.0h)
  const [streakData, setStreakData] = useState(() => {
    if (isDemo) {
      return readScoped('streak', createZeroStreakState(4.0));
    }
    // Check if user data already exists in master document or initialUserData
    let masterDoc = initialUserData;
    if (!masterDoc && !isDemo && activeId && activeId !== 'guest') {
      try {
        const raw = localStorage.getItem(`studyflow_${activeId}_data`);
        if (raw) masterDoc = JSON.parse(raw);
      } catch {}
    }

    if (masterDoc) {
      // If data exists, DO NOT re-initialize streak: 0 or todayLoggedHours: 0
      // Only supply default zero values for fields that are strictly undefined
      const resolvedStreak = masterDoc.streak !== undefined 
        ? Number(masterDoc.streak) 
        : (masterDoc.streakCount !== undefined ? Number(masterDoc.streakCount) : 0);
      const resolvedHours = masterDoc.todayLoggedHours !== undefined 
        ? Number(masterDoc.todayLoggedHours) 
        : (masterDoc.todayHours !== undefined ? Number(masterDoc.todayHours) : 0.0);

      return {
        streakCount: resolvedStreak,
        lastActiveDate: masterDoc.lastActiveDate ?? null,
        todayHours: resolvedHours,
        dailyTarget: Number(masterDoc.dailyTargetHours || masterDoc.dailyTarget) || 4.0,
        todayLogDate: masterDoc.todayLogDate || todayDateStr(),
        weeklyVelocityHours: Number(masterDoc.weeklyVelocityHours) || 0.0,
        weeklyLog: Array.isArray(masterDoc.weeklyLog) && masterDoc.weeklyLog.length === 7 ? masterDoc.weeklyLog : [
          { day: 'Mon', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Tue', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Wed', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Thu', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Fri', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Sat', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 },
          { day: 'Sun', hours: 0, target: Number(masterDoc.dailyTargetHours) || 4.0 }
        ]
      };
    }
    return readScoped('streak', {
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
    });
  });

  // Skills - Persisted under studyflow_${userId}_skills and readScoped fallback
  const [skills, setSkills] = useState(() => {
    if (isDemo) {
      return readScoped('skills', initialSkills);
    }
    if (initialUserData && Array.isArray(initialUserData.skills)) {
      return initialUserData.skills;
    }
    try {
      const customKey = `studyflow_${activeId}_skills`;
      const savedCustom = localStorage.getItem(customKey);
      if (savedCustom !== null) {
        return JSON.parse(savedCustom);
      }
    } catch (e) {
      console.warn('Failed reading skills from studyflow_${userId}_skills:', e);
    }
    return readScoped('skills', []);
  });

  // Focus Timer History
  const [timerHistory, setTimerHistory] = useState(() => {
    return readScoped('timer_history', []);
  });

  // Daily Activity Matrix (for Consistency Radar heatmap)
  // Data Source: studyflow_${userId}_data.dailyActivity (e.g. { "2026-10-28": 145, "2026-10-27": 90 })
  // Enforces true zero-state: zero mock numbers or dummy generator seeds.
  const [dailyActivity, setDailyActivity] = useState(() => {
    if (isDemo) {
      const demoActivity = readScoped('daily_activity', null);
      if (demoActivity && typeof demoActivity === 'object') return demoActivity;
      return {};
    }
    if (initialUserData && initialUserData.dailyActivity && typeof initialUserData.dailyActivity === 'object') {
      return initialUserData.dailyActivity;
    }
    try {
      const key = `studyflow_${activeId}_data`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') {
          return parsed.dailyActivity;
        }
      }
    } catch {}
    const scoped = readScoped('daily_activity', null);
    if (scoped && typeof scoped === 'object') return scoped;
    return {};
  });

  const recordDailyActivity = (minutes, dateStr = todayDateStr()) => {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return;

    setDailyActivity(prev => {
      const currentVal = Number(prev[dateStr]) || 0;
      const updated = {
        ...prev,
        [dateStr]: currentVal + mins
      };

      const activeUserId = getActiveUserId();
      if (!isDemoUser() && activeUserId && activeUserId !== 'guest') {
        try {
          // Centralized patch controller writes to studyflow_${activeUserId}_data masterKey
          patchUserData(activeUserId, { dailyActivity: updated });
        } catch (e) {
          console.error('Error saving dailyActivity to master document:', e);
        }
      }
      writeScoped('daily_activity', updated);

      // Real-time update event hook for ConsistencyRadar and any listening views
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studyflow-activity-updated', {
            detail: { date: dateStr, minutes: currentVal + mins, dailyActivity: updated }
          }));
          window.dispatchEvent(new CustomEvent('studyDataUpdated', {
            detail: { date: dateStr, minutes: currentVal + mins, dailyActivity: updated }
          }));
        }
      } catch (err) {
        console.warn('Error dispatching studyflow-activity-updated:', err);
      }

      return updated;
    });
  };

  // State: Important Links & Resources (starts empty [] on fresh accounts)
  const [importantLinks, setImportantLinks] = useState(() => {
    if (initialUserData && Array.isArray(initialUserData.importantLinks)) {
      return initialUserData.importantLinks;
    }
    return readScoped('important_links', []);
  });

  const addImportantLink = (link) => {
    const newLink = {
      ...link,
      id: 'lnk-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    setImportantLinks(prev => [newLink, ...prev]);
  };

  const deleteImportantLink = (linkId) => {
    setImportantLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const restoreImportantLink = (link) => {
    setImportantLinks(prev => {
      if (prev.some(l => l.id === link.id)) return prev;
      return [link, ...prev];
    });
  };

  // State: Drive Notes (starts empty [] on fresh accounts)
  const [notes, setNotes] = useState(() => {
    if (initialUserData && Array.isArray(initialUserData.notes)) {
      return initialUserData.notes;
    }
    return readScoped('notes', []);
  });

  // State: Direct Drive Uploaded Files (PDFs / Images)
  const [driveFiles, setDriveFiles] = useState(() => {
    const raw = readScoped('drive_files', []);
    if (Array.isArray(raw)) {
      return raw.map(f => ({
        ...f,
        subject: f.subject || 'General',
        folderLink: f.folderLink || getSubjectFolderLink(f.subject || 'General', f.folderId)
      }));
    }
    return [];
  });

  // Google Drive & GIS State
  const [googleClientId, setGoogleClientIdState] = useState(() => {
    try {
      return localStorage.getItem('studyflow_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
    } catch {
      return DEFAULT_GOOGLE_CLIENT_ID;
    }
  });

  const [driveAccessToken, setDriveAccessToken] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('studyflow_drive_token');
        localStorage.removeItem('google_token_expiry');
      }
      return sessionStorage.getItem('studyflow_drive_token') || sessionStorage.getItem('google_access_token') || null;
    } catch {
      return null;
    }
  });

  const [driveUser, setDriveUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user_profile') || localStorage.getItem('google_user_profile') || sessionStorage.getItem('studyflow_drive_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [driveFolderId, setDriveFolderId] = useState(() => {
    return readScoped('drive_folder_id', null);
  });

  const [syncStatus, setSyncStatus] = useState(() => {
    return getGlobalSyncStatus() || 'offline';
  });
  const [lastSyncedTime, setLastSyncedTime] = useState(() => {
    const ts = getLastSyncedTimestamp();
    return ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  });
  const syncTimeoutRef = useRef(null);

  // Background Multi-Device Cloud Data Hydration on initial mount
  useEffect(() => {
    const isDemo = isDemoUser();
    const activeId = getActiveUserId();
    if (!isDemo && activeId && activeId !== 'guest') {
      const token = sessionStorage.getItem('studyflow_drive_token') || sessionStorage.getItem('google_access_token');
      if (token) {
        hydrateFromCloud(token, activeId).catch(err => {
          console.warn('Background cloud hydration error:', err);
        });
      } else {
        // Mobile / multi-device verification: verify or request silent token
        verifyOrRequestDriveToken().then(freshToken => {
          if (freshToken) {
            hydrateFromCloud(freshToken, activeId).catch(err => {
              console.warn('Background cloud hydration error:', err);
            });
          }
        }).catch(err => {
          console.warn('Silent token check on mount error:', err);
        });
      }
    }
  }, []);

  // Listen for multi-device sync events & sync status changes
  useEffect(() => {
    const handleCloudSync = (e) => {
      const remoteData = e.detail?.data;
      if (!remoteData) return;

      if (Array.isArray(remoteData.routine)) {
        setRoutineSlots(remoteData.routine);
      }
      if (Array.isArray(remoteData.exams)) {
        const purgedHydrated = filterActiveExamDeadlines(remoteData.exams);
        setExams(purgedHydrated.activeExams);
        if (purgedHydrated.removedCount > 0) {
          purgeExpiredExamDeadlines({ userId: activeId, examsOverride: remoteData.exams });
        }
      }
      if (Array.isArray(remoteData.skills)) {
        setSkills(remoteData.skills);
      }
      if (Array.isArray(remoteData.subjects)) {
        setSubjects(remoteData.subjects);
      }
      if (Array.isArray(remoteData.weeklyGoals)) {
        setWeeklyGoals(remoteData.weeklyGoals);
      }
      if (Array.isArray(remoteData.notes)) {
        setNotes(remoteData.notes);
      }
      if (remoteData.dailyActivity && typeof remoteData.dailyActivity === 'object') {
        setDailyActivity(remoteData.dailyActivity);
      }
      if (remoteData.streak !== undefined || remoteData.todayLoggedHours !== undefined) {
        setStreakData(prev => ({
          ...prev,
          streakCount: Number(remoteData.streak) || 0,
          lastActiveDate: remoteData.lastActiveDate || null,
          todayHours: Number(remoteData.todayLoggedHours) || 0.0,
          dailyTarget: Number(remoteData.dailyTargetHours) || prev.dailyTarget || 4.0,
          todayLogDate: remoteData.todayLogDate || todayDateStr(),
          weeklyVelocityHours: Number(remoteData.weeklyVelocityHours) || 0.0
        }));
      }
    };

    const handleSyncStatus = (e) => {
      if (e.detail?.status) {
        setSyncStatus(e.detail.status);
      }
      if (e.detail?.lastSyncedTimestamp) {
        setLastSyncedTime(new Date(e.detail.lastSyncedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };

    window.addEventListener('studyflow-cloud-sync', handleCloudSync);
    window.addEventListener('studyflow-cloud-sync-status', handleSyncStatus);
    return () => {
      window.removeEventListener('studyflow-cloud-sync', handleCloudSync);
      window.removeEventListener('studyflow-cloud-sync-status', handleSyncStatus);
    };
  }, []);

  // Set Client ID
  const setGoogleClientId = (id) => {
    setGoogleClientIdState(id);
    try {
      localStorage.setItem('studyflow_google_client_id', id);
    } catch (e) {
      console.error(e);
    }
  };

  // Set Targets
  const setDailyTargetMinutes = (mins) => {
    const val = Number(mins) || 60;
    setDailyTargetMinutesState(val);
    writeScoped('daily_target_mins', val);
    setStreakData(prev => ({ ...prev, dailyTarget: Math.round((val / 60) * 10) / 10 }));
  };

  const setWeeklyTargetHours = (hrs) => {
    const val = Number(hrs) || 10;
    setWeeklyTargetHoursState(val);
    writeScoped('weekly_target_hrs', val);
  };

  // Automatic Midnight Rollover Check (Requirement 3)
  useEffect(() => {
    const checkMidnightRollover = () => {
      const today = todayDateStr();
      const isDemo = isDemoUser();
      const activeId = getActiveUserId();

      if (!isDemo && activeId && activeId !== 'guest') {
        try {
          const rolloverRes = checkAndTriggerEndOfDayRollover(activeId);
          if (rolloverRes && rolloverRes.rolledOver) {
            setRoutineSlots(rolloverRes.updatedRoutine);
            setTomorrowPlan(rolloverRes.remainingTomorrowPlan);
            if (rolloverRes.updatedSubjects) {
              setSubjects(rolloverRes.updatedSubjects);
            }
            setCompletedRoutineToday([]);
            setStreakData(prev => ({
              ...prev,
              todayHours: 0.0,
              lastActiveDate: rolloverRes.todayStr,
              todayLogDate: rolloverRes.todayStr
            }));
            if (rolloverRes.mergedTomorrowCount > 0) {
              setMergeToastMessage("🌅 Tomorrow's planned topics have been merged into your Daily Routine for today!");
            }
          }
        } catch (e) {
          console.error('Error during midnight rollover check:', e);
        }
      } else {
        const lastRollover = localStorage.getItem(STORAGE_KEY_PREFIX + 'last_rollover_date') || today;
        if (lastRollover !== today) {
          setRoutineSlots(prev => prev.filter(s => !s.completed).map(s => ({ ...s, completed: false, carriedOver: true, carriedOverNote: "Carried over from yesterday" })));
          setStreakData(prev => ({ ...prev, todayHours: 0, lastActiveDate: today }));
          localStorage.setItem(STORAGE_KEY_PREFIX + 'last_rollover_date', today);
        }
      }
    };

    checkMidnightRollover();
    const interval = setInterval(checkMidnightRollover, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [routineSlots]);

  // Synchronize master user state document (studyflow_${user.sub}_data) & trigger real-time debounced Drive save
  useEffect(() => {
    const isDemo = isDemoUser();
    const activeId = getActiveUserId();
    if (!isDemo && activeId && activeId !== 'guest') {
      try {
        patchUserData(activeId, {
          streak: streakData.streakCount !== undefined ? streakData.streakCount : undefined,
          lastActiveDate: streakData.lastActiveDate ?? null,
          dailyTargetHours: streakData.dailyTarget ?? 4.0,
          todayLoggedHours: streakData.todayHours !== undefined ? streakData.todayHours : undefined,
          todayLogDate: streakData.todayLogDate || todayDateStr(),
          weeklyVelocityHours: streakData.weeklyVelocityHours ?? 0.0,
          dailyActivity: dailyActivity || {},
          routine: routineSlots || [],
          tomorrowPlan: tomorrowPlan || [],
          completedRoutineToday: completedRoutineToday || [],
          exams: exams || [],
          skills: skills || [],
          subjects: subjects || [],
          notes: notes || [],
          weeklyGoals: weeklyGoals || [],
          importantLinks: importantLinks || []
        });
      } catch (err) {
        console.error('Error syncing master user state:', err);
      }
    }
  }, [exams, routineSlots, tomorrowPlan, completedRoutineToday, skills, streakData, subjects, notes, weeklyGoals, importantLinks, dailyActivity]);

  // LocalStorage Persistence scoped to authenticated student (user.sub)
  useEffect(() => {
    try {
      writeScoped('subjects', subjects);
      writeScoped('exams', exams);
      writeScoped('routine_slots', routineSlots);
      writeScoped('tomorrow_plan', tomorrowPlan);
      writeScoped('weekly_goals', weeklyGoals);
      writeScoped('daily_activity', dailyActivity);
      // Persist skills to both studyflow_${userId}_skills and writeScoped
      if (!isDemoUser()) {
        try {
          const userId = getActiveUserId();
          const customKey = `studyflow_${userId}_skills`;
          localStorage.setItem(customKey, JSON.stringify(skills));
        } catch (e) {
          console.error('Failed writing studyflow_${userId}_skills:', e);
        }
      }
      writeScoped('skills', skills);
      writeScoped('streak', streakData);
      writeScoped('timer_history', timerHistory);
      writeScoped('weekly_target_hrs', weeklyTargetHours);
      writeScoped('daily_target_mins', dailyTargetMinutes);
      writeScoped('important_links', importantLinks);
      writeScoped('notes', notes);
      writeScoped('drive_files', driveFiles);
      if (driveFolderId) writeScoped('drive_folder_id', driveFolderId);

      // Trigger debounced Drive sync if connected
      if (driveAccessToken && driveFolderId) {
        setSyncStatus('unsaved');
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          syncNowToDrive();
        }, 3000);
      }
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }, [subjects, exams, routineSlots, weeklyGoals, skills, streakData, timerHistory, weeklyTargetHours, dailyTargetMinutes, importantLinks, notes, driveFiles, driveFolderId]);

  // Google Drive Actions
  const connectGoogleDrive = () => {
    if (!googleClientId.trim()) {
      throw new Error('Please enter your Google Cloud OAuth Client ID first.');
    }

    const tokenClient = initGoogleTokenClient(
      googleClientId.trim(),
      async (tokenResponse) => {
        const token = tokenResponse.access_token;
        setDriveAccessToken(token);
        try {
          sessionStorage.setItem('studyflow_drive_token', token);
          sessionStorage.setItem('google_access_token', token);
          localStorage.removeItem('google_access_token');
          localStorage.removeItem('studyflow_drive_token');
          localStorage.removeItem('google_token_expiry');
        } catch {}

        setSyncStatus('syncing');

        try {
          const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            const userInfo = {
              name: userData.name || 'Google User',
              email: userData.email,
              picture: userData.picture
            };
            setDriveUser(userInfo);
            sessionStorage.setItem('studyflow_drive_user', JSON.stringify(userInfo));
          }
        } catch (e) {
          console.warn('Could not fetch user profile', e);
        }

        try {
          const folderId = await getOrCreateStudyTrackerFolder(token);
          setDriveFolderId(folderId);
          localStorage.setItem('studyflow_drive_folder_id', folderId);

          await saveStudyDataToDrive(token, folderId, {
            subjects,
            exams,
            routineSlots,
            weeklyGoals,
            skills,
            streakData,
            timerHistory,
            exportedAt: new Date().toISOString()
          });

          setSyncStatus('synced');
          setLastSyncedTime(new Date().toLocaleTimeString());
        } catch (err) {
          console.error('Error establishing Drive folder:', err);
          setSyncStatus('unsaved');
        }
      },
      (error) => {
        console.error('GIS Error:', error);
        alert(`Google Sign-In Error: ${error.message}`);
        setSyncStatus('offline');
      }
    );

    if (tokenClient) {
      requestDriveAccessToken();
    }
  };

  const disconnectGoogleDrive = () => {
    setDriveAccessToken(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    localStorage.removeItem('studyflow_drive_token');
    sessionStorage.removeItem('studyflow_drive_token');
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_token_expiry');
    setSyncStatus('offline');
  };

  const signOut = () => {
    logout();
  };

  // Explicit Bidirectional Cloud Sync ("☁️ Sync Now")
  const syncNowToDrive = async () => {
    try {
      setSyncStatus('syncing');
      const activeId = getActiveUserId();
      const currentPayload = {
        userId: activeId,
        streak: streakData?.streakCount ?? 0,
        lastActiveDate: streakData?.lastActiveDate ?? null,
        dailyTargetHours: streakData?.dailyTarget ?? 4.0,
        todayLoggedHours: streakData?.todayHours ?? 0.0,
        todayLogDate: streakData?.todayLogDate || todayDateStr(),
        weeklyVelocityHours: streakData?.weeklyVelocityHours ?? 0.0,
        dailyActivity: dailyActivity || {},
        routine: routineSlots || [],
        exams: exams || [],
        skills: skills || [],
        subjects: subjects || [],
        notes: notes || [],
        weeklyGoals: weeklyGoals || [],
        importantLinks: importantLinks || [],
        updatedAt: new Date().toISOString()
      };
      const res = await forceBidirectionalSync(currentPayload);
      syncStudentToLeaderboard(TELEMETRY_URL, {
        ...currentPayload,
        subjectsList: subjects || [],
        streakData
      }).catch(() => {});
      return res;
    } catch (e) {
      console.error('Explicit sync error:', e);
      setSyncStatus('offline');
      return { success: false, error: e.message };
    }
  };

  // Notes CRUD Handlers
  const addNote = (newNote) => {
    const note = {
      id: 'note-' + Date.now(),
      updatedAt: new Date().toISOString(),
      driveFileId: 'drv-' + Math.random().toString(36).substring(2, 9),
      isStarred: false,
      tags: [],
      ...newNote
    };
    setNotes(prev => [note, ...prev]);
    return note;
  };

  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  // Drive File Direct Upload Handlers
  const uploadDriveFile = async (file, subjectName = 'General') => {
    const uploaded = await uploadDirectToDrive(file, subjectName);
    const enriched = {
      ...uploaded,
      subject: uploaded.subject || subjectName || 'General',
      folderLink: uploaded.folderLink || getSubjectFolderLink(uploaded.subject || subjectName, uploaded.folderId)
    };
    setDriveFiles(prev => [enriched, ...prev]);
    return enriched;
  };

  const deleteDriveFile = (id) => {
    setDriveFiles(prev => prev.filter(f => f.id !== id));
  };

  const driveConfig = {
    targetFolder: FOLDER_NAME,
    lastSynced: lastSyncedTime || 'Synced with Google Drive',
    isConnected: !!driveAccessToken
  };

  const syncDrive = () => {
    syncNowToDrive();
  };

  // Upload PDF / Image Attachment for Subject
  const uploadSubjectAttachment = async (subjectId, file) => {
    if (driveAccessToken && driveFolderId) {
      try {
        const uploaded = await uploadFileToDriveFolder(driveAccessToken, driveFolderId, file);
        setSubjects(prev => prev.map(s => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            driveAttachments: [...(s.driveAttachments || []), uploaded]
          };
        }));
        return uploaded;
      } catch (err) {
        console.error('Direct Drive upload failed, falling back to local file link:', err);
      }
    }

    const localAttachment = {
      id: 'local-att-' + Date.now(),
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type.includes('pdf') ? 'pdf' : 'image',
      webViewLink: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      isLocal: true
    };

    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        driveAttachments: [...(s.driveAttachments || []), localAttachment]
      };
    }));

    return localAttachment;
  };

  const removeSubjectAttachment = (subjectId, attachmentId) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        driveAttachments: (s.driveAttachments || []).filter(a => a.id !== attachmentId)
      };
    }));
  };

  // Subjects & Topics Actions (XSS-sanitized inputs)
  const addSubject = (newSubject) => {
    const subjectObj = {
      id: 'sub-' + Date.now(),
      name: stripHtmlTags(newSubject.name || '').trim() || 'Untitled Subject',
      code: stripHtmlTags(newSubject.code || 'SUB-101').trim(),
      color: newSubject.color || '#6366f1',
      targetWeeklyHours: Number(newSubject.targetWeeklyHours) || 10,
      completedHours: 0,
      examDate: newSubject.examDate || addDaysDateStr(30),
      category: stripHtmlTags(newSubject.category || 'General').trim(),
      topics: [],
      driveAttachments: []
    };
    setSubjects(prev => [...prev, subjectObj]);
  };

  const deleteSubject = (subjectId) => {
    setSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const updateSubjectName = (subjectId, newName) => {
    const cleanName = stripHtmlTags(newName || '').trim();
    if (!cleanName) return;
    setSubjects(prev => prev.map(s => 
      s.id === subjectId ? { ...s, name: cleanName } : s
    ));
  };

  const updateSubjectTargetHours = (subjectId, newHours) => {
    const val = Math.max(1, Math.min(100, Number(newHours) || 1));
    setSubjects(prev => prev.map(s => 
      s.id === subjectId ? { ...s, targetWeeklyHours: val } : s
    ));
  };

  const logStudyHours = (additionalHours, subjectId = null, exactMinutes = null) => {
    const hrs = Math.round(Number(additionalHours) * 10) / 10;
    if (hrs <= 0) return;
    const today = todayDateStr();
    const minutesToRecord = exactMinutes !== null && exactMinutes !== undefined 
      ? Number(exactMinutes) 
      : Math.round(hrs * 60);

    // Track daily focus minutes in studyflow_${userId}_data.dailyActivity
    recordDailyActivity(minutesToRecord, today);

    setStreakData(prev => {
      const newTodayHours = Math.round(((prev?.todayHours || 0) + hrs) * 10) / 10;
      const newWeeklyVelocity = Math.round(((prev?.weeklyVelocityHours || 0) + hrs) * 10) / 10;
      const currentStreak = prev?.streakCount || 0;
      // If streak was 0 and student logs study, kickstart day 1 streak!
      const newStreak = currentStreak === 0 ? 1 : currentStreak;

      const currentDayAbbr = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date());
      const newWeeklyLog = (prev?.weeklyLog || []).map(day => {
        if (day.day === currentDayAbbr) {
          return { ...day, hours: Math.round(((day.hours || 0) + hrs) * 10) / 10 };
        }
        return day;
      });

      return {
        ...prev,
        todayHours: newTodayHours,
        weeklyVelocityHours: newWeeklyVelocity,
        streakCount: newStreak,
        lastActiveDate: today,
        todayLogDate: today,
        weeklyLog: newWeeklyLog
      };
    });

    if (subjectId) {
      setSubjects(prev => prev.map(s => {
        if (s.id === subjectId) {
          return { ...s, completedHours: Math.round(((s.completedHours || 0) + hrs) * 10) / 10 };
        }
        return s;
      }));
    } else if (subjects.length > 0) {
      setSubjects(prev => prev.map((s, idx) => {
        if (idx === 0) {
          return { ...s, completedHours: Math.round(((s.completedHours || 0) + hrs) * 10) / 10 };
        }
        return s;
      }));
    }
  };

  const updateSubjectHours = (subjectId, additionalHours) => {
    logStudyHours(additionalHours, subjectId);
  };

  const logChapterStudyMinutes = (subjectId, chapterId, minutes) => {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return;

    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const additionalHours = Math.round((mins / 60) * 10) / 10;
      return {
        ...s,
        completedHours: Math.round((s.completedHours + additionalHours) * 10) / 10,
        topics: s.topics.map(t => {
          if (t.id !== chapterId) return t;
          return {
            ...t,
            studiedMinutes: (t.studiedMinutes || 0) + mins
          };
        })
      };
    }));

    setStreakData(prev => ({
      ...prev,
      todayHours: Math.round((prev.todayHours + (mins / 60)) * 10) / 10
    }));
  };

  const addTopic = (subjectId, title, status = 'Not Started', notes = '') => {
    const newTopic = {
      id: 'top-' + Date.now(),
      title: stripHtmlTags(title || '').trim() || 'Untitled Chapter',
      status,
      notes: stripHtmlTags(notes || '').trim(),
      studiedMinutes: 0,
      subtopics: [],
      youtubeLinks: [],
      repetitionStage: 0,
      lastReviewedDate: status !== 'Not Started' ? todayDateStr() : null,
      nextReviewDate: status !== 'Not Started' ? addDaysDateStr(1) : addDaysDateStr(3)
    };

    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: [...s.topics, newTopic] };
    }));
  };

  const updateTopicStatus = (subjectId, topicId, newStatus) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const updatedTopics = s.topics.map(t => {
        if (t.id !== topicId) return t;
        const willBeMastered = newStatus === 'Mastered';
        return {
          ...t,
          status: newStatus,
          repetitionStage: willBeMastered ? 4 : t.repetitionStage,
          lastReviewedDate: todayDateStr(),
          nextReviewDate: willBeMastered ? addDaysDateStr(60) : t.nextReviewDate || addDaysDateStr(1)
        };
      });
      return { ...s, topics: updatedTopics };
    }));
  };

  const deleteTopic = (subjectId, topicId) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return { ...s, topics: s.topics.filter(t => t.id !== topicId) };
    }));
  };

  const updateChapterName = (subjectId, chapterId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => t.id === chapterId ? { ...t, title: newTitle.trim() } : t)
      };
    }));
  };

  // Sub-topics Actions
  const addSubTopic = (subjectId, topicId, title, status = 'Not Started') => {
    const newSub = {
      id: 'subt-' + Date.now(),
      title,
      status
    };

    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: [...(t.subtopics || []), newSub]
          };
        })
      };
    }));
  };

  const updateSubTopicStatus = (subjectId, topicId, subTopicId, newStatus) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== topicId) return t;
          const updatedSub = (t.subtopics || []).map(st => st.id === subTopicId ? { ...st, status: newStatus } : st);
          
          // Re-evaluate parent topic status based on subtopics
          const allMastered = updatedSub.length > 0 && updatedSub.every(st => st.status === 'Mastered');
          const anyInProgress = updatedSub.some(st => st.status === 'In Progress' || st.status === 'Mastered');
          const parentStatus = allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started';

          return {
            ...t,
            status: parentStatus,
            subtopics: updatedSub
          };
        })
      };
    }));
  };

  const deleteSubTopic = (subjectId, topicId, subTopicId) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            subtopics: (t.subtopics || []).filter(st => st.id !== subTopicId)
          };
        })
      };
    }));
  };

  const updateTopicName = (subjectId, chapterId, topicId, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== chapterId) return t;
          return {
            ...t,
            subtopics: (t.subtopics || []).map(st => 
              st.id === topicId ? { ...st, title: newTitle.trim() } : st
            )
          };
        })
      };
    }));
  };

  // YouTube Links Actions
  const addYouTubeLink = (subjectId, topicId, title, url) => {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Please provide a valid watch, youtu.be, or shorts link.');
    }

    const newLink = {
      id: 'yt-' + Date.now(),
      title: title.trim() || 'Lecture Video',
      url: url.trim(),
      videoId
    };

    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            youtubeLinks: [...(t.youtubeLinks || []), newLink]
          };
        })
      };
    }));
  };

  const deleteYouTubeLink = (subjectId, topicId, linkId) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics.map(t => {
          if (t.id !== topicId) return t;
          return {
            ...t,
            youtubeLinks: (t.youtubeLinks || []).filter(l => l.id !== linkId)
          };
        })
      };
    }));
  };

  // Spaced Repetition Actions
  const completeRevision = (subjectId, topicId) => {
    const intervals = [1, 3, 7, 30];
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const updatedTopics = s.topics.map(t => {
        if (t.id !== topicId) return t;
        const currentStage = t.repetitionStage || 0;
        const nextStage = Math.min(4, currentStage + 1);
        const nextIntervalDays = nextStage < 4 ? intervals[nextStage] : 60;
        return {
          ...t,
          status: nextStage >= 3 ? 'Mastered' : 'In Progress',
          repetitionStage: nextStage,
          lastReviewedDate: todayDateStr(),
          nextReviewDate: addDaysDateStr(nextIntervalDays)
        };
      });
      return { ...s, topics: updatedTopics };
    }));
  };

  const getTodayRevisionQueue = () => {
    const today = todayDateStr();
    const queue = [];
    subjects.forEach(sub => {
      sub.topics.forEach(t => {
        if (t.nextReviewDate && t.nextReviewDate <= today) {
          queue.push({
            ...t,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color
          });
        }
      });
    });
    return queue;
  };

  // Exams & Assignment Deadlines Actions
  const addExam = (newExam) => {
    setExams(prev => [...prev, {
      id: 'dl-' + Date.now(),
      type: newExam.type || 'exam',
      title: newExam.title,
      subject: newExam.subject,
      date: newExam.date,
      room: newExam.room || (newExam.type === 'assignment' ? 'Online Submission' : 'Main Exam Hall'),
      priority: newExam.priority || 'High',
      weight: newExam.weight || (newExam.type === 'assignment' ? '15% Homework' : '30% of grade'),
      notes: newExam.notes || '',
      submissionLink: newExam.submissionLink || '',
      assignmentStatus: newExam.type === 'assignment' ? (newExam.assignmentStatus || 'Pending') : undefined,
      isCompleted: newExam.isCompleted || false
    }]);
  };

  const updateAssignmentStatus = (id, newStatus) => {
    setExams(prev => prev.map(e => {
      if (e.id !== id) return e;
      return {
        ...e,
        assignmentStatus: newStatus,
        isCompleted: newStatus === 'Submitted'
      };
    }));
  };

  const toggleExamCompleted = (examId) => {
    setExams(prev => prev.map(e => {
      if (e.id !== examId) return e;
      const nextDone = !e.isCompleted;
      return {
        ...e,
        isCompleted: nextDone,
        assignmentStatus: e.type === 'assignment' ? (nextDone ? 'Submitted' : 'In Progress') : undefined
      };
    }));
  };

  const deleteExam = (examId) => {
    setExams(prev => prev.filter(e => e.id !== examId));
  };

  // Daily Routine Slots Actions
  const addRoutineSlot = (slot) => {
    const startTime = slot.startTime || (slot.timeRange ? slot.timeRange.split('-')[0].trim() : '08:00');
    const endTime = slot.endTime || (slot.timeRange ? slot.timeRange.split('-')[1]?.trim() : '10:00');
    const formattedRange = slot.timeRange || `${startTime} - ${endTime}`;

    const newSlot = {
      id: slot.id || ('block_' + Date.now()),
      title: stripHtmlTags(slot.title || '').trim(),
      startTime,
      endTime,
      timeRange: formattedRange,
      category: stripHtmlTags(slot.category || 'Core Study').trim(),
      completed: Boolean(slot.completed),
      syllabusLink: slot.syllabusLink || null,
      skillLink: slot.skillLink || null,
      linkType: slot.linkType || null,
      calendarEventId: slot.calendarEventId || null
    };

    setRoutineSlots(prev => [...prev, newSlot]);
    return newSlot;
  };

  const markSyllabusTopicCompleted = (subjectId, chapterId, topicId, topicName) => {
    const res = markSyllabusTopicCompletedInSubjects(subjects, subjectId, chapterId, topicId, activeId, topicName);
    setSubjects(res.updatedSubjects);
    writeScoped('subjects', res.updatedSubjects);

    // Two-way sync: If any active routine slot is linked to this topic, complete it and move to completedRoutineToday
    const linkedSlot = (routineSlots || []).find(s => {
      if (!s.syllabusLink) return false;
      const subMatch = (subjectId && s.syllabusLink.subjectId === subjectId);
      const topMatch = (topicId && s.syllabusLink.topicId === topicId) || 
                       (topicName && s.syllabusLink.topicName === topicName) ||
                       (topicId && s.syllabusLink.topicName === topicId);
      return subMatch && topMatch;
    });

    if (linkedSlot) {
      completeRoutineTask(linkedSlot.id);
    }

    return res;
  };

  const completeRoutineTask = (slotId) => {
    const result = completeRoutineTaskWithSyllabusSync({
      routine: routineSlots,
      subjects: subjects,
      completedToday: completedRoutineToday,
      slotId,
      userId: activeId
    });

    setRoutineSlots(result.remainingRoutine);
    setCompletedRoutineToday(result.updatedCompletedToday);
    writeScoped('routine_slots', result.remainingRoutine);
    writeScoped('completed_routine_today', result.updatedCompletedToday);

    if (result.syllabusUpdated) {
      setSubjects(result.updatedSubjects);
      writeScoped('subjects', result.updatedSubjects);
    }

    return result;
  };

  const undoCompletedRoutine = (slotId) => {
    const result = undoCompletedRoutineTask({
      routine: routineSlots,
      subjects: subjects,
      completedToday: completedRoutineToday,
      slotId,
      userId: activeId
    });

    setRoutineSlots(result.restoredRoutine);
    setCompletedRoutineToday(result.remainingCompletedToday);
    writeScoped('routine_slots', result.restoredRoutine);
    writeScoped('completed_routine_today', result.remainingCompletedToday);

    if (result.updatedSubjects && result.updatedSubjects !== subjects) {
      setSubjects(result.updatedSubjects);
      writeScoped('subjects', result.updatedSubjects);
    }

    return result;
  };

  const markSkillVideoCompleted = (skillId, videoId) => {
    const res = markSkillVideoCompletedInSkills(skills, skillId, videoId, activeId);
    setSkills(res.updatedSkills);
    writeScoped('skills', res.updatedSkills);
    return res;
  };

  const toggleRoutineSlot = (id) => {
    const targetSlot = (routineSlots || []).find(s => s.id === id);
    if (targetSlot && !targetSlot.completed) {
      return completeRoutineTask(id);
    }
    setRoutineSlots(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, completed: !s.completed };
    }));
  };

  const deleteRoutineSlot = (id) => {
    setRoutineSlots(prev => prev.filter(s => s.id !== id));
  };

  // Tomorrow's Plan Actions
  const addTomorrowPlan = (planItem) => {
    const defaultDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toLocaleDateString('en-CA');
    })();

    const newItem = {
      id: planItem.id || ('plan_' + Date.now()),
      title: (planItem.title || '').trim(),
      startTime: planItem.startTime || '10:00',
      endTime: planItem.endTime || '12:00',
      scheduledDate: planItem.scheduledDate || defaultDate,
      category: planItem.category || 'Core Study',
      syllabusLink: planItem.syllabusLink ? {
        subjectId: planItem.syllabusLink.subjectId,
        subjectName: planItem.syllabusLink.subjectName,
        chapterId: planItem.syllabusLink.chapterId,
        chapterName: planItem.syllabusLink.chapterName,
        topicName: planItem.syllabusLink.topicName
      } : null,
      notified: Boolean(planItem.notified),
      calendarEventId: planItem.calendarEventId || null
    };

    setTomorrowPlan(prev => [...prev, newItem]);
    return newItem;
  };

  const updateTomorrowPlan = (id, updates) => {
    setTomorrowPlan(prev => prev.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        ...updates,
        id: p.id
      };
    }));
  };

  const deleteTomorrowPlan = (id) => {
    setTomorrowPlan(prev => prev.filter(p => p.id !== id));
  };

  // Weekly Goals Actions
  const addWeeklyGoal = (title) => {
    setWeeklyGoals(prev => [...prev, {
      id: 'wg-' + Date.now(),
      title: title.trim(),
      done: false,
      weekId: 'current'
    }]);
  };

  const toggleWeeklyGoal = (id) => {
    setWeeklyGoals(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g));
  };

  const deleteWeeklyGoal = (id) => {
    setWeeklyGoals(prev => prev.filter(g => g.id !== id));
  };

  // Helper to recalculate course completion percentage based on checked subtopics
  const recalculateSkillProgress = (skill) => {
    if (!skill.levels || skill.levels.length === 0) return skill.masteryPct || 0;
    let total = 0;
    let completed = 0;
    for (const lvl of skill.levels) {
      for (const lec of (lvl.lectures || [])) {
        for (const st of (lec.subtopics || [])) {
          total++;
          if (st.done) completed++;
        }
      }
    }
    return total > 0 ? Math.round((completed / total) * 100) : (skill.masteryPct || 0);
  };

  // Skills Actions
  const addSkill = (newSkill) => {
    setSkills(prev => [...prev, {
      id: newSkill.id || ('sk-' + Date.now()),
      name: newSkill.name,
      category: newSkill.category || 'Engineering',
      levelNum: Number(newSkill.levelNum) || 3,
      masteryPct: Number(newSkill.masteryPct) || 0,
      hoursLogged: Number(newSkill.hoursLogged) || 0,
      tags: newSkill.tags || ['Skill'],
      isCourse: !!newSkill.isCourse,
      youtubeUrl: newSkill.youtubeUrl || '',
      thumbnailUrl: newSkill.thumbnailUrl || '',
      authorName: newSkill.authorName || '',
      levels: newSkill.levels || [],
      milestones: newSkill.milestones || []
    }]);
  };

  const deleteSkill = (skillId) => {
    setSkills(prev => prev.filter(s => s.id !== skillId));
  };

  const restoreSkill = (skill, index) => {
    setSkills(prev => {
      if (prev.some(s => s.id === skill.id)) return prev;
      const next = [...prev];
      if (typeof index === 'number' && index >= 0 && index <= next.length) {
        next.splice(index, 0, skill);
      } else {
        next.push(skill);
      }
      return next;
    });
  };

  const toggleSubtopic = (skillId, levelId, lectureId, subtopicId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        const updatedLectures = (lvl.lectures || []).map(lec => {
          if (lec.id !== lectureId) return lec;
          const updatedSubtopics = (lec.subtopics || []).map(st => {
            if (st.id !== subtopicId) return st;
            return { ...st, done: !st.done };
          });
          return { ...lec, subtopics: updatedSubtopics };
        });
        return { ...lvl, lectures: updatedLectures };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const deleteSubtopic = (skillId, levelId, lectureId, subtopicId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        const updatedLectures = (lvl.lectures || []).map(lec => {
          if (lec.id !== lectureId) return lec;
          return { ...lec, subtopics: (lec.subtopics || []).filter(st => st.id !== subtopicId) };
        });
        return { ...lvl, lectures: updatedLectures };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const restoreSubtopic = (skillId, levelId, lectureId, subtopic, index) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        const updatedLectures = (lvl.lectures || []).map(lec => {
          if (lec.id !== lectureId) return lec;
          const list = [...(lec.subtopics || [])];
          if (list.some(st => st.id === subtopic.id)) return lec;
          if (typeof index === 'number' && index >= 0 && index <= list.length) {
            list.splice(index, 0, subtopic);
          } else {
            list.push(subtopic);
          }
          return { ...lec, subtopics: list };
        });
        return { ...lvl, lectures: updatedLectures };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const toggleLectureCompleted = (skillId, levelId, lectureId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        const updatedLectures = (lvl.lectures || []).map(lec => {
          if (lec.id !== lectureId && lec.videoId !== lectureId) return lec;
          const nextCompleted = !lec.completed;
          const updatedSubtopics = (lec.subtopics || []).map(st => ({ ...st, done: nextCompleted }));
          return { ...lec, completed: nextCompleted, subtopics: updatedSubtopics };
        });
        return { ...lvl, lectures: updatedLectures };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const deleteLecture = (skillId, levelId, lectureId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        return { ...lvl, lectures: (lvl.lectures || []).filter(lec => lec.id !== lectureId) };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const restoreLecture = (skillId, levelId, lecture, index) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedLevels = (s.levels || []).map(lvl => {
        if (lvl.id !== levelId) return lvl;
        const list = [...(lvl.lectures || [])];
        if (list.some(l => l.id === lecture.id)) return lvl;
        if (typeof index === 'number' && index >= 0 && index <= list.length) {
          list.splice(index, 0, lecture);
        } else {
          list.push(lecture);
        }
        return { ...lvl, lectures: list };
      });
      const updatedSkill = { ...s, levels: updatedLevels };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const deleteLevel = (skillId, levelId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const updatedSkill = { ...s, levels: (s.levels || []).filter(lvl => lvl.id !== levelId) };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const restoreLevel = (skillId, level, index) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const list = [...(s.levels || [])];
      if (list.some(l => l.id === level.id)) return s;
      if (typeof index === 'number' && index >= 0 && index <= list.length) {
        list.splice(index, 0, level);
      } else {
        list.push(level);
      }
      const updatedSkill = { ...s, levels: list };
      updatedSkill.masteryPct = recalculateSkillProgress(updatedSkill);
      return updatedSkill;
    }));
  };

  const updateSkillLevel = (skillId, levelNum, masteryPct) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      return {
        ...s,
        levelNum,
        masteryPct: masteryPct !== undefined ? masteryPct : Math.min(100, levelNum * 20)
      };
    }));
  };

  const addSkillMilestone = (skillId, title, type = 'milestone') => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      return {
        ...s,
        milestones: [...s.milestones, { id: 'm-' + Date.now(), title, done: false, type }]
      };
    }));
  };

  const toggleSkillMilestone = (skillId, milestoneId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      return {
        ...s,
        milestones: s.milestones.map(m => m.id === milestoneId ? { ...m, done: !m.done } : m)
      };
    }));
  };

  const deleteSkillMilestone = (skillId, milestoneId) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      return {
        ...s,
        milestones: s.milestones.filter(m => m.id !== milestoneId)
      };
    }));
  };

  const restoreSkillMilestone = (skillId, milestone, index) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const list = [...(s.milestones || [])];
      if (list.some(m => m.id === milestone.id)) return s;
      if (typeof index === 'number' && index >= 0 && index <= list.length) {
        list.splice(index, 0, milestone);
      } else {
        list.push(milestone);
      }
      return { ...s, milestones: list };
    }));
  };

  const logSkillHours = (skillId, hours) => {
    setSkills(prev => prev.map(s => {
      if (s.id !== skillId) return s;
      const newHours = s.hoursLogged + hours;
      const boostPct = Math.min(100, s.masteryPct + Math.round(hours * 1.5));
      return { ...s, hoursLogged: newHours, masteryPct: boostPct };
    }));
  };

  // Focus Timer Action
  const addTimerSession = (session) => {
    const sessionObj = {
      ...session,
      id: 'th-' + Date.now(),
      timestamp: new Date().toISOString()
    };

    setTimerHistory(prev => [sessionObj, ...prev]);

    const hours = Math.round((Number(session.durationMin || 0) / 60) * 10) / 10;
    const currentSubjectObj = subjects.find(s => s.name === session.subject || s.id === session.subjectId);

    // Dynamically increase todayLoggedHours, streak, weeklyVelocityHours, and record daily focus minutes
    logStudyHours(hours, currentSubjectObj?.id, session.durationMin);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('focusTimerStateChanged', {
          detail: { session: sessionObj, hours, durationMin: session.durationMin }
        }));
      }
    } catch (e) {
      console.warn('Error dispatching focusTimerStateChanged:', e);
    }

    if (session.subjectId && session.chapterId) {
      logChapterStudyMinutes(session.subjectId, session.chapterId, session.durationMin);
    } else if (session.subject) {
      if (currentSubjectObj && session.chapterId) {
        logChapterStudyMinutes(currentSubjectObj.id, session.chapterId, session.durationMin);
      }
    }
  };

  return (
    <DataContext.Provider
      value={{
        subjects,
        addSubject,
        deleteSubject,
        updateSubjectName,
        updateSubjectTargetHours,
        updateSubjectHours,
        logStudyHours,
        logChapterStudyMinutes,
        addTopic,
        updateTopicStatus,
        deleteTopic,
        updateChapterName,
        addSubTopic,
        updateSubTopicStatus,
        deleteSubTopic,
        updateTopicName,
        addYouTubeLink,
        deleteYouTubeLink,
        uploadSubjectAttachment,
        removeSubjectAttachment,
        completeRevision,
        getTodayRevisionQueue,
        exams,
        addExam,
        updateAssignmentStatus,
        toggleExamCompleted,
        deleteExam,
        routineSlots,
        addRoutineSlot,
        toggleRoutineSlot,
        deleteRoutineSlot,
        completedRoutineToday,
        setCompletedRoutineToday,
        completeRoutineTask,
        undoCompletedRoutineTask: undoCompletedRoutine,
        undoCompletedRoutine,
        tomorrowPlan,
        addTomorrowPlan,
        updateTomorrowPlan,
        deleteTomorrowPlan,
        mergeToastMessage,
        setMergeToastMessage,
        markSyllabusTopicCompleted,
        markSkillVideoCompleted,
        weeklyGoals,
        addWeeklyGoal,
        toggleWeeklyGoal,
        deleteWeeklyGoal,
        dailyTargetMinutes,
        setDailyTargetMinutes,
        weeklyTargetHours,
        setWeeklyTargetHours,
        skills,
        setSkills,
        addSkill,
        deleteSkill,
        restoreSkill,
        toggleSubtopic,
        deleteSubtopic,
        restoreSubtopic,
        deleteLecture,
        restoreLecture,
        toggleLectureCompleted,
        deleteLevel,
        restoreLevel,
        updateSkillLevel,
        addSkillMilestone,
        toggleSkillMilestone,
        deleteSkillMilestone,
        restoreSkillMilestone,
        logSkillHours,
        streakData,
        dailyActivity,
        recordDailyActivity,
        timerHistory,
        addTimerSession,
        importantLinks,
        addImportantLink,
        deleteImportantLink,
        restoreImportantLink,
        // Drive Notes
        notes,
        addNote,
        updateNote,
        deleteNote,
        driveConfig,
        syncDrive,
        // Drive direct files (PDFs/Images)
        driveFiles,
        uploadDriveFile,
        deleteDriveFile,
        // Google Drive zero-backend
        googleClientId,
        setGoogleClientId,
        driveAccessToken,
        driveUser,
        driveFolderId,
        syncStatus,
        lastSyncedTime,
        connectGoogleDrive,
        disconnectGoogleDrive,
        syncNowToDrive,
        forceBidirectionalSync: syncNowToDrive,
        signOut
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
