import React, { useEffect, useState, useRef } from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';

/**
 * Floating Bottom-Center "Undo" Toast Banner
 * StudyFlow Skill Tracker
 *
 * Requirements:
 * - Floating, bottom-center banner
 * - Message: "[Item Name] deleted."
 * - [Undo Button] that restores the item to exact position
 * - Auto-dismisses after 6 seconds with visual progress bar
 */
export default function UndoToast({
  snapshot,
  onUndo,
  onDismiss,
  duration = 6000
}) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!snapshot) return;

    startTimeRef.current = Date.now();
    setProgress(100);

    const updateBar = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);

      if (elapsed < duration) {
        frameRef.current = requestAnimationFrame(updateBar);
      }
    };

    frameRef.current = requestAnimationFrame(updateBar);

    timerRef.current = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [snapshot, duration, onDismiss]);

  if (!snapshot) return null;

  const itemName = snapshot.name || snapshot.itemData?.name || snapshot.itemData?.title || 'Item';

  return (
    <div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fadeIn"
      style={{ maxWidth: '92vw', width: '420px' }}
    >
      <div className="relative overflow-hidden rounded-2xl glass-dropdown border border-theme-border shadow-2xl p-3.5 bg-theme-surface/95 backdrop-blur-xl">
        
        {/* Content Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
            <p className="text-xs text-theme-text font-medium truncate">
              <span className="font-semibold text-white break-all">"{itemName}"</span> deleted.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white text-xs font-bold shadow-sm transition-transform active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6-Second Auto-Dismiss Countdown Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-theme-border/40 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-theme-accent to-emerald-400 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

      </div>
    </div>
  );
}
