import React, { useState } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  FolderCheck, 
  ShieldCheck, 
  Database, 
  ExternalLink,
  Key,
  AlertCircle,
  HelpCircle,
  HardDrive
} from 'lucide-react';
import { useData } from '../context/DataContext';

export default function DriveModal({ isOpen, onClose }) {
  const { 
    googleClientId, 
    setGoogleClientId, 
    driveAccessToken, 
    driveUser, 
    driveFolderId,
    syncStatus, 
    lastSyncedTime,
    connectGoogleDrive, 
    disconnectGoogleDrive, 
    syncNowToDrive 
  } = useData();

  const [inputClientId, setInputClientId] = useState(googleClientId || '');
  const [showGuide, setShowGuide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSaveAndConnect = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!inputClientId.trim()) {
      setErrorMessage('Please enter a valid Google OAuth Client ID.');
      return;
    }

    setGoogleClientId(inputClientId.trim());
    setIsSubmitting(true);

    try {
      await connectGoogleDrive();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to authenticate with Google Drive.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-theme-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-blue-500 p-0.5 flex items-center justify-center shadow-lg">
              <div className="w-full h-full bg-theme-surface rounded-[10px] flex items-center justify-center">
                <Cloud className="w-5 h-5 text-theme-accent" />
              </div>
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                Google Drive API (v3) Integration
                {driveAccessToken && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-theme-muted">Direct client-side synchronization & zero-backend storage</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-cardHover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-theme-bg border border-theme-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              syncStatus === 'synced' ? 'bg-emerald-400' :
              syncStatus === 'syncing' ? 'bg-amber-400 animate-ping' :
              syncStatus === 'unsaved' ? 'bg-amber-500' : 'bg-zinc-500'
            }`} />
            <span className="font-medium text-theme-text capitalize">
              Status: {syncStatus === 'synced' ? 'Cloud Synced' : syncStatus === 'unsaved' ? 'Unsaved changes' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Storage (Offline)'}
            </span>
          </div>

          {lastSyncedTime && (
            <span className="text-[11px] text-theme-muted font-mono-numbers">
              Last saved: {lastSyncedTime}
            </span>
          )}
        </div>

        {/* Connection Form or Active State */}
        {!driveAccessToken ? (
          <form onSubmit={handleSaveAndConnect} className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-theme-accent" />
                  Google Cloud OAuth 2.0 Client ID
                </label>
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-[11px] text-theme-accent hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>How to get it (Free)</span>
                </button>
              </div>

              {/* Instructions guide accordion */}
              {showGuide && (
                <div className="p-3.5 mb-2.5 rounded-xl bg-theme-surface border border-theme-accent/20 text-xs text-theme-muted space-y-2">
                  <p className="font-semibold text-theme-text">3-Step Free Setup (Takes 2 minutes):</p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                    <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-theme-accent underline">Google Cloud Console</a> & create a free project.</li>
                    <li>Navigate to <strong>APIs & Services &gt; Credentials</strong> & click <strong>Create Credentials &gt; OAuth client ID</strong>.</li>
                    <li>Select <strong>Web application</strong>, and under <em>Authorized JavaScript origins</em>, add your current domain (e.g. <code>http://localhost:5173</code>, or your Vercel/GitHub Pages URL).</li>
                  </ol>
                  <p className="text-[10px] text-emerald-400 pt-1">
                    ✓ Scope requested: <code>drive.file</code> (restricts access exclusively to files created by StudyFlow).
                  </p>
                </div>
              )}

              <input
                type="text"
                value={inputClientId}
                onChange={(e) => setInputClientId(e.target.value)}
                placeholder="e.g. 123456789-abcdefgh.apps.googleusercontent.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-theme-surface border border-theme-border text-xs text-theme-text font-mono focus:outline-none focus:border-theme-accent"
              />
              <p className="text-[11px] text-theme-muted mt-1">
                Your Client ID is stored locally in your browser and used only by GIS.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-theme-muted">
                Offline fallback enabled by default.
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all flex items-center gap-1.5"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Connecting...' : 'Authorize & Connect Drive'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Connected user card */}
            <div className="p-4 rounded-xl bg-theme-surface border border-theme-border flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {driveUser?.picture ? (
                  <img src={driveUser.picture} alt="User" className="w-10 h-10 rounded-full border border-theme-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-theme-accent/20 text-theme-accent font-bold flex items-center justify-center text-sm">
                    {driveUser?.name?.slice(0, 2) || 'GU'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-theme-text">{driveUser?.name || 'Authorized Account'}</p>
                  <p className="text-xs text-theme-muted">{driveUser?.email || 'drive.file scope active'}</p>
                </div>
              </div>

              <button
                onClick={disconnectGoogleDrive}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
              >
                Disconnect
              </button>
            </div>

            {/* Folder & Data File details */}
            <div className="p-3.5 rounded-xl bg-theme-bg border border-theme-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-theme-muted flex items-center gap-1.5">
                  <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Target Cloud Folder:
                </span>
                <code className="px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-text font-mono">
                  MyStudyTracker_Data
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-theme-muted flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-theme-accent" />
                  Primary Storage File:
                </span>
                <code className="px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-text font-mono">
                  study_data.json
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-theme-muted">Client ID:</span>
                <span className="font-mono text-[10px] text-theme-muted truncate max-w-[200px]">
                  {googleClientId}
                </span>
              </div>
            </div>

            {/* Sync Now button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-theme-muted">
                Changes auto-saved every 3 seconds.
              </span>
              <button
                onClick={syncNowToDrive}
                className="px-4 py-2 rounded-xl bg-theme-accent text-white font-semibold text-xs shadow-glow-accent hover:bg-theme-accentHover transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Security & Offline Policy */}
        <div className="mt-5 p-3 rounded-xl bg-theme-surface/50 border border-theme-border text-[11px] text-theme-muted flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-theme-text">Zero Backend Security: </strong>
            All network requests communicate directly between your browser and Google APIs via OAuth2. Your study notes and data are never transmitted to any third-party server.
          </div>
        </div>

      </div>
    </div>
  );
}
