import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RenovationAssumptionsSection } from './RenovationAssumptionsSection';
import {
  Lock, Download, AlertTriangle, TrendingUp, Zap,
  ChevronRight, ChevronDown, X, Check, FlaskConical,
} from 'lucide-react';
import type { FinancialEngineTabProps, F9NarrativeBlock } from './types';
import { apiClient } from '../../../services/api.client';
import { F9ProtectorsPanel } from './F9ProtectorsPanel';
import { useDealStore } from '../../../stores/dealStore';
import { Y1SourcePicker } from './Y1SourcePicker';
import { computeConfidenceBands, evaluateRefusal } from '../../../services/proforma/validators';
import type { ConfidenceBands, ValidationFlag } from '../../../services/proforma/types';

// ─── Backend contract ──────────────────────────────────────────────────────────
interface OSRow {
  field: string; label: string;
  broker: number|null; platform: number|null; t12: number|null;
  rentRoll: number|null; taxBill: number|null;
  resolved: number|null; resolution: string|null; perUnit: number|null;
  source: string|null; confidence: number|null;
  benchmarkPosition: 'above'|'below'|'within'|null;
}
interface TrafficYear {
  year: number; vacancyPct: number|null; occupancyPct: number|null;
  effRent: number|null; rentGrowthPct: number|null;
  t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null;
}
interface GprDecomposition {
  brokerAnnual: number|null; platformAnnual: number|null; t12Annual: number|null;
  rentRollAnnual: number|null; resolvedAnnual: number|null;
  brokerPerUnitMo: number|null; platformPerUnitMo: number|null;
  t12PerUnitMo: number|null; resolvedPerUnitMo: number|null;
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
    gprDecomposition: GprDecomposition|null;
    /** AI narrative synthesizing M07 signals. Null when M07 offline. */
    narrative: string|null;
    /** Live growth rates from per_year_overrides — null = use FIELD_META default */
    opexGrowthPct: number|null;
    utilitiesGrowthPct: number|null;
    insuranceGrowthPct: number|null;
    taxGrowthPct: number|null;
    reservesGrowthPct: number|null;
    ancillaryGrowthPct: number|null;
    concessionBurnOffPct: number|null;
  };
  /** Persisted user overrides keyed by camelCase field name → hold year → value.
   *  Returned by backend so the frontend can rehydrate overrides state across sessions. */
  userOverrides: Record<string, Record<number, number|null>>;
  /** F9 Tier-1: Persisted hard-warning override justifications, keyed
   *  field → year → rationale text. Rehydrated from per_year_overrides
   *  `rationale:{field}:{year}` JSONB sibling keys (spec §9). */
  userOverrideRationales?: Record<string, Record<number, string>>;
  meta: { seeded: boolean; updatedAt: string|null };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono','Fira Code',monospace";
type RowMode = 'flat'|'stepped'|'formula';
type Overrides = Record<string, Record<number, number|null>>;
type Formulas  = Record<string, string>;

// Field ordering from backend (sections 1 & 3)
const REVENUE_ORDER = ['gpr','loss_to_lease_pct','vacancy_pct','concessions_pct','bad_debt_pct','non_revenue_units_pct','other_income_per_unit','net_rental_income','egi'];
const OPEX_ORDER    = ['payroll','repairs_maintenance','turnover','contract_services','marketing','utilities','g_and_a','management_fee_pct','insurance','real_estate_tax','replacement_reserves','total_opex','noi'];

// ─── Formula evaluator — constrained arithmetic parser (no new Function) ───────
// Only allows: numbers, +  -  *  /  ()  and the named refs below.
// Rejects anything outside [0-9 . + - * / ( ) spaces] after token substitution.
function evalFormula(
  expr: string,
  context: { base: number|null; platform: number|null; yearVals: Record<number, number|null> },
): number|null {
  try {
    let s = expr.trim();
    // Substitute named refs
    s = s.replace(/[Yy](\d+)/g, (_, n) => {
      const v = context.yearVals[Number(n)];
      return v != null ? String(v) : '__UNDEF__';
    });
    s = s.replace(/\bbase\b/gi, context.base != null ? String(context.base) : '__UNDEF__');
    s = s.replace(/\bplatform\b/gi, context.platform != null ? String(context.platform) : '__UNDEF__');
    // Convert percentage notation: e.g. 0.25% → 0.0025
    s = s.replace(/([\d.]+)\s*%/g, (_, n) => String(parseFloat(n) / 100));
    // Bail if any ref is undefined
    if (s.includes('__UNDEF__')) return null;
    // Whitelist check — only digits, decimal points, operators, parens, whitespace
    if (/[^0-9.\s+\-*/()]/.test(s)) return null;
    // Constrained recursive descent parser
    let pos = 0;
    const skip = () => { while (pos < s.length && s[pos] === ' ') pos++; };
    const parseExpr = (): number => {
      let left = parseTerm();
      skip();
      while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
        const op = s[pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
        skip();
      }
      return left;
    };
    const parseTerm = (): number => {
      let left = parseUnary();
      skip();
      while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
        const op = s[pos++];
        const right = parseUnary();
        if (op === '/' && right === 0) throw new Error('div/0');
        left = op === '*' ? left * right : left / right;
        skip();
      }
      return left;
    };
    const parseUnary = (): number => {
      skip();
      if (s[pos] === '-') { pos++; return -parseAtom(); }
      if (s[pos] === '+') { pos++; return parseAtom(); }
      return parseAtom();
    };
    const parseAtom = (): number => {
      skip();
      if (s[pos] === '(') {
        pos++;
        const v = parseExpr();
        skip();
        if (s[pos] === ')') pos++;
        return v;
      }
      const start = pos;
      while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
      if (pos === start) throw new Error('expected number');
      return parseFloat(s.slice(start, pos));
    };
    const result = parseExpr();
    skip();
    if (pos !== s.length) return null;  // trailing characters
    return isFinite(result) ? result : null;
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

// Compound rent growth multiplier for year `yr` relative to year 1
function rentCompound(f: DealFinancials, yr: number): number {
  let m = 1;
  for (let y = 1; y < yr; y++) {
    const g = pyr(f, y)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03;
    m *= 1 + (g ?? 0.03);
  }
  return m;
}

// ─── Field metadata (thin overlay on top of backend proforma.year1 data) ───────
interface FieldMeta {
  unit: 'pct'|'dollar'|'weeks'|'per_wk'|'months'|'years';
  format: (n: number) => string;
  patchField?: string;
  readonly?: boolean;
  description?: string;
  platformSource?: string; brokerSource?: string;
  brokerPage?: string; brokerLine?: string;
  // Year-N projection approach
  growthPct?: number;        // fixed fallback rate (e.g. 0.03 = 3%) used when no live rate available
  growthKey?: 'rent'|'opex'; // dynamic: 'rent' = per-year from assumptions; 'opex' = general opex rate
  /** Key in financials.assumptions that carries the user-overrideable live growth rate for this row.
   *  When set, buildRowDef prefers this over the hardcoded growthPct fallback. */
  assumptionKey?: keyof DealFinancials['assumptions'];
  // Custom per-year platform getter (for traffic-driven metrics)
  getYearNPlatform?: (f: DealFinancials, yr: number) => number|null;
}

const fmtPct2 = (n: number) => (n * 100).toFixed(2) + '%';
const fmtDlr  = (n: number) => '$' + Math.round(n).toLocaleString();
const fmtWks  = (n: number) => Math.round(n) + ' wks';
const fmtPwk  = (n: number) => n.toFixed(1) + '/wk';
const fmtMo   = (n: number) => Math.round(n) + ' mo';

// Metadata keyed by backend field name — all Year-1 data comes from proforma.year1
const FIELD_META: Record<string, FieldMeta> = {
  // ── Revenue fields (Section 1) ─────────────────────────────────────────────
  gpr: {
    unit: 'dollar', format: fmtDlr, patchField: 'gpr', growthKey: 'rent',
    description: 'Gross Potential Rent — 100% occupied × market rent × 12. Compounds each year by per-year rent growth.',
    platformSource: 'M07 Traffic Engine — effRent × occupancy × units', brokerSource: 'OM / Rent Roll',
    brokerPage: 'Rent Roll Summary', brokerLine: 'Gross Potential Rent',
    getYearNPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.effRent != null && t?.occupancyPct != null)
        return Math.round(t.effRent * t.occupancyPct * f.totalUnits * 12);
      const base = y1(f,'gpr')?.platform;
      return base != null ? Math.round(base * rentCompound(f, yr)) : null;
    },
  },
  loss_to_lease_pct: {
    unit: 'pct', format: fmtPct2, patchField: 'lossToLeasePct',
    description: 'Market rent minus in-place rent as % of market rent. Narrows as leases roll over hold period.',
    platformSource: 'JEDI — Submarket Avg Loss-to-Lease', brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Loss-to-Lease',
  },
  vacancy_pct: {
    unit: 'pct', format: fmtPct2, patchField: 'vacancyPct',
    description: 'Physical vacancy & credit loss as % of GPR. M07 derives this from T-01×T-05 traffic equilibrium.',
    platformSource: 'M07 — T-01 × T-05 occupancy trajectory per year', brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Vacancy & Credit Loss',
    getYearNPlatform: (f, yr) => tyr(f, yr)?.vacancyPct ?? y1(f,'vacancy_pct')?.platform ?? null,
  },
  concessions_pct: {
    unit: 'pct', format: fmtPct2, patchField: 'concessionsPct',
    description: 'Free rent / net effective concessions as % of GPR. Declines as market tightens.',
    platformSource: 'M07 — Leasing velocity implies concession pressure', brokerSource: 'OM / Operating Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Concessions',
  },
  bad_debt_pct: {
    unit: 'pct', format: fmtPct2, patchField: 'badDebtPct',
    description: 'Non-payment and collection losses as % of GPR.',
    platformSource: 'JEDI — Local collections data', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Collection Loss',
  },
  non_revenue_units_pct: {
    unit: 'pct', format: fmtPct2,
    description: 'Manager/model units held offline as % of total unit count.',
    platformSource: 'JEDI — Submarket NRU norm', brokerSource: 'OM / Operating Assumptions',
  },
  other_income_per_unit: {
    unit: 'dollar', format: fmtDlr, patchField: 'otherIncomePerUnit',
    description: 'Ancillary income (parking, storage, RUBS, pet fees) per unit per month.',
    platformSource: 'JEDI — Historical ancillary income by market', brokerSource: 'OM / T12 Other Income',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Other Income',
  },
  net_rental_income: {
    unit: 'dollar', format: fmtDlr, readonly: true,
    description: 'Net Rental Income = GPR × (1 − Vacancy − Concessions − Bad Debt − NRU).',
    platformSource: 'Computed from Section 1 revenue lines', brokerSource: 'OM / T12 Statement',
    growthKey: 'rent',
  },
  egi: {
    unit: 'dollar', format: fmtDlr, readonly: true,
    description: 'Effective Gross Income = Net Rental Income + Other Income.',
    platformSource: 'Computed — NRI + Other Income', brokerSource: 'OM / T12 Statement',
    growthKey: 'rent',
  },
  // ── OpEx fields (Section 3) ───────────────────────────────────────────────
  payroll: {
    unit: 'dollar', format: fmtDlr, patchField: 'payroll', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'On-site payroll and property management fee per year.',
    platformSource: 'JEDI — Submarket OpEx benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Payroll & Benefits',
  },
  repairs_maintenance: {
    unit: 'dollar', format: fmtDlr, patchField: 'repairsMaintenance', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'Routine R&M per year. Excludes capital expenditures.',
    platformSource: 'JEDI — Property class benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Repairs & Maintenance',
  },
  turnover: {
    unit: 'dollar', format: fmtDlr, patchField: 'turnover', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'Make-ready and turnover costs per year.',
    platformSource: 'JEDI — Turnover benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Turnover / Make Ready',
  },
  contract_services: {
    unit: 'dollar', format: fmtDlr, patchField: 'contractServices', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'Landscaping, pest control, elevator, janitorial contract services per year.',
    platformSource: 'JEDI — Contract services benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Contract Services',
  },
  marketing: {
    unit: 'dollar', format: fmtDlr, patchField: 'marketing', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'Leasing, advertising, and marketing costs per year.',
    platformSource: 'JEDI — Marketing benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Marketing',
  },
  utilities: {
    unit: 'dollar', format: fmtDlr, patchField: 'utilities', growthPct: 0.03, assumptionKey: 'utilitiesGrowthPct',
    description: 'Owner-paid utilities per year.',
    platformSource: 'JEDI — Utility benchmark by market', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Utilities',
  },
  g_and_a: {
    unit: 'dollar', format: fmtDlr, patchField: 'gAndA', growthPct: 0.03, assumptionKey: 'opexGrowthPct',
    description: 'General and administrative expenses per year.',
    platformSource: 'JEDI — G&A benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'G&A / Admin',
  },
  management_fee_pct: {
    unit: 'pct', format: fmtPct2, patchField: 'managementFeePct',
    description: 'Property management fee as % of EGI.',
    platformSource: 'JEDI — Market management fee norms', brokerSource: 'OM / Management Agreement',
  },
  insurance: {
    unit: 'dollar', format: fmtDlr, patchField: 'insurance', growthPct: 0.035, assumptionKey: 'insuranceGrowthPct',
    description: 'Hazard, liability, and specialty insurance per year.',
    platformSource: 'JEDI — Insurance benchmark', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Insurance',
  },
  real_estate_tax: {
    unit: 'dollar', format: fmtDlr, patchField: 'realEstateTax', growthPct: 0.04, assumptionKey: 'taxGrowthPct',
    description: 'Annual RE tax. Reassessment at purchase causes Year-1 shock in Florida.',
    platformSource: 'JEDI — County millage model', brokerSource: 'OM / T12 Statement',
    brokerPage: 'T12 Operating Statement', brokerLine: 'Real Estate Taxes',
  },
  replacement_reserves: {
    unit: 'dollar', format: fmtDlr, patchField: 'replacementReserves', growthPct: 0.02, assumptionKey: 'reservesGrowthPct',
    description: 'Annual replacement reserves per unit. Industry standard $150–$350.',
    platformSource: 'JEDI — Industry reserve standard', brokerSource: 'OM / Pro Forma Expenses',
  },
  total_opex: {
    unit: 'dollar', format: fmtDlr, readonly: true,
    description: 'Total operating expenses — sum of all expense lines above.',
    platformSource: 'Computed — sum of all opex lines', brokerSource: 'OM / T12 Operating Statement',
    growthPct: 0.03, assumptionKey: 'opexGrowthPct',
  },
  noi: {
    unit: 'dollar', format: fmtDlr, readonly: true,
    description: 'Net Operating Income = EGI − Total OpEx.',
    platformSource: 'Computed — EGI minus Total OpEx', brokerSource: 'OM / T12 Statement',
    growthKey: 'rent',
  },
};

// ─── RowDef interface ──────────────────────────────────────────────────────────
interface RowDef {
  key: string; label: string; section: 1|2|3|4|5|6|7|8|9|10;
  unit: 'pct'|'dollar'|'weeks'|'per_wk'|'months'|'years'; readonly?: boolean;
  isM07?: boolean;
  format: (n: number) => string;
  description?: string;
  patchField?: string;
  platformSource?: string; brokerSource?: string;
  brokerPage?: string; brokerLine?: string;
  getBroker:     (f: DealFinancials, yr: number) => number|null;
  getPlatform:   (f: DealFinancials, yr: number) => number|null;
  getConfidence: (f: DealFinancials) => number|null;
}

// Build a RowDef from a backend OSRow + FieldMeta
function buildRowDef(osRow: OSRow, section: 5|6, meta: FieldMeta): RowDef {
  const field = osRow.field;
  return {
    key: field,
    label: osRow.label, // label from backend
    section,
    unit: meta.unit,
    format: meta.format,
    patchField: meta.patchField,
    readonly: meta.readonly,
    description: meta.description,
    platformSource: meta.platformSource,
    brokerSource: meta.brokerSource,
    brokerPage: meta.brokerPage,
    brokerLine: meta.brokerLine,
    getBroker: (f, yr) => {
      const row = y1(f, field);
      if (!row) return null;
      const base = row.broker ?? row.t12 ?? row.rentRoll;
      if (base == null) return null;
      if (yr === 1) return base;
      if (meta.growthKey === 'rent') return Math.round(base * rentCompound(f, yr));
      if (meta.growthKey === 'opex' || meta.growthPct != null) {
        const liveRate = meta.assumptionKey != null ? (f.assumptions as Record<string, number|null>)[meta.assumptionKey as string] : null;
        const g = liveRate ?? meta.growthPct ?? 0.03;
        return Math.round(base * Math.pow(1 + g, yr - 1));
      }
      return base;
    },
    getPlatform: (f, yr) => {
      if (meta.getYearNPlatform) return meta.getYearNPlatform(f, yr);
      const row = y1(f, field);
      if (!row) return null;
      const base = row.platform;
      if (base == null) return null;
      if (yr === 1) return base;
      if (meta.growthKey === 'rent') return Math.round(base * rentCompound(f, yr));
      if (meta.growthKey === 'opex' || meta.growthPct != null) {
        const liveRate = meta.assumptionKey != null ? (f.assumptions as Record<string, number|null>)[meta.assumptionKey as string] : null;
        const g = liveRate ?? meta.growthPct ?? 0.03;
        return Math.round(base * Math.pow(1 + g, yr - 1));
      }
      return base;
    },
    getConfidence: (f) => y1(f, field)?.confidence ?? null,
  };
}

// Section headers — v2 (10-section layout; 1-4 rendered as KeystonePanel above table)
const SEC: Record<number,string> = {
  1: '1  KEYSTONE',
  2: '2  DEAL INFO',
  3: '3  ACQUISITION',
  4: '4  UNIT MIX & RENT ROLL',
  5: '5  REVENUE  [proforma.year1 · M07 Traffic Intel]',
  6: '6  OPERATING EXPENSES  [proforma.year1]',
  7: '7  CAPEX & RESERVES',
  8: '8  DISPOSITION & HOLD',
  9: '9  FINANCING  [→ Debt Tab]',
  10: '10  FORWARD GROWTH RATES  [annual % by line item]',
};

// ─── Static row definitions (v2: Sections 5-9) ────────────────────────────────
// Revenue (5) and OpEx (6) are backend-driven via buildRowDef.
// M07 Traffic Intel rows are in section 5 (appended after revenue rows in Revenue section).
// Sections 1-4 (Keystone/DealInfo/Acquisition/UnitMix) are rendered as KeystonePanel.
const STATIC_ROWS: RowDef[] = [

  // ── Section 5: Traffic Intel [M07] — subsection within Revenue ─────────────
  {
    key: 't01WeeklyTours', label: 'T-01  Walk-Ins / Week', section: 5, unit: 'per_wk',
    isM07: true, format: fmtPwk, patchField: 't01WeeklyTours',
    description: 'T-01 AADT-equivalent inbound tour volume per week. Primary demand signal from traffic engine.',
    platformSource: 'M07 — T-01 real-time signal per year', brokerSource: 'N/A — live traffic signal',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, yr)  => tyr(f, yr)?.t01WeeklyTours ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't05ClosingRatio', label: 'T-05  Trade-Area Capture Rate %', section: 5, unit: 'pct',
    isM07: true, format: fmtPct2, patchField: 't05ClosingRatio',
    description: 'T-05 trade-area score — tour-to-lease capture rate. % of tours that convert to signed leases.',
    platformSource: 'M07 — T-05 closing ratio per year', brokerSource: 'N/A — live traffic signal',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const v = tyr(f, yr)?.t05ClosingRatio;
      return v != null ? (v > 1 ? v / 100 : v) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't06WeeklyLeases', label: 'T-06  Velocity Signal — Net Leases/Wk', section: 5, unit: 'per_wk',
    isM07: true, format: fmtPwk, patchField: 't06WeeklyLeases',
    description: 'T-06 velocity signal — net new leases per week. Key lease-up velocity indicator.',
    platformSource: 'M07 — T-06 signal per year', brokerSource: 'N/A — live traffic signal',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, yr) => tyr(f, yr)?.t06WeeklyLeases ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 't07Trajectory', label: 'T-07  Demand Trajectory % YoY', section: 5, unit: 'pct',
    isM07: true, format: n => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%', readonly: true,
    description: 'YoY tour-volume change (T-07). Positive = accelerating demand.',
    platformSource: 'M07 — T-07 derived from T-01 YoY change', brokerSource: 'N/A — derived',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, yr) => {
      if (yr < 2) return null;
      const curr = tyr(f, yr)?.t01WeeklyTours;
      const prev = tyr(f, yr - 1)?.t01WeeklyTours;
      return (curr != null && prev != null && prev !== 0) ? (curr / prev) - 1 : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'derivedVacancy', label: 'Derived Vacancy % (M07 equilibrium)', section: 5, unit: 'pct',
    isM07: true, format: fmtPct2, readonly: true,
    description: 'Read-only equilibrium vacancy from T-01×T-05 traffic model. Fallback to broker T12 vacancy when M07 offline.',
    platformSource: 'M07 — equilibrium vacancy from tours × conversion', brokerSource: 'OM / T12 vacancy_pct (broker fallback)',
    getBroker: (f, _yr) => y1(f, 'vacancy_pct')?.broker ?? y1(f, 'vacancy_pct')?.t12 ?? null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.vacancyPct != null) return t.vacancyPct;
      return t?.occupancyPct != null ? 1 - t.occupancyPct : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'stabilizedOcc', label: 'Stabilized Occupancy Target', section: 5, unit: 'pct',
    isM07: true, format: fmtPct2, patchField: 'vacancyPct',
    description: 'Long-run stabilized occupancy target. Platform = M07 equilibrium. Broker fallback = 1 − T12 vacancy.',
    platformSource: 'M07 — occupancy trajectory per year', brokerSource: 'OM / Pro Forma Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Stabilized Occupancy',
    getBroker: (f, _yr) => {
      const v = y1(f, 'vacancy_pct')?.broker ?? y1(f, 'vacancy_pct')?.t12;
      return v != null ? +(1 - v).toFixed(4) : null;
    },
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      return t?.occupancyPct ?? (t?.vacancyPct != null ? 1 - t.vacancyPct : null);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'leaseUpTo90', label: 'Lease-Up Curve: 90% Occ (weeks)', section: 5, unit: 'weeks',
    isM07: true, format: fmtWks, readonly: true,
    description: 'Weeks from CO to 90% physical occupancy. Derived from T-06 weekly leases.',
    platformSource: 'M07 — T-06 velocity → weeks to 90%', brokerSource: 'OM / Pro Forma Assumptions',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo90 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'leaseUpTo93', label: 'Lease-Up Curve: 93% Occ (weeks)', section: 5, unit: 'weeks',
    isM07: true, format: fmtWks, readonly: true,
    description: 'Weeks from CO to 93% physical occupancy.',
    platformSource: 'M07 — T-06 velocity → weeks to 93%', brokerSource: 'OM / Pro Forma Assumptions',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo93 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'leaseUpTo95', label: 'Lease-Up Curve: 95% Occ (weeks)', section: 5, unit: 'weeks',
    isM07: true, format: fmtWks, readonly: true,
    description: 'Weeks from CO to 95% physical occupancy. Standard stabilization threshold.',
    platformSource: 'M07 — T-06 velocity → weeks to 95%', brokerSource: 'OM / Pro Forma Assumptions',
    getBroker:   (_f, _yr) => null,
    getPlatform: (f, _yr) => f.trafficProjection?.leaseUp?.weeksTo95 ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },
  {
    key: 'renovationLift', label: 'Renovation Traffic Lift %', section: 5, unit: 'pct',
    isM07: true, format: fmtPct2,
    description: 'Incremental rent lift from renovation/value-add scope, derived from M07 demand elasticity.',
    platformSource: 'M07 — Demand elasticity × renovation scope model', brokerSource: 'OM / Value-Add Pro Forma',
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      // Try renovation data first
      const renoData = f.renovationData;
      if (renoData?.premiumRamp?.length) {
        const yrRamp = renoData.premiumRamp.find(r => r.year === yr);
        if (yrRamp) {
          // Convert decimal premium → percentage lift
          return yrRamp.premiumDecimal;
        }
      }
      // Fallback: M07 traffic projection
      const t = tyr(f, yr);
      if (t?.effRent == null) return null;
      const base = f.rentRollSummary?.avgInPlaceRent;
      if (base == null || base === 0) return null;
      return Math.max(0, (t.effRent - base) / base);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 45,
  },
  {
    key: 'afterRepairRent', label: 'Target After-Repair Rent', section: 5, unit: 'dollar',
    isM07: true, format: fmtDlr,
    description: 'Target in-place rent post-renovation. Value-add strategy only.',
    platformSource: 'M07 — Rent trajectory + renovation premium model', brokerSource: 'OM / Value-Add Pro Forma',
    getBroker: (_f, _yr) => null,
    getPlatform: (f, yr) => {
      const t = tyr(f, yr);
      if (t?.effRent == null) return null;
      // Tier-based premium: try to use the renovation data if available
      const renoData = f.renovationData;
      if (renoData?.premiumRamp?.length) {
        const yrRamp = renoData.premiumRamp.find(r => r.year === yr);
        if (yrRamp) {
          return Math.round(t.effRent * (1 + (yrRamp.premiumDecimal || 0)));
        }
      }
      // Fallback: default ×1.08 bump
      return Math.round(t.effRent * 1.08);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 50,
  },
  {
    key: 'leaseUpVelocity', label: 'Lease-Up Velocity (leases/mo)', section: 5, unit: 'per_wk',
    isM07: true, format: n => Math.round(n) + '/mo',
    description: 'Monthly net leasing velocity during lease-up (T-06 × 4.33).',
    platformSource: 'M07 — T-06 weekly lease velocity × 4.33', brokerSource: 'OM / Pro Forma Assumptions',
    getBroker: (_f, _yr) => null,
    getPlatform: (f, _yr) => {
      const wk = f.trafficProjection?.leasingSignals?.t06WeeklyLeases;
      return wk != null ? Math.round(wk * 4.33) : null;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? null,
  },

  // ── Section 7: Capex & Reserves ────────────────────────────────────────────
  {
    key: 'capexPerUnit', label: 'CapEx Budget ($/unit total)', section: 7, unit: 'dollar',
    format: fmtDlr, patchField: 'capexPerUnit',
    description: 'Total capital expenditure budget per unit over the hold period.',
    platformSource: 'JEDI — Value-add comp database', brokerSource: 'OM / CapEx Schedule',
    brokerPage: 'Capital Budget', brokerLine: 'Total CapEx Budget',
    getBroker: (f, _yr) => {
      const base = y1(f,'capex')?.broker;
      return base != null ? Math.round(base / Math.max(f.totalUnits, 1)) : null;
    },
    getPlatform: (_f, _yr) => null,
    getConfidence: _f => 50,
  },
  {
    key: 'capexYearDraw', label: 'CapEx Annual Draw ($/unit)', section: 7, unit: 'dollar',
    format: fmtDlr, patchField: 'capexPerYear',
    description: 'Per-year capital expenditure draw per unit. Front-loaded for value-add programs (Y1 40%, Y2 35%, Y3 25%).',
    platformSource: 'JEDI — CapEx curve model (front-loaded)', brokerSource: 'OM / CapEx Schedule by Year',
    getBroker: (f, yr) => {
      const total = y1(f,'capex')?.broker;
      if (total == null) return null;
      const perUnit = total / Math.max(f.totalUnits, 1);
      if (yr === 1) return Math.round(perUnit * 0.40);
      if (yr === 2) return Math.round(perUnit * 0.35);
      if (yr === 3) return Math.round(perUnit * 0.25);
      return 0;
    },
    getPlatform: (_f, _yr) => null,
    getConfidence: _f => 55,
  },
  {
    key: 'reserves', label: 'Replacement Reserves ($/unit/yr)', section: 7, unit: 'dollar',
    format: fmtDlr, patchField: 'replacementReserves',
    description: 'Annual replacement reserves per unit. Industry standard: $150–$350.',
    platformSource: 'JEDI — Industry reserve standard', brokerSource: 'OM / Pro Forma Expenses',
    getBroker: (f, _yr) => y1(f,'replacement_reserves')?.broker ?? 200,
    getPlatform: (_f, _yr) => 250,
    getConfidence: _f => 70,
  },
  {
    key: 'tiPerSF', label: 'Tenant Improvements ($/SF)', section: 7, unit: 'dollar',
    format: fmtDlr, patchField: 'tiPerSF',
    description: 'Tenant Improvement allowance per rentable SF. Applies to commercial leases and retail anchors.',
    platformSource: 'JEDI — Market TI comp database', brokerSource: 'OM / CapEx Schedule — TI Line',
    brokerPage: 'Capital Budget', brokerLine: 'Tenant Improvements',
    getBroker: (_f, _yr) => null,
    getPlatform: (_f, _yr) => 25,
    getConfidence: _f => 50,
  },
  {
    key: 'lcPctOfRent', label: 'Leasing Commissions (% of rent)', section: 7, unit: 'pct',
    format: fmtPct2, patchField: 'lcPctOfRent',
    description: 'Leasing commission cost as % of base rent. Typically 3–6% for multifamily; higher for commercial.',
    platformSource: 'JEDI — Market LC norms', brokerSource: 'OM / CapEx Schedule — LC Line',
    brokerPage: 'Capital Budget', brokerLine: 'Leasing Commissions',
    getBroker: (_f, _yr) => null,
    getPlatform: (_f, _yr) => 0.04,
    getConfidence: _f => 55,
  },

  // ── Section 8: Disposition & Hold ──────────────────────────────────────────
  {
    key: 'saleYear', label: 'Target Sale Year', section: 8, unit: 'years',
    format: n => `Yr ${Math.round(n)}`, patchField: 'saleYear',
    description: 'Projected hold period in years before disposition. Drives exit NOI and cap-rate valuation.',
    platformSource: 'JEDI — Optimal hold model (IRR/EM peak)', brokerSource: 'OM / Hold Period Assumption',
    brokerPage: 'Underwriting Assumptions', brokerLine: 'Hold Period',
    getBroker: (f, _yr) => f.assumptions.holdYears ?? null,
    getPlatform: (f, _yr) => f.assumptions.holdYears ?? null,
    getConfidence: _f => 65,
  },
  {
    key: 'exitCapRate', label: 'Exit Cap Rate', section: 8, unit: 'pct',
    format: fmtPct2, patchField: 'exitCapRate',
    description: 'Terminal cap rate applied to forward NOI at disposition.',
    platformSource: 'M07 — Demand velocity implies cap compression trend', brokerSource: 'OM / Underwriting Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Exit Cap Rate',
    getBroker: (f, _yr) => f.assumptions.exitCap ?? null,
    getPlatform: (f, _yr) => f.trafficProjection?.calibrated?.exitCap ?? null,
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },
  {
    key: 'sellingCosts', label: 'Selling Costs %', section: 8, unit: 'pct',
    format: fmtPct2,
    description: 'Brokerage, legal, and transfer costs at disposition as % of sale price.',
    platformSource: 'JEDI — Market transaction cost norms', brokerSource: 'OM / Disposition Assumptions',
    brokerPage: 'Operating Assumptions', brokerLine: 'Selling Costs',
    getBroker: (f, _yr) => y1(f,'sellingCosts')?.broker ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 80,
  },
  {
    key: 'grossSalePrice', label: 'Gross Sale Price (NOI ÷ ExitCap)', section: 8, unit: 'dollar',
    format: fmtDlr, readonly: true,
    description: 'Implied gross sale price = forward NOI at exit year ÷ exit cap rate. Computed from broker NOI × growth.',
    platformSource: 'Computed: NOI[yr] ÷ Platform ExitCap', brokerSource: 'Computed: NOI[yr1] ÷ Broker ExitCap',
    getBroker: (f, yr) => {
      const exitCap = f.assumptions.exitCap;
      if (!exitCap || exitCap === 0) return null;
      const noi1 = y1(f, 'net_operating_income')?.broker ?? y1(f, 'noi')?.broker;
      if (noi1 == null) return null;
      const noi = Math.round(noi1 * Math.pow(1.03, yr - 1));
      return Math.round(noi / exitCap);
    },
    getPlatform: (f, yr) => {
      const exitCap = f.trafficProjection?.calibrated?.exitCap ?? f.assumptions.exitCap;
      if (!exitCap || exitCap === 0) return null;
      const noi1 = y1(f, 'net_operating_income')?.platform ?? y1(f, 'noi')?.platform ?? y1(f, 'net_operating_income')?.broker ?? y1(f, 'noi')?.broker;
      if (noi1 == null) return null;
      const noi = Math.round(noi1 * Math.pow(1.03, yr - 1));
      return Math.round(noi / exitCap);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },
  {
    key: 'netSaleProceeds', label: 'Net Sale Proceeds (after costs)', section: 8, unit: 'dollar',
    format: fmtDlr, readonly: true,
    description: 'Gross sale price × (1 − selling costs). Represents proceeds before debt payoff.',
    platformSource: 'Computed: GrossSale × (1 − SellingCosts)', brokerSource: 'Computed: GrossSale × (1 − SellingCosts)',
    getBroker: (f, yr) => {
      const exitCap = f.assumptions.exitCap;
      if (!exitCap || exitCap === 0) return null;
      const noi1 = y1(f, 'net_operating_income')?.broker ?? y1(f, 'noi')?.broker;
      if (noi1 == null) return null;
      const noi = Math.round(noi1 * Math.pow(1.03, yr - 1));
      const gross = noi / exitCap;
      const costs = y1(f,'sellingCosts')?.broker ?? 0.02;
      return Math.round(gross * (1 - costs));
    },
    getPlatform: (f, yr) => {
      const exitCap = f.trafficProjection?.calibrated?.exitCap ?? f.assumptions.exitCap;
      if (!exitCap || exitCap === 0) return null;
      const noi1 = y1(f, 'net_operating_income')?.platform ?? y1(f, 'net_operating_income')?.broker ?? y1(f, 'noi')?.broker;
      if (noi1 == null) return null;
      const noi = Math.round(noi1 * Math.pow(1.03, yr - 1));
      const gross = noi / exitCap;
      return Math.round(gross * 0.98);
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 60,
  },

  // ── Section 10: Forward Growth Rates ───────────────────────────────────────
  // Each row shows the annual growth % applied to that line item each year.
  // Platform defaults match the Excel model (3%/2%); user can override per-year.
  {
    key: 'growthRentPct', label: 'Rent Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'rentGrowthStabilized',
    description: 'Annual rent growth rate applied to GPR each year from stabilization. Excel model: 3%/yr. M07 can override per-year based on demand trajectory.',
    platformSource: 'M07 — Demand velocity implied rent growth', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Rent Growth',
    getBroker:   (f, yr) => pyr(f, yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03,
    getPlatform: (f, yr) => {
      const t1 = tyr(f, yr);
      const t0 = tyr(f, yr - 1);
      if (t1?.effRent != null && t0?.effRent != null && t0.effRent > 0)
        return +(t1.effRent / t0.effRent - 1).toFixed(4);
      return pyr(f, yr)?.rentGrowthPct ?? f.assumptions.rentGrowthStabilized ?? 0.03;
    },
    getConfidence: f => f.trafficProjection?.leasingSignals?.confidence ?? 65,
  },
  {
    key: 'growthAncillaryPct', label: 'Ancillary Income Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthAncillaryPct',
    description: 'Annual growth rate for ancillary/other income (parking, RUBS, pet fees, valet trash, etc.). Excel model: 3%/yr.',
    platformSource: 'JEDI — Historical ancillary income growth by market', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Ancillary Income',
    getBroker:   (_f, _yr) => _f.assumptions.ancillaryGrowthPct ?? 0.03,
    getPlatform: (_f, _yr) => 0.03,
    getConfidence: _f => 65,
  },
  {
    key: 'growthOpexPct', label: 'Operating Expense Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthOpexPct',
    description: 'Annual growth rate applied to variable operating expenses (payroll, R&M, marketing, contract services, G&A, turnover). Excel model: 2%/yr.',
    platformSource: 'JEDI — CPI + labor market trends', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'OpEx Growth',
    getBroker:   (_f, _yr) => _f.assumptions.opexGrowthPct ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 70,
  },
  {
    key: 'growthUtilitiesPct', label: 'Utilities Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthUtilitiesPct',
    description: 'Annual growth rate for owner-paid utilities. Tracked separately from general OpEx due to energy price volatility. Excel model: 2%/yr.',
    platformSource: 'JEDI — Energy price trend model by market', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Utility Growth',
    getBroker:   (_f, _yr) => _f.assumptions.utilitiesGrowthPct ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 60,
  },
  {
    key: 'growthInsurancePct', label: 'Insurance Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthInsurancePct',
    description: 'Annual growth rate for property insurance. Florida assets typically see 3.5–5% annual increases due to hurricane/flood exposure.',
    platformSource: 'JEDI — Florida insurance market model', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Insurance Growth',
    getBroker:   (_f, _yr) => _f.assumptions.insuranceGrowthPct ?? 0.035,
    getPlatform: (_f, _yr) => 0.04,
    getConfidence: _f => 60,
  },
  {
    key: 'growthTaxPct', label: 'Property Tax Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthTaxPct',
    description: 'Annual growth rate for real estate taxes. Florida Homestead cap exemption does not apply to multifamily — subject to full reassessment. Excel model: 2%/yr.',
    platformSource: 'JEDI — County millage trend + assessment cap model', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Property Tax Growth',
    getBroker:   (_f, _yr) => _f.assumptions.taxGrowthPct ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 70,
  },
  {
    key: 'growthReservesPct', label: 'Capital Reserves Growth % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'growthReservesPct',
    description: 'Annual escalation of replacement reserve contributions. Excel model: 2%/yr.',
    platformSource: 'JEDI — Industry reserve escalation standard', brokerSource: 'OM / Growth Rate Assumptions',
    brokerPage: 'Growth Rate Assumptions', brokerLine: 'Capital Reserves',
    getBroker:   (_f, _yr) => _f.assumptions.reservesGrowthPct ?? 0.02,
    getPlatform: (_f, _yr) => 0.02,
    getConfidence: _f => 75,
  },

  // ── Section 10 continued: Concession burn-off (Section B trajectory) ────────
  // This field drives the projection engine's concession ramp-to-zero logic.
  // 0 = concessions fixed at Y1 throughout hold (existing behavior, default).
  // TODO(M36): concessionBurnOffPct is a Section B trajectory driver — add to
  //   covariance matrix when M36 integrates.
  // TODO(agent): concessionBurnOffPct — agent integration out of scope here.
  {
    key: 'concessionBurnOffPct', label: 'Concession Burn-Off % / yr', section: 10, unit: 'pct',
    format: fmtPct2, patchField: 'concessionBurnOffPct',
    description: 'Annual rate at which Year-1 concession loss is phased out toward zero. ' +
      '0 = concessions unchanged through hold; 0.5 = halved by Y3, zero by Y3; 1 = eliminated by Y2. ' +
      'Editing this field affects Year 2+ only; Pro Forma (Year 1) is unchanged.',
    platformSource: 'JEDI — Market lease-up stabilization curve',
    brokerSource: 'OM / Pro Forma Assumptions',
    getBroker:     (_f, _yr) => 0,
    getPlatform:   (_f, _yr) => 0,
    getConfidence: (_f) => 65,
  },
];

// ─── Divergence helpers ────────────────────────────────────────────────────────
function getDivergenceColor(
  user: number|null, platform: number|null, broker: number|null,
  p25?: number, p50?: number, p75?: number,
): 'red'|'amber'|null {
  const effective = user ?? platform ?? broker;
  if (p25 != null && p50 != null && p75 != null && effective != null) {
    const stdDev = (p75 - p25) / 1.35;
    if (Math.abs(effective - p50) > 2 * stdDev) return 'red';
  }
  if (user != null && platform != null) {
    const absDiff = Math.abs(user - platform);
    const relativeDiff = platform !== 0 ? absDiff / Math.abs(platform) : absDiff;
    if (relativeDiff > 0.01) return 'amber';
  }
  return null;
}

// ─── Layered cell ──────────────────────────────────────────────────────────────
interface LayerVals { broker: number|null; platform: number|null; user: number|null }

function LayeredCell({ vals, format, onClick, isM07, readonly, divergence, formulaResult, classification }: {
  vals: LayerVals; format: (n: number) => string;
  onClick?: () => void; isM07?: boolean; readonly?: boolean;
  divergence: 'red'|'amber'|null; formulaResult?: number|null;
  classification?: 'within' | 'soft_warning' | 'hard_warning' | null;
}) {
  const { broker, platform, user } = vals;
  const bg = divergence === 'red' ? 'bg-red-900/20 border-r-red-500/40' : divergence === 'amber' ? 'bg-amber-900/10 border-r-amber-500/20' : '';
  const hasUser = user != null || formulaResult != null;
  const resolved = formulaResult ?? user ?? platform ?? broker;
  const priorVal = hasUser ? (platform ?? broker) : null;
  const tooltipParts: string[] = [];
  if (user != null) tooltipParts.push(`USR: ${format(user)}`);
  if (platform != null) tooltipParts.push(`PLT: ${format(platform)}`);
  if (broker != null) tooltipParts.push(`BRK: ${format(broker)}`);
  if (resolved != null) tooltipParts.push(`RES: ${format(resolved)}`);

  return (
    <td
      onClick={readonly ? undefined : onClick}
      title={tooltipParts.join(' · ')}
      className={`relative border-r border-[#1e1e1e] align-top px-1.5 py-0.5 min-w-[82px] ${bg}
        ${readonly ? 'bg-[#0d0d0d]' : 'cursor-pointer hover:border-blue-500/30'}`}
    >
      {/* M07 sup badge (top-right corner) */}
      {isM07 && <sup className="absolute top-[1px] right-[2px] text-[5px] text-purple-600 font-bold">M07</sup>}
      {/* User override badge (blue pill, top-right) */}
      {hasUser && !isM07 && !readonly && (
        <sup className="absolute top-[1px] right-[2px] text-[5px] font-bold text-blue-500/80">USR</sup>
      )}
      {/* Confidence-band override classification dot (bottom-right) */}
      {hasUser && classification && classification !== 'within' && (
        <span
          title={
            classification === 'hard_warning'
              ? 'Override outside P10–P90 — justification required'
              : 'Override outside P25–P75 (soft warning)'
          }
          className={`absolute bottom-[2px] right-[2px] inline-block w-1.5 h-1.5 rounded-full ${
            classification === 'hard_warning' ? 'bg-red-500' : 'bg-amber-500'
          }`}
        />
      )}
      {readonly && <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-700" />}
      {formulaResult != null && (
        <div className="text-[9px] font-mono font-bold text-teal-400 leading-[1.3]">
          {format(formulaResult)}<span className="text-[6px] text-teal-700 ml-0.5">Fx</span>
        </div>
      )}
      {formulaResult == null && user != null && (
        <div className="text-[9px] font-mono font-bold text-blue-400 leading-[1.3]">{format(user)}</div>
      )}
      {/* Resolved (effective) line — shown faint when overridden by user */}
      {hasUser && priorVal != null && (
        <div className="text-[8px] font-mono leading-[1.2] text-slate-700 line-through">
          {format(priorVal)}
        </div>
      )}
      {!hasUser && platform != null && (
        <div className="text-[9px] font-mono font-bold text-cyan-400 leading-[1.3]">
          {format(platform)}
        </div>
      )}
      {!hasUser && platform == null && broker != null && (
        <div className="text-[9px] font-mono font-bold text-amber-400 leading-[1.3]">
          {format(broker)}
        </div>
      )}
      {resolved == null && (
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
  const viewMode = useDealStore(s => s.viewMode);
  const [activeLayer, setActiveLayer] = useState<'broker'|'platform'|'user'|'formula'>('platform');
  const [draft, setDraft]   = useState('');
  const [formula, setFormula] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const platHidden   = viewMode === 'BROKER_VIEW';
  const brokerHidden = viewMode === 'BUILD_OWN';

  useEffect(() => {
    if (!target) return;
    const { vals, formulaExpr } = target;
    const preferPlatform = !platHidden && vals.platform != null;
    const preferBroker   = !brokerHidden && vals.broker != null;
    setActiveLayer(
      vals.user != null    ? 'user'
      : preferPlatform     ? 'platform'
      : preferBroker       ? 'broker'
      : 'user'
    );
    setDraft(vals.user != null
      ? (target.row.unit === 'pct' ? (vals.user * 100).toFixed(2) : String(Math.round(vals.user)))
      : '');
    setFormula(formulaExpr);
    setApplyAll(false);
    // Intentionally only re-init draft when the user opens a different
    // (row, year) cell. Re-running on every `target` object identity change
    // would clobber the user's in-progress draft input each time the parent
    // re-renders and recreates the target reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.row.key, target?.year]);

  if (!target) return null;
  const { row: rd, year: yr, vals } = target;

  const evalCtx = { base: vals.broker, platform: vals.platform, yearVals: {} as Record<number, number|null> };
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

  const LAYER_CFG = [
    { id: 'platform' as const, label: 'PLATFORM', color: '#22d3ee', val: vals.platform, hidden: platHidden },
    { id: 'broker'   as const, label: 'BROKER',   color: '#f59e0b', val: vals.broker,   hidden: brokerHidden },
    { id: 'user'     as const, label: 'USER',      color: '#3b82f6', val: vals.user,     hidden: false },
    { id: 'formula'  as const, label: 'FORMULA',   color: '#2dd4bf', val: previewFormula, hidden: false },
  ].filter(lc => !lc.hidden);

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, zIndex: 200,
      background: '#0d0d0d', borderLeft: '1px solid #1e1e1e',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.8)', fontFamily: MONO,
    }}>
      <div style={{ padding: '10px 12px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{rd.label}</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>YR {yr} · {rd.unit}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(platHidden || brokerHidden) && (
            <span style={{
              fontSize: 7, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 5px', borderRadius: 2,
              border: `1px solid ${brokerHidden ? '#22d3ee40' : '#f59e0b40'}`,
              color: brokerHidden ? '#22d3ee' : '#f59e0b',
              background: brokerHidden ? '#22d3ee0a' : '#f59e0b0a',
            }}>
              {brokerHidden ? 'BUILD OWN' : 'BROKER VIEW'}
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

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

      {rd.description && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.5 }}>{rd.description}</div>
        </div>
      )}

      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#22d3ee50', letterSpacing: 0.5, marginBottom: 3 }}>PLATFORM DERIVATION</div>
        <div style={{ fontSize: 9, color: '#22d3ee', marginBottom: 4 }}>{rd.platformSource ?? '—'}</div>
      </div>

      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ fontSize: 8, color: '#f59e0b50', letterSpacing: 0.5, marginBottom: 3 }}>BROKER SOURCE</div>
        <div style={{ fontSize: 9, color: '#f59e0b', marginBottom: 2 }}>{rd.brokerSource ?? '—'}</div>
        {(rd.brokerPage || rd.brokerLine) && (
          <div style={{ fontSize: 8, color: '#78350f', lineHeight: 1.6 }}>
            {rd.brokerPage && <div>Page/Section: {rd.brokerPage}</div>}
            {rd.brokerLine && <div>Line item: {rd.brokerLine}</div>}
          </div>
        )}
      </div>


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

      <div style={{ padding: '7px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} style={{ width: 12, height: 12 }} />
          <span style={{ fontSize: 9, color: '#64748b' }}>Apply to all years in hold period</span>
        </label>
      </div>

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
// Implements spec equation: GPR = rent_component + traffic_component (derived_gpr)
// rent_component  = organic broker/T12 GPR grown forward at rent growth rate (Year-1 base)
// traffic_component = M07 signal increment above organic rent
// derived_gpr     = M07 platform GPR (from trafficProjection.yearly.effRent × units × 12)
//
// Source: assumptions.gprDecomposition from GET /api/v1/deals/:id/financials
function GprDecompRow({ years, financials }: { years: number[]; financials: DealFinancials|null }) {
  const [expanded, setExpanded] = useState(false);
  if (!financials) return null;

  const gd = financials.assumptions?.gprDecomposition;
  if (!gd && !y1(financials, 'gpr')) return null;

  const fmtM = (n: number) => n >= 1_000_000
    ? '$' + (n / 1_000_000).toFixed(2) + 'M'
    : '$' + Math.round(n / 1000) + 'K';

  // Per-year equation: rent_component + traffic_component = derived_gpr
  const rowData = years.map(yr => {
    const mult = rentCompound(financials, yr);

    // rent_component: organic broker base grown by per-year rent growth
    // Uses gprDecomposition.brokerAnnual (Year-1 broker/T12 GPR from assumptions.gprDecomposition)
    const rentComponent = gd?.brokerAnnual != null
      ? Math.round(gd.brokerAnnual * mult)
      : null;

    // derived_gpr: M07 platform GPR for this year
    // Prefer live trafficProjection.yearly[yr].effRent × units; fallback to gd.platformAnnual × growth
    const trafficYr = tyr(financials, yr);
    const derivedGpr = trafficYr?.effRent != null
      ? Math.round(trafficYr.effRent * financials.totalUnits * 12)
      : gd?.platformAnnual != null
        ? Math.round(gd.platformAnnual * mult)
        : null;

    // traffic_component: M07 lift above organic rent component
    const trafficComponent = derivedGpr != null && rentComponent != null
      ? derivedGpr - rentComponent
      : derivedGpr != null ? derivedGpr
      : null;

    return { yr, rentComponent, trafficComponent, derivedGpr };
  });

  const yr1 = rowData[0];
  const headerVal = yr1?.derivedGpr ?? yr1?.rentComponent;

  return (
    <>
      <tr className="border-b border-amber-500/20 bg-amber-900/10 cursor-pointer h-[24px]"
        onClick={() => setExpanded(x => !x)}>
        <td className="px-3 py-0.5 text-[10px] font-bold text-amber-400 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10 min-w-[220px]">
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            GPR DECOMPOSITION
            <span style={{ fontFamily: MONO, fontSize: 7, color: '#78350f', marginLeft: 4 }}>
              rent_component + traffic_component = derived_gpr
            </span>
          </span>
        </td>
        {rowData.map(r => (
          <td key={r.yr} className="px-2 py-0.5 text-right text-[10px] font-bold text-amber-400 border-r border-[#1e1e1e]" style={{ fontFamily: MONO }}>
            {r.derivedGpr != null ? fmtM(r.derivedGpr) : headerVal != null ? fmtM(headerVal) : '—'}
          </td>
        ))}
        <td className="px-1 py-0.5" />
      </tr>
      {expanded && (
        <>
          <tr className="h-[18px] border-b border-[#1e1e1e]/30">
            <td className="pl-8 pr-3 py-0 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10"
              style={{ fontSize: 9, color: '#f59e0b' }}>
              Rent Component (broker base × growth)
              {gd?.brokerPerUnitMo != null && (
                <span style={{ color: '#78350f', marginLeft: 4 }}>${gd.brokerPerUnitMo}/unit/mo Y1</span>
              )}
            </td>
            {rowData.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right border-r border-[#1e1e1e]"
                style={{ fontFamily: MONO, fontSize: 9, color: '#f59e0b' }}>
                {r.rentComponent != null ? fmtM(r.rentComponent) : '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr className="h-[18px] border-b border-[#1e1e1e]/30">
            <td className="pl-8 pr-3 py-0 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10"
              style={{ fontSize: 9, color: '#22d3ee' }}>
              Traffic Component (M07 T-01×T-05 demand lift)
            </td>
            {rowData.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right border-r border-[#1e1e1e]"
                style={{ fontFamily: MONO, fontSize: 9, color: r.trafficComponent != null ? (r.trafficComponent >= 0 ? '#22d3ee' : '#ef4444') : '#334155' }}>
                {r.trafficComponent != null
                  ? (r.rentComponent != null ? (r.trafficComponent >= 0 ? '+' : '') + fmtM(r.trafficComponent) : fmtM(r.trafficComponent))
                  : '—'}
              </td>
            ))}
            <td />
          </tr>
          <tr className="h-[18px] border-b border-amber-500/30 bg-amber-900/5">
            <td className="pl-8 pr-3 py-0 sticky left-0 bg-amber-900/10 border-r border-[#1e1e1e] z-10"
              style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>
              = Derived GPR (M07 platform)
              {gd?.platformPerUnitMo != null && (
                <span style={{ fontWeight: 400, color: '#78350f', marginLeft: 4 }}>${gd.platformPerUnitMo}/unit/mo Y1</span>
              )}
            </td>
            {rowData.map(r => (
              <td key={r.yr} className="px-2 py-0 text-right border-r border-[#1e1e1e]"
                style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>
                {r.derivedGpr != null ? fmtM(r.derivedGpr) : '—'}
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
function FindingsRail({ financials, narrativeBlocks }: { financials: DealFinancials|null; narrativeBlocks: F9NarrativeBlock[] }) {
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
  const leaseUp = financials?.trafficProjection?.leaseUp;

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
            {/* AI narrative blocks from /financials/narrative endpoint */}
            {narrativeBlocks.length > 0 && (
              <div style={{ borderBottom: '1px solid #1e1e1e', paddingBottom: 8 }}>
                <div style={{ fontSize: 8, color: '#22d3ee50', letterSpacing: 0.5, marginBottom: 6 }}>AI SYNTHESIS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {narrativeBlocks.map(b => (
                    <div key={b.id} style={{ paddingLeft: 6, borderLeft: `2px solid ${b.status === 'warn' ? '#f59e0b' : b.status === 'info' ? '#22d3ee' : '#10b981'}` }}>
                      <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.4, textTransform: 'uppercase' }}>{b.label}</div>
                      <div style={{ fontSize: 9, color: b.status === 'warn' ? '#f59e0b' : b.status === 'info' ? '#22d3ee' : '#94a3b8', lineHeight: 1.4 }}>{b.summary}</div>
                      {b.detail && <div style={{ fontSize: 8, color: '#475569', lineHeight: 1.3, marginTop: 1 }}>{b.detail}</div>}
                    </div>
                  ))}
                </div>
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
                  {sig.t05ClosingRatio != null && <div>T-05 (Capture): <span style={{ color: '#e2e8f0' }}>{(sig.t05ClosingRatio * 100).toFixed(1)}%</span></div>}
                  {sig.t06WeeklyLeases != null && <div>T-06: <span style={{ color: '#e2e8f0' }}>{sig.t06WeeklyLeases.toFixed(1)}/wk</span></div>}
                  {sig.t07LeaseUpWeeksTo95 != null && <div>T-07: <span style={{ color: '#e2e8f0' }}>{sig.t07LeaseUpWeeksTo95} wks</span></div>}
                </div>
              </div>
            )}
            {leaseUp && (leaseUp.weeksTo90 ?? leaseUp.weeksTo93 ?? leaseUp.weeksTo95) != null && (
              <div>
                <div style={{ fontSize: 8, color: '#22d3ee80', letterSpacing: 0.5, marginBottom: 2 }}>LEASE-UP CURVE</div>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>
                  {leaseUp.weeksTo90 != null && <div>90% Occ: <span style={{ color: '#e2e8f0' }}>{leaseUp.weeksTo90} wks</span></div>}
                  {leaseUp.weeksTo93 != null && <div>93% Occ: <span style={{ color: '#e2e8f0' }}>{leaseUp.weeksTo93} wks</span></div>}
                  {leaseUp.weeksTo95 != null && <div>95% Occ: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{leaseUp.weeksTo95} wks</span></div>}
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

// ─── Keystone Panel — Sections 1-4 (deal-level constants, above per-year grid) ──
function KeystonePanel({
  financials, deal, assumptions, collapsed, onToggle,
}: {
  financials: DealFinancials;
  deal: Record<string, unknown> | null | undefined;
  assumptions: { dealInfo?: { dealName?: string; totalUnits?: number; city?: string; state?: string; vintage?: number; netRentableSF?: number } } | null | undefined;
  collapsed: Set<number>;
  onToggle: (sec: number) => void;
}) {
  const fmtM = (n: number|null|undefined) => n != null ? '$' + (n / 1_000_000).toFixed(1) + 'M' : '—';
  const fmtK = (n: number|null|undefined) => n != null ? '$' + Math.round(n).toLocaleString() : '—';
  const fmtPct = (n: number|null|undefined) => n != null ? (n < 1 ? (n * 100).toFixed(2) : n.toFixed(2)) + '%' : '—';
  const fmtN = (n: number|null|undefined) => n != null ? n.toLocaleString() : '—';

  const cs = financials.capitalStack ?? {} as typeof financials.capitalStack;
  const rr = financials.rentRollSummary;
  const a  = financials.assumptions ?? {} as typeof financials.assumptions;

  const dealName = (deal?.['name'] as string) ?? financials.dealName ?? assumptions?.dealInfo?.dealName ?? 'Deal';
  const city     = (deal?.['city'] as string) ?? assumptions?.dealInfo?.city ?? '';
  const state    = (deal?.['state'] as string) ?? assumptions?.dealInfo?.state ?? '';
  const vintage  = (deal?.['year_built'] as number) ?? assumptions?.dealInfo?.vintage;
  const nrsf     = (deal?.['net_rentable_sf'] as number) ?? assumptions?.dealInfo?.netRentableSF;
  const assetCls = (deal?.['deal_type'] as string) ?? 'Multifamily';

  const sections = [
    {
      sec: 1, label: '1  KEYSTONE', items: [
        { label: 'Hold Period', value: `${a.holdYears} Years` },
        { label: 'Total Units', value: fmtN(financials.totalUnits) },
        { label: 'Hold Scenario', value: `${a.holdYears}YR` },
        { label: 'M07 Confidence', value: financials.trafficProjection?.leasingSignals?.confidence != null ? `${financials.trafficProjection.leasingSignals.confidence}%` : 'Offline' },
        { label: 'Exit Cap Rate', value: fmtPct(a.exitCap) },
        { label: 'Rent Growth Y1', value: a.rentGrowthYr1 != null ? (a.rentGrowthYr1 * 100).toFixed(1) + '% / yr' : '—' },
      ],
    },
    {
      sec: 2, label: '2  DEAL INFO', items: [
        { label: 'Deal Name', value: dealName },
        { label: 'Location', value: [city, state].filter(Boolean).join(', ') || '—' },
        { label: 'Asset Class', value: assetCls },
        { label: 'Year Built', value: vintage != null ? String(vintage) : '—' },
        { label: 'Net Rentable SF', value: nrsf != null ? nrsf.toLocaleString() + ' SF' : '—' },
        { label: 'SF / Unit', value: (nrsf && financials.totalUnits) ? Math.round(nrsf / financials.totalUnits) + ' SF' : '—' },
      ],
    },
    {
      sec: 3, label: '3  ACQUISITION', items: [
        { label: 'Purchase Price', value: fmtM(cs.purchasePrice) },
        { label: '$/Unit', value: cs.pricePerUnit != null ? '$' + Math.round(cs.pricePerUnit).toLocaleString() : '—' },
        { label: 'Loan Amount', value: fmtM(cs.loanAmount) },
        { label: 'Equity at Close', value: fmtM(cs.equityAtClose) },
        { label: 'LTV/LTC', value: fmtPct(cs.ltcPct) },
        { label: 'DSCR Min', value: cs.dscrMin != null ? cs.dscrMin.toFixed(2) + 'x' : '—' },
      ],
    },
    {
      sec: 4, label: '4  UNIT MIX & RENT ROLL', items: [
        { label: 'Total Units', value: fmtN(financials.totalUnits) },
        { label: 'Avg In-Place Rent', value: rr?.avgInPlaceRent != null ? fmtK(rr.avgInPlaceRent) + '/mo' : '—' },
        { label: 'Weighted Occupancy', value: rr?.weightedOccupancyPct != null ? (rr.weightedOccupancyPct * 100).toFixed(1) + '%' : '—' },
        { label: 'Rent Roll Status', value: rr != null ? 'Loaded' : 'Not Available' },
        { label: 'Orig Fee', value: cs.originationFeePct != null ? (cs.originationFeePct * 100).toFixed(2) + '%' : '—' },
        { label: 'Amort. (years)', value: cs.amortizationYears != null ? String(cs.amortizationYears) + ' yrs' : '—' },
      ],
    },
  ];

  return (
    <div className="border-b border-[#1e1e1e] bg-[#060606]">
      <div className="grid grid-cols-4 gap-0">
        {sections.map(({ sec, label, items }) => {
          const isCollapsed = collapsed.has(sec);
          return (
            <div key={sec} className="border-r border-[#1e1e1e] last:border-r-0">
              <button
                onClick={() => onToggle(sec)}
                className="w-full flex items-center gap-2 px-3 py-1 bg-[#111] border-b border-[#1e1e1e] hover:bg-[#181818] text-left"
              >
                {isCollapsed
                  ? <ChevronRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                  : <ChevronDown className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                }
                <span className="text-[8px] font-bold tracking-widest text-slate-500">{label}</span>
              </button>
              {!isCollapsed && (
                <div className="px-3 py-2 grid grid-cols-1 gap-0.5">
                  {items.map(({ label: lbl, value }) => (
                    <div key={lbl} className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="text-[8px] text-slate-600 truncate shrink-0">{lbl}</span>
                      <span className="text-[9px] font-bold text-slate-300 font-mono truncate text-right">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function AssumptionsTab({ dealId, deal, dealType, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const setConfidenceBands = useDealStore(s => s.setConfidenceBands);
  const classifyFieldOverride = useDealStore(s => s.classifyFieldOverride);
  const upsertValidationFlag = useDealStore(s => s.upsertValidationFlag);
  const removeValidationFlag = useDealStore(s => s.removeValidationFlag);
  const validationFlags = useDealStore(s => s.validationFlags);
  const setRefusalReasons = useDealStore(s => s.setRefusalReasons);
  const refusalReasons    = useDealStore(s => s.refusalReasons);
  const y1Source          = useDealStore(s => s.y1Source);
  const viewMode          = useDealStore(s => s.viewMode);
  const setViewMode       = useDealStore(s => s.setViewMode);
  const [closeDate, setCloseDate] = useState('');
  const [saleDate,  setSaleDate]  = useState('');
  const [csLocal, setCsLocal]     = useState<{
    purchasePrice: string; ltcPct: string; interestRate: string;
    ioPeriodMonths: string; amortizationYears: string;
  }>({ purchasePrice: '', ltcPct: '', interestRate: '', ioPeriodMonths: '', amortizationYears: '' });

  const [financials, setFinancials]     = useState<DealFinancials|null>(null);
  const [loading, setLoading]           = useState(false);
  const [holdTab, setHoldTab]           = useState<'5 YR'|'7 YR'|'10 YR'|null>(null);
  const [narrativeBlocks, setNarrativeBlocks] = useState<F9NarrativeBlock[]>([]);
  const [overrides, setOverrides]     = useState<Overrides>({});
  const [formulas, setFormulas]       = useState<Formulas>({});
  const [rowModes, setRowModes]       = useState<Record<string, RowMode>>({});
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget|null>(null);
  const [lockedOverrides, setLockedOverrides] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [renoSectionCollapsed, setRenoSectionCollapsed] = useState(true);
  const fetchRef   = useRef(0);
  const patchQueue = useRef<Array<{field:string; year:number|null; value:number|null}>>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  // Rehydrate USER override layer from backend on every successful financials fetch.
  // Conflict policy: session edits (prev) win over backend — so in-flight local edits
  // are never clobbered. When hold period changes and new years become available, the
  // backend overrides for those years are added automatically.
  useEffect(() => {
    if (!financials?.userOverrides) return;
    const fromBackend: Overrides = {};
    for (const [field, yearVals] of Object.entries(financials.userOverrides)) {
      for (const [yrStr, val] of Object.entries(yearVals)) {
        if (val == null) continue;
        const yr = parseInt(yrStr, 10);
        if (isNaN(yr)) continue;
        if (!fromBackend[field]) fromBackend[field] = {};
        fromBackend[field][yr] = val;
      }
    }
    setOverrides(prev => {
      // Backend as base; session edits win per-cell
      const merged: Overrides = { ...fromBackend };
      for (const [field, yearVals] of Object.entries(prev)) {
        if (!merged[field]) merged[field] = {};
        for (const [yr, val] of Object.entries(yearVals)) {
          merged[field][parseInt(yr)] = val;
        }
      }
      return merged;
    });
  }, [financials?.userOverrides]);

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

  const loadNarrativeBlocks = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { narrative: string | null; blocks: F9NarrativeBlock[]; source: string; fresh: boolean };
      }>(`/api/v1/deals/${dealId}/financials/narrative`);
      setNarrativeBlocks(res.data?.data?.blocks ?? []);
    } catch { /* non-fatal */ }
  }, [dealId]);

  // Sync capital-stack guidance inputs from freshly-loaded financials (first load only).
  // Session edits win — if the user has already typed something we don't clobber it.
  useEffect(() => {
    if (!financials?.capitalStack) return;
    const cs = financials.capitalStack;
    setCsLocal(prev => ({
      purchasePrice:     prev.purchasePrice     || (cs.purchasePrice     != null ? String(Math.round(cs.purchasePrice)) : ''),
      ltcPct:            prev.ltcPct            || (cs.ltcPct            != null ? (cs.ltcPct * 100).toFixed(2)         : ''),
      interestRate:      prev.interestRate      || (cs.interestRate      != null ? (cs.interestRate * 100).toFixed(3)   : ''),
      ioPeriodMonths:    prev.ioPeriodMonths    || (cs.ioPeriodMonths    != null ? String(cs.ioPeriodMonths)            : ''),
      amortizationYears: prev.amortizationYears || (cs.amortizationYears != null ? String(cs.amortizationYears)        : ''),
    }));
  }, [financials]);

  // Initial-load fetch: keyed strictly on dealId. We deliberately exclude
  // `fetchFinancials` from deps because that callback closes over
  // `holdYears` — including it would cause a fetch every time holdYears
  // changes via inputs, duplicating the holdTab-toggle effect below and
  // racing with debounced PATCH writes from enqueuePatch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFinancials(); }, [dealId]);
  useEffect(() => { loadNarrativeBlocks(); }, [loadNarrativeBlocks]);
  // Hold-tab toggle: explicitly passes the new holdYears so this is the
  // only call site that should refire on tab change. Excluded from deps
  // for the same reason as above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (holdTab) fetchFinancials(holdYears); }, [holdTab]);

  // F9 Tier-1: enqueuePatch can now ride a `rationale` along with the
  // value. The backend persists it in per_year_overrides as a sibling
  // `rationale:{field}:{year}` key so dismissed hard-warning justifications
  // survive reload. Existing call sites that don't pass `rationale` keep
  // the prior contract — no rationale write happens server-side.
  const enqueuePatch = useCallback((
    field: string,
    year: number|null,
    value: number|null,
    rationale?: string,
  ) => {
    patchQueue.current.push(
      rationale != null ? { field, year, value, rationale } : { field, year, value },
    );
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(async () => {
      const patches = patchQueue.current.splice(0);
      await Promise.allSettled(patches.map(p =>
        apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, p)
      ));
      fetchFinancials(holdYears);
    }, 600);
  }, [dealId, holdYears, fetchFinancials]);

  // Patch a capital-stack guidance field to the backend (year: null = deal-level).
  const patchCapStack = useCallback((field: string, rawVal: string) => {
    const v = parseFloat(rawVal.replace(/,/g, ''));
    if (isNaN(v)) return;
    const normalized = (field === 'ltcPct' || field === 'interestRate') ? +(v / 100).toFixed(6) : v;
    enqueuePatch(field, null, normalized);
  }, [enqueuePatch]);

  // ── Backend-driven row derivation from proforma.year1 ──────────────────────
  // Sections 1 & 3: rows derived from financials.proforma.year1 + FIELD_META
  const { revRows, opexRows } = useMemo((): { revRows: RowDef[]; opexRows: RowDef[] } => {
    if (!financials) return { revRows: [], opexRows: [] };
    const year1 = financials.proforma.year1;
    const revRows = REVENUE_ORDER
      .map(field => {
        const osRow = year1.find(r => r.field === field);
        if (!osRow) return null;
        const meta = FIELD_META[field] ?? { unit: 'dollar' as const, format: fmtDlr };
        return buildRowDef(osRow, 5, meta);
      })
      .filter((r): r is RowDef => r !== null);
    const opexRows = OPEX_ORDER
      .map(field => {
        const osRow = year1.find(r => r.field === field);
        if (!osRow) return null;
        const meta = FIELD_META[field] ?? { unit: 'dollar' as const, format: fmtDlr };
        return buildRowDef(osRow, 6, meta);
      })
      .filter((r): r is RowDef => r !== null);
    return { revRows, opexRows };
  }, [financials]);

  // Combined rows for all sections (used for bulk actions) — excludes readonly financing (sec 9)
  const allRows = useMemo(() => [
    ...revRows,
    ...STATIC_ROWS.filter(r => r.section === 5),  // M07 Traffic Intel within Revenue
    ...opexRows,
    ...STATIC_ROWS.filter(r => r.section === 7 || r.section === 8),  // Capex + Disposition
  ], [revRows, opexRows]);

  // ── F9 Tier-1: Seed confidence bands per editable cell from EVERY editable
  //    row (revRows + STATIC_ROWS + opexRows), keyed `{field}:{year}`.  This
  //    is the σ_model approximation we ship until M14 emits server-side bands
  //    (spec §9 / §14):
  //      sigma_model    = |forecast| × (1 - confidence/100) × 0.5
  //      sigma_sparsity = |forecast| × 0.05  when M07 is offline
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!financials) return;
    const next: Record<string, ConfidenceBands> = {};
    const sparsityFactor = trafficOffline ? 0.05 : 0;
    const editableRows = [
      ...revRows,
      ...STATIC_ROWS.filter(r => !r.readonly),
      ...opexRows,
    ];
    for (const rd of editableRows) {
      if (rd.readonly) continue;
      const conf = (rd.getConfidence?.(financials) ?? 60) / 100;
      const slack = Math.max(0, 1 - conf) * 0.5;
      for (const yr of years) {
        // Refusal-aware: if the row is REFUSED the platform isn't an
        // acceptable forecast anchor, so fall through to broker. The
        // caller below skips when forecast is null.
        const forecast = (refusalReasons[rd.key] ? null : rd.getPlatform(financials, yr))
          ?? rd.getBroker(financials, yr);
        if (forecast == null) continue;
        const absForecast = Math.abs(forecast);
        const sigmaModel = absForecast * slack;
        const sigmaSparsity = absForecast * sparsityFactor;
        next[`${rd.key}:${yr}`] = computeConfidenceBands({
          forecast,
          sigmaModel,
          sigmaSparsity,
        });
      }
    }
    setConfidenceBands(next);
    // refusalReasons in deps so refused rows get re-seeded (skipped) once
    // the refusal effect resolves; otherwise platform-anchored bands would
    // linger from the initial render before refusal was computed.
  }, [financials, years, trafficOffline, revRows, opexRows, setConfidenceBands, refusalReasons]);

  // ── F9 Tier-1: Evaluate the refusal threshold per editable row using the
  //    observable signals we have today (spec §9). Until M14 surfaces real
  //    comp/history counts these are intentionally conservative proxies:
  //      stabilizedComps  ≈ # of years where the row has a platform forecast
  //      historyYears     ≈ # of years where the row has a broker anchor
  //      hasAssetClassRep = false when this is an M07 row and traffic is offline
  //    When evaluateRefusal returns refuse=true the row is rendered with a
  //    REFUSED badge and the platform stops emitting a value (the cell will
  //    fall through to the broker layer or "—").
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!financials) {
      setRefusalReasons({});
      return;
    }
    const next: Record<string, string | null> = {};
    const editableRows = [
      ...revRows,
      ...STATIC_ROWS.filter(r => !r.readonly),
      ...opexRows,
    ];
    for (const rd of editableRows) {
      let stabilizedComps = 0;
      let historyYears = 0;
      for (const yr of years) {
        if (rd.getPlatform(financials, yr) != null) stabilizedComps += 1;
        if (rd.getBroker(financials, yr)   != null) historyYears   += 1;
      }
      const hasAssetClassRep = !(rd.isM07 && trafficOffline);
      const decision = evaluateRefusal({ stabilizedComps, historyYears, hasAssetClassRep });
      next[rd.key] = decision.refuse ? (decision.message ?? 'Insufficient data') : null;
    }
    setRefusalReasons(next);
  }, [financials, years, revRows, opexRows, trafficOffline, setRefusalReasons]);

  // ── F9 Tier-1: classify every active user override against the band and
  //    upsert / clear `override:{field}:{year}:{valueHash}` flags.  The value
  //    fingerprint in the id ensures that a previously-dismissed flag cannot
  //    suppress a new warning when the override value changes — stale ids
  //    drop out of the `seen` set and get removed.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!financials) return;
    const seen = new Set<string>();
    // Build a quick lookup of label by key so flag messages stay readable
    // for backend-derived rows too (revRows / opexRows).
    const labelByKey: Record<string, string> = {};
    for (const r of [...revRows, ...STATIC_ROWS, ...opexRows]) labelByKey[r.key] = r.label;

    for (const [field, yearVals] of Object.entries(overrides)) {
      for (const [yrStr, val] of Object.entries(yearVals)) {
        if (val == null) continue;
        const yr = parseInt(yrStr, 10);
        if (isNaN(yr)) continue;
        const bandKey = `${field}:${yr}`;
        const result = classifyFieldOverride(bandKey, val);
        if (!result || result.classification === 'within') continue;
        // Pull the current bands directly from the store so the message can
        // quote the active P10/P25/P75/P90 — the classifier itself only
        // exposes `zDistance` per the OverrideClassificationResult contract.
        const bands = useDealStore.getState().confidenceBands[bandKey];
        if (!bands) continue;
        const valueHash = Math.round(val * 1e6);
        const flagId = `override:${bandKey}:${valueHash}`;
        seen.add(flagId);
        const sev = result.classification === 'hard_warning' ? 'high' : 'medium';
        const label = labelByKey[field] ?? field;
        // Rehydrate any previously-saved rationale for this exact (field,year)
        // pair so the FlagRow note input prefills with the buyer's prior
        // justification across page reloads (spec §9 audit trail).
        const savedRationale =
          financials?.userOverrideRationales?.[field]?.[yr] ?? undefined;
        const flag: ValidationFlag = {
          id: flagId,
          source: 'override',
          severity: sev,
          field,
          message:
            `${label} (Yr ${yr}) override ${(val * 100).toFixed(2)}% ` +
            (result.classification === 'hard_warning'
              ? `is outside the P10–P90 band (${(bands.p10 * 100).toFixed(2)}%–${(bands.p90 * 100).toFixed(2)}%). Justification required.`
              : `is outside the P25–P75 band (${(bands.p25 * 100).toFixed(2)}%–${(bands.p75 * 100).toFixed(2)}%).`),
          data: {
            classification: result.classification,
            zDistance: result.zDistance,
            bands,
            value: val,
          },
          raisedAt: new Date().toISOString(),
          ...(savedRationale ? { justification: savedRationale } : {}),
        };
        upsertValidationFlag(flag);
      }
    }
    // Clear any override:* flags whose id no longer corresponds to an
    // active override (either removed or value changed).
    for (const f of useDealStore.getState().validationFlags) {
      if (f.source === 'override' && !seen.has(f.id)) removeValidationFlag(f.id);
    }
    // We intentionally read validationFlags via getState() above instead of
    // putting it in deps — that would re-trigger this effect every time we
    // upsert/remove a flag and create a feedback loop.
  }, [overrides, financials, revRows, opexRows, classifyFieldOverride, upsertValidationFlag, removeValidationFlag]);

  // F9 Tier-1: handler invoked by F9ProtectorsPanel's FlagRow when the
  // buyer ACKs a hard-warning override flag. Persists the justification
  // to the user-assumption layer (PATCH with rationale) so it survives
  // page reload and feeds the audit trail.
  //
  // IMPORTANT — display↔patch normalization: a few rows display one unit
  // but PATCH expects another. The canonical case today is `stabilizedOcc`
  // which displays occupancy but maps to `patchField: 'vacancyPct'`
  // (vacancy = 1 − occupancy). We mirror the same +(1 − v).toFixed(4)
  // transform used in handleUsePlatform/handleUseBroker so ACK never
  // overwrites vacancy with occupancy.
  const handleAckOverride = useCallback((field: string, year: number, rationale: string) => {
    if (!rationale.trim()) return;
    const currentVal = overrides[field]?.[year] ?? null;
    if (currentVal == null) return;
    const row = [...revRows, ...STATIC_ROWS, ...opexRows].find(r => r.key === field);
    if (!row?.patchField) return;
    const patchVal = field === 'stabilizedOcc' ? +(1 - currentVal).toFixed(4) : currentVal;
    enqueuePatch(row.patchField, year, patchVal, rationale.trim());
  }, [overrides, revRows, opexRows, enqueuePatch]);

  const getUser    = (key: string, yr: number) => overrides[key]?.[yr] ?? null;
  const getMode    = (key: string): RowMode => rowModes[key] ?? 'stepped';
  const getFormula = (key: string) => formulas[key] ?? '';

  /**
   * F9 Tier-1 §9 refusal enforcement: when a row is REFUSED, the platform
   * MUST stop forecasting for that row. Every consumer that previously
   * read `rd.getPlatform(financials, yr)` should go through this wrapper
   * so cell rendering, drawer payload, protector inputs, and formula
   * evaluation all collapse to broker → user only.
   *
   * The refusal effect itself + the band-seeding effect intentionally
   * keep raw access (they need the underlying counts to compute refusal
   * and to skip refused rows respectively).
   */
  const resolvePlatform = useCallback((rd: RowDef, yr: number): number | null => {
    if (!financials) return null;
    if (refusalReasons[rd.key]) return null;
    return rd.getPlatform(financials, yr);
  }, [financials, refusalReasons]);

  const computeFormulaResult = useCallback((rd: RowDef, yr: number): number|null => {
    const expr = getFormula(rd.key);
    if (!expr || getMode(rd.key) !== 'formula') return null;
    const yearVals: Record<number, number|null> = {};
    for (const y of years) {
      yearVals[y] = getUser(rd.key, y) ?? (financials ? resolvePlatform(rd, y) ?? rd.getBroker(financials, y) : null);
    }
    return evalFormula(expr, {
      base:     financials ? rd.getBroker(financials, yr)   : null,
      platform: financials ? resolvePlatform(rd, yr)        : null,
      yearVals,
    });
    // resolvePlatform in deps so refused-row formula evaluation re-runs
    // when refusal state changes. getFormula/getMode/getUser are inline
    // closures over (formulas, rowModes, overrides) which are already
    // tracked, so they're effectively covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulas, rowModes, overrides, financials, years, resolvePlatform]);

  const handleApply = useCallback((
    rd: RowDef, yr: number, val: number|null, applyAll: boolean,
    layer: 'broker'|'platform'|'user'|'formula',
  ) => {
    if (layer === 'formula') return; // formula handled by onFormulaChange
    const mode = getMode(rd.key);
    const targetYears = (applyAll || mode === 'flat') ? years : [yr];
    setOverrides(prev => {
      const next = { ...prev, [rd.key]: { ...(prev[rd.key] ?? {}) } };
      for (const y of targetYears) next[rd.key][y] = val;
      return next;
    });
    if (rd.patchField) {
      // stabilizedOcc displays occupancy (1 - vacancyPct) but patchField is 'vacancyPct'.
      // Convert before PATCH so we store vacancy, not occupancy.
      const patchVal = (rd.key === 'stabilizedOcc' && val != null) ? +(1 - val).toFixed(4) : val;
      for (const y of targetYears) enqueuePatch(rd.patchField, y, patchVal);
    }
    // getMode is an inline closure over rowModes (already in deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years, rowModes, enqueuePatch]);

  // Formula mode: save expression AND persist computed results via PATCH
  const handleFormulaChange = useCallback((rowKey: string, expr: string) => {
    setFormulas(f => ({ ...f, [rowKey]: expr }));
    setRowModes(m => ({ ...m, [rowKey]: 'formula' }));
    // Persist formula results to backend via PATCH
    if (!financials || !expr) return;
    const rd = allRows.find(r => r.key === rowKey);
    if (!rd?.patchField) return;
    const yearVals: Record<number, number|null> = {};
    for (const y of years) {
      yearVals[y] = resolvePlatform(rd, y) ?? rd.getBroker(financials, y);
    }
    for (const y of years) {
      const result = evalFormula(expr, {
        base:     rd.getBroker(financials, y),
        platform: resolvePlatform(rd, y),
        yearVals,
      });
      if (result != null) {
        enqueuePatch(rd.patchField, y, result);
      }
    }
    // resolvePlatform in deps so apply-formula respects refusal updates.
  }, [financials, allRows, years, enqueuePatch, resolvePlatform]);

  const handleUsePlatform = () => {
    if (!financials || lockedOverrides) return;
    const next: Overrides = { ...overrides };
    for (const rd of allRows) {
      if (rd.readonly) continue;
      // Refusal-aware: skip rows where the platform has refused to forecast.
      if (refusalReasons[rd.key]) continue;
      for (const yr of years) {
        const v = rd.getPlatform(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) {
            // stabilizedOcc getPlatform returns occupancy; PATCH expects vacancy (1 - occ)
            const pv = rd.key === 'stabilizedOcc' ? +(1 - v).toFixed(4) : v;
            enqueuePatch(rd.patchField, yr, pv);
          }
        }
      }
    }
    setOverrides(next);
  };

  const handleUseBroker = () => {
    if (!financials || lockedOverrides) return;
    const next: Overrides = { ...overrides };
    for (const rd of allRows) {
      if (rd.readonly) continue;
      for (const yr of years) {
        const v = rd.getBroker(financials, yr);
        if (v != null) {
          if (!next[rd.key]) next[rd.key] = {};
          next[rd.key][yr] = v;
          if (rd.patchField) {
            // stabilizedOcc getBroker returns occupancy; PATCH expects vacancy (1 - occ)
            const pv = rd.key === 'stabilizedOcc' ? +(1 - v).toFixed(4) : v;
            enqueuePatch(rd.patchField, yr, pv);
          }
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
        platform: resolvePlatform(rd, yr),
        user:     getUser(rd.key, yr),
      },
      formulaExpr: getFormula(rd.key),
    });
    // resolvePlatform in deps so the drawer payload reflects refusal.
    // getUser/getFormula are inline closures over (overrides, formulas)
    // which are already tracked above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financials, overrides, formulas, lockedOverrides, resolvePlatform]);

  const a        = assumptions;
  const dealName = (deal?.['name'] as string) ?? financials?.dealName ?? a?.dealInfo?.dealName ?? 'Deal';
  const units    = financials?.totalUnits ?? a?.dealInfo?.totalUnits ?? 0;
  const location = [a?.dealInfo?.city, a?.dealInfo?.state].filter(Boolean).join(', ');
  const irr      = modelResults?.summary?.irr ?? 0;
  const em       = modelResults?.summary?.equityMultiple ?? 0;
  const m07Conf  = financials?.trafficProjection?.leasingSignals?.confidence;
  const overrideCount = Object.values(overrides).reduce((s, yr) => s + Object.values(yr).filter(v => v != null).length, 0);

  // v2 section assembly (9-section layout; sections 1-4 rendered as KeystonePanel above grid)
  const toggleSection = (sec: number) =>
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec); else next.add(sec);
      return next;
    });

  // Section A = base-year document-sourced inputs (T12 / Rent Roll / Tax Bill / OM).
  // Editing a Section A field cascades through Pro Forma Y1 AND all projection years.
  // Section B = trajectory inputs (Y2+ growth rates, vacancy ramp, CapEx schedule, exit).
  // Editing a Section B field leaves Pro Forma (Year 1) unchanged; only Y2+ moves.
  //
  // Section 5 is SPLIT: revRows (base GPR/vacancy from rent roll) → A;
  // STATIC_ROWS section 5 (M07 Traffic Intel: velocity, derived vacancy, lease-up curve,
  // stabilized occupancy) → B because they drive the Y2+ vacancy ramp / trajectory.
  const allSections: Array<{ id: string; sec: number; label: string; rows: RowDef[]; sectionGroup: 'A' | 'B' }> = [
    { id: '5-base', sec: 5, label: '5  REVENUE  [proforma.year1 · Rent Roll]',
      rows: revRows,                                                                    sectionGroup: 'A' },
    { id: '6',      sec: 6, label: SEC[6],
      rows: opexRows,                                                                   sectionGroup: 'A' },
    // ── Section B starts here ────────────────────────────────────────────────────
    { id: '5-traf', sec: 5, label: '5  REVENUE › M07 TRAFFIC INTEL  [Vacancy Trajectory]',
      rows: STATIC_ROWS.filter(r => r.section === 5),                                  sectionGroup: 'B' },
    { id: '7',      sec: 7, label: SEC[7],
      rows: STATIC_ROWS.filter(r => r.section === 7),                                  sectionGroup: 'B' },
    { id: '8',      sec: 8, label: SEC[8],
      rows: STATIC_ROWS.filter(r => r.section === 8),                                  sectionGroup: 'B' },
    { id: '10',     sec: 10, label: SEC[10],
      rows: STATIC_ROWS.filter(r => r.section === 10),                                 sectionGroup: 'B' },
  ];

  // ── F9 Protector inputs — terminal-year rent growth, exit cap, OPEX growth ─
  // Resolution order matches grid cells: user-override → platform → broker.
  const protectorInputs = useMemo(() => {
    if (!financials) {
      return { exitCap: null, terminalRentGrowth: null, opexGrowth: null, noiMargin: 0.6 };
    }
    const findRow = (key: string) => STATIC_ROWS.find(r => r.key === key);
    const resolve = (key: string, yr: number): number | null => {
      const u = getUser(key, yr);
      if (u != null) return u;
      const row = findRow(key);
      if (!row) return null;
      // Refusal-aware: skip platform when the row is REFUSED so protector
      // inputs (Gordon, NOI identity, etc.) don't anchor on a forecast the
      // platform has explicitly declined to make.
      return resolvePlatform(row, yr) ?? row.getBroker(financials, yr);
    };
    const terminalYr = financials.assumptions?.holdYears ?? holdYears;
    // Gordon coupling lives at the terminal year — exit cap & terminal g pair.
    const exitCap = resolve('exitCapRate', terminalYr);
    const terminalRentGrowth = resolve('growthRentPct', terminalYr);
    // NOI identity must use a single-period basis to stay algebraically
    // honest.  Y2 is the first stabilized year for both rent and OPEX
    // growth in our seed model — using terminal rent growth with Y2 OPEX
    // would mix horizons and misstate the identity.
    const stabilizedYr = 2;
    const noiIdentityRentGrowth = resolve('growthRentPct', stabilizedYr);
    const opexGrowth = resolve('growthOpexPct', stabilizedYr);
    const y1 = financials.proforma.year1;
    const noiCell = y1?.find(r => r.field === 'net_operating_income') ?? y1?.find(r => r.field === 'noi');
    const egiCell = y1?.find(r => r.field === 'effective_gross_income') ?? y1?.find(r => r.field === 'egi');
    const noi = noiCell?.platform ?? noiCell?.broker;
    const egi = egiCell?.platform ?? egiCell?.broker;
    const noiMargin = noi != null && egi != null && egi > 0 ? noi / egi : 0.6;
    return {
      exitCap,
      terminalRentGrowth,
      noiIdentityRentGrowth,
      opexGrowth,
      noiMargin,
    };
    // resolvePlatform in deps so protector inputs (Gordon, NOI identity)
    // re-derive when refusal state changes for any of the underlying rows.
    // getUser is an inline closure over `overrides` which is already tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financials, overrides, holdYears, resolvePlatform]);

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs overflow-hidden" style={{ fontFamily: 'system-ui,sans-serif' }}>
      {/* Header — Row 1: title + deal info + hold tabs + actions */}
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
          {/* Hold period tabs */}
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

      {/* Header — Row 2: view mode toggle + Y1 source picker + PUSH → PROJECTIONS */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0f0f0f] border-b border-[#1e1e1e] sticky top-[36px] z-29">
        {/* BROKER VIEW / BUILD YOUR OWN toggle */}
        <div style={{ display: 'flex', background: '#1a1a1a', padding: 2, borderRadius: 3, border: '1px solid #2a2a2a' }}>
          {(['BROKER_VIEW', 'BUILD_OWN'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: '3px 10px', fontSize: 9, fontWeight: 700, borderRadius: 2, border: 'none', cursor: 'pointer',
              fontFamily: MONO, letterSpacing: '0.06em', transition: 'all 0.15s',
              background: viewMode === mode ? (mode === 'BROKER_VIEW' ? 'rgba(180,83,9,0.5)' : 'rgba(29,78,216,0.5)') : 'transparent',
              color: viewMode === mode ? (mode === 'BROKER_VIEW' ? '#fcd34d' : '#bfdbfe') : '#475569',
            }}>
              {mode === 'BROKER_VIEW' ? 'BROKER VIEW' : 'BUILD YOUR OWN'}
            </button>
          ))}
        </div>
        <Y1SourcePicker />
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { onAssumptionsChange?.({}); fetchFinancials(holdYears); }}
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            padding: '3px 12px', borderRadius: 3, cursor: 'pointer',
            background: 'rgba(34,197,94,0.15)', color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          PUSH → PROJECTIONS
        </button>
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
          Traffic Engine offline — Revenue section (M07 Traffic Intel) platform signals unavailable. Showing broker layer only.
        </div>
      )}

      {/* Keystone Panel — Sections 1-4: deal-level constants above the per-year grid */}
      {financials && (
        <KeystonePanel
          financials={financials}
          deal={deal}
          assumptions={assumptions}
          collapsed={collapsedSections}
          onToggle={toggleSection}
        />
      )}

      {/* F9 Tier-1 Protectors: Gordon coupling + NOI identity + override flags */}
      {financials && (
        <F9ProtectorsPanel
          exitCap={protectorInputs.exitCap}
          terminalRentGrowth={protectorInputs.terminalRentGrowth}
          noiIdentityRentGrowth={protectorInputs.noiIdentityRentGrowth}
          opexGrowth={protectorInputs.opexGrowth}
          noiMargin={protectorInputs.noiMargin}
          onAckOverride={handleAckOverride}
        />
      )}

      {/* ── Section A: Deal Timeline ─────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-[#0c0c0c] border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#22d3ee', letterSpacing: '0.1em' }}>
            A — DEAL TIMELINE
          </span>
          <div style={{ flex: 1, borderTop: '1px dashed #22d3ee22' }} />
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#0e7490' }}>seeds hold period · exit waterfall</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label style={{ fontFamily: MONO, fontSize: 8, color: '#64748b', letterSpacing: '0.06em' }}>CLOSE DATE</label>
            <input
              type="date"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              onBlur={e => {
                apiClient.patch(`/api/v1/deals/${dealId}/assumptions/dates`, {
                  closeDate: e.target.value || null, saleDate: saleDate || null,
                }).catch(() => {});
              }}
              style={{
                fontFamily: MONO, fontSize: 9, background: '#1a1a1a', color: '#e2e8f0',
                border: '1px solid #2a2a2a', borderRadius: 3, padding: '2px 6px',
                colorScheme: 'dark',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ fontFamily: MONO, fontSize: 8, color: '#64748b', letterSpacing: '0.06em' }}>TARGET SALE DATE</label>
            <input
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              onBlur={e => {
                apiClient.patch(`/api/v1/deals/${dealId}/assumptions/dates`, {
                  closeDate: closeDate || null, saleDate: e.target.value || null,
                }).catch(() => {});
              }}
              style={{
                fontFamily: MONO, fontSize: 9, background: '#1a1a1a', color: '#e2e8f0',
                border: '1px solid #2a2a2a', borderRadius: 3, padding: '2px 6px',
                colorScheme: 'dark',
              }}
            />
          </div>
          {closeDate && saleDate && (() => {
            const ms = new Date(saleDate).getTime() - new Date(closeDate).getTime();
            const yrs = (ms / (1000 * 60 * 60 * 24 * 365.25));
            return yrs > 0 ? (
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#10b981' }}>
                {yrs.toFixed(1)} yr hold
              </span>
            ) : null;
          })()}
        </div>
      </div>

      {/* ── Section B: Capital Structure Guidance ───────────────────────────── */}
      <div className="px-4 py-2 bg-[#0c0c0c] border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#7c3aed', letterSpacing: '0.1em' }}>
            B — CAPITAL STRUCTURE GUIDANCE
          </span>
          <div style={{ flex: 1, borderTop: '1px dashed #7c3aed33' }} />
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#6d28d9' }}>seeds Debt Tab · optimizer runs independently</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {([
            { key: 'purchasePrice',     label: 'PURCHASE PRICE',  placeholder: '0',      suffix: '$',   hint: 'e.g. 12500000' },
            { key: 'ltcPct',            label: 'LTV %',           placeholder: '65.00',  suffix: '%',   hint: '% of purchase price' },
            { key: 'interestRate',      label: 'RATE %',          placeholder: '6.750',  suffix: '%',   hint: 'senior loan rate' },
            { key: 'ioPeriodMonths',    label: 'I/O PERIOD',      placeholder: '24',     suffix: 'mo',  hint: 'months before amort' },
            { key: 'amortizationYears', label: 'AMORT',           placeholder: '30',     suffix: 'yr',  hint: 'amortization years' },
          ] as Array<{ key: keyof typeof csLocal; label: string; placeholder: string; suffix: string; hint: string }>).map(({ key, label, placeholder, suffix, hint }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <label style={{ fontFamily: MONO, fontSize: 7, color: '#475569', letterSpacing: '0.07em' }}>{label}</label>
              <div className="flex items-center gap-1">
                {suffix === '$' && <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748b' }}>$</span>}
                <input
                  type="text"
                  inputMode="decimal"
                  value={csLocal[key]}
                  placeholder={placeholder}
                  title={hint}
                  onChange={e => setCsLocal(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={e => patchCapStack(key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                  style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    background: '#1a1a1a', color: '#e2e8f0',
                    border: '1px solid #2a2a2a', borderRadius: 3,
                    padding: '2px 5px', width: key === 'purchasePrice' ? 100 : 56,
                    outline: 'none',
                  }}
                />
                {suffix !== '$' && <span style={{ fontFamily: MONO, fontSize: 8, color: '#475569' }}>{suffix}</span>}
              </div>
            </div>
          ))}
          <div className="flex flex-col justify-end ml-2">
            {financials?.capitalStack && (
              <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>
                Loan: {financials.capitalStack.loanAmount != null
                  ? '$' + (financials.capitalStack.loanAmount / 1e6).toFixed(1) + 'M'
                  : '—'}
                {financials.capitalStack.equityAtClose != null && (
                  <>  ·  Equity: ${(financials.capitalStack.equityAtClose / 1e6).toFixed(1)}M</>
                )}
              </span>
            )}
            <span style={{ fontFamily: MONO, fontSize: 6, color: '#1e293b', marginTop: 2 }}>
              ▸ DEBT TAB has final say · these seed the optimizer
            </span>
          </div>
        </div>
      </div>

      {/* Grid + findings */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ fontFamily: MONO }}>
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#1e1e1e]">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 min-w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
                {years.map(yr => (
                  <th key={yr} className="px-2 py-1.5 text-center text-[10px] font-bold border-r border-[#1e1e1e]"
                    style={{ minWidth: 82, fontFamily: MONO,
                      color: yr === 1 ? (y1Source === 'PLATFORM' ? '#22d3ee' : '#f59e0b') : '#64748b' }}>
                    {yr === 1 ? `YR 1 · ${y1Source}` : `YR ${yr}`}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center text-[8px] font-bold text-slate-600" style={{ minWidth: 48 }}>MODE</th>
              </tr>
            </thead>
            <tbody>
              {/* Deal-type specific section: Renovation/Development costs */}
              {dealType !== 'existing' && (
                <RenovationAssumptionsSection
                  dealId={dealId}
                  dealType={dealType}
                  collapsed={renoSectionCollapsed}
                  onToggle={() => setRenoSectionCollapsed(c => !c)}
                />
              )}
              {allSections.map(({ id, sec, label, rows, sectionGroup }, idx) => {
                const isCollapsed = collapsedSections.has(sec);
                const isSectionBStart =
                  sectionGroup === 'B' &&
                  (idx === 0 || allSections[idx - 1].sectionGroup === 'A');
                const sectionTooltip = sectionGroup === 'A'
                  ? 'SECTION A — BASE YEAR (Document Sources). Editing fields here recomputes Pro Forma Y1 and cascades through all projection years.'
                  : 'SECTION B — TRAJECTORY (Y2+ Inputs). Editing fields here affects Year 2+ only; Pro Forma (Year 1) is unchanged.';
                return (
                  <React.Fragment key={id}>
                    {/* ── Section A header — only before the very first section (idx 0) */}
                    {idx === 0 && (
                      <tr>
                        <td
                          colSpan={years.length + 2}
                          style={{ padding: '6px 12px 2px', background: '#0a0a0a' }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}>
                            <span style={{
                              fontFamily: MONO,
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#22d3ee',
                              letterSpacing: '0.1em',
                              whiteSpace: 'nowrap',
                            }}>
                              A — BASE YEAR · DOCUMENT SOURCES
                            </span>
                            <div style={{ flex: 1, borderTop: '1px dashed #22d3ee22' }} />
                            <span style={{ fontFamily: MONO, fontSize: 7, color: '#0e7490', whiteSpace: 'nowrap' }}>
                              edits here cascade through all projection years
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* ── Section B divider — visible boundary between Base Year and Trajectory panels */}
                    {isSectionBStart && (
                      <tr>
                        <td
                          colSpan={years.length + 2}
                          style={{ padding: '10px 12px 4px', background: '#0a0a0a' }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            borderTop: '1px solid #7c3aed44',
                            paddingTop: 8,
                          }}>
                            <span style={{
                              fontFamily: MONO,
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#7c3aed',
                              letterSpacing: '0.1em',
                              whiteSpace: 'nowrap',
                            }}>
                              B — TRAJECTORY · Y2+ INPUTS
                            </span>
                            <div style={{ flex: 1, borderTop: '1px dashed #7c3aed33' }} />
                            <span style={{ fontFamily: MONO, fontSize: 7, color: '#6d28d9', whiteSpace: 'nowrap' }}>
                              edits here leave Pro Forma Y1 unchanged
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className="bg-[#181818] border-y border-[#1e1e1e] h-[22px] cursor-pointer hover:bg-[#1e1e1e] select-none"
                      onClick={() => toggleSection(sec)}
                      title={sectionTooltip}
                    >
                      <td colSpan={years.length + 2} className="px-3 py-1 text-[11px] font-bold text-slate-300 sticky left-0 bg-[#181818]">
                        <span className="flex items-center gap-2">
                          {isCollapsed
                            ? <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                            : <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                          }
                          {label}
                          {sectionGroup === 'B' && (
                            <span className="ml-2 text-[7px] font-normal border rounded px-1" style={{ color: '#7c3aed', borderColor: '#7c3aed44' }}>
                              Y2+ ONLY
                            </span>
                          )}
                          <span className="ml-auto text-[8px] font-normal text-slate-600">{rows.length} rows</span>
                        </span>
                      </td>
                    </tr>
                    {!isCollapsed && rows.map(rd => {
                      const mode = getMode(rd.key);
                      return (
                        <tr key={rd.key} className="border-b border-[#1e1e1e]/40 hover:bg-[#0f0f0f] h-[26px]">
                          <td className="px-3 py-0.5 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
                            <span className="flex items-center gap-1.5 truncate">
                              {rd.readonly && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                              {rd.isM07 && !rd.readonly && <span style={{ fontFamily: MONO, fontSize: 6, color: '#7e22ce', border: '1px solid #4c1d95', borderRadius: 2, padding: '0 2px', flexShrink: 0 }}>M07</span>}
                              {mode === 'formula' && <FlaskConical className="w-2.5 h-2.5 text-teal-500 shrink-0" />}
                              {/* F9 Tier-1 §9: REFUSED chip surfaces when evaluateRefusal()
                                  determines the platform lacks the comp/history support to
                                  forecast this row honestly. Hover for the reason. */}
                              {refusalReasons[rd.key] && (
                                <span
                                  title={refusalReasons[rd.key] ?? ''}
                                  style={{ fontFamily: MONO, fontSize: 6, color: '#fca5a5', border: '1px solid #b91c1c', backgroundColor: 'rgba(127,29,29,0.25)', borderRadius: 2, padding: '0 2px', flexShrink: 0, fontWeight: 700, letterSpacing: '0.05em' }}
                                >
                                  REFUSED
                                </span>
                              )}
                              <span className="truncate">{rd.label}</span>
                            </span>
                          </td>
                          {years.map(yr => {
                            const broker       = financials ? rd.getBroker(financials, yr)   : null;
                            const platform     = resolvePlatform(rd, yr);
                            const user         = getUser(rd.key, yr);
                            const formulaResult = mode === 'formula' ? computeFormulaResult(rd, yr) : null;
                            const divergence = getDivergenceColor(
                              formulaResult ?? user, platform, broker,
                            );
                            const ovrVal = formulaResult ?? user;
                            const classification = ovrVal != null
                              ? classifyFieldOverride(`${rd.key}:${yr}`, ovrVal)?.classification ?? null
                              : null;
                            return (
                              <LayeredCell key={yr}
                                vals={{ broker, platform, user }}
                                format={rd.format}
                                readonly={rd.readonly || lockedOverrides}
                                isM07={!!rd.isM07}
                                divergence={divergence}
                                formulaResult={formulaResult}
                                classification={classification}
                                onClick={() => openDrawer(rd, yr)}
                              />
                            );
                          })}
                          <td className="px-0.5 py-0.5 text-center">
                            {!rd.readonly && (
                              <div className="flex gap-0.5 justify-center">
                                {(['flat','stepped','formula'] as RowMode[]).map(m => {
                                  const isActive = mode === m;
                                  return (
                                    <button key={m}
                                      onClick={() => setRowModes(s => ({ ...s, [rd.key]: m }))}
                                      title={m === 'formula' ? 'Formula mode' : m === 'flat' ? 'Flat: Y1 propagates' : 'Stepped: per-year'}
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
                    {!isCollapsed && sec === 5 && <GprDecompRow years={years} financials={financials} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <FindingsRail financials={financials} narrativeBlocks={narrativeBlocks} />
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
          <span>F9 · {financials?.meta?.seeded ? 'SEEDED' : 'NO SEED'}</span>
          <span className={`w-2 h-2 rounded-full ${financials?.meta?.seeded ? 'bg-green-500/30 border border-green-500/50' : 'bg-slate-700'}`} />
        </div>
      </div>

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
