import React, { useState, useEffect, useMemo } from 'react';
import { 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Plus, 
  Trash2, 
  Calculator, 
  Brain, 
  Timer, 
  Eye, 
  Hash, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Check,
  X,
  FileSpreadsheet
} from 'lucide-react';
import RollingNumber from '../RollingNumber';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { patchUserData, getUserData } from '../../../storage-helper.js';
import { getActiveUserId, getLocalDateString } from '../../../auth-guard.js';
import { logFeatureUse } from '../../utils/telemetry.js';

export const MISTAKE_CATEGORIES = [
  { id: 'conceptual', label: 'Conceptual Gap', icon: '🧠', color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30' },
  { id: 'silly', label: 'Silly Calculation Error', icon: '🔢', color: 'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30' },
  { id: 'time', label: 'Time Pressure', icon: '⏱️', color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30' },
  { id: 'misread', label: 'Misread Question', icon: '👀', color: 'from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30' }
];

export const STORAGE_KEY = 'studytracker_mock_tests';

function getInitialMockTests() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const activeId = getActiveUserId();
    const cloudUser = getUserData(activeId);
    if (cloudUser && Array.isArray(cloudUser.mockTests) && cloudUser.mockTests.length > 0) {
      return cloudUser.mockTests;
    }
  } catch (err) {
    console.warn('Error reading mock tests from storage:', err);
  }

  // Pre-populated initial benchmark test so the dashboard looks functional immediately
  const today = getLocalDateString(new Date());
  return [
    {
      id: 'mock-sample-1',
      date: today,
      title: 'GATE Full Length Mock #01',
      subject: 'Full Syllabus',
      totalQuestions: 65,
      marksPerCorrect: 2,
      negativeMarks: 0.66,
      correctCount: 46,
      incorrectCount: 12,
      timeMinutes: 155,
      positiveMarks: 92,
      penaltyMarks: 7.92,
      netScore: 84.08,
      maxMarks: 130,
      scorePct: 64.68,
      accuracyPct: 79.31,
      attemptRatePct: 89.23,
      avgTimePerQuestionSec: 160,
      mistakes: [
        { id: 'm-1', topicNote: 'Bode plot phase crossover frequency calculation sign error', category: 'Conceptual Gap' },
        { id: 'm-2', topicNote: 'Silly math mistake in 3x3 matrix determinant calculation', category: 'Silly Calculation Error' },
        { id: 'm-3', topicNote: 'Rushed final network flow question in the last 2 minutes', category: 'Time Pressure' }
      ]
    }
  ];
}

export default function MockLogbookTab({ onNavigateTab }) {
  const { subjects, addTopic } = useData();
  const { isAuthenticated } = useAuth();

  const [tests, setTests] = useState(() => getInitialMockTests());
  const [toastMessage, setToastMessage] = useState(null);
  const [expandedTestId, setExpandedTestId] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(65);
  const [marksPerCorrect, setMarksPerCorrect] = useState(2);
  const [negativeMarks, setNegativeMarks] = useState(0.66);
  const [correctCount, setCorrectCount] = useState(45);
  const [incorrectCount, setIncorrectCount] = useState(10);
  const [timeMinutes, setTimeMinutes] = useState(150);

  // Mistake Entries
  const [mistakes, setMistakes] = useState([
    { id: 'm-init-1', topicNote: '', category: 'Conceptual Gap' }
  ]);

  // Telemetry on view mount
  useEffect(() => {
    logFeatureUse('Mock Logbook');
  }, []);

  // Save tests to storage & Google Drive sync
  const saveTestsToStorage = (updatedTests) => {
    setTests(updatedTests);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTests));
      }
      const activeId = getActiveUserId();
      if (activeId && activeId !== 'guest') {
        patchUserData(activeId, { mockTests: updatedTests });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studyflow-mock-tests-updated', {
          detail: { tests: updatedTests }
        }));
      }
    } catch (e) {
      console.error('Failed to persist mock tests:', e);
    }
  };

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 5500);
  };

  // Live Real-Time Computations Preview
  const preview = useMemo(() => {
    const totalQ = Math.max(1, Number(totalQuestions) || 1);
    const mCorrect = Math.max(0, Number(marksPerCorrect) || 0);
    const mNeg = Math.max(0, Number(negativeMarks) || 0);
    const correct = Math.max(0, Number(correctCount) || 0);
    const incorrect = Math.max(0, Number(incorrectCount) || 0);
    const timeMins = Math.max(0, Number(timeMinutes) || 0);

    const attempted = correct + incorrect;
    const unattempted = Math.max(0, totalQ - attempted);
    const positiveMarks = correct * mCorrect;
    const penaltyMarks = incorrect * mNeg;
    const netScore = Math.max(0, positiveMarks - penaltyMarks);
    const maxMarks = totalQ * mCorrect;
    const scorePct = maxMarks > 0 ? (netScore / maxMarks) * 100 : 0;
    const accuracyPct = attempted > 0 ? (correct / attempted) * 100 : 0;
    const attemptRatePct = totalQ > 0 ? (attempted / totalQ) * 100 : 0;
    const avgTimePerQSec = attempted > 0 ? Math.round((timeMins * 60) / attempted) : 0;

    return {
      totalQ,
      attempted,
      unattempted,
      positiveMarks: Number(positiveMarks.toFixed(2)),
      penaltyMarks: Number(penaltyMarks.toFixed(2)),
      netScore: Number(netScore.toFixed(2)),
      maxMarks: Number(maxMarks.toFixed(2)),
      scorePct: Number(scorePct.toFixed(1)),
      accuracyPct: Number(accuracyPct.toFixed(1)),
      attemptRatePct: Number(attemptRatePct.toFixed(1)),
      avgTimePerQSec
    };
  }, [totalQuestions, marksPerCorrect, negativeMarks, correctCount, incorrectCount, timeMinutes]);

  // Overall Top Summary Metrics (Across all completed tests)
  const summary = useMemo(() => {
    if (!tests || tests.length === 0) {
      return {
        avgAccuracy: 0,
        avgScore: 0,
        totalNegatives: 0,
        topMistake: 'None logged yet',
        totalTests: 0
      };
    }

    let sumAccuracy = 0;
    let sumScorePct = 0;
    let sumPenalty = 0;
    const mistakeCounts = {};

    tests.forEach((t) => {
      sumAccuracy += (t.accuracyPct || 0);
      sumScorePct += (t.scorePct || 0);
      sumPenalty += (t.penaltyMarks || 0);

      (t.mistakes || []).forEach((m) => {
        if (m.category) {
          mistakeCounts[m.category] = (mistakeCounts[m.category] || 0) + 1;
        }
      });
    });

    let topMistake = 'None logged yet';
    let highestCount = 0;
    Object.entries(mistakeCounts).forEach(([cat, count]) => {
      if (count > highestCount) {
        highestCount = count;
        topMistake = `${cat} (${count})`;
      }
    });

    return {
      avgAccuracy: (sumAccuracy / tests.length).toFixed(1),
      avgScore: (sumScorePct / tests.length).toFixed(1),
      totalNegatives: sumPenalty.toFixed(2),
      topMistake,
      totalTests: tests.length
    };
  }, [tests]);

  // Negative Marking Presets
  const handleApplyPreset = (ratio) => {
    const mCorrect = Number(marksPerCorrect) || 1;
    if (ratio === 0) {
      setNegativeMarks(0);
    } else {
      const calc = Number((mCorrect * ratio).toFixed(2));
      setNegativeMarks(calc);
    }
  };

  // Add / Remove Mistake Input
  const handleAddMistake = () => {
    setMistakes((prev) => [
      ...prev,
      { id: 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), topicNote: '', category: 'Conceptual Gap' }
    ]);
  };

  const handleRemoveMistake = (id) => {
    setMistakes((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMistake = (id, field, value) => {
    setMistakes((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  // Save Mock Test Submission
  const handleSubmitMock = (e) => {
    e.preventDefault();
    const cleanTitle = (title || 'Mock Test #' + (tests.length + 1)).trim();
    const cleanSubject = (subject || 'General / Full Syllabus').trim();

    const filteredMistakes = mistakes.filter((m) => m.topicNote && m.topicNote.trim().length > 0);

    const newTest = {
      id: 'mock-' + Date.now(),
      date: getLocalDateString(new Date()),
      title: cleanTitle,
      subject: cleanSubject,
      totalQuestions: Number(totalQuestions) || 65,
      marksPerCorrect: Number(marksPerCorrect) || 2,
      negativeMarks: Number(negativeMarks) || 0,
      correctCount: Number(correctCount) || 0,
      incorrectCount: Number(incorrectCount) || 0,
      timeMinutes: Number(timeMinutes) || 0,
      positiveMarks: preview.positiveMarks,
      penaltyMarks: preview.penaltyMarks,
      netScore: preview.netScore,
      maxMarks: preview.maxMarks,
      scorePct: preview.scorePct,
      accuracyPct: preview.accuracyPct,
      attemptRatePct: preview.attemptRatePct,
      avgTimePerQuestionSec: preview.avgTimePerQSec,
      mistakes: filteredMistakes
    };

    const updated = [newTest, ...tests];
    saveTestsToStorage(updated);

    // Auto-Revision Trigger: Any mistake tagged "Conceptual Gap" is queued for tomorrow (D+1)
    const conceptualGaps = filteredMistakes.filter((m) => m.category === 'Conceptual Gap');
    if (conceptualGaps.length > 0 && typeof addTopic === 'function') {
      try {
        // Find matching subject or default to first subject
        const targetSubject = (subjects || []).find(
          (s) => s.name && s.name.toLowerCase() === cleanSubject.toLowerCase()
        ) || (subjects && subjects.length > 0 ? subjects[0] : null);

        if (targetSubject) {
          conceptualGaps.forEach((gap) => {
            addTopic(
              targetSubject.id,
              `⚠️ Review: ${gap.topicNote} (${cleanTitle})`,
              'In Progress',
              `Auto-queued from Mock Test: ${cleanTitle}. Focus on root concept clarification.`
            );
          });
        }
      } catch (err) {
        console.warn('Could not auto-queue conceptual gap to revision:', err);
      }

      showToast(`🎯 Mock test saved! ${conceptualGaps.length} conceptual gap(s) added to tomorrow's Revision Queue.`);
    } else {
      showToast('🎯 Mock test logged successfully!');
    }

    // Reset Form
    setTitle('');
    setMistakes([{ id: 'm-' + Date.now(), topicNote: '', category: 'Conceptual Gap' }]);
  };

  const handleDeleteTest = (id) => {
    if (window.confirm('Are you sure you want to delete this mock test record?')) {
      const updated = tests.filter((t) => t.id !== id);
      saveTestsToStorage(updated);
      showToast('Mock test record deleted.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full max-w-none mx-0">
      
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-theme-surface/95 border border-theme-accent/50 text-theme-text p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-slideUp backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xl shrink-0">🎯</span>
            <p className="text-xs sm:text-sm font-semibold">{toastMessage}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1.5 hover:bg-theme-cardHover rounded-lg text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8 border border-theme-border shadow-glow-card card-glow-hover w-full max-w-none mx-0">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-theme-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
              <Target className="w-3.5 h-3.5" />
              <span>Exam Readiness • Negative Marking Analysis</span>
            </div>
            
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight">
              Mock Test & Mistake Logbook
            </h1>

            <p className="text-sm text-theme-muted leading-relaxed">
              Track your exam performance, compute live negative marking penalties, and convert wrong answers into automated spaced-repetition revision cycles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const formEl = document.getElementById('mock-entry-form');
                if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-primary-action flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all duration-200 active:scale-95"
            >
              <Plus className="w-4 h-4 fill-white" />
              <span>+ Log New Mock Test</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP SUMMARY METRICS (4 Columns) */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-none mx-0">
        
        {/* Metric 1: Average Accuracy % */}
        <div className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-emerald-500/40 card-glow-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Average Accuracy</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-display font-extrabold text-2xl sm:text-3xl font-mono-numbers text-emerald-400">
                <RollingNumber value={Number(summary.avgAccuracy)} decimals={1} suffix="%" />
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-1 font-mono-numbers">
              Across {summary.totalTests} completed mock{summary.totalTests === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Metric 2: Average Score % */}
        <div className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-indigo-500/40 card-glow-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Average Score</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-display font-extrabold text-2xl sm:text-3xl font-mono-numbers text-theme-text">
                <RollingNumber value={Number(summary.avgScore)} decimals={1} suffix="%" />
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-1 font-mono-numbers">
              Net marks / Total available marks
            </p>
          </div>
        </div>

        {/* Metric 3: Total Marks Lost to Negatives */}
        <div className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-rose-500/40 card-glow-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Penalty Points Lost</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-display font-extrabold text-2xl sm:text-3xl font-mono-numbers text-rose-400">
                -<RollingNumber value={Number(summary.totalNegatives)} decimals={2} />
              </span>
              <span className="text-xs text-theme-muted">pts</span>
            </div>
            <p className="text-xs text-theme-muted mt-1 font-mono-numbers">
              Cumulative negative deduction
            </p>
          </div>
        </div>

        {/* Metric 4: Top Mistake Pattern */}
        <div className="w-full min-w-0 flex flex-col justify-between rounded-2xl glass-panel p-5 border border-theme-border hover:border-amber-500/40 card-glow-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Top Mistake Pattern</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="font-display font-bold text-base text-theme-text truncate" title={summary.topMistake}>
              {summary.topMistake}
            </p>
            <p className="text-xs text-theme-muted mt-1">
              Primary area for targeted drill revision
            </p>
          </div>
        </div>

      </div>

      {/* INTERACTIVE MOCK ENTRY FORM & LIVE CALCULATOR (2 Columns) */}
      <div id="mock-entry-form" className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-none mx-0">
        
        {/* Left Column: Test Inputs Form */}
        <div className="lg:col-span-7 rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-theme-border/60">
              <Calculator className="w-4 h-4 text-theme-accent" />
              <h2 className="font-display font-bold text-base text-theme-text">Log Mock Test & Exam Parameters</h2>
            </div>

            <form onSubmit={handleSubmitMock} className="space-y-4">
              
              {/* Title & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">
                    Mock Test Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GATE Full Length Mock #04"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">
                    Subject / Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Signals & Systems or Full Syllabus"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    list="mock-subject-suggestions"
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                  <datalist id="mock-subject-suggestions">
                    <option value="Full Syllabus" />
                    {(subjects || []).map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Question Count & Scoring Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">
                    Total Questions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">
                    Marks per Correct
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={marksPerCorrect}
                    onChange={(e) => setMarksPerCorrect(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1">
                    Negative Penalty
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              {/* Penalty Presets Strip */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-medium text-theme-muted">Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(0)}
                  className="px-2 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-text transition-colors"
                >
                  0 (No Penalty)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(0.25)}
                  className="px-2 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-text transition-colors"
                >
                  1/4 (0.25×)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(0.3333)}
                  className="px-2 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-text transition-colors"
                >
                  1/3 (0.33×)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(0.6666)}
                  className="px-2 py-1 rounded-lg bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-text transition-colors"
                >
                  2/3 (0.66×)
                </button>
              </div>

              {/* Attempt Outcomes: Correct, Incorrect, Time Taken */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answers
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalQuestions}
                    value={correctCount}
                    onChange={(e) => setCorrectCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-emerald-500/30 text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Incorrect Answers
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalQuestions}
                    value={incorrectCount}
                    onChange={(e) => setIncorrectCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-rose-500/30 text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-muted mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text font-mono-numbers focus:outline-none focus:border-theme-accent"
                  />
                </div>
              </div>

              {/* MISTAKE LOGBOOK SUB-SECTION */}
              <div className="pt-4 mt-2 border-t border-theme-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display font-bold text-sm text-theme-text">
                      Wrong Questions & Mistake Analysis ({mistakes.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMistake}
                    className="px-2.5 py-1 rounded-lg bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent border border-theme-accent/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question Note</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {mistakes.map((m, idx) => (
                    <div key={m.id} className="p-3 rounded-xl bg-theme-surface border border-theme-border space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                          Mistake #{idx + 1}
                        </span>
                        {mistakes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMistake(m.id)}
                            className="text-theme-muted hover:text-rose-400 p-1 transition-colors"
                            title="Remove mistake"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="e.g. Nyquist stability contour sign inversion mistake"
                        value={m.topicNote}
                        onChange={(e) => handleUpdateMistake(m.id, 'topicNote', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                      />

                      {/* Pill Selector for Mistake Category */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {MISTAKE_CATEGORIES.map((cat) => {
                          const isCatSelected = m.category === cat.label;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleUpdateMistake(m.id, 'category', cat.label)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                                isCatSelected
                                  ? 'bg-theme-accent text-white border-theme-accent shadow-sm'
                                  : 'bg-theme-bg/60 text-theme-muted border-theme-border/60 hover:text-theme-text'
                              }`}
                            >
                              <span>{cat.icon} {cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Target className="w-4 h-4 fill-white" />
                  <span>Save Mock Test & Sync to Logbook</span>
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Right Column: Live Real-Time Calculation Preview Card */}
        <div className="lg:col-span-5 rounded-2xl glass-panel p-6 border border-theme-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-theme-border/60">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                <h2 className="font-display font-bold text-base text-theme-text">Real-Time Scoring Preview</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-surface border border-theme-border text-theme-muted uppercase tracking-wider font-mono-numbers">
                Live Calculator
              </span>
            </div>

            {/* Prominent Net Score Display */}
            <div className="p-4 rounded-2xl bg-theme-surface/80 border border-theme-border text-center mb-4">
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                Net Final Score
              </span>
              <div className="mt-1 flex items-baseline justify-center space-x-2">
                <span className="font-display font-extrabold text-3xl sm:text-4xl text-theme-text font-mono-numbers">
                  {preview.netScore}
                </span>
                <span className="text-sm font-semibold text-theme-muted font-mono-numbers">
                  / {preview.maxMarks}
                </span>
              </div>
              <p className="text-xs font-semibold text-theme-accent mt-1 font-mono-numbers">
                {preview.scorePct}% Score
              </p>
            </div>

            {/* Detailed Metric Badges */}
            <div className="space-y-3">
              
              {/* Accuracy Bar */}
              <div className="p-3 rounded-xl bg-theme-surface/50 border border-theme-border">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-theme-text">Accuracy</span>
                  <span className="font-bold text-emerald-400 font-mono-numbers">{preview.accuracyPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-bg overflow-hidden border border-theme-border/40">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, preview.accuracyPct)}%` }}
                  />
                </div>
              </div>

              {/* Attempt Rate & Unattempted */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-theme-surface/50 border border-theme-border">
                  <span className="text-[10px] text-theme-muted block uppercase font-semibold">Attempt Rate</span>
                  <span className="font-display font-bold text-base text-theme-text font-mono-numbers mt-0.5 block">
                    {preview.attemptRatePct}%
                  </span>
                  <span className="text-[10px] text-theme-muted font-mono-numbers">
                    {preview.attempted} of {preview.totalQ} Qs
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-theme-surface/50 border border-theme-border">
                  <span className="text-[10px] text-theme-muted block uppercase font-semibold">Unattempted</span>
                  <span className="font-display font-bold text-base text-theme-text font-mono-numbers mt-0.5 block">
                    {preview.unattempted} Qs
                  </span>
                  <span className="text-[10px] text-theme-muted font-mono-numbers">
                    Zero Penalty
                  </span>
                </div>
              </div>

              {/* Penalty Breakdown */}
              <div className="p-3 rounded-xl bg-theme-surface/50 border border-theme-border space-y-1.5 text-xs">
                <span className="text-[10px] text-theme-muted block uppercase font-semibold">Penalty Breakdown</span>
                <div className="flex items-center justify-between font-mono-numbers">
                  <span className="text-emerald-400">Positive Marks ({correctCount} correct)</span>
                  <span className="font-bold text-emerald-400">+{preview.positiveMarks}</span>
                </div>
                <div className="flex items-center justify-between font-mono-numbers">
                  <span className="text-rose-400">Negative Penalty ({incorrectCount} wrong)</span>
                  <span className="font-bold text-rose-400">-{preview.penaltyMarks}</span>
                </div>
              </div>

              {/* Average Time per Question */}
              <div className="p-3 rounded-xl bg-theme-surface/50 border border-theme-border flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-theme-muted block uppercase font-semibold">Avg Pacing per Question</span>
                  <span className="text-xs text-theme-muted">Based on {timeMinutes}m elapsed</span>
                </div>
                <span className="font-display font-bold text-base text-theme-text font-mono-numbers">
                  {preview.avgTimePerQSec}s <span className="text-xs font-normal text-theme-muted">/ q</span>
                </span>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/60 text-center">
            <p className="text-[11px] text-theme-muted flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Conceptual mistakes automatically trigger tomorrow's Spaced Repetition queue.</span>
            </p>
          </div>
        </div>

      </div>

      {/* HISTORY & MOCK TEST LOGBOOK TABLE / LIST */}
      <div className="rounded-2xl glass-panel p-6 border border-theme-border w-full max-w-none mx-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-theme-border/60">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-theme-accent" />
            <h2 className="font-display font-bold text-base text-theme-text">Past Mock Tests & Error Breakdown</h2>
          </div>
          <span className="text-xs text-theme-muted font-mono-numbers">
            {tests.length} recorded mock{tests.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-3">
          {tests.map((test) => {
            const isExpanded = expandedTestId === test.id;
            return (
              <div 
                key={test.id}
                className="p-4 rounded-xl bg-theme-surface/70 border border-theme-border hover:border-theme-accent/40 transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-sm text-theme-text truncate">
                        {test.title}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-theme-bg border border-theme-border text-theme-muted">
                        {test.subject}
                      </span>
                      <span className="text-[10px] text-theme-muted font-mono-numbers">
                        {test.date}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                      <span className="text-theme-muted">
                        Score: <strong className="text-theme-text font-mono-numbers">{test.netScore}/{test.maxMarks}</strong> ({test.scorePct}%)
                      </span>
                      <span className="text-theme-muted">
                        Accuracy: <strong className="text-emerald-400 font-mono-numbers">{test.accuracyPct}%</strong>
                      </span>
                      <span className="text-theme-muted">
                        Penalty: <strong className="text-rose-400 font-mono-numbers">-{test.penaltyMarks}</strong> pts
                      </span>
                      <span className="text-theme-muted">
                        Time: <strong className="text-theme-text font-mono-numbers">{test.timeMinutes}m</strong> ({test.avgTimePerQuestionSec}s/q)
                      </span>
                    </div>
                  </div>

                  {/* Actions: View Mistakes / Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    {test.mistakes && test.mistakes.length > 0 && (
                      <button
                        onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-xs font-medium text-theme-text hover:bg-theme-cardHover transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Brain className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mistakes ({test.mistakes.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete mock test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Mistake Notes */}
                {isExpanded && test.mistakes && test.mistakes.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-theme-border/40 space-y-2">
                    <p className="text-xs font-semibold text-theme-muted">Tagged Question Errors:</p>
                    <div className="space-y-1.5">
                      {test.mistakes.map((m, mIdx) => (
                        <div key={m.id || mIdx} className="p-2.5 rounded-lg bg-theme-bg/60 border border-theme-border/60 flex items-start justify-between gap-3 text-xs">
                          <p className="text-theme-text">{m.topicNote}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            m.category === 'Conceptual Gap' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : m.category === 'Silly Calculation Error'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : m.category === 'Time Pressure'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }`}>
                            {m.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {tests.length === 0 && (
            <div className="py-10 text-center text-xs text-theme-muted rounded-xl border border-dashed border-theme-border p-4">
              <Target className="w-8 h-8 mx-auto mb-2 text-theme-muted opacity-40" />
              <p className="font-semibold text-theme-text">No mock tests logged yet.</p>
              <p className="mt-1">Fill out the form above to log your first mock test and analyze negative marks.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

