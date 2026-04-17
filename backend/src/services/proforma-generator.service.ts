import { query } from '../database/connection';
import { logger } from '../utils/logger';
import Decimal from 'decimal.js';

interface ProformaLayer {
  rentGrowth: string;
  vacancyRate: string;
  concessionPct: string;
  badDebtPct: string;
  otherIncomePerUnit: string;
  opexRatio: string;
  opexGrowth: string;
  managementFeePct: string;
  capexPerUnit: string;
  ltv: string;
  interestRate: string;
  exitCapRate: string;
  confidence: number;
  source: string;
}

interface AnnualProjection {
  year: number;
  gpr: string;
  vacancy: string;
  egi: string;
  opex: string;
  noi: string;
  debtService: string;
  cashFlow: string;
  cumulativeCF: string;
}

interface GenerateResult {
  snapshotId: string;
  strategy: string;
  layers: { baseline: ProformaLayer; adjusted: ProformaLayer; user: ProformaLayer };
  activeLayer: string;
  returns: {
    year1Noi: string;
    goingInCap: string;
    cocReturn: string;
    irr: string;
    equityMultiple: string;
    dscr: string;
    debtYield: string;
  };
  annualProjections: AnnualProjection[];
  optimalExitYear: number;
  exitValue: string;
}

function calculateMonthlyPayment(principal: number, annualRate: number, amortYears: number): number {
  if (annualRate === 0) return principal / (amortYears * 12);
  const monthlyRate = annualRate / 12;
  const n = amortYears * 12;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 0.0001;
  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let j = 0; j < cashFlows.length; j++) {
      const factor = Math.pow(1 + rate, j);
      npv += cashFlows[j] / factor;
      if (j > 0) dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
    }
    if (Math.abs(npv) < tolerance) return rate;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
  }
  return rate;
}

class ProformaGeneratorService {
  async generate(
    propertyId: string,
    strategy: string,
    templateId?: string,
    userOverrides?: Partial<ProformaLayer>
  ): Promise<GenerateResult> {
    const propResult = await query(
      `SELECT id, property_type, product_type, year_built, units AS total_units,
              lat, lng, city, state_code, submarket_id, msa_id, acquisition_price
       FROM properties WHERE id = $1`,
      [propertyId]
    );
    if (propResult.rows.length === 0) throw new Error(`Property ${propertyId} not found`);
    const prop = propResult.rows[0];
    const totalUnits = parseInt(prop.total_units) || 100;

    const layer1 = await this.buildBaselineLayer(propertyId, prop);
    const layer2 = await this.buildAdjustedLayer(layer1, propertyId, prop);
    let layer3 = { ...layer2 };

    let holdYears = 5;
    let rentGrowthYr2_5 = new Decimal(layer2.rentGrowth);
    let rentGrowthYr6_10 = new Decimal(layer2.rentGrowth).times(0.8);
    let amortizationYears = 30;
    let sellingCostsPct = new Decimal(0.02);
    let exitCapSpread = new Decimal(0.001);

    if (templateId) {
      const tplResult = await query('SELECT * FROM proforma_templates WHERE id = $1', [templateId]);
      if (tplResult.rows.length > 0) {
        const tpl = tplResult.rows[0];
        holdYears = parseInt(tpl.hold_years) || 5;
        rentGrowthYr2_5 = new Decimal(tpl.rent_growth_yr2_5 || layer2.rentGrowth);
        rentGrowthYr6_10 = new Decimal(tpl.rent_growth_yr6_10 || layer2.rentGrowth);
        amortizationYears = parseInt(tpl.amortization_years) || 30;
        sellingCostsPct = new Decimal(tpl.selling_costs_pct || 0.02);
        exitCapSpread = new Decimal(tpl.exit_cap_spread || 0.001);
        layer3 = {
          rentGrowth: (tpl.rent_growth_yr1 || layer2.rentGrowth).toString(),
          vacancyRate: (tpl.vacancy_rate || layer2.vacancyRate).toString(),
          concessionPct: (tpl.concession_pct || layer2.concessionPct).toString(),
          badDebtPct: (tpl.bad_debt_pct || layer2.badDebtPct).toString(),
          otherIncomePerUnit: (tpl.other_income_per_unit || layer2.otherIncomePerUnit).toString(),
          opexRatio: (tpl.opex_ratio || layer2.opexRatio).toString(),
          opexGrowth: (tpl.opex_growth || layer2.opexGrowth).toString(),
          managementFeePct: (tpl.management_fee_pct || layer2.managementFeePct).toString(),
          capexPerUnit: (tpl.capex_per_unit || layer2.capexPerUnit).toString(),
          ltv: (tpl.ltv || layer2.ltv).toString(),
          interestRate: (tpl.interest_rate || layer2.interestRate).toString(),
          exitCapRate: (tpl.exit_cap_rate || layer2.exitCapRate).toString(),
          confidence: 0.9,
          source: `template:${tpl.name}`,
        };
      }
    }

    if (userOverrides) {
      layer3 = { ...layer3, ...userOverrides, confidence: 1.0, source: 'user_override' };
    }

    const active = layer3;
    const acquisitionPrice = new Decimal(prop.acquisition_price || totalUnits * 150000);
    const activeLayerLtv = new Decimal(active.ltv);
    const loanAmount = acquisitionPrice.times(activeLayerLtv).toNumber();
    const equityInvested = acquisitionPrice.minus(loanAmount).toNumber();
    const annualDebtService = calculateMonthlyPayment(loanAmount, parseFloat(active.interestRate), amortizationYears) * 12;

    const actualsResult = await query(
      `SELECT avg_effective_rent, occupancy_rate, noi, effective_gross_income, total_opex
       FROM deal_monthly_actuals WHERE property_id = $1 AND is_budget = FALSE
       ORDER BY report_month DESC LIMIT 12`,
      [propertyId]
    );

    let baseRent = new Decimal(1200);
    let baseOccupancy = 0.93;
    let baseOtherIncome = new Decimal(active.otherIncomePerUnit).times(totalUnits).times(12);

    if (actualsResult.rows.length > 0) {
      const latest = actualsResult.rows[0];
      baseRent = new Decimal(latest.avg_effective_rent || 1200);
      baseOccupancy = parseFloat(latest.occupancy_rate) || baseOccupancy;
    }

    const projections: AnnualProjection[] = [];
    let cumulativeCF = new Decimal(0);
    const cashFlows: number[] = [-equityInvested];

    for (let year = 1; year <= holdYears; year++) {
      const yearRentGrowth = year === 1 ? new Decimal(active.rentGrowth) : (year <= 5 ? rentGrowthYr2_5 : rentGrowthYr6_10);
      const rentGrowthFactor = year === 1
        ? new Decimal(1).plus(new Decimal(active.rentGrowth))
        : new Decimal(1).plus(new Decimal(active.rentGrowth)).times(new Decimal(1).plus(year <= 5 ? rentGrowthYr2_5 : rentGrowthYr6_10).pow(year - 1));

      const projectedRent = baseRent.times(rentGrowthFactor);
      const gpr = projectedRent.times(totalUnits).times(12);
      const vacancy = gpr.times(active.vacancyRate);
      const concessions = gpr.times(active.concessionPct);
      const badDebt = gpr.times(active.badDebtPct);
      const netRental = gpr.minus(vacancy).minus(concessions).minus(badDebt);
      const otherIncome = baseOtherIncome.times(new Decimal(1).plus(new Decimal(active.rentGrowth).times(0.5)).pow(year));
      const egi = netRental.plus(otherIncome);
      const opexGrowthFactor = new Decimal(1).plus(new Decimal(active.opexGrowth)).pow(year);
      const opex = egi.times(active.opexRatio).times(opexGrowthFactor);
      const noi = egi.minus(opex);
      const cashFlow = noi.minus(annualDebtService).minus(new Decimal(active.capexPerUnit).times(totalUnits));
      cumulativeCF = cumulativeCF.plus(cashFlow);

      projections.push({
        year,
        gpr: gpr.toFixed(2),
        vacancy: vacancy.toFixed(2),
        egi: egi.toFixed(2),
        opex: opex.toFixed(2),
        noi: noi.toFixed(2),
        debtService: new Decimal(annualDebtService).toFixed(2),
        cashFlow: cashFlow.toFixed(2),
        cumulativeCF: cumulativeCF.toFixed(2),
      });

      cashFlows.push(cashFlow.toNumber());
    }

    const year1Noi = new Decimal(projections[0].noi);
    const finalYearNoi = new Decimal(projections[holdYears - 1].noi);
    const exitCapRateActual = new Decimal(active.exitCapRate).plus(exitCapSpread.times(holdYears));
    const exitValue = finalYearNoi.dividedBy(exitCapRateActual);
    const sellingCosts = exitValue.times(sellingCostsPct);
    const netExitProceeds = exitValue.minus(sellingCosts).minus(loanAmount);

    cashFlows[cashFlows.length - 1] += netExitProceeds.toNumber();

    const goingInCap = year1Noi.dividedBy(acquisitionPrice);
    const cocReturn = new Decimal(projections[0].cashFlow).dividedBy(equityInvested);
    const irr = calculateIRR(cashFlows);
    const equityMultiple = cumulativeCF.plus(netExitProceeds).dividedBy(equityInvested);
    const dscr = year1Noi.dividedBy(annualDebtService);
    const debtYield = year1Noi.dividedBy(loanAmount);

    let optimalExitYear = holdYears;
    let bestIRR = irr;
    for (let testYear = 2; testYear <= holdYears; testYear++) {
      const testExitNoi = new Decimal(projections[testYear - 1].noi);
      const testExitVal = testExitNoi.dividedBy(new Decimal(active.exitCapRate).plus(exitCapSpread.times(testYear)));
      const testNetProceeds = testExitVal.times(new Decimal(1).minus(sellingCostsPct)).minus(loanAmount);
      const testFlows = [-equityInvested, ...projections.slice(0, testYear).map(p => new Decimal(p.cashFlow).toNumber())];
      testFlows[testFlows.length - 1] += testNetProceeds.toNumber();
      const testIRR = calculateIRR(testFlows);
      if (testIRR > bestIRR) {
        bestIRR = testIRR;
        optimalExitYear = testYear;
      }
    }

    const snapshotResult = await query(
      `INSERT INTO proforma_snapshots (
        property_id, template_id, strategy, layer1_baseline, layer2_adjusted, layer3_user,
        active_layer, year1_noi, going_in_cap, coc_return, irr, equity_multiple, dscr, debt_yield,
        annual_projections, optimal_exit_year, exit_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        propertyId, templateId || null, strategy,
        JSON.stringify(layer1), JSON.stringify(layer2), JSON.stringify(layer3),
        templateId ? 'layer3' : 'layer2',
        year1Noi.toFixed(2),
        goingInCap.toFixed(4),
        cocReturn.toFixed(4),
        new Decimal(irr).toFixed(4),
        equityMultiple.toFixed(2),
        dscr.toFixed(4),
        debtYield.toFixed(4),
        JSON.stringify(projections),
        optimalExitYear,
        exitValue.toFixed(2),
      ]
    );

    return {
      snapshotId: snapshotResult.rows[0].id,
      strategy,
      layers: { baseline: layer1, adjusted: layer2, user: layer3 },
      activeLayer: templateId ? 'layer3' : 'layer2',
      returns: {
        year1Noi: year1Noi.toFixed(2),
        goingInCap: goingInCap.toFixed(4),
        cocReturn: cocReturn.toFixed(4),
        irr: new Decimal(irr).toFixed(4),
        equityMultiple: equityMultiple.toFixed(2),
        dscr: dscr.toFixed(4),
        debtYield: debtYield.toFixed(4),
      },
      annualProjections: projections,
      optimalExitYear,
      exitValue: exitValue.toFixed(2),
    };
  }

  private async buildBaselineLayer(propertyId: string, prop: any): Promise<ProformaLayer> {
    const actualsResult = await query(
      `SELECT
        AVG(occupancy_rate) AS avg_occ,
        AVG(opex_ratio) AS avg_opex_ratio,
        AVG(management_fee_pct) AS avg_mgmt_fee,
        AVG(noi_per_unit) AS avg_noi_per_unit,
        AVG(avg_effective_rent) AS avg_rent,
        COUNT(*) AS months
       FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_budget = FALSE AND is_proforma = FALSE
       AND report_month >= CURRENT_DATE - INTERVAL '12 months'`,
      [propertyId]
    );

    const actuals = actualsResult.rows[0];
    const hasData = parseInt(actuals.months || '0') >= 3;

    const submarketResult = await query(
      `SELECT avg_rent, avg_occupancy FROM submarkets WHERE id::text = $1 OR name = $1`,
      [prop.submarket_id || '']
    );
    const submarket = submarketResult.rows[0] || {};

    return {
      rentGrowth: '0.0300',
      vacancyRate: hasData
        ? new Decimal(1).minus(new Decimal(actuals.avg_occ || 0.93)).toFixed(4)
        : new Decimal(submarket.avg_occupancy ? 1 - parseFloat(submarket.avg_occupancy) : 0.05).toFixed(4),
      concessionPct: '0.0100',
      badDebtPct: '0.0150',
      otherIncomePerUnit: '150.00',
      opexRatio: hasData ? new Decimal(actuals.avg_opex_ratio || 0.45).toFixed(4) : '0.4500',
      opexGrowth: '0.0250',
      managementFeePct: hasData ? new Decimal(actuals.avg_mgmt_fee || 0.05).toFixed(4) : '0.0500',
      capexPerUnit: '300.00',
      ltv: '0.7000',
      interestRate: '0.0650',
      exitCapRate: '0.0550',
      confidence: hasData ? 0.85 : 0.5,
      source: hasData ? 'trailing_12_actuals' : 'market_defaults',
    };
  }

  private async buildAdjustedLayer(baseline: ProformaLayer, propertyId: string, prop: any): Promise<ProformaLayer> {
    const adjusted = { ...baseline, confidence: baseline.confidence + 0.05, source: 'platform_adjusted' };

    try {
      const supplyResult = await query(
        `SELECT units_planned, units_under_construction
         FROM apartment_supply_pipeline
         WHERE submarket_id::text = $1 LIMIT 5`,
        [prop.submarket_id || '']
      );
      if (supplyResult.rows.length > 0) {
        const totalPipeline = supplyResult.rows.reduce((sum: number, r: any) =>
          sum + (parseInt(r.units_planned) || 0) + (parseInt(r.units_under_construction) || 0), 0);
        if (totalPipeline > 1000) {
          adjusted.vacancyRate = Decimal.min(new Decimal(adjusted.vacancyRate).plus(0.01), new Decimal(0.12)).toFixed(4);
          adjusted.rentGrowth = Decimal.max(new Decimal(adjusted.rentGrowth).minus(0.005), new Decimal(0.005)).toFixed(4);
        }
      }
    } catch {
    }

    return adjusted;
  }

  async getSnapshots(propertyId: string): Promise<any[]> {
    const result = await query(
      `SELECT ps.*, pt.name AS template_name
       FROM proforma_snapshots ps
       LEFT JOIN proforma_templates pt ON pt.id = ps.template_id
       WHERE ps.property_id = $1
       ORDER BY ps.generated_at DESC`,
      [propertyId]
    );
    return result.rows;
  }

  async getSnapshot(snapshotId: string): Promise<any | null> {
    const result = await query('SELECT * FROM proforma_snapshots WHERE id = $1', [snapshotId]);
    return result.rows[0] || null;
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const result = await query('DELETE FROM proforma_snapshots WHERE id = $1', [snapshotId]);
    return (result.rowCount || 0) > 0;
  }
}

export const proformaGeneratorService = new ProformaGeneratorService();
