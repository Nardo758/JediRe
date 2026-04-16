// ============================================================================
// data-router.ts — PATCH SET
// Apply these targeted edits to backend/src/services/document-extraction/data-router.ts
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 1 — Fix `getOrCreatePropertyForDeal` to write the deal_properties join row.
// Without this, properties created by extraction are orphaned from the deal.
// ─────────────────────────────────────────────────────────────────────────────

// FIND (around line 19):
async function getOrCreatePropertyForDeal(pool: Pool, dealId: string): Promise<string> {
  const existing = await pool.query(
    `SELECT property_id FROM deal_monthly_actuals WHERE deal_id = $1 AND property_id IS NOT NULL LIMIT 1`,
    [dealId]
  );
  if (existing.rows[0]?.property_id) return existing.rows[0].property_id;

  const dealResult = await pool.query(
    `SELECT name, address, target_units FROM deals WHERE id = $1`,
    [dealId]
  );
  const deal = dealResult.rows[0] || {};

  const propResult = await pool.query(
    `INSERT INTO properties (name, address_line1, units, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [deal.name || 'Untitled Property', deal.address || null, deal.target_units || null]
  );
  return propResult.rows[0].id;
}

// REPLACE WITH:
async function getOrCreatePropertyForDeal(pool: Pool, dealId: string): Promise<string> {
  // Primary lookup: deal_properties join table (the canonical source)
  const joinExisting = await pool.query(
    `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
    [dealId]
  );
  if (joinExisting.rows[0]?.property_id) return joinExisting.rows[0].property_id;

  // Secondary lookup: actuals table (legacy path — repair the missing join)
  const actualsExisting = await pool.query(
    `SELECT property_id FROM deal_monthly_actuals WHERE deal_id = $1 AND property_id IS NOT NULL LIMIT 1`,
    [dealId]
  );
  if (actualsExisting.rows[0]?.property_id) {
    // Property exists but join is missing — repair it
    await pool.query(
      `INSERT INTO deal_properties (deal_id, property_id, relationship, created_at)
       VALUES ($1, $2, 'subject', NOW())
       ON CONFLICT (deal_id, property_id) DO NOTHING`,
      [dealId, actualsExisting.rows[0].property_id]
    );
    return actualsExisting.rows[0].property_id;
  }

  // Create new property
  const dealResult = await pool.query(
    `SELECT name, address, target_units FROM deals WHERE id = $1`,
    [dealId]
  );
  const deal = dealResult.rows[0] || {};

  const propResult = await pool.query(
    `INSERT INTO properties (name, address_line1, units, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [deal.name || 'Untitled Property', deal.address || null, deal.target_units || null]
  );
  const propertyId = propResult.rows[0].id;

  // CRITICAL: write the join row so downstream reads (`/:id/properties`,
  // propertyCount aggregations, M27 comp triggers, etc.) can find this property.
  await pool.query(
    `INSERT INTO deal_properties (deal_id, property_id, relationship, created_at)
     VALUES ($1, $2, 'subject', NOW())
     ON CONFLICT (deal_id, property_id) DO NOTHING`,
    [dealId, propertyId]
  );

  return propertyId;
}


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 2 — `routeExtractionResult` returns the new `capsuleExtras` from
// the rent-roll parser into the capsule, AND triggers seeder + cross-validation
// after every successful extraction.
// ─────────────────────────────────────────────────────────────────────────────

// ADD THESE IMPORTS at the top of data-router.ts:
import { seedProFormaYear1 } from '../proforma-seeder.service';
import { runCrossValidation } from '../multi-doc-cross-validation.service';

// FIND the bottom of `routeExtractionResult` (around line 102-110):
  let capsuleUpdated = false;
  try {
    await updateDealCapsule(pool, ctx.dealId, result, alerts, ctx);
    capsuleUpdated = true;
  } catch (err) {
    alerts.push(`Capsule update failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { rowsInserted, capsuleUpdated, libraryUpdated, alerts };
}

// REPLACE WITH:
  let capsuleUpdated = false;
  try {
    await updateDealCapsule(pool, ctx.dealId, result, alerts, ctx);
    capsuleUpdated = true;
  } catch (err) {
    alerts.push(`Capsule update failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // ─── NEW: trigger proforma re-seed and cross-validation after every extraction ───
  // These run sequentially so cross-validation can reference fresh seed values.
  // Both wrapped in try/catch so a downstream failure doesn't poison the row insert.
  let proformaSeeded = false;
  try {
    const seedResult = await seedProFormaYear1(pool, ctx.dealId);
    proformaSeeded = seedResult.seeded;
    alerts.push(...seedResult.warnings.map(w => `[seeder] ${w}`));
  } catch (err) {
    alerts.push(`[seeder] failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  let crossValidationVariances = 0;
  try {
    const xValResult = await runCrossValidation(pool, ctx.dealId);
    crossValidationVariances = xValResult.variancesFound;
    if (xValResult.variancesFound > 0) {
      alerts.push(`[xval] ${xValResult.variancesFound} cross-doc variance(s) flagged: ${xValResult.alertsBySeverity.critical} critical, ${xValResult.alertsBySeverity.warning} warning`);
    }
  } catch (err) {
    alerts.push(`[xval] failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { rowsInserted, capsuleUpdated, libraryUpdated, proformaSeeded, crossValidationVariances, alerts };
}


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 3 — Update `RouteResult` interface to include the new outcome flags.
// ─────────────────────────────────────────────────────────────────────────────

// FIND (around line 12):
interface RouteResult {
  rowsInserted: number;
  capsuleUpdated: boolean;
  libraryUpdated: boolean;
  alerts: string[];
}

// REPLACE WITH:
interface RouteResult {
  rowsInserted: number;
  capsuleUpdated: boolean;
  libraryUpdated: boolean;
  proformaSeeded: boolean;
  crossValidationVariances: number;
  alerts: string[];
}


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 4 — `updateDealCapsule` for T12 must use the new ExtractionT12Capsule shape.
// Replace the entire `case 'T12':` block (around lines 565-611).
// ─────────────────────────────────────────────────────────────────────────────

// FIND `case 'T12': { ... }` block in updateDealCapsule

// REPLACE WITH:
    case 'T12': {
      const t12 = result.data as T12Data;
      const ext = (result as any).chartFormat;
      const summary = result.summary as any;

      capsulePayload.extraction_t12 = {
        source: 'platform',
        updatedAt: now,
        chart_format: ext ?? 'unknown',
        document_id: ctx.documentId ?? null,
        period_start: t12.summary.periodStart,
        period_end: t12.summary.periodEnd,
        months_captured: t12.months.length,
        // Revenue
        gpr: summary.gpr ?? t12.summary.t12Revenue ?? 0,
        loss_to_lease: summary.lossToLease ?? 0,
        loss_to_lease_pct: summary.gpr > 0 ? Math.abs(summary.lossToLease ?? 0) / summary.gpr : 0,
        concessions: {
          one_time: summary.concessionsOneTime ?? 0,
          renewal: summary.concessionsRenewal ?? 0,
          total: summary.concessions ?? 0,
        },
        vacancy_loss: summary.vacancyLoss ?? 0,
        vacancy_loss_pct: summary.gpr > 0 ? Math.abs(summary.vacancyLoss ?? 0) / summary.gpr : 0,
        non_revenue_units: summary.nonRevenueUnits ?? 0,
        bad_debt: {
          gross: summary.badDebtGross ?? summary.badDebt ?? 0,
          recovery: summary.badDebtRecovery ?? 0,
          net: summary.badDebt ?? 0,
        },
        net_rental_income: summary.netRentalIncome ?? 0,
        other_income: {
          total: (summary.t12Revenue ?? 0) - (summary.netRentalIncome ?? 0),
          breakdown: {},
        },
        egi: summary.t12Revenue ?? 0,
        // OpEx
        opex: {
          payroll: summary.payroll ?? 0,
          r_and_m: summary.repairsMaintenance ?? 0,
          turnover: summary.turnover ?? summary.turnoverCosts ?? 0,
          amenities: summary.amenities ?? 0,
          contract: summary.contractServices ?? 0,
          marketing: summary.marketing ?? 0,
          office: summary.office ?? 0,
          g_and_a: summary.adminGeneral ?? 0,
          hoa_dues: summary.hoaDues ?? 0,
          utilities: summary.utilities ?? 0,
          mgmt_fee: summary.managementFee ?? 0,
          real_estate_tax: summary.propertyTax ?? 0,
          personal_property_tax: summary.personalPropertyTax ?? 0,
          insurance: summary.insurance ?? null,  // null if not broken out
          total: summary.t12OpEx ?? 0,
        },
        noi: summary.t12NOI ?? 0,
        expense_ratio: summary.expenseRatio ?? 0,
        noi_margin: summary.noiMargin ?? 0,
        mgmt_fee_pct_of_egi: summary.mgmtFeePctOfEgi ?? 0,
        warnings: result.warnings,
      };

      // Existing variance-vs-broker check — keep this
      const brokerCheck = await pool.query(
        `SELECT deal_data->'financials'->'noi' as broker_noi,
                deal_data->'financials'->'revenue' as broker_revenue
         FROM deals WHERE id = $1`,
        [dealId]
      );
      // ... [keep the existing broker variance logic that already exists below this point]
      break;
    }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 5 — `case 'RENT_ROLL':` block in updateDealCapsule.
// Use the new capsuleExtras from the parser instead of recomputing from scratch.
// ─────────────────────────────────────────────────────────────────────────────

// REPLACE the existing case 'RENT_ROLL': { ... } block WITH:
    case 'RENT_ROLL': {
      const rr = result.data as RentRollData;
      const extras = (result as any).capsuleExtras ?? {};

      capsulePayload.extraction_rent_roll = {
        source: 'platform',
        updatedAt: now,
        layout: extras.layout ?? 'unknown',
        document_id: ctx.documentId ?? null,
        as_of_date: extras.as_of_date,
        source_system_id: extras.source_system_id,
        // Counts
        total_units: extras.total_units ?? rr.summary.totalUnits,
        occupied_units: extras.occupied_units ?? rr.summary.occupiedUnits,
        vacant_units: extras.vacant_units ?? rr.summary.vacantUnits,
        non_revenue_units: extras.non_revenue_units ?? 0,
        future_residents: extras.future_residents ?? rr.summary.futureResidents,
        // Income aggregates
        gpr_monthly: extras.gpr_monthly ?? rr.summary.totalMarketRent,
        in_place_rent_monthly: extras.in_place_rent_monthly ?? 0,
        loss_to_lease_monthly: extras.loss_to_lease_monthly ?? rr.summary.lossToLease,
        loss_to_lease_pct: extras.loss_to_lease_pct ?? rr.summary.lossToLeasePct,
        total_billings_monthly: extras.total_billings_monthly ?? rr.summary.totalLeaseCharges,
        egi_in_place_annualized: extras.egi_in_place_annualized ?? rr.summary.totalLeaseCharges * 12,
        // Per-unit
        avg_market_rent: extras.avg_market_rent ?? rr.summary.avgMarketRent,
        avg_effective_rent: extras.avg_effective_rent ?? rr.summary.avgEffectiveRent,
        avg_unit_sqft: extras.avg_unit_sqft ?? 0,
        total_rentable_sqft: extras.total_rentable_sqft ?? 0,
        // Occupancy
        occupancy_by_unit_pct: extras.occupancy_by_unit_pct ?? rr.summary.occupancyRate,
        occupancy_by_sqft_pct: extras.occupancy_by_sqft_pct ?? 0,
        // Charge codes + grouped income
        charge_codes: extras.charge_codes ?? {},
        other_income_monthly: extras.other_income_monthly ?? {
          parking: 0, pet_rent: 0, storage: 0, rubs: 0,
          fees: 0, insurance_admin: 0, concessions_other: 0, other: 0,
        },
        // Mix
        floor_plan_mix: extras.floor_plan_mix ?? rr.summary.floorPlanMix,
        bedroom_mix: extras.bedroom_mix ?? {},
        // Risk
        outstanding_balance_total: extras.outstanding_balance_total ?? 0,
        outstanding_balance_ratio: extras.outstanding_balance_ratio ?? 0,
        security_deposits_held: extras.security_deposits_held ?? 0,
        pre_lease_ratio: extras.pre_lease_ratio ?? 0,
        expiration_curve: extras.expiration_curve ?? {
          months_0_3: 0, months_3_6: 0, months_6_12: 0, months_12_plus: 0, mtm: 0,
        },
        warnings: result.warnings,
      };
      break;
    }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH 6 — Add documentId to RouteContext so capsule entries can reference
// the source document. Update the interface near line 6:
// ─────────────────────────────────────────────────────────────────────────────

// FIND:
interface RouteContext {
  dealId: string;
  filename: string;
  uploadedBy: string;
}

// REPLACE WITH:
interface RouteContext {
  dealId: string;
  filename: string;
  uploadedBy: string;
  documentId?: string;        // deal_document_files.id — passed by extraction-pipeline
}
