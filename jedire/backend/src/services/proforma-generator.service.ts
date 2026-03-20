import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface ProformaLayer {
  rentGrowth: number;
  vacancyRate: number;
  concessionPct: number;
  badDebtPct: number;
  otherIncomePerUnit: number;
  opexRatio: number;
  opexGrowth: number;
  managementFeePct: number;
  capexPerUnit: number;
  ltv: number;
  interestRate: number;
  exitCapRate: number;
  confidence: number;
  source: string;
}

interface AnnualProjection {
  year: number;
  gpr: number;
  vacancy: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  cumulativeCF: number;
}

interface GenerateResult {
  snapshotId: string;
  strategy: string;
  layers: { baseline: ProformaLayer; adjusted: ProformaLayer; user: ProformaLayer };
  activeLayer: string;
  returns: {
    year1Noi: number;
    goingInCap: number;
    cocReturn: number;
    irr: number;
    equityMultiple: number;
    dscr: number;
    debtYield: number;
  };
  annualProjections: AnnualProjection[];
  optimalExitYear: number;
  exitValue: number;
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
    let rentGrowthYr2_5 = layer2.rentGrowth;
    let rentGrowthYr6_10 = layer2.rentGrowth * 0.8;
    let amortizationYears = 30;
    let sellingCostsPct = 0.02;
    let exitCapSpread = 0.001;

    if (templateId) {
      const tplResult = await query('SELECT * FROM proforma_templates WHERE id = $1', [templateId]);
      if (tplResult.rows.length > 0) {
        const tpl = tplResult.rows[0];
        holdYears = parseInt(tpl.hold_years) || 5;
        rentGrowthYr2_5 = parseFloat(tpl.rent_growth_yr2_5) || rentGrowthYr2_5;
        rentGrowthYr6_10 = parseFloat(tpl.rent_growth_yr6_10) || rentGrowthYr6_10;
        amortizationYears = parseInt(tpl.amortization_years) || 30;
        sellingCostsPct = parseFloat(tpl.selling_costs_pct) || 0.02;
        exitCapSpread = parseFloat(tpl.exit_cap_spread) || 0.001;
        layer3 = {
          rentGrowth: parseFloat(tpl.rent_growth_yr1) || layer2.rentGrowth,
          vacancyRate: parseFloat(tpl.vacancy_rate) || layer2.vacancyRate,
          concessionPct: parseFloat(tpl.concession_pct) || layer2.concessionPct,
          badDebtPct: parseFloat(tpl.bad_debt_pct) || layer2.badDebtPct,
          otherIncomePerUnit: parseFloat(tpl.other_income_per_unit) || layer2.otherIncomePerUnit,
          opexRatio: parseFloat(tpl.opex_ratio) || layer2.opexRatio,
          opexGrowth: parseFloat(tpl.opex_growth) || layer2.opexGrowth,
          managementFeePct: parseFloat(tpl.management_fee_pct) || layer2.managementFeePct,
          capexPerUnit: parseFloat(tpl.capex_per_unit) || layer2.capexPerUnit,
          ltv: parseFloat(tpl.ltv) || layer2.ltv,
          interestRate: parseFloat(tpl.interest_rate) || layer2.interestRate,
          exitCapRate: parseFloat(tpl.exit_cap_rate) || layer2.exitCapRate,
          confidence: 0.9,
          source: `template:${tpl.name}`,
        };
      }
    }

    if (userOverrides) {
      layer3 = { ...layer3, ...userOverrides, confidence: 1.0, source: 'user_override' };
    }

    const active = layer3;
    const acquisitionPrice = parseFloat(prop.acquisition_price) || totalUnits * 150000;
    const loanAmount = acquisitionPrice * active.ltv;
    const equityInvested = acquisitionPrice - loanAmount;
    const annualDebtService = calculateMonthlyPayment(loanAmount, active.interestRate, amortizationYears) * 12;

    const actualsResult = await query(
      `SELECT avg_effective_rent, occupancy_rate, noi, effective_gross_income, total_opex
       FROM deal_monthly_actuals WHERE property_id = $1 AND is_budget = FALSE
       ORDER BY report_month DESC LIMIT 12`,
      [propertyId]
    );

    let baseRent = 1200;
    let baseOccupancy = 0.93;
    let baseOtherIncome = active.otherIncomePerUnit * totalUnits * 12;

    if (actualsResult.rows.length > 0) {
      const latest = actualsResult.rows[0];
      baseRent = parseFloat(latest.avg_effective_rent) || baseRent;
      baseOccupancy = parseFloat(latest.occupancy_rate) || baseOccupancy;
    }

    const projections: AnnualProjection[] = [];
    let cumulativeCF = 0;
    const cashFlows: number[] = [-equityInvested];

    for (let year = 1; year <= holdYears; year++) {
      const yearRentGrowth = year === 1 ? active.rentGrowth : (year <= 5 ? rentGrowthYr2_5 : rentGrowthYr6_10);
      const rentGrowthFactor = year === 1
        ? (1 + active.rentGrowth)
        : (1 + active.rentGrowth) * Math.pow(1 + (year <= 5 ? rentGrowthYr2_5 : rentGrowthYr6_10), year - 1);
      const projectedRent = baseRent * rentGrowthFactor;
      const gpr = projectedRent * totalUnits * 12;
      const vacancy = gpr * active.vacancyRate;
      const concessions = gpr * active.concessionPct;
      const badDebt = gpr * active.badDebtPct;
      const netRental = gpr - vacancy - concessions - badDebt;
      const otherIncome = baseOtherIncome * Math.pow(1 + active.rentGrowth * 0.5, year);
      const egi = netRental + otherIncome;
      const opexGrowthFactor = Math.pow(1 + active.opexGrowth, year);
      const opex = egi * active.opexRatio * opexGrowthFactor;
      const noi = egi - opex;
      const cashFlow = noi - annualDebtService - (active.capexPerUnit * totalUnits);
      cumulativeCF += cashFlow;

      projections.push({
        year,
        gpr: Math.round(gpr),
        vacancy: Math.round(vacancy),
        egi: Math.round(egi),
        opex: Math.round(opex),
        noi: Math.round(noi),
        debtService: Math.round(annualDebtService),
        cashFlow: Math.round(cashFlow),
        cumulativeCF: Math.round(cumulativeCF),
      });

      cashFlows.push(cashFlow);
    }

    const year1Noi = projections[0].noi;
    const finalYearNoi = projections[holdYears - 1].noi;
    const exitCapRateActual = active.exitCapRate + (exitCapSpread * holdYears);
    const exitValue = finalYearNoi / exitCapRateActual;
    const sellingCosts = exitValue * sellingCostsPct;
    const netExitProceeds = exitValue - sellingCosts - loanAmount;

    cashFlows[cashFlows.length - 1] += netExitProceeds;

    const goingInCap = year1Noi / acquisitionPrice;
    const cocReturn = (projections[0].cashFlow) / equityInvested;
    const irr = calculateIRR(cashFlows);
    const equityMultiple = (cumulativeCF + netExitProceeds) / equityInvested;
    const dscr = year1Noi / annualDebtService;
    const debtYield = year1Noi / loanAmount;

    let optimalExitYear = holdYears;
    let bestIRR = irr;
    for (let testYear = 2; testYear <= holdYears; testYear++) {
      const testExitNoi = projections[testYear - 1].noi;
      const testExitVal = testExitNoi / (active.exitCapRate + exitCapSpread * testYear);
      const testNetProceeds = testExitVal * (1 - sellingCostsPct) - loanAmount;
      const testFlows = [-equityInvested, ...projections.slice(0, testYear).map(p => p.cashFlow)];
      testFlows[testFlows.length - 1] += testNetProceeds;
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
        Math.round(year1Noi * 100) / 100,
        Math.round(goingInCap * 10000) / 10000,
        Math.round(cocReturn * 10000) / 10000,
        Math.round(irr * 10000) / 10000,
        Math.round(equityMultiple * 100) / 100,
        Math.round(dscr * 100) / 100,
        Math.round(debtYield * 10000) / 10000,
        JSON.stringify(projections),
        optimalExitYear,
        Math.round(exitValue * 100) / 100,
      ]
    );

    return {
      snapshotId: snapshotResult.rows[0].id,
      strategy,
      layers: { baseline: layer1, adjusted: layer2, user: layer3 },
      activeLayer: templateId ? 'layer3' : 'layer2',
      returns: {
        year1Noi: Math.round(year1Noi),
        goingInCap: Math.round(goingInCap * 10000) / 10000,
        cocReturn: Math.round(cocReturn * 10000) / 10000,
        irr: Math.round(irr * 10000) / 10000,
        equityMultiple: Math.round(equityMultiple * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        debtYield: Math.round(debtYield * 10000) / 10000,
      },
      annualProjections: projections,
      optimalExitYear,
      exitValue: Math.round(exitValue),
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
      `SELECT avg_rent, vacancy_rate, rent_growth_yoy FROM submarkets WHERE id::text = $1 OR name = $1`,
      [prop.submarket_id || '']
    );
    const submarket = submarketResult.rows[0] || {};

    return {
      rentGrowth: hasData ? 0.03 : (parseFloat(submarket.rent_growth_yoy) || 0.03),
      vacancyRate: hasData
        ? (1 - (parseFloat(actuals.avg_occ) || 0.93))
        : (parseFloat(submarket.vacancy_rate) || 0.05),
      concessionPct: 0.01,
      badDebtPct: 0.015,
      otherIncomePerUnit: 150,
      opexRatio: hasData ? (parseFloat(actuals.avg_opex_ratio) || 0.45) : 0.45,
      opexGrowth: 0.025,
      managementFeePct: hasData ? (parseFloat(actuals.avg_mgmt_fee) || 0.05) : 0.05,
      capexPerUnit: 300,
      ltv: 0.70,
      interestRate: 0.065,
      exitCapRate: 0.055,
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
          adjusted.vacancyRate = Math.min(adjusted.vacancyRate + 0.01, 0.12);
          adjusted.rentGrowth = Math.max(adjusted.rentGrowth - 0.005, 0.005);
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
