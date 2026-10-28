import React, { useMemo, useState } from 'react';
import { Flame, Calendar, Activity, Zap, Info } from 'lucide-react';
import RollingNumber from './RollingNumber';

/**
 * Consistency Radar (src/components/ConsistencyRadar.jsx)
 * GitHub-Style Study Activity Heatmap
 *
 * Implements:
 * 1. Clean glassmorphic card labeled "Consistency Radar"
 * 2. Visualizes 90 days (13 columns x 7 rows for Mon-Sun)
 * 3. Exact color thresholds:
 *    - 0 mins: slate-800/40
 *    - 1-45 mins: emerald-900/40
 *    - 46-90 mins: emerald-700/60
 *    - 91-180 mins: emerald-500
 *    - 180+ mins: emerald-400 (with glow accent)
 * 4. Hover Tooltip: "[Day, Month Date]: X hours Y mins studied"
 * 5. Header summary: "Active Days: [X] / 90 | Current Streak: [Y] Days"
 */

import { 
  formatHeatmapTooltip, 
  getActivityColorClass, 
  calculateHeatmapMatrix, 
  generateSeedDailyActivity 
} from '../utils/consistencyRadar.js';

export {
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  generateSeedDailyActivity
};

export default function ConsistencyRadar({ dailyActivity = {}, streak = 0, className = '' }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Build the 90 days grid (13 columns x 7 rows for Mon-Sun)
  const matrixData = useMemo(() => {
    return calculateHeatmapMatrix(dailyActivity);
  }, [dailyActivity]);

  const { weeks, activeDaysCount, currentStreak, totalMinutes, monthLabels } = matrixData;
  const effectiveStreak = Math.max(streak || 0, currentStreak);

  const totalHours = (totalMinutes / 60).toFixed(1);
  const rowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div 
      id="consistency-radar-card"
      className={`consistency-radar-card rounded-2xl glass-panel p-6 border border-theme-border shadow-glow-card card-glow-hover relative overflow-hidden transition-all ${className}`}
    >
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Title, Icon & Consistency Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-theme-border/60 relative z-10">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base text-theme-text tracking-tight">
                Consistency Radar
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                90-Day Velocity
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Daily deliberate study momentum & focus habit matrix
            </p>
          </div>
        </div>

        {/* Header Summary: Active Days: [X] / 90 | Current Streak: [Y] Days */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs flex items-center gap-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-theme-accent" />
            <span className="text-theme-muted">Active Days:</span>
            <strong className="text-theme-text font-mono-numbers">
              <RollingNumber value={activeDaysCount} /> / 90
            </strong>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-1.5 shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-flame-flicker" />
            <span className="text-amber-500/90 font-medium">Current Streak:</span>
            <strong className="text-amber-400 font-mono-numbers">
              <RollingNumber value={currentStreak} /> Days
            </strong>
          </div>

          <div className="hidden md:flex px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs items-center gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-theme-muted">Total:</span>
            <strong className="text-emerald-400 font-mono-numbers">
              <RollingNumber value={Number(totalHours)} decimals={1} suffix="h" />
            </strong>
          </div>
        </div>

      </div>

      {/* Grid Container with Horizontal Scroll on mobile */}
      <div className="relative overflow-x-auto pb-2 pt-1">
        <div className="min-w-[620px]">
          
          {/* Month Labels Header Row */}
          <div className="flex items-center text-[10px] text-theme-muted font-medium mb-1 pl-8">
            <div className="grid grid-cols-13 gap-1.5 w-full">
              {Array.from({ length: 13 }).map((_, colIdx) => {
                const month = monthLabels.find(m => m.colIndex === colIdx);
                return (
                  <div key={colIdx} className="text-left truncate h-4">
                    {month ? month.label : ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main 7 Rows (Mon-Sun) x 13 Columns Grid */}
          <div className="flex gap-2">
            
            {/* Left Day-of-Week Row Labels */}
            <div className="flex flex-col justify-between py-0.5 text-[9px] font-semibold text-theme-muted/80 w-6 shrink-0 select-none">
              <span>Mon</span>
              <span className="opacity-0">Tue</span>
              <span>Wed</span>
              <span className="opacity-0">Thu</span>
              <span>Fri</span>
              <span className="opacity-0">Sat</span>
              <span>Sun</span>
            </div>

            {/* Matrix of Squares: 13 columns x 7 rows */}
            <div className="grid grid-flow-col grid-rows-7 gap-1.5 flex-1">
              {weeks.map((week, weekIndex) =>
                week.map((cell, dayIndex) => {
                  const cellId = `heatmap-cell-${cell.dateStr}`;
                  return (
                    <div
                      key={cell.dateStr}
                      id={cellId}
                      tabIndex={0}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onFocus={() => setHoveredCell(cell)}
                      onBlur={() => setHoveredCell(null)}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] border transition-all duration-150 transform hover:scale-125 hover:z-20 cursor-pointer relative ${
                        cell.colorClass
                      } ${cell.isToday ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-theme-bg' : ''}`}
                    />
                  );
                })
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Bottom Footer: Dynamic Hover Tooltip Display + Color Scale Legend */}
      <div className="mt-4 pt-3 border-t border-theme-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        
        {/* Dynamic Tooltip Bar */}
        <div className="min-h-[22px] flex items-center text-xs text-theme-text font-medium">
          {hoveredCell ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-surface border border-theme-accent/30 text-theme-text shadow-sm animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <strong className="font-semibold">{hoveredCell.tooltipText}</strong>
              {hoveredCell.isToday && (
                <span className="text-[10px] uppercase font-bold text-theme-accent px-1.5 py-0.2 rounded bg-theme-accent/15">
                  Today
                </span>
              )}
            </span>
          ) : (
            <span className="text-theme-muted text-[11px] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Hover or tap any square to view exact daily study minutes
            </span>
          )}
        </div>

        {/* Legend Scale: 0 mins -> 1-45m -> 46-90m -> 91-180m -> 180m+ */}
        <div className="flex items-center gap-1.5 text-[10px] text-theme-muted select-none self-end sm:self-auto">
          <span>Less</span>
          <span className="w-3 h-3 rounded-[3px] bg-slate-800/40 border border-slate-700/30" title="0 mins" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-900/40 border border-emerald-800/50" title="1-45 mins" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-700/60 border border-emerald-600/60" title="46-90 mins" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-500 border border-emerald-400/80" title="91-180 mins" />
          <span className="w-3 h-3 rounded-[3px] bg-emerald-400 border border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.7)]" title="180+ mins" />
          <span>More</span>
        </div>

      </div>

    </div>
  );
}
