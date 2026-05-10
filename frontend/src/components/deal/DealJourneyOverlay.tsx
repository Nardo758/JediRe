// ============================================================================
// JEDI RE — DealJourneyOverlay.tsx
// ============================================================================
//
// Journey overlay surface — Phase 1 UI.
//
// Three sections:
//  1. State A → State B summary card — "the bet" in one frame
//  2. Path table — year-by-year trajectory
//  3. Levers panel — assumption set with evidence provenance + stance modulators
//
// PENDING slots show a "calibration in progress" chip rather than
// hiding the section — so the operator can see what's coming.
//
// Architecture:
//  - Receives a computed DealJourney (from useDealJourney selector)
//  - No own data fetching — parent passes the journey
//  - Bloomberg-style dark terminal aesthetic (BT tokens)
// ============================================================================

import React, { useState, useCallback } from 'react';
import { BT, MONO, Bd } from './bloomberg-ui';
import type { DealJourney, JourneyLevers } from '../../stores/dealJourney.types';
import type { FinancialContext } from '../../stores/dealContext.types';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmt$(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPp(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}pp`;
}

function fmtDelta(n: number, type: 'dollar' | 'pct' | 'pp'): string {
  const sign = n >= 0 ? '+' : '';
  if (type === 'dollar') return `${sign}${fmt$(n)}`;
  if (type === 'pct') return `${sign}${(n * 100).toFixed(1)}%`;
  return `${sign}${n.toFixed(1)}pp`;
}

function gapColor(n: number): string {
  if (n > 0) return BT.text.green;
  if (n < 0) return BT.text.red;
  return BT.text.muted;
}

// ---------------------------------------------------------------------------
// Calibration pending chip
// ---------------------------------------------------------------------------

function PendingChip({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontFamily: MONO, fontSize: 8, color: BT.text.muted,
      border: `1px solid ${BT.border.medium}`,
      borderRadius: 2, padding: '1px 5px', letterSpacing: 0.4,
    }}>
      ⊙ {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DQA badge
// ---------------------------------------------------------------------------

function DqaBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, fontWeight: 700,
      color: BT.text.amber, border: `1px solid ${BT.text.amber}`,
      borderRadius: 2, padding: '1px 5px', letterSpacing: 0.4,
    }}>
      {count} DQA
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '8px 14px 4px',
      borderBottom: `1px solid ${BT.border.subtle}`,
      background: BT.bg.header,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>
        {title}
      </span>
      {sub && (
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{sub}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricRow — A value | arrow | B value layout
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  aVal,
  bVal,
  delta,
  deltaColor,
  sub,
}: {
  label: string;
  aVal: string;
  bVal: string;
  delta: string;
  deltaColor: string;
  sub?: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 32px 1fr 80px',
      alignItems: 'center',
      padding: '5px 14px',
      borderBottom: `1px solid ${BT.border.subtle}`,
      gap: 8,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.4 }}>
        {label}
        {sub && <span style={{ color: BT.text.muted, opacity: 0.6, marginLeft: 4, fontSize: 8 }}>{sub}</span>}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: BT.text.primary }}>
        {aVal}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, textAlign: 'center' }}>
        →
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.amber }}>
        {bVal}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: deltaColor, textAlign: 'right' }}>
        {delta}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — State A → State B card
// ---------------------------------------------------------------------------

function StateBetCard({ journey }: { journey: DealJourney }) {
  const { stateA, stateB, gap } = journey;

  const dqaCount = stateA.dataQualityFindings;
  const strategyLabel = journey.strategyFrame.detectedStrategy
    ? journey.strategyFrame.detectedStrategy.replace(/_/g, ' ').toUpperCase()
    : 'UNSET';

  return (
    <div>
      <SectionHeader
        title="THE BET — STATE A → STATE B"
        sub={`Strategy: ${strategyLabel} · Hold: ${stateB.holdPeriodYears}yr · Stab: Y${stateB.yearOfStabilization}`}
      />

      {/* DQA alert banner */}
      {dqaCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 14px',
          background: '#F5A62310',
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <DqaBadge count={dqaCount} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
            {dqaCount} data quality finding{dqaCount !== 1 ? 's' : ''} on State A inputs — review before relying on this gap
          </span>
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr 32px 1fr 80px',
        padding: '3px 14px',
        gap: 8,
        background: BT.bg.panel,
      }}>
        {['METRIC', 'STATE A', '', 'STATE B', 'GAP'].map((h, i) => (
          <span key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6, textAlign: i === 4 ? 'right' : 'left' }}>
            {h}
          </span>
        ))}
      </div>

      <MetricRow
        label="NOI"
        aVal={fmt$(stateA.noi)}
        bVal={fmt$(stateB.targetNoi)}
        delta={fmtDelta(gap.noiUplift.absolute, 'dollar')}
        deltaColor={gapColor(gap.noiUplift.absolute)}
      />
      <MetricRow
        label="OCCUPANCY"
        aVal={fmtPct(stateA.occupancy)}
        bVal={fmtPct(stateB.targetOccupancy)}
        delta={fmtPp(gap.occupancyUplift.points)}
        deltaColor={gapColor(gap.occupancyUplift.points)}
      />
      <MetricRow
        label="RENT / UNIT"
        aVal={`$${stateA.inPlaceRentPerUnit.toFixed(0)}`}
        bVal={`$${stateB.targetRentPerUnit.toFixed(0)}`}
        delta={fmtDelta(gap.rentUplift.perUnit, 'dollar')}
        deltaColor={gapColor(gap.rentUplift.perUnit)}
        sub="(vs market)"
      />
      <MetricRow
        label="EXPENSE RATIO"
        aVal={fmtPct(stateA.expenseRatio)}
        bVal={fmtPct(stateB.targetExpenseRatio)}
        delta={fmtPp(gap.expenseRatioChange.points)}
        deltaColor={gapColor(-gap.expenseRatioChange.points)}
      />
      <MetricRow
        label="EXIT CAP RATE"
        aVal="—"
        bVal={fmtPct(stateB.exitCapRate)}
        delta="—"
        deltaColor={BT.text.muted}
      />
      {gap.capexRequired > 0 && (
        <MetricRow
          label="CAPEX REQUIRED"
          aVal="—"
          bVal={fmt$(gap.capexRequired)}
          delta="bridge cost"
          deltaColor={BT.text.orange}
        />
      )}

      {/* Source layers */}
      <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>SOURCE LAYERS:</span>
        {(['broker', 'rentRoll', 't12', 'taxBill'] as const).map(l => (
          stateA.sourceLayers[l] === 'present'
            ? <Bd key={l} c={BT.accent.doc}>{l.toUpperCase()}</Bd>
            : <Bd key={l} c={BT.border.medium}>{l.toUpperCase()}</Bd>
        ))}
        {stateA.propertyClass && (
          <Bd c={BT.text.muted}>CLASS {stateA.propertyClass.toUpperCase()}</Bd>
        )}
        {stateA.yearBuilt && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            BUILT {stateA.yearBuilt}
          </span>
        )}
      </div>

      {/* Aggressiveness PENDING slot */}
      <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>AGGRESSIVENESS:</span>
        <PendingChip label="M36 CALIBRATION IN PROGRESS" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Path table
// ---------------------------------------------------------------------------

function PathTable({ journey }: { journey: DealJourney }) {
  const years = journey.path.yearByYear;
  const hasConfidenceBands = years.some(y => y.confidenceBand != null);
  const stabilizationYear = journey.stateB.yearOfStabilization;

  const leaseUp = journey.path.leaseUpTimeline;
  const hasLeaseUp = leaseUp.weeksTo90 != null || leaseUp.weeksTo93 != null || leaseUp.weeksTo95 != null;

  return (
    <div>
      <SectionHeader
        title="PATH — YEAR-BY-YEAR TRAJECTORY"
        sub={hasConfidenceBands ? 'with confidence bands' : ''}
      />

      {/* Lease-up timeline */}
      {hasLeaseUp && (
        <div style={{
          padding: '5px 14px',
          background: BT.bg.panel,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>M07 LEASE-UP:</span>
          {leaseUp.weeksTo90 != null && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.occupancy }}>
              90%: <strong>{leaseUp.weeksTo90}w</strong>
            </span>
          )}
          {leaseUp.weeksTo93 != null && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.occupancy }}>
              93%: <strong>{leaseUp.weeksTo93}w</strong>
            </span>
          )}
          {leaseUp.weeksTo95 != null && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.occupancy }}>
              95%: <strong>{leaseUp.weeksTo95}w</strong>
            </span>
          )}
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 90px 80px 90px 70px 70px',
        padding: '3px 14px',
        gap: 8,
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        {['YR', 'NOI', 'OCC', 'RENT/UNIT', 'RENT GR', 'VAC'].map(h => (
          <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6 }}>{h}</span>
        ))}
      </div>

      {years.length === 0 ? (
        <div style={{ padding: '16px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          No projection data available — run Build Model to generate a path.
        </div>
      ) : years.map(y => (
        <div
          key={y.year}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 90px 80px 90px 70px 70px',
            padding: '4px 14px',
            gap: 8,
            borderBottom: `1px solid ${BT.border.subtle}`,
            background: y.year === stabilizationYear ? BT.bg.active : 'transparent',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 9, color: y.year === stabilizationYear ? BT.text.teal : BT.text.muted, fontWeight: y.year === stabilizationYear ? 700 : 400 }}>
            Y{y.year}{y.year === stabilizationYear ? '★' : ''}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{fmt$(y.noi)}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: y.occupancy >= 0.90 ? BT.text.green : BT.text.amber }}>
            {fmtPct(y.occupancy)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>${y.effRentPerUnit.toFixed(0)}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: y.rentGrowthPct >= 0 ? BT.text.green : BT.text.red }}>
            {fmtDelta(y.rentGrowthPct * 100, 'pp')}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            {fmtPct(y.vacancyPct)}
          </span>
        </div>
      ))}

      {/* Confidence bands PENDING slot */}
      {!hasConfidenceBands && (
        <div style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>CONFIDENCE BANDS:</span>
          <PendingChip label="M07 PERCENTILE OUTPUT PENDING" />
        </div>
      )}

      {/* M35 event path PENDING slot */}
      <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>EVENT-ADJUSTED PATH:</span>
        {journey.path.eventAdjustedTrajectory
          ? <Bd c={BT.met.quality}>M35 ACTIVE</Bd>
          : <PendingChip label="M35 EVENT INTEGRATION PENDING" />
        }
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Levers panel
// ---------------------------------------------------------------------------

type LeverKey = keyof FinancialContext['assumptions'];

const LEVER_CONFIG: Array<{
  key: LeverKey;
  label: string;
  fmt: (v: number) => string;
  goodDirection: 'high' | 'low' | 'neutral';
}> = [
  { key: 'rentGrowth', label: 'RENT GROWTH', fmt: (v) => fmtPct(v), goodDirection: 'high' },
  { key: 'expenseGrowth', label: 'EXPENSE GROWTH', fmt: (v) => fmtPct(v), goodDirection: 'low' },
  { key: 'vacancy', label: 'VACANCY', fmt: (v) => fmtPct(v), goodDirection: 'low' },
  { key: 'exitCapRate', label: 'EXIT CAP RATE', fmt: (v) => fmtPct(v), goodDirection: 'low' },
  { key: 'holdPeriod', label: 'HOLD PERIOD', fmt: (v) => `${v}yr`, goodDirection: 'neutral' },
  { key: 'capexPerUnit', label: 'CAPEX / UNIT', fmt: (v) => fmt$(v), goodDirection: 'low' },
  { key: 'managementFee', label: 'MGMT FEE', fmt: (v) => fmtPct(v), goodDirection: 'low' },
];

const EVIDENCE_COLORS: Record<string, string> = {
  M05: BT.text.cyan,
  M07: BT.met.occupancy,
  M04: BT.met.supply,
  M26: BT.text.purple,
  M37: BT.text.amber,
  platform_default: BT.text.muted,
};

function LeversPanel({ journey }: { journey: DealJourney }) {
  const { levers } = journey;
  const stance = levers.stanceModulators;

  return (
    <div>
      <SectionHeader
        title="LEVERS — ASSUMPTION SET"
        sub={stance ? `STANCE ACTIVE · ${stance.concessionStrategy} CONCESSIONS` : 'NO STANCE APPLIED'}
      />

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '160px 80px 60px 80px 80px',
        padding: '3px 14px',
        gap: 8,
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        {['LEVER', 'RESOLVED', 'LAYER', 'EVIDENCE', 'CONFIDENCE'].map(h => (
          <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6 }}>{h}</span>
        ))}
      </div>

      {LEVER_CONFIG.map(({ key, label, fmt }) => {
        const lv = levers[key as keyof typeof levers] as any;
        if (!lv || lv.value == null) return null;
        const evidence = levers.perLeverEvidence[key];
        const resolvedLayer = lv.resolvedFrom ?? lv.source ?? 'platform';
        const layerColor = resolvedLayer === 'user' ? BT.accent.user
          : resolvedLayer === 'broker' ? BT.accent.doc
          : BT.text.muted;
        const evidenceColor = evidence
          ? (EVIDENCE_COLORS[evidence.sourceModule] ?? BT.text.muted)
          : BT.text.muted;

        return (
          <div
            key={key}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 80px 60px 80px 80px',
              padding: '5px 14px',
              gap: 8,
              borderBottom: `1px solid ${BT.border.subtle}`,
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.4 }}>{label}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.amber }}>
              {fmt(lv.value)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: layerColor, textTransform: 'uppercase' }}>
              {resolvedLayer}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: evidenceColor }}>
              {evidence?.sourceModule ?? '—'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                flex: 1, height: 3, borderRadius: 1,
                background: BT.bg.terminal,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${((evidence?.sourceConfidence ?? 0.5) * 100).toFixed(0)}%`,
                  background: evidenceColor,
                  borderRadius: 1,
                }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, minWidth: 28 }}>
                {evidence ? `${((evidence.sourceConfidence) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
        );
      })}

      {/* OperatorStance modulators */}
      {stance && (
        <div style={{ padding: '8px 14px', borderTop: `1px solid ${BT.border.medium}` }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6, marginBottom: 4 }}>
            OPERATOR STANCE MODULATORS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {stance.stressRentGrowthHaircut !== 0 && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.orange }}>
                RENT HAIRCUT -{stance.stressRentGrowthHaircut}bps
              </span>
            )}
            {stance.stressExitCapWiden !== 0 && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.orange }}>
                EXIT CAP +{stance.stressExitCapWiden}bps
              </span>
            )}
            {stance.stressVacancyFloor !== 0 && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.orange }}>
                VAC FLOOR +{stance.stressVacancyFloor}pp
              </span>
            )}
            <Bd c={BT.met.occupancy}>{stance.concessionStrategy} CONCESSIONS</Bd>
            <Bd c={BT.text.cyan}>{stance.leasingCostTreatment}</Bd>
          </div>
        </div>
      )}

      {/* M38 calibration PENDING slot */}
      <div style={{ padding: '5px 14px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PATH RELIABILITY:</span>
        {journey.calibration
          ? (
            <>
              <Bd c={BT.text.green}>{(journey.calibration.pathPredictionReliability * 100).toFixed(0)}% RELIABLE</Bd>
              <Bd c={BT.text.muted}>{journey.calibration.driftStatus.toUpperCase()}</Bd>
            </>
          )
          : <PendingChip label="M38 CALIBRATION LEDGER PENDING" />
        }
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journey Score bar
// ---------------------------------------------------------------------------

function JourneyScoreBar({ journey }: { journey: DealJourney }) {
  const s = journey.scoreTrajectory;
  const verdict = journey.strategyFrame.verdict;
  const score = s.scoreAtA;
  const scoreColor = score >= 70 ? BT.text.green : score >= 50 ? BT.text.amber : BT.text.red;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '6px 14px',
      background: BT.bg.topBar,
      borderBottom: `1px solid ${BT.border.medium}`,
    }}>
      <div>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>JEDI SCORE</span>
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: scoreColor, marginLeft: 6 }}>
          {score.toFixed(0)}
        </span>
      </div>
      <div style={{ width: 1, height: 20, background: BT.border.medium }} />
      <div>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>SCORE AT B</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginLeft: 6 }}>
          {s.scoreAtB != null ? s.scoreAtB.toFixed(0) : '—'}
        </span>
        {s.scoreAtB == null && <PendingChip label="M25 EXTENSION" />}
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, fontStyle: 'italic' }}>
        {verdict}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface DealJourneyOverlayProps {
  journey: DealJourney;
  onClose: () => void;
}

export function DealJourneyOverlay({ journey, onClose }: DealJourneyOverlayProps) {
  const [activeSection, setActiveSection] = useState<0 | 1 | 2>(0);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const tabs = ['THE BET', 'PATH', 'LEVERS'];

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(5,8,16,0.82)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 56,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 780,
          background: BT.bg.terminal,
          border: `1px solid ${BT.border.bright}`,
          borderTop: `2px solid ${BT.met.financial}`,
          borderRadius: 2,
          display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 80px)',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 14px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.medium}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>
            DEAL JOURNEY
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            A → B FRAMEWORK · PHASE 1
          </span>
          <div style={{ flex: 1 }} />

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {tabs.map((t, i) => (
              <button
                key={t}
                onClick={() => setActiveSection(i as 0 | 1 | 2)}
                style={{
                  background: activeSection === i ? BT.bg.active : 'transparent',
                  border: `1px solid ${activeSection === i ? BT.border.bright : BT.border.subtle}`,
                  color: activeSection === i ? BT.text.white : BT.text.muted,
                  fontFamily: MONO, fontSize: 9, fontWeight: activeSection === i ? 700 : 400,
                  padding: '2px 10px', cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 14, background: BT.border.medium, marginLeft: 4 }} />

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: BT.text.muted,
              fontFamily: MONO, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Score bar — always visible */}
        <JourneyScoreBar journey={journey} />

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {activeSection === 0 && <StateBetCard journey={journey} />}
          {activeSection === 1 && <PathTable journey={journey} />}
          {activeSection === 2 && <LeversPanel journey={journey} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '4px 14px',
          background: BT.bg.topBar,
          borderTop: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.4 }}>
            DEAL JOURNEY FRAMEWORK v1.0 · Phase 1 — LOCKED slots only
          </span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.border.medium }}>·</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            Pending: M36 aggressiveness · M07 confidence bands · M35 event path · M38 calibration
          </span>
        </div>
      </div>
    </div>
  );
}
