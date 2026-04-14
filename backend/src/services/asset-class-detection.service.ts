/**
 * Asset Class Detection Service — M08 v2 Stage 1a
 *
 * Answers: "What type of asset is this?" — a distinct problem from
 * "What deal type / sub-strategy should we use?" (see deal-type-detection.service.ts).
 *
 * Implements the spec's 5-input weighted confidence waterfall:
 *   assessor_code_match   × 0.45  ← TODO #M08-AC-01 (DB field not yet available)
 *   zoning_match          × 0.20  ← WIRED (deal_data.zoning_classification)
 *   rent_roll_signal      × 0.15  ← WIRED (unit_count + avg_rent structure)
 *   naics_signal          × 0.10  ← TODO #M08-AC-02 (DB field not yet available)
 *   building_structure    × 0.10  ← WIRED (stories + construction_type + unit_count)
 *
 * Total wired: 0.20 + 0.15 + 0.10 = 0.45 max (from available DB fields)
 * Consequence: most deals will have requiresUserConfirmation: true until
 * assessor codes (#M08-AC-01) and NAICS codes (#M08-AC-02) are ingested.
 *
 * Spec reference: M08 Rebuild Spec v2 Sections 3.1, 3.2
 */

export type AssetClass =
  | 'multifamily'
  | 'sfr'
  | 'retail'
  | 'office'
  | 'industrial'
  | 'hospitality'
  | 'mixed_use'
  | 'vacant_land'
  | 'other';

export interface DetectionSignal {
  signal: string;
  value: string;
  threshold: string;
  contribution: number;
}

export interface AlternateSubStrategy {
  key: string;
  fit: number;
  reason: string;
}

export interface DetectionResult {
  assetClass: AssetClass;
  subType: string;
  detectedDealType: string;
  detectedSubStrategy: string;
  // Stage 1 waterfall confidence only — drives requiresUserConfirmation per spec.
  // Max 0.45 from wired inputs (zoning × 0.20 + rent_roll × 0.15 + building × 0.10);
  // rises to 0.90+ when assessor codes (#M08-AC-01) and NAICS (#M08-AC-02) land.
  confidence: number;
  requiresUserConfirmation: boolean; // true when Stage 1 waterfall confidence < 0.70
  confidenceBreakdown: {             // waterfall component scores for auditability
    assessorCode: number;            // always 0 until TODO #M08-AC-01 lands
    zoningMatch: number;
    rentRollSignal: number;
    naicsSignal: number;             // always 0 until TODO #M08-AC-02 lands
    buildingStructure: number;
  };
  // Blended asset-class + deal-type signal confidence (separate metadata; not used
  // for requiresUserConfirmation). Available for display/ranking where applicable.
  dealTypeConfidence?: number;
  detectionSignals: DetectionSignal[];
  alternateSubStrategies: AlternateSubStrategy[];
  userConfirmed: boolean;
  userOverrideClassification?: string;
}

// ─── Sub-strategy catalog ─────────────────────────────────────────────────────

export const SUB_STRATEGY_NAMES: Record<string, string> = {
  mf_value_add_standard:   'Multifamily Value-Add',
  mf_deep_value_add:       'Multifamily Deep Value-Add',
  mf_core:                 'Multifamily Core',
  mf_core_plus:            'Multifamily Core-Plus',
  mf_distressed:           'Multifamily Distressed / Opportunistic',
  mf_lease_up:             'Multifamily Lease-Up',
  mf_bts_ground_up:        'Multifamily Ground-Up Development',
  mf_str:                  'Short-Term Rental (MF)',
  sfr_fix_flip:            'SFR Fix-and-Flip',
  sfr_brrrr:               'SFR BRRRR',
  sfr_hold:                'SFR Hold (Scattered)',
  sfr_portfolio_agg:       'SFR Portfolio Aggregation',
  sfr_btr:                 'SFR Build-to-Rent',
  sfr_str:                 'SFR STR (Vacation Rental)',
  sfr_mtr:                 'SFR MTR (Mid-Term)',
  sfr_wholesale:           'SFR Wholesale',
  retail_nnn_core:         'Retail NNN Core',
  retail_grocery_anchored: 'Retail Grocery-Anchored Reposition',
  retail_value_add:        'Retail Value-Add Reposition',
  retail_last_mile:        'Retail → Flex / Last-Mile Conversion',
  office_adaptive_reuse:   'Office Adaptive Reuse',
  office_medical:          'Office Medical Conversion',
  office_tenant_rollup:    'Office Tenant Rollup Reposition',
  industrial_last_mile:    'Industrial Last-Mile',
  industrial_core:         'Industrial Core',
  hospitality_reflag:      'Hospitality Reflag',
  hospitality_extended_stay: 'Hospitality Extended-Stay Conversion',
};

export const SUB_STRATEGY_FAMILY: Record<string, string> = {
  mf_value_add_standard:   'rental',
  mf_deep_value_add:       'rental',
  mf_core:                 'rental',
  mf_core_plus:            'rental',
  mf_distressed:           'rental',
  mf_lease_up:             'rental',
  mf_bts_ground_up:        'bts',
  mf_str:                  'str',
  sfr_fix_flip:            'flip',
  sfr_brrrr:               'sfr',
  sfr_hold:                'sfr',
  sfr_portfolio_agg:       'sfr',
  sfr_btr:                 'sfr',
  sfr_str:                 'str',
  sfr_mtr:                 'str',
  sfr_wholesale:           'flip',
  retail_nnn_core:         'retail_specific',
  retail_grocery_anchored: 'retail_specific',
  retail_value_add:        'retail_specific',
  retail_last_mile:        'retail_specific',
  office_adaptive_reuse:   'office_specific',
  office_medical:          'office_specific',
  office_tenant_rollup:    'office_specific',
  industrial_last_mile:    'industrial_specific',
  industrial_core:         'industrial_specific',
  hospitality_reflag:      'hospitality_specific',
  hospitality_extended_stay: 'hospitality_specific',
};

// Signal weight matrix per sub-strategy (Demand, Supply, Momentum, Position, Risk)
// Weights sum to 1.0 per row — spec Section 4.1
export const SUB_STRATEGY_WEIGHTS: Record<string, Record<string, number>> = {
  mf_value_add_standard:   { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  mf_deep_value_add:       { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.15, risk: 0.15 },
  mf_core:                 { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  mf_core_plus:            { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
  mf_distressed:           { demand: 0.20, supply: 0.15, momentum: 0.15, position: 0.20, risk: 0.30 },
  mf_lease_up:             { demand: 0.35, supply: 0.30, momentum: 0.15, position: 0.10, risk: 0.10 },
  mf_bts_ground_up:        { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  mf_str:                  { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_fix_flip:            { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  sfr_brrrr:               { demand: 0.20, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.15 },
  sfr_hold:                { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  sfr_portfolio_agg:       { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  sfr_btr:                 { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  sfr_str:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_mtr:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_wholesale:           { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  retail_nnn_core:         { demand: 0.20, supply: 0.10, momentum: 0.10, position: 0.35, risk: 0.25 },
  retail_grocery_anchored: { demand: 0.25, supply: 0.15, momentum: 0.15, position: 0.30, risk: 0.15 },
  retail_value_add:        { demand: 0.30, supply: 0.15, momentum: 0.20, position: 0.25, risk: 0.10 },
  retail_last_mile:        { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.10 },
  office_adaptive_reuse:   { demand: 0.35, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.15 },
  office_medical:          { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.20, risk: 0.15 },
  office_tenant_rollup:    { demand: 0.15, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.20 },
  industrial_last_mile:    { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.05 },
  industrial_core:         { demand: 0.20, supply: 0.25, momentum: 0.15, position: 0.25, risk: 0.15 },
  hospitality_reflag:      { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.25, risk: 0.10 },
  hospitality_extended_stay: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
};

// ─── Waterfall weight constants (spec Section 3.1) ────────────────────────────

const W_ASSESSOR_CODE    = 0.45; // TODO #M08-AC-01: awaiting assessor code ingestion
const W_ZONING_MATCH     = 0.20; // WIRED
const W_RENT_ROLL_SIGNAL = 0.15; // WIRED
const W_NAICS_SIGNAL     = 0.10; // TODO #M08-AC-02: awaiting NAICS code ingestion
const W_BUILDING_STRUCT  = 0.10; // WIRED

// ─── Zoning match (0-1 score, weighted 0.20) ──────────────────────────────────

const ZONING_MF_PATTERNS = /^(R-?[3-9]|R-?MF|RM\b|RMH|MF|MFR|R-?PD|RM[0-9]|C-?[3-4]|PUD.*multi)/i;
const ZONING_SFR_PATTERNS = /^(R-?1|R-?2|RS\b|RSF|RE\b|A-?R|R-?L|R-?E|RR\b|R-?A)/i;
const ZONING_RETAIL_PATTERNS = /^(C-?[1-3]|B-?[1-3]|GC\b|NC\b|CC\b|RC\b|CR\b|NB\b|HB\b)/i;
const ZONING_OFFICE_PATTERNS = /^(O-?[1-2]|OC\b|OP\b|OB\b|MO\b|MOB\b|CP\b)/i;
const ZONING_INDUSTRIAL_PATTERNS = /^(I-?[1-3]|M-?[1-3]|LI\b|HI\b|IL\b|IH\b|IP\b|BP\b)/i;
const ZONING_HOSPITALITY_PATTERNS = /^(C-?2|C-?3|H\b|CH\b|GC\b|TH\b)/i;

function computeZoningScore(zoning: string, assetClass: AssetClass): number {
  if (!zoning) return 0;
  const z = zoning.trim();
  const patterns: Record<AssetClass, RegExp | null> = {
    multifamily:  ZONING_MF_PATTERNS,
    sfr:          ZONING_SFR_PATTERNS,
    retail:       ZONING_RETAIL_PATTERNS,
    office:       ZONING_OFFICE_PATTERNS,
    industrial:   ZONING_INDUSTRIAL_PATTERNS,
    hospitality:  ZONING_HOSPITALITY_PATTERNS,
    mixed_use:    null,
    vacant_land:  null,
    other:        null,
  };
  const pattern = patterns[assetClass];
  if (!pattern) return 0.50; // mixed/vacant/other — partial credit
  return pattern.test(z) ? 1.0 : 0;
}

// ─── Rent roll signal (0-1 score, weighted 0.15) ──────────────────────────────
// "Rent roll structure" = does the income structure match the asset class?

function computeRentRollScore(unitCount: number, avgRent: number, assetClass: AssetClass): number {
  if (assetClass === 'multifamily') {
    if (unitCount > 4 && avgRent > 0) return 1.0;      // clear MF rent roll
    if (unitCount > 4) return 0.70;                     // unit count alone
    if (unitCount >= 2 && avgRent > 0) return 0.50;    // small MF
    return 0;
  }
  if (assetClass === 'sfr') {
    if (unitCount >= 1 && unitCount <= 4) return 1.0;  // single-family rent structure
    if (unitCount === 0 && avgRent > 0) return 0.50;   // single unit with rent
    return 0;
  }
  if (assetClass === 'retail' || assetClass === 'office' || assetClass === 'industrial') {
    // Commercial rent roll: we have deal_data but no standard unit_count field
    if (avgRent > 0) return 0.60;  // some rent data present
    return 0;
  }
  return 0;
}

// ─── Building structure signal (0-1 score, weighted 0.10) ─────────────────────
// Stories + construction type + unit count confirm or deny the asset class

function computeBuildingStructureScore(
  stories: number,
  constructionType: string,
  unitCount: number,
  assetClass: AssetClass
): number {
  if (assetClass === 'multifamily') {
    if (stories >= 5) return 1.0;           // high-rise / mid-rise confirms MF
    if (stories >= 2 && unitCount > 4) return 0.90;
    if (unitCount > 4) return 0.70;
    return 0;
  }
  if (assetClass === 'sfr') {
    if (stories <= 2 && unitCount <= 4) return 1.0;
    if (unitCount <= 4) return 0.80;
    return 0;
  }
  if (assetClass === 'industrial') {
    if (/warehouse|industrial|tilt.up|metal/i.test(constructionType)) return 1.0;
    if (stories === 1 && unitCount === 0) return 0.60;
    return 0;
  }
  if (assetClass === 'retail') {
    if (/frame|masonry|shell/i.test(constructionType) && stories <= 2) return 0.80;
    if (stories <= 2 && unitCount === 0) return 0.60;
    return 0;
  }
  if (assetClass === 'office') {
    if (/steel|concrete/i.test(constructionType) && stories >= 2) return 0.90;
    if (stories >= 2) return 0.70;
    return 0;
  }
  if (assetClass === 'hospitality') {
    if (/hotel|hospitality|concrete/i.test(constructionType)) return 1.0;
    return 0.40;
  }
  return 0;
}

// ─── Property type → asset class inference ────────────────────────────────────

function normalizePropType(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[_\-\s]+/g, '_');
}

function inferAssetClassFromPropType(propType: string): { assetClass: AssetClass; confidence: number } | null {
  const t = normalizePropType(propType);
  if (/(multifamily|apartment|multi_family|mf|residential_multi|garden|mid_rise|high_rise|condo|townhome)/i.test(t)) return { assetClass: 'multifamily', confidence: 0.60 };
  if (/(sfr|single_family|single_house|single_fam|residential_single|detached|1_4_unit|fourplex)/i.test(t))          return { assetClass: 'sfr', confidence: 0.60 };
  if (/(retail|strip|shopping|mall|outparcel|nnn|net_lease|power_center|grocery)/i.test(t))                          return { assetClass: 'retail', confidence: 0.60 };
  if (/(office|medical_office|flex_office)/i.test(t))                                                                return { assetClass: 'office', confidence: 0.60 };
  if (/(industrial|warehouse|flex_industrial|manufacturing|cold_storage|ios)/i.test(t))                              return { assetClass: 'industrial', confidence: 0.60 };
  if (/(hotel|motel|hospitality|lodging|resort|inn|bnb)/i.test(t))                                                   return { assetClass: 'hospitality', confidence: 0.60 };
  if (/(mixed|mixed_use)/i.test(t))                                                                                   return { assetClass: 'mixed_use', confidence: 0.55 };
  if (/(land|vacant|lot|acreage|raw_land)/i.test(t))                                                                 return { assetClass: 'vacant_land', confidence: 0.65 };
  return null;
}

// ─── Sub-type detection ───────────────────────────────────────────────────────

function detectSubType(assetClass: AssetClass, deal: Record<string, any>): string {
  const d = deal.deal_data || {};
  const rawPropType = d.property_type || deal.project_type || '';
  const unitCount = Number(deal.unit_count || d.unit_count || 0);
  const stories = Number(d.stories || deal.assumptions?.stories || 0);
  const parcelCount = Number(d.parcel_count || 1);

  switch (assetClass) {
    case 'multifamily':
      if (unitCount >= 100 || stories >= 5) return 'mid_rise';
      if (unitCount >= 20) return 'garden';
      return 'townhome';
    case 'sfr':
      if (parcelCount >= 20) return 'scattered_portfolio';
      if (unitCount >= 2 && unitCount <= 4) return '2_4_unit';
      return 'single_house';
    case 'retail':
      if (/nnn|net.lease/i.test(rawPropType)) return 'single_tenant_nnn';
      if (/grocery|anchored/i.test(rawPropType)) return 'grocery_anchored';
      if (/power|big.box/i.test(rawPropType)) return 'power_center';
      return 'strip';
    case 'office':
      return /medical/i.test(rawPropType) ? 'medical' : 'class_b_suburban';
    case 'industrial':
      return /last.mile/i.test(rawPropType) ? 'last_mile' : 'warehouse';
    case 'hospitality':
      return /extended|stay/i.test(rawPropType) ? 'extended_stay' : 'select_service';
    default:
      return 'unknown';
  }
}

// ─── Alternate sub-strategies ─────────────────────────────────────────────────

function buildAlternates(
  assetClass: AssetClass,
  primaryKey: string,
  metrics: { lossToLease: number; occupancy: number; dscr: number; capitalGapPerUnit: number }
): AlternateSubStrategy[] {
  const alts: AlternateSubStrategy[] = [];

  if (assetClass === 'multifamily') {
    if (primaryKey === 'mf_value_add_standard') {
      alts.push({ key: 'mf_deep_value_add', fit: 0.62, reason: 'If capital scope is expanded beyond $40K/unit' });
      alts.push({ key: 'mf_core_plus', fit: 0.38, reason: 'If loss-to-lease capture is faster than modeled' });
      if (metrics.lossToLease > 0.12) alts.push({ key: 'mf_bts_ground_up', fit: 0.30, reason: 'If zoning allows 3x+ density and land residual is positive' });
    } else if (primaryKey === 'mf_deep_value_add') {
      alts.push({ key: 'mf_value_add_standard', fit: 0.55, reason: 'If capital budget is reduced below $40K/unit scope' });
      alts.push({ key: 'mf_bts_ground_up', fit: 0.40, reason: 'If teardown + redevelopment exceeds repositioning ROI' });
    } else if (primaryKey === 'mf_distressed') {
      alts.push({ key: 'mf_deep_value_add', fit: 0.50, reason: 'Once turnaround complete, pivot to deep value-add capital plan' });
      alts.push({ key: 'mf_value_add_standard', fit: 0.35, reason: 'If physical condition better than financials suggest' });
    } else if (primaryKey === 'mf_core') {
      alts.push({ key: 'mf_core_plus', fit: 0.55, reason: 'If modest upgrades yield rent lift beyond current modeling' });
    } else if (primaryKey === 'mf_bts_ground_up') {
      alts.push({ key: 'mf_value_add_standard', fit: 0.45, reason: 'If entitlement risk or capital constraints prefer renovation' });
    } else if (primaryKey === 'mf_lease_up') {
      alts.push({ key: 'mf_value_add_standard', fit: 0.50, reason: 'If property requires physical improvements beyond lease-up' });
    }
  } else if (assetClass === 'sfr') {
    if (primaryKey === 'sfr_fix_flip') {
      alts.push({ key: 'sfr_brrrr', fit: 0.55, reason: 'If rental comps support DSCR > 1.25 post-refi' });
      alts.push({ key: 'sfr_hold', fit: 0.40, reason: 'If resale market is soft but rental demand is strong' });
    } else if (primaryKey === 'sfr_brrrr') {
      alts.push({ key: 'sfr_fix_flip', fit: 0.50, reason: 'If refi-out LTV does not clear BRRRR basis' });
    } else if (primaryKey === 'sfr_hold') {
      alts.push({ key: 'sfr_mtr', fit: 0.45, reason: 'If corporate/medical demand in submarket is strong' });
    }
  } else if (assetClass === 'retail') {
    if (primaryKey === 'retail_value_add') {
      alts.push({ key: 'retail_last_mile', fit: 0.45, reason: 'If adjacent industrial demand and truck access present' });
    } else if (primaryKey === 'retail_grocery_anchored') {
      alts.push({ key: 'retail_value_add', fit: 0.50, reason: 'If anchor tenant vacates or credit deteriorates' });
    }
  } else if (assetClass === 'office') {
    if (primaryKey === 'office_adaptive_reuse') {
      alts.push({ key: 'office_tenant_rollup', fit: 0.45, reason: 'If floor plate too large for residential conversion' });
    }
  }

  return alts;
}

// ─── Main detection function ──────────────────────────────────────────────────

import { detectDealType } from './deal-type-detection.service';

/**
 * Detect asset class from deal data using the spec's weighted confidence waterfall.
 * Call this first; then call detectDealType() from deal-type-detection.service.ts.
 */
export function detectAssetClass(deal: Record<string, any>): {
  assetClass: AssetClass;
  subType: string;
  confidence: number;
  confidenceBreakdown: DetectionResult['confidenceBreakdown'];
  signals: DetectionSignal[];
  userConfirmed: boolean;
} {
  const d = deal.deal_data || {};
  const prop = deal.property_data || {};
  const assumptions = deal.assumptions || {};
  const userConfirmed = !!deal.recommended;

  const rawPropType: string = d.property_type || prop.property_type || d.propertyType || prop.propertyType || deal.project_type || deal.deal_category || '';
  const unitCount  = Number(deal.unit_count || d.unit_count || d.units || assumptions.total_units || 0);
  const parcelCount = Number(d.parcel_count || deal.parcel_count || prop.parcel_count || 0);
  const avgRent    = Number(deal.avg_rent_per_unit || d.avg_rent || d.avg_rent_per_unit || 0);
  const stories    = Number(d.stories || assumptions.stories || 0);
  const constructionType = d.construction_type || prop.construction_type || '';
  const zoning     = d.zoning_classification || d.zoning || prop.zoning || '';
  const savedSlug  = deal.strategy_slug || null;

  const signals: DetectionSignal[] = [];

  // ── Step 1a: Parcel-structure heuristic — first-class SFR/MF classifier ──
  //
  // Spec Section 3.1: "one house per parcel = SFR; one building many units = MF"
  // This is checked before property-type string inference so that hard parcel
  // evidence beats potentially ambiguous label strings.

  let assetClass: AssetClass = 'other';

  if (parcelCount === 1 && (unitCount === 0 || unitCount <= 4)) {
    // Single parcel, ≤4 units (or units unknown) → SFR
    assetClass = 'sfr';
    signals.push({
      signal: 'parcel_structure',
      value: `parcel_count=1, units=${unitCount || 'unknown'}`,
      threshold: '1 parcel ≤4 units → SFR',
      contribution: 0,  // routing signal only; not a waterfall input
    });
  } else if (parcelCount === 1 && unitCount > 4) {
    // Single parcel, many units → multifamily
    assetClass = 'multifamily';
    signals.push({
      signal: 'parcel_structure',
      value: `parcel_count=1, units=${unitCount}`,
      threshold: '1 parcel >4 units → MF',
      contribution: 0,  // routing signal only; not a waterfall input
    });
  } else if (parcelCount > 1 && unitCount <= 4 * parcelCount) {
    // Multiple parcels each with ≤4 units → SFR portfolio
    assetClass = 'sfr';
    signals.push({
      signal: 'parcel_structure',
      value: `parcel_count=${parcelCount}, units=${unitCount}`,
      threshold: 'multi-parcel ≤4 units/parcel → SFR portfolio',
      contribution: 0,  // routing signal only
    });
  }

  // ── Step 1b: Property type string (secondary, yields to parcel heuristic) ──
  let propTypeBoost = 0;

  const fromPropType = inferAssetClassFromPropType(rawPropType);
  if (fromPropType) {
    // Only apply string inference if parcel heuristic did not already classify
    if (assetClass === 'other') {
      assetClass = fromPropType.assetClass;
    }
    propTypeBoost = fromPropType.confidence;
    signals.push({
      signal: 'property_type',
      value: rawPropType,
      threshold: 'string classification',
      contribution: 0,  // routing only; confidence is waterfall-driven per spec
    });
  }

  // Saved slug confirms asset class
  if (savedSlug) {
    const slugClass = savedSlug.startsWith('mf_') ? 'multifamily'
      : savedSlug.startsWith('sfr_')  ? 'sfr'
      : savedSlug.startsWith('retail_') ? 'retail'
      : savedSlug.startsWith('office_') ? 'office'
      : savedSlug.startsWith('industrial_') ? 'industrial'
      : savedSlug.startsWith('hospitality_') ? 'hospitality'
      : null;
    if (slugClass) {
      if (assetClass === 'other') assetClass = slugClass as AssetClass;
      signals.push({ signal: 'saved_slug', value: savedSlug, threshold: 'prior classification confirmation', contribution: 0 });
    }
  }

  // Unit count fallback (when no parcel data and no string match)
  if (assetClass === 'other') {
    if (unitCount > 4) {
      assetClass = 'multifamily';
      signals.push({ signal: 'unit_count', value: String(unitCount), threshold: '>4 units → multifamily', contribution: 0 });
    } else if (unitCount >= 1 && unitCount <= 4) {
      assetClass = 'sfr';
    }
  }

  // Project type: development with no units → ground-up MF
  if (deal.project_type === 'development' && unitCount === 0 && assetClass === 'other') {
    assetClass = 'multifamily';
    signals.push({ signal: 'project_type', value: 'development', threshold: 'development project', contribution: 0 });
  }

  // Final fallback
  if (assetClass === 'other') {
    assetClass = 'multifamily';
  }

  // ── Step 2: Weighted waterfall ────────────────────────────────────────────
  //
  // assessor_code_match × 0.45 — TODO #M08-AC-01
  // (assessor codes not yet ingested into deal DB schema; score = 0 until ticket ships)
  const assessorScore = 0;

  // zoning_match × 0.20 — WIRED
  const zoningRaw = computeZoningScore(zoning, assetClass);
  const zoningScore = zoningRaw;
  if (zoning) {
    signals.push({
      signal: 'zoning_match',
      value: zoning,
      threshold: `${assetClass} zoning pattern`,
      contribution: zoningRaw * W_ZONING_MATCH,
    });
  } else {
    signals.push({ signal: 'zoning_match', value: '(not available)', threshold: 'no zoning field in deal_data', contribution: 0 });
  }

  // rent_roll_signal × 0.15 — WIRED
  const rentRollRaw = computeRentRollScore(unitCount, avgRent, assetClass);
  const rentRollScore = rentRollRaw;
  if (unitCount > 0 || avgRent > 0) {
    signals.push({
      signal: 'rent_roll_signal',
      value: `${unitCount} units, $${Math.round(avgRent)}/unit`,
      threshold: `${assetClass} rent roll structure`,
      contribution: rentRollRaw * W_RENT_ROLL_SIGNAL,
    });
  }

  // naics_signal × 0.10 — TODO #M08-AC-02
  // (NAICS codes not yet ingested into deal DB schema; score = 0 until ticket ships)
  const naicsScore = 0;

  // building_structure × 0.10 — WIRED
  const buildingRaw = computeBuildingStructureScore(stories, constructionType, unitCount, assetClass);
  const buildingScore = buildingRaw;
  if (stories > 0 || constructionType) {
    signals.push({
      signal: 'building_structure',
      value: `${stories} stories, ${constructionType || 'type unknown'}`,
      threshold: `${assetClass} building structure`,
      contribution: buildingRaw * W_BUILDING_STRUCT,
    });
  }

  // ── Step 3: Confidence = pure waterfall sum ───────────────────────────────
  //
  // Per spec Section 3.1: confidence is strictly the weighted waterfall sum.
  // Property type string is used only to identify the asset class (Stage 1 routing)
  // but must NOT influence the confidence score — it is not a verifiable data signal.
  //
  // Max confidence from wired inputs = 0.45 (zoning 0.20 + rent_roll 0.15 + building 0.10).
  // When assessor_code (#M08-AC-01) and NAICS (#M08-AC-02) ship the max rises to 0.90+.
  // Until then, most deals correctly receive requiresUserConfirmation: true.

  const waterfallScore =
    assessorScore    * W_ASSESSOR_CODE   +
    zoningScore      * W_ZONING_MATCH    +
    rentRollScore    * W_RENT_ROLL_SIGNAL +
    naicsScore       * W_NAICS_SIGNAL    +
    buildingScore    * W_BUILDING_STRUCT;

  const confidence = Math.min(0.98, waterfallScore);

  const subType = detectSubType(assetClass, deal);

  return {
    assetClass,
    subType,
    confidence: parseFloat(confidence.toFixed(2)),
    confidenceBreakdown: {
      assessorCode:     assessorScore,     // always 0 until #M08-AC-01
      zoningMatch:      parseFloat((zoningScore * W_ZONING_MATCH).toFixed(3)),
      rentRollSignal:   parseFloat((rentRollScore * W_RENT_ROLL_SIGNAL).toFixed(3)),
      naicsSignal:      naicsScore,        // always 0 until #M08-AC-02
      buildingStructure: parseFloat((buildingScore * W_BUILDING_STRUCT).toFixed(3)),
    },
    signals,
    userConfirmed,
  };
}

// ─── Orchestrated entry point ─────────────────────────────────────────────────
// Combines asset class detection + deal type detection into a single DetectionResult.

export function detectAssetClassAndDealType(deal: Record<string, any>): DetectionResult {
  const d = deal.deal_data || {};
  const lossToLease = Number(d.loss_to_lease || d.lossToLease || 0);
  const occupancy   = Number(d.occupancy || d.occupancy_rate || 0);
  const dscr        = Number(d.dscr || 0);
  const capitalGap  = Number(d.capital_gap_per_unit || d.capex_per_unit || deal.tdc_per_unit || 0);

  const ac = detectAssetClass(deal);
  const dt = detectDealType(ac.assetClass, deal);

  const allSignals = [...ac.signals, ...dt.signals];

  // Stage 1 waterfall confidence drives requiresUserConfirmation per spec.
  // The blended combined metric (ac + dt) is stored as dealTypeConfidence for
  // display/ranking use only — it does NOT control requiresUserConfirmation.
  const dealTypeConfidence = parseFloat(
    Math.min(0.98, ac.confidence * 0.40 + dt.confidence * 0.60).toFixed(2)
  );

  const alternates = buildAlternates(ac.assetClass, dt.detectedSubStrategy, {
    lossToLease,
    occupancy,
    dscr,
    capitalGapPerUnit: capitalGap,
  });

  return {
    assetClass: ac.assetClass,
    subType: ac.subType,
    detectedDealType: dt.detectedDealType,
    detectedSubStrategy: dt.detectedSubStrategy,
    confidence: ac.confidence,              // Stage 1 waterfall only
    requiresUserConfirmation: ac.confidence < 0.70,  // strictly waterfall-driven
    confidenceBreakdown: ac.confidenceBreakdown,
    dealTypeConfidence,                     // blended metadata (display/ranking)
    detectionSignals: allSignals,
    alternateSubStrategies: alternates,
    userConfirmed: ac.userConfirmed,
    userOverrideClassification: undefined,
  };
}
