import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'black' | 'light' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = 'teamacro_theme_mode';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme')) as string | null;
    if (stored === 'black' || stored === 'dark') return 'black';
    if (stored === 'light') return 'light';
    if (stored === 'system') return 'system';
  } catch (e) {
    console.warn('Unable to access localStorage for theme preference:', e);
  }
  return 'system';
};

const getSystemDarkPreference = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemDarkPreference);

  // Actively track operating system dark/light preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Modern event listener with fallback for legacy browsers
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, []);

  // Determine active resolved theme
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system'
      ? (systemIsDark ? 'dark' : 'light')
      : (theme === 'black' ? 'dark' : 'light');

  // Authoritative application to root element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  // Persist user selection
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      // Also update legacy key for compatibility
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      console.warn('Unable to persist theme to localStorage:', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
