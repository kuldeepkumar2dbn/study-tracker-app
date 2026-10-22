import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon, Sparkles, Compass } from 'lucide-react';

export const THEMES = [
  {
    id: 'light',
    name: 'Clean Light',
    description: 'Clean white / slate for high clarity',
    icon: Sun,
    primaryColor: '#4f46e5',
    bgColor: '#f8fafc',
    surfaceColor: '#ffffff',
    tag: 'Day Mode'
  },
  {
    id: 'dark',
    name: 'Neutral Dark',
    description: 'Neutral zinc / dark gray for easy viewing',
    icon: Moon,
    primaryColor: '#6366f1',
    bgColor: '#121316',
    surfaceColor: '#1e2026',
    tag: 'Default'
  },
  {
    id: 'oled',
    name: 'OLED Pure Black',
    description: 'True #000000 black for contrast & battery saving',
    icon: Sparkles,
    primaryColor: '#3b82f6',
    bgColor: '#000000',
    surfaceColor: '#121212',
    tag: 'OLED Black'
  },
  {
    id: 'nord',
    name: 'Nordic Frost',
    description: 'Slate blue / cool Arctic muted palette',
    icon: Compass,
    primaryColor: '#88c0d0',
    bgColor: '#242933',
    surfaceColor: '#3b4252',
    tag: 'Nord Slate'
  }
];

const ThemeContext = createContext();

const STORAGE_KEY = 'studyflow_theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEMES.some(t => t.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'dark';
  });

  const setTheme = (newTheme) => {
    if (THEMES.some(t => t.id === newTheme)) {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch (e) {
        console.error('Failed to save theme to localStorage', e);
      }
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Manage tailwind 'dark' class:
    // Light is non-dark, while 'dark', 'oled', and 'nord' are dark variants
    if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  const currentThemeMeta = THEMES.find(t => t.id === theme) || THEMES[1];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, currentThemeMeta }}>
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
