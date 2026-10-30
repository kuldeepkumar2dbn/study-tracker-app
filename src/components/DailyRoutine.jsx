import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Trash2, 
  Flame, 
  Target, 
  TrendingUp, 
  Sparkles, 
  Layers, 
  Calendar,
  Check,
  Zap,
  Edit2,
  X,
  BookOpen
} from 'lucide-react';
import { useData } from '../context/DataContext';
import InlineEdit from './InlineEdit';
import RollingNumber from './RollingNumber';
import AnimatedHeadline from './AnimatedHeadline';
import { celebrateTaskCompletion, celebrateMajorMilestone } from '../utils/confetti';
import AddRoutineModal from './AddRoutineModal';
import TomorrowPlannerModal from './TomorrowPlannerModal';
import SyllabusRoutineChip from './SyllabusRoutineChip';
import SyllabusSyncToast from './SyllabusSyncToast';
import SkillRoutineChip from './SkillRoutineChip';
import SkillSyncToast from './SkillSyncToast';

export default function DailyRoutine() {
  const { 
    subjects,
    skills,
    streakData, 
    dailyTargetMinutes, 
    setDailyTargetMinutes, 
    weeklyTargetHours, 
    setWeeklyTargetHours, 
    routineSlots, 
    addRoutineSlot, 
    toggleRoutineSlot, 
    deleteRoutineSlot, 
    completedRoutineToday = [],
    completeRoutineTask,
    undoCompletedRoutineTask,
    tomorrowPlan = [],
    addTomorrowPlan,
    updateTomorrowPlan,
    deleteTomorrowPlan,
    markSyllabusTopicCompleted,
    markSkillVideoCompleted,
    weeklyGoals, 
    addWeeklyGoal, 
    toggleWeeklyGoal, 
    deleteWeeklyGoal 
  } = useData();

  // Tab view toggle: 'today' | 'tomorrow'
  const [activeRoutineTab, setActiveRoutineTab] = useState('today');
  const [isTomorrowModalOpen, setIsTomorrowModalOpen] = useState(false);
  const [editingTomorrowPlan, setEditingTomorrowPlan] = useState(null);

  // Animation and Completed Today view states
  const [fadingSlotId, setFadingSlotId] = useState(null);
  const [showCompletedToday, setShowCompletedToday] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState(null);

  // Modal, syllabus & skill prompt states
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [syllabusPrompt, setSyllabusPrompt] = useState(null);
  const [skillPrompt, setSkillPrompt] = useState(null);
  const [timeRange, setTimeRange] = useState('08:00 - 10:00');
  const [slotTitle, setSlotTitle] = useState('');
  const [slotCategory, setSlotCategory] = useState('Core Study');

  // Form states for targets & weekly goal
  const [isEditingDailyTarget, setIsEditingDailyTarget] = useState(false);
  const [newDailyMins, setNewDailyMins] = useState(dailyTargetMinutes);

  const [isEditingWeeklyTarget, setIsEditingWeeklyTarget] = useState(false);
  const [newWeeklyHours, setNewWeeklyHours] = useState(weeklyTargetHours);

  const [newWeeklyGoalTitle, setNewWeeklyGoalTitle] = useState('');

  // Daily target vs actual calculations
  const actualMinutesToday = Math.round(streakData.todayHours * 60);
  const dailyProgressPct = Math.min(100, Math.round((actualMinutesToday / dailyTargetMinutes) * 100));

  // Circular progress ring math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (dailyProgressPct / 100) * circumference;

  // Weekly study hours calculation
  const totalWeeklyHoursLogged = streakData.weeklyLog.reduce((acc, d) => acc + (d.hours || 0), 0);
  const weeklyProgressPct = Math.min(100, Math.round((totalWeeklyHoursLogged / weeklyTargetHours) * 100));

  // Slots stats
  const completedSlots = routineSlots.filter(s => s.completed).length;
  const totalSlots = routineSlots.length;
  const allSlotsCompleted = totalSlots > 0 && completedSlots === totalSlots;

  const handleToggleSlot = (id) => {
    const targetSlot = (routineSlots || []).find(s => s.id === id);
    if (!targetSlot) return;

    if (!targetSlot.completed) {
      if (routineSlots.length === 1) {
        celebrateMajorMilestone();
      } else {
        celebrateTaskCompletion();
      }

      // Add a brief 300ms fade-out/slide animation on that routine card
      setFadingSlotId(id);

      setTimeout(() => {
        if (completeRoutineTask) {
          const res = completeRoutineTask(id);
          if (res && res.syllabusUpdated) {
            const subjectName = targetSlot.syllabusLink?.subjectName || 'Syllabus';
            setSyncToastMessage(`🎉 Completed "${targetSlot.title}" & marked Mastered in ${subjectName}!`);
            setTimeout(() => setSyncToastMessage(null), 3500);
          } else {
            setSyncToastMessage(`✓ Finished "${targetSlot.title}"`);
            setTimeout(() => setSyncToastMessage(null), 2500);
          }
        } else {
          toggleRoutineSlot(id);
        }
        setFadingSlotId(null);
      }, 300);
    } else {
      toggleRoutineSlot(id);
    }
  };

  const handleUndoComplete = (id) => {
    if (undoCompletedRoutineTask) {
      undoCompletedRoutineTask(id);
      setSyncToastMessage("↺ Restored task back to active Daily Routine");
      setTimeout(() => setSyncToastMessage(null), 3000);
    }
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

  const handleToggleWeeklyGoal = (id) => {
    const targetGoal = weeklyGoals.find(g => g.id === id);
    if (targetGoal && !targetGoal.done) {
      celebrateTaskCompletion();
    }
    toggleWeeklyGoal(id);
  };

  const handleAddSlot = (e) => {
    e.preventDefault();
    if (!slotTitle.trim()) return;

    addRoutineSlot({
      timeRange: timeRange.trim(),
      title: slotTitle.trim(),
      category: slotCategory
    });

    setSlotTitle('');
    setIsSlotModalOpen(false);
  };

  const handleSaveDailyTarget = (e) => {
    e.preventDefault();
    setDailyTargetMinutes(Number(newDailyMins));
    setIsEditingDailyTarget(false);
  };

  const handleSaveWeeklyTarget = (e) => {
    e.preventDefault();
    setWeeklyTargetHours(Number(newWeeklyHours));
    setIsEditingWeeklyTarget(false);
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newWeeklyGoalTitle.trim()) return;
    addWeeklyGoal(newWeeklyGoalTitle.trim());
    setNewWeeklyGoalTitle('');
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'Core Study': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'Revision': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Problem Solving': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'Exercise/Break': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  const handleOpenAddTomorrowPlan = () => {
    setEditingTomorrowPlan(null);
    setIsTomorrowModalOpen(true);
  };

  const handleEditTomorrowPlan = (plan) => {
    setEditingTomorrowPlan(plan);
    setIsTomorrowModalOpen(true);
  };

  const handleSaveTomorrowPlan = (planData) => {
    if (editingTomorrowPlan) {
      updateTomorrowPlan(editingTomorrowPlan.id, planData);
    } else {
      addTomorrowPlan(planData);
    }
    setIsTomorrowModalOpen(false);
    setEditingTomorrowPlan(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-theme-accent shrink-0" />
            <AnimatedHeadline 
              text={activeRoutineTab === 'tomorrow' ? "Tomorrow's Planner & Study Queue" : "Daily Routine & Weekly Targets"} 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            {activeRoutineTab === 'tomorrow'
              ? "Pre-commit syllabus topics and time-blocks for tomorrow. Auto-merges into your Routine on the next day."
              : "Time-blocked discipline, circular target tracking, and 7-day velocity analytics."}
          </p>
        </div>

        {activeRoutineTab === 'today' ? (
          <button
            onClick={() => setIsSlotModalOpen(true)}
            className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Routine Time-Block</span>
          </button>
        ) : (
          <button
            id="add-tomorrow-plan-btn"
            onClick={handleOpenAddTomorrowPlan}
            className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-xs shadow-glow-amber hover:bg-amber-600 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Plan for Tomorrow</span>
          </button>
        )}
      </div>

      {/* Routine Section Tab / Toggle: [ Today's Routine ] | [ 🌅 Tomorrow's Plan (X items) ] */}
      <div className="flex items-center gap-2 p-1 bg-theme-surface/80 rounded-2xl border border-theme-border w-fit shadow-sm">
        <button
          id="tab-todays-routine"
          type="button"
          onClick={() => setActiveRoutineTab('today')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeRoutineTab === 'today'
              ? 'bg-theme-accent text-white shadow-glow-accent'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Today's Routine</span>
        </button>

        <button
          id="tab-tomorrows-plan"
          type="button"
          onClick={() => setActiveRoutineTab('tomorrow')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeRoutineTab === 'tomorrow'
              ? 'bg-amber-500 text-white shadow-glow-amber'
              : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
          }`}
        >
          <span>🌅 Tomorrow's Plan</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold ${
            activeRoutineTab === 'tomorrow' ? 'bg-black/30 text-white' : 'bg-theme-bg border border-theme-border text-theme-muted'
          }`}>
            ({tomorrowPlan.length} {tomorrowPlan.length === 1 ? 'item' : 'items'})
          </span>
        </button>
      </div>

      {activeRoutineTab === 'tomorrow' ? (
        /* Tomorrow's Plan View */
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Info & Action Header Card */}
          <div className="rounded-2xl glass-panel p-6 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌅</span>
                <h2 className="font-display font-bold text-base text-theme-text">
                  Queued for Tomorrow
                </h2>
              </div>
              <p className="text-xs text-theme-muted mt-1 max-w-2xl leading-relaxed">
                Topics planned here will automatically merge into your Daily Routine when tomorrow begins. A 30-minute advance browser notification will remind you before each block starts.
              </p>
            </div>

            <button
              onClick={handleOpenAddTomorrowPlan}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors shadow-glow-amber flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Plan for Tomorrow</span>
            </button>
          </div>

          {/* Cards of all tasks queued for tomorrow */}
          {tomorrowPlan.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tomorrowPlan.map((plan) => (
                <div
                  key={plan.id}
                  className="tomorrow-plan-card card-glow-hover p-5 rounded-2xl glass-panel border border-theme-border flex flex-col justify-between space-y-4 transition-all"
                >
                  <div className="space-y-3">
                    {/* Top row: Scheduled time & Category badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono-numbers font-semibold text-theme-accent bg-theme-accent/10 px-2.5 py-1 rounded-lg border border-theme-accent/20">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{plan.startTime} - {plan.endTime}</span>
                      </span>

                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadge(plan.category)}`}>
                        {plan.category || 'Core Study'}
                      </span>
                    </div>

                    {/* Task Title */}
                    <h3 className="font-semibold text-sm sm:text-base text-theme-text leading-snug">
                      {plan.title}
                    </h3>

                    {/* Syllabus Link Chip */}
                    {plan.syllabusLink && plan.syllabusLink.subjectName ? (
                      <div className="p-2.5 rounded-xl bg-theme-surface/80 border border-theme-border/80 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-[11px] truncate">
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{plan.syllabusLink.subjectName}</span>
                        </div>
                        <p className="text-[11px] text-theme-muted truncate pl-5">
                          {plan.syllabusLink.chapterName} • <strong className="text-theme-text">{plan.syllabusLink.topicName}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-theme-muted italic">
                        Standard Routine Task (Unlinked)
                      </p>
                    )}

                    {/* Scheduled Date & Calendar Badge */}
                    <div className="flex items-center justify-between gap-2 text-[11px] text-theme-muted font-mono-numbers">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span>Scheduled: {plan.scheduledDate || 'Tomorrow'}</span>
                      </div>
                      {plan.calendarEventId && (
                        <span 
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-medium"
                          title="Synced to Google Calendar (30-min advance reminder)"
                        >
                          📅 Calendar
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="pt-3 border-t border-theme-border/60 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditTomorrowPlan(plan)}
                      className="px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTomorrowPlan(plan.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center rounded-2xl border border-dashed border-theme-border bg-theme-surface/30 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-2xl">
                🌅
              </div>
              <h3 className="font-display font-bold text-base text-theme-text">
                No topics queued for tomorrow yet
              </h3>
              <p className="text-xs text-theme-muted max-w-md mx-auto">
                Get ahead of tomorrow's schedule by picking topics from your syllabus or planning custom focus blocks.
              </p>
              <button
                type="button"
                onClick={handleOpenAddTomorrowPlan}
                className="mt-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors shadow-glow-amber inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Plan for Tomorrow</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Top 2 Cards: Daily Circular Target + Weekly Target Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Study Target Ring Card */}
        <div className="rounded-2xl glass-panel p-6 border border-theme-border card-glow-hover flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-5">
            {/* SVG Circular Ring */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-theme-surface"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="var(--color-accent)"
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display font-extrabold text-2xl text-theme-text font-mono-numbers">
                  <RollingNumber value={dailyProgressPct} suffix="%" />
                </span>
                <span className="text-[10px] text-theme-muted uppercase tracking-wider font-semibold">
                  Today
                </span>
              </div>
            </div>

            {/* Target Breakdown */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-theme-accent" />
                <h3 className="font-display font-bold text-base text-theme-text">Daily Focus Target</h3>
              </div>
              <p className="text-xs text-theme-muted">
                Studied: <strong className="text-theme-text font-mono-numbers">{Math.floor(actualMinutesToday / 60)}h {actualMinutesToday % 60}m</strong>
              </p>
              <p className="text-xs text-theme-muted">
                Goal: <strong className="text-theme-text font-mono-numbers">{Math.floor(dailyTargetMinutes / 60)}h {dailyTargetMinutes % 60}m</strong> ({dailyTargetMinutes} mins)
              </p>
              <div className="pt-1">
                {dailyProgressPct >= 100 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check className="w-3 h-3" /> Target Achieved!
                  </span>
                ) : (
                  <span className="text-[11px] text-theme-muted font-mono-numbers">
                    {Math.max(0, dailyTargetMinutes - actualMinutesToday)}m remaining today
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit Target Button */}
          <div className="self-end sm:self-center shrink-0">
            {isEditingDailyTarget ? (
              <form onSubmit={handleSaveDailyTarget} className="flex items-center gap-2">
                <input
                  type="number"
                  min="30"
                  max="720"
                  step="15"
                  value={newDailyMins}
                  onChange={(e) => setNewDailyMins(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                />
                <button type="submit" className="p-1.5 rounded-lg bg-theme-accent text-white text-xs font-semibold">
                  Save
                </button>
                <button type="button" onClick={() => setIsEditingDailyTarget(false)} className="p-1.5 text-theme-muted hover:text-theme-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsEditingDailyTarget(true)}
                className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Adjust Goal</span>
              </button>
            )}
          </div>
        </div>

        {/* Weekly Target Progress & 7-Day Mini Bar Chart */}
        <div className="rounded-2xl glass-panel p-6 border border-theme-border card-glow-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display font-bold text-base text-theme-text">Weekly Velocity Benchmark</h3>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-theme-muted">Target:</span>
                <InlineEdit
                  type="number"
                  min={1}
                  max={100}
                  value={weeklyTargetHours}
                  onSave={(val) => setWeeklyTargetHours(val)}
                  suffix="h / week"
                  className="text-xs font-bold text-theme-accent hover:underline"
                />
              </div>
            </div>

            <div className="flex items-baseline justify-between text-xs text-theme-muted mb-1.5 font-mono-numbers">
              <span>Monday – Sunday Accumulator</span>
              <span>
                <strong className="text-theme-text text-sm">
                  <RollingNumber value={totalWeeklyHoursLogged} decimals={1} suffix="h" />
                </strong> / {weeklyTargetHours}h (<RollingNumber value={weeklyProgressPct} suffix="%" />)
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-theme-surface overflow-hidden border border-theme-border/40 mb-4">
              <div 
                className="h-full bg-gradient-to-r from-theme-accent to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${weeklyProgressPct}%` }}
              />
            </div>

            {/* 7-Day Mini Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-20 pt-2 border-t border-theme-border/60">
              {streakData.weeklyLog.map((dayItem, idx) => {
                const maxBar = 6;
                const hPct = Math.min(100, (dayItem.hours / maxBar) * 100);
                const isMet = dayItem.hours >= (dailyTargetMinutes / 60);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full bg-theme-surface/70 rounded-t-md overflow-hidden h-14 flex flex-col justify-end">
                      <div 
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isMet ? 'bg-emerald-400' : 'bg-theme-accent/70'
                        }`}
                        style={{ height: `${hPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-theme-muted mt-1 font-mono-numbers group-hover:text-theme-text">
                      {dayItem.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Routine Slots Checklist & Weekly Goals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Time-Blocked Routine Checklist (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl glass-panel p-6 border border-theme-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-theme-border/60">
            <div>
              <h2 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-theme-accent" />
                Time-Blocked Daily Routine
              </h2>
              <p className="text-xs text-theme-muted mt-0.5">
                Completed slots auto-increment study streak upon full daily execution.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span id="routine-remaining-count" className="text-xs px-2.5 py-1 rounded-full bg-theme-surface border border-theme-border font-mono-numbers text-theme-muted">
                {routineSlots.length} remaining {completedRoutineToday.length > 0 && `(${completedRoutineToday.length} done)`}
              </span>
            </div>
          </div>

          {/* Routine items list */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {routineSlots.map((slot) => (
              <div
                key={slot.id}
                id={`routine-slot-${slot.id}`}
                onClick={() => handleToggleSlot(slot.id)}
                className={`routine-block-item card-glow-hover p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  fadingSlotId === slot.id
                    ? 'opacity-0 -translate-x-6 scale-95 pointer-events-none'
                    : slot.completed
                      ? 'bg-theme-bg/50 border-theme-border/50 text-theme-muted'
                      : 'bg-theme-surface border-theme-border hover:border-theme-accent/40 text-theme-text'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button className="shrink-0">
                    {slot.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-theme-muted" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-xs sm:text-sm font-semibold leading-tight ${slot.completed ? 'line-through text-theme-muted' : ''}`}>
                        {slot.title}
                      </p>
                      {slot.carriedOver && (
                        <span 
                          className="carried-over-badge inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full"
                          title="Unfinished task carried over from yesterday"
                        >
                          ⏰ Carried over from yesterday
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-theme-muted font-mono-numbers block mt-0.5">
                      {slot.timeRange}
                    </span>
                    {slot.linkType === 'skill' || slot.skillLink ? (
                      <SkillRoutineChip skillLink={slot.skillLink} />
                    ) : slot.syllabusLink ? (
                      <SyllabusRoutineChip syllabusLink={slot.syllabusLink} subjects={subjects} />
                    ) : null}
                    {slot.calendarEventId && (
                      <div className="mt-1">
                        <span 
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-medium"
                          title="Synced to Google Calendar (30-min advance reminder)"
                        >
                          📅 Calendar Synced
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadge(slot.category)}`}>
                    {slot.category}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoutineSlot(slot.id);
                    }}
                    className="p-1 text-theme-muted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {routineSlots.length === 0 && (
              <div className="py-12 text-center rounded-2xl border border-dashed border-theme-border bg-theme-surface/30 p-6">
                <Clock className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-semibold text-theme-text">No time blocks scheduled today.</p>
                <p className="text-xs text-theme-muted mt-1">No time blocks scheduled today. Click '+ Add Block' to plan your day.</p>
                <button
                  onClick={() => setIsSlotModalOpen(true)}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs hover:bg-theme-accentHover transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Block</span>
                </button>
              </div>
            )}
          </div>

          {/* Optional "Show Completed Today" Toggle */}
          {completedRoutineToday && completedRoutineToday.length > 0 && (
            <div className="pt-3 border-t border-theme-border/60">
              <button
                id="toggle-completed-today-btn"
                type="button"
                onClick={() => setShowCompletedToday(prev => !prev)}
                className="w-full py-2 px-3 rounded-xl bg-theme-surface/70 hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Show Completed Today ({completedRoutineToday.length})</span>
                </span>
                <span className="text-[11px] font-mono-numbers text-theme-muted">
                  {showCompletedToday ? '▲ Hide' : '▼'}
                </span>
              </button>

              {showCompletedToday && (
                <div id="completed-today-list" className="mt-2.5 space-y-2 animate-fadeIn max-h-56 overflow-y-auto pr-1">
                  {completedRoutineToday.map((item) => (
                    <div
                      key={item.id}
                      id={`completed-task-${item.id}`}
                      className="completed-routine-item p-3 rounded-xl bg-theme-bg/50 border border-theme-border/50 flex items-center justify-between gap-3 text-theme-muted"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium line-through text-theme-muted truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-theme-muted/80 font-mono-numbers mt-0.5">
                            <span>{item.timeRange || `${item.startTime} - ${item.endTime}`}</span>
                            {item.syllabusLink && (
                              <span className="truncate text-indigo-400/90">
                                • 📚 {item.syllabusLink.subjectName}: {item.syllabusLink.topicName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        id={`undo-task-${item.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUndoComplete(item.id);
                        }}
                        className="undo-btn px-2.5 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-accent hover:text-theme-accentHover flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-sm"
                        title="Restore task back to active routine"
                      >
                        <span>↺ Undo</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Weekly Goals Checklist (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-theme-border/60 mb-3">
              <h2 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Weekly Milestone Goals
              </h2>
              <span className="text-[10px] text-theme-muted uppercase tracking-wider font-semibold">
                Week {new Date().toLocaleDateString('en-US', { month: 'short' })}
              </span>
            </div>

            <p className="text-xs text-theme-muted mb-3">
              High-priority academic benchmarks to conquer before the weekend:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {weeklyGoals.map((goal) => (
                <div
                  key={goal.id}
                  onClick={() => handleToggleWeeklyGoal(goal.id)}
                  className={`card-glow-hover p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                    goal.done ? 'bg-theme-bg/50 text-theme-muted border-theme-border/50 line-through' : 'bg-theme-surface text-theme-text border-theme-border hover:border-theme-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button className="shrink-0">
                      {goal.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                      ) : (
                        <Circle className="w-4 h-4 text-theme-muted" />
                      )}
                    </button>
                    <span className="truncate">{goal.title}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWeeklyGoal(goal.id);
                    }}
                    className="p-1 text-theme-muted hover:text-rose-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Weekly Goal Form */}
          <form onSubmit={handleAddGoal} className="mt-4 pt-3 border-t border-theme-border/60 flex items-center gap-2">
            <input
              type="text"
              placeholder="Add weekly milestone..."
              value={newWeeklyGoalTitle}
              onChange={(e) => setNewWeeklyGoalTitle(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs flex items-center gap-1 shadow-sm hover:bg-theme-accentHover transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

      </div>
      </>
      )}

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
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        onAddSlot={(newBlock) => addRoutineSlot(newBlock)}
        subjects={subjects}
        skills={skills}
      />

      {/* Tomorrow's Planner Modal */}
      <TomorrowPlannerModal
        isOpen={isTomorrowModalOpen}
        onClose={() => {
          setIsTomorrowModalOpen(false);
          setEditingTomorrowPlan(null);
        }}
        onSave={handleSaveTomorrowPlan}
        editingPlan={editingTomorrowPlan}
        subjects={subjects}
      />

      {/* Dynamic Sync Toast */}
      {syncToastMessage && (
        <div
          id="routine-sync-toast"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl glass-panel border border-emerald-500/30 bg-emerald-950/85 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-slideUp backdrop-blur-md"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

    </div>
  );
}
