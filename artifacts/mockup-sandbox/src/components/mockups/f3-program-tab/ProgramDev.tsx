import { useState } from 'react';
import { Zap, CheckCircle, TrendingUp } from 'lucide-react';

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
  blue: '#38bdf8',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#2a2a40',
};

const mono = { fontFamily: '"JetBrains Mono", monospace' };

const UNIT_TYPES = [
  { key: 'studio', label: 'Studio', abbr: 'STU', color: C.purple, marketMix: 5.3, marketRent: 1240, marketSF: 508, proposedMix: 5, proposedRent: 1302, proposedSF: 510, units: 13 },
  { key: '1br', label: '1 BR', abbr: '1BR', color: C.cyan, marketMix: 42, marketRent: 1642, marketSF: 748, proposedMix: 38, proposedRent: 1750, proposedSF: 785, units: 95 },
  { key: '2br', label: '2 BR', abbr: '2BR', color: C.green, marketMix: 44, marketRent: 1948, marketSF: 1055, proposedMix: 44, proposedRent: 2100, proposedSF: 1100, units: 110 },
  { key: '3br', label: '3 BR+', abbr: '3BR', color: C.amber, marketMix: 8.7, marketRent: 2280, marketSF: 1298, proposedMix: 13, proposedRent: 2480, proposedSF: 1320, units: 33 },
];

const AMENITY_TIERS = [
  { tier: 'BASE', color: C.green, items: [
    { name: 'Package Lockers', cost: '$45K', lift: '+$18/u', roi: '2.1yr' },
    { name: 'Fitness Center', cost: '$120K', lift: '+$25/u', roi: '1.7yr' },
    { name: 'Dog Park/Wash', cost: '$35K', lift: '+$12/u', roi: '1.0yr' },
  ]},
  { tier: 'COMPETITIVE', color: C.amber, items: [
    { name: 'Rooftop Lounge', cost: '$280K', lift: '+$45/u', roi: '2.2yr' },
    { name: 'Coworking Space', cost: '$180K', lift: '+$35/u', roi: '1.8yr' },
    { name: 'EV Charging (8)', cost: '$64K', lift: '+$15/u', roi: '1.4yr' },
  ]},
  { tier: 'PREMIUM', color: C.purple, items: [
    { name: 'Pool + Cabanas', cost: '$450K', lift: '+$65/u', roi: '2.5yr' },
    { name: 'Sky Deck w/ Grills', cost: '$320K', lift: '+$50/u', roi: '2.3yr' },
  ]},
];

const DEMAND_SIGNALS = [
  { type: '2BR', signal: 'UNDERSUPPLIED', note: 'Comp avg 41% · Market 44%', delta: '+3pp demand gap', color: C.green },
  { type: '3BR+', signal: 'GAP PLAY', note: 'Comp avg 9.1% · Proposed 13%', delta: '+3.9pp upside', color: C.cyan },
  { type: '1BR', signal: 'COMPETITIVE', note: 'Comp avg 42% · At parity', delta: '0pp gap', color: C.amber },
  { type: 'STU', signal: 'OVERSUPPLIED', note: 'Market avg 8.2% · Below market', delta: '−3.2pp', color: C.textMuted },
];

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

function ProgramOrigin({ optimizing, onOptimize }: { optimizing: boolean; onOptimize: () => void }) {
  return (
    <div style={{ backgroundColor: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={13} color={C.cyan} />
        <div style={{ flex: 1 }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>PROGRAM DRIVEN BY F3 DEMAND + F2 ZONING ENVELOPE</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {([
              ['DEVELOPMENT', C.cyan],
              ['→', C.textMuted],
              ['280u max · 310K SF', C.textMuted],
              ['·', C.textDim],
              ['2BR/3BR undersupplied vs comps', C.green],
              ['·', C.textDim],
              ['3BR+: +3.9pp demand gap · lease-up support', C.green],
            ] as [string, string][]).map(([t, col], i) => (
              <span key={i} style={{ ...mono, color: col, fontSize: 10, fontWeight: t === 'DEVELOPMENT' ? 700 : 400 }}>{t}</span>
            ))}
          </div>
        </div>
        <button
          onClick={onOptimize}
          style={{ ...mono, fontSize: 9, padding: '4px 10px', color: optimizing ? C.bg : C.cyan, backgroundColor: optimizing ? C.cyan : 'transparent', border: `1px solid ${C.cyan}40`, borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 700 }}
        >
          {optimizing ? 'OPTIMIZING…' : 'AI OPTIMIZE →'}
        </button>
      </div>
    </div>
  );
}

function EnvelopeBar({ used, total, label, color = C.cyan }: { used: number; total: number; label: string; color?: string }) {
  const pct = Math.min((used / total) * 100, 100);
  const over = used > total;
  const barColor = over ? C.red : pct > 90 ? C.amber : color;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ ...mono, fontSize: 9, color: C.textMuted, letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ ...mono, fontSize: 9, color: over ? C.red : C.textMuted }}>{total - used > 0 ? `${(total - used).toLocaleString()} left` : `${Math.abs(total - used).toLocaleString()} over`}</span>
      </div>
      <div style={{ height: 4, backgroundColor: C.borderMid, borderRadius: 1, position: 'relative' as const }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 1 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ ...mono, fontSize: 10, color: C.textPrimary, fontWeight: 700 }}>{used.toLocaleString()}</span>
        <span style={{ ...mono, fontSize: 9, color: C.textMuted }}>/ {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function MixBar({ proposed, market, color }: { proposed: number; market: number; color: string }) {
  const maxVal = Math.max(proposed, market, 50);
  return (
    <div style={{ position: 'relative' as const, height: 14, width: '100%' }}>
      <div style={{ position: 'absolute' as const, left: `${(market / maxVal) * 100}%`, top: 0, bottom: 0, width: 1, background: C.textMuted, opacity: 0.4, zIndex: 2 }} />
      <div style={{ position: 'absolute' as const, left: 0, top: 4, height: 6, width: `${(proposed / maxVal) * 100}%`, background: color, borderRadius: 1, opacity: 0.85 }} />
    </div>
  );
}

function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>—</span>;
  const color = value > 0 ? C.green : C.red;
  return <span style={{ ...mono, color, fontSize: 9 }}>{value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}{suffix}</span>;
}

export function ProgramDev() {
  const [optimizing, setOptimizing] = useState(false);

  const totalUnits = UNIT_TYPES.reduce((a, u) => a + u.units, 0);
  const maxUnits = 280;
  const totalSF = UNIT_TYPES.reduce((a, u) => a + u.proposedSF * u.units, 0);
  const maxSF = 310000;
  const grossRev = UNIT_TYPES.reduce((a, u) => a + u.proposedRent * u.units * 12, 0);
  const avgRent = grossRev / 12 / totalUnits;
  const avgPSF = grossRev / 12 / totalSF;

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.textPrimary, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12 }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...mono, fontSize: 9, color: C.cyan, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>M03 · PROGRAM</span>
          <Pill color={C.cyan}>DEVELOPMENT</Pill>
        </div>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>PUD-R / C-3 · Zoning linked</span>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' as const }}>
          <ProgramOrigin optimizing={optimizing} onOptimize={() => { setOptimizing(true); setTimeout(() => setOptimizing(false), 2200); }} />

          <div style={{ display: 'flex', gap: 14, marginBottom: 14, padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: C.panelAlt }}>
            <EnvelopeBar used={totalUnits} total={maxUnits} label="UNIT ENVELOPE" color={C.cyan} />
            <div style={{ width: 1, backgroundColor: C.border }} />
            <EnvelopeBar used={totalSF} total={maxSF} label="SF ENVELOPE" color={C.purple} />
          </div>

          <div style={{ display: 'flex', marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {[
              { label: 'TOTAL UNITS', val: String(totalUnits), sub: `of ${maxUnits} max`, color: C.cyan },
              { label: 'NET SF', val: `${(totalSF / 1000).toFixed(0)}K`, sub: `${Math.round(totalSF / totalUnits)} avg/unit`, color: C.purple },
              { label: 'GROSS REV', val: `$${(grossRev / 1e6).toFixed(2)}M`, sub: 'annual', color: C.green },
              { label: 'AVG RENT', val: `$${avgRent.toFixed(0)}`, sub: '/unit/mo', color: C.textPrimary },
              { label: 'AVG $/SF', val: `$${avgPSF.toFixed(2)}`, sub: '/mo', color: C.amber },
            ].map((k, i, arr) => (
              <div key={k.label} style={{ flex: 1, padding: '8px 12px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: C.panelAlt }}>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ ...mono, fontSize: 15, color: k.color, fontWeight: 700, lineHeight: 1 }}>{k.val}</div>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="UNIT PROGRAM — M03 MIX INTELLIGENCE" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...mono, fontSize: 8, padding: '2px 8px', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer' }}>RESET</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '72px 110px 1fr 1fr 68px 80px', padding: '4px 12px', backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['TYPE', 'MIX %', 'AVG SF', 'RENT', '$/SF', 'ANN REV'].map((h, i) => (
                <span key={i} style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.08em', fontWeight: 700 }}>{h}</span>
              ))}
            </div>
            {UNIT_TYPES.map((u, i) => {
              const annRev = u.proposedRent * u.units * 12;
              const psf = u.proposedSF > 0 ? u.proposedRent / u.proposedSF : 0;
              return (
                <div key={u.key} style={{
                  display: 'grid', gridTemplateColumns: '72px 110px 1fr 1fr 68px 80px',
                  padding: '8px 12px', alignItems: 'center',
                  borderBottom: i < UNIT_TYPES.length - 1 ? `1px solid ${C.border}25` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 3, height: 22, backgroundColor: u.color, borderRadius: 1 }} />
                    <div>
                      <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.textPrimary }}>{u.label}</div>
                      <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>{u.units}u</div>
                    </div>
                  </div>
                  <div style={{ paddingRight: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                      <span style={{ ...mono, fontSize: 12, color: C.textPrimary, fontWeight: 700 }}>{u.proposedMix}%</span>
                      <Delta value={u.proposedMix - u.marketMix} suffix="pp" />
                    </div>
                    <MixBar proposed={u.proposedMix} market={u.marketMix} color={u.color} />
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>mkt {u.marketMix}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...mono, fontSize: 11, color: C.textPrimary, fontWeight: 600 }}>{u.proposedSF.toLocaleString()}</span>
                    <Delta value={u.proposedSF - u.marketSF} suffix=" sf" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...mono, fontSize: 11, color: C.textPrimary, fontWeight: 600 }}>${u.proposedRent.toLocaleString()}</span>
                    <Delta value={u.proposedRent - u.marketRent} />
                  </div>
                  <span style={{ ...mono, fontSize: 11, color: C.amber, fontWeight: 600 }}>${psf.toFixed(2)}</span>
                  <span style={{ ...mono, fontSize: 11, color: u.color, fontWeight: 700 }}>${(annRev / 1e3).toFixed(0)}K</span>
                </div>
              );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '72px 110px 1fr 1fr 68px 80px', padding: '8px 12px', borderTop: `2px solid ${C.borderMid}`, backgroundColor: C.panelAlt }}>
              <span style={{ ...mono, fontSize: 8, color: C.textMuted, fontWeight: 700 }}>TOTAL</span>
              <span style={{ ...mono, fontSize: 11, color: C.textPrimary, fontWeight: 700 }}>100%</span>
              <span style={{ ...mono, fontSize: 11, color: C.textPrimary }}>{Math.round(totalSF / totalUnits)} avg sf</span>
              <span style={{ ...mono, fontSize: 11, color: C.textPrimary }}>${avgRent.toFixed(0)} avg</span>
              <span style={{ ...mono, fontSize: 11, color: C.amber, fontWeight: 700 }}>${avgPSF.toFixed(2)}</span>
              <span style={{ ...mono, fontSize: 13, color: C.green, fontWeight: 700 }}>${(grossRev / 1e6).toFixed(2)}M</span>
            </div>
          </div>

          <div style={{ marginBottom: 14, padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: C.panelAlt }}>
            <div style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>REVENUE COMPOSITION</div>
            <div style={{ display: 'flex', height: 6, borderRadius: 1, overflow: 'hidden', gap: 1, marginBottom: 6 }}>
              {UNIT_TYPES.map(u => {
                const rev = u.proposedRent * u.units * 12;
                return <div key={u.key} style={{ width: `${(rev / grossRev) * 100}%`, backgroundColor: u.color, opacity: 0.8 }} />;
              })}
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {UNIT_TYPES.map(u => {
                const rev = u.proposedRent * u.units * 12;
                return (
                  <div key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, backgroundColor: u.color, borderRadius: 1, opacity: 0.8 }} />
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>{u.abbr} {((rev / grossRev) * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="AMENITY PACKAGE BUILDER — NEW CONSTRUCTION" accent={C.amber} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>TOTAL COST</span>
                <span style={{ ...mono, fontSize: 11, color: C.amber, fontWeight: 700 }}>$1.49M</span>
                <span style={{ color: C.border }}>·</span>
                <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>EST LIFT</span>
                <span style={{ ...mono, fontSize: 11, color: C.green, fontWeight: 700 }}>+$265/u</span>
              </div>
            </div>
            {AMENITY_TIERS.map((tier, ti) => (
              <div key={tier.tier}>
                <div style={{ padding: '4px 12px', backgroundColor: C.bg, borderBottom: `1px solid ${C.border}`, borderTop: ti > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 3, height: 10, backgroundColor: tier.color, borderRadius: 1 }} />
                  <span style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: tier.color }}>{tier.tier}</span>
                </div>
                {tier.items.map((item, ii) => (
                  <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 64px 50px 24px', padding: '6px 12px', borderBottom: `1px solid ${C.border}15`, alignItems: 'center' }}>
                    <span style={{ color: C.textPrimary, fontSize: 10 }}>{item.name}</span>
                    <span style={{ ...mono, color: C.textMuted, fontSize: 9, textAlign: 'right' as const }}>{item.cost}</span>
                    <span style={{ ...mono, color: C.green, fontSize: 9, fontWeight: 700, textAlign: 'right' as const }}>{item.lift}</span>
                    <span style={{ ...mono, color: C.textMuted, fontSize: 8, textAlign: 'right' as const }}>{item.roi}</span>
                    <div style={{ textAlign: 'center' as const }}>
                      <Pill color={C.green}>✓</Pill>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>DEMAND SIGNALS</div>
          {DEMAND_SIGNALS.map((d, i) => (
            <div key={i} style={{ border: `1px solid ${i === 0 ? d.color + '50' : C.border}`, backgroundColor: i === 0 ? `${d.color}08` : 'transparent', borderRadius: 2, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ ...mono, color: C.textPrimary, fontSize: 10, fontWeight: 700 }}>{d.type}</span>
                <Pill color={d.color}>{d.signal}</Pill>
              </div>
              <div style={{ ...mono, color: C.textMuted, fontSize: 8, marginBottom: 2 }}>{d.note}</div>
              <div style={{ ...mono, color: d.color, fontSize: 9, fontWeight: 700 }}>{d.delta}</div>
            </div>
          ))}

          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>ZONING ENVELOPE</div>
            {[['Max Units', '280'], ['Max Net SF', '310,000'], ['Height Limit', '8 stories'], ['FAR', '3.2'], ['Status', 'Within envelope']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}25`, padding: '4px 0' }}>
                <span style={{ color: C.textMuted, fontSize: 9 }}>{k}</span>
                <span style={{ ...mono, color: k === 'Status' ? C.green : C.textPrimary, fontSize: 9, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>LEASE-UP FORECAST</div>
            {[['Absorption', '18–22 units/mo'], ['Stabilization', 'M18–M22'], ['Occupancy at stab', '93.5%'], ['Lease-up risk', 'LOW']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}25`, padding: '4px 0' }}>
                <span style={{ color: C.textMuted, fontSize: 9 }}>{k}</span>
                <span style={{ ...mono, color: k === 'Lease-up risk' ? C.green : C.textPrimary, fontSize: 9, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: '8px 10px', backgroundColor: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 2 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <CheckCircle size={11} color={C.green} />
              <span style={{ ...mono, color: C.green, fontSize: 9, fontWeight: 700 }}>WITHIN ENVELOPE</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 9 }}>251 units · 299K SF used · 59K SF headroom. Push to Pro Forma when mix is locked.</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button style={{ ...mono, width: '100%', padding: '7px 0', fontSize: 10, fontWeight: 700, backgroundColor: C.cyan, color: C.bg, border: 'none', borderRadius: 2, cursor: 'pointer' }}>
              PUSH TO PROFORMA →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
