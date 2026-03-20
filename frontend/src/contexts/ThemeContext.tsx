import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from '../stores/settings.store';

type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  isDark: boolean;
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  theme: 'dark',
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { updateUISettings } = useSettingsStore();

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('jedi-theme') as ThemeMode | null;
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('jedi-theme', theme);
    updateUISettings({ theme });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark: theme === 'dark', theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
