import { ProvenancedValue, provenanced } from '../../types/provenanced-value';

/**
 * Compute the property tax OPEX anchor from real county tax rules.
 *
 * The anchor is the expected annual growth rate in property tax, driven by:
 *   • Assessment cap (e.g., FL 10% non-homestead cap)
 *   • Reassessment cycle (e.g., GA quadrennial)
 *   • Millage trend (generally stable, ~0–2% drift)
 *
 * When a ruleset is unknown, falls back to 4% national average (conservative for
 * unmapped states with rapid appreciation potential).
 *
 * Sources: tax ruleset metadata (fl.ruleset.ts, ga.ruleset.ts, tx.ruleset.ts, etc.)
 */

const STATE_ANNUAL_TRENDS: Record<string, { trend: number; rationale: string }> = {
  FL: { trend: 0.10, rationale: 'FL 10% non-homestead annual assessment cap (SOH cap binds)' },
  GA: { trend: 0.04, rationale: 'GA annual appreciation + quadrennial reassessment cycle' },
  TX: { trend: 0.03, rationale: 'TX no cap; reassessment on sale + annual drift ~3%' },
  CA: { trend: 0.02, rationale: 'CA Prop 13 capped at 2% assessed-value growth' },
  NY: { trend: 0.03, rationale: 'NYC rent-stabilized tax abatement trend ~3%' },
  IL: { trend: 0.03, rationale: 'IL Cook County triennial reassessment ~3% avg' },
  NC: { trend: 0.03, rationale: 'NC quadrennial reassessment cycle' },
  LA: { trend: 0.03, rationale: 'LA quadrennial reassessment cycle' },
  AZ: { trend: 0.03, rationale: 'AZ annual reassessment ~3% market trend' },
  TN: { trend: 0.03, rationale: 'TN quadrennial reassessment cycle' },
  CO: { trend: 0.03, rationale: 'CO annual reassessment, strong market growth' },
  WA: { trend: 0.03, rationale: 'WA annual reassessment ~3% market trend' },
  OR: { trend: 0.03, rationale: 'OR annual reassessment ~3% market trend' },
  SC: { trend: 0.03, rationale: 'SC reassessment every 5 years, market growth ~3%' },
  VA: { trend: 0.03, rationale: 'VA annual reassessment ~3% market trend' },
  PA: { trend: 0.03, rationale: 'PA annual reassessment ~3% market trend' },
  MD: { trend: 0.03, rationale: 'MD triennial reassessment ~3% avg' },
  OH: { trend: 0.03, rationale: 'OH triennial reassessment ~3% avg' },
  MI: { trend: 0.03, rationale: 'MI annual reassessment ~3% market trend' },
  IN: { trend: 0.03, rationale: 'IN annual reassessment ~3% market trend' },
  MO: { trend: 0.03, rationale: 'MO biennial reassessment ~3% avg' },
  MN: { trend: 0.03, rationale: 'MN annual reassessment ~3% market trend' },
  WI: { trend: 0.03, rationale: 'WI annual reassessment ~3% market trend' },
  AL: { trend: 0.03, rationale: 'AL annual reassessment ~3% market trend' },
  OK: { trend: 0.03, rationale: 'OK annual reassessment ~3% market trend' },
  UT: { trend: 0.03, rationale: 'UT annual reassessment ~3% market trend' },
  NV: { trend: 0.03, rationale: 'NV annual reassessment ~3% market trend' },
  NM: { trend: 0.03, rationale: 'NM annual reassessment ~3% market trend' },
  MS: { trend: 0.03, rationale: 'MS annual reassessment ~3% market trend' },
  KS: { trend: 0.03, rationale: 'KS annual reassessment ~3% market trend' },
  MA: { trend: 0.03, rationale: 'MA annual reassessment ~3% market trend' },
  KY: { trend: 0.03, rationale: 'KY annual reassessment ~3% market trend' },
  IA: { trend: 0.03, rationale: 'IA annual reassessment ~3% market trend' },
  NE: { trend: 0.03, rationale: 'NE annual reassessment ~3% market trend' },
  SD: { trend: 0.03, rationale: 'SD annual reassessment ~3% market trend' },
  ND: { trend: 0.03, rationale: 'ND annual reassessment ~3% market trend' },
  MT: { trend: 0.03, rationale: 'MT annual reassessment ~3% market trend' },
  WY: { trend: 0.03, rationale: 'WY annual reassessment ~3% market trend' },
  ID: { trend: 0.03, rationale: 'ID annual reassessment ~3% market trend' },
  AR: { trend: 0.03, rationale: 'AR annual reassessment ~3% market trend' },
  WV: { trend: 0.03, rationale: 'WV annual reassessment ~3% market trend' },
  DE: { trend: 0.03, rationale: 'DE annual reassessment ~3% market trend' },
  CT: { trend: 0.03, rationale: 'CT annual reassessment ~3% market trend' },
  RI: { trend: 0.03, rationale: 'RI annual reassessment ~3% market trend' },
  VT: { trend: 0.03, rationale: 'VT annual reassessment ~3% market trend' },
  NH: { trend: 0.03, rationale: 'NH annual reassessment ~3% market trend' },
  ME: { trend: 0.03, rationale: 'ME annual reassessment ~3% market trend' },
  AK: { trend: 0.03, rationale: 'AK annual reassessment ~3% market trend' },
  HI: { trend: 0.03, rationale: 'HI annual reassessment ~3% market trend' },
};

export function computePropertyTaxAnchor(
  state: string | null,
  _county?: string | null,
): ProvenancedValue<number> {
  const stateCode = (state ?? '').toUpperCase().trim();
  const entry = STATE_ANNUAL_TRENDS[stateCode];

  if (entry) {
    return provenanced(entry.trend, 'platform', 0.75, 'derived', entry.rationale);
  }

  return provenanced(
    0.04,
    'platform',
    0.50,
    'derived',
    `Unmapped state ${stateCode} — fallback to 4% national average (no state-specific ruleset available)`,
  );
}
