import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, alpha } from '@mui/material/styles';
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

/**
 * Monospace stack for machine-readable values: resource ids, versions, regions,
 * ARNs, hashes. Keeping these tabular is what makes a long infrastructure list
 * scannable, so prefer this over the UI font for anything the backend generated.
 */
export const MONO_FONT =
  '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

/**
 * Chart series colours for deployment outcome.
 *
 * Deliberately NOT the green/red of the status icons. In a chart the fill is the
 * only cue, and a green/red pair is the classic red-green-blind failure: the
 * palette validator scores our success/error pair at deutan ΔE 3.3, far under
 * the ΔE 8 floor. Blue/orange/violet scores ΔE 23+ on every simulated deficiency
 * while staying inside the lightness band and chroma floor for each surface.
 *
 * Status *icons* keep green/red because they also carry a distinct glyph shape
 * and a text label, so colour is never doing the work alone.
 */
export const CHART_STATUS_COLORS = {
  light: {
    success: '#0284c7',
    failed: '#c2410c',
    inProgress: '#7c3aed',
    unknown: '#94a3b8',
  },
  dark: {
    success: '#0d9ddb',
    failed: '#e2670f',
    inProgress: '#9068f0',
    unknown: '#6b7280',
  },
} as const;

export const useChartStatusColors = () => {
  const { mode } = useThemeMode();
  return CHART_STATUS_COLORS[mode];
};

const UI_FONT = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',');

/**
 * Surface ramp. Light mode separates chrome (white) from canvas (grey) so cards
 * read as raised without needing shadows; dark mode inverts that relationship.
 */
const surfaces = {
  light: {
    canvas: '#f6f7f9',
    paper: '#ffffff',
    chrome: '#ffffff',
    subtle: '#f1f3f5',
    border: '#e4e7ec',
    borderStrong: '#d3d8e0',
  },
  dark: {
    canvas: '#0e1013',
    paper: '#16181d',
    chrome: '#16181d',
    subtle: '#1c1f26',
    border: 'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
  },
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

  const theme = useMemo(() => {
    const isLight = mode === 'light';
    const s = isLight ? surfaces.light : surfaces.dark;

    // Accent is deliberately restrained: it marks what is interactive or
    // selected, and nothing else. Chrome stays neutral.
    const accent = isLight
      ? { main: '#4b53c6', light: '#6b73d6', dark: '#3a41a8', contrastText: '#ffffff' }
      : { main: '#8b93f0', light: '#a5abf5', dark: '#6b73d6', contrastText: '#0e1013' };

    const status = isLight
      ? {
          success: { main: '#0f7a4d', light: '#e6f4ec', dark: '#0b5c3a' },
          error: { main: '#c22f2f', light: '#fbeaea', dark: '#96201f' },
          warning: { main: '#9a6100', light: '#fdf1de', dark: '#7a4c00' },
          info: { main: '#1a68c4', light: '#e7f0fb', dark: '#12509b' },
        }
      : {
          success: { main: '#3fbb7d', light: '#6fd0a0', dark: '#2a8f5d' },
          error: { main: '#f0736c', light: '#f59b96', dark: '#c2504a' },
          warning: { main: '#e0a33a', light: '#ecbe6e', dark: '#b37d22' },
          info: { main: '#68a8ee', light: '#93c1f4', dark: '#4581c4' },
        };

    return createTheme({
      palette: {
        mode,
        primary: accent,
        // Secondary intentionally mirrors the accent rather than introducing a
        // second hue -- a two-tone brand reads consumer, not operational.
        secondary: {
          main: isLight ? '#5c6470' : '#9aa1ac',
          light: isLight ? '#8b929c' : '#b6bcc5',
          dark: isLight ? '#3f454e' : '#6b7280',
          contrastText: '#ffffff',
        },
        ...status,
        background: {
          default: s.canvas,
          paper: s.paper,
        },
        text: {
          primary: isLight ? '#1a1d21' : '#e6e8ec',
          secondary: isLight ? '#5c6470' : '#9aa1ac',
          disabled: isLight ? '#a2a8b2' : '#6b7280',
        },
        divider: s.border,
        action: {
          // Neutral hover: tinting every hover with the brand hue is what makes
          // a dense table feel noisy.
          hover: isLight ? 'rgba(16, 20, 26, 0.04)' : 'rgba(255, 255, 255, 0.05)',
          hoverOpacity: 0.04,
          selected: alpha(accent.main, isLight ? 0.08 : 0.16),
          selectedOpacity: isLight ? 0.08 : 0.16,
          focus: alpha(accent.main, 0.12),
        },
      },
      typography: {
        fontFamily: UI_FONT,
        // 14px base: an operations console is judged by how many rows fit on
        // screen, not by how comfortable a paragraph is.
        fontSize: 14,
        h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
        h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.018em', lineHeight: 1.3 },
        h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.014em', lineHeight: 1.35 },
        h4: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4 },
        h5: { fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.006em', lineHeight: 1.45 },
        h6: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.003em', lineHeight: 1.5 },
        subtitle1: { fontSize: '0.875rem', fontWeight: 500, letterSpacing: 0, lineHeight: 1.5 },
        subtitle2: { fontSize: '0.8125rem', fontWeight: 600, letterSpacing: 0, lineHeight: 1.5 },
        body1: { fontSize: '0.875rem', fontWeight: 400, letterSpacing: 0, lineHeight: 1.55 },
        body2: { fontSize: '0.8125rem', fontWeight: 400, letterSpacing: 0, lineHeight: 1.55 },
        caption: { fontSize: '0.75rem', fontWeight: 400, letterSpacing: 0, lineHeight: 1.45 },
        overline: {
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.07em',
          lineHeight: 1.4,
          textTransform: 'uppercase',
        },
        button: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          letterSpacing: 0,
          textTransform: 'none',
        },
      },
      shape: {
        borderRadius: 6,
      },
      // Shadows exist to lift transient layers (menus, dialogs, popovers) off
      // the page. Persistent surfaces use borders instead.
      shadows: [
        'none',
        `0 1px 2px ${isLight ? 'rgba(16,20,26,0.06)' : 'rgba(0,0,0,0.45)'}`,
        `0 1px 3px ${isLight ? 'rgba(16,20,26,0.08)' : 'rgba(0,0,0,0.5)'}`,
        `0 2px 6px ${isLight ? 'rgba(16,20,26,0.08)' : 'rgba(0,0,0,0.5)'}`,
        `0 3px 8px ${isLight ? 'rgba(16,20,26,0.09)' : 'rgba(0,0,0,0.55)'}`,
        `0 4px 10px ${isLight ? 'rgba(16,20,26,0.10)' : 'rgba(0,0,0,0.55)'}`,
        `0 5px 12px ${isLight ? 'rgba(16,20,26,0.10)' : 'rgba(0,0,0,0.55)'}`,
        `0 6px 14px ${isLight ? 'rgba(16,20,26,0.11)' : 'rgba(0,0,0,0.6)'}`,
        `0 8px 16px ${isLight ? 'rgba(16,20,26,0.11)' : 'rgba(0,0,0,0.6)'}`,
        `0 9px 18px ${isLight ? 'rgba(16,20,26,0.12)' : 'rgba(0,0,0,0.6)'}`,
        `0 10px 20px ${isLight ? 'rgba(16,20,26,0.12)' : 'rgba(0,0,0,0.62)'}`,
        `0 11px 22px ${isLight ? 'rgba(16,20,26,0.12)' : 'rgba(0,0,0,0.62)'}`,
        `0 12px 24px ${isLight ? 'rgba(16,20,26,0.13)' : 'rgba(0,0,0,0.64)'}`,
        `0 13px 26px ${isLight ? 'rgba(16,20,26,0.13)' : 'rgba(0,0,0,0.64)'}`,
        `0 14px 28px ${isLight ? 'rgba(16,20,26,0.13)' : 'rgba(0,0,0,0.66)'}`,
        `0 15px 30px ${isLight ? 'rgba(16,20,26,0.14)' : 'rgba(0,0,0,0.66)'}`,
        `0 16px 32px ${isLight ? 'rgba(16,20,26,0.14)' : 'rgba(0,0,0,0.68)'}`,
        `0 17px 34px ${isLight ? 'rgba(16,20,26,0.14)' : 'rgba(0,0,0,0.68)'}`,
        `0 18px 36px ${isLight ? 'rgba(16,20,26,0.15)' : 'rgba(0,0,0,0.7)'}`,
        `0 19px 38px ${isLight ? 'rgba(16,20,26,0.15)' : 'rgba(0,0,0,0.7)'}`,
        `0 20px 40px ${isLight ? 'rgba(16,20,26,0.15)' : 'rgba(0,0,0,0.72)'}`,
        `0 21px 42px ${isLight ? 'rgba(16,20,26,0.16)' : 'rgba(0,0,0,0.72)'}`,
        `0 22px 44px ${isLight ? 'rgba(16,20,26,0.16)' : 'rgba(0,0,0,0.74)'}`,
        `0 23px 46px ${isLight ? 'rgba(16,20,26,0.16)' : 'rgba(0,0,0,0.74)'}`,
        `0 24px 48px ${isLight ? 'rgba(16,20,26,0.17)' : 'rgba(0,0,0,0.76)'}`,
      ],
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            html: {
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            },
            body: {
              backgroundColor: s.canvas,
            },
            // Slim, neutral scrollbars -- default chunky ones dominate the
            // dense panels this app is full of.
            '*::-webkit-scrollbar': { width: 10, height: 10 },
            '*::-webkit-scrollbar-track': { background: 'transparent' },
            '*::-webkit-scrollbar-thumb': {
              backgroundColor: isLight ? 'rgba(16,20,26,0.18)' : 'rgba(255,255,255,0.16)',
              borderRadius: 8,
              border: `2px solid ${s.canvas}`,
            },
            '*::-webkit-scrollbar-thumb:hover': {
              backgroundColor: isLight ? 'rgba(16,20,26,0.28)' : 'rgba(255,255,255,0.26)',
            },
            ':focus-visible': {
              outline: `2px solid ${accent.main}`,
              outlineOffset: 2,
            },
          },
        },
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              borderRadius: 6,
              textTransform: 'none',
              fontWeight: 500,
              padding: '5px 12px',
              minHeight: 32,
              // No lift, no growing shadow: chrome that moves under the cursor
              // reads as a marketing site.
              transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
            },
            sizeSmall: { padding: '3px 10px', minHeight: 28, fontSize: '0.75rem' },
            sizeLarge: { padding: '8px 18px', minHeight: 40, fontSize: '0.875rem' },
            contained: {
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            },
            outlined: {
              borderColor: s.borderStrong,
              color: isLight ? '#3f454e' : '#e6e8ec',
              '&:hover': {
                borderColor: isLight ? '#b9c0ca' : 'rgba(255,255,255,0.28)',
                backgroundColor: isLight ? 'rgba(16,20,26,0.03)' : 'rgba(255,255,255,0.04)',
              },
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              transition: 'background-color 120ms ease, color 120ms ease',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
            outlined: {
              borderColor: s.border,
            },
          },
        },
        MuiCard: {
          defaultProps: {
            elevation: 0,
          },
          styleOverrides: {
            root: {
              borderRadius: 8,
              border: `1px solid ${s.border}`,
              boxShadow: 'none',
              backgroundImage: 'none',
            },
          },
        },
        MuiCardHeader: {
          styleOverrides: {
            root: {
              padding: '12px 16px',
              borderBottom: `1px solid ${s.border}`,
            },
            title: { fontSize: '0.875rem', fontWeight: 600 },
            subheader: { fontSize: '0.75rem', marginTop: 2 },
          },
        },
        MuiCardContent: {
          styleOverrides: {
            root: {
              padding: 16,
              '&:last-child': { paddingBottom: 16 },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              fontWeight: 600,
              fontSize: '0.6875rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isLight ? '#5c6470' : '#9aa1ac',
              backgroundColor: s.subtle,
              borderBottom: `1px solid ${s.border}`,
              padding: '8px 16px',
              whiteSpace: 'nowrap',
            },
            root: {
              fontSize: '0.8125rem',
              padding: '10px 16px',
              borderBottom: `1px solid ${s.border}`,
            },
            sizeSmall: { padding: '6px 12px' },
          },
        },
        MuiTableRow: {
          styleOverrides: {
            root: {
              // th too, not just td: key/value metadata tables use header cells
              // in the first column and were left with a stub of a rule.
              '&:last-child td, &:last-child th': { borderBottom: 0 },
              '&.MuiTableRow-hover:hover': {
                backgroundColor: isLight ? 'rgba(16,20,26,0.025)' : 'rgba(255,255,255,0.035)',
              },
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: { minHeight: 40 },
            indicator: { height: 2 },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.8125rem',
              minHeight: 40,
              padding: '8px 14px',
              color: isLight ? '#5c6470' : '#9aa1ac',
              transition: 'color 120ms ease',
              '&.Mui-selected': { fontWeight: 600 },
            },
          },
        },
        MuiAppBar: {
          defaultProps: {
            elevation: 0,
            color: 'inherit',
          },
          styleOverrides: {
            root: {
              // Neutral chrome. The old solid indigo band pulled every ounce of
              // attention to a bar that carries almost no information.
              backgroundColor: s.chrome,
              backgroundImage: 'none',
              color: isLight ? '#1a1d21' : '#e6e8ec',
              borderBottom: `1px solid ${s.border}`,
              boxShadow: 'none',
            },
          },
        },
        MuiToolbar: {
          styleOverrides: {
            root: {
              '@media (min-width: 600px)': { minHeight: 56 },
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: s.chrome,
              backgroundImage: 'none',
              borderRight: `1px solid ${s.border}`,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              '&.Mui-selected': {
                backgroundColor: alpha(accent.main, isLight ? 0.09 : 0.18),
                '&:hover': {
                  backgroundColor: alpha(accent.main, isLight ? 0.13 : 0.24),
                },
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 500,
              fontSize: '0.75rem',
              borderRadius: 4,
              height: 22,
            },
            sizeSmall: { height: 20, fontSize: '0.6875rem' },
            label: { paddingLeft: 8, paddingRight: 8 },
            outlined: { borderColor: s.borderStrong },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              fontSize: '0.8125rem',
              border: `1px solid ${s.border}`,
            },
            standardError: { border: `1px solid ${alpha(status.error.main, 0.35)}` },
            standardWarning: { border: `1px solid ${alpha(status.warning.main, 0.35)}` },
            standardSuccess: { border: `1px solid ${alpha(status.success.main, 0.35)}` },
            standardInfo: { border: `1px solid ${alpha(status.info.main, 0.35)}` },
          },
        },
        MuiLink: {
          defaultProps: {
            // Permanently underlined links turned every table cell into a wall
            // of blue rules.
            underline: 'hover',
          },
          styleOverrides: {
            root: {
              fontWeight: 500,
              textUnderlineOffset: '2px',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              borderRadius: 8,
              border: `1px solid ${s.border}`,
              marginTop: 4,
            },
            list: { paddingTop: 4, paddingBottom: 4 },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: '0.8125rem',
              minHeight: 34,
              borderRadius: 4,
              marginLeft: 4,
              marginRight: 4,
            },
          },
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              borderRadius: 8,
              border: `1px solid ${s.border}`,
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 10,
              border: `1px solid ${s.border}`,
              backgroundImage: 'none',
            },
          },
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: {
              fontSize: '1rem',
              fontWeight: 600,
              padding: '16px 20px',
              borderBottom: `1px solid ${s.border}`,
            },
          },
        },
        MuiDialogContent: {
          styleOverrides: {
            root: { padding: 20 },
          },
        },
        MuiDialogActions: {
          styleOverrides: {
            root: {
              padding: '12px 20px',
              borderTop: `1px solid ${s.border}`,
              gap: 8,
            },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              backgroundColor: isLight ? '#1a1d21' : '#2c313a',
              fontSize: '0.75rem',
              fontWeight: 400,
              padding: '6px 10px',
              borderRadius: 6,
            },
            arrow: { color: isLight ? '#1a1d21' : '#2c313a' },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 6,
              fontSize: '0.8125rem',
              backgroundColor: s.paper,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: s.borderStrong },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isLight ? '#b9c0ca' : 'rgba(255,255,255,0.28)',
              },
            },
            input: { padding: '8px 12px' },
            inputSizeSmall: { padding: '6px 10px' },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: { fontSize: '0.8125rem' },
          },
        },
        MuiCheckbox: {
          styleOverrides: {
            root: { padding: 6, borderRadius: 4 },
          },
        },
        MuiRadio: {
          styleOverrides: {
            root: { padding: 6 },
          },
        },
        MuiSwitch: {
          styleOverrides: {
            root: { padding: 8 },
          },
        },
        MuiFormControlLabel: {
          styleOverrides: {
            label: { fontSize: '0.8125rem' },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: { borderColor: s.border },
          },
        },
        MuiAccordion: {
          defaultProps: { elevation: 0, disableGutters: true },
          styleOverrides: {
            root: {
              border: `1px solid ${s.border}`,
              borderRadius: 8,
              backgroundImage: 'none',
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            },
          },
        },
        MuiAccordionSummary: {
          styleOverrides: {
            root: { minHeight: 44, '&.Mui-expanded': { minHeight: 44 } },
            content: { margin: '10px 0', '&.Mui-expanded': { margin: '10px 0' } },
          },
        },
        MuiLinearProgress: {
          styleOverrides: {
            root: { borderRadius: 3, height: 4 },
          },
        },
        MuiSkeleton: {
          styleOverrides: {
            root: { borderRadius: 4 },
          },
        },
      },
    });
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
