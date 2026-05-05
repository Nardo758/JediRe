/**
 * Tax Ruleset Resolver
 *
 * Maps a deal's jurisdiction (state + county) to the most-specific applicable ruleset,
 * and provides city→county derivation for deals where county is not stored on the record.
 *
 * Resolution order (most-specific to least-specific):
 *   1. state-county  (e.g. 'FL-Miami-Dade') — county overlay rulesets
 *   2. state         (e.g. 'FL', 'TX', 'GA')
 *   3. default       (generic fallback — emits jurisdictionMapped=false)
 *
 * County resolution order:
 *   1. Explicit county field from deal record (deal_data.county or future deals.county column)
 *   2. City→county derivation from CITY_TO_COUNTY map below
 *   3. null (rulesets fall back to their own city-detection if needed)
 *
 * resolveRulesetStack() — primary API used by taxService.forecast()
 * resolveRuleset()      — legacy single-ruleset API (delegates to stack internally)
 *
 * Adding a new state ruleset:
 *   1. Create rulesets/<state>.ruleset.ts implementing TaxRuleset
 *   2. Import and register it in STATE_RULESETS below
 *   3. Add city→county entries for that state in CITY_TO_COUNTY
 *
 * Adding a new county overlay:
 *   1. Create rulesets/<state>-<county>.ruleset.ts implementing CountyOverlayRuleset
 *   2. Import and register it in COUNTY_RULESETS below using key 'STATE-County'
 */

import type { TaxRuleset, CountyOverlayRuleset, RulesetStack } from './types';
import { flRuleset } from './rulesets/fl.ruleset';
import { txRuleset } from './rulesets/tx.ruleset';
import { gaRuleset } from './rulesets/ga.ruleset';
import { defaultRuleset } from './rulesets/default.ruleset';
import { federalRuleset } from './rulesets/federal.ruleset';
import { flMiamiDadeRuleset } from './rulesets/fl-miami-dade.ruleset';
import { flBrowardRuleset } from './rulesets/fl-broward.ruleset';
import { flPalmBeachRuleset } from './rulesets/fl-palm-beach.ruleset';
import { gaFultonRuleset } from './rulesets/ga-fulton.ruleset';
import { txHarrisRuleset } from './rulesets/tx-harris.ruleset';

const STATE_RULESETS: Record<string, TaxRuleset> = {
  FL: flRuleset,
  TX: txRuleset,
  GA: gaRuleset,
};

/**
 * County overlay registry.
 * Keys: `${STATE}-${county}` using the exact county string from CITY_TO_COUNTY values.
 *
 * taxService.forecast() calls stack.county?.annualPropertyTax() (millage override)
 * and stack.county?.countySurtax() (Miami-Dade only).
 */
const COUNTY_RULESETS: Record<string, CountyOverlayRuleset> = {
  'FL-Miami-Dade':  flMiamiDadeRuleset,
  'FL-Broward':     flBrowardRuleset,
  'FL-Palm Beach':  flPalmBeachRuleset,
  'GA-Fulton':      gaFultonRuleset,
  'TX-Harris':      txHarrisRuleset,
};

/**
 * City→County lookup for the three launch markets.
 * Key: `${STATE}:${city.toLowerCase().trim()}`
 * Value: normalized county name (matches the keys used in COUNTY_RULESETS above)
 *
 * Sources: US Census TIGER/Line; county property appraiser TRIM notices.
 */
const CITY_TO_COUNTY: Record<string, string> = {
  // ── Florida ────────────────────────────────────────────────────────────────
  'FL:miami':                    'Miami-Dade',
  'FL:miami beach':              'Miami-Dade',
  'FL:hialeah':                  'Miami-Dade',
  'FL:coral gables':             'Miami-Dade',
  'FL:doral':                    'Miami-Dade',
  'FL:miami gardens':            'Miami-Dade',
  'FL:homestead':                'Miami-Dade',
  'FL:north miami':              'Miami-Dade',
  'FL:north miami beach':        'Miami-Dade',
  'FL:opa-locka':                'Miami-Dade',
  'FL:aventura':                 'Miami-Dade',
  'FL:bal harbour':              'Miami-Dade',
  'FL:florida city':             'Miami-Dade',
  'FL:golden beach':             'Miami-Dade',
  'FL:indian creek':             'Miami-Dade',
  'FL:key biscayne':             'Miami-Dade',
  'FL:medley':                   'Miami-Dade',
  'FL:miami shores':             'Miami-Dade',
  'FL:miami springs':            'Miami-Dade',
  'FL:north bay village':        'Miami-Dade',
  'FL:palmetto bay':             'Miami-Dade',
  'FL:pinecrest':                'Miami-Dade',
  'FL:south miami':              'Miami-Dade',
  'FL:sunny isles beach':        'Miami-Dade',
  'FL:surfside':                 'Miami-Dade',
  'FL:sweetwater':               'Miami-Dade',
  'FL:virginia gardens':         'Miami-Dade',
  'FL:west miami':               'Miami-Dade',
  'FL:orlando':                  'Orange',
  'FL:kissimmee':                'Osceola',
  'FL:sanford':                  'Seminole',
  'FL:tampa':                    'Hillsborough',
  'FL:jacksonville':             'Duval',
  'FL:fort lauderdale':          'Broward',
  'FL:pompano beach':            'Broward',
  'FL:hollywood':                'Broward',
  'FL:miramar':                  'Broward',
  'FL:pembroke pines':           'Broward',
  'FL:west palm beach':          'Palm Beach',
  'FL:boca raton':               'Palm Beach',
  'FL:boynton beach':            'Palm Beach',
  'FL:delray beach':             'Palm Beach',
  'FL:pensacola':                'Escambia',
  'FL:gainesville':              'Alachua',
  'FL:tallahassee':              'Leon',
  'FL:st. petersburg':           'Pinellas',
  'FL:saint petersburg':         'Pinellas',
  'FL:clearwater':               'Pinellas',
  'FL:sarasota':                 'Sarasota',
  'FL:bradenton':                'Manatee',
  'FL:fort myers':               'Lee',
  'FL:cape coral':               'Lee',
  'FL:naples':                   'Collier',
  'FL:daytona beach':            'Volusia',
  'FL:port st. lucie':           'St. Lucie',
  'FL:port saint lucie':         'St. Lucie',
  'FL:palm bay':                 'Brevard',
  'FL:melbourne':                'Brevard',
  'FL:lakeland':                 'Polk',

  // ── Texas ──────────────────────────────────────────────────────────────────
  'TX:dallas':                   'Dallas',
  'TX:irving':                   'Dallas',
  'TX:garland':                  'Dallas',
  'TX:richardson':               'Dallas',
  'TX:mesquite':                 'Dallas',
  'TX:grand prairie':            'Dallas',
  'TX:carrollton':               'Dallas',
  'TX:farmers branch':           'Dallas',
  'TX:desoto':                   'Dallas',
  'TX:duncanville':              'Dallas',
  'TX:lancaster':                'Dallas',
  'TX:cedar hill':               'Dallas',
  'TX:fort worth':               'Tarrant',
  'TX:arlington':                'Tarrant',
  'TX:mansfield':                'Tarrant',
  'TX:burleson':                 'Tarrant',
  'TX:euless':                   'Tarrant',
  'TX:bedford':                  'Tarrant',
  'TX:hurst':                    'Tarrant',
  'TX:north richland hills':     'Tarrant',
  'TX:plano':                    'Collin',
  'TX:frisco':                   'Collin',
  'TX:mckinney':                 'Collin',
  'TX:allen':                    'Collin',
  'TX:houston':                  'Harris',
  'TX:pasadena':                 'Harris',
  'TX:baytown':                  'Harris',
  'TX:sugar land':               'Fort Bend',
  'TX:stafford':                 'Fort Bend',
  'TX:missouri city':            'Fort Bend',
  'TX:pearland':                 'Brazoria',
  'TX:austin':                   'Travis',
  'TX:san antonio':              'Bexar',
  'TX:el paso':                  'El Paso',
  'TX:lubbock':                  'Lubbock',
  'TX:amarillo':                 'Potter',

  // ── Georgia ────────────────────────────────────────────────────────────────
  'GA:atlanta':                  'Fulton',
  'GA:sandy springs':            'Fulton',
  'GA:roswell':                  'Fulton',
  'GA:alpharetta':               'Fulton',
  'GA:johns creek':              'Fulton',
  'GA:college park':             'Fulton',
  'GA:east point':               'Fulton',
  'GA:union city':               'Fulton',
  'GA:decatur':                  'DeKalb',
  'GA:dunwoody':                 'DeKalb',
  'GA:brookhaven':               'DeKalb',
  'GA:stone mountain':           'DeKalb',
  'GA:lithonia':                 'DeKalb',
  'GA:tucker':                   'DeKalb',
  'GA:clarkston':                'DeKalb',
  'GA:marietta':                 'Cobb',
  'GA:smyrna':                   'Cobb',
  'GA:kennesaw':                 'Cobb',
  'GA:acworth':                  'Cobb',
  'GA:powder springs':           'Cobb',
  'GA:lawrenceville':            'Gwinnett',
  'GA:duluth':                   'Gwinnett',
  'GA:norcross':                 'Gwinnett',
  'GA:peachtree city':           'Fayette',
  'GA:savannah':                 'Chatham',
  'GA:augusta':                  'Richmond',
  'GA:columbus':                 'Muscogee',
  'GA:macon':                    'Bibb',
};

/**
 * Derive county from city name + state code.
 *
 * Priority:
 * 1. Explicit county string passed in (from deal record or user override)
 * 2. CITY_TO_COUNTY lookup
 * 3. null (let ruleset handle via its own city-detection fallback)
 */
export function deriveCounty(city: string | null, state: string): string | null {
  if (!city) return null;
  const key = `${state.toUpperCase().trim()}:${city.toLowerCase().trim()}`;
  return CITY_TO_COUNTY[key] ?? null;
}

/**
 * resolveRulesetStack — PRIMARY three-layer resolver.
 *
 * Returns { federal, state, county, jurisdictionMapped } per spec §7 composition rules.
 *
 * Composition in taxService.forecast():
 *   - county overlay (if present): annualPropertyTax() millage; countySurtax()
 *   - state:   acquisitionTransferTax(), TPP, cap logic, stateIncomeTaxRate()
 *   - federal: Section C (depreciation, bonus dep, federal income tax)
 */
export function resolveRulesetStack(state: string, county: string | null): RulesetStack {
  const stateKey = (state ?? '').toUpperCase().trim();
  const stateRuleset: TaxRuleset = STATE_RULESETS[stateKey] ?? defaultRuleset;
  const jurisdictionMapped = stateRuleset !== defaultRuleset;

  let countyRuleset: CountyOverlayRuleset | null = null;
  if (county && stateKey) {
    const countyKey = `${stateKey}-${county.trim()}`;
    countyRuleset = COUNTY_RULESETS[countyKey] ?? null;
  }

  return {
    federal: federalRuleset,
    state: stateRuleset,
    county: countyRuleset,
    jurisdictionMapped,
  };
}

/**
 * resolveRuleset — legacy single-ruleset API.
 * Returns the county overlay when registered, else the state ruleset, else default.
 * Retained for callers that don't yet use the full three-layer stack.
 */
export function resolveRuleset(state: string, county?: string | null): TaxRuleset {
  const stack = resolveRulesetStack(state, county ?? null);
  return stack.county ?? stack.state;
}
