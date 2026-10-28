import React, { useState, useEffect } from 'react';
import { 
  Headphones, 
  Volume2, 
  VolumeX, 
  CloudRain, 
  Waves, 
  Volume1, 
  Power 
} from 'lucide-react';
import { ambientAudioEngine, AMBIENT_SOUND_OPTIONS } from '../utils/ambientAudio';

/**
 * AmbientAudioControls Component
 * Renders an Ambient Audio toggle pill with sound options:
 * [Off] [Brown Noise] [Rainfall Filter]
 * Master mute toggle, smooth 0-100% volume slider, and audio wave animation.
 *
 * @param {boolean} compact - Compact layout for modals (e.g. video modal)
 * @param {string} className - Extra Tailwind container classes
 */
export default function AmbientAudioControls({ compact = false, className = '' }) {
  const [activeMode, setActiveMode] = useState(ambientAudioEngine.getMode());
  const [volume, setVolume] = useState(ambientAudioEngine.getVolume());
  const [isMuted, setIsMuted] = useState(ambientAudioEngine.getMuted());
  const [isPlaying, setIsPlaying] = useState(ambientAudioEngine.isPlaying());

  useEffect(() => {
    const unsubscribe = ambientAudioEngine.subscribe((state) => {
      setActiveMode(state.mode);
      setVolume(state.volume);
      setIsMuted(state.isMuted);
      setIsPlaying(state.isPlaying);
    });
    return unsubscribe;
  }, []);

  const handleSelectMode = (modeId) => {
    ambientAudioEngine.setMode(modeId, { fadeIn: true, duration: 1.0 });
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    ambientAudioEngine.setVolume(val);
  };

  const handleToggleMute = () => {
    ambientAudioEngine.toggleMute();
  };

  const isAudioActive = activeMode !== 'off' && activeMode !== 'none';
  const volumePercentage = Math.round(volume * 100);

  return (
    <div 
      className={`ambient-audio-panel rounded-2xl glass-panel p-4 border border-theme-border shadow-sm transition-all ${
        isAudioActive ? 'border-theme-accent/40 bg-theme-accent/5' : 'bg-theme-surface/50'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Left: Label & Sound Status */}
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl transition-all ${
            isAudioActive && !isMuted 
              ? 'bg-theme-accent text-white shadow-glow-accent' 
              : 'bg-theme-surface text-theme-muted border border-theme-border'
          }`}>
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-theme-text">Ambient Audio</span>
              {isAudioActive && !isMuted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Synthesizing
                </span>
              )}
            </div>
            <p className="text-[10px] text-theme-muted hidden sm:block">
              Zero-bandwidth native Web Audio noise synthesis
            </p>
          </div>
        </div>

        {/* Center / Right: Pill Segmented Selector: [Off] [Brown Noise] [Rainfall Filter] */}
        <div className="inline-flex items-center p-1 rounded-xl bg-theme-surface border border-theme-border shadow-inner gap-1">
          {AMBIENT_SOUND_OPTIONS.map((opt) => {
            const isSelected = activeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                id={`ambient-opt-${opt.id}`}
                onClick={() => handleSelectMode(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-theme-accent text-white shadow-sm'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
                }`}
                title={opt.description}
              >
                {opt.id === 'off' && <Power className="w-3 h-3" />}
                {opt.id === 'brown' && <Waves className="w-3 h-3" />}
                {opt.id === 'rainfall' && <CloudRain className="w-3 h-3" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Volume Slider & Master Mute Control Bar */}
      {isAudioActive && (
        <div className="mt-3 pt-3 border-t border-theme-border/60 flex items-center justify-between gap-4 animate-fadeIn">
          
          {/* Master Mute Toggle */}
          <button
            type="button"
            id="ambient-mute-btn"
            onClick={handleToggleMute}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors shrink-0 ${
              isMuted
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-theme-surface border-theme-border text-theme-muted hover:text-theme-text'
            }`}
            title={isMuted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span className="text-[11px] font-medium">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-theme-accent" />
                <span className="text-[11px] font-medium">Sound On</span>
              </>
            )}
          </button>

          {/* Smooth Volume Slider (0% to 100%) */}
          <div className="flex-1 flex items-center gap-2.5">
            <input
              type="range"
              id="ambient-volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              disabled={isMuted}
              className="w-full h-1.5 bg-theme-border rounded-lg appearance-none cursor-pointer accent-theme-accent focus:outline-none"
              title={`Ambient Volume: ${volumePercentage}%`}
            />
            <span className="text-[11px] font-mono-numbers font-semibold text-theme-muted w-10 text-right shrink-0">
              {isMuted ? '0%' : `${volumePercentage}%`}
            </span>
          </div>

          {/* Equalizer Micro-Wave Animation when actively playing */}
          {!isMuted && isPlaying && (
            <div className="hidden sm:flex items-center gap-0.5 h-4 px-1.5 py-1 rounded bg-theme-surface border border-theme-border shrink-0">
              <span className="w-0.5 h-2.5 bg-theme-accent rounded-full animate-pulse" style={{ animationDuration: '600ms' }}></span>
              <span className="w-0.5 h-3.5 bg-emerald-400 rounded-full animate-pulse" style={{ animationDuration: '450ms' }}></span>
              <span className="w-0.5 h-2 bg-theme-accent rounded-full animate-pulse" style={{ animationDuration: '700ms' }}></span>
              <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDuration: '500ms' }}></span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
