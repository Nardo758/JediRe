/**
 * opex-key-aliases.ts
 *
 * Versioned alias ruleset for opex vocabulary mismatches that canonical
 * normalization (strip non-alphanumeric, lowercase) cannot bridge.
 *
 * Problem: `canonicalKey()` strips ALL non-alphanumeric chars including
 * underscores, so `"g_and_a"` → `"ganda"`. A display key like `"Administrative"`
 * → `"administrative"` will NOT match `"ganda"`. These semantic aliases need
 * an explicit map.
 *
 * Design principles (per Ruling 3):
 *   - Separate file, not inline — the map is data, not code.
 *   - Versioned — rulesetVersion bumps when entries are added/removed.
 *   - Canonical-first — alias lookup runs ONLY after canonicalIndex misses.
 *   - Audit-friendly — each entry carries a source comment for provenance.
 *
 * Usage in proforma-assumptions-bridge.ts:
 *   1. Build canonicalIndex from raw expense keys.
 *   2. On getExpAmt/getExpGrowth miss, consult resolveAlias(key).
 *   3. If alias resolves, look up the aliased key in canonicalIndex.
 *   4. Only if BOTH canonical AND alias miss, warn (if required).
 */

export const OPEX_KEY_RULESET_VERSION = '2026-07-04a';

/** Single alias entry: one or more display variants → canonical snake_case key. */
interface AliasEntry {
  /** The canonical snake_case key that the bridge expects. */
  canonical: string;
  /** One or more vocabulary variants that should map to canonical. */
  aliases: string[];
  /** Provenance / rationale for this alias. */
  source: string;
}

/**
 * Known vocabulary variants collected from real deal data, LLM outputs, and
 * third-party exports.  Add new entries at the END of the array so version
 * bumps remain deterministic.
 */
const ALIASES: AliasEntry[] = [
  {
    canonical: 'g_and_a',
    aliases: ['Administrative', 'General & Administrative', 'G&A', 'General and Administrative'],
    source: 'Bishop live rebuild — LLM labels G&A as "Administrative"',
  },
  {
    canonical: 'repairs_maintenance',
    aliases: ['Repairs & Maintenance', 'R&M', 'Repair and Maintenance'],
    source: 'Common display labels from OM / T12 exports',
  },
  {
    canonical: 'contract_services',
    aliases: ['Contract Services', 'Contracted Services', 'Third Party Services'],
    source: 'Common display labels from OM / T12 exports',
  },
  {
    canonical: 'management_fee',
    aliases: ['Management Fee', 'Property Management', 'Mgmt Fee'],
    source: 'Common display labels from OM / T12 exports',
  },
  {
    canonical: 'replacement_reserves',
    aliases: ['Replacement Reserves', 'CapEx Reserves', 'Capital Reserves', 'R&R'],
    source: 'Common display labels from OM / T12 exports',
  },
  {
    canonical: 'real_estate_tax',
    aliases: ['Property Tax', 'Real Estate Tax', 'RE Taxes', 'Taxes'],
    source: 'Common display labels from OM / T12 exports',
  },
];

/** Build a flat lookup: canonicalized alias string → canonical snake_case key. */
function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of ALIASES) {
    for (const alias of entry.aliases) {
      const canonAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      map.set(canonAlias, entry.canonical);
    }
  }
  return map;
}

const ALIAS_MAP = buildAliasMap();

/**
 * Resolve a raw expense key to its canonical snake_case form via alias rules.
 * Returns `null` when no alias rule matches (true miss).
 *
 * @param rawKey — the raw key from ProFormaAssumptions.expenses
 * @returns canonical snake_case key, or null
 */
export function resolveAlias(rawKey: string): string | null {
  const canon = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALIAS_MAP.get(canon) ?? null;
}

/** For diagnostics: list all aliases that map to a given canonical key. */
export function getAliasesFor(canonical: string): string[] {
  const entry = ALIASES.find(a => a.canonical === canonical);
  return entry ? entry.aliases : [];
}

/** Ruleset metadata for logging / versioning. */
export function getRulesetMeta(): { version: string; entryCount: number } {
  return { version: OPEX_KEY_RULESET_VERSION, entryCount: ALIASES.length };
}
