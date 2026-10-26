import confetti from 'canvas-confetti';

/**
 * Celebratory Micro-Confetti Burst Reward System
 * Uses installed canvas-confetti with fallback to window.confetti (CDN)
 */
export function celebrateTaskCompletion(origin = { y: 0.65 }) {
  try {
    const confettiFn = window.confetti || confetti;
    if (typeof confettiFn !== 'function') return;

    confettiFn({
      particleCount: 45,
      spread: 65,
      origin: origin,
      colors: ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#06B6D4'],
      scalar: 0.85,
      ticks: 140,
      gravity: 1.1,
      decay: 0.92,
      disableForReducedMotion: true
    });
  } catch (e) {
    console.warn('Confetti burst error:', e);
  }
}

/**
 * Major Milestone Fireworks Explosion (e.g. 100% daily routine completed)
 */
export function celebrateMajorMilestone() {
  try {
    const confettiFn = window.confetti || confetti;
    if (typeof confettiFn !== 'function') return;

    const count = 75;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#6366F1', '#10B981', '#F59E0B', '#F43F5E', '#A855F7'],
      disableForReducedMotion: true
    };

    function fire(particleRatio, opts) {
      confettiFn({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, { spread: 26, startVelocity: 45 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  } catch (e) {
    console.warn('Milestone confetti error:', e);
  }
}
