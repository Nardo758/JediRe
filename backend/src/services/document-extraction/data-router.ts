import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { ExtractionResult, DocumentType, T12Data, RentRollData, AgedReceivablesData, BoxScoreData, ConcessionBurnoffData, LTOData, TaxBillData, OtherIncomeData } from './types';

interface RouteContext {
  dealId: string;
  propertyId: string;
  filename: string;
  uploadedBy: string;
}

interface RouteResult {
  rowsInserted: number;
  capsuleUpdated: boolean;
  libraryUpdated: boolean;
  alerts: string[];
}

async function getPropertyIdForDeal(pool: Pool, dealId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT property_id FROM deals WHERE id = $1 AND property_id IS NOT NULL
     LIMIT 1`,
    [dealId]
  );
  return result.rows[0]?.property_id || null;
}

export async function routeExtractionResult(
  result: ExtractionResult,
  ctx: RouteContext
): Promise<RouteResult> {
  if (!result.success || !result.data) {
    return { rowsInserted: 0, capsuleUpdated: false, libraryUpdated: false, alerts: [`Skipping failed extraction: ${result.error}`] };
  }

  const pool = getPool();
  const propertyId = await getPropertyIdForDeal(pool, ctx.dealId);
  const alerts: string[] = [];
  let rowsInserted = 0;

  const sourceRef = ctx.filename;
  const sourceDate = new Date().toISOString().split('T')[0];

  switch (result.documentType) {
    case 'T12':
      if (!propertyId) {
        alerts.push('T12 data stored in deal capsule only — no linked property for deal_monthly_actuals insert. Link a property to enable full routing.');
      } else {
        rowsInserted = await routeT12(pool, result.data as T12Data, propertyId, ctx.dealId, sourceRef, sourceDate);
      }
      break;
    case 'RENT_ROLL':
      rowsInserted = await routeRentRoll(pool, result.data as RentRollData, ctx.dealId, sourceRef, sourceDate);
      break;
    case 'AGED_RECEIVABLES':
      rowsInserted = await routeAgedReceivables(pool, result.data as AgedReceivablesData, ctx.dealId, sourceRef, sourceDate);
      break;
    case 'BOX_SCORE':
      rowsInserted = await routeBoxScore(pool, result.data as BoxScoreData, ctx.dealId, sourceRef, sourceDate, alerts);
      break;
    case 'CONCESSION_BURNOFF':
      rowsInserted = await routeConcessionBurnoff(pool, result.data as ConcessionBurnoffData, ctx.dealId, sourceRef, sourceDate, alerts);
      break;
    case 'T30_LTO':
      rowsInserted = await routeLTO(pool, result.data as LTOData, ctx.dealId, sourceRef, sourceDate);
      break;
    case 'TAX_BILL':
      rowsInserted = await routeTaxBill(pool, result.data as TaxBillData, ctx.dealId, sourceRef, sourceDate);
      break;
    case 'OTHER_INCOME':
      rowsInserted = await routeOtherIncome(pool, result.data as OtherIncomeData, ctx.dealId, sourceRef, sourceDate);
      break;
  }

  let libraryUpdated = false;
  try {
    await upsertDataLibraryAsset(pool, ctx.dealId, result);
    libraryUpdated = true;
  } catch (err) {
    alerts.push(`Data Library update failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  let capsuleUpdated = false;
  try {
    await updateDealCapsule(pool, ctx.dealId, result, alerts);
    capsuleUpdated = true;
  } catch (err) {
    alerts.push(`Capsule update failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return { rowsInserted, capsuleUpdated, libraryUpdated, alerts };
}

async function routeT12(pool: Pool, data: T12Data, propertyId: string, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  let count = 0;
  for (const month of data.months) {
    await pool.query(
      `INSERT INTO deal_monthly_actuals (
        property_id, report_month, total_units, occupied_units,
        gross_potential_rent, loss_to_lease, vacancy_loss, concessions, bad_debt,
        net_rental_income, other_income, utility_reimbursement, late_fees, misc_income,
        effective_gross_income, payroll, repairs_maintenance, turnover_costs, marketing,
        admin_general, management_fee, utilities, contract_services, property_tax, insurance,
        total_opex, noi, data_source, source_document_type, source_period_label
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
      ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO UPDATE SET
        gross_potential_rent = EXCLUDED.gross_potential_rent,
        loss_to_lease = EXCLUDED.loss_to_lease,
        vacancy_loss = EXCLUDED.vacancy_loss,
        concessions = EXCLUDED.concessions,
        bad_debt = EXCLUDED.bad_debt,
        net_rental_income = EXCLUDED.net_rental_income,
        other_income = EXCLUDED.other_income,
        utility_reimbursement = EXCLUDED.utility_reimbursement,
        late_fees = EXCLUDED.late_fees,
        misc_income = EXCLUDED.misc_income,
        effective_gross_income = EXCLUDED.effective_gross_income,
        payroll = EXCLUDED.payroll,
        repairs_maintenance = EXCLUDED.repairs_maintenance,
        turnover_costs = EXCLUDED.turnover_costs,
        marketing = EXCLUDED.marketing,
        admin_general = EXCLUDED.admin_general,
        management_fee = EXCLUDED.management_fee,
        utilities = EXCLUDED.utilities,
        contract_services = EXCLUDED.contract_services,
        property_tax = EXCLUDED.property_tax,
        insurance = EXCLUDED.insurance,
        total_opex = EXCLUDED.total_opex,
        noi = EXCLUDED.noi,
        data_source = EXCLUDED.data_source,
        source_document_type = EXCLUDED.source_document_type,
        updated_at = NOW()`,
      [
        propertyId, month.reportMonth, month.totalUnits, month.occupiedUnits,
        month.grossPotentialRent, month.lossToLease, month.vacancyLoss, month.concessions, month.badDebt,
        month.netRentalIncome, month.otherIncome, month.utilityReimbursement, month.lateFees, month.miscIncome,
        month.effectiveGrossIncome, month.payroll, month.repairsMaintenance, month.turnoverCosts, month.marketing,
        month.adminGeneral, month.managementFee, month.utilities, month.contractServices, month.propertyTax, month.insurance,
        month.totalOpex, month.noi, 'extraction', 'T12', month.reportMonth,
      ]
    );
    count++;
  }
  return count;
}

async function routeRentRoll(pool: Pool, data: RentRollData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  await pool.query(
    `DELETE FROM deal_lease_transactions WHERE deal_id = $1 AND source_type = 'extraction' AND source_ref = $2`,
    [dealId, sourceRef]
  );

  let count = 0;
  for (const unit of data.units) {
    const marketRent = unit.marketRent;
    const effectiveRent = unit.effectiveRent || unit.leaseRent;
    const lossToLease = marketRent != null && effectiveRent != null ? marketRent - effectiveRent : null;
    const lossToLeasePct = marketRent && marketRent > 0 && lossToLease != null ? lossToLease / marketRent : null;
    const sqft = unit.sqft;
    const rentPsf = effectiveRent && sqft && sqft > 0 ? effectiveRent / sqft : null;

    await pool.query(
      `INSERT INTO deal_lease_transactions (
        deal_id, unit_number, unit_type, sqft, lease_type,
        lease_start, lease_end, move_in_date, tenant_name,
        market_rent, new_rent, effective_rent, concession_amount,
        loss_to_lease, loss_to_lease_pct, rent_psf, lease_status,
        source_type, source_ref, source_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        dealId, unit.unitNumber, unit.unitType, sqft, unit.status === 'vacant' ? 'vacant' : 'current',
        unit.leaseStart, unit.leaseEnd, unit.moveInDate, unit.tenantName,
        marketRent, unit.leaseRent, effectiveRent, null,
        lossToLease, lossToLeasePct, rentPsf, unit.status,
        'extraction', sourceRef, sourceDate,
      ]
    );
    count++;
  }
  return count;
}

async function routeAgedReceivables(pool: Pool, data: AgedReceivablesData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  await pool.query(
    `DELETE FROM deal_receivables_aging WHERE deal_id = $1 AND source_type = 'extraction' AND source_ref = $2`,
    [dealId, sourceRef]
  );

  let count = 0;
  for (const rec of data.records) {
    await pool.query(
      `INSERT INTO deal_receivables_aging (
        deal_id, unit_number, tenant_name, current_balance,
        bucket_0_30, bucket_31_60, bucket_61_90, bucket_90_plus,
        prepaid, total_balance, lease_status,
        source_type, source_ref, source_date, source_deal_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        dealId, rec.unitNumber, rec.tenantName, rec.currentBalance,
        rec.bucket_0_30, rec.bucket_31_60, rec.bucket_61_90, rec.bucket_90_plus,
        rec.prepaid, rec.totalBalance, rec.leaseStatus,
        'extraction', sourceRef, sourceDate, dealId,
      ]
    );
    count++;
  }
  return count;
}

async function routeBoxScore(pool: Pool, data: BoxScoreData, dealId: string, sourceRef: string, sourceDate: string, alerts: string[]): Promise<number> {
  const vacancyPct = data.summary.occupancyPct != null ? (1 - data.summary.occupancyPct) * 100 : null;
  const totalUnits = data.summary.totalUnits || null;

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, vacancy_pct, total_units, source_type, source_ref, source_date, created_at)
     VALUES ($1, $2, $3, 'extraction', $4, $5, NOW())
     ON CONFLICT (deal_id) DO UPDATE SET
       vacancy_pct = COALESCE(EXCLUDED.vacancy_pct, deal_assumptions.vacancy_pct),
       total_units = COALESCE(EXCLUDED.total_units, deal_assumptions.total_units),
       source_type = 'extraction',
       source_ref = EXCLUDED.source_ref,
       source_date = EXCLUDED.source_date,
       updated_at = NOW()`,
    [dealId, vacancyPct, totalUnits, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deals SET
       deal_data = COALESCE(deal_data, '{}'::jsonb) || $2::jsonb,
       updated_at = NOW()
     WHERE id = $1`,
    [dealId, JSON.stringify({
      extraction_box_score_detail: {
        availability: data.availability,
        activity: data.activity,
        conversions: data.conversions,
        summary: data.summary,
        source_ref: sourceRef,
        source_date: sourceDate,
      }
    })]
  );

  if (data.summary.occupancyPct < 0.85) {
    alerts.push(`⚠ Box Score occupancy ${(data.summary.occupancyPct * 100).toFixed(1)}% is below 85% threshold`);
  }

  const activityEvents: Array<{ lease_type: string; count: number }> = [
    { lease_type: 'move_in', count: data.activity.moveIns },
    { lease_type: 'move_out', count: data.activity.moveOuts },
    { lease_type: 'renewal', count: data.activity.renewals },
    { lease_type: 'transfer', count: data.activity.transfers },
    { lease_type: 'mtm_conversion', count: data.activity.mtmConversions },
    { lease_type: 'eviction', count: data.activity.evictions },
    { lease_type: 'skip', count: data.activity.skips },
  ];
  for (const evt of activityEvents) {
    if (evt.count > 0) {
      await pool.query(
        `INSERT INTO deal_lease_transactions (
          deal_id, unit_number, lease_type, lease_status,
          source_type, source_ref, source_date
        ) VALUES ($1, $2, $3, $4, 'extraction', $5, $6)`,
        [dealId, `box_score_${evt.lease_type}`, evt.lease_type, `count:${evt.count}`, sourceRef, sourceDate]
      );
    }
  }

  for (const conv of data.conversions) {
    if (conv.leased > 0 || conv.firstContacts > 0) {
      await pool.query(
        `INSERT INTO deal_lease_transactions (
          deal_id, unit_number, lease_type, lease_status,
          source_type, source_ref, source_date
        ) VALUES ($1, $2, 'conversion_funnel', $3, 'extraction', $4, $5)`,
        [dealId, `funnel_${conv.channel}`,
         JSON.stringify({ channel: conv.channel, firstContacts: conv.firstContacts, shows: conv.shows, applied: conv.applied, approved: conv.approved, leased: conv.leased, conversionRate: conv.conversionRate }),
         sourceRef, sourceDate]
      );
    }
  }

  return 1 + activityEvents.filter(e => e.count > 0).length + data.conversions.filter(c => c.leased > 0 || c.firstContacts > 0).length;
}

async function routeConcessionBurnoff(pool: Pool, data: ConcessionBurnoffData, dealId: string, sourceRef: string, sourceDate: string, alerts: string[]): Promise<number> {
  const concessionsPct = data.summary.avgConcessionDepth ? data.summary.avgConcessionDepth * 100 : null;

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, concessions_pct, source_type, source_ref, source_date, created_at)
     VALUES ($1, $2, 'extraction', $3, $4, NOW())
     ON CONFLICT (deal_id) DO UPDATE SET
       concessions_pct = COALESCE(EXCLUDED.concessions_pct, deal_assumptions.concessions_pct),
       source_type = 'extraction',
       source_ref = EXCLUDED.source_ref,
       source_date = EXCLUDED.source_date,
       updated_at = NOW()`,
    [dealId, concessionsPct, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deals SET
       deal_data = COALESCE(deal_data, '{}'::jsonb) || $2::jsonb,
       updated_at = NOW()
     WHERE id = $1`,
    [dealId, JSON.stringify({
      extraction_concession_detail: {
        records: data.records,
        summary: data.summary,
        source_ref: sourceRef,
        source_date: sourceDate,
      }
    })]
  );

  if (data.summary.avgConcessionDepth > 0.05) {
    alerts.push(`⚠ Average concession depth ${(data.summary.avgConcessionDepth * 100).toFixed(1)}% exceeds 5% threshold`);
  }

  let enriched = 0;
  for (const rec of data.records) {
    if (rec.unitNumber && rec.currentConcession > 0) {
      const updateRes = await pool.query(
        `UPDATE deal_lease_transactions SET
           concession_amount = $3,
           updated_at = NOW()
         WHERE deal_id = $1 AND unit_number = $2
           AND concession_amount IS NULL`,
        [dealId, rec.unitNumber, rec.currentConcession]
      );
      if (updateRes.rowCount > 0) enriched++;
    }
  }
  if (enriched > 0) {
    alerts.push(`Enriched ${enriched} lease transaction records with concession data`);
  }

  return data.records.length;
}

async function routeLTO(pool: Pool, data: LTOData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  await pool.query(
    `DELETE FROM deal_lease_transactions WHERE deal_id = $1 AND source_type = 'extraction' AND source_ref = $2`,
    [dealId, sourceRef]
  );

  let count = 0;
  for (const rec of data.records) {
    await pool.query(
      `INSERT INTO deal_lease_transactions (
        deal_id, unit_number, unit_type, lease_type,
        lease_start, lease_end, tenant_name,
        market_rent, prior_rent, new_rent, effective_rent,
        concession_amount, rent_change_dollar, rent_change_pct,
        lease_status, source_type, source_ref, source_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        dealId, rec.unitNumber, rec.unitType, rec.transactionType,
        rec.leaseStart, rec.leaseEnd, rec.tenantName,
        rec.marketRent, rec.priorRent, rec.leaseRent, rec.effectiveRent,
        rec.concession, rec.rentChange, rec.rentChangePct,
        'completed', 'extraction', sourceRef, sourceDate,
      ]
    );
    count++;
  }
  return count;
}

async function routeTaxBill(pool: Pool, data: TaxBillData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  const taxRate = (data.assessedValue && data.assessedValue > 0 && data.totalAnnualTax)
    ? data.totalAnnualTax / data.assessedValue
    : null;

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, property_tax_rate, source_type, source_ref, source_date, created_at)
     VALUES ($1, $2, 'extraction', $3, $4, NOW())
     ON CONFLICT (deal_id) DO UPDATE SET
       property_tax_rate = COALESCE(EXCLUDED.property_tax_rate, deal_assumptions.property_tax_rate),
       source_type = 'extraction',
       source_ref = EXCLUDED.source_ref,
       source_date = EXCLUDED.source_date,
       updated_at = NOW()`,
    [dealId, taxRate, sourceRef, sourceDate]
  );

  const propertyId = await getPropertyIdForDeal(pool, dealId);
  if (propertyId && data.totalAnnualTax) {
    const monthlyTax = data.totalAnnualTax / 12;
    const taxYear = data.taxYear || new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const reportMonth = `${taxYear}-${String(m).padStart(2, '0')}-01`;
      await pool.query(
        `INSERT INTO deal_monthly_actuals (property_id, report_month, property_tax, data_source, source_document_type, source_period_label)
         VALUES ($1, $2, $3, 'extraction', 'TAX_BILL', $4)
         ON CONFLICT (property_id, report_month, is_budget, is_proforma) DO UPDATE SET
           property_tax = EXCLUDED.property_tax,
           source_document_type = 'TAX_BILL',
           updated_at = NOW()`,
        [propertyId, reportMonth, monthlyTax, reportMonth]
      );
    }
  }

  return 1;
}

async function routeOtherIncome(pool: Pool, data: OtherIncomeData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  let otherIncomePerUnit: number | null = data.summary.perUnitTotal ? data.summary.perUnitTotal / 12 : null;
  if (!otherIncomePerUnit && data.summary.totalAnnual > 0) {
    const unitsResult = await pool.query(
      `SELECT COALESCE(da.total_units, d.target_units) as unit_count
       FROM deals d LEFT JOIN deal_assumptions da ON da.deal_id = d.id
       WHERE d.id = $1 LIMIT 1`,
      [dealId]
    );
    const units = parseInt(unitsResult.rows[0]?.unit_count) || 0;
    if (units > 0) {
      otherIncomePerUnit = data.summary.totalAnnual / units / 12;
    }
  }

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, other_income_per_unit, source_type, source_ref, source_date, created_at)
     VALUES ($1, $2, 'extraction', $3, $4, NOW())
     ON CONFLICT (deal_id) DO UPDATE SET
       other_income_per_unit = COALESCE(EXCLUDED.other_income_per_unit, deal_assumptions.other_income_per_unit),
       source_type = 'extraction',
       source_ref = EXCLUDED.source_ref,
       source_date = EXCLUDED.source_date,
       updated_at = NOW()`,
    [dealId, otherIncomePerUnit, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deals SET
       deal_data = COALESCE(deal_data, '{}'::jsonb) || $2::jsonb,
       updated_at = NOW()
     WHERE id = $1`,
    [dealId, JSON.stringify({
      broker_claims: {
        other_income: {
          categories: data.categories,
          summary: data.summary,
          source_ref: sourceRef,
          source_date: sourceDate,
        }
      }
    })]
  );

  return data.categories.length;
}

async function upsertDataLibraryAsset(pool: Pool, dealId: string, result: ExtractionResult): Promise<void> {
  const extractionData: Record<string, any> = {
    document_type: result.documentType,
    extracted_at: new Date().toISOString(),
    summary: result.summary,
    warnings: result.warnings,
  };

  const existingResult = await pool.query(
    `SELECT id FROM data_library_assets WHERE source_deal_id = $1 LIMIT 1`,
    [dealId]
  );

  if (existingResult.rows.length > 0) {
    await pool.query(
      `UPDATE data_library_assets SET
         extraction_data = COALESCE(extraction_data, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
       WHERE source_deal_id = $1`,
      [dealId, JSON.stringify({ [result.documentType]: extractionData })]
    );
  } else {
    const dealResult = await pool.query(
      `SELECT d.id, d.name as deal_name, p.name as property_name, p.units, p.year_built, p.city, p.state_code
       FROM deals d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );

    if (dealResult.rows.length > 0) {
      const deal = dealResult.rows[0];
      await pool.query(
        `INSERT INTO data_library_assets (
          property_name, city, state, unit_count, year_built,
          source_deal_id, extraction_data, data_quality_score, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 50, NOW(), NOW())
        ON CONFLICT (source_deal_id) WHERE source_deal_id IS NOT NULL DO UPDATE SET
          extraction_data = COALESCE(data_library_assets.extraction_data, '{}'::jsonb) || EXCLUDED.extraction_data,
          updated_at = NOW()`,
        [
          deal.property_name || deal.deal_name || 'Untitled',
          deal.city, deal.state_code, deal.units, deal.year_built,
          dealId, JSON.stringify({ [result.documentType]: extractionData }),
        ]
      );
    }
  }
}

async function updateDealCapsule(pool: Pool, dealId: string, result: ExtractionResult, alerts: string[]): Promise<void> {
  const capsulePayload: Record<string, any> = {};
  const now = new Date().toISOString();

  switch (result.documentType) {
    case 'T12': {
      const t12 = result.data as T12Data;
      capsulePayload.extraction_t12 = {
        source: 'platform',
        updatedAt: now,
        t12Revenue: t12.summary.t12Revenue,
        t12OpEx: t12.summary.t12OpEx,
        t12NOI: t12.summary.t12NOI,
        expenseRatio: t12.summary.expenseRatio,
        periodStart: t12.summary.periodStart,
        periodEnd: t12.summary.periodEnd,
      };

      const brokerCheck = await pool.query(
        `SELECT deal_data->'financials'->'noi' as broker_noi,
                deal_data->'financials'->'revenue' as broker_revenue
         FROM deals WHERE id = $1`,
        [dealId]
      );
      if (brokerCheck.rows.length > 0) {
        const row = brokerCheck.rows[0];
        const brokerNoi = parseFloat(row.broker_noi) || null;
        const brokerRevenue = parseFloat(row.broker_revenue) || null;

        if (brokerNoi && t12.summary.t12NOI > 0) {
          const noiVariance = Math.abs(t12.summary.t12NOI - brokerNoi) / brokerNoi;
          if (noiVariance > 0.15) {
            alerts.push(`⚠ T12 NOI ($${Math.round(t12.summary.t12NOI).toLocaleString()}) diverges ${(noiVariance * 100).toFixed(1)}% from broker-stated NOI ($${Math.round(brokerNoi).toLocaleString()})`);
            capsulePayload.extraction_variance_noi = {
              t12Actual: t12.summary.t12NOI,
              brokerStated: brokerNoi,
              variancePct: noiVariance,
              flaggedAt: now,
            };
          }
        }

        if (brokerRevenue && t12.summary.t12Revenue > 0) {
          const revenueVariance = Math.abs(t12.summary.t12Revenue - brokerRevenue) / brokerRevenue;
          if (revenueVariance > 0.15) {
            alerts.push(`⚠ T12 Revenue ($${Math.round(t12.summary.t12Revenue).toLocaleString()}) diverges ${(revenueVariance * 100).toFixed(1)}% from broker-stated Revenue ($${Math.round(brokerRevenue).toLocaleString()})`);
          }
        }
      }
      break;
    }
    case 'RENT_ROLL': {
      const rr = result.data as RentRollData;
      capsulePayload.extraction_rent_roll = {
        source: 'platform',
        updatedAt: now,
        totalUnits: rr.summary.totalUnits,
        occupancyRate: rr.summary.occupancyRate,
        avgMarketRent: rr.summary.avgMarketRent,
        avgEffectiveRent: rr.summary.avgEffectiveRent,
        lossToLeasePct: rr.summary.lossToLeasePct,
        floorPlanCount: Object.keys(rr.summary.floorPlanMix).length,
      };
      break;
    }
    case 'AGED_RECEIVABLES': {
      const ar = result.data as AgedReceivablesData;
      capsulePayload.extraction_aged_receivables = {
        source: 'platform',
        updatedAt: now,
        totalAR: ar.summary.totalAR,
        seriousDelinquencyRate: ar.summary.seriousDelinquencyRate,
        unitsDelinquent: ar.summary.unitsDelinquent,
      };
      if (ar.summary.seriousDelinquencyRate > 0.10) {
        alerts.push(`⚠ Serious delinquency rate ${(ar.summary.seriousDelinquencyRate * 100).toFixed(1)}% exceeds 10% threshold`);
      }
      break;
    }
    case 'BOX_SCORE': {
      const bs = result.data as BoxScoreData;
      capsulePayload.extraction_box_score = {
        source: 'platform',
        updatedAt: now,
        occupancyPct: bs.summary.occupancyPct,
        leasedPct: bs.summary.leasedPct,
        netAbsorption: bs.summary.netAbsorption,
        overallConversionRate: bs.summary.overallConversionRate,
      };
      break;
    }
    case 'CONCESSION_BURNOFF': {
      const cb = result.data as ConcessionBurnoffData;
      capsulePayload.extraction_concession_burnoff = {
        source: 'platform',
        updatedAt: now,
        totalActiveConcessions: cb.summary.totalActiveConcessions,
        totalRemainingLiability: cb.summary.totalRemainingLiability,
        avgConcessionDepth: cb.summary.avgConcessionDepth,
      };
      break;
    }
    case 'T30_LTO': {
      const lto = result.data as LTOData;
      capsulePayload.extraction_lto = {
        source: 'platform',
        updatedAt: now,
        totalTransactions: lto.summary.totalTransactions,
        newLeases: lto.summary.newLeases,
        renewals: lto.summary.renewals,
        avgTradeOutGainPct: lto.summary.avgTradeOutGainPct,
      };
      break;
    }
    case 'TAX_BILL': {
      const tax = result.data as TaxBillData;
      capsulePayload.extraction_tax_bill = {
        source: 'platform',
        updatedAt: now,
        totalAnnualTax: tax.totalAnnualTax,
        assessedValue: tax.assessedValue,
        taxYear: tax.taxYear,
        appealStatus: tax.appealStatus,
      };
      break;
    }
    case 'OTHER_INCOME': {
      const oi = result.data as OtherIncomeData;
      if (!capsulePayload.broker_claims) capsulePayload.broker_claims = {};
      capsulePayload.broker_claims.other_income = {
        source: 'platform',
        updatedAt: now,
        totalAnnual: oi.summary.totalAnnual,
        categoryCount: oi.summary.categoryCount,
      };

      const t12Check = await pool.query(
        `SELECT SUM(COALESCE(other_income, 0) + COALESCE(utility_reimbursement, 0) + COALESCE(late_fees, 0) + COALESCE(misc_income, 0)) as t12_other_income
         FROM deal_monthly_actuals
         WHERE property_id IN (SELECT property_id FROM deals WHERE id = $1 AND property_id IS NOT NULL)
           AND report_month >= (CURRENT_DATE - INTERVAL '12 months')::date`,
        [dealId]
      );
      const t12OtherIncome = parseFloat(t12Check.rows[0]?.t12_other_income) || 0;

      if (t12OtherIncome > 0 && oi.summary.totalAnnual > 0) {
        const oiVariance = Math.abs(oi.summary.totalAnnual - t12OtherIncome) / t12OtherIncome;
        if (oiVariance > 0.15) {
          alerts.push(`⚠ Broker Other Income Schedule ($${Math.round(oi.summary.totalAnnual).toLocaleString()}/yr) diverges ${(oiVariance * 100).toFixed(1)}% from T12 trailing other income ($${Math.round(t12OtherIncome).toLocaleString()}/yr)`);
          capsulePayload.broker_claims.other_income_variance = {
            brokerProjected: oi.summary.totalAnnual,
            t12Actual: t12OtherIncome,
            variancePct: oiVariance,
            flaggedAt: now,
          };
        }
      }
      break;
    }
  }

  if (Object.keys(capsulePayload).length > 0) {
    await pool.query(
      `UPDATE deals SET
         deal_data = COALESCE(deal_data, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
       WHERE id = $1`,
      [dealId, JSON.stringify(capsulePayload)]
    );
  }
}
