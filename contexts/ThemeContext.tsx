import React, { createContext, useContext, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  primaryColor: string;
  updatePrimaryColor: (color: string) => void;
  resetTheme: () => void;
  animationsEnabled: boolean;
  updateAnimationsEnabled: (enabled: boolean) => void;
  solidNavBg: boolean;
  updateSolidNavBg: (solid: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful fallback to prevent crashes
    console.warn('useTheme must be used within a ThemeProvider');
    return {
        theme: 'light' as Theme,
        toggleTheme: () => {},
        primaryColor: '#c33367',
        updatePrimaryColor: (c: string) => {},
        resetTheme: () => {},
        animationsEnabled: true,
        updateAnimationsEnabled: (e: boolean) => {},
        solidNavBg: false,
        updateSolidNavBg: (s: boolean) => {}
    };
  }
  return context;
};

// Helper for color manipulation
const adjustColor = (color: string, amount: number) => {
    // Expand 3-digit hex to 6-digit
    let h = color.replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return '#' + h.replace(/../g, c => ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2));
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return localStorage.getItem('twilight-design-version') === 'bloom-1' && saved === 'dark' ? 'dark' : 'light';
    } catch { return 'light'; }
  });

  const [primaryColor, setPrimaryColor] = useState<string>(() => {
      try { const saved = localStorage.getItem('theme-primary'); return !saved || (localStorage.getItem('twilight-design-version') !== 'bloom-1' && saved.toLowerCase() === '#984369') ? '#c33367' : saved; }
      catch { return '#c33367'; }
  });

  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
      try { return localStorage.getItem('theme-animations') !== 'false'; }
      catch { return true; }
  });

  const [solidNavBg, setSolidNavBg] = useState<boolean>(() => {
      try { return localStorage.getItem('theme-solid-nav') === 'true'; }
      catch { return false; }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem('theme', theme); localStorage.setItem('twilight-design-version', 'bloom-1'); } catch {}
  }, [theme]);

  // Apply or remove body class for animations
  useEffect(() => {
    if (!animationsEnabled) {
      document.body.classList.add('disable-animations');
    } else {
      document.body.classList.remove('disable-animations');
    }
  }, [animationsEnabled]);

  // Apply Primary Color Variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', primaryColor);
    const rgb = (hex: string) => { let value=hex.slice(1); if(value.length===3)value=value.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16)).join(' '); };
    root.style.setProperty('--primary-rgb', rgb(primaryColor));

    // Generate shades
    // Note: Simple darkening/lightening logic
    // We can assume primaryColor is a hex
    try {
        const dark = adjustColor(primaryColor, -40);
        const light = adjustColor(primaryColor, 130); // Significantly lighter

        root.style.setProperty('--color-primary-dark', dark);
        root.style.setProperty('--color-primary-light', light);
        root.style.setProperty('--primary-light-rgb', rgb(light));

        // Also potential RGB vars if needed for opacity
        // Currently sticking with hex values for CSS custom properties.
        // If opacity support is needed, switch to RGB channel variables.

        localStorage.setItem('theme-primary', primaryColor);
    } catch (e) {
        console.error("Invalid color", e);
    }

  }, [primaryColor]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const updatePrimaryColor = (color: string) => {
      setPrimaryColor(color);
  };

  const updateAnimationsEnabled = (enabled: boolean) => {
      setAnimationsEnabled(enabled);
      localStorage.setItem('theme-animations', String(enabled));
  };

  const updateSolidNavBg = (solid: boolean) => {
      setSolidNavBg(solid);
      localStorage.setItem('theme-solid-nav', String(solid));
  };

  const resetTheme = () => {
      setPrimaryColor('#c33367');
      setTheme('light');
      updateAnimationsEnabled(true);
      updateSolidNavBg(false);
  };

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, primaryColor, updatePrimaryColor, resetTheme,
      animationsEnabled, updateAnimationsEnabled, solidNavBg, updateSolidNavBg
    }}>
      <MotionConfig reducedMotion={animationsEnabled ? "user" : "always"} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
};
