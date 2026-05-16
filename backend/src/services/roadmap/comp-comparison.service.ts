/**
 * Roadmap Mode — Comp Comparison Service (Task #787)
 *
 * Answers: "Two similarly-built properties in the same submarket, one rents
 * $300/unit/mo higher. Why, and how do I get there?"
 *
 * Public surface:
 *   getTopCompCandidates(dealId)                 → top-3 highest-rent comps
 *   buildCompComparison(dealId, compId, input)   → full CompComparison
 *   buildManualCompComparison(dealId, mc, input) → same, from manual entry
 *
 * Attribution heuristics calibrated from industry benchmarks.
 * Replicability gated by sponsor_capabilities and capex constraints.
 * Score = (replicable annual impact) / (total premium * units * 12) × 100, capped 100.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { CompComparison, CompCandidate, ObservedDifference, RoadmapInput } from '../../types/roadmap';

// ── Internal helpers ───────────────────────────────────────────────────────────

function sf(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return isFinite(n) ? n : fallback;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Top-3 comp candidates ──────────────────────────────────────────────────────

/**
 * Return the top-3 highest-asking-rent comps for a deal's competitive set.
 * Used by the Build Roadmap modal so the user can explicitly choose the
 * reference comp, or enter one manually.
 */
export async function getTopCompCandidates(dealId: string): Promise<CompCandidate[]> {
  const result = await query(
    `SELECT
       cs.id,
       cs.comp_name,
       cs.comp_address,
       cs.comp_city,
       cs.comp_state,
       cs.comp_units,
       cs.comp_year_built,
       cs.comp_asset_class,
       cs.comp_distance_miles,
       cs.relevance_score,
       COALESCE(latest.avg_asking_rent, 0)   AS avg_asking_rent,
       COALESCE(latest.avg_effective_rent, 0) AS avg_effective_rent
     FROM competitive_sets cs
     LEFT JOIN LATERAL (
       SELECT avg_asking_rent, avg_effective_rent
       FROM comp_pricing_snapshots
       WHERE comp_set_id = cs.id AND deal_id = $1
       ORDER BY snapshot_date DESC
       LIMIT 1
     ) latest ON true
     WHERE cs.deal_id = $1 AND cs.is_active = true
     ORDER BY COALESCE(latest.avg_asking_rent, 0) DESC
     LIMIT 3`,
    [dealId]
  );

  return (result.rows as Record<string, unknown>[]).map(r => ({
    id:               String(r.id),
    comp_name:        String(r.comp_name),
    comp_address:     String(r.comp_address ?? ''),
    comp_city:        String(r.comp_city ?? ''),
    comp_state:       String(r.comp_state ?? ''),
    comp_units:       sf(r.comp_units),
    comp_year_built:  sf(r.comp_year_built),
    comp_asset_class: String(r.comp_asset_class ?? ''),
    comp_distance_miles: sf(r.comp_distance_miles),
    avg_asking_rent:  sf(r.avg_asking_rent),
    avg_effective_rent: sf(r.avg_effective_rent),
    relevance_score:  sf(r.relevance_score),
  }));
}

// ── Attribution constants ──────────────────────────────────────────────────────

const PHYSICAL_MAX_SHARE    = 0.50;
const OPERATIONAL_MAX_SHARE = 0.25;
const ANCILLARY_FIXED_SHARE = 0.12;

const YR_BUILT_PREMIUM_PER_YR = 3.5;
const OCC_LIFT_PER_PT         = 15;

// Minimum capex budget to consider physical renovation replicable
const MIN_CAPEX_FOR_PHYSICAL = 250_000;

// ── Replicability resolver ─────────────────────────────────────────────────────

interface SponsorCtx {
  renovationExp: 'low' | 'medium' | 'high';
  leasingCapable: boolean;
  capexBudget: number;
  excludedActions: Set<string>;
}

function buildSponsorCtx(input: RoadmapInput): SponsorCtx {
  return {
    renovationExp:  input.sponsor_capabilities?.renovation_experience ?? 'medium',
    leasingCapable: input.sponsor_capabilities?.leasing_strategy_change_capability ?? true,
    capexBudget:    input.constraints?.max_capex_budget ?? Infinity,
    excludedActions: new Set(input.constraints?.sponsor_excluded_actions ?? []),
  };
}

function filterActions(actionIds: string[], ctx: SponsorCtx): string[] {
  return actionIds.filter(id => !ctx.excludedActions.has(id));
}

// ── Difference builder helpers ─────────────────────────────────────────────────

function physicalDiff(
  yearBuiltGap: number,
  rentPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (yearBuiltGap <= 0) return null;

  const rawAttribPerUnit = Math.min(
    yearBuiltGap * YR_BUILT_PREMIUM_PER_YR,
    rentPremium * PHYSICAL_MAX_SHARE,
  );
  if (rawAttribPerUnit < 10) return null;

  const annualImpact = Math.round(rawAttribPerUnit * subjectUnits * 12);

  // Replicable only when: gap is bridgeable, sponsor has renovation capability, budget exists
  const structurallyBridgeable = yearBuiltGap <= 15;
  const sponsorCapable = ctx.renovationExp !== 'low';
  const budgetSufficient = ctx.capexBudget >= MIN_CAPEX_FOR_PHYSICAL;
  const replicable = structurallyBridgeable && sponsorCapable && budgetSufficient;

  const baseActions = replicable
    ? ['interior_renovation_premium', 'amenity_reposition_premium', 'smart_home_tech_fee']
    : [];
  const mapped_action_ids = filterActions(baseActions, ctx);
  const effectivelyReplicable = replicable && mapped_action_ids.length > 0;

  const description = effectivelyReplicable
    ? `Comp is ${yearBuiltGap} yr newer — interior finishes and amenity package can be upgraded via targeted CapEx`
    : yearBuiltGap > 15
    ? `Comp is ${yearBuiltGap} yr newer — structural vintage gap is too large to fully bridge through renovation`
    : `Comp is ${yearBuiltGap} yr newer — renovation upgrade possible but sponsor capabilities or budget limit replication`;

  return {
    category:              'physical',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable:            effectivelyReplicable,
    confidence:            yearBuiltGap > 5 ? 'high' : 'medium',
    mapped_action_ids,
  };
}

function operationalDiff(
  compOcc: number,
  subjectOcc: number,
  rentPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  const occGapPct = (compOcc - subjectOcc) * 100;
  if (occGapPct <= 3) return null;

  const rawAttribPerUnit = clamp(
    (occGapPct - 3) * OCC_LIFT_PER_PT,
    0,
    rentPremium * OPERATIONAL_MAX_SHARE,
  );
  if (rawAttribPerUnit < 8) return null;

  const annualImpact = Math.round(rawAttribPerUnit * subjectUnits * 12);

  const replicable = ctx.leasingCapable;
  const baseActions = ['leasing_strategy_change', 'loss_to_lease_burnoff'];
  const mapped_action_ids = filterActions(baseActions, ctx);
  const effectivelyReplicable = replicable && mapped_action_ids.length > 0;

  return {
    category:              'operational',
    description:           `Comp maintains ${(compOcc * 100).toFixed(0)}% occupancy vs subject's ${(subjectOcc * 100).toFixed(0)}% — stronger lease-up discipline and revenue management driving higher effective rent`,
    rent_or_noi_attribution: annualImpact,
    replicable:            effectivelyReplicable,
    confidence:            'medium',
    mapped_action_ids:     effectivelyReplicable ? mapped_action_ids : [],
  };
}

function pricingDiff(
  hasConcessions: boolean,
  pricingShareOfPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (pricingShareOfPremium < 8) return null;

  const annualImpact = Math.round(pricingShareOfPremium * subjectUnits * 12);
  const description  = hasConcessions
    ? 'Comp posts asking rents without concessions; subject is offering concessions that compress effective rents'
    : 'Comp maintains a disciplined above-market pricing position via active revenue management';

  const replicable = ctx.leasingCapable;
  const baseActions = ['rent_comp_repositioning', 'leasing_strategy_change'];
  const mapped_action_ids = filterActions(baseActions, ctx);

  return {
    category:              'pricing',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable:            replicable && mapped_action_ids.length > 0,
    confidence:            'medium',
    mapped_action_ids:     replicable ? mapped_action_ids : [],
  };
}

function ancillaryDiff(
  rentPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (rentPremium < 60) return null;

  const perUnit      = rentPremium * ANCILLARY_FIXED_SHARE;
  const annualImpact = Math.round(perUnit * subjectUnits * 12);

  const baseActions = ['rubs_implementation', 'pet_rent_implementation', 'parking_fee_restructure', 'trash_valet_service'];
  const mapped_action_ids = filterActions(baseActions, ctx);

  return {
    category:              'ancillary',
    description:           'Comp likely charges for ancillary income streams (RUBS, pet rent, parking fees, trash valet) not currently captured by subject',
    rent_or_noi_attribution: annualImpact,
    replicable:            mapped_action_ids.length > 0,
    confidence:            'low',
    mapped_action_ids,
  };
}

// ── Core computation ───────────────────────────────────────────────────────────

interface CompData {
  id: string;
  name: string;
  compRent: number;
  compYearBuilt: number;
  compOcc: number;
  compUnits: number;
  hasConcessions: boolean;
  distanceMiles: number;
}

async function computeComparison(
  dealId: string,
  compData: CompData,
  input: RoadmapInput,
): Promise<CompComparison> {
  const ctx = buildSponsorCtx(input);
  const { compRent, compYearBuilt, compOcc, compUnits, hasConcessions, distanceMiles } = compData;

  // ── Fetch subject metrics ─────────────────────────────────────────────────
  const [subjectRentResult, subjectDealResult, subjectOccResult] = await Promise.all([
    query(
      `SELECT AVG(current_rent) AS avg_rent
       FROM rent_roll_units
       WHERE deal_id = $1
         AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)`,
      [dealId]
    ),
    query(
      `SELECT COALESCE(d.total_units, 100) AS total_units,
              COALESCE(d.purchase_price, 0) AS purchase_price
       FROM deals d
       WHERE d.id = $1`,
      [dealId]
    ),
    query(
      `SELECT
         CASE WHEN COUNT(*) > 0
              THEN AVG(CASE WHEN status = 'occupied' THEN 1.0 ELSE 0.0 END)
              ELSE NULL
         END AS occupancy
       FROM rent_roll_units
       WHERE deal_id = $1
         AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)`,
      [dealId]
    ),
  ]);

  const subjectRent  = sf((subjectRentResult.rows[0] as Record<string, unknown>)?.avg_rent);
  const subjectDeal  = (subjectDealResult.rows[0] as Record<string, unknown> | undefined) ?? {};
  const subjectUnits = sf(subjectDeal.total_units, 100);

  // Subject occupancy from rent roll; fall back to market typical
  const rawOcc = (subjectOccResult.rows[0] as Record<string, unknown>)?.occupancy;
  const subjectOcc = rawOcc != null ? sf(rawOcc, 0.92) : 0.92;

  // Subject rent: use rent roll if available, else purchase-price proxy
  const effectiveSubjectRent = subjectRent > 0
    ? subjectRent
    : sf(subjectDeal.purchase_price) * 0.0065 / Math.max(subjectUnits, 1);

  const rentPremium = Math.max(0, compRent - effectiveSubjectRent);

  logger.info('[comp-comparison] Premium computed', {
    compRent, effectiveSubjectRent, rentPremium, subjectUnits, compYearBuilt,
  });

  // If no meaningful premium, return a minimal no-gap result
  if (rentPremium <= 0) {
    return {
      reference_comp: {
        property_id:    compData.id,
        name:           compData.name,
        avg_rent:       compRent,
        units:          compUnits,
        year_built:     compYearBuilt,
        distance_miles: distanceMiles,
      },
      subject_avg_rent:          effectiveSubjectRent,
      rent_premium_per_unit:     0,
      observed_differences:      [],
      replicable_differences:    [],
      non_replicable_differences: ['No rent premium detected — subject is at or above comp rent'],
      replicability_score:       0,
      total_replicable_annual_impact: 0,
    };
  }

  // ── Year-built gap ────────────────────────────────────────────────────────
  // subject year_built is not stored on the deals table; when unavailable
  // we cannot compute a relative gap, so physical attribution is suppressed (gap = 0).
  // Follow-up task #794 tracks storing subject year_built for accurate attribution.
  const subjectYearBuilt = 0; // not yet available from deals schema
  const yearBuiltGap = compYearBuilt > 0 && subjectYearBuilt > 0
    ? Math.max(0, compYearBuilt - subjectYearBuilt)
    : 0;

  // ── Build attribution buckets ─────────────────────────────────────────────
  const differences: ObservedDifference[] = [];

  const physDiff = physicalDiff(yearBuiltGap, rentPremium, subjectUnits, ctx);
  if (physDiff) differences.push(physDiff);

  const operDiff = operationalDiff(compOcc, subjectOcc, rentPremium, subjectUnits, ctx);
  if (operDiff) differences.push(operDiff);

  const ancDiff = ancillaryDiff(rentPremium, subjectUnits, ctx);
  if (ancDiff) differences.push(ancDiff);

  // Pricing: remainder after other buckets
  const allocatedPerUnit = differences.reduce((sum, d) => sum + d.rent_or_noi_attribution, 0)
    / Math.max(subjectUnits, 1) / 12;
  const pricingPerUnit   = Math.max(0, rentPremium - allocatedPerUnit);
  const pricingDiffObj   = pricingDiff(hasConcessions, pricingPerUnit, subjectUnits, ctx);
  if (pricingDiffObj) differences.push(pricingDiffObj);

  // ── Replicability score ───────────────────────────────────────────────────
  // Score = replicable annual impact / total premium (annualised) × 100, capped 100
  const replicableDiffs     = differences.filter(d => d.replicable).map(d => d.description);
  const nonReplicableDiffs  = differences.filter(d => !d.replicable).map(d => d.description);
  const replicableAttribution = differences
    .filter(d => d.replicable)
    .reduce((s, d) => s + d.rent_or_noi_attribution, 0);

  const totalPremiumAnnual = rentPremium * subjectUnits * 12;
  const replicabilityScore = Math.min(
    100,
    Math.round((replicableAttribution / Math.max(totalPremiumAnnual, 1)) * 100),
  );

  logger.info('[comp-comparison] Comparison built', {
    differences: differences.length,
    replicabilityScore,
    replicableAttribution,
    totalPremiumAnnual,
  });

  return {
    reference_comp: {
      property_id:    compData.id,
      name:           compData.name,
      avg_rent:       compRent,
      units:          compUnits,
      year_built:     compYearBuilt,
      distance_miles: distanceMiles,
    },
    subject_avg_rent:        effectiveSubjectRent,
    rent_premium_per_unit:   rentPremium,
    observed_differences:    differences,
    replicable_differences:  replicableDiffs,
    non_replicable_differences: nonReplicableDiffs,
    replicability_score:     replicabilityScore,
    total_replicable_annual_impact: replicableAttribution,
  };
}

// ── Main builders (public API) ─────────────────────────────────────────────────

/**
 * Build a full CompComparison from a DB comp (competitive_sets row).
 */
export async function buildCompComparison(
  dealId: string,
  compId: string,
  input: RoadmapInput,
): Promise<CompComparison> {
  logger.info('[comp-comparison] Building comp comparison (DB)', { dealId, compId });

  const compResult = await query(
    `SELECT
       cs.id,
       cs.comp_name,
       cs.comp_units,
       cs.comp_year_built,
       cs.comp_distance_miles,
       COALESCE(latest.avg_asking_rent, 0)    AS avg_asking_rent,
       COALESCE(latest.avg_effective_rent, 0) AS avg_effective_rent,
       COALESCE(latest.estimated_occupancy, 0.93) AS estimated_occupancy,
       COALESCE(latest.concessions_offered, '') AS concessions_offered
     FROM competitive_sets cs
     LEFT JOIN LATERAL (
       SELECT avg_asking_rent, avg_effective_rent, estimated_occupancy, concessions_offered
       FROM comp_pricing_snapshots
       WHERE comp_set_id = cs.id AND deal_id = $2
       ORDER BY snapshot_date DESC
       LIMIT 1
     ) latest ON true
     WHERE cs.id = $1 AND cs.deal_id = $2`,
    [compId, dealId]
  );

  if (compResult.rows.length === 0) {
    throw new Error(`Comp ${compId} not found for deal ${dealId}`);
  }

  const comp = compResult.rows[0] as Record<string, unknown>;

  return computeComparison(dealId, {
    id:             String(comp.id),
    name:           String(comp.comp_name),
    compRent:       sf(comp.avg_asking_rent),
    compYearBuilt:  sf(comp.comp_year_built),
    compOcc:        sf(comp.estimated_occupancy, 0.93),
    compUnits:      sf(comp.comp_units),
    hasConcessions: String(comp.concessions_offered ?? '').trim().length > 3,
    distanceMiles:  sf(comp.comp_distance_miles),
  }, input);
}

/**
 * Build a CompComparison from manually entered comp data (no DB lookup for the comp).
 */
export async function buildManualCompComparison(
  dealId: string,
  mc: NonNullable<RoadmapInput['manual_comp']>,
  input: RoadmapInput,
): Promise<CompComparison> {
  logger.info('[comp-comparison] Building comp comparison (manual)', { dealId, name: mc.name });

  return computeComparison(dealId, {
    id:             'manual',
    name:           mc.name,
    compRent:       mc.avg_asking_rent,
    compYearBuilt:  mc.comp_year_built ?? 0,
    compOcc:        0.93,
    compUnits:      mc.comp_units ?? 0,
    hasConcessions: false,
    distanceMiles:  mc.distance_miles ?? 0,
  }, input);
}
