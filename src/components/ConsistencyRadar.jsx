import React, { useMemo, useState, useEffect } from 'react';
import { Flame, Calendar, BarChart2, Activity, Zap, Info } from 'lucide-react';
import RollingNumber from './RollingNumber';

/**
 * Consistency Radar (src/components/ConsistencyRadar.jsx)
 * 30-Day Vertical Bar Graph Visualization
 *
 * Implements:
 * 1. Clean glassmorphic card labeled "Consistency Radar"
 * 2. Visualizes 30 consecutive calendar days ending on today's current date
 * 3. Daily study hours (hours = minutes / 60) dynamically scaled to user's highest study volume (minimum scale ceiling of 4h)
 * 4. Data Source: Read strictly from userData.dailyActivity[YYYY-MM-DD]
 *    - 0 mins: low muted baseline pill (height: 3px, bg-slate-800/30)
 *    - >0 mins: emerald gradient bar (bg-gradient-to-t from-emerald-600 to-emerald-400) scaled to its hour value
 * 5. Elevated Tooltips: Hovering any bar displays an elevated tooltip card:
 *    "[X.X] Hours ([Y] mins) studied on [Day, Month Date]"
 * 6. Top Metrics Strip:
 *    - Active Days: Total count of days in the last 30 days where study minutes > 0 (e.g., "Active Days: 14 / 30")
 *    - Current Streak: Pulled from userData.streak || 0
 *    - 30-Day Total: Sum of hours logged over the last 30 days (e.g., "Total: 42.5h")
 * 7. Live Refresh:
 *    - Re-calculates 30-day bars immediately when study sessions are logged or when window dispatches "studyDataUpdated"
 */

import { 
  formatBarTooltip,
  calculate30DayBarGraph,
  formatHeatmapTooltip, 
  getActivityColorClass, 
  calculateHeatmapMatrix 
} from '../utils/consistencyRadar.js';

export {
  formatBarTooltip,
  calculate30DayBarGraph,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix
};

function getLiveUserData() {
  if (typeof window === 'undefined') return { dailyActivity: {}, streak: 0 };
  try {
    const rawProfile = localStorage.getItem('study_user_profile');
    const profile = rawProfile ? JSON.parse(rawProfile) : {};
    const userId = profile.id || profile.email;
    if (userId) {
      const masterRaw = localStorage.getItem(`studyflow_${userId}_data`);
      if (masterRaw) {
        const parsed = JSON.parse(masterRaw);
        return {
          dailyActivity: (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') ? parsed.dailyActivity : {},
          streak: Number(parsed.streak) || Number(parsed.streakData?.streakCount) || 0
        };
      }
    }
    const guestRaw = localStorage.getItem('studyflow_guest_data');
    if (guestRaw) {
      const parsed = JSON.parse(guestRaw);
      return {
        dailyActivity: (parsed.dailyActivity && typeof parsed.dailyActivity === 'object') ? parsed.dailyActivity : {},
        streak: Number(parsed.streak) || Number(parsed.streakData?.streakCount) || 0
      };
    }
  } catch (e) {}
  return { dailyActivity: {}, streak: 0 };
}

export default function ConsistencyRadar({ dailyActivity, streak, className = '' }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tick, setTick] = useState(0);
  const [liveEventActivity, setLiveEventActivity] = useState(null);

  // Live Refresh Hook: Listens to focus timer, session logs, and "studyDataUpdated"
  useEffect(() => {
    const handleActivityChange = (e) => {
      if (e?.detail?.dailyActivity) {
        setLiveEventActivity(e.detail.dailyActivity);
      }
      setTick((t) => t + 1);
    };

    window.addEventListener('studyDataUpdated', handleActivityChange);
    window.addEventListener('studyflow-activity-updated', handleActivityChange);
    window.addEventListener('studyflow-timer-sync', handleActivityChange);
    window.addEventListener('studyflow-data-changed', handleActivityChange);
    window.addEventListener('studyflow-data-patched', handleActivityChange);
    window.addEventListener('storage', handleActivityChange);

    return () => {
      window.removeEventListener('studyDataUpdated', handleActivityChange);
      window.removeEventListener('studyflow-activity-updated', handleActivityChange);
      window.removeEventListener('studyflow-timer-sync', handleActivityChange);
      window.removeEventListener('studyflow-data-changed', handleActivityChange);
      window.removeEventListener('studyflow-data-patched', handleActivityChange);
      window.removeEventListener('storage', handleActivityChange);
    };
  }, []);

  const liveUser = useMemo(() => getLiveUserData(), [tick]);

  // Daily Activity Map: Read strictly from event, props, or userData.dailyActivity
  const effectiveActivity = useMemo(() => {
    if (liveEventActivity) return liveEventActivity;
    if (dailyActivity && typeof dailyActivity === 'object' && Object.keys(dailyActivity).length > 0) {
      return dailyActivity;
    }
    if (liveUser.dailyActivity && Object.keys(liveUser.dailyActivity).length > 0) {
      return liveUser.dailyActivity;
    }
    return (dailyActivity && typeof dailyActivity === 'object') ? dailyActivity : {};
  }, [dailyActivity, liveEventActivity, liveUser]);

  // Current Streak: Pull directly from the user's live userData.streak || 0
  const liveStreak = useMemo(() => {
    if (streak !== undefined && streak !== null && Number(streak) > 0) {
      return Number(streak);
    }
    if (liveUser.streak !== undefined && liveUser.streak !== null) {
      return Math.max(0, Number(liveUser.streak) || 0);
    }
    return Math.max(0, Number(streak) || 0);
  }, [streak, liveUser]);

  // Build the 30-Day Vertical Bar Graph Data
  const barGraphData = useMemo(() => {
    return calculate30DayBarGraph(effectiveActivity);
  }, [effectiveActivity]);

  const {
    days,
    activeDaysCount,
    totalHoursFormatted,
    scaleCeiling
  } = barGraphData;

  // Y-Axis guideline ticks (e.g., 4h, 3h, 2h, 1h, 0h or 6h, 4.5h, 3h, 1.5h, 0h)
  const yTicks = useMemo(() => {
    const ceiling = scaleCeiling;
    return [
      { pct: 100, label: `${ceiling}h` },
      { pct: 75, label: `${(ceiling * 0.75).toFixed(ceiling % 4 === 0 ? 0 : 1)}h` },
      { pct: 50, label: `${(ceiling * 0.5).toFixed(ceiling % 2 === 0 ? 0 : 1)}h` },
      { pct: 25, label: `${(ceiling * 0.25).toFixed(1)}h` },
      { pct: 0, label: '0h' }
    ];
  }, [scaleCeiling]);

  return (
    <div 
      id="consistency-radar-card"
      className={`consistency-radar-card rounded-2xl glass-panel p-6 border border-theme-border shadow-glow-card card-glow-hover relative overflow-hidden transition-all ${className}`}
    >
      {/* Background Emerald Accent Glow */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Title, Icon & Consistency Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-theme-border/60 relative z-10">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base text-theme-text tracking-tight">
                Consistency Radar
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                30-Day Velocity
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Daily deliberate study hours distribution & momentum tracking
            </p>
          </div>
        </div>

        {/* Top Metrics Strip: Active Days: [X] / 30 | Current Streak: [Y] Days | Total: [Z]h */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Active Days: [X] / 30 */}
          <div className="px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs flex items-center gap-1.5 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-theme-accent" />
            <span className="text-theme-muted">Active Days:</span>
            <strong className="text-theme-text font-mono-numbers">
              <RollingNumber value={activeDaysCount} /> / 30
            </strong>
          </div>

          {/* Current Streak: [Y] Days */}
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-1.5 shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-flame-flicker" />
            <span className="text-amber-500/90 font-medium">Current Streak:</span>
            <strong className="text-amber-400 font-mono-numbers">
              <RollingNumber value={liveStreak} /> Days
            </strong>
          </div>

          {/* 30-Day Total Study Hours */}
          <div className="flex px-3 py-1.5 rounded-xl bg-theme-surface/80 border border-theme-border text-xs items-center gap-1.5 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-theme-muted">Total:</span>
            <strong className="text-emerald-400 font-mono-numbers">
              <RollingNumber value={Number(totalHoursFormatted)} decimals={1} suffix="h" />
            </strong>
          </div>
        </div>

      </div>

      {/* Main 30-Day Vertical Bar Graph Canvas */}
      <div className="relative pt-2 pb-1">
        
        {/* Chart Canvas with Y-Axis and Horizontal Gridlines */}
        <div className="relative h-48 sm:h-56 flex pl-8 sm:pl-9">
          
          {/* Y-Axis scale tick labels */}
          <div className="absolute left-0 top-0 bottom-6 w-7 sm:w-8 flex flex-col justify-between items-end pr-2 text-[10px] font-mono text-theme-muted/70 select-none pointer-events-none">
            {yTicks.map(tickItem => (
              <span key={tickItem.pct} className="leading-none">
                {tickItem.label}
              </span>
            ))}
          </div>

          {/* Horizontal Gridlines */}
          <div className="absolute left-8 sm:left-9 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none z-0">
            {yTicks.map(tickItem => (
              <div 
                key={tickItem.pct} 
                className="w-full border-b border-theme-border/25"
              />
            ))}
          </div>

          {/* 30 Vertical Bars Columns */}
          <div className="relative z-10 w-full h-[calc(100%-24px)] flex items-end justify-between gap-[3px] sm:gap-1.5 pt-4">
            {days.map((day) => {
              const barId = `bar-day-${day.dateStr}`;
              return (
                <div
                  key={day.dateStr}
                  id={barId}
                  tabIndex={0}
                  onMouseEnter={() => setHoveredBar(day)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onFocus={() => setHoveredBar(day)}
                  onBlur={() => setHoveredBar(null)}
                  className="flex-1 min-w-0 flex flex-col items-center justify-end h-full relative group cursor-pointer focus:outline-none"
                >
                  {/* Floating Elevated Tooltip Card above individual bar */}
                  <div 
                    className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 hidden group-hover:flex group-focus:flex flex-col items-center z-40 pointer-events-none transition-all duration-150 transform scale-95 group-hover:scale-100"
                  >
                    <div className="px-3 py-1.5 rounded-xl bg-slate-900/95 border border-emerald-500/40 text-white text-xs shadow-2xl backdrop-blur-md whitespace-nowrap flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${day.minutes > 0 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                      <span className="font-semibold text-emerald-300 tracking-tight">
                        {day.tooltipText}
                      </span>
                      {day.isToday && (
                        <span className="text-[9px] uppercase font-bold text-emerald-400 px-1 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="w-2 h-2 -mt-1 bg-slate-900/95 border-r border-b border-emerald-500/40 rotate-45" />
                  </div>

                  {/* Vertical Bar Element */}
                  {day.minutes === 0 ? (
                    // Low muted baseline pill (height: 3px, bg-slate-800/30)
                    <div 
                      className="w-full max-w-[14px] h-[3px] rounded-full bg-slate-800/30 border border-slate-700/30 group-hover:bg-slate-700/60 transition-colors"
                      title={day.tooltipText}
                    />
                  ) : (
                    // Emerald gradient bar scaled to hour value
                    <div 
                      style={{ height: `${day.heightPercent}%` }}
                      className={`w-full max-w-[14px] rounded-t-sm sm:rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm transition-all duration-300 group-hover:brightness-110 group-hover:shadow-[0_0_12px_rgba(52,211,153,0.5)] ${
                        day.isToday 
                          ? 'ring-2 ring-emerald-300/90 ring-offset-1 ring-offset-theme-bg shadow-[0_0_10px_rgba(52,211,153,0.6)]' 
                          : ''
                      }`}
                      title={day.tooltipText}
                    />
                  )}

                  {/* Day marker / Today indicator */}
                  <div className="w-full flex justify-center mt-1 text-[8px] sm:text-[9px] font-mono text-theme-muted/60 select-none">
                    {day.isToday ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Today" />
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {day.dayNum}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* X-Axis Range Markers Header (30 consecutive calendar days ending on today) */}
        <div className="flex justify-between items-center text-[10px] text-theme-muted font-medium mt-1 pt-1.5 border-t border-theme-border/40 pl-8 sm:pl-9 pr-1">
          <span>{days[0]?.dateLabel} (30d ago)</span>
          <span className="hidden sm:inline text-theme-muted/80">{days[14]?.dateLabel}</span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Today ({days[29]?.dateLabel})
          </span>
        </div>

      </div>

      {/* Bottom Footer: Dynamic Inspection Bar + Legend */}
      <div className="mt-4 pt-3 border-t border-theme-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        
        {/* Dynamic Elevated Tooltip Bar: [X.X] Hours ([Y] mins) studied on [Day, Month Date] */}
        <div className="min-h-[24px] flex items-center text-xs text-theme-text font-medium">
          {hoveredBar ? (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-theme-surface border border-emerald-500/30 text-theme-text shadow-sm animate-fadeIn">
              <span className={`w-2 h-2 rounded-full ${hoveredBar.minutes > 0 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
              <strong className="font-semibold text-emerald-300">
                {hoveredBar.tooltipText}
              </strong>
              {hoveredBar.isToday && (
                <span className="text-[10px] uppercase font-bold text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                  Today
                </span>
              )}
            </span>
          ) : (
            <span className="text-theme-muted text-[11px] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Hover or tap any vertical bar to inspect daily study hours
            </span>
          )}
        </div>

        {/* Legend Scale */}
        <div className="flex items-center gap-3 text-[10px] text-theme-muted select-none self-end sm:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-[3px] rounded-full bg-slate-800/30 border border-slate-700/30" />
            <span>0h (Baseline)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-3.5 rounded-t-sm bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm" />
            <span className="text-emerald-400 font-medium">Focus Hours (up to {scaleCeiling}h)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
