import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Cloud, 
  Star, 
  Search, 
  Folder, 
  RefreshCw, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Eye, 
  Check, 
  Copy, 
  Tag, 
  Download,
  X
} from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function NotesTab({ onOpenDriveModal }) {
  const { notes, addNote, updateNote, deleteNote, driveConfig, syncDrive, subjects } = useData();
  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id || null);
  const [activeFolder, setActiveFolder] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [copied, setCopied] = useState(false);

  // New Note Modal
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState(subjects[0]?.name || 'General');
  const [newFolder, setNewFolder] = useState('Algorithms');
  const [newTags, setNewTags] = useState('Summary, CheatSheet');
  const [newContent, setNewContent] = useState('# New Study Note\n\n- Key concepts:\n- Important definitions:\n- Practice problems:');

  const folders = ['All', 'Starred', 'Algorithms', 'Mathematics', 'AI & ML', 'General'];

  const filteredNotes = notes.filter(n => {
    const matchesFolder = 
      activeFolder === 'All' ? true :
      activeFolder === 'Starred' ? n.isStarred :
      n.folder === activeFolder;

    const matchesSearch = 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFolder && matchesSearch;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId) || filteredNotes[0] || null;

  const handleStartEdit = () => {
    if (!selectedNote) return;
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setEditTags(selectedNote.tags.join(', '));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedNote) return;
    const tagsArr = editTags.split(',').map(t => t.trim()).filter(Boolean);
    updateNote(selectedNote.id, {
      title: editTitle,
      content: editContent,
      tags: tagsArr
    });
    setIsEditing(false);
  };

  const handleCopyNote = () => {
    if (!selectedNote) return;
    navigator.clipboard.writeText(selectedNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tagsArr = newTags.split(',').map(t => t.trim()).filter(Boolean);
    addNote({
      title: newTitle.trim(),
      subject: newSubject,
      folder: newFolder,
      tags: tagsArr,
      content: newContent,
      isStarred: false
    });

    setNewTitle('');
    setIsNewNoteOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-theme-accent" />
            Google Drive Notes & Vault
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Markdown study notes seamlessly mirrored to your Google Drive repository.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenDriveModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors"
          >
            <Cloud className="w-4 h-4 text-theme-accent" />
            <span>Vault Status</span>
          </button>
          <button
            onClick={() => setIsNewNoteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Note</span>
          </button>
        </div>
      </div>

      {/* Cloud Banner */}
      <div className="p-3.5 rounded-2xl glass-panel border border-theme-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-theme-text font-medium">Google Drive Sync:</span>
          <code className="text-[11px] font-mono-numbers px-2 py-0.5 rounded bg-theme-surface text-theme-muted border border-theme-border">
            {driveConfig.targetFolder}
          </code>
        </div>
        <div className="flex items-center gap-3 text-theme-muted">
          <span>Synced: <strong className="text-theme-text">{driveConfig.lastSynced}</strong></span>
          <button
            onClick={syncDrive}
            className="text-theme-accent hover:underline flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Backup Now</span>
          </button>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
        
        {/* Left Sidebar: Folders & Note Cards (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search notes, tags, concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
            />
          </div>

          {/* Folder tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {folders.map(f => (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  activeFolder === f
                    ? 'bg-theme-accent text-white'
                    : 'bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border'
                }`}
              >
                {f === 'Starred' ? <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> : <Folder className="w-3 h-3" />}
                <span>{f}</span>
              </button>
            ))}
          </div>

          {/* Notes list */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredNotes.map((note) => {
              const isSelected = selectedNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    setIsEditing(false);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-theme-accent/10 border-theme-accent/40 shadow-sm'
                      : 'glass-panel border-theme-border hover:border-theme-accent/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-display font-semibold text-xs text-theme-text leading-tight truncate">
                      {note.title}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNote(note.id, { isStarred: !note.isStarred });
                      }}
                      className="text-theme-muted hover:text-amber-400 transition-colors"
                    >
                      <Star className={`w-3.5 h-3.5 ${note.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>

                  <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed mb-2">
                    {note.content.replace(/[#*`>]/g, '')}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-theme-muted">
                    <span className="truncate max-w-[150px]">{note.subject}</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-mono-numbers">
                      <Cloud className="w-3 h-3" /> Drive
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="text-center py-8 text-xs text-theme-muted">
                No notes found matching your filters.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Markdown Viewer / Editor (7 columns) */}
        <div className="lg:col-span-7 rounded-2xl glass-panel border border-theme-border p-6 flex flex-col justify-between">
          {selectedNote ? (
            <div className="flex flex-col h-full">
              
              {/* Note Header & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-theme-border/60">
                <div className="space-y-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="font-display font-bold text-lg text-theme-text bg-theme-surface px-2.5 py-1 rounded-lg border border-theme-border focus:outline-none focus:border-theme-accent w-full"
                    />
                  ) : (
                    <h2 className="font-display font-bold text-lg text-theme-text">
                      {selectedNote.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 text-xs text-theme-muted">
                    <span>{selectedNote.subject}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono-numbers">
                      Updated {new Date(selectedNote.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyNote}
                    className="p-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-theme-text transition-colors"
                    title="Copy Markdown"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {isEditing ? (
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-accent text-white text-xs font-semibold hover:bg-theme-accentHover shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-theme-accent" />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Delete note "${selectedNote.title}"?`)) {
                        deleteNote(selectedNote.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-theme-surface hover:bg-rose-500/10 border border-theme-border text-theme-muted hover:text-rose-400 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tags line */}
              <div className="flex items-center gap-2 py-3">
                {isEditing ? (
                  <div className="w-full flex items-center gap-2">
                    <span className="text-xs text-theme-muted">Tags:</span>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNote.tags.map((tg, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border text-theme-muted">
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Content body: Editor or Formatted Markdown Reader */}
              <div className="flex-1 mt-2">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows="14"
                    className="w-full h-full p-4 rounded-xl bg-theme-surface border border-theme-border text-xs font-mono text-theme-text focus:outline-none focus:border-theme-accent resize-none leading-relaxed"
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-theme-bg/50 border border-theme-border/60 text-xs text-theme-text/90 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap font-sans">
                    {selectedNote.content}
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="mt-4 pt-3 border-t border-theme-border/60 flex items-center justify-between text-[11px] text-theme-muted">
                <span className="flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  Vault Ref: <code className="font-mono-numbers">{selectedNote.driveFileId}</code>
                </span>
                <span>Format: Markdown (.md)</span>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-theme-muted">
              <FileText className="w-12 h-12 mb-3 text-theme-border" />
              <p className="text-sm font-medium text-theme-text">No Note Selected</p>
              <p className="text-xs mt-1">Select a study note from the left or create a new one.</p>
            </div>
          )}
        </div>

      </div>

      {/* Create Note Modal */}
      {isNewNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <h3 className="font-display font-bold text-base text-theme-text">Create Markdown Study Note</h3>
              <button 
                onClick={() => setIsNewNoteOpen(false)}
                className="text-theme-muted hover:text-theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted font-medium mb-1">Note Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Consensus & Raft Protocol"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    <option value="General Engineering">General Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Drive Folder</label>
                  <select
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="Algorithms">Algorithms</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="AI & ML">AI & ML</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Consensus, Distributed, Raft"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div>
                <label className="block text-theme-muted font-medium mb-1">Markdown Content</label>
                <textarea
                  rows="6"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-3 rounded-xl bg-theme-surface border border-theme-border text-theme-text font-mono text-xs focus:outline-none focus:border-theme-accent leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewNoteOpen(false)}
                  className="px-3 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold hover:bg-theme-accentHover shadow-sm"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
