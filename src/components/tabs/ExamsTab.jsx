import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  Trash2, 
  CheckCircle2, 
  Check, 
  Sparkles, 
  X, 
  Filter, 
  FileText, 
  ExternalLink,
  Layers,
  CheckSquare
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { sanitizeUrl } from '../../utils/security';
import { celebrateTaskCompletion } from '../../utils/confetti';
import AnimatedHeadline from '../AnimatedHeadline';
import RollingNumber from '../RollingNumber';

export default function ExamsTab() {
  const { exams, addExam, updateAssignmentStatus, toggleExamCompleted, deleteExam, subjects } = useData();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [categoryFilter, setCategoryFilter] = useState('All'); // 'All', 'exams', 'assignments', 'submitted'
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [newType, setNewType] = useState('exam'); // 'exam' | 'assignment'
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(subjects[0]?.name || 'General');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [room, setRoom] = useState('');
  const [priority, setPriority] = useState('High');
  const [weight, setWeight] = useState('30% of grade');
  const [submissionLink, setSubmissionLink] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState('Pending');
  const [notes, setNotes] = useState('');

  // Live countdown tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateCountdownDetails = (targetDateIso) => {
    const target = new Date(targetDateIso).getTime();
    const diff = target - currentTime;

    const totalDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((Math.max(0, diff) / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((Math.max(0, diff) / 1000 / 60) % 60);
    const seconds = Math.floor((Math.max(0, diff) / 1000) % 60);

    let badgeText = '';
    let badgeClass = '';

    if (diff <= 0) {
      badgeText = 'Completed / Passed';
      badgeClass = 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    } else if (totalDays <= 1) {
      badgeText = 'Urgent! (Today)';
      badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
    } else if (totalDays === 2) {
      badgeText = 'Tomorrow';
      badgeClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    } else if (totalDays <= 3) {
      badgeText = `Urgent! (${totalDays} Days)`;
      badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    } else if (totalDays <= 7) {
      badgeText = `In ${totalDays} Days`;
      badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    } else {
      badgeText = `In ${totalDays} Days`;
      badgeClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }

    return {
      days: Math.max(0, totalDays),
      hours,
      minutes,
      seconds,
      isPast: diff <= 0,
      badgeText,
      badgeClass
    };
  };

  const handleCreateDeadline = (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    const combinedDateTime = `${date}T${time || '09:00'}:00`;
    addExam({
      type: newType,
      title: title.trim(),
      subject,
      date: new Date(combinedDateTime).toISOString(),
      room: room.trim() || (newType === 'assignment' ? 'Online Portal' : 'Main Exam Hall'),
      priority,
      weight,
      notes: notes.trim(),
      submissionLink: submissionLink.trim(),
      assignmentStatus: newType === 'assignment' ? assignmentStatus : undefined,
      isCompleted: newType === 'assignment' && assignmentStatus === 'Submitted'
    });

    setTitle('');
    setDate('');
    setRoom('');
    setSubmissionLink('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  // Sort upcoming deadlines strictly by date
  const sortedDeadlines = [...exams].sort((a, b) => new Date(a.date) - new Date(b.date));

  const filteredDeadlines = sortedDeadlines.filter(item => {
    const matchesSubject = selectedSubjectFilter === 'All' || item.subject === selectedSubjectFilter;

    let matchesCategory = true;
    if (categoryFilter === 'exams') matchesCategory = (item.type === 'exam' || !item.type) && !item.isCompleted;
    else if (categoryFilter === 'assignments') matchesCategory = item.type === 'assignment' && !item.isCompleted;
    else if (categoryFilter === 'submitted') matchesCategory = item.isCompleted;
    else if (categoryFilter === 'All') matchesCategory = !item.isCompleted; // Active radar

    return matchesSubject && matchesCategory;
  });

  const allSubjectsOptions = ['All', ...new Set(subjects.map(s => s.name))];
  const examsCount = exams.filter(e => (!e.type || e.type === 'exam') && !e.isCompleted).length;
  const assignmentsCount = exams.filter(e => e.type === 'assignment' && !e.isCompleted).length;
  const submittedCount = exams.filter(e => e.isCompleted).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-rose-500 shrink-0" />
            <AnimatedHeadline 
              text="Exam & Assignment Deadline Radar" 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Real-time countdown radar tracking academic tests, homework submissions, and milestone deliverables.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all duration-200 hover:brightness-110 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Exam / Assignment</span>
        </button>
      </div>

      {/* Filter Pills: All, Exams Only, Assignments Only, Submitted/Completed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'All', title: 'Active Radar', count: examsCount + assignmentsCount },
            { id: 'exams', title: 'Exams Only', count: examsCount },
            { id: 'assignments', title: 'Assignments Only', count: assignmentsCount },
            { id: 'submitted', title: 'Submitted/Completed', count: submittedCount },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setCategoryFilter(pill.id)}
              className={`filter-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                categoryFilter === pill.id
                  ? 'bg-theme-accent text-white shadow-sm'
                  : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              <span>{pill.title}</span>
              <span className={`px-1.5 py-0.2 rounded-md font-mono-numbers text-[10px] ${
                categoryFilter === pill.id ? 'bg-white/20 text-white' : 'bg-theme-bg text-theme-muted'
              }`}>
                <RollingNumber value={pill.count} />
              </span>
            </button>
          ))}
        </div>

        {/* Subject Filter Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-theme-muted" />
          <span className="text-xs text-theme-muted font-medium">Subject:</span>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="card-action-select px-3 py-1.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent transition-all duration-150"
          >
            {allSubjectsOptions.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadlines Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDeadlines.map((item) => {
          const cd = calculateCountdownDetails(item.date);
          const isAssignment = item.type === 'assignment';
          const deadlineDateFormatted = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }).format(new Date(item.date));

          const isUrgent = cd.badgeText.includes('Urgent') || cd.badgeText.includes('Tomorrow');

          return (
            <div 
              key={item.id}
              className={`exam-card card-glow-hover rounded-2xl glass-panel p-6 border relative overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                item.isCompleted
                  ? 'border-theme-border/50 opacity-75 bg-theme-surface/40'
                  : isUrgent 
                  ? 'border-rose-500/40 shadow-lg hover:border-rose-500/70' 
                  : 'border-theme-border hover:border-theme-accent/40'
              }`}
            >
              {/* Top Accent Strip */}
              <div 
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  item.isCompleted
                    ? 'bg-emerald-500/40'
                    : isAssignment
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                    : isUrgent 
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500' 
                    : 'bg-gradient-to-r from-theme-accent to-sky-400'
                }`}
              />

              <div>
                {/* Header with Type & Dynamic Badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isAssignment ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {isAssignment ? 'Assignment' : 'Exam'}
                    </span>

                    {/* Dynamic Countdown Badge */}
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${cd.badgeClass}`}>
                      {cd.badgeText}
                    </span>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted font-mono-numbers">
                      {item.weight}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Assignment Status Selector or Exam Complete toggle */}
                    {isAssignment ? (
                      <select
                        value={item.assignmentStatus || 'Pending'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Submitted' && item.assignmentStatus !== 'Submitted') {
                            celebrateTaskCompletion();
                          }
                          updateAssignmentStatus(item.id, val);
                        }}
                        className={`card-action-select text-[11px] font-semibold px-2 py-1 rounded-lg border focus:outline-none transition-all duration-150 active:scale-95 cursor-pointer ${
                          item.assignmentStatus === 'Submitted'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : item.assignmentStatus === 'In Progress'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-theme-surface text-theme-muted border-theme-border'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Submitted">Submitted ✓</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => {
                          if (!item.isCompleted) {
                            celebrateTaskCompletion();
                          }
                          toggleExamCompleted(item.id);
                        }}
                        className={`card-action-btn px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all duration-150 active:scale-95 ${
                          item.isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-theme-surface hover:bg-emerald-500/10 text-theme-muted hover:text-emerald-400 border border-theme-border'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{item.isCompleted ? 'Done' : 'Mark Done'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => deleteExam(item.id)}
                      className="card-action-btn p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 active:scale-90"
                      title="Remove deadline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className={`font-display font-bold text-lg text-theme-text mb-1 ${item.isCompleted ? 'line-through text-theme-muted' : ''}`}>
                  {item.title}
                </h3>
                <p className="text-xs text-theme-muted flex items-center gap-2 mb-3">
                  <span className="font-semibold text-theme-text/90">{item.subject}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-theme-accent" />
                    {item.room}
                  </span>
                </p>

                {/* Submission Link (For Assignments) */}
                {isAssignment && item.submissionLink && (
                  <div className="mb-3">
                    <a
                      href={sanitizeUrl(item.submissionLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs text-theme-accent font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Submission Portal</span>
                    </a>
                  </div>
                )}

                {/* Digital Countdown Box */}
                {!item.isCompleted && !cd.isPast ? (
                  <div className="grid grid-cols-4 gap-2 mb-4 font-mono-numbers">
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border text-center shadow-sm">
                      <div className="font-display font-extrabold text-2xl text-theme-text">
                        {String(cd.days).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-theme-muted tracking-wider mt-0.5">
                        Days
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border text-center shadow-sm">
                      <div className="font-display font-extrabold text-2xl text-theme-text">
                        {String(cd.hours).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-theme-muted tracking-wider mt-0.5">
                        Hours
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border text-center shadow-sm">
                      <div className="font-display font-extrabold text-2xl text-theme-text">
                        {String(cd.minutes).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-theme-muted tracking-wider mt-0.5">
                        Mins
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border text-center shadow-sm">
                      <div className="font-display font-extrabold text-2xl text-rose-400 animate-pulse">
                        {String(cd.seconds).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-theme-muted tracking-wider mt-0.5">
                        Secs
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-semibold text-emerald-400">
                    {isAssignment ? 'Assignment Submitted & Completed' : 'Exam Completed & Archived'}
                  </div>
                )}

                {item.notes && (
                  <p className="text-xs text-theme-muted bg-theme-bg/60 p-3 rounded-xl border border-theme-border/60">
                    <strong className="text-theme-text font-medium">Instructions & Notes: </strong>
                    {item.notes}
                  </p>
                )}
              </div>

              {/* Bottom Footer */}
              <div className="mt-4 pt-3 border-t border-theme-border/60 flex items-center justify-between text-[11px] text-theme-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-theme-accent" />
                  Due: {deadlineDateFormatted}
                </span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tracked
                </span>
              </div>

            </div>
          );
        })}

        {filteredDeadlines.length === 0 && (
          <div className="col-span-full py-12 rounded-2xl glass-panel border border-dashed border-theme-border text-center text-theme-muted">
            <Calendar className="w-12 h-12 mx-auto mb-2 text-theme-border" />
            <p className="text-sm font-semibold text-theme-text">No items found</p>
            <p className="text-xs mt-1">There are no deadlines matching your selected filter.</p>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">
                Schedule New Exam or Assignment
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeadline} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Item Category</label>
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
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="Urgent">Urgent (&lt; 3 days)</option>
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
                  placeholder={newType === 'assignment' ? 'e.g. Distributed System Raft Implementation' : 'e.g. Machine Learning Final Exam'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Weight</label>
                  <input
                    type="text"
                    placeholder={newType === 'assignment' ? '15% Project' : '40% Exam'}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                  />
                </div>
              </div>

              {newType === 'assignment' ? (
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Submission Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://classroom.google.com or GitHub repo"
                    value={submissionLink}
                    onChange={(e) => setSubmissionLink(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Location / Room</label>
                  <input
                    type="text"
                    placeholder="e.g. Science Hall 204 or Pearson VUE"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-theme-muted font-medium mb-1">Instructions & Revision Notes</label>
                <textarea
                  rows="2"
                  placeholder="Formula sheets allowed, rubric details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
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
                  Schedule Deadline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
