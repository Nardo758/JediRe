/**
 * Insurance Ruleset Resolver
 *
 * Maps a deal's jurisdiction to the most-specific insurance ruleset.
 *
 * Adding a new state:
 *   1. Create rulesets/<state>.ruleset.ts implementing InsuranceRuleset
 *   2. Import and register in STATE_RULESETS below
 */

import type { InsuranceRuleset } from './types';
import { flInsuranceRuleset } from './rulesets/fl.ruleset';
import { txInsuranceRuleset } from './rulesets/tx.ruleset';
import { gaInsuranceRuleset } from './rulesets/ga.ruleset';
import { defaultInsuranceRuleset } from './rulesets/default.ruleset';

const STATE_RULESETS: Record<string, InsuranceRuleset> = {
  FL: flInsuranceRuleset,
  TX: txInsuranceRuleset,
  GA: gaInsuranceRuleset,
};

export function resolveInsuranceRuleset(state: string, county?: string | null): InsuranceRuleset {
  const stateKey = (state ?? '').toUpperCase().trim();

  if (county) {
    const countyKey = `${stateKey}-${county.trim()}`;
    if (STATE_RULESETS[countyKey]) return STATE_RULESETS[countyKey];
  }

  if (STATE_RULESETS[stateKey]) return STATE_RULESETS[stateKey];

  return defaultInsuranceRuleset;
}
