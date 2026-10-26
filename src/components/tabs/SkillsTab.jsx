import React, { useState } from 'react';
import { 
  Award, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Sliders, 
  Sparkles, 
  FolderGit2, 
  Flame,
  X,
  Check,
  CheckSquare,
  Square,
  Tag,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  Play
} from 'lucide-react';
import YouTubeIcon from '../YouTubeIcon';
import { useData } from '../../context/DataContext';
import YouTubeCourseModal from '../YouTubeCourseModal';
import DeleteConfirmModal from '../DeleteConfirmModal';
import UndoToast from '../UndoToast';
import { calculateCourseProgress } from '../../utils/youtubeCourseParser';

export default function SkillsTab() {
  const { 
    skills, 
    addSkill, 
    deleteSkill,
    restoreSkill,
    toggleSubtopic,
    deleteSubtopic,
    restoreSubtopic,
    deleteLecture,
    restoreLecture,
    deleteLevel,
    restoreLevel,
    updateSkillLevel, 
    addSkillMilestone, 
    toggleSkillMilestone, 
    deleteSkillMilestone,
    restoreSkillMilestone,
    logSkillHours 
  } = useData();

  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'courses' | 'manual'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);

  // Safe Deletion & Undo State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  // Collapsed state for levels (default expanded)
  const [collapsedLevels, setCollapsedLevels] = useState({});

  // New manual skill form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Engineering');
  const [levelNum, setLevelNum] = useState(3);
  const [masteryPct, setMasteryPct] = useState(60);
  const [tagsInput, setTagsInput] = useState('');

  // Inline milestone input per skill
  const [newMilestoneTitles, setNewMilestoneTitles] = useState({});
  const [newMilestoneTypes, setNewMilestoneTypes] = useState({});

  const categories = ['All', ...new Set(skills.map(s => s.category || 'General'))];

  const filteredSkills = skills.filter(sk => {
    const matchesCategory = filterCategory === 'All' || sk.category === filterCategory;
    const matchesType = filterType === 'all' 
      ? true 
      : filterType === 'courses' 
        ? (sk.isCourse || (sk.levels && sk.levels.length > 0))
        : (!sk.isCourse && (!sk.levels || sk.levels.length === 0));

    return matchesCategory && matchesType;
  });

  const getTierDetails = (level) => {
    switch (Number(level)) {
      case 1: return { label: 'Level 1: Novice', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' };
      case 2: return { label: 'Level 2: Apprentice', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 3: return { label: 'Level 3: Intermediate', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      case 4: return { label: 'Level 4: Advanced', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 5: return { label: 'Level 5: Expert', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      default: return { label: 'Level 3: Intermediate', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    }
  };

  const handleCreateSkill = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tagsArr = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    addSkill({
      name: name.trim(),
      category,
      levelNum: Number(levelNum),
      masteryPct: Number(masteryPct),
      tags: tagsArr.length ? tagsArr : ['Skill']
    });

    setName('');
    setTagsInput('');
    setIsAddModalOpen(false);
  };

  const handleAddMilestone = (skillId) => {
    const title = newMilestoneTitles[skillId];
    if (!title || !title.trim()) return;
    const type = newMilestoneTypes[skillId] || 'project';

    addSkillMilestone(skillId, title.trim(), type);
    setNewMilestoneTitles(prev => ({ ...prev, [skillId]: '' }));
  };

  // Toggle level accordion
  const toggleLevelCollapse = (levelId) => {
    setCollapsedLevels(prev => ({ ...prev, [levelId]: !prev[levelId] }));
  };

  // ----------------------------------------------------------------
  // Safe Deletion & Snapshot Execution
  // ----------------------------------------------------------------
  const requestDeletion = ({ type, name, executeDelete, executeRestore }) => {
    setDeleteTarget({
      type,
      name,
      executeDelete,
      executeRestore
    });
  };

  const confirmDeletion = () => {
    if (!deleteTarget) return;

    // 1. Take snapshot in memory
    const snapshot = {
      type: deleteTarget.type,
      name: deleteTarget.name,
      restore: deleteTarget.executeRestore,
      timestamp: Date.now()
    };
    setUndoSnapshot(snapshot);

    // 2. Perform deletion
    deleteTarget.executeDelete();

    // 3. Close confirm modal
    setDeleteTarget(null);
  };

  const handleUndo = () => {
    if (undoSnapshot && undoSnapshot.restore) {
      undoSnapshot.restore();
    }
    setUndoSnapshot(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <Award className="w-6 h-6 text-theme-accent" />
            Skill Tracker & Course Mastery
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Track competency mastery, import multi-tier YouTube courses with actionable checkboxes, and manage deliberate practice.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsYouTubeModalOpen(true)}
            id="import-youtube-course-btn"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 hover:text-red-300 font-semibold text-xs transition-all shadow-sm active:scale-95"
          >
            <YouTubeIcon className="w-4 h-4 fill-red-500 text-red-500" />
            <span>+ Import from YouTube</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            id="add-new-skill-btn"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Skill</span>
          </button>
        </div>
      </div>

      {/* Filter Bar: Categories & Type toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`filter-pill px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap active:scale-95 transition-all ${
                filterCategory === cat
                  ? 'bg-theme-accent text-white shadow-sm'
                  : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Type Toggle: All / Courses / Manual */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-theme-surface border border-theme-border self-start sm:self-auto shrink-0 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterType === 'all' ? 'bg-theme-card text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            All ({skills.length})
          </button>
          <button
            onClick={() => setFilterType('courses')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
              filterType === 'courses' ? 'bg-theme-card text-red-400 shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <YouTubeIcon className="w-3 h-3 fill-red-500 text-red-500" />
            <span>Courses</span>
          </button>
          <button
            onClick={() => setFilterType('manual')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterType === 'manual' ? 'bg-theme-card text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredSkills.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-theme-border bg-theme-surface/30">
          <Award className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-50" />
          <h3 className="font-display font-bold text-base text-theme-text mb-1">
            No competencies found in this view
          </h3>
          <p className="text-xs text-theme-muted max-w-sm mx-auto mb-4">
            Import a complete YouTube course syllabus or add a custom skill to begin tracking mastery.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setIsYouTubeModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-red-600/15 border border-red-600/30 text-red-400 font-semibold text-xs hover:bg-red-600/25 transition-colors flex items-center gap-2"
            >
              <YouTubeIcon className="w-4 h-4 fill-red-500 text-red-500" />
              <span>Import from YouTube</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs hover:bg-theme-accentHover transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Skill</span>
            </button>
          </div>
        </div>
      )}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 gap-6">
        {filteredSkills.map((skill, skillIndex) => {
          const isCourseSkill = !!skill.isCourse || (skill.levels && skill.levels.length > 0);

          // -------------------------------------------------------------
          // RENDER: YouTube Course / Multi-Tier Roadmap
          // -------------------------------------------------------------
          if (isCourseSkill) {
            const progress = calculateCourseProgress(skill);
            const totalLevels = (skill.levels || []).length;
            const totalLectures = (skill.levels || []).reduce((acc, lvl) => acc + (lvl.lectures || []).length, 0);

            return (
              <div 
                key={skill.id}
                className="rounded-2xl glass-panel p-6 border border-theme-border hover:border-theme-accent/40 transition-all shadow-sm space-y-5"
              >
                {/* Course Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-theme-border">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Thumbnail or Course Icon */}
                    {skill.thumbnailUrl ? (
                      <div className="relative group shrink-0">
                        <img 
                          src={skill.thumbnailUrl} 
                          alt="Course thumbnail" 
                          className="w-24 h-16 object-cover rounded-xl border border-theme-border/60 shadow-sm"
                        />
                        {skill.youtubeUrl && (
                          <a
                            href={skill.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-xl transition-opacity"
                            title="Open on YouTube"
                          >
                            <Play className="w-6 h-6 fill-white text-white" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-red-600/10 border border-red-600/20 text-red-500 shrink-0">
                        <YouTubeIcon className="w-6 h-6 fill-red-500 text-red-500" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-600/30 bg-red-600/10 text-red-400 flex items-center gap-1">
                          <YouTubeIcon className="w-3 h-3 fill-red-500 text-red-500" />
                          <span>YouTube Course</span>
                        </span>
                        <span className="text-xs text-theme-muted font-medium">{skill.category}</span>
                        {skill.authorName && (
                          <span className="text-xs text-theme-muted font-medium">&bull; {skill.authorName}</span>
                        )}
                      </div>

                      <h3 className="font-display font-bold text-lg text-theme-text leading-snug">
                        {skill.name}
                      </h3>

                      {/* Course Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(skill.tags || []).map((tg, i) => (
                          <span 
                            key={i} 
                            className="text-[10px] px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted"
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Watch Link & Delete Entire Course */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {skill.youtubeUrl && (
                      <a
                        href={skill.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text flex items-center gap-1.5 transition-colors"
                        title="Watch full course on YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                        <span>Source Video</span>
                      </a>
                    )}

                    {/* Trash icon: Entire Course */}
                    <button
                      onClick={() => {
                        requestDeletion({
                          type: 'Course / Skill',
                          name: skill.name,
                          executeDelete: () => deleteSkill(skill.id),
                          executeRestore: () => restoreSkill(skill, skillIndex)
                        });
                      }}
                      className="p-2 rounded-xl text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete entire course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dynamic Course Progress Bar */}
                <div className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-theme-text">Course Progress</span>
                      <span className="text-[11px] font-mono-numbers text-theme-muted">
                        ({progress.completedSubtopics} / {progress.totalSubtopics} items checked)
                      </span>
                    </div>
                    <span className="font-mono-numbers font-bold text-theme-accent text-sm">
                      {progress.percentage}% Completed
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-theme-bg overflow-hidden border border-theme-border/40">
                    <div 
                      className="h-full bg-gradient-to-r from-theme-accent via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(progress.percentage > 0 ? 4 : 0, progress.percentage)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-theme-muted pt-1">
                    <span>{totalLevels} Levels &bull; {totalLectures} Lectures</span>
                    {progress.percentage === 100 && (
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Course Mastered!
                      </span>
                    )}
                  </div>
                </div>

                {/* Levels & Modules Section */}
                <div className="space-y-4">
                  {(skill.levels || []).map((lvl, levelIndex) => {
                    const isCollapsed = !!collapsedLevels[lvl.id];
                    const lvlSubtopics = (lvl.lectures || []).flatMap(lec => lec.subtopics || []);
                    const lvlCompleted = lvlSubtopics.filter(s => s.done).length;
                    const lvlTotal = lvlSubtopics.length;
                    const lvlPct = lvlTotal > 0 ? Math.round((lvlCompleted / lvlTotal) * 100) : 0;

                    return (
                      <div 
                        key={lvl.id}
                        className="rounded-xl border border-theme-border/80 bg-theme-bg/40 overflow-hidden transition-all"
                      >
                        {/* Level Header */}
                        <div className="p-3.5 bg-theme-surface/60 border-b border-theme-border/60 flex items-center justify-between gap-3">
                          <button
                            onClick={() => toggleLevelCollapse(lvl.id)}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-90 transition-opacity"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-theme-muted shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-theme-muted shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display font-bold text-sm text-theme-text">
                                  {lvl.title}
                                </span>
                                {lvl.tierBadge && (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lvl.badgeColor || 'text-sky-400 bg-sky-500/10 border-sky-500/20'}`}>
                                    {lvl.tierBadge}
                                  </span>
                                )}
                              </div>
                              {lvl.description && (
                                <p className="text-[11px] text-theme-muted mt-0.5 truncate">
                                  {lvl.description}
                                </p>
                              )}
                            </div>
                          </button>

                          {/* Level Progress & Trash Icon */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] font-mono-numbers text-theme-muted">
                              <strong className="text-theme-text">{lvlCompleted}</strong>/{lvlTotal} done ({lvlPct}%)
                            </span>

                            {/* Trash icon: Entire Level */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeletion({
                                  type: 'Level / Module',
                                  name: lvl.title,
                                  executeDelete: () => deleteLevel(skill.id, lvl.id),
                                  executeRestore: () => restoreLevel(skill.id, lvl, levelIndex)
                                });
                              }}
                              className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete entire level"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Lectures inside Level (Expandable) */}
                        {!isCollapsed && (
                          <div className="p-3.5 space-y-3">
                            {(lvl.lectures || []).map((lec, lectureIndex) => (
                              <div 
                                key={lec.id}
                                className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border/70 space-y-2.5 transition-all hover:border-theme-border"
                              >
                                {/* Lecture Title Row */}
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <BookOpen className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                                    <h4 className="font-semibold text-xs text-theme-text truncate" title={lec.title}>
                                      {lec.title}
                                    </h4>
                                    {lec.duration && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-bg border border-theme-border text-theme-muted shrink-0 font-mono-numbers">
                                        {lec.duration}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Direct "Watch on YouTube" button/link */}
                                    {lec.youtubeUrl && (
                                      <a
                                        href={lec.youtubeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-600/30 text-red-400 hover:text-red-300 text-[11px] font-semibold transition-colors"
                                        title="Watch this lecture on YouTube"
                                      >
                                        <YouTubeIcon className="w-3 h-3 fill-red-500 text-red-500" />
                                        <span>Watch on YouTube</span>
                                      </a>
                                    )}

                                    {/* Trash icon: Entire Lecture */}
                                    <button
                                      onClick={() => {
                                        requestDeletion({
                                          type: 'Lecture',
                                          name: lec.title,
                                          executeDelete: () => deleteLecture(skill.id, lvl.id, lec.id),
                                          executeRestore: () => restoreLecture(skill.id, lvl.id, lec, lectureIndex)
                                        });
                                      }}
                                      className="p-1 rounded-md text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                      title="Delete lecture"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Actionable Subtopics / Practice Checkboxes */}
                                <div className="space-y-1.5 pt-1 pl-1">
                                  {(lec.subtopics || []).map((st, subtopicIndex) => (
                                    <div
                                      key={st.id}
                                      className={`group/st flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                                        st.done 
                                          ? 'text-theme-muted bg-theme-bg/20' 
                                          : 'text-theme-text hover:bg-theme-bg/40'
                                      }`}
                                    >
                                      {/* Checkbox & Title */}
                                      <button
                                        type="button"
                                        onClick={() => toggleSubtopic(skill.id, lvl.id, lec.id, st.id)}
                                        className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                                      >
                                        {st.done ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-theme-muted hover:text-theme-accent shrink-0 transition-colors" />
                                        )}
                                        <span className={`text-[11px] truncate ${st.done ? 'line-through text-theme-muted' : ''}`}>
                                          {st.title}
                                        </span>
                                      </button>

                                      {/* Subtle Trash Icon on individual subtopic */}
                                      <button
                                        onClick={() => {
                                          requestDeletion({
                                            type: 'Subtopic',
                                            name: st.title,
                                            executeDelete: () => deleteSubtopic(skill.id, lvl.id, lec.id, st.id),
                                            executeRestore: () => restoreSubtopic(skill.id, lvl.id, lec.id, st, subtopicIndex)
                                          });
                                        }}
                                        className="opacity-0 group-hover/st:opacity-100 p-1 text-theme-muted hover:text-rose-400 rounded transition-opacity"
                                        title="Delete subtopic"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}

                                  {(!lec.subtopics || lec.subtopics.length === 0) && (
                                    <p className="text-[10px] text-theme-muted italic">
                                      No practice checkboxes for this lecture.
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}

                            {(!lvl.lectures || lvl.lectures.length === 0) && (
                              <p className="text-xs text-theme-muted italic py-2 text-center">
                                No lectures remaining in this level.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Practice Hours Footer */}
                <div className="pt-3 border-t border-theme-border/60 flex items-center justify-between text-xs">
                  <span className="text-theme-muted">
                    Practice Logged: <strong className="text-theme-text font-mono-numbers">{skill.hoursLogged || 0} hrs</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => logSkillHours(skill.id, 1)}
                      className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-accent transition-colors"
                    >
                      +1h Practice
                    </button>
                    <button
                      onClick={() => logSkillHours(skill.id, 2)}
                      className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-accent transition-colors"
                    >
                      +2h Deep Work
                    </button>
                  </div>
                </div>

              </div>
            );
          }

          // -------------------------------------------------------------
          // RENDER: Standard Manual Skill
          // -------------------------------------------------------------
          const tier = getTierDetails(skill.levelNum);
          const completedMilestonesCount = (skill.milestones || []).filter(m => m.done).length;
          const totalMilestonesCount = (skill.milestones || []).length;

          return (
            <div 
              key={skill.id}
              className="rounded-2xl glass-panel p-6 border border-theme-border hover:border-theme-accent/40 transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                {/* Header with Tier & Trash Icon */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tier.color}`}>
                      {tier.label}
                    </span>
                    <span className="text-xs text-theme-muted">{skill.category}</span>
                  </div>

                  {/* Trash icon: Entire Manual Skill */}
                  <button
                    onClick={() => {
                      requestDeletion({
                        type: 'Skill',
                        name: skill.name,
                        executeDelete: () => deleteSkill(skill.id),
                        executeRestore: () => restoreSkill(skill, skillIndex)
                      });
                    }}
                    className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete skill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-display font-bold text-lg text-theme-text">
                    {skill.name}
                  </h3>
                  <span className="font-mono-numbers font-bold text-theme-accent text-sm">
                    {skill.masteryPct}% Mastery
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(skill.tags || []).map((tg, i) => (
                    <span 
                      key={i} 
                      className="text-[10px] px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted"
                    >
                      #{tg}
                    </span>
                  ))}
                </div>

                {/* 1-5 Level Slider & Progress Bar */}
                <div className="p-4 rounded-xl bg-theme-bg/60 border border-theme-border/60 mb-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-theme-muted font-medium flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-theme-accent" />
                      Proficiency Level Slider (1 - 5)
                    </span>
                    <span className="font-mono-numbers font-bold text-theme-text">
                      Tier {skill.levelNum} / 5
                    </span>
                  </div>

                  {/* Level Slider Input */}
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={skill.levelNum}
                    onChange={(e) => {
                      const lvl = Number(e.target.value);
                      updateSkillLevel(skill.id, lvl, Math.min(100, lvl * 20));
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-2 bg-theme-surface rounded-lg appearance-none"
                  />

                  {/* Visual Gradient Progress Bar */}
                  <div>
                    <div className="w-full h-2.5 rounded-full bg-theme-surface overflow-hidden border border-theme-border/40">
                      <div 
                        className="h-full bg-gradient-to-r from-theme-accent via-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, skill.masteryPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Milestones & Completed Projects Log */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                      Key Milestones & Projects ({completedMilestonesCount}/{totalMilestonesCount})
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(skill.milestones || []).map((m, milestoneIndex) => (
                      <div
                        key={m.id}
                        className={`group/m p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2.5 transition-colors ${
                          m.done 
                            ? 'bg-theme-bg/40 text-theme-muted border-theme-border/40' 
                            : 'bg-theme-surface text-theme-text border-theme-border hover:border-theme-accent/40'
                        }`}
                      >
                        <div 
                          onClick={() => toggleSkillMilestone(skill.id, m.id)}
                          className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                        >
                          {m.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-theme-muted shrink-0" />
                          )}
                          <span className={`truncate ${m.done ? 'line-through' : ''}`}>{m.title}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            m.type === 'project' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {m.type === 'project' ? 'Project' : 'Milestone'}
                          </span>

                          {/* Trash icon: Milestone */}
                          <button
                            onClick={() => {
                              requestDeletion({
                                type: 'Milestone',
                                name: m.title,
                                executeDelete: () => deleteSkillMilestone(skill.id, m.id),
                                executeRestore: () => restoreSkillMilestone(skill.id, m, milestoneIndex)
                              });
                            }}
                            className="opacity-0 group-hover/m:opacity-100 p-1 text-theme-muted hover:text-rose-400 rounded transition-opacity"
                            title="Delete milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {(!skill.milestones || skill.milestones.length === 0) && (
                      <p className="text-xs text-theme-muted italic py-1">
                        No projects or milestones logged yet.
                      </p>
                    )}
                  </div>

                  {/* Add Milestone Inline Field */}
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Log key milestone or completed project..."
                      value={newMilestoneTitles[skill.id] || ''}
                      onChange={(e) => setNewMilestoneTitles(prev => ({ ...prev, [skill.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddMilestone(skill.id);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
                    />

                    <select
                      value={newMilestoneTypes[skill.id] || 'project'}
                      onChange={(e) => setNewMilestoneTypes(prev => ({ ...prev, [skill.id]: e.target.value }))}
                      className="px-2 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none"
                    >
                      <option value="project">Project</option>
                      <option value="milestone">Milestone</option>
                    </select>

                    <button
                      onClick={() => handleAddMilestone(skill.id)}
                      className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-theme-accent" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Hours Log Footer */}
              <div className="pt-3 border-t border-theme-border/60 flex items-center justify-between text-xs">
                <span className="text-theme-muted">
                  Logged: <strong className="text-theme-text font-mono-numbers">{skill.hoursLogged} hrs</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => logSkillHours(skill.id, 1)}
                    className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-accent transition-colors"
                  >
                    +1h Practice
                  </button>
                  <button
                    onClick={() => logSkillHours(skill.id, 2)}
                    className="px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-accent transition-colors"
                  >
                    +2h Deep Work
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Manual Skill Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">Track New Skill Competency</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSkill} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Skill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python, Circuit Analysis, System Design"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Core, Backend, Math"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              {/* Level & Mastery % */}
              <div className="space-y-3 p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-theme-text">Initial Level Slider (1 - 5):</label>
                  <span className="font-bold text-theme-accent font-mono-numbers">Level {levelNum}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={levelNum}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLevelNum(val);
                    setMasteryPct(val * 20);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-theme-bg rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[10px] text-theme-muted font-mono-numbers">
                  <span>1: Novice</span>
                  <span>2: Apprentice</span>
                  <span>3: Intermediate</span>
                  <span>4: Advanced</span>
                  <span>5: Expert</span>
                </div>
              </div>

              <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold hover:bg-theme-accentHover shadow-sm"
                >
                  Track Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import from YouTube Modal */}
      <YouTubeCourseModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onImport={(courseData) => {
          addSkill(courseData);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        itemType={deleteTarget?.type}
        itemName={deleteTarget?.name}
        onConfirm={confirmDeletion}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 6-Second Floating Undo Toast Banner */}
      <UndoToast
        snapshot={undoSnapshot}
        onUndo={handleUndo}
        onDismiss={() => setUndoSnapshot(null)}
        duration={6000}
      />

    </div>
  );
}
