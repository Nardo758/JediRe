/**
 * Vendor Freshness Service — Phase 2C
 *
 * Computes freshness status for vendor market data uploads, driven by
 * the vendor registry's declared freshnessProfile. Used by:
 *   - Deal completeness signals (vendor_data_missing, vendor_data_stale)
 *   - F-key freshness indicators across the financial engine
 *   - The stale-data refresh prompt in the deal UI
 *
 * Freshness thresholds per vendor:
 *   - fresh  : days since as-of date <  staleDays / 3
 *   - aging  : days since as-of date >= staleDays / 3  AND  < staleDays
 *   - stale  : days since as-of date >= staleDays
 *
 * The vendor registry is the single source of truth for thresholds —
 * no hardcoded numbers live here.
 */

import { Pool } from 'pg';
import { vendorRegistry } from './document-extraction/vendor-registry';
import type { VendorFreshnessProfile, VendorLicensePosture } from './document-extraction/vendor-registry';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'no_data';

export interface VendorFreshnessState {
  vendorId:         string;
  displayName:      string;
  licensePosture:   VendorLicensePosture;
  freshnessStatus:  FreshnessStatus;
  /** Most recent data-as-of date found for this vendor, if any. */
  mostRecentAsOf:   string | null;
  /** Calendar days since the most recent as-of date (null when no data). */
  daysSinceAsOf:    number | null;
  /** Stale threshold in days from the vendor's declared freshnessProfile. */
  staleDays:        number;
  /** Number of observation rows found for this vendor + deal. */
  rowCount:         number;
  /** When data crosses this age, the UI should prompt a refresh. */
  promptThreshold:  number;
}

export interface DealVendorFreshnessResult {
  dealId:         string;
  vendors:        VendorFreshnessState[];
  hasAnyData:     boolean;
  hasStaleData:   boolean;
  hasMissingData: boolean;
  computedAt:     string;
}

// ── Core freshness computation ─────────────────────────────────────────────────

/**
 * Compute freshness status for a single (vendor, asOfDate) pair.
 *
 * @param profile - The vendor's declared freshnessProfile from the registry.
 * @param asOfDate - ISO date string for the most recent data snapshot.
 * @returns Freshness status bucket.
 */
export function computeFreshnessStatus(
  profile: VendorFreshnessProfile,
  asOfDate: string | Date | null,
): FreshnessStatus {
  if (!asOfDate) return 'no_data';

  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
  if (isNaN(asOf.getTime())) return 'no_data';

  const daysSince = Math.floor(
    (Date.now() - asOf.getTime()) / (1000 * 60 * 60 * 24),
  );

  const agingThreshold = Math.round(profile.staleDays / 3);

  if (daysSince >= profile.staleDays) return 'stale';
  if (daysSince >= agingThreshold)    return 'aging';
  return 'fresh';
}

/**
 * Days elapsed since an ISO date string (or Date object).
 * Returns null if the date is unparseable.
 */
export function daysSince(asOfDate: string | Date | null): number | null {
  if (!asOfDate) return null;
  const d = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Deal-level freshness query ─────────────────────────────────────────────────

/**
 * Query the freshness state of all registered vendors' data for a given deal.
 *
 * Reads from `vendor_market_observations` (primary substrate written by vendor
 * parsers) and falls back to `data_library_files` for vendor uploads that
 * may not have produced observations (e.g. sale/rent comps without deal context).
 */
export async function getVendorFreshnessForDeal(
  dealId: string,
  pool: Pool,
): Promise<DealVendorFreshnessResult> {
  const allVendors = vendorRegistry.getAllVendors();

  // ── Query 1: vendor_market_observations (primary substrate) ───────────────
  // Fetches the most recent observation date per vendor for this deal.
  const obsResult = await pool.query<{
    vendor_id:   string;
    most_recent: string;
    row_count:   string;
  }>(
    `SELECT vendor_id,
            MAX(COALESCE(vendor_data_as_of, observation_date::date))::text AS most_recent,
            COUNT(*)::text AS row_count
       FROM vendor_market_observations
      WHERE deal_id = $1::uuid
      GROUP BY vendor_id`,
    [dealId],
  ).catch(() => ({ rows: [] as { vendor_id: string; most_recent: string; row_count: string }[] }));

  const obsByVendor = new Map<string, { asOf: string; rowCount: number }>();
  for (const row of obsResult.rows) {
    obsByVendor.set(row.vendor_id, {
      asOf:     row.most_recent,
      rowCount: parseInt(row.row_count, 10) || 0,
    });
  }

  // ── Query 2: data_library_files (fallback for comp uploads without obs rows) ─
  // CoStar sale/rent comps use deal-scoped writes to market_*_comps tables, not
  // vendor_market_observations. Check the files table for any vendor-typed upload.
  const vendorDocTypes = allVendors.flatMap(v => v.fileTypes.map(ft => ft.documentType));
  const fileResult = await pool.query<{
    document_type: string;
    most_recent:   string;
    row_count:     string;
  }>(
    `SELECT document_type,
            MAX(created_at)::text AS most_recent,
            COUNT(*)::text AS row_count
       FROM data_library_files
      WHERE deal_id = $1::uuid
        AND document_type = ANY($2::text[])
        AND parser_status = 'success'
      GROUP BY document_type`,
    [dealId, vendorDocTypes],
  ).catch(() => ({ rows: [] as { document_type: string; most_recent: string; row_count: string }[] }));

  // Map file results back to vendor IDs
  const fileByVendor = new Map<string, { asOf: string; rowCount: number }>();
  for (const row of fileResult.rows) {
    const vendorEntry = vendorRegistry.getVendorByDocType(row.document_type as any);
    if (!vendorEntry) continue;
    const vid = vendorEntry.vendor.vendorId;
    const existing = fileByVendor.get(vid);
    if (!existing || row.most_recent > existing.asOf) {
      fileByVendor.set(vid, {
        asOf:     row.most_recent,
        rowCount: (existing?.rowCount ?? 0) + (parseInt(row.row_count, 10) || 0),
      });
    }
  }

  // ── Assemble per-vendor states ────────────────────────────────────────────
  const vendors: VendorFreshnessState[] = allVendors.map(v => {
    const profile = v.freshnessProfile;
    const obs  = obsByVendor.get(v.vendorId);
    const file = fileByVendor.get(v.vendorId);

    // Prefer obs-level date (higher fidelity); fall back to file upload date
    const asOf     = obs?.asOf ?? file?.asOf ?? null;
    const rowCount = (obs?.rowCount ?? 0) + (file?.rowCount ?? 0);

    const freshnessStatus = rowCount > 0
      ? computeFreshnessStatus(profile, asOf)
      : 'no_data';

    return {
      vendorId:        v.vendorId,
      displayName:     v.displayName,
      licensePosture:  v.licensePosture,
      freshnessStatus,
      mostRecentAsOf:  asOf,
      daysSinceAsOf:   daysSince(asOf),
      staleDays:       profile.staleDays,
      rowCount,
      promptThreshold: profile.staleDays,
    };
  });

  const hasAnyData   = vendors.some(v => v.rowCount > 0);
  const hasStaleData = vendors.some(v => v.freshnessStatus === 'stale');
  const hasMissingData = vendors.some(v => v.freshnessStatus === 'no_data');

  return {
    dealId,
    vendors,
    hasAnyData,
    hasStaleData,
    hasMissingData,
    computedAt: new Date().toISOString(),
  };
}

// ── License posture helpers ────────────────────────────────────────────────────

/**
 * The set of vendor IDs whose license posture is 'restricted'.
 * Used by export routes to filter platform_intel before serving external shares.
 */
export function getRestrictedVendorIds(): Set<string> {
  return new Set(
    vendorRegistry.getAllVendors()
      .filter(v => v.licensePosture === 'restricted')
      .map(v => v.vendorId),
  );
}

/**
 * Filter a `platform_intel` JSONB object before serving it to external
 * (unauthenticated) consumers such as shared deal-book links, shortcode PDF
 * exports, and shortcode Excel exports.
 *
 * Rules (per Piece A §"LICENSE POSTURE ENFORCEMENT"):
 *   - restricted vendors (CoStar): remove any top-level key whose name contains
 *     the vendor ID or whose nested value is tagged with a restricted vendor source.
 *   - platform_only vendors (Yardi Matrix): keep the aggregated values but strip
 *     any vendor-name attribution from nested metadata.
 *
 * This is a best-effort filter applied to the synthesised JSONB blob stored in
 * deal_capsules.platform_intel. Raw vendor rows never live in this blob — they
 * live in vendor-specific tables (costar_submarket_stats, market_rent_comps etc.)
 * which are never included in the capsule export payload.
 */
export function redactRestrictedVendorPlatformIntel(
  platformIntel: Record<string, unknown>,
): Record<string, unknown> {
  const restrictedIds = getRestrictedVendorIds();
  const restrictedPatterns = Array.from(restrictedIds).map(id =>
    new RegExp(id.replace(/_/g, '[_\\s-]*'), 'i'),
  );

  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(platformIntel)) {
    // Key-based check: skip keys that name a restricted vendor directly
    const keyIsRestricted = restrictedPatterns.some(p => p.test(key));
    if (keyIsRestricted) continue;

    // Value-based check: inspect nested vendor_source / _vendorSource annotation
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      const src = (v['vendor_source'] ?? v['_vendorSource'] ?? v['resolvedFrom'] ?? '') as string;
      if (src && restrictedPatterns.some(p => p.test(src))) continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

/**
 * Build a provenance label string for a vendor, used as a watermark in the
 * internal deal UI when showing data sourced from a restricted vendor.
 *
 * External-facing exports must NOT include this label (use redactRestrictedVendorPlatformIntel
 * instead to strip the data entirely).
 */
export function buildVendorProvenanceLabel(
  vendorId: string,
  asOfDate: string | null,
): string {
  const vendor = vendorRegistry.getVendorById(vendorId);
  if (!vendor) return `Source: ${vendorId}`;
  const datePart = asOfDate
    ? ` (as of ${new Date(asOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
    : '';
  return `${vendor.displayName}${datePart} — ${vendor.licensePosture === 'restricted' ? 'for internal use only' : 'platform licensed'}`;
}
