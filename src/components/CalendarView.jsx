import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Repeat, 
  Award,
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { sanitizeUrl } from '../utils/security';
import AnimatedHeadline from './AnimatedHeadline';
import RollingNumber from './RollingNumber';
import { celebrateTaskCompletion } from '../utils/confetti';

/**
 * Timezone-Safe Local Date Formatter
 * Formats a Date object or date string into YYYY-MM-DD in local system time,
 * preventing UTC 1-day shift bugs in positive UTC timezones (e.g. IST UTC+5:30).
 */
export function getLocalDateString(date = new Date()) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CalendarView() {
  const { exams, subjects, addExam, skills } = useData();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New item modal state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('exam'); // 'exam' | 'assignment'
  const [newSubject, setNewSubject] = useState(subjects[0]?.name || 'General');
  const [newPriority, setNewPriority] = useState('High');
  const [newRoom, setNewRoom] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newSubmissionLink, setNewSubmissionLink] = useState('');

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of current month (0: Sun, 1: Mon, ..., 6: Sat)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Total days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Days in previous month for padding
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayIso = getLocalDateString(new Date());

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(getLocalDateString(today));
  };

  // Compile all calendar events
  // 1. Exams & Assignments
  const deadlineEvents = exams.map(e => ({
    id: e.id,
    dateStr: getLocalDateString(e.date),
    timeStr: e.date.includes('T') ? e.date.split('T')[1].slice(0, 5) : '09:00',
    type: e.type || 'exam',
    title: e.title,
    subject: e.subject,
    priority: e.priority,
    weight: e.weight,
    room: e.room,
    submissionLink: e.submissionLink,
    isCompleted: e.isCompleted
  }));

  // 2. Spaced Repetition Due Dates
  const revisionEvents = subjects.flatMap(sub => 
    sub.topics.filter(t => t.nextReviewDate).map(t => ({
      id: 'rev-' + t.id,
      dateStr: getLocalDateString(t.nextReviewDate),
      type: 'revision',
      title: `Revision: ${t.title}`,
      subject: sub.name,
      priority: 'Medium',
      stage: t.repetitionStage
    }))
  );

  const allEvents = [...deadlineEvents, ...revisionEvents];

  // Helper to get events for a date string YYYY-MM-DD
  const getEventsForDate = (dateStr) => {
    return allEvents.filter(ev => ev.dateStr === dateStr);
  };

  // Build grid calendar cells
  const calendarCells = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const dateStr = getLocalDateString(prevDate);
    calendarCells.push({
      dayNum,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayIso,
      events: getEventsForDate(dateStr)
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const currentCellDate = new Date(year, month, day);
    const dateStr = getLocalDateString(currentCellDate);
    calendarCells.push({
      dayNum: day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayIso,
      events: getEventsForDate(dateStr)
    });
  }

  // Next month leading days to complete grid (42 cells for 6 rows)
  const remainingCells = 42 - calendarCells.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(year, month + 1, day);
    const dateStr = getLocalDateString(nextDate);
    calendarCells.push({
      dayNum: day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayIso,
      events: getEventsForDate(dateStr)
    });
  }

  const selectedEvents = getEventsForDate(selectedDate);

  const handleCreateDateEvent = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addExam({
      type: newType,
      title: newTitle.trim(),
      subject: newSubject,
      date: `${selectedDate}T09:00:00`,
      priority: newPriority,
      room: newRoom.trim() || (newType === 'assignment' ? 'Online Submission' : 'Exam Hall'),
      weight: newWeight.trim() || (newType === 'assignment' ? '15% Assignment' : '30% of grade'),
      submissionLink: newSubmissionLink.trim()
    });

    celebrateTaskCompletion();

    setNewTitle('');
    setNewSubmissionLink('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-theme-accent shrink-0" />
            <AnimatedHeadline 
              text="Interactive Study & Milestone Calendar" 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Synchronized calendar displaying exams, homework assignments, and spaced repetition curves.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-theme-muted">Exams</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-theme-muted">Assignments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            <span className="text-theme-muted">Revision Due</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar (8 cols) + Selected Day Agenda Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Calendar Grid (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl glass-panel p-5 sm:p-6 border border-theme-border card-glow-hover space-y-4">
          
          {/* Calendar Navigation Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-extrabold text-xl text-theme-text tracking-tight">
                {monthName}
              </h2>
              <button
                onClick={jumpToToday}
                className="px-2.5 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-accent transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-theme-muted py-1 border-b border-theme-border/60">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              const isSelected = cell.dateStr === selectedDate;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[72px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-theme-accent/15 border-theme-accent ring-2 ring-theme-accent/30 shadow-md'
                      : cell.isToday
                      ? 'border-emerald-400 bg-emerald-500/5'
                      : cell.isCurrentMonth
                      ? 'bg-theme-surface/70 border-theme-border hover:border-theme-accent/40'
                      : 'bg-theme-bg/30 border-transparent text-theme-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono-numbers font-semibold ${
                      cell.isToday
                        ? 'text-emerald-400 font-extrabold'
                        : cell.isCurrentMonth
                        ? 'text-theme-text'
                        : 'text-theme-muted/40'
                    }`}>
                      {cell.dayNum}
                    </span>

                    {cell.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    )}
                  </div>

                  {/* Event Indicator Dots */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cell.events.slice(0, 3).map((ev, evIdx) => (
                      <span
                        key={evIdx}
                        title={ev.title}
                        className={`w-2 h-2 rounded-full ${
                          ev.type === 'exam'
                            ? 'bg-rose-500'
                            : ev.type === 'assignment'
                            ? 'bg-amber-400'
                            : 'bg-purple-400'
                        }`}
                      />
                    ))}
                    {cell.events.length > 3 && (
                      <span className="text-[9px] font-mono-numbers text-theme-muted">
                        +{cell.events.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Selected Date Agenda Panel (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl glass-panel p-5 sm:p-6 border border-theme-border card-glow-hover flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-theme-border/60 mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                  <span>Agenda Detail</span>
                  <span>•</span>
                  <span className="text-theme-accent font-mono-numbers">
                    <RollingNumber value={selectedEvents.length} /> events
                  </span>
                </span>
                <h3 className="font-display font-bold text-base text-theme-text font-mono-numbers">
                  {(() => {
                    if (!selectedDate) return 'Select a date';
                    const parts = selectedDate.split('-').map(Number);
                    if (parts.length === 3) {
                      const d = new Date(parts[0], parts[1] - 1, parts[2]);
                      return d.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    }
                    return selectedDate;
                  })()}
                </h3>
              </div>

              {selectedDate === todayIso && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Today
                </span>
              )}
            </div>

            {/* List of events on this date */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {selectedEvents.map((ev, idx) => (
                <div
                  key={idx}
                  className="card-glow-hover p-3.5 rounded-xl bg-theme-surface border border-theme-border space-y-1.5 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      ev.type === 'exam'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : ev.type === 'assignment'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                    }`}>
                      {ev.type}
                    </span>

                    {ev.priority && (
                      <span className="text-[10px] text-theme-muted font-semibold">
                        {ev.priority} Priority
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold text-xs text-theme-text leading-tight">
                    {ev.title}
                  </h4>
                  <p className="text-[11px] text-theme-muted">{ev.subject}</p>

                  {ev.room && (
                    <p className="text-[10px] text-theme-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-theme-accent" />
                      {ev.room}
                    </p>
                  )}

                  {ev.submissionLink && (
                    <a
                      href={sanitizeUrl(ev.submissionLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-theme-accent hover:underline flex items-center gap-1 pt-1"
                    >
                      <span>Submission Portal Link</span>
                      &rarr;
                    </a>
                  )}
                </div>
              ))}

              {selectedEvents.length === 0 && (
                <div className="py-12 text-center text-xs text-theme-muted">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-theme-border" />
                  <p className="font-semibold text-theme-text">No events on this date</p>
                  <p className="text-[11px] mt-0.5">Use the button below to schedule an exam or assignment.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Date Button */}
          <div className="pt-3 border-t border-theme-border/60">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Important Date ({selectedDate})</span>
            </button>
          </div>
        </div>

      </div>

      {/* Add Date Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">
                Add Event for {selectedDate}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDateEvent} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Category</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="exam">Exam / Test</option>
                    <option value="assignment">Assignment / Project</option>
                  </select>
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder={newType === 'assignment' ? 'e.g. Problem Set 5 Submission' : 'e.g. Midterm Examination'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Subject</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>

              {newType === 'assignment' ? (
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Submission Portal Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://classroom.google.com"
                    value={newSubmissionLink}
                    onChange={(e) => setNewSubmissionLink(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Exam Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Science Hall 204 or Online"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              )}

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
                  Schedule Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
