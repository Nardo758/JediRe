export function DemandTab() {
  const C = {
    bg: '#0A0E17', surface: '#0F1319', card: '#131821', border: '#1E2538',
    muted: '#2A3348', text: '#E8ECF1', dim: '#6B7A8D',
    studio: '#A78BFA', oneBR: '#00BCD4', twoBR: '#00D26A', threeBR: '#F5A623',
    green: '#00D26A', red: '#FF4757', yellow: '#F5A623', blue: '#00BCD4',
  };
  const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'demand', label: 'DEMAND', active: true },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS' },
    { id: 'program', label: 'PROGRAM' },
  ];

  const units = [
    { abbr: 'STU', label: 'Studio', range: '420–540', color: C.studio, score: 42, status: 'OVERSUPPLIED', statusColor: C.red,
      vac: 10.8, vacDelta: 8.0, dom: 34, conc: 5.6, rent: '$1,248', rentDelta: -30,
      sparkline: [8,9,10,11,12,13,13,14,14,15,15,16] },
    { abbr: '1BR', label: '1 BR', range: '680–820', color: C.oneBR, score: 72, status: 'BALANCED', statusColor: C.yellow,
      vac: 6.3, vacDelta: -1.0, dom: 25, conc: 3.4, rent: '$1,634', rentDelta: 45,
      sparkline: [7,7,6,6,7,7,7,6,6,6,6,6] },
    { abbr: '2BR', label: '2 BR', range: '980–1150', color: C.twoBR, score: 91, status: 'UNDERSUPPLIED', statusColor: C.green,
      vac: 2.5, vacDelta: -1.5, dom: 9, conc: 0.6, rent: '$1,988', rentDelta: 170,
      sparkline: [4,3,3,2,2,2,2,2,1,1,2,2] },
    { abbr: '3BR', label: '3 BR+', range: '1240–1400', color: C.threeBR, score: 68, status: 'BALANCED', statusColor: C.yellow,
      vac: 5.0, vacDelta: -1.0, dom: 19, conc: 2.2, rent: '$2,280', rentDelta: 110,
      sparkline: [6,6,5,5,5,4,5,5,4,5,5,5] },
  ];

  const gaps = [
    { abbr: 'STU', color: C.studio, supply: 4.2, demand: 3.1, gap: -1.1 },
    { abbr: '1BR', color: C.oneBR, supply: 41.2, demand: 38.8, gap: -2.4 },
    { abbr: '2BR', color: C.twoBR, supply: 44.2, demand: 49.6, gap: 5.4 },
    { abbr: '3BR', color: C.threeBR, supply: 10.4, demand: 8.5, gap: -1.9 },
  ];

  function Spark({ data, color }: { data: number[]; color: string }) {
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const w = 80, h = 28;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }

  const sigColor = (val: number, type: string) => {
    if (type === 'vac') return val <= 3 ? C.green : val <= 6 ? C.yellow : C.red;
    if (type === 'dom') return val <= 10 ? C.green : val <= 20 ? C.yellow : C.red;
    if (type === 'conc') return val <= 0 ? C.green : val <= 2 ? C.yellow : C.red;
    return C.text;
  };

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>M03 · DEV</span>
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

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '7px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>M05 · M07</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Demand by Unit Type</span>
            </div>
            <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>VAC · DOM · CONC AVERAGED ACROSS TRADE AREA</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border }}>
            {units.map(u => (
              <div key={u.abbr} style={{ background: C.card, padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ width: 5, height: 5, background: u.color, borderRadius: 1 }} />
                    <span style={{ color: u.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.abbr}</span>
                    <span style={{ color: C.dim, fontSize: 8 }}>{u.range}</span>
                  </div>
                  <span style={{
                    fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                    background: u.statusColor + '18', border: `1px solid ${u.statusColor}35`, color: u.statusColor,
                  }}>{u.status}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: u.statusColor, fontFamily: mono, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{u.score}</span>
                  <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>/100</span>
                  <div style={{ flex: 1, height: 3, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${u.score}%`, height: '100%', background: u.statusColor, borderRadius: 2 }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px', marginBottom: 5 }}>
                  {[
                    { label: 'VAC', val: `${u.vac}%`, sig: sigColor(u.vac, 'vac'), delta: u.vacDelta, bad: u.vacDelta > 0 },
                    { label: 'DOM', val: `${u.dom}d`, sig: sigColor(u.dom, 'dom') },
                    { label: 'CONC', val: `${u.conc}wk`, sig: sigColor(u.conc, 'conc') },
                    { label: 'RENT', val: u.rent, sig: C.text, delta: u.rentDelta, bad: u.rentDelta < 0 },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0' }}>
                      <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>{m.label}</span>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <span style={{ color: m.sig, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{m.val}</span>
                        {m.delta !== undefined && m.delta !== 0 && (
                          <span style={{ color: m.bad ? C.red : C.green, fontFamily: mono, fontSize: 7 }}>
                            {m.delta > 0 ? '▲' : '▼'}{Math.abs(m.delta).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 3 }}>
                  <Spark data={u.sparkline} color={u.color} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '7px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>DERIVED</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>Supply / Demand Gap</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ c: C.muted, l: 'SUPPLY' }, { c: C.blue, l: 'DEMAND' }].map(lg => (
                <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 6, height: 2, background: lg.c, borderRadius: 1 }} />
                  <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>{lg.l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 1, background: C.border }}>
            <div style={{ background: C.card, padding: '8px 12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {gaps.map(g => {
                  const maxBar = 55;
                  return (
                    <div key={g.abbr} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: g.color, fontFamily: mono, fontSize: 8, fontWeight: 700, width: 24 }}>{g.abbr}</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ height: 6, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${(g.supply / maxBar) * 100}%`, height: '100%', background: g.color + '40', borderRadius: 2 }} />
                        </div>
                        <div style={{ height: 6, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${(g.demand / maxBar) * 100}%`, height: '100%', background: g.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: C.bg, padding: '8px 12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {gaps.map(g => {
                  const gapColor = g.gap > 3 ? C.green : g.gap < -3 ? C.red : C.yellow;
                  const gapPct = Math.min(Math.abs(g.gap), 15) / 15 * 100;
                  return (
                    <div key={g.abbr} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 5, height: 5, background: g.color, borderRadius: 1, flexShrink: 0 }} />
                      <span style={{ color: C.text, fontSize: 10, fontWeight: 600, minWidth: 28 }}>{g.abbr}</span>
                      <span style={{
                        fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2, minWidth: 72, textAlign: 'center',
                        background: gapColor + '18', border: `1px solid ${gapColor}35`, color: gapColor,
                      }}>{g.gap > 3 ? 'UNDERSUPPLIED' : g.gap < -3 ? 'OVERSUPPLIED' : 'BALANCED'}</span>
                      <span style={{ color: C.dim, fontSize: 8, fontFamily: mono, minWidth: 75 }}>
                        S:{g.supply.toFixed(1)}% D:<span style={{ color: g.color }}>{g.demand.toFixed(1)}%</span>
                      </span>
                      <div style={{ width: 80, height: 5, background: C.muted, borderRadius: 2, position: 'relative' }}>
                        <div style={{ position: 'absolute', [g.gap >= 0 ? 'left' : 'right']: '50%', width: `${gapPct / 2}%`, height: '100%', background: gapColor, borderRadius: 2 }} />
                        <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: C.dim + '40' }} />
                      </div>
                      <span style={{ color: gapColor, fontFamily: mono, fontSize: 10, fontWeight: 700, minWidth: 42 }}>
                        {g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}pp
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 6, padding: '5px 7px', background: C.card, borderRadius: 3, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginBottom: 2 }}>
                  <span style={{ color: C.green, fontFamily: mono, fontSize: 9 }}>▲</span>
                  <span style={{ color: C.dim, fontSize: 9 }}>
                    <span style={{ color: C.twoBR, fontWeight: 700 }}>2BR</span> undersupplied 5.4pp — fast velocity, low vac
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                  <span style={{ color: C.red, fontFamily: mono, fontSize: 9 }}>▼</span>
                  <span style={{ color: C.dim, fontSize: 9 }}>
                    <span style={{ color: C.studio, fontWeight: 700 }}>STU</span> soft demand — high vac, slow leasing velocity
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '5px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>FLOW</span>
        {['DISCOVERY', 'DEMAND', 'COMPS', 'TRENDS', 'PROGRAM'].map((step, i) => (
          <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontFamily: mono, fontSize: 7, fontWeight: 700, padding: '2px 5px', borderRadius: 2,
              background: i === 1 ? C.blue + '20' : 'transparent',
              color: i === 1 ? C.blue : C.dim,
              border: i === 1 ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
            }}>{step}</span>
            {i < 4 && <span style={{ color: C.muted, fontSize: 9 }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
