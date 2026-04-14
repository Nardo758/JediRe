/**
 * Asset Class Detection Service — M08 v2 Stage 1
 *
 * Rule-based detection engine that classifies the asset class and deal type
 * from raw deal data (property type, unit count, deal_data JSON, zoning, etc.).
 * Returns a DetectionResult with confidence scores and signal evidence.
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
  confidence: number;
  detectionSignals: DetectionSignal[];
  alternateSubStrategies: AlternateSubStrategy[];
  userConfirmed: boolean;
  userOverrideClassification?: string;
}

// Sub-strategy key → human name
export const SUB_STRATEGY_NAMES: Record<string, string> = {
  mf_value_add_standard: 'Multifamily Value-Add',
  mf_deep_value_add: 'Multifamily Deep Value-Add',
  mf_core: 'Multifamily Core',
  mf_core_plus: 'Multifamily Core-Plus',
  mf_distressed: 'Multifamily Distressed / Opportunistic',
  mf_lease_up: 'Multifamily Lease-Up',
  mf_bts_ground_up: 'Multifamily Ground-Up Development',
  mf_str: 'Short-Term Rental (MF)',
  sfr_fix_flip: 'SFR Fix-and-Flip',
  sfr_brrrr: 'SFR BRRRR',
  sfr_hold: 'SFR Hold (Scattered)',
  sfr_portfolio_agg: 'SFR Portfolio Aggregation',
  sfr_btr: 'SFR Build-to-Rent',
  sfr_str: 'SFR STR (Vacation Rental)',
  sfr_mtr: 'SFR MTR (Mid-Term)',
  sfr_wholesale: 'SFR Wholesale',
  retail_nnn_core: 'Retail NNN Core',
  retail_grocery_anchored: 'Retail Grocery-Anchored Reposition',
  retail_value_add: 'Retail Value-Add Reposition',
  retail_last_mile: 'Retail → Flex / Last-Mile Conversion',
  office_adaptive_reuse: 'Office Adaptive Reuse',
  office_medical: 'Office Medical Conversion',
  office_tenant_rollup: 'Office Tenant Rollup Reposition',
  industrial_last_mile: 'Industrial Last-Mile',
  industrial_core: 'Industrial Core',
  hospitality_reflag: 'Hospitality Reflag',
  hospitality_extended_stay: 'Hospitality Extended-Stay Conversion',
};

// Sub-strategy → family
export const SUB_STRATEGY_FAMILY: Record<string, string> = {
  mf_value_add_standard: 'rental',
  mf_deep_value_add: 'rental',
  mf_core: 'rental',
  mf_core_plus: 'rental',
  mf_distressed: 'rental',
  mf_lease_up: 'rental',
  mf_bts_ground_up: 'bts',
  mf_str: 'str',
  sfr_fix_flip: 'flip',
  sfr_brrrr: 'sfr',
  sfr_hold: 'sfr',
  sfr_portfolio_agg: 'sfr',
  sfr_btr: 'sfr',
  sfr_str: 'str',
  sfr_mtr: 'str',
  sfr_wholesale: 'flip',
  retail_nnn_core: 'retail_specific',
  retail_grocery_anchored: 'retail_specific',
  retail_value_add: 'retail_specific',
  retail_last_mile: 'retail_specific',
  office_adaptive_reuse: 'office_specific',
  office_medical: 'office_specific',
  office_tenant_rollup: 'office_specific',
  industrial_last_mile: 'industrial_specific',
  industrial_core: 'industrial_specific',
  hospitality_reflag: 'hospitality_specific',
  hospitality_extended_stay: 'hospitality_specific',
};

// Signal weight matrix per sub-strategy (Demand, Supply, Momentum, Position, Risk)
export const SUB_STRATEGY_WEIGHTS: Record<string, Record<string, number>> = {
  mf_value_add_standard: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  mf_deep_value_add: { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.15, risk: 0.15 },
  mf_core: { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  mf_core_plus: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
  mf_distressed: { demand: 0.20, supply: 0.15, momentum: 0.15, position: 0.20, risk: 0.30 },
  mf_lease_up: { demand: 0.35, supply: 0.30, momentum: 0.15, position: 0.10, risk: 0.10 },
  mf_bts_ground_up: { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  mf_str: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_fix_flip: { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  sfr_brrrr: { demand: 0.20, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.15 },
  sfr_hold: { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  sfr_portfolio_agg: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  sfr_btr: { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  sfr_str: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_mtr: { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_wholesale: { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  retail_nnn_core: { demand: 0.20, supply: 0.10, momentum: 0.10, position: 0.35, risk: 0.25 },
  retail_grocery_anchored: { demand: 0.25, supply: 0.15, momentum: 0.15, position: 0.30, risk: 0.15 },
  retail_value_add: { demand: 0.30, supply: 0.15, momentum: 0.20, position: 0.25, risk: 0.10 },
  retail_last_mile: { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.10 },
  office_adaptive_reuse: { demand: 0.35, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.15 },
  office_medical: { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.20, risk: 0.15 },
  office_tenant_rollup: { demand: 0.15, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.20 },
  industrial_last_mile: { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.05 },
  industrial_core: { demand: 0.20, supply: 0.25, momentum: 0.15, position: 0.25, risk: 0.15 },
  hospitality_reflag: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.25, risk: 0.10 },
  hospitality_extended_stay: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
};

function normalizePropType(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[_\-\s]+/g, '_');
}

function inferAssetClassFromPropType(propType: string): AssetClass | null {
  const t = normalizePropType(propType);
  if (/(multifamily|apartment|multi_family|mf|residential_multi|garden|mid_rise|high_rise|condo|townhome)/i.test(t)) return 'multifamily';
  if (/(sfr|single_family|single_house|single_fam|residential_single|detached|1_4_unit|fourplex)/i.test(t)) return 'sfr';
  if (/(retail|strip|shopping|mall|outparcel|nnn|net_lease|power_center|grocery)/i.test(t)) return 'retail';
  if (/(office|medical_office|flex_office)/i.test(t)) return 'office';
  if (/(industrial|warehouse|flex_industrial|manufacturing|cold_storage|ios)/i.test(t)) return 'industrial';
  if (/(hotel|motel|hospitality|lodging|resort|inn|bnb)/i.test(t)) return 'hospitality';
  if (/(mixed|mixed_use)/i.test(t)) return 'mixed_use';
  if (/(land|vacant|lot|acreage|raw_land)/i.test(t)) return 'vacant_land';
  return null;
}

/**
 * Detect asset class and deal type from deal data.
 * deal: row from deals table joined with deal_data, deal_assumptions, strategy_analyses
 */
export function detectAssetClassAndDealType(deal: Record<string, any>): DetectionResult {
  const dealData = deal.deal_data || {};
  const propertyData = deal.property_data || {};
  const triage = deal.triage_result || {};
  const assumptions = deal.assumptions || {};

  // ── Existing user override / saved strategy_slug ──────────────────────────
  const savedSlug: string | null = deal.strategy_slug || null;
  const userConfirmed = !!deal.recommended;

  // ── Signals ───────────────────────────────────────────────────────────────
  const rawPropType: string =
    dealData.property_type ||
    propertyData.property_type ||
    dealData.propertyType ||
    propertyData.propertyType ||
    deal.project_type ||
    deal.deal_category ||
    '';

  const unitCount: number = Number(
    deal.unit_count ||
    dealData.unit_count ||
    dealData.units ||
    assumptions.total_units ||
    0
  );

  const occupancy: number = Number(
    dealData.occupancy ||
    dealData.occupancy_rate ||
    assumptions.occupancy_pct ||
    triage.occupancy ||
    0
  );

  const lossToLease: number = Number(
    dealData.loss_to_lease ||
    dealData.lossToLease ||
    assumptions.loss_to_lease ||
    0
  );

  const dscr: number = Number(
    dealData.dscr ||
    assumptions.dscr ||
    0
  );

  const opsScore: number = Number(
    dealData.ops_score ||
    dealData.pcs_score ||
    0
  );

  const capitalGapPerUnit: number = Number(
    dealData.capital_gap_per_unit ||
    dealData.capex_per_unit ||
    assumptions.tdc_per_unit ||
    0
  );

  const projectType: string = deal.project_type || '';
  const developmentType: string = deal.development_type || '';
  const parcelCount: number = Number(dealData.parcel_count || 1);

  // ── Asset class detection ─────────────────────────────────────────────────
  let assetClass: AssetClass = 'other';
  let assetClassConfidence = 0;
  const signals: DetectionSignal[] = [];

  // Try property type string first
  const fromPropType = inferAssetClassFromPropType(rawPropType);
  if (fromPropType) {
    assetClass = fromPropType;
    assetClassConfidence += 0.45;
    signals.push({
      signal: 'property_type',
      value: rawPropType,
      threshold: 'type classification',
      contribution: 0.45,
    });
  }

  // Saved slug override
  if (savedSlug) {
    if (/multifamily|value.add|core|lease.up|distressed/i.test(savedSlug)) {
      assetClass = 'multifamily';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    } else if (/sfr|brrrr|fix.flip|btr/i.test(savedSlug)) {
      assetClass = 'sfr';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    } else if (/retail|nnn/i.test(savedSlug)) {
      assetClass = 'retail';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    } else if (/office/i.test(savedSlug)) {
      assetClass = 'office';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    } else if (/industrial/i.test(savedSlug)) {
      assetClass = 'industrial';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    } else if (/hotel|hospitality/i.test(savedSlug)) {
      assetClass = 'hospitality';
      assetClassConfidence = Math.min(1, assetClassConfidence + 0.20);
    }
  }

  // Unit count heuristic
  if (assetClass === 'other' || assetClass === 'sfr') {
    if (unitCount > 4) {
      assetClass = 'multifamily';
      assetClassConfidence += 0.15;
      signals.push({
        signal: 'unit_count',
        value: String(unitCount),
        threshold: '>4 units → multifamily',
        contribution: 0.15,
      });
    } else if (unitCount >= 1 && unitCount <= 4) {
      if (assetClass === 'other') assetClass = 'sfr';
      assetClassConfidence += 0.10;
    }
  }

  // Project type: development → could be BTS or SFR BTR
  if (projectType === 'development' && unitCount === 0) {
    if (assetClass === 'other') assetClass = 'multifamily';
    signals.push({
      signal: 'project_type',
      value: projectType,
      threshold: 'development project',
      contribution: 0.10,
    });
    assetClassConfidence += 0.10;
  }

  // Final fallback
  if (assetClass === 'other') {
    assetClass = 'multifamily';
    assetClassConfidence = Math.max(0.30, assetClassConfidence);
  }

  assetClassConfidence = Math.min(1, assetClassConfidence + 0.25);

  // ── Sub-type detection ────────────────────────────────────────────────────
  let subType = 'unknown';
  if (assetClass === 'multifamily') {
    const stories = Number(dealData.stories || assumptions.stories || 0);
    if (unitCount >= 100 || stories >= 5) subType = 'mid_rise';
    else if (unitCount >= 20) subType = 'garden';
    else subType = 'townhome';
  } else if (assetClass === 'sfr') {
    if (parcelCount >= 20) subType = 'scattered_portfolio';
    else if (unitCount >= 2 && unitCount <= 4) subType = '2_4_unit';
    else subType = 'single_house';
  } else if (assetClass === 'retail') {
    if (/nnn|net.lease/i.test(rawPropType)) subType = 'single_tenant_nnn';
    else if (/grocery|anchored/i.test(rawPropType)) subType = 'grocery_anchored';
    else if (/power|big.box/i.test(rawPropType)) subType = 'power_center';
    else subType = 'strip';
  } else if (assetClass === 'office') {
    subType = /medical/i.test(rawPropType) ? 'medical' : 'class_b_suburban';
  } else if (assetClass === 'industrial') {
    subType = /last.mile/i.test(rawPropType) ? 'last_mile' : 'warehouse';
  } else if (assetClass === 'hospitality') {
    subType = /extended|stay/i.test(rawPropType) ? 'extended_stay' : 'select_service';
  }

  // ── Deal type + primary sub-strategy detection ────────────────────────────
  let detectedDealType = 'unknown';
  let detectedSubStrategy = '';
  let subStrategySignals: DetectionSignal[] = [];
  let subStratConf = 0.50;

  if (assetClass === 'multifamily') {
    const mfResult = detectMFDealType({ unitCount, occupancy, lossToLease, dscr, opsScore, capitalGapPerUnit, projectType, developmentType, savedSlug });
    detectedDealType = mfResult.detectedDealType; detectedSubStrategy = mfResult.detectedSubStrategy; subStrategySignals = mfResult.signals; subStratConf = mfResult.confidence;
  } else if (assetClass === 'sfr') {
    const sfrResult = detectSFRDealType({ parcelCount, projectType, dealData, savedSlug });
    detectedDealType = sfrResult.detectedDealType; detectedSubStrategy = sfrResult.detectedSubStrategy; subStrategySignals = sfrResult.signals; subStratConf = sfrResult.confidence;
  } else if (assetClass === 'retail') {
    const retailResult = detectRetailDealType({ rawPropType, dealData, savedSlug });
    detectedDealType = retailResult.detectedDealType; detectedSubStrategy = retailResult.detectedSubStrategy; subStrategySignals = retailResult.signals; subStratConf = retailResult.confidence;
  } else if (assetClass === 'office') {
    const officeResult = detectOfficeDealType({ rawPropType, dealData, savedSlug });
    detectedDealType = officeResult.detectedDealType; detectedSubStrategy = officeResult.detectedSubStrategy; subStrategySignals = officeResult.signals; subStratConf = officeResult.confidence;
  } else if (assetClass === 'industrial') {
    detectedDealType = 'last_mile';
    detectedSubStrategy = 'industrial_last_mile';
  } else if (assetClass === 'hospitality') {
    detectedDealType = 'reflag';
    detectedSubStrategy = 'hospitality_reflag';
  } else {
    detectedDealType = 'value_add';
    detectedSubStrategy = 'mf_value_add_standard';
  }

  signals.push(...subStrategySignals);

  const confidence = Math.min(0.98, (assetClassConfidence * 0.40 + subStratConf * 0.60));

  // ── Alternates ────────────────────────────────────────────────────────────
  const alternates = buildAlternates(assetClass, detectedSubStrategy, { lossToLease, occupancy, dscr, capitalGapPerUnit });

  return {
    assetClass,
    subType,
    detectedDealType,
    detectedSubStrategy,
    confidence: parseFloat(confidence.toFixed(2)),
    detectionSignals: signals,
    alternateSubStrategies: alternates,
    userConfirmed,
    userOverrideClassification: undefined,
  };
}

// ─── Per-Asset-Class Decision Trees ──────────────────────────────────────────

function detectMFDealType(p: {
  unitCount: number;
  occupancy: number;
  lossToLease: number;
  dscr: number;
  opsScore: number;
  capitalGapPerUnit: number;
  projectType: string;
  developmentType: string;
  savedSlug: string | null;
}): { detectedDealType: string; detectedSubStrategy: string; signals: DetectionSignal[]; confidence: number } {
  const sigs: DetectionSignal[] = [];

  // Ground-up / vacant land
  if (p.projectType === 'development' && p.unitCount === 0) {
    sigs.push({ signal: 'project_type', value: 'development', threshold: 'development + no units', contribution: 0.50 });
    return { detectedDealType: 'ground_up_bts', detectedSubStrategy: 'mf_bts_ground_up', signals: sigs, confidence: 0.80 };
  }

  // Distressed: DSCR < 1.0 or very low occupancy
  if ((p.dscr > 0 && p.dscr < 1.0) || (p.occupancy > 0 && p.occupancy < 0.75)) {
    sigs.push({ signal: 'dscr', value: String(p.dscr), threshold: '<1.0', contribution: 0.40 });
    if (p.occupancy > 0 && p.occupancy < 0.75) {
      sigs.push({ signal: 'occupancy', value: `${Math.round(p.occupancy * 100)}%`, threshold: '<75%', contribution: 0.30 });
    }
    return { detectedDealType: 'distressed', detectedSubStrategy: 'mf_distressed', signals: sigs, confidence: 0.85 };
  }

  // Value-add: loss-to-lease > 8% or low ops score
  if (p.lossToLease > 0.08 || (p.opsScore > 0 && p.opsScore < 60)) {
    sigs.push({ signal: 'loss_to_lease', value: `${Math.round(p.lossToLease * 100)}%`, threshold: '>8%', contribution: 0.35 });
    if (p.opsScore > 0 && p.opsScore < 60) {
      sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '<60', contribution: 0.20 });
    }

    // Deep value-add: capital gap > $40K/unit
    if (p.capitalGapPerUnit > 40000) {
      sigs.push({ signal: 'capital_gap', value: `$${Math.round(p.capitalGapPerUnit / 1000)}K/unit`, threshold: '>$40K/unit', contribution: 0.25 });
      return { detectedDealType: 'deep_value_add', detectedSubStrategy: 'mf_deep_value_add', signals: sigs, confidence: 0.82 };
    }

    if (p.capitalGapPerUnit > 0) {
      sigs.push({ signal: 'capital_gap', value: `$${Math.round(p.capitalGapPerUnit / 1000)}K/unit`, threshold: '<$40K/unit', contribution: 0.15 });
    }
    return { detectedDealType: 'value_add', detectedSubStrategy: 'mf_value_add_standard', signals: sigs, confidence: 0.84 };
  }

  // Core-plus: loss-to-lease 3-8% and decent ops score
  if (p.lossToLease >= 0.03 && p.lossToLease <= 0.08 && p.opsScore >= 60 && p.opsScore <= 75) {
    sigs.push({ signal: 'loss_to_lease', value: `${Math.round(p.lossToLease * 100)}%`, threshold: '3-8%', contribution: 0.30 });
    sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '60-75', contribution: 0.25 });
    return { detectedDealType: 'core_plus', detectedSubStrategy: 'mf_core_plus', signals: sigs, confidence: 0.75 };
  }

  // Core: stabilized, low LTL, strong ops
  if (p.opsScore >= 75 && p.occupancy >= 0.93) {
    sigs.push({ signal: 'ops_score', value: String(p.opsScore), threshold: '>75', contribution: 0.30 });
    sigs.push({ signal: 'occupancy', value: `${Math.round(p.occupancy * 100)}%`, threshold: '≥93%', contribution: 0.25 });
    return { detectedDealType: 'core', detectedSubStrategy: 'mf_core', signals: sigs, confidence: 0.78 };
  }

  // Fallback: use saved slug if available
  if (p.savedSlug) {
    if (/deep.value/i.test(p.savedSlug)) return { detectedDealType: 'deep_value_add', detectedSubStrategy: 'mf_deep_value_add', signals: sigs, confidence: 0.60 };
    if (/core.plus/i.test(p.savedSlug)) return { detectedDealType: 'core_plus', detectedSubStrategy: 'mf_core_plus', signals: sigs, confidence: 0.60 };
    if (/core(?!.plus)/i.test(p.savedSlug)) return { detectedDealType: 'core', detectedSubStrategy: 'mf_core', signals: sigs, confidence: 0.60 };
    if (/distressed|opportunistic/i.test(p.savedSlug)) return { detectedDealType: 'distressed', detectedSubStrategy: 'mf_distressed', signals: sigs, confidence: 0.60 };
  }

  // Default MF value-add
  sigs.push({ signal: 'fallback', value: 'default', threshold: 'no strong signal', contribution: 0.10 });
  return { detectedDealType: 'value_add', detectedSubStrategy: 'mf_value_add_standard', signals: sigs, confidence: 0.55 };
}

function detectSFRDealType(p: {
  parcelCount: number;
  projectType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}): { detectedDealType: string; detectedSubStrategy: string; signals: DetectionSignal[]; confidence: number } {
  const sigs: DetectionSignal[] = [];

  if (p.parcelCount >= 20) {
    sigs.push({ signal: 'parcel_count', value: String(p.parcelCount), threshold: '≥20 parcels', contribution: 0.45 });
    return { detectedDealType: 'sfr_portfolio_aggregation', detectedSubStrategy: 'sfr_portfolio_agg', signals: sigs, confidence: 0.82 };
  }

  if (p.projectType === 'development') {
    sigs.push({ signal: 'project_type', value: 'development', threshold: 'new SFR development', contribution: 0.40 });
    return { detectedDealType: 'sfr_btr', detectedSubStrategy: 'sfr_btr', signals: sigs, confidence: 0.75 };
  }

  if (p.savedSlug) {
    if (/brrrr/i.test(p.savedSlug)) return { detectedDealType: 'sfr_brrrr', detectedSubStrategy: 'sfr_brrrr', signals: sigs, confidence: 0.65 };
    if (/fix.flip|flip/i.test(p.savedSlug)) return { detectedDealType: 'sfr_fix_flip', detectedSubStrategy: 'sfr_fix_flip', signals: sigs, confidence: 0.65 };
    if (/str|vacation/i.test(p.savedSlug)) return { detectedDealType: 'sfr_str', detectedSubStrategy: 'sfr_str', signals: sigs, confidence: 0.65 };
    if (/mtr|mid.term/i.test(p.savedSlug)) return { detectedDealType: 'sfr_mtr', detectedSubStrategy: 'sfr_mtr', signals: sigs, confidence: 0.65 };
  }

  sigs.push({ signal: 'single_house', value: '1 parcel', threshold: 'single family', contribution: 0.30 });
  return { detectedDealType: 'sfr_hold', detectedSubStrategy: 'sfr_hold', signals: sigs, confidence: 0.60 };
}

function detectRetailDealType(p: {
  rawPropType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}): { detectedDealType: string; detectedSubStrategy: string; signals: DetectionSignal[]; confidence: number } {
  const sigs: DetectionSignal[] = [];
  const t = p.rawPropType.toLowerCase();

  if (/nnn|net.lease|single.tenant/i.test(t)) {
    sigs.push({ signal: 'property_type', value: t, threshold: 'NNN single tenant', contribution: 0.50 });
    return { detectedDealType: 'retail_nnn_core', detectedSubStrategy: 'retail_nnn_core', signals: sigs, confidence: 0.80 };
  }

  if (/grocery|anchored/i.test(t)) {
    sigs.push({ signal: 'property_type', value: t, threshold: 'grocery-anchored', contribution: 0.45 });
    return { detectedDealType: 'retail_grocery_anchored', detectedSubStrategy: 'retail_grocery_anchored', signals: sigs, confidence: 0.78 };
  }

  sigs.push({ signal: 'property_type', value: t, threshold: 'retail value-add', contribution: 0.30 });
  return { detectedDealType: 'retail_value_add', detectedSubStrategy: 'retail_value_add', signals: sigs, confidence: 0.65 };
}

function detectOfficeDealType(p: {
  rawPropType: string;
  dealData: Record<string, any>;
  savedSlug: string | null;
}): { detectedDealType: string; detectedSubStrategy: string; signals: DetectionSignal[]; confidence: number } {
  const sigs: DetectionSignal[] = [];
  const vacancy = Number(p.dealData.vacancy || 0);

  if (vacancy > 0.30) {
    sigs.push({ signal: 'vacancy', value: `${Math.round(vacancy * 100)}%`, threshold: '>30%', contribution: 0.40 });
    return { detectedDealType: 'office_adaptive_reuse', detectedSubStrategy: 'office_adaptive_reuse', signals: sigs, confidence: 0.78 };
  }

  if (/medical/i.test(p.rawPropType)) {
    sigs.push({ signal: 'property_type', value: p.rawPropType, threshold: 'medical office', contribution: 0.45 });
    return { detectedDealType: 'office_medical', detectedSubStrategy: 'office_medical', signals: sigs, confidence: 0.80 };
  }

  sigs.push({ signal: 'default', value: 'office', threshold: 'tenant rollup', contribution: 0.25 });
  return { detectedDealType: 'office_tenant_rollup', detectedSubStrategy: 'office_tenant_rollup', signals: sigs, confidence: 0.60 };
}

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
      if (metrics.lossToLease > 0.12) {
        alts.push({ key: 'mf_bts_ground_up', fit: 0.30, reason: 'If zoning allows 3x+ density and land residual is positive' });
      }
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
