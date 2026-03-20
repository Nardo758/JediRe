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
import { apiClient, api } from '../../../services/api.client';
import { useDealStore } from '../../../stores/dealStore';
import { T, mono, sans, BCard, BSection, BBadge, BLiveBadge, BloombergPage, BSparkline, BMiniBar } from '../bloomberg-tokens';

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
  {
    id: 'corporate_concentration',
    name: 'Corporate Concentration Risk',
    weight: 10,
    score: 40,
    label: 'Moderate',
    severity: 'moderate',
    driver: 'Employer base concentration and corporate health scores affect demand stability.',
    trend30d: 0,
    trendDirection: 'stable',
    sparkline: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
    offsetting: 'Diversified employer base reduces single-company dependency.',
    mitigation: 'Monitor top employer CHS scores for stress signals.',
    formula: 'F72: hhiNormalized × (1 - minChs/100) × 100',
    source: 'M33 Corporate Health Intelligence',
  },
];

const categoryWeights: Record<string, number> = {
  supply: 30,
  demand: 30,
  regulatory: 10,
  market: 10,
  execution: 5,
  climate: 5,
  corporate_concentration: 10,
};

const categoryNames: Record<string, string> = {
  supply: 'Supply Risk',
  demand: 'Demand Risk',
  regulatory: 'Regulatory Risk',
  market: 'Market Risk',
  execution: 'Execution Risk',
  climate: 'Climate Risk',
  corporate_concentration: 'Corporate Concentration Risk',
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
  const offsets = [3, -2, 4, -3, 2, -4, 3, -2, 1, -3, 2, 0];
  return offsets.map((offset, i) =>
    i === 11 ? score : Math.max(0, Math.min(100, score + offset))
  );
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
  const [corpHealthRisk, setCorpHealthRisk] = useState<{hhi:number|null,topShare:number|null,minChs:number|null,loaded:boolean}>({hhi:null,topShare:null,minChs:null,loaded:false});

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

  const fetchCorporateHealthFromDealStore = useDealStore(s => s.fetchCorporateHealth);

  useEffect(() => {
    if (!resolvedDealId || corpHealthRisk.loaded) return;
    fetchCorporateHealthFromDealStore(resolvedDealId).catch(() => {});
    api.corporateHealth.getDealOverlay(resolvedDealId)
      .then(res => {
        const d = res.data?.data;
        if (d) {
          setCorpHealthRisk({
            hhi: d.herfindahl ?? null,
            topShare: d.topEmployerShare ?? null,
            minChs: d.minChs ?? null,
            loaded: true,
          });
        } else {
          setCorpHealthRisk(prev => ({...prev, loaded: true}));
        }
      })
      .catch(() => {
        setCorpHealthRisk(prev => ({...prev, loaded: true}));
      });
  }, [resolvedDealId, corpHealthRisk.loaded, fetchCorporateHealthFromDealStore]);

  const augmentedCategories = useMemo(() => {
    let cats = riskCategories;

    if (capitalStructure) {
      cats = cats.map(cat => {
        if (cat.id !== 'market') return cat;
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
    }

    if (corpHealthRisk.loaded && (corpHealthRisk.hhi !== null || corpHealthRisk.minChs !== null)) {
      const hhi = corpHealthRisk.hhi ?? 0;
      const minChs = corpHealthRisk.minChs ?? 50;
      const hhiNormalized = Math.min(1, hhi / 0.25);
      const f72 = hhiNormalized * (1 - minChs / 100) * 100;
      const f72Severity = classifySeverity(f72);

      cats = cats.map(cat => {
        if (cat.id !== 'corporate_concentration') return cat;
        return {
          ...cat,
          score: Math.round(f72),
          label: severityLabel(f72Severity),
          severity: f72Severity,
          driver: `F72 Score: ${f72.toFixed(1)} — HHI ${hhi.toFixed(3)}, Min CHS ${minChs.toFixed(0)}. ${corpHealthRisk.topShare !== null ? `Top employer share: ${(corpHealthRisk.topShare * 100).toFixed(1)}%` : ''}`,
        };
      });
    }

    return cats;
  }, [capitalStructure, riskCategories, corpHealthRisk]);

  // Recalculate composite with augmented categories
  const adjustedCompositeScore = useMemo(
    () => augmentedCategories.reduce((sum, cat) => sum + cat.score * (cat.weight / 100), 0),
    [augmentedCategories],
  );

  const scoreColor = (s: number) => s < 40 ? T.greenL : s < 60 ? T.amberL : T.redL;

  if (isLoading) {
    return (
      <BloombergPage>
        <div style={{ background: T.bgCard, borderRadius: 8, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.amber}`, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 2, marginBottom: 4, ...mono }}>THE DECISION THIS PAGE DRIVES</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, ...sans }}>What could kill this deal and how do I protect against it?</div>
        </div>
        <BCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 18, height: 18, border: `2px solid ${T.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12, color: T.td, ...sans }}>Loading risk intelligence...</span>
          </div>
        </BCard>
      </BloombergPage>
    );
  }

  return (
    <BloombergPage>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Bloomberg v0.34 PanelHeader */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', background: T.bgMid,
          borderBottom: `1px solid ${T.border}`, borderTop: `2px solid ${T.red}`, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text, letterSpacing: 0.8, ...mono }}>RISK INTELLIGENCE</span>
            <span style={{ fontSize: 8, color: T.td, ...mono }}>M14 | Due Diligence · Exposure · Mitigation</span>
            <span style={{ fontSize: 6, fontWeight: 700, color: '#FF4757', background: '#FF475715', border: '1px solid #FF475730', padding: '0 3px', borderRadius: 2, ...mono }}>RISK</span>
            <span style={{ fontSize: 6, fontWeight: 700, color: '#F5A623', background: '#F5A62315', border: '1px solid #F5A62330', padding: '0 3px', borderRadius: 2, ...mono }}>DD</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BLiveBadge live={isLiveData} />
          </div>
        </div>

        {/* Composite Score + Heatmap */}
        <BCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text, ...sans }}>Risk Heatmap</span>
                <BLiveBadge live={isLiveData} />
              </div>
              <p style={{ fontSize: 11, color: T.td, margin: 0, ...sans }}>Risk categories weighted by impact. Click any card to drill down.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>COMPOSITE RISK</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scoreColor(adjustedCompositeScore), ...mono }}>
                {adjustedCompositeScore.toFixed(0)}<span style={{ fontSize: 14, color: T.td }}>/100</span>
              </div>
            </div>
          </div>

          {/* Risk Card Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
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
          <div style={{ marginTop: 14, background: T.amberBg, borderRadius: 6, border: `1px solid ${T.amber}30`, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: T.amberL, lineHeight: 1.6, margin: 0, ...sans }}>
              Supply Risk is your #1 exposure. But look at the OFFSET: Demand Risk is low because of diversified demand drivers.
              The demand-supply NET position is positive. Set alerts on Supply Risk at 70.
            </p>
          </div>
        </BCard>

        {/* 30-Day Trend Strip */}
        <BCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text, ...sans }}>30-Day Risk Trends</span>
            <BLiveBadge live={isLiveData} />
          </div>
          <p style={{ fontSize: 11, color: T.td, marginBottom: 16, ...sans }}>Track how each risk category is evolving</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {augmentedCategories.map(cat => {
              const severityColor = cat.severity === 'low' ? T.greenL : cat.severity === 'moderate' ? T.amberL : cat.severity === 'elevated' ? T.orangeL : T.redL;
              const trendColor = cat.trendDirection === 'improving' ? T.greenL : cat.trendDirection === 'worsening' ? T.redL : T.td;
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                  <div style={{ width: 120, fontSize: 11, color: T.tm, fontWeight: 500, ...sans }}>{cat.name}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
                    {cat.sparkline.map((v, i, arr) => {
                      const mn = Math.min(...arr), mx = Math.max(...arr);
                      const h = Math.max(15, ((v - mn) / (mx - mn || 1)) * 100);
                      const isLast = i === arr.length - 1;
                      return (
                        <div key={i} style={{
                          flex: 1, height: `${h}%`, borderRadius: 1,
                          background: isLast ? severityColor : `${severityColor}40`,
                          alignSelf: 'flex-end',
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700, color: severityColor, ...mono }}>{cat.score}</div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 9, fontWeight: 700, color: trendColor, letterSpacing: 0.5, ...mono }}>
                    {cat.trend30d > 0 ? '+' : ''}{cat.trend30d} {cat.trendDirection === 'improving' ? '▲' : cat.trendDirection === 'worsening' ? '▼' : '●'}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, background: T.blueBg, borderRadius: 6, border: `1px solid ${T.blue}30`, padding: '10px 14px' }}>
            <p style={{ fontSize: 11, color: T.blueL, lineHeight: 1.6, margin: 0, ...sans }}>
              Supply risk moved +8 pts due to a new 280-unit permit filed nearby. Demand risk improved because of local expansion.
              Net composite change: +3 — manageable.
            </p>
          </div>
        </BCard>
      </div>
    </BloombergPage>
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
  const severityMap = {
    low:      { color: T.greenL, bg: T.greenBg, border: T.green },
    moderate: { color: T.amberL, bg: T.amberBg, border: T.amber },
    elevated: { color: T.orangeL, bg: T.orangeBg, border: T.orange },
    high:     { color: T.redL,   bg: T.redBg,   border: T.red   },
  };
  const cfg = severityMap[category.severity] || severityMap.moderate;
  const trendColor = category.trendDirection === 'improving' ? T.greenL : category.trendDirection === 'worsening' ? T.redL : T.td;

  return (
    <button
      onClick={onToggle}
      style={{
        background: isExpanded ? T.bgHover : T.bgCard,
        border: `1px solid ${isExpanded ? cfg.border : T.border}`,
        borderTop: `3px solid ${cfg.border}`,
        borderRadius: 8, padding: '14px 14px 12px', textAlign: 'left', cursor: 'pointer',
        width: '100%', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, ...sans }}>{category.name}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bg,
          border: `1px solid ${cfg.border}40`, borderRadius: 4, padding: '2px 6px', ...mono,
        }}>
          {category.score} — {category.label.toUpperCase()}
        </span>
      </div>

      {/* Mini bar */}
      <div style={{ height: 3, background: T.border, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${category.score}%`, background: cfg.color, borderRadius: 2 }} />
      </div>

      <div style={{ fontSize: 9, color: T.td, marginBottom: 6, ...mono }}>WEIGHT: {category.weight}%</div>

      <div style={{ fontSize: 9, fontWeight: 700, color: trendColor, ...mono }}>
        30d: {category.trend30d > 0 ? '+' : ''}{category.trend30d} ({category.trendDirection})
      </div>

      {isExpanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3, ...mono }}>DRIVER</div>
            <p style={{ fontSize: 10, color: T.tm, lineHeight: 1.5, margin: 0, ...sans }}>{category.driver}</p>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.green, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3, ...mono }}>OFFSET</div>
            <p style={{ fontSize: 10, color: T.greenL, lineHeight: 1.5, margin: 0, ...sans }}>{category.offsetting}</p>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: T.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3, ...mono }}>MITIGATION</div>
            <p style={{ fontSize: 10, color: T.blueL, lineHeight: 1.5, margin: 0, ...sans }}>{category.mitigation}</p>
          </div>
        </div>
      )}
    </button>
  );
};

export default RiskIntelligence;
