import React, { useState } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';

interface DealsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

const DealsTab: React.FC<DealsTabProps> = ({ marketId, summary, onUpdate }) => {
  const [expandedPipeline, setExpandedPipeline] = useState(false);

  const featuredDeal = {
    rank: 1,
    name: 'PINES AT MIDTOWN',
    units: 180,
    year: 1992,
    class: 'B',
    submarket: 'Midtown',
    jedi: 92,
    strategy: 'Value-Add Flip',
    arbSpread: '+7.4%',
    lossToLease: '$220/unit',
    ltlPct: '14.8%',
    sellerMotivation: 78,
    holdYears: 6.9,
    demandScore: 82,
    clusterDistance: '0.8mi',
    walkIns: '1,840/week',
    trafficCorrelation: 'High physical, low digital',
    captureRate: '12.4%',
    trafficShare: '8.2%',
    supplyDemandRatio: 1.18,
    compSetCount: 12,
    compSetAvgRent: '$1,720',
    confidence: '82%',
  };

  const compactDeals = [
    { rank: 2, name: 'BROOKHAVEN TERRACE', units: 240, year: 1998, class: 'B+', submarket: 'Brookhaven', jedi: 87, strategy: 'Core-Plus Hold', ltl: '$180/unit', walkIns: '2,100/wk', trafficShare: '6.8%' },
    { rank: 3, name: 'DECATUR STATION', units: 156, year: 1985, class: 'C+', submarket: 'Decatur', jedi: 84, strategy: 'Heavy Value-Add', ltl: '$290/unit', walkIns: '1,420/wk', trafficShare: '9.1%' },
    { rank: 4, name: 'SANDY SPRINGS CROSSING', units: 312, year: 2001, class: 'B+', submarket: 'Sandy Springs', jedi: 81, strategy: 'Value-Add Flip', ltl: '$155/unit', walkIns: '2,680/wk', trafficShare: '5.4%' },
  ];

  const kanbanColumns = [
    {
      stage: 'INTAKE', count: 3, color: 'bg-gray-50', headerColor: 'bg-gray-600',
      deals: [
        { name: 'Midtown 440', units: 220, class: 'A-', jedi: 74, days: '3d' },
        { name: 'Buckhead Place', units: 180, class: 'B+', jedi: 71, days: '5d' },
        { name: 'Westside Lofts', units: 96, class: 'B', jedi: 68, days: '1d' },
      ],
    },
    {
      stage: 'SCREENING', count: 2, color: 'bg-blue-50', headerColor: 'bg-blue-600',
      deals: [
        { name: 'Peachtree Walk', units: 310, class: 'B+', jedi: 82, days: '12d' },
        { name: 'Cascade Heights', units: 144, class: 'C+', jedi: 76, days: '8d' },
      ],
    },
    {
      stage: 'ANALYSIS', count: 1, color: 'bg-amber-50', headerColor: 'bg-amber-600',
      deals: [
        { name: 'Heritage Oaks', units: 280, class: 'B', jedi: 85, days: '22d', omVariance: '-8.2%' },
      ],
    },
    {
      stage: 'EXECUTION', count: 1, color: 'bg-green-50', headerColor: 'bg-green-600',
      deals: [
        { name: 'Summit Creek', units: 196, class: 'B+', jedi: 88, days: '45d' },
      ],
    },
  ];

  const dealActivityRows = [
    { property: 'Parkside at Buckhead', type: 'Listed', units: 280, price: '$52.4M', perUnit: '$187K', assessment: '⚠️ S-05 cluster risk — 3 deliveries within 0.5mi by Q3 2026' },
    { property: 'The Vue at Midtown', type: 'Listed', units: 196, price: '$38.2M', perUnit: '$195K', assessment: '✅ Strong fundamentals — D-09: 84, low supply, T-01 validated' },
    { property: 'Glenwood Gardens', type: 'Closed', units: 320, price: '$64.0M', perUnit: '$200K', assessment: '✅ Fair price — within 3% of AI estimate, good basis' },
    { property: 'Cascade Pointe', type: 'Closed', units: 148, price: '$24.4M', perUnit: '$165K', assessment: '⚠️ Buyer overpaid by ~$12K/unit vs AI comp model' },
  ];

  const arbitrageRows = [
    { property: 'PINES AT MIDTOWN', bestStrategy: 'Value-Add Flip', bestIRR: '18.4%', secondBest: 'Core-Plus Hold', secondIRR: '11.0%', spread: '7.4%' },
    { property: 'BROOKHAVEN TERRACE', bestStrategy: 'STR Hybrid', bestIRR: '16.2%', secondBest: 'Value-Add', secondIRR: '12.8%', spread: '3.4%' },
    { property: 'DECATUR STATION', bestStrategy: 'Heavy Reno Flip', bestIRR: '22.1%', secondBest: 'Value-Add Hold', secondIRR: '14.6%', spread: '7.5%' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Active Opportunities + Pipeline</h2>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.market?.display_name || marketId} — 26 outputs across deal intelligence
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <span className="text-lg">+</span>
            New Deal
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">AI-Recommended Opportunities</h3>
          <p className="text-sm text-gray-500 mt-0.5">JEDI identified 142 opportunities. Showing top 4:</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="border-2 border-amber-300 bg-amber-50/30 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🏆</span>
                  <span className="font-bold text-gray-900 text-lg">#{featuredDeal.rank} {featuredDeal.name}</span>
                  <span className="text-sm text-gray-500">| {featuredDeal.units}u | {featuredDeal.year} | {featuredDeal.class} | {featuredDeal.submarket}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">JEDI: {featuredDeal.jedi} (C-01)</span>
                  <span className="text-gray-600">Strategy: {featuredDeal.strategy} (C-05: {featuredDeal.arbSpread} arb)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 mb-4">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">WHY THIS PROPERTY:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-sm">
                <div className="text-gray-700">• Loss-to-Lease: {featuredDeal.lossToLease} (P-03) — {featuredDeal.ltlPct} below market</div>
                <div className="text-gray-700">• Seller Motivation: {featuredDeal.sellerMotivation}/100 (P-05) — {featuredDeal.holdYears}yr hold, debt likely</div>
                <div className="text-gray-700">• Demand: D-09 = {featuredDeal.demandScore}, {featuredDeal.submarket} surging</div>
                <div className="text-gray-700">• Low Cluster Risk: S-05 = nearest delivery is {featuredDeal.clusterDistance} away</div>
                <div className="text-blue-700 font-medium">★ Walk-Ins: {featuredDeal.walkIns} (T-01) — strong foot traffic</div>
                <div className="text-blue-700 font-medium">★ Hidden Gem: T-04 = {featuredDeal.trafficCorrelation} (undiscovered)</div>
                <div className="text-blue-700 font-medium">★ Capture Rate: {featuredDeal.captureRate} (T-06) — good corner visibility</div>
                <div className="text-blue-700 font-medium">★ Traffic Share: {featuredDeal.trafficShare} of submarket (T-09) — above avg for {featuredDeal.class}</div>
                <div className="text-blue-700 font-medium">★ Trade Area: {featuredDeal.supplyDemandRatio} supply-demand ratio (TA-03) — undersupplied</div>
                <div className="text-blue-700 font-medium">★ Competitive Set: {featuredDeal.compSetCount} props, avg rent {featuredDeal.compSetAvgRent} (TA-02)</div>
                <div className="text-blue-700 font-medium">★ Confidence: {featuredDeal.confidence} (T-10) — validated model</div>
              </div>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-sm">🤖</span>
                <p className="text-sm text-violet-800 italic">
                  "Hidden Gem classification — strong physical traffic but low digital presence means institutional buyers haven't found this yet. $220/unit LTL with motivated seller = act fast."
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Add to Pipeline</button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Run Pro Forma</button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">View Owner</button>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Strategy Arb</button>
            </div>
          </div>

          {compactDeals.map((deal) => (
            <div key={deal.rank} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500">#{deal.rank}</span>
                  <span className="font-semibold text-gray-900">{deal.name}</span>
                  <span className="text-sm text-gray-500">{deal.units}u | {deal.year} | {deal.class} | {deal.submarket}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">JEDI {deal.jedi}</span>
                  <span className="text-gray-500">LTL: {deal.ltl}</span>
                  <span className="text-blue-600">★ {deal.walkIns}</span>
                  <span className="text-blue-600">★ Share: {deal.trafficShare}</span>
                  <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{deal.strategy}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-4">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">OPPORTUNITY ALGORITHM</p>
            <p className="text-xs text-gray-500">
              Score = 0.25 × C-01 (JEDI) + 0.15 × P-03 (LTL) + 0.15 × P-05 (Motivation) + 0.10 × D-09 (Demand) + 0.10 × T-01 (Walk-Ins) + 0.05 × T-04 (Hidden Gem) + 0.05 × T-06 (Capture) + 0.05 × T-09 (Traffic Share) + 0.05 × TA-03 (Supply-Demand) + 0.05 × S-05 (Cluster Risk, inverted). Confidence weighted by T-10.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">My Pipeline</h3>
          <p className="text-sm text-gray-500 mt-0.5">Kanban — stage-specific metrics per deal</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-4 gap-4">
            {kanbanColumns.map((col) => (
              <div key={col.stage} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className={`${col.headerColor} px-3 py-2 flex items-center justify-between`}>
                  <span className="text-sm font-bold text-white">{col.stage}</span>
                  <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{col.count}</span>
                </div>
                <div className={`${col.color} p-3 space-y-2 min-h-[180px]`}>
                  {col.deals.map((deal, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                      <p className="text-sm font-medium text-gray-900">{deal.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{deal.units}u</span>
                        <span>·</span>
                        <span>{deal.class}</span>
                        <span>·</span>
                        <span className="font-bold text-blue-700">JEDI {deal.jedi}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-gray-400">{deal.days} in stage</span>
                        {(deal as any).omVariance && (
                          <span className="text-[11px] font-bold text-red-600">C-04: {(deal as any).omVariance}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Market Deal Activity</h3>
          <p className="text-sm text-gray-500 mt-0.5">Recent transactions and AI assessments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Property</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Units</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Price</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">$/Unit</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">AI Assessment</th>
              </tr>
            </thead>
            <tbody>
              {dealActivityRows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.type === 'Listed' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.units}</td>
                  <td className="px-4 py-3 text-gray-600">{row.price}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.perUnit}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{row.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Strategy Arbitrage Leaderboard</h3>
              <p className="text-sm text-gray-500 mt-0.5">Ranked by IRR spread between best and second-best strategy</p>
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">★ NEW: T-01, T-09 inform strategy selection</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Property</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Best Strategy</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">IRR</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">2nd Best</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">IRR</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Spread</th>
              </tr>
            </thead>
            <tbody>
              {arbitrageRows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{row.bestStrategy}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600">{row.bestIRR}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{row.secondBest}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.secondIRR}</td>
                  <td className="px-4 py-3 font-bold text-amber-600">{row.spread}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DealsTab;
