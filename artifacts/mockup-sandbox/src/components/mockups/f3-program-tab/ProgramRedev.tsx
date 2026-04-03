export function ProgramRedev() {
  const C = {
    bg: '#0A0E17', surface: '#0F1319', card: '#131821', border: '#1E2538',
    muted: '#2A3348', text: '#E8ECF1', dim: '#6B7A8D',
    studio: '#A78BFA', oneBR: '#00BCD4', twoBR: '#00D26A', threeBR: '#F5A623',
    subject: '#FF8C42', green: '#00D26A', red: '#FF4757', yellow: '#F5A623', blue: '#00BCD4',
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'positioning', label: 'POSITIONING' },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS' },
    { id: 'repositioning', label: 'REPOSITIONING', active: true },
  ];

  const dealTypes = [
    { id: 'dev', label: 'DEVELOPMENT', active: false, desc: 'New construction', color: C.green },
    { id: 'redev', label: 'REDEVELOPMENT', active: true, desc: 'Add/convert units', color: C.yellow },
    { id: 'exist', label: 'EXISTING', active: false, desc: 'Rent lift only', color: C.blue },
  ];

  const redevModes = [
    { id: 'units', label: 'ADD UNITS', active: true },
    { id: 'sf', label: 'ADD SF', active: false },
    { id: 'both', label: 'BOTH', active: false },
  ];

  const existing = [
    { abbr: 'STU', color: C.studio, current: 10, target: 5, delta: -5, sf: 480, rent: 1180, targetRent: 1350, convCost: '$28K' },
    { abbr: '1BR', color: C.oneBR, current: 45, target: 35, delta: -10, sf: 720, rent: 1490, targetRent: 1750, convCost: '$0' },
    { abbr: '2BR', color: C.twoBR, current: 35, target: 48, delta: 13, sf: 1050, rent: 1780, targetRent: 2100, convCost: '$42K' },
    { abbr: '3BR', color: C.threeBR, current: 10, target: 12, delta: 2, sf: 1280, rent: 2150, targetRent: 2480, convCost: '$55K' },
  ];

  const amenityGap = [
    { name: 'Package Lockers', has: false, comps: '85%', cost: '$45K', lift: '+$18/u', priority: 'HIGH' },
    { name: 'EV Charging', has: false, comps: '62%', cost: '$64K', lift: '+$15/u', priority: 'MED' },
    { name: 'Coworking Space', has: false, comps: '54%', cost: '$180K', lift: '+$35/u', priority: 'HIGH' },
    { name: 'Fitness Center', has: true, comps: '95%', cost: '—', lift: '—', priority: '—' },
    { name: 'Dog Park', has: true, comps: '78%', cost: '—', lift: '—', priority: '—' },
    { name: 'Rooftop Lounge', has: false, comps: '42%', cost: '$280K', lift: '+$45/u', priority: 'MED' },
  ];

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>REPOSITIONING</span>
        </div>
        <span style={{ color: C.yellow, fontFamily: mono, fontSize: 8, padding: '2px 5px', background: '#F5A62315', borderRadius: 2 }}>REDEVELOPMENT</span>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '7px 14px', fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            borderBottom: t.active ? `2px solid ${C.blue}` : '2px solid transparent',
            color: t.active ? C.blue : C.dim,
            background: t.active ? '#00BCD408' : 'transparent',
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* AI Rationale */}
        <div style={{ background: C.card, border: `1px solid ${C.yellow}30`, borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: C.yellow, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AI SYNTHESIS</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 10, fontWeight: 700 }}>Repositioning Rationale</span>
          </div>
          <p style={{ color: C.dim, fontSize: 9, lineHeight: 1.5, margin: 0 }}>
            Current mix overweights Studio (10% vs 3.2% comp avg) and 1BR (45% vs 42%). Convert 12 studios to 2BR and reallocate
            1BR share to capture the 5.4pp demand gap. Conversion cost estimate: $1.2M for 18 unit conversions. Projected rent lift: +$320/u
            across converted units. Amenity gap analysis shows 3 high-priority additions from F6 AmenityGapMatrix.
          </p>
        </div>

        {/* Deal Type Selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {dealTypes.map(dt => (
            <div key={dt.id} style={{
              flex: 1, padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
              background: dt.active ? dt.color + '10' : C.card,
              border: `1px solid ${dt.active ? dt.color + '60' : C.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: dt.active ? dt.color : C.dim, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{dt.label}</span>
                {dt.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dt.color }} />}
              </div>
              <span style={{ color: C.dim, fontSize: 8 }}>{dt.desc}</span>
            </div>
          ))}
        </div>

        {/* Redev Mode Toggle */}
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', background: C.card, borderRadius: 4, border: `1px solid ${C.border}` }}>
          <span style={{ color: C.dim, fontFamily: mono, fontSize: 8, marginRight: 8, alignSelf: 'center' }}>MODE</span>
          {redevModes.map(m => (
            <span key={m.id} style={{
              padding: '3px 10px', fontSize: 8, fontWeight: 700, fontFamily: mono, borderRadius: 3,
              background: m.active ? C.yellow + '18' : 'transparent',
              color: m.active ? C.yellow : C.dim,
              border: `1px solid ${m.active ? C.yellow + '50' : C.border}`,
              cursor: 'pointer',
            }}>{m.label}</span>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>CONV. BUDGET</span>
            <span style={{ color: C.yellow, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>$1.2M</span>
            <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>EST PAYBACK</span>
            <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>2.4yr</span>
          </div>
        </div>

        {/* Existing → Target Mix */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M03</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Existing → Target Mix</span>
            <span style={{ color: C.dim, fontSize: 8 }}>deltas shown</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '50px 70px 70px 50px 80px 80px 70px', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['TYPE', 'CURRENT', 'TARGET', 'Δ MIX', 'RENT NOW', 'RENT TGT', 'CONV $'].map((h, i) => (
              <div key={i} style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {existing.map(u => (
            <div key={u.abbr} style={{ display: 'grid', gridTemplateColumns: '50px 70px 70px 50px 80px 80px 70px', padding: '6px 12px',
              borderBottom: `1px solid ${C.border}40`, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, background: u.color, borderRadius: 1 }} />
                <span style={{ color: u.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.abbr}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: C.dim, fontFamily: mono, fontSize: 10 }}>{u.current}%</span>
                <div style={{ width: '100%', height: 3, background: C.muted, borderRadius: 1, overflow: 'hidden', marginTop: 1 }}>
                  <div style={{ width: `${u.current}%`, height: '100%', background: u.color + '40' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: C.subject, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{u.target}%</span>
                <div style={{ width: '100%', height: 3, background: C.muted, borderRadius: 1, overflow: 'hidden', marginTop: 1 }}>
                  <div style={{ width: `${u.target}%`, height: '100%', background: u.color }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: u.delta > 0 ? C.green : u.delta < 0 ? C.red : C.dim, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>
                  {u.delta > 0 ? '+' : ''}{u.delta}pp
                </span>
              </div>
              <span style={{ textAlign: 'right', color: C.dim, fontFamily: mono, fontSize: 10 }}>${u.rent.toLocaleString()}</span>
              <span style={{ textAlign: 'right', color: C.green, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>${u.targetRent.toLocaleString()}</span>
              <span style={{ textAlign: 'right', color: u.convCost !== '$0' ? C.yellow : C.dim, fontFamily: mono, fontSize: 9 }}>{u.convCost}</span>
            </div>
          ))}
        </div>

        {/* Amenity Gap from F6 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AMENITY</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Amenity Gap Analysis</span>
              <span style={{ color: C.dim, fontSize: 8 }}>← from F6 AmenityGapMatrix</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>UPGRADE COST</span>
              <span style={{ color: C.yellow, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>$569K</span>
              <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>LIFT</span>
              <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>+$113/u</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 60px 60px 50px', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['AMENITY', 'HAS', 'COMPS', 'COST', 'LIFT', 'PRI'].map((h, i) => (
              <div key={i} style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>
          {amenityGap.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 60px 60px 50px', padding: '4px 12px',
              borderBottom: `1px solid ${C.border}30`, alignItems: 'center' }}>
              <span style={{ color: C.text, fontSize: 10 }}>{a.name}</span>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: a.has ? C.green : C.red }}>{a.has ? '✓' : '✗'}</span>
              </div>
              <span style={{ textAlign: 'center', color: C.dim, fontFamily: mono, fontSize: 9 }}>{a.comps}</span>
              <span style={{ textAlign: 'center', color: a.cost !== '—' ? C.yellow : C.dim, fontFamily: mono, fontSize: 9 }}>{a.cost}</span>
              <span style={{ textAlign: 'center', color: a.lift !== '—' ? C.green : C.dim, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{a.lift}</span>
              <div style={{ textAlign: 'center' }}>
                {a.priority !== '—' && (
                  <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                    background: a.priority === 'HIGH' ? C.red + '18' : C.yellow + '18',
                    color: a.priority === 'HIGH' ? C.red : C.yellow }}>{a.priority}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {tabs.map((step, i) => (
          <span key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2,
              background: step.active ? C.blue + '20' : 'transparent',
              color: step.active ? C.blue : C.dim,
              border: step.active ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
            }}>{step.label}</span>
            {i < tabs.length - 1 && <span style={{ color: C.muted, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
