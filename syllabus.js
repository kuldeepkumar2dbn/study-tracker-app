/**
 * Syllabus View Core Export (syllabus.js)
 * Wraps SubjectsTab with defensive data access and empty state fallbacks
 */
import { patchUserData, saveSubjects } from './storage-helper.js';

export * from './src/components/tabs/SubjectsTab';
export { default } from './src/components/tabs/SubjectsTab';
export { patchUserData, saveSubjects };

