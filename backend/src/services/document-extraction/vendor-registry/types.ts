/**
 * Vendor Market Data Registry — Type Definitions
 *
 * A VendorDeclaration is the single authoritative definition of what a market
 * data vendor looks like: how to identify its file exports (filename fingerprints
 * + header signals), the license posture that governs display/export, how fresh
 * its data is expected to be, and which database tables its parsed rows land in.
 *
 * Adding a new vendor requires:
 *   1. A new `<vendor-id>.vendor.ts` file with its VendorDeclaration
 *   2. Registering it in `registry.ts`
 *   3. Zero changes to classifier.ts or upload route logic
 */

import type { DocumentType } from '../types';

// ── License posture ──────────────────────────────────────────────────────────

/**
 * How data from this vendor may be displayed and exported.
 *
 * - `restricted`    : Vendor-branded data; may not be re-exported with vendor
 *                     attribution. Display with provenance badge. Redact from
 *                     external deal capsule exports.
 * - `platform_only` : Operator-uploaded; platform may use internally but may
 *                     not surface vendor branding externally.
 * - `open`          : County records, FRED, public domain — no restrictions.
 */
export type VendorLicensePosture = 'restricted' | 'platform_only' | 'open';

// ── Freshness profile ────────────────────────────────────────────────────────

/**
 * How quickly data from this vendor goes stale, and at what cadence it is
 * typically available. Used to drive UI refresh prompts and freshness
 * indicators across F-keys.
 */
export interface VendorFreshnessProfile {
  /** Days until a snapshot is considered stale (triggers refresh prompt). */
  staleDays: number;
  /** Days until a snapshot is considered critically stale (triggers alert). */
  criticalStaleDays: number;
  /** Typical data publication cadence. */
  cadence: 'monthly' | 'quarterly' | 'annual' | 'on_demand';
}

// ── Header classification ────────────────────────────────────────────────────

/**
 * Data-driven header pattern for a vendor document type.
 *
 * The classifier iterates all registered vendors' header patterns (in
 * declaration order) and returns the first match. Vendor patterns run
 * BEFORE generic non-vendor patterns to avoid false positives.
 *
 * Matching logic (applied to a lowercased, joined header string):
 *   1. Count matches of `signals` substrings in the header string.
 *   2. If count < `minMatches` → no match.
 *   3. If `alsoRequireOneFromEach` is set, at least one string from EACH
 *      sub-array must appear in the header string → no match if any group fails.
 *   4. If `excluding` is set and any excluded string appears → no match.
 *   5. If all checks pass → return `confidence`.
 */
export interface VendorHeaderPattern {
  /** Candidate signals; matched as substrings of the lowercased header string. */
  signals: string[];
  /**
   * Minimum number of `signals` that must match.
   * Defaults to `signals.length` (all must match) when omitted.
   */
  minMatches?: number;
  /**
   * Array of signal groups. At least one string from EACH group must appear
   * in the header string. Use for "one of [A, B, C]" requirements.
   */
  alsoRequireOneFromEach?: string[][];
  /**
   * If any of these strings appears in the header string, the pattern does
   * not match (used for disambiguation, e.g. "rent comps but not sale comps").
   */
  excluding?: string[];
  /** Confidence 0–1 returned when the pattern matches. */
  confidence: number;
  /** Human-readable description for classification hints. */
  description: string;
}

// ── Write targets ────────────────────────────────────────────────────────────

/**
 * Which tables parsed rows from this document type are written to.
 *
 * `vendorSpecific` tables hold vendor-unique columns that don't fit the
 * cross-vendor schema.
 *
 * `crossVendor` describes the row's contribution to `historical_observations`
 * (via a downstream aggregation step, not a direct per-row insert). The
 * `vendorSourceValue` is what lands in the `vendor_source` column when
 * an aggregation step writes to `historical_observations`.
 */
export interface VendorWriteTargets {
  /** Primary vendor-specific tables. Key = table name, value = `source` field value. */
  vendorSpecific: Record<string, string>;
  /** Cross-vendor substrate. Populated by a downstream aggregation step, not on upload. */
  crossVendor?: {
    table: 'historical_observations';
    /** Value that goes in `historical_observations.vendor_source` when aggregated. */
    vendorSourceValue: string;
  };
}

// ── File type declaration ────────────────────────────────────────────────────

/**
 * A single document type exported by a vendor (e.g. CoStar's "Near By Sales"
 * export maps to one VendorFileType with documentType = COSTAR_SALE_COMPS).
 */
export interface VendorFileType {
  /**
   * Platform document type this file type maps to.
   * Must correspond to a value in the `DocumentType` union.
   */
  documentType: DocumentType;
  /**
   * Human-readable label for this export type (used in UI and hints).
   * e.g. "Near By Sales", "DataTable", "Rent Comp Properties"
   */
  label: string;
  /** Regex patterns matched against the filename (case-insensitive). */
  filenamePatterns?: RegExp[];
  /**
   * Confidence when a filename pattern matches (before header analysis).
   * Defaults to 0.6 when omitted.
   */
  filenameConfidence?: number;
  /** Header-based classification patterns. First match wins. */
  headerPatterns?: VendorHeaderPattern[];
  /** Which tables rows from this document type are written to. */
  writeTargets: VendorWriteTargets;
}

// ── Vendor declaration ───────────────────────────────────────────────────────

/**
 * Top-level vendor declaration. One per market data vendor.
 *
 * To add a new vendor:
 *   1. Create `<vendor-id>.vendor.ts` implementing VendorDeclaration.
 *   2. Call `vendorRegistry.register(declaration)` in `registry.ts`.
 *   3. No other files need to change.
 */
export interface VendorDeclaration {
  /** Stable machine identifier (lowercase, no spaces). e.g. 'costar', 'yardi_matrix' */
  vendorId: string;
  /** Human-readable name. e.g. 'CoStar' */
  displayName: string;
  /** Governs how vendor data may be displayed and exported. */
  licensePosture: VendorLicensePosture;
  /** How quickly vendor data goes stale. */
  freshnessProfile: VendorFreshnessProfile;
  /**
   * The document types this vendor exports, in priority order.
   * The classifier evaluates fileTypes in declaration order — put more
   * specific patterns before more general ones.
   */
  fileTypes: VendorFileType[];
}

// ── Classification result extension ─────────────────────────────────────────

/**
 * Extended classification result that includes vendor attribution when
 * the classifier identified a vendor-registered document type.
 */
export interface VendorClassificationMatch {
  vendorId: string;
  displayName: string;
  fileType: VendorFileType;
  licensePosture: VendorLicensePosture;
  freshnessProfile: VendorFreshnessProfile;
}
