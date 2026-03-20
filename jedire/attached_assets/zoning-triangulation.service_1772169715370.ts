import { Pool } from 'pg';
import { ParcelIngestionService } from './parcel-ingestion.service';
import { ZoningKnowledgeService, ZoningDistrictProfile } from './zoning-knowledge.service';
import { municodeUrlService } from './municode-url.service';
import { zoningEventBus, ZONING_EVENTS } from './zoning-event-bus.service';
import { logger } from '../utils/logger';

/**
 * Zoning Triangulation Service
 * 
 * Three-source feedback loop that cross-references:
 *   Source A: County Parcel Records  → authoritative zoning designation
 *   Source B: County Zoning Categories → category-level rules from county
 *   Source C: Municode Ordinance → specific dimensional standards
 * 
 * Confirms four things:
 *   1. CODE   — what zoning designation applies (parcel record is truth)
 *   2. PROCESS — what entitlement path is needed (precedent + code)
 *   3. TIMELINE — how long it takes (calibrated from outcomes)
 *   4. MATH   — FAR, density, height, setbacks, parking (municode detail)
 * 
 * Outcomes feed back through jurisdiction_calibration to adjust source weights.
 */

// ============================================================================
// Types
// ============================================================================

export interface TriangulationInput {
  dealId?: string;
  parcelId?: string;
  lat?: number;
  lng?: number;
  municipality: string;
  state: string;
  userProvidedZoningCode?: string;  // what user/GIS thinks the code is
}

export interface FieldReconciliation {
  value: any;
  source: 'county_parcel' | 'county_category' | 'municode' | 'user_override';
  countyParcelValue?: any;
  countyCategoryValue?: any;
  municodeValue?: any;
  confidence: number;
  discrepancy: boolean;
  note?: string;
}

export interface TriangulationResult {
  id: string;
  status: 'pending' | 'partial' | 'complete' | 'confirmed' | 'conflict' | 'stale';

  // Source availability
  sourceA: { available: boolean; zoningCode?: string; parcelUuid?: string };
  sourceB: { available: boolean; categoryCode?: string; categoryUuid?: string };
  sourceC: { available: boolean; districtUuid?: string; municodeUrl?: string };

  // Reconciled code
  reconciledZoningCode: string | null;
  codeAgreement: boolean;
  codeDiscrepancy?: string;

  // Reconciled math (dimensional standards)
  reconciledStandards: {
    maxDensityPerAcre: FieldReconciliation;
    maxHeightFt: FieldReconciliation;
    maxFar: FieldReconciliation;
    maxLotCoverage: FieldReconciliation;
    setbackFrontFt: FieldReconciliation;
    setbackSideFt: FieldReconciliation;
    setbackRearFt: FieldReconciliation;
    parkingPerUnit: FieldReconciliation;
  };

  // Process + timeline
  entitlementPath: string | null;
  processConfidence: number;
  predictedTimelineMonths: number | null;
  timelineConfidence: number;

  // Overall
  overallConfidence: number;
  jurisdictionMaturity: string;
}

// Source weights — defaults, overridden by jurisdiction_calibration
const DEFAULT_WEIGHTS = {
  countyParcel: 0.40,      // highest for CODE confirmation
  countyCategory: 0.25,    // useful for category-level rules
  municode: 0.35,          // highest for MATH confirmation
};

// For math reconciliation, municode gets higher weight
const MATH_WEIGHTS = {
  countyParcel: 0.10,
  countyCategory: 0.30,
  municode: 0.60,
};


// ============================================================================
// Service
// ============================================================================

export class ZoningTriangulationService {
  private parcelService: ParcelIngestionService;
  private knowledgeService: ZoningKnowledgeService;

  constructor(private pool: Pool) {
    this.parcelService = new ParcelIngestionService(pool);
    this.knowledgeService = new ZoningKnowledgeService(pool);
  }

  /**
   * Main entry: triangulate all three sources for a deal/parcel
   */
  async triangulate(input: TriangulationInput): Promise<TriangulationResult> {
    const { dealId, municipality, state } = input;

    // Load jurisdiction calibration (or defaults)
    const calibration = await this.getCalibration(municipality, state);
    const weights = calibration?.weight_county_parcel
      ? {
          countyParcel: parseFloat(calibration.weight_county_parcel),
          countyCategory: parseFloat(calibration.weight_county_category),
          municode: parseFloat(calibration.weight_municode),
        }
      : DEFAULT_WEIGHTS;

    // ---- Source A: County Parcel Record ----
    const sourceA = await this.resolveSourceA(input);

    // ---- Source B: County Zoning Category ----
    const zoningCodeForLookup = sourceA.zoningCode || input.userProvidedZoningCode;
    const sourceB = await this.resolveSourceB(zoningCodeForLookup, municipality, state);

    // ---- Source C: Municode / zoning_districts ----
    const sourceC = await this.resolveSourceC(zoningCodeForLookup, municipality);

    // ---- Reconcile CODE ----
    const codeReconciliation = this.reconcileCode(
      sourceA.zoningCode,
      sourceB.categoryCode,
      sourceC.districtCode,
      input.userProvidedZoningCode,
    );

    // ---- Reconcile MATH ----
    const standards = this.reconcileMath(sourceB.rules, sourceC.profile, MATH_WEIGHTS);

    // ---- Determine PROCESS ----
    const process = await this.determineProcess(
      codeReconciliation.reconciledCode,
      municipality,
      sourceC.profile,
    );

    // ---- Predict TIMELINE ----
    const timeline = await this.predictTimeline(
      municipality,
      state,
      process.entitlementPath,
      codeReconciliation.reconciledCode,
    );

    // ---- Compute overall confidence ----
    const sourcesAvailable = [sourceA.available, sourceB.available, sourceC.available].filter(Boolean).length;
    let status: TriangulationResult['status'] = 'pending';
    if (sourcesAvailable === 3) status = codeReconciliation.agreement ? 'complete' : 'conflict';
    else if (sourcesAvailable > 0) status = 'partial';

    const maturityLevel = calibration?.maturity_level || 'novice';
    const confidenceCap = calibration?.confidence_cap ? parseFloat(calibration.confidence_cap) : 0.75;

    const rawConfidence =
      (codeReconciliation.confidence * 0.30) +
      (this.avgFieldConfidence(standards) * 0.35) +
      (process.confidence * 0.15) +
      (timeline.confidence * 0.10) +
      ((sourcesAvailable / 3) * 0.10);

    const overallConfidence = Math.min(rawConfidence, confidenceCap);

    // ---- Persist ----
    const triId = await this.persistTriangulation({
      dealId,
      parcelId: sourceA.parcelId || input.parcelId,
      countyParcelUuid: sourceA.parcelUuid,
      sourceA,
      sourceB,
      sourceC,
      codeReconciliation,
      standards,
      process,
      timeline,
      status,
      overallConfidence,
    });

    // ---- Emit event ----
    zoningEventBus.publish(ZONING_EVENTS.VERIFICATION_COMPLETED || 'verification:completed', {
      triangulationId: triId,
      dealId,
      zoningCode: codeReconciliation.reconciledCode,
      confidence: overallConfidence,
      status,
    });

    return {
      id: triId,
      status,
      sourceA: {
        available: sourceA.available,
        zoningCode: sourceA.zoningCode,
        parcelUuid: sourceA.parcelUuid,
      },
      sourceB: {
        available: sourceB.available,
        categoryCode: sourceB.categoryCode,
        categoryUuid: sourceB.categoryUuid,
      },
      sourceC: {
        available: sourceC.available,
        districtUuid: sourceC.districtUuid,
        municodeUrl: sourceC.municodeUrl,
      },
      reconciledZoningCode: codeReconciliation.reconciledCode,
      codeAgreement: codeReconciliation.agreement,
      codeDiscrepancy: codeReconciliation.discrepancy,
      reconciledStandards: standards,
      entitlementPath: process.entitlementPath,
      processConfidence: process.confidence,
      predictedTimelineMonths: timeline.months,
      timelineConfidence: timeline.confidence,
      overallConfidence,
      jurisdictionMaturity: maturityLevel,
    };
  }

  /**
   * Record an actual outcome and recalibrate
   */
  async recordOutcome(input: {
    triangulationId: string;
    dealId?: string;
    actualZoningCode?: string;
    actualEntitlementPath?: string;
    actualTimelineMonths?: number;
    actualApprovedUnits?: number;
    actualApprovedFar?: number;
    actualOutcome: string;
    reportedBy: string;
    notes?: string;
  }): Promise<string> {
    // Load the original triangulation
    const tri = await this.pool.query(
      'SELECT * FROM zoning_triangulations WHERE id = $1',
      [input.triangulationId]
    );
    if (tri.rows.length === 0) throw new Error('Triangulation not found');
    const original = tri.rows[0];

    // Compute deltas
    const deltaTimeline = original.predicted_timeline_months && input.actualTimelineMonths
      ? parseFloat(original.predicted_timeline_months) - input.actualTimelineMonths
      : null;
    const deltaUnits = original.reconciled_max_density && input.actualApprovedUnits
      ? Math.round(parseFloat(original.reconciled_max_density)) - input.actualApprovedUnits
      : null;
    const deltaFar = original.reconciled_max_far && input.actualApprovedFar
      ? parseFloat(original.reconciled_max_far) - input.actualApprovedFar
      : null;

    // Determine which source was most accurate for the code
    const sourceAccuracy = this.scoreSourceAccuracy(original, input);

    const result = await this.pool.query(
      `INSERT INTO triangulation_outcomes (
        triangulation_id, deal_id,
        predicted_zoning_code, predicted_entitlement_path, predicted_timeline_months,
        predicted_max_units, predicted_max_far,
        actual_zoning_code, actual_entitlement_path, actual_timeline_months,
        actual_approved_units, actual_approved_far, actual_outcome,
        delta_timeline_months, delta_units, delta_far,
        most_accurate_source, source_accuracy_scores,
        reported_by, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING id`,
      [
        input.triangulationId, input.dealId || original.deal_id,
        original.reconciled_zoning_code, original.entitlement_path_confirmed,
        original.predicted_timeline_months,
        original.reconciled_max_density ? Math.round(parseFloat(original.reconciled_max_density)) : null,
        original.reconciled_max_far,
        input.actualZoningCode, input.actualEntitlementPath, input.actualTimelineMonths,
        input.actualApprovedUnits, input.actualApprovedFar, input.actualOutcome,
        deltaTimeline, deltaUnits, deltaFar,
        sourceAccuracy.mostAccurate, JSON.stringify(sourceAccuracy.scores),
        input.reportedBy, input.notes,
      ]
    );

    // Trigger recalibration for this jurisdiction
    const municipality = original.reconciled_zoning_code
      ? await this.getMunicipalityFromTriangulation(original)
      : null;
    if (municipality) {
      await this.recalibrate(municipality.municipality, municipality.state);
    }

    return result.rows[0].id;
  }

  /**
   * Recalibrate source weights for a jurisdiction based on all outcomes
   */
  async recalibrate(municipality: string, state: string): Promise<void> {
    const outcomes = await this.pool.query(
      `SELECT to2.*, zt.source_a_zoning_code, zt.source_b_category_code,
              zt.reconciled_zoning_code
       FROM triangulation_outcomes to2
       JOIN zoning_triangulations zt ON zt.id = to2.triangulation_id
       WHERE zt.reconciled_zoning_code IS NOT NULL
         AND to2.actual_outcome != 'pending'`,
    );

    if (outcomes.rows.length < 3) return; // need minimum data

    // Compute aggregate accuracy per source
    let parcelCorrect = 0, categoryCorrect = 0, municodeCorrect = 0;
    let totalTimelineBias = 0, timelineCount = 0;
    let totalDensityBias = 0, densityCount = 0;
    let totalFarBias = 0, farCount = 0;

    for (const row of outcomes.rows) {
      const scores = row.source_accuracy_scores || {};
      if (scores.county_parcel >= 0.8) parcelCorrect++;
      if (scores.county_category >= 0.8) categoryCorrect++;
      if (scores.municode >= 0.8) municodeCorrect++;

      if (row.delta_timeline_months !== null) {
        totalTimelineBias += parseFloat(row.delta_timeline_months);
        timelineCount++;
      }
      if (row.delta_units !== null) {
        totalDensityBias += parseInt(row.delta_units);
        densityCount++;
      }
      if (row.delta_far !== null) {
        totalFarBias += parseFloat(row.delta_far);
        farCount++;
      }
    }

    const total = outcomes.rows.length;
    const parcelAccuracy = (parcelCorrect / total) * 100;
    const categoryAccuracy = (categoryCorrect / total) * 100;
    const municodeAccuracy = (municodeCorrect / total) * 100;

    // Reweight: more accurate source gets more weight
    const accuracySum = parcelAccuracy + categoryAccuracy + municodeAccuracy;
    const newWeights = accuracySum > 0
      ? {
          parcel: parcelAccuracy / accuracySum,
          category: categoryAccuracy / accuracySum,
          municode: municodeAccuracy / accuracySum,
        }
      : DEFAULT_WEIGHTS;

    // Maturity level
    let maturityLevel = 'novice';
    let confidenceCap = 0.75;
    if (total >= 50) { maturityLevel = 'authority'; confidenceCap = 0.97; }
    else if (total >= 20) { maturityLevel = 'expert'; confidenceCap = 0.95; }
    else if (total >= 5) { maturityLevel = 'competent'; confidenceCap = 0.88; }

    await this.pool.query(
      `INSERT INTO jurisdiction_calibration (
        municipality, state, total_triangulations, total_outcomes,
        county_parcel_accuracy, county_category_accuracy, municode_accuracy,
        avg_timeline_bias_months, avg_density_bias, avg_far_bias,
        weight_county_parcel, weight_county_category, weight_municode,
        maturity_level, confidence_cap, last_calibrated_at
      ) VALUES ($1,$2, 0, $3, $4,$5,$6, $7,$8,$9, $10,$11,$12, $13,$14, NOW())
      ON CONFLICT (municipality, state) DO UPDATE SET
        total_outcomes = EXCLUDED.total_outcomes,
        county_parcel_accuracy = EXCLUDED.county_parcel_accuracy,
        county_category_accuracy = EXCLUDED.county_category_accuracy,
        municode_accuracy = EXCLUDED.municode_accuracy,
        avg_timeline_bias_months = EXCLUDED.avg_timeline_bias_months,
        avg_density_bias = EXCLUDED.avg_density_bias,
        avg_far_bias = EXCLUDED.avg_far_bias,
        weight_county_parcel = EXCLUDED.weight_county_parcel,
        weight_county_category = EXCLUDED.weight_county_category,
        weight_municode = EXCLUDED.weight_municode,
        maturity_level = EXCLUDED.maturity_level,
        confidence_cap = EXCLUDED.confidence_cap,
        last_calibrated_at = NOW(),
        updated_at = NOW()`,
      [
        municipality, state.toUpperCase(), total,
        parcelAccuracy, categoryAccuracy, municodeAccuracy,
        timelineCount > 0 ? totalTimelineBias / timelineCount : 0,
        densityCount > 0 ? totalDensityBias / densityCount : 0,
        farCount > 0 ? totalFarBias / farCount : 0,
        newWeights.parcel, newWeights.category, newWeights.municode,
        maturityLevel, confidenceCap,
      ]
    );

    logger.info(`Jurisdiction calibrated: ${municipality}, ${state} — maturity=${maturityLevel}, cap=${confidenceCap}, outcomes=${total}`);
  }

  /**
   * Get triangulation for a deal
   */
  async getForDeal(dealId: string): Promise<TriangulationResult | null> {
    const result = await this.pool.query(
      'SELECT * FROM zoning_triangulations WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1',
      [dealId]
    );
    if (result.rows.length === 0) return null;
    return this.rowToResult(result.rows[0]);
  }

  /**
   * User confirms the triangulation result
   */
  async userConfirm(triangulationId: string, overrides?: Record<string, any>): Promise<void> {
    await this.pool.query(
      `UPDATE zoning_triangulations SET
        triangulation_status = 'confirmed',
        user_confirmed = TRUE,
        user_confirmed_at = NOW(),
        user_override_fields = COALESCE($2, user_override_fields),
        overall_confidence = LEAST(overall_confidence + 0.05, 1.0)
       WHERE id = $1`,
      [triangulationId, overrides ? JSON.stringify(overrides) : null]
    );
  }


  // =========================================================================
  // Source resolution
  // =========================================================================

  private async resolveSourceA(input: TriangulationInput): Promise<{
    available: boolean;
    zoningCode?: string;
    parcelId?: string;
    parcelUuid?: string;
    lotAreaSf?: number;
  }> {
    let parcel: any = null;

    // Try matching by parcel ID
    if (input.parcelId) {
      const result = await this.pool.query(
        `SELECT * FROM county_parcels WHERE parcel_id = $1 LIMIT 1`,
        [input.parcelId]
      );
      parcel = result.rows[0];
    }

    // Try matching by coordinates
    if (!parcel && input.lat && input.lng) {
      const nearby = await this.parcelService.findNearby(input.lat, input.lng, 30);
      parcel = nearby[0] || null;
    }

    // Try matching via deal
    if (!parcel && input.dealId) {
      parcel = await this.parcelService.matchDealToParcel(input.dealId);
    }

    if (!parcel) {
      return { available: false };
    }

    return {
      available: true,
      zoningCode: parcel.county_zoning_code,
      parcelId: parcel.parcel_id,
      parcelUuid: parcel.id,
      lotAreaSf: parcel.lot_area_sf ? parseFloat(parcel.lot_area_sf) : undefined,
    };
  }

  private async resolveSourceB(
    zoningCode: string | undefined,
    municipality: string,
    state: string,
  ): Promise<{
    available: boolean;
    categoryCode?: string;
    categoryUuid?: string;
    rules?: any;
  }> {
    if (!zoningCode) return { available: false };

    const result = await this.pool.query(
      `SELECT * FROM county_zoning_categories
       WHERE UPPER(category_code) = UPPER($1)
         AND state = $2
         AND (UPPER(municipality) = UPPER($3) OR municipality IS NULL)
       ORDER BY municipality NULLS LAST
       LIMIT 1`,
      [zoningCode, state.toUpperCase(), municipality]
    );

    if (result.rows.length === 0) return { available: false };

    const cat = result.rows[0];
    return {
      available: true,
      categoryCode: cat.category_code,
      categoryUuid: cat.id,
      rules: {
        maxDensityPerAcre: cat.county_max_density_per_acre ? parseFloat(cat.county_max_density_per_acre) : null,
        maxHeightFt: cat.county_max_height_ft,
        maxFar: cat.county_max_far ? parseFloat(cat.county_max_far) : null,
        maxLotCoverage: cat.county_max_lot_coverage ? parseFloat(cat.county_max_lot_coverage) : null,
        setbackFrontFt: cat.county_setback_front_ft,
        setbackSideFt: cat.county_setback_side_ft,
        setbackRearFt: cat.county_setback_rear_ft,
        parkingPerUnit: cat.county_parking_per_unit ? parseFloat(cat.county_parking_per_unit) : null,
      },
    };
  }

  private async resolveSourceC(
    zoningCode: string | undefined,
    municipality: string,
  ): Promise<{
    available: boolean;
    districtCode?: string;
    districtUuid?: string;
    municodeUrl?: string;
    profile?: ZoningDistrictProfile | null;
  }> {
    if (!zoningCode) return { available: false };

    const lookup = await this.knowledgeService.lookupDistrict(zoningCode, municipality);

    if (!lookup.found) return { available: false };

    let municodeUrl: string | null = null;
    if (lookup.municipalityId) {
      try {
        municodeUrl = await municodeUrlService.buildDistrictUrl(lookup.municipalityId, zoningCode);
      } catch {}
    }

    return {
      available: true,
      districtCode: zoningCode,
      districtUuid: lookup.districtId || undefined,
      municodeUrl: municodeUrl || undefined,
      profile: lookup.profile,
    };
  }


  // =========================================================================
  // Reconciliation logic
  // =========================================================================

  private reconcileCode(
    parcelCode?: string,
    categoryCode?: string,
    municodeCode?: string,
    userCode?: string,
  ): { reconciledCode: string | null; agreement: boolean; confidence: number; discrepancy?: string } {
    const codes = [parcelCode, categoryCode, municodeCode].filter(Boolean) as string[];

    if (codes.length === 0) {
      return {
        reconciledCode: userCode || null,
        agreement: false,
        confidence: userCode ? 0.50 : 0,
        discrepancy: 'No source data available',
      };
    }

    // Normalize for comparison
    const normalize = (c: string) => c.toUpperCase().replace(/[\s-_]/g, '');
    const normalized = codes.map(normalize);
    const allMatch = normalized.every(c => c === normalized[0]);

    if (allMatch) {
      return {
        reconciledCode: parcelCode || categoryCode || municodeCode || null,
        agreement: true,
        confidence: 0.60 + (codes.length * 0.13), // 3 sources = 0.99
      };
    }

    // Disagreement: parcel record wins (most authoritative for code)
    const reconciledCode = parcelCode || categoryCode || municodeCode || null;
    const discrepancyParts: string[] = [];
    if (parcelCode && categoryCode && normalize(parcelCode) !== normalize(categoryCode)) {
      discrepancyParts.push(`Parcel says "${parcelCode}" but county category says "${categoryCode}"`);
    }
    if (parcelCode && municodeCode && normalize(parcelCode) !== normalize(municodeCode)) {
      discrepancyParts.push(`Parcel says "${parcelCode}" but Municode match is "${municodeCode}"`);
    }

    return {
      reconciledCode,
      agreement: false,
      confidence: 0.55,
      discrepancy: discrepancyParts.join('; '),
    };
  }

  private reconcileMath(
    countyRules: any | undefined,
    municodeProfile: ZoningDistrictProfile | null | undefined,
    weights: typeof MATH_WEIGHTS,
  ): TriangulationResult['reconciledStandards'] {
    const mDim = municodeProfile?.dimensional;

    const reconcileField = (
      fieldName: string,
      countyVal: any,
      municodeVal: any,
    ): FieldReconciliation => {
      const hasCounty = countyVal !== null && countyVal !== undefined;
      const hasMunicode = municodeVal !== null && municodeVal !== undefined;

      if (!hasCounty && !hasMunicode) {
        return { value: null, source: 'municode', confidence: 0, discrepancy: false };
      }

      if (hasMunicode && !hasCounty) {
        return { value: municodeVal, source: 'municode', municodeValue: municodeVal, confidence: 0.85, discrepancy: false };
      }

      if (hasCounty && !hasMunicode) {
        return { value: countyVal, source: 'county_category', countyCategoryValue: countyVal, confidence: 0.70, discrepancy: false };
      }

      // Both available — check agreement
      const numCounty = parseFloat(countyVal);
      const numMunicode = parseFloat(municodeVal);
      const tolerance = Math.max(Math.abs(numMunicode) * 0.05, 1); // 5% or 1 unit
      const match = Math.abs(numCounty - numMunicode) <= tolerance;

      if (match) {
        // Agreement — use municode (more precise), high confidence
        return {
          value: municodeVal,
          source: 'municode',
          countyCategoryValue: countyVal,
          municodeValue: municodeVal,
          confidence: 0.95,
          discrepancy: false,
        };
      }

      // Disagreement — municode wins for math, flag discrepancy
      return {
        value: municodeVal,
        source: 'municode',
        countyCategoryValue: countyVal,
        municodeValue: municodeVal,
        confidence: 0.70,
        discrepancy: true,
        note: `County says ${countyVal}, Municode says ${municodeVal}. Using Municode (more specific).`,
      };
    };

    return {
      maxDensityPerAcre: reconcileField('maxDensityPerAcre', countyRules?.maxDensityPerAcre, mDim?.maxDensityUnitsPerAcre),
      maxHeightFt: reconcileField('maxHeightFt', countyRules?.maxHeightFt, mDim?.maxHeightFt),
      maxFar: reconcileField('maxFar', countyRules?.maxFar, mDim?.maxFAR),
      maxLotCoverage: reconcileField('maxLotCoverage', countyRules?.maxLotCoverage, mDim?.maxLotCoveragePct ? mDim.maxLotCoveragePct / 100 : null),
      setbackFrontFt: reconcileField('setbackFrontFt', countyRules?.setbackFrontFt, mDim?.setbacks?.front),
      setbackSideFt: reconcileField('setbackSideFt', countyRules?.setbackSideFt, mDim?.setbacks?.side),
      setbackRearFt: reconcileField('setbackRearFt', countyRules?.setbackRearFt, mDim?.setbacks?.rear),
      parkingPerUnit: reconcileField('parkingPerUnit', countyRules?.parkingPerUnit, municodeProfile?.parking?.residential?.perUnit),
    };
  }

  private async determineProcess(
    zoningCode: string | null,
    municipality: string,
    profile: ZoningDistrictProfile | null | undefined,
  ): Promise<{ entitlementPath: string | null; confidence: number }> {
    if (!zoningCode) return { entitlementPath: null, confidence: 0 };

    // Check precedent outcomes for this code + municipality
    const precedents = await this.pool.query(
      `SELECT actual_entitlement_path, COUNT(*) as cnt
       FROM triangulation_outcomes to2
       JOIN zoning_triangulations zt ON zt.id = to2.triangulation_id
       WHERE zt.reconciled_zoning_code = $1
         AND to2.actual_outcome IN ('approved_as_predicted', 'approved_with_conditions')
       GROUP BY actual_entitlement_path
       ORDER BY cnt DESC
       LIMIT 1`,
      [zoningCode]
    );

    if (precedents.rows.length > 0) {
      return {
        entitlementPath: precedents.rows[0].actual_entitlement_path,
        confidence: Math.min(0.95, 0.60 + parseInt(precedents.rows[0].cnt) * 0.05),
      };
    }

    // Fall back to profile uses
    if (profile?.uses?.byRight && profile.uses.byRight.length > 0) {
      const hasMultifamily = profile.uses.byRight.some(u =>
        u.use.toLowerCase().includes('multifamily') || u.use.toLowerCase().includes('multi_family')
      );
      if (hasMultifamily) {
        return { entitlementPath: 'by_right', confidence: 0.70 };
      }

      const conditionalMf = profile.uses.conditional?.some(u =>
        u.use.toLowerCase().includes('multifamily') || u.use.toLowerCase().includes('multi_family')
      );
      if (conditionalMf) {
        return { entitlementPath: 'cup', confidence: 0.65 };
      }
    }

    return { entitlementPath: 'by_right', confidence: 0.40 };
  }

  private async predictTimeline(
    municipality: string,
    state: string,
    entitlementPath: string | null,
    zoningCode: string | null,
  ): Promise<{ months: number | null; confidence: number }> {
    if (!entitlementPath) return { months: null, confidence: 0 };

    // Check calibrated averages from real outcomes
    const calibrated = await this.pool.query(
      `SELECT AVG(actual_timeline_months) as avg_months,
              STDDEV(actual_timeline_months) as stddev_months,
              COUNT(*) as cnt
       FROM triangulation_outcomes
       WHERE actual_entitlement_path = $1
         AND actual_timeline_months IS NOT NULL`,
      [entitlementPath]
    );

    if (calibrated.rows[0]?.cnt > 2) {
      const avg = parseFloat(calibrated.rows[0].avg_months);
      const cnt = parseInt(calibrated.rows[0].cnt);
      return {
        months: Math.round(avg * 10) / 10,
        confidence: Math.min(0.90, 0.50 + cnt * 0.05),
      };
    }

    // Defaults by entitlement path
    const defaults: Record<string, number> = {
      by_right: 2,
      variance: 6,
      cup: 8,
      sap: 12,
      rezone: 18,
    };

    return {
      months: defaults[entitlementPath] || 6,
      confidence: 0.35,
    };
  }


  // =========================================================================
  // Helpers
  // =========================================================================

  private avgFieldConfidence(standards: TriangulationResult['reconciledStandards']): number {
    const fields = Object.values(standards);
    const withValues = fields.filter(f => f.value !== null);
    if (withValues.length === 0) return 0;
    return withValues.reduce((sum, f) => sum + f.confidence, 0) / withValues.length;
  }

  private async getCalibration(municipality: string, state: string): Promise<any | null> {
    const result = await this.pool.query(
      'SELECT * FROM jurisdiction_calibration WHERE LOWER(municipality) = LOWER($1) AND state = $2',
      [municipality, state.toUpperCase()]
    );
    return result.rows[0] || null;
  }

  private scoreSourceAccuracy(
    original: any,
    outcome: { actualZoningCode?: string },
  ): { mostAccurate: string; scores: Record<string, number> } {
    const actual = outcome.actualZoningCode?.toUpperCase();
    if (!actual) return { mostAccurate: 'unknown', scores: {} };

    const norm = (c: string | null) => c?.toUpperCase().replace(/[\s-_]/g, '') || '';

    const parcelMatch = norm(original.source_a_zoning_code) === norm(actual) ? 1 : 0;
    const categoryMatch = norm(original.source_b_category_code) === norm(actual) ? 1 : 0;
    const municodeMatch = norm(original.reconciled_zoning_code) === norm(actual) ? 1 : 0;

    const scores = {
      county_parcel: parcelMatch,
      county_category: categoryMatch,
      municode: municodeMatch,
    };

    const best = Object.entries(scores).reduce((a, b) => a[1] >= b[1] ? a : b);

    return { mostAccurate: best[0], scores };
  }

  private async getMunicipalityFromTriangulation(row: any): Promise<{ municipality: string; state: string } | null> {
    if (row.deal_id) {
      const deal = await this.pool.query(
        `SELECT dzp.municipality, dzp.state 
         FROM deal_zoning_profiles dzp WHERE dzp.deal_id = $1`,
        [row.deal_id]
      );
      if (deal.rows[0]) return { municipality: deal.rows[0].municipality, state: deal.rows[0].state };
    }
    return null;
  }

  private async persistTriangulation(data: any): Promise<string> {
    const fieldReconciliation: Record<string, any> = {};
    if (data.standards) {
      for (const [key, val] of Object.entries(data.standards)) {
        fieldReconciliation[key] = val;
      }
    }

    const result = await this.pool.query(
      `INSERT INTO zoning_triangulations (
        deal_id, parcel_id, county_parcel_uuid,
        source_a_zoning_code, source_a_available, source_a_retrieved_at,
        source_b_category_code, source_b_category_uuid, source_b_available, source_b_retrieved_at,
        source_c_district_uuid, source_c_available, source_c_retrieved_at, source_c_municode_url,
        reconciled_zoning_code, code_agreement, code_discrepancy_detail,
        reconciled_max_density, reconciled_max_far,
        reconciled_max_height_ft,
        reconciled_setback_front_ft, reconciled_setback_side_ft, reconciled_setback_rear_ft,
        reconciled_parking_per_unit, reconciled_max_lot_coverage,
        field_reconciliation,
        entitlement_path_confirmed, process_confidence,
        predicted_timeline_months, timeline_confidence,
        triangulation_status, overall_confidence, triangulated_at
      ) VALUES (
        $1,$2,$3,
        $4,$5,NOW(),
        $6,$7,$8,NOW(),
        $9,$10,NOW(),$11,
        $12,$13,$14,
        $15,$16,$17,$18,$19,$20,$21,$22,
        $23,
        $24,$25,
        $26,$27,
        $28,$29,NOW()
      )
      ON CONFLICT (deal_id, parcel_id) WHERE deal_id IS NOT NULL
      DO UPDATE SET
        source_a_zoning_code = EXCLUDED.source_a_zoning_code,
        source_a_available = EXCLUDED.source_a_available,
        source_a_retrieved_at = NOW(),
        source_b_category_code = EXCLUDED.source_b_category_code,
        source_b_available = EXCLUDED.source_b_available,
        source_b_retrieved_at = NOW(),
        source_c_district_uuid = EXCLUDED.source_c_district_uuid,
        source_c_available = EXCLUDED.source_c_available,
        source_c_retrieved_at = NOW(),
        source_c_municode_url = EXCLUDED.source_c_municode_url,
        reconciled_zoning_code = EXCLUDED.reconciled_zoning_code,
        code_agreement = EXCLUDED.code_agreement,
        code_discrepancy_detail = EXCLUDED.code_discrepancy_detail,
        reconciled_max_density = EXCLUDED.reconciled_max_density,
        reconciled_max_far = EXCLUDED.reconciled_max_far,
        reconciled_max_height_ft = EXCLUDED.reconciled_max_height_ft,
        reconciled_setback_front_ft = EXCLUDED.reconciled_setback_front_ft,
        reconciled_setback_side_ft = EXCLUDED.reconciled_setback_side_ft,
        reconciled_setback_rear_ft = EXCLUDED.reconciled_setback_rear_ft,
        reconciled_parking_per_unit = EXCLUDED.reconciled_parking_per_unit,
        reconciled_max_lot_coverage = EXCLUDED.reconciled_max_lot_coverage,
        field_reconciliation = EXCLUDED.field_reconciliation,
        entitlement_path_confirmed = EXCLUDED.entitlement_path_confirmed,
        process_confidence = EXCLUDED.process_confidence,
        predicted_timeline_months = EXCLUDED.predicted_timeline_months,
        timeline_confidence = EXCLUDED.timeline_confidence,
        triangulation_status = EXCLUDED.triangulation_status,
        overall_confidence = EXCLUDED.overall_confidence,
        triangulated_at = NOW(),
        updated_at = NOW()
      RETURNING id`,
      [
        data.dealId || null,
        data.parcelId || null,
        data.countyParcelUuid || null,
        data.sourceA.zoningCode || null,
        data.sourceA.available,
        data.sourceB.categoryCode || null,
        data.sourceB.categoryUuid || null,
        data.sourceB.available,
        data.sourceC.districtUuid || null,
        data.sourceC.available,
        data.sourceC.municodeUrl || null,
        data.codeReconciliation.reconciledCode,
        data.codeReconciliation.agreement,
        data.codeReconciliation.discrepancy || null,
        data.standards.maxDensityPerAcre.value,
        data.standards.maxFar.value,
        data.standards.maxHeightFt.value,
        data.standards.setbackFrontFt.value,
        data.standards.setbackSideFt.value,
        data.standards.setbackRearFt.value,
        data.standards.parkingPerUnit.value,
        data.standards.maxLotCoverage.value,
        JSON.stringify(fieldReconciliation),
        data.process.entitlementPath,
        data.process.confidence,
        data.timeline.months,
        data.timeline.confidence,
        data.status,
        data.overallConfidence,
      ]
    );

    return result.rows[0].id;
  }

  private rowToResult(row: any): TriangulationResult {
    const fields = row.field_reconciliation || {};
    const makeField = (key: string, fallbackValue: any): FieldReconciliation => {
      if (fields[key]) return fields[key];
      return { value: fallbackValue, source: 'municode', confidence: 0, discrepancy: false };
    };

    return {
      id: row.id,
      status: row.triangulation_status,
      sourceA: {
        available: row.source_a_available,
        zoningCode: row.source_a_zoning_code,
        parcelUuid: row.county_parcel_uuid,
      },
      sourceB: {
        available: row.source_b_available,
        categoryCode: row.source_b_category_code,
        categoryUuid: row.source_b_category_uuid,
      },
      sourceC: {
        available: row.source_c_available,
        districtUuid: row.source_c_district_uuid,
        municodeUrl: row.source_c_municode_url,
      },
      reconciledZoningCode: row.reconciled_zoning_code,
      codeAgreement: row.code_agreement,
      codeDiscrepancy: row.code_discrepancy_detail,
      reconciledStandards: {
        maxDensityPerAcre: makeField('maxDensityPerAcre', row.reconciled_max_density),
        maxHeightFt: makeField('maxHeightFt', row.reconciled_max_height_ft),
        maxFar: makeField('maxFar', row.reconciled_max_far),
        maxLotCoverage: makeField('maxLotCoverage', row.reconciled_max_lot_coverage),
        setbackFrontFt: makeField('setbackFrontFt', row.reconciled_setback_front_ft),
        setbackSideFt: makeField('setbackSideFt', row.reconciled_setback_side_ft),
        setbackRearFt: makeField('setbackRearFt', row.reconciled_setback_rear_ft),
        parkingPerUnit: makeField('parkingPerUnit', row.reconciled_parking_per_unit),
      },
      entitlementPath: row.entitlement_path_confirmed,
      processConfidence: parseFloat(row.process_confidence) || 0,
      predictedTimelineMonths: row.predicted_timeline_months ? parseFloat(row.predicted_timeline_months) : null,
      timelineConfidence: parseFloat(row.timeline_confidence) || 0,
      overallConfidence: parseFloat(row.overall_confidence) || 0,
      jurisdictionMaturity: 'unknown',
    };
  }
}
