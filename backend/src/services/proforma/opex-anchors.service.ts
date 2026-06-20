import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';
import { OpexLineKey } from '../blueprint/proforma-blueprint';

/**
 * Compute live CPI-anchored OPEX growth rates for every line item.
 *
 * Replaces the hardcoded DEFAULT_LINE_ANCHORS with a dynamic formula:
 *   anchor = max(CPI + line_spread, line_floor)
 *
 * Where CPI is fetched live from metric_time_series (MACRO_CPI_OFFICIAL).
 * When CPI is unavailable, falls back to the historical defaults.
 *
 * Line spreads reflect long-run premiums over general inflation:
 *   insurance: +200bps (reinsurance hardening, climate risk)
 *   utilities: +50bps (regulated pass-through lag)
 *   repairsMaintenance: +50bps (construction cost drift)
 *   payroll: +50bps (wage growth premium)
 *   marketingAdmin: +0bps
 *   replacementReserves: +0bps
 *   other: +0bps
 */

const LINE_SPREADS: Record<OpexLineKey, number> = {
  propertyTax: 0,        // handled separately by propertyTaxAnchor
  insurance: 0.020,
  utilities: 0.005,
  repairsMaintenance: 0.005,
  managementFee: 0,      // auto-couples to revenue
  payroll: 0.005,
  marketingAdmin: 0,
  replacementReserves: 0,
  other: 0,
};

const LINE_FLOORS: Record<OpexLineKey, number> = {
  propertyTax: 0.01,
  insurance: 0.03,
  utilities: 0.015,
  repairsMaintenance: 0.020,
  managementFee: 0,
  payroll: 0.020,
  marketingAdmin: 0.015,
  replacementReserves: 0.015,
  other: 0.015,
};

const DEFAULT_ANCHORS: Record<OpexLineKey, number> = {
  propertyTax: 0.04,
  insurance: 0.07,
  utilities: 0.03,
  repairsMaintenance: 0.035,
  managementFee: 0,
  payroll: 0.04,
  marketingAdmin: 0.025,
  replacementReserves: 0.025,
  other: 0.025,
};

export async function computeOpexAnchors(
  pool: Pool,
): Promise<Record<OpexLineKey, ProvenancedValue<number>>> {
  let cpi: number | null = null;
  try {
    const result = await pool.query<{ value: string }>(
      `SELECT value FROM metric_time_series
        WHERE metric_id = 'MACRO_CPI_OFFICIAL'
          AND geography_type = 'msa'
          AND geography_id = 'national'
        ORDER BY period_date DESC
        LIMIT 1`,
    );
    if (result.rows.length > 0) {
      cpi = parseFloat(result.rows[0].value) / 100;
    }
  } catch (_err) { /* fallback to defaults */ }

  const anchors: Record<OpexLineKey, ProvenancedValue<number>> = {} as any;

  for (const line of Object.keys(LINE_SPREADS) as OpexLineKey[]) {
    if (line === 'propertyTax') continue; // handled separately
    if (line === 'managementFee') continue; // auto-couples

    const spread = LINE_SPREADS[line];
    const floor = LINE_FLOORS[line];
    const defaultVal = DEFAULT_ANCHORS[line];

    let value: number;
    let rationale: string;

    if (cpi != null) {
      const raw = cpi + spread;
      value = Math.max(floor, raw);
      rationale = `${line}: max(CPI ${(cpi * 100).toFixed(2)}% + spread ${(spread * 100).toFixed(2)}%, floor ${(floor * 100).toFixed(2)}%) = ${(value * 100).toFixed(2)}%`;
    } else {
      value = defaultVal;
      rationale = `${line}: CPI unavailable — fallback to historical default ${(value * 100).toFixed(2)}%`;
    }

    anchors[line] = provenanced(value, 'platform', cpi != null ? 0.80 : 0.50, 'derived', rationale);
  }

  return anchors;
}
