import React from 'react';

const RANK_ME_VITALS = [
  { id: 'target-rank', label: 'Target Rank', value: '#2', trend: 'User-selected goal', trendDirection: 'neutral' as const, sparklineData: [14, 14, 13, 12, 11, 10, 9, 8, 6, 5, 3, 2] },
  { id: 'current-rank', label: 'Current Rank', value: '#14', trend: 'Baseline position', trendDirection: 'neutral' as const, sparklineData: [18, 17, 16, 16, 15, 15, 14, 14, 14, 14, 14, 14] },
  { id: 'pcs-gap', label: 'PCS Gap', value: '38 pts', trend: 'Score delta to target', trendDirection: 'down' as const, sparklineData: [52, 50, 48, 46, 44, 42, 41, 40, 39, 39, 38, 38] },
  { id: 'capex-required', label: 'Est. CapEx Required', value: '$1.2M', trend: 'Over 18 months', trendDirection: 'neutral' as const, sparklineData: [0, 100, 200, 350, 500, 650, 780, 900, 1000, 1080, 1150, 1200] },
  { id: 'irr-lift', label: 'Projected IRR Lift', value: '+5.5pp', trend: '14.2% → 19.7%', trendDirection: 'up' as const, sparklineData: [14, 14, 14, 15, 15, 16, 17, 17, 18, 19, 19, 20] },
];

const WORKFLOW_STEPS = [
  {
    step: 1,
    action: 'Select Target Rank',
    detail: 'Drop deal into ranking. System calculates current PCS and shows the gap to target position. User selects desired rank (#1, #2, #3, etc.) within their submarket.',
  },
  {
    step: 2,
    action: 'Gap Analysis by Component',
    detail: "Break the PCS gap into components. 'You're 14 points behind #2. The gap is: -3 in traffic (can't change location), -2 in revenue (raise rents $85/unit to match), -5 in operational quality (you need to get from 3.8 to 4.4 stars on Google), -4 in asset quality (renovate units + add 3 amenities).'",
  },
  {
    step: 3,
    action: 'Prescriptive Action Plan',
    detail: 'For each gap component, the platform generates specific actions with cost estimates and timeline. Revenue gap → rent increase schedule. Ops gap → management improvements (from Google review analysis). Asset gap → CapEx budget with ROI per improvement.',
  },
  {
    step: 4,
    action: 'Pro Forma Integration',
    detail: "Achieving Rank #2 requires $1.2M in CapEx over 18 months. Here's how that changes your IRR: from 14.2% → 19.7%. The ranking improvement also reduces refinance risk and increases exit cap rate compression.",
  },
  {
    step: 5,
    action: 'Track Progress Post-Acquisition',
    detail: "Once acquired, the property enters the Owned Assets module. Monthly PCS updates show whether you're on track to reach your target rank. Deviation alerts: 'You're 3 months in and 2 points behind schedule on operational quality — here's what the top performers do differently.'",
  },
];

const STRATEGY_SCENARIOS = [
  {
    strategy: 'BTS (Build-to-Suit)',
    projection: "New construction enters market at projected rank based on planned specs. 'A 200-unit Class A with these amenities would rank #2 in this submarket. There are currently 0 Class A properties — you'd CREATE the top tier.'",
    icon: '🏗️',
  },
  {
    strategy: 'Flip',
    projection: "'Buy at rank #34, reposition to rank #12 in 18 months. The rank improvement from #34 → #12 historically corresponds to 35-50% value appreciation in this submarket.'",
    icon: '🔄',
  },
  {
    strategy: 'Rental',
    projection: "'This property currently ranks #8. Market trajectory is Acceleration. Projected rank in 24 months with no changes: #6 (rising tide lifts this boat). With $400K in targeted improvements: #3.'",
    icon: '🏠',
  },
  {
    strategy: 'STR (Short-Term Rental)',
    projection: "'As an STR, this property would rank #4 in the vacation rental competitive set based on location + traffic position. ADR projection based on rank: $185/night (top quartile commands $210).'",
    icon: '✈️',
  },
];

const RankMeToolPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-red-500">
        <div className="text-[10px] font-mono text-red-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">What rank do you want — and what will it take to get there?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Rank-Me Positioning Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">Scenario: Target #2 in submarket</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {RANK_ME_VITALS.map(vital => (
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
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-red-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3">
        <p className="text-sm text-red-900">
          Positioning scenario active: Target <strong>Rank #2</strong> from current <strong>Rank #14</strong>. PCS gap of 38 points requires $1.2M CapEx over 18 months. Projected IRR lift: <strong>+5.5 percentage points</strong> (14.2% → 19.7%). Ranking improvement reduces refinance risk and increases exit cap rate compression.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Rank-Me Workflow</h3>
        <p className="text-sm text-stone-500 mb-6">5-step process from target selection to progress tracking</p>

        <div className="relative">
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-red-200" />
          <div className="space-y-6">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.step} className="relative flex gap-4">
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shadow-md">
                  {step.step}
                </div>
                <div className="flex-1 bg-stone-50 rounded-lg p-4 border border-stone-200">
                  <div className="text-sm font-bold text-stone-900 mb-1">{step.action}</div>
                  <div className="text-xs text-stone-600 leading-relaxed">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Strategy Scenarios</h3>
        <p className="text-sm text-stone-500 mb-4">Rank projections by investment strategy — how each approach positions the property differently</p>

        <div className="grid grid-cols-2 gap-4">
          {STRATEGY_SCENARIOS.map(scenario => (
            <div key={scenario.strategy} className="border border-stone-200 rounded-lg p-4 hover:border-red-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{scenario.icon}</span>
                <span className="text-sm font-bold text-stone-900">{scenario.strategy}</span>
              </div>
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-600 leading-relaxed">{scenario.projection}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-900 mb-1">Gap Analysis Breakdown</h3>
        <p className="text-xs text-stone-500 mb-4">PCS component gaps between current rank #14 and target rank #2</p>
        <div className="space-y-3">
          {[
            { component: 'Traffic Position (25%)', gap: -3, total: 38, fixable: false, note: "Location-based — can't change" },
            { component: 'Revenue Performance (30%)', gap: -12, total: 38, fixable: true, note: 'Raise rents $85/unit to match target' },
            { component: 'Occupancy & Demand (20%)', gap: -6, total: 38, fixable: true, note: 'Improve lease velocity + conversion' },
            { component: 'Operational Quality (15%)', gap: -10, total: 38, fixable: true, note: 'Improve Google rating from 3.8 → 4.4 stars' },
            { component: 'Asset Quality (10%)', gap: -7, total: 38, fixable: true, note: 'Renovate 40% of units + add 3 amenities' },
          ].map((item, i) => {
            const pct = Math.abs(item.gap) / item.total * 100;
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-stone-700">{item.component}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${item.fixable ? 'text-emerald-600' : 'text-stone-400'}`}>
                      {item.fixable ? 'Fixable' : 'Fixed'}
                    </span>
                    <span className="text-xs font-mono text-red-600">{item.gap} pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-stone-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-full rounded-full ${item.fixable ? 'bg-red-400' : 'bg-stone-300'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-stone-500 w-48 text-right">{item.note}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 bg-red-50 rounded-lg p-3 border border-red-100">
          <div className="text-[10px] font-mono text-red-400 tracking-widest mb-1">TOTAL ADDRESSABLE GAP</div>
          <div className="text-sm text-red-900">
            35 of 38 points are addressable through operational improvements, revenue optimization, and capital investment. Only 3 points (traffic position) are location-fixed.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankMeToolPage;
