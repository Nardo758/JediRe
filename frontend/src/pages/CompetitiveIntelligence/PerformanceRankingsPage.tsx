import React, { useState } from 'react';

const VITALS = [
  { id: 'tracked', label: 'Tracked Properties', value: '142', trend: '+8 this month', trendDirection: 'up' as const, sparklineData: [98, 105, 110, 112, 118, 122, 125, 128, 130, 134, 138, 142] },
  { id: 'avg-pcs', label: 'Avg PCS Score', value: '67.4', trend: '+2.1 QoQ', trendDirection: 'up' as const, sparklineData: [58, 60, 61, 62, 63, 64, 64, 65, 66, 66, 67, 67] },
  { id: 'top-performer', label: 'Top Performer Score', value: '94.2', trend: 'Stable', trendDirection: 'up' as const, sparklineData: [90, 91, 90, 92, 93, 92, 93, 94, 93, 94, 94, 94] },
  { id: 'bottom-q', label: 'Bottom Quartile Score', value: '38.1', trend: '-1.4 QoQ', trendDirection: 'down' as const, sparklineData: [44, 43, 42, 41, 40, 40, 39, 39, 38, 38, 38, 38] },
  { id: 'rank-move', label: 'Avg Rank Movement', value: '±3.2', trend: 'High churn', trendDirection: 'up' as const, sparklineData: [2.1, 2.4, 2.8, 3.0, 2.6, 3.1, 3.4, 2.9, 3.5, 3.2, 3.0, 3.2] },
];

const SCORE_COMPONENTS = [
  {
    name: 'Traffic Position',
    weight: '25%',
    source: 'M07 Traffic Engine → TPI',
    metrics: ['Effective ADT percentile in submarket', 'Digital traffic share', 'Traffic velocity (gaining/losing)', 'Walk-in conversion efficiency'],
    formula: 'traffic_score = TPI_percentile × 0.5 + digital_share_pct × 0.25 + TVS_normalized × 0.25',
  },
  {
    name: 'Revenue Performance',
    weight: '30%',
    source: 'M05 Market Intel + CoStar',
    metrics: ['Effective rent vs submarket avg', 'Rent growth rate vs submarket', 'Revenue per available unit (RevPAU)', 'Concession intensity (inverse)'],
    formula: 'revenue_score = rent_premium_pct × 0.3 + rent_growth_delta × 0.3 + revpau_percentile × 0.25 + (1 - concession_rate) × 0.15',
  },
  {
    name: 'Occupancy & Demand',
    weight: '20%',
    source: 'M05 + Apartments.com + T-05',
    metrics: ['Physical occupancy rate', 'Economic occupancy rate', 'Lease velocity (new leases/month)', 'Traffic-to-lease conversion rate'],
    formula: 'occupancy_score = physical_occ × 0.3 + economic_occ × 0.3 + lease_velocity_pct × 0.2 + T05_conversion × 0.2',
  },
  {
    name: 'Operational Quality',
    weight: '15%',
    source: 'Google Reviews + Apartments.com',
    metrics: ['Google rating (1-5 stars)', 'Review volume & recency', 'Sentiment score from NLP', 'Response rate to reviews', 'Maintenance complaint frequency'],
    formula: 'ops_score = google_rating_norm × 0.3 + sentiment_score × 0.3 + review_volume_norm × 0.15 + response_rate × 0.15 + (1-complaint_freq) × 0.10',
  },
  {
    name: 'Asset Quality',
    weight: '10%',
    source: 'M01 Deal Capsule + Records',
    metrics: ['Year built / last renovated', 'Amenity completeness score', 'Unit mix quality (vs market demand)', 'Curb appeal / condition assessment'],
    formula: 'asset_score = age_factor × 0.3 + amenity_completeness × 0.3 + unit_mix_alignment × 0.2 + condition_score × 0.2',
  },
];

const RANKING_OUTPUTS = [
  {
    name: 'Submarket Power Rankings',
    description: 'Every property ranked 1 to N within its submarket. Updated monthly. Shows movement (↓3, ↑2, —). Users see where their assets rank and who just passed them.',
    display: 'Sortable table with sparkline trends. Click any property → full PCS breakdown. Color-coded: Top 25% green, Middle 50% yellow, Bottom 25% red.',
  },
  {
    name: 'Vantage Group Rankings',
    description: "Properties grouped by 'vantage' — similar vintage, similar unit count, similar class (A/B/C). Answers: 'Among 200-300 unit Class B properties built 2005-2015 in this MSA, where do I rank?'",
    display: 'Dropdown filters: Class (A/B/C) × Vintage (decade) × Size (unit range) × Submarket. Rankings recalculate in real-time as filters change.',
  },
  {
    name: 'Performance Trajectory',
    description: '12-month PCS trend line for each property. Identifies properties on upward trajectories (improving management, recent renovation) vs. declining (deferred maintenance, losing share).',
    display: '↑ Accelerating, → Stable, ↓ Decelerating. Trajectory is as important as current rank — a #15 climbing fast is more interesting than a #5 slipping.',
  },
];

const MOCK_RANKINGS = [
  { rank: 1, name: 'Avalon Midtown Reserve', pcs: 94.2, movement: '+2', movementDir: 'up' as const, class: 'A', submarket: 'Midtown' },
  { rank: 2, name: 'The Retreat at Buckhead', pcs: 91.7, movement: '—', movementDir: 'stable' as const, class: 'A', submarket: 'Buckhead' },
  { rank: 3, name: 'Camden Paces', pcs: 88.3, movement: '+1', movementDir: 'up' as const, class: 'A', submarket: 'Buckhead' },
  { rank: 4, name: 'Glenwood East Village', pcs: 84.6, movement: '-1', movementDir: 'down' as const, class: 'B+', submarket: 'East Atlanta' },
  { rank: 5, name: 'Inman Quarter Lofts', pcs: 79.1, movement: '+3', movementDir: 'up' as const, class: 'B', submarket: 'Inman Park' },
  { rank: 6, name: 'Westside Commons', pcs: 72.8, movement: '-2', movementDir: 'down' as const, class: 'B', submarket: 'Westside' },
  { rank: 7, name: 'Peachtree Hills Place', pcs: 68.4, movement: '+1', movementDir: 'up' as const, class: 'B', submarket: 'Peachtree Hills' },
  { rank: 8, name: 'Decatur Station Living', pcs: 61.2, movement: '-3', movementDir: 'down' as const, class: 'B-', submarket: 'Decatur' },
  { rank: 9, name: 'Cascade Pointe Apts', pcs: 48.5, movement: '—', movementDir: 'stable' as const, class: 'C+', submarket: 'Cascade' },
  { rank: 10, name: 'Lakewood Terrace', pcs: 38.1, movement: '-2', movementDir: 'down' as const, class: 'C', submarket: 'Lakewood' },
];

function getRankColor(rank: number, total: number) {
  const pct = rank / total;
  if (pct <= 0.25) return 'text-emerald-600 bg-emerald-50';
  if (pct <= 0.75) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getMovementDisplay(dir: 'up' | 'down' | 'stable', movement: string) {
  if (dir === 'up') return { icon: '↑', color: 'text-emerald-600' };
  if (dir === 'down') return { icon: '↓', color: 'text-red-500' };
  return { icon: '—', color: 'text-stone-400' };
}

const PerformanceRankingsPage: React.FC = () => {
  const [sortField, setSortField] = useState<'rank' | 'pcs' | 'movement'>('rank');

  const sortedRankings = [...MOCK_RANKINGS].sort((a, b) => {
    if (sortField === 'pcs') return b.pcs - a.pcs;
    if (sortField === 'movement') return parseInt(b.movement) - parseInt(a.movement);
    return a.rank - b.rank;
  });

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-emerald-500">
        <div className="text-[10px] font-mono text-emerald-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Which properties are winning, losing, and where would yours rank?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Performance Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">142 properties | Atlanta MSA</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {VITALS.map(vital => (
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
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-emerald-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
        <p className="text-sm text-emerald-900">
          Tracking <strong>142 properties</strong> across Atlanta MSA submarkets. Average PCS score trending upward at <strong>+2.1 QoQ</strong>. High rank churn (±3.2 positions/month) indicates active competitive repositioning. Top quartile separation widening — performance gap between leaders and laggards growing.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">PCS Score Components</h3>
        <p className="text-sm text-stone-500 mb-4">Five weighted components that compose the Performance Composite Score</p>
        <div className="grid grid-cols-2 gap-4">
          {SCORE_COMPONENTS.map((comp, i) => (
            <div key={i} className={`border border-stone-200 rounded-lg p-4 ${i === 4 ? 'col-span-2' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-900">{comp.name}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">{comp.weight}</span>
                </div>
                <span className="text-[10px] font-mono text-stone-400">{comp.source}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {comp.metrics.map((m, j) => (
                  <span key={j} className="text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded">{m}</span>
                ))}
              </div>
              <pre className="font-mono text-[10px] leading-relaxed rounded-lg p-3 bg-stone-900 text-emerald-400 overflow-x-auto whitespace-pre-wrap break-words">
                {comp.formula}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Ranking Outputs</h3>
        <p className="text-sm text-stone-500 mb-4">Three views into property performance rankings</p>
        <div className="grid grid-cols-3 gap-4">
          {RANKING_OUTPUTS.map((output, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-stone-900 mb-2">{output.name}</h4>
              <p className="text-xs text-stone-600 leading-relaxed mb-3">{output.description}</p>
              <div className="bg-stone-50 rounded-lg p-2.5">
                <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-1">DISPLAY FORMAT</div>
                <p className="text-[11px] text-stone-500 leading-relaxed">{output.display}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Submarket Power Rankings</h3>
            <p className="text-sm text-stone-500">Mock ranking data — Atlanta MSA, all classes</p>
          </div>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            <button onClick={() => setSortField('rank')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'rank' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Rank</button>
            <button onClick={() => setSortField('pcs')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'pcs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By PCS</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">RANK</th>
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY NAME</th>
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PCS SCORE</th>
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">MOVEMENT</th>
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">CLASS</th>
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">SUBMARKET</th>
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map((row) => {
                const rankStyle = getRankColor(row.rank, MOCK_RANKINGS.length);
                const mvmt = getMovementDisplay(row.movementDir, row.movement);
                return (
                  <tr key={row.rank} className="border-t border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rankStyle}`}>
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{row.pcs}</span>
                        <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.pcs}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${mvmt.color}`}>
                        {mvmt.icon} {row.movement}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded">{row.class}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">{row.submarket}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-50 border border-emerald-200 inline-block" /> Top 25%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-50 border border-amber-200 inline-block" /> Middle 50%</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-50 border border-red-200 inline-block" /> Bottom 25%</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceRankingsPage;
