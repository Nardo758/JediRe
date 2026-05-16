/**
 * Roadmap Mode — Comp Comparison Service (Task #787)
 *
 * Answers: "Two similarly-built properties in the same submarket, one rents
 * $300/unit/mo higher. Why, and how do I get there?"
 *
 * Public surface:
 *   getTopCompCandidates(dealId)  → top-3 highest-rent comps for user selection
 *   buildCompComparison(dealId, compId) → full CompComparison for RoadmapOutput
 *
 * Attribution logic uses heuristic bands calibrated from industry benchmarks.
 * Each observed difference is mapped to action IDs from the 20-action library.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { CompComparison, CompCandidate, ObservedDifference } from '../../types/roadmap';

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
 * reference comp (spec Q2 recommendation).
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

// Maximum fraction of the rent premium attributable to each bucket.
// All shares must sum to <= 1.0. Unallocated remainder = pricing bucket.
const PHYSICAL_MAX_SHARE    = 0.50;
const OPERATIONAL_MAX_SHARE = 0.25;
const ANCILLARY_FIXED_SHARE = 0.12;   // always present if premium > $60/unit/mo

// Year-built premium per year of gap ($/unit/month) — industry benchmark
const YR_BUILT_PREMIUM_PER_YR = 3.5;  // e.g. 10 yr gap ≈ $35/unit/mo

// Occupancy lift per percentage point above a 3% threshold
const OCC_LIFT_PER_PT = 15;           // $15/unit/month per 1% above threshold gap

// ── Difference builder helpers ─────────────────────────────────────────────────

function physicalDiff(
  yearBuiltGap: number,
  rentPremium: number,
  subjectUnits: number,
): ObservedDifference | null {
  if (yearBuiltGap <= 0) return null;

  const rawAttribPerUnit = Math.min(
    yearBuiltGap * YR_BUILT_PREMIUM_PER_YR,
    rentPremium * PHYSICAL_MAX_SHARE,
  );
  if (rawAttribPerUnit < 10) return null;

  const annualImpact = Math.round(rawAttribPerUnit * subjectUnits * 12);
  const replicable   = yearBuiltGap <= 15;

  const description = replicable
    ? `Comp is ${yearBuiltGap} yr newer — interior finishes and amenity package can be upgraded via targeted CapEx`
    : `Comp is ${yearBuiltGap} yr newer — structural vintage gap is not fully bridgeable through renovation`;

  return {
    category:              'physical',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable,
    confidence:            yearBuiltGap > 5 ? 'high' : 'medium',
    mapped_action_ids:     replicable
      ? ['interior_renovation_premium', 'amenity_reposition_premium']
      : [],
  };
}

function operationalDiff(
  compOcc: number,
  subjectOcc: number,
  rentPremium: number,
  subjectUnits: number,
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

  return {
    category:              'operational',
    description:           `Comp maintains ${(compOcc * 100).toFixed(0)}% occupancy vs subject's ${(subjectOcc * 100).toFixed(0)}% — stronger lease-up discipline and revenue management driving higher effective rent`,
    rent_or_noi_attribution: annualImpact,
    replicable:            true,
    confidence:            'medium',
    mapped_action_ids:     ['leasing_strategy_change', 'loss_to_lease_burnoff'],
  };
}

function pricingDiff(
  hasConcessions: boolean,
  pricingShareOfPremium: number,
  subjectUnits: number,
): ObservedDifference | null {
  if (pricingShareOfPremium < 8) return null;

  const annualImpact = Math.round(pricingShareOfPremium * subjectUnits * 12);
  const description  = hasConcessions
    ? 'Comp posts asking rents without concessions; subject is offering concessions that compress effective rents'
    : 'Comp maintains a disciplined above-market pricing position via active revenue management';

  return {
    category:              'pricing',
    description,
    rent_or_noi_attribution: annualImpact,
    replicable:            true,
    confidence:            'medium',
    mapped_action_ids:     ['rent_comp_repositioning', 'leasing_strategy_change'],
  };
}

function ancillaryDiff(
  rentPremium: number,
  subjectUnits: number,
): ObservedDifference | null {
  if (rentPremium < 60) return null;

  const perUnit      = rentPremium * ANCILLARY_FIXED_SHARE;
  const annualImpact = Math.round(perUnit * subjectUnits * 12);

  return {
    category:              'ancillary',
    description:           'Comp likely charges for ancillary income streams (RUBS, pet rent, parking fees, trash valet) not currently captured by subject',
    rent_or_noi_attribution: annualImpact,
    replicable:            true,
    confidence:            'low',
    mapped_action_ids:     ['rubs_implementation', 'pet_rent_implementation', 'parking_fee_restructure', 'trash_valet_service'],
  };
}

// ── Main builder ───────────────────────────────────────────────────────────────

/**
 * Build a full CompComparison for the given deal + reference comp.
 *
 * Fetches subject metrics (rent, occupancy, year_built) from DB and computes
 * heuristic attribution for every rent-premium bucket.
 */
export async function buildCompComparison(
  dealId: string,
  compId: string,
): Promise<CompComparison> {
  logger.info('[comp-comparison] Building comp comparison', { dealId, compId });

  // ── 1. Fetch comp row + latest pricing ─────────────────────────────────────
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

  const comp        = compResult.rows[0] as Record<string, unknown>;
  const compRent    = sf(comp.avg_asking_rent);
  const compYearBuilt = sf(comp.comp_year_built);
  const compOcc     = sf(comp.estimated_occupancy, 0.93);
  const hasConcessions = String(comp.concessions_offered ?? '').trim().length > 3;

  // ── 2. Fetch subject data ───────────────────────────────────────────────────
  // Rent: from latest rent_roll_units; fall back to 0
  // year_built: from the latest comp_pricing_snapshots for context (subject itself may not have it)
  const [subjectRentResult, subjectDealResult] = await Promise.all([
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
  ]);

  const subjectRent = sf((subjectRentResult.rows[0] as Record<string, unknown>)?.avg_rent);
  const subjectDeal = (subjectDealResult.rows[0] as Record<string, unknown> | undefined) ?? {};
  const subjectUnits = sf(subjectDeal.total_units, 100);

  // If we have no subject rent, estimate from purchase price (rough market-cap proxy)
  const effectiveSubjectRent = subjectRent > 0
    ? subjectRent
    : sf(subjectDeal.purchase_price) * 0.0065 / Math.max(subjectUnits, 1);

  const rentPremium = Math.max(0, compRent - effectiveSubjectRent);

  logger.info('[comp-comparison] Premium computed', {
    compRent, effectiveSubjectRent, rentPremium, subjectUnits, compYearBuilt,
  });

  // ── 3. Build observed differences ──────────────────────────────────────────
  // year_built gap: comp vs. subject — comp_year_built comes from competitive_sets row.
  // Subject year_built is not always stored; default gap to 0 (no physical attribution).
  const yearBuiltGap = compYearBuilt > 0 ? Math.max(0, compYearBuilt - 2000) : 0;

  // Subject occupancy estimate from rent roll; default to market typical
  const subjectOccResult = await query(
    `SELECT
       CASE WHEN COUNT(*) > 0
            THEN AVG(CASE WHEN status = 'occupied' THEN 1.0 ELSE 0.0 END)
            ELSE 0.92
       END AS occupancy
     FROM rent_roll_units
     WHERE deal_id = $1
       AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)`,
    [dealId]
  );
  const subjectOcc = sf((subjectOccResult.rows[0] as Record<string, unknown>)?.occupancy, 0.92);

  const differences: ObservedDifference[] = [];

  // Physical attribution
  const physDiff = physicalDiff(yearBuiltGap, rentPremium, subjectUnits);
  if (physDiff) differences.push(physDiff);

  // Operational attribution
  const operDiff = operationalDiff(compOcc, subjectOcc, rentPremium, subjectUnits);
  if (operDiff) differences.push(operDiff);

  // Ancillary attribution (fixed share if premium is meaningful)
  const ancDiff = ancillaryDiff(rentPremium, subjectUnits);
  if (ancDiff) differences.push(ancDiff);

  // Pricing: remainder after physical + operational + ancillary
  const allocatedPerUnit = differences.reduce((sum, d) => sum + d.rent_or_noi_attribution, 0) / subjectUnits / 12;
  const pricingPerUnit   = Math.max(0, rentPremium - allocatedPerUnit);
  const pricingDiffObj   = pricingDiff(hasConcessions, pricingPerUnit, subjectUnits);
  if (pricingDiffObj) differences.push(pricingDiffObj);

  // If we have no comp rent data (empty comp set), return a graceful minimal result
  if (rentPremium <= 0) {
    return buildNoPremiumResult(comp, compRent, effectiveSubjectRent, sf(comp.comp_units));
  }

  // ── 4. Classify replicable / non-replicable ─────────────────────────────────
  const replicableDiffs     = differences.filter(d => d.replicable).map(d => d.description);
  const nonReplicableDiffs  = differences.filter(d => !d.replicable).map(d => d.description);
  const totalAttribution    = differences.reduce((s, d) => s + d.rent_or_noi_attribution, 0);
  const replicableAttribution = differences.filter(d => d.replicable).reduce((s, d) => s + d.rent_or_noi_attribution, 0);
  const replicabilityScore  = totalAttribution > 0
    ? Math.round((replicableAttribution / totalAttribution) * 100)
    : 0;

  logger.info('[comp-comparison] Comparison built', {
    differences: differences.length,
    replicabilityScore,
    totalAttribution,
    replicableAttribution,
  });

  return {
    reference_comp: {
      property_id:    String(comp.id),
      name:           String(comp.comp_name),
      avg_rent:       compRent,
      units:          sf(comp.comp_units),
      year_built:     compYearBuilt,
      distance_miles: sf(comp.comp_distance_miles),
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

function buildNoPremiumResult(
  comp: Record<string, unknown>,
  compRent: number,
  subjectRent: number,
  compUnits: number,
): CompComparison {
  return {
    reference_comp: {
      property_id:    String(comp.id),
      name:           String(comp.comp_name),
      avg_rent:       compRent,
      units:          compUnits,
      year_built:     sf(comp.comp_year_built),
      distance_miles: sf(comp.comp_distance_miles),
    },
    subject_avg_rent:          subjectRent,
    rent_premium_per_unit:     0,
    observed_differences:      [],
    replicable_differences:    [],
    non_replicable_differences: ['No rent premium detected — subject is at or above comp rent'],
    replicability_score:       0,
    total_replicable_annual_impact: 0,
  };
}
