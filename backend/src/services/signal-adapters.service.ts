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

// ─── SFR Adapter — PARTIAL WIRES (TODO #M08-SA-01) ───────────────────────────
//
// Wired signals (available in deal_data):
//   Demand:   arv_estimate vs acquisition_price (ARV gap / margin), demand_score
//   Supply:   sfr_permit_count_ytd (when present), supply_score
//   Momentum: days_on_market (DOM trend proxy), dom, flip_margin
//   Position: school_rating (1-10), lot_size_sf, property_condition
//   Risk:     flood_zone, insurance_premium_flag, rehab_scope_risk
//
// Full inputs pending SFR-specific DB fields (TODO #M08-SA-01).

function sfrAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  // DEMAND: ARV gap indicates investor demand (higher margin = stronger demand)
  let demand = Number(scores.demand || d.demand_score || 55);
  const arvEstimate = Number(d.arv_estimate || d.after_repair_value || 0);
  const acqPrice    = Number(d.acquisition_price || d.purchase_price || 0);
  if (arvEstimate > 0 && acqPrice > 0) {
    const arvMargin = (arvEstimate - acqPrice) / arvEstimate;
    // ARV margin > 30% → strong investor demand; 10% → moderate
    demand = Math.min(100, Math.max(0, 30 + arvMargin * 200));
    avail.demand = 'live';
  } else if (d.demand_score) {
    demand = Number(d.demand_score);
    avail.demand = 'live';
  } else {
    notes.push('demand: no arv_estimate or demand_score; TODO #M08-SA-01 for sfr_permit_count_ytd');
  }

  // SUPPLY: SFR permit count (inverse — fewer permits = more constrained = higher score)
  let supply = Number(scores.supply || d.supply_score || 55);
  const sfrPermits = Number(d.sfr_permit_count_ytd || 0);
  if (sfrPermits > 0) {
    supply = Math.min(100, Math.max(0, 80 - sfrPermits * 0.02)); // 0 permits → 80, 1000 → 60
    avail.supply = 'live';
  } else if (d.supply_score) {
    supply = Number(d.supply_score);
    avail.supply = 'live';
  } else {
    notes.push('supply: sfr_permit_count_ytd not available; TODO #M08-SA-01');
  }

  // MOMENTUM: DOM trend (lower DOM = faster sale = positive momentum)
  let momentum = Number(scores.momentum || d.momentum_score || 50);
  const dom = Number(d.days_on_market || d.dom || 0);
  if (dom > 0) {
    // DOM < 15 → 85 (hot), 30 → 70, 60 → 50, 90+ → 30 (stale)
    momentum = Math.min(100, Math.max(10, 100 - dom * 0.78));
    avail.momentum = 'live';
  } else if (d.flip_margin != null) {
    // Flip margin proxy (higher = stronger momentum)
    momentum = Math.min(100, 50 + Number(d.flip_margin) * 300);
    avail.momentum = 'live';
  } else if (d.momentum_score) {
    momentum = Number(d.momentum_score);
    avail.momentum = 'live';
  } else {
    notes.push('momentum: dom/flip_margin not available; TODO #M08-SA-01 for sfr_dom_trend');
  }

  // POSITION: school rating (1-10 → 0-100) and lot size
  let position = Number(scores.position || d.position_score || 50);
  const schoolRating = Number(d.school_rating || 0);
  const lotSizeSf    = Number(d.lot_size_sf || 0);
  if (schoolRating > 0) {
    const schoolScore = Math.min(100, schoolRating * 10);
    const lotBonus = lotSizeSf > 7000 ? 5 : 0;
    position = Math.min(100, schoolScore + lotBonus);
    avail.position = 'live';
  } else if (d.position_score) {
    position = Number(d.position_score);
    avail.position = 'live';
  } else {
    notes.push('position: school_rating not available; TODO #M08-SA-01');
  }

  // RISK: flood zone, insurance flags, rehab scope uncertainty
  let risk = Number(scores.risk || d.risk_score || 50);
  const inFloodZone       = d.flood_zone === true || /AE|VE|A\b/i.test(String(d.flood_zone || ''));
  const insuranceFlag     = d.insurance_premium_flag === true;
  const conditionPoor     = d.condition === 'poor' || d.property_condition === 'poor';
  if (d.flood_zone != null || d.insurance_premium_flag != null || d.condition != null) {
    let riskScore = 70; // baseline reasonable risk
    if (inFloodZone)    riskScore -= 25;
    if (insuranceFlag)  riskScore -= 15;
    if (conditionPoor)  riskScore -= 10;
    risk = Math.min(100, Math.max(0, riskScore));
    avail.risk = 'live';
  } else if (d.risk_score) {
    risk = Number(d.risk_score);
    avail.risk = 'live';
  } else {
    notes.push('risk: flood_zone/insurance_premium_flag not available; TODO #M08-SA-01');
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Retail Adapter — PARTIAL WIRES (TODO #M08-SA-02) ─────────────────────────
//
// Wired signals (available in deal_data):
//   Demand:   trade_area_hh_income (purchasing power proxy), demand_score
//   Supply:   vacancy/vacancy_rate, shadow_space_sf (oversupply risk)
//   Momentum: sales_per_sf (tenant performance), rent_growth_yoy, rent_per_sf_vs_market
//   Position: tenant_credit_rating → anchor credit quality, lease_term_remaining_years
//   Risk:     co_tenancy_clause_exposure (boolean), anchor_credit_watch_flag
//
// Full inputs pending M05 data fields (TODO #M08-SA-02):
//   foot_traffic_index, anchor_tenant_health_index, shadow_vacancy_pct

function retailAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  // DEMAND: household income proxy (higher income = stronger consumer demand)
  let demand = Number(scores.demand || 55);
  const hhIncome = Number(d.trade_area_hh_income || d.median_household_income || 0);
  if (hhIncome > 0) {
    // Income > $120K → 85; $75K → 65; $50K → 45; below $40K → 30
    demand = Math.min(100, Math.max(20, (hhIncome / 1_200)));
    avail.demand = 'live';
  } else if (d.demand_score) {
    demand = Number(d.demand_score);
    avail.demand = 'live';
  } else {
    notes.push('demand: trade_area_hh_income not available; TODO #M08-SA-02 foot_traffic_index');
  }

  // SUPPLY: inline vacancy (lower = more constrained = higher score)
  let supply = Number(scores.supply || 55);
  const vacancy = Number(d.vacancy || d.vacancy_rate || d.inline_vacancy_pct || -1);
  const shadowSf = Number(d.shadow_space_sf || 0);
  if (vacancy >= 0) {
    let supplyScore = Math.min(100, Math.max(0, 100 - vacancy * 300)); // 0% vac → 100, 30% → 10
    if (shadowSf > 50_000) supplyScore -= 10; // large shadow space = hidden supply pressure
    supply = Math.max(0, supplyScore);
    avail.supply = 'live';
  } else if (d.supply_score) {
    supply = Number(d.supply_score);
    avail.supply = 'live';
  } else {
    notes.push('supply: vacancy and shadow_space_sf not available; TODO #M08-SA-02');
  }

  // MOMENTUM: sales PSF (tenant health) or rent growth trend
  let momentum = Number(scores.momentum ?? 50);
  const salesPerSf = Number(d.sales_per_sf || 0);
  const rentPerSfVsMarket = Number(d.rent_per_sf_vs_market || 0); // ratio: >1 = above market
  if (salesPerSf > 0) {
    // < $200 PSF struggling; $300 = OK; $450+ strong
    momentum = Math.min(100, Math.max(0, salesPerSf / 5));
    avail.momentum = 'live';
  } else if (d.rent_growth_yoy != null) {
    momentum = Math.min(100, Math.max(0, 50 + Number(d.rent_growth_yoy) * 300));
    avail.momentum = 'live';
  } else if (rentPerSfVsMarket > 0) {
    momentum = Math.min(100, Math.max(0, rentPerSfVsMarket * 50));
    avail.momentum = 'live';
  } else if (d.momentum_score) {
    momentum = Number(d.momentum_score);
    avail.momentum = 'live';
  } else {
    notes.push('momentum: sales_per_sf/rent_growth not available; TODO #M08-SA-02');
  }

  // POSITION: tenant credit + lease term
  let position = Number(scores.position || 50);
  const tenantCredit = d.tenant_credit_rating || '';
  const leaseTerm = Number(d.lease_term_remaining_years || 0);
  if (tenantCredit) {
    const creditScore = /AAA|AA|A\b/i.test(tenantCredit) ? 85 : /BBB/i.test(tenantCredit) ? 70 : /BB|B\b/i.test(tenantCredit) ? 45 : 30;
    const leaseBonus = leaseTerm >= 10 ? 10 : leaseTerm >= 7 ? 5 : leaseTerm >= 3 ? 0 : -10;
    position = Math.min(100, Math.max(0, creditScore + leaseBonus));
    avail.position = 'live';
  } else if (leaseTerm > 0) {
    position = Math.min(100, 40 + leaseTerm * 4); // 10yr → 80, 5yr → 60
    avail.position = 'live';
  } else if (d.position_score) {
    position = Number(d.position_score);
    avail.position = 'live';
  } else {
    notes.push('position: tenant_credit_rating/lease_term not available; TODO #M08-SA-02');
  }

  // RISK: co-tenancy clause exposure + anchor credit watch + tenant credit
  let risk = Number(scores.risk || 50);
  const coTenancyExposure = d.co_tenancy_clause_exposure === true;
  const anchorCreditWatch = d.anchor_credit_watch_flag === true;
  if (tenantCredit || coTenancyExposure || anchorCreditWatch || d.risk_score) {
    let riskScore = tenantCredit ? (/AAA|AA|A\b/i.test(tenantCredit) ? 80 : /BBB/i.test(tenantCredit) ? 65 : 35) : 55;
    if (coTenancyExposure) riskScore -= 15;
    if (anchorCreditWatch)  riskScore -= 20;
    risk = Math.min(100, Math.max(0, riskScore));
    avail.risk = 'live';
  } else {
    notes.push('risk: co_tenancy_clause_exposure/anchor_credit_watch not available; TODO #M08-SA-02');
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Office Adapter — PARTIAL WIRES (TODO #M08-SA-03) ─────────────────────────
//
// Wired signals (available in deal_data):
//   Demand:   vacancy/vacancy_rate (inverse), hybrid_work_demand_index, demand_score
//   Supply:   pipeline_sf_delivering_12mo (more = supply pressure), vacancy
//   Momentum: tenant_rollover_pct_24mo (rollover = repositioning opportunity)
//   Position: floor_plate_sf (smaller = more adaptable), building_class (A/B/C)
//   Risk:     capex_per_sf_to_compete (high = expensive to stay competitive), risk_score
//
// Full inputs pending M05 data fields (TODO #M08-SA-03):
//   medical_adjacency_score, mullion_spacing_in, tenant_absorption_sf_ytd

function officeAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  const vacancy = Number(d.vacancy || d.vacancy_rate || d.submarket_vacancy_pct || -1);

  // DEMAND: vacancy is the primary demand signal for office (inverse relationship)
  let demand = Number(scores.demand || 45); // office demand structurally below pre-2020 baseline
  const hybridDemandIdx = Number(d.hybrid_work_demand_index || 0);
  if (hybridDemandIdx > 0) {
    demand = Math.min(100, hybridDemandIdx); // 0-100 index directly
    avail.demand = 'live';
  } else if (vacancy >= 0) {
    demand = Math.min(100, Math.max(0, 70 - vacancy * 200)); // 0% vac → 70; 30% → 10
    avail.demand = 'live';
  } else if (d.demand_score) {
    demand = Number(d.demand_score);
    avail.demand = 'live';
  } else {
    notes.push('demand: hybrid_work_demand_index not available; TODO #M08-SA-03');
  }

  // SUPPLY: pipeline + existing vacancy
  let supply = Number(scores.supply || 40); // office supply generally elevated
  const pipelineSf = Number(d.pipeline_sf_delivering_12mo || 0);
  if (vacancy >= 0) {
    let supplyScore = Math.min(100, 90 - vacancy * 250); // high vacancy = oversupplied = low score
    if (pipelineSf > 100_000) supplyScore -= 15; // large pipeline = more supply pressure
    supply = Math.max(0, supplyScore);
    avail.supply = 'live';
  } else if (d.supply_score) {
    supply = Number(d.supply_score);
    avail.supply = 'live';
  } else {
    notes.push('supply: vacancy/pipeline_sf not available; TODO #M08-SA-03');
  }

  // MOMENTUM: tenant rollover signals repositioning opportunity
  let momentum = Number(scores.momentum || 40);
  const rolloverPct = Number(d.tenant_rollover_pct_24mo || 0);
  const newLeasesSigned = Number(d.new_leases_signed_ytd || 0);
  if (rolloverPct > 0) {
    // High rollover = momentum for repositioning thesis; 50% rollover → 75 momentum
    momentum = Math.min(100, 30 + rolloverPct * 90);
    avail.momentum = 'live';
  } else if (newLeasesSigned > 0) {
    momentum = Math.min(100, 35 + Math.log10(newLeasesSigned + 1) * 20);
    avail.momentum = 'live';
  } else if (d.momentum_score) {
    momentum = Number(d.momentum_score);
    avail.momentum = 'live';
  } else {
    notes.push('momentum: tenant_rollover_pct_24mo not available; TODO #M08-SA-03');
  }

  // POSITION: floor plate size + building class
  let position = Number(scores.position || 50);
  const floorPlate = Number(d.floor_plate_sf || 0);
  const buildingClass = (d.building_class || '').toUpperCase();
  if (floorPlate > 0 || buildingClass) {
    let pos = 55;
    if (floorPlate > 0) pos = floorPlate < 12_000 ? 75 : floorPlate < 20_000 ? 55 : 35;
    if (buildingClass === 'A') pos += 15;
    else if (buildingClass === 'C') pos -= 15;
    position = Math.min(100, Math.max(0, pos));
    avail.position = 'live';
  } else if (d.position_score) {
    position = Number(d.position_score);
    avail.position = 'live';
  } else {
    notes.push('position: floor_plate_sf/building_class not available; TODO #M08-SA-03');
  }

  // RISK: capex-to-compete + structural vacancy
  let risk = Number(scores.risk || 40); // structural office vacancy is a macro risk
  const capexPerSf = Number(d.capex_per_sf_to_compete || 0);
  if (capexPerSf > 0 || vacancy >= 0) {
    let riskScore = 65;
    if (vacancy >= 0) riskScore -= vacancy * 150; // high vacancy = more risk
    if (capexPerSf > 50) riskScore -= 15;          // expensive to compete
    if (capexPerSf > 100) riskScore -= 15;         // very expensive
    risk = Math.min(100, Math.max(0, riskScore));
    avail.risk = 'live';
  } else if (d.risk_score) {
    risk = Number(d.risk_score);
    avail.risk = 'live';
  } else {
    notes.push('risk: capex_per_sf_to_compete not available; TODO #M08-SA-03');
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Industrial Adapter — PARTIAL WIRES (TODO #M08-SA-04) ─────────────────────
//
// Wired signals (available in deal_data):
//   Demand:   population_within_10mi (last-mile density), ecommerce_penetration_pct
//   Supply:   industrial_deliveries_sf_12mo (more = supply pressure), ios_availability_pct
//   Momentum: last_mile_lease_velocity, vacancy rate trend
//   Position: clear_height_ft, truck_court_depth_ft, dock_count
//   Risk:     zoning_compatibility_score, rail_access (boolean)
//
// Full inputs pending M05 data fields (TODO #M08-SA-04):
//   port_activity_index, clear_height_demand_trend

function industrialAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  // DEMAND: population density + ecommerce penetration
  let demand = Number(scores.demand || 65); // industrial demand strong in current cycle
  const popWithin10mi = Number(d.population_within_10mi || 0);
  const ecommercePct = Number(d.ecommerce_penetration_pct || 0);
  if (popWithin10mi > 0 || ecommercePct > 0) {
    let demandScore = 65; // industrial demand baseline
    if (popWithin10mi > 0) demandScore = Math.min(100, 45 + Math.log10(popWithin10mi) * 12);
    if (ecommercePct > 0)  demandScore = Math.min(100, demandScore + ecommercePct * 20);
    demand = Math.max(0, demandScore);
    avail.demand = 'live';
  } else if (d.demand_score) {
    demand = Number(d.demand_score);
    avail.demand = 'live';
  } else {
    notes.push('demand: population_within_10mi/ecommerce_penetration_pct not available; TODO #M08-SA-04');
  }

  // SUPPLY: industrial deliveries + IOS availability
  let supply = Number(scores.supply || 60); // industrial supply constrained in most markets
  const deliveriesSf = Number(d.industrial_deliveries_sf_12mo || 0);
  const iosAvailPct  = Number(d.ios_availability_pct || -1);
  if (deliveriesSf > 0 || iosAvailPct >= 0) {
    let supplyScore = 70;
    if (deliveriesSf > 0)   supplyScore -= Math.min(20, deliveriesSf / 500_000 * 10);
    if (iosAvailPct >= 0)   supplyScore -= iosAvailPct * 150; // 10% IOS available → -15
    supply = Math.min(100, Math.max(0, supplyScore));
    avail.supply = 'live';
  } else if (d.supply_score) {
    supply = Number(d.supply_score);
    avail.supply = 'live';
  } else {
    notes.push('supply: industrial_deliveries_sf_12mo not available; TODO #M08-SA-04');
  }

  // MOMENTUM: lease velocity (lower vacancy = faster leasing = higher momentum)
  let momentum = Number(scores.momentum || 60);
  const leaseVelocity = Number(d.last_mile_lease_velocity || 0); // 0-100 index
  const vacancy       = Number(d.vacancy || d.vacancy_rate || -1);
  if (leaseVelocity > 0) {
    momentum = Math.min(100, leaseVelocity);
    avail.momentum = 'live';
  } else if (vacancy >= 0) {
    momentum = Math.min(100, Math.max(20, 80 - vacancy * 300)); // low vacancy = high momentum
    avail.momentum = 'live';
  } else if (d.momentum_score) {
    momentum = Number(d.momentum_score);
    avail.momentum = 'live';
  } else {
    notes.push('momentum: last_mile_lease_velocity not available; TODO #M08-SA-04');
  }

  // POSITION: clear height (spec requirement), truck court, dock count
  let position = Number(scores.position || 55);
  const clearHeight    = Number(d.clear_height_ft || 0);
  const truckCourtDepth = Number(d.truck_court_depth_ft || 0);
  const dockCount       = Number(d.dock_count || 0);
  if (clearHeight > 0 || truckCourtDepth > 0 || dockCount > 0) {
    let posScore = 50;
    if (clearHeight > 0)     posScore = clearHeight >= 32 ? 90 : clearHeight >= 24 ? 75 : clearHeight >= 18 ? 55 : 30;
    if (truckCourtDepth > 0) posScore += truckCourtDepth >= 130 ? 8 : truckCourtDepth >= 100 ? 4 : 0;
    if (dockCount > 0)       posScore += Math.min(10, dockCount);
    position = Math.min(100, Math.max(0, posScore));
    avail.position = 'live';
  } else if (d.position_score) {
    position = Number(d.position_score);
    avail.position = 'live';
  } else {
    notes.push('position: clear_height_ft/truck_court_depth_ft not available; TODO #M08-SA-04');
  }

  // RISK: zoning compatibility + rail access
  let risk = Number(scores.risk || 65); // industrial generally low risk
  const zoningCompat = Number(d.zoning_compatibility_score || 0); // 0-100
  const hasRailAccess = d.rail_access === true;
  if (zoningCompat > 0 || d.rail_access != null) {
    let riskScore = zoningCompat > 0 ? zoningCompat : 65;
    if (hasRailAccess) riskScore += 10; // rail = premium positioning = lower risk
    risk = Math.min(100, Math.max(0, riskScore));
    avail.risk = 'live';
  } else if (d.risk_score) {
    risk = Number(d.risk_score);
    avail.risk = 'live';
  } else {
    notes.push('risk: zoning_compatibility_score not available; TODO #M08-SA-04');
  }

  return { demand, supply, momentum, position, risk, dataAvailability: avail, notes };
}

// ─── Hospitality Adapter — PARTIAL WIRES (TODO #M08-SA-05) ────────────────────
//
// Wired signals (available in deal_data):
//   Demand:   revpar_vs_market (penetration ratio), adr vs comp_adr, occupancy_rate
//   Supply:   str_permit_count (short-term rental pipeline)
//   Momentum: renovation_age (older = stronger reflag momentum), adr_trajectory_yoy
//   Position: brand_tier (limited/select/full), pip_cost_estimate vs acquisition_price
//   Risk:     franchise_available (boolean), pip_cost_estimate vs reserve capacity
//
// Full inputs pending M05 data fields (TODO #M08-SA-05):
//   flag_performance_index, pip_feasibility_score

function hospitalityAdapter(d: Record<string, any>, scores: Record<string, any>): SignalAdapterOutput {
  const notes: string[] = [];
  const avail: SignalAdapterOutput['dataAvailability'] = {
    demand: 'default', supply: 'default', momentum: 'default', position: 'default', risk: 'default',
  };

  const adr     = Number(d.adr || 0);
  const compAdr = Number(d.comp_adr || 0);
  const revparVsMarket = Number(d.revpar_vs_market || 0); // ratio: >1 = outperforming
  const occRate = Number(d.occupancy_rate || d.occupancy || 0);

  // DEMAND: RevPAR penetration + occupancy performance
  let demand = Number(scores.demand || 55);
  if (revparVsMarket > 0) {
    demand = Math.min(100, revparVsMarket * 60); // 1.0x → 60, 1.5x → 90, 0.7x → 42
    avail.demand = 'live';
  } else if (adr > 0 && compAdr > 0) {
    demand = Math.min(100, 50 + (adr / compAdr) * 30);
    avail.demand = 'live';
  } else if (occRate > 0) {
    demand = Math.min(100, occRate * 100); // 80% occ → 80 demand score
    avail.demand = 'live';
  } else if (d.demand_score) {
    demand = Number(d.demand_score);
    avail.demand = 'live';
  } else {
    notes.push('demand: revpar_vs_market/adr not available; TODO #M08-SA-05');
  }

  // SUPPLY: STR permit pipeline (more permits = supply pressure)
  let supply = Number(scores.supply || 55);
  const strPermitCount = Number(d.str_permit_count || 0);
  if (strPermitCount > 0) {
    supply = Math.min(100, Math.max(20, 75 - strPermitCount * 2)); // 0 → 75, 25 → 25
    avail.supply = 'live';
  } else if (d.supply_score) {
    supply = Number(d.supply_score);
    avail.supply = 'live';
  } else {
    notes.push('supply: str_permit_count not available; TODO #M08-SA-05');
  }

  // MOMENTUM: renovation age (older = stronger case for flag/reflag), ADR trajectory
  let momentum = Number(scores.momentum || 50);
  const renovationAge = Number(d.renovation_age_years || 0); // years since last renovation
  const adrTrajectory = Number(d.adr_trajectory_yoy || 0);   // % change YoY
  if (renovationAge > 0 || adrTrajectory !== 0) {
    let momScore = 50;
    if (renovationAge > 0) momScore = Math.min(90, 30 + renovationAge * 3); // 10yr old → 60, 20yr → 90
    if (adrTrajectory > 0) momScore += adrTrajectory * 200; // positive ADR growth adds momentum
    momentum = Math.min(100, Math.max(0, momScore));
    avail.momentum = 'live';
  } else if (adr > 0 && compAdr > 0) {
    const adrRatio = adr / compAdr;
    momentum = adrRatio > 1.05 ? 70 : adrRatio > 0.95 ? 55 : 35;
    avail.momentum = 'live';
  } else if (d.momentum_score) {
    momentum = Number(d.momentum_score);
    avail.momentum = 'live';
  } else {
    notes.push('momentum: renovation_age/adr_trajectory not available; TODO #M08-SA-05');
  }

  // POSITION: brand tier quality + PIP cost vs budget
  let position = Number(scores.position || 50);
  const brandTier = (d.brand_tier || d.flag_tier || '').toLowerCase();
  const pipCost   = Number(d.pip_cost_estimate || 0);
  const budget    = Number(d.acquisition_price || d.budget || 0);
  if (brandTier || pipCost > 0) {
    let posScore = 55;
    if (brandTier.includes('full'))    posScore = 80;
    else if (brandTier.includes('select')) posScore = 65;
    else if (brandTier.includes('limited')) posScore = 50;
    if (pipCost > 0 && budget > 0) {
      const pipRatio = pipCost / budget;
      if (pipRatio < 0.10) posScore += 10;  // low PIP = easy to execute
      else if (pipRatio > 0.30) posScore -= 15; // expensive PIP
    }
    position = Math.min(100, Math.max(0, posScore));
    avail.position = 'live';
  } else if (d.position_score) {
    position = Number(d.position_score);
    avail.position = 'live';
  } else {
    notes.push('position: brand_tier/pip_cost_estimate not available; TODO #M08-SA-05');
  }

  // RISK: franchise availability + PIP cost feasibility
  let risk = Number(scores.risk || 50);
  const franchiseAvailable = d.franchise_available;
  if (franchiseAvailable != null || pipCost > 0) {
    let riskScore = 60;
    if (franchiseAvailable === false) riskScore -= 30; // no franchise = major risk
    if (pipCost > 0 && budget > 0) {
      const pipRatio = pipCost / budget;
      if (pipRatio > 0.25) riskScore -= 20; // expensive PIP = execution risk
    }
    risk = Math.min(100, Math.max(0, riskScore));
    avail.risk = 'live';
  } else if (d.risk_score) {
    risk = Number(d.risk_score);
    avail.risk = 'live';
  } else {
    notes.push('risk: franchise_available/pip_cost_estimate not available; TODO #M08-SA-05');
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
