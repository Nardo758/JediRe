import * as XLSX from 'xlsx';
import type { ModelAssumptions, ModelResults, AnnualCashFlowRow } from './types';

type CellValue = string | number | null | undefined;
type Row = CellValue[];

function sheetFromData(headers: string[], rows: Row[]): XLSX.WorkSheet {
  const data = [headers, ...rows];
  return XLSX.utils.aoa_to_sheet(data);
}

export function buildExcelWorkbook(assumptions: ModelAssumptions | null, results: ModelResults | null, dealName?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summaryRows: Row[] = [
    ['Deal Name', dealName ?? assumptions?.dealInfo?.dealName ?? ''],
    ['Address', assumptions?.dealInfo?.address ?? ''],
    ['City', assumptions?.dealInfo?.city ?? ''],
    ['State', assumptions?.dealInfo?.state ?? ''],
    ['Total Units', assumptions?.dealInfo?.totalUnits ?? 0],
    ['Net Rentable SF', assumptions?.dealInfo?.netRentableSF ?? 0],
    ['Hold Period', assumptions?.holdPeriod ?? 0],
    ['Model Type', assumptions?.modelType ?? ''],
    ['', ''],
    ['IRR', results?.summary?.irr ?? ''],
    ['Equity Multiple', results?.summary?.equityMultiple ?? ''],
    ['Cash-on-Cash', results?.summary?.cashOnCash ?? ''],
    ['Year 1 NOI', results?.summary?.noi ?? ''],
    ['DSCR', results?.summary?.dscr ?? ''],
    ['Exit Value', results?.summary?.exitValue ?? ''],
    ['Total Profit', results?.summary?.totalProfit ?? ''],
    ['', ''],
    ['LP IRR', results?.summary?.lpIrr ?? ''],
    ['LP Equity Multiple', results?.summary?.lpEm ?? ''],
    ['LP Total Distributions', results?.summary?.lpTotalDistributions ?? ''],
    ['GP IRR', results?.summary?.gpIrr ?? ''],
    ['GP Equity Multiple', results?.summary?.gpEm ?? ''],
    ['GP Promote Earned', results?.summary?.gpPromoteEarned ?? ''],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromData(['METRIC', 'VALUE'], summaryRows), 'Summary');

  const su = results?.sourcesAndUses;
  if (su) {
    const suRows: Row[] = [];
    suRows.push(['SOURCES', '', '']);
    (su.sources ?? []).forEach(s => suRows.push(['', s.label, s.amount]));
    suRows.push(['', 'Total Sources', (su.sources ?? []).reduce((t, s) => t + s.amount, 0)]);
    suRows.push(['', '', '']);
    suRows.push(['USES', '', '']);
    (su.uses ?? []).forEach(u => suRows.push(['', u.label, u.amount]));
    suRows.push(['', 'Total Uses', (su.uses ?? []).reduce((t, u) => t + u.amount, 0)]);
    XLSX.utils.book_append_sheet(wb, sheetFromData(['', 'ITEM', 'AMOUNT'], suRows), 'Sources & Uses');
  }

  const aRows: Row[] = [];
  if (assumptions) {
    aRows.push(['ACQUISITION', '', '']);
    aRows.push(['', 'Purchase Price', assumptions.acquisition?.purchasePrice ?? '']);
    aRows.push(['', 'Cap Rate', assumptions.acquisition?.capRate ?? '']);
    aRows.push(['', 'Exit Cap Rate', assumptions.disposition?.exitCapRate ?? '']);
    aRows.push(['', 'Selling Costs', assumptions.disposition?.sellingCosts ?? '']);
    aRows.push(['', '', '']);
    aRows.push(['REVENUE', '', '']);
    aRows.push(['', 'Loss to Lease', assumptions.revenue?.lossToLease ?? '']);
    aRows.push(['', 'Stabilized Occupancy', assumptions.revenue?.stabilizedOccupancy ?? '']);
    aRows.push(['', 'Collection Loss', assumptions.revenue?.collectionLoss ?? '']);
    (assumptions.revenue?.rentGrowth ?? []).forEach((g, i) => aRows.push(['', `Rent Growth Year ${i + 1}`, g]));
    aRows.push(['', '', '']);
    aRows.push(['FINANCING', '', '']);
    aRows.push(['', 'Loan Amount', assumptions.financing?.loanAmount ?? '']);
    aRows.push(['', 'Loan Type', assumptions.financing?.loanType ?? '']);
    aRows.push(['', 'Interest Rate', assumptions.financing?.interestRate ?? '']);
    aRows.push(['', 'Term', assumptions.financing?.term ?? '']);
    aRows.push(['', 'Amortization', assumptions.financing?.amortization ?? '']);
    aRows.push(['', 'IO Period', assumptions.financing?.ioPeriod ?? '']);
    aRows.push(['', '', '']);
    aRows.push(['CAPEX', '', '']);
    (assumptions.capex?.lineItems ?? []).forEach(item => aRows.push(['', item.description, item.amount]));
    aRows.push(['', 'Contingency %', assumptions.capex?.contingencyPct ?? '']);
    aRows.push(['', 'Reserves/Unit', assumptions.capex?.reservesPerUnit ?? '']);
    aRows.push(['', '', '']);
    aRows.push(['WATERFALL', '', '']);
    aRows.push(['', 'LP Share', assumptions.waterfall?.lpShare ?? '']);
    aRows.push(['', 'GP Share', assumptions.waterfall?.gpShare ?? '']);
    aRows.push(['', 'Equity Contribution', assumptions.waterfall?.equityContribution ?? '']);
    (assumptions.waterfall?.hurdles ?? []).forEach((h, i) => {
      aRows.push(['', `Tier ${i + 1} Hurdle Rate`, h.hurdleRate]);
      aRows.push(['', `Tier ${i + 1} GP Promote`, h.promoteToGP]);
      aRows.push(['', `Tier ${i + 1} LP Split`, h.lpSplit]);
    });
  }
  XLSX.utils.book_append_sheet(wb, sheetFromData(['SECTION', 'FIELD', 'VALUE'], aRows), 'Assumptions');

  const cf = results?.annualCashFlow ?? [];
  const cfHeaders = ['Year', 'GPR', 'Vacancy', 'EGR', 'Other Income', 'Total Revenue', 'OpEx', 'NOI', 'Debt Service', 'Cash Flow', 'LP Distribution', 'GP Distribution'];
  const cfRows: Row[] = cf.map((r: AnnualCashFlowRow) => [
    r.year, r.gpr, r.vacancy, r.egr, r.otherIncome, r.totalRevenue, r.opex, r.noi, r.debtService, r.cashFlow, r.lpDistribution ?? '', r.gpDistribution ?? '',
  ]);
  XLSX.utils.book_append_sheet(wb, sheetFromData(cfHeaders, cfRows), 'Cash Flows');

  const retHeaders = ['Metric', 'Deal', 'LP', 'GP'];
  const retRows: Row[] = [
    ['IRR', results?.summary?.irr ?? '', results?.summary?.lpIrr ?? '', results?.summary?.gpIrr ?? ''],
    ['Equity Multiple', results?.summary?.equityMultiple ?? '', results?.summary?.lpEm ?? '', results?.summary?.gpEm ?? ''],
    ['Cash-on-Cash', results?.summary?.cashOnCash ?? '', results?.summary?.lpCoC ?? '', results?.summary?.gpCoC ?? ''],
    ['Total Distributions', '', results?.summary?.lpTotalDistributions ?? '', results?.summary?.gpTotalDistributions ?? ''],
    ['Profit', results?.summary?.totalProfit ?? '', results?.summary?.lpProfit ?? '', results?.summary?.gpPromoteEarned ?? ''],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromData(retHeaders, retRows), 'Returns');

  const umHeaders = ['Floor Plan', 'Size (SF)', 'Beds', 'Units', 'Occupied', 'Vacant', 'Market Rent', 'In-Place Rent'];
  const umRows: Row[] = (assumptions?.unitMix ?? []).map(u => [
    u.floorPlan, u.unitSize, u.beds, u.units, u.occupied, u.vacant, u.marketRent, u.inPlaceRent,
  ]);
  XLSX.utils.book_append_sheet(wb, sheetFromData(umHeaders, umRows), 'Unit Mix');

  const wfDist = results?.waterfallDistributions ?? [];
  const wfHeaders = ['Tier', 'Hurdle Rate', 'LP Split', 'GP Split', 'LP Amount', 'GP Amount'];
  const wfRows: Row[] = wfDist.map(d => [d.tier, d.hurdleRate, d.lpSplit, d.gpSplit, d.lpAmount, d.gpAmount]);
  XLSX.utils.book_append_sheet(wb, sheetFromData(wfHeaders, wfRows), 'Waterfall');

  return wb;
}

export function exportToExcel(assumptions: ModelAssumptions | null, results: ModelResults | null, dealName?: string) {
  const wb = buildExcelWorkbook(assumptions, results, dealName);
  const filename = `${(dealName ?? 'financial-model').replace(/[^a-zA-Z0-9_-]/g, '_')}_proforma.xlsx`;
  XLSX.writeFile(wb, filename);
}
