import React, { useState, useMemo } from 'react';
import { 
  X, 
  Clock, 
  Link2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  BookOpen, 
  Layers, 
  ListTree, 
  ArrowRight,
  CheckCircle2,
  Award,
  Play
} from 'lucide-react';
import { getIncompleteSubtopics, createRoutineBlock } from '../utils/routineSyllabusSync';
import { getUnwatchedVideosForSkill } from '../utils/routineSkillSync';
import { getActiveUserId, getUserStorageKey } from '../../auth-guard';

export default function AddRoutineModal({
  isOpen,
  onClose,
  onAddSlot,
  subjects = [],
  skills: propSkills = []
}) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Core Study');

  // Segmented tab source toggle: 'syllabus' | 'skill' | 'none'
  const [linkSourceTab, setLinkSourceTab] = useState('syllabus');

  // Syllabus Link State
  const [isSyllabusCardOpen, setIsSyllabusCardOpen] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // Skill Link State
  const [isSkillCardOpen, setIsSkillCardOpen] = useState(true);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedLevelNum, setSelectedLevelNum] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');

  // Fallback to read skills from storage if not provided via props
  const allSkills = useMemo(() => {
    if (propSkills && propSkills.length > 0) return propSkills;
    try {
      const activeId = getActiveUserId();
      if (typeof localStorage !== 'undefined') {
        const customKey = `studyflow_${activeId}_skills`;
        const saved = localStorage.getItem(customKey);
        if (saved) return JSON.parse(saved);

        const masterKey = `studyflow_${activeId}_data`;
        const masterRaw = localStorage.getItem(masterKey);
        if (masterRaw) {
          const parsed = JSON.parse(masterRaw);
          if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
            return parsed.skills;
          }
        }

        const scopedKey = getUserStorageKey('skills');
        const scoped = localStorage.getItem(scopedKey);
        if (scoped) return JSON.parse(scoped);
      }
    } catch (e) {
      console.warn('AddRoutineModal: error reading skills fallback:', e);
    }
    return [];
  }, [propSkills, isOpen]);

  // --- SYLLABUS COMPUTED VALUES ---
  const selectedSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  const availableChapters = useMemo(() => {
    return selectedSubject?.topics || [];
  }, [selectedSubject]);

  const selectedChapter = useMemo(() => {
    return availableChapters.find(c => c.id === selectedChapterId) || null;
  }, [availableChapters, selectedChapterId]);

  const availableTopics = useMemo(() => {
    if (!selectedChapter) return [];
    return getIncompleteSubtopics(selectedChapter);
  }, [selectedChapter]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return availableTopics.find(t => t.id === selectedTopicId) || null;
  }, [availableTopics, selectedTopicId]);

  // --- SKILL TRACKER COMPUTED VALUES ---
  const activeCourseSkills = useMemo(() => {
    return allSkills.filter(s => (s.levels && s.levels.length > 0) || s.isCourse || s.name);
  }, [allSkills]);

  const selectedSkill = useMemo(() => {
    return activeCourseSkills.find(s => s.id === selectedSkillId) || null;
  }, [activeCourseSkills, selectedSkillId]);

  const availableSkillLevels = useMemo(() => {
    if (!selectedSkill) return [];
    if (Array.isArray(selectedSkill.levels) && selectedSkill.levels.length > 0) {
      return selectedSkill.levels;
    }
    return [
      { id: 'lvl-1', levelNum: 1, title: 'Level 1: Beginner' },
      { id: 'lvl-2', levelNum: 2, title: 'Level 2: Intermediate' },
      { id: 'lvl-3', levelNum: 3, title: 'Level 3: Advanced' }
    ];
  }, [selectedSkill]);

  const availableSkillVideos = useMemo(() => {
    if (!selectedSkill) return [];
    const lvlNum = selectedLevelNum ? Number(selectedLevelNum) : null;
    return getUnwatchedVideosForSkill(selectedSkill, lvlNum);
  }, [selectedSkill, selectedLevelNum]);

  const selectedSkillVideo = useMemo(() => {
    if (!selectedVideoId) return null;
    return availableSkillVideos.find(v => v.videoId === selectedVideoId || v.id === selectedVideoId) || null;
  }, [availableSkillVideos, selectedVideoId]);

  if (!isOpen) return null;

  // Syllabus Change Handlers
  const handleSubjectChange = (e) => {
    const newSubId = e.target.value;
    setSelectedSubjectId(newSubId);
    setSelectedChapterId('');
    setSelectedTopicId('');
  };

  const handleChapterChange = (e) => {
    const newChapId = e.target.value;
    setSelectedChapterId(newChapId);
    setSelectedTopicId('');
  };

  const handleTopicChange = (e) => {
    setSelectedTopicId(e.target.value);
  };

  const handleQuickFillTopic = () => {
    if (selectedTopic && selectedTopic.title) {
      setTitle(selectedTopic.title);
    } else if (selectedChapter && selectedChapter.title) {
      setTitle(selectedChapter.title);
    }
  };

  // Skill Change Handlers
  const handleSkillChange = (e) => {
    const newSkillId = e.target.value;
    setSelectedSkillId(newSkillId);
    setSelectedLevelNum('');
    setSelectedVideoId('');
  };

  const handleSkillLevelChange = (e) => {
    setSelectedLevelNum(e.target.value);
    setSelectedVideoId('');
  };

  const handleSkillVideoChange = (e) => {
    setSelectedVideoId(e.target.value);
  };

  const handleQuickFillVideo = () => {
    if (selectedSkillVideo && selectedSkillVideo.title) {
      setTitle(selectedSkillVideo.title);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let syllabusLink = null;
    let skillLink = null;
    let linkType = null;

    if (linkSourceTab === 'syllabus' && selectedSubject && (selectedTopic || selectedChapter)) {
      const activeTopic = selectedTopic || {
        id: selectedChapter.id,
        title: selectedChapter.title
      };

      linkType = 'syllabus';
      syllabusLink = {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        chapterId: selectedChapter?.id || activeTopic.id,
        chapterName: selectedChapter?.title || selectedSubject.name,
        topicId: activeTopic.id,
        topicName: activeTopic.title
      };
    } else if (linkSourceTab === 'skill' && selectedSkill && selectedSkillVideo) {
      linkType = 'skill';
      skillLink = {
        skillId: selectedSkill.id,
        skillTitle: selectedSkill.name,
        level: Number(selectedLevelNum) || selectedSkillVideo.level || 1,
        videoId: selectedSkillVideo.videoId || selectedSkillVideo.id,
        videoTitle: selectedSkillVideo.title,
        videoUrl: selectedSkillVideo.videoUrl || (selectedSkillVideo.videoId ? `https://www.youtube.com/watch?v=${selectedSkillVideo.videoId}` : '')
      };
    }

    const newBlock = createRoutineBlock({
      title: title.trim(),
      startTime,
      endTime,
      category,
      linkType,
      syllabusLink,
      skillLink
    });

    onAddSlot(newBlock);

    // Reset form
    setTitle('');
    setStartTime('08:00');
    setEndTime('10:00');
    setCategory('Core Study');
    setSelectedSubjectId('');
    setSelectedChapterId('');
    setSelectedTopicId('');
    setSelectedSkillId('');
    setSelectedLevelNum('');
    setSelectedVideoId('');
    onClose();
  };

  return (
    <div 
      id="add-routine-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-theme-text">Add Routine Time-Block</h3>
              <p className="text-[11px] text-theme-muted">Schedule focused study slots and link to syllabus topics or skill courses.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-theme-muted hover:text-theme-text p-1.5 rounded-xl hover:bg-theme-cardHover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Source Type Toggle Tabs */}
        <div className="mt-4 p-1 rounded-xl bg-theme-surface border border-theme-border flex items-center gap-1 text-xs font-semibold">
          <button
            type="button"
            id="tab-link-syllabus"
            onClick={() => setLinkSourceTab('syllabus')}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              linkSourceTab === 'syllabus'
                ? 'bg-theme-accent text-white shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>📚 Link Syllabus</span>
          </button>

          <button
            type="button"
            id="tab-link-skill"
            onClick={() => setLinkSourceTab('skill')}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              linkSourceTab === 'skill'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>🎖️ Link Skill Tracker</span>
          </button>

          <button
            type="button"
            id="tab-link-none"
            onClick={() => setLinkSourceTab('none')}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              linkSourceTab === 'none'
                ? 'bg-theme-bg text-theme-text border border-theme-border shadow-sm'
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <span>None / Custom</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Block Title */}
          <div>
            <label htmlFor="routine-block-title" className="block text-theme-muted font-medium mb-1">
              Block Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="routine-block-title"
              type="text"
              required
              placeholder={
                linkSourceTab === 'skill' 
                  ? 'e.g. Ep 14: Subsets & Permutations' 
                  : 'e.g. Algorithms LeetCode Sprint'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent transition-colors"
            />
          </div>

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="routine-start-time" className="block text-theme-muted font-medium mb-1">
                Start Time
              </label>
              <input
                id="routine-start-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
              />
            </div>
            <div>
              <label htmlFor="routine-end-time" className="block text-theme-muted font-medium mb-1">
                End Time
              </label>
              <input
                id="routine-end-time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label htmlFor="routine-category-select" className="block text-theme-muted font-medium mb-1">
              Category
            </label>
            <select
              id="routine-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent cursor-pointer"
            >
              <option value="Core Study">Core Study</option>
              <option value="Revision">Revision</option>
              <option value="Problem Solving">Problem Solving</option>
              <option value="Break">Break</option>
              <option value="Exercise/Break">Exercise/Break</option>
              <option value="Lab Project">Lab Project</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* ======================================================== */}
          {/* OPTION A: LINK TO SYLLABUS TOPIC                         */}
          {/* ======================================================== */}
          {linkSourceTab === 'syllabus' && (
            <div className="rounded-xl border border-theme-border/80 bg-theme-surface/50 overflow-hidden transition-all">
              <button
                type="button"
                id="toggle-syllabus-link-btn"
                onClick={() => setIsSyllabusCardOpen(!isSyllabusCardOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-theme-cardHover transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-theme-text truncate">
                    🔗 Link to Syllabus Topic (Optional)
                  </span>
                  {selectedTopic && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Linked
                    </span>
                  )}
                </div>
                <div className="p-1 text-theme-muted">
                  {isSyllabusCardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isSyllabusCardOpen && (
                <div id="syllabus-picker-card" className="p-4 pt-2 border-t border-theme-border/60 bg-theme-bg/30 space-y-3.5 animate-fadeIn">
                  {subjects.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-center">
                      <p className="text-amber-400 text-xs font-medium">
                        No syllabus found. Click here to add subjects & topics first.
                      </p>
                      <a
                        href="/syllabus.html"
                        className="inline-flex items-center gap-1 text-[11px] text-theme-accent hover:underline mt-1 font-semibold"
                      >
                        <span>Go to Subjects & Syllabus</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <>
                      {/* Subject Select */}
                      <div>
                        <label htmlFor="routine-subject-select" className="block text-theme-muted font-medium mb-1">
                          1. Select Subject
                        </label>
                        <select
                          id="routine-subject-select"
                          value={selectedSubjectId}
                          onChange={handleSubjectChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent cursor-pointer"
                        >
                          <option value="">-- Choose Subject --</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code ? `[${sub.code}] ` : ''}{sub.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Chapter Select */}
                      <div>
                        <label htmlFor="routine-chapter-select" className="block text-theme-muted font-medium mb-1">
                          2. Select Chapter / Unit
                        </label>
                        <select
                          id="routine-chapter-select"
                          disabled={!selectedSubjectId || availableChapters.length === 0}
                          value={selectedChapterId}
                          onChange={handleChapterChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {!selectedSubjectId 
                              ? '-- First select a subject --' 
                              : availableChapters.length === 0 
                              ? '-- No chapters in subject --' 
                              : '-- Choose Chapter / Unit --'}
                          </option>
                          {availableChapters.map((chap, idx) => (
                            <option key={chap.id} value={chap.id}>
                              Ch {idx + 1}: {chap.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Topic Selector */}
                      <div>
                        <label htmlFor="routine-topic-select" className="block text-theme-muted font-medium mb-1">
                          3. Topic Selector (Incomplete Topics)
                        </label>
                        <select
                          id="routine-topic-select"
                          disabled={!selectedChapterId}
                          value={selectedTopicId}
                          onChange={handleTopicChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {!selectedChapterId 
                              ? '-- First select a chapter --' 
                              : availableTopics.length === 0 
                              ? '-- All topics in this chapter are mastered --' 
                              : '-- Choose Topic to Study --'}
                          </option>
                          {availableTopics.map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              {topic.title} {topic.status ? `(${topic.status})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Fill Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-theme-border/40">
                        <button
                          type="button"
                          id="quick-fill-topic-btn"
                          onClick={handleQuickFillTopic}
                          disabled={!selectedTopic && !selectedChapter}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Copy topic name directly into Block Title"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Use Topic as Block Title</span>
                        </button>

                        {(selectedSubjectId || selectedTopicId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId('');
                              setSelectedChapterId('');
                              setSelectedTopicId('');
                            }}
                            className="text-[11px] text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Clear Link
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* OPTION B: LINK TO SKILL TRACKER VIDEO                     */}
          {/* ======================================================== */}
          {linkSourceTab === 'skill' && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden transition-all">
              <button
                type="button"
                id="toggle-skill-link-btn"
                onClick={() => setIsSkillCardOpen(!isSkillCardOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-purple-500/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="font-semibold text-theme-text truncate">
                    🎖️ Link to Skill Tracker Lecture
                  </span>
                  {selectedSkillVideo && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/25 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Linked
                    </span>
                  )}
                </div>
                <div className="p-1 text-theme-muted">
                  {isSkillCardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isSkillCardOpen && (
                <div id="skill-picker-card" className="p-4 pt-2 border-t border-purple-500/20 bg-theme-bg/40 space-y-3.5 animate-fadeIn">
                  {activeCourseSkills.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-purple-500/30 bg-purple-500/5 text-center">
                      <p className="text-purple-400 text-xs font-medium">
                        No skill courses found. Click here to add a YouTube playlist course first.
                      </p>
                      <a
                        href="/skills.html"
                        className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:underline mt-1 font-semibold"
                      >
                        <span>Go to Skill Tracker</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <>
                      {/* Course Dropdown */}
                      <div>
                        <label htmlFor="routine-skill-course-select" className="block text-theme-muted font-medium mb-1">
                          1. Select Course / Skill
                        </label>
                        <select
                          id="routine-skill-course-select"
                          value={selectedSkillId}
                          onChange={handleSkillChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                          <option value="">-- Choose Course / Skill --</option>
                          {activeCourseSkills.map((sk) => (
                            <option key={sk.id} value={sk.id}>
                              {sk.name} ({sk.category || 'Skill'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Level Dropdown */}
                      <div>
                        <label htmlFor="routine-skill-level-select" className="block text-theme-muted font-medium mb-1">
                          2. Select Course Level
                        </label>
                        <select
                          id="routine-skill-level-select"
                          disabled={!selectedSkillId || availableSkillLevels.length === 0}
                          value={selectedLevelNum}
                          onChange={handleSkillLevelChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {!selectedSkillId 
                              ? '-- First select a course --' 
                              : availableSkillLevels.length === 0 
                              ? '-- No levels defined --' 
                              : '-- All Levels / Filter by Level --'}
                          </option>
                          {availableSkillLevels.map((lvl, idx) => (
                            <option key={lvl.id || idx} value={lvl.levelNum || (idx + 1)}>
                              {lvl.title || `Level ${lvl.levelNum || (idx + 1)}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Video / Lecture Dropdown */}
                      <div>
                        <label htmlFor="routine-skill-video-select" className="block text-theme-muted font-medium mb-1">
                          3. Select Video / Lecture (Unwatched)
                        </label>
                        <select
                          id="routine-skill-video-select"
                          disabled={!selectedSkillId}
                          value={selectedVideoId}
                          onChange={handleSkillVideoChange}
                          className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {!selectedSkillId 
                              ? '-- First select a course --' 
                              : availableSkillVideos.length === 0 
                              ? '-- All lectures in this level are watched! 🎉 --' 
                              : '-- Choose Lecture to Study --'}
                          </option>
                          {availableSkillVideos.map((video) => (
                            <option key={video.videoId || video.id} value={video.videoId || video.id}>
                              {video.title} ({video.levelTitle || `Lvl ${video.level}`})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Fill Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-purple-500/20">
                        <button
                          type="button"
                          id="quick-fill-video-btn"
                          onClick={handleQuickFillVideo}
                          disabled={!selectedSkillVideo}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Copy video title directly into Block Title"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Use Video Title as Task Name</span>
                        </button>

                        {(selectedSkillId || selectedVideoId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSkillId('');
                              setSelectedLevelNum('');
                              setSelectedVideoId('');
                            }}
                            className="text-[11px] text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            Clear Link
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white font-semibold shadow-glow-accent transition-all cursor-pointer"
            >
              Save Time-Block
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
