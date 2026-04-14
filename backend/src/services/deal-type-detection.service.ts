/**
 * Deal Type Detection Service — M08 v2 Stage 1b
 *
 * Per-asset-class decision trees that answer: "Given this asset class,
 * what deal type is it and which sub-strategy is primary?"
 *
 * Spec reference: M08 Rebuild Spec v2 Sections 3.2-3.7
 *
 * Separated from asset-class-detection.service.ts because:
 *  - "What is it?" (asset class) and "What do we do with it?" (deal type)
 *    are distinct problems — they read different signals and have different
 *    confidence drivers
 *  - Separation makes each decision tree independently evolvable without
 *    risk of tangling the asset-class waterfall
 */

import { AssetClass, DetectionSignal } from './asset-class-detection.service';

// ─── Shared result type ────────────────────────────────────────────────────────

export interface DealTypeResult {
  detectedDealType: string;
  detectedSubStrategy: string;
  confidence: number;
  signals: DetectionSignal[];
}

// ─── MF Decision Tree (Spec Section 3.2) ──────────────────────────────────────
//
// Signals read: DSCR, occupancy, loss-to-lease, ops/PCS score,
// capital gap per unit, project type, development type, saved slug

export interface MFDetectionInputs {
  unitCount: number;
  occupancy: number;         // 0-1
  lossToLease: number;       // 0-1, e.g. 0.094 = 9.4%
  dscr: number;
  opsScore: number;          // PCS/ops score 0-100
  capitalGapPerUnit: number; // dollars
  projectType: string;
  developmentType: string;
  savedSlug: string | null;
}

export function detectMFDealType(p: MFDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];

  // Ground-up / BTS development
  if (p.projectType === 'development' && p.unitCount === 0) {
    sigs.push({ signal: 'project_type', value: 'development', threshold: 'development + no existing units', contribution: 0.50 });
    return { detectedDealType: 'ground_up_bts', detectedSubStrategy: 'mf_bts_ground_up', signals: sigs, confidence: 0.80 };
  }

  // Distressed: DSCR < 1.0 OR occupancy < 75%
  if ((p.dscr > 0 && p.dscr < 1.0) || (p.occupancy > 0 && p.occupancy < 0.75)) {
    if (p.dscr > 0 && p.dscr < 1.0)
      sigs.push({ signal: 'dscr', value: p.dscr.toFixed(2), threshold: '<1.0x', contribution: 0.40 });
    if (p.occupancy > 0 && p.occupancy < 0.75)
      sigs.push({ signal: 'occupancy', value: `${Math.round(p.occupancy * 100)}%`, threshold: '<75%', contribution: 0.30 });
    return { detectedDealType: 'distressed', detectedSubStrategy: 'mf_distressed', signals: sigs, confidence: 0.85 };
  }

  // Lease-up: occupancy < 90% without obvious distress → newly delivered / stabilizing
  if (p.occupancy > 0 && p.occupancy < 0.90 && p.dscr >= 1.0) {
    sigs.push({ signal: 'occupancy', value: `${Math.round(p.occupancy * 100)}%`, threshold: '<90% (non-distressed)', contribution: 0.30 });
    return { detectedDealType: 'lease_up', detectedSubStrategy: 'mf_lease_up', signals: sigs, confidence: 0.72 };
  }

  // Deep value-add: loss-to-lease > 8% AND capital gap > $40K/unit
  if ((p.lossToLease > 0.08 || (p.opsScore > 0 && p.opsScore < 60)) && p.capitalGapPerUnit > 40_000) {
    sigs.push({ signal: 'loss_to_lease', value: `${Math.round(p.lossToLease * 100)}%`, threshold: '>8%', contribution: 0.35 });
    sigs.push({ signal: 'capital_gap', value: `$${Math.round(p.capitalGapPerUnit / 1_000)}K/unit`, threshold: '>$40K/unit', contribution: 0.25 });
    return { detectedDealType: 'deep_value_add', detectedSubStrategy: 'mf_deep_value_add', signals: sigs, confidence: 0.82 };
  }

  // Standard value-add: loss-to-lease > 8% OR below-median ops score
  if (p.lossToLease > 0.08 || (p.opsScore > 0 && p.opsScore < 60)) {
    sigs.push({ signal: 'loss_to_lease', value: `${Math.round(p.lossToLease * 100)}%`, threshold: '>8%', contribution: 0.35 });
    if (p.opsScore > 0 && p.opsScore < 60)
      sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '<60 (below-median)', contribution: 0.20 });
    if (p.capitalGapPerUnit > 0)
      sigs.push({ signal: 'capital_gap', value: `$${Math.round(p.capitalGapPerUnit / 1_000)}K/unit`, threshold: '<$40K/unit band', contribution: 0.15 });
    return { detectedDealType: 'value_add', detectedSubStrategy: 'mf_value_add_standard', signals: sigs, confidence: 0.84 };
  }

  // Core-plus: loss-to-lease 3-8% + moderate ops score
  if (p.lossToLease >= 0.03 && p.lossToLease <= 0.08 && (p.opsScore === 0 || (p.opsScore >= 60 && p.opsScore <= 75))) {
    sigs.push({ signal: 'loss_to_lease', value: `${Math.round(p.lossToLease * 100)}%`, threshold: '3-8% (core-plus band)', contribution: 0.30 });
    if (p.opsScore > 0)
      sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '60-75', contribution: 0.25 });
    return { detectedDealType: 'core_plus', detectedSubStrategy: 'mf_core_plus', signals: sigs, confidence: 0.75 };
  }

  // Core: fully stabilized, ops score high, occupancy ≥ 93%
  if ((p.opsScore >= 75 || p.opsScore === 0) && p.occupancy >= 0.93) {
    if (p.opsScore >= 75)
      sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '≥75 (institutional quality)', contribution: 0.30 });
    sigs.push({ signal: 'occupancy', value: `${Math.round(p.occupancy * 100)}%`, threshold: '≥93%', contribution: 0.25 });
    return { detectedDealType: 'core', detectedSubStrategy: 'mf_core', signals: sigs, confidence: 0.78 };
  }

  // Saved-slug fallback
  if (p.savedSlug) {
    if (/deep.value/i.test(p.savedSlug))  return { detectedDealType: 'deep_value_add', detectedSubStrategy: 'mf_deep_value_add', signals: sigs, confidence: 0.60 };
    if (/core.plus/i.test(p.savedSlug))   return { detectedDealType: 'core_plus',      detectedSubStrategy: 'mf_core_plus',      signals: sigs, confidence: 0.60 };
    if (/core(?!.plus)/i.test(p.savedSlug)) return { detectedDealType: 'core',          detectedSubStrategy: 'mf_core',           signals: sigs, confidence: 0.60 };
    if (/distress|opportunistic/i.test(p.savedSlug)) return { detectedDealType: 'distressed', detectedSubStrategy: 'mf_distressed', signals: sigs, confidence: 0.60 };
    if (/lease.up/i.test(p.savedSlug))    return { detectedDealType: 'lease_up',       detectedSubStrategy: 'mf_lease_up',       signals: sigs, confidence: 0.60 };
    if (/ground.up|bts/i.test(p.savedSlug)) return { detectedDealType: 'ground_up_bts', detectedSubStrategy: 'mf_bts_ground_up', signals: sigs, confidence: 0.60 };
  }

  sigs.push({ signal: 'fallback', value: 'default', threshold: 'no strong signal detected', contribution: 0.10 });
  return { detectedDealType: 'value_add', detectedSubStrategy: 'mf_value_add_standard', signals: sigs, confidence: 0.50 };
}

// ─── SFR Decision Tree (Spec Section 3.3) ─────────────────────────────────────
//
// Key heuristic: one house per parcel = SFR; one building / many units = MF
// Parcel count drives portfolio vs. single-asset distinction

export interface SFRDetectionInputs {
  parcelCount: number;
  projectType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}

export function detectSFRDealType(p: SFRDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];
  const d = p.dealData;

  // Portfolio aggregation: 20+ parcels
  if (p.parcelCount >= 20) {
    sigs.push({ signal: 'parcel_count', value: String(p.parcelCount), threshold: '≥20 parcels → portfolio', contribution: 0.45 });
    return { detectedDealType: 'sfr_portfolio_aggregation', detectedSubStrategy: 'sfr_portfolio_agg', signals: sigs, confidence: 0.82 };
  }

  // Build-to-rent: development project type
  if (p.projectType === 'development') {
    sigs.push({ signal: 'project_type', value: 'development', threshold: 'new SFR ground-up → BTR', contribution: 0.40 });
    return { detectedDealType: 'sfr_btr', detectedSubStrategy: 'sfr_btr', signals: sigs, confidence: 0.75 };
  }

  // STR: STR permit confirmed
  if (d.str_permitted === true) {
    sigs.push({ signal: 'str_permitted', value: 'true', threshold: 'STR permit confirmed', contribution: 0.45 });
    return { detectedDealType: 'sfr_str', detectedSubStrategy: 'sfr_str', signals: sigs, confidence: 0.78 };
  }

  // MTR: corporate/medical demand flag
  if (d.mtr_demand === true || d.corporate_demand === true) {
    sigs.push({ signal: 'mtr_demand', value: 'true', threshold: 'corporate/medical demand present', contribution: 0.40 });
    return { detectedDealType: 'sfr_mtr', detectedSubStrategy: 'sfr_mtr', signals: sigs, confidence: 0.72 };
  }

  // Fix-flip: condition = poor + short hold intent
  if (d.condition === 'poor' || d.hold_intent === 'flip') {
    sigs.push({ signal: 'condition', value: d.condition || 'poor', threshold: 'poor condition → fix-flip', contribution: 0.40 });
    return { detectedDealType: 'sfr_fix_flip', detectedSubStrategy: 'sfr_fix_flip', signals: sigs, confidence: 0.75 };
  }

  // BRRRR: rehab + rental intent with refi signal
  if (d.hold_intent === 'brrrr' || d.refi_planned === true) {
    sigs.push({ signal: 'refi_planned', value: 'true', threshold: 'refi-and-repeat strategy', contribution: 0.40 });
    return { detectedDealType: 'sfr_brrrr', detectedSubStrategy: 'sfr_brrrr', signals: sigs, confidence: 0.72 };
  }

  // Wholesale: assignment-only intent
  if (d.hold_intent === 'wholesale') {
    sigs.push({ signal: 'hold_intent', value: 'wholesale', threshold: 'assignment / wholesale', contribution: 0.50 });
    return { detectedDealType: 'sfr_wholesale', detectedSubStrategy: 'sfr_wholesale', signals: sigs, confidence: 0.80 };
  }

  // Saved-slug fallback
  if (p.savedSlug) {
    if (/brrrr/i.test(p.savedSlug))        return { detectedDealType: 'sfr_brrrr',    detectedSubStrategy: 'sfr_brrrr',    signals: sigs, confidence: 0.65 };
    if (/fix.flip|flip/i.test(p.savedSlug)) return { detectedDealType: 'sfr_fix_flip', detectedSubStrategy: 'sfr_fix_flip', signals: sigs, confidence: 0.65 };
    if (/str|vacation/i.test(p.savedSlug))  return { detectedDealType: 'sfr_str',      detectedSubStrategy: 'sfr_str',      signals: sigs, confidence: 0.65 };
    if (/mtr|mid.term/i.test(p.savedSlug))  return { detectedDealType: 'sfr_mtr',      detectedSubStrategy: 'sfr_mtr',      signals: sigs, confidence: 0.65 };
    if (/btr/i.test(p.savedSlug))           return { detectedDealType: 'sfr_btr',      detectedSubStrategy: 'sfr_btr',      signals: sigs, confidence: 0.65 };
  }

  // Default: single-house rental hold
  sigs.push({ signal: 'single_house', value: String(p.parcelCount), threshold: 'default single-family hold', contribution: 0.30 });
  return { detectedDealType: 'sfr_hold', detectedSubStrategy: 'sfr_hold', signals: sigs, confidence: 0.58 };
}

// ─── Retail Decision Tree (Spec Section 3.4) ──────────────────────────────────
//
// Signals: property type string, tenant credit, anchor health,
// vacancy rate, inline vacancy, foot traffic availability

export interface RetailDetectionInputs {
  rawPropType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}

export function detectRetailDealType(p: RetailDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];
  const t = p.rawPropType.toLowerCase();
  const d = p.dealData;
  const vacancy = Number(d.vacancy || d.vacancy_rate || 0);
  const tenantCredit = d.tenant_credit_rating || '';

  // NNN Core: single-tenant net lease with IG credit
  if (/nnn|net.lease|single.tenant/i.test(t) || (tenantCredit && /BBB|A-|A\b|AA|AAA/i.test(tenantCredit))) {
    sigs.push({ signal: 'property_type', value: t, threshold: 'NNN single-tenant net lease', contribution: 0.50 });
    if (tenantCredit) sigs.push({ signal: 'tenant_credit', value: tenantCredit, threshold: 'investment grade', contribution: 0.20 });
    return { detectedDealType: 'retail_nnn_core', detectedSubStrategy: 'retail_nnn_core', signals: sigs, confidence: 0.80 };
  }

  // Grocery-anchored: property type or anchor flag
  if (/grocery|anchored/i.test(t) || d.anchor_type === 'grocery') {
    sigs.push({ signal: 'anchor_type', value: d.anchor_type || t, threshold: 'grocery-anchored center', contribution: 0.45 });
    return { detectedDealType: 'retail_grocery_anchored', detectedSubStrategy: 'retail_grocery_anchored', signals: sigs, confidence: 0.78 };
  }

  // Last-mile conversion: truck access + industrial demand flag
  if (d.truck_access === true || d.last_mile_opportunity === true) {
    sigs.push({ signal: 'truck_access', value: 'true', threshold: 'truck access + last-mile opportunity', contribution: 0.40 });
    return { detectedDealType: 'retail_last_mile', detectedSubStrategy: 'retail_last_mile', signals: sigs, confidence: 0.72 };
  }

  // Value-add: elevated vacancy
  if (vacancy > 0.15) {
    sigs.push({ signal: 'vacancy', value: `${Math.round(vacancy * 100)}%`, threshold: '>15% → value-add reposition', contribution: 0.35 });
    return { detectedDealType: 'retail_value_add', detectedSubStrategy: 'retail_value_add', signals: sigs, confidence: 0.72 };
  }

  sigs.push({ signal: 'property_type', value: t, threshold: 'retail default → value-add', contribution: 0.25 });
  return { detectedDealType: 'retail_value_add', detectedSubStrategy: 'retail_value_add', signals: sigs, confidence: 0.60 };
}

// ─── Office Decision Tree (Spec Section 3.5) ──────────────────────────────────
//
// Signals: vacancy rate, floor plate, property type (medical/flex),
// mullion spacing, tenant rollover schedule

export interface OfficeDetectionInputs {
  rawPropType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}

export function detectOfficeDealType(p: OfficeDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];
  const d = p.dealData;
  const vacancy = Number(d.vacancy || d.vacancy_rate || 0);
  const floorPlate = Number(d.floor_plate_sf || 0);
  const tenantRollover = Number(d.tenant_rollover_pct_24mo || 0);

  // Medical office: medical property type or adjacency flag
  if (/medical/i.test(p.rawPropType) || d.medical_adjacency === true) {
    sigs.push({ signal: 'property_type', value: p.rawPropType, threshold: 'medical office subtype', contribution: 0.45 });
    return { detectedDealType: 'office_medical', detectedSubStrategy: 'office_medical', signals: sigs, confidence: 0.80 };
  }

  // Adaptive reuse: vacancy > 30% (spec: floor plate <12K preferred but not a gate)
  if (vacancy > 0.30) {
    sigs.push({ signal: 'vacancy', value: `${Math.round(vacancy * 100)}%`, threshold: '>30% → adaptive reuse candidate', contribution: 0.40 });
    if (floorPlate > 0 && floorPlate < 12_000)
      sigs.push({ signal: 'floor_plate', value: `${floorPlate.toLocaleString()} SF`, threshold: '<12K SF ideal for residential conversion', contribution: 0.20 });
    return { detectedDealType: 'office_adaptive_reuse', detectedSubStrategy: 'office_adaptive_reuse', signals: sigs, confidence: 0.78 };
  }

  // Tenant rollup: > 40% rollover within 24 months
  if (tenantRollover > 0.40) {
    sigs.push({ signal: 'tenant_rollover_24mo', value: `${Math.round(tenantRollover * 100)}%`, threshold: '>40% rollover → reposition', contribution: 0.40 });
    return { detectedDealType: 'office_tenant_rollup', detectedSubStrategy: 'office_tenant_rollup', signals: sigs, confidence: 0.74 };
  }

  sigs.push({ signal: 'default', value: 'office', threshold: 'tenant rollup fallback', contribution: 0.20 });
  return { detectedDealType: 'office_tenant_rollup', detectedSubStrategy: 'office_tenant_rollup', signals: sigs, confidence: 0.55 };
}

// ─── Industrial Decision Tree (Spec Section 3.6) ──────────────────────────────
//
// Signals: clear height, truck court, population within 10mi,
// e-commerce penetration flag, zoning class

export interface IndustrialDetectionInputs {
  dealData: Record<string, any>;
  savedSlug: string | null;
}

export function detectIndustrialDealType(p: IndustrialDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];
  const d = p.dealData;
  const clearHeight = Number(d.clear_height_ft || 0);
  const popWithin10mi = Number(d.population_within_10mi || 0);
  const hasTruckCourt = d.truck_court === true || d.truck_access === true;

  // Last-mile: clear height ≥ 24ft OR pop > 250K within 10mi + truck access
  if (clearHeight >= 24 || (popWithin10mi > 250_000 && hasTruckCourt)) {
    if (clearHeight >= 24)
      sigs.push({ signal: 'clear_height', value: `${clearHeight}ft`, threshold: '≥24ft → last-mile', contribution: 0.40 });
    if (popWithin10mi > 250_000)
      sigs.push({ signal: 'population_within_10mi', value: popWithin10mi.toLocaleString(), threshold: '>250K', contribution: 0.30 });
    if (hasTruckCourt)
      sigs.push({ signal: 'truck_court', value: 'confirmed', threshold: 'truck court access', contribution: 0.15 });
    return { detectedDealType: 'industrial_last_mile', detectedSubStrategy: 'industrial_last_mile', signals: sigs, confidence: 0.80 };
  }

  // Core: stabilized, low vacancy
  const vacancy = Number(d.vacancy || 0);
  if (vacancy < 0.05) {
    sigs.push({ signal: 'vacancy', value: `${Math.round(vacancy * 100)}%`, threshold: '<5% → core industrial', contribution: 0.35 });
    return { detectedDealType: 'industrial_core', detectedSubStrategy: 'industrial_core', signals: sigs, confidence: 0.72 };
  }

  // Default: last-mile (most common opportunity in current cycle)
  sigs.push({ signal: 'fallback', value: 'industrial', threshold: 'default → last-mile', contribution: 0.20 });
  return { detectedDealType: 'industrial_last_mile', detectedSubStrategy: 'industrial_last_mile', signals: sigs, confidence: 0.55 };
}

// ─── Hospitality Decision Tree (Spec Section 3.7) ─────────────────────────────
//
// Signals: ADR trajectory, RevPAR, flag performance,
// renovation age, extended-stay demand drivers

export interface HospitalityDetectionInputs {
  rawPropType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}

export function detectHospitalityDealType(p: HospitalityDetectionInputs): DealTypeResult {
  const sigs: DetectionSignal[] = [];
  const d = p.dealData;

  // Extended-stay: property type or demand driver flag
  if (/extended|stay/i.test(p.rawPropType) || d.extended_stay_demand === true) {
    sigs.push({ signal: 'property_type', value: p.rawPropType, threshold: 'extended-stay subtype', contribution: 0.45 });
    return { detectedDealType: 'hospitality_extended_stay', detectedSubStrategy: 'hospitality_extended_stay', signals: sigs, confidence: 0.78 };
  }

  // Reflag: flag opportunity exists or ADR significantly below comp
  const adr = Number(d.adr || 0);
  const compAdr = Number(d.comp_adr || 0);
  if (d.flag_opportunity === true || (adr > 0 && compAdr > 0 && adr < compAdr * 0.85)) {
    sigs.push({ signal: 'flag_opportunity', value: d.flag_opportunity ? 'confirmed' : 'ADR gap', threshold: 'reflag opportunity', contribution: 0.45 });
    if (adr > 0) sigs.push({ signal: 'adr', value: `$${adr}`, threshold: `<85% of comp ADR ($${compAdr})`, contribution: 0.20 });
    return { detectedDealType: 'hospitality_reflag', detectedSubStrategy: 'hospitality_reflag', signals: sigs, confidence: 0.76 };
  }

  // Default: reflag (most investable hospitality play in current market)
  sigs.push({ signal: 'fallback', value: 'hospitality', threshold: 'default → reflag', contribution: 0.20 });
  return { detectedDealType: 'hospitality_reflag', detectedSubStrategy: 'hospitality_reflag', signals: sigs, confidence: 0.55 };
}

// ─── Router: dispatch to per-asset-class tree ─────────────────────────────────

export function detectDealType(assetClass: AssetClass, deal: Record<string, any>): DealTypeResult {
  const d = deal.deal_data || {};
  const rawPropType: string = d.property_type || deal.project_type || deal.deal_category || '';
  const savedSlug: string | null = deal.strategy_slug || null;

  switch (assetClass) {
    case 'multifamily':
      return detectMFDealType({
        unitCount: Number(deal.unit_count || d.unit_count || d.units || 0),
        occupancy: Number(d.occupancy || d.occupancy_rate || deal.assumptions?.occupancy_pct || 0),
        lossToLease: Number(d.loss_to_lease || d.lossToLease || deal.assumptions?.loss_to_lease || 0),
        dscr: Number(d.dscr || deal.assumptions?.dscr || 0),
        opsScore: Number(d.ops_score || d.pcs_score || 0),
        capitalGapPerUnit: Number(d.capital_gap_per_unit || d.capex_per_unit || deal.tdc_per_unit || 0),
        projectType: deal.project_type || '',
        developmentType: deal.development_type || '',
        savedSlug,
      });

    case 'sfr':
      return detectSFRDealType({
        parcelCount: Number(d.parcel_count || 1),
        projectType: deal.project_type || '',
        dealData: d,
        savedSlug,
      });

    case 'retail':
      return detectRetailDealType({ rawPropType, dealData: d, savedSlug });

    case 'office':
      return detectOfficeDealType({ rawPropType, dealData: d, savedSlug });

    case 'industrial':
      return detectIndustrialDealType({ dealData: d, savedSlug });

    case 'hospitality':
      return detectHospitalityDealType({ rawPropType, dealData: d, savedSlug });

    default:
      return {
        detectedDealType: 'value_add',
        detectedSubStrategy: 'mf_value_add_standard',
        confidence: 0.40,
        signals: [{ signal: 'fallback', value: assetClass, threshold: 'unknown asset class', contribution: 0.10 }],
      };
  }
}
