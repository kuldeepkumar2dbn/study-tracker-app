import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Layers, 
  ListOrdered, 
  CheckCircle2, 
  Clock, 
  Loader2,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import YouTubeIcon from './YouTubeIcon';
import { 
  fetchYouTubeOEmbed, 
  generateYouTubeCourseRoadmap, 
  deriveTitleFromUrl 
} from '../utils/youtubeCourseParser';
import { extractYouTubeId } from '../utils/youtube';

/**
 * Import Course from YouTube Modal
 * StudyFlow Skill Tracker
 */
export default function YouTubeCourseModal({
  isOpen,
  onClose,
  onImport
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Web Development');
  const [levelStructure, setLevelStructure] = useState('auto'); // 'auto' | 'custom'
  const [customModulesText, setCustomModulesText] = useState(
    'Module 1: Foundations & Architecture\nModule 2: Practical Implementation\nModule 3: Production & Capstone'
  );
  const [chaptersText, setChaptersText] = useState('');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Auto-fetch metadata whenever a valid YouTube URL is entered
  const handleUrlBlur = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
      setErrorMsg('Please enter a valid YouTube video or playlist link.');
      return;
    }

    setErrorMsg('');
    setIsFetchingMeta(true);
    try {
      const meta = await fetchYouTubeOEmbed(trimmed);
      if (meta) {
        setPreviewMeta(meta);
        if (!title && meta.title) {
          setTitle(meta.title);
        }
      }
    } catch (err) {
      console.warn('Metadata fetch error:', err);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setErrorMsg('YouTube URL is required.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg('');

    try {
      const customModuleNames = levelStructure === 'custom'
        ? customModulesText.split('\n').map(m => m.trim()).filter(Boolean)
        : [];

      const courseData = await generateYouTubeCourseRoadmap({
        url: cleanUrl,
        customTitle: title,
        category,
        levelStructure,
        customModuleNames: customModuleNames.length ? customModuleNames : undefined,
        chaptersText
      });

      onImport(courseData);
      onClose();
      // Reset form
      setUrl('');
      setTitle('');
      setChaptersText('');
      setPreviewMeta(null);
    } catch (err) {
      console.error('Course generation error:', err);
      setErrorMsg('Failed to parse and generate course syllabus. Please verify URL and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/15 border border-red-600/30 text-red-500 shadow-sm">
              <YouTubeIcon className="w-5 h-5 fill-red-500 text-red-500" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                Import Course from YouTube
              </h2>
              <p className="text-[11px] text-theme-muted">
                Transform video tutorials & playlists into level-wise study roadmaps with actionable checkboxes.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-theme-muted hover:text-theme-text p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* YouTube Link Field */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-theme-muted font-semibold flex items-center gap-1.5">
                <YouTubeIcon className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                YouTube Playlist URL or Video URL <span className="text-rose-400">*</span>
              </label>
              {isFetchingMeta && (
                <span className="text-[11px] text-theme-accent flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching details...
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/playlist?list=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                className="w-full pl-3 pr-24 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent transition-all"
              />
              <button
                type="button"
                onClick={handleUrlBlur}
                disabled={isFetchingMeta || !url.trim()}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-theme-bg hover:bg-theme-cardHover border border-theme-border text-[11px] font-semibold text-theme-text disabled:opacity-50 transition-colors"
              >
                Auto-detect
              </button>
            </div>
            <p className="text-[10px] text-theme-muted mt-1">
              Supports full multi-hour tutorial videos, chaptered videos, and playlist URLs.
            </p>
          </div>

          {/* Live Preview Card if metadata found */}
          {previewMeta && (
            <div className="p-3 rounded-xl bg-theme-surface/70 border border-theme-border flex items-center gap-3">
              {previewMeta.thumbnailUrl && (
                <img 
                  src={previewMeta.thumbnailUrl} 
                  alt="Thumbnail" 
                  className="w-20 h-12 object-cover rounded-lg border border-theme-border/60 shrink-0" 
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-theme-text truncate text-xs" title={previewMeta.title}>
                  {previewMeta.title}
                </div>
                <div className="text-[10px] text-theme-muted flex items-center gap-2 mt-0.5">
                  <span>{previewMeta.authorName}</span>
                  <span>&bull;</span>
                  <span className="text-emerald-400 font-medium">Ready to import</span>
                </div>
              </div>
            </div>
          )}

          {/* Course Title (Editable) & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-theme-muted font-medium mb-1">
                Course Title (Auto-detected or Custom)
              </label>
              <input
                type="text"
                placeholder="e.g. Complete React 19 & Next.js Masterclass"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
              />
            </div>

            <div>
              <label className="block text-theme-muted font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none"
              >
                <option value="Web Development">Web Development</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Engineering">Engineering</option>
                <option value="Data Science & AI">Data Science & AI</option>
                <option value="Backend Architecture">Backend Architecture</option>
                <option value="DevOps & Cloud">DevOps & Cloud</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="General Mastery">General Mastery</option>
              </select>
            </div>
          </div>

          {/* Level Structure Selector */}
          <div className="space-y-2 p-3.5 rounded-xl bg-theme-surface/50 border border-theme-border">
            <label className="font-semibold text-theme-text flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-theme-accent" />
              Level Progression Structure:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label 
                className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                  levelStructure === 'auto'
                    ? 'border-theme-accent bg-theme-accent/10 shadow-sm'
                    : 'border-theme-border bg-theme-surface hover:border-theme-accent/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="levelStructure"
                    checked={levelStructure === 'auto'}
                    onChange={() => setLevelStructure('auto')}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-theme-text block">
                      Auto-detect Levels (3 Tiers)
                    </span>
                    <span className="text-[10px] text-theme-muted block mt-0.5">
                      Level 1: Basics &rarr; Level 2: Core &rarr; Level 3: Projects
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-400 mt-2">Recommended</span>
              </label>

              <label 
                className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                  levelStructure === 'custom'
                    ? 'border-theme-accent bg-theme-accent/10 shadow-sm'
                    : 'border-theme-border bg-theme-surface hover:border-theme-accent/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="levelStructure"
                    checked={levelStructure === 'custom'}
                    onChange={() => setLevelStructure('custom')}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <span className="font-semibold text-theme-text block">
                      Custom Modules
                    </span>
                    <span className="text-[10px] text-theme-muted block mt-0.5">
                      Define custom module divisions and labels
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-sky-400 mt-2">Customizable</span>
              </label>
            </div>

            {/* Custom Module Names Input if custom selected */}
            {levelStructure === 'custom' && (
              <div className="mt-3 pt-3 border-t border-theme-border">
                <label className="block text-theme-muted font-medium mb-1">
                  Module Names (One module per line):
                </label>
                <textarea
                  rows={3}
                  value={customModulesText}
                  onChange={(e) => setCustomModulesText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text font-mono text-[11px] focus:outline-none focus:border-theme-accent"
                  placeholder="Module 1: Getting Started&#10;Module 2: Core Concepts&#10;Module 3: Full Project"
                />
              </div>
            )}
          </div>

          {/* Optional Video Chapters / Timestamps */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-theme-muted font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-accent" />
                Paste Video Timestamps / Chapters (Optional)
              </label>
              <span className="text-[10px] text-theme-muted">
                From video description
              </span>
            </div>
            <textarea
              rows={3}
              value={chaptersText}
              onChange={(e) => setChaptersText(e.target.value)}
              placeholder={"00:00 - Introduction & Tooling\n12:30 - Setting up Components & Props\n45:00 - State Management & Forms\n1:20:00 - Building the Full-Stack Project"}
              className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-mono text-[11px] placeholder-theme-muted focus:outline-none focus:border-theme-accent"
            />
            <p className="text-[10px] text-theme-muted mt-1">
              If left empty, a structured curriculum with 6-8 comprehensive lectures and practice checkboxes will be generated automatically based on the course topic!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-theme-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white font-bold text-xs shadow-glow-accent disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Course...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Course Roadmap</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
