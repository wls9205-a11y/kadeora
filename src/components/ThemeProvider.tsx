'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('kd_theme') as Theme | null;
    const t = saved === 'light' ? 'light' : 'dark';
    setTheme(t);
    applyTheme(t);
  }, []);

  const applyTheme = (t: Theme) => {
    const el = document.documentElement;
    if (t === 'light') {
      el.classList.add('theme-light');
      el.classList.remove('dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F5F7FA');
    } else {
      el.classList.remove('theme-light');
      el.classList.add('dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#050A18');
    }
  };

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('kd_theme', next);
    applyTheme(next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
