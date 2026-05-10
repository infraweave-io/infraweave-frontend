/**
 * Environment configuration utility
 * Supports runtime configuration via window._env_ (injected by Docker)
 * Fallback to build-time process.env variables
 */

// Define global interface for window with _env_ property
declare global {
  interface Window {
    _env_?: Record<string, string>;
  }
}

/**
 * Get environment variable with runtime fallback
 * @param key The name of the environment variable
 * @param defaultValue Optional default value if not found
 * @returns The value of the environment variable or default value
 */
export const getEnv = (key: string, defaultValue = ''): string => {
  // First check runtime configuration (window._env_)
  if (window._env_ && window._env_[key]) {
    return window._env_[key];
  }

  // Fallback to build-time configuration (process.env)
  // Note: Bundlers replace process.env.KEY at build time, but accessing via index signature
  // like process.env[key] might not work depending on bundler config.
  // Using direct access for known keys below is safer, but for this generic function:
  if (process.env && process.env[key]) {
    return process.env[key] as string;
  }

  return defaultValue;
};

// Helper getter to type-safe access without importing getEnv everywhere
export const Env = {
  get API_URL() {
    return getEnv('REACT_APP_API_URL') || getEnv('BACKEND_URL') || 'http://localhost:8080';
  },
  get AUTH_DISABLED() {
    return getEnv('REACT_APP_AUTH_DISABLED') === 'true' || getEnv('AUTH_DISABLED') === 'true';
  },
};
