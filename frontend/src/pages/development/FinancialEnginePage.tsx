import React, { useState, useEffect, useCallback, useMemo, useRef, Component } from 'react';
import { useParams } from 'react-router-dom';
import { useUserRole } from '../../hooks/useUserRole';
import { Brain, Send, ChevronUp, ChevronDown } from 'lucide-react';
import {
  BT, BT_CSS,
  SubTabBar, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { OverviewTab } from './financial-engine/OverviewTab';
import { ProFormaSummaryTab } from './financial-engine/ProFormaSummaryTab';
import { ConsoleHubTab } from './financial-engine/ConsoleHubTab';
import { ProjectionsHubTab } from './financial-engine/ProjectionsHubTab';
import { CapitalHubTab } from './financial-engine/CapitalHubTab';
import { ReturnsHubTab } from './financial-engine/ReturnsHubTab';
import { CompareHubTab } from './financial-engine/CompareHubTab';
import { DecisionTab } from './financial-engine/DecisionTab';
import { RoadmapTab } from './financial-engine/RoadmapTab';
import { SensitivityTab } from './financial-engine/SensitivityTab';
import { CustomTabRenderer } from './financial-engine/CustomTabRenderer';
import { exportToExcel } from './financial-engine/excel-export';
import type { ModelAssumptions, ModelResults, ModelVersion, DealType, F9DealFinancials, EvidenceFieldMeta, LeasingCostTreatment } from './financial-engine/types';
import type { BroaderGoalSeekResult, SolveVariable, TargetMetric } from '../../components/F9/GoalSeekWidget';
import { fmt$, fmtPct, fmtX } from './financial-engine/types';
import { apiClient } from '../../services/api.client';
import { useDealStore } from '../../stores/dealStore';
import { opusProformaService, type CustomTabRow } from '../../services/opusProforma.service';
import { F9SummaryBar } from '../../components/f9/F9SummaryBar';
import { formatOverrideNote } from './financial-engine/field-labels';
import { useSourceDocuments } from '../../hooks/useSourceDocuments';

// ── Safe array coercion — guards against the API returning objects/nulls ──────
function toArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

// ── Normalize ModelResults from any source (DB, build, version load) ─────────
// The engine stores sourcesAndUses.sources / .uses as Record<string,number>
// objects; ModelResults and all tabs expect {label,amount}[] arrays.
// Apply this before every setModelResults call.
// AnnualCashFlow row field-name reconciliation. Three sources of truth disagree:
//   - Deterministic runner: preTaxCashFlow / grossPotentialRent / effectiveGrossIncome / totalExpenses
//   - LLM schema:           beforeTaxCashFlow|leveredCashFlow / potentialRent / effectiveGrossRevenue / totalExpenses
//   - Frontend OverviewTab: cashFlow / gpr / egr / opex / totalRevenue
// This adapter coerces any input shape into the keys OverviewTab reads, leaving
// the original keys intact (so consumers that depend on them keep working).
function normalizeCashFlowRow(r: Record<string, unknown>): Record<string, unknown> {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const pick = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = num(r[k]);
      if (v != null) return v;
    }
    return null;
  };
  return {
    ...r,
    cashFlow:     r.cashFlow     ?? pick('beforeTaxCashFlow', 'leveredCashFlow', 'preTaxCashFlow'),
    gpr:          r.gpr          ?? pick('potentialRent', 'grossPotentialRent'),
    egr:          r.egr          ?? pick('effectiveGrossRevenue', 'effectiveGrossIncome'),
    totalRevenue: r.totalRevenue ?? pick('effectiveGrossRevenue', 'effectiveGrossIncome'),
    opex:         r.opex         ?? pick('totalExpenses'),
  };
}

function normalizeModelResults(raw: ModelResults): ModelResults {
  if (!raw) return raw;
  // sourcesAndUses normalization
  if (raw.sourcesAndUses) {
    const su = raw.sourcesAndUses as { sources: unknown; uses: unknown };
    if (su.sources && !Array.isArray(su.sources)) {
      su.sources = Object.entries(su.sources as Record<string, number>).map(
        ([label, amount]) => ({ label, amount }),
      );
    }
    if (su.uses && !Array.isArray(su.uses)) {
      su.uses = Object.entries(su.uses as Record<string, number>).map(
        ([label, amount]) => ({ label, amount }),
      );
    }
  }
  // Ensure array fields are always arrays
  if (raw.annualCashFlow != null && !Array.isArray(raw.annualCashFlow)) {
    (raw as any).annualCashFlow = [];
  }
  if (raw.waterfallDistributions != null && !Array.isArray(raw.waterfallDistributions)) {
    (raw as any).waterfallDistributions = [];
  }
  // Reconcile cash-flow row field names across runners (see normalizeCashFlowRow).
  if (Array.isArray(raw.annualCashFlow)) {
    raw.annualCashFlow = raw.annualCashFlow.map(r => normalizeCashFlowRow(r as unknown as Record<string, unknown>)) as ModelResults['annualCashFlow'];
  }
  // Backend persists the deterministic runner's field names (lpEquityMultiple /
  // gpEquityMultiple) on result.summary, but OverviewTab reads summary.lpEm /
  // summary.gpEm. normalizeBuildResponse already aliases these on the build
  // path; we must do the same on the DB-load path or LP/GP EM render as "—"
  // on every page reload until the user triggers a rebuild.
  if (raw.summary) {
    const s = raw.summary as Record<string, unknown>;
    if (s.lpEm == null && typeof s.lpEquityMultiple === 'number') s.lpEm = s.lpEquityMultiple;
    if (s.gpEm == null && typeof s.gpEquityMultiple === 'number') s.gpEm = s.gpEquityMultiple;
  }
  return raw;
}

// ── Helpers to merge model results into f9Financials shape ──────────────────
function cloneFinancialsForSync(src: F9DealFinancials): F9DealFinancials {
  try { return JSON.parse(JSON.stringify(src)); } catch { return src; }
}

function mergeModelIntoFinancials(
  src: F9DealFinancials,
  model: ModelResults,
  assumptions: ModelAssumptions | null
): F9DealFinancials {
  const out = cloneFinancialsForSync(src);

  // ── Returns ──
  const s = model.summary ?? {};
  out.returns = out.returns ?? {};
  // ── LV engine guard ─────────────────────────────────────────────────────
  // When the backend Lease Velocity engine has run (src.leaseVelocity != null)
  // AND the /financials response includes a returns object, preserve those
  // treatment-aware values — do NOT overwrite with the legacy model summary
  // which is treatment-agnostic.  Without this guard, toggling
  // leasing_cost_treatment re-fetches /financials with treatment-aware returns
  // but mergeModel would immediately clobber them.
  //
  // Guard rationale: keyed on `src.leaseVelocity != null` (LV engine has run)
  // AND `src.returns != null` (backend included a returns object) rather than
  // `lpNetIrr != null` — the latter would silently fall back to legacy metrics
  // if the backend intentionally returns a null IRR (e.g. insufficient hold
  // period).  A null backend IRR should propagate as null, not be replaced with
  // a treatment-agnostic legacy value.
  const hasLvReturns = src.leaseVelocity != null && src.returns != null;
  out.returns.lpNetIrr          = hasLvReturns ? src.returns!.lpNetIrr         : (s.lpIrr        ?? s.irr ?? null);
  out.returns.lpEquityMultiple  = hasLvReturns ? src.returns!.lpEquityMultiple  : (s.lpEm         ?? s.equityMultiple ?? null);
  out.returns.avgCashOnCash     = hasLvReturns ? src.returns!.avgCashOnCash     : (s.lpCoC        ?? s.cashOnCash ?? null);
  out.returns.gpPromoteEarned   = hasLvReturns ? src.returns!.gpPromoteEarned   : (s.gpPromoteEarned ?? null);
  out.returns.unleveragedIrr    = null;
  out.returns.unleveragedEm     = null;
  // FIX: type has `proforma.valuationSnapshot.goingInCapT12`, not `proforma.valuation.capRate.resolved`.
  // Previous path silently returned undefined → null on every deal.
  out.returns.goingInCapRate    = src.proforma?.valuationSnapshot?.goingInCapT12 ?? null;
  // FIX: stabilized cap rate is unrelated to IRR. Previous fallback (`s.irr * 0.85`)
  // produced a confidently-wrong number. Return null rather than fabricate.
  out.returns.stabilizedCapRate = null;
  out.returns.yocUntrended      = s.yieldOnCost ?? null;
  out.returns.totalLpDistributions = s.lpTotalDistributions ?? null;
  out.returns.totalGpFees       = null;
  out.returns.totalGpPromote    = s.gpPromoteEarned ?? null;
  out.returns.gpCoInvestIrr     = s.gpIrr ?? null;
  out.returns.gpCoInvestEm      = s.gpEm ?? null;
  // gpAllInMultiple is LP+GP combined including fees/promote attribution —
  // not derivable from gpEm alone. Previous code multiplied gpEm × 1.3 with
  // no derivation, producing a confidently-wrong number on the ReturnsTab
  // KPI tile. Same pattern as stabilizedCapRate above: return null rather
  // than fabricate. Wire the real calculation when waterfall attribution
  // surfaces totalGpFees / totalGpPromote per the type contract.
  out.returns.gpAllInMultiple   = null;
  out.returns.peakEquityDeployed = null;
  out.returns.prefAccrued       = null;
  out.returns.prefPaid          = null;
  out.returns.equityRecoveryYear = null;
  out.returns.breakevenCfYear   = null;
  out.returns.minDscr           = s.dscr ?? null;
  out.returns.maxLtv            = null;
  out.returns.avgDscr           = s.dscr ?? null;
  out.returns.avgNoiGrowth      = null;
  // NOTE: gpPromoteEarned intentionally NOT repeated here — line above (with LV guard) is the
  // single assignment point. The duplicate unconditional assignment has been removed to preserve
  // treatment-aware gpPromote when the LV engine is connected.
  out.returns.lpTrancheReturns  = [];
  out.returns.netDistributionsByYear = toArr<any>(model.annualCashFlow).map(r => r.lpDistribution ?? null);
  out.returns.cumulativeCfByYear = toArr<any>(model.annualCashFlow).reduce<number[]>((acc, r, i) => {
    const prev = i > 0 ? acc[i - 1] : 0;
    acc.push(prev + (r.cashFlow ?? 0));
    return acc;
  }, []);
  out.returns.valuation = {
    // FIX: type has `proforma.valuationSnapshot.pricePerUnit`, not `valuation.perUnit`.
    // Previous path silently returned undefined → null on every deal.
    perUnit: { goingIn: src.proforma?.valuationSnapshot?.pricePerUnit ?? null, stabilized: null, atExit: null, submarketMedian: null, percentile: null },
    perSF: { netRentable: { goingIn: null, stabilized: null, atExit: null, submarketMedian: null, percentile: null } },
    multiples: { grm: { goingIn: null, submarketMedian: null }, gim: { goingIn: null, submarketMedian: null }, nim: null, opexRatio: { y1: null }, coc: { y1: null }, yieldOnCost: { untrended: null, trended: null }, devSpread: null },
    replacementCost: null,
    positionMatrix: null,
  };
  out.returns.debtMetrics = {
    coverage: {
      dscrY1: s.dscr ?? null,
      dscrMin: { value: s.dscr ?? null, year: 1 },
      dscrAvg: s.dscr ?? null,
      dyY1: null,
      dyMin: { value: null, year: null },
      icr: null,
      cashFlowCoverage: null,
      loanConstantBlended: null,
    },
    structural: {
      ltvAtClose: null,
      ltvAtStab: null,
      ltvAtMaturity: null,
      ltc: null,
      ltsv: null,
      refiOutProbability: null,
      maturityRiskScore: null,
    },
    leverage: { positiveLeverage: null, leverageSpreadBps: null, cashOnCashSpread: null, leverageIrrLiftBps: null },
    stress: { breakevenOccupancy: null, breakevenRent: null, dscrAtMinus10PctNOI: null, dscrAtPlus200bps: null, cashTrapDistanceBps: null, defaultBufferMonths: null },
    refi: { defeasanceCostToday: null, ymCostToday: null, costToRefiNowBps: null },
  };

  // ── Waterfall ──
  out.waterfall = {
    waterfallType: 'american',
    prefRate: 0.08,
    lpShare: 0.9,
    gpShare: 0.1,
    tiers: toArr<any>(model.waterfallDistributions).map((w, i) => ({
      triggerIrr: w.hurdleRate ?? 0.08 + i * 0.03,
      lpPct: w.lpSplit ?? 0.8 - i * 0.1,
      gpPct: w.gpSplit ?? 0.2 + i * 0.1,
      triggerType: i === 0 ? 'pref_return' : 'promote',
    })),
    fees: { acquisitionFeePct: 0.01, assetMgmtFeePct: 0.015, assetMgmtBasis: 'equity', constructionMgmtPct: 0, dispositionFeePct: 0.01, refinancingFeePct: 0 },
  };

  // ── Capital stack (preserve existing, merge loan from model) ──
  if (!out.capitalStack) out.capitalStack = {};
  // FIX: src.valuation.purchasePrice doesn't exist on F9DealFinancials.
  // The canonical path is src.capitalStack.purchasePrice (already populated by the composer).
  // Previous path silently returned undefined → 0 every time assumptions was missing,
  // zeroing out PPU/equity/return calcs downstream.
  out.capitalStack.purchasePrice = assumptions?.acquisition?.purchasePrice ?? src.capitalStack?.purchasePrice ?? 0;
  out.capitalStack.loanAmount = assumptions?.financing?.loanAmount ?? 0;
  out.capitalStack.interestRate = assumptions?.financing?.interestRate ?? 0.07;
  out.capitalStack.equityAtClose = Math.max((out.capitalStack.purchasePrice ?? 0) - (out.capitalStack.loanAmount ?? 0), 0);
  out.capitalStack.ltc = out.capitalStack.purchasePrice ? (out.capitalStack.loanAmount ?? 0) / out.capitalStack.purchasePrice : null;

  // ── Projections: preserve the composer's ProjYear[] shape ──
  // The composer's buildProjections() produces the full keyed shape that
  // ProjectionsTab expects (vacancyLoss, lossToLease, payroll, repairs, …).
  // model.annualCashFlow uses different key names (vacancy, egr, opex…) so
  // overwriting here broke every revenue-deduction and expense row in the tab.
  // The model's annualCashFlow is already consumed for returns/waterfall/capital
  // below — we don't need it here.

  // ── Capital from model sourcesAndUses ──
  out.capital = {
    tranches: [
      { id: 'lpA', label: 'LP CLASS A', role: 'lp', pct: 90, prefRate: out.waterfall.prefRate, compounding: 'annual', cumulative: true, participatePromote: true },
      { id: 'gp', label: 'GP CO-INVEST', role: 'gp', pct: 10, prefRate: 0, compounding: 'annual', cumulative: false, participatePromote: true },
    ],
    schedule: toArr<any>(model.annualCashFlow).map((r, i) => ({
      year: r.year,
      prefAccrued: 0,
      prefPaid: Math.min((r.cashFlow ?? 0) * 0.9, 100000),
      lpDist: (r.cashFlow ?? 0) * 0.9,
      gpDist: (r.cashFlow ?? 0) * 0.1,
    })),
    metrics: { lpIrr: s.lpIrr ?? s.irr ?? 0, lpEm: s.lpEm ?? s.equityMultiple ?? 1, prefRecoveryYear: null },
  };

  return out;
}

/**
 * normalizeBuildResponse
 *
 * Maps the DeepSeek model build response shape to the frontend ModelResults
 * type so that all tabs (Assumptions, Sensitivity, Waterfall, etc.) receive
 * consistent data.
 *
 * Key transformations:
 *  - cashOnCashByYear[] → avg cashOnCash scalar
 *  - noiByYear[] → summary.noi (Y1)
 *  - annualCashFlow.grossPotentialRent → .gpr
 *  - annualCashFlow.effectiveGrossIncome → .egr
 *  - annualCashFlow.preTaxCashFlow → .cashFlow
 *  - sourcesAndUses Record → {label,amount}[] arrays
 *  - waterfallDistributions simplified row → tier-based objects
 */
function normalizeBuildResponse(raw: any): ModelResults {
  if (!raw) return raw;

  const s = raw.summary ?? {};
  const af = raw.annualCashFlow ?? [];

  // Derive scalar cashOnCash. Schema differs between runners:
  //   deterministic: s.cashOnCashByYear (number[]) + s.avgCoC (number)
  //   LLM:           s.cashOnCash       (number[])
  // Prefer the runner-injected scalar avgCoC; otherwise average non-zero years
  // from whichever array shape is present.
  const avgCoC = (() => {
    if (typeof s.avgCoC === 'number') return s.avgCoC;
    const arr = (Array.isArray(s.cashOnCashByYear) ? s.cashOnCashByYear
              : Array.isArray(s.cashOnCash)        ? s.cashOnCash
              : null) as number[] | null;
    if (!arr || arr.length === 0) return 0;
    const nonZero = arr.filter((v: number) => v > 0);
    return nonZero.length > 0
      ? nonZero.reduce((a: number, b: number) => a + b, 0) / nonZero.length
      : 0;
  })();

  // Y1 NOI. Schema differs:
  //   deterministic: s.noiByYear[0] + s.noiYear1
  //   LLM:           s.noiYear1
  // Final fallback: first row of annualCashFlow.
  const noiY1 = (() => {
    if (Array.isArray(s.noiByYear) && s.noiByYear.length > 0) return s.noiByYear[0];
    if (typeof s.noiYear1 === 'number') return s.noiYear1;
    return af[0]?.netOperatingIncome ?? 0;
  })();

  // Average DSCR. Schema differs:
  //   deterministic: s.dscrByYear (number[]) + s.dscr (number scalar)
  //   LLM:           s.dscr       (number[])
  // Coerce to scalar regardless of shape so OverviewTab's `.toFixed(2)` is safe.
  const avgDscr = (() => {
    const dm = raw.debtMetrics ?? {};
    const fromArr = (arr: unknown): number | null =>
      Array.isArray(arr) && arr.length > 0
        ? (arr as number[]).reduce((a, b) => a + b, 0) / arr.length
        : null;
    return fromArr(s.dscrByYear)
        ?? fromArr(dm.dscrByYear)
        ?? (Array.isArray(s.dscr) ? fromArr(s.dscr) : (typeof s.dscr === 'number' ? s.dscr : null))
        ?? (typeof dm.dscr === 'number' ? dm.dscr : 0);
  })();

  // Derive initial equity for running EM computation.
  // The deterministic runner puts totalEquity in summary; the LLM path may also include it.
  // Fall back to purchasePrice − loanAmount when available.
  const initialEquity: number | null = (() => {
    if (s.totalEquity != null && s.totalEquity > 0) return s.totalEquity;
    if (s.purchasePrice != null && s.loanAmount != null && s.purchasePrice > s.loanAmount) {
      return s.purchasePrice - s.loanAmount;
    }
    return null;
  })();

  // Map annual cash flow
  // cumulativeReturn and runningEM are NOT in the backend AnnualCashFlowRow —
  // they are computed here as running totals from the cashFlow column.
  let runningCumulativeCf = 0;
  const annualCashFlow = af.map((r: any, i: number) => {
    const equityCf = r.equityCashFlow ?? r.leveredCashFlow ?? r.preTaxCashFlow ?? r.cfads ?? 0;
    // Total operating expenses from individual categories if available
    const totalOpex = r.totalExpenses ?? r.operatingExpenses ?? 0;
    // If operatingExpenses is a Record, sum it
    const opexTotal = typeof totalOpex === 'object'
      ? Object.values(totalOpex as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
      : Number(totalOpex);

    runningCumulativeCf += equityCf;

    return {
      year: r.year ?? i + 1,
      gpr: r.grossPotentialRent ?? r.potentialRent ?? 0,
      vacancy: r.vacancyLoss ?? r.vacancy ?? 0,
      egr: r.effectiveGrossRevenue ?? r.effectiveGrossIncome ?? r.netRentalIncome ?? 0,
      otherIncome: r.otherIncome ?? 0,
      totalRevenue: r.totalRevenue ?? 0,
      opex: opexTotal,
      noi: r.netOperatingIncome ?? r.noi ?? 0,
      debtService: r.debtService ?? r.totalDebtService ?? 0,
      cashFlow: equityCf,
      lpDistribution: r.lpDistribution ?? r.leveredCashFlow,
      gpDistribution: r.gpDistribution,
      // Computed running totals — not returned by backend, derived from cashFlow
      cumulativeReturn: runningCumulativeCf,
      runningEM: initialEquity != null && initialEquity > 0
        ? (initialEquity + runningCumulativeCf) / initialEquity
        : null,
    };
  });

  // Map sourcesAndUses: Record → [{label,amount}]
  const su = raw.sourcesAndUses ?? {};
  const sourcesArray = (() => {
    const src = su.sources ?? {};
    if (Array.isArray(src)) return src;
    return Object.entries(src as Record<string, number>).map(([l, a]) => ({ label: l, amount: a }));
  })();
  const usesArray = (() => {
    const u = su.uses ?? {};
    if (Array.isArray(u)) return u;
    return Object.entries(u as Record<string, number>).map(([l, a]) => ({ label: l, amount: a }));
  })();

  // Map waterfall: simplified row → tier-based objects
  const wf = raw.waterfallDistributions ?? [];
  const waterfallDistributions = (Array.isArray(wf) && wf.length > 0)
    ? wf.map((r: any, i: number) => ({
        tier: r.tier ?? `Tier ${i + 1}`,
        hurdleRate: r.hurdleRate ?? 0.08,
        lpAmount: r.lpDistribution ?? r.lpAmount ?? 0,
        gpAmount: r.gpDistribution ?? r.gpAmount ?? 0,
        lpSplit: r.lpSplit ?? 0.8,
        gpSplit: r.gpSplit ?? 0.2,
        promotePct: r.promotePct ?? 0.2,
      }))
    : [];

  return {
    summary: {
      irr: s.irr ?? 0,
      equityMultiple: s.equityMultiple ?? 0,
      cashOnCash: avgCoC,
      noi: noiY1,
      dscr: avgDscr,
      yieldOnCost: s.yieldOnCost ?? s.goingInCapRate,
      exitCapRate: s.exitCapRate ?? null,
      goingInCapRate: s.goingInCapRate ?? null,
      exitValue: s.exitValue ?? 0,
      // totalProfit is injected from the deterministic runner; raw.lpProfit is
      // a legacy LLM-path location kept as a defensive fallback.
      totalProfit: s.totalProfit ?? raw.lpProfit ?? s.lpProfit,
      lpIrr: s.lpIrr ?? s.irr,
      // lpEquityMultiple is the deterministic runner's field name; lpEm is the LLM path
      lpEm: s.lpEm ?? s.lpEquityMultiple ?? s.equityMultiple,
      lpCoC: avgCoC,
      lpProfit: raw.lpProfit ?? s.lpProfit,
      // LP/GP distribution totals and GP partner returns — backend fields confirmed in
      // deterministic-model-runner.ts (lines 1710, 1712, 1726–1729). The LLM path may
      // also return these; both spellings are tried.
      lpTotalDistributions: s.lpTotalDistributions ?? null,
      gpIrr: s.gpIrr ?? null,
      // gpEquityMultiple is the deterministic runner's field name; gpEm is the LLM path
      gpEm: s.gpEm ?? s.gpEquityMultiple ?? null,
      gpTotalDistributions: s.gpTotalDistributions ?? null,
      gpPromoteEarned: s.gpPromoteEarned ?? null,
    },
    annualCashFlow,
    sourcesAndUses: {
      sources: sourcesArray,
      uses: usesArray,
    },
    debtMetrics: raw.debtMetrics ?? null,
    sensitivityAnalysis: raw.sensitivityAnalysis ?? null,
    waterfallDistributions,
  };
}

import { EvidencePanel } from '../../components/underwriting/EvidencePanel';

const MONO = BT.font.mono;

// ── Error boundary for individual tabs ─────────────────────────────
// Prevents a single tab crash from unmounting the entire page.
class TabErrorBoundary extends Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[TabErrorBoundary] ${this.props.tabName} crashed:`, error.message, '\nComponent stack:', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8" style={{ background: BT.bg.terminal }}>
          <span className="text-red-400 font-bold text-sm">⚠ TAB CRASHED: {this.props.tabName}</span>
          <span className="text-slate-500 text-[10px] font-mono max-w-md text-center">
            {this.state.error?.message ?? 'Unknown error'}
          </span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-600 rounded hover:bg-slate-700"
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Built-in tabs always come first; custom tabs are appended after.
const BUILTIN_TAB_LABELS = [
  '⊞ OVERVIEW',
  '⊕ CONSOLE',
  '≡ PRO FORMA',
  '⋮≡ PROJECTIONS',
  '◈ CAPITAL',
  '% RETURNS',
  '◐ SCENARIOS',
  '⇔ COMPARE',
  '⊙ GOAL SEEK',
  '⊛ ROADMAP',
];
const BUILTIN_TAB_COUNT = BUILTIN_TAB_LABELS.length;

// Roadmap tab (index 9) is only surfaced for value-add and redevelopment deals.
// Uses a regex matcher rather than DealType[] because the backend project_type
// field can arrive as 'value-add', 'value_add', 'rehab', 'renovation', etc.
function isRoadmapEligibleDealType(dt: string): boolean {
  if (dt === 'redevelopment') return true;
  return /value.?add|rehab|renovation/i.test(dt);
}

interface FinancialEnginePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function FinancialEnginePage({ dealId, deal: propDeal, dealType: propDealType }: FinancialEnginePageProps) {
  const platformRole = useUserRole();
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';
  // Resolve deal type from prop → deal record → platform default.
  // Never silently default to 'existing' when the deal has a project_type on the record.
  const resolvedDealType: DealType = (propDealType as DealType)
    || (propDeal?.project_type as DealType | undefined)
    || 'existing';

  // Roadmap tab (index 9) is only surfaced for value-add and redevelopment deals.
  // Declared early so all subsequent callbacks close over the correct binding.
  const isRoadmapEligible = isRoadmapEligibleDealType(resolvedDealType);
  // When ROADMAP is hidden the custom-tabs strip starts one index earlier.
  const effectiveBuiltinCount = isRoadmapEligible ? BUILTIN_TAB_COUNT : BUILTIN_TAB_COUNT - 1;

  const [activeTab, setActiveTab] = useState(0);

  // LP and lender users default to RETURNS (tab 5).
  // User data is loaded asynchronously after mount, so a lazy useState initializer
  // would read the pre-load default ('sponsor') and produce the wrong tab.
  // Using useRef to ensure we only route once (on first role resolution) and never
  // override a tab the user has manually navigated to.
  const roleTabInitialized = useRef(false);
  useEffect(() => {
    if (!roleTabInitialized.current && (platformRole === 'lp' || platformRole === 'lender')) {
      setActiveTab(prev => prev === 0 ? 5 : prev);
      roleTabInitialized.current = true;
    }
  }, [platformRole]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [assumptions, setAssumptions] = useState<ModelAssumptions | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [activeVersion, setActiveVersion] = useState<ModelVersion | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Spec §13: "saved at HH:MM" indicator (replaces unsaved marker on save).
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // F9 Cache (Task #493): true when local assumptions have drifted from the last build.
  const [staleModel, setStaleModel] = useState(false);
  // Surfaced to the user when handleBuildModel throws. Cleared on the next
  // build attempt. Without this, build failures silently leave every
  // modelResults-derived field blank with no indication of why.
  const [buildError, setBuildError] = useState<string | null>(null);
  // Hash from the last known build — echoed by POST /build and GET /latest responses.
  // Used as the assumptionsHash query param on subsequent GET /latest calls so the
  // backend can detect cross-session staleness (another session built a newer model).
  const [lastBuiltHash, setLastBuiltHash] = useState<string | null>(null);
  const [broaderGoalSeekSolving, setBroaderGoalSeekSolving] = useState(false);
  const [broaderGoalSeekResult, setBroaderGoalSeekResult] = useState<BroaderGoalSeekResult | null>(null);
  const [opusInput, setOpusInput] = useState('');
  const [opusSending, setOpusSending] = useState(false);
  const [opusMessages, setOpusMessages] = useState<Array<{ role: 'user' | 'opus'; text: string; ts: number }>>([]);
  const [opusExpanded, setOpusExpanded] = useState(false);
  const opusInputRef = useRef<HTMLInputElement>(null);
  const opusScrollRef = useRef<HTMLDivElement>(null);
  // Projections gating: true when Pro Forma integrity checks contain errors
  const [integrityBlocked, setIntegrityBlocked] = useState(false);
  // F9 DealFinancials — fetched here so F1/F8/F10 tabs can consume it
  const [f9Financials, setF9Financials] = useState<F9DealFinancials | null>(null);
  // Shared leasing-cost-treatment view override — set by either Location A
  // (Assumptions PATCH, persists to deal) or Location B (ProForma top-bar,
  // view-state only).  Stored here so all tabs receive the same value and
  // the single fetchF9Financials call includes it as a query param.
  // Initialized from propDeal.deal_data.leasing_cost_treatment so the deal's
  // persisted value is honoured on first load, not overridden to OPERATING.
  const initialTreatment = (
    (propDeal as Record<string, unknown> | null | undefined)
      ?.['deal_data'] as Record<string, unknown> | null | undefined
  )?.['leasing_cost_treatment'] as LeasingCostTreatment | undefined ?? 'OPERATING';
  const [lvCostTreatmentView, setLvCostTreatmentView] = useState<LeasingCostTreatment>(initialTreatment);
  // Ref mirrors state so fetchF9Financials closure stays stable (avoids
  // recreating the callback on every treatment toggle).
  const lvTreatmentRef = useRef<LeasingCostTreatment>(initialTreatment);
  // Re-sync if the deal prop itself changes (e.g. navigation to a different deal).
  useEffect(() => {
    const t = (
      (propDeal as Record<string, unknown> | null | undefined)
        ?.['deal_data'] as Record<string, unknown> | null | undefined
    )?.['leasing_cost_treatment'] as LeasingCostTreatment | undefined ?? 'OPERATING';
    lvTreatmentRef.current = t;
    setLvCostTreatmentView(t);
  }, [propDeal]);
  // Evidence system — field click panel + summary bar
  const [evidenceField, setEvidenceField] = useState<{ path: string; label: string } | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<{
    collision_summary?: { severe_count: number; material_count: number; minor_count: number; fields_with_collision?: string[]; severe_collision_fields?: string[]; material_collision_fields?: string[]; minor_collision_fields?: string[] };
    confidence_distribution?: { high: number; medium: number; low: number };
    tier_distribution?: { tier1: number; tier2: number; tier3: number; tier4: number };
    archive_percentile?: number | null;
    field_metadata?: Record<string, EvidenceFieldMeta>;
  } | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<{ type: 'collision' | 'confidence' | 'tier'; value: string } | null>(null);
  // Custom Tabs (Task #451) — Opus-generated F9 sub-tabs.
  const [customTabs, setCustomTabs] = useState<CustomTabRow[]>([]);
  const [customTabsLoading, setCustomTabsLoading] = useState(false);
  const [customTabsError, setCustomTabsError] = useState<string | null>(null);
  const [customTabMenu, setCustomTabMenu] = useState<{ tabId: string; mode: 'menu' | 'rename'; renameValue: string } | null>(null);

  const loadCustomTabs = useCallback(async () => {
    if (!resolvedDealId) return;
    setCustomTabsLoading(true);
    try {
      const tabs = await opusProformaService.listCustomTabs(resolvedDealId);
      setCustomTabs(tabs);
      // Clamp activeTab if a server-side reload removed the tab we were on
      // (e.g. another session deleted it) so we never show a blank pane.
      setActiveTab(prev => {
        const maxValid = effectiveBuiltinCount + tabs.length - 1;
        return prev > maxValid ? Math.max(0, maxValid) : prev;
      });
      setCustomTabsError(null);
    } catch (err: any) {
      setCustomTabsError(err?.message ?? 'failed to load custom tabs');
    } finally {
      setCustomTabsLoading(false);
    }
  }, [resolvedDealId]);

  useEffect(() => { void loadCustomTabs(); }, [loadCustomTabs]);

  const kpi = useMemo(() => modelResults?.summary ?? null, [modelResults]);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setKpiLoading(true);

    // Pass the last known assumptions hash so the backend can signal cross-session
    // staleness (another session built with different assumptions since our last build).
    const latestUrl = lastBuiltHash
      ? `/api/v1/financial-model/${resolvedDealId}/latest?assumptionsHash=${lastBuiltHash}`
      : `/api/v1/financial-model/${resolvedDealId}/latest`;

    Promise.allSettled([
      apiClient.get(`/api/v1/financial-dashboard/${resolvedDealId}/summary`),
      apiClient.get(latestUrl),
    ]).then(([summaryRes, modelRes]) => {
      if (cancelled) return;

      if (summaryRes.status === 'fulfilled') {
        const s = (summaryRes.value as any)?.data?.data?.model?.scenarios?.base;
        if (s && typeof s.irr === 'number') {
          setModelResults(prev => ({
            ...(prev ?? { annualCashFlow: [], sourcesAndUses: { sources: [], uses: [] }, debtMetrics: null, sensitivityAnalysis: null, waterfallDistributions: [] }),
            summary: {
              irr: s.irr,
              equityMultiple: s.equityMultiple ?? 0,
              cashOnCash: s.cashOnCash ?? 0,
              noi: s.noi ?? 0,
              dscr: s.dscr ?? 0,
            },
          }));
        }
      }

      if (modelRes.status === 'fulfilled') {
        const model = (modelRes.value as any)?.data?.data;
        if (model?.results) {
          setModelResults(normalizeModelResults(model.results));
        }
        if (model?.assumptions) {
          setAssumptions(model.assumptions);
        }
        // Hydrate comparison hash from the server on first page load so
        // cross-session staleness can be detected before any local build.
        // Only update when stale is NOT true: updating during a stale response
        // would change lastBuiltHash → re-trigger this effect with the server's
        // own hash → stale flips back to false, clearing the badge.
        if (model?.assumptionsHash && !lastBuiltHash && model?.stale !== true) {
          setLastBuiltHash(model.assumptionsHash);
        }
        // Explicit boolean update — clears the badge on false, sets it on true.
        if (typeof model?.stale === 'boolean') {
          setStaleModel(model.stale);
        }
      }

      setKpiLoading(false);
    }).catch(() => setKpiLoading(false));

    return () => { cancelled = true; };
  // Re-run when lastBuiltHash changes so a post-build fetch can detect
  // whether a concurrent session has meanwhile stored a different model.
  }, [resolvedDealId, lastBuiltHash]);

  // Version history (Spec §13). Backend returns DealVersionRow[]; map to local
  // ModelVersion shape so the existing picker UI keeps working unchanged.
  useEffect(() => {
    if (!resolvedDealId) return;
    setIsLoadingVersions(true);
    apiClient.get(`/api/v1/financial-model/${resolvedDealId}/versions`).then((res: any) => {
      const data = res?.data?.data ?? res?.data ?? [];
      if (!Array.isArray(data)) { setIsLoadingVersions(false); return; }
      const mapped: ModelVersion[] = data.map((row: any) => {
        const snap = row.layered_state_snapshot ?? row.layeredStateSnapshot ?? {};
        const isAgent    = row.save_trigger === 'agent_run';
        const isOverride = row.save_trigger === 'operator_override'
          || (typeof row.note === 'string' && row.note.startsWith('operator_override:'));
        return {
          id: row.id,
          name: isOverride
            ? formatOverrideNote(row.note)
            : (row.note || `v${row.version_number}`),
          timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          source: isAgent ? 'agent' : isOverride ? 'operator_override' : 'user',
          dealType: resolvedDealType,
          assumptions: snap.assumptions ?? snap,
          results: snap.results,
        };
      });
      setVersions(mapped);
      if (mapped.length > 0) {
        setLastSavedAt(mapped[0].timestamp);
      }
    }).catch(() => {}).finally(() => { setIsLoadingVersions(false); });
  }, [resolvedDealId, resolvedDealType]);

  // ── F9 DealFinancials — fetched at page level for F1/F8/F10 cross-tab wiring ─
  const [f9Hold, setF9Hold] = useState<number>(5);
  const f9HoldRef = React.useRef(f9Hold);
  f9HoldRef.current = f9Hold;

  const fetchF9Financials = useCallback((hold?: number) => {
    if (!resolvedDealId) return;
    const h = hold ?? f9HoldRef.current;
    const t = lvTreatmentRef.current;
    apiClient.get<{ success: boolean; data: F9DealFinancials }>(
      `/api/v1/deals/${resolvedDealId}/financials?hold=${h}&leasing_cost_treatment=${t}`,
    ).then(res => {
      if (res.data?.data) setF9Financials(res.data.data);
    }).catch(() => {});
  }, [resolvedDealId]);

  useEffect(() => {
    fetchF9Financials();
  }, [fetchF9Financials]);

  // ── Shared leasing-cost-treatment handler ────────────────────────────────
  // Updates the ref (read by fetchF9Financials closure) and React state, then
  // dispatches leasing_cost_treatment.changed so the reactive event chain drives
  // the re-fetch.  The listener added below calls fetchF9Financials() — keeping
  // treatment change and LV-engine-update in a single consistent pathway.
  const handleLvTreatmentViewChange = useCallback((t: LeasingCostTreatment) => {
    lvTreatmentRef.current = t;
    setLvCostTreatmentView(t);
    // Route through dealStore event bus (consistent with assumption:changed pattern)
    useDealStore.getState().emitLeasingCostTreatmentChanged(t);
  }, []);

  // ── Source Documents — fetch extraction provenance catalogue ─────────────
  const { documents: sourceDocuments } = useSourceDocuments(resolvedDealId);

  // ── Evidence Summary — fetch collision/confidence/tier stats ─────────────
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/deals/${resolvedDealId}/underwriting/evidence-summary`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data ?? null;
        if (d) setEvidenceSummary(d);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  // ── Evidence panel trigger — child tabs dispatch 'fe-evidence-click' ──────
  // Usage from any child tab: window.dispatchEvent(new CustomEvent('fe-evidence-click', { detail: { path: 'income.gpr', label: 'Gross Potential Rent' } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const { path, label } = (e as CustomEvent<{ path: string; label: string }>).detail ?? {};
      if (path) setEvidenceField({ path, label: label ?? path });
    };
    window.addEventListener('fe-evidence-click', handler);
    return () => window.removeEventListener('fe-evidence-click', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (typeof idx === 'number') setActiveTab(idx);
    };
    window.addEventListener('fe-tab-change', handler);
    return () => window.removeEventListener('fe-tab-change', handler);
  }, []);

  // ── Lease Velocity reactive update chain ─────────────────────────────────
  // Re-fetch f9Financials whenever the LV engine emits new output or the
  // cost treatment toggle changes — so S&U reserve, Returns IRR, and the
  // JEDI Position sub-score all update in the same re-fetch cycle.
  useEffect(() => {
    const handler = () => fetchF9Financials();
    window.addEventListener('lease_velocity.output.updated', handler);
    window.addEventListener('leasing_cost_treatment.changed', handler);
    return () => {
      window.removeEventListener('lease_velocity.output.updated', handler);
      window.removeEventListener('leasing_cost_treatment.changed', handler);
    };
  }, [fetchF9Financials]);

  // ── Merge model results into f9Financials so tabs that read
  // ── f9Financials.returns / .waterfall / .projections get populated.
  // ── This runs after every successful model build or version load.
  // ── Recompute projections from current assumptions (no model build needed) ──
  // When the user edits Assumptions, we need ProjectionsTab to reflect those changes
  // immediately without waiting for a full model build. This function maps the current
  // assumptions' rent_growth, expense growth rates, vacancy, and financing terms onto
  // the seeded year1 baseline, so projections update live with every assumption change.
  const mergedFinancials = useMemo(() => {
    if (!f9Financials) return null;
    if (!modelResults) {
      const cloned = cloneFinancialsForSync(f9Financials);
      // Rebuild projections from assumptions if present
      if (assumptions && cloned.projections) {
        const holdYears = assumptions.holdPeriod ?? 5;
        const rentGrowth = assumptions.revenue?.rentGrowth?.[0] ?? 0.03;
        const expenseGrowth = assumptions.expenses
          ? Object.values(assumptions.expenses)[0]?.growthRate ?? 0.03
          : 0.03;
        const vacancyPct = 1 - (assumptions.revenue?.stabilizedOccupancy ?? 0.93);
        const purchasePrice = assumptions.acquisition?.purchasePrice ?? cloned.capitalStack?.purchasePrice ?? 0;
        const loanAmount = assumptions.financing?.loanAmount ?? cloned.capitalStack?.loanAmount ?? 0;
        const interestRate = assumptions.financing?.interestRate ?? 0.065;
        // Project 10 years
        const proj = cloned.projections.map((p: any, i: number) => {
          const yearNum = i + 1;
          if (p.year !== yearNum) { p = { ...p, year: yearNum }; }
          const rg = Math.pow(1 + rentGrowth, i);
          const eg = Math.pow(1 + expenseGrowth, i);
          // Scale revenue by rent growth, expenses by expense growth
          const scaleRv = (v: number | null | undefined) => v != null ? v * rg : null;
          const scaleEx = (v: number | null | undefined) => v != null ? v * eg : null;
          p.gpr =            scaleRv(cloned.projections[0]?.gpr ?? 0);
          p.egr =            scaleRv(cloned.projections[0]?.egr ?? 0);
          p.otherIncome =    scaleRv(cloned.projections[0]?.otherIncome ?? 0);
          p.noi =            scaleRv(cloned.projections[0]?.noi ?? 0);
          p.vacancyLoss =    scaleRv(cloned.projections[0]?.vacancyLoss ?? 0);
          p.lossToLease =    scaleRv(cloned.projections[0]?.lossToLease ?? 0);
          p.concessions =    scaleRv(cloned.projections[0]?.concessions ?? 0);
          p.badDebt =        scaleRv(cloned.projections[0]?.badDebt ?? 0);
          p.occupancy =      cloned.projections[0]?.occupancy != null
            ? Math.min(1, 1 - vacancyPct + (vacancyPct * (1 - 1 / (i + 1))))
            : 1 - vacancyPct;
          // Expenses
          p.payroll =        scaleEx(cloned.projections[0]?.payroll ?? 0);
          p.repairs =        scaleEx(cloned.projections[0]?.repairs ?? 0);
          p.turnover =       scaleEx(cloned.projections[0]?.turnover ?? 0);
          p.contractSvc =    scaleEx(cloned.projections[0]?.contractSvc ?? 0);
          p.marketing =      scaleEx(cloned.projections[0]?.marketing ?? 0);
          p.utilities =      scaleEx(cloned.projections[0]?.utilities ?? 0);
          p.gAndA =          scaleEx(cloned.projections[0]?.gAndA ?? 0);
          p.mgmtFee =        scaleEx(cloned.projections[0]?.mgmtFee ?? 0);
          p.insurance =      scaleEx(cloned.projections[0]?.insurance ?? 0);
          p.reTaxes =        scaleEx(cloned.projections[0]?.reTaxes ?? 0);
          p.reserves =       scaleEx(cloned.projections[0]?.reserves ?? 0);
          p.totalOpex =      scaleEx(cloned.projections[0]?.totalOpex ?? 0);
          // Debt service (constant payment)
          const monthlyRate = interestRate / 12;
          const amortMonths = (assumptions.financing?.amortization ?? 30) * 12;
          let monthlyPmt = 0;
          if (loanAmount > 0 && monthlyRate > 0) {
            monthlyPmt = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) /
              (Math.pow(1 + monthlyRate, amortMonths) - 1);
          }
          p.annualDS = monthlyPmt * 12;
          p.interest = loanAmount > 0 ? loanAmount * interestRate : 0;
          p.principal = p.annualDS > 0 && p.interest != null ? p.annualDS - p.interest : 0;
          p.dscr = p.annualDS > 0 ? (p.noi ?? 0) / p.annualDS : null;
          p.cfbt = p.noi != null && p.annualDS != null ? p.noi - p.annualDS : null;
          p.cfads = p.cfbt;
          // Exit disposition
          const exitCap = assumptions.disposition?.exitCapRate ?? 0.0625;
          const isSaleYear = yearNum === holdYears || yearNum === 10;
          p.exitNoi = isSaleYear ? p.noi : null;
          p.exitCap = isSaleYear ? exitCap : null;
          p.grossSaleValue = isSaleYear && exitCap > 0 && p.noi != null ? p.noi / exitCap : null;
          p.sellingCosts = p.grossSaleValue != null ? p.grossSaleValue * (assumptions.disposition?.sellingCosts ?? 0.02) : null;
          const loanBalance = loanAmount > 0 ? Math.max(0, loanAmount - (p.principal ?? 0) * i) : 0;
          p.loanPayoff = isSaleYear ? loanBalance : null;
          p.netSaleProceeds = p.grossSaleValue != null && p.sellingCosts != null
            ? p.grossSaleValue - p.sellingCosts - loanBalance
            : null;
          // Metrics
          p.capRatePct = purchasePrice > 0 && p.noi != null ? p.noi / purchasePrice : null;
          p.noiMarginPct = p.egr != null && p.egr > 0 && p.noi != null ? p.noi / p.egr : null;
          p.opexRatioPct = p.totalOpex != null && p.egr != null && p.egr > 0 ? p.totalOpex / p.egr : null;
          p.debtYield = loanAmount > 0 && p.noi != null ? p.noi / loanAmount : null;
          p.coc = loanAmount > 0 && p.cfbt != null ? p.cfbt / loanAmount : null;
          p.rentGrowthPct = i === 0 ? rentGrowth : null;
          return p;
        });
        cloned.projections = proj;
      }
      return cloned;
    }
    return mergeModelIntoFinancials(f9Financials, modelResults, assumptions);
  }, [f9Financials, modelResults, assumptions]);

  const handleHoldChange = useCallback((years: number) => {
    setF9Hold(years);
    fetchF9Financials(years);
  }, [fetchF9Financials]);

  const handleBuildModel = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    setBuilding(true);
    setBuildError(null);
    try {
      // The build endpoint calls Claude and can take >30 s — override the global 30 s timeout.
      const res = await apiClient.post(
        '/api/v1/financial-model/build',
        { dealId: resolvedDealId, assumptions },
        { timeout: 120_000 },
      );
      // Response envelope: { success: true, data: { summary, annualCashFlow, ... } }
      // or the API client may unwrap: { data: { summary, ... } }
      // DeepSeek's `result` is the bare FinancialModelResult.
      const raw = (res as any)?.data ?? res;
      const result = raw?.data ?? raw;
      if (result) {
        const normalized = normalizeBuildResponse(result);
        setModelResults(normalized);
        // Assumptions are now in sync with the persisted model.
        setStaleModel(false);
        // Store the hash echoed by the build endpoint for future staleness checks.
        const returnedHash = (res as any)?.data?.assumptionsHash as string | undefined;
        if (returnedHash) setLastBuiltHash(returnedHash);
      }
    } catch (e: any) {
      console.error('Model build failed:', e);
      const serverMsg = e?.response?.data?.error ?? e?.response?.data?.message;
      setBuildError(serverMsg || e?.message || 'Unknown error');
    } finally {
      setBuilding(false);
    }
  }, [resolvedDealId, assumptions]);

  // Bootstrap default assumptions from f9Financials when no saved model exists.
  // This breaks the deadlock: assumptions are normally only loaded from a saved model,
  // but the auto-build guard below requires assumptions to be non-null. For a brand-new
  // deal (NO MODEL state), this seeds sensible defaults so the build can fire automatically.
  useEffect(() => {
    if (!f9Financials || assumptions !== null) return;
    const ff = f9Financials;
    const cs = ff.capitalStack;
    // Guard: if purchasePrice is 0 or missing the financials haven't been composed
    // with real deal assumptions yet. Skip and wait for the next f9Financials update
    // so we don't auto-build with purchasePrice=0, which blanks every derived cell.
    if (!cs?.purchasePrice || cs.purchasePrice <= 0) return;
    const fa = ff.assumptions;
    const getY1 = (field: string): number | null => {
      const v = ff.proforma.year1.find(r => r.field === field)?.resolved;
      return typeof v === 'number' ? v : null;
    };

    const holdYears  = fa.holdYears ?? 10;
    const exitCap    = fa.exitCap ?? 0.055;
    const rentGr1    = fa.rentGrowthYr1 ?? 0.03;
    const rentGrStab = fa.rentGrowthStabilized ?? 0.03;
    const vacPct     = getY1('vacancy_pct') ?? 0.07;
    const ltl        = getY1('loss_to_lease_pct') ?? 0;
    const badDebt    = getY1('bad_debt_pct') ?? 0.01;
    const totalUnits = ff.totalUnits ?? 0;

    // ── Unit mix — map F9 rent roll rows; derive rents from GPR if rents are 0 ──
    const gprAnnual = getY1('gpr') ?? 0;
    const rawUnitMix = ff.rentRollSummary?.unitMix ?? [];
    // Weighted-average sqft across all floor plans (used for sqft-based rent allocation)
    const totalSF    = rawUnitMix.reduce((s, u) => s + (u.avgSf ?? 0) * u.count, 0);
    const avgSF      = rawUnitMix.length > 0 && totalSF > 0
      ? totalSF / rawUnitMix.reduce((s, u) => s + u.count, 0)
      : 0;
    // Fallback average rent per unit (annual GPR ÷ 12 months ÷ units)
    const avgRentPerUnit = totalUnits > 0 && gprAnnual > 0
      ? gprAnnual / (totalUnits * 12)
      : ff.rentRollSummary?.avgInPlaceRent ?? 1500;

    const bedsFromType = (t: string): number => {
      const l = t.toLowerCase();
      if (l.includes('s') || l.startsWith('studio')) return 0;
      if (l.startsWith('b') || l.includes('2b') || l.includes('two')) return 2;
      return 1;
    };

    const unitMix: UnitMixRow[] = rawUnitMix.map(u => {
      const sf = u.avgSf ?? avgSF;
      // Use stored rent if meaningful, otherwise derive from sqft weighting of GPR
      const derivedRent = avgSF > 0 && sf > 0
        ? Math.round(avgRentPerUnit * (sf / avgSF))
        : Math.round(avgRentPerUnit);
      const marketRent  = u.marketRent  && u.marketRent  > 0 ? u.marketRent  : derivedRent;
      const inPlaceRent = u.inPlaceRent && u.inPlaceRent > 0 ? u.inPlaceRent : derivedRent;
      const occ = Math.round(u.count * (u.occupancyPct ?? 0.9));
      return {
        floorPlan:    u.type,
        unitSize:     Math.round(sf),
        beds:         bedsFromType(u.type),
        units:        u.count,
        occupied:     occ,
        vacant:       u.count - occ,
        marketRent,
        inPlaceRent,
      };
    });

    // ── Expenses — pull individual platform-resolved categories; fall back to opex ratio ──
    const opexTotal   = getY1('operating_expenses') ?? getY1('opex_total') ?? getY1('opex') ?? null;
    const mgmtFee     = getY1('management_fee') ?? getY1('mgmt_fee') ?? null;
    const realEstate  = getY1('real_estate_tax') ?? getY1('property_tax') ?? null;
    const insurance   = getY1('insurance') ?? null;
    const rm          = getY1('repairs_maintenance') ?? getY1('r_and_m') ?? null;
    const payroll     = getY1('payroll') ?? null;
    const utilities   = getY1('utilities') ?? null;
    const admin       = getY1('admin') ?? getY1('g_and_a') ?? null;

    const expenseItems: Array<[string, number]> = [
      ['Management Fee',        mgmtFee],
      ['Real Estate Tax',       realEstate],
      ['Insurance',             insurance],
      ['Repairs & Maintenance', rm],
      ['Payroll',               payroll],
      ['Utilities',             utilities],
      ['Administrative',        admin],
    ].filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0);

    // If we got individual items, use them; otherwise use total opex as one line
    const expenses: Record<string, { amount: number; type: 'total' | 'perUnit' | 'pctEGR'; growthRate: number }> =
      expenseItems.length > 0
        ? Object.fromEntries(expenseItems.map(([name, amt]) => [
            name, { amount: Math.round(Math.abs(amt)), type: 'total' as const, growthRate: 0.03 }
          ]))
        : opexTotal && opexTotal > 0
          ? { 'Operating Expenses': { amount: Math.round(opexTotal), type: 'total', growthRate: 0.03 } }
          : {};

    const bootstrapped: ModelAssumptions = {
      dealInfo: {
        dealName:      ff.dealName ?? 'Deal',
        totalUnits,
        netRentableSF: totalSF || 0,
        vintage:       0,
        address:       '',
        city:          '',
        state:         '',
      },
      modelType:  resolvedDealType === 'development' ? 'development' : 'existing',
      holdPeriod: holdYears,
      unitMix,
      acquisition: {
        purchasePrice: cs.purchasePrice ?? 0,
        capRate:       ff.proforma.valuationSnapshot?.goingInCapT12 ?? exitCap,
        closingCosts:  {},
      },
      disposition: {
        exitCapRate:   exitCap,
        sellingCosts:  0.02,
        saleNOIMethod: 'trailing',
      },
      revenue: {
        rentGrowth:          Array.from({ length: holdYears }, (_, i) => i === 0 ? rentGr1 : rentGrStab),
        lossToLease:         ltl,
        stabilizedOccupancy: Math.max(0, 1 - vacPct),
        collectionLoss:      badDebt,
        otherIncome:         {},
      },
      expenses,
      financing: {
        loanAmount:     cs.loanAmount ?? 0,
        loanType:       'fixed',
        interestRate:   cs.interestRate ?? 0.07,
        spread:         0,
        term:           holdYears,
        amortization:   30,
        ioPeriod:       cs.ioPeriodMonths ? Math.round(cs.ioPeriodMonths / 12) : 0,
        originationFee: cs.originationFeePct ?? 0,
        rateCapCost:    0,
        prepayPenalty:  0,
      },
      capex: {
        lineItems:       [],
        contingencyPct:  0.05,
        reservesPerUnit: 250,
      },
      waterfall: {
        lpShare:            0.9,
        gpShare:            0.1,
        hurdles:            [],
        equityContribution: cs.equityAtClose ?? 0,
      },
    };
    setAssumptions(bootstrapped);
  }, [f9Financials, assumptions, resolvedDealType]);

  // Auto-build model when assumptions and financials are both available.
  // Declared after handleBuildModel to avoid a temporal dead zone reference.
  const modelBuiltRef = useRef(false);
  useEffect(() => {
    if (!resolvedDealId || !assumptions || !f9Financials) return;
    if (modelBuiltRef.current) return;
    if (modelResults) {
      modelBuiltRef.current = true;
      return;
    }
    modelBuiltRef.current = true;
    handleBuildModel();
  }, [resolvedDealId, assumptions, f9Financials, modelResults, handleBuildModel]);

  const handleSaveVersion = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    const name = saveVersionName.trim() || `v${versions.length + 1}`;

    // Spec §13: only insert into the local picker AFTER the server confirms
    // the version persisted. Showing a non-persisted entry would corrupt the
    // audit-trail UX (user thinks save succeeded but server has nothing).
    setShowSaveDialog(false);
    setSaveVersionName('');
    try {
      const resp = await apiClient.post(
        `/api/v1/financial-model/${resolvedDealId}/versions`,
        {
          snapshot: { assumptions, results: modelResults ?? null },
          trigger: 'user_save',
          note: name,
        }
      );
      const serverRow = (resp as any)?.data?.data ?? (resp as any)?.data;
      const persistedVersion: ModelVersion = {
        id: serverRow?.id ?? crypto.randomUUID(),
        name,
        timestamp: serverRow?.created_at ? new Date(serverRow.created_at).getTime() : Date.now(),
        source: 'user',
        dealType: resolvedDealType,
        assumptions,
        results: modelResults ?? undefined,
      };
      setVersions(prev => [persistedVersion, ...prev]);
      setActiveVersion(persistedVersion);
      setLastSavedAt(persistedVersion.timestamp);
    } catch (e: any) {
      console.warn('saveVersion failed', e);
      // Re-open the dialog so the user can retry; restore the name they typed.
      setSaveVersionName(name);
      setShowSaveDialog(true);
      window.alert(`Save version failed: ${e?.message ?? 'unknown error'}. Please retry.`);
    }
  }, [resolvedDealId, assumptions, modelResults, saveVersionName, versions.length, resolvedDealType]);

  const handleLoadVersion = useCallback((version: ModelVersion) => {
    setActiveVersion(version);
    setAssumptions(version.assumptions);
    if (version.results) setModelResults(normalizeModelResults(version.results));
    setShowVersionDropdown(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (!resolvedDealId) {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
      return;
    }
    try {
      const holdYears = assumptions?.holdPeriod ?? 5;
      const response = await fetch(
        `/api/v1/deals/${resolvedDealId}/financials/export?hold=${holdYears}`,
        { method: 'GET', credentials: 'include' },
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${assumptions?.dealInfo?.dealName ?? 'deal'}_f9_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
    }
  }, [resolvedDealId, assumptions, modelResults]);

  const handleBroaderGoalSeek = useCallback(async (
    solveFor: SolveVariable,
    targetMetric: TargetMetric,
    targetValue: number,
  ) => {
    setBroaderGoalSeekSolving(true);
    setBroaderGoalSeekResult(null);
    try {
      const purchasePrice = assumptions?.acquisition?.purchasePrice ?? 0;
      const noiYear1 = modelResults?.summary?.noi ?? 0;
      const holdYears = assumptions?.holdPeriod ?? 5;
      const exitCapRate = assumptions?.disposition?.exitCapRate ?? 0.055;
      const rawRate = assumptions?.financing?.interestRate ?? 0;
      const debtRate = rawRate > 1 ? rawRate / 100 : rawRate > 0 ? rawRate : 0.065;
      const loanAmount = assumptions?.financing?.loanAmount ?? 0;
      const ltv = purchasePrice > 0 && loanAmount > 0 ? loanAmount / purchasePrice : 0.70;
      const noiGrowthRate = assumptions?.revenue?.rentGrowth?.[0] ?? 0.03;
      const sellingCostsPct = assumptions?.disposition?.sellingCosts ?? 0.02;
      const ioPeriodYears = assumptions?.financing?.ioPeriod ?? 0;
      const amortYears = assumptions?.financing?.amortization ?? 30;

      const res = await apiClient.post('/api/v2/sigma/broader-goal-seek', {
        solveFor,
        targetMetric,
        targetValue,
        purchasePrice,
        noiYear1,
        holdYears,
        exitCapRate,
        debtRate,
        ltv,
        noiGrowthRate,
        sellingCostsPct,
        ioPeriodYears,
        amortYears,
        // Send the full ProForma assumptions so the backend can evaluate via
        // the real deterministic runModel() engine rather than the analytic
        // approximation, ensuring solved values are consistent with F9 output.
        proFormaAssumptions: assumptions ?? undefined,
      });
      const data = (res as any)?.data ?? (res as any);
      setBroaderGoalSeekResult(data as BroaderGoalSeekResult);
    } catch (err: any) {
      console.error('[F9] Broader goal seek failed:', err);
    } finally {
      setBroaderGoalSeekSolving(false);
    }
  }, [assumptions, modelResults]);

  const handleAssumptionsChange = useCallback((partial: Partial<ModelAssumptions>) => {
    setAssumptions(prev => prev ? { ...prev, ...partial } : null);
    // Mark the model stale when the user edits assumptions after a build.
    setStaleModel(prev => prev || modelResults !== null);
  }, [modelResults]);

  const handleApplyGoalSeekSolved = useCallback((variable: SolveVariable, value: number) => {
    if (!assumptions) return;
    switch (variable) {
      case 'purchase_price':
        handleAssumptionsChange({ acquisition: { ...assumptions.acquisition, purchasePrice: value } });
        break;
      case 'exit_cap_rate':
        handleAssumptionsChange({ disposition: { ...assumptions.disposition, exitCapRate: value } });
        break;
      case 'rent_growth': {
        const filled = (assumptions.revenue?.rentGrowth ?? []).map(() => value);
        handleAssumptionsChange({ revenue: { ...assumptions.revenue, rentGrowth: filled } });
        break;
      }
      case 'hold_period':
        handleAssumptionsChange({ holdPeriod: Math.round(value) });
        break;
      case 'ltv': {
        const pp = assumptions.acquisition?.purchasePrice ?? 0;
        handleAssumptionsChange({ financing: { ...assumptions.financing, loanAmount: pp * value } });
        break;
      }
      case 'interest_rate':
        handleAssumptionsChange({ financing: { ...assumptions.financing, interestRate: value } });
        break;
    }
  }, [assumptions, handleAssumptionsChange]);

  useEffect(() => {
    if (opusScrollRef.current) {
      opusScrollRef.current.scrollTop = opusScrollRef.current.scrollHeight;
    }
  }, [opusMessages]);

  const handleOpusSend = useCallback(async () => {
    if (!opusInput.trim() || opusSending) return;
    const text = opusInput.trim();
    setOpusInput('');
    setOpusMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setOpusSending(true);
    setOpusExpanded(true);

    const context = {
      dealId: resolvedDealId,
      dealType: resolvedDealType,
      hasModel: !!modelResults,
      kpi: kpi ? { irr: kpi.irr, em: kpi.equityMultiple, coc: kpi.cashOnCash, noi: kpi.noi, dscr: kpi.dscr } : null,
      assumptions: assumptions ? {
        purchasePrice: assumptions.purchasePrice,
        units: assumptions.units,
        exitCapRate: assumptions.exitCapRate,
        holdPeriod: assumptions.holdPeriod,
        loanType: assumptions.loanType,
        ltv: assumptions.ltv,
        interestRate: assumptions.interestRate,
      } : null,
    };

    try {
      const res = await apiClient.post('/api/v1/agents/chat', {
        agentCode: 'OPUS',
        message: text,
        dealId: resolvedDealId,
        context: { module: 'financial-engine', ...context },
      });
      const reply = (res as any)?.data?.data?.message || (res as any)?.data?.message || 'Model updated.';
      setOpusMessages(prev => [...prev, { role: 'opus', text: reply, ts: Date.now() }]);

      const actions = (res as any)?.data?.data?.actions || [];
      let switchToCustomTabId: string | null = null;
      let touchedCustomTabs = false;
      for (const action of actions) {
        if (action.type === 'update_assumptions' && action.payload) {
          setAssumptions(prev => prev ? { ...prev, ...action.payload } : null);
        }
        if (action.type === 'build_model') {
          handleBuildModel();
        }
        if (action.type === 'switch_tab' && typeof action.payload?.tab === 'number') {
          setActiveTab(action.payload.tab);
        }
        if (action.type === 'create_custom_tab' && action.payload?.tabId) {
          // Two delivery paths converge here:
          //  (1) Opus emitted an inline ```customtab fence — the backend
          //      streamChat parser already validated + persisted it, so we
          //      just need to switch to the new tab on reload.
          //  (2) The chat layer emitted a JSON `create_custom_tab` action
          //      with a full `payload.payload` (or top-level `blocks`/`title`)
          //      that has NOT been persisted yet. In that case we must POST
          //      it through the REST endpoint so it lands in the DB and
          //      gets server-side validation. Surface validator errors back
          //      into the chat thread so the user sees what was rejected.
          const p = action.payload;
          const inlineBlocks = Array.isArray(p?.payload?.blocks) ? p.payload.blocks
            : Array.isArray(p?.blocks) ? p.blocks
            : null;
          if (inlineBlocks) {
            const createPayload = {
              tabId: p.tabId,
              title: p.payload?.title ?? p.title ?? p.tabId,
              description: p.payload?.description ?? p.description,
              blocks: inlineBlocks,
            };
            try {
              const result = await opusProformaService.createCustomTab(
                resolvedDealId,
                createPayload,
                { generationPrompt: p.sourcePrompt ?? p.generationPrompt ?? undefined },
              );
              if (!result.ok) {
                // 422 from validator — show issues inline so the user understands what was rejected.
                const summary = (result.issues ?? [])
                  .map((i: any) => `${i.path ?? '$'}: ${i.message ?? 'invalid'}${
                    i.suggestions?.length ? ' (did you mean `' + i.suggestions[0] + '`)' : ''
                  }`)
                  .join('\n');
                setOpusMessages(prev => [...prev, {
                  role: 'opus',
                  text: `[customtab-validator] tab \`${p.tabId}\` rejected:\n${summary || 'unknown validation error'}`,
                  ts: Date.now(),
                }]);
              }
            } catch (err: any) {
              setOpusMessages(prev => [...prev, {
                role: 'opus',
                text: `[customtab-validator] ${err?.message ?? 'failed to persist tab'}`,
                ts: Date.now(),
              }]);
            }
          }
          switchToCustomTabId = p.tabId;
          touchedCustomTabs = true;
        }
        if (action.type === 'refresh_custom_tab' && action.payload?.tabId) {
          await opusProformaService.refreshCustomTab(resolvedDealId, action.payload.tabId);
          switchToCustomTabId = action.payload.tabId;
          touchedCustomTabs = true;
        }
        if (action.type === 'delete_custom_tab' && action.payload?.tabId) {
          await opusProformaService.deleteCustomTab(resolvedDealId, action.payload.tabId);
          touchedCustomTabs = true;
        }
      }

      // Opus may also have emitted a ```customtab fence inline (parsed by the
      // backend) — always refresh the tab list after a reply so that tabs
      // created via the streaming fence become visible without another round-trip.
      if (touchedCustomTabs || /create_custom_tab|customtab/i.test(reply)) {
        const tabs = await opusProformaService.listCustomTabs(resolvedDealId);
        setCustomTabs(tabs);
        if (switchToCustomTabId) {
          const idx = tabs.findIndex(t => t.tab_id === switchToCustomTabId);
          if (idx >= 0) setActiveTab(effectiveBuiltinCount + idx);
        } else if (tabs.length > customTabs.length) {
          // A new tab was created via the inline fence — switch to it.
          setActiveTab(effectiveBuiltinCount + 0);
        }
      }
    } catch (err: any) {
      setOpusMessages(prev => [...prev, { role: 'opus', text: `Error: ${err?.message || 'Failed to reach Opus'}`, ts: Date.now() }]);
    } finally {
      setOpusSending(false);
    }
  }, [opusInput, opusSending, resolvedDealId, resolvedDealType, modelResults, kpi, assumptions, handleBuildModel, customTabs.length]);

  const OPUS_QUICK_PROMPTS = useMemo(() => {
    const base = [
      'Build the model',
      'What IRR do I need to hit 2.0x?',
      'Run sensitivity on cap rate',
      'Increase rent growth to 4%',
      'Show debt structure',
      'Compare to market comps',
    ];
    // When the user has no custom tabs yet, surface the F9 capability via
    // three example prompts so the feature is discoverable.
    if (customTabs.length === 0) {
      return [
        ...base,
        "Add a tab comparing my numbers to the broker's",
        'Add a sensitivity tab varying just exit cap rate',
        'What modules are feeding my Year 5 NOI?',
      ];
    }
    return base;
  }, [customTabs.length]);

  // Build the displayed tab strip = built-in tabs + custom tabs (purple ✦).
  const displayTabs = useMemo(
    () => [
      ...(isRoadmapEligible ? BUILTIN_TAB_LABELS : BUILTIN_TAB_LABELS.slice(0, -1)),
      ...customTabs.map(t => `✦ ${t.title.toUpperCase()}`),
    ],
    [customTabs, isRoadmapEligible],
  );

  const activeCustomTab: CustomTabRow | null = useMemo(
    () => activeTab >= effectiveBuiltinCount
      ? customTabs[activeTab - effectiveBuiltinCount] ?? null
      : null,
    [activeTab, customTabs, effectiveBuiltinCount],
  );

  const handleCustomTabRefresh = useCallback(async (tabId: string) => {
    if (!resolvedDealId) return;
    setCustomTabsLoading(true);
    const updated = await opusProformaService.refreshCustomTab(resolvedDealId, tabId);
    if (updated) {
      setCustomTabs(prev => prev.map(t => t.tab_id === tabId ? updated : t));
    } else {
      setCustomTabsError('Refresh failed — payload may have validation issues.');
    }
    setCustomTabsLoading(false);
    setCustomTabMenu(null);
  }, [resolvedDealId]);

  const handleCustomTabDelete = useCallback(async (tabId: string) => {
    if (!resolvedDealId) return;
    const ok = await opusProformaService.deleteCustomTab(resolvedDealId, tabId);
    if (ok) {
      setCustomTabs(prev => {
        const next = prev.filter(t => t.tab_id !== tabId);
        // If the active tab was the deleted one (or sat after it), step back
        // to the closest still-valid tab to avoid a blank pane.
        const removedIdx = prev.findIndex(t => t.tab_id === tabId);
        if (removedIdx >= 0 && activeTab >= effectiveBuiltinCount + removedIdx) {
          setActiveTab(Math.max(0, activeTab - 1));
        }
        return next;
      });
    }
    setCustomTabMenu(null);
  }, [resolvedDealId, activeTab]);

  const handleCustomTabRename = useCallback(async (tabId: string, newTitle: string) => {
    if (!resolvedDealId || !newTitle.trim()) return;
    const updated = await opusProformaService.renameCustomTab(resolvedDealId, tabId, newTitle.trim());
    if (updated) {
      setCustomTabs(prev => prev.map(t => t.tab_id === tabId ? updated : t));
    }
    setCustomTabMenu(null);
  }, [resolvedDealId]);

  const tabProps = useMemo(() => ({
    dealId: resolvedDealId,
    deal: propDeal,
    dealType: resolvedDealType,
    assumptions,
    modelResults,
    onAssumptionsChange: handleAssumptionsChange,
    onBuildModel: handleBuildModel,
    building,
    versions,
    activeVersion,
    onIntegrityChange: setIntegrityBlocked,
    f9Financials: mergedFinancials ?? f9Financials,
    onTabChange: setActiveTab,
    onF9Refresh: fetchF9Financials,
    onHoldChange: handleHoldChange,
    lvCostTreatmentView,
    onLvTreatmentViewChange: handleLvTreatmentViewChange,
    evidenceFilter,
    evidenceFieldMap: evidenceSummary?.field_metadata ?? undefined,
    collisionFields: evidenceSummary?.collision_summary?.fields_with_collision ?? null,
    severeCollisionFields: evidenceSummary?.collision_summary?.severe_collision_fields ?? null,
    materialCollisionFields: evidenceSummary?.collision_summary?.material_collision_fields ?? null,
    minorCollisionFields: evidenceSummary?.collision_summary?.minor_collision_fields ?? null,
    platformRole,
    sourceDocuments,
    isLoadingVersions,
  }), [resolvedDealId, propDeal, resolvedDealType, assumptions, modelResults, handleAssumptionsChange, handleBuildModel, building, versions, activeVersion, f9Financials, fetchF9Financials, handleHoldChange, evidenceFilter, evidenceSummary, lvCostTreatmentView, handleLvTreatmentViewChange, platformRole, sourceDocuments, isLoadingVersions]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally omits mergedFinancials — closure reads it from enclosing scope; re-running on listed deps is the desired trigger

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        borderTop: `2px solid ${BT.met.financial}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8, fontFamily: MONO }}>FINANCIAL ENGINE</span>
          <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>M08 · v4.0</span>
          {kpiLoading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>LOADING...</span>
            : kpi
              ? <Bd c={BT.met.financial}>LIVE MODEL</Bd>
              : <Bd c={BT.text.secondary}>NO MODEL</Bd>
          }
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>
            {resolvedDealType}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
              style={{
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {activeVersion ? activeVersion.name : `v1 Base`} ▾
            </button>
            {showVersionDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
                minWidth: 180, maxHeight: 200, overflow: 'auto', borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {versions.length > 0 ? versions.map(v => {
                  const isOvr = v.source === 'operator_override';
                  return (
                  <button key={v.id} onClick={() => handleLoadVersion(v)} style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', color: v.id === activeVersion?.id ? BT.met.financial : BT.text.primary,
                    fontFamily: MONO, fontSize: 9, padding: '4px 8px', cursor: 'pointer',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    borderLeft: isOvr ? `2px solid ${BT.text.amber}` : '2px solid transparent',
                  }}>
                    {v.name}
                    <span style={{ float: 'right', fontSize: 8, color: isOvr ? BT.text.amber : BT.text.muted }}>
                      {isOvr ? 'Override' : v.source === 'user' ? 'User' : v.source}
                    </span>
                  </button>
                  );
                }) : (
                  <div style={{ padding: '8px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No saved versions</div>
                )}
              </div>
            )}
          </div>

          {showSaveDialog ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={saveVersionName}
                onChange={e => setSaveVersionName(e.target.value)}
                placeholder="Version name..."
                style={{
                  background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                  fontFamily: MONO, fontSize: 9, padding: '2px 6px', width: 120, borderRadius: 2,
                }}
                onKeyDown={e => e.key === 'Enter' && handleSaveVersion()}
                autoFocus
              />
              <button onClick={handleSaveVersion} style={{
                background: BT.met.financial, border: 'none', color: BT.bg.terminal,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2, fontWeight: 700,
              }}>SAVE</button>
              <button onClick={() => setShowSaveDialog(false)} style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2,
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveDialog(true)} style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
              fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
            }}>SAVE VERSION</button>
          )}

          {lastSavedAt != null && (
            <span
              title={`Saved ${new Date(lastSavedAt).toLocaleString()}`}
              style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}
            >
              saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button onClick={handleExport} style={{
            background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
            fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
          }}>EXPORT XLSX</button>

          <button onClick={handleBuildModel} disabled={building || !assumptions} style={{
            background: building ? BT.bg.active : BT.met.financial,
            border: 'none', color: building ? BT.text.muted : BT.bg.terminal,
            fontFamily: MONO, fontSize: 9, padding: '2px 10px', cursor: building ? 'default' : 'pointer',
            borderRadius: 2, fontWeight: 700, opacity: !assumptions ? 0.4 : 1,
          }}>{building ? 'BUILDING...' : (buildError ? 'RETRY BUILD' : 'BUILD MODEL')}</button>

          {buildError && !building && (
            <span
              title={buildError}
              style={{
                fontFamily: MONO, fontSize: 8, color: BT.text.red,
                border: `1px solid ${BT.text.red}`, borderRadius: 2,
                padding: '1px 5px', letterSpacing: 0.5, maxWidth: 360,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              BUILD FAILED — {buildError}
            </span>
          )}

          {staleModel && (
            <span title="Assumptions have changed since the last build" style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.amber,
              border: `1px solid ${BT.text.amber}`, borderRadius: 2,
              padding: '1px 5px', letterSpacing: 0.5,
            }}>MODEL OUTDATED</span>
          )}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {[
            { label: 'IRR', value: kpi?.irr != null ? fmtPct(kpi.irr) : '—', color: BT.met.financial },
            { label: 'EM', value: kpi?.equityMultiple != null ? fmtX(kpi.equityMultiple) : '—', color: BT.text.amber },
            { label: 'CoC', value: kpi?.cashOnCash != null ? fmtPct(kpi.cashOnCash) : '—', color: BT.met.occupancy },
            { label: 'NOI', value: kpi?.noi != null ? fmt$(kpi.noi) : '—', color: BT.text.cyan },
            { label: 'DSCR', value: kpi?.dscr != null ? `${Number(kpi.dscr).toFixed(2)}×` : '—', color: BT.text.green },
            { label: 'GI Cap', value: (kpi as any)?.goingInCapRate != null ? fmtPct((kpi as any).goingInCapRate) : '—', color: BT.text.cyan },
            { label: 'Ex Cap', value: (kpi as any)?.exitCapRate != null ? fmtPct((kpi as any).exitCapRate) : '—', color: BT.text.amber },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{m.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {evidenceSummary && (
        <F9SummaryBar
          collision_summary={evidenceSummary.collision_summary}
          confidence_distribution={evidenceSummary.confidence_distribution}
          tier_distribution={evidenceSummary.tier_distribution}
          archive_percentile={evidenceSummary.archive_percentile}
          onFilterChange={setEvidenceFilter}
          activeFilter={evidenceFilter}
        />
      )}

      <div style={{ position: 'relative' }}>
        <SubTabBar
          tabs={displayTabs}
          active={activeTab}
          setActive={setActiveTab}
          color={BT.met.financial}
        />
        {/* Per-tab overflow menu — only shown for the active custom tab */}
        {activeCustomTab && (
          <div style={{ position: 'absolute', right: 6, top: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setCustomTabMenu(prev => prev?.tabId === activeCustomTab.tab_id
                ? null
                : { tabId: activeCustomTab.tab_id, mode: 'menu', renameValue: activeCustomTab.title })}
              title="Custom tab actions"
              style={{
                background: customTabMenu ? '#8B5CF620' : 'transparent',
                color: '#8B5CF6', border: `1px solid #8B5CF640`, borderRadius: 2,
                fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: '0 6px', cursor: 'pointer',
              }}
            >⋯</button>
            {customTabMenu?.tabId === activeCustomTab.tab_id && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 200,
                background: BT.bg.panel, border: `1px solid #8B5CF6`, borderRadius: 2,
                minWidth: 200, padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {customTabMenu.mode === 'menu' ? (
                  <>
                    <button
                      onClick={() => setCustomTabMenu({ ...customTabMenu, mode: 'rename' })}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: BT.text.primary, fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: 'pointer' }}
                    >Rename</button>
                    <button
                      onClick={() => handleCustomTabRefresh(activeCustomTab.tab_id)}
                      disabled={!activeCustomTab.generation_prompt || customTabsLoading}
                      title={activeCustomTab.generation_prompt ? 'Re-run the original Opus prompt' : 'No generation prompt stored — recreate the tab via Opus'}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: activeCustomTab.generation_prompt ? BT.text.primary : BT.text.muted, fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: activeCustomTab.generation_prompt ? 'pointer' : 'not-allowed' }}
                    >Refresh from Opus</button>
                    <button
                      onClick={() => { if (window.confirm(`Delete custom tab "${activeCustomTab.title}"?`)) handleCustomTabDelete(activeCustomTab.tab_id); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#FF6B6B', fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: 'pointer' }}
                    >Delete</button>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 4, padding: 4 }}>
                    <input
                      value={customTabMenu.renameValue}
                      onChange={e => setCustomTabMenu({ ...customTabMenu, renameValue: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleCustomTabRename(activeCustomTab.tab_id, customTabMenu.renameValue); }}
                      autoFocus
                      style={{ flex: 1, background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.primary, fontFamily: MONO, fontSize: 10, padding: '3px 6px', borderRadius: 2 }}
                    />
                    <button onClick={() => handleCustomTabRename(activeCustomTab.tab_id, customTabMenu.renameValue)}
                      style={{ background: '#8B5CF6', border: 'none', color: '#fff', fontFamily: MONO, fontSize: 9, padding: '0 8px', cursor: 'pointer', borderRadius: 2, fontWeight: 700 }}
                    >OK</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {customTabsError && (
        <div style={{
          padding: '4px 10px', background: '#FF6B6B20', color: '#FF6B6B',
          fontFamily: MONO, fontSize: 9, borderBottom: `1px solid #FF6B6B40`,
        }}>
          [custom-tabs] {customTabsError}
          <button onClick={() => setCustomTabsError(null)} style={{ float: 'right', background: 'transparent', color: '#FF6B6B', border: 'none', cursor: 'pointer', fontSize: 10 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── OPUS CHAT PANEL (LEFT) ── */}
        <div style={{
          width: opusExpanded ? 320 : 42,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: BT.bg.panel,
          borderRight: `1px solid ${BT.border.medium}`,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: opusExpanded ? '8px 10px' : '8px 0',
            justifyContent: opusExpanded ? 'flex-start' : 'center',
            borderBottom: `1px solid ${BT.border.subtle}`,
            flexShrink: 0, cursor: 'pointer',
          }} onClick={() => setOpusExpanded(!opusExpanded)}>
            <Brain size={16} color="#8B5CF6" />
            {opusExpanded && (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', letterSpacing: 0.8, fontFamily: MONO }}>OPUS</span>
                <Bd c="#8B5CF6">ENGINE CTRL</Bd>
                <div style={{ flex: 1 }} />
                <ChevronDown size={12} color={BT.text.muted} style={{ transform: opusExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              </>
            )}
          </div>

          {opusExpanded && (
            <>
              {/* Context badge */}
              <div style={{
                padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0,
              }}>
                <Bd c={BT.met.financial}>{resolvedDealType.toUpperCase()}</Bd>
                {kpi ? <Bd c={BT.text.green}>MODEL LIVE</Bd> : <Bd c={BT.text.muted}>NO MODEL</Bd>}
                {kpi?.irr != null && <Bd c={BT.met.financial}>IRR {fmtPct(kpi.irr)}</Bd>}
                {kpi?.dscr != null && <Bd c={BT.text.cyan}>DSCR {Number(kpi.dscr).toFixed(2)}×</Bd>}
              </div>

              {/* Quick prompts */}
              {opusMessages.length === 0 && (
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 6, fontFamily: MONO, letterSpacing: 0.5 }}>QUICK COMMANDS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {OPUS_QUICK_PROMPTS.map((p, i) => (
                      <button key={i} onClick={() => { setOpusInput(p); opusInputRef.current?.focus(); }} style={{
                        textAlign: 'left', background: BT.bg.panelAlt || '#0D1117', border: `1px solid ${BT.border.subtle}`,
                        color: BT.text.secondary, fontFamily: MONO, fontSize: 9, padding: '4px 8px',
                        cursor: 'pointer', borderRadius: 3, lineHeight: 1.3,
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              <div ref={opusScrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '8px 0',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {opusMessages.length === 0 && (
                  <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                    <Brain size={24} color="#8B5CF640" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, lineHeight: 1.5 }}>
                      Opus controls the Financial Engine.<br />
                      Ask questions, adjust assumptions,<br />
                      or run analysis commands.
                    </div>
                  </div>
                )}
                {opusMessages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    borderLeft: msg.role === 'opus' ? '2px solid #8B5CF6' : '2px solid ' + BT.text.amber,
                    marginLeft: msg.role === 'user' ? 20 : 0,
                    marginRight: msg.role === 'opus' ? 10 : 0,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: msg.role === 'opus' ? '#8B5CF6' : BT.text.amber, fontFamily: MONO, marginBottom: 2 }}>
                      {msg.role === 'opus' ? 'OPUS' : 'YOU'}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {opusSending && (
                  <div style={{ padding: '6px 10px', borderLeft: '2px solid #8B5CF6' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', fontFamily: MONO }}>OPUS</div>
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, animation: 'pulse 1.5s infinite' }}>Analyzing...</div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div style={{
                padding: '8px 10px', borderTop: `1px solid ${BT.border.medium}`,
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: BT.bg.header,
              }}>
                <span style={{ color: '#8B5CF6', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{'>'}</span>
                <input
                  ref={opusInputRef}
                  value={opusInput}
                  onChange={e => setOpusInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleOpusSend(); }}
                  placeholder="Ask Opus..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: MONO, fontSize: 10, color: BT.text.primary, minWidth: 0,
                  }}
                />
                <button
                  onClick={handleOpusSend}
                  disabled={opusSending || !opusInput.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, flexShrink: 0,
                    background: opusInput.trim() ? '#8B5CF6' : 'transparent',
                    color: opusInput.trim() ? '#fff' : BT.text.muted,
                    border: opusInput.trim() ? 'none' : `1px solid ${BT.border.subtle}`,
                    borderRadius: 3, cursor: opusInput.trim() ? 'pointer' : 'default',
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── TAB CONTENT (RIGHT) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {activeTab === 0 && <BtTabWrapper><OverviewTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 1 && (
            <BtTabWrapper style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <TabErrorBoundary tabName="Console">
                <ConsoleHubTab {...tabProps} />
              </TabErrorBoundary>
            </BtTabWrapper>
          )}
          {activeTab === 2 && <BtTabWrapper><ProFormaSummaryTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 3 && (
            <BtTabWrapper>
              <ProjectionsHubTab {...tabProps} integrityWarning={integrityBlocked} />
            </BtTabWrapper>
          )}
          {activeTab === 4 && <BtTabWrapper><CapitalHubTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 5 && <BtTabWrapper><ReturnsHubTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 6 && <BtTabWrapper><DecisionTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 7 && <BtTabWrapper><CompareHubTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 8 && (
            <BtTabWrapper style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <SensitivityTab
                {...tabProps}
                onSolveBroader={handleBroaderGoalSeek}
                broaderSolving={broaderGoalSeekSolving}
                broaderGoalSeekResult={broaderGoalSeekResult}
                onApplySolved={handleApplyGoalSeekSolved}
              />
            </BtTabWrapper>
          )}
          {activeTab === 9 && isRoadmapEligible && <BtTabWrapper style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><RoadmapTab {...tabProps} /></BtTabWrapper>}
          {activeCustomTab && (
            <BtTabWrapper>
              <CustomTabRenderer
                payload={activeCustomTab.payload}
                modelVersion={activeCustomTab.model_version}
                description={activeCustomTab.description}
                data={{
                  assumptions,
                  results: modelResults,
                  f9: f9Financials,
                  deal: propDeal as Record<string, any> | undefined,
                  // F9DealFinancials.projections is the per-year time-series
                  // object array (year/noi/cfads/dscr/...), matching the
                  // catalog's `projections[*].{year,noi,revenue,...}` contract
                  // — distinct from the row-oriented ProjectionRow[] on
                  // ModelResults.projections used by the projections grid.
                  projections: f9Financials?.projections ?? null,
                }}
                evidenceFieldMap={evidenceSummary?.field_metadata ?? undefined}
              />
            </BtTabWrapper>
          )}
        </div>
      </div>

      {/* ── EVIDENCE PANEL OVERLAY ──────────────────────────────────────────── */}
      {evidenceField && (
        <EvidencePanel
          dealId={resolvedDealId}
          fieldPath={evidenceField.path}
          fieldLabel={evidenceField.label}
          onClose={() => setEvidenceField(null)}
          onOverride={(fieldPath, value, reason) => {
            console.log('[EvidencePanel] override', fieldPath, value, reason);
            setEvidenceField(null);
          }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default FinancialEnginePage;
