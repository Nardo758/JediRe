import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Lock, Download, AlertTriangle, TrendingUp, Zap,
  ChevronRight, ChevronDown, X, Check, FlaskConical,
} from 'lucide-react';
import type { FinancialEngineTabProps } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Backend contract ──────────────────────────────────────────────────────────
interface OSRow {
  field: string; label: string;
  broker: number|null; platform: number|null; t12: number|null;
  resolved: number|null; resolution: string|null; perUnit: number|null;
  source: string|null; confidence: number|null;
  benchmarkPosition: 'above'|'below'|'within'|null;
}
interface TrafficYear {
  year: number; vacancyPct: number|null; occupancyPct: number|null;
  effRent: number|null; rentGrowthPct: number|null;
  t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null;
}
interface DealFinancials {
  dealId: string; dealName: string; totalUnits: number;
  proforma: { year1: OSRow[]; integrityChecks: unknown[]; unitEconomics: Record<string,number|null> };
  capitalStack: { purchasePrice: number|null; loanAmount: number|null; equityAtClose: number|null; ltcPct: number|null; interestRate: number|null; ioPeriodMonths: number|null; amortizationYears: number|null; dscrMin: number|null; originationFeePct: number|null; pricePerUnit: number|null };
  rentRollSummary: { avgInPlaceRent: number|null; weightedOccupancyPct: number|null }|null;
  trafficProjection: {
    yearly: TrafficYear[];
    leaseUp: { weeksTo90: number|null; weeksTo93: number|null; weeksTo95: number|null }|null;
    calibrated: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null };
    leasingSignals: { t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null; confidence: number|null }|null;
  }|null;
  assumptions: {
    holdYears: number; exitCap: number|null; rentGrowthYr1: number|null; rentGrowthStabilized: number|null;
    narrative?: string|null;
    perYear: Array<{ year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null }>;
  };
  meta: { seeded: boolean; updatedAt: string|null };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";
type RowMode = 'flat'|'stepped'|'formula';
type Overrides = Record<string, Record<number, number|null>>;
type Formulas  = Record<string, string>; // rowKey → expression string

// ─── Formula evaluator ─────────────────────────────────────────────────────────
// Supports: Y1..Yn (year refs), base (broker), platform, numeric literals, %, basic math
function evalFormula(
  expr: string,
  context: { base: number|null; platform: number|null; yearVals: Record<number, number|null> },
): number|null {
  try {
    let s = expr.trim();
    // Replace year references: Y1, y2, Y5 etc
    s = s.replace(/[Yy](\d+)/g, (_, n) => {
      const v = context.yearVals[Number(n)];
      return v != null ? String(v) : 'null';
    });
    s = s.replace(/\bbase\b/gi, context.base != null ? String(context.base) : 'null');
    s = s.replace(/\bplatform\b/gi, context.platform != null ? String(context.platform) : 'null');
    // Normalize percent literals: 3.5% → 0.035, +0.25% → +0.0025
    s = s.replace(/([+-]?\s*\d+(?:\.\d+)?)\s*%/g, (_, n) => String(parseFloat(n.replace(/\s+/,'')) / 100));
    if (s.includes('null')) return null;
    // eslint-disable-next-line no-new-func
    const result = new Function('return (' + s + ')')();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch { return null; }
}

// ─── Data helpers ──────────────────────────────────────────────────────────────
function y1(f: DealFinancials, field: string): OSRow|null {
  return f.proforma.year1.find(r => r.field === field) ?? null;
}
function tyr(f: DealFinancials, yr: number): TrafficYear|undefined {
  return f.trafficProjection?.yearly.find(r => r.year === yr);
}
function pyr(f: DealFinancials, yr: number) {
  return f.assumptions.perYear.find(p => p.year === yr);
}
function compound(f: DealFinancials, yr: number): number {
  let m = 1;
  for (let y = 1; y < yr; y++) {
    const g = pyr(f, y)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03;
    m *= 1 + (g ?? 0.03);
  }
  return m;
}

// ─── Row definition ────────────────────────────────────────────────────────────
interface RowDef {
  key: string; label: string; section: 1|2|3|4|5|6|7;
  unit: 'pct'|'dollar'|'weeks'|'per_wk'|'months'; readonly?: boolean;
  format: (n: number) => string;
  description?: string;
  patchField?: string;
  platformSource: string; brokerSource: string;
  brokerPage?: string; brokerLine?: string;
  benchmarkP25?: number; benchmarkP50?: number; benchmarkP75?: number;
  getBroker:     (f: DealFinancials, yr: number) => number|null;
  getPlatform:   (f: DealFinancials, yr: number) => number|null;
  getConfidence: (f: DealFinancials) => number|null;
}

const SEC: Record<number,string> = {
  1: '1  REVENUE — RENT SIDE',
  2: '2  REVENUE — TRAFFIC / DEMAND  [M07]',
  3: '3  EXPENSE ASSUMPTIONS',
  4: '4  CAPEX / RESERVES',
  5: '5  DEBT ASSUMPTIONS',
  6: '6  EXIT ASSUMPTIONS',
  7: '7  STRATEGY-SPECIFIC',
};

const fmtPct2 = (n: number) => (n * 100).toFixed(2) + '%';
const fmtDlr  = (n: number) => '$' + Math.round(n).toLocaleString();
const fmtWks  = (n: number) => Math.round(n) + ' wks';
const fmtPwk  = (n: number) => n.toFixed(1) + '/wk';
const fmtMo   = (n: number) => Math.round(n) + ' mo';

const ROWS: RowDef[] = [
  // ── Section 1 ──────────────────────────────────────────────────────────────
  {
    key: 'effRent', label: 'Avg Eff Rent / Unit / Mo', section: 1, unit: 'dollar',
    format: fmtDlr, patchField: 'rentPerUnit',
    description: 'Average effective rent per unit per month. Compounds each year by the rent growth % in Section 1.',
    platformSource: 'M07 Traffic Engine — per-year effRent trajectory',
    brokerSource: 'OM / Rent Roll — Avg In-Place Rent',
    brokerPage: 'Rent Roll Summary', brokerLine: 'Avg In-Place Rent',
    benchmarkP25: 1400, benchmarkP50: 1780, benchmarkP75: 2200,
    getBroker: (f, yr) => {
      const base = f.rentRollSummary?.avgInPlaceRent
        ?? (y1(f,'gpr')?.broker != null ? y1(f,'gpr')!.broker! / Math.max(f.totalUnits,1) / 12 : null);
      return base != null ? Math.round(base * compound(f, yr)) : null;
    },
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.effRent != null) return Math.round(t.effRent);
      const base = y1(f,'gpr')?.platform;
      return base != null ? Math.round(base / Math.max(f.totalUnits,1) / 12 * compound(f, yr)) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'rentGrowth', label: 'Rent Growth % (per year)', section: 1, unit: 'pct',
    format: fmtPct2, patchField: 'rentGrowthPct',
    description: 'Year-over-year rent growth. M07 derives this from the effRent trajectory CAGR.',
    platformSource: 'M07 — effRent trajectory YoY CAGR',
    brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Rent Growth',
    benchmarkP25: 0.02, benchmarkP50: 0.03, benchmarkP75: 0.045,
    getBroker: (f, yr) => pyr(f, yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03,
    getPlatform: (f, yr) => tyr(f, yr)?.rentGrowthPct ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'lossToLease', label: 'Loss-to-Lease %', section: 1, unit: 'pct',
    format: fmtPct2, patchField: 'lossToLeasePct',
    description: 'Market rent minus in-place rent as % of market rent. Narrows each year as leases roll.',
    platformSource: 'JEDI — Submarket Avg Loss-to-Lease',
    brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Loss-to-Lease',
    benchmarkP25: 0.01, benchmarkP50: 0.025, benchmarkP75: 0.05,
    getBroker: (f, _yr) => y1(f,'lossToLease')?.broker ?? y1(f,'lossToLease')?.t12 ?? 0.022,
    getPlatform: (f, _yr) => y1(f,'lossToLease')?.platform ?? 0.025,
    getConfidence: f => y1(f,'lossToLease')?.confidence ?? 60,
  },
  {
    key: 'concessions', label: 'Concessions %', section: 1, unit: 'pct',
    format: fmtPct2, patchField: 'concessionsPct',
    description: 'Free rent / net effective concessions as % of GPR. Declines as market tightens.',
    platformSource: 'M07 — Leasing velocity implies concession pressure',
    brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Concessions',
    benchmarkP25: 0.002, benchmarkP50: 0.005, benchmarkP75: 0.012,
    getBroker: (f, _yr) => y1(f,'concessions')?.broker ?? y1(f,'concessions')?.t12 ?? 0.005,
    getPlatform: (f, _yr) => y1(f,'concessions')?.platform ?? 0.004,
    getConfidence: f => y1(f,'concessions')?.confidence ?? 55,
  },
  {
    key: 'badDebt', label: 'Bad Debt / Collection Loss %', section: 1, unit: 'pct',
    format: fmtPct2, patchField: 'badDebtPct',
    description: 'Non-payment and collection losses as % of GPR.',
    platformSource: 'JEDI — Local collections data',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Collection Loss',
    benchmarkP25: 0.008, benchmarkP50: 0.015, benchmarkP75: 0.025,
    getBroker: (f, _yr) => y1(f,'badDebt')?.broker ?? y1(f,'badDebt')?.t12 ?? 0.015,
    getPlatform: (f, _yr) => y1(f,'badDebt')?.platform ?? 0.012,
    getConfidence: f => y1(f,'badDebt')?.confidence ?? 50,
  },
  {
    key: 'otherIncome', label: 'Other Income / Unit / Mo', section: 1, unit: 'dollar',
    format: fmtDlr, patchField: 'otherIncomePerUnit',
    description: 'Non-rent ancillary income (parking, storage, RUBS, pet fees) per unit per month.',
    platformSource: 'JEDI — Historical ancillary income by market',
    brokerSource: 'OM / T12 Other Income',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Other Income',
    benchmarkP25: 40, benchmarkP50: 75, benchmarkP75: 130,
    getBroker: (f, _yr) => {
      const v = y1(f,'otherIncome')?.perUnit ?? y1(f,'otherIncome')?.broker;
      return v != null ? Math.round(v < 5000 ? v : v / Math.max(f.totalUnits,1) / 12) : null;
    },
    getPlatform: (f, _yr) => {
      const v = y1(f,'otherIncome')?.platform;
      return v != null ? Math.round(v < 5000 ? v : v / Math.max(f.totalUnits,1) / 12) : null;
    },
    getConfidence: f => y1(f,'otherIncome')?.confidence ?? 65,
  },

  // ── Section 2 ──────────────────────────────────────────────────────────────
  {
    key: 't01WeeklyTours', label: 'T-01  Walk-Ins / Week', section: 2, unit: 'per_wk',
    format: fmtPwk, patchField: 't01WeeklyTours',
    description: 'Total walk-in / inbound tour volume per week. Primary demand signal (T-01).',
    platformSource: 'M07 — T-01 real-time signal per year',
    brokerSource: 'N/A — live traffic signal',
    benchmarkP25: 6, benchmarkP50: 12, benchmarkP75: 22,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => tyr(f, yr)?.t01WeeklyTours ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't05ClosingRatio', label: 'T-05  Tour→Lease Conversion %', section: 2, unit: 'pct',
    format: fmtPct2, patchField: 't05ClosingRatio',
    description: 'Tour-to-lease conversion rate (T-05). Higher = stronger qualified demand.',
    platformSource: 'M07 — T-05 signal per year',
    brokerSource: 'N/A — live traffic signal',
    benchmarkP25: 0.18, benchmarkP50: 0.28, benchmarkP75: 0.40,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const v = tyr(f, yr)?.t05ClosingRatio;
      return v != null ? (v > 1 ? v / 100 : v) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't06WeeklyLeases', label: 'T-06  Net Leases / Week', section: 2, unit: 'per_wk',
    format: fmtPwk, patchField: 't06WeeklyLeases',
    description: 'Net new leases executed per week (T-06). Key lease-up velocity indicator.',
    platformSource: 'M07 — T-06 signal per year',
    brokerSource: 'N/A — live traffic signal',
    benchmarkP25: 1.5, benchmarkP50: 3.0, benchmarkP75: 5.5,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => tyr(f, yr)?.t06WeeklyLeases ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't07Trajectory', label: 'T-07  Demand Trajectory % (YoY)', section: 2, unit: 'pct',
    format: n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%',
    description: 'YoY tour-volume change (T-07). Positive = accelerating demand.',
    platformSource: 'M07 — T-07 derived from T-01 YoY change',
    brokerSource: 'N/A — derived signal', readonly: true,
    benchmarkP25: -0.05, benchmarkP50: 0.05, benchmarkP75: 0.15,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      if (yr < 2) return null;
      const curr = tyr(f, yr)?.t01WeeklyTours;
      const prev = tyr(f, yr - 1)?.t01WeeklyTours;
      return (curr != null && prev != null && prev !== 0) ? (curr / prev) - 1 : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'derivedVacancy', label: 'Derived Vacancy % (M07 equilibrium)', section: 2, unit: 'pct',
    format: fmtPct2, readonly: true,
    description: 'Read-only vacancy from T-01×T-05 traffic equilibrium. Override via Stabilized Occ Target.',
    platformSource: 'M07 — equilibrium vacancy from tours × conversion',
    brokerSource: 'N/A — derived', benchmarkP25: 0.03, benchmarkP50: 0.06, benchmarkP75: 0.10,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.vacancyPct != null) return t.vacancyPct;
      return t?.occupancyPct != null ? 1 - t.occupancyPct : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'stabilizedOcc', label: 'Stabilized Occupancy Target', section: 2, unit: 'pct',
    format: fmtPct2, patchField: 'vacancyPct',
    description: 'Long-run stabilized occupancy target. Platform = M07 equilibrium. Override to model different absorption.',
    platformSource: 'M07 — occupancy trajectory per year',
    brokerSource: 'OM / Pro Forma Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Stabilized Occupancy',
    benchmarkP25: 0.90, benchmarkP50: 0.94, benchmarkP75: 0.97,
    getBroker: (f, yr) => {
      const v = pyr(f, yr)?.vacancyPct;
      return v != null ? 1 - v : null;
    },
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      return t?.occupancyPct ?? (t?.vacancyPct != null ? 1 - t.vacancyPct : null);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'leaseUpWeeks', label: 'Lease-Up to 95% Occ (weeks)', section: 2, unit: 'weeks',
    format: fmtWks,
    description: 'Weeks from CO to 95% physical occupancy. T-06 velocity determines this.',
    platformSource: 'M07 — T-06 weekly leases → weeks to 95%',
    brokerSource: 'OM / Pro Forma Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Lease-Up Period',
    benchmarkP25: 24, benchmarkP50: 36, benchmarkP75: 56,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo95 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'renovationLift', label: 'Renovation Traffic Lift %', section: 2, unit: 'pct',
    format: fmtPct2, patchField: 'renovationLiftPct',
    description: 'Incremental rent lift attributable to renovation / value-add scope, derived from M07 demand elasticity and submarket rent curves.',
    platformSource: 'M07 — Demand elasticity × renovation scope model',
    brokerSource: 'OM / Value-Add Pro Forma',
    brokerPage: 'Value-Add Pro Forma', brokerLine: 'Post-Renovation Premium',
    benchmarkP25: 0.06, benchmarkP50: 0.12, benchmarkP75: 0.20,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.effRent == null) return null;
      const base = f.rentRollSummary?.avgInPlaceRent;
      if (base == null || base === 0) return null;
      return Math.max(0, (t.effRent - base) / base);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 45,
  },

  // ── Section 3 ──────────────────────────────────────────────────────────────
  {
    key: 'payroll', label: 'Payroll + Mgmt Fee ($/unit/yr)', section: 3, unit: 'dollar',
    format: fmtDlr, patchField: 'payroll',
    description: 'On-site payroll and property management fee per unit per year.',
    platformSource: 'JEDI — Submarket OpEx benchmark',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Payroll & Benefits',
    benchmarkP25: 1100, benchmarkP50: 1450, benchmarkP75: 1900,
    getBroker: (f, yr) => {
      const base = y1(f,'payroll')?.broker ?? y1(f,'payroll')?.t12;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1(f,'payroll')?.platform;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getConfidence: f => y1(f,'payroll')?.confidence ?? 60,
  },
  {
    key: 'repairsMaint', label: 'Repairs & Maintenance ($/unit/yr)', section: 3, unit: 'dollar',
    format: fmtDlr, patchField: 'repairsMaintenance',
    description: 'Routine R&M per unit per year. Excludes capital expenditures.',
    platformSource: 'JEDI — Property class benchmark',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Repairs & Maintenance',
    benchmarkP25: 350, benchmarkP50: 550, benchmarkP75: 850,
    getBroker: (f, yr) => {
      const base = y1(f,'repairsMaintenance')?.broker ?? y1(f,'repairsMaintenance')?.t12;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1(f,'repairsMaintenance')?.platform;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getConfidence: f => y1(f,'repairsMaintenance')?.confidence ?? 55,
  },
  {
    key: 'utilities', label: 'Utilities ($/unit/yr)', section: 3, unit: 'dollar',
    format: fmtDlr, patchField: 'utilities',
    description: 'Owner-paid utilities per unit per year.',
    platformSource: 'JEDI — Utility benchmark by market',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Utilities',
    benchmarkP25: 400, benchmarkP50: 620, benchmarkP75: 900,
    getBroker: (f, yr) => {
      const base = y1(f,'utilities')?.broker ?? y1(f,'utilities')?.t12;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1(f,'utilities')?.platform;
      return base != null ? Math.round(base * Math.pow(1.03, yr - 1)) : null;
    },
    getConfidence: f => y1(f,'utilities')?.confidence ?? 60,
  },
  {
    key: 'insurance', label: 'Insurance ($/unit/yr)', section: 3, unit: 'dollar',
    format: fmtDlr, patchField: 'insurance',
    description: 'Hazard, liability, and specialty insurance per unit per year.',
    platformSource: 'JEDI — Insurance benchmark',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Insurance',
    benchmarkP25: 300, benchmarkP50: 475, benchmarkP75: 700,
    getBroker: (f, yr) => {
      const base = y1(f,'insurance')?.broker ?? y1(f,'insurance')?.t12;
      return base != null ? Math.round(base * Math.pow(1.035, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1(f,'insurance')?.platform;
      return base != null ? Math.round(base * Math.pow(1.035, yr - 1)) : null;
    },
    getConfidence: f => y1(f,'insurance')?.confidence ?? 65,
  },
  {
    key: 'reTax', label: 'Real Estate Taxes ($/unit/yr)', section: 3, unit: 'dollar',
    format: fmtDlr, patchField: 'realEstateTax',
    description: 'Annual RE tax per unit. Reassessment at purchase may cause a Year-1 shock.',
    platformSource: 'JEDI — County millage model',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Real Estate Taxes',
    benchmarkP25: 600, benchmarkP50: 950, benchmarkP75: 1400,
    getBroker: (f, yr) => {
      const r = y1(f,'realEstateTax');
      const base = r?.broker ?? r?.t12;
      return base != null ? Math.round(base * Math.pow(1.04, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1(f,'realEstateTax')?.platform;
      return base != null ? Math.round(base * Math.pow(1.04, yr - 1)) : null;
    },
    getConfidence: f => y1(f,'realEstateTax')?.confidence ?? 75,
  },

  // ── Section 4 ──────────────────────────────────────────────────────────────
  {
    key: 'capexPerUnit', label: 'CapEx Budget ($/unit total)', section: 4, unit: 'dollar',
    format: fmtDlr,
    description: 'Total capital expenditure budget per unit over hold period.',
    platformSource: 'JEDI — Value-add comp database',
    brokerSource: 'OM / CapEx Schedule',
    brokerPage: 'Capital Budget', brokerLine: 'Total CapEx Budget',
    benchmarkP25: 8000, benchmarkP50: 16000, benchmarkP75: 28000,
    getBroker: (f, _yr) => {
      const base = y1(f,'capex')?.broker;
      return base != null ? Math.round(base / Math.max(f.totalUnits,1)) : null;
    },
    getPlatform: (_f, _yr) => null,
    getConfidence: _f => 50,
  },
  {
    key: 'reserves', label: 'Replacement Reserves ($/unit/yr)', section: 4, unit: 'dollar',
    format: fmtDlr, patchField: 'replacementReserves',
    description: 'Annual replacement reserves per unit. Industry standard: $150–$350.',
    platformSource: 'JEDI — Industry reserve standard',
    brokerSource: 'OM / Pro Forma Expenses',
    brokerPage: 'Pro Forma Assumptions', brokerLine: 'Replacement Reserves',
    benchmarkP25: 150, benchmarkP50: 250, benchmarkP75: 350,
    getBroker: (f, _yr) => y1(f,'reserves')?.broker ?? 200,
    getPlatform: (_f, _yr) => 250,
    getConfidence: _f => 70,
  },

  // ── Section 5 ──────────────────────────────────────────────────────────────
  {
    key: 'interestRate', label: 'Interest Rate', section: 5, unit: 'pct',
    format: fmtPct2,
    description: 'Senior loan fixed rate. Platform = SOFR + 175bps current market.',
    platformSource: 'JEDI — SOFR + spread (market rate)',
    brokerSource: 'OM / Term Sheet or Debt Broker',
    brokerPage: 'Financing Assumptions', brokerLine: 'Interest Rate',
    benchmarkP25: 0.0575, benchmarkP50: 0.0675, benchmarkP75: 0.0775,
    getBroker: (f, _yr) => f.capitalStack.interestRate ?? null,
    getPlatform: (_f, _yr) => 0.0675,
    getConfidence: _f => 80,
  },
  {
    key: 'ltv', label: 'LTV / LTC %', section: 5, unit: 'pct',
    format: fmtPct2,
    description: 'Loan-to-value at closing.',
    platformSource: 'JEDI — Market LTV norms',
    brokerSource: 'OM / Financing Assumptions',
    brokerPage: 'Financing Assumptions', brokerLine: 'LTV',
    benchmarkP25: 0.55, benchmarkP50: 0.65, benchmarkP75: 0.72,
    getBroker: (f, _yr) => f.capitalStack.ltcPct ?? null,
    getPlatform: (_f, _yr) => 0.65,
    getConfidence: _f => 75,
  },
  {
    key: 'ioPeriod', label: 'Interest-Only Period (months)', section: 5, unit: 'months',
    format: fmtMo,
    description: 'Months of I/O payments before amortization begins.',
    platformSource: 'JEDI — Lender market norms',
    brokerSource: 'OM / Term Sheet',
    brokerPage: 'Financing Assumptions', brokerLine: 'I/O Period',
    benchmarkP25: 0, benchmarkP50: 24, benchmarkP75: 48,
    getBroker: (f, _yr) => f.capitalStack.ioPeriodMonths ?? null,
    getPlatform: (_f, _yr) => 24,
    getConfidence: _f => 80,
  },

  // ── Section 6 ──────────────────────────────────────────────────────────────
  {
    key: 'exitCapRate', label: 'Exit Cap Rate', section: 6, unit: 'pct',
    format: fmtPct2, patchField: 'exitCapRate',
    description: 'Terminal cap rate applied to the forward NOI at disposition.',
    platformSource: 'M07 — Demand velocity implies cap compression trend',
    brokerSource: 'OM / Underwriting Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Exit Cap Rate',
    benchmarkP25: 0.048, benchmarkP50: 0.055, benchmarkP75: 0.065,
    getBroker: (f, _yr) => f.assumptions.exitCap ?? null,
    getPlatform: (f, _yr) => f.trafficProjection?.calibrated?.exitCap ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },
  {
    key: 'sellingCosts', label: 'Selling Costs %', section: 6, unit: 'pct',
    format: fmtPct2,
    description: 'Brokerage, legal, and transfer costs at disposition as % of sale price.',
    platformSource: 'JEDI — Market transaction cost norms',
    brokerSource: 'OM / Disposition Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Selling Costs',
    benchmarkP25: 0.015, benchmarkP50: 0.02, benchmarkP75: 0.025,
    getBroker: (f, _yr) => y1(f,'sellingCosts')?.broker ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 80,
  },

  // ── Section 7 ──────────────────────────────────────────────────────────────
  {
    key: 'afterRepairRent', label: 'Target After-Repair Rent', section: 7, unit: 'dollar',
    format: fmtDlr, patchField: 'afterRepairRent',
    description: 'Target in-place rent post-renovation. Value-add strategy only.',
    platformSource: 'M07 — Rent trajectory + renovation premium model',
    brokerSource: 'OM / Value-Add Pro Forma',
    brokerPage: 'Pro Forma Assumptions', brokerLine: 'Post-Renovation Rent',
    benchmarkP25: 1600, benchmarkP50: 2000, benchmarkP75: 2500,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      return t?.effRent != null ? Math.round(t.effRent * 1.08) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 50,
  },
  {
    key: 'leaseUpVelocity', label: 'Lease-Up Velocity (leases/mo)', section: 7, unit: 'per_wk',
    format: n => Math.round(n) + '/mo',
    description: 'Monthly net leasing velocity during lease-up. Ties to T-06 × 4.33.',
    platformSource: 'M07 — T-06 weekly lease velocity × 4.33',
    brokerSource: 'OM / Pro Forma Assumptions',
    brokerPage: 'Pro Forma Assumptions', brokerLine: 'Lease-Up Velocity',
    benchmarkP25: 8, benchmarkP50: 15, benchmarkP75: 25,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => {
      const wk = f.trafficProjection?.leasingSignals?.t06WeeklyLeases;
      return wk != null ? Math.round(wk * 4.33) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
];

// ─── Divergence helpers ────────────────────────────────────────────────────────
// yellow = user vs platform divergence > 100 bps; red = value > 2 stdDev from benchmark median
function getDivergenceColor(
  user: number|null, platform: number|null,
  broker: number|null,
  p25: number|undefined, p50: number|undefined, p75: number|undefined,
): 'red'|'amber'|null {
  const effective = user ?? platform ?? broker;
  // Benchmark stddev: approximation from IQR
  if (p25 != null && p50 != null && p75 != null && effective != null) {
    const stdDev = (p75 - p25) / 1.35;
    if (Math.abs(effective - p50) > 2 * stdDev) return 'red';
  }
  // 100bps user-vs-platform divergence
  if (user != null && platform != null) {
    const absDiff = Math.abs(user - platform);
    const relativeDiff = platform !== 0 ? absDiff / Math.abs(platform) : absDiff;
    if (relativeDiff > 0.01) return 'amber';
  }
  return null;
}

// ─── Layered cell ──────────────────────────────────────────────────────────────
interface LayerVals { broker: number|null; platform: number|null; user: number|null }

function LayeredCell({ vals, format, onClick, isM07, readonly, divergence, formulaResult }: {
  vals: LayerVals; format: (n: number) => string;
  onClick?: () => void; isM07?: boolean; readonly?: boolean;
  divergence: 'red'|'amber'|null; formulaResult?: number|null;
}) {
  const { broker, platform, user } = vals;
  const bg = divergence === 'red' ? 'bg-red-900/20 border-r-red-500/40' : divergence === 'amber' ? 'bg-amber-900/10 border-r-amber-500/20' : '';

  return (
    <td
      onClick={readonly ? undefined : onClick}
      className={`relative border-r border-[#1e1e1e] align-top px-1.5 py-0.5 min-w-[82px] ${bg}
        ${readonly ? 'bg-[#0d0d0d]' : 'cursor-pointer hover:border-blue-500/30'}`}
    >
      {isM07 && <sup className="absolute top-[1px] right-[2px] text-[5px] text-purple-600 font-bold">M07</sup>}
      {readonly && <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-700" />}
      {/* Formula result (top priority) */}
      {formulaResult != null && (
        <div className="text-[9px] font-mono font-bold text-teal-400 leading-[1.3]">
          {format(formulaResult)}
          <span className="text-[6px] text-teal-700 ml-0.5">Fx</span>
        </div>
      )}
      {formulaResult == null && user != null && (
        <div className="text-[9px] font-mono font-bold text-blue-400 leading-[1.3]">{format(user)}</div>
      )}
      {platform != null && (
        <div className={`text-[9px] font-mono leading-[1.3] ${(user != null || formulaResult != null) ? 'text-cyan-900' : 'text-cyan-400 font-bold'}`}>
          {format(platform)}
        </div>
      )}
      {broker != null && (
        <div className={`text-[9px] font-mono leading-[1.3] ${(user != null || platform != null || formulaResult != null) ? 'text-amber-900/70' : 'text-amber-400 font-bold'}`}>
          {format(broker)}
        </div>
      )}
      {formulaResult == null && user == null && platform == null && broker == null && (
        <div className="text-[9px] font-mono text-slate-700">—</div>
      )}
    </td>
  );
}

// ─── Side drawer ───────────────────────────────────────────────────────────────
interface DrawerTarget { row: RowDef; year: number; vals: LayerVals; formulaExpr: string; }

function CellDrawer({ target, allYears, onClose, onApply, onFormulaChange }: {
  target: DrawerTarget|null; allYears: number[];
  onClose: () => void;
  onApply: (rd: RowDef, yr: number, val: number|null, applyAllYears: boolean, layer: 'broker'|'platform'|'user'|'formula') => void;
  onFormulaChange: (rowKey: string, expr: string) => void;
}) {
  const [activeLayer, setActiveLayer] = useState<'broker'|'platform'|'user'|'formula'>('platform');
  const [draft, setDraft]   = useState('');
  const [formula, setFormula] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!target) return;
    const { vals, formulaExpr } = target;
    setActiveLayer(vals.user != null ? 'user' : vals.platform != null ? 'platform' : vals.broker != null ? 'broker' : 'user');
    setDraft(vals.user != null
      ? (target.row.unit === 'pct' ? (vals.user * 100).toFixed(2) : String(Math.round(vals.user)))
      : '');
    setFormula(formulaExpr);
    setApplyAll(false);
  }, [target?.row.key, target?.year]);

  if (!target) return null;
  const { row: rd, year: yr, vals } = target;

  const evalCtx = {
    base: vals.broker,
    platform: vals.platform,
    yearVals: {} as Record<number, number|null>,
  };

  const previewFormula = formula ? evalFormula(formula, evalCtx) : null;

  const handleApply = () => {
    if (activeLayer === 'formula') {
      onFormulaChange(rd.key, formula);
      onApply(rd, yr, null, applyAll, 'formula');
    } else if (activeLayer === 'user') {
      const n = parseFloat(draft);
      if (!isNaN(n)) onApply(rd, yr, rd.unit === 'pct' ? n / 100 : n, applyAll, 'user');
    } else if (activeLayer === 'platform' && vals.platform != null) {
      onApply(rd, yr, vals.platform, applyAll, 'platform');
    } else if (activeLayer === 'broker' && vals.broker != null) {
      onApply(rd, yr, vals.broker, applyAll, 'broker');
    }
    onClose();
  };

  const conf = rd.getConfidence; // will be called in renders
  const benchPos = (() => {
    const { benchmarkP25: p25, benchmarkP75: p75 } = rd;
    const eff = vals.user ?? vals.platform ?? vals.broker;
    if (eff == null || p25 == null || p75 == null || p75 === p25) return null;
    return Math.max(0, Math.min(100, ((eff - p25) / (p75 - p25)) * 100));
  })();

  const LAYER_CFG = [
    { id: 'platform' as const, label: 'PLATFORM', color: '#22d3ee', val: vals.platform },
    { id: 'broker'   as const, label: 'BROKER',   color: '#f59e0b', val: vals.broker },
    { id: 'user'     as const, label: 'USER',      color: '#3b82f6', val: vals.user },
    { id: 'formula'  as const, label: 'FORMULA',   color: '#2dd4bf', val: previewFormula },
  ];

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, zIndex: 200,
      background: '#0d0d0d', borderLeft: '1px solid #1e1e1e',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.8)', fontFamily: MONO,
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{rd.label}</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>YR {yr} · {rd.unit}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Layer selector */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 5 }}>SELECT ACTIVE LAYER</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {LAYER_CFG.map(lc => {
            const active = activeLayer === lc.id;
            const disabled = lc.id !== 'user' && lc.id !== 'formula' && lc.val == null;
            return (
              <button key={lc.id} onClick={() => !disabled && setActiveLayer(lc.id)}
                style={{
                  flex: 1, padding: '4px 2px', fontSize: 7, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.5,
                  border: `1px solid ${active ? lc.color : '#1e1e1e'}`,
                  background: active ? `${lc.color}18` : 'transparent',
                  color: active ? lc.color : disabled ? '#1e293b' : '#334155',
                  borderRadius: 2, cursor: disabled ? 'not-allowed' : 'pointer',
                }}>
                {lc.label}
                <div style={{ fontSize: 7, fontWeight: 400, color: active ? `${lc.color}bb` : '#1e293b', marginTop: 1 }}>
                  {lc.val != null ? rd.format(lc.val) : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {rd.description && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.5 }}>{rd.description}</div>
        </div>
      )}

      {/* Platform derivation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#22d3ee50', letterSpacing: 0.5, marginBottom: 3 }}>PLATFORM DERIVATION</div>
        <div style={{ fontSize: 9, color: '#22d3ee', marginBottom: 4 }}>{rd.platformSource}</div>
      </div>

      {/* Broker citation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#f59e0b50', letterSpacing: 0.5, marginBottom: 3 }}>BROKER SOURCE</div>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 2 }}>{rd.brokerSource}</div>
        {(rd.brokerPage || rd.brokerLine) && (
          <div style={{ fontSize: 8, color: '#78350f', lineHeight: 1.6 }}>
            {rd.brokerPage && <div>Page/Section: {rd.brokerPage}</div>}
            {rd.brokerLine && <div>Line item: {rd.brokerLine}</div>}
          </div>
        )}
      </div>

      {/* Benchmark percentile */}
      {rd.benchmarkP25 != null && rd.benchmarkP75 != null && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 5 }}>SUBMARKET BENCHMARK (P25 → P75)</div>
          <div style={{ position: 'relative', height: 12, background: '#1e1e1e', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)', opacity: 0.3 }} />
            {benchPos != null && (
              <div style={{ position: 'absolute', left: `${benchPos}%`, top: 0, width: 2, height: '100%', background: '#fff', borderRadius: 1 }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
            <span>P25: {rd.format(rd.benchmarkP25)}</span>
            {rd.benchmarkP50 != null && <span style={{ color: '#475569' }}>P50: {rd.format(rd.benchmarkP50)}</span>}
            <span>P75: {rd.format(rd.benchmarkP75)}</span>
          </div>
        </div>
      )}

      {/* Formula editor */}
      {activeLayer === 'formula' && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#2dd4bf80', letterSpacing: 0.5, marginBottom: 5 }}>
            <FlaskConical style={{ display: 'inline', width: 9, height: 9, marginRight: 4 }} />
            FORMULA EDITOR
          </div>
          <div style={{ fontSize: 8, color: '#475569', marginBottom: 5, lineHeight: 1.5 }}>
            Refs: <code style={{ color: '#64748b' }}>Y1..Y{allYears.length}</code>, <code style={{ color: '#64748b' }}>base</code>, <code style={{ color: '#64748b' }}>platform</code><br />
            e.g. <code style={{ color: '#94a3b8' }}>Y1 + 0.25%</code> · <code style={{ color: '#94a3b8' }}>base * 1.03</code>
          </div>
          <input ref={inputRef as unknown as React.RefObject<HTMLInputElement>}
            value={formula}
            onChange={e => setFormula(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
            placeholder="Y1 + 0.25%"
            style={{
              width: '100%', fontFamily: MONO, fontSize: 10, color: '#2dd4bf', fontWeight: 700,
              background: '#0f172a', border: '1px solid #2dd4bf', borderRadius: 2,
              padding: '5px 8px', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {previewFormula != null && (
            <div style={{ marginTop: 5, fontSize: 9, color: '#94a3b8' }}>
              Preview (YR {yr}): <span style={{ color: '#2dd4bf', fontWeight: 700 }}>{rd.format(previewFormula)}</span>
            </div>
          )}
        </div>
      )}

      {/* User override input */}
      {activeLayer === 'user' && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#3b82f660', letterSpacing: 0.5, marginBottom: 5 }}>YOUR OVERRIDE</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
              placeholder={rd.unit === 'pct' ? 'e.g. 3.5 (as %)' : 'numeric value'}
              style={{
                flex: 1, fontFamily: MONO, fontSize: 11, color: '#3b82f6', fontWeight: 700,
                background: '#0f172a', border: '1px solid #3b82f6', borderRadius: 2,
                padding: '4px 8px', outline: 'none',
              }}
            />
            <span style={{ fontSize: 9, color: '#475569' }}>{rd.unit}</span>
          </div>
        </div>
      )}

      {/* Apply to all years */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} style={{ width: 12, height: 12 }} />
          <span style={{ fontSize: 9, color: '#64748b' }}>Apply to all years in hold period</span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
        {vals.user != null && (
          <button onClick={() => { onApply(rd, yr, null, applyAll, 'user'); onClose(); }}
            style={{ fontFamily: MONO, fontSize: 9, padding: '5px 8px', borderRadius: 2, cursor: 'pointer', background: 'none', border: '1px solid #1e293b', color: '#475569' }}>
            CLEAR
          </button>
        )}
        <button onClick={handleApply}
          style={{ flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 2, cursor: 'pointer', background: '#3b82f6', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Check style={{ width: 10, height: 10 }} /> APPLY
        </button>
      </div>
    </div>
  );
}

// ─── GPR Decomposition row ─────────────────────────────────────────────────────
function GprDecompRow({ years, financials }: { years: number[]; financials: DealFinancials|null }) {
  const [expanded, setExpanded] = useState(false);
  if (!financials) return null;

  const rows = years.map(yr => {
    const units = Math.max(financials.totalUnits, 1);
    const t = tyr(financials, yr);
    const p = pyr(financials, yr);

    const brokerRent = financials.rentRollSummary?.avgInPlaceRent
      ?? (y1(financials,'gpr')?.broker != null ? y1(financials,'gpr')!.broker! / units / 12 : null);
    const brokerVac = p?.vacancyPct ?? 0.06;
    const brokerGpr = brokerRent != null ? Math.round(brokerRent * compound(financials, yr) * units * 12 * (1 - brokerVac)) : null;

    const platRent = t?.effRent;
    const platOcc  = t?.occupancyPct ?? (t?.vacancyPct != null ? 1 - t.vacancyPct : null);
    const platGpr  = platRent != null && platOcc != null ? Math.round(platRent * platOcc * units * 12) : null;

    const delta = platGpr != null && brokerGpr != null ? platGpr - brokerGpr : null;
    return { yr, brokerGpr, platGpr, delta };
  });

  const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';

  return (
    <>
      <tr className="border-b border-amber-500/20 bg-amber-900/10 cursor-pointer h-[24px]"
        onClick={() => setExpanded(x => !x)}>
        <td className="px-3 py-0.5 text-[10px] font-bold text-amber-400 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10 min-w-[220px]">
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            GPR DECOMPOSITION
          </span>
        </td>
        {rows.map(r => (
          <td key={r.yr} className="px-2 py-0.5 text-right text-[10px] font-bold text-amber-400 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>
            {r.platGpr != null ? fmtM(r.platGpr) : r.brokerGpr != null ? fmtM(r.brokerGpr) : '—'}
          </td>
        ))}
        <td className="px-1 py-0.5" />
      </tr>
      {expanded && (
        <>
          <tr className="h-[18px] border-b border-[#1e1e1e]/30">
            <td className="pl-8 pr-3 py-0 text-[9px] text-amber-700 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
              Broker GPR (rent_component × broker occ)
            </td>
            {rows.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right text-[9px] text-amber-700 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>
                {r.brokerGpr != null ? fmtM(r.brokerGpr) : '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr className="h-[18px] border-b border-[#1e1e1e]/30">
            <td className="pl-8 pr-3 py-0 text-[9px] text-purple-500 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">
              M07 Platform GPR (traffic_component × M07 occ)
            </td>
            {rows.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right text-[9px] text-purple-500 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>
                {r.platGpr != null ? fmtM(r.platGpr) : '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr className="h-[18px] border-b border-amber-500/20">
            <td className="pl-8 pr-3 py-0 text-[9px] font-bold sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 text-green-500">
              Traffic Lift Δ (M07 vs Broker)
            </td>
            {rows.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right text-[9px] font-bold border-r border-[#1e1e1e]"
                style={{ fontFamily: MONO, color: r.delta != null ? (r.delta >= 0 ? '#10b981' : '#ef4444') : '#334155' }}>
                {r.delta != null ? (r.delta >= 0 ? '+' : '') + fmtM(r.delta) : '—'}
              </td>
            ))}
            <td />
          </tr>
        </>
      )}
    </>
  );
}

// ─── Findings rail ─────────────────────────────────────────────────────────────
function FindingsRail({ financials }: { financials: DealFinancials|null }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <div className="w-7 bg-[#0d0d0d] border-l border-[#1e1e1e] flex items-start justify-center pt-3 cursor-pointer"
        onClick={() => setOpen(true)}>
        <span style={{ writingMode: 'vertical-rl', fontSize: 8, color: '#334155', letterSpacing: 0.5, fontFamily: MONO }}>FINDINGS ▸</span>
      </div>
    );
  }
  const sig  = financials?.trafficProjection?.leasingSignals;
  const conf = sig?.confidence;
  const yr1T = financials?.trafficProjection?.yearly[0];
  const narrative = financials?.assumptions?.narrative;

  return (
    <div className="w-[200px] bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111] border-b border-[#1e1e1e] cursor-pointer"
        onClick={() => setOpen(false)}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>AI FINDINGS</span>
        <span style={{ fontSize: 8, color: '#1e293b' }}>◂</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3" style={{ fontFamily: MONO }}>
        {!financials ? (
          <div style={{ fontSize: 9, color: '#334155' }}>Loading…</div>
        ) : !financials.trafficProjection ? (
          <div style={{ fontSize: 9, color: '#78350f', lineHeight: 1.5 }}>M07 Traffic Engine offline. Platform signals unavailable for this deal.</div>
        ) : (
          <>
            {/* narrative from assumptions.narrative */}
            {narrative && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 3 }}>MODEL NARRATIVE</div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.5 }}>{narrative}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 4 }}>MODEL CONFIDENCE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${conf ?? 0}%`, background: (conf ?? 0) > 80 ? '#10b981' : (conf ?? 0) > 60 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{conf ?? 0}%</span>
              </div>
            </div>

            {yr1T?.effRent != null && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 2 }}>YR1 EFF RENT</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>${Math.round(yr1T.effRent).toLocaleString()}</div>
                {yr1T.rentGrowthPct != null && <div style={{ fontSize: 8, color: '#10b981' }}>+{(yr1T.rentGrowthPct * 100).toFixed(1)}% YoY</div>}
              </div>
            )}
            {yr1T?.vacancyPct != null && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 2 }}>YR1 M07 VACANCY</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{(yr1T.vacancyPct * 100).toFixed(1)}%</div>
              </div>
            )}
            {sig && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 4 }}>LEASING SIGNALS</div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.8 }}>
                  {sig.t01WeeklyTours != null && <div>T-01: <span style={{ color: '#e2e8f0' }}>{sig.t01WeeklyTours.toFixed(1)}/wk</span></div>}
                  {sig.t05ClosingRatio != null && <div>T-05: <span style={{ color: '#e2e8f0' }}>{(sig.t05ClosingRatio * 100).toFixed(1)}%</span></div>}
                  {sig.t06WeeklyLeases != null && <div>T-06: <span style={{ color: '#e2e8f0' }}>{sig.t06WeeklyLeases.toFixed(1)}/wk</span></div>}
                  {sig.t07LeaseUpWeeksTo95 != null && <div>T-07: <span style={{ color: '#e2e8f0' }}>{sig.t07LeaseUpWeeksTo95} wks</span></div>}
                </div>
              </div>
            )}
            {financials.trafficProjection.leaseUp?.weeksTo95 != null && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 2 }}>LEASE-UP TIMELINE</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  {financials.trafficProjection.leaseUp.weeksTo90 != null && <div>90% Occ: <span style={{ color: '#e2e8f0' }}>{financials.trafficProjection.leaseUp.weeksTo90} wks</span></div>}
                  <div>95% Occ: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{financials.trafficProjection.leaseUp.weeksTo95} wks</span></div>
                </div>
              </div>
            )}
            {financials.trafficProjection.calibrated.lastCalibrated && (
              <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 8 }}>
                <div style={{ fontSize: 8, color: '#334155' }}>Last calibrated</div>
                <div style={{ fontSize: 8, color: '#475569' }}>{new Date(financials.trafficProjection.calibrated.lastCalibrated).toLocaleDateString()}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [financials, setFinancials]   = useState<DealFinancials|null>(null);
  const [loading, setLoading]         = useState(false);
  const [holdTab, setHoldTab]         = useState<'5 YR'|'7 YR'|'10 YR'|null>(null);
  const [overrides, setOverrides]     = useState<Overrides>({});
  const [formulas, setFormulas]       = useState<Formulas>({});
  const [rowModes, setRowModes]       = useState<Record<string, RowMode>>({});
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget|null>(null);
  const [lockedOverrides, setLockedOverrides] = useState(false);
  const fetchRef   = useRef(0);
  // ── Batch PATCH queue (avoids API storm on bulk actions) ──────────────────
  const patchQueue = useRef<Array<{field:string; year:number; value:number|null}>>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const dbHold    = financials?.assumptions.holdYears ?? 5;
  const holdYears = holdTab === '5 YR' ? 5 : holdTab === '7 YR' ? 7 : holdTab === '10 YR' ? 10 : dbHold;
  const years     = useMemo(() => Array.from({ length: holdYears }, (_, i) => i + 1), [holdYears]);
  const trafficOffline = !financials?.trafficProjection?.yearly?.length;

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
    } catch { /* silent degradation */ }
    finally { if (tok === fetchRef.current) setLoading(false); }
  }, [dealId, holdYears]);

  useEffect(() => { fetchFinancials(); }, [dealId]);
  useEffect(() => { if (holdTab) fetchFinancials(holdYears); }, [holdTab]);

  // Enqueue a PATCH and debounce flush (600ms) — single re-fetch after all patches
  const enqueuePatch = useCallback((field: string, year: number, value: number|null) => {
    patchQueue.current.push({ field, year, value });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      const patches = patchQueue.current.splice(0);
      await Promise.allSettled(patches.map(p =>
        apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, p)
      ));
      fetchFinancials(holdYears);
    }, 600);
  }, [dealId, holdYears, fetchFinancials]);

  const getUser    = (key: string, yr: number) => overrides[key]?.[yr] ?? null;
  const getMode    = (key: string): RowMode => rowModes[key] ?? 'stepped';
  const getFormula = (key: string) => formulas[key] ?? '';

  const computeFormulaResult = useCallback((rd: RowDef, yr: number): number|null => {
    const expr = getFormula(rd.key);
    if (!expr || getMode(rd.key) !== 'formula') return null;
    const yearVals: Record<number, number|null> = {};
    for (const y of years) {
      yearVals[y] = getUser(rd.key, y) ?? (financials ? rd.getPlatform(financials, y) ?? rd.getBroker(financials, y) : null);
    }
    return evalFormula(expr, {
      base: financials ? rd.getBroker(financials, yr) : null,
      platform: financials ? rd.getPlatform(financials, yr) : null,
      yearVals,
    });
  }, [formulas, rowModes, overrides, financials, years]);

  const handleApply = useCallback((
    rd: RowDef, yr: number, val: number|null, applyAll: boolean,
    layer: 'broker'|'platform'|'user'|'formula',
  ) => {
    if (layer === 'formula') return; // formula mode is applied separately via onFormulaChange
    const mode = getMode(rd.key);
    const targetYears = (applyAll || mode === 'flat') ? years : [yr];
    setOverrides(prev => {
      const next = { ...prev, [rd.key]: { ...(prev[rd.key] ?? {}) } };
      for (const y of targetYears) next[rd.key][y] = val;
      return next;
    });
    if (rd.patchField) {
      for (const y of targetYears) enqueuePatch(rd.patchField, y, val);
    }
  }, [years, rowModes, enqueuePatch]);

  const handleFormulaChange = useCallback((rowKey: string, expr: string) => {
    setFormulas(f => ({ ...f, [rowKey]: expr }));
    setRowModes(m => ({ ...m, [rowKey]: 'formula' }));
  }, []);

  // Bulk: use all platform
  const handleUsePlatform = () => {
    if (!financials || lockedOverrides) return;
    const next: Overrides = { ...overrides };
    for (const rd of ROWS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = rd.getPlatform(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) enqueuePatch(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next);
  };

  // Bulk: use all broker
  const handleUseBroker = () => {
    if (!financials || lockedOverrides) return;
    const next: Overrides = { ...overrides };
    for (const rd of ROWS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = rd.getBroker(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) enqueuePatch(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next);
  };

  const openDrawer = useCallback((rd: RowDef, yr: number) => {
    if (!financials || lockedOverrides) return;
    setDrawerTarget({
      row: rd, year: yr,
      vals: {
        broker:   rd.getBroker(financials, yr),
        platform: rd.getPlatform(financials, yr),
        user:     getUser(rd.key, yr),
      },
      formulaExpr: getFormula(rd.key),
    });
  }, [financials, overrides, formulas, lockedOverrides]);

  const a        = assumptions;
  const dealName = (deal?.['name'] as string) ?? financials?.dealName ?? a?.dealInfo?.dealName ?? 'Deal';
  const units    = financials?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0;
  const location = [a?.dealInfo?.city, a?.dealInfo?.state].filter(Boolean).join(', ');
  const irr      = modelResults?.summary?.irr ?? 0;
  const em       = modelResults?.summary?.equityMultiple ?? 0;
  const m07Conf  = financials?.trafficProjection?.leasingSignals?.confidence;
  const overrideCount = Object.values(overrides).reduce((s, yr) => s + Object.values(yr).filter(v => v != null).length, 0);

  const sections = [1, 2, 3, 4, 5, 6, 7] as const;

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs overflow-hidden" style={{ fontFamily: 'system-ui,sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#1e1e1e] sticky top-0 z-30">
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
          {loading && <span style={{ fontFamily: MONO, fontSize: 8, color: '#22d3ee' }}>SYNCING…</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(['5 YR','7 YR','10 YR'] as const).map(tab => {
              const active = holdTab === tab || (holdTab === null && holdYears === (tab === '5 YR' ? 5 : tab === '7 YR' ? 7 : 10));
              return (
                <button key={tab} onClick={() => setHoldTab(tab)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {tab}
                </button>
              );
            })}
          </div>
          <button onClick={() => { onAssumptionsChange?.({}); fetchFinancials(holdYears); }}
            className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60">
            RECALCULATE
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-3 px-4 py-1 bg-[#0d0d0d] border-b border-[#1e1e1e]">
        <span className="text-[8px] font-bold text-slate-600 tracking-widest">BULK:</span>
        <button onClick={handleUsePlatform} disabled={!financials || lockedOverrides}
          className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-slate-600 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-30">
          USE ALL PLATFORM
        </button>
        <button onClick={handleUseBroker} disabled={!financials || lockedOverrides}
          className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-slate-600 hover:text-amber-400 hover:border-amber-500/40 disabled:opacity-30">
          USE ALL BROKER
        </button>
        {overrideCount > 0 && (
          <>
            <button onClick={() => setLockedOverrides(l => !l)}
              className={`px-2 py-0.5 text-[8px] font-bold rounded border ${lockedOverrides ? 'border-blue-500/50 text-blue-400' : 'border-[#1e1e1e] text-slate-600 hover:text-blue-400'}`}>
              {lockedOverrides ? '🔒 LOCKED' : 'LOCK OVERRIDES'}
            </button>
            <button onClick={() => { setOverrides({}); setFormulas({}); setLockedOverrides(false); }}
              disabled={lockedOverrides}
              className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-red-500/60 hover:text-red-400 disabled:opacity-30">
              CLEAR ALL
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 text-[8px]" style={{ fontFamily: MONO }}>
          <span className="text-blue-500/70">■ USER</span>
          <span className="text-teal-500/70">■ FORMULA</span>
          <span className="text-cyan-700">■ PLATFORM</span>
          <span className="text-amber-700">■ BROKER</span>
          <span className="text-amber-500/70">▲ &gt;100bps</span>
          <span className="text-red-500/70">● &gt;2σ outlier</span>
        </div>
      </div>

      {/* M07 offline banner */}
      {trafficOffline && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-900/20 border-b border-amber-500/20 text-[10px] text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Traffic Engine offline — Section 2 platform signals unavailable. Showing broker layer only.
        </div>
      )}

      {/* Grid + findings */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#1e1e1e]">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 min-w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
                {years.map(yr => (
                  <th key={yr} className="px-2 py-1.5 text-center text-[10px] font-bold text-slate-500 border-r border-[#1e1e1e]" style={{ minWidth: 82, fontFamily: MONO }}>YR {yr}</th>
                ))}
                <th className="px-2 py-1.5 text-center text-[8px] font-bold text-slate-600" style={{ minWidth: 48 }}>MODE</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(sec => {
                const secRows = ROWS.filter(r => r.section === sec);
                return (
                  <React.Fragment key={sec}>
                    <tr className="bg-[#181818] border-y border-[#1e1e1e] h-[22px]">
                      <td colSpan={years.length + 2} className="px-3 py-1 text-[11px] font-bold text-slate-300 sticky left-0 bg-[#181818]">
                        {SEC[sec]}
                      </td>
                    </tr>
                    {secRows.map(rd => {
                      const mode = getMode(rd.key);
                      return (
                        <tr key={rd.key} className="border-b border-[#1e1e1e]/40 hover:bg-[#0f0f0f] h-[26px]">
                          <td className="px-3 py-0.5 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                            <span className="flex items-center gap-1.5 truncate">
                              {rd.readonly && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                              {sec === 2 && !rd.readonly && <span style={{ fontFamily: MONO, fontSize: 6, color: '#7e22ce', border: '1px solid #4c1d95', borderRadius: 2, padding: '0 2px', flexShrink: 0 }}>M07</span>}
                              {mode === 'formula' && <FlaskConical className="w-2.5 h-2.5 text-teal-500 shrink-0" />}
                              <span className="truncate">{rd.label}</span>
                            </span>
                          </td>
                          {years.map(yr => {
                            const broker   = financials ? rd.getBroker(financials, yr) : null;
                            const platform = financials ? rd.getPlatform(financials, yr) : null;
                            const user     = getUser(rd.key, yr);
                            const formulaResult = mode === 'formula' ? computeFormulaResult(rd, yr) : null;
                            const divergence = getDivergenceColor(
                              formulaResult ?? user, platform, broker,
                              rd.benchmarkP25, rd.benchmarkP50, rd.benchmarkP75,
                            );
                            return (
                              <LayeredCell key={yr}
                                vals={{ broker, platform, user }}
                                format={rd.format}
                                readonly={rd.readonly || lockedOverrides}
                                isM07={sec === 2}
                                divergence={divergence}
                                formulaResult={formulaResult}
                                onClick={() => openDrawer(rd, yr)}
                              />
                            );
                          })}
                          {/* Row mode selector */}
                          <td className="px-0.5 py-0.5 text-center">
                            {!rd.readonly && (
                              <div className="flex gap-0.5 justify-center">
                                {(['flat','stepped','formula'] as RowMode[]).map(m => {
                                  const isActive = mode === m;
                                  return (
                                    <button key={m}
                                      onClick={() => setRowModes(s => ({ ...s, [rd.key]: m }))}
                                      title={m === 'formula' ? 'Formula mode: enter an expression (Y1 + 0.25%, base * 1.03…)' : m === 'flat' ? 'Flat: Y1 propagates to all years' : 'Stepped: per-year values'}
                                      className={`px-1 py-0.5 text-[7px] font-bold rounded-sm cursor-pointer
                                        ${isActive ? 'bg-blue-600/40 text-blue-400' : 'text-slate-700 hover:text-slate-400'}`}>
                                      {m === 'flat' ? 'F' : m === 'stepped' ? 'S' : 'Fx'}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {sec === 2 && <GprDecompRow years={years} financials={financials} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <FindingsRail financials={financials} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">IRR</span>
            <span className={`text-sm font-bold ${irr > 0.15 ? 'text-green-400' : irr > 0 ? 'text-amber-400' : 'text-slate-500'}`} style={{ fontFamily: MONO }}>
              {irr > 0 ? (irr * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className="w-px h-6 bg-[#1e1e1e]" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">EM</span>
            <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{em > 0 ? em.toFixed(2) + '×' : '—'}</span>
          </div>
          <div className="w-px h-6 bg-[#1e1e1e]" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">HOLD</span>
            <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{holdYears}YR</span>
          </div>
          <div className="w-px h-6 bg-[#1e1e1e]" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">OVERRIDES</span>
            <span className="text-sm font-bold text-blue-400" style={{ fontFamily: MONO }}>{overrideCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px]" style={{ fontFamily: MONO, color: '#334155' }}>
          <TrendingUp className="w-3 h-3" />
          <span>F9 · {financials?.meta.seeded ? 'SEEDED' : 'NO SEED'}</span>
          <span className={`w-2 h-2 rounded-full ${financials?.meta.seeded ? 'bg-green-500/30 border border-green-500/50' : 'bg-slate-700'}`} />
        </div>
      </div>

      {/* Side drawer */}
      {drawerTarget && (
        <CellDrawer
          target={drawerTarget}
          allYears={years}
          onClose={() => setDrawerTarget(null)}
          onApply={handleApply}
          onFormulaChange={handleFormulaChange}
        />
      )}
    </div>
  );
}

export default AssumptionsTab;
