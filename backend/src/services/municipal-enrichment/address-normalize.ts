/**
 * Shared address-normalization utilities for municipal-enrichment adapters.
 *
 * Exports:
 *   STREET_TYPE_MAP          — USPS street-type long-form → abbreviation map
 *   normalizeAddress()       — basic uppercase + whitespace collapse (all adapters)
 *   normalizeAddressFull()   — normalizeAddress + direction expansion + type map (GA adapters)
 *   extractStreetNumber()    — pull leading house number from normalized address
 *   extractStreetName()      — strip number + trailing directional suffix
 *   extractStreetNameFull()  — strip number + leading AND trailing directional
 *   extractStreetKeyword()   — DeKalb-style mid-wildcard keyword (strips type + both dirs)
 *   sanitize()               — SQL-safe value with configurable max length
 */

/** Maps spelled-out street types to USPS abbreviations. */
export const STREET_TYPE_MAP: Record<string, string> = {
  STREET: 'ST', ROAD: 'RD', BOULEVARD: 'BLVD', DRIVE: 'DR',
  AVENUE: 'AVE', COURT: 'CT', CIRCLE: 'CIR', PLACE: 'PL',
  LANE: 'LN', PARKWAY: 'PKWY', HIGHWAY: 'HWY', TERRACE: 'TER',
  TRAIL: 'TRL', POINT: 'PT', POINTE: 'PT', WAY: 'WAY',
};

/**
 * Basic normalization: uppercase, collapse whitespace, strip dots,
 * strip everything from the first comma onward.
 * Used by most adapters whose source data doesn't store full street-type words.
 */
export function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Full normalization: normalizeAddress + compound-direction expansion
 * (NORTHEAST→NE, etc.) + street-type-word expansion (ROAD→RD, etc.).
 * Used by adapters that receive user-typed input stored as full words
 * (e.g., Fulton GA "Tax_Parcels_2025", DeKalb GA "Parcels").
 */
export function normalizeAddressFull(addr: string): string {
  let s = addr
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  s = s
    .replace(/\bNORTHEAST\b/g, 'NE')
    .replace(/\bNORTHWEST\b/g, 'NW')
    .replace(/\bSOUTHEAST\b/g, 'SE')
    .replace(/\bSOUTHWEST\b/g, 'SW');

  for (const [long, abbr] of Object.entries(STREET_TYPE_MAP)) {
    s = s.replace(new RegExp(`\\b${long}\\b`, 'g'), abbr);
  }

  return s.replace(/\s+/g, ' ').trim();
}

/** Extract the leading numeric house number from a normalized address string. */
export function extractStreetNumber(addr: string): string {
  const m = addr.match(/^(\d+)\s/);
  return m ? m[1] : '';
}

/**
 * Extract the street name portion, stripping the leading house number and
 * trailing directional suffix (NW, SE, N, S, etc.).
 * Use when the source data includes the leading directional as part of the
 * stored street name (e.g., "100 N Highland Ave NE" is stored as "N Highland Ave NE").
 */
export function extractStreetName(addr: string): string {
  return addr
    .replace(/^\d+\s+/, '')
    .replace(/\s+(NW|NE|SW|SE|N|S|E|W)$/i, '')
    .trim();
}

/**
 * Extract the street name portion, stripping the leading house number and
 * BOTH the leading directional prefix (N, NE, etc.) and trailing directional suffix.
 * Use when the source data stores pure street names without directional prefixes
 * (e.g., Mecklenburg NC `streetname`, Dallas TX `ST_NAME`).
 */
export function extractStreetNameFull(addr: string): string {
  return addr
    .replace(/^\d+\s+/, '')
    .replace(/^(N|S|E|W|NE|NW|SE|SW)\s+/i, '')
    .replace(/\s+(NW|NE|SW|SE|N|S|E|W)$/i, '')
    .trim();
}

/**
 * DeKalb-style keyword extraction for mid-wildcard LIKE queries
 * (LOWER(SITEADDRES) LIKE '{num} %{keyword}%').
 *
 * Strips: leading number, single-direction abbreviation prefix, trailing
 * directional suffix, and trailing street-type abbreviation.
 * Returns the remaining token(s) in lowercase.
 *
 * Examples:
 *   "2696 N DRUID HILLS RD NE"  → "druid hills"
 *   "3108 BRIARCLIFF RD NE"     → "briarcliff"
 *   "4685 CHAMBLEE DUNWOODY RD" → "chamblee dunwoody"
 */
export function extractStreetKeyword(normalized: string): string {
  let s = normalized.replace(/^\d+\s+/, '');

  s = s.replace(/^(NE|NW|SE|SW|N|S|E|W)\s+/, '');

  s = s.replace(/\s+(NE|NW|SE|SW|N|S|E|W)$/, '').trim();

  const typeAbbrs = Array.from(new Set(Object.values(STREET_TYPE_MAP))).join('|');
  s = s.replace(new RegExp(`\\s+(${typeAbbrs})$`), '').trim();

  return s.toLowerCase();
}

/**
 * Sanitize a string for safe interpolation into ArcGIS SQL WHERE clauses.
 * Escapes single quotes, strips semicolons and backslashes, and truncates.
 *
 * @param value   The raw string to sanitize.
 * @param maxLen  Maximum character length after sanitization (default: 100).
 */
export function sanitize(value: string, maxLen = 100): string {
  return value.replace(/'/g, "''").replace(/[;\\]/g, '').substring(0, maxLen);
}
