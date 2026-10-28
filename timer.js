/**
 * StudyFlow Focus Timer Core (timer.js)
 * Multi-Page Architecture & Native Web Audio Focus Engine
 *
 * Exports:
 * - TimerTab component
 * - AmbientAudioControls component
 * - ambientAudioEngine singleton
 * - soundEngine backward-compatible instance
 * - AmbientAudioEngine class
 * - AMBIENT_SOUND_OPTIONS sound mode configurations
 */

import TimerTab from './src/components/tabs/TimerTab.jsx';
import AmbientAudioControls from './src/components/AmbientAudioControls.jsx';
import { 
  ambientAudioEngine, 
  soundEngine, 
  AmbientAudioEngine, 
  AMBIENT_SOUND_OPTIONS 
} from './src/utils/ambientAudio.js';

export {
  TimerTab,
  AmbientAudioControls,
  ambientAudioEngine,
  soundEngine,
  AmbientAudioEngine,
  AMBIENT_SOUND_OPTIONS
};

export default {
  TimerTab,
  AmbientAudioControls,
  ambientAudioEngine,
  soundEngine,
  AmbientAudioEngine,
  AMBIENT_SOUND_OPTIONS
};
