// ============================================================================
// JEDI RE — Asset Hub Console  (Phase A: shell, IA & drawers — synthetic data)
// Replaces AssetOwnedPage.tsx as the primary owned-asset view.
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart,
} from 'recharts';
import { useDealStore } from '../stores/dealStore';
import { apiClient } from '../services/api.client';
import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { TeamSection } from '../components/deal/sections/TeamSection';
import { EventTimelineSection } from '../components/deal/sections/EventTimelineSection';
import { LifecycleSection } from '../components/deal/sections/LifecycleSection';
import { ExitTimingTab } from '../components/deal/sections/ExitTimingTab';
import ActivityTab from './admin/sections/intel/ActivityTab';
import type { Deal } from '../types/deal';

// ── DESIGN TOKENS (verbatim from v5 prototype) ──────────────────────────────
const T = {
  bg: {
    terminal: '#0A0E17', panel: '#0F1319', panelAlt: '#131821',
    header: '#1A1F2E', hover: '#1E2538', active: '#252D40',
    input: '#0D1117', topBar: '#050810',
  },
  text: {
    primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568',
    amber: '#F5A623', amberBright: '#FFD166', green: '#00D26A',
    red: '#FF4757', cyan: '#00BCD4', orange: '#FF8C42',
    purple: '#A78BFA', white: '#FFFFFF',
  },
  border: { subtle: '#1E2538', medium: '#2A3348', bright: '#3B4A6B' },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
    display: "'IBM Plex Mono',monospace",
    label: "'IBM Plex Sans',sans-serif",
  },
};

// ── BEAT PLAN TYPES (mirrors backend revenue-engine.service.ts) ──────────────
type RepricingAction = 'PUSH' | 'HOLD' | 'CONCEDE';
interface NOIBridgeStep { label: string; amount: number; }
interface CohortRecommendation {
  unitType: string; units: number; inPlaceRent: number; marketRent: number;
  signalScore: number; recommendedRent: number; deltaPerUnit: number;
  action: RepricingAction; annualEGIContribution: number; reason: string;
}
interface ExpenseFinding {
  label: string; category: 'controllable' | 'nonControllable';
  uwTarget: number; actualRunRate: number; variancePct: number;
  flagged: boolean; projectedLine: number; recoveryAnnual: number; note: string;
}
interface BeatPlan {
  status: 'BEAT' | 'ON_TRACK' | 'AT_RISK';
  proFormaNOI: number; projectedNOI: number; beatAnnual: number; beatPct: number;
  revenueLeverAnnual: number; expenseRecoveryAnnual: number; acceptedExpenseDragAnnual: number;
  bridge: NOIBridgeStep[];
  revenue: CohortRecommendation[];
  expense: ExpenseFinding[];
  caveats: string[];
  compSetSource: string | null;  // provenance label when comp-set market rents were wired in
}

const CSS_INJECT = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 9px #00D26A66}}
@keyframes glowA{0%,100%{box-shadow:0 0 4px #F5A62344}50%{box-shadow:0 0 9px #F5A62366}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17;box-sizing:border-box}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348}
`;

// ── ASSET IDENTITY ───────────────────────────────────────────────────────────
const ASSET = {
  ticker: 'HLND',
  name: 'Highlands at Sweetwater Creek',
  addr: 'Lithia Springs · West Atlanta MSA',
  units: 290,
  mode: 'STABILIZED',
};

// ── REVENUE DATA (synthetic prototype) ──────────────────────────────────────
const SERIES = (() => {
  const labels = ['N23','D23','J24','F24','M24','A24','Y24','J24','L24','G24','S24','O24','N24','D24','J25','F25','M25','A25','Y25','J25','L25','G25','S25','O25','N25','D25','J26','F26','M26','A26'];
  const occ = [78.1,79.4,81.0,82.6,84.1,85.9,87.2,88.4,89.6,90.5,91.2,91.9,92.4,92.8,93.1,93.4,93.0,93.6,93.9,94.1,94.0,94.3,94.5,94.2,94.4,94.6,94.1,94.3,94.5,94.2];
  return labels.map((m, i) => {
    const rent = Math.round(1455 + i * 9.2 + (i > 14 ? (i - 14) * 3 : 0));
    const noi  = Math.round((182 + i * 6.1 + (i > 12 ? (i - 12) * 2.4 : 0)) * 1000);
    return {
      m, occ: occ[i], rent, noi,
      revpau: Math.round(rent * (occ[i] / 100) * 0.985),
      ltl: +(Math.min(6.6, 1.8 + i * 0.17).toFixed(1)),
      conc: +(Math.max(1.4, 6.2 - i * 0.18).toFixed(1)),
      tro: +(1.2 + i * 0.18 + (i % 4 === 0 ? 0.6 : 0)).toFixed(1),
    };
  });
})();

const METRICS = [
  { key: 'occ',    tile: 'OCC',          val: '94.2%',  color: T.text.cyan,   fmt: (v: number) => v.toFixed(1) + '%' },
  { key: 'rent',   tile: 'EFF RENT',     val: '$1,712', color: T.text.green,  fmt: (v: number) => '$' + v.toLocaleString() },
  { key: 'noi',    tile: 'NOI TTM',      val: '$3.41M', color: T.text.amber,  fmt: (v: number) => '$' + (v / 1000).toFixed(0) + 'K' },
  { key: 'revpau', tile: 'RevPAU',       val: '$1,612', color: T.text.primary, fmt: (v: number) => '$' + v.toLocaleString() },
  { key: 'ltl',    tile: 'LOSS-TO-LEASE', val: '6.4%', color: T.text.amber,  fmt: (v: number) => v.toFixed(1) + '%' },
  { key: 'conc',   tile: 'CONCESSIONS',  val: '$25/u',  color: T.text.orange, fmt: (v: number) => '$' + Math.round(v) + '/u' },
];

const TIMEFRAMES: [string, number][] = [['3M', 3], ['6M', 6], ['1Y', 12], ['2Y', 24], ['MAX', 30]];

const OVERVIEW = [
  { label: 'Units',          value: '290' },
  { label: 'Physical Occ.', value: '94.2%' },
  { label: 'Economic Occ.', value: '91.8%', tone: T.text.amber },
  { label: 'In-Place Rent', value: '$1,712' },
  { label: 'Market Rent',   value: '$1,830', tone: T.text.green },
  { label: 'Loss-to-Lease', value: '6.4%',  sub: '$19.8K/mo', tone: T.text.amber },
  { label: 'Concessions',   value: '1.5%',  sub: '$0.4K/mo',  tone: T.text.orange },
  { label: 'RevPAU',        value: '$1,612' },
  { label: 'NOI (TTM)',     value: '$3.41M' },
  { label: 'In-Place Cap',  value: '5.2%' },
  { label: 'DSCR',          value: '1.48x',  tone: T.text.green },
  { label: 'JEDI Score',    value: '84',     tone: T.text.green, sub: '+3 / 90d' },
];

const RANK = { current: 4, currentPCS: 84, set: 12, setLabel: 'Class B · 200–350u · West ATL' };
const PCS_BY_RANK: Record<number, number> = { 1: 95, 2: 91, 3: 87, 4: 84 };
const TARGET_META: Record<number, { captured: string; lift: string; revGap: string }> = {
  4: { captured: '$11.8K', lift: '+1.2%', revGap: '$0/u' },
  3: { captured: '$14.2K', lift: '+1.9%', revGap: '+$34/u' },
  2: { captured: '$18.6K', lift: '+3.1%', revGap: '+$88/u' },
  1: { captured: '$22.1K', lift: '+4.4%', revGap: '+$142/u' },
};

const COHORTS = [
  { type: '2BR', units: 38, window: 'Aug–Oct',   ladder: ['PUSH +$60', 'PUSH +$95', 'PUSH +$140', 'PUSH +$185'], reason: 'Wages +4.2% vs rents +2.1% · traffic velocity +8% · no nearby deliveries to \'27' },
  { type: '1BR', units: 22, window: 'Q1 \'26',   ladder: ['HOLD', 'HOLD', 'PUSH +$45', 'PUSH +$80'],             reason: 'Comp concessions rising · 480 units delivering 1.1mi out by Q2' },
  { type: '3BR', units: 9,  window: 'Sep–Nov',   ladder: ['PUSH +$40', 'PUSH +$60', 'PUSH +$95', 'PUSH +$130'],  reason: 'Tight comp supply · sustained 96%+ occupancy in segment' },
  { type: 'STU', units: 6,  window: 'Dec \'25',  ladder: ['CONCEDE −2wk', 'CONCEDE −2wk', 'HOLD', 'PUSH +$30'], reason: 'Retention play · sentiment dip, protect occupancy' },
];

const LEASE_ROLL = [
  { month: 'Aug \'25', type: '2BR', units: 14, inPlace: '$1,690', market: '$1,795', spread: '+6.2%', action: 'PUSH' },
  { month: 'Sep \'25', type: '2BR', units: 13, inPlace: '$1,705', market: '$1,800', spread: '+5.6%', action: 'PUSH' },
  { month: 'Sep \'25', type: '3BR', units: 5,  inPlace: '$2,080', market: '$2,160', spread: '+3.8%', action: 'PUSH' },
  { month: 'Oct \'25', type: '2BR', units: 11, inPlace: '$1,712', market: '$1,810', spread: '+5.7%', action: 'PUSH' },
  { month: 'Nov \'25', type: '1BR', units: 9,  inPlace: '$1,395', market: '$1,420', spread: '+1.8%', action: 'HOLD' },
  { month: 'Dec \'25', type: 'STU', units: 6,  inPlace: '$1,180', market: '$1,165', spread: '−1.3%', action: 'CONCEDE' },
];

const SIGNALS = [
  { name: 'Traffic Velocity',  value: '+8.2%',  dir: 'up',   lead: '3–6mo',   tone: T.text.green,  src: 'M07' },
  { name: 'Digital Share',     value: '31%',    dir: 'up',   lead: '1–3mo',   tone: T.text.green,  src: 'COR-16' },
  { name: 'Wage vs Rent',      value: '+2.1pp', dir: 'up',   lead: '12–18mo', tone: T.text.green,  src: 'COR-04' },
  { name: 'Supply Pipeline',   value: '4.8%',   dir: 'flat', lead: '6–18mo',  tone: T.text.cyan,   src: 'COR-06' },
  { name: 'Comp Concessions',  value: '+1.2wk', dir: 'up',   lead: 'lead',    tone: T.text.amber,  src: 'comps' },
  { name: 'Pop. In-Migration', value: '+3.4%',  dir: 'up',   lead: '12–24mo', tone: T.text.green,  src: 'Census' },
];

const DEFAULT_COMPS = [
  { name: 'Sweetwater Pointe', dist: '0.6mi', rent: '$1,824', occ: '95.1%', concess: 'none', vs: '+$12',  src: 'platform', pcs: 91, rank: 1, f: 1.015, color: '#A78BFA' },
  { name: 'Camden Westside',   dist: '1.8mi', rent: '$1,910', occ: '93.8%', concess: '2wk',  vs: '+$98',  src: 'platform', pcs: 89, rank: 2, f: 1.04,  color: '#00BCD4' },
  { name: 'The Reserve',       dist: '1.1mi', rent: '$1,798', occ: '92.3%', concess: '4wk',  vs: '−$14',  src: 'platform', pcs: 80, rank: 6, f: 0.975, color: '#FF8C42' },
  { name: 'Walton Riverwood',  dist: '2.4mi', rent: '$1,755', occ: '94.6%', concess: 'none', vs: '−$57',  src: 'user',     pcs: 78, rank: 8, f: 0.96,  color: '#FF4757' },
];

const SUBJECT_ROW = {
  name: ASSET.name, short: 'Highlands (subject)', dist: '—',
  rent: '$1,712', occ: '94.2%', concess: '1.5%', vs: '—',
  src: 'subject', pcs: RANK.currentPCS, rank: RANK.current, subject: true, color: '',
};

const COMP_COLORS = ['#A78BFA', '#00BCD4', '#FF8C42', '#FF4757', '#00D26A', '#F5A623'];

// ── PERFORMANCE DATA ─────────────────────────────────────────────────────────
const PERF_SERIES = (() => {
  const l = ['J24','A24','S24','O24','N24','D24','J25','F25','M25','A25','M25','J25','J25','A25','S25','O25','N25','D25','J26','F26','M26','A26'];
  return l.map((m, i) => ({
    m,
    actual: Math.round((250 + i * 7.0) * 1000),
    target: Math.round((255 + i * 9.4) * 1000),
  }));
})();

const FOURCOL = [
  { item: 'GPR',           cur: '$5.92M', ttm: '$6.38M', pf: '$6.74M', d: '−5.3%',  tone: T.text.amber, bold: false },
  { item: 'Other Income',  cur: '$0.31M', ttm: '$0.38M', pf: '$0.35M', d: '+8.6%',  tone: T.text.green, bold: false },
  { item: 'Vacancy / Loss',cur: '−$0.82M',ttm: '−$0.90M',pf: '−$0.81M',d: '−11.1%', tone: T.text.amber, bold: false },
  { item: 'EGI',           cur: '$5.41M', ttm: '$5.86M', pf: '$6.28M', d: '−6.7%',  tone: T.text.amber, bold: false },
  { item: 'OpEx',          cur: '−$2.18M',ttm: '−$2.45M',pf: '−$2.36M',d: '−3.8%',  tone: T.text.red,   bold: false },
  { item: 'NOI',           cur: '$3.23M', ttm: '$3.41M', pf: '$3.92M', d: '−13.0%', tone: T.text.red,   bold: true  },
];

const SCORECARD = [
  { label: 'NOI vs Underwriting', value: '−13.0%', tone: T.text.red },
  { label: 'EGI vs UW',           value: '−6.7%',  tone: T.text.amber },
  { label: 'OpEx vs UW',          value: '+3.8%',   tone: T.text.red },
  { label: 'Occupancy vs UW',     value: '−0.8pp',  tone: T.text.amber },
  { label: 'Reno Premium',        value: '$285/u',  sub: 'UW $260', tone: T.text.green },
  { label: 'Stabilization',       value: 'Q3 \'26', sub: '2 qtrs late', tone: T.text.amber },
  { label: 'Hold IRR (proj.)',     value: '15.8%',   sub: 'UW 18.2%',    tone: T.text.amber },
];

const VARIANCE = [
  { item: 'GPR (rent burn-off)', uw: '$6.62M', act: '$6.38M', d: '−3.6%',  flag: false },
  { item: 'R&M',                 uw: '$0.41M', act: '$0.48M', d: '+18.0%', flag: true  },
  { item: 'Insurance (FL)',      uw: '$0.32M', act: '$0.40M', d: '+24.4%', flag: true  },
  { item: 'Payroll',             uw: '$0.58M', act: '$0.56M', d: '−3.4%',  flag: false },
];

const CAPEX_DATA = [
  { item: 'Interior Reno',   budget: '$1.20M', spent: '$0.98M', pct: '82%', flag: false },
  { item: 'Amenity Upgrade', budget: '$0.34M', spent: '$0.31M', pct: '91%', flag: false },
  { item: 'Roof / Envelope', budget: '$0.18M', spent: '$0.00M', pct: '0%',  flag: true  },
];

const LIFECYCLE_DATA = [
  { label: 'Hold Period',   value: 'Yr 4.4 of 7' },
  { label: 'Business Plan', value: '82% complete' },
  { label: 'Value Created', value: '+$6.8M', tone: T.text.green },
  { label: 'Current Basis', value: '$58.2M' },
  { label: 'Est. Value',    value: '$65.0M', tone: T.text.green },
  { label: 'Equity Multiple', value: '1.9x (proj.)' },
];

const EXIT_DATA = [
  { yr: 'Hold (Yr 5)', val: '$64.1M', irr: '14.2%', em: '1.8x', note: 'Stabilized, pre-reno-burnoff', best: false },
  { yr: 'Exit Yr 6',   val: '$67.8M', irr: '16.1%', em: '2.1x', note: 'Optimal — reno premium realized', best: true },
  { yr: 'Exit Yr 7',   val: '$69.2M', irr: '15.4%', em: '2.3x', note: 'Cap expansion risk', best: false },
  { yr: 'Refi Yr 5',   val: '—',      irr: '19.8%*', em: '2.6x', note: '*Cash-out refi, extend hold', best: false },
];

// ── CAPITAL DATA ─────────────────────────────────────────────────────────────
const DEBT_SERIES = (() => {
  const l = ['O24','N24','D24','J25','F25','M25','A25','M25','J25','J25','A25','S25','O25','N25','D25','J26','F26','M26','A26'];
  const s = [4.85,4.78,4.70,4.62,4.55,4.50,4.46,4.42,4.40,4.38,4.36,4.34,4.33,4.32,4.31,4.30,4.30,4.29,4.30];
  return l.map((m, i) => ({ m, sofr: s[i], allIn: +(Math.min(s[i], 4.00) + 2.85).toFixed(2) }));
})();

const DEBT_OVERVIEW = [
  { label: 'Loan Balance',      value: '$34.8M' },
  { label: 'Lender',            value: 'Bridge' },
  { label: 'Index',             value: '1M SOFR' },
  { label: 'Current SOFR',      value: '4.30%' },
  { label: 'Spread',            value: '+285 bps' },
  { label: 'All-In Rate',       value: '6.85%',  tone: T.text.amber },
  { label: 'Rate Cap Strike',   value: '4.00%',  tone: T.text.cyan },
  { label: 'Cap Expiry',        value: 'Sep \'26', sub: '15mo', tone: T.text.red },
  { label: 'Maturity',          value: 'Mar \'28' },
  { label: 'DSCR',              value: '1.48x',  tone: T.text.green },
  { label: 'Debt Yield',        value: '9.2%' },
  { label: 'Breakeven Occ.',    value: '78.4%' },
];

const RATE_SENS = [
  { scn: 'Current (capped)',    rate: '6.85%',  dscr: '1.48x', tone: T.text.green },
  { scn: '+100 / +200 capped', rate: '6.85%*', dscr: '1.48x', tone: T.text.green },
  { scn: 'Post cap-expiry',     rate: '7.15%',  dscr: '1.31x', tone: T.text.amber },
  { scn: '+100 uncapped',       rate: '8.15%',  dscr: '1.18x', tone: T.text.red },
];

const REFI_DATA = [
  { label: 'Months to Maturity',  value: '21' },
  { label: 'Cap Roll-off',        value: 'Sep \'26' },
  { label: 'Prepay Penalty',      value: '1.0%', sub: 'declining' },
  { label: 'Refi Rate (Agency)',  value: '5.85%' },
  { label: 'Refi Proceeds',       value: '$36.2M', tone: T.text.green },
];

const MEMBERS = [
  { member: 'MAG Sponsor (GP)',      committed: '$2.0M', called: '$2.0M', distributed: '$0.9M', pref: '—',     tier: 'Promote' },
  { member: 'Capital Partner A (LP)',committed: '$8.5M', called: '$8.5M', distributed: '$3.2M', pref: '$0.41M', tier: 'Pref' },
  { member: 'Capital Partner B (LP)',committed: '$4.0M', called: '$4.0M', distributed: '$1.5M', pref: '$0.22M', tier: 'Pref' },
];

const DIST_SUMMARY: [string, string][] = [
  ['Total Equity', '$14.5M'], ['Distributed', '$5.6M'], ['DPI', '0.39x'],
  ['Unreturned Capital', '$8.9M'], ['Current Tier', 'Return of Capital'],
];

const WF_OPERATING = [
  { tier: '1 · Preferred Return', detail: '10% A / 15% B · compounded monthly', split: '100% LP' },
  { tier: '2 · Return of Capital', detail: 'Unreturned contributions', split: '100% LP' },
  { tier: '3 · to 13% IRR', detail: 'Promote crossover', split: '80 / 20' },
  { tier: '4 · to 16% IRR', detail: '', split: '70 / 30' },
  { tier: '5 · Residual', detail: 'Thereafter', split: '60 / 40' },
];

const WF_CAPITAL = [
  { tier: '1 · Pref + 1.40x MOIC floor', detail: 'Tier-1 floor on capital events', split: '100% LP' },
  { tier: '2 · Return of Capital', detail: '', split: '100% LP' },
  { tier: '3 · to 13% IRR', detail: '', split: '80 / 20' },
  { tier: '4 · to 16% IRR', detail: 'Removal-event override', split: '70 / 30' },
  { tier: '5 · Residual', detail: '', split: '60 / 40' },
];

// ── DRAWER SYNTHETIC DATA ─────────────────────────────────────────────────────
const DOCS_DATA = [
  { name: 'Highlands_RentRoll_Apr26.xlsx', type: 'RENT ROLL',  date: 'May 02' },
  { name: 'T12_Operating_Apr26.pdf',        type: 'FINANCIALS', date: 'May 02' },
  { name: 'MAG_Highlands_JV_Agreement.pdf', type: 'LEGAL',     date: 'Dec 21' },
  { name: 'Loan_Agreement_Bridge.pdf',      type: 'DEBT',      date: 'Dec 21' },
  { name: 'Insurance_Binder_2026.pdf',      type: 'INSURANCE', date: 'Jan 14' },
];

const TEAM_DATA = [
  { name: 'Leon (you)',          role: 'Sponsor / GP',      tag: 'OWNER' },
  { name: 'RPM Living',          role: 'Property Manager',  tag: 'PM' },
  { name: 'Capital Partner A',   role: 'LP — Class A',      tag: 'LP' },
  { name: 'Walker & Dunlop',     role: 'Debt / Lender Rep', tag: 'DEBT' },
  { name: 'Cushman & Wakefield', role: 'Broker (exit)',     tag: 'BROKER' },
];

const EVENTS_DATA = [
  { date: 'T+8mo', ev: 'Amazon last-mile facility, 6mi NW',   impact: '+DEMAND', tone: T.text.green },
  { date: 'T-4mo', ev: '480-unit delivery, 1.1mi (The Quarry)', impact: '+SUPPLY', tone: T.text.red },
  { date: 'T+2mo', ev: 'FL→GA migration wave (Census BFS)',   impact: '+DEMAND', tone: T.text.green },
  { date: 'T-1mo', ev: 'County millage reassessment',          impact: 'RISK',    tone: T.text.amber },
];

const ACTIVITY_DATA = [
  { time: '2h', who: 'RPM Living',       act: 'Uploaded April rent roll (1,740 units)' },
  { time: '1d', who: 'System',           act: 'M22 variance recomputed — NOI −13% to PF' },
  { time: '2d', who: 'Leon',             act: 'Set rank target #2 (overall)' },
  { time: '4d', who: 'System',           act: 'Traffic prediction run — velocity +8.2%' },
  { time: '1w', who: 'Capital Partner A', act: 'Acknowledged Q1 distribution $0.8M' },
];

// ── TYPES ────────────────────────────────────────────────────────────────────
interface Comp {
  name: string; dist: string; rent: string; occ: string; concess: string;
  vs: string; src: string; pcs: number | string; rank: number; f?: number;
  color: string; short?: string; subject?: boolean;
}

interface RankCfg {
  overall: number;
  byType: boolean;
  perType: Record<string, number>;
}

// ── PRIMITIVE COMPONENTS ──────────────────────────────────────────────────────
function verb(s: string): string { return s.split(' ')[0]; }

function actionColor(a: string): string {
  const v = verb(a);
  return v === 'PUSH' ? T.text.green : v === 'HOLD' ? T.text.amber : v === 'CONCEDE' ? T.text.red : T.text.cyan;
}

function Badge({ children, c, solid }: { children: React.ReactNode; c: string; solid?: boolean }) {
  return (
    <span style={{
      fontFamily: T.font.mono, fontSize: 9, fontWeight: 700,
      color: solid ? '#000' : c,
      background: solid ? c : c + '18',
      border: `1px solid ${c}44`,
      padding: '1px 5px', letterSpacing: 0.5, textTransform: 'uppercase',
      whiteSpace: 'nowrap', borderRadius: 2,
    }}>
      {children}
    </span>
  );
}

function PanelHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 11px', borderBottom: `1px solid ${T.border.subtle}`,
      background: T.bg.header,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.font.label, fontSize: 11, fontWeight: 700, color: T.text.primary, letterSpacing: 0.6 }}>{title}</span>
        {sub && <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.4 }}>{sub}</span>}
      </div>
      {right}
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.bg.panel, border: `1px solid ${T.border.subtle}`,
      borderRadius: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Table({ head, rows, align, rowStyle }: {
  head: string[];
  rows: React.ReactNode[][];
  align: string[];
  rowStyle?: (row: React.ReactNode[], i: number) => React.CSSProperties | undefined;
}) {
  const ta = (i: number) => align[i] === 'r' ? 'right' : align[i] === 'c' ? 'center' : 'left';
  return (
    <div style={{ flex: 1, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={{
                textAlign: ta(i) as any, fontFamily: T.font.mono, fontSize: 9,
                fontWeight: 700, color: T.text.muted, letterSpacing: 0.5,
                padding: '6px 10px', borderBottom: `1px solid ${T.border.subtle}`,
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${T.border.subtle}`, ...(rowStyle ? rowStyle(r, ri) : {}) }}>
              {r.map((c, ci) => (
                <td key={ci} style={{
                  textAlign: ta(ci) as any, fontFamily: T.font.mono, fontSize: 10,
                  color: T.text.primary, padding: '6px 10px', whiteSpace: 'nowrap',
                }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatRail({ rows, signal }: {
  rows: { label: string; value: string; sub?: string; tone?: string }[];
  signal?: { label: string; note: string; value: string; tone: string };
}) {
  return (
    <>
      <div style={{ flex: 1 }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: i < rows.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
          }}>
            <span style={{ fontFamily: T.font.label, fontSize: 11, color: T.text.secondary }}>{r.label}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {r.sub && <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>{r.sub}</span>}
              <span style={{ fontFamily: T.font.mono, fontSize: 12, fontWeight: 700, color: r.tone || T.text.primary }}>{r.value}</span>
            </span>
          </div>
        ))}
      </div>
      {signal && (
        <div style={{
          padding: '10px 12px', borderTop: `1px solid ${T.border.medium}`,
          background: T.bg.panelAlt, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.6 }}>{signal.label}</div>
            <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.secondary, marginTop: 3, maxWidth: 150, lineHeight: 1.4 }}>{signal.note}</div>
          </div>
          <span style={{
            fontFamily: T.font.mono, fontSize: 13, fontWeight: 800, color: '#000',
            background: signal.tone, padding: '5px 12px', borderRadius: 2, letterSpacing: 1,
            animation: `${signal.tone === T.text.green ? 'glow' : 'glowA'} 2.4s infinite`,
          }}>
            {signal.value}
          </span>
        </div>
      )}
    </>
  );
}

function ChartPanel({
  title, sub, data, lines, refLine, tf, setTf, controls, fmt, height = 220,
}: {
  title: string; sub?: string; data: any[]; lines: any[]; refLine?: any;
  tf: number; setTf: (n: number) => void; controls?: React.ReactNode;
  fmt: (v: number) => string; height?: number;
}) {
  return (
    <Panel style={{ flex: 1, minWidth: 0 }}>
      <PanelHeader title={title} sub={sub} right={
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map(([l, n]) => (
            <button key={l} onClick={() => setTf(n)} style={{
              fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              padding: '3px 7px', borderRadius: 2, border: 'none',
              background: tf === n ? T.bg.active : 'transparent',
              color: tf === n ? T.text.amberBright : T.text.muted,
            }}>{l}</button>
          ))}
        </div>
      } />
      {controls}
      <div style={{ height, padding: '4px 6px 8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 14, bottom: 4, left: -6 }}>
            <CartesianGrid stroke={T.border.subtle} vertical={false} />
            <XAxis dataKey="m" tick={{ fill: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}
              axisLine={{ stroke: T.border.medium }} tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 8))} />
            <YAxis tick={{ fill: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}
              axisLine={false} tickLine={false} width={50} tickFormatter={fmt} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: T.bg.header, border: `1px solid ${T.border.bright}`, borderRadius: 2, fontFamily: T.font.mono, fontSize: 10 }}
              labelStyle={{ color: T.text.muted }} />
            {refLine && (
              <ReferenceLine y={refLine.y} stroke={refLine.color} strokeDasharray="4 3"
                label={{ value: refLine.label, fill: refLine.color, fontSize: 9, position: 'insideTopRight', fontFamily: T.font.mono }} />
            )}
            {lines.map((ln: any) => (
              <Line key={ln.key} type="monotone" dataKey={ln.key} stroke={ln.color}
                strokeWidth={ln.w || 1.8} strokeDasharray={ln.dash} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function NavSection({ label, items, addable }: {
  label: string;
  items: [string, string, boolean][];
  addable?: boolean;
}) {
  return (
    <div style={{ padding: '10px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 5px' }}>
        <span style={{ fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, color: T.text.muted, letterSpacing: 1 }}>{label}</span>
        {addable && <span style={{ color: T.text.muted, fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>+</span>}
      </div>
      {items.map(([icon, name, active], i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          cursor: 'pointer', background: active ? T.bg.active : 'transparent',
          borderLeft: `2px solid ${active ? T.text.amber : 'transparent'}`,
        }}>
          <span style={{ fontFamily: T.font.mono, fontSize: 10, color: active ? T.text.green : T.text.muted, width: 10 }}>{icon}</span>
          <span style={{ fontFamily: T.font.label, fontSize: 11, fontWeight: active ? 700 : 500, color: active ? T.text.primary : T.text.secondary }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

function DrawerShell({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: '#0008', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 400, maxWidth: '92vw', height: '100%',
        background: T.bg.panel, borderLeft: `1px solid ${T.border.bright}`,
        display: 'flex', flexDirection: 'column', animation: 'slideIn .16s',
      }}>
        <PanelHeader title={title} sub={sub} right={
          <span onClick={onClose} style={{ cursor: 'pointer', color: T.text.muted, fontFamily: T.font.mono, fontSize: 14, padding: '0 4px' }}>✕</span>
        } />
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function ListDrawer<T>({ rows, render }: { rows: T[]; render: (r: T) => React.ReactNode }) {
  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ padding: '9px 12px', borderBottom: `1px solid ${T.border.subtle}` }}>
          {render(r)}
        </div>
      ))}
    </div>
  );
}

// ── RANK & COMPS DRAWER ───────────────────────────────────────────────────────
function RankCompsConfig({ rankCfg, setRankCfg, comps, setComps, propertyId, onTargetSaved }: {
  rankCfg: RankCfg; setRankCfg: (c: RankCfg) => void;
  comps: Comp[]; setComps: (c: Comp[]) => void;
  propertyId: string | null;
  onTargetSaved?: () => void;
}) {
  const ranks = [1, 2, 3, 4];
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [liveRank, setLiveRank] = useState<{
    current_rank: number | null; current_pcs: number | null; set_size: number | null;
  } | null>(null);
  const [rankLoading, setRankLoading] = useState(false);

  // Fetch live rank + restore saved target when propertyId is available
  useEffect(() => {
    if (!propertyId) return;
    setRankLoading(true);
    // Parallel: live rank computation + saved target restore
    Promise.all([
      apiClient.get(`/api/v1/rankings/property/${propertyId}`)
        .then(res => {
          const d = res.data?.data;
          if (d) setLiveRank({ current_rank: d.current_rank, current_pcs: d.current_pcs, set_size: d.set_size });
        })
        .catch(() => {}),
      apiClient.get(`/api/v1/rankings/property/${propertyId}/target`)
        .then(res => {
          const t = res.data?.target;
          if (t?.targetConfig && typeof t.targetConfig.overall === 'number') {
            setRankCfg({
              overall: t.targetConfig.overall,
              byType: t.targetConfig.byType ?? false,
              perType: t.targetConfig.perType ?? { '1BR': 3, '2BR': 2, '3BR': 3, 'STU': 4 },
            });
          }
        })
        .catch(() => {}),
    ]).finally(() => setRankLoading(false));
  }, [propertyId]);

  const handleSaveTarget = () => {
    if (!propertyId) {
      setSaveNote('No property selected');
      return;
    }
    apiClient.post(`/api/v1/rankings/${propertyId}/target`, {
      overall: rankCfg.overall,
      byType: rankCfg.byType,
      perType: rankCfg.perType,
    })
      .then(() => {
        setSaveNote('SAVED ✓');
        setTimeout(() => setSaveNote(null), 3000);
        onTargetSaved?.();
      })
      .catch(() => { setSaveNote('SAVE FAILED'); });
  };
  return (
    <div style={{ padding: 12 }}>
      {/* ── CURRENT STANDING ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 14,
        padding: '8px 10px', borderRadius: 3,
        background: T.bg.input, border: `1px solid ${T.border.subtle}`,
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 18, fontWeight: 800, color: T.text.primary }}>
            {rankLoading ? '…' : liveRank?.current_rank != null ? `#${liveRank.current_rank}` : '—'}
          </div>
          <div style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted, marginTop: 2 }}>
            CURRENT RANK{liveRank?.set_size != null ? ` / ${liveRank.set_size}` : ''}
          </div>
        </div>
        <div style={{ width: 1, background: T.border.subtle }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 18, fontWeight: 800, color: T.text.cyan }}>
            {rankLoading ? '…' : liveRank?.current_pcs != null ? liveRank.current_pcs : '—'}
          </div>
          <div style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted, marginTop: 2 }}>PCS SCORE</div>
        </div>
      </div>

      <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.6, marginBottom: 6 }}>
        OVERALL RANK TARGET · set annually
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {ranks.map(r => (
          <button key={r} onClick={() => setRankCfg({ ...rankCfg, overall: r })} style={{
            flex: 1, cursor: 'pointer', borderRadius: 2, padding: '10px 0',
            border: `1px solid ${rankCfg.overall === r && !rankCfg.byType ? T.text.amber : T.border.medium}`,
            background: rankCfg.overall === r && !rankCfg.byType ? T.text.amber + '18' : 'transparent',
          }}>
            <div style={{ fontFamily: T.font.mono, fontSize: 15, fontWeight: 800, color: rankCfg.overall === r ? T.text.amberBright : T.text.secondary }}>#{r}</div>
            <div style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted, marginTop: 2 }}>PCS {PCS_BY_RANK[r]}</div>
          </button>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: rankCfg.byType ? 10 : 18, cursor: 'pointer' }}>
        <span onClick={() => setRankCfg({ ...rankCfg, byType: !rankCfg.byType })} style={{
          width: 30, height: 16, borderRadius: 2,
          background: rankCfg.byType ? T.text.green : T.bg.input,
          border: `1px solid ${T.border.medium}`, position: 'relative', flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute', top: 1, left: rankCfg.byType ? 15 : 1,
            width: 12, height: 12, borderRadius: 2,
            background: rankCfg.byType ? '#000' : T.text.muted, transition: 'left .12s',
          }} />
        </span>
        <span style={{ fontFamily: T.font.label, fontSize: 11, color: T.text.secondary }}>Set rank by unit type (advanced)</span>
      </label>

      {rankCfg.byType && (
        <div style={{ marginBottom: 18 }}>
          {Object.keys(rankCfg.perType).map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.primary, width: 34 }}>{t}</span>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                {ranks.map(r => (
                  <button key={r} onClick={() => setRankCfg({ ...rankCfg, perType: { ...rankCfg.perType, [t]: r } })} style={{
                    flex: 1, cursor: 'pointer', borderRadius: 2, padding: '5px 0',
                    fontFamily: T.font.mono, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${rankCfg.perType[t] === r ? T.text.amber : T.border.medium}`,
                    background: rankCfg.perType[t] === r ? T.text.amber + '18' : 'transparent',
                    color: rankCfg.perType[t] === r ? T.text.amberBright : T.text.secondary,
                  }}>#{r}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.6,
        marginBottom: 6, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>COMP SET</span>
        <span style={{ color: T.text.cyan, cursor: 'pointer' }}>+ add comp</span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
        borderBottom: `1px solid ${T.border.subtle}`, background: T.text.amber + '10',
      }}>
        <span style={{ fontFamily: T.font.label, fontSize: 11, fontWeight: 700, color: T.text.amberBright, flex: 1 }}>▸ {ASSET.name}</span>
        <Badge c={T.text.amber}>subject · #{liveRank?.current_rank ?? RANK.current}</Badge>
        <span style={{ width: 14 }} />
      </div>

      {comps.map((c, i) => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontFamily: T.font.label, fontSize: 11, color: T.text.primary, flex: 1 }}>{c.name}</span>
          <Badge c={c.src === 'platform' ? T.text.cyan : T.text.purple}>{c.src}</Badge>
          <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, width: 42, textAlign: 'right' }}>{c.dist}</span>
          <span onClick={() => setComps(comps.filter((_, j) => j !== i))}
            style={{ cursor: 'pointer', color: T.text.red, fontFamily: T.font.mono, fontSize: 12, width: 14, textAlign: 'center' }}>×</span>
        </div>
      ))}

      <div style={{ marginTop: 14, fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, lineHeight: 1.6 }}>
        Platform proposes the like-kind set from class · vintage · size · submarket. Edit it here, set your target rank once, and the Repricing Course pursues it all year.
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSaveTarget} style={{
          fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, cursor: 'pointer',
          padding: '7px 18px', borderRadius: 2,
          border: `1px solid ${T.text.amber}`, background: T.text.amber + '18', color: T.text.amberBright,
        }}>SAVE TARGET</button>
        {saveNote && (
          <span style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>{saveNote}</span>
        )}
      </div>
    </div>
  );
}

// ── REVENUE SCREEN ────────────────────────────────────────────────────────────
function RevenueScreen({ rankCfg, comps, openDrawer, dealId, propertyId, activeScreen, targetSavedVersion }: {
  rankCfg: RankCfg; comps: Comp[]; openDrawer: (d: string) => void;
  dealId: string; propertyId: string | null; activeScreen: string;
  targetSavedVersion: number;
}) {
  const [tf, setTf] = useState(12);
  const [mk, setMk] = useState('occ');
  const [cmpSel, setCmpSel] = useState<string[]>([]);

  // ── Live data state ──────────────────────────────────────────
  const [actualsData, setActualsData] = useState<any[]>([]);
  const [expirations, setExpirations] = useState<any[]>([]);
  const [correlSignals, setCorrelSignals] = useState<any[]>([]);
  const [rentRollUnits, setRentRollUnits] = useState<any[]>([]);
  // NEW-BACKEND stubs and new routes
  const [tradeoutEvents, setTradeoutEvents] = useState<any[]>([]);
  const [leasingObs, setLeasingObs] = useState<any[]>([]);
  const [beatPlan, setBeatPlan] = useState<BeatPlan | null>(null);
  const [beatPlanLoading, setBeatPlanLoading] = useState(false);
  const [selectedBridgeBar, setSelectedBridgeBar] = useState<number | null>(null);
  const [derivedMetrics, setDerivedMetrics] = useState<any[]>([]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=53`)
      .then(res => {
        const rows = (res.data?.data ?? []).slice().reverse(); // convert DESC→ASC
        setActualsData(rows);
      })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/lease-expirations?months=24`)
      .then(res => {
        setExpirations(res.data?.expirations ?? []);
      })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!propertyId) return;
    apiClient.get(`/api/v1/correlations/property/${propertyId}`)
      .then(res => {
        setCorrelSignals(res.data?.data?.correlations ?? []);
      })
      .catch(() => {});
  }, [propertyId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/rent-roll`)
      .then(res => { setRentRollUnits(res.data?.units ?? []); })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/derived-metrics`)
      .then(res => { setDerivedMetrics(res.data?.data ?? []); })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  // ── New routes wired in Phase C ──────────────────────────────
  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/tradeout-events`)
      .then(res => { setTradeoutEvents(res.data?.events ?? []); })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/leasing-observations?weeks=52`)
      .then(res => {
        const obs = (res.data?.observations ?? []).slice().reverse(); // oldest→newest
        setLeasingObs(obs);
      })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  // ── Beat plan fetch ───────────────────────────────────────────
  const fetchBeatPlan = () => {
    if (!dealId) return;
    setBeatPlanLoading(true);
    const params = new URLSearchParams({
      targetRank: String(rankCfg.overall),
      byType: String(rankCfg.byType),
    });
    if (rankCfg.byType) {
      Object.entries(rankCfg.perType).forEach(([t, r]) => params.set(`perType[${t}]`, String(r)));
    }
    apiClient.get(`/api/v1/revenue/${dealId}/beat-plan?${params.toString()}`)
      .then(res => { setBeatPlan(res.data ?? null); })
      .catch(() => { setBeatPlan(null); })
      .finally(() => setBeatPlanLoading(false));
  };

  useEffect(() => {
    fetchBeatPlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (targetSavedVersion === 0) return;
    fetchBeatPlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSavedVersion]);

  // ── LTL tile value from latest rent roll snapshot ─────────────
  // Prefer per-unit loss_to_lease_pct average; fall back to latest derived-metrics snapshot.
  const liveLtl = useMemo(() => {
    const rows = rentRollUnits.filter((u: any) => u.loss_to_lease_pct != null);
    if (rows.length) {
      const avg = rows.reduce((s: number, u: any) => s + parseFloat(u.loss_to_lease_pct), 0) / rows.length;
      if (avg > 0) return avg;
    }
    // Fall back to most recent derivedMetrics snapshot
    if (derivedMetrics.length) {
      const latest = [...derivedMetrics].sort((a, b) => b.month.localeCompare(a.month))[0];
      return latest?.ltl_pct ?? null;
    }
    return null;
  }, [rentRollUnits, derivedMetrics]);

  // ── Sorted derived-metrics snapshots for nearest-predecessor lookup ──────
  const sortedDerived = useMemo(() =>
    [...derivedMetrics].sort((a, b) => a.month.localeCompare(b.month)),
  [derivedMetrics]);

  // ── Derived series ────────────────────────────────────────────
  const liveSeries = useMemo(() => {
    if (!actualsData.length) return null;
    return actualsData.map((row, idx) => {
      const occ = parseFloat(row.occupancy_rate ?? '0') * 100;
      const rent = parseFloat(row.avg_effective_rent ?? '0');
      const noi = parseFloat(row.noi ?? '0');
      const d = new Date(row.report_month);
      const mon = d.toLocaleString('en-US', { month: 'short' });
      const yr  = String(d.getFullYear()).slice(2);
      const reportMonth = String(row.report_month).slice(0, 7); // YYYY-MM

      // Find the latest derived-metrics snapshot at or before this actuals month.
      // Snapshots are annual (Dec 31 each year); this gives the most recent available
      // LTL% and concession% for each monthly actuals row.
      let derived: any = null;
      for (let i = sortedDerived.length - 1; i >= 0; i--) {
        if (sortedDerived[i].month <= reportMonth) { derived = sortedDerived[i]; break; }
      }

      // Prototype sparklines for tro (no API yet) — keep as visual placeholder
      const protoOffset = SERIES.length - actualsData.length + idx;
      const proto = protoOffset >= 0 && protoOffset < SERIES.length ? SERIES[protoOffset] : null;

      // concessions_per_unit ($/unit) — used directly on the chart in dollars.
      // The METRICS formatter for 'conc' shows "$N/u".
      // Prototype fallback values are percentage-style numbers; when real data is
      // available (derivedMetrics populated), they are overridden by dollar amounts.
      const conc: number | null = derived?.concessions_per_unit != null
        ? Math.round(derived.concessions_per_unit * 100) / 100
        : proto?.conc ?? null;

      return {
        m: `${mon.slice(0,3)}'${yr}`,
        occ: Math.round(occ * 10) / 10,
        rent: Math.round(rent),
        noi: Math.round(noi),
        revpau: Math.round(rent * (occ / 100) * 0.985),
        ltl:  derived?.ltl_pct ?? proto?.ltl ?? null,
        conc,
        tro:  proto?.tro ?? null,
      };
    });
  }, [actualsData, sortedDerived]);

  const series = liveSeries ?? SERIES;
  const latestActual = actualsData.length ? actualsData[actualsData.length - 1] : null;

  // ── Live metric tiles ─────────────────────────────────────────
  const liveMetrics = useMemo(() => {
    if (!latestActual) return null;
    const occ  = parseFloat(latestActual.occupancy_rate ?? '0') * 100;
    const rent = parseFloat(latestActual.avg_effective_rent ?? '0');
    const noi  = parseFloat(latestActual.noi ?? '0');
    const revpau = Math.round(rent * (occ / 100) * 0.985);
    const ttmRows = actualsData.slice(-12);
    const noiTtm  = ttmRows.reduce((s: number, r: any) => s + parseFloat(r.noi ?? '0'), 0);
    return { occ, rent, noi, revpau, noiTtm };
  }, [actualsData, latestActual]);

  // ── Live overview rail ────────────────────────────────────────
  const liveOverview = useMemo(() => {
    if (!liveMetrics) return OVERVIEW;
    const { occ, rent, revpau, noiTtm } = liveMetrics;
    const econOcc = occ * 0.976;
    return [
      { label: 'Units',          value: ASSET.units.toString() },
      { label: 'Physical Occ.', value: `${occ.toFixed(1)}%`, tone: occ >= 93 ? T.text.green : T.text.amber },
      { label: 'Economic Occ.', value: `${econOcc.toFixed(1)}%` },
      { label: 'In-Place Rent', value: `$${Math.round(rent).toLocaleString()}` },
      { label: 'Market Rent',   value: '—' },   // TODO(data: market rent)
      { label: 'Loss-to-Lease', value: liveLtl != null ? `${liveLtl.toFixed(1)}%` : '—' },
      { label: 'Concessions',   value: '—' },
      { label: 'RevPAU',        value: `$${revpau.toLocaleString()}` },
      { label: 'NOI (TTM)',     value: `$${(noiTtm / 1_000_000).toFixed(2)}M`, tone: T.text.green },
      { label: 'In-Place Cap',  value: '—' },
      { label: 'DSCR',          value: '—' },
      { label: 'JEDI Score',    value: '—' },
    ];
  }, [liveMetrics]);

  // ── Trade-out spread lookup by month (YYYY-MM) ───────────────
  const tradeoutByMonth = useMemo(() => {
    const map: Record<string, number[]> = {};
    tradeoutEvents.forEach((e: any) => {
      if (!e.effective_date) return;
      const key = String(e.effective_date).slice(0, 7);
      if (!map[key]) map[key] = [];
      const pct = parseFloat(e.spread_pct ?? '0');
      map[key].push(pct);
    });
    return map;
  }, [tradeoutEvents]);

  // ── Lease roll rows from live expirations ────────────────────
  const leaseRollRows = useMemo(() => {
    if (!expirations.length) return LEASE_ROLL;
    return expirations.map((e: any) => {
      const d = new Date(e.month + '-01');
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        .replace(' ', "'");
      // Trade-out spread: wired from /api/v1/operations/:dealId/tradeout-events (Phase C)
      const monthKey = e.month; // YYYY-MM
      const troSpreads = tradeoutByMonth[monthKey];
      let spread = '—';
      let spreadTone = T.text.muted;
      if (troSpreads && troSpreads.length) {
        const avg = troSpreads.reduce((a: number, b: number) => a + b, 0) / troSpreads.length;
        // tradeout_pct may be decimal (0.035) or pct (3.5) — normalise to pct
        const pctVal = Math.abs(avg) <= 1 ? avg * 100 : avg;
        spread = `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(1)}%`;
        spreadTone = pctVal >= 0 ? T.text.green : T.text.red;
      }
      let action = 'HOLD';
      if (e.recommendedAction?.toUpperCase().includes('AGGRESSIVE')) action = 'PUSH';
      else if (e.recommendedAction?.toUpperCase().includes('MODERATE')) action = 'PUSH';
      else if (e.recommendedAction?.toUpperCase().includes('RETENTION')) action = 'HOLD';
      const expiringUnits = e.expiringUnits ?? 0;
      const inPlace = e.avgCurrentRent != null ? `$${Math.round(e.avgCurrentRent).toLocaleString()}` : '—';
      const market  = e.avgMarketRent  != null ? `$${Math.round(e.avgMarketRent).toLocaleString()}`  : '—';
      return { month: monthLabel, type: 'Mix', units: expiringUnits, inPlace, market, spread, spreadTone, action };
    });
  }, [expirations, tradeoutByMonth]);

  // ── Correlation signals ───────────────────────────────────────
  const signalRows = useMemo(() => {
    if (!correlSignals.length) return SIGNALS;
    return correlSignals.map((c: any) => {
      const sig = (c.signal ?? '').toUpperCase();
      const direction = sig.includes('BULL') || sig.includes('POSITIVE') ? 'up'
        : sig.includes('BEAR') || sig.includes('NEGATIVE') ? 'down' : 'flat';
      const tone = direction === 'up' ? T.text.green : direction === 'down' ? T.text.red : T.text.amber;
      const rawValue = c.xValue != null ? Number(c.xValue).toFixed(1) : (c.correlation != null ? `r=${Number(c.correlation).toFixed(2)}` : '—');
      return {
        name: (c.name ?? c.id ?? '').replace(/_/g, ' ').slice(0, 28),
        value: rawValue,
        dir: direction as 'up' | 'down' | 'flat',
        tone,
        lead: c.leadTime ?? '—',
        src: c.category ?? c.tier?.toString() ?? '—',
      };
    });
  }, [correlSignals]);

  // ── Live metric tile value resolver ──────────────────────────
  const liveVal = (key: string, fallback: string): string => {
    if (!liveMetrics) return fallback;
    const { occ, rent, noi, revpau, noiTtm } = liveMetrics;
    if (key === 'occ')    return `${occ.toFixed(1)}%`;
    if (key === 'rent')   return `$${Math.round(rent).toLocaleString()}`;
    if (key === 'noi')    return `$${(noi / 1_000).toFixed(0)}K`;
    if (key === 'revpau') return `$${revpau.toLocaleString()}`;
    if (key === 'noi_ttm') return `$${(noiTtm / 1_000_000).toFixed(2)}M`;
    return fallback;
  };

  const toggleComp = (n: string) => setCmpSel(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n]);
  const metric = METRICS.find(m => m.key === mk)!;
  const dec = ['occ', 'ltl', 'conc', 'tro'].includes(mk) ? 1 : 0;
  const base = series.slice(-tf);
  const selComps = comps.filter(c => cmpSel.includes(c.name));

  const data = base.map((d: any, i: number) => {
    const row: any = { m: d.m, [mk]: d[mk] };
    selComps.forEach((c, j) => {
      row['c' + j] = +(d[mk] * (c.f || 1) * (1 + Math.sin(i / 3) * 0.004)).toFixed(dec);
    });
    return row;
  });

  const lines = [
    { key: mk, color: metric.color, w: 1.9 },
    ...selComps.map((c, j) => ({ key: 'c' + j, color: c.color || T.text.purple, w: 1.3, dash: '3 3' })),
  ];

  const ranked = [...comps, SUBJECT_ROW].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const aggro = (t: string) => 4 - (rankCfg.byType ? rankCfg.perType[t] : rankCfg.overall);
  const tm = TARGET_META[rankCfg.overall];

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <ChartPanel
          title={`${ASSET.ticker} · ${ASSET.name}`}
          sub={`${ASSET.addr} · ${ASSET.units} units`}
          data={data} tf={tf} setTf={setTf} fmt={metric.fmt} lines={lines}
          controls={
            <>
              <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.subtle}` }}>
                {METRICS.map((m, i) => {
                  const on = mk === m.key;
                  return (
                    <button key={m.key} onClick={() => setMk(m.key)} style={{
                      flex: 1, padding: '8px 10px',
                      borderRight: i < METRICS.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                      textAlign: 'left', cursor: 'pointer',
                      background: on ? m.color + '14' : 'transparent',
                      borderTop: `2px solid ${on ? m.color : 'transparent'}`,
                      border: 'none', borderBottom: 'none',
                    }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 9, color: on ? m.color : T.text.muted, letterSpacing: 0.4 }}>{m.tile}</div>
                      <div style={{ fontFamily: T.font.mono, fontSize: 15, fontWeight: 700, color: on ? m.color : T.text.primary, marginTop: 2 }}>{liveVal(m.key, m.val)}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.5 }}>{metric.tile} ▸ COMPARE</span>
                <span style={{
                  fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 2,
                  border: `1px solid ${metric.color}`, background: metric.color + '22', color: metric.color,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 14, height: 2, background: metric.color }} />Highlands
                </span>
                {comps.map(c => {
                  const on = cmpSel.includes(c.name);
                  const col = c.color || T.text.purple;
                  return (
                    <button key={c.name} onClick={() => toggleComp(c.name)} style={{
                      fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                      padding: '3px 8px', borderRadius: 2,
                      border: `1px solid ${on ? col : T.border.medium}`,
                      background: on ? col + '22' : 'transparent', color: on ? col : T.text.secondary,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ width: 14, height: 2, background: on ? col : T.border.medium, opacity: on ? 1 : 0.5 }} />
                      {c.name}
                    </button>
                  );
                })}
                <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, cursor: 'pointer', marginLeft: 'auto' }}>+ owned property</span>
              </div>
            </>
          }
        />
        <Panel style={{ width: 268, flexShrink: 0 }}>
          <PanelHeader title="ASSET OVERVIEW" sub="fundamentals" />
          <StatRail rows={liveOverview} signal={{
            label: 'BEAT STATUS',
            note: beatPlan?.status ? '' : beatPlanLoading ? '// LOADING' : '// PENDING',
            value: beatPlan?.status ?? '—',
            tone: beatPlan?.status === 'BEAT' ? T.text.green : beatPlan?.status === 'ON_TRACK' ? T.text.amber : beatPlan?.status === 'AT_RISK' ? T.text.red : T.text.muted,
          }} />
        </Panel>
      </div>

      {/* ── PRO FORMA BEAT BAND ─────────────────────────────────── */}
      {beatPlanLoading ? (
        <Panel style={{ marginBottom: 10 }}>
          <div style={{ padding: '14px 16px', fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>
            computing beat plan…
          </div>
        </Panel>
      ) : beatPlan ? (() => {
        const statusColor = beatPlan.status === 'BEAT' ? T.text.green : beatPlan.status === 'ON_TRACK' ? T.text.amber : T.text.red;
        const beatPositive = beatPlan.beatAnnual >= 0;
        const fmtK = (v: number) => {
          const abs = Math.abs(v);
          const sign = v < 0 ? '−' : '+';
          if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
          return `${sign}$${Math.round(abs / 1000)}K`;
        };
        return (
          <Panel style={{ marginBottom: 10, borderColor: statusColor + '55' }}>
            {/* headline row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 0', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.muted, letterSpacing: 0.8 }}>PRO FORMA BEAT</span>
              <span style={{
                fontFamily: T.font.mono, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 2,
                background: statusColor + '22', border: `1px solid ${statusColor}55`, color: statusColor,
              }}>{beatPlan.status.replace('_', ' ')}</span>
              <span style={{ fontFamily: T.font.mono, fontSize: 13, fontWeight: 700, color: statusColor }}>
                {beatPositive ? '+' : '−'}${Math.abs(beatPlan.beatAnnual).toLocaleString()}
                <span style={{ fontSize: 9, fontWeight: 400, color: T.text.muted, marginLeft: 5 }}>
                  {beatPositive ? '+' : ''}{(beatPlan.beatPct * 100).toFixed(1)}% vs pro forma ·
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, marginLeft: 4 }}>
                  {beatPositive ? 'beat' : 'miss'}
                </span>
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>
                pro forma NOI ${beatPlan.proFormaNOI.toLocaleString()} · projected ${beatPlan.projectedNOI.toLocaleString()}
              </span>
            </div>

            {/* NOI waterfall bridge — bar chart with text-only fallback */}
            {(() => {
              // Compute waterfall geometry — wrapped in try/catch so a bad bridge
              // array degrades gracefully to the text-only row below.
              let chartData: Array<{
                label: string; base: number; bar: number; fill: string;
                rawAmount: number; displayAmt: string; isTotal: boolean; isLast: boolean;
              }> | null = null;
              try {
                let running = 0;
                chartData = beatPlan.bridge.map((step, i) => {
                  const isTotal = step.label.startsWith('=');
                  const isPfn   = step.label.startsWith('vs');
                  const isLast  = i === beatPlan.bridge.length - 1;
                  const amt = step.amount;
                  let base: number, bar: number;
                  if (isTotal) {
                    base = 0; bar = amt; running = amt;
                  } else if (isPfn) {
                    base = amt >= 0 ? running : running + amt;
                    bar = Math.abs(amt);
                  } else {
                    base = amt >= 0 ? running : running + amt;
                    bar = Math.abs(amt);
                    running += amt;
                  }
                  const fill = isTotal && !isLast
                    ? T.text.primary
                    : isLast ? statusColor
                    : isPfn ? T.text.muted
                    : amt >= 0 ? T.text.green : T.text.red;
                  const displayAmt = isPfn
                    ? `$${Math.abs(amt).toLocaleString()}`
                    : amt === 0 ? '$0'
                    : fmtK(amt);
                  if (!Number.isFinite(base) || !Number.isFinite(bar)) throw new Error('non-finite');
                  return { label: step.label, base, bar, fill, rawAmount: amt, displayAmt, isTotal, isLast };
                });
              } catch {
                chartData = null;
              }

              const CustomTick = ({ x, y, payload }: any) => {
                if (!chartData) return null;
                const d = chartData[payload.index];
                if (!d) return null;
                const lines = d.label.replace(/^[=]/, '').trim().split(/\s+(?=\S{3})/);
                return (
                  <g transform={`translate(${x},${y + 4})`}>
                    {lines.map((line: string, li: number) => (
                      <text
                        key={li}
                        x={0} y={li * 10}
                        textAnchor="middle"
                        fill={T.text.muted}
                        fontSize={7.5}
                        fontFamily={T.font.mono}
                      >{line}</text>
                    ))}
                  </g>
                );
              };

              // Selected-bar click popover
              const clickedBar = selectedBridgeBar !== null && chartData ? chartData[selectedBridgeBar] : null;

              if (chartData) {
                return (
                  <div style={{ padding: '8px 14px 4px', position: 'relative' }}>
                    {/* Click-activated tooltip popover */}
                    {clickedBar && (
                      <div
                        style={{
                          position: 'absolute', top: 4, right: 18, zIndex: 10,
                          background: T.bg.panel, border: `1px solid ${T.border.bright}`,
                          borderRadius: 3, padding: '6px 10px',
                          fontFamily: T.font.mono, fontSize: 11,
                          boxShadow: '0 2px 8px #00000066',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedBridgeBar(null)}
                      >
                        <div style={{ color: T.text.muted, fontSize: 9, marginBottom: 3 }}>{clickedBar.label}</div>
                        <div style={{ color: clickedBar.fill, fontWeight: 700 }}>{clickedBar.displayAmt}</div>
                        <div style={{ color: T.text.muted, fontSize: 8, marginTop: 2 }}>click to dismiss</div>
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={140}>
                      <ComposedChart
                        data={chartData}
                        barCategoryGap="20%"
                        margin={{ top: 16, right: 8, left: 8, bottom: 28 }}
                        onClick={(state: any) => {
                          const idx = state?.activeTooltipIndex;
                          if (idx !== undefined && idx !== null) {
                            setSelectedBridgeBar(prev => prev === idx ? null : idx);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <XAxis
                          dataKey="label"
                          tick={<CustomTick />}
                          tickLine={false}
                          axisLine={{ stroke: T.border.subtle }}
                          interval={0}
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip
                          content={() => null}
                          cursor={{ fill: T.border.subtle + '33' }}
                        />
                        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                        <Bar dataKey="bar" stackId="wf" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                          {chartData.map((d, i) => (
                            <Cell
                              key={i}
                              fill={d.fill}
                              fillOpacity={selectedBridgeBar === i ? 1 : d.isTotal || d.isLast ? 0.9 : 0.75}
                              stroke={selectedBridgeBar === i ? d.fill : 'none'}
                              strokeWidth={selectedBridgeBar === i ? 1.5 : 0}
                            />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted, textAlign: 'right', paddingRight: 4, marginTop: -4 }}>
                      click bar for detail
                    </div>
                  </div>
                );
              }

              // Text-only fallback (shown when chart data cannot be computed)
              return (
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px 8px', overflowX: 'auto', gap: 0 }}>
                  {beatPlan.bridge.map((step, i) => {
                    const isTotal = step.label.startsWith('=');
                    const isPfn   = step.label.startsWith('vs');
                    const isLast  = i === beatPlan.bridge.length - 1;
                    const amt = step.amount;
                    const tone = isLast
                      ? statusColor
                      : isTotal ? T.text.primary
                      : isPfn ? T.text.muted
                      : amt >= 0 ? T.text.green : T.text.red;
                    const formatted = isPfn
                      ? `$${Math.abs(amt).toLocaleString()}`
                      : amt === 0 ? '$0'
                      : fmtK(amt);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center', minWidth: isTotal || isLast ? 90 : 76, padding: '0 4px' }}>
                          <div style={{
                            fontFamily: T.font.mono, fontSize: isTotal || isLast ? 12 : 11, fontWeight: isTotal || isLast ? 800 : 600,
                            color: tone,
                          }}>{formatted}</div>
                          <div style={{
                            fontFamily: T.font.mono, fontSize: 7.5, color: T.text.muted, marginTop: 2,
                            lineHeight: 1.2, maxWidth: 88, whiteSpace: 'pre-wrap', textAlign: 'center',
                          }}>{step.label}</div>
                        </div>
                        {i < beatPlan.bridge.length - 1 && (
                          <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.border.bright, margin: '0 2px' }}>›</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* caveats footnote */}
            {beatPlan.caveats.length > 0 && (
              <div style={{ padding: '0 14px 10px', borderTop: `1px solid ${T.border.subtle}`, paddingTop: 8 }}>
                {beatPlan.caveats.map((c, i) => (
                  <div key={i} style={{ fontFamily: T.font.label, fontSize: 9, color: T.text.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
                    • {c}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })() : null}

      {/* No market signals amber banner — suppressed when comp-set rents are wired in */}
      {beatPlan && beatPlan.caveats.some(c => c.includes('No market signals')) && !beatPlan.compSetSource && (
        <div style={{
          marginBottom: 10, padding: '8px 14px',
          background: T.text.amber + '12', border: `1px solid ${T.text.amber}44`, borderRadius: 2,
          fontFamily: T.font.label, fontSize: 10, color: T.text.amber,
        }}>
          ⚠ No market signal data — revenue lever defaulted to HOLD.
          Wire correlation/property + M07 to unlock repricing recommendations.
        </div>
      )}

      {/* Comp-set market rent indicator — shows source when real comp rents are wired */}
      {beatPlan && beatPlan.compSetSource && (
        <div style={{
          marginBottom: 10, padding: '8px 14px',
          background: T.text.cyan + '10', border: `1px solid ${T.text.cyan}33`, borderRadius: 2,
          fontFamily: T.font.label, fontSize: 10, color: T.text.cyan,
        }}>
          ◈ Market rent sourced from comp set ({beatPlan.compSetSource}) — recommendations are comp-gated.
        </div>
      )}

      {/* REPRICING COURSE */}
      <Panel style={{ marginBottom: 10, borderColor: beatPlan?.revenue?.length ? T.border.bright : T.border.subtle }}>
        <PanelHeader
          title="REPRICING COURSE"
          sub={`path to #${rankCfg.overall}${rankCfg.byType ? ' · by unit type' : ''} · fuel × schedule × throttle`}
          right={
            <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.secondary, display: 'flex', alignItems: 'center', gap: 8 }}>
              {!beatPlan && !beatPlanLoading && (
                <Badge c={T.text.amber}>ILLUSTRATIVE — BEAT PLAN PENDING</Badge>
              )}
              {beatPlan?.revenue?.length ? (
                <>
                  EGI lift{' '}
                  <b style={{ color: T.text.green }}>
                    +${Math.round(beatPlan.revenueLeverAnnual).toLocaleString()}/yr
                  </b>{' '}
                  ·{' '}
                </>
              ) : (
                <>
                  capturing <b style={{ color: T.text.green }}>{tm.captured}</b>/mo · net <b style={{ color: T.text.green }}>{tm.lift}</b> eff. rent ·{' '}
                </>
              )}
              <span style={{ color: T.text.cyan, cursor: 'pointer' }} onClick={() => openDrawer('rankcomps')}>edit target</span>
            </span>
          }
        />
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {beatPlan?.revenue?.length
            ? beatPlan.revenue.map((rec, i) => {
                const actionTone = rec.action === 'PUSH' ? T.text.green : rec.action === 'HOLD' ? T.text.amber : T.text.red;
                const sigScore = rec.signalScore;
                const sigColor = sigScore > 0.2 ? T.text.green : sigScore < -0.2 ? T.text.red : T.text.amber;
                const deltaSign = rec.deltaPerUnit >= 0 ? '+' : '';
                return (
                  <div key={`${rec.unitType}-${i}`} style={{
                    flex: '1 1 180px', padding: '10px 12px',
                    borderRight: i < beatPlan.revenue.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                    borderBottom: `1px solid ${T.border.subtle}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.primary }}>
                        {rec.unitType}
                        {rankCfg.byType && <span style={{ color: T.text.muted, fontSize: 9, marginLeft: 5 }}>#{rankCfg.perType[rec.unitType]}</span>}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: T.font.mono, fontSize: 8, color: sigColor, letterSpacing: 0.3 }}>
                          S{sigScore >= 0 ? '+' : ''}{sigScore.toFixed(2)}
                        </span>
                        <Badge c={actionTone} solid>{rec.action}</Badge>
                      </div>
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, marginBottom: 3 }}>
                      {rec.units} units · in-place ${Math.round(rec.inPlaceRent).toLocaleString()} · market ${Math.round(rec.marketRent).toLocaleString()}
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.primary, marginBottom: 2 }}>
                      rec ${Math.round(rec.recommendedRent).toLocaleString()}
                      <span style={{ color: rec.deltaPerUnit >= 0 ? T.text.green : T.text.red, marginLeft: 6 }}>
                        {deltaSign}${Math.round(Math.abs(rec.deltaPerUnit)).toLocaleString()}/u
                      </span>
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.green }}>
                      +${Math.round(rec.annualEGIContribution).toLocaleString()}/yr EGI
                    </div>
                    <div style={{ fontFamily: T.font.label, fontSize: 9, color: T.text.secondary, marginTop: 4, lineHeight: 1.4 }}>
                      {rec.reason}
                    </div>
                  </div>
                );
              })
            : COHORTS.map((c, i) => {
                const a = c.ladder[aggro(c.type)];
                return (
                  <div key={c.type} style={{ flex: 1, padding: '10px 12px', borderRight: i < COHORTS.length - 1 ? `1px solid ${T.border.subtle}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.primary }}>
                        {c.type}
                        {rankCfg.byType && <span style={{ color: T.text.muted, fontSize: 9, marginLeft: 5 }}>#{rankCfg.perType[c.type]}</span>}
                      </span>
                      <Badge c={actionColor(a)} solid>{a}</Badge>
                    </div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, marginBottom: 5 }}>{c.units} units · {c.window}</div>
                    <div style={{ fontFamily: T.font.label, fontSize: 10, color: T.text.secondary, lineHeight: 1.45 }}>{c.reason}</div>
                  </div>
                );
              })
          }
        </div>
      </Panel>

      {/* EXPENSE DISCIPLINE */}
      {beatPlan?.expense?.length ? (
        <Panel style={{ marginBottom: 10 }}>
          <PanelHeader
            title="EXPENSE DISCIPLINE"
            sub="controllable opex vs UW · recovery potential"
            right={
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>
                recovery{' '}
                <b style={{ color: T.text.green }}>
                  +${Math.round(beatPlan.expenseRecoveryAnnual).toLocaleString()}/yr
                </b>
                {beatPlan.acceptedExpenseDragAnnual > 0 && (
                  <> · drag <b style={{ color: T.text.red }}>−${Math.round(beatPlan.acceptedExpenseDragAnnual).toLocaleString()}/yr</b></>
                )}
              </span>
            }
          />
          <Table
            head={['EXPENSE LINE', 'CAT', 'UW TARGET', 'ACTUAL', 'VAR %', 'PROJECTED', 'RECOVERY', 'NOTE']}
            align={['l', 'c', 'r', 'r', 'r', 'r', 'r', 'l']}
            rows={beatPlan.expense.map(f => {
              const varPct = f.variancePct * 100;
              const varTone = f.flagged ? T.text.red : varPct > 0 ? T.text.amber : T.text.green;
              const fmtDollar = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString()}`;
              return [
                <span key="lbl" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {f.flagged && <span style={{ color: T.text.red, fontSize: 10 }}>⚑</span>}
                  <span style={{ color: f.flagged ? T.text.red : T.text.primary }}>{f.label}</span>
                </span>,
                <Badge key="cat" c={f.category === 'controllable' ? T.text.cyan : T.text.purple}>
                  {f.category === 'controllable' ? 'CTRL' : 'NON-C'}
                </Badge>,
                fmtDollar(f.uwTarget),
                <span key="act" style={{ color: f.actualRunRate > f.uwTarget ? T.text.red : T.text.green }}>
                  {fmtDollar(f.actualRunRate)}
                </span>,
                <span key="var" style={{ color: varTone, fontWeight: f.flagged ? 700 : 400 }}>
                  {varPct >= 0 ? '+' : ''}{varPct.toFixed(1)}%
                </span>,
                fmtDollar(f.projectedLine),
                f.recoveryAnnual > 0
                  ? <span key="rec" style={{ color: T.text.green }}>+${Math.round(f.recoveryAnnual).toLocaleString()}</span>
                  : <span key="rec" style={{ color: T.text.muted }}>—</span>,
                <span key="note" style={{ color: T.text.muted, fontStyle: 'italic', fontSize: 9 }}>{f.note}</span>,
              ];
            })}
            rowStyle={(_, i) => beatPlan.expense[i].flagged ? { background: T.text.red + '0C' } : undefined}
          />
        </Panel>
      ) : beatPlanLoading ? (
        <Panel style={{ marginBottom: 10 }}>
          <div style={{ padding: '14px 16px', fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>
            loading expense discipline…
          </div>
        </Panel>
      ) : null}

      <div style={{ display: 'flex', gap: 10 }}>
        {/* LEASE ROLL — expirations wired via /api/v1/operations/:dealId/lease-expirations */}
        <Panel style={{ flex: 1.3, minWidth: 0 }}>
          <PanelHeader
            title="LEASE ROLL"
            sub="schedule · next 24mo"
            right={<span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>
              {expirations.length ? `${expirations.reduce((s, e) => s + (e.expiringUnits ?? 0), 0)} units expiring` : '71 units'}
            </span>}
          />
          <Table
            head={['MONTH', 'TYPE', 'U', 'IN-PLACE', 'MARKET', 'Δ', 'ACT']}
            align={['l', 'l', 'r', 'r', 'r', 'r', 'c']}
            rows={leaseRollRows.map((r: any) => [
              r.month, r.type, r.units,
              r.inPlace, r.market,
              <span key="spread" style={{ color: r.spreadTone ?? (r.spread?.startsWith('−') ? T.text.red : T.text.green) }}>{r.spread}</span>,
              <Badge key="act" c={actionColor(r.action)}>{r.action}</Badge>,
            ])}
          />
        </Panel>

        {/* MARKET SIGNALS — wired via /api/v1/correlations/property/:propertyId */}
        <Panel style={{ flex: 1, minWidth: 0 }}>
          <PanelHeader title="MARKET SIGNALS" sub="throttle · leading" />
          <Table
            head={['SIGNAL', 'VALUE', 'LEAD', 'SRC']}
            align={['l', 'r', 'r', 'r']}
            rows={signalRows.map((s: any) => [
              s.name,
              <span key="val" style={{ color: s.tone, fontWeight: 700 }}>{s.dir === 'up' ? '▲' : s.dir === 'down' ? '▼' : '▬'} {s.value}</span>,
              <span key="lead" style={{ color: T.text.muted }}>{s.lead}</span>,
              <span key="src" style={{ color: T.text.muted, fontSize: 9 }}>{s.src}</span>,
            ])}
          />
        </Panel>

        {/* COMP SET & RANK — TODO(unwired: rankings service + comp-set endpoint) */}
        <Panel style={{ flex: 1.1, minWidth: 0 }}>
          <PanelHeader
            title="COMP SET & RANK"
            sub={RANK.setLabel}
            right={<span onClick={() => openDrawer('rankcomps')} style={{ cursor: 'pointer', fontFamily: T.font.mono, fontSize: 9, color: T.text.cyan }}>⚙ edit</span>}
          />
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.subtle}` }}>
            {[
              ['RANK', `#${RANK.current} / ${RANK.set}`, T.text.amber],
              ['TARGET', `#${rankCfg.overall}${rankCfg.byType ? ' *' : ''}`, T.text.green],
              ['PCS', `${RANK.currentPCS} → ${PCS_BY_RANK[rankCfg.overall]}`, T.text.cyan],
            ].map(([l, v, c], i) => (
              <div key={l as string} style={{ flex: 1, padding: '8px 10px', borderRight: i < 2 ? `1px solid ${T.border.subtle}` : 'none' }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>{l}</div>
                <div style={{ fontFamily: T.font.mono, fontSize: 13, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'PROPERTY', 'PCS', 'RENT', 'OCC'].map((h, i) => (
                    <th key={i} style={{
                      textAlign: (i === 0 ? 'center' : i === 1 ? 'left' : 'right') as any,
                      fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, color: T.text.muted,
                      letterSpacing: 0.5, padding: '6px 10px', borderBottom: `1px solid ${T.border.subtle}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((c, ri) => (
                  <tr key={ri} style={{ borderBottom: `1px solid ${T.border.subtle}`, background: c.subject ? T.text.amber + '12' : 'transparent' }}>
                    <td style={{ textAlign: 'center', fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: c.subject ? T.text.amberBright : T.text.muted, padding: '6px 10px', borderLeft: c.subject ? `2px solid ${T.text.amber}` : '2px solid transparent' }}>{c.rank}</td>
                    <td style={{ textAlign: 'left', fontFamily: T.font.label, fontSize: 10, fontWeight: c.subject ? 700 : 400, color: c.subject ? T.text.amberBright : T.text.primary, padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {c.subject ? '▸ ' : ''}{c.short || c.name}
                      {c.src === 'user' && <span style={{ color: T.text.purple, fontSize: 8, marginLeft: 4 }}>✎</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: c.subject ? T.text.green : T.text.secondary, padding: '6px 10px' }}>{c.pcs}</td>
                    <td style={{ textAlign: 'right', fontFamily: T.font.mono, fontSize: 10, color: T.text.primary, padding: '6px 10px' }}>{c.rent}</td>
                    <td style={{ textAlign: 'right', fontFamily: T.font.mono, fontSize: 10, color: T.text.primary, padding: '6px 10px' }}>{c.occ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* LEASING FUNNEL · WEEKLY — wired via GET /api/v1/operations/:dealId/leasing-observations */}
      <Panel style={{ marginTop: 0 }}>
        <PanelHeader
          title="LEASING FUNNEL · WEEKLY"
          sub="traffic · tours · net leases · last 52w"
          right={
            leasingObs.length > 0
              ? <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>{leasingObs.length}w of data</span>
              : <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>loading…</span>
          }
        />
        {leasingObs.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={leasingObs} barGap={1} barCategoryGap="18%"
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={T.border.subtle} />
              <XAxis dataKey="week"
                tick={{ fontFamily: T.font.mono, fontSize: 8, fill: T.text.muted }}
                tickFormatter={(v: string) => v ? String(v).slice(5, 10) : ''}
                interval={Math.floor(leasingObs.length / 8)} />
              <YAxis tick={{ fontFamily: T.font.mono, fontSize: 8, fill: T.text.muted }} width={26} />
              <Tooltip
                contentStyle={{ background: T.bg.panel, border: `1px solid ${T.border.medium}`, fontFamily: T.font.mono, fontSize: 10 }}
                formatter={(v: number, name: string) => [v, name]}
              />
              <Bar dataKey="traffic" fill={T.text.orange} name="Traffic" />
              <Bar dataKey="tours" fill={T.text.cyan} name="Tours" />
              <Bar dataKey="leases" fill={T.text.green} name="Net Leases" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>
            fetching weekly observations…
          </div>
        )}
      </Panel>
    </>
  );
}

// ── PERFORMANCE SCREEN ────────────────────────────────────────────────────────
function PerformanceScreen({ dealId, activeScreen }: { dealId: string; activeScreen: string }) {
  const [sub, setSub] = useState('tracking');
  const [tf, setTf] = useState(12);

  // ── Live data state ──────────────────────────────────────────
  const [pvaData, setPvaData] = useState<any[]>([]);
  const [varData, setVarData] = useState<any[]>([]);
  const [liveCheckpoints, setLiveCheckpoints] = useState<{ icon: string; color: 'green' | 'amber' | 'red'; text: string }[]>([]);
  const [checkpointsLoading, setCheckpointsLoading] = useState(false);
  // TODO(backend: M09 4-col endpoint) — GET /api/v1/operations/:dealId/live-tracking
  const [liveTracking, setLiveTracking] = useState<any[] | null>(null);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/projected-vs-actual`)
      .then(res => { setPvaData(res.data?.data ?? []); })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    // Trigger variance computation for current period (idempotent)
    apiClient.post(`/api/v1/operations/${dealId}/variances/compute`, {})
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/variances`)
      .then(res => { setVarData(res.data?.variances ?? []); })
      .catch(() => {});
  }, [dealId, activeScreen, refreshKey]);

  // TODO(backend: M09 4-col endpoint) — always 404 until live-tracking route is built
  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/operations/${dealId}/live-tracking`)
      .then(res => { setLiveTracking(res.data?.rows ?? []); })
      .catch(() => { setLiveTracking(null); });
  }, [dealId, activeScreen, refreshKey]);

  // ── Commentary agent — thesis checkpoints ─────────────────────
  const fetchCommentary = useCallback((forceRefresh = false) => {
    if (!dealId) return;
    setLiveCheckpoints([]);   // clear stale bullets from any previous deal
    setCheckpointsLoading(true);
    apiClient.post(`/api/v1/operations/${dealId}/commentary`, { forceRefresh })
      .then(res => {
        const pts = res.data?.checkpoints;
        if (Array.isArray(pts) && pts.length > 0) setLiveCheckpoints(pts);
      })
      .catch(() => {})
      .finally(() => setCheckpointsLoading(false));
  }, [dealId]);

  useEffect(() => {
    fetchCommentary();
  }, [fetchCommentary]);

  // ── Map PVA to chart data ─────────────────────────────────────
  const chartData = useMemo(() => {
    if (!pvaData.length) return PERF_SERIES.slice(-tf);
    return pvaData.slice(-tf).map(r => ({
      m: r.month ?? (r.period ? r.period.slice(5, 7) : ''),
      actual: r.actNOI ?? null,
      target: r.projNOI ?? null,
    }));
  }, [pvaData, tf]);

  // ── TTM NOI and variance vs proforma ────────────────────────
  const pvaStats = useMemo(() => {
    if (!pvaData.length) return null;
    const last12 = pvaData.slice(-12);
    const noiTtm = last12.reduce((s, r) => s + (r.actNOI ?? 0), 0);
    const projTtm = last12.reduce((s, r) => s + (r.projNOI ?? 0), 0);
    const vsPf = projTtm ? ((noiTtm - projTtm) / Math.abs(projTtm)) * 100 : null;
    const sign = vsPf == null ? '—' : vsPf >= 0 ? `+${vsPf.toFixed(1)}%` : `${vsPf.toFixed(1)}%`;
    return {
      noiTtm: `$${(noiTtm / 1_000_000).toFixed(2)}M`,
      vsPf: sign,
      vsPfTone: vsPf == null ? T.text.muted : vsPf >= 0 ? T.text.green : T.text.red,
    };
  }, [pvaData]);

  // ── SCORECARD wired from projected-vs-actual response ────────
  const liveSCORECARD = useMemo(() => {
    const noiVsUw = pvaStats?.vsPf ?? '—';
    const noiTone = pvaStats?.vsPfTone ?? T.text.muted;
    const lastPva = pvaData.length ? pvaData[pvaData.length - 1] : null;
    let occVsUw = '—';
    if (lastPva?.actOcc != null && lastPva?.projOcc != null) {
      // actOcc/projOcc are already in % form (0-100) — do not multiply by 100
      const diff = lastPva.actOcc - lastPva.projOcc;
      occVsUw = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp`;
    }
    return [
      { label: 'NOI vs Underwriting', value: noiVsUw, tone: noiTone },
      { label: 'EGI vs UW',           value: '—', tone: T.text.muted },
      { label: 'OpEx vs UW',          value: '—', tone: T.text.muted },
      { label: 'Occupancy vs UW',     value: occVsUw, tone: T.text.muted },
      // TODO(backend: reno premium, stabilization, hold IRR from performance engine)
      { label: 'Reno Premium',        value: '—', sub: '// TODO', tone: T.text.muted },
      { label: 'Stabilization',       value: '—', sub: '// TODO', tone: T.text.muted },
      { label: 'Hold IRR (proj.)',     value: '—', sub: '// TODO', tone: T.text.muted },
    ];
  }, [pvaStats, pvaData]);

  // ── Live variance rows from variance_analysis table ──────────
  const liveVariance = useMemo(() => {
    if (!varData.length) return VARIANCE;
    return varData.slice(0, 8).map((v: any) => {
      const noiImpact = parseFloat(v.noi_impact ?? '0');
      const pct = v.variance_pct != null ? `${Number(v.variance_pct).toFixed(1)}%` : '—';
      const flag = Math.abs(noiImpact) > 10_000;
      return {
        item: v.line_item ?? v.category ?? '—',
        uw: v.projected != null ? `$${Math.round(v.projected).toLocaleString()}` : '—',
        act: v.actual   != null ? `$${Math.round(v.actual).toLocaleString()}`    : '—',
        d: pct,
        flag,
      };
    });
  }, [varData]);

  return (
    <>
      <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
        {[['tracking', 'TRACKING'], ['lifecycle', 'LIFECYCLE'], ['exit', 'EXIT']].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} style={{
            fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            cursor: 'pointer', padding: '6px 13px', borderRadius: 2,
            border: `1px solid ${sub === k ? T.border.bright : T.border.subtle}`,
            background: sub === k ? T.bg.active : T.bg.panel,
            color: sub === k ? T.text.primary : T.text.muted,
          }}>{l}</button>
        ))}
      </div>

      {sub === 'tracking' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <ChartPanel
              title="ACTUAL vs PRO FORMA" sub="M22 · monthly NOI"
              data={chartData} tf={tf} setTf={setTf}
              fmt={v => '$' + (v / 1000).toFixed(0) + 'K'}
              lines={[{ key: 'actual', color: T.text.green }, { key: 'target', color: T.text.muted, dash: '4 3', w: 1.5 }]}
              controls={
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.subtle}` }}>
                  {[
                    ['NOI TTM',     pvaStats?.noiTtm ?? '$3.41M',   T.text.green],
                    ['vs PRO FORMA', pvaStats?.vsPf  ?? '−13.0%',   pvaStats?.vsPfTone ?? T.text.red],
                    ['EGI VAR',     '−6.7%',                         T.text.amber],
                    ['OPEX VAR',    '+3.8%',                         T.text.red],
                    ['STABILIZE',   "Q3 '26",                        T.text.amber],
                  ].map(([l, v, c], i) => (
                    <div key={l as string} style={{ flex: 1, padding: '9px 12px', borderRight: i < 4 ? `1px solid ${T.border.subtle}` : 'none' }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.5 }}>{l}</div>
                      <div style={{ fontFamily: T.font.mono, fontSize: 16, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              }
            />
            <Panel style={{ width: 268, flexShrink: 0 }}>
              <PanelHeader title="UNDERWRITING SCORECARD" sub="actual vs UW" />
              <StatRail rows={liveSCORECARD} signal={{ label: 'THESIS', note: 'NOI behind on insurance + slow rent burn-off', value: 'AT RISK', tone: T.text.amber }} />
            </Panel>
          </div>

          {/* LIVE TRACKING — wired to GET /api/v1/operations/:dealId/live-tracking */}
          <Panel style={{ marginBottom: 10, borderColor: liveTracking === null ? T.text.amber + '44' : T.border.bright }}>
            <PanelHeader
              title="LIVE TRACKING"
              sub="current → stabilized bridge (M09)"
              right={liveTracking === null
                ? <Badge c={T.text.amber}>PENDING M09 ENDPOINT</Badge>
                : null}
            />
            <Table
              head={['LINE ITEM', 'CURRENT', 'ACTUALS TTM', 'PRO FORMA', 'Δ TO PF']}
              align={['l', 'r', 'r', 'r', 'r']}
              rows={liveTracking && liveTracking.length > 0
                ? liveTracking.map((r: any) => {
                    const dp: number | null = r.delta_pct ?? null;
                    const tone = dp == null ? T.text.muted : dp >= 0 ? T.text.green : T.text.red;
                    const dLabel = dp == null ? '—' : (dp >= 0 ? `+${dp.toFixed(1)}%` : `${dp.toFixed(1)}%`);
                    const isGl = typeof r.line_item === 'string' && r.line_item.startsWith('  ');
                    return [
                      <span key="item" style={{ fontWeight: isGl ? 400 : 600, color: isGl ? T.text.muted : T.text.secondary, paddingLeft: isGl ? 8 : 0 }}>{r.line_item}</span>,
                      r.current_month_fmt ?? '—',
                      <span key="ttm" style={{ color: isGl ? T.text.muted : T.text.secondary }}>{r.actuals_ttm_fmt ?? '—'}</span>,
                      r.pro_forma_fmt ?? '—',
                      <span key="d" style={{ color: tone, fontWeight: 700 }}>{dLabel}</span>,
                    ];
                  })
                : FOURCOL.map(r => [
                    <span key="item" style={{ fontWeight: r.bold ? 700 : 400, color: r.bold ? T.text.primary : T.text.secondary }}>{r.item}</span>,
                    r.cur,
                    <span key="ttm" style={{ color: r.bold ? T.text.primary : T.text.secondary }}>{r.ttm}</span>,
                    r.pf,
                    <span key="d" style={{ color: r.tone, fontWeight: 700 }}>{r.d}</span>,
                  ])
              }
            />
          </Panel>

          <div style={{ display: 'flex', gap: 10 }}>
            <Panel style={{ flex: 1.2, minWidth: 0 }}>
              <PanelHeader title="LINE-ITEM VARIANCE" sub="vs UW · >10% flagged" />
              <Table
                head={['LINE ITEM', 'UW', 'ACTUAL', 'Δ', '']}
                align={['l', 'r', 'r', 'r', 'c']}
                rows={liveVariance.map((r: any) => [
                  r.item, r.uw, r.act,
                  <span key="d" style={{ color: r.flag ? T.text.red : T.text.secondary, fontWeight: r.flag ? 700 : 400 }}>{r.d}</span>,
                  r.flag ? <Badge key="flag" c={T.text.red}>FLAG</Badge> : '',
                ])}
              />
            </Panel>
            <Panel style={{ flex: 1, minWidth: 0 }}>
              <PanelHeader title="CAP-EX vs BUDGET" />
              <Table
                head={['ITEM', 'BUDGET', 'SPENT', '%', '']}
                align={['l', 'r', 'r', 'r', 'c']}
                rows={CAPEX_DATA.map(r => [
                  r.item, r.budget, r.spent, r.pct,
                  r.flag ? <Badge key="b" c={T.text.amber}>BEHIND</Badge> : <Badge key="b" c={T.text.green}>OK</Badge>,
                ])}
              />
              <div style={{ padding: '4px 12px 8px', fontFamily: T.font.mono, fontSize: 8, color: T.text.muted }}>
                // TODO(data: capex from GL — deal_monthly_actuals_lines WHERE account ILIKE '%capex%')
              </div>
            </Panel>
            <Panel style={{ flex: 1.1, minWidth: 0 }}>
              <PanelHeader title="THESIS CHECKPOINTS" sub={checkpointsLoading ? 'generating…' : 'AI commentary · owned-asset'} />
              <div style={{ padding: '4px 0' }}>
                {(() => {
                  const colorMap: Record<string, string> = {
                    green: T.text.green,
                    amber: T.text.amber,
                    red:   T.text.red,
                  };
                  // AH-1B: removed CHECKPOINTS fallback — thesis panel now shows real data or empty state
                  if (liveCheckpoints.length === 0) {
                    return (
                      <div style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, marginBottom: 8 }}>
                          No commentary generated yet.
                        </div>
                        <button
                          onClick={() => fetchCommentary(true)}
                          disabled={checkpointsLoading}
                          style={{
                            fontFamily: T.font.mono, fontSize: 9, fontWeight: 700,
                            color: T.text.cyan, background: 'transparent',
                            border: `1px solid ${T.text.cyan}55`, borderRadius: 2,
                            padding: '4px 12px', cursor: checkpointsLoading ? 'not-allowed' : 'pointer',
                            letterSpacing: 0.3,
                          }}
                        >
                          {checkpointsLoading ? 'GENERATING…' : 'GENERATE COMMENTARY'}
                        </button>
                      </div>
                    );
                  }
                  return liveCheckpoints.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: i < liveCheckpoints.length - 1 ? `1px solid ${T.border.subtle}` : 'none' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: colorMap[c.color] ?? T.text.muted, marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontFamily: T.font.label, fontSize: 10, color: T.text.secondary, lineHeight: 1.45 }}>{c.text}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* LIFECYCLE — wired to LifecycleSection (M22 · reforecast · disposition · debt · capex) */}
      {sub === 'lifecycle' && dealId && (
        <div style={{ minHeight: 480 }}>
          <LifecycleSection dealId={dealId} />
        </div>
      )}

      {sub === 'exit' && <ExitTimingTab dealId={dealId} />}
    </>
  );
}

// ── CAPITAL SCREEN ────────────────────────────────────────────────────────────
function CapitalScreen({ dealId }: { dealId: string }) {
  const [sub, setSub] = useState('debt');
  const [tf, setTf] = useState(12);
  const data = DEBT_SERIES.slice(-tf);
  const [debtPos, setDebtPos] = useState<any>(null);

  // TODO(backend: GET /api/v1/capital/:dealId/capital-accounts) — per-member accounts
  const [capitalAccounts, setCapitalAccounts] = useState<any>(null);
  // TODO(backend: GET /api/v1/capital/:dealId/waterfall?type=operating|capital) — dual waterfall
  const [waterfallOp, setWaterfallOp] = useState<any>(null);
  const [waterfallCap, setWaterfallCap] = useState<any>(null);

  // A6-F1: CapitalScreen refresh — add refreshKey to deps
  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/capital/${dealId}/capital-accounts`)
      .then(res => { setCapitalAccounts(res.data ?? null); })
      .catch(() => { setCapitalAccounts(null); });
  }, [dealId, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/capital/${dealId}/waterfall?type=operating`)
      .then(res => { setWaterfallOp(res.data ?? null); })
      .catch(() => { setWaterfallOp(null); });
    apiClient.get(`/api/v1/capital/${dealId}/waterfall?type=capital`)
      .then(res => { setWaterfallCap(res.data ?? null); })
      .catch(() => { setWaterfallCap(null); });
  }, [dealId, refreshKey]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/lifecycle/${dealId}/debt`)
      .then(res => {
        const positions = res.data?.positions ?? [];
        if (positions.length > 0) setDebtPos(positions[0]);
      })
      .catch(() => {});
  }, [dealId, refreshKey]);

  // ── Compute display values from live debt position (fall back to hardcoded) ──
  const fmtPct = (v: number | undefined, fallback: string) => {
    if (v == null) return fallback;
    const pct = v <= 1 ? v * 100 : v;
    return pct.toFixed(2) + '%';
  };
  const fmtMoney = (v: number | undefined, fallback: string) => {
    if (v == null) return fallback;
    return '$' + (v / 1_000_000).toFixed(1) + 'M';
  };
  const fmtMonthYear = (d: string | Date | undefined, fallback: string) => {
    if (!d) return fallback;
    const dt = new Date(d);
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
    return `${mon} '${String(dt.getFullYear()).slice(2)}`;
  };
  const dpRate = debtPos?.currentRate;
  const dpSpread = debtPos?.spreadBps;
  const dpSofr = (dpRate != null && dpSpread != null)
    ? ((dpRate <= 1 ? dpRate : dpRate / 100) - dpSpread / 10000)
    : null;
  const debtChipVals = {
    allIn:     fmtPct(dpRate, '6.85%'),
    sofr:      dpSofr != null ? (dpSofr * 100).toFixed(2) + '%' : '4.30%',
    spread:    dpSpread != null ? `+${dpSpread}bps` : '+285bps',
    dscr:      debtPos?.dscrCovenant ? debtPos.dscrCovenant.toFixed(2) + 'x' : '1.48x',
    capExpiry: debtPos?.rateCapExpiry ? fmtMonthYear(debtPos.rateCapExpiry, "Sep '26") : debtPos?.hedgeExpiryDate ? fmtMonthYear(debtPos.hedgeExpiryDate, "Sep '26") : "Sep '26",
  };
  const liveDebtOverview = debtPos ? [
    { label: 'Loan Balance',     value: fmtMoney(debtPos.currentBalance, '$34.8M') },
    { label: 'Lender',           value: debtPos.lenderName ?? 'Bridge' },
    { label: 'Index',            value: debtPos.baseRate ?? '1M SOFR' },
    { label: 'Current SOFR',     value: debtChipVals.sofr },
    { label: 'Spread',           value: debtChipVals.spread },
    { label: 'All-In Rate',      value: debtChipVals.allIn, tone: T.text.amber },
    { label: 'Rate Cap Strike',  value: debtPos.rateCapStrike != null ? fmtPct(debtPos.rateCapStrike, '4.00%') : debtPos.rateCap != null ? fmtPct(debtPos.rateCap, '4.00%') : '4.00%', tone: T.text.cyan },
    { label: 'Cap Expiry',       value: debtChipVals.capExpiry, sub: '15mo', tone: T.text.red },
    { label: 'Maturity',         value: fmtMonthYear(debtPos.maturityDate, "Mar '28") },
    { label: 'DSCR',             value: debtChipVals.dscr, tone: T.text.green },
    { label: 'Debt Yield',       value: debtPos.debtYieldCovenant != null ? fmtPct(debtPos.debtYieldCovenant, '9.2%') : '9.2%' },
    { label: 'Breakeven Occ.',   value: '78.4%' },
  ] : DEBT_OVERVIEW;

  return (
    <>
      <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
        {[['debt', 'DEBT & RATE'], ['distributions', 'DISTRIBUTIONS'], ['waterfall', 'WATERFALL']].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} style={{
            fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
            cursor: 'pointer', padding: '6px 13px', borderRadius: 2,
            border: `1px solid ${sub === k ? T.border.bright : T.border.subtle}`,
            background: sub === k ? T.bg.active : T.bg.panel,
            color: sub === k ? T.text.primary : T.text.muted,
          }}>{l}</button>
        ))}
      </div>

      {sub === 'debt' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <ChartPanel
              title="FLOATING RATE · SOFR vs ALL-IN" sub="1M SOFR · cap strike 4.00%"
              data={data} tf={tf} setTf={setTf} fmt={v => v.toFixed(2) + '%'}
              refLine={{ y: 4.00, color: T.text.cyan, label: 'CAP 4.00%' }}
              lines={[{ key: 'sofr', color: T.text.orange, dash: '4 3', w: 1.4 }, { key: 'allIn', color: T.text.amber, w: 1.8 }]}
              controls={
                <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.subtle}` }}>
                  {[
                    ['ALL-IN', debtChipVals.allIn, T.text.amber], ['SOFR', debtChipVals.sofr, T.text.orange],
                    ['SPREAD', debtChipVals.spread, T.text.primary], ['DSCR', debtChipVals.dscr, T.text.green],
                    ['CAP EXPIRY', debtChipVals.capExpiry, T.text.red],
                  ].map(([l, v, c], i) => (
                    <div key={l as string} style={{ flex: 1, padding: '9px 12px', borderRight: i < 4 ? `1px solid ${T.border.subtle}` : 'none' }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.5 }}>{l}</div>
                      <div style={{ fontFamily: T.font.mono, fontSize: 16, fontWeight: 700, color: c as string, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              }
            />
            <Panel style={{ width: 268, flexShrink: 0 }}>
              <PanelHeader title="DEBT OVERVIEW" sub="capital stack" />
              <StatRail rows={liveDebtOverview} signal={{ label: 'RATE EXPOSURE', note: 'Capped to Sep \'26, then floating → refi before maturity', value: 'EXPOSED', tone: T.text.amber }} />
            </Panel>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Panel style={{ flex: 1.2, minWidth: 0 }}>
              <PanelHeader title="RATE SENSITIVITY" sub="DSCR under rate paths · * capped" />
              <Table
                head={['SCENARIO', 'ALL-IN', 'DSCR', '']}
                align={['l', 'r', 'r', 'c']}
                rows={RATE_SENS.map(r => [
                  r.scn, r.rate,
                  <span key="dscr" style={{ color: r.tone, fontWeight: 700 }}>{r.dscr}</span>,
                  <span key="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: r.tone, display: 'inline-block' }} />,
                ])}
              />
            </Panel>
            <Panel style={{ flex: 1, minWidth: 0 }}>
              <PanelHeader title="REFI WINDOW" sub="maturity Mar '28" />
              <StatRail rows={REFI_DATA} />
            </Panel>
            <Panel style={{ flex: 1, minWidth: 0 }}>
              <PanelHeader title="HEDGE STATUS" />
              <div style={{ padding: 12 }}>
                {debtPos ? (() => {
                  const strike   = debtPos.rateCapStrike ?? debtPos.rateCap;
                  const expiry   = debtPos.hedgeExpiryDate ?? debtPos.rateCapExpiry;
                  const htype    = (debtPos.hedgeType && debtPos.hedgeType !== 'none') ? debtPos.hedgeType.toUpperCase() : 'CAP';
                  const notional = fmtMoney(debtPos.currentBalance, '$34.8M');
                  const sofrPct  = dpSofr != null ? +(dpSofr * 100).toFixed(2) : 4.30;
                  const strikePct = strike != null ? (strike <= 1 ? +(strike * 100).toFixed(2) : +strike.toFixed(2)) : 4.00;
                  const capPaying = sofrPct > strikePct;
                  const bpsBenefit = capPaying ? Math.round((sofrPct - strikePct) * 100) : 0;
                  return (
                    <>
                      <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.secondary, lineHeight: 1.7 }}>
                        {htype} @ <b style={{ color: T.text.cyan }}>{strikePct.toFixed(2)}%</b>, notional <b style={{ color: T.text.primary }}>{notional}</b>.<br />
                        SOFR {sofrPct.toFixed(2)}% {capPaying ? '>' : '≤'} strike → {htype.toLowerCase()} {capPaying
                          ? <><b style={{ color: T.text.green }}>paying ~{bpsBenefit}bps</b></>
                          : <b style={{ color: T.text.muted }}>not paying (OTM)</b>}.<br />
                        {expiry
                          ? <>Expires <b style={{ color: T.text.red }}>{fmtMonthYear(expiry, "Sep '26")}</b> — before maturity.</>
                          : <>Expiry not set — update loan record.</>}
                      </div>
                      {expiry && (() => {
                        const msToExpiry = new Date(expiry).getTime() - Date.now();
                        const moToExpiry = Math.round(msToExpiry / (1000 * 60 * 60 * 24 * 30.44));
                        if (moToExpiry <= 18) {
                          return (
                            <div style={{ marginTop: 10, padding: '8px 10px', border: `1px solid ${T.text.red}44`, background: T.text.red + '12', borderRadius: 2 }}>
                              <span style={{ fontFamily: T.font.label, fontSize: 10, color: T.text.red }}>
                                ⚑ {htype} expires in {moToExpiry}mo — extension or replacement required before maturity.
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  );
                })() : (
                  <>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.secondary, lineHeight: 1.7 }}>
                      Rate cap @ <b style={{ color: T.text.cyan }}>4.00%</b>, notional <b style={{ color: T.text.primary }}>$34.8M</b>.<br />
                      SOFR 4.30% &gt; strike → cap paying <b style={{ color: T.text.green }}>~30bps</b>.<br />
                      Expires <b style={{ color: T.text.red }}>Sep '26</b> — 15mo before maturity.
                    </div>
                    <div style={{ marginTop: 10, padding: '8px 10px', border: `1px solid ${T.text.amber}44`, background: T.text.amber + '12', borderRadius: 2 }}>
                      <span style={{ fontFamily: T.font.label, fontSize: 10, color: T.text.amber }}>
                        ⚑ ILLUSTRATIVE — no active debt position loaded.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Panel>
          </div>
        </>
      )}

      {sub === 'distributions' && (
        // CAPITAL ACCOUNTS — wired to GET /api/v1/capital/:dealId/capital-accounts
        <div style={{ display: 'flex', gap: 10 }}>
          <Panel style={{ flex: 1, minWidth: 0, borderColor: capitalAccounts === null ? T.text.amber + '44' : undefined }}>
            <PanelHeader
              title="CAPITAL ACCOUNTS"
              sub="per-member · MAG Highlands JV"
              right={capitalAccounts === null ? <Badge c={T.text.amber}>ILLUSTRATIVE — PENDING CAPITAL ACCOUNTS</Badge> : null}
            />
            <Table
              head={['MEMBER', 'COMMITTED', 'CALLED', 'DISTRIBUTED', 'PREF ACCR.', 'TIER']}
              align={['l', 'r', 'r', 'r', 'r', 'c']}
              rows={capitalAccounts?.members?.length > 0
                ? capitalAccounts.members.map((m: any) => {
                    const fmtM = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v).toLocaleString()}`;
                    const tier = m.class === 'gp' ? 'Promote' : 'Pref';
                    return [
                      m.name,
                      fmtM(m.commitment_amount),
                      fmtM(m.called),
                      fmtM(m.distributed),
                      <span key="pref" style={{ color: T.text.muted }}>—</span>,
                      <Badge key="tier" c={tier === 'Promote' ? T.text.purple : T.text.cyan}>{tier}</Badge>,
                    ];
                  })
                : MEMBERS.map(m => [
                    m.member, m.committed, m.called, m.distributed,
                    <span key="pref" style={{ color: m.pref === '—' ? T.text.muted : T.text.amber }}>{m.pref}</span>,
                    <Badge key="tier" c={m.tier === 'Promote' ? T.text.purple : T.text.cyan}>{m.tier}</Badge>,
                  ])
              }
            />
          </Panel>
          <Panel style={{ width: 268, flexShrink: 0 }}>
            <PanelHeader title="FUND SUMMARY" />
            {capitalAccounts?.summary
              ? (() => {
                  const s = capitalAccounts.summary;
                  const fmtM = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v).toLocaleString()}`;
                  const dpi = s.total_committed > 0 ? (s.total_distributed / s.total_committed).toFixed(2) + 'x' : '—';
                  const unreturned = s.total_called - s.total_distributed;
                  const liveSummary = [
                    { label: 'Total Equity', value: fmtM(s.total_committed) },
                    { label: 'Distributed',  value: fmtM(s.total_distributed) },
                    { label: 'DPI',          value: dpi },
                    { label: 'Unreturned Capital', value: fmtM(Math.max(0, unreturned)) },
                    { label: 'Members',      value: String(s.member_count) },
                  ];
                  return <StatRail rows={liveSummary} />;
                })()
              : <StatRail rows={DIST_SUMMARY.map(([label, value]) => ({ label, value }))} />
            }
          </Panel>
        </div>
      )}

      {sub === 'waterfall' && (
        // TODO(backend: GET /api/v1/capital/:dealId/waterfall?type=operating|capital) — dual waterfall
        <div style={{ display: 'flex', gap: 10 }}>
          <Panel style={{ flex: 1, minWidth: 0, borderColor: waterfallOp === null ? T.text.amber + '44' : undefined }}>
            <PanelHeader
              title="OPERATING CASH WATERFALL"
              sub="recurring"
              right={waterfallOp === null ? <Badge c={T.text.amber}>PENDING DUAL WATERFALL MODEL</Badge> : null}
            />
            <Table
              head={['TIER', 'DETAIL', 'LP/GP']}
              align={['l', 'l', 'r']}
              rows={WF_OPERATING.map(t => [
                <span key="tier" style={{ fontWeight: 700, color: T.text.primary }}>{t.tier}</span>,
                <span key="detail" style={{ color: T.text.muted }}>{t.detail}</span>,
                <span key="split" style={{ color: T.text.cyan }}>{t.split}</span>,
              ])}
            />
          </Panel>
          <Panel style={{ flex: 1, minWidth: 0, borderColor: waterfallCap === null ? T.text.amber + '44' : undefined }}>
            <PanelHeader
              title="CAPITAL EVENT WATERFALL"
              sub="sale / refi · 1.40x MOIC floor"
              right={waterfallCap === null ? <Badge c={T.text.amber}>PENDING DUAL WATERFALL MODEL</Badge> : null}
            />
            <Table
              head={['TIER', 'DETAIL', 'LP/GP']}
              align={['l', 'l', 'r']}
              rows={WF_CAPITAL.map(t => [
                <span key="tier" style={{ fontWeight: 700, color: T.text.primary }}>{t.tier}</span>,
                <span key="detail" style={{ color: T.text.muted }}>{t.detail}</span>,
                <span key="split" style={{ color: T.text.cyan }}>{t.split}</span>,
              ])}
            />
          </Panel>
        </div>
      )}
    </>
  );
}

// ── SHELL ─────────────────────────────────────────────────────────────────────
export default function AssetHubPage() {
  const { dealId: urlDealId } = useParams<{ dealId: string }>();
  const selectedAssetDealId = useDealStore(s => s.selectedAssetDealId);
  const propertyId = useDealStore(s => s.selectedAssetPropertyId);
  const setSelectedAsset = useDealStore(s => s.setSelectedAsset);
  const deals = useDealStore(s => (s as any).deals as any[] | undefined);

  // Sync URL param → dealStore; also resolve + set propertyId from deals list
  useEffect(() => {
    if (urlDealId) {
      const deal = (deals ?? []).find((d: any) => d.id === urlDealId);
      setSelectedAsset(urlDealId, deal?.property_id ?? null);
    }
    return () => {
      setSelectedAsset(null, null);
    };
  }, [urlDealId, setSelectedAsset, deals]);

  // Prefer the store value (set by useEffect above); fall back to URL param
  const dealId = selectedAssetDealId ?? urlDealId ?? '';

  // Fallback: when the deals list hasn't loaded yet, resolve propertyId from the API
  useEffect(() => {
    if (!dealId || propertyId) return;
    apiClient.get(`/api/v1/deals/${dealId}`)
      .then(res => {
        const pid = res.data?.deal?.property_id ?? null;
        if (pid) setSelectedAsset(dealId, pid);
      })
      .catch(() => {});
  }, [dealId, propertyId, setSelectedAsset]);

  // ── Fetch comps from the API (populates drawer + rank leaderboard) ──
  const [screen, setScreen] = useState<'revenue' | 'performance' | 'capital'>('revenue');
  const [drawer, setDrawer] = useState<string | null>(null);
  const [comps, setComps] = useState<Comp[]>(DEFAULT_COMPS);
  const [rankCfg, setRankCfg] = useState<RankCfg>({ overall: 2, byType: false, perType: { '1BR': 3, '2BR': 2, '3BR': 3, 'STU': 4 } });
  const [targetSavedVersion, setTargetSavedVersion] = useState(0);
  // A6-F1/F2/F3: global refresh key — increment to force re-fetch of all live data
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/lifecycle/${dealId}/comp-set`)
      .then(res => {
        const rows = res.data?.comps ?? [];
        if (!rows.length) return;
        const mapped: Comp[] = rows.map((c: any, i: number) => ({
          name: c.property_name ?? c.comp_property_address ?? `Comp ${i + 1}`,
          short: (c.property_name ?? c.comp_property_address ?? `Comp ${i + 1}`).slice(0, 18),
          dist: c.distance_miles != null ? `${Number(c.distance_miles).toFixed(1)}mi` : '—',
          rent: c.avg_rent != null ? `$${Math.round(Number(c.avg_rent)).toLocaleString()}` : '—',
          occ: c.occupancy != null ? `${Number(c.occupancy).toFixed(1)}%`
            : c.occupancy_rate != null ? `${(Number(c.occupancy_rate) * 100).toFixed(1)}%` : '—',
          concess: '—',
          vs: '—',
          src: 'platform' as const,
          // TODO(data: rankings service) — show '—' until PCS ranking engine is wired
          pcs: c.match_score != null ? Math.round(c.match_score) : '—',
          rank: i + 1,
          f: 1,
          color: COMP_COLORS[i % COMP_COLORS.length],
        }));
        setComps(mapped);
      })
      .catch(() => {});
  }, [dealId]);

  const openDrawer = (d: string) => setDrawer(d);
  const closeDrawer = () => setDrawer(null);

  const TOOLS: [string, string, string][] = [
    ['⚡', 'events', 'EVENTS'],
    ['▣', 'files', 'FILES'],
    ['◐', 'team', 'TEAM'],
    ['☰', 'activity', 'ACTIVITY'],
  ];

  return (
    <div style={{
      background: T.bg.terminal, color: T.text.primary, fontFamily: T.font.label,
      minHeight: '100vh', minWidth: 1180, display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <style>{CSS_INJECT}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        height: 30, background: T.bg.topBar, borderBottom: `1px solid ${T.border.medium}`,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 14, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.font.mono, fontWeight: 800, fontSize: 12, color: T.text.amber, letterSpacing: 1 }}>
          JEDI<span style={{ color: T.text.primary }}>RE</span>
        </span>
        <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted, letterSpacing: 0.6 }}>PORTFOLIO · OWNED ASSETS</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.font.mono, fontSize: 9, color: T.text.green }}>● LIVE</span>
        <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.green, border: `1px solid ${T.text.green}44`, padding: '1px 6px', borderRadius: 2 }}>
          PHASE C · stubs wired
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── LEFT NAV ── */}
        <div style={{
          width: 188, background: T.bg.panel, borderRight: `1px solid ${T.border.subtle}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
        }}>
          <NavSection label="VIEWS" items={[
            ['▦', 'Positions', false],
            ['◧', 'Asset', true],
            ['▤', 'Reports', false],
          ]} />
          <NavSection label="OWNED ASSETS" items={[['●', 'Highlands · 84', true]]} addable />
          <NavSection label="COMP SET" items={comps.map(c => ['·', c.name, false] as [string, string, boolean])} />
          <div style={{
            marginTop: 'auto', padding: '10px 12px', borderTop: `1px solid ${T.border.subtle}`,
            fontFamily: T.font.mono, fontSize: 9, color: T.text.muted,
          }}>
            <div style={{ color: T.text.secondary, fontWeight: 600 }}>MAG Highlands JV</div>
            <div>290 units · West ATL</div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Asset tab bar + utility toolbar */}
          <div style={{
            height: 34, background: T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'stretch', paddingLeft: 10, flexShrink: 0,
          }}>
            {/* Asset tab */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
              background: T.bg.panel, borderRight: `1px solid ${T.border.subtle}`,
              borderTop: `2px solid ${T.text.amber}`,
            }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.amberBright, letterSpacing: 0.4 }}>{ASSET.ticker}</span>
              <span style={{ fontFamily: T.font.label, fontSize: 11, color: T.text.secondary }}>{ASSET.name}</span>
              <Badge c={T.text.green}>{ASSET.mode}</Badge>
            </div>
            {/* Add asset tab */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', cursor: 'pointer' }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 13, color: T.text.muted }}>+</span>
            </div>
            {/* Utility tools (right side) */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'stretch', borderLeft: `1px solid ${T.border.subtle}` }}>
              <button
                onClick={() => openDrawer('rankcomps')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', cursor: 'pointer',
                  background: 'transparent', border: 'none', borderRight: `1px solid ${T.border.subtle}`,
                  fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, color: T.text.amber, letterSpacing: 0.5,
                }}
              >
                ⊕ RANK &amp; COMPS
              </button>
              {TOOLS.map(([icon, key, label]) => (
                <button
                  key={key}
                  onClick={() => openDrawer(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px',
                    cursor: 'pointer', background: 'transparent', border: 'none',
                    borderRight: `1px solid ${T.border.subtle}`,
                    fontFamily: T.font.mono, fontSize: 9, fontWeight: 700,
                    color: T.text.secondary, letterSpacing: 0.5,
                  }}
                >
                  {icon} {label}
                </button>
              ))}
              {/* A6-F1/F2/F3: Refresh button to force re-fetch of live data */}
              <button
                onClick={handleRefresh}
                title="Refresh data"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px',
                  cursor: 'pointer', background: 'transparent', border: 'none',
                  borderRight: `1px solid ${T.border.subtle}`,
                  fontFamily: T.font.mono, fontSize: 9, fontWeight: 700,
                  color: T.text.cyan, letterSpacing: 0.5,
                }}
              >
                ↻ REFRESH
              </button>
            </div>
          </div>

          {/* Sub-nav: REVENUE | PERFORMANCE | CAPITAL */}
          <div style={{
            height: 32, background: T.bg.terminal, borderBottom: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'stretch', paddingLeft: 10, flexShrink: 0,
          }}>
            {(['revenue', 'performance', 'capital'] as const).map(s => (
              <button key={s} onClick={() => setScreen(s)} style={{
                fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                cursor: 'pointer', padding: '0 16px', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${screen === s ? T.text.amber : 'transparent'}`,
                color: screen === s ? T.text.amberBright : T.text.muted,
                textTransform: 'uppercase',
              }}>
                {s}
              </button>
            ))}
            {/* Asset identity micro-badge */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>{ASSET.addr}</span>
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.muted }}>·</span>
              <span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.text.secondary }}>{ASSET.units} units</span>
            </div>
          </div>

          {/* Scrollable screen content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {screen === 'revenue' && (
              <RevenueScreen
                rankCfg={rankCfg} comps={comps} openDrawer={openDrawer}
                dealId={dealId} propertyId={propertyId} activeScreen={screen}
                targetSavedVersion={targetSavedVersion}
              />
            )}
            {screen === 'performance' && <PerformanceScreen dealId={dealId} activeScreen={screen} />}
            {screen === 'capital' && <CapitalScreen dealId={dealId} />}
          </div>
        </div>
      </div>

      {/* ── DRAWERS ── */}
      {drawer === 'rankcomps' && (
        <DrawerShell title="RANK & COMPS" sub="set-it-and-forget · annual" onClose={closeDrawer}>
          <RankCompsConfig
            rankCfg={rankCfg} setRankCfg={setRankCfg} comps={comps} setComps={setComps}
            propertyId={propertyId}
            onTargetSaved={() => setTargetSavedVersion(v => v + 1)}
          />
        </DrawerShell>
      )}

      {drawer === 'files' && (
        <DrawerShell title="FILES" sub="documents hub" onClose={closeDrawer}>
          <DocumentsSection dealId={dealId} />
        </DrawerShell>
      )}

      {drawer === 'team' && (
        <DrawerShell title="TEAM" sub="deal team & stakeholders" onClose={closeDrawer}>
          <TeamSection deal={{ id: dealId, status: 'owned' } as unknown as Deal} />
        </DrawerShell>
      )}

      {drawer === 'events' && (
        <DrawerShell title="EVENTS" sub="event impact timeline (M35)" onClose={closeDrawer}>
          <EventTimelineSection dealId={dealId} dealType="owned" />
        </DrawerShell>
      )}

      {drawer === 'activity' && (
        <DrawerShell title="ACTIVITY" sub="audit log" onClose={closeDrawer}>
          <ActivityTab dealId={dealId} />
        </DrawerShell>
      )}
    </div>
  );
}
