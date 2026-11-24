/**
 * Settings read when the page loads, from window.__REITTI_CONFIG__ (public/config.js).
 * The Docker container rewrites config.js from its environment variables at startup,
 * so these can change without rebuilding. In development the file is empty.
 */
export interface RuntimeConfig {
  ollamaUrl?: string;
  ollamaModel?: string;
  umamiUrl?: string;
  umamiWebsiteId?: string;
}

declare global {
  interface Window {
    __REITTI_CONFIG__?: RuntimeConfig;
  }
}

export const runtimeConfig: RuntimeConfig = (typeof window !== 'undefined' && window.__REITTI_CONFIG__) || {};
