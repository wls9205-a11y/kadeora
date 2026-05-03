'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// s215: 기본값 light. 다크는 사용자가 명시 저장한 경우에만.
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // s215: 기본값 light. 다크는 사용자가 명시 저장한 경우에만.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('kd_theme') as Theme | null;
    // s215: 명시 'dark' 저장된 사용자만 다크 유지, 그 외 (null/'light') 모두 light.
    const t: Theme = saved === 'dark' ? 'dark' : 'light';
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
    // s215: light 가 기본, 토글로 다크로 전환.
    const next: Theme = theme === 'light' ? 'dark' : 'light';
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
