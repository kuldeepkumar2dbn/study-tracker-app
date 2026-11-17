/**
 * Mock Logbook Analytics & Trend Engine (mock-logbook.js)
 * StudyFlow Zero-Reload SPA Architecture
 *
 * Implements:
 * 1. Chronological trend data extraction for up to 10 most recent mock tests
 * 2. Paired comparison calculations: Net Score % vs. Accuracy %
 * 3. Elevated tooltip formatting & data normalization
 * 4. Reactive trend updates on test save/delete & theme switches
 */

import { sanitizeText, stripHtmlTags } from './security-privacy.js';

export { sanitizeText };
export const STORAGE_KEY = 'studytracker_mock_tests';

export const Y_TICKS = [100, 75, 50, 25, 0];

/**
 * Normalizes and extracts the 10 most recent mock tests in chronological order
 * (oldest on left, latest on right) for the dual-bar comparison chart.
 *
 * @param {Array} tests - Array of mock test records (usually ordered latest-first)
 * @param {number} [limit=10] - Maximum number of recent tests to plot
 * @returns {Array} Array of up to 10 tests formatted for dual-bar plotting
 */
export function getRecentMockTrend(tests = [], limit = 10) {
  if (!Array.isArray(tests) || tests.length === 0) {
    return [];
  }

  // Take the most recent tests (first `limit` items if newest-first)
  // then reverse so oldest is on the left and latest on the right
  const recentSlice = tests.slice(0, limit).reverse();

  return recentSlice.map((t, idx) => {
    const totalQ = Math.max(1, Number(t.totalQuestions) || 1);
    const marksPerCorrect = Math.max(0.1, Number(t.marksPerCorrect) || 1);
    const maxMarks = Math.max(1, Number(t.maxMarks) || (totalQ * marksPerCorrect));
    const netScore = Math.max(0, Number(t.netScore) || 0);
    const correct = Math.max(0, Number(t.correctCount) || 0);
    const incorrect = Math.max(0, Number(t.incorrectCount) || 0);
    const attempted = correct + incorrect;

    const rawScorePct = t.scorePct !== undefined ? Number(t.scorePct) : ((netScore / maxMarks) * 100);
    const rawAccuracyPct = t.accuracyPct !== undefined ? Number(t.accuracyPct) : (attempted > 0 ? (correct / attempted) * 100 : 0);

    const scorePct = Math.max(0, Math.min(100, Number(rawScorePct.toFixed(1))));
    const accuracyPct = Math.max(0, Math.min(100, Number(rawAccuracyPct.toFixed(1))));

    const safeTitle = stripHtmlTags(t.title || `Mock Test #${idx + 1}`) || `Mock Test #${idx + 1}`;
    const safeSubject = stripHtmlTags(t.subject || 'Full Syllabus') || 'Full Syllabus';

    return {
      id: t.id || `mock-trend-${idx}`,
      index: idx + 1,
      title: safeTitle,
      shortTitle: safeTitle.length > 14 ? (safeTitle.substring(0, 12) + '…') : safeTitle,
      subject: safeSubject,
      date: t.date || '',
      shortDate: t.date ? t.date.split('-').slice(1).join('/') : '',
      scorePct,
      accuracyPct,
      netScore: Number(netScore.toFixed(2)),
      maxMarks: Number(maxMarks.toFixed(2)),
      correctCount: correct,
      incorrectCount: incorrect,
      attempted,
      penaltyMarks: Number((t.penaltyMarks || 0).toFixed(2)),
      tooltipText: formatTrendTooltip({ ...t, title: safeTitle }, scorePct, accuracyPct)
    };
  });
}

/**
 * Formats an interactive tooltip label for a mock test
 */
export function formatTrendTooltip(test, scorePctOverride, accuracyPctOverride) {
  if (!test) return '';
  const score = scorePctOverride !== undefined ? scorePctOverride : Number(test.scorePct || 0).toFixed(1);
  const accuracy = accuracyPctOverride !== undefined ? accuracyPctOverride : Number(test.accuracyPct || 0).toFixed(1);
  return `${test.title || 'Mock Test'}: Score ${score}% | Accuracy ${accuracy}%`;
}

export default {
  STORAGE_KEY,
  Y_TICKS,
  getRecentMockTrend,
  formatTrendTooltip
};

