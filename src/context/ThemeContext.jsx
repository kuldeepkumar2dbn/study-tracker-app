import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Sparkles, Moon, Zap, Sunset } from 'lucide-react';

/**
 * Feature-Specific Vibrant Color Identity Mapping
 */
export const FEATURE_COLORS = {
  dashboard: {
    id: 'dashboard',
    name: 'Royal Indigo',
    hex: '#6366F1',
    glow: 'rgba(99, 102, 241, 0.4)',
    bgTint: 'rgba(99, 102, 241, 0.12)',
    borderTint: 'rgba(99, 102, 241, 0.4)',
    textClass: 'text-indigo-500 dark:text-indigo-400'
  },
  routine: {
    id: 'routine',
    name: 'Emerald Teal',
    hex: '#10B981',
    glow: 'rgba(16, 185, 129, 0.4)',
    bgTint: 'rgba(16, 185, 129, 0.12)',
    borderTint: 'rgba(16, 185, 129, 0.4)',
    textClass: 'text-emerald-500 dark:text-emerald-400'
  },
  calendar: {
    id: 'calendar',
    name: 'Amber Gold',
    hex: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.4)',
    bgTint: 'rgba(245, 158, 11, 0.12)',
    borderTint: 'rgba(245, 158, 11, 0.4)',
    textClass: 'text-amber-500 dark:text-amber-400'
  },
  syllabus: {
    id: 'syllabus',
    name: 'Cyan Blue',
    hex: '#06B6D4',
    glow: 'rgba(6, 182, 212, 0.4)',
    bgTint: 'rgba(6, 182, 212, 0.12)',
    borderTint: 'rgba(6, 182, 212, 0.4)',
    textClass: 'text-cyan-500 dark:text-cyan-400'
  },
  revision: {
    id: 'revision',
    name: 'Neon Mint',
    hex: '#14B8A6',
    glow: 'rgba(20, 184, 166, 0.4)',
    bgTint: 'rgba(20, 184, 166, 0.12)',
    borderTint: 'rgba(20, 184, 166, 0.4)',
    textClass: 'text-teal-500 dark:text-teal-400'
  },
  radar: {
    id: 'radar',
    name: 'Crimson Rose',
    hex: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.4)',
    bgTint: 'rgba(244, 63, 94, 0.12)',
    borderTint: 'rgba(244, 63, 94, 0.4)',
    textClass: 'text-rose-500 dark:text-rose-400'
  },
  skills: {
    id: 'skills',
    name: 'Electric Purple',
    hex: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.4)',
    bgTint: 'rgba(168, 85, 247, 0.12)',
    borderTint: 'rgba(168, 85, 247, 0.4)',
    textClass: 'text-purple-500 dark:text-purple-400'
  },
  notes: {
    id: 'notes',
    name: 'Ocean Blue',
    hex: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.4)',
    bgTint: 'rgba(59, 130, 246, 0.12)',
    borderTint: 'rgba(59, 130, 246, 0.4)',
    textClass: 'text-blue-500 dark:text-blue-400'
  },
  timer: {
    id: 'timer',
    name: 'Electric Violet',
    hex: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.5)',
    bgTint: 'rgba(139, 92, 246, 0.15)',
    borderTint: 'rgba(139, 92, 246, 0.5)',
    textClass: 'text-violet-500 dark:text-violet-400'
  }
};

export const THEMES = [
  {
    id: 'clean',
    name: 'Clean Studio',
    description: 'Current default light theme with minimalist focus',
    icon: Sun,
    primaryColor: '#4f46e5',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    tag: 'Light Studio',
    isDark: false,
    isFeatureCoded: false
  },
  {
    id: 'chromatic',
    name: 'Chromatic Identity',
    description: 'Feature-specific vibrant color palettes & glowing accents',
    icon: Sparkles,
    primaryColor: '#6366f1',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    cardColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    tag: 'Vibrant Dynamic',
    isDark: false,
    isFeatureCoded: true
  },
  {
    id: 'cyberpunk',
    name: 'Midnight Cyberpunk',
    description: 'OLED dark mode with vibrant neon feature accents',
    icon: Moon,
    primaryColor: '#06b6d4',
    bgColor: '#050508',
    surfaceColor: '#0c0d14',
    cardColor: '#121320',
    textColor: '#f8fafc',
    borderColor: '#202336',
    tag: 'OLED Neon',
    isDark: true,
    isFeatureCoded: true
  },
  {
    id: 'mocha-lavender',
    name: '🌅 Mocha & Platinum Lavender',
    description: 'Warm mocha brown background with platinum silver and pale lavender accents',
    icon: Sunset,
    primaryColor: '#6F4E37',
    bgColor: '#1A130E',
    surfaceColor: '#241A13',
    cardColor: '#2B1E16',
    textColor: '#E5E4E2',
    borderColor: '#422D21',
    tag: 'Mocha Lavender',
    isDark: true,
    isFeatureCoded: false
  },
  {
    id: 'cyber-jet',
    name: '⚡ Cyber Jet & Hot Pink',
    description: 'Jet black with electrifying hot pink and chartreuse neon highlights',
    icon: Zap,
    primaryColor: '#FF2DA3',
    bgColor: '#0B0B0B',
    surfaceColor: '#101010',
    cardColor: '#151515',
    textColor: '#FFFFFF',
    borderColor: '#282828',
    tag: 'Cyber Jet',
    isDark: true,
    isFeatureCoded: false
  }
];

const ThemeContext = createContext();

export const STORAGE_KEY = 'studyflow_theme';

// Backward compatibility mapper for legacy theme identifiers
function normalizeTheme(themeKey) {
  if (!themeKey) return 'cyberpunk';
  const cleanKey = String(themeKey).trim().toLowerCase();
  if (cleanKey === 'light') return 'clean';
  if (cleanKey === 'dark' || cleanKey === 'oled') return 'cyberpunk';
  if (cleanKey === 'nord') return 'chromatic';
  if (cleanKey === 'mocha' || cleanKey === 'mocha-lavender' || cleanKey.includes('mocha')) return 'mocha-lavender';
  if (cleanKey === 'cyber-jet' || cleanKey === 'cyberjet' || cleanKey.includes('cyber jet') || cleanKey.includes('hot pink')) return 'cyber-jet';
  if (THEMES.some(t => t.id === cleanKey)) return cleanKey;
  return 'cyberpunk';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('theme');
      if (saved) {
        return normalizeTheme(saved);
      }
    } catch {
      // ignore
    }
    return 'cyberpunk';
  });

  const setTheme = (newTheme) => {
    const valid = normalizeTheme(newTheme);
    setThemeState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, valid);
      localStorage.setItem('theme', valid);
      document.documentElement.setAttribute('data-theme', valid);
      const meta = THEMES.find(t => t.id === valid) || THEMES[2];
      if (meta && meta.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('studyflow-theme-changed', { detail: { theme: valid } }));
    } catch (e) {
      console.error('Failed to save theme to localStorage', e);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    const themeMeta = THEMES.find(t => t.id === theme) || THEMES[2];
    if (themeMeta.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (typeof window !== 'undefined') {
      window.setTheme = setTheme;
      window.getTheme = () => theme;
      window.THEMES = THEMES;
    }
  }, [theme]);

  const currentThemeMeta = THEMES.find(t => t.id === theme) || THEMES[2];
  const isFeatureCoded = currentThemeMeta.isFeatureCoded;

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      themes: THEMES, 
      currentThemeMeta, 
      isFeatureCoded,
      featureColors: FEATURE_COLORS,
      getFeatureColor: (featureKey) => FEATURE_COLORS[featureKey] || FEATURE_COLORS.dashboard
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
