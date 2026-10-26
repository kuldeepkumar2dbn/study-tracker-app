/**
 * Isolated 7-Minute Demo Sandbox Template Data
 * Provides a pristine, complete academic template for instant demo exploration.
 */
import { getLocalDateString } from './dateUtils.js';

export const DEMO_STORAGE_PREFIX = 'demo_tracker_data_';
export const DEMO_SESSION_DURATION_MS = 7 * 60 * 1000; // 7 minutes

export const DEMO_KEYS = {
  IS_DEMO: 'is_demo_user',
  END_TIME: 'demo_session_end'
};

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

export function getFreshDemoTemplateData() {
  const subjects = [
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
          notes: 'Redis cluster cache-aside and consistent hashing rings.',
          repetitionStage: 0, 
          lastReviewedDate: addDaysDateStr(-10),
          nextReviewDate: todayDateStr(),
          subtopics: [
            { id: 'cs-st7', title: 'Consistent Hashing Rings & Virtual Nodes', status: 'Mastered' },
            { id: 'cs-st8', title: 'Cache Aside vs Read/Write Through Strategies', status: 'Not Started' }
          ],
          youtubeLinks: []
        }
      ],
      driveAttachments: []
    },
    {
      id: 'sub-2',
      name: 'Advanced Mathematics & Statistics',
      code: 'MATH-240',
      color: '#10b981',
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

  const exams = [
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

  const routine_slots = [
    { id: 'rt-1', timeRange: '08:00 - 10:00', title: 'Deep Work: Algorithms & Data Structures', category: 'Core Study', completed: true },
    { id: 'rt-2', timeRange: '10:30 - 12:00', title: 'Calculus & Linear Algebra Problem Sets', category: 'Core Study', completed: false },
    { id: 'rt-3', timeRange: '13:30 - 14:30', title: 'Spaced Repetition Flashcard Queue', category: 'Revision', completed: true },
    { id: 'rt-4', timeRange: '16:00 - 17:00', title: 'Cardio / Workout Break & Hydration', category: 'Exercise/Break', completed: false },
    { id: 'rt-5', timeRange: '19:00 - 20:30', title: 'Distributed Systems & Go Coding Lab', category: 'Core Study', completed: false }
  ];

  const weekly_goals = [
    { id: 'wg-1', title: 'Master AVL tree self-balancing rotations and complexity proofs', done: true, weekId: 'current' },
    { id: 'wg-2', title: 'Complete 30 hours of total logged focus study', done: false, weekId: 'current' },
    { id: 'wg-3', title: 'Solve 15 LeetCode Dynamic Programming challenges', done: false, weekId: 'current' }
  ];

  const skills = [
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

  const streak = {
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

  const important_links = [
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

  const notes = [
    {
      id: 'note-1',
      title: 'AVL Trees & Self-Balancing Invariants',
      subject: 'Computer Science & Algorithms',
      folder: 'Algorithms',
      tags: ['Trees', 'AVL', 'DataStructures'],
      content: `# AVL Tree Rotations & Invariants\n\n### Balance Factor\nBalance factor $BF = height(left) - height(right)$. Valid AVL range is $\\{-1, 0, 1\\}$.\n\n### Rotations Overview:\n- **Left-Left (LL)**: Single Right Rotation\n- **Right-Right (RR)**: Single Left Rotation\n- **Left-Right (LR)**: Left rotate child, then Right rotate parent\n- **Right-Left (RL)**: Right rotate child, then Left rotate parent\n\n### Complexity:\n- Search: $O(\\log n)$\n- Insert: $O(\\log n)$\n- Delete: $O(\\log n)`,
      isStarred: true,
      driveFileId: null,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'note-2',
      title: 'Dynamic Programming Tabulation & Knapsack',
      subject: 'Computer Science & Algorithms',
      folder: 'Algorithms',
      tags: ['DP', 'Knapsack', 'Optimization'],
      content: `# Dynamic Programming Tabulation\n\n1. State Definition: \`dp[i][w]\` represents max profit using prefix \`i\` items with capacity \`w\`.\n2. Recurrence:\n   \`dp[i][w] = max(dp[i-1][w], dp[i-1][w - wt[i]] + val[i])\`\n3. Base Case:\n   \`dp[0][w] = 0\` for all \`w\`.\n4. Space Optimization:\n   Rolling 1D array backwards from \`W\` down to \`wt[i]\`.`,
      isStarred: true,
      driveFileId: null,
      updatedAt: new Date().toISOString()
    }
  ];

  return {
    subjects,
    exams,
    routine_slots,
    weekly_goals,
    skills,
    streak,
    daily_target_mins: 240,
    weekly_target_hrs: 28,
    important_links,
    notes,
    timer_history: [],
    drive_files: []
  };
}
