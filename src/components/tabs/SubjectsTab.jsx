import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Upload, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  Tag, 
  X, 
  Video, 
  Play, 
  Circle, 
  ListTree,
  BarChart3
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from '../../utils/youtube';
import InlineEdit from '../InlineEdit';
import ChapterReportCard from '../ChapterReportCard';
import AnimatedHeadline from '../AnimatedHeadline';
import RollingNumber from '../RollingNumber';
import { celebrateTaskCompletion } from '../../utils/confetti';

const YoutubeIcon = ({ className = "w-4 h-4 text-rose-500" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function SubjectsTab() {
  const { 
    subjects, 
    addSubject, 
    deleteSubject, 
    updateSubjectName,
    updateSubjectTargetHours,
    updateSubjectHours, 
    logChapterStudyMinutes,
    addTopic, 
    updateTopicStatus, 
    deleteTopic, 
    updateChapterName,
    addSubTopic, 
    updateSubTopicStatus, 
    deleteSubTopic, 
    updateTopicName,
    addYouTubeLink, 
    deleteYouTubeLink, 
    uploadSubjectAttachment, 
    removeSubjectAttachment 
  } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedSubjectId, setExpandedSubjectId] = useState(subjects[0]?.id || null);
  const [reportCardData, setReportCardData] = useState(null); // { subject, chapter }

  // Expanded subtopics accordion map
  const [expandedTopics, setExpandedTopics] = useState({});

  // Active YouTube video player modal state
  const [activeVideoModal, setActiveVideoModal] = useState(null); // { title, videoId }

  // Check location hash for direct navigation (e.g. syllabus.html#sub_123)
  useEffect(() => {
    const handleHash = () => {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (hash) {
        const found = subjects.find(s => s.id === hash);
        if (found) {
          setExpandedSubjectId(found.id);
          setTimeout(() => {
            const el = document.getElementById(found.id);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [subjects]);

  // New subject modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('Engineering');
  const [newSubWeeklyHours, setNewSubWeeklyHours] = useState(10);
  const [newSubExamDate, setNewSubExamDate] = useState('');
  const [newSubColor, setNewSubColor] = useState('#6366f1');

  // Inline topic inputs
  const [newTopicInputs, setNewTopicInputs] = useState({});
  const [newTopicStatusInputs, setNewTopicStatusInputs] = useState({});

  // Inline subtopic inputs
  const [newSubTopicInputs, setNewSubTopicInputs] = useState({});

  // Add YouTube link modal state
  const [ytModalTopic, setYtModalTopic] = useState(null); // { subjectId, topicId }
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytError, setYtError] = useState('');

  const [uploadingSubjectId, setUploadingSubjectId] = useState(null);
  const fileInputRefs = useRef({});

  const categories = ['All', ...new Set(subjects.map(s => s.category || 'General'))];

  const filteredSubjects = subjects.filter(sub => {
    const matchesCategory = selectedCategory === 'All' || sub.category === selectedCategory;
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.code && sub.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      sub.topics.some(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const toggleTopicExpand = (topicId) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const handleCreateSubject = (e) => {
    e.preventDefault();
    if (!newSubName.trim()) return;

    addSubject({
      name: newSubName.trim(),
      code: newSubCode.trim() || 'SUB-101',
      category: newSubCategory,
      targetWeeklyHours: Number(newSubWeeklyHours) || 10,
      examDate: newSubExamDate,
      color: newSubColor
    });

    setNewSubName('');
    setNewSubCode('');
    setNewSubExamDate('');
    setIsAddModalOpen(false);
  };

  const handleAddTopic = (subjectId) => {
    const title = newTopicInputs[subjectId];
    if (!title || !title.trim()) return;
    const status = newTopicStatusInputs[subjectId] || 'Not Started';

    addTopic(subjectId, title.trim(), status);
    setNewTopicInputs(prev => ({ ...prev, [subjectId]: '' }));
  };

  const handleAddSubTopic = (subjectId, topicId) => {
    const title = newSubTopicInputs[topicId];
    if (!title || !title.trim()) return;

    addSubTopic(subjectId, topicId, title.trim(), 'Not Started');
    setNewSubTopicInputs(prev => ({ ...prev, [topicId]: '' }));
  };

  const handleSaveYouTubeLink = (e) => {
    e.preventDefault();
    setYtError('');
    if (!ytModalTopic || !ytUrl.trim()) return;

    try {
      addYouTubeLink(ytModalTopic.subjectId, ytModalTopic.topicId, ytTitle, ytUrl);
      setYtTitle('');
      setYtUrl('');
      setYtModalTopic(null);
    } catch (err) {
      setYtError(err.message || 'Invalid YouTube URL.');
    }
  };

  const handleFileUpload = async (subjectId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSubjectId(subjectId);
    try {
      await uploadSubjectAttachment(subjectId, file);
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingSubjectId(null);
      e.target.value = '';
    }
  };

  // Recalculates chapter and subject completion % based on completed sub-topics
  const calculateSubjectPercentage = (topics) => {
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
  };

  const getDaysUntilExam = (dateStr) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-theme-accent shrink-0" />
            <AnimatedHeadline 
              text="Subjects, Sub-Topics & YouTube Video Vault" 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Break courses into chapters, track sub-topic mastery, and watch embedded YouTube lectures in-app.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Subject</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            type="text"
            placeholder="Search courses, chapters, or sub-topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`filter-pill px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-theme-accent text-white shadow-sm'
                  : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subjects Cards List */}
      <div className="space-y-5">
        {filteredSubjects.map((sub) => {
          const completionPct = calculateSubjectPercentage(sub.topics);
          const isExpanded = expandedSubjectId === sub.id;
          const daysToExam = getDaysUntilExam(sub.examDate);

          return (
            <div 
              key={sub.id}
              id={sub.id}
              className="rounded-2xl glass-panel border border-theme-border transition-all overflow-hidden shadow-sm hover:border-theme-accent/40 card-glow-hover"
            >
              {/* Subject Bar Header */}
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-white shadow-md shrink-0"
                    style={{ backgroundColor: sub.color }}
                  >
                    {sub.code ? sub.code.slice(0, 3) : 'SUB'}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-lg text-theme-text flex items-center">
                        <InlineEdit
                          value={sub.name}
                          onSave={(val) => updateSubjectName(sub.id, val)}
                          className="font-display font-bold text-lg text-theme-text"
                          inputClassName="text-base font-bold font-display"
                        />
                      </h3>
                      {sub.code && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted">
                          {sub.code}
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                        {sub.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-theme-muted pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-theme-accent" />
                        <strong className="text-theme-text font-mono-numbers"><RollingNumber value={sub.completedHours || 0} decimals={1} suffix="h" /></strong> studied / 
                        <InlineEdit
                          type="number"
                          min={1}
                          max={100}
                          value={sub.targetWeeklyHours}
                          onSave={(val) => updateSubjectTargetHours(sub.id, val)}
                          suffix="h weekly goal"
                          className="font-semibold text-theme-accent hover:underline"
                        />
                      </span>

                      {sub.examDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono-numbers">
                            <Calendar className="w-3.5 h-3.5 text-rose-400" />
                            Exam: {sub.examDate}
                            {daysToExam !== null && (
                              <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                daysToExam <= 7 ? 'bg-rose-500/20 text-rose-400' : 'bg-theme-surface text-theme-muted'
                              }`}>
                                {daysToExam > 0 ? `(${daysToExam}d left)` : '(Today / Passed)'}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Actions */}
                <div className="flex items-center gap-4 self-end lg:self-auto">
                  <div className="w-44 hidden sm:block">
                    <div className="flex justify-between text-xs text-theme-muted mb-1 font-mono-numbers">
                      <span>Sub-Topic Mastery</span>
                      <span className="font-bold text-theme-text"><RollingNumber value={completionPct} suffix="%" /></span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-theme-surface overflow-hidden border border-theme-border/60">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${completionPct}%`, backgroundColor: sub.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSubjectHours(sub.id, 0.5)}
                      title="Quick log +30m study time"
                      className="px-2.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-accent transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-theme-accent" />
                      <span>+30m</span>
                    </button>

                    <button
                      onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                      className="p-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete subject "${sub.name}" and all its chapters?`)) {
                          deleteSubject(sub.id);
                        }
                      }}
                      className="p-1.5 rounded-xl bg-theme-surface hover:bg-rose-500/10 border border-theme-border text-theme-muted hover:text-rose-400 transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Collapsible Section: Chapters, Sub-topics, YouTube Links & Drive Attachments */}
              {isExpanded && (
                <div className="p-5 pt-0 border-t border-theme-border/60 bg-theme-bg/25 space-y-6">
                  
                  {/* Chapters & Sub-Topics */}
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-theme-accent" />
                        Chapters & Sub-Topics Architecture ({sub.topics.length})
                      </span>
                    </div>

                    <div className="space-y-3">
                      {sub.topics.map((topic) => {
                        const isSubExpanded = !!expandedTopics[topic.id];
                        const subtopics = topic.subtopics || [];
                        const ytLinks = topic.youtubeLinks || [];

                        return (
                          <div
                            key={topic.id}
                            className="p-4 rounded-xl bg-theme-surface/85 border border-theme-border space-y-3 hover:border-theme-accent/40 transition-all shadow-sm"
                          >
                            {/* Chapter Header Line */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <button
                                  onClick={() => toggleTopicExpand(topic.id)}
                                  className="mt-0.5 p-1 rounded-md hover:bg-theme-cardHover text-theme-muted hover:text-theme-text transition-colors shrink-0"
                                  title="Expand/Collapse Sub-topics & Videos"
                                >
                                  {isSubExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-xs sm:text-sm text-theme-text flex items-center">
                                      <InlineEdit
                                        value={topic.title}
                                        onSave={(val) => updateChapterName(sub.id, topic.id, val)}
                                        className="font-semibold text-xs sm:text-sm text-theme-text"
                                        placeholder="Chapter Title"
                                      />
                                    </h4>
                                    {subtopics.length > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-theme-bg border border-theme-border text-theme-muted font-mono-numbers">
                                        {subtopics.filter(st => st.status === 'Mastered' || st.completed).length}/{subtopics.length} subs
                                      </span>
                                    )}
                                  </div>
                                  {topic.notes && (
                                    <p className="text-[11px] text-theme-muted mt-0.5 leading-relaxed">
                                      {topic.notes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Chapter Controls & Status */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReportCardData({ subject: sub, chapter: topic });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent border border-theme-accent/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                  title="View Diagnostic Report Card & Progress Graph"
                                >
                                  <BarChart3 className="w-3.5 h-3.5 text-theme-accent" />
                                  <span>Report Card</span>
                                </button>

                                <button
                                  onClick={() => setYtModalTopic({ subjectId: sub.id, topicId: topic.id })}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                                  title="Attach YouTube Lecture Video"
                                >
                                  <YoutubeIcon className="w-3.5 h-3.5 text-rose-500" />
                                  <span>+ Video</span>
                                </button>

                                <select
                                  value={topic.status}
                                  onChange={(e) => updateTopicStatus(sub.id, topic.id, e.target.value)}
                                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                                    topic.status === 'Mastered'
                                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                      : topic.status === 'In Progress'
                                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                      : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                                  }`}
                                >
                                  <option value="Not Started" className="bg-theme-surface text-theme-text">Not Started</option>
                                  <option value="In Progress" className="bg-theme-surface text-theme-text">In Progress</option>
                                  <option value="Mastered" className="bg-theme-surface text-theme-text">Mastered</option>
                                </select>

                                <button
                                  onClick={() => deleteTopic(sub.id, topic.id)}
                                  className="p-1 rounded text-theme-muted hover:text-rose-400 transition-colors"
                                  title="Delete chapter"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* YouTube Attached Videos Badges (Always visible if present) */}
                            {ytLinks.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {ytLinks.map((link) => {
                                  const thumb = getYouTubeThumbnail(link.videoId);
                                  return (
                                    <div
                                      key={link.id}
                                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-theme-bg border border-theme-border/80 group hover:border-rose-500/40 transition-colors"
                                    >
                                      <div 
                                        onClick={() => setActiveVideoModal({ title: link.title, videoId: link.videoId })}
                                        className="relative w-10 h-7 rounded overflow-hidden cursor-pointer shrink-0"
                                      >
                                        <img src={thumb} alt={link.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                          <Play className="w-3 h-3 text-white fill-white" />
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => setActiveVideoModal({ title: link.title, videoId: link.videoId })}
                                        className="text-xs font-medium text-theme-text hover:text-rose-400 transition-colors truncate max-w-[170px]"
                                        title="Watch in-app"
                                      >
                                        {link.title}
                                      </button>

                                      <button
                                        onClick={() => deleteYouTubeLink(sub.id, topic.id, link.id)}
                                        className="text-theme-muted hover:text-rose-400 p-0.5"
                                        title="Remove lecture"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Sub-Topics Expandable List */}
                            {isSubExpanded && (
                              <div className="pt-3 border-t border-theme-border/50 pl-3 sm:pl-6 space-y-2 bg-theme-bg/30 p-3 rounded-xl">
                                <div className="flex items-center justify-between text-[11px] text-theme-muted font-semibold uppercase tracking-wider">
                                  <span className="flex items-center gap-1">
                                    <ListTree className="w-3.5 h-3.5 text-theme-accent" />
                                    Sub-Topics Checklist
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                  {subtopics.map((st) => (
                                    <div
                                      key={st.id}
                                      className="p-2.5 rounded-lg bg-theme-surface border border-theme-border flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <button
                                          onClick={() => {
                                            const nextStatus = st.status === 'Mastered' ? 'In Progress' : st.status === 'In Progress' ? 'Not Started' : 'Mastered';
                                            if (nextStatus === 'Mastered') celebrateTaskCompletion();
                                            updateSubTopicStatus(sub.id, topic.id, st.id, nextStatus);
                                          }}
                                          className="shrink-0"
                                        >
                                          {st.status === 'Mastered' || st.completed ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                                          ) : st.status === 'In Progress' ? (
                                            <Circle className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                                          ) : (
                                            <Circle className="w-4 h-4 text-theme-muted" />
                                          )}
                                        </button>
                                        <InlineEdit
                                          value={st.title}
                                          onSave={(val) => updateTopicName(sub.id, topic.id, st.id, val)}
                                          className={`truncate text-xs ${st.status === 'Mastered' || st.completed ? 'line-through text-theme-muted' : 'text-theme-text'}`}
                                          placeholder="Topic Title"
                                        />
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <select
                                          value={st.status}
                                          onChange={(e) => {
                                            if (e.target.value === 'Mastered') celebrateTaskCompletion();
                                            updateSubTopicStatus(sub.id, topic.id, st.id, e.target.value);
                                          }}
                                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-theme-bg border border-theme-border text-theme-text focus:outline-none"
                                        >
                                          <option value="Not Started">Not Started</option>
                                          <option value="In Progress">In Progress</option>
                                          <option value="Mastered">Mastered</option>
                                        </select>
                                        <button
                                          onClick={() => deleteSubTopic(sub.id, topic.id, st.id)}
                                          className="p-0.5 text-theme-muted hover:text-rose-400"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}

                                  {subtopics.length === 0 && (
                                    <p className="text-[11px] text-theme-muted italic">
                                      No sub-topics added. Add specific concepts or exercises below.
                                    </p>
                                  )}
                                </div>

                                {/* Add Subtopic Inline */}
                                <div className="pt-2 flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="Add sub-topic or specific exercise..."
                                    value={newSubTopicInputs[topic.id] || ''}
                                    onChange={(e) => setNewSubTopicInputs(prev => ({ ...prev, [topic.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddSubTopic(sub.id, topic.id);
                                    }}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
                                  />
                                  <button
                                    onClick={() => handleAddSubTopic(sub.id, topic.id)}
                                    className="px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text flex items-center gap-1 transition-colors"
                                  >
                                    <Plus className="w-3 h-3 text-theme-accent" />
                                    <span>Add Sub-topic</span>
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>

                    {/* Add Chapter Inline */}
                    <div className="mt-3 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add new chapter / topic name..."
                        value={newTopicInputs[sub.id] || ''}
                        onChange={(e) => setNewTopicInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTopic(sub.id);
                        }}
                        className="flex-1 w-full px-3.5 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
                      />

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                          value={newTopicStatusInputs[sub.id] || 'Not Started'}
                          onChange={(e) => setNewTopicStatusInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                          className="px-2.5 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Mastered">Mastered</option>
                        </select>

                        <button
                          onClick={() => handleAddTopic(sub.id)}
                          className="px-3.5 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-theme-accentHover transition-colors shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Chapter</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Drive Notes & Attachment Files */}
                  <div className="pt-4 border-t border-theme-border/60">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-theme-accent" />
                        Google Drive Study Vault Notes & Attachments
                      </span>

                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        ref={el => fileInputRefs.current[sub.id] = el}
                        onChange={(e) => handleFileUpload(sub.id, e)}
                        className="hidden"
                      />

                      <button
                        onClick={() => fileInputRefs.current[sub.id]?.click()}
                        disabled={uploadingSubjectId === sub.id}
                        className="px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text flex items-center gap-1.5 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-theme-accent" />
                        <span>{uploadingSubjectId === sub.id ? 'Uploading...' : 'Upload PDF/Image'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sub.driveAttachments && sub.driveAttachments.length > 0 ? (
                        sub.driveAttachments.map((att) => (
                          <div 
                            key={att.id}
                            className="p-3 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 rounded-lg bg-theme-bg border border-theme-border shrink-0">
                                <FileText className="w-4 h-4 text-rose-400" />
                              </div>
                              <div className="min-w-0">
                                <a 
                                  href={sanitizeUrl(att.webViewLink)}
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="font-medium text-theme-text hover:text-theme-accent transition-colors truncate block text-xs"
                                  title={att.name}
                                >
                                  {att.name}
                                </a>
                                <span className="text-[10px] text-theme-muted font-mono-numbers">
                                  {att.size} • {new Date(att.uploadedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => removeSubjectAttachment(sub.id, att.id)}
                              className="p-1 rounded text-theme-muted hover:text-rose-400 transition-colors shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full p-3 rounded-xl bg-theme-surface/40 border border-dashed border-theme-border/80 text-center text-xs text-theme-muted">
                          No notes or slides attached yet. Upload a PDF cheat sheet or notes image directly to Drive.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* In-App YouTube "Watch Lecture" Modal */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div 
            className="w-full max-w-3xl rounded-2xl glass-dropdown p-5 shadow-2xl border border-theme-border relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <YoutubeIcon className="w-5 h-5 text-rose-500" />
                <h3 className="font-display font-bold text-sm sm:text-base text-theme-text truncate max-w-lg">
                  {activeVideoModal.title}
                </h3>
              </div>
              <button 
                onClick={() => setActiveVideoModal(null)}
                className="text-theme-muted hover:text-theme-text p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Responsive YouTube Player IFrame */}
            <div className="mt-4 relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black shadow-inner">
              <iframe
                src={`${getYouTubeEmbedUrl(activeVideoModal.videoId)}?autoplay=1`}
                title={activeVideoModal.title}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* Attach YouTube Link Modal */}
      {ytModalTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
                <YoutubeIcon className="w-5 h-5 text-rose-500" />
                Attach YouTube Lecture
              </h3>
              <button 
                onClick={() => setYtModalTopic(null)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveYouTubeLink} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Lecture Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AVL Trees in 15 Minutes"
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">YouTube URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              {ytError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                  {ytError}
                </p>
              )}

              <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setYtModalTopic(null)}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-sm transition-colors"
                >
                  Attach Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Subject Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">Create New Subject</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Operating Systems"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Course Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CS-402"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Category</label>
                  <select
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Natural Science">Natural Science</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Target Weekly Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newSubWeeklyHours}
                    onChange={(e) => setNewSubWeeklyHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Upcoming Exam Date</label>
                  <input
                    type="date"
                    value={newSubExamDate}
                    onChange={(e) => setNewSubExamDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                  />
                </div>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Color Tag</label>
                <div className="flex items-center gap-2 mt-1">
                  {['#6366f1', '#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#f43f5e'].map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewSubColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        newSubColor === c ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
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
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chapter Diagnostic Report Card Modal */}
      {reportCardData && (
        <ChapterReportCard
          isOpen={!!reportCardData}
          onClose={() => setReportCardData(null)}
          subject={reportCardData.subject}
          chapter={
            subjects
              .find(s => s.id === reportCardData.subject.id)?.topics
              .find(t => t.id === reportCardData.chapter.id) || reportCardData.chapter
          }
          onUpdateSubTopicStatus={updateSubTopicStatus}
          onLogStudyMinutes={logChapterStudyMinutes}
        />
      )}

    </div>
  );
}
