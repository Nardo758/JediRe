import React from 'react';

const FLYWHEEL_VITALS = [
  { id: 'deals-archived', label: 'Deals Archived', value: '847', trend: '+34 this quarter', trendDirection: 'up' as const, sparklineData: [620, 650, 680, 700, 720, 740, 760, 780, 800, 820, 835, 847] },
  { id: 'data-points', label: 'Data Points Captured', value: '42K', trend: '+3.2K/mo avg', trendDirection: 'up' as const, sparklineData: [24, 27, 29, 31, 33, 35, 36, 38, 39, 40, 41, 42] },
  { id: 'assumption-accuracy', label: 'Assumption Accuracy', value: '84%', trend: '+2.1pp YoY', trendDirection: 'up' as const, sparklineData: [72, 74, 75, 76, 78, 79, 80, 81, 82, 83, 83, 84] },
  { id: 'win-rate', label: 'Win Rate', value: '26%', trend: '+3pp vs baseline', trendDirection: 'up' as const, sparklineData: [18, 19, 20, 21, 22, 22, 23, 24, 24, 25, 25, 26] },
  { id: 'records-monitored', label: 'Records Monitored', value: '12.4K', trend: '+1.8K this month', trendDirection: 'up' as const, sparklineData: [6.2, 7.0, 7.8, 8.4, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.4] },
];

const WHAT_TO_CAPTURE = [
  { field: 'Deal snapshot at underwriting', data: 'All Deal Capsule data frozen at time of analysis — price, rents, occupancy, market conditions, traffic scores' },
  { field: 'Underwriting assumptions', data: 'Rent growth, exit cap, hold period, CapEx budget, management fee, vacancy assumption, debt terms' },
  { field: 'Strategy selected', data: 'Which of the 4 strategies was chosen and why (Strategy Arbitrage output)' },
  { field: 'Outcome (if tracked)', data: 'Did the user win the deal? At what price? If lost — to whom and at what premium?' },
  { field: 'Post-acquisition actuals', data: 'If owned — monthly actuals vs underwritten projections' },
];

const INTELLIGENCE_OUTPUTS = [
  { title: 'Assumption Benchmarks', quote: 'The average user underwriting Class B value-add in this submarket assumes 3.2% rent growth. Actual achieved: 4.1%. Your assumptions may be conservative.' },
  { title: 'Bid-to-Win Analysis', quote: 'Of 47 deals underwritten in this submarket last year, 12 were won. Average winning premium over initial underwrite: 7.3%.' },
  { title: 'Outcome Validation', quote: 'Properties with TOS > 70 at underwriting achieved an average 18.2% IRR vs 12.4% for TOS < 40.' },
  { title: 'Strategy Accuracy', quote: 'Strategy Arbitrage recommended BTS over Rental for 23 deals. The 8 that followed the BTS recommendation averaged 22% IRR vs 14% for those that chose Rental.' },
];

const PROPERTY_RECORDS = [
  {
    category: 'Supply Intelligence',
    signals: [
      { signal: 'New plat recordings', insight: 'Land being subdivided = development intent. Track by trade area to quantify future supply before permits are filed.' },
      { signal: 'Zoning change petitions', insight: 'Rezoning requests attached to specific parcels = early development signal.' },
      { signal: 'Demolition permits', insight: 'Existing structures being torn down = replacement supply coming.' },
      { signal: 'Certificate of Occupancy filings', insight: 'New units actually entering market. The real supply impact date.' },
    ],
  },
  {
    category: 'Future Supply Prediction',
    signals: [
      { signal: 'Land sale patterns', insight: 'When land parcels transact at prices implying multifamily development ($50K+/unit buildable), developers are planning.' },
      { signal: 'Impact fee payments', insight: 'Spike in impact fee revenue = confirmed construction pipeline 12-24 months out.' },
      { signal: 'Utility connection applications', insight: 'Water/sewer connection requests for large-scale residential = confirmed development.' },
    ],
  },
  {
    category: 'Business & Investment Opportunities',
    signals: [
      { signal: 'Foreclosure filings / lis pendens', insight: 'Rising foreclosures = distress inventory becoming available. Early notice — foreclosure takes 6-18 months in FL.' },
      { signal: 'Estate / probate transfers', insight: 'Inherited properties often sell below market. Track probate filings for multifamily parcels.' },
      { signal: 'Code enforcement liens', insight: 'Accumulated code violation liens = distressed operator who may welcome a buyout.' },
    ],
  },
  {
    category: 'Market Timing Intelligence',
    signals: [
      { signal: 'Transaction velocity by submarket', insight: 'Track monthly sales volume. Accelerating transactions = market heating up. Decelerating = cooling.' },
      { signal: 'Price per unit trends', insight: 'Actual sale prices per unit derived from documentary stamps. More accurate than asking prices.' },
      { signal: 'Holding period patterns', insight: 'Average hold period shortening = operators taking profits. Lengthening = holding through downturns.' },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Supply Intelligence': 'border-l-emerald-500',
  'Future Supply Prediction': 'border-l-blue-500',
  'Business & Investment Opportunities': 'border-l-amber-500',
  'Market Timing Intelligence': 'border-l-violet-500',
};

const DataFlywheelPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-pink-500">
        <div className="text-[10px] font-mono text-pink-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How does every deal you touch make the platform smarter?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Flywheel Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">Platform-wide intelligence</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {FLYWHEEL_VITALS.map(vital => (
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
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-pink-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-pink-50 border border-pink-200 rounded-xl px-5 py-3">
        <p className="text-sm text-pink-900">
          847 deals archived across all markets. Data flywheel capturing 42K+ data points — assumption accuracy improved to <strong>84%</strong> through outcome validation. Win rate lifted +3pp above baseline through bid intelligence. 12.4K property records actively monitored for supply and distress signals.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Underwriting Archive</h3>
        <p className="text-sm text-stone-500 mb-4">Every deal underwritten feeds the intelligence engine — win or lose, the data is gold</p>

        <div className="mb-6">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-3">WHAT TO CAPTURE</div>
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50">
                  <th className="text-left px-4 py-2 text-[10px] font-mono text-stone-500 tracking-wider">FIELD</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono text-stone-500 tracking-wider">DATA CAPTURED</th>
                </tr>
              </thead>
              <tbody>
                {WHAT_TO_CAPTURE.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                    <td className="px-4 py-3 font-semibold text-stone-800 text-xs w-1/4">{row.field}</td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{row.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-3">INTELLIGENCE OUTPUTS</div>
          <div className="grid grid-cols-2 gap-4">
            {INTELLIGENCE_OUTPUTS.map((output, i) => (
              <div key={i} className="bg-pink-50 border border-pink-100 rounded-lg p-4">
                <div className="text-xs font-bold text-pink-800 mb-2">{output.title}</div>
                <p className="text-xs text-pink-700 italic">"{output.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Property Records Intelligence</h3>
        <p className="text-sm text-stone-500 mb-5">County property records contain massive intelligence beyond ownership — systematically mining them derives supply signals, predictions, and market timing</p>

        <div className="space-y-6">
          {PROPERTY_RECORDS.map((category, ci) => (
            <div key={ci}>
              <div className="text-xs font-bold text-stone-800 mb-3 flex items-center gap-2">
                <span className={`w-1 h-4 rounded-full ${CATEGORY_COLORS[category.category] ? CATEGORY_COLORS[category.category].replace('border-l-', 'bg-') : 'bg-stone-400'}`} />
                {category.category}
              </div>
              <div className="space-y-2">
                {category.signals.map((s, si) => (
                  <div key={si} className={`border-l-2 ${CATEGORY_COLORS[category.category] || 'border-l-stone-300'} bg-stone-50 rounded-r-lg px-4 py-3`}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-stone-800">{s.signal}</div>
                        <div className="text-xs text-stone-600 mt-1">{s.insight}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DataFlywheelPage;
