/**
 * Routine & Skill Tracker Two-Way Sync Utilities (routineSkillSync.js)
 * StudyFlow Multi-Page Architecture
 */

import { getActiveUserId, getUserStorageKey, isDemoUser } from '../../auth-guard.js';
import { patchUserData } from '../../storage-helper.js';
import { calculateCourseProgress } from './youtubeCourseParser.js';

/**
 * Formats the metadata chip label for linked skill lectures:
 * e.g., "🎖️ Python DSA • Ep 14: Subsets & Permutations"
 */
export function formatSkillChipLabel(skillLink) {
  if (!skillLink) return '';
  const skillTitle = skillLink.skillTitle || 'Skill';
  const videoTitle = skillLink.videoTitle || 'Lecture';
  return `🎖️ ${skillTitle} • ${videoTitle}`;
}

/**
 * Extracts unwatched video lectures for a course, optionally filtered by level
 */
export function getUnwatchedVideosForSkill(skill, targetLevel = null) {
  if (!skill || !Array.isArray(skill.levels)) return [];

  const unwatched = [];
  skill.levels.forEach((lvl, lvlIdx) => {
    const lvlNum = lvl.levelNum || (lvlIdx + 1);
    if (targetLevel !== null && targetLevel !== undefined && Number(targetLevel) !== Number(lvlNum)) {
      return;
    }

    const lectures = lvl.lectures || [];
    lectures.forEach((lec, lecIdx) => {
      if (!lec.completed) {
        unwatched.push({
          id: lec.id || `lec-${lvlNum}-${lecIdx + 1}`,
          videoId: lec.videoId || lec.id,
          title: lec.title,
          videoUrl: lec.videoUrl || lec.youtubeUrl || (lec.videoId ? `https://www.youtube.com/watch?v=${lec.videoId}` : ''),
          thumbnail: lec.thumbnail || (lec.videoId ? `https://img.youtube.com/vi/${lec.videoId}/hqdefault.jpg` : ''),
          duration: lec.duration || 'Lesson',
          completed: false,
          level: lvlNum,
          levelTitle: lvl.title || `Level ${lvlNum}`
        });
      }
    });
  });

  return unwatched;
}

/**
 * Creates a routine block linked to a Skill Tracker video lecture
 */
export function createSkillRoutineBlock({
  id = null,
  title = '',
  startTime = '14:00',
  endTime = '16:00',
  category = 'Core Study',
  completed = false,
  skillLink = null
}) {
  const blockId = id || ('block_' + Date.now());
  const formattedTimeRange = `${startTime} - ${endTime}`;

  return {
    id: blockId,
    title: (title || '').trim(),
    startTime: startTime || '14:00',
    endTime: endTime || '16:00',
    timeRange: formattedTimeRange,
    category: category || 'Core Study',
    completed: Boolean(completed),
    linkType: 'skill',
    skillLink: skillLink ? {
      skillId: skillLink.skillId,
      skillTitle: skillLink.skillTitle,
      level: Number(skillLink.level) || 1,
      videoId: skillLink.videoId,
      videoTitle: skillLink.videoTitle,
      videoUrl: skillLink.videoUrl || (skillLink.videoId ? `https://www.youtube.com/watch?v=${skillLink.videoId}` : '')
    } : null
  };
}

/**
 * Marks a video lecture as completed in skills state and storage,
 * recalculates the course's overall progress percentage,
 * and updates studyflow_${userId}_data.skills in storage.
 */
export function markSkillVideoCompletedInSkills(skills = [], skillId, videoId, userId = null) {
  let targetSkill = null;
  let targetVideo = null;
  let updatedMasteryPct = 0;

  const updatedSkills = skills.map(skill => {
    if (skill.id !== skillId) return skill;

    let videoFound = false;
    const updatedLevels = (skill.levels || []).map(lvl => {
      const updatedLectures = (lvl.lectures || []).map(lec => {
        const matches = (lec.videoId && lec.videoId === videoId) || 
                        lec.id === videoId || 
                        lec.title === videoId;
        if (matches) {
          videoFound = true;
          targetVideo = { ...lec, completed: true };
          
          // Also mark lecture subtopics as complete
          const updatedSubtopics = (lec.subtopics || []).map(st => ({
            ...st,
            done: true
          }));

          return {
            ...lec,
            completed: true,
            subtopics: updatedSubtopics
          };
        }
        return lec;
      });

      return {
        ...lvl,
        lectures: updatedLectures
      };
    });

    const updatedSkillDoc = {
      ...skill,
      levels: updatedLevels
    };

    const progress = calculateCourseProgress(updatedSkillDoc);
    updatedSkillDoc.masteryPct = progress.percentage;
    updatedMasteryPct = progress.percentage;
    targetSkill = updatedSkillDoc;

    return updatedSkillDoc;
  });

  // Persist directly to storage for studyflow_${userId}_data.skills and scoped skills key
  try {
    const activeId = userId || getActiveUserId();
    if (typeof localStorage !== 'undefined' && activeId && activeId !== 'guest') {
      // 1. Scoped skills key
      const scopedKey = getUserStorageKey('skills');
      localStorage.setItem(scopedKey, JSON.stringify(updatedSkills));

      // 2. Custom studyflow_${userId}_skills key
      const customKey = `studyflow_${activeId}_skills`;
      localStorage.setItem(customKey, JSON.stringify(updatedSkills));

      // 3. Master document studyflow_${userId}_data (non-destructive patch)
      if (!isDemoUser()) {
        patchUserData(activeId, { skills: updatedSkills });
      }
    }
  } catch (err) {
    console.error('Error persisting skill video completion to storage:', err);
  }

  return {
    updatedSkills,
    targetSkill,
    targetVideo,
    updatedMasteryPct
  };
}
