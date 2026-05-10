import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  CssBaseline,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Toolbar,
  CircularProgress,
  Typography,
  useTheme,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DeploymentIcon from '@mui/icons-material/Rocket';
import StackIcon from '@mui/icons-material/Layers';
import ModuleIcon from '@mui/icons-material/Extension';
import PolicyIcon from '@mui/icons-material/Policy';
import ProjectIcon from '@mui/icons-material/Folder';
import ProviderIcon from '@mui/icons-material/Cloud';
import InsightsIcon from '@mui/icons-material/Insights';
import { ConfigProvider } from '../contexts/ConfigContext';
import { useConfig } from '../hooks/useConfig';
import { ThemeProviderWrapper } from '../contexts/ThemeContext';
import { Env } from '../utils/env';
import { StandaloneAppBar } from './components/ComponentAdapter';
import { PageTransition } from './components/PageTransition';
import { AiAssistantOverlay } from '../shared/components/AiAssistantOverlay';

// Lazy-loaded route components for code splitting
const LoginPage = React.lazy(() =>
  import('../features/auth/login/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const OAuthCallback = React.lazy(() =>
  import('../features/auth/oauth-callback/OAuthCallback').then((m) => ({
    default: m.OAuthCallback,
  })),
);
const TerraformFlow = React.lazy(() =>
  import('../features/graph/TofuGraph/TerraformFlow').then((m) => ({ default: m.TerraformFlow })),
);
const RootPage = React.lazy(() =>
  import('../features/root/RootPage/RootPage').then((m) => ({ default: m.RootPage })),
);
const DeploymentPage = React.lazy(() =>
  import('../features/deployments/detail/DeploymentPage').then((m) => ({
    default: m.DeploymentPage,
  })),
);
const ModulePage = React.lazy(() =>
  import('../features/modules/detail/ModulePage').then((m) => ({ default: m.ModulePage })),
);
const StackPage = React.lazy(() =>
  import('../features/stacks/detail/StackPage').then((m) => ({ default: m.StackPage })),
);
const PolicyPage = React.lazy(() =>
  import('../features/policies/detail/PolicyPage').then((m) => ({ default: m.PolicyPage })),
);
const ProviderPage = React.lazy(() =>
  import('../features/providers/detail/ProviderPage').then((m) => ({ default: m.ProviderPage })),
);
import { SelectedProvidersProvider } from '../features/root/RootPage/SelectedProvidersContext';
import { SelectedProjectsProvider } from '../features/root/RootPage/SelectedProjectsContext';

const drawerWidth = 232;

const mainNavItems = [
  { label: 'Overview', path: '/infraweave/overview', icon: <HomeIcon /> },
  { label: 'Deployments', path: '/infraweave/deployments', icon: <DeploymentIcon /> },
  { label: 'Stacks', path: '/infraweave/stacks', icon: <StackIcon /> },
  { label: 'Modules', path: '/infraweave/modules', icon: <ModuleIcon /> },
  { label: 'Providers', path: '/infraweave/providers', icon: <ProviderIcon /> },
  { label: 'Policies', path: '/infraweave/policies', icon: <PolicyIcon /> },
  { label: 'Projects', path: '/infraweave/projects', icon: <ProjectIcon /> },
];

const analyticsNavItems = [
  { label: 'Observability', path: '/infraweave/observability', icon: <InsightsIcon /> },
];

const NavigationDrawer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const isSelected = (path: string) => location.pathname.startsWith(path);

  const navItemSx = (selected: boolean) => ({
    borderRadius: 1.5,
    mx: 0.5,
    mb: 0.25,
    minHeight: 38,
    px: 1.5,
    '&.Mui-selected': {
      color: theme.palette.primary.main,
      '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
    },
    '& .MuiListItemIcon-root': {
      color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
    },
  });

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', flex: 1, pt: 1 }}>
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.7rem',
            }}
          >
            Infrastructure
          </Typography>
        </Box>
        <List disablePadding sx={{ px: 0.5 }}>
          {mainNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => navigate(item.path)}
                sx={navItemSx(isSelected(item.path))}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  {React.cloneElement(item.icon, { sx: { fontSize: '1.1rem' } })}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected(item.path) ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 1.5, mx: 2 }} />

        <Box sx={{ px: 2, pb: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: '0.7rem',
            }}
          >
            Analytics
          </Typography>
        </Box>
        <List disablePadding sx={{ px: 0.5 }}>
          {analyticsNavItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => navigate(item.path)}
                sx={navItemSx(isSelected(item.path))}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  {React.cloneElement(item.icon, { sx: { fontSize: '1.1rem' } })}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected(item.path) ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const GraphWrapper = () => {
  const config = useConfig();
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <TerraformFlow fetcher={config.fetch} />
    </div>
  );
};

export interface StandaloneAppProps {
  /**
   * Backend base URL for API calls
   * Defaults to REACT_APP_BACKEND_URL env var or http://localhost:7007
   */
  backendBaseUrl?: string;

  /**
   * Optional app title
   */
  title?: string;
}

/**
 * Standalone InfraWeave Application
 *
 * This component provides a standalone version of the InfraWeave plugin
 * that can run outside of Backstage.
 */
export const StandaloneApp: React.FC<StandaloneAppProps> = ({
  backendBaseUrl,
  title = 'InfraWeave',
}) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Set the standalone mode flag and check authentication
  useEffect(() => {
    (window as any).__INFRAWEAVE_STANDALONE__ = true;

    const checkAuth = async () => {
      // Check if authentication is disabled via environment variable
      const isAuthDisabled = Env.AUTH_DISABLED;

      if (isAuthDisabled) {
        // ensure a dummy token exists so downstream code doesn't crash if it just checks for existence
        if (!localStorage.getItem('auth_token')) {
          localStorage.setItem('auth_token', 'disabled_auth_dummy_token');
        }
        setAuthenticated(true);
        setCheckingAuth(false);
        return;
      }

      const token = localStorage.getItem('auth_token');
      setAuthenticated(!!token);
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setAuthenticated(true);
  };

  if (checkingAuth) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Always render Router so callback route is accessible before auth
  return (
    <ThemeProviderWrapper>
      <CssBaseline />
      <Router>
        <React.Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <Routes>
            {/* OAuth callback routes - MUST be before authentication check */}
            <Route path="/callback" element={<OAuthCallback />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Login route if not authenticated */}
            {!authenticated ? (
              <Route path="*" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
            ) : (
              <>
                {/* Standalone Graph Route (No Layout) */}
                <Route
                  path="/graph"
                  element={
                    <ConfigProvider isStandalone backendBaseUrl={backendBaseUrl}>
                      <GraphWrapper />
                    </ConfigProvider>
                  }
                />
                {/* All other routes require authentication and layout */}
                <Route
                  path="*"
                  element={
                    <ConfigProvider isStandalone backendBaseUrl={backendBaseUrl}>
                      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
                        <CssBaseline />
                        <StandaloneAppBar title={title} />
                        <NavigationDrawer />
                        <Box
                          component="main"
                          sx={{
                            flexGrow: 1,
                            p: 3,
                            width: { md: `calc(100% - ${drawerWidth}px)` },
                            mt: 8,
                            overflowY: 'auto',
                            height: 'calc(100vh - 64px)',
                          }}
                        >
                          <SelectedProvidersProvider>
                            <SelectedProjectsProvider>
                              <ScrollToTop />
                              <PageTransition>
                                <Routes>
                                  {/* Main tabs handled by RootPage */}
                                  <Route path="/infraweave/:tab" element={<RootPage />} />
                                  <Route
                                    path="/infraweave/observability/:view"
                                    element={<RootPage />}
                                  />

                                  {/* Deployment detail route - with optional tab */}
                                  <Route
                                    path="/infraweave/deployment/:project/:region/:environment/:deploymentId/:tab"
                                    element={<DeploymentPage />}
                                  />
                                  <Route
                                    path="/infraweave/deployment/:project/:region/:environment/:deploymentId"
                                    element={<DeploymentPage />}
                                  />

                                  {/* Module detail route - includes track parameter */}
                                  <Route
                                    path="/infraweave/module/:track/:moduleName/:moduleVersion"
                                    element={<ModulePage />}
                                  />

                                  {/* Stack detail route - includes track parameter */}
                                  <Route
                                    path="/infraweave/stack/:track/:stackName/:stackVersion"
                                    element={<StackPage />}
                                  />

                                  {/* Policy detail route - includes environment parameter */}
                                  <Route
                                    path="/infraweave/policy/:environment/:policyName/:policyVersion"
                                    element={<PolicyPage />}
                                  />

                                  {/* Provider detail route - includes track parameter */}
                                  <Route
                                    path="/infraweave/provider/:track/:providerName/:providerVersion"
                                    element={<ProviderPage />}
                                  />

                                  {/* Default redirect */}
                                  <Route
                                    path="/"
                                    element={<Navigate to="/infraweave/overview" replace />}
                                  />
                                  <Route
                                    path="*"
                                    element={<Navigate to="/infraweave/overview" replace />}
                                  />
                                </Routes>
                              </PageTransition>
                              <AiAssistantOverlay />
                            </SelectedProjectsProvider>
                          </SelectedProvidersProvider>
                        </Box>
                      </Box>
                    </ConfigProvider>
                  }
                />
              </>
            )}
          </Routes>
        </React.Suspense>
      </Router>
    </ThemeProviderWrapper>
  );
};

export default StandaloneApp;
