import React from 'react';
import { 
  X, 
  BarChart3, 
  Clock, 
  Video, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles, 
  Plus 
} from 'lucide-react';

export default function ChapterReportCard({
  isOpen,
  onClose,
  subject,
  chapter,
  onUpdateSubTopicStatus,
  onLogStudyMinutes
}) {
  if (!isOpen || !chapter || !subject) return null;

  const subtopics = chapter.subtopics || [];
  const youtubeLinks = chapter.youtubeLinks || [];
  const totalSubtopics = subtopics.length;

  // 1. Mastery Breakdown
  const masteredCount = subtopics.filter(st => st.status === 'Mastered').length;
  const inProgressCount = subtopics.filter(st => st.status === 'In Progress').length;
  const notStartedCount = subtopics.filter(st => st.status === 'Not Started' || !st.status).length;

  // 2. Weighted Score (Mastered = 100%, In Progress = 40%, Not Started = 0%)
  const weightedScore = totalSubtopics > 0
    ? Math.round(((masteredCount * 1.0 + inProgressCount * 0.4) / totalSubtopics) * 100)
    : (chapter.status === 'Mastered' ? 100 : chapter.status === 'In Progress' ? 40 : 0);

  // 3. Automatic Letter Grade
  let grade = 'D';
  let gradeLabel = 'Needs Urgent Attention';
  let gradeColor = 'text-rose-400 bg-rose-500/15 border-rose-500/30';

  if (weightedScore >= 90) {
    grade = 'A+';
    gradeLabel = 'Exam Ready / Mastered';
    gradeColor = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  } else if (weightedScore >= 80) {
    grade = 'A';
    gradeLabel = 'Strong Command';
    gradeColor = 'text-teal-400 bg-teal-500/15 border-teal-500/30';
  } else if (weightedScore >= 65) {
    grade = 'B';
    gradeLabel = 'On Track / Practice Needed';
    gradeColor = 'text-blue-400 bg-blue-500/15 border-blue-500/30';
  } else if (weightedScore >= 50) {
    grade = 'C';
    gradeLabel = 'Moderate Understanding';
    gradeColor = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  }

  // 4. Multi-Segment SVG Donut Math
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89
  const mPct = totalSubtopics > 0 ? (masteredCount / totalSubtopics) : (chapter.status === 'Mastered' ? 1 : 0);
  const pPct = totalSubtopics > 0 ? (inProgressCount / totalSubtopics) : (chapter.status === 'In Progress' ? 1 : 0);
  const nPct = totalSubtopics > 0 ? (notStartedCount / totalSubtopics) : (chapter.status === 'Not Started' ? 1 : 0);

  const mStroke = mPct * circumference;
  const pStroke = pPct * circumference;
  const nStroke = nPct * circumference;

  // Offsets
  const mOffset = 0;
  const pOffset = -mStroke;
  const nOffset = -(mStroke + pStroke);

  // Studied time formatting
  const studiedMinutes = chapter.studiedMinutes || 0;
  const hours = Math.floor(studiedMinutes / 60);
  const mins = studiedMinutes % 60;
  const formattedStudyTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Action Plan Items
  const unmastered = subtopics.filter(st => st.status !== 'Mastered');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-theme-bg border border-theme-border shadow-2xl p-6 sm:p-7 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-theme-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: subject.color || '#6366f1' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-theme-muted">
                {subject.name} • Diagnostic Report
              </span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-theme-text flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-theme-accent shrink-0" />
              {chapter.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-surface text-theme-muted hover:text-theme-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Diagnostic Grid: Donut + Grade + Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          
          {/* SVG Multi-Segment Donut */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-theme-surface/70 border border-theme-border/70 relative">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-theme-surface" strokeWidth="12" />
                {/* Mastered Arc */}
                <circle
                  cx="50" cy="50" r={radius} fill="none" stroke="#10b981" strokeWidth="12"
                  strokeDasharray={`${mStroke} ${circumference}`}
                  strokeDashoffset={mOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                {/* In Progress Arc */}
                <circle
                  cx="50" cy="50" r={radius} fill="none" stroke="#f59e0b" strokeWidth="12"
                  strokeDasharray={`${pStroke} ${circumference}`}
                  strokeDashoffset={pOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                {/* Not Started Arc */}
                <circle
                  cx="50" cy="50" r={radius} fill="none" stroke="#64748b" strokeWidth="12"
                  strokeDasharray={`${nStroke} ${circumference}`}
                  strokeDashoffset={nOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 opacity-40"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-black text-2xl text-theme-text font-mono-numbers">
                  {weightedScore}%
                </span>
                <span className="text-[10px] uppercase font-bold text-theme-muted tracking-wider">
                  Mastery
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 text-[11px] font-medium text-theme-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {masteredCount} Mastered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {inProgressCount} In Prog
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500 opacity-60" />
                {notStartedCount} Pending
              </span>
            </div>
          </div>

          {/* Letter Grade & Summary Badges */}
          <div className="sm:col-span-7 space-y-3.5">
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${gradeColor}`}>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  Readiness Grade
                </span>
                <h3 className="font-display font-extrabold text-2xl tracking-tight">
                  {gradeLabel}
                </h3>
              </div>
              <div className="font-display font-black text-4xl sm:text-5xl px-3 py-1 rounded-2xl bg-black/10 backdrop-blur-sm">
                {grade}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-theme-accent/15 text-theme-accent">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-theme-muted block">Time Invested</span>
                  <span className="font-display font-bold text-sm text-theme-text font-mono-numbers">
                    {formattedStudyTime}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/15 text-rose-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-theme-muted block">Lectures</span>
                  <span className="font-display font-bold text-sm text-theme-text font-mono-numbers">
                    {youtubeLinks.length} Videos
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Log Time Controls */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-surface/50 border border-theme-border text-xs">
              <span className="text-theme-muted text-[11px] font-medium flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-theme-accent" />
                Log Chapter Study:
              </span>
              <div className="flex items-center gap-1.5">
                {[15, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => onLogStudyMinutes(subject.id, chapter.id, mins)}
                    className="px-2 py-0.5 rounded-md bg-theme-surface hover:bg-theme-accent hover:text-white border border-theme-border text-[11px] font-semibold text-theme-text transition-colors"
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Topic-by-Topic Readiness Horizontal Bar Graph */}
        {totalSubtopics > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-theme-accent" />
                Topic-by-Topic Readiness Graph
              </h4>
              <span className="text-[11px] text-theme-muted font-mono-numbers">
                {masteredCount} of {totalSubtopics} Mastered
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {subtopics.map((st) => {
                const pct = st.status === 'Mastered' ? 100 : st.status === 'In Progress' ? 40 : 5;
                const barColor = st.status === 'Mastered' ? 'bg-emerald-400' : st.status === 'In Progress' ? 'bg-amber-400' : 'bg-slate-600/40';

                return (
                  <div key={st.id} className="p-2.5 rounded-xl bg-theme-surface border border-theme-border space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-theme-text truncate pr-2">
                        {st.title}
                      </span>
                      <button
                        onClick={() => {
                          const nextStatus = st.status === 'Mastered' ? 'In Progress' : st.status === 'In Progress' ? 'Not Started' : 'Mastered';
                          onUpdateSubTopicStatus(subject.id, chapter.id, st.id, nextStatus);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 transition-colors ${
                          st.status === 'Mastered' 
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                            : st.status === 'In Progress'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                        }`}
                      >
                        {st.status || 'Not Started'}
                      </button>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-theme-bg overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended Action Plan Box */}
        <div className="p-4 rounded-2xl bg-theme-surface/70 border border-theme-border space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-theme-accent">
            <Sparkles className="w-4 h-4 text-theme-accent" />
            Recommended Action Plan
          </div>

          {unmastered.length > 0 ? (
            <div className="space-y-1.5 text-xs text-theme-muted">
              <p>Focus your next study session on these key pending topics:</p>
              <ul className="space-y-1 pl-1">
                {unmastered.map(st => (
                  <li key={st.id} className="flex items-center gap-2 text-theme-text text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${st.status === 'In Progress' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <span className="truncate">{st.title}</span>
                    <span className="text-[10px] text-theme-muted">({st.status || 'Not Started'})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-emerald-400 font-medium">
              🎉 Outstanding work! All topics in this chapter are Mastered. You are fully exam-ready!
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
