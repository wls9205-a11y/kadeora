'use client';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 18, padding: 4, color: 'var(--text-secondary)',
      }}
      title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
