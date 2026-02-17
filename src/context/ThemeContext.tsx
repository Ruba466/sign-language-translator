import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const [darkMode, setDarkMode] = useState(true);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const theme = {
    darkMode,
    colors: darkMode
      ? {
          background: '#0B0F1A',
          text: '#FFFFFF',
          accent: '#00F5D4',
          secondary: '#1A1F2E',
        }
      : {
          background: '#FFFFFF',
          text: '#000000',
          accent: '#007AFF',
          secondary: '#E5E5E5',
        },
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
