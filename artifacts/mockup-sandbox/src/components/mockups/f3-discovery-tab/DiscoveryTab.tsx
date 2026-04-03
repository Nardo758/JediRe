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

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY', active: true },
    { id: 'demand', label: 'DEMAND', active: false },
    { id: 'comps', label: 'COMPS', active: false },
    { id: 'trends', label: 'TRENDS', active: false },
    { id: 'program', label: 'PROGRAM', active: false },
  ];

  const comps = [
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
    { mx: 90, my: 110 }, { mx: 400, my: 320 }, { mx: 60, my: 370 },
    { mx: 420, my: 180 }, { mx: 130, my: 400 }, { mx: 380, my: 380 },
  ];

  const headers = ['#', 'PROPERTY', 'UNITS', 'BUILT', 'CLS', 'DIST', 'MATCH', 'SET'];

  const scoreColor = (s: number) => s >= 80 ? BT.text.green : s >= 60 ? BT.text.amber : BT.text.muted;

  const mapW = viewMode === 'map' ? '100%' : '44%';
  const showTable = viewMode !== 'map';
  const showMap = viewMode !== 'list';

  return (
    <div style={{ height: '100vh', background: BT.bg.terminal, fontFamily: "'Inter','Segoe UI',sans-serif", color: BT.text.primary, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: BT.border.subtle }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: BT.text.muted, fontSize: 10, fontFamily: mono }}>M03 · DEV</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 9, padding: '2px 6px', background: '#00D26A15', borderRadius: 2 }}>DEV</span>
          <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 9, padding: '2px 6px', background: '#00BCD415', borderRadius: 2 }}>ATL-BUCKHEAD</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '8px 18px', fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            cursor: 'pointer', borderBottom: t.active ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
            color: t.active ? BT.text.cyan : BT.text.muted,
            background: t.active ? '#00BCD408' : 'transparent',
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ padding: '10px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 14px', background: BT.bg.panel, borderRadius: 4, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: BT.text.purple, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>COMP SET</span>
              <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 14, fontWeight: 800 }}>4</span>
              <span style={{ color: BT.text.muted, fontSize: 9 }}>selected</span>
            </div>
            <div style={{ width: 1, height: 16, background: BT.border.subtle }} />
            {[
              { label: 'AVG UNITS', value: '343' },
              { label: 'AVG DIST', value: '0.7mi' },
              { label: 'AVG MATCH', value: '84' },
              { label: 'RADIUS', value: '2.0mi' },
            ].map(kpi => (
              <div key={kpi.label} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 8, letterSpacing: '0.06em' }}>{kpi.label}</span>
                <span style={{ color: BT.text.primary, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{kpi.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {(['list', 'split', 'map'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '3px 8px', fontSize: 8, fontWeight: 700, fontFamily: mono,
                border: `1px solid ${viewMode === m ? BT.text.cyan + '60' : BT.border.medium}`, borderRadius: 3,
                color: viewMode === m ? BT.text.cyan : BT.text.muted,
                background: viewMode === m ? '#00BCD410' : 'transparent', cursor: 'pointer',
                textTransform: 'uppercase',
              }}>{m === 'list' ? '☰ LIST' : m === 'split' ? '◧ SPLIT' : '◻ MAP'}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 10, padding: '0 20px 10px', overflow: 'hidden', minHeight: 0 }}>
        {showTable && (
          <div style={{ flex: viewMode === 'list' ? 1 : 0, width: viewMode === 'list' ? '100%' : '56%', minWidth: viewMode === 'list' ? undefined : '56%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            <div style={{ border: `1px solid ${BT.text.green}30`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: '#00D26A08' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: BT.text.secondary, fontSize: 11 }}>▾</span>
                  <span style={{ color: BT.text.green, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>TRADE AREA</span>
                  <span style={{ color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>(8)</span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: BT.text.green, color: BT.bg.terminal }}>4 in set</span>
                </div>
                <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: mono }}>≤ 2.0mi</span>
              </div>
              <div style={{ background: BT.bg.panel }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: BT.bg.header }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{
                          padding: '4px 8px', fontSize: 8, fontFamily: mono, fontWeight: 700,
                          letterSpacing: '0.06em', color: BT.text.muted,
                          textAlign: i === 1 ? 'left' : 'center',
                          width: i === 0 ? 24 : i === 1 ? 'auto' : i === 6 ? 56 : i === 7 ? 48 : 36,
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
                          transition: 'background 0.15s',
                        }}>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: BT.text.muted, fontFamily: mono, fontSize: 10 }}>{c.rank}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ color: hoveredComp === c.rank ? BT.text.cyan : BT.text.primary, fontSize: 11, fontWeight: 600, transition: 'color 0.15s' }}>{c.name}</div>
                          <div style={{ color: BT.text.muted, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.addr}</div>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.units}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.built}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                            background: c.cls.startsWith('A') ? '#00BCD411' : '#F5A62311',
                            color: c.cls.startsWith('A') ? BT.text.cyan : BT.text.amber }}>{c.cls}</span>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center', color: BT.text.secondary, fontFamily: mono, fontSize: 10 }}>{c.dist}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: scoreColor(c.score), fontFamily: mono, fontSize: 10, fontWeight: 700, minWidth: 16 }}>{c.score}</span>
                            <div style={{ width: 30, height: 3, background: BT.bg.header, borderRadius: 1, overflow: 'hidden' }}>
                              <div style={{ width: `${c.score}%`, height: '100%', background: scoreColor(c.score), borderRadius: 1 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 6px', fontSize: 8, fontWeight: 700, fontFamily: mono, borderRadius: 3,
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
            </div>

            <div style={{ border: `1px solid ${BT.text.cyan}30`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: '#00BCD408' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: BT.text.secondary, fontSize: 11 }}>▸</span>
                  <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>SUBMARKET</span>
                  <span style={{ color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>(12)</span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: '#00BCD430', color: BT.text.cyan }}>2 in set</span>
                </div>
                <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: mono }}>2–5mi</span>
              </div>
            </div>

            <div style={{ border: `1px solid ${BT.text.purple}30`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: '#A78BFA08' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: BT.text.secondary, fontSize: 11 }}>▸</span>
                  <span style={{ color: BT.text.purple, fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>MSA</span>
                  <span style={{ color: BT.text.secondary, fontFamily: mono, fontSize: 9 }}>(24)</span>
                </div>
                <span style={{ color: BT.text.muted, fontSize: 9, fontFamily: mono }}>5mi+</span>
              </div>
            </div>
          </div>
        )}

        {showMap && (
          <div style={{
            width: viewMode === 'map' ? '100%' : mapW,
            minWidth: viewMode === 'map' ? undefined : mapW,
            borderRadius: 4, border: `1px solid ${BT.border.subtle}`,
            background: BT.bg.panel, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: BT.text.cyan, fontFamily: mono, fontSize: 8, fontWeight: 700, padding: '2px 6px', background: '#00BCD415', borderRadius: 2, border: `1px solid ${BT.border.subtle}` }}>MAP VIEW</span>
              <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 8 }}>ATL · 33.848°N 84.373°W</span>
            </div>

            <div style={{ position: 'absolute', top: 8, right: 10, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {['+', '−'].map(z => (
                <div key={z} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: BT.bg.header, border: `1px solid ${BT.border.subtle}`, borderRadius: 3,
                  color: BT.text.secondary, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{z}</div>
              ))}
            </div>

            <svg width="100%" height="100%" viewBox="0 0 460 460" style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                <radialGradient id="mapBg" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="#111825" />
                  <stop offset="100%" stopColor="#0A0E17" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width="460" height="460" fill="url(#mapBg)" />

              <line x1="0" y1="120" x2="460" y2="120" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="0" y1="230" x2="460" y2="230" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="0" y1="340" x2="460" y2="340" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="120" y1="0" x2="120" y2="460" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="230" y1="0" x2="230" y2="460" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="340" y1="0" x2="340" y2="460" stroke="#1E2538" strokeWidth="0.5" strokeDasharray="4 4" />

              <path d="M 60,380 Q 120,300 180,270 T 300,180 T 400,80" stroke="#1E2538" strokeWidth="1.5" fill="none" opacity="0.6" />
              <path d="M 30,200 Q 100,220 200,230 T 430,250" stroke="#1E2538" strokeWidth="2" fill="none" opacity="0.5" />
              <path d="M 200,20 Q 210,100 220,200 T 240,440" stroke="#1E2538" strokeWidth="2" fill="none" opacity="0.5" />

              <path d="M 80,140 L 160,180 L 220,160 L 280,190 L 350,160" stroke="#2A3348" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M 100,280 L 170,310 L 250,290 L 330,320 L 400,290" stroke="#2A3348" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M 140,60 L 150,140 L 160,260 L 170,380" stroke="#2A3348" strokeWidth="1" fill="none" opacity="0.4" />
              <path d="M 320,50 L 310,150 L 300,280 L 290,400" stroke="#2A3348" strokeWidth="1" fill="none" opacity="0.4" />

              <circle cx="230" cy="230" r="60" stroke="#00D26A" strokeWidth="0.8" fill="none" opacity="0.25" strokeDasharray="3 2" />
              <circle cx="230" cy="230" r="120" stroke="#00BCD4" strokeWidth="0.6" fill="none" opacity="0.15" strokeDasharray="3 3" />
              <circle cx="230" cy="230" r="190" stroke="#A78BFA" strokeWidth="0.5" fill="none" opacity="0.1" strokeDasharray="4 4" />

              <text x="295" y="178" fill="#00D26A" fontSize="7" fontFamily={mono} opacity="0.4">0.5mi</text>
              <text x="355" y="125" fill="#00BCD4" fontSize="7" fontFamily={mono} opacity="0.3">1.0mi</text>
              <text x="410" y="60" fill="#A78BFA" fontSize="7" fontFamily={mono} opacity="0.2">2.0mi</text>

              {subComps.map((s, i) => (
                <g key={`sub-${i}`}>
                  <circle cx={s.mx} cy={s.my} r="3" fill="#00BCD4" opacity="0.2" />
                  <circle cx={s.mx} cy={s.my} r="1.5" fill="#00BCD4" opacity="0.4" />
                </g>
              ))}

              {comps.map(c => {
                const isHovered = hoveredComp === c.rank;
                const pinColor = c.inSet ? BT.text.green : BT.text.amber;
                const r = isHovered ? 7 : 5;
                return (
                  <g key={c.rank}
                    onMouseEnter={() => setHoveredComp(c.rank)}
                    onMouseLeave={() => setHoveredComp(null)}
                    style={{ cursor: 'pointer' }}>
                    {isHovered && <circle cx={c.mx} cy={c.my} r="14" fill={pinColor} opacity="0.08" />}
                    <circle cx={c.mx} cy={c.my} r={r + 2} fill={pinColor} opacity={isHovered ? 0.25 : 0.12} />
                    <circle cx={c.mx} cy={c.my} r={r} fill={BT.bg.terminal} stroke={pinColor} strokeWidth={isHovered ? 2 : 1.5} />
                    <text x={c.mx} y={c.my + 3.5} textAnchor="middle" fill={pinColor} fontSize={isHovered ? 8 : 7} fontFamily={mono} fontWeight="700">{c.rank}</text>
                    {isHovered && (
                      <g>
                        <rect x={c.mx + 12} y={c.my - 20} width={130} height={32} rx="3" fill={BT.bg.header} stroke={BT.border.medium} strokeWidth="1" opacity="0.95" />
                        <text x={c.mx + 18} y={c.my - 7} fill={BT.text.primary} fontSize="9" fontWeight="600">{c.name}</text>
                        <text x={c.mx + 18} y={c.my + 4} fill={BT.text.muted} fontSize="7" fontFamily={mono}>
                          {c.units}u · {c.cls} · {c.dist} · {c.score}%
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              <g>
                <circle cx="230" cy="230" r="8" fill="#FF8C42" opacity="0.15" />
                <circle cx="230" cy="230" r="5" fill={BT.bg.terminal} stroke="#FF8C42" strokeWidth="2" />
                <circle cx="230" cy="230" r="2" fill="#FF8C42" />
                <text x="242" y="226" fill="#FF8C42" fontSize="8" fontFamily={mono} fontWeight="700">SUBJECT</text>
                <text x="242" y="236" fill={BT.text.muted} fontSize="7" fontFamily={mono}>Buckhead Site</text>
              </g>
            </svg>

            <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, display: 'flex', gap: 12, alignItems: 'center', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: 10, padding: '4px 8px', background: BT.bg.header + 'DD', borderRadius: 3, border: `1px solid ${BT.border.subtle}` }}>
                {[
                  { color: '#FF8C42', label: 'Subject' },
                  { color: BT.text.green, label: 'In Set' },
                  { color: BT.text.amber, label: 'Available' },
                  { color: BT.text.cyan, label: 'Submarket' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                    <span style={{ color: BT.text.muted, fontFamily: mono, fontSize: 7 }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {['SATELLITE', 'ROADS', 'HEATMAP'].map((opt, i) => (
                  <span key={opt} style={{
                    fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                    background: i === 1 ? '#00BCD415' : 'transparent',
                    color: i === 1 ? BT.text.cyan : BT.text.muted,
                    border: `1px solid ${i === 1 ? BT.text.cyan + '40' : BT.border.subtle}`,
                    cursor: 'pointer',
                  }}>{opt}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '6px 20px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexShrink: 0 }}>
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
  );
}
