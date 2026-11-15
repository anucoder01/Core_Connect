"use client";

import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('storage', callback);
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' ? 'dark' : 'light';
}

function getServerSnapshot(): 'light' | 'dark' {
  return 'light';
}

export default function ThemeToggle({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // localStorage may be restricted in private/sandboxed contexts
    }
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`icon-button ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)',
        color: isDark ? '#fbbf24' : '#4f46e5',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'var(--shadow-sm)',
        ...style
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ transition: 'transform 0.3s ease' }} />
      ) : (
        <Moon size={18} style={{ transition: 'transform 0.3s ease' }} />
      )}
    </button>
  );
}
