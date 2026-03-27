import { useState } from 'react';

const TABS = [
  { key: 'demand', label: 'DEMAND', color: '#14b8a6' },
  { key: 'supply', label: 'SUPPLY', color: '#22c55e' },
  { key: 'momentum', label: 'MOMENTUM', color: '#f59e0b' },
  { key: 'traffic', label: 'TRAFFIC', color: '#8b5cf6' },
  { key: 'position', label: 'POSITION', color: '#ec4899' },
  { key: 'risk', label: 'RISK', color: '#ef4444' },
] as const;

type TabKey = typeof TABS[number]['key'];

const CHART_DATA: Record<TabKey, { title: string; unit: string; labels: string[]; series: { name: string; data: number[]; color: string }[] }> = {
  demand: {
    title: 'Demand Signals — Atlanta MSA',
    unit: '%',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Pop Growth', data: [1.2, 1.3, 1.4, 1.4, 1.5, 1.6, 1.7, 1.7, 1.8], color: '#14b8a6' },
      { name: 'Emp Growth', data: [1.8, 1.9, 2.0, 2.0, 2.1, 2.2, 2.3, 2.3, 2.4], color: '#22c55e' },
      { name: 'Income Growth', data: [2.8, 2.9, 3.0, 3.0, 3.1, 3.1, 3.1, 3.2, 3.2], color: '#f59e0b' },
    ],
  },
  supply: {
    title: 'Supply Pipeline — Atlanta MSA',
    unit: 'K units',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Pipeline', data: [12.0, 13.5, 14.2, 15.1, 16.0, 16.8, 17.4, 18.0, 18.4], color: '#ef4444' },
      { name: 'Absorption', data: [82, 83, 84, 85, 85, 86, 87, 87, 88], color: '#22c55e' },
      { name: 'Occupancy', data: [95.8, 95.4, 95.2, 95.0, 94.8, 94.6, 94.4, 94.3, 94.2], color: '#14b8a6' },
    ],
  },
  momentum: {
    title: 'Momentum Indicators — Atlanta MSA',
    unit: '%',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Rent Growth', data: [2.1, 2.5, 2.8, 3.0, 3.2, 3.5, 3.7, 3.9, 4.1], color: '#14b8a6' },
      { name: 'NOI Growth', data: [2.4, 2.6, 2.8, 3.0, 3.1, 3.3, 3.5, 3.6, 3.8], color: '#22c55e' },
      { name: 'Cap Rate', data: [5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.3, 5.2, 5.2], color: '#f59e0b' },
    ],
  },
  traffic: {
    title: 'Traffic & Engagement — Atlanta MSA',
    unit: 'idx',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Traffic Index', data: [58, 60, 62, 64, 66, 68, 70, 72, 74], color: '#8b5cf6' },
      { name: 'Search Volume', data: [44, 48, 51, 54, 56, 58, 60, 61, 62], color: '#14b8a6' },
    ],
  },
  position: {
    title: 'Positional Metrics — Atlanta MSA',
    unit: '',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Walk Score', data: [55, 56, 57, 58, 59, 59, 60, 61, 62], color: '#ec4899' },
      { name: 'Dev Capacity', data: [0.40, 0.39, 0.38, 0.37, 0.36, 0.36, 0.35, 0.35, 0.34], color: '#f59e0b' },
    ],
  },
  risk: {
    title: 'Risk Factors — Atlanta MSA',
    unit: '%',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Permit Chg', data: [-2, -3, -4, -5, -6, -8, -9, -10, -12], color: '#ef4444' },
      { name: 'Zoning Util', data: [72, 73, 74, 74, 75, 76, 76, 77, 78], color: '#f59e0b' },
    ],
  },
};

const TABLE_DATA: Record<TabKey, { sig: string; name: string; val: string; chg: string; w: string; pts: string; gate: 'pass' | 'soft-fail' | 'fail'; live?: boolean }[]> = {
  demand: [
    { sig: 'D-12', name: 'Population Growth', val: '6.2M', chg: '+1.8%', w: '8%', pts: '+8', gate: 'pass' },
    { sig: 'D-01', name: 'Employment Growth', val: '+2.4%', chg: '+0.3%', w: '12%', pts: '+12', gate: 'pass' },
    { sig: 'D-03', name: 'Job-Housing Ratio', val: '1.24', chg: '+0.06', w: '6%', pts: '+6', gate: 'pass' },
    { sig: 'D-05', name: 'Median Income', val: '$72.4K', chg: '+3.2%', w: '5%', pts: '+5', gate: 'pass' },
  ],
  supply: [
    { sig: 'S-01', name: 'Pipeline Units', val: '18,400', chg: '+22%', w: '6%', pts: '-3', gate: 'soft-fail' },
    { sig: 'S-03', name: 'Occupancy Rate', val: '94.2%', chg: '-0.3%', w: '8%', pts: '+6', gate: 'pass' },
    { sig: 'S-05', name: 'Absorption Rate', val: '88%', chg: '+2.1%', w: '7%', pts: '+7', gate: 'pass' },
    { sig: 'S-06', name: 'Permit Momentum', val: '-12%', chg: '-8%', w: '4%', pts: '+4', gate: 'pass' },
  ],
  momentum: [
    { sig: 'M-01', name: 'Rent Growth', val: '+4.1%', chg: '+0.9%', w: '10%', pts: '+9', gate: 'pass', live: true },
    { sig: 'M-03', name: 'NOI Growth', val: '+3.8%', chg: '+0.4%', w: '6%', pts: '+6', gate: 'pass' },
    { sig: 'M-04', name: 'Cap Rate', val: '5.2%', chg: '-0.3%', w: '5%', pts: '+5', gate: 'pass' },
    { sig: 'M-05', name: 'Avg Rent', val: '$1,487', chg: '+4.8%', w: '4%', pts: '+4', gate: 'pass', live: true },
  ],
  traffic: [
    { sig: 'T-01', name: 'Traffic Index', val: '74', chg: '+6.2%', w: '5%', pts: '+4', gate: 'pass' },
    { sig: 'T-03', name: 'Traffic Growth', val: '+6.2%', chg: '+1.1%', w: '4%', pts: '+4', gate: 'pass' },
  ],
  position: [
    { sig: 'P-05', name: 'Walk Score', val: '62', chg: '+3', w: '3%', pts: '+2', gate: 'soft-fail' },
    { sig: 'DC-01', name: 'Dev Capacity Ratio', val: '0.34', chg: '-0.02', w: '3%', pts: '+3', gate: 'pass' },
    { sig: 'DC-05', name: 'Zoning Utilization', val: '78%', chg: '+2%', w: '3%', pts: '+3', gate: 'pass' },
  ],
  risk: [
    { sig: 'R-01', name: 'Insurance Cost Δ', val: '+8.2%', chg: '+2.1%', w: '3%', pts: '-2', gate: 'soft-fail' },
    { sig: 'R-02', name: 'Tax Assessment Δ', val: '+4.1%', chg: '+0.8%', w: '2%', pts: '+2', gate: 'pass' },
    { sig: 'R-03', name: 'Flood Zone Pct', val: '3.2%', chg: '-0.1%', w: '2%', pts: '+2', gate: 'pass' },
  ],
};

export function MetricsEnhanced() {
  const [activeTab, setActiveTab] = useState<TabKey>('demand');
  const chart = CHART_DATA[activeTab];
  const rows = TABLE_DATA[activeTab];
  const tabColor = TABS.find(t => t.key === activeTab)?.color || '#14b8a6';

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e2e8f0] font-mono text-[13px]">
      {/* HEADER */}
      <div className="bg-[#111827] border-b border-[#1e293b] px-4 py-2 flex justify-between items-center">
        <span className="text-[#f59e0b] text-[11px] uppercase tracking-widest font-bold">Strategy Metrics Integration — MSA → Submarket → Property</span>
        <span className="text-[10px] text-[#94a3b8]">Strategy: <span className="text-[#f59e0b]">Core Plus Value-Add</span> | D:30% S:25% M:20% P:15% R:10%</span>
      </div>

      {/* ======= MSA LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[15px] font-bold">MSA: ATLANTA, GA</span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse inline-block"></span> LIVE</span>
          <span className="ml-auto px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] text-[11px] rounded font-bold">JEDI 78</span>
          <span className="px-2 py-0.5 bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-[11px] rounded">⚡ Δ22</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[11px] rounded">Score: 78/100</span>
        </div>

        <div className="flex gap-4">
          {/* LEFT: Single Chart + Tabs + Grid */}
          <div className="flex-1 min-w-0">
            {/* Single Chart Area */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden mb-3">
              <div className="px-3 py-2 border-b border-[#1e293b] flex justify-between items-center">
                <span className="text-[11px] text-[#f59e0b] font-bold">{chart.title}</span>
                <div className="flex gap-3">
                  {chart.series.map(s => (
                    <span key={s.name} className="flex items-center gap-1 text-[10px]">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }}></span>
                      <span className="text-[#94a3b8]">{s.name}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-1 py-2">
                <MultiLineChart
                  labels={chart.labels}
                  series={chart.series}
                  height={140}
                  accentColor={tabColor}
                />
              </div>
              {/* Tab Controls below chart */}
              <div className="flex gap-1 px-3 py-2 border-t border-[#1e293b] bg-[#0f1729]">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded transition-colors ${
                      activeTab === tab.key
                        ? 'text-[#e2e8f0]'
                        : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1a2332]'
                    }`}
                    style={activeTab === tab.key ? { color: tab.color, backgroundColor: `${tab.color}18`, border: `1px solid ${tab.color}40` } : {}}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Grid Table */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b] flex justify-between items-center">
                <span className="text-[11px] uppercase tracking-wider" style={{ color: tabColor }}>{TABS.find(t => t.key === activeTab)?.label} Signal Metrics</span>
                <span className="text-[10px] text-[#94a3b8]">{rows.length} metrics</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-left px-3 py-1.5 font-normal">Signal</th>
                    <th className="text-left px-3 py-1.5 font-normal">Metric</th>
                    <th className="text-right px-3 py-1.5 font-normal">Value</th>
                    <th className="text-right px-3 py-1.5 font-normal">Δ YoY</th>
                    <th className="text-right px-3 py-1.5 font-normal">Weight</th>
                    <th className="text-right px-3 py-1.5 font-normal">Pts</th>
                    <th className="text-center px-3 py-1.5 font-normal">Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <MetricRow key={r.sig} {...r} last={i === rows.length - 1} />
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-1.5 bg-[#0f1729] border-t border-[#1e293b] flex justify-between text-[10px] text-[#94a3b8]">
                <span>14/16 Gates Passed | 2 Soft Fails (-8pts)</span>
                <span>Contribution: <span style={{ color: tabColor }}>{rows.reduce((s, r) => s + parseInt(r.pts), 0)}pts</span></span>
              </div>
            </div>
          </div>

          {/* RIGHT: Commentary Side Panel */}
          <div className="w-[280px] flex-shrink-0 border-l-2 border-[#f59e0b]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#f59e0b] tracking-wider mb-1 border-b border-[#f59e0b]/30 pb-1 font-bold">Market Narrative</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-2">
                Atlanta continues to demonstrate resilient fundamentals despite elevated supply pipeline. Demand drivers remain strong with 1.8% population growth and a favorable 1.24 jobs ratio.
              </p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Near-term supply pressure from 18,400 units delivering H2 2026 warrants selective positioning in core submarkets.
              </p>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#f59e0b] tracking-wider mb-1 border-b border-[#f59e0b]/30 pb-1 font-bold">Investment Thesis</div>
              <div className="space-y-1 text-[11px]">
                <div className="flex gap-2"><span className="text-[#22c55e]">✓</span><span className="text-[#94a3b8]">Population growth exceeds national avg</span></div>
                <div className="flex gap-2"><span className="text-[#22c55e]">✓</span><span className="text-[#94a3b8]">Employment diversification reducing risk</span></div>
                <div className="flex gap-2"><span className="text-[#f59e0b]">⚠</span><span className="text-[#94a3b8]">Supply deliveries may pressure occupancy</span></div>
                <div className="flex gap-2"><span className="text-[#ef4444]">✗</span><span className="text-[#94a3b8]">Insurance costs escalating in Cobb County</span></div>
              </div>
              <div className="mt-2 px-2 py-1 bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-[11px] text-center rounded font-bold">SELECTIVE BUY</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1e293b] mx-4"></div>

      {/* ======= SUBMARKET LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[#94a3b8] text-[11px] cursor-pointer hover:text-[#f59e0b]">← Back to MSA</span>
          <span className="text-[15px] font-bold">SUBMARKET: MIDTOWN ATLANTA</span>
          <span className="ml-auto px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] text-[11px] rounded font-bold">JEDI 87</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[11px] rounded">91/100</span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {/* Submarket Metrics Table (compact like the screenshot) */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden mb-3">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b] flex justify-between">
                <span className="text-[11px] uppercase text-[#f59e0b] tracking-wider font-bold">Submarket Index</span>
                <span className="text-[10px] text-[#94a3b8]">8 submarkets across tracked markets</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-left px-3 py-1.5 font-normal">Submarket</th>
                    <th className="text-left px-3 py-1.5 font-normal">MSA</th>
                    <th className="text-right px-3 py-1.5 font-normal">JEDI</th>
                    <th className="text-right px-3 py-1.5 font-normal">Rent</th>
                    <th className="text-right px-3 py-1.5 font-normal">Rent Δ</th>
                    <th className="text-right px-3 py-1.5 font-normal">Vac</th>
                    <th className="text-right px-3 py-1.5 font-normal">Props</th>
                    <th className="text-right px-3 py-1.5 font-normal">Units</th>
                    <th className="text-right px-3 py-1.5 font-normal">DPP</th>
                    <th className="text-right px-3 py-1.5 font-normal">CPP</th>
                    <th className="text-right px-3 py-1.5 font-normal">Cycle</th>
                  </tr>
                </thead>
                <tbody>
                  <SubRow name="Midtown" msa="Atlanta, GA" jedi={88} rent="$2,056" rentD="+4.8%" vac="5.1%" props={52} units="14.8K" dpp={82} cpp="4.8%" cycle="EXPANSION" highlight />
                  <SubRow name="Buckhead" msa="Atlanta, GA" jedi={84} rent="$1,883" rentD="+2.1%" vac="6.2%" props={38} units="11.2K" dpp={78} cpp="4.5%" cycle="EXPANSION" />
                  <SubRow name="Sandy Springs" msa="Atlanta, GA" jedi={81} rent="$1,920" rentD="+3.4%" vac="5.8%" props={44} units="12.6K" dpp={74} cpp="5.2%" cycle="EXPANSION" />
                  <SubRow name="Downtown Tampa" msa="Tampa, FL" jedi={80} rent="$1,850" rentD="+3.2%" vac="6.8%" props={62} units="18.4K" dpp={72} cpp="" cycle="LATE EXP" />
                  <SubRow name="Ybor City" msa="Tampa, FL" jedi={78} rent="$1,720" rentD="+4.1%" vac="5.6%" props={28} units="8.2K" dpp={80} cpp="5.6%" cycle="EXPANSION" />
                  <SubRow name="South Beach" msa="Miami, FL" jedi={76} rent="$2,890" rentD="+0.8%" vac="9.2%" props={45} units="15.4K" dpp={42} cpp="4.6%" cycle="PEAK" />
                  <SubRow name="Brickell" msa="Miami, FL" jedi={74} rent="$3,120" rentD="+0.4%" vac="8.5%" props={52} units="18.2K" dpp={38} cpp="4.4%" cycle="" />
                  <SubRow name="Downtown Raleigh" msa="Raleigh, NC" jedi={86} rent="$1,680" rentD="+4.2%" vac="5.4%" props={32} units="9.8K" dpp={84} cpp="5.2%" cycle="EXPANSION" last />
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Commentary */}
          <div className="w-[280px] flex-shrink-0 border-l-2 border-[#f59e0b]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#f59e0b] tracking-wider mb-1 border-b border-[#f59e0b]/30 pb-1 font-bold">Submarket Narrative</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Midtown ranks as the top-performing submarket in the Atlanta MSA with a 91 strategy score. Class B repositioning offers a 340bps spread to Class A rents.
              </p>
            </div>
            <div className="px-2 py-1.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded">
              <div className="text-[10px] text-[#22c55e] uppercase mb-0.5">Top Opportunity</div>
              <div className="text-[11px] text-[#e2e8f0]">Class B repositioning — 340bps spread</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1e293b] mx-4"></div>

      {/* ======= PROPERTY LEVEL ======= */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[#94a3b8] text-[11px] cursor-pointer hover:text-[#f59e0b]">← Back to Submarket</span>
          <span className="text-[15px] font-bold">PROPERTY: MIDTOWN PLACE APARTMENTS</span>
          <span className="px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-[10px] rounded font-bold">A</span>
          <span className="text-[11px] text-[#94a3b8]">245 Units | Built 2018</span>
          <span className="ml-auto px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] text-[11px] rounded font-bold">JEDI 86</span>
          <span className="px-2 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[11px] rounded font-bold">ACQUIRE</span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {/* Property Gate Results */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden mb-3">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b] flex justify-between">
                <span className="text-[11px] uppercase text-[#f59e0b] tracking-wider font-bold">Strategy Gate Results</span>
                <span className="text-[10px] text-[#94a3b8]">12/14 Passed | 2 Soft Fails (-8pts)</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase text-[#94a3b8] border-b border-[#1e293b]">
                    <th className="text-center px-3 py-1.5 font-normal w-8"></th>
                    <th className="text-left px-3 py-1.5 font-normal">Gate</th>
                    <th className="text-left px-3 py-1.5 font-normal">Requirement</th>
                    <th className="text-right px-3 py-1.5 font-normal">Actual</th>
                    <th className="text-right px-3 py-1.5 font-normal">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  <GateRow status="pass" gate="Unit Count" req="≥ 100" actual="245" impact="—" />
                  <GateRow status="pass" gate="Year Built" req="≥ 2010" actual="2018" impact="—" />
                  <GateRow status="pass" gate="Occupancy" req="≥ 93%" actual="97.2%" impact="—" />
                  <GateRow status="pass" gate="Rent Growth" req="≥ 3%" actual="+5.8%" impact="—" />
                  <GateRow status="pass" gate="Cap Rate" req="≤ 6.0%" actual="4.8%" impact="—" />
                  <GateRow status="pass" gate="NOI Growth" req="≥ 2%" actual="+3.8%" impact="—" />
                  <GateRow status="pass" gate="Class" req="A or B" actual="A" impact="—" />
                  <GateRow status="pass" gate="Absorption" req="≥ 85%" actual="94%" impact="—" />
                  <GateRow status="pass" gate="Pipeline Ratio" req="≤ 15%" actual="8.2%" impact="—" />
                  <GateRow status="pass" gate="Employment" req="≥ 1.5%" actual="+2.4%" impact="—" />
                  <GateRow status="soft-fail" gate="Traffic Score" req="≥ 70" actual="68" impact="-5pts" />
                  <GateRow status="soft-fail" gate="Walk Score" req="≥ 65" actual="62" impact="-3pts" last />
                </tbody>
              </table>
            </div>

            {/* Signal Contribution */}
            <div className="bg-[#111827] border border-[#1e293b] rounded overflow-hidden">
              <div className="bg-[#0f1729] px-3 py-1.5 border-b border-[#1e293b]">
                <span className="text-[11px] uppercase text-[#f59e0b] tracking-wider font-bold">Signal Contribution</span>
              </div>
              <div className="p-3 grid grid-cols-5 gap-2">
                <SignalBar label="Demand" pts={24} max={30} color="#14b8a6" />
                <SignalBar label="Supply" pts={16} max={25} color="#22c55e" />
                <SignalBar label="Momentum" pts={18} max={20} color="#f59e0b" />
                <SignalBar label="Position" pts={20} max={15} color="#ec4899" />
                <SignalBar label="Risk" pts={8} max={10} color="#ef4444" />
              </div>
              <div className="px-3 pb-2 text-center text-[11px] text-[#94a3b8]">
                Total: <span className="text-[#14b8a6] font-bold">86/100</span> after gate penalties (-8pts)
              </div>
            </div>
          </div>

          {/* RIGHT: Property Commentary */}
          <div className="w-[280px] flex-shrink-0 border-l-2 border-[#f59e0b]/40 pl-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[#f59e0b] tracking-wider mb-1 border-b border-[#f59e0b]/30 pb-1 font-bold">Property Analysis</div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Strong acquisition candidate. Above-market occupancy (97.2%) and rent growth (+5.8%) with a 2018 vintage align well with Core Plus Value-Add strategy.
              </p>
            </div>
            <div className="px-2 py-1.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded text-center">
              <div className="text-[10px] text-[#22c55e] uppercase">Recommended</div>
              <div className="text-[14px] font-bold text-[#22c55e]">ACQUIRE</div>
            </div>
            <div className="text-[10px] text-[#94a3b8]">
              <div className="flex justify-between py-0.5"><span>Est. IRR</span><span className="text-[#22c55e]">14.2%</span></div>
              <div className="flex justify-between py-0.5"><span>Cash-on-Cash</span><span className="text-[#22c55e]">8.4%</span></div>
              <div className="flex justify-between py-0.5"><span>DSCR</span><span className="text-[#e2e8f0]">1.32x</span></div>
              <div className="flex justify-between py-0.5"><span>Entry Basis</span><span className="text-[#e2e8f0]">$185K/unit</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-[#111827] border-t border-[#1e293b] px-4 py-2 flex justify-between text-[10px] text-[#94a3b8]">
        <span>Strategy: <span className="text-[#f59e0b]">Core Plus Value-Add</span> | D:30% S:25% M:20% P:15% R:10% | Gates: 14</span>
        <span>Last Refreshed: 2 hrs ago</span>
      </div>
    </div>
  );
}

function MultiLineChart({ labels, series, height, accentColor }: { labels: string[]; series: { name: string; data: number[]; color: string }[]; height: number; accentColor: string }) {
  const allVals = series.flatMap(s => s.data);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const pad = range * 0.1;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const w = 800;
  const h = height;
  const leftPad = 0;
  const rightPad = 0;
  const topPad = 10;
  const botPad = 24;
  const plotW = w - leftPad - rightPad;
  const plotH = h - topPad - botPad;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => yMin + (yRange * i) / gridLines);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: `${height}px` }}>
      {yTicks.map((tick, i) => {
        const y = topPad + plotH - ((tick - yMin) / yRange) * plotH;
        return (
          <g key={i}>
            <line x1={leftPad} y1={y} x2={w - rightPad} y2={y} stroke="#1e293b" strokeWidth="0.5" />
          </g>
        );
      })}

      {labels.map((label, i) => {
        const x = leftPad + (i / (labels.length - 1)) * plotW;
        return (
          <g key={i}>
            <line x1={x} y1={topPad} x2={x} y2={topPad + plotH} stroke="#1e293b" strokeWidth="0.3" />
            <text x={x} y={h - 4} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">{label}</text>
          </g>
        );
      })}

      {series.map((s, si) => {
        const points = s.data.map((v, i) => {
          const x = leftPad + (i / (s.data.length - 1)) * plotW;
          const y = topPad + plotH - ((v - yMin) / yRange) * plotH;
          return `${x},${y}`;
        }).join(' ');

        const fillPoints = s.data.map((v, i) => {
          const x = leftPad + (i / (s.data.length - 1)) * plotW;
          const y = topPad + plotH - ((v - yMin) / yRange) * plotH;
          return `${x},${y}`;
        });
        const fillPath = `${leftPad},${topPad + plotH} ${fillPoints.join(' ')} ${leftPad + plotW},${topPad + plotH}`;

        const lastVal = s.data[s.data.length - 1];
        const lastX = leftPad + plotW;
        const lastY = topPad + plotH - ((lastVal - yMin) / yRange) * plotH;

        return (
          <g key={si}>
            <polyline fill={`${s.color}08`} stroke="none" points={fillPath} />
            <polyline fill="none" stroke={s.color} strokeWidth="1.5" points={points} />
            <circle cx={lastX} cy={lastY} r="3" fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}

function MetricRow({ sig, name, val, chg, w, pts, gate, live, last }: any) {
  const isNeg = chg?.startsWith('-');

  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} hover:bg-[#1a2332]`}>
      <td className="px-3 py-1.5">
        <span className="px-1 py-0.5 bg-[#0f1729] border border-[#1e293b] text-[9px] text-[#94a3b8] rounded-sm">{sig}</span>
      </td>
      <td className="px-3 py-1.5 text-[#e2e8f0]">
        {name}
        {live && <span className="ml-1.5 px-1 py-0 bg-[#22c55e]/20 text-[#22c55e] text-[8px] rounded">LIVE</span>}
      </td>
      <td className="px-3 py-1.5 text-right font-bold text-[#e2e8f0]">{val}</td>
      <td className={`px-3 py-1.5 text-right ${isNeg ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>{chg}</td>
      <td className="px-3 py-1.5 text-right text-[#94a3b8]">{w}</td>
      <td className={`px-3 py-1.5 text-right font-bold ${pts?.startsWith('-') ? 'text-[#ef4444]' : 'text-[#14b8a6]'}`}>{pts}</td>
      <td className="px-3 py-1.5 text-center">
        {gate === 'pass' && <span className="text-[#22c55e] text-[11px]">✓</span>}
        {gate === 'soft-fail' && <span className="text-[#f59e0b] text-[11px]">⚠</span>}
        {gate === 'fail' && <span className="text-[#ef4444] text-[11px]">✗</span>}
      </td>
    </tr>
  );
}

function SubRow({ name, msa, jedi, rent, rentD, vac, props, units, dpp, cpp, cycle, highlight, last }: any) {
  const cycleColor = cycle === 'EXPANSION' ? 'text-[#22c55e] bg-[#22c55e]/10' : cycle === 'PEAK' ? 'text-[#f59e0b] bg-[#f59e0b]/10' : cycle ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-[#94a3b8]';

  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} ${highlight ? 'bg-[#f59e0b]/5' : ''} hover:bg-[#1a2332]`}>
      <td className={`px-3 py-1.5 ${highlight ? 'text-[#f59e0b] font-bold' : 'text-[#e2e8f0]'}`}>{name}</td>
      <td className="px-3 py-1.5 text-[#94a3b8]">{msa}</td>
      <td className="px-3 py-1.5 text-right text-[#f59e0b] font-bold">{jedi}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{rent}</td>
      <td className="px-3 py-1.5 text-right text-[#22c55e]">{rentD}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{vac}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{props}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{units}</td>
      <td className="px-3 py-1.5 text-right text-[#14b8a6]">{dpp}</td>
      <td className="px-3 py-1.5 text-right text-[#e2e8f0]">{cpp}</td>
      <td className="px-3 py-1.5 text-right">{cycle && <span className={`px-1.5 py-0.5 text-[9px] uppercase rounded ${cycleColor}`}>{cycle}</span>}</td>
    </tr>
  );
}

function GateRow({ status, gate, req, actual, impact, last }: any) {
  return (
    <tr className={`border-b ${last ? 'border-transparent' : 'border-[#1e293b]/50'} hover:bg-[#1a2332]`}>
      <td className="px-3 py-1.5 text-center">
        {status === 'pass' && <span className="text-[#22c55e]">✓</span>}
        {status === 'soft-fail' && <span className="text-[#f59e0b]">⚠</span>}
        {status === 'fail' && <span className="text-[#ef4444]">✗</span>}
      </td>
      <td className="px-3 py-1.5 text-[#e2e8f0]">{gate}</td>
      <td className="px-3 py-1.5 text-[#94a3b8]">{req}</td>
      <td className={`px-3 py-1.5 text-right font-bold ${status === 'pass' ? 'text-[#22c55e]' : status === 'soft-fail' ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>{actual}</td>
      <td className={`px-3 py-1.5 text-right ${impact === '—' ? 'text-[#94a3b8]' : 'text-[#ef4444]'}`}>{impact}</td>
    </tr>
  );
}

function SignalBar({ label, pts, max, color }: { label: string; pts: number; max: number; color: string }) {
  const pct = Math.min((pts / 30) * 100, 100);
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-[#94a3b8] mb-1">{label}</div>
      <div className="h-14 bg-[#0a0e17] rounded relative flex items-end justify-center overflow-hidden">
        <div className="w-full rounded-t" style={{ height: `${pct}%`, backgroundColor: `${color}40`, borderTop: `2px solid ${color}` }}></div>
      </div>
      <div className="text-[11px] font-bold mt-1" style={{ color }}>+{pts}</div>
      <div className="text-[9px] text-[#94a3b8]">/{max}</div>
    </div>
  );
}
