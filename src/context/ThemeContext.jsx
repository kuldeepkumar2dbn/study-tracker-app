import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Sparkles, Moon } from 'lucide-react';

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
  }
];

const ThemeContext = createContext();

export const STORAGE_KEY = 'studyflow_theme';

// Backward compatibility mapper for legacy theme identifiers
function normalizeTheme(themeKey) {
  if (themeKey === 'light') return 'clean';
  if (themeKey === 'dark' || themeKey === 'oled') return 'cyberpunk';
  if (themeKey === 'nord') return 'chromatic';
  if (THEMES.some(t => t.id === themeKey)) return themeKey;
  return 'cyberpunk';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
