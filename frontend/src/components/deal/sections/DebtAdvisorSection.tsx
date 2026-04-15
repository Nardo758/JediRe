import { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, TrendingDown, TrendingUp, Zap, ChevronDown, ChevronRight, RefreshCw, BarChart2, Minus } from 'lucide-react';
import { useDebtAdvisor, DebtPhase, MonitoringTrigger, DebtAlternative, RateEnvironmentResult } from '../../../hooks/useDebtAdvisor';

const C = {
  bg: '#0a0a0c',
  panel: '#111114',
  panelAlt: '#13131a',
  border: '#1e1e24',
  borderMid: '#2a2a35',
  cyan: '#00e5a0',
  amber: '#f59e0b',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#2a2a40',
};

const mono: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };

function fmt$M(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 2): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

function Pill({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, backgroundColor: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 2, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
      {children}
    </span>
  );
}

function SectionLabel({ label, accent = C.cyan }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, backgroundColor: accent, borderRadius: 1 }} />
      <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
      <RefreshCw size={20} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ ...mono, color: C.textMuted, fontSize: 11 }}>COMPUTING DEBT PLAN…</span>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
      <AlertTriangle size={20} color={C.red} />
      <span style={{ color: C.textMuted, fontSize: 12 }}>{error}</span>
      <button onClick={onRetry} style={{ ...mono, fontSize: 10, padding: '5px 14px', backgroundColor: `${C.cyan}15`, color: C.cyan, border: `1px solid ${C.cyan}40`, borderRadius: 2, cursor: 'pointer' }}>Retry</button>
    </div>
  );
}

function NoStrategyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 14, padding: 32 }}>
      <BarChart2 size={28} color={C.textMuted} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...mono, color: C.textPrimary, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>No Strategy Detected</div>
        <div style={{ color: C.textMuted, fontSize: 11, maxWidth: 360, lineHeight: 1.6 }}>Run M08 Strategy Analysis first. The Debt Advisor reads your strategy output to determine the optimal debt structure for this deal.</div>
      </div>
      <div style={{ ...mono, backgroundColor: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '8px 16px', color: C.amber, fontSize: 10 }}>
        GO TO STRATEGY TAB → RUN ANALYSIS → RETURN HERE
      </div>
    </div>
  );
}

function StrategyBanner({ phase }: { phase: DebtPhase; strategyName: string; whyStatement: string }) {
  return (
    <div style={{ backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={13} color={C.cyan} />
        <div style={{ flex: 1 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>DEBT STRUCTURE DRIVEN BY M08 STRATEGY DETECTION</div>
          <div style={{ color: C.textMuted, fontSize: 10, lineHeight: 1.5 }}>
            <span style={{ ...mono, color: C.textPrimary, fontWeight: 700 }}>{phase.productLabel.toUpperCase()}</span>
            <span style={{ ...mono, color: C.textMuted }}> → {phase.rationale}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseBar({ phases, expandedPhase, setExpandedPhase }: { phases: DebtPhase[]; expandedPhase: number | null; setExpandedPhase: (v: number | null) => void }) {
  const maxMonth = Math.max(...phases.map(p => p.endMonth), 36);
  const pct = (m: number) => `${(m / maxMonth) * 100}%`;

  const phaseColors = [C.orange, C.cyan, C.purple, C.green, C.amber];
  const refiPhase = phases.find(p => p.isRefiEvent);

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, marginBottom: 4, backgroundColor: C.panelAlt }}>
      <SectionLabel label="DEBT PLAN TIMELINE" accent={C.amber} />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {Array.from({ length: 7 }, (_, i) => Math.round((maxMonth / 6) * i)).map(m => (
            <span key={m} style={{ ...mono, color: C.textMuted, fontSize: 9 }}>M{m}</span>
          ))}
        </div>
        {refiPhase && (
          <div style={{ position: 'absolute', left: pct(refiPhase.startMonth), top: 24, height: 34, width: 1, backgroundColor: `${C.green}70` }}>
            <span style={{ ...mono, fontSize: 8, color: C.green, position: 'absolute', top: '100%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>REFI M{refiPhase.startMonth}</span>
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
                <span style={{ ...mono, color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.phaseLabel}</span>
                {isExpanded ? <ChevronDown size={10} color={color} style={{ marginLeft: 'auto', flexShrink: 0 }} /> : <ChevronRight size={10} color={C.textMuted} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseDetail({ phase, index }: { phase: DebtPhase; index: number }) {
  const phaseColors = [C.orange, C.cyan, C.purple, C.green, C.amber];
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
      <div style={{ backgroundColor: `${color}10`, padding: '8px 14px', borderBottom: `1px solid ${color}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ChevronDown size={12} color={color} />
        <span style={{ ...mono, color, fontSize: 11, fontWeight: 700 }}>{phase.phaseLabel} · M{phase.startMonth}–M{phase.endMonth}</span>
        <span style={{ color: C.textMuted, fontSize: 10, flex: 1 }}>{phase.rationale}</span>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 7, padding: 14, borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[['SIZING', sizingRows], ['STRUCTURE', structureRows], ['FEES', feeRows]].map(([section, rows]) => (
              <div key={section as string}>
                <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>{section as string}</div>
                {(rows as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}25`, padding: '3px 0' }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{k}</span>
                    <span style={{ ...mono, color: C.textPrimary, fontSize: 10, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {phase.isRefiEvent && phase.refiTriggerOcc && phase.refiTriggerDscr && (
            <div style={{ marginTop: 12, padding: '8px 10px', backgroundColor: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle size={11} color={C.green} />
              <span style={{ color: C.textMuted, fontSize: 10 }}>
                Refi window: <span style={{ ...mono, color: C.green }}>Occ {'>'} {(phase.refiTriggerOcc * 100).toFixed(0)}% AND DSCR {'>'} {phase.refiTriggerDscr.toFixed(2)}</span> — executes at M{phase.startMonth}
              </span>
            </div>
          )}
        </div>
        {topLenders.length > 0 && (
          <div style={{ flex: 3, padding: 14, backgroundColor: C.bg }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>LENDER TARGETS</div>
            {topLenders.map((lt, i) => {
              const fitColor = lt.fitScore >= 85 ? C.green : lt.fitScore >= 70 ? C.cyan : C.amber;
              return (
                <div key={lt.lender.id} style={{ border: `1px solid ${i === 0 ? fitColor + '50' : C.border}`, backgroundColor: i === 0 ? `${fitColor}08` : 'transparent', borderRadius: 2, padding: '8px 10px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: C.textPrimary, fontSize: 11, fontWeight: 600 }}>{lt.lender.name}</span>
                    <span style={{ ...mono, color: fitColor, fontSize: 11, fontWeight: 700 }}>fit {lt.fitScore}%</span>
                  </div>
                  {lt.lender.dealsYTDEst && (
                    <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 2 }}>{lt.lender.dealsYTDEst} deals YTD · {lt.lender.recoursePreference}</div>
                  )}
                  {lt.lender.notes && (
                    <div style={{ color: C.textMuted, fontSize: 9 }}>{lt.lender.notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AlternativesPanel({ alternatives, onRecompute }: { alternatives: DebtAlternative[]; onRecompute: (hint: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: alternatives.length === 1 ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
      {alternatives.map((a, i) => {
        const irrSign = a.irrImpactBps >= 0 ? '+' : '';
        const irrColor = a.irrImpactBps >= 0 ? C.green : C.red;
        return (
          <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700 }}>{a.label}</div>
              <span style={{ ...mono, color: irrColor, fontSize: 10 }}>{irrSign}{(a.irrImpactBps / 100).toFixed(1)}% IRR</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 10 }}>{a.productLabel}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}20`, padding: '3px 0' }}>
              <span style={{ color: C.textMuted, fontSize: 10 }}>Spread delta</span>
              <span style={{ ...mono, color: C.textPrimary, fontSize: 10 }}>{a.deltaAllInBps >= 0 ? '+' : ''}{a.deltaAllInBps}bps</span>
            </div>
            <div style={{ marginTop: 8, color: C.textMuted, fontSize: 9, fontStyle: 'italic', lineHeight: 1.5 }}>{a.tradeoff}</div>
            <button
              onClick={() => onRecompute(a.product)}
              style={{ ...mono, marginTop: 10, fontSize: 9, padding: '3px 10px', backgroundColor: `${C.purple}12`, color: C.purple, border: `1px solid ${C.purple}40`, borderRadius: 2, cursor: 'pointer' }}
            >
              Run Alternative →
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TriggersPanel({ triggers }: { triggers: MonitoringTrigger[] }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>MONITORING TRIGGERS</span>
      </div>
      {triggers.map((t, i) => {
        const isWarn = t.severity === 'warning' || t.severity === 'critical';
        const accentColor = t.severity === 'critical' ? C.red : isWarn ? C.amber : C.green;
        return (
          <div key={t.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < triggers.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: isWarn ? `${accentColor}06` : 'transparent', alignItems: 'flex-start' }}>
            <div style={{ marginTop: 1, flexShrink: 0 }}>
              {isWarn ? <AlertTriangle size={12} color={accentColor} /> : <CheckCircle size={12} color={C.green} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 600 }}>{t.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span style={{ ...mono, color: isWarn ? accentColor : C.textMuted, fontSize: 9 }}>{t.currentValue}</span>
                <span style={{ ...mono, color: C.textDim, fontSize: 9 }}>· {t.frequency}</span>
              </div>
              <div style={{ color: C.textMuted, fontSize: 10 }}>{t.condition}</div>
              <div style={{ color: C.textMuted, fontSize: 9, marginTop: 2, fontStyle: 'italic' }}>{t.action}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketContextPanel({ env }: { env: RateEnvironmentResult }) {
  const sofrFwd12 = env.sofr + env.sofrForward12moBps / 10000;
  const isFalling = env.classification === 'Dropping';
  const TrendIcon = isFalling ? TrendingDown : env.classification === 'Rising' ? TrendingUp : Minus;
  const trendColor = isFalling ? C.green : env.classification === 'Rising' ? C.red : C.amber;

  const rows: [string, string, string, string][] = [
    ['10yr Treasury', fmtPct(env.treasury10y), `${env.classification} env`, trendColor],
    ['SOFR', fmtPct(env.sofr), `Fwd 12mo: ${fmtPct(sofrFwd12)}`, C.cyan],
    ['Fed Funds Target', fmtPct(env.fedFundsTarget), env.classification, C.cyan],
    ['Pricing Window', env.pricingWindowScore.toString() + '/100', env.pricingWindowLabel, env.pricingWindowScore >= 70 ? C.green : env.pricingWindowScore >= 45 ? C.amber : C.red],
  ];

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, backgroundColor: C.bg }}>
      <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>MARKET CONTEXT</div>
      {rows.map(([label, value, sub, color]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}30`, padding: '6px 0' }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>{label}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <TrendIcon size={10} color={color} />
              <span style={{ ...mono, color, fontSize: 12, fontWeight: 700 }}>{value}</span>
            </div>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9 }}>{sub}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 10, backgroundColor: env.pricingWindowScore >= 60 ? `${C.green}10` : `${C.amber}10`, border: `1px solid ${env.pricingWindowScore >= 60 ? C.green : C.amber}30`, borderRadius: 2, padding: '6px 8px' }}>
        <div style={{ ...mono, color: env.pricingWindowScore >= 60 ? C.green : C.amber, fontSize: 10, fontWeight: 700 }}>PRICING WINDOW: {env.pricingWindowLabel.toUpperCase()}</div>
        <div style={{ color: C.textMuted, fontSize: 9, marginTop: 2 }}>{env.ratCapAdvice}</div>
      </div>
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>RATE PREFERENCE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill color={C.cyan}>{env.ratePreference}</Pill>
          <span style={{ color: C.textMuted, fontSize: 10 }}>{env.termPreference}</span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 4 }}>SOFR FORWARD CURVE</div>
        <svg width="100%" height={32} viewBox="0 0 200 32">
          <defs>
            <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cyan} stopOpacity="0.3" />
              <stop offset="100%" stopColor={C.cyan} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {isFalling
            ? <polyline points="0,26 40,24 80,20 120,14 160,9 200,5" fill="none" stroke={C.cyan} strokeWidth={1.5} />
            : <polyline points="0,5 40,8 80,12 120,17 160,22 200,26" fill="none" stroke={trendColor} strokeWidth={1.5} />
          }
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['Now', '6mo', '12mo', '18mo', '24mo'].map(l => (
            <span key={l} style={{ ...mono, color: C.textMuted, fontSize: 8 }}>{l}</span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 8 }}>SPREAD OVER INDEX (bps)</div>
        {[
          ['Agency', 165, C.cyan],
          ['CMBS', 215, '#b794f4'],
          ['Bank', 250, '#4fd1c5'],
          ['Bridge', 340, C.amber],
          ['Mezz', 650, '#f6e05e'],
        ].map(([n, s, c]) => (
          <div key={n as string} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ color: C.textMuted, fontSize: 8, minWidth: 40, textAlign: 'right' }}>{n}</span>
            <div style={{ flex: 1, height: 8, background: `${C.border}60`, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((s as number) / 700) * 100}%`, background: `${c as string}40`, borderRadius: 2, borderRight: `2px solid ${c as string}` }} />
            </div>
            <span style={{ ...mono, fontSize: 8, color: c as string, minWidth: 30, textAlign: 'right' }}>+{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvisorTab({ phases, alternatives, triggers, env, narrativeNotes, strategyName, summary, onRecompute }: {
  phases: DebtPhase[];
  alternatives: DebtAlternative[];
  triggers: MonitoringTrigger[];
  env: RateEnvironmentResult;
  narrativeNotes: string[];
  strategyName: string;
  summary: { primaryProductLabel: string; headline: string; whyStatement: string; totalClosingCosts: number; initialLoanAmount: number; blendedAllInRate: number };
  onRecompute: (hint?: string) => void;
}) {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
        <div style={{ backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={13} color={C.cyan} />
            <div style={{ flex: 1 }}>
              <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>DEBT STRUCTURE DRIVEN BY M08 STRATEGY DETECTION · {strategyName.toUpperCase()}</div>
              <div style={{ color: C.textMuted, fontSize: 10, lineHeight: 1.5 }}>{summary.headline}</div>
              {narrativeNotes.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {narrativeNotes.slice(0, 3).map((n, i) => <Pill key={i} color={C.amber}>{n}</Pill>)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[
            ['Primary Product', summary.primaryProductLabel, C.cyan],
            ['Loan Amount', fmt$M(summary.initialLoanAmount), C.textPrimary],
            ['Blended Rate', fmtPct(summary.blendedAllInRate), C.amber],
            ['Closing Costs', fmt$M(summary.totalClosingCosts), C.orange],
          ].map(([label, value, color]) => (
            <div key={label as string} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 2, padding: '8px 12px', backgroundColor: C.panelAlt }}>
              <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 4 }}>{label}</div>
              <div style={{ ...mono, color: color as string, fontSize: 14, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        <PhaseBar phases={phases} expandedPhase={expandedPhase} setExpandedPhase={setExpandedPhase} />

        {expandedPhase !== null && phases[expandedPhase] && (
          <PhaseDetail phase={phases[expandedPhase]} index={expandedPhase} />
        )}

        {alternatives.length > 0 && (
          <>
            <SectionLabel label="ALTERNATIVES" accent={C.purple} />
            <AlternativesPanel alternatives={alternatives} onRecompute={(hint) => onRecompute(hint)} />
          </>
        )}

        {triggers.length > 0 && (
          <>
            <SectionLabel label="MONITORING TRIGGERS" accent={C.amber} />
            <TriggersPanel triggers={triggers} />
          </>
        )}

        {summary.whyStatement && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 14px', backgroundColor: C.panelAlt }}>
            <SectionLabel label="DEBT RATIONALE" accent={C.cyan} />
            <div style={{ color: C.textMuted, fontSize: 11, lineHeight: 1.7 }}>{summary.whyStatement}</div>
          </div>
        )}
      </div>

      <div style={{ width: 220, borderLeft: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0, backgroundColor: C.panelAlt }}>
        <div style={{ padding: 14 }}>
          <MarketContextPanel env={env} />
        </div>
      </div>
    </div>
  );
}

function ConfigureTab({ phases }: { phases: DebtPhase[] }) {
  const [activePhase, setActivePhase] = useState(0);
  const phase = phases[activePhase];
  if (!phase) return null;

  const fields: [string, string, string][] = [
    ['Loan Amount', fmt$M(phase.loanAmountEst), fmtPct(phase.ltv) + ' LTV'],
    ['Rate Type', phase.rateType, phase.rateType === 'Floating' ? 'SOFR + Spread' : 'Fixed rate'],
    ['Rate Est', fmtPct(phase.rateEst), phase.rateType === 'Floating' && phase.spreadBps ? `SOFR + ${phase.spreadBps}bps` : ''],
    ['Term', `${phase.termYears}yr`, `${phase.startMonth === 0 ? 'From close' : `from M${phase.startMonth}`}`],
    ['IO Period', phase.ioMonths > 0 ? `${phase.ioMonths}mo` : 'None', phase.ioMonths >= phase.termYears * 12 ? 'Full IO' : 'Partial IO'],
    ['Amortization', phase.amortYears > 0 ? `${phase.amortYears}yr` : 'Full IO', 'standard'],
    ['Origination Fee', fmtPct(phase.origFee), fmt$M(phase.loanAmountEst * phase.origFee)],
    ['Exit Fee', fmtPct(phase.exitFee), fmt$M(phase.loanAmountEst * phase.exitFee)],
    ['Prepay Type', phase.prepayType, ''],
  ];
  if (phase.refiTriggerDscr != null) fields.push(['Min DSCR Trigger', phase.refiTriggerDscr.toFixed(2) + '×', 'refi threshold']);
  if (phase.refiTriggerOcc != null) fields.push(['Min Occ Trigger', fmtPct(phase.refiTriggerOcc), 'refi threshold']);

  const phaseColors = [C.orange, C.cyan, C.purple, C.green, C.amber];

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      <div style={{ flex: 1, padding: '14px 20px', overflowY: 'auto' }}>
        <div style={{ backgroundColor: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '7px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={12} color={C.cyan} />
          <span style={{ color: C.textMuted, fontSize: 10 }}>Pre-populated from Advisor recommendation — <span style={{ ...mono, color: C.cyan }}>{phases[0]?.productLabel}</span></span>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {phases.map((p, i) => {
            const color = phaseColors[i % phaseColors.length];
            return (
              <button
                key={p.phaseIndex}
                onClick={() => setActivePhase(i)}
                style={{ flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', backgroundColor: activePhase === i ? `${color}15` : C.panelAlt, color: activePhase === i ? color : C.textMuted, textAlign: 'left', borderRight: i < phases.length - 1 ? `1px solid ${C.border}` : 'none' }}
              >
                <div style={{ ...mono, fontSize: 10, fontWeight: activePhase === i ? 700 : 400 }}>{p.phaseLabel} · {fmt$M(p.loanAmountEst)} · M{p.startMonth}–M{p.endMonth}</div>
              </button>
            );
          })}
        </div>

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#0d0d12' }}>
                {['Field', 'Value', 'Note'].map(h => (
                  <th key={h} style={{ ...mono, textAlign: 'left', padding: '4px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map(([label, value, note], i) => (
                <tr key={label} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : `${C.border}15` }}>
                  <td style={{ padding: '4px 10px', color: C.textMuted, fontSize: 10 }}>{label}</td>
                  <td style={{ ...mono, padding: '4px 10px', color: C.textPrimary, fontWeight: 600, fontSize: 11 }}>{value}</td>
                  <td style={{ padding: '4px 10px', color: C.textMuted, fontSize: 9 }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...mono, fontSize: 10, padding: '7px 16px', backgroundColor: C.cyan, color: '#0a0a0c', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>Lock to ProForma <ArrowRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /></button>
          <button style={{ ...mono, fontSize: 10, padding: '7px 14px', backgroundColor: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, cursor: 'pointer' }}>Export Term Sheet</button>
          <button style={{ ...mono, fontSize: 10, padding: '7px 14px', backgroundColor: 'transparent', color: C.purple, border: `1px solid ${C.purple}40`, borderRadius: 2, cursor: 'pointer' }}>Add Mezz Tranche</button>
        </div>
      </div>

      <div style={{ width: 220, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 10 }}>LOAN STACK TOTAL</div>
        {phases.map((p, i) => {
          const color = phaseColors[i % phaseColors.length];
          return (
            <div key={p.phaseIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}20` }}>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{p.phaseLabel}</span>
              <span style={{ ...mono, color, fontSize: 11, fontWeight: 600 }}>{fmt$M(p.loanAmountEst)}</span>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>Primary Loan</span>
          <span style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700 }}>{fmt$M(phases[0]?.loanAmountEst ?? 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>Blended LTV</span>
          <span style={{ ...mono, color: C.amber, fontSize: 11, fontWeight: 600 }}>{fmtPct(phases[0]?.ltv ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function SensitivityTab() {
  const [activeTable, setActiveTable] = useState<'irr' | 'em' | 'dscr' | 'leverage'>('irr');

  const EXIT_CAPS = [4.0, 4.5, 5.0, 5.25, 5.5, 6.0, 6.5];
  const RENT_GROWTH = [1.0, 2.0, 3.0, 4.0, 5.0];
  const HOLD_PERIODS = [3, 5, 7, 10];
  const SPREADS = [200, 250, 275, 300, 350];
  const NOI_GROWTH = [0, 5, 10, 15, 20];
  const LTVS = [60, 65, 70, 75, 80];

  const irrGrid: Record<number, number[]> = {
    4.0: [26.1, 28.4, 30.8, 33.1, 35.4],
    4.5: [22.8, 25.0, 27.2, 29.4, 31.7],
    5.0: [19.8, 21.9, 24.0, 26.1, 28.2],
    5.25: [18.4, 20.4, 22.4, 24.4, 26.5],
    5.5: [17.1, 19.0, 21.0, 22.9, 24.9],
    6.0: [14.8, 16.7, 18.5, 20.4, 22.3],
    6.5: [12.7, 14.5, 16.2, 18.0, 19.8],
  };
  const emGrid: Record<number, number[]> = {
    4.0: [1.92, 2.61, 3.42, 5.31],
    4.5: [1.78, 2.36, 3.04, 4.62],
    5.0: [1.65, 2.14, 2.72, 4.04],
    5.25: [1.59, 2.04, 2.57, 3.78],
    5.5: [1.53, 1.95, 2.44, 3.54],
    6.0: [1.42, 1.78, 2.20, 3.12],
    6.5: [1.32, 1.62, 1.98, 2.74],
  };
  const dscrGrid: Record<number, number[]> = {
    200: [0.98, 1.05, 1.13, 1.20, 1.28],
    250: [0.94, 1.01, 1.08, 1.15, 1.23],
    275: [0.91, 0.98, 1.06, 1.13, 1.20],
    300: [0.89, 0.96, 1.03, 1.10, 1.17],
    350: [0.84, 0.91, 0.98, 1.05, 1.12],
  };
  const leverageGrid: Record<number, number[]> = {
    4.0: [27.4, 29.8, 32.4, 35.2, 38.3],
    4.5: [23.8, 25.9, 28.1, 30.5, 33.1],
    5.0: [20.6, 22.5, 24.5, 26.6, 28.9],
    5.25: [19.2, 20.9, 22.8, 24.8, 26.9],
    5.5: [17.9, 19.5, 21.3, 23.2, 25.2],
    6.0: [15.5, 17.0, 18.6, 20.4, 22.2],
    6.5: [13.4, 14.7, 16.1, 17.7, 19.4],
  };

  const irrColor = (v: number) => v >= 20 ? C.green : v >= 12 ? C.amber : C.red;
  const emColor = (v: number) => v >= 2.5 ? C.green : v >= 1.8 ? C.amber : C.red;
  const dscrColor = (v: number) => v >= 1.35 ? C.green : v >= 1.15 ? C.amber : C.red;
  const levColor = (v: number) => v >= 20 ? C.green : v >= 12 ? C.amber : C.red;

  const tables = [
    { id: 'irr' as const, label: 'IRR × EXIT CAP × RENT GROWTH', badge: 'from F8' },
    { id: 'em' as const, label: 'EM × EXIT CAP × HOLD PERIOD', badge: 'from F8' },
    { id: 'dscr' as const, label: 'DSCR × SPREAD × NOI CAPTURE', badge: 'debt-specific' },
    { id: 'leverage' as const, label: 'LP IRR × LTV × EXIT CAP', badge: 'leverage sensitivity' },
  ];

  const thStyle: React.CSSProperties = { ...mono, padding: '5px 10px', color: C.textMuted, textAlign: 'left', fontWeight: 500, fontSize: 10 };
  const thCenterStyle: React.CSSProperties = { ...mono, padding: '5px 12px', color: C.cyan, textAlign: 'center', fontWeight: 500, fontSize: 10 };

  return (
    <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
      <div style={{ backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '7px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700 }}>CURRENT POSITION</span>
        {[['Exit Cap', '5.25%'], ['Rent Growth', '4.0%'], ['Hold', '3yr'], ['LTV', '70%'], ['Spread', 'SOFR+275']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 4 }}>
            <span style={{ color: C.textMuted, fontSize: 9 }}>{k}:</span>
            <span style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>↓ highlighted in each table</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {tables.map(t => (
          <button key={t.id} onClick={() => setActiveTable(t.id)} style={{ ...mono, fontSize: 9, padding: '4px 12px', cursor: 'pointer', backgroundColor: activeTable === t.id ? `${C.purple}15` : 'transparent', color: activeTable === t.id ? C.purple : C.textMuted, border: `1px solid ${activeTable === t.id ? C.purple + '50' : C.border}`, borderRadius: 2 }}>
            {t.label} <span style={{ color: C.textMuted, fontSize: 8 }}>· {t.badge}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 8 }}>HEATMAP:</span>
        {activeTable === 'dscr' ? (
          <><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.green }}>■</span> DSCR ≥1.35 (refi-ready)</span><span style={{ ...mono, fontSize: 8, marginLeft: 8 }}><span style={{ color: C.amber }}>■</span> 1.15–1.35</span><span style={{ ...mono, fontSize: 8, marginLeft: 8 }}><span style={{ color: C.red }}>■</span> {'<'}1.15 (IO required)</span></>
        ) : (
          <><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.green }}>■</span> {activeTable === 'em' ? '≥2.5× EM' : '≥20% IRR'}</span><span style={{ ...mono, fontSize: 8, marginLeft: 8 }}><span style={{ color: C.amber }}>■</span> {activeTable === 'em' ? '1.8–2.5×' : '12–20%'}</span><span style={{ ...mono, fontSize: 8, marginLeft: 8 }}><span style={{ color: C.red }}>■</span> {activeTable === 'em' ? '<1.8×' : '<12%'}</span></>
        )}
        <span style={{ ...mono, color: C.amber, fontSize: 8, marginLeft: 4 }}>▶ Current deal position</span>
      </div>

      {activeTable === 'irr' && (
        <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
              <th style={thStyle}>EXIT CAP ↓ \ RG →</th>
              {RENT_GROWTH.map(g => <th key={g} style={thCenterStyle}>{g.toFixed(1)}%</th>)}
            </tr>
          </thead>
          <tbody>
            {EXIT_CAPS.map(cap => (
              <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ ...mono, padding: '4px 10px', color: C.amber, fontWeight: 600, fontSize: 10 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                {RENT_GROWTH.map((g, ci) => {
                  const v = irrGrid[cap]?.[ci] ?? 0;
                  const isCurrent = cap === 5.25 && ci === 3;
                  return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: irrColor(v), background: isCurrent ? `${C.amber}25` : `${irrColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(1)}%</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTable === 'em' && (
        <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
              <th style={thStyle}>EXIT CAP ↓ \ HOLD →</th>
              {HOLD_PERIODS.map(h => <th key={h} style={{ ...thCenterStyle, padding: '5px 14px' }}>{h}yr</th>)}
            </tr>
          </thead>
          <tbody>
            {EXIT_CAPS.map(cap => (
              <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ ...mono, padding: '4px 10px', color: C.amber, fontWeight: 600, fontSize: 10 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                {HOLD_PERIODS.map((h, ci) => {
                  const v = emGrid[cap]?.[ci] ?? 0;
                  const isCurrent = cap === 5.25 && h === 3;
                  return <td key={ci} style={{ padding: '5px 14px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: emColor(v), background: isCurrent ? `${C.amber}25` : `${emColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(2)}×</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTable === 'dscr' && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 8 }}>DSCR Y1 by <span style={{ ...mono, color: C.orange }}>Bridge Spread</span> (rows) × <span style={{ ...mono, color: C.cyan }}>NOI Capture %</span> (cols) · SOFR constant</div>
          <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
                <th style={thStyle}>SPREAD ↓ \ CAPTURE →</th>
                {NOI_GROWTH.map(g => <th key={g} style={thCenterStyle}>+{g}%</th>)}
              </tr>
            </thead>
            <tbody>
              {SPREADS.map(s => (
                <tr key={s} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...mono, padding: '4px 10px', color: C.orange, fontWeight: 600, fontSize: 10 }}>+{s}bps{s === 275 ? ' ◀' : ''}</td>
                  {NOI_GROWTH.map((g, ci) => {
                    const v = dscrGrid[s]?.[ci] ?? 0;
                    const isCurrent = s === 275 && ci === 0;
                    return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: dscrColor(v), background: isCurrent ? `${C.amber}25` : `${dscrColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(2)}×</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: '7px 10px', backgroundColor: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 2, fontSize: 10, color: C.textMuted }}>
            Refi eligible (DSCR {'>'} 1.35) at current spread +275bps: requires ~15% NOI capture. Aligned with M08 capture schedule.
          </div>
        </div>
      )}

      {activeTable === 'leverage' && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 8 }}>LP IRR by <span style={{ ...mono, color: C.amber }}>Exit Cap</span> (rows) × <span style={{ ...mono, color: C.cyan }}>Senior LTV</span> (cols) · Rent growth 4.0% · Hold 3yr</div>
          <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
                <th style={thStyle}>EXIT CAP ↓ \ LTV →</th>
                {LTVS.map(l => <th key={l} style={thCenterStyle}>{l}%</th>)}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map(cap => (
                <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...mono, padding: '4px 10px', color: C.amber, fontWeight: 600, fontSize: 10 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                  {LTVS.map((ltv, ci) => {
                    const v = leverageGrid[cap]?.[ci] ?? 0;
                    const isCurrent = cap === 5.25 && ltv === 70;
                    return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 700, fontSize: 10, color: levColor(v), background: isCurrent ? `${C.amber}25` : `${levColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(1)}%</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: '7px 10px', backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, fontSize: 10, color: C.textMuted }}>
            At 70% LTV and 5.25% exit cap: <span style={{ ...mono, color: C.cyan }}>19.2% LP IRR</span>. Adding mezz +5% LTV: projected +1.1% IRR — mezz execution risk applies.
          </div>
        </div>
      )}
    </div>
  );
}

function ExitTab({ onNavigate }: { onNavigate: (tab: 'advisor' | 'configure' | 'sensitivity') => void }) {
  const [selectedFwd, setSelectedFwd] = useState(8);
  const [selectedStrategy, setSelectedStrategy] = useState('sell-stabilized');

  const RSS_DATA = [
    { q: "Q1'27", rss: 58, irr: 16.1 },
    { q: "Q2'27", rss: 63, irr: 17.4 },
    { q: "Q3'27", rss: 71, irr: 18.9 },
    { q: "Q4'27", rss: 78, irr: 19.3 },
    { q: "Q1'28", rss: 82, irr: 19.8 },
    { q: "Q2'28", rss: 86, irr: 20.1 },
    { q: "Q3'28", rss: 84, irr: 20.4 },
    { q: "Q4'28", rss: 79, irr: 19.9 },
    { q: "Q1'29", rss: 73, irr: 19.2 },
    { q: "Q2'29", rss: 67, irr: 18.3 },
  ];
  const optimalFwd = 6;
  const sel = RSS_DATA[selectedFwd] ?? RSS_DATA[optimalFwd];
  const rssColor = sel.rss >= 85 ? C.green : sel.rss >= 70 ? C.cyan : sel.rss >= 55 ? C.amber : C.red;

  const exitOptions = [
    { id: 'sell-stabilized', label: 'Sell at Stabilization', desc: 'Value-add complete → sell at Y3 to institutional buyer', tl: '24–36mo', irr: '19.3%', em: '1.92×', color: C.cyan },
    { id: 'refi-hold', label: 'Refinance & Hold', desc: 'Agency refi → hold 7–10yr for cash flow compounding', tl: '7–10 yrs', irr: '21.7%', em: '3.10×', color: C.green },
    { id: '1031-exchange', label: '1031 Exchange', desc: 'Sell and defer gains → redeploy into larger MSA asset', tl: '24–36mo', irr: '19.1%', em: '1.89×', color: C.purple },
  ];

  const rssBreakdown = [
    { label: 'Market Window', score: 82, weight: '35%', color: C.green },
    { label: 'Rate Environment', score: 74, weight: '25%', color: C.cyan },
    { label: 'Supply Position', score: 68, weight: '20%', color: C.cyan },
    { label: 'Op. Readiness', score: 55, weight: '15%', color: C.amber },
    { label: 'Buyer Pressure', score: 61, weight: '5%', color: C.amber },
  ];

  return (
    <div style={{ padding: '14px 20px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', marginBottom: 3 }}>EXIT INTELLIGENCE — DRIVEN BY M08 CAPTURE SCHEDULE</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ ...mono, color: C.textPrimary, fontSize: 13, fontWeight: 700 }}>Platform Optimal Exit: Q3 '28</span>
            <Pill color={C.green}>RSS 84 — Strong sell window</Pill>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onNavigate('advisor')} style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, cursor: 'pointer' }}>← Advisor</button>
          <button onClick={() => onNavigate('configure')} style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: C.cyan, color: '#0a0a0c', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>Lock to Configure →</button>
        </div>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 16px', marginBottom: 14, backgroundColor: C.panel }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em' }}>21-YEAR CONVERGENCE · CLICK FUTURE QUARTER TO SET EXIT</div>
            <div style={{ color: C.textMuted, fontSize: 9, marginTop: 2 }}>10yr history · 10yr forward · NOI ramp, cap rates, supply pressure, RSS</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 8 }}>SELECTED EXIT</div>
            <div style={{ ...mono, color: rssColor, fontSize: 14, fontWeight: 700 }}>{sel.q}</div>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9 }}>IRR {sel.irr.toFixed(1)}% · RSS {sel.rss}</div>
          </div>
        </div>
        <svg width="100%" height={90} viewBox="0 0 700 90" style={{ display: 'block' }}>
          <rect x={0} y={0} width={240} height={90} fill={`${C.border}30`} />
          <text x={4} y={10} fontSize={7} fill={C.textMuted} fontFamily="JetBrains Mono">◀ 10yr history</text>
          <text x={250} y={10} fontSize={7} fill={C.textMuted} fontFamily="JetBrains Mono">10yr forward ▶</text>
          <line x1={240} y1={0} x2={240} y2={90} stroke={C.amber} strokeWidth={1} strokeDasharray="3,2" />
          <text x={243} y={10} fontSize={7} fill={C.amber} fontFamily="JetBrains Mono">NOW</text>
          <polyline points="0,75 60,72 120,68 180,62 240,58 300,52 350,44 390,38 430,32 460,28 490,26 520,24 560,23 620,22 700,21" fill="none" stroke={C.cyan} strokeWidth={1.5} />
          <polyline points="0,30 60,31 120,32 180,34 240,36 300,40 340,46 370,52 400,55 440,54 480,52 530,50 580,49 640,48 700,47" fill="none" stroke="#a855f7" strokeWidth={1.5} />
          <polyline points="240,62 280,56 320,48 360,40 400,34 440,28 480,30 520,35 560,42 600,50 640,57 700,63" fill="none" stroke={C.green} strokeWidth={1} strokeDasharray="4,2" />
          <line x1={480} y1={0} x2={480} y2={90} stroke={C.green} strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={480} cy={28} r={4} fill={C.green} />
          <text x={484} y={24} fontSize={7} fill={C.green} fontFamily="JetBrains Mono">OPT Q3'28</text>
          {selectedFwd !== optimalFwd && (
            <>
              <line x1={240 + selectedFwd * 32} y1={0} x2={240 + selectedFwd * 32} y2={90} stroke={C.amber} strokeWidth={1} strokeDasharray="2,2" />
              <circle cx={240 + selectedFwd * 32} cy={35} r={3} fill={C.amber} />
            </>
          )}
          {RSS_DATA.map((_, i) => (
            <rect key={i} x={248 + i * 32 - 14} y={0} width={28} height={90} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => setSelectedFwd(i)} />
          ))}
          <line x1={10} y1={82} x2={26} y2={82} stroke={C.cyan} strokeWidth={1.5} />
          <text x={29} y={85} fontSize={6} fill={C.textMuted} fontFamily="JetBrains Mono">NOI</text>
          <line x1={60} y1={82} x2={76} y2={82} stroke="#a855f7" strokeWidth={1.5} />
          <text x={79} y={85} fontSize={6} fill={C.textMuted} fontFamily="JetBrains Mono">Cap Rate</text>
          <line x1={120} y1={82} x2={136} y2={82} stroke={C.green} strokeWidth={1} strokeDasharray="4,2" />
          <text x={139} y={85} fontSize={6} fill={C.textMuted} fontFamily="JetBrains Mono">RSS</text>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
        {rssBreakdown.map((r, i) => (
          <div key={i} style={{ border: `1px solid ${r.color}30`, borderRadius: 2, padding: '8px 10px', backgroundColor: `${r.color}06` }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 8, marginBottom: 4 }}>{r.label}</div>
            <div style={{ ...mono, color: r.color, fontSize: 18, fontWeight: 700 }}>{r.score}</div>
            <div style={{ color: C.textMuted, fontSize: 8, marginTop: 2 }}>wt {r.weight}</div>
            <div style={{ marginTop: 6, height: 3, background: `${C.border}60`, borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${r.score}%`, backgroundColor: r.color, borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>

      <SectionLabel label="EXIT STRATEGIES" accent={C.cyan} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {exitOptions.map(opt => {
          const isSelected = selectedStrategy === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setSelectedStrategy(opt.id)}
              style={{ border: `1px solid ${isSelected ? opt.color + '60' : C.border}`, borderRadius: 2, padding: '10px 14px', backgroundColor: isSelected ? `${opt.color}08` : 'transparent', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ ...mono, color: isSelected ? opt.color : C.textPrimary, fontSize: 11, fontWeight: 700 }}>{opt.label}</span>
                  <Pill color={opt.color}>{opt.tl}</Pill>
                </div>
                <div style={{ color: C.textMuted, fontSize: 10 }}>{opt.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...mono, color: opt.color, fontSize: 14, fontWeight: 700 }}>{opt.irr}</div>
                <div style={{ ...mono, color: C.textMuted, fontSize: 9 }}>IRR · {opt.em} EM</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SUB_TABS = ['advisor', 'configure', 'sensitivity', 'exit'] as const;
type SubTab = typeof SUB_TABS[number];

const TAB_LABELS: Record<SubTab, string> = {
  advisor: 'ADVISOR',
  configure: 'CONFIGURE',
  sensitivity: 'SENSITIVITY',
  exit: 'EXIT',
};

interface DebtAdvisorSectionProps {
  dealId: string;
}

export function DebtAdvisorSection({ dealId }: DebtAdvisorSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('advisor');
  const { data, loading, error, recompute, refresh } = useDebtAdvisor(dealId);

  return (
    <div style={{ backgroundColor: C.bg, height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"IBM Plex Sans", sans-serif' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, flexShrink: 0 }}>
        <div style={{ display: 'flex' }}>
          {SUB_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...mono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '9px 16px',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${C.cyan}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === tab ? C.cyan : C.textMuted,
                cursor: 'pointer',
                transition: 'color 0.1s',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => recompute()}
          style={{ ...mono, fontSize: 9, padding: '4px 12px', marginRight: 12, backgroundColor: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <RefreshCw size={10} />
          Recompute
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading && <LoadingState />}
        {!loading && error && <ErrorState error={error} onRetry={refresh} />}
        {!loading && !error && data && !data.hasStrategy && <NoStrategyState />}
        {!loading && !error && data && data.hasStrategy && (
          <>
            {activeTab === 'advisor' && (
              <AdvisorTab
                phases={data.recommendedStack}
                alternatives={data.alternatives}
                triggers={data.monitoringTriggers}
                env={data.rateEnvironment}
                narrativeNotes={data.contextModifications.narrativeNotes}
                strategyName={data.strategyInputs.strategyName}
                summary={data.summary}
                onRecompute={recompute}
              />
            )}
            {activeTab === 'configure' && (
              <ConfigureTab phases={data.recommendedStack} />
            )}
            {activeTab === 'sensitivity' && (
              <SensitivityTab />
            )}
            {activeTab === 'exit' && (
              <ExitTab onNavigate={(tab) => setActiveTab(tab)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DebtAdvisorSection;
