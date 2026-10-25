import React, { useState, useRef } from 'react';
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
  X,
  Upload,
  FileUp,
  Image as ImageIcon,
  Paperclip,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { sanitizeUrl } from '../../utils/security';

export default function NotesTab({ onOpenDriveModal }) {
  const { 
    notes = [], 
    addNote, 
    updateNote, 
    deleteNote, 
    driveConfig = {}, 
    syncDrive, 
    subjects = [],
    driveFiles = [],
    uploadDriveFile,
    deleteDriveFile
  } = useData();

  const [selectedNoteId, setSelectedNoteId] = useState(notes[0]?.id || null);
  const [activeFolder, setActiveFolder] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [copied, setCopied] = useState(false);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFolder && matchesSearch;
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId) || filteredNotes[0] || null;

  // Direct Google Drive Multipart Upload Handler with Security Hardening
  const processFileUpload = async (file) => {
    if (!file) return;

    // 1. Enforce 25MB file size limit
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE) {
      setUploadError(`File exceeds the 25MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a file under 25MB.`);
      return;
    }

    const lowerName = file.name.toLowerCase();

    // 2. Reject executable file extensions explicitly
    const EXECUTABLE_EXTS = ['.exe', '.bat', '.sh', '.cmd', '.js', '.mjs', '.cjs', '.vbs', '.ps1', '.com', '.scr', '.msi', '.jar', '.apk', '.bin'];
    if (EXECUTABLE_EXTS.some(ext => lowerName.endsWith(ext))) {
      setUploadError('Security alert: Executable files (.exe, .bat, .sh, .cmd, .js) are strictly rejected.');
      return;
    }

    // 3. Restrict accepted file types to PDF, Images, TXT, and DOCX
    const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.docx'];
    const isAllowedExt = ALLOWED_EXTS.some(ext => lowerName.endsWith(ext));
    const isAllowedMime =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      file.type === 'text/plain' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword';

    if (!isAllowedExt && !isAllowedMime) {
      setUploadError('Invalid file type. Only PDF documents, Images, TXT, and DOCX files are permitted.');
      return;
    }

    setUploadError('');
    setUploadSuccess('');
    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name} directly to Google Drive via API v3...`);

    try {
      const uploaded = await uploadDriveFile(file);
      setUploadSuccess(`Successfully uploaded "${uploaded.name}" directly to your Google Drive!`);

      // If viewing/editing a note, append attachment markdown
      if (selectedNote) {
        const linkMd = `\n\n📎 **[Drive Attachment: ${uploaded.name}](${uploaded.webViewLink})**`;
        if (isEditing) {
          setEditContent(prev => prev + linkMd);
        } else {
          updateNote(selectedNote.id, {
            content: (selectedNote.content || '') + linkMd
          });
        }
      }
    } catch (err) {
      console.error('Direct Drive file upload error:', err);
      setUploadError(err.message || 'Direct Drive upload failed. Please verify your Google sign-in.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFileUpload(files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFileUpload(files[0]);
    }
  };

  const handleStartEdit = () => {
    if (!selectedNote) return;
    setEditTitle(selectedNote.title || '');
    setEditContent(selectedNote.content || '');
    setEditTags((selectedNote.tags || []).join(', '));
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
    navigator.clipboard.writeText(selectedNote.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tagsArr = newTags.split(',').map(t => t.trim()).filter(Boolean);
    const created = addNote({
      title: newTitle.trim(),
      subject: newSubject,
      folder: newFolder,
      tags: tagsArr,
      content: newContent,
      isStarred: false
    });

    if (created?.id) setSelectedNoteId(created.id);
    setNewTitle('');
    setIsNewNoteOpen(false);
  };

  const handleInsertDriveFileIntoNote = (file) => {
    if (!selectedNote) return;
    const linkMd = `\n\n📎 **[Drive Document: ${file.name}](${file.webViewLink})**`;
    if (isEditing) {
      setEditContent(prev => prev + linkMd);
    } else {
      updateNote(selectedNote.id, {
        content: (selectedNote.content || '') + linkMd
      });
    }
    setUploadSuccess(`Linked "${file.name}" to note "${selectedNote.title}"!`);
    setTimeout(() => setUploadSuccess(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <h1 className="font-display text-2xl font-bold text-theme-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-theme-accent" />
            Google Drive Notes & Document Vault
          </h1>
          <p className="text-xs text-theme-muted mt-1">
            Zero-backend direct upload & Markdown notes synced directly to your personal Google Drive storage.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Direct File Picker Input (Restricted to PDF, Images, TXT, DOCX; Max 25MB) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.txt,.docx,application/pdf,image/*,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-emerald-500/30 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Upload a PDF, Image, TXT, or DOCX document (Max 25MB) directly to Google Drive"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isUploading ? 'Uploading to Drive...' : 'Upload Document (Max 25MB)'}</span>
          </button>

          <button
            onClick={() => setIsNewNoteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Note</span>
          </button>
        </div>
      </div>

      {/* Direct Google Drive Upload Dropzone & Banner */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`p-4 rounded-2xl border transition-all duration-200 ${
          isDragOver 
            ? 'bg-theme-accent/10 border-theme-accent border-dashed ring-2 ring-theme-accent/30' 
            : 'glass-panel border-theme-border'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-xs sm:text-sm text-theme-text">
                  Direct Google Drive File Upload
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                  Drive API v3 multipart
                </span>
              </div>
              <p className="text-[11px] text-theme-muted mt-0.5">
                Drag and drop PDFs or images here to upload directly to your personal Drive. Zero server routing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-medium text-theme-text transition-all w-full md:w-auto"
            >
              <FileUp className="w-3.5 h-3.5 text-theme-accent" />
              <span>Select File</span>
            </button>
          </div>
        </div>

        {/* Upload Status / Progress Indicator */}
        {isUploading && (
          <div className="mt-3 p-3 rounded-xl bg-theme-accent/10 border border-theme-accent/30 text-xs text-theme-accent flex items-center gap-2.5 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{uploadProgress}</span>
          </div>
        )}

        {/* Success Alert */}
        {uploadSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
            <button onClick={() => setUploadSuccess('')} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {uploadError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
            <button onClick={() => setUploadError('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Uploaded Documents List */}
        {driveFiles && driveFiles.length > 0 && (
          <div className="mt-4 pt-3 border-t border-theme-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
                Uploaded Drive Documents ({driveFiles.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {driveFiles.map((df) => (
                <div 
                  key={df.id} 
                  className="p-2.5 rounded-xl bg-theme-surface/80 border border-theme-border hover:border-theme-accent/40 flex items-center justify-between gap-2 text-xs transition-all shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-theme-bg flex items-center justify-center shrink-0 border border-theme-border">
                      {df.type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-rose-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-theme-text truncate text-[11px]" title={df.name}>
                        {df.name}
                      </p>
                      <span className="text-[10px] text-theme-muted font-mono-numbers">
                        {df.size}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={sanitizeUrl(df.webViewLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open directly in Google Drive"
                      className="p-1 rounded-lg hover:bg-theme-cardHover text-theme-muted hover:text-theme-text transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-theme-accent" />
                    </a>
                    {selectedNote && (
                      <button
                        onClick={() => handleInsertDriveFileIntoNote(df)}
                        title="Insert link into active note"
                        className="p-1 rounded-lg hover:bg-theme-cardHover text-theme-muted hover:text-emerald-400 transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteDriveFile(df.id)}
                      title="Remove from uploaded list"
                      className="p-1 rounded-lg hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
                    {(note.content || '').replace(/[#*`>]/g, '')}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-theme-muted">
                    <span className="truncate max-w-[150px]">{note.subject}</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-mono-numbers">
                      <Cloud className="w-3 h-3" /> Drive Synced
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
                <div className="space-y-1 max-w-[65%]">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="font-display font-bold text-lg text-theme-text bg-theme-surface px-2.5 py-1 rounded-lg border border-theme-border focus:outline-none focus:border-theme-accent w-full"
                    />
                  ) : (
                    <h2 className="font-display font-bold text-lg text-theme-text truncate">
                      {selectedNote.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2 text-xs text-theme-muted">
                    <span>{selectedNote.subject}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono-numbers">
                      Updated {new Date(selectedNote.updatedAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Attach File Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-theme-muted hover:text-emerald-400 transition-colors"
                    title="Upload & attach PDF or Image directly to this note"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

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
                    {(selectedNote.tags || []).map((tg, i) => (
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
                  Drive Synced: <code className="font-mono-numbers">{selectedNote.driveFileId || 'MyStudyTracker_Data'}</code>
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
