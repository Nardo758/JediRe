import { ProvenancedValue, provenanced } from '../../types/provenanced-value';

/**
 * Compute the property tax OPEX anchor from real county tax rules.
 *
 * The anchor is the expected annual growth rate in property tax, driven by:
 *   • Assessment cap (e.g., FL 10% non-homestead cap)
 *   • Reassessment cycle (e.g., GA quadrennial)
 *   • Millage trend (generally stable, ~0–2% drift)
 *
 * When a ruleset is unknown, falls back to 4% (the historical placeholder).
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
    `Unmapped state ${stateCode} — fallback to 4% placeholder (calibration TBD)`,
  );
}
