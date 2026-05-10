/**
 * Standalone Entry Point
 *
 * This file is the entry point when running InfraWeave as a standalone application.
 * It mounts the StandaloneApp component to the DOM.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { StandaloneApp } from './StandaloneApp';

// Set standalone flag for components to detect environment
(window as any).__INFRAWEAVE_STANDALONE__ = true;

// Enable mock service worker only when REACT_APP_USE_MOCKS is 'true'.
const USE_MOCKS = import.meta.env.REACT_APP_USE_MOCKS === 'true';

console.log('MSW Configuration:', {
  REACT_APP_USE_MOCKS: import.meta.env.REACT_APP_USE_MOCKS,
  MODE: import.meta.env.MODE,
  USE_MOCKS,
});

async function enableMocking() {
  // Clear cached project/region data when switching between mock and real modes
  // so IDs from one mode don't leak into the other (mock IDs hitting the real API
  // return 403; real IDs against MSW won't match any mock).
  const currentMode = USE_MOCKS ? 'mock' : 'real';
  const lastMode = localStorage.getItem('__app_mode__');
  if (lastMode !== currentMode) {
    localStorage.removeItem('cachedProjects');
    localStorage.removeItem('selectedProjectNames');
    localStorage.removeItem('selectedRegions');
    localStorage.setItem('__app_mode__', currentMode);
  }

  if (!USE_MOCKS) {
    // Unregister any existing service workers when mocking is disabled
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active?.scriptURL.includes('mockServiceWorker')) {
          console.log('Unregistering MSW service worker');
          await registration.unregister();
        }
      }
    }
    return undefined;
  }

  const { worker } = await import('../mocks/browser');

  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

// Get configuration from environment variables or window object
const backendBaseUrl =
  (window as any).INFRAWEAVE_BACKEND_URL ||
  import.meta.env.REACT_APP_API_URL ||
  'http://localhost:8080';

console.log('Backend URL Configuration:', {
  REACT_APP_API_URL: import.meta.env.REACT_APP_API_URL,
  backendBaseUrl,
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

enableMocking().then(() => {
  root.render(
    <React.StrictMode>
      <StandaloneApp backendBaseUrl={backendBaseUrl} />
    </React.StrictMode>,
  );
});
