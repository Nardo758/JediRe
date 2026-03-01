import React from 'react';

const ACQUISITION_VITALS = [
  { id: 'underperformers', label: 'Underperformers Detected', value: '23', trend: '+4 this quarter', trendDirection: 'up' as const, sparklineData: [12, 14, 15, 16, 18, 17, 19, 20, 21, 19, 22, 23] },
  { id: 'perf-gap', label: 'Avg Performance Gap', value: '14.2', trend: 'ranks below expected', trendDirection: 'up' as const, sparklineData: [9, 10, 11, 10, 12, 13, 11, 12, 13, 14, 13, 14] },
  { id: 'maturing-debt', label: 'Maturing Debt (18mo)', value: '9', trend: '3 HIGH urgency', trendDirection: 'up' as const, sparklineData: [4, 5, 5, 6, 7, 6, 7, 8, 7, 8, 9, 9] },
  { id: 'portfolio-targets', label: 'Portfolio Targets', value: '6', trend: '+2 new entities', trendDirection: 'up' as const, sparklineData: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6] },
  { id: 'hold-period', label: 'Avg Hold Period (yrs)', value: '6.3', trend: 'Fund exit pressure', trendDirection: 'up' as const, sparklineData: [4.8, 5.0, 5.2, 5.4, 5.5, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.3] },
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

const AcquisitionIntelPage: React.FC = () => {
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
