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
 * recalculates parent chapter progress and overall subject syllabus progress bar,
 * and updates studyflow_${userId}_data.subjects in storage.
 */
export function markSyllabusTopicCompletedInSubjects(subjects = [], subjectId, chapterId, topicId, userId = null, topicName = null) {
  let targetSubject = null;
  let updatedMasteryPct = 0;

  const updatedSubjects = (subjects || []).map(s => {
    const isTargetSubject = (subjectId && s.id === subjectId) || (s.name && subjectId && s.name === subjectId);
    if (!isTargetSubject) return s;

    const updatedTopics = (s.topics || []).map(t => {
      const isTargetChapter = t.id === chapterId || 
                              (chapterId && t.title === chapterId) || 
                              (Array.isArray(t.subtopics) && t.subtopics.some(st => 
                                (topicId && st.id === topicId) || 
                                (topicName && st.title === topicName) || 
                                (topicId && st.title === topicId)
                              ));
      if (!isTargetChapter && t.id !== topicId && t.title !== topicName && t.title !== topicId) return t;

      // If chapter itself was the linked topic
      if (t.id === topicId || t.title === topicName || t.title === topicId || !t.subtopics || t.subtopics.length === 0) {
        return {
          ...t,
          completed: true,
          status: 'Mastered',
          progress: 100,
          percentage: 100
        };
      }

      // Check subtopics
      const subtopics = t.subtopics || [];
      const updatedSubtopics = subtopics.map(st => {
        if ((topicId && st.id === topicId) || (topicName && st.title === topicName) || (topicId && st.title === topicId)) {
          return {
            ...st,
            completed: true,
            status: 'Mastered'
          };
        }
        return st;
      });

      const totalSubs = updatedSubtopics.length;
      const completedSubs = updatedSubtopics.filter(st => st.status === 'Mastered' || st.completed).length;
      const allMastered = totalSubs > 0 && completedSubs === totalSubs;
      const anyInProgress = completedSubs > 0 || updatedSubtopics.some(st => st.status === 'In Progress');
      const parentStatus = allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started';
      const chapterProgress = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 100;

      return {
        ...t,
        completed: allMastered,
        status: parentStatus,
        progress: chapterProgress,
        percentage: chapterProgress,
        subtopics: updatedSubtopics
      };
    });

    const updatedSub = {
      ...s,
      topics: updatedTopics
    };

    targetSubject = updatedSub;
    updatedMasteryPct = calculateSubjectMastery(updatedTopics);
    updatedSub.completionPercentage = updatedMasteryPct;
    return updatedSub;
  });

  // Persist directly to storage for studyflow_${userId}_data.subjects
  try {
    const activeId = userId || getActiveUserId();
    if (typeof localStorage !== 'undefined' && activeId && activeId !== 'guest') {
      const scopedKey = getUserStorageKey('subjects');
      localStorage.setItem(scopedKey, JSON.stringify(updatedSubjects));

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

/**
 * Automatically marks a routine task completed, syncs with syllabus if linked,
 * updates chapter progress percentages, removes the task from active routine,
 * and tracks it in completedRoutineToday.
 *
 * @param {Object} params
 * @param {Array} params.routine Current routine array
 * @param {Array} params.subjects Current subjects array
 * @param {Array} params.completedToday Current list of completed tasks today
 * @param {string} params.slotId The routine block ID to complete
 * @param {string} params.userId Optional active user ID for storage persistence
 * @returns {Object}
 */
export function completeRoutineTaskWithSyllabusSync({
  routine = [],
  subjects = [],
  completedToday = [],
  slotId = null,
  userId = null
}) {
  const targetSlot = (routine || []).find(s => s.id === slotId);
  if (!targetSlot) {
    return {
      remainingRoutine: routine || [],
      updatedSubjects: subjects || [],
      updatedCompletedToday: completedToday || [],
      completedSlot: null,
      syllabusUpdated: false,
      targetSubject: null,
      targetChapter: null,
      targetTopic: null
    };
  }

  // 1. Mark target slot as completed and clean up carriedOver flags
  const completedSlot = {
    ...targetSlot,
    completed: true,
    carriedOver: false,
    carriedFromDate: null,
    carriedOverNote: null,
    completedAt: new Date().toISOString()
  };

  // 2. Remove from active routine
  const remainingRoutine = (routine || []).filter(s => s.id !== slotId);

  // 3. Add to completedToday
  const updatedCompletedToday = [
    completedSlot,
    ...(completedToday || []).filter(c => c.id !== slotId)
  ];

  // 4. Sync with syllabus if linked
  let updatedSubjects = subjects || [];
  let syllabusUpdated = false;
  let targetSubject = null;
  let targetChapter = null;
  let targetTopic = null;

  if (targetSlot.syllabusLink) {
    const { subjectId, subjectName, chapterId, chapterName, topicId, topicName } = targetSlot.syllabusLink;

    updatedSubjects = (subjects || []).map(s => {
      const matchSubject = (subjectId && s.id === subjectId) || (subjectName && s.name === subjectName);
      if (!matchSubject) return s;

      const topicsList = s.topics || [];
      const updatedTopics = topicsList.map(t => {
        const matchChapter = (chapterId && t.id === chapterId) ||
                             (chapterName && t.title === chapterName) ||
                             (Array.isArray(t.subtopics) && t.subtopics.some(st => 
                               (topicId && st.id === topicId) || 
                               (topicName && st.title === topicName) || 
                               (topicId && st.title === topicId)
                             ));

        if (!matchChapter && t.id !== topicId && t.title !== topicName && t.title !== topicId) {
          return t;
        }

        // Subtopics handling
        if (Array.isArray(t.subtopics) && t.subtopics.length > 0) {
          let matched = false;
          const updatedSubtopics = t.subtopics.map(st => {
            const matchSt = (topicId && st.id === topicId) || 
                            (topicName && st.title === topicName) || 
                            (topicId && st.title === topicId);
            if (matchSt) {
              matched = true;
              syllabusUpdated = true;
              targetTopic = { ...st, completed: true, status: 'Mastered' };
              return targetTopic;
            }
            return st;
          });

          const totalSubs = updatedSubtopics.length;
          const completedSubs = updatedSubtopics.filter(st => st.completed || st.status === 'Mastered').length;
          const chapterProgress = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 100;
          const allMastered = totalSubs > 0 && completedSubs === totalSubs;
          const anyInProgress = completedSubs > 0 || updatedSubtopics.some(st => st.status === 'In Progress');
          const chapterStatus = allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started';

          const updatedChap = {
            ...t,
            completed: allMastered,
            status: chapterStatus,
            progress: chapterProgress,
            percentage: chapterProgress,
            subtopics: updatedSubtopics
          };
          if (matched) {
            targetChapter = updatedChap;
          }
          return updatedChap;
        } else {
          // Direct chapter without subtopics
          syllabusUpdated = true;
          const updatedChap = {
            ...t,
            completed: true,
            status: 'Mastered',
            progress: 100,
            percentage: 100
          };
          targetTopic = updatedChap;
          targetChapter = updatedChap;
          return updatedChap;
        }
      });

      const updatedSub = {
        ...s,
        topics: updatedTopics
      };
      updatedSub.completionPercentage = calculateSubjectMastery(updatedTopics);
      targetSubject = updatedSub;
      return updatedSub;
    });
  }

  // 5. Atomic & Safe Persistence via patchUserData
  try {
    const activeId = userId || (typeof getActiveUserId === 'function' ? getActiveUserId() : null);
    if (activeId && activeId !== 'guest' && !isDemoUser()) {
      patchUserData(activeId, {
        routine: remainingRoutine,
        subjects: syllabusUpdated ? updatedSubjects : undefined,
        completedRoutineToday: updatedCompletedToday
      });
    }
  } catch (err) {
    console.error('Error in completeRoutineTaskWithSyllabusSync persistence:', err);
  }

  return {
    remainingRoutine,
    updatedSubjects,
    updatedCompletedToday,
    completedSlot,
    syllabusUpdated,
    targetSubject,
    targetChapter,
    targetTopic
  };
}

/**
 * Restores a finished routine task back to the active routine,
 * removing it from completedRoutineToday and reverting the syllabus topic completion if linked.
 *
 * @param {Object} params
 * @param {Array} params.routine Current active routine array
 * @param {Array} params.subjects Current subjects array
 * @param {Array} params.completedToday Current completed tasks today
 * @param {string} params.slotId ID of the completed item to restore
 * @param {string} params.userId Optional active user ID
 * @returns {Object}
 */
export function undoCompletedRoutineTask({
  routine = [],
  subjects = [],
  completedToday = [],
  slotId = null,
  userId = null
}) {
  const targetCompleted = (completedToday || []).find(c => c.id === slotId);
  if (!targetCompleted) {
    return {
      restoredRoutine: routine || [],
      updatedSubjects: subjects || [],
      remainingCompletedToday: completedToday || [],
      restoredSlot: null
    };
  }

  const restoredSlot = {
    ...targetCompleted,
    completed: false
  };

  const restoredRoutine = [...(routine || []), restoredSlot];
  const remainingCompletedToday = (completedToday || []).filter(c => c.id !== slotId);

  let updatedSubjects = subjects || [];
  let syllabusReverted = false;

  if (targetCompleted.syllabusLink) {
    const { subjectId, subjectName, chapterId, chapterName, topicId, topicName } = targetCompleted.syllabusLink;

    updatedSubjects = (subjects || []).map(s => {
      const matchSubject = (subjectId && s.id === subjectId) || (subjectName && s.name === subjectName);
      if (!matchSubject) return s;

      const topicsList = s.topics || [];
      const updatedTopics = topicsList.map(t => {
        const matchChapter = (chapterId && t.id === chapterId) ||
                             (chapterName && t.title === chapterName) ||
                             (Array.isArray(t.subtopics) && t.subtopics.some(st => 
                               (topicId && st.id === topicId) || 
                               (topicName && st.title === topicName) || 
                               (topicId && st.title === topicId)
                             ));

        if (!matchChapter && t.id !== topicId && t.title !== topicName && t.title !== topicId) {
          return t;
        }

        if (Array.isArray(t.subtopics) && t.subtopics.length > 0) {
          const updatedSubtopics = t.subtopics.map(st => {
            const matchSt = (topicId && st.id === topicId) || 
                            (topicName && st.title === topicName) || 
                            (topicId && st.title === topicId);
            if (matchSt) {
              syllabusReverted = true;
              return {
                ...st,
                completed: false,
                status: 'In Progress'
              };
            }
            return st;
          });

          const totalSubs = updatedSubtopics.length;
          const completedSubs = updatedSubtopics.filter(st => st.completed || st.status === 'Mastered').length;
          const chapterProgress = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
          const allMastered = totalSubs > 0 && completedSubs === totalSubs;
          const anyInProgress = completedSubs > 0 || updatedSubtopics.some(st => st.status === 'In Progress');
          const chapterStatus = allMastered ? 'Mastered' : anyInProgress ? 'In Progress' : 'Not Started';

          return {
            ...t,
            completed: allMastered,
            status: chapterStatus,
            progress: chapterProgress,
            percentage: chapterProgress,
            subtopics: updatedSubtopics
          };
        } else {
          syllabusReverted = true;
          return {
            ...t,
            completed: false,
            status: 'In Progress',
            progress: 0,
            percentage: 0
          };
        }
      });

      const updatedSub = {
        ...s,
        topics: updatedTopics
      };
      updatedSub.completionPercentage = calculateSubjectMastery(updatedTopics);
      return updatedSub;
    });
  }

  try {
    const activeId = userId || (typeof getActiveUserId === 'function' ? getActiveUserId() : null);
    if (activeId && activeId !== 'guest' && !isDemoUser()) {
      patchUserData(activeId, {
        routine: restoredRoutine,
        subjects: syllabusReverted ? updatedSubjects : undefined,
        completedRoutineToday: remainingCompletedToday
      });
    }
  } catch (err) {
    console.error('Error in undoCompletedRoutineTask persistence:', err);
  }

  return {
    restoredRoutine,
    updatedSubjects,
    remainingCompletedToday,
    restoredSlot
  };
}
