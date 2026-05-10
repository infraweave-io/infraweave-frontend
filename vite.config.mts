/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  console.log('[Vite Config] Initializing config...');
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.REACT_APP_API_URL || 'http://localhost:8080';
  console.log(`[Vite Config] Backend URL: ${backendUrl}`);

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'REACT_APP_'],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'build',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@monaco-editor') || id.includes('/monaco-editor/')) return 'vendor-monaco';
            if (id.includes('@xyflow') || id.includes('elkjs')) return 'vendor-xyflow';
            if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror') || id.includes('@uiw/codemirror')) return 'vendor-codemirror';
            if (id.includes('@mui/x-charts')) return 'vendor-charts';
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
            if (id.includes('react-syntax-highlighter') || id.includes('highlight.js') || id.includes('refractor') || id.includes('prismjs')) return 'vendor-syntax';
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('micromark') || id.includes('mdast') || id.includes('unified') || id.includes('hast')) return 'vendor-markdown';
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
    server: {
      port: 3000,
      open: true,
      proxy: env.REACT_APP_USE_MOCKS === 'true' ? {} : {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Forward X-Trace-Id header from API Gateway to the browser
              const traceId = proxyRes.headers['x-trace-id'] || proxyRes.headers['X-Trace-Id'];
              if (traceId) {
                res.setHeader('X-Trace-Id', traceId);
                // Expose the header to the browser via CORS
                const existingExpose = res.getHeader('Access-Control-Expose-Headers');
                const exposeHeaders = existingExpose
                  ? `${existingExpose}, X-Trace-Id`
                  : 'X-Trace-Id';
                res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
              }
            });
          },
        },
        '/chat': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Forward X-Trace-Id header from API Gateway to the browser
              const traceId = proxyRes.headers['x-trace-id'] || proxyRes.headers['X-Trace-Id'];
              if (traceId) {
                res.setHeader('X-Trace-Id', traceId);
                // Expose the header to the browser via CORS
                const existingExpose = res.getHeader('Access-Control-Expose-Headers');
                const exposeHeaders = existingExpose
                  ? `${existingExpose}, X-Trace-Id`
                  : 'X-Trace-Id';
                res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
              }
            });
          },
        },
      },
    },
    preview: {
      port: 3000,
      open: true,
      proxy: env.REACT_APP_USE_MOCKS === 'true' ? {} : {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Forward X-Trace-Id header from API Gateway to the browser
              const traceId = proxyRes.headers['x-trace-id'] || proxyRes.headers['X-Trace-Id'];
              if (traceId) {
                res.setHeader('X-Trace-Id', traceId);
                // Expose the header to the browser via CORS
                const existingExpose = res.getHeader('Access-Control-Expose-Headers');
                const exposeHeaders = existingExpose
                  ? `${existingExpose}, X-Trace-Id`
                  : 'X-Trace-Id';
                res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
              }
            });
          },
        },
        '/chat': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Forward X-Trace-Id header from API Gateway to the browser
              const traceId = proxyRes.headers['x-trace-id'] || proxyRes.headers['X-Trace-Id'];
              if (traceId) {
                res.setHeader('X-Trace-Id', traceId);
                // Expose the header to the browser via CORS
                const existingExpose = res.getHeader('Access-Control-Expose-Headers');
                const exposeHeaders = existingExpose
                  ? `${existingExpose}, X-Trace-Id`
                  : 'X-Trace-Id';
                res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
              }
            });
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': {
        NODE_ENV: process.env.NODE_ENV,
        MOCK_REQUESTS: env.MOCK_REQUESTS,
        REACT_APP_API_URL: env.REACT_APP_API_URL,
        REACT_APP_OAUTH_PROVIDERS: env.REACT_APP_OAUTH_PROVIDERS,
        REACT_APP_USE_MOCKS: env.REACT_APP_USE_MOCKS,
        REACT_APP_AUTH_DISABLED: env.REACT_APP_AUTH_DISABLED,
      },
    },
  };
});
