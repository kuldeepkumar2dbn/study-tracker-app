import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import {
  isAppLocked,
  verifyAppPin
} from '../../security-privacy.js';

export default function PinLockOverlay() {
  const [locked, setLocked] = useState(() => isAppLocked());
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const syncLockState = () => {
      setLocked(isAppLocked());
    };
    syncLockState();
    window.addEventListener('studyflow-pin-changed', syncLockState);
    window.addEventListener('storage', syncLockState);
    return () => {
      window.removeEventListener('studyflow-pin-changed', syncLockState);
      window.removeEventListener('storage', syncLockState);
    };
  }, []);

  if (!locked) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError(null);
    const cleaned = pinInput.trim();
    if (!/^\d{4,6}$/.test(cleaned)) {
      setError('Enter your 4–6 digit PIN.');
      return;
    }

    setIsChecking(true);
    try {
      const ok = await verifyAppPin(cleaned);
      if (ok) {
        setPinInput('');
        setLocked(false);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPinInput('');
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      id="app-pin-lock-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="App PIN Lock Screen"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fadeIn"
      style={{
        backgroundColor: 'var(--bg-app, #0b0d17)'
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-glow)',
          color: 'var(--text-main)'
        }}
      >
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-display font-extrabold text-xl tracking-tight" style={{ color: 'var(--text-main)' }}>
            StudyFlow Locked
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Enter your 4–6 digit App PIN to unlock your study workspace.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="pin-unlock-input"
              className="sr-only"
            >
              App PIN
            </label>
            <div
              className="flex items-center rounded-xl px-3.5 py-2.5"
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: error ? '1.5px solid #f43f5e' : '1.5px solid var(--border-glow)'
              }}
            >
              <KeyRound className="w-4 h-4 mr-2.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                id="pin-unlock-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                placeholder="••••••"
                className="w-full bg-transparent text-center text-lg font-mono-numbers font-extrabold tracking-[0.45em] focus:outline-none"
                style={{ color: 'var(--text-main)' }}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-500">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="pin-unlock-submit-btn"
            type="submit"
            disabled={isChecking || pinInput.length < 4}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-extrabold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: '1.5px solid var(--border-glow)'
            }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isChecking ? 'Verifying...' : 'Unlock Workspace'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

