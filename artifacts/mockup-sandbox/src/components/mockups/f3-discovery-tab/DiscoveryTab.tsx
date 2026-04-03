export function DiscoveryTab() {
  const BT = {
    bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#131821' },
    text: { primary: '#E8ECF1', secondary: '#A0ABBE', muted: '#6B7A8D', cyan: '#00BCD4', green: '#00D26A', amber: '#F5A623', red: '#FF4757', purple: '#A78BFA' },
    border: { subtle: '#1E2538', medium: '#2A3348' },
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY', active: true },
    { id: 'demand', label: 'DEMAND', active: false },
    { id: 'comps', label: 'COMPS', active: false },
    { id: 'trends', label: 'TRENDS', active: false },
    { id: 'program', label: 'PROGRAM', active: false },
  ];

  const tiers = [
    {
      label: 'TRADE AREA', color: '#00D26A', count: 8, inSet: 4, expanded: true,
      comps: [
        { rank: 1, name: 'Alexan Buckhead Village', addr: '3060 Peachtree Rd NW', units: 350, built: 2021, stories: 24, cls: 'A', dist: '0.3mi', score: 92, inSet: true },
        { rank: 2, name: 'Hanover Midtown', addr: '1155 Peachtree St NE', units: 415, built: 2019, stories: 32, cls: 'A', dist: '0.5mi', score: 88, inSet: true },
        { rank: 3, name: 'AMLI Ponce Park', addr: '600 Ponce de Leon Ave', units: 310, built: 2022, stories: 6, cls: 'A', dist: '0.8mi', score: 81, inSet: true },
        { rank: 4, name: 'Modera Midtown', addr: '95 8th St NW', units: 295, built: 2018, stories: 21, cls: 'A', dist: '1.0mi', score: 76, inSet: true },
        { rank: 5, name: 'Icon Buckhead', addr: '3203 Lenox Rd NE', units: 280, built: 2017, stories: 18, cls: 'B+', dist: '1.2mi', score: 72, inSet: false },
        { rank: 6, name: 'Post Parkside', addr: '400 17th St NW', units: 225, built: 2015, stories: 5, cls: 'B+', dist: '1.4mi', score: 68, inSet: false },
        { rank: 7, name: 'Camden Paces', addr: '270 Buckhead Ave NE', units: 340, built: 2016, stories: 12, cls: 'B+', dist: '1.5mi', score: 65, inSet: false },
        { rank: 8, name: 'Gables Brookhaven', addr: '3925 Brookhaven Dr', units: 195, built: 2014, stories: 4, cls: 'B', dist: '1.8mi', score: 61, inSet: false },
      ]
    },
    { label: 'SUBMARKET', color: '#00BCD4', count: 12, inSet: 2, expanded: false, comps: [] },
    { label: 'MSA', color: '#A78BFA', count: 24, inSet: 0, expanded: false, comps: [] },
  ];

  const headers = ['#', 'PROPERTY', 'UNITS', 'BUILT', 'STOR', 'CLS', 'DIST', 'MATCH', 'SET'];

  return (
    <div style={{ minHeight: '100vh', background: BT.bg.terminal, fontFamily: "'Inter','Segoe UI',sans-serif", color: BT.text.primary }}>
      {/* Page Header */}
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: BT.border.subtle }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: BT.text.muted, fontSize: 10, fontFamily: mono }}>M03 · DEV · DEMAND + RENT + SUPPLY</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 9, padding: '2px 6px', background: '#00D26A15', borderRadius: 2 }}>DEV</span>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 9, padding: '2px 6px', background: '#00BCD415', borderRadius: 2 }}>F_RENT</span>
          <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 9, padding: '2px 6px', background: '#00D26A15', borderRadius: 2 }}>O_ABSORB</span>
        </div>
      </div>

      {/* Tab Bar — DISCOVERY is first and active */}
      <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '8px 18px', fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            cursor: 'pointer', borderBottom: t.active ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
            color: t.active ? BT.text.cyan : BT.text.muted,
            background: t.active ? '#00BCD408' : 'transparent',
          }}>{t.label}</div>
        ))}
      </div>

      {/* Discovery Content */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Status Bar — compact single row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 14px', background: BT.bg.panel, borderRadius: 4, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: BT.text.purple, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>COMP SET</span>
              <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 14, fontWeight: 800 }}>6</span>
              <span style={{ color: BT.text.muted, fontSize: 9 }}>selected</span>
            </div>
            <div style={{ width: 1, height: 16, background: BT.border.subtle }} />
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'AVG UNITS', value: '332' },
                { label: 'AVG DIST', value: '0.9mi' },
                { label: 'AVG MATCH', value: '84' },
              ].map(kpi => (
                <div key={kpi.label} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                  <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 8, letterSpacing: '0.06em' }}>{kpi.label}</span>
                  <span style={{ color: BT.text.primary, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{kpi.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button style={{ padding: '3px 10px', fontSize: 9, fontWeight: 700, fontFamily: mono,
              border: `1px solid ${BT.border.medium}`, borderRadius: 3,
              color: BT.text.secondary, background: 'transparent', cursor: 'pointer' }}>
              RESET DEFAULTS
            </button>
          </div>
        </div>

        {/* Tier Sections */}
        {tiers.map(tier => (
          <div key={tier.label} style={{ border: `1px solid ${tier.color}30`, borderRadius: 4, overflow: 'hidden' }}>
            {/* Tier Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px', background: `${tier.color}08`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: BT.text.secondary, fontSize: 12 }}>{tier.expanded ? '▾' : '▸'}</span>
                <span style={{ color: tier.color, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>{tier.label}</span>
                <span style={{ color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>({tier.count})</span>
                {tier.inSet > 0 && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
                    background: BT.text.green, color: BT.bg.terminal }}>{tier.inSet} in set</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, color: BT.text.muted, fontSize: 9, fontFamily: mono }}>
                <span>avg {tier.count > 0 ? '305' : '—'}u</span>
                <span>{tier.count > 0 ? '1.1' : '—'}mi</span>
              </div>
            </div>

            {/* Tier Table (expanded) */}
            {tier.expanded && tier.comps.length > 0 && (
              <div style={{ background: BT.bg.panel }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: BT.bg.header }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{
                          padding: '4px 10px', fontSize: 8, fontFamily: mono, fontWeight: 700,
                          letterSpacing: '0.06em', color: BT.text.muted,
                          textAlign: i === 1 ? 'left' : 'center',
                          width: i === 0 ? 28 : i === 1 ? 'auto' : i === 7 ? 60 : i === 8 ? 56 : 40,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tier.comps.map(c => {
                      const scoreColor = c.score >= 80 ? BT.text.green : c.score >= 60 ? BT.text.amber : BT.text.muted;
                      return (
                        <tr key={c.rank} style={{ borderTop: `1px solid ${BT.border.subtle}40` }}>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: BT.text.muted, fontFamily: mono, fontSize: 10 }}>{c.rank}</td>
                          <td style={{ padding: '5px 10px' }}>
                            <div style={{ color: BT.text.primary, fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                            <div style={{ color: BT.text.muted, fontSize: 9, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.addr}</div>
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.units}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.built}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.stories}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                              background: c.cls.startsWith('A') ? '#00BCD411' : '#F5A62311',
                              color: c.cls.startsWith('A') ? BT.text.cyan : BT.text.amber,
                            }}>{c.cls}</span>
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.dist}</td>
                          <td style={{ padding: '5px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: scoreColor, fontFamily: mono, fontSize: 10, fontWeight: 700, minWidth: 18 }}>{c.score}</span>
                              <div style={{ width: 36, height: 3, background: BT.bg.header, borderRadius: 1, overflow: 'hidden' }}>
                                <div style={{ width: `${c.score}%`, height: '100%', background: scoreColor, borderRadius: 1 }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 7px', fontSize: 8, fontWeight: 700, fontFamily: mono,
                              borderRadius: 3,
                              background: c.inSet ? '#00D26A18' : BT.bg.header,
                              color: c.inSet ? BT.text.green : BT.text.secondary,
                              border: `1px solid ${c.inSet ? '#00D26A55' : BT.border.medium}`,
                            }}>{c.inSet ? '✓ IN' : '+ ADD'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Flow indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', justifyContent: 'center' }}>
          <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: mono }}>FLOW</span>
          {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
            <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: 2,
                background: i === 0 ? BT.text.cyan + '20' : 'transparent',
                color: i === 0 ? BT.text.cyan : BT.text.muted,
                border: i === 0 ? `1px solid ${BT.text.cyan}40` : `1px solid ${BT.border.subtle}`,
              }}>{step}</span>
              {i < 4 && <span style={{ color: BT.border.medium, fontSize: 10 }}>→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
