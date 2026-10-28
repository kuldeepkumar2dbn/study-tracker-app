/**
 * Skills & Course Tracking Core (skills.js)
 * StudyFlow Multi-Page Architecture
 *
 * Exports:
 * - SkillsTab component
 * - YouTube Course Importer utilities
 * - Safe Deletion and Persistence helpers
 */

export { default as SkillsTab } from './src/components/tabs/SkillsTab.jsx';
export { 
  extractPlaylistId,
  fetchYouTubePlaylistVideos,
  parsePlaylistXml,
  splitVideosInto3Levels,
  generateYouTubeCourseRoadmap, 
  fetchYouTubeOEmbed, 
  calculateCourseProgress, 
  parseChaptersFromText,
  timestampToSeconds 
} from './src/utils/youtubeCourseParser.js';
export { default as YouTubeCourseModal } from './src/components/YouTubeCourseModal.jsx';
export { default as DeleteConfirmModal } from './src/components/DeleteConfirmModal.jsx';
export { default as UndoToast } from './src/components/UndoToast.jsx';
export { patchUserData, saveSkills } from './storage-helper.js';


