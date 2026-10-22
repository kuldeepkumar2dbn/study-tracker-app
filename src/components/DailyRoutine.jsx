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
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useData } from '../context/DataContext';
import InlineEdit from './InlineEdit';

export default function DailyRoutine() {
  const { 
    streakData, 
    dailyTargetMinutes, 
    setDailyTargetMinutes, 
    weeklyTargetHours, 
    setWeeklyTargetHours, 
    routineSlots, 
    addRoutineSlot, 
    toggleRoutineSlot, 
    deleteRoutineSlot, 
    weeklyGoals, 
    addWeeklyGoal, 
    toggleWeeklyGoal, 
    deleteWeeklyGoal 
  } = useData();

  // Form states for new routine slot
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
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
    toggleRoutineSlot(id);
    const targetSlot = routineSlots.find(s => s.id === id);
    // If completing the last slot
    if (!targetSlot?.completed && completedSlots + 1 === totalSlots) {
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }
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
      case 'Exercise/Break': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <Clock className="w-6 h-6 text-theme-accent" />
            Daily Routine & Weekly Targets
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Time-blocked discipline, circular target tracking, and 7-day velocity analytics.
          </p>
        </div>

        <button
          onClick={() => setIsSlotModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Routine Time-Block</span>
        </button>
      </div>

      {/* Top 2 Cards: Daily Circular Target + Weekly Target Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Study Target Ring Card */}
        <div className="rounded-2xl glass-panel p-6 border border-theme-border flex flex-col sm:flex-row items-center gap-6 justify-between">
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
                  {dailyProgressPct}%
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
        <div className="rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
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
                <strong className="text-theme-text text-sm">{totalWeeklyHoursLogged.toFixed(1)}h</strong> / {weeklyTargetHours}h ({weeklyProgressPct}%)
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
              <span className="text-xs px-2.5 py-1 rounded-full bg-theme-surface border border-theme-border font-mono-numbers text-theme-muted">
                {completedSlots} / {totalSlots} Done
              </span>
            </div>
          </div>

          {/* Routine items list */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {routineSlots.map((slot) => (
              <div
                key={slot.id}
                onClick={() => handleToggleSlot(slot.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  slot.completed
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
                    <p className={`text-xs sm:text-sm font-semibold leading-tight ${slot.completed ? 'line-through text-theme-muted' : ''}`}>
                      {slot.title}
                    </p>
                    <span className="text-[11px] text-theme-muted font-mono-numbers block mt-0.5">
                      {slot.timeRange}
                    </span>
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
              <div className="py-8 text-center text-xs text-theme-muted">
                No routine time-blocks added. Click "+ Add Routine Time-Block" above.
              </div>
            )}
          </div>
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
                  onClick={() => toggleWeeklyGoal(goal.id)}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
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

      {/* Add Slot Modal */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">Add Routine Time-Block</h3>
              <button 
                onClick={() => setIsSlotModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Time Range</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08:00 - 10:00 or 14:30 - 16:00"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Block Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Algorithms LeetCode Sprint"
                  value={slotTitle}
                  onChange={(e) => setSlotTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Category</label>
                <select
                  value={slotCategory}
                  onChange={(e) => setSlotCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                >
                  <option value="Core Study">Core Study</option>
                  <option value="Revision">Revision</option>
                  <option value="Exercise/Break">Exercise/Break</option>
                  <option value="Lab Project">Lab Project</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold hover:bg-theme-accentHover shadow-sm"
                >
                  Save Time-Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
