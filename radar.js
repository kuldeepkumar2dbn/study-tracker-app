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
import {
  purgeExpiredExamDeadlines,
  filterActiveExamDeadlines,
  isExamExpired,
  getDaysUntilExam,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
} from './exam-radar.js';

export {
  ExamsTab,
  saveExams,
  patchUserData,
  purgeExpiredExamDeadlines,
  filterActiveExamDeadlines,
  isExamExpired,
  getDaysUntilExam,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
};

export default {
  ExamsTab,
  saveExams,
  patchUserData,
  purgeExpiredExamDeadlines,
  filterActiveExamDeadlines,
  isExamExpired,
  getDaysUntilExam,
  startMidnightExamPurgeScheduler,
  stopMidnightExamPurgeScheduler
};
