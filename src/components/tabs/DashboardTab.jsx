import React, { useMemo, useState, useEffect } from 'react';
import { 
  Flame, 
  Clock, 
  Calendar, 
  BookOpen, 
  TrendingUp, 
  CheckCircle2, 
  Circle, 
  Repeat, 
  Play, 
  Award, 
  Zap, 
  Plus, 
  Layers, 
  ChevronRight, 
  Target, 
  Check, 
  Calendar as CalendarIcon,
  Sparkles 
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import RollingNumber from '../RollingNumber';
import RadialProgressRing from '../RadialProgressRing';
import { celebrateTaskCompletion } from '../../utils/confetti';
import AddRoutineModal from '../AddRoutineModal';
import SyllabusRoutineChip from '../SyllabusRoutineChip';
import SyllabusSyncToast from '../SyllabusSyncToast';
import SkillRoutineChip from '../SkillRoutineChip';
import SkillSyncToast from '../SkillSyncToast';
import ConsistencyRadar from '../ConsistencyRadar';
import { TELEMETRY_URL } from '../../../admin-config.js';
import { syncStudentToLeaderboard } from '../../../leaderboard.js';
import { filterActiveExamDeadlines, getDaysUntilExam } from '../../../exam-radar.js';

/**
 * Applies the selected theme and updates .is-active state on theme selector buttons
 * @param {string} themeId - ID of theme to activate (e.g. 'mocha-lavender', 'cyber-jet')
 * @returns {string} active theme id
 */
export function applySelectedTheme(themeId) {
  if (!themeId) return 'cyberpunk';
  const validTheme = String(themeId).trim();

  // Save to studyflow_app_theme as specified, plus backwards compatible keys
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('studyflow_app_theme', validTheme);
      localStorage.setItem('studyflow_theme', validTheme);
      localStorage.setItem('theme', validTheme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }
  }

  // Update data-theme on root element
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', validTheme);

    // Remove .is-active from all theme buttons
    const allButtons = document.querySelectorAll('.theme-pill, #dashboard-theme-switcher button, [data-theme-id]');
    allButtons.forEach((btn) => {
      btn.classList.remove('is-active');
      const btnTheme = btn.getAttribute('data-theme-id') || btn.getAttribute('data-theme');
      if (btnTheme === validTheme) {
        btn.classList.add('is-active');
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-theme-changed', {
      detail: { theme: validTheme }
    }));
  }

  return validTheme;
}

if (typeof window !== 'undefined') {
  window.applySelectedTheme = applySelectedTheme;
}

export default function DashboardTab({ onNavigateTab }) {
  const navigate = (tab) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (typeof window !== 'undefined' && window.switchView) {
      window.switchView(tab);
    } else if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  const { 
    subjects, 
    exams, 
    skills, 
    streakData, 
    dailyActivity,
    updateSubjectHours, 
    logStudyHours,
    getTodayRevisionQueue,
    completeRevision,
    dailyTargetMinutes,
    routineSlots,
    addRoutineSlot,
    toggleRoutineSlot,
    markSyllabusTopicCompleted,
    markSkillVideoCompleted
  } = useData();

  const { isGoogleAuthenticated, openAuthModal } = useAuth();
  const { theme, setTheme, themes } = useTheme();

  const [isAddRoutineModalOpen, setIsAddRoutineModalOpen] = useState(false);
  const [syllabusPrompt, setSyllabusPrompt] = useState(null);
  const [skillPrompt, setSkillPrompt] = useState(null);
  const [isDiagnosticsExpanded, setIsDiagnosticsExpanded] = useState(false);

  // Ensure on component mount / theme update, currently saved theme in localStorage receives .is-active immediately
  useEffect(() => {
    let activeTheme = theme;
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('studyflow_app_theme') || localStorage.getItem('studyflow_theme');
      if (saved) activeTheme = saved;
    }
    applySelectedTheme(activeTheme);
  }, [theme]);

  const safeSubjects = subjects || [];
  const safeExams = exams || [];
  const safeRoutineSlots = routineSlots || [];
  const safeStreakData = streakData || { streakCount: 0, todayHours: 0 };
  const safeDailyTarget = dailyTargetMinutes || 240;

  // Metrics calculation
  const totalTopics = safeSubjects.reduce((acc, s) => acc + (s.topics || []).length, 0);
  const totalScore = safeSubjects.reduce((acc, s) => {
    return acc + (s.topics || []).reduce((tAcc, t) => {
      if (t.status === 'Mastered') return tAcc + 100;
      if (t.status === 'In Progress') return tAcc + 50;
      return tAcc;
    }, 0);
  }, 0);
  const overallMasteryPct = totalTopics > 0 ? Math.round(totalScore / totalTopics) : 0;

  // Upcoming non-completed active deadlines (strictly >= today local midnight) sorted by date
  const upcomingDeadlines = useMemo(() => {
    const { activeExams } = filterActiveExamDeadlines(safeExams);
    return activeExams
      .filter(e => !e.isCompleted)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [safeExams]);
  const nearestDeadline = upcomingDeadlines[0];

  const getDaysLeft = (targetDate) => {
    return getDaysUntilExam(targetDate);
  };

  const getDynamicBadge = (targetDate, type) => {
    const days = getDaysLeft(targetDate);
    if (days === 0) return { text: 'Today • 0d remaining', class: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' };
    if (days === 1) return { text: 'Tomorrow', class: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    if (days <= 3) return { text: `Urgent! (${days}d)`, class: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    if (days <= 7) return { text: `In ${days} Days`, class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    return { text: `In ${days} Days`, class: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  };

  const todayRevisionQueue = typeof getTodayRevisionQueue === 'function' ? getTodayRevisionQueue() : [];

  // Daily target vs actual calculation
  const actualMinutesToday = Math.round(safeStreakData.todayHours * 60);
  const dailyProgressPct = Math.min(100, Math.round((actualMinutesToday / safeDailyTarget) * 100));

  // Dynamic Motivational Greeting based on user streak and time of day
  const motivationalGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const streak = safeStreakData.streakCount || 0;
    if (streak >= 14) {
      return `Incredible ${streak}-day streak! Ready to dominate today's academic goals?`;
    }
    if (streak >= 7) {
      return `Unstoppable momentum! Ready to crush today's study routine?`;
    }
    if (streak >= 3) {
      return `Strong habit forming! Ready to level up your mastery today?`;
    }
    if (hour >= 5 && hour < 12) {
      return "Rise and grind! Ready to conquer today's study sessions?";
    }
    if (hour >= 12 && hour < 17) {
      return "Afternoon focus zone: Ready to turn effort into academic mastery?";
    }
    if (hour >= 17 && hour < 22) {
      return "Golden hour revision: Ready to finish today's routine strong?";
    }
    return "Night owl focus mode: Ready to lock in today's knowledge?";
  }, [safeStreakData.streakCount]);

  const completedRoutineSlots = safeRoutineSlots.filter(s => s.completed).length;

  // Real-data AI Study Coach & Burnout Diagnostics (defaults to compact 1-line insight bar)
  const coachDiagnostics = useMemo(() => {
    const logged = Number(safeStreakData.todayHours || 0);
    const targetHrs = Number(safeStreakData.dailyTarget || (safeDailyTarget / 60) || 4.0);
    const ratio = targetHrs > 0 ? logged / targetHrs : 0;

    if (logged === 0) {
      return {
        burnoutLevel: 'Fresh & Rested',
        burnoutTone: 'text-emerald-500',
        headline: 'Ready to begin: Launch a 25m Focus Timer session to ignite today’s study momentum.',
        paceNote: `0.0h logged of your ${targetHrs.toFixed(1)}h daily target.`,
        actionLabel: 'Launch Focus Timer',
        actionTab: 'timer'
      };
    }
    if (ratio >= 1.5 || logged >= 10) {
      return {
        burnoutLevel: 'High Fatigue Watch',
        burnoutTone: 'text-rose-500',
        headline: `Heavy focus load (${logged.toFixed(1)}h today) — schedule a 15-minute recovery break to protect retention.`,
        paceNote: `${Math.round(ratio * 100)}% of daily target reached. Prioritize light revision next.`,
        actionLabel: 'Open Revision Queue',
        actionTab: 'revision'
      };
    }
    if (ratio >= 0.85) {
      return {
        burnoutLevel: 'Peak Sustainable Pace',
        burnoutTone: 'text-emerald-500',
        headline: `Strong execution (${logged.toFixed(1)}h / ${targetHrs.toFixed(1)}h) — lock in today’s gains with spaced repetition.`,
        paceNote: `${todayRevisionQueue.length} revision topic${todayRevisionQueue.length === 1 ? '' : 's'} due today.`,
        actionLabel: todayRevisionQueue.length > 0 ? 'Review Due Topics' : 'Log a Mock Test',
        actionTab: todayRevisionQueue.length > 0 ? 'revision' : 'mock-logbook'
      };
    }
    return {
      burnoutLevel: 'Low Risk • Balanced',
      burnoutTone: 'text-indigo-400',
      headline: `${logged.toFixed(1)}h logged so far (${dailyProgressPct}% of ${targetHrs.toFixed(1)}h goal) — stay steady with one more focus block.`,
      paceNote: `${completedRoutineSlots}/${safeRoutineSlots.length} routine blocks completed today.`,
      actionLabel: safeRoutineSlots.length === 0 ? 'Plan Routine' : 'Resume Focus Timer',
      actionTab: safeRoutineSlots.length === 0 ? 'routine' : 'timer'
    };
  }, [safeStreakData.todayHours, safeStreakData.dailyTarget, safeDailyTarget, dailyProgressPct, todayRevisionQueue.length, completedRoutineSlots, safeRoutineSlots.length]);

  const handleQuickLog = () => {
    if (typeof logStudyHours === 'function') {
      logStudyHours(0.5);
    } else if (safeSubjects.length > 0 && updateSubjectHours) {
      updateSubjectHours(safeSubjects[0].id, 0.5);
    }

    // Automatically background-sync +30m study log to real-time Leaderboard (Google-authenticated users only)
    if (isGoogleAuthenticated) {
      const activeSubject = safeSubjects[0]?.name || 'General Studies';
      const nextTodayHours = Number(((safeStreakData.todayHours || 0) + 0.5).toFixed(1));
      const nextWeeklyHours = Number(((safeStreakData.weeklyVelocityHours || 0) + 0.5).toFixed(1));
      const nextStreak = (safeStreakData.streakCount || 0) === 0 ? 1 : safeStreakData.streakCount;
      const updatedSubjects = safeSubjects.map((s, idx) =>
        idx === 0 ? { ...s, completedHours: Number(((s.completedHours || 0) + 0.5).toFixed(1)) } : s
      );

      syncStudentToLeaderboard(
        TELEMETRY_URL,
        {
          subjectsList: updatedSubjects,
          subjects: updatedSubjects,
          dailyActivity,
          streakData: {
            ...safeStreakData,
            todayHours: nextTodayHours,
            weeklyVelocityHours: nextWeeklyHours,
            streakCount: nextStreak
          }
        },
        { activeSubject }
      );
    }
  };

  const handleToggleRoutineSlot = (slotId) => {
    const slot = safeRoutineSlots.find(s => s.id === slotId);
    if (slot && !slot.completed) {
      celebrateTaskCompletion();

      // If linked to a skill video, prompt to mark video watched
      if (slot.linkType === 'skill' || slot.skillLink) {
        const sLink = slot.skillLink;
        if (sLink && (sLink.videoTitle || sLink.videoId)) {
          setSkillPrompt({
            slotId: slot.id,
            skillId: sLink.skillId,
            skillTitle: sLink.skillTitle,
            videoId: sLink.videoId,
            videoTitle: sLink.videoTitle
          });
        }
      }
      // If linked to syllabus, show micro-prompt
      else if (slot.syllabusLink && slot.syllabusLink.topicName) {
        setSyllabusPrompt({
          slotId: slot.id,
          topicName: slot.syllabusLink.topicName,
          subjectId: slot.syllabusLink.subjectId,
          chapterId: slot.syllabusLink.chapterId,
          topicId: slot.syllabusLink.topicId
        });
      }
    }
    if (toggleRoutineSlot) toggleRoutineSlot(slotId);
  };

  const handleMarkDoneSyllabus = (promptData) => {
    if (markSyllabusTopicCompleted && promptData.subjectId) {
      markSyllabusTopicCompleted(promptData.subjectId, promptData.chapterId, promptData.topicId);
      celebrateTaskCompletion();
    }
    setSyllabusPrompt(null);
  };

  const handleMarkWatchedSkill = (promptData) => {
    if (markSkillVideoCompleted && promptData.skillId && promptData.videoId) {
      markSkillVideoCompleted(promptData.skillId, promptData.videoId);
      celebrateTaskCompletion();
    }
    setSkillPrompt(null);
  };

  const handleCompleteRevision = (subjectId, itemId) => {
    celebrateTaskCompletion();
    if (completeRevision) completeRevision(subjectId, itemId);
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full max-w-none mx-0">
      
      {/* Top Banner & Motivation */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 border border-theme-border shadow-glow-card card-glow-hover w-full max-w-none mx-0">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-theme-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
              <Zap className="w-3.5 h-3.5" />
              <span>Deliberate Practice Mode • Peak Retention</span>
            </div>
            
            {/* Dynamic Motivational Headline with Kinetic Letter-by-Letter Fade-In */}
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight flex flex-wrap gap-x-1.5">
              {motivationalGreeting.split(' ').map((word, wordIndex) => (
                <span key={wordIndex} className="inline-block whitespace-nowrap">
                  {word.split('').map((char, charIndex) => {
                    const delay = (wordIndex * 5 + charIndex) * 18;
                    return (
                      <span 
                        key={charIndex} 
                        className="letter-fade-in"
                        style={{ animationDelay: `${delay}ms` }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
              ))}
            </h1>

            <p className="text-sm text-theme-muted leading-relaxed">
              You've logged <span className="font-semibold text-theme-text font-mono-numbers"><RollingNumber value={safeStreakData.todayHours} decimals={1} suffix="h" /></span> of focused study today. 
              <span className="font-semibold text-emerald-400 font-mono-numbers"> <RollingNumber value={todayRevisionQueue.length} /></span> revision topics due today, and <span className="font-semibold text-theme-accent font-mono-numbers"><RollingNumber value={completedRoutineSlots} />/{safeRoutineSlots.length}</span> routine blocks checked off.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-theme-surface/80 border border-theme-border text-xs text-theme-muted font-medium shadow-sm">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Weekly Velocity: <strong className="text-theme-text font-mono-numbers"><RollingNumber value={safeStreakData.weeklyVelocityHours || 0} decimals={1} suffix="h" /> this week</strong></span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('timer')}
              className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all duration-200 hover:brightness-110 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Launch Focus Timer</span>
            </button>
            <button
              onClick={handleQuickLog}
              className="btn-primary-action flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all duration-200 hover:brightness-105 active:scale-95"
              title="Add 30 minutes of study"
            >
              <Plus className="w-3.5 h-3.5 text-theme-accent" />
              <span>+ Log +30m Study</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Strict airy space-y-6 rhythm — Theme Selector moved to Header Dropdown & My Profile) */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-none mx-0">
        {/* Metric 1: Today's Target Circular Mini Card with Interactive SVG Radial Progress Ring */}
        <div 
          onClick={() => navigate('routine')}
          className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-theme-accent/40 card-glow-hover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Daily Target</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline space-x-1.5">
                <span className="font-display font-extrabold text-2xl font-mono-numbers text-theme-text">
                  <RollingNumber value={safeStreakData.todayHours} decimals={1} suffix="h" />
                </span>
                <span className="text-xs text-theme-muted font-medium font-mono-numbers">
                  / {Number(safeStreakData.dailyTarget || (safeDailyTarget / 60) || 4.0).toFixed(1)}h
                </span>
              </div>
              <p className="text-[11px] text-theme-muted mt-1 font-mono-numbers">
                <RollingNumber value={dailyProgressPct} suffix="%" /> goal met
              </p>
            </div>

            {/* Kinetic SVG Radial Progress Ring */}
            <RadialProgressRing 
              percentage={dailyProgressPct} 
              size={58} 
              strokeWidth={5} 
            />
          </div>
        </div>

        {/* Metric 2: Active Streak */}
        <div className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-amber-500/40 card-glow-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Active Streak</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Flame className="w-4 h-4 fill-amber-500 animate-flame-flicker" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="font-display font-extrabold text-2xl sm:text-3xl font-mono-numbers text-amber-500">
                <RollingNumber value={safeStreakData.streakCount} />
              </span>
              <span className="text-xs text-theme-muted font-medium">
                consecutive days
              </span>
            </div>
            <p className="mt-2 text-xs text-theme-muted flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${safeStreakData.streakCount === 0 ? 'bg-amber-400/50' : 'bg-emerald-500'}`}></span>
              <span>{safeStreakData.streakCount === 0 ? "Log a study session to start your streak" : "Study flame burning hot"}</span>
            </p>
          </div>
        </div>

        {/* Metric 3: Next Exam or Assignment */}
        <div 
          onClick={() => navigate('exams')}
          className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-rose-500/40 card-glow-hover transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Next Deadline</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          {nearestDeadline ? (
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="font-display font-extrabold text-2xl font-mono-numbers text-rose-500">
                  {getDaysLeft(nearestDeadline.date) === 0 ? (
                    'Today'
                  ) : (
                    <RollingNumber value={getDaysLeft(nearestDeadline.date)} suffix="d" />
                  )}
                </span>
                <span className="text-xs text-theme-muted font-medium">
                  {getDaysLeft(nearestDeadline.date) === 0 ? '0d remaining' : 'remaining'}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-theme-text truncate" title={nearestDeadline.title}>
                {nearestDeadline.title}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-theme-text">No upcoming deadlines</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('exams');
                }}
                className="mt-2 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Exam</span>
              </button>
            </div>
          )}
        </div>

        {/* Metric 4: Spaced Repetition Due */}
        <div 
          onClick={() => navigate('revision')}
          className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-emerald-500/40 card-glow-hover transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Revision Queue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="font-display font-extrabold text-2xl font-mono-numbers text-emerald-400">
                <RollingNumber value={todayRevisionQueue.length} />
              </span>
              <span className="text-xs text-theme-muted font-mono-numbers">
                {todayRevisionQueue.length === 0 ? "0 topics due today" : "topics due today"}
              </span>
            </div>
            <p className="mt-2 text-xs text-theme-accent font-medium flex items-center justify-between">
              <span>D+1 to D+30 intervals</span>
              <span>Review &rarr;</span>
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible AI Study Coach & Burnout Diagnostics (Defaults to compact 1-line insight bar) */}
      <div
        id="ai-coach-diagnostics-card"
        className="w-full rounded-2xl px-4 sm:px-5 py-3.5 shadow-sm transition-all max-w-none mx-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        {/* Compact 1-Line Insight Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-glow)',
                color: 'var(--text-main)'
              }}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>AI Study Coach</span>
              {!isGoogleAuthenticated && (
                <span
                  id="ai-coach-guest-lock-icon"
                  title="Sign in with Google to unlock personalized AI Study Coach & Burnout Diagnostics"
                  aria-label="Locked for guests"
                  className="opacity-75"
                >
                  🔒
                </span>
              )}
            </span>
            <p className="text-xs sm:text-sm font-medium truncate" style={{ color: 'var(--text-main)' }}>
              {isGoogleAuthenticated
                ? coachDiagnostics.headline
                : 'Sign in with Google to unlock personalized AI Study Coach & Burnout Diagnostics.'}
            </p>
          </div>

          <button
            id="toggle-coach-diagnostics-btn"
            type="button"
            aria-expanded={isDiagnosticsExpanded}
            onClick={() => setIsDiagnosticsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--bg-sidebar)',
              border: '1px solid var(--border-glow)',
              color: 'var(--text-main)'
            }}
          >
            <span>{isDiagnosticsExpanded ? 'Hide Diagnostics ▴' : 'Expand Diagnostics ▾'}</span>
          </button>
        </div>

        {/* Expanded Burnout & Pace Diagnostics Details */}
        {isDiagnosticsExpanded && (
          !isGoogleAuthenticated ? (
            <div
              id="ai-coach-diagnostics-body"
              className="mt-4 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn"
              style={{ borderTop: '1px solid var(--border-glow)' }}
            >
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                  <span>🔒</span>
                  <span>AI Study Coach &amp; Burnout Diagnostics Locked</span>
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sign in with Google to track burnout velocity, pace consistency, and personalized revision recommendations across devices.
                </p>
              </div>
              <button
                id="ai-coach-signin-btn"
                type="button"
                onClick={() => openAuthModal('ai-coach', '#dashboard')}
                className="btn-primary-action px-4 py-2 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: '1.5px solid var(--border-glow)'
                }}
              >
                Sign In with Google
              </button>
            </div>
          ) : (
            <div
              id="ai-coach-diagnostics-body"
              className="mt-4 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn"
              style={{ borderTop: '1px solid var(--border-glow)' }}
            >
              <div
                className="rounded-xl p-3.5 space-y-1"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Burnout Diagnostics
                </span>
                <p className={`text-sm font-extrabold ${coachDiagnostics.burnoutTone}`}>
                  {coachDiagnostics.burnoutLevel}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Calculated strictly from your real daily logged focus hours.
                </p>
              </div>

              <div
                className="rounded-xl p-3.5 space-y-1"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Pace &amp; Consistency
                </span>
                <p className="text-sm font-extrabold font-mono-numbers" style={{ color: 'var(--text-main)' }}>
                  {safeStreakData.weeklyVelocityHours || 0}h this week
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {coachDiagnostics.paceNote}
                </p>
              </div>

              <div
                className="rounded-xl p-3.5 flex flex-col justify-between gap-2"
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Recommended Next Step
                  </span>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                    Keep your streak building with deliberate sessions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(coachDiagnostics.actionTab)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: '1px solid var(--border-glow)'
                  }}
                >
                  {coachDiagnostics.actionLabel} &rarr;
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Consistency Radar: 30-Day Study Activity Vertical Bar Graph */}
      <ConsistencyRadar 
        className="w-full max-w-none mx-0"
        dailyActivity={dailyActivity} 
        streak={safeStreakData.streakCount} 
      />

      {/* Middle Grid: Routine Time-Blocks Checklist + Today's Revision Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-none mx-0">
        
        {/* Daily Routine Time-Blocks Checklist (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-theme-border/60">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-theme-accent" />
                <h2 className="font-display font-bold text-base text-theme-text">Today's Time-Blocked Routine</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-theme-surface border border-theme-border text-theme-muted font-mono-numbers">
                  {completedRoutineSlots}/{safeRoutineSlots.length} Completed
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddRoutineModalOpen(true)}
                  className="p-1 px-2 rounded-lg bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent border border-theme-accent/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Add routine block"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {safeRoutineSlots.map((slot) => (
                <div
                  key={slot.id}
                  onClick={() => handleToggleRoutineSlot(slot.id)}
                  className={`routine-block-item card-glow-hover p-3 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm ${
                    slot.completed
                      ? 'bg-theme-bg/40 border-theme-border/40 text-theme-muted line-through'
                      : slot.carriedOver
                        ? 'bg-theme-surface border-amber-500/30 hover:border-amber-500/50 text-theme-text shadow-glow-amber/5'
                        : 'bg-theme-surface border-theme-border hover:border-theme-accent/40 text-theme-text'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button className="shrink-0">
                      {slot.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                      ) : (
                        <Circle className="w-4 h-4 text-theme-muted" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium truncate">{slot.title}</p>
                        {slot.carriedOver && (
                          <span 
                            className="carried-over-badge inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            title={slot.carriedFromDate ? `Carried over from ${slot.carriedFromDate}` : "Carried over from yesterday"}
                          >
                            ⏳ Carried Over
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-theme-muted font-mono-numbers block">
                        {slot.timeRange}
                      </span>
                      {slot.linkType === 'skill' || slot.skillLink ? (
                        <SkillRoutineChip skillLink={slot.skillLink} />
                      ) : slot.syllabusLink ? (
                        <SyllabusRoutineChip syllabusLink={slot.syllabusLink} subjects={safeSubjects} />
                      ) : null}
                    </div>
                  </div>

                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-theme-bg border border-theme-border text-theme-muted shrink-0">
                    {slot.category}
                  </span>
                </div>
              ))}

              {safeRoutineSlots.length === 0 && (
                <div className="py-8 text-center text-xs text-theme-muted rounded-xl border border-dashed border-theme-border/60 p-4">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-theme-border opacity-50" />
                  <p className="font-medium text-theme-text">No routine blocks scheduled today yet.</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setIsAddRoutineModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-theme-accent text-white font-semibold text-xs inline-flex items-center gap-1 shadow-sm hover:bg-theme-accentHover transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Your First Routine Block</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/60">
            <button
              onClick={() => navigate('routine')}
              className="w-full py-2 px-3 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Manage Daily Routine & Weekly Targets</span>
              <ChevronRight className="w-3.5 h-3.5 text-theme-muted" />
            </button>
          </div>
        </div>

        {/* Spaced Repetition "Today's Revision" Widget (6 cols) */}
        <div className="lg:col-span-6 rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-theme-border/60">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-emerald-400" />
                <h2 className="font-display font-bold text-base text-theme-text">Today's Revision Queue</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono-numbers">
                D+1 • D+3 • D+7 • D+30
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {todayRevisionQueue.map((item) => {
                const stageLabels = ['Stage 1 (D+1)', 'Stage 2 (D+3)', 'Stage 3 (D+7)', 'Stage 4 (D+30)'];
                return (
                  <div 
                    key={item.id}
                    className="revision-card-hover p-3 rounded-xl bg-theme-surface border border-theme-border flex items-start gap-3 hover:border-theme-accent/40 transition-all shadow-sm"
                  >
                    <button 
                      onClick={() => handleCompleteRevision(item.subjectId, item.id)}
                      className="mt-0.5 w-4 h-4 rounded border-2 border-theme-muted hover:border-emerald-400 flex items-center justify-center transition-colors group shrink-0"
                      title="Mark reviewed"
                    >
                      <Check className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-theme-text truncate">
                          {item.title}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-theme-bg border border-theme-border text-theme-accent shrink-0">
                          {stageLabels[item.repetitionStage] || 'Mastery'}
                        </span>
                      </div>
                      <span className="text-[10px] text-theme-muted truncate block mt-0.5">
                        {item.subjectName}
                      </span>
                    </div>
                  </div>
                );
              })}

              {todayRevisionQueue.length === 0 && (
                <div className="py-8 text-center text-theme-muted text-xs rounded-xl border border-dashed border-theme-border/60 p-4">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-semibold text-theme-text">0 topics due for revision today</p>
                  <p className="mt-0.5">Add subjects &amp; chapters to automatically build your D+1 to D+30 spaced-repetition queue.</p>
                  <button
                    onClick={() => navigate('syllabus')}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-text font-semibold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-theme-accent" />
                    <span>+ Add Study Topics</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/60">
            <button
              onClick={() => navigate('revision')}
              className="w-full py-2 px-3 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors flex items-center justify-center gap-1.5"
            >
              <span>View Full Spaced Repetition Schedule</span>
              <ChevronRight className="w-3.5 h-3.5 text-theme-muted" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Deadline Radar Cards + Quick Calendar Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-none mx-0">
        
        {/* Deadline Radar Preview */}
        <div className="rounded-2xl glass-panel p-6 border border-theme-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-400" />
              Exam & Assignment Radar
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('exams')}
                className="btn-schedule-exam flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                title="Schedule an upcoming test or assignment"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Schedule Exam</span>
              </button>
              <button 
                onClick={() => navigate('exams')}
                className="text-xs text-theme-accent hover:underline font-medium"
              >
                View radar ({upcomingDeadlines.length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {upcomingDeadlines.slice(0, 3).map((item) => {
              const badge = getDynamicBadge(item.date, item.type);
              const isAssignment = item.type === 'assignment';
              return (
                <div 
                  key={item.id}
                  onClick={() => navigate('exams')}
                  className="exam-card p-3.5 rounded-xl bg-theme-surface/70 border border-theme-border flex items-center justify-between gap-3 hover:border-theme-accent/30 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-theme-text truncate">
                        {item.title}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${badge.class}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-[11px] text-theme-muted mt-0.5">
                      {item.subject} • {isAssignment ? 'Assignment' : 'Exam'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display font-bold text-base font-mono-numbers text-rose-400">
                      {getDaysLeft(item.date)}d
                    </span>
                    <span className="block text-[10px] text-theme-muted">left</span>
                  </div>
                </div>
              );
            })}

            {upcomingDeadlines.length === 0 && (
              <div className="py-8 text-center text-xs text-theme-muted rounded-xl border border-dashed border-theme-border/70 p-4">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-theme-border opacity-50" />
                <p className="font-semibold text-theme-text">Radar clear. No pending tests or assignments.</p>
                <button
                  onClick={() => navigate('exams')}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Exam</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Calendar Quick Launch */}
        <div className="rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-theme-accent" />
                Monthly Schedule & Agenda
              </h2>
              <button 
                onClick={() => navigate('calendar')}
                className="text-xs text-theme-accent hover:underline font-medium"
              >
                Open Calendar &rarr;
              </button>
            </div>
            <p className="text-xs text-theme-muted leading-relaxed">
              Visualize your upcoming test dates, homework deadlines, and spaced repetition review curves synchronized on a full monthly grid.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-theme-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Exams
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Assignments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> Repetitions
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/60">
            <button
              onClick={() => navigate('calendar')}
              className="w-full py-2.5 px-3 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors flex items-center justify-center gap-1.5"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-theme-accent" />
              <span>Launch Interactive Calendar</span>
            </button>
          </div>
        </div>

      </div>

      {/* Syllabus Sync Micro-Prompt Toast */}
      <SyllabusSyncToast
        promptData={syllabusPrompt}
        onMarkDone={handleMarkDoneSyllabus}
        onOnlyRoutine={() => setSyllabusPrompt(null)}
      />

      {/* Skill Sync Micro-Prompt Toast */}
      <SkillSyncToast
        promptData={skillPrompt}
        onMarkWatched={handleMarkWatchedSkill}
        onOnlyRoutine={() => setSkillPrompt(null)}
      />

      {/* Add Slot Modal with Syllabus & Skill Pickers */}
      <AddRoutineModal
        isOpen={isAddRoutineModalOpen}
        onClose={() => setIsAddRoutineModalOpen(false)}
        onAddSlot={(newBlock) => addRoutineSlot(newBlock)}
        subjects={safeSubjects}
        skills={skills}
      />

    </div>
  );
}
