import React from 'react';

const COMP_VITALS = [
  { id: 'trade-area', label: 'Trade Area Comps', value: '24', trend: '+3 this quarter', trendDirection: 'up' as const, sparklineData: [14, 16, 17, 18, 19, 18, 20, 21, 20, 22, 23, 24] },
  { id: 'like-kind', label: 'Like-Kind Peers', value: '38', trend: 'Across 6 MSAs', trendDirection: 'up' as const, sparklineData: [22, 24, 26, 28, 30, 29, 31, 33, 34, 35, 37, 38] },
  { id: 'rent-premium', label: 'Avg Rent Premium', value: '+$127', trend: 'vs trade area avg', trendDirection: 'up' as const, sparklineData: [65, 72, 80, 88, 95, 102, 98, 108, 112, 118, 122, 127] },
  { id: 'rent-ceiling', label: 'Rent Ceiling Gap', value: '$302', trend: 'Room to close', trendDirection: 'up' as const, sparklineData: [410, 395, 380, 365, 350, 340, 335, 325, 318, 312, 308, 302] },
  { id: 'cross-market', label: 'Cross-Market Score', value: '74', trend: '+4.2 QoQ', trendDirection: 'up' as const, sparklineData: [52, 55, 58, 60, 62, 64, 66, 68, 70, 71, 73, 74] },
];

const TRADE_AREA_PATTERNS = [
  {
    pattern: 'Rent Ceiling Gap',
    detection: "If the top-rent comp charges $1,950 and the average is $1,650 — that $300 gap defines your renovation opportunity ceiling. Properties below average with above-average traffic position are acquisition targets.",
  },
  {
    pattern: 'Amenity Arms Race Detection',
    detection: "When 60%+ of trade area comps have added a specific amenity in the last 24 months, properties WITHOUT that amenity face accelerating competitive displacement.",
  },
  {
    pattern: 'Vintage Rotation',
    detection: 'When new supply enters a trade area, competitive pressure cascades downward: Class A new → pushes Class A existing → pushes renovated B → pushes unrenovated B.',
  },
];

const LIKE_KIND_PATTERNS = [
  {
    pattern: 'Cross-Market Pricing Anomaly',
    detection: 'Markets where like-kind rent PSF is >15% below the national like-kind average AND traffic/demand signals are strong = UNDERPRICED MARKETS.',
  },
  {
    pattern: 'Operational Benchmark Gap',
    detection: "Compare operational metrics across like-kind properties. Properties performing below the like-kind national benchmark have operational upside regardless of market conditions.",
  },
  {
    pattern: 'Rent Growth Divergence',
    detection: "When one market's like-kind cohort grows significantly faster than others, it signals either a catch-up play or a bubble. Cross-reference with traffic trajectory to distinguish.",
  },
];

const CompAnalysisPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How does your property compare locally and nationally — and what patterns emerge?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Dual Comp Analysis</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">2 lenses | Trade Area + Like-Kind</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {COMP_VITALS.map(vital => (
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
          Dual comp analysis active across <strong>24 trade area comps</strong> and <strong>38 like-kind peers</strong> spanning 6 MSAs. Average rent premium of +$127 vs local competition with a $302 rent ceiling gap — indicating significant upside through renovation and repositioning. Cross-market score of 74 suggests strong relative performance.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-stone-900">Competition Lens — Trade Area Comps</h3>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">LENS 1</span>
        </div>
        <p className="text-sm text-stone-500 mb-5">Properties within the defined trade area that compete for the SAME renter pool</p>

        <div className="grid grid-cols-3 gap-4">
          {TRADE_AREA_PATTERNS.map((p, i) => (
            <div key={i} className="border border-violet-200 rounded-lg p-4 bg-violet-50/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <div className="text-sm font-bold text-stone-900">{p.pattern}</div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{p.detection}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-lg font-bold text-stone-900">Like-Kind Lens — Cross-Market Comps</h3>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">LENS 2</span>
        </div>
        <p className="text-sm text-stone-500 mb-5">Properties with similar attributes across different submarkets or MSAs</p>

        <div className="grid grid-cols-3 gap-4">
          {LIKE_KIND_PATTERNS.map((p, i) => (
            <div key={i} className="border border-violet-200 rounded-lg p-4 bg-violet-50/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <div className="text-sm font-bold text-stone-900">{p.pattern}</div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{p.detection}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-bold text-stone-900">Collision Output</h3>
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">SIGNAL AMPLIFIER</span>
        </div>
        <div className="bg-stone-50 rounded-lg p-5 border border-stone-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-lg font-bold">⚡</div>
            <div>
              <p className="text-sm text-stone-700 leading-relaxed">
                When both lenses find the same property, the signal is amplified. A property that ranks low in its trade area AND ranks below like-kind benchmarks has <strong>BOTH local competitive problems AND operational problems</strong> — maximum value-add potential.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-[10px] font-mono text-stone-400 tracking-wider">TRADE AREA SIGNAL</div>
                  <div className="text-sm font-bold text-violet-600 mt-1">Below Local Avg</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-lg font-bold text-amber-500">+</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-stone-200 text-center">
                  <div className="text-[10px] font-mono text-stone-400 tracking-wider">LIKE-KIND SIGNAL</div>
                  <div className="text-sm font-bold text-violet-600 mt-1">Below National Benchmark</div>
                </div>
              </div>
              <div className="mt-3 bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
                <div className="text-[10px] font-mono text-violet-400 tracking-widest">COLLISION RESULT</div>
                <div className="text-sm font-bold text-violet-700 mt-1">Maximum Value-Add Target — Dual Signal Confirmed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompAnalysisPage;
