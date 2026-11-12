/**
 * Which /api/v1 paths the auth floor may serve without a session.
 *
 * /time-series is intentionally absent: the metric store mixes public market
 * series with private owner financials, so the whole route requires a session.
 *
 * /capsules is not a blanket public prefix. Only a single GET of a non-UUID
 * share token stays anonymous, so list/create/edit/delete cannot ride the
 * same allowlist. UUID reads fall through to the authenticated capsule router.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_PREFIXES = [
  '/auth',
  '/ticker',
  '/data-macro',
  '/driver-analysis',
  '/derived-metrics',
  '/columns',
  '/column-catalog',
  '/grid-data',
  '/column-insights',
  '/grid-templates',
  '/microsoft/auth/callback',
  '/oppgrid',
  '/shares',
  '/capsule-links',
  '/webhooks',
  '/clawdbot',
] as const;

export function isCapsuleShareTokenRead(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  const match = path.match(/^\/capsules\/([^/]+)$/);
  if (!match) return false;
  return !UUID_RE.test(match[1]);
}

export function isPublicApiV1Path(method: string, path: string): boolean {
  if (isCapsuleShareTokenRead(method, path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
