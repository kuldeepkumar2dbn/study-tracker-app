/**
 * Automated Verification Test Suite for:
 * 1. YouTube Playlist Parser & 3-Level Distribution in Skill Tracker
 * 2. Skill Video Linking in Daily Routine Workflow
 */

import fs from 'fs';
import path from 'path';
import {
  extractPlaylistId,
  parsePlaylistXml,
  splitVideosInto3Levels,
  generateYouTubeCourseRoadmap,
  calculateCourseProgress
} from '../src/utils/youtubeCourseParser.js';
import {
  formatSkillChipLabel,
  getUnwatchedVideosForSkill,
  createSkillRoutineBlock,
  markSkillVideoCompletedInSkills
} from '../src/utils/routineSkillSync.js';
import { createRoutineBlock } from '../src/utils/routineSyllabusSync.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-Memory Storage Mock for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

console.log('\n--- 1. Testing URL Parsing Priority for YouTube Playlists ---');

// URL with both video ID and playlist ID
const urlWithBoth = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOdP_8GzKt84xjKGKn865_1L&index=3';
const extracted1 = extractPlaylistId(urlWithBoth);
assert(extracted1 === 'PLrAXtmErZgOdP_8GzKt84xjKGKn865_1L', 'Extracts playlist ID when list= is alongside v= parameter');

// Clean playlist URL
const cleanPlaylistUrl = 'https://youtube.com/playlist?list=PL4cUxeGndC5g7FwA8gK8t-mX4Qj6k-Y7Z';
const extracted2 = extractPlaylistId(cleanPlaylistUrl);
assert(extracted2 === 'PL4cUxeGndC5g7FwA8gK8t-mX4Qj6k-Y7Z', 'Extracts playlist ID from standard /playlist?list= URL');

// Playlist parameter at start of query string
const urlParamFirst = 'https://www.youtube.com/watch?list=PL9876543210ABCDEF&v=vid123';
const extracted3 = extractPlaylistId(urlParamFirst);
assert(extracted3 === 'PL9876543210ABCDEF', 'Extracts playlist ID when list= precedes v=');

// Shortened URL with playlist
const shortenedUrl = 'https://youtu.be/vid123?list=PLShortenedList123';
const extracted4 = extractPlaylistId(shortenedUrl);
assert(extracted4 === 'PLShortenedList123', 'Extracts playlist ID from youtu.be domain with list=');

// Plain video URL without playlist
const plainVideo = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
assert(extractPlaylistId(plainVideo) === null, 'Returns null when no list parameter is in URL');

console.log('\n--- 2. Testing XML / RSS Playlist Parsing & Filtering ---');

const sampleRssXml = `
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <title>Lecture 01: Getting Started with DSA</title>
    <yt:videoId>vid_001</yt:videoId>
    <media:thumbnail url="https://img.youtube.com/vi/vid_001/hqdefault.jpg" />
  </entry>
  <entry>
    <title>Private video</title>
    <yt:videoId>vid_priv</yt:videoId>
  </entry>
  <entry>
    <title>Deleted video</title>
    <yt:videoId>vid_del</yt:videoId>
  </entry>
  <entry>
    <title>Lecture 02: Big O Notation &amp; Space Complexity</title>
    <yt:videoId>vid_002</yt:videoId>
    <media:thumbnail url="https://img.youtube.com/vi/vid_002/hqdefault.jpg" />
  </entry>
  <entry>
    <title>Lecture 03: Arrays &amp; Dynamic Vectors</title>
    <yt:videoId>vid_003</yt:videoId>
    <media:thumbnail url="https://img.youtube.com/vi/vid_003/hqdefault.jpg" />
  </entry>
</feed>
`;

const parsedVideos = parsePlaylistXml(sampleRssXml, 'PL_TEST');
assert(parsedVideos.length === 3, `Filters out private and deleted videos (expected 3, got ${parsedVideos.length})`);
assert(parsedVideos[0].title === 'Lecture 01: Getting Started with DSA', 'Video 1 title matches');
assert(parsedVideos[0].videoId === 'vid_001', 'Video 1 ID matches');
assert(parsedVideos[0].videoUrl.includes('vid_001'), 'Video 1 URL includes videoId');
assert(parsedVideos[0].completed === false, 'Video 1 completed defaults to false');
assert(parsedVideos[1].title.includes('Big O Notation'), 'Video 2 matches second non-private entry');
assert(parsedVideos[2].title.includes('Arrays'), 'Video 3 matches third non-private entry');

console.log('\n--- 3. Testing Complete 3-Level Bucket Splitting Math ---');

// Test Case A: 10 total videos
const testItems10 = Array.from({ length: 10 }, (_, i) => ({
  id: `lec-${i + 1}`,
  videoId: `v_${i + 1}`,
  title: `Ep ${i + 1}: Lesson Title`,
  completed: false
}));

const levels10 = splitVideosInto3Levels(testItems10, 'Full Stack Web Dev');
assert(levels10.length === 3, 'Creates exactly 3 accordion levels');

// Math.ceil(10 / 3) = 4 (items 0..3)
// Math.ceil(20 / 3) = 7 (items 4..6)
// items.slice(7) = 3 items (items 7..9)
assert(levels10[0].lectures.length === 4, `Level 1 has 4 items (got ${levels10[0].lectures.length})`);
assert(levels10[1].lectures.length === 3, `Level 2 has 3 items (got ${levels10[1].lectures.length})`);
assert(levels10[2].lectures.length === 3, `Level 3 has 3 items (got ${levels10[2].lectures.length})`);

// Level Titles & Badges
assert(levels10[0].title === 'Level 1: Beginner', 'Level 1 title is Level 1: Beginner');
assert(levels10[1].title === 'Level 2: Intermediate', 'Level 2 title is Level 2: Intermediate');
assert(levels10[2].title === 'Level 3: Advanced', 'Level 3 title is Level 3: Advanced');

// Verify every video object schema in levels:
// { id, title, videoUrl, videoId, thumbnail, duration, completed: false }
for (const lvl of levels10) {
  for (const lec of lvl.lectures) {
    assert(lec.id !== undefined, `Lecture ${lec.title} has id`);
    assert(lec.title !== undefined, `Lecture ${lec.title} has title`);
    assert(lec.videoUrl !== undefined && lec.videoUrl.startsWith('https://'), `Lecture ${lec.title} has valid videoUrl`);
    assert(lec.videoId !== undefined, `Lecture ${lec.title} has videoId`);
    assert(lec.thumbnail !== undefined, `Lecture ${lec.title} has thumbnail`);
    assert(lec.duration !== undefined, `Lecture ${lec.title} has duration`);
    assert(lec.completed === false, `Lecture ${lec.title} has completed: false`);
  }
}

// Test Case B: 15 total videos -> split1 = 5, split2 = 10 -> [5, 5, 5]
const testItems15 = Array.from({ length: 15 }, (_, i) => ({
  id: `lec-${i + 1}`,
  videoId: `v_${i + 1}`,
  title: `Lecture ${i + 1}`,
  completed: false
}));
const levels15 = splitVideosInto3Levels(testItems15);
assert(levels15[0].lectures.length === 5, 'Level 1 has 5 items for N=15');
assert(levels15[1].lectures.length === 5, 'Level 2 has 5 items for N=15');
assert(levels15[2].lectures.length === 5, 'Level 3 has 5 items for N=15');

// Test Case C: 37 total videos -> split1 = 13, split2 = 25 -> [13, 12, 12] -> total 37
const testItems37 = Array.from({ length: 37 }, (_, i) => ({
  id: `lec-${i + 1}`,
  videoId: `v_${i + 1}`,
  title: `Lecture ${i + 1}`,
  completed: false
}));
const levels37 = splitVideosInto3Levels(testItems37);
assert(levels37[0].lectures.length === 13, 'Level 1 has 13 items for N=37');
assert(levels37[1].lectures.length === 12, 'Level 2 has 12 items for N=37');
assert(levels37[2].lectures.length === 12, 'Level 3 has 12 items for N=37');
assert(
  levels37[0].lectures.length + levels37[1].lectures.length + levels37[2].lectures.length === 37,
  'All 37 videos are preserved with zero omissions or duplicates'
);

console.log('\n--- 4. Testing Course Progress Percentage Recalculation ---');

const mockCourse = {
  id: 'course-1',
  name: 'Python DSA Masterclass',
  masteryPct: 0,
  levels: levels10
};

const initialProgress = calculateCourseProgress(mockCourse);
assert(initialProgress.percentage === 0, 'Initial course progress is 0%');

// Mark 2 lectures complete in Level 1
mockCourse.levels[0].lectures[0].completed = true;
mockCourse.levels[0].lectures[1].completed = true;
const updatedProgress = calculateCourseProgress(mockCourse);
assert(updatedProgress.percentage > 0, `Course progress increments when lectures are marked completed (got ${updatedProgress.percentage}%)`);

console.log('\n--- 5. Testing Routine Block Extended Data Model with Skill Link ---');

const routineBlockWithSkill = createSkillRoutineBlock({
  id: 'block_1793200000000',
  title: 'Ep 14: Subsets & Permutations',
  startTime: '14:00',
  endTime: '16:00',
  category: 'Core Study',
  completed: false,
  skillLink: {
    skillId: 'skill_123',
    skillTitle: 'Python DSA',
    level: 2,
    videoId: 'abc_xyz',
    videoTitle: 'Ep 14: Subsets & Permutations',
    videoUrl: 'https://www.youtube.com/watch?v=abc_xyz'
  }
});

assert(routineBlockWithSkill.id === 'block_1793200000000', 'Routine block has valid id');
assert(routineBlockWithSkill.title === 'Ep 14: Subsets & Permutations', 'Title matches');
assert(routineBlockWithSkill.startTime === '14:00', 'Start time is 14:00');
assert(routineBlockWithSkill.endTime === '16:00', 'End time is 16:00');
assert(routineBlockWithSkill.timeRange === '14:00 - 16:00', 'Time range is 14:00 - 16:00');
assert(routineBlockWithSkill.category === 'Core Study', 'Category is Core Study');
assert(routineBlockWithSkill.completed === false, 'Completed is false');
assert(routineBlockWithSkill.linkType === 'skill', 'linkType is "skill"');
assert(routineBlockWithSkill.skillLink !== null, 'skillLink object is present');
assert(routineBlockWithSkill.skillLink.skillId === 'skill_123', 'skillId matches');
assert(routineBlockWithSkill.skillLink.skillTitle === 'Python DSA', 'skillTitle matches');
assert(routineBlockWithSkill.skillLink.level === 2, 'level matches 2');
assert(routineBlockWithSkill.skillLink.videoId === 'abc_xyz', 'videoId matches');
assert(routineBlockWithSkill.skillLink.videoTitle === 'Ep 14: Subsets & Permutations', 'videoTitle matches');
assert(routineBlockWithSkill.skillLink.videoUrl === 'https://www.youtube.com/watch?v=abc_xyz', 'videoUrl matches');

// Test createRoutineBlock universal helper with skillLink
const universalBlock = createRoutineBlock({
  title: 'Ep 14: Subsets & Permutations',
  startTime: '14:00',
  endTime: '16:00',
  category: 'Core Study',
  skillLink: {
    skillId: 'skill_123',
    skillTitle: 'Python DSA',
    level: 2,
    videoId: 'abc_xyz',
    videoTitle: 'Ep 14: Subsets & Permutations'
  }
});
assert(universalBlock.linkType === 'skill', 'createRoutineBlock auto-resolves linkType: "skill"');
assert(universalBlock.skillLink.skillTitle === 'Python DSA', 'skillLink preserved in universal routine block');

console.log('\n--- 6. Testing Skill Routine Chip Formatting ---');

const chipLabel = formatSkillChipLabel(routineBlockWithSkill.skillLink);
assert(chipLabel === '🎖️ Python DSA • Ep 14: Subsets & Permutations', `Chip label formatted correctly (got "${chipLabel}")`);

console.log('\n--- 7. Testing Unwatched Videos Selector ---');

const testCourseForUnwatched = {
  id: 'skill_dsa',
  name: 'Python DSA',
  levels: [
    {
      levelNum: 1,
      title: 'Level 1: Beginner',
      lectures: [
        { id: 'l1', videoId: 'v1', title: 'Intro to Python', completed: true },
        { id: 'l2', videoId: 'v2', title: 'Big O Notation', completed: false }
      ]
    },
    {
      levelNum: 2,
      title: 'Level 2: Intermediate',
      lectures: [
        { id: 'l3', videoId: 'v3', title: 'Binary Trees', completed: false },
        { id: 'l4', videoId: 'v4', title: 'Subsets & Permutations', completed: false }
      ]
    }
  ]
};

const unwatchedAll = getUnwatchedVideosForSkill(testCourseForUnwatched);
assert(unwatchedAll.length === 3, `Found 3 unwatched videos across course (got ${unwatchedAll.length})`);
assert(!unwatchedAll.some(v => v.videoId === 'v1'), 'Excludes watched video v1');

const unwatchedLevel2 = getUnwatchedVideosForSkill(testCourseForUnwatched, 2);
assert(unwatchedLevel2.length === 2, `Found 2 unwatched videos for Level 2 (got ${unwatchedLevel2.length})`);
assert(unwatchedLevel2[0].title === 'Binary Trees', 'Level 2 video 1 matches');
assert(unwatchedLevel2[1].title === 'Subsets & Permutations', 'Level 2 video 2 matches');

console.log('\n--- 8. Testing Two-Way Skill Video Completion Sync ---');

mockStorage.studyflow_user_123_data = JSON.stringify({
  userId: 'user_123',
  skills: [testCourseForUnwatched]
});

const syncResult = markSkillVideoCompletedInSkills(
  [testCourseForUnwatched],
  'skill_dsa',
  'v4',
  'user_123'
);

assert(syncResult.updatedSkills.length === 1, 'Returns updated skills array');
const updatedLvl2 = syncResult.targetSkill.levels.find(l => l.levelNum === 2);
const updatedV4 = updatedLvl2.lectures.find(l => l.videoId === 'v4');
assert(updatedV4.completed === true, 'Video v4 marked completed: true');
assert(syncResult.targetSkill.masteryPct > 0, `Skill mastery percentage recalculated (got ${syncResult.targetSkill.masteryPct}%)`);

// Verify localStorage persistence
assert(mockStorage.studyflow_user_123_skills !== undefined, 'Saved under studyflow_${userId}_skills');
const savedSkills = JSON.parse(mockStorage.studyflow_user_123_skills);
assert(savedSkills[0].levels[1].lectures[1].completed === true, 'Stored skills has completed: true');

console.log('\n--- 9. Verifying AddRoutineModal UI Structure & IDs ---');

const modalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AddRoutineModal.jsx'), 'utf-8');

assert(modalCode.includes('id="tab-link-syllabus"'), 'Has segmented tab for Syllabus (#tab-link-syllabus)');
assert(modalCode.includes('id="tab-link-skill"'), 'Has segmented tab for Skill Tracker (#tab-link-skill)');
assert(modalCode.includes('id="tab-link-none"'), 'Has segmented tab for None / Custom (#tab-link-none)');
assert(modalCode.includes('id="routine-skill-course-select"'), 'Has Course select dropdown (#routine-skill-course-select)');
assert(modalCode.includes('id="routine-skill-level-select"'), 'Has Level select dropdown (#routine-skill-level-select)');
assert(modalCode.includes('id="routine-skill-video-select"'), 'Has Video / Lecture select dropdown (#routine-skill-video-select)');
assert(modalCode.includes('id="quick-fill-video-btn"'), 'Has Quick Fill button (#quick-fill-video-btn)');
assert(modalCode.includes('Use Video Title as Task Name'), 'Has exact quick fill button text: "Use Video Title as Task Name"');

// Retain all syllabus IDs for backwards compatibility
assert(modalCode.includes('id="routine-subject-select"'), 'Retains #routine-subject-select');
assert(modalCode.includes('id="routine-chapter-select"'), 'Retains #routine-chapter-select');
assert(modalCode.includes('id="routine-topic-select"'), 'Retains #routine-topic-select');
assert(modalCode.includes('id="quick-fill-topic-btn"'), 'Retains #quick-fill-topic-btn');

console.log('\n--- 10. Verifying SkillRoutineChip & SkillSyncToast UI Components ---');

const chipCode = fs.readFileSync(path.join(process.cwd(), 'src/components/SkillRoutineChip.jsx'), 'utf-8');
assert(chipCode.includes('bg-purple-500/10 text-purple-400'), 'Skill chip has purple badge styling');
assert(chipCode.includes('▶ Watch'), 'Skill chip has "▶ Watch" link');
assert(chipCode.includes('target="_blank"'), 'Watch link opens in new tab');
assert(chipCode.includes('stopPropagation'), 'Stops click propagation');

const toastCode = fs.readFileSync(path.join(process.cwd(), 'src/components/SkillSyncToast.jsx'), 'utf-8');
assert(toastCode.includes('Routine done!'), 'Toast includes "Routine done!" headline');
assert(toastCode.includes('as watched in Skill Tracker?'), 'Toast asks to mark watched in Skill Tracker');
assert(toastCode.includes('Mark Watched'), 'Toast has "Mark Watched" action button');
assert(toastCode.includes('Routine Only'), 'Toast has "Routine Only" dismiss action');

console.log('\n--- 11. Verifying routine.js & skills.js Modular Exports ---');

const routineCode = fs.readFileSync(path.join(process.cwd(), 'routine.js'), 'utf-8');
assert(routineCode.includes('SkillRoutineChip'), 'routine.js exports SkillRoutineChip');
assert(routineCode.includes('SkillSyncToast'), 'routine.js exports SkillSyncToast');
assert(routineCode.includes('formatSkillChipLabel'), 'routine.js exports formatSkillChipLabel');
assert(routineCode.includes('getUnwatchedVideosForSkill'), 'routine.js exports getUnwatchedVideosForSkill');
assert(routineCode.includes('createSkillRoutineBlock'), 'routine.js exports createSkillRoutineBlock');
assert(routineCode.includes('markSkillVideoCompletedInSkills'), 'routine.js exports markSkillVideoCompletedInSkills');

const skillsCode = fs.readFileSync(path.join(process.cwd(), 'skills.js'), 'utf-8');
assert(skillsCode.includes('extractPlaylistId'), 'skills.js exports extractPlaylistId');
assert(skillsCode.includes('fetchYouTubePlaylistVideos'), 'skills.js exports fetchYouTubePlaylistVideos');
assert(skillsCode.includes('splitVideosInto3Levels'), 'skills.js exports splitVideosInto3Levels');

console.log('\n======================================================');
console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('======================================================\n');
