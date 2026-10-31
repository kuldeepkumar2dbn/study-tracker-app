/**
 * StudyFlow Dashboard Core (dashboard.js)
 * Multi-Page Architecture & Consistency Radar 30-Day Bar Graph
 *
 * Exports:
 * - ConsistencyRadar component (30-Day Study Activity Bar Graph)
 * - formatBarTooltip tooltip formatter
 * - calculate30DayBarGraph 30-day calculator
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
import DashboardTab from './src/components/tabs/DashboardTab.jsx';

export {
  ConsistencyRadar,
  formatBarTooltip,
  calculate30DayBarGraph,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  DashboardTab
};

export default {
  ConsistencyRadar,
  formatBarTooltip,
  calculate30DayBarGraph,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  DashboardTab
};
