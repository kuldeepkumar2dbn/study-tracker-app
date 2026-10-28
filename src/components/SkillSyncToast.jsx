import React, { useEffect } from 'react';
import { Award, Check, X, Sparkles } from 'lucide-react';

export default function SkillSyncToast({
  promptData,
  onMarkWatched,
  onOnlyRoutine
}) {
  useEffect(() => {
    if (!promptData) return;
    // Auto-dismiss after 12 seconds (defaults to Routine Only)
    const timer = setTimeout(() => {
      onOnlyRoutine();
    }, 12000);
    return () => clearTimeout(timer);
  }, [promptData, onOnlyRoutine]);

  if (!promptData) return null;

  const videoTitle = promptData.videoTitle || 'this lecture';

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-slideUp"
      data-testid="skill-sync-toast"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glass-dropdown p-4 rounded-2xl border border-purple-500/40 shadow-2xl bg-theme-surface/95 backdrop-blur-xl space-y-3 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400 mt-0.5">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-theme-text flex items-center gap-1.5">
                <span>Routine done!</span>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </h4>
              <p className="text-xs text-theme-muted mt-0.5 leading-snug">
                Mark <strong className="text-purple-400 font-semibold">"{videoTitle}"</strong> as watched in Skill Tracker?
              </p>
            </div>
          </div>

          <button
            onClick={onOnlyRoutine}
            className="text-theme-muted hover:text-theme-text p-1 rounded-lg hover:bg-theme-cardHover transition-colors shrink-0"
            title="Dismiss (Routine Only)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 relative z-10">
          <button
            type="button"
            id="cancel-skill-sync-btn"
            onClick={onOnlyRoutine}
            className="px-3 py-1.5 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text text-xs font-semibold transition-colors"
          >
            Routine Only
          </button>
          <button
            type="button"
            id="confirm-skill-mark-watched-btn"
            onClick={() => onMarkWatched(promptData)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark Watched</span>
          </button>
        </div>
      </div>
    </div>
  );
}
