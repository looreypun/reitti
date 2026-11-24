import { runtimeConfig } from './runtimeConfig';

/**
 * Visitor stats via a self-hosted Umami server. Loads only when UMAMI_URL and UMAMI_WEBSITE_ID
 * are set in the container; otherwise every call here does nothing. Umami follows client-side
 * route changes itself, so each place page counts as a page view.
 */
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number | boolean>) => void };
  }
}

export function initAnalytics() {
  const url = runtimeConfig.umamiUrl?.replace(/\/$/, '');
  const id = runtimeConfig.umamiWebsiteId;
  if (!url || !id || document.querySelector('script[data-website-id]')) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = `${url}/script.js`;
  script.dataset.websiteId = id;
  document.head.appendChild(script);
}

/** Records a custom event in Umami. Never send personal data or what people typed. */
export function trackEvent(event: string, data?: Record<string, string | number | boolean>) {
  try {
    window.umami?.track(event, data);
  } catch {
    /* analytics must never break the app */
  }
}
