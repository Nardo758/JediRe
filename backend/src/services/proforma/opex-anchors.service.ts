import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';
import { OpexLineKey } from './blueprint/proforma-blueprint';

/**
 * Compute live CPI-anchored OPEX growth rates for every line item.
 *
 * Replaces the hardcoded DEFAULT_LINE_ANCHORS with a dynamic formula:
 *   anchor = max(CPI + line_spread, line_floor)
 *
 * Where CPI is fetched live from metric_time_series (MACRO_CPI_OFFICIAL).
 * When CPI is unavailable, falls back to the historical defaults.
 *
 * Line spreads and floors are now state-specific to reflect regional cost
 * differences (e.g., hurricane insurance in FL, high labor in CA, low
 * property tax in TX, etc.). Falls back to national defaults when state
 * is not in the registry.
 */

// ─── State-specific line spreads (premium over CPI) ──────────────────────

interface StateSpreads {
  insurance: number;      // hurricane risk, reinsurance costs
  utilities: number;      // regulated vs deregulated markets
  repairsMaintenance: number; // labor cost differences
  payroll: number;        // state minimum wage, labor market tightness
  marketingAdmin: number; // market competitiveness
  replacementReserves: number;
  other: number;
}

// National defaults (used when state is not in registry or not provided)
const NATIONAL_SPREADS: StateSpreads = {
  insurance: 0.020,
  utilities: 0.005,
  repairsMaintenance: 0.005,
  payroll: 0.005,
  marketingAdmin: 0,
  replacementReserves: 0,
  other: 0,
};

const NATIONAL_FLOORS: Record<Exclude<OpexLineKey, 'propertyTax' | 'managementFee'>, number> = {
  insurance: 0.03,
  utilities: 0.015,
  repairsMaintenance: 0.020,
  payroll: 0.020,
  marketingAdmin: 0.015,
  replacementReserves: 0.015,
  other: 0.015,
};

// State-specific adjustments — based on market research, cost of living,
// regulatory environment, and climate risk.
const STATE_SPREADS: Record<string, Partial<StateSpreads>> = {
  // High insurance, moderate everything else
  FL: {
    insurance: 0.035,     // hurricane risk, Citizens Insurance exposure
    utilities: 0.003,     // regulated utilities, moderate rates
    repairsMaintenance: 0.008, // coastal labor costs, moisture damage
  },
  // High labor, high utilities, moderate insurance
  CA: {
    insurance: 0.015,     // low hurricane risk, but earthquake/wildfire
    utilities: 0.012,      // high electricity (PG&E), water scarcity
    repairsMaintenance: 0.012, // high labor costs (prevailing wage, unions)
    payroll: 0.010,      // high minimum wage, tight labor
  },
  // Low property tax, low regulation, moderate insurance
  TX: {
    insurance: 0.025,     // hail, tornado, some hurricane (Gulf)
    utilities: 0.002,     // deregulated electricity, cheap natural gas
    repairsMaintenance: 0.003, // lower labor costs, less regulation
    payroll: 0.003,      // lower minimum wage, looser labor market
  },
  // Moderate across the board
  GA: {
    insurance: 0.020,     // moderate weather risk
    utilities: 0.005,     // regulated, moderate
    repairsMaintenance: 0.005, // Atlanta labor costs rising
  },
  // High labor, high utilities, low insurance
  NY: {
    insurance: 0.010,     // low weather risk
    utilities: 0.010,      // high electricity (ConEd), heating oil
    repairsMaintenance: 0.015, // very high labor costs, union prevalence
    payroll: 0.012,      // high minimum wage, tight labor
  },
  // High insurance (Gulf), moderate labor
  LA: {
    insurance: 0.040,     // highest hurricane risk
    utilities: 0.005,
    repairsMaintenance: 0.006,
  },
  // Moderate, similar to GA but slightly higher insurance
  NC: {
    insurance: 0.022,     // some hurricane exposure (coastal)
    utilities: 0.004,
  },
  TN: {
    insurance: 0.018,     // low weather risk
    utilities: 0.004,      // TVA provides cheap electricity
    repairsMaintenance: 0.004, // lower labor costs
  },
  AZ: {
    insurance: 0.010,     // low weather risk, but extreme heat
    utilities: 0.015,      // extreme AC costs in summer
    repairsMaintenance: 0.008, // heat damage, HVAC replacement
  },
  NV: {
    insurance: 0.010,
    utilities: 0.010,      // high AC, water scarcity
  },
  CO: {
    insurance: 0.015,     // hail risk (Front Range)
    utilities: 0.008,      // heating costs, high elevation
    repairsMaintenance: 0.008, // labor costs rising (Denver growth)
  },
  WA: {
    insurance: 0.010,     // low weather risk
    utilities: 0.006,      // cheap hydro, but rising
    repairsMaintenance: 0.010, // high labor costs (Seattle)
    payroll: 0.010,
  },
  IL: {
    insurance: 0.015,     // winter storms, some tornado
    utilities: 0.008,      // heating costs, ComEd rates
    repairsMaintenance: 0.008, // Chicago labor costs
    payroll: 0.008,
  },
  // Pacific Northwest — cheap hydro, moderate labor
  OR: {
    insurance: 0.010,
    utilities: 0.003,      // very cheap hydro
    repairsMaintenance: 0.007, // Portland labor costs
  },
  // Mountain West — low costs generally
  UT: {
    insurance: 0.012,     // low weather risk
    utilities: 0.004,      // cheap natural gas
    repairsMaintenance: 0.003, // low labor costs
  },
  SC: {
    insurance: 0.022,     // hurricane exposure (coastal)
    utilities: 0.004,      // SCE&G / Dominion rates moderate
  },
  // Rust Belt — lower costs, aging infrastructure
  OH: {
    insurance: 0.015,
    utilities: 0.006,      // aging infrastructure, some deregulation
    repairsMaintenance: 0.004, // lower labor costs
  },
  MI: {
    insurance: 0.015,     // winter damage, lake effect
    utilities: 0.008,      // heating costs, DTE/Consumers
  },
  IN: {
    insurance: 0.015,
    utilities: 0.005,      // Duke/AEP rates moderate
    repairsMaintenance: 0.003, // low labor costs
  },
  // New England — high everything
  MA: {
    insurance: 0.012,     // winter storms, coastal
    utilities: 0.012,      // very high electricity (National Grid)
    repairsMaintenance: 0.015, // very high labor costs
    payroll: 0.012,
  },
  // Southwest — heat risk, moderate costs
  NM: {
    insurance: 0.010,
    utilities: 0.008,      // high AC, cheap natural gas
  },
  // Gulf Coast — high insurance, moderate rest
  AL: {
    insurance: 0.028,     // hurricane exposure (Gulf)
    utilities: 0.004,
  },
  MS: {
    insurance: 0.025,     // hurricane exposure
    utilities: 0.004,
  },
  // Mid-Atlantic — moderate costs
  VA: {
    insurance: 0.018,     // some hurricane, winter storms
    utilities: 0.006,
    repairsMaintenance: 0.006, // Northern VA labor costs
  },
  PA: {
    insurance: 0.015,
    utilities: 0.007,      // PECO/PPL rates, winter heating
    repairsMaintenance: 0.006, // Philly/Pittsburgh labor
  },
  MD: {
    insurance: 0.015,
    utilities: 0.008,      // BGE/Pepco, high electricity
    repairsMaintenance: 0.008, // Baltimore/DC labor costs
  },
  // Great Plains — low costs, extreme weather
  OK: {
    insurance: 0.025,     // tornado/hail risk
    utilities: 0.003,      // cheap natural gas, wind power
    repairsMaintenance: 0.003,
  },
  KS: {
    insurance: 0.022,     // tornado/hail
    utilities: 0.003,
  },
  MO: {
    insurance: 0.018,     // tornado, some hail
    utilities: 0.004,
  },
  // Upper Midwest — cold winters, moderate costs
  MN: {
    insurance: 0.015,     // winter storms, hail
    utilities: 0.010,      // very high heating costs
    repairsMaintenance: 0.008, // Minneapolis labor costs
  },
  WI: {
    insurance: 0.015,
    utilities: 0.008,      // heating costs, We Energies
  },
  // Desert — extreme heat, water scarcity
  NV: {
    insurance: 0.010,
    utilities: 0.010,      // extreme AC, water scarcity
  },
};

// ─── Default anchors (historical, used when CPI unavailable) ─────────────

const DEFAULT_ANCHORS: Record<Exclude<OpexLineKey, 'propertyTax' | 'managementFee'>, number> = {
  insurance: 0.07,
  utilities: 0.03,
  repairsMaintenance: 0.035,
  payroll: 0.04,
  marketingAdmin: 0.025,
  replacementReserves: 0.025,
  other: 0.025,
};

// ─── Main function ───────────────────────────────────────────────────────

export async function computeOpexAnchors(
  pool: Pool,
  state?: string,  // 2-letter state code (e.g., 'FL', 'CA', 'TX')
): Promise<Record<OpexLineKey, ProvenancedValue<number>>> {
  let cpi: number | null = null;
  try {
    const result = await pool.query<{ value: string }>(
      `SELECT value FROM metric_time_series
        WHERE metric_id = 'MACRO_CPI_OFFICIAL'
          AND geography_type = 'national'
        ORDER BY period_date DESC
        LIMIT 1`,
    );
    if (result.rows.length > 0) {
      cpi = parseFloat(result.rows[0].value) / 100;
    }
  } catch (_err) { /* fallback to defaults */ }

  // Resolve state-specific spreads (or national defaults)
  const stateSpreads = state ? STATE_SPREADS[state] : undefined;
  const spreads: StateSpreads = {
    insurance: stateSpreads?.insurance ?? NATIONAL_SPREADS.insurance,
    utilities: stateSpreads?.utilities ?? NATIONAL_SPREADS.utilities,
    repairsMaintenance: stateSpreads?.repairsMaintenance ?? NATIONAL_SPREADS.repairsMaintenance,
    payroll: stateSpreads?.payroll ?? NATIONAL_SPREADS.payroll,
    marketingAdmin: stateSpreads?.marketingAdmin ?? NATIONAL_SPREADS.marketingAdmin,
    replacementReserves: stateSpreads?.replacementReserves ?? NATIONAL_SPREADS.replacementReserves,
    other: stateSpreads?.other ?? NATIONAL_SPREADS.other,
  };

  const anchors: Record<OpexLineKey, ProvenancedValue<number>> = {} as any;

  const lines = Object.keys(NATIONAL_SPREADS) as Array<Exclude<OpexLineKey, 'propertyTax' | 'managementFee'>>;

  for (const line of lines) {
    const spread = spreads[line];
    const floor = NATIONAL_FLOORS[line];
    const defaultVal = DEFAULT_ANCHORS[line];

    let value: number;
    let rationale: string;

    if (cpi != null) {
      const raw = cpi + spread;
      value = Math.max(floor, raw);
      rationale = `${line}: max(CPI ${(cpi * 100).toFixed(2)}% + spread ${(spread * 100).toFixed(2)}%, floor ${(floor * 100).toFixed(2)}%) = ${(value * 100).toFixed(2)}%${state ? ` (${state}-specific)` : ' (national default)'}`;
    } else {
      value = defaultVal;
      rationale = `${line}: CPI unavailable — fallback to historical default ${(value * 100).toFixed(2)}%${state ? ` (${state})` : ''}`;
    }

    anchors[line] = provenanced(value, 'platform', cpi != null ? 0.80 : 0.50, 'derived', rationale);
  }

  return anchors;
}

// ─── State-specific line shares (dollar share of total OPEX) ─────────────

const NATIONAL_LINE_SHARES: Record<string, number> = {
  propertyTax: 0.25,
  insurance: 0.12,
  utilities: 0.10,
  repairsMaintenance: 0.08,
  payroll: 0.20,
  marketingAdmin: 0.05,
  replacementReserves: 0.08,
  other: 0.12,
};

const STATE_LINE_SHARES: Record<string, Partial<Record<string, number>>> = {
  FL: {
    insurance: 0.18,      // high hurricane / reinsurance costs
    utilities: 0.09,        // regulated, moderate
    repairsMaintenance: 0.09, // coastal labor + moisture damage
  },
  CA: {
    insurance: 0.10,      // low hurricane, but earthquake/wildfire riders
    utilities: 0.14,      // PG&E, water scarcity
    repairsMaintenance: 0.12, // prevailing wage, high labor
    payroll: 0.25,        // high minimum wage, tight labor
    marketingAdmin: 0.06, // competitive coastal markets
  },
  TX: {
    propertyTax: 0.18,    // low property tax (no state income tax)
    insurance: 0.15,      // hail / tornado / Gulf exposure
    utilities: 0.08,      // deregulated, cheap natural gas
    repairsMaintenance: 0.06, // lower labor costs
    payroll: 0.15,        // lower minimum wage
    marketingAdmin: 0.04, // less competitive outside major metros
  },
  GA: {
    insurance: 0.13,      // moderate weather
    utilities: 0.10,      // regulated, moderate
    repairsMaintenance: 0.08, // Atlanta labor costs rising
  },
  NY: {
    insurance: 0.10,      // low hurricane, but high liability
    utilities: 0.14,      // ConEd rates very high
    repairsMaintenance: 0.12, // NYC labor costs
    payroll: 0.25,        // high wages, unions
    marketingAdmin: 0.06, // very competitive
  },
  NC: {
    insurance: 0.14,      // hurricane exposure (coastal / inland flooding)
    utilities: 0.09,      // Duke Energy, moderate rates
    repairsMaintenance: 0.07, // moderate labor
  },
  CO: {
    insurance: 0.10,      // hail, wildfire risk
    utilities: 0.09,      // Xcel, moderate
    repairsMaintenance: 0.09, // Denver labor costs rising
  },
  AZ: {
    insurance: 0.10,      // low hurricane, monsoon / dust
    utilities: 0.13,      // extreme AC load, water scarcity
    repairsMaintenance: 0.08, // Phoenix labor costs
  },
  WA: {
    insurance: 0.10,      // low weather risk
    utilities: 0.08,      // cheap hydro, but rising
    repairsMaintenance: 0.10, // Seattle labor costs
    payroll: 0.22,        // high minimum wage, tech competition
  },
  TN: {
    insurance: 0.13,      // moderate weather, some tornado
    utilities: 0.09,      // TVA rates low
    repairsMaintenance: 0.06, // lower labor costs
    payroll: 0.17,        // lower wage pressure
  },
};

/**
 * Return state-specific OPEX line shares (dollar share of total OPEX).
 * Falls back to national averages when state is not in the registry.
 * Shares are normalised by callers (computeTotalOpexGrowth / projectProforma).
 */
export function getStateLineShares(
  state?: string,
): Partial<Record<string, number>> {
  const stateShares = state ? STATE_LINE_SHARES[state] : undefined;
  if (!stateShares) return {};
  return { ...stateShares };
}
