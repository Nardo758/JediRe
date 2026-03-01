import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACQUISITION_VITALS = [
  { id: 'underperformers', label: 'Underperformers Detected', value: '23', trend: '+4 this quarter', trendDirection: 'up' as const, sparklineData: [12, 14, 15, 16, 18, 17, 19, 20, 21, 19, 22, 23] },
  { id: 'perf-gap', label: 'Avg Performance Gap', value: '14.2', trend: 'ranks below expected', trendDirection: 'up' as const, sparklineData: [9, 10, 11, 10, 12, 13, 11, 12, 13, 14, 13, 14] },
  { id: 'maturing-debt', label: 'Maturing Debt (18mo)', value: '9', trend: '3 HIGH urgency', trendDirection: 'up' as const, sparklineData: [4, 5, 5, 6, 7, 6, 7, 8, 7, 8, 9, 9] },
  { id: 'portfolio-targets', label: 'Portfolio Targets', value: '6', trend: '+2 new entities', trendDirection: 'up' as const, sparklineData: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6] },
  { id: 'hold-period', label: 'Avg Hold Period (yrs)', value: '6.3', trend: 'Fund exit pressure', trendDirection: 'up' as const, sparklineData: [4.8, 5.0, 5.2, 5.4, 5.5, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.3] },
];

const ACQUISITION_TARGETS = [
  { rank: 1, name: 'Sunset Ridge Apartments', units: 248, class: 'B', submarket: 'Sandy Springs', actualRank: 34, expectedRank: 12, performanceGap: 22, gapSeverity: 'SEVERE' as const, owner: 'PSL Ventures LLC', purchaseYear: 2019, holdYears: 7, estDebtMaturity: 'Q2 2026', debtUrgency: 'HIGH' as const, estValueAdd: '$2.8M', signals: ['Debt Maturity', 'Hold Stress', 'Low PCS'], quadrant: 'Hidden Gem' },
  { rank: 2, name: 'Lakewood Crossing', units: 312, class: 'B-', submarket: 'Lakewood', actualRank: 38, expectedRank: 15, performanceGap: 23, gapSeverity: 'SEVERE' as const, owner: 'Greystone Capital Partners', purchaseYear: 2020, holdYears: 6, estDebtMaturity: 'Q4 2026', debtUrgency: 'HIGH' as const, estValueAdd: '$3.4M', signals: ['Debt Maturity', 'Mgmt Underperformance', 'Tax Delinquent'], quadrant: 'Dead Weight' },
  { rank: 3, name: 'Cascade Falls Residences', units: 186, class: 'B', submarket: 'Cascade', actualRank: 29, expectedRank: 11, performanceGap: 18, gapSeverity: 'SEVERE' as const, owner: 'Horizon Multifamily Fund III', purchaseYear: 2019, holdYears: 7, estDebtMaturity: 'Q1 2027', debtUrgency: 'HIGH' as const, estValueAdd: '$2.1M', signals: ['Hold Stress', 'Fund Exit Window', 'Review Decline'], quadrant: 'Hidden Gem' },
  { rank: 4, name: 'Peachtree Creek Landing', units: 420, class: 'B+', submarket: 'Buckhead', actualRank: 22, expectedRank: 6, performanceGap: 16, gapSeverity: 'SEVERE' as const, owner: 'Trident RE Holdings LLC', purchaseYear: 2018, holdYears: 8, estDebtMaturity: 'Q3 2026', debtUrgency: 'MODERATE' as const, estValueAdd: '$5.2M', signals: ['Hold Stress', 'Portfolio Non-Core', 'Amenity Gap'], quadrant: 'Hidden Gem' },
  { rank: 5, name: 'East Point Village', units: 156, class: 'C+', submarket: 'East Point', actualRank: 31, expectedRank: 19, performanceGap: 12, gapSeverity: 'SEVERE' as const, owner: 'Metro South Properties LLC', purchaseYear: 2017, holdYears: 9, estDebtMaturity: 'Q2 2027', debtUrgency: 'MODERATE' as const, estValueAdd: '$1.6M', signals: ['Mgmt Underperformance', 'Deferred Maintenance'], quadrant: 'Dead Weight' },
  { rank: 6, name: 'Brookhaven Station Apts', units: 278, class: 'B+', submarket: 'Brookhaven', actualRank: 18, expectedRank: 9, performanceGap: 9, gapSeverity: 'MODERATE' as const, owner: 'Cornerstone Residential LLC', purchaseYear: 2020, holdYears: 6, estDebtMaturity: 'Q1 2028', debtUrgency: 'LOW' as const, estValueAdd: '$2.4M', signals: ['Hold Stress', 'Amenity Gap'], quadrant: 'Hidden Gem' },
  { rank: 7, name: 'Decatur Heights', units: 198, class: 'B', submarket: 'Decatur', actualRank: 25, expectedRank: 17, performanceGap: 8, gapSeverity: 'MODERATE' as const, owner: 'Redwood Apartment Group', purchaseYear: 2021, holdYears: 5, estDebtMaturity: 'Q3 2028', debtUrgency: 'LOW' as const, estValueAdd: '$1.8M', signals: ['Review Decline', 'Traffic Drop'], quadrant: 'Hype Risk' },
  { rank: 8, name: 'College Park Commons', units: 224, class: 'C', submarket: 'College Park', actualRank: 36, expectedRank: 28, performanceGap: 8, gapSeverity: 'MODERATE' as const, owner: 'Southside Investment Group', purchaseYear: 2016, holdYears: 10, estDebtMaturity: 'Q4 2026', debtUrgency: 'HIGH' as const, estValueAdd: '$1.9M', signals: ['Debt Maturity', 'Hold Stress', 'Tax Delinquent'], quadrant: 'Dead Weight' },
  { rank: 9, name: 'Vinings Creek Terrace', units: 168, class: 'B', submarket: 'Vinings', actualRank: 20, expectedRank: 14, performanceGap: 6, gapSeverity: 'MODERATE' as const, owner: 'Atlas Residential Partners', purchaseYear: 2022, holdYears: 4, estDebtMaturity: 'Q2 2029', debtUrgency: 'LOW' as const, estValueAdd: '$1.3M', signals: ['Mgmt Underperformance'], quadrant: 'Hidden Gem' },
  { rank: 10, name: 'Westside Lofts', units: 142, class: 'B-', submarket: 'Westside', actualRank: 27, expectedRank: 22, performanceGap: 5, gapSeverity: 'SLIGHT' as const, owner: 'Urban Core Ventures LLC', purchaseYear: 2021, holdYears: 5, estDebtMaturity: 'Q1 2029', debtUrgency: 'LOW' as const, estValueAdd: '$0.9M', signals: ['Amenity Gap'], quadrant: 'Hidden Gem' },
];

const DATA_SOURCES = [
  { source: 'County Property Appraiser / Tax Records', data: ['Current owner name/entity', 'Purchase date and price', 'Assessed value', 'Tax payment history (delinquent = distress signal)', 'Ownership chain (holding period)'] },
  { source: 'UCC Filings / Mortgage Records', data: ['Lender name', 'Original loan amount', 'Recording date', 'Loan term (derive maturity date)', 'Second liens / mezzanine debt'] },
  { source: 'Secretary of State / Entity Records', data: ['LLC/Corp registration', 'Registered agent', 'Officers/members', 'Related entities (same agent = portfolio owner)', 'Entity status'] },
  { source: 'CMBS / Securitization Data', data: ['Servicer name', 'DSCR and LTV at origination', 'Watchlist status', 'Special servicing transfer', 'Loan maturity date (exact)'] },
];

const DERIVED_SIGNALS = [
  { signal: 'Debt Maturity Window', insight: 'Properties with debt maturing in 6–18 months face refinancing risk, especially in high-rate environments. If current DSCR has deteriorated, refinancing may require equity injection — creating seller motivation.' },
  { signal: 'Holding Period Stress', insight: 'Funds typically have 5–7 year hold periods. A property purchased in 2019–2020 is now at year 6–7 — fund managers may need to exit regardless of market conditions.' },
  { signal: 'Owner Portfolio Pattern', insight: 'If the same registered agent appears on 15 LLCs, that is a portfolio operator. If 3 of their 15 properties are underperforming, they may be willing to trade non-core assets.' },
  { signal: 'Management Company Performance', insight: 'Some management companies consistently underperform. Properties managed by bottom-quartile managers → instant acquisition watchlist.' },
];

const GAP_COLORS = {
  SEVERE: 'bg-red-100 text-red-700 border-red-200',
  MODERATE: 'bg-amber-100 text-amber-700 border-amber-200',
  SLIGHT: 'bg-stone-100 text-stone-600 border-stone-200',
} as const;

const URGENCY_COLORS = {
  HIGH: 'bg-red-100 text-red-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  LOW: 'bg-emerald-100 text-emerald-700',
} as const;

const QUADRANT_COLORS: Record<string, string> = {
  'Hidden Gem': 'bg-emerald-100 text-emerald-700',
  'Dead Weight': 'bg-stone-200 text-stone-600',
  'Hype Risk': 'bg-red-100 text-red-600',
  'Validated Winner': 'bg-blue-100 text-blue-700',
};

const AcquisitionIntelPage: React.FC = () => {
  const [sortField, setSortField] = useState<'rank' | 'gap' | 'urgency'>('rank');

  const sortedTargets = [...ACQUISITION_TARGETS].sort((a, b) => {
    if (sortField === 'gap') return b.performanceGap - a.performanceGap;
    if (sortField === 'urgency') {
      const urgencyOrder = { HIGH: 0, MODERATE: 1, LOW: 2 };
      return urgencyOrder[a.debtUrgency] - urgencyOrder[b.debtUrgency];
    }
    return a.rank - b.rank;
  });

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-blue-500">
        <div className="text-[10px] font-mono text-blue-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Who's underperforming, who owns it, and when does their debt mature?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Acquisition Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">23 targets | Atlanta MSA</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {ACQUISITION_VITALS.map(vital => (
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
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-blue-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
        <p className="text-sm text-blue-900">
          Tracking 23 underperforming properties across Atlanta MSA. <strong>9 properties</strong> have debt maturing within 18 months, with 3 flagged as HIGH urgency acquisition windows. 6 portfolio entities identified with non-core assets available for trade.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Acquisition Targets</h3>
            <p className="text-sm text-stone-500">Top 10 underperforming properties ranked by acquisition priority</p>
          </div>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            <button onClick={() => setSortField('rank')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'rank' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Priority</button>
            <button onClick={() => setSortField('gap')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'gap' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Gap</button>
            <button onClick={() => setSortField('urgency')} className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors ${sortField === 'urgency' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>By Urgency</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider w-12"></th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PERFORMANCE GAP</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">OWNER INTELLIGENCE</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">DEBT SIGNAL</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">VALUE-ADD</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">SIGNALS</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody>
              {sortedTargets.map((target) => (
                <tr key={target.rank} className="border-t border-stone-100 hover:bg-blue-50/30 transition-colors">
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                      {target.rank}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-stone-900 text-xs">{target.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-stone-500">{target.units} units</span>
                      <span className="text-[10px] text-stone-300">·</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0 rounded ${target.class.startsWith('A') ? 'bg-blue-50 text-blue-600' : target.class.startsWith('B') ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>{target.class}</span>
                      <span className="text-[10px] text-stone-300">·</span>
                      <span className="text-[10px] text-stone-500">{target.submarket}</span>
                    </div>
                    <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${QUADRANT_COLORS[target.quadrant] || 'bg-stone-100 text-stone-500'}`}>{target.quadrant}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-xs text-stone-700">
                      <span className="font-mono">#{target.actualRank}</span>
                      <span className="text-stone-400">→</span>
                      <span className="font-mono font-bold">#{target.expectedRank}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-14 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${target.gapSeverity === 'SEVERE' ? 'bg-red-500' : target.gapSeverity === 'MODERATE' ? 'bg-amber-500' : 'bg-stone-400'}`} style={{ width: `${Math.min(100, (target.performanceGap / 25) * 100)}%` }} />
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${GAP_COLORS[target.gapSeverity]}`}>
                        {target.gapSeverity} ({target.performanceGap})
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-medium text-stone-900">{target.owner}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Acquired {target.purchaseYear} · {target.holdYears}yr hold
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-mono text-stone-700">{target.estDebtMaturity}</div>
                    <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${URGENCY_COLORS[target.debtUrgency]}`}>
                      {target.debtUrgency}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm font-bold text-emerald-700">{target.estValueAdd}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {target.signals.map((sig, j) => (
                        <span key={j} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{sig}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => console.log('Navigate to Comp Analysis for target:', target.name)}
                      className="px-2.5 py-1.5 bg-violet-100 text-violet-700 rounded text-[10px] font-bold hover:bg-violet-200 transition-colors whitespace-nowrap"
                    >
                      Comps
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-5 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-1 rounded-full bg-red-500 inline-block" /> SEVERE gap (&gt;10 ranks)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1 rounded-full bg-amber-500 inline-block" /> MODERATE gap (5–10)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1 rounded-full bg-stone-400 inline-block" /> SLIGHT gap (&lt;5)</span>
          <span className="ml-4 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-100 border border-red-200 inline-block" /> HIGH urgency debt</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-100 border border-amber-200 inline-block" /> MODERATE</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-100 border border-emerald-200 inline-block" /> LOW</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Underperformer Detection Algorithm</h3>
        <p className="text-sm text-stone-500 mb-4">
          Compare each property's actual PCS to its EXPECTED PCS based on location advantages. A property ranked #30 that SHOULD be ranked #8 has a performance gap of 22 ranks — that gap equals your value-add opportunity.
        </p>
        <div className="bg-stone-900 rounded-lg p-4 font-mono text-sm text-stone-300 overflow-x-auto">
          <pre className="whitespace-pre-wrap">{`EXPECTED_RANK = model(
  traffic_position_index,    // Location quality from M07
  year_built,                // Physical quality baseline
  unit_count,                // Scale advantages
  amenity_set,               // Feature completeness
  submarket_avg_rent,        // Market ceiling
  frontage_quality           // Visibility/access
)

PERFORMANCE_GAP = EXPECTED_RANK - ACTUAL_RANK
  → Gap > 10 ranks: SEVERE underperformance — strong acquisition target
  → Gap 5-10 ranks: MODERATE underperformance — investigate management/condition
  → Gap 0-5 ranks: SLIGHT underperformance — normal variance
  → Gap < 0: OUTPERFORMING expectations — premium pricing likely justified`}</pre>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Vantage Group Targeting</h3>
        <p className="text-sm text-stone-500 mb-4">
          Instead of looking at ALL underperformers, find which vantage group is performing best, then target underperformers within that group.
        </p>
        <div className="space-y-3">
          {[
            'Rank all vantage groups by average PCS → identify the top-performing group',
            'Within that group, identify properties in bottom quartile (underperformers in a winning category)',
            'Cross-reference with T-04 quadrant → Hidden Gems in a top vantage group = PRIORITY TARGETS',
            'Score targets: (vantage_group_strength × performance_gap × traffic_arbitrage_ratio)',
            'Output: Ranked list of acquisition targets with estimated value-add potential in dollars',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</div>
              <div className="text-sm text-stone-700 pt-1">{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Ownership & Debt Intelligence</h3>
        <p className="text-sm text-stone-500 mb-4">
          For every identified target, build a complete ownership profile. The most actionable deals combine an underperforming property with a motivated seller.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 pr-4 text-[10px] font-mono text-stone-400 tracking-wider">DATA SOURCE</th>
                <th className="text-left py-2 text-[10px] font-mono text-stone-400 tracking-wider">DATA POINTS</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((source, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-3 pr-4 font-semibold text-stone-800 align-top whitespace-nowrap">{source.source}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {source.data.map((d, j) => (
                        <span key={j} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{d}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Derived Intelligence Signals</h3>
        <p className="text-sm text-stone-500 mb-4">
          Actionable signals derived from combining ownership, debt, and performance data.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {DERIVED_SIGNALS.map((item, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h4 className="text-sm font-bold text-stone-900">{item.signal}</h4>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{item.insight}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AcquisitionIntelPage;
