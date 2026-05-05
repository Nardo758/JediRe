/**
 * Tax Service — Rate Sheet Loader
 *
 * Scans all `*.json` files in this directory at boot, validates each via Zod,
 * and caches the result. Fails loud — any invalid sheet causes process.exit(1)
 * in the bootstrap caller (index.replit.ts) so bad data never reaches production
 * silently.
 *
 * Works in both ts-node (dev) and compiled dist (production). In production,
 * the `postbuild` npm script copies `*.json` files alongside the compiled JS so
 * `__dirname` points to a directory containing the JSON assets at runtime.
 *
 * To add a new rate sheet:
 *   1. Create backend/src/services/tax/rateSheets/<jurisdiction>-<year>.json
 *   2. No other files need to change — the directory scan auto-discovers it
 *
 * Usage:
 *   import { getRateSheet, getAllRateSheets } from './loader';
 *   const sheet = getRateSheet('fl-miami-dade', 2026);
 */

import * as fs   from 'fs';
import * as path from 'path';
import { validateRateSheet } from './schema';
import type { RateSheet } from './schema';

/** In-memory cache: `${jurisdiction}-${year}` → RateSheet */
const rateSheetCache = new Map<string, RateSheet>();

let initialized = false;

/**
 * Scan `__dirname` for all `*.json` files, validate each via Zod, and cache.
 * Called once at service boot. Re-calling is idempotent.
 *
 * Throws loudly when:
 *   - Any `.json` file fails Zod validation (invalid schema)
 *   - Zero `.json` files are found (packaging failure — no sheets in directory)
 */
export function initRateSheets(): void {
  if (initialized) return;

  const dir = __dirname;
  const jsonFiles = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();                 // deterministic load order

  if (jsonFiles.length === 0) {
    throw new Error(
      `[RateSheetLoader] No *.json rate sheets found in ${dir}. ` +
      `Ensure the postbuild copy step ran (npm run build) or ` +
      `that JSON files are present in src/services/tax/rateSheets/.`,
    );
  }

  for (const filename of jsonFiles) {
    const filePath = path.join(dir, filename);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      throw new Error(
        `[RateSheetLoader] Failed to parse ${filename}: ${(err as Error).message}`,
      );
    }

    const sheet = validateRateSheet(raw, filename);
    const key = `${sheet.jurisdiction}-${sheet.year}`;
    if (rateSheetCache.has(key)) {
      throw new Error(
        `[RateSheetLoader] Duplicate rate sheet key "${key}" ` +
        `while loading "${filename}". Each jurisdiction-year combination must be unique. ` +
        `Remove or rename the conflicting file.`,
      );
    }
    rateSheetCache.set(key, sheet);
  }

  initialized = true;
  console.log(
    `[RateSheetLoader] Loaded ${rateSheetCache.size} rate sheet(s) from ${dir}: ` +
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
 * Get all loaded rate sheets. Useful for the coverage endpoint and staleness cron.
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
