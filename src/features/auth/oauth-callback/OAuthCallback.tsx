import React, { useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  clearFlowState,
  exchangeCodeForTokens,
  extractUserInfo,
  getProvider,
  loadFlowState,
} from '../../../utils/oauth';

// Prevents duplicate token exchanges across StrictMode double-invocation or
// rapid remounts — the authorization code is single-use.
let isExchanging = false;

export const OAuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [_processing, setProcessing] = useState(true);
  const navigate = useNavigate();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (hasAttemptedRef.current || isExchanging) return;

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const oauthError = params.get('error');

        if (oauthError) {
          throw new Error(`Provider returned error: ${oauthError}`);
        }
        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        const processedCode = sessionStorage.getItem('oauth_processed_code');
        if (processedCode === code) {
          window.location.href = '/';
          return;
        }

        hasAttemptedRef.current = true;
        isExchanging = true;

        const flow = loadFlowState();
        if (!flow) {
          throw new Error(
            'No pending OAuth flow found. This usually means the session expired — please log in again.',
          );
        }
        if (flow.state !== state) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        const provider = getProvider(flow.providerId);
        if (!provider) {
          throw new Error(
            `Unknown OAuth provider "${flow.providerId}". Check REACT_APP_OAUTH_PROVIDERS.`,
          );
        }

        const tokens = await exchangeCodeForTokens(
          provider,
          code,
          flow.redirectUri,
          flow.codeVerifier,
        );

        if (!tokens.id_token) {
          throw new Error('Provider did not return an id_token — is "openid" in the scope list?');
        }

        const user = extractUserInfo(tokens.id_token, provider);

        localStorage.setItem('auth_token', tokens.id_token);
        if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
        if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('user', JSON.stringify(user));

        sessionStorage.setItem('oauth_processed_code', code);
        clearFlowState();

        window.location.href = '/';
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setProcessing(false);
      } finally {
        isExchanging = false;
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Failed
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')}>
            Return to Login
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" sx={{ mt: 3 }}>
        Completing authentication...
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Please wait while we finish logging you in
      </Typography>
    </Box>
  );
};
