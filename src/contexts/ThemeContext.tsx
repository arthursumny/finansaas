import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'dark' | 'light'; // O tema real aplicado (resolvendo 'system')
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  actualTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * Provider do contexto de tema
 * Gerencia o estado do tema e aplica as classes CSS correspondentes
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'FinanSaaS-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('light');

  /**
   * Resolve o tema atual baseado na preferência do usuário
   */
  const resolveTheme = (currentTheme: Theme): 'dark' | 'light' => {
    if (currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return currentTheme;
  };

  /**
   * Aplica o tema ao documento
   */
  const applyTheme = (resolvedTheme: 'dark' | 'light') => {
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Atualizar meta theme-color para PWA
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content', 
        resolvedTheme === 'dark' ? '#0f172a' : '#ffffff'
      );
    }
  };

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setActualTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  // Escutar mudanças na preferência do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = resolveTheme('system');
        setActualTheme(resolved);
        applyTheme(resolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  /**
   * Atualiza o tema e salva no localStorage
   */
  const updateTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  };

  const value = {
    theme,
    setTheme: updateTheme,
    actualTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Hook para usar o contexto de tema
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};

/**
 * Hook para alternar entre temas
 */
export const useThemeToggle = () => {
  const { theme, setTheme, actualTheme } = useTheme();

  /**
   * Alterna entre os temas disponíveis
   */
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  /**
   * Define um tema específico
   */
  const setSpecificTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  /**
   * Obtém o próximo tema na sequência
   */
  const getNextTheme = (): Theme => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'system';
    return 'light';
  };

  /**
   * Obtém o ícone correspondente ao tema atual
   */
  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
        return '💻';
      default:
        return '☀️';
    }
  };

  /**
   * Obtém o label do tema atual
   */
  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Escuro';
      case 'system':
        return 'Sistema';
      default:
        return 'Claro';
    }
  };

  return {
    theme,
    actualTheme,
    toggleTheme,
    setSpecificTheme,
    getNextTheme,
    getThemeIcon,
    getThemeLabel,
  };
};