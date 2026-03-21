import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Spark, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';
import CollisionAnalysisSection from '../../components/deal/sections/CollisionAnalysisSection';
import { DueDiligencePage } from '../development/DueDiligencePage';

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

function severityBorderColor(s: RiskCategory['severity']): string {
  return severityColor(s);
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

const RISK_TABS = [
  { id: 'risk-scores',  label: 'RISK SCORES' },
  { id: 'collision',    label: 'COLLISION ANALYSIS' },
  { id: 'dd-checklist', label: 'DD CHECKLIST' },
];

export function RiskDDPage({ dealId: propDealId, deal: _deal }: RiskDDPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState('risk-scores');
  const [categories, setCategories] = useState<RiskCategory[]>(DEFAULT_CATEGORIES);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setIsLoading(true);
    apiClient.get(`/api/v1/risk/comprehensive/${resolvedDealId}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data?.data as Record<string, unknown> | undefined;
        if (data) {
          const mapped = mapApiToCategories(data);
          if (mapped.length > 0) {
            setCategories(mapped);
            setIsLive(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedDealId]);

  const compositeScore = useMemo(
    () => categories.reduce((sum, c) => sum + c.score * (c.weight / 100), 0),
    [categories],
  );

  const compColor = compositeScore < 40 ? BT.text.green : compositeScore < 60 ? BT.text.amber : BT.text.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="RISK & DUE DILIGENCE"
        subtitle="M09 · INTELLIGENCE ENGINE + EXPOSURE + FILES"
        borderColor={BT.text.red}
        metrics={[
          { l: 'RISK', c: BT.text.red },
          { l: 'DD', c: BT.text.orange },
        ]}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isLoading && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>LOADING...</span>}
            <Bd c={compColor}>
              COMPOSITE {compositeScore.toFixed(0)}
            </Bd>
            {isLive && <Bd c={BT.text.green}>LIVE</Bd>}
          </div>
        }
      />

      <SubTabBar
        tabs={RISK_TABS}
        active={activeTab}
        onChange={setActiveTab}
        accent={BT.text.red}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 'risk-scores' && (
          <div style={{ padding: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>
              {categories.slice(0, 6).map(cat => {
                const bc = severityBorderColor(cat.severity);
                const tc = severityColor(cat.severity);
                const trendC = cat.trendDirection === 'improving' ? BT.text.green : cat.trendDirection === 'worsening' ? BT.text.red : BT.text.secondary;
                return (
                  <SectionPanel
                    key={cat.id}
                    title={cat.name.toUpperCase()}
                    subtitle={`WT ${cat.weight}%`}
                    borderColor={bc}
                    right={<Bd c={tc}>{cat.label.toUpperCase()}</Bd>}
                  >
                    <div style={{ padding: '8px 8px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: tc }}>
                        {cat.score}<span style={{ fontSize: 10, color: BT.text.muted }}>/100</span>
                      </span>
                      <Spark data={cat.sparkline} color={tc} w={64} h={18} />
                    </div>
                    <DataRow label="DRIVER" value={cat.driver.slice(0, 32) + (cat.driver.length > 32 ? '…' : '')} valueColor={BT.text.primary} />
                    <DataRow label="MITIGATION" value={cat.mitigation.slice(0, 32) + (cat.mitigation.length > 32 ? '…' : '')} valueColor={BT.text.secondary} />
                    <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>30D TREND</span>
                      <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: trendC }}>
                        {cat.trend30d > 0 ? '+' : ''}{cat.trend30d} {trendArrow(cat.trendDirection)}
                      </span>
                    </div>
                  </SectionPanel>
                );
              })}
            </div>

            <div style={{ marginTop: 1 }}>
              <SectionPanel
                title="MONTE CARLO · COMPOSITE RISK DISTRIBUTION"
                subtitle="Simulated confidence band across all risk categories"
                borderColor={BT.text.red}
              >
                <div style={{ padding: '8px 10px', display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>COMPOSITE</span>
                    <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: compColor }}>
                      {compositeScore.toFixed(0)}<span style={{ fontSize: 10, color: BT.text.muted }}>/100</span>
                    </span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {categories.map(cat => {
                      const tc = severityColor(cat.severity);
                      return (
                        <div key={cat.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <Spark data={cat.sparkline} color={tc} w={48} h={14} />
                          <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>
                            {cat.id.slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionPanel>
            </div>
          </div>
        )}

        {activeTab === 'collision' && (
          <BtTabWrapper>
            <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.secondary, letterSpacing: 1 }}>
                FIELD SOURCE INDICATORS
              </span>
              <Bd c={BT.text.cyan}>BROKER</Bd>
              <Bd c={BT.text.purple}>PLATFORM</Bd>
              <Bd c={BT.text.amber}>USER</Bd>
              <Bd c={BT.text.green}>RESOLVED</Bd>
            </div>
            <CollisionAnalysisSection />
          </BtTabWrapper>
        )}

        {activeTab === 'dd-checklist' && (
          <BtTabWrapper>
            <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.secondary, letterSpacing: 1 }}>
                CHECKLIST STATUS
              </span>
              <Bd c={BT.text.green}>COMPLETE</Bd>
              <Bd c={BT.text.amber}>PENDING</Bd>
              <Bd c={BT.text.red}>BLOCKED</Bd>
            </div>
            <DueDiligencePage dealId={resolvedDealId} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default RiskDDPage;
