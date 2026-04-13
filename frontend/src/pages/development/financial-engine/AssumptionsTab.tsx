import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Lock, Download, AlertTriangle, TrendingUp, Building2, DollarSign,
  BarChart3, ChevronRight, X, Info, Zap, ChevronDown,
} from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import type { AnnualCashFlowRow } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";

type CellType = 'normal' | 'ai' | 'override' | 'm07' | 'locked' | 'flagged' | 'computed'
  | 'warn' | 'good' | 'header';

const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
const fmtK = (n: number) => '$' + Math.round(n / 1000).toLocaleString() + 'K';
const fmtPct2 = (n: number, dec = 1) => (n * 100).toFixed(dec) + '%';

// ─── Traffic API types ─────────────────────────────────────────────────────────
interface TrafficYearData {
  year: number;
  weeklyTours: number;
  weeklyApps: number;
  weeklyLeases: number;
  closingRatio: number;
  occPct: number;
  effRent: number;
  annualLeases: number;
  turnover: number;
  confidence: number;
}

interface TrafficHandoff {
  rawTraffic: TrafficYearData[];
  occupancyTrajectory: { year: number; occ: number; vacancy: number; confidence: number }[];
  rentTrajectory: { year: number; effRent: number; growth: number; confidence: number }[];
  leasingVelocity: { weeklyLeases: number; annualized: number; confidence: number };
  leaseUpTimeline?: { weeksTo95: number; weeksTo93: number; weeksTo90: number } | null;
  modelConfidence: number;
  dataWeeks?: number;
  lastCalibrated?: string;
}

// ─── Layer source + cell state ─────────────────────────────────────────────────
type LayerSource = 'broker' | 'platform' | 'user';

interface CellKey { rowKey: string; year: number }

interface DrawerState {
  open: boolean;
  rowKey: string;
  rowLabel: string;
  year: number;
  brokerVal: number | null;
  platformVal: number | null;
  userVal: number | null;
  format: (n: number) => string;
  patchField: string | null;
  platformSource: string;
  brokerSource: string;
  confidence: number | null;
  unit: string;
  description: string;
}

const DRAWER_CLOSED: DrawerState = {
  open: false, rowKey: '', rowLabel: '', year: 1,
  brokerVal: null, platformVal: null, userVal: null,
  format: n => String(n), patchField: null,
  platformSource: '', brokerSource: '', confidence: null, unit: '', description: '',
};

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
  brokerGetter?: (a: FinancialEngineTabProps['assumptions'], yr: number) => number | null;
  platformGetter?: (t: TrafficHandoff | null, cf: AnnualCashFlowRow[], yr: number) => number | null;
  confidence?: (t: TrafficHandoff | null) => number | null;
  platformSource?: string;
  brokerSource?: string;
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

const ROW_DEFS: RowDef[] = [
  // ── Section 1: Revenue — Rent Side ──────────────────────────────────────
  {
    key: 'avgRent', label: 'Avg Rent / Unit / Mo', section: 1, unit: '$',
    format: n => fmt$(n),
    patchField: 'avgRentPerUnit',
    description: 'Average effective rent per unit per month across all unit types',
    brokerGetter: (a, yr) => {
      const cf = null; // not needed for this calculation
      const baseRent = a?.revenue ? (() => {
        const rg = a.revenue.rentGrowth ?? [];
        const mix = a.unitMix ?? [];
        const totalUnits = a.dealInfo?.totalUnits ?? 0;
        if (!totalUnits) return null;
        const wtdRent = mix.reduce((s, r) => s + (r.inPlaceRent ?? 0) * r.units, 0) / totalUnits;
        if (!wtdRent) return null;
        let v = wtdRent;
        for (let i = 0; i < yr - 1; i++) v *= (1 + (rg[i] ?? 0.03));
        return Math.round(v);
      })() : null;
      return baseRent;
    },
    platformGetter: (t, cf, yr) => {
      const row = cf[yr - 1];
      if (!row) return null;
      const units = cf.length > 0 ? null : null; // derive from GPR if available
      if (row.gpr && t?.rawTraffic?.[yr - 1]) {
        return null; // use rent trajectory instead
      }
      if (t?.rentTrajectory?.[yr - 1]) {
        return Math.round(t.rentTrajectory[yr - 1].effRent);
      }
      return null;
    },
    confidence: t => t?.modelConfidence ?? null,
    platformSource: 'M07 Traffic Engine — Rent Trajectory',
    brokerSource: 'OM / Broker In-Place Rent',
  },
  {
    key: 'rentGrowth', label: 'Rent Growth %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'rentGrowthPct',
    description: 'YoY effective rent growth rate. Platform = Traffic Engine eff-rent trajectory CAGR.',
    brokerGetter: (a, yr) => a?.revenue?.rentGrowth?.[yr - 1] ?? null,
    platformGetter: (t, _cf, yr) => {
      const traj = t?.rentTrajectory;
      if (!traj || yr < 2) return null;
      const curr = traj[yr - 1]?.effRent;
      const prev = traj[yr - 2]?.effRent;
      if (curr && prev && prev > 0) return (curr / prev) - 1;
      if (traj[yr - 1]?.growth) return traj[yr - 1].growth / 100;
      return null;
    },
    confidence: t => t?.modelConfidence ?? null,
    platformSource: 'M07 Traffic Engine — Rent Trajectory CAGR',
    brokerSource: 'OM / Broker Rent Growth',
  },
  {
    key: 'lossToLease', label: 'Loss-to-Lease %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'lossToLeasePct',
    description: 'Market rent minus in-place rent as % of market rent. Narrows as leases roll.',
    brokerGetter: (a, _yr) => a?.revenue?.lossToLease ?? 0.03,
    platformGetter: (_t, _cf, _yr) => 0.025,
    confidence: _t => 60,
    platformSource: 'JEDI Platform — Submarket Avg',
    brokerSource: 'OM / Broker Assumption',
  },
  {
    key: 'concessions', label: 'Concessions %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'concessionsPct',
    description: 'Free rent / net effective concessions as % of GPR',
    brokerGetter: (_a, _yr) => 0.005,
    platformGetter: (_t, cf, yr) => {
      const row = cf[yr - 1];
      return row ? 0.005 : null;
    },
    confidence: _t => 55,
    platformSource: 'JEDI Platform — Traffic velocity inference',
    brokerSource: 'OM / Broker Assumption',
  },
  {
    key: 'badDebt', label: 'Bad Debt / Collection Loss %', section: 1, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'badDebtPct',
    description: 'Non-payment and collection losses as % of GPR',
    brokerGetter: (a, _yr) => a?.revenue?.collectionLoss ?? 0.015,
    platformGetter: (_t, _cf, _yr) => 0.012,
    confidence: _t => 50,
    platformSource: 'JEDI Platform — Local collections data',
    brokerSource: 'OM / Broker Assumption',
  },
  {
    key: 'otherIncome', label: 'Other Income / Unit / Mo', section: 1, unit: '$',
    format: n => '$' + n.toFixed(0),
    patchField: 'otherIncomePerUnit',
    description: 'Non-rent ancillary income (parking, storage, RUBS, etc.)',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, cf, yr) => {
      const row = cf[yr - 1];
      return row?.otherIncome ? Math.round(row.otherIncome / 12) : null;
    },
    confidence: _t => 65,
    platformSource: 'JEDI Platform — Historical ancillary data',
    brokerSource: 'OM / Broker Other Income',
  },
  // ── Section 2: Traffic / Demand ─────────────────────────────────────────
  {
    key: 't01WeeklyTours', label: 'T-01 Walk-Ins / Week', section: 2, unit: '/wk',
    format: n => n.toFixed(1) + '/wk',
    patchField: 't01WeeklyTours',
    description: 'Total walk-in / inbound tour volume per week. M07 real-time. Primary demand signal.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, yr) => t?.rawTraffic?.[yr - 1]?.weeklyTours ?? null,
    confidence: t => t?.rawTraffic?.[0]?.confidence ?? null,
    platformSource: 'M07 Traffic Engine — T-01 Signal',
    brokerSource: 'N/A — traffic signal',
  },
  {
    key: 't05ClosingRatio', label: 'T-05 Conversion %', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 't05ClosingRatio',
    description: 'Tours → leases conversion rate. T-05 signal. Higher = better demand quality.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, yr) => {
      const raw = t?.rawTraffic?.[yr - 1];
      return raw?.closingRatio ? raw.closingRatio / 100 : null;
    },
    confidence: t => t?.rawTraffic?.[0]?.confidence ?? null,
    platformSource: 'M07 Traffic Engine — T-05 Signal',
    brokerSource: 'N/A — traffic signal',
  },
  {
    key: 't06CaptureRate', label: 'T-06 Capture Rate %', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 't06CaptureRate',
    description: 'Property capture of submarket renter demand. >avg = demand pull. Signal T-06.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => null,
    platformSource: 'M07 Traffic Engine — T-06 Signal',
    brokerSource: 'N/A — traffic signal',
  },
  {
    key: 't07Trajectory', label: 'T-07 Trajectory %', section: 2, unit: '%',
    format: n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%',
    patchField: 't07Trajectory',
    description: 'Demand trajectory YoY change. Positive = accelerating demand. Signal T-07.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, yr) => {
      const curr = t?.rawTraffic?.[yr - 1]?.weeklyTours;
      const prev = t?.rawTraffic?.[yr - 2]?.weeklyTours;
      if (curr != null && prev != null && prev > 0) return (curr / prev) - 1;
      return null;
    },
    confidence: t => t?.rawTraffic?.[0]?.confidence ?? null,
    platformSource: 'M07 Traffic Engine — T-07 Signal (derived)',
    brokerSource: 'N/A — traffic signal',
  },
  {
    key: 'derivedVacancy', label: 'Derived Vacancy % ⟨locked⟩', section: 2, unit: '%',
    readonly: true,
    format: n => (n * 100).toFixed(2) + '%',
    description: 'Derived from T-01 × T-05 equilibrium. Read-only when cap binding.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, yr) => {
      const occ = t?.occupancyTrajectory?.[yr - 1]?.occ;
      return occ != null ? (100 - occ) / 100 : null;
    },
    confidence: t => t?.modelConfidence ?? null,
    platformSource: 'M07 Traffic Engine — equilibrium vacancy model',
    brokerSource: 'N/A — derived',
  },
  {
    key: 'stabilizedOcc', label: 'Stabilized Occupancy Target', section: 2, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 'vacancyPct',
    description: 'Long-run stabilized occupancy. Platform sets from traffic equilibrium model.',
    brokerGetter: (a, _yr) => a?.revenue?.stabilizedOccupancy ?? null,
    platformGetter: (t, _cf, yr) => {
      const occ = t?.occupancyTrajectory?.[yr - 1]?.occ;
      return occ != null ? occ / 100 : null;
    },
    confidence: t => t?.modelConfidence ?? null,
    platformSource: 'M07 Traffic Engine — Occupancy Trajectory',
    brokerSource: 'OM / Broker Stabilized Occ',
  },
  {
    key: 'leaseUpCurve', label: 'Lease-Up Curve (Weeks to 95%)', section: 2, unit: 'wks',
    format: n => Math.round(n) + ' wks',
    description: 'Weeks for the property to reach 95% occupancy. Dev deals primary constraint.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, _yr) => t?.leaseUpTimeline?.weeksTo95 ?? null,
    confidence: t => t?.modelConfidence ?? null,
    platformSource: 'M07 Traffic Engine — Lease-Up Timeline',
    brokerSource: 'OM / Broker Lease-Up Estimate',
  },
  {
    key: 'renovTrafficLift', label: 'Renovation Traffic Lift %', section: 2, unit: '%',
    format: n => (n * 100).toFixed(0) + '%',
    patchField: 'renovTrafficLift',
    description: 'Expected % increase in traffic volume from unit renovations. Value-add specific.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, _cf, _yr) => 0.12,
    confidence: _t => 45,
    platformSource: 'JEDI Platform — Value-add renovation lift model',
    brokerSource: 'OM / Broker Renovation Estimate',
  },
  // ── Section 3: Expense Assumptions ──────────────────────────────────────
  {
    key: 'payroll', label: 'Payroll / Property Mgmt', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'payroll',
    description: 'On-site payroll and property management per unit per year',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, cf, yr) => {
      const row = cf[yr - 1];
      return row ? null : null;
    },
    confidence: _t => 60,
    platformSource: 'JEDI Platform — Submarket OpEx benchmark',
    brokerSource: 'OM / T12 Operating Statement',
  },
  {
    key: 'repairsMaint', label: 'Repairs & Maintenance', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'repairsMaintenance',
    description: 'Routine R&M per unit per year. Excludes CapEx.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 55,
    platformSource: 'JEDI Platform — Property Class benchmark',
    brokerSource: 'OM / T12 Operating Statement',
  },
  {
    key: 'utilities', label: 'Utilities', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'utilities',
    description: 'Owner-paid utilities per unit per year (water, gas, electric)',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 60,
    platformSource: 'JEDI Platform — Utility benchmark by market',
    brokerSource: 'OM / T12 Operating Statement',
  },
  {
    key: 'mgmtFeePct', label: 'Management Fee %', section: 3, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'managementFeePct',
    description: 'Third-party property management fee as % of EGI',
    brokerGetter: (a, _yr) => {
      const mgmt = (a?.expenses?.['management'] as { amount?: number } | undefined);
      return mgmt?.amount ?? 0.035;
    },
    platformGetter: (_t, _cf, _yr) => 0.04,
    confidence: _t => 70,
    platformSource: 'JEDI Platform — Market management fee avg',
    brokerSource: 'OM / T12 Operating Statement',
  },
  {
    key: 'insurance', label: 'Insurance', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'insurance',
    description: 'Hazard, liability, and specialty insurance per unit per year',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 65,
    platformSource: 'JEDI Platform — Insurance benchmark',
    brokerSource: 'OM / T12 Operating Statement',
  },
  {
    key: 'reTax', label: 'Real Estate Taxes', section: 3, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'realEstateTax',
    description: 'Annual property tax bill per unit. Reassessment at purchase may create Year-1 shock.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, cf, yr) => {
      const row = cf[yr - 1];
      return row ? null : null;
    },
    confidence: _t => 75,
    platformSource: 'JEDI Platform — County millage model',
    brokerSource: 'OM / T12 RE Tax Line',
  },
  {
    key: 'opexGrowth', label: 'OpEx Growth %', section: 3, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    patchField: 'opexGrowthPct',
    description: 'YoY total operating expense growth. CPI + spread.',
    brokerGetter: (_a, _yr) => 0.03,
    platformGetter: (_t, _cf, _yr) => 0.03,
    confidence: _t => 65,
    platformSource: 'JEDI Platform — CPI + 50bps',
    brokerSource: 'OM / Broker OpEx Assumption',
  },
  // ── Section 4: CapEx / Reserves ─────────────────────────────────────────
  {
    key: 'totalCapex', label: 'Total CapEx Budget', section: 4, unit: '$',
    format: n => fmtM(n),
    description: 'Total capital expenditure budget including contingency',
    brokerGetter: (a, _yr) => {
      const items = a?.capex?.lineItems ?? [];
      const cont = a?.capex?.contingencyPct ?? 0.05;
      const tot = items.reduce((s, i) => s + i.amount, 0);
      return tot > 0 ? Math.round(tot * (1 + cont)) : null;
    },
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 50,
    platformSource: 'JEDI Platform — Renovation scope model',
    brokerSource: 'OM / Broker CapEx Estimate',
  },
  {
    key: 'capexPerUnit', label: 'CapEx / Unit', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    description: 'CapEx per unit. Benchmark: value-add $10K–$30K/unit.',
    brokerGetter: (a, _yr) => {
      const items = a?.capex?.lineItems ?? [];
      const cont = a?.capex?.contingencyPct ?? 0.05;
      const tot = items.reduce((s, i) => s + i.amount, 0);
      const units = a?.dealInfo?.totalUnits ?? 0;
      return (tot > 0 && units > 0) ? Math.round(tot * (1 + cont) / units) : null;
    },
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 50,
    platformSource: 'JEDI Platform — Value-add comp database',
    brokerSource: 'OM / Broker CapEx Estimate',
  },
  {
    key: 'reserves', label: 'Replacement Reserves / Unit / Yr', section: 4, unit: '$/unit',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'replacementReserves',
    description: 'Annual replacement reserves. Typical: $150–$350/unit for stabilized.',
    brokerGetter: (a, _yr) => a?.capex?.reservesPerUnit ?? null,
    platformGetter: (_t, _cf, _yr) => 250,
    confidence: _t => 70,
    platformSource: 'JEDI Platform — Industry reserve standard',
    brokerSource: 'OM / Broker Reserves',
  },
  // ── Section 5: Debt Assumptions ─────────────────────────────────────────
  {
    key: 'interestRate', label: 'Interest Rate', section: 5, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    description: 'Senior loan fixed / base rate',
    brokerGetter: (a, _yr) => a?.financing?.interestRate ?? null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 80,
    platformSource: 'JEDI Platform — SOFR + spread',
    brokerSource: 'OM / Debt term sheet',
  },
  {
    key: 'ltv', label: 'LTC / LTV %', section: 5, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    description: 'Loan-to-cost or loan-to-value at closing',
    brokerGetter: (a, _yr) => {
      const loan = a?.financing?.loanAmount;
      const price = a?.acquisition?.purchasePrice;
      return (loan && price && price > 0) ? loan / price : null;
    },
    platformGetter: (_t, _cf, _yr) => 0.65,
    confidence: _t => 75,
    platformSource: 'JEDI Platform — Market LTV norms',
    brokerSource: 'OM / Debt term sheet',
  },
  {
    key: 'ioPeriod', label: 'Interest-Only Period (mo)', section: 5, unit: 'mo',
    format: n => Math.round(n) + ' mo',
    description: 'Months of interest-only payments before amortization begins',
    brokerGetter: (a, _yr) => a?.financing?.ioPeriod ?? null,
    platformGetter: (_t, _cf, _yr) => null,
    confidence: _t => 80,
    platformSource: 'JEDI Platform — Lender market norms',
    brokerSource: 'OM / Debt term sheet',
  },
  // ── Section 6: Exit Assumptions ─────────────────────────────────────────
  {
    key: 'exitCapRate', label: 'Exit Cap Rate', section: 6, unit: '%',
    format: n => (n * 100).toFixed(2) + '%',
    patchField: 'exitCapRate',
    description: 'Terminal cap rate applied to final-year NOI to derive sale price',
    brokerGetter: (a, _yr) => a?.disposition?.exitCapRate ?? null,
    platformGetter: (t, _cf, _yr) => {
      if (!t) return null;
      return t.modelConfidence > 75 ? 0.053 : 0.055;
    },
    confidence: t => t ? 60 : null,
    platformSource: 'M07 Traffic — Demand velocity implies cap compression',
    brokerSource: 'OM / Broker Exit Cap Assumption',
  },
  {
    key: 'sellingCosts', label: 'Selling Costs %', section: 6, unit: '%',
    format: n => (n * 100).toFixed(1) + '%',
    description: 'Brokerage, legal, and transfer costs at disposition',
    brokerGetter: (a, _yr) => a?.disposition?.sellingCosts ?? 0.02,
    platformGetter: (_t, _cf, _yr) => 0.02,
    confidence: _t => 80,
    platformSource: 'JEDI Platform — Market transaction cost norms',
    brokerSource: 'OM / Broker Disposition Cost',
  },
  {
    key: 'holdPeriod', label: 'Hold Period (Yrs)', section: 6, unit: 'yrs',
    format: n => Math.round(n) + ' yrs',
    description: 'Target hold period in years. Changes grid column count.',
    brokerGetter: (a, _yr) => a?.holdPeriod ?? 5,
    platformGetter: (_t, _cf, _yr) => 5,
    confidence: _t => 60,
    platformSource: 'JEDI Platform — Strategy default',
    brokerSource: 'OM / Broker Investment Horizon',
  },
  // ── Section 7: Strategy-Specific ────────────────────────────────────────
  {
    key: 'targetAfterRepairRent', label: 'Target After-Repair Rent', section: 7, unit: '$',
    format: n => '$' + Math.round(n).toLocaleString(),
    patchField: 'afterRepairRent',
    description: 'Target in-place rent after value-add renovation. Value-add strategy only.',
    brokerGetter: (_a, _yr) => null,
    platformGetter: (t, _cf, yr) => {
      if (!t) return null;
      return t.rentTrajectory?.[yr - 1]?.effRent ? Math.round(t.rentTrajectory[yr - 1].effRent * 1.08) : null;
    },
    confidence: _t => 50,
    platformSource: 'M07 Traffic — Rent trajectory + renovation premium',
    brokerSource: 'OM / Broker Renovation Target',
  },
  {
    key: 'leaseUpVelocity', label: 'Lease-Up Velocity (leases/mo)', section: 7, unit: '/mo',
    format: n => Math.round(n) + '/mo',
    description: 'Monthly net leasing velocity target during lease-up period',
    brokerGetter: (a, _yr) => a?.development?.leaseUpVelocity ?? null,
    platformGetter: (t, _cf, _yr) => {
      const wkly = t?.leasingVelocity?.weeklyLeases;
      return wkly ? Math.round(wkly * 4.33) : null;
    },
    confidence: t => t?.leasingVelocity?.confidence ?? null,
    platformSource: 'M07 Traffic Engine — Weekly lease velocity',
    brokerSource: 'OM / Broker Lease-Up Projection',
  },
];

// ─── Shared cell renderer (existing style, used for Debt/Tax sub-pages) ────────
function Cell({ v, type = 'normal', span, align = 'right', tooltip }: {
  v: string; type?: CellType; span?: number; align?: 'right' | 'left' | 'center'; tooltip?: string;
}) {
  const base = 'relative px-2 py-1 text-[10px] font-mono tabular-nums border-r border-[#1e1e1e] group ';
  const alignCls = align === 'left' ? 'text-left ' : align === 'center' ? 'text-center ' : 'text-right ';
  const variants: Record<CellType, string> = {
    normal:   'text-slate-300 hover:border hover:border-blue-500/50 hover:bg-[#1e1e1e] cursor-text ',
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
    <td className={base + alignCls + variants[type]} colSpan={span} title={tooltip}>
      {v}
    </td>
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

  const divergence = (hasPlatform && hasUser && platformVal !== 0)
    ? Math.abs((userVal! - platformVal) / Math.abs(platformVal))
    : 0;

  const bgClass = divergence > 0.05 ? 'bg-red-900/15 ' : divergence > 0.01 ? 'bg-amber-900/10 ' : '';

  return (
    <td
      onClick={readonly ? undefined : onClick}
      className={`relative px-2 py-0.5 border-r border-[#1e1e1e] min-w-[80px] align-top
        ${readonly ? 'cursor-default' : 'cursor-pointer hover:border hover:border-blue-500/40'}
        ${bgClass}
      `}
    >
      {hasM07 && <sup className="absolute top-[2px] right-[2px] text-[6px] text-purple-500 font-bold">M07</sup>}
      {readonly && <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-700" />}
      {hasUser && (
        <div className="text-[9px] font-mono font-bold text-blue-400 leading-[1.2]">{format(userVal!)}</div>
      )}
      {hasPlatform && (
        <div className={`text-[9px] font-mono leading-[1.2] ${hasUser ? 'text-cyan-700' : 'text-cyan-400 font-bold'}`}>
          {format(platformVal!)}
        </div>
      )}
      {hasBroker && (
        <div className={`text-[9px] font-mono leading-[1.2] ${(hasUser || hasPlatform) ? 'text-amber-800' : 'text-amber-400 font-bold'}`}>
          {format(brokerVal!)}
        </div>
      )}
      {!hasUser && !hasPlatform && !hasBroker && (
        <div className="text-[9px] font-mono text-slate-700">—</div>
      )}
    </td>
  );
}

// ─── Cell Drawer ───────────────────────────────────────────────────────────────
interface CellDrawerProps {
  state: DrawerState;
  onClose: () => void;
  onApply: (rowKey: string, year: number, value: number | null, applyAll: boolean) => void;
}

function CellDrawer({ state, onClose, onApply }: CellDrawerProps) {
  const [draft, setDraft] = useState('');
  const [activeLayer, setActiveLayer] = useState<LayerSource>('platform');
  const [applyAll, setApplyAll] = useState(false);

  useEffect(() => {
    if (state.open) {
      setDraft(state.userVal != null ? state.format(state.userVal).replace(/[^0-9.-]/g, '') : '');
      setActiveLayer(state.userVal != null ? 'user' : state.platformVal != null ? 'platform' : 'broker');
      setApplyAll(false);
    }
  }, [state.open, state.rowKey, state.year]);

  const handleApply = () => {
    if (activeLayer === 'user') {
      const n = parseFloat(draft);
      if (!isNaN(n)) {
        // Convert percent inputs (e.g. "3.5" → 0.035 for % fields)
        const normalized = state.unit === '%' ? n / 100 : n;
        onApply(state.rowKey, state.year, normalized, applyAll);
      }
    } else if (activeLayer === 'platform' && state.platformVal != null) {
      onApply(state.rowKey, state.year, state.platformVal, applyAll);
    } else if (activeLayer === 'broker' && state.brokerVal != null) {
      onApply(state.rowKey, state.year, state.brokerVal, applyAll);
    }
    onClose();
  };

  const handleClear = () => {
    onApply(state.rowKey, state.year, null, applyAll);
    onClose();
  };

  if (!state.open) return null;

  const displayActive = activeLayer === 'user' ? state.userVal : activeLayer === 'platform' ? state.platformVal : state.brokerVal;

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, zIndex: 100,
        background: BT.bg.panel, borderLeft: `1px solid #1e1e1e`,
        display: 'flex', flexDirection: 'column', fontFamily: MONO,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 12px', background: '#111', borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5 }}>{state.rowLabel}</div>
          <div style={{ fontSize: 9, color: '#64748b' }}>Year {state.year} · {state.unit}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Layer toggle */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#64748b', letterSpacing: 0.5, marginBottom: 6 }}>SELECT ACTIVE LAYER</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['platform', 'broker', 'user'] as LayerSource[]).map(layer => {
            const val = layer === 'platform' ? state.platformVal : layer === 'broker' ? state.brokerVal : state.userVal;
            const color = layer === 'user' ? '#3b82f6' : layer === 'platform' ? '#22d3ee' : '#f59e0b';
            const label = layer === 'user' ? 'USER' : layer === 'platform' ? 'PLATFORM' : 'BROKER';
            return (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                disabled={val == null && layer !== 'user'}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 9, fontFamily: MONO, fontWeight: 700,
                  border: `1px solid ${activeLayer === layer ? color : '#1e1e1e'}`,
                  background: activeLayer === layer ? `${color}18` : 'transparent',
                  color: activeLayer === layer ? color : '#475569',
                  borderRadius: 2, cursor: 'pointer',
                }}
              >
                {label}
                {val != null && (
                  <div style={{ fontSize: 8, fontWeight: 400, color: activeLayer === layer ? color : '#334155' }}>
                    {state.format(val)}
                  </div>
                )}
                {val == null && layer !== 'user' && (
                  <div style={{ fontSize: 8, color: '#1e293b' }}>—</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {state.description && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 8, color: '#94a3b8', lineHeight: 1.5 }}>{state.description}</div>
        </div>
      )}

      {/* Platform source */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 3 }}>PLATFORM SOURCE</div>
        <div style={{ fontSize: 9, color: '#22d3ee' }}>{state.platformSource || 'JEDI Platform'}</div>
        {state.confidence != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <div style={{
              height: 4, flex: 1, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${state.confidence}%`,
                background: state.confidence > 80 ? '#10b981' : state.confidence > 60 ? '#f59e0b' : '#ef4444',
                borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 8, color: '#64748b' }}>{state.confidence}% conf</span>
          </div>
        )}
      </div>

      {/* Broker source */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 8, color: '#f59e0b80', letterSpacing: 0.5, marginBottom: 3 }}>BROKER SOURCE</div>
        <div style={{ fontSize: 9, color: '#f59e0b' }}>{state.brokerSource || 'OM / Broker Assumption'}</div>
      </div>

      {/* User override input (shown when USER layer is active) */}
      {activeLayer === 'user' && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 8, color: '#3b82f680', letterSpacing: 0.5, marginBottom: 4 }}>YOUR OVERRIDE</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
              placeholder={state.unit === '%' ? 'e.g. 3.5 (%)' : 'value'}
              style={{
                flex: 1, fontFamily: MONO, fontSize: 11, color: '#3b82f6', fontWeight: 700,
                background: '#0f172a', border: '1px solid #3b82f6', borderRadius: 2,
                padding: '4px 8px', outline: 'none',
              }}
            />
            <span style={{ fontSize: 9, color: '#64748b' }}>{state.unit}</span>
          </div>
        </div>
      )}

      {/* Apply-to-all toggle */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e1e' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={applyAll}
            onChange={e => setApplyAll(e.target.checked)}
            style={{ width: 12, height: 12 }}
          />
          <span style={{ fontSize: 9, color: '#64748b' }}>Apply to all years in hold period</span>
        </label>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 12px', marginTop: 'auto', display: 'flex', gap: 6 }}>
        {state.userVal != null && (
          <button
            onClick={handleClear}
            style={{
              fontFamily: MONO, fontSize: 9, padding: '5px 10px', borderRadius: 2, cursor: 'pointer',
              background: 'none', border: '1px solid #334155', color: '#64748b',
            }}
          >CLEAR OVERRIDE</button>
        )}
        <button
          onClick={handleApply}
          style={{
            flex: 1, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '5px 10px',
            borderRadius: 2, cursor: 'pointer',
            background: '#3b82f6', border: 'none', color: '#fff',
          }}
        >APPLY</button>
      </div>
    </div>
  );
}

// ─── GPR Decomposition Row ────────────────────────────────────────────────────
function GprDecompRow({
  years, units, baseRent, rentGrowths, trafficVacancy, brokerVacancy, userOverrides,
  format,
}: {
  years: number; units: number; baseRent: number; rentGrowths: number[]; trafficVacancy: (number | null)[];
  brokerVacancy: number; userOverrides: Record<number, number | null>; format: (n: number) => string;
}) {
  const gprRows = Array.from({ length: years }, (_, i) => {
    const yr = i + 1;
    const rent = baseRent * rentGrowths.slice(0, i).reduce((acc, g) => acc * (1 + g), 1);
    const gpr = Math.round(rent * units * 12);
    const trafVac = trafficVacancy[i] ?? brokerVacancy;
    const rentComp = Math.round(gpr * (1 - brokerVacancy));
    const trafficComp = Math.round(gpr * (brokerVacancy - trafVac));
    const derivedGpr = Math.round(gpr * (1 - trafVac));
    return { yr, gpr, rentComp, trafficComp, derivedGpr };
  });

  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-amber-500/20 bg-amber-900/10 hover:bg-amber-900/20 cursor-pointer h-[26px]"
        onClick={() => setExpanded(x => !x)}
      >
        <td className="px-3 py-1 text-[10px] font-bold text-amber-400 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10 min-w-[220px]">
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            GPR DECOMPOSITION ▸ click to expand
          </span>
        </td>
        {gprRows.map(r => (
          <td key={r.yr} className="px-2 py-1 text-right text-[10px] font-bold font-mono tabular-nums text-amber-400 border-r border-[#1e1e1e]">
            {format(r.derivedGpr)}
          </td>
        ))}
        <td className="px-2 py-1 text-right text-[10px] font-mono text-slate-600">—</td>
      </tr>
      {expanded && (
        <>
          <tr className="border-b border-[#1e1e1e]/40 h-[20px]">
            <td className="pl-8 pr-3 py-0.5 text-[9px] text-cyan-600 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">Rent Component (no vacancy)</td>
            {gprRows.map(r => (
              <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] font-mono text-cyan-600 border-r border-[#1e1e1e]">{format(r.rentComp)}</td>
            ))}
            <td />
          </tr>
          <tr className="border-b border-[#1e1e1e]/40 h-[20px]">
            <td className="pl-8 pr-3 py-0.5 text-[9px] text-purple-500 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">Traffic Lift Component (M07 vacancy tightening)</td>
            {gprRows.map(r => (
              <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] font-mono text-purple-500 border-r border-[#1e1e1e]">{r.trafficComp > 0 ? '+' : ''}{format(r.trafficComp)}</td>
            ))}
            <td />
          </tr>
          <tr className="border-b border-amber-500/20 h-[20px]">
            <td className="pl-8 pr-3 py-0.5 text-[9px] font-bold text-amber-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10">= Derived GPR</td>
            {gprRows.map(r => (
              <td key={r.yr} className="px-2 py-0.5 text-right text-[9px] font-bold font-mono text-amber-400 border-r border-[#1e1e1e]">{format(r.derivedGpr)}</td>
            ))}
            <td />
          </tr>
        </>
      )}
    </>
  );
}

// ─── Assumptions Grid Page ─────────────────────────────────────────────────────
function AssumptionsGridPage({
  dealId, assumptions, modelResults, holdYears, trafficData, trafficOffline,
}: {
  dealId: string;
  assumptions: FinancialEngineTabProps['assumptions'];
  modelResults: FinancialEngineTabProps['modelResults'];
  holdYears: number;
  trafficData: TrafficHandoff | null;
  trafficOffline: boolean;
}) {
  const years = Array.from({ length: holdYears }, (_, i) => i + 1);
  const cols = holdYears + 2;

  // User overrides state: { [rowKey]: { [year]: value | null } }
  const [overrides, setOverrides] = useState<Record<string, Record<number, number | null>>>({});
  // Row modes: { [rowKey]: 'flat' | 'stepped' }
  const [rowModes, setRowModes] = useState<Record<string, 'flat' | 'stepped'>>({});
  // Drawer state
  const [drawer, setDrawer] = useState<DrawerState>(DRAWER_CLOSED);
  // Saving state
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // Active layer for bulk actions
  const [bulkLayer, setBulkLayer] = useState<LayerSource | null>(null);

  const a = assumptions;
  const cf = modelResults?.annualCashFlow ?? [];

  const getMode = (rowKey: string): 'flat' | 'stepped' => rowModes[rowKey] ?? 'flat';

  const getBrokerVal = useCallback((rowDef: RowDef, yr: number): number | null => {
    return rowDef.brokerGetter?.(a, yr) ?? null;
  }, [a]);

  const getPlatformVal = useCallback((rowDef: RowDef, yr: number): number | null => {
    return rowDef.platformGetter?.(trafficData, cf, yr) ?? null;
  }, [trafficData, cf]);

  const getUserVal = useCallback((rowKey: string, yr: number): number | null => {
    return overrides[rowKey]?.[yr] ?? null;
  }, [overrides]);

  const getEffectiveVal = useCallback((rowDef: RowDef, yr: number): number | null => {
    const userVal = getUserVal(rowDef.key, yr);
    if (userVal != null) return userVal;
    return getPlatformVal(rowDef, yr) ?? getBrokerVal(rowDef, yr);
  }, [getUserVal, getPlatformVal, getBrokerVal]);

  // Patch API call
  const patchOverride = useCallback(async (field: string, year: number, value: number | null) => {
    if (!field) return;
    const saveKey = `${field}:${year}`;
    setSaving(s => ({ ...s, [saveKey]: true }));
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field, year, value });
    } catch (e) {
      console.error('Patch override failed:', e);
    } finally {
      setSaving(s => { const n = { ...s }; delete n[saveKey]; return n; });
    }
  }, [dealId]);

  // Apply value from drawer
  const handleApply = useCallback((rowKey: string, year: number, value: number | null, applyAll: boolean) => {
    const rowDef = ROW_DEFS.find(r => r.key === rowKey);
    if (!rowDef) return;

    const targetYears = applyAll ? years : [year];
    const newOverrides = { ...overrides };
    if (!newOverrides[rowKey]) newOverrides[rowKey] = {};

    for (const yr of targetYears) {
      newOverrides[rowKey][yr] = value;
      if (rowDef.patchField) {
        patchOverride(rowDef.patchField, yr, value);
      }
    }
    setOverrides(newOverrides);
  }, [overrides, years, patchOverride]);

  // Open drawer for a cell
  const openDrawer = useCallback((rowDef: RowDef, yr: number) => {
    if (rowDef.readonly) return;
    setDrawer({
      open: true,
      rowKey: rowDef.key,
      rowLabel: rowDef.label,
      year: yr,
      brokerVal: getBrokerVal(rowDef, yr),
      platformVal: getPlatformVal(rowDef, yr),
      userVal: getUserVal(rowDef.key, yr),
      format: rowDef.format,
      patchField: rowDef.patchField ?? null,
      platformSource: rowDef.platformSource ?? '',
      brokerSource: rowDef.brokerSource ?? '',
      confidence: rowDef.confidence?.(trafficData) ?? null,
      unit: rowDef.unit,
      description: rowDef.description ?? '',
    });
  }, [getBrokerVal, getPlatformVal, getUserVal, trafficData]);

  // Bulk: Use all Platform
  const handleUsePlatform = () => {
    const newOverrides = { ...overrides };
    for (const rowDef of ROW_DEFS) {
      if (rowDef.readonly) continue;
      for (const yr of years) {
        const platformVal = getPlatformVal(rowDef, yr);
        if (platformVal != null) {
          if (!newOverrides[rowDef.key]) newOverrides[rowDef.key] = {};
          newOverrides[rowDef.key][yr] = platformVal;
          if (rowDef.patchField) patchOverride(rowDef.patchField, yr, platformVal);
        }
      }
    }
    setOverrides(newOverrides);
    setBulkLayer('platform');
  };

  // Bulk: Use all Broker
  const handleUseBroker = () => {
    const newOverrides = { ...overrides };
    for (const rowDef of ROW_DEFS) {
      if (rowDef.readonly) continue;
      for (const yr of years) {
        const brokerVal = getBrokerVal(rowDef, yr);
        if (brokerVal != null) {
          if (!newOverrides[rowDef.key]) newOverrides[rowDef.key] = {};
          newOverrides[rowDef.key][yr] = brokerVal;
          if (rowDef.patchField) patchOverride(rowDef.patchField, yr, brokerVal);
        }
      }
    }
    setOverrides(newOverrides);
    setBulkLayer('broker');
  };

  // Bulk: Lock user overrides (clears overrides)
  const handleLockOverrides = () => {
    setOverrides({});
    setBulkLayer(null);
  };

  const hasAnyOverride = Object.values(overrides).some(yr => Object.values(yr).some(v => v != null));

  // Group rows by section
  const sectionNums = [1, 2, 3, 4, 5, 6, 7] as const;

  // Derived values for GPR decomposition
  const units = a?.dealInfo?.totalUnits ?? 0;
  const baseRent = (() => {
    const mix = a?.unitMix ?? [];
    const u = a?.dealInfo?.totalUnits ?? 0;
    if (!u || mix.length === 0) return cf[0]?.gpr ? Math.round(cf[0].gpr / u / 12) : 1800;
    return Math.round(mix.reduce((s, r) => s + r.inPlaceRent * r.units, 0) / u);
  })();
  const rentGrowths = a?.revenue?.rentGrowth ?? Array(holdYears).fill(0.03);
  const trafficVacancy = years.map(yr => trafficData?.occupancyTrajectory?.[yr - 1]?.occ != null
    ? (100 - trafficData.occupancyTrajectory[yr - 1].occ) / 100 : null);
  const brokerVacancy = 1 - (a?.revenue?.stabilizedOccupancy ?? 0.94);

  return (
    <div className="flex h-full">
      {/* Main grid */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]" style={{ minWidth: 0 }}>
        {/* M07 offline banner */}
        {trafficOffline && (
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-500/30 text-[11px] text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Traffic Engine offline</strong> — Section 2 using Broker values only.
              M07 occupancy trajectory and rent trajectory unavailable.
            </span>
          </div>
        )}

        {/* Bulk actions bar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0d0d] border-b border-[#1e1e1e] sticky top-0 z-20">
          <span className="text-[9px] font-bold text-slate-500 tracking-wider mr-2">BULK:</span>
          <button
            onClick={handleUsePlatform}
            className={`px-3 py-1 text-[9px] font-bold rounded border transition-colors ${bulkLayer === 'platform' ? 'border-cyan-500 bg-cyan-900/30 text-cyan-400' : 'border-[#1e1e1e] text-slate-500 hover:text-cyan-400 hover:border-cyan-500/40'}`}
          >USE ALL PLATFORM</button>
          <button
            onClick={handleUseBroker}
            className={`px-3 py-1 text-[9px] font-bold rounded border transition-colors ${bulkLayer === 'broker' ? 'border-amber-500 bg-amber-900/30 text-amber-400' : 'border-[#1e1e1e] text-slate-500 hover:text-amber-400 hover:border-amber-500/40'}`}
          >USE ALL BROKER</button>
          {hasAnyOverride && (
            <button
              onClick={handleLockOverrides}
              className="px-3 py-1 text-[9px] font-bold rounded border border-red-500/30 text-red-400 hover:border-red-500/60"
            >CLEAR ALL OVERRIDES</button>
          )}
          <div className="ml-auto flex items-center gap-4 text-[8px] text-slate-700">
            <span><span className="text-blue-400 font-bold">■</span> USER</span>
            <span><span className="text-cyan-400 font-bold">■</span> PLATFORM</span>
            <span><span className="text-amber-400 font-bold">■</span> BROKER</span>
          </div>
        </div>

        {/* Grid table */}
        <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
          <thead className="sticky top-[37px] z-10 bg-[#111111]">
            <tr className="border-b border-[#1e1e1e]">
              <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">
                ASSUMPTION
              </th>
              {years.map(yr => (
                <th key={yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px] border-r border-[#1e1e1e]">
                  YR {yr}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">
                MODE
              </th>
            </tr>
          </thead>
          <tbody>
            {sectionNums.map(section => {
              const rows = ROW_DEFS.filter(r => r.section === section);
              if (rows.length === 0) return null;
              return (
                <React.Fragment key={section}>
                  <SectionHeader label={SECTION_LABELS[section]} colSpan={cols} />
                  {rows.map(rowDef => {
                    const isM07 = section === 2;
                    const mode = getMode(rowDef.key);
                    return (
                      <tr key={rowDef.key} className="border-b border-[#1e1e1e]/50 hover:bg-[#111111]">
                        <td className="px-3 py-0.5 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                          <span className="flex items-center gap-1">
                            {rowDef.readonly && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                            {isM07 && !rowDef.readonly && (
                              <span className="text-[7px] text-purple-500 font-bold">M07</span>
                            )}
                            <span className="truncate">{rowDef.label.replace(' ⟨locked⟩', '')}</span>
                          </span>
                        </td>
                        {years.map(yr => (
                          <LayeredCell
                            key={yr}
                            brokerVal={getBrokerVal(rowDef, yr)}
                            platformVal={getPlatformVal(rowDef, yr)}
                            userVal={getUserVal(rowDef.key, yr)}
                            readonly={rowDef.readonly}
                            format={rowDef.format}
                            hasM07={isM07 && getPlatformVal(rowDef, yr) != null}
                            onClick={() => openDrawer(rowDef, yr)}
                          />
                        ))}
                        {/* Mode selector */}
                        <td className="px-2 py-0.5 text-center border-r border-[#1e1e1e]">
                          {!rowDef.readonly && (
                            <div className="flex gap-0.5 justify-center">
                              {(['flat', 'stepped'] as const).map(m => (
                                <button
                                  key={m}
                                  onClick={() => setRowModes(s => ({ ...s, [rowDef.key]: m }))}
                                  className={`px-1.5 py-0.5 text-[8px] font-bold rounded-sm ${mode === m ? 'bg-blue-600/40 text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                  {m === 'flat' ? 'F' : 'S'}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* GPR Decomposition after Section 2 */}
                  {section === 2 && units > 0 && (
                    <GprDecompRow
                      years={holdYears}
                      units={units}
                      baseRent={baseRent}
                      rentGrowths={rentGrowths}
                      trafficVacancy={trafficVacancy}
                      brokerVacancy={brokerVacancy}
                      userOverrides={overrides}
                      format={n => fmt$(n)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right rail — Findings narrative (collapsible) */}
      <FindingsRail trafficData={trafficData} holdYears={holdYears} />

      {/* Cell drawer overlay */}
      <CellDrawer state={drawer} onClose={() => setDrawer(DRAWER_CLOSED)} onApply={handleApply} />
    </div>
  );
}

// ─── Findings Narrative Right Rail ────────────────────────────────────────────
function FindingsRail({ trafficData, holdYears }: { trafficData: TrafficHandoff | null; holdYears: number }) {
  const [expanded, setExpanded] = useState(true);

  if (!expanded) {
    return (
      <div
        className="w-8 bg-[#0d0d0d] border-l border-[#1e1e1e] flex items-start justify-center pt-4 cursor-pointer"
        onClick={() => setExpanded(true)}
      >
        <span style={{ writingMode: 'vertical-rl', fontSize: 9, color: '#475569', letterSpacing: 0.5, fontFamily: MONO }}>
          FINDINGS ▸
        </span>
      </div>
    );
  }

  const conf = trafficData?.modelConfidence;
  const yr1Rent = trafficData?.rentTrajectory?.[0]?.effRent;
  const yr1Occ = trafficData?.occupancyTrajectory?.[0]?.occ;
  const yr1Vacancy = yr1Occ != null ? (100 - yr1Occ).toFixed(1) : null;
  const rentGrowthY1 = trafficData?.rentTrajectory?.[0]?.growth;

  return (
    <div className="w-[220px] bg-[#0d0d0d] border-l border-[#1e1e1e] flex flex-col overflow-hidden shrink-0">
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#111111] border-b border-[#1e1e1e] cursor-pointer"
        onClick={() => setExpanded(false)}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
          AI FINDINGS
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>◂ collapse</span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3" style={{ fontFamily: MONO }}>
        {!trafficData ? (
          <div className="text-[9px] text-slate-600">Traffic Engine offline. No AI findings available.</div>
        ) : (
          <>
            {/* Confidence */}
            <div>
              <div className="text-[8px] text-slate-600 mb-1 tracking-wider">MODEL CONFIDENCE</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${conf ?? 0}%`,
                      background: (conf ?? 0) > 80 ? '#10b981' : (conf ?? 0) > 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300">{conf ?? 0}%</span>
              </div>
            </div>

            {/* Key metrics */}
            {yr1Rent && (
              <div>
                <div className="text-[8px] text-cyan-500 mb-1">Y1 EFF RENT</div>
                <div className="text-sm font-bold text-slate-200">${yr1Rent.toLocaleString()}</div>
                {rentGrowthY1 && <div className="text-[8px] text-green-500">+{rentGrowthY1.toFixed(1)}% YoY growth</div>}
              </div>
            )}
            {yr1Vacancy && (
              <div>
                <div className="text-[8px] text-cyan-500 mb-1">Y1 VACANCY</div>
                <div className="text-sm font-bold text-slate-200">{yr1Vacancy}%</div>
                <div className="text-[8px] text-slate-600">Traffic-derived equilibrium</div>
              </div>
            )}

            {/* Narrative */}
            <div>
              <div className="text-[8px] text-cyan-500 mb-2 tracking-wider">RENT GROWTH</div>
              <div className="text-[9px] text-slate-400 leading-relaxed">
                Traffic Engine projects{' '}
                <span className="text-green-400 font-bold">{rentGrowthY1?.toFixed(1) ?? '—'}%</span> Y1 rent growth,
                tapering over the {holdYears}-year hold period.
                {(trafficData.rentTrajectory?.length ?? 0) > 0 && (
                  <> Y{holdYears} eff rent: <span className="text-slate-300 font-bold">${(trafficData.rentTrajectory[holdYears - 1]?.effRent ?? 0).toLocaleString()}</span>.</>
                )}
              </div>
            </div>

            <div>
              <div className="text-[8px] text-cyan-500 mb-2 tracking-wider">TRAFFIC TRAJECTORY</div>
              <div className="text-[9px] text-slate-400 leading-relaxed">
                {trafficData.leasingVelocity?.weeklyLeases != null
                  ? `${trafficData.leasingVelocity.weeklyLeases.toFixed(1)} leases/wk → ${trafficData.leasingVelocity.annualized} annualized. `
                  : 'No leasing velocity data. '}
                {yr1Vacancy
                  ? `Y1 vacancy ${yr1Vacancy}% (traffic-derived). `
                  : ''}
              </div>
            </div>

            {/* Data quality */}
            <div className="border-t border-[#1e1e1e] pt-3">
              <div className="text-[8px] text-slate-600 mb-1">DATA QUALITY</div>
              {trafficData.dataWeeks && (
                <div className="text-[9px] text-slate-500">{trafficData.dataWeeks} weeks of traffic data</div>
              )}
              {trafficData.lastCalibrated && (
                <div className="text-[9px] text-slate-600">Calibrated: {trafficData.lastCalibrated}</div>
              )}
            </div>
          </>
        )}
      </div>
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
  const mc = amortYrs > 0
    ? (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12
    : rateAnn;

  for (let yr = 1; yr <= holdYrs; yr++) {
    const noi = Math.round(noi1 * Math.pow(1 + noiGrowth, yr - 1));
    const isIO = yr <= ioYears;
    const interest = Math.round(bal * rateAnn);
    const payment = isIO ? interest : Math.round(bal * mc);
    const principal = isIO ? 0 : Math.max(0, payment - interest);
    const endBal = Math.round(bal - principal);
    const ltv = endBal / (purchasePrice * Math.pow(1.024, yr - 1));
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
  const reassessAV = Math.round(purchasePrice * assessmentRatio);
  const reassessedTax = Math.round(reassessAV * millageRate / 1000);
  const yr1Tax = Math.max(currentTax, reassessedTax);
  const baseAV = Math.round(purchasePrice * assessmentRatio);

  for (let yr = 1; yr <= holdYrs; yr++) {
    const tax = Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 1));
    const av = Math.round(baseAV * Math.pow(1 + taxGrowth, yr - 1));
    const pu = Math.round(tax / units);
    const egiYr = Math.round(egi1 * Math.pow(1 + 0.033, yr - 1));
    rows.push({
      yr, assessedValue: av, annualTax: tax, perUnit: pu,
      taxAsEgiPct: tax / egiYr,
      delta: yr > 1 ? Math.round(tax - Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 2))) : yr1Tax - currentTax,
    });
  }
  return rows;
}

// ─── DEBT page ─────────────────────────────────────────────────────────────────
function DebtPage({ holdYears, schedule, ioYears, loanAmt, rateAnn, amortYrs, origFee, purchasePrice, maxLtvLoan, maxDscrLoan, sizingConst, mortgageConstant, units }: {
  holdYears: number; schedule: DebtYear[]; ioYears: number; loanAmt: number;
  rateAnn: number; amortYrs: number; origFee: number; purchasePrice: number;
  maxLtvLoan: number; maxDscrLoan: number; sizingConst: number; mortgageConstant: number;
  units: number;
}) {
  const cols = holdYears + 2;
  const sched = schedule.slice(0, holdYears);
  const dscrType = (d: number): CellType => d >= 1.40 ? 'good' : d >= 1.25 ? 'normal' : d >= 1.15 ? 'warn' : 'flagged';

  return (
    <div className="flex flex-col gap-0 overflow-auto">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'LOAN AMOUNT',      value: fmtM(loanAmt),                   sub: fmt$(units > 0 ? Math.round(loanAmt / units) : loanAmt) + ' / unit' },
          { label: 'INTEREST RATE',    value: (rateAnn * 100).toFixed(2) + '%', sub: 'Annual rate · fixed' },
          { label: 'STRUCTURE',        value: `${ioYears}YR I/O → ${amortYrs}YR`,  sub: 'Senior fixed-rate' },
          { label: 'ORIGINATION FEE',  value: (origFee * 100).toFixed(2) + '%', sub: fmt$(Math.round(loanAmt * origFee)) + ' at close' },
          { label: 'LTC',              value: fmtPct2(loanAmt / purchasePrice), sub: `Purchase: ${fmtM(purchasePrice)}` },
          { label: 'MAX LOAN (DSCR)',  value: fmtM(maxDscrLoan),               sub: `@1.25× min DSCR` },
          { label: 'SIZING CONSTRAINT',value: fmtM(sizingConst),               sub: `Selected: ${fmtM(loanAmt)} (${fmtPct2(loanAmt / sizingConst)} of max)` },
          { label: 'DEBT CONSTANT',    value: fmtPct2(mortgageConstant, 3),    sub: 'Annual payment / loan balance' },
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
            {sched.map(r => (
              <Cell key={r.yr} v={fmtX(r.dscr)} type={dscrType(r.dscr)} tooltip={`NOI ${fmtM(r.noi)} ÷ DS ${fmtM(r.annualPayment)}`} />
            ))}
            <Cell v={fmtX(sched.reduce((s, r) => s + r.dscr, 0) / sched.length)} type="computed" />
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
              <Cell key={r.yr} v={fmtPct2(r.ltv)} type={r.ltv > 0.75 ? 'warn' : r.ltv > 0.65 ? 'normal' : 'good'} tooltip={`Balance ${fmtM(r.endBalance)} ÷ Projected Value`} />
            ))}
            <Cell v={fmtPct2(sched[sched.length - 1]?.ltv ?? 0)} type="computed" />
          </Row>
          <SectionHeader label="E. MAX LOAN SIZING" colSpan={cols} />
          <tr className="border-b border-[#1e1e1e]/50 h-[22px] bg-[#0a0a1e]/40">
            <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a1e]/60 border-r border-[#1e1e1e] z-10 min-w-[220px]" />
            <Cell v="CONSTRAINT" type="header" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v="HEADROOM vs ACTUAL" type="header" align="center" span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </tr>
          <Row label="Max Loan by DSCR">
            <Cell v={fmtM(maxDscrLoan)} type={maxDscrLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxDscrLoan >= loanAmt ? '+' : '') + fmtM(maxDscrLoan - loanAmt) + ' vs actual'} type={maxDscrLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Max Loan by LTV">
            <Cell v={fmtM(maxLtvLoan)} type={maxLtvLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxLtvLoan >= loanAmt ? '+' : '') + fmtM(maxLtvLoan - loanAmt) + ' vs actual'} type={maxLtvLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
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
  const ASSESSMENT_RATIO = 0.40;

  if (sched.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-slate-500">
        Millage rate unavailable — tax schedule cannot be computed
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'CURRENT TAX BILL (T12)',  value: fmt$(currentTax),                        sub: fmt$(Math.round(currentTax / units)) + ' / unit / yr' },
          { label: 'COUNTY ASSESSED VALUE',   value: fmtM(assessedValue),                    sub: `Assessment ratio: ${(ASSESSMENT_RATIO * 100).toFixed(0)}% of market` },
          { label: 'MILLAGE RATE',            value: millageRate != null ? millageRate.toFixed(3) + ' mills' : '—', sub: 'Per $1,000 of assessed value' },
          { label: 'REASSESSED AT PURCHASE',  value: fmt$(sched[0]?.annualTax ?? 0),          sub: reassessmentDelta > 0 ? '+' + fmt$(reassessmentDelta) + ' vs T12' : fmt$(Math.abs(reassessmentDelta)) + ' savings vs T12' },
          { label: 'PURCHASE PRICE',          value: fmtM(purchasePrice),                    sub: '' },
          { label: 'REASSESSED AV',           value: fmtM(reassessAV),                       sub: `Market × assessment ratio (${(ASSESSMENT_RATIO * 100).toFixed(0)}%)` },
          { label: 'TAX GROWTH RATE',         value: '4.0% / yr',                            sub: 'Statutory cap' },
          { label: 'APPEAL STATUS',           value: 'NOT FILED',                            sub: 'Est. savings if appealed' },
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
            <strong>Year-1 Tax Shock:</strong> Purchase triggers reassessment.
            Expected Yr1 bill {fmt$(sched[0]?.annualTax ?? 0)} vs current T12 {fmt$(currentTax)} → delta{' '}
            {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)} ({fmtPct2(reassessmentDelta / currentTax)} increase).
          </span>
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">REAL ESTATE TAX SCHEDULE</th>
            {sched.map(r => (
              <th key={r.yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[84px] border-r border-[#1e1e1e]">YR {r.yr}</th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / CAGR</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. ASSESSED VALUE TRAJECTORY" colSpan={cols} />
          <Row label="County Assessed Value" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue)} type="locked" />)}
            <Cell v={sched.length > 1 ? fmtPct2(Math.pow(sched[sched.length-1].assessedValue / sched[0].assessedValue, 1 / (holdYears - 1)) - 1) : '—'} type="computed" />
          </Row>
          <Row label="Implied Market Value">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue / ASSESSMENT_RATIO)} type="ai" tooltip="Assessed ÷ 40% assessment ratio" />)}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="B. ANNUAL TAX BILL" colSpan={cols} />
          <Row label="Current T12 Bill (baseline)" locked>
            {sched.map(r => <Cell key={r.yr} v={r.yr === 1 ? fmt$(currentTax) : '—'} type="locked" />)}
            <Cell v={fmt$(currentTax)} type="locked" />
          </Row>
          <Row label="Pro Forma Tax Bill">
            {sched.map(r => (
              <Cell key={r.yr} v={fmt$(r.annualTax)} type={r.yr === 1 && reassessmentDelta > 0 ? 'flagged' : 'normal'} />
            ))}
            <Cell v={fmt$(sched.reduce((s, r) => s + r.annualTax, 0))} type="computed" />
          </Row>
          <Row label="YoY Tax Increase ($)">
            {sched.map(r => (
              <Cell key={r.yr} v={r.yr === 1 ? (reassessmentDelta > 0 ? '+' + fmtK(reassessmentDelta) : fmtK(reassessmentDelta)) : '+' + fmtK(r.delta)}
                type={r.yr === 1 && reassessmentDelta > 5000 ? 'warn' : 'normal'} />
            ))}
            <Cell v={fmtK((sched[sched.length - 1]?.annualTax ?? 0) - (sched[0]?.annualTax ?? 0))} type="computed" />
          </Row>
          <SectionHeader label="C. TAX BURDEN RATIOS" colSpan={cols} />
          <Row label="Tax / Unit / Year">
            {sched.map(r => <Cell key={r.yr} v={fmt$(r.perUnit)} tooltip={`${fmt$(r.annualTax)} ÷ ${units} units`} />)}
            <Cell v={fmt$(sched[sched.length - 1]?.perUnit ?? 0)} type="computed" />
          </Row>
          <Row label="Tax as % of EGI">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtPct2(r.taxAsEgiPct)}
                type={r.taxAsEgiPct > 0.16 ? 'warn' : r.taxAsEgiPct > 0.13 ? 'normal' : 'good'} />
            ))}
            <Cell v={fmtPct2(sched.reduce((s, r) => s + r.taxAsEgiPct, 0) / sched.length)} type="computed" />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-page types ────────────────────────────────────────────────────────────
type Page = 'GRID' | 'DEBT' | 'TAXES';
type HoldYears = '5 YR' | '7 YR' | '10 YR';

const PAGE_NAV: Array<{ id: Page; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'GRID',  label: 'Assumptions Grid',  icon: <BarChart3  className="w-3.5 h-3.5" />, color: 'text-slate-300' },
  { id: 'DEBT',  label: 'Debt',              icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-400' },
  { id: 'TAXES', label: 'Real Estate Tax',   icon: <Building2  className="w-3.5 h-3.5" />, color: 'text-amber-400' },
];

// ─── Root component ────────────────────────────────────────────────────────────
export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [page, setPage]       = useState<Page>('GRID');
  const [holdTab, setHoldTab] = useState<HoldYears>('10 YR');
  const holdYears = holdTab === '5 YR' ? 5 : holdTab === '7 YR' ? 7 : 10;

  // Traffic data
  const [trafficData, setTrafficData]     = useState<TrafficHandoff | null>(null);
  const [trafficOffline, setTrafficOffline] = useState(false);

  const a = assumptions;
  const dealName = (deal?.['name'] as string) ?? a?.dealInfo?.dealName ?? 'Deal';
  const units    = a?.dealInfo?.totalUnits ?? 0;
  const city     = a?.dealInfo?.city ?? '';
  const state    = a?.dealInfo?.state ?? '';
  const location = [city, state].filter(Boolean).join(', ') || 'Location';

  const loanAmt       = a?.financing?.loanAmount ?? 0;
  const rateAnn       = a?.financing?.interestRate ?? 0.0675;
  const amortYrs      = a?.financing?.amortization ?? 30;
  const ioYears       = Math.round((a?.financing?.ioPeriod ?? 0) / 12);
  const origFee       = a?.financing?.originationFee ?? 0.01;
  const purchasePrice = a?.acquisition?.purchasePrice ?? 0;

  const acfRows   = modelResults?.annualCashFlow ?? [];
  const noi1      = acfRows[0]?.noi ?? 3_730_000;
  const noiGrowth = 0.034;

  const MIN_DSCR = 1.25;
  const MAX_LTV  = 0.65;
  const i30 = rateAnn / 12;
  const n30 = amortYrs * 12;
  const mortgageConstant = amortYrs > 0 && i30 > 0
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
  const reassessAV    = purchasePrice > 0 ? Math.round(purchasePrice * 0.40) : 0;
  const egi1          = noi1 * 1.3;

  const taxSchedule = useMemo(() => {
    if (!millageRate) return [];
    return buildTaxSchedule(currentTax, purchasePrice || 0, millageRate, 0.40, 0.04, egi1, units, holdYears);
  }, [currentTax, purchasePrice, millageRate, egi1, units, holdYears]);

  // Fetch M07 traffic data
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const fetchTraffic = async () => {
      try {
        const res = await apiClient.get(`/api/v1/leasing-traffic/v2/intelligence/${dealId}`);
        if (cancelled) return;
        const data = res.data?.data ?? res.data;
        if (data?.rawTraffic || data?.occupancyTrajectory) {
          setTrafficData(data as TrafficHandoff);
          setTrafficOffline(false);
        } else {
          setTrafficOffline(true);
        }
      } catch {
        if (!cancelled) setTrafficOffline(true);
      }
    };
    fetchTraffic();
    return () => { cancelled = true; };
  }, [dealId]);

  const totalDS    = debtSchedule.reduce((s, r) => s + r.annualPayment, 0);
  const minDSCR    = debtSchedule.length > 0 ? Math.min(...debtSchedule.map(r => r.dscr)) : 0;
  const minDSCRYr  = debtSchedule.length > 0 ? debtSchedule.reduce((mi, r, i) => r.dscr < debtSchedule[mi].dscr ? i : mi, 0) + 1 : 0;
  const endBalance = debtSchedule.length > 0 ? debtSchedule[debtSchedule.length - 1]?.endBalance ?? 0 : 0;
  const irr        = modelResults?.summary?.irr ?? 0;
  const em         = modelResults?.summary?.equityMultiple ?? 0;
  const exitValue  = modelResults?.summary?.exitValue ?? 0;
  const reassessmentDelta = Math.round((taxSchedule[0]?.annualTax ?? 0) - currentTax);

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-100 tracking-wider text-[11px]">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[11px]">
            <span className="text-slate-400">{dealName}</span>
            {units > 0 && <><span className="text-slate-600">|</span><span className="text-slate-400">{units} Units</span></>}
            {location !== 'Location' && <><span className="text-slate-600">|</span><span className="text-slate-400">{location}</span></>}
          </div>
          {trafficData && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-500/20 rounded text-[9px]">
              <Zap className="w-2.5 h-2.5" />
              M07 LIVE · {trafficData.modelConfidence}% conf
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(['5 YR', '7 YR', '10 YR'] as HoldYears[]).map(tab => (
              <button key={tab} onClick={() => setHoldTab(tab)}
                className={`px-3 py-1 text-[10px] font-bold rounded-sm ${holdTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={() => onAssumptionsChange && onAssumptionsChange({})}
            className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60"
          >RECALCULATE</button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page nav */}
      <div className="flex items-center gap-0 px-4 py-0 bg-[#0d0d0d] border-b border-[#1e1e1e]">
        {PAGE_NAV.map((p, i) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => setPage(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold border-b-2 transition-colors ${
                page === p.id ? `border-blue-500 ${p.color}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className={page === p.id ? p.color : 'text-slate-600'}>{p.icon}</span>
              {p.label.toUpperCase()}
            </button>
            {i < PAGE_NAV.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </React.Fragment>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-2 text-[10px] text-slate-600">
          {page === 'DEBT' && loanAmt > 0 && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">{ioYears}YR I/O</span>
              <span>MC: {fmtPct2(mortgageConstant, 3)}</span>
              {minDSCR > 0 && <span className={minDSCR >= 1.25 ? 'text-green-500' : 'text-amber-500'}>Min DSCR: {fmtX(minDSCR)} YR{minDSCRYr}</span>}
            </>
          )}
          {page === 'TAXES' && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">{millageRate} MILLS</span>
              <span>T12 bill: {fmt$(currentTax)}</span>
              <span className={reassessmentDelta > 5000 ? 'text-amber-500' : 'text-green-500'}>
                {reassessmentDelta > 0 ? '↑ REASSESS +' + fmt$(reassessmentDelta) : 'No reassessment delta'}
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
            assumptions={assumptions}
            modelResults={modelResults}
            holdYears={holdYears}
            trafficData={trafficData}
            trafficOffline={trafficOffline}
          />
        )}
        {page === 'DEBT' && loanAmt > 0 ? (
          <div className="overflow-auto h-full">
            <DebtPage
              holdYears={holdYears} schedule={debtSchedule} ioYears={ioYears}
              loanAmt={loanAmt} rateAnn={rateAnn} amortYrs={amortYrs} origFee={origFee}
              purchasePrice={purchasePrice} maxLtvLoan={maxLtvLoan} maxDscrLoan={maxDscrLoan}
              sizingConst={sizingConst === Infinity ? 0 : sizingConst} mortgageConstant={mortgageConstant}
              units={units}
            />
          </div>
        ) : page === 'DEBT' ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-slate-500">
            No loan configured — set loan amount and rate in Financing assumptions
          </div>
        ) : null}
        {page === 'TAXES' && (
          <div className="overflow-auto h-full">
            <TaxesPage
              holdYears={holdYears} schedule={taxSchedule} currentTax={currentTax}
              assessedValue={assessedValue} millageRate={millageRate}
              purchasePrice={purchasePrice || 65_000_000} reassessAV={reassessAV}
              units={units}
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
                  {irr > 0 ? fmtPct2(irr) : '—'}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
                <span className="text-sm font-mono text-slate-200">{em > 0 ? fmtX(em) : '—'}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">STABILIZED VALUE</span>
                <span className="text-sm font-mono text-slate-200">{exitValue > 0 ? fmtM(exitValue) : '—'}</span>
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
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">REASSESSMENT DELTA</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <TrendingUp className="w-3 h-3" />
          <span>F9 ASSUMPTIONS · {holdYears}YR HOLD</span>
        </div>
      </div>
    </div>
  );
}

export default AssumptionsTab;
