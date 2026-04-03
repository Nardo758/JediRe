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

const UNIT_TYPES = [
  { key: "studio", label: "Studio", abbr: "STU", color: C.studio, marketMix: 5.3, marketRent: 1240, marketSF: 508, proposedMix: 5, proposedRent: 1302, proposedSF: 510, units: 13 },
  { key: "1br", label: "1 BR", abbr: "1BR", color: C.oneBR, marketMix: 42, marketRent: 1642, marketSF: 748, proposedMix: 38, proposedRent: 1750, proposedSF: 785, units: 95 },
  { key: "2br", label: "2 BR", abbr: "2BR", color: C.twoBR, marketMix: 44, marketRent: 1948, marketSF: 1055, proposedMix: 44, proposedRent: 2100, proposedSF: 1100, units: 110 },
  { key: "3br", label: "3 BR+", abbr: "3BR", color: C.threeBR, marketMix: 8.7, marketRent: 2280, marketSF: 1298, proposedMix: 13, proposedRent: 2480, proposedSF: 1320, units: 33 },
];

const DEAL_TYPES = [
  { key: "development", label: "Development", desc: "Ground-up" },
  { key: "redevelopment", label: "Redevelopment", desc: "Add/convert" },
  { key: "existing", label: "Existing", desc: "As-is" },
];

const AMENITIES = [
  { tier: 'BASE', color: C.green, items: [
    { name: 'Package Lockers', cost: '$45K', lift: '+$18/u', roi: '2.1yr' },
    { name: 'Fitness Center', cost: '$120K', lift: '+$25/u', roi: '1.7yr' },
    { name: 'Dog Park/Wash', cost: '$35K', lift: '+$12/u', roi: '1.0yr' },
  ]},
  { tier: 'COMPETITIVE', color: C.yellow, items: [
    { name: 'Rooftop Lounge', cost: '$280K', lift: '+$45/u', roi: '2.2yr' },
    { name: 'Coworking Space', cost: '$180K', lift: '+$35/u', roi: '1.8yr' },
    { name: 'EV Charging (8)', cost: '$64K', lift: '+$15/u', roi: '1.4yr' },
  ]},
  { tier: 'PREMIUM', color: C.purple, items: [
    { name: 'Pool + Cabanas', cost: '$450K', lift: '+$65/u', roi: '2.5yr' },
    { name: 'Sky Deck w/ Grills', cost: '$320K', lift: '+$50/u', roi: '2.3yr' },
  ]},
];

function DeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span style={{ color: C.dim, fontSize: 9, fontFamily: mono }}>—</span>;
  const pos = value > 0;
  const color = pos ? C.green : C.red;
  return (
    <span style={{ color, fontSize: 9, fontFamily: mono, letterSpacing: -0.3 }}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function MixBar({ proposed, market, color }: { proposed: number; market: number; color: string }) {
  const maxVal = Math.max(proposed, market, 50);
  const pW = (proposed / maxVal) * 100;
  const mW = (market / maxVal) * 100;
  return (
    <div style={{ position: "relative", height: 18, width: "100%" }}>
      <div style={{
        position: "absolute", left: `${mW}%`, top: 0, bottom: 0, width: 1,
        background: C.dim, zIndex: 2, opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", left: `calc(${mW}% + 3px)`, top: 0,
        fontSize: 8, fontFamily: mono, color: C.faint, whiteSpace: "nowrap",
      }}>
        MKT {market.toFixed(0)}%
      </div>
      <div style={{
        position: "absolute", left: 0, top: 6, height: 6,
        width: `${pW}%`, background: color, borderRadius: 1, opacity: 0.8,
        transition: "width 0.3s ease",
      }} />
    </div>
  );
}

function EnvelopeGauge({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = (used / total) * 100;
  const remaining = total - used;
  const isOver = used > total;
  const barColor = isOver ? C.red : pct > 90 ? C.yellow : C.green;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
        <span style={{ fontSize: 9, fontFamily: mono, color: isOver ? C.red : C.dim }}>
          {remaining > 0 ? `${remaining.toLocaleString()} remaining` : `${Math.abs(remaining).toLocaleString()} over`}
        </span>
      </div>
      <div style={{ height: 4, background: C.bg, borderRadius: 1, position: "relative" }}>
        <div style={{
          height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor,
          borderRadius: 1, transition: "width 0.3s ease",
        }} />
        <div style={{
          position: "absolute", right: 0, top: -2, bottom: -2, width: 1,
          background: C.faint, opacity: 0.4,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, fontFamily: mono, color: C.text }}>{used.toLocaleString()}</span>
        <span style={{ fontSize: 9, fontFamily: mono, color: C.faint }}>/ {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function KPICell({ label, value, sub, accent, last }: { label: string; value: string | number; sub?: string; accent?: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, borderRight: last ? "none" : `1px solid ${C.border}`, padding: "6px 12px" }}>
      <div style={{ fontSize: 8, fontFamily: mono, color: C.faint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: mono, color: accent || C.text, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, fontFamily: mono, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function UnitTypeRow({ unit, isLast }: { unit: typeof UNIT_TYPES[0]; isLast: boolean }) {
  const annualRev = unit.proposedRent * unit.units * 12;
  const psfRent = unit.proposedSF > 0 ? (unit.proposedRent / unit.proposedSF) : 0;
  const mixDelta = unit.proposedMix - unit.marketMix;
  const rentDelta = unit.proposedRent - unit.marketRent;
  const sfDelta = unit.proposedSF - unit.marketSF;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 120px 1fr 1fr 70px 80px 24px",
        gap: 0, alignItems: "center",
        padding: "10px 12px",
        borderBottom: isLast ? "none" : `1px solid ${C.borderSub}`,
        background: hovered ? C.elevated : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 3, height: 24, background: unit.color, borderRadius: 1 }} />
        <div>
          <div style={{ fontSize: 11, fontFamily: mono, color: C.text, fontWeight: 600 }}>{unit.label}</div>
          <div style={{ fontSize: 9, fontFamily: mono, color: C.faint }}>{unit.units} units</div>
        </div>
      </div>

      <div style={{ paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 1 }}>
          <span style={{ fontSize: 12, fontFamily: mono, color: C.text, fontWeight: 600 }}>{unit.proposedMix}%</span>
          <DeltaBadge value={mixDelta} suffix="pp" />
        </div>
        <MixBar proposed={unit.proposedMix} market={unit.marketMix} color={unit.color} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 2, padding: "2px 6px",
        }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>SF</span>
          <span style={{ fontSize: 11, fontFamily: mono, color: C.text, fontWeight: 600 }}>{unit.proposedSF.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>avg {unit.marketSF.toLocaleString()}</span>
          <DeltaBadge value={sfDelta} suffix=" sf" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 2, padding: "2px 6px",
        }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>RENT</span>
          <span style={{ fontSize: 11, fontFamily: mono, color: C.text, fontWeight: 600 }}>${unit.proposedRent.toLocaleString()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint }}>avg ${unit.marketRent.toLocaleString()}</span>
          <DeltaBadge value={rentDelta} suffix="" />
        </div>
      </div>

      <div>
        <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, display: "block", marginBottom: 1 }}>$/SF</span>
        <span style={{ fontSize: 12, fontFamily: mono, color: C.accent, fontWeight: 600 }}>${psfRent.toFixed(2)}</span>
      </div>

      <div style={{ textAlign: "right" as const }}>
        <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, display: "block", marginBottom: 1 }}>ANNUAL</span>
        <span style={{ fontSize: 11, fontFamily: mono, color: unit.color, fontWeight: 600 }}>${(annualRev / 1e3).toFixed(0)}K</span>
      </div>

      <div style={{ paddingLeft: 4 }}>
        <div style={{ height: 24, width: 4, background: C.bg, borderRadius: 1, position: "relative" as const, display: "inline-block", verticalAlign: "middle" }}>
          <div style={{
            position: "absolute" as const, bottom: 0, width: "100%", borderRadius: 1,
            height: `${(annualRev / 2800000) * 100}%`,
            background: unit.color, opacity: 0.7,
          }} />
        </div>
      </div>
    </div>
  );
}

export function ProgramDev() {
  const [dealType, setDealType] = useState("development");
  const [optimizing, setOptimizing] = useState(false);

  const totalUnits = UNIT_TYPES.reduce((a, u) => a + u.units, 0);
  const maxUnits = 280;
  const totalSF = UNIT_TYPES.reduce((a, u) => a + (u.proposedSF * u.units), 0);
  const maxSF = 310000;
  const grossRev = UNIT_TYPES.reduce((a, u) => a + (u.proposedRent * u.units * 12), 0);
  const avgPSF = grossRev / 12 / totalSF;
  const avgRent = grossRev / 12 / totalUnits;

  const tabs = [
    { id: 'discovery', label: 'DISCOVERY' },
    { id: 'demand', label: 'DEMAND' },
    { id: 'comps', label: 'COMPS' },
    { id: 'trends', label: 'TRENDS' },
    { id: 'program', label: 'PROGRAM', active: true },
  ];

  return (
    <div style={{
      height: '100vh', background: C.bg, fontFamily: mono,
      color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>F3</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>MARKET INTELLIGENCE</span>
          <span style={{ color: C.faint, fontSize: 8, fontFamily: mono }}>M03 · PROGRAM</span>
        </div>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 7, padding: '2px 5px', background: C.green + '15', borderRadius: 2, fontWeight: 700 }}>DEVELOPMENT</span>
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
        <div style={{
          display: "flex", gap: 20, padding: "8px 12px",
          background: C.card, borderBottom: `1px solid ${C.border}`,
        }}>
          <EnvelopeGauge used={totalUnits} total={maxUnits} label="Unit envelope" />
          <div style={{ width: 1, background: C.border }} />
          <EnvelopeGauge used={totalSF} total={maxSF} label="SF envelope" />
        </div>

        <div style={{
          display: "flex", borderBottom: `1px solid ${C.border}`, background: C.surface,
        }}>
          <KPICell label="Total units" value={totalUnits} sub={`of ${maxUnits} max`} />
          <KPICell label="Net SF" value={totalSF.toLocaleString()} sub={`${Math.round(totalSF / totalUnits)} avg/unit`} />
          <KPICell label="Gross rev" value={`$${(grossRev / 1e6).toFixed(2)}M`} sub="annual" accent={C.green} />
          <KPICell label="Avg rent" value={`$${avgRent.toFixed(0)}`} sub="/unit/mo" />
          <KPICell label="Avg $/SF" value={`$${avgPSF.toFixed(2)}`} sub="/mo" last />
        </div>

        <div style={{
          padding: '6px 12px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.surface,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>M03</span>
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>Unit Program</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              display: "flex", background: C.bg, borderRadius: 2,
              border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              {DEAL_TYPES.map(dt => (
                <button
                  key={dt.key}
                  onClick={() => setDealType(dt.key)}
                  style={{
                    padding: "3px 8px", border: "none", cursor: "pointer",
                    fontSize: 8, fontFamily: mono, letterSpacing: 0.3,
                    background: dealType === dt.key ? C.elevated : "transparent",
                    color: dealType === dt.key ? C.text : C.faint,
                    borderRight: `1px solid ${C.border}`,
                  }}
                >
                  {dt.label}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: C.border }} />
            <button
              onClick={() => { setOptimizing(true); setTimeout(() => setOptimizing(false), 2000); }}
              style={{
                padding: "3px 8px", border: `1px solid ${C.blue}33`,
                borderRadius: 2, cursor: "pointer",
                fontSize: 8, fontFamily: mono, letterSpacing: 0.5, fontWeight: 700,
                background: optimizing ? `${C.blue}15` : "transparent",
                color: C.blue,
              }}
            >
              {optimizing ? "OPTIMIZING..." : "AI OPTIMIZE"}
            </button>
            <button style={{
              padding: "3px 8px", border: `1px solid ${C.border}`,
              borderRadius: 2, cursor: "pointer", background: "transparent",
              fontSize: 8, fontFamily: mono, color: C.faint, fontWeight: 700,
            }}>
              RESET
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "72px 120px 1fr 1fr 70px 80px 24px",
          padding: "4px 12px",
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
        }}>
          {["Type", "Mix %", "Avg SF", "Rent", "$/SF", "Rev", ""].map((h, i) => (
            <span key={i} style={{
              fontSize: 8, fontFamily: mono, color: C.faint,
              textTransform: "uppercase" as const, letterSpacing: 0.8,
            }}>{h}</span>
          ))}
        </div>

        {UNIT_TYPES.map((unit, i) => (
          <UnitTypeRow key={unit.key} unit={unit} isLast={i === UNIT_TYPES.length - 1} />
        ))}

        <div style={{
          display: "grid",
          gridTemplateColumns: "72px 120px 1fr 1fr 70px 80px 24px",
          padding: "8px 12px",
          borderTop: `2px solid ${C.border}`,
          background: C.card,
        }}>
          <div>
            <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, letterSpacing: 0.5 }}>TOTAL</span>
          </div>
          <div>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.text, fontWeight: 600 }}>100%</span>
          </div>
          <div>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.text }}>{Math.round(totalSF / totalUnits)} avg</span>
          </div>
          <div>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.text }}>${avgRent.toFixed(0)} avg</span>
          </div>
          <div>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.accent, fontWeight: 600 }}>${avgPSF.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.green, fontWeight: 700 }}>${(grossRev / 1e6).toFixed(2)}M</span>
          </div>
          <div />
        </div>

        <div style={{ padding: "6px 12px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 8, fontFamily: mono, color: C.faint, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 4 }}>
            Revenue composition
          </div>
          <div style={{ display: "flex", height: 5, borderRadius: 1, overflow: "hidden", gap: 1 }}>
            {UNIT_TYPES.map(u => {
              const rev = u.proposedRent * u.units * 12;
              const pct = (rev / grossRev) * 100;
              return (
                <div key={u.key} style={{
                  width: `${pct}%`, background: u.color, opacity: 0.75,
                  transition: "width 0.3s ease",
                }} />
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {UNIT_TYPES.map(u => {
              const rev = u.proposedRent * u.units * 12;
              const pct = (rev / grossRev) * 100;
              return (
                <div key={u.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 5, height: 5, background: u.color, borderRadius: 1, opacity: 0.75 }} />
                  <span style={{ fontSize: 8, fontFamily: mono, color: C.dim }}>
                    {u.label} {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>AMENITY</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>Amenity Package Builder</span>
              <span style={{ color: C.faint, fontSize: 8 }}>new construction</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: C.faint, fontSize: 8, fontFamily: mono }}>TOTAL COST</span>
              <span style={{ color: C.yellow, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>$1.49M</span>
              <span style={{ color: C.faint, fontSize: 8, fontFamily: mono }}>EST LIFT</span>
              <span style={{ color: C.green, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>+$265/u</span>
            </div>
          </div>
          {AMENITIES.map((tier, ti) => (
            <div key={tier.tier}>
              <div style={{ padding: '3px 12px', background: C.bg, borderBottom: `1px solid ${C.border}`, borderTop: ti > 0 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: '0.06em', color: tier.color }}>{tier.tier}</span>
              </div>
              {tier.items.map((item, ii) => (
                <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px 24px', padding: '4px 12px',
                  borderBottom: `1px solid ${C.border}30`, alignItems: 'center' }}>
                  <span style={{ color: C.text, fontSize: 9 }}>{item.name}</span>
                  <span style={{ color: C.dim, fontFamily: mono, fontSize: 8, textAlign: 'right' as const }}>{item.cost}</span>
                  <span style={{ color: C.green, fontFamily: mono, fontSize: 8, fontWeight: 700, textAlign: 'right' as const }}>{item.lift}</span>
                  <span style={{ color: C.faint, fontFamily: mono, fontSize: 7, textAlign: 'right' as const }}>{item.roi}</span>
                  <div style={{ textAlign: 'center' as const }}>
                    <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 3px', borderRadius: 2, background: C.green + '18', color: C.green, border: `1px solid ${C.green}40` }}>✓</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 12px", borderTop: `1px solid ${C.border}`,
        background: C.card, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, letterSpacing: 0.5 }}>
            DEAL TYPE: {DEAL_TYPES.find(d => d.key === dealType)?.label.toUpperCase()}
          </span>
          <span style={{ color: C.faint, fontSize: 8 }}>·</span>
          <span style={{ fontSize: 8, fontFamily: mono, color: C.faint, letterSpacing: 0.5 }}>ZONING: PUD-R / C-3</span>
          <span style={{ color: C.faint, fontSize: 8 }}>·</span>
          <span style={{ fontSize: 8, fontFamily: mono, color: totalSF <= maxSF ? C.green : C.red, letterSpacing: 0.5 }}>
            {totalSF <= maxSF ? "WITHIN ENVELOPE" : "EXCEEDS ENVELOPE"}
          </span>
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
