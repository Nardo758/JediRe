import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import path from 'path';

const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857';
const PROPERTY_NAME = 'Highlands at Satellite';
const ADDRESS = '2789 Satellite Blvd, Duluth, GA 30096';
const TOTAL_UNITS = 290;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseYardiNumber(raw: string | undefined): number {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return 0;
  let s = raw.replace(/"/g, '').replace(/\s/g, '').replace(/,/g, '');
  if (s === '-' || s === '') return 0;
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseYardiPct(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.includes('%')) return null;
  const n = parseFloat(trimmed.replace('%', ''));
  return isNaN(n) ? null : n / 100;
}

function excelDateToISO(excelDate: number): string {
  const totalDays = Math.round(excelDate - 25569);
  const baseDate = new Date(Date.UTC(1970, 0, 1));
  baseDate.setUTCDate(baseDate.getUTCDate() + totalDays);
  return baseDate.toISOString().split('T')[0];
}

async function importHighlandsDeal() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ═══════════════════════════════════════════════════════════
    // T001: Create Property & Deal Records
    // ═══════════════════════════════════════════════════════════
    console.log('=== T001: Creating Property & Deal ===');

    const propertyData = {
      year_built: 2020,
      submarket: 'Duluth/Suwanee',
      metro: 'Atlanta-Sandy Springs-Roswell MSA',
      county: 'Gwinnett',
      operator: 'Bell Partners',
      property_class: 'A',
      construction_type: 'Garden/Mid-Rise',
      unit_mix_summary: {
        '1BR': { types: 10, sf_range: '696-950', count_est: 185 },
        '2BR': { types: 4, sf_range: '1112-1169', count_est: 70 },
        '3BR': { types: 2, sf_range: '1141-1700', count_est: 35 },
      },
    };

    const propResult = await pool.query(
      `INSERT INTO properties (
        name, address_line1, city, state_code, zip, county,
        property_type, product_type, year_built, units,
        building_class, current_occupancy, ownership_status,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id`,
      [
        PROPERTY_NAME, ADDRESS, 'Duluth', 'GA', '30096', 'Gwinnett',
        'multi_family', 'garden', 2020, TOTAL_UNITS,
        'A', 0.928, 'owned',
        USER_ID,
      ]
    );
    const propertyId = propResult.rows[0].id;
    console.log(`  Property created: ${propertyId}`);

    const boundaryGeoJSON = JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [-84.0701, 33.9965],
        [-84.0671, 33.9965],
        [-84.0671, 33.9945],
        [-84.0701, 33.9945],
        [-84.0701, 33.9965],
      ]],
    });

    const dealResult = await pool.query(
      `INSERT INTO deals (
        user_id, name, boundary, project_type, target_units,
        deal_category, development_type, address, state,
        property_data, property_address, tier, status
      ) VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        USER_ID, PROPERTY_NAME, boundaryGeoJSON, 'multifamily', TOTAL_UNITS,
        'portfolio', 'existing', ADDRESS, 'POST_CLOSE',
        JSON.stringify({ ...propertyData, property_id: propertyId }),
        ADDRESS, 'pro', 'active',
      ]
    );
    const dealId = dealResult.rows[0].id;
    console.log(`  Deal created: ${dealId}`);

    await pool.query(
      `INSERT INTO deal_properties (deal_id, property_id, relationship, linked_by, confidence_score)
       VALUES ($1, $2, 'subject', 'import_script', 1.0)
       ON CONFLICT DO NOTHING`,
      [dealId, propertyId]
    );
    console.log(`  Deal-Property link created`);

    // ═══════════════════════════════════════════════════════════
    // T002: Import 13 Months of Financial Data
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== T002: Importing Financial Data ===');

    const csvPath = path.resolve(__dirname, '../../../attached_assets/BPI_Financial_Package_p2122_Accrual_p21221222(13_month_rolling_1772942683100.csv');
    const csvBuf = require('fs').readFileSync(csvPath);
    const csvText = csvBuf.toString('latin1');
    const csvLines = csvText.split(/\r?\n/);

    const months = [
      '2021-12-01', '2022-01-01', '2022-02-01', '2022-03-01',
      '2022-04-01', '2022-05-01', '2022-06-01', '2022-07-01',
      '2022-08-01', '2022-09-01', '2022-10-01', '2022-11-01', '2022-12-01',
    ];

    interface FinancialRow {
      account: string;
      values: number[];
      pctValues: (number | null)[];
    }

    const financialRows: Map<string, FinancialRow> = new Map();

    const targetAccounts: Record<string, string> = {
      'Gross Potential Rent': 'gpr',
      'Concessions': 'concessions',
      'Vacancy Loss': 'vacancy_loss',
      'Credit Loss': 'credit_loss',
      'Credit Loss Allowance': 'credit_loss_allowance',
      'Bad Debt Recovery': 'bad_debt_recovery',
      'Credit Loss Recovery Costs': 'credit_loss_recovery',
      'Total Rental Income': 'total_rental_income',
      'Other Income': 'other_income',
      'Utility Income': 'utility_income',
      'Total Other Income': 'total_other_income',
      'Total Income': 'total_income',
      'Utilities': 'utilities_expense',
      'Maintenance & Repairs': 'repairs_maintenance',
      'Landscaping': 'landscaping',
      'Alarm & Cable': 'alarm_cable',
      'Make-ready/turnover': 'turnover_costs',
      'Payroll': 'payroll',
      'Total Marketing': 'marketing',
      'Total Admin/Office': 'admin_general',
      'Management Fees': 'management_fee',
      'Total Insurance': 'insurance',
      'Real Property Taxes': 'property_tax',
      'Total Operating Expenses': 'total_opex',
      'Net Operating Income (NOI)': 'noi',
      'Net Income': 'net_income',
      'Less: Capital Expenditures': 'capex',
      'Cash Flow Less Owner Activity*': 'cash_flow',
      'Economic Occupancy': 'econ_occ',
      'Actual Occupancy': 'actual_occ',
      'Effective Rents': 'effective_rents',
      'Total Rental Losses': 'total_rental_losses',
      'Total Other Expense/Income': 'debt_service_other',
    };

    const seenKeys = new Set<string>();

    for (let i = 14; i < csvLines.length; i++) {
      const cells = parseCSVLine(csvLines[i]);
      const account = (cells[1] || '').trim();
      if (!account) continue;

      for (const [pattern, key] of Object.entries(targetAccounts)) {
        if (account === pattern || account.includes(pattern)) {
          if (seenKeys.has(key)) continue;

          const values = cells.slice(2, 15).map(c => parseYardiNumber(c));
          const pctValues = cells.slice(2, 15).map(c => parseYardiPct(c));
          const hasData = values.some(v => v !== 0) || pctValues.some(v => v !== null);

          if (hasData) {
            financialRows.set(key, { account, values, pctValues });
            seenKeys.add(key);
          }
          break;
        }
      }
    }

    console.log(`  Parsed ${financialRows.size} financial line items`);

    const getVal = (key: string, idx: number): number => {
      return financialRows.get(key)?.values[idx] ?? 0;
    };
    const getPct = (key: string, idx: number): number | null => {
      return financialRows.get(key)?.pctValues[idx] ?? null;
    };

    const excelPath = path.resolve(__dirname, '../../../attached_assets/Highlands_Weekly_Report_03.02.26__1772939681482.xlsx');
    const wb = XLSX.readFile(excelPath);
    const ws2 = wb.Sheets['Renewal & Trade Out'];
    const leaseData: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1 });

    const leaseCountByMonth: Map<string, { newLeases: number; renewals: number; moveOuts: number }> = new Map();
    for (let i = 1; i < leaseData.length; i++) {
      const r = leaseData[i];
      if (!r || !r[0] || !r[4]) continue;
      const dt = new Date((r[4] - 25569) * 86400 * 1000);
      if (dt.getFullYear() > 2030) continue;
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
      if (!leaseCountByMonth.has(monthKey)) {
        leaseCountByMonth.set(monthKey, { newLeases: 0, renewals: 0, moveOuts: 0 });
      }
      const counts = leaseCountByMonth.get(monthKey)!;
      const lt = String(r[3] || '').trim().toLowerCase();
      if (lt === 'new') counts.newLeases++;
      else if (lt === 'renewal') counts.renewals++;
    }

    let financialImported = 0;
    for (let idx = 0; idx < 13; idx++) {
      const reportMonth = months[idx];
      const gpr = getVal('gpr', idx);
      const concessions = getVal('concessions', idx);
      const vacancyLoss = getVal('vacancy_loss', idx);
      const creditLoss = getVal('credit_loss', idx);
      const creditLossAllowance = getVal('credit_loss_allowance', idx);
      const badDebtRecovery = getVal('bad_debt_recovery', idx);
      const badDebt = creditLoss + creditLossAllowance - badDebtRecovery;
      const totalRentalIncome = getVal('total_rental_income', idx);
      const otherIncome = getVal('other_income', idx);
      const utilityIncome = getVal('utility_income', idx);
      const totalIncome = getVal('total_income', idx);

      const payroll = getVal('payroll', idx);
      const repairsMaintenance = getVal('repairs_maintenance', idx);
      const turnoverCosts = getVal('turnover_costs', idx);
      const marketing = getVal('marketing', idx);
      const adminGeneral = getVal('admin_general', idx);
      const managementFee = getVal('management_fee', idx);
      const utilities = getVal('utilities_expense', idx);
      const landscaping = getVal('landscaping', idx);
      const alarmCable = getVal('alarm_cable', idx);
      const contractServices = landscaping + alarmCable;
      const insurance = getVal('insurance', idx);
      const propertyTax = getVal('property_tax', idx);
      const totalOpex = getVal('total_opex', idx);
      const noi = getVal('noi', idx);
      const capex = Math.abs(getVal('capex', idx));
      const debtServiceOther = getVal('debt_service_other', idx);
      const cashFlow = getVal('cash_flow', idx);

      const econOcc = getPct('econ_occ', idx);
      const actualOcc = getPct('actual_occ', idx);
      const effectiveRents = getVal('effective_rents', idx);

      const avgEffectiveRent = effectiveRents / TOTAL_UNITS;
      const avgMarketRent = gpr / TOTAL_UNITS;
      const occupiedUnits = actualOcc ? Math.round(actualOcc * TOTAL_UNITS) : null;
      const opexPerUnit = totalOpex / TOTAL_UNITS;
      const noiPerUnit = noi / TOTAL_UNITS;
      const opexRatio = totalIncome > 0 ? totalOpex / totalIncome : 0;
      const mgmtFeePct = totalRentalIncome > 0 ? managementFee / totalRentalIncome : 0;

      const leaseCounts = leaseCountByMonth.get(reportMonth) || { newLeases: 0, renewals: 0, moveOuts: 0 };

      await pool.query(
        `INSERT INTO deal_monthly_actuals (
          property_id, report_month, total_units, occupied_units, occupancy_rate,
          avg_market_rent, avg_effective_rent,
          gross_potential_rent, loss_to_lease, vacancy_loss, concessions, bad_debt,
          net_rental_income, other_income, utility_reimbursement,
          effective_gross_income,
          payroll, repairs_maintenance, turnover_costs, marketing, admin_general,
          management_fee, management_fee_pct, utilities, contract_services,
          property_tax, insurance, total_opex, opex_per_unit, opex_ratio,
          noi, noi_per_unit, debt_service, capex, cash_flow_before_tax,
          new_leases, renewals,
          data_source
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
        )
        ON CONFLICT (property_id, report_month, is_budget, is_proforma)
        DO UPDATE SET
          total_units = EXCLUDED.total_units,
          occupied_units = EXCLUDED.occupied_units,
          occupancy_rate = EXCLUDED.occupancy_rate,
          gross_potential_rent = EXCLUDED.gross_potential_rent,
          vacancy_loss = EXCLUDED.vacancy_loss,
          concessions = EXCLUDED.concessions,
          bad_debt = EXCLUDED.bad_debt,
          net_rental_income = EXCLUDED.net_rental_income,
          other_income = EXCLUDED.other_income,
          total_opex = EXCLUDED.total_opex,
          noi = EXCLUDED.noi,
          updated_at = NOW()`,
        [
          propertyId, reportMonth, TOTAL_UNITS, occupiedUnits, actualOcc,
          avgMarketRent.toFixed(2), avgEffectiveRent.toFixed(2),
          gpr, effectiveRents - gpr, vacancyLoss, concessions, badDebt,
          totalRentalIncome, otherIncome, utilityIncome,
          totalIncome,
          payroll, repairsMaintenance, turnoverCosts, marketing, adminGeneral,
          managementFee, mgmtFeePct.toFixed(3), utilities, contractServices,
          propertyTax, insurance, totalOpex, opexPerUnit.toFixed(2), opexRatio.toFixed(3),
          noi, noiPerUnit.toFixed(2), debtServiceOther, capex, cashFlow,
          leaseCounts.newLeases, leaseCounts.renewals,
          'yardi',
        ]
      );
      financialImported++;
    }
    console.log(`  Imported ${financialImported} months of financial data`);

    // ═══════════════════════════════════════════════════════════
    // T003: Re-link Traffic Data
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== T003: Re-linking Traffic Data ===');

    const trafficResult = await pool.query(
      `INSERT INTO weekly_traffic_snapshots (
        deal_id, property_name, week_ending, total_units,
        traffic, in_person_tours, website_leads, apps,
        cancellations, denials, net_leases, closing_ratio,
        beg_occ, move_ins, move_outs, transfers, end_occ,
        vacant_model, vacant_rented, vacant_unrented, vacant_total,
        notice_rented, notice_unrented, notice_total,
        avail_1br, avail_2br, avail_3br,
        occ_pct, leased_pct, avail_pct,
        avg_market_rent, gross_market_rent, gross_rent_psf,
        effective_rent, effective_rent_psf
      )
      SELECT
        $1, property_name, week_ending, total_units,
        traffic, in_person_tours, website_leads, apps,
        cancellations, denials, net_leases, closing_ratio,
        beg_occ, move_ins, move_outs, transfers, end_occ,
        vacant_model, vacant_rented, vacant_unrented, vacant_total,
        notice_rented, notice_unrented, notice_total,
        avail_1br, avail_2br, avail_3br,
        occ_pct, leased_pct, avail_pct,
        avg_market_rent, gross_market_rent, gross_rent_psf,
        effective_rent, effective_rent_psf
      FROM weekly_traffic_snapshots
      WHERE deal_id = 'highlands-2789-satellite'
      ON CONFLICT (deal_id, week_ending) DO NOTHING`,
      [dealId]
    );
    console.log(`  Linked ${trafficResult.rowCount} weeks of traffic data to deal ${dealId}`);

    // ═══════════════════════════════════════════════════════════
    // T005: Import Lease Transactions
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== T005: Importing Lease Transactions ===');

    let leaseImported = 0;
    let leaseSkipped = 0;

    for (let i = 1; i < leaseData.length; i++) {
      const r = leaseData[i];
      if (!r || !r[0] || !r[4]) { leaseSkipped++; continue; }

      const dt = new Date((r[4] - 25569) * 86400 * 1000);
      if (dt.getFullYear() > 2030) { leaseSkipped++; continue; }

      const leaseStart = dt.toISOString().split('T')[0];
      const unitNumber = String(r[0]);
      const unitType = String(r[1] || '');
      const sqft = Number(r[2]) || 0;
      const leaseType = String(r[3] || '').trim().toLowerCase() === 'renewal' ? 'Renewal' : 'New';
      const marketRent = Number(r[5]) || 0;
      const priorRent = Number(r[6]) || 0;
      const newRent = Number(r[7]) || 0;

      const rentChangeDollar = leaseType === 'Renewal' && priorRent > 0 ? newRent - priorRent : 0;
      const rentChangePct = leaseType === 'Renewal' && priorRent > 0 ? (newRent - priorRent) / priorRent : 0;
      const lossToLease = marketRent > 0 ? newRent - marketRent : 0;
      const lossToLeasePct = marketRent > 0 ? (newRent - marketRent) / marketRent : 0;
      const rentPsf = sqft > 0 ? newRent / sqft : 0;

      await pool.query(
        `INSERT INTO deal_lease_transactions (
          deal_id, unit_number, unit_type, sqft, lease_type, lease_start,
          market_rent, prior_rent, new_rent,
          rent_change_dollar, rent_change_pct,
          loss_to_lease, loss_to_lease_pct, rent_psf
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          dealId, unitNumber, unitType, sqft, leaseType, leaseStart,
          marketRent.toFixed(2), priorRent.toFixed(2), newRent.toFixed(2),
          rentChangeDollar.toFixed(2), rentChangePct.toFixed(4),
          lossToLease.toFixed(2), lossToLeasePct.toFixed(4), rentPsf.toFixed(2),
        ]
      );
      leaseImported++;
    }
    console.log(`  Imported ${leaseImported} lease transactions, skipped ${leaseSkipped}`);

    // ═══════════════════════════════════════════════════════════
    // T006: Import Unit Mix
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== T006: Importing Unit Mix ===');

    const unitTypes: Map<string, { sqft: number; count: number; rents: number[] }> = new Map();
    for (let i = 1; i < leaseData.length; i++) {
      const r = leaseData[i];
      if (!r || !r[0] || !r[4]) continue;
      const dt = new Date((r[4] - 25569) * 86400 * 1000);
      if (dt.getFullYear() > 2030) continue;
      const ut = String(r[1] || '');
      const sqft = Number(r[2]) || 0;
      const rent = Number(r[7]) || 0;
      if (!unitTypes.has(ut)) unitTypes.set(ut, { sqft, count: 0, rents: [] });
      unitTypes.get(ut)!.count++;
      if (rent > 0) unitTypes.get(ut)!.rents.push(rent);
    }

    const unitConfig: Record<string, any> = {};
    for (const [type, data] of unitTypes) {
      const avgRent = data.rents.length > 0
        ? data.rents.reduce((a, b) => a + b, 0) / data.rents.length
        : 0;
      const bedrooms = type.startsWith('C2') ? 3 : type.startsWith('B2') ? 2 : 1;
      unitConfig[type] = {
        sqft: data.sqft,
        bedrooms,
        total_leases: data.count,
        avg_rent: Math.round(avgRent),
        min_rent: data.rents.length > 0 ? Math.round(Math.min(...data.rents)) : 0,
        max_rent: data.rents.length > 0 ? Math.round(Math.max(...data.rents)) : 0,
      };
    }

    await pool.query(
      `INSERT INTO deal_unit_programs (deal_id, total_units, unit_config)
       VALUES ($1, $2, $3)
       ON CONFLICT (deal_id) DO UPDATE SET
         total_units = EXCLUDED.total_units,
         unit_config = EXCLUDED.unit_config`,
      [dealId, TOTAL_UNITS, JSON.stringify(unitConfig)]
    );
    console.log(`  Imported ${unitTypes.size} unit types into deal_unit_programs`);

    // ═══════════════════════════════════════════════════════════
    // Verification
    // ═══════════════════════════════════════════════════════════
    console.log('\n=== Verification ===');

    const verifyDeal = await pool.query('SELECT id, name, deal_category, state FROM deals WHERE id = $1', [dealId]);
    console.log(`  Deal: ${JSON.stringify(verifyDeal.rows[0])}`);

    const verifyProp = await pool.query('SELECT id, name, units, ownership_status FROM properties WHERE id = $1', [propertyId]);
    console.log(`  Property: ${JSON.stringify(verifyProp.rows[0])}`);

    const verifyFinancials = await pool.query(
      'SELECT COUNT(*) as months, SUM(noi) as total_noi, SUM(effective_gross_income) as total_income FROM deal_monthly_actuals WHERE property_id = $1',
      [propertyId]
    );
    console.log(`  Financials: ${JSON.stringify(verifyFinancials.rows[0])}`);

    const verifyTraffic = await pool.query(
      'SELECT COUNT(*) as weeks FROM weekly_traffic_snapshots WHERE deal_id = $1',
      [dealId]
    );
    console.log(`  Traffic: ${verifyTraffic.rows[0].weeks} weeks`);

    const verifyLeases = await pool.query(
      `SELECT lease_type, COUNT(*) as count FROM deal_lease_transactions WHERE deal_id = $1 GROUP BY lease_type`,
      [dealId]
    );
    console.log(`  Leases: ${JSON.stringify(verifyLeases.rows)}`);

    const verifyUnitMix = await pool.query(
      'SELECT total_units, jsonb_object_keys(unit_config) as types FROM deal_unit_programs WHERE deal_id = $1 LIMIT 1',
      [dealId]
    );
    console.log(`  Unit Mix: ${verifyUnitMix.rowCount} program(s)`);

    console.log('\n=== Import Complete ===');
    console.log(`Deal ID: ${dealId}`);
    console.log(`Property ID: ${propertyId}`);

  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

importHighlandsDeal().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
