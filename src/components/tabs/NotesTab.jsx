import React, { useState, useRef, useMemo } from 'react';
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
  Lock,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderCheck,
  HardDrive
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { sanitizeUrl, validateFileBinarySignature, getSafeHash } from '../../utils/security';
import { getSubjectFolderLink, NOTES_PARENT_FOLDER_NAME } from '../../services/googleDrive';
import AnimatedHeadline from '../AnimatedHeadline';
import RollingNumber from '../RollingNumber';
import { celebrateTaskCompletion } from '../../utils/confetti';

const FOLDERS = ['All', 'Starred', 'Algorithms', 'Mathematics', 'AI & ML', 'General'];

export default function NotesTab({ onOpenDriveModal }) {
  const { renewDriveToken } = useAuth();
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
  const [activeFolder, setActiveFolder] = useState(() => {
    const hash = getSafeHash(FOLDERS);
    return hash || 'All';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [copied, setCopied] = useState(false);

  // File Upload Modal & Staging State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [modalUploadProgress, setModalUploadProgress] = useState(0);
  const [modalUploadStatus, setModalUploadStatus] = useState('');
  const [modalError, setModalError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [lastUploadedFolderLink, setLastUploadedFolderLink] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Accordion collapsed state for subject folders in Explorer
  const [collapsedSubjects, setCollapsedSubjects] = useState({});

  // New Markdown Note Modal State
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState(subjects[0]?.name || 'General');
  const [newFolder, setNewFolder] = useState('Algorithms');
  const [newTags, setNewTags] = useState('Summary, CheatSheet');
  const [newContent, setNewContent] = useState('# New Study Note\n\n- Key concepts:\n- Important definitions:\n- Practice problems:');

  // Dynamic Subjects List pulled directly from the user's Subjects & Syllabus
  const subjectOptions = useMemo(() => {
    const list = (subjects || []).map(s => s.name?.trim()).filter(Boolean);
    const defaults = ['Computer Science', 'Mathematics', 'Physics', 'General'];
    const combined = Array.from(new Set([...list, ...defaults]));
    return combined;
  }, [subjects]);

  // Group Drive Files by Subject for the UI Notes Explorer
  const filesBySubject = useMemo(() => {
    const groups = {};
    (driveFiles || []).forEach(file => {
      const sub = (file.subject || 'General').trim() || 'General';
      if (!groups[sub]) {
        groups[sub] = {
          subject: sub,
          folderId: file.folderId || null,
          folderLink: file.folderLink || getSubjectFolderLink(sub, file.folderId),
          files: []
        };
      }
      groups[sub].files.push(file);
    });

    return Object.values(groups).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [driveFiles]);

  const toggleSubjectCollapse = (subject) => {
    setCollapsedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };

  const folders = FOLDERS;

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

  // Staging handler: Validates file and opens Upload Modal before sending to Drive
  const handleStageFile = async (file) => {
    if (!file) return;

    // 1. Enforce 25MB file size limit
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE) {
      setUploadError(`File exceeds the 25MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a file under 25MB.`);
      return;
    }

    const lowerName = file.name.toLowerCase();

    // 2. Reject SVG and HTML explicitly
    if (
      lowerName.endsWith('.svg') ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm') ||
      lowerName.endsWith('.xhtml') ||
      file.type === 'image/svg+xml' ||
      file.type.includes('html')
    ) {
      setUploadError('Security alert: SVG and HTML files are strictly disallowed for security.');
      return;
    }

    // 3. Reject executable file extensions explicitly
    const EXECUTABLE_EXTS = [
      '.exe', '.bat', '.sh', '.cmd', '.js', '.mjs', '.cjs', '.vbs', '.ps1',
      '.com', '.scr', '.msi', '.jar', '.apk', '.bin', '.app', '.dmg', '.php',
      '.py', '.dll', '.so', '.dylib', '.cgi', '.pl'
    ];
    if (EXECUTABLE_EXTS.some(ext => lowerName.endsWith(ext))) {
      setUploadError('Security alert: Executable files (.exe, .bat, .sh, .cmd, .js) are strictly rejected.');
      return;
    }

    // 4. Magic-byte binary header validation (FileReader + Uint8Array)
    try {
      await validateFileBinarySignature(file);
    } catch (sigErr) {
      setUploadError(sigErr.message || 'File inspection failed: Invalid file header signature.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadError('');
    setUploadSuccess('');
    setModalError('');
    setPendingUploadFile(file);

    // Default subject selection to active subject or first available subject
    const defaultSub = selectedSubject || subjectOptions[0] || 'General';
    setSelectedSubject(defaultSub);
    setIsCustomSubject(false);
    setCustomSubjectInput('');
    setModalUploadProgress(0);
    setModalUploadStatus('');
    setIsUploadModalOpen(true);
  };

  // Confirm and execute multipart upload with target subject folder
  const handleConfirmUpload = async () => {
    if (!pendingUploadFile) return;

    const targetSubject = isCustomSubject 
      ? (customSubjectInput.trim() || 'General')
      : (selectedSubject || 'General');

    if (isCustomSubject && !customSubjectInput.trim()) {
      setModalError('Please enter a custom subject name or select an existing subject.');
      return;
    }

    setIsUploading(true);
    setModalError('');
    setModalUploadProgress(25);
    setModalUploadStatus(`Checking Google Drive > StudyTracker Notes > ${targetSubject}...`);

    try {
      setModalUploadProgress(55);
      setModalUploadStatus(`Streaming multipart payload for ${pendingUploadFile.name}...`);

      let uploaded;
      try {
        uploaded = await uploadDriveFile(pendingUploadFile, targetSubject);
      } catch (uploadErr) {
        if (
          uploadErr?.code === 'DRIVE_TOKEN_EXPIRED' || 
          uploadErr?.message?.includes('expired') || 
          uploadErr?.message?.includes('401')
        ) {
          setModalUploadStatus('Renewing Google Drive authorization...');
          await renewDriveToken();
          setModalUploadStatus(`Retrying upload of ${pendingUploadFile.name}...`);
          uploaded = await uploadDriveFile(pendingUploadFile, targetSubject);
        } else {
          throw uploadErr;
        }
      }

      setModalUploadProgress(100);
      setModalUploadStatus('Complete!');

      // Success notification strictly matching requirement 4:
      // "Saved to Google Drive > StudyTracker Notes > [Subject Name]"
      const successNotice = `Saved to Google Drive > StudyTracker Notes > ${targetSubject}`;
      setUploadSuccess(successNotice);
      setLastUploadedFolderLink(uploaded.folderLink || getSubjectFolderLink(targetSubject, uploaded.folderId));
      celebrateTaskCompletion();

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

      // Automatically uncollapse the target subject folder accordion
      setCollapsedSubjects(prev => ({
        ...prev,
        [targetSubject]: false
      }));

      // Close modal smoothly
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setPendingUploadFile(null);
        setModalUploadProgress(0);
        setModalUploadStatus('');
      }, 400);

    } catch (err) {
      console.error('Direct Drive file upload error:', err);
      setModalError(err.message || 'Direct Drive upload failed. Please verify your Google sign-in.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleStageFile(files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleStageFile(files[0]);
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
    celebrateTaskCompletion();
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
    celebrateTaskCompletion();
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
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-theme-accent shrink-0" />
            <AnimatedHeadline 
              text="Google Drive Notes & Document Vault" 
              className="font-display text-2xl font-bold text-theme-text" 
            />
          </div>
          <p className="text-xs text-theme-muted mt-1">
            Auto-organizes uploaded notes into Subject Folders in Google Drive with direct client-side GIS uploads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.docx,application/pdf,image/*,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-emerald-500/30 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Upload a PDF, Image, TXT, or DOCX document directly into a Google Drive Subject Folder"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isUploading ? 'Uploading to Drive...' : 'Upload Note (Max 25MB)'}</span>
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
                  Direct Google Drive Subject Folder Upload
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                  Drive API v3 multipart
                </span>
              </div>
              <p className="text-[11px] text-theme-muted mt-0.5">
                Drop files here or click "Upload Note" to select a Subject Folder in Drive. Files auto-organize into <span className="text-emerald-400 font-mono">StudyTracker Notes &gt; [Subject]</span>.
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

        {/* Global Success Notification Alert */}
        {uploadSuccess && (
          <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center justify-between gap-3 animate-fadeIn shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="font-medium truncate">{uploadSuccess}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastUploadedFolderLink && (
                <a
                  href={sanitizeUrl(lastUploadedFolderLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] transition-colors"
                  title="Open subject folder in Google Drive"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Folder</span>
                </a>
              )}
              <button 
                onClick={() => setUploadSuccess('')} 
                className="p-1 rounded-md text-emerald-400 hover:text-emerald-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Global Error Alert */}
        {uploadError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="truncate">{uploadError}</span>
            </div>
            <button onClick={() => setUploadError('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* UI NOTES EXPLORER GROUPED BY SUBJECT */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-theme-accent" />
            <h2 className="font-display font-bold text-sm text-theme-text uppercase tracking-wider">
              Google Drive Explorer (Grouped by Subject)
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-theme-surface border border-theme-border font-mono text-theme-muted">
              <RollingNumber value={driveFiles.length} /> files total
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <span className="hidden sm:inline">Drive Root:</span>
            <code className="text-emerald-400 font-mono text-[11px]">
              StudyTracker Notes/
            </code>
          </div>
        </div>

        {/* Subject Accordions */}
        {filesBySubject.length > 0 ? (
          <div className="space-y-3">
            {filesBySubject.map((group) => {
              const isCollapsed = !!collapsedSubjects[group.subject];
              const count = group.files.length;
              const countLabel = count === 1 ? '1 file' : `${count} files`;

              return (
                <div 
                  key={group.subject} 
                  className="rounded-2xl glass-panel border border-theme-border/80 overflow-hidden transition-all shadow-xs"
                >
                  {/* Subject Accordion Header */}
                  <div 
                    onClick={() => toggleSubjectCollapse(group.subject)}
                    className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-theme-surface/60 hover:bg-theme-cardHover/70 cursor-pointer select-none transition-colors border-b border-theme-border/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button 
                        type="button"
                        className="text-theme-muted hover:text-theme-text transition-transform duration-200"
                        aria-label={isCollapsed ? 'Expand subject' : 'Collapse subject'}
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      <div className="w-8 h-8 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-theme-accent" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-sm text-theme-text truncate">
                            {group.subject}
                          </h3>
                          <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-theme-bg border border-theme-border font-semibold text-theme-muted shrink-0">
                            {countLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-theme-muted flex items-center gap-1 font-mono mt-0.5 truncate">
                          <span>Google Drive</span> &gt; <span>StudyTracker Notes</span> &gt; <span className="text-emerald-400">{group.subject}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Direct "Open in Google Drive" button for Subject Folder */}
                      {group.folderLink ? (
                        <a
                          href={sanitizeUrl(group.folderLink)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-all shadow-xs"
                          title={`Open "${group.subject}" folder directly in Google Drive`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Google Drive</span>
                        </a>
                      ) : (
                        <a
                          href="https://drive.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs text-theme-muted hover:text-theme-text transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Google Drive</span>
                        </a>
                      )}

                      {/* Quick Upload Note to this Subject */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubject(group.subject);
                          setIsCustomSubject(false);
                          fileInputRef.current?.click();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs text-theme-muted hover:text-theme-text transition-all"
                        title={`Upload note directly into ${group.subject}`}
                      >
                        <Plus className="w-3.5 h-3.5 text-theme-accent" />
                        <span className="hidden sm:inline">Upload Note</span>
                      </button>
                    </div>
                  </div>

                  {/* Accordion Body: Files Grid inside Subject */}
                  {!isCollapsed && (
                    <div className="p-3.5 sm:p-4 bg-theme-bg/40 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.files.map((df) => (
                          <div 
                            key={df.id} 
                            className="p-3 rounded-xl bg-theme-surface/90 border border-theme-border hover:border-theme-accent/40 flex flex-col justify-between gap-2.5 text-xs transition-all shadow-xs card-glow-hover"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-theme-bg flex items-center justify-center shrink-0 border border-theme-border">
                                {df.type === 'pdf' ? (
                                  <FileText className="w-4 h-4 text-rose-400" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-sky-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-theme-text truncate text-xs" title={df.name}>
                                  {df.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-theme-muted">
                                  <span className="font-mono-numbers">{df.size}</span>
                                  <span>•</span>
                                  <span className="truncate">{new Date(df.uploadedAt || Date.now()).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-theme-border/50 text-[11px]">
                              {/* Direct "Open in Google Drive" button for Individual File */}
                              <a
                                href={sanitizeUrl(df.webViewLink)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open file directly in Google Drive"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme-bg hover:bg-theme-cardHover border border-theme-border text-theme-text hover:text-theme-accent transition-colors font-medium text-[11px]"
                              >
                                <ExternalLink className="w-3 h-3 text-theme-accent" />
                                <span>Open in Google Drive</span>
                              </a>

                              <div className="flex items-center gap-1">
                                {selectedNote && (
                                  <button
                                    type="button"
                                    onClick={() => handleInsertDriveFileIntoNote(df)}
                                    title="Insert link into active markdown note"
                                    className="p-1.5 rounded-lg hover:bg-theme-cardHover text-theme-muted hover:text-emerald-400 transition-colors"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => deleteDriveFile(df.id)}
                                  title="Remove from study tracker"
                                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl glass-panel border border-theme-border text-center">
            <div className="w-12 h-12 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center mx-auto mb-3">
              <Cloud className="w-6 h-6 text-theme-accent" />
            </div>
            <h3 className="font-display font-bold text-sm text-theme-text mb-1">
              No Drive Documents Organized Yet
            </h3>
            <p className="text-xs text-theme-muted max-w-md mx-auto mb-4">
              Upload PDF cheat sheets, lecture slides, or images. Study Tracker will automatically create dedicated Subject Folders in your Google Drive!
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white text-xs font-semibold shadow-glow-accent transition-all active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Upload First Note to Drive</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Split Interface: Markdown Notes & Editor */}
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
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer card-glow-hover ${
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
                    title="Upload & attach file directly to this note"
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
                  Drive Folder: <code className="font-mono-numbers text-emerald-400">{NOTES_PARENT_FOLDER_NAME}</code>
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

      {/* 1. UPLOAD MODAL & SUBJECT SELECTION */}
      {isUploadModalOpen && pendingUploadFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
          <div 
            className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-theme-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-theme-text">Upload Note to Google Drive</h3>
                  <p className="text-[11px] text-theme-muted">Organize into dedicated Subject Folders in Google Drive</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setPendingUploadFile(null);
                  }
                }}
                disabled={isUploading}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File Details Summary Card */}
            <div className="mt-4 p-3.5 rounded-xl bg-theme-surface/80 border border-theme-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-theme-bg flex items-center justify-center border border-theme-border shrink-0">
                  {pendingUploadFile.name.toLowerCase().endsWith('.pdf') ? (
                    <FileText className="w-5 h-5 text-rose-400" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-sky-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-xs text-theme-text truncate" title={pendingUploadFile.name}>
                      {pendingUploadFile.name}
                    </p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      Signature Verified
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-theme-muted">
                    <span className="font-mono-numbers">{(pendingUploadFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>•</span>
                    <span className="truncate">{pendingUploadFile.type || 'Document'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Selection Field */}
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-theme-text font-semibold mb-1.5 flex items-center justify-between">
                  <span>Subject</span>
                  <span className="text-[11px] font-normal text-theme-muted">Google Drive Subject Folder</span>
                </label>
                <select
                  value={isCustomSubject ? '__NEW_SUBJECT__' : selectedSubject}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_SUBJECT__') {
                      setIsCustomSubject(true);
                    } else {
                      setIsCustomSubject(false);
                      setSelectedSubject(e.target.value);
                    }
                  }}
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent transition-colors cursor-pointer"
                >
                  <optgroup label="Subjects & Syllabus List">
                    {subjectOptions.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </optgroup>
                  <optgroup label="New Folder">
                    <option value="__NEW_SUBJECT__">+ Create New Subject Folder</option>
                  </optgroup>
                </select>
              </div>

              {/* Reveal text input for "+ Create New Subject Folder" */}
              {isCustomSubject && (
                <div className="p-3 rounded-xl bg-theme-accent/5 border border-theme-accent/20 animate-fadeIn">
                  <label className="block text-theme-text font-medium mb-1 text-[11px]">
                    Custom Subject Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Operating Systems, Chemistry, Machine Learning..."
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      disabled={isUploading}
                      className="w-full px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-theme-muted mt-1">
                    A dedicated folder will be created inside "StudyTracker Notes" on your Google Drive.
                  </p>
                </div>
              )}

              {/* Visual Drive Folder Destination Preview */}
              <div className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border/60 text-[11px]">
                <span className="text-theme-muted block mb-1">Target Google Drive Path:</span>
                <div className="flex items-center gap-1.5 font-mono text-emerald-400">
                  <Folder className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-theme-muted">Google Drive</span>
                  <span>&gt;</span>
                  <span className="text-theme-muted">StudyTracker Notes</span>
                  <span>&gt;</span>
                  <span className="font-semibold text-emerald-300">
                    {isCustomSubject ? (customSubjectInput.trim() || 'Custom Subject') : selectedSubject}
                  </span>
                </div>
              </div>

              {/* Upload Progress Bar (when uploading) */}
              {isUploading && (
                <div className="space-y-2 pt-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-theme-accent font-medium flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {modalUploadStatus || 'Uploading note to Drive...'}
                    </span>
                    <span className="font-mono text-theme-accent">{modalUploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-theme-surface overflow-hidden border border-theme-border">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${modalUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Alert in Modal */}
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 mt-4 border-t border-theme-border flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setPendingUploadFile(null);
                }}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs text-theme-muted hover:text-theme-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={isUploading || (isCustomSubject && !customSubjectInput.trim())}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accentHover text-white text-xs font-semibold shadow-glow-accent transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Upload to Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Markdown Note Modal */}
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
                    {subjectOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-theme-muted font-medium mb-1">Category</label>
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
