import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import InlineEdit from './InlineEdit';
import RollingNumber from './RollingNumber';
import { 
  calculateWeeklyVelocityBenchmark, 
  updateWeeklyVelocityBenchmark,
  getLiveUserData 
} from '../utils/weeklyVelocity.js';

export {
  calculateWeeklyVelocityBenchmark,
  updateWeeklyVelocityBenchmark,
  getLiveUserData
};

/**
 * Weekly Velocity Benchmark Component (src/components/WeeklyVelocity.jsx)
 *
 * Implements:
 * 1. Monday – Sunday Accumulator summing 7 days of the current week
 * 2. Instant sync: Takes Math.max(dailyActivity[todayStr], userData.todayLoggedHours * 60)
 * 3. Text display: `${totalWeeklyHours}h / ${targetHours}h (${percent}%)`
 * 4. Progress bar width: `${percent}%`
 * 5. Event listeners: "studyDataUpdated" and "focusTimerStateChanged"
 */
export default function WeeklyVelocity({
  userData,
  dailyActivity,
  todayLoggedHours,
  weeklyTargetHours: propWeeklyTargetHours,
  onTargetChange,
  className = ''
}) {
  const [internalTarget, setInternalTarget] = useState(propWeeklyTargetHours || 20);
  const [tick, setTick] = useState(0);

  const targetHours = propWeeklyTargetHours !== undefined ? propWeeklyTargetHours : internalTarget;

  // Real-time Event Listener: Updates immediately on studyDataUpdated and focusTimerStateChanged
  useEffect(() => {
    const handleRefresh = (e) => {
      setTick(t => t + 1);
      updateWeeklyVelocityBenchmark(e?.detail?.userData, targetHours);
    };

    window.addEventListener('studyDataUpdated', handleRefresh);
    window.addEventListener('focusTimerStateChanged', handleRefresh);
    window.addEventListener('studyflow-activity-updated', handleRefresh);
    window.addEventListener('studyflow-timer-sync', handleRefresh);
    window.addEventListener('studyflow-data-changed', handleRefresh);
    window.addEventListener('storage', handleRefresh);

    return () => {
      window.removeEventListener('studyDataUpdated', handleRefresh);
      window.removeEventListener('focusTimerStateChanged', handleRefresh);
      window.removeEventListener('studyflow-activity-updated', handleRefresh);
      window.removeEventListener('studyflow-timer-sync', handleRefresh);
      window.removeEventListener('studyflow-data-changed', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, [targetHours]);

  // Read current live dataset
  const effectiveUserData = useMemo(() => {
    const live = getLiveUserData();
    return {
      ...live,
      ...(userData || {}),
      dailyActivity: dailyActivity || userData?.dailyActivity || live.dailyActivity || {},
      todayLoggedHours: todayLoggedHours !== undefined ? todayLoggedHours : (userData?.todayLoggedHours ?? live.todayLoggedHours ?? 0.0)
    };
  }, [userData, dailyActivity, todayLoggedHours, tick]);

  // Calculate Monday – Sunday benchmark stats
  const benchmark = useMemo(() => {
    return calculateWeeklyVelocityBenchmark(effectiveUserData, targetHours);
  }, [effectiveUserData, targetHours]);

  const {
    totalWeeklyHours,
    totalHours,
    percent,
    days
  } = benchmark;

  const handleSaveTarget = (val) => {
    const num = Number(val) || 20;
    setInternalTarget(num);
    if (onTargetChange) {
      onTargetChange(num);
    }
  };

  return (
    <div 
      id="weekly-velocity-widget"
      className={`rounded-2xl glass-panel p-6 border border-theme-border card-glow-hover flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header: Title and Target */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display font-bold text-base text-theme-text">Weekly Velocity Benchmark</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-theme-muted">Target:</span>
            {onTargetChange ? (
              <InlineEdit
                type="number"
                min={1}
                max={100}
                value={targetHours}
                onSave={handleSaveTarget}
                suffix="h / week"
                className="text-xs font-bold text-theme-accent hover:underline"
              />
            ) : (
              <span className="text-xs font-bold text-theme-accent font-mono-numbers">
                {targetHours}h / week
              </span>
            )}
          </div>
        </div>

        {/* Monday – Sunday Accumulator Strip */}
        <div className="flex items-baseline justify-between text-xs text-theme-muted mb-1.5 font-mono-numbers">
          <span>Monday – Sunday Accumulator</span>
          <span 
            id="weekly-velocity-text"
            data-weekly-velocity-text
            className="weekly-velocity-text"
          >
            <strong className="text-theme-text text-sm">
              <RollingNumber value={totalHours} decimals={1} suffix="h" />
            </strong> / {targetHours}h (<RollingNumber value={percent} suffix="%" />)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-theme-surface overflow-hidden border border-theme-border/40 mb-4">
          <div 
            id="weekly-velocity-bar"
            data-weekly-velocity-bar
            className="weekly-velocity-bar h-full bg-gradient-to-r from-theme-accent to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* 7-Day Mini Bar Chart (Monday to Sunday) */}
        <div className="flex items-end justify-between gap-2 h-20 pt-2 border-t border-theme-border/60">
          {days.map((dayItem, idx) => {
            const maxBar = Math.max(4, ...days.map(d => d.hours));
            const hPct = Math.min(100, Math.max(dayItem.hours > 0 ? 8 : 0, (dayItem.hours / maxBar) * 100));

            return (
              <div 
                key={idx} 
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                title={`${dayItem.day} (${dayItem.dateStr}): ${dayItem.hours}h`}
              >
                <div className="w-full bg-theme-surface/70 rounded-t-md overflow-hidden h-14 flex flex-col justify-end">
                  <div 
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      dayItem.hours > 0 
                        ? (dayItem.isToday ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-emerald-500/80') 
                        : 'bg-theme-surface/40'
                    }`}
                    style={{ height: `${hPct}%` }}
                  />
                </div>
                <span className={`text-[10px] mt-1 font-mono-numbers group-hover:text-theme-text ${
                  dayItem.isToday ? 'font-bold text-emerald-400' : 'text-theme-muted'
                }`}>
                  {dayItem.day}
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

