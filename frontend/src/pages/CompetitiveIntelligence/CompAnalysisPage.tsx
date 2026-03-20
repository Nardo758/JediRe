import React, { useState } from 'react';

const MARKET_VITALS = [
  { id: 'tracked', label: 'Tracked Properties', value: '142', trend: '+8 this month', trendDirection: 'up' as const, sparklineData: [98, 105, 110, 112, 118, 122, 125, 128, 130, 134, 138, 142] },
  { id: 'avg-pcs', label: 'Avg PCS Score', value: '67.4', trend: '+2.1 QoQ', trendDirection: 'up' as const, sparklineData: [58, 60, 61, 62, 63, 64, 64, 65, 66, 66, 67, 67] },
  { id: 'rent-ceiling', label: 'Rent Ceiling', value: '$2,180', trend: 'Market top', trendDirection: 'up' as const, sparklineData: [1920, 1960, 1990, 2010, 2040, 2060, 2080, 2100, 2120, 2140, 2160, 2180] },
  { id: 'pcs-spread', label: 'PCS Spread', value: '56.1', trend: 'Top vs bottom Q', trendDirection: 'up' as const, sparklineData: [42, 44, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56] },
  { id: 'hidden-gems', label: 'Hidden Gems Detected', value: '7', trend: '+2 this quarter', trendDirection: 'up' as const, sparklineData: [2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7] },
];

const SUBMARKET_RANKINGS = [
  { rank: 1, name: 'Camden USA', class: 'A', submarket: 'Buckhead', units: 745, avgRent: 2180, occupancy: 96.8, pcs: 94.2, rentVsCeiling: 0, trend: 'up' as const },
  { rank: 2, name: 'Avalon Midtown Reserve', class: 'A', submarket: 'Midtown', units: 380, avgRent: 2050, occupancy: 96.1, pcs: 91.7, rentVsCeiling: -130, trend: 'up' as const },
  { rank: 3, name: 'The Retreat at Buckhead', class: 'A', submarket: 'Buckhead', units: 298, avgRent: 1980, occupancy: 95.4, pcs: 88.3, rentVsCeiling: -200, trend: 'stable' as const },
  { rank: 4, name: 'Alexan Buckhead Village', class: 'A', submarket: 'Buckhead', units: 340, avgRent: 2010, occupancy: 93.1, pcs: 86.8, rentVsCeiling: -170, trend: 'up' as const },
  { rank: 5, name: 'The Vue at Buckhead', class: 'A', submarket: 'Buckhead', units: 312, avgRent: 1950, occupancy: 96.2, pcs: 84.6, rentVsCeiling: -230, trend: 'stable' as const },
  { rank: 6, name: 'Elan Lenox', class: 'A-', submarket: 'Buckhead', units: 268, avgRent: 1875, occupancy: 94.8, pcs: 82.1, rentVsCeiling: -305, trend: 'down' as const },
  { rank: 7, name: 'Pines at Midtown', class: 'B', submarket: 'Midtown', units: 180, avgRent: 1720, occupancy: 95.2, pcs: 79.4, rentVsCeiling: -460, trend: 'up' as const },
  { rank: 8, name: 'Brookhaven Station Apts', class: 'B+', submarket: 'Brookhaven', units: 278, avgRent: 1760, occupancy: 94.6, pcs: 78.2, rentVsCeiling: -420, trend: 'up' as const },
  { rank: 9, name: 'The Wyatt at West Midtown', class: 'B+', submarket: 'West Midtown', units: 208, avgRent: 1710, occupancy: 95.6, pcs: 76.5, rentVsCeiling: -470, trend: 'up' as const },
  { rank: 10, name: 'Cortland at Phipps Plaza', class: 'A-', submarket: 'Buckhead', units: 198, avgRent: 1840, occupancy: 94.2, pcs: 74.8, rentVsCeiling: -340, trend: 'stable' as const },
  { rank: 11, name: 'Vinings Creek Terrace', class: 'B', submarket: 'Vinings', units: 168, avgRent: 1680, occupancy: 93.8, pcs: 72.1, rentVsCeiling: -500, trend: 'stable' as const },
  { rank: 12, name: 'ARIUM Brookhaven', class: 'B+', submarket: 'Brookhaven', units: 224, avgRent: 1720, occupancy: 95.4, pcs: 70.6, rentVsCeiling: -460, trend: 'up' as const },
  { rank: 13, name: 'Glenwood East Village', class: 'B+', submarket: 'East Atlanta', units: 196, avgRent: 1640, occupancy: 93.2, pcs: 68.4, rentVsCeiling: -540, trend: 'down' as const },
  { rank: 14, name: 'Sunset Ridge Apartments', class: 'B', submarket: 'Sandy Springs', units: 248, avgRent: 1648, occupancy: 92.8, pcs: 66.2, rentVsCeiling: -532, trend: 'down' as const },
  { rank: 15, name: 'Broadstone Lenox Park', class: 'B+', submarket: 'Buckhead', units: 286, avgRent: 1690, occupancy: 93.8, pcs: 64.8, rentVsCeiling: -490, trend: 'stable' as const },
  { rank: 16, name: 'Cascade Falls Residences', class: 'B', submarket: 'Cascade', units: 186, avgRent: 1580, occupancy: 91.4, pcs: 61.2, rentVsCeiling: -600, trend: 'down' as const },
  { rank: 17, name: 'Decatur Heights', class: 'B', submarket: 'Decatur', units: 198, avgRent: 1540, occupancy: 92.1, pcs: 58.5, rentVsCeiling: -640, trend: 'down' as const },
  { rank: 18, name: 'Westside Lofts', class: 'B-', submarket: 'Westside', units: 142, avgRent: 1490, occupancy: 91.0, pcs: 52.3, rentVsCeiling: -690, trend: 'stable' as const },
  { rank: 19, name: 'Lakewood Crossing', class: 'B-', submarket: 'Lakewood', units: 312, avgRent: 1420, occupancy: 89.6, pcs: 45.8, rentVsCeiling: -760, trend: 'down' as const },
  { rank: 20, name: 'College Park Commons', class: 'C', submarket: 'College Park', units: 224, avgRent: 1120, occupancy: 88.2, pcs: 38.1, rentVsCeiling: -1060, trend: 'down' as const },
];

const VANTAGE_GROUPS = [
  {
    label: '200–300u Class B, 2005–2015',
    avgPcs: 64.8,
    rentRange: '$1,490 – $1,690',
    propertyCount: 18,
    topPerformer: 'Broadstone Lenox Park',
  },
  {
    label: '150–250u Class B+, 2015–2022',
    avgPcs: 76.2,
    rentRange: '$1,680 – $1,840',
    propertyCount: 12,
    topPerformer: 'Brookhaven Station Apts',
  },
  {
    label: '300–500u Class A, 2018–2024',
    avgPcs: 88.4,
    rentRange: '$1,950 – $2,180',
    propertyCount: 8,
    topPerformer: 'Camden USA',
  },
  {
    label: '100–200u Class C/C+, Pre-2010',
    avgPcs: 42.6,
    rentRange: '$1,050 – $1,280',
    propertyCount: 14,
    topPerformer: 'East Point Village',
  },
];

const COMPETITIVE_PATTERNS = [
  {
    title: 'Rent Ceiling Compression',
    description: 'The gap between top-rent and median-rent properties has narrowed 12% YoY. New Class A supply is pulling the ceiling higher, but renovated B+ properties are closing fast — compressing the premium for new construction.',
    signal: 'Narrowing',
    severity: 'amber' as const,
  },
  {
    title: 'Amenity Arms Race',
    description: '68% of properties in the top quartile added coworking spaces or package lockers in the past 18 months. Properties without these amenities are seeing accelerated traffic loss to competitors.',
    signal: 'Intensifying',
    severity: 'red' as const,
  },
  {
    title: 'Digital Share Shift',
    description: 'Online-sourced leads now account for 74% of total traffic across the MSA, up from 61% two years ago. Properties investing in digital marketing are gaining disproportionate traffic share.',
    signal: 'Accelerating',
    severity: 'red' as const,
  },
  {
    title: 'Vintage Cascade',
    description: 'New 2023–2024 deliveries are pushing Class A existing stock to compete with renovated B+. This cascading effect is creating pricing pressure across all vintage bands, particularly 2008–2015 builds.',
    signal: 'Active',
    severity: 'amber' as const,
  },
];

const TREND_ICONS = {
  up: { icon: '↑', color: 'text-emerald-600' },
  down: { icon: '↓', color: 'text-red-500' },
  stable: { icon: '→', color: 'text-stone-400' },
} as const;

const SEVERITY_STYLES = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
} as const;

const CompAnalysisPage: React.FC = () => {
  const [sortField, setSortField] = useState<'pcs' | 'rent' | 'occupancy'>('pcs');

  const sortedRankings = [...SUBMARKET_RANKINGS].sort((a, b) => {
    if (sortField === 'rent') return b.avgRent - a.avgRent;
    if (sortField === 'occupancy') return b.occupancy - a.occupancy;
    return b.pcs - a.pcs;
  });

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">What does the competitive landscape look like in this market — and where are the opportunities?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Market Competitive Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">Atlanta MSA | 142 properties</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {MARKET_VITALS.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${vital.trendDirection === 'up' ? 'text-emerald-600' : vital.trendDirection === 'down' ? 'text-red-500' : 'text-stone-500'}`}>
                  {vital.trendDirection === 'up' ? '↑' : vital.trendDirection === 'down' ? '↓' : '→'} {vital.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparklineData.slice(-12).map((v, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-violet-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
        <p className="text-sm text-violet-900">
          Tracking <strong>142 properties</strong> across Atlanta MSA. Avg PCS score of <strong>67.4</strong> trending up +2.1 QoQ. Rent ceiling at <strong>$2,180/mo</strong> with a PCS spread of 56.1 between top and bottom quartiles — indicating significant competitive stratification. <strong>7 hidden gems</strong> detected with high location scores but below-expected performance.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Submarket Comp Landscape</h3>
            <p className="text-sm text-stone-500">Top 20 properties ranked by PCS across Atlanta MSA</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <div className="flex bg-stone-100 rounded-lg p-0.5">
              <button onClick={() => setSortField('pcs')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'pcs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By PCS</button>
              <button onClick={() => setSortField('rent')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'rent' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Rent</button>
              <button onClick={() => setSortField('occupancy')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'occupancy' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Occupancy</button>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider w-14">RANK</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">UNITS</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">AVG RENT</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">OCCUPANCY</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PCS SCORE</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">RENT vs CEILING</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">TREND</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((row, idx) => {
                const trendInfo = TREND_ICONS[row.trend];
                const pcsColor = row.pcs >= 80 ? 'bg-emerald-500' : row.pcs >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <tr key={row.rank} className="border-t border-stone-100 hover:bg-violet-50/30 transition-colors">
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.pcs >= 80 ? 'bg-emerald-50 text-emerald-700' : row.pcs >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-stone-900 text-xs">{row.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 rounded ${row.class.startsWith('A') ? 'bg-blue-50 text-blue-600' : row.class.startsWith('B') ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>{row.class}</span>
                        <span className="text-[10px] text-stone-300">·</span>
                        <span className="text-[10px] text-stone-500">{row.submarket}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-stone-600">{row.units}</td>
                    <td className="px-3 py-3 text-xs font-bold text-stone-900">${row.avgRent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-stone-700">{row.occupancy}%</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{row.pcs}</span>
                        <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pcsColor}`} style={{ width: `${row.pcs}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-mono ${row.rentVsCeiling === 0 ? 'text-violet-600 font-bold' : 'text-stone-500'}`}>
                        {row.rentVsCeiling === 0 ? 'CEILING' : `$${row.rentVsCeiling.toLocaleString()}`}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-sm font-semibold ${trendInfo.color}`}>{trendInfo.icon}</span>
                    </td>
                    <td className="px-3 py-3">
                      <a href="#" className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-md transition-colors">Analyze</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-50 border border-emerald-200 inline-block" /> PCS ≥ 80</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-50 border border-amber-200 inline-block" /> PCS 60–79</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-50 border border-red-200 inline-block" /> PCS &lt; 60</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Vantage Group Clusters</h3>
            <p className="text-sm text-stone-500">Properties grouped by similar vintage, unit count, and class for apples-to-apples comparison</p>
          </div>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {VANTAGE_GROUPS.map((group, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-violet-300 transition-colors">
              <div className="text-xs font-bold text-stone-900 mb-3">{group.label}</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-400">AVG PCS</span>
                  <span className="text-sm font-bold text-stone-900">{group.avgPcs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-400">RENT RANGE</span>
                  <span className="text-[11px] font-semibold text-stone-700">{group.rentRange}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-400">PROPERTIES</span>
                  <span className="text-sm font-bold text-stone-900">{group.propertyCount}</span>
                </div>
                <div className="border-t border-stone-100 pt-2 mt-2">
                  <div className="text-[10px] font-mono text-stone-400 mb-0.5">TOP PERFORMER</div>
                  <div className="text-xs font-semibold text-violet-700">{group.topPerformer}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Competitive Patterns</h3>
            <p className="text-sm text-stone-500">Market-wide competitive dynamics shaping the landscape</p>
          </div>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {COMPETITIVE_PATTERNS.map((pattern, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-violet-200 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <h4 className="text-sm font-bold text-stone-900">{pattern.title}</h4>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${SEVERITY_STYLES[pattern.severity]}`}>{pattern.signal}</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{pattern.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompAnalysisPage;
