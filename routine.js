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
import TomorrowPlannerModal from './src/components/TomorrowPlannerModal.jsx';
import SyllabusRoutineChip from './src/components/SyllabusRoutineChip.jsx';
import SyllabusSyncToast from './src/components/SyllabusSyncToast.jsx';
import SkillRoutineChip from './src/components/SkillRoutineChip.jsx';
import SkillSyncToast from './src/components/SkillSyncToast.jsx';
import {
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery
} from './src/utils/routineSyllabusSync.js';
import {
  formatSkillChipLabel,
  getUnwatchedVideosForSkill,
  createSkillRoutineBlock,
  markSkillVideoCompletedInSkills
} from './src/utils/routineSkillSync.js';

import { patchUserData, saveRoutine, saveTomorrowPlan, autoMergeTomorrowPlans } from './storage-helper.js';
import { 
  pushStudySessionToCalendar, 
  saveCalendarEventToItem, 
  formatRFC3339, 
  formatStudyEventTitle, 
  buildCalendarEventPayload, 
  showCalendarSuccessToast,
  getCalendarPreference,
  setCalendarPreference
} from './calendar-sync.js';
import { hasCalendarScope, requestCalendarScope } from './google-auth.js';

const RoutineView = DailyRoutine;

export {
  DailyRoutine,
  RoutineView,
  AddRoutineModal,
  TomorrowPlannerModal,
  SyllabusRoutineChip,
  SyllabusSyncToast,
  SkillRoutineChip,
  SkillSyncToast,
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery,
  formatSkillChipLabel,
  getUnwatchedVideosForSkill,
  createSkillRoutineBlock,
  markSkillVideoCompletedInSkills,
  saveRoutine,
  patchUserData,
  saveTomorrowPlan,
  autoMergeTomorrowPlans,
  pushStudySessionToCalendar,
  saveCalendarEventToItem,
  formatRFC3339,
  formatStudyEventTitle,
  buildCalendarEventPayload,
  showCalendarSuccessToast,
  getCalendarPreference,
  setCalendarPreference,
  hasCalendarScope,
  requestCalendarScope
};

export default {
  DailyRoutine,
  RoutineView,
  AddRoutineModal,
  TomorrowPlannerModal,
  SyllabusRoutineChip,
  SyllabusSyncToast,
  SkillRoutineChip,
  SkillSyncToast,
  formatSyllabusChipLabel,
  getIncompleteSubtopics,
  createRoutineBlock,
  markSyllabusTopicCompletedInSubjects,
  calculateSubjectMastery,
  formatSkillChipLabel,
  getUnwatchedVideosForSkill,
  createSkillRoutineBlock,
  markSkillVideoCompletedInSkills,
  saveRoutine,
  patchUserData,
  saveTomorrowPlan,
  autoMergeTomorrowPlans,
  pushStudySessionToCalendar,
  saveCalendarEventToItem,
  formatRFC3339,
  formatStudyEventTitle,
  buildCalendarEventPayload,
  showCalendarSuccessToast,
  getCalendarPreference,
  setCalendarPreference,
  hasCalendarScope,
  requestCalendarScope
};

