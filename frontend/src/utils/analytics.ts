type AnalyticsData = Record<string, string | number | boolean>;
type AnalyticsPayload = Record<string, unknown>;

declare global {
  interface Window {
    umami?: {
      track(payload: (defaults: AnalyticsPayload) => AnalyticsPayload): unknown;
    };
  }
}

/** Optional measurement only: never load a tracker or wait for delivery. */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    const delivery = window.umami?.track(defaults => {
      // Route query strings contain instruction/run IDs. Referrers may too.
      const safeDefaults = { ...defaults };
      delete safeDefaults.id;
      return { ...safeDefaults, url: '/site-finder', referrer: '', name, data };
    });
    // A failed asynchronous delivery must not become an unhandled rejection.
    void Promise.resolve(delivery).catch(() => {});
  } catch {
    // Analytics must never interrupt the interaction.
  }
}