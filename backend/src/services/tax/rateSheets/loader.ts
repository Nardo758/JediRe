/**
 * Tax Service — Rate Sheet Loader
 *
 * Loads and validates every rate sheet registered in `_manifest.ts` at service
 * boot. The manifest uses static JSON imports (TypeScript resolveJsonModule),
 * so JSON data is embedded in the dist bundle — no filesystem scanning is
 * needed and the loader works identically in ts-node (dev) and compiled dist
 * (production).
 *
 * To add a new rate sheet:
 *   1. Create the JSON file in this directory
 *   2. Register it in _manifest.ts (one import + one array entry)
 *   → The loader picks it up automatically on next boot
 *
 * Usage:
 *   import { getRateSheet, getAllRateSheets } from './loader';
 *   const sheet = getRateSheet('fl-miami-dade', 2026);
 */

import { validateRateSheet } from './schema';
import type { RateSheet } from './schema';
import { ALL_RATE_SHEETS, MINIMUM_SHEETS } from './_manifest';

/** In-memory cache: `${jurisdiction}-${year}` → RateSheet */
const rateSheetCache = new Map<string, RateSheet>();

let initialized = false;

/**
 * Load and validate every sheet in the manifest.
 * Called once at service boot via index.replit.ts.
 * Re-calling is idempotent.
 *
 * Throws loudly on:
 *   - Any sheet that fails Zod validation
 *   - Fewer than MINIMUM_SHEETS loaded (catches manifest misconfiguration)
 */
export function initRateSheets(): void {
  if (initialized) return;

  for (const { raw, filename } of ALL_RATE_SHEETS) {
    const sheet = validateRateSheet(raw, filename);
    const key = `${sheet.jurisdiction}-${sheet.year}`;
    rateSheetCache.set(key, sheet);
  }

  if (rateSheetCache.size < MINIMUM_SHEETS) {
    throw new Error(
      `[RateSheetLoader] Expected at least ${MINIMUM_SHEETS} rate sheet(s), ` +
      `but only ${rateSheetCache.size} loaded. ` +
      `Check _manifest.ts for missing or duplicate entries.`,
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
 * Returns null if no sheet is found (e.g. jurisdiction not yet modeled).
 *
 * Auto-initializes if called before initRateSheets() (tests / lazy paths).
 */
export function getRateSheet(jurisdiction: string, year: number): RateSheet | null {
  if (!initialized) initRateSheets();
  return rateSheetCache.get(`${jurisdiction}-${year}`) ?? null;
}

/**
 * Get all loaded rate sheets.
 * Useful for the coverage endpoint and staleness-check cron.
 */
export function getAllRateSheets(): RateSheet[] {
  if (!initialized) initRateSheets();
  return Array.from(rateSheetCache.values());
}

/**
 * Check for rate sheets approaching expiry (within `thresholdDays`).
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
 * Reset the loader state (tests only). Never call in production code.
 */
export function _resetLoaderForTests(): void {
  rateSheetCache.clear();
  initialized = false;
}
