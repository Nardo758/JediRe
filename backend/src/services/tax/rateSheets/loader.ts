/**
 * Tax Service — Rate Sheet Loader
 *
 * Loads and validates all rate sheet JSON files from the rateSheets/ directory
 * at service boot. Invalid sheets throw loudly so bad data never reaches
 * production silently.
 *
 * Usage:
 *   import { getRateSheet, getAllRateSheets } from './loader';
 *   const sheet = getRateSheet('fl-miami-dade', 2026);
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateRateSheet } from './schema';
import type { RateSheet } from './schema';

const RATE_SHEETS_DIR = path.join(__dirname);

/** In-memory cache: `${jurisdiction}-${year}` → RateSheet */
const rateSheetCache = new Map<string, RateSheet>();

let initialized = false;

/**
 * Load and validate all *.json files in the rateSheets/ directory.
 * Called once at service boot. Re-calling is idempotent (uses the cache).
 *
 * Throws on any invalid sheet — we fail loud, not silent.
 */
export function initRateSheets(): void {
  if (initialized) return;

  const files = fs.readdirSync(RATE_SHEETS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(RATE_SHEETS_DIR, file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      throw new Error(`[RateSheetLoader] Failed to parse ${file}: ${(err as Error).message}`);
    }

    const sheet = validateRateSheet(raw, file);
    const key = `${sheet.jurisdiction}-${sheet.year}`;
    rateSheetCache.set(key, sheet);
  }

  initialized = true;
  console.log(`[RateSheetLoader] Loaded ${rateSheetCache.size} rate sheet(s): ${Array.from(rateSheetCache.keys()).join(', ')}`);
}

/**
 * Get the active rate sheet for a jurisdiction and year.
 * Returns null if no sheet is found.
 *
 * Auto-initializes if not yet loaded (lazy init for tests).
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
 * Check if a rate sheet is approaching expiry (within `thresholdDays`).
 */
export function getStalenessWarnings(thresholdDays = 30): Array<{ jurisdiction: string; year: number; validThrough: string; daysRemaining: number }> {
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
 * Reset the loader (for tests only).
 */
export function _resetLoaderForTests(): void {
  rateSheetCache.clear();
  initialized = false;
}
