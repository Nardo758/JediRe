import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Cell, ReferenceLine, ReferenceArea, ComposedChart,
} from 'recharts';

const C = {
  bg: '#080b12', surface: '#0f1320', surfaceRaised: '#151a2e', surfaceLit: '#1c2340',
  border: '#1a2038', borderLit: '#2a3358',
  text: '#e8ecf4', textSoft: '#8b95b0', textDim: '#5a6480',
  accent: '#4c6ef5', accentGlow: 'rgba(76,110,245,0.12)',
  go: '#12b886', goGlow: 'rgba(18,184,134,0.10)',
  warn: '#fab005', warnDim: '#e67700', warnGlow: 'rgba(250,176,5,0.10)',
  danger: '#fa5252', dangerGlow: 'rgba(250,82,82,0.10)',
  purple: '#9775fa',
};
const font = { mono: "'JetBrains Mono', monospace", sans: "'Inter', sans-serif" };

const Pill = ({ children, color, bg }) => (
  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.4, padding: '3px 10px', borderRadius: 4, background: bg, color, border: `1px solid ${color}33`, fontFamily: font.mono, display: 'inline-block' }}>{children}</span>
);
const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 16, fontFamily: font.sans }}>{children}</div>
);
const Card = ({ children, style, glow, hoverable }) => {
  const [h, setH] = useState(false);
  return (<div style={{ background: C.surface, border: `1px solid ${h && hoverable ? C.borderLit : C.border}`, borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden', transition: 'border-color 0.25s', boxShadow: glow ? `0 0 40px ${glow}` : 'none', ...style }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>{children}</div>);
};
const StatBlock = ({ label, value, sub, color = C.text, small }) => (
  <div>
    <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontFamily: font.sans }}>{label}</div>
    <div style={{ fontSize: small ? 18 : 24, fontWeight: 800, color, fontFamily: font.mono, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{sub}</div>}
  </div>
);
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (<div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: font.mono }}>
    <div style={{ color: C.textDim, marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => (<div key={i} style={{ color: p.color || C.text }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</div>))}
  </div>);
};

const RSSGauge = ({ score, size = 180 }) => {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(score), 200); return () => clearTimeout(t); }, [score]);
  const r = (size / 2) - 14, circ = r * 2 * Math.PI, af = 270 / 360;
  const tOff = circ - af * circ, vOff = circ - (anim / 100) * af * circ;
  const color = anim >= 85 ? C.go : anim >= 70 ? C.warn : anim >= 50 ? C.accent : C.danger;
  const lbl = anim >= 85 ? 'STRONG SELL' : anim >= 70 ? 'PREPARE' : anim >= 50 ? 'WATCH' : 'HOLD';
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs><filter id="gg"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={8} strokeDasharray={circ} strokeDashoffset={tOff} strokeLinecap="round" transform={`rotate(135,${cx},${cy})`}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeDasharray={circ} strokeDashoffset={vOff} strokeLinecap="round" transform={`rotate(135,${cx},${cy})`} filter="url(#gg)" style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}/>
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="800" fontFamily={font.mono}>{Math.round(anim)}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill={C.textDim} fontSize={9} fontFamily={font.mono} letterSpacing="2">{lbl}</text>
    </svg>
  );
};
const ScoreBar = ({ label, score, weight, color, delay = 0 }) => {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(score), 300 + delay); return () => clearTimeout(t); }, [score, delay]);
  return (<div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: C.textSoft }}>{label} <span style={{ color: C.textDim, fontSize: 9 }}>{weight}%</span></span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: font.mono }}>{Math.round(w)}</span>
    </div>
    <div style={{ height: 5, borderRadius: 3, background: C.border }}>
      <div style={{ height: '100%', borderRadius: 3, width: `${w}%`, background: `linear-gradient(90deg, ${color}55, ${color})`, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }}/>
    </div>
  </div>);
};
const YearSelector = ({ years, selected, onChange, optimal }) => (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {years.map(y => (<button key={y} onClick={() => onChange(y)} style={{ width: 44, height: 36, borderRadius: 6, position: 'relative', border: `1px solid ${y === selected ? C.accent : y === optimal ? C.go + '55' : C.border}`, background: y === selected ? C.accent + '22' : y === optimal ? C.goGlow : 'transparent', color: y === selected ? C.accent : y === optimal ? C.go : C.textDim, fontSize: 12, fontWeight: 700, fontFamily: font.mono, cursor: 'pointer' }}>
      Y{y}{y === optimal && <div style={{ position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)', fontSize: 7, color: C.go, fontWeight: 700, letterSpacing: 1 }}>BEST</div>}
    </button>))}
  </div>
);
const SignalRow = ({ metric, value, detail, color, bgColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: bgColor, border: `1px solid ${color}12` }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}66` }}/>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{metric}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: font.mono }}>{value}</span>
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{detail}</div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// EXIT WINDOW TIMELINE — Hero visualization
// Quarterly RSS over 10 years with window zones + event markers
// ═══════════════════════════════════════════════════════════════
const ExitWindowTimeline = ({ quarterlyData, events, selectedYear, onSelectYear }) => {
  const [hoveredQ, setHoveredQ] = useState(null);

  // Custom tooltip for the timeline
  const TimelineTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const zone = d.rss >= 85 ? 'SELL' : d.rss >= 70 ? 'PREPARE' : d.rss >= 50 ? 'WATCH' : 'HOLD';
    const zoneColor = d.rss >= 85 ? C.go : d.rss >= 70 ? C.warn : d.rss >= 50 ? C.accent : C.danger;
    const evt = events.find(e => e.quarter === d.q);
    return (<div style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 11, fontFamily: font.mono, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: C.textSoft, fontFamily: font.sans, fontWeight: 600 }}>{d.label}</span>
        <span style={{ color: zoneColor, fontWeight: 800, fontSize: 10, letterSpacing: 1 }}>{zone}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: zoneColor, marginBottom: 6 }}>{d.rss}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
        <div><span style={{ color: C.textDim }}>IRR: </span><span style={{ color: C.text }}>{d.irr}%</span></div>
        <div><span style={{ color: C.textDim }}>Mult: </span><span style={{ color: C.text }}>{d.multiple}x</span></div>
        <div><span style={{ color: C.textDim }}>Cap: </span><span style={{ color: C.text }}>{d.capRate}%</span></div>
        <div><span style={{ color: C.textDim }}>Supply: </span><span style={{ color: d.supply > 40 ? C.danger : C.text }}>{d.supply}%</span></div>
      </div>
      {evt && <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 5, background: `${evt.color}15`, border: `1px solid ${evt.color}22`, fontSize: 10, color: evt.color }}>{evt.icon} {evt.text}</div>}
    </div>);
  };

  return (
    <div>
      {/* Window Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, justifyContent: 'flex-end' }}>
        {[
          { color: C.go, label: 'SELL (85+)', bg: 'rgba(18,184,134,0.15)' },
          { color: C.warn, label: 'PREPARE (70-84)', bg: 'rgba(250,176,5,0.10)' },
          { color: C.accent, label: 'WATCH (50-69)', bg: 'rgba(76,110,245,0.08)' },
          { color: C.danger, label: 'HOLD (<50)', bg: 'rgba(250,82,82,0.08)' },
        ].map((z, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 8, borderRadius: 2, background: z.bg, border: `1px solid ${z.color}44` }} />
            <span style={{ fontSize: 9, color: C.textDim, letterSpacing: 0.5 }}>{z.label}</span>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={quarterlyData} margin={{ top: 10, right: 20, left: -10, bottom: 40 }}>
          <defs>
            <linearGradient id="rssAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.20} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="supplyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.danger} stopOpacity={0.15} />
              <stop offset="100%" stopColor={C.danger} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />

          {/* Background zones */}
          <ReferenceArea y1={85} y2={100} fill={C.go} fillOpacity={0.06} />
          <ReferenceArea y1={70} y2={85} fill={C.warn} fillOpacity={0.04} />
          <ReferenceArea y1={50} y2={70} fill={C.accent} fillOpacity={0.02} />
          <ReferenceArea y1={0} y2={50} fill={C.danger} fillOpacity={0.02} />

          {/* Zone threshold lines */}
          <ReferenceLine y={85} stroke={C.go} strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={70} stroke={C.warn} strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={50} stroke={C.accent} strokeDasharray="6 6" strokeWidth={0.5} />

          {/* Year grid lines */}
          {[4, 8, 12, 16, 20, 24, 28, 32, 36].map(q => (
            <ReferenceLine key={`yr-${q}`} x={q} stroke={C.border} strokeWidth={1} />
          ))}

          {/* Selected year highlight */}
          <ReferenceArea
            x1={(selectedYear - 1) * 4}
            x2={selectedYear * 4}
            fill={C.accent}
            fillOpacity={0.06}
          />

          <XAxis
            dataKey="q"
            tick={({ x, y, payload }) => {
              const q = payload.value;
              if (q % 4 !== 0) return null;
              const yr = q / 4;
              return (
                <g>
                  <text x={x} y={y + 14} textAnchor="middle" fill={yr === selectedYear ? C.accent : C.textDim} fontSize={11} fontWeight={yr === selectedYear ? 700 : 400} fontFamily={font.mono}>
                    Y{yr}
                  </text>
                </g>
              );
            }}
            axisLine={{ stroke: C.border }}
            tickLine={false}
            interval={0}
          />
          <YAxis domain={[20, 100]} tick={{ fill: C.textDim, fontSize: 10 }} axisLine={{ stroke: C.border }} />
          <Tooltip content={<TimelineTooltip />} />

          {/* Supply pressure area (inverted — higher = worse) */}
          <Area type="monotone" dataKey="supply" stroke="none" fill="url(#supplyGrad)" name="Supply %" />

          {/* RSS trajectory */}
          <Area type="monotone" dataKey="rss" stroke={C.accent} strokeWidth={2.5} fill="url(#rssAreaGrad)" dot={false} activeDot={{ fill: C.accent, r: 5, stroke: C.surface, strokeWidth: 2 }} name="RSS Score" />

          {/* IRR line */}
          <Line type="monotone" dataKey="irr" stroke={C.go} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="IRR %" yAxisId="right" />
          <YAxis yAxisId="right" orientation="right" domain={[0, 50]} tick={{ fill: C.textDim, fontSize: 10 }} axisLine={{ stroke: C.border }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Event markers bar below chart */}
      <div style={{ position: 'relative', height: 56, marginTop: -4, marginLeft: 40, marginRight: 20, overflow: 'visible' }}>
        {events.map((evt, i) => {
          const pct = (evt.quarter / 40) * 100;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default',
            }}>
              <div style={{ width: 1, height: 10, background: evt.color + '66' }} />
              <div style={{
                fontSize: 8, fontWeight: 700, color: evt.color, whiteSpace: 'nowrap',
                padding: '2px 6px', borderRadius: 4, background: `${evt.color}11`,
                border: `1px solid ${evt.color}22`, marginTop: 2, letterSpacing: 0.3,
                maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {evt.icon} {evt.short}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export default function RateStrategyEngine() {
  const [mode, setMode] = useState('projection');
  const [projTab, setProjTab] = useState('model');
  const [monTab, setMonTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(5);
  const property = { name: 'Park Vista Apartments', address: '2400 S Dale Mabry Hwy, Tampa, FL', units: 200, type: 'Value-Add Multifamily' };

  // ── Annual projection model ───────────────────────
  const projectionModel = useMemo(() => {
    const yrs = [];
    const bNOI = 1920000, rg = [0,8.5,6.2,4.8,3.5,3,2.8,2.5,2.5,2.5,2.5], cr = [0,4.85,4.9,5.05,5.15,5.25,5.35,5.4,5.45,5.5,5.55], sp = [0,15,25,45,60,55,40,30,25,20,18], va = [0,.65,.9,1,1,1,1,1,1,1,1], eq = 8e6, ln = 192e5;
    let cD = 0;
    for (let y = 1; y <= 10; y++) {
      const gm = rg.slice(1, y+1).reduce((a,b) => a*(1+b/100), 1);
      const noi = bNOI * gm + va[y]*285*140*12, gross = noi/(cr[y]/100), net = gross*.97 - ln;
      cD += Math.max(0, noi - ln*.0425);
      const mult = Math.round(((net+cD)/eq)*100)/100, irr = Math.round((Math.pow(Math.max(.1,mult),1/y)-1)*1000)/10;
      const mw = Math.max(30,90-y*4-sp[y]*.3), re = y<=3?68:y<=6?62:55, spos = Math.max(30,85-sp[y]), or2 = va[y]>=.95?88:va[y]>=.8?72:55, bp = Math.max(40,85-y*3);
      const rss = Math.round(mw*.35+re*.25+spos*.2+or2*.15+bp*.05);
      yrs.push({ year: y, label: `Y${y}`, noi: Math.round(noi), grossValue: Math.round(gross), netProceeds: Math.round(net), irr, multiple: mult, capRate: cr[y], supplyPressure: sp[y], rss, marketWindow: Math.round(mw), rateEnv: re, supplyPos: Math.round(spos), opReady: or2, buyerPressure: Math.round(bp), rentGrowth: rg[y], valueAddComplete: Math.round(va[y]*100) });
    }
    return yrs;
  }, []);
  const optimalYear = useMemo(() => projectionModel.reduce((b,y) => y.rss > b.rss ? y : b, projectionModel[0]).year, [projectionModel]);
  const sel = projectionModel[selectedYear - 1];

  // ── Quarterly data for exit window timeline (40 quarters) ──
  const quarterlyData = useMemo(() => {
    const quarters = [];
    const qLabels = ['Q1','Q2','Q3','Q4'];
    for (let y = 1; y <= 10; y++) {
      const yd = projectionModel[y - 1];
      const prevRss = y > 1 ? projectionModel[y - 2].rss : 35;
      const prevIrr = y > 1 ? projectionModel[y - 2].irr : 0;
      const prevMult = y > 1 ? projectionModel[y - 2].multiple : 1;
      const prevCap = y > 1 ? projectionModel[y - 2].capRate : 5.0;
      const prevSupply = y > 1 ? projectionModel[y - 2].supplyPressure : 10;
      for (let q = 0; q < 4; q++) {
        const frac = (q + 1) / 4;
        const rss = Math.round(prevRss + (yd.rss - prevRss) * frac);
        const irr = Math.round((prevIrr + (yd.irr - prevIrr) * frac) * 10) / 10;
        const multiple = Math.round((prevMult + (yd.multiple - prevMult) * frac) * 100) / 100;
        const capRate = Math.round((prevCap + (yd.capRate - prevCap) * frac) * 100) / 100;
        const supply = Math.round(prevSupply + (yd.supplyPressure - prevSupply) * frac);
        quarters.push({
          q: (y - 1) * 4 + q + 1,
          label: `Y${y} ${qLabels[q]}`,
          year: y,
          rss, irr, multiple, capRate, supply,
        });
      }
    }
    return quarters;
  }, [projectionModel]);

  // ── Events on the timeline ──────────────────────
  const timelineEvents = useMemo(() => [
    { quarter: 2, icon: '\u{1F527}', short: 'Reno starts', text: 'Value-add renovation begins — 285 units', color: C.accent },
    { quarter: 4, icon: '\u{2705}', short: '65% reno', text: 'Renovation 65% complete', color: C.go },
    { quarter: 6, icon: '\u{1F4B0}', short: 'Prepay drops', text: 'Prepayment penalty drops from 3% to 2%', color: C.warn },
    { quarter: 8, icon: '\u{2705}', short: '90% reno', text: 'Renovation 90% complete — near stabilization', color: C.go },
    { quarter: 10, icon: '\u{1F3E2}', short: '200u delivered', text: 'Competitor: 200-unit Class A delivers', color: C.danger },
    { quarter: 12, icon: '\u{2B50}', short: 'Stabilized', text: 'Property stabilized — institutional ready', color: C.go },
    { quarter: 14, icon: '\u{1F4B0}', short: 'Prepay 1%', text: 'Prepayment penalty drops to 1%', color: C.go },
    { quarter: 16, icon: '\u{26A0}', short: 'Supply peak', text: 'Peak supply pressure — 1,240 units in pipeline', color: C.danger },
    { quarter: 18, icon: '\u{1F3E2}', short: '350u comp', text: 'Major competitor: 350 units delivers 1.2mi away', color: C.danger },
    { quarter: 22, icon: '\u{1F4C9}', short: 'Supply eases', text: 'Supply wave absorbed — pressure declining', color: C.go },
    { quarter: 28, icon: '\u{1F512}', short: 'Debt matures', text: 'Original loan maturity — refi required', color: C.warn },
    { quarter: 36, icon: '\u{1F4CA}', short: 'Cycle mature', text: 'Market entering mature cycle phase', color: C.textDim },
  ], []);

  // ── Monitoring data ────────────────────────────
  const mon = {
    current: { rss: 78 }, drift: { irrD: 5.9, multD: 0.90 },
    rssHistory: [{month:'Apr 25',rss:52,projected:55},{month:'Jun 25',rss:58,projected:58},{month:'Aug 25',rss:63,projected:61},{month:'Oct 25',rss:67,projected:63},{month:'Dec 25',rss:71,projected:65},{month:'Feb 26',rss:76,projected:67},{month:'Mar 26',rss:78,projected:68}],
    actuals: [{period:'Y1',projNOI:1920,actNOI:1985,projOcc:88,actOcc:89.5},{period:'Y2',projNOI:2180,actNOI:2340,projOcc:91,actOcc:92.8},{period:'Y3',projNOI:2380,actNOI:2520,projOcc:93,actOcc:93.2},{period:'Y4',projNOI:2540,actNOI:2690,projOcc:93.5,actOcc:93.8},{period:'Y5',projNOI:2680,actNOI:2840,projOcc:93.5,actOcc:94.2}],
    alerts: [{date:'Feb 28',sev:'warn',msg:'Rent growth decel \u2014 3mo at 4.1% vs 8.7% trailing 12mo'},{date:'Feb 15',sev:'go',msg:'Transaction velocity +46.9% QoQ'},{date:'Jan 30',sev:'warn',msg:'350-unit comp confirmed Q3 2026'},{date:'Jan 10',sev:'go',msg:'RSS crossed 75 \u2014 PREPARE zone'},{date:'Dec 15',sev:'info',msg:'Prepay drops to 1% June 2026'}],
    signals: {
      go: [{metric:'Txn Velocity',value:'+46.9%',detail:'47 sales / 90d'},{metric:'DOM',value:'28 days',detail:'Down from 51'},{metric:'Stabilized',value:'14 mo',detail:'Inst. ready'},{metric:'Rank',value:'#8/52',detail:'Top 15%'},{metric:'NOI Beat',value:'+5.9%',detail:'$2.84M vs $2.68M'}],
      watch: [{metric:'Rent Growth',value:'4.1%',detail:'Peak 10.2%'},{metric:'Supply',value:'1,240',detail:'+19.3% 24mo'},{metric:'Prepay',value:'$345K',detail:'Drops June'},{metric:'Comp',value:'Q3 2026',detail:'350u, 1.2mi'}],
      concern: [{metric:'Refi',value:'5.85%',detail:'+160bps'},{metric:'Cap Spread',value:'77bps',detail:'Avg 185'}],
    },
    scenarios: [{name:'Sell Now',timing:'Q2 2026',irr:28.4,multiple:4.30,cap:4.85,risk:'Prepay $345K',rec:true},{name:'Optimal',timing:'Q4 2026',irr:26.1,multiple:4.12,cap:4.95,risk:'Supply nearing',rec:false},{name:'Hold',timing:'Q1 2028',irr:21.2,multiple:3.52,cap:5.35,risk:'Refi+supply',rec:false}],
  };
  const g = (cols, gap=16) => ({ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap });

  // ── Determine windows from quarterly data ──────
  const windows = useMemo(() => {
    const w = [];
    let current = null;
    quarterlyData.forEach(d => {
      const zone = d.rss >= 85 ? 'sell' : d.rss >= 70 ? 'prepare' : null;
      if (zone && (!current || current.zone !== zone)) {
        if (current) w.push(current);
        current = { zone, start: d.q, end: d.q, startLabel: d.label, endLabel: d.label };
      } else if (zone && current) {
        current.end = d.q;
        current.endLabel = d.label;
      } else if (!zone && current) {
        w.push(current);
        current = null;
      }
    });
    if (current) w.push(current);
    return w;
  }, [quarterlyData]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: font.sans }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 28px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
              <span style={{ fontSize:9, fontWeight:700, color:C.accent, letterSpacing:2, fontFamily:font.mono }}>JEDI RE</span>
              <span style={{ color:C.textDim, fontSize:10 }}>{'\u203A'}</span>
              <span style={{ fontSize:9, color:C.textDim, letterSpacing:1.5 }}>RATE STRATEGY ENGINE</span>
            </div>
            <div style={{ fontSize:20, fontWeight:800 }}>{property.name}</div>
            <div style={{ display:'flex', gap:16, marginTop:3 }}>{[property.address,`${property.units} units`,property.type].map((t,i) => <span key={i} style={{ fontSize:10, color:C.textDim }}>{t}</span>)}</div>
          </div>
          <div style={{ display:'flex', background:C.surfaceRaised, borderRadius:8, border:`1px solid ${C.border}`, padding:3 }}>
            {[{key:'projection',label:'PROJECTION',sub:'Pre-Acquisition'},{key:'monitoring',label:'MONITORING',sub:'Post-Close'}].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} style={{ padding:'8px 20px', borderRadius:6, border:'none', cursor:'pointer', background: mode===m.key ? C.accent : 'transparent' }}>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:1.5, color: mode===m.key ? '#fff' : C.textDim, fontFamily:font.mono }}>{m.label}</div>
                <div style={{ fontSize:8, color: mode===m.key ? 'rgba(255,255,255,0.6)' : C.textDim, marginTop:1 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* TABS */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 28px' }}>
        <div style={{ maxWidth:1520, margin:'0 auto', display:'flex', gap:3, padding:'6px 0' }}>
          {(mode==='projection' ? [{key:'model',label:'Exit Model'},{key:'yearDetail',label:'Year Analysis'},{key:'sensitivity',label:'Sensitivity'}] : [{key:'dashboard',label:'Dashboard'},{key:'drift',label:'Plan vs Actuals'},{key:'signals',label:'Signals'},{key:'scenarios',label:'Scenarios'}]).map(t => {
            const active = (mode==='projection'?projTab:monTab) === t.key;
            return <button key={t.key} onClick={() => mode==='projection'?setProjTab(t.key):setMonTab(t.key)} style={{ padding:'7px 18px', borderRadius:5, fontSize:11, fontWeight:600, border:'none', cursor:'pointer', background:active?C.accent+'22':'transparent', color:active?C.accent:C.textDim }}>{t.label}</button>;
          })}
        </div>
      </div>

      <div style={{ maxWidth:1520, margin:'0 auto', padding:'20px 28px' }}>

        {/* ═════════════════════════════════════════════════
            PROJECTION — EXIT MODEL (with window timeline)
        ═════════════════════════════════════════════════ */}
        {mode==='projection' && projTab==='model' && (<div>

          {/* HERO: Exit Window Timeline */}
          <Card style={{ marginBottom: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <SectionLabel>10-Year Exit Window Map</SectionLabel>
                <div style={{ fontSize: 12, color: C.textSoft, marginTop: -10, marginBottom: 12 }}>
                  RSS trajectory with sell zones, supply pressure, and key events over the full hold horizon
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {windows.map((w, i) => (
                  <div key={i} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: font.mono,
                    background: w.zone === 'sell' ? C.goGlow : C.warnGlow,
                    border: `1px solid ${w.zone === 'sell' ? C.go : C.warn}33`,
                    color: w.zone === 'sell' ? C.go : C.warn,
                    cursor: 'pointer',
                  }} onClick={() => setSelectedYear(Math.ceil(w.start / 4))}>
                    {w.zone === 'sell' ? '\u2B50' : '\u{1F7E1}'} {w.startLabel} {'\u2013'} {w.endLabel}
                  </div>
                ))}
              </div>
            </div>
            <ExitWindowTimeline
              quarterlyData={quarterlyData}
              events={timelineEvents}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
            />
          </Card>

          {/* Year Selector + Gauge + Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, marginBottom: 20 }}>
            <Card style={{ textAlign: 'center' }}>
              <SectionLabel>RSS Year {selectedYear}</SectionLabel>
              <RSSGauge score={sel.rss} size={160}/>
              <div style={{ marginTop: 14, textAlign: 'left' }}>
                <ScoreBar label="Market" score={sel.marketWindow} weight={35} color={C.accent}/>
                <ScoreBar label="Rate Env" score={sel.rateEnv} weight={25} color={C.purple} delay={80}/>
                <ScoreBar label="Supply" score={sel.supplyPos} weight={20} color={C.warn} delay={160}/>
                <ScoreBar label="Op Ready" score={sel.opReady} weight={15} color={C.go} delay={240}/>
                <ScoreBar label="Buyers" score={sel.buyerPressure} weight={5} color="#e64980" delay={320}/>
              </div>
            </Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><SectionLabel>Exit Year</SectionLabel><span style={{ fontSize:10, color:C.go, fontWeight:600 }}>Best: Y{optimalYear}</span></div><YearSelector years={[1,2,3,4,5,6,7,8,9,10]} selected={selectedYear} onChange={setSelectedYear} optimal={optimalYear}/></Card>
              <div style={g(4,12)}>{[{l:'IRR',v:`${sel.irr}%`,c:sel.irr>=20?C.go:sel.irr>=15?C.warn:C.danger},{l:'Multiple',v:`${sel.multiple}x`,c:sel.multiple>=3?C.go:sel.multiple>=2?C.warn:C.danger},{l:'Value',v:`$${(sel.grossValue/1e6).toFixed(1)}M`,c:C.text},{l:'Cap',v:`${sel.capRate}%`,c:C.text}].map((m,i) => <Card key={i} style={{padding:16}}><StatBlock label={m.l} value={m.v} color={m.c} small/></Card>)}</div>
              <div style={g(3,12)}>
                <Card style={{padding:14}}><StatBlock label="Growth" value={`${sel.rentGrowth}%`} sub={`Yr ${selectedYear}`} small color={C.accent}/></Card>
                <Card style={{padding:14}}><StatBlock label="Supply" value={`${sel.supplyPressure}%`} sub="% stock" small color={sel.supplyPressure>40?C.danger:C.warn}/></Card>
                <Card style={{padding:14}}><StatBlock label="Reno" value={`${sel.valueAddComplete}%`} sub="Done" small color={sel.valueAddComplete>=95?C.go:C.warn}/></Card>
              </div>
            </div>
          </div>

          {/* Supporting charts */}
          <div style={g(2,16)}>
            <Card><SectionLabel>Returns by Year</SectionLabel>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={projectionModel} margin={{top:5,right:15,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="label" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis yAxisId="left" domain={[0,50]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis yAxisId="right" orientation="right" domain={[0,6]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar yAxisId="right" dataKey="multiple" name="Multiple" radius={[3,3,0,0]} barSize={24}>{projectionModel.map((d,i) => <Cell key={`c-${i}`} fill={d.year===selectedYear?C.accent:d.year===optimalYear?C.go+'66':C.surfaceLit}/>)}</Bar>
                  <Line yAxisId="left" type="monotone" dataKey="irr" name="IRR%" stroke={C.go} strokeWidth={2.5} dot={{fill:C.go,r:3}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card><SectionLabel>Supply vs Cap Rate</SectionLabel>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={projectionModel} margin={{top:5,right:15,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="label" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis domain={[0,70]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis yAxisId="cap" orientation="right" domain={[4.5,6]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="supplyPressure" name="Supply%" radius={[3,3,0,0]}>{projectionModel.map((d,i) => <Cell key={`s-${i}`} fill={d.supplyPressure>50?C.danger:d.supplyPressure>30?C.warn:C.go}/>)}</Bar>
                  <Line yAxisId="cap" type="monotone" dataKey="capRate" name="Cap%" stroke={C.purple} strokeWidth={2} dot={{fill:C.purple,r:3}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>)}

        {/* PROJECTION — YEAR */}
        {mode==='projection' && projTab==='yearDetail' && (<div>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}><SectionLabel>Year {selectedYear}</SectionLabel><YearSelector years={[1,2,3,4,5,6,7,8,9,10]} selected={selectedYear} onChange={setSelectedYear} optimal={optimalYear}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:20}}>
            <div>
              <Card style={{marginBottom:16}}><SectionLabel>Financials</SectionLabel>
                {[['NOI',`$${(sel.noi/1e6).toFixed(2)}M`],['Cap',`${sel.capRate}%`],['Value',`$${(sel.grossValue/1e6).toFixed(1)}M`],['Net',`$${(sel.netProceeds/1e6).toFixed(1)}M`],['IRR',`${sel.irr}%`],['Mult',`${sel.multiple}x`]].map(([l,v],i) => <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:12,color:C.textSoft}}>{l}</span><span style={{fontSize:14,fontWeight:700,fontFamily:font.mono}}>{v}</span></div>)}
              </Card>
              <Card><SectionLabel>Conditions</SectionLabel><div style={{display:'flex',flexDirection:'column',gap:8}}>
                <SignalRow metric="Growth" value={`${sel.rentGrowth}%`} detail={sel.rentGrowth>5?'Strong':'Moderate'} color={sel.rentGrowth>5?C.go:C.warn} bgColor={sel.rentGrowth>5?C.goGlow:C.warnGlow}/>
                <SignalRow metric="Supply" value={`${sel.supplyPressure}%`} detail={sel.supplyPressure>50?'Heavy':sel.supplyPressure>30?'Building':'OK'} color={sel.supplyPressure>50?C.danger:sel.supplyPressure>30?C.warn:C.go} bgColor={sel.supplyPressure>50?C.dangerGlow:sel.supplyPressure>30?C.warnGlow:C.goGlow}/>
                <SignalRow metric="Reno" value={`${sel.valueAddComplete}%`} detail={sel.valueAddComplete>=95?'Done':'WIP'} color={sel.valueAddComplete>=95?C.go:C.warn} bgColor={sel.valueAddComplete>=95?C.goGlow:C.warnGlow}/>
              </div></Card>
            </div>
            <div>
              <Card style={{marginBottom:16}}><SectionLabel>Profile</SectionLabel>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={[{axis:'Mkt',val:sel.marketWindow},{axis:'Rate',val:sel.rateEnv},{axis:'Supp',val:sel.supplyPos},{axis:'Ready',val:sel.opReady},{axis:'Buy',val:sel.buyerPressure}]}>
                    <PolarGrid stroke={C.border}/><PolarAngleAxis dataKey="axis" tick={{fill:C.textDim,fontSize:9}}/><Radar dataKey="val" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={2} name="Score"/>
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
              <Card><SectionLabel>Verdict</SectionLabel>
                <div style={{padding:16,borderRadius:10,textAlign:'center',background:sel.rss>=85?C.goGlow:sel.rss>=70?C.warnGlow:C.accentGlow,border:`1px solid ${sel.rss>=85?C.go:sel.rss>=70?C.warn:C.accent}22`}}>
                  <div style={{fontSize:36,fontWeight:800,fontFamily:font.mono,color:sel.rss>=85?C.go:sel.rss>=70?C.warn:C.accent}}>{sel.rss}</div>
                  <div style={{fontSize:10,color:C.textDim,marginTop:4,letterSpacing:1.5,fontFamily:font.mono}}>{sel.rss>=85?'STRONG SELL':sel.rss>=70?'PREPARE':sel.rss>=50?'WATCH':'HOLD'}</div>
                  {selectedYear!==optimalYear && <div style={{fontSize:10,color:C.go,marginTop:10}}>Best: Y{optimalYear} ({projectionModel[optimalYear-1].rss})</div>}
                </div>
              </Card>
            </div>
          </div>
        </div>)}

        {/* PROJECTION — SENSITIVITY */}
        {mode==='projection' && projTab==='sensitivity' && (<Card>
          <SectionLabel>IRR Sensitivity {'\u2014'} Year {selectedYear}</SectionLabel>
          <div style={{marginBottom:16}}><YearSelector years={[1,2,3,4,5,6,7,8,9,10]} selected={selectedYear} onChange={setSelectedYear} optimal={optimalYear}/></div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:font.mono}}>
            <thead><tr><th style={{padding:'10px 14px',textAlign:'left',color:C.textDim,fontSize:10,borderBottom:`1px solid ${C.border}`}}>Cap/Growth</th>{[2,3,4,5,6].map(r => <th key={r} style={{padding:'10px 14px',textAlign:'center',color:C.textSoft,fontSize:11,borderBottom:`1px solid ${C.border}`}}>{r}%</th>)}</tr></thead>
            <tbody>{[4.5,4.75,5,5.25,5.5,5.75].map(cap => <tr key={cap}><td style={{padding:'10px 14px',color:C.textSoft,borderBottom:`1px solid ${C.border}`}}>{cap}%</td>{[2,3,4,5,6].map(r2 => {const adj=sel.noi*(1+(r2-sel.rentGrowth)/100),net=(adj/(cap/100))*.97-192e5,m2=net/8e6,ir=Math.round((Math.pow(Math.max(.1,m2),1/selectedYear)-1)*1000)/10,base=Math.abs(cap-sel.capRate)<.1&&Math.abs(r2-sel.rentGrowth)<.5; return <td key={`${cap}-${r2}`} style={{padding:'10px 14px',textAlign:'center',borderBottom:`1px solid ${C.border}`,background:base?C.accent+'15':'transparent',color:ir>=25?C.go:ir>=18?C.warn:ir>=12?C.text:C.danger,fontWeight:base?800:600}}>{ir>0?`${ir}%`:'\u2013'}</td>})}</tr>)}</tbody>
          </table></div>
        </Card>)}

        {/* MONITORING — DASHBOARD */}
        {mode==='monitoring' && monTab==='dashboard' && (<div>
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20,marginBottom:16}}>
            <Card style={{textAlign:'center'}}>
              <SectionLabel>Current RSS</SectionLabel><RSSGauge score={mon.current.rss} size={160}/>
              <div style={{marginTop:14,display:'flex',justifyContent:'center',gap:16}}>
                <div><div style={{fontSize:18,fontWeight:800,color:C.go,fontFamily:font.mono}}>+{mon.drift.irrD}%</div><div style={{fontSize:9,color:C.textDim}}>IRR vs plan</div></div>
                <div style={{width:1,background:C.border}}/>
                <div><div style={{fontSize:18,fontWeight:800,color:C.go,fontFamily:font.mono}}>+{mon.drift.multD}x</div><div style={{fontSize:9,color:C.textDim}}>Mult vs plan</div></div>
              </div>
            </Card>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:`linear-gradient(135deg,${C.warnDim}22,${C.surfaceRaised})`,border:`1px solid ${C.warn}22`,borderRadius:12,padding:'20px 24px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{display:'flex',gap:8,marginBottom:8}}><Pill color={C.warn} bg={C.warnGlow}>PREPARE TO SELL</Pill><Pill color={C.accent} bg={C.accentGlow}>WINDOW: EARLIER</Pill></div>
                    <div style={{fontSize:17,fontWeight:800,marginBottom:4}}>Recommended: Q3-Q4 2026</div>
                    <div style={{fontSize:11,color:C.textSoft,lineHeight:1.6,maxWidth:480}}>Outperforming by 5.9% IRR. Market peaking. Supply wave Q3 2026.</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:9,color:C.textDim,letterSpacing:1.5}}>HOLD</div><div style={{fontSize:28,fontWeight:800,fontFamily:font.mono}}>5y 11m</div><div style={{fontSize:9,color:C.warn,marginTop:2}}>6 MO WINDOW</div></div>
                </div>
              </div>
              <div style={g(4,10)}>{[{l:'IRR',v:'28.4%',s:'Plan: 22.5%',c:C.go},{l:'Mult',v:'4.30x',s:'Plan: 3.40x',c:C.go},{l:'Value',v:'$60.2M',s:'Paid $28.5M',c:C.text},{l:'RSS',v:'+14pts',s:'6 months',c:C.warn}].map((m,i) => <Card key={i} style={{padding:14}}><StatBlock label={m.l} value={m.v} sub={m.s} color={m.c} small/></Card>)}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16,marginBottom:16}}>
            <Card><SectionLabel>RSS Trend</SectionLabel>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={mon.rssHistory} margin={{top:5,right:15,left:-10,bottom:5}}>
                  <defs><linearGradient id="mr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.warn} stopOpacity={0.2}/><stop offset="100%" stopColor={C.warn} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="month" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis domain={[40,100]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/>
                  <Tooltip content={<CustomTooltip/>}/><ReferenceArea y1={85} y2={100} fill={C.go} fillOpacity={0.05}/><ReferenceArea y1={70} y2={85} fill={C.warn} fillOpacity={0.04}/><ReferenceLine y={85} stroke={C.go} strokeDasharray="4 4"/><ReferenceLine y={70} stroke={C.warn} strokeDasharray="4 4"/>
                  <Line type="monotone" dataKey="projected" stroke={C.textDim} strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Plan"/>
                  <Area type="monotone" dataKey="rss" stroke={C.warn} strokeWidth={2.5} fill="url(#mr1)" dot={{fill:C.warn,r:4}} name="Actual"/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card><SectionLabel>Alerts</SectionLabel><div style={{display:'flex',flexDirection:'column',gap:8}}>
              {mon.alerts.map((a,i) => {const col=a.sev==='go'?C.go:a.sev==='warn'?C.warn:C.accent,bg2=a.sev==='go'?C.goGlow:a.sev==='warn'?C.warnGlow:C.accentGlow; return (<div key={i} style={{padding:'10px 12px',borderRadius:8,background:bg2,border:`1px solid ${col}12`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:8,fontWeight:700,color:col,fontFamily:font.mono,letterSpacing:1}}>{a.sev==='go'?'POSITIVE':a.sev==='warn'?'WATCH':'INFO'}</span><span style={{fontSize:9,color:C.textDim,fontFamily:font.mono}}>{a.date}</span></div>
                <div style={{fontSize:10,color:C.textSoft,lineHeight:1.5}}>{a.msg}</div>
              </div>);})}
            </div></Card>
          </div>
          <div style={g(3,16)}>{[{k:'go',t:'Go',c:C.go,b:C.goGlow},{k:'watch',t:'Watch',c:C.warn,b:C.warnGlow},{k:'concern',t:'Concern',c:C.danger,b:C.dangerGlow}].map(grp => (
            <Card key={grp.k} style={{borderColor:`${grp.c}15`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><span style={{fontSize:11,fontWeight:700,color:grp.c}}>{grp.t}</span><span style={{fontSize:14,fontWeight:800,color:grp.c,fontFamily:font.mono,background:grp.b,padding:'2px 10px',borderRadius:5}}>{mon.signals[grp.k].length}</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>{mon.signals[grp.k].map((s,i) => <SignalRow key={i} metric={s.metric} value={s.value} detail={s.detail} color={grp.c} bgColor={grp.b}/>)}</div>
            </Card>
          ))}</div>
        </div>)}

        {/* MONITORING — DRIFT */}
        {mode==='monitoring' && monTab==='drift' && (<div>
          <div style={g(2,16)}>
            <Card><SectionLabel>NOI ($K)</SectionLabel>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mon.actuals} margin={{top:5,right:15,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="period" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="projNOI" name="Projected" fill={C.textDim} fillOpacity={0.3} barSize={18} radius={[3,3,0,0]}/><Bar dataKey="actNOI" name="Actual" fill={C.go} fillOpacity={0.7} barSize={18} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card><SectionLabel>Occupancy (%)</SectionLabel>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={mon.actuals} margin={{top:5,right:15,left:-10,bottom:5}}>
                  <defs><linearGradient id="og1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.go} stopOpacity={0.2}/><stop offset="100%" stopColor={C.go} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="period" tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><YAxis domain={[85,96]} tick={{fill:C.textDim,fontSize:10}} axisLine={{stroke:C.border}}/><Tooltip content={<CustomTooltip/>}/>
                  <Line type="monotone" dataKey="projOcc" name="Projected" stroke={C.textDim} strokeWidth={1.5} strokeDasharray="6 3" dot={{fill:C.textDim,r:3}}/><Area type="monotone" dataKey="actOcc" name="Actual" stroke={C.go} strokeWidth={2.5} fill="url(#og1)" dot={{fill:C.go,r:4}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <div style={{...g(4,12),marginTop:16}}>{[{l:'NOI +',v:'+$160K',s:'$2.84M vs $2.68M',c:C.go},{l:'Occ +',v:'+0.7%',s:'94.2 vs 93.5',c:C.go},{l:'IRR +',v:'+5.9%',s:'28.4 vs 22.5',c:C.go},{l:'Window',v:'EARLIER',s:'Accelerating',c:C.warn}].map((m,i) => <Card key={i} style={{padding:16}}><StatBlock label={m.l} value={m.v} sub={m.s} color={m.c} small/></Card>)}</div>
          <Card style={{marginTop:16}}><SectionLabel>Changes</SectionLabel><div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[{f:'Reno premiums beat plan',i:'+$285/u vs $250',d:'up'},{f:'Rent growth 8.7% vs 6.0%',i:'+$160K NOI',d:'up'},{f:'Cap compression deeper',i:'4.92% vs 5.10%',d:'up'},{f:'Supply accelerated',i:'1,240u vs 800',d:'down'},{f:'Rates elevated',i:'5.85% vs 4.50%',d:'down'}].map((c,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:8,background:c.d==='up'?C.goGlow:C.dangerGlow,border:`1px solid ${c.d==='up'?C.go:C.danger}12`}}>
                <div style={{fontSize:16,color:c.d==='up'?C.go:C.danger,width:20,textAlign:'center'}}>{c.d==='up'?'\u2191':'\u2193'}</div>
                <div><div style={{fontSize:12,fontWeight:600}}>{c.f}</div><div style={{fontSize:10,color:C.textDim,marginTop:2}}>{c.i}</div></div>
              </div>
            ))}
          </div></Card>
        </div>)}

        {/* MONITORING — SIGNALS */}
        {mode==='monitoring' && monTab==='signals' && (<div>
          {['go','watch','concern'].map(key => {const cfg={go:{t:'Go \u2014 Supports Sale',c:C.go,b:C.goGlow},watch:{t:'Watch \u2014 Monitor',c:C.warn,b:C.warnGlow},concern:{t:'Concerns \u2014 Risk',c:C.danger,b:C.dangerGlow}}[key]; return (
            <Card key={key} style={{marginBottom:16,borderColor:`${cfg.c}15`}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}><div style={{width:10,height:10,borderRadius:'50%',background:cfg.c,boxShadow:`0 0 12px ${cfg.c}55`}}/><span style={{fontSize:13,fontWeight:700,color:cfg.c}}>{cfg.t}</span><span style={{marginLeft:'auto',fontSize:13,fontWeight:800,fontFamily:font.mono,color:cfg.c,background:cfg.b,padding:'2px 12px',borderRadius:5}}>{mon.signals[key].length}</span></div>
              <div style={{display:'grid',gridTemplateColumns:mon.signals[key].length<=2?'1fr 1fr':'1fr 1fr 1fr',gap:10}}>{mon.signals[key].map((s,i) => <SignalRow key={i} metric={s.metric} value={s.value} detail={s.detail} color={cfg.c} bgColor={cfg.b}/>)}</div>
            </Card>
          );})}
        </div>)}

        {/* MONITORING — SCENARIOS */}
        {mode==='monitoring' && monTab==='scenarios' && (<div style={g(3,16)}>
          {mon.scenarios.map((sc,i) => (
            <Card key={i} hoverable glow={sc.rec?`${C.go}15`:undefined} style={{borderColor:sc.rec?`${C.go}44`:C.border}}>
              {sc.rec && <div style={{position:'absolute',top:0,left:20,right:20,height:3,borderRadius:'0 0 3px 3px',background:`linear-gradient(90deg,transparent,${C.go},transparent)`}}/>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div><div style={{fontSize:15,fontWeight:800}}>{sc.name}</div><div style={{fontSize:10,color:C.textDim,marginTop:2}}>{sc.timing}</div></div>
                {sc.rec && <Pill color={C.go} bg={C.goGlow}>REC</Pill>}
              </div>
              <div style={g(2,12)}>
                <div style={{textAlign:'center',padding:14,borderRadius:8,background:C.surfaceRaised}}><div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,marginBottom:4}}>IRR</div><div style={{fontSize:28,fontWeight:800,fontFamily:font.mono,color:sc.irr>=25?C.go:sc.irr>=20?C.warn:C.danger}}>{sc.irr}%</div></div>
                <div style={{textAlign:'center',padding:14,borderRadius:8,background:C.surfaceRaised}}><div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,marginBottom:4}}>MULT</div><div style={{fontSize:28,fontWeight:800,fontFamily:font.mono,color:sc.multiple>=4?C.go:sc.multiple>=3?C.warn:C.danger}}>{sc.multiple}x</div></div>
              </div>
              <div style={{marginTop:14,padding:12,borderRadius:8,background:C.surfaceRaised,display:'flex',justifyContent:'space-between'}}>
                <div><div style={{fontSize:9,color:C.textDim}}>CAP</div><div style={{fontSize:14,fontWeight:700,fontFamily:font.mono,marginTop:2}}>{sc.cap}%</div></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.textDim}}>RISK</div><div style={{fontSize:11,color:C.warn,marginTop:2}}>{sc.risk}</div></div>
              </div>
            </Card>
          ))}
        </div>)}

      </div>
    </div>
  );
}
