import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';

interface DealsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

type Quadrant = 'Hidden Gem' | 'Validated Winner' | 'Hype Risk' | 'Dead Weight';
type Movement = 'up' | 'down' | 'neutral';
type LifecyclePhase = 'Emergence' | 'Acceleration' | 'Maturation' | 'Contraction';
type TrafficQualification = 'Qualified' | 'Marginal' | 'Disqualified';

interface CorrelationMetric {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationMetric[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

const QUADRANT_STYLES: Record<Quadrant, { bg: string; text: string }> = {
  'Hidden Gem': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'Validated Winner': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Hype Risk': { bg: 'bg-orange-100', text: 'text-orange-800' },
  'Dead Weight': { bg: 'bg-red-100', text: 'text-red-800' },
};

const MOVEMENT_DISPLAY: Record<Movement, { arrow: string; color: string }> = {
  up: { arrow: '\u25B2', color: 'text-green-600' },
  down: { arrow: '\u25BC', color: 'text-red-600' },
  neutral: { arrow: '\u25AC', color: 'text-gray-400' },
};

const LIFECYCLE_STYLES: Record<LifecyclePhase, { bg: string; text: string; icon: string }> = {
  'Emergence': { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: '\uD83C\uDF31' },
  'Acceleration': { bg: 'bg-green-100', text: 'text-green-800', icon: '\uD83D\uDE80' },
  'Maturation': { bg: 'bg-amber-100', text: 'text-amber-800', icon: '\uD83C\uDFDB\uFE0F' },
  'Contraction': { bg: 'bg-red-100', text: 'text-red-800', icon: '\uD83D\uDCC9' },
};

const TRAFFIC_QUAL_STYLES: Record<TrafficQualification, { icon: string; color: string; bg: string }> = {
  'Qualified': { icon: '\u2713', color: 'text-green-700', bg: 'bg-green-50' },
  'Marginal': { icon: '\u26A0', color: 'text-amber-700', bg: 'bg-amber-50' },
  'Disqualified': { icon: '\u2717', color: 'text-red-700', bg: 'bg-red-50' },
};

const SIGNAL_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  bullish: { bg: 'bg-green-50', text: 'text-green-700', icon: '\u25B2' },
  bearish: { bg: 'bg-red-50', text: 'text-red-700', icon: '\u25BC' },
  neutral: { bg: 'bg-gray-50', text: 'text-gray-600', icon: '\u25AC' },
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-amber-100 text-amber-800',
  insufficient: 'bg-gray-100 text-gray-500',
};

const ALL_QUADRANTS: Quadrant[] = ['Hidden Gem', 'Validated Winner', 'Hype Risk', 'Dead Weight'];

const DealsTab: React.FC<DealsTabProps> = ({ marketId, summary, onUpdate }) => {
  const [expandedPipeline, setExpandedPipeline] = useState(false);
  const [activeQuadrants, setActiveQuadrants] = useState<Set<Quadrant>>(new Set());
  const [showPcsBreakdown, setShowPcsBreakdown] = useState(false);
  const [correlationReport, setCorrelationReport] = useState<CorrelationReport | null>(null);
  const [correlationLoading, setCorrelationLoading] = useState(true);
  const [correlationError, setCorrelationError] = useState<string | null>(null);
  const [showPendingMetrics, setShowPendingMetrics] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCorrelations = async () => {
      try {
        setCorrelationLoading(true);
        setCorrelationError(null);
        const response: any = await apiClient.get('/correlations/report');
        const report = response?.data || response;
        if (!cancelled && report?.correlations) {
          setCorrelationReport(report);
        } else if (!cancelled) {
          setCorrelationError('Invalid response format');
        }
      } catch (err: any) {
        if (!cancelled) {
          setCorrelationError(err?.message || 'Failed to load correlation data');
        }
      } finally {
        if (!cancelled) setCorrelationLoading(false);
      }
    };
    fetchCorrelations();
    return () => { cancelled = true; };
  }, []);

  const toggleQuadrant = (q: Quadrant) => {
    setActiveQuadrants((prev) => {
      const next = new Set(prev);
      if (next.has(q)) {
        next.delete(q);
      } else {
        next.add(q);
      }
      return next;
    });
  };

  const getCorMetric = (id: string): CorrelationMetric | undefined => {
    return correlationReport?.correlations.find(c => c.id === id);
  };

  const featuredDeal = {
    rank: 1,
    name: 'PINES AT MIDTOWN',
    units: 180,
    year: 1992,
    class: 'B',
    submarket: 'Midtown',
    jedi: 92,
    strategy: 'Value-Add Flip',
    arbSpread: '+7.4%',
    lossToLease: '$220/unit',
    ltlPct: '14.8%',
    sellerMotivation: 78,
    holdYears: 6.9,
    demandScore: 82,
    clusterDistance: '0.8mi',
    walkIns: '1,840/week',
    trafficCorrelation: 'High physical, low digital',
    captureRate: '12.4%',
    trafficShare: '8.2%',
    supplyDemandRatio: 1.18,
    compSetCount: 12,
    compSetAvgRent: '$1,720',
    confidence: '82%',
    pcsRank: 3,
    pcsMovement: 'up' as Movement,
    pcsMovementDelta: 2,
    quadrant: 'Hidden Gem' as Quadrant,
    targetScore: 91,
    physicalScore: 76,
    digitalScore: 34,
    lifecyclePhase: 'Acceleration' as LifecyclePhase,
    trajectory: '+19.1%',
    trajectoryLabel: 'Demand Surge',
    surgeIndex: '+35%',
    tar: 1.28,
    trafficQualified: 'Qualified' as TrafficQualification,
    pcsComponents: { traffic: 76, revenue: 88, occupancy: 71, opsQuality: 62, assetQuality: 54 },
    performanceGap: { expectedRank: 1, actualRank: 3, gap: 2 },
    managementCompany: 'Peachtree Residential',
    managementPcsPercentile: 31,
    managementRating: 'bottom quartile',
    debtMaturity: 'Q3 2026',
    isTripleTrigger: true,
    sentimentValue: { stars: 3.4, peerStars: 4.2, premium: '$110/unit', topComplaint: 'Maintenance' },
    likeKindAvgRent: '$1,890/unit',
    likeKindDiscount: '9%',
    amenityGap: { missing: ['package lockers', 'dog park'], totalTopAmenities: 3, estRentLift: '$85/unit' },
  };

  const compactDeals = [
    { rank: 2, name: 'BROOKHAVEN TERRACE', units: 240, year: 1998, class: 'B+', submarket: 'Brookhaven', jedi: 87, strategy: 'Core-Plus Hold', ltl: '$180/unit', walkIns: '2,100/wk', trafficShare: '6.8%', pcsRank: 7, pcsMovement: 'up' as Movement, pcsMovementDelta: 3, quadrant: 'Validated Winner' as Quadrant, targetScore: 84, lifecyclePhase: 'Maturation' as LifecyclePhase, trajectory: '+4.2%', trajectoryLabel: 'Steady', trafficQualified: 'Qualified' as TrafficQualification, tar: 1.12 },
    { rank: 3, name: 'DECATUR STATION', units: 156, year: 1985, class: 'C+', submarket: 'Decatur', jedi: 84, strategy: 'Heavy Value-Add', ltl: '$290/unit', walkIns: '1,420/wk', trafficShare: '9.1%', pcsRank: 12, pcsMovement: 'down' as Movement, pcsMovementDelta: 4, quadrant: 'Hype Risk' as Quadrant, targetScore: 72, lifecyclePhase: 'Acceleration' as LifecyclePhase, trajectory: '-8.2%', trajectoryLabel: 'Decelerating', trafficQualified: 'Marginal' as TrafficQualification, tar: 0.91 },
    { rank: 4, name: 'SANDY SPRINGS CROSSING', units: 312, year: 2001, class: 'B+', submarket: 'Sandy Springs', jedi: 81, strategy: 'Value-Add Flip', ltl: '$155/unit', walkIns: '2,680/wk', trafficShare: '5.4%', pcsRank: 15, pcsMovement: 'neutral' as Movement, pcsMovementDelta: 0, quadrant: 'Dead Weight' as Quadrant, targetScore: 58, lifecyclePhase: 'Contraction' as LifecyclePhase, trajectory: '-2.1%', trajectoryLabel: 'Flat', trafficQualified: 'Disqualified' as TrafficQualification, tar: 0.74 },
  ];

  const allOpportunityDeals = [
    { ...featuredDeal, isFeatured: true },
    ...compactDeals.map((d) => ({ ...d, isFeatured: false })),
  ];

  const filteredDeals = activeQuadrants.size === 0
    ? allOpportunityDeals
    : allOpportunityDeals.filter((d) => activeQuadrants.has(d.quadrant));

  const kanbanColumns = [
    {
      stage: 'INTAKE', count: 3, color: 'bg-gray-50', headerColor: 'bg-gray-600',
      deals: [
        { name: 'Midtown 440', units: 220, class: 'A-', jedi: 74, days: '3d' },
        { name: 'Buckhead Place', units: 180, class: 'B+', jedi: 71, days: '5d' },
        { name: 'Westside Lofts', units: 96, class: 'B', jedi: 68, days: '1d' },
      ],
    },
    {
      stage: 'SCREENING', count: 2, color: 'bg-blue-50', headerColor: 'bg-blue-600',
      deals: [
        { name: 'Peachtree Walk', units: 310, class: 'B+', jedi: 82, days: '12d' },
        { name: 'Cascade Heights', units: 144, class: 'C+', jedi: 76, days: '8d' },
      ],
    },
    {
      stage: 'ANALYSIS', count: 1, color: 'bg-amber-50', headerColor: 'bg-amber-600',
      deals: [
        { name: 'Heritage Oaks', units: 280, class: 'B', jedi: 85, days: '22d', omVariance: '-8.2%' },
      ],
    },
    {
      stage: 'EXECUTION', count: 1, color: 'bg-green-50', headerColor: 'bg-green-600',
      deals: [
        { name: 'Summit Creek', units: 196, class: 'B+', jedi: 88, days: '45d' },
      ],
    },
  ];

  const dealActivityRows = [
    { property: 'Parkside at Buckhead', type: 'Listed', units: 280, price: '$52.4M', perUnit: '$187K', assessment: '\u26A0\uFE0F S-05 cluster risk \u2014 3 deliveries within 0.5mi by Q3 2026', pcsRank: 5, pcsMovement: 'down' as Movement, pcsMovementDelta: 2, quadrant: 'Hype Risk' as Quadrant, targetScore: 67 },
    { property: 'The Vue at Midtown', type: 'Listed', units: 196, price: '$38.2M', perUnit: '$195K', assessment: '\u2705 Strong fundamentals \u2014 D-09: 84, low supply, T-01 validated', pcsRank: 2, pcsMovement: 'up' as Movement, pcsMovementDelta: 1, quadrant: 'Validated Winner' as Quadrant, targetScore: 88 },
    { property: 'Glenwood Gardens', type: 'Closed', units: 320, price: '$64.0M', perUnit: '$200K', assessment: '\u2705 Fair price \u2014 within 3% of AI estimate, good basis', pcsRank: 8, pcsMovement: 'neutral' as Movement, pcsMovementDelta: 0, quadrant: 'Hidden Gem' as Quadrant, targetScore: 79 },
    { property: 'Cascade Pointe', type: 'Closed', units: 148, price: '$24.4M', perUnit: '$165K', assessment: '\u26A0\uFE0F Buyer overpaid by ~$12K/unit vs AI comp model', pcsRank: 22, pcsMovement: 'down' as Movement, pcsMovementDelta: 6, quadrant: 'Dead Weight' as Quadrant, targetScore: 41 },
  ];

  const arbitrageRows = [
    { property: 'PINES AT MIDTOWN', bestStrategy: 'Value-Add Flip', bestIRR: '18.4%', secondBest: 'Core-Plus Hold', secondIRR: '11.0%', spread: '7.4%' },
    { property: 'BROOKHAVEN TERRACE', bestStrategy: 'STR Hybrid', bestIRR: '16.2%', secondBest: 'Value-Add', secondIRR: '12.8%', spread: '3.4%' },
    { property: 'DECATUR STATION', bestStrategy: 'Heavy Reno Flip', bestIRR: '22.1%', secondBest: 'Value-Add Hold', secondIRR: '14.6%', spread: '7.5%' },
  ];

  const renderMovementBadge = (movement: Movement, delta: number) => {
    const { arrow, color } = MOVEMENT_DISPLAY[movement];
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${color}`}>
        {arrow}{delta > 0 ? ` ${delta}` : ''}
      </span>
    );
  };

  const renderQuadrantBadge = (quadrant: Quadrant) => {
    const { bg, text } = QUADRANT_STYLES[quadrant];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${bg} ${text}`}>
        {quadrant}
      </span>
    );
  };

  const renderLifecycleBadge = (phase: LifecyclePhase) => {
    const { bg, text, icon } = LIFECYCLE_STYLES[phase];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${bg} ${text}`}>
        {icon} {phase}
      </span>
    );
  };

  const renderTrafficQualBadge = (qual: TrafficQualification) => {
    const { icon, color, bg } = TRAFFIC_QUAL_STYLES[qual];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${color} ${bg}`}>
        {icon} Traffic {qual}
      </span>
    );
  };

  const renderTrajectory = (trajectory: string, label: string) => {
    const isPositive = trajectory.startsWith('+');
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
        T-07: {trajectory} {'\u2192'} {label}
      </span>
    );
  };

  const renderTarBadge = (tar: number) => {
    const pct = Math.round((tar - 1) * 100);
    const isUnderpriced = tar > 1;
    const color = isUnderpriced ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
    const label = isUnderpriced ? `underpriced by ${pct}%` : `overpriced by ${Math.abs(pct)}%`;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${color}`}>
        TAR: {tar.toFixed(2)} {'\u2014'} {label}
      </span>
    );
  };

  const renderPcsRank = (rank: number, movement: Movement, delta: number) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sm font-bold text-gray-900">#{rank}</span>
      {renderMovementBadge(movement, delta)}
    </span>
  );

  const renderTargetScore = (score: number) => {
    let color = 'text-gray-600 bg-gray-100';
    if (score >= 80) color = 'text-green-700 bg-green-100';
    else if (score >= 60) color = 'text-amber-700 bg-amber-100';
    else color = 'text-red-700 bg-red-100';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${color}`}>
        {score}
      </span>
    );
  };

  const renderPcsComponentBar = (label: string, value: number, color: string) => {
    const width = `${value}%`;
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-gray-500 w-16 text-right">{label}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width }} />
        </div>
        <span className="text-[10px] font-bold text-gray-700 w-6">{value}</span>
      </div>
    );
  };

  const renderSignalBadge = (signal: string | null) => {
    if (!signal) return null;
    const style = SIGNAL_STYLES[signal] || SIGNAL_STYLES.neutral;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
        {style.icon} {signal.charAt(0).toUpperCase() + signal.slice(1)}
      </span>
    );
  };

  const renderConfidenceBadge = (confidence: string) => {
    const style = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.insufficient;
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${style}`}>
        {confidence}
      </span>
    );
  };

  const renderCorrelationMetricRow = (metric: CorrelationMetric) => {
    const style = SIGNAL_STYLES[metric.signal || 'neutral'] || SIGNAL_STYLES.neutral;
    return (
      <div key={metric.id} className={`flex items-start gap-2 p-2 rounded-lg ${style.bg} border border-opacity-20`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-800">{metric.id}</span>
            <span className={`text-[11px] font-semibold ${style.text}`}>{metric.name}</span>
            {renderSignalBadge(metric.signal)}
            {renderConfidenceBadge(metric.confidence)}
            <span className="text-[9px] text-gray-400">Lead: {metric.leadTime}</span>
          </div>
          {metric.actionable && (
            <p className={`text-[11px] mt-0.5 ${style.text}`}>{metric.actionable}</p>
          )}
          {metric.xValue !== null && (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-gray-500">X: {metric.xValue}{metric.id === 'COR-16' || metric.id === 'COR-05' ? '' : '%'}</span>
              {metric.yValue !== null && <span className="text-[10px] text-gray-500">Y: {metric.yValue}%</span>}
              {metric.correlation !== null && <span className="text-[10px] text-gray-500">r: {metric.correlation}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPendingMetricRow = (metric: CorrelationMetric) => {
    return (
      <div key={metric.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-50">
        <span className="text-[10px] font-bold text-gray-400 w-12">{metric.id}</span>
        <span className="text-[10px] text-gray-500 flex-1">{metric.name}</span>
        <span className="text-[9px] text-gray-400 italic">
          {metric.missingData.length > 0 ? metric.missingData[0] : 'Data pending'}
        </span>
      </div>
    );
  };

  const computedMetrics = correlationReport?.correlations.filter(c => c.confidence !== 'insufficient') || [];
  const pendingMetrics = correlationReport?.correlations.filter(c => c.confidence === 'insufficient') || [];

  const cor01 = getCorMetric('COR-01');
  const cor03 = getCorMetric('COR-03');
  const cor04 = getCorMetric('COR-04');
  const cor05 = getCorMetric('COR-05');
  const cor06 = getCorMetric('COR-06');
  const cor09 = getCorMetric('COR-09');
  const cor13 = getCorMetric('COR-13');
  const cor14 = getCorMetric('COR-14');
  const cor15 = getCorMetric('COR-15');
  const cor16 = getCorMetric('COR-16');

  const buildAiInsight = (): string => {
    const parts: string[] = [];
    parts.push(`Hidden Gem with TAR of ${featuredDeal.tar.toFixed(2)} \u2014 location underpriced by ${Math.round((featuredDeal.tar - 1) * 100)}%.`);

    if (cor04 && cor04.confidence !== 'insufficient') {
      parts.push(cor04.actionable || '');
    } else {
      parts.push('Wages growing 2.3x faster than rents with affordability ratio at 28%.');
    }

    parts.push(`Bottom-quartile management (${featuredDeal.managementPcsPercentile}th pctile) suggests significant operational upside.`);
    parts.push(`Triple trigger target \u2014 act before ${featuredDeal.debtMaturity} debt maturity.`);
    parts.push(`Missing amenities alone could unlock +${featuredDeal.amenityGap.estRentLift} rent lift.`);

    if (cor01 && cor01.confidence !== 'insufficient' && cor01.signal === 'bullish') {
      parts.push(`Market search surge of +${cor01.xValue}% confirms demand momentum.`);
    }

    return parts.filter(Boolean).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Active Opportunities + Pipeline</h2>
            <p className="text-sm text-gray-500 mt-1">
              {summary?.market?.display_name || marketId} \u2014 26 outputs across deal intelligence
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <span className="text-lg">+</span>
            New Deal
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">AI-Recommended Opportunities</h3>
          <p className="text-sm text-gray-500 mt-0.5">JEDI identified 142 opportunities. Showing top 4:</p>
        </div>

        <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Filter by Quadrant:</span>
          {ALL_QUADRANTS.map((q) => {
            const isActive = activeQuadrants.has(q);
            const { bg, text } = QUADRANT_STYLES[q];
            return (
              <button
                key={q}
                onClick={() => toggleQuadrant(q)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  isActive
                    ? `${bg} ${text} border-current ring-2 ring-offset-1 ring-current/20`
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {q}
              </button>
            );
          })}
          {activeQuadrants.size > 0 && (
            <button
              onClick={() => setActiveQuadrants(new Set())}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {filteredDeals.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No deals match the selected quadrant filter.</div>
          )}

          {filteredDeals.map((deal) => {
            if (deal.isFeatured) {
              return (
                <div key={deal.rank} className="border-2 border-amber-300 bg-amber-50/30 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{'\uD83C\uDFC6'}</span>
                        <span className="font-bold text-gray-900 text-lg">#{featuredDeal.rank} {featuredDeal.name}</span>
                        <span className="text-sm text-gray-500">| {featuredDeal.units}u | {featuredDeal.year} | {featuredDeal.class} | {featuredDeal.submarket}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">JEDI: {featuredDeal.jedi} (C-01)</span>
                        <span className="text-gray-600">Strategy: {featuredDeal.strategy} (C-05: {featuredDeal.arbSpread} arb)</span>
                        {renderTrafficQualBadge(featuredDeal.trafficQualified)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3">
                        {renderPcsRank(featuredDeal.pcsRank, featuredDeal.pcsMovement, featuredDeal.pcsMovementDelta)}
                        {renderQuadrantBadge(featuredDeal.quadrant)}
                        {renderLifecycleBadge(featuredDeal.lifecyclePhase)}
                        {renderTargetScore(featuredDeal.targetScore)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500">Physical: <span className="font-bold text-gray-800">{featuredDeal.physicalScore}</span> | Digital: <span className="font-bold text-gray-800">{featuredDeal.digitalScore}</span></span>
                        <span className="text-[10px] text-gray-400">T-02/T-03</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderTrajectory(featuredDeal.trajectory, featuredDeal.trajectoryLabel)}
                      </div>
                    </div>
                  </div>

                  {featuredDeal.isTripleTrigger && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                      <span className="text-xs font-bold text-red-700">
                        {'\uD83C\uDFAF'} Triple Trigger: underperforming + Year {Math.floor(featuredDeal.holdYears)} hold + est. maturity {featuredDeal.debtMaturity}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    {renderTarBadge(featuredDeal.tar)}
                    {cor01 && cor01.confidence !== 'insufficient' ? (
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        Surge: {cor01.xValue !== null ? `+${cor01.xValue}%` : featuredDeal.surgeIndex} above baseline (COR-01)
                        {cor01.signal && ` \u2022 ${cor01.signal}`}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        Surge: {featuredDeal.surgeIndex} above baseline (COR-01)
                      </span>
                    )}
                    <button
                      onClick={() => setShowPcsBreakdown(!showPcsBreakdown)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      {showPcsBreakdown ? 'Hide' : 'Show'} PCS Breakdown
                    </button>
                  </div>

                  {showPcsBreakdown && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">PCS Component Breakdown</span>
                        <span className="text-[11px] text-gray-500">
                          Expected: #{featuredDeal.performanceGap.expectedRank} | Actual: #{featuredDeal.performanceGap.actualRank} | Gap: {featuredDeal.performanceGap.gap} positions
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {renderPcsComponentBar('Revenue', featuredDeal.pcsComponents.revenue, 'bg-green-500')}
                        {renderPcsComponentBar('Traffic', featuredDeal.pcsComponents.traffic, 'bg-blue-500')}
                        {renderPcsComponentBar('Occupancy', featuredDeal.pcsComponents.occupancy, 'bg-cyan-500')}
                        {renderPcsComponentBar('Ops', featuredDeal.pcsComponents.opsQuality, 'bg-amber-500')}
                        {renderPcsComponentBar('Asset', featuredDeal.pcsComponents.assetQuality, 'bg-purple-500')}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 mb-4">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">WHY THIS PROPERTY:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-sm">
                      <div className="text-gray-700">{'\u2022'} Loss-to-Lease: {featuredDeal.lossToLease} (P-03) \u2014 {featuredDeal.ltlPct} below market</div>
                      <div className="text-gray-700">{'\u2022'} Seller Motivation: {featuredDeal.sellerMotivation}/100 (P-05) \u2014 {featuredDeal.holdYears}yr hold, debt est. {featuredDeal.debtMaturity}</div>
                      <div className="text-gray-700">{'\u2022'} Demand: D-09 = {featuredDeal.demandScore}, {featuredDeal.submarket} surging</div>
                      <div className="text-gray-700">{'\u2022'} Low Cluster Risk: S-05 = nearest delivery is {featuredDeal.clusterDistance} away</div>
                      <div className="text-gray-700">{'\u2022'} Managed by: {featuredDeal.managementCompany} (avg PCS: {featuredDeal.managementPcsPercentile}th pctile \u2014 {featuredDeal.managementRating})</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Walk-Ins: {featuredDeal.walkIns} (T-01) \u2014 strong foot traffic</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Hidden Gem: T-04 = {featuredDeal.trafficCorrelation} (undiscovered)</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Capture Rate: {featuredDeal.captureRate} (T-06) \u2014 good corner visibility</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Traffic Share: {featuredDeal.trafficShare} of submarket (T-09) \u2014 above avg for {featuredDeal.class}</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Trade Area: {featuredDeal.supplyDemandRatio} supply-demand ratio (TA-03) \u2014 undersupplied</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Competitive Set: {featuredDeal.compSetCount} props, avg rent {featuredDeal.compSetAvgRent} (TA-02)</div>
                      <div className="text-blue-700 font-medium">{'\u2605'} Confidence: {featuredDeal.confidence} (T-10) \u2014 validated model</div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                          CORRELATION INTELLIGENCE
                          {correlationReport && (
                            <span className="ml-2 text-[10px] font-normal text-indigo-500">
                              {correlationReport.metricsComputed}/{correlationReport.correlations.length} live from API
                            </span>
                          )}
                        </p>
                        {correlationLoading && (
                          <span className="text-[10px] text-indigo-400 animate-pulse">Loading live data...</span>
                        )}
                        {!correlationLoading && !correlationError && correlationReport && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">
                            LIVE DATA
                          </span>
                        )}
                        {correlationError && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                            SAMPLE DATA
                          </span>
                        )}
                      </div>

                      {correlationReport && !correlationError ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-[10px] font-bold text-gray-500">MARKET SUMMARY:</span>
                            <span className="text-[10px] text-green-600 font-bold">{correlationReport.summary.bullishSignals} bullish</span>
                            <span className="text-[10px] text-red-600 font-bold">{correlationReport.summary.bearishSignals} bearish</span>
                            <span className="text-[10px] text-gray-500 font-bold">{correlationReport.summary.neutralSignals} neutral</span>
                            <span className="text-[10px] text-gray-400">{correlationReport.summary.insufficientData} pending data</span>
                            {correlationReport.summary.topOpportunity && (
                              <span className="text-[10px] text-emerald-600 font-semibold">\u2605 {correlationReport.summary.topOpportunity}</span>
                            )}
                          </div>

                          {cor01 && cor01.confidence !== 'insufficient' && renderCorrelationMetricRow(cor01)}
                          {cor03 && cor03.confidence !== 'insufficient' && renderCorrelationMetricRow(cor03)}
                          {cor04 && cor04.confidence !== 'insufficient' && renderCorrelationMetricRow(cor04)}
                          {cor05 && cor05.confidence !== 'insufficient' && renderCorrelationMetricRow(cor05)}
                          {cor06 && cor06.confidence !== 'insufficient' && renderCorrelationMetricRow(cor06)}
                          {cor09 && cor09.confidence !== 'insufficient' && renderCorrelationMetricRow(cor09)}
                          {cor13 && cor13.confidence !== 'insufficient' && renderCorrelationMetricRow(cor13)}
                          {cor14 && cor14.confidence !== 'insufficient' && renderCorrelationMetricRow(cor14)}
                          {cor15 && cor15.confidence !== 'insufficient' && renderCorrelationMetricRow(cor15)}
                          {cor16 && cor16.confidence !== 'insufficient' && renderCorrelationMetricRow(cor16)}

                          {pendingMetrics.length > 0 && (
                            <div className="mt-2">
                              <button
                                onClick={() => setShowPendingMetrics(!showPendingMetrics)}
                                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 underline"
                              >
                                {showPendingMetrics ? 'Hide' : 'Show'} {pendingMetrics.length} pending metrics (awaiting data sources)
                              </button>
                              {showPendingMetrics && (
                                <div className="mt-2 space-y-1 border border-gray-100 rounded-lg p-2">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">AWAITING DATA SOURCES:</p>
                                  {pendingMetrics.map(m => renderPendingMetricRow(m))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-sm">
                          <div className="text-indigo-700 font-medium">
                            {'\u2605'} Rent-Traffic Gap (COR-01/03): digital demand +28% QoQ but rent growth only +1.2% \u2014 repricing opportunity of $75-125/unit
                          </div>
                          <div className="text-indigo-700 font-medium">
                            {'\u2605'} Wage Runway (COR-04/13): submarket wages growing 4.2% vs rent growth 1.8% \u2014 affordability ratio 28% (below 30% ceiling). Room to push rents.
                          </div>
                          <div className="text-indigo-700 font-medium">
                            {'\u2605'} Review Opportunity (COR-14/15): property at {featuredDeal.sentimentValue.stars} stars. Like-kind at {featuredDeal.sentimentValue.peerStars}+ command {featuredDeal.sentimentValue.premium} premium. {featuredDeal.sentimentValue.topComplaint} is #1 complaint (fixable).
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">COMP INTELLIGENCE:</p>
                      <div className="space-y-1.5 text-sm">
                        <div className="text-teal-700 font-medium">
                          {'\u2605'} Like-Kind Benchmark: national avg rent {featuredDeal.likeKindAvgRent}. This property at {featuredDeal.compSetAvgRent} = {featuredDeal.likeKindDiscount} discount despite comparable traffic position.
                        </div>
                        <div className="text-teal-700 font-medium">
                          {'\u2605'} Amenity Gap: Missing {featuredDeal.amenityGap.missing.join(', ')} ({featuredDeal.amenityGap.missing.length} of {featuredDeal.amenityGap.totalTopAmenities} top amenities in trade area). Est. rent lift: +{featuredDeal.amenityGap.estRentLift}.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-sm">{'\uD83E\uDD16'}</span>
                      <p className="text-sm text-violet-800 italic">
                        "{buildAiInsight()}"
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Add to Pipeline</button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Run Pro Forma</button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">View Owner</button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Strategy Arb</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={deal.rank} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500">#{deal.rank}</span>
                    <span className="font-semibold text-gray-900">{deal.name}</span>
                    <span className="text-sm text-gray-500">{deal.units}u | {deal.year} | {deal.class} | {deal.submarket}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
                    {renderPcsRank(deal.pcsRank, deal.pcsMovement, deal.pcsMovementDelta)}
                    {renderQuadrantBadge(deal.quadrant)}
                    {'lifecyclePhase' in deal && renderLifecycleBadge(deal.lifecyclePhase as LifecyclePhase)}
                    {renderTargetScore(deal.targetScore)}
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">JEDI {deal.jedi}</span>
                    <span className="text-gray-500">LTL: {deal.ltl}</span>
                    <span className="text-blue-600">{'\u2605'} {deal.walkIns}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 ml-8">
                  {'trajectory' in deal && (
                    <span className={`text-[11px] font-semibold ${(deal.trajectory as string).startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      T-07: {deal.trajectory} {'\u2192'} {deal.trajectoryLabel}
                    </span>
                  )}
                  {'tar' in deal && (
                    <span className={`text-[11px] font-semibold ${(deal.tar as number) > 1 ? 'text-emerald-600' : 'text-red-600'}`}>
                      TAR: {(deal.tar as number).toFixed(2)}
                    </span>
                  )}
                  <span className="text-blue-600 text-[11px]">{'\u2605'} Share: {deal.trafficShare}</span>
                  {'trafficQualified' in deal && renderTrafficQualBadge(deal.trafficQualified as TrafficQualification)}
                  <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{deal.strategy}</span>
                </div>
              </div>
            );
          })}

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-4">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">OPPORTUNITY ALGORITHM</p>
            <p className="text-xs text-gray-500">
              Score = 0.25 {'\u00D7'} C-01 (JEDI) + 0.15 {'\u00D7'} P-03 (LTL) + 0.15 {'\u00D7'} P-05 (Motivation) + 0.10 {'\u00D7'} D-09 (Demand) + 0.10 {'\u00D7'} T-01 (Walk-Ins) + 0.05 {'\u00D7'} T-04 (Hidden Gem) + 0.05 {'\u00D7'} T-06 (Capture) + 0.05 {'\u00D7'} T-09 (Traffic Share) + 0.05 {'\u00D7'} TA-03 (Supply-Demand) + 0.05 {'\u00D7'} S-05 (Cluster Risk, inverted). Confidence weighted by T-10.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">My Pipeline</h3>
          <p className="text-sm text-gray-500 mt-0.5">Kanban \u2014 stage-specific metrics per deal</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-4 gap-4">
            {kanbanColumns.map((col) => (
              <div key={col.stage} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className={`${col.headerColor} px-3 py-2 flex items-center justify-between`}>
                  <span className="text-sm font-bold text-white">{col.stage}</span>
                  <span className="text-xs font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{col.count}</span>
                </div>
                <div className={`${col.color} p-3 space-y-2 min-h-[180px]`}>
                  {col.deals.map((deal, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                      <p className="text-sm font-medium text-gray-900">{deal.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{deal.units}u</span>
                        <span>{'\u00B7'}</span>
                        <span>{deal.class}</span>
                        <span>{'\u00B7'}</span>
                        <span className="font-bold text-blue-700">JEDI {deal.jedi}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-gray-400">{deal.days} in stage</span>
                        {(deal as any).omVariance && (
                          <span className="text-[11px] font-bold text-red-600">C-04: {(deal as any).omVariance}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Market Deal Activity</h3>
          <p className="text-sm text-gray-500 mt-0.5">Recent transactions and AI assessments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Property</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">PCS Rank</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">T-04 Quadrant</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Target Score</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Units</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Price</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">$/Unit</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">AI Assessment</th>
              </tr>
            </thead>
            <tbody>
              {dealActivityRows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.type === 'Listed' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{renderPcsRank(row.pcsRank, row.pcsMovement, row.pcsMovementDelta)}</td>
                  <td className="px-4 py-3">{renderQuadrantBadge(row.quadrant)}</td>
                  <td className="px-4 py-3">{renderTargetScore(row.targetScore)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.units}</td>
                  <td className="px-4 py-3 text-gray-600">{row.price}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.perUnit}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{row.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Strategy Arbitrage Leaderboard</h3>
              <p className="text-sm text-gray-500 mt-0.5">Ranked by IRR spread between best and second-best strategy</p>
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">{'\u2605'} NEW: T-01, T-09 inform strategy selection</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Property</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Best Strategy</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">IRR</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">2nd Best</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">IRR</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs">Spread</th>
              </tr>
            </thead>
            <tbody>
              {arbitrageRows.map((row, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{row.bestStrategy}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600">{row.bestIRR}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{row.secondBest}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.secondIRR}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{row.spread}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DealsTab;
