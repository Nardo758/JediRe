import React, { useState, useCallback, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { apiClient } from '../../../services/api.client';
import { logSwallowedError } from '../../../utils/swallowedError';

const MONO = BT.font.mono;

// ─── PATCH helpers ────────────────────────────────────────────────────────────
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

// ─── EditNum ─────────────────────────────────────────────────────────────────
function EditNum({ value, onCommit, pct, disabled }: {
  value: number; onCommit: (v: number) => void; pct?: boolean; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = pct ? `${(value * 100).toFixed(2)}%` : fmt$(value);

  if (disabled) return <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{display}</span>;

  if (editing) {
    return (
      <input autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { const n = parseFloat(draft.replace(/[^0-9.-]/g, '')); if (!isNaN(n)) onCommit(pct ? n / 100 : n); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { const n = parseFloat(draft.replace(/[^0-9.-]/g, '')); if (!isNaN(n)) onCommit(pct ? n / 100 : n); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{ background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}`, color: BT.text.amber, fontFamily: MONO, fontSize: 9, width: 70, padding: '1px 4px', textAlign: 'right', borderRadius: 2 }}
      />
    );
  }
  return (
    <span onClick={() => { setDraft(pct ? (value * 100).toFixed(2) : String(value)); setEditing(true); }}
      title="Click to edit"
      style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600, cursor: 'pointer', borderBottom: `1px dashed ${BT.text.amber}66` }}>
      {display}
    </span>
  );
}

// ─── Domain types ─────────────────────────────────────────────────────────────

type TriggerType = 'roc' | 'pref_return' | 'catch_up' | 'promote';
type CompoundingType = 'annual' | 'monthly' | 'daily';

interface WfTranche {
  id: string;
  label: string;
  role: 'lp' | 'gp' | 'pref';
  pct: number;
  prefRate: number;
  compounding: CompoundingType;
  cumulative: boolean;
  participatePromote: boolean;
}

interface WfTier {
  triggerType: TriggerType;
  triggerIrr: number;
  lpPct: number;
  gpPct: number;
}

interface WfFees {
  acquisitionFeePct: number;
  assetMgmtFeePct: number;
  assetMgmtBasis: string;
  constructionMgmtPct: number;
  dispositionFeePct: number;
  refinancingFeePct: number;
}

type InvestorStatus = 'committed' | 'soft' | 'pending' | 'passed';

interface InvestorRecord {
  id: string;
  trancheId: string;
  name: string;
  entity: string;
  commitment: number;
  status: InvestorStatus;
  email?: string;
  note?: string;
}

const STATUS_COLORS: Record<InvestorStatus, string> = {
  committed: '#68D391',
  soft:      '#63B3ED',
  pending:   '#F6AD55',
  passed:    '#FC8181',
};

const STATUS_LABELS: Record<InvestorStatus, string> = {
  committed: 'COMMITTED',
  soft:      'SOFT',
  pending:   'PENDING',
  passed:    'PASSED',
};

interface DistRow {
  year: number;
  label: string;
  cfads: number;
  activeTier: string;
  lpDist: number;
  gpDist: number;
  gpPromote: number;
  gpFees: number;
  lpIrrToDate: number | null;
  lpEmToDate: number;
  prefAccrued: number;
  prefPaid: number;
  isPromoteCrystallize: boolean;
}

// ─── IRR (Newton-Raphson) ────────────────────────────────────────────────────
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
    const nr = rate - npv / dnpv;
    if (Math.abs(nr - rate) < 1e-8) { rate = nr; break; }
    rate = nr;
    if (rate < -0.999 || rate > 10) return null;
  }
  return rate;
}

// ─── American waterfall: period-by-period ROC → pref → catch-up → promote ───
function runAmerican(
  equity: number, lpShare: number, gpShare: number,
  prefRate: number, tiers: WfTier[], annualCfads: number[],
  exitProceeds: number, fees: WfFees, equityBase: number, egi_y1: number,
): DistRow[] {
  const holdYears = annualCfads.length;
  const lpEquity = equity * lpShare;
  const gpEquity = equity * gpShare;

  let lpPrefAccrued = 0;
  let lpRocPaid = 0;
  let lpDistCumul = 0;
  let gpDistCumul = 0;
  let gpPromoteCumul = 0;

  const lpCFs: number[] = [-lpEquity];
  const rows: DistRow[] = [];

  for (let yr = 1; yr <= holdYears + 1; yr++) {
    const isExit = yr === holdYears + 1;
    const rawCf = isExit ? exitProceeds : (annualCfads[yr - 1] ?? 0);
    const amFeeBase = fees.assetMgmtBasis === 'equity' ? equityBase : egi_y1;
    const gpFeeThis = !isExit ? amFeeBase * fees.assetMgmtFeePct : 0;
    const dispFee   = isExit  ? rawCf * fees.dispositionFeePct : 0;
    const gpFees = gpFeeThis + dispFee;
    let avail = Math.max(rawCf - gpFees, 0);

    // ROC tier
    const rocTier = tiers.find(t => t.triggerType === 'roc');
    const rocToLP = rocTier ? Math.min(avail, Math.max(lpEquity - lpRocPaid, 0)) : 0;
    avail -= rocToLP; lpRocPaid += rocToLP;

    // Pref return tier
    lpPrefAccrued += lpEquity * prefRate;
    const prefTier = tiers.find(t => t.triggerType === 'pref_return');
    const prefToLP = prefTier ? Math.min(avail, lpPrefAccrued) : 0;
    avail -= prefToLP; lpPrefAccrued -= prefToLP;

    // Catch-up tier
    const catchTier = tiers.find(t => t.triggerType === 'catch_up');
    let catchToGP = 0;
    if (catchTier && avail > 0) {
      catchToGP = Math.min(avail, avail * catchTier.gpPct);
      avail -= catchToGP;
    }

    // Promote tiers (by IRR hurdle)
    const promoteTiers = tiers.filter(t => t.triggerType === 'promote').sort((a, b) => a.triggerIrr - b.triggerIrr);
    const currentIrr = lpCFs.length > 1 ? (calcIrr(lpCFs) ?? 0) : 0;
    const activeTierIdx = promoteTiers.findIndex((t, i) =>
      i === promoteTiers.length - 1 || currentIrr < promoteTiers[i + 1].triggerIrr
    );
    const activeTier = promoteTiers[activeTierIdx] ?? { lpPct: 0.8, gpPct: 0.2, triggerIrr: 0, triggerType: 'promote' as TriggerType };

    const lpAbove = avail * activeTier.lpPct;
    const gpAbove = avail * activeTier.gpPct;
    const gpPromote = gpAbove + catchToGP;
    const lpDist = rocToLP + prefToLP + lpAbove;
    const gpDist = gpFees + catchToGP + gpAbove;
    gpPromoteCumul += gpPromote;
    lpDistCumul += lpDist;
    gpDistCumul += gpDist;
    lpCFs.push(lpDist);

    const lpIrrToDate = lpCFs.length > 2 ? calcIrr(lpCFs) : null;
    const lpEmToDate  = lpDistCumul / Math.max(lpEquity, 1);

    const tierLabel = promoteTiers.length > 0
      ? `T${activeTierIdx + 1} ${(activeTier.lpPct * 100).toFixed(0)}/${(activeTier.gpPct * 100).toFixed(0)}`
      : `${(activeTier.lpPct * 100).toFixed(0)}/${(activeTier.gpPct * 100).toFixed(0)}`;

    rows.push({
      year: yr, label: isExit ? 'EXIT ★' : `YR ${yr}`,
      cfads: rawCf, activeTier: tierLabel,
      lpDist, gpDist, gpPromote, gpFees,
      lpIrrToDate, lpEmToDate,
      prefAccrued: lpPrefAccrued,
      prefPaid: prefToLP,
      isPromoteCrystallize: isExit && gpPromoteCumul > 0,
    });
  }
  return rows;
}

// ─── European waterfall: defer all LP dists to terminal event ────────────────
// Operating years: GP receives asset mgmt fees; LP gets nothing.
// Terminal event: total CFADS + exit proceeds, LESS all accumulated GP fees,
// then distribute ROC → pref → promote in a single crystallization.
function runEuropean(
  equity: number, lpShare: number, gpShare: number,
  prefRate: number, tiers: WfTier[], annualCfads: number[],
  exitProceeds: number, fees: WfFees, equityBase: number, egi_y1: number,
): DistRow[] {
  const holdYears = annualCfads.length;
  const lpEquity = equity * lpShare;
  const rows: DistRow[] = [];

  // Track cumulative GP operating fees — these are deducted from terminal pool
  let totalOperatingGpFees = 0;

  for (let yr = 1; yr <= holdYears; yr++) {
    const rawCf = annualCfads[yr - 1] ?? 0;
    const amFee = (fees.assetMgmtBasis === 'equity' ? equityBase : egi_y1) * fees.assetMgmtFeePct;
    totalOperatingGpFees += amFee;
    rows.push({
      year: yr, label: `YR ${yr}`, cfads: rawCf, activeTier: 'EUROPEAN (DEFERRED)',
      lpDist: 0, gpDist: amFee, gpPromote: 0, gpFees: amFee,
      lpIrrToDate: null, lpEmToDate: 0,
      prefAccrued: lpEquity * prefRate * yr, prefPaid: 0,
      isPromoteCrystallize: false,
    });
  }

  // Terminal: total pool = cumulative operating CF + exit proceeds, minus all GP fees already taken
  const totalOperatingCF = annualCfads.reduce((s, c) => s + c, 0);
  const totalCF = totalOperatingCF + exitProceeds;
  const dispFee = exitProceeds * fees.dispositionFeePct;
  // Deduct all GP fees (operating AM fees + disposition) from distributable pool
  let avail = Math.max(totalCF - dispFee - totalOperatingGpFees, 0);

  const rocToLP = Math.min(avail, lpEquity); avail -= rocToLP;
  const prefAccruedTotal = lpEquity * prefRate * holdYears;
  const prefToLP = Math.min(avail, prefAccruedTotal); avail -= prefToLP;

  const promoteTiers = tiers.filter(t => t.triggerType === 'promote').sort((a, b) => a.triggerIrr - b.triggerIrr);
  const topTier = promoteTiers[promoteTiers.length - 1] ?? { lpPct: 0.7, gpPct: 0.3, triggerIrr: 0, triggerType: 'promote' as TriggerType };
  const lpAbove = avail * topTier.lpPct;
  const gpAbove = avail * topTier.gpPct;
  const lpDist = rocToLP + prefToLP + lpAbove;
  const gpDist = dispFee + gpAbove;
  const lpCFs = [-lpEquity, lpDist];
  const lpIrr = calcIrr(lpCFs);
  const lpEm = lpDist / Math.max(lpEquity, 1);

  rows.push({
    year: holdYears + 1, label: 'EXIT ★',
    cfads: exitProceeds,
    activeTier: `T${promoteTiers.length} ${(topTier.lpPct * 100).toFixed(0)}/${(topTier.gpPct * 100).toFixed(0)} · FINAL`,
    lpDist, gpDist, gpPromote: gpAbove, gpFees: dispFee,
    lpIrrToDate: lpIrr, lpEmToDate: lpEm,
    prefAccrued: prefAccruedTotal, prefPaid: prefToLP,
    isPromoteCrystallize: true,
  });

  return rows;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TRANCHE_COLORS: Record<string, string> = {
  lp: BT.met.financial, gp: BT.text.orange, pref: BT.text.purple,
};

const TRANCHE_PRESETS: WfTranche[] = [
  { id: 'lpA',   label: 'LP CLASS A',   role: 'lp',   pct: 0.90, prefRate: 0.08, compounding: 'annual', cumulative: true,  participatePromote: true  },
  { id: 'lpB',   label: 'LP CLASS B',   role: 'lp',   pct: 0.05, prefRate: 0.10, compounding: 'annual', cumulative: true,  participatePromote: true  },
  { id: 'prefEq',label: 'PREF EQUITY',  role: 'pref', pct: 0.03, prefRate: 0.12, compounding: 'annual', cumulative: true,  participatePromote: false },
  { id: 'gp',    label: 'GP CO-INVEST', role: 'gp',   pct: 0.02, prefRate: 0,    compounding: 'annual', cumulative: false, participatePromote: true  },
];

const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  roc: 'RETURN OF CAPITAL',
  pref_return: 'PREF RETURN',
  catch_up: 'CATCH-UP',
  promote: 'PROMOTE',
};

const COMPOUNDING_LABELS: Record<CompoundingType, string> = {
  annual: 'ANNUAL', monthly: 'MONTHLY', daily: 'DAILY',
};

// ─── WaterfallTab v2 ──────────────────────────────────────────────────────────
export function WaterfallTab({ dealId, assumptions, modelResults, f9Financials, onF9Refresh }: FinancialEngineTabProps) {
  const [activePanel, setActivePanel] = useState<'config' | 'schedule'>('config');

  const wfBe = f9Financials?.waterfall ?? null;
  const capBe = f9Financials?.capital ?? null;
  const cs = f9Financials?.capitalStack;

  // ── Capital / equity seed ──────────────────────────────────────────────────
  const purchasePrice = cs?.purchasePrice ?? assumptions?.acquisition?.purchasePrice ?? 0;
  const loanAmount    = cs?.loanAmount ?? assumptions?.financing?.loanAmount ?? 0;
  const equity        = cs?.equityAtClose ?? Math.max(purchasePrice - loanAmount, 0);
  const holdYears     = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;
  const interestRate  = cs?.interestRate ?? assumptions?.financing?.interestRate ?? 0.07;
  const annualDS      = loanAmount * interestRate;
  const rentGrowth    = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const exitCap       = f9Financials?.assumptions?.exitCap ?? assumptions?.disposition?.exitCapRate ?? 0.055;
  const sellingPct    = assumptions?.disposition?.sellingCosts ?? 0.025;
  const noi_y1  = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? modelResults?.summary?.noi ?? 0;
  const egi_y1  = f9Financials?.proforma?.year1?.find(r => r.field === 'egi')?.resolved ?? noi_y1 * 1.15;

  // ── Local state ────────────────────────────────────────────────────────────
  const [wfType, setWfType] = useState<string>(wfBe?.waterfallType ?? 'american');
  const [prefRate, setPrefRate] = useState<number>(wfBe?.prefRate ?? 0.08);

  // Tranches — initialized from backend capital.tranches (persisted) or defaults
  const [tranches, setTranches] = useState<WfTranche[]>(() => {
    if (capBe?.tranches?.length) {
      return capBe.tranches.map(t => ({
        id: t.id, label: t.label,
        role: t.role as 'lp' | 'gp' | 'pref',
        pct: t.pct, prefRate: t.prefRate,
        compounding: (t.compounding ?? 'annual') as CompoundingType,
        cumulative: t.cumulative, participatePromote: t.participatePromote,
      }));
    }
    return [
      { id: 'lpA', label: 'LP CLASS A',   role: 'lp', pct: wfBe?.lpShare ?? 0.9, prefRate: wfBe?.prefRate ?? 0.08, compounding: 'annual', cumulative: true,  participatePromote: true  },
      { id: 'gp',  label: 'GP CO-INVEST', role: 'gp', pct: wfBe?.gpShare ?? 0.1, prefRate: 0,                      compounding: 'annual', cumulative: false, participatePromote: true  },
    ];
  });

  // Tiers — initialized from backend waterfall.tiers (includes triggerType)
  const [tiers, setTiers] = useState<WfTier[]>(() => (wfBe?.tiers ?? [
    { triggerIrr: 0.08, lpPct: 0.80, gpPct: 0.20, triggerType: 'roc' },
    { triggerIrr: 0.12, lpPct: 0.70, gpPct: 0.30, triggerType: 'pref_return' },
    { triggerIrr: 0.15, lpPct: 0.60, gpPct: 0.40, triggerType: 'promote' },
  ]).map((t): WfTier => ({
    triggerType: (t.triggerType ?? 'promote') as TriggerType,
    triggerIrr: t.triggerIrr,
    lpPct: t.lpPct,
    gpPct: t.gpPct,
  })));

  const [fees, setFees] = useState<WfFees>(wfBe?.fees as WfFees ?? {
    acquisitionFeePct: 0.01,
    assetMgmtFeePct: 0.015,
    assetMgmtBasis: 'equity',
    constructionMgmtPct: 0,
    dispositionFeePct: 0.01,
    refinancingFeePct: 0,
  });

  // ── Investor roster (per-tranche, localStorage-persisted) ─────────────────
  const investorKey = `jedire_investors_${dealId}`;
  const [investors, setInvestors] = useState<InvestorRecord[]>(() => {
    try { const s = localStorage.getItem(investorKey); if (s) return JSON.parse(s); } catch (err) { logSwallowedError('pages/development/financial-engine/WaterfallTab', err); }
    return [];
  });
  const [expandedTranches, setExpandedTranches] = useState<Record<string, boolean>>({});
  const [addingToTranche, setAddingToTranche] = useState<string | null>(null);
  const [newInv, setNewInv] = useState<Omit<InvestorRecord, 'id' | 'trancheId'>>({ name: '', entity: '', commitment: 0, status: 'soft' });

  const saveInvestors = useCallback((next: InvestorRecord[]) => {
    setInvestors(next);
    localStorage.setItem(investorKey, JSON.stringify(next));
  }, [investorKey]);

  const addInvestor = useCallback((trancheId: string) => {
    if (!newInv.name.trim()) return;
    const rec: InvestorRecord = { id: `inv_${Date.now()}`, trancheId, ...newInv };
    saveInvestors([...investors, rec]);
    setNewInv({ name: '', entity: '', commitment: 0, status: 'soft' });
    setAddingToTranche(null);
  }, [investors, newInv, saveInvestors]);

  const updateInvestor = useCallback((id: string, patch: Partial<InvestorRecord>) => {
    saveInvestors(investors.map(inv => inv.id === id ? { ...inv, ...patch } : inv));
  }, [investors, saveInvestors]);

  const removeInvestor = useCallback((id: string) => {
    saveInvestors(investors.filter(inv => inv.id !== id));
  }, [investors, saveInvestors]);

  const toggleTranche = useCallback((id: string) => {
    setExpandedTranches(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Sync from backend on f9Financials refresh
  React.useEffect(() => {
    if (wfBe) {
      setWfType(wfBe.waterfallType);
      setPrefRate(wfBe.prefRate);
      if (wfBe.fees) setFees(wfBe.fees as WfFees);
      if (wfBe.tiers?.length) {
        setTiers(wfBe.tiers.map((t): WfTier => ({
          triggerType: (t.triggerType ?? 'promote') as TriggerType,
          triggerIrr: t.triggerIrr, lpPct: t.lpPct, gpPct: t.gpPct,
        })));
      }
    }
    if (capBe?.tranches?.length) {
      setTranches(capBe.tranches.map(t => ({
        id: t.id, label: t.label,
        role: t.role as 'lp' | 'gp' | 'pref',
        pct: t.pct, prefRate: t.prefRate,
        compounding: (t.compounding ?? 'annual') as CompoundingType,
        cumulative: t.cumulative, participatePromote: t.participatePromote,
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wfBe?.lpShare, wfBe?.gpShare, wfBe?.prefRate, wfBe?.waterfallType, wfBe?.tiers?.length, capBe?.tranches?.length]);

  const patch = useCallback(async (key: string, value: number | string | null) => {
    await patchWf(dealId, key, value);
    onF9Refresh?.();
  }, [dealId, onF9Refresh]);

  // Persist entire tranche array (N tranches: label, role, pct, prefRate, compounding, cumulative, participatePromote)
  const persistTranches = useCallback(async (next: WfTranche[], skipRefresh = false) => {
    const maxN = Math.max(next.length, tranches.length, 1);
    for (let i = 0; i < maxN; i++) {
      if (!next[i]) {
        // Removed — clear from backend
        await patchWf(dealId, `tranche${i}Label`, null);
        await patchWf(dealId, `tranche${i}Role`, null);
        await patchWf(dealId, `tranche${i}Pct`, null);
        await patchWf(dealId, `tranche${i}PrefRate`, null);
        await patchWf(dealId, `tranche${i}Compounding`, null);
        await patchWf(dealId, `tranche${i}Cumulative`, null);
        await patchWf(dealId, `tranche${i}ParticipatePromote`, null);
      } else {
        const t = next[i];
        await patchWf(dealId, `tranche${i}Label`, t.label);
        await patchWf(dealId, `tranche${i}Role`, t.role);
        await patchWf(dealId, `tranche${i}Pct`, t.pct);
        await patchWf(dealId, `tranche${i}PrefRate`, t.prefRate);
        await patchWf(dealId, `tranche${i}Compounding`, t.compounding);
        await patchWf(dealId, `tranche${i}Cumulative`, String(t.cumulative));
        await patchWf(dealId, `tranche${i}ParticipatePromote`, String(t.participatePromote));
      }
    }
    // Also keep the aggregate wf:lpShare and wf:gpShare in sync
    const newLp = next.filter(t => t.role !== 'gp').reduce((s, t) => s + t.pct, 0);
    const newGp = next.filter(t => t.role === 'gp').reduce((s, t) => s + t.pct, 0);
    await patchWf(dealId, 'lpShare', newLp);
    await patchWf(dealId, 'gpShare', newGp);
    if (!skipRefresh) onF9Refresh?.();
  }, [dealId, onF9Refresh, tranches.length]);

  // Persist entire tier array
  const persistTiers = useCallback(async (next: WfTier[]) => {
    const maxN = Math.max(next.length, tiers.length, 1);
    for (let i = 0; i < maxN; i++) {
      if (!next[i]) {
        await patchWf(dealId, `tier${i}TriggerIrr`, null);
        await patchWf(dealId, `tier${i}LpPct`, null);
        await patchWf(dealId, `tier${i}GpPct`, null);
        await patchWf(dealId, `tier${i}TriggerType`, null);
      } else {
        await patchWf(dealId, `tier${i}TriggerIrr`, next[i].triggerIrr);
        await patchWf(dealId, `tier${i}LpPct`, next[i].lpPct);
        await patchWf(dealId, `tier${i}GpPct`, next[i].gpPct);
        await patchWf(dealId, `tier${i}TriggerType`, next[i].triggerType);
      }
    }
    onF9Refresh?.();
  }, [dealId, onF9Refresh, tiers.length]);

  // ── Build CFADS projection ─────────────────────────────────────────────────
  const annualCfads = useMemo((): number[] => {
    const arr: number[] = [];
    for (let yr = 1; yr <= holdYears; yr++) {
      arr.push(Math.max((noi_y1 * Math.pow(1 + rentGrowth, yr - 1)) - annualDS, 0));
    }
    return arr;
  }, [noi_y1, holdYears, rentGrowth, annualDS]);

  const exitNOI      = noi_y1 * Math.pow(1 + rentGrowth, holdYears);
  const grossSale    = exitCap > 0 ? exitNOI / exitCap : 0;
  const exitProceeds = Math.max(grossSale * (1 - sellingPct) - loanAmount, 0);

  // Effective LP/GP shares from tranches
  const lpShareEff = tranches.filter(t => t.role !== 'gp').reduce((s, t) => s + t.pct, 0);
  const gpShareEff = tranches.filter(t => t.role === 'gp').reduce((s, t) => s + t.pct, 0);

  // ── Run waterfall ──────────────────────────────────────────────────────────
  // Prefer server-side schedule from capital.schedule (authoritative, post-persist);
  // fall back to client-side engine for immediate interactivity when server has no data.
  const serverSchedule = f9Financials?.capital?.schedule ?? null;
  const serverMetrics  = f9Financials?.capital?.metrics ?? null;

  const distRows = useMemo((): DistRow[] => {
    // Use server-side schedule if available (deal has financial data & server computed it)
    if (serverSchedule && serverSchedule.length > 0) {
      return serverSchedule.map(r => ({
        year: r.year,
        label: r.period,
        cfads: r.cfads,
        activeTier: r.activeTier,
        lpDist: r.lpDist,
        gpDist: r.gpDist,
        gpPromote: r.gpPromote,
        gpFees: r.gpFees,
        lpIrrToDate: r.lpIrr,
        lpEmToDate: r.lpEm,
        prefAccrued: r.prefAccrued,
        prefPaid: r.prefPaid,
        isPromoteCrystallize: r.isExit && r.gpPromote > 0,
      }));
    }
    // Client-side fallback (when no backend data seeded yet — provides immediate interactivity)
    if (equity <= 0 || noi_y1 <= 0) return [];
    const runner = wfType === 'european' ? runEuropean : runAmerican;
    return runner(equity, lpShareEff, gpShareEff, prefRate, tiers, annualCfads, exitProceeds, fees, equity, egi_y1);
  }, [serverSchedule, equity, noi_y1, lpShareEff, gpShareEff, prefRate, tiers, annualCfads, exitProceeds, fees, egi_y1, wfType]);

  // ── KPIs — prefer server metrics when available (post-persist authoritative) ──
  const totalLP      = serverMetrics?.totalLpDistributions ?? distRows.reduce((s, r) => s + r.lpDist, 0);
  const totalGP      = serverMetrics?.totalGpDistributions ?? distRows.reduce((s, r) => s + r.gpDist, 0);
  const totalPromote = serverMetrics?.totalGpPromote       ?? distRows.reduce((s, r) => s + r.gpPromote, 0);
  const totalFees    = serverMetrics?.totalGpFees          ?? distRows.reduce((s, r) => s + r.gpFees, 0);
  const lpEquity     = equity * lpShareEff;
  const gpEquity     = equity * gpShareEff;
  const lpEm         = serverMetrics?.lpEquityMultiple ?? (lpEquity > 0 ? totalLP / lpEquity : null);
  const gpEm         = serverMetrics?.gpEquityMultiple ?? (gpEquity > 0 ? (totalGP + equity * fees.acquisitionFeePct) / Math.max(gpEquity, 1) : null);
  const lpCFs        = [-lpEquity, ...distRows.map(r => r.lpDist)];
  const lpIrr        = serverMetrics?.lpIrr ?? (lpEquity > 0 && distRows.length > 0 ? calcIrr(lpCFs) : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>LP/GP EQUITY · PROMOTE TIERS · DISTRIBUTIONS</span>
        <Bd c={BT.text.purple}>CAP & WATERFALL</Bd>
        {equity > 0 && <Bd c={BT.text.cyan}>{fmt$(equity)} EQUITY</Bd>}
        <Bd c={wfType === 'european' ? BT.text.orange : BT.text.cyan}>{wfType.toUpperCase()}</Bd>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['config', 'schedule'] as const).map(v => (
            <button key={v} onClick={() => setActivePanel(v)} style={{
              background: activePanel === v ? `${BT.text.purple}20` : 'transparent',
              border: `1px solid ${activePanel === v ? BT.text.purple : BT.border.medium}`,
              color: activePanel === v ? BT.text.purple : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
            }}>{v === 'config' ? 'CONFIG' : 'SCHEDULE'}</button>
          ))}
        </div>
      </div>

      {/* ── Hero KPI strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <KpiTile label="LP IRR"           value={lpIrr  != null ? fmtPct(lpIrr * 100)   : '—'} color={lpIrr  != null && lpIrr  >= 0.12 ? BT.met.financial : BT.text.amber} />
        <KpiTile label="LP EQUITY MULT"   value={lpEm   != null ? fmtX(lpEm)             : '—'} color={lpEm   != null && lpEm   >= 1.8  ? BT.met.financial : BT.text.amber} />
        <KpiTile label="GP ALL-IN MULT"   value={gpEm   != null ? fmtX(gpEm)             : '—'} color={BT.text.orange} />
        <KpiTile label="TOTAL LP DIST"    value={totalLP  > 0   ? fmt$(totalLP)           : '—'} color={BT.text.cyan} />
        <KpiTile label="TOTAL GP PROMOTE" value={totalPromote > 0 ? fmt$(totalPromote)   : '—'} color={BT.text.amber} />
      </div>

      {activePanel === 'config' ? (
        <>
          {/* ── Equity Tranches panel ────────────────────────────────────────── */}
          <SectionPanel title="EQUITY TRANCHES" subtitle="LP / preferred / GP capital structure — fully persisted · add/remove tranches" borderColor={BT.met.financial}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                    {['TRANCHE', 'ROLE', 'CONTRIBUTION', '% EQUITY', 'PREF RATE', 'COMPOUND', 'CUMUL', 'PROMOTE', 'INVESTORS', ''].map(h => (
                      <th key={h} style={{ padding: '3px 8px', color: BT.text.muted, textAlign: h === 'TRANCHE' || h === 'ROLE' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tranches.map((tr, i) => {
                    const trancheInvestors = investors.filter(inv => inv.trancheId === tr.id);
                    const classTotal = equity * tr.pct;
                    const committed = trancheInvestors.filter(inv => inv.status === 'committed').reduce((s, inv) => s + inv.commitment, 0);
                    const softCircle = trancheInvestors.filter(inv => inv.status === 'soft').reduce((s, inv) => s + inv.commitment, 0);
                    const totalRaised = committed + softCircle;
                    const isExpanded = !!expandedTranches[tr.id];
                    const isAdding = addingToTranche === tr.id;
                    const trancheColor = TRANCHE_COLORS[tr.role] ?? BT.text.white;
                    return (
                      <React.Fragment key={tr.id}>
                        <tr style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: isExpanded ? 'none' : `1px solid ${BT.border.subtle}` }}>
                          <td style={{ padding: '3px 8px', color: trancheColor, fontWeight: 700 }}>{tr.label}</td>
                          <td style={{ padding: '3px 8px', color: BT.text.muted }}>{tr.role.toUpperCase()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.white }}>{equity > 0 ? fmt$(classTotal) : '—'}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            <EditNum value={tr.pct} pct onCommit={async v => {
                              const next = tranches.map((t, j) => j === i ? { ...t, pct: v } : t);
                              setTranches(next); await persistTranches(next);
                            }} />
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            {tr.role !== 'gp'
                              ? <EditNum value={tr.prefRate} pct onCommit={async v => {
                                  const next = tranches.map((t, j) => j === i ? { ...t, prefRate: v } : t);
                                  setTranches(next);
                                  const firstLpPref = next.find(t => t.role !== 'gp')?.prefRate ?? v;
                                  setPrefRate(firstLpPref);
                                  await patchWf(dealId, 'prefRate', firstLpPref);
                                  await persistTranches(next, true);
                                  onF9Refresh?.();
                                }} />
                              : <span style={{ color: BT.text.muted }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            {tr.role !== 'gp' ? (
                              <select value={tr.compounding} onChange={async e => {
                                const val = e.target.value as CompoundingType;
                                const next = tranches.map((t, j) => j === i ? { ...t, compounding: val } : t);
                                setTranches(next); await persistTranches(next);
                              }} style={{
                                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
                                color: BT.text.amber, fontFamily: MONO, fontSize: 8, padding: '1px 3px',
                                colorScheme: 'dark',
                              }}>
                                {(Object.keys(COMPOUNDING_LABELS) as CompoundingType[]).map(k => (
                                  <option key={k} value={k}>{COMPOUNDING_LABELS[k]}</option>
                                ))}
                              </select>
                            ) : <span style={{ color: BT.text.muted }}>—</span>}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            {tr.role !== 'gp' ? (
                              <button onClick={async () => {
                                const next = tranches.map((t, j) => j === i ? { ...t, cumulative: !t.cumulative } : t);
                                setTranches(next); await persistTranches(next);
                              }} style={{
                                background: tr.cumulative ? `${BT.met.financial}22` : 'transparent',
                                border: `1px solid ${tr.cumulative ? BT.met.financial : BT.border.medium}`,
                                color: tr.cumulative ? BT.met.financial : BT.text.muted,
                                fontFamily: MONO, fontSize: 8, padding: '1px 6px', cursor: 'pointer', borderRadius: 2,
                              }}>{tr.cumulative ? 'YES' : 'NO'}</button>
                            ) : <span style={{ color: BT.text.muted }}>—</span>}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            <button onClick={async () => {
                              const next = tranches.map((t, j) => j === i ? { ...t, participatePromote: !t.participatePromote } : t);
                              setTranches(next); await persistTranches(next);
                            }} style={{
                              background: tr.participatePromote ? `${BT.text.orange}22` : 'transparent',
                              border: `1px solid ${tr.participatePromote ? BT.text.orange : BT.border.medium}`,
                              color: tr.participatePromote ? BT.text.orange : BT.text.muted,
                              fontFamily: MONO, fontSize: 8, padding: '1px 6px', cursor: 'pointer', borderRadius: 2,
                            }}>{tr.participatePromote ? 'YES' : 'NO'}</button>
                          </td>
                          {/* ── INVESTORS toggle cell ────────────────────────── */}
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            <button onClick={() => toggleTranche(tr.id)} style={{
                              background: isExpanded ? `${trancheColor}22` : 'transparent',
                              border: `1px solid ${isExpanded ? trancheColor : BT.border.medium}`,
                              color: isExpanded ? trancheColor : BT.text.muted,
                              fontFamily: MONO, fontSize: 8, padding: '1px 7px', cursor: 'pointer', borderRadius: 2,
                              display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                            }}>
                              <span style={{ fontSize: 7 }}>{isExpanded ? '▼' : '▶'}</span>
                              {trancheInvestors.length > 0 ? `${trancheInvestors.length} INVESTOR${trancheInvestors.length > 1 ? 'S' : ''}` : 'ADD INVESTORS'}
                            </button>
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                            {tranches.length > 2 && (
                              <button onClick={async () => {
                                const next = tranches.filter((_, j) => j !== i);
                                setTranches(next); await persistTranches(next);
                              }} style={{
                                background: 'transparent', border: `1px solid ${BT.border.medium}`,
                                color: BT.text.red, fontFamily: MONO, fontSize: 8, padding: '1px 5px', cursor: 'pointer', borderRadius: 2,
                              }}>✕</button>
                            )}
                          </td>
                        </tr>
                        {/* ── Expandable investor roster ─────────────────────── */}
                        {isExpanded && (
                          <tr style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                            <td colSpan={10} style={{ padding: 0 }}>
                              <div style={{ margin: '0 8px 8px 28px', border: `1px solid ${trancheColor}44`, borderRadius: 4, overflow: 'hidden' }}>
                                {/* Roster header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: `${trancheColor}18`, borderBottom: `1px solid ${trancheColor}33` }}>
                                  <span style={{ fontFamily: MONO, fontSize: 9, color: trancheColor, fontWeight: 700, letterSpacing: '0.05em' }}>
                                    {tr.label} · INVESTOR ROSTER
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {classTotal > 0 && (
                                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                                        TARGET: <span style={{ color: BT.text.white }}>{fmt$(classTotal)}</span>
                                        {totalRaised > 0 && (
                                          <> · RAISED: <span style={{ color: totalRaised >= classTotal ? '#68D391' : BT.text.amber }}>{fmt$(totalRaised)}</span>
                                          {' '}(<span style={{ color: totalRaised >= classTotal ? '#68D391' : BT.text.amber }}>{((totalRaised / classTotal) * 100).toFixed(0)}%</span>)</>
                                        )}
                                      </span>
                                    )}
                                    <button onClick={() => { setAddingToTranche(isAdding ? null : tr.id); setNewInv({ name: '', entity: '', commitment: 0, status: 'soft' }); }} style={{
                                      background: `${trancheColor}22`, border: `1px solid ${trancheColor}66`,
                                      color: trancheColor, fontFamily: MONO, fontSize: 8, padding: '2px 8px',
                                      cursor: 'pointer', borderRadius: 2,
                                    }}>+ ADD INVESTOR</button>
                                  </div>
                                </div>
                                {/* Commitment fill bar */}
                                {classTotal > 0 && totalRaised > 0 && (
                                  <div style={{ height: 3, background: BT.bg.panelAlt, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min((committed / classTotal) * 100, 100)}%`, background: STATUS_COLORS.committed }} />
                                    <div style={{ position: 'absolute', left: `${Math.min((committed / classTotal) * 100, 100)}%`, top: 0, height: '100%', width: `${Math.min((softCircle / classTotal) * 100, 100 - (committed / classTotal) * 100)}%`, background: STATUS_COLORS.soft, opacity: 0.6 }} />
                                  </div>
                                )}
                                {/* Investor rows */}
                                {trancheInvestors.length > 0 && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
                                    <thead>
                                      <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                                        {['INVESTOR NAME', 'ENTITY TYPE', 'COMMITMENT', '% OF CLASS', 'EMAIL', 'STATUS', 'NOTE', ''].map(h => (
                                          <th key={h} style={{ padding: '3px 8px', color: BT.text.muted, textAlign: h === 'INVESTOR NAME' || h === 'ENTITY TYPE' || h === 'EMAIL' || h === 'NOTE' ? 'left' : 'right', fontWeight: 500, fontSize: 8 }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {trancheInvestors.map((inv, ii) => {
                                        const pctOfClass = classTotal > 0 ? (inv.commitment / classTotal) * 100 : 0;
                                        return (
                                          <tr key={inv.id} style={{ background: ii % 2 === 0 ? 'transparent' : `${BT.bg.panelAlt}88`, borderBottom: `1px solid ${BT.border.subtle}` }}>
                                            <td style={{ padding: '3px 8px' }}>
                                              <input value={inv.name} onChange={e => updateInvestor(inv.id, { name: e.target.value })}
                                                style={{ background: 'transparent', border: 'none', color: BT.text.white, fontFamily: MONO, fontSize: 8, width: 140, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '3px 8px' }}>
                                              <select value={inv.entity} onChange={e => updateInvestor(inv.id, { entity: e.target.value })} style={{
                                                background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, color: BT.text.muted,
                                                fontFamily: MONO, fontSize: 7, padding: '1px 2px', maxWidth: 90, colorScheme: 'dark',
                                              }}>
                                                <option value="">—</option>
                                                {['Individual', 'LLC', 'LP', 'Trust', 'Family Office', 'Fund', 'REIT', 'Corp', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
                                              </select>
                                            </td>
                                            <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                                              <input value={inv.commitment === 0 ? '' : String(inv.commitment)}
                                                onChange={e => {
                                                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                                                  updateInvestor(inv.id, { commitment: parseFloat(raw) || 0 });
                                                }}
                                                onBlur={e => {
                                                  const raw = e.target.value.replace(/[^0-9.kmKM]/gi, '');
                                                  let v = parseFloat(raw);
                                                  if (/k/i.test(raw)) v *= 1000;
                                                  if (/m/i.test(raw)) v *= 1000000;
                                                  updateInvestor(inv.id, { commitment: isNaN(v) ? 0 : v });
                                                }}
                                                placeholder="0"
                                                style={{ background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`, color: BT.text.amber, fontFamily: MONO, fontSize: 8, width: 80, padding: '1px 4px', textAlign: 'right', borderRadius: 2 }} />
                                            </td>
                                            <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.cyan }}>
                                              {pctOfClass > 0 ? `${pctOfClass.toFixed(1)}%` : '—'}
                                            </td>
                                            <td style={{ padding: '3px 8px' }}>
                                              <input value={inv.email ?? ''} onChange={e => updateInvestor(inv.id, { email: e.target.value })}
                                                placeholder="email@—"
                                                style={{ background: 'transparent', border: 'none', color: BT.text.muted, fontFamily: MONO, fontSize: 7, width: 130, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                                              <select value={inv.status} onChange={e => updateInvestor(inv.id, { status: e.target.value as InvestorStatus })} style={{
                                                background: BT.bg.panel, border: `1px solid ${STATUS_COLORS[inv.status]}66`,
                                                color: STATUS_COLORS[inv.status], fontFamily: MONO, fontSize: 7, padding: '1px 3px', borderRadius: 2,
                                                colorScheme: 'dark',
                                              }}>
                                                {(Object.keys(STATUS_LABELS) as InvestorStatus[]).map(s => (
                                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                                ))}
                                              </select>
                                            </td>
                                            <td style={{ padding: '3px 8px' }}>
                                              <input value={inv.note ?? ''} onChange={e => updateInvestor(inv.id, { note: e.target.value })}
                                                placeholder="note…"
                                                style={{ background: 'transparent', border: 'none', color: BT.text.muted, fontFamily: MONO, fontSize: 7, width: 100, outline: 'none' }} />
                                            </td>
                                            <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                                              <button onClick={() => removeInvestor(inv.id)} style={{
                                                background: 'transparent', border: `1px solid ${BT.border.medium}`,
                                                color: BT.text.red, fontFamily: MONO, fontSize: 7, padding: '1px 5px', cursor: 'pointer', borderRadius: 2,
                                              }}>✕</button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    {/* Roster totals */}
                                    <tfoot>
                                      <tr style={{ borderTop: `1px solid ${trancheColor}44` }}>
                                        <td colSpan={2} style={{ padding: '3px 8px', color: BT.text.muted, fontFamily: MONO, fontSize: 8 }}>TOTAL · {trancheInvestors.length} investor{trancheInvestors.length !== 1 ? 's' : ''}</td>
                                        <td style={{ padding: '3px 8px', textAlign: 'right', color: totalRaised >= classTotal && classTotal > 0 ? '#68D391' : BT.text.amber, fontFamily: MONO, fontSize: 8, fontWeight: 700 }}>{fmt$(totalRaised)}</td>
                                        <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.cyan, fontFamily: MONO, fontSize: 8 }}>
                                          {classTotal > 0 ? `${((totalRaised / classTotal) * 100).toFixed(1)}%` : '—'}
                                        </td>
                                        <td colSpan={4} style={{ padding: '3px 8px' }}>
                                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                                            COMMITTED: <span style={{ color: STATUS_COLORS.committed }}>{fmt$(committed)}</span>
                                            {'  '}SOFT: <span style={{ color: STATUS_COLORS.soft }}>{fmt$(softCircle)}</span>
                                            {'  '}GAP: <span style={{ color: classTotal > totalRaised ? BT.text.red : '#68D391' }}>{fmt$(Math.max(classTotal - totalRaised, 0))}</span>
                                          </span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}
                                {trancheInvestors.length === 0 && !isAdding && (
                                  <div style={{ padding: '10px 12px', color: BT.text.muted, fontFamily: MONO, fontSize: 8, textAlign: 'center' }}>
                                    No investors added yet — click <span style={{ color: trancheColor }}>+ ADD INVESTOR</span> to build out your capital raise roster
                                  </div>
                                )}
                                {/* Add investor inline form */}
                                {isAdding && (
                                  <div style={{ padding: '6px 8px', borderTop: `1px solid ${trancheColor}33`, background: `${trancheColor}0a`, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input autoFocus value={newInv.name} onChange={e => setNewInv(p => ({ ...p, name: e.target.value }))}
                                      placeholder="Investor Name *"
                                      style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.white, fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, width: 150 }} />
                                    <select value={newInv.entity} onChange={e => setNewInv(p => ({ ...p, entity: e.target.value }))} style={{
                                      background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
                                      fontFamily: MONO, fontSize: 8, padding: '2px 4px', borderRadius: 2, colorScheme: 'dark',
                                    }}>
                                      <option value="">Entity Type</option>
                                      {['Individual', 'LLC', 'LP', 'Trust', 'Family Office', 'Fund', 'REIT', 'Corp', 'Other'].map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <input value={newInv.commitment === 0 ? '' : String(newInv.commitment)} onChange={e => setNewInv(p => ({ ...p, commitment: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 }))}
                                      placeholder="Commitment $"
                                      style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.amber, fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, width: 110, textAlign: 'right' }} />
                                    <input value={newInv.email ?? ''} onChange={e => setNewInv(p => ({ ...p, email: e.target.value }))}
                                      placeholder="Email (optional)"
                                      style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.muted, fontFamily: MONO, fontSize: 8, padding: '2px 6px', borderRadius: 2, width: 140 }} />
                                    <select value={newInv.status} onChange={e => setNewInv(p => ({ ...p, status: e.target.value as InvestorStatus }))} style={{
                                      background: BT.bg.panel, border: `1px solid ${STATUS_COLORS[newInv.status]}66`,
                                      color: STATUS_COLORS[newInv.status], fontFamily: MONO, fontSize: 8, padding: '2px 4px', borderRadius: 2,
                                      colorScheme: 'dark',
                                    }}>
                                      {(Object.keys(STATUS_LABELS) as InvestorStatus[]).map(s => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => addInvestor(tr.id)} style={{
                                      background: `${trancheColor}33`, border: `1px solid ${trancheColor}`,
                                      color: trancheColor, fontFamily: MONO, fontSize: 8, padding: '2px 10px', cursor: 'pointer', borderRadius: 2, fontWeight: 700,
                                    }}>ADD</button>
                                    <button onClick={() => setAddingToTranche(null)} style={{
                                      background: 'transparent', border: `1px solid ${BT.border.medium}`,
                                      color: BT.text.muted, fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                                    }}>CANCEL</button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Add preset tranches */}
            <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 4 }}>
              {TRANCHE_PRESETS.filter(p => !tranches.some(t => t.label === p.label)).map(preset => (
                <button key={preset.label} onClick={async () => {
                  const next = [...tranches, { ...preset, id: `tr_${Date.now()}` }];
                  setTranches(next); await persistTranches(next);
                }} style={{
                  background: 'transparent', border: `1px solid ${BT.border.medium}`,
                  color: TRANCHE_COLORS[preset.role], fontFamily: MONO, fontSize: 8,
                  padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                }}>+ {preset.label}</button>
              ))}
            </div>
            {/* Capital stack bar */}
            {equity > 0 && (
              <div style={{ padding: '6px 10px', borderTop: `1px solid ${BT.border.subtle}` }}>
                <div style={{ display: 'flex', gap: 2, height: 16, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ flex: loanAmount / Math.max(purchasePrice, 1), background: BT.text.cyan, opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>DEBT {fmtPct((loanAmount / Math.max(purchasePrice, 1)) * 100)}</span>
                  </div>
                  {tranches.map(tr => (
                    <div key={tr.id} style={{ flex: (equity * tr.pct) / Math.max(purchasePrice, 1), background: TRANCHE_COLORS[tr.role], opacity: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{fmtPct(tr.pct * 100)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {tranches.map(tr => (
                    <span key={tr.id} style={{ fontFamily: MONO, fontSize: 8, color: TRANCHE_COLORS[tr.role] }}>■ {tr.label}</span>
                  ))}
                </div>
              </div>
            )}
          </SectionPanel>

          {/* ── Waterfall Config panel ──────────────────────────────────────── */}
          <SectionPanel title="WATERFALL CONFIG" subtitle="American = per-period · European = fund-end crystallization · trigger types: ROC / PREF / CATCH-UP / PROMOTE" borderColor={BT.text.purple}>
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
            </div>
            {/* Tier table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                    {['TIER', 'TRIGGER TYPE', 'HURDLE IRR', 'LP %', 'GP PROMOTE %', ''].map(h => (
                      <th key={h} style={{ padding: '3px 8px', color: BT.text.muted, textAlign: h === 'TIER' || h === 'TRIGGER TYPE' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 8px', color: BT.text.purple, fontWeight: 700 }}>TIER {i + 1}</td>
                      <td style={{ padding: '3px 8px' }}>
                        <select value={tier.triggerType} onChange={async e => {
                          const val = e.target.value as TriggerType;
                          const next = tiers.map((t, j) => j === i ? { ...t, triggerType: val } : t);
                          setTiers(next); await persistTiers(next);
                        }} style={{
                          background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
                          color: BT.text.amber, fontFamily: MONO, fontSize: 8, padding: '2px 4px',
                          colorScheme: 'dark',
                        }}>
                          {Object.entries(TRIGGER_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        {tier.triggerType === 'promote'
                          ? <EditNum value={tier.triggerIrr} pct onCommit={async v => {
                              const next = tiers.map((t, j) => j === i ? { ...t, triggerIrr: v } : t);
                              setTiers(next); await persistTiers(next);
                            }} />
                          : <span style={{ color: BT.text.muted }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        <EditNum value={tier.lpPct} pct onCommit={async v => {
                          const next = tiers.map((t, j) => j === i ? { ...t, lpPct: v, gpPct: +(1 - v).toFixed(4) } : t);
                          setTiers(next); await persistTiers(next);
                        }} />
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        <EditNum value={tier.gpPct} pct onCommit={async v => {
                          const next = tiers.map((t, j) => j === i ? { ...t, gpPct: v, lpPct: +(1 - v).toFixed(4) } : t);
                          setTiers(next); await persistTiers(next);
                        }} />
                      </td>
                      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                        {tiers.length > 1 && (
                          <button onClick={async () => {
                            const next = tiers.filter((_, j) => j !== i);
                            setTiers(next); await persistTiers(next);
                          }} style={{
                            background: 'transparent', border: `1px solid ${BT.border.medium}`,
                            color: BT.text.red, fontFamily: MONO, fontSize: 8, padding: '1px 5px', cursor: 'pointer', borderRadius: 2,
                          }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 4 }}>
              {(['roc', 'pref_return', 'catch_up', 'promote'] as TriggerType[])
                .filter(tt => tt === 'promote' || !tiers.some(t => t.triggerType === tt))
                .map(tt => (
                  <button key={tt} onClick={async () => {
                    const next = [...tiers, { triggerType: tt, triggerIrr: 0.15, lpPct: 0.70, gpPct: 0.30 }];
                    setTiers(next); await persistTiers(next);
                  }} style={{
                    background: 'transparent', border: `1px solid ${BT.border.medium}`,
                    color: BT.text.muted, fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                  }}>+ {TRIGGER_TYPE_LABELS[tt]}</button>
                ))}
            </div>
          </SectionPanel>

          {/* ── Fee Modeling panel ──────────────────────────────────────────── */}
          <SectionPanel title="FEE MODELING" subtitle="GP compensation · acquisition, management, disposition, refinancing" borderColor={BT.text.amber}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {([
                { key: 'acquisitionFeePct',   label: 'ACQUISITION FEE',    sub: `${fmt$(equity * fees.acquisitionFeePct)} at close` },
                { key: 'assetMgmtFeePct',     label: 'ASSET MGMT FEE (PA)', sub: `${fees.assetMgmtBasis.toUpperCase()} basis · ${fmt$((fees.assetMgmtBasis === 'equity' ? equity : egi_y1) * fees.assetMgmtFeePct)}/yr` },
                { key: 'constructionMgmtPct', label: 'CONSTRUCTION MGMT',   sub: fees.constructionMgmtPct > 0 ? fmt$(equity * fees.constructionMgmtPct) : 'Not applicable' },
                { key: 'dispositionFeePct',   label: 'DISPOSITION FEE',     sub: 'Of gross sale price' },
                { key: 'refinancingFeePct',   label: 'REFINANCING FEE',     sub: 'Of refi loan amount' },
              ] as const).map(({ key, label, sub }) => (
                <div key={key} style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{sub}</div>
                  </div>
                  <EditNum value={(fees as unknown as Record<string, number>)[key]} pct onCommit={v => {
                    setFees(prev => ({ ...prev, [key]: v }));
                    patch(key, v);
                  }} />
                </div>
              ))}
              <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 600 }}>ASSET MGMT BASIS</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>Equity or EGI</div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['equity', 'egi'].map(b => (
                    <button key={b} onClick={() => { setFees(p => ({ ...p, assetMgmtBasis: b })); patch('assetMgmtBasis', b); }} style={{
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
            <SectionPanel title="LP RETURN SUMMARY" subtitle="All LP tranches combined" borderColor={BT.met.financial}>
              <DataRow label="LP EQUITY IN"    value={lpEquity > 0 ? fmt$(lpEquity) : '—'}                        valueColor={BT.text.white} />
              <DataRow label="TOTAL LP DIST"   value={totalLP > 0 ? fmt$(totalLP) : '—'}                          valueColor={BT.met.financial} />
              <DataRow label="LP EQUITY MULT"  value={lpEm != null ? fmtX(lpEm) : '—'}                            valueColor={lpEm != null && lpEm >= 1.8 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP IRR"           value={lpIrr != null ? fmtPct(lpIrr * 100) : '—'}                 valueColor={lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber} />
              <DataRow label="PREF RATE"        value={fmtPct(prefRate * 100)}                                     valueColor={BT.text.cyan} border={false} />
            </SectionPanel>
            <SectionPanel title="GP ECONOMICS" subtitle="Promote + fees all-in" borderColor={BT.text.orange}>
              <DataRow label="GP EQUITY IN"    value={gpEquity > 0 ? fmt$(gpEquity) : '—'}                        valueColor={BT.text.white} />
              <DataRow label="GP TOTAL DIST"   value={totalGP > 0 ? fmt$(totalGP) : '—'}                          valueColor={BT.text.orange} />
              <DataRow label="GP PROMOTE"      value={totalPromote > 0 ? fmt$(totalPromote) : '—'}                valueColor={BT.text.amber} />
              <DataRow label="GP ALL-IN FEES"  value={totalFees > 0 ? fmt$(totalFees) : '—'}                      valueColor={BT.text.red} />
              <DataRow label="GP ALL-IN MULT"  value={gpEm != null ? fmtX(gpEm) : '—'}                            valueColor={BT.text.orange} border={false} />
            </SectionPanel>
          </div>
        </>
      ) : (
        <>
          {/* ── Distribution Schedule ────────────────────────────────────────── */}
          <SectionPanel title="DISTRIBUTION SCHEDULE" subtitle={`${holdYears}-year hold · ${wfType.toUpperCase()} waterfall · ${fmtPct(prefRate * 100)} pref · ★ = promote crystallizes`} borderColor={BT.text.purple}>
            {distRows.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
                Configure equity structure and NOI to generate distribution schedule
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
                  <thead>
                    <tr style={{ background: BT.bg.header, borderBottom: `2px solid ${BT.border.medium}` }}>
                      {['PERIOD', 'CFADS', 'ACTIVE TIER', 'LP DIST', 'GP DIST', 'GP PROMOTE', 'GP FEES', 'PREF ACCRUED', 'PREF PAID', 'LP IRR', 'LP EM'].map(h => (
                        <th key={h} style={{
                          padding: '3px 6px', color: BT.text.muted, fontWeight: 600,
                          textAlign: h === 'PERIOD' || h === 'ACTIVE TIER' ? 'left' : 'right',
                          whiteSpace: 'nowrap', position: 'sticky', top: 0, background: BT.bg.header, zIndex: 1,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distRows.map((row, i) => (
                      <tr key={i} style={{
                        background: row.isPromoteCrystallize ? `${BT.text.amber}12` : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                        borderBottom: `1px solid ${BT.border.subtle}`,
                      }}>
                        <td style={{ padding: '3px 6px', color: row.isPromoteCrystallize ? BT.text.amber : BT.text.cyan, fontWeight: row.isPromoteCrystallize ? 700 : 400 }}>
                          {row.label}
                        </td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.white }}>{row.cfads > 0 ? fmt$(row.cfads) : '—'}</td>
                        <td style={{ padding: '3px 6px', color: BT.text.purple }}>{row.activeTier}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.met.financial, fontWeight: 600 }}>{row.lpDist > 0 ? fmt$(row.lpDist) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.orange }}>{row.gpDist > 0 ? fmt$(row.gpDist) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: row.gpPromote > 0 ? BT.text.amber : BT.text.muted }}>{row.gpPromote > 0 ? fmt$(row.gpPromote) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.red }}>{row.gpFees > 0 ? fmt$(row.gpFees) : '—'}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: BT.text.muted }}>{row.prefAccrued > 0 ? fmt$(row.prefAccrued) : '—'}</td>
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
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                      <td style={{ padding: '4px 6px', color: BT.text.muted, fontWeight: 700 }}>TOTAL</td>
                      <td /><td />
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.met.financial, fontWeight: 700 }}>{fmt$(totalLP)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.orange, fontWeight: 700 }}>{fmt$(totalGP)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>{fmt$(totalPromote)}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: BT.text.red, fontWeight: 700 }}>{fmt$(totalFees)}</td>
                      <td /><td />
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

          {/* ── Distribution flow viz ────────────────────────────────────────── */}
          <SectionPanel title="DISTRIBUTION FLOW" subtitle="LP vs GP by period" borderColor={BT.text.purple}>
            <div style={{ padding: '10px 12px' }}>
              {distRows.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 80 }}>
                    {distRows.map((row, i) => {
                      const total = row.lpDist + row.gpDist;
                      const maxT  = Math.max(...distRows.map(r => r.lpDist + r.gpDist), 1);
                      const barH  = Math.max(10, (total / maxT) * 64);
                      const lpH   = total > 0 ? (row.lpDist / total) * barH : barH * 0.7;
                      const gpH   = total > 0 ? (row.gpDist / total) * barH : barH * 0.3;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{total > 0 ? fmt$(total) : '—'}</span>
                          <div style={{ width: '100%', borderRadius: 2, overflow: 'hidden' }}>
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
            <SectionPanel title="LP INVESTOR RETURNS" subtitle="All LP tranches" borderColor={BT.met.financial}>
              <DataRow label="LP EQUITY IN"    value={lpEquity > 0 ? fmt$(lpEquity) : '—'}                        valueColor={BT.text.white} />
              <DataRow label="LP TOTAL OUT"    value={totalLP > 0 ? fmt$(totalLP) : '—'}                          valueColor={BT.met.financial} />
              <DataRow label="LP EQUITY MULT"  value={lpEm != null ? fmtX(lpEm) : '—'}                            valueColor={lpEm != null && lpEm >= 1.8 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP IRR"           value={lpIrr != null ? fmtPct(lpIrr * 100) : '—'}                 valueColor={lpIrr != null && lpIrr >= 0.12 ? BT.met.financial : BT.text.amber} />
              <DataRow label="LP PREF RATE"     value={fmtPct(prefRate * 100)}                                     valueColor={BT.text.cyan} border={false} />
            </SectionPanel>
            <SectionPanel title="GP ECONOMICS" subtitle="Promote + fees all-in" borderColor={BT.text.orange}>
              <DataRow label="GP CO-INVEST IN" value={gpEquity > 0 ? fmt$(gpEquity) : '—'}                        valueColor={BT.text.white} />
              <DataRow label="GP TOTAL DIST"   value={totalGP > 0 ? fmt$(totalGP) : '—'}                          valueColor={BT.text.orange} />
              <DataRow label="GP PROMOTE"      value={totalPromote > 0 ? fmt$(totalPromote) : '—'}                valueColor={BT.text.amber} />
              <DataRow label="GP TOTAL FEES"   value={totalFees > 0 ? fmt$(totalFees) : '—'}                      valueColor={BT.text.red} />
              <DataRow label="GP ALL-IN MULT"  value={gpEm != null ? fmtX(gpEm) : '—'}                            valueColor={BT.text.orange} border={false} />
            </SectionPanel>
          </div>
        </>
      )}
    </div>
  );
}

export default WaterfallTab;
