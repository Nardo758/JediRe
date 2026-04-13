import React, { useState, useCallback, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

const MONO = BT.font.mono;

// ─── PATCH helper ────────────────────────────────────────────────────────────
async function patchWf(dealId: string, key: string, value: number | string | null): Promise<void> {
  if (typeof value === 'string') {
    await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
      field: `wf:${key}`, year: null, value: null, strValue: value,
    });
  } else {
    await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
      field: `wf:${key}`, year: null, value,
    });
  }
}

// ─── Inline editable number cell ─────────────────────────────────────────────
function EditNum({ value, onCommit, pct, suffix }: {
  value: number; onCommit: (v: number) => void; pct?: boolean; suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const display = pct
    ? `${(value * 100).toFixed(2)}%`
    : suffix
      ? `${value}${suffix}`
      : fmt$(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseFloat(draft.replace(/[^0-9.-]/g, ''));
          if (!isNaN(n)) onCommit(pct ? n / 100 : n);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const n = parseFloat(draft.replace(/[^0-9.-]/g, ''));
            if (!isNaN(n)) onCommit(pct ? n / 100 : n);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}`,
          color: BT.text.amber, fontFamily: MONO, fontSize: 9,
          width: 70, padding: '1px 4px', textAlign: 'right', borderRadius: 2,
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(pct ? (value * 100).toFixed(2) : String(value)); setEditing(true); }}
      title="Click to edit"
      style={{
        fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600,
        cursor: 'pointer', borderBottom: `1px dashed ${BT.text.amber}66`, textAlign: 'right',
      }}
    >
      {display}
    </span>
  );
}

// ─── Waterfall engine types ───────────────────────────────────────────────────
interface WfTier {
  triggerIrr: number;  // IRR hurdle (decimal)
  lpPct: number;       // LP share above this tier
  gpPct: number;       // GP promote above this tier
}

interface WfFees {
  acquisitionFeePct: number;
  assetMgmtFeePct: number;
  assetMgmtBasis: string;
  constructionMgmtPct: number;
  dispositionFeePct: number;
  refinancingFeePct: number;
}

interface DistRow {
  year: number;
  label: string;
  cfads: number;      // Cash flow available for distribution
  activeTier: string;
  lpDist: number;
  gpDist: number;
  gpPromote: number;
  gpFees: number;
  lpIrrToDate: number | null;
  lpEmToDate: number | null;
  prefAccrued: number;
  prefPaid: number;
  isPromoteCrystallize: boolean;
}

// ─── Simple IRR Newton-Raphson ────────────────────────────────────────────────
function calcIrr(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0; let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const disc = Math.pow(1 + rate, t);
      npv  += cashFlows[t] / disc;
      dnpv -= t * cashFlows[t] / (disc * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-8) { rate = newRate; break; }
    rate = newRate;
    if (rate < -0.999 || rate > 10) return null;
  }
  return rate;
}

// ─── American waterfall distribution engine ───────────────────────────────────
function runAmericanWaterfall(
  equity: number,
  lpShare: number,
  gpShare: number,
  prefRate: number,
  tiers: WfTier[],
  annualCfads: number[],  // [yr1, yr2, ..., yrN, exitProceeds] (net of debt service)
  exitProceeds: number,
  fees: WfFees,
  equityBase: number,     // for asset mgmt fee basis
  egi_yr1: number,        // for asset mgmt fee if basis=EGI
): DistRow[] {
  const holdYears = annualCfads.length - 1; // last is exit
  const lpEquity = equity * lpShare;
  const gpEquity = equity * gpShare;

  let lpPrefAccrued = 0;
  let lpRocPaid = 0;
  let lpDistCumulative = 0;
  let gpDistCumulative = 0;
  let gpPromoteCumulative = 0;

  const rows: DistRow[] = [];
  const lpCashFlows: number[] = [-lpEquity];
  const gpCashFlows: number[] = [-gpEquity];

  // Acquisition fee charged at close (year 0)
  const acqFee = equity * fees.acquisitionFeePct;
  gpDistCumulative += acqFee;
  gpCashFlows[0] = -gpEquity + acqFee;

  for (let yr = 1; yr <= holdYears + 1; yr++) {
    const isExit = yr === holdYears + 1;
    const rawCf = isExit ? exitProceeds : (annualCfads[yr - 1] ?? 0);

    // Asset mgmt fee
    const amFeeBase = fees.assetMgmtBasis === 'equity' ? equityBase : egi_yr1;
    const gpFeeThisYr = !isExit ? amFeeBase * fees.assetMgmtFeePct : 0;
    const disposFee = isExit ? rawCf * fees.dispositionFeePct : 0;
    const gpFees = gpFeeThisYr + disposFee;

    let cfads = rawCf - gpFees;

    // ── LP Pref Return ──────────────────────────────────────────────────────
    lpPrefAccrued += lpEquity * prefRate;
    const prefToLP = Math.min(Math.max(cfads, 0), lpPrefAccrued);
    cfads -= prefToLP;
    lpPrefAccrued -= prefToLP;

    // ── Return of Capital (American style — each period) ────────────────────
    const rocToLP = Math.min(Math.max(cfads, 0), Math.max(lpEquity - lpRocPaid, 0));
    cfads -= rocToLP;
    lpRocPaid += rocToLP;

    // ── Remaining CFADS split by active tier ───────────────────────────────
    let lpDist = prefToLP + rocToLP;
    let gpDist = gpFees;
    let gpPromote = 0;

    let remaining = Math.max(cfads, 0);

    // Determine current tier by LP IRR to date
    const lpCfSoFar = [...lpCashFlows];
    const irr = calcIrr(lpCfSoFar);
    const currentIrr = irr ?? 0;

    const activeTierIdx = tiers.findIndex((t, i) =>
      i === tiers.length - 1 || currentIrr < tiers[i + 1].triggerIrr
    );
    const activeTier = tiers[activeTierIdx] ?? tiers[tiers.length - 1] ?? { lpPct: 0.8, gpPct: 0.2, triggerIrr: 0 };

    const lpSplit = activeTier.lpPct;
    const gpSplit = activeTier.gpPct;

    const lpAbove = remaining * lpSplit;
    const gpAbove = remaining * gpSplit;
    gpPromote = gpAbove;
    lpDist += lpAbove;
    gpDist += gpAbove;
    gpPromoteCumulative += gpPromote;
    remaining = 0;

    lpDistCumulative += lpDist;
    gpDistCumulative += gpDist;
    lpCashFlows.push(lpDist);
    gpCashFlows.push(gpDist);

    const lpIrrToDate = lpCashFlows.length > 1 ? calcIrr(lpCashFlows) : null;
    const lpEmToDate = lpDistCumulative / Math.max(lpEquity, 1);

    rows.push({
      year: yr,
      label: isExit ? `EXIT` : `YR ${yr}`,
      cfads: rawCf,
      activeTier: `TIER ${activeTierIdx + 1} · ${(activeTier.lpPct * 100).toFixed(0)}/${(activeTier.gpPct * 100).toFixed(0)}`,
      lpDist, gpDist, gpPromote, gpFees,
      lpIrrToDate: lpIrrToDate,
      lpEmToDate,
      prefAccrued: lpPrefAccrued + prefToLP,
      prefPaid: prefToLP,
      isPromoteCrystallize: isExit && gpPromote > 0,
    });
  }

  return rows;
}

// ─── WaterfallTab v2 ──────────────────────────────────────────────────────────
export function WaterfallTab({ dealId, assumptions, modelResults, f9Financials, onF9Refresh }: FinancialEngineTabProps) {
  const [activePanel, setActivePanel] = useState<'config' | 'schedule'>('config');

  const wf = f9Financials?.waterfall ?? null;
  const cs = f9Financials?.capitalStack;

  // ── Capital / equity seed values ───────────────────────────────────────────
  const purchasePrice = cs?.purchasePrice ?? assumptions?.acquisition?.purchasePrice ?? 0;
  const loanAmount    = cs?.loanAmount ?? assumptions?.financing?.loanAmount ?? 0;
  const equity        = cs?.equityAtClose ?? Math.max(purchasePrice - loanAmount, 0);
  const holdYears     = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;
  const interestRate  = cs?.interestRate ?? assumptions?.financing?.interestRate ?? 0.07;
  const annualDS      = loanAmount * interestRate;
  const totalUnits    = f9Financials?.totalUnits ?? 0;

  // NOI seed — Y1 from f9 or assumptions
  const f9Noi = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? null;
  const noi_y1 = f9Noi ?? modelResults?.summary?.noi ?? 0;
  const egi_y1 = f9Financials?.proforma?.year1?.find(r => r.field === 'egi')?.resolved ?? noi_y1 * 1.15;
  const rentGrowth = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const exitCap = f9Financials?.assumptions?.exitCap ?? assumptions?.disposition?.exitCapRate ?? 0.055;
  const sellingCostsPct = assumptions?.disposition?.sellingCosts ?? 0.025;

  // ── Local override state ───────────────────────────────────────────────────
  const [lpShare,   setLpShare]   = useState<number>(wf?.lpShare  ?? 0.9);
  const [gpShare,   setGpShare]   = useState<number>(wf?.gpShare  ?? 0.1);
  const [prefRate,  setPrefRate]  = useState<number>(wf?.prefRate ?? 0.08);
  const [wfType,    setWfType]    = useState<string>(wf?.waterfallType ?? 'american');
  const [tiers,     setTiers]     = useState<WfTier[]>(wf?.tiers ?? [
    { triggerIrr: 0.08, lpPct: 0.80, gpPct: 0.20 },
    { triggerIrr: 0.12, lpPct: 0.70, gpPct: 0.30 },
    { triggerIrr: 0.15, lpPct: 0.60, gpPct: 0.40 },
  ]);
  const [fees, setFees] = useState<WfFees>(wf?.fees ?? {
    acquisitionFeePct: 0.01,
    assetMgmtFeePct: 0.015,
    assetMgmtBasis: 'equity',
    constructionMgmtPct: 0,
    dispositionFeePct: 0.01,
    refinancingFeePct: 0,
  });

  // Sync from backend when f9Financials updates
  React.useEffect(() => {
    if (wf) {
      setLpShare(wf.lpShare);
      setGpShare(wf.gpShare);
      setPrefRate(wf.prefRate);
      setWfType(wf.waterfallType);
      setTiers(wf.tiers);
      setFees(wf.fees as WfFees);
    }
  }, [wf?.lpShare, wf?.gpShare, wf?.prefRate, wf?.waterfallType]);

  // ── PATCH helpers ──────────────────────────────────────────────────────────
  const patch = useCallback(async (key: string, value: number | string | null) => {
    await patchWf(dealId, key, value);
    onF9Refresh?.();
  }, [dealId, onF9Refresh]);

  // ── Build NOI projection for each hold year (simple growth model) ──────────
  const annualCfads = useMemo((): number[] => {
    const cfads: number[] = [];
    for (let yr = 1; yr <= holdYears; yr++) {
      const noiYr = noi_y1 * Math.pow(1 + rentGrowth, yr - 1);
      cfads.push(Math.max(noiYr - annualDS, 0));
    }
    // Exit proceeds
    const exitNOI = noi_y1 * Math.pow(1 + rentGrowth, holdYears);
    const grossSale = exitCap > 0 ? exitNOI / exitCap : 0;
    const netSale = grossSale * (1 - sellingCostsPct) - loanAmount;
    cfads.push(Math.max(netSale, 0));
    return cfads;
  }, [noi_y1, holdYears, rentGrowth, annualDS, exitCap, sellingCostsPct, loanAmount]);

  // Exit proceeds is last element
  const exitProceeds = annualCfads[annualCfads.length - 1] ?? 0;
  const annualOnly   = annualCfads.slice(0, -1);

  // ── Run waterfall engine ───────────────────────────────────────────────────
  const distRows = useMemo((): DistRow[] => {
    if (equity <= 0) return [];
    return runAmericanWaterfall(
      equity, lpShare, gpShare, prefRate, tiers,
      annualOnly, exitProceeds, fees, equity, egi_y1
    );
  }, [equity, lpShare, gpShare, prefRate, tiers, annualOnly, exitProceeds, fees, egi_y1]);

  // ── Summary KPIs ───────────────────────────────────────────────────────────
  const totalLP       = distRows.reduce((s, r) => s + r.lpDist, 0);
  const totalGP       = distRows.reduce((s, r) => s + r.gpDist, 0);
  const totalPromote  = distRows.reduce((s, r) => s + r.gpPromote, 0);
  const totalFees     = distRows.reduce((s, r) => s + r.gpFees, 0);
  const lpEquity      = equity * lpShare;
  const gpEquity      = equity * gpShare;
  const lpEm          = lpEquity > 0 ? totalLP / lpEquity : null;
  const gpEm          = gpEquity > 0 ? (totalGP + (equity * fees.acquisitionFeePct)) / Math.max(gpEquity, 1) : null;
  const lpCashFlows   = [-lpEquity, ...distRows.map(r => r.lpDist)];
  const lpIrr         = calcIrr(lpCashFlows);
  const gpCashFlows   = [-gpEquity + equity * fees.acquisitionFeePct, ...distRows.map(r => r.gpDist)];
  const gpIrr         = calcIrr(gpCashFlows);
  const lastRow       = distRows[distRows.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>LP/GP EQUITY SPLIT · PROMOTE TIERS · DISTRIBUTIONS</span>
        <Bd c={BT.text.purple}>CAP & WATERFALL</Bd>
        {equity > 0 && <Bd c={BT.text.cyan}>{fmt$(equity)} EQUITY</Bd>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['config', 'schedule'] as const).map(v => (
            <button key={v} onClick={() => setActivePanel(v)} style={{
              background: activePanel === v ? `${BT.text.purple}20` : 'transparent',
              border: `1px solid ${activePanel === v ? BT.text.purple : BT.border.medium}`,
              color: activePanel === v ? BT.text.purple : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer',
              borderRadius: 2, textTransform: 'uppercase',
            }}>{v === 'config' ? 'CONFIG' : 'SCHEDULE'}</button>
          ))}
        </div>
      </div>

      {/* ── Hero KPI strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <KpiTile label="LP IRR"            value={lpIrr != null ? fmtPct(lpIrr * 100) : '—'}   color={lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber} />
        <KpiTile label="LP EQUITY MULT"    value={lpEm  != null ? fmtX(lpEm)          : '—'}   color={lpEm  != null && lpEm  >= 1.8   ? BT.met.financial : BT.text.amber} />
        <KpiTile label="GP ALL-IN MULT"    value={gpEm  != null ? fmtX(gpEm)          : '—'}   color={BT.text.orange} />
        <KpiTile label="TOTAL LP DIST"     value={totalLP > 0    ? fmt$(totalLP)       : '—'}   color={BT.text.cyan} />
        <KpiTile label="TOTAL GP PROMOTE"  value={totalPromote > 0 ? fmt$(totalPromote) : '—'} color={BT.text.amber} />
      </div>

      {activePanel === 'config' ? (
        <>
          {/* ── Equity Tranches panel ────────────────────────────────────────── */}
          <SectionPanel title="EQUITY TRANCHES" subtitle="LP / GP capital structure at close" borderColor={BT.met.financial}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {/* LP Tranche */}
              <div style={{ padding: '6px 8px', background: `${BT.met.financial}08`, borderRight: `1px solid ${BT.border.subtle}` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700, marginBottom: 4 }}>LP CLASS A</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>CONTRIBUTION</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white }}>{equity > 0 ? fmt$(equity * lpShare) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>% OF EQUITY</span>
                  <EditNum value={lpShare} pct onCommit={v => {
                    const clamped = Math.min(Math.max(v, 0.01), 0.99);
                    setLpShare(clamped); setGpShare(+(1 - clamped).toFixed(4));
                    patch('lpShare', clamped); patch('gpShare', +(1 - clamped).toFixed(4));
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PREF RETURN</span>
                  <EditNum value={prefRate} pct onCommit={v => { setPrefRate(v); patch('prefRate', v); }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>COMPOUNDING</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>CUMULATIVE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PARTICIPATES IN PROMOTE</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial }}>YES</span>
                </div>
              </div>
              {/* GP Tranche */}
              <div style={{ padding: '6px 8px', background: `${BT.text.orange}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.orange, fontWeight: 700, marginBottom: 4 }}>GP CO-INVEST</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>CONTRIBUTION</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white }}>{equity > 0 ? fmt$(equity * gpShare) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>% OF EQUITY</span>
                  <EditNum value={gpShare} pct onCommit={v => {
                    const clamped = Math.min(Math.max(v, 0.01), 0.99);
                    setGpShare(clamped); setLpShare(+(1 - clamped).toFixed(4));
                    patch('gpShare', clamped); patch('lpShare', +(1 - clamped).toFixed(4));
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PREF RETURN</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>NONE</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>COMPOUNDING</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>N/A</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>RECEIVES PROMOTE</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.orange }}>YES</span>
                </div>
              </div>
            </div>

            {/* Capital stack visual bar */}
            {equity > 0 && (
              <div style={{ padding: '8px 10px', borderTop: `1px solid ${BT.border.subtle}` }}>
                <div style={{ display: 'flex', gap: 2, height: 16, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ flex: loanAmount / Math.max(purchasePrice, 1), background: BT.text.cyan, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>DEBT {fmtPct((loanAmount / Math.max(purchasePrice, 1)) * 100)}</span>
                  </div>
                  <div style={{ flex: (equity * lpShare) / Math.max(purchasePrice, 1), background: BT.met.financial, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>LP {fmtPct(lpShare * 100)}</span>
                  </div>
                  <div style={{ flex: (equity * gpShare) / Math.max(purchasePrice, 1), background: BT.text.orange, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 20 }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>GP {fmtPct(gpShare * 100)}</span>
                  </div>
                </div>
              </div>
            )}
          </SectionPanel>

          {/* ── Waterfall Config panel ──────────────────────────────────────── */}
          <SectionPanel title="WATERFALL CONFIG" subtitle="Promote tier structure · profit split by hurdle" borderColor={BT.text.purple}>
            {/* American / European toggle */}
            <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>TYPE</span>
              {(['american', 'european'] as const).map(t => (
                <button key={t} onClick={() => { setWfType(t); patch('waterfallType', t); }} style={{
                  background: wfType === t ? `${BT.text.purple}25` : 'transparent',
                  border: `1px solid ${wfType === t ? BT.text.purple : BT.border.medium}`,
                  color: wfType === t ? BT.text.purple : BT.text.muted,
                  fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
                }}>{t}</button>
              ))}
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                {wfType === 'american' ? '· Distributions per period before promote' : '· Promote crystallizes at fund end'}
              </span>
            </div>

            {/* Tier table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                    {['TIER', 'TRIGGER IRR', 'LP %', 'GP PROMOTE %', ''].map(h => (
                      <th key={h} style={{ padding: '3px 8px', color: BT.text.muted, textAlign: h === 'TIER' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 8px', color: BT.text.purple, fontWeight: 700 }}>TIER {i + 1}</td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        <EditNum value={tier.triggerIrr} pct onCommit={v => {
                          const next = tiers.map((t, j) => j === i ? { ...t, triggerIrr: v } : t);
                          setTiers(next);
                          patch(`tier${i}TriggerIrr`, v);
                        }} />
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        <EditNum value={tier.lpPct} pct onCommit={v => {
                          const gp = +(1 - v).toFixed(4);
                          const next = tiers.map((t, j) => j === i ? { ...t, lpPct: v, gpPct: gp } : t);
                          setTiers(next);
                          patch(`tier${i}LpPct`, v);
                          patch(`tier${i}GpPct`, gp);
                        }} />
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        <EditNum value={tier.gpPct} pct onCommit={v => {
                          const lp = +(1 - v).toFixed(4);
                          const next = tiers.map((t, j) => j === i ? { ...t, gpPct: v, lpPct: lp } : t);
                          setTiers(next);
                          patch(`tier${i}GpPct`, v);
                          patch(`tier${i}LpPct`, lp);
                        }} />
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        {tiers.length > 1 && (
                          <button onClick={() => {
                            const next = tiers.filter((_, j) => j !== i);
                            setTiers(next);
                          }} style={{
                            background: 'transparent', border: `1px solid ${BT.border.medium}`,
                            color: BT.text.red, fontFamily: MONO, fontSize: 8,
                            padding: '1px 5px', cursor: 'pointer', borderRadius: 2,
                          }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
              <button onClick={() => {
                const lastTier = tiers[tiers.length - 1];
                setTiers([...tiers, {
                  triggerIrr: Math.min((lastTier?.triggerIrr ?? 0.15) + 0.05, 0.5),
                  lpPct: Math.max((lastTier?.lpPct ?? 0.60) - 0.10, 0.10),
                  gpPct: Math.min((lastTier?.gpPct ?? 0.40) + 0.10, 0.90),
                }]);
              }} style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`,
                color: BT.text.muted, fontFamily: MONO, fontSize: 8,
                padding: '2px 10px', cursor: 'pointer', borderRadius: 2,
              }}>+ ADD TIER</button>
            </div>
          </SectionPanel>

          {/* ── Fee Modeling panel ──────────────────────────────────────────── */}
          <SectionPanel title="FEE MODELING" subtitle="GP compensation & deal economics" borderColor={BT.text.amber}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {[
                { label: 'ACQUISITION FEE',      key: 'acquisitionFeePct',   value: fees.acquisitionFeePct,   basis: `${fmt$(equity * fees.acquisitionFeePct)} at close` },
                { label: 'ASSET MGMT FEE (PA)',   key: 'assetMgmtFeePct',     value: fees.assetMgmtFeePct,     basis: `Basis: ${fees.assetMgmtBasis.toUpperCase()} · ${fmt$((fees.assetMgmtBasis === 'equity' ? equity : egi_y1) * fees.assetMgmtFeePct)}/yr` },
                { label: 'CONSTRUCTION MGMT',     key: 'constructionMgmtPct', value: fees.constructionMgmtPct, basis: fees.constructionMgmtPct > 0 ? fmt$(equity * fees.constructionMgmtPct) : 'Not applicable' },
                { label: 'DISPOSITION FEE',       key: 'dispositionFeePct',   value: fees.dispositionFeePct,   basis: 'Of gross sale price' },
                { label: 'REFINANCING FEE',       key: 'refinancingFeePct',   value: fees.refinancingFeePct,   basis: 'Of refi loan amount' },
              ].map(({ label, key, value, basis }) => (
                <div key={key} style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{basis}</div>
                  </div>
                  <EditNum value={value} pct onCommit={v => {
                    setFees(prev => ({ ...prev, [key]: v }));
                    patch(key, v);
                  }} />
                </div>
              ))}
              {/* Asset mgmt fee basis toggle */}
              <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600 }}>ASSET MGMT BASIS</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>Equity or EGI</div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['equity', 'egi'].map(b => (
                    <button key={b} onClick={() => {
                      setFees(prev => ({ ...prev, assetMgmtBasis: b }));
                      patch('assetMgmtBasis', b);
                    }} style={{
                      background: fees.assetMgmtBasis === b ? `${BT.text.amber}25` : 'transparent',
                      border: `1px solid ${fees.assetMgmtBasis === b ? BT.text.amber : BT.border.medium}`,
                      color: fees.assetMgmtBasis === b ? BT.text.amber : BT.text.muted,
                      fontFamily: MONO, fontSize: 8, padding: '2px 6px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
                    }}>{b}</button>
                  ))}
                </div>
              </div>
            </div>
          </SectionPanel>

          {/* ── Returns summary ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="LP RETURN SUMMARY" subtitle="By investor class" borderColor={BT.met.financial}>
              <DataRow label="LP EQUITY"           value={fmt$(equity * lpShare)}                                   valueColor={BT.met.financial} />
              <DataRow label="TOTAL LP DIST"        value={totalLP > 0 ? fmt$(totalLP) : '—'}                       valueColor={BT.text.cyan} />
              <DataRow label="LP EQUITY MULTIPLE"   value={lpEm != null ? fmtX(lpEm) : '—'}                         valueColor={lpEm != null && lpEm >= 1.8 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP IRR"                value={lpIrr != null ? fmtPct(lpIrr * 100) : '—'}              valueColor={lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber} />
              <DataRow label="PREF RATE"             value={fmtPct(prefRate * 100)}                                  valueColor={BT.text.amber} border={false} />
            </SectionPanel>
            <SectionPanel title="GP RETURN SUMMARY" subtitle="Promote + fees" borderColor={BT.text.orange}>
              <DataRow label="GP EQUITY"             value={fmt$(equity * gpShare)}                                  valueColor={BT.text.orange} />
              <DataRow label="GP TOTAL DIST"         value={totalGP > 0 ? fmt$(totalGP) : '—'}                      valueColor={BT.text.amber} />
              <DataRow label="GP PROMOTE"            value={totalPromote > 0 ? fmt$(totalPromote) : '—'}             valueColor={BT.text.orange} />
              <DataRow label="GP ALL-IN FEES"        value={totalFees > 0 ? fmt$(totalFees) : '—'}                  valueColor={BT.text.red} />
              <DataRow label="GP ALL-IN MULTIPLE"    value={gpEm != null ? fmtX(gpEm) : '—'}                        valueColor={BT.text.orange} border={false} />
            </SectionPanel>
          </div>
        </>
      ) : (
        <>
          {/* ── Distribution Schedule ────────────────────────────────────────── */}
          <SectionPanel title="DISTRIBUTION SCHEDULE" subtitle={`${holdYears}-year hold · ${wfType.toUpperCase()} waterfall · ${fmtPct(prefRate * 100)} pref`} borderColor={BT.text.purple}>
            {distRows.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
                Configure equity and NOI assumptions to generate distribution schedule
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
                  <thead>
                    <tr style={{ background: BT.bg.header, borderBottom: `2px solid ${BT.border.medium}` }}>
                      {['PERIOD', 'CFADS', 'ACTIVE TIER', 'LP DIST', 'GP DIST', 'GP PROMOTE', 'GP FEES', 'PREF PAID', 'LP IRR', 'LP EM'].map(h => (
                        <th key={h} style={{
                          padding: '3px 6px', color: BT.text.muted, fontWeight: 600,
                          textAlign: h === 'PERIOD' || h === 'ACTIVE TIER' ? 'left' : 'right',
                          whiteSpace: 'nowrap', position: 'sticky', top: 0, background: BT.bg.header,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distRows.map((row, i) => (
                      <tr key={i} style={{
                        background: row.isPromoteCrystallize
                          ? `${BT.text.amber}12`
                          : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                        borderBottom: `1px solid ${BT.border.subtle}`,
                      }}>
                        <td style={{ padding: '3px 6px', color: row.isPromoteCrystallize ? BT.text.amber : BT.text.cyan, fontWeight: row.isPromoteCrystallize ? 700 : 400 }}>
                          {row.label}{row.isPromoteCrystallize ? ' ★' : ''}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.white }}>{row.cfads > 0 ? fmt$(row.cfads) : '—'}</td>
                        <td style={{ padding: '3px 6px', color: BT.text.purple }}>{row.activeTier}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.cyan, fontWeight: 600 }}>{row.lpDist > 0 ? fmt$(row.lpDist) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.orange }}>{row.gpDist > 0 ? fmt$(row.gpDist) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: row.gpPromote > 0 ? BT.text.amber : BT.text.muted }}>{row.gpPromote > 0 ? fmt$(row.gpPromote) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.red }}>{row.gpFees > 0 ? fmt$(row.gpFees) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.met.financial }}>{row.prefPaid > 0 ? fmt$(row.prefPaid) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: row.lpIrrToDate != null && row.lpIrrToDate >= 0.08 ? BT.met.financial : BT.text.amber }}>
                          {row.lpIrrToDate != null ? fmtPct(row.lpIrrToDate * 100) : '—'}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: row.lpEmToDate >= 1.5 ? BT.met.financial : BT.text.secondary }}>
                          {fmtX(row.lpEmToDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                      <td style={{ padding: '4px 6px', color: BT.text.muted, fontWeight: 700 }}>TOTAL</td>
                      <td style={{ padding: '4px 6px' }} />
                      <td style={{ padding: '4px 6px' }} />
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.cyan, fontWeight: 700 }}>{fmt$(totalLP)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.orange, fontWeight: 700 }}>{fmt$(totalGP)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>{fmt$(totalPromote)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.red, fontWeight: 700 }}>{fmt$(totalFees)}</td>
                      <td style={{ padding: '4px 6px' }} />
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber, fontWeight: 700 }}>
                        {lpIrr != null ? fmtPct(lpIrr * 100) : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: lpEm != null && lpEm >= 1.8 ? BT.met.financial : BT.text.amber, fontWeight: 700 }}>
                        {lpEm != null ? fmtX(lpEm) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SectionPanel>

          {/* ── Waterfall visualization ─────────────────────────────────────── */}
          <SectionPanel title="DISTRIBUTION FLOW" subtitle="LP vs GP by year" borderColor={BT.text.purple}>
            <div style={{ padding: '10px 12px' }}>
              {distRows.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 80 }}>
                    {distRows.map((row, i) => {
                      const total = row.lpDist + row.gpDist;
                      const maxTotal = Math.max(...distRows.map(r => r.lpDist + r.gpDist), 1);
                      const barH = Math.max(10, (total / maxTotal) * 64);
                      const lpH = total > 0 ? (row.lpDist / total) * barH : barH * 0.7;
                      const gpH = total > 0 ? (row.gpDist / total) * barH : barH * 0.3;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{total > 0 ? fmt$(total) : '—'}</span>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: lpH, background: BT.met.financial, opacity: 0.8 }} />
                            <div style={{ height: gpH, background: BT.text.orange, opacity: 0.8 }} />
                          </div>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: row.isPromoteCrystallize ? BT.text.amber : BT.text.muted, fontWeight: row.isPromoteCrystallize ? 700 : 400 }}>{row.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, justifyContent: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}><span style={{ color: BT.met.financial }}>■</span> LP</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}><span style={{ color: BT.text.orange }}>■</span> GP</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}><span style={{ color: BT.text.amber }}>★</span> Promote crystallizes</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: 16 }}>
                  No distribution data — configure equity structure and NOI
                </div>
              )}
            </div>
          </SectionPanel>

          {/* ── LP/GP Returns detail ────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="LP INVESTOR RETURNS" subtitle="Class A · cumulative" borderColor={BT.met.financial}>
              <DataRow label="LP EQUITY IN"        value={fmt$(equity * lpShare)}                          valueColor={BT.text.white} />
              <DataRow label="LP TOTAL OUT"        value={totalLP > 0 ? fmt$(totalLP) : '—'}              valueColor={BT.met.financial} />
              <DataRow label="LP EQUITY MULT"      value={lpEm != null ? fmtX(lpEm) : '—'}               valueColor={lpEm != null && lpEm >= 1.8 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP IRR"               value={lpIrr != null ? fmtPct(lpIrr * 100) : '—'}    valueColor={lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP PREF RATE"         value={fmtPct(prefRate * 100)}                        valueColor={BT.text.cyan} border={false} />
            </SectionPanel>
            <SectionPanel title="GP ECONOMICS" subtitle="Promote + fees · all-in" borderColor={BT.text.orange}>
              <DataRow label="GP CO-INVEST"         value={fmt$(equity * gpShare)}                         valueColor={BT.text.white} />
              <DataRow label="GP TOTAL DIST"        value={totalGP > 0 ? fmt$(totalGP) : '—'}             valueColor={BT.text.orange} />
              <DataRow label="GP PROMOTE"           value={totalPromote > 0 ? fmt$(totalPromote) : '—'}   valueColor={BT.text.amber} />
              <DataRow label="GP TOTAL FEES"        value={totalFees > 0 ? fmt$(totalFees) : '—'}         valueColor={BT.text.red} />
              <DataRow label="GP ALL-IN MULT"       value={gpEm != null ? fmtX(gpEm) : '—'}              valueColor={BT.text.orange} border={false} />
            </SectionPanel>
          </div>
        </>
      )}
    </div>
  );
}

export default WaterfallTab;
