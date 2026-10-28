/**
 * Daily Routine & Time Blocking Core (routine.js)
 * StudyFlow Multi-Page Architecture
 *
 * Exports:
 * - DailyRoutine component
 * - AddRoutineModal component
 * - SyllabusRoutineChip component
 * - SyllabusSyncToast component
 * - Routine & syllabus sync utilities
 */

import DailyRoutine from './src/components/DailyRoutine.jsx';
import AddRoutineModal from './src/components/AddRoutineModal.jsx';
import SyllabusRoutineChip from './src/components/SyllabusRoutineChip.jsx';
import SyllabusSyncToast from './src/components/SyllabusSyncToast.jsx';
import {
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery
} from './src/utils/routineSyllabusSync.js';

export {
  DailyRoutine,
  AddRoutineModal,
  SyllabusRoutineChip,
  SyllabusSyncToast,
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery
};

export default {
  DailyRoutine,
  AddRoutineModal,
  SyllabusRoutineChip,
  SyllabusSyncToast,
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery
};
