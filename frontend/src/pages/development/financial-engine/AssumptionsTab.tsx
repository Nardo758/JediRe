import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Lock, Download, AlertTriangle, TrendingUp, Building2, DollarSign,
  BarChart3, ChevronRight, X, Zap, ChevronDown,
} from 'lucide-react';
import type { FinancialEngineTabProps } from './types';
import type { AnnualCashFlowRow } from './types';
import { fmt$, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Local type declarations (matching backend DealFinancials contract) ─────────
interface OperatingStatementRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
  rentRoll: number | null;
  taxBill: number | null;
  resolved: number | null;
  resolution: string | null;
  perUnit: number | null;
  source: string | null;
  confidence: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}

interface TrafficYearly {
  year: number;
  vacancyPct: number | null;
  occupancyPct: number | null;
  effRent: number | null;
  rentGrowthPct: number | null;
  t01WeeklyTours: number | null;
  t05ClosingRatio: number | null;
  t06WeeklyLeases: number | null;
}

interface DealFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  proforma: { year1: OperatingStatementRow[]; integrityChecks: unknown[]; unitEconomics: Record<string, number | null> };
  capitalStack: {
    purchasePrice: number | null; pricePerUnit: number | null; loanAmount: number | null;
    equityAtClose: number | null; ltcPct: number | null; interestRate: number | null;
    ioPeriodMonths: number | null; amortizationYears: number | null; dscrMin: number | null;
    originationFeePct: number | null;
  };
  rentRollSummary: { unitMix: unknown[] | null; avgInPlaceRent: number | null; weightedOccupancyPct: number | null } | null;
  trafficProjection: {
    yearly: TrafficYearly[];
    leaseUp: { weeksTo90: number | null; weeksTo93: number | null; weeksTo95: number | null } | null;
    calibrated: { vacancyPct: number | null; rentGrowthPct: number | null; exitCap: number | null; lastCalibrated: string | null };
    leasingSignals: {
      t01WeeklyTours: number | null; t05ClosingRatio: number | null; t06WeeklyLeases: number | null;
      t07LeaseUpWeeksTo95: number | null; stabilizedOccupancyPct: number | null; confidence: number | null;
    } | null;
  } | null;
  assumptions: {
    holdYears: number;
    exitCap: number | null;
    rentGrowthYr1: number | null;
    rentGrowthStabilized: number | null;
    perYear: Array<{ year: number; rentGrowthPct: number | null; vacancyPct: number | null; exitCapIfLastYear: number | null }>;
  };
  meta: { seeded: boolean; updatedAt: string | null };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";
type CellType = 'normal' | 'ai' | 'override' | 'm07' | 'locked' | 'flagged' | 'computed' | 'warn' | 'good' | 'header';

const fmtM   = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
const fmtK   = (n: number) => '$' + Math.round(n / 1000).toLocaleString() + 'K';
const fmtPct = (n: number, dec = 1) => (n * 100).toFixed(dec) + '%';

// ─── Row mode types ────────────────────────────────────────────────────────────
type RowMode = 'flat' | 'stepped' | 'formula';

// ─── Grid override state ───────────────────────────────────────────────────────
// { [rowKey]: { [year]: value | null } }
type Overrides = Record<string, Record<number, number | null>>;

// ─── Row definition ────────────────────────────────────────────────────────────
interface RowDef {
  key: string;
  label: string;
  section: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  unit: string;
  readonly?: boolean;
  format: (n: number) => string;
  description?: string;
  patchField?: string;
  platformSource: string;
  brokerSource: string;
  brokerPage?: string;
  brokerLine?: string;
  benchmarkP25?: number;
  benchmarkP50?: number;
  benchmarkP75?: number;
  // Data getters — all derive from DealFinancials (fetched on mount)
  getBroker: (f: DealFinancials, yr: number) => number | null;
  getPlatform: (f: DealFinancials, yr: number) => number | null;
  getConfidence: (f: DealFinancials) => number | null;
}

const SECTION_LABELS: Record<number, string> = {
  1: '1. REVENUE — RENT SIDE',
  2: '2. REVENUE — TRAFFIC / DEMAND (M07)',
  3: '3. EXPENSE ASSUMPTIONS',
  4: '4. CAPEX / RESERVES',
  5: '5. DEBT ASSUMPTIONS',
  6: '6. EXIT ASSUMPTIONS',
  7: '7. STRATEGY-SPECIFIC',
};

// Helper: look up OperatingStatementRow by field name
function y1Row(f: DealFinancials, field: string): OperatingStatementRow | null {
  return f.proforma.year1.find(r => r.field === field) ?? null;
}

// Helper: compound per-year rent growth up to year Y
function compoundRentGrowth(f: DealFinancials, yr: number): number {
  if (yr <= 1) return 1;
  let mult = 1;
  for (let y = 1; y < yr; y++) {
    const g = f.assumptions.perYear.find(p => p.year === y)?.rentGrowthPct
      ?? f.assumptions.rentGrowthStabilized ?? 0.03;
    mult *= (1 + (g ?? 0.03));
  }
  return mult;
}

// Helper: compound per-year opex growth up to year Y (3% default)
function compoundOpexGrowth(yr: number): number {
  return Math.pow(1.03, yr - 1);
}

const ROW_DEFS: RowDef[] = [
  // ── Section 1: Revenue — Rent Side ──────────────────────────────────────
  {
    key: 'effRent', label: 'Avg Eff Rent / Unit / Mo', section: 1, unit: '$',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'rentPerUnit',
    description: 'Average effective rent per unit per month across all unit types. Compound grows by rent growth % each year.',
    platformSource: 'M07 Traffic Engine — Rent Trajectory',
    brokerSource: 'OM / Broker In-Place Rent',
    brokerPage: 'Rent Roll Summary', brokerLine: 'Avg In-Place Rent',
    benchmarkP25: 1400, benchmarkP50: 1780, benchmarkP75: 2200,
    getBroker: (f, yr) => {
      const base = f.rentRollSummary?.avgInPlaceRent ?? y1Row(f, 'gpr')?.broker;
      if (base == null) return null;
      return Math.round(base * compoundRentGrowth(f, yr));
    },
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
      if (t?.effRent) return Math.round(t.effRent);
      const base = y1Row(f, 'gpr')?.platform;
      if (base == null) return null;
      return Math.round(base * compoundRentGrowth(f, yr));
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'rentGrowth', label: 'Rent Growth %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'rentGrowthPct',
    description: 'YoY effective rent growth rate. Platform = Traffic Engine eff-rent trajectory CAGR.',
    platformSource: 'M07 Traffic Engine — Rent Trajectory CAGR',
    brokerSource: 'OM / Broker Rent Growth', brokerPage: 'Operating Assumptions', brokerLine: 'Rent Growth',
    benchmarkP25: 0.02, benchmarkP50: 0.03, benchmarkP75: 0.045,
    getBroker: (f, yr) => f.assumptions.perYear.find(p => p.year === yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03,
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
      return t?.rentGrowthPct != null ? t.rentGrowthPct : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'lossToLease', label: 'Loss-to-Lease %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'lossToLeasePct',
    description: 'Market rent minus in-place rent as % of market rent. Narrows as leases roll at renewal.',
    platformSource: 'JEDI Platform — Submarket Avg Loss-to-Lease',
    brokerSource: 'OM / Operating Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Loss-to-Lease',
    benchmarkP25: 0.01, benchmarkP50: 0.025, benchmarkP75: 0.05,
    getBroker: (f, _yr) => y1Row(f, 'lossToLease')?.broker ?? 0.03,
    getPlatform: (f, _yr) => y1Row(f, 'lossToLease')?.platform ?? 0.025,
    getConfidence: f => y1Row(f, 'lossToLease')?.confidence ?? 60,
  },
  {
    key: 'concessions', label: 'Concessions %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'concessionsPct',
    description: 'Free rent / net effective concessions as % of GPR. Narrows as market tightens.',
    platformSource: 'M07 Traffic — Leasing velocity → concession pressure',
    brokerSource: 'OM / Operating Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Concessions',
    benchmarkP25: 0.002, benchmarkP50: 0.005, benchmarkP75: 0.012,
    getBroker: (f, _yr) => y1Row(f, 'concessions')?.broker ?? 0.005,
    getPlatform: (f, _yr) => y1Row(f, 'concessions')?.platform ?? 0.004,
    getConfidence: f => y1Row(f, 'concessions')?.confidence ?? 55,
  },
  {
    key: 'badDebt', label: 'Bad Debt / Collection Loss %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'badDebtPct',
    description: 'Non-payment and collection losses as % of GPR.',
    platformSource: 'JEDI Platform — Local collections data',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Collection Loss',
    benchmarkP25: 0.008, benchmarkP50: 0.015, benchmarkP75: 0.025,
    getBroker: (f, _yr) => y1Row(f, 'badDebt')?.broker ?? 0.015,
    getPlatform: (f, _yr) => y1Row(f, 'badDebt')?.platform ?? 0.012,
    getConfidence: f => y1Row(f, 'badDebt')?.confidence ?? 50,
  },
  {
    key: 'otherIncome', label: 'Other Income / Unit / Mo', section: 1, unit: '$',
    format: n => '$' + n.toFixed(0),
    patchField: 'otherIncomePerUnit',
    description: 'Non-rent ancillary income (parking, storage, RUBS, pet fees) per unit/month.',
    platformSource: 'JEDI Platform — Historical ancillary data',
    brokerSource: 'OM / T12 Other Income', brokerPage: 'T12 Operating Statement', brokerLine: 'Other Income',
    benchmarkP25: 40, benchmarkP50: 75, benchmarkP75: 130,
    getBroker: (f, _yr) => y1Row(f, 'otherIncome')?.perUnit ?? null,
    getPlatform: (f, _yr) => y1Row(f, 'otherIncome')?.platform != null
      ? Math.round((y1Row(f, 'otherIncome')!.platform! / (f.totalUnits || 1)) / 12)
      : null,
    getConfidence: f => y1Row(f, 'otherIncome')?.confidence ?? 65,
  },

  // ── Section 2: Traffic / Demand ─────────────────────────────────────────
  {
    key: 't01WeeklyTours', label: 'T-01 Walk-Ins / Week', section: 2, unit: '/wk',
    format: n => n.toFixed(1) + '/wk',
    patchField: 't01WeeklyTours',
    description: 'Total walk-in / inbound tour volume per week. M07 real-time primary demand signal.',
    platformSource: 'M07 Traffic Engine — T-01 Signal',
    brokerSource: 'N/A — real-time traffic signal', brokerPage: 'N/A',
    benchmarkP25: 6, benchmarkP50: 12, benchmarkP75: 22,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => f.trafficProjection?.yearly.find(r => r.year === yr)?.t01WeeklyTours ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't05ClosingRatio', label: 'T-05 Conversion % (Tours→Leases)', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 't05ClosingRatio',
    description: 'Tour-to-lease conversion rate. T-05 signal. Higher = stronger qualified demand.',
    platformSource: 'M07 Traffic Engine — T-05 Signal',
    brokerSource: 'N/A — real-time traffic signal', brokerPage: 'N/A',
    benchmarkP25: 0.18, benchmarkP50: 0.28, benchmarkP75: 0.40,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
      if (t?.t05ClosingRatio == null) return null;
      return t.t05ClosingRatio > 1 ? t.t05ClosingRatio / 100 : t.t05ClosingRatio;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't06WeeklyLeases', label: 'T-06 Weekly Net Leases', section: 2, unit: '/wk',
    format: n => n.toFixed(1) + '/wk',
    patchField: 't06WeeklyLeases',
    description: 'Net new leases executed per week. T-06 signal. Key lease-up velocity indicator.',
    platformSource: 'M07 Traffic Engine — T-06 Signal',
    brokerSource: 'N/A — real-time traffic signal', brokerPage: 'N/A',
    benchmarkP25: 1.5, benchmarkP50: 3.0, benchmarkP75: 5.5,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => f.trafficProjection?.yearly.find(r => r.year === yr)?.t06WeeklyLeases ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't07Trajectory', label: 'T-07 Demand Trajectory %', section: 2, unit: '%',
    format: n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%',
    description: 'YoY demand change (T-01 tours). Positive = accelerating demand. T-07 signal.',
    platformSource: 'M07 Traffic Engine — T-07 Signal (derived from T-01 YoY)',
    brokerSource: 'N/A — real-time traffic signal', brokerPage: 'N/A',
    benchmarkP25: -0.05, benchmarkP50: 0.05, benchmarkP75: 0.15,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const curr = f.trafficProjection?.yearly.find(r => r.year === yr)?.t01WeeklyTours;
      const prev = f.trafficProjection?.yearly.find(r => r.year === yr - 1)?.t01WeeklyTours;
      if (curr == null || prev == null || yr < 2) return null;
      return prev > 0 ? (curr / prev) - 1 : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'derivedVacancy', label: 'Derived Vacancy % (M07 equilibrium)', section: 2, unit: '%',
    readonly: true,
    format: n => (n * 100).toFixed(2) + '%',
    description: 'Vacancy derived from T-01×T-05 traffic equilibrium model. Read-only — override via stabilized occ. target.',
    platformSource: 'M07 Traffic Engine — Equilibrium Vacancy Model',
    brokerSource: 'N/A — derived from traffic signals', brokerPage: 'N/A',
    benchmarkP25: 0.03, benchmarkP50: 0.06, benchmarkP75: 0.10,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
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
    description: 'Long-run stabilized occupancy. Platform sets from traffic equilibrium; broker from OM pro forma.',
    platformSource: 'M07 Traffic Engine — Stabilized Occupancy Trajectory',
    brokerSource: 'OM / Pro Forma Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Stabilized Occupancy',
    benchmarkP25: 0.90, benchmarkP50: 0.94, benchmarkP75: 0.97,
    getBroker: (f, yr) => {
      const base = f.assumptions.perYear.find(p => p.year === yr)?.vacancyPct;
      return base != null ? 1 - base : null;
    },
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
      return t?.occupancyPct != null ? t.occupancyPct : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'leaseUpWeeks', label: 'Lease-Up to 95% Occ (weeks)', section: 2, unit: 'wks',
    format: n => Math.round(n) + ' wks',
    description: 'Weeks to reach 95% occupancy. M07 T-06 signal — primary dev deal constraint.',
    platformSource: 'M07 Traffic Engine — T-06 Weekly Leases → Lease-Up Timeline',
    brokerSource: 'OM / Pro Forma Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Lease-Up Period',
    benchmarkP25: 24, benchmarkP50: 36, benchmarkP75: 56,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo95 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },

  // ── Section 3: Expense Assumptions ──────────────────────────────────────
  {
    key: 'payroll', label: 'Payroll / Property Mgmt ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'payroll',
    description: 'On-site payroll + property management fee per unit per year.',
    platformSource: 'JEDI Platform — Submarket OpEx benchmark',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Payroll & Benefits',
    benchmarkP25: 1100, benchmarkP50: 1450, benchmarkP75: 1900,
    getBroker: (f, yr) => {
      const base = y1Row(f, 'payroll')?.broker ?? y1Row(f, 'payroll')?.t12;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1Row(f, 'payroll')?.platform;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getConfidence: f => y1Row(f, 'payroll')?.confidence ?? 60,
  },
  {
    key: 'repairsMaint', label: 'Repairs & Maintenance ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'repairsMaintenance',
    description: 'Routine R&M per unit per year. Excludes CapEx.',
    platformSource: 'JEDI Platform — Property class benchmark',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Repairs & Maintenance',
    benchmarkP25: 350, benchmarkP50: 550, benchmarkP75: 850,
    getBroker: (f, yr) => {
      const base = y1Row(f, 'repairsMaintenance')?.broker ?? y1Row(f, 'repairsMaintenance')?.t12;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1Row(f, 'repairsMaintenance')?.platform;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getConfidence: f => y1Row(f, 'repairsMaintenance')?.confidence ?? 55,
  },
  {
    key: 'utilities', label: 'Utilities ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'utilities',
    description: 'Owner-paid utilities per unit per year (water, gas, electric).',
    platformSource: 'JEDI Platform — Utility benchmark by market',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Utilities',
    benchmarkP25: 400, benchmarkP50: 620, benchmarkP75: 900,
    getBroker: (f, yr) => {
      const base = y1Row(f, 'utilities')?.broker ?? y1Row(f, 'utilities')?.t12;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1Row(f, 'utilities')?.platform;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getConfidence: f => y1Row(f, 'utilities')?.confidence ?? 60,
  },
  {
    key: 'mgmtFeePct', label: 'Management Fee %', section: 3, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'managementFeePct',
    description: 'Third-party property management fee as % of EGI. Includes leasing commissions.',
    platformSource: 'JEDI Platform — Market management fee avg',
    brokerSource: 'OM / Management Agreement', brokerPage: 'Operating Assumptions', brokerLine: 'Management Fee',
    benchmarkP25: 0.03, benchmarkP50: 0.04, benchmarkP75: 0.05,
    getBroker: (f, _yr) => y1Row(f, 'managementFee')?.broker != null
      ? (y1Row(f, 'managementFee')!.broker! / (y1Row(f, 'gpr')?.broker ?? 1))
      : 0.035,
    getPlatform: (f, _yr) => y1Row(f, 'managementFee')?.platform != null
      ? (y1Row(f, 'managementFee')!.platform! / (y1Row(f, 'gpr')?.platform ?? 1))
      : 0.04,
    getConfidence: f => y1Row(f, 'managementFee')?.confidence ?? 70,
  },
  {
    key: 'insurance', label: 'Insurance ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'insurance',
    description: 'Hazard, liability, and specialty insurance per unit per year.',
    platformSource: 'JEDI Platform — Insurance benchmark',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Insurance',
    benchmarkP25: 300, benchmarkP50: 475, benchmarkP75: 700,
    getBroker: (f, yr) => {
      const base = y1Row(f, 'insurance')?.broker ?? y1Row(f, 'insurance')?.t12;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1Row(f, 'insurance')?.platform;
      return base != null ? Math.round(base * compoundOpexGrowth(yr)) : null;
    },
    getConfidence: f => y1Row(f, 'insurance')?.confidence ?? 65,
  },
  {
    key: 'reTax', label: 'Real Estate Taxes ($/unit/yr)', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'realEstateTax',
    description: 'Annual RE tax per unit. Reassessment at purchase may create Year-1 shock.',
    platformSource: 'JEDI Platform — County millage model',
    brokerSource: 'OM / T12 Statement', brokerPage: 'T12 Operating Statement', brokerLine: 'Real Estate Taxes',
    benchmarkP25: 600, benchmarkP50: 950, benchmarkP75: 1400,
    getBroker: (f, yr) => {
      const base = y1Row(f, 'realEstateTax')?.broker ?? y1Row(f, 'realEstateTax')?.t12 ?? y1Row(f, 'realEstateTax')?.taxBill;
      return base != null ? Math.round(base * Math.pow(1.04, yr - 1)) : null;
    },
    getPlatform: (f, yr) => {
      const base = y1Row(f, 'realEstateTax')?.platform;
      return base != null ? Math.round(base * Math.pow(1.04, yr - 1)) : null;
    },
    getConfidence: f => y1Row(f, 'realEstateTax')?.confidence ?? 75,
  },

  // ── Section 4: CapEx / Reserves ─────────────────────────────────────────
  {
    key: 'capexPerUnit', label: 'CapEx Budget ($/unit)', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    description: 'Total capital expenditure budget per unit. Value-add benchmark: $10K–$30K/unit.',
    platformSource: 'JEDI Platform — Value-add comp database',
    brokerSource: 'OM / CapEx Schedule', brokerPage: 'Capital Budget', brokerLine: 'Total CapEx',
    benchmarkP25: 8000, benchmarkP50: 16000, benchmarkP75: 28000,
    getBroker: (f, _yr) => y1Row(f, 'capex')?.broker != null
      ? Math.round(y1Row(f, 'capex')!.broker! / (f.totalUnits || 1)) : null,
    getPlatform: (_f, _yr) => null,
    getConfidence: _f => 50,
  },
  {
    key: 'reserves', label: 'Replacement Reserves ($/unit/yr)', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'replacementReserves',
    description: 'Annual replacement reserves. Industry standard: $150–$350/unit for stabilized assets.',
    platformSource: 'JEDI Platform — Industry reserve standard',
    brokerSource: 'OM / Pro Forma Expenses', brokerPage: 'Pro Forma Assumptions', brokerLine: 'Replacement Reserves',
    benchmarkP25: 150, benchmarkP50: 250, benchmarkP75: 350,
    getBroker: (f, _yr) => y1Row(f, 'reserves')?.broker ?? null,
    getPlatform: (_f, _yr) => 250,
    getConfidence: _f => 70,
  },

  // ── Section 5: Debt Assumptions ─────────────────────────────────────────
  {
    key: 'interestRate', label: 'Interest Rate', section: 5, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    description: 'Senior loan fixed rate. Platform = SOFR + spread from current market.',
    platformSource: 'JEDI Platform — SOFR + 175bps (current)',
    brokerSource: 'OM / Term Sheet or Debt Broker', brokerPage: 'Financing Assumptions', brokerLine: 'Interest Rate',
    benchmarkP25: 0.0575, benchmarkP50: 0.0675, benchmarkP75: 0.0775,
    getBroker: (f, _yr) => f.capitalStack.interestRate ?? null,
    getPlatform: (_f, _yr) => 0.0675,
    getConfidence: _f => 80,
  },
  {
    key: 'ltv', label: 'LTV / LTC %', section: 5, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    description: 'Loan-to-value (or LTC for development) at closing.',
    platformSource: 'JEDI Platform — Market LTV norms',
    brokerSource: 'OM / Financing Assumptions', brokerPage: 'Financing Assumptions', brokerLine: 'LTV',
    benchmarkP25: 0.55, benchmarkP50: 0.65, benchmarkP75: 0.72,
    getBroker: (f, _yr) => f.capitalStack.ltcPct ?? null,
    getPlatform: (_f, _yr) => 0.65,
    getConfidence: _f => 75,
  },
  {
    key: 'ioPeriod', label: 'Interest-Only Period (mo)', section: 5, unit: 'mo',
    format: n => Math.round(n) + ' mo',
    description: 'Months of I/O payments before amortization begins.',
    platformSource: 'JEDI Platform — Lender market norms',
    brokerSource: 'OM / Term Sheet', brokerPage: 'Financing Assumptions', brokerLine: 'I/O Period',
    benchmarkP25: 0, benchmarkP50: 24, benchmarkP75: 48,
    getBroker: (f, _yr) => f.capitalStack.ioPeriodMonths ?? null,
    getPlatform: (_f, _yr) => 24,
    getConfidence: _f => 80,
  },

  // ── Section 6: Exit Assumptions ─────────────────────────────────────────
  {
    key: 'exitCapRate', label: 'Exit Cap Rate', section: 6, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'exitCapRate',
    description: 'Terminal cap rate applied to final-year forward NOI to derive sale price.',
    platformSource: 'M07 Traffic — Demand velocity implies cap compression',
    brokerSource: 'OM / Underwriting Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Exit Cap Rate',
    benchmarkP25: 0.048, benchmarkP50: 0.055, benchmarkP75: 0.065,
    getBroker: (f, _yr) => f.assumptions.exitCap ?? null,
    getPlatform: (f, _yr) => f.trafficProjection?.calibrated?.exitCap ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },
  {
    key: 'sellingCosts', label: 'Selling Costs %', section: 6, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    description: 'Brokerage, legal, and transfer costs at disposition.',
    platformSource: 'JEDI Platform — Market transaction cost norms',
    brokerSource: 'OM / Disposition Assumptions', brokerPage: 'Operating Assumptions', brokerLine: 'Selling Costs',
    benchmarkP25: 0.015, benchmarkP50: 0.02, benchmarkP75: 0.025,
    getBroker: (f, _yr) => y1Row(f, 'sellingCosts')?.broker ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 80,
  },

  // ── Section 7: Strategy-Specific ────────────────────────────────────────
  {
    key: 'afterRepairRent', label: 'Target After-Repair Rent', section: 7, unit: '$',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'afterRepairRent',
    description: 'Target in-place rent post-renovation. Value-add strategy only.',
    platformSource: 'M07 Traffic — Rent trajectory + renovation premium model',
    brokerSource: 'OM / Value-Add Pro Forma', brokerPage: 'Pro Forma Assumptions', brokerLine: 'Post-Renovation Rent',
    benchmarkP25: 1600, benchmarkP50: 2000, benchmarkP75: 2500,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = f.trafficProjection?.yearly.find(r => r.year === yr);
      return t?.effRent != null ? Math.round(t.effRent * 1.08) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 50,
  },
  {
    key: 'leaseUpVelocity', label: 'Lease-Up Velocity (leases/mo)', section: 7, unit: '/mo',
    format: n => Math.round(n) + '/mo',
    description: 'Monthly net leasing velocity target during lease-up.',
    platformSource: 'M07 Traffic Engine — T-06 weekly lease velocity × 4.33',
    brokerSource: 'OM / Pro Forma Assumptions', brokerPage: 'Pro Forma Assumptions', brokerLine: 'Lease-Up Velocity',
    benchmarkP25: 8, benchmarkP50: 15, benchmarkP75: 25,
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => {
      const wkly = f.trafficProjection?.leasingSignals?.t06WeeklyLeases;
      return wkly != null ? Math.round(wkly * 4.33) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
];

// ─── Shared cell renderer (used for Debt/Tax sub-pages) ────────────────────────
function Cell({ v, type = 'normal', span, align = 'right', tooltip }: {
  v: string; type?: CellType; span?: number; align?: 'right' | 'left' | 'center'; tooltip?: string;
}) {
  const base = 'relative px-2 py-1 text-[10px] font-mono tabular-nums border-r border-[#1e1e1e] ';
  const alignCls = align === 'left' ? 'text-left ' : align === 'center' ? 'text-center ' : 'text-right ';
  const variants: Record<CellType, string> = {
    normal:   'text-slate-300 hover:bg-[#1e1e1e] cursor-text ',
    ai:       'text-cyan-400 ',
    override: 'text-blue-400 bg-[#1e293b]/30 ',
    m07:      'text-purple-400 ',
    locked:   'text-slate-500 bg-[#0f0f0f] ',
    flagged:  'text-amber-500 bg-amber-900/20 ',
    computed: 'text-slate-200 font-bold ',
    warn:     'text-amber-400 bg-amber-900/10 ',
    good:     'text-green-400 ',
    header:   'text-slate-400 font-bold bg-[#111111] ',
  };
  return (
    <td className={base + alignCls + variants[type]} colSpan={span} title={tooltip}>{v}</td>
  );
}

function SectionHeader({ label, colSpan = 12 }: { label: string; colSpan?: number }) {
  return (
    <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
      <td colSpan={colSpan} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">{label}</td>
    </tr>
  );
}

function Row({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
      <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
        <span className="flex items-center gap-1">
          {locked && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
          {label}
        </span>
      </td>
      {children}
    </tr>
  );
}

// ─── LayeredCell ───────────────────────────────────────────────────────────────
interface LayeredCellProps {
  brokerVal: number | null;
  platformVal: number | null;
  userVal: number | null;
  readonly?: boolean;
  format: (n: number) => string;
  onClick?: () => void;
  hasM07?: boolean;
}

function LayeredCell({ brokerVal, platformVal, userVal, readonly, format, onClick, hasM07 }: LayeredCellProps) {
  const hasUser = userVal != null;
  const hasPlatform = platformVal != null;
  const hasBroker = brokerVal != null;
  // Divergence: user vs platform
  const divergence = (hasPlatform && hasUser && platformVal !== 0)
    ? Math.abs((userVal! - platformVal) / Math.abs(platformVal))
    : 0;
  const bgClass = divergence > 0.05 ? 'bg-red-900/15 ' : divergence > 0.01 ? 'bg-amber-900/10 ' : '';

  return (
    <td
      onClick={readonly ? undefined : onClick}
      className={`relative px-2 py-0.5 border-r border-[#1e1e1e] min-w-[82px] align-top
        ${readonly ? 'cursor-default' : 'cursor-pointer hover:border hover:border-blue-500/40'}
        ${bgClass}`}
    >
      {hasM07 && <sup className="absolute top-[2px] right-[2px] text-[6px] text-purple-500 font-bold">M07</sup>}
      {readonly && <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-700" />}
      {hasUser && <div className="text-[9px] font-mono font-bold text-blue-400 leading-[1.25]">{format(userVal!)}</div>}
      {hasPlatform && (
        <div className={`text-[9px] font-mono leading-[1.25] ${hasUser ? 'text-cyan-700' : 'text-cyan-400 font-bold'}`}>
          {format(platformVal!)}
        </div>
      )}
      {hasBroker && (
        <div className={`text-[9px] font-mono leading-[1.25] ${(hasUser || hasPlatform) ? 'text-amber-800' : 'text-amber-400 font-bold'}`}>
          {format(brokerVal!)}
        </div>
      )}
      {!hasUser && !hasPlatform && !hasBroker && (
        <div className="text-[9px] font-mono text-slate-700 leading-[1.25]">—</div>
      )}
    </td>
  );
}

// ─── Cell Drawer ───────────────────────────────────────────────────────────────
interface DrawerState {
  open: boolean; rowKey: string; rowLabel: string; year: number;
  brokerVal: number | null; platformVal: number | null; userVal: number | null;
  format: (n: number) => string; patchField: string | null;
  platformSource: string; brokerSource: string; brokerPage: string; brokerLine: string;
  confidence: number | null; unit: string; description: string;
  benchmarkP25: number | null; benchmarkP50: number | null; benchmarkP75: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}
const DRAWER_CLOSED: DrawerState = {
  open: false, rowKey: '', rowLabel: '', year: 1,
  brokerVal: null, platformVal: null, userVal: null,
  format: n => String(n), patchField: null,
  platformSource: '', brokerSource: '', brokerPage: '', brokerLine: '',
  confidence: null, unit: '', description: '',
  benchmarkP25: null, benchmarkP50: null, benchmarkP75: null, benchmarkPosition: null,
};

type LayerSource = 'broker' | 'platform' | 'user';

function CellDrawer({ state, onClose, onApply }: {
  state: DrawerState;
  onClose: () => void;
  onApply: (rowKey: string, year: number, value: number | null, applyAll: boolean) => void;
}) {
  const [draft, setDraft]     = useState('');
  const [layer, setLayer]     = useState<LayerSource>('platform');
  const [applyAll, setApplyAll] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setLayer(state.userVal != null ? 'user' : state.platformVal != null ? 'platform' : 'broker');
    setDraft(state.userVal != null
      ? state.unit === '%' ? (state.userVal * 100).toFixed(2) : String(Math.round(state.userVal))
      : '');
    setApplyAll(false);
  }, [state.open, state.rowKey, state.year]);

  const handleApply = () => {
    if (layer === 'user') {
      const n = parseFloat(draft);
      if (!isNaN(n)) onApply(state.rowKey, state.year, state.unit === '%' ? n / 100 : n, applyAll);
    } else if (layer === 'platform' && state.platformVal != null) {
      onApply(state.rowKey, state.year, state.platformVal, applyAll);
    } else if (layer === 'broker' && state.brokerVal != null) {
      onApply(state.rowKey, state.year, state.brokerVal, applyAll);
    }
    onClose();
  };

  // Benchmark percentile bar
  const pctPosition = (() => {
    const { benchmarkP25: p25, benchmarkP50: p50, benchmarkP75: p75, platformVal, brokerVal } = state;
    const val = state.userVal ?? platformVal ?? brokerVal;
    if (val == null || p25 == null || p75 == null) return null;
    const range = p75 - p25;
    if (range <= 0) return null;
    return Math.max(0, Math.min(100, ((val - p25) / range) * 100));
  })();

  if (!state.open) return null;
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, zIndex: 200,
      background: '#0d0d0d', borderLeft: '1px solid #1e1e1e',
      display: 'flex', flexDirection: 'column', fontFamily: MONO,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.7)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{state.rowLabel}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>YR {state.year} · {state.unit}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', marginTop: 2 }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Layer toggle */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 6 }}>ACTIVE LAYER</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['platform', 'broker', 'user'] as LayerSource[]).map(src => {
            const val = src === 'platform' ? state.platformVal : src === 'broker' ? state.brokerVal : state.userVal;
            const color = src === 'user' ? '#3b82f6' : src === 'platform' ? '#22d3ee' : '#f59e0b';
            const lbl = src === 'user' ? 'USER' : src === 'platform' ? 'PLATFORM' : 'BROKER';
            const active = layer === src;
            return (
              <button key={src} onClick={() => setLayer(src)}
                disabled={val == null && src !== 'user'}
                style={{
                  flex: 1, padding: '4px 4px', fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.5,
                  border: `1px solid ${active ? color : '#1e1e1e'}`,
                  background: active ? `${color}18` : 'transparent',
                  color: active ? color : '#334155', borderRadius: 2, cursor: val == null && src !== 'user' ? 'not-allowed' : 'pointer',
                }}>
                {lbl}
                <div style={{ fontSize: 8, fontWeight: 400, color: active ? `${color}cc` : '#1e293b' }}>
                  {val != null ? state.format(val) : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {state.description && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.5 }}>{state.description}</div>
        </div>
      )}

      {/* Platform derivation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#22d3ee60', letterSpacing: 0.5, marginBottom: 3 }}>PLATFORM DERIVATION</div>
        <div style={{ fontSize: 9, color: '#22d3ee', marginBottom: 4 }}>{state.platformSource}</div>
        {state.confidence != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${state.confidence}%`, borderRadius: 2,
                background: state.confidence > 80 ? '#10b981' : state.confidence > 60 ? '#f59e0b' : '#ef4444',
              }} />
            </div>
            <span style={{ fontSize: 8, color: '#475569' }}>{state.confidence}% conf</span>
          </div>
        )}
      </div>

      {/* Broker citation */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#f59e0b60', letterSpacing: 0.5, marginBottom: 3 }}>BROKER SOURCE</div>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 2 }}>{state.brokerSource}</div>
        {(state.brokerPage || state.brokerLine) && (
          <div style={{ fontSize: 8, color: '#78350f' }}>
            {state.brokerPage && <span>Page: {state.brokerPage}</span>}
            {state.brokerPage && state.brokerLine && <span> · </span>}
            {state.brokerLine && <span>Line: {state.brokerLine}</span>}
          </div>
        )}
      </div>

      {/* Benchmark percentile */}
      {pctPosition != null && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.5, marginBottom: 6 }}>SUBMARKET BENCHMARK POSITION</div>
          <div style={{ position: 'relative', height: 12, background: '#1e1e1e', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: '0%', right: '0%', top: 0, bottom: 0, background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)', opacity: 0.3 }} />
            <div style={{ position: 'absolute', left: `${pctPosition}%`, top: 0, width: 2, height: '100%', background: '#fff', borderRadius: 1 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 8, color: '#334155' }}>
            <span>P25: {state.format(state.benchmarkP25!)}</span>
            <span style={{ color: '#64748b' }}>P50: {state.format(state.benchmarkP50!)}</span>
            <span>P75: {state.format(state.benchmarkP75!)}</span>
          </div>
          {state.benchmarkPosition && (
            <div style={{ marginTop: 4, fontSize: 8, color: state.benchmarkPosition === 'within' ? '#10b981' : '#f59e0b' }}>
              Position: {state.benchmarkPosition.toUpperCase()} benchmark range
            </div>
          )}
        </div>
      )}

      {/* User override input */}
      {layer === 'user' && (
        <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 8, color: '#3b82f660', letterSpacing: 0.5, marginBottom: 5 }}>YOUR OVERRIDE</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
              placeholder={state.unit === '%' ? 'e.g. 3.5 (%)' : 'numeric value'}
              style={{
                flex: 1, fontFamily: MONO, fontSize: 11, color: '#3b82f6', fontWeight: 700,
                background: '#0f172a', border: '1px solid #3b82f6', borderRadius: 2,
                padding: '4px 8px', outline: 'none',
              }}
            />
            <span style={{ fontSize: 9, color: '#475569' }}>{state.unit}</span>
          </div>
        </div>
      )}

      {/* Apply-to-all */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} style={{ width: 12, height: 12 }} />
          <span style={{ fontSize: 9, color: '#64748b' }}>Apply to all years in hold period</span>
        </label>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 12px', marginTop: 'auto', display: 'flex', gap: 6 }}>
        {state.userVal != null && (
          <button onClick={() => { onApply(state.rowKey, state.year, null, applyAll); onClose(); }}
            style={{ fontFamily: MONO, fontSize: 9, padding: '5px 8px', borderRadius: 2, cursor: 'pointer', background: 'none', border: '1px solid #1e293b', color: '#475569' }}>
            CLEAR
          </button>
        )}
        <button onClick={handleApply}
          style={{ flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 2, cursor: 'pointer', background: '#3b82f6', border: 'none', color: '#fff' }}>
          APPLY
        </button>
      </div>
    </div>
  );
}

// ─── GPR Decomposition Row ─────────────────────────────────────────────────────
function GprDecompRow({ years, financials }: { years: number[]; financials: DealFinancials | null }) {
  const [expanded, setExpanded] = useState(false);

  const rows = years.map(yr => {
    if (!financials) return { yr, brokerGpr: null, platformGpr: null, trafficLift: null };
    const units = financials.totalUnits || 1;
    const tYr = financials.trafficProjection?.yearly.find(r => r.year === yr);
    const pYr = financials.assumptions.perYear.find(p => p.year === yr);

    // Broker: base Y1 rent × compounded growth × units × 12 × (1 - vacancy)
    const brokerRent = financials.rentRollSummary?.avgInPlaceRent ?? y1Row(financials, 'gpr')?.broker;
    const brokerVac = pYr?.vacancyPct ?? 0.06;
    const brokerGpr = brokerRent != null
      ? Math.round(brokerRent * compoundRentGrowth(financials, yr) * units * 12 * (1 - brokerVac))
      : null;

    // Platform: from M07 effRent × occupancy
    const platRent = tYr?.effRent;
    const platOcc = tYr?.occupancyPct ?? (1 - (tYr?.vacancyPct ?? 0.06));
    const platformGpr = platRent != null ? Math.round(platRent * units * 12 * platOcc) : null;

    // Traffic lift = platform GPR - broker GPR (if both available)
    const trafficLift = platformGpr != null && brokerGpr != null ? platformGpr - brokerGpr : null;

    return { yr, brokerGpr, platformGpr, trafficLift };
  });

  return (
    <>
      <tr className="border-b border-amber-500/20 bg-amber-900/10 hover:bg-amber-900/20 cursor-pointer h-[24px]"
        onClick={() => setExpanded(x => !x)}>
        <td className="px-3 py-0.5 text-[10px] font-bold text-amber-400 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10 min-w-[220px]">
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            GPR DECOMPOSITION (Rent × Traffic → Derived)
          </span>
        </td>
        {rows.map(r => (
          <td key={r.yr} className="px-2 py-0.5 text-right text-[10px] font-bold font-mono tabular-nums text-amber-400 border-r border-[#1e1e1e]">
            {r.platformGpr != null ? fmt$(r.platformGpr) : r.brokerGpr != null ? fmt$(r.brokerGpr) : '—'}
          </td>
        ))}
        <td className="px-2 py-0.5 text-right text-[9px] font-mono text-slate-700">MODE</td>
      </tr>
      {expanded && rows.map(r => (
        <React.Fragment key={r.yr + '_decomp'}>
          {r.yr === years[0] && (
            <>
              <tr className="border-b border-[#1e1e1e]/40 h-[19px]">
                <td className="pl-8 pr-3 py-0.5 text-[9px] text-amber-700 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">Broker GPR (rent × broker vacancy)</td>
                {rows.map(row => (
                  <td key={row.yr} className="px-2 py-0.5 text-right text-[9px] font-mono text-amber-700 border-r border-[#1e1e1e]">
                    {row.brokerGpr != null ? fmt$(row.brokerGpr) : '—'}
                  </td>
                ))}
                <td />
              </tr>
              <tr className="border-b border-[#1e1e1e]/40 h-[19px]">
                <td className="pl-8 pr-3 py-0.5 text-[9px] text-purple-500 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">M07 Platform GPR (eff rent × M07 occ)</td>
                {rows.map(row => (
                  <td key={row.yr} className="px-2 py-0.5 text-right text-[9px] font-mono text-purple-500 border-r border-[#1e1e1e]">
                    {row.platformGpr != null ? fmt$(row.platformGpr) : '—'}
                  </td>
                ))}
                <td />
              </tr>
              <tr className="border-b border-amber-500/20 h-[19px]">
                <td className="pl-8 pr-3 py-0.5 text-[9px] font-bold text-green-500 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">Traffic Lift Δ (M07 vs Broker)</td>
                {rows.map(row => (
                  <td key={row.yr} className="px-2 py-0.5 text-right text-[9px] font-bold font-mono border-r border-[#1e1e1e]"
                    style={{ color: row.trafficLift != null && row.trafficLift > 0 ? '#10b981' : '#ef4444' }}>
                    {row.trafficLift != null ? (row.trafficLift >= 0 ? '+' : '') + fmt$(row.trafficLift) : '—'}
                  </td>
                ))}
                <td />
              </tr>
            </>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Findings Narrative Right Rail ────────────────────────────────────────────
function FindingsRail({ financials }: { financials: DealFinancials | null }) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="w-8 bg-[#0d0d0d] border-l border-[#1e1e1e] flex items-start justify-center pt-4 cursor-pointer"
        onClick={() => setOpen(true)}>
        <span style={{ writingMode: 'vertical-rl', fontSize: 9, color: '#334155', letterSpacing: 0.5, fontFamily: MONO }}>FINDINGS ▸</span>
      </div>
    );
  }

  const sig = financials?.trafficProjection?.leasingSignals;
  const conf = sig?.confidence;
  const yr1Rent = financials?.trafficProjection?.yearly[0]?.effRent;
  const yr1Occ = financials?.trafficProjection?.yearly[0]?.occupancyPct;
  const yr1Vacancy = yr1Occ != null ? (100 - yr1Occ).toFixed(1) : null;
  const rentGrowthYr1 = financials?.trafficProjection?.yearly[0]?.rentGrowthPct;

  return (
    <div className="w-[210px] bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111111] border-b border-[#1e1e1e] cursor-pointer"
        onClick={() => setOpen(false)}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>AI FINDINGS</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#1e293b' }}>◂</span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4" style={{ fontFamily: MONO }}>
        {!financials?.trafficProjection ? (
          <div className="text-[9px] text-slate-700">Traffic Engine offline — no AI findings.</div>
        ) : (
          <>
            <div>
              <div className="text-[8px] text-slate-600 mb-2 tracking-wider">MODEL CONFIDENCE</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${conf ?? 0}%`,
                    background: (conf ?? 0) > 80 ? '#10b981' : (conf ?? 0) > 60 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
                <span className="text-[9px] font-bold text-slate-300">{conf ?? 0}%</span>
              </div>
            </div>
            {yr1Rent && (
              <div>
                <div className="text-[8px] text-cyan-700 mb-1 tracking-wider">YR 1 EFF RENT</div>
                <div className="text-sm font-bold text-slate-200">${yr1Rent.toLocaleString()}</div>
                {rentGrowthYr1 != null && <div className="text-[8px] text-green-600">+{(rentGrowthYr1 * 100).toFixed(1)}% YoY</div>}
              </div>
            )}
            {yr1Vacancy && (
              <div>
                <div className="text-[8px] text-cyan-700 mb-1 tracking-wider">YR 1 VACANCY</div>
                <div className="text-sm font-bold text-slate-200">{yr1Vacancy}%</div>
                <div className="text-[8px] text-slate-600">Traffic equilibrium model</div>
              </div>
            )}
            {sig?.t01WeeklyTours != null && (
              <div>
                <div className="text-[8px] text-cyan-700 mb-1 tracking-wider">LEASING SIGNALS</div>
                <div className="text-[9px] text-slate-400 space-y-0.5">
                  <div>T-01: <span className="text-slate-200">{sig.t01WeeklyTours.toFixed(1)}/wk</span></div>
                  {sig.t05ClosingRatio != null && <div>T-05: <span className="text-slate-200">{(sig.t05ClosingRatio * (sig.t05ClosingRatio > 1 ? 1 : 100)).toFixed(1)}%</span></div>}
                  {sig.t06WeeklyLeases != null && <div>T-06: <span className="text-slate-200">{sig.t06WeeklyLeases.toFixed(1)}/wk</span></div>}
                </div>
              </div>
            )}
            {financials.trafficProjection?.leaseUp?.weeksTo95 != null && (
              <div>
                <div className="text-[8px] text-cyan-700 mb-1 tracking-wider">LEASE-UP TIMELINE</div>
                <div className="text-[9px] text-slate-400">
                  95% Occ: <span className="text-slate-200">{financials.trafficProjection.leaseUp.weeksTo95} wks</span>
                </div>
              </div>
            )}
            {financials.meta.updatedAt && (
              <div className="border-t border-[#1e1e1e] pt-3">
                <div className="text-[8px] text-slate-700">Updated: {new Date(financials.meta.updatedAt).toLocaleDateString()}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Assumptions Grid Page ─────────────────────────────────────────────────────
function AssumptionsGridPage({
  dealId, holdYears, financials, trafficOffline, onAfterPatch,
}: {
  dealId: string;
  holdYears: number;
  financials: DealFinancials | null;
  trafficOffline: boolean;
  onAfterPatch: () => void;
}) {
  const years = useMemo(() => Array.from({ length: holdYears }, (_, i) => i + 1), [holdYears]);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({});
  const [drawer, setDrawer] = useState<DrawerState>(DRAWER_CLOSED);
  const [bulkLayer, setBulkLayer] = useState<'platform' | 'broker' | null>(null);

  const getMode = (key: string): RowMode => rowModes[key] ?? 'flat';

  const getBroker = useCallback((rd: RowDef, yr: number): number | null =>
    financials ? rd.getBroker(financials, yr) : null, [financials]);

  const getPlatform = useCallback((rd: RowDef, yr: number): number | null =>
    financials ? rd.getPlatform(financials, yr) : null, [financials]);

  const getUser = useCallback((key: string, yr: number): number | null =>
    overrides[key]?.[yr] ?? null, [overrides]);

  // Patch + re-fetch
  const patchOverride = useCallback(async (field: string, year: number, value: number | null) => {
    if (!field) return;
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field, year, value });
      onAfterPatch();
    } catch (e) { console.warn('PATCH override failed:', field, year, e); }
  }, [dealId, onAfterPatch]);

  // Apply: flat mode propagates Y1 to all years; stepped is per-year
  const handleApply = useCallback((rowKey: string, year: number, value: number | null, applyAll: boolean) => {
    const rd = ROW_DEFS.find(r => r.key === rowKey);
    if (!rd) return;
    const mode = getMode(rowKey);
    const targetYears = (applyAll || mode === 'flat') ? years : [year];

    setOverrides(prev => {
      const next = { ...prev, [rowKey]: { ...(prev[rowKey] ?? {}) } };
      for (const yr of targetYears) next[rowKey][yr] = value;
      return next;
    });
    if (rd.patchField) {
      for (const yr of targetYears) patchOverride(rd.patchField, yr, value);
    }
  }, [years, getMode, patchOverride]);

  const openDrawer = useCallback((rd: RowDef, yr: number) => {
    if (rd.readonly) return;
    const y1 = financials ? y1Row(financials, rd.patchField ?? rd.key) : null;
    setDrawer({
      open: true, rowKey: rd.key, rowLabel: rd.label, year: yr,
      brokerVal: getBroker(rd, yr),
      platformVal: getPlatform(rd, yr),
      userVal: getUser(rd.key, yr),
      format: rd.format, patchField: rd.patchField ?? null,
      platformSource: rd.platformSource, brokerSource: rd.brokerSource,
      brokerPage: rd.brokerPage ?? '', brokerLine: rd.brokerLine ?? '',
      confidence: financials ? rd.getConfidence(financials) : null,
      unit: rd.unit, description: rd.description ?? '',
      benchmarkP25: rd.benchmarkP25 ?? null, benchmarkP50: rd.benchmarkP50 ?? null, benchmarkP75: rd.benchmarkP75 ?? null,
      benchmarkPosition: y1?.benchmarkPosition ?? null,
    });
  }, [financials, getBroker, getPlatform, getUser]);

  const handleUsePlatform = () => {
    const next: Overrides = { ...overrides };
    for (const rd of ROW_DEFS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = getPlatform(rd, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) patchOverride(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next); setBulkLayer('platform');
  };

  const handleUseBroker = () => {
    const next: Overrides = { ...overrides };
    for (const rd of ROW_DEFS) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = getBroker(rd, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) patchOverride(rd.patchField, yr, v);
        }
      }
    }
    setOverrides(next); setBulkLayer('broker');
  };

  const hasAnyOverride = Object.values(overrides).some(yr =>
    Object.values(yr).some(v => v != null));

  const sectionNums = [1, 2, 3, 4, 5, 6, 7] as const;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto bg-[#0a0a0a]" style={{ minWidth: 0 }}>
        {/* M07 offline banner */}
        {trafficOffline && (
          <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-900/20 border-b border-amber-500/20 text-[10px] text-amber-400 sticky top-0 z-30">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Traffic Engine offline — Section 2 shows Broker layer only. M07 signals unavailable.
          </div>
        )}
        {/* Bulk actions */}
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0d0d0d] border-b border-[#1e1e1e] sticky top-0 z-20">
          <span className="text-[8px] font-bold text-slate-600 tracking-widest">BULK:</span>
          <button onClick={handleUsePlatform}
            className={`px-2 py-0.5 text-[8px] font-bold rounded border ${bulkLayer === 'platform' ? 'border-cyan-500/60 bg-cyan-900/20 text-cyan-400' : 'border-[#1e1e1e] text-slate-600 hover:text-cyan-500'}`}>
            USE ALL PLATFORM
          </button>
          <button onClick={handleUseBroker}
            className={`px-2 py-0.5 text-[8px] font-bold rounded border ${bulkLayer === 'broker' ? 'border-amber-500/60 bg-amber-900/20 text-amber-400' : 'border-[#1e1e1e] text-slate-600 hover:text-amber-500'}`}>
            USE ALL BROKER
          </button>
          {hasAnyOverride && (
            <button onClick={() => { setOverrides({}); setBulkLayer(null); }}
              className="px-2 py-0.5 text-[8px] font-bold rounded border border-red-500/20 text-red-500 hover:border-red-500/50">
              CLEAR OVERRIDES
            </button>
          )}
          <div className="ml-auto flex items-center gap-3 text-[8px] text-slate-700">
            <span><span className="text-blue-500 font-bold">■</span> USER</span>
            <span><span className="text-cyan-500 font-bold">■</span> PLATFORM</span>
            <span><span className="text-amber-500 font-bold">■</span> BROKER</span>
          </div>
        </div>

        {/* Grid */}
        <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
          <thead className="sticky top-[30px] z-10 bg-[#111111]">
            <tr className="border-b border-[#1e1e1e]">
              <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 min-w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
              {years.map(yr => (
                <th key={yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[82px] border-r border-[#1e1e1e]">YR {yr}</th>
              ))}
              <th className="px-2 py-1.5 text-center text-[9px] font-bold text-slate-600 min-w-[60px]">MODE</th>
            </tr>
          </thead>
          <tbody>
            {sectionNums.map(sec => {
              const rows = ROW_DEFS.filter(r => r.section === sec);
              if (!rows.length) return null;
              return (
                <React.Fragment key={sec}>
                  <SectionHeader label={SECTION_LABELS[sec]} colSpan={years.length + 2} />
                  {rows.map(rd => {
                    const isM07Section = sec === 2;
                    const mode = getMode(rd.key);
                    return (
                      <tr key={rd.key} className="border-b border-[#1e1e1e]/50 hover:bg-[#111111]">
                        <td className="px-3 py-0.5 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                          <span className="flex items-center gap-1">
                            {rd.readonly && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                            {isM07Section && !rd.readonly && <span className="text-[7px] text-purple-600 font-bold">M07</span>}
                            <span className="truncate">{rd.label.replace(' (M07 equilibrium)', '')}</span>
                          </span>
                        </td>
                        {years.map(yr => (
                          <LayeredCell
                            key={yr}
                            brokerVal={getBroker(rd, yr)}
                            platformVal={getPlatform(rd, yr)}
                            userVal={getUser(rd.key, yr)}
                            readonly={rd.readonly}
                            format={rd.format}
                            hasM07={isM07Section && getPlatform(rd, yr) != null}
                            onClick={() => openDrawer(rd, yr)}
                          />
                        ))}
                        {/* Row mode selector: Flat / Stepped / Formula */}
                        <td className="px-1 py-0.5 text-center border-r border-[#1e1e1e]">
                          {!rd.readonly && (
                            <div className="flex gap-0.5 justify-center">
                              {(['flat', 'stepped', 'formula'] as RowMode[]).map(m => (
                                <button key={m}
                                  onClick={() => setRowModes(s => ({ ...s, [rd.key]: m }))}
                                  title={m === 'formula' ? 'Formula mode — available in v2' : m === 'flat' ? 'Flat: Y1 value propagated to all years' : 'Stepped: per-year independent values'}
                                  className={`px-1.5 py-0.5 text-[7px] font-bold rounded-sm relative ${
                                    mode === m ? 'bg-blue-600/40 text-blue-400' : 'text-slate-700 hover:text-slate-400'
                                  } ${m === 'formula' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                  disabled={m === 'formula'}
                                >
                                  {m === 'flat' ? 'F' : m === 'stepped' ? 'S' : 'Fx'}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* GPR decomposition after Section 2 */}
                  {sec === 2 && (
                    <GprDecompRow years={years} financials={financials} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <FindingsRail financials={financials} />
      <CellDrawer state={drawer} onClose={() => setDrawer(DRAWER_CLOSED)} onApply={handleApply} />
    </div>
  );
}

// ─── Debt schedule builder ─────────────────────────────────────────────────────
interface DebtYear {
  yr: number; begBalance: number; annualPayment: number;
  interest: number; principal: number; endBalance: number;
  noi: number; dscr: number; ltv: number;
}

function buildDebtSchedule(
  loanAmt: number, rateAnn: number, amortYrs: number, ioYears: number,
  holdYrs: number, noi1: number, noiGrowth: number, purchasePrice: number,
): DebtYear[] {
  const rows: DebtYear[] = [];
  let bal = loanAmt;
  const i30 = rateAnn / 12;
  const n30 = amortYrs * 12;
  const mc = (amortYrs > 0 && i30 > 0)
    ? (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12
    : rateAnn;

  for (let yr = 1; yr <= holdYrs; yr++) {
    const noi = Math.round(noi1 * Math.pow(1 + noiGrowth, yr - 1));
    const isIO = yr <= ioYears;
    const interest = Math.round(bal * rateAnn);
    const payment = isIO ? interest : Math.round(bal * mc);
    const principal = isIO ? 0 : Math.max(0, payment - interest);
    const endBal = Math.round(bal - principal);
    const ltv = purchasePrice > 0 ? endBal / (purchasePrice * Math.pow(1.024, yr - 1)) : 0;
    rows.push({ yr, begBalance: Math.round(bal), annualPayment: payment, interest, principal, endBalance: endBal, noi, dscr: payment > 0 ? noi / payment : 0, ltv });
    bal = endBal;
  }
  return rows;
}

// ─── Tax schedule builder ──────────────────────────────────────────────────────
interface TaxYear {
  yr: number; assessedValue: number; annualTax: number; perUnit: number; taxAsEgiPct: number; delta: number;
}

function buildTaxSchedule(
  currentTax: number, purchasePrice: number, millageRate: number,
  assessmentRatio: number, taxGrowth: number, egi1: number, units: number, holdYrs: number,
): TaxYear[] {
  const rows: TaxYear[] = [];
  const baseAV = Math.round(purchasePrice * assessmentRatio);
  const reassessedTax = Math.round(baseAV * millageRate / 1000);
  const yr1Tax = Math.max(currentTax, reassessedTax);

  for (let yr = 1; yr <= holdYrs; yr++) {
    const tax = Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 1));
    const av = Math.round(baseAV * Math.pow(1 + taxGrowth, yr - 1));
    const pu = units > 0 ? Math.round(tax / units) : 0;
    const egiYr = Math.round(egi1 * Math.pow(1.033, yr - 1));
    rows.push({
      yr, assessedValue: av, annualTax: tax, perUnit: pu,
      taxAsEgiPct: egiYr > 0 ? tax / egiYr : 0,
      delta: yr > 1 ? Math.round(tax - Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 2))) : yr1Tax - currentTax,
    });
  }
  return rows;
}

// ─── DEBT page ─────────────────────────────────────────────────────────────────
function DebtPage({ holdYears, schedule, ioYears, loanAmt, rateAnn, amortYrs, origFee, purchasePrice, maxLtvLoan, maxDscrLoan, sizingConst, mortgageConstant, units }: {
  holdYears: number; schedule: DebtYear[]; ioYears: number; loanAmt: number;
  rateAnn: number; amortYrs: number; origFee: number; purchasePrice: number;
  maxLtvLoan: number; maxDscrLoan: number; sizingConst: number; mortgageConstant: number; units: number;
}) {
  const cols = holdYears + 2;
  const sched = schedule.slice(0, holdYears);
  const dscrType = (d: number): CellType => d >= 1.40 ? 'good' : d >= 1.25 ? 'normal' : d >= 1.15 ? 'warn' : 'flagged';

  return (
    <div className="flex flex-col gap-0 overflow-auto">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'LOAN AMOUNT',      value: fmtM(loanAmt),                    sub: fmt$(units > 0 ? Math.round(loanAmt / units) : loanAmt) + ' / unit' },
          { label: 'INTEREST RATE',    value: fmtPct(rateAnn, 2),               sub: 'Annual rate · fixed' },
          { label: 'STRUCTURE',        value: `${ioYears}YR I/O → ${amortYrs}YR`,   sub: 'Senior fixed-rate' },
          { label: 'ORIGINATION FEE',  value: fmtPct(origFee, 2),               sub: fmt$(Math.round(loanAmt * origFee)) + ' at close' },
          { label: 'LTC',              value: purchasePrice > 0 ? fmtPct(loanAmt / purchasePrice) : '—', sub: `Purchase: ${fmtM(purchasePrice)}` },
          { label: 'MAX LOAN (DSCR)',  value: fmtM(maxDscrLoan),                sub: `@1.25× min DSCR` },
          { label: 'SIZING CONSTRAINT',value: fmtM(sizingConst),                sub: `Selected: ${fmtM(loanAmt)}` },
          { label: 'DEBT CONSTANT',    value: fmtPct(mortgageConstant, 3),      sub: 'Annual payment / loan balance' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">DEBT SERVICE SCHEDULE</th>
            {sched.map(r => (
              <th key={r.yr} className={`px-2 py-1.5 text-right text-[10px] font-bold min-w-[84px] border-r border-[#1e1e1e] ${r.yr <= ioYears ? 'text-amber-500/70' : 'text-slate-500'}`}>
                YR {r.yr}{r.yr <= ioYears ? ' ·IO' : ''}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / AVG</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. BEGINNING BALANCE" colSpan={cols} />
          <Row label="Outstanding Principal">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.begBalance)} />)}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="B. DEBT SERVICE" colSpan={cols} />
          <Row label="Interest Payment" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.interest)} type={r.yr <= ioYears ? 'warn' : 'normal'} />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.interest, 0))} type="computed" />
          </Row>
          <Row label="Principal Payment" locked>
            {sched.map(r => <Cell key={r.yr} v={r.principal === 0 ? '—' : fmtM(r.principal)} type={r.principal === 0 ? 'locked' : 'normal'} />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.principal, 0))} type="computed" />
          </Row>
          <Row label="Total Debt Service">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.annualPayment)} type="computed" />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.annualPayment, 0))} type="computed" />
          </Row>
          <SectionHeader label="C. NOI vs DEBT SERVICE" colSpan={cols} />
          <Row label="Net Operating Income" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.noi)} type="locked" />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.noi, 0))} type="computed" />
          </Row>
          <Row label="Debt Service Coverage (DSCR)">
            {sched.map(r => <Cell key={r.yr} v={fmtX(r.dscr)} type={dscrType(r.dscr)} tooltip={`NOI ${fmtM(r.noi)} ÷ DS ${fmtM(r.annualPayment)}`} />)}
            <Cell v={fmtX(sched.reduce((s, r) => s + r.dscr, 0) / Math.max(sched.length, 1))} type="computed" />
          </Row>
          <Row label="NOI ÷ DS Gap ($)">
            {sched.map(r => {
              const gap = r.noi - r.annualPayment;
              return <Cell key={r.yr} v={(gap > 0 ? '+' : '') + fmtK(gap)} type={gap > 0 ? 'good' : 'warn'} />;
            })}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="D. LOAN BALANCE & LTV" colSpan={cols} />
          <Row label="Ending Balance">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.endBalance)} />)}
            <Cell v={fmtM(sched[sched.length - 1]?.endBalance ?? 0)} type="computed" />
          </Row>
          <Row label="LTV at Year-End">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtPct(r.ltv)} type={r.ltv > 0.75 ? 'warn' : r.ltv > 0.65 ? 'normal' : 'good'} />
            ))}
            <Cell v={fmtPct(sched[sched.length - 1]?.ltv ?? 0)} type="computed" />
          </Row>
          <SectionHeader label="E. LOAN SIZING CONSTRAINTS" colSpan={cols} />
          <Row label="Max Loan by DSCR">
            <Cell v={fmtM(maxDscrLoan)} type={maxDscrLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxDscrLoan >= loanAmt ? '+' : '') + fmtM(maxDscrLoan - loanAmt)} type={maxDscrLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Max Loan by LTV">
            <Cell v={fmtM(maxLtvLoan)} type={maxLtvLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxLtvLoan >= loanAmt ? '+' : '') + fmtM(maxLtvLoan - loanAmt)} type={maxLtvLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Binding Constraint">
            <Cell v={sizingConst === maxDscrLoan ? 'DSCR' : 'LTV'} type="computed" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v={fmtM(sizingConst - loanAmt) + ' gap to limit'} type={sizingConst >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── TAXES page ────────────────────────────────────────────────────────────────
function TaxesPage({ holdYears, schedule, currentTax, assessedValue, millageRate, purchasePrice, reassessAV, units }: {
  holdYears: number; schedule: TaxYear[]; currentTax: number; assessedValue: number;
  millageRate: number | null; purchasePrice: number; reassessAV: number; units: number;
}) {
  const sched = schedule.slice(0, holdYears);
  const reassessmentDelta = Math.round((sched[0]?.annualTax ?? 0) - currentTax);
  const cols = holdYears + 2;
  const AR = 0.40;

  if (!sched.length) {
    return <div className="flex items-center justify-center h-32 text-[11px] text-slate-500">Millage rate unavailable — tax schedule cannot be computed</div>;
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'CURRENT TAX BILL (T12)',  value: fmt$(currentTax),                          sub: units > 0 ? fmt$(Math.round(currentTax / units)) + ' / unit / yr' : '—' },
          { label: 'COUNTY ASSESSED VALUE',   value: fmtM(assessedValue),                      sub: `Assessment ratio: ${(AR * 100).toFixed(0)}%` },
          { label: 'MILLAGE RATE',            value: millageRate != null ? millageRate.toFixed(3) + ' mills' : '—', sub: 'Per $1,000 assessed' },
          { label: 'REASSESSED AT PURCHASE',  value: fmt$(sched[0]?.annualTax ?? 0),            sub: reassessmentDelta > 0 ? '+' + fmt$(reassessmentDelta) + ' vs T12' : '—' },
          { label: 'PURCHASE PRICE',          value: fmtM(purchasePrice),                      sub: '' },
          { label: 'REASSESSED AV',           value: fmtM(reassessAV),                         sub: `Market × ${(AR * 100).toFixed(0)}%` },
          { label: 'TAX GROWTH RATE',         value: '4.0% / yr',                              sub: 'Statutory cap' },
          { label: 'APPEAL STATUS',           value: 'NOT FILED',                              sub: 'Estimated savings if appealed' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>
      {reassessmentDelta > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-500/20 text-[11px] text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Year-1 Tax Shock:</strong> Reassessment expected at purchase.
            Yr1 bill {fmt$(sched[0]?.annualTax ?? 0)} vs T12 {fmt$(currentTax)} → {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)} ({fmtPct(reassessmentDelta / Math.max(currentTax, 1))} increase).
          </span>
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
          <SectionHeader label="A. ASSESSED VALUE TRAJECTORY" colSpan={cols} />
          <Row label="County Assessed Value" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue)} type="locked" />)}
            <Cell v={sched.length > 1 ? fmtPct(Math.pow(sched[sched.length-1].assessedValue / sched[0].assessedValue, 1 / (holdYears - 1)) - 1) : '—'} type="computed" />
          </Row>
          <Row label="Implied Market Value">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue / AR)} type="ai" tooltip="Assessed ÷ assessment ratio" />)}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="B. ANNUAL TAX BILL" colSpan={cols} />
          <Row label="Current T12 Bill" locked>
            {sched.map(r => <Cell key={r.yr} v={r.yr === 1 ? fmt$(currentTax) : '—'} type="locked" />)}
            <Cell v={fmt$(currentTax)} type="locked" />
          </Row>
          <Row label="Pro Forma Tax Bill">
            {sched.map(r => (
              <Cell key={r.yr} v={fmt$(r.annualTax)} type={r.yr === 1 && reassessmentDelta > 0 ? 'flagged' : 'normal'} />
            ))}
            <Cell v={fmt$(sched.reduce((s, r) => s + r.annualTax, 0))} type="computed" />
          </Row>
          <SectionHeader label="C. TAX BURDEN RATIOS" colSpan={cols} />
          <Row label="Tax / Unit / Year">
            {sched.map(r => <Cell key={r.yr} v={fmt$(r.perUnit)} tooltip={`${fmt$(r.annualTax)} ÷ ${units} units`} />)}
            <Cell v={fmt$(sched[sched.length - 1]?.perUnit ?? 0)} type="computed" />
          </Row>
          <Row label="Tax as % of EGI">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtPct(r.taxAsEgiPct)} type={r.taxAsEgiPct > 0.16 ? 'warn' : r.taxAsEgiPct > 0.13 ? 'normal' : 'good'} />
            ))}
            <Cell v={fmtPct(sched.reduce((s, r) => s + r.taxAsEgiPct, 0) / Math.max(sched.length, 1))} type="computed" />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────
type Page = 'GRID' | 'DEBT' | 'TAXES';
type HoldTab = '5 YR' | '7 YR' | '10 YR';

const PAGE_NAV: Array<{ id: Page; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'GRID',  label: 'Assumptions Grid',  icon: <BarChart3  className="w-3.5 h-3.5" />, color: 'text-slate-300' },
  { id: 'DEBT',  label: 'Debt',              icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-400' },
  { id: 'TAXES', label: 'Real Estate Tax',   icon: <Building2  className="w-3.5 h-3.5" />, color: 'text-amber-400' },
];

export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [page, setPage]         = useState<Page>('GRID');
  const [holdTab, setHoldTab]   = useState<HoldTab | null>(null); // null = use DB holdYears
  const [financials, setFinancials] = useState<DealFinancials | null>(null);
  const [trafficOffline, setTrafficOffline] = useState(false);
  const [loading, setLoading]   = useState(false);
  const fetchCountRef = useRef(0);

  // Derive hold years: user tab override > DB value > default 5
  const dbHoldYears = financials?.assumptions?.holdYears ?? 5;
  const holdYears = holdTab === '5 YR' ? 5 : holdTab === '7 YR' ? 7 : holdTab === '10 YR' ? 10 : dbHoldYears;

  // Fetch financials from API (called on mount and after each PATCH)
  const fetchFinancials = useCallback(async (hold?: number) => {
    if (!dealId) return;
    const h = hold ?? holdYears;
    fetchCountRef.current++;
    const thisFetch = fetchCountRef.current;
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/financials?hold=${h}`);
      if (thisFetch !== fetchCountRef.current) return; // stale
      const data: DealFinancials = res.data?.data ?? res.data;
      if (data?.proforma) {
        setFinancials(data);
        setTrafficOffline(!data.trafficProjection?.yearly?.length);
      }
    } catch (e) {
      if (thisFetch === fetchCountRef.current) {
        console.warn('AssumptionsTab: financials fetch failed', e);
        setTrafficOffline(true);
      }
    } finally {
      if (thisFetch === fetchCountRef.current) setLoading(false);
    }
  }, [dealId, holdYears]);

  // Mount: fetch financials
  useEffect(() => { fetchFinancials(); }, [dealId]);

  // When hold tab changes: re-fetch with new hold period
  useEffect(() => { if (holdTab !== null) fetchFinancials(holdYears); }, [holdTab]);

  // Called after each PATCH to re-fetch derived values
  const handleAfterPatch = useCallback(() => {
    fetchFinancials(holdYears);
  }, [fetchFinancials, holdYears]);

  // Derive values from props (for Debt/Tax sub-pages)
  const a = assumptions;
  const cs = financials?.capitalStack;
  const dealName = (deal?.['name'] as string) ?? financials?.dealName ?? a?.dealInfo?.dealName ?? 'Deal';
  const units = financials?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0;
  const city  = a?.dealInfo?.city ?? '';
  const state = a?.dealInfo?.state ?? '';
  const location = [city, state].filter(Boolean).join(', ') || 'Location';

  const loanAmt       = cs?.loanAmount ?? a?.financing?.loanAmount ?? 0;
  const rateAnn       = cs?.interestRate ?? a?.financing?.interestRate ?? 0.0675;
  const amortYrs      = cs?.amortizationYears ?? a?.financing?.amortization ?? 30;
  const ioYears       = cs?.ioPeriodMonths != null ? Math.round(cs.ioPeriodMonths / 12) : Math.round((a?.financing?.ioPeriod ?? 0) / 12);
  const origFee       = cs?.originationFeePct ?? a?.financing?.originationFee ?? 0.01;
  const purchasePrice = cs?.purchasePrice ?? a?.acquisition?.purchasePrice ?? 0;

  const acfRows   = modelResults?.annualCashFlow ?? [];
  const noi1      = acfRows[0]?.noi ?? 3_730_000;
  const noiGrowth = 0.034;

  const MIN_DSCR = 1.25;
  const MAX_LTV  = 0.65;
  const i30 = rateAnn / 12;
  const n30 = amortYrs * 12;
  const mortgageConstant = (amortYrs > 0 && i30 > 0)
    ? (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12
    : rateAnn;
  const maxDscrLoan = mortgageConstant > 0 ? Math.round((noi1 / MIN_DSCR) / mortgageConstant) : 0;
  const maxLtvLoan  = purchasePrice > 0 ? Math.round(purchasePrice * MAX_LTV) : 0;
  const sizingConst = Math.min(maxDscrLoan || Infinity, maxLtvLoan || Infinity);

  const debtSchedule = useMemo(() => {
    if (!loanAmt || !rateAnn) return [];
    return buildDebtSchedule(loanAmt, rateAnn, amortYrs, ioYears, holdYears, noi1, noiGrowth, purchasePrice);
  }, [loanAmt, rateAnn, amortYrs, ioYears, holdYears, noi1, purchasePrice]);

  const currentTax    = (a?.taxes?.currentReTax as number | null | undefined) ?? 0;
  const assessedValue = purchasePrice > 0 ? Math.round(purchasePrice * 0.40) : 0;
  const millageRate   = (a?.taxes?.millageRate as number | null | undefined) ?? null;
  const reassessAV    = assessedValue;
  const egi1          = noi1 * 1.3;

  const taxSchedule = useMemo(() => {
    if (!millageRate) return [];
    return buildTaxSchedule(currentTax, purchasePrice || 0, millageRate, 0.40, 0.04, egi1, units, holdYears);
  }, [currentTax, purchasePrice, millageRate, egi1, units, holdYears]);

  const totalDS    = debtSchedule.reduce((s, r) => s + r.annualPayment, 0);
  const minDSCR    = debtSchedule.length > 0 ? Math.min(...debtSchedule.map(r => r.dscr)) : 0;
  const minDSCRYr  = debtSchedule.length > 0 ? debtSchedule.reduce((mi, r, i) => r.dscr < debtSchedule[mi].dscr ? i : mi, 0) + 1 : 0;
  const endBalance = debtSchedule.length > 0 ? (debtSchedule[debtSchedule.length - 1]?.endBalance ?? 0) : 0;
  const irr        = modelResults?.summary?.irr ?? 0;
  const em         = modelResults?.summary?.equityMultiple ?? 0;
  const exitValue  = modelResults?.summary?.exitValue ?? 0;
  const reassessmentDelta = Math.round((taxSchedule[0]?.annualTax ?? 0) - currentTax);

  const m07Conf = financials?.trafficProjection?.leasingSignals?.confidence;

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100 tracking-wider text-[11px]">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[10px]">
            <span className="text-slate-400">{dealName}</span>
            {units > 0 && <><span className="text-slate-600">|</span><span className="text-slate-400">{units} Units</span></>}
            {location !== 'Location' && <><span className="text-slate-600">|</span><span className="text-slate-400">{location}</span></>}
          </div>
          {m07Conf != null && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-500/20 rounded text-[9px]">
              <Zap className="w-2.5 h-2.5" />
              M07 · {m07Conf}% conf
            </div>
          )}
          {loading && <span style={{ fontFamily: MONO, fontSize: 8, color: '#22d3ee' }}>SYNCING…</span>}
        </div>
        <div className="flex items-center gap-3">
          {/* Hold period tabs — default from DB, override with tabs */}
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(['5 YR', '7 YR', '10 YR'] as HoldTab[]).map(tab => {
              const active = holdTab === tab || (holdTab === null && holdYears === (tab === '5 YR' ? 5 : tab === '7 YR' ? 7 : 10));
              return (
                <button key={tab} onClick={() => setHoldTab(tab)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-sm ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {tab}
                </button>
              );
            })}
          </div>
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
      <div className="flex items-center gap-0 px-4 py-0 bg-[#0d0d0d] border-b border-[#1e1e1e]">
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
        <div className="ml-auto flex items-center gap-3 pr-2 text-[10px] text-slate-600">
          {page === 'DEBT' && loanAmt > 0 && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded" style={{ fontFamily: MONO }}>{ioYears}YR I/O</span>
              <span>MC: {fmtPct(mortgageConstant, 3)}</span>
              {minDSCR > 0 && <span className={minDSCR >= 1.25 ? 'text-green-500' : 'text-amber-500'}>Min DSCR: {fmtX(minDSCR)} YR{minDSCRYr}</span>}
            </>
          )}
          {page === 'TAXES' && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded" style={{ fontFamily: MONO }}>{millageRate} MILLS</span>
              <span>T12: {fmt$(currentTax)}</span>
              <span className={reassessmentDelta > 5000 ? 'text-amber-500' : 'text-green-500'}>
                {reassessmentDelta > 0 ? '↑ +' + fmt$(reassessmentDelta) : 'No reassess delta'}
              </span>
            </>
          )}
          {page === 'GRID' && trafficOffline && (
            <span className="text-amber-500">⚠ Traffic Engine offline</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-[#0a0a0a] relative">
        {page === 'GRID' && (
          <AssumptionsGridPage
            dealId={dealId}
            holdYears={holdYears}
            financials={financials}
            trafficOffline={trafficOffline}
            onAfterPatch={handleAfterPatch}
          />
        )}
        {page === 'DEBT' && (
          <div className="overflow-auto h-full">
            {loanAmt > 0 ? (
              <DebtPage
                holdYears={holdYears} schedule={debtSchedule} ioYears={ioYears}
                loanAmt={loanAmt} rateAnn={rateAnn} amortYrs={amortYrs} origFee={origFee}
                purchasePrice={purchasePrice} maxLtvLoan={maxLtvLoan} maxDscrLoan={maxDscrLoan}
                sizingConst={sizingConst === Infinity ? 0 : sizingConst} mortgageConstant={mortgageConstant}
                units={units}
              />
            ) : (
              <div className="flex items-center justify-center h-32 text-[11px] text-slate-500">
                No loan configured — set loan amount and rate in Financing assumptions
              </div>
            )}
          </div>
        )}
        {page === 'TAXES' && (
          <div className="overflow-auto h-full">
            <TaxesPage
              holdYears={holdYears} schedule={taxSchedule} currentTax={currentTax}
              assessedValue={assessedValue} millageRate={millageRate}
              purchasePrice={purchasePrice || 0} reassessAV={reassessAV} units={units}
            />
          </div>
        )}
      </div>

      {/* Bottom summary bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
          {page === 'GRID' && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">IRR LEVERED</span>
                <span className={`text-sm font-mono ${irr > 0.15 ? 'text-green-400' : irr > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {irr > 0 ? fmtPct(irr) : '—'}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
                <span className="text-sm font-mono text-slate-200">{em > 0 ? fmtX(em) : '—'}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">HOLD</span>
                <span className="text-sm font-mono text-slate-200">{holdYears} YR</span>
              </div>
            </>
          )}
          {page === 'DEBT' && totalDS > 0 && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL DEBT SERVICE</span>
                <span className="text-sm font-mono text-slate-200">{fmtM(totalDS)}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">MIN DSCR</span>
                <span className={`text-sm font-mono ${minDSCR >= 1.25 ? 'text-green-400' : 'text-amber-400'}`}>
                  {fmtX(minDSCR)} YR{minDSCRYr}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">ENDING BALANCE</span>
                <span className="text-sm font-mono text-slate-200">{endBalance > 0 ? fmtM(endBalance) : '—'}</span>
              </div>
            </>
          )}
          {page === 'TAXES' && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL TAX (HOLD)</span>
                <span className="text-sm font-mono text-slate-200">{fmt$(taxSchedule.slice(0, holdYears).reduce((s, r) => s + r.annualTax, 0))}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">YR-1 TAX BILL</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 10000 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {fmt$(taxSchedule[0]?.annualTax ?? 0)}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">REASSESSMENT Δ</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <TrendingUp className="w-3 h-3" />
          <span style={{ fontFamily: MONO }}>F9 · {holdYears}YR · {financials?.meta?.seeded ? 'SEEDED' : 'PROPS'}</span>
        </div>
      </div>
    </div>
  );
}

export default AssumptionsTab;
