import { useState } from "react";

const C = {
  bg: '#0A0E17', surface: '#0F1319', card: '#131821', elevated: '#1a2130',
  border: '#1E2538', borderSub: '#161c24', muted: '#2A3348',
  text: '#E8ECF1', dim: '#6B7A8D', faint: '#4A566B', accent: '#c2c0b6',
  studio: '#A78BFA', oneBR: '#00BCD4', twoBR: '#00D26A', threeBR: '#F5A623',
  subject: '#FF8C42', green: '#00D26A', red: '#FF4757', yellow: '#F5A623', blue: '#00BCD4',
  purple: '#A78BFA',
};
const mono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

const AMENITIES = [
  { key: 'pkg',     name: 'Package Lockers',  category: 'convenience' },
  { key: 'fitness', name: 'Fitness Center',    category: 'lifestyle' },
  { key: 'dog',     name: 'Dog Park/Wash',     category: 'lifestyle' },
  { key: 'pool',    name: 'Pool',              category: 'lifestyle' },
  { key: 'cowork',  name: 'Coworking Space',   category: 'convenience' },
  { key: 'ev',      name: 'EV Charging',       category: 'infrastructure' },
  { key: 'rooftop', name: 'Rooftop Lounge',    category: 'lifestyle' },
  { key: 'concierge', name: 'Concierge/Valet', category: 'service' },
];

const SUBJECT = {
  name: 'Subject Property', units: 320, cls: 'B+', built: 2016,
  amenities: { pkg: false, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false },
  avgRent: 1735,
};

const COMPS = [
  { id: 'sandpiper', name: 'Sandpiper Cove',  cls: 'A',  units: 248, built: 2021, dist: 0.8,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false },
    avgRent: 1892 },
  { id: 'avana', name: 'Avana Crossings',  cls: 'A',  units: 312, built: 2019, dist: 1.2,
    amenities: { pkg: true, fitness: true, dog: false, pool: true, cowork: true, ev: true, rooftop: false, concierge: true },
    avgRent: 1830 },
  { id: 'harbour', name: 'Harbour Pointe',  cls: 'B+', units: 400, built: 2017, dist: 1.5,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false },
    avgRent: 1720 },
  { id: 'enclave', name: 'The Enclave PSL', cls: 'B',  units: 180, built: 2014, dist: 2.1,
    amenities: { pkg: false, fitness: true, dog: false, pool: true, cowork: false, ev: false, rooftop: false, concierge: false },
    avgRent: 1580 },
  { id: 'riverview', name: 'Riverview Apts',  cls: 'A-', units: 290, built: 2020, dist: 1.8,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false },
    avgRent: 1870 },
];

const SUBMARKET = {
  name: 'Port St. Lucie · West',
  properties: 47,
  penetration: { pkg: 72, fitness: 91, dog: 64, pool: 78, cowork: 38, ev: 42, rooftop: 22, concierge: 14 } as Record<string, number>,
};

const LIFT_DATA: Record<string, { cost: number; liftPerUnit: number; roi: string; tier: string }> = {
  pkg:       { cost: 45000,  liftPerUnit: 50,  roi: '0.9yr', tier: 'BASE' },
  fitness:   { cost: 120000, liftPerUnit: 25,  roi: '1.7yr', tier: 'BASE' },
  dog:       { cost: 35000,  liftPerUnit: 12,  roi: '1.0yr', tier: 'BASE' },
  pool:      { cost: 450000, liftPerUnit: 65,  roi: '2.5yr', tier: 'PREMIUM' },
  cowork:    { cost: 180000, liftPerUnit: 35,  roi: '1.8yr', tier: 'COMPETITIVE' },
  ev:        { cost: 64000,  liftPerUnit: 15,  roi: '1.4yr', tier: 'COMPETITIVE' },
  rooftop:   { cost: 280000, liftPerUnit: 45,  roi: '2.2yr', tier: 'PREMIUM' },
  concierge: { cost: 95000,  liftPerUnit: 30,  roi: '1.1yr', tier: 'COMPETITIVE' },
};

function PenBar({ pct, color, width = 40 }: { pct: number; color: string; width?: number }) {
  return (
    <div style={{ width, height: 4, background: C.muted, borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 1, opacity: 0.8 }} />
    </div>
  );
}

export function ProgramExisting() {
  const [view, setView] = useState<'matrix' | 'impact'>('matrix');

  const compCount = COMPS.length;
  const missingAmenities = AMENITIES.filter(a => !(SUBJECT.amenities as Record<string, boolean>)[a.key]);
  const hasAmenities = AMENITIES.filter(a => (SUBJECT.amenities as Record<string, boolean>)[a.key]);

  const totalMissingCost = missingAmenities.reduce((s, a) => s + LIFT_DATA[a.key].cost, 0);
  const totalLiftPerUnit = missingAmenities.reduce((s, a) => s + LIFT_DATA[a.key].liftPerUnit, 0);
  const annualLift = totalLiftPerUnit * SUBJECT.units * 12;

  const compPenetration = (key: string) => {
    const has = COMPS.filter(c => (c.amenities as Record<string, boolean>)[key]).length;
    return Math.round((has / compCount) * 100);
  };

  const gapScore = (key: string) => {
    const cp = compPenetration(key);
    const sp = SUBMARKET.penetration[key] || 0;
    return Math.round((cp + sp) / 2);
  };

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'demand', label: 'DEMAND' },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS' },
    { id: 'program', label: 'PROGRAM', active: true },
  ];

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: mono, color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.faint, fontSize: 8, fontFamily: mono }}>EXISTING ASSET · AMENITY GAP</span>
        </div>
        <span style={{ color: C.blue, fontFamily: mono, fontSize: 7, padding: '2px 5px', background: C.blue + '15', borderRadius: 2, fontWeight: 700 }}>EXISTING</span>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 12px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t.id} style={{
            padding: '6px 12px', fontSize: 8, fontFamily: mono, fontWeight: 700, letterSpacing: '0.08em',
            borderBottom: t.active ? `2px solid ${C.blue}` : '2px solid transparent',
            color: t.active ? C.text : C.dim,
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          {[
            { label: 'AMENITY GAPS', val: `${missingAmenities.length}`, sub: `of ${AMENITIES.length} tracked`, color: C.red },
            { label: 'CLOSE COST', val: `$${(totalMissingCost / 1000).toFixed(0)}K`, sub: 'all missing', color: C.yellow },
            { label: 'EST LIFT', val: `+$${totalLiftPerUnit}/u`, sub: '/mo if all closed', color: C.green },
            { label: 'ANNUAL IMPACT', val: `$${(annualLift / 1e6).toFixed(2)}M`, sub: `across ${SUBJECT.units}u`, color: C.green },
          ].map((kpi, i) => (
            <div key={kpi.label} style={{ flex: 1, borderRight: i < 3 ? `1px solid ${C.border}` : 'none', padding: '6px 12px' }}>
              <div style={{ fontSize: 8, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 3 }}>{kpi.label}</div>
              <div style={{ fontSize: 14, fontFamily: mono, color: kpi.color, fontWeight: 700, lineHeight: 1 }}>{kpi.val}</div>
              <div style={{ fontSize: 8, fontFamily: mono, color: C.dim, marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>AMENITY</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>Gap Analysis — Comp Parity + Submarket</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['matrix', 'impact'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '2px 8px', border: `1px solid ${view === v ? C.blue + '50' : C.border}`,
                borderRadius: 2, cursor: 'pointer', fontSize: 7, fontFamily: mono, fontWeight: 700,
                background: view === v ? C.blue + '14' : 'transparent',
                color: view === v ? C.blue : C.faint,
              }}>{v === 'matrix' ? 'COMP MATRIX' : 'IMPACT ANALYSIS'}</button>
            ))}
          </div>
        </div>

        {view === 'matrix' && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 700 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `140px 50px repeat(${compCount}, 1fr) 60px 60px`,
                  padding: '4px 12px', background: C.bg, borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 7, fontFamily: mono, color: C.faint, fontWeight: 700 }}>AMENITY</span>
                  <span style={{ fontSize: 7, fontFamily: mono, color: C.subject, fontWeight: 700, textAlign: 'center' }}>YOU</span>
                  {COMPS.map(c => (
                    <div key={c.id} style={{ textAlign: 'center', overflow: 'hidden' }}>
                      <div style={{ fontSize: 7, fontFamily: mono, color: C.dim, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name.split(' ')[0]}
                      </div>
                      <div style={{ fontSize: 6, fontFamily: mono, color: C.faint }}>{c.cls} · {c.built}</div>
                    </div>
                  ))}
                  <span style={{ fontSize: 7, fontFamily: mono, color: C.dim, fontWeight: 700, textAlign: 'center' }}>COMP %</span>
                  <span style={{ fontSize: 7, fontFamily: mono, color: C.dim, fontWeight: 700, textAlign: 'center' }}>SUBM %</span>
                </div>

                {AMENITIES.map((a, ri) => {
                  const subjectHas = (SUBJECT.amenities as Record<string, boolean>)[a.key];
                  const cp = compPenetration(a.key);
                  const sp = SUBMARKET.penetration[a.key];
                  const isMissing = !subjectHas;
                  const isHighGap = isMissing && cp >= 60;

                  return (
                    <div key={a.key} style={{
                      display: 'grid',
                      gridTemplateColumns: `140px 50px repeat(${compCount}, 1fr) 60px 60px`,
                      padding: '5px 12px', alignItems: 'center',
                      borderBottom: `1px solid ${C.border}30`,
                      background: isHighGap ? C.red + '06' : ri % 2 === 0 ? 'transparent' : C.surface + '30',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isMissing && isHighGap && <div style={{ width: 3, height: 14, background: C.red, borderRadius: 1 }} />}
                        {isMissing && !isHighGap && <div style={{ width: 3, height: 14, background: C.yellow, borderRadius: 1 }} />}
                        {!isMissing && <div style={{ width: 3, height: 14, background: C.green, borderRadius: 1, opacity: 0.4 }} />}
                        <span style={{ fontSize: 9, color: isMissing ? C.text : C.dim }}>{a.name}</span>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                          background: subjectHas ? C.green + '18' : C.red + '18',
                          color: subjectHas ? C.green : C.red,
                          border: `1px solid ${subjectHas ? C.green : C.red}30`,
                        }}>{subjectHas ? '✓' : '✗'}</span>
                      </div>

                      {COMPS.map(c => {
                        const has = (c.amenities as Record<string, boolean>)[a.key];
                        return (
                          <div key={c.id} style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700,
                              color: has ? C.green : C.faint,
                              opacity: has ? 0.8 : 0.4,
                            }}>{has ? '●' : '○'}</span>
                          </div>
                        );
                      })}

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 9, fontFamily: mono, fontWeight: 700, color: cp >= 60 ? (isMissing ? C.red : C.dim) : C.dim }}>{cp}%</span>
                        <PenBar pct={cp} color={cp >= 60 && isMissing ? C.red : C.dim} width={36} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: 9, fontFamily: mono, fontWeight: 700, color: sp >= 50 ? (isMissing ? C.yellow : C.dim) : C.dim }}>{sp}%</span>
                        <PenBar pct={sp} color={sp >= 50 && isMissing ? C.yellow : C.dim} width={36} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '6px 12px', borderTop: `1px solid ${C.border}`, background: C.card }}>
              <div style={{ fontSize: 8, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 4 }}>COMP RENT CONTEXT</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.subject + '14', border: `1px solid ${C.subject}30`, borderRadius: 2 }}>
                  <div style={{ width: 5, height: 5, background: C.subject, borderRadius: 1 }} />
                  <span style={{ fontSize: 8, fontFamily: mono, color: C.subject, fontWeight: 700 }}>YOU ${SUBJECT.avgRent}/mo</span>
                </div>
                {COMPS.map(c => {
                  const delta = c.avgRent - SUBJECT.avgRent;
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2 }}>
                      <span style={{ fontSize: 8, fontFamily: mono, color: C.dim }}>{c.name.split(' ')[0]}</span>
                      <span style={{ fontSize: 8, fontFamily: mono, color: C.text, fontWeight: 700 }}>${c.avgRent}</span>
                      <span style={{ fontSize: 7, fontFamily: mono, color: delta > 0 ? C.green : C.red, fontWeight: 700 }}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {view === 'impact' && (
          <>
            {missingAmenities.map(a => {
              const lift = LIFT_DATA[a.key];
              const cp = compPenetration(a.key);
              const sp = SUBMARKET.penetration[a.key];
              const annImpact = lift.liftPerUnit * SUBJECT.units * 12;
              const compsWithIt = COMPS.filter(c => (c.amenities as Record<string, boolean>)[a.key]);
              const urgency = cp >= 70 ? 'CRITICAL' : cp >= 50 ? 'HIGH' : sp >= 40 ? 'MEDIUM' : 'LOW';
              const urgencyColor = urgency === 'CRITICAL' ? C.red : urgency === 'HIGH' ? C.yellow : urgency === 'MEDIUM' ? C.blue : C.dim;

              return (
                <div key={a.key} style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 3, height: 18, background: urgencyColor, borderRadius: 1 }} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</span>
                      <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: urgencyColor + '18', color: urgencyColor, border: `1px solid ${urgencyColor}30` }}>{urgency}</span>
                      <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: C.muted, color: C.dim }}>{lift.tier}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>COST</span>
                      <span style={{ fontSize: 11, fontFamily: mono, color: C.yellow, fontWeight: 700 }}>${(lift.cost / 1000).toFixed(0)}K</span>
                      <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>LIFT</span>
                      <span style={{ fontSize: 11, fontFamily: mono, color: C.green, fontWeight: 700 }}>+${lift.liftPerUnit}/u</span>
                      <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>ROI</span>
                      <span style={{ fontSize: 11, fontFamily: mono, color: C.text, fontWeight: 700 }}>{lift.roi}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginLeft: 9 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 7, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 3 }}>COMP PARITY — {cp}% HAVE IT</div>
                      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                        {COMPS.map(c => {
                          const has = (c.amenities as Record<string, boolean>)[a.key];
                          return (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 2, background: has ? C.green + '10' : C.bg, border: `1px solid ${has ? C.green + '30' : C.border}` }}>
                              <span style={{ fontSize: 7, color: has ? C.green : C.faint, fontWeight: 700 }}>{has ? '✓' : '✗'}</span>
                              <span style={{ fontSize: 7, fontFamily: mono, color: has ? C.dim : C.faint }}>{c.name.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                      {compsWithIt.length > 0 && (
                        <div style={{ fontSize: 8, color: C.dim }}>
                          Avg rent of comps with: <span style={{ color: C.green, fontWeight: 700 }}>${Math.round(compsWithIt.reduce((s, c) => s + c.avgRent, 0) / compsWithIt.length)}/mo</span>
                          {' '}vs without: <span style={{ color: C.red, fontWeight: 700 }}>${COMPS.filter(c => !(c.amenities as Record<string, boolean>)[a.key]).length > 0 ? Math.round(COMPS.filter(c => !(c.amenities as Record<string, boolean>)[a.key]).reduce((s, c) => s + c.avgRent, 0) / COMPS.filter(c => !(c.amenities as Record<string, boolean>)[a.key]).length) : '—'}/mo</span>
                        </div>
                      )}
                    </div>

                    <div style={{ width: 1, background: C.border }} />

                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontSize: 7, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 3 }}>SUBMARKET — {sp}% PENETRATION</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <PenBar pct={sp} color={sp >= 50 ? C.yellow : C.dim} width={80} />
                        <span style={{ fontSize: 9, fontFamily: mono, color: sp >= 50 ? C.yellow : C.dim, fontWeight: 700 }}>{sp}%</span>
                      </div>
                      <span style={{ fontSize: 8, color: C.dim }}>{SUBMARKET.properties} properties tracked</span>
                    </div>

                    <div style={{ width: 1, background: C.border }} />

                    <div style={{ minWidth: 100, textAlign: 'right' as const }}>
                      <div style={{ fontSize: 7, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 3 }}>ANNUAL IMPACT</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: C.green, fontWeight: 700 }}>${(annImpact / 1000).toFixed(0)}K</div>
                      <div style={{ fontSize: 8, fontFamily: mono, color: C.dim }}>{SUBJECT.units}u × ${lift.liftPerUnit} × 12</div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ padding: '6px 12px', background: C.card, borderTop: `2px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, fontWeight: 700 }}>TOTAL CLOSE COST</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: C.yellow, fontWeight: 700 }}>${(totalMissingCost / 1000).toFixed(0)}K</span>
                  <span style={{ color: C.border }}>|</span>
                  <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, fontWeight: 700 }}>TOTAL LIFT</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: C.green, fontWeight: 700 }}>+${totalLiftPerUnit}/u/mo</span>
                  <span style={{ color: C.border }}>|</span>
                  <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, fontWeight: 700 }}>ANNUAL</span>
                  <span style={{ fontSize: 12, fontFamily: mono, color: C.green, fontWeight: 700 }}>${(annualLift / 1e6).toFixed(2)}M</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ padding: '6px 12px', background: C.card, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 7, fontFamily: mono, color: C.faint, letterSpacing: 0.8, marginBottom: 3 }}>LEGEND</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {[
              { color: C.red, label: 'Missing — 60%+ comp penetration (table stakes)' },
              { color: C.yellow, label: 'Missing — 40-59% (competitive edge)' },
              { color: C.green, label: 'You have it' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 3, height: 10, background: l.color, borderRadius: 1 }} />
                <span style={{ fontSize: 7, fontFamily: mono, color: C.dim }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 12px", borderTop: `1px solid ${C.border}`, background: C.card, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>EXISTING ASSET</span>
          <span style={{ color: C.faint, fontSize: 8 }}>·</span>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>{SUBJECT.units}u · {SUBJECT.cls} · {SUBJECT.built}</span>
          <span style={{ color: C.faint, fontSize: 8 }}>·</span>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.dim }}>Submarket: {SUBMARKET.name}</span>
        </div>
        <button style={{
          padding: "4px 12px", border: "none", borderRadius: 2,
          cursor: "pointer", fontSize: 9, fontFamily: mono,
          background: C.green, color: C.bg, fontWeight: 700, letterSpacing: 0.5,
        }}>
          PUSH TO PROFORMA →
        </button>
      </div>
    </div>
  );
}
