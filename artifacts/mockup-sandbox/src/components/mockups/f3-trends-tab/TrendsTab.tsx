export function TrendsTab() {
  const C = {
    bg: '#0A0E17', surface: '#0F1319', card: '#131821', border: '#1E2538',
    muted: '#2A3348', text: '#E8ECF1', dim: '#6B7A8D',
    studio: '#A78BFA', oneBR: '#00BCD4', twoBR: '#00D26A', threeBR: '#F5A623',
    green: '#00D26A', red: '#FF4757', yellow: '#F5A623', blue: '#00BCD4',
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'demand', label: 'DEMAND' },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS', active: true },
    { id: 'program', label: 'PROGRAM' },
  ];

  const utMeta = [
    { abbr: 'STU', color: C.studio },
    { abbr: '1BR', color: C.oneBR },
    { abbr: '2BR', color: C.twoBR },
    { abbr: '3BR', color: C.threeBR },
  ];

  const metrics = [
    {
      key: 'vac', label: 'VACANCY', color: C.red, current: '2.0%', delta: '-2.0pp', good: true,
      data: [4, 3, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2],
    },
    {
      key: 'dom', label: 'DOM', color: C.yellow, current: '8d', delta: '-6', good: true,
      data: [14, 12, 11, 10, 9, 9, 8, 8, 7, 7, 8, 8],
    },
    {
      key: 'rent', label: 'AVG RENT', color: C.green, current: '$2,060', delta: '+$170', good: true,
      data: [1890, 1910, 1930, 1960, 1980, 1990, 2010, 2020, 2040, 2050, 2055, 2060],
    },
    {
      key: 'conc', label: 'CONCESSIONS', color: C.studio, current: '0wk', delta: '-2', good: true,
      data: [2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ];

  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  const inventoryData = [
    { name: 'Sandpiper Cove', cls: 'A', total: 248, stu: 8, one: 45, two: 37, three: 10 },
    { name: 'Avana Crossings', cls: 'A', total: 312, stu: 0, one: 38, two: 52, three: 10 },
    { name: 'Harbour Pointe', cls: 'B+', total: 400, stu: 3, one: 35, two: 48, three: 14 },
    { name: 'The Enclave PSL', cls: 'B', total: 180, stu: 5, one: 42, two: 43, three: 10 },
    { name: 'Madera Ridge', cls: 'B', total: 220, stu: 0, one: 50, two: 40, three: 10 },
  ];

  const invTotals = { stu: 43, one: 563, two: 596, three: 148 };
  const totalUnits = invTotals.stu + invTotals.one + invTotals.two + invTotals.three;

  function TrendChart({ data, color }: { data: number[]; color: string }) {
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const w = 260, h = 44;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 10) + 5},${h - 4 - ((v - min) / range) * (h - 8)}`).join(' ');
    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {[0, 3, 6, 9, 11].map(i => (
          <text key={i} x={(i / 11) * (w - 10) + 5} y={h} textAnchor="middle" fill={C.dim} fontSize="5" fontFamily={mono}>{months[i]}</text>
        ))}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }

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
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M05</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>12-Month Trends</span>
              <span style={{ color: C.dim, fontSize: 8 }}>submarket avg</span>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
            {metrics.map(m => (
              <div key={m.key} style={{ background: C.bg, padding: '6px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ color: C.dim, fontSize: 8, fontFamily: mono, letterSpacing: '0.06em' }}>{m.label}</span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
                    <span style={{ color: m.color, fontFamily: mono, fontSize: 13, fontWeight: 700 }}>{m.current}</span>
                    <span style={{ color: m.good ? C.green : C.red, fontFamily: mono, fontSize: 8 }}>
                      {m.delta} {m.good ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                <TrendChart data={m.data} color={m.color} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>M05</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Submarket Inventory</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {utMeta.map((u, i) => {
                const vals = [invTotals.stu, invTotals.one, invTotals.two, invTotals.three];
                return (
                  <div key={u.abbr} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 4, height: 4, background: u.color, borderRadius: 1 }} />
                    <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>{u.abbr}</span>
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>{vals[i]}u</span>
                  </div>
                );
              })}
              <span style={{ color: C.dim, fontSize: 8 }}>·</span>
              <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{totalUnits.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ padding: '5px 12px 3px' }}>
            <div style={{ display: 'flex', height: 14, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
              {[
                { pct: (invTotals.stu / totalUnits) * 100, color: C.studio },
                { pct: (invTotals.one / totalUnits) * 100, color: C.oneBR },
                { pct: (invTotals.two / totalUnits) * 100, color: C.twoBR },
                { pct: (invTotals.three / totalUnits) * 100, color: C.threeBR },
              ].map((seg, i) => (
                <div key={i} style={{ flex: seg.pct, background: seg.color + 'cc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 7, fontWeight: 700, fontFamily: mono }}>
                  {seg.pct > 8 ? `${seg.pct.toFixed(0)}%` : ''}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 32px repeat(4, 56px) 42px', padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {['PROPERTY', 'CLS', 'STU', '1BR', '2BR', '3BR', 'UNITS'].map((h, i) => (
                <div key={i} style={{ color: i >= 2 && i <= 5 ? utMeta[i - 2]?.color : C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700, textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {inventoryData.map((row, ri) => (
              <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 32px repeat(4, 56px) 42px', padding: '4px 12px',
                borderBottom: `1px solid ${C.border}40`, background: ri % 2 === 0 ? 'transparent' : '#1A1F2E10' }}>
                <div style={{ color: C.text, fontSize: 10 }}>{row.name}</div>
                <div style={{ color: C.dim, fontSize: 9 }}>{row.cls}</div>
                {[row.stu, row.one, row.two, row.three].map((pct, mi) => (
                  <div key={mi} style={{ textAlign: 'right', color: pct > 0 ? utMeta[mi].color : C.dim, fontFamily: mono, fontSize: 10, fontWeight: 600 }}>
                    {pct > 0 ? `${pct}%` : '—'}
                  </div>
                ))}
                <div style={{ textAlign: 'right', color: C.dim, fontFamily: mono, fontSize: 9 }}>{row.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2,
              background: i === 3 ? C.blue + '20' : 'transparent',
              color: i === 3 ? C.blue : C.dim,
              border: i === 3 ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
            }}>{step}</span>
            {i < 4 && <span style={{ color: C.muted, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
