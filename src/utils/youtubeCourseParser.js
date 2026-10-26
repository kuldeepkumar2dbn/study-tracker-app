/**
 * YouTube Course Parser & Level-Wise Curriculum Generator
 * StudyFlow Skill Tracker
 *
 * Provides:
 * - YouTube Video/Playlist URL detection and ID extraction
 * - YouTube oEmbed metadata extraction with network fallback
 * - Chapter / Timestamp text parsing (e.g. "01:25 Introduction")
 * - Automated 3-tier level course generation:
 *     Level 1: Basics & Foundations
 *     Level 2: Core Concepts
 *     Level 3: Advanced & Real-World Projects
 * - 2-4 Actionable subtopics & deliberate practice checkboxes per lecture
 * - Direct YouTube jump links with timestamp parameters (?t=...)
 */

import { extractYouTubeId } from './youtube.js';

/**
 * Extracts playlist ID from URL
 */
export function extractPlaylistId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

/**
 * Clean course title from video/playlist URL if oEmbed is unavailable
 */
export function deriveTitleFromUrl(url) {
  try {
    const videoId = extractYouTubeId(url);
    const playlistId = extractPlaylistId(url);
    if (videoId) return `YouTube Video Course (${videoId})`;
    if (playlistId) return `YouTube Playlist Course (${playlistId.slice(0, 8)}...)`;
    return 'Mastery Course from YouTube';
  } catch {
    return 'Mastery Course from YouTube';
  }
}

/**
 * Fetches course metadata from YouTube oEmbed API
 */
export async function fetchYouTubeOEmbed(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  try {
    // Try standard YouTube oEmbed endpoint
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || '',
        authorName: data.author_name || 'YouTube Creator',
        authorUrl: data.author_url || '',
        thumbnailUrl: data.thumbnail_url || '',
        html: data.html || ''
      };
    }
  } catch (err) {
    console.warn('YouTube oEmbed fetch error (network or CORS limitation):', err);
  }

  // Fallback metadata if oEmbed fetch is blocked by CORS or offline
  const videoId = extractYouTubeId(cleanUrl);
  return {
    title: deriveTitleFromUrl(cleanUrl),
    authorName: 'YouTube Creator',
    authorUrl: cleanUrl,
    thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '',
    html: ''
  };
}

/**
 * Convert timestamp string (e.g. "01:25", "1:30:15") to total seconds
 */
export function timestampToSeconds(timestampStr) {
  if (!timestampStr) return 0;
  const parts = timestampStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Parse manual or copied chapter list from video description
 * Matches lines like:
 * "00:00 - Introduction & Prerequisites"
 * "12:45 Setting up the Project"
 * "1:05:20 Connecting to Database"
 */
export function parseChaptersFromText(rawText, baseVideoUrl = '') {
  if (!rawText || typeof rawText !== 'string') return [];

  const videoId = extractYouTubeId(baseVideoUrl);
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const chapters = [];

  // Regex to detect timestamps like (00:00), 00:00, 1:23:45, [12:30]
  const timestampRegex = /(?:\[|\()?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\]|\))?/;

  for (const line of lines) {
    const match = line.match(timestampRegex);
    if (match) {
      const fullTimestamp = match[0].replace(/[\[\]\(\)]/g, '');
      const seconds = timestampToSeconds(fullTimestamp);

      // Clean title: remove the timestamp, leading/trailing punctuation, dashes, numbers
      let title = line.replace(match[0], '').replace(/^[\s\-–—:.]+/, '').replace(/[\s\-–—:.]+$/, '').trim();
      if (!title) title = `Chapter @ ${fullTimestamp}`;

      const watchUrl = videoId 
        ? `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`
        : (baseVideoUrl || '#');

      chapters.push({
        title,
        timestamp: fullTimestamp,
        seconds,
        youtubeUrl: watchUrl
      });
    }
  }

  return chapters;
}

/**
 * Domain-specific syllabus templates when no explicit chapters are provided
 */
function getSyllabusTemplateByTopic(title = '') {
  const t = title.toLowerCase();

  if (t.includes('react') || t.includes('next') || t.includes('vue') || t.includes('frontend')) {
    return [
      {
        title: 'Environment Setup, Project Scaffolding & Core Architecture',
        subtopics: [
          'Initialize workspace with Vite/Next.js and explore folder structure',
          'Understand JSX/Virtual DOM rendering lifecycle',
          'Configure ESLint, Prettier, and Tailwind CSS tokens',
          'Build and mount the first component tree'
        ]
      },
      {
        title: 'Component Architecture, Props & Interactive State Management',
        subtopics: [
          'Deconstruct reusable atomic UI components',
          'Pass unidirectional props and type contracts',
          'Implement useState and handle synthetic browser events',
          'Practice: Build an interactive state-driven calculator'
        ]
      },
      {
        title: 'Side Effects, Data Fetching & Custom Hooks',
        subtopics: [
          'Master useEffect cleanup and dependency array rules',
          'Fetch and cache external REST/GraphQL API data with loading states',
          'Extract reusable business logic into custom useFetch hook',
          'Practice: Build a live search filter with debounce'
        ]
      },
      {
        title: 'Global State Management & Application Routing',
        subtopics: [
          'Design Context API providers with performance selectors',
          'Set up nested client-side routing and protected view guards',
          'Handle URL search parameters and dynamic slugs',
          'Practice: Persist user session to LocalStorage across page reloads'
        ]
      },
      {
        title: 'Performance Optimization & State Invariants',
        subtopics: [
          'Profile component re-renders with React Profiler',
          'Apply useMemo and useCallback to avoid unnecessary allocations',
          'Implement lazy loading and code-splitting with Suspense',
          'Practice: Optimize a 1,000-item virtualized feed'
        ]
      },
      {
        title: 'Capstone Project: Full-Stack Production Deployment',
        subtopics: [
          'Implement end-to-end CRUD persistence and optimistic UI updates',
          'Audit lighthouse performance, accessibility and responsive design',
          'Configure production bundle build and CI/CD automated pipeline',
          'Deploy live application to cloud hosting (Vercel/Cloudflare)'
        ]
      }
    ];
  }

  if (t.includes('python') || t.includes('django') || t.includes('flask') || t.includes('fastapi')) {
    return [
      {
        title: 'Python Essentials, Virtual Environments & Syntax Foundations',
        subtopics: [
          'Set up pyenv, Poetry/venv, and VS Code debugger',
          'Understand dynamic typing, primitive variables, and memory references',
          'Implement conditional branches, loops, and comprehensions',
          'Practice: Write a command-line financial calculator'
        ]
      },
      {
        title: 'Data Structures, Functions & Functional Paradigms',
        subtopics: [
          'Master lists, tuples, sets, dictionaries, and time complexities',
          'Write modular functions with *args, **kwargs, and type hints',
          'Explore map, filter, lambda expressions, and generators',
          'Practice: Implement a key-value frequency analyzer'
        ]
      },
      {
        title: 'Object-Oriented Programming (OOP) & Design Patterns',
        subtopics: [
          'Construct classes with __init__, dunder methods, and encapsulation',
          'Apply inheritance, abstract base classes, and polymorphism',
          'Implement property getters, setters, and classmethods',
          'Practice: Model a banking ledger with transaction rollback'
        ]
      },
      {
        title: 'File I/O, Error Handling & API Integration',
        subtopics: [
          'Read and stream large JSON, CSV, and binary files with context managers',
          'Handle exceptions gracefully with custom hierarchy classes',
          'Consume external web APIs using requests and httpx',
          'Practice: Build an automated data ingestion scraper'
        ]
      },
      {
        title: 'Asynchronous Programming & Concurrency (Asyncio)',
        subtopics: [
          'Understand event loops, coroutines, and async/await mechanics',
          'Run concurrent background tasks using asyncio.gather',
          'Profile CPU-bound vs I/O-bound bottlenecks',
          'Practice: Build an async web health checker'
        ]
      },
      {
        title: 'Capstone Project: Production REST API / Automation Suite',
        subtopics: [
          'Architect REST endpoints with FastAPI/Flask and Pydantic validation',
          'Integrate SQLite/PostgreSQL database via SQLAlchemy ORM',
          'Write comprehensive unit tests with pytest and test coverage',
          'Containerize application with Dockerfile and deploy to cloud'
        ]
      }
    ];
  }

  if (t.includes('javascript') || t.includes('typescript') || t.includes('node') || t.includes('web dev')) {
    return [
      {
        title: 'Modern JS/TS Syntax, Scopes & Runtime Engine',
        subtopics: [
          'Understand call stack, event loop, and microtask queues',
          'Master const/let scoping, closures, and lexical this',
          'Deconstruct array methods, spread/rest, and destructuring',
          'Practice: Build a custom event emitter class'
        ]
      },
      {
        title: 'Asynchronous Architecture: Promises & Async/Await',
        subtopics: [
          'Write composable Promises and handle rejection chains',
          'Refactor async workflows with try/catch and async/await',
          'Handle parallel requests with Promise.allSettled and timeouts',
          'Practice: Implement a retry-with-exponential-backoff fetcher'
        ]
      },
      {
        title: 'TypeScript Type System & Strict Safety',
        subtopics: [
          'Define interfaces, type aliases, and union/intersection types',
          'Leverage generics for type-safe utility functions',
          'Configure strict tsconfig compiler options',
          'Practice: Type-check an untyped JSON API response payload'
        ]
      },
      {
        title: 'Backend Node.js Runtime & Express Server',
        subtopics: [
          'Create HTTP servers and structured route handlers',
          'Write custom authentication and logging middlewares',
          'Handle file streaming and buffer management',
          'Practice: Implement secure JWT bearer token validation'
        ]
      },
      {
        title: 'Database Persistence & Security Hardening',
        subtopics: [
          'Connect to relational/document database with connection pooling',
          'Sanitize user inputs and prevent SQL/NoSQL injection',
          'Implement CORS policies, rate limiting, and helmet headers',
          'Practice: Build authenticated multi-tenant user accounts'
        ]
      },
      {
        title: 'Capstone Project: Full-Stack Web Application',
        subtopics: [
          'Wire up responsive frontend client to production backend API',
          'Implement WebSocket real-time updates and notifications',
          'Run automated CI testing pipeline with Vitest/Jest',
          'Deploy frontend to edge CDN and backend server to production'
        ]
      }
    ];
  }

  if (t.includes('ai') || t.includes('machine learning') || t.includes('data science') || t.includes('deep learning')) {
    return [
      {
        title: 'Foundations of Data Analysis: NumPy & Pandas',
        subtopics: [
          'Matrix operations, vectorized calculations, and broadcasting',
          'Load, clean, and transform messy tabular datasets in Pandas',
          'Handle missing values, outliers, and type normalization',
          'Practice: Perform Exploratory Data Analysis (EDA) on real-world dataset'
        ]
      },
      {
        title: 'Statistical Modeling & Data Visualization',
        subtopics: [
          'Calculate distributions, standard deviations, and correlations',
          'Plot distribution graphs and heatmaps using Matplotlib & Seaborn',
          'Identify statistical significance and hypothesis testing',
          'Practice: Generate executive visual summary report'
        ]
      },
      {
        title: 'Supervised Learning Algorithms & Feature Engineering',
        subtopics: [
          'Train Linear & Logistic Regression models with Scikit-Learn',
          'Implement Decision Trees and Random Forest ensembles',
          'Perform feature scaling, one-hot encoding, and train-test splits',
          'Practice: Benchmark model accuracy vs baseline metrics'
        ]
      },
      {
        title: 'Model Validation, Cross-Validation & Hyperparameter Tuning',
        subtopics: [
          'Evaluate Confusion Matrix, Precision, Recall, and ROC-AUC curves',
          'Prevent overfitting with k-fold cross validation and regularization',
          'Run GridSearchCV and Bayesian optimization for hyperparameter search',
          'Practice: Optimize model hyperparameters for highest F1-score'
        ]
      },
      {
        title: 'Neural Networks & Deep Learning Architectures',
        subtopics: [
          'Understand forward propagation, loss functions, and backpropagation',
          'Construct multi-layer perceptron (MLP) with PyTorch/TensorFlow',
          'Apply dropout, batch normalization, and Adam optimizers',
          'Practice: Train an image classifier on MNIST/Fashion dataset'
        ]
      },
      {
        title: 'Capstone Project: End-to-End ML Pipeline & API Deployment',
        subtopics: [
          'Serialize trained model weights to ONNX/Joblib',
          'Wrap model inference inside a low-latency FastAPI endpoint',
          'Containerize pipeline with Docker and test throughput',
          'Deploy prediction service to cloud with monitoring hooks'
        ]
      }
    ];
  }

  // Universal Default Syllabus for any technical or creative topic
  return [
    {
      title: 'Prerequisites, Environment Architecture & Core Syntax',
      subtopics: [
        'Review course objectives, toolchains, and runtime setup',
        'Understand foundational terminology and system paradigms',
        'Execute basic syntax commands and verify console outputs',
        'Practice: Create hello-world baseline milestone'
      ]
    },
    {
      title: 'Essential Building Blocks & Foundational Mechanics',
      subtopics: [
        'Deconstruct primitive building blocks and operational logic',
        'Apply conditional logic and data processing rules',
        'Structure code into reusable functions and modular units',
        'Practice: Implement deliberate practice exercise #1'
      ]
    },
    {
      title: 'Intermediate Concepts & Practical Application',
      subtopics: [
        'Explore idiomatic patterns and community best practices',
        'Integrate external libraries and data sources',
        'Debug edge cases and implement robust error recovery',
        'Practice: Complete guided hands-on project walkthrough'
      ]
    },
    {
      title: 'Advanced Architecture, Optimization & Testing',
      subtopics: [
        'Examine high-performance patterns and memory footprint',
        'Apply refactoring principles for code maintainability',
        'Write automated tests validating input/output contracts',
        'Practice: Benchmark performance under simulated load'
      ]
    },
    {
      title: 'Security, Ecosystem Tooling & Production Readiness',
      subtopics: [
        'Audit configurations against security standards',
        'Set up continuous validation and build scripts',
        'Implement logging, observability, and telemetry',
        'Practice: Resolve realistic production issue scenario'
      ]
    },
    {
      title: 'Capstone Project: Comprehensive Real-World Deliverable',
      subtopics: [
        'Design complete specification and milestone breakdown',
        'Implement end-to-end functionality following clean code standards',
        'Document architecture and create showcase demo',
        'Publish deliverable to portfolio / GitHub repository'
      ]
    }
  ];
}

/**
 * Builds a structured, level-wise course roadmap from YouTube URL and parsed inputs
 */
export async function generateYouTubeCourseRoadmap({
  url,
  customTitle = '',
  category = 'Engineering',
  levelStructure = 'auto', // 'auto' | 'custom'
  customModuleNames = [],
  chaptersText = '',
  tags = []
}) {
  const cleanUrl = (url || '').trim();
  const videoId = extractYouTubeId(cleanUrl);
  const playlistId = extractPlaylistId(cleanUrl);

  // 1. Fetch oEmbed metadata
  let oEmbedData = null;
  if (cleanUrl) {
    oEmbedData = await fetchYouTubeOEmbed(cleanUrl);
  }

  const finalTitle = customTitle.trim() || oEmbedData?.title || deriveTitleFromUrl(cleanUrl);
  const authorName = oEmbedData?.authorName || 'YouTube Educator';
  const thumbnailUrl = oEmbedData?.thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '');

  // 2. Parse chapters if provided
  let parsedLectures = [];
  if (chaptersText && chaptersText.trim()) {
    const rawChapters = parseChaptersFromText(chaptersText, cleanUrl);
    if (rawChapters.length > 0) {
      parsedLectures = rawChapters.map((ch, idx) => ({
        id: `lec-${Date.now()}-${idx + 1}`,
        title: ch.title,
        timestamp: ch.timestamp,
        seconds: ch.seconds,
        youtubeUrl: ch.youtubeUrl,
        duration: ch.timestamp ? `@ ${ch.timestamp}` : 'Full Lesson',
        subtopics: [
          { id: `st-${Date.now()}-${idx}-1`, title: `Watch and take notes: ${ch.title}`, done: false },
          { id: `st-${Date.now()}-${idx}-2`, title: 'Code along with the instructor demonstration', done: false },
          { id: `st-${Date.now()}-${idx}-3`, title: 'Complete practical practice exercise & verify code', done: false }
        ]
      }));
    }
  }

  // 3. If no chapters parsed, generate using topic-specific templates
  if (parsedLectures.length === 0) {
    const templates = getSyllabusTemplateByTopic(finalTitle);
    parsedLectures = templates.map((tmpl, idx) => {
      // Direct jump link with simulated progressive timestamps or base video url
      const simulatedSeconds = idx * 600; // 10 min increments
      const watchUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}&t=${simulatedSeconds}s`
        : (cleanUrl || 'https://www.youtube.com');

      return {
        id: `lec-${Date.now()}-${idx + 1}`,
        title: `Lecture ${idx + 1}: ${tmpl.title}`,
        youtubeUrl: watchUrl,
        duration: 'Lesson Block',
        subtopics: tmpl.subtopics.map((stTitle, sIdx) => ({
          id: `st-${Date.now()}-${idx}-${sIdx + 1}`,
          title: stTitle,
          done: false
        }))
      };
    });
  }

  // 4. Divide lectures into logical tiers / levels
  let levels = [];

  if (levelStructure === 'custom' && customModuleNames.length > 0) {
    // Distribute across custom modules
    const numModules = customModuleNames.length;
    const itemsPerModule = Math.ceil(parsedLectures.length / numModules);

    levels = customModuleNames.map((modName, mIdx) => {
      const sliceStart = mIdx * itemsPerModule;
      const sliceEnd = sliceStart + itemsPerModule;
      const modLectures = parsedLectures.slice(sliceStart, sliceEnd);

      return {
        id: `lvl-${Date.now()}-${mIdx + 1}`,
        title: modName || `Module ${mIdx + 1}`,
        description: `Deliberate practice exercises and milestone objectives for ${modName}.`,
        lectures: modLectures
      };
    });
  } else {
    // Standard 3-Tier Division (Beginner -> Intermediate -> Advanced)
    const total = parsedLectures.length;
    const tier1Count = Math.max(1, Math.round(total / 3));
    const tier2Count = Math.max(1, Math.round((total - tier1Count) / 2));

    const tier1Lectures = parsedLectures.slice(0, tier1Count);
    const tier2Lectures = parsedLectures.slice(tier1Count, tier1Count + tier2Count);
    const tier3Lectures = parsedLectures.slice(tier1Count + tier2Count);

    levels = [
      {
        id: `lvl-${Date.now()}-1`,
        title: 'Level 1: Basics & Foundations',
        description: 'Prerequisites, environment setup, and fundamental building blocks.',
        tierBadge: 'Novice to Apprentice',
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        lectures: tier1Lectures
      },
      {
        id: `lvl-${Date.now()}-2`,
        title: 'Level 2: Core Concepts',
        description: 'Deep dive into architecture, practical workflows, and idiomatic patterns.',
        tierBadge: 'Intermediate',
        badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        lectures: tier2Lectures
      },
      {
        id: `lvl-${Date.now()}-3`,
        title: 'Level 3: Advanced & Real-World Projects',
        description: 'Production hardening, performance tuning, and capstone deployment.',
        tierBadge: 'Advanced & Expert',
        badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        lectures: tier3Lectures.length > 0 ? tier3Lectures : [
          {
            id: `lec-${Date.now()}-capstone`,
            title: 'Final Capstone Project & Portfolio Submission',
            youtubeUrl: cleanUrl || 'https://www.youtube.com',
            duration: 'Capstone Project',
            subtopics: [
              { id: `st-${Date.now()}-cap-1`, title: 'Design system blueprint and milestone spec', done: false },
              { id: `st-${Date.now()}-cap-2`, title: 'Implement full-scale end-to-end deliverable', done: false },
              { id: `st-${Date.now()}-cap-3`, title: 'Write documentation and publish GitHub repository', done: false }
            ]
          }
        ]
      }
    ];
  }

  // Derive initial tags
  const autoTags = [...new Set([
    'YouTube Course',
    category,
    ...(videoId ? ['Video Course'] : []),
    ...(playlistId ? ['Playlist'] : []),
    ...tags
  ])].slice(0, 5);

  return {
    id: `course-${Date.now()}`,
    name: finalTitle,
    category: category || 'Web Development',
    levelNum: 3,
    masteryPct: 0,
    hoursLogged: 0,
    tags: autoTags,
    isCourse: true,
    youtubeUrl: cleanUrl,
    thumbnailUrl,
    authorName,
    playlistId,
    videoId,
    levels,
    createdAt: new Date().toISOString()
  };
}

/**
 * Calculates current course progress based on checked subtopics
 */
export function calculateCourseProgress(course) {
  if (!course || !course.levels || course.levels.length === 0) {
    return { totalSubtopics: 0, completedSubtopics: 0, percentage: course?.masteryPct || 0 };
  }

  let totalSubtopics = 0;
  let completedSubtopics = 0;

  for (const lvl of course.levels) {
    for (const lec of (lvl.lectures || [])) {
      for (const st of (lec.subtopics || [])) {
        totalSubtopics++;
        if (st.done) completedSubtopics++;
      }
    }
  }

  const percentage = totalSubtopics > 0 
    ? Math.round((completedSubtopics / totalSubtopics) * 100) 
    : (course.masteryPct || 0);

  return {
    totalSubtopics,
    completedSubtopics,
    percentage
  };
}
