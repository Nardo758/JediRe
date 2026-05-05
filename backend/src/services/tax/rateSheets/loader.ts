/**
 * Tax Service — Rate Sheet Loader
 *
 * Loads and validates all seed rate sheets at service boot via static JSON imports
 * (enabled by `resolveJsonModule: true` in tsconfig). Static imports are compiled
 * into the dist bundle so the JSON files are always co-located and never lost in
 * production builds — unlike `fs.readdirSync(__dirname)` which breaks when the
 * source tree is absent.
 *
 * To add a new rate sheet:
 *   1. Create backend/src/services/tax/rateSheets/<jurisdiction>-<year>.json
 *   2. Import it below and add it to SEED_SHEETS
 *   3. Bump the MINIMUM_SHEETS constant if this sheet is now required at boot
 *
 * Usage:
 *   import { getRateSheet, getAllRateSheets } from './loader';
 *   const sheet = getRateSheet('fl-miami-dade', 2026);
 */

import { validateRateSheet } from './schema';
import type { RateSheet } from './schema';

import federal2026Raw from './federal-2026.json';
import fl2026Raw from './fl-2026.json';
import flMiamiDade2026Raw from './fl-miami-dade-2026.json';

/** Minimum number of sheets that must load for the service to start. */
const MINIMUM_SHEETS = 3;

/** All seed sheets. Add new imports above and register here. */
const SEED_SHEETS: Array<{ raw: unknown; name: string }> = [
  { raw: federal2026Raw,       name: 'federal-2026.json' },
  { raw: fl2026Raw,            name: 'fl-2026.json' },
  { raw: flMiamiDade2026Raw,   name: 'fl-miami-dade-2026.json' },
];

/** In-memory cache: `${jurisdiction}-${year}` → RateSheet */
const rateSheetCache = new Map<string, RateSheet>();

let initialized = false;

/**
 * Load and validate all seed rate sheets.
 * Called once at service boot via index.replit.ts.
 * Re-calling is idempotent (returns immediately if already loaded).
 *
 * Throws loudly on:
 *   - Any sheet that fails Zod validation
 *   - Fewer than MINIMUM_SHEETS loaded (catches packaging failures)
 */
export function initRateSheets(): void {
  if (initialized) return;

  for (const { raw, name } of SEED_SHEETS) {
    const sheet = validateRateSheet(raw, name);
    const key = `${sheet.jurisdiction}-${sheet.year}`;
    rateSheetCache.set(key, sheet);
  }

  if (rateSheetCache.size < MINIMUM_SHEETS) {
    throw new Error(
      `[RateSheetLoader] Expected at least ${MINIMUM_SHEETS} rate sheets, ` +
      `but only ${rateSheetCache.size} loaded. ` +
      `Add missing sheets to SEED_SHEETS in loader.ts.`,
    );
  }

  initialized = true;
  console.log(
    `[RateSheetLoader] Loaded ${rateSheetCache.size} rate sheet(s): ` +
    Array.from(rateSheetCache.keys()).join(', '),
  );
}

/**
 * Get the active rate sheet for a jurisdiction and year.
 * Returns null if no sheet is found.
 *
 * Auto-initializes if called before initRateSheets() (tests / lazy paths).
 */
export function getRateSheet(jurisdiction: string, year: number): RateSheet | null {
  if (!initialized) initRateSheets();
  return rateSheetCache.get(`${jurisdiction}-${year}`) ?? null;
}

/**
 * Get all loaded rate sheets. Useful for the coverage endpoint and staleness cron.
 */
export function getAllRateSheets(): RateSheet[] {
  if (!initialized) initRateSheets();
  return Array.from(rateSheetCache.values());
}

/**
 * Check if any rate sheets are approaching expiry (within `thresholdDays`).
 * Returns entries where the sheet's valid_through date is within the threshold.
 */
export function getStalenessWarnings(
  thresholdDays = 30,
): Array<{ jurisdiction: string; year: number; validThrough: string; daysRemaining: number }> {
  if (!initialized) initRateSheets();
  const now = Date.now();
  const threshold = thresholdDays * 24 * 60 * 60 * 1000;
  const warnings: Array<{ jurisdiction: string; year: number; validThrough: string; daysRemaining: number }> = [];

  for (const sheet of rateSheetCache.values()) {
    const expiresAt = new Date(sheet.valid_through).getTime();
    const msRemaining = expiresAt - now;
    if (msRemaining < threshold) {
      warnings.push({
        jurisdiction: sheet.jurisdiction,
        year: sheet.year,
        validThrough: sheet.valid_through,
        daysRemaining: Math.max(0, Math.floor(msRemaining / (24 * 60 * 60 * 1000))),
      });
    }
  }

  return warnings;
}

/**
 * Reset the loader (tests only). Never call in production code.
 */
export function _resetLoaderForTests(): void {
  rateSheetCache.clear();
  initialized = false;
}
