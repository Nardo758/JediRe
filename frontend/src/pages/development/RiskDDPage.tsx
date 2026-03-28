import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Spark, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';
import CollisionAnalysisSection from '../../components/deal/sections/CollisionAnalysisSection';

interface RiskDDPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const MONO = BT.font.mono;

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
  mitigation: string;
}

const DEFAULT_CATEGORIES: RiskCategory[] = [
  {
    id: 'supply', name: 'Supply Risk', weight: 35, score: 68, label: 'Elevated', severity: 'elevated',
    driver: '1,200 units in pipeline within 3mi radius.',
    trend30d: 8, trendDirection: 'worsening', sparkline: [55,56,58,59,60,62,63,64,65,66,67,68],
    mitigation: 'Accelerate closing before Q3 deliveries.',
  },
  {
    id: 'demand', name: 'Demand Risk', weight: 35, score: 32, label: 'Low', severity: 'low',
    driver: '3 diversified demand drivers active.',
    trend30d: -5, trendDirection: 'improving', sparkline: [40,39,38,38,37,36,35,35,34,33,33,32],
    mitigation: 'Monitor Amazon lease commitment timeline.',
  },
  {
    id: 'regulatory', name: 'Regulatory Risk', weight: 10, score: 45, label: 'Moderate', severity: 'moderate',
    driver: 'City considering zoning overlay changes.',
    trend30d: 0, trendDirection: 'stable', sparkline: [44,45,44,45,45,46,45,44,45,45,45,45],
    mitigation: 'Engage local counsel to monitor proceedings.',
  },
  {
    id: 'market', name: 'Market Risk', weight: 10, score: 38, label: 'Low', severity: 'low',
    driver: 'Cap rate stable. Rent growth accelerating.',
    trend30d: -2, trendDirection: 'improving', sparkline: [42,41,41,40,40,39,39,39,38,38,38,38],
    mitigation: 'Set alert for rate environment changes.',
  },
  {
    id: 'execution', name: 'Execution Risk', weight: 5, score: 55, label: 'Moderate', severity: 'moderate',
    driver: 'Value-add renovation scope adds construction risk.',
    trend30d: 3, trendDirection: 'worsening', sparkline: [50,51,51,52,52,53,53,54,54,54,55,55],
    mitigation: 'Lock GC pricing with 10% contingency.',
  },
  {
    id: 'climate', name: 'Climate Risk', weight: 5, score: 28, label: 'Low', severity: 'low',
    driver: 'Not in flood zone. Low hurricane exposure.',
    trend30d: 0, trendDirection: 'stable', sparkline: [28,28,28,28,28,28,28,28,28,28,28,28],
    mitigation: 'Standard property insurance sufficient.',
  },
];

function classifySeverity(score: number): RiskCategory['severity'] {
  if (score < 35) return 'low';
  if (score < 55) return 'moderate';
  if (score < 70) return 'elevated';
  return 'high';
}

function severityColor(s: RiskCategory['severity']): string {
  if (s === 'low') return BT.text.green;
  if (s === 'moderate') return BT.text.amber;
  if (s === 'elevated') return BT.text.orange;
  return BT.text.red;
}

function trendArrow(d: RiskCategory['trendDirection']): string {
  return d === 'improving' ? '▼' : d === 'worsening' ? '▲' : '●';
}

function mapApiToCategories(apiData: Record<string, unknown>): RiskCategory[] {
  const taArray = apiData?.tradeAreaRisks;
  if (!Array.isArray(taArray) || taArray.length === 0) return [];
  const cats = (taArray[0] as Record<string, unknown>)?.categories;
  if (!cats || typeof cats !== 'object') return [];
  const catMap = cats as Record<string, Record<string, unknown>>;
  const result: RiskCategory[] = [];
  for (const key of ['supply', 'demand', 'regulatory', 'market', 'execution', 'climate'] as const) {
    const c = catMap[key];
    if (!c) continue;
    const score = Math.round((c.finalScore as number | undefined) ?? (c.score as number | undefined) ?? 50);
    const sev = classifySeverity(score);
    result.push({
      id: key,
      name: DEFAULT_CATEGORIES.find(d => d.id === key)?.name ?? key,
      weight: DEFAULT_CATEGORIES.find(d => d.id === key)?.weight ?? 10,
      score,
      label: sev.charAt(0).toUpperCase() + sev.slice(1),
      severity: sev,
      driver: (c.driver as string | undefined) ?? (c.description as string | undefined) ?? `${key} risk assessment.`,
      trend30d: (c.trend30d as number | undefined) ?? 0,
      trendDirection: (c.trendDirection as RiskCategory['trendDirection'] | undefined) ?? 'stable',
      sparkline: Array.isArray(c.sparkline) ? (c.sparkline as number[]) : DEFAULT_CATEGORIES.find(d => d.id === key)?.sparkline ?? [],
      mitigation: (c.mitigation as string | undefined) ?? (c.recommendation as string | undefined) ?? 'Monitor periodically.',
    });
  }
  return result;
}

interface CollisionLayerData {
  broker: { rent1br: string; rent2br: string; occupancy: string };
  platform: { rent1br: string; rent2br: string; occupancy: string };
  user: { rent1br: string; rent2br: string; occupancy: string };
  resolved: { rent1br: string; rent2br: string; occupancy: string };
}

function buildLayerData(deal: Record<string, unknown> | null): CollisionLayerData | null {
  if (!deal) return null;
  const l1 = deal.layer1 as Record<string, unknown> | undefined;
  const l2 = deal.layer2 as Record<string, unknown> | undefined;
  const l3 = deal.layer3 as Record<string, unknown> | undefined;
  if (!l1 && !l2 && !l3) return null;
  const fmtRent = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '—';
  const fmtOcc  = (v: unknown) => v != null ? `${Number(v).toFixed(0)}%` : '—';
  return {
    broker:   { rent1br: fmtRent(l1?.avg_rent_1br), rent2br: fmtRent(l1?.avg_rent_2br), occupancy: fmtOcc(l1?.occupancy) },
    platform: { rent1br: fmtRent(l2?.avg_rent_1br), rent2br: fmtRent(l2?.avg_rent_2br), occupancy: fmtOcc(l2?.occupancy) },
    user:     { rent1br: fmtRent(l3?.adjusted_rent_1br), rent2br: fmtRent(l3?.adjusted_rent_2br), occupancy: fmtOcc(l3?.adjusted_occupancy) },
    resolved: {
      rent1br: fmtRent(l3?.adjusted_rent_1br ?? l2?.avg_rent_1br ?? l1?.avg_rent_1br),
      rent2br: fmtRent(l3?.adjusted_rent_2br ?? l2?.avg_rent_2br ?? l1?.avg_rent_2br),
      occupancy: fmtOcc(l3?.adjusted_occupancy ?? l2?.occupancy ?? l1?.occupancy),
    },
  };
}


const RISK_TAB_LABELS = ['RISK ASSESSMENT', 'COLLISION ANALYSIS'];

export function RiskDDPage({ dealId: propDealId, deal: propDeal }: RiskDDPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [categories, setCategories] = useState<RiskCategory[]>(DEFAULT_CATEGORIES);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dealData, setDealData] = useState<Record<string, unknown> | null>(propDeal ?? null);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setIsLoading(true);

    const riskFetch = apiClient.get(`/api/v1/risk/comprehensive/${resolvedDealId}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data?.data as Record<string, unknown> | undefined;
        if (data) {
          const mapped = mapApiToCategories(data);
          if (mapped.length > 0) { setCategories(mapped); setIsLive(true); }
        }
      })
      .catch(() => {});

    const dealFetch = (!propDeal)
      ? apiClient.get(`/api/v1/deals/${resolvedDealId}`)
          .then(res => { if (!cancelled) setDealData(res.data?.deal ?? res.data ?? null); })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([riskFetch, dealFetch])
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [resolvedDealId, propDeal]);

  const compositeScore = useMemo(
    () => categories.reduce((sum, c) => sum + c.score * (c.weight / 100), 0),
    [categories],
  );

  const compColor = compositeScore < 40 ? BT.text.green : compositeScore < 60 ? BT.text.amber : BT.text.red;
  const layerData = buildLayerData(dealData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="RISK ANALYSIS"
        subtitle="M09 · INTELLIGENCE ENGINE + EXPOSURE + FILES"
        borderColor={BT.text.red}
        metrics={[
          { l: 'RISK', c: BT.text.red },
          { l: 'DD', c: BT.text.orange },
        ]}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isLoading && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>LOADING...</span>}
            <Bd c={compColor}>COMPOSITE {compositeScore.toFixed(0)}</Bd>
            {isLive && <Bd c={BT.text.green}>LIVE</Bd>}
          </div>
        }
      />

      <SubTabBar
        tabs={RISK_TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.red}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {activeTab === 0 && (() => {
          const dealName = (dealData?.name as string) || (dealData?.address as string)?.split(',')[0] || 'This deal';
          const dealStrategy = (dealData?.strategy as string) || (dealData?.strategyType as string) || 'value-add';
          const dealStage = (dealData?.stage as string) || (dealData?.pipeline_stage as string) || 'underwriting';
          const price = dealData?.purchasePrice || dealData?.price;
          const priceStr = price ? `$${(Number(price) / 1e6).toFixed(1)}M` : null;
          const units = dealData?.units || dealData?.totalUnits;

          const sortedCats = [...categories].sort((a, b) => b.score - a.score);
          const topRisk = sortedCats[0];
          const secondRisk = sortedCats[1];
          const improving = categories.filter(c => c.trendDirection === 'improving');
          const worsening = categories.filter(c => c.trendDirection === 'worsening');
          const elevated = categories.filter(c => c.severity === 'elevated' || c.severity === 'high');
          const lowRisks = categories.filter(c => c.severity === 'low');

          const verdictText = compositeScore < 35 ? 'LOW RISK — PROCEED'
            : compositeScore < 50 ? 'MANAGEABLE — PROCEED WITH MONITORING'
            : compositeScore < 65 ? 'ELEVATED — ACTIVE MITIGATION REQUIRED'
            : 'HIGH RISK — REASSESS THESIS';
          const verdictColor = compositeScore < 35 ? BT.text.green
            : compositeScore < 50 ? BT.text.amber
            : compositeScore < 65 ? BT.text.orange
            : BT.text.red;

          return (
            <div style={{ padding: 1 }}>
              <div style={{ background: BT.bg.panel, borderLeft: `3px solid ${verdictColor}`, padding: '10px 14px', marginBottom: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, color: verdictColor }}>{compositeScore.toFixed(0)}</span>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: verdictColor, letterSpacing: 0.8 }}>{verdictText}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginTop: 1 }}>Composite Risk Score · weighted across {categories.length} categories</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {categories.map(c => {
                      const bc = severityColor(c.severity);
                      return (
                        <div key={c.id} style={{ textAlign: 'center', padding: '2px 6px', background: BT.bg.terminal }}>
                          <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: bc }}>{c.score}</div>
                          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>{c.id.slice(0, 3).toUpperCase()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.primary, lineHeight: 1.6, marginBottom: 6 }}>
                  {dealName}{priceStr ? ` (${priceStr}` : ''}{units ? `${priceStr ? ' · ' : ' ('}${units} units)` : priceStr ? ')' : ''} is currently in <span style={{ color: BT.text.cyan, fontWeight: 600 }}>{dealStage.toUpperCase()}</span> under
                  a <span style={{ color: BT.text.purple, fontWeight: 600 }}>{dealStrategy.toUpperCase()}</span> strategy.
                  The composite risk profile scores <span style={{ color: verdictColor, fontWeight: 700 }}>{compositeScore.toFixed(0)}/100</span>,
                  driven primarily by <span style={{ color: severityColor(topRisk.severity), fontWeight: 600 }}>{topRisk.name}</span> ({topRisk.score}/100)
                  {secondRisk && secondRisk.score >= 50 ? <> and <span style={{ color: severityColor(secondRisk.severity), fontWeight: 600 }}>{secondRisk.name}</span> ({secondRisk.score}/100)</> : null}.
                  {worsening.length > 0 && <> {worsening.length === 1 ? `${worsening[0].name} has` : `${worsening.length} categories have`} worsened over the trailing 30 days, requiring active monitoring.</>}
                  {improving.length > 0 && <> {improving.length === 1 ? `${improving[0].name} is` : `${improving.length} categories are`} trending favorably.</>}
                </div>
              </div>

              {elevated.length > 0 && (
                <div style={{ marginBottom: 1 }}>
                  <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.red}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.red, letterSpacing: 0.8 }}>ELEVATED RISK FACTORS — NARRATIVE ASSESSMENT</span>
                  </div>
                  {elevated.map(cat => {
                    const bc = severityColor(cat.severity);
                    const trendC = cat.trendDirection === 'improving' ? BT.text.green : cat.trendDirection === 'worsening' ? BT.text.red : BT.text.secondary;
                    return (
                      <div key={cat.id} style={{ background: BT.bg.panel, borderLeft: `3px solid ${bc}`, padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bd c={bc}>{cat.severity.toUpperCase()}</Bd>
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.white }}>{cat.name.toUpperCase()}</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>WT {cat.weight}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: bc }}>{cat.score}</span>
                            <Spark data={cat.sparkline} color={bc} w={56} h={14} />
                            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: trendC }}>
                              {trendArrow(cat.trendDirection)} {cat.trend30d > 0 ? '+' : ''}{cat.trend30d} 30d
                            </span>
                          </div>
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.6, marginBottom: 4 }}>
                          <span style={{ color: BT.text.amber, fontWeight: 600 }}>ASSESSMENT: </span>{cat.driver}
                          {cat.trendDirection === 'worsening' && <span style={{ color: BT.text.red }}> Trend is worsening — this factor has increased +{cat.trend30d} pts over the last 30 days and should be monitored closely relative to the {dealStrategy} exit thesis.</span>}
                          {cat.trendDirection === 'improving' && <span style={{ color: BT.text.green }}> Conditions are improving — down {Math.abs(cat.trend30d)} pts over 30 days.</span>}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.5 }}>
                          <span style={{ color: BT.text.green, fontWeight: 600 }}>MITIGATION: </span>{cat.mitigation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {lowRisks.length > 0 && (
                <div style={{ marginBottom: 1 }}>
                  <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.green}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.green, letterSpacing: 0.8 }}>FAVORABLE CONDITIONS</span>
                  </div>
                  {lowRisks.map(cat => {
                    const bc = severityColor(cat.severity);
                    return (
                      <div key={cat.id} style={{ background: BT.bg.panel, borderLeft: `3px solid ${bc}`, padding: '6px 12px', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Bd c={bc}>LOW</Bd>
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: BT.text.white }}>{cat.name.toUpperCase()}</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>Score {cat.score}/100</span>
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.5 }}>{cat.driver}</div>
                        </div>
                        <Spark data={cat.sparkline} color={bc} w={48} h={14} />
                      </div>
                    );
                  })}
                </div>
              )}

              {categories.filter(c => c.severity === 'moderate').length > 0 && (
                <div style={{ marginBottom: 1 }}>
                  <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.amber}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.8 }}>MODERATE RISK — MONITOR</span>
                  </div>
                  {categories.filter(c => c.severity === 'moderate').map(cat => {
                    const bc = severityColor(cat.severity);
                    const trendC = cat.trendDirection === 'improving' ? BT.text.green : cat.trendDirection === 'worsening' ? BT.text.red : BT.text.secondary;
                    return (
                      <div key={cat.id} style={{ background: BT.bg.panel, borderLeft: `3px solid ${bc}`, padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bd c={bc}>MODERATE</Bd>
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: BT.text.white }}>{cat.name.toUpperCase()}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: bc }}>{cat.score}</span>
                            <Spark data={cat.sparkline} color={bc} w={48} h={14} />
                            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: trendC }}>
                              {trendArrow(cat.trendDirection)} {cat.trend30d !== 0 ? (cat.trend30d > 0 ? '+' : '') + cat.trend30d : 'flat'} 30d
                            </span>
                          </div>
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.5 }}>
                          {cat.driver} <span style={{ color: BT.text.muted }}>→</span> <span style={{ color: BT.text.green }}>{cat.mitigation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ background: BT.bg.panel, padding: '8px 12px', borderTop: `2px solid ${verdictColor}` }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: verdictColor, letterSpacing: 0.8, marginBottom: 6 }}>RECOMMENDATION</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, lineHeight: 1.6 }}>
                  {compositeScore < 35 && <>The risk profile for this {dealStrategy} play is favorable across all measured dimensions. Proceed with standard diligence protocols. No exceptional mitigations required at this stage.</>}
                  {compositeScore >= 35 && compositeScore < 50 && <>Overall risk is manageable but requires structured monitoring. {topRisk.name} ({topRisk.score}/100) is the primary watch factor — {topRisk.mitigation.toLowerCase()} Key financial assumptions should be stress-tested against the {topRisk.id} scenario before moving past {dealStage}.</>}
                  {compositeScore >= 50 && compositeScore < 65 && <>Elevated composite risk suggests active mitigation is needed before progressing. {topRisk.name} scores {topRisk.score}/100 and is the dominant contributor. The user's model assumptions should be validated against platform data, particularly where the {dealStrategy} thesis depends on {topRisk.id === 'supply' ? 'absorption outpacing new deliveries' : topRisk.id === 'demand' ? 'sustained demand drivers' : topRisk.id === 'regulatory' ? 'regulatory stability' : 'execution timeline'}. Consider adjusting underwriting contingencies.</>}
                  {compositeScore >= 65 && <>High composite risk across multiple dimensions. Recommend pausing advancement past {dealStage} until {elevated.map(c => c.name.toLowerCase()).join(' and ')} risks are addressed. The current {dealStrategy} thesis may require restructuring — re-run strategy arbitrage to evaluate whether an alternative approach reduces exposure while preserving returns.</>}
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 1 && (
          <div>
            <div style={{ padding: 1, background: BT.border.subtle }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>
                {(
                  [
                    { key: 'broker',   label: 'BROKER',   color: BT.text.cyan,   data: layerData?.broker },
                    { key: 'platform', label: 'PLATFORM', color: BT.text.purple, data: layerData?.platform },
                    { key: 'user',     label: 'USER',     color: BT.text.amber,  data: layerData?.user },
                    { key: 'resolved', label: 'RESOLVED', color: BT.text.green,  data: layerData?.resolved },
                  ] as Array<{key: string; label: string; color: string; data: {rent1br: string; rent2br: string; occupancy: string} | undefined}>
                ).map(src => (
                  <SectionPanel
                    key={src.key}
                    title={src.label}
                    subtitle="data layer"
                    borderColor={src.color}
                    right={<Bd c={src.color}>{src.label}</Bd>}
                  >
                    <DataRow label="1BR RENT"   value={src.data?.rent1br   ?? '—'} valueColor={src.color} />
                    <DataRow label="2BR RENT"   value={src.data?.rent2br   ?? '—'} valueColor={src.color} />
                    <DataRow label="OCCUPANCY"  value={src.data?.occupancy ?? '—'} valueColor={src.color} />
                  </SectionPanel>
                ))}
              </div>
            </div>
            <BtTabWrapper>
              <CollisionAnalysisSection />
            </BtTabWrapper>
          </div>
        )}


      </div>
    </div>
  );
}

export default RiskDDPage;
