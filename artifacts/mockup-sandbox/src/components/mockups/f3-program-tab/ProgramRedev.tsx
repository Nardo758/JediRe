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
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#2a2a40',
};

const mono = { fontFamily: '"JetBrains Mono", monospace' };

const EXISTING_MIX = [
  { abbr: 'STU', color: C.purple, current: 10, target: 5,  delta: -5,  sf: 480,  rent: 1180, targetRent: 1350, convCost: '$28K',  convUnits: 5 },
  { abbr: '1BR', color: C.cyan,   current: 45, target: 35, delta: -10, sf: 720,  rent: 1490, targetRent: 1750, convCost: '$0',    convUnits: 10 },
  { abbr: '2BR', color: C.green,  current: 35, target: 48, delta: 13,  sf: 1050, rent: 1780, targetRent: 2100, convCost: '$42K',  convUnits: 13 },
  { abbr: '3BR', color: C.amber,  current: 10, target: 12, delta: 2,   sf: 1280, rent: 2150, targetRent: 2480, convCost: '$55K',  convUnits: 2 },
];

const AMENITY_GAP = [
  { name: 'Package Lockers',  has: false, comps: 85, cost: '$45K',  lift: '+$18/u', roi: '0.9yr', priority: 'CRITICAL' },
  { name: 'EV Charging',      has: false, comps: 62, cost: '$64K',  lift: '+$15/u', roi: '1.4yr', priority: 'HIGH' },
  { name: 'Coworking Space',  has: false, comps: 54, cost: '$180K', lift: '+$35/u', roi: '1.8yr', priority: 'HIGH' },
  { name: 'Fitness Center',   has: true,  comps: 95, cost: '—',     lift: '—',      roi: '—',     priority: '—' },
  { name: 'Dog Park',         has: true,  comps: 78, cost: '—',     lift: '—',      roi: '—',     priority: '—' },
  { name: 'Rooftop Lounge',   has: false, comps: 42, cost: '$280K', lift: '+$45/u', roi: '2.2yr', priority: 'MEDIUM' },
];

const REDEV_MODES = [
  { id: 'units', label: 'ADD UNITS' },
  { id: 'sf',    label: 'ADD SF' },
  { id: 'both',  label: 'BOTH' },
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

export function ProgramRedev() {
  const [mode, setMode] = useState('units');

  const totalConvCost = 1200000;
  const totalLift = EXISTING_MIX.reduce((s, u) => s + (u.targetRent - u.rent) * u.convUnits, 0);
  const missingAmenities = AMENITY_GAP.filter(a => !a.has);
  const amenityLift = missingAmenities.reduce((s, a) => s + (a.lift !== '—' ? parseInt(a.lift.replace('+$', '').replace('/u', ''), 10) : 0), 0);

  const priorityColor = (p: string) => p === 'CRITICAL' ? C.red : p === 'HIGH' ? C.amber : p === 'MEDIUM' ? C.cyan : C.textMuted;

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.textPrimary, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12 }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...mono, fontSize: 9, color: C.amber, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>M03 · REPOSITIONING</span>
          <Pill color={C.amber}>REDEVELOPMENT</Pill>
        </div>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>LAST COMPUTED: 09:14 AM · Source: M03 demand + F6 comps</span>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' as const }}>

          <div style={{ backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={13} color={C.amber} />
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>REPOSITIONING RATIONALE — M03 DEMAND + F6 AMENITY GAP MATRIX</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  {([
                    ['REDEVELOPMENT', C.amber],
                    ['→', C.textMuted],
                    ['Studio overweight 10% vs 3.2% comp avg', C.red],
                    ['·', C.textDim],
                    ['2BR undersupplied: convert 13 units', C.green],
                    ['·', C.textDim],
                    [`Projected lift +$${totalLift.toLocaleString()}/mo on converted units`, C.textMuted],
                  ] as [string, string][]).map(([t, col], i) => (
                    <span key={i} style={{ ...mono, color: col, fontSize: 10, fontWeight: t === 'REDEVELOPMENT' ? 700 : 400 }}>{t}</span>
                  ))}
                </div>
              </div>
              <button style={{ ...mono, fontSize: 9, padding: '3px 8px', color: C.amber, border: `1px solid ${C.amber}40`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>View Strategy →</button>
            </div>
          </div>

          <div style={{ display: 'flex', marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {[
              { label: 'CONV. BUDGET', val: `$${(totalConvCost / 1e6).toFixed(1)}M`, sub: '18 unit conversions', color: C.amber },
              { label: 'RENT LIFT', val: `+$${Math.round(totalLift / EXISTING_MIX.reduce((s, u) => s + u.convUnits, 0))}/u`, sub: 'avg across converted', color: C.green },
              { label: 'EST PAYBACK', val: '2.4yr', sub: 'at full conversion', color: C.cyan },
              { label: 'AMENITY LIFT', val: `+$${amenityLift}/u`, sub: `${missingAmenities.length} gaps to close`, color: C.purple },
            ].map((k, i, arr) => (
              <div key={k.label} style={{ flex: 1, padding: '8px 12px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: C.panelAlt }}>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ ...mono, fontSize: 15, color: k.color, fontWeight: 700, lineHeight: 1 }}>{k.val}</div>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: C.panelAlt, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.06em' }}>REDEV MODE</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {REDEV_MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{ ...mono, fontSize: 8, padding: '3px 10px', fontWeight: 700, border: `1px solid ${mode === m.id ? C.amber + '50' : C.border}`, borderRadius: 2, cursor: 'pointer', backgroundColor: mode === m.id ? `${C.amber}18` : 'transparent', color: mode === m.id ? C.amber : C.textMuted }}>
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>TOTAL CONV. COST</span>
            <span style={{ ...mono, fontSize: 12, color: C.amber, fontWeight: 700 }}>${(totalConvCost / 1e6).toFixed(1)}M</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>PAYBACK</span>
            <span style={{ ...mono, fontSize: 12, color: C.green, fontWeight: 700 }}>2.4yr</span>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
              <SectionLabel label="EXISTING → TARGET MIX — M03 REPOSITIONING" accent={C.amber} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '48px 72px 72px 52px 80px 80px 70px', padding: '4px 12px', backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['TYPE', 'CURRENT', 'TARGET', 'Δ MIX', 'RENT NOW', 'RENT TGT', 'CONV $'].map((h, i) => (
                <span key={i} style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.08em', fontWeight: 700, textAlign: i > 0 ? 'right' as const : 'left' as const }}>{h}</span>
              ))}
            </div>
            {EXISTING_MIX.map(u => (
              <div key={u.abbr} style={{ display: 'grid', gridTemplateColumns: '48px 72px 72px 52px 80px 80px 70px', padding: '8px 12px', borderBottom: `1px solid ${C.border}25`, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 3, height: 18, backgroundColor: u.color, borderRadius: 1 }} />
                  <span style={{ ...mono, fontSize: 10, color: u.color, fontWeight: 700 }}>{u.abbr}</span>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ ...mono, fontSize: 11, color: C.textMuted }}>{u.current}%</span>
                  <div style={{ height: 3, backgroundColor: C.borderMid, borderRadius: 1, marginTop: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${u.current * 2}%`, height: '100%', backgroundColor: `${u.color}40` }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ ...mono, fontSize: 11, color: C.textPrimary, fontWeight: 700 }}>{u.target}%</span>
                  <div style={{ height: 3, backgroundColor: C.borderMid, borderRadius: 1, marginTop: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${u.target * 2}%`, height: '100%', backgroundColor: u.color }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: u.delta > 0 ? C.green : u.delta < 0 ? C.red : C.textMuted }}>
                    {u.delta > 0 ? '+' : ''}{u.delta}pp
                  </span>
                </div>
                <span style={{ ...mono, fontSize: 10, color: C.textMuted, textAlign: 'right' as const }}>${u.rent.toLocaleString()}</span>
                <span style={{ ...mono, fontSize: 10, color: C.green, fontWeight: 700, textAlign: 'right' as const }}>${u.targetRent.toLocaleString()}</span>
                <div style={{ textAlign: 'right' as const }}>
                  {u.convCost !== '$0'
                    ? <Pill color={C.amber}>{u.convCost}</Pill>
                    : <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>no conv</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="AMENITY GAP ANALYSIS — F6 COMP MATRIX" accent={C.purple} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>UPGRADE COST</span>
                <span style={{ ...mono, fontSize: 11, color: C.amber, fontWeight: 700 }}>$569K</span>
                <span style={{ color: C.border }}>·</span>
                <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>LIFT</span>
                <span style={{ ...mono, fontSize: 11, color: C.green, fontWeight: 700 }}>+${amenityLift}/u</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 54px 60px 64px 60px', padding: '4px 12px', backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['AMENITY', 'HAS', 'COMPS', 'COST', 'LIFT', 'PRIORITY'].map((h, i) => (
                <span key={i} style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.08em', fontWeight: 700, textAlign: i > 0 ? 'center' as const : 'left' as const }}>{h}</span>
              ))}
            </div>
            {AMENITY_GAP.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 54px 60px 64px 60px', padding: '6px 12px', borderBottom: `1px solid ${C.border}15`, alignItems: 'center', backgroundColor: !a.has && a.comps >= 60 ? `${C.red}04` : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 3, height: 14, backgroundColor: !a.has ? (a.comps >= 60 ? C.red : a.comps >= 40 ? C.amber : C.textMuted) : C.green, borderRadius: 1, opacity: a.has ? 0.4 : 1 }} />
                  <span style={{ fontSize: 10, color: a.has ? C.textMuted : C.textPrimary }}>{a.name}</span>
                </div>
                <div style={{ textAlign: 'center' as const }}>
                  <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: a.has ? C.green : C.red }}>{a.has ? '✓' : '✗'}</span>
                </div>
                <div style={{ textAlign: 'center' as const }}>
                  <span style={{ ...mono, fontSize: 9, color: a.comps >= 60 ? C.red : a.comps >= 40 ? C.amber : C.textMuted, fontWeight: 700 }}>{a.comps}%</span>
                </div>
                <span style={{ ...mono, fontSize: 9, color: a.cost !== '—' ? C.amber : C.textMuted, textAlign: 'center' as const }}>{a.cost}</span>
                <span style={{ ...mono, fontSize: 9, color: a.lift !== '—' ? C.green : C.textMuted, fontWeight: 700, textAlign: 'center' as const }}>{a.lift}</span>
                <div style={{ textAlign: 'center' as const }}>
                  {a.priority !== '—' && <Pill color={priorityColor(a.priority)}>{a.priority}</Pill>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>CONVERSION CONTEXT</div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 10, marginBottom: 10 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>UNIT DELTA SUMMARY</div>
            {EXISTING_MIX.map(u => (
              <div key={u.abbr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}25`, padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 5, height: 5, backgroundColor: u.color, borderRadius: 1 }} />
                  <span style={{ ...mono, fontSize: 9, color: u.color, fontWeight: 700 }}>{u.abbr}</span>
                </div>
                <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: u.delta > 0 ? C.green : u.delta < 0 ? C.red : C.textMuted }}>
                  {u.delta > 0 ? '+' : ''}{u.delta}pp
                </span>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 10, marginBottom: 10 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>ROI SUMMARY</div>
            {[
              ['Conv. budget', '$1.2M'],
              ['Units converted', '18'],
              ['Avg cost/unit', '$66.7K'],
              ['Monthly rent lift', `+$${Math.round(totalLift).toLocaleString()}`],
              ['Payback period', '2.4yr'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}25`, padding: '4px 0' }}>
                <span style={{ color: C.textMuted, fontSize: 9 }}>{k}</span>
                <span style={{ ...mono, color: k === 'Payback period' ? C.cyan : C.textPrimary, fontSize: 9, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, padding: 10, marginBottom: 14 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>DEMAND SIGNALS</div>
            {[
              { type: '2BR', note: '+5.4pp demand gap vs comp avg', color: C.green },
              { type: '3BR', note: 'Undersupplied in submarket', color: C.cyan },
              { type: 'STU', note: '10% vs 3.2% comp avg — overweight', color: C.red },
            ].map(d => (
              <div key={d.type} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
                <TrendingUp size={10} color={d.color} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <span style={{ ...mono, fontSize: 9, color: d.color, fontWeight: 700 }}>{d.type}</span>
                  <div style={{ fontSize: 8, color: C.textMuted }}>{d.note}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 10px', backgroundColor: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 2, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <CheckCircle size={11} color={C.green} />
              <span style={{ ...mono, color: C.green, fontSize: 9, fontWeight: 700 }}>REFI ELIGIBLE AT STAB</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 9 }}>Projected occupancy {'>'} 93% post-conversion. Amenity close adds +$113/u — combine for full NOI capture before exit.</div>
          </div>

          <button style={{ ...mono, width: '100%', padding: '7px 0', fontSize: 10, fontWeight: 700, backgroundColor: C.amber, color: C.bg, border: 'none', borderRadius: 2, cursor: 'pointer' }}>
            PUSH TO PROFORMA →
          </button>
        </div>
      </div>
    </div>
  );
}
