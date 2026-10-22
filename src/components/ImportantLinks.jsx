import React, { useState, useRef, useEffect } from 'react';
import { 
  Link2, 
  ExternalLink, 
  Plus, 
  Search, 
  Trash2, 
  RotateCcw, 
  X, 
  Globe, 
  BookOpen, 
  Tag, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { useData } from '../context/DataContext';

// 1. Reusable Two-Step Confirm Delete Button
export function ConfirmDeleteButton({ onConfirm, itemName = 'link', className = '' }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timeoutRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isConfirming) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsConfirming(false);
      onConfirm();
    } else {
      setIsConfirming(true);
      timeoutRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, 3500);
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsConfirming(false);
  };

  if (isConfirming) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 transition-colors animate-pulse"
        >
          Confirm Delete?
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 rounded-md text-theme-muted hover:text-theme-text text-xs"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Delete ${itemName}`}
      className={`p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors ${className}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// 2. Undo Toast Hook (5-second restore window)
export function useUndoToast() {
  const [toast, setToast] = useState(null); // { id, message, onUndo, remainingSec }
  const timerRef = useRef(null);

  const showUndoToast = (message, onUndo) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const toastId = Date.now();
    let secondsLeft = 5;

    setToast({ id: toastId, message, onUndo, secondsLeft });

    timerRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(timerRef.current);
        setToast(null);
      } else {
        setToast(prev => prev ? { ...prev, secondsLeft } : null);
      }
    }, 1000);
  };

  const dismissToast = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setToast(null);
  };

  const executeUndo = () => {
    if (toast?.onUndo) {
      toast.onUndo();
    }
    dismissToast();
  };

  const ToastComponent = toast ? (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-theme-surface border border-theme-border shadow-2xl animate-slideUp text-xs font-medium text-theme-text max-w-md">
      <span className="truncate">{toast.message}</span>
      <button
        onClick={executeUndo}
        className="px-2.5 py-1 rounded-lg bg-theme-accent text-white font-bold hover:bg-theme-accentHover transition-colors flex items-center gap-1.5 shrink-0"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Undo ({toast.secondsLeft}s)</span>
      </button>
      <button
        onClick={dismissToast}
        className="p-1 rounded-md text-theme-muted hover:text-theme-text shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  return { showUndoToast, ToastComponent };
}

// 3. Main ImportantLinks Component
export default function ImportantLinks() {
  const { subjects, importantLinks, addImportantLink, deleteImportantLink, restoreImportantLink } = useData();
  const { showUndoToast, ToastComponent } = useUndoToast();

  const [selectedScope, setSelectedScope] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newScope, setNewScope] = useState('common');
  const [newDescription, setNewDescription] = useState('');

  // Clean URL helper
  const formatUrlForDisplay = (rawUrl) => {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return rawUrl;
    }
  };

  const ensureHttpUrl = (rawUrl) => {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const handleAddLink = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    addImportantLink({
      title: newTitle.trim(),
      url: ensureHttpUrl(newUrl),
      scope: newScope,
      description: newDescription.trim()
    });

    setNewTitle('');
    setNewUrl('');
    setNewDescription('');
    setNewScope('common');
    setIsAddModalOpen(false);
  };

  const handleDeleteWithUndo = (link) => {
    deleteImportantLink(link.id);
    showUndoToast(`Deleted "${link.title}"`, () => {
      restoreImportantLink(link);
    });
  };

  // Filter calculation
  const filteredLinks = (importantLinks || []).filter(link => {
    const matchesScope = selectedScope === 'all' 
      ? true 
      : selectedScope === 'common' 
      ? link.scope === 'common' 
      : link.scope === selectedScope;

    const matchesSearch = link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.description && link.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesScope && matchesSearch;
  });

  const commonCount = (importantLinks || []).filter(l => l.scope === 'common').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <Link2 className="w-6 h-6 text-theme-accent" />
            Important Links & Resource Hub
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Central repository for common references, lecture portals, coding platforms, and subject-specific resources.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-theme-accent text-white text-xs font-semibold hover:bg-theme-accentHover shadow-glow-accent transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Link</span>
        </button>
      </div>

      {/* Controls Bar: Search & Category Filter Pills */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search links by title, URL or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-accent transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setSelectedScope('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedScope === 'all'
                ? 'bg-theme-accent text-white shadow-sm'
                : 'bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text'
            }`}
          >
            <span>All Links</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-numbers ${
              selectedScope === 'all' ? 'bg-white/20 text-white' : 'bg-theme-bg text-theme-muted'
            }`}>
              {(importantLinks || []).length}
            </span>
          </button>

          <button
            onClick={() => setSelectedScope('common')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedScope === 'common'
                ? 'bg-theme-accent text-white shadow-sm'
                : 'bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Common Links</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-numbers ${
              selectedScope === 'common' ? 'bg-white/20 text-white' : 'bg-theme-bg text-theme-muted'
            }`}>
              {commonCount}
            </span>
          </button>

          {subjects.map(sub => {
            const count = (importantLinks || []).filter(l => l.scope === sub.id).length;
            const isSelected = selectedScope === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedScope(sub.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-theme-accent text-white shadow-sm'
                    : 'bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || '#6366f1' }} />
                <span>{sub.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-numbers ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-theme-bg text-theme-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Links Grid Cards */}
      {filteredLinks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-theme-border space-y-3">
          <Link2 className="w-10 h-10 text-theme-muted mx-auto opacity-50" />
          <h3 className="font-display font-semibold text-base text-theme-text">No Links Found</h3>
          <p className="text-xs text-theme-muted max-w-sm mx-auto">
            {searchQuery ? 'No bookmarks match your search query.' : 'Add your first reference link to easily access study resources.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link) => {
            const isCommon = link.scope === 'common';
            const subjectMatch = !isCommon ? subjects.find(s => s.id === link.scope) : null;
            const displayUrl = formatUrlForDisplay(link.url);

            return (
              <div
                key={link.id}
                className="p-4 rounded-2xl glass-panel border border-theme-border hover:border-theme-accent/40 transition-all flex flex-col justify-between group shadow-sm"
              >
                <div className="space-y-2.5">
                  {/* Badge & Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <span 
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                        isCommon
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : 'bg-theme-surface text-theme-text border-theme-border'
                      }`}
                    >
                      {isCommon ? (
                        <>
                          <Globe className="w-3 h-3 text-sky-400" />
                          Common Link
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectMatch?.color || '#6366f1' }} />
                          {subjectMatch?.name || 'Subject Link'}
                        </>
                      )}
                    </span>

                    <ConfirmDeleteButton onConfirm={() => handleDeleteWithUndo(link)} itemName="bookmark" />
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-display font-bold text-sm text-theme-text group-hover:text-theme-accent transition-colors line-clamp-1">
                      {link.title}
                    </h3>
                    {link.description && (
                      <p className="text-xs text-theme-muted line-clamp-2 mt-1 leading-relaxed">
                        {link.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer URL & Visit Link Button */}
                <div className="pt-3 mt-3 border-t border-theme-border/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-theme-muted truncate max-w-[170px]" title={link.url}>
                    {displayUrl}
                  </span>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-theme-surface hover:bg-theme-accent hover:text-white border border-theme-border text-xs font-semibold text-theme-text transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Visit Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Link Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-theme-bg border border-theme-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <h3 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                <Link2 className="w-5 h-5 text-theme-accent" />
                Add Important Link
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-theme-muted hover:text-theme-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Link Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MIT OCW Algorithms Portal"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Target Web URL *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ocw.mit.edu or https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-mono text-xs focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Category / Scope *</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                >
                  <option value="common">Common Links (General / All)</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      Subject: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Short Description / Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Practice questions, formula cheat-sheet, syllabus schedule"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent resize-none"
                />
              </div>

              <div className="pt-2 border-t border-theme-border flex justify-end gap-2">
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
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating 5-Second Undo Toast */}
      {ToastComponent}
    </div>
  );
}
