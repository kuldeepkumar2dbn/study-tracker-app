import React, { useState } from 'react';
import { 
  Repeat, 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Brain, 
  Sparkles, 
  Clock, 
  ArrowRight,
  TrendingUp,
  Check,
  CheckSquare
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import RollingNumber from '../RollingNumber';
import AnimatedHeadline from '../AnimatedHeadline';
import { celebrateTaskCompletion } from '../../utils/confetti';

export default function RevisionTab() {
  const { subjects, completeRevision, getTodayRevisionQueue } = useData();
  const [filterStage, setFilterStage] = useState('All');

  const todayQueue = getTodayRevisionQueue();

  const getStageMeta = (stage = 0) => {
    switch (stage) {
      case 0: return { label: 'Stage 1 (D+1)', desc: '24h quick recall', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 1: return { label: 'Stage 2 (D+3)', desc: '3-day consolidation', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 2: return { label: 'Stage 3 (D+7)', desc: '1-week long-term bridge', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
      case 3: return { label: 'Stage 4 (D+30)', desc: '1-month permanent retention', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      default: return { label: 'Mastered', desc: 'Permanent memory', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    }
  };

  // All topics with scheduled reviews across all subjects
  const allScheduledTopics = subjects.flatMap(sub => 
    sub.topics.map(t => ({
      ...t,
      subjectId: sub.id,
      subjectName: sub.name,
      subjectColor: sub.color
    }))
  ).filter(t => t.nextReviewDate);

  const filteredTodayQueue = todayQueue.filter(item => {
    if (filterStage === 'All') return true;
    return (item.repetitionStage || 0) === Number(filterStage);
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="w-6 h-6 text-emerald-400 shrink-0" />
            <AnimatedHeadline 
              text="Spaced Repetition Revision Queue" 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Combat the Ebbinghaus forgetting curve with automated review intervals: <strong className="text-theme-text">D+1</strong>, <strong className="text-theme-text">D+3</strong>, <strong className="text-theme-text">D+7</strong>, and <strong className="text-theme-text">D+30</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-theme-surface border border-theme-border font-mono-numbers">
            <strong className="text-emerald-400 font-bold">
              <RollingNumber value={todayQueue.length} />
            </strong> items due today
          </span>
        </div>
      </div>

      {/* Interval Architecture Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { step: 'D+1', title: '24h Recall', desc: 'Interrupts immediate drop', days: 1 },
          { step: 'D+3', title: '3-Day Retest', desc: 'Consolidates synapses', days: 3 },
          { step: 'D+7', title: '1-Week Bridge', desc: 'Deep memory storage', days: 7 },
          { step: 'D+30', title: '1-Month Lock', desc: 'Permanent retrieval', days: 30 },
        ].map((int, i) => (
          <div key={int.step} className="p-3.5 rounded-xl glass-panel border border-theme-border flex items-start gap-3 card-glow-hover transition-all">
            <div className="w-8 h-8 rounded-lg bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center font-display font-extrabold text-xs text-theme-accent shrink-0">
              {int.step}
            </div>
            <div>
              <p className="font-semibold text-xs text-theme-text">{int.title}</p>
              <p className="text-[10px] text-theme-muted mt-0.5">{int.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Queue: Today's Action Items */}
      <div className="rounded-2xl glass-panel p-6 border border-theme-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme-border/60">
          <div>
            <h2 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
              <Brain className="w-4 h-4 text-theme-accent" />
              Today's Scheduled Reviews
            </h2>
            <p className="text-xs text-theme-muted">Tick the checkbox when you finish revising a topic to automatically calculate the next interval.</p>
          </div>

          {/* Filter by stage */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-theme-muted text-[11px]">Filter:</span>
            {['All', '0', '1', '2', '3'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStage(st)}
                className={`filter-pill px-2.5 py-1 rounded-lg text-xs font-medium active:scale-95 ${
                  filterStage === st 
                    ? 'bg-theme-accent text-white shadow-sm' 
                    : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {st === 'All' ? 'All Due' : st === '0' ? 'D+1' : st === '1' ? 'D+3' : st === '2' ? 'D+7' : 'D+30'}
              </button>
            ))}
          </div>
        </div>

        {/* List of Due Topics */}
        <div className="space-y-3">
          {filteredTodayQueue.map((item) => {
            const meta = getStageMeta(item.repetitionStage);
            const handleComplete = () => {
              celebrateTaskCompletion();
              completeRevision(item.subjectId, item.id);
            };

            return (
              <div
                key={item.id}
                className="revision-card-hover card-glow-hover p-4 rounded-xl bg-theme-surface border border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Complete Checkbox */}
                  <button
                    onClick={handleComplete}
                    className="mt-0.5 w-5 h-5 rounded-md border-2 border-theme-muted/60 hover:border-emerald-400 flex items-center justify-center transition-colors group shrink-0"
                    title="Mark review complete and schedule next repetition"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-xs sm:text-sm text-theme-text">
                        {item.title}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-theme-muted">
                      <span className="font-medium text-theme-text/90" style={{ color: item.subjectColor }}>
                        {item.subjectName}
                      </span>
                      {item.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-sm">{item.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Action confirmation */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span className="text-[11px] text-theme-muted font-mono-numbers">
                    Due Today
                  </span>
                  <button
                    onClick={handleComplete}
                    className="px-3 py-1.5 rounded-xl bg-theme-accent/15 hover:bg-theme-accent text-theme-accent hover:text-white border border-theme-accent/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Reviewed</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTodayQueue.length === 0 && (
            <div className="py-12 text-center text-theme-muted">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400/60" />
              <p className="text-sm font-semibold text-theme-text">All Caught Up for Today!</p>
              <p className="text-xs mt-1">You have reviewed all due topics on your spaced repetition curve.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Schedule Horizon */}
      <div className="rounded-2xl glass-panel p-6 border border-theme-border">
        <h3 className="font-display font-bold text-base text-theme-text mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-theme-accent" />
          Upcoming Memory Retention Schedule
        </h3>

        <div className="space-y-2">
          {allScheduledTopics.slice(0, 6).map((topic) => {
            const meta = getStageMeta(topic.repetitionStage);
            return (
              <div key={topic.id} className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: topic.subjectColor }} />
                  <div className="min-w-0">
                    <p className="font-semibold text-theme-text truncate">{topic.title}</p>
                    <p className="text-[11px] text-theme-muted">{topic.subjectName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono-numbers text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full border ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-theme-muted">
                    Next: <strong className="text-theme-text">{topic.nextReviewDate}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
