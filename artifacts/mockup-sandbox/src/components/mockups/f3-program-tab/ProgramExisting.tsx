import { useState } from 'react';
import { Zap, CheckCircle, AlertTriangle } from 'lucide-react';

const C = {
  bg: '#0a0a0c',
  panel: '#111114',
  panelAlt: '#13131a',
  border: '#1e1e24',
  borderMid: '#2a2a35',
  cyan: '#00e5a0',
  amber: '#f59e0b',
  purple: '#a855f7',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#2a2a40',
  subject: '#f97316',
};

const mono = { fontFamily: '"JetBrains Mono", monospace' };

const AMENITIES = [
  { key: 'pkg',       name: 'Package Lockers',  category: 'CONVENIENCE' },
  { key: 'fitness',   name: 'Fitness Center',   category: 'LIFESTYLE' },
  { key: 'dog',       name: 'Dog Park/Wash',    category: 'LIFESTYLE' },
  { key: 'pool',      name: 'Pool',             category: 'LIFESTYLE' },
  { key: 'cowork',    name: 'Coworking Space',  category: 'CONVENIENCE' },
  { key: 'ev',        name: 'EV Charging',      category: 'INFRA' },
  { key: 'rooftop',   name: 'Rooftop Lounge',  category: 'LIFESTYLE' },
  { key: 'concierge', name: 'Concierge/Valet', category: 'SERVICE' },
];

const SUBJECT = {
  name: 'Subject Property', units: 320, cls: 'B+', built: 2016,
  amenities: { pkg: false, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>,
  avgRent: 1735,
};

const COMPS = [
  { id: 'sandpiper', name: 'Sandpiper Cove', cls: 'A',  units: 248, built: 2021, dist: 0.8, amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false } as Record<string, boolean>, avgRent: 1892 },
  { id: 'avana',     name: 'Avana Crossings', cls: 'A',  units: 312, built: 2019, dist: 1.2, amenities: { pkg: true, fitness: true, dog: false, pool: true, cowork: true, ev: true, rooftop: false, concierge: true } as Record<string, boolean>, avgRent: 1830 },
  { id: 'harbour',   name: 'Harbour Pointe', cls: 'B+', units: 400, built: 2017, dist: 1.5, amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>, avgRent: 1720 },
  { id: 'enclave',   name: 'The Enclave PSL', cls: 'B',  units: 180, built: 2014, dist: 2.1, amenities: { pkg: false, fitness: true, dog: false, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>, avgRent: 1580 },
  { id: 'riverview', name: 'Riverview Apts',  cls: 'A-', units: 290, built: 2020, dist: 1.8, amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false } as Record<string, boolean>, avgRent: 1870 },
];

const SUBMARKET = {
  name: 'Port St. Lucie · West', properties: 47,
  penetration: { pkg: 72, fitness: 91, dog: 64, pool: 78, cowork: 38, ev: 42, rooftop: 22, concierge: 14 } as Record<string, number>,
};

const LIFT: Record<string, { cost: number; liftPerUnit: number; roi: string; tier: string }> = {
  pkg:       { cost: 45000,  liftPerUnit: 50, roi: '0.9yr', tier: 'BASE' },
  fitness:   { cost: 120000, liftPerUnit: 25, roi: '1.7yr', tier: 'BASE' },
  dog:       { cost: 35000,  liftPerUnit: 12, roi: '1.0yr', tier: 'BASE' },
  pool:      { cost: 450000, liftPerUnit: 65, roi: '2.5yr', tier: 'PREMIUM' },
  cowork:    { cost: 180000, liftPerUnit: 35, roi: '1.8yr', tier: 'COMPETITIVE' },
  ev:        { cost: 64000,  liftPerUnit: 15, roi: '1.4yr', tier: 'COMPETITIVE' },
  rooftop:   { cost: 280000, liftPerUnit: 45, roi: '2.2yr', tier: 'PREMIUM' },
  concierge: { cost: 95000,  liftPerUnit: 30, roi: '1.1yr', tier: 'COMPETITIVE' },
};

function Pill({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ ...mono, backgroundColor: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 2, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
      {children}
    </span>
  );
}

function SectionLabel({ label, accent = C.cyan }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, backgroundColor: accent, borderRadius: 1 }} />
      <span style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function PenBar({ pct, color, width = 48 }: { pct: number; color: string; width?: number }) {
  return (
    <div style={{ width, height: 4, backgroundColor: C.borderMid, borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 1, opacity: 0.85 }} />
    </div>
  );
}

const compPenetration = (key: string) => Math.round((COMPS.filter(c => c.amenities[key]).length / COMPS.length) * 100);

export function ProgramExisting() {
  const [view, setView] = useState<'matrix' | 'impact'>('matrix');

  const missingAmenities = AMENITIES.filter(a => !SUBJECT.amenities[a.key]);
  const totalMissingCost = missingAmenities.reduce((s, a) => s + LIFT[a.key].cost, 0);
  const totalLiftPerUnit = missingAmenities.reduce((s, a) => s + LIFT[a.key].liftPerUnit, 0);
  const annualLift = totalLiftPerUnit * SUBJECT.units * 12;

  const topGap = missingAmenities
    .map(a => ({ ...a, cp: compPenetration(a.key), sp: SUBMARKET.penetration[a.key] }))
    .sort((a, b) => b.cp - a.cp)[0];

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh', color: C.textPrimary, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12 }}>
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...mono, fontSize: 9, color: C.cyan, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>EXISTING ASSET · AMENITY GAP</span>
          <Pill color={C.cyan}>EXISTING</Pill>
        </div>
        <span style={{ ...mono, color: C.textMuted, fontSize: 9 }}>{SUBJECT.units}u · {SUBJECT.cls} · {SUBJECT.built} · {SUBMARKET.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' as const }}>

          <div style={{ backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2, padding: '8px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={13} color={C.amber} />
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, color: C.textMuted, fontSize: 9, letterSpacing: '0.08em', marginBottom: 4 }}>GAP ANALYSIS DRIVEN BY COMP PARITY + SUBMARKET PENETRATION</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  {([
                    ['EXISTING', C.cyan],
                    ['→', C.textMuted],
                    [`${missingAmenities.length} amenity gaps vs comps`, C.amber],
                    ['·', C.textDim],
                    [topGap ? `${topGap.name}: ${topGap.cp}% comp penetration — table stakes` : '', C.red],
                    ['·', C.textDim],
                    [`Close cost $${(totalMissingCost / 1000).toFixed(0)}K → +$${totalLiftPerUnit}/u/mo`, C.textMuted],
                  ] as [string, string][]).map(([t, col], i) => (
                    <span key={i} style={{ ...mono, color: col, fontSize: 10, fontWeight: t === 'EXISTING' ? 700 : 400 }}>{t}</span>
                  ))}
                </div>
              </div>
              <button style={{ ...mono, fontSize: 9, padding: '3px 8px', color: C.amber, border: `1px solid ${C.amber}40`, borderRadius: 2, backgroundColor: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>View Impact →</button>
            </div>
          </div>

          <div style={{ display: 'flex', marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            {[
              { label: 'AMENITY GAPS', val: String(missingAmenities.length), sub: `of ${AMENITIES.length} tracked`, color: C.red },
              { label: 'CLOSE COST', val: `$${(totalMissingCost / 1000).toFixed(0)}K`, sub: 'all missing', color: C.amber },
              { label: 'EST LIFT', val: `+$${totalLiftPerUnit}/u`, sub: '/mo if all closed', color: C.green },
              { label: 'ANNUAL IMPACT', val: `$${(annualLift / 1e6).toFixed(2)}M`, sub: `across ${SUBJECT.units}u`, color: C.green },
            ].map((k, i, arr) => (
              <div key={k.label} style={{ flex: 1, padding: '8px 12px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', backgroundColor: C.panelAlt }}>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 3 }}>{k.label}</div>
                <div style={{ ...mono, fontSize: 15, color: k.color, fontWeight: 700, lineHeight: 1 }}>{k.val}</div>
                <div style={{ ...mono, fontSize: 8, color: C.textMuted, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ backgroundColor: C.panelAlt, padding: '7px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="AMENITY GAP ANALYSIS — COMP PARITY + SUBMARKET" accent={C.amber} />
              <div style={{ display: 'flex', gap: 4 }}>
                {(['matrix', 'impact'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{ ...mono, fontSize: 8, padding: '2px 8px', fontWeight: 700, border: `1px solid ${view === v ? C.cyan + '50' : C.border}`, borderRadius: 2, cursor: 'pointer', backgroundColor: view === v ? `${C.cyan}14` : 'transparent', color: view === v ? C.cyan : C.textMuted }}>
                    {v === 'matrix' ? 'COMP MATRIX' : 'IMPACT ANALYSIS'}
                  </button>
                ))}
              </div>
            </div>

            {view === 'matrix' && (
              <div style={{ overflowX: 'auto' as const }}>
                <div style={{ minWidth: 680 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `150px 48px repeat(${COMPS.length}, 1fr) 56px 56px`, padding: '4px 12px', backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ ...mono, fontSize: 7, color: C.textMuted, fontWeight: 700 }}>AMENITY</span>
                    <span style={{ ...mono, fontSize: 7, color: C.subject, fontWeight: 700, textAlign: 'center' as const }}>YOU</span>
                    {COMPS.map(c => (
                      <div key={c.id} style={{ textAlign: 'center' as const, overflow: 'hidden' }}>
                        <div style={{ ...mono, fontSize: 7, color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name.split(' ')[0]}</div>
                        <div style={{ ...mono, fontSize: 6, color: C.textMuted }}>{c.cls}</div>
                      </div>
                    ))}
                    <span style={{ ...mono, fontSize: 7, color: C.textMuted, fontWeight: 700, textAlign: 'center' as const }}>COMP%</span>
                    <span style={{ ...mono, fontSize: 7, color: C.textMuted, fontWeight: 700, textAlign: 'center' as const }}>SUBM%</span>
                  </div>

                  {AMENITIES.map((a, ri) => {
                    const subjectHas = SUBJECT.amenities[a.key];
                    const cp = compPenetration(a.key);
                    const sp = SUBMARKET.penetration[a.key];
                    const isMissing = !subjectHas;
                    const isHighGap = isMissing && cp >= 60;
                    return (
                      <div key={a.key} style={{
                        display: 'grid', gridTemplateColumns: `150px 48px repeat(${COMPS.length}, 1fr) 56px 56px`,
                        padding: '6px 12px', alignItems: 'center',
                        borderBottom: `1px solid ${C.border}25`,
                        backgroundColor: isHighGap ? `${C.red}06` : ri % 2 === 0 ? 'transparent' : `${C.panelAlt}60`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 14, backgroundColor: isMissing ? (isHighGap ? C.red : C.amber) : C.green, borderRadius: 1, opacity: isMissing ? 1 : 0.4 }} />
                          <div>
                            <div style={{ fontSize: 9, color: isMissing ? C.textPrimary : C.textMuted }}>{a.name}</div>
                            <div style={{ ...mono, fontSize: 7, color: C.textMuted }}>{a.category}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' as const }}>
                          <span style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2, backgroundColor: subjectHas ? `${C.green}18` : `${C.red}18`, color: subjectHas ? C.green : C.red, border: `1px solid ${subjectHas ? C.green : C.red}30` }}>
                            {subjectHas ? '✓' : '✗'}
                          </span>
                        </div>
                        {COMPS.map(c => (
                          <div key={c.id} style={{ textAlign: 'center' as const }}>
                            <span style={{ fontSize: 9, color: c.amenities[a.key] ? C.green : C.textMuted, opacity: c.amenities[a.key] ? 0.85 : 0.35 }}>{c.amenities[a.key] ? '●' : '○'}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                          <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: cp >= 60 && isMissing ? C.red : C.textMuted }}>{cp}%</span>
                          <PenBar pct={cp} color={cp >= 60 && isMissing ? C.red : C.textMuted} width={36} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                          <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: sp >= 50 && isMissing ? C.amber : C.textMuted }}>{sp}%</span>
                          <PenBar pct={sp} color={sp >= 50 && isMissing ? C.amber : C.textMuted} width={36} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'impact' && (
              <>
                {missingAmenities.map(a => {
                  const lift = LIFT[a.key];
                  const cp = compPenetration(a.key);
                  const sp = SUBMARKET.penetration[a.key];
                  const annImpact = lift.liftPerUnit * SUBJECT.units * 12;
                  const compsWithIt = COMPS.filter(c => c.amenities[a.key]);
                  const urgency = cp >= 70 ? 'CRITICAL' : cp >= 50 ? 'HIGH' : sp >= 40 ? 'MEDIUM' : 'LOW';
                  const urgencyColor = urgency === 'CRITICAL' ? C.red : urgency === 'HIGH' ? C.amber : urgency === 'MEDIUM' ? C.cyan : C.textMuted;
                  return (
                    <div key={a.key} style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 18, backgroundColor: urgencyColor, borderRadius: 1 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary }}>{a.name}</span>
                          <Pill color={urgencyColor}>{urgency}</Pill>
                          <span style={{ ...mono, fontSize: 8, color: C.textMuted, backgroundColor: `${C.borderMid}60`, padding: '1px 5px', borderRadius: 2 }}>{lift.tier}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>COST</span>
                          <span style={{ ...mono, fontSize: 12, color: C.amber, fontWeight: 700 }}>${(lift.cost / 1000).toFixed(0)}K</span>
                          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>LIFT</span>
                          <span style={{ ...mono, fontSize: 12, color: C.green, fontWeight: 700 }}>+${lift.liftPerUnit}/u</span>
                          <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>ROI</span>
                          <span style={{ ...mono, fontSize: 12, color: C.textPrimary, fontWeight: 700 }}>{lift.roi}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginLeft: 9 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.08em', marginBottom: 4 }}>COMP PARITY — {cp}% HAVE IT</div>
                          <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' as const }}>
                            {COMPS.map(c => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px', borderRadius: 2, backgroundColor: c.amenities[a.key] ? `${C.green}10` : C.bg, border: `1px solid ${c.amenities[a.key] ? C.green + '30' : C.border}` }}>
                                <span style={{ fontSize: 7, color: c.amenities[a.key] ? C.green : C.textMuted, fontWeight: 700 }}>{c.amenities[a.key] ? '✓' : '✗'}</span>
                                <span style={{ ...mono, fontSize: 7, color: c.amenities[a.key] ? C.textMuted : C.textMuted }}>{c.name.split(' ')[0]}</span>
                              </div>
                            ))}
                          </div>
                          {compsWithIt.length > 0 && (
                            <div style={{ fontSize: 8, color: C.textMuted }}>
                              Comps with it avg: <span style={{ ...mono, color: C.green, fontWeight: 700 }}>${Math.round(compsWithIt.reduce((s, c) => s + c.avgRent, 0) / compsWithIt.length)}/mo</span>
                            </div>
                          )}
                        </div>
                        <div style={{ width: 1, backgroundColor: C.border }} />
                        <div style={{ minWidth: 130 }}>
                          <div style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.08em', marginBottom: 4 }}>SUBMARKET — {sp}% PENETRATION</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <PenBar pct={sp} color={sp >= 50 ? C.amber : C.textMuted} width={80} />
                            <span style={{ ...mono, fontSize: 9, color: sp >= 50 ? C.amber : C.textMuted, fontWeight: 700 }}>{sp}%</span>
                          </div>
                          <span style={{ fontSize: 8, color: C.textMuted }}>{SUBMARKET.properties} properties</span>
                        </div>
                        <div style={{ width: 1, backgroundColor: C.border }} />
                        <div style={{ minWidth: 100, textAlign: 'right' as const }}>
                          <div style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.08em', marginBottom: 4 }}>ANNUAL IMPACT</div>
                          <div style={{ ...mono, fontSize: 14, color: C.green, fontWeight: 700 }}>${(annImpact / 1000).toFixed(0)}K</div>
                          <div style={{ ...mono, fontSize: 8, color: C.textMuted }}>{SUBJECT.units}u × ${lift.liftPerUnit} × 12</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '8px 12px', backgroundColor: C.panelAlt, borderTop: `2px solid ${C.borderMid}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted, fontWeight: 700 }}>TOTAL CLOSE COST</span>
                    <span style={{ ...mono, fontSize: 13, color: C.amber, fontWeight: 700 }}>${(totalMissingCost / 1000).toFixed(0)}K</span>
                    <span style={{ color: C.border }}>·</span>
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted, fontWeight: 700 }}>TOTAL LIFT</span>
                    <span style={{ ...mono, fontSize: 13, color: C.green, fontWeight: 700 }}>+${totalLiftPerUnit}/u/mo</span>
                    <span style={{ color: C.border }}>·</span>
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted, fontWeight: 700 }}>ANNUAL</span>
                    <span style={{ ...mono, fontSize: 13, color: C.green, fontWeight: 700 }}>${(annualLift / 1e6).toFixed(2)}M</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 2, backgroundColor: C.panelAlt }}>
            <div style={{ ...mono, fontSize: 7, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>COMP RENT CONTEXT</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', backgroundColor: `${C.subject}14`, border: `1px solid ${C.subject}30`, borderRadius: 2 }}>
                <div style={{ width: 5, height: 5, backgroundColor: C.subject, borderRadius: 1 }} />
                <span style={{ ...mono, fontSize: 8, color: C.subject, fontWeight: 700 }}>YOU ${SUBJECT.avgRent}/mo</span>
              </div>
              {COMPS.map(c => {
                const delta = c.avgRent - SUBJECT.avgRent;
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 2 }}>
                    <span style={{ ...mono, fontSize: 8, color: C.textMuted }}>{c.name.split(' ')[0]}</span>
                    <span style={{ ...mono, fontSize: 8, color: C.textPrimary, fontWeight: 700 }}>${c.avgRent}</span>
                    <span style={{ ...mono, fontSize: 7, color: delta > 0 ? C.green : C.red, fontWeight: 700 }}>{delta > 0 ? '+' : ''}{delta}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, padding: 14, flexShrink: 0, backgroundColor: C.bg }}>
          <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>ACTION SUMMARY</div>
          {missingAmenities.map((a, i) => {
            const lift = LIFT[a.key];
            const cp = compPenetration(a.key);
            const urgencyColor = cp >= 70 ? C.red : cp >= 50 ? C.amber : C.cyan;
            return (
              <div key={a.key} style={{ border: `1px solid ${i === 0 ? urgencyColor + '50' : C.border}`, backgroundColor: i === 0 ? `${urgencyColor}08` : 'transparent', borderRadius: 2, padding: '8px 10px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: C.textPrimary, fontSize: 10, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ ...mono, color: urgencyColor, fontSize: 9, fontWeight: 700 }}>{cp}%</span>
                </div>
                <div style={{ ...mono, color: C.textMuted, fontSize: 8, marginBottom: 2 }}>{a.category} · {lift.tier}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ ...mono, color: C.amber, fontSize: 8 }}>${(lift.cost / 1000).toFixed(0)}K</span>
                  <span style={{ ...mono, color: C.green, fontSize: 8, fontWeight: 700 }}>+${lift.liftPerUnit}/u</span>
                  <span style={{ ...mono, color: C.textMuted, fontSize: 8 }}>{lift.roi}</span>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ ...mono, color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>SUBMARKET COVERAGE</div>
            {AMENITIES.map(a => {
              const sp = SUBMARKET.penetration[a.key];
              const isMissing = !SUBJECT.amenities[a.key];
              return (
                <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}25`, padding: '4px 0' }}>
                  <span style={{ fontSize: 8, color: isMissing ? C.textPrimary : C.textMuted }}>{a.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <PenBar pct={sp} color={sp >= 50 ? (isMissing ? C.amber : C.textMuted) : C.textMuted} width={30} />
                    <span style={{ ...mono, fontSize: 8, color: sp >= 50 && isMissing ? C.amber : C.textMuted }}>{sp}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, padding: '8px 10px', backgroundColor: `${C.amber}08`, border: `1px solid ${C.amber}30`, borderRadius: 2 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <CheckCircle size={11} color={C.amber} />
              <span style={{ ...mono, color: C.amber, fontSize: 9, fontWeight: 700 }}>CLOSE ALL GAPS: +${totalLiftPerUnit}/u</span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 9 }}>Close cost ${(totalMissingCost / 1000).toFixed(0)}K total. Annual rent impact ${(annualLift / 1e6).toFixed(2)}M across {SUBJECT.units} units.</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button style={{ ...mono, width: '100%', padding: '7px 0', fontSize: 10, fontWeight: 700, backgroundColor: C.cyan, color: C.bg, border: 'none', borderRadius: 2, cursor: 'pointer' }}>
              PUSH TO PROFORMA →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
