/**
 * Native Web Audio Ambient Sound Generator (src/utils/ambientAudio.js)
 * StudyFlow Zero-Bandwidth Focus Engine
 *
 * Implements:
 * 1. Pure mathematical noise synthesis (Zero external MP3s / $0 bandwidth):
 *    - Brown Noise: Integrated Brownian walk with 380Hz lowpass filter for deep focus rumble
 *    - Rainfall Filter: Paul Kellet pink noise algorithm with droplet patter + 1050Hz bandpass filter
 * 2. Smooth volume control (0% to 100%) and master mute toggle
 * 3. 2-second gentle linear/exponential fadeout when pausing, stopping, or timer finish
 * 4. Completion chime chords for timer finish
 */

export const AMBIENT_SOUND_OPTIONS = [
  { id: 'off', label: 'Off', description: 'Silence' },
  { id: 'brown', label: 'Brown Noise', description: 'Deep low-frequency focus rumble' },
  { id: 'rainfall', label: 'Rainfall Filter', description: 'Soothing rain droplets & pink noise' }
];

export class AmbientAudioEngine {
  constructor() {
    this.ctx = null;
    this.sourceNode = null;
    this.filterNode = null;
    this.filterNode2 = null;
    this.gainNode = null;
    this.activeMode = 'off'; // 'off' | 'brown' | 'rainfall' | 'pink' | 'white'
    this.volume = 0.7; // 0.0 to 1.0 (default 70%)
    this.isMuted = false;
    this.fadeTimeout = null;
    this.listeners = new Set();
  }

  /**
   * Initializes or resumes the AudioContext on first user interaction
   */
  initContext() {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
    }
    return this.ctx;
  }

  /**
   * Subscribes to ambient state updates (mode, volume, mute)
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((cb) => {
      try {
        cb({
          mode: this.activeMode,
          volume: this.volume,
          isMuted: this.isMuted,
          isPlaying: this.isPlaying()
        });
      } catch (e) {
        console.error('AmbientAudio listener error:', e);
      }
    });
  }

  isPlaying() {
    return this.activeMode !== 'off' && this.activeMode !== 'none' && !this.isMuted && !!this.sourceNode;
  }

  getMode() {
    return this.activeMode;
  }

  getVolume() {
    return this.volume;
  }

  getMuted() {
    return this.isMuted;
  }

  /**
   * Calculates target gain based on mode, volume, and mute status
   */
  calculateTargetGain(mode = this.activeMode) {
    if (this.isMuted || mode === 'off' || mode === 'none') {
      return 0.0001;
    }
    // Per-mode scaling factors for balanced perceived loudness
    const modeMultipliers = {
      brown: 0.18,
      rainfall: 0.16,
      pink: 0.14,
      white: 0.08
    };
    const multiplier = modeMultipliers[mode] || 0.15;
    return Math.max(0.0001, this.volume * multiplier);
  }

  /**
   * Synthesizes 5 seconds of seamless looping noise buffer mathematically
   */
  createNoiseBuffer(mode) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const bufferSize = 4 * sampleRate; // 4 seconds loop
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (mode === 'brown') {
      // Brown noise: Integrated white noise (Brownian walk)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output_calc: {
          lastOut = (lastOut + 0.025 * white) / 1.025;
          data[i] = lastOut * 3.8;
        }
      }
    } else if (mode === 'rainfall') {
      // Rainfall filter: Paul Kellet's pink noise algorithm + intermittent rain droplet patter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let lastRain = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;

        // Occasional soft water droplet click/patter
        const droplet = (Math.random() > 0.9975 ? (Math.random() * 0.35 - 0.17) : 0);
        lastRain = (lastRain * 0.85) + (pink * 0.09) + droplet;
        data[i] = lastRain * 1.5;
      }
    } else if (mode === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      }
    } else {
      // White noise fallback
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.12;
      }
    }

    return buffer;
  }

  /**
   * Sets the active ambient sound mode: 'off' | 'brown' | 'rainfall'
   */
  setMode(mode, { fadeIn = true, duration = 1.2 } = {}) {
    const normalizedMode = (mode === 'none' || !mode) ? 'off' : mode;

    if (normalizedMode === 'off') {
      this.fadeOut(1.5, () => {
        this.activeMode = 'off';
        this.notify();
      });
      return;
    }

    this.initContext();
    if (!this.ctx) {
      this.activeMode = normalizedMode;
      this.notify();
      return;
    }

    // Clear any pending fadeout shutdown
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    // Clean up existing audio graph
    this.tearDownAudioGraph();

    this.activeMode = normalizedMode;

    try {
      const buffer = this.createNoiseBuffer(normalizedMode);
      if (!buffer) return;

      this.sourceNode = this.ctx.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.loop = true;

      // Primary filter
      this.filterNode = this.ctx.createBiquadFilter();
      if (normalizedMode === 'brown') {
        // Deep lowpass around 380Hz for brown noise rumble
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(380, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(1.0, this.ctx.currentTime);
      } else if (normalizedMode === 'rainfall') {
        // Resonant bandpass at 1050Hz for rain patter
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.setValueAtTime(1050, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(1.3, this.ctx.currentTime);

        // Secondary gentle lowpass to tame harsh sibilance
        this.filterNode2 = this.ctx.createBiquadFilter();
        this.filterNode2.type = 'lowpass';
        this.filterNode2.frequency.setValueAtTime(2800, this.ctx.currentTime);
      } else {
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(1200, this.ctx.currentTime);
      }

      this.gainNode = this.ctx.createGain();
      const targetGain = this.calculateTargetGain(normalizedMode);

      if (fadeIn) {
        // Start from silent and ramp up
        this.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + duration);
      } else {
        this.gainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      }

      // Connect nodes: Source -> Filter [-> Filter2] -> Gain -> Destination
      if (this.filterNode2) {
        this.sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.filterNode2);
        this.filterNode2.connect(this.gainNode);
      } else {
        this.sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.gainNode);
      }
      this.gainNode.connect(this.ctx.destination);

      this.sourceNode.start();
    } catch (err) {
      console.warn('Failed to start ambient sound:', err);
    }

    this.notify();
  }

  /**
   * Smoothly adjusts volume (0.0 to 1.0)
   */
  setVolume(newVolume) {
    const clamped = Math.max(0, Math.min(1, Number(newVolume) || 0));
    this.volume = clamped;

    if (this.gainNode && this.ctx && this.activeMode !== 'off') {
      const targetGain = this.calculateTargetGain();
      const now = this.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.15);
    }

    this.notify();
  }

  /**
   * Toggles master mute state
   */
  toggleMute() {
    this.setMuted(!this.isMuted);
  }

  setMuted(muted) {
    this.isMuted = !!muted;

    if (this.gainNode && this.ctx && this.activeMode !== 'off') {
      const now = this.ctx.currentTime;
      const targetGain = this.calculateTargetGain();
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.2);
    }

    this.notify();
  }

  /**
   * Gently fades out the sound over durationSec (default 2.0s)
   * Mandatory requirement: When timer finishes or pauses, fade out over 2 seconds.
   */
  fadeOut(durationSec = 2.0, onComplete) {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    if (!this.gainNode || !this.ctx || this.activeMode === 'off') {
      this.tearDownAudioGraph();
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    try {
      const now = this.ctx.currentTime;
      const currentGain = this.gainNode.gain.value;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(currentGain, now);
      // Gentle linear ramp to near silence over 2 seconds
      this.gainNode.gain.linearRampToValueAtTime(0.0001, now + durationSec);

      this.fadeTimeout = setTimeout(() => {
        this.tearDownAudioGraph();
        this.fadeTimeout = null;
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, durationSec * 1000);
    } catch {
      this.tearDownAudioGraph();
      if (typeof onComplete === 'function') onComplete();
    }
  }

  tearDownAudioGraph() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.filterNode) {
      try { this.filterNode.disconnect(); } catch {}
      this.filterNode = null;
    }
    if (this.filterNode2) {
      try { this.filterNode2.disconnect(); } catch {}
      this.filterNode2 = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
      this.gainNode = null;
    }
  }

  /**
   * Hard stop immediately
   */
  stop() {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    this.tearDownAudioGraph();
    this.activeMode = 'off';
    this.notify();
  }

  /**
   * Backwards-compatible alias for existing callers
   */
  playMode(mode) {
    if (mode === 'none' || mode === 'off') {
      this.stop();
    } else {
      this.setMode(mode, { fadeIn: true, duration: 1.0 });
    }
  }

  /**
   * Dual harmonious completion chime chord
   */
  playCompletionChime() {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 major chord
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.14, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.5);
      });
    } catch {
      // Audio autoplay permission might require a user click
    }
  }

  playTaskComplete() {
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }
}

// Global Singleton Instance
export const ambientAudioEngine = new AmbientAudioEngine();
export const soundEngine = ambientAudioEngine;
export default ambientAudioEngine;
