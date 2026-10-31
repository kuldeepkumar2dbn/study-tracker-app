/**
 * StudyFlow Dashboard Core (dashboard.js)
 * Multi-Page Architecture, Consistency Radar 30-Day Bar Graph & Weekly Velocity Benchmark
 *
 * Exports:
 * - ConsistencyRadar component (30-Day Study Activity Bar Graph)
 * - formatBarTooltip tooltip formatter
 * - calculate30DayBarGraph 30-day calculator
 * - WeeklyVelocity component (Monday – Sunday Accumulator)
 * - updateWeeklyVelocityBenchmark DOM updater & real-time accumulator
 * - calculateWeeklyVelocityBenchmark calculator
 * - formatHeatmapTooltip legacy formatter
 * - getActivityColorClass legacy color classifier
 * - calculateHeatmapMatrix legacy matrix calculator
 * - DashboardTab component
 */

import ConsistencyRadar from './src/components/ConsistencyRadar.jsx';
import {
  formatBarTooltip,
  calculate30DayBarGraph,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix
} from './src/utils/consistencyRadar.js';
import WeeklyVelocity from './src/components/WeeklyVelocity.jsx';
import {
  calculateWeeklyVelocityBenchmark,
  updateWeeklyVelocityBenchmark
} from './src/utils/weeklyVelocity.js';
import DashboardTab from './src/components/tabs/DashboardTab.jsx';

// Browser global registration & event listening
if (typeof window !== 'undefined') {
  window.updateWeeklyVelocityBenchmark = updateWeeklyVelocityBenchmark;
  window.calculateWeeklyVelocityBenchmark = calculateWeeklyVelocityBenchmark;

  const handleVelocityRefresh = (e) => {
    try {
      updateWeeklyVelocityBenchmark(e?.detail?.userData, e?.detail?.targetHours);
    } catch (err) {
      console.warn('Error handling velocity refresh in dashboard.js:', err);
    }
  };

  window.addEventListener('studyDataUpdated', handleVelocityRefresh);
  window.addEventListener('focusTimerStateChanged', handleVelocityRefresh);
}

export {
  ConsistencyRadar,
  formatBarTooltip,
  calculate30DayBarGraph,
  WeeklyVelocity,
  updateWeeklyVelocityBenchmark,
  calculateWeeklyVelocityBenchmark,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  DashboardTab
};

export default {
  ConsistencyRadar,
  formatBarTooltip,
  calculate30DayBarGraph,
  WeeklyVelocity,
  updateWeeklyVelocityBenchmark,
  calculateWeeklyVelocityBenchmark,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  DashboardTab
};
