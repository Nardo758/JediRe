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

async function getPropertyIdForDeal(pool: any, dealId: string): Promise<string> {
  const result = await pool.query(
    `SELECT property_id FROM deals WHERE id = $1
     UNION SELECT id FROM properties WHERE id = $1
     LIMIT 1`,
    [dealId]
  );
  return result.rows[0]?.property_id || dealId;
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
      rowsInserted = await routeT12(pool, result.data as T12Data, propertyId, ctx.dealId, sourceRef, sourceDate);
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

  return { rowsInserted, capsuleUpdated: true, libraryUpdated, alerts };
}

async function routeT12(pool: any, data: T12Data, propertyId: string, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
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
        month.totalOpex, month.noi, 'extraction', 'T12', sourceRef,
      ]
    );
    count++;
  }
  return count;
}

async function routeRentRoll(pool: any, data: RentRollData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
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

async function routeAgedReceivables(pool: any, data: AgedReceivablesData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
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

async function routeBoxScore(pool: any, data: BoxScoreData, dealId: string, sourceRef: string, sourceDate: string, alerts: string[]): Promise<number> {
  const payload = {
    type: 'box_score',
    availability: data.availability,
    activity: data.activity,
    conversions: data.conversions,
    summary: data.summary,
    source_ref: sourceRef,
    source_date: sourceDate,
  };

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, source_type, source_ref, source_date, created_at)
     VALUES ($1, 'extraction', $2, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [dealId, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deal_assumptions SET
       notes = COALESCE(notes, '') || E'\n[BoxScore] ' || $2::text,
       updated_at = NOW()
     WHERE deal_id = $1`,
    [dealId, JSON.stringify(payload)]
  );

  if (data.summary.occupancyPct < 0.85) {
    alerts.push(`⚠ Box Score occupancy ${(data.summary.occupancyPct * 100).toFixed(1)}% is below 85% threshold`);
  }

  return 1;
}

async function routeConcessionBurnoff(pool: any, data: ConcessionBurnoffData, dealId: string, sourceRef: string, sourceDate: string, alerts: string[]): Promise<number> {
  const payload = {
    type: 'concession_burnoff',
    records: data.records,
    summary: data.summary,
    source_ref: sourceRef,
    source_date: sourceDate,
  };

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, source_type, source_ref, source_date, created_at)
     VALUES ($1, 'extraction', $2, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [dealId, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deal_assumptions SET
       notes = COALESCE(notes, '') || E'\n[ConcessionBurnoff] ' || $2::text,
       updated_at = NOW()
     WHERE deal_id = $1`,
    [dealId, JSON.stringify(payload)]
  );

  if (data.summary.avgConcessionDepth > 0.05) {
    alerts.push(`⚠ Average concession depth ${(data.summary.avgConcessionDepth * 100).toFixed(1)}% exceeds 5% threshold`);
  }

  return data.records.length;
}

async function routeLTO(pool: any, data: LTOData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
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

async function routeTaxBill(pool: any, data: TaxBillData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  const payload = {
    type: 'tax_bill',
    ...data,
    source_ref: sourceRef,
    source_date: sourceDate,
  };

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, source_type, source_ref, source_date, created_at)
     VALUES ($1, 'extraction', $2, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [dealId, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deal_assumptions SET
       notes = COALESCE(notes, '') || E'\n[TaxBill] ' || $2::text,
       updated_at = NOW()
     WHERE deal_id = $1`,
    [dealId, JSON.stringify(payload)]
  );

  return 1;
}

async function routeOtherIncome(pool: any, data: OtherIncomeData, dealId: string, sourceRef: string, sourceDate: string): Promise<number> {
  const payload = {
    type: 'other_income_schedule',
    categories: data.categories,
    summary: data.summary,
    source_ref: sourceRef,
    source_date: sourceDate,
  };

  await pool.query(
    `INSERT INTO deal_assumptions (deal_id, source_type, source_ref, source_date, created_at)
     VALUES ($1, 'extraction', $2, $3, NOW())
     ON CONFLICT DO NOTHING`,
    [dealId, sourceRef, sourceDate]
  );

  await pool.query(
    `UPDATE deal_assumptions SET
       notes = COALESCE(notes, '') || E'\n[OtherIncome] ' || $2::text,
       updated_at = NOW()
     WHERE deal_id = $1`,
    [dealId, JSON.stringify(payload)]
  );

  return data.categories.length;
}

async function upsertDataLibraryAsset(pool: any, dealId: string, result: ExtractionResult): Promise<void> {
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
        ON CONFLICT DO NOTHING`,
        [
          deal.property_name || deal.deal_name || 'Untitled',
          deal.city, deal.state_code, deal.units, deal.year_built,
          dealId, JSON.stringify({ [result.documentType]: extractionData }),
        ]
      );
    }
  }
}
