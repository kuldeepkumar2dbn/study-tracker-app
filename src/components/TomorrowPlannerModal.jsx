import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Clock, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { getIncompleteSubtopics } from '../utils/routineSyllabusSync';
import { hasCalendarScope, requestCalendarScope } from '../services/google-auth';
import { 
  pushStudySessionToCalendar, 
  showCalendarSuccessToast, 
  getCalendarPreference, 
  setCalendarPreference 
} from '../services/calendar-sync';

const CATEGORIES = ['Core Study', 'Revision', 'Problem Solving'];

export default function TomorrowPlannerModal({
  isOpen,
  onClose,
  onSave,
  editingPlan = null,
  subjects = []
}) {
  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA');
  };

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [scheduledDate, setScheduledDate] = useState(getTomorrowDateStr());
  const [category, setCategory] = useState('Core Study');
  const [pushToCalendar, setPushToCalendar] = useState(() => getCalendarPreference());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Syllabus Link State
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicName, setSelectedTopicName] = useState('');

  // Pre-fill fields on open / edit
  useEffect(() => {
    if (editingPlan) {
      setTitle(editingPlan.title || '');
      setStartTime(editingPlan.startTime || '10:00');
      setEndTime(editingPlan.endTime || '12:00');
      setScheduledDate(editingPlan.scheduledDate || getTomorrowDateStr());
      setCategory(editingPlan.category || 'Core Study');
      if (editingPlan.syllabusLink) {
        setSelectedSubjectId(editingPlan.syllabusLink.subjectId || '');
        setSelectedChapterId(editingPlan.syllabusLink.chapterId || '');
        setSelectedTopicName(editingPlan.syllabusLink.topicName || '');
      } else {
        setSelectedSubjectId('');
        setSelectedChapterId('');
        setSelectedTopicName('');
      }
    } else {
      setTitle('');
      setStartTime('10:00');
      setEndTime('12:00');
      setScheduledDate(getTomorrowDateStr());
      setCategory('Core Study');
      setSelectedSubjectId('');
      setSelectedChapterId('');
      setSelectedTopicName('');
    }
  }, [editingPlan, isOpen]);

  // Computed syllabus selection helpers
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
    const incomplete = getIncompleteSubtopics(selectedChapter);
    if (incomplete.length > 0) return incomplete;
    if (selectedChapter.subtopics && selectedChapter.subtopics.length > 0) {
      return selectedChapter.subtopics;
    }
    return [{ id: selectedChapter.id, title: selectedChapter.title }];
  }, [selectedChapter]);

  const handleSubjectChange = (e) => {
    setSelectedSubjectId(e.target.value);
    setSelectedChapterId('');
    setSelectedTopicName('');
  };

  const handleChapterChange = (e) => {
    setSelectedChapterId(e.target.value);
    setSelectedTopicName('');
  };

  const handleTopicChange = (e) => {
    const val = e.target.value;
    setSelectedTopicName(val);
    if (val && (!title || title.trim() === '')) {
      setTitle(val);
    }
  };

  const handleQuickFill = () => {
    if (selectedTopicName) {
      setTitle(selectedTopicName);
    } else if (selectedChapter) {
      setTitle(selectedChapter.title);
    } else if (selectedSubject) {
      setTitle(selectedSubject.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    let syllabusLink = null;
    if (selectedSubject) {
      syllabusLink = {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        chapterId: selectedChapter?.id || 'chap_gen',
        chapterName: selectedChapter?.title || selectedSubject.name,
        topicName: selectedTopicName || selectedChapter?.title || selectedSubject.name
      };
    }

    let calendarEventId = editingPlan?.calendarEventId || null;

    if (pushToCalendar) {
      try {
        if (!hasCalendarScope()) {
          await requestCalendarScope();
        }
        const calRes = await pushStudySessionToCalendar({
          title: title.trim(),
          startTime,
          endTime,
          scheduledDate,
          subjectName: syllabusLink?.subjectName || null
        });

        if (calRes && calRes.success) {
          calendarEventId = calRes.eventId;
          showCalendarSuccessToast();
        }
      } catch (calErr) {
        console.warn('Tomorrow planner calendar sync error, saving locally:', calErr);
      }
    }

    onSave({
      id: editingPlan?.id,
      title: title.trim(),
      startTime,
      endTime,
      scheduledDate,
      category,
      syllabusLink,
      notified: false,
      calendarEventId
    });

    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="tomorrow-planner-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl glass-panel p-6 border border-theme-border shadow-2xl relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-sm">
              🌅
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-theme-text leading-tight">
                {editingPlan ? "Edit Tomorrow's Plan" : "Plan for Tomorrow"}
              </h3>
              <p className="text-xs text-theme-muted mt-0.5">
                Target date: <strong className="text-amber-400 font-mono-numbers">{scheduledDate}</strong>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          {/* Scheduled Time (Start & End Time) */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-theme-accent" />
              <span>Scheduled Time</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-theme-muted block mb-1">Start Time</span>
                <input
                  id="tomorrow-plan-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs sm:text-sm text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                />
              </div>
              <div>
                <span className="text-[11px] text-theme-muted block mb-1">End Time</span>
                <input
                  id="tomorrow-plan-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs sm:text-sm text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                />
              </div>
            </div>
          </div>

          {/* Link Syllabus Topic Selector */}
          <div className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Link Syllabus Topic (Optional)</span>
              </label>

              {(selectedTopicName || selectedChapter) && (
                <button
                  type="button"
                  id="quick-fill-tomorrow-topic-btn"
                  onClick={handleQuickFill}
                  className="text-[11px] text-theme-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Use Topic as Title</span>
                </button>
              )}
            </div>

            {subjects.length > 0 ? (
              <div className="space-y-2.5">
                {/* Subject Selector */}
                <div>
                  <span className="text-[10px] uppercase font-semibold text-theme-muted block mb-1">1. Subject</span>
                  <select
                    id="tomorrow-subject-select"
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="">-- Choose Subject (or leave unlinked) --</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} {sub.code ? `(${sub.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chapter Selector */}
                {selectedSubject && (
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-theme-muted block mb-1">2. Chapter / Unit</span>
                    <select
                      id="tomorrow-chapter-select"
                      value={selectedChapterId}
                      onChange={handleChapterChange}
                      className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                    >
                      <option value="">-- Choose Chapter --</option>
                      {availableChapters.map(chap => (
                        <option key={chap.id} value={chap.id}>
                          {chap.title} {chap.status ? `[${chap.status}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Topic Selector */}
                {selectedChapter && (
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-theme-muted block mb-1">3. Topic / Subtopic</span>
                    <select
                      id="tomorrow-topic-select"
                      value={selectedTopicName}
                      onChange={handleTopicChange}
                      className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                    >
                      <option value="">-- Choose Specific Topic --</option>
                      {availableTopics.map((top, idx) => (
                        <option key={top.id || idx} value={top.title}>
                          {top.title} {top.status ? `(${top.status})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-theme-muted">
                No syllabus subjects found. Fallback: Type your routine task title below.
              </p>
            )}
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="tomorrow-plan-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Integration Formulas & Practice"
              required
              className="w-full px-3 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-xs sm:text-sm text-theme-text focus:outline-none focus:border-theme-accent"
            />
          </div>

          {/* Category Pill Selector */}
          <div>
            <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? cat === 'Core Study'
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-sm'
                          : cat === 'Revision'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                        : 'bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text border-theme-border'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Google Calendar Push Toggle */}
          <div className="p-3.5 rounded-xl bg-theme-surface/70 border border-theme-border flex flex-col gap-1.5 transition-all">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-theme-text select-none">
              <input
                type="checkbox"
                id="tomorrow-push-calendar-toggle"
                checked={pushToCalendar}
                onChange={(e) => {
                  setPushToCalendar(e.target.checked);
                  setCalendarPreference(e.target.checked);
                }}
                className="w-4 h-4 rounded border-theme-border text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
              />
              <span className="font-semibold flex items-center gap-1.5">
                📅 Push to Google Calendar <span className="text-[11px] font-normal text-theme-muted">(30-min phone & lock-screen alarm)</span>
              </span>
            </label>
            {pushToCalendar && (
              <p className="text-[11px] text-theme-muted pl-6.5 flex items-center gap-1.5 animate-fadeIn">
                <span className="text-xs">🔔</span> Rings on your phone's calendar 30 minutes before the session starts.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-tomorrow-plan-btn"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors shadow-glow-amber flex items-center gap-1.5"
            >
              <span>{editingPlan ? "Update Plan" : "Add to Tomorrow's Plan"}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

