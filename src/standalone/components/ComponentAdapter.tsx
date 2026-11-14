import React, { ReactNode, useState, useEffect, useDeferredValue } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Alert,
  AlertTitle,
  Link as MuiLink,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  ListItemIcon,
  Divider,
  TextField,
  Button,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import HighlightIcon from '@mui/icons-material/Highlight';
import WrapTextIcon from '@mui/icons-material/WrapText';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { Collapse } from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/hljs/markdown';
import { githubGist, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { MONO_FONT } from '../../contexts/ThemeContext';
import { SearchField } from '../../shared/components/SearchField';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useThemeMode } from '../../contexts/ThemeContext';
import { clearResourceNameCache } from '../../utils/resourceNameCache';
import { useDebounce } from '../../hooks/useDebounce';

SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('markdown', markdown);
// hcl/tf: hljs has no built-in HCL grammar; falls back to plain text

export interface PageProps {
  children: ReactNode;
  themeId?: string;
}

export const Page: React.FC<PageProps> = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        backgroundColor: 'background.default',
      }}
    >
      {children}
    </Box>
  );
};

export interface HeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  pageTitleOverride?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, children }) => {
  const location = useLocation();

  // Only show header on module, stack, provider, and deployment detail pages
  const shouldShowHeader =
    location.pathname.includes('/module/') ||
    location.pathname.includes('/stack/') ||
    location.pathname.includes('/provider/') ||
    location.pathname.includes('/deployment/');

  if (!shouldShowHeader) {
    return null;
  }

  return (
    <Box
      sx={{
        pb: 2,
        mb: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 2,
        flexWrap: 'wrap',
        width: '100%',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {subtitle && (
          // Kept as a real heading element under the h1: it carries the
          // resource's type and version, which is the context a screen-reader
          // user needs when landing on a detail page.
          <Typography variant="body2" component="h2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>{children}</Box>
    </Box>
  );
};

export interface HeaderLabelProps {
  label: string;
  value: string;
}

export const HeaderLabel: React.FC<HeaderLabelProps> = ({ label, value }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        alignItems: 'center',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {label}:
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
};

export interface HeaderTabsProps {
  selectedIndex: number;
  onChange: (index: number) => void;
  tabs: Array<{ id: string; label: string }>;
}

export const HeaderTabs: React.FC<HeaderTabsProps> = ({ selectedIndex, onChange, tabs }) => {
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onChange(newValue);
  };

  return (
    <Paper
      sx={{
        backgroundColor: 'background.paper',
        marginBottom: 3,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
      square
      elevation={0}
    >
      <Tabs
        value={selectedIndex}
        onChange={handleChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root:hover': { color: 'text.primary' },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} />
        ))}
      </Tabs>
    </Paper>
  );
};

export interface ContentProps {
  children: ReactNode;
}

export const Content: React.FC<ContentProps> = ({ children }) => {
  return (
    <Container
      maxWidth="xl"
      disableGutters
      sx={{
        flexGrow: 1,
        // The <main> element already supplies the page gutter; adding a second
        // one here is what pushed every list a third of the way down the page.
        px: 0,
      }}
    >
      {children}
    </Container>
  );
};

export interface StandaloneAppBarProps {
  title: string;
}

export const StandaloneAppBar: React.FC<StandaloneAppBarProps> = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [authState, setAuthState] = useState<{ authenticated: boolean; user: any | null }>({
    authenticated: false,
    user: null,
  });
  const { toggleTheme, mode } = useThemeMode();

  useEffect(() => {
    const loadAuthState = async () => {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      setAuthState({
        authenticated: !!token,
        user: user,
      });
    };
    loadAuthState();
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('oauth_state');
    clearResourceNameCache();
    handleMenuClose();
    window.location.href = '/';
  };

  // Determine subtitle based on current route
  const getSubtitle = () => {
    const path = location.pathname;

    if (path.includes('/deployment/')) {
      return 'View Deployment';
    } else if (path.includes('/module/')) {
      return 'Module Details';
    } else if (path.includes('/stack/')) {
      return 'Stack Details';
    } else if (path.includes('/policy/')) {
      return 'Policy Details';
    } else if (path.includes('/deployments')) {
      return 'Manage infrastructure deployments';
    } else if (path.includes('/modules')) {
      return 'Browse available modules';
    } else if (path.includes('/stacks')) {
      return 'Browse available stacks';
    } else if (path.includes('/policies')) {
      return 'Policy evaluations';
    } else if (path.includes('/projects')) {
      return 'Project management';
    }
    return 'Handle infrastructure';
  };

  const subtitle = getSubtitle();

  // Determine if we should show the back button
  const showBackButton =
    location.pathname.includes('/deployment/') ||
    location.pathname.includes('/module/') ||
    location.pathname.includes('/stack/') ||
    location.pathname.includes('/policy/') ||
    location.pathname.includes('/provider/');

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderRadius: 0,
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          {showBackButton && (
            <IconButton
              edge="start"
              size="small"
              onClick={handleBack}
              aria-label="back"
              sx={{ color: 'text.secondary' }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 600, letterSpacing: '-0.01em', fontSize: '0.875rem' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <>
              <Box
                sx={{
                  width: '1px',
                  height: 16,
                  bgcolor: 'divider',
                  display: { xs: 'none', sm: 'block' },
                }}
              />
              <Typography
                variant="body2"
                noWrap
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}
              >
                {subtitle}
              </Typography>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <MuiLink
            href="https://preview.infraweave.io"
            target="_blank"
            rel="noopener noreferrer"
            color="text.secondary"
            underline="hover"
            variant="body2"
            sx={{ mr: 1, fontWeight: 400, '&:hover': { color: 'text.primary' } }}
          >
            infraweave.io
          </MuiLink>

          <IconButton
            onClick={toggleTheme}
            size="small"
            sx={{ color: 'text.secondary' }}
            title="Toggle theme"
          >
            {mode === 'dark' ? (
              <Brightness7Icon fontSize="small" />
            ) : (
              <Brightness4Icon fontSize="small" />
            )}
          </IconButton>

          {authState.user && (
            <>
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                sx={{ color: 'text.secondary' }}
                aria-label="user menu"
              >
                <Avatar
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                  }}
                >
                  <AccountCircleIcon fontSize="small" />
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                  elevation: 3,
                  sx: {
                    mt: 1.5,
                    minWidth: 200,
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {authState.user?.name || authState.user?.email?.split('@')[0] || 'User'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {authState.user?.email || authState.user?.username || 'Authenticated'}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <Typography variant="body2">Logout</Typography>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

// InfoCard - Standalone implementation
export interface InfoCardProps {
  title?: ReactNode;
  subheader?: string;
  children: ReactNode;
  variant?: 'gridItem' | 'fullHeight' | 'flex';
  divider?: boolean;
  deepLink?: {
    link: string;
    title: string;
  };
  cardClassName?: string;
  actionsClassName?: string;
  actions?: ReactNode;
  headerProps?: any;
  cardHeaderProps?: any;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  subheader,
  children,
  actions,
  deepLink,
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(title || subheader || actions) && (
        <CardHeader title={title} subheader={subheader} action={actions} />
      )}
      <CardContent sx={{ flexGrow: 1 }}>{children}</CardContent>
      {deepLink && (
        <Box sx={{ px: 2, pb: 2 }}>
          <MuiLink component={RouterLink} to={deepLink.link} variant="body2">
            {deepLink.title}
          </MuiLink>
        </Box>
      )}
    </Card>
  );
};

// Progress - Standalone implementation
export const Progress: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <CircularProgress />
    </Box>
  );
};

// ResponseErrorPanel - Standalone implementation
export interface ResponseErrorPanelProps {
  error?: Error;
  title?: string;
}

export const ResponseErrorPanel: React.FC<ResponseErrorPanelProps> = ({ error, title }) => {
  return (
    <Alert severity="error">
      {title && <AlertTitle>{title}</AlertTitle>}
      {error?.message || 'An error occurred'}
    </Alert>
  );
};

// Link - Standalone implementation
export interface LinkProps {
  to?: string;
  href?: string;
  children: ReactNode;
  noTrack?: boolean;
  onClick?: () => void;
  target?: string;
  style?: React.CSSProperties;
}

export const Link: React.FC<LinkProps> = ({
  to,
  href,
  children,
  onClick,
  target,
  style,
  ...props
}) => {
  const handleClick = (_event: React.MouseEvent) => {
    if (onClick) {
      onClick();
    }
  };

  if (href) {
    return (
      <MuiLink href={href} target={target} style={style} onClick={handleClick} {...props}>
        {children}
      </MuiLink>
    );
  }

  if (to) {
    return (
      <MuiLink
        component={RouterLink}
        to={to}
        target={target}
        style={style}
        onClick={handleClick}
        {...props}
      >
        {children}
      </MuiLink>
    );
  }
  return (
    <MuiLink onClick={handleClick} style={style} sx={{ cursor: 'pointer' }} {...props}>
      {children}
    </MuiLink>
  );
};

// CodeSnippet - Standalone implementation
export interface CodeSnippetProps {
  text: string;
  language?: string;
  showLineNumbers?: boolean;
  showCopyCodeButton?: boolean;
  customStyle?: any;
}

export const CodeSnippet: React.FC<CodeSnippetProps> = ({
  text,
  language = 'text',
  showLineNumbers = false,
  showCopyCodeButton = false,
}) => {
  const { mode } = useThemeMode();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        '& pre': {
          margin: 0,
          padding: '14px 16px !important',
          fontSize: '0.8125rem !important',
          lineHeight: 1.6,
          fontFamily: `${MONO_FONT} !important`,
          backgroundColor: mode === 'light' ? '#f8f9fa !important' : '#1a1d23 !important',
        },
        '& code': { fontFamily: `${MONO_FONT} !important` },
      }}
    >
      {showCopyCodeButton && (
        <IconButton
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: '4px',
            color: 'text.secondary',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { backgroundColor: 'action.hover' },
            zIndex: 1,
          }}
          size="small"
        >
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      )}
      <SyntaxHighlighter
        language={language}
        // docco rendered dark-on-dark once the surrounding block went dark.
        style={mode === 'light' ? githubGist : atomOneDark}
        showLineNumbers={showLineNumbers}
      >
        {text}
      </SyntaxHighlighter>
    </Box>
  );
};

// StructuredMetadataTable - Standalone implementation
export interface StructuredMetadataTableProps {
  metadata: Record<string, any>;
  dense?: boolean;
}

export const StructuredMetadataTable: React.FC<StructuredMetadataTableProps> = ({
  metadata,
  dense = false,
}) => {
  const isReactElement = (value: any): boolean => {
    return React.isValidElement(value);
  };

  const formatValue = (value: any): ReactNode => {
    if (value === null || value === undefined) {
      return String(value);
    }

    // Check if it's a React element
    if (isReactElement(value)) {
      return value;
    }

    // Check if it's an array of React elements
    if (Array.isArray(value)) {
      const hasReactElements = value.some((v) => isReactElement(v));
      if (hasReactElements) {
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {value.map((v, idx) => (
              <Box key={idx}>{isReactElement(v) ? v : String(v)}</Box>
            ))}
          </Box>
        );
      }
      // Array of primitives
      return value.join(', ');
    }

    // Check if it's a plain object (not a React element)
    if (typeof value === 'object') {
      try {
        return (
          <Box
            component="pre"
            sx={{ m: 0, fontFamily: MONO_FONT, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}
          >
            {JSON.stringify(value, null, 2)}
          </Box>
        );
      } catch (_err) {
        // Handle circular references or other stringify errors
        return '[Complex Object]';
      }
    }

    return String(value);
  };

  return (
    <TableContainer>
      <MuiTable size={dense ? 'small' : 'medium'}>
        <TableBody>
          {Object.entries(metadata).map(([key, value]) => (
            <TableRow key={key}>
              <TableCell
                component="th"
                scope="row"
                sx={{
                  fontWeight: 500,
                  width: 200,
                  verticalAlign: 'top',
                  color: 'text.secondary',
                }}
              >
                {key}
              </TableCell>
              <TableCell>{formatValue(value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
};

// MarkdownContent - Standalone implementation
export interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  const { mode } = useThemeMode();

  return (
    <Box
      sx={{
        fontSize: '0.875rem',
        // Prose gets a bounded measure -- full-width paragraphs across a wide
        // console are unreadable.
        '& p, & ul, & ol, & blockquote': { maxWidth: '76ch' },

        // Basic element styling
        '& h1': {
          fontSize: '1.5rem',
          fontWeight: 600,
          letterSpacing: '-0.018em',
          mt: 3,
          mb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 0.75,
        },
        '& h2': {
          fontSize: '1.25rem',
          fontWeight: 600,
          letterSpacing: '-0.014em',
          mt: 3,
          mb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 0.75,
        },
        '& h3': { fontSize: '1.0625rem', fontWeight: 600, mt: 2.5, mb: 1 },
        '& h4': { fontSize: '0.9375rem', fontWeight: 600, mt: 2, mb: 1 },
        '& h5': { fontSize: '0.875rem', fontWeight: 600, mt: 2, mb: 0.75 },
        '& h6': {
          fontSize: '0.75rem',
          fontWeight: 600,
          mt: 2,
          mb: 0.75,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'text.secondary',
        },

        // Text and lists
        '& p': { mb: 1.5, lineHeight: 1.65 },
        '& ul, & ol': { pl: 3, mb: 1.5 },
        '& ul': { listStyleType: 'disc' },
        '& ol': { listStyleType: 'decimal' },
        '& li': { mb: 0.5 },

        // Links and emphasis
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        },
        '& strong': { fontWeight: 600 },
        '& em': { fontStyle: 'italic' },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'divider',
          pl: 2,
          py: 0.5,
          my: 2,
          color: 'text.secondary',
          bgcolor: 'action.hover',
        },

        // Code blocks
        '& code': {
          fontFamily: MONO_FONT,
          fontSize: '0.8125em',
          bgcolor: 'action.hover',
          px: 0.625,
          py: 0.25,
          borderRadius: 0.75,
        },
        '& pre': {
          bgcolor: mode === 'dark' ? '#1a1d23' : '#f8f9fa',
          fontFamily: MONO_FONT,
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          p: 1.75,
          borderRadius: 1.5,
          overflowX: 'auto',
          my: 2,
          border: '1px solid',
          borderColor: 'divider',
          '& code': {
            bgcolor: 'transparent',
            p: 0,
            fontSize: 'inherit',
          },
        },

        // Tables (GFM)
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          my: 2,
          display: 'block',
          overflowX: 'auto',
        },
        '& th': {
          fontWeight: 600,
          textAlign: 'left',
          p: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
        },
        '& td': {
          p: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
        '& tr:hover': {
          bgcolor: 'action.hover',
        },

        // Images and other media
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
        '& hr': { border: 'none', borderBottom: '1px solid', borderColor: 'divider', my: 3 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm] as any}>{content || ''}</ReactMarkdown>
    </Box>
  );
};

// Table - Standalone implementation
export interface TableColumn<T = any> {
  title: string;
  field?: string;
  render?: (row: T) => ReactNode;
  highlight?: boolean;
  width?: string;
  customSort?: (a: T, b: T) => number;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  title?: string | ReactNode;
  options?: {
    search?: boolean;
    paging?: boolean;
    pageSize?: number;
    pageSizeOptions?: number[];
    emptyRowsWhenPaging?: boolean;
    padding?: 'default' | 'dense';
    draggable?: boolean;
    columnResizable?: boolean;
  };
  emptyContent?: ReactNode;
  detailPanel?: (rowData: T & { tableData?: { id: number } }) => ReactNode;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Props that carry an element's text when it has no children. Only these, so layout props
 * such as `size="small"` or `color="error"` do not match every row.
 */
const TEXT_PROPS = ['label', 'version', 'title', 'value'];

/**
 * Callers often put elements straight into fields, so an element is searched by its text,
 * or failing that by its text props (a version cell's `version`, a chip's `label`).
 */
const searchText = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(searchText).join(' ');
  if (React.isValidElement(value)) {
    const props = (value.props ?? {}) as Record<string, unknown>;
    if (props.children !== undefined) return searchText(props.children);
    return TEXT_PROPS.map((prop) => searchText(props[prop]))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

/** Off screen, but still read by screen readers. */
const VISUALLY_HIDDEN = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;

/** Only columns with a `field` are searched; a `render`-only one has nothing to compare. */
const rowMatches = <T,>(row: T, columns: TableColumn<T>[], query: string): boolean =>
  columns.some(
    (column) =>
      Boolean(column.field) &&
      searchText((row as any)[column.field as string])
        .toLowerCase()
        .includes(query),
  );

export function Table<T = any>({
  columns,
  data,
  title,
  options,
  emptyContent,
  detailPanel,
}: TableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(options?.pageSize ?? DEFAULT_PAGE_SIZE);
  const [query, setQuery] = useState('');

  const searchable = options?.search === true;
  const normalisedQuery = query.trim().toLowerCase();
  // Divider rows have nothing to match, so a search drops them.
  const rows = React.useMemo(
    () =>
      searchable && normalisedQuery
        ? data.filter(
            (row) =>
              (row as any)._divider === undefined && rowMatches(row, columns, normalisedQuery),
          )
        : data,
    [data, columns, searchable, normalisedQuery],
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Row positions change under a new query, so the page and expanded rows no longer apply.
    setPage(0);
    setExpandedRows(new Set());
  };

  const paging = options?.paging === true;
  // Clamped rather than reset, so the reader keeps their page while rows stream in. The clamp
  // is saved, so a page that a filter emptied is not returned to when the filter is cleared.
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  if (page !== currentPage) setPage(currentPage);
  const pageStart = paging ? currentPage * rowsPerPage : 0;
  const visibleRows = paging ? rows.slice(pageStart, pageStart + rowsPerPage) : rows;

  const toggleRow = (rowIndex: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(rowIndex)) {
      newExpandedRows.delete(rowIndex);
    } else {
      newExpandedRows.add(rowIndex);
    }
    setExpandedRows(newExpandedRows);
  };

  if (data.length === 0 && emptyContent) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: '0.8125rem' }}
      >
        {emptyContent}
      </Paper>
    );
  }

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, overflowX: 'auto' }}
    >
      {(title || searchable) && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            {typeof title === 'string' ? <Typography variant="h5">{title}</Typography> : title}
          </Box>
          {searchable && (
            <SearchField
              value={query}
              onChange={handleQueryChange}
              placeholder="Search"
              ariaLabel="Search table"
              sx={{ width: 240 }}
            />
          )}
          {searchable && (
            // Mounted with the search box; a live region added with its text is often not read.
            <Box role="status" sx={VISUALLY_HIDDEN}>
              {normalisedQuery &&
                (rows.length === 0
                  ? `No rows match "${query.trim()}"`
                  : `${rows.length} ${rows.length === 1 ? 'row matches' : 'rows match'}`)}
            </Box>
          )}
        </Box>
      )}
      <MuiTable stickyHeader>
        <TableHead>
          <TableRow>
            {detailPanel && <TableCell sx={{ width: 44, zIndex: 2 }} />}
            {columns.map((column, index) => (
              <TableCell key={index} sx={{ zIndex: 2, width: column.width }}>
                {column.title}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Indices stay absolute, so which row is expanded survives a page change. */}
          {visibleRows.map((row, visibleIndex) => {
            const rowIndex = pageStart + visibleIndex;
            return (
              <React.Fragment key={rowIndex}>
                {(row as any)._divider !== undefined ? (
                  <TableRow sx={{ '& td': { border: 0 } }}>
                    <TableCell
                      colSpan={columns.length + (detailPanel ? 1 : 0)}
                      sx={{ py: 0.25, px: 2 }}
                    >
                      {(row as any)._divider}
                    </TableCell>
                  </TableRow>
                ) : (
                  <React.Fragment>
                    <TableRow
                      hover
                      sx={{ cursor: detailPanel ? 'pointer' : 'default' }}
                      onClick={() => detailPanel && toggleRow(rowIndex)}
                    >
                      {detailPanel && (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(rowIndex);
                            }}
                          >
                            {expandedRows.has(rowIndex) ? (
                              <KeyboardArrowUpIcon />
                            ) : (
                              <KeyboardArrowDownIcon />
                            )}
                          </IconButton>
                        </TableCell>
                      )}
                      {columns.map((column, colIndex) => (
                        <TableCell key={colIndex}>
                          {column.render
                            ? column.render(row)
                            : column.field
                              ? (row as any)[column.field]
                              : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                    {detailPanel && (
                      <TableRow>
                        <TableCell
                          style={{ paddingBottom: 0, paddingTop: 0 }}
                          colSpan={columns.length + 1}
                        >
                          <Collapse in={expandedRows.has(rowIndex)} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 1 }}>
                              {detailPanel({ ...row, tableData: { id: rowIndex } })}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )}
              </React.Fragment>
            );
          })}
          {rows.length === 0 && normalisedQuery && (
            <TableRow>
              <TableCell
                colSpan={columns.length + (detailPanel ? 1 : 0)}
                sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}
              >
                No rows match &quot;{query.trim()}&quot;.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </MuiTable>
      {paging && (
        <TablePagination
          component="div"
          count={rows.length}
          page={currentPage}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={options?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            // The old page means nothing under a new page size.
            setPage(0);
          }}
        />
      )}
    </TableContainer>
  );
}

// CopyTextButton - Simple button to copy text to clipboard
export interface CopyTextButtonProps {
  text: string;
  tooltipText?: string;
}

export const CopyTextButton: React.FC<CopyTextButtonProps> = ({ text }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <MuiLink
      component="button"
      onClick={handleCopy}
      sx={{
        cursor: 'pointer',
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </MuiLink>
  );
};

// Status components using standard MUI icons and colors
export const StatusOK: React.FC = () => (
  <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1.0625rem' }} />
);

export const StatusWarning: React.FC = () => (
  <WarningIcon sx={{ color: 'warning.main', fontSize: '1.0625rem' }} />
);

export const StatusError: React.FC = () => (
  <ErrorIcon sx={{ color: 'error.main', fontSize: '1.0625rem' }} />
);

export const StatusPending: React.FC = () => (
  <PendingIcon sx={{ color: 'warning.main', fontSize: '1.0625rem' }} />
);

export const StatusRunning: React.FC = () => (
  <AutorenewIcon
    sx={{
      color: 'info.main',
      fontSize: '1.25rem',
      animation: 'spin 2s linear infinite',
      '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' },
      },
    }}
  />
);

export const StatusAborted: React.FC = () => (
  <CancelIcon sx={{ color: 'text.disabled', fontSize: '1.0625rem' }} />
);

// SimpleStepper and SimpleStepperStep - Standalone implementation
export interface SimpleStepperProps {
  children: ReactNode;
  onReset?: () => void;
  onComplete?: () => void;
}

export interface SimpleStepperStepProps {
  title: string;
  children: ReactNode;
  end?: boolean;
  actions?: {
    canNext?: boolean | (() => boolean);
    onNext?: () => void;
    nextText?: string;
    showBack?: boolean;
    showNext?: boolean;
  };
}

export const SimpleStepper: React.FC<SimpleStepperProps> = ({ children }) => {
  return <Box>{children}</Box>;
};

export const SimpleStepperStep: React.FC<SimpleStepperStepProps> = ({ title, children }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
};

// LogViewer - Standalone implementation
/** What the viewer has set up, so a link can reopen the logs exactly as they were. */
export interface LogViewerState {
  search: string;
  /** Show only matching lines (true) or highlight matches in place (false). */
  filter: boolean;
  wrap: boolean;
  /** Zero-based index of the current search match. */
  match: number;
  /** One-based number of the selected line. */
  line?: number;
}

export interface LogViewerProps {
  text: string;
  /** Read once, on mount. */
  initialState?: Partial<LogViewerState>;
  onStateChange?: (state: LogViewerState) => void;
}

const MIN_SEARCH_LENGTH = 2;

type LogLineData = {
  number: number;
  text: string;
  /** Start offsets of the search matches in this line. */
  matches?: number[];
  /** Global index of this line's first match. */
  firstMatch: number;
};

// Props are kept primitive (or stable) so only the lines that changed re-render on large logs.
const LogLine = React.memo(function LogLine({
  number,
  text,
  matches,
  firstMatch,
  searchLength,
  activeMatch,
  selected,
  wrap,
  gutterWidth,
  onSelect,
}: LogLineData & {
  searchLength: number;
  /** Index within this line of the current match, or -1. */
  activeMatch: number;
  selected: boolean;
  wrap: boolean;
  gutterWidth: string;
  onSelect: (line: number) => void;
}) {
  let content: React.ReactNode = text;
  if (matches) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((start, i) => {
      const isCurrentMatch = i === activeMatch;
      parts.push(text.substring(last, start));
      parts.push(
        <span
          key={i}
          data-match={firstMatch + i}
          style={{
            // Muted amber rather than pure yellow: legible against the log
            // surface without the highlighter-pen look.
            backgroundColor: isCurrentMatch ? '#f0b429' : 'rgba(240, 180, 41, 0.32)',
            color: isCurrentMatch ? '#1a1d21' : 'inherit',
            borderRadius: '2px',
            fontWeight: isCurrentMatch ? 600 : 'normal',
          }}
        >
          {text.substring(start, start + searchLength)}
        </span>,
      );
      last = start + searchLength;
    });
    parts.push(text.substring(last));
    content = parts;
  }

  return (
    <div
      data-line={number}
      style={{
        display: 'flex',
        backgroundColor: selected ? 'rgba(56, 139, 253, 0.2)' : undefined,
      }}
    >
      <span
        onClick={() => onSelect(number)}
        title={selected ? 'Deselect line' : `Link to line ${number}`}
        style={{
          flex: 'none',
          minWidth: gutterWidth,
          marginRight: '2ch',
          textAlign: 'right',
          color: selected ? '#c9ced6' : '#5c6370',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {number}
      </span>
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          whiteSpace: wrap ? 'pre-wrap' : 'pre',
          wordBreak: wrap ? 'break-word' : 'normal',
        }}
      >
        {content}
      </span>
    </div>
  );
});

type PendingScroll = { line?: number; match?: number; smooth?: boolean };

export const LogViewer: React.FC<LogViewerProps> = ({ text, initialState, onStateChange }) => {
  const { mode } = useThemeMode();
  const [initial] = React.useState(() => initialState ?? {});
  const [searchTerm, setSearchTerm] = React.useState(initial.search ?? '');
  const debouncedTerm = useDebounce(searchTerm, 250);
  const deferredTerm = useDeferredValue(debouncedTerm);
  const isSearching = searchTerm !== deferredTerm;
  const isSearchActive = deferredTerm.length >= MIN_SEARCH_LENGTH;
  const [filterMode, setFilterMode] = React.useState(initial.filter ?? true);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(initial.match ?? 0);
  const [wordWrap, setWordWrap] = React.useState(initial.wrap ?? false);
  const [selectedLine, setSelectedLine] = React.useState(initial.line);
  const paperRef = React.useRef<HTMLDivElement>(null);
  const isAtBottom = React.useRef(true);
  // Where to scroll once it has rendered: the line or match a link points at, or the match
  // just navigated to. A link's target may not have loaded yet, so it waits until it has.
  const pendingScroll = React.useRef<PendingScroll | null>(
    initial.line !== undefined
      ? { line: initial.line }
      : (initial.search?.length ?? 0) >= MIN_SEARCH_LENGTH
        ? { match: initial.match ?? 0 }
        : null,
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Check if we are at the bottom with a small tolerance
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottom.current = atBottom;
  };

  const allLines = React.useMemo(() => {
    const lines = text.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }, [text]);

  const { visibleLines, matchCount } = React.useMemo(() => {
    const lowerSearch = deferredTerm.toLowerCase();
    const visible: LogLineData[] = [];
    let count = 0;

    allLines.forEach((line, i) => {
      const number = i + 1;
      if (!isSearchActive) {
        visible.push({ number, text: line, firstMatch: 0 });
        return;
      }
      const lowerLine = line.toLowerCase();
      const matches: number[] = [];
      let index = lowerLine.indexOf(lowerSearch);
      while (index !== -1) {
        matches.push(index);
        index = lowerLine.indexOf(lowerSearch, index + lowerSearch.length);
      }
      // Filter mode: only show matching lines
      if (filterMode && matches.length === 0) return;
      visible.push({
        number,
        text: line,
        matches: matches.length > 0 ? matches : undefined,
        firstMatch: count,
      });
      count += matches.length;
    });

    return { visibleLines: visible, matchCount: count };
  }, [allLines, deferredTerm, isSearchActive, filterMode]);

  // Reset match index when search term or mode changes, but not on mount, where it may come
  // from a link.
  const searchKey = `${deferredTerm}\u0000${filterMode}`;
  const lastSearchKey = React.useRef(searchKey);
  React.useEffect(() => {
    if (lastSearchKey.current === searchKey) return;
    lastSearchKey.current = searchKey;
    setCurrentMatchIndex(0);
    pendingScroll.current = { match: 0, smooth: true };
  }, [searchKey]);

  // Scroll to bottom when text changes (auto-scroll)
  React.useEffect(() => {
    // Only scroll if we are not searching/filtering, nothing is selected or waiting to be
    // scrolled to, and the user was previously at the bottom
    if (
      paperRef.current &&
      !isSearchActive &&
      selectedLine === undefined &&
      !pendingScroll.current &&
      isAtBottom.current
    ) {
      paperRef.current.scrollTo({
        top: paperRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [text, isSearchActive, selectedLine]);

  // Scroll to the pending line or match once it is on screen.
  React.useEffect(() => {
    const target = pendingScroll.current;
    if (!target || !paperRef.current) return;
    const selector =
      target.line !== undefined ? `[data-line="${target.line}"]` : `[data-match="${target.match}"]`;
    const element = paperRef.current.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: target.smooth ? 'smooth' : 'auto', block: 'center' });
      pendingScroll.current = null;
    } else if (target.line !== undefined ? target.line <= allLines.length : !isSearchActive) {
      // Loaded but hidden by the filter, or no longer searching: nothing to wait for.
      pendingScroll.current = null;
    }
  });

  const onStateChangeRef = React.useRef(onStateChange);
  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const isFirstState = React.useRef(true);
  React.useEffect(() => {
    if (isFirstState.current) {
      isFirstState.current = false;
      return;
    }
    onStateChangeRef.current?.({
      search: debouncedTerm,
      filter: filterMode,
      wrap: wordWrap,
      match: currentMatchIndex,
      line: selectedLine,
    });
  }, [debouncedTerm, filterMode, wordWrap, currentMatchIndex, selectedLine]);

  // Navigating to the match already selected (e.g. the only one) leaves the index unchanged, so
  // React would skip the render the pending scroll waits for.
  const [, requestScroll] = React.useReducer((n: number) => n + 1, 0);

  const goToMatch = (index: number) => {
    pendingScroll.current = { match: index, smooth: true };
    setCurrentMatchIndex(index);
    requestScroll();
  };

  const goToNextMatch = () => {
    if (matchCount > 0) {
      goToMatch((currentMatchIndex + 1) % matchCount);
    }
  };

  const goToPrevMatch = () => {
    if (matchCount > 0) {
      goToMatch((currentMatchIndex - 1 + matchCount) % matchCount);
    }
  };

  const selectLine = React.useCallback(
    (line: number) => setSelectedLine((current) => (current === line ? undefined : line)),
    [],
  );

  const gutterWidth = `${String(allLines.length).length}ch`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 2, px: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flex: '1 1 200px', minWidth: '200px' }}
          InputProps={{
            startAdornment: isSearching ? (
              <CircularProgress size={16} thickness={5} sx={{ mr: 1, color: 'action.active' }} />
            ) : (
              <SearchIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />
            ),
            endAdornment: searchTerm && (
              <IconButton
                size="small"
                onClick={() => setSearchTerm('')}
                edge="end"
                sx={{ mr: -0.5 }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
        {isSearchActive && (
          <>
            <Button
              size="small"
              variant={filterMode ? 'outlined' : 'contained'}
              onClick={() => setFilterMode(!filterMode)}
              startIcon={filterMode ? <FilterListIcon /> : <HighlightIcon />}
              sx={{ minWidth: '120px' }}
            >
              {filterMode ? 'Filter' : 'Highlight'}
            </Button>

            {matchCount > 0 && (
              <>
                <Chip
                  label={`${Math.min(currentMatchIndex + 1, matchCount)} / ${matchCount}`}
                  size="small"
                  color="secondary"
                />
                <IconButton
                  size="small"
                  onClick={goToPrevMatch}
                  title="Previous match (Shift+Enter)"
                  color="primary"
                >
                  <NavigateBeforeIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={goToNextMatch}
                  title="Next match (Enter)"
                  color="primary"
                >
                  <NavigateNextIcon />
                </IconButton>
              </>
            )}
          </>
        )}
        <IconButton
          size="small"
          onClick={() => setWordWrap(!wordWrap)}
          title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
          color={wordWrap ? 'primary' : 'default'}
        >
          <WrapTextIcon />
        </IconButton>
      </Box>
      {deferredTerm.length === 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, mt: -1 }}>
          Please search for two or more characters...
        </Typography>
      )}
      <Paper
        ref={paperRef}
        onScroll={handleScroll}
        elevation={0}
        sx={{
          p: 2,
          // Logs stay on a dark surface in both themes -- that is the terminal
          // convention operators expect -- but a softer graphite than pure black.
          backgroundColor: mode === 'light' ? '#1a1d23' : '#0b0d10',
          color: '#c9ced6',
          fontFamily: MONO_FONT,
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          borderRadius: 2,
          overflow: 'auto',
          flexGrow: 1,
          border: '1px solid',
          borderColor: mode === 'light' ? 'transparent' : 'divider',
        }}
      >
        {!text || text.trim() === '' ? (
          <Typography
            variant="body2"
            sx={{
              color: '#666',
              fontStyle: 'italic',
              textAlign: 'center',
              mt: 4,
            }}
          >
            No logs available. If you recently started a job it will be available soon.
          </Typography>
        ) : (
          <div style={{ width: wordWrap ? '100%' : 'max-content', minWidth: '100%' }}>
            {visibleLines.map((line) => {
              const activeMatch =
                line.matches &&
                currentMatchIndex >= line.firstMatch &&
                currentMatchIndex < line.firstMatch + line.matches.length
                  ? currentMatchIndex - line.firstMatch
                  : -1;
              return (
                <LogLine
                  key={line.number}
                  {...line}
                  searchLength={deferredTerm.length}
                  activeMatch={activeMatch}
                  selected={line.number === selectedLine}
                  wrap={wordWrap}
                  gutterWidth={gutterWidth}
                  onSelect={selectLine}
                />
              );
            })}
          </div>
        )}
      </Paper>
    </Box>
  );
};

export const DependencyGraph = () => null;
export const DependencyGraphTypes = {
  Direction: {
    TOP_BOTTOM: 'TOP_BOTTOM',
    BOTTOM_TOP: 'BOTTOM_TOP',
    LEFT_RIGHT: 'LEFT_RIGHT',
    RIGHT_LEFT: 'RIGHT_LEFT',
  },
};
