import React, { useEffect } from 'react';
import { BookOpen, Check, X, Sparkles } from 'lucide-react';

export default function SyllabusSyncToast({
  promptData,
  onMarkDone,
  onOnlyRoutine
}) {
  useEffect(() => {
    if (!promptData) return;
    // Auto-dismiss after 12 seconds (defaults to Only Routine)
    const timer = setTimeout(() => {
      onOnlyRoutine();
    }, 12000);
    return () => clearTimeout(timer);
  }, [promptData, onOnlyRoutine]);

  if (!promptData) return null;

  const topicName = promptData.topicName || 'this topic';

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-slideUp"
      data-testid="syllabus-sync-toast"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glass-dropdown p-4 rounded-2xl border border-emerald-500/40 shadow-2xl bg-theme-surface/95 backdrop-blur-xl space-y-3 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-theme-text flex items-center gap-1.5">
                <span>Routine block checked!</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h4>
              <p className="text-xs text-theme-muted mt-0.5 leading-snug">
                Mark <strong className="text-emerald-400 font-semibold">"{topicName}"</strong> as completed in your Syllabus too?
              </p>
            </div>
          </div>

          <button
            onClick={onOnlyRoutine}
            className="text-theme-muted hover:text-theme-text p-1 rounded-lg hover:bg-theme-cardHover transition-colors shrink-0"
            title="Dismiss (Only Routine)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 relative z-10">
          <button
            type="button"
            id="cancel-syllabus-sync-btn"
            onClick={onOnlyRoutine}
            className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text text-xs font-semibold transition-colors"
          >
            Only Routine
          </button>

          <button
            type="button"
            id="confirm-syllabus-mark-done-btn"
            onClick={() => onMarkDone(promptData)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Yes, Mark Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
