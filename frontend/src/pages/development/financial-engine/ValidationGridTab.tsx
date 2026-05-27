// ============================================================================
// ValidationGridTab — F9 Console · Assumption Validation Grid
// Sub-phase C of Validation work (Task #1274)
//
// Shows all key underwriting assumptions alongside their validation method,
// provenance source, and a quality badge (STRONG / WATCH / WEAK / UNVALIDATED).
// Read-only display — edits happen in DEAL TERMS, INPUTS, or DEBT tabs.
//
// Data sources:
//   props.f9Financials   — current resolved values from the F9 engine
//   props.assumptions    — ModelAssumptions (local build state)
//   /assumptions         — raw DB row: source_type, per_year_overrides
//   /implied-cap-rate    — platform-implied cap for exit cap validation
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

type QualityBand = 'STRONG' | 'WATCH' | 'WEAK' | 'UNVALIDATED';

interface ValidationRow {
  key: string;
  assumption: string;
  value: string;
  source: string;
  method: string;
  quality: QualityBand;
  detail?: string;
  platformBaseline?: string;
  isOverride?: boolean;
}

interface ValidationGroup {
  label: string;
  icon: string;
  rows: ValidationRow[];
}

const QUALITY_COLOR: Record<QualityBand, string> = {
  STRONG:      '#00D26A',
  WATCH:       BT.text.amber,
  WEAK:        '#FF5252',
  UNVALIDATED: BT.text.muted,
};

const QUALITY_BG: Record<QualityBand, string> = {
  STRONG:      '#00D26A14',
  WATCH:       `${BT.text.amber}14`,
  WEAK:        '#FF525214',
  UNVALIDATED: `${BT.text.muted}14`,
};

function fmtUsd(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  return v != null ? `${(v * 100).toFixed(2)}%` : '—';
}

function fmtYrs(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v} YR${v !== 1 ? 'S' : ''}`;
}

function fmtRent(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return `$${Math.round(v).toLocaleString()}/mo`;
}

const SOURCE_LABEL_MAP: Record<string, string> = {
  manual:               'Operator Input',
  user:                 'Operator Input',
  override:             'Operator Override',
  broker:               'Broker OM',
  agent:                'Agent Derived',
  platform:             'Platform Default',
  computed:             'Platform Computed',
  'tier1:t12':          'T-12 Document',
  'tier1:rent_roll':    'Rent Roll',
  'tier1:tax_bill':     'Tax Bill',
  'tier3:platform':     'Platform Benchmark',
  'tier3:market_comp':  'Market Comps',
  'strategy:entry':     'Strategy Module',
  'strategy:exit':      'Strategy Module',
  goal_seek:            'Goal Seek',
  event_timeline:       'Event Timeline',
};

function sourceLabel(s: string | null | undefined): string {
  if (!s) return 'Platform Default';
  return SOURCE_LABEL_MAP[s] ?? s;
}

function pyoSource(pyo: Record<string, any> | null, fieldPath: string): string | null {
  if (!pyo) return null;
  const meta = pyo[`module:source:${fieldPath}`];
  if (!meta) return null;
  return meta.source === 'user' ? 'Operator Override' : sourceLabel(meta.source);
}

function QualityIcon({ q }: { q: QualityBand }) {
  const c = QUALITY_COLOR[q];
  const s = { width: 9, height: 9, color: c, flexShrink: 0 as const };
  if (q === 'STRONG')      return <CheckCircle style={s} />;
  if (q === 'WATCH')       return <AlertTriangle style={s} />;
  if (q === 'WEAK')        return <AlertCircle style={s} />;
  return <HelpCircle style={s} />;
}

interface RawAssumptions {
  exit_cap: number | null;
  hold_period_years: number | null;
  avg_rent_per_unit: number | null;
  vacancy_pct: number | null;
  opex_ratio: number | null;
  interest_rate: number | null;
  ltc: number | null;
  source_type: string | null;
  per_year_overrides: Record<string, any> | null;
  exists?: boolean;
}

interface ImpliedCapData {
  implied_cap_rate: number | null;
  operator_going_in_cap: number | null;
  delta_bps: number | null;
  positioning_label: string | null;
  computation_method: string;
  rent_source: string | null;
  comp_reported_cap_rate: number | null;
  comp_count: number | null;
}

export function ValidationGridTab(props: FinancialEngineTabProps) {
  const fin = props.f9Financials ?? null;
  const assum = props.assumptions;

  const [rawA, setRawA]       = useState<RawAssumptions | null>(null);
  const [impliedCap, setImpliedCap] = useState<ImpliedCapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.dealId) return;
    setLoading(true);
    setRawA(null);
    setImpliedCap(null);
    Promise.all([
      apiClient.get<any>(`/api/v1/deals/${props.dealId}/assumptions`).catch(() => null),
      apiClient.get<any>(`/api/v1/deals/${props.dealId}/implied-cap-rate`).catch(() => null),
    ]).then(([ar, cr]) => {
      const ad = ar?.data?.data ?? ar?.data;
      if (ad?.deal_id || ad?.exists !== undefined) setRawA(ad);
      const cd = cr?.data?.data;
      if (cd) setImpliedCap(cd);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dealId]);

  const pyo = rawA?.per_year_overrides ?? null;

  // ── Build validation groups ─────────────────────────────────────────────────

  const groups: ValidationGroup[] = [];

  // ── ACQUISITION ──────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    const pp = fin?.capitalStack?.purchasePrice ?? assum?.acquisition?.purchasePrice ?? null;
    const ppPyo = pyoSource(pyo, 'acquisition.purchasePrice');
    const ppQ: QualityBand = pp != null && pp > 0
      ? (ppPyo === 'Operator Override' ? 'WATCH' : 'STRONG')
      : 'UNVALIDATED';
    rows.push({
      key: 'purchase_price',
      assumption: 'Purchase Price',
      value: fmtUsd(pp),
      source: ppPyo ?? (rawA?.source_type ? sourceLabel(rawA.source_type) : 'Not Set'),
      method: ppPyo ? 'Operator Override' : 'Operator Input',
      quality: ppQ,
      detail: pp != null && fin?.capitalStack?.pricePerUnit
        ? `${fmtUsd(fin.capitalStack.pricePerUnit)}/unit`
        : undefined,
      isOverride: ppPyo === 'Operator Override',
    });

    const goingInCap = fin?.returns?.valuation?.multiples?.capRate?.goingIn ?? null;
    rows.push({
      key: 'going_in_cap',
      assumption: 'Going-In Cap Rate',
      value: fmtPct(goingInCap),
      source: goingInCap != null ? 'Computed (T-12 NOI ÷ Price)' : 'Not Available',
      method: 'Computed from Model',
      quality: goingInCap != null ? 'STRONG' : 'UNVALIDATED',
    });

    groups.push({ label: 'ACQUISITION', icon: '◇', rows });
  }

  // ── DISPOSITION ───────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    const exitCapVal = fin?.assumptions?.exitCap ?? assum?.disposition?.exitCapRate ?? null;
    const exitPyo = pyoSource(pyo, 'disposition.exitCapRate');

    let exitQ: QualityBand = 'WATCH';
    let exitMethod = exitPyo ?? 'Operator Input';
    let exitDetail: string | undefined;
    let exitIsOverride = exitPyo === 'Operator Override';

    if (impliedCap?.implied_cap_rate != null) {
      const absDelta = Math.abs(impliedCap.delta_bps ?? 0);
      exitMethod = 'Comparable Sale';
      if (impliedCap.positioning_label === 'ALIGNED' || absDelta <= 50) {
        exitQ = 'STRONG';
      } else if (absDelta <= 150) {
        exitQ = 'WATCH';
        exitIsOverride = true;
      } else {
        exitQ = 'WEAK';
        exitIsOverride = true;
      }
      const sign = (impliedCap.delta_bps ?? 0) > 0 ? '+' : '';
      exitDetail = `${sign}${impliedCap.delta_bps} bps vs ${fmtPct(impliedCap.implied_cap_rate)} platform implied${impliedCap.comp_count ? ` · ${impliedCap.comp_count} comps` : ''}`;
    } else if (exitCapVal == null) {
      exitQ = 'UNVALIDATED';
    }

    rows.push({
      key: 'exit_cap',
      assumption: 'Exit Cap Rate',
      value: fmtPct(exitCapVal),
      source: exitPyo ?? 'Operator Input',
      method: exitMethod,
      quality: exitQ,
      detail: exitDetail,
      platformBaseline: impliedCap?.implied_cap_rate != null
        ? `Platform implied: ${fmtPct(impliedCap.implied_cap_rate)}`
        : undefined,
      isOverride: exitIsOverride,
    });

    const holdYrs = fin?.assumptions?.holdYears ?? assum?.holdPeriod ?? null;
    const holdPyo = pyoSource(pyo, 'hold.holdPeriodYears');
    rows.push({
      key: 'hold_period',
      assumption: 'Hold Period',
      value: fmtYrs(holdYrs),
      source: holdPyo ?? (holdYrs != null ? 'Operator Input' : 'Platform Default'),
      method: holdPyo === 'Strategy Module' ? 'Strategy Module' : holdYrs != null ? 'Operator Input' : 'Platform Default',
      quality: holdYrs != null && holdYrs > 0
        ? (holdPyo === 'Strategy Module' ? 'STRONG' : 'WATCH')
        : 'UNVALIDATED',
      isOverride: holdPyo === 'Operator Override',
    });

    const sellCostsPct = assum?.disposition?.sellingCosts ?? null;
    rows.push({
      key: 'selling_costs',
      assumption: 'Selling Costs %',
      value: sellCostsPct != null ? `${(sellCostsPct * 100).toFixed(1)}%` : '—',
      source: sellCostsPct != null ? 'Operator Input' : 'Platform Default',
      method: sellCostsPct != null ? 'Operator Input' : 'Platform Default',
      quality: sellCostsPct != null ? 'WATCH' : 'UNVALIDATED',
    });

    groups.push({ label: 'DISPOSITION', icon: '◈', rows });
  }

  // ── REVENUE ───────────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    const gprDecomp = fin?.assumptions?.gprDecomposition ?? null;
    const rentT12     = gprDecomp?.t12PerUnitMo ?? null;
    const rentRR      = fin?.rentRollSummary?.avgInPlaceRent ?? null;
    const rentPlat    = gprDecomp?.platformPerUnitMo ?? null;
    const rentBroker  = gprDecomp?.brokerPerUnitMo ?? null;
    const rentResolved = gprDecomp?.resolvedPerUnitMo ?? rawA?.avg_rent_per_unit ?? null;

    const rentQ: QualityBand =
      rentT12 != null || rentRR != null ? 'STRONG'
      : rentPlat != null ? 'WATCH'
      : rentBroker != null ? 'WEAK'
      : 'UNVALIDATED';
    const rentSrc = rentT12 != null ? 'T-12 Document'
      : rentRR != null ? 'Rent Roll'
      : rentPlat != null ? 'Platform Benchmark'
      : rentBroker != null ? 'Broker OM'
      : 'Not Set';
    const rentMeth = rentT12 != null ? 'Document (T-12)'
      : rentRR != null ? 'Document (Rent Roll)'
      : rentPlat != null ? 'Market Benchmark'
      : 'Operator Input';

    rows.push({
      key: 'rent_y1',
      assumption: 'Y1 Market Rent (per unit)',
      value: fmtRent(rentResolved),
      source: rentSrc,
      method: rentMeth,
      quality: rentQ,
      detail: rentT12 != null && rentBroker != null
        ? `T-12: ${fmtRent(rentT12)} · Broker: ${fmtRent(rentBroker)}`
        : rentT12 != null ? `T-12: ${fmtRent(rentT12)}`
        : rentBroker != null ? `Broker: ${fmtRent(rentBroker)}`
        : undefined,
    });

    const rentGrowthY1 = fin?.assumptions?.rentGrowthYr1 ?? assum?.revenue?.rentGrowth?.[0] ?? null;
    const rentGrowthPyo = pyoSource(pyo, 'revenue.rentGrowth[0]');
    rows.push({
      key: 'rent_growth_y1',
      assumption: 'Rent Growth Y1',
      value: fmtPct(rentGrowthY1),
      source: rentGrowthPyo ?? (rawA?.source_type === 'agent' ? 'Agent Derived' : 'Platform Benchmark'),
      method: rentGrowthPyo ? 'Operator Override' : 'Market Benchmark',
      quality: rentGrowthY1 != null ? 'WATCH' : 'UNVALIDATED',
      isOverride: !!rentGrowthPyo,
    });

    const rentGrowthStab = fin?.assumptions?.rentGrowthStabilized ?? null;
    if (rentGrowthStab != null) {
      rows.push({
        key: 'rent_growth_stab',
        assumption: 'Rent Growth (stabilized)',
        value: fmtPct(rentGrowthStab),
        source: 'Platform Benchmark',
        method: 'Market Benchmark',
        quality: 'WATCH',
      });
    }

    const occ = assum?.revenue?.stabilizedOccupancy ?? (rawA?.vacancy_pct != null ? 1 - rawA.vacancy_pct : null);
    const hasRRocc = fin?.rentRollSummary?.weightedOccupancyPct != null;
    rows.push({
      key: 'stab_occ',
      assumption: 'Stabilized Occupancy',
      value: occ != null ? `${(occ * 100).toFixed(1)}%` : '—',
      source: hasRRocc ? 'Rent Roll' : rawA?.source_type ? sourceLabel(rawA.source_type) : 'Platform Default',
      method: hasRRocc ? 'Document (Rent Roll)' : 'Market Benchmark',
      quality: hasRRocc ? 'STRONG' : occ != null ? 'WATCH' : 'UNVALIDATED',
      detail: hasRRocc ? `Rent roll occupancy: ${((fin!.rentRollSummary!.weightedOccupancyPct!) * 100).toFixed(1)}%` : undefined,
    });

    const collLoss = assum?.revenue?.collectionLoss ?? null;
    rows.push({
      key: 'collection_loss',
      assumption: 'Collection / Bad Debt',
      value: collLoss != null ? `${(collLoss * 100).toFixed(1)}%` : '—',
      source: 'Platform Default',
      method: 'Platform Benchmark',
      quality: collLoss != null ? 'WATCH' : 'UNVALIDATED',
    });

    groups.push({ label: 'REVENUE', icon: '⊕', rows });
  }

  // ── EXPENSES ─────────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    const opexRatio = rawA?.opex_ratio ?? null;
    rows.push({
      key: 'opex_ratio',
      assumption: 'Operating Expense Ratio',
      value: opexRatio != null ? `${(opexRatio * 100).toFixed(1)}%` : '—',
      source: rawA?.source_type ? sourceLabel(rawA.source_type) : 'Platform Default',
      method: 'Platform Benchmark',
      quality: opexRatio != null ? 'WATCH' : 'UNVALIDATED',
      detail: 'total opex / EGR',
    });

    const expItems = assum?.expenses ? Object.values(assum.expenses) : [];
    const expGrowthSample = expItems[0]?.growthRate ?? null;
    rows.push({
      key: 'expense_growth',
      assumption: 'Expense Growth Rate',
      value: expGrowthSample != null ? fmtPct(expGrowthSample) : '—',
      source: 'Platform Default',
      method: 'Platform Benchmark',
      quality: expGrowthSample != null ? 'WATCH' : 'UNVALIDATED',
    });

    groups.push({ label: 'EXPENSES', icon: '$', rows });
  }

  // ── FINANCING ─────────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    const loanAmt = fin?.capitalStack?.loanAmount ?? assum?.financing?.loanAmount ?? null;
    const ppForLtv = fin?.capitalStack?.purchasePrice ?? assum?.acquisition?.purchasePrice ?? null;
    const ltvCalc = loanAmt != null && ppForLtv != null && ppForLtv > 0 ? loanAmt / ppForLtv : null;
    const ltvRaw = rawA?.ltc ?? null;
    const ltvDisplay = ltvCalc ?? ltvRaw;
    const hasDebtAdvisor = fin?.debt != null;

    rows.push({
      key: 'ltv',
      assumption: 'LTV at Close',
      value: ltvDisplay != null ? `${(ltvDisplay * 100).toFixed(1)}%` : '—',
      source: hasDebtAdvisor ? 'Debt Advisor (M11)' : 'Platform Default',
      method: hasDebtAdvisor ? 'Debt Advisor' : 'Platform Benchmark',
      quality: hasDebtAdvisor ? 'STRONG' : ltvDisplay != null ? 'WATCH' : 'UNVALIDATED',
      detail: loanAmt ? `Loan amount: ${fmtUsd(loanAmt)}` : undefined,
    });

    const intRate = fin?.capitalStack?.interestRate ?? assum?.financing?.interestRate ?? null;
    rows.push({
      key: 'interest_rate',
      assumption: 'Interest Rate',
      value: intRate != null && intRate > 0 ? fmtPct(intRate) : '—',
      source: hasDebtAdvisor ? 'Debt Advisor (M11)' : 'Platform Default',
      method: hasDebtAdvisor ? 'Debt Advisor' : 'Platform Benchmark',
      quality: hasDebtAdvisor ? 'STRONG' : intRate != null && intRate > 0 ? 'WATCH' : 'UNVALIDATED',
    });

    const termYrs = assum?.financing?.term ?? null;
    rows.push({
      key: 'loan_term',
      assumption: 'Loan Term',
      value: fmtYrs(termYrs),
      source: hasDebtAdvisor ? 'Debt Advisor (M11)' : 'Platform Default',
      method: hasDebtAdvisor ? 'Debt Advisor' : 'Platform Default',
      quality: hasDebtAdvisor ? 'STRONG' : termYrs != null ? 'WATCH' : 'UNVALIDATED',
    });

    groups.push({ label: 'FINANCING', icon: '⊞', rows });
  }

  // ── Summary counts ─────────────────────────────────────────────────────────
  const allRows = groups.flatMap(g => g.rows);
  const counts: Record<QualityBand, number> = {
    STRONG:      allRows.filter(r => r.quality === 'STRONG').length,
    WATCH:       allRows.filter(r => r.quality === 'WATCH').length,
    WEAK:        allRows.filter(r => r.quality === 'WEAK').length,
    UNVALIDATED: allRows.filter(r => r.quality === 'UNVALIDATED').length,
  };
  const overrideCount = allRows.filter(r => r.isOverride).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  const COL_GRID = '1.7fr 0.85fr 1.1fr 1.2fr 0.75fr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BT.bg.terminal }}>

      {/* ── Header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        padding: '5px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.8 }}>
          ASSUMPTION VALIDATION GRID
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          {allRows.length} FIELDS · READ ONLY
        </span>
        {overrideCount > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 7, fontWeight: 700,
            color: BT.text.amber, padding: '1px 5px',
            border: `1px solid ${BT.text.amber}44`, borderRadius: 2,
          }}>
            {overrideCount} OVERRIDE{overrideCount > 1 ? 'S' : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['STRONG', 'WATCH', 'WEAK', 'UNVALIDATED'] as QualityBand[]).map(q => (
            counts[q] > 0 && (
              <span key={q} style={{
                fontFamily: MONO, fontSize: 7, fontWeight: 700,
                color: QUALITY_COLOR[q], letterSpacing: 0.4,
                padding: '1px 5px',
                border: `1px solid ${QUALITY_COLOR[q]}44`,
                borderRadius: 2,
              }}>
                {counts[q]} {q}
              </span>
            )
          ))}
          {loading && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>LOADING…</span>}
        </div>
      </div>

      {/* ── Column headers ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: COL_GRID, gap: 0,
        padding: '3px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        {['ASSUMPTION', 'CURRENT VALUE', 'SOURCE', 'VALIDATION METHOD', 'QUALITY'].map((h, i) => (
          <span key={h} style={{
            fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 700,
            letterSpacing: 0.5, paddingRight: 8,
            textAlign: i === 4 ? 'center' : 'left',
          }}>{h}</span>
        ))}
      </div>

      {/* ── Grid body ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {groups.map((group, gi) => (
          <div key={group.label}>

            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px',
              background: `${BT.text.amber}08`,
              borderBottom: `1px solid ${BT.border.subtle}`,
              borderTop: gi > 0 ? `2px solid ${BT.border.subtle}` : undefined,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, opacity: 0.6, lineHeight: 1 }}>
                {group.icon}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.text.amber, letterSpacing: 1 }}>
                {group.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 4 }}>
                {group.rows.filter(r => r.quality === 'STRONG').length}S /
                {group.rows.filter(r => r.quality === 'WATCH').length}W /
                {group.rows.filter(r => r.quality === 'WEAK').length}K /
                {group.rows.filter(r => r.quality === 'UNVALIDATED').length}U
              </span>
            </div>

            {/* Rows */}
            {group.rows.map((row, ri) => (
              <div key={row.key} style={{
                display: 'grid', gridTemplateColumns: COL_GRID, gap: 0,
                padding: '5px 12px',
                background: ri % 2 === 0 ? BT.bg.panel : BT.bg.terminal,
                borderBottom: `1px solid ${BT.border.subtle}`,
                alignItems: 'start',
                borderLeft: row.quality === 'WEAK' ? `3px solid ${QUALITY_COLOR.WEAK}` : row.isOverride ? `3px solid ${BT.text.amber}44` : '3px solid transparent',
              }}>

                {/* ASSUMPTION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, fontWeight: 600 }}>
                      {row.assumption}
                    </span>
                    {row.isOverride && (
                      <span style={{
                        fontFamily: MONO, fontSize: 6, fontWeight: 700,
                        color: BT.text.amber, padding: '0 3px',
                        border: `1px solid ${BT.text.amber}55`, borderRadius: 2,
                      }}>OVR</span>
                    )}
                  </div>
                  {row.platformBaseline && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: '#00D26A', opacity: 0.8 }}>
                      {row.platformBaseline}
                    </span>
                  )}
                </div>

                {/* CURRENT VALUE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>
                    {row.value}
                  </span>
                  {row.detail && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                      {row.detail}
                    </span>
                  )}
                </div>

                {/* SOURCE */}
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  {row.source}
                </span>

                {/* VALIDATION METHOD */}
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                  {row.method}
                </span>

                {/* QUALITY */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                  <QualityIcon q={row.quality} />
                  <span style={{
                    fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.4,
                    color: QUALITY_COLOR[row.quality],
                    background: QUALITY_BG[row.quality],
                    padding: '1px 5px',
                    border: `1px solid ${QUALITY_COLOR[row.quality]}44`,
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                  }}>
                    {row.quality}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        flexShrink: 0, padding: '4px 12px',
        background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}`,
        display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 700 }}>LEGEND:</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#00D26A' }}>STRONG — comp or document validated</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>WATCH — platform benchmark or operator input</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#FF5252' }}>WEAK — outlier delta vs market</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>UNVALIDATED — no source data</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          OVR = operator override · Edit in DEAL TERMS / INPUTS / DEBT
        </span>
      </div>
    </div>
  );
}
