/**
 * F9 Financial Engine — F8 DECISION TAB
 *
 * PURPOSE: Risk verdict and recommended actions derived from underwriting
 * assumptions vs M07 platform calibration. Surfaces integrity-check failures,
 * benchmark divergences (rent growth, exit cap, vacancy, LTV), and a
 * financial risk signal (DEAL SIGNAL) based on JEDI Score (primary) or
 * IRR / DSCR / equity multiple integrity checks (fallback). See ADR-004.
 *
 * MARKET CONTEXT ARCHITECTURE NOTE (T-CONF-2 investigation):
 * This tab intentionally does NOT render a market context or market signal
 * section sourced from `deal_market_intelligence`. Investigation confirmed no
 * such section exists here or in OverviewTab (F1) — the described dual-surface
 * was a false alarm; neither tab fetches, receives via props, or conditionally
 * renders `deal_market_intelligence` data.
 *
 * Risk flags in this tab are derived from f9Financials (M07 calibrated
 * assumptions + proforma integrity checks), NOT from raw deal_market_intelligence
 * rows. This distinction must be preserved: if market signals are ever needed
 * here, they should be pre-composed into f9Financials by the backend engine
 * rather than fetched separately, avoiding duplicate API calls and parse logic.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { ConcessionDrilldownModal, aggregateConcessionDetail } from './ConcessionDrilldownModal';
import type { AggregatedConcessionDetail } from './ConcessionDrilldownModal';
import { usePeriodicField } from '../../../hooks/usePeriodicField';
import { fmtPeriodicValue } from '../../../components/periodic/fieldLabels';

const MONO = BT.font.mono;

// ─── ADR-004: Authoritative-Signal Fallback constants ────────────────────────
// Score band thresholds — adjust here only; do not hardcode values in logic.
const JEDI_SCORE_FAVORABLE_THRESHOLD = 80;
const JEDI_SCORE_NEUTRAL_THRESHOLD = 60;
const JEDI_SCORE_STALE_DAYS = 30;

interface RiskFlag {
  severity: 'high' | 'medium' | 'low';
  label: string;
  detail: string;
}

function deriveRiskFlags(
  assumptions: FinancialEngineTabProps['assumptions'],
  results: FinancialEngineTabProps['modelResults'],
  periodicRentGrowth?: number | null,
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const s = results?.summary;
  const a = assumptions;

  if (s?.irr != null && s.irr < 12) flags.push({ severity: 'high', label: 'LOW IRR', detail: `IRR of ${fmtPct(s.irr)} is below the 12% institutional threshold` });
  if (s?.dscr != null && s.dscr < 1.25) flags.push({ severity: 'high', label: 'TIGHT DSCR', detail: `DSCR of ${s.dscr.toFixed(2)}× is below the 1.25× minimum for most lenders` });
  if (a?.revenue?.stabilizedOccupancy != null && a.revenue.stabilizedOccupancy < 0.90) flags.push({ severity: 'medium', label: 'LOW OCCUPANCY', detail: `Stabilized occupancy of ${fmtPct(a.revenue.stabilizedOccupancy * 100)} is aggressive` });
  if (a?.disposition?.exitCapRate != null && a.disposition.exitCapRate < 0.045) flags.push({ severity: 'medium', label: 'AGGRESSIVE EXIT CAP', detail: `Exit cap of ${fmtPct(a.disposition.exitCapRate * 100)} assumes significant cap rate compression` });
  // Phase 5: prefer periodic-derived rent growth over assumptions flatten
  const rentGrowth = periodicRentGrowth ?? a?.revenue?.rentGrowth?.[0] ?? null;
  if (rentGrowth != null && rentGrowth > 0.04) flags.push({ severity: 'low', label: 'HIGH RENT GROWTH', detail: `Year 1 rent growth of ${fmtPct(rentGrowth * 100)} exceeds typical market growth` });
  if (s?.equityMultiple != null && s.equityMultiple < 1.5) flags.push({ severity: 'medium', label: 'LOW EM', detail: `Equity multiple of ${fmtX(s.equityMultiple)} may not meet LP return expectations` });

  if (flags.length === 0) flags.push({ severity: 'low', label: 'NO FLAGS', detail: 'No risk flags identified — model assumptions appear within normal ranges' });

  return flags;
}

const SEVERITY_COLORS = {
  high: BT.text.red,
  medium: BT.text.amber,
  low: BT.met.financial,
};

// ─── Verdict derivation from JEDI score band ─────────────────────────────────
function scoreToVerdict(score: number): 'FAVORABLE' | 'PROCEED WITH REVIEW' | 'CAUTION' {
  if (score > JEDI_SCORE_FAVORABLE_THRESHOLD) return 'FAVORABLE';
  if (score >= JEDI_SCORE_NEUTRAL_THRESHOLD) return 'PROCEED WITH REVIEW';
  return 'CAUTION';
}

// ─── Provenance path types ────────────────────────────────────────────────────
type VerdictPath =
  | { type: 'jedi'; scoreDate: string }
  | { type: 'integrity' }
  | { type: 'conflict'; scoreDate: string };

function provenanceLabel(path: VerdictPath): string {
  if (path.type === 'jedi') return `DERIVED FROM JEDI SCORE · ${path.scoreDate}`;
  if (path.type === 'conflict') return `JEDI SCORE + INTEGRITY FLAGS · CONFLICT · ${path.scoreDate}`;
  return 'DERIVED FROM INTEGRITY CHECKS · LIVE';
}

export function DecisionTab({ dealId, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const summary = modelResults?.summary;

  // Phase 5: derive Y1 rent growth from periodic GPR series (replaces assumptions[0] flatten)
  const { series: gprSeries } = usePeriodicField({ dealId, field: 'gpr', preferZone: 'projection' });
  const periodicRentGrowth = useMemo(() => {
    const proj = gprSeries.filter(p => p.zone === 'projection' && p.resolved != null && p.resolved !== 0);
    if (proj.length < 2) return null;
    // Approximate annual growth from first two projection months
    const monthly = (proj[1].resolved! - proj[0].resolved!) / proj[0].resolved!;
    return monthly * 12;
  }, [gprSeries]);

  // ─── JEDI Score fetch (ADR-004 primary path) ─────────────────────────────
  const [jediScore, setJediScore] = useState<{ totalScore: number; createdAt: string } | null>(null);
  const [jediLoading, setJediLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setJediLoading(false); return; }
    setJediLoading(true);
    apiClient.get(`/api/v1/jedi/score/${dealId}`)
      .then((res: any) => {
        const score = res?.data?.score ?? res?.score ?? null;
        if (score?.totalScore != null) {
          setJediScore({ totalScore: score.totalScore, createdAt: score.createdAt ?? score.created_at ?? '' });
        } else {
          setJediScore(null);
        }
      })
      .catch(() => setJediScore(null))
      .finally(() => setJediLoading(false));
  }, [dealId]);

  const [conDrill, setConDrill] = useState<{
    open: boolean;
    periodLabel: string;
    recognizedAmount: number | null;
    earnedAmount: number | null;
    detail: AggregatedConcessionDetail | null;
    source: 'earned' | 'recognized';
    calendarYearTotal: number | null;
    fiscalYearTotal: number | null;
  }>({ open: false, periodLabel: '', recognizedAmount: null, earnedAmount: null, detail: null, source: 'recognized', calendarYearTotal: null, fiscalYearTotal: null });

  const openConDrill = useCallback(() => {
    const rec = f9Financials?.concessionRecognition;
    if (!rec) return;
    const currentYear = new Date().getFullYear();
    const yyyymms = Array.from({ length: 12 }, (_, i) => `${currentYear}${String(i + 1).padStart(2, '0')}`);
    const recognized = rec.by_calendar_year?.[String(currentYear)] ?? null;
    // CF-15: was proforma.year1.find(r => r.field === 'concessions')?.resolved — Rule 3 anti-pattern.
    // year1Concessions is the treatment-adjusted earned amount exposed as a direct property.
    const earned = f9Financials?.year1Concessions ?? null;
    const calYr = rec.by_calendar_year?.[String(currentYear)] ?? null;
    const fisYr = rec.by_fiscal_year?.[String(currentYear)] ?? null;
    setConDrill({
      open: true,
      periodLabel: `${currentYear} CONCESSIONS`,
      recognizedAmount: recognized,
      earnedAmount: earned,
      detail: aggregateConcessionDetail(rec.monthly_detail, yyyymms),
      source: 'recognized',
      calendarYearTotal: calYr,
      fiscalYearTotal: fisYr,
    });
  }, [f9Financials]);

  // F10 wiring: benchmark-based risk flags from financials.assumptions vs M07 platform signals
  const f9Flags: RiskFlag[] = [];
  if (f9Financials) {
    const ass = f9Financials.assumptions;
    const tp  = f9Financials.trafficProjection;
    const cs  = f9Financials.capitalStack;

    // Integrity check failures → high/medium flags
    for (const c of f9Financials.proforma.integrityChecks) {
      if (c.status === 'ok') continue;
      f9Flags.push({
        severity: c.status === 'error' ? 'high' : 'medium',
        label: `INTEGRITY: ${c.id.toUpperCase().replace(/_/g, ' ')}`,
        detail: c.message,
      });
    }

    // Rent growth divergence vs M07 platform calibration (benchmark comparison)
    if (ass.rentGrowthYr1 != null && tp?.calibrated.rentGrowthPct != null) {
      const delta = ass.rentGrowthYr1 - tp.calibrated.rentGrowthPct;
      if (Math.abs(delta) > 0.01) {
        f9Flags.push({
          severity: delta > 0.02 ? 'high' : 'medium',
          label: 'RENT GROWTH BENCHMARK DIVERGENCE',
          detail: `Assumed Yr-1 rent growth (${fmtPct(ass.rentGrowthYr1 * 100)}) diverges ${delta > 0 ? '+' : ''}${fmtPct(delta * 100)} from M07 platform calibration (${fmtPct(tp.calibrated.rentGrowthPct * 100)})`,
        });
      }
    }

    // Exit cap divergence vs M07 platform calibration
    if (ass.exitCap != null && tp?.calibrated.exitCap != null) {
      const delta = ass.exitCap - tp.calibrated.exitCap;
      if (Math.abs(delta) > 0.005) {
        f9Flags.push({
          severity: delta < -0.01 ? 'high' : 'medium',
          label: 'EXIT CAP BENCHMARK DIVERGENCE',
          detail: `Assumed exit cap (${fmtPct(ass.exitCap * 100)}) is ${delta > 0 ? '+' : ''}${fmtPct(delta * 100)} vs M07 calibration (${fmtPct(tp.calibrated.exitCap * 100)})${delta < 0 ? ' — aggressive compression assumed' : ''}`,
        });
      }
    }

    // Leverage risk: LTV > 75%
    if (cs.ltcPct != null && cs.ltcPct > 0.75) {
      f9Flags.push({
        severity: cs.ltcPct > 0.80 ? 'high' : 'medium',
        label: 'HIGH LEVERAGE',
        detail: `LTC of ${fmtPct(cs.ltcPct * 100)} exceeds the ${cs.ltcPct > 0.80 ? '80%' : '75%'} institutional threshold — refinancing risk elevated`,
      });
    }

    // Vacancy assumption vs M07 platform vacancy
    const assumedVac = ass.perYear[0]?.vacancyPct;
    const platformVac = tp?.calibrated.vacancyPct;
    if (assumedVac != null && platformVac != null && Math.abs(assumedVac - platformVac) > 0.03) {
      const delta = assumedVac - platformVac;
      f9Flags.push({
        severity: 'medium',
        label: 'VACANCY ASSUMPTION DIVERGENCE',
        detail: `Yr-1 assumed vacancy (${fmtPct(assumedVac * 100)}) differs ${delta > 0 ? '+' : ''}${fmtPct(delta * 100)} from M07 platform estimate (${fmtPct(platformVac * 100)})`,
      });
    }

    // Benchmark position flags: scan proforma.year1 rows for above/below submarket benchmarks.
    const BENCH_KEY_ROWS: Record<string, string> = {
      gpr: 'GROSS POTENTIAL RENT',
      noi: 'NET OPERATING INCOME',
      egi: 'EFFECTIVE GROSS INCOME',
      vacancy_pct: 'VACANCY RATE',
    };
    for (const row of f9Financials.proforma.year1) {
      const label = BENCH_KEY_ROWS[row.field];
      if (!label || row.benchmarkPosition == null || row.benchmarkPosition === 'within') continue;
      const dir = row.benchmarkPosition === 'above' ? 'ABOVE' : 'BELOW';
      const platform = row.platform;
      const resolved = row.resolved;
      const divergencePct = (platform != null && platform !== 0 && resolved != null)
        ? Math.abs((resolved - platform) / platform) * 100 : null;
      f9Flags.push({
        severity: row.benchmarkPosition === 'above' && row.field === 'vacancy_pct' ? 'medium'
          : row.benchmarkPosition === 'below' && (row.field === 'noi' || row.field === 'egi') ? 'medium'
          : 'low',
        label: `${label} ${dir} BENCHMARK`,
        detail: `Resolved ${label.toLowerCase()} is ${dir.toLowerCase()} the M07 submarket benchmark${divergencePct != null ? ` by ${divergencePct.toFixed(1)}%` : ''}` +
          (platform != null ? ` (platform: ${row.field.includes('pct') ? fmtPct(platform * 100) : fmt$(platform)})` : ''),
      });
    }
  }

  const baseFlags = deriveRiskFlags(assumptions, modelResults, periodicRentGrowth);
  const flags = [
    ...f9Flags,
    ...baseFlags.filter(f => f.label !== 'NO FLAGS' || f9Flags.length === 0),
  ];
  const highFlags = flags.filter(f => f.severity === 'high');
  const medFlags = flags.filter(f => f.severity === 'medium');

  // ─── ADR-004: Authoritative-Signal Fallback verdict computation ───────────
  // Primary path: JEDI Score when present and ≤ JEDI_SCORE_STALE_DAYS old.
  // Fallback path: integrity flag derivation (existing deriveRiskFlags + f9Flags).
  // Conflict path: score says FAVORABLE but high-severity integrity flags present.
  let verdict: string;
  let verdictColor: string;
  let verdictPath: VerdictPath;

  const isJediPresent = !jediLoading && jediScore != null;
  const isJediFresh = isJediPresent && (() => {
    if (!jediScore!.createdAt) return false;
    const scoreAge = (Date.now() - new Date(jediScore!.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return scoreAge <= JEDI_SCORE_STALE_DAYS;
  })();

  if (isJediFresh) {
    const scoreVerdict = scoreToVerdict(jediScore!.totalScore);
    const scoreDate = new Date(jediScore!.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

    const hasConflict = scoreVerdict === 'FAVORABLE' && highFlags.length > 0;

    if (hasConflict) {
      verdict = 'CONFLICT';
      verdictColor = BT.text.amber;
      verdictPath = { type: 'conflict', scoreDate };
    } else {
      verdict = scoreVerdict;
      verdictColor = scoreVerdict === 'FAVORABLE' ? BT.met.financial
        : scoreVerdict === 'PROCEED WITH REVIEW' ? BT.text.amber
        : BT.text.red;
      verdictPath = { type: 'jedi', scoreDate };
    }
  } else {
    verdict = highFlags.length > 0 ? 'CAUTION' : medFlags.length > 0 ? 'PROCEED WITH REVIEW' : 'FAVORABLE';
    verdictColor = highFlags.length > 0 ? BT.text.red : medFlags.length > 0 ? BT.text.amber : BT.met.financial;
    verdictPath = { type: 'integrity' };
  }

  const provenance = provenanceLabel(verdictPath);

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>RISK FLAGS · INTEGRITY CHECKS · RECOMMENDED ACTIONS</span>
        <Bd c={verdictColor}>{verdict}</Bd>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.3 }}>{provenance}</span>
      </div>

      <SectionPanel title="DEAL SIGNAL" subtitle="Financial risk and operational feasibility signal" borderColor={verdictColor}>
        <div style={{ padding: '8px 10px', fontFamily: MONO, fontSize: 10, color: BT.text.primary, lineHeight: 1.6 }}>
          {verdictPath.type === 'conflict' && (
            <div style={{ marginBottom: 8, padding: '6px 8px', borderLeft: `3px solid ${BT.text.amber}`, background: `${BT.text.amber}11` }}>
              <span style={{ color: BT.text.amber, fontWeight: 700 }}>SIGNAL CONFLICT:</span>
              {' '}JEDI Score ({jediScore!.totalScore.toFixed(0)}/100) indicates favorable conditions, but high-severity integrity flags are present. Both inputs shown below — review flags before proceeding.
            </div>
          )}
          {verdictPath.type === 'jedi' && jediScore && (
            <div style={{ marginBottom: 8 }}>
              JEDI Score of{' '}
              <span style={{ color: verdictColor, fontWeight: 700 }}>{jediScore.totalScore.toFixed(0)}/100</span>
              {' '}places this deal in the{' '}
              <span style={{ color: verdictColor, fontWeight: 700 }}>{verdict}</span>{' '}band.
            </div>
          )}
          {summary ? (
            <>
              <div style={{ marginBottom: 8 }}>
                Financial model shows a{' '}
                <span style={{ color: BT.met.financial, fontWeight: 700 }}>{summary.irr != null ? fmtPct(summary.irr) : '—'} IRR</span>{' '}
                with a{' '}
                <span style={{ color: BT.text.amber, fontWeight: 700 }}>{summary.equityMultiple != null ? fmtX(summary.equityMultiple) : '—'} equity multiple</span>{' '}
                over the projected hold period.
              </div>
              <div>
                DSCR coverage is{' '}
                <span style={{ color: summary.dscr != null && summary.dscr >= 1.25 ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
                  {summary.dscr != null ? `${summary.dscr.toFixed(2)}×` : '—'}
                </span>
                {summary.dscr != null && summary.dscr >= 1.25 ? ', meeting lender requirements.' : ', which may be tight for most lenders.'}
              </div>
            </>
          ) : (
            <span style={{ color: BT.text.muted }}>Build the financial model to generate deal analysis. JEDI Score provides market-level signal; integrity checks require a built model.</span>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="RISK FLAGS" subtitle={`${flags.length} flag${flags.length !== 1 ? 's' : ''} identified`} borderColor={BT.text.amber}>
        {flags.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px',
            borderBottom: i < flags.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
            borderLeft: `3px solid ${SEVERITY_COLORS[f.severity]}`,
          }}>
            <Bd c={SEVERITY_COLORS[f.severity]}>{f.severity.toUpperCase()}</Bd>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, fontWeight: 600 }}>{f.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginTop: 2 }}>{f.detail}</div>
            </div>
          </div>
        ))}
      </SectionPanel>

      <SectionPanel title="RECOMMENDED ACTIONS" subtitle="Suggested next steps" borderColor={BT.met.financial}>
        {[
          { action: 'Run sensitivity analysis on exit cap rate', priority: 'HIGH', color: BT.text.red },
          { action: 'Validate rent growth assumptions against market comps', priority: 'HIGH', color: BT.text.red },
          { action: 'Compare debt scenarios to optimize DSCR', priority: 'MEDIUM', color: BT.text.amber },
          { action: 'Review CapEx budget against property inspection', priority: 'MEDIUM', color: BT.text.amber },
          { action: 'Stress test occupancy at -5% from stabilized', priority: 'LOW', color: BT.met.financial },
        ].map((a, i) => (
          <DataRow key={i} label={a.action} value={<Bd c={a.color}>{a.priority}</Bd>} valueColor={a.color} border={i < 4} />
        ))}
      </SectionPanel>

      {f9Financials?.concessionRecognition && (
        <SectionPanel title="DEAL NOTES" subtitle="Supplemental model annotations" borderColor={BT.text.muted}>
          <div style={{ padding: '6px 10px', fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.7 }}>
            Concession recognition (straight-line, §14) totals{' '}
            {f9Financials.concessionRecognition.by_calendar_year?.[String(new Date().getFullYear())] != null
              ? <span style={{ color: BT.text.amber, fontWeight: 600 }}>
                  ${Math.abs(f9Financials.concessionRecognition.by_calendar_year[String(new Date().getFullYear())]).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              : <span style={{ color: BT.text.muted }}>—</span>
            }{' '}
            recognized in {new Date().getFullYear()}.{' '}
            <button
              onClick={openConDrill}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: BT.text.cyan, fontFamily: MONO, fontSize: 9,
                cursor: 'pointer', textDecoration: 'underline',
              }}
              title="Open concession amortization drilldown"
            >
              View amortization breakdown ↗
            </button>
          </div>
        </SectionPanel>
      )}
    </div>

    <ConcessionDrilldownModal
      open={conDrill.open}
      onClose={() => setConDrill(p => ({ ...p, open: false }))}
      periodLabel={conDrill.periodLabel}
      recognizedAmount={conDrill.recognizedAmount}
      earnedAmount={conDrill.earnedAmount}
      detail={conDrill.detail}
      source={conDrill.source}
      calendarYearTotal={conDrill.calendarYearTotal}
      fiscalYearTotal={conDrill.fiscalYearTotal}
    />
  </>
  );
}

export default DecisionTab;
