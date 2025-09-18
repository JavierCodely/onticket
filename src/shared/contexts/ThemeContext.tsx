import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ColorScheme {
  id: string;
  name: string;
  colors: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

const defaultColorSchemes: ColorScheme[] = [
  {
    id: 'default',
    name: 'Predeterminado',
    colors: {
      light: {
        primary: 'oklch(0.205 0 0)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.97 0 0)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.97 0 0)',
        'accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.922 0 0)',
        'primary-foreground': 'oklch(0.205 0 0)',
        secondary: 'oklch(0.269 0 0)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.269 0 0)',
        'accent-foreground': 'oklch(0.985 0 0)',
      }
    }
  },
  {
    id: 'blue',
    name: 'Azul Profesional',
    colors: {
      light: {
        primary: 'oklch(0.525 0.155 260)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.96 0.013 260)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.96 0.013 260)',
        'accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.7 0.15 260)',
        'primary-foreground': 'oklch(0.205 0 0)',
        secondary: 'oklch(0.25 0.02 260)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.25 0.02 260)',
        'accent-foreground': 'oklch(0.985 0 0)',
      }
    }
  },
  {
    id: 'purple',
    name: 'Púrpura Nocturno',
    colors: {
      light: {
        primary: 'oklch(0.525 0.155 300)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.96 0.013 300)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.96 0.013 300)',
        'accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.7 0.15 300)',
        'primary-foreground': 'oklch(0.205 0 0)',
        secondary: 'oklch(0.25 0.02 300)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.25 0.02 300)',
        'accent-foreground': 'oklch(0.985 0 0)',
      }
    }
  },
  {
    id: 'green',
    name: 'Verde Moderno',
    colors: {
      light: {
        primary: 'oklch(0.525 0.155 140)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.96 0.013 140)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.96 0.013 140)',
        'accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.7 0.15 140)',
        'primary-foreground': 'oklch(0.205 0 0)',
        secondary: 'oklch(0.25 0.02 140)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.25 0.02 140)',
        'accent-foreground': 'oklch(0.985 0 0)',
      }
    }
  },
  {
    id: 'orange',
    name: 'Naranja Vibrante',
    colors: {
      light: {
        primary: 'oklch(0.625 0.155 60)',
        'primary-foreground': 'oklch(0.985 0 0)',
        secondary: 'oklch(0.96 0.013 60)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        accent: 'oklch(0.96 0.013 60)',
        'accent-foreground': 'oklch(0.205 0 0)',
      },
      dark: {
        primary: 'oklch(0.75 0.15 60)',
        'primary-foreground': 'oklch(0.205 0 0)',
        secondary: 'oklch(0.25 0.02 60)',
        'secondary-foreground': 'oklch(0.985 0 0)',
        accent: 'oklch(0.25 0.02 60)',
        'accent-foreground': 'oklch(0.985 0 0)',
      }
    }
  }
];

interface ThemeContextType {
  theme: Theme;
  colorScheme: string;
  availableColorSchemes: ColorScheme[];
  setTheme: (theme: Theme) => void;
  setColorScheme: (colorScheme: string) => void;
  resetToDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('onticket-theme');
    return (stored as Theme) || 'system';
  });

  const [colorScheme, setColorScheme] = useState<string>(() => {
    const stored = localStorage.getItem('onticket-color-scheme');
    return stored || 'default';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.remove('light', 'dark');
    root.classList.add(isDark ? 'dark' : 'light');

    localStorage.setItem('onticket-theme', theme);
  }, [theme]);

  useEffect(() => {
    const scheme = defaultColorSchemes.find(s => s.id === colorScheme) || defaultColorSchemes[0];
    const root = window.document.documentElement;
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const colors = isDark ? scheme.colors.dark : scheme.colors.light;

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    localStorage.setItem('onticket-color-scheme', colorScheme);
  }, [colorScheme, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const resetToDefaults = () => {
    setTheme('system');
    setColorScheme('default');
    localStorage.removeItem('onticket-theme');
    localStorage.removeItem('onticket-color-scheme');
  };

  const value: ThemeContextType = {
    theme,
    colorScheme,
    availableColorSchemes: defaultColorSchemes,
    setTheme,
    setColorScheme,
    resetToDefaults
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}