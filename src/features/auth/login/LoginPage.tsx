import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Card, CardContent, Typography, Alert, Stack } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import LockIcon from '@mui/icons-material/Lock';
import LoginIcon from '@mui/icons-material/Login';
import {
  buildAuthorizeUrl,
  clearFlowState,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getProviders,
  saveFlowState,
  type OAuthProvider,
} from '../../../utils/oauth';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const providerIcon = (icon?: string): React.ReactNode => {
  switch (icon) {
    case 'cloud':
      return <CloudIcon />;
    case 'lock':
      return <LockIcon />;
    default:
      return <LoginIcon />;
  }
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [error, setError] = useState<string | null>(null);

  const providers = useMemo(() => getProviders(), []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) onLoginSuccess();
  }, [onLoginSuccess]);

  const handleLogin = async (provider: OAuthProvider) => {
    try {
      const redirectUri = `${window.location.origin}/callback`;
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      clearFlowState();
      saveFlowState({ providerId: provider.id, state, codeVerifier, redirectUri });

      window.location.href = buildAuthorizeUrl(provider, redirectUri, state, codeChallenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        // Plain neutral canvas. A decorative gradient is the wrong first
        // impression for a tool that controls production infrastructure.
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 380 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h3" component="h1">
            InfraWeave
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Infrastructure management platform
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Sign in to continue
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {providers.length === 0 ? (
              <Alert severity="warning">
                No authentication providers configured. Set <code>REACT_APP_OAUTH_PROVIDERS</code>{' '}
                (JSON array) to enable login. See AUTH_SETUP.md for examples.
              </Alert>
            ) : (
              <Stack spacing={1}>
                {providers.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => handleLogin(provider)}
                    startIcon={providerIcon(provider.icon)}
                  >
                    Sign in with {provider.displayName}
                  </Button>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LoginPage;
