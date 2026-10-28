/**
 * SyllabusView Component Wrapper
 * Re-exports SubjectsTab with defensive data access and empty state fallbacks
 */
import SubjectsTab, { SyllabusView as SubView } from './tabs/SubjectsTab';

export { SubjectsTab, SubView };
export const SyllabusView = SubjectsTab;
export default SubjectsTab;
