import React, { useState } from 'react';

const SUBMARKET_RANKINGS = [
  { rank: 1, name: 'Camden USA', class: 'A', submarket: 'Buckhead', units: 745, avgSf: 985, avgRent: 2180, occupancy: 96.8, pcs: 94.2, rentVsCeiling: 0, trend: 'up' as const },
  { rank: 2, name: 'Avalon Midtown Reserve', class: 'A', submarket: 'Midtown', units: 380, avgSf: 942, avgRent: 2050, occupancy: 96.1, pcs: 91.7, rentVsCeiling: -130, trend: 'up' as const },
  { rank: 3, name: 'The Retreat at Buckhead', class: 'A', submarket: 'Buckhead', units: 298, avgSf: 918, avgRent: 1980, occupancy: 95.4, pcs: 88.3, rentVsCeiling: -200, trend: 'stable' as const },
  { rank: 4, name: 'Alexan Buckhead Village', class: 'A', submarket: 'Buckhead', units: 340, avgSf: 952, avgRent: 2010, occupancy: 93.1, pcs: 86.8, rentVsCeiling: -170, trend: 'up' as const },
  { rank: 5, name: 'The Vue at Buckhead', class: 'A', submarket: 'Buckhead', units: 312, avgSf: 896, avgRent: 1950, occupancy: 96.2, pcs: 84.6, rentVsCeiling: -230, trend: 'stable' as const },
  { rank: 6, name: 'Elan Lenox', class: 'A-', submarket: 'Buckhead', units: 268, avgSf: 878, avgRent: 1875, occupancy: 94.8, pcs: 82.1, rentVsCeiling: -305, trend: 'down' as const },
  { rank: 7, name: 'Pines at Midtown', class: 'B', submarket: 'Midtown', units: 180, avgSf: 824, avgRent: 1720, occupancy: 95.2, pcs: 79.4, rentVsCeiling: -460, trend: 'up' as const },
  { rank: 8, name: 'Brookhaven Station Apts', class: 'B+', submarket: 'Brookhaven', units: 278, avgSf: 862, avgRent: 1760, occupancy: 94.6, pcs: 78.2, rentVsCeiling: -420, trend: 'up' as const },
  { rank: 9, name: 'The Wyatt at West Midtown', class: 'B+', submarket: 'West Midtown', units: 208, avgSf: 848, avgRent: 1710, occupancy: 95.6, pcs: 76.5, rentVsCeiling: -470, trend: 'up' as const },
  { rank: 10, name: 'Cortland at Phipps Plaza', class: 'A-', submarket: 'Buckhead', units: 198, avgSf: 905, avgRent: 1840, occupancy: 94.2, pcs: 74.8, rentVsCeiling: -340, trend: 'stable' as const },
  { rank: 11, name: 'Vinings Creek Terrace', class: 'B', submarket: 'Vinings', units: 168, avgSf: 812, avgRent: 1680, occupancy: 93.8, pcs: 72.1, rentVsCeiling: -500, trend: 'stable' as const },
  { rank: 12, name: 'ARIUM Brookhaven', class: 'B+', submarket: 'Brookhaven', units: 224, avgSf: 838, avgRent: 1720, occupancy: 95.4, pcs: 70.6, rentVsCeiling: -460, trend: 'up' as const },
  { rank: 13, name: 'Glenwood East Village', class: 'B+', submarket: 'East Atlanta', units: 196, avgSf: 795, avgRent: 1640, occupancy: 93.2, pcs: 68.4, rentVsCeiling: -540, trend: 'down' as const },
  { rank: 14, name: 'Sunset Ridge Apartments', class: 'B', submarket: 'Sandy Springs', units: 248, avgSf: 806, avgRent: 1648, occupancy: 92.8, pcs: 66.2, rentVsCeiling: -532, trend: 'down' as const },
  { rank: 15, name: 'Broadstone Lenox Park', class: 'B+', submarket: 'Buckhead', units: 286, avgSf: 856, avgRent: 1690, occupancy: 93.8, pcs: 64.8, rentVsCeiling: -490, trend: 'stable' as const },
  { rank: 16, name: 'Cascade Falls Residences', class: 'B', submarket: 'Cascade', units: 186, avgSf: 782, avgRent: 1580, occupancy: 91.4, pcs: 61.2, rentVsCeiling: -600, trend: 'down' as const },
  { rank: 17, name: 'Decatur Heights', class: 'B', submarket: 'Decatur', units: 198, avgSf: 768, avgRent: 1540, occupancy: 92.1, pcs: 58.5, rentVsCeiling: -640, trend: 'down' as const },
  { rank: 18, name: 'Westside Lofts', class: 'B-', submarket: 'Westside', units: 142, avgSf: 745, avgRent: 1490, occupancy: 91.0, pcs: 52.3, rentVsCeiling: -690, trend: 'stable' as const },
  { rank: 19, name: 'Lakewood Crossing', class: 'B-', submarket: 'Lakewood', units: 312, avgSf: 718, avgRent: 1420, occupancy: 89.6, pcs: 45.8, rentVsCeiling: -760, trend: 'down' as const },
  { rank: 20, name: 'College Park Commons', class: 'C', submarket: 'College Park', units: 224, avgSf: 692, avgRent: 1120, occupancy: 88.2, pcs: 38.1, rentVsCeiling: -1060, trend: 'down' as const },
];

const TREND_ICONS = {
  up: { icon: '\u2191', color: 'text-emerald-600' },
  down: { icon: '\u2193', color: 'text-red-500' },
  stable: { icon: '\u2192', color: 'text-stone-400' },
} as const;

const VITALS = [
  { label: 'Tracked Properties', value: '142', trend: '+8 this month', trendDirection: 'up' as const, sparkline: [98, 105, 110, 112, 118, 122, 125, 128, 130, 134, 138, 142] },
  { label: 'Avg PCS Score', value: '67.4', trend: '+2.1 QoQ', trendDirection: 'up' as const, sparkline: [58, 60, 61, 62, 63, 64, 64, 65, 66, 66, 67, 67] },
  { label: 'Rent Ceiling', value: '$2,180', trend: 'Market top', trendDirection: 'up' as const, sparkline: [1920, 1960, 1990, 2010, 2040, 2060, 2080, 2100, 2120, 2140, 2160, 2180] },
  { label: 'PCS Spread', value: '56.1', trend: 'Top vs bottom Q', trendDirection: 'up' as const, sparkline: [42, 44, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56] },
  { label: 'Hidden Gems Detected', value: '7', trend: '+2 this quarter', trendDirection: 'up' as const, sparkline: [2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7] },
];

const DealCompAnalysisTab: React.FC = () => {
  const [sortField, setSortField] = useState<'pcs' | 'rent' | 'occupancy'>('pcs');

  const sortedRankings = [...SUBMARKET_RANKINGS].sort((a, b) => {
    if (sortField === 'rent') return b.avgRent - a.avgRent;
    if (sortField === 'occupancy') return b.occupancy - a.occupancy;
    return b.pcs - a.pcs;
  });

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">DEAL-SPECIFIC COMP ANALYSIS</div>
        <div className="text-lg font-semibold">How does this property compete on rent, size, and amenities within its trade area?</div>
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
          {VITALS.map((kpi, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{kpi.label}</div>
              <div className="text-xl font-bold text-stone-900">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${kpi.trendDirection === 'up' ? 'text-emerald-600' : kpi.trendDirection === 'down' ? 'text-red-500' : 'text-stone-500'}`}>
                  {kpi.trendDirection === 'up' ? '\u2191' : kpi.trendDirection === 'down' ? '\u2193' : '\u2192'} {kpi.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {kpi.sparkline.map((v, j, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div
                      key={j}
                      className={`flex-1 rounded-sm ${j === arr.length - 1 ? 'bg-violet-500' : 'bg-stone-200'}`}
                      style={{ height: `${Math.max(10, height)}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
        <p className="text-sm text-violet-900">
          Tracking <strong>142 properties</strong> across Atlanta MSA. Avg PCS score of <strong>67.4</strong> trending up +2.1 QoQ. Rent ceiling at <strong>$2,180/mo</strong> with a PCS spread of 56.1 between top and bottom quartiles {'\u2014'} indicating significant competitive stratification. <strong>7 hidden gems</strong> detected with high location scores but below-expected performance.
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
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">UNITS</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-20">AVG SF</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-24">AVG RENT</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-24">OCCUPANCY</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-32">PCS SCORE</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-28">RENT VS CEILING</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">TREND</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((prop, idx) => {
                const trendInfo = TREND_ICONS[prop.trend];
                const pcsColor = prop.pcs >= 80 ? 'bg-emerald-500' : prop.pcs >= 60 ? 'bg-amber-500' : 'bg-red-500';
                const rankBadge = prop.pcs >= 80 ? 'bg-emerald-50 text-emerald-700' : prop.pcs >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
                return (
                  <tr key={idx} className="border-t border-stone-100 hover:bg-violet-50/30 transition-colors">
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rankBadge}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-stone-900 text-xs">{prop.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 rounded ${prop.class.startsWith('A') ? 'bg-blue-50 text-blue-600' : prop.class.startsWith('B') ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>{prop.class}</span>
                        <span className="text-[10px] text-stone-300">&middot;</span>
                        <span className="text-[10px] text-stone-500">{prop.submarket}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-mono text-stone-600">{prop.units}</td>
                    <td className="px-3 py-3 text-center text-xs font-mono text-stone-600">{prop.avgSf.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center text-xs font-bold text-stone-900">${prop.avgRent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center text-xs text-stone-700">{prop.occupancy}%</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{prop.pcs}</span>
                        <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pcsColor}`} style={{ width: `${prop.pcs}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {prop.rentVsCeiling === 0 ? (
                        <span className="text-xs font-bold text-violet-600 font-mono tracking-wider">CEILING</span>
                      ) : (
                        <span className="text-xs font-mono text-stone-500">${prop.rentVsCeiling.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-semibold ${trendInfo.color}`}>{trendInfo.icon}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <a href="#" className="text-[10px] font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-md transition-colors">Analyze</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-50 border border-emerald-200 inline-block" /> PCS &ge; 80</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-50 border border-amber-200 inline-block" /> PCS 60&ndash;79</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-50 border border-red-200 inline-block" /> PCS &lt; 60</span>
        </div>
      </div>
    </div>
  );
};

export default DealCompAnalysisTab;
