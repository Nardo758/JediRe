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

const DD_CATEGORY_MAP: Array<{ name: string; abbr: string; riskId: string }> = [
  { name: 'Physical Inspection', abbr: 'PHYS', riskId: 'execution' },
  { name: 'Environmental',       abbr: 'ENV',  riskId: 'climate'   },
  { name: 'Insurance',           abbr: 'INS',  riskId: 'market'    },
  { name: 'Environmental & Hazmat', abbr: 'HAZ', riskId: 'climate' },
  { name: 'Geotechnical',        abbr: 'GEO',  riskId: 'execution' },
  { name: 'Site & Engineering',  abbr: 'ENG',  riskId: 'execution' },
  { name: 'Existing Structure',  abbr: 'STR',  riskId: 'supply'    },
];

function deriveDdStatus(score: number): { label: string; color: string } {
  if (score < 40) return { label: 'COMPLETE', color: BT.text.green };
  if (score < 65) return { label: 'PENDING',  color: BT.text.amber };
  return               { label: 'BLOCKED',  color: BT.text.red   };
}

const RISK_TAB_LABELS = ['RISK SCORES', 'COLLISION ANALYSIS', 'DD CHECKLIST'];

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

        {activeTab === 0 && (
          <div style={{ padding: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>
              {categories.slice(0, 6).map(cat => {
                const bc = severityColor(cat.severity);
                const trendC = cat.trendDirection === 'improving' ? BT.text.green : cat.trendDirection === 'worsening' ? BT.text.red : BT.text.secondary;
                const confLo = Math.max(0, cat.score - 8);
                const confHi = Math.min(100, cat.score + 8);
                return (
                  <div key={cat.id} style={{ borderLeft: `3px solid ${bc}`, background: BT.bg.panel }}>
                    <SectionPanel
                      title={cat.name.toUpperCase()}
                      subtitle={`WT ${cat.weight}%`}
                      right={<Bd c={bc}>{cat.label.toUpperCase()}</Bd>}
                    >
                      <div style={{ padding: '8px 8px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: bc }}>
                          {cat.score}<span style={{ fontSize: 10, color: BT.text.muted }}>/100</span>
                        </span>
                        <Spark data={cat.sparkline} color={bc} w={64} h={18} />
                      </div>
                      <DataRow label="DRIVER" value={cat.driver.length > 36 ? cat.driver.slice(0, 35) + '…' : cat.driver} valueColor={BT.text.primary} />
                      <DataRow label="MITIGATION" value={cat.mitigation.length > 36 ? cat.mitigation.slice(0, 35) + '…' : cat.mitigation} valueColor={BT.text.secondary} />
                      <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>30D TREND</span>
                        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: trendC }}>
                          {cat.trend30d > 0 ? '+' : ''}{cat.trend30d} {trendArrow(cat.trendDirection)}
                        </span>
                      </div>
                      <div style={{ padding: '4px 8px 6px', borderTop: `1px solid ${BT.border.subtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>CONFIDENCE BAND</span>
                          <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>{confLo}–{confHi}</span>
                        </div>
                        <div style={{ position: 'relative', height: 4, background: `${bc}20`, borderRadius: 2 }}>
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${confLo}%`, width: `${confHi - confLo}%`,
                            background: `${bc}60`, borderRadius: 2,
                          }} />
                          <div style={{
                            position: 'absolute', top: -1, bottom: -1,
                            left: `${cat.score}%`, width: 2,
                            background: bc, borderRadius: 1,
                          }} />
                        </div>
                      </div>
                    </SectionPanel>
                  </div>
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

        {activeTab === 2 && (
          <div>
            <div style={{ padding: 1, background: BT.border.subtle }}>
              <SectionPanel
                title="DD CHECKLIST CATEGORIES"
                subtitle="Environmental & Physical Due Diligence · status by category"
                borderColor={BT.text.orange}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, padding: 4, background: BT.border.subtle }}>
                  {DD_CATEGORY_MAP.map(cat => {
                    const riskCat = categories.find(c => c.id === cat.riskId);
                    const { label, color } = deriveDdStatus(riskCat?.score ?? 50);
                    return (
                      <div key={cat.abbr} style={{
                        flex: '1 1 calc(14% - 4px)', minWidth: 80,
                        background: BT.bg.panel, padding: '6px 8px',
                        display: 'flex', flexDirection: 'column', gap: 4,
                        borderLeft: `2px solid ${color}`,
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.primary }}>
                          {cat.abbr}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary }}>
                          {cat.name}
                        </span>
                        <Bd c={color}>{label}</Bd>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>STATUS LEGEND:</span>
                  <Bd c={BT.text.green}>COMPLETE</Bd>
                  <Bd c={BT.text.amber}>PENDING</Bd>
                  <Bd c={BT.text.red}>BLOCKED</Bd>
                </div>
              </SectionPanel>
            </div>
            <BtTabWrapper>
              <DueDiligencePage dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

      </div>
    </div>
  );
}

export default RiskDDPage;
