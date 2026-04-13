import { useState } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, TrendingDown, Zap, ChevronDown, ChevronRight } from 'lucide-react';

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

const mono = { fontFamily: '"JetBrains Mono", monospace' };

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

// ─── Strategy Origin Banner ─────────────────────────────────────────────────
function StrategyOrigin() {
  return (
    <div style={{ backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={13} color={C.cyan} />
        <div style={{ flex: 1 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>DEBT STRUCTURE DRIVEN BY M08 STRATEGY DETECTION</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {[
              ['MF VALUE-ADD', C.cyan],
              ['→', C.textMuted],
              ['Reno capex $2.7M', C.textMuted],
              ['·', C.textDim],
              ['Going-in DSCR 0.91 (IO required)', C.red],
              ['·', C.textDim],
              ['Capture Y1 $334K → Y3 $1.16M', C.textMuted],
              ['·', C.textDim],
              ['Stab NOI $2.11M → Fannie eligible M21', C.green],
            ].map(([t, col], i) => (
              <span key={i} style={{ ...mono, color: col as string, fontSize: t === '→' || t === '·' ? 10 : 10, fontWeight: t === 'MF VALUE-ADD' ? 700 : 400 }}>{t}</span>
            ))}
          </div>
        </div>
        <button style={{ ...mono, fontSize: 9, padding: '3px 8px', color: C.cyan, border: `1px solid ${C.cyan}40`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>View Strategy →</button>
      </div>
    </div>
  );
}

// ─── DSCR Recovery Timeline ─────────────────────────────────────────────────
function DSCRTimeline() {
  const cols = [
    { yr: 'Y1', dscr: 0.91, noi: '$1.64M', occ: '89.1%', capture: '$334K', status: 'IO · pre-stab', color: C.red, flag: null },
    { yr: 'Y2', dscr: 1.24, noi: '$1.87M', occ: '92.3%', capture: '$877K', status: 'IO · reno 75%', color: C.amber, flag: null },
    { yr: 'Y3', dscr: 1.47, noi: '$2.11M', occ: '94.2%', capture: '$1.16M', status: 'REFI TRIGGER', color: C.green, flag: '✓' },
    { yr: 'Y4', dscr: 1.62, noi: '$2.35M', occ: '95.1%', capture: '$1.20M', status: 'Stabilized', color: C.green, flag: null },
    { yr: 'Y5', dscr: 1.68, noi: '$2.49M', occ: '95.8%', capture: '$1.20M', status: 'Exit window', color: C.cyan, flag: null },
  ];

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, marginBottom: 14, backgroundColor: C.panelAlt }}>
      <SectionLabel label="DSCR RECOVERY — POWERED BY M08 CAPTURE SCHEDULE" />
      <div style={{ display: 'flex', gap: 0 }}>
        {cols.map((c, i) => (
          <div key={i} style={{ flex: 1, borderRight: i < cols.length - 1 ? `1px solid ${C.border}` : 'none', padding: '0 12px', borderLeft: c.flag ? `2px solid ${C.green}` : 'none' }}>
            {c.flag && <div style={{ ...mono, color: C.green, fontSize: 8, marginBottom: 2 }}>◀ REFI HERE</div>}
            <div style={{ ...mono, color: c.color, fontSize: 18, fontWeight: 700 }}>{c.dscr.toFixed(2)}×</div>
            <div style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700 }}>{c.yr}</div>
            <div style={{ color: C.textMuted, fontSize: 9, marginTop: 3 }}>NOI {c.noi}</div>
            <div style={{ color: C.textMuted, fontSize: 9 }}>Occ {c.occ}</div>
            <div style={{ color: C.cyan, fontSize: 9 }}>Cap {c.capture}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ ...mono, fontSize: 8, color: c.color, backgroundColor: `${c.color}15`, border: `1px solid ${c.color}30`, borderRadius: 2, padding: '1px 4px' }}>{c.status}</span>
            </div>
            {/* DSCR bar */}
            <div style={{ marginTop: 8, height: 36, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '70%', height: `${Math.min((c.dscr / 2) * 100, 100)}%`, backgroundColor: `${c.color}35`, border: `1px solid ${c.color}50`, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <CheckCircle size={11} color={C.green} style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ color: C.textMuted, fontSize: 10 }}>
          Refi trigger: <span style={{ ...mono, color: C.green }}>DSCR {'>'} 1.35 AND Occ {'>'} 92%</span> — first met M21 (Q3 Y2). Bridge extension option exercised as needed. Fannie DUS refi executes M24 as planned. Alert auto-fires from M08 NOI tracker.
        </span>
      </div>
    </div>
  );
}

// ─── Capture → Debt Linkage ──────────────────────────────────────────────────
function CaptureLinkage() {
  const rows = [
    { yr: 'Y1', capture: '$334K', noi: '$1.64M', dscr: '0.91×', ds: '$2.14M (IO)', refi: false, note: 'Bridge IO — DSCR pre-stab. No perm product qualifies at 0.91.' },
    { yr: 'Y2', capture: '$877K', noi: '$1.87M', dscr: '1.24×', ds: '$2.14M (IO)', refi: false, note: 'Reno 75% complete. DSCR climbing. Approaching refi threshold.' },
    { yr: 'Y3', capture: '$1.16M', noi: '$2.11M', dscr: '1.47×', ds: '$1.69M (perm)', refi: true, note: '✓ Fannie DUS refi M24. Debt service drops $450K/yr vs IO bridge.' },
    { yr: 'Y4', capture: '$1.20M', noi: '$2.35M', dscr: '1.62×', ds: '$1.69M', refi: true, note: 'Stabilized. Exit prep. YM prepay est. $640K modeled in waterfall.' },
  ];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>M08 CAPTURE SCHEDULE → DEBT STRUCTURE LOGIC</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: '#0d0d12' }}>
            {['Yr', 'Net Uplift', 'NOI', 'DSCR', 'Annual DS', 'Refi?', 'Rationale'].map(h => (
              <th key={h} style={{ ...mono, textAlign: 'left', padding: '4px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ backgroundColor: r.refi ? `${C.green}06` : 'transparent', borderTop: i > 0 ? `1px solid ${C.border}15` : 'none' }}>
              <td style={{ ...mono, padding: '5px 10px', color: C.textPrimary, fontWeight: 700 }}>{r.yr}</td>
              <td style={{ ...mono, padding: '5px 10px', color: C.cyan }}>{r.capture}</td>
              <td style={{ ...mono, padding: '5px 10px', color: C.textPrimary }}>{r.noi}</td>
              <td style={{ ...mono, padding: '5px 10px', color: r.dscr.startsWith('0') ? C.red : r.dscr.startsWith('1.2') ? C.amber : C.green, fontWeight: 700 }}>{r.dscr}</td>
              <td style={{ ...mono, padding: '5px 10px', color: r.refi ? C.cyan : C.textMuted }}>{r.ds}</td>
              <td style={{ padding: '5px 10px' }}>{r.refi ? <Pill color={C.green}>✓ ELIGIBLE</Pill> : <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>—</span>}</td>
              <td style={{ padding: '5px 10px', color: C.textMuted, fontSize: 10 }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Debt Plan Timeline ──────────────────────────────────────────────────────
function DebtTimeline({ expandedPhase, setExpandedPhase }: { expandedPhase: string | null; setExpandedPhase: (v: string | null) => void }) {
  const pct = (m: number) => `${(m / 36) * 100}%`;
  const phases = [
    { id: 'bridge', label: 'BRIDGE', detail: '$28.5M · SOFR+275 · 3yr+1+1 · IO · 70% LTC', start: 0, end: 24, color: C.orange, row: 0 },
    { id: 'refi', label: 'FANNIE DUS REFI', detail: '$32M · 10yr fixed · 5.1% · 65% LTV', start: 24, end: 36, color: C.cyan, row: 0 },
  ];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, marginBottom: 4, backgroundColor: C.panelAlt }}>
      <SectionLabel label="DEBT PLAN TIMELINE" accent={C.amber} />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        {/* Month axis */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {[0, 6, 12, 18, 24, 30, 36].map(m => (
            <span key={m} style={{ ...mono, color: C.textMuted, fontSize: 9 }}>M{m}</span>
          ))}
        </div>
        {/* Refi trigger line */}
        <div style={{ position: 'absolute', left: pct(24), top: 24, height: 34, width: 1, backgroundColor: `${C.green}70`, borderTop: 'none' }}>
          <span style={{ ...mono, fontSize: 8, color: C.green, position: 'absolute', top: '100%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const }}>REFI TRIGGER M24</span>
        </div>
        {/* Phase bars */}
        <div style={{ position: 'relative', height: 34 }}>
          {phases.map((p) => (
            <div
              key={p.id}
              onClick={() => setExpandedPhase(expandedPhase === p.id ? null : p.id)}
              style={{
                position: 'absolute',
                left: pct(p.start),
                width: `calc(${pct(p.end - p.start)} - 2px)`,
                top: 0,
                height: 28,
                backgroundColor: `${p.color}20`,
                border: `1px solid ${p.color}60`,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ ...mono, color: p.color, fontSize: 10, fontWeight: 700 }}>{p.label}</span>
              <span style={{ color: C.textMuted, fontSize: 9 }}>· {p.detail}</span>
              {expandedPhase === p.id ? <ChevronDown size={10} color={p.color} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={10} color={C.textMuted} style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bridge Detail ───────────────────────────────────────────────────────────
function BridgeDetail() {
  return (
    <div style={{ border: `1px solid ${C.orange}40`, borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ backgroundColor: `${C.orange}10`, padding: '8px 14px', borderBottom: `1px solid ${C.orange}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ChevronDown size={12} color={C.orange} />
        <span style={{ ...mono, color: C.orange, fontSize: 11, fontWeight: 700 }}>Bridge-to-Perm Bridge · M0–M24</span>
        <span style={{ color: C.textMuted, fontSize: 10 }}>Why: Going-in DSCR 0.91 disqualifies all perm products. IO preserves cash during reno. Open prepay for clean refi at stabilization.</span>
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 7, padding: 14, borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { section: 'SIZING', rows: [['Loan Amount', '$28.5M'], ['LTV', '70%'], ['LTC (incl reno)', '70%'], ['DSCR Y1 (IO)', '0.91 — pre-stab'], ['Debt Yield', '5.7%']] },
              { section: 'PRICING', rows: [['Type', 'Floating · SOFR + 275bps'], ['All-in today', '~8.25%'], ['Rate Cap', '4.5% strike · 2yr · $380K'], ['Cap renewal M24', '~$180K — budget now']] },
              { section: 'STRUCTURE', rows: [['Term', '3yr + 1yr + 1yr extensions'], ['Amortization', 'Full IO'], ['Extension fee', '50bps per extension'], ['Prepay', 'Open — no yield-maintenance']] },
              { section: 'ALL-IN FEES', rows: [['Origination 1.5%', '$427K'], ['Exit fee 0.5%', '$142K'], ['Rate cap', '$380K'], ['Total close costs', '$949K']] },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>{s.section}</div>
                {s.rows.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}25`, padding: '3px 0' }}>
                    <span style={{ color: C.textMuted, fontSize: 10 }}>{k}</span>
                    <span style={{ ...mono, color: C.textPrimary, fontSize: 10, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', backgroundColor: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            <CheckCircle size={11} color={C.green} />
            <span style={{ color: C.textMuted, fontSize: 10 }}>
              Refi window: <span style={{ ...mono, color: C.green }}>Occ {'>'} 92% AND DSCR {'>'} 1.35</span> → projected M21 per M08 capture schedule. Alert fires automatically from M08 NOI tracker.
            </span>
          </div>
        </div>
        <div style={{ flex: 3, padding: 14, backgroundColor: C.bg }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>LENDER TARGETS</div>
          {[
            { name: 'Acore Capital', deals: '6 deals YTD', pricing: 'SOFR+290', fit: 94, fitColor: C.green, note: 'Non-recourse · Fast close · Rec.' },
            { name: 'Square Mile Capital', deals: '4 deals', pricing: 'SOFR+325', fit: 78, fitColor: C.cyan, note: 'Higher spread · Flexible extensions' },
            { name: 'Bank OZK', deals: '8 deals', pricing: 'SOFR+275', fit: 71, fitColor: C.amber, note: '⚠ Partial recourse required' },
          ].map((l, i) => (
            <div key={i} style={{ border: `1px solid ${i === 0 ? C.green + '50' : C.border}`, backgroundColor: i === 0 ? `${C.green}08` : 'transparent', borderRadius: 2, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: C.textPrimary, fontSize: 11, fontWeight: 600 }}>{l.name}</span>
                <span style={{ ...mono, color: l.fitColor, fontSize: 11, fontWeight: 700 }}>fit {l.fit}%</span>
              </div>
              <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 2 }}>{l.deals} · {l.pricing}</div>
              <div style={{ color: C.textMuted, fontSize: 9 }}>{l.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Market Context (right rail) ─────────────────────────────────────────────
function MarketContext() {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, backgroundColor: C.bg }}>
      <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>MARKET CONTEXT</div>
      {[
        { label: '10yr Treasury', value: '4.21%', sub: '−8bps today', color: C.green },
        { label: 'SOFR', value: '4.95%', sub: '−60bps projected 12mo', color: C.cyan },
        { label: 'RSS Score', value: '67/100', sub: 'Favorable for bridge', color: C.cyan },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}30`, padding: '6px 0' }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>{r.label}</span>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <TrendingDown size={10} color={r.color} />
              <span style={{ ...mono, color: r.color, fontSize: 12, fontWeight: 700 }}>{r.value}</span>
            </div>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9 }}>{r.sub}</div>
          </div>
        </div>
      ))}
      {/* Forward curve sparkline */}
      <div style={{ marginTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 4 }}>SOFR FORWARD CURVE</div>
        <svg width="100%" height={32} viewBox="0 0 200 32">
          <defs>
            <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cyan} stopOpacity="0.3" />
              <stop offset="100%" stopColor={C.cyan} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polyline points="0,26 40,24 80,20 120,14 160,9 200,5" fill="none" stroke={C.cyan} strokeWidth={1.5} />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['Now', '6mo', '12mo', '18mo', '24mo'].map(l => (
            <span key={l} style={{ ...mono, color: C.textMuted, fontSize: 8 }}>{l}</span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10, backgroundColor: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 2, padding: '6px 8px' }}>
        <div style={{ ...mono, color: C.green, fontSize: 10, fontWeight: 700 }}>PRICING WINDOW: FAVORABLE</div>
        <div style={{ color: C.textMuted, fontSize: 9, marginTop: 2 }}>Forward curve supports floating bridge + rate cap today. Lock fixed perm at refi M24 when SOFR lower.</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>ACTIVE COR SIGNALS</div>
        {[['COR-08', 'Permit velocity +42%', C.amber], ['COR-01', 'Traffic surge active', C.cyan]].map(([id, label, col]) => (
          <div key={id as string} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
            <span style={{ ...mono, fontSize: 9, color: col as string }}>↗ {id}</span>
            <span style={{ color: C.textMuted, fontSize: 9 }}>{label as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Alternatives ─────────────────────────────────────────────────────────────
function Alternatives() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
      {[
        {
          title: 'Zero Rate Risk',
          sub: '3yr Fixed Bridge + Fixed Agency Refi',
          rows: [['Bridge rate', '6.5% fixed (today)'], ['Rate cap', 'Not needed — saves $380K'], ['Y1 annual DS', '$2.33M vs $2.14M floating IO'], ['IRR impact', '−0.3% (loses floating benefit if SOFR drops)']],
          tradeoff: 'Eliminates rate cap cost. Sacrifices expected ~$420K floating savings if SOFR declines 60bps as projected.',
          color: C.textMuted,
        },
        {
          title: 'Higher Leverage',
          sub: 'Add 10% Mezz at 13% pay+PIK',
          rows: [['Senior bridge', '$28.5M · SOFR+275'], ['Mezz', '$4.5M · 13% (7% pay + 6% PIK)'], ['Blended all-in', '~9.8%'], ['IRR impact', '+1.1% (more equity deployed)']],
          tradeoff: 'Mezz adds execution risk (intercreditor, review). Higher coupon drag in IO period. Best if equity redeployed to parallel deal.',
          color: C.purple,
        },
      ].map((a, i) => (
        <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 12 }}>
          <div style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{a.title}</div>
          <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 10 }}>{a.sub}</div>
          {a.rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}20`, padding: '3px 0' }}>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{k}</span>
              <span style={{ ...mono, color: C.textPrimary, fontSize: 10 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, color: C.textMuted, fontSize: 9, fontStyle: 'italic' }}>{a.tradeoff}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Monitoring Triggers ─────────────────────────────────────────────────────
function MonitoringTriggers() {
  const triggers = [
    { warn: false, label: 'M21 Refi Window', cond: 'Occ > 92% AND DSCR > 1.35 → agency refi eligible', current: 'Occ 89.1% · DSCR 0.91 — not yet', note: 'Monitor monthly from M08 NOI tracker.' },
    { warn: true, label: 'Rate Cap Renewal', cond: 'Cap expires M24 — replacement at same strike ~$180K', current: '⚠ Order at M21 — 90-day lead time', note: 'Budget in reserves now. Do not miss renewal window.' },
    { warn: false, label: 'COR-08 Permit Velocity', cond: 'If velocity breaks 60% → shorten exit → early refi to long fixed', current: 'Currently 42% — below 60% threshold', note: 'Auto-trigger from M14 permit tracker.' },
  ];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>MONITORING TRIGGERS</span>
      </div>
      {triggers.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < triggers.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: t.warn ? `${C.amber}06` : 'transparent', alignItems: 'flex-start' }}>
          <div style={{ marginTop: 1, flexShrink: 0 }}>
            {t.warn ? <AlertTriangle size={12} color={C.amber} /> : <CheckCircle size={12} color={C.green} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 2 }}>
              <span style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 600 }}>{t.label}</span>
              <span style={{ ...mono, color: t.warn ? C.amber : C.textMuted, fontSize: 9 }}>{t.current}</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 10 }}>{t.cond}</div>
            <div style={{ color: C.textDim, fontSize: 9, marginTop: 1 }}>{t.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Configure Tab (incorporates F6 Debt loan builder) ───────────────────────
function ConfigureTab() {
  const [activeLoan, setActiveLoan] = useState<'bridge' | 'refi'>('bridge');
  const PRESETS = ['Bridge', 'Agency', 'FannieDUS', 'CMBS', 'HUD', 'LifeCo', 'Mezz'];

  const bridgeFields = [
    { label: 'Loan Amount', value: '$28,500,000', sub: '70% LTC', editable: true },
    { label: 'Rate Type', value: 'Floating', sub: 'SOFR + Spread', editable: false },
    { label: 'SOFR (today)', value: '4.95%', sub: 'forward curve active', editable: true },
    { label: 'Spread', value: '2.75%', sub: 'bps above SOFR', editable: true },
    { label: 'All-in Rate', value: '7.70%', sub: 'at today SOFR', editable: false },
    { label: 'Term', value: '3yr + 1yr + 1yr', sub: '3 + 2 extensions', editable: true },
    { label: 'Amortization', value: 'Full IO', sub: '36mo interest-only', editable: true },
    { label: 'IO Period', value: '36mo', sub: 'full term', editable: true },
    { label: 'Rate Cap Strike', value: '4.50%', sub: 'SOFR cap · $380K premium', editable: true },
    { label: 'Origination Fee', value: '1.50%', sub: '$427,500', editable: true },
    { label: 'Exit Fee', value: '0.50%', sub: '$142,500', editable: true },
    { label: 'Prepay', value: 'Open', sub: 'no yield-maintenance', editable: false },
    { label: 'Min DSCR', value: '1.15×', sub: 'covenant floor', editable: true },
    { label: 'Max LTV', value: '80%', sub: 'covenant ceiling', editable: true },
    { label: 'Extension Fee', value: '0.50%', sub: 'per extension', editable: true },
  ];

  const refiFields = [
    { label: 'Loan Amount', value: '$32,000,000', sub: '65% LTV at stab', editable: true },
    { label: 'Rate Type', value: 'Fixed', sub: '10-year term', editable: false },
    { label: 'Rate', value: '5.10%', sub: '10yr Treasury + 89bps', editable: true },
    { label: 'Term', value: '10yr', sub: 'fixed-rate period', editable: true },
    { label: 'Amortization', value: '30yr', sub: 'standard DUS', editable: false },
    { label: 'IO Period', value: '24mo', sub: 'DUS allows partial IO', editable: true },
    { label: 'Origination Fee', value: '1.00%', sub: '$320,000', editable: false },
    { label: 'Prepay', value: 'Yield Maintenance', sub: '~$640K at M36 exit', editable: false },
    { label: 'Min DSCR', value: '1.25×', sub: 'DUS underwriting floor', editable: false },
    { label: 'Max LTV', value: '80%', sub: 'DUS maximum', editable: false },
    { label: 'Eligible At', value: 'M21 (Q3 Y2)', sub: 'DSCR > 1.35 + Occ > 92%', editable: false },
    { label: 'Stabilized NOI', value: '$2,110,000', sub: 'required at refi', editable: false },
  ];

  const fields = activeLoan === 'bridge' ? bridgeFields : refiFields;

  const amortRows = [
    { yr: 'Y1', openBal: '$28.50M', interest: '$2.14M', principal: '$0', ds: '$2.14M', noi: '$1.64M', dscr: '0.91×', breach: true },
    { yr: 'Y2', openBal: '$28.50M', interest: '$2.14M', principal: '$0', ds: '$2.14M', noi: '$1.87M', dscr: '1.24×', breach: false },
    { yr: 'Y3', openBal: '$32.00M', interest: '$1.63M', principal: '$0.07M', ds: '$1.69M', noi: '$2.11M', dscr: '1.47×', breach: false },
    { yr: 'Y4', openBal: '$31.93M', interest: '$1.63M', principal: '$0.07M', ds: '$1.69M', noi: '$2.35M', dscr: '1.62×', breach: false },
  ];

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      {/* Left — loan selector + fields */}
      <div style={{ flex: 1, padding: '14px 20px', overflowY: 'auto' as const }}>
        {/* Pre-populated banner */}
        <div style={{ backgroundColor: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '7px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={12} color={C.cyan} />
          <span style={{ color: C.textMuted, fontSize: 10 }}>Pre-populated from Advisor recommendation — <span style={{ ...mono, color: C.cyan }}>Bridge-to-Perm + Fannie DUS Refi</span></span>
          <button style={{ ...mono, fontSize: 9, marginLeft: 'auto' as const, padding: '2px 8px', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer' }}>Clear All</button>
        </div>

        {/* Loan type preset row */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>LOAN TYPE PRESETS</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
            {PRESETS.map(p => (
              <button key={p} style={{ ...mono, fontSize: 9, padding: '4px 10px', cursor: 'pointer', backgroundColor: (p === 'Bridge' && activeLoan === 'bridge') || (p === 'FannieDUS' && activeLoan === 'refi') ? `${C.cyan}15` : 'transparent', color: (p === 'Bridge' && activeLoan === 'bridge') || (p === 'FannieDUS' && activeLoan === 'refi') ? C.cyan : C.textMuted, border: `1px solid ${(p === 'Bridge' && activeLoan === 'bridge') || (p === 'FannieDUS' && activeLoan === 'refi') ? C.cyan + '50' : C.border}`, borderRadius: 2 }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Loan card toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {([['bridge', 'Senior Bridge · $28.5M · SOFR+275 · IO'], ['refi', 'Fannie DUS Refi · $32M · 5.1% fixed · M24']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveLoan(id as 'bridge' | 'refi')} style={{ flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', backgroundColor: activeLoan === id ? `${C.amber}15` : C.panelAlt, color: activeLoan === id ? C.amber : C.textMuted, textAlign: 'left' as const, borderRight: id === 'bridge' ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ ...mono, fontSize: 10, fontWeight: activeLoan === id ? 700 : 400 }}>{label}</div>
            </button>
          ))}
        </div>

        {/* Loan fields */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#0d0d12' }}>
                {['Field', 'Value', 'Sub', 'Editable'].map(h => (
                  <th key={h} style={{ ...mono, textAlign: 'left', padding: '4px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : `${C.border}15` }}>
                  <td style={{ padding: '4px 10px', color: C.textMuted, fontSize: 10 }}>{f.label}</td>
                  <td style={{ ...mono, padding: '4px 10px', color: f.editable ? C.textPrimary : C.textMuted, fontWeight: f.editable ? 600 : 400, fontSize: 11 }}>{f.value}</td>
                  <td style={{ padding: '4px 10px', color: C.textMuted, fontSize: 9 }}>{f.sub}</td>
                  <td style={{ padding: '4px 10px', textAlign: 'center' as const }}>
                    {f.editable ? <span style={{ ...mono, fontSize: 9, color: C.cyan }}>✎</span> : <span style={{ ...mono, fontSize: 9, color: C.textMuted }}>🔒</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Annual amortization summary */}
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>ANNUAL AMORTIZATION SUMMARY (Y1-Y4)</div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#0d0d12' }}>
                {['Yr', 'Open Bal', 'Interest', 'Principal', 'Total DS', 'NOI', 'DSCR', 'Status'].map(h => (
                  <th key={h} style={{ ...mono, textAlign: h === 'Yr' ? 'left' : 'right', padding: '4px 10px', color: C.textMuted, fontSize: 9, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amortRows.map((r, i) => (
                <tr key={i} style={{ backgroundColor: r.breach ? `${C.red}06` : i % 2 === 0 ? 'transparent' : `${C.border}15` }}>
                  <td style={{ ...mono, padding: '4px 10px', color: C.textPrimary, fontWeight: 700 }}>{r.yr}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: C.textMuted }}>{r.openBal}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: C.textMuted }}>{r.interest}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: C.textMuted }}>{r.principal}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: C.orange }}>{r.ds}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: C.textPrimary }}>{r.noi}</td>
                  <td style={{ ...mono, textAlign: 'right' as const, padding: '4px 10px', color: r.breach ? C.red : r.dscr.startsWith('1.2') ? C.amber : C.green, fontWeight: 700 }}>{r.dscr}</td>
                  <td style={{ textAlign: 'right' as const, padding: '4px 10px' }}>
                    {r.breach ? <span style={{ ...mono, fontSize: 8, color: C.red }}>⚠ IO REQUIRED</span> : <span style={{ ...mono, fontSize: 8, color: C.green }}>✓ COVENANT OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...mono, fontSize: 10, padding: '7px 16px', backgroundColor: C.cyan, color: '#0a0a0c', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700 }}>Lock to ProForma →</button>
          <button style={{ ...mono, fontSize: 10, padding: '7px 14px', backgroundColor: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, cursor: 'pointer' }}>Export Term Sheet</button>
          <button style={{ ...mono, fontSize: 10, padding: '7px 14px', backgroundColor: 'transparent', color: C.purple, border: `1px solid ${C.purple}40`, borderRadius: 2, cursor: 'pointer' }}>Add Mezz Tranche</button>
        </div>
      </div>

      {/* Right rail — SOFR curve editor */}
      <div style={{ width: 220, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 10 }}>SOFR FORWARD CURVE</div>
        {[['Now', '4.95%'], ['6mo', '4.70%'], ['12mo', '4.45%'], ['18mo', '4.20%'], ['24mo', '4.00%']].map(([t, v]) => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}20`, padding: '5px 0' }}>
            <span style={{ color: C.textMuted, fontSize: 10 }}>{t}</span>
            <span style={{ ...mono, color: C.cyan, fontSize: 11, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 4 }}>RATE CAP</div>
          {[['Strike', '4.50%'], ['Premium', '$380,000'], ['Renewal M24', '$180,000'], ['Provider', 'Chatham Fin.']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}15`, padding: '4px 0' }}>
              <span style={{ color: C.textMuted, fontSize: 10 }}>{k}</span>
              <span style={{ ...mono, color: C.textPrimary, fontSize: 10 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 6 }}>LOAN STACK TOTAL</div>
          {[['Senior Bridge', '$28.5M', C.orange], ['Mezz (optional)', '+ $4.5M', C.purple], ['Total Debt', '$28.5M', C.textPrimary], ['Equity At Close', '$14.3M', C.cyan], ['Blended LTC', '70%', C.amber]].map(([k, v, col]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: C.textMuted, fontSize: 9 }}>{k}</span>
              <span style={{ ...mono, color: col as string, fontSize: 10, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sensitivity Tab (incorporates F8 + debt-specific heatmaps) ───────────────
function SensitivityTabContent() {
  const [activeTable, setActiveTable] = useState<'irr' | 'em' | 'dscr' | 'leverage'>('irr');

  const EXIT_CAPS = [4.0, 4.5, 5.0, 5.25, 5.5, 6.0, 6.5];
  const RENT_GROWTH = [1.0, 2.0, 3.0, 4.0, 5.0];
  const HOLD_PERIODS = [3, 5, 7, 10];
  const SPREADS = [200, 250, 275, 300, 350]; // bps over SOFR
  const NOI_GROWTH = [0, 5, 10, 15, 20]; // % capture
  const LTVS = [60, 65, 70, 75, 80];

  // Static IRR heatmap (Exit Cap × Rent Growth)
  const irrGrid: Record<number, number[]> = {
    4.0: [26.1, 28.4, 30.8, 33.1, 35.4],
    4.5: [22.8, 25.0, 27.2, 29.4, 31.7],
    5.0: [19.8, 21.9, 24.0, 26.1, 28.2],
    5.25: [18.4, 20.4, 22.4, 24.4, 26.5],
    5.5: [17.1, 19.0, 21.0, 22.9, 24.9],
    6.0: [14.8, 16.7, 18.5, 20.4, 22.3],
    6.5: [12.7, 14.5, 16.2, 18.0, 19.8],
  };

  // Static EM heatmap (Exit Cap × Hold Period)
  const emGrid: Record<number, number[]> = {
    4.0: [1.92, 2.61, 3.42, 5.31],
    4.5: [1.78, 2.36, 3.04, 4.62],
    5.0: [1.65, 2.14, 2.72, 4.04],
    5.25: [1.59, 2.04, 2.57, 3.78],
    5.5: [1.53, 1.95, 2.44, 3.54],
    6.0: [1.42, 1.78, 2.20, 3.12],
    6.5: [1.32, 1.62, 1.98, 2.74],
  };

  // DSCR heatmap (SOFR Spread × NOI Growth/Capture %)
  const dscrGrid: Record<number, number[]> = {
    200: [0.98, 1.05, 1.13, 1.20, 1.28],
    250: [0.94, 1.01, 1.08, 1.15, 1.23],
    275: [0.91, 0.98, 1.06, 1.13, 1.20],
    300: [0.89, 0.96, 1.03, 1.10, 1.17],
    350: [0.84, 0.91, 0.98, 1.05, 1.12],
  };

  // Leverage heatmap (LP IRR × LTV × Exit Cap)
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

  const isCurrentCell = (row: number, col: number, tableId: string) => {
    if (tableId === 'irr') return row === 5.25 && col === 4.0; // exit cap 5.25, RG 4%
    if (tableId === 'em') return row === 5.25 && col === 3; // exit cap 5.25, hold 3yr
    if (tableId === 'dscr') return row === 275 && col === 0; // spread 275, 0% capture (Y1)
    if (tableId === 'leverage') return row === 5.25 && col === 70; // exit cap 5.25, 70% LTV
    return false;
  };

  return (
    <div style={{ padding: '14px 20px', overflowY: 'auto' as const, flex: 1 }}>
      {/* Current position banner */}
      <div style={{ backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '7px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700 }}>CURRENT POSITION</span>
        {[['Exit Cap', '5.25%'], ['Rent Growth', '4.0%'], ['Hold', '3yr'], ['LTV', '70%'], ['Spread', 'SOFR+275'], ['LP IRR', '19.3%'], ['EM', '1.92×']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 4 }}>
            <span style={{ color: C.textMuted, fontSize: 9 }}>{k}:</span>
            <span style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        <span style={{ ...mono, color: C.textMuted, fontSize: 9, marginLeft: 4 }}>↓ highlighted in each table</span>
      </div>

      {/* Table selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' as const }}>
        {tables.map(t => (
          <button key={t.id} onClick={() => setActiveTable(t.id)} style={{ ...mono, fontSize: 9, padding: '4px 12px', cursor: 'pointer', backgroundColor: activeTable === t.id ? `${C.purple}15` : 'transparent', color: activeTable === t.id ? C.purple : C.textMuted, border: `1px solid ${activeTable === t.id ? C.purple + '50' : C.border}`, borderRadius: 2 }}>
            {t.label} <span style={{ color: C.textMuted, fontSize: 8 }}>· {t.badge}</span>
          </button>
        ))}
      </div>

      {/* Heatmap legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ ...mono, color: C.textMuted, fontSize: 8 }}>HEATMAP:</span>
        {activeTable === 'dscr' ? (
          <><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.green }}>■</span> DSCR ≥1.35 (refi-ready)</span><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.amber }}>■</span> 1.15-1.35</span><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.red }}>■</span> {'<'}1.15 (IO required)</span></>
        ) : (
          <><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.green }}>■</span> {activeTable === 'em' ? '≥2.5× EM' : '≥20% IRR'}</span><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.amber }}>■</span> {activeTable === 'em' ? '1.8-2.5×' : '12-20%'}</span><span style={{ ...mono, fontSize: 8 }}><span style={{ color: C.red }}>■</span> {activeTable === 'em' ? '<1.8×' : '<12%'}</span></>
        )}
        <span style={{ ...mono, color: C.amber, fontSize: 8, marginLeft: 4 }}>▶ Current deal position</span>
      </div>

      {/* IRR table */}
      {activeTable === 'irr' && (
        <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
              <th style={{ padding: '5px 10px', color: C.textMuted, textAlign: 'left' as const, fontWeight: 500 }}>EXIT CAP ↓ \ RG →</th>
              {RENT_GROWTH.map(g => <th key={g} style={{ padding: '5px 12px', color: C.cyan, textAlign: 'center' as const, fontWeight: 500 }}>{g.toFixed(1)}%</th>)}
            </tr>
          </thead>
          <tbody>
            {EXIT_CAPS.map(cap => (
              <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '4px 10px', color: C.amber, fontWeight: 600 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                {RENT_GROWTH.map((g, ci) => {
                  const v = irrGrid[cap]?.[ci] ?? 0;
                  const isCurrent = cap === 5.25 && ci === 3;
                  return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center' as const, fontWeight: 700, color: irrColor(v), background: isCurrent ? `${C.amber}25` : `${irrColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(1)}%</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* EM table */}
      {activeTable === 'em' && (
        <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
              <th style={{ padding: '5px 10px', color: C.textMuted, textAlign: 'left' as const, fontWeight: 500 }}>EXIT CAP ↓ \ HOLD →</th>
              {HOLD_PERIODS.map(h => <th key={h} style={{ padding: '5px 14px', color: C.cyan, textAlign: 'center' as const, fontWeight: 500 }}>{h}yr</th>)}
            </tr>
          </thead>
          <tbody>
            {EXIT_CAPS.map(cap => (
              <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '4px 10px', color: C.amber, fontWeight: 600 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                {HOLD_PERIODS.map((h, ci) => {
                  const v = emGrid[cap]?.[ci] ?? 0;
                  const isCurrent = cap === 5.25 && h === 3;
                  return <td key={ci} style={{ padding: '5px 14px', textAlign: 'center' as const, fontWeight: 700, color: emColor(v), background: isCurrent ? `${C.amber}25` : `${emColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(2)}×</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* DSCR table — debt-specific */}
      {activeTable === 'dscr' && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 8 }}>DSCR Y1 by <span style={{ ...mono, color: C.orange }}>Bridge Spread</span> (rows) × <span style={{ ...mono, color: C.cyan }}>NOI Capture %</span> (columns) · SOFR 4.95% constant</div>
          <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
                <th style={{ padding: '5px 10px', color: C.textMuted, textAlign: 'left' as const, fontWeight: 500 }}>SPREAD ↓ \ CAPTURE →</th>
                {NOI_GROWTH.map(g => <th key={g} style={{ padding: '5px 12px', color: C.cyan, textAlign: 'center' as const, fontWeight: 500 }}>+{g}%</th>)}
              </tr>
            </thead>
            <tbody>
              {SPREADS.map(s => (
                <tr key={s} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '4px 10px', color: C.orange, fontWeight: 600 }}>+{s}bps{s === 275 ? ' ◀' : ''}</td>
                  {NOI_GROWTH.map((g, ci) => {
                    const v = dscrGrid[s]?.[ci] ?? 0;
                    const isCurrent = s === 275 && ci === 0;
                    return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center' as const, fontWeight: 700, color: dscrColor(v), background: isCurrent ? `${C.amber}25` : `${dscrColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(2)}×</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: '7px 10px', backgroundColor: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 2, fontSize: 10, color: C.textMuted }}>
            Refi eligible (DSCR {'>'} 1.35) at current spread +275bps: requires ~15% NOI capture — achievable by <span style={{ ...mono, color: C.green }}>M18 at 75% VC capture</span>. Aligned with M08 capture schedule.
          </div>
        </div>
      )}

      {/* Leverage table */}
      {activeTable === 'leverage' && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 10, marginBottom: 8 }}>LP IRR by <span style={{ ...mono, color: C.amber }}>Exit Cap</span> (rows) × <span style={{ ...mono, color: C.cyan }}>Senior LTV</span> (columns) · Rent growth 4.0% · Hold 3yr</div>
          <table style={{ borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderMid}` }}>
                <th style={{ padding: '5px 10px', color: C.textMuted, textAlign: 'left' as const, fontWeight: 500 }}>EXIT CAP ↓ \ LTV →</th>
                {LTVS.map(l => <th key={l} style={{ padding: '5px 12px', color: C.cyan, textAlign: 'center' as const, fontWeight: 500 }}>{l}%</th>)}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map(cap => (
                <tr key={cap} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '4px 10px', color: C.amber, fontWeight: 600 }}>{cap.toFixed(2)}%{cap === 5.25 ? ' ◀' : ''}</td>
                  {LTVS.map((ltv, ci) => {
                    const v = leverageGrid[cap]?.[ci] ?? 0;
                    const isCurrent = cap === 5.25 && ltv === 70;
                    return <td key={ci} style={{ padding: '5px 12px', textAlign: 'center' as const, fontWeight: 700, color: levColor(v), background: isCurrent ? `${C.amber}25` : `${levColor(v)}08`, border: isCurrent ? `2px solid ${C.amber}` : 'none' }}>{v.toFixed(1)}%</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: '7px 10px', backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, fontSize: 10, color: C.textMuted }}>
            At 70% LTV and 5.25% exit cap: <span style={{ ...mono, color: C.cyan }}>19.2% LP IRR</span>. Adding 5% mezz (+$4.5M to 81% LTV): projected +1.1% IRR to ~20.3% — but mezz execution risk applies.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DebtAdvisorTab() {
  const [activeTab, setActiveTab] = useState<'advisor' | 'configure' | 'sensitivity'>('advisor');
  const [expandedPhase, setExpandedPhase] = useState<string | null>('bridge');

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.textPrimary, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12 }}>
      {/* Header */}
      <div style={{ padding: '8px 20px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ marginRight: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' }}>DEBT INTELLIGENCE</span>
            <span style={{ ...mono, fontSize: 8, color: C.cyan, backgroundColor: `${C.cyan}15`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '1px 5px' }}>PRIMARY</span>
          </div>
          {([
            { id: 'advisor' as const, label: 'ADVISOR', desc: 'AI strategy-driven recommendation' },
            { id: 'configure' as const, label: 'CONFIGURE', desc: 'Loan builder · F6 Debt' },
            { id: 'sensitivity' as const, label: 'SENSITIVITY', desc: 'Heatmaps · F8 + debt axes' },
          ]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} title={t.desc} style={{ ...mono, fontSize: 11, padding: '6px 14px', cursor: 'pointer', backgroundColor: 'transparent', color: activeTab === t.id ? C.cyan : C.textMuted, border: 'none', borderBottom: `2px solid ${activeTab === t.id ? C.cyan : 'transparent'}`, fontWeight: activeTab === t.id ? 700 : 400, letterSpacing: '0.08em' }}>
              [ {t.label} ]
            </button>
          ))}
        </div>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>LAST COMPUTED: 10:42 AM EST · Source: M08 strategy output · Replaces F6 + F8</span>
      </div>

      {/* ADVISOR tab */}
      {activeTab === 'advisor' && (
        <div style={{ display: 'flex', gap: 0 }}>
          <div style={{ flex: 1, padding: '14px 20px', overflowY: 'auto' as const }}>
            <StrategyOrigin />
            {/* Recommendation Header */}
            <div style={{ borderLeft: `3px solid ${C.cyan}`, border: `1px solid ${C.border}`, backgroundColor: C.panel, padding: '12px 16px', marginBottom: 14, borderRadius: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Pill color={C.amber}>RECOMMENDED</Pill>
                    <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: C.textPrimary }}>Bridge-to-Perm + Fannie DUS Refi</span>
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 10 }}>
                    MF Value-Add: going-in DSCR 0.91 → must use IO bridge. Rate environment dropping 60bps → floating wins vs fixed today. Refi to fixed agency when DSCR {'>'} 1.35 at stabilization M24.
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
                    {[['Bridge close', '$28.5M · SOFR+275 · 3yr IO'], ['Close costs', '$949K all-in'], ['Refi', '$32M · 5.1% · Fannie DUS M24'], ['LP IRR', '18.4–21.7%']].map(([l, v]) => (
                      <div key={l as string}><div style={{ color: C.textMuted, fontSize: 9 }}>{l}</div><div style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 600 }}>{v}</div></div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0, flexDirection: 'column' as const }}>
                  <button onClick={() => setActiveTab('configure')} style={{ ...mono, fontSize: 10, padding: '6px 12px', backgroundColor: C.cyan, color: '#0a0a0c', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' as const }}>Accept → Configure tab</button>
                  <button onClick={() => setActiveTab('sensitivity')} style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: 'transparent', color: C.purple, border: `1px solid ${C.purple}40`, borderRadius: 2, cursor: 'pointer' }}>Sensitivity →</button>
                  <button style={{ ...mono, fontSize: 10, padding: '5px 10px', backgroundColor: 'transparent', color: C.cyan, border: `1px solid ${C.cyan}40`, borderRadius: 2, cursor: 'pointer' }}>Modify</button>
                </div>
              </div>
            </div>
            <DSCRTimeline />
            <CaptureLinkage />
            <DebtTimeline expandedPhase={expandedPhase} setExpandedPhase={setExpandedPhase} />
            {expandedPhase === 'bridge' && <BridgeDetail />}
            {expandedPhase === 'refi' && (
              <div style={{ border: `1px solid ${C.cyan}40`, borderRadius: 2, marginBottom: 14, padding: 14 }}>
                <div style={{ ...mono, color: C.cyan, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>Fannie DUS Refi · M24–M36+</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  {[['Loan Amount', '$32M'], ['LTV', '65%'], ['Rate', '5.1% fixed · 10yr'], ['DSCR at refi', '1.47× (Y3 proj)'], ['Stabilized NOI', '$2.11M'], ['Amortization', '30yr'], ['Prepay', 'YM — ~$640K at M36'], ['Eligible at', 'M21 (Q3 Y2)']].map(([k, v]) => (
                    <div key={k as string}><div style={{ color: C.textMuted, fontSize: 9 }}>{k}</div><div style={{ ...mono, color: C.textPrimary, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{v}</div></div>
                  ))}
                </div>
              </div>
            )}
            <SectionLabel label="ALTERNATIVE STRUCTURES" accent={C.textMuted} />
            <Alternatives />
            <SectionLabel label="MONITORING TRIGGERS" accent={C.amber} />
            <MonitoringTriggers />
          </div>
          <div style={{ width: 250, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0 }}>
            <MarketContext />
          </div>
        </div>
      )}

      {/* CONFIGURE tab (F6 loan builder) */}
      {activeTab === 'configure' && <ConfigureTab />}

      {/* SENSITIVITY tab (F8 + debt-specific) */}
      {activeTab === 'sensitivity' && (
        <div style={{ display: 'flex', flex: 1 }}>
          <SensitivityTabContent />
          <div style={{ width: 220, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 10 }}>SENSITIVITY GUIDE</div>
            {[
              { label: 'IRR × Exit Cap × RG', note: 'From F8 · Base-case exit sensitivity. Current deal: 5.25% cap, 4.0% RG → 19.3% IRR.' },
              { label: 'EM × Exit Cap × Hold', note: 'From F8 · Equity multiple vs hold period. Current: 3yr hold at 5.25% cap → 1.92× EM.' },
              { label: 'DSCR × Spread × Capture', note: 'Debt-specific. Shows how bridge spread + NOI capture timing affects DSCR trajectory. Current: +275bps, 0% capture Y1 → 0.91×.' },
              { label: 'LP IRR × LTV × Exit Cap', note: 'Leverage sensitivity. Shows how different LTV structures affect LP returns at each exit cap.' },
            ].map((g, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${C.purple}40`, paddingLeft: 8, marginBottom: 10 }}>
                <div style={{ ...mono, color: C.purple, fontSize: 9, fontWeight: 700, marginBottom: 2 }}>{g.label}</div>
                <div style={{ color: C.textMuted, fontSize: 9, lineHeight: 1.4 }}>{g.note}</div>
              </div>
            ))}
            <div style={{ marginTop: 12, backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '7px 8px' }}>
              <div style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700, marginBottom: 2 }}>▶ CURRENT DEAL</div>
              <div style={{ color: C.textMuted, fontSize: 9 }}>Highlighted in amber border in each table. Use the tables to stress-test assumptions before locking in Configure.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
