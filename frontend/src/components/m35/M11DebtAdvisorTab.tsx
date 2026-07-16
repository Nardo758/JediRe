import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Zap,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  BarChart2,
  ArrowRight,
  Clock,
  Target,
} from 'lucide-react';
import {
  useDebtAdvisor,
  DebtPhase,
  DebtAlternative,
  MonitoringTrigger,
  RateEnvironmentResult,
} from '../../../hooks/useDebtAdvisor';
import { BT } from '../../../components/deal/bloomberg-ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface M11DebtAdvisorTabProps {
  dealId: string;
}

interface ExitWindow {
  month: number;
  label: string;
  source: 'curve_trough' | 'm35_event' | 'm35_rate_move';
  projectedRate: number;
  currentRate: number;
  rateImprovementBps: number;
  dscrImprovement: number | null;
  refiCostPct: number;
  netBenefitBps: number;
  isActionable: boolean;
  confidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: BT.font.mono };

function fmt$M(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 2): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtBps(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}bps`;
}

function sourceColor(source: ExitWindow['source']): string {
  switch (source) {
    case 'curve_trough':
      return BT.text.cyan;
    case 'm35_rate_move':
      return BT.text.purple;
    case 'm35_event':
      return BT.text.teal;
    default:
      return BT.text.muted;
  }
}

function sourceLabel(source: ExitWindow['source']): string {
  switch (source) {
    case 'curve_trough':
      return 'CURVE';
    case 'm35_rate_move':
      return 'M35 RATE';
    case 'm35_event':
      return 'M35 EVENT';
    default:
      return 'UNKNOWN';
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Pill({ children, color = BT.text.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        ...MONO,
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 2,
        padding: '1px 6px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ label, accent = BT.text.cyan }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, backgroundColor: accent, borderRadius: 1 }} />
      <span style={{ ...MONO, color: BT.text.muted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>
        {label}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
      <RefreshCw size={20} color={BT.text.cyan} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ ...MONO, color: BT.text.muted, fontSize: 11 }}>COMPUTING DEBT PLAN…</span>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
      <AlertTriangle size={20} color={BT.text.red} />
      <span style={{ color: BT.text.muted, fontSize: 12 }}>{error}</span>
      <button
        onClick={onRetry}
        style={{
          ...MONO,
          fontSize: 10,
          padding: '5px 14px',
          backgroundColor: `${BT.text.cyan}15`,
          color: BT.text.cyan,
          border: `1px solid ${BT.text.cyan}40`,
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

function NoStrategyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 14, padding: 32 }}>
      <BarChart2 size={28} color={BT.text.muted} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...MONO, color: BT.text.primary, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          No Strategy Detected
        </div>
        <div style={{ color: BT.text.muted, fontSize: 11, maxWidth: 360, lineHeight: 1.6 }}>
          Run M08 Strategy Analysis first. The Debt Advisor reads your strategy output to determine
          the optimal debt structure for this deal.
        </div>
      </div>
      <div
        style={{
          ...MONO,
          backgroundColor: `${BT.text.amber}10`,
          border: `1px solid ${BT.text.amber}30`,
          borderRadius: 2,
          padding: '8px 16px',
          color: BT.text.amber,
          fontSize: 10,
        }}
      >
        GO TO STRATEGY TAB → RUN ANALYSIS → RETURN HERE
      </div>
    </div>
  );
}

function StrategyOrigin({ phase, strategyName }: { phase: DebtPhase; strategyName: string }) {
  return (
    <div style={{ backgroundColor: `${BT.text.cyan}08`, border: `1px solid ${BT.text.cyan}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={13} color={BT.text.cyan} />
        <div style={{ flex: 1 }}>
          <div style={{ ...MONO, color: BT.text.muted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>
            DEBT STRUCTURE DRIVEN BY M08 STRATEGY DETECTION · {strategyName.toUpperCase()}
          </div>
          <div style={{ color: BT.text.muted, fontSize: 10, lineHeight: 1.5 }}>
            <span style={{ ...MONO, color: BT.text.primary, fontWeight: 700 }}>{phase.productLabel.toUpperCase()}</span>
            <span style={{ ...MONO, color: BT.text.muted }}> → {phase.rationale}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DSCRTimeline({ phases }: { phases: DebtPhase[] }) {
  const refiPhase = phases.find((p) => p.isRefiEvent);
  const holdMonths = Math.max(...phases.map((p) => p.endMonth), 36);

  // Build year columns from phase data
  const years = Math.ceil(holdMonths / 12);
  const cols = Array.from({ length: years }, (_, i) => {
    const yr = i + 1;
    const phase = phases.find((p) => p.startMonth <= i * 12 && p.endMonth >= i * 12);
    const isRefi = refiPhase && refiPhase.startMonth >= i * 12 && refiPhase.startMonth < (i + 1) * 12;
    const dscr = phase?.dscrAtClose ?? (phase?.rateEst ? 1.2 : 0.91);
    return {
      yr: `Y${yr}`,
      dscr: dscr,
      noi: '$1.64M', // Would come from proforma in full implementation
      occ: '89.1%',
      capture: '$334K',
      status: isRefi ? 'REFI TRIGGER' : phase?.isRefiEvent ? 'Stabilized' : 'IO · pre-stab',
      color: isRefi ? BT.text.green : dscr < 1.15 ? BT.text.red : dscr < 1.35 ? BT.text.amber : BT.text.green,
      flag: isRefi,
    };
  });

  return (
    <div style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: 14, marginBottom: 14, backgroundColor: BT.bg.panelAlt }}>
      <SectionLabel label="DSCR RECOVERY — POWERED BY M08 CAPTURE SCHEDULE" />
      <div style={{ display: 'flex', gap: 0 }}>
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRight: i < cols.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
              padding: '0 12px',
              borderLeft: c.flag ? `2px solid ${BT.text.green}` : 'none',
            }}
          >
            {c.flag && (
              <div style={{ ...MONO, color: BT.text.green, fontSize: 8, marginBottom: 2 }}>◀ REFI HERE</div>
            )}
            <div style={{ ...MONO, color: c.color, fontSize: 18, fontWeight: 700 }}>{c.dscr.toFixed(2)}×</div>
            <div style={{ ...MONO, color: BT.text.primary, fontSize: 11, fontWeight: 700 }}>{c.yr}</div>
            <div style={{ color: BT.text.muted, fontSize: 9, marginTop: 3 }}>NOI {c.noi}</div>
            <div style={{ color: BT.text.muted, fontSize: 9 }}>Occ {c.occ}</div>
            <div style={{ color: BT.text.cyan, fontSize: 9 }}>Cap {c.capture}</div>
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  ...MONO,
                  fontSize: 8,
                  color: c.color,
                  backgroundColor: `${c.color}15`,
                  border: `1px solid ${c.color}30`,
                  borderRadius: 2,
                  padding: '1px 4px',
                }}
              >
                {c.status}
              </span>
            </div>
            <div style={{ marginTop: 8, height: 36, display: 'flex', alignItems: 'flex-end' }}>
              <div
                style={{
                  width: '70%',
                  height: `${Math.min((c.dscr / 2) * 100, 100)}%`,
                  backgroundColor: `${c.color}35`,
                  border: `1px solid ${c.color}50`,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {refiPhase && (
        <div style={{ borderTop: `1px solid ${BT.border.subtle}`, marginTop: 10, paddingTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <CheckCircle size={11} color={BT.text.green} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ color: BT.text.muted, fontSize: 10 }}>
            Refi trigger:{" "}
            <span style={{ ...MONO, color: BT.text.green }}>
              DSCR &gt; {refiPhase.refiTriggerDscr?.toFixed(2) ?? '1.35'} AND Occ &gt;{' '}
              {(refiPhase.refiTriggerOcc ?? 0.92) * 100}%
            </span>{' '}
            — executes at M{refiPhase.startMonth}
          </span>
        </div>
      )}
    </div>
  );
}

function DebtTimeline({
  phases,
  expandedPhase,
  setExpandedPhase,
}: {
  phases: DebtPhase[];
  expandedPhase: number | null;
  setExpandedPhase: (v: number | null) => void;
}) {
  const maxMonth = Math.max(...phases.map((p) => p.endMonth), 36);
  const pct = (m: number) => `${(m / maxMonth) * 100}%`;
  const phaseColors = [BT.text.orange, BT.text.cyan, BT.text.purple, BT.text.green, BT.text.amber];
  const refiPhase = phases.find((p) => p.isRefiEvent);

  return (
    <div style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: 14, marginBottom: 14, backgroundColor: BT.bg.panelAlt }}>
      <SectionLabel label="DEBT PLAN TIMELINE" accent={BT.text.amber} />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {Array.from({ length: 7 }, (_, i) => Math.round((maxMonth / 6) * i)).map((m) => (
            <span key={m} style={{ ...MONO, color: BT.text.muted, fontSize: 9 }}>
              M{m}
            </span>
          ))}
        </div>
        {refiPhase && (
          <div
            style={{
              position: 'absolute',
              left: pct(refiPhase.startMonth),
              top: 24,
              height: 34,
              width: 1,
              backgroundColor: `${BT.text.green}70`,
            }}
          >
            <span
              style={{
                ...MONO,
                fontSize: 8,
                color: BT.text.green,
                position: 'absolute',
                top: '100%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              REFI TRIGGER M{refiPhase.startMonth}
            </span>
          </div>
        )}
        <div style={{ position: 'relative', height: 34 }}>
          {phases.map((p, i) => {
            const color = phaseColors[i % phaseColors.length];
            const isExpanded = expandedPhase === i;
            return (
              <div
                key={p.phaseIndex}
                onClick={() => setExpandedPhase(isExpanded ? null : i)}
                style={{
                  position: 'absolute',
                  left: pct(p.startMonth),
                  width: `calc(${pct(p.endMonth - p.startMonth)} - 2px)`,
                  top: 0,
                  height: 28,
                  backgroundColor: `${color}20`,
                  border: `1px solid ${color}60`,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span style={{ ...MONO, color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.phaseLabel.split('—')[0].trim()}
                </span>
                <span style={{ color: BT.text.muted, fontSize: 9 }}>· {fmt$M(p.loanAmountEst)}</span>
                {isExpanded ? (
                  <ChevronDown size={10} color={color} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                ) : (
                  <ChevronRight size={10} color={BT.text.muted} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseDetail({ phase, index }: { phase: DebtPhase; index: number }) {
  const phaseColors = [BT.text.orange, BT.text.cyan, BT.text.purple, BT.text.green, BT.text.amber];
  const color = phaseColors[index % phaseColors.length];

  const sizingRows: [string, string][] = [
    ['Loan Amount', fmt$M(phase.loanAmountEst)],
    ['LTV', fmtPct(phase.ltv)],
    ['Rate', phase.rateType === 'Floating' && phase.spreadBps ? `SOFR + ${phase.spreadBps}bps` : fmtPct(phase.rateEst)],
    ['All-in Est', fmtPct(phase.rateEst)],
  ];
  if (phase.dscrAtClose != null) sizingRows.push(['DSCR at Close', phase.dscrAtClose.toFixed(2) + '×']);
  if (phase.debtYieldAtClose != null) sizingRows.push(['Debt Yield', fmtPct(phase.debtYieldAtClose)]);

  const structureRows: [string, string][] = [
    ['Term', `${phase.termYears}yr`],
    ['IO Period', phase.ioMonths > 0 ? `${phase.ioMonths}mo` : 'None'],
    ['Amortization', phase.amortYears > 0 ? `${phase.amortYears}yr` : 'Full IO'],
    ['Prepay', phase.prepayType],
  ];

  const feeRows: [string, string][] = [
    ['Origination', fmtPct(phase.origFee) + '  · ' + fmt$M(phase.loanAmountEst * phase.origFee)],
    ['Exit Fee', fmtPct(phase.exitFee) + '  · ' + fmt$M(phase.loanAmountEst * phase.exitFee)],
  ];

  const topLenders = phase.lenders.slice(0, 3);

  return (
    <div style={{ border: `1px solid ${color}40`, borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
      <div
        style={{
          backgroundColor: `${color}10`,
          padding: '8px 14px',
          borderBottom: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ChevronDown size={12} color={color} />
        <span style={{ ...MONO, color, fontSize: 11, fontWeight: 700 }}>
          {phase.phaseLabel} · M{phase.startMonth}–M{phase.endMonth}
        </span>
        <span style={{ color: BT.text.muted, fontSize: 10, flex: 1 }}>{phase.rationale}</span>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 7, padding: 14, borderRight: `1px solid ${BT.border.subtle}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              ['SIZING', sizingRows],
              ['STRUCTURE', structureRows],
              ['FEES', feeRows],
            ].map(([section, rows]) => (
              <div key={section as string}>
                <div
                  style={{
                    ...MONO,
                    color: BT.text.muted,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}
                >
                  {section as string}
                </div>
                {(rows as [string, string][]).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${BT.border.subtle}25`,
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ color: BT.text.muted, fontSize: 10 }}>{k}</span>
                    <span style={{ ...MONO, color: BT.text.primary, fontSize: 10, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {phase.isRefiEvent && phase.refiTriggerOcc && phase.refiTriggerDscr && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 10px',
                backgroundColor: `${BT.text.green}08`,
                border: `1px solid ${BT.text.green}30`,
                borderRadius: 2,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <CheckCircle size={11} color={BT.text.green} />
              <span style={{ color: BT.text.muted, fontSize: 10 }}>
                Refi window:{" "}
                <span style={{ ...MONO, color: BT.text.green }}>
                  Occ &gt; {(phase.refiTriggerOcc * 100).toFixed(0)}% AND DSCR &gt; {phase.refiTriggerDscr.toFixed(2)}
                </span>{' '}
                — executes at M{phase.startMonth}
              </span>
            </div>
          )}
        </div>
        {topLenders.length > 0 && (
          <div style={{ flex: 3, padding: 14, backgroundColor: BT.bg.terminal }}>
            <div
              style={{
                ...MONO,
                color: BT.text.muted,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                marginBottom: 10,
              }}
            >
              LENDER TARGETS
            </div>
            {topLenders.map((lt, i) => {
              const fitColor = lt.fitScore >= 85 ? BT.text.green : lt.fitScore >= 70 ? BT.text.cyan : BT.text.amber;
              return (
                <div
                  key={lt.lender.id}
                  style={{
                    border: `1px solid ${i === 0 ? fitColor + '50' : BT.border.subtle}`,
                    backgroundColor: i === 0 ? `${fitColor}08` : 'transparent',
                    borderRadius: 2,
                    padding: '8px 10px',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: BT.text.primary, fontSize: 11, fontWeight: 600 }}>{lt.lender.name}</span>
                    <span style={{ ...MONO, color: fitColor, fontSize: 11, fontWeight: 700 }}>fit {lt.fitScore}%</span>
                  </div>
                  {lt.lender.dealsYTDEst && (
                    <div style={{ ...MONO, color: BT.text.muted, fontSize: 9, marginBottom: 2 }}>
                      {lt.lender.dealsYTDEst} deals YTD · {lt.lender.recoursePreference}
                    </div>
                  )}
                  {lt.lender.notes && <div style={{ color: BT.text.muted, fontSize: 9 }}>{lt.lender.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LQ-7: EXIT WINDOW CALCULATOR — Optimal Refi Window from Curve Analysis
// ═══════════════════════════════════════════════════════════════════════════════

function ExitWindowsPanel({
  exitWindows,
  currentRate,
}: {
  exitWindows: NonNullable<DebtAdvisorResponse['exitWindows']>;
  currentRate: number;
}) {
  const { bestWindow, nextWindow, windows, narrative, absenceReason } = exitWindows;

  if (absenceReason) {
    return (
      <div
        style={{
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 2,
          padding: 14,
          marginBottom: 14,
          backgroundColor: BT.bg.panelAlt,
        }}
      >
        <SectionLabel label="EXIT WINDOW ANALYSIS" accent={BT.text.amber} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', backgroundColor: `${BT.text.amber}08`, border: `1px solid ${BT.text.amber}30`, borderRadius: 2 }}>
          <AlertTriangle size={12} color={BT.text.amber} />
          <span style={{ ...MONO, color: BT.text.amber, fontSize: 10 }}>{absenceReason}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${BT.border.subtle}`,
        borderRadius: 2,
        padding: 14,
        marginBottom: 14,
        backgroundColor: BT.bg.panelAlt,
      }}
    >
      <SectionLabel label="EXIT WINDOW ANALYSIS — CURVE + M35 EVENTS" accent={BT.text.cyan} />

      {/* Best Window Hero */}
      {bestWindow && (
        <div
          style={{
            backgroundColor: `${BT.text.green}08`,
            border: `1px solid ${BT.text.green}40`,
            borderRadius: 2,
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Target size={18} color={BT.text.green} />
          <div style={{ flex: 1 }}>
            <div style={{ ...MONO, color: BT.text.green, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
              OPTIMAL REFI WINDOW
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ ...MONO, color: BT.text.primary, fontSize: 16, fontWeight: 700 }}>{bestWindow.label}</span>
              <span style={{ ...MONO, color: BT.text.cyan, fontSize: 12 }}>
                {fmtPct(bestWindow.projectedRate)} vs {fmtPct(bestWindow.currentRate)} today
              </span>
              <span style={{ ...MONO, color: BT.text.green, fontSize: 12, fontWeight: 700 }}>
                {fmtBps(bestWindow.rateImprovementBps)} improvement
              </span>
              {bestWindow.dscrImprovement != null && (
                <span style={{ ...MONO, color: BT.text.teal, fontSize: 11 }}>
                  DSCR +{bestWindow.dscrImprovement.toFixed(2)}×
                </span>
              )}
            </div>
          </div>
          <Pill color={BT.text.green}>
            NET {fmtBps(bestWindow.netBenefitBps)}
          </Pill>
        </div>
      )}

      {/* Next Window */}
      {nextWindow && nextWindow.month !== bestWindow?.month && (
        <div
          style={{
            backgroundColor: `${BT.text.amber}06`,
            border: `1px solid ${BT.text.amber}30`,
            borderRadius: 2,
            padding: '8px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Clock size={14} color={BT.text.amber} />
          <div>
            <div style={{ ...MONO, color: BT.text.amber, fontSize: 9, fontWeight: 700 }}>NEXT UPCOMING</div>
            <div style={{ ...MONO, color: BT.text.primary, fontSize: 11 }}>
              {nextWindow.label} · {fmtPct(nextWindow.projectedRate)} · {fmtBps(nextWindow.rateImprovementBps)}
            </div>
          </div>
        </div>
      )}

      {/* All Windows Table */}
      {windows.length > 0 && (
        <div style={{ overflow: 'hidden', borderRadius: 2, border: `1px solid ${BT.border.subtle}` }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: BT.bg.header,
              borderBottom: `1px solid ${BT.border.medium}`,
              padding: '4px 8px',
            }}
          >
            {['Window', 'Source', 'Rate', 'Improvement', 'Refi Cost', 'Net Benefit', 'DSCR Δ', 'Confidence'].map((h) => (
              <div
                key={h}
                style={{
                  ...MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  color: BT.text.muted,
                  letterSpacing: 0.8,
                  flex: h === 'Window' ? 2 : 1,
                  padding: '2px 6px',
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {windows.map((w, i) => {
            const sc = sourceColor(w.source);
            const isBest = bestWindow?.month === w.month;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 8px',
                  backgroundColor: isBest ? `${BT.text.green}06` : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}
              >
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isBest && <Target size={10} color={BT.text.green} />}
                  <span style={{ ...MONO, color: BT.text.primary, fontSize: 10, fontWeight: isBest ? 700 : 500 }}>
                    {w.label}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <Pill color={sc}>{sourceLabel(w.source)}</Pill>
                </div>
                <div style={{ flex: 1, ...MONO, color: BT.text.cyan, fontSize: 10 }}>{fmtPct(w.projectedRate)}</div>
                <div style={{ flex: 1, ...MONO, color: BT.text.green, fontSize: 10, fontWeight: 700 }}>
                  {fmtBps(w.rateImprovementBps)}
                </div>
                <div style={{ flex: 1, ...MONO, color: BT.text.muted, fontSize: 10 }}>{fmtPct(w.refiCostPct)}</div>
                <div style={{ flex: 1, ...MONO, color: w.netBenefitBps >= 0 ? BT.text.green : BT.text.red, fontSize: 10, fontWeight: 700 }}>
                  {fmtBps(w.netBenefitBps)}
                </div>
                <div style={{ flex: 1, ...MONO, color: w.dscrImprovement != null ? BT.text.teal : BT.text.muted, fontSize: 10 }}>
                  {w.dscrImprovement != null ? `+${w.dscrImprovement.toFixed(2)}×` : '—'}
                </div>
                <div style={{ flex: 1, ...MONO, color: BT.text.amber, fontSize: 10 }}>
                  {(w.confidence * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Narrative */}
      {narrative && (
        <div style={{ marginTop: 10, padding: '6px 8px', backgroundColor: `${BT.text.cyan}06`, borderRadius: 2 }}>
          <span style={{ ...MONO, color: BT.text.muted, fontSize: 9 }}>{narrative}</span>
        </div>
      )}

      {/* Current Rate Context */}
      <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ ...MONO, color: BT.text.muted, fontSize: 9 }}>CURRENT ALL-IN:</span>
        <span style={{ ...MONO, color: BT.text.amber, fontSize: 11, fontWeight: 700 }}>{fmtPct(currentRate)}</span>
        <span style={{ ...MONO, color: BT.text.muted, fontSize: 9 }}>
          {windows.filter((w) => w.isActionable).length} actionable / {windows.length} total windows
        </span>
      </div>
    </div>
  );
}

function AlternativesPanel({ alternatives, onRecompute }: { alternatives: DebtAlternative[]; onRecompute: (hint: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: alternatives.length === 1 ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
      {alternatives.map((a, i) => {
        const irrSign = a.irrImpactBps >= 0 ? '+' : '';
        const irrColor = a.irrImpactBps >= 0 ? BT.text.green : BT.text.red;
        return (
          <div key={i} style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div style={{ ...MONO, color: BT.text.primary, fontSize: 11, fontWeight: 700 }}>{a.label}</div>
              <span style={{ ...MONO, color: irrColor, fontSize: 10 }}>
                {irrSign}{(a.irrImpactBps / 100).toFixed(1)}% IRR
              </span>
            </div>
            <div style={{ color: BT.text.muted, fontSize: 10, marginBottom: 10 }}>{a.productLabel}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${BT.border.subtle}20`, padding: '3px 0' }}>
              <span style={{ color: BT.text.muted, fontSize: 10 }}>Spread delta</span>
              <span style={{ ...MONO, color: BT.text.primary, fontSize: 10 }}>
                {a.deltaAllInBps >= 0 ? '+' : ''}
                {a.deltaAllInBps}bps
              </span>
            </div>
            <div style={{ marginTop: 8, color: BT.text.muted, fontSize: 9, fontStyle: 'italic', lineHeight: 1.5 }}>
              {a.tradeoff}
            </div>
            <button
              onClick={() => onRecompute(a.product)}
              style={{
                ...MONO,
                marginTop: 10,
                fontSize: 9,
                padding: '3px 10px',
                backgroundColor: `${BT.text.purple}12`,
                color: BT.text.purple,
                border: `1px solid ${BT.text.purple}40`,
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              Run Alternative →
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MarketContextPanel({ env }: { env: RateEnvironmentResult }) {
  const sofrFwd12 = env.sofr + env.sofrForward12moBps / 10000;
  const isFalling = env.classification === 'Dropping';
  const TrendIcon = isFalling ? TrendingDown : env.classification === 'Rising' ? ArrowRight : Clock;
  const trendColor = isFalling ? BT.text.green : env.classification === 'Rising' ? BT.text.red : BT.text.amber;

  const rows: [string, string, string, string][] = [
    ['10yr Treasury', fmtPct(env.treasury10y), `${env.classification} env`, trendColor],
    ['SOFR', fmtPct(env.sofr), `Fwd 12mo: ${fmtPct(sofrFwd12)}`, BT.text.cyan],
    ['Fed Funds Target', fmtPct(env.fedFundsTarget), env.classification, BT.text.cyan],
    [
      'Pricing Window',
      env.pricingWindowScore.toString() + '/100',
      env.pricingWindowLabel,
      env.pricingWindowScore >= 70 ? BT.text.green : env.pricingWindowScore >= 45 ? BT.text.amber : BT.text.red,
    ],
  ];

  return (
    <div style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: 14, backgroundColor: BT.bg.terminal }}>
      <div style={{ ...MONO, color: BT.text.muted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>
        MARKET CONTEXT
      </div>
      {rows.map(([label, value, sub, color]) => (
        <div
          key={label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${BT.border.subtle}30`,
            padding: '6px 0',
          }}
        >
          <span style={{ color: BT.text.muted, fontSize: 10 }}>{label}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <TrendIcon size={10} color={color} />
              <span style={{ ...MONO, color, fontSize: 12, fontWeight: 700 }}>{value}</span>
            </div>
            <div style={{ ...MONO, color: BT.text.muted, fontSize: 9 }}>{sub}</div>
          </div>
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          backgroundColor: env.pricingWindowScore >= 60 ? `${BT.text.green}10` : `${BT.text.amber}10`,
          border: `1px solid ${env.pricingWindowScore >= 60 ? BT.text.green : BT.text.amber}30`,
          borderRadius: 2,
          padding: '6px 8px',
        }}
      >
        <div style={{ ...MONO, color: env.pricingWindowScore >= 60 ? BT.text.green : BT.text.amber, fontSize: 10, fontWeight: 700 }}>
          PRICING WINDOW: {env.pricingWindowLabel.toUpperCase()}
        </div>
        <div style={{ color: BT.text.muted, fontSize: 9, marginTop: 2 }}>{env.ratCapAdvice}</div>
      </div>
      <div style={{ marginTop: 12, borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 10 }}>
        <div style={{ ...MONO, color: BT.text.muted, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>RATE PREFERENCE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill color={BT.text.cyan}>{env.ratePreference}</Pill>
          <span style={{ color: BT.text.muted, fontSize: 10 }}>{env.termPreference}</span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ ...MONO, color: BT.text.muted, fontSize: 9, marginBottom: 4 }}>SOFR FORWARD CURVE</div>
        <svg width="100%" height={32} viewBox="0 0 200 32">
          {isFalling ? (
            <polyline points="0,26 40,24 80,20 120,14 160,9 200,5" fill="none" stroke={BT.text.cyan} strokeWidth={1.5} />
          ) : (
            <polyline points="0,5 40,8 80,12 120,17 160,22 200,26" fill="none" stroke={trendColor} strokeWidth={1.5} />
          )}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['Now', '6mo', '12mo', '18mo', '24mo'].map((l) => (
            <span key={l} style={{ ...MONO, color: BT.text.muted, fontSize: 8 }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionsPanel({ triggers }: { triggers: MonitoringTrigger[] }) {
  return (
    <div style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: 12, marginTop: 4, backgroundColor: BT.bg.panelAlt }}>
      <SectionLabel label="ACTIONS & NEXT STEPS" accent={BT.text.amber} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {triggers.slice(0, 4).map((t, i) => {
          const color = t.severity === 'critical' ? BT.text.red : t.severity === 'warning' ? BT.text.amber : BT.text.cyan;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '6px 8px',
                border: `1px solid ${color}20`,
                borderRadius: 2,
                backgroundColor: `${color}06`,
              }}
            >
              <AlertTriangle size={11} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ ...MONO, color, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
                  {t.severity.toUpperCase()}
                </div>
                <div style={{ color: BT.text.muted, fontSize: 10 }}>{t.condition}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function M11DebtAdvisorTab({ dealId }: M11DebtAdvisorTabProps) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const { data, loading, error, recompute, refresh } = useDebtAdvisor(dealId);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data || !data.hasStrategy) return <NoStrategyState />;

  const { recommendedStack, alternatives, monitoringTriggers, rateEnvironment, summary, exitWindows } = data;
  const firstPhase = recommendedStack[0];

  return (
    <div style={{ background: BT.bg.terminal, color: BT.text.primary, padding: 16, minHeight: 600, fontFamily: BT.font.label }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {firstPhase && <StrategyOrigin phase={firstPhase} strategyName={data.strategyInputs.strategyName} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div>
          <DSCRTimeline phases={recommendedStack} />

          <DebtTimeline
            phases={recommendedStack}
            expandedPhase={expandedPhase}
            setExpandedPhase={setExpandedPhase}
          />

          {expandedPhase !== null && recommendedStack[expandedPhase] && (
            <PhaseDetail phase={recommendedStack[expandedPhase]} index={expandedPhase} />
          )}

          {/* LQ-7: Exit Window Calculator Integration */}
          {exitWindows && (
            <ExitWindowsPanel
              exitWindows={exitWindows}
              currentRate={firstPhase?.rateEst ?? rateEnvironment.sofr + 0.0275}
            />
          )}

          {alternatives.length > 0 && (
            <>
              <SectionLabel label="ALTERNATIVE STRUCTURES" accent={BT.text.purple} />
              <AlternativesPanel alternatives={alternatives} onRecompute={recompute} />
            </>
          )}
        </div>

        <MarketContextPanel env={rateEnvironment} />
      </div>

      {monitoringTriggers.length > 0 && <ActionsPanel triggers={monitoringTriggers} />}
    </div>
  );
}
