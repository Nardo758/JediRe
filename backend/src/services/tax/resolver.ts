/**
 * Tax Ruleset Resolver
 *
 * Maps a deal's jurisdiction (state + county) to the most-specific applicable ruleset.
 *
 * Resolution order (most-specific to least-specific):
 *   1. state-county  (e.g. 'FL-Miami-Dade') — future county-level override rulesets
 *   2. state         (e.g. 'FL', 'TX', 'GA')
 *   3. default       (generic fallback)
 *
 * Adding a new state ruleset:
 *   1. Create rulesets/<state>.ruleset.ts implementing TaxRuleset
 *   2. Import and register it in STATE_RULESETS below
 *   3. That's it — no other files need to change
 */

import type { TaxRuleset } from './types';
import { flRuleset } from './rulesets/fl.ruleset';
import { txRuleset } from './rulesets/tx.ruleset';
import { gaRuleset } from './rulesets/ga.ruleset';
import { defaultRuleset } from './rulesets/default.ruleset';

const STATE_RULESETS: Record<string, TaxRuleset> = {
  FL: flRuleset,
  TX: txRuleset,
  GA: gaRuleset,
};

export function resolveRuleset(state: string, county?: string | null): TaxRuleset {
  const stateKey = (state ?? '').toUpperCase().trim();

  if (county) {
    const countyKey = `${stateKey}-${county.trim()}`;
    if (STATE_RULESETS[countyKey]) return STATE_RULESETS[countyKey];
  }

  if (STATE_RULESETS[stateKey]) return STATE_RULESETS[stateKey];

  return defaultRuleset;
}
