import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  initGoogleTokenClient, 
  requestDriveAccessToken, 
  getOrCreateStudyTrackerFolder, 
  saveStudyDataToDrive, 
  loadStudyDataFromDrive,
  uploadFileToDriveFolder,
  FOLDER_NAME
} from '../services/googleDrive';
import { extractYouTubeId } from '../utils/youtube';

const DataContext = createContext();

const STORAGE_KEY_PREFIX = 'studyflow_data_';

// Helper for dates
const todayDateStr = () => new Date().toISOString().split('T')[0];
const addDaysDateStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const addDaysIso = (days, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Initial Mock Subjects with Sub-Topics, YouTube Resources, Status Tags & Drive Attachments
const initialSubjects = [
  {
    id: 'sub-1',
    name: 'Computer Science & Algorithms',
    code: 'CS-301',
    color: '#6366f1',
    targetWeeklyHours: 12,
    completedHours: 38,
    examDate: addDaysDateStr(18),
    category: 'Engineering',
    topics: [
      { 
        id: 'cs-t1', 
        title: 'Binary Search Trees & AVL Rotations', 
        status: 'Mastered', 
        notes: 'Balanced tree height theorem and rotation invariants verified.',
        repetitionStage: 3, 
        studiedMinutes: 90,
        lastReviewedDate: addDaysDateStr(-6),
        nextReviewDate: todayDateStr(),
        subtopics: [
          { id: 'cs-st1', title: 'Binary Search Tree Insertion & Deletion', status: 'Mastered' },
          { id: 'cs-st2', title: 'AVL Tree LL, RR, LR, RL Rotations', status: 'Mastered' },
          { id: 'cs-st3', title: 'Self-Balancing Invariants & Complexity Proofs', status: 'In Progress' }
        ],
        youtubeLinks: [
          {
            id: 'yt-1',
            title: 'AVL Tree Rotations Visualized & Explained',
            url: 'https://www.youtube.com/watch?v=vRwi_UCVr20',
            videoId: 'vRwi_UCVr20'
          }
        ]
      },
      { 
        id: 'cs-t2', 
        title: 'Dynamic Programming: Knapsack & Subsequences', 
        status: 'In Progress', 
        notes: '0/1 vs Unbounded tabulation tables, space optimization tricks.',
        repetitionStage: 1, 
        lastReviewedDate: addDaysDateStr(-2),
        nextReviewDate: todayDateStr(),
        subtopics: [
          { id: 'cs-st4', title: '0/1 Knapsack Bottom-Up Matrix', status: 'Mastered' },
          { id: 'cs-st5', title: 'Longest Common Subsequence (LCS)', status: 'In Progress' },
          { id: 'cs-st6', title: 'Matrix Chain Multiplication & Memoization', status: 'Not Started' }
        ],
        youtubeLinks: [
          {
            id: 'yt-2',
            title: 'Dynamic Programming - 7 Hour Masterclass',
            url: 'https://www.youtube.com/watch?v=oBt53YbR9Kk',
            videoId: 'oBt53YbR9Kk'
          }
        ]
      },
      { 
        id: 'cs-t3', 
        title: 'System Design: Caching & Load Balancing', 
        status: 'In Progress', 
        notes: 'Consistent hashing rings, cache-aside vs write-through patterns.',
        repetitionStage: 0, 
        lastReviewedDate: addDaysDateStr(-1),
        nextReviewDate: todayDateStr(),
        subtopics: [
          { id: 'cs-st7', title: 'Cache eviction: LRU, LFU, FIFO', status: 'Mastered' },
          { id: 'cs-st8', title: 'Consistent Hashing and Virtual Nodes', status: 'In Progress' }
        ],
        youtubeLinks: []
      },
      { 
        id: 'cs-t4', 
        title: 'Distributed Consensus: Raft Protocol', 
        status: 'Not Started', 
        notes: 'Leader election, log replication, and split-brain recovery.',
        repetitionStage: 0, 
        lastReviewedDate: null,
        nextReviewDate: addDaysDateStr(2),
        subtopics: [
          { id: 'cs-st9', title: 'Raft Leader Election and Heartbeats', status: 'Not Started' },
          { id: 'cs-st10', title: 'Log Replication and Commit Index', status: 'Not Started' }
        ],
        youtubeLinks: [
          {
            id: 'yt-3',
            title: 'Raft Consensus Algorithm in 10 Minutes',
            url: 'https://www.youtube.com/watch?v=I3WqdAoPndc',
            videoId: 'I3WqdAoPndc'
          }
        ]
      }
    ],
    driveAttachments: [
      {
        id: 'att-1',
        name: 'AVL_Tree_Rotations_Notes.pdf',
        size: '1.4 MB',
        type: 'pdf',
        webViewLink: 'https://drive.google.com',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ]
  },
  {
    id: 'sub-2',
    name: 'Advanced Mathematics & Statistics',
    code: 'MATH-204',
    color: '#06b6d4',
    targetWeeklyHours: 10,
    completedHours: 26,
    examDate: addDaysDateStr(7),
    category: 'Mathematics',
    topics: [
      { 
        id: 'm-t1', 
        title: 'Eigenvalues, Eigenvectors & Diagonalization', 
        status: 'Mastered', 
        notes: 'Characteristic polynomials and algebraic vs geometric multiplicity.',
        repetitionStage: 2, 
        lastReviewedDate: addDaysDateStr(-5),
        nextReviewDate: addDaysDateStr(2),
        subtopics: [
          { id: 'm-st1', title: 'Characteristic Polynomial Roots', status: 'Mastered' },
          { id: 'm-st2', title: 'Orthogonal Matrix Diagonalization', status: 'Mastered' }
        ],
        youtubeLinks: [
          {
            id: 'yt-4',
            title: 'Essence of Linear Algebra: Eigenvectors',
            url: 'https://www.youtube.com/watch?v=PFDu9oVAE-g',
            videoId: 'PFDu9oVAE-g'
          }
        ]
      },
      { 
        id: 'm-t2', 
        title: 'Multivariable Optimization & Lagrange Multipliers', 
        status: 'In Progress', 
        notes: 'Constrained gradients and bordered Hessian determinant tests.',
        repetitionStage: 1, 
        lastReviewedDate: addDaysDateStr(-3),
        nextReviewDate: todayDateStr(),
        subtopics: [
          { id: 'm-st3', title: 'Lagrange Multiplier Constrained Extrema', status: 'In Progress' },
          { id: 'm-st4', title: 'Hessian Matrix Second Derivative Test', status: 'Not Started' }
        ],
        youtubeLinks: []
      }
    ],
    driveAttachments: []
  }
];

// Initial Exams & Assignments (Deadline Radar)
const initialDeadlines = [
  {
    id: 'dl-1',
    type: 'exam',
    title: 'Probability & Statistics Midterm',
    subject: 'Advanced Mathematics & Statistics',
    date: addDaysIso(2, 10),
    room: 'Science Hall 204',
    priority: 'Urgent',
    notes: 'Scientific calculator permitted. Focus on Lagrange multipliers & hypothesis tests.',
    weight: '30% of grade',
    isCompleted: false
  },
  {
    id: 'dl-2',
    type: 'assignment',
    title: 'Data Structures Problem Set 4: AVL Trees',
    subject: 'Computer Science & Algorithms',
    date: addDaysIso(4, 23),
    priority: 'High',
    weight: '15% Homework',
    submissionLink: 'https://classroom.google.com',
    assignmentStatus: 'In Progress',
    notes: 'Implement self-balancing rotations in C++ or Python with unit tests.',
    isCompleted: false
  },
  {
    id: 'dl-3',
    type: 'exam',
    title: 'Algorithms & Graph Theory Final',
    subject: 'Computer Science & Algorithms',
    date: addDaysIso(18, 14),
    room: 'Turing Auditorium A',
    priority: 'High',
    notes: 'Comprehensive exam covering all data structures and DP optimization.',
    weight: '45% of grade',
    isCompleted: false
  },
  {
    id: 'dl-4',
    type: 'assignment',
    title: 'Distributed Raft Key-Value Store Project',
    subject: 'Computer Science & Algorithms',
    date: addDaysIso(12, 18),
    priority: 'Medium',
    weight: '25% Lab Project',
    submissionLink: 'https://github.com',
    assignmentStatus: 'Pending',
    notes: 'Submit GitHub repository URL with pass results for 50-node benchmark.',
    isCompleted: false
  }
];

// Initial Time-Blocked Routine Checklist
const initialRoutineSlots = [
  { id: 'rt-1', timeRange: '08:00 - 10:00', title: 'Deep Work: Algorithms & Data Structures', category: 'Core Study', completed: true },
  { id: 'rt-2', timeRange: '10:30 - 12:00', title: 'Calculus & Linear Algebra Problem Sets', category: 'Core Study', completed: false },
  { id: 'rt-3', timeRange: '13:30 - 14:30', title: 'Spaced Repetition Flashcard Queue', category: 'Revision', completed: true },
  { id: 'rt-4', timeRange: '16:00 - 17:00', title: 'Cardio / Workout Break & Hydration', category: 'Exercise/Break', completed: false },
  { id: 'rt-5', timeRange: '19:00 - 20:30', title: 'Distributed Systems & Go Coding Lab', category: 'Core Study', completed: false }
];

// Initial Weekly Goals
const initialWeeklyGoals = [
  { id: 'wg-1', title: 'Master AVL tree self-balancing rotations and complexity proofs', done: true, weekId: 'current' },
  { id: 'wg-2', title: 'Complete 30 hours of total logged focus study', done: false, weekId: 'current' },
  { id: 'wg-3', title: 'Solve 15 LeetCode Dynamic Programming challenges', done: false, weekId: 'current' }
];

// Initial Skills with 1-5 slider
const initialSkills = [
  {
    id: 'sk-1',
    name: 'Distributed Systems & Go',
    category: 'Backend Architecture',
    levelNum: 4,
    masteryPct: 82,
    hoursLogged: 84,
    tags: ['Go', 'gRPC', 'Docker', 'Raft'],
    milestones: [
      { id: 'm1', title: 'Build in-memory key-value store with replication', done: true, type: 'project' },
      { id: 'm2', title: 'Implement raft consensus state machine', done: true, type: 'project' },
      { id: 'm3', title: 'Stress test 50,000 req/sec benchmark', done: false, type: 'milestone' }
    ]
  },
  {
    id: 'sk-2',
    name: 'Full-Stack React & Vite',
    category: 'Web Engineering',
    levelNum: 5,
    masteryPct: 94,
    hoursLogged: 160,
    tags: ['React', 'TypeScript', 'Tailwind', 'GIS API'],
    milestones: [
      { id: 'm4', title: 'Build zero-backend Google Drive sync architecture', done: true, type: 'project' },
      { id: 'm5', title: 'Design responsive multi-theme dark/OLED UI system', done: true, type: 'milestone' },
      { id: 'm6', title: 'Deploy production SPA to Vercel/GitHub Pages', done: false, type: 'project' }
    ]
  }
];

// Initial Mock Important Links & Bookmarks
const initialImportantLinks = [
  {
    id: 'lnk-1',
    title: 'LeetCode Problem Archive',
    url: 'https://leetcode.com/problemset/all/',
    scope: 'common',
    description: 'Core algorithm and data structure practice problems and contest archives.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'lnk-2',
    title: 'MIT OpenCourseWare - Algorithms (6.006)',
    url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
    scope: 'sub-1',
    description: 'Lecture notes, recitations, homework problem sets and exams.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'lnk-3',
    title: 'MDN Web Docs & JavaScript Reference',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    scope: 'common',
    description: 'Standards, web APIs, JavaScript specifications, and developer guides.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'lnk-4',
    title: 'System Design Primer (GitHub)',
    url: 'https://github.com/donnemartin/system-design-primer',
    scope: 'sub-1',
    description: 'Distributed systems, caching strategies, and scalability diagrams.',
    createdAt: new Date().toISOString()
  }
];

export function DataProvider({ children }) {
  // State: Subjects
  const [subjects, setSubjects] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'subjects');
      return saved ? JSON.parse(saved) : initialSubjects;
    } catch {
      return initialSubjects;
    }
  });

  // State: Exams & Assignment Deadlines
  const [exams, setExams] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'exams');
      return saved ? JSON.parse(saved) : initialDeadlines;
    } catch {
      return initialDeadlines;
    }
  });

  // State: Daily Routine Slots
  const [routineSlots, setRoutineSlots] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'routine_slots');
      return saved ? JSON.parse(saved) : initialRoutineSlots;
    } catch {
      return initialRoutineSlots;
    }
  });

  // State: Weekly Goals
  const [weeklyGoals, setWeeklyGoals] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'weekly_goals');
      return saved ? JSON.parse(saved) : initialWeeklyGoals;
    } catch {
      return initialWeeklyGoals;
    }
  });

  // Daily & Weekly Targets
  const [dailyTargetMinutes, setDailyTargetMinutesState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'daily_target_mins');
      return saved ? Number(saved) : 240; // 4 hours
    } catch {
      return 240;
    }
  });

  const [weeklyTargetHours, setWeeklyTargetHoursState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'weekly_target_hrs');
      return saved ? Number(saved) : 28; // 28 hours
    } catch {
      return 28;
    }
  });

  // Streak & Activity Log
  const [streakData, setStreakData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'streak');
      return saved ? JSON.parse(saved) : {
        streakCount: 14,
        lastActiveDate: todayDateStr(),
        todayHours: 3.5,
        dailyTarget: 4.0,
        weeklyLog: [
          { day: 'Mon', hours: 4.5, target: 4.0 },
          { day: 'Tue', hours: 3.8, target: 4.0 },
          { day: 'Wed', hours: 5.2, target: 4.0 },
          { day: 'Thu', hours: 3.5, target: 4.0 },
          { day: 'Fri', hours: 4.0, target: 4.0 },
          { day: 'Sat', hours: 2.5, target: 4.0 },
          { day: 'Sun', hours: 1.0, target: 4.0 }
        ]
      };
    } catch {
      return {
        streakCount: 14,
        lastActiveDate: todayDateStr(),
        todayHours: 3.5,
        dailyTarget: 4.0,
        weeklyLog: []
      };
    }
  });

  // Skills
  const [skills, setSkills] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'skills');
      return saved ? JSON.parse(saved) : initialSkills;
    } catch {
      return initialSkills;
    }
  });

  // Focus Timer History
  const [timerHistory, setTimerHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'timer_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State: Important Links & Resources
  const [importantLinks, setImportantLinks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'important_links');
      return saved ? JSON.parse(saved) : initialImportantLinks;
    } catch {
      return initialImportantLinks;
    }
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

  // Google Drive & GIS State
  const [googleClientId, setGoogleClientIdState] = useState(() => {
    try {
      return localStorage.getItem('studyflow_google_client_id') || '';
    } catch {
      return '';
    }
  });

  const [driveAccessToken, setDriveAccessToken] = useState(() => {
    try {
      return sessionStorage.getItem('studyflow_drive_token') || null;
    } catch {
      return null;
    }
  });

  const [driveUser, setDriveUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('studyflow_drive_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [driveFolderId, setDriveFolderId] = useState(() => {
    try {
      return localStorage.getItem('studyflow_drive_folder_id') || null;
    } catch {
      return null;
    }
  });

  const [syncStatus, setSyncStatus] = useState('offline');
  const [lastSyncedTime, setLastSyncedTime] = useState(null);
  const syncTimeoutRef = useRef(null);

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
    localStorage.setItem(STORAGE_KEY_PREFIX + 'daily_target_mins', String(val));
    setStreakData(prev => ({ ...prev, dailyTarget: Math.round((val / 60) * 10) / 10 }));
  };

  const setWeeklyTargetHours = (hrs) => {
    const val = Number(hrs) || 10;
    setWeeklyTargetHoursState(val);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'weekly_target_hrs', String(val));
  };

  // Automatic Midnight Rollover Check
  useEffect(() => {
    const checkMidnightRollover = () => {
      const today = todayDateStr();
      const lastRollover = localStorage.getItem(STORAGE_KEY_PREFIX + 'last_rollover_date') || today;

      if (lastRollover !== today) {
        // A new day has dawned!
        // 1. Check if all daily routine items were completed
        const allCompleted = routineSlots.length > 0 && routineSlots.every(s => s.completed);
        if (allCompleted) {
          setStreakData(prev => ({ ...prev, streakCount: prev.streakCount + 1 }));
        }

        // 2. Reset routine items for the new day
        setRoutineSlots(prev => prev.map(s => ({ ...s, completed: false })));

        // 3. Reset today hours to 0
        setStreakData(prev => ({ ...prev, todayHours: 0, lastActiveDate: today }));

        localStorage.setItem(STORAGE_KEY_PREFIX + 'last_rollover_date', today);
      }
    };

    checkMidnightRollover();
    const interval = setInterval(checkMidnightRollover, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [routineSlots]);

  // LocalStorage Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'subjects', JSON.stringify(subjects));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'exams', JSON.stringify(exams));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'routine_slots', JSON.stringify(routineSlots));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'weekly_goals', JSON.stringify(weeklyGoals));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'skills', JSON.stringify(skills));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'streak', JSON.stringify(streakData));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'timer_history', JSON.stringify(timerHistory));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'weekly_target_hrs', String(weeklyTargetHours));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'daily_target_mins', String(dailyTargetMinutes));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'important_links', JSON.stringify(importantLinks));

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
  }, [subjects, exams, routineSlots, weeklyGoals, skills, streakData, timerHistory, weeklyTargetHours, dailyTargetMinutes, importantLinks]);

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
    setDriveUser(null);
    sessionStorage.removeItem('studyflow_drive_token');
    sessionStorage.removeItem('studyflow_drive_user');
    setSyncStatus('offline');
  };

  const syncNowToDrive = async () => {
    if (!driveAccessToken || !driveFolderId) {
      setSyncStatus('offline');
      return;
    }

    try {
      setSyncStatus('syncing');
      await saveStudyDataToDrive(driveAccessToken, driveFolderId, {
        subjects,
        exams,
        routineSlots,
        weeklyGoals,
        skills,
        streakData,
        timerHistory,
        weeklyTargetHours,
        dailyTargetMinutes,
        importantLinks,
        lastSyncedAt: new Date().toISOString()
      });
      setSyncStatus('synced');
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus('unsaved');
    }
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

  // Subjects & Topics Actions
  const addSubject = (newSubject) => {
    const subjectObj = {
      id: 'sub-' + Date.now(),
      name: newSubject.name,
      code: newSubject.code || 'SUB-101',
      color: newSubject.color || '#6366f1',
      targetWeeklyHours: Number(newSubject.targetWeeklyHours) || 10,
      completedHours: 0,
      examDate: newSubject.examDate || addDaysDateStr(30),
      category: newSubject.category || 'General',
      topics: [],
      driveAttachments: []
    };
    setSubjects(prev => [...prev, subjectObj]);
  };

  const deleteSubject = (subjectId) => {
    setSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const updateSubjectName = (subjectId, newName) => {
    if (!newName || !newName.trim()) return;
    setSubjects(prev => prev.map(s => 
      s.id === subjectId ? { ...s, name: newName.trim() } : s
    ));
  };

  const updateSubjectTargetHours = (subjectId, newHours) => {
    const val = Math.max(1, Math.min(100, Number(newHours) || 1));
    setSubjects(prev => prev.map(s => 
      s.id === subjectId ? { ...s, targetWeeklyHours: val } : s
    ));
  };

  const updateSubjectHours = (subjectId, additionalHours) => {
    const hrs = Math.round(additionalHours * 10) / 10;
    setSubjects(prev => prev.map(s => {
      if (s.id === subjectId) {
        return { ...s, completedHours: Math.round((s.completedHours + hrs) * 10) / 10 };
      }
      return s;
    }));

    setStreakData(prev => ({
      ...prev,
      todayHours: Math.round((prev.todayHours + hrs) * 10) / 10
    }));
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
      title,
      status,
      notes,
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
    setRoutineSlots(prev => [...prev, {
      id: 'rt-' + Date.now(),
      timeRange: slot.timeRange || '09:00 - 10:00',
      title: slot.title.trim(),
      category: slot.category || 'Core Study',
      completed: false
    }]);
  };

  const toggleRoutineSlot = (id) => {
    setRoutineSlots(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, completed: !s.completed };
    }));
  };

  const deleteRoutineSlot = (id) => {
    setRoutineSlots(prev => prev.filter(s => s.id !== id));
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

  // Skills Actions
  const addSkill = (newSkill) => {
    setSkills(prev => [...prev, {
      id: 'sk-' + Date.now(),
      name: newSkill.name,
      category: newSkill.category || 'Engineering',
      levelNum: Number(newSkill.levelNum) || 3,
      masteryPct: Number(newSkill.masteryPct) || 50,
      hoursLogged: 0,
      tags: newSkill.tags || ['Skill'],
      milestones: []
    }]);
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

    const hours = session.durationMin / 60;
    if (session.subjectId && session.chapterId) {
      logChapterStudyMinutes(session.subjectId, session.chapterId, session.durationMin);
    } else if (session.subject) {
      const match = subjects.find(s => s.name === session.subject);
      if (match) {
        if (session.chapterId) {
          logChapterStudyMinutes(match.id, session.chapterId, session.durationMin);
        } else {
          updateSubjectHours(match.id, hours);
        }
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
        weeklyGoals,
        addWeeklyGoal,
        toggleWeeklyGoal,
        deleteWeeklyGoal,
        dailyTargetMinutes,
        setDailyTargetMinutes,
        weeklyTargetHours,
        setWeeklyTargetHours,
        skills,
        addSkill,
        updateSkillLevel,
        addSkillMilestone,
        toggleSkillMilestone,
        logSkillHours,
        streakData,
        timerHistory,
        addTimerSession,
        importantLinks,
        addImportantLink,
        deleteImportantLink,
        restoreImportantLink,
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
        syncNowToDrive
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
