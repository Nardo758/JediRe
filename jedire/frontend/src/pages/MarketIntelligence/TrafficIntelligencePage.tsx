import React, { useState } from 'react';

const TRAFFIC_VITALS = [
  { id: 'physical-score', label: 'Avg Physical Score', value: '72', trend: '+3.2 (90d)', trendDirection: 'up' as const, sparklineData: [58, 62, 64, 60, 66, 68, 65, 70, 69, 72, 71, 72] },
  { id: 'digital-score', label: 'Avg Digital Score', value: '85', trend: '+5.1 QoQ', trendDirection: 'up' as const, sparklineData: [68, 72, 74, 76, 78, 80, 79, 82, 83, 84, 86, 85] },
  { id: 'walkin-weekly', label: 'Avg Walk-Ins/Wk', value: '48', trend: 'Seasonal peak', trendDirection: 'up' as const, sparklineData: [32, 35, 38, 42, 48, 52, 50, 46, 44, 40, 36, 48] },
  { id: 'tour-conversion', label: 'Tour Conversion', value: '22.4%', trend: '+1.8pp YoY', trendDirection: 'up' as const, sparklineData: [18, 19, 18, 20, 21, 20, 22, 21, 22, 23, 22, 22] },
  { id: 'sentiment', label: 'Avg Sentiment', value: '4.1', trend: 'Improving', trendDirection: 'up' as const, sparklineData: [3.6, 3.5, 3.7, 3.8, 3.6, 3.9, 4.0, 3.8, 4.1, 4.0, 4.2, 4.1] },
];

const WALKIN_DAILY = [
  { day: 'Mon', count: 8, pct: 10.4 },
  { day: 'Tue', count: 10, pct: 13.0 },
  { day: 'Wed', count: 7, pct: 9.1 },
  { day: 'Thu', count: 9, pct: 11.7 },
  { day: 'Fri', count: 12, pct: 15.6 },
  { day: 'Sat', count: 18, pct: 23.4 },
  { day: 'Sun', count: 5, pct: 6.5 },
];

const WALKIN_HOURLY = [
  { hour: '8am', count: 1 }, { hour: '9am', count: 3 }, { hour: '10am', count: 5 },
  { hour: '11am', count: 7 }, { hour: '12pm', count: 6 }, { hour: '1pm', count: 8 },
  { hour: '2pm', count: 9 }, { hour: '3pm', count: 7 }, { hour: '4pm', count: 5 },
  { hour: '5pm', count: 4 }, { hour: '6pm', count: 2 },
];

const QUADRANT_DATA = {
  physicalScore: 72,
  digitalScore: 85,
  quadrant: 'Validated Winner',
  quadrantColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  submarketRank: 3,
  submarketTotal: 18,
  trajectory: { direction: 'up' as const, delta: +4.2, confidence: 0.87 },
};

const REVIEW_SENTIMENTS = [
  { category: 'Maintenance', positive: 62, neutral: 20, negative: 18, trend: 'improving' as const },
  { category: 'Management', positive: 48, neutral: 25, negative: 27, trend: 'declining' as const },
  { category: 'Amenities', positive: 78, neutral: 15, negative: 7, trend: 'stable' as const },
  { category: 'Location', positive: 88, neutral: 9, negative: 3, trend: 'stable' as const },
  { category: 'Value', positive: 55, neutral: 22, negative: 23, trend: 'improving' as const },
];

const REVIEW_TREND = [
  { month: 'Mar 25', avgSentiment: 3.6, reviewCount: 12 },
  { month: 'Apr 25', avgSentiment: 3.5, reviewCount: 8 },
  { month: 'May 25', avgSentiment: 3.7, reviewCount: 15 },
  { month: 'Jun 25', avgSentiment: 3.8, reviewCount: 11 },
  { month: 'Jul 25', avgSentiment: 3.6, reviewCount: 9 },
  { month: 'Aug 25', avgSentiment: 3.9, reviewCount: 14 },
  { month: 'Sep 25', avgSentiment: 4.0, reviewCount: 10 },
  { month: 'Oct 25', avgSentiment: 3.8, reviewCount: 13 },
  { month: 'Nov 25', avgSentiment: 4.1, reviewCount: 7 },
  { month: 'Dec 25', avgSentiment: 4.0, reviewCount: 6 },
  { month: 'Jan 26', avgSentiment: 4.2, reviewCount: 11 },
  { month: 'Feb 26', avgSentiment: 4.1, reviewCount: 9 },
];

const ScoreGauge: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const angle = Math.min(value / 100, 1) * 180;
  const strokeColor = value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 130, height: 70 }}>
        <svg width="130" height="70" viewBox="0 0 130 70">
          <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 65 A 55 55 0 0 1 120 65" fill="none" stroke={strokeColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(angle / 180) * 173} 173`} />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-2xl font-bold text-stone-900">{value}</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-stone-600 mt-1">{label}</div>
    </div>
  );
};

const TrafficIntelligencePage: React.FC = () => {
  const [walkInView, setWalkInView] = useState<'hourly' | 'daily'>('daily');
  const walkInData = walkInView === 'hourly' ? WALKIN_HOURLY.map(d => ({ label: d.hour, value: d.count })) : WALKIN_DAILY.map(d => ({ label: d.day, value: d.count }));
  const walkInMax = Math.max(...walkInData.map(d => d.value));

  const reviewTrendMax = Math.max(...REVIEW_TREND.map(d => d.avgSentiment));
  const reviewTrendMin = Math.min(...REVIEW_TREND.map(d => d.avgSentiment));
  const trendRange = reviewTrendMax - reviewTrendMin || 1;

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-cyan-500">
        <div className="text-[10px] font-mono text-cyan-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How is this market performing in foot traffic, digital presence, and resident sentiment?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Traffic Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">18 properties | Atlanta submarket</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {TRAFFIC_VITALS.map(vital => (
            <div key={vital.id} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${vital.trendDirection === 'up' ? 'text-emerald-600' : vital.trendDirection === 'down' ? 'text-red-500' : 'text-stone-500'}`}>
                  {vital.trendDirection === 'up' ? '\u2191' : vital.trendDirection === 'down' ? '\u2193' : '\u2192'} {vital.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparklineData.slice(-12).map((v, i, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div key={i} className={`flex-1 rounded-sm ${i === arr.length - 1 ? 'bg-cyan-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-5 py-3">
        <p className="text-sm text-cyan-900">
          Tracking 18 properties across Atlanta submarkets. Momentum signal: <strong>STRONG</strong>. Physical traffic up 3.2% with digital engagement accelerating +5.1% QoQ. Peak walk-in day: Saturday (23% of weekly volume).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Traffic Score Card</h3>
        </div>
        <p className="text-sm text-stone-500 mb-5">Physical and digital traffic scores with T-04 Quadrant classification</p>

        <div className="grid grid-cols-3 gap-6 items-center">
          <ScoreGauge label="T-02 Physical Score" value={QUADRANT_DATA.physicalScore} />
          <ScoreGauge label="T-03 Digital Score" value={QUADRANT_DATA.digitalScore} />
          <div className="flex flex-col items-center gap-3">
            <div className="text-[10px] font-mono text-stone-400 tracking-widest">T-04 QUADRANT</div>
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${QUADRANT_DATA.quadrantColor}`}>
              {QUADRANT_DATA.quadrant}
            </div>
            <div className="text-[10px] text-stone-500 text-center">Based on physical + digital score intersection</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-stone-900">Walk-In Prediction Curve</h3>
            <div className="flex bg-stone-100 rounded-lg p-0.5">
              <button onClick={() => setWalkInView('hourly')} className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${walkInView === 'hourly' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>Hourly</button>
              <button onClick={() => setWalkInView('daily')} className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${walkInView === 'daily' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>Daily</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {walkInData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-stone-500 w-8 text-right font-mono">{d.label}</span>
                <div className="flex-1 bg-stone-100 rounded-full h-4 relative overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(d.value / walkInMax) * 100}%` }} />
                  <span className="absolute right-2 top-0 text-[9px] font-mono text-stone-600 leading-4">{d.value}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-stone-400">
            {walkInView === 'hourly' ? 'Peak hours: 1-3pm \u00B7 Plan tours during off-peak for better attention' : 'Saturday is busiest \u00B7 Consider extended weekend hours'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="text-sm font-bold text-stone-900 mb-2">T-07 Trajectory</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className={`flex items-center gap-2 text-3xl font-bold ${QUADRANT_DATA.trajectory.direction === 'up' ? 'text-emerald-600' : QUADRANT_DATA.trajectory.direction === 'down' ? 'text-red-600' : 'text-stone-600'}`}>
              {QUADRANT_DATA.trajectory.direction === 'up' ? '\u2191' : QUADRANT_DATA.trajectory.direction === 'down' ? '\u2193' : '\u2192'}
              <span className="text-xl">+{QUADRANT_DATA.trajectory.delta.toFixed(1)}%</span>
            </div>
            <div>
              <div className="text-xs text-stone-500">13-week trend</div>
              <div className="text-xs text-stone-400">Confidence: {(QUADRANT_DATA.trajectory.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-2">TRAJECTORY COMPONENTS</div>
            <div className="space-y-1.5">
              {[
                { label: 'Physical traffic velocity', value: '+2.8%', positive: true },
                { label: 'Digital engagement trend', value: '+5.1%', positive: true },
                { label: 'Review volume momentum', value: '+1.3%', positive: true },
                { label: 'Competitive pressure', value: '-3.7%', positive: false },
              ].map((c, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-stone-600">{c.label}</span>
                  <span className={`font-mono font-semibold ${c.positive ? 'text-emerald-600' : 'text-red-500'}`}>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-900 mb-1">Submarket Rank Position</h3>
        <p className="text-xs text-stone-500 mb-4">Average traffic rank among submarket peers</p>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-cyan-600">#{QUADRANT_DATA.submarketRank}</div>
            <div className="text-xs text-stone-500">of {QUADRANT_DATA.submarketTotal} properties</div>
          </div>
          <div className="flex-1">
            <div className="relative h-8 bg-stone-100 rounded-full overflow-hidden">
              {Array.from({ length: QUADRANT_DATA.submarketTotal }, (_, i) => {
                const isSubject = i + 1 === QUADRANT_DATA.submarketRank;
                const left = ((i + 0.5) / QUADRANT_DATA.submarketTotal) * 100;
                return (
                  <div key={i} className={`absolute top-1 bottom-1 rounded-full ${isSubject ? 'bg-cyan-500 z-10' : 'bg-stone-300'}`}
                    style={{ left: `${left}%`, width: isSubject ? '12px' : '6px', transform: 'translateX(-50%)' }} />
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-stone-400">
              <span>#1 (Best)</span>
              <span>#{QUADRANT_DATA.submarketTotal} (Worst)</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Percentile', value: `Top ${Math.round((QUADRANT_DATA.submarketRank / QUADRANT_DATA.submarketTotal) * 100)}%`, sub: 'In submarket' },
            { label: 'Rank Change', value: '+2 spots', sub: 'Last 90 days' },
            { label: 'Gap to #1', value: '8.3 pts', sub: 'PCS score difference' },
          ].map((m, i) => (
            <div key={i} className="bg-stone-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-stone-900">{m.value}</div>
              <div className="text-[10px] text-stone-500">{m.label}</div>
              <div className="text-[9px] text-stone-400">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Google Reviews Sentiment Analysis</h3>
        <p className="text-sm text-stone-500 mb-4">NLP-classified resident sentiment across 5 categories</p>
        <div className="space-y-3">
          {REVIEW_SENTIMENTS.map((s, i) => {
            const trendIcon = s.trend === 'improving' ? '\u2191' : s.trend === 'declining' ? '\u2193' : '\u2192';
            const trendColor = s.trend === 'improving' ? 'text-emerald-600' : s.trend === 'declining' ? 'text-red-500' : 'text-stone-400';
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-stone-700 w-24">{s.category}</span>
                <div className="flex-1 flex h-5 rounded-full overflow-hidden bg-stone-100">
                  <div className="bg-emerald-400 h-full" style={{ width: `${s.positive}%` }} />
                  <div className="bg-stone-300 h-full" style={{ width: `${s.neutral}%` }} />
                  <div className="bg-red-400 h-full" style={{ width: `${s.negative}%` }} />
                </div>
                <div className="flex items-center gap-1 w-20">
                  <span className={`text-xs font-bold ${trendColor}`}>{trendIcon}</span>
                  <span className="text-[10px] text-stone-500 capitalize">{s.trend}</span>
                </div>
                <span className="text-[10px] font-mono text-stone-400 w-24 text-right">{s.positive}% / {s.neutral}% / {s.negative}%</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Positive</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-stone-300 inline-block" /> Neutral</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Negative</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-bold text-stone-900 mb-1">Review Sentiment Trend (12 Months)</h3>
        <p className="text-xs text-stone-500 mb-4">Average sentiment score and review volume over time</p>
        <div className="relative h-40">
          <svg className="w-full h-full" viewBox="0 0 600 160" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="0" y2="160" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="0" y1="160" x2="600" y2="160" stroke="#e5e7eb" strokeWidth="1" />
            {[0, 40, 80, 120].map(y => (
              <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#f3f4f6" strokeWidth="1" />
            ))}
            <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5"
              points={REVIEW_TREND.map((d, i) => {
                const x = (i / (REVIEW_TREND.length - 1)) * 580 + 10;
                const y = 150 - ((d.avgSentiment - reviewTrendMin) / trendRange) * 130;
                return `${x},${y}`;
              }).join(' ')} />
            {REVIEW_TREND.map((d, i) => {
              const x = (i / (REVIEW_TREND.length - 1)) * 580 + 10;
              const y = 150 - ((d.avgSentiment - reviewTrendMin) / trendRange) * 130;
              return <circle key={i} cx={x} cy={y} r="4" fill="#06b6d4" stroke="white" strokeWidth="2" />;
            })}
            {REVIEW_TREND.map((d, i) => {
              const x = (i / (REVIEW_TREND.length - 1)) * 580 + 10;
              const barHeight = (d.reviewCount / 20) * 50;
              return <rect key={`bar-${i}`} x={x - 8} y={160 - barHeight} width="16" height={barHeight} fill="#06b6d4" fillOpacity="0.15" rx="2" />;
            })}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
            {REVIEW_TREND.filter((_, i) => i % 3 === 0).map((d, i) => (
              <span key={i} className="text-[9px] text-stone-400">{d.month}</span>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-6 text-[10px] text-stone-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-500 inline-block" /> Avg Sentiment</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-cyan-500/15 inline-block rounded-sm" /> Review Volume</span>
        </div>
      </div>
    </div>
  );
};

export default TrafficIntelligencePage;
