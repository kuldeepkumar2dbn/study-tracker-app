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
  CheckCircle2
} from 'lucide-react';
import { getIncompleteSubtopics, createRoutineBlock } from '../utils/routineSyllabusSync';

export default function AddRoutineModal({
  isOpen,
  onClose,
  onAddSlot,
  subjects = []
}) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Core Study');

  // Syllabus link expandable card state
  const [isSyllabusCardOpen, setIsSyllabusCardOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // Selected subject object
  const selectedSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  // Chapters belonging to selected subject
  const availableChapters = useMemo(() => {
    return selectedSubject?.topics || [];
  }, [selectedSubject]);

  // Selected chapter object
  const selectedChapter = useMemo(() => {
    return availableChapters.find(c => c.id === selectedChapterId) || null;
  }, [availableChapters, selectedChapterId]);

  // Incomplete subtopics under selected chapter
  const availableTopics = useMemo(() => {
    if (!selectedChapter) return [];
    return getIncompleteSubtopics(selectedChapter);
  }, [selectedChapter]);

  // Selected topic object
  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return availableTopics.find(t => t.id === selectedTopicId) || null;
  }, [availableTopics, selectedTopicId]);

  if (!isOpen) return null;

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

  // Quick fill block title with selected topic name
  const handleQuickFillTopic = () => {
    if (selectedTopic && selectedTopic.title) {
      setTitle(selectedTopic.title);
    } else if (selectedChapter && selectedChapter.title) {
      setTitle(selectedChapter.title);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let syllabusLink = null;
    if (selectedSubject && (selectedTopic || selectedChapter)) {
      const activeTopic = selectedTopic || {
        id: selectedChapter.id,
        title: selectedChapter.title
      };

      syllabusLink = {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        chapterId: selectedChapter?.id || activeTopic.id,
        chapterName: selectedChapter?.title || selectedSubject.name,
        topicId: activeTopic.id,
        topicName: activeTopic.title
      };
    }

    const newBlock = createRoutineBlock({
      title: title.trim(),
      startTime,
      endTime,
      category,
      syllabusLink
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
    setIsSyllabusCardOpen(false);
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
              <p className="text-[11px] text-theme-muted">Schedule focused study slots and align with course syllabus.</p>
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
              placeholder="e.g. Algorithms LeetCode Sprint"
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

          {/* Expandable/Collapsible Syllabus Link Card */}
          <div className="rounded-xl border border-theme-border/80 bg-theme-surface/50 overflow-hidden transition-all">
            <button
              type="button"
              id="toggle-syllabus-link-btn"
              onClick={() => setIsSyllabusCardOpen(!isSyllabusCardOpen)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-theme-cardHover transition-colors"
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
                
                {/* Fallback if no subjects exist */}
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
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                          className="text-[11px] text-theme-muted hover:text-rose-400 transition-colors"
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

          {/* Modal Actions */}
          <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white font-semibold shadow-glow-accent transition-all"
            >
              Save Time-Block
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
