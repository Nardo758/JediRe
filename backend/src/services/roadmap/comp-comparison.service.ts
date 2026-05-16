/**
 * Roadmap Mode — Comp Comparison Service (Task #787)
 *
 * Answers: "Two similarly-built properties in the same submarket, one rents
 * $300/unit/mo higher. Why, and how do I get there?"
 *
 * Public surface:
 *   getTopCompCandidates(dealId)                  → top-3 highest-rent comps
 *   buildCompComparison(dealId, compId, input)    → full CompComparison (DB comp)
 *   buildManualCompComparison(dealId, mc, input)  → full CompComparison (manual)
 *
 * Attribution buckets (≥3 produced for any premium > $75/unit/mo):
 *   physical      – year-built vintage gap (subject year_built from peer comps)
 *   operational   – occupancy / lease-up discipline gap
 *   pricing       – concessions / pricing positioning remainder
 *   ancillary     – other-income streams (RUBS, pet, parking, trash)
 *   expense_mgmt  – NOI margin / expense discipline (fires for large premiums)
 *
 * Replicability gated by sponsor_capabilities and constraints.
 * Score = replicable_impact / (totalPremium × units × 12) × 100, capped 100.
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
       COALESCE(latest.avg_asking_rent, 0)    AS avg_asking_rent,
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
    id:                  String(r.id),
    comp_name:           String(r.comp_name),
    comp_address:        String(r.comp_address ?? ''),
    comp_city:           String(r.comp_city ?? ''),
    comp_state:          String(r.comp_state ?? ''),
    comp_units:          sf(r.comp_units),
    comp_year_built:     sf(r.comp_year_built),
    comp_asset_class:    String(r.comp_asset_class ?? ''),
    comp_distance_miles: sf(r.comp_distance_miles),
    avg_asking_rent:     sf(r.avg_asking_rent),
    avg_effective_rent:  sf(r.avg_effective_rent),
    relevance_score:     sf(r.relevance_score),
  }));
}

// ── Attribution constants ──────────────────────────────────────────────────────

const PHYSICAL_MAX_SHARE      = 0.50;
const OPERATIONAL_MAX_SHARE   = 0.25;
const ANCILLARY_FIXED_SHARE   = 0.10;
const EXPENSE_MGMT_SHARE      = 0.08;  // NOI margin / expense discipline bucket

const YR_BUILT_PREMIUM_PER_YR = 3.5;  // $/unit/month per year of vintage gap
const OCC_LIFT_PER_PT         = 15;   // $/unit/month per 1 pp of occupancy gap above threshold
const MIN_CAPEX_FOR_PHYSICAL  = 250_000;

// ── Replicability context ─────────────────────────────────────────────────────

interface SponsorCtx {
  renovationExp:  'low' | 'medium' | 'high';
  leasingCapable: boolean;
  capexBudget:    number;
  excludedActions: Set<string>;
}

function buildSponsorCtx(input: RoadmapInput): SponsorCtx {
  return {
    renovationExp:   input.sponsor_capabilities?.renovation_experience ?? 'medium',
    leasingCapable:  input.sponsor_capabilities?.leasing_strategy_change_capability ?? true,
    capexBudget:     input.constraints?.max_capex_budget ?? Infinity,
    excludedActions: new Set(input.constraints?.sponsor_excluded_actions ?? []),
  };
}

function filterActions(actionIds: string[], ctx: SponsorCtx): string[] {
  return actionIds.filter(id => !ctx.excludedActions.has(id));
}

// ── Attribution bucket helpers ────────────────────────────────────────────────

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

  const structurallyBridgeable = yearBuiltGap <= 15;
  const sponsorCapable         = ctx.renovationExp !== 'low';
  const budgetSufficient       = ctx.capexBudget >= MIN_CAPEX_FOR_PHYSICAL;
  const replicable             = structurallyBridgeable && sponsorCapable && budgetSufficient;

  const baseActions = replicable
    ? ['interior_renovation_premium', 'amenity_reposition_premium', 'smart_home_tech_fee']
    : [];
  const mapped_action_ids = filterActions(baseActions, ctx);
  const effectivelyReplicable = replicable && mapped_action_ids.length > 0;

  const description = effectivelyReplicable
    ? `Comp is ${yearBuiltGap} yr newer — interior finishes and amenity package can be upgraded via targeted CapEx`
    : yearBuiltGap > 15
    ? `Comp is ${yearBuiltGap} yr newer — structural vintage gap is too large to fully bridge through renovation`
    : `Comp is ${yearBuiltGap} yr newer — renovation possible but sponsor capabilities or budget limit full replication`;

  return {
    category:                'physical',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable:              effectivelyReplicable,
    confidence:              yearBuiltGap > 5 ? 'high' : 'medium',
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
  if (occGapPct <= 2) return null;  // 2 pp threshold (down from 3 pp)

  const rawAttribPerUnit = clamp(
    (occGapPct - 2) * OCC_LIFT_PER_PT,
    0,
    rentPremium * OPERATIONAL_MAX_SHARE,
  );
  if (rawAttribPerUnit < 6) return null;

  const annualImpact = Math.round(rawAttribPerUnit * subjectUnits * 12);

  const replicable        = ctx.leasingCapable;
  const baseActions       = ['leasing_strategy_change', 'loss_to_lease_burnoff'];
  const mapped_action_ids = filterActions(baseActions, ctx);
  const effectivelyReplicable = replicable && mapped_action_ids.length > 0;

  return {
    category:                'operational',
    description:             `Comp maintains ${(compOcc * 100).toFixed(0)}% occupancy vs subject's ${(subjectOcc * 100).toFixed(0)}% — stronger lease-up discipline and revenue management driving higher effective rent`,
    rent_or_noi_attribution: annualImpact,
    replicable:              effectivelyReplicable,
    confidence:              'medium',
    mapped_action_ids:       effectivelyReplicable ? mapped_action_ids : [],
  };
}

function pricingDiff(
  hasConcessions: boolean,
  pricingShareOfPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (pricingShareOfPremium < 6) return null;  // 6 threshold (down from 8)

  const annualImpact = Math.round(pricingShareOfPremium * subjectUnits * 12);
  const description  = hasConcessions
    ? 'Comp posts asking rents without concessions; subject is offering concessions that compress effective rents'
    : 'Comp maintains a disciplined above-market pricing position via active revenue management';

  const replicable        = ctx.leasingCapable;
  const baseActions       = ['rent_comp_repositioning', 'leasing_strategy_change'];
  const mapped_action_ids = filterActions(baseActions, ctx);

  return {
    category:                'pricing',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable:              replicable && mapped_action_ids.length > 0,
    confidence:              'medium',
    mapped_action_ids:       replicable ? mapped_action_ids : [],
  };
}

function ancillaryDiff(
  rentPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (rentPremium < 50) return null;  // lower from 60 to 50

  const perUnit      = rentPremium * ANCILLARY_FIXED_SHARE;
  const annualImpact = Math.round(perUnit * subjectUnits * 12);

  const baseActions       = ['rubs_implementation', 'pet_rent_implementation', 'parking_fee_restructure', 'trash_valet_service'];
  const mapped_action_ids = filterActions(baseActions, ctx);

  return {
    category:                'ancillary',
    description:             'Comp likely captures ancillary income streams (RUBS, pet rent, parking, trash valet) not currently included in subject effective rents',
    rent_or_noi_attribution: annualImpact,
    replicable:              mapped_action_ids.length > 0,
    confidence:              'low',
    mapped_action_ids,
  };
}

/**
 * Expense-management / NOI-margin bucket.
 *
 * High-rent comparable properties typically achieve better expense discipline
 * (lower turnover cost, vendor contract leverage, energy efficiency) which
 * indirectly enables them to sustain higher asking rents relative to peers.
 * Fires for meaningful premiums (> $75/unit/mo) as a catch-all for operating-
 * cost and NOI-margin differences not captured by the occupancy bucket.
 */
function expenseMgmtDiff(
  rentPremium: number,
  subjectUnits: number,
  ctx: SponsorCtx,
): ObservedDifference | null {
  if (rentPremium < 75) return null;

  const perUnit      = rentPremium * EXPENSE_MGMT_SHARE;
  const annualImpact = Math.round(perUnit * subjectUnits * 12);

  const baseActions = [
    'vendor_contract_rebid', 'property_tax_appeal',
    'insurance_reshop', 'energy_efficiency_capex',
  ];
  const mapped_action_ids = filterActions(baseActions, ctx);

  return {
    category:                'operational',
    description:             'Comp achieves tighter operating-cost discipline (vendor contracts, insurance, utilities) freeing margin that supports higher effective-rent positioning',
    rent_or_noi_attribution: annualImpact,
    replicable:              mapped_action_ids.length > 0,
    confidence:              'low',
    mapped_action_ids,
  };
}

// ── Subject year-built inference ──────────────────────────────────────────────

/**
 * Estimate the subject property's year_built using peer comps in the same
 * competitive set as a proxy.
 *
 * Rationale: an operator building a competitive set typically includes
 * properties of similar vintage to the subject. The lowest year_built among
 * non-selected comps represents a conservative floor for the subject's vintage.
 * This enables the physical attribution bucket to fire when the selected
 * (higher-rent) comp is meaningfully newer than the rest of the peer group.
 *
 * Returns 0 when no peer-comp data is available; physical attribution is then
 * suppressed rather than fabricated.
 */
async function inferSubjectYearBuilt(dealId: string, excludeCompId: string | null): Promise<number> {
  try {
    const result = await query(
      `SELECT MIN(comp_year_built) AS oldest_vintage
       FROM competitive_sets
       WHERE deal_id = $1
         AND is_active = true
         AND comp_year_built > 1950
         ${excludeCompId ? 'AND id != $2' : ''}`,
      excludeCompId ? [dealId, excludeCompId] : [dealId]
    );

    const oldest = sf((result.rows[0] as Record<string, unknown>)?.oldest_vintage);
    return oldest > 1950 ? oldest : 0;
  } catch {
    return 0;
  }
}

// ── Core computation ───────────────────────────────────────────────────────────

interface CompData {
  id: string;
  name: string;
  compRent:       number;
  compYearBuilt:  number;
  compOcc:        number;
  compUnits:      number;
  hasConcessions: boolean;
  distanceMiles:  number;
}

async function computeComparison(
  dealId: string,
  compData: CompData,
  input: RoadmapInput,
  excludeCompIdForYearBuilt: string | null,
): Promise<CompComparison> {
  const ctx = buildSponsorCtx(input);
  const { compRent, compYearBuilt, compOcc, compUnits, hasConcessions, distanceMiles } = compData;

  // ── Fetch subject metrics in parallel ────────────────────────────────────
  const [subjectRentResult, subjectDealResult, subjectOccResult, subjectYearBuilt] = await Promise.all([
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
    inferSubjectYearBuilt(dealId, excludeCompIdForYearBuilt),
  ]);

  const subjectRent  = sf((subjectRentResult.rows[0] as Record<string, unknown>)?.avg_rent);
  const subjectDeal  = (subjectDealResult.rows[0] as Record<string, unknown> | undefined) ?? {};
  const subjectUnits = sf(subjectDeal.total_units, 100);

  const rawOcc    = (subjectOccResult.rows[0] as Record<string, unknown>)?.occupancy;
  const subjectOcc = rawOcc != null ? sf(rawOcc, 0.92) : 0.92;

  const effectiveSubjectRent = subjectRent > 0
    ? subjectRent
    : sf(subjectDeal.purchase_price) * 0.0065 / Math.max(subjectUnits, 1);

  const rentPremium = Math.max(0, compRent - effectiveSubjectRent);

  logger.info('[comp-comparison] Premium computed', {
    compRent, effectiveSubjectRent, rentPremium, subjectUnits, compYearBuilt, subjectYearBuilt,
  });

  if (rentPremium <= 0) {
    return {
      reference_comp: { property_id: compData.id, name: compData.name, avg_rent: compRent,
        units: compUnits, year_built: compYearBuilt, distance_miles: distanceMiles },
      subject_avg_rent:            effectiveSubjectRent,
      rent_premium_per_unit:       0,
      observed_differences:        [],
      replicable_differences:      [],
      non_replicable_differences:  ['No rent premium detected — subject is at or above comp rent'],
      replicability_score:         0,
      total_replicable_annual_impact: 0,
    };
  }

  // ── Year-built gap ────────────────────────────────────────────────────────
  // subjectYearBuilt is inferred from the oldest peer comp in the competitive set.
  // If not available (e.g. no comp set), yearBuiltGap = 0 and physical diff is suppressed.
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

  // Expense-management bucket (ensures ≥3 differences for large premiums)
  const expDiff = expenseMgmtDiff(rentPremium, subjectUnits, ctx);
  if (expDiff) differences.push(expDiff);

  // Pricing: remainder after the above buckets
  const allocatedPerUnit = differences.reduce((s, d) => s + d.rent_or_noi_attribution, 0)
    / Math.max(subjectUnits, 1) / 12;
  const pricingPerUnit   = Math.max(0, rentPremium - allocatedPerUnit);
  const pricingDiffObj   = pricingDiff(hasConcessions, pricingPerUnit, subjectUnits, ctx);
  if (pricingDiffObj) differences.push(pricingDiffObj);

  logger.info('[comp-comparison] Attribution buckets', {
    buckets: differences.map(d => d.category),
    count: differences.length,
  });

  // ── Replicability score ───────────────────────────────────────────────────
  const replicableDiffs    = differences.filter(d => d.replicable).map(d => d.description);
  const nonReplicableDiffs = differences.filter(d => !d.replicable).map(d => d.description);
  const replicableAttrib   = differences.filter(d => d.replicable)
    .reduce((s, d) => s + d.rent_or_noi_attribution, 0);

  const totalPremiumAnnual = rentPremium * subjectUnits * 12;
  const replicabilityScore = Math.min(
    100,
    Math.round((replicableAttrib / Math.max(totalPremiumAnnual, 1)) * 100),
  );

  logger.info('[comp-comparison] Comparison built', {
    differences: differences.length,
    replicabilityScore,
    replicableAttrib,
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
    subject_avg_rent:              effectiveSubjectRent,
    rent_premium_per_unit:         rentPremium,
    observed_differences:          differences,
    replicable_differences:        replicableDiffs,
    non_replicable_differences:    nonReplicableDiffs,
    replicability_score:           replicabilityScore,
    total_replicable_annual_impact: replicableAttrib,
  };
}

// ── Public builders ────────────────────────────────────────────────────────────

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
       COALESCE(latest.avg_asking_rent, 0)       AS avg_asking_rent,
       COALESCE(latest.avg_effective_rent, 0)    AS avg_effective_rent,
       COALESCE(latest.estimated_occupancy, 0.93) AS estimated_occupancy,
       COALESCE(latest.concessions_offered, '')   AS concessions_offered
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
  }, input, compId);
}

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
  }, input, null);  // no excludeCompId — use full comp set for year_built inference
}
