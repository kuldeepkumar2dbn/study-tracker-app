/**
 * Settings & Theme Controllers (settings.js)
 * StudyFlow Zero-Backend Theme & Preference Engine
 *
 * Provides:
 * - Theme definitions:
 *   * "🌅 Mocha & Platinum Lavender" (mocha-lavender)
 *   * "⚡ Cyber Jet & Hot Pink" (cyber-jet)
 *   * "Clean Studio" (clean)
 *   * "Chromatic Identity" (chromatic)
 *   * "Midnight Cyberpunk" (cyberpunk)
 * - getTheme(): reads from localStorage ('studyflow_theme' / 'theme')
 * - setTheme(themeId): sets attribute data-theme on document.documentElement, updates dark class, persists to localStorage, and dispatches events
 * - toggleTheme(themeId): toggle or cycle themes
 * - Global window.setTheme / window.getTheme bindings for vanilla script access
 */

export const THEMES = [
  {
    id: 'clean',
    name: 'Clean Studio',
    tag: 'Light Studio',
    primaryColor: '#4f46e5',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    isDark: false
  },
  {
    id: 'chromatic',
    name: 'Chromatic Identity',
    tag: 'Vibrant Dynamic',
    primaryColor: '#6366f1',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    isDark: false
  },
  {
    id: 'cyberpunk',
    name: 'Midnight Cyberpunk',
    tag: 'OLED Neon',
    primaryColor: '#06b6d4',
    bgColor: '#050508',
    surfaceColor: '#0c0d14',
    cardColor: '#121320',
    textColor: '#f8fafc',
    borderColor: '#202336',
    isDark: true
  },
  {
    id: 'mocha-lavender',
    name: '🌅 Mocha & Platinum Lavender',
    tag: 'Mocha Lavender',
    primaryColor: '#6F4E37',
    bgColor: '#1A130E',
    surfaceColor: '#241A13',
    cardColor: '#2B1E16',
    textColor: '#E5E4E2',
    borderColor: '#422D21',
    isDark: true
  },
  {
    id: 'cyber-jet',
    name: '⚡ Cyber Jet & Hot Pink',
    tag: 'Cyber Jet',
    primaryColor: '#FF2DA3',
    bgColor: '#0B0B0B',
    surfaceColor: '#101010',
    cardColor: '#151515',
    textColor: '#FFFFFF',
    borderColor: '#282828',
    isDark: true
  },
  {
    id: 'black-gold',
    name: '👑 Onyx & Gold',
    tag: 'Onyx & Gold',
    primaryColor: '#0F0F0F',
    bgColor: '#E2C992',
    surfaceColor: '#D8BC82',
    cardColor: '#ECD9AE',
    textColor: '#000000',
    borderColor: '#FFFFFF',
    isDark: false
  }
];

export const STORAGE_KEY = 'studyflow_theme';

export function normalizeTheme(themeKey) {
  if (!themeKey) return 'cyberpunk';
  const cleanKey = String(themeKey).trim().toLowerCase();
  if (cleanKey === 'light') return 'clean';
  if (cleanKey === 'dark' || cleanKey === 'oled') return 'cyberpunk';
  if (cleanKey === 'nord') return 'chromatic';
  if (cleanKey === 'mocha' || cleanKey === 'mocha-lavender' || cleanKey.includes('mocha')) return 'mocha-lavender';
  if (cleanKey === 'cyber-jet' || cleanKey === 'cyberjet' || cleanKey.includes('cyber jet') || cleanKey.includes('hot pink')) return 'cyber-jet';
  if (cleanKey === 'black-gold' || cleanKey === 'onyx-gold' || cleanKey === 'onyx' || cleanKey === 'gold' || cleanKey.includes('onyx') || cleanKey.includes('black-gold')) return 'black-gold';
  const matched = THEMES.find(t => t.id === cleanKey);
  if (matched) return matched.id;
  return 'cyberpunk';
}

export function getTheme() {
  if (typeof localStorage === 'undefined') return 'cyberpunk';
  try {
    const saved = localStorage.getItem('studyflow_app_theme') || localStorage.getItem(STORAGE_KEY) || localStorage.getItem('theme');
    return normalizeTheme(saved);
  } catch {
    return 'cyberpunk';
  }
}

export function applySelectedTheme(themeId) {
  const validTheme = setTheme(themeId);
  if (typeof document !== 'undefined') {
    const allButtons = document.querySelectorAll('.theme-pill, #dashboard-theme-switcher button, [data-theme-id]');
    allButtons.forEach((btn) => {
      btn.classList.remove('is-active');
      const btnTheme = btn.getAttribute('data-theme-id') || btn.getAttribute('data-theme');
      if (btnTheme === validTheme) {
        btn.classList.add('is-active');
      }
    });
  }
  return validTheme;
}

export function setTheme(themeId) {
  const validTheme = normalizeTheme(themeId);
  const themeMeta = THEMES.find(t => t.id === validTheme) || THEMES[2];

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', validTheme);
    if (themeMeta.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('studyflow_app_theme', validTheme);
      localStorage.setItem(STORAGE_KEY, validTheme);
      localStorage.setItem('theme', validTheme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studyflow-theme-changed', { 
      detail: { theme: validTheme, themeMeta } 
    }));
  }

  return validTheme;
}

export function toggleTheme(themeId) {
  if (themeId) return setTheme(themeId);
  const current = getTheme();
  const currentIndex = THEMES.findIndex(t => t.id === current);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  return setTheme(THEMES[nextIndex].id);
}

// Global window registration
if (typeof window !== 'undefined') {
  window.setTheme = setTheme;
  window.getTheme = getTheme;
  window.toggleTheme = toggleTheme;
  window.applySelectedTheme = applySelectedTheme;
  window.THEMES = THEMES;
}

export default {
  THEMES,
  STORAGE_KEY,
  normalizeTheme,
  getTheme,
  setTheme,
  toggleTheme,
  applySelectedTheme
};

