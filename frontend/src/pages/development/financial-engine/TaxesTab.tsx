import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

const DEPREC_LIFE_RESIDENTIAL = 27.5;
const DEPREC_LIFE_COMMERCIAL  = 39.0;
const LAND_VALUE_PCT           = 0.20;  // land is non-depreciable
const FED_ORDINARY_RATE        = 0.37;
const FED_LTCG_RATE            = 0.20;
const FED_DEPREC_RECAPTURE     = 0.25;
const NIIT_RATE                = 0.038;
const STATE_RATE               = 0.06;

interface TaxYear {
  year: number;
  noi: number;
  debtService: number;
  btcf: number;
  depreciation: number;
  taxableIncome: number;
  taxOrdinary: number;
  taxNIIT: number;
  taxState: number;
  totalTax: number;
  atcf: number;
  effectiveRate: number;
  cumulDepreciation: number;
}

interface ExitTaxCalc {
  grossSalePrice: number;
  adjustedBasis: number;
  totalGain: number;
  deprecRecaptureGain: number;
  ltcgGain: number;
  deprecRecaptureTax: number;
  ltcgTax: number;
  niitTax: number;
  stateTax: number;
  totalExitTax: number;
  netSaleProceeds: number;
}

function buildTaxYears(
  noi_y1: number,
  debtService: number,
  depreciableBase: number,
  depreciableLife: number,
  holdYears: number,
  rentGrowth: number,
  opexGrowth: number,
): TaxYear[] {
  const annualDepreciation = depreciableBase / depreciableLife;
  let cumulDepreciation = 0;
  const rows: TaxYear[] = [];

  for (let y = 1; y <= holdYears; y++) {
    const growthFactor = Math.pow(1 + rentGrowth, y - 1);
    const noi = noi_y1 * growthFactor;
    const btcf = noi - debtService;
    const taxableIncome = btcf - annualDepreciation;
    cumulDepreciation += annualDepreciation;

    const taxOrdinary = taxableIncome > 0 ? taxableIncome * FED_ORDINARY_RATE : 0;
    const taxNIIT     = btcf > 0 ? btcf * NIIT_RATE : 0;
    const taxState    = taxableIncome > 0 ? taxableIncome * STATE_RATE : 0;
    const totalTax    = taxOrdinary + taxNIIT + taxState;
    const atcf        = btcf - totalTax;
    const effectiveRate = btcf !== 0 ? totalTax / Math.abs(btcf) : 0;

    rows.push({ year: y, noi, debtService, btcf, depreciation: annualDepreciation, taxableIncome, taxOrdinary, taxNIIT, taxState, totalTax, atcf, effectiveRate, cumulDepreciation });
  }

  return rows;
}

function computeExitTax(
  salePrice: number,
  purchasePrice: number,
  cumulDepreciation: number,
  sellingCostsPct: number,
  loanBalance: number,
): ExitTaxCalc {
  const sellingCosts = salePrice * sellingCostsPct;
  const netSaleProceedsGross = salePrice - sellingCosts - loanBalance;
  const adjustedBasis = purchasePrice - cumulDepreciation;
  const totalGain = salePrice - sellingCosts - adjustedBasis;
  const deprecRecaptureGain = Math.min(cumulDepreciation, Math.max(0, totalGain));
  const ltcgGain = Math.max(0, totalGain - deprecRecaptureGain);

  const deprecRecaptureTax = deprecRecaptureGain * FED_DEPREC_RECAPTURE;
  const ltcgTax             = ltcgGain * FED_LTCG_RATE;
  const niitTax             = Math.max(0, totalGain) * NIIT_RATE;
  const stateTax            = Math.max(0, totalGain) * STATE_RATE;
  const totalExitTax        = deprecRecaptureTax + ltcgTax + niitTax + stateTax;
  const netSaleProceeds     = netSaleProceedsGross - totalExitTax;

  return { grossSalePrice: salePrice, adjustedBasis, totalGain, deprecRecaptureGain, ltcgGain, deprecRecaptureTax, ltcgTax, niitTax, stateTax, totalExitTax, netSaleProceeds };
}

export function TaxesTab({ dealId, deal, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const [assetType, setAssetType] = useState<'residential' | 'commercial'>('residential');
  const [showDetail, setShowDetail] = useState(false);

  const depreciableLife = assetType === 'residential' ? DEPREC_LIFE_RESIDENTIAL : DEPREC_LIFE_COMMERCIAL;

  const purchasePrice = f9Financials?.capitalStack?.purchasePrice
    ?? assumptions?.acquisition?.purchasePrice
    ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);

  const loanAmount = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? purchasePrice * 0.65;

  const f9Noi = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? null;
  const noi_y1 = f9Noi ?? modelResults?.summary?.noi ?? 0;

  const holdYears = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;
  const exitCap   = f9Financials?.assumptions?.exitCap ?? assumptions?.disposition?.exitCapRate ?? 0.055;
  const exitSalePrice = exitCap > 0 ? (noi_y1 * Math.pow(1.03, holdYears - 1)) / exitCap : 0;
  const sellingCostsPct = assumptions?.disposition?.sellingCosts ?? 0.03;

  const interestRate = f9Financials?.capitalStack?.interestRate ?? assumptions?.financing?.interestRate ?? 0.07;
  const annualDebtService = loanAmount * interestRate;

  const depreciableBase = purchasePrice * (1 - LAND_VALUE_PCT);
  const rentGrowth = (f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03);

  const taxYears = useMemo(() => buildTaxYears(
    noi_y1, annualDebtService, depreciableBase, depreciableLife, holdYears, rentGrowth, 0.025,
  ), [noi_y1, annualDebtService, depreciableBase, depreciableLife, holdYears, rentGrowth]);

  const totalBtcf = taxYears.reduce((s, r) => s + r.btcf, 0);
  const totalAtcf = taxYears.reduce((s, r) => s + r.atcf, 0);
  const totalTaxPaid = taxYears.reduce((s, r) => s + r.totalTax, 0);
  const avgEffRate = totalBtcf !== 0 ? totalTaxPaid / Math.abs(totalBtcf) : 0;
  const totalDepreciation = taxYears.reduce((s, r) => s + r.depreciation, 0);
  const cumulDeprec = taxYears[taxYears.length - 1]?.cumulDepreciation ?? 0;

  const exitTax = useMemo(() => computeExitTax(
    exitSalePrice, purchasePrice, cumulDeprec, sellingCostsPct, loanAmount,
  ), [exitSalePrice, purchasePrice, cumulDeprec, sellingCostsPct, loanAmount]);

  const colorBtcf  = (v: number) => v >= 0 ? BT.met.financial : BT.text.red;
  const colorAtcf  = (v: number) => v >= 0 ? BT.text.cyan : BT.text.red;

  interface TaxRowDef {
    key: string;
    label: string;
    color: string;
    getValue: (r: TaxYear) => number;
    isTotal: boolean;
    bold?: boolean;
    isPct?: boolean;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header bar */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>AFTER-TAX CASH FLOW · DEPRECIATION SHIELD · EXIT TAX</span>
        <Bd c={BT.text.amber}>TAX ANALYSIS</Bd>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['residential', 'commercial'] as const).map(t => (
            <button key={t} onClick={() => setAssetType(t)} style={{
              background: assetType === t ? `${BT.text.amber}20` : 'transparent',
              border: `1px solid ${assetType === t ? BT.text.amber : BT.border.medium}`,
              color: assetType === t ? BT.text.amber : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
            }}>{t} ({t === 'residential' ? '27.5yr' : '39yr'})</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL BTCF" value={totalBtcf !== 0 ? fmt$(totalBtcf) : '—'} color={colorBtcf(totalBtcf)} />
        <KpiTile label="TOTAL TAX PAID" value={totalTaxPaid > 0 ? fmt$(totalTaxPaid) : '—'} color={BT.text.red} />
        <KpiTile label="TOTAL ATCF" value={totalAtcf !== 0 ? fmt$(totalAtcf) : '—'} color={colorAtcf(totalAtcf)} />
        <KpiTile label="AVG EFF RATE" value={avgEffRate > 0 ? fmtPct(avgEffRate * 100) : '—'} color={BT.text.amber} />
        <KpiTile label="DEPREC SHIELD" value={totalDepreciation > 0 ? fmt$(totalDepreciation * FED_ORDINARY_RATE) : '—'} color={BT.met.financial} />
      </div>

      {/* Assumptions strip */}
      <div style={{ padding: '4px 10px', background: `${BT.text.amber}08`, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TAX ASSUMPTIONS ▸</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>ORDINARY {fmtPct(FED_ORDINARY_RATE * 100)} FED</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>LTCG {fmtPct(FED_LTCG_RATE * 100)}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>RECAPTURE {fmtPct(FED_DEPREC_RECAPTURE * 100)}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>NIIT {fmtPct(NIIT_RATE * 100)}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>STATE {fmtPct(STATE_RATE * 100)}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>DEPREC BASE {fmt$(depreciableBase)} ({fmtPct((1 - LAND_VALUE_PCT) * 100)} of PP)</span>
      </div>

      {/* Per-year table */}
      <div style={{ overflowX: 'auto', background: BT.bg.panel }}>
        <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>PER-YEAR TAX BRIDGE · BTCF → ATCF</span>
          <button onClick={() => setShowDetail(!showDetail)} style={{
            background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
            fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
          }}>{showDetail ? 'COMPACT' : 'DETAIL'}</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
              <th style={{ padding: '4px 8px', color: BT.text.muted, textAlign: 'left', fontWeight: 500, minWidth: 140 }}>ROW</th>
              {taxYears.map(r => (
                <th key={r.year} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: 'right', fontWeight: 500, minWidth: 90 }}>Y{r.year}</th>
              ))}
              <th style={{ padding: '4px 8px', color: BT.text.muted, textAlign: 'right', fontWeight: 700 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {((): TaxRowDef[] => {
              const base: TaxRowDef[] = [
                { key: 'noi',  label: 'NOI',              color: BT.met.financial, getValue: (r: TaxYear) => r.noi,          isTotal: false },
                { key: 'ds',   label: '(–) DEBT SERVICE', color: BT.text.red,      getValue: (r: TaxYear) => -r.debtService, isTotal: false },
                { key: 'btcf', label: 'BTCF',             color: BT.met.financial, getValue: (r: TaxYear) => r.btcf,         isTotal: true, bold: true },
              ];
              const detail: TaxRowDef[] = showDetail ? [
                { key: 'deprec',   label: '(–) DEPRECIATION', color: BT.text.purple, getValue: (r: TaxYear) => -r.depreciation,  isTotal: false },
                { key: 'taxable',  label: 'TAXABLE INCOME',   color: BT.text.amber,  getValue: (r: TaxYear) => r.taxableIncome,  isTotal: false },
                { key: 'fedTax',   label: '(–) FED TAX',      color: BT.text.red,    getValue: (r: TaxYear) => -r.taxOrdinary,   isTotal: false },
                { key: 'niitTax',  label: '(–) NIIT',         color: BT.text.red,    getValue: (r: TaxYear) => -r.taxNIIT,       isTotal: false },
                { key: 'stateTax', label: '(–) STATE TAX',    color: BT.text.red,    getValue: (r: TaxYear) => -r.taxState,      isTotal: false },
              ] : [];
              const tail: TaxRowDef[] = [
                { key: 'totalTax',     label: '(–) TOTAL TAX',  color: BT.text.red,    getValue: (r: TaxYear) => -r.totalTax,          isTotal: false },
                { key: 'atcf',         label: 'ATCF',            color: BT.text.cyan,   getValue: (r: TaxYear) => r.atcf,               isTotal: true, bold: true },
                { key: 'effRate',      label: 'EFF TAX RATE',    color: BT.text.amber,  getValue: (r: TaxYear) => r.effectiveRate,       isTotal: false, isPct: true },
                { key: 'cumulDeprecC', label: 'CUMUL DEPREC',    color: BT.text.purple, getValue: (r: TaxYear) => r.cumulDepreciation,   isTotal: false },
              ];
              return [...base, ...detail, ...tail];
            })().map((def: TaxRowDef) => {
              const totVal = def.isPct ? null : taxYears.reduce((s, r) => s + def.getValue(r), 0);
              return (
                <tr key={def.key} style={{
                  background: def.isTotal ? `${def.color}10` : 'transparent',
                  borderTop: def.isTotal ? `1px solid ${BT.border.medium}` : 'none',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  <td style={{ padding: '3px 8px', color: def.color, fontWeight: def.bold ? 700 : 400 }}>{def.label}</td>
                  {taxYears.map(r => {
                    const v = def.getValue(r);
                    return (
                      <td key={r.year} style={{ padding: '3px 8px', color: def.isPct ? def.color : (v < 0 ? BT.text.red : v > 0 ? def.color : BT.text.muted), textAlign: 'right', fontWeight: def.bold ? 700 : 400 }}>
                        {def.isPct ? fmtPct(v * 100) : (v === 0 ? '—' : fmt$(v))}
                      </td>
                    );
                  })}
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: def.isPct ? BT.text.muted : (totVal !== null && totVal < 0 ? BT.text.red : def.color), fontWeight: 700 }}>
                    {def.isPct ? '—' : (totVal === null ? '—' : totVal === 0 ? '—' : fmt$(totVal))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Exit tax section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <SectionPanel title="EXIT TAX COMPUTATION" subtitle={`At sale — Year ${holdYears}`} borderColor={BT.text.red}>
          <DataRow label="GROSS SALE PRICE" value={exitTax.grossSalePrice > 0 ? fmt$(exitTax.grossSalePrice) : '—'} valueColor={BT.text.white} />
          <DataRow label="(–) SELLING COSTS" value={exitTax.grossSalePrice > 0 ? fmt$(exitTax.grossSalePrice * sellingCostsPct) : '—'} valueColor={BT.text.red} />
          <DataRow label="ADJUSTED BASIS" value={exitTax.adjustedBasis > 0 ? fmt$(exitTax.adjustedBasis) : '—'} valueColor={BT.text.secondary} sub={`Cost ${fmt$(purchasePrice)} less ${fmt$(cumulDeprec)} deprec`} />
          <DataRow label="TOTAL GAIN" value={exitTax.totalGain > 0 ? fmt$(exitTax.totalGain) : '—'} valueColor={BT.text.amber} />
          <DataRow label="DEPREC RECAPTURE GAIN" value={exitTax.deprecRecaptureGain > 0 ? fmt$(exitTax.deprecRecaptureGain) : '—'} valueColor={BT.text.orange} sub={`Taxed at ${fmtPct(FED_DEPREC_RECAPTURE * 100)} unrecaptured §1250`} />
          <DataRow label="LTCG GAIN" value={exitTax.ltcgGain > 0 ? fmt$(exitTax.ltcgGain) : '—'} valueColor={BT.text.cyan} sub={`Taxed at ${fmtPct(FED_LTCG_RATE * 100)}`} border={false} />
        </SectionPanel>

        <SectionPanel title="EXIT TAX BREAKDOWN" subtitle="Federal + State + NIIT" borderColor={BT.text.red}>
          <DataRow label="DEPREC RECAPTURE TAX" value={exitTax.deprecRecaptureTax > 0 ? fmt$(exitTax.deprecRecaptureTax) : '—'} valueColor={BT.text.orange} />
          <DataRow label="LTCG TAX" value={exitTax.ltcgTax > 0 ? fmt$(exitTax.ltcgTax) : '—'} valueColor={BT.text.amber} />
          <DataRow label="NIIT (3.8%)" value={exitTax.niitTax > 0 ? fmt$(exitTax.niitTax) : '—'} valueColor={BT.text.cyan} />
          <DataRow label="STATE TAX" value={exitTax.stateTax > 0 ? fmt$(exitTax.stateTax) : '—'} valueColor={BT.text.secondary} />
          <DataRow label="TOTAL EXIT TAX" value={exitTax.totalExitTax > 0 ? fmt$(exitTax.totalExitTax) : '—'} valueColor={BT.text.red} />
          <DataRow label="NET AFTER-TAX PROCEEDS" value={exitTax.netSaleProceeds > 0 ? fmt$(exitTax.netSaleProceeds) : '—'} valueColor={BT.text.cyan} sub="After loan payoff + all taxes" border={false} />
        </SectionPanel>
      </div>

      {/* Depreciation schedule */}
      <SectionPanel title="DEPRECIATION SCHEDULE" subtitle={`Straight-line over ${depreciableLife} years`} borderColor={BT.text.purple}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                {['YEAR', 'ANNUAL DEPREC', 'CUMUL DEPREC', 'BOOK VALUE', 'TAX SHIELD', 'CUMUL SHIELD'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'YEAR' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taxYears.map((r, i) => {
                const bookValue = Math.max(0, depreciableBase - r.cumulDepreciation);
                const annualShield = r.depreciation * FED_ORDINARY_RATE;
                const cumulShield = r.cumulDepreciation * FED_ORDINARY_RATE;
                return (
                  <tr key={r.year} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary }}>Y{r.year}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.purple, textAlign: 'right' }}>{fmt$(r.depreciation)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{fmt$(r.cumulDepreciation)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.amber, textAlign: 'right' }}>{fmt$(bookValue)}</td>
                    <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(annualShield)}</td>
                    <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(cumulShield)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {/* Disclaimer */}
      <div style={{ padding: '6px 10px', background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          TAX ESTIMATES ARE ILLUSTRATIVE ONLY. Assumes maximum federal rates, {fmtPct(STATE_RATE * 100)} flat state rate, and {fmtPct(LAND_VALUE_PCT * 100)} land value exclusion. Consult a CPA for actual liability.
        </span>
      </div>
    </div>
  );
}

export default TaxesTab;
