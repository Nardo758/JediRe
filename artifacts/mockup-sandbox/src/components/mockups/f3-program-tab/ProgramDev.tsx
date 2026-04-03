export function ProgramDev() {
  const C = {
    bg: '#0A0E17', surface: '#0F1319', card: '#131821', border: '#1E2538',
    muted: '#2A3348', text: '#E8ECF1', dim: '#6B7A8D',
    studio: '#A78BFA', oneBR: '#00BCD4', twoBR: '#00D26A', threeBR: '#F5A623',
    subject: '#FF8C42', green: '#00D26A', red: '#FF4757', yellow: '#F5A623', blue: '#00BCD4',
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'demand', label: 'DEMAND' },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS' },
    { id: 'program', label: 'PROGRAM', active: true },
  ];

  const dealTypes = [
    { id: 'dev', label: 'DEVELOPMENT', active: true, desc: 'New construction · unconstrained mix', color: C.green },
    { id: 'redev', label: 'REDEVELOPMENT', active: false, desc: 'Existing asset · add/convert units', color: C.yellow },
    { id: 'exist', label: 'EXISTING', active: false, desc: 'Rent lift · gap analysis only', color: C.blue },
  ];

  const unitRows = [
    { abbr: 'STU', label: 'Studio', color: C.studio, mix: 5, sf: 510, rent: 1350, count: 13, annRev: '$199K', compMix: 3.2, compSf: 509, compRent: 1248, gap: -1.1 },
    { abbr: '1BR', label: '1 BR', color: C.oneBR, mix: 38, sf: 785, rent: 1750, count: 95, annRev: '$1.90M', compMix: 42.0, compSf: 766, compRent: 1634, gap: -2.4 },
    { abbr: '2BR', label: '2 BR', color: C.twoBR, mix: 44, sf: 1100, rent: 2100, count: 110, annRev: '$2.64M', compMix: 44.0, compSf: 1083, compRent: 1988, gap: 5.4 },
    { abbr: '3BR', label: '3 BR+', color: C.threeBR, mix: 13, sf: 1320, rent: 2480, count: 33, annRev: '$935K', compMix: 10.8, compSf: 1298, compRent: 2280, gap: -1.9 },
  ];

  const zoning = { code: 'PUD-R / C-3', maxUnits: 280, maxSF: 310000, maxHeight: 5, lotCov: 65, conf: 94 };
  const program = { totalUnits: 250, totalSF: 243650, grossRev: '$5.67M', wtdPsf: '$1.92' };
  const sfPct = (program.totalSF / zoning.maxSF * 100).toFixed(1);
  const unitPct = (program.totalUnits / zoning.maxUnits * 100).toFixed(1);

  const amenities = [
    { tier: 'BASE', items: [
      { name: 'Package Lockers', cost: '$45K', lift: '+$18/u', roi: '2.1yr' },
      { name: 'Fitness Center', cost: '$120K', lift: '+$25/u', roi: '1.7yr' },
      { name: 'Dog Park/Wash', cost: '$35K', lift: '+$12/u', roi: '1.0yr' },
    ]},
    { tier: 'COMPETITIVE', items: [
      { name: 'Rooftop Lounge', cost: '$280K', lift: '+$45/u', roi: '2.2yr' },
      { name: 'Coworking Space', cost: '$180K', lift: '+$35/u', roi: '1.8yr' },
      { name: 'EV Charging (8)', cost: '$64K', lift: '+$15/u', roi: '1.4yr' },
    ]},
    { tier: 'PREMIUM', items: [
      { name: 'Pool + Cabanas', cost: '$450K', lift: '+$65/u', roi: '2.5yr' },
      { name: 'Sky Deck w/ Grills', cost: '$320K', lift: '+$50/u', roi: '2.3yr' },
    ]},
  ];

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>M03 · PROGRAM</span>
        </div>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 8, padding: '2px 5px', background: '#00D26A15', borderRadius: 2 }}>DEVELOPMENT</span>
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
        <div style={{ background: C.card, border: `1px solid ${C.blue}30`, borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AI SYNTHESIS</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ color: C.text, fontSize: 10, fontWeight: 700 }}>Program Rationale</span>
          </div>
          <p style={{ color: C.dim, fontSize: 9, lineHeight: 1.5, margin: 0 }}>
            2BR units show strongest demand signal (score 91, vac 2.5%, +5.4pp gap). Recommend overweighting 2BR at 44% vs comp avg 44%.
            Studio demand is weak (score 42, vac 10.8%) — minimize to 5%. 1BR balanced at 38%. Zoning envelope supports 250u within 310K SF cap.
            Rooftop amenity package drives estimated +$45/u lift based on 3 comparable new deliveries in trade area.
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
                <span style={{ color: dt.active ? dt.color : C.dim, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>{dt.label}</span>
                {dt.active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dt.color }} />}
              </div>
              <span style={{ color: C.dim, fontSize: 8 }}>{dt.desc}</span>
            </div>
          ))}
        </div>

        {/* Zoning Constraints */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M02</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Zoning Envelope</span>
              <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: C.blue + '18', color: C.blue }}>{zoning.code}</span>
              <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: C.green + '18', color: C.green }}>{zoning.conf}% CONF</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border }}>
            {[
              { label: 'MAX UNITS', val: zoning.maxUnits, yours: program.totalUnits, pct: unitPct, suf: 'u' },
              { label: 'MAX NET SF', val: zoning.maxSF.toLocaleString(), yours: program.totalSF.toLocaleString(), pct: sfPct, suf: 'SF' },
              { label: 'MAX HEIGHT', val: `${zoning.maxHeight}`, yours: null, pct: null, suf: 'fl' },
              { label: 'LOT COVERAGE', val: `${zoning.lotCov}`, yours: null, pct: null, suf: '%' },
            ].map(f => (
              <div key={f.label} style={{ background: C.card, padding: '8px 12px' }}>
                <div style={{ color: C.dim, fontSize: 8, fontFamily: mono, marginBottom: 4 }}>{f.label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 14, fontWeight: 700 }}>{f.val}</span>
                    <span style={{ color: C.dim, fontSize: 9 }}>{f.suf}</span>
                  </div>
                  {f.yours && <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>→ {f.yours}</span>}
                </div>
                {f.pct && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 3, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, parseFloat(f.pct))}%`, height: '100%', background: parseFloat(f.pct) > 95 ? C.yellow : C.green, borderRadius: 2 }} />
                    </div>
                    <span style={{ color: parseFloat(f.pct) > 95 ? C.yellow : C.green, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{f.pct}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Unit Program Editor */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M03</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Unit Program</span>
              <span style={{ color: C.dim, fontSize: 8 }}>← fed from MixMatrix</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 7, fontWeight: 700, padding: '2px 6px', borderRadius: 2, background: C.blue + '14', border: `1px solid ${C.blue}35`, color: C.blue, cursor: 'pointer' }}>AI OPTIMIZE</span>
              <span style={{ fontSize: 7, fontWeight: 700, padding: '2px 6px', borderRadius: 2, border: `1px solid ${C.border}`, color: C.dim, cursor: 'pointer' }}>RESET</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border, borderBottom: `1px solid ${C.border}` }}>
            {[
              { label: 'TOTAL UNITS', val: `${program.totalUnits}`, sub: `/ ${zoning.maxUnits}`, color: C.subject },
              { label: 'NET SF', val: program.totalSF.toLocaleString(), color: C.text },
              { label: 'GROSS REV', val: program.grossRev, color: C.green },
              { label: 'WTD $/SF', val: program.wtdPsf, color: C.yellow },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: C.bg, padding: '6px 10px' }}>
                <div style={{ color: C.dim, fontSize: 7, fontFamily: mono, letterSpacing: '0.06em', marginBottom: 2 }}>{kpi.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ color: kpi.color, fontFamily: mono, fontSize: 13, fontWeight: 700 }}>{kpi.val}</span>
                  {kpi.sub && <span style={{ color: C.dim, fontFamily: mono, fontSize: 9 }}>{kpi.sub}</span>}
                </div>
              </div>
            ))}
          </div>

          {unitRows.map((u, ri) => (
            <div key={u.abbr} style={{ padding: '8px 12px', borderBottom: ri < unitRows.length - 1 ? `1px solid ${C.border}40` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: u.color }} />
                <span style={{ color: u.color, fontFamily: mono, fontSize: 10, fontWeight: 700, minWidth: 40 }}>{u.label}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 100, height: 5, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${u.mix}%`, height: '100%', background: u.color + 'aa', borderRadius: 2 }} />
                  </div>
                  <span style={{ color: C.subject, fontFamily: mono, fontSize: 11, fontWeight: 700, minWidth: 28 }}>{u.mix}%</span>
                  {u.compMix > 0 && (
                    <span style={{ color: (u.mix - u.compMix) > 0 ? C.green : (u.mix - u.compMix) < -2 ? C.red : C.dim, fontFamily: mono, fontSize: 8 }}>
                      {(u.mix - u.compMix) > 0 ? '+' : ''}{(u.mix - u.compMix).toFixed(1)}pp
                    </span>
                  )}
                </div>
                <span style={{ color: C.dim, fontFamily: mono, fontSize: 9 }}>×{u.count}</span>
                <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{u.annRev}<span style={{ color: C.dim, fontSize: 8 }}>/yr</span></span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 14 }}>
                {[
                  { label: 'SF', val: u.sf, comp: u.compSf, delta: u.sf - u.compSf },
                  { label: 'RENT', val: `$${u.rent.toLocaleString()}`, comp: `$${u.compRent.toLocaleString()}`, delta: u.rent - u.compRent },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.bg, borderRadius: 3, padding: '3px 8px', border: `1px solid ${C.border}40` }}>
                    <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>{m.label}</span>
                    <span style={{ color: C.subject, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{m.val}</span>
                    <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>avg {m.comp}</span>
                    <span style={{ color: m.delta > 0 ? C.green : m.delta < -20 ? C.red : C.dim, fontFamily: mono, fontSize: 8 }}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px' }}>
                  <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>$/SF</span>
                  <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>${(u.rent / u.sf).toFixed(2)}</span>
                </div>
                {u.gap > 3 && (
                  <span style={{ fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2, background: C.green + '18', color: C.green }}>
                    GAP +{u.gap.toFixed(1)}pp ▲
                  </span>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: C.bg, borderTop: `2px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: C.dim, fontSize: 8, fontFamily: mono, fontWeight: 700 }}>TOTALS</span>
              <span style={{ color: C.green, fontFamily: mono, fontSize: 12, fontWeight: 800 }}>100%</span>
              <span style={{ color: C.border }}>|</span>
              <span style={{ color: C.text, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{program.totalUnits} units</span>
              <span style={{ color: C.border }}>|</span>
              <span style={{ color: C.dim, fontFamily: mono, fontSize: 10 }}>{Math.round(program.totalSF / program.totalUnits).toLocaleString()} avg SF</span>
            </div>
            <span style={{ color: C.green, fontFamily: mono, fontSize: 12, fontWeight: 700 }}>{program.grossRev}/yr</span>
          </div>
        </div>

        {/* Amenity Package Builder */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>AMENITY</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Amenity Package Builder</span>
              <span style={{ color: C.dim, fontSize: 8 }}>new construction · build from scratch</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>TOTAL COST</span>
              <span style={{ color: C.yellow, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>$1.49M</span>
              <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>EST LIFT</span>
              <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>+$265/u</span>
            </div>
          </div>
          {amenities.map((tier, ti) => (
            <div key={tier.tier}>
              <div style={{ padding: '4px 12px', background: C.bg, borderBottom: `1px solid ${C.border}`, borderTop: ti > 0 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{
                  fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  color: tier.tier === 'BASE' ? C.green : tier.tier === 'COMPETITIVE' ? C.yellow : C.studio,
                }}>{tier.tier}</span>
              </div>
              {tier.items.map((item, ii) => (
                <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px 32px', padding: '5px 12px',
                  borderBottom: `1px solid ${C.border}30`, alignItems: 'center' }}>
                  <span style={{ color: C.text, fontSize: 10 }}>{item.name}</span>
                  <span style={{ color: C.dim, fontFamily: mono, fontSize: 9, textAlign: 'right' }}>{item.cost}</span>
                  <span style={{ color: C.green, fontFamily: mono, fontSize: 9, fontWeight: 700, textAlign: 'right' }}>{item.lift}</span>
                  <span style={{ color: C.dim, fontFamily: mono, fontSize: 8, textAlign: 'right' }}>{item.roi}</span>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: C.green + '18', color: C.green, border: `1px solid ${C.green}40` }}>✓</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2,
              background: i === 4 ? C.blue + '20' : 'transparent',
              color: i === 4 ? C.blue : C.dim,
              border: i === 4 ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
            }}>{step}</span>
            {i < 4 && <span style={{ color: C.muted, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
