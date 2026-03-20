import React, { createContext, useContext, useState, useCallback } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  toggleTheme: () => {},
  theme: 'dark',
});

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = useCallback(() => setIsDark(d => !d), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme: isDark ? 'dark' : 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
