import { useState, useEffect } from 'react';
import {
  TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Clock,
  AlertCircle, BarChart3, Gauge, Layers, Zap,
  ChevronRight, Activity,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface ConversionChain {
  visibility_capture_rate: number;
  apartment_seeker_pct: number;
  stop_probability: number;
  combined_rate: number;
  source: 'visibility_assessment' | 'submarket_calibrated' | 'default';
}

interface HourlyPotential {
  hour: number;
  directional_volume: number;
  walk_in_potential: number;
}

interface DailyBreakdown {
  day: string;
  dow_factor: number;
  walk_ins: number;
}

interface PhysicalTrafficScore {
  score: number;
  adt_percentile: number;
  walkins_percentile: number;
  adt_component: number;
  walkins_component: number;
  submarket_property_count: number;
  submarket_id: string;
}

interface TrendPattern {
  name: string;
  icon: string;
  confidence: number;
  condition: string;
  action: string;
  timeline: string;
  signals_used: string[];
}

interface PredictionBreakdown {
  physical_factors: number;
  market_demand_factors: number;
  supply_demand_adjustment: number;
  base_before_adjustment: number;
  effective_base_adt?: number;
  distance_decay?: number;
  road_class_weight?: number;
  frontage_factor?: number;
  multi_segment_exposure?: number;
  temporal_adjusted_adt?: number;
  temporal_source?: 'fdot_profile' | 'google_realtime' | 'default';
  directional_factor?: number;
  hourly_distribution?: Record<string, number>;
  traffic_trajectory?: number;
  trend_momentum?: number;
  trend_direction?: string;
}

interface PredictionData {
  property_id: string;
  weekly_walk_ins: number;
  daily_average: number;
  peak_hour_estimate: number;
  breakdown: PredictionBreakdown;
  conversion_chain?: ConversionChain;
  hourly_potential?: HourlyPotential[];
  daily_breakdown?: DailyBreakdown[];
  physical_traffic_score?: PhysicalTrafficScore;
  detected_patterns?: TrendPattern[];
  temporal_patterns: {
    weekday_avg: number;
    weekend_avg: number;
    peak_day: string;
    peak_hour: string;
  };
  confidence: {
    score: number;
    tier: 'High' | 'Medium' | 'Low';
    breakdown: Record<string, number>;
  };
  market_context: {
    submarket: string;
    market_condition: string;
    foot_traffic_index: number;
    supply_demand_ratio: number;
  };
  model_version: string;
  data_sources?: any;
}

interface TrafficPredictionsTabProps {
  dealId: string;
  propertyId?: string;
}

const PATTERN_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  DEMAND_SURGE: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  MOMENTUM_CONFIRMED: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  DIGITAL_DIVERGENCE: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  MARKET_EXHAUSTION: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  SEASONAL_NOISE: { bg: 'bg-stone-50', border: 'border-stone-300', text: 'text-stone-700', badge: 'bg-stone-100 text-stone-600' },
};

function TrajectoryArrow({ direction, value }: { direction?: string; value?: number }) {
  if (direction === 'accelerating' || (value && value > 0.05)) {
    return (
      <div className="flex items-center gap-1 text-emerald-600">
        <ArrowUpRight size={16} />
        <span className="text-xs font-semibold">Accelerating</span>
        {value !== undefined && <span className="text-[10px] font-mono">+{(value * 100).toFixed(1)}%</span>}
      </div>
    );
  }
  if (direction === 'declining' || direction === 'decelerating' || (value && value < -0.05)) {
    return (
      <div className="flex items-center gap-1 text-red-500">
        <ArrowDownRight size={16} />
        <span className="text-xs font-semibold">{direction === 'declining' ? 'Declining' : 'Decelerating'}</span>
        {value !== undefined && <span className="text-[10px] font-mono">{(value * 100).toFixed(1)}%</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-stone-400">
      <Minus size={16} />
      <span className="text-xs font-semibold">Stable</span>
    </div>
  );
}

export default function TrafficPredictionsTab({ dealId, propertyId }: TrafficPredictionsTabProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [patterns, setPatterns] = useState<TrendPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;

    setLoading(true);
    setError(null);

    const fetchPrediction = async () => {
      try {
        const projRes = await apiClient.get(`/api/v1/leasing-traffic/projection/${dealId}?view=weekly`);
        const projData = projRes.data;

        if (projData.data_sources) {
          const ds = projData.data_sources;
          const breakdown: PredictionBreakdown = {
            physical_factors: 0,
            market_demand_factors: 0,
            supply_demand_adjustment: 0,
            base_before_adjustment: 0,
            effective_base_adt: ds.traffic_context?.effective_base_adt,
            distance_decay: ds.traffic_context?.distance_decay_primary,
            road_class_weight: ds.traffic_context?.road_class_weight_primary,
            frontage_factor: ds.traffic_context?.frontage_factor,
            multi_segment_exposure: ds.traffic_context?.total_exposure,
            temporal_adjusted_adt: ds.traffic_context?.temporal_adjusted_adt,
            temporal_source: ds.traffic_context?.temporal_source,
            directional_factor: ds.traffic_context?.directional_factor,
            hourly_distribution: ds.traffic_context?.hourly_distribution,
            traffic_trajectory: ds.trajectory?.traffic_trajectory,
            trend_momentum: ds.trajectory?.trend_momentum,
            trend_direction: ds.trajectory?.trend_direction,
          };

          const periods = projData.periods || [];
          const latestPeriod = periods.find((p: any) => !p.isActual) || periods[0];

          setPrediction({
            property_id: dealId,
            weekly_walk_ins: latestPeriod?.adjTraffic || latestPeriod?.baseTraffic || 0,
            daily_average: Math.round((latestPeriod?.adjTraffic || latestPeriod?.baseTraffic || 0) / 7),
            peak_hour_estimate: 0,
            breakdown,
            conversion_chain: projData.conversion_chain,
            hourly_potential: projData.hourly_potential,
            daily_breakdown: projData.daily_breakdown,
            physical_traffic_score: projData.physical_traffic_score,
            detected_patterns: projData.detected_patterns,
            temporal_patterns: {
              weekday_avg: latestPeriod?.adjTraffic ? Math.round(latestPeriod.adjTraffic * 0.7 / 5) : 0,
              weekend_avg: latestPeriod?.adjTraffic ? Math.round(latestPeriod.adjTraffic * 0.3 / 2) : 0,
              peak_day: 'Saturday',
              peak_hour: '11:00 AM - 12:00 PM',
            },
            confidence: { score: 0.5, tier: 'Medium', breakdown: {} },
            market_context: {
              submarket: '',
              market_condition: 'BALANCED',
              foot_traffic_index: 100,
              supply_demand_ratio: 1.0,
            },
            model_version: '1.2.0',
            data_sources: ds,
          });

          if (projData.detected_patterns) {
            setPatterns(projData.detected_patterns);
          }
        }
      } catch {
        try {
          const propId = propertyId || dealId;
          const predRes = await apiClient.get(`/api/v1/leasing-traffic/predict/${propId}`);
          if (predRes.data) {
            setPrediction(predRes.data);
            if (predRes.data.detected_patterns) {
              setPatterns(predRes.data.detected_patterns);
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load prediction');
        }
      }

      try {
        const patRes = await apiClient.get(`/api/v1/leasing-traffic/trend-patterns/${dealId}`);
        if (patRes.data?.patterns?.length) {
          setPatterns(patRes.data.patterns);
        }
      } catch {}

      setLoading(false);
    };

    fetchPrediction();
  }, [dealId, propertyId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-500 text-sm">Loading predictions...</p>
      </div>
    );
  }

  if (error && !prediction) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
        <AlertCircle size={32} className="mx-auto text-stone-300 mb-3" />
        <p className="text-stone-500 text-sm">No prediction data available yet.</p>
        <p className="text-stone-400 text-xs mt-1">Link a property and upload traffic data to generate predictions.</p>
      </div>
    );
  }

  const bd = prediction?.breakdown;
  const tc = prediction?.data_sources?.traffic_context;
  const dailyBreakdown = prediction?.daily_breakdown || [];
  const hourlyPotential = prediction?.hourly_potential || [];
  const convChain = prediction?.conversion_chain;
  const physScore = prediction?.physical_traffic_score;
  const maxDayWalkins = dailyBreakdown.length > 0 ? Math.max(...dailyBreakdown.map(d => d.walk_ins)) : 1;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-stone-500" />
          <span className="font-semibold text-stone-900 text-sm">Effective Base ADT</span>
          {bd?.temporal_source && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
              bd.temporal_source === 'fdot_profile' ? 'bg-emerald-100 text-emerald-700' :
              bd.temporal_source === 'google_realtime' ? 'bg-blue-100 text-blue-700' :
              'bg-stone-100 text-stone-500'
            }`}>
              {bd.temporal_source === 'fdot_profile' ? 'FDOT Profile' :
               bd.temporal_source === 'google_realtime' ? 'Google RT' : 'Default'}
            </span>
          )}
        </div>

        {bd?.effective_base_adt ? (
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <div>
                <div className="text-3xl font-bold text-stone-900">
                  {Math.round(bd.effective_base_adt).toLocaleString()}
                </div>
                <div className="text-xs text-stone-500">Effective ADT (vehicles/day)</div>
              </div>
              {bd.temporal_adjusted_adt && (
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold text-stone-700">
                    {Math.round(bd.temporal_adjusted_adt).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-stone-400">Temporal Adjusted</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="text-[10px] text-stone-400 uppercase mb-1">Distance Decay</div>
                <div className="text-sm font-bold text-stone-900">
                  {bd.distance_decay !== undefined ? `${(bd.distance_decay * 100).toFixed(1)}%` : '—'}
                </div>
                {tc?.primary_adt_distance_m !== undefined && (
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {(tc.primary_adt_distance_m / 1609).toFixed(2)} mi
                  </div>
                )}
              </div>
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="text-[10px] text-stone-400 uppercase mb-1">Road Class Wt</div>
                <div className="text-sm font-bold text-stone-900">
                  {bd.road_class_weight !== undefined ? `${bd.road_class_weight.toFixed(1)}` : '—'}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {tc?.primary_road_classification || '—'}
                </div>
              </div>
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="text-[10px] text-stone-400 uppercase mb-1">Frontage</div>
                <div className="text-sm font-bold text-stone-900">
                  {bd.frontage_factor !== undefined ? `${bd.frontage_factor.toFixed(1)}x` : '—'}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  {tc?.frontage_type || 'main'}
                </div>
              </div>
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="text-[10px] text-stone-400 uppercase mb-1">Multi-Segment</div>
                <div className="text-sm font-bold text-stone-900">
                  {bd.multi_segment_exposure ? bd.multi_segment_exposure.toLocaleString() : '—'}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  Total exposure
                </div>
              </div>
            </div>

            {bd.directional_factor !== undefined && (
              <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                <div className="text-[10px] text-stone-400 uppercase">D-Factor</div>
                <div className="text-sm font-bold text-stone-700">{bd.directional_factor.toFixed(2)}</div>
                <div className="text-[10px] text-stone-400">
                  ({tc?.property_direction || 'inbound'} direction)
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Layers size={28} className="mx-auto text-stone-300 mb-2" />
            <p className="text-xs text-stone-400">Link property to DOT ADT stations to see effective base ADT breakdown</p>
          </div>
        )}
      </div>

      {bd?.hourly_distribution && Object.keys(bd.hourly_distribution).length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-stone-500" />
            <span className="font-semibold text-stone-900 text-sm">FDOT Hourly Curve</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono uppercase">
              Temporal Profile
            </span>
          </div>
          <div className="flex items-end gap-1 h-24">
            {Object.entries(bd.hourly_distribution)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([hour, pct]) => {
                const maxPct = Math.max(...Object.values(bd.hourly_distribution!));
                const barH = maxPct > 0 ? (pct / maxPct) * 100 : 0;
                const h = parseInt(hour);
                const isLeasing = h >= 9 && h < 18;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full relative" style={{ height: '80px' }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t ${isLeasing ? 'bg-stone-700' : 'bg-stone-200'}`}
                        style={{ height: `${barH}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-stone-400 font-mono">{h}</span>
                  </div>
                );
              })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-stone-400">
            <span>12am</span>
            <span className="text-stone-600 font-medium">Leasing Hours (9am-6pm)</span>
            <span>11pm</span>
          </div>
        </div>
      )}

      {dailyBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-stone-500" />
            <span className="font-semibold text-stone-900 text-sm">Daily Walk-In Breakdown</span>
          </div>
          <div className="space-y-2">
            {dailyBreakdown.map(d => {
              const pct = maxDayWalkins > 0 ? (d.walk_ins / maxDayWalkins) * 100 : 0;
              const isSat = d.day === 'Sat';
              return (
                <div key={d.day} className="flex items-center gap-3">
                  <span className={`text-xs w-8 font-mono ${isSat ? 'text-emerald-700 font-bold' : 'text-stone-500'}`}>
                    {d.day}
                  </span>
                  <div className="flex-1 bg-stone-100 rounded-full h-3 relative">
                    <div
                      className={`h-full rounded-full ${isSat ? 'bg-emerald-500' : 'bg-stone-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-12 text-right ${isSat ? 'text-emerald-700 font-bold' : 'text-stone-700'}`}>
                    {d.walk_ins.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-stone-400 w-10 text-right">{d.dow_factor.toFixed(2)}x</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              Weekly Total: <strong className="text-stone-900">
                {dailyBreakdown.reduce((s, d) => s + d.walk_ins, 0).toFixed(1)}
              </strong> walk-ins
            </span>
            {isSaturdayPeak(dailyBreakdown) && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Saturday Peak
              </span>
            )}
          </div>
        </div>
      )}

      {convChain && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-stone-500" />
            <span className="font-semibold text-stone-900 text-sm">Conversion Chain</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
              convChain.source === 'visibility_assessment' ? 'bg-emerald-100 text-emerald-700' :
              convChain.source === 'submarket_calibrated' ? 'bg-blue-100 text-blue-700' :
              'bg-stone-100 text-stone-500'
            }`}>
              {convChain.source.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: 'Visibility Capture', value: convChain.visibility_capture_rate, pct: true },
              { label: 'Apartment Seekers', value: convChain.apartment_seeker_pct, pct: true },
              { label: 'Stop Probability', value: convChain.stop_probability, pct: true },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1 bg-stone-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-stone-900">
                    {(step.value * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{step.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-stone-300 text-xs">×</span>
                )}
              </div>
            ))}
            <span className="text-stone-300 text-xs">=</span>
            <div className="bg-stone-900 rounded-lg p-3 text-center min-w-[80px]">
              <div className="text-lg font-bold text-white">
                {(convChain.combined_rate * 10000).toFixed(2)}
              </div>
              <div className="text-[10px] text-stone-300 mt-0.5">per 10k vehicles</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-stone-500" />
          <span className="font-semibold text-stone-900 text-sm">Trajectory (T-07)</span>
        </div>
        <div className="flex items-center gap-6">
          <TrajectoryArrow
            direction={bd?.trend_direction}
            value={bd?.traffic_trajectory}
          />
          {bd?.trend_momentum !== undefined && (
            <div className="text-xs text-stone-500">
              Digital Momentum: <strong className="text-stone-800">{bd.trend_momentum.toFixed(1)}%</strong> QoQ
            </div>
          )}
        </div>
        {bd?.traffic_trajectory !== undefined && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="text-[10px] text-stone-400 uppercase mb-1">T-07 Score</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-stone-100 rounded-full h-2">
                <div
                  className={`h-full rounded-full ${
                    bd.traffic_trajectory > 0.05 ? 'bg-emerald-500' :
                    bd.traffic_trajectory < -0.05 ? 'bg-red-500' :
                    'bg-stone-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, 50 + bd.traffic_trajectory * 100))}%` }}
                />
              </div>
              <span className="text-xs font-mono text-stone-700">
                {bd.traffic_trajectory > 0 ? '+' : ''}{(bd.traffic_trajectory * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {physScore && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-stone-500" />
            <span className="font-semibold text-stone-900 text-sm">Physical Traffic Score (T-02)</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e7e5e4" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={physScore.score >= 70 ? '#059669' : physScore.score >= 40 ? '#d97706' : '#dc2626'}
                  strokeWidth="3"
                  strokeDasharray={`${physScore.score} ${100 - physScore.score}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-stone-900">{Math.round(physScore.score)}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">ADT Percentile</span>
                <span className="text-xs font-bold text-stone-800">{Math.round(physScore.adt_percentile)}th</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">Walk-ins Percentile</span>
                <span className="text-xs font-bold text-stone-800">{Math.round(physScore.walkins_percentile)}th</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">Submarket Properties</span>
                <span className="text-xs font-bold text-stone-800">{physScore.submarket_property_count}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-stone-400">ADT Component (60%)</span>
              <div className="font-bold text-stone-800">{physScore.adt_component.toFixed(1)}</div>
            </div>
            <div>
              <span className="text-stone-400">Walk-ins Component (40%)</span>
              <div className="font-bold text-stone-800">{physScore.walkins_component.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-stone-500" />
          <span className="font-semibold text-stone-900 text-sm">Trend Patterns</span>
          <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-mono">
            {patterns.length} detected
          </span>
        </div>

        {patterns.length > 0 ? (
          <div className="grid gap-3">
            {patterns.map((pat, i) => {
              const style = PATTERN_STYLES[pat.name] || PATTERN_STYLES.SEASONAL_NOISE;
              return (
                <div key={i} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{pat.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-sm ${style.text}`}>
                          {pat.name.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${style.badge}`}>
                          {pat.confidence}% conf
                        </span>
                      </div>
                      <p className={`text-xs ${style.text} opacity-80 mb-2`}>{pat.condition}</p>
                      <div className={`text-xs font-semibold ${style.text}`}>
                        {pat.action}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-stone-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {pat.timeline}
                        </span>
                        <span>
                          Signals: {pat.signals_used.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-stone-50 rounded-xl border border-stone-200 p-6 text-center">
            <TrendingUp size={24} className="mx-auto text-stone-300 mb-2" />
            <p className="text-xs text-stone-400">
              Trend patterns will appear when digital momentum and AADT data are available.
            </p>
            <p className="text-[10px] text-stone-300 mt-1">
              Patterns: Demand Surge, Momentum Confirmed, Digital Divergence, Market Exhaustion, Seasonal Noise
            </p>
          </div>
        )}
      </div>

      {hourlyPotential.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-stone-500" />
            <span className="font-semibold text-stone-900 text-sm">Hourly Walk-In Potential</span>
            <span className="text-[10px] text-stone-400">9am - 6pm leasing hours</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-2 py-2 text-stone-400 font-normal uppercase text-[10px]">Hour</th>
                  <th className="text-right px-2 py-2 text-stone-400 font-normal uppercase text-[10px]">Volume</th>
                  <th className="text-right px-2 py-2 text-stone-400 font-normal uppercase text-[10px]">Walk-ins</th>
                  <th className="px-2 py-2 text-stone-400 font-normal uppercase text-[10px]"></th>
                </tr>
              </thead>
              <tbody>
                {hourlyPotential.map(h => {
                  const maxWalkin = Math.max(...hourlyPotential.map(hp => hp.walk_in_potential));
                  const pct = maxWalkin > 0 ? (h.walk_in_potential / maxWalkin) * 100 : 0;
                  return (
                    <tr key={h.hour} className="border-b border-stone-50">
                      <td className="px-2 py-1.5 font-mono text-stone-700">
                        {h.hour > 12 ? `${h.hour - 12}pm` : h.hour === 12 ? '12pm' : `${h.hour}am`}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-stone-600">
                        {Math.round(h.directional_volume).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-stone-900 font-medium">
                        {h.walk_in_potential.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 w-24">
                        <div className="bg-stone-100 rounded-full h-1.5">
                          <div className="h-full bg-stone-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function isSaturdayPeak(breakdown: DailyBreakdown[]): boolean {
  if (breakdown.length === 0) return false;
  const satDay = breakdown.find(d => d.day === 'Sat');
  if (!satDay) return false;
  return satDay.walk_ins >= Math.max(...breakdown.map(d => d.walk_ins));
}
