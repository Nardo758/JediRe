import React from 'react';

const ALERT_VITALS = [
  { id: 'active-alerts', label: 'Active Alerts', value: '12', trend: '+3 this week', trendDirection: 'up' as const, sparklineData: [5, 6, 7, 8, 7, 9, 8, 10, 9, 11, 10, 12] },
  { id: 'high-urgency', label: 'High Urgency', value: '3', trend: '+1 new today', trendDirection: 'up' as const, sparklineData: [1, 2, 1, 2, 3, 2, 1, 2, 3, 2, 2, 3] },
  { id: 'acquisition-windows', label: 'Acquisition Windows', value: '2', trend: 'Stable', trendDirection: 'neutral' as const, sparklineData: [1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 1, 2] },
  { id: 'pattern-anomalies', label: 'Pattern Anomalies', value: '4', trend: '+2 detected', trendDirection: 'up' as const, sparklineData: [1, 2, 2, 3, 2, 3, 3, 2, 3, 4, 3, 4] },
  { id: 'avg-confidence', label: 'Avg Confidence', value: '78%', trend: '+4pp QoQ', trendDirection: 'up' as const, sparklineData: [62, 65, 68, 70, 72, 71, 74, 73, 75, 76, 77, 78] },
];

const ALERT_TYPES = [
  {
    name: 'Acquisition Window',
    icon: '🎯',
    trigger: 'Underperformer + debt maturity window + motivated seller signal',
    urgency: 'HIGH — 6-month approach window',
    example: `ACQUISITION TARGET: Sunset Ridge (248 units, PSL)
• Ranked #34 of 41 — expected rank #12 based on location
• Owner: PSL Ventures LLC (purchased 2019, hold year 6)
• Est. debt maturity: Q2 2026 (14 months)
• Strategy: Value-Add flip. Fix management + renovate 40% of units
• Est. value creation: $2.8M on $18M basis`,
  },
  {
    name: 'Market Surge',
    icon: '🔥',
    trigger: 'Market lifecycle entering Acceleration + confirmed by rent-traffic-wage alignment',
    urgency: 'MODERATE — 3-6 month window',
    example: `MARKET SURGE: Stuart/Jensen Beach submarket
• Digital demand: +32% QoQ (Emergence → Acceleration)
• AADT on US-1/Jensen Beach Blvd: +6.8% YoY
• Wage growth: +4.2% (healthcare + marine industry clusters)
• Business formations: +18% (2× county average)
• Strategy: BTS or Rental acquisition`,
  },
  {
    name: 'Competitive Shift',
    icon: '⚡',
    trigger: 'Property losing 10%+ digital share while trade area stable + declining Google review sentiment',
    urgency: 'HIGH — deterioration accelerating',
    example: `COMPETITIVE ALERT: Palm Bay Gardens (312 units)
• Digital traffic share: down 14% this quarter
• Google reviews: dropped from 4.1 to 3.6
• Two new comps delivering within 18 months
• Current rank: #8 → projected #14 by Q4 2026
• Strategy: Acquisition target IF priced at current underperformance`,
  },
  {
    name: 'Pattern Anomaly',
    icon: '🔍',
    trigger: 'Pattern Recognition Engine detects unusual correlation or divergence',
    urgency: 'MODERATE — 6-12 month window',
    example: `PATTERN DETECTED: Rent-Traffic Divergence in Vero Beach
• Traffic growth: +11% YoY across submarket
• Rent growth: +1.8% YoY (lagging significantly)
• Wage growth: +3.9% (supports higher rents)
• Estimated rent runway: $75-125/unit
• 4 properties identified with TAR > 1.2`,
  },
  {
    name: 'Distress Signal',
    icon: '🚨',
    trigger: 'Tax delinquency + code violations + declining occupancy + review collapse',
    urgency: 'VARIABLE — monitor for triggers',
    example: `DISTRESS DETECTED: Ocean Breeze Apartments (164 units)
• Property tax: 2 quarters delinquent
• Code violations: 3 open, unresolved
• Google reviews: 2.1 stars (was 3.4 two years ago)
• Estimated occupancy: 78% (submarket avg: 94%)
• Strategy: Deep value / restructuring play`,
  },
];

const DELIVERY_CHANNELS = [
  { channel: 'In-App Dashboard', frequency: 'Real-time feed, ranked by TOS × urgency' },
  { channel: 'Email Digest', frequency: 'Weekly summary of top 5 opportunities by market' },
  { channel: 'Push Notification', frequency: 'Immediate for HIGH urgency + confidence > 80%' },
  { channel: 'Portfolio-Specific', frequency: "Alerts filtered to user's tracked markets + investment criteria" },
];

const OpportunityAlertsPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-cyan-500">
        <div className="text-[10px] font-mono text-cyan-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">What opportunities are emerging right now — and which ones should you act on?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Alert Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">All tracked markets</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {ALERT_VITALS.map(vital => (
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
          Monitoring all tracked markets. <strong>12 active alerts</strong> across 5 categories — 3 flagged as high urgency requiring immediate review. 2 acquisition windows detected with debt maturity approaching within 14 months. Average alert confidence: <strong>78%</strong>.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Alert Types</h3>
        <p className="text-sm text-stone-500 mb-5">The platform continuously monitors all data streams and pushes actionable opportunity alerts with specific strategy recommendations.</p>

        <div className="space-y-4">
          {ALERT_TYPES.map((alert, idx) => (
            <div key={idx} className="border border-stone-200 rounded-xl p-5 hover:border-stone-300 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{alert.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-sm font-bold text-stone-900">{alert.name}</h4>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      alert.urgency.startsWith('HIGH') ? 'bg-red-100 text-red-700' :
                      alert.urgency.startsWith('MODERATE') ? 'bg-amber-100 text-amber-700' :
                      'bg-stone-100 text-stone-600'
                    }`}>{alert.urgency}</span>
                  </div>
                  <div className="text-xs text-stone-500">
                    <span className="font-semibold text-stone-600">Trigger:</span> {alert.trigger}
                  </div>
                </div>
              </div>
              <pre className="bg-stone-50 rounded-lg p-4 text-xs font-mono text-stone-700 whitespace-pre-wrap overflow-x-auto border border-stone-100">{alert.example}</pre>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Delivery Channels</h3>
        <p className="text-sm text-stone-500 mb-5">Alerts are ranked by confidence and time-sensitivity, then delivered through multiple channels.</p>

        <div className="grid grid-cols-2 gap-4">
          {DELIVERY_CHANNELS.map((item, idx) => (
            <div key={idx} className="border border-stone-200 rounded-lg p-4 hover:border-stone-300 transition-colors">
              <div className="text-sm font-bold text-stone-900 mb-1">{item.channel}</div>
              <div className="text-xs text-stone-500">{item.frequency}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpportunityAlertsPage;
