/**
 * StudyFlow Dashboard Core (dashboard.js)
 * Multi-Page Architecture & Consistency Radar Heatmap
 *
 * Exports:
 * - ConsistencyRadar component (GitHub-Style Study Heatmap)
 * - formatHeatmapTooltip formatter
 * - getActivityColorClass color classifier
 * - calculateHeatmapMatrix matrix calculator
 * - generateSeedDailyActivity seed generator
 * - DashboardTab component
 */

import ConsistencyRadar from './src/components/ConsistencyRadar.jsx';
import { 
  formatHeatmapTooltip, 
  getActivityColorClass, 
  calculateHeatmapMatrix,
  generateSeedDailyActivity 
} from './src/utils/consistencyRadar.js';
import DashboardTab from './src/components/tabs/DashboardTab.jsx';

export {
  ConsistencyRadar,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  generateSeedDailyActivity,
  DashboardTab
};

export default {
  ConsistencyRadar,
  formatHeatmapTooltip,
  getActivityColorClass,
  calculateHeatmapMatrix,
  generateSeedDailyActivity,
  DashboardTab
};
