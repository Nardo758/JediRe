/**
 * SSRF protection helpers shared by create-time validation AND poll-time fetch.
 *
 * Strategy:
 *   1. Reject non-http(s), localhost-literal, private/link-local hostnames.
 *   2. Resolve all A/AAAA records and reject if any address is private,
 *      loopback, link-local, or the cloud-metadata IP (169.254.169.254).
 *   3. At fetch time, supply a custom `lookup` that re-runs the same checks
 *      on the address actually being connected to (defeats DNS rebinding
 *      between the create-time check and the request).
 *   4. Follow redirects manually with the same guard applied to every hop.
 */

import dns from 'dns/promises';
import dnsLegacy from 'dns';
import https from 'https';
import http from 'http';
import net from 'net';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return true; // refuse anything we can't classify
  if (net.isIP(ip) === 4) {
    const o = ip.split('.').map(Number);
    if (o[0] === 10) return true;
    if (o[0] === 127) return true;
    if (o[0] === 0) return true;
    if (o[0] === 169 && o[1] === 254) return true; // link-local + AWS/GCE metadata
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    if (o[0] >= 224) return true; // multicast / reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
  return false;
}

/** Hostname-level check + DNS resolution check. */
export async function ssrfGuardFeedUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'url is not a valid URL';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'url must use http(s)';
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    return 'feed host is not reachable from this server';
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) return 'feed host resolves to a private network';
    return null;
  }
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return 'feed host could not be resolved';
    for (const r of records) {
      if (isPrivateIp(r.address)) return 'feed host resolves to a private network';
    }
  } catch {
    return 'feed host could not be resolved';
  }
  return null;
}

/**
 * Custom DNS lookup callback that validates the resolved IP at connect time.
 * If the IP is private/loopback/link-local, the lookup fails and the request
 * is aborted before any bytes are sent.
 */
// Custom DNS lookup that matches Node's overloaded `dns.lookup` signature.
// We funnel both call shapes through a single normalized handler.
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | dnsLegacy.LookupAddress[],
  family?: number
) => void;
type LookupOptionsArg =
  | dnsLegacy.LookupOptions
  | dnsLegacy.LookupOneOptions
  | dnsLegacy.LookupAllOptions
  | LookupCallback
  | undefined;

const safeLookup = (
  hostname: string,
  optionsOrCallback: LookupOptionsArg,
  maybeCallback?: LookupCallback
): void => {
  const cb: LookupCallback =
    typeof optionsOrCallback === 'function'
      ? optionsOrCallback
      : (maybeCallback as LookupCallback);
  const opts: dnsLegacy.LookupOptions =
    typeof optionsOrCallback === 'function' || !optionsOrCallback
      ? {}
      : (optionsOrCallback as dnsLegacy.LookupOptions);

  dnsLegacy.lookup(hostname, opts, (err, address, family) => {
    if (err) return cb(err);
    if (Array.isArray(address)) {
      const filtered = (address as dnsLegacy.LookupAddress[]).filter(
        (a) => !isPrivateIp(a.address)
      );
      if (!filtered.length) {
        return cb(new Error(`SSRF: ${hostname} resolved only to private addresses`));
      }
      return cb(null, filtered, family);
    }
    if (isPrivateIp(address as string)) {
      return cb(new Error(`SSRF: ${hostname} resolved to private address ${address}`));
    }
    return cb(null, address as string, family);
  });
};

/**
 * Fetch a URL safely with redirect-aware SSRF re-validation.
 * Returns the response body as a UTF-8 string. Throws on SSRF/timeout/error.
 */
export async function safeFetchText(rawUrl: string): Promise<string> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guardErr = await ssrfGuardFeedUrl(currentUrl);
    if (guardErr) throw new Error(`SSRF guard rejected redirect target: ${guardErr}`);

    const parsed = new URL(currentUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const result = await new Promise<{
      status: number;
      headers: http.IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = lib.request(
        currentUrl,
        {
          method: 'GET',
          lookup: safeLookup,
          timeout: FETCH_TIMEOUT_MS,
          // Many publisher edges (Cloudflare/Akamai protecting bizjournals,
          // bisnow, globest, etc.) reject obvious-bot UAs with HTTP 403. We
          // present as a recent desktop browser; the request is still rate-
          // limited to one URL per user-configured connection per poll cycle.
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept:
              'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
          },
        },
        (res) => {
          let total = 0;
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
              req.destroy(new Error('feed body exceeds 5MB cap'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
          res.on('error', reject);
        }
      );
      req.on('timeout', () => req.destroy(new Error('feed request timed out')));
      req.on('error', reject);
      req.end();
    });

    // Manual redirect handling — disable native auto-follow so we can re-guard.
    if (result.status >= 300 && result.status < 400 && result.headers.location) {
      currentUrl = new URL(String(result.headers.location), currentUrl).toString();
      continue;
    }
    if (result.status >= 400) {
      throw new Error(`feed returned HTTP ${result.status}`);
    }
    return result.body;
  }
  throw new Error('too many redirects');
}
