/**
 * Per-Asset-Class Signal Adapters — M08 v2
 *
 * Spec reference: M08 Rebuild Spec v2 Section 4.1
 *
 * Each asset class reads demand/supply/momentum/position/risk from
 * DIFFERENT source signals. This file provides the adapter interface
 * and per-class implementations so scoring can swap adapters cleanly
 * when new data sources land.
 *
 * IMPLEMENTATION STATUS:
 *  ✅ Multifamily — fully wired to available deal data fields
 *  ⚠️  SFR — stub; real inputs pending SFR-specific data fields (TODO #M08-SA-01)
 *  ⚠️  Retail — stub; foot traffic index, anchor health pending M05 (TODO #M08-SA-02)
 *  ⚠️  Office — stub; tenant rollover schedule pending M05 (TODO #M08-SA-03)
 *  ⚠️  Industrial — stub; clear-height demand index pending M05 (TODO #M08-SA-04)
 *  ⚠️  Hospitality — stub; ADR/RevPAR data pending M05 (TODO #M08-SA-05)
 */

import { AssetClass } from './asset-class-detection.service';

// ─── Shared adapter output ─────────────────────────────────────────────────────

export interface SignalAdapterOutput {
  /** 0-100: demand pressure (higher = better for acquisition) */
  demand: number;
  /** 0-100: supply constraint (higher = more constrained = better) */
  supply: number;
  /** 0-100: market momentum (positive = favorable) */
  momentum: number;
  /** 0-100: deal/asset competitive position vs submarket */
  position: number;
  /** 0-100: risk-adjusted score (higher = lower risk) */
  risk: number;

  /** Which inputs were available vs. defaulted */
  dataAvailability: Record<keyof Omit<SignalAdapterOutput, 'dataAvailability' | 'notes'>, 'live' | 'default'>;

  /** Human-readable notes on why defaults were used */
  notes: string[];
}

// ─── Multifamily Adapter (WIRED) ──────────────────────────────────────────────
//
// Demand: loss-to-lease (rent demand vs market), demand_score, absorption signals
// Supply: supply_pressure or inverse vacancy
// Momentum: rent growth trend, deal traffic
// Position: ops_score (PCS rank), occupancy vs submarket
// Risk: DSCR, insurance exposure flag, environmental signals

function mfAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  // DEMAND: loss-to-lease indicates under-market rents = latent demand
  let demand: number;
  const lossToLease = Number(d.loss_to_lease || d.lossToLease || 0);
  const demandRaw = Number(d.demand_strength_score || d.demand_score || scores.demand || 0);
  if (demandRaw > 0) {
    demand = Math.min(100, demandRaw);
    avail.demand = 'live';
  } else if (lossToLease > 0) {
    // Loss-to-lease > 10% suggests strong rental demand; scale 0.03→55 to 0.15→80
    demand = Math.min(100, 50 + lossToLease * 300);
    avail.demand = 'live';
  } else {
    demand = 55;
    notes.push('demand: no demand_score or loss_to_lease; using submarket default 55');
  }

  // SUPPLY: inverse of supply pressure (lower pressure = more constrained = higher score)
  let supply: number;
  const supplyPressure = Number(d.supply_pressure || 0);
  const supplyBalance = Number(d.supply_balance_score || scores.supply || 0);
  if (supplyBalance > 0) {
    supply = Math.min(100, supplyBalance);
    avail.supply = 'live';
  } else if (supplyPressure > 0) {
    supply = Math.min(100, 100 - supplyPressure);
    avail.supply = 'live';
  } else {
    supply = 55;
    notes.push('supply: no supply signal available; using default 55');
  }

  // MOMENTUM: rent growth trend, absorption
  let momentum: number;
  const rentGrowth = Number(d.rent_growth_yoy || d.market_rent_growth || 0);
  const momentumRaw = Number(scores.momentum || 0);
  if (momentumRaw > 0) {
    momentum = Math.min(100, momentumRaw);
    avail.momentum = 'live';
  } else if (rentGrowth !== 0) {
    // 5% growth → 65; 10% → 80; flat → 50; -5% → 35
    momentum = Math.min(100, Math.max(0, 50 + rentGrowth * 300));
    avail.momentum = 'live';
  } else {
    momentum = 50;
    notes.push('momentum: no rent growth trend available; using default 50');
  }

  // POSITION: PCS/ops score indicates asset position vs submarket peers
  let position: number;
  const opsScore = Number(d.ops_score || d.pcs_score || 0);
  const positionRaw = Number(scores.position || 0);
  if (positionRaw > 0) {
    position = Math.min(100, positionRaw);
    avail.position = 'live';
  } else if (opsScore > 0) {
    // Ops score IS the position score — direct mapping
    position = Math.min(100, opsScore);
    avail.position = 'live';
  } else {
    position = 50;
    notes.push('position: no ops_score / PCS rank available; using default 50');
  }

  // RISK: DSCR, insurance exposure, environmental flags
  let risk: number;
  const dscr = Number(d.dscr || 0);
  const riskRaw = Number(scores.risk || 0);
  const envFlag = d.environmental_flag === true;
  const insuranceFlag = d.insurance_non_renewable === true;
  if (riskRaw > 0) {
    risk = Math.min(100, riskRaw);
    avail.risk = 'live';
  } else if (dscr > 0) {
    // DSCR 1.30 → 75 (good); 1.0 → 40 (tight); 0.8 → 20 (distressed)
    const dscrScore = Math.min(100, Math.max(0, (dscr - 0.8) * 200));
    risk = envFlag ? dscrScore * 0.80 : insuranceFlag ? dscrScore * 0.85 : dscrScore;
    avail.risk = 'live';
  } else {
    risk = 50;
    notes.push('risk: no DSCR available; using default 50');
    if (envFlag) { risk = 35; notes.push('risk: environmental flag detected — penalized to 35'); }
    if (insuranceFlag) { risk = Math.min(risk, 40); notes.push('risk: insurance non-renewable flag detected'); }
  }

  return {
    demand: parseFloat(demand.toFixed(1)),
    supply: parseFloat(supply.toFixed(1)),
    momentum: parseFloat(momentum.toFixed(1)),
    position: parseFloat(position.toFixed(1)),
    risk: parseFloat(risk.toFixed(1)),
    dataAvailability: avail,
    notes,
  };
}

// ─── SFR Adapter — STUB (TODO #M08-SA-01) ─────────────────────────────────────
//
// Real inputs needed (not yet in DB schema):
//   Demand: sfr_rent_comp_absorption, school_rating_trend, owner_occupant_demand_index
//   Supply: sfr_permit_count_ytd, btr_subdivision_pipeline_units
//   Momentum: sfr_dom_trend (days on market trend), flip_margin_trend
//   Position: school_rating, lot_size_vs_submarket, street_appeal_score
//   Risk: fl_sfr_insurance_premium, hoa_str_restriction, flood_zone
//
// Until SFR-specific data fields land, we return structured defaults with explicit notes.

function sfrAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes = [
    'SFR adapter: data fields pending (TODO #M08-SA-01). Returning structured defaults.',
    'Real inputs needed: sfr_permit_count_ytd, sfr_dom_trend, school_rating, owner_occupant_demand_index',
  ];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  // Apply any scores present in deal_data as partial wires
  const demand   = Number(scores.demand   || d.demand_score   || 55);
  const supply   = Number(scores.supply   || d.supply_score   || 55);
  const momentum = Number(scores.momentum || d.momentum_score || 50);
  const position = Number(scores.position || d.position_score || 50);
  const risk     = Number(scores.risk     || d.risk_score     || 50);

  if (d.demand_score)   avail.demand   = 'live';
  if (d.supply_score)   avail.supply   = 'live';
  if (d.momentum_score) avail.momentum = 'live';
  if (d.position_score) avail.position = 'live';
  if (d.risk_score)     avail.risk     = 'live';

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Retail Adapter — STUB (TODO #M08-SA-02) ──────────────────────────────────
//
// Real inputs needed (not yet in DB schema / M05 data):
//   Demand: trade_area_hh_income, anchor_tenant_health_index, foot_traffic_index
//   Supply: inline_vacancy_pct, shadow_space_sf, shadow_vacancy_pct
//   Momentum: sales_per_sf_trend, co_tenancy_health, rent_per_sf_vs_market
//   Position: anchor_credit_rating, lease_term_remaining_years
//   Risk: co_tenancy_clause_exposure, anchor_credit_watch_flag

function retailAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes = [
    'Retail adapter: foot traffic index, anchor health, co-tenancy data pending M05 (TODO #M08-SA-02).',
    'Partial wires: vacancy, tenant_credit_rating when available.',
  ];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  let demand   = Number(scores.demand   || 55);
  let supply   = Number(scores.supply   || 55);
  const momentum = Number(scores.momentum || d.rent_growth_yoy ? Math.min(100, 50 + Number(d.rent_growth_yoy) * 300) : 50);
  let position = Number(scores.position || 50);
  let risk     = Number(scores.risk     || 50);

  // Partial wires for fields that exist
  const vacancy = Number(d.vacancy || d.vacancy_rate || -1);
  if (vacancy >= 0) {
    supply = Math.min(100, 100 - vacancy * 300); // vacancy 0% → 100, 30% → 10
    avail.supply = 'live';
  }

  const tenantCredit = d.tenant_credit_rating || '';
  if (tenantCredit) {
    position = /AAA|AA|A\b/i.test(tenantCredit) ? 85 : /BBB/i.test(tenantCredit) ? 70 : /BB|B\b/i.test(tenantCredit) ? 45 : 35;
    risk     = /AAA|AA|A\b/i.test(tenantCredit) ? 80 : /BBB/i.test(tenantCredit) ? 65 : 35;
    avail.position = 'live';
    avail.risk     = 'live';
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Office Adapter — STUB (TODO #M08-SA-03) ──────────────────────────────────
//
// Real inputs needed:
//   Demand: tenant_absorption_sf_ytd, medical_adjacency_score, hybrid_work_demand_index
//   Supply: submarket_vacancy_pct, pipeline_sf_delivering_12mo
//   Momentum: tenant_rollover_pct_24mo, new_leases_signed_ytd
//   Position: floor_plate_sf, mullion_spacing_in, building_class
//   Risk: structural_vacancy_risk_score, capex_per_sf_to_compete

function officeAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes = [
    'Office adapter: tenant absorption, pipeline SF, mullion spacing pending M05 (TODO #M08-SA-03).',
    'Partial wires: vacancy, floor_plate_sf when available.',
  ];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  let demand   = Number(scores.demand   || 45); // office demand structurally below pre-2020
  let supply   = Number(scores.supply   || 40); // office supply generally elevated
  const momentum = Number(scores.momentum || 40);
  let position = Number(scores.position || 50);
  const risk   = Number(scores.risk     || 40); // structural office vacancy is a macro risk

  const vacancy = Number(d.vacancy || d.vacancy_rate || -1);
  if (vacancy >= 0) {
    supply = Math.min(100, 100 - vacancy * 200);
    demand = Math.min(100, Math.max(0, 60 - vacancy * 150));
    avail.supply = 'live';
    avail.demand = 'live';
  }

  const floorPlate = Number(d.floor_plate_sf || 0);
  if (floorPlate > 0) {
    position = floorPlate < 12_000 ? 70 : floorPlate < 20_000 ? 55 : 40; // smaller plate = more adaptable
    avail.position = 'live';
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Industrial Adapter — STUB (TODO #M08-SA-04) ──────────────────────────────
//
// Real inputs needed:
//   Demand: ecommerce_penetration_pct, port_activity_index, pop_within_10mi
//   Supply: industrial_deliveries_sf_12mo, ios_availability_pct
//   Momentum: clear_height_demand_trend, last_mile_lease_velocity
//   Position: clear_height_ft, truck_court_depth_ft, dock_count
//   Risk: zoning_compatibility_score, rail_access

function industrialAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes = [
    'Industrial adapter: e-commerce index, port activity, IOS availability pending M05 (TODO #M08-SA-04).',
    'Partial wires: clear_height_ft, population_within_10mi when available.',
  ];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  let demand   = Number(scores.demand   || 65); // industrial demand strong in current cycle
  const supply   = Number(scores.supply   || 60); // industrial supply constrained in most markets
  const momentum = Number(scores.momentum || 60);
  let position = Number(scores.position || 55);
  const risk   = Number(scores.risk     || 65); // industrial low risk in current cycle

  const popWithin10mi = Number(d.population_within_10mi || 0);
  if (popWithin10mi > 0) {
    demand = Math.min(100, 50 + Math.log10(popWithin10mi) * 12);
    avail.demand = 'live';
  }

  const clearHeight = Number(d.clear_height_ft || 0);
  if (clearHeight > 0) {
    position = clearHeight >= 32 ? 90 : clearHeight >= 24 ? 75 : clearHeight >= 18 ? 55 : 35;
    avail.position = 'live';
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Hospitality Adapter — STUB (TODO #M08-SA-05) ─────────────────────────────
//
// Real inputs needed:
//   Demand: adr_trajectory_yoy, revpar_vs_market, flag_performance_index
//   Supply: str_permit_trends, flag_pipeline_count
//   Momentum: flag_performance_vs_pip_standard, renovation_age
//   Position: brand_tier_rank, pip_cost_estimate
//   Risk: pip_feasibility_score, franchise_opportunity_available

function hospitalityAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes = [
    'Hospitality adapter: ADR trajectory, RevPAR, PIP estimate pending M05 (TODO #M08-SA-05).',
    'Partial wires: adr, comp_adr when available.',
  ];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  let demand   = Number(scores.demand   || 55);
  const supply   = Number(scores.supply   || 55);
  let momentum = Number(scores.momentum || 50);
  let position = Number(scores.position || 50);
  const risk   = Number(scores.risk     || 50);

  const adr = Number(d.adr || 0);
  const compAdr = Number(d.comp_adr || 0);
  if (adr > 0 && compAdr > 0) {
    const adrRatio = adr / compAdr;
    demand   = Math.min(100, 50 + adrRatio * 30);
    momentum = adrRatio > 1.05 ? 70 : adrRatio > 0.95 ? 55 : 35;
    position = Math.min(100, adrRatio * 70);
    avail.demand = 'live';
    avail.momentum = 'live';
    avail.position = 'live';
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function getSignalAdapter(assetClass: AssetClass, deal: Record<string, any>): SignalAdapterOutput {
  const d = deal.deal_data || {};
  const triage = deal.triage_result || {};
  const scores = d.scores || triage.scores || {};

  switch (assetClass) {
    case 'multifamily': return mfAdapter(d, scores);
    case 'sfr':         return sfrAdapter(d, scores);
    case 'retail':      return retailAdapter(d, scores);
    case 'office':      return officeAdapter(d, scores);
    case 'industrial':  return industrialAdapter(d, scores);
    case 'hospitality': return hospitalityAdapter(d, scores);
    default:            return mfAdapter(d, scores); // safe fallback to MF adapter
  }
}
