/**
 * Routine & Syllabus Two-Way Sync Utilities (routineSyllabusSync.js)
 * StudyFlow Multi-Page Architecture
 */

import { getActiveUserId, getUserStorageKey, isDemoUser } from '../../auth-guard.js';
import { patchUserData } from '../../storage-helper.js';

/**
 * Calculates a subject's overall completion percentage based on its chapters and sub-topics.
 */
export function calculateSubjectMastery(topics = []) {
  if (!topics || topics.length === 0) return 0;
  
  let totalItems = 0;
  let earnedScore = 0;

  topics.forEach(t => {
    if (t.subtopics && t.subtopics.length > 0) {
      t.subtopics.forEach(st => {
        totalItems += 1;
        if (st.status === 'Mastered' || st.completed) earnedScore += 100;
        else if (st.status === 'In Progress') earnedScore += 50;
      });
    } else {
      totalItems += 1;
      if (t.status === 'Mastered' || t.completed) earnedScore += 100;
      else if (t.status === 'In Progress') earnedScore += 50;
    }
  });

  return totalItems > 0 ? Math.round(earnedScore / totalItems) : 0;
}

/**
 * Formats the metadata chip label for linked syllabus topics:
 * e.g., "📚 Python & DSA • Ch 4: AVL Rotations"
 */
export function formatSyllabusChipLabel(syllabusLink, subjects = []) {
  if (!syllabusLink) return '';
  const { subjectName, chapterName, chapterId, topicName } = syllabusLink;

  let chLabel = '';
  // Check if chapterName already contains chapter prefix, e.g. "Ch 4" or "Chapter 4"
  if (chapterName) {
    const chMatch = chapterName.match(/(?:ch(?:apter)?\.?\s*(\d+))/i);
    if (chMatch) {
      chLabel = `Ch ${chMatch[1]}`;
    }
  }

  // If no prefix, check index in the subject topics list
  if (!chLabel && subjects && subjects.length > 0) {
    const sub = subjects.find(s => s.id === syllabusLink.subjectId);
    if (sub && sub.topics) {
      const idx = sub.topics.findIndex(t => t.id === chapterId || t.title === chapterName);
      if (idx !== -1) {
        chLabel = `Ch ${idx + 1}`;
      }
    }
  }

  // Fallback to chapterName or "Unit"
  if (!chLabel) {
    chLabel = chapterName || 'Unit';
  }

  return `📚 ${subjectName || 'Syllabus'} • ${chLabel}: ${topicName || 'Topic'}`;
}

/**
 * Extracts incomplete subtopics under a given chapter
 */
export function getIncompleteSubtopics(chapter) {
  if (!chapter) return [];
  
  const subtopics = chapter.subtopics || [];
  if (subtopics.length > 0) {
    return subtopics.filter(st => !st.completed && st.status !== 'Mastered');
  }

  // If chapter has no subtopics, check if chapter itself is incomplete
  if (!chapter.completed && chapter.status !== 'Mastered') {
    return [{
      id: chapter.id,
      title: chapter.title,
      status: chapter.status || 'Not Started',
      completed: false,
      isDirectChapter: true
    }];
  }

  return [];
}

/**
 * Creates a routine block following the extended data model
 * supporting syllabusLink and skillLink
 */
export function createRoutineBlock({
  id = null,
  title = '',
  startTime = '08:00',
  endTime = '10:00',
  category = 'Core Study',
  completed = false,
  linkType = null,
  syllabusLink = null,
  skillLink = null,
  calendarEventId = null
}) {
  const blockId = id || ('block_' + Date.now());
  const formattedTimeRange = `${startTime} - ${endTime}`;
  const resolvedLinkType = linkType || (skillLink ? 'skill' : (syllabusLink ? 'syllabus' : null));

  return {
    id: blockId,
    title: (title || '').trim(),
    startTime: startTime || '08:00',
    endTime: endTime || '10:00',
    timeRange: formattedTimeRange,
    category: category || 'Core Study',
    completed: Boolean(completed),
    linkType: resolvedLinkType,
    calendarEventId: calendarEventId || null,
    syllabusLink: syllabusLink ? {
      subjectId: syllabusLink.subjectId,
      subjectName: syllabusLink.subjectName,
      chapterId: syllabusLink.chapterId,
      chapterName: syllabusLink.chapterName,
      topicId: syllabusLink.topicId,
      topicName: syllabusLink.topicName
    } : null,
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
 * Toggles a syllabus topic to completed: true and status: 'Mastered',
 * recalculates parent chapter and overall subject syllabus progress bar,
 * and updates studyflow_${userId}_data.subjects in storage.
 */
export function markSyllabusTopicCompletedInSubjects(subjects = [], subjectId, chapterId, topicId, userId = null) {
  let targetSubject = null;
  let updatedMasteryPct = 0;

  const updatedSubjects = subjects.map(s => {
    if (s.id !== subjectId) return s;

    const updatedTopics = (s.topics || []).map(t => {
      const isTargetChapter = t.id === chapterId || (t.subtopics || []).some(st => st.id === topicId);
      if (!isTargetChapter && t.id !== topicId) return t;

      // If chapter itself was the linked topic
      if (t.id === topicId) {
        return {
          ...t,
          completed: true,
          status: 'Mastered'
        };
      }

      // Check subtopics
      const subtopics = t.subtopics || [];
      const updatedSubtopics = subtopics.map(st => {
        if (st.id === topicId || st.title === topicId) {
          return {
            ...st,
            completed: true,
            status: 'Mastered'
          };
        }
        return st;
      });

      const allMastered = updatedSubtopics.length > 0 && updatedSubtopics.every(st => st.status === 'Mastered' || st.completed);
      const anyInProgress = updatedSubtopics.some(st => st.status === 'In Progress' || st.status === 'Mastered' || st.completed);
      const parentStatus = allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started';

      return {
        ...t,
        completed: allMastered,
        status: parentStatus,
        subtopics: updatedSubtopics
      };
    });

    const updatedSub = {
      ...s,
      topics: updatedTopics
    };

    targetSubject = updatedSub;
    updatedMasteryPct = calculateSubjectMastery(updatedTopics);
    return updatedSub;
  });

  // Persist directly to storage for studyflow_${userId}_data.subjects
  try {
    const activeId = userId || getActiveUserId();
    if (typeof localStorage !== 'undefined' && activeId && activeId !== 'guest') {
      // 1. Scoped subjects key
      const scopedKey = getUserStorageKey('subjects');
      localStorage.setItem(scopedKey, JSON.stringify(updatedSubjects));

      // 2. Master document studyflow_${userId}_data (non-destructive patch)
      if (!isDemoUser()) {
        patchUserData(activeId, { subjects: updatedSubjects });
      }
    }
  } catch (err) {
    console.error('Error persisting syllabus topic completion to storage:', err);
  }

  return {
    updatedSubjects,
    targetSubject,
    updatedMasteryPct
  };
}
