import { useState } from 'react';

export function DiscoveryTab() {
  const BT = {
    bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#131821' },
    text: { primary: '#E8ECF1', secondary: '#A0ABBE', muted: '#6B7A8D', cyan: '#00BCD4', green: '#00D26A', amber: '#F5A623', red: '#FF4757', purple: '#A78BFA' },
    border: { subtle: '#1E2538', medium: '#2A3348' },
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const [hoveredComp, setHoveredComp] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split');
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({ trade: true, sub: true, msa: false });

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY', active: true },
    { id: 'demand', label: 'DEMAND', active: false },
    { id: 'comps', label: 'COMPS', active: false },
    { id: 'trends', label: 'TRENDS', active: false },
    { id: 'program', label: 'PROGRAM', active: false },
  ];

  const tradeComps = [
    { rank: 1, name: 'Alexan Buckhead Village', addr: '3060 Peachtree Rd NW', units: 350, built: 2021, cls: 'A', dist: '0.3mi', score: 92, inSet: true, mx: 280, my: 195 },
    { rank: 2, name: 'Hanover Midtown', addr: '1155 Peachtree St NE', units: 415, built: 2019, cls: 'A', dist: '0.5mi', score: 88, inSet: true, mx: 220, my: 240 },
    { rank: 3, name: 'AMLI Ponce Park', addr: '600 Ponce de Leon Ave', units: 310, built: 2022, cls: 'A', dist: '0.8mi', score: 81, inSet: true, mx: 185, my: 280 },
    { rank: 4, name: 'Modera Midtown', addr: '95 8th St NW', units: 295, built: 2018, cls: 'A', dist: '1.0mi', score: 76, inSet: true, mx: 240, my: 310 },
    { rank: 5, name: 'Icon Buckhead', addr: '3203 Lenox Rd NE', units: 280, built: 2017, cls: 'B+', dist: '1.2mi', score: 72, inSet: false, mx: 330, my: 155 },
    { rank: 6, name: 'Post Parkside', addr: '400 17th St NW', units: 225, built: 2015, cls: 'B+', dist: '1.4mi', score: 68, inSet: false, mx: 155, my: 330 },
    { rank: 7, name: 'Camden Paces', addr: '270 Buckhead Ave NE', units: 340, built: 2016, cls: 'B+', dist: '1.5mi', score: 65, inSet: false, mx: 310, my: 130 },
    { rank: 8, name: 'Gables Brookhaven', addr: '3925 Brookhaven Dr', units: 195, built: 2014, cls: 'B', dist: '1.8mi', score: 61, inSet: false, mx: 370, my: 100 },
  ];

  const subComps = [
    { rank: 9, name: 'Broadstone Lenox Park', addr: '3755 Lenox Park Blvd', units: 420, built: 2020, cls: 'A', dist: '2.3mi', score: 58, inSet: true, mx: 90, my: 110 },
    { rank: 10, name: 'Novel Midtown', addr: '1460 Spring St NW', units: 285, built: 2023, cls: 'A', dist: '2.8mi', score: 55, inSet: true, mx: 400, my: 320 },
    { rank: 11, name: 'Accent Druid Hills', addr: '1705 Briarcliff Rd', units: 198, built: 2016, cls: 'B+', dist: '3.1mi', score: 52, inSet: false, mx: 60, my: 370 },
    { rank: 12, name: 'Cortland Vinings', addr: '2800 Paces Ferry Rd', units: 330, built: 2018, cls: 'B+', dist: '3.5mi', score: 49, inSet: false, mx: 420, my: 180 },
    { rank: 13, name: 'Alta Druid Hills', addr: '1920 N Druid Hills Rd', units: 265, built: 2019, cls: 'A', dist: '3.9mi', score: 46, inSet: false, mx: 130, my: 400 },
    { rank: 14, name: 'MAA Brookhaven', addr: '4045 Peachtree Rd', units: 312, built: 2015, cls: 'B+', dist: '4.2mi', score: 43, inSet: false, mx: 380, my: 380 },
  ];

  const msaComps = [
    { rank: 15, name: 'Alexan Perimeter', addr: '4800 Ashford Dunwoody', units: 380, built: 2021, cls: 'A', dist: '6.1mi', score: 41, inSet: false, mx: 0, my: 0 },
    { rank: 16, name: 'Camden Dunwoody', addr: '100 Perimeter Center W', units: 290, built: 2017, cls: 'B+', dist: '7.4mi', score: 38, inSet: false, mx: 0, my: 0 },
    { rank: 17, name: 'Post Riverside', addr: '700 Riverside Pkwy', units: 445, built: 2022, cls: 'A', dist: '8.2mi', score: 36, inSet: false, mx: 0, my: 0 },
    { rank: 18, name: 'Cortland Decatur', addr: '315 Church St', units: 210, built: 2019, cls: 'A', dist: '9.0mi', score: 34, inSet: false, mx: 0, my: 0 },
  ];

  const allMapComps = [...tradeComps, ...subComps.filter(c => c.mx > 0)];

  const tiers = [
    { id: 'trade', label: 'TRADE AREA', color: BT.text.green, comps: tradeComps, range: '≤ 2.0mi', inSet: tradeComps.filter(c => c.inSet).length },
    { id: 'sub', label: 'SUBMARKET', color: BT.text.cyan, comps: subComps, range: '2–5mi', inSet: subComps.filter(c => c.inSet).length },
    { id: 'msa', label: 'MSA', color: BT.text.purple, comps: msaComps, range: '5mi+', inSet: 0 },
  ];

  const headers = ['#', 'PROPERTY', 'UNITS', 'BUILT', 'CLS', 'DIST', 'MATCH', 'SET'];
  const scoreColor = (s: number) => s >= 80 ? BT.text.green : s >= 60 ? BT.text.amber : s >= 40 ? BT.text.secondary : BT.text.muted;
  const totalInSet = tiers.reduce((s, t) => s + t.inSet, 0);
  const showTable = viewMode !== 'map';
  const showMap = viewMode !== 'list';

  function toggleTier(id: string) {
    setExpandedTiers(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function renderTable(comps: typeof tradeComps) {
    return (
      <div style={{ background: BT.bg.panel }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '3px 6px', fontSize: 7, fontFamily: mono, fontWeight: 700,
                  letterSpacing: '0.06em', color: BT.text.muted,
                  textAlign: i === 1 ? 'left' : 'center',
                  width: i === 0 ? 20 : i === 1 ? 'auto' : i === 6 ? 50 : i === 7 ? 42 : 32,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comps.map(c => (
              <tr key={c.rank}
                onMouseEnter={() => setHoveredComp(c.rank)}
                onMouseLeave={() => setHoveredComp(null)}
                style={{
                  borderTop: `1px solid ${BT.border.subtle}40`,
                  background: hoveredComp === c.rank ? '#00BCD408' : 'transparent',
                }}>
                <td style={{ padding: '3px 6px', textAlign: 'center', color: BT.text.muted, fontFamily: mono, fontSize: 9 }}>{c.rank}</td>
                <td style={{ padding: '3px 6px' }}>
                  <div style={{ color: hoveredComp === c.rank ? BT.text.cyan : BT.text.primary, fontSize: 10, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: BT.text.muted, fontSize: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{c.addr}</div>
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>{c.units}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>{c.built}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 3px', borderRadius: 2,
                    background: c.cls.startsWith('A') ? '#00BCD411' : '#F5A62311',
                    color: c.cls.startsWith('A') ? BT.text.cyan : BT.text.amber }}>{c.cls}</span>
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>{c.dist}</td>
                <td style={{ padding: '3px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ color: scoreColor(c.score), fontFamily: mono, fontSize: 9, fontWeight: 700, minWidth: 14 }}>{c.score}</span>
                    <div style={{ width: 24, height: 2, background: BT.bg.header, borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ width: `${c.score}%`, height: '100%', background: scoreColor(c.score), borderRadius: 1 }} />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                  <span style={{
                    padding: '1px 5px', fontSize: 7, fontWeight: 700, fontFamily: mono, borderRadius: 2,
                    background: c.inSet ? '#00D26A18' : BT.bg.header,
                    color: c.inSet ? BT.text.green : BT.text.secondary,
                    border: `1px solid ${c.inSet ? '#00D26A55' : BT.border.medium}`,
                  }}>{c.inSet ? '✓ IN' : '+ ADD'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: BT.bg.terminal, fontFamily: "'Inter','Segoe UI',sans-serif", color: BT.text.primary, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: BT.border.subtle }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: mono }}>M03 · DEV</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 8, padding: '2px 5px', background: '#00D26A15', borderRadius: 2 }}>DEV</span>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 8, padding: '2px 5px', background: '#00BCD415', borderRadius: 2 }}>ATL-BUCKHEAD</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '7px 14px', fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            cursor: 'pointer', borderBottom: t.active ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
            color: t.active ? BT.text.cyan : BT.text.muted,
            background: t.active ? '#00BCD408' : 'transparent',
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 12px', background: BT.bg.panel, borderRadius: 4, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ color: BT.text.purple, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>COMP SET</span>
              <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 13, fontWeight: 800 }}>{totalInSet}</span>
              <span style={{ color: BT.text.muted, fontSize: 8 }}>selected</span>
            </div>
            <div style={{ width: 1, height: 14, background: BT.border.subtle }} />
            {[
              { label: 'TRADE', value: `${tiers[0].inSet}`, c: BT.text.green },
              { label: 'SUB', value: `${tiers[1].inSet}`, c: BT.text.cyan },
              { label: 'MSA', value: `${tiers[2].inSet}`, c: BT.text.purple },
            ].map(kpi => (
              <div key={kpi.label} style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 7 }}>{kpi.label}</span>
                <span style={{ color: kpi.c, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{kpi.value}</span>
              </div>
            ))}
            <div style={{ width: 1, height: 14, background: BT.border.subtle }} />
            {[
              { label: 'AVG MATCH', value: '64' },
              { label: 'RADIUS', value: '2.0mi' },
            ].map(kpi => (
              <div key={kpi.label} style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 7 }}>{kpi.label}</span>
                <span style={{ color: BT.text.primary, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{kpi.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {(['list', 'split', 'map'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '2px 7px', fontSize: 7, fontWeight: 700, fontFamily: mono,
                border: `1px solid ${viewMode === m ? BT.text.cyan + '60' : BT.border.medium}`, borderRadius: 3,
                color: viewMode === m ? BT.text.cyan : BT.text.muted,
                background: viewMode === m ? '#00BCD410' : 'transparent', cursor: 'pointer',
              }}>{m === 'list' ? '☰ LIST' : m === 'split' ? '◧ SPLIT' : '◻ MAP'}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 8, padding: '0 16px 8px', overflow: 'hidden', minHeight: 0 }}>
        {showTable && (
          <div style={{ flex: viewMode === 'list' ? 1 : 0, width: viewMode === 'list' ? '100%' : '58%', minWidth: viewMode === 'list' ? undefined : '58%', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
            {tiers.map(tier => (
              <div key={tier.id} style={{ border: `1px solid ${tier.color}30`, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                <div onClick={() => toggleTier(tier.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: `${tier.color}08`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: BT.text.secondary, fontSize: 10 }}>{expandedTiers[tier.id] ? '▾' : '▸'}</span>
                    <span style={{ color: tier.color, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em' }}>{tier.label}</span>
                    <span style={{ color: BT.text.secondary, fontFamily: mono, fontSize: 8 }}>({tier.comps.length})</span>
                    {tier.inSet > 0 && (
                      <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: BT.text.green, color: BT.bg.terminal }}>{tier.inSet} in set</span>
                    )}
                  </div>
                  <span style={{ color: BT.text.muted, fontSize: 8, fontFamily: mono }}>{tier.range}</span>
                </div>
                {expandedTiers[tier.id] && renderTable(tier.comps)}
              </div>
            ))}
          </div>
        )}

        {showMap && (
          <div style={{
            width: viewMode === 'map' ? '100%' : '42%',
            minWidth: viewMode === 'map' ? undefined : '42%',
            borderRadius: 4, border: `1px solid ${BT.border.subtle}`,
            background: BT.bg.panel, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 10, display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', background: '#00BCD415', borderRadius: 2, border: `1px solid ${BT.border.subtle}` }}>MAP</span>
              <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 7 }}>33.848°N 84.373°W</span>
            </div>
            <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {['+', '−'].map(z => (
                <div key={z} style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: BT.bg.header, border: `1px solid ${BT.border.subtle}`, borderRadius: 3,
                  color: BT.text.secondary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{z}</div>
              ))}
            </div>

            <svg width="100%" height="100%" viewBox="0 0 460 460" style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                <radialGradient id="mapBg" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="#111825" />
                  <stop offset="100%" stopColor="#0A0E17" />
                </radialGradient>
              </defs>
              <rect width="460" height="460" fill="url(#mapBg)" />
              {[120, 230, 340].map(y => <line key={`h${y}`} x1="0" y1={y} x2="460" y2={y} stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />)}
              {[120, 230, 340].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="460" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />)}
              <path d="M 60,380 Q 120,300 180,270 T 300,180 T 400,80" stroke="#1E2538" strokeWidth="1.5" fill="none" opacity="0.6" />
              <path d="M 30,200 Q 100,220 200,230 T 430,250" stroke="#1E2538" strokeWidth="2" fill="none" opacity="0.5" />
              <path d="M 200,20 Q 210,100 220,200 T 240,440" stroke="#1E2538" strokeWidth="2" fill="none" opacity="0.5" />

              <circle cx="230" cy="230" r="60" stroke={BT.text.green} strokeWidth="0.8" fill="none" opacity="0.25" strokeDasharray="3 2" />
              <circle cx="230" cy="230" r="120" stroke={BT.text.cyan} strokeWidth="0.6" fill="none" opacity="0.18" strokeDasharray="3 3" />
              <circle cx="230" cy="230" r="190" stroke={BT.text.purple} strokeWidth="0.5" fill="none" opacity="0.12" strokeDasharray="4 4" />
              <text x="295" y="178" fill={BT.text.green} fontSize="7" fontFamily={mono} opacity="0.5">0.5mi</text>
              <text x="355" y="125" fill={BT.text.cyan} fontSize="7" fontFamily={mono} opacity="0.4">1.0mi</text>
              <text x="410" y="60" fill={BT.text.purple} fontSize="7" fontFamily={mono} opacity="0.3">2.0mi</text>

              {allMapComps.map(c => {
                const isHovered = hoveredComp === c.rank;
                const isTrade = c.rank <= 8;
                const pinColor = c.inSet ? BT.text.green : isTrade ? BT.text.amber : BT.text.cyan;
                const r = isHovered ? 6 : isTrade ? 5 : 3.5;
                return (
                  <g key={c.rank}
                    onMouseEnter={() => setHoveredComp(c.rank)}
                    onMouseLeave={() => setHoveredComp(null)}
                    style={{ cursor: 'pointer' }}>
                    {isHovered && <circle cx={c.mx} cy={c.my} r="12" fill={pinColor} opacity="0.08" />}
                    <circle cx={c.mx} cy={c.my} r={r + 1.5} fill={pinColor} opacity={isHovered ? 0.25 : 0.12} />
                    <circle cx={c.mx} cy={c.my} r={r} fill={BT.bg.terminal} stroke={pinColor} strokeWidth={isHovered ? 2 : 1.5} />
                    <text x={c.mx} y={c.my + (isTrade ? 3 : 2.5)} textAnchor="middle" fill={pinColor} fontSize={isTrade ? 7 : 6} fontFamily={mono} fontWeight="700">{c.rank}</text>
                    {isHovered && (
                      <g>
                        <rect x={c.mx + 10} y={c.my - 18} width={120} height={28} rx="3" fill={BT.bg.header} stroke={BT.border.medium} strokeWidth="1" opacity="0.95" />
                        <text x={c.mx + 15} y={c.my - 6} fill={BT.text.primary} fontSize="8" fontWeight="600">{c.name}</text>
                        <text x={c.mx + 15} y={c.my + 3} fill={BT.text.muted} fontSize="6" fontFamily={mono}>{c.units}u · {c.cls} · {c.dist} · {c.score}%</text>
                      </g>
                    )}
                  </g>
                );
              })}

              <g>
                <circle cx="230" cy="230" r="7" fill="#FF8C42" opacity="0.15" />
                <circle cx="230" cy="230" r="4.5" fill={BT.bg.terminal} stroke="#FF8C42" strokeWidth="2" />
                <circle cx="230" cy="230" r="2" fill="#FF8C42" />
                <text x="240" y="226" fill="#FF8C42" fontSize="7" fontFamily={mono} fontWeight="700">SUBJECT</text>
              </g>
            </svg>

            <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, display: 'flex', gap: 10, alignItems: 'center', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: 8, padding: '3px 6px', background: BT.bg.header + 'DD', borderRadius: 3, border: `1px solid ${BT.border.subtle}` }}>
                {[
                  { color: '#FF8C42', label: 'Subject' },
                  { color: BT.text.green, label: 'In Set' },
                  { color: BT.text.amber, label: 'Trade' },
                  { color: BT.text.cyan, label: 'Submarket' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: l.color }} />
                    <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 6 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: BT.text.muted, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 5px', borderRadius: 2,
              background: i === 0 ? BT.text.cyan + '20' : 'transparent',
              color: i === 0 ? BT.text.cyan : BT.text.muted,
              border: i === 0 ? `1px solid ${BT.text.cyan}40` : `1px solid ${BT.border.subtle}`,
            }}>{step}</span>
            {i < 4 && <span style={{ color: BT.border.medium, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
