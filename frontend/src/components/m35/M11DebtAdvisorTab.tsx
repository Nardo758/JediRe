import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, Zap, ChevronDown, ChevronRight } from 'lucide-react';

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
              <span key={i} style={{ ...mono, color: col as string, fontSize: 10, fontWeight: t === 'MF VALUE-ADD' ? 700 : 400 }}>{t}</span>
            ))}
          </div>
        </div>
        <button style={{ ...mono, fontSize: 9, padding: '3px 8px', color: C.cyan, border: `1px solid ${C.cyan}40`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>View Strategy →</button>
      </div>
    </div>
  );
}

function DSCRTimeline() {
  const cols = [
    { yr: 'Y1', dscr: 0.91, noi: '$1.64M', occ: '89.1%', capture: '$334K', status: 'IO · pre-stab', color: C.red },
    { yr: 'Y2', dscr: 1.24, noi: '$1.87M', occ: '92.3%', capture: '$877K', status: 'IO · reno 75%', color: C.amber },
    { yr: 'Y3', dscr: 1.47, noi: '$2.11M', occ: '94.2%', capture: '$1.16M', status: 'REFI TRIGGER', color: C.green, flag: true },
    { yr: 'Y4', dscr: 1.62, noi: '$2.35M', occ: '95.1%', capture: '$1.20M', status: 'Stabilized', color: C.green },
    { yr: 'Y5', dscr: 1.68, noi: '$2.49M', occ: '95.8%', capture: '$1.20M', status: 'Exit window', color: C.cyan },
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
            <div style={{ marginTop: 8, height: 36, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '70%', height: `${Math.min((c.dscr / 2) * 100, 100)}%`, backgroundColor: `${c.color}35`, border: `1px solid ${c.color}50`, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <CheckCircle size={11} color={C.green} style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ color: C.textMuted, fontSize: 10 }}>
          Refi trigger: <span style={{ ...mono, color: C.green }}>DSCR {'>'} 1.35 AND Occ {'>'} 92%</span> — first met M21 (Q3 Y2). Bridge extension option exercised as needed. Fannie DUS refi executes M24 as planned.
        </span>
      </div>
    </div>
  );
}

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

function DebtTimeline({ expandedPhase, setExpandedPhase }: { expandedPhase: string | null; setExpandedPhase: (v: string | null) => void }) {
  const pct = (m: number) => `${(m / 36) * 100}%`;
  const phases = [
    { id: 'bridge', label: 'BRIDGE', detail: '$28.5M · SOFR+275 · 3yr+1+1 · IO · 70% LTC', start: 0, end: 24, color: C.orange },
    { id: 'refi', label: 'FANNIE DUS REFI', detail: '$32M · 10yr fixed · 5.1% · 65% LTV', start: 24, end: 36, color: C.cyan },
  ];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 14, marginBottom: 14, backgroundColor: C.panelAlt }}>
      <SectionLabel label="DEBT PLAN TIMELINE" accent={C.amber} />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {[0, 6, 12, 18, 24, 30, 36].map(m => (
            <span key={m} style={{ ...mono, color: C.textMuted, fontSize: 9 }}>M{m}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', left: pct(24), top: 24, height: 34, width: 1, backgroundColor: `${C.green}70` }}>
          <span style={{ ...mono, fontSize: 8, color: C.green, position: 'absolute', top: '100%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const }}>REFI TRIGGER M24</span>
        </div>
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
              Refi window: <span style={{ ...mono, color: C.green }}>Occ {'>'} 92% AND DSCR {'>'} 1.35</span> → projected M21 per M08 capture schedule.
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
      <div style={{ marginTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, marginBottom: 4 }}>SOFR FORWARD CURVE</div>
        <svg width="100%" height={32} viewBox="0 0 200 32">
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
      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, marginBottom: 8 }}>SPREAD OVER INDEX (bps)</div>
        {[
          { n: 'Agency', s: 165, c: C.cyan },
          { n: 'CMBS', s: 215, c: '#b794f4' },
          { n: 'Bank', s: 250, c: '#4fd1c5' },
          { n: 'Bridge', s: 340, c: C.amber },
          { n: 'Mezz', s: 650, c: '#f6e05e' },
        ].map(x => (
          <div key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <span style={{ color: C.textMuted, fontSize: 8, minWidth: 40, textAlign: 'right' as const }}>{x.n}</span>
            <div style={{ flex: 1, height: 8, background: `${C.border}60`, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(x.s / 700) * 100}%`, background: `${x.c}40`, borderRadius: 2, borderRight: `2px solid ${x.c}` }} />
            </div>
            <span style={{ ...mono, fontSize: 8, color: x.c, minWidth: 30, textAlign: 'right' as const }}>+{x.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          tradeoff: 'Mezz adds execution risk (intercreditor, review). Higher coupon drag in IO period.',
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
          <div style={{ marginTop: 8, padding: '6px 8px', backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}20`, borderRadius: 2 }}>
            <div style={{ color: C.textMuted, fontSize: 9 }}><span style={{ ...mono, color: C.amber, fontWeight: 700 }}>TRADEOFF: </span>{a.tradeoff}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function M11DebtAdvisorTab() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>('bridge');

  return (
    <div style={{ background: C.bg, color: C.textPrimary, padding: 16, minHeight: 600, fontFamily: 'Inter, sans-serif' }}>
      <StrategyOrigin />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        <div>
          <DSCRTimeline />
          <CaptureLinkage />
          <DebtTimeline expandedPhase={expandedPhase} setExpandedPhase={setExpandedPhase} />
          {expandedPhase === 'bridge' && <BridgeDetail />}
          <SectionLabel label="ALTERNATIVE STRUCTURES" accent={C.purple} />
          <Alternatives />
        </div>
        <MarketContext />
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 12, marginTop: 4, backgroundColor: C.panelAlt }}>
        <SectionLabel label="ACTIONS &amp; NEXT STEPS" accent={C.amber} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { priority: 'CRITICAL', label: 'Lock rate cap — SOFR strike 4.5% · 2yr · est. $380K', color: C.red },
            { priority: 'HIGH', label: 'Set M08 NOI alert: fire at DSCR 1.35 + Occ 92%', color: C.amber },
            { priority: 'HIGH', label: 'Pre-qualify Fannie DUS with Acore — term sheet M6', color: C.amber },
            { priority: 'MEDIUM', label: 'Budget cap renewal M24: est. $180K reserve', color: C.cyan },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', border: `1px solid ${a.color}20`, borderRadius: 2, backgroundColor: `${a.color}06` }}>
              <AlertTriangle size={11} color={a.color} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ ...mono, color: a.color, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>{a.priority}</div>
                <div style={{ color: C.textMuted, fontSize: 10 }}>{a.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
