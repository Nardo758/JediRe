import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '../../../components/deal/bloomberg-ui';
import { KpiTile } from '../../../components/deal/bloomberg-ui';
import { Lock, Link, ChevronDown, ChevronRight, Plus, X, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle, Zap, RefreshCw, Activity, Info } from 'lucide-react';
import type { FinancialEngineTabProps, F9DebtLoan, PrepayType } from './types';
import { fmt$, fmtPct } from './types';
import { apiClient } from '../../../services/api.client';

const MONO = BT.font.mono;

// ─── SOFR Forward Curve (static 5-yr, updated quarterly) ─────────────────────
const SOFR_FWD: number[] = [0.0500, 0.0475, 0.0450, 0.0425, 0.0400];

// ─── Loan letter designations ─────────────────────────────────────────────────
const LOAN_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ─── Loan type presets ────────────────────────────────────────────────────────
type LoanPresetKey = 'Bridge' | 'Agency' | 'FannieDUS' | 'CMBS' | 'HUD' | 'LifeCo' | 'Mezz' | 'BNote';

interface LoanPreset {
  label: LoanPresetKey;
  rateType: 'Fixed' | 'Floating';
  rate: number;
  spread: number;
  term: number;
  amort: number;
  io: number;
  origFee: number;
  exitFee: number;
  rateCapCost: number;
  minDscr: number;
  maxLtv: number;
  prepayType: PrepayType;
}

const LOAN_PRESETS: Record<LoanPresetKey, LoanPreset> = {
  Bridge:    { label: 'Bridge',    rateType: 'Floating', rate: 0.085, spread: 0.035, term: 3,  amort: 0,  io: 36, origFee: 0.015, exitFee: 0.005, rateCapCost: 0.005, minDscr: 1.15, maxLtv: 0.80, prepayType: 'open' },
  Agency:    { label: 'Agency',    rateType: 'Fixed',    rate: 0.055, spread: 0,     term: 10, amort: 30, io: 0,  origFee: 0.010, exitFee: 0,     rateCapCost: 0,     minDscr: 1.25, maxLtv: 0.75, prepayType: 'stepdown' },
  FannieDUS: { label: 'FannieDUS', rateType: 'Fixed',    rate: 0.054, spread: 0,     term: 10, amort: 30, io: 24, origFee: 0.010, exitFee: 0,     rateCapCost: 0,     minDscr: 1.25, maxLtv: 0.80, prepayType: 'yield_maintenance' },
  CMBS:      { label: 'CMBS',      rateType: 'Fixed',    rate: 0.065, spread: 0,     term: 10, amort: 30, io: 24, origFee: 0.010, exitFee: 0,     rateCapCost: 0,     minDscr: 1.20, maxLtv: 0.70, prepayType: 'defeasance' },
  HUD:       { label: 'HUD',       rateType: 'Fixed',    rate: 0.045, spread: 0,     term: 35, amort: 35, io: 36, origFee: 0.008, exitFee: 0,     rateCapCost: 0,     minDscr: 1.20, maxLtv: 0.87, prepayType: 'yield_maintenance' },
  LifeCo:    { label: 'LifeCo',    rateType: 'Fixed',    rate: 0.048, spread: 0,     term: 15, amort: 30, io: 0,  origFee: 0.005, exitFee: 0,     rateCapCost: 0,     minDscr: 1.20, maxLtv: 0.65, prepayType: 'yield_maintenance' },
  Mezz:      { label: 'Mezz',      rateType: 'Floating', rate: 0.120, spread: 0.060, term: 3,  amort: 0,  io: 36, origFee: 0.020, exitFee: 0.010, rateCapCost: 0.008, minDscr: 1.10, maxLtv: 0.90, prepayType: 'open' },
  BNote:     { label: 'BNote',     rateType: 'Floating', rate: 0.095, spread: 0.040, term: 3,  amort: 0,  io: 36, origFee: 0.015, exitFee: 0.005, rateCapCost: 0.006, minDscr: 1.10, maxLtv: 0.85, prepayType: 'open' },
};

// ─── Per-loan editable state ──────────────────────────────────────────────────
interface LoanState {
  id: string;
  name: string;
  loanTypeLabel: LoanPresetKey;
  rateType: 'Fixed' | 'Floating';
  // user overrides (null = use platform/preset)
  userLoanAmount: number | null;
  userRate: number | null;
  userSpread: number | null;
  userSofr: number | null;
  userCapRate: number | null;
  userTerm: number | null;
  userAmort: number | null;
  userIO: number | null;
  userOrigFee: number | null;
  userExitFee: number | null;
  userRateCapCost: number | null;
  userMinDscr: number | null;
  userMinDY: number | null;
  userMinOcc: number | null;
  userMaxLtv: number | null;
  userCashTrapDscr: number | null;
  userTIEscrow: number | null;
  userReplReserve: number | null;
  userOpReserveMonths: number | null;
  prepayType: PrepayType;
  sofrCurve: number[];
  extensionOptions: string;
}

function makeLoanState(id: string, name: string, preset: LoanPreset, f9Loan?: F9DebtLoan | null, baseLoanAmt?: number): LoanState {
  return {
    id, name,
    loanTypeLabel: preset.label,
    rateType: preset.rateType,
    userLoanAmount: null,
    userRate: null,
    userSpread: null,
    userSofr: null,
    userCapRate: null,
    userTerm: null,
    userAmort: null,
    userIO: null,
    userOrigFee: null,
    userExitFee: null,
    userRateCapCost: null,
    userMinDscr: null,
    userMinDY: null,
    userMinOcc: null,
    userMaxLtv: null,
    userCashTrapDscr: null,
    userTIEscrow: null,
    userReplReserve: null,
    userOpReserveMonths: null,
    prepayType: f9Loan?.prepayType as PrepayType ?? preset.prepayType,
    sofrCurve: f9Loan?.sofrCurve ?? SOFR_FWD,
    extensionOptions: '',
  };
}

// ─── Amortization helpers ─────────────────────────────────────────────────────
interface AmortRow {
  month: number;
  begBalance: number;
  periodRate: number;
  payment: number;
  interest: number;
  principal: number;
  endBalance: number;
  isIO: boolean;
  dscr: number | null;
  debtYield: number | null;
  covenantBreach: boolean;
}

interface AnnualRow {
  year: number;
  openBalance: number;
  annualInterest: number;
  annualPrincipal: number;
  annualDS: number;
  closeBalance: number;
  noi: number;
  dscr: number | null;
  debtYield: number | null;
  covenantBreach: boolean;
}

// sofrCurve: 5-element array of annual SOFR rates by year (e.g. [0.05, 0.0475, ...])
// spread: credit spread added to SOFR for floating rate loans
// isFloating: if true, uses sofrCurve[yearIdx] + spread per year; else uses constant rate
function buildAmort(
  loanAmt: number,
  rate: number,
  termYrs: number,
  amortYrs: number,
  ioMo: number,
  annualNoi: number,
  minDscr: number,
  isFloating: boolean,
  sofrCurve: number[],
  spread: number,
): AmortRow[] {
  const rows: AmortRow[] = [];
  const totalMo = Math.min(termYrs * 12, 480); // up to 40yr (HUD/LifeCo)
  const amortMo = amortYrs * 12;
  const monthlyNoi = annualNoi / 12;
  let bal = loanAmt;
  for (let m = 1; m <= totalMo; m++) {
    // For floating rate, pick SOFR from curve for this year-bucket + spread
    const yearIdx = Math.min(Math.floor((m - 1) / 12), (sofrCurve.length || 1) - 1);
    const annualRate = isFloating ? ((sofrCurve[yearIdx] ?? sofrCurve[0] ?? rate) + spread) : rate;
    const mr = annualRate / 12;
    const isIO = m <= ioMo;
    const begBalance = bal;
    const interest = bal * mr;
    let principal = 0;
    let payment = interest;
    if (!isIO && amortMo > 0 && mr > 0) {
      // Use original loan and initial mr for fixed payment schedule, but re-compute for floating
      const schedMr = isFloating ? mr : rate / 12;
      payment = (loanAmt * schedMr * Math.pow(1 + schedMr, amortMo)) / (Math.pow(1 + schedMr, amortMo) - 1);
      principal = payment - interest;
    }
    bal = Math.max(0, bal - principal);
    const dscr = payment > 0 ? monthlyNoi / payment : null;
    const debtYield = begBalance > 0 ? (annualNoi / begBalance) : null;
    const covenantBreach = dscr != null && dscr < minDscr;
    rows.push({ month: m, begBalance, periodRate: annualRate, payment, interest, principal, endBalance: bal, isIO, dscr, debtYield, covenantBreach });
  }
  return rows;
}

function buildAnnual(amortRows: AmortRow[], noi1: number, rentGrowth: number, minDscr: number): AnnualRow[] {
  const years = Math.ceil(amortRows.length / 12);
  const annual: AnnualRow[] = [];
  for (let y = 1; y <= years; y++) {
    const mo = amortRows.slice((y - 1) * 12, y * 12);
    if (!mo.length) break;
    const openBalance = mo[0].begBalance;
    const closeBalance = mo[mo.length - 1].endBalance;
    const annualInterest = mo.reduce((s, r) => s + r.interest, 0);
    const annualPrincipal = mo.reduce((s, r) => s + r.principal, 0);
    const annualDS = mo.reduce((s, r) => s + r.payment, 0);
    const noi = noi1 * Math.pow(1 + rentGrowth, y - 1);
    const dscr = annualDS > 0 ? noi / annualDS : null;
    const debtYield = openBalance > 0 ? noi / openBalance : null;
    const covenantBreach = dscr != null && dscr < minDscr;
    annual.push({ year: y, openBalance, annualInterest, annualPrincipal, annualDS, closeBalance, noi, dscr, debtYield, covenantBreach });
  }
  return annual;
}

// ─── 4-column DebtRow ─────────────────────────────────────────────────────────
type FmtFn = (v: number | null | undefined) => string;

function fmtDlr(v: number | null | undefined) { return v != null ? fmt$(v) : '—'; }
function fmtPctFull(v: number | null | undefined) { return v != null ? fmtPct(v * 100) : '—'; }
function fmtYrs(v: number | null | undefined) { return v != null ? `${v}yr` : '—'; }
function fmtMo(v: number | null | undefined) { return v != null ? `${v}mo` : '—'; }
function fmtX(v: number | null | undefined) { return v != null ? `${Number(v).toFixed(2)}×` : '—'; }

function DebtRow({ label, broker, platform, user, userEditable = false, onUserChange, format = fmtDlr, locked = false, sub, pass, fail }: {
  label: string;
  broker?: number | null;
  platform?: number | null;
  user: number | null;
  userEditable?: boolean;
  onUserChange?: (v: number | null) => void;
  format?: FmtFn;
  locked?: boolean;
  sub?: string;
  pass?: boolean;
  fail?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUser = user != null;
  const resolved = user ?? platform ?? broker;

  const startEdit = () => {
    if (!userEditable || locked) return;
    setDraft(user != null ? String(user) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const commit = () => {
    setEditing(false);
    const v = parseFloat(draft);
    if (isNaN(v)) { onUserChange?.(null); return; }
    onUserChange?.(v);
  };

  const statusColor = pass != null ? (pass ? BT.met.financial : BT.text.red) : undefined;

  return (
    <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, height: 28 }}>
      <td style={{ padding: '3px 12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, position: 'sticky', left: 0, background: BT.bg.panel, zIndex: 1, borderRight: `1px solid ${BT.border.subtle}`, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {locked && <Lock style={{ width: 8, height: 8, color: BT.text.muted }} />}
          <span>{label}</span>
          {pass != null && <span style={{ fontSize: 8, color: statusColor, marginLeft: 4 }}>{pass ? '✓' : '✗'}</span>}
        </div>
        {sub && <div style={{ fontSize: 7, color: BT.text.muted }}>{sub}</div>}
      </td>
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.amber, borderRight: `1px solid ${BT.border.subtle}`, minWidth: 100 }}>
        {format(broker)}
      </td>
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.cyan, borderRight: `1px solid ${BT.border.subtle}`, minWidth: 100 }}>
        {format(platform)}
      </td>
      <td
        style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, borderRight: `1px solid ${BT.border.subtle}`, minWidth: 100, cursor: userEditable && !locked ? 'pointer' : 'default' }}
        onClick={startEdit}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            style={{ width: 80, background: BT.bg.input, border: `1px solid ${BT.border.bright}`, color: BT.text.white, fontFamily: MONO, fontSize: 10, padding: '1px 4px', borderRadius: 2 }}
          />
        ) : (
          <span style={{ color: hasUser ? BT.text.green : BT.text.muted }}>
            {hasUser ? format(user) : (userEditable ? <span style={{ fontSize: 8 }}>click</span> : '—')}
          </span>
        )}
      </td>
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: statusColor ?? (hasUser ? BT.text.green : (platform != null ? BT.text.cyan : BT.text.muted)), fontWeight: 700, minWidth: 100 }}>
        {format(resolved)}
      </td>
    </tr>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ letter, title, subtitle, collapsed, onToggle }: { letter: string; title: string; subtitle?: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, cursor: 'pointer', userSelect: 'none' }}
    >
      <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.cyan, background: `${BT.text.cyan}15`, border: `1px solid ${BT.text.cyan}40`, borderRadius: 2, padding: '1px 5px' }}>{letter}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.6 }}>{title}</span>
      {subtitle && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{subtitle}</span>}
      <div style={{ marginLeft: 'auto' }}>{collapsed ? <ChevronRight style={{ width: 12, height: 12, color: BT.text.muted }} /> : <ChevronDown style={{ width: 12, height: 12, color: BT.text.muted }} />}</div>
    </div>
  );
}

function ColHeader() {
  return (
    <tr style={{ background: BT.bg.header, borderBottom: `2px solid ${BT.border.medium}` }}>
      <th style={{ padding: '4px 12px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, textAlign: 'left', fontWeight: 500, minWidth: 180 }}>METRIC</th>
      <th style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.amber, textAlign: 'center', fontWeight: 700, minWidth: 100 }}>BROKER</th>
      <th style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.cyan, textAlign: 'center', fontWeight: 700, minWidth: 100 }}>PLATFORM</th>
      <th style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.green, textAlign: 'center', fontWeight: 700, minWidth: 100 }}>USER</th>
      <th style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.white, textAlign: 'center', fontWeight: 700, minWidth: 100 }}>RESOLVED</th>
    </tr>
  );
}

// ─── Refi Event State ─────────────────────────────────────────────────────────
interface RefiState {
  enabled: boolean;
  triggerYear: number;
  newLoanType: LoanPresetKey;
  newLoanAmtPct: number;
}

// ─── Debt Advisor Types ───────────────────────────────────────────────────────
interface AdvisorPhase {
  phaseIndex: number;
  phaseLabel: string;
  product: string;
  productLabel: string;
  startMonth: number;
  endMonth: number;
  loanAmountEst: number;
  termYears: number;
  ioMonths: number;
  amortYears: number;
  rateType: 'Fixed' | 'Floating';
  rateEst: number;
  spreadBps?: number;
  ltv: number;
  origFee: number;
  exitFee: number;
  prepayType: string;
  rationale: string;
  lenders: AdvisorLender[];
  triggers: AdvisorTrigger[];
  isRefiEvent: boolean;
  refiTriggerOcc?: number;
  refiTriggerDscr?: number;
  dscrAtClose?: number;
  debtYieldAtClose?: number;
}

function getProductFamilyColor(product: string): string {
  const p = product.toLowerCase();
  if (p.includes('bridge') || p.includes('construction'))    return BT.text.amber;
  if (p.includes('fannie') || p.includes('freddie') || p.includes('agency') || p.includes('gse')) return BT.text.cyan;
  if (p.includes('cmbs'))   return '#a855f7';
  if (p.includes('hud') || p.includes('fha'))   return BT.met.financial;
  if (p.includes('life') || p.includes('lifeco') || p.includes('life_co')) return '#8b5cf6';
  if (p.includes('mezz') || p.includes('preferred') || p.includes('pref_eq')) return BT.text.red;
  if (p.includes('portfolio') || p.includes('bank') || p.includes('credit_union')) return BT.text.secondary;
  return BT.text.amber;
}
interface AdvisorLender {
  lender: { id: string; name: string; type: string; typicalSpreadBps?: number; typicalRateFixed?: number; typicalLtc?: number; dealsYTDEst?: number; recoursePreference: string };
  fitScore: number;
  fitReasons: string[];
  contactNote: string;
}
interface AdvisorTrigger {
  id: string;
  condition: string;
  currentValue: string;
  threshold: string;
  frequency: string;
  action: string;
  severity: 'info' | 'warning' | 'critical';
}
interface AdvisorAlternative {
  label: string;
  product: string;
  productLabel: string;
  rationale: string;
  tradeoff: string;
  deltaAllInBps: number;
  irrImpactBps?: number;
}
interface DebtAdvisorData {
  dealId: string;
  computedAt: string;
  hasStrategy: boolean;
  strategyInputs: {
    subStrategyKey: string;
    strategySlug: string;
    strategyName: string;
    holdMonths: number;
    hasStrategy: boolean;
    propertyType: string;
    purchasePrice: number;
    city: string;
    state: string;
    units: number;
    riskScore: number;
  };
  rateEnvironment: {
    classification: 'Dropping' | 'Flat' | 'Rising';
    sofr: number;
    treasury10y: number;
    sofrForward12moBps: number;
    ratePreference: string;
    narrative: string;
    pricingWindowScore: number;
    pricingWindowLabel: string;
    ratCapAdvice: string;
  };
  recommendedStack: AdvisorPhase[];
  alternatives: AdvisorAlternative[];
  monitoringTriggers: AdvisorTrigger[];
  contextModifications?: {
    narrativeNotes: string[];
    geographyWarning: string | null;
    sizeWarning: string | null;
    recourseRequired: boolean;
    addPcaReserveNote: boolean;
    ltvHaircutPct: number;
  };
  correlationContext: {
    slug: string;
    riskScore: number;
    correlationImplication: string;
    rssAdjustmentBps: number;
  } | null;
  summary: {
    primaryProduct: string;
    primaryProductLabel: string;
    totalClosingCosts: number;
    initialLoanAmount: number;
    blendedAllInRate: number;
    headline: string;
    whyStatement: string;
    estimatedIrrImpactBps: number;
    covenantCushionBps: number;
  };
  divergence?: {
    hasDivergence: boolean;
    configuredLoanAmount?: number;
    configuredRate?: number;
    advisorLoanAmount?: number;
    advisorRate?: number;
    irrImpactBps?: number;
    covenantCushionDeltaBps?: number;
  };
}

// ─── Debt Advisor View Component ──────────────────────────────────────────────
function NoStratNavBtn({ dealId }: { dealId: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/terminal/strategies`)}
      style={{ padding: '8px 16px', background: `${BT.text.cyan}20`, border: `1px solid ${BT.text.cyan}`, color: BT.text.cyan, fontFamily: MONO, fontSize: 9, borderRadius: 3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Zap style={{ width: 10, height: 10 }} />
      GO TO STRATEGIES
    </button>
  );
}

function DebtAdvisorView({ dealId, onSwitchToConfigure, onAccept, configuredLoanAmount, configuredRate, onAdvisorAccepted, onF9Refresh }: {
  dealId: string;
  onSwitchToConfigure: () => void;
  onAccept: () => void;
  configuredLoanAmount?: number | null;
  configuredRate?: number | null;
  onAdvisorAccepted?: (loanAmount: number, rate: number) => void;
  onF9Refresh?: () => Promise<void> | void;
}) {
  const [data, setData] = useState<DebtAdvisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);
  const [accepting, setAccepting] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const fetchAdvisor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/debt/advisor`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data as DebtAdvisorData);
      } else {
        setError('No advisor data returned');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message || 'Failed to load advisor');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { fetchAdvisor(); }, [fetchAdvisor]);

  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await apiClient.post(`/api/v1/deals/${dealId}/debt/advisor/accept`, { phaseIndex: 0 });
      if (!res.data?.success) {
        setAcceptError(res.data?.error || 'Accept failed — check response');
        return;
      }
      if (data?.summary) {
        onAdvisorAccepted?.(data.summary.initialLoanAmount, data.summary.blendedAllInRate);
      }
      onAccept();
      await onF9Refresh?.();
      onSwitchToConfigure();
    } catch (e: any) {
      setAcceptError(e?.response?.data?.error || e?.message || 'Accept failed — server error');
    } finally {
      setAccepting(false);
    }
  };

  const handleRecompute = async (productHint?: string) => {
    setRecomputing(true);
    setRecomputeError(null);
    try {
      const res = await apiClient.post(`/api/v1/deals/${dealId}/debt/advisor/recompute`, productHint ? { productHint } : {});
      if (res.data?.success && res.data?.data) {
        setData(res.data.data as DebtAdvisorData);
      } else {
        setRecomputeError(res.data?.error || 'Recompute failed');
      }
    } catch (e: any) {
      setRecomputeError(e?.response?.data?.error || e?.message || 'Recompute failed — server error');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>
      LOADING DEBT ADVISOR…
    </div>
  );

  if (data && !data.hasStrategy) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 240, padding: 32, textAlign: 'center' }}>
        <Zap style={{ width: 32, height: 32, color: BT.text.amber, marginBottom: 12 }} />
        <div style={{ fontFamily: MONO, fontSize: 13, color: BT.text.white, marginBottom: 8 }}>RUN STRATEGY ANALYSIS FIRST</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
          The Debt Advisor is driven by M08 Strategy Analysis output. Run the strategy analysis for this deal, then return here for a strategy-specific debt recommendation.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <NoStratNavBtn dealId={dealId} />
          <button
            onClick={handleRecompute}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted, fontFamily: MONO, fontSize: 9, borderRadius: 3, cursor: 'pointer' }}
          >
            CHECK AGAIN
          </button>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
        <AlertTriangle style={{ width: 16, height: 16, color: BT.text.amber, marginRight: 8, display: 'inline' }} />
        {error || 'Unable to load advisor'}
        <button onClick={fetchAdvisor} style={{ marginLeft: 12, padding: '2px 10px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted, fontFamily: MONO, fontSize: 8, cursor: 'pointer', borderRadius: 2 }}>RETRY</button>
      </div>
    );
  }

  const { strategyInputs: si, rateEnvironment: re, recommendedStack: phases, alternatives, monitoringTriggers: triggers, summary, correlationContext } = data;

  const RateIcon = re.classification === 'Dropping' ? TrendingDown : re.classification === 'Rising' ? TrendingUp : Minus;
  const rateColor = re.classification === 'Dropping' ? BT.met.financial : re.classification === 'Rising' ? BT.text.red : BT.text.amber;
  const windowColor = re.pricingWindowScore >= 65 ? BT.met.financial : re.pricingWindowScore <= 40 ? BT.text.red : BT.text.amber;
  const totalHoldMonths = si.holdMonths || 36;

  const advisorLoanAmt = summary.initialLoanAmount;
  const advisorRate = summary.blendedAllInRate;
  const loanDivAmt = configuredLoanAmount != null && advisorLoanAmt > 0
    ? Math.abs(configuredLoanAmount - advisorLoanAmt) / advisorLoanAmt
    : 0;
  const rateDivBps = configuredRate != null && advisorRate > 0
    ? Math.round((configuredRate - advisorRate) * 10000)
    : 0;
  const hasDivergence = loanDivAmt > 0.05 || Math.abs(rateDivBps) > 25;
  const irrDeltaBps = hasDivergence ? Math.round(Math.abs(rateDivBps) * 0.35 + loanDivAmt * 200) : 0;
  const covenantDeltaBps = hasDivergence ? Math.round(Math.abs(rateDivBps) * 0.6) : 0;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>

        {/* Divergence banner — shown when Configure values deviate from Advisor recommendation */}
        {hasDivergence && (
          <div style={{ padding: '8px 16px', background: `${BT.text.amber}18`, borderBottom: `1px solid ${BT.text.amber}50`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle style={{ width: 12, height: 12, color: BT.text.amber, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 700 }}>CONFIGURE DIVERGENCE DETECTED — </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                Current configuration differs from this recommendation
                {Math.abs(rateDivBps) > 0 && ` by ${Math.abs(rateDivBps) > 0 ? `${rateDivBps > 0 ? '+' : ''}${rateDivBps}bps rate` : ''}`}
                {loanDivAmt > 0.05 && ` / ${loanDivAmt > 0 ? '+' : ''}${(loanDivAmt * 100).toFixed(0)}% loan size`}.
                {irrDeltaBps > 0 && ` Est. IRR impact: ~${irrDeltaBps}bps.`}
                {covenantDeltaBps > 0 && ` Est. DSCR covenant cushion shift: ~${covenantDeltaBps}bps.`}
              </span>
            </div>
            <button
              onClick={onSwitchToConfigure}
              style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${BT.text.amber}60`, color: BT.text.amber, fontFamily: MONO, fontSize: 8, cursor: 'pointer', borderRadius: 2, flexShrink: 0 }}
            >
              VIEW CONFIGURE
            </button>
          </div>
        )}

        {/* AI Coordinator Narrative Block */}
        {correlationContext && (
          <div style={{ margin: '0', background: `linear-gradient(135deg, ${BT.bg.panel} 0%, #0a1a2e 100%)`, borderBottom: `1px solid ${BT.text.cyan}30`, padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Activity style={{ width: 10, height: 10, color: BT.text.cyan }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, letterSpacing: 1 }}>AI COORDINATOR — STRATEGY-RATE SYNTHESIS</span>
              {correlationContext.rssAdjustmentBps !== 0 && (
                <span style={{ fontFamily: MONO, fontSize: 7, color: correlationContext.rssAdjustmentBps > 0 ? BT.text.red : BT.met.financial, background: `${correlationContext.rssAdjustmentBps > 0 ? BT.text.red : BT.met.financial}15`, border: `1px solid ${correlationContext.rssAdjustmentBps > 0 ? BT.text.red : BT.met.financial}40`, borderRadius: 2, padding: '0 5px', marginLeft: 4 }}>
                  {correlationContext.rssAdjustmentBps > 0 ? '+' : ''}{correlationContext.rssAdjustmentBps}bps SPREAD ADJ
                </span>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, lineHeight: 1.7, maxWidth: 680 }}>
              {correlationContext.correlationImplication}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                Strategy: <span style={{ color: BT.text.cyan }}>{correlationContext.slug.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                Risk Score: <span style={{ color: correlationContext.riskScore > 7 ? BT.text.red : correlationContext.riskScore > 4 ? BT.text.amber : BT.met.financial }}>{correlationContext.riskScore}/10</span>
              </div>
            </div>
          </div>
        )}

        {/* Geography / size context modifier banners */}
        {data.contextModifications?.geographyWarning && (
          <div style={{ padding: '6px 16px', background: `${BT.text.amber}12`, borderBottom: `1px solid ${BT.text.amber}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ width: 10, height: 10, color: BT.text.amber, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
              <span style={{ color: BT.text.amber }}>GEOGRAPHY </span>
              {data.contextModifications.geographyWarning}
            </span>
          </div>
        )}
        {data.contextModifications?.sizeWarning && (
          <div style={{ padding: '6px 16px', background: `${BT.text.cyan}08`, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info style={{ width: 10, height: 10, color: BT.text.cyan, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
              <span style={{ color: BT.text.cyan }}>SIZE TIER </span>
              {data.contextModifications.sizeWarning}
            </span>
          </div>
        )}
        {data.contextModifications?.recourseRequired && (
          <div style={{ padding: '6px 16px', background: `${BT.text.red}10`, borderBottom: `1px solid ${BT.text.red}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ width: 10, height: 10, color: BT.text.red, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
              <span style={{ color: BT.text.red }}>RECOURSE REQUIRED </span>
              Lenders will require full personal recourse guaranty based on sponsor experience and/or liquidity profile.
            </span>
          </div>
        )}

        {/* Recommendation header — left cyan rule + RECOMMENDED badge */}
        <div style={{ padding: '14px 16px', background: BT.bg.panel, borderBottom: `1px solid ${BT.border.medium}`, borderLeft: `3px solid ${BT.text.cyan}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 1 }}>RECOMMENDED DEBT STACK</div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}40`, borderRadius: 2, padding: '1px 6px', letterSpacing: 1 }}>RECOMMENDED</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.white, marginBottom: 6 }}>
            {summary.headline}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 10, maxWidth: 680 }}>
            {summary.whyStatement}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              Total at close: <span style={{ color: BT.text.red }}>{fmt$(summary.totalClosingCosts)}</span> origination + fees
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginLeft: 12 }}>
              Initial loan: <span style={{ color: BT.text.cyan }}>{fmt$(summary.initialLoanAmount)}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginLeft: 12 }}>
              All-in rate: <span style={{ color: BT.text.amber }}>{fmtPct(summary.blendedAllInRate * 100)}</span>
            </div>
          </div>
          {acceptError && (
            <div style={{ marginBottom: 8, padding: '4px 8px', background: `${BT.text.red}12`, border: `1px solid ${BT.text.red}40`, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle style={{ width: 10, height: 10, color: BT.text.red, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red }}>{acceptError}</span>
              <button onClick={() => setAcceptError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: BT.text.muted, cursor: 'pointer', fontFamily: MONO, fontSize: 8 }}>×</button>
            </div>
          )}
          {recomputeError && (
            <div style={{ marginBottom: 8, padding: '4px 8px', background: `${BT.text.amber}12`, border: `1px solid ${BT.text.amber}40`, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle style={{ width: 10, height: 10, color: BT.text.amber, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>{recomputeError}</span>
              <button onClick={() => setRecomputeError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: BT.text.muted, cursor: 'pointer', fontFamily: MONO, fontSize: 8 }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ padding: '6px 16px', background: `${BT.met.financial}20`, border: `1px solid ${BT.met.financial}`, color: BT.met.financial, fontFamily: MONO, fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer', opacity: accepting ? 0.7 : 1 }}
            >
              {accepting ? 'POPULATING…' : '✓ ACCEPT & POPULATE CONFIGURE'}
            </button>
            <button
              onClick={onSwitchToConfigure}
              style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.secondary, fontFamily: MONO, fontSize: 9, borderRadius: 3, cursor: 'pointer' }}
            >
              MODIFY IN CONFIGURE
            </button>
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${BT.border.subtle}`, color: BT.text.muted, fontFamily: MONO, fontSize: 9, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw style={{ width: 9, height: 9 }} />
              {recomputing ? 'REFRESHING…' : 'RECOMPUTE'}
            </button>
          </div>
        </div>

        {/* Debt Plan Timeline — swim-lane */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border.medium}` }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 8 }}>DEBT PLAN TIMELINE — click phase to expand</div>
          <div style={{ position: 'relative', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 0, minWidth: 500 }}>
              {phases.filter(p => p.product !== 'exit_payoff').map((phase, i) => {
                const widthPct = Math.max(10, ((phase.endMonth - phase.startMonth) / totalHoldMonths) * 100);
                const isExpanded = expandedPhase === i;
                const phaseColor = phase.isRefiEvent ? BT.met.financial : getProductFamilyColor(phase.product);
                return (
                  <div
                    key={i}
                    onClick={() => setExpandedPhase(isExpanded ? null : i)}
                    style={{
                      flex: `0 0 ${widthPct}%`, minWidth: 120,
                      background: isExpanded ? `${phaseColor}18` : `${phaseColor}08`,
                      border: `1px solid ${phaseColor}${isExpanded ? '80' : '30'}`,
                      borderRadius: 4, padding: '8px 10px', cursor: 'pointer',
                      marginRight: 4, transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>M{phase.startMonth}–M{phase.endMonth}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: phaseColor, marginBottom: 3 }}>{phase.productLabel}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>{fmt$(phase.loanAmountEst)}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>
                      {phase.rateType === 'Floating' ? `SOFR+${phase.spreadBps}bps` : `${fmtPct(phase.rateEst * 100)} fixed`}
                    </div>
                    {phase.isRefiEvent && (
                      <div style={{ fontFamily: MONO, fontSize: 7, color: BT.met.financial, marginTop: 2, border: `1px solid ${BT.met.financial}40`, padding: '0 4px', borderRadius: 2, display: 'inline-block' }}>REFI EVENT</div>
                    )}
                  </div>
                );
              })}
              {/* Exit phase chip */}
              <div style={{ flex: '0 0 80px', background: `${BT.text.red}08`, border: `1px solid ${BT.text.red}30`, borderRadius: 4, padding: '8px 10px', cursor: 'default', marginRight: 4 }}>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>M{totalHoldMonths}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.red }}>EXIT / PAYOFF</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>→ Capital Stack</div>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Phase Detail */}
        {expandedPhase !== null && phases[expandedPhase] && phases[expandedPhase].product !== 'exit_payoff' && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border.medium}`, background: `${BT.text.cyan}05` }}>
            {(() => {
              const ph = phases[expandedPhase];
              const phaseColor = ph.isRefiEvent ? BT.met.financial : getProductFamilyColor(ph.product);
              return (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: phaseColor, marginBottom: 8 }}>{ph.phaseLabel} — {ph.productLabel}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[
                      { l: 'LOAN AMOUNT', v: fmt$(ph.loanAmountEst), c: BT.text.cyan },
                      { l: 'TERM', v: `${ph.termYears}yr`, c: BT.text.secondary },
                      { l: 'IO PERIOD', v: `${ph.ioMonths}mo`, c: BT.text.amber },
                      { l: 'AMORT', v: ph.amortYears > 0 ? `${ph.amortYears}yr` : 'IO Only', c: BT.text.secondary },
                      { l: 'RATE', v: ph.rateType === 'Floating' ? `SOFR+${ph.spreadBps}bps` : fmtPct(ph.rateEst * 100), c: BT.text.amber },
                      { l: 'LTV/LTC', v: fmtPct(ph.ltv * 100), c: BT.text.cyan },
                      { l: 'DSCR AT CLOSE', v: ph.dscrAtClose != null ? `${ph.dscrAtClose.toFixed(2)}×` : '—', c: ph.dscrAtClose != null && ph.dscrAtClose >= 1.20 ? BT.met.financial : BT.text.red },
                      { l: 'DEBT YIELD', v: ph.debtYieldAtClose != null ? fmtPct(ph.debtYieldAtClose * 100) : '—', c: ph.debtYieldAtClose != null && ph.debtYieldAtClose >= 0.07 ? BT.met.financial : BT.text.amber },
                      { l: 'ORIG FEE', v: fmtPct(ph.origFee * 100), c: BT.text.muted },
                      { l: 'PREPAY', v: ph.prepayType.replace(/_/g, ' ').toUpperCase(), c: BT.text.muted },
                    ].map(({ l, v, c }) => (
                      <div key={l}>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{l}</div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {ph.refiTriggerOcc && (
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial, marginBottom: 8 }}>
                      REFI TRIGGER: Occ ≥ {fmtPct(ph.refiTriggerOcc * 100)} AND DSCR ≥ {ph.refiTriggerDscr?.toFixed(2)}×
                    </div>
                  )}
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 10, maxWidth: 620 }}>{ph.rationale}</div>
                  {ph.lenders.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 6 }}>ACTIVE LENDERS — {ph.lenders[0]?.lender.type}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ph.lenders.map((lt, li) => (
                          <div key={lt.lender.id} style={{ padding: '6px 10px', background: BT.bg.panelAlt, border: `1px solid ${li === 0 ? BT.text.cyan : BT.border.subtle}`, borderRadius: 4, minWidth: 140 }}>
                            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: li === 0 ? BT.text.cyan : BT.text.white }}>{lt.lender.name}</div>
                            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{lt.lender.type}</div>
                            {lt.lender.typicalSpreadBps && <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>SOFR+{lt.lender.typicalSpreadBps}bps</div>}
                            {lt.lender.typicalLtc && <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>LTC max {fmtPct(lt.lender.typicalLtc * 100)}</div>}
                            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.met.financial }}>{lt.lender.recoursePreference}</div>
                            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{lt.fitScore}% fit</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ph.triggers && ph.triggers.length > 0 && (
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 6 }}>PHASE MONITORING TRIGGERS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {ph.triggers.map(t => {
                          const sevColor = t.severity === 'critical' ? BT.text.red : t.severity === 'warning' ? BT.text.amber : BT.text.cyan;
                          return (
                            <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 8px', background: `${sevColor}08`, border: `1px solid ${sevColor}25`, borderRadius: 3 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: MONO, fontSize: 8, color: sevColor, fontWeight: 700 }}>{t.condition}</div>
                                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary }}>{t.action}</div>
                              </div>
                              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>{t.frequency}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border.medium}` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 8 }}>ALTERNATIVE STRUCTURES</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {alternatives.map((alt, i) => (
                <div key={i} style={{ padding: '8px 12px', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, maxWidth: 320 }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.amber, marginBottom: 3 }}>{alt.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white, marginBottom: 3 }}>{alt.productLabel}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, lineHeight: 1.5, marginBottom: 4 }}>{alt.tradeoff}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: alt.deltaAllInBps > 0 ? BT.text.red : BT.met.financial }}>
                        {alt.deltaAllInBps > 0 ? '+' : ''}{alt.deltaAllInBps}bps all-in vs primary
                      </div>
                      {alt.irrImpactBps !== undefined && (
                        <div style={{ fontFamily: MONO, fontSize: 8, color: alt.irrImpactBps >= 0 ? BT.met.financial : BT.text.red }}>
                          IRR: {alt.irrImpactBps >= 0 ? '+' : ''}{alt.irrImpactBps}bps vs primary
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRecompute(alt.product)}
                      disabled={recomputing}
                      style={{ padding: '3px 8px', background: `${BT.text.amber}15`, border: `1px solid ${BT.text.amber}50`, color: BT.text.amber, fontFamily: MONO, fontSize: 7, borderRadius: 2, cursor: recomputing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                    >
                      <RefreshCw style={{ width: 8, height: 8 }} />
                      RUN ALTERNATIVE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monitoring Triggers */}
        {triggers.length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 8 }}>MONITORING TRIGGERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {triggers.map(t => {
                const sevColor = t.severity === 'critical' ? BT.text.red : t.severity === 'warning' ? BT.text.amber : BT.text.cyan;
                const SevIcon = t.severity === 'critical' ? AlertTriangle : t.severity === 'warning' ? AlertTriangle : CheckCircle;
                return (
                  <div key={t.id} style={{ padding: '6px 10px', background: BT.bg.panelAlt, border: `1px solid ${sevColor}30`, borderRadius: 3 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: t.currentValue || t.threshold ? 4 : 0 }}>
                      <SevIcon style={{ width: 10, height: 10, color: sevColor, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: sevColor, marginBottom: 2 }}>{t.condition}</div>
                        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{t.action}</div>
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>{t.frequency}</div>
                    </div>
                    {(t.currentValue || t.threshold) && (
                      <div style={{ display: 'flex', gap: 16, paddingLeft: 20, marginTop: 4 }}>
                        {t.currentValue && (
                          <div style={{ fontFamily: MONO, fontSize: 7 }}>
                            <span style={{ color: BT.text.muted }}>CURRENT: </span>
                            <span style={{ color: BT.text.white }}>{t.currentValue}</span>
                          </div>
                        )}
                        {t.threshold && (
                          <div style={{ fontFamily: MONO, fontSize: 7 }}>
                            <span style={{ color: BT.text.muted }}>THRESHOLD: </span>
                            <span style={{ color: sevColor }}>{t.threshold}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Market Context Rail (right, sticky, 280px) ───────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, background: BT.bg.panel, borderLeft: `1px solid ${BT.border.medium}`, overflowY: 'auto', position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: '100vh', padding: '10px 0' }}>
        <div style={{ padding: '0 12px', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 1, marginBottom: 6 }}>MARKET CONTEXT</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <RateIcon style={{ width: 10, height: 10, color: rateColor }} />
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: rateColor }}>{re.classification.toUpperCase()} RATES</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, lineHeight: 1.5, marginBottom: 6 }}>
            {re.sofrForward12moBps < 0 ? '' : '+'}{Math.round(re.sofrForward12moBps)}bps expected 12mo
          </div>
          {/* SOFR forward sparkline — 6-mo cadence bars */}
          {(() => {
            const baseSofr = re.sofr * 100;
            const fwdBps = re.sofrForward12moBps;
            const pts = [0, 2, 4, 6, 8, 10, 12].map(m => baseSofr + (fwdBps * m / 12) / 100);
            const minV = Math.min(...pts);
            const maxV = Math.max(...pts) || minV + 0.01;
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, marginBottom: 4 }}>
                {pts.map((v, i) => {
                  const pct = (v - minV) / (maxV - minV);
                  const barH = Math.max(4, Math.round(pct * 24) + 4);
                  const barColor = fwdBps > 0 ? BT.text.red : fwdBps < 0 ? BT.met.financial : BT.text.amber;
                  return (
                    <div key={i} title={`M${i * 2}: ${v.toFixed(2)}%`} style={{ flex: 1, height: barH, background: i === 0 ? BT.text.amber : barColor, opacity: 0.6 + i * 0.06, borderRadius: 1 }} />
                  );
                })}
              </div>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>
            <span>NOW {fmtPct(re.sofr * 100)}</span>
            <span>+12MO</span>
          </div>
        </div>

        {[
          { l: 'SOFR', v: fmtPct(re.sofr * 100), c: BT.text.amber },
          { l: '10YR TREASURY', v: fmtPct(re.treasury10y * 100), c: BT.text.secondary },
          { l: 'RATE PREF', v: re.ratePreference, c: re.ratePreference === 'Fixed' ? BT.met.financial : re.ratePreference === 'Floating' ? BT.text.amber : BT.text.muted },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ padding: '4px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{l}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}

        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3 }}>PRICING WINDOW</div>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: windowColor }}>{re.pricingWindowLabel}</div>
          <div style={{ height: 4, background: BT.border.subtle, borderRadius: 2, marginTop: 4 }}>
            <div style={{ height: 4, width: `${re.pricingWindowScore}%`, background: windowColor, borderRadius: 2 }} />
          </div>
        </div>

        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3 }}>RATE CAP ADVICE</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, lineHeight: 1.5 }}>{re.ratCapAdvice}</div>
        </div>

        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3 }}>STRATEGY</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>{si.subStrategyKey.replace(/_/g, ' ').toUpperCase()}</div>
          {si.strategyName && <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{si.strategyName}</div>}
        </div>

        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3 }}>HOLD PERIOD</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{si.holdMonths}mo ({Math.round(si.holdMonths / 12 * 10) / 10}yr)</div>
        </div>

        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 4 }}>RATE NARRATIVE</div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary, lineHeight: 1.6 }}>{re.narrative}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DebtTab({ dealId, f9Financials, onTabChange, onF9Refresh }: FinancialEngineTabProps) {
  const cs = f9Financials?.capitalStack ?? null;
  const f9Debt = f9Financials?.debt ?? null;
  const f9Loan0 = f9Debt?.loans?.[0] ?? null;

  const purchasePrice = cs?.purchasePrice ?? null;
  const baseLoanAmt = cs?.loanAmount ?? 0;
  const noi1 = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? 0;
  const rentGrowth = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const holdYears = f9Financials?.assumptions?.holdYears ?? 5;
  const dealName = f9Financials?.dealName ?? '';

  // ── Determine initial preset from f9Loan0 ──
  const initPresetKey: LoanPresetKey = (LOAN_PRESETS[f9Loan0?.loanTypeLabel as LoanPresetKey] ? f9Loan0?.loanTypeLabel as LoanPresetKey : 'Bridge');
  const initPreset = LOAN_PRESETS[initPresetKey];

  // ── Loan stack ──────────────────────────────────────────────────────────────
  const [loans, setLoans] = useState<LoanState[]>(() => [
    makeLoanState('senior', 'Senior Loan', initPreset, f9Loan0, baseLoanAmt),
  ]);
  const [activeLoanId, setActiveLoanId] = useState<string>('senior');

  // Hydrate from f9Debt.loans on data arrival — restores both senior and mezz from backend
  useEffect(() => {
    if (!f9Debt?.loans?.length) return;
    setLoans(prev => {
      const next = [...prev];
      for (const f9L of f9Debt.loans) {
        const key: LoanPresetKey = LOAN_PRESETS[f9L.loanTypeLabel as LoanPresetKey] ? f9L.loanTypeLabel as LoanPresetKey : (f9L.id === 'mezz' ? 'Mezz' : 'Bridge');
        const existing = next.find(l => l.id === f9L.id);
        if (existing) {
          Object.assign(existing, {
            loanTypeLabel: key,
            rateType: f9L.rateType,
            sofrCurve: f9L.sofrCurve?.length === 5 ? f9L.sofrCurve : SOFR_FWD,
            prepayType: f9L.prepayType as PrepayType ?? existing.prepayType,
            extensionOptions: f9L.extensionOptions ?? existing.extensionOptions,
          });
        } else if (f9L.id === 'mezz') {
          const mPreset = LOAN_PRESETS.Mezz;
          next.push({
            ...makeLoanState('mezz', 'Mezz / B-Note', mPreset, f9L as F9DebtLoan, f9L.loanAmount.platform ?? 0),
            loanTypeLabel: key,
            rateType: f9L.rateType,
            sofrCurve: f9L.sofrCurve?.length === 5 ? f9L.sofrCurve : SOFR_FWD,
            prepayType: f9L.prepayType as PrepayType ?? mPreset.prepayType,
          });
        }
        // Restore refi state from senior loan overrides
        if (f9L.id === 'senior') {
          setRefi(r => ({
            ...r,
            enabled: f9L.refiEnabled,
            triggerYear: f9L.refiTriggerYear ?? r.triggerYear,
            newLoanType: (f9L.refiNewLoanType && LOAN_PRESETS[f9L.refiNewLoanType as LoanPresetKey])
              ? f9L.refiNewLoanType as LoanPresetKey
              : r.newLoanType,
          }));
        }
      }
      return next;
    });
  }, [f9Debt?.loans?.length]);

  const activeLoan = loans.find(l => l.id === activeLoanId) ?? loans[0];
  const preset = LOAN_PRESETS[activeLoan.loanTypeLabel];
  const f9ThisLoan = f9Debt?.loans?.find(l => l.id === activeLoan.id) ?? null;

  // Resolved values
  const effLoanAmt  = activeLoan.userLoanAmount ?? f9ThisLoan?.loanAmount.platform ?? baseLoanAmt;
  const effRate     = activeLoan.rateType === 'Floating'
    ? ((activeLoan.userSofr ?? f9ThisLoan?.sofr.platform ?? activeLoan.sofrCurve[0]) + (activeLoan.userSpread ?? f9ThisLoan?.spread.platform ?? preset.spread))
    : (activeLoan.userRate ?? f9ThisLoan?.interestRate.platform ?? preset.rate);
  const effTerm     = activeLoan.userTerm    ?? f9ThisLoan?.termYears.platform    ?? preset.term;
  const effAmort    = activeLoan.userAmort   ?? f9ThisLoan?.amortYears.platform   ?? preset.amort;
  const effIO       = activeLoan.userIO      ?? f9ThisLoan?.ioMonths.platform     ?? preset.io;
  const effOrigFee  = activeLoan.userOrigFee ?? f9ThisLoan?.origFee.platform      ?? preset.origFee;
  const effExitFee  = activeLoan.userExitFee ?? f9ThisLoan?.exitFee.platform      ?? preset.exitFee;
  const effCapRate  = activeLoan.userCapRate ?? f9ThisLoan?.capRate.platform      ?? preset.rateCapCost;
  const effMinDscr  = activeLoan.userMinDscr ?? f9ThisLoan?.minDscr.platform     ?? preset.minDscr;
  const effMinDY    = activeLoan.userMinDY   ?? f9ThisLoan?.minDebtYield.platform ?? 0.07;
  const effMinOcc   = activeLoan.userMinOcc  ?? f9ThisLoan?.minOccupancy.platform ?? 0.90;
  const effMaxLtv   = activeLoan.userMaxLtv  ?? f9ThisLoan?.maxLtv.platform      ?? preset.maxLtv;
  const effCashTrap = activeLoan.userCashTrapDscr ?? f9ThisLoan?.cashTrapDscr.platform ?? 1.10;
  const effLtc      = purchasePrice != null && purchasePrice > 0 ? effLoanAmt / purchasePrice : null;
  const effLtv      = purchasePrice != null && purchasePrice > 0 ? effLoanAmt / purchasePrice : null;

  // Amortization — floating rate uses SOFR curve per year-bucket + spread
  const effSpread = activeLoan.userSpread ?? f9ThisLoan?.spread.platform ?? preset.spread;
  const amortRows = useMemo(() => buildAmort(
    effLoanAmt, effRate, effTerm, effAmort, effIO,
    typeof noi1 === 'number' ? noi1 : 0,
    effMinDscr,
    activeLoan.rateType === 'Floating',
    activeLoan.sofrCurve,
    effSpread,
  ), [effLoanAmt, effRate, effTerm, effAmort, effIO, noi1, effMinDscr, activeLoan.rateType, activeLoan.sofrCurve, effSpread]);
  const annualRows = useMemo(() => buildAnnual(amortRows, typeof noi1 === 'number' ? noi1 : 0, rentGrowth, effMinDscr), [amortRows, noi1, rentGrowth, effMinDscr]);

  // Derived metrics
  const annualDS1 = annualRows[0]?.annualDS ?? (effLoanAmt * effRate);
  const dscrY1 = annualDS1 > 0 && typeof noi1 === 'number' && noi1 > 0 ? noi1 / annualDS1 : null;
  const debtYieldY1 = effLoanAmt > 0 && typeof noi1 === 'number' ? noi1 / effLoanAmt : null;

  // Aggregate across stack
  const aggTotalLoan = loans.length > 1
    ? loans.reduce((s, l) => {
        const p = LOAN_PRESETS[l.loanTypeLabel];
        const f9l = f9Debt?.loans?.find(x => x.id === l.id) ?? null;
        return s + (l.userLoanAmount ?? f9l?.loanAmount.platform ?? baseLoanAmt);
      }, 0)
    : effLoanAmt;

  const dscrColor = (v: number | null) => v == null ? BT.text.muted : v >= 1.35 ? BT.met.financial : v >= 1.20 ? BT.text.amber : BT.text.red;
  const ltvColor  = (v: number | null) => v == null ? BT.text.muted : v <= 0.60 ? BT.met.financial : v <= 0.70 ? BT.text.amber : BT.text.red;

  const patchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const patchDebt = useCallback((loanId: string, fieldName: string, value: number | null) => {
    const key = `debt:${loanId}:${fieldName}`;
    clearTimeout(patchTimeouts.current[key]);
    patchTimeouts.current[key] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: key, year: 1, value });
        onF9Refresh?.();
      } catch { /* non-fatal */ }
    }, 600);
  }, [dealId, onF9Refresh]);
  const patchDebtStr = useCallback((loanId: string, fieldName: string, value: string) => {
    const key = `debt:${loanId}:${fieldName}`;
    clearTimeout(patchTimeouts.current[key]);
    patchTimeouts.current[key] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: key, year: 1, value, strValue: value });
        onF9Refresh?.();
      } catch { /* non-fatal */ }
    }, 600);
  }, [dealId, onF9Refresh]);
  // Direct (non-debounced) batch clear — used by applyPreset to flush all overrides atomically
  const clearDebtOverrides = useCallback(async (loanId: string, fields: string[]) => {
    await Promise.all(fields.map(f =>
      apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: `debt:${loanId}:${f}`, year: 1, value: null }).catch(() => null)
    ));
    onF9Refresh?.();
  }, [dealId, onF9Refresh]);

  const updateLoan = useCallback((id: string, patch: Partial<LoanState>) => {
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const applyPreset = useCallback((id: string, key: LoanPresetKey) => {
    const p = LOAN_PRESETS[key];
    setLoans(prev => prev.map(l => l.id !== id ? l : {
      ...l,
      loanTypeLabel: key,
      rateType: p.rateType,
      prepayType: p.prepayType,
      userRate: null, userSpread: null, userSofr: null, userCapRate: null,
      userTerm: null, userAmort: null, userIO: null,
      userOrigFee: null, userExitFee: null, userRateCapCost: null,
      userMinDscr: null, userMinDY: null, userMinOcc: null, userMaxLtv: null,
    }));
    // Clear all persisted numeric overrides atomically, then persist the new preset strings
    const numericFields = ['interestRate','sofr','sofrCurve:0','spread','capRate','termYears',
      'amortYears','ioMonths','origFee','exitFee','rateCapCost','minDscr','minDY','minOcc',
      'maxLtv','cashTrapDscr','tiEscrow','replReserve','opReserveMonths'];
    clearDebtOverrides(id, numericFields).then(() => {
      patchDebtStr(id, 'loanTypeLabel', key);
      patchDebtStr(id, 'rateType', p.rateType);
      patchDebtStr(id, 'prepayType', p.prepayType);
    });
  }, [clearDebtOverrides, patchDebtStr]);

  const addLoan = useCallback((typeKey: LoanPresetKey = 'Mezz') => {
    if (loans.length >= 5) return;
    const newId = `loan_${Date.now()}`;
    const p = LOAN_PRESETS[typeKey];
    const letter = LOAN_LETTERS[loans.length] ?? String(loans.length + 1);
    setLoans(prev => [...prev, makeLoanState(newId, `Loan ${letter}`, p)]);
    setActiveLoanId(newId);
    patchDebt(newId, 'loanAmount', 0);
    patchDebtStr(newId, 'loanTypeLabel', typeKey);
    patchDebtStr(newId, 'rateType', p.rateType);
    patchDebtStr(newId, 'prepayType', p.prepayType);
  }, [loans, patchDebt, patchDebtStr]);

  // keep addMezz as alias for backward compat with hydration code
  const addMezz = useCallback(() => addLoan('Mezz'), [addLoan]);

  const removeLoan = useCallback((id: string) => {
    if (id === 'senior') return;
    setLoans(prev => prev.filter(l => l.id !== id));
    setActiveLoanId('senior');
    // Clear all debt:mezz:* overrides so backend drops the loan and leaves no orphaned state
    const allMezzFields = ['loanAmount','interestRate','sofr','spread','capRate','termYears',
      'amortYears','ioMonths','origFee','exitFee','rateCapCost','minDscr','minDY','minOcc',
      'maxLtv','cashTrapDscr','tiEscrow','replReserve','opReserveMonths',
      ...Array.from({ length: 5 }, (_, i) => `sofrCurve:${i}`)];
    clearDebtOverrides(id, allMezzFields);
  }, [clearDebtOverrides]);

  // ── Collapsed sections ──────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['amort']));
  const toggle = (s: string) => setCollapsed(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // ── Loan structure mode ──────────────────────────────────────────────────────
  const [loanRelationship, setLoanRelationship] = useState<'stack' | 'chain'>('stack');
  const [addLoanMenuOpen, setAddLoanMenuOpen] = useState(false);

  // ── Refi event ──────────────────────────────────────────────────────────────
  const [refi, setRefi] = useState<RefiState>({ enabled: false, triggerYear: 3, newLoanType: 'Agency', newLoanAmtPct: 0.70 });
  const refiPreset = LOAN_PRESETS[refi.newLoanType];
  const refiPayoff = useMemo(() => {
    const yr = refi.triggerYear;
    const row = annualRows[yr - 1];
    if (!row) return null;
    const balloon = row.closeBalance;
    const prepay = activeLoan.prepayType === 'yield_maintenance' ? balloon * 0.02
      : activeLoan.prepayType === 'defeasance' ? balloon * 0.015
      : activeLoan.prepayType === 'stepdown' ? balloon * Math.max(0, 0.05 - (yr - 1) * 0.01)
      : activeLoan.prepayType === 'open' ? 0
      : balloon * 0.03;
    return { balloon, prepay, exitFee: balloon * effExitFee, total: balloon + prepay + balloon * effExitFee };
  }, [annualRows, refi.triggerYear, activeLoan.prepayType, effExitFee]);
  // Prefer backend-computed refi tax (taxes.transferTax.refi) for accuracy; fall back to local estimate
  const backendRefiTax = f9Financials?.taxes?.transferTax?.refi;
  const refiDocStamps = backendRefiTax?.refiTotalTax ?? (refiPayoff ? refiPayoff.balloon * 0.0035 + refiPayoff.balloon * 0.002 : null);

  // ── SOFR curve editor ───────────────────────────────────────────────────────
  const updateSofrCurve = (idx: number, val: number) => {
    const next = [...activeLoan.sofrCurve];
    next[idx] = val / 100;
    updateLoan(activeLoan.id, { sofrCurve: next });
    patchDebt(activeLoan.id, `sofrCurve:${idx}`, val / 100);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const [showAnnual, setShowAnnual] = useState(true);
  const [debtView, setDebtView] = useState<'advisor' | 'configure'>('advisor');
  const [advisorBaseline, setAdvisorBaseline] = useState<{ loanAmount: number; rate: number } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: debtView === 'advisor' ? 'hidden' : 'auto', background: BT.bg.terminal }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '5px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>F9 · DEBT</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{dealName}</span>
        <span style={{ fontFamily: MONO, fontSize: 8, padding: '2px 6px', background: `${BT.text.cyan}15`, border: `1px solid ${BT.text.cyan}40`, borderRadius: 3, color: BT.text.cyan }}>
          {loans.length === 1 ? 'SENIOR ONLY' : `${loans.length}-LOAN STACK`}
        </span>
        {loans.length > 1 && (
          <span style={{ fontFamily: MONO, fontSize: 8, padding: '2px 6px', background: `${BT.text.purple}15`, border: `1px solid ${BT.text.purple}40`, borderRadius: 3, color: BT.text.purple }}>
            BLENDED {fmtPctFull(
              loans.reduce((s, l) => {
                const f9l = f9Debt?.loans?.find(x => x.id === l.id);
                const p = LOAN_PRESETS[l.loanTypeLabel];
                const la = l.userLoanAmount ?? f9l?.loanAmount.platform ?? baseLoanAmt;
                const r  = l.rateType === 'Floating'
                  ? ((l.userSofr ?? f9l?.sofr.platform ?? l.sofrCurve[0]) + (l.userSpread ?? f9l?.spread.platform ?? p.spread))
                  : (l.userRate ?? f9l?.interestRate.platform ?? p.rate);
                return s + la * r;
              }, 0) / (aggTotalLoan || 1)
            )}
          </span>
        )}
      </div>

      {/* ── Advisor / Configure Toggle ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.panelAlt, flexShrink: 0, padding: '0 12px' }}>
        {(['advisor', 'configure'] as const).map(v => (
          <button
            key={v}
            onClick={() => setDebtView(v)}
            style={{
              padding: '6px 16px', fontFamily: MONO, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: debtView === v ? BT.text.white : BT.text.muted,
              borderBottom: debtView === v ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
              letterSpacing: 0.6,
            }}
          >
            {v === 'advisor' ? 'ADVISOR' : 'CONFIGURE'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          {debtView === 'advisor' ? 'Strategy-driven recommendation' : 'Manual loan configuration'}
        </span>
      </div>

      {/* ── Advisor View ──────────────────────────────────────────────────────── */}
      {debtView === 'advisor' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DebtAdvisorView
            dealId={dealId}
            onSwitchToConfigure={() => setDebtView('configure')}
            onAccept={() => setDebtView('configure')}
            configuredLoanAmount={effLoanAmt}
            configuredRate={effRate}
            onAdvisorAccepted={(la, r) => setAdvisorBaseline({ loanAmount: la, rate: r })}
            onF9Refresh={onF9Refresh}
          />
        </div>
      )}

      {/* ── Configure View ────────────────────────────────────────────────────── */}
      {debtView === 'configure' && (<>

      {/* ── Configure Divergence Banner ─────────────────────────────────────── */}
      {advisorBaseline && activeLoan.id === 'senior' && (() => {
        const laDiv = advisorBaseline.loanAmount > 0 ? Math.abs(effLoanAmt - advisorBaseline.loanAmount) / advisorBaseline.loanAmount : 0;
        const rateDiv = Math.round((effRate - advisorBaseline.rate) * 10000);
        const hasCfgDiv = laDiv > 0.05 || Math.abs(rateDiv) > 25;
        if (!hasCfgDiv) return null;
        const irrEst = Math.round(Math.abs(rateDiv) * 0.35 + laDiv * 200);
        const dscrEst = Math.round(Math.abs(rateDiv) * 0.6);
        return (
          <div style={{ padding: '7px 14px', background: `${BT.text.amber}15`, borderBottom: `1px solid ${BT.text.amber}40`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <AlertTriangle style={{ width: 11, height: 11, color: BT.text.amber, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, fontWeight: 700 }}>ADVISOR DIVERGENCE · </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>
              Configure differs from Advisor recommendation
              {Math.abs(rateDiv) > 0 && ` (rate: ${rateDiv > 0 ? '+' : ''}${rateDiv}bps`}
              {laDiv > 0.05 && `, loan size: ${laDiv > 0 ? '+' : ''}${(laDiv * 100).toFixed(0)}%`}
              {Math.abs(rateDiv) > 0 && ')'}
              {irrEst > 0 && ` · Est. IRR impact: ~${irrEst}bps`}
              {dscrEst > 0 && ` · DSCR cushion shift: ~${dscrEst}bps`}
            </span>
            <button
              onClick={() => setDebtView('advisor')}
              style={{ padding: '2px 10px', background: 'transparent', border: `1px solid ${BT.text.amber}50`, color: BT.text.amber, fontFamily: MONO, fontSize: 7, cursor: 'pointer', borderRadius: 2, flexShrink: 0 }}
            >
              VIEW ADVISOR
            </button>
          </div>
        );
      })()}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0 }}>
        <KpiTile label="LOAN AMOUNT"    value={fmt$(effLoanAmt)}             color={BT.text.cyan} />
        <KpiTile label="ALL-IN RATE"    value={fmtPctFull(effRate)}           color={activeLoan.rateType === 'Floating' ? BT.text.amber : BT.met.financial} />
        <KpiTile label="LTC"            value={effLtc != null ? fmtPct(effLtc * 100) : '—'} color={ltvColor(effLtc)} />
        <KpiTile label="DSCR Y1"        value={dscrY1 != null ? `${dscrY1.toFixed(2)}×` : '—'} color={dscrColor(dscrY1)} />
        <KpiTile label="DEBT YIELD Y1"  value={debtYieldY1 != null ? fmtPct(debtYieldY1 * 100) : '—'} color={BT.text.amber} />
        <KpiTile label="ANNUAL DS"      value={fmt$(annualDS1)}              color={BT.text.red} />
        {loans.length > 1 && <KpiTile label="TOTAL STACK" value={fmt$(aggTotalLoan)} color={BT.text.purple} />}
      </div>

      {/* ── Loan stack tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${BT.border.medium}`, background: BT.bg.panel, flexShrink: 0, flexWrap: 'wrap' }}>

        {/* STACK / CHAIN mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', borderRight: `1px solid ${BT.border.medium}`, padding: '0 6px', gap: 2, flexShrink: 0 }}>
          {(['stack', 'chain'] as const).map(mode => (
            <button key={mode} onClick={() => setLoanRelationship(mode)} style={{
              padding: '4px 10px', fontFamily: MONO, fontSize: 8, fontWeight: 700, cursor: 'pointer',
              background: loanRelationship === mode ? `${mode === 'stack' ? BT.text.cyan : BT.text.amber}20` : 'transparent',
              border: `1px solid ${loanRelationship === mode ? (mode === 'stack' ? BT.text.cyan : BT.text.amber) : 'transparent'}`,
              color: loanRelationship === mode ? (mode === 'stack' ? BT.text.cyan : BT.text.amber) : BT.text.muted,
              borderRadius: 3,
            }}>
              {mode === 'stack' ? '⊞ STACK' : '⟶ CHAIN'}
            </button>
          ))}
        </div>

        {/* Per-loan tabs — LOAN A, LOAN B, LOAN C */}
        {loans.map((l, idx) => {
          const letter = LOAN_LETTERS[idx] ?? String(idx + 1);
          const isActive = l.id === activeLoanId;
          const typeColor = l.loanTypeLabel === 'Bridge' || l.loanTypeLabel === 'BNote' ? BT.text.amber
            : l.loanTypeLabel === 'Agency' || l.loanTypeLabel === 'FannieDUS' ? BT.text.cyan
            : l.loanTypeLabel === 'CMBS' ? '#a855f7'
            : l.loanTypeLabel === 'HUD' ? BT.met.financial
            : l.loanTypeLabel === 'LifeCo' ? '#8b5cf6'
            : l.loanTypeLabel === 'Mezz' ? BT.text.red
            : BT.text.amber;
          return (
            <div key={l.id} onClick={() => setActiveLoanId(l.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', cursor: 'pointer',
              borderRight: `1px solid ${BT.border.subtle}`,
              background: isActive ? BT.bg.active : 'transparent',
              borderBottom: isActive ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 900, color: isActive ? BT.text.white : BT.text.muted, letterSpacing: 0.5 }}>
                LOAN {letter}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: `${typeColor}20`, border: `1px solid ${typeColor}60`, color: typeColor }}>
                {l.loanTypeLabel === 'BNote' ? 'B-NOTE' : l.loanTypeLabel.toUpperCase()}
              </span>
              {idx > 0 && (
                <span onClick={e => { e.stopPropagation(); removeLoan(l.id); setAddLoanMenuOpen(false); }} style={{ cursor: 'pointer', color: BT.text.muted, padding: '0 2px' }}>
                  <X style={{ width: 9, height: 9 }} />
                </span>
              )}
            </div>
          );
        })}

        {/* ADD LOAN button */}
        {loans.length < 5 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div onClick={() => setAddLoanMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', cursor: 'pointer', color: BT.text.muted }}>
              <Plus style={{ width: 10, height: 10 }} />
              <span style={{ fontFamily: MONO, fontSize: 8 }}>ADD LOAN {LOAN_LETTERS[loans.length] ?? ''}</span>
            </div>
            {addLoanMenuOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 4, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', padding: '4px 0' }}
                onMouseLeave={() => setAddLoanMenuOpen(false)}>
                <div style={{ padding: '3px 10px', fontFamily: MONO, fontSize: 7, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}`, marginBottom: 2 }}>SELECT LOAN TYPE</div>
                {(Object.keys(LOAN_PRESETS) as LoanPresetKey[]).map(key => (
                  <div key={key} onClick={() => { addLoan(key); setAddLoanMenuOpen(false); }} style={{
                    padding: '4px 12px', fontFamily: MONO, fontSize: 8, fontWeight: 700,
                    color: BT.text.secondary, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${BT.text.cyan}15`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span>{key === 'BNote' ? 'B-Note' : key}</span>
                    <span style={{ color: BT.text.muted, fontSize: 7 }}>
                      {key === 'Bridge' ? 'Float · 3yr' : key === 'Agency' ? 'Fixed · 10yr' : key === 'FannieDUS' ? 'Fixed · 10yr' : key === 'CMBS' ? 'Fixed · 10yr' : key === 'HUD' ? 'Fixed · 35yr' : key === 'LifeCo' ? 'Fixed · 15yr' : key === 'Mezz' ? 'Float · 3yr' : 'Float · 3yr'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHAIN timeline visualization ──────────────────────────────────────── */}
      {loanRelationship === 'chain' && loans.length > 1 && (() => {
        let cursor = 0;
        const segments = loans.map((l, idx) => {
          const p = LOAN_PRESETS[l.loanTypeLabel];
          const f9l = f9Debt?.loans?.find(x => x.id === l.id);
          const termYrs = l.userTerm ?? f9l?.termYears.platform ?? p.term;
          const start = cursor;
          cursor += termYrs;
          const letter = LOAN_LETTERS[idx] ?? String(idx + 1);
          const typeColor = l.loanTypeLabel === 'Bridge' || l.loanTypeLabel === 'BNote' ? BT.text.amber
            : l.loanTypeLabel === 'Agency' || l.loanTypeLabel === 'FannieDUS' ? BT.text.cyan
            : l.loanTypeLabel === 'CMBS' ? '#a855f7'
            : l.loanTypeLabel === 'HUD' ? BT.met.financial
            : l.loanTypeLabel === 'LifeCo' ? '#8b5cf6'
            : l.loanTypeLabel === 'Mezz' ? BT.text.red : BT.text.amber;
          return { letter, typeColor, termYrs, start, end: cursor, pct: termYrs };
        });
        const totalYrs = cursor || 1;
        return (
          <div style={{ padding: '8px 12px', background: `${BT.text.amber}08`, borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber, fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em' }}>
              ⟶ DAISY CHAIN TIMELINE · {totalYrs} YR TOTAL
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden', border: `1px solid ${BT.border.subtle}` }}>
              {segments.map((seg, i) => (
                <div key={i} style={{
                  flex: seg.termYrs / totalYrs,
                  background: `${seg.typeColor}30`,
                  borderRight: i < segments.length - 1 ? `2px solid ${BT.bg.terminal}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative',
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 900, color: seg.typeColor }}>LOAN {seg.letter}</span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: seg.typeColor, opacity: 0.8 }}>{seg.termYrs}yr</span>
                  {i < segments.length - 1 && (
                    <div style={{ position: 'absolute', right: -8, zIndex: 2, color: BT.text.amber, fontSize: 10, fontWeight: 900 }}>⟶</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', marginTop: 2 }}>
              {segments.map((seg, i) => (
                <div key={i} style={{ flex: seg.termYrs / totalYrs, fontFamily: MONO, fontSize: 7, color: BT.text.muted, textAlign: 'left', paddingLeft: 2 }}>
                  Yr {seg.start + 1}
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>Yr {totalYrs}</div>
            </div>
          </div>
        );
      })()}

      {/* ── STACK visualization (when multiple loans) ──────────────────────────── */}
      {loanRelationship === 'stack' && loans.length > 1 && (() => {
        const totalStack = loans.reduce((s, l) => {
          const f9l = f9Debt?.loans?.find(x => x.id === l.id);
          const p = LOAN_PRESETS[l.loanTypeLabel];
          return s + (l.userLoanAmount ?? f9l?.loanAmount.platform ?? (l.id === 'senior' ? baseLoanAmt : 0));
        }, 0);
        if (totalStack === 0) return null;
        let cumPct = 0;
        return (
          <div style={{ padding: '8px 12px', background: `${BT.text.cyan}08`, borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, fontWeight: 700, marginBottom: 6, letterSpacing: '0.08em' }}>
              ⊞ STACKED DEBT LAYERS · {fmt$(totalStack)} TOTAL
            </div>
            <div style={{ display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden', border: `1px solid ${BT.border.subtle}` }}>
              {loans.map((l, idx) => {
                const f9l = f9Debt?.loans?.find(x => x.id === l.id);
                const p = LOAN_PRESETS[l.loanTypeLabel];
                const lAmt = l.userLoanAmount ?? f9l?.loanAmount.platform ?? (l.id === 'senior' ? baseLoanAmt : 0);
                const pct = totalStack > 0 ? lAmt / totalStack : 0;
                const letter = LOAN_LETTERS[idx] ?? String(idx + 1);
                const typeColor = l.loanTypeLabel === 'Bridge' || l.loanTypeLabel === 'BNote' ? BT.text.amber
                  : l.loanTypeLabel === 'Agency' || l.loanTypeLabel === 'FannieDUS' ? BT.text.cyan
                  : l.loanTypeLabel === 'CMBS' ? '#a855f7'
                  : l.loanTypeLabel === 'HUD' ? BT.met.financial
                  : l.loanTypeLabel === 'LifeCo' ? '#8b5cf6'
                  : l.loanTypeLabel === 'Mezz' ? BT.text.red : BT.text.amber;
                const start = cumPct;
                cumPct += pct;
                return (
                  <div key={l.id} style={{ flex: pct, background: `${typeColor}30`, borderRight: idx < loans.length - 1 ? `2px solid ${BT.bg.terminal}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 900, color: typeColor }}>LOAN {letter}</span>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: typeColor, opacity: 0.8 }}>{(pct * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 2 }}>
              {loans.map((l, idx) => {
                const f9l = f9Debt?.loans?.find(x => x.id === l.id);
                const lAmt = l.userLoanAmount ?? f9l?.loanAmount.platform ?? (l.id === 'senior' ? baseLoanAmt : 0);
                const letter = LOAN_LETTERS[idx] ?? String(idx + 1);
                return lAmt > 0 ? `Loan ${letter}: ${fmt$(lAmt)}` : null;
              }).filter(Boolean).join('  ·  ')}
            </div>
          </div>
        );
      })()}

      {/* ── Loan type selector ──────────────────────────────────────────────── */}
      <div style={{ padding: '6px 12px', background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white }}>
          LOAN {LOAN_LETTERS[loans.findIndex(l => l.id === activeLoanId)] ?? '?'} ·
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TYPE:</span>
        {(Object.keys(LOAN_PRESETS) as LoanPresetKey[]).map(key => (
          <button
            key={key}
            onClick={() => applyPreset(activeLoan.id, key)}
            style={{
              padding: '2px 10px', fontFamily: MONO, fontSize: 8, fontWeight: 700,
              background: activeLoan.loanTypeLabel === key ? `${BT.text.cyan}20` : 'transparent',
              border: `1px solid ${activeLoan.loanTypeLabel === key ? BT.text.cyan : BT.border.subtle}`,
              color: activeLoan.loanTypeLabel === key ? BT.text.cyan : BT.text.muted,
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            {key === 'BNote' ? 'B-Note' : key}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>RATE TYPE:</span>
        {(['Fixed', 'Floating'] as const).map(rt => (
          <button
            key={rt}
            onClick={() => { updateLoan(activeLoan.id, { rateType: rt }); patchDebtStr(activeLoan.id, 'rateType', rt); }}
            style={{
              padding: '2px 10px', fontFamily: MONO, fontSize: 8, fontWeight: 700,
              background: activeLoan.rateType === rt ? `${rt === 'Fixed' ? BT.met.financial : BT.text.amber}20` : 'transparent',
              border: `1px solid ${activeLoan.rateType === rt ? (rt === 'Fixed' ? BT.met.financial : BT.text.amber) : BT.border.subtle}`,
              color: activeLoan.rateType === rt ? (rt === 'Fixed' ? BT.met.financial : BT.text.amber) : BT.text.muted,
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            {rt.toUpperCase()}
          </button>
        ))}
      </div>
      <SectionHeader letter="A" title="LOAN SIZING" subtitle="4-column Broker / Platform / User / Resolved" collapsed={collapsed.has('a')} onToggle={() => toggle('a')} />
      {!collapsed.has('a') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              <DebtRow
                label="LOAN AMOUNT ($)"
                broker={f9ThisLoan?.loanAmount.broker}
                platform={f9ThisLoan?.loanAmount.platform ?? (baseLoanAmt || null)}
                user={activeLoan.userLoanAmount}
                userEditable
                format={fmtDlr}
                onUserChange={v => { updateLoan(activeLoan.id, { userLoanAmount: v }); patchDebt(activeLoan.id, 'loanAmount', v); }}
              />
              <DebtRow
                label="LOAN AMOUNT (LTC%)"
                broker={f9ThisLoan?.ltcPct.broker}
                platform={f9ThisLoan?.ltcPct.platform ?? (purchasePrice ? baseLoanAmt / purchasePrice : null)}
                user={null}
                format={fmtPctFull}
                locked
                sub="Derived from loan amount ÷ purchase price"
              />
              <DebtRow
                label="GOING-IN LTV"
                platform={effLtv}
                user={null}
                format={fmtPctFull}
                locked
                sub="Loan amount ÷ purchase price"
                pass={effLtv != null ? effLtv <= effMaxLtv : undefined}
              />
              <DebtRow
                label="DEBT YIELD (Y1)"
                platform={debtYieldY1}
                user={null}
                format={fmtPctFull}
                locked
                sub="NOI ÷ loan amount"
                pass={debtYieldY1 != null ? debtYieldY1 >= effMinDY : undefined}
              />
              <DebtRow
                label="DSCR AT CLOSE (Y1)"
                platform={dscrY1}
                user={null}
                format={fmtX}
                locked
                sub="NOI ÷ annual debt service"
                pass={dscrY1 != null ? dscrY1 >= effMinDscr : undefined}
              />
            </tbody>
          </table>
        </div>
      )}
      <SectionHeader letter="B" title="PRICING & RATE" subtitle={activeLoan.rateType === 'Floating' ? 'SOFR + SPREAD — RATE CAP' : 'FIXED RATE'} collapsed={collapsed.has('b')} onToggle={() => toggle('b')} />
      {!collapsed.has('b') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              {activeLoan.rateType === 'Fixed' ? (
                <DebtRow
                  label="INTEREST RATE"
                  broker={f9ThisLoan?.interestRate.broker}
                  platform={f9ThisLoan?.interestRate.platform ?? preset.rate}
                  user={activeLoan.userRate}
                  userEditable
                  format={fmtPctFull}
                  onUserChange={v => { updateLoan(activeLoan.id, { userRate: v }); patchDebt(activeLoan.id, 'interestRate', v); }}
                  sub="Fixed all-in rate"
                />
              ) : (
                <>
                  <DebtRow
                    label="SOFR (CURRENT)"
                    platform={f9ThisLoan?.sofr.platform ?? SOFR_FWD[0]}
                    user={activeLoan.userSofr}
                    userEditable
                    format={fmtPctFull}
                    onUserChange={v => {
                      updateLoan(activeLoan.id, { userSofr: v });
                      patchDebt(activeLoan.id, 'sofr', v);
                      patchDebt(activeLoan.id, 'sofrCurve:0', v); // sync sofrCurve[0] so backend round-trips correctly
                    }}
                    sub="30-day Term SOFR"
                  />
                  <DebtRow
                    label="SPREAD OVER SOFR"
                    broker={f9ThisLoan?.spread.broker}
                    platform={f9ThisLoan?.spread.platform ?? preset.spread}
                    user={activeLoan.userSpread}
                    userEditable
                    format={fmtPctFull}
                    onUserChange={v => { updateLoan(activeLoan.id, { userSpread: v }); patchDebt(activeLoan.id, 'spread', v); }}
                  />
                  <DebtRow
                    label="ALL-IN RATE (SOFR+SPREAD)"
                    platform={effRate}
                    user={null}
                    format={fmtPctFull}
                    locked
                    sub="Derived"
                  />
                  <DebtRow
                    label="RATE CAP STRIKE"
                    broker={f9ThisLoan?.capRate.broker}
                    platform={f9ThisLoan?.capRate.platform ?? preset.rateCapCost}
                    user={activeLoan.userCapRate}
                    userEditable
                    format={fmtPctFull}
                    onUserChange={v => { updateLoan(activeLoan.id, { userCapRate: v }); patchDebt(activeLoan.id, 'capRate', v); }}
                    sub="SOFR cap — lender required"
                  />
                </>
              )}
            </tbody>
          </table>

          {/* SOFR Forward Curve editor (floating only) */}
          {activeLoan.rateType === 'Floating' && (
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4, letterSpacing: 0.5 }}>SOFR FORWARD CURVE — click to edit (% per year)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {activeLoan.sofrCurve.map((v, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>Y{i + 1}</span>
                    <input
                      type="number"
                      step="0.05"
                      value={(v * 100).toFixed(2)}
                      onChange={e => updateSofrCurve(i, parseFloat(e.target.value) || 0)}
                      style={{ width: 52, background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.amber, fontFamily: MONO, fontSize: 9, padding: '2px 4px', borderRadius: 2, textAlign: 'center' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <SectionHeader letter="C" title="TERM & STRUCTURE" subtitle="Term · Amortization · IO months · Extension" collapsed={collapsed.has('c')} onToggle={() => toggle('c')} />
      {!collapsed.has('c') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              <DebtRow
                label="TERM (years)"
                broker={f9ThisLoan?.termYears.broker}
                platform={f9ThisLoan?.termYears.platform ?? preset.term}
                user={activeLoan.userTerm}
                userEditable
                format={fmtYrs}
                onUserChange={v => { updateLoan(activeLoan.id, { userTerm: v }); patchDebt(activeLoan.id, 'termYears', v); }}
              />
              <DebtRow
                label="AMORTIZATION (years)"
                broker={f9ThisLoan?.amortYears.broker}
                platform={f9ThisLoan?.amortYears.platform ?? preset.amort}
                user={activeLoan.userAmort}
                userEditable
                format={v => v != null ? (v === 0 ? 'IO Only' : fmtYrs(v)) : '—'}
                onUserChange={v => { updateLoan(activeLoan.id, { userAmort: v }); patchDebt(activeLoan.id, 'amortYears', v); }}
              />
              <DebtRow
                label="IO PERIOD (months)"
                broker={f9ThisLoan?.ioMonths.broker}
                platform={f9ThisLoan?.ioMonths.platform ?? preset.io}
                user={activeLoan.userIO}
                userEditable
                format={v => v != null ? (v === 0 ? 'None' : fmtMo(v)) : '—'}
                onUserChange={v => { updateLoan(activeLoan.id, { userIO: v }); patchDebt(activeLoan.id, 'ioMonths', v); }}
                sub={effIO > 0 ? `IO through month ${effIO}` : 'Fully amortizing from month 1'}
              />
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ padding: '3px 12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, borderRight: `1px solid ${BT.border.subtle}` }}>EXTENSION OPTIONS</td>
                <td colSpan={4} style={{ padding: '3px 10px' }}>
                  <input
                    value={activeLoan.extensionOptions}
                    onChange={e => {
                      updateLoan(activeLoan.id, { extensionOptions: e.target.value });
                      patchDebtStr(activeLoan.id, 'extensionOptions', e.target.value);
                    }}
                    placeholder="e.g. 2 × 1yr @ 25bp fee (conditions: DSCR ≥ 1.10×)"
                    style={{ width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.green, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2 }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <SectionHeader letter="D" title="FEES & COSTS" subtitle={`Origination · Exit · Rate Cap${activeLoan.rateType === 'Floating' ? ' · Other' : ''}`} collapsed={collapsed.has('d')} onToggle={() => toggle('d')} />
      {!collapsed.has('d') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              <DebtRow
                label="ORIGINATION FEE"
                broker={f9ThisLoan?.origFee.broker}
                platform={f9ThisLoan?.origFee.platform ?? preset.origFee}
                user={activeLoan.userOrigFee}
                userEditable
                format={fmtPctFull}
                onUserChange={v => { updateLoan(activeLoan.id, { userOrigFee: v }); patchDebt(activeLoan.id, 'origFee', v); }}
                sub={`${fmt$(effLoanAmt * effOrigFee)} at close`}
              />
              <DebtRow
                label="EXIT FEE"
                platform={f9ThisLoan?.exitFee.platform ?? preset.exitFee}
                user={activeLoan.userExitFee}
                userEditable
                format={fmtPctFull}
                onUserChange={v => { updateLoan(activeLoan.id, { userExitFee: v }); patchDebt(activeLoan.id, 'exitFee', v); }}
                sub="Applied on payoff/refi"
              />
              {activeLoan.rateType === 'Floating' && (
                <DebtRow
                  label="RATE CAP COST"
                  broker={f9ThisLoan?.rateCapCost.broker}
                  platform={f9ThisLoan?.rateCapCost.platform ?? preset.rateCapCost}
                  user={activeLoan.userRateCapCost}
                  userEditable
                  format={fmtPctFull}
                  onUserChange={v => { updateLoan(activeLoan.id, { userRateCapCost: v }); patchDebt(activeLoan.id, 'rateCapCost', v); }}
                  sub="Upfront cost of rate cap — flows to Sources & Uses"
                />
              )}
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panelAlt }}>
                <td style={{ padding: '3px 12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, borderRight: `1px solid ${BT.border.subtle}` }}>TOTAL UPFRONT FEES</td>
                <td colSpan={3} />
                <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.red }}>
                  {fmt$(effLoanAmt * effOrigFee + effLoanAmt * effExitFee + (activeLoan.rateType === 'Floating' ? effLoanAmt * (activeLoan.userRateCapCost ?? f9ThisLoan?.rateCapCost.platform ?? preset.rateCapCost) : 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <SectionHeader letter="E" title="PREPAYMENT" subtitle="Structure · Penalty at each year" collapsed={collapsed.has('e')} onToggle={() => toggle('e')} />
      {!collapsed.has('e') && (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.medium}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PREPAY TYPE:</span>
            {(['lockout', 'yield_maintenance', 'defeasance', 'stepdown', 'open'] as PrepayType[]).map(t => (
              <button
                key={t}
                onClick={() => { updateLoan(activeLoan.id, { prepayType: t }); patchDebtStr(activeLoan.id, 'prepayType', t); }}
                style={{
                  padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700,
                  background: activeLoan.prepayType === t ? `${BT.text.amber}20` : 'transparent',
                  border: `1px solid ${activeLoan.prepayType === t ? BT.text.amber : BT.border.subtle}`,
                  color: activeLoan.prepayType === t ? BT.text.amber : BT.text.muted,
                  borderRadius: 3, cursor: 'pointer',
                }}
              >
                {t.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
              <thead>
                <tr style={{ background: BT.bg.header }}>
                  {Array.from({ length: Math.min(effTerm, 10) }, (_, i) => i + 1).map(yr => (
                    <th key={yr} style={{ padding: '3px 10px', color: BT.text.muted, fontWeight: 500 }}>Y{yr}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Array.from({ length: Math.min(effTerm, 10) }, (_, i) => {
                    const yr = i + 1;
                    let penalty = '—';
                    if (activeLoan.prepayType === 'lockout') penalty = yr <= 2 ? 'LOCKED' : '—';
                    else if (activeLoan.prepayType === 'yield_maintenance') penalty = 'YM';
                    else if (activeLoan.prepayType === 'defeasance') penalty = 'DEF';
                    else if (activeLoan.prepayType === 'stepdown') penalty = `${Math.max(0, 5 - (yr - 1))}%`;
                    else if (activeLoan.prepayType === 'open') penalty = 'OPEN';
                    return (
                      <td key={yr} style={{ padding: '3px 10px', textAlign: 'center', color: penalty === 'LOCKED' ? BT.text.red : penalty === 'OPEN' ? BT.met.financial : BT.text.amber }}>
                        {penalty}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SectionHeader letter="F" title="COVENANTS & TESTS" subtitle="Lender underwriting thresholds — pass/fail" collapsed={collapsed.has('f')} onToggle={() => toggle('f')} />
      {!collapsed.has('f') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              <DebtRow
                label="MIN DSCR COVENANT"
                platform={f9ThisLoan?.minDscr.platform ?? preset.minDscr}
                user={activeLoan.userMinDscr}
                userEditable
                format={fmtX}
                onUserChange={v => { updateLoan(activeLoan.id, { userMinDscr: v }); patchDebt(activeLoan.id, 'minDscr', v); }}
                pass={dscrY1 != null ? dscrY1 >= effMinDscr : undefined}
                sub={dscrY1 != null ? `Y1 DSCR: ${dscrY1.toFixed(2)}×` : undefined}
              />
              <DebtRow
                label="MIN DEBT YIELD"
                platform={f9ThisLoan?.minDebtYield.platform ?? 0.07}
                user={activeLoan.userMinDY}
                userEditable
                format={fmtPctFull}
                onUserChange={v => { updateLoan(activeLoan.id, { userMinDY: v }); patchDebt(activeLoan.id, 'minDY', v); }}
                pass={debtYieldY1 != null ? debtYieldY1 >= effMinDY : undefined}
                sub={debtYieldY1 != null ? `Y1 DY: ${fmtPct(debtYieldY1 * 100)}` : undefined}
              />
              <DebtRow
                label="MIN OCCUPANCY"
                platform={f9ThisLoan?.minOccupancy.platform ?? 0.90}
                user={activeLoan.userMinOcc}
                userEditable
                format={fmtPctFull}
                onUserChange={v => { updateLoan(activeLoan.id, { userMinOcc: v }); patchDebt(activeLoan.id, 'minOcc', v); }}
              />
              <DebtRow
                label="MAX LTV"
                platform={f9ThisLoan?.maxLtv.platform ?? preset.maxLtv}
                user={activeLoan.userMaxLtv}
                userEditable
                format={fmtPctFull}
                onUserChange={v => { updateLoan(activeLoan.id, { userMaxLtv: v }); patchDebt(activeLoan.id, 'maxLtv', v); }}
                pass={effLtv != null ? effLtv <= effMaxLtv : undefined}
                sub={effLtv != null ? `Current LTV: ${fmtPct(effLtv * 100)}` : undefined}
              />
              <DebtRow
                label="CASH TRAP DSCR TRIGGER"
                platform={f9ThisLoan?.cashTrapDscr.platform ?? 1.10}
                user={activeLoan.userCashTrapDscr}
                userEditable
                format={fmtX}
                onUserChange={v => { updateLoan(activeLoan.id, { userCashTrapDscr: v }); patchDebt(activeLoan.id, 'cashTrapDscr', v); }}
                sub="Cash swept to lender reserve if DSCR falls below"
              />
            </tbody>
          </table>
        </div>
      )}
      <SectionHeader letter="G" title="RESERVES" subtitle="T&I Escrow · Replacement · Operating — flows to Sources & Uses" collapsed={collapsed.has('g')} onToggle={() => toggle('g')} />
      {!collapsed.has('g') && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead><ColHeader /></thead>
            <tbody>
              <DebtRow
                label="T&I ESCROW (months)"
                platform={f9ThisLoan?.tiEscrowMonths.platform ?? 2}
                user={activeLoan.userTIEscrow}
                userEditable
                format={v => v != null ? `${v}mo — ${fmt$(effLoanAmt * effRate / 12 * (v ?? 0))}` : '—'}
                onUserChange={v => { updateLoan(activeLoan.id, { userTIEscrow: v }); patchDebt(activeLoan.id, 'tiEscrow', v); }}
                sub="Tax & insurance upfront reserve"
              />
              <DebtRow
                label="REPLACEMENT RESERVE ($/unit/yr)"
                platform={f9ThisLoan?.replacementReserve.platform ?? 300}
                user={activeLoan.userReplReserve}
                userEditable
                format={v => v != null ? `$${v}/unit/yr` : '—'}
                onUserChange={v => { updateLoan(activeLoan.id, { userReplReserve: v }); patchDebt(activeLoan.id, 'replReserve', v); }}
              />
              <DebtRow
                label="OPERATING RESERVE (months of DS)"
                platform={f9ThisLoan?.operatingReserveMonths.platform ?? 3}
                user={activeLoan.userOpReserveMonths}
                userEditable
                format={v => v != null ? `${v}mo — ${fmt$(annualDS1 / 12 * (v ?? 0))}` : '—'}
                onUserChange={v => { updateLoan(activeLoan.id, { userOpReserveMonths: v }); patchDebt(activeLoan.id, 'opReserveMonths', v); }}
              />
            </tbody>
          </table>
        </div>
      )}
      <SectionHeader letter="H" title="REFI / PAYOFF EVENT" subtitle="Model refinance trigger — cross-links to Taxes tab" collapsed={collapsed.has('h')} onToggle={() => toggle('h')} />
      {!collapsed.has('h') && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BT.border.medium}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={refi.enabled}
                onChange={e => {
                  const v = e.target.checked;
                  setRefi(r => ({ ...r, enabled: v }));
                  patchDebt(activeLoan.id, 'refiEnabled', v ? 1 : 0);
                }}
              />
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white }}>ENABLE REFI EVENT</span>
            </label>
            {refi.enabled && (
              <>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TRIGGER:</span>
                <select
                  value={refi.triggerYear}
                  onChange={e => {
                    const yr = parseInt(e.target.value);
                    setRefi(r => ({ ...r, triggerYear: yr }));
                    patchDebt(activeLoan.id, 'refiTriggerYear', yr);
                  }}
                  style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.white, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, colorScheme: 'dark' }}
                >
                  {Array.from({ length: Math.min(effTerm, 10) }, (_, i) => i + 1).map(yr => (
                    <option key={yr} value={yr}>Y{yr}</option>
                  ))}
                </select>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>NEW LOAN TYPE:</span>
                <select
                  value={refi.newLoanType}
                  onChange={e => {
                    const lt = e.target.value as LoanPresetKey;
                    setRefi(r => ({ ...r, newLoanType: lt }));
                    patchDebtStr(activeLoan.id, 'refiNewLoanType', lt);
                  }}
                  style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.white, fontFamily: MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, colorScheme: 'dark' }}
                >
                  {(Object.keys(LOAN_PRESETS) as LoanPresetKey[]).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </>
            )}
          </div>

          {refi.enabled && refiPayoff && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${BT.border.subtle}` }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>BALLOON PAYOFF</div>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.red }}>{fmt$(refiPayoff.balloon)}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>PREPAY PENALTY</div>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber }}>{fmt$(refiPayoff.prepay)}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>EXIT FEE</div>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber }}>{fmt$(refiPayoff.exitFee)}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>TOTAL PAYOFF</div>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.white }}>{fmt$(refiPayoff.total)}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>NEW LOAN ({refi.newLoanType})</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>{fmtPctFull(refiPreset.rate)} fixed · {refiPreset.term}yr term</div>
              </div>
              {/* Cross-link to Taxes tab */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onTabChange?.(4)}
                onKeyDown={e => { if (e.key === 'Enter') onTabChange?.(4); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#065f4630', border: `1px solid #10b981`, borderRadius: 4, cursor: onTabChange ? 'pointer' : 'default', alignSelf: 'center' }}
                title="Click to open Taxes tab — refi doc stamps"
              >
                <Link style={{ width: 10, height: 10, color: '#10b981' }} />
                <span style={{ fontFamily: MONO, fontSize: 8, color: '#10b981', fontWeight: 700 }}>
                  → TAXES TAB — Refi doc stamps {refiDocStamps != null ? fmt$(refiDocStamps) : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {loans.length > 1 && (
        <>
          <SectionHeader letter="Σ" title="AGGREGATED STACK" subtitle="Total DS · Blended rate · Combined LTC" collapsed={collapsed.has('agg')} onToggle={() => toggle('agg')} />
          {!collapsed.has('agg') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderBottom: `1px solid ${BT.border.medium}` }}>
              {loans.map(l => {
                const lf = f9Debt?.loans?.find(x => x.id === l.id);
                const lp = LOAN_PRESETS[l.loanTypeLabel];
                const la = l.userLoanAmount ?? lf?.loanAmount.platform ?? baseLoanAmt;
                const lr = l.rateType === 'Floating'
                  ? ((l.userSofr ?? lf?.sofr.platform ?? l.sofrCurve[0]) + (l.userSpread ?? lf?.spread.platform ?? lp.spread))
                  : (l.userRate ?? lf?.interestRate.platform ?? lp.rate);
                const lds = la * lr;
                return (
                  <div key={l.id} style={{ flex: 1, minWidth: 140, padding: '8px 14px', borderRight: `1px solid ${BT.border.subtle}` }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>{l.name.toUpperCase()}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.cyan }}>{fmt$(la)}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>{fmtPctFull(lr)}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.red }}>DS: {fmt$(lds)}</div>
                  </div>
                );
              })}
              <div style={{ flex: 1, minWidth: 140, padding: '8px 14px', background: `${BT.text.purple}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.purple, marginBottom: 4 }}>COMBINED STACK</div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.white }}>{fmt$(aggTotalLoan)}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
                  BLENDED {fmtPctFull(
                    loans.reduce((s, l) => {
                      const lf = f9Debt?.loans?.find(x => x.id === l.id);
                      const lp = LOAN_PRESETS[l.loanTypeLabel];
                      const la = l.userLoanAmount ?? lf?.loanAmount.platform ?? baseLoanAmt;
                      const lr = l.rateType === 'Floating'
                        ? ((l.userSofr ?? lf?.sofr.platform ?? l.sofrCurve[0]) + (l.userSpread ?? lf?.spread.platform ?? lp.spread))
                        : (l.userRate ?? lf?.interestRate.platform ?? lp.rate);
                      return s + la * lr;
                    }, 0) / (aggTotalLoan || 1)
                  )}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: ltvColor(purchasePrice ? aggTotalLoan / purchasePrice : null) }}>
                  LTC: {purchasePrice ? fmtPct((aggTotalLoan / purchasePrice) * 100) : '—'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ padding: '5px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>
          ANNUAL DEBT SERVICE — {activeLoan.name.toUpperCase()} · {annualRows.filter(r => r.covenantBreach).length > 0 && <span style={{ color: BT.text.red }}>⚠ {annualRows.filter(r => r.covenantBreach).length} COVENANT BREACH{annualRows.filter(r => r.covenantBreach).length > 1 ? 'ES' : ''}</span>}
        </span>
        <button onClick={() => setShowAnnual(!showAnnual)} style={{ background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted, fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2 }}>
          {showAnnual ? 'HIDE' : 'SHOW'}
        </button>
      </div>
      {showAnnual && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                {['YR', 'OPEN BAL', 'INTEREST', 'PRINCIPAL', 'DEBT SVC', 'CLOSE BAL', 'NOI', 'DSCR', 'DY', 'COVENANT'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'YR' || h === 'COVENANT' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annualRows.filter(r => r.year <= holdYears).map((row, i) => (
                <tr key={row.year} style={{ background: row.covenantBreach ? `${BT.text.red}10` : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${row.covenantBreach ? BT.text.red : BT.border.subtle}` }}>
                  <td style={{ padding: '3px 8px', color: BT.text.secondary }}>Y{row.year}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.openBalance)}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.annualInterest)}</td>
                  <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.annualPrincipal)}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.red, textAlign: 'right', fontWeight: 700 }}>{fmt$(row.annualDS)}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.closeBalance)}</td>
                  <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.noi)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: dscrColor(row.dscr), fontWeight: 700 }}>{row.dscr != null ? `${row.dscr.toFixed(2)}×` : '—'}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.amber }}>{row.debtYield != null ? fmtPct(row.debtYield * 100) : '—'}</td>
                  <td style={{ padding: '3px 8px' }}>
                    {row.covenantBreach
                      ? <span style={{ color: BT.text.red, fontWeight: 700 }}>✗ BREACH</span>
                      : <span style={{ color: BT.met.financial }}>✓ OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionHeader letter="M" title="MONTHLY AMORTIZATION" subtitle={`${amortRows.length} rows — IO highlighted amber · covenant breach highlighted red`} collapsed={collapsed.has('amort')} onToggle={() => toggle('amort')} />
      {!collapsed.has('amort') && (
        <div style={{ overflowX: 'auto', maxHeight: 400 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header, zIndex: 2 }}>
                {['MO', 'BEG BAL', 'RATE', 'PAYMENT', 'INTEREST', 'PRINCIPAL', 'END BAL', 'DSCR', 'DY (ANN)', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'MO' || h === 'STATUS' ? 'left' : 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amortRows.map((row, i) => {
                const isTransition = i > 0 && row.isIO !== amortRows[i - 1].isIO;
                const rateChanged = i > 0 && Math.abs(row.periodRate - amortRows[i - 1].periodRate) > 0.0001;
                const rowBg = row.covenantBreach
                  ? `${BT.text.red}18`
                  : isTransition ? `${BT.text.amber}15`
                  : row.isIO ? `${BT.text.amber}08`
                  : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt;
                const rowBorder = row.covenantBreach
                  ? `1px solid ${BT.text.red}40`
                  : isTransition ? `2px solid ${BT.text.amber}`
                  : `1px solid ${BT.border.subtle}`;
                return (
                  <tr key={row.month} style={{ background: rowBg, borderBottom: rowBorder }}>
                    <td style={{ padding: '2px 8px', color: BT.text.muted }}>{row.month}</td>
                    <td style={{ padding: '2px 8px', color: BT.text.secondary, textAlign: 'right' }}>{fmt$(row.begBalance)}</td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: rateChanged ? BT.text.amber : BT.text.secondary }}>{fmtPctFull(row.periodRate)}</td>
                    <td style={{ padding: '2px 8px', color: BT.text.primary, textAlign: 'right' }}>{fmt$(row.payment)}</td>
                    <td style={{ padding: '2px 8px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.interest)}</td>
                    <td style={{ padding: '2px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.principal)}</td>
                    <td style={{ padding: '2px 8px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.endBalance)}</td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: row.covenantBreach ? BT.text.red : dscrColor(row.dscr), fontWeight: row.covenantBreach ? 700 : 400 }}>
                      {row.dscr != null ? `${row.dscr.toFixed(2)}×` : '—'}
                    </td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: BT.text.amber }}>
                      {row.debtYield != null ? fmtPct(row.debtYield * 100) : '—'}
                    </td>
                    <td style={{ padding: '2px 8px' }}>
                      {row.covenantBreach
                        ? <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red, fontWeight: 700 }}>✗ BREACH</span>
                        : row.isIO
                          ? <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, border: `1px solid ${BT.text.amber}40`, padding: '0 4px', borderRadius: 2 }}>IO</span>
                          : <span style={{ fontFamily: MONO, fontSize: 8, color: BT.met.financial }}>AMORT</span>}
                      {isTransition && !row.covenantBreach && <span style={{ marginLeft: 6, fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>← IO END</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </>)}

    </div>
  );
}

export default DebtTab;
