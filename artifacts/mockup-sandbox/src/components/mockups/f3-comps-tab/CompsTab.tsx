export function CompsTab() {
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
    { id: 'comps', label: 'COMPS', active: true },
    { id: 'trends', label: 'TRENDS' },
    { id: 'program', label: 'PROGRAM' },
  ];

  const utMeta = [
    { abbr: 'STU', color: C.studio },
    { abbr: '1BR', color: C.oneBR },
    { abbr: '2BR', color: C.twoBR },
    { abbr: '3BR', color: C.threeBR },
  ];

  const mixData = [
    { name: '★ Subject', cls: 'A', total: 250, isSubject: true, mix: [5, 38, 44, 13] },
    { name: 'Sandpiper Cove', cls: 'A', total: 248, isSubject: false, mix: [8, 45, 37, 10] },
    { name: 'Avana Crossings', cls: 'A', total: 312, isSubject: false, mix: [0, 38, 52, 10] },
    { name: 'Harbour Pointe', cls: 'B+', total: 400, isSubject: false, mix: [3, 35, 48, 14] },
    { name: 'The Enclave PSL', cls: 'B', total: 180, isSubject: false, mix: [5, 42, 43, 10] },
    { name: 'Madera Ridge', cls: 'B', total: 220, isSubject: false, mix: [0, 50, 40, 10] },
  ];
  const compAvg = [3.2, 42.0, 44.0, 10.8];

  const scatterPts = [
    { x: 510, y: 1350, ut: 0, isSubject: true, name: 'Subject' },
    { x: 525, y: 1310, ut: 0, isSubject: false, name: 'Sandpiper' },
    { x: 490, y: 1170, ut: 0, isSubject: false, name: 'Enclave' },
    { x: 785, y: 1750, ut: 1, isSubject: true, name: 'Subject' },
    { x: 790, y: 1720, ut: 1, isSubject: false, name: 'Sandpiper' },
    { x: 762, y: 1690, ut: 1, isSubject: false, name: 'Avana' },
    { x: 775, y: 1650, ut: 1, isSubject: false, name: 'Harbour' },
    { x: 745, y: 1590, ut: 1, isSubject: false, name: 'Enclave' },
    { x: 755, y: 1560, ut: 1, isSubject: false, name: 'Madera' },
    { x: 1100, y: 2100, ut: 2, isSubject: true, name: 'Subject' },
    { x: 1110, y: 2080, ut: 2, isSubject: false, name: 'Sandpiper' },
    { x: 1085, y: 2020, ut: 2, isSubject: false, name: 'Avana' },
    { x: 1095, y: 1960, ut: 2, isSubject: false, name: 'Harbour' },
    { x: 1055, y: 1870, ut: 2, isSubject: false, name: 'Enclave' },
    { x: 1070, y: 1810, ut: 2, isSubject: false, name: 'Madera' },
    { x: 1320, y: 2480, ut: 3, isSubject: true, name: 'Subject' },
    { x: 1350, y: 2450, ut: 3, isSubject: false, name: 'Sandpiper' },
    { x: 1290, y: 2380, ut: 3, isSubject: false, name: 'Avana' },
    { x: 1310, y: 2290, ut: 3, isSubject: false, name: 'Harbour' },
    { x: 1280, y: 2180, ut: 3, isSubject: false, name: 'Enclave' },
    { x: 1260, y: 2100, ut: 3, isSubject: false, name: 'Madera' },
  ];

  const drillData = [
    { name: 'Sandpiper Cove', cls: 'A', mix: 37, vac: 1.8, dom: 8, conc: 0, rent: 2080, sig: C.green },
    { name: 'Avana Crossings', cls: 'A', mix: 52, vac: 2.1, dom: 9, conc: 0, rent: 2020, sig: C.green },
    { name: 'Harbour Pointe', cls: 'B+', mix: 48, vac: 2.9, dom: 11, conc: 1, rent: 1960, sig: C.green },
    { name: 'The Enclave PSL', cls: 'B', mix: 43, vac: 3.5, dom: 13, conc: 2, rent: 1870, sig: C.yellow },
    { name: 'Madera Ridge', cls: 'B', mix: 40, vac: 4.1, dom: 16, conc: 2, rent: 1810, sig: C.yellow },
  ];

  const svgW = 280, svgH = 140;
  const xMin = 400, xMax = 1400, yMin = 1100, yMax = 2600;
  const toSx = (x: number) => ((x - xMin) / (xMax - xMin)) * (svgW - 20) + 10;
  const toSy = (y: number) => svgH - 10 - ((y - yMin) / (yMax - yMin)) * (svgH - 20);

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M05 · M15</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Mix Matrix</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px repeat(4, 54px)', padding: '3px 10px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['PROPERTY', 'CLS', ...utMeta.map(u => u.abbr)].map((h, i) => (
                <div key={i} style={{ color: i > 1 ? utMeta[i - 2].color : C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {mixData.map((row, ri) => (
              <div key={ri} style={{
                display: 'grid', gridTemplateColumns: '1fr 28px repeat(4, 54px)', padding: '4px 10px',
                borderBottom: `1px solid ${C.border}40`,
                borderLeft: row.isSubject ? `3px solid ${C.subject}` : '3px solid transparent',
                background: row.isSubject ? C.subject + '08' : ri % 2 === 0 ? 'transparent' : '#1A1F2E10',
              }}>
                <div>
                  <span style={{ color: row.isSubject ? C.subject : C.text, fontSize: 10, fontWeight: row.isSubject ? 700 : 400 }}>{row.name}</span>
                  <span style={{ color: C.dim, fontSize: 8, marginLeft: 4 }}>{row.total}u</span>
                </div>
                <div style={{ color: row.cls === 'A' ? C.green : row.cls === 'B+' ? C.yellow : C.dim, fontSize: 8, fontFamily: mono, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.cls}</div>
                {row.mix.map((pct, mi) => (
                  <div key={mi} style={{ textAlign: 'right' }}>
                    <span style={{ color: pct === 0 ? C.dim : row.isSubject ? C.subject : C.text, fontFamily: mono, fontSize: 10, fontWeight: row.isSubject ? 800 : 600 }}>
                      {pct > 0 ? `${pct}%` : '—'}
                    </span>
                    <div style={{ width: '100%', height: 2, background: C.muted, borderRadius: 1, overflow: 'hidden', marginTop: 1 }}>
                      <div style={{ width: `${Math.min(100, pct * 2)}%`, height: '100%', background: row.isSubject ? C.subject : utMeta[mi].color + '70' }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px repeat(4, 54px)', padding: '4px 10px', background: C.bg, borderTop: `2px solid ${C.border}` }}>
              <div style={{ color: C.dim, fontSize: 10, fontWeight: 700 }}>Comp Average</div>
              <div />
              {compAvg.map((v, i) => (
                <div key={i} style={{ textAlign: 'right', color: utMeta[i].color, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{v.toFixed(1)}%</div>
              ))}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M05 · M15</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Rent × SF Scatter</span>
            </div>
            <div style={{ padding: '6px 10px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, justifyContent: 'center' }}>
                {utMeta.map(u => (
                  <div key={u.abbr} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.color, opacity: 0.7 }} />
                    <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>{u.abbr}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.subject, border: '2px solid #fff' }} />
                  <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>SUBJECT</span>
                </div>
              </div>
              <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                <line x1="10" y1={svgH - 10} x2={svgW - 10} y2={svgH - 10} stroke={C.border} strokeWidth="0.5" />
                <line x1="10" y1="10" x2="10" y2={svgH - 10} stroke={C.border} strokeWidth="0.5" />
                {[500, 800, 1100, 1400].map(v => (
                  <text key={v} x={toSx(v)} y={svgH - 2} textAnchor="middle" fill={C.dim} fontSize="6" fontFamily={mono}>{v}</text>
                ))}
                {[1200, 1600, 2000, 2400].map(v => (
                  <g key={v}>
                    <line x1="10" y1={toSy(v)} x2={svgW - 10} y2={toSy(v)} stroke={C.border} strokeWidth="0.3" strokeDasharray="2 2" />
                    <text x="6" y={toSy(v) + 3} textAnchor="end" fill={C.dim} fontSize="5" fontFamily={mono}>${(v / 1000).toFixed(1)}k</text>
                  </g>
                ))}
                {scatterPts.map((p, i) => (
                  <circle key={i} cx={toSx(p.x)} cy={toSy(p.y)}
                    r={p.isSubject ? 5 : 3.5}
                    fill={p.isSubject ? C.subject : utMeta[p.ut].color}
                    fillOpacity={p.isSubject ? 1 : 0.6}
                    stroke={p.isSubject ? '#fff' : 'none'} strokeWidth={p.isSubject ? 1.5 : 0} />
                ))}
              </svg>
            </div>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M15</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Property Drill-Down</span>
              <span style={{ color: C.dim, fontSize: 8 }}>2BR · sorted by vac</span>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {utMeta.map((u, i) => (
                <span key={u.abbr} style={{
                  padding: '2px 6px', fontSize: 8, fontWeight: 700, fontFamily: mono, borderRadius: 2,
                  background: i === 2 ? u.color + '20' : 'transparent',
                  color: i === 2 ? u.color : C.dim,
                  border: `1px solid ${i === 2 ? u.color : C.border}`,
                }}>{u.abbr}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px 48px 56px 60px', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['PROPERTY', 'CLS', 'MIX', 'VAC', 'DOM', 'CONC', 'RENT'].map((h, i) => (
              <div key={i} style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {drillData.map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 32px 44px 56px 48px 56px 60px', padding: '4px 12px',
              borderBottom: `1px solid ${C.border}40`, background: i % 2 === 0 ? 'transparent' : '#1A1F2E10', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: d.sig, fontSize: 6 }}>●</span>
                <span style={{ color: C.text, fontSize: 10 }}>{d.name}</span>
              </div>
              <div style={{ textAlign: 'right', color: C.dim, fontSize: 9 }}>{d.cls}</div>
              <div style={{ textAlign: 'right', color: C.twoBR, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{d.mix}%</div>
              <div style={{ textAlign: 'right', color: d.vac <= 3 ? C.green : d.vac <= 6 ? C.yellow : C.red, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{d.vac}%</div>
              <div style={{ textAlign: 'right', color: d.dom <= 10 ? C.green : d.dom <= 20 ? C.yellow : C.red, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{d.dom}d</div>
              <div style={{ textAlign: 'right', color: d.conc <= 0 ? C.green : d.conc <= 2 ? C.yellow : C.red, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{d.conc}wk</div>
              <div style={{ textAlign: 'right', color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>${d.rent.toLocaleString()}</div>
            </div>
          ))}
          <div style={{ padding: '3px 12px', background: C.bg, display: 'flex', gap: 10 }}>
            <span style={{ color: C.green, fontSize: 7, fontFamily: mono }}>● HOT vac≤3%</span>
            <span style={{ color: C.yellow, fontSize: 7, fontFamily: mono }}>● WARM vac≤6%</span>
            <span style={{ color: C.red, fontSize: 7, fontFamily: mono }}>● SOFT vac&gt;6%</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2,
              background: i === 2 ? C.blue + '20' : 'transparent',
              color: i === 2 ? C.blue : C.dim,
              border: i === 2 ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
            }}>{step}</span>
            {i < 4 && <span style={{ color: C.muted, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
