import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Clock, 
  Headphones,
  Award,
  BookOpen,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useData } from '../../context/DataContext';
import { soundEngine } from '../../utils/audio';
import AnimatedHeadline from '../AnimatedHeadline';
import RollingNumber from '../RollingNumber';

const PRESETS = [
  { id: 'pomo', name: '25m Focus', durationSec: 25 * 60, label: '25m' },
  { id: 'deep', name: '50m Deep Focus', durationSec: 50 * 60, label: '50m' },
  { id: 'short', name: '5m Break', durationSec: 5 * 60, label: '5m' }
];

export default function TimerTab() {
  const { subjects, addTimerSession, timerHistory } = useData();

  const [activePreset, setActivePreset] = useState(PRESETS[0]);
  const [totalSeconds, setTotalSeconds] = useState(PRESETS[0].durationSec);
  const [timeLeft, setTimeLeft] = useState(PRESETS[0].durationSec);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.name || 'General');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [ambientSound, setAmbientSound] = useState('none');
  const [sessionCompletedNotice, setSessionCompletedNotice] = useState(null);

  const timerRef = useRef(null);

  // Countdown effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, totalSeconds, activePreset, selectedSubject]);

  const handleSessionComplete = () => {
    setIsRunning(false);
    soundEngine.stop();
    setAmbientSound('none');

    // Chime
    soundEngine.playCompletionChime();

    // Confetti celebration
    try {
      confetti({
        particleCount: 85,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    // Crucial requirement: Automatically add logged minutes to that subject's total studied hours!
    if (activePreset.id !== 'short') {
      const minutes = Math.round(totalSeconds / 60);
      const currentSubjectObj = subjects.find(s => s.name === selectedSubject);
      addTimerSession({
        subject: selectedSubject,
        subjectId: currentSubjectObj?.id,
        chapterId: selectedChapterId || undefined,
        durationMin: minutes,
        type: activePreset.name
      });

      setSessionCompletedNotice({
        minutes,
        subject: selectedSubject
      });
      setTimeout(() => setSessionCompletedNotice(null), 6000);
    }
  };

  const handleSelectPreset = (preset) => {
    setIsRunning(false);
    setActivePreset(preset);
    setTotalSeconds(preset.durationSec);
    setTimeLeft(preset.durationSec);
  };

  const handleTogglePlay = () => {
    if (!isRunning && ambientSound !== 'none') {
      soundEngine.playMode(ambientSound);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(totalSeconds);
    soundEngine.stop();
  };

  const handleAmbientChange = (mode) => {
    setAmbientSound(mode);
    if (mode === 'none') {
      soundEngine.stop();
    } else {
      soundEngine.playMode(mode);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPct = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

  // SVG circular radius
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="text-center pb-4 border-b border-theme-border">
        <div className="flex items-center justify-center gap-2">
          <Clock className="w-6 h-6 text-theme-accent shrink-0" />
          <AnimatedHeadline 
            text="Deep Work Pomodoro & Focus Timer" 
            className="font-display text-2xl font-bold text-theme-text" 
          />
        </div>
        <p className="text-xs text-theme-muted mt-1">
          Stay in the flow. Completed focus sessions automatically update your subject's studied hours.
        </p>
      </div>

      {/* Completion Notification Banner */}
      {sessionCompletedNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              Great focus! Logged <strong><RollingNumber value={sessionCompletedNotice.minutes} prefix="+" suffix=" minutes" /></strong> directly to <strong>{sessionCompletedNotice.subject}</strong>.
            </span>
          </div>
          <span className="font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
            Hours Credited ✓
          </span>
        </div>
      )}

      {/* Timer Presets Bar (25m Focus / 5m Break / 50m Deep Focus) */}
      <div className="flex justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelectPreset(p)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activePreset.id === p.id
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Main Circular Timer Dial */}
      <div className="rounded-3xl glass-panel p-8 border border-theme-border flex flex-col items-center justify-center relative overflow-hidden shadow-2xl card-glow-hover">
        <div className="relative w-72 h-72 flex items-center justify-center">
          
          {/* Circular SVG Progress */}
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r={radius}
              className="stroke-theme-surface/70"
              strokeWidth="12"
              fill="transparent"
            />
            <circle
              cx="140"
              cy="140"
              r={radius}
              stroke="var(--color-accent)"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500 ease-linear"
            />
          </svg>

          {/* Center Digital Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-theme-muted mb-1">
              {activePreset.name}
            </span>
            <div className="font-display font-extrabold text-5xl sm:text-6xl text-theme-text font-mono-numbers tracking-tight">
              {formatTime(timeLeft)}
            </div>
            <span className="text-xs text-theme-accent font-semibold mt-2 max-w-[200px] truncate flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {selectedSubject}
            </span>
          </div>

        </div>

        {/* Controls: Play/Pause, Reset, Skip */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleReset}
            className="p-3 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleTogglePlay}
            className="px-8 py-3.5 rounded-2xl bg-theme-accent text-white font-bold text-sm shadow-glow-accent hover:bg-theme-accentHover transition-all transform hover:scale-105 flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5 fill-white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-white" />
                <span>Start Focus</span>
              </>
            )}
          </button>

          <button
            onClick={handleSessionComplete}
            className="p-3 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
            title="Finish / Credit session"
          >
            <FastForward className="w-5 h-5" />
          </button>
        </div>

        {/* Config Options: Subject Selector Dropdown & Ambient Soundscape */}
        <div className="mt-8 pt-6 border-t border-theme-border/60 w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Subject Selector Dropdown */}
          <div>
            <label className="block text-theme-muted font-medium mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-theme-accent" />
              Credited Subject:
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapterId('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-medium focus:outline-none focus:border-theme-accent"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
              <option value="General Study">General Study</option>
            </select>
            <span className="text-[10px] text-theme-muted block mt-1">
              Time logged here auto-increments subject's study hours.
            </span>
          </div>

          {/* Optional Chapter Selector */}
          {(() => {
            const currentSub = subjects.find(s => s.name === selectedSubject);
            const chapters = currentSub?.topics || [];
            if (chapters.length === 0) return null;
            return (
              <div className="sm:col-span-2">
                <label className="block text-theme-muted font-medium mb-1.5 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-theme-accent" />
                  Target Chapter (Direct Report Card Credit):
                </label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-medium focus:outline-none focus:border-theme-accent"
                >
                  <option value="">Whole Subject (No Specific Chapter)</option>
                  {chapters.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status || 'Not Started'})
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Ambient Sound Synthesizer */}
          <div>
            <label className="block text-theme-muted font-medium mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Headphones className="w-3.5 h-3.5 text-theme-accent" />
                Ambient White Noise
              </span>
              {ambientSound !== 'none' && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Active
                </span>
              )}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'none', label: 'Off' },
                { id: 'pink', label: 'Rain' },
                { id: 'brown', label: 'Rumble' },
                { id: 'white', label: 'White' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleAmbientChange(opt.id)}
                  className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    ambientSound === opt.id
                      ? 'bg-theme-accent text-white'
                      : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Focus History Log */}
      <div className="rounded-2xl glass-panel p-6 border border-theme-border">
        <h3 className="font-display font-bold text-base text-theme-text mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-theme-accent" />
          Recent Credited Focus Sessions
        </h3>

        <div className="space-y-2">
          {timerHistory.slice(0, 5).map((log) => (
            <div 
              key={log.id} 
              className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border flex items-center justify-between text-xs card-glow-hover transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div>
                  <p className="font-semibold text-theme-text">{log.subject}</p>
                  <p className="text-[11px] text-theme-muted">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.type}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono-numbers font-bold text-emerald-400">
                  <RollingNumber value={log.durationMin} prefix="+" suffix="m" />
                </span>
                <span className="block text-[10px] text-theme-muted">added to subject</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
