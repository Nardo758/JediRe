import React, { useState } from 'react';
import { useTabTheme } from '../../../hooks/useTabTheme';

interface OwnersTabProps {
  marketId: string;
  summary?: Record<string, any>;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const insightBox = (color: string): React.CSSProperties => ({
  background: color + '0A', border: `1px solid ${color}28`, padding: '8px 10px', borderRadius: 2, marginTop: 8,
});
const badge = (color: string): React.CSSProperties => ({
  fontSize: 8, fontWeight: 700, color, background: color + '20', padding: '1px 6px', borderRadius: 2, letterSpacing: 1, ...mono,
});

const OWNERSHIP_TIMELINE = [
  { year: '2019', acquisitions: 18, dispositions: 4  },
  { year: '2020', acquisitions: 6,  dispositions: 12 },
  { year: '2021', acquisitions: 42, dispositions: 8  },
  { year: '2022', acquisitions: 28, dispositions: 22 },
  { year: '2023', acquisitions: 14, dispositions: 16 },
  { year: '2024', acquisitions: 22, dispositions: 10 },
  { year: '2025', acquisitions: 19, dispositions: 7  },
];

const OwnersTab: React.FC<OwnersTabProps> = ({ marketId, summary }) => {
  const T = useTabTheme();
  const card: React.CSSProperties = { background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' };
  const hdr = (accent: string): React.CSSProperties => ({
    padding: '8px 14px', background: T.dimBg,
    borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${accent}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  });
  const TOP_OWNERS = [
    { owner: 'Camden Property Trust',  ticker: 'CPT',  props: 42, units: 18400, avgHold: '4.2yr', mktCap: '$11.2B', signal: 'BUY',   signalColor: T.green,    motivation: 68, holdRisk: 'LOW',  notes: 'Active acquirer — Atlanta core focus' },
    { owner: 'Cortland',               ticker: null,   props: 34, units: 12800, avgHold: '3.5yr', mktCap: 'Private',signal: 'BUY',   signalColor: T.green,    motivation: 72, holdRisk: 'LOW',  notes: 'Value-add specialist; B+ focus'       },
    { owner: 'Greystone Capital',       ticker: null,   props: 4,  units:  2200, avgHold: '5.8yr', mktCap: 'Private',signal: 'SELL?', signalColor: T.amber,    motivation: 81, holdRisk: 'HIGH', notes: 'Tax step-up risk; hold >5yr threshold' },
    { owner: 'AvalonBay Communities',   ticker: 'AVB',  props: 18, units:  8400, avgHold: '6.1yr', mktCap: '$27.1B', signal: 'HOLD',  signalColor: T.secondary, motivation: 44, holdRisk: 'MOD', notes: 'Institutional long-hold; Class A only' },
    { owner: 'Equity Residential',      ticker: 'EQR',  props: 12, units:  5600, avgHold: '7.3yr', mktCap: '$24.4B', signal: 'HOLD',  signalColor: T.secondary, motivation: 38, holdRisk: 'LOW', notes: 'Low disposition probability near-term'  },
    { owner: 'Brookfield Asset Mgmt',   ticker: 'BAM',  props: 8,  units:  3900, avgHold: '2.9yr', mktCap: '$82.0B', signal: 'BUY',   signalColor: T.green,    motivation: 65, holdRisk: 'MOD', notes: 'Short cycle; likely to transact 2025-26' },
  ];
  const PORTFOLIO_CONCENTRATION = [
    { submarket: 'Buckhead',      units: 14200, pct: 31, color: T.cyan   },
    { submarket: 'Midtown',       units:  9800, pct: 21, color: T.violet },
    { submarket: 'Decatur',       units:  7400, pct: 16, color: T.green  },
    { submarket: 'Sandy Springs', units:  6200, pct: 13, color: T.amber  },
    { submarket: 'East Atlanta',  units:  5100, pct: 11, color: T.secondary },
    { submarket: 'Other',         units:  3900, pct: 8,  color: T.muted  },
  ];
  const MOTIVATION_CRITERIA = [
    { label: 'Hold Period > 5yr',             matched: 142, total: 680, color: T.amber  },
    { label: 'Tax Step-Up Risk > 20%',        matched: 89,  total: 680, color: T.secondary },
    { label: 'Seller Motivation Score > 65',  matched: 194, total: 680, color: T.red    },
    { label: 'All Three (Combined)',           matched: 38,  total: 680, color: T.red    },
  ];
  const [showMotivated, setShowMotivated] = useState(false);
  const [sortBy, setSortBy] = useState<'units' | 'props' | 'hold' | 'motivation'>('units');

  const sortedOwners = [...TOP_OWNERS].sort((a, b) => {
    if (sortBy === 'units')      return b.units - a.units;
    if (sortBy === 'props')      return b.props - a.props;
    if (sortBy === 'hold')       return parseFloat(b.avgHold) - parseFloat(a.avgHold);
    if (sortBy === 'motivation') return b.motivation - a.motivation;
    return 0;
  });

  const maxTimeline = Math.max(...OWNERSHIP_TIMELINE.map(d => d.acquisitions + d.dispositions));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: T.bg, minHeight: '100%' }}>

      {/* ── SECTION 1: OWNERSHIP INTELLIGENCE TABLE ── */}
      <div style={card}>
        <div style={hdr(T.violet)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.violet, letterSpacing: 2, ...mono }}>OWNERSHIP INTELLIGENCE</span>
            <span style={badge(T.violet)}>PROPRIETARY</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>SORT BY:</span>
            {(['units', 'props', 'hold', 'motivation'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                fontSize: 8, fontWeight: 700, ...mono, cursor: 'pointer',
                padding: '2px 7px', borderRadius: 2, border: 'none',
                background: sortBy === s ? T.violet : T.dimBg,
                color: sortBy === s ? '#fff' : T.secondary,
                outline: sortBy === s ? 'none' : `1px solid ${T.border}`,
              }}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.dimBg }}>
                {['OWNER', 'TICKER', 'PROPS', 'UNITS', 'AVG HOLD', 'MKT CAP', 'MOTIVATION', 'HOLD RISK', 'SIGNAL', 'NOTES'].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: h === 'NOTES' ? 'left' : 'center', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: T.amber, letterSpacing: 1.5, ...mono }}>{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOwners.map((o, idx) => (
                <tr key={o.owner} style={{ background: idx % 2 === 0 ? T.panel : T.bg, borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '6px 10px', textAlign: 'left' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.text, ...mono }}>{o.owner}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    {o.ticker
                      ? <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, background: T.cyan + '18', padding: '1px 6px', borderRadius: 2, ...mono }}>{o.ticker}</span>
                      : <span style={{ fontSize: 9, color: T.muted, ...mono }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.text, ...mono }}>{o.props}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.text, ...mono }}>{o.units.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: parseFloat(o.avgHold) >= 5 ? T.amber : T.secondary, ...mono }}>{o.avgHold}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: T.secondary, ...mono }}>{o.mktCap}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      <div style={{ width: 50, height: 4, background: T.border, borderRadius: 2 }}>
                        <div style={{ width: `${o.motivation}%`, height: '100%', background: o.motivation >= 70 ? T.red : o.motivation >= 50 ? T.amber : T.green, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: o.motivation >= 70 ? T.red : o.motivation >= 50 ? T.amber : T.green, ...mono }}>{o.motivation}</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, ...mono,
                      color: o.holdRisk === 'HIGH' ? T.red : o.holdRisk === 'MOD' ? T.amber : T.green,
                      background: (o.holdRisk === 'HIGH' ? T.red : o.holdRisk === 'MOD' ? T.amber : T.green) + '20',
                      padding: '1px 6px', borderRadius: 2,
                    }}>{o.holdRisk}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, ...mono,
                      color: o.signalColor,
                      background: o.signalColor + '20',
                      padding: '2px 8px', borderRadius: 2,
                    }}>{o.signal}</span>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'left', maxWidth: 200 }}>
                    <span style={{ fontSize: 9, color: T.secondary, lineHeight: 1.4 }}>{o.notes}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 2: PORTFOLIO CONCENTRATION + ACQUISITION TIMELINE (side by side) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>

        {/* Portfolio Concentration */}
        <div style={card}>
          <div style={hdr(T.cyan)}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.cyan, letterSpacing: 2, ...mono }}>PORTFOLIO CONCENTRATION</span>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>BY SUBMARKET</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PORTFOLIO_CONCENTRATION.map(row => (
              <div key={row.submarket} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: T.secondary, ...mono, width: 100, flexShrink: 0 }}>{row.submarket}</span>
                <div style={{ flex: 1, height: 14, background: T.dimBg, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${row.pct}%`, height: '100%', background: row.color, opacity: 0.8, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: row.color, ...mono, width: 30, textAlign: 'right' }}>{row.pct}%</span>
                <span style={{ fontSize: 9, color: T.muted, ...mono, width: 52 }}>{(row.units / 1000).toFixed(1)}k u</span>
              </div>
            ))}
            <div style={insightBox(T.cyan)}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, ...mono }}>HHI CONCENTRATION · </span>
              <span style={{ fontSize: 9, color: T.secondary }}>Buckhead + Midtown = 52% of total units. HHI Index: 0.142 (moderate concentration). Decatur gaining share at +2.1%/yr.</span>
            </div>
          </div>
        </div>

        {/* Acquisition / Disposition Timeline */}
        <div style={card}>
          <div style={hdr(T.amber)}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>ACQUISITION / DISPOSITION TIMELINE</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: T.secondary, ...mono }}>
                <span style={{ width: 10, height: 10, background: T.green, display: 'inline-block', borderRadius: 1 }} />Acquisitions
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: T.secondary, ...mono }}>
                <span style={{ width: 10, height: 10, background: T.red, display: 'inline-block', borderRadius: 1 }} />Dispositions
              </span>
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <svg viewBox={`0 0 ${OWNERSHIP_TIMELINE.length * 60 + 20} 120`} style={{ height: '110px', width: 'auto', maxWidth: '100%' }}>
              {OWNERSHIP_TIMELINE.map((d, i) => {
                const x = i * 60 + 20, bW = 20;
                const acqH = (d.acquisitions / maxTimeline) * 80;
                const disH = (d.dispositions / maxTimeline) * 80;
                return (
                  <g key={d.year}>
                    <rect x={x} y={90 - acqH} width={bW} height={acqH} rx={2} fill={T.green} opacity={0.75} />
                    <rect x={x + bW + 2} y={90 - disH} width={bW} height={disH} rx={2} fill={T.red} opacity={0.75} />
                    <text x={x + bW + 1} y={105} textAnchor="middle" fill={T.muted} fontSize={8}>{d.year}</text>
                    <text x={x + bW / 2} y={90 - acqH - 3} textAnchor="middle" fill={T.green} fontSize={8}>{d.acquisitions}</text>
                    <text x={x + bW + 2 + bW / 2} y={90 - disH - 3} textAnchor="middle" fill={T.red} fontSize={8}>{d.dispositions}</text>
                  </g>
                );
              })}
              <line x1="15" y1="90" x2={OWNERSHIP_TIMELINE.length * 60 + 15} y2="90" stroke={T.border} strokeWidth={1} />
            </svg>
            <div style={insightBox(T.amber)}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>CYCLE SIGNAL · </span>
              <span style={{ fontSize: 9, color: T.secondary }}>2021 peak acquisition year (42 transactions). Disposition activity normalized in 2022-23. 2025 shows renewed buy-side interest (+27% vs 2024).</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: MOTIVATED SELLER ANALYSIS ── */}
      <div style={card}>
        <div style={hdr(T.red)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.red, letterSpacing: 2, ...mono }}>MOTIVATED SELLER ANALYSIS</span>
            <span style={badge(T.red)}>BUY-SIDE SIGNAL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: T.red, ...mono }}>142</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>PROPERTIES FLAGGED · 680 TOTAL TRACKED</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Criteria breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {MOTIVATION_CRITERIA.map(c => (
              <div key={c.label} style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '8px 10px' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.color, ...mono, marginBottom: 2 }}>{c.matched}</div>
                <div style={{ fontSize: 8, color: T.secondary, lineHeight: 1.4 }}>{c.label}</div>
                <div style={{ marginTop: 6, height: 3, background: T.border, borderRadius: 2 }}>
                  <div style={{ width: `${(c.matched / c.total) * 100}%`, height: '100%', background: c.color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2, ...mono }}>{((c.matched / c.total) * 100).toFixed(1)}% of tracked</div>
              </div>
            ))}
          </div>

          {/* Criteria definition */}
          <div style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 1.5, ...mono, marginBottom: 6 }}>SCREENING CRITERIA</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { code: 'C-1', label: 'Hold Period',        threshold: '> 5 years since last transaction' },
                { code: 'C-2', label: 'Tax Step-Up Risk',   threshold: '> 20% estimated tax liability on disposition' },
                { code: 'C-3', label: 'Motivation Score',   threshold: '> 65 on JEDI seller motivation model' },
              ].map(c => (
                <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: T.amber, background: T.amber + '20', padding: '1px 5px', borderRadius: 2, ...mono }}>{c.code}</span>
                  <span style={{ fontSize: 9, color: T.secondary, width: 120, flexShrink: 0 }}>{c.label}:</span>
                  <span style={{ fontSize: 9, color: T.text }}>{c.threshold}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Motivated sellers alert */}
          <div style={{ background: T.red + '08', border: `1px solid ${T.red}30`, borderRadius: 2, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.red, ...mono }}>MOTIVATED SELLERS: </span>
              <span style={{ fontSize: 10, color: T.secondary }}>142 properties flagged · All three criteria met: 38 properties</span>
            </div>
            <button
              onClick={() => setShowMotivated(!showMotivated)}
              style={{ fontSize: 9, fontWeight: 700, color: T.red, background: T.red + '20', border: `1px solid ${T.red}40`, borderRadius: 2, padding: '3px 10px', cursor: 'pointer', ...mono }}
            >
              {showMotivated ? 'HIDE' : 'VIEW'} TARGET LIST →
            </button>
          </div>

          {showMotivated && (
            <div style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '8px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 1.5, ...mono, marginBottom: 8 }}>TOP 5 MOTIVATED SELLER TARGETS</div>
              {[
                { name: 'Peachtree Commons (248u)',  owner: 'Greystone Capital', hold: '6.2yr', score: 91, submarket: 'Buckhead'    },
                { name: 'East Ponce Flats (184u)',   owner: 'Regional REIT LLC', hold: '5.9yr', score: 88, submarket: 'Decatur'     },
                { name: 'Midtown Lofts (312u)',      owner: 'Private Equity A',  hold: '5.5yr', score: 85, submarket: 'Midtown'     },
                { name: 'Sandy Hills Apts (140u)',   owner: 'Family Office',     hold: '7.1yr', score: 83, submarket: 'Sandy Springs'},
                { name: 'Boulevard Commons (220u)',  owner: 'CMBS Special Svc',  hold: '6.8yr', score: 79, submarket: 'East Atlanta' },
              ].map((prop, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.text, ...mono }}>{prop.name}</span>
                    <span style={{ fontSize: 9, color: T.secondary, marginLeft: 8 }}>{prop.owner}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: T.amber, ...mono }}>{prop.hold}</span>
                    <span style={{ fontSize: 9, color: T.muted, ...mono }}>{prop.submarket}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: T.red, background: T.red + '20', padding: '1px 6px', borderRadius: 2, ...mono }}>Score: {prop.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 4: BUY-SIDE SIGNAL SUMMARY ── */}
      <div style={card}>
        <div style={hdr(T.green)}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: 2, ...mono }}>BUY-SIDE SIGNAL SUMMARY</span>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>OWNERSHIP INTELLIGENCE · {summary?.market?.display_name || marketId?.toUpperCase()}</span>
        </div>
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Total Tracked Properties', val: '680',     sub: 'Across all owners',            color: T.text   },
            { label: 'Motivated Seller Count',   val: '142',     sub: '20.9% of tracked portfolio',   color: T.amber  },
            { label: 'Buy Signal Owners',        val: '3 of 6',  sub: 'BUY rating from JEDI model',   color: T.green  },
            { label: 'Avg Hold Period (Market)', val: '4.8yr',   sub: 'Weighted by unit count',       color: T.text   },
            { label: 'High Conviction Targets',  val: '38',      sub: 'All 3 criteria met',           color: T.red    },
            { label: 'Off-Market Pipeline',      val: '~22',     sub: 'Estimated by AI outreach',     color: T.cyan   },
          ].map(item => (
            <div key={item.label} style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: T.secondary, ...mono, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color, ...mono }}>{item.val}</div>
              <div style={{ fontSize: 8, color: T.muted, marginTop: 3 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default OwnersTab;
