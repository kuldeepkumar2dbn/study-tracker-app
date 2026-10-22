// Web Audio API ambient noise generator & bell sound
class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.isPlaying = false;
    this.currentMode = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playMode(mode) {
    this.init();
    this.stop();

    if (mode === 'none') return;

    this.isPlaying = true;
    this.currentMode = mode;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (mode === 'brown') {
        // Brown noise: deep rumble / rain
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      } else if (mode === 'pink') {
        // Pink noise: soft rainfall / forest rustle
        output[i] = (lastOut * 0.95) + (white * 0.05);
        lastOut = output[i];
        output[i] *= 2.0;
      } else {
        // White noise
        output[i] = white * 0.15;
      }
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.filterNode = this.ctx.createBiquadFilter();
    if (mode === 'brown') {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 400;
    } else if (mode === 'pink') {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 1200;
    } else {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 3000;
    }

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.noiseNode.start();
  }

  stop() {
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // ignore
      }
      this.noiseNode = null;
    }
    this.isPlaying = false;
    this.currentMode = null;
  }

  playCompletionChime() {
    this.init();
    try {
      const now = this.ctx.currentTime;
      // Dual harmonious chime (chord)
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.3);
      });
    } catch {
      // Audio might be blocked if user hasn't interacted
    }
  }
}

export const soundEngine = new AmbientSoundEngine();
