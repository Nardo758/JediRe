import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Lock, Download, AlertTriangle, TrendingUp, Zap,
  ChevronRight, ChevronDown, X, Check,
} from 'lucide-react';
import type { FinancialEngineTabProps } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Backend contract (mirrors proforma-adjustment.service.ts) ─────────────────
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
    perYear: Array<{ year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null }>;
  };
  meta: { seeded: boolean; updatedAt: string|null };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";
type RowMode = 'flat'|'stepped'|'formula';
// { rowKey → { year → value } }
type Overrides = Record<string, Record<number, number|null>>;

// ─── Data helpers ──────────────────────────────────────────────────────────────
const fmtPct = (n: number, dec = 1) => (n * 100).toFixed(dec) + '%';
const fmtM   = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
const fmtWk  = (n: number) => n.toFixed(1) + '/wk';

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
  unit: string; readonly?: boolean;
  format: (n: number) => string;
  description?: string;
  patchField?: string;
  platformSource: string; brokerSource: string;
  brokerPage?: string; brokerLine?: string;
  benchmarkP25?: number; benchmarkP50?: number; benchmarkP75?: number;
  getBroker:   (f: DealFinancials, yr: number) => number|null;
  getPlatform: (f: DealFinancials, yr: number) => number|null;
  getConfidence: (f: DealFinancials) => number|null;
}

const SEC: Record<number,string> = {
  1: '1  REVENUE — RENT SIDE',
  2: '2  REVENUE — TRAFFIC / DEMAND (M07)',
  3: '3  EXPENSE ASSUMPTIONS',
  4: '4  CAPEX / RESERVES',
  5: '5  DEBT ASSUMPTIONS',
  6: '6  EXIT ASSUMPTIONS',
  7: '7  STRATEGY-SPECIFIC',
};

const ROWS: RowDef[] = [
  // ── Section 1 ──────────────────────────────────────────────────────────────
  {
    key: 'effRent', label: 'Avg Eff Rent / Unit / Mo', section: 1, unit: '$',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'rentPerUnit',
    description: 'Average effective rent per unit per month across all unit types. Compounds each year by the rent growth % in Section 1.',
    platformSource: 'M07 Traffic Engine — Rent Trajectory (effRent per-year signal)',
    brokerSource: 'OM / Rent Roll — In-Place Avg Rent',
    brokerPage: 'Rent Roll Summary', brokerLine: 'Avg In-Place Rent',
    benchmarkP25: 1400, benchmarkP50: 1780, benchmarkP75: 2200,
    getBroker: (f, yr) => {
      const base = f.rentRollSummary?.avgInPlaceRent ?? (y1(f,'gpr')?.broker != null ? y1(f,'gpr')!.broker! / Math.max(f.totalUnits,1) / 12 : null);
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
    key: 'rentGrowth', label: 'Rent Growth % (per year)', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'rentGrowthPct',
    description: 'Year-over-year effective rent growth rate. M07 derives this from the effRent trajectory CAGR.',
    platformSource: 'M07 — effRent trajectory YoY CAGR',
    brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Rent Growth',
    benchmarkP25: 0.02, benchmarkP50: 0.03, benchmarkP75: 0.045,
    getBroker: (f, yr) => pyr(f, yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03,
    getPlatform: (f, yr) => tyr(f, yr)?.rentGrowthPct ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'lossToLease', label: 'Loss-to-Lease %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'lossToLeasePct',
    description: 'Market rent minus in-place rent as % of market rent. Narrows each year as leases roll at market.',
    platformSource: 'JEDI — Submarket Avg Loss-to-Lease',
    brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Loss-to-Lease',
    benchmarkP25: 0.01, benchmarkP50: 0.025, benchmarkP75: 0.05,
    getBroker: (f, _yr) => y1(f,'lossToLease')?.broker ?? y1(f,'lossToLease')?.t12 ?? 0.022,
    getPlatform: (f, _yr) => y1(f,'lossToLease')?.platform ?? 0.025,
    getConfidence: f => y1(f,'lossToLease')?.confidence ?? 60,
  },
  {
    key: 'concessions', label: 'Concessions %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'concessionsPct',
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
    key: 'badDebt', label: 'Bad Debt / Collection Loss %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'badDebtPct',
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
    key: 'otherIncome', label: 'Other Income / Unit / Mo', section: 1, unit: '$',
    format: n => '$' + Math.round(n),
    patchField: 'otherIncomePerUnit',
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
    key: 't01WeeklyTours', label: 'T-01 Walk-Ins / Week', section: 2, unit: '/wk',
    format: n => n.toFixed(1) + '/wk',
    patchField: 't01WeeklyTours',
    description: 'Total walk-in / inbound tour volume per week. Primary demand signal (T-01). Higher = stronger near-term absorption.',
    platformSource: 'M07 — T-01 real-time signal per year',
    brokerSource: 'N/A — real-time traffic signal',
    benchmarkP25: 6, benchmarkP50: 12, benchmarkP75: 22,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => tyr(f, yr)?.t01WeeklyTours ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't05ClosingRatio', label: 'T-05 Tour→Lease Conversion %', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 't05ClosingRatio',
    description: 'Tour-to-lease conversion rate (T-05). Higher = stronger qualified demand.',
    platformSource: 'M07 — T-05 signal per year',
    brokerSource: 'N/A — real-time signal',
    benchmarkP25: 0.18, benchmarkP50: 0.28, benchmarkP75: 0.40,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const v = tyr(f, yr)?.t05ClosingRatio;
      return v != null ? (v > 1 ? v / 100 : v) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't06WeeklyLeases', label: 'T-06 Net Leases / Week', section: 2, unit: '/wk',
    format: n => n.toFixed(1) + '/wk',
    patchField: 't06WeeklyLeases',
    description: 'Net new leases executed per week (T-06). Key lease-up velocity indicator.',
    platformSource: 'M07 — T-06 signal per year',
    brokerSource: 'N/A — real-time signal',
    benchmarkP25: 1.5, benchmarkP50: 3.0, benchmarkP75: 5.5,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => tyr(f, yr)?.t06WeeklyLeases ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't07Trajectory', label: 'T-07 Demand Trajectory % (YoY)', section: 2, unit: '%',
    format: n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%',
    description: 'YoY tour-volume change (T-07). Positive = accelerating demand. Drives absorption assumptions.',
    platformSource: 'M07 — T-07 derived from T-01 YoY',
    brokerSource: 'N/A — derived',
    readonly: true,
    benchmarkP25: -0.05, benchmarkP50: 0.05, benchmarkP75: 0.15,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const curr = tyr(f, yr)?.t01WeeklyTours;
      const prev = tyr(f, yr - 1)?.t01WeeklyTours;
      if (curr == null || prev == null || yr < 2 || prev === 0) return null;
      return (curr / prev) - 1;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'derivedVacancy', label: 'Derived Vacancy % (M07 equilibrium)', section: 2, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    description: 'Read-only vacancy derived from T-01×T-05 traffic equilibrium model. To override, adjust Stabilized Occupancy Target.',
    platformSource: 'M07 — equilibrium vacancy from tours × conversion',
    brokerSource: 'N/A — derived from traffic',
    readonly: true,
    benchmarkP25: 0.03, benchmarkP50: 0.06, benchmarkP75: 0.10,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.vacancyPct != null) return t.vacancyPct;
      if (t?.occupancyPct != null) return 1 - t.occupancyPct;
      return null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'stabilizedOcc', label: 'Stabilized Occupancy Target', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 'vacancyPct',
    description: 'Long-run stabilized occupancy target. Platform value is M07 equilibrium. Broker is OM pro forma occupancy.',
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
    key: 'leaseUpWeeks', label: 'Lease-Up to 95% Occ (weeks)', section: 2, unit: 'wks',
    format: n => Math.round(n) + ' wks',
    description: 'Weeks from certificate of occupancy to 95% physical occupancy. T-06 velocity determines this.',
    platformSource: 'M07 — T-06 weekly leases → weeks to 95%',
    brokerSource: 'OM / Pro Forma Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Lease-Up Period',
    benchmarkP25: 24, benchmarkP50: 36, benchmarkP75: 56,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo95 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },

  // ── Section 3 ──────────────────────────────────────────────────────────────
  {
    key: 'payroll', label: 'Payroll + Mgmt Fee ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'payroll',
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
    key: 'repairsMaint', label: 'Repairs & Maintenance ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'repairsMaintenance',
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
    key: 'utilities', label: 'Utilities ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'utilities',
    description: 'Owner-paid utilities per unit per year (water, gas, electric).',
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
    key: 'insurance', label: 'Insurance ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'insurance',
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
    key: 'reTax', label: 'Real Estate Taxes ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'realEstateTax',
    description: 'Annual RE tax per unit. Reassessment at purchase may cause a Year-1 shock.',
    platformSource: 'JEDI — County millage model',
    brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Real Estate Taxes',
    benchmarkP25: 600, benchmarkP50: 950, benchmarkP75: 1400,
    getBroker: (f, yr) => {
      const base = y1(f,'realEstateTax')?.broker ?? y1(f,'realEstateTax')?.t12 ?? y1(f,'realEstateTax')?.taxBill;
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
    key: 'capexPerUnit', label: 'CapEx Budget ($/unit total)', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
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
    key: 'reserves', label: 'Replacement Reserves ($/unit/yr)', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'replacementReserves',
    description: 'Annual replacement reserves per unit. Industry standard: $150–$350/unit.',
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
    key: 'interestRate', label: 'Interest Rate', section: 5, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
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
    key: 'ltv', label: 'LTV / LTC %', section: 5, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    description: 'Loan-to-value (or LTC for development) at closing.',
    platformSource: 'JEDI — Market LTV norms',
    brokerSource: 'OM / Financing Assumptions',
    brokerPage: 'Financing Assumptions', brokerLine: 'LTV',
    benchmarkP25: 0.55, benchmarkP50: 0.65, benchmarkP75: 0.72,
    getBroker: (f, _yr) => f.capitalStack.ltcPct ?? null,
    getPlatform: (_f, _yr) => 0.65,
    getConfidence: _f => 75,
  },
  {
    key: 'ioPeriod', label: 'Interest-Only Period (months)', section: 5, unit: 'mo',
    format: n => Math.round(n) + ' mo',
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
    key: 'exitCapRate', label: 'Exit Cap Rate', section: 6, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'exitCapRate',
    description: 'Terminal cap rate applied to the forward NOI in the disposition year.',
    platformSource: 'M07 — Demand velocity implies cap compression trend',
    brokerSource: 'OM / Underwriting Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Exit Cap Rate',
    benchmarkP25: 0.048, benchmarkP50: 0.055, benchmarkP75: 0.065,
    getBroker: (f, _yr) => f.assumptions.exitCap ?? null,
    getPlatform: (f, _yr) => f.trafficProjection?.calibrated?.exitCap ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },
  {
    key: 'sellingCosts', label: 'Selling Costs %', section: 6, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
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
    key: 'afterRepairRent', label: 'Target After-Repair Rent', section: 7, unit: '$',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'afterRepairRent',
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
    key: 'leaseUpVelocity', label: 'Lease-Up Velocity (leases/mo)', section: 7, unit: '/mo',
    format: n => Math.round(n) + '/mo',
    description: 'Monthly net leasing velocity target during lease-up. Ties to T-06 × 4.33.',
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

// ─── Layered cell ──────────────────────────────────────────────────────────────
interface LayerValues { broker: number|null; platform: number|null; user: number|null }
type ActiveLayer = 'broker'|'platform'|'user';

function LayeredCell({ vals, format, onClick, isM07, readonly }: {
  vals: LayerValues; format: (n: number) => string;
  onClick?: () => void; isM07?: boolean; readonly?: boolean;
}) {
  const { broker, platform, user } = vals;
  const diverge = platform != null && user != null && platform !== 0
    ? Math.abs((user - platform) / Math.abs(platform)) > 0.05
    : false;

  return (
    <td
      onClick={readonly ? undefined : onClick}
      className={`relative border-r border-[#1e1e1e] align-top px-1.5 py-0.5 min-w-[82px]
        ${readonly ? 'bg-[#0d0d0d]' : 'cursor-pointer hover:border hover:border-blue-500/30'}
        ${diverge ? 'bg-red-900/10' : ''}`}
    >
      {isM07 && <sup className="absolute top-[1px] right-[2px] text-[5px] text-purple-500 font-bold">M07</sup>}
      {readonly && <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-700" />}
      {user != null && (
        <div className="text-[9px] font-mono font-bold text-blue-400 leading-[1.3]">{format(user)}</div>
      )}
      {platform != null && (
        <div className={`text-[9px] font-mono leading-[1.3] ${user != null ? 'text-cyan-800' : 'text-cyan-400 font-bold'}`}>
          {format(platform)}
        </div>
      )}
      {broker != null && (
        <div className={`text-[9px] font-mono leading-[1.3] ${(user != null || platform != null) ? 'text-amber-900' : 'text-amber-400 font-bold'}`}>
          {format(broker)}
        </div>
      )}
      {user == null && platform == null && broker == null && (
        <div className="text-[9px] font-mono text-slate-700">—</div>
      )}
    </td>
  );
}

// ─── Side drawer ───────────────────────────────────────────────────────────────
interface DrawerState {
  open: boolean; row: RowDef|null; year: number;
  vals: LayerValues; financials: DealFinancials|null;
}

function CellDrawer({ state, onClose, onApply }: {
  state: DrawerState;
  onClose: () => void;
  onApply: (rd: RowDef, yr: number, val: number|null, allYears: boolean) => void;
}) {
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('platform');
  const [draft, setDraft] = useState('');
  const [applyAll, setApplyAll] = useState(false);

  const { row: rd, year: yr, vals, financials: f } = state;

  useEffect(() => {
    if (!state.open || !rd) return;
    setActiveLayer(vals.user != null ? 'user' : vals.platform != null ? 'platform' : 'broker');
    setDraft(vals.user != null
      ? (rd.unit === '%' ? (vals.user * 100).toFixed(2) : String(Math.round(vals.user)))
      : '');
    setApplyAll(false);
  }, [state.open, rd?.key, yr]);

  if (!state.open || !rd || !f) return null;

  const conf = rd.getConfidence(f);
  const benchPos = (() => {
    const { benchmarkP25: p25, benchmarkP50: p50, benchmarkP75: p75 } = rd;
    const effective = vals.user ?? vals.platform ?? vals.broker;
    if (effective == null || p25 == null || p75 == null) return null;
    return Math.max(0, Math.min(100, ((effective - p25) / (p75 - p25)) * 100));
  })();
  const y1data = y1(f, rd.patchField ?? rd.key);

  const handleApply = () => {
    if (!rd) return;
    if (activeLayer === 'user') {
      const n = parseFloat(draft);
      if (!isNaN(n)) onApply(rd, yr, rd.unit === '%' ? n / 100 : n, applyAll);
    } else if (activeLayer === 'platform' && vals.platform != null) {
      onApply(rd, yr, vals.platform, applyAll);
    } else if (activeLayer === 'broker' && vals.broker != null) {
      onApply(rd, yr, vals.broker, applyAll);
    }
    onClose();
  };

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
          {(['platform','broker','user'] as ActiveLayer[]).map(src => {
            const val = src === 'platform' ? vals.platform : src === 'broker' ? vals.broker : vals.user;
            const color = src === 'user' ? '#3b82f6' : src === 'platform' ? '#22d3ee' : '#f59e0b';
            const lbl = src === 'user' ? 'USER' : src === 'platform' ? 'PLATFORM' : 'BROKER';
            const active = activeLayer === src;
            const disabled = val == null && src !== 'user';
            return (
              <button key={src} onClick={() => !disabled && setActiveLayer(src)}
                style={{
                  flex: 1, padding: '5px 4px', fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.5,
                  border: `1px solid ${active ? color : '#1e1e1e'}`,
                  background: active ? `${color}18` : 'transparent',
                  color: active ? color : disabled ? '#1e293b' : '#334155',
                  borderRadius: 2, cursor: disabled ? 'not-allowed' : 'pointer',
                }}>
                {lbl}
                <div style={{ fontSize: 8, fontWeight: 400, color: active ? `${color}bb` : '#1e293b', marginTop: 1 }}>
                  {val != null ? rd.format(val) : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {rd.description && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.5 }}>{rd.description}</div>
        </div>
      )}

      {/* Platform derivation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#22d3ee50', letterSpacing: 0.5, marginBottom: 3 }}>PLATFORM DERIVATION</div>
        <div style={{ fontSize: 9, color: '#22d3ee', marginBottom: 4 }}>{rd.platformSource}</div>
        {conf != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${conf}%`, borderRadius: 2,
                background: conf > 80 ? '#10b981' : conf > 60 ? '#f59e0b' : '#ef4444',
              }} />
            </div>
            <span style={{ fontSize: 8, color: '#475569' }}>{conf}% confidence</span>
          </div>
        )}
      </div>

      {/* Traffic signals (Section 2 rows) */}
      {rd.section === 2 && f.trafficProjection?.leasingSignals && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#a855f750', letterSpacing: 0.5, marginBottom: 4 }}>M07 LEASING SIGNALS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 8 }}>
            {[
              { label: 'T-01 Tours/wk', value: f.trafficProjection.leasingSignals.t01WeeklyTours?.toFixed(1) ?? '—' },
              { label: 'T-05 Conversion', value: f.trafficProjection.leasingSignals.t05ClosingRatio != null ? (f.trafficProjection.leasingSignals.t05ClosingRatio * 100).toFixed(1) + '%' : '—' },
              { label: 'T-06 Leases/wk', value: f.trafficProjection.leasingSignals.t06WeeklyLeases?.toFixed(1) ?? '—' },
              { label: 'T-07 Lease-up wks', value: f.trafficProjection.leasingSignals.t07LeaseUpWeeksTo95?.toFixed(0) ?? '—' },
            ].map(s => (
              <div key={s.label}>
                <span style={{ color: '#334155' }}>{s.label}: </span>
                <span style={{ color: '#a855f7', fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broker citation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#f59e0b50', letterSpacing: 0.5, marginBottom: 3 }}>BROKER SOURCE</div>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 2 }}>{rd.brokerSource}</div>
        {(rd.brokerPage || rd.brokerLine) && (
          <div style={{ fontSize: 8, color: '#78350f', lineHeight: 1.6 }}>
            {rd.brokerPage && <span>Page/Section: {rd.brokerPage}</span>}
            {rd.brokerLine && <><br /><span>Line item: {rd.brokerLine}</span></>}
          </div>
        )}
        {y1data?.t12 != null && (
          <div style={{ fontSize: 8, color: '#78350f', marginTop: 3 }}>T12: {rd.format(y1data.t12)}</div>
        )}
      </div>

      {/* Benchmark percentile */}
      {rd.benchmarkP25 != null && rd.benchmarkP75 != null && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 5 }}>SUBMARKET BENCHMARK</div>
          <div style={{ position: 'relative', height: 12, background: '#1e1e1e', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)', opacity: 0.25 }} />
            {benchPos != null && <div style={{ position: 'absolute', left: `${benchPos}%`, top: 0, width: 2, height: '100%', background: '#fff', borderRadius: 1 }} />}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: '#334155' }}>
            <span>P25: {rd.format(rd.benchmarkP25)}</span>
            {rd.benchmarkP50 != null && <span style={{ color: '#475569' }}>P50: {rd.format(rd.benchmarkP50)}</span>}
            <span>P75: {rd.format(rd.benchmarkP75)}</span>
          </div>
          {y1data?.benchmarkPosition && (
            <div style={{ marginTop: 3, fontSize: 8, color: y1data.benchmarkPosition === 'within' ? '#10b981' : '#f59e0b' }}>
              Position: {y1data.benchmarkPosition.toUpperCase()} benchmark range
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
              placeholder={rd.unit === '%' ? 'e.g. 3.5' : 'numeric value'}
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
          <span style={{ fontSize: 9, color: '#64748b' }}>Apply to all years in hold period (Flat mode)</span>
        </label>
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
        {vals.user != null && (
          <button onClick={() => { onApply(rd, yr, null, applyAll); onClose(); }}
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

    // Broker GPR: avgInPlaceRent × compound growth × units × 12 × (1 - brokerVacancy)
    const brokerRent = financials.rentRollSummary?.avgInPlaceRent ?? (y1(financials,'gpr')?.broker != null ? y1(financials,'gpr')!.broker! / units / 12 : null);
    const brokerVac = p?.vacancyPct ?? 0.06;
    const brokerGpr = brokerRent != null ? Math.round(brokerRent * compound(financials, yr) * units * 12 * (1 - brokerVac)) : null;

    // Platform GPR: M07 effRent × M07 occupancy × units × 12
    const platRent = t?.effRent;
    const platOcc = t?.occupancyPct ?? (t?.vacancyPct != null ? 1 - t.vacancyPct : null);
    const platGpr = platRent != null && platOcc != null ? Math.round(platRent * platOcc * units * 12) : null;

    const delta = platGpr != null && brokerGpr != null ? platGpr - brokerGpr : null;
    return { yr, brokerGpr, platGpr, delta };
  });

  return (
    <>
      <tr className="border-b border-amber-500/20 bg-amber-900/10 cursor-pointer h-[24px]"
        onClick={() => setExpanded(x => !x)}>
        <td className="px-3 py-0.5 text-[10px] font-bold text-amber-400 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10 min-w-[220px]">
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            GPR DECOMPOSITION (Rent × Occ → Effective)
          </span>
        </td>
        {rows.map(r => (
          <td key={r.yr} className="px-2 py-0.5 text-right text-[10px] font-bold text-amber-400 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>
            {r.platGpr != null ? fmtM(r.platGpr) : r.brokerGpr != null ? fmtM(r.brokerGpr) : '—'}
          </td>
        ))}
        <td className="px-2 py-0.5 text-[9px] text-slate-700" />
      </tr>
      {expanded && (
        <>
          <tr className="h-[19px] border-b border-[#1e1e1e]/40">
            <td className="pl-8 pr-3 py-0.5 text-[9px] text-amber-700 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">Broker GPR (rent_comp × broker occ)</td>
            {rows.map(r => <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] text-amber-700 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>{r.brokerGpr != null ? fmtM(r.brokerGpr) : '—'}</td>)}
            <td />
          </tr>
          <tr className="h-[19px] border-b border-[#1e1e1e]/40">
            <td className="pl-8 pr-3 py-0.5 text-[9px] text-purple-500 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">M07 Platform GPR (traffic_comp × M07 occ)</td>
            {rows.map(r => <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] text-purple-500 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>{r.platGpr != null ? fmtM(r.platGpr) : '—'}</td>)}
            <td />
          </tr>
          <tr className="h-[19px] border-b border-amber-500/20">
            <td className="pl-8 pr-3 py-0.5 text-[9px] font-bold sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10" style={{ color: '#10b981' }}>Traffic Lift Δ (M07 vs Broker)</td>
            {rows.map(r => (
              <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] font-bold border-r border-[#1e1e1e]" style={{ fontFamily: MONO, color: r.delta != null ? (r.delta >= 0 ? '#10b981' : '#ef4444') : '#334155' }}>
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

// ─── Findings narrative rail ───────────────────────────────────────────────────
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
  const sig = financials?.trafficProjection?.leasingSignals;
  const conf = sig?.confidence;
  const yr1T = financials?.trafficProjection?.yearly[0];
  return (
    <div className="w-[200px] bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111] border-b border-[#1e1e1e] cursor-pointer"
        onClick={() => setOpen(false)}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>AI FINDINGS</span>
        <span style={{ fontSize: 8, color: '#1e293b' }}>◂</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4" style={{ fontFamily: MONO }}>
        {!financials ? (
          <div style={{ fontSize: 9, color: '#334155' }}>Loading…</div>
        ) : !financials.trafficProjection ? (
          <div style={{ fontSize: 9, color: '#78350f' }}>M07 Traffic Engine offline. Platform signals unavailable for this deal.</div>
        ) : (
          <>
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
                <div style={{ fontSize: 8, color: '#475569' }}>Traffic equilibrium model</div>
              </div>
            )}
            {sig && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 4 }}>LEASING SIGNALS</div>
                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.8 }}>
                  {sig.t01WeeklyTours != null && <div>T-01: <span style={{ color: '#e2e8f0' }}>{sig.t01WeeklyTours.toFixed(1)}/wk</span></div>}
                  {sig.t05ClosingRatio != null && <div>T-05: <span style={{ color: '#e2e8f0' }}>{(sig.t05ClosingRatio * 100).toFixed(1)}%</span></div>}
                  {sig.t06WeeklyLeases != null && <div>T-06: <span style={{ color: '#e2e8f0' }}>{sig.t06WeeklyLeases.toFixed(1)}/wk</span></div>}
                </div>
              </div>
            )}
            {financials.trafficProjection.leaseUp?.weeksTo95 != null && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 2 }}>LEASE-UP TIMELINE</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  <div>95% Occ: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{financials.trafficProjection.leaseUp.weeksTo95} wks</span></div>
                  {financials.trafficProjection.leaseUp.weeksTo90 != null && <div>90% Occ: <span style={{ color: '#e2e8f0' }}>{financials.trafficProjection.leaseUp.weeksTo90} wks</span></div>}
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

// ─── Root component ────────────────────────────────────────────────────────────
export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [financials, setFinancials] = useState<DealFinancials|null>(null);
  const [loading, setLoading]       = useState(false);
  const [holdTab, setHoldTab]       = useState<'5 YR'|'7 YR'|'10 YR'|null>(null);
  const [overrides, setOverrides]   = useState<Overrides>({});
  const [rowModes, setRowModes]     = useState<Record<string, RowMode>>({});
  const [drawer, setDrawer]         = useState<DrawerState>({ open: false, row: null, year: 1, vals: { broker: null, platform: null, user: null }, financials: null });
  const [lockedOverrides, setLockedOverrides] = useState(false);
  const fetchRef = useRef(0);

  const dbHold   = financials?.assumptions.holdYears ?? 5;
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
    } catch { /* silent — grid degrades gracefully to null */ }
    finally { if (tok === fetchRef.current) setLoading(false); }
  }, [dealId, holdYears]);

  useEffect(() => { fetchFinancials(); }, [dealId]);
  useEffect(() => { if (holdTab) fetchFinancials(holdYears); }, [holdTab]);

  const patchAndRefetch = useCallback(async (field: string, year: number, value: number|null) => {
    if (!field) return;
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field, year, value });
      fetchFinancials(holdYears); // re-fetch to get derived-vacancy recompute
    } catch (e) { console.warn('PATCH override failed', field, year, e); }
  }, [dealId, holdYears, fetchFinancials]);

  const getUser = (key: string, yr: number) => overrides[key]?.[yr] ?? null;
  const getMode = (key: string): RowMode => rowModes[key] ?? 'stepped';

  const handleApply = useCallback((rd: RowDef, yr: number, val: number|null, applyAll: boolean) => {
    const mode = getMode(rd.key);
    const targetYears = (applyAll || mode === 'flat') ? years : [yr];
    setOverrides(prev => {
      const next = { ...prev, [rd.key]: { ...(prev[rd.key] ?? {}) } };
      for (const y of targetYears) next[rd.key][y] = val;
      return next;
    });
    if (rd.patchField) {
      for (const y of targetYears) patchAndRefetch(rd.patchField, y, val);
    }
  }, [years, rowModes, patchAndRefetch]);

  // Bulk: use all platform values
  const handleUsePlatform = () => {
    if (!financials) return;
    const next: Overrides = { ...overrides };
    for (const rd of ROWS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = rd.getPlatform(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) patchAndRefetch(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next);
  };

  // Bulk: use all broker values
  const handleUseBroker = () => {
    if (!financials) return;
    const next: Overrides = { ...overrides };
    for (const rd of ROWS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = rd.getBroker(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) patchAndRefetch(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next);
  };

  const openDrawer = useCallback((rd: RowDef, yr: number) => {
    if (!financials) return;
    setDrawer({
      open: true, row: rd, year: yr, financials,
      vals: {
        broker: rd.getBroker(financials, yr),
        platform: rd.getPlatform(financials, yr),
        user: getUser(rd.key, yr),
      },
    });
  }, [financials, overrides]);

  const a = assumptions;
  const dealName = (deal?.['name'] as string) ?? financials?.dealName ?? a?.dealInfo?.dealName ?? 'Deal';
  const units    = financials?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0;
  const location = [a?.dealInfo?.city, a?.dealInfo?.state].filter(Boolean).join(', ');
  const irr      = modelResults?.summary?.irr ?? 0;
  const em       = modelResults?.summary?.equityMultiple ?? 0;
  const m07Conf  = financials?.trafficProjection?.leasingSignals?.confidence;

  const sections = [1, 2, 3, 4, 5, 6, 7] as const;
  const hasAnyOverride = Object.values(overrides).some(yr => Object.values(yr).some(v => v != null));

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs" style={{ fontFamily: 'system-ui,sans-serif' }}>
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
          {/* Hold tabs */}
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

      {/* Bulk actions bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0d0d0d] border-b border-[#1e1e1e] sticky top-[40px] z-20">
        <span className="text-[8px] font-bold text-slate-600 tracking-widest">BULK:</span>
        <button onClick={handleUsePlatform} disabled={!financials || lockedOverrides}
          className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-slate-600 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-30">
          USE ALL PLATFORM
        </button>
        <button onClick={handleUseBroker} disabled={!financials || lockedOverrides}
          className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-slate-600 hover:text-amber-400 hover:border-amber-500/40 disabled:opacity-30">
          USE ALL BROKER
        </button>
        {hasAnyOverride && (
          <>
            <button onClick={() => setLockedOverrides(l => !l)}
              className={`px-2 py-0.5 text-[8px] font-bold rounded border ${lockedOverrides ? 'border-blue-500/50 text-blue-400' : 'border-[#1e1e1e] text-slate-600 hover:text-blue-400'}`}>
              {lockedOverrides ? '🔒 OVERRIDES LOCKED' : 'LOCK OVERRIDES'}
            </button>
            <button onClick={() => { setOverrides({}); setLockedOverrides(false); }}
              disabled={lockedOverrides}
              className="px-2 py-0.5 text-[8px] font-bold rounded border border-[#1e1e1e] text-red-500/60 hover:text-red-400 hover:border-red-500/30 disabled:opacity-30">
              CLEAR ALL
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-3 text-[8px]" style={{ fontFamily: MONO }}>
          <span style={{ color: '#3b82f6' }}>■ USER</span>
          <span style={{ color: '#22d3ee' }}>■ PLATFORM</span>
          <span style={{ color: '#f59e0b' }}>■ BROKER</span>
          <span style={{ color: '#ef4444' }}>■ &gt;5% DIVERGE</span>
        </div>
      </div>

      {/* M07 offline warning */}
      {trafficOffline && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-900/20 border-b border-amber-500/20 text-[10px] text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Traffic Engine offline — Section 2 platform signals unavailable. Showing broker layer only.
        </div>
      )}

      {/* Main content: grid + findings rail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#1e1e1e]">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 min-w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
                {years.map(yr => (
                  <th key={yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 border-r border-[#1e1e1e]" style={{ minWidth: 82 }}>YR {yr}</th>
                ))}
                <th className="px-2 py-1.5 text-center text-[9px] font-bold text-slate-600" style={{ minWidth: 56 }}>MODE</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(sec => {
                const secRows = ROWS.filter(r => r.section === sec);
                return (
                  <React.Fragment key={sec}>
                    <tr className="bg-[#1a1a1a] border-y border-[#1e1e1e]">
                      <td colSpan={years.length + 2} className="px-3 py-1 text-[11px] font-bold text-slate-300 sticky left-0">{SEC[sec]}</td>
                    </tr>
                    {secRows.map(rd => {
                      const mode = getMode(rd.key);
                      return (
                        <tr key={rd.key} className="border-b border-[#1e1e1e]/40 hover:bg-[#0f0f0f] h-[22px]">
                          <td className="px-3 py-0.5 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                            <span className="flex items-center gap-1.5 truncate">
                              {rd.readonly && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                              {sec === 2 && !rd.readonly && <span className="text-[6px] text-purple-600 font-bold shrink-0">M07</span>}
                              <span className="truncate">{rd.label}</span>
                            </span>
                          </td>
                          {years.map(yr => (
                            <LayeredCell key={yr}
                              vals={{
                                broker: financials ? rd.getBroker(financials, yr) : null,
                                platform: financials ? rd.getPlatform(financials, yr) : null,
                                user: getUser(rd.key, yr),
                              }}
                              format={rd.format}
                              readonly={rd.readonly || lockedOverrides}
                              isM07={sec === 2}
                              onClick={() => openDrawer(rd, yr)}
                            />
                          ))}
                          {/* Row mode selector */}
                          <td className="px-1 py-0.5 text-center">
                            {!rd.readonly && (
                              <div className="flex gap-0.5 justify-center">
                                {(['flat','stepped','formula'] as RowMode[]).map(m => (
                                  <button key={m}
                                    onClick={() => m !== 'formula' && setRowModes(s => ({ ...s, [rd.key]: m }))}
                                    title={m === 'formula' ? 'Formula mode — v2 roadmap' : m === 'flat' ? 'Flat: Y1 propagates to all years' : 'Stepped: per-year values'}
                                    className={`px-1 py-0.5 text-[7px] font-bold rounded-sm
                                      ${mode === m ? 'bg-blue-600/40 text-blue-400' : 'text-slate-700 hover:text-slate-400'}
                                      ${m === 'formula' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                    disabled={m === 'formula'}>
                                    {m === 'flat' ? 'F' : m === 'stepped' ? 'S' : 'Fx'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* GPR Decomposition after Section 2 */}
                    {sec === 2 && <GprDecompRow years={years} financials={financials} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Findings rail */}
        <FindingsRail financials={financials} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
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
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">HOLD PERIOD</span>
            <span className="text-sm font-bold text-slate-200" style={{ fontFamily: MONO }}>{holdYears} YR</span>
          </div>
          <div className="w-px h-8 bg-[#1e1e1e]" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-bold tracking-wider">ACTIVE OVERRIDES</span>
            <span className="text-sm font-bold text-blue-400" style={{ fontFamily: MONO }}>
              {Object.values(overrides).reduce((s, yr) => s + Object.values(yr).filter(v => v != null).length, 0)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px]" style={{ fontFamily: MONO, color: '#334155' }}>
          <TrendingUp className="w-3 h-3" />
          <span>F9 · {holdYears}YR · {financials?.meta.seeded ? 'SEEDED' : 'NO SEED'}</span>
        </div>
      </div>

      {/* Side drawer */}
      <CellDrawer state={drawer} onClose={() => setDrawer(d => ({ ...d, open: false }))} onApply={handleApply} />
    </div>
  );
}

export default AssumptionsTab;
