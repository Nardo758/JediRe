import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { computeExitReturns } from '../../../shared/calculations/returns';

const C = {
  bg:          '#0a0a0c',
  panel:       '#111114',
  panelAlt:    '#13131a',
  border:      '#1e1e24',
  borderMid:   '#2a2a35',
  cyan:        '#00e5a0',
  amber:       '#f59e0b',
  purple:      '#a78bfa',
  green:       '#22c55e',
  red:         '#ef4444',
  orange:      '#f97316',
  textPrimary: '#e2e8f0',
  textMuted:   '#64748b',
  textSub:     '#94a3b8',
};
const mono: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };

type DealType = 'development' | 'existing' | 'redevelopment';

interface KeyEvent {
  id: string;
  phase: 'past' | 'now' | 'future';
  date: string;
  label: string;
  sublabel?: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  category: 'acquisition' | 'construction' | 'leasing' | 'financing' | 'market' | 'exit';
  complete: boolean;
  isOptimalExit?: boolean;
}

interface ExitWindow {
  rank: number;
  label: 'OPTIMAL' | 'VIABLE' | 'MONITOR' | 'AVOID';
  quarter: string;
  year: number;
  rss: number;
  irr: number;
  em: number;
  strategy: string;
  driverSummary: string;
  riskNote: string;
}

const CATEGORY_COLORS: Record<KeyEvent['category'], string> = {
  acquisition:  C.cyan,
  construction: C.orange,
  leasing:      C.green,
  financing:    C.purple,
  market:       C.amber,
  exit:         C.cyan,
};

const IMPACT_WEIGHT: Record<KeyEvent['impact'], number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

function deriveEvents(dealType: DealType, dealMeta: Record<string, unknown>): KeyEvent[] {
  const now = new Date(2026, 3, 15);
  const acqDate = dealMeta?.acquisitionDate ? new Date(dealMeta.acquisitionDate as string) : new Date(2024, 3, 1);

  function qLabel(d: Date) {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q}'${String(d.getFullYear()).slice(2)}`;
  }
  function addMonths(d: Date, m: number): Date {
    const r = new Date(d);
    r.setMonth(r.getMonth() + m);
    return r;
  }
  function isPast(d: Date) { return d < now; }
  function isNow(d: Date, windowMonths = 2) {
    const delta = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.abs(delta) <= windowMonths;
  }

  const ddClose     = addMonths(acqDate, 1);
  const finClose    = addMonths(acqDate, 2);

  if (dealType === 'existing') {
    const refiWindow  = addMonths(now, 6);
    const optimalExit = addMonths(now, 24);
    const exitB       = addMonths(now, 30);
    return [
      { id: 'acq',       phase: 'past',   date: qLabel(acqDate),  label: 'Property Acquired',       sublabel: 'Asset transfer closed',            impact: 'critical', category: 'acquisition', complete: true },
      { id: 'dd',        phase: 'past',   date: qLabel(ddClose),   label: 'Due Diligence Complete',  sublabel: 'Physical & financial verified',     impact: 'high',     category: 'acquisition', complete: true },
      { id: 'fin',       phase: 'past',   date: qLabel(finClose),  label: 'Financing Closed',        sublabel: 'Senior debt funded',                impact: 'critical', category: 'financing',   complete: true },
      { id: 'capex',     phase: 'past',   date: qLabel(addMonths(acqDate, 4)),  label: 'CapEx Program Started',   sublabel: 'Unit renovation underway',          impact: 'high',     category: 'construction', complete: true },
      { id: 'now-occ',   phase: 'now',    date: 'NOW',             label: 'Active Lease-Up Phase',   sublabel: 'Current occupancy: ~72%',           impact: 'high',     category: 'leasing',     complete: false },
      { id: 'stab',      phase: 'future', date: qLabel(addMonths(now, 3)),  label: 'Stabilization Target',    sublabel: '93%+ occupancy at market rents',    impact: 'critical', category: 'leasing',     complete: false },
      { id: 'refi',      phase: 'future', date: qLabel(refiWindow), label: 'Refi / Rate Lock Window', sublabel: 'Agency refi eligibility opens',     impact: 'high',     category: 'financing',   complete: false },
      { id: 'exit-a',    phase: 'future', date: qLabel(optimalExit), label: 'Primary Exit Window',   sublabel: 'Peak RSS · max buyer demand',       impact: 'critical', category: 'exit',        complete: false, isOptimalExit: true },
      { id: 'exit-b',    phase: 'future', date: qLabel(exitB),     label: 'Secondary Exit Window',   sublabel: 'Viable if market conditions hold',  impact: 'medium',   category: 'exit',        complete: false },
    ];
  }

  if (dealType === 'development') {
    const permitPull  = addMonths(acqDate, 5);
    const constStart  = addMonths(acqDate, 8);
    const coDate      = addMonths(acqDate, 26);
    const leaseUp     = addMonths(coDate, 6);
    const stab        = addMonths(coDate, 12);
    const refi        = addMonths(stab, 6);
    const optExit     = addMonths(stab, 12);
    const exitB       = addMonths(stab, 18);
    return [
      { id: 'acq',       phase: 'past',   date: qLabel(acqDate),   label: 'Site Acquired',           sublabel: 'Land + entitlements transferred',   impact: 'critical', category: 'acquisition', complete: isPast(acqDate) },
      { id: 'dd',        phase: 'past',   date: qLabel(ddClose),   label: 'Due Diligence Complete',  sublabel: 'Environmental & zoning cleared',     impact: 'high',     category: 'acquisition', complete: isPast(ddClose) },
      { id: 'fin',       phase: 'past',   date: qLabel(finClose),  label: 'Construction Loan Closed',sublabel: 'Bridge/construction funding drawn',  impact: 'critical', category: 'financing',   complete: isPast(finClose) },
      { id: 'permit',    phase: isPast(permitPull) ? 'past' : isNow(permitPull) ? 'now' : 'future',   date: qLabel(permitPull), label: 'Permits Pulled',  sublabel: 'Full building permit issued',        impact: 'critical', category: 'construction', complete: isPast(permitPull) },
      { id: 'gnd',       phase: isPast(constStart) ? 'past' : isNow(constStart) ? 'now' : 'future',   date: qLabel(constStart), label: 'Groundbreaking',  sublabel: 'Construction mobilized',            impact: 'high',     category: 'construction', complete: isPast(constStart) },
      { id: 'const-now', phase: isNow(coDate, 8) ? 'now' : isPast(coDate) ? 'past' : 'future',        date: 'NOW',              label: 'Construction In Progress', sublabel: `~${Math.round((now.getTime()-constStart.getTime())/(1000*60*60*24*30))}mo of ~${Math.round((coDate.getTime()-constStart.getTime())/(1000*60*60*24*30))}mo`, impact: 'high', category: 'construction', complete: false },
      { id: 'co',        phase: isPast(coDate) ? 'past' : 'future', date: qLabel(coDate),            label: 'Certificate of Occupancy',sublabel: 'CO issued — leasing begins',        impact: 'critical', category: 'construction', complete: isPast(coDate) },
      { id: 'lease',     phase: 'future', date: qLabel(leaseUp),   label: 'Lease-Up Begins',         sublabel: 'Marketing + concessions phase',      impact: 'high',     category: 'leasing',     complete: false },
      { id: 'stab',      phase: 'future', date: qLabel(stab),      label: 'Stabilization Target',    sublabel: '93%+ at market rents',              impact: 'critical', category: 'leasing',     complete: false },
      { id: 'refi',      phase: 'future', date: qLabel(refi),      label: 'Agency Refi Window',      sublabel: 'Perm loan eligibility opens',        impact: 'high',     category: 'financing',   complete: false },
      { id: 'exit-a',    phase: 'future', date: qLabel(optExit),   label: 'Primary Exit Window',     sublabel: 'Peak RSS · institutional demand',   impact: 'critical', category: 'exit',        complete: false, isOptimalExit: true },
      { id: 'exit-b',    phase: 'future', date: qLabel(exitB),     label: 'Secondary Exit Window',   sublabel: 'Viable with rate path support',     impact: 'medium',   category: 'exit',        complete: false },
    ];
  }

  const constStart  = addMonths(acqDate, 4);
  const coDate      = addMonths(acqDate, 18);
  const stab        = addMonths(coDate, 9);
  const optExit     = addMonths(stab, 9);
  const exitB       = addMonths(stab, 15);
  return [
    { id: 'acq',       phase: 'past',   date: qLabel(acqDate),   label: 'Asset Acquired',          sublabel: 'Vacant/underutilized asset',         impact: 'critical', category: 'acquisition', complete: true },
    { id: 'dd',        phase: 'past',   date: qLabel(ddClose),   label: 'Due Diligence Complete',  sublabel: 'Redevelopment scope defined',        impact: 'high',     category: 'acquisition', complete: true },
    { id: 'fin',       phase: 'past',   date: qLabel(finClose),  label: 'Financing Closed',        sublabel: 'Bridge + mezz stack funded',        impact: 'critical', category: 'financing',   complete: true },
    { id: 'demo',      phase: 'past',   date: qLabel(constStart), label: 'Demo + Repositioning',   sublabel: 'Gut renovation underway',           impact: 'high',     category: 'construction', complete: isPast(constStart) },
    { id: 'now',       phase: 'now',    date: 'NOW',             label: 'Renovation In Progress',  sublabel: 'Partial occupancy maintained',       impact: 'high',     category: 'construction', complete: false },
    { id: 'co',        phase: 'future', date: qLabel(coDate),    label: 'Completion + CO',         sublabel: 'All units repositioned',            impact: 'critical', category: 'construction', complete: false },
    { id: 'stab',      phase: 'future', date: qLabel(stab),      label: 'Stabilization',           sublabel: '93%+ at repositioned rents',        impact: 'critical', category: 'leasing',     complete: false },
    { id: 'exit-a',    phase: 'future', date: qLabel(optExit),   label: 'Primary Exit Window',     sublabel: 'Premium repositioned asset sale',   impact: 'critical', category: 'exit',        complete: false, isOptimalExit: true },
    { id: 'exit-b',    phase: 'future', date: qLabel(exitB),     label: 'Secondary Exit Window',   sublabel: 'Hold for further appreciation',     impact: 'medium',   category: 'exit',        complete: false },
  ];
}

function deriveExitWindows(dealType: DealType, events: KeyEvent[]): ExitWindow[] {
  const optEvent = events.find(e => e.isOptimalExit);
  const secEvent = events.find(e => e.id === 'exit-b');

  const baseIrr = dealType === 'development' ? 19.8 : dealType === 'existing' ? 17.2 : 18.4;
  const baseEm  = dealType === 'development' ? 1.94 : dealType === 'existing' ? 1.72 : 1.83;
  const strategy = dealType === 'development' ? 'Merchant Build Sale' : dealType === 'existing' ? 'Stabilized Asset Sale' : 'Repositioned Asset Sale';

  return [
    {
      rank: 1,
      label: 'OPTIMAL',
      quarter: optEvent?.date ?? 'Q3\'28',
      year: 2028,
      rss: 86,
      irr: baseIrr,
      em: baseEm,
      strategy,
      driverSummary: 'Peak institutional buyer demand · Easing supply pipeline · Rate environment favorable',
      riskNote: 'Dependent on stabilization timeline. Monitor SOFR path.',
    },
    {
      rank: 2,
      label: 'VIABLE',
      quarter: secEvent?.date ?? 'Q1\'29',
      year: 2029,
      rss: 79,
      irr: baseIrr - 1.1,
      em: baseEm - 0.09,
      strategy: 'Refinance & Hold',
      driverSummary: 'Agency refi eligibility · Stable cash yield · Hold for compounding',
      riskNote: 'Rate risk if 10Y Treasury rises >50bps from current.',
    },
    {
      rank: 3,
      label: 'MONITOR',
      quarter: 'Q3\'29',
      year: 2029,
      rss: 64,
      irr: baseIrr - 2.8,
      em: baseEm - 0.21,
      strategy: '1031 Exchange',
      driverSummary: 'Tax-deferred redeployment · MSA rotation opportunity',
      riskNote: 'Market saturation risk. Supply headwinds emerging.',
    },
  ];
}

function rssColor(rss: number): string {
  if (rss >= 80) return C.green;
  if (rss >= 65) return C.cyan;
  if (rss >= 50) return C.amber;
  return C.red;
}

function windowLabelColor(label: ExitWindow['label']): string {
  if (label === 'OPTIMAL') return C.cyan;
  if (label === 'VIABLE')  return C.green;
  if (label === 'MONITOR') return C.amber;
  return C.red;
}

function PhaseLabel({ phase }: { phase: 'past' | 'now' | 'future' }) {
  const cfg = phase === 'past'
    ? { label: 'PAST',   color: C.textMuted }
    : phase === 'now'
      ? { label: 'NOW',  color: C.cyan }
      : { label: 'FUTURE', color: C.amber };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 6px' }}>
      <span style={{ ...mono, fontSize: 8, fontWeight: 700, color: cfg.color, letterSpacing: '0.12em' }}>{cfg.label}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: `${cfg.color}30` }} />
    </div>
  );
}

function EventRow({ event, selected, onClick }: { event: KeyEvent; selected: boolean; onClick: () => void }) {
  const color = CATEGORY_COLORS[event.category];
  const isNowPhase = event.phase === 'now';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px',
        cursor: 'pointer', borderRadius: 2,
        backgroundColor: selected ? `${color}0d` : 'transparent',
        border: selected ? `1px solid ${color}30` : '1px solid transparent',
        transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          backgroundColor: event.complete ? color : 'transparent',
          border: `2px solid ${isNowPhase ? C.cyan : event.complete ? color : C.borderMid}`,
          boxShadow: isNowPhase ? `0 0 6px ${C.cyan}80` : 'none',
        }} />
        <div style={{ width: 1, height: 18, backgroundColor: `${C.borderMid}60`, marginTop: 3 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: event.isOptimalExit ? C.cyan : C.textPrimary }}>
            {event.label}
            {event.isOptimalExit && <span style={{ color: C.cyan }}> ★</span>}
          </span>
          {isNowPhase && (
            <span style={{ ...mono, fontSize: 7, padding: '1px 5px', backgroundColor: `${C.cyan}20`, border: `1px solid ${C.cyan}50`, borderRadius: 2, color: C.cyan }}>ACTIVE</span>
          )}
        </div>
        {event.sublabel && (
          <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.4 }}>{event.sublabel}</div>
        )}
      </div>
      <div style={{ ...mono, fontSize: 9, color: isNowPhase ? C.cyan : C.textMuted, flexShrink: 0, paddingTop: 1 }}>{event.date}</div>
    </div>
  );
}

function ExitWindowCard({ win, selected, onClick }: { win: ExitWindow; selected: boolean; onClick: () => void }) {
  const labelColor = windowLabelColor(win.label);
  const rc = rssColor(win.rss);
  return (
    <div
      onClick={onClick}
      style={{
        padding: '11px 14px', marginBottom: 8, borderRadius: 3,
        border: selected ? `1px solid ${labelColor}60` : `1px solid ${C.border}`,
        backgroundColor: selected ? `${labelColor}08` : C.panelAlt,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '1px 6px', backgroundColor: `${labelColor}20`, border: `1px solid ${labelColor}50`, borderRadius: 2, color: labelColor }}>
              #{win.rank} {win.label}
            </span>
            <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>{win.strategy}</span>
          </div>
          <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: win.label === 'OPTIMAL' ? C.cyan : C.textPrimary }}>{win.quarter}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: rc }}>{win.rss}</div>
          <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>RSS</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <div>
          <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: labelColor }}>{win.irr.toFixed(1)}%</div>
          <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>Est. IRR</div>
        </div>
        <div>
          <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: C.textSub }}>{win.em.toFixed(2)}×</div>
          <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>Est. EM</div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.5, marginBottom: 4 }}>{win.driverSummary}</div>
      {selected && (
        <div style={{ marginTop: 6, padding: '4px 8px', backgroundColor: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 2, fontSize: 9, color: C.amber }}>
          ⚠ {win.riskNote}
        </div>
      )}
    </div>
  );
}

function MarketFactorsPanel({ liveRates }: { liveRates: Record<string, number> | null }) {
  const sofr    = liveRates?.sofr    ?? 5.33;
  const t10     = liveRates?.treasury10Y ?? 4.48;
  const factors = [
    { label: 'Rate Environment', value: sofr < 4.5 ? 'TAILWIND' : sofr < 5.5 ? 'NEUTRAL' : 'HEADWIND', color: sofr < 4.5 ? C.green : sofr < 5.5 ? C.amber : C.red, desc: `SOFR ${sofr.toFixed(2)}%` },
    { label: 'Cap Rate Trend',   value: 'COMPRESSING', color: C.green,  desc: 'Buyer demand outpacing supply' },
    { label: 'Supply Pipeline',  value: 'EASING',      color: C.cyan,   desc: 'New starts declining YoY' },
    { label: '10Y Treasury',     value: t10 < 4.0 ? 'LOW' : t10 < 4.75 ? 'MODERATE' : 'ELEVATED', color: t10 < 4.0 ? C.green : t10 < 4.75 ? C.amber : C.red, desc: `${t10.toFixed(2)}%` },
    { label: 'Buyer Demand',     value: 'STRONG',      color: C.green,  desc: 'Institutional capital active' },
  ];
  return (
    <div style={{ padding: '0 0 8px' }}>
      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>MARKET CONDITIONS</div>
      {factors.map(f => (
        <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}20` }}>
          <div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{f.label}</div>
            <div style={{ fontSize: 8, color: C.textMuted, marginTop: 1 }}>{f.desc}</div>
          </div>
          <span style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '1px 6px', backgroundColor: `${f.color}15`, border: `1px solid ${f.color}40`, borderRadius: 2, color: f.color }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function ExitIntelModule({ dealId, deal, dealType: rawDealType }: Props) {
  const dealType: DealType = (rawDealType === 'development' || rawDealType === 'redevelopment') ? rawDealType : 'existing';
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedWindowRank, setSelectedWindowRank] = useState<number>(1);
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'windows'>('timeline');

  useEffect(() => {
    apiClient.get<{ data: Record<string, number> }>('/capital-structure/rates/live')
      .then(r => setLiveRates(r.data.data))
      .catch(() => null);
  }, []);

  const events = deriveEvents(dealType, (deal ?? {}) as Record<string, unknown>);
  const windows = deriveExitWindows(dealType, events);

  const pastEvents    = events.filter(e => e.phase === 'past');
  const nowEvents     = events.filter(e => e.phase === 'now');
  const futureEvents  = events.filter(e => e.phase === 'future');

  const selectedEvent  = events.find(e => e.id === selectedEventId) ?? null;
  const selectedWindow = windows.find(w => w.rank === selectedWindowRank) ?? windows[0];

  const TABS: Array<{ id: 'timeline' | 'windows'; label: string }> = [
    { id: 'timeline', label: 'EVENT TIMELINE' },
    { id: 'windows',  label: 'EXIT WINDOWS'   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: C.bg, fontFamily: '"IBM Plex Sans", sans-serif' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '5px 14px', backgroundColor: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: 0.8 }}>F8 · EXIT INTEL</span>
        <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>
          {dealType === 'development' ? 'GROUND-UP DEVELOPMENT' : dealType === 'redevelopment' ? 'REDEVELOPMENT' : 'VALUE-ADD / EXISTING'}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'OPTIMAL EXIT', value: windows[0]?.quarter ?? '—', color: C.cyan },
            { label: 'PEAK RSS',     value: String(windows[0]?.rss ?? '—'),    color: rssColor(windows[0]?.rss ?? 0) },
            { label: 'EST. IRR',     value: `${(windows[0]?.irr ?? 0).toFixed(1)}%`, color: C.green },
          ].map(k => (
            <div key={k.label} style={{ textAlign: 'right' }}>
              <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ ...mono, fontSize: 7, color: C.textMuted }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              ...mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent',
              color: activeTab === t.id ? C.cyan : C.textMuted,
              borderBottom: activeTab === t.id ? `2px solid ${C.cyan}` : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EVENT TIMELINE tab ─────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: timeline */}
          <div style={{ width: '55%', borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '8px 12px' }}>
            <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>KEY EVENTS · {dealId.slice(0, 8).toUpperCase()}</div>

            {pastEvents.length > 0 && (
              <>
                <PhaseLabel phase="past" />
                {pastEvents.map(e => (
                  <EventRow key={e.id} event={e} selected={selectedEventId === e.id} onClick={() => setSelectedEventId(e.id === selectedEventId ? null : e.id)} />
                ))}
              </>
            )}
            {nowEvents.length > 0 && (
              <>
                <PhaseLabel phase="now" />
                {nowEvents.map(e => (
                  <EventRow key={e.id} event={e} selected={selectedEventId === e.id} onClick={() => setSelectedEventId(e.id === selectedEventId ? null : e.id)} />
                ))}
              </>
            )}
            {futureEvents.length > 0 && (
              <>
                <PhaseLabel phase="future" />
                {futureEvents.map(e => (
                  <EventRow key={e.id} event={e} selected={selectedEventId === e.id} onClick={() => setSelectedEventId(e.id === selectedEventId ? null : e.id)} />
                ))}
              </>
            )}
          </div>

          {/* Right: event detail + market conditions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {selectedEvent ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>EVENT DETAIL</div>
                <div style={{ padding: '12px 14px', backgroundColor: C.panelAlt, border: `1px solid ${CATEGORY_COLORS[selectedEvent.category]}40`, borderRadius: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: CATEGORY_COLORS[selectedEvent.category] }}>{selectedEvent.label}</span>
                    <span style={{ ...mono, fontSize: 9, color: C.textMuted }}>{selectedEvent.date}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>{selectedEvent.sublabel}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ ...mono, fontSize: 7, padding: '1px 6px', backgroundColor: `${CATEGORY_COLORS[selectedEvent.category]}15`, border: `1px solid ${CATEGORY_COLORS[selectedEvent.category]}40`, borderRadius: 2, color: CATEGORY_COLORS[selectedEvent.category] }}>
                      {selectedEvent.category.toUpperCase()}
                    </span>
                    <span style={{ ...mono, fontSize: 7, padding: '1px 6px', backgroundColor: `${C.amber}10`, border: `1px solid ${C.amber}30`, borderRadius: 2, color: C.amber }}>
                      {selectedEvent.impact.toUpperCase()} IMPACT
                    </span>
                    <span style={{ ...mono, fontSize: 7, padding: '1px 6px', backgroundColor: `${C.borderMid}40`, border: `1px solid ${C.border}`, borderRadius: 2, color: selectedEvent.complete ? C.green : selectedEvent.phase === 'now' ? C.cyan : C.textMuted }}>
                      {selectedEvent.complete ? 'COMPLETE' : selectedEvent.phase === 'now' ? 'IN PROGRESS' : 'PROJECTED'}
                    </span>
                  </div>
                  {selectedEvent.isOptimalExit && (
                    <div style={{ marginTop: 10, padding: '6px 10px', backgroundColor: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 2 }}>
                      <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.cyan, marginBottom: 2 }}>★ OPTIMAL EXIT WINDOW</div>
                      <div style={{ fontSize: 9, color: C.textMuted }}>All key factors converge: peak RSS, institutional buyer demand, favorable rate path, and full stabilization. Platform recommends targeting this window as primary exit.</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '10px 12px', backgroundColor: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 3 }}>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, marginBottom: 2 }}>SELECT AN EVENT</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Click any event on the timeline to see detail, impact assessment, and how it influences the exit window analysis.</div>
              </div>
            )}

            <MarketFactorsPanel liveRates={liveRates} />
          </div>
        </div>
      )}

      {/* ── EXIT WINDOWS tab ───────────────────────────────────────────── */}
      {activeTab === 'windows' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left: ranked exit windows */}
          <div style={{ width: '55%', borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '12px 14px' }}>
            <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>IDENTIFIED EXIT WINDOWS</div>
            {windows.map(w => (
              <ExitWindowCard
                key={w.rank}
                win={w}
                selected={selectedWindowRank === w.rank}
                onClick={() => setSelectedWindowRank(w.rank)}
              />
            ))}
          </div>

          {/* Right: selected window deep-dive + market */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {selectedWindow && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>WINDOW ANALYSIS · #{selectedWindow.rank}</div>
                <div style={{ padding: '12px 14px', backgroundColor: C.panelAlt, border: `1px solid ${windowLabelColor(selectedWindow.label)}40`, borderRadius: 3, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: windowLabelColor(selectedWindow.label) }}>{selectedWindow.quarter}</div>
                      <div style={{ ...mono, fontSize: 9, color: C.textMuted, marginTop: 2 }}>{selectedWindow.strategy}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: rssColor(selectedWindow.rss) }}>{selectedWindow.rss}</div>
                      <div style={{ ...mono, fontSize: 7, color: C.textMuted }}>RSS SCORE</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                    {[
                      { label: 'IRR', value: `${selectedWindow.irr.toFixed(1)}%`, color: windowLabelColor(selectedWindow.label) },
                      { label: 'EM',  value: `${selectedWindow.em.toFixed(2)}×`,   color: C.textSub },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
                        <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>Est. {m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.6 }}>{selectedWindow.driverSummary}</div>
                </div>

                <div style={{ padding: '8px 12px', backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}25`, borderRadius: 3 }}>
                  <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.amber, marginBottom: 3 }}>RISK CONSIDERATIONS</div>
                  <div style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.5 }}>{selectedWindow.riskNote}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>KEY MILESTONES BEFORE THIS WINDOW</div>
                  {events.filter(e => e.phase === 'future' && !e.isOptimalExit || e.phase === 'now').slice(0, 4).map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}20` }}>
                      <span style={{ fontSize: 9, color: C.textMuted }}>{e.label}</span>
                      <span style={{ ...mono, fontSize: 9, color: CATEGORY_COLORS[e.category] }}>{e.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <MarketFactorsPanel liveRates={liveRates} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ExitIntelModule;
