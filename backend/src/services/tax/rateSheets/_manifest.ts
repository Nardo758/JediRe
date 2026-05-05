/**
 * Rate Sheet Manifest
 *
 * Every JSON rate sheet in this directory MUST be registered here.
 * The loader iterates this array at boot — registration is the only
 * mechanism for a sheet to be loaded, validated, and made available
 * via getRateSheet().
 *
 * ── HOW TO ADD A NEW SHEET ─────────────────────────────────────────
 *  1. Create backend/src/services/tax/rateSheets/<jur>-<year>.json
 *  2. Import it below with a descriptive name
 *  3. Add it to the ALL_RATE_SHEETS array
 *  4. Bump MINIMUM_SHEETS if the new sheet is required at boot
 *  5. No other files need to change
 * ──────────────────────────────────────────────────────────────────
 *
 * Using TypeScript static imports (resolveJsonModule: true) rather than
 * fs.readdirSync ensures JSON data is embedded in the compiled dist bundle
 * and works correctly in both ts-node (dev) and node dist/ (production).
 */

import federal2026  from './federal-2026.json';
import fl2026       from './fl-2026.json';
import flMiamiDade2026 from './fl-miami-dade-2026.json';

export interface SheetEntry {
  raw: unknown;
  filename: string;
}

/**
 * ALL_RATE_SHEETS — single source of truth for every rate sheet.
 * Loader validates all of these at boot; missing or invalid files are fatal.
 */
export const ALL_RATE_SHEETS: SheetEntry[] = [
  { raw: federal2026,      filename: 'federal-2026.json' },
  { raw: fl2026,           filename: 'fl-2026.json' },
  { raw: flMiamiDade2026,  filename: 'fl-miami-dade-2026.json' },
];

/**
 * Minimum number of sheets that must load for the service to start.
 * Prevents silent empty-cache failures if the manifest is misconfigured.
 */
export const MINIMUM_SHEETS = ALL_RATE_SHEETS.length;
