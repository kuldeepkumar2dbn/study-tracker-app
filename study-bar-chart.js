/**
 * 30-Day Vertical Bar Chart Visualization Module (study-bar-chart.js)
 * StudyFlow Zero-Backend Interactive Chart System
 *
 * Implements:
 * - ConsistencyRadar 30-Day vertical bar chart component
 * - `chart-bar-glow` reactive styling and theme-aware glow states
 * - calculate30DayBarGraph calculator
 * - formatBarTooltip formatter
 */

import ConsistencyRadar from './src/components/ConsistencyRadar.jsx';
import {
  calculate30DayBarGraph,
  formatBarTooltip,
  calculateHeatmapMatrix,
  formatHeatmapTooltip,
  getActivityColorClass
} from './src/utils/consistencyRadar.js';

export const CHART_BAR_GLOW_CLASS = 'chart-bar-glow';

export {
  ConsistencyRadar,
  calculate30DayBarGraph,
  formatBarTooltip,
  calculateHeatmapMatrix,
  formatHeatmapTooltip,
  getActivityColorClass
};

export default ConsistencyRadar;

