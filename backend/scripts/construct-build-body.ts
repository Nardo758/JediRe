/**
 * Construct build body from DB state — for capture when the build endpoint
 * requires client-supplied assumptions (F-P1 finding).
 *
 * Fetches the full deal state from DB, extracts resolved values from LayeredValues,
 * constructs the frontend-format body (same shape the frontend would send), and
 * normalizes it to ProFormaAssumptions for the fixture.
 *
 * Usage: cd backend && npx ts-node --transpile-only scripts/construct-build-body.ts <dealId>
 * Output: /tmp/build_body_<dealId_short>.json (frontend format)
 *         /tmp/proforma_assumptions_<dealId_short>.json (ProFormaAssumptions)
 */

import { Pool } from 'pg';
import { normalizeToEngineFormat } from '../src/api/rest/financial-model.routes';

async function main() {
  const dealId = process.argv[2];
  if (!dealId) {
    console.error('Usage: npx ts-node scripts/construct-build-body.ts <dealId>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Fetch full deal state
    const [dealRes, assumptionsRes, proformaRes] = await Promise.all([
      pool.query(
        'SELECT id, name, city, state_code, target_units, budget, deal_data, deal_type FROM deals WHERE id = $1',
        [dealId]
      ),
      pool.query(
        `SELECT year1, total_units, exit_cap, rent_growth_stabilized,
                hold_period_years, interest_rate, ltc, avg_lease_term_months,
                per_year_overrides, io_period_months, amortization_years,
                dscr_min, origination_fee_pct, unit_mix, unit_mix_overrides,
                avg_rent_per_unit, vacancy_pct, selling_costs_pct
         FROM deal_assumptions WHERE deal_id = $1`,
        [dealId]
      ),
      pool.query(
        `SELECT vacancy_current, rent_growth_current, exit_cap_current, opex_growth_current
         FROM proforma_assumptions WHERE deal_id = $1 ORDER BY last_recalculation DESC LIMIT 1`,
        [dealId]
      ),
    ]);

    if (dealRes.rows.length === 0) {
      console.error(`Deal not found: ${dealId}`);
      process.exit(1);
    }

    const deal = dealRes.rows[0];
    const assumptions = assumptionsRes.rows[0] || {};
    const proforma = proformaRes.rows[0] || {};
    const year1: Record<string, any> = (assumptions.year1 as Record<string, any>) || {};

    // Helper: extract resolved value from LayeredValue or plain value
    const lv = (key: string): number | null => {
      const v = year1[key];
      if (!v) return null;
      if (typeof v === 'number') return v;
      if (typeof v === 'object' && v !== null) {
        // LayeredValue shape: { resolved, broker, platform, override, ... }
        if (v.resolved != null && typeof v.resolved === 'number') return v.resolved;
        if (v.platform != null && typeof v.platform === 'number') return v.platform;
        if (v.broker != null && typeof v.broker === 'number') return v.broker;
      }
      return null;
    };

    // Helper: extract value from the flat per_year_overrides shape
    // ({ year, field, value, resolution }) used by debt: namespaced keys.
    // NOTE: per_year_overrides is a SEPARATE deal_assumptions column from
    // year1 — debt:senior:* keys live here, not in year1. These are NOT
    // LayeredValues — lv() above does not handle this shape.
    // 'cleared' resolution means the value was explicitly unset — skip it.
    const perYearOverrides: Record<string, any> = (assumptions.per_year_overrides as Record<string, any>) || {};
    const debtVal = (key: string): number | null => {
      const v = perYearOverrides[key];
      if (!v || typeof v !== 'object') return null;
      if (v.resolution === 'cleared') return null;
      if (typeof v.value === 'number') return v.value;
      return null;
    };

    // Real persisted senior loan amount (debt_advisor-sourced), if present.
    // Some deals (e.g. Highlands) have no explicit debt:senior:* record —
    // only an LTC ratio. Fall back to purchasePrice * ltc as an approximation
    // of what the frontend's own debt sizing would produce, rather than
    // silently defaulting to 0 (the INV-6 root cause for these deals).
    // NOTE: Postgres NUMERIC columns come back from `pg` as strings, not
    // numbers (project-wide gotcha) — parseFloat, don't rely on typeof.
    const purchasePriceForDebt = deal.budget || 0;
    const ltcRaw = assumptions.ltc != null ? parseFloat(assumptions.ltc) : NaN;
    const ltcRatio = Number.isFinite(ltcRaw) ? ltcRaw : null;
    const seniorLoanAmount =
      debtVal('debt:senior:loanAmount') ??
      (ltcRatio != null && purchasePriceForDebt > 0 ? Math.round(purchasePriceForDebt * ltcRatio) : null);

    // Extract unit mix
    const unitMixRaw = assumptions.unit_mix || deal.deal_data?.unit_mix || [];
    const unitMix = Array.isArray(unitMixRaw) ? unitMixRaw.map((u: any) => ({
      floorPlan: u.floorPlan || u.floor_plan || 'Unit',
      unitSize: u.unitSize || u.unit_size || 800,
      beds: u.beds || u.bedrooms || 1,
      units: u.units || 0,
      occupied: u.occupied || 0,
      vacant: u.vacant || 0,
      marketRent: u.marketRent || u.market_rent || 0,
      inPlaceRent: u.inPlaceRent || u.in_place_rent || u.marketRent || 0,
    })) : [];

    // Extract expenses from year1 (display-case keys, LayeredValue blobs)
    const expenses: Record<string, { amount: number; type: string; growthRate: number }> = {};
    const opexKeys = [
      'real_estate_tax', 'personal_property_tax', 'insurance', 'utilities',
      'repairs_maintenance', 'turnover', 'contract_services', 'payroll',
      'marketing', 'g_and_a', 'hoa_dues', 'management_fee', 'replacement_reserves',
    ];
    for (const key of opexKeys) {
      const val = lv(key);
      if (val != null && val > 0) {
        expenses[key] = {
          amount: val,
          type: 'sf',
          growthRate: proforma.opex_growth_current || 0.03,
        };
      }
    }

    // Add any other year1 keys that look like expenses (amount + type + growthRate)
    for (const [key, val] of Object.entries(year1)) {
      if (opexKeys.includes(key)) continue; // already handled
      if (typeof val === 'object' && val !== null && val.resolved != null && typeof val.resolved === 'number') {
        // Heuristic: if resolved > 0 and not a revenue/capital field, treat as expense
        const revenueKeys = ['rent_growth', 'loss_to_lease', 'vacancy', 'collection_loss', 'concessions'];
        const capitalKeys = ['capex', 'renovation', 'construction'];
        if (!revenueKeys.includes(key) && !capitalKeys.includes(key) && val.resolved > 0) {
          expenses[key] = {
            amount: val.resolved,
            type: 'sf',
            growthRate: proforma.opex_growth_current || 0.03,
          };
        }
      }
    }

    // Construct frontend-format body
    const body = {
      dealId,
      forceRebuild: true,
      assumptions: {
        dealInfo: {
          dealName: deal.name || 'Deal',
          totalUnits: assumptions.total_units || deal.target_units || 0,
          netRentableSF: (assumptions.total_units || deal.target_units || 0) * 800,
          vintage: deal.deal_data?.vintage || 1980,
          address: deal.deal_data?.address || '',
          city: deal.city || '',
          state: deal.state_code || '',
        },
        modelType: deal.deal_type || 'existing',
        holdPeriod: assumptions.hold_period_years || 5,
        unitMix,
        acquisition: {
          purchasePrice: deal.budget || 0,
          capRate: lv('going_in_cap_rate') || 0.06,
          closingCosts: deal.deal_data?.closingCosts || { legal: 50000, appraisal: 15000, inspection: 10000, title: 15000 },
        },
        disposition: {
          exitCapRate: assumptions.exit_cap || proforma.exit_cap_current || 0.065,
          sellingCosts: assumptions.selling_costs_pct || 0.02,
          saleNOIMethod: 'terminal',
        },
        revenue: {
          rentGrowth: [
            assumptions.rent_growth_stabilized || proforma.rent_growth_current || 0.03,
            assumptions.rent_growth_stabilized || proforma.rent_growth_current || 0.03,
          ],
          lossToLease: lv('loss_to_lease') || 0.03,
          stabilizedOccupancy: 1 - (assumptions.vacancy_pct || proforma.vacancy_current || 0.07),
          collectionLoss: lv('collection_loss') || lv('bad_debt') || 0.015,
          otherIncome: {},
        },
        expenses,
        debt: {
          // Prefer the real persisted senior loan (debt_advisor-sourced) over
          // deal_data.loan_amount, which does not exist on this deal shape and
          // was silently defaulting to 0 — the root cause of the INV-6
          // (totalEquity != totalAcqCost - loanAmount) integrity failure.
          loanAmount: seniorLoanAmount ?? deal.deal_data?.loan_amount ?? 0,
          interestRate: assumptions.interest_rate || 0.065,
          term: (assumptions.amortization_years || 30) * 12,
          amortization: (assumptions.amortization_years || 30) * 12,
          ioPeriod: assumptions.io_period_months || 0,
          originationFee: assumptions.origination_fee_pct || 0.01,
        },
        capexLineItems: deal.deal_data?.capex_line_items || [],
        lpEquity: deal.deal_data?.lp_equity || 0,
        gpEquity: deal.deal_data?.gp_equity || 0,
        purchasePrice: deal.budget || 0,
        loanAmount: seniorLoanAmount ?? deal.deal_data?.loan_amount ?? 0,
        holdYears: assumptions.hold_period_years || 5,
      },
    };

    // Normalize to ProFormaAssumptions (what the bridge consumes)
    const proformaAssumptions = normalizeToEngineFormat(body.assumptions);

    const shortId = dealId.split('-')[0];
    const bodyFile = `/tmp/build_body_${shortId}.json`;
    const proformaFile = `/tmp/proforma_assumptions_${shortId}.json`;

    const fs = await import('fs');
    fs.writeFileSync(bodyFile, JSON.stringify(body, null, 2));
    fs.writeFileSync(proformaFile, JSON.stringify(proformaAssumptions, null, 2));

    console.log(`Frontend-format body: ${bodyFile}`);
    console.log(`ProFormaAssumptions:  ${proformaFile}`);
    console.log(`\nExpense keys in body: ${Object.keys(expenses).join(', ')}`);
    console.log(`Total expenses: ${Object.values(expenses).reduce((s, e) => s + e.amount, 0)}`);
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
