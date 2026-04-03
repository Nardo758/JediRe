export function ProgramExisting() {
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
    { id: 'trends', label: 'TRENDS', active: false },
  ];

  const dealTypes = [
    { id: 'dev', label: 'DEVELOPMENT', active: false, desc: 'New construction', color: C.green },
    { id: 'redev', label: 'REDEVELOPMENT', active: false, desc: 'Add/convert units', color: C.yellow },
    { id: 'exist', label: 'EXISTING', active: true, desc: 'Rent lift · gap analysis', color: C.blue },
  ];

  const mixGap = [
    { abbr: 'STU', color: C.studio, actual: 8, optimal: 3, gap: -5, rent: 1180, compAvg: 1248, liftOpp: -68, liftNote: 'Below market — amenity gap likely' },
    { abbr: '1BR', color: C.oneBR, actual: 40, optimal: 42, gap: 2, rent: 1560, compAvg: 1634, liftOpp: 74, liftNote: '+$74/u lift with package lockers + coworking' },
    { abbr: '2BR', color: C.twoBR, actual: 42, optimal: 44, gap: 2, rent: 1920, compAvg: 1988, liftOpp: 68, liftNote: '+$68/u lift — units undersupplied in submarket' },
    { abbr: '3BR', color: C.threeBR, actual: 10, optimal: 11, gap: 1, rent: 2280, compAvg: 2280, liftOpp: 0, liftNote: 'At market — no immediate lift opportunity' },
  ];

  const totalUnits = 320;
  const totalLift = mixGap.reduce((s, u) => {
    const count = Math.round(totalUnits * u.actual / 100);
    return s + (u.liftOpp > 0 ? count * u.liftOpp : 0);
  }, 0);
  const annLift = totalLift * 12;

  const amenityGap = [
    { name: 'Package Lockers', has: false, compPen: 85, cost: '$45K', liftPerUnit: 18, status: 'MISSING' },
    { name: 'Coworking Space', has: false, compPen: 54, cost: '$180K', liftPerUnit: 35, status: 'MISSING' },
    { name: 'EV Charging', has: false, compPen: 62, cost: '$64K', liftPerUnit: 15, status: 'MISSING' },
    { name: 'Fitness Center', has: true, compPen: 95, cost: '—', liftPerUnit: 0, status: 'HAS' },
    { name: 'Dog Park/Wash', has: true, compPen: 78, cost: '—', liftPerUnit: 0, status: 'HAS' },
    { name: 'Pool', has: true, compPen: 68, cost: '—', liftPerUnit: 0, status: 'HAS' },
  ];

  const rentLiftItems = [
    { label: '1BR units at $1,560 vs comp $1,634', lift: '+$74/u', units: 128, annual: '$113.7K', color: C.oneBR },
    { label: '2BR units at $1,920 vs comp $1,988', lift: '+$68/u', units: 134, annual: '$109.3K', color: C.twoBR },
    { label: 'Package lockers close $50/u gap from F6', lift: '+$50/u', units: 320, annual: '$192.0K', color: C.blue },
  ];

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>EXISTING ASSET</span>
        </div>
        <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, padding: '2px 5px', background: '#00BCD415', borderRadius: 2 }}>EXISTING</span>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '7px 14px', fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            borderBottom: '2px solid transparent',
            color: C.dim,
          }}>{t.label}</div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: C.dim, fontFamily: mono, fontSize: 8 }}>No PROGRAM tab for Existing — showing gap analysis below</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* AI Rationale */}
        <div style={{ background: C.card, border: `1px solid ${C.blue}30`, borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AI SYNTHESIS</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 10, fontWeight: 700 }}>Rent Lift Analysis</span>
          </div>
          <p style={{ color: C.dim, fontSize: 9, lineHeight: 1.5, margin: 0 }}>
            Your 1BR units are $74 below comps with similar amenity sets. 2BR units show $68 lift opportunity — these are undersupplied
            in the submarket (5.4pp demand gap). Adding package lockers closes a $50/unit gap identified in F6 AmenityGapMatrix.
            Total projected annual lift: ${(annLift / 1000).toFixed(0)}K across {totalUnits} units with minimal capex.
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

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: 'TOTAL UNITS', val: `${totalUnits}`, sub: 'from Deal Capsule', color: C.text },
            { label: 'RENT LIFT OPP', val: `+$${(annLift / 1000).toFixed(0)}K`, sub: 'annual', color: C.green },
            { label: 'AMENITY GAP', val: '3 items', sub: '$289K to close', color: C.yellow },
            { label: 'MIX ALIGNMENT', val: '94%', sub: 'vs market optimal', color: C.green },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.dim, fontSize: 7, fontFamily: mono, letterSpacing: '0.06em', marginBottom: 3 }}>{kpi.label}</div>
              <span style={{ color: kpi.color, fontFamily: mono, fontSize: 15, fontWeight: 700 }}>{kpi.val}</span>
              <div style={{ color: C.dim, fontSize: 8, marginTop: 1 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Actual vs Optimal Mix — gap analysis */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>GAP</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Actual Mix vs Market-Optimal</span>
            <span style={{ color: C.dim, fontSize: 8 }}>imported from Deal Capsule</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '50px 60px 60px 50px 80px 80px 1fr', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['TYPE', 'ACTUAL', 'OPTIMAL', 'GAP', 'YOUR RENT', 'COMP AVG', 'LIFT OPPORTUNITY'].map((h, i) => (
              <div key={i} style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 0 && i < 6 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {mixGap.map(u => (
            <div key={u.abbr} style={{ display: 'grid', gridTemplateColumns: '50px 60px 60px 50px 80px 80px 1fr', padding: '6px 12px',
              borderBottom: `1px solid ${C.border}40`, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, background: u.color, borderRadius: 1 }} />
                <span style={{ color: u.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.abbr}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: C.text, fontFamily: mono, fontSize: 10 }}>{u.actual}%</span>
                <div style={{ width: '100%', height: 3, background: C.muted, borderRadius: 1, overflow: 'hidden', marginTop: 1 }}>
                  <div style={{ width: `${u.actual * 2}%`, height: '100%', background: u.color + '50' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: C.dim, fontFamily: mono, fontSize: 10 }}>{u.optimal}%</span>
                <div style={{ width: '100%', height: 3, background: C.muted, borderRadius: 1, overflow: 'hidden', marginTop: 1 }}>
                  <div style={{ width: `${u.optimal * 2}%`, height: '100%', background: u.color }} />
                </div>
              </div>
              <span style={{ textAlign: 'right', color: Math.abs(u.gap) > 3 ? (u.gap > 0 ? C.green : C.red) : C.dim, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>
                {u.gap > 0 ? '+' : ''}{u.gap}pp
              </span>
              <span style={{ textAlign: 'right', color: C.text, fontFamily: mono, fontSize: 10 }}>${u.rent.toLocaleString()}</span>
              <span style={{ textAlign: 'right', color: C.dim, fontFamily: mono, fontSize: 10 }}>${u.compAvg.toLocaleString()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                {u.liftOpp > 0 ? (
                  <>
                    <span style={{ color: C.green, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>+${u.liftOpp}/u</span>
                    <span style={{ color: C.dim, fontSize: 8 }}>{u.liftNote}</span>
                  </>
                ) : u.liftOpp < 0 ? (
                  <>
                    <span style={{ color: C.red, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>${u.liftOpp}/u</span>
                    <span style={{ color: C.dim, fontSize: 8 }}>{u.liftNote}</span>
                  </>
                ) : (
                  <span style={{ color: C.dim, fontSize: 8 }}>{u.liftNote}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Top Rent Lift Actions */}
        <div style={{ background: C.card, border: `1px solid ${C.green}30`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.green, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>ACTION</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Top Rent Lift Opportunities</span>
          </div>
          {rentLiftItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: `1px solid ${C.border}30` }}>
              <span style={{ color: C.green, fontSize: 10 }}>▲</span>
              <span style={{ color: C.text, fontSize: 10, flex: 1 }}>{item.label}</span>
              <span style={{ color: item.color, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{item.lift}</span>
              <span style={{ color: C.dim, fontFamily: mono, fontSize: 9 }}>×{item.units}u</span>
              <span style={{ color: C.green, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{item.annual}/yr</span>
            </div>
          ))}
          <div style={{ padding: '6px 12px', background: C.bg, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.dim, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>TOTAL PROJECTED LIFT</span>
            <span style={{ color: C.green, fontFamily: mono, fontSize: 12, fontWeight: 700 }}>${(annLift / 1000).toFixed(0)}K/yr</span>
          </div>
        </div>

        {/* Amenity Gap */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AMENITY</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Amenity Gap vs Comps</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px 60px', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['AMENITY', 'YOU', 'COMPS', 'COST', 'LIFT'].map((h, i) => (
              <div key={i} style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>
          {amenityGap.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px 60px', padding: '4px 12px',
              borderBottom: `1px solid ${C.border}30`, alignItems: 'center',
              background: !a.has ? C.red + '04' : 'transparent' }}>
              <span style={{ color: C.text, fontSize: 10 }}>{a.name}</span>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: a.has ? C.green : C.red }}>{a.has ? '✓' : '✗'}</span>
              </div>
              <span style={{ textAlign: 'center', color: C.dim, fontFamily: mono, fontSize: 9 }}>{a.compPen}%</span>
              <span style={{ textAlign: 'center', color: a.cost !== '—' ? C.yellow : C.dim, fontFamily: mono, fontSize: 9 }}>{a.cost}</span>
              <span style={{ textAlign: 'center', color: a.liftPerUnit > 0 ? C.green : C.dim, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
                {a.liftPerUnit > 0 ? `+$${a.liftPerUnit}/u` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
