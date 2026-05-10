import React, { useState, useEffect, useMemo } from 'react';
import { Box, Button, Card, CardContent, Typography, Alert, Paper, Stack } from '@mui/material';
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card sx={{ maxWidth: 600, width: '100%', m: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            InfraWeave
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
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
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'grey.300' }}>
              <Stack spacing={1.5}>
                {providers.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => handleLogin(provider)}
                    startIcon={providerIcon(provider.icon)}
                    sx={{
                      justifyContent: 'flex-start',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                      },
                    }}
                  >
                    Sign in with {provider.displayName}
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
