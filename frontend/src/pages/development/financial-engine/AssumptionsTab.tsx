import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Lock, Download, AlertTriangle, TrendingUp, Building2,
  DollarSign, BarChart3, ChevronRight, Zap, Check, X,
} from 'lucide-react';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Local API types (matching backend DealFinancials) ────────────────────────
interface OSRow { field: string; label: string; broker: number|null; platform: number|null; t12: number|null; resolved: number|null; perUnit: number|null; source: string|null; confidence: number|null; benchmarkPosition: string|null; }
interface TrafficYear { year: number; vacancyPct: number|null; occupancyPct: number|null; effRent: number|null; rentGrowthPct: number|null; t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; }
interface DealFinancials {
  dealId: string; dealName: string; totalUnits: number;
  proforma: { year1: OSRow[]; integrityChecks: unknown[]; unitEconomics: Record<string,number|null> };
  capitalStack: { purchasePrice: number|null; loanAmount: number|null; equityAtClose: number|null; ltcPct: number|null; interestRate: number|null; ioPeriodMonths: number|null; amortizationYears: number|null; dscrMin: number|null; originationFeePct: number|null; pricePerUnit: number|null };
  rentRollSummary: { avgInPlaceRent: number|null; weightedOccupancyPct: number|null } | null;
  trafficProjection: { yearly: TrafficYear[]; leaseUp: { weeksTo90: number|null; weeksTo93: number|null; weeksTo95: number|null }|null; calibrated: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null }; leasingSignals: { t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null; confidence: number|null }|null } | null;
  assumptions: { holdYears: number; exitCap: number|null; rentGrowthYr1: number|null; rentGrowthStabilized: number|null; perYear: Array<{ year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null }> };
  meta: { seeded: boolean; updatedAt: string|null };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";

type CellType = 'normal'|'ai'|'override'|'m07'|'locked'|'flagged'|'computed'|'warn'|'good';

const CELL_COLORS: Record<CellType, string> = {
  normal:   'text-slate-300',
  ai:       'text-cyan-400',
  override: 'text-blue-400',
  m07:      'text-purple-400',
  locked:   'text-slate-500',
  flagged:  'text-amber-400',
  computed: 'text-slate-100 font-bold',
  warn:     'text-amber-400',
  good:     'text-green-400',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtM   = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
const fmtK   = (n: number) => '$' + Math.round(n / 1000).toLocaleString() + 'K';
const fmtPct = (n: number, dec = 1) => (n * 100).toFixed(dec) + '%';
const fmtWk  = (n: number) => Math.round(n).toLocaleString() + '/wk';
const fmtOcc = (n: number) => (n * 100).toFixed(1) + '%';

function cagrStr(first: number|null, last: number|null, years: number): string {
  if (first == null || last == null || first === 0 || years < 2) return '—';
  return ((Math.pow(last / first, 1 / (years - 1)) - 1) * 100).toFixed(1) + '%';
}
function avgStr(vals: (number|null)[], scale = 1, dec = 1): string {
  const v = vals.filter((x): x is number => x != null);
  if (!v.length) return '—';
  return (v.reduce((a, b) => a + b, 0) / v.length * scale).toFixed(dec) + '%';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function y1Row(f: DealFinancials, field: string): OSRow|null {
  return f.proforma.year1.find(r => r.field === field) ?? null;
}
function tYr(f: DealFinancials, yr: number): TrafficYear|undefined {
  return f.trafficProjection?.yearly.find(r => r.year === yr);
}
function pYr(f: DealFinancials, yr: number) {
  return f.assumptions.perYear.find(p => p.year === yr);
}
function compoundGrowth(f: DealFinancials, yr: number): number {
  if (yr <= 1) return 1;
  let m = 1;
  for (let y = 1; y < yr; y++) {
    const g = pYr(f, y)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03;
    m *= 1 + (g ?? 0.03);
  }
  return m;
}

// ─── Override state type ──────────────────────────────────────────────────────
type Overrides = Record<string, Record<number, number|null>>;
function getOverride(ov: Overrides, key: string, yr: number): number|null {
  return ov[key]?.[yr] ?? null;
}
function setOverride(ov: Overrides, key: string, yr: number, val: number|null): Overrides {
  return { ...ov, [key]: { ...ov[key], [yr]: val } };
}

// ─── Grid cell ────────────────────────────────────────────────────────────────
interface CellData { display: string; type: CellType; rawValue?: number|null; patchField?: string; editable?: boolean; tooltip?: string }

function GridCell({
  data, onClick,
}: { data: CellData; onClick?: () => void }) {
  return (
    <td
      onClick={data.editable ? onClick : undefined}
      className={`px-2 py-1 text-right text-[10px] border-r border-[#1e1e1e] tabular-nums relative select-none
        ${CELL_COLORS[data.type]}
        ${data.editable ? 'cursor-pointer hover:bg-[#1a1a1a]' : ''}
        ${data.type === 'locked' ? 'bg-[#0d0d0d]' : ''}
      `}
      title={data.tooltip}
      style={{ fontFamily: MONO, minWidth: 80 }}
    >
      {data.type === 'locked' && <Lock className="absolute top-[3px] left-[3px] w-2 h-2 text-slate-700" />}
      {data.type === 'm07' && <sup className="absolute top-[2px] right-[3px] text-[6px] text-purple-500 font-bold">M07</sup>}
      {data.type === 'ai' && <sup className="absolute top-[2px] right-[3px] text-[6px] text-cyan-600 font-bold">AI</sup>}
      {data.type === 'override' && <sup className="absolute top-[2px] left-[3px] text-[6px] text-blue-500 font-bold">U</sup>}
      {data.type === 'flagged' && <AlertTriangle className="absolute top-[3px] left-[3px] w-2 h-2 text-amber-500" />}
      {data.display}
    </td>
  );
}

// ─── Inline cell editor popover ───────────────────────────────────────────────
function CellEditor({
  label, year, unit, currentValue, onApply, onClear, onCancel, anchorRef,
}: {
  label: string; year: number; unit: string;
  currentValue: number|null;
  onApply: (val: number) => void;
  onClear: () => void;
  onCancel: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}) {
  const [draft, setDraft] = useState(
    currentValue != null
      ? (unit === '%' ? (currentValue * 100).toFixed(2) : String(Math.round(currentValue)))
      : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onApply(unit === '%' ? n / 100 : n);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      background: '#0d0d0d', border: '1px solid #334155',
      borderRadius: 4, padding: '10px 12px', width: 220,
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)', fontFamily: MONO,
    }}>
      <div style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>
        {label} · YR {year}
        {currentValue != null && (
          <span style={{ marginLeft: 6, color: '#334155' }}>
            now: {unit === '%' ? fmtPct(currentValue) : '$' + Math.round(currentValue).toLocaleString()}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
          style={{
            flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 700,
            color: '#3b82f6', background: '#0f172a',
            border: '1px solid #3b82f6', borderRadius: 2,
            padding: '4px 8px', outline: 'none',
          }}
          placeholder={unit === '%' ? 'e.g. 6.5' : 'value'}
        />
        <span style={{ fontSize: 9, color: '#475569' }}>{unit}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {currentValue != null && (
          <button onClick={onClear}
            style={{ fontFamily: MONO, fontSize: 9, padding: '4px 8px', borderRadius: 2, background: 'none', border: '1px solid #1e293b', color: '#475569', cursor: 'pointer' }}>
            CLEAR
          </button>
        )}
        <button onClick={commit}
          style={{ flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '4px 0', borderRadius: 2, background: '#3b82f6', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Check style={{ width: 10, height: 10 }} /> APPLY
        </button>
        <button onClick={onCancel}
          style={{ fontFamily: MONO, fontSize: 9, padding: '4px 8px', borderRadius: 2, background: 'none', border: '1px solid #1e293b', color: '#475569', cursor: 'pointer' }}>
          <X style={{ width: 10, height: 10 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, cols }: { label: string; cols: number }) {
  return (
    <tr className="bg-[#181818] border-y border-[#1e1e1e]">
      <td colSpan={cols} className="px-3 py-1 text-[11px] font-bold text-slate-300 sticky left-0">{label}</td>
    </tr>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────
function GridRow({ label, locked, isM07, cells, cagrCell, onCellClick }: {
  label: string; locked?: boolean; isM07?: boolean;
  cells: CellData[];
  cagrCell: CellData;
  onCellClick?: (yr: number) => void;
}) {
  const rowBg = isM07 ? 'bg-[#1a0a2e]/50 border-purple-900/30' : 'border-[#1e1e1e]/50';
  const labelColor = isM07 ? 'text-purple-400 bg-[#1a0a2e]' : 'text-slate-400 bg-[#0a0a0a]';

  return (
    <tr className={`border-b ${rowBg} hover:brightness-110 h-[22px]`}>
      <td className={`px-3 py-1 text-[11px] sticky left-0 border-r border-[#1e1e1e] z-10 min-w-[220px] ${labelColor}`}>
        <span className="flex items-center gap-1.5">
          {locked && !isM07 && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
          {isM07 && <span className="text-[7px] border border-purple-500/50 rounded px-1 text-purple-500 shrink-0">M07</span>}
          {label}
        </span>
      </td>
      {cells.map((cell, i) => (
        <GridCell key={i} data={cell} onClick={() => onCellClick?.(i + 1)} />
      ))}
      <GridCell data={cagrCell} />
    </tr>
  );
}

// ─── Build overview grid data ─────────────────────────────────────────────────
interface OverviewRows {
  // section 1
  totalUnits: CellData[];
  avgUnitSF: CellData[];
  avgRent: CellData[];
  rentGrowth: CellData[];
  // section 2
  vacancyRate: CellData[];
  m07Vacancy: CellData[];
  lossToLease: CellData[];
  concessions: CellData[];
  otherIncome: CellData[];
  // section 3
  opexGrowth: CellData[];
  mgmtFee: CellData[];
  reTaxGrowth: CellData[];
  insuranceGrowth: CellData[];
  reserves: CellData[];
  // section 4
  noi: CellData[];
  projectedValue: CellData[];
  // section 5
  m07Tours: CellData[];
  m07Occupancy: CellData[];
}

function buildGrid(
  years: number[],
  f: DealFinancials|null,
  ov: Overrides,
  acf: Array<{year:number;noi:number;gpr:number}>,
  exitCap: number,
  avgUnitSF: number,
): OverviewRows {
  const N = years.length;

  function forYears(fn: (yr: number) => CellData): CellData[] {
    return years.map(yr => fn(yr));
  }

  // ── Section 1 ──
  const totalUnits = forYears(_yr => ({
    display: f ? String(f.totalUnits) : '—',
    type: 'locked' as CellType, editable: false,
  }));

  const avgUnitSFCells = forYears(_yr => ({
    display: avgUnitSF ? String(avgUnitSF) : '—',
    type: 'locked' as CellType, editable: false,
  }));

  const avgRent = forYears(yr => {
    const userVal = getOverride(ov, 'avgRent', yr);
    if (userVal != null) return { display: '$' + Math.round(userVal).toLocaleString(), type: 'override' as CellType, rawValue: userVal, patchField: 'rentPerUnit', editable: true };
    // M07 effRent is primary platform signal
    const t = f ? tYr(f, yr) : null;
    if (t?.effRent != null) return { display: '$' + Math.round(t.effRent).toLocaleString(), type: 'ai' as CellType, rawValue: t.effRent, patchField: 'rentPerUnit', editable: true, tooltip: 'M07 Traffic Engine effective rent trajectory' };
    // Fallback: compound from rent roll
    if (f) {
      const base = f.rentRollSummary?.avgInPlaceRent ?? (y1Row(f, 'gpr')?.broker != null ? y1Row(f, 'gpr')!.broker! / f.totalUnits / 12 : null);
      if (base != null) {
        const val = Math.round(base * compoundGrowth(f, yr));
        return { display: '$' + val.toLocaleString(), type: 'normal' as CellType, rawValue: val, patchField: 'rentPerUnit', editable: true };
      }
    }
    return { display: '—', type: 'locked' as CellType };
  });

  const rentGrowth = forYears(yr => {
    const userVal = getOverride(ov, 'rentGrowth', yr);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, patchField: 'rentGrowthPct', editable: true };
    const t = f ? tYr(f, yr) : null;
    if (t?.rentGrowthPct != null) return { display: fmtPct(t.rentGrowthPct), type: 'ai' as CellType, rawValue: t.rentGrowthPct, patchField: 'rentGrowthPct', editable: true };
    const g = f ? (pYr(f, yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03) : 0.03;
    return { display: fmtPct(g), type: 'normal' as CellType, rawValue: g, patchField: 'rentGrowthPct', editable: true };
  });

  // ── Section 2 ──
  const vacancyRate = forYears(yr => {
    const userVal = getOverride(ov, 'vacancyRate', yr);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, patchField: 'vacancyPct', editable: true };
    const val = f ? (pYr(f, yr)?.vacancyPct ?? 0.06) : 0.06;
    const m07val = f ? tYr(f, yr)?.vacancyPct : null;
    const diverge = m07val != null && Math.abs(val - m07val) > 0.02;
    return { display: fmtPct(val), type: diverge ? 'flagged' as CellType : 'normal' as CellType, rawValue: val, patchField: 'vacancyPct', editable: true, tooltip: diverge ? `M07 implies ${fmtPct(m07val!)} — divergence > 2pp` : undefined };
  });

  const m07Vacancy = forYears(yr => {
    const t = f ? tYr(f, yr) : null;
    const val = t?.vacancyPct != null ? t.vacancyPct : (t?.occupancyPct != null ? 1 - t.occupancyPct : null);
    return { display: val != null ? fmtPct(val) : '—', type: 'm07' as CellType, rawValue: val, editable: false };
  });

  const lossToLease = forYears(yr => {
    const userVal = getOverride(ov, 'lossToLease', yr);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, patchField: 'lossToLeasePct', editable: true };
    const base = f ? (y1Row(f, 'lossToLease')?.resolved ?? y1Row(f, 'lossToLease')?.broker ?? 0.022) : 0.022;
    const val = Math.max(0, base * Math.pow(0.985, yr - 1)); // narrows ~1.5%/yr
    return { display: fmtPct(val), type: 'normal' as CellType, rawValue: val, patchField: 'lossToLeasePct', editable: true };
  });

  const concessions = forYears(yr => {
    const userVal = getOverride(ov, 'concessions', yr);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, patchField: 'concessionsPct', editable: true };
    const base = f ? (y1Row(f, 'concessions')?.resolved ?? y1Row(f, 'concessions')?.broker ?? 0.009) : 0.009;
    const val = Math.max(0.002, base * Math.pow(0.88, yr - 1));
    return { display: fmtPct(val), type: 'normal' as CellType, rawValue: val, patchField: 'concessionsPct', editable: true };
  });

  const otherIncome = forYears(yr => {
    const userVal = getOverride(ov, 'otherIncome', yr);
    if (userVal != null) return { display: '$' + Math.round(userVal), type: 'override' as CellType, rawValue: userVal, patchField: 'otherIncomePerUnit', editable: true };
    const base = f ? (y1Row(f, 'otherIncome')?.perUnit ?? 65) : 65;
    const val = Math.round(base * Math.pow(1.028, yr - 1));
    return { display: '$' + val, type: 'normal' as CellType, rawValue: val, patchField: 'otherIncomePerUnit', editable: true };
  });

  // ── Section 3 ──
  const opexGrowthVals = [2.5, 2.5, 2.6, 2.7, 2.7, 2.8, 2.8, 2.9, 3.0, 3.0];
  const opexGrowth = forYears(yr => {
    const userVal = getOverride(ov, 'opexGrowth', yr);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, editable: true };
    const val = opexGrowthVals[yr - 1] ?? 3.0;
    return { display: val.toFixed(1) + '%', type: 'normal' as CellType, rawValue: val / 100, editable: true };
  });

  const mgmtFee = forYears(_yr => {
    const userVal = getOverride(ov, 'mgmtFee', 1);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, editable: true };
    const base = f ? (y1Row(f, 'managementFee')?.resolved ?? 0.032) : 0.032;
    return { display: fmtPct(base < 1 ? base : base / 100), type: 'normal' as CellType, rawValue: base, editable: true };
  });

  const reTaxGrowth = forYears(_yr => ({ display: '4.0%', type: 'locked' as CellType, editable: false }));

  const insuranceGrowth = forYears(_yr => {
    const userVal = getOverride(ov, 'insuranceGrowth', 1);
    if (userVal != null) return { display: fmtPct(userVal), type: 'override' as CellType, rawValue: userVal, editable: true };
    return { display: '3.5%', type: 'normal' as CellType, rawValue: 0.035, editable: true };
  });

  const reserves = forYears(_yr => ({ display: '$250', type: 'locked' as CellType, editable: false }));

  // ── Section 4 ──
  const noiVals = forYears(yr => {
    const row = acf.find(r => r.year === yr);
    if (row?.noi) return { display: fmtM(row.noi), type: 'locked' as CellType, rawValue: row.noi, editable: false };
    // estimate if no model results
    const baseNoi = acf[0]?.noi;
    if (baseNoi) return { display: fmtM(Math.round(baseNoi * Math.pow(1.034, yr - 1))), type: 'locked' as CellType, editable: false };
    return { display: '—', type: 'locked' as CellType, editable: false };
  });

  const projectedValue = forYears(yr => {
    const noiRow = acf.find(r => r.year === yr);
    const noi = noiRow?.noi;
    const cap = exitCap > 0 ? exitCap : 0.055;
    if (noi) {
      const val = Math.round((noi / cap) * 0.98); // 2% selling costs
      return { display: fmtM(val), type: 'locked' as CellType, rawValue: val, editable: false, tooltip: `NOI ${fmtM(noi)} ÷ ${(cap*100).toFixed(1)}% cap × 98%` };
    }
    // fallback: purchase × appreciation
    const pp = f?.capitalStack.purchasePrice;
    if (pp) return { display: fmtM(Math.round(pp * Math.pow(1.024, yr - 1))), type: 'locked' as CellType, editable: false };
    return { display: '—', type: 'locked' as CellType, editable: false };
  });

  // ── Section 5 ──
  const m07Tours = forYears(yr => {
    const t = f ? tYr(f, yr) : null;
    if (t?.t01WeeklyTours != null) return { display: Math.round(t.t01WeeklyTours).toLocaleString() + '/wk', type: 'm07' as CellType, rawValue: t.t01WeeklyTours, editable: false };
    return { display: '—', type: 'locked' as CellType, editable: false };
  });

  const m07Occupancy = forYears(yr => {
    const t = f ? tYr(f, yr) : null;
    const occ = t?.occupancyPct != null ? t.occupancyPct : (t?.vacancyPct != null ? 1 - t.vacancyPct : null);
    if (occ != null) return { display: fmtOcc(occ), type: 'm07' as CellType, rawValue: occ, editable: false };
    return { display: '—', type: 'locked' as CellType, editable: false };
  });

  return {
    totalUnits, avgUnitSF: avgUnitSFCells, avgRent, rentGrowth,
    vacancyRate, m07Vacancy, lossToLease, concessions, otherIncome,
    opexGrowth, mgmtFee, reTaxGrowth, insuranceGrowth, reserves,
    noi: noiVals, projectedValue,
    m07Tours, m07Occupancy,
  };
}

// ─── CAGR / total cells ───────────────────────────────────────────────────────
function cagrCell(cells: CellData[], type: CellType = 'computed'): CellData {
  const vals = cells.map(c => c.rawValue ?? null);
  const first = vals.find(v => v != null) ?? null;
  const last = [...vals].reverse().find(v => v != null) ?? null;
  return { display: cagrStr(first, last, cells.length), type };
}
function avgCell(cells: CellData[], type: CellType = 'computed', dec = 1): CellData {
  const vals = cells.map(c => c.rawValue ?? null).filter((v): v is number => v != null);
  if (!vals.length) return { display: '—', type };
  return { display: (vals.reduce((a, b) => a + b, 0) / vals.length * 100).toFixed(dec) + '%', type };
}
function fixedCell(display: string, type: CellType = 'computed'): CellData {
  return { display, type };
}

// ─── Debt schedule ────────────────────────────────────────────────────────────
interface DebtYear { yr: number; begBalance: number; interest: number; principal: number; annualPayment: number; endBalance: number; noi: number; dscr: number; ltv: number }
function buildDebt(loan: number, rate: number, amortYrs: number, ioYrs: number, holdYrs: number, noi1: number, noig: number, pp: number): DebtYear[] {
  const rows: DebtYear[] = [];
  let bal = loan;
  const i12 = rate / 12, n = amortYrs * 12;
  const mc = (amortYrs > 0 && i12 > 0) ? (i12 * Math.pow(1 + i12, n)) / (Math.pow(1 + i12, n) - 1) * 12 : rate;
  for (let yr = 1; yr <= holdYrs; yr++) {
    const noi = Math.round(noi1 * Math.pow(1 + noig, yr - 1));
    const isIO = yr <= ioYrs;
    const interest = Math.round(bal * rate);
    const payment = isIO ? interest : Math.round(bal * mc);
    const principal = isIO ? 0 : Math.max(0, payment - interest);
    const endBal = Math.round(bal - principal);
    rows.push({ yr, begBalance: Math.round(bal), interest, principal, annualPayment: payment, endBalance: endBal, noi, dscr: payment > 0 ? noi / payment : 0, ltv: pp > 0 ? endBal / (pp * Math.pow(1.024, yr - 1)) : 0 });
    bal = endBal;
  }
  return rows;
}

function DebtPage({ holdYears, f, noi1, noiGrowth }: { holdYears: number; f: DealFinancials|null; noi1: number; noiGrowth: number }) {
  const cs = f?.capitalStack;
  const loan  = cs?.loanAmount ?? 0;
  const rate  = cs?.interestRate ?? 0.0675;
  const amort = cs?.amortizationYears ?? 30;
  const ioYrs = cs?.ioPeriodMonths != null ? Math.round(cs.ioPeriodMonths / 12) : 2;
  const origFee = cs?.originationFeePct ?? 0.01;
  const pp    = cs?.purchasePrice ?? 0;
  const units = f?.totalUnits ?? 1;
  const i12 = rate / 12, n30 = amort * 12;
  const mc = (amort > 0 && i12 > 0) ? (i12 * Math.pow(1 + i12, n30)) / (Math.pow(1 + i12, n30) - 1) * 12 : rate;
  const maxDscr = mc > 0 ? Math.round((noi1 / 1.25) / mc) : 0;
  const maxLtv  = pp > 0 ? Math.round(pp * 0.65) : 0;
  const binding = Math.min(maxDscr || Infinity, maxLtv || Infinity);
  const sched   = loan > 0 && rate > 0 ? buildDebt(loan, rate, amort, ioYrs, holdYears, noi1, noiGrowth, pp) : [];
  const cols    = holdYears + 2;

  if (!loan) return <div className="flex items-center justify-center h-32 text-[11px] text-slate-500" style={{ fontFamily: MONO }}>No loan configured</div>;

  const dscrType = (d: number): CellType => d >= 1.40 ? 'good' : d >= 1.25 ? 'normal' : d >= 1.15 ? 'warn' : 'flagged';

  return (
    <div className="flex flex-col overflow-auto">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'LOAN AMOUNT', value: fmtM(loan), sub: '$' + Math.round(loan/units).toLocaleString() + ' / unit' },
          { label: 'INTEREST RATE', value: (rate*100).toFixed(2) + '%', sub: 'Annual fixed rate' },
          { label: 'STRUCTURE', value: `${ioYrs}YR I/O → ${amort}YR`, sub: 'Senior fixed-rate' },
          { label: 'ORIGINATION FEE', value: (origFee*100).toFixed(2) + '%', sub: '$' + Math.round(loan*origFee).toLocaleString() + ' at close' },
          { label: 'LTC', value: pp > 0 ? fmtPct(loan/pp) : '—', sub: `Purchase: ${fmtM(pp)}` },
          { label: 'MAX LOAN (DSCR)', value: fmtM(maxDscr), sub: '@1.25× min DSCR' },
          { label: 'SIZING CONSTRAINT', value: binding < Infinity ? fmtM(binding) : '—', sub: binding === maxDscr ? '↓ DSCR binding' : '↓ LTV binding' },
          { label: 'DEBT CONSTANT', value: fmtPct(mc, 3), sub: 'Ann. payment ÷ balance' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-bold text-slate-100" style={{ fontFamily: MONO }}>{value}</span>
            <span className="text-[9px] text-slate-600" style={{ fontFamily: MONO }}>{sub}</span>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">DEBT SERVICE SCHEDULE</th>
            {sched.map(r => <th key={r.yr} className={`px-2 py-1.5 text-right text-[10px] font-bold min-w-[84px] border-r border-[#1e1e1e] ${r.yr <= ioYrs ? 'text-amber-500/70' : 'text-slate-500'}`}>YR {r.yr}{r.yr <= ioYrs ? ' ·IO' : ''}</th>)}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / AVG</th>
          </tr>
        </thead>
        <tbody>
          {([
            { label: 'A. BEGINNING BALANCE', isHeader: true },
            { label: 'Outstanding Principal', vals: sched.map(r => ({ v: fmtM(r.begBalance), t: 'normal' as CellType })), sum: '—' },
            { label: 'B. DEBT SERVICE', isHeader: true },
            { label: 'Interest Payment', vals: sched.map(r => ({ v: fmtM(r.interest), t: (r.yr <= ioYrs ? 'warn' : 'normal') as CellType })), sum: fmtM(sched.reduce((s,r)=>s+r.interest,0)), lock: true },
            { label: 'Principal Payment', vals: sched.map(r => ({ v: r.principal===0?'—':fmtM(r.principal), t: (r.principal===0?'locked':'normal') as CellType })), sum: fmtM(sched.reduce((s,r)=>s+r.principal,0)), lock: true },
            { label: 'Total Debt Service', vals: sched.map(r => ({ v: fmtM(r.annualPayment), t: 'computed' as CellType })), sum: fmtM(sched.reduce((s,r)=>s+r.annualPayment,0)) },
            { label: 'C. NOI vs DEBT SERVICE', isHeader: true },
            { label: 'Net Operating Income', vals: sched.map(r => ({ v: fmtM(r.noi), t: 'locked' as CellType })), sum: fmtM(sched.reduce((s,r)=>s+r.noi,0)), lock: true },
            { label: 'DSCR', vals: sched.map(r => ({ v: fmtX(r.dscr), t: dscrType(r.dscr) })), sum: fmtX(sched.length ? sched.reduce((s,r)=>s+r.dscr,0)/sched.length : 0) },
            { label: 'NOI ÷ DS Gap', vals: sched.map(r => { const g=r.noi-r.annualPayment; return { v: (g>0?'+':'')+fmtK(g), t: (g>0?'good':'warn') as CellType }; }), sum: '—' },
            { label: 'D. LOAN BALANCE & LTV', isHeader: true },
            { label: 'Ending Balance', vals: sched.map(r => ({ v: fmtM(r.endBalance), t: 'normal' as CellType })), sum: fmtM(sched[sched.length-1]?.endBalance??0) },
            { label: 'LTV at Year-End', vals: sched.map(r => ({ v: fmtPct(r.ltv), t: (r.ltv>0.75?'warn':r.ltv>0.65?'normal':'good') as CellType })), sum: fmtPct(sched[sched.length-1]?.ltv??0) },
          ].map((r, i) => r.isHeader
            ? <SectionHeader key={i} label={r.label} cols={cols} />
            : <tr key={i} className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
                <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                  <span className="flex items-center gap-1">{r.lock && <Lock className="w-2.5 h-2.5 text-slate-600"/>}{r.label}</span>
                </td>
                {(r.vals||[]).map((c, ci) => <td key={ci} className={`px-2 py-1 text-right text-[10px] border-r border-[#1e1e1e] tabular-nums ${CELL_COLORS[c.t]}`} style={{ fontFamily: MONO }}>{c.v}</td>)}
                <td className={`px-2 py-1 text-right text-[10px] tabular-nums ${CELL_COLORS['computed']}`} style={{ fontFamily: MONO }}>{r.sum}</td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tax page ─────────────────────────────────────────────────────────────────
interface TaxYear { yr: number; av: number; tax: number; pu: number; asEgiPct: number }
function buildTax(currentTax: number, pp: number, millage: number, egi1: number, units: number, holdYrs: number): TaxYear[] {
  const AR = 0.40;
  const baseAV = Math.round(pp * AR);
  const reassessed = Math.round(baseAV * millage / 1000);
  const yr1Tax = Math.max(currentTax, reassessed);
  return Array.from({ length: holdYrs }, (_, i) => {
    const yr = i + 1;
    const tax = Math.round(yr1Tax * Math.pow(1.04, yr - 1));
    return { yr, av: Math.round(baseAV * Math.pow(1.04, yr - 1)), tax, pu: units ? Math.round(tax/units) : 0, asEgiPct: egi1 ? tax / Math.round(egi1 * Math.pow(1.033, yr - 1)) : 0 };
  });
}

function TaxesPage({ holdYears, f, egi1 }: { holdYears: number; f: DealFinancials|null; egi1: number }) {
  const pp = f?.capitalStack.purchasePrice ?? 0;
  const units = f?.totalUnits ?? 1;
  const currentTax = pp * 0.40 * 14.19 / 1000; // fallback estimate
  const AR = 0.40;
  const millage = 14.19;
  const sched = pp > 0 ? buildTax(currentTax, pp, millage, egi1, units, holdYears) : [];
  const reassessed = Math.round(pp * AR * millage / 1000);
  const delta = Math.round(reassessed - currentTax);
  const cols = holdYears + 2;

  if (!pp) return <div className="flex items-center justify-center h-32 text-[11px] text-slate-500" style={{ fontFamily: MONO }}>Purchase price not set — tax schedule unavailable</div>;

  return (
    <div className="flex flex-col overflow-auto">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'EST. CURRENT TAX', value: '$' + Math.round(currentTax).toLocaleString(), sub: '$' + Math.round(currentTax/units).toLocaleString() + ' / unit / yr' },
          { label: 'ASSESSED VALUE', value: fmtM(Math.round(pp * AR)), sub: `${(AR*100).toFixed(0)}% of market` },
          { label: 'MILLAGE RATE', value: millage.toFixed(2) + ' mills', sub: 'Per $1,000 assessed' },
          { label: 'REASSESSED YR1', value: '$' + reassessed.toLocaleString(), sub: delta > 0 ? '+$' + delta.toLocaleString() + ' vs T12' : 'No change' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-bold text-slate-100" style={{ fontFamily: MONO }}>{value}</span>
            <span className="text-[9px] text-slate-600" style={{ fontFamily: MONO }}>{sub}</span>
          </div>
        ))}
      </div>
      {delta > 10000 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-500/20 text-[11px] text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <strong>Year-1 Tax Shock:</strong>&nbsp;Reassessment at purchase expected. Yr1 bill +${delta.toLocaleString()} vs current.
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">REAL ESTATE TAX SCHEDULE</th>
            {sched.map(r => <th key={r.yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[84px] border-r border-[#1e1e1e]">YR {r.yr}</th>)}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / CAGR</th>
          </tr>
        </thead>
        <tbody>
          {([
            { label: 'A. ASSESSED VALUE', isHeader: true },
            { label: 'County AV', vals: sched.map(r => ({ v: fmtM(r.av), t: 'locked' as CellType })), sum: cagrStr(sched[0]?.av??null, sched[sched.length-1]?.av??null, sched.length) },
            { label: 'B. ANNUAL TAX BILL', isHeader: true },
            { label: 'Pro Forma Tax Bill', vals: sched.map(r => ({ v: '$' + r.tax.toLocaleString(), t: (r.yr===1&&delta>10000?'flagged':'normal') as CellType })), sum: '$' + sched.reduce((s,r)=>s+r.tax,0).toLocaleString() },
            { label: 'C. TAX BURDEN', isHeader: true },
            { label: 'Tax / Unit / Year', vals: sched.map(r => ({ v: '$' + r.pu.toLocaleString(), t: 'normal' as CellType })), sum: '$' + (sched[sched.length-1]?.pu??0).toLocaleString() },
            { label: '% of EGI', vals: sched.map(r => ({ v: fmtPct(r.asEgiPct), t: (r.asEgiPct>0.16?'warn':r.asEgiPct>0.13?'normal':'good') as CellType })), sum: fmtPct(sched.length ? sched.reduce((s,r)=>s+r.asEgiPct,0)/sched.length : 0) },
          ].map((r, i) => r.isHeader
            ? <SectionHeader key={i} label={r.label} cols={cols} />
            : <tr key={i} className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
                <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">{r.label}</td>
                {(r.vals||[]).map((c, ci) => <td key={ci} className={`px-2 py-1 text-right text-[10px] border-r border-[#1e1e1e] tabular-nums ${CELL_COLORS[c.t]}`} style={{ fontFamily: MONO }}>{c.v}</td>)}
                <td className={`px-2 py-1 text-right text-[10px] tabular-nums ${CELL_COLORS['computed']}`} style={{ fontFamily: MONO }}>{r.sum}</td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
type Page = 'OVERVIEW' | 'DEBT' | 'TAXES';
type HoldTab = '5 YR' | '7 YR' | '10 YR';
type EditTarget = { rowKey: string; yr: number; label: string; unit: string; current: number|null; patchField?: string } | null;

export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [page, setPage]       = useState<Page>('OVERVIEW');
  const [holdTab, setHoldTab] = useState<HoldTab|null>(null);
  const [financials, setFinancials] = useState<DealFinancials|null>(null);
  const [overrides, setOverrides]   = useState<Overrides>({});
  const [loading, setLoading]       = useState(false);
  const [m07Applied, setM07Applied] = useState(false);
  const [m07Busy, setM07Busy]       = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const fetchRef = useRef(0);

  const dbHold   = financials?.assumptions.holdYears ?? 5;
  const holdYears = holdTab === '5 YR' ? 5 : holdTab === '7 YR' ? 7 : holdTab === '10 YR' ? 10 : dbHold;
  const years     = useMemo(() => Array.from({ length: holdYears }, (_, i) => i + 1), [holdYears]);

  const fetchFinancials = useCallback(async (hold?: number) => {
    if (!dealId) return;
    const h = hold ?? holdYears;
    fetchRef.current++;
    const tok = fetchRef.current;
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/financials?hold=${h}`);
      if (tok !== fetchRef.current) return;
      const data: DealFinancials = res.data?.data ?? res.data;
      if (data?.proforma) setFinancials(data);
    } catch { /* silent — UI degrades gracefully */ }
    finally { if (tok === fetchRef.current) setLoading(false); }
  }, [dealId, holdYears]);

  useEffect(() => { fetchFinancials(); }, [dealId]);
  useEffect(() => { if (holdTab) fetchFinancials(holdYears); }, [holdTab]);

  // Apply Traffic M07: PATCH vacancyPct + rentGrowthPct from M07 signal for each year
  const handleApplyM07 = async () => {
    if (!financials?.trafficProjection?.yearly?.length) return;
    setM07Busy(true);
    try {
      const patches: Promise<unknown>[] = [];
      for (const tyr of financials.trafficProjection.yearly) {
        if (tyr.vacancyPct != null) {
          patches.push(apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: 'vacancyPct', year: tyr.year, value: tyr.vacancyPct }));
          setOverrides(prev => setOverride(prev, 'vacancyRate', tyr.year, tyr.vacancyPct));
        }
        if (tyr.rentGrowthPct != null) {
          patches.push(apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: 'rentGrowthPct', year: tyr.year, value: tyr.rentGrowthPct }));
          setOverrides(prev => setOverride(prev, 'rentGrowth', tyr.year, tyr.rentGrowthPct));
        }
      }
      await Promise.allSettled(patches);
      await fetchFinancials(holdYears);
      setM07Applied(true);
    } finally { setM07Busy(false); }
  };

  // Cell override apply
  const handleCellApply = async (val: number) => {
    if (!editTarget) return;
    setOverrides(prev => setOverride(prev, editTarget.rowKey, editTarget.yr, val));
    if (editTarget.patchField) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: editTarget.patchField, year: editTarget.yr, value: val });
        await fetchFinancials(holdYears);
      } catch { /* silent */ }
    }
    setEditTarget(null);
  };

  const handleCellClear = async () => {
    if (!editTarget) return;
    setOverrides(prev => setOverride(prev, editTarget.rowKey, editTarget.yr, null));
    if (editTarget.patchField) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field: editTarget.patchField, year: editTarget.yr, value: null });
        await fetchFinancials(holdYears);
      } catch { /* silent */ }
    }
    setEditTarget(null);
  };

  // Deal meta
  const a = assumptions;
  const dealName  = (deal?.['name'] as string) ?? financials?.dealName ?? a?.dealInfo?.dealName ?? 'Deal';
  const units     = financials?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0;
  const city      = a?.dealInfo?.city ?? '';
  const stateName = a?.dealInfo?.state ?? '';
  const location  = [city, stateName].filter(Boolean).join(', ');
  const avgUnitSF = a?.dealInfo?.netRentableSF && units ? Math.round(a.dealInfo.netRentableSF / units) : 875;
  const exitCap   = financials?.assumptions.exitCap ?? a?.disposition?.exitCapRate ?? 0.055;
  const acf       = (modelResults?.annualCashFlow ?? []) as Array<{year:number;noi:number;gpr:number}>;
  const noi1      = acf[0]?.noi ?? 0;
  const noiGrowth = 0.034;
  const egi1      = noi1 * 1.3;
  const irr       = modelResults?.summary?.irr ?? 0;
  const em        = modelResults?.summary?.equityMultiple ?? 0;
  const m07Conf   = financials?.trafficProjection?.leasingSignals?.confidence;
  const hasM07    = !!financials?.trafficProjection?.yearly?.length;

  const grid = useMemo(() =>
    buildGrid(years, financials, overrides, acf, exitCap, avgUnitSF),
    [years, financials, overrides, acf, exitCap, avgUnitSF]
  );

  const PAGE_NAV: Array<{ id: Page; label: string; icon: React.ReactNode; color: string }> = [
    { id: 'OVERVIEW', label: 'Overview',      icon: <BarChart3 className="w-3.5 h-3.5" />,  color: 'text-slate-300' },
    { id: 'DEBT',     label: 'Debt',          icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-400' },
    { id: 'TAXES',    label: 'Real Estate Tax',icon: <Building2 className="w-3.5 h-3.5" />,  color: 'text-amber-400' },
  ];

  const totalDS   = financials ? (buildDebt(financials.capitalStack.loanAmount??0, financials.capitalStack.interestRate??0.0675, financials.capitalStack.amortizationYears??30, financials.capitalStack.ioPeriodMonths ? Math.round(financials.capitalStack.ioPeriodMonths/12) : 2, holdYears, noi1, noiGrowth, financials.capitalStack.purchasePrice??0).reduce((s,r)=>s+r.annualPayment,0)) : 0;

  function openEdit(rowKey: string, yr: number, label: string, unit: string, patchField: string|undefined, cell: CellData) {
    if (!cell.editable) return;
    setEditTarget({ rowKey, yr, label, unit, current: cell.rawValue ?? null, patchField });
  }

  // ── Overview rows config ────
  type RowSpec = {
    key: string; label: string; locked?: boolean; isM07?: boolean; unit: string;
    patchField?: string; cells: CellData[]; cagrC: CellData;
  };

  const overviewRows: RowSpec[] = [
    { key: 'totalUnits',      label: 'Total Units',           locked: true,  unit: '',  cells: grid.totalUnits,       cagrC: fixedCell('—', 'locked') },
    { key: 'avgUnitSF',       label: 'Avg Unit SF',           locked: true,  unit: '',  cells: grid.avgUnitSF,        cagrC: fixedCell('—', 'locked') },
    { key: 'avgRent',         label: 'Avg Rent / Unit',       unit: '$',     patchField: 'rentPerUnit',  cells: grid.avgRent,         cagrC: cagrCell(grid.avgRent) },
    { key: 'rentGrowth',      label: 'Market Rent Growth %',  unit: '%',     patchField: 'rentGrowthPct', cells: grid.rentGrowth,      cagrC: avgCell(grid.rentGrowth) },
    { key: 'vacancyRate',     label: 'Vacancy Rate %',        unit: '%',     patchField: 'vacancyPct',   cells: grid.vacancyRate,     cagrC: avgCell(grid.vacancyRate) },
    { key: 'm07Vacancy',      label: 'Implied Vacancy',       isM07: true,   unit: '%',  cells: grid.m07Vacancy,      cagrC: avgCell(grid.m07Vacancy, 1, 1) },
    { key: 'lossToLease',     label: 'Loss to Lease %',       unit: '%',     patchField: 'lossToLeasePct', cells: grid.lossToLease,   cagrC: avgCell(grid.lossToLease) },
    { key: 'concessions',     label: 'Concessions %',         unit: '%',     patchField: 'concessionsPct', cells: grid.concessions,   cagrC: avgCell(grid.concessions) },
    { key: 'otherIncome',     label: 'Other Income / Unit',   unit: '$',     patchField: 'otherIncomePerUnit', cells: grid.otherIncome, cagrC: cagrCell(grid.otherIncome) },
    { key: 'opexGrowth',      label: 'OpEx Growth Rate %',    unit: '%',     cells: grid.opexGrowth,      cagrC: avgCell(grid.opexGrowth, 1, 1) },
    { key: 'mgmtFee',         label: 'Management Fee %',      unit: '%',     cells: grid.mgmtFee,         cagrC: fixedCell(grid.mgmtFee[0]?.display ?? '—', 'computed') },
    { key: 'reTaxGrowth',     label: 'Real Estate Tax Growth',locked: true,  unit: '',  cells: grid.reTaxGrowth,     cagrC: fixedCell('4.0%', 'computed') },
    { key: 'insuranceGrowth', label: 'Insurance Growth',      unit: '%',     cells: grid.insuranceGrowth, cagrC: fixedCell('3.5%', 'computed') },
    { key: 'reserves',        label: 'Repl. Reserves / Unit', locked: true,  unit: '',  cells: grid.reserves,        cagrC: fixedCell('$250', 'computed') },
    { key: 'noi',             label: 'NOI',                   locked: true,  unit: '',  cells: grid.noi,             cagrC: cagrCell(grid.noi) },
    { key: 'projectedValue',  label: 'Projected Value',       locked: true,  unit: '',  cells: grid.projectedValue,  cagrC: cagrCell(grid.projectedValue) },
    { key: 'm07Tours',        label: 'M07: Walk-ins/Week',    isM07: true,   unit: '/wk', cells: grid.m07Tours,       cagrC: cagrCell(grid.m07Tours) },
    { key: 'm07Occupancy',    label: 'M07: Implied Occupancy',isM07: true,   unit: '%', cells: grid.m07Occupancy,   cagrC: avgCell(grid.m07Occupancy) },
  ];

  const SECTION_BREAKS: Record<string, string> = {
    totalUnits:      '1. UNIT ECONOMICS',
    vacancyRate:     '2. REVENUE ASSUMPTIONS',
    opexGrowth:      '3. OPEX ASSUMPTIONS',
    noi:             '4. RETURNS SUMMARY',
    m07Tours:        '5. M07 TRAFFIC SIGNALS',
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs" style={{ fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100 tracking-wider text-[11px]">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[10px]">
            <span className="text-slate-400">{dealName}</span>
            {units > 0 && <><span className="text-slate-600">|</span><span className="text-slate-400">{units} Units</span></>}
            {location && <><span className="text-slate-600">|</span><span className="text-slate-400">{location}</span></>}
          </div>
          {m07Conf != null && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-500/20 rounded text-[9px]">
              <Zap className="w-2.5 h-2.5" /> M07 · {m07Conf}% conf
            </div>
          )}
          {loading && <span className="text-[8px] text-cyan-500" style={{ fontFamily: MONO }}>SYNCING…</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(['5 YR','7 YR','10 YR'] as HoldTab[]).map(tab => {
              const active = holdTab === tab || (holdTab === null && holdYears === (tab === '5 YR' ? 5 : tab === '7 YR' ? 7 : 10));
              return (
                <button key={tab} onClick={() => setHoldTab(tab)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {tab} {active && '✓'}
                </button>
              );
            })}
          </div>
          {hasM07 && (
            <button onClick={handleApplyM07} disabled={m07Busy}
              className={`px-3 py-1 text-[10px] font-bold border rounded transition-colors
                ${m07Applied ? 'bg-purple-900/60 text-purple-300 border-purple-500/60' : 'bg-purple-900/40 text-purple-400 border-purple-500/30 hover:bg-purple-900/60'}
                ${m07Busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              {m07Busy ? 'APPLYING…' : m07Applied ? '✓ TRAFFIC APPLIED [M07]' : 'APPLY TRAFFIC [M07]'}
            </button>
          )}
          <button onClick={() => { onAssumptionsChange && onAssumptionsChange({}); fetchFinancials(holdYears); }}
            className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60">
            RECALCULATE
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page nav */}
      <div className="flex items-center px-4 bg-[#0d0d0d] border-b border-[#1e1e1e]">
        {PAGE_NAV.map((p, i) => (
          <React.Fragment key={p.id}>
            <button onClick={() => setPage(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold border-b-2 transition-colors ${
                page === p.id ? `border-blue-500 ${p.color}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}>
              <span className={page === p.id ? p.color : 'text-slate-600'}>{p.icon}</span>
              {p.label.toUpperCase()}
            </button>
            {i < PAGE_NAV.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </React.Fragment>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-2 text-[9px] text-slate-600" style={{ fontFamily: MONO }}>
          {page === 'OVERVIEW' && (
            <>
              <span className="text-cyan-700">■ AI/PLATFORM</span>
              <span className="text-purple-700">■ M07 TRAFFIC</span>
              <span className="text-blue-700">■ USER OVERRIDE</span>
              <span className="text-amber-600">■ DIVERGENCE</span>
            </>
          )}
          {page === 'DEBT' && financials?.capitalStack.ioPeriodMonths != null && (
            <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded">
              {Math.round(financials.capitalStack.ioPeriodMonths/12)}YR I/O
            </span>
          )}
          {page === 'TAXES' && (
            <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded">
              14.19 MILLS
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {page === 'OVERVIEW' && (
          <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#1e1e1e]">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
                {years.map(y => (
                  <th key={y} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px] border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>YEAR {y}</th>
                ))}
                <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">CAGR / TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.map(row => (
                <React.Fragment key={row.key}>
                  {SECTION_BREAKS[row.key] && <SectionHeader label={SECTION_BREAKS[row.key]} cols={years.length + 2} />}
                  <GridRow
                    label={row.label}
                    locked={row.locked}
                    isM07={row.isM07}
                    cells={row.cells}
                    cagrCell={row.cagrC}
                    onCellClick={yr => {
                      const cell = row.cells[yr - 1];
                      if (!cell?.editable) return;
                      openEdit(row.key, yr, row.label, row.unit, row.patchField, cell);
                    }}
                  />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
        {page === 'DEBT' && (
          <DebtPage holdYears={holdYears} f={financials} noi1={noi1} noiGrowth={noiGrowth} />
        )}
        {page === 'TAXES' && (
          <TaxesPage holdYears={holdYears} f={financials} egi1={egi1} />
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
          {page === 'OVERVIEW' && (
            <>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold tracking-wider">IRR LEVERED</span>
                <span className={`text-sm font-bold ${irr > 0.15 ? 'text-green-400' : irr > 0 ? 'text-amber-400' : 'text-slate-500'}`} style={{ fontFamily: MONO }}>
                  {irr > 0 ? (irr * 100).toFixed(1) + '%' : '—'}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
                <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{em > 0 ? em.toFixed(2) + '×' : '—'}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold tracking-wider">STABILIZED VALUE</span>
                <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>
                  {grid.projectedValue[0]?.rawValue ? fmtM(grid.projectedValue[0].rawValue) : '—'}
                </span>
              </div>
            </>
          )}
          {page === 'DEBT' && totalDS > 0 && (
            <>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold tracking-wider">TOTAL DEBT SERVICE</span>
                <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{fmtM(totalDS)}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold tracking-wider">LOAN AMOUNT</span>
                <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{financials?.capitalStack.loanAmount ? fmtM(financials.capitalStack.loanAmount) : '—'}</span>
              </div>
            </>
          )}
          {page === 'TAXES' && (
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold tracking-wider">PURCHASE PRICE</span>
              <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{financials?.capitalStack.purchasePrice ? fmtM(financials.capitalStack.purchasePrice) : '—'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px]" style={{ fontFamily: MONO, color: '#334155' }}>
          <TrendingUp className="w-3 h-3" />
          <span>{holdYears}YR HOLD · {financials?.meta.seeded ? 'MODEL SYNCED' : 'AWAITING DATA'}</span>
          <span className={`w-2 h-2 rounded-full ${financials?.meta.seeded ? 'bg-green-500/30 border border-green-500/50' : 'bg-slate-700'}`} />
        </div>
      </div>

      {/* Inline cell editor */}
      {editTarget && (
        <CellEditor
          label={editTarget.label}
          year={editTarget.yr}
          unit={editTarget.unit}
          currentValue={editTarget.current}
          onApply={handleCellApply}
          onClear={handleCellClear}
          onCancel={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

export default AssumptionsTab;
