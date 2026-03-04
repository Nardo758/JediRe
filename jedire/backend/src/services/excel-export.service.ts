import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import type { ProFormaAssumptions, FinancialModelResult } from './financial-model-engine.service';

export class ExcelExportService {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'financial-models');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateWorkbook(
    dealId: string,
    assumptions: ProFormaAssumptions,
    results: FinancialModelResult
  ): Promise<string> {
    const wb = XLSX.utils.book_new();

    if (assumptions.modelType === 'development') {
      this.buildDevelopmentWorkbook(wb, assumptions, results);
    } else {
      this.buildExistingAssetWorkbook(wb, assumptions, results);
    }

    const filename = `${assumptions.dealInfo.dealName.replace(/[^a-zA-Z0-9]/g, '_')}_Model_${Date.now()}.xlsx`;
    const filepath = path.join(this.outputDir, filename);
    XLSX.writeFile(wb, filepath);
    return filepath;
  }

  private buildExistingAssetWorkbook(
    wb: XLSX.WorkBook,
    a: ProFormaAssumptions,
    r: FinancialModelResult
  ): void {
    this.addSummarySheet(wb, a, r);
    this.addInputSheet(wb, a);
    this.addPropertyCFSheet(wb, a, r);
    this.addUnderwritingSheet(wb, a, r);
    this.addSensitivitySheet(wb, r);
    this.addCapexSheet(wb, a);
    this.addWaterfallSheet(wb, r);
  }

  private buildDevelopmentWorkbook(
    wb: XLSX.WorkBook,
    a: ProFormaAssumptions,
    r: FinancialModelResult
  ): void {
    this.addDevSummarySheet(wb, a, r);
    this.addDevBudgetSheet(wb, a, r);
    this.addNOISheet(wb, a, r);
    this.addSensitivitySheet(wb, r);
    this.addCapexSheet(wb, a);
    if (r.developmentSchedule) {
      this.addDevScheduleSheet(wb, r);
    }
  }

  private addSummarySheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    const data: any[][] = [];
    data.push([a.dealInfo.dealName, '', 'Property Cash Flow Projections', '', a.dealInfo.city + ', ' + a.dealInfo.state]);
    data.push([]);
    data.push(['Acquisition', '', 'Sources And Uses']);
    data.push(['Purchase Price', a.acquisition.purchasePrice, '', 'Sources', '', 'Uses']);
    data.push(['Cap Rate', a.acquisition.capRate, '', 'Senior Loan', r.sourcesAndUses.sources['Senior Loan'] || r.debtMetrics.loanAmount, '', 'Purchase Price', a.acquisition.purchasePrice]);

    const totalClosingCosts = Object.values(a.acquisition.closingCosts).reduce((s, v) => s + v, 0);
    data.push(['Closing Costs', totalClosingCosts, '', 'Common Equity', r.sourcesAndUses.sources['Common Equity'] || a.waterfall.equityContribution, '', 'Closing Costs', totalClosingCosts]);

    const totalCapex = a.capex.lineItems.reduce((s, i) => s + i.amount, 0) * (1 + a.capex.contingencyPct);
    data.push(['Total Acquisition', a.acquisition.purchasePrice + totalClosingCosts, '', '', '', '', 'Capital Expenditures', totalCapex]);

    data.push([]);
    data.push(['Return Metrics']);
    data.push(['Levered IRR', r.summary.irr]);
    data.push(['Equity Multiple', r.summary.equityMultiple]);
    data.push(['Yield on Cost', r.summary.yieldOnCost]);
    data.push(['Exit Value', r.summary.exitValue]);
    data.push(['Net Proceeds', r.summary.netProceeds]);

    data.push([]);
    data.push(['Debt Metrics', '', 'Closing', 'Stabilized']);
    data.push(['DSCR', '', r.summary.dscr?.[0] || r.debtMetrics.dscr, r.summary.dscr?.[1] || '']);
    data.push(['Debt Yield', '', r.summary.debtYield?.[0] || r.debtMetrics.debtYield, r.summary.debtYield?.[1] || '']);
    data.push(['LTV', '', r.debtMetrics.ltv]);

    data.push([]);
    data.push(['Cash on Cash by Year']);
    (r.summary.cashOnCash || []).forEach((coc, i) => {
      data.push([`Year ${i + 1}`, coc]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 18, 5, 20, 18, 5, 20, 18]);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary Page');
  }

  private addInputSheet(wb: XLSX.WorkBook, a: ProFormaAssumptions): void {
    const data: any[][] = [];
    data.push(['GENERAL ASSUMPTIONS']);
    data.push([]);
    data.push(['DEAL IDENTIFIER', '', '', 'DEAL TIMING']);
    data.push(['Deal Name', a.dealInfo.dealName, '', 'Hold Period (yrs)', a.holdPeriod]);
    data.push(['Total Units', a.dealInfo.totalUnits]);
    data.push(['Net Rentable SF', a.dealInfo.netRentableSF]);
    data.push(['Vintage', a.dealInfo.vintage]);
    data.push(['Address', a.dealInfo.address]);
    data.push(['City', a.dealInfo.city]);
    data.push(['State', a.dealInfo.state]);

    data.push([]);
    data.push(['UNIT MIX & MARKET RENT']);
    data.push(['Floor Plan', 'Unit Size', 'Beds', '# Units', 'Occupied', 'Vacant', 'Market Rent', 'Rent/SF', 'In-Place Rent']);
    for (const u of a.unitMix) {
      data.push([u.floorPlan, u.unitSize, u.beds, u.units, u.occupied, u.vacant, u.marketRent, u.unitSize > 0 ? +(u.marketRent / u.unitSize).toFixed(2) : 0, u.inPlaceRent]);
    }

    data.push([]);
    data.push(['ACQUISITION ASSUMPTIONS', '', '', 'DISPOSITION ASSUMPTIONS']);
    data.push(['Purchase Price', a.acquisition.purchasePrice, '', 'Exit Cap Rate', a.disposition.exitCapRate]);
    data.push(['Cap Rate', a.acquisition.capRate, '', 'Selling Costs', a.disposition.sellingCosts]);
    Object.entries(a.acquisition.closingCosts).forEach(([k, v]) => {
      data.push([k, v]);
    });

    data.push([]);
    data.push(['REVENUE ASSUMPTIONS']);
    data.push(['Rent Growth by Year', ...a.revenue.rentGrowth.map((r, i) => `Y${i + 1}: ${(r * 100).toFixed(1)}%`)]);
    data.push(['Loss-to-Lease', a.revenue.lossToLease]);
    data.push(['Stabilized Occupancy', a.revenue.stabilizedOccupancy]);
    data.push(['Collection Loss', a.revenue.collectionLoss]);

    data.push([]);
    data.push(['OTHER INCOME']);
    data.push(['Item', '$/Unit/Month', 'Penetration %', 'Annual Total']);
    Object.entries(a.revenue.otherIncome || {}).forEach(([name, oi]) => {
      data.push([name, oi.perUnitMonth, oi.penetration, Math.round(oi.perUnitMonth * a.dealInfo.totalUnits * 12 * oi.penetration)]);
    });

    data.push([]);
    data.push(['OPERATING EXPENSES']);
    data.push(['Category', 'Annual Amount', 'Type', 'Growth Rate']);
    Object.entries(a.expenses).forEach(([name, e]) => {
      data.push([name, e.amount, e.type, e.growthRate]);
    });

    data.push([]);
    data.push(['FINANCING']);
    data.push(['Loan Amount', a.financing.loanAmount]);
    data.push(['Type', a.financing.loanType]);
    data.push(['Interest Rate', a.financing.interestRate]);
    data.push(['Spread', a.financing.spread]);
    data.push(['Term (Years)', a.financing.term]);
    data.push(['Amortization (Years)', a.financing.amortization]);
    data.push(['IO Period (Months)', a.financing.ioPeriod]);
    data.push(['Origination Fee', a.financing.originationFee]);
    data.push(['Rate Cap Cost', a.financing.rateCapCost]);

    data.push([]);
    data.push(['WATERFALL']);
    data.push(['Equity Contribution', a.waterfall.equityContribution]);
    data.push(['LP/GP Split', `${(a.waterfall.lpShare * 100).toFixed(0)}/${(a.waterfall.gpShare * 100).toFixed(0)}`]);
    data.push(['Hurdle', 'Promote to GP', 'LP Split']);
    (a.waterfall.hurdles || []).forEach(h => {
      data.push([h.hurdleRate, h.promoteToGP, h.lpSplit]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [25, 18, 12, 25, 18, 12, 18, 12, 18]);
    XLSX.utils.book_append_sheet(wb, ws, 'Input');
  }

  private addPropertyCFSheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    const data: any[][] = [];
    const years = r.annualCashFlow.length;

    data.push([a.dealInfo.dealName, '', '', ...Array.from({ length: years }, (_, i) => `Year ${i + 1}`)]);
    data.push([]);
    data.push(['ANNUAL OPERATING CASH FLOW']);
    data.push([]);

    const header = ['', 'Per Unit', 'Per SF', ...Array.from({ length: years }, (_, i) => `Year ${i + 1}`)];
    data.push(header);

    data.push(['OPERATING REVENUE']);
    const addCFRow = (label: string, values: number[]) => {
      const y1 = values[0] || 0;
      data.push([label, a.dealInfo.totalUnits > 0 ? Math.round(y1 / a.dealInfo.totalUnits) : 0, a.dealInfo.netRentableSF > 0 ? +(y1 / a.dealInfo.netRentableSF).toFixed(2) : 0, ...values.map(v => Math.round(v))]);
    };

    addCFRow('Potential Market Rent', r.annualCashFlow.map(y => y.potentialRent));
    addCFRow('(Loss to Lease)', r.annualCashFlow.map(y => y.lossToLease));
    addCFRow('Gross Potential Rent', r.annualCashFlow.map(y => y.potentialRent + y.lossToLease));
    data.push([]);
    addCFRow('Vacancy', r.annualCashFlow.map(y => y.vacancy));
    addCFRow('Collection Loss', r.annualCashFlow.map(y => y.collectionLoss));
    addCFRow('Net Rental Income', r.annualCashFlow.map(y => y.netRentalIncome));
    addCFRow('Other Income', r.annualCashFlow.map(y => y.otherIncome));
    data.push([]);
    addCFRow('EFFECTIVE GROSS REVENUE', r.annualCashFlow.map(y => y.effectiveGrossRevenue));
    data.push([]);

    data.push(['OPERATING EXPENSES']);
    const expenseKeys = r.annualCashFlow[0]?.operatingExpenses ? Object.keys(r.annualCashFlow[0].operatingExpenses) : [];
    for (const key of expenseKeys) {
      addCFRow(key, r.annualCashFlow.map(y => y.operatingExpenses[key] || 0));
    }
    data.push([]);
    addCFRow('TOTAL OPERATING EXPENSES', r.annualCashFlow.map(y => y.totalExpenses));

    data.push([]);
    addCFRow('NET OPERATING INCOME', r.annualCashFlow.map(y => y.noi));
    addCFRow('Replacement Reserves', r.annualCashFlow.map(y => y.replacementReserves));
    addCFRow('NOI AFTER RESERVES', r.annualCashFlow.map(y => y.noiAfterReserves));

    data.push([]);
    addCFRow('Debt Service', r.annualCashFlow.map(y => y.debtService));
    addCFRow('Capital Expenditures', r.annualCashFlow.map(y => y.capitalExpenditures));
    addCFRow('BEFORE TAX CASH FLOW', r.annualCashFlow.map(y => y.beforeTaxCashFlow));
    addCFRow('LEVERED CASH FLOW', r.annualCashFlow.map(y => y.leveredCashFlow));

    data.push([]);
    data.push(['DSCR', '', '', ...(r.summary.dscr || r.annualCashFlow.map(y => y.debtService > 0 ? +(y.noi / y.debtService).toFixed(2) : 0))]);
    data.push(['Debt Yield', '', '', ...(r.summary.debtYield || r.annualCashFlow.map(y => r.debtMetrics.loanAmount > 0 ? +(y.noi / r.debtMetrics.loanAmount).toFixed(4) : 0))]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 12, 12, ...Array(years).fill(15)]);
    XLSX.utils.book_append_sheet(wb, ws, 'Property CF');
  }

  private addUnderwritingSheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    const data: any[][] = [];
    data.push([a.dealInfo.dealName, '', 'Underwriting Analysis', '', a.dealInfo.city + ', ' + a.dealInfo.state]);
    data.push([]);
    data.push(['COMPARISON: YEAR 1 PRO FORMA']);
    data.push([]);
    data.push(['', 'Year 1', 'Per Unit', 'Per SF', '% of EGR']);

    const y1 = r.annualCashFlow[0];
    if (!y1) {
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Underwriting Analysis');
      return;
    }

    const units = a.dealInfo.totalUnits || 1;
    const sf = a.dealInfo.netRentableSF || 1;
    const egr = y1.effectiveGrossRevenue || 1;

    const addRow = (label: string, val: number) => {
      data.push([label, Math.round(val), Math.round(val / units), +(val / sf).toFixed(2), +(val / egr).toFixed(4)]);
    };

    data.push(['OPERATING REVENUE']);
    addRow('Potential Market Rent', y1.potentialRent);
    addRow('(Loss to Lease)', y1.lossToLease);
    addRow('Vacancy', y1.vacancy);
    addRow('Collection Loss', y1.collectionLoss);
    addRow('Net Rental Income', y1.netRentalIncome);
    addRow('Other Income', y1.otherIncome);
    addRow('EFFECTIVE GROSS REVENUE', y1.effectiveGrossRevenue);
    data.push([]);
    data.push(['OPERATING EXPENSES']);
    for (const [key, val] of Object.entries(y1.operatingExpenses || {})) {
      addRow(key, val);
    }
    addRow('TOTAL EXPENSES', y1.totalExpenses);
    data.push([]);
    addRow('NET OPERATING INCOME', y1.noi);
    addRow('Replacement Reserves', y1.replacementReserves);
    addRow('NOI AFTER RESERVES', y1.noiAfterReserves);

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 15, 12, 12, 12]);
    XLSX.utils.book_append_sheet(wb, ws, 'Underwriting Analysis');
  }

  private addSensitivitySheet(wb: XLSX.WorkBook, r: FinancialModelResult): void {
    const data: any[][] = [];
    data.push(['SENSITIVITY ANALYSIS']);
    data.push([]);

    data.push(['EXIT CAP RATE vs HOLD PERIOD']);
    data.push([]);

    const exitCapData = r.sensitivityAnalysis?.exitCapVsHoldPeriod || [];
    if (exitCapData.length > 0) {
      const holdPeriods = [...new Set(exitCapData.map(d => d.holdPeriod))].sort((a, b) => a - b);
      const capRates = [...new Set(exitCapData.map(d => d.capRate))].sort((a, b) => a - b);

      data.push(['Hold Period ↓ / Cap Rate →', ...capRates.map(c => `${(c * 100).toFixed(2)}%`)]);
      for (const hp of holdPeriods) {
        const row: any[] = [`${hp} Years`];
        for (const cr of capRates) {
          const cell = exitCapData.find(d => d.holdPeriod === hp && d.capRate === cr);
          row.push(cell ? `IRR: ${(cell.irr * 100).toFixed(1)}% / EM: ${cell.equityMultiple.toFixed(2)}x` : '');
        }
        data.push(row);
      }
    } else {
      data.push(['No sensitivity data available']);
    }

    data.push([]);
    data.push([]);
    data.push(['RENT GROWTH vs HOLD PERIOD']);
    data.push([]);

    const rgData = r.sensitivityAnalysis?.rentGrowthVsHoldPeriod || [];
    if (rgData.length > 0) {
      const holdPeriods = [...new Set(rgData.map(d => d.holdPeriod))].sort((a, b) => a - b);
      const growthRates = [...new Set(rgData.map(d => d.rentGrowth))].sort((a, b) => a - b);

      data.push(['Hold Period ↓ / Rent Growth →', ...growthRates.map(g => `${(g * 100).toFixed(1)}%`)]);
      for (const hp of holdPeriods) {
        const row: any[] = [`${hp} Years`];
        for (const rg of growthRates) {
          const cell = rgData.find(d => d.holdPeriod === hp && d.rentGrowth === rg);
          row.push(cell ? `IRR: ${(cell.irr * 100).toFixed(1)}% / EM: ${cell.equityMultiple.toFixed(2)}x` : '');
        }
        data.push(row);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 25, 25, 25, 25, 25]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sensitivity Analysis');
  }

  private addCapexSheet(wb: XLSX.WorkBook, a: ProFormaAssumptions): void {
    const data: any[][] = [];
    data.push(['CAPITAL EXPENDITURES']);
    data.push([]);
    data.push(['Description', 'Amount']);

    let subtotal = 0;
    for (const item of a.capex.lineItems || []) {
      data.push([item.description, item.amount]);
      subtotal += item.amount;
    }

    data.push([]);
    data.push(['Subtotal', subtotal]);
    data.push(['Contingency (' + (a.capex.contingencyPct * 100).toFixed(0) + '%)', Math.round(subtotal * a.capex.contingencyPct)]);
    data.push(['Total', Math.round(subtotal * (1 + a.capex.contingencyPct))]);

    data.push([]);
    data.push(['Replacement Reserves', `$${a.capex.reservesPerUnit}/unit/year`]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [40, 18]);
    XLSX.utils.book_append_sheet(wb, ws, 'Capex');
  }

  private addWaterfallSheet(wb: XLSX.WorkBook, r: FinancialModelResult): void {
    const data: any[][] = [];
    data.push(['WATERFALL DISTRIBUTIONS']);
    data.push([]);
    data.push(['Year', 'LP Distribution', 'GP Distribution', 'GP Promote', 'Total Distribution']);

    for (const w of r.waterfallDistributions || []) {
      data.push([w.year, Math.round(w.lpDistribution), Math.round(w.gpDistribution), Math.round(w.gpPromote), Math.round(w.totalDistribution)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [10, 18, 18, 18, 18]);
    XLSX.utils.book_append_sheet(wb, ws, 'Waterfall');
  }

  private addDevSummarySheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    const data: any[][] = [];
    const dev = a.development!;
    data.push([a.dealInfo.dealName]);
    data.push([]);
    data.push(['LAND, UNIT INVENTORY & VALUATION']);
    data.push(['Total Units', a.dealInfo.totalUnits]);
    data.push(['Net Rentable Area', a.dealInfo.netRentableSF]);

    const avgRent = a.unitMix.length > 0 ? a.unitMix.reduce((s, u) => s + u.marketRent * u.units, 0) / a.dealInfo.totalUnits : 0;
    data.push(['Average Unit Size', Math.round(a.dealInfo.netRentableSF / a.dealInfo.totalUnits)]);
    data.push(['Average Rent Per Unit', Math.round(avgRent)]);

    data.push([]);
    data.push(['RETURN METRICS']);
    data.push(['IRR on Sale', r.summary.irr]);
    data.push(['Equity Multiple', r.summary.equityMultiple]);
    data.push(['Yield on Cost', r.summary.yieldOnCost]);

    data.push([]);
    data.push(['DEVELOPMENT COSTS']);
    data.push(['Land', dev.landCost]);
    data.push(['Hard Costs', Math.round(dev.hardCostPerSF * a.dealInfo.netRentableSF)]);
    data.push(['Hard Cost Contingency', Math.round(dev.hardCostPerSF * a.dealInfo.netRentableSF * dev.hardCostContingency)]);
    data.push(['Soft Costs', Math.round(dev.hardCostPerSF * a.dealInfo.netRentableSF * dev.softCostPct)]);

    const totalHard = dev.hardCostPerSF * a.dealInfo.netRentableSF * (1 + dev.hardCostContingency);
    const totalSoft = dev.hardCostPerSF * a.dealInfo.netRentableSF * dev.softCostPct;
    const totalDevCost = dev.landCost + totalHard + totalSoft;

    data.push(['Total Development Cost', Math.round(totalDevCost)]);
    data.push(['Cost Per Unit', Math.round(totalDevCost / a.dealInfo.totalUnits)]);
    data.push(['Cost Per SF', +(totalDevCost / a.dealInfo.netRentableSF).toFixed(2)]);

    data.push([]);
    data.push(['CAPITALIZATION']);
    data.push(['Construction Loan', Math.round(totalDevCost * dev.constructionLoanLTC)]);
    data.push(['Equity', Math.round(totalDevCost * (1 - dev.constructionLoanLTC))]);

    data.push([]);
    data.push(['NOI (Year 1 Stabilized)', r.summary.noiYear1]);
    data.push(['Exit Value', r.summary.exitValue]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 18, 18]);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  private addDevBudgetSheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    const data: any[][] = [];
    const dev = a.development!;

    data.push([a.dealInfo.dealName, '', 'DEVELOPMENT BUDGET']);
    data.push([]);
    data.push(['Category', 'Total', 'Per Unit', 'Per SF', '% of Cost']);

    const hardCost = Math.round(dev.hardCostPerSF * a.dealInfo.netRentableSF);
    const contingency = Math.round(hardCost * dev.hardCostContingency);
    const softCost = Math.round(hardCost * dev.softCostPct);
    const devFee = Math.round((hardCost + softCost) * dev.developerFee);
    const totalCost = dev.landCost + hardCost + contingency + softCost + devFee;

    const units = a.dealInfo.totalUnits;
    const sf = a.dealInfo.netRentableSF;

    const budgetRow = (label: string, amount: number) => {
      data.push([label, amount, Math.round(amount / units), +(amount / sf).toFixed(2), +(amount / totalCost).toFixed(4)]);
    };

    budgetRow('Land', dev.landCost);
    budgetRow('Hard Costs', hardCost);
    budgetRow('Hard Cost Contingency', contingency);
    budgetRow('Soft Costs', softCost);
    budgetRow('Developer Fee', devFee);
    data.push([]);
    budgetRow('TOTAL DEVELOPMENT COST', totalCost);

    data.push([]);
    data.push(['CONSTRUCTION FINANCING']);
    data.push(['Construction Loan LTC', dev.constructionLoanLTC]);
    data.push(['Construction Loan Amount', Math.round(totalCost * dev.constructionLoanLTC)]);
    data.push(['Construction Loan Rate', dev.constructionLoanRate]);
    data.push(['Construction Period (months)', dev.constructionPeriod]);
    data.push(['Lease-Up Velocity (units/month)', dev.leaseUpVelocity]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [30, 18, 12, 12, 12]);
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');
  }

  private addNOISheet(wb: XLSX.WorkBook, a: ProFormaAssumptions, r: FinancialModelResult): void {
    this.addPropertyCFSheet(wb, a, r);
  }

  private addDevScheduleSheet(wb: XLSX.WorkBook, r: FinancialModelResult): void {
    const data: any[][] = [];
    data.push(['DEVELOPMENT SCHEDULE (Monthly)']);
    data.push([]);
    data.push(['Month', 'Hard Cost Draw', 'Soft Cost Draw', 'Interest Draw', 'Loan Balance', 'Equity Draw', 'Occupied Units', 'Monthly Revenue']);

    for (const m of r.developmentSchedule || []) {
      data.push([
        m.month,
        Math.round(m.hardCostDraw),
        Math.round(m.softCostDraw),
        Math.round(m.interestDraw),
        Math.round(m.loanBalance),
        Math.round(m.equityDraw),
        m.occupiedUnits,
        Math.round(m.revenue),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    this.applyColumnWidths(ws, [10, 15, 15, 15, 18, 15, 15, 15]);
    XLSX.utils.book_append_sheet(wb, ws, 'Dev Schedule');
  }

  private applyColumnWidths(ws: XLSX.WorkSheet, widths: number[]): void {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  }
}

export const excelExportService = new ExcelExportService();
