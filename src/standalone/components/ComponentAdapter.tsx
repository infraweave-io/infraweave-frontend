import React, { ReactNode, useState, useEffect } from 'react';
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
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useThemeMode } from '../../contexts/ThemeContext';

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
        padding: 2,
        paddingBottom: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="subtitle1" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box>{children}</Box>
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
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.9375rem',
            '&:hover': {
              color: 'primary.main',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
          },
          '& .Mui-selected': {
            fontWeight: 600,
          },
          '& .MuiTabs-indicator': {
            height: 3,
          },
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
      sx={{
        flexGrow: 1,
        padding: 3,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {showBackButton && (
            <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="back">
              <ArrowBackIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <MuiLink
            href="https://preview.infraweave.io"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            underline="hover"
            sx={{
              opacity: 0.9,
              '&:hover': {
                opacity: 1,
              },
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              infraweave.io
            </Typography>
          </MuiLink>

          <IconButton onClick={toggleTheme} color="inherit" sx={{ ml: 1 }} title="Toggle theme">
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          {authState.user && (
            <>
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                sx={{ color: 'inherit' }}
                aria-label="user menu"
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                  }}
                >
                  <AccountCircleIcon />
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
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: 'none',
        transition: 'border-color 0.2s ease',
        '&:hover': {
          borderColor: 'primary.light',
        },
      }}
    >
      {(title || subheader || actions) && (
        <CardHeader
          title={title}
          subheader={subheader}
          action={actions}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 3,
            py: 2,
            '& .MuiCardHeader-title': {
              fontWeight: 600,
              fontSize: '1rem',
              color: 'text.primary',
            },
            '& .MuiCardHeader-subheader': {
              fontSize: '0.875rem',
              color: 'text.secondary',
            },
          }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, p: 3 }}>{children}</CardContent>
      {deepLink && (
        <Box sx={{ p: 2, pt: 0 }}>
          <MuiLink component={RouterLink} to={deepLink.link}>
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
        fontSize: '0.875rem',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        '& pre': {
          margin: 0,
          padding: '16px !important',
          backgroundColor: mode === 'light' ? '#f8f9fa !important' : '#1e1e1e !important',
        },
      }}
    >
      {showCopyCodeButton && (
        <IconButton
          onClick={handleCopy}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px',
            backgroundColor: 'background.paper',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
            zIndex: 1,
          }}
          size="small"
        >
          {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      )}
      <SyntaxHighlighter language={language} style={docco} showLineNumbers={showLineNumbers}>
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
        return JSON.stringify(value, null, 2);
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
            <TableRow
              key={key}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
                '&:last-child td': {
                  borderBottom: 0,
                },
              }}
            >
              <TableCell
                component="th"
                scope="row"
                sx={{
                  fontWeight: 600,
                  width: '30%',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                }}
              >
                {key}
              </TableCell>
              <TableCell sx={{ fontSize: '0.875rem' }}>{formatValue(value)}</TableCell>
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
        // Basic element styling
        '& h1': {
          fontSize: '2rem',
          fontWeight: 600,
          mt: 3,
          mb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 0.5,
        },
        '& h2': {
          fontSize: '1.75rem',
          fontWeight: 600,
          mt: 3,
          mb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 0.5,
        },
        '& h3': { fontSize: '1.5rem', fontWeight: 600, mt: 2.5, mb: 1.5 },
        '& h4': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
        '& h5': { fontSize: '1rem', fontWeight: 600, mt: 2, mb: 1 },
        '& h6': {
          fontSize: '0.875rem',
          fontWeight: 600,
          mt: 2,
          mb: 1,
          textTransform: 'uppercase',
          color: 'text.secondary',
        },

        // Text and lists
        '& p': { mb: 2, lineHeight: 1.6 },
        '& ul, & ol': { pl: 4, mb: 2 },
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
          fontFamily: 'monospace',
          fontSize: '0.875em',
          bgcolor: 'action.hover',
          p: 0.5,
          borderRadius: 1,
        },
        '& pre': {
          bgcolor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
          p: 2,
          borderRadius: 1,
          overflowX: 'auto',
          my: 2,
          border: '1px solid',
          borderColor: 'divider',
          '& code': {
            bgcolor: 'transparent',
            p: 0,
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
    emptyRowsWhenPaging?: boolean;
    padding?: 'default' | 'dense';
    draggable?: boolean;
    columnResizable?: boolean;
  };
  emptyContent?: ReactNode;
  detailPanel?: (rowData: T & { tableData?: { id: number } }) => ReactNode;
}

export function Table<T = any>({ columns, data, title, emptyContent, detailPanel }: TableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
    return <Box sx={{ p: 2 }}>{emptyContent}</Box>;
  }

  return (
    <TableContainer component={Paper}>
      {title && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          {typeof title === 'string' ? <Typography variant="h6">{title}</Typography> : title}
        </Box>
      )}
      <MuiTable stickyHeader>
        <TableHead>
          <TableRow>
            {detailPanel && (
              <TableCell sx={{ width: 50, backgroundColor: 'background.paper', zIndex: 2 }} />
            )}
            {columns.map((column, index) => (
              <TableCell
                key={index}
                sx={{ fontWeight: 'bold', backgroundColor: 'background.paper', zIndex: 2 }}
              >
                {column.title}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, rowIndex) => (
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
          ))}
        </TableBody>
      </MuiTable>
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
  <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1.25rem' }} />
);

export const StatusWarning: React.FC = () => (
  <WarningIcon sx={{ color: 'warning.main', fontSize: '1.25rem' }} />
);

export const StatusError: React.FC = () => (
  <ErrorIcon sx={{ color: 'error.main', fontSize: '1.25rem' }} />
);

export const StatusPending: React.FC = () => (
  <PendingIcon sx={{ color: 'warning.main', fontSize: '1.25rem' }} />
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
  <CancelIcon sx={{ color: 'text.disabled', fontSize: '1.25rem' }} />
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
export interface LogViewerProps {
  text: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ text }) => {
  const { mode } = useThemeMode();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterMode, setFilterMode] = React.useState(true);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [wordWrap, setWordWrap] = React.useState(false);
  const matchRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const paperRef = React.useRef<HTMLDivElement>(null);
  const isAtBottom = React.useRef(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Check if we are at the bottom with a small tolerance
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAtBottom.current = atBottom;
  };

  const { displayText, matchCount } = React.useMemo(() => {
    if (!searchTerm) return { displayText: text, matchCount: 0 };

    const lines = text.split('\n');

    if (filterMode) {
      // Filter mode: only show matching lines with highlights
      let count = 0;
      const filtered = lines
        .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .map((line) => {
          const lowerLine = line.toLowerCase();
          const lowerSearch = searchTerm.toLowerCase();

          let result = '';
          let lastIndex = 0;
          let index = lowerLine.indexOf(lowerSearch);

          while (index !== -1) {
            result += line.substring(lastIndex, index);
            result += `__HIGHLIGHT_START_${count}__${line.substring(
              index,
              index + searchTerm.length,
            )}__HIGHLIGHT_END__`;
            count++;
            lastIndex = index + searchTerm.length;
            index = lowerLine.indexOf(lowerSearch, lastIndex);
          }
          result += line.substring(lastIndex);
          return result;
        });

      return { displayText: filtered.join('\n'), matchCount: count };
    }
    // Highlight mode: show all lines with matches highlighted
    let count = 0;
    const highlighted = lines.map((line) => {
      const lowerLine = line.toLowerCase();
      const lowerSearch = searchTerm.toLowerCase();

      if (lowerLine.includes(lowerSearch)) {
        let result = '';
        let lastIndex = 0;
        let index = lowerLine.indexOf(lowerSearch);

        while (index !== -1) {
          result += line.substring(lastIndex, index);
          result += `__HIGHLIGHT_START_${count}__${line.substring(
            index,
            index + searchTerm.length,
          )}__HIGHLIGHT_END__`;
          count++;
          lastIndex = index + searchTerm.length;
          index = lowerLine.indexOf(lowerSearch, lastIndex);
        }
        result += line.substring(lastIndex);
        return result;
      }
      return line;
    });

    return { displayText: highlighted.join('\n'), matchCount: count };
  }, [text, searchTerm, filterMode]);

  // Reset match index when search term or mode changes
  React.useEffect(() => {
    setCurrentMatchIndex(0);
    matchRefs.current = [];
  }, [searchTerm, filterMode]);

  // Scroll to current match
  React.useEffect(() => {
    if (matchCount > 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex, filterMode, matchCount]);

  // Scroll to bottom when text changes (auto-scroll)
  React.useEffect(() => {
    // Only scroll if we are not searching/filtering
    // And if the user was previously at the bottom
    if (paperRef.current && !searchTerm && isAtBottom.current) {
      paperRef.current.scrollTo({
        top: paperRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [text, displayText, searchTerm]);

  const goToNextMatch = () => {
    if (matchCount > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
    }
  };

  const goToPrevMatch = () => {
    if (matchCount > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!searchTerm) return text;

    const parts = text.split(/(__HIGHLIGHT_START_\d+__|__HIGHLIGHT_END__)/);

    return parts.map((part, index) => {
      const highlightMatch = part.match(/__HIGHLIGHT_START_(\d+)__/);
      if (highlightMatch) {
        const _globalMatchIndex = parseInt(highlightMatch[1], 10);
        return null; // Skip the marker
      } else if (part === '__HIGHLIGHT_END__') {
        return null; // Skip the marker
      } else if (index > 0 && parts[index - 1]?.startsWith('__HIGHLIGHT_START_')) {
        const markerMatch = parts[index - 1].match(/__HIGHLIGHT_START_(\d+)__/);
        const globalMatchIndex = markerMatch ? parseInt(markerMatch[1], 10) : -1;
        const isCurrentMatch = globalMatchIndex === currentMatchIndex;

        return (
          <span
            key={index}
            ref={(el) => {
              if (globalMatchIndex >= 0) {
                matchRefs.current[globalMatchIndex] = el;
              }
            }}
            style={{
              backgroundColor: isCurrentMatch ? '#ffa500' : '#ffff00',
              color: '#000',
              fontWeight: isCurrentMatch ? 'bold' : 'normal',
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

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
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} fontSize="small" />,
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
        {searchTerm && (
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
                  label={`${currentMatchIndex + 1} / ${matchCount}`}
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
      <Paper
        ref={paperRef}
        onScroll={handleScroll}
        sx={{
          p: 2,
          backgroundColor: mode === 'light' ? '#1e1e1e' : '#000000',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          overflow: 'auto',
          flexGrow: 1,
          border: mode === 'dark' ? '1px solid #333' : 'none',
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
          <pre
            style={{
              margin: 0,
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              wordBreak: wordWrap ? 'break-word' : 'normal',
              overflowX: wordWrap ? 'visible' : 'auto',
            }}
          >
            {searchTerm ? renderHighlightedText(displayText) : displayText || text}
          </pre>
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
