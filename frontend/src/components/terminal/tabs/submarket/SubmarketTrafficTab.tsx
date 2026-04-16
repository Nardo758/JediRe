/**
 * SubmarketTrafficTab - Traffic intelligence with patterns and sentiment
 * Integrated from pre-Bloomberg TrafficIntelligencePage (19KB)
 * Features: Traffic vitals, walk-in patterns, quadrant analysis, review sentiment
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { BT_SIGNAL_COLORS, scoreColor } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';

interface SubmarketTrafficTabProps {
  submarketId: string;
  submarket: any;
}

// Traffic vitals data
const TRAFFIC_VITALS = [
  { id: 'physical-score', label: 'Avg Physical Score', value: 72, trend: '+3.2 (90d)', direction: 'up' as const, sparkline: [58, 62, 64, 60, 66, 68, 65, 70, 69, 72, 71, 72] },
  { id: 'digital-score', label: 'Avg Digital Score', value: 85, trend: '+5.1 QoQ', direction: 'up' as const, sparkline: [68, 72, 74, 76, 78, 80, 79, 82, 83, 84, 86, 85] },
  { id: 'walkin-weekly', label: 'Avg Walk-Ins/Wk', value: 48, trend: 'Seasonal peak', direction: 'up' as const, sparkline: [32, 35, 38, 42, 48, 52, 50, 46, 44, 40, 36, 48] },
  { id: 'tour-conversion', label: 'Tour Conversion', value: '22.4%', trend: '+1.8pp YoY', direction: 'up' as const, sparkline: [18, 19, 18, 20, 21, 20, 22, 21, 22, 23, 22, 22] },
  { id: 'sentiment', label: 'Avg Sentiment', value: 4.1, trend: 'Improving', direction: 'up' as const, sparkline: [3.6, 3.5, 3.7, 3.8, 3.6, 3.9, 4.0, 3.8, 4.1, 4.0, 4.2, 4.1] },
];

// Walk-in patterns
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

// Quadrant analysis
const QUADRANT_DATA = {
  physicalScore: 72,
  digitalScore: 85,
  quadrant: 'Validated Winner',
  quadrantColor: '#3b82f6',
  submarketRank: 3,
  submarketTotal: 18,
  trajectory: { direction: 'up' as const, delta: 4.2, confidence: 0.87 },
};

// Review sentiment categories
const REVIEW_SENTIMENTS = [
  { category: 'Maintenance', positive: 62, neutral: 20, negative: 18, trend: 'improving' as const },
  { category: 'Management', positive: 48, neutral: 25, negative: 27, trend: 'declining' as const },
  { category: 'Amenities', positive: 78, neutral: 15, negative: 7, trend: 'stable' as const },
  { category: 'Location', positive: 88, neutral: 9, negative: 3, trend: 'stable' as const },
  { category: 'Value', positive: 55, neutral: 22, negative: 23, trend: 'improving' as const },
];

// Review trend over time
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

// Top properties by traffic
const TOP_PROPERTIES = [
  { name: 'The Vue at Midtown', physicalScore: 92, digitalScore: 88, walkIns: 68, quadrant: 'Validated Winner' },
  { name: 'Pines at Midtown', physicalScore: 76, digitalScore: 34, walkIns: 52, quadrant: 'Hidden Gem' },
  { name: 'Peachtree Walk', physicalScore: 84, digitalScore: 82, walkIns: 61, quadrant: 'Validated Winner' },
  { name: 'Midtown Lofts', physicalScore: 58, digitalScore: 72, walkIns: 38, quadrant: 'Hype Risk' },
  { name: 'Piedmont Gardens', physicalScore: 45, digitalScore: 42, walkIns: 24, quadrant: 'Dead Weight' },
];

export const SubmarketTrafficTab: React.FC<SubmarketTrafficTabProps> = ({ submarketId, submarket }) => {
  const submarketName = submarket?.name || submarketId || 'Midtown';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);
  useEffect(() => { fetchCommentary('submarket', submarketId, submarketName); }, [submarketId, submarketName]);
  const [walkInView, setWalkInView] = useState<'hourly' | 'daily'>('daily');

  const walkInData = walkInView === 'hourly' 
    ? WALKIN_HOURLY.map(d => ({ label: d.hour, value: d.count }))
    : WALKIN_DAILY.map(d => ({ label: d.day, value: d.count }));
  const walkInMax = Math.max(...walkInData.map(d => d.value));

  // Sparkline renderer
  const Sparkline: React.FC<{ data: number[]; color: string; height?: number }> = ({ data, color, height = 24 }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 80;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Score gauge component
  const ScoreGauge: React.FC<{ label: string; value: number }> = ({ label, value }) => {
    const angle = Math.min(value / 100, 1) * 180;
    const strokeColor = value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 100, height: 55 }}>
          <svg width="100" height="55" viewBox="0 0 100 55">
            <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={BT.bg.elevated} strokeWidth="8" strokeLinecap="round" />
            <path 
              d="M 5 50 A 45 45 0 0 1 95 50" 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="8" 
              strokeLinecap="round"
              strokeDasharray={`${(angle / 180) * 141} 141`}
            />
          </svg>
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: '50%', 
            transform: 'translateX(-50%)',
            fontSize: 18,
            fontWeight: 700,
            color: BT.text.primary,
          }}>
            {value}
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: BT.text.muted, marginTop: 4 }}>{label}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Decision Banner */}
      <div style={{
        padding: 16,
        background: BT_SIGNAL_COLORS.TRAFFIC.bg,
        borderRadius: 8,
        borderLeft: `4px solid ${BT_SIGNAL_COLORS.TRAFFIC.primary}`,
      }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: BT.text.cyan, marginBottom: 4 }}>
          THE DECISION THIS PAGE DRIVES
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary }}>
          How is this submarket performing in foot traffic, digital presence, and resident sentiment?
        </div>
      </div>

      {/* Traffic Vitals */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
          Traffic Vitals
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {TRAFFIC_VITALS.map((vital) => (
            <div key={vital.id} style={{
              padding: 16,
              background: BT.bg.elevated,
              borderRadius: 8,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.primary }}>
                {vital.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.secondary, marginTop: 4 }}>
                {vital.label}
              </div>
              <div style={{ 
                fontSize: 10, 
                color: vital.direction === 'up' ? BT.text.green : BT.accent.red,
                marginTop: 4,
              }}>
                {vital.direction === 'up' ? '▲' : '▼'} {vital.trend}
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                <Sparkline 
                  data={vital.sparkline} 
                  color={vital.direction === 'up' ? BT.text.green : BT.accent.red} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Gauges + Walk-In Patterns */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Score Gauges */}
        <div style={{ flex: '0 0 300px', ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 20 }}>
            Traffic Scores
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <ScoreGauge label="Physical (T-02)" value={QUADRANT_DATA.physicalScore} />
            <ScoreGauge label="Digital (T-03)" value={QUADRANT_DATA.digitalScore} />
          </div>
          
          {/* Quadrant Badge */}
          <div style={{
            marginTop: 20,
            padding: 12,
            background: `${QUADRANT_DATA.quadrantColor}20`,
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: QUADRANT_DATA.quadrantColor }}>
              {QUADRANT_DATA.quadrant}
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
              Rank #{QUADRANT_DATA.submarketRank} of {QUADRANT_DATA.submarketTotal} submarkets
            </div>
            <div style={{ 
              fontSize: 10, 
              color: QUADRANT_DATA.trajectory.direction === 'up' ? BT.text.green : BT.accent.red,
              marginTop: 4,
            }}>
              {QUADRANT_DATA.trajectory.direction === 'up' ? '▲' : '▼'} 
              {QUADRANT_DATA.trajectory.delta.toFixed(1)}% trajectory ({(QUADRANT_DATA.trajectory.confidence * 100).toFixed(0)}% conf)
            </div>
          </div>
        </div>

        {/* Walk-In Patterns */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Walk-In Patterns
            </h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['daily', 'hourly'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setWalkInView(view)}
                  style={{
                    padding: '4px 12px',
                    background: walkInView === view ? BT.accent.blue : BT.bg.elevated,
                    color: walkInView === view ? '#fff' : BT.text.secondary,
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {walkInData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  height: `${(d.value / walkInMax) * 100}%`,
                  background: `linear-gradient(180deg, ${BT.text.cyan} 0%, ${BT.accent.blue} 100%)`,
                  borderRadius: '4px 4px 0 0',
                  minHeight: 4,
                }} />
                <span style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>{d.label}</span>
                <span style={{ fontSize: 9, color: BT.text.secondary }}>{d.value}</span>
              </div>
            ))}
          </div>

          {walkInView === 'daily' && (
            <div style={{ 
              marginTop: 12, 
              padding: 10, 
              background: BT.bg.elevated, 
              borderRadius: 6,
              fontSize: 11,
              color: BT.text.muted,
            }}>
              📊 <span style={{ color: BT.text.green, fontWeight: 600 }}>Saturday</span> peak (23.4%) · 
              <span style={{ color: BT.accent.amber }}> Sunday</span> low (6.5%) · 
              Best staffing: Fri-Sat 10am-4pm
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Review Sentiment */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
          Review Sentiment by Category
        </h3>
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Category Breakdown */}
          <div style={{ flex: 1 }}>
            {REVIEW_SENTIMENTS.map((cat, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: BT.text.secondary }}>{cat.category}</span>
                  <span style={{ 
                    fontSize: 10, 
                    color: cat.trend === 'improving' ? BT.text.green : cat.trend === 'declining' ? BT.accent.red : BT.text.muted,
                  }}>
                    {cat.trend === 'improving' ? '↗' : cat.trend === 'declining' ? '↘' : '→'} {cat.trend}
                  </span>
                </div>
                <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${cat.positive}%`, 
                    background: BT.text.green,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    {cat.positive > 15 && `${cat.positive}%`}
                  </div>
                  <div style={{ 
                    width: `${cat.neutral}%`, 
                    background: BT.text.muted,
                  }} />
                  <div style={{ 
                    width: `${cat.negative}%`, 
                    background: BT.accent.red,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    {cat.negative > 10 && `${cat.negative}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sentiment Trend */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 8 }}>Sentiment Trend (12mo)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {REVIEW_TREND.slice(-8).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 50, fontSize: 10, color: BT.text.muted }}>{d.month}</span>
                  <div style={{ 
                    flex: 1, 
                    height: 14, 
                    background: BT.bg.elevated, 
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(d.avgSentiment / 5) * 100}%`,
                      height: '100%',
                      background: d.avgSentiment >= 4 ? BT.text.green : d.avgSentiment >= 3.5 ? BT.accent.amber : BT.accent.red,
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ width: 24, fontSize: 10, fontWeight: 600, color: BT.text.primary, textAlign: 'right' }}>
                    {d.avgSentiment.toFixed(1)}
                  </span>
                  <span style={{ width: 20, fontSize: 9, color: BT.text.muted }}>
                    ({d.reviewCount})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Top Properties */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
          Top Properties by Traffic
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Property</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Physical (T-02)</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Digital (T-03)</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Walk-Ins/Wk</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Quadrant</th>
            </tr>
          </thead>
          <tbody>
            {TOP_PROPERTIES.map((prop, i) => {
              const physColors = scoreColor(prop.physicalScore);
              const digColors = scoreColor(prop.digitalScore);
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{prop.name}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: physColors.btBg,
                      color: physColors.btText,
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {prop.physicalScore}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: digColors.btBg,
                      color: digColors.btText,
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {prop.digitalScore}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600 }}>
                    {prop.walkIns}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 8px',
                      background: prop.quadrant === 'Validated Winner' ? 'rgba(59,130,246,0.15)' :
                                 prop.quadrant === 'Hidden Gem' ? 'rgba(16,185,129,0.15)' :
                                 prop.quadrant === 'Hype Risk' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)',
                      color: prop.quadrant === 'Validated Winner' ? '#3b82f6' :
                             prop.quadrant === 'Hidden Gem' ? '#10b981' :
                             prop.quadrant === 'Hype Risk' ? '#f97316' : '#ef4444',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {prop.quadrant}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: '12px 16px',
        background: BT.bg.card,
        borderRadius: 8,
        border: `1px solid ${BT.border.subtle}`,
        fontSize: 11,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, background: BT.text.green, borderRadius: 2 }} />
          <span style={{ color: BT.text.muted }}>Positive</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, background: BT.text.muted, borderRadius: 2 }} />
          <span style={{ color: BT.text.muted }}>Neutral</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, background: BT.accent.red, borderRadius: 2 }} />
          <span style={{ color: BT.text.muted }}>Negative</span>
        </div>
        <div style={{ marginLeft: 'auto', color: BT.text.cyan }}>
          Data: Traffic Engine T-02/T-03 + Google Reviews M-10
        </div>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating traffic analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.traffic_demand && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.traffic_demand} />
            </div>
          )}
          {commentary.signalCommentary?.momentum && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="momentum" commentary={commentary.signalCommentary.momentum} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketTrafficTab;
