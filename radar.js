/**
 * Exam & Deadline Radar Module (radar.js)
 * StudyFlow Multi-Page Architecture
 *
 * Exports:
 * - ExamsTab component
 * - saveExams non-destructive persistence helper
 * - patchUserData centralized patch controller
 */

import ExamsTab from './src/components/tabs/ExamsTab.jsx';
import { patchUserData, saveExams } from './storage-helper.js';

export {
  ExamsTab,
  saveExams,
  patchUserData
};

export default {
  ExamsTab,
  saveExams,
  patchUserData
};
