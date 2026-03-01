import React from 'react';

const PATTERN_VITALS = [
  { id: 'active-patterns', label: 'Active Patterns', value: '23', trend: '+4 this quarter', trendDirection: 'up' as const, sparklineData: [12, 14, 13, 15, 16, 18, 17, 19, 20, 21, 22, 23] },
  { id: 'reviews-analyzed', label: 'Reviews Analyzed', value: '4,218', trend: '+312 MTD', trendDirection: 'up' as const, sparklineData: [2800, 3100, 3200, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4218] },
  { id: 'rent-wage', label: 'Rent-Wage Correlations', value: '14', trend: '3 actionable', trendDirection: 'up' as const, sparklineData: [6, 7, 8, 8, 9, 10, 10, 11, 12, 12, 13, 14] },
  { id: 'business-clusters', label: 'Business Clusters', value: '8', trend: '+2 emerging', trendDirection: 'up' as const, sparklineData: [3, 3, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8] },
  { id: 'confidence', label: 'Pattern Confidence %', value: '82%', trend: '+3pp QoQ', trendDirection: 'up' as const, sparklineData: [68, 70, 71, 73, 74, 75, 77, 78, 79, 80, 81, 82] },
];

const PR01_PATTERNS = [
  {
    pattern: 'Management Transition Signal',
    detail: 'When review sentiment shifts dramatically (±0.3 in 6 months), it often indicates an ownership or management change. Early detection creates acquisition opportunities 3–6 months before deals hit the market.',
    metric: '±0.3 sentiment shift in 6mo',
    status: 'Active',
  },
  {
    pattern: 'Operational Gap Mining',
    detail: "Extract the TOP 3 complaint categories per property. If 'maintenance response time' is the #1 complaint and that property has strong traffic position, you've found an operational fix cheaper than physical renovation.",
    metric: 'Top 3 complaint categories',
    status: 'Active',
  },
  {
    pattern: 'Amenity Demand Signal',
    detail: "When reviews across multiple properties mention 'wish this had [X]', it's a revealed preference signal. Track which amenity mentions are rising fastest.",
    metric: 'Rising amenity mentions',
    status: 'Active',
  },
];

const PR02_PATTERNS = [
  {
    pattern: 'Affordability Ceiling Predictor',
    detail: 'When rent/wage ratio exceeds 30% of median household income for 2+ consecutive quarters AND traffic trajectory is decelerating, the market is approaching an affordability wall.',
    metric: 'Rent/wage ratio > 30%',
    status: 'Monitoring',
  },
  {
    pattern: 'Rent Growth Runway Detector',
    detail: "When wage growth > rent growth sustained AND traffic is growing — rents have room to run. The wage growth creates a 'permission structure' for rent increases without demand destruction.",
    metric: 'Wage growth > rent growth',
    status: 'Active',
  },
];

const PR03_PATTERNS = [
  {
    pattern: 'Emerging Employment Center',
    detail: 'When business formations in a specific NAICS cluster exceed 2 standard deviations above the trailing 24-month average within a 3-mile radius, a new employment center is forming. This is a demand signal 12–24 months BEFORE the traffic data shows it.',
    metric: '>2σ above 24mo avg',
    status: 'Active',
  },
  {
    pattern: 'Industry Mix Shift',
    detail: 'When the composition of business formations shifts (e.g., healthcare NAICS growing from 8% to 15%), the INCOME PROFILE of the renter pool is changing. This informs unit mix and pricing strategy.',
    metric: 'NAICS composition shift',
    status: 'Monitoring',
  },
];

const PatternEnginePage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">What patterns, correlations, and anomalies are hiding in the data?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Pattern Detection Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">LIVE ENGINE</span>
            <span className="text-[10px] text-stone-400">Cross-module intelligence layer</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {PATTERN_VITALS.map(vital => (
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
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-amber-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
        <p className="text-sm text-amber-900">
          Pattern Engine scanning across <strong>23 active patterns</strong> from 3 intelligence categories. 4,218 reviews analyzed with 14 rent-wage correlations tracked. <strong>3 actionable signals</strong> detected this week — 2 acquisition windows and 1 emerging employment center.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
          <h3 className="text-lg font-bold text-stone-900">PR-01 — Google Reviews Intelligence</h3>
        </div>
        <p className="text-sm text-stone-500 mb-5">NLP-driven pattern extraction from resident reviews across tracked properties</p>

        <div className="grid grid-cols-3 gap-4">
          {PR01_PATTERNS.map((p, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-amber-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-900">{p.pattern}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{p.status}</span>
              </div>
              <p className="text-xs text-stone-600 mb-3 leading-relaxed">{p.detail}</p>
              <div className="bg-stone-50 rounded px-2 py-1.5">
                <span className="text-[10px] font-mono text-stone-500">Trigger: {p.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
          <h3 className="text-lg font-bold text-stone-900">PR-02 — Rent-Traffic-Wage Correlation Engine</h3>
        </div>
        <p className="text-sm text-stone-500 mb-5">Cross-referencing rent trends, traffic patterns, and wage data to predict market movements</p>

        <div className="grid grid-cols-2 gap-4">
          {PR02_PATTERNS.map((p, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-900">{p.pattern}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
              </div>
              <p className="text-xs text-stone-600 mb-3 leading-relaxed">{p.detail}</p>
              <div className="bg-stone-50 rounded px-2 py-1.5">
                <span className="text-[10px] font-mono text-stone-500">Trigger: {p.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
          <h3 className="text-lg font-bold text-stone-900">PR-03 — Business Formation & Cluster Intelligence</h3>
        </div>
        <p className="text-sm text-stone-500 mb-5">Tracking new business formations and NAICS clusters as leading demand indicators</p>

        <div className="grid grid-cols-2 gap-4">
          {PR03_PATTERNS.map((p, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-4 hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-900">{p.pattern}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${p.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.status}</span>
              </div>
              <p className="text-xs text-stone-600 mb-3 leading-relaxed">{p.detail}</p>
              <div className="bg-stone-50 rounded px-2 py-1.5">
                <span className="text-[10px] font-mono text-stone-500">Trigger: {p.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PatternEnginePage;
