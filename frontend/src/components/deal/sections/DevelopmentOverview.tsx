import React, { useEffect, useState } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';
import {
  T, mono, sans, fmt, pct, pctRaw, num, mult,
  BloombergPage, BCard, BSection, BMetric, BDataRow, BBadge, BDivider,
  BMetricGrid, UnderwritingComparison, BLiveBadge,
} from '../bloomberg-tokens';

interface DevelopmentOverviewProps {
  deal: any;
  dealId?: string;
  onStrategySelected?: (strategyId: string) => void;
  onTabChange?: (tabId: string) => void;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

const f = (deal: any, snake: string, camel: string, fallback: any = null) =>
  deal?.[snake] ?? deal?.[camel] ?? fallback;

function EmptyState({ message, linkLabel, onClick }: { message: string; linkLabel?: string; onClick?: () => void }) {
  return (
    <div style={{
      background: T.bgPanel, borderRadius: 6, border: `1px solid ${T.border}`,
      padding: '20px 16px', textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, color: T.td, margin: '0 0 8px', ...sans }}>{message}</p>
      {linkLabel && onClick && (
        <button
          onClick={onClick}
          style={{ fontSize: 10, fontWeight: 700, color: T.amberL, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1, ...mono }}
        >
          {linkLabel} →
        </button>
      )}
    </div>
  );
}

const fmtDollar = (n: number | null | undefined): string => {
  if (n == null || isNaN(n as number)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(0)}`;
};

export const DevelopmentOverview: React.FC<DevelopmentOverviewProps> = ({
  deal,
  dealId,
  onTabChange,
}) => {
  const {
    capitalStructure, financial, activeScenario, siteData,
    computedReturns, assumptions,
  } = useDealModule();

  const id = dealId || deal?.id;

  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [jediScore, setJediScore] = useState<number | null>(null);
  const [jediVerdict, setJediVerdict] = useState<string | null>(null);
  const [jediBreakdown, setJediBreakdown] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    apiClient.get(`/api/v1/deals/${id}/jedi-score`)
      .then(res => {
        const data = res.data;
        const score = data?.overall_score ?? data?.score ?? null;
        setJediScore(score);
        if (score !== null) {
          if (score >= 85) setJediVerdict('STRONG BUY');
          else if (score >= 70) setJediVerdict('OPPORTUNITY');
          else if (score >= 55) setJediVerdict('HOLD/MONITOR');
          else setJediVerdict('CAUTION');
        }
        const bd = data?.breakdown || {};
        setJediBreakdown({
          demand: bd.demand?.score ?? 50,
          supply: bd.supply?.score ?? 50,
          momentum: bd.momentum?.score ?? 50,
          position: bd.position?.score ?? 50,
          risk: bd.risk?.score ?? 50,
        });
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setEntitlementLoading(true);
    apiClient.get(`/api/v1/entitlements/deal/${id}`)
      .then(res => {
        const raw = res.data?.data ?? res.data?.entitlements ?? res.data;
        setEntitlements(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setEntitlements([]))
      .finally(() => setEntitlementLoading(false));
  }, [id]);

  useEffect(() => {
    const county = f(deal, 'county', 'county', '');
    const state = f(deal, 'state', 'state', '');
    if (!county || !state) return;
    apiClient.get('/api/v1/benchmark-timeline/benchmarks', { params: { county, state } })
      .then(res => {
        const sums: any[] = res.data?.summaries || [];
        if (sums.length === 0) return setBenchmarks(null);
        const avg = (key: string) => {
          const vals = sums.map((s: any) => s[key]).filter((v: any) => typeof v === 'number' && v > 0);
          return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
        };
        setBenchmarks({ p25: avg('p25Months'), p50: avg('medianMonths'), p75: avg('p75Months'), p90: avg('p90Months') });
      })
      .catch(() => setBenchmarks(null));
  }, [deal?.county, deal?.state]);

  const lotSize = f(deal, 'lot_size', 'lotSize', null) || f(deal, 'lot_size_sf', 'lotSizeSf', null) || siteData?.lotAreaSf;
  const zoning = f(deal, 'zoning_code', 'zoningCode', null) || f(deal, 'zoning', 'zoning', null) || siteData?.baseDistrictCode;
  const maxDensity = f(deal, 'max_density', 'maxDensity', null) || activeScenario?.maxUnits;
  const maxHeight = f(deal, 'max_height', 'maxHeight', null) || activeScenario?.maxStories;
  const entitled = f(deal, 'entitled', 'entitled', null);

  const proposedUnits = f(deal, 'target_units', 'targetUnits', null) || f(deal, 'units', 'units', null);
  const totalSF = f(deal, 'total_sf', 'totalSf', null) || f(deal, 'gross_building_area', 'grossBuildingArea', null);
  const buildingType = f(deal, 'building_type', 'buildingType', null) || f(deal, 'property_type', 'propertyType', 'Multifamily');
  const parking = f(deal, 'parking_spaces', 'parkingSpaces', null) || activeScenario?.parkingRequired;

  const unitMix: any[] = f(deal, 'unit_mix', 'unitMix', null) || [];
  const totalUnitsFromMix = unitMix.reduce((s: number, u: any) => s + (u.count || u.units || 0), 0);

  const landCost = f(deal, 'land_cost', 'landCost', null) || financial?.landCost || capitalStructure?.landCost;
  const hardCosts = f(deal, 'hard_costs', 'hardCosts', null) || financial?.hardCosts || capitalStructure?.hardCosts;
  const softCosts = f(deal, 'soft_costs', 'softCosts', null) || financial?.softCosts || capitalStructure?.softCosts;
  const contingency = f(deal, 'contingency', 'contingency', null) || capitalStructure?.contingency;
  const totalDevCost = f(deal, 'total_development_cost', 'totalDevelopmentCost', null) || financial?.totalDevelopmentCost || capitalStructure?.totalDevelopmentCost;
  const costPerUnit = totalDevCost && proposedUnits ? totalDevCost / proposedUnits : null;
  const costPerSF = totalDevCost && totalSF ? totalDevCost / totalSF : null;
  const totalEquity = capitalStructure?.totalEquity || financial?.totalEquity;
  const totalDebt = capitalStructure?.loanBalance?.[0] ?? capitalStructure?.totalDebt ?? financial?.totalDebt;

  const constructionMonths = f(deal, 'construction_months', 'constructionMonths', null);
  const leaseUpMonths = f(deal, 'lease_up_months', 'leaseUpMonths', null);
  const totalMonths = constructionMonths && leaseUpMonths ? constructionMonths + leaseUpMonths : null;

  const yoc = financial?.yieldOnCost || (computedReturns?.yieldOnCost ? computedReturns.yieldOnCost * 100 : null);
  const irr = financial?.irr || (computedReturns?.irrLevered ? computedReturns.irrLevered * 100 : null);
  const em = financial?.equityMultiple || computedReturns?.equityMultiple;
  const profitMargin = f(deal, 'profit_margin', 'profitMargin', null);

  // Broker fields
  const brokerCapRate = deal?.deal_data?.broker_cap_rate || deal?.broker_cap_rate;
  const brokerNOI = deal?.deal_data?.broker_noi || deal?.broker_noi;
  const brokerOcc = deal?.deal_data?.broker_occupancy || deal?.broker_occupancy;

  // Underwriting comparison rows
  const uwRows = [
    {
      label: 'Yield on Cost',
      broker: brokerCapRate ? pctRaw(brokerCapRate) : null,
      platform: computedReturns?.yieldOnCost ? pctRaw(computedReturns.yieldOnCost * 100) : null,
      user: yoc ? pctRaw(yoc) : null,
    },
    {
      label: 'Levered IRR',
      broker: null,
      platform: computedReturns?.irrLevered ? pctRaw(computedReturns.irrLevered * 100) : null,
      user: irr ? pctRaw(irr) : null,
    },
    {
      label: 'Equity Multiple',
      broker: null,
      platform: computedReturns?.equityMultiple ? `${computedReturns.equityMultiple.toFixed(2)}x` : null,
      user: em ? `${em.toFixed(2)}x` : null,
    },
    {
      label: 'Total Dev Cost',
      broker: null,
      platform: totalDevCost ? fmt(totalDevCost) : null,
      user: null,
    },
    {
      label: 'NOI (Stabilized)',
      broker: brokerNOI ? fmt(brokerNOI) : null,
      platform: null,
      user: null,
    },
    {
      label: 'Occupancy',
      broker: brokerOcc ? pctRaw(brokerOcc) : null,
      platform: assumptions?.stabilizedOccupancy ? pctRaw((assumptions.stabilizedOccupancy as number) * 100) : null,
      user: null,
    },
  ].filter(r => r.broker || r.platform || r.user);

  const divStyle: React.CSSProperties = { marginBottom: 16 };

  const SIGNAL_DEFS = [
    { key: 'demand', label: 'DEMAND', color: T.green },
    { key: 'supply', label: 'SUPPLY', color: T.amber },
    { key: 'momentum', label: 'MOMENTUM', color: T.blue },
    { key: 'position', label: 'POSITION', color: T.violet },
    { key: 'risk', label: 'RISK', color: T.red },
  ];

  return (
    <BloombergPage>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* JEDI Score + Signal Bars */}
        {jediScore !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
            <div style={{ textAlign: 'center', minWidth: 56 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: jediScore >= 70 ? T.greenL : jediScore >= 55 ? T.amberL : T.redL, ...mono }}>{Math.round(jediScore)}</div>
              <div style={{ fontSize: 7, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>JEDI</div>
            </div>
            <div style={{ width: 1, height: 36, background: T.border }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: jediScore >= 85 ? T.greenL : jediScore >= 70 ? T.amberL : jediScore >= 55 ? T.ts : T.redL, letterSpacing: 1, ...mono }}>
              {jediVerdict}
            </div>
            <div style={{ width: 1, height: 36, background: T.border }} />
            <div style={{ display: 'flex', gap: 12, flex: 1 }}>
              {SIGNAL_DEFS.map(s => {
                const score = jediBreakdown[s.key] ?? 50;
                const pct = Math.round(score);
                return (
                  <div key={s.key} style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8, color: T.td, letterSpacing: 1, ...mono }}>{s.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: s.color, ...mono }}>{pct}</span>
                    </div>
                    <div style={{ height: 3, background: T.bgPanel, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* §1 — Site + Zoning Constraints */}
        <div style={divStyle}>
          <BSection n="1" title="Site + Zoning Constraints" subtitle="M02 Property & Zoning" color={T.cyanL} />
          <BCard>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: T.border, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
              {[
                { label: 'Lot Size', value: lotSize ? `${Math.round(lotSize).toLocaleString()} SF` : '—', sub: lotSize ? `${(lotSize / 43560).toFixed(2)} ac` : undefined, color: T.text },
                { label: 'Zoning', value: zoning || '—', color: T.amberL },
                { label: 'Max Density', value: maxDensity ? `${maxDensity} units` : '—', color: T.greenL },
                { label: 'Max Height', value: maxHeight ? `${maxHeight} stories` : '—', color: T.violL },
              ].map((m, i) => (
                <div key={i} style={{ background: T.bgCard, padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
                  {m.sub && <div style={{ fontSize: 10, color: T.td, marginTop: 2, ...sans }}>{m.sub}</div>}
                </div>
              ))}
            </div>
            <div>
              {entitled === true && <BBadge label="ENTITLED" color={T.greenL} bg={T.greenBg} />}
              {entitled === false && <BBadge label="NOT ENTITLED" color={T.amberL} bg={T.amberBg} />}
              {entitled == null && <BBadge label="ENTITLEMENT STATUS UNKNOWN" color={T.td} bg={T.bgMid || T.bgPanel} />}
            </div>
          </BCard>
        </div>

        {/* §2 — Building Configuration */}
        <div style={divStyle}>
          <BSection n="2" title="Building Configuration" subtitle="Proposed Program" color={T.greenL} />
          <BCard>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: T.border, borderRadius: 6, overflow: 'hidden' }}>
              {[
                { label: 'Proposed Units', value: proposedUnits ? `${proposedUnits}` : '—', color: T.greenL },
                { label: 'Total SF', value: totalSF ? `${Math.round(totalSF).toLocaleString()} SF` : '—', color: T.text },
                { label: 'Building Type', value: buildingType || '—', color: T.amberL },
                { label: 'Parking', value: parking ? `${parking} spaces` : '—', color: T.text },
              ].map((m, i) => (
                <div key={i} style={{ background: T.bgCard, padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
                </div>
              ))}
            </div>
          </BCard>
        </div>

        {/* §3 — Entitlement Pipeline */}
        <div style={divStyle}>
          <BSection n="3" title="Entitlement Pipeline" subtitle="Permits & Approvals" color={T.violL} />
          <BCard>
            {entitlementLoading && (
              <p style={{ fontSize: 11, color: T.td, margin: 0, ...sans }}>Loading entitlements...</p>
            )}
            {!entitlementLoading && entitlements.length === 0 && (
              <EmptyState
                message="No entitlements or permits on file for this deal."
                linkLabel="Open Zoning Module"
                onClick={() => onTabChange?.('zoning')}
              />
            )}
            {!entitlementLoading && entitlements.length > 0 && (
              <div>
                {entitlements.map((e: any, i: number) => {
                  const status = (e.status || 'pending').toLowerCase();
                  const sc = status === 'approved' ? T.greenL : status === 'denied' ? T.redL : T.amberL;
                  const sb = status === 'approved' ? T.greenBg : status === 'denied' ? T.redBg : T.amberBg;
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 0', borderBottom: `1px solid ${T.border}`,
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, ...sans }}>
                          {e.name || e.permit_type || e.type || 'Permit'}
                        </span>
                        {e.number && <span style={{ fontSize: 10, color: T.td, marginLeft: 8, ...mono }}>#{e.number}</span>}
                      </div>
                      <BBadge label={(e.status || 'PENDING').toUpperCase()} color={sc} bg={sb} />
                    </div>
                  );
                })}
              </div>
            )}
            {benchmarks && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700, ...mono }}>
                  BENCHMARK TIMELINE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: T.border, borderRadius: 6, overflow: 'hidden' }}>
                  {['p25', 'p50', 'p75', 'p90'].map(k => (
                    <div key={k} style={{ background: T.bgCard, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: T.td, textTransform: 'uppercase', letterSpacing: 1, ...mono }}>{k}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.amberL, marginTop: 4, ...mono }}>
                        {benchmarks[k] != null ? `${benchmarks[k]}mo` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </BCard>
        </div>

        {/* §4 — Unit Mix Program */}
        <div style={divStyle}>
          <BSection n="4" title="Unit Mix Program" subtitle={totalUnitsFromMix > 0 ? `${totalUnitsFromMix} total units` : 'No units configured'} color={T.blueL} />
          <BCard>
            {unitMix.length === 0 ? (
              <EmptyState
                message="No unit mix configured for this deal."
                linkLabel="Configure Unit Mix"
                onClick={() => onTabChange?.('unit-mix')}
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bgMid || T.bgPanel, borderBottom: `1px solid ${T.border}` }}>
                    {['Type', 'Count', 'Avg SF', 'Target Rent', '% of Total'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unitMix.map((u: any, i: number) => {
                    const count = u.count || u.units || 0;
                    const pctTotal = totalUnitsFromMix > 0 ? ((count / totalUnitsFromMix) * 100).toFixed(1) : '—';
                    const rent = u.target_rent || u.targetRent || u.rent;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: T.text, ...sans }}>
                          {u.type || u.name || u.unit_type || `Type ${i + 1}`}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: T.text, ...mono }}>{count}</td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: T.tm, ...mono }}>
                          {u.avg_sf || u.avgSf || u.sqft ? `${Math.round(u.avg_sf || u.avgSf || u.sqft)} SF` : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: T.amberL, ...mono }}>
                          {rent ? fmtDollar(rent) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: T.td, ...mono }}>{pctTotal === '—' ? '—' : `${pctTotal}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </BCard>
        </div>

        {/* §5 — Development Budget + Timeline */}
        <div style={divStyle}>
          <BSection n="5" title="Development Budget + Timeline" subtitle="M09 Pro Forma · M11 Capital" color={T.amberL} />
          <BCard>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Cost Stack */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, ...mono }}>COST STACK</div>
                {[
                  { label: 'Land Acquisition', value: landCost },
                  { label: 'Hard Costs', value: hardCosts },
                  { label: 'Soft Costs', value: softCosts },
                  { label: 'Contingency', value: contingency },
                  { label: 'Total Dev Cost', value: totalDevCost, bold: true },
                  { label: 'Cost / Unit', value: costPerUnit },
                  { label: 'Cost / SF', value: costPerSF },
                  ...(totalDebt != null ? [{ label: 'Total Debt', value: totalDebt }] : []),
                  ...(totalEquity != null ? [{ label: 'Total Equity', value: totalEquity }] : []),
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    padding: '7px 0', borderBottom: `1px solid ${T.border}`,
                    ...(row.bold ? { borderTop: `1px solid ${T.borderL}`, paddingTop: 10, marginTop: 4 } : {}),
                  }}>
                    <span style={{ fontSize: 12, color: row.bold ? T.text : T.tm, fontWeight: row.bold ? 600 : 400, ...sans }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: row.bold ? 700 : 500, color: row.bold ? T.amberL : T.text, ...mono }}>
                      {row.value != null ? fmtDollar(row.value) : '—'}
                    </span>
                  </div>
                ))}
              </div>
              {/* Timeline */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, ...mono }}>TIMELINE</div>
                {[
                  { label: 'Construction', value: constructionMonths, color: T.blueL, bg: T.blueBg },
                  { label: 'Lease-Up', value: leaseUpMonths, color: T.greenL, bg: T.greenBg },
                  { label: 'Total Duration', value: totalMonths, color: T.amberL, bg: T.amberBg },
                ].map((t, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 6,
                    background: t.bg, border: `1px solid ${t.color}30`,
                    borderLeft: `3px solid ${t.color}`, marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: t.color, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>{t.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: t.color, ...mono }}>
                      {t.value != null ? `${t.value} mo` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BCard>
        </div>

        {/* §6 — Returns Comparison (Broker / Platform / User) */}
        <div style={divStyle}>
          <BSection n="6" title="Underwriting Comparison" subtitle="Broker · Platform · User" color={T.greenL} />
          {uwRows.length > 0 ? (
            <UnderwritingComparison rows={uwRows} />
          ) : (
            <BCard>
              <EmptyState message="Returns data not yet available. Build the Pro Forma to compare underwriting." linkLabel="Open Pro Forma" onClick={() => onTabChange?.('proforma')} />
            </BCard>
          )}
          {/* Returns grid */}
          {(yoc || irr || em || profitMargin) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: T.border, borderRadius: 8, overflow: 'hidden' }}>
                {[
                  { label: 'Yield on Cost', value: yoc != null ? pctRaw(yoc) : '—', color: T.amberL },
                  { label: 'Levered IRR', value: irr != null ? pctRaw(irr) : '—', color: T.greenL },
                  { label: 'Equity Multiple', value: em != null ? `${em.toFixed(2)}x` : '—', color: T.violL },
                  { label: 'Profit Margin', value: profitMargin != null ? pctRaw(profitMargin) : '—', color: T.cyanL },
                ].map((m, i) => (
                  <div key={i} style={{ background: T.bgCard, padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color, ...mono }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* §7 — Module Access */}
        <div style={divStyle}>
          <BSection n="7" title="Module Access" color={T.td} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'F2 — Property & Zoning', tab: 'zoning', code: 'M02' },
              { label: 'F3 — Market Intel', tab: 'market', code: 'M05' },
              { label: 'F5 — Competition', tab: 'competition', code: 'M15' },
              { label: 'F8 — Pro Forma', tab: 'proforma', code: 'M11' },
              { label: 'F9 — Debt & Capital', tab: 'capital', code: 'M12' },
              { label: 'F10 — Risk', tab: 'risk', code: 'M13' },
            ].map((m, i) => (
              <button
                key={i}
                onClick={() => onTabChange?.(m.tab)}
                style={{
                  background: T.bgCard, borderRadius: 6, padding: '12px 14px',
                  border: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.amber)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
              >
                <span style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{m.code}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text, ...sans }}>{m.label.split(' — ')[1]}</span>
                <span style={{ fontSize: 9, color: T.amber, ...mono }}>OPEN →</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </BloombergPage>
  );
};

export default DevelopmentOverview;
