import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProviderWrapper');
  }
  return context;
};

export const ThemeProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('theme_mode');
    return (savedMode as ThemeMode) || 'light';
  });

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme_mode', newMode);
      return newMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#6366f1', // Modern indigo
            light: '#818cf8',
            dark: '#4f46e5',
            contrastText: '#fff',
          },
          secondary: {
            main: '#8b5cf6', // Purple accent
            light: '#a78bfa',
            dark: '#7c3aed',
            contrastText: '#fff',
          },
          error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#dc2626',
          },
          warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
          },
          info: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
          },
          success: {
            main: '#10b981',
            light: '#34d399',
            dark: '#059669',
          },
          background: {
            default: mode === 'light' ? '#f9fafb' : '#0f1214',
            paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
          },
          text: {
            primary: mode === 'light' ? '#111827' : '#f9fafb',
            secondary: mode === 'light' ? '#6b7280' : '#9ca3af',
            disabled: mode === 'light' ? '#9ca3af' : '#6b7280',
          },
          divider: mode === 'light' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.12)',
          action: {
            selected: 'rgba(99, 102, 241, 0.1)',
            selectedOpacity: 0.1,
            hover: 'rgba(99, 102, 241, 0.06)',
            hoverOpacity: 0.06,
          },
        },
        typography: {
          fontFamily: [
            'Inter',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
          ].join(','),
          h1: {
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          },
          h2: {
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          },
          h3: {
            fontSize: '1.75rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
          },
          h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.4,
          },
          h5: {
            fontSize: '1.25rem',
            fontWeight: 600,
            letterSpacing: '0em',
            lineHeight: 1.5,
          },
          h6: {
            fontSize: '1.125rem',
            fontWeight: 600,
            letterSpacing: '0.0075em',
            lineHeight: 1.6,
          },
          subtitle1: {
            fontSize: '1rem',
            fontWeight: 400,
            letterSpacing: '0.00938em',
            lineHeight: 1.75,
          },
          subtitle2: {
            fontSize: '0.875rem',
            fontWeight: 500,
            letterSpacing: '0.00714em',
            lineHeight: 1.57,
          },
          body1: {
            fontSize: '1rem',
            fontWeight: 400,
            letterSpacing: '0.00938em',
            lineHeight: 1.5,
          },
          body2: {
            fontSize: '0.875rem',
            fontWeight: 400,
            letterSpacing: '0.01071em',
            lineHeight: 1.43,
          },
          button: {
            fontSize: '0.875rem',
            fontWeight: 500,
            letterSpacing: '0.02857em',
            textTransform: 'none',
          },
        },
        shape: {
          borderRadius: 8,
        },
        shadows: [
          'none',
          '0px 2px 4px rgba(0,0,0,0.05)',
          '0px 4px 8px rgba(0,0,0,0.08)',
          '0px 8px 16px rgba(0,0,0,0.1)',
          '0px 12px 24px rgba(0,0,0,0.12)',
          '0px 16px 32px rgba(0,0,0,0.14)',
          '0px 20px 40px rgba(0,0,0,0.16)',
          '0px 24px 48px rgba(0,0,0,0.18)',
          '0px 1px 3px rgba(0,0,0,0.12), 0px 1px 2px rgba(0,0,0,0.24)',
          '0px 3px 6px rgba(0,0,0,0.15), 0px 2px 4px rgba(0,0,0,0.12)',
          '0px 10px 20px rgba(0,0,0,0.15), 0px 3px 6px rgba(0,0,0,0.10)',
          '0px 15px 25px rgba(0,0,0,0.15), 0px 5px 10px rgba(0,0,0,0.05)',
          '0px 20px 40px rgba(0,0,0,0.2)',
          '0px 2px 8px rgba(0,0,0,0.1)',
          '0px 4px 12px rgba(0,0,0,0.1)',
          '0px 6px 16px rgba(0,0,0,0.1)',
          '0px 8px 20px rgba(0,0,0,0.1)',
          '0px 10px 24px rgba(0,0,0,0.1)',
          '0px 12px 28px rgba(0,0,0,0.1)',
          '0px 14px 32px rgba(0,0,0,0.1)',
          '0px 16px 36px rgba(0,0,0,0.1)',
          '0px 18px 40px rgba(0,0,0,0.1)',
          '0px 20px 44px rgba(0,0,0,0.1)',
          '0px 22px 48px rgba(0,0,0,0.1)',
          '0px 24px 52px rgba(0,0,0,0.1)',
        ],
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 500,
                padding: '8px 20px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
                },
              },
              contained: {
                boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  boxShadow: '0px 4px 12px rgba(79, 70, 229, 0.3)',
                },
              },
              outlined: {
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.06)',
                },
              },
              text: {
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.06)',
                },
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow:
                  mode === 'light' ? '0px 2px 8px rgba(0,0,0,0.08)' : '0px 2px 8px rgba(0,0,0,0.5)',
              },
              elevation1: {
                boxShadow:
                  mode === 'light' ? '0px 2px 4px rgba(0,0,0,0.05)' : '0px 2px 4px rgba(0,0,0,0.5)',
              },
              elevation2: {
                boxShadow:
                  mode === 'light' ? '0px 4px 8px rgba(0,0,0,0.08)' : '0px 4px 8px rgba(0,0,0,0.5)',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow:
                  mode === 'light' ? '0px 2px 8px rgba(0,0,0,0.08)' : '0px 2px 8px rgba(0,0,0,0.5)',
                transition: 'box-shadow 0.3s ease-in-out',
                backgroundImage: 'none',
                '&:hover': {
                  boxShadow:
                    mode === 'light'
                      ? '0px 8px 24px rgba(0,0,0,0.12)'
                      : '0px 8px 24px rgba(0,0,0,0.5)',
                },
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              head: {
                fontWeight: 600,
                backgroundColor: mode === 'light' ? '#f8f9fa' : '#272727',
                borderBottom:
                  mode === 'light' ? '2px solid #e0e0e0' : '2px solid rgba(255, 255, 255, 0.12)',
              },
              root: {
                borderBottom:
                  mode === 'light' ? '1px solid #f0f0f0' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.9375rem',
                minHeight: 48,
                transition: 'color 0.2s ease-in-out',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                background: mode === 'light' ? '#4f46e5' : '#1e1b4b',
                color: '#ffffff',
                boxShadow:
                  mode === 'light' ? '0px 1px 0px rgba(0,0,0,0.12)' : '0px 1px 0px rgba(0,0,0,0.5)',
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? '#f8fafc' : '#13151a',
                borderRight: `1px solid ${
                  mode === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'
                }`,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontWeight: 500,
                borderRadius: 6,
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
        },
      }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
