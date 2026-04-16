import * as XLSX from 'xlsx';
import type { ModelAssumptions, ModelResults, AnnualCashFlowRow } from './types';

type CellValue = string | number | null | undefined;
type Row = CellValue[];

const FMT_USD = '$#,##0';
const FMT_USD_DEC = '$#,##0.00';
const FMT_PCT = '0.00%';
const FMT_NUM = '#,##0';
const FMT_X = '0.00"x"';
const FMT_INT = '#,##0';

function col(c: number): string {
  let s = '';
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function cellRef(c: number, r: number): string {
  return `${col(c)}${r + 1}`;
}

function applyHeaderStyle(ws: XLSX.WorkSheet, rowIdx: number, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const ref = cellRef(c, rowIdx);
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
      fill: { fgColor: { rgb: '1B2A4A' } },
      border: {
        bottom: { style: 'thin', color: { rgb: '3B5998' } },
      },
      alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' },
    };
  }
}

function applySectionStyle(ws: XLSX.WorkSheet, rowIdx: number, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const ref = cellRef(c, rowIdx);
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = {
      font: { bold: true, color: { rgb: 'F5A623' }, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: '0F1319' } },
      border: {
        bottom: { style: 'thin', color: { rgb: '2A3A5A' } },
      },
    };
  }
}

function applyTotalStyle(ws: XLSX.WorkSheet, rowIdx: number, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const ref = cellRef(c, rowIdx);
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      border: {
        top: { style: 'double', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
      },
      numFmt: c > 0 ? FMT_USD : undefined,
    };
  }
}

function applyNumberFormat(ws: XLSX.WorkSheet, ref: string, fmt: string) {
  if (ws[ref]) {
    if (!ws[ref].s) ws[ref].s = {};
    ws[ref].s.numFmt = fmt;
    ws[ref].s.alignment = { horizontal: 'right' };
  }
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function buildFormattedSheet(headers: string[], rows: Row[], opts?: {
  colWidths?: number[];
  currencyCols?: number[];
  pctCols?: number[];
  numCols?: number[];
  sectionRows?: number[];
  totalRows?: number[];
}): XLSX.WorkSheet {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  applyHeaderStyle(ws, 0, headers.length);

  if (opts?.colWidths) setColWidths(ws, opts.colWidths);

  if (opts?.sectionRows) {
    opts.sectionRows.forEach(r => applySectionStyle(ws, r + 1, headers.length));
  }
  if (opts?.totalRows) {
    opts.totalRows.forEach(r => applyTotalStyle(ws, r + 1, headers.length));
  }

  const numRows = rows.length;
  for (let r = 0; r < numRows; r++) {
    (opts?.currencyCols ?? []).forEach(c => {
      const ref = cellRef(c, r + 1);
      if (ws[ref] && typeof ws[ref].v === 'number') applyNumberFormat(ws, ref, FMT_USD);
    });
    (opts?.pctCols ?? []).forEach(c => {
      const ref = cellRef(c, r + 1);
      if (ws[ref] && typeof ws[ref].v === 'number') {
        const val = ws[ref].v as number;
        if (Math.abs(val) < 1 || (val > 0 && val < 100 && rows[r]?.[0]?.toString().match(/rate|cap|growth|vacancy|occupancy|yield|loss|dscr|irr|coc/i))) {
          applyNumberFormat(ws, ref, FMT_PCT);
        } else {
          applyNumberFormat(ws, ref, FMT_PCT);
        }
      }
    });
    (opts?.numCols ?? []).forEach(c => {
      const ref = cellRef(c, r + 1);
      if (ws[ref] && typeof ws[ref].v === 'number') applyNumberFormat(ws, ref, FMT_NUM);
    });
  }

  return ws;
}

export function buildExcelWorkbook(assumptions: ModelAssumptions | null, results: ModelResults | null, dealName?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const pctVal = (v: unknown): number | string => {
    if (v == null) return '';
    const n = Number(v);
    if (isNaN(n)) return '';
    return n > 1 ? n / 100 : n;
  };

  const summaryRows: Row[] = [
    ['Deal Name', dealName ?? assumptions?.dealInfo?.dealName ?? ''],
    ['Address', assumptions?.dealInfo?.address ?? ''],
    ['City', assumptions?.dealInfo?.city ?? ''],
    ['State', assumptions?.dealInfo?.state ?? ''],
    ['Total Units', assumptions?.dealInfo?.totalUnits ?? 0],
    ['Net Rentable SF', assumptions?.dealInfo?.netRentableSF ?? 0],
    ['Hold Period (Years)', assumptions?.holdPeriod ?? 0],
    ['Model Type', assumptions?.modelType ?? ''],
    ['', ''],
    ['KEY RETURNS', ''],
    ['IRR', pctVal(results?.summary?.irr)],
    ['Equity Multiple', results?.summary?.equityMultiple ?? ''],
    ['Cash-on-Cash Return', pctVal(results?.summary?.cashOnCash)],
    ['Year 1 NOI', results?.summary?.noi ?? ''],
    ['DSCR', results?.summary?.dscr ?? ''],
    ['Exit Value', results?.summary?.exitValue ?? ''],
    ['Total Profit', results?.summary?.totalProfit ?? ''],
    ['', ''],
    ['LP RETURNS', ''],
    ['LP IRR', pctVal(results?.summary?.lpIrr)],
    ['LP Equity Multiple', results?.summary?.lpEm ?? ''],
    ['LP Total Distributions', results?.summary?.lpTotalDistributions ?? ''],
    ['', ''],
    ['GP RETURNS', ''],
    ['GP IRR', pctVal(results?.summary?.gpIrr)],
    ['GP Equity Multiple', results?.summary?.gpEm ?? ''],
    ['GP Promote Earned', results?.summary?.gpPromoteEarned ?? ''],
  ];
  const summarySheet = buildFormattedSheet(['METRIC', 'VALUE'], summaryRows, {
    colWidths: [28, 18],
    sectionRows: [9, 18, 23],
  });
  const pctMetrics = [10, 12, 19, 24];
  pctMetrics.forEach(r => {
    const ref = cellRef(1, r + 1);
    if (summarySheet[ref] && typeof summarySheet[ref].v === 'number') {
      applyNumberFormat(summarySheet, ref, FMT_PCT);
    }
  });
  const usdMetrics = [13, 15, 16, 21, 26];
  usdMetrics.forEach(r => {
    const ref = cellRef(1, r + 1);
    if (summarySheet[ref] && typeof summarySheet[ref].v === 'number') {
      applyNumberFormat(summarySheet, ref, FMT_USD);
    }
  });
  const xMetrics = [11, 20, 25];
  xMetrics.forEach(r => {
    const ref = cellRef(1, r + 1);
    if (summarySheet[ref] && typeof summarySheet[ref].v === 'number') {
      applyNumberFormat(summarySheet, ref, FMT_X);
    }
  });
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const su = results?.sourcesAndUses;
  if (su) {
    const sources = su.sources ?? [];
    const uses = su.uses ?? [];
    const suRows: Row[] = [];
    const sectionIdxs: number[] = [];
    const totalIdxs: number[] = [];

    sectionIdxs.push(suRows.length);
    suRows.push(['SOURCES', '', '']);
    sources.forEach((s, i) => suRows.push(['', s.label, s.amount]));
    const srcTotalRow = suRows.length;
    totalIdxs.push(srcTotalRow);
    if (sources.length > 0) {
      suRows.push(['', 'Total Sources', { t: 'n', f: `SUM(C${sectionIdxs[0] + 3}:C${srcTotalRow + 1})` } as any]);
    } else {
      suRows.push(['', 'Total Sources', 0]);
    }
    suRows.push(['', '', '']);

    sectionIdxs.push(suRows.length);
    suRows.push(['USES', '', '']);
    const usesStart = suRows.length;
    uses.forEach(u => suRows.push(['', u.label, u.amount]));
    const usesTotalRow = suRows.length;
    totalIdxs.push(usesTotalRow);
    if (uses.length > 0) {
      suRows.push(['', 'Total Uses', { t: 'n', f: `SUM(C${usesStart + 2}:C${usesTotalRow + 1})` } as any]);
    } else {
      suRows.push(['', 'Total Uses', 0]);
    }

    const suSheet = buildFormattedSheet(['', 'ITEM', 'AMOUNT'], suRows, {
      colWidths: [14, 30, 18],
      currencyCols: [2],
      sectionRows: sectionIdxs,
      totalRows: totalIdxs,
    });
    XLSX.utils.book_append_sheet(wb, suSheet, 'Sources & Uses');
  }

  const aRows: Row[] = [];
  const aSections: number[] = [];
  if (assumptions) {
    aSections.push(aRows.length);
    aRows.push(['ACQUISITION', '', '']);
    aRows.push(['', 'Purchase Price', assumptions.acquisition?.purchasePrice ?? '']);
    aRows.push(['', 'Going-In Cap Rate', pctVal(assumptions.acquisition?.capRate)]);
    aRows.push(['', 'Exit Cap Rate', pctVal(assumptions.disposition?.exitCapRate)]);
    aRows.push(['', 'Selling Costs (%)', pctVal(assumptions.disposition?.sellingCosts)]);
    aRows.push(['', '', '']);

    aSections.push(aRows.length);
    aRows.push(['REVENUE', '', '']);
    aRows.push(['', 'Loss to Lease', pctVal(assumptions.revenue?.lossToLease)]);
    aRows.push(['', 'Stabilized Occupancy', pctVal(assumptions.revenue?.stabilizedOccupancy)]);
    aRows.push(['', 'Collection Loss', pctVal(assumptions.revenue?.collectionLoss)]);
    (assumptions.revenue?.rentGrowth ?? []).forEach((g, i) => aRows.push(['', `Rent Growth Year ${i + 1}`, pctVal(g)]));
    aRows.push(['', '', '']);

    aSections.push(aRows.length);
    aRows.push(['FINANCING', '', '']);
    aRows.push(['', 'Loan Amount', assumptions.financing?.loanAmount ?? '']);
    aRows.push(['', 'Loan Type', assumptions.financing?.loanType ?? '']);
    aRows.push(['', 'Interest Rate', pctVal(assumptions.financing?.interestRate)]);
    aRows.push(['', 'Term (Years)', assumptions.financing?.term ?? '']);
    aRows.push(['', 'Amortization (Years)', assumptions.financing?.amortization ?? '']);
    aRows.push(['', 'IO Period (Months)', assumptions.financing?.ioPeriod ?? '']);
    aRows.push(['', '', '']);

    aSections.push(aRows.length);
    aRows.push(['CAPITAL EXPENDITURES', '', '']);
    const capexItems = assumptions.capex?.lineItems ?? [];
    capexItems.forEach(item => aRows.push(['', item.description, item.amount]));
    if (capexItems.length > 0) {
      const capexStart = aSections[aSections.length - 1] + 2;
      aRows.push(['', 'Total CapEx', { t: 'n', f: `SUM(C${capexStart + 1}:C${capexStart + capexItems.length})` } as any]);
    }
    aRows.push(['', 'Contingency %', pctVal(assumptions.capex?.contingencyPct)]);
    aRows.push(['', 'Reserves/Unit/Year', assumptions.capex?.reservesPerUnit ?? '']);
    aRows.push(['', '', '']);

    aSections.push(aRows.length);
    aRows.push(['WATERFALL STRUCTURE', '', '']);
    aRows.push(['', 'LP Share', pctVal(assumptions.waterfall?.lpShare)]);
    aRows.push(['', 'GP Share', pctVal(assumptions.waterfall?.gpShare)]);
    aRows.push(['', 'Equity Contribution', assumptions.waterfall?.equityContribution ?? '']);
    (assumptions.waterfall?.hurdles ?? []).forEach((h, i) => {
      aRows.push(['', `Tier ${i + 1} Hurdle Rate`, pctVal(h.hurdleRate)]);
      aRows.push(['', `Tier ${i + 1} GP Promote`, pctVal(h.promoteToGP)]);
      aRows.push(['', `Tier ${i + 1} LP Split`, pctVal(h.lpSplit)]);
    });
  }
  const aSheet = buildFormattedSheet(['SECTION', 'FIELD', 'VALUE'], aRows, {
    colWidths: [22, 28, 18],
    sectionRows: aSections,
  });
  for (let r = 0; r < aRows.length; r++) {
    const ref = cellRef(2, r + 1);
    if (aSheet[ref] && typeof aSheet[ref].v === 'number') {
      const label = String(aRows[r]?.[1] ?? '').toLowerCase();
      if (label.match(/price|amount|contribution|reserves|total/i)) {
        applyNumberFormat(aSheet, ref, FMT_USD);
      } else if (label.match(/rate|cap|loss|occupancy|growth|share|promote|split|contingency/i)) {
        applyNumberFormat(aSheet, ref, FMT_PCT);
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, aSheet, 'Assumptions');

  const cf = results?.annualCashFlow ?? [];
  const cfHeaders = ['Year', 'GPR', 'Vacancy', 'EGR', 'Other Income', 'Total Revenue', 'OpEx', 'NOI', 'Debt Service', 'Cash Flow', 'LP Distribution', 'GP Distribution'];
  const cfRows: Row[] = cf.map((r: AnnualCashFlowRow, idx: number) => {
    const rowNum = idx + 2;
    return [
      r.year,
      r.gpr ?? '',
      r.vacancy ?? '',
      r.gpr != null && r.vacancy != null ? { t: 'n', f: `B${rowNum}-C${rowNum}` } as any : (r.egr ?? ''),
      r.otherIncome ?? '',
      r.gpr != null ? { t: 'n', f: `D${rowNum}+E${rowNum}` } as any : (r.totalRevenue ?? ''),
      r.opex ?? '',
      r.totalRevenue != null && r.opex != null ? { t: 'n', f: `F${rowNum}-G${rowNum}` } as any : (r.noi ?? ''),
      r.debtService ?? '',
      r.noi != null && r.debtService != null ? { t: 'n', f: `H${rowNum}-I${rowNum}` } as any : (r.cashFlow ?? ''),
      r.lpDistribution ?? '',
      r.gpDistribution ?? '',
    ];
  });
  if (cf.length > 0) {
    const totalRow: Row = [
      'TOTAL',
      { t: 'n', f: `SUM(B2:B${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(C2:C${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(D2:D${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(E2:E${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(F2:F${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(G2:G${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(H2:H${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(I2:I${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(J2:J${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(K2:K${cf.length + 1})` } as any,
      { t: 'n', f: `SUM(L2:L${cf.length + 1})` } as any,
    ];
    cfRows.push(totalRow);
  }
  const cfSheet = buildFormattedSheet(cfHeaders, cfRows, {
    colWidths: [8, 14, 14, 14, 14, 16, 14, 14, 14, 14, 16, 16],
    currencyCols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    totalRows: cf.length > 0 ? [cfRows.length - 1] : [],
  });
  XLSX.utils.book_append_sheet(wb, cfSheet, 'Cash Flows');

  const retHeaders = ['Metric', 'Deal Level', 'LP', 'GP'];
  const retRows: Row[] = [
    ['IRR', pctVal(results?.summary?.irr), pctVal(results?.summary?.lpIrr), pctVal(results?.summary?.gpIrr)],
    ['Equity Multiple', results?.summary?.equityMultiple ?? '', results?.summary?.lpEm ?? '', results?.summary?.gpEm ?? ''],
    ['Cash-on-Cash Return', pctVal(results?.summary?.cashOnCash), pctVal(results?.summary?.lpCoC), pctVal(results?.summary?.gpCoC)],
    ['Total Distributions', '', results?.summary?.lpTotalDistributions ?? '', results?.summary?.gpTotalDistributions ?? ''],
    ['Total Profit', results?.summary?.totalProfit ?? '', results?.summary?.lpProfit ?? '', results?.summary?.gpPromoteEarned ?? ''],
  ];
  const retSheet = buildFormattedSheet(retHeaders, retRows, {
    colWidths: [22, 16, 16, 16],
  });
  [0, 2].forEach(r => {
    [1, 2, 3].forEach(c => {
      const ref = cellRef(c, r + 1);
      if (retSheet[ref] && typeof retSheet[ref].v === 'number') applyNumberFormat(retSheet, ref, FMT_PCT);
    });
  });
  [1].forEach(r => {
    [1, 2, 3].forEach(c => {
      const ref = cellRef(c, r + 1);
      if (retSheet[ref] && typeof retSheet[ref].v === 'number') applyNumberFormat(retSheet, ref, FMT_X);
    });
  });
  [3, 4].forEach(r => {
    [1, 2, 3].forEach(c => {
      const ref = cellRef(c, r + 1);
      if (retSheet[ref] && typeof retSheet[ref].v === 'number') applyNumberFormat(retSheet, ref, FMT_USD);
    });
  });
  XLSX.utils.book_append_sheet(wb, retSheet, 'Returns');

  const umHeaders = ['Floor Plan', 'Size (SF)', 'Beds', 'Units', 'Occupied', 'Vacant', 'Market Rent', 'In-Place Rent', 'Loss-to-Lease'];
  const unitMix = assumptions?.unitMix ?? [];
  const umRows: Row[] = unitMix.map((u, idx) => {
    const rowNum = idx + 2;
    return [
      u.floorPlan,
      u.unitSize,
      u.beds,
      u.units,
      u.occupied,
      u.units != null && u.occupied != null ? { t: 'n', f: `D${rowNum}-E${rowNum}` } as any : (u.vacant ?? ''),
      u.marketRent,
      u.inPlaceRent,
      u.marketRent != null && u.inPlaceRent != null ? { t: 'n', f: `G${rowNum}-H${rowNum}` } as any : '',
    ];
  });
  if (unitMix.length > 0) {
    const lastRow = unitMix.length + 1;
    umRows.push([
      'TOTAL',
      '',
      '',
      { t: 'n', f: `SUM(D2:D${lastRow})` } as any,
      { t: 'n', f: `SUM(E2:E${lastRow})` } as any,
      { t: 'n', f: `SUM(F2:F${lastRow})` } as any,
      { t: 'n', f: `SUMPRODUCT(G2:G${lastRow},D2:D${lastRow})/SUM(D2:D${lastRow})` } as any,
      { t: 'n', f: `SUMPRODUCT(H2:H${lastRow},D2:D${lastRow})/SUM(D2:D${lastRow})` } as any,
      { t: 'n', f: `G${lastRow + 1}-H${lastRow + 1}` } as any,
    ]);
  }
  const umSheet = buildFormattedSheet(umHeaders, umRows, {
    colWidths: [16, 12, 8, 10, 12, 10, 14, 14, 14],
    currencyCols: [6, 7, 8],
    numCols: [1, 3, 4, 5],
    totalRows: unitMix.length > 0 ? [umRows.length - 1] : [],
  });
  XLSX.utils.book_append_sheet(wb, umSheet, 'Unit Mix');

  const wfDist = results?.waterfallDistributions ?? [];
  const wfHeaders = ['Tier', 'Hurdle Rate', 'LP Split', 'GP Split', 'LP Amount', 'GP Amount', 'Total Tier'];
  const wfRows: Row[] = wfDist.map((d, idx) => {
    const rowNum = idx + 2;
    return [
      d.tier,
      pctVal(d.hurdleRate),
      pctVal(d.lpSplit),
      pctVal(d.gpSplit),
      d.lpAmount,
      d.gpAmount,
      { t: 'n', f: `E${rowNum}+F${rowNum}` } as any,
    ];
  });
  if (wfDist.length > 0) {
    const lastRow = wfDist.length + 1;
    wfRows.push([
      'TOTAL',
      '',
      '',
      '',
      { t: 'n', f: `SUM(E2:E${lastRow})` } as any,
      { t: 'n', f: `SUM(F2:F${lastRow})` } as any,
      { t: 'n', f: `SUM(G2:G${lastRow})` } as any,
    ]);
  }
  const wfSheet = buildFormattedSheet(wfHeaders, wfRows, {
    colWidths: [10, 14, 12, 12, 16, 16, 16],
    currencyCols: [4, 5, 6],
    pctCols: [1, 2, 3],
    totalRows: wfDist.length > 0 ? [wfRows.length - 1] : [],
  });
  XLSX.utils.book_append_sheet(wb, wfSheet, 'Waterfall');

  return wb;
}

export function exportToExcel(assumptions: ModelAssumptions | null, results: ModelResults | null, dealName?: string) {
  const wb = buildExcelWorkbook(assumptions, results, dealName);
  const filename = `${(dealName ?? 'financial-model').replace(/[^a-zA-Z0-9_-]/g, '_')}_proforma.xlsx`;
  XLSX.writeFile(wb, filename, { bookSST: true, cellStyles: true });
}

