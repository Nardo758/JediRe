/**
 * Risk Intelligence Panel (M14 Enhancement)
 *
 * Risk heatmap with 6 categories, trend tracking with sparklines,
 * offsetting factor analysis, and actionable mitigation recommendations.
 *
 * Decision: "What could kill this deal and how do I protect against it?"
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '../../../services/api.client';

interface RiskCategory {
  id: string;
  name: string;
  weight: number;
  score: number;
  label: string;
  severity: 'low' | 'moderate' | 'elevated' | 'high';
  driver: string;
  trend30d: number;
  trendDirection: 'worsening' | 'improving' | 'stable';
  sparkline: number[];
  offsetting: string;
  mitigation: string;
  formula: string;
  source: string;
}

const defaultRiskCategories: RiskCategory[] = [
  {
    id: 'supply',
    name: 'Supply Risk',
    weight: 35,
    score: 68,
    label: 'Elevated',
    severity: 'elevated',
    driver: '1,200 units in pipeline within 3mi, 2 direct competitors delivering before stabilization.',
    trend30d: 8,
    trendDirection: 'worsening',
    sparkline: [55, 56, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68],
    offsetting: 'Demand absorption running 1.3x pipeline rate. Net supply position: positive.',
    mitigation: 'Consider accelerating closing to lock in before Q3 2027 deliveries.',
    formula: 'F09: base(months_to_absorb×10) + escalations - de-escalations',
    source: 'M04 supply pipeline',
  },
  {
    id: 'demand',
    name: 'Demand Risk',
    weight: 35,
    score: 32,
    label: 'Low',
    severity: 'low',
    driver: '3 diversified demand drivers: Amazon (2,000 jobs), Georgia Tech expansion, population migration.',
    trend30d: -5,
    trendDirection: 'improving',
    sparkline: [40, 39, 38, 38, 37, 36, 35, 35, 34, 33, 33, 32],
    offsetting: 'Multiple demand sources reduce single-employer concentration risk.',
    mitigation: 'Monitor Amazon lease commitment timeline for confirmation.',
    formula: 'Employer concentration + demand driver diversity',
    source: 'M06 demand signals',
  },
  {
    id: 'regulatory',
    name: 'Regulatory Risk',
    weight: 10,
    score: 45,
    label: 'Moderate',
    severity: 'moderate',
    driver: 'City considering zoning overlay changes. Entitlement timeline adds 3-6mo uncertainty.',
    trend30d: 0,
    trendDirection: 'stable',
    sparkline: [44, 45, 44, 45, 45, 46, 45, 44, 45, 45, 45, 45],
    offsetting: 'Current zoning is by-right for proposed use. Changes wouldn\'t apply retroactively.',
    mitigation: 'Engage local counsel to monitor zoning overlay proceedings.',
    formula: 'Zoning change probability + entitlement timeline risk',
    source: 'M02 zoning agent',
  },
  {
    id: 'market',
    name: 'Market Risk',
    weight: 10,
    score: 38,
    label: 'Low',
    severity: 'low',
    driver: 'Cap rate stable. Rent growth accelerating. Low probability of rent deceleration.',
    trend30d: -2,
    trendDirection: 'improving',
    sparkline: [42, 41, 41, 40, 40, 39, 39, 39, 38, 38, 38, 38],
    offsetting: 'Fed easing cycle supports cap rate stability. Population growth above national avg.',
    mitigation: 'Set alert for rate environment changes that could pressure cap rates.',
    formula: 'Cap rate volatility + rent growth deceleration probability',
    source: 'M05 market trends',
  },
  {
    id: 'execution',
    name: 'Execution Risk',
    weight: 5,
    score: 55,
    label: 'Moderate',
    severity: 'moderate',
    driver: 'Value-add renovation scope adds construction cost and timeline risk.',
    trend30d: 3,
    trendDirection: 'worsening',
    sparkline: [50, 51, 51, 52, 52, 53, 53, 54, 54, 54, 55, 55],
    offsetting: 'Experienced GC with 4 similar projects in metro. Fixed-price contract available.',
    mitigation: 'Lock GC pricing with 10% contingency. Phase renovations to maintain occupancy.',
    formula: 'Construction cost volatility + timeline overrun probability',
    source: 'M03 development capacity',
  },
  {
    id: 'climate',
    name: 'Climate Risk',
    weight: 5,
    score: 28,
    label: 'Low',
    severity: 'low',
    driver: 'Not in flood zone. Low hurricane exposure for inland Atlanta. Moderate heat risk.',
    trend30d: 0,
    trendDirection: 'stable',
    sparkline: [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    offsetting: 'Insurance rates stable. No FEMA flood zone designation.',
    mitigation: 'Standard property insurance sufficient. No special climate riders needed.',
    formula: 'Flood zone + hurricane + heat exposure',
    source: 'FEMA + climate data',
  },
];

const categoryWeights: Record<string, number> = {
  supply: 35,
  demand: 35,
  regulatory: 10,
  market: 10,
  execution: 5,
  climate: 5,
};

const categoryNames: Record<string, string> = {
  supply: 'Supply Risk',
  demand: 'Demand Risk',
  regulatory: 'Regulatory Risk',
  market: 'Market Risk',
  execution: 'Execution Risk',
  climate: 'Climate Risk',
};

function classifySeverity(score: number): 'low' | 'moderate' | 'elevated' | 'high' {
  if (score < 35) return 'low';
  if (score < 55) return 'moderate';
  if (score < 70) return 'elevated';
  return 'high';
}

function severityLabel(s: 'low' | 'moderate' | 'elevated' | 'high'): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateSparkline(score: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 12; i++) {
    points.push(Math.max(0, Math.min(100, score + Math.round((Math.random() - 0.5) * 6))));
  }
  points[11] = score;
  return points;
}

function mapApiToCategories(apiData: any): RiskCategory[] {
  if (!apiData?.tradeAreaRisks?.length) return [];

  const ta = apiData.tradeAreaRisks[0];
  const cats = ta.categories;
  if (!cats) return [];

  const result: RiskCategory[] = [];

  for (const key of ['supply', 'demand', 'regulatory', 'market', 'execution', 'climate']) {
    const catData = cats[key];
    if (!catData) continue;

    const score = Math.round(catData.finalScore ?? catData.score ?? 50);
    const severity = classifySeverity(score);

    result.push({
      id: key,
      name: categoryNames[key] || key,
      weight: categoryWeights[key] || 10,
      score,
      label: severityLabel(severity),
      severity,
      driver: catData.driver || catData.description || `${categoryNames[key]} assessment from live data.`,
      trend30d: catData.trend30d ?? 0,
      trendDirection: catData.trendDirection || 'stable',
      sparkline: catData.sparkline || generateSparkline(score),
      offsetting: catData.offsetting || catData.deEscalations?.map((d: any) => d.description).join('. ') || 'No offsetting factors identified.',
      mitigation: catData.mitigation || catData.recommendation || 'Monitor and reassess periodically.',
      formula: catData.formula || `${categoryNames[key]} scoring formula`,
      source: catData.source || 'Risk API (live)',
    });
  }

  return result;
}

interface RiskIntelligenceProps {
  deal?: any;
  dealId?: string;
  [key: string]: any;
}

export const RiskIntelligence: React.FC<RiskIntelligenceProps> = ({ deal, dealId: propDealId }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>(defaultRiskCategories);
  const [isLiveData, setIsLiveData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { capitalStructure } = useDealModule();
  const params = useParams<{ id?: string; dealId?: string }>();

  const resolvedDealId = propDealId || deal?.id || params.dealId || params.id;

  useEffect(() => {
    if (!resolvedDealId) return;

    let cancelled = false;
    setIsLoading(true);

    apiClient.get(`/api/v1/risk/comprehensive/${resolvedDealId}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (data) {
          const mapped = mapApiToCategories(data);
          if (mapped.length > 0) {
            setRiskCategories(mapped);
            setIsLiveData(true);
          }
        }
      })
      .catch(() => {
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [resolvedDealId]);

  // M11+ → M14: Augment risk categories with financial risk from Capital Structure
  const augmentedCategories = useMemo(() => {
    if (!capitalStructure) return riskCategories;
    return riskCategories.map(cat => {
      if (cat.id !== 'market') return cat;
      // Inject DSCR/LTV covenant exposure into market risk
      const dscrRisk = capitalStructure.dscr < 1.25 ? 15 : capitalStructure.dscr < 1.35 ? 8 : 0;
      const ltvRisk = capitalStructure.ltv > 80 ? 12 : capitalStructure.ltv > 75 ? 6 : 0;
      const financialAdjustment = dscrRisk + ltvRisk;
      const adjustedScore = Math.min(100, cat.score + financialAdjustment);
      return {
        ...cat,
        score: adjustedScore,
        driver: financialAdjustment > 0
          ? `${cat.driver} + Financial: DSCR ${capitalStructure.dscr.toFixed(2)}x / LTV ${capitalStructure.ltv.toFixed(0)}%`
          : cat.driver,
        severity: adjustedScore >= 70 ? 'high' as const : adjustedScore >= 50 ? 'elevated' as const : cat.severity,
      };
    });
  }, [capitalStructure, riskCategories]);

  // Recalculate composite with augmented categories
  const adjustedCompositeScore = useMemo(
    () => augmentedCategories.reduce((sum, cat) => sum + cat.score * (cat.weight / 100), 0),
    [augmentedCategories],
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
          <div className="text-lg font-semibold">What could kill this deal and how do I protect against it?</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-stone-500">Loading risk intelligence...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Decision Banner */}
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">What could kill this deal and how do I protect against it?</div>
      </div>

      {/* Composite Score + Heatmap */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stone-900">Risk Heatmap</h3>
              {isLiveData ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 tracking-wider">
                  LIVE DATA
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 tracking-wider">
                  SAMPLE DATA
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">6 categories weighted by impact. Click any card to drill down.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-stone-400 tracking-wider">COMPOSITE RISK</div>
            <div className={`text-3xl font-bold ${
              adjustedCompositeScore < 40 ? 'text-emerald-600' :
              adjustedCompositeScore < 60 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {adjustedCompositeScore.toFixed(0)}<span className="text-sm text-stone-400">/100</span>
            </div>
          </div>
        </div>

        {/* 2x3 Risk Card Grid */}
        <div className="grid grid-cols-3 gap-3">
          {augmentedCategories.map(cat => (
            <RiskCard
              key={cat.id}
              category={cat}
              isExpanded={expandedCategory === cat.id}
              onToggle={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
            />
          ))}
        </div>

        {/* Insight */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Supply Risk is your #1 exposure. But look at the OFFSET: Demand Risk is only 32 because you have 3
            diversified demand drivers. The demand-supply NET position is still positive.
            Set alerts on Supply Risk at 70 — if it crosses, revisit your underwriting.
          </p>
        </div>
      </div>

      {/* Risk Trend Strip */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-stone-900">30-Day Risk Trends</h3>
          {isLiveData ? (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 tracking-wider">
              LIVE DATA
            </span>
          ) : (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 tracking-wider">
              SAMPLE DATA
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500 mb-4">Track how each risk category is evolving</p>

        <div className="space-y-3">
          {augmentedCategories.map(cat => (
            <div key={cat.id} className="flex items-center gap-4">
              <div className="w-28 text-xs font-medium text-stone-700">{cat.name}</div>
              <div className="flex-1 flex items-center gap-2">
                {/* Sparkline */}
                <div className="flex-1 h-5 flex items-end gap-px">
                  {cat.sparkline.map((v, i, arr) => {
                    const min = Math.min(...arr);
                    const max = Math.max(...arr);
                    const range = max - min || 1;
                    const height = ((v - min) / range) * 100;
                    const isLast = i === arr.length - 1;
                    const color =
                      cat.severity === 'low' ? (isLast ? 'bg-emerald-500' : 'bg-emerald-200') :
                      cat.severity === 'moderate' ? (isLast ? 'bg-amber-500' : 'bg-amber-200') :
                      cat.severity === 'elevated' ? (isLast ? 'bg-orange-500' : 'bg-orange-200') :
                      (isLast ? 'bg-red-500' : 'bg-red-200');
                    return (
                      <div key={i} className={`flex-1 rounded-sm ${color}`} style={{ height: `${Math.max(15, height)}%` }} />
                    );
                  })}
                </div>
                {/* Score */}
                <div className="w-10 text-right text-xs font-mono font-bold text-stone-900">{cat.score}</div>
                {/* Trend */}
                <div className={`w-16 text-right text-[10px] font-mono ${
                  cat.trendDirection === 'improving' ? 'text-emerald-600' :
                  cat.trendDirection === 'worsening' ? 'text-red-500' : 'text-stone-400'
                }`}>
                  {cat.trend30d > 0 ? '+' : ''}{cat.trend30d} ({cat.trendDirection === 'improving' ? 'better' : cat.trendDirection === 'worsening' ? 'worse' : 'stable'})
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 leading-relaxed">
            Supply risk jumped +8 points this month because a new 280-unit permit was filed 1.5mi away.
            But demand risk IMPROVED by 5 because of the Georgia Tech expansion.
            Net change: +3 on composite risk — manageable.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const RiskCard: React.FC<{
  category: RiskCategory;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ category, isExpanded, onToggle }) => {
  const severityConfig = {
    low: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
    moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    elevated: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  };

  const config = severityConfig[category.severity];

  return (
    <button
      className={`${config.bg} border ${config.border} rounded-lg p-4 text-left transition-all hover:shadow-sm ${
        isExpanded ? 'ring-2 ring-stone-300' : ''
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold ${config.text}`}>{category.name}</span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.badge}`}>
          {category.score} — {category.label}
        </span>
      </div>

      <div className="text-[10px] text-stone-500 mb-1">Weight: {category.weight}%</div>

      {/* Trend indicator */}
      <div className={`text-[10px] font-mono ${
        category.trendDirection === 'improving' ? 'text-emerald-600' :
        category.trendDirection === 'worsening' ? 'text-red-500' : 'text-stone-400'
      }`}>
        30d: {category.trend30d > 0 ? '+' : ''}{category.trend30d} ({category.trendDirection})
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
          <div>
            <div className="text-[9px] font-mono text-stone-400 tracking-wider">DRIVER</div>
            <p className="text-[11px] text-stone-700 leading-relaxed">{category.driver}</p>
          </div>
          <div>
            <div className="text-[9px] font-mono text-emerald-500 tracking-wider">OFFSET</div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">{category.offsetting}</p>
          </div>
          <div>
            <div className="text-[9px] font-mono text-blue-500 tracking-wider">MITIGATION</div>
            <p className="text-[11px] text-blue-700 leading-relaxed">{category.mitigation}</p>
          </div>
        </div>
      )}
    </button>
  );
};

export default RiskIntelligence;
