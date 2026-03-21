import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Bd, KpiTile, BtTabWrapper,
  AlertBanner, TableHeader,
} from '../../components/deal/bloomberg-ui';
import FinancialDashboard from '../../components/deal/sections/FinancialDashboard';
import { ProFormaTab } from '../../components/deal/sections/ProFormaTab';
import TaxModule from '../../components/deal/sections/TaxModule';
import { ExitCapitalModule } from '../../components/deal/sections/ExitCapitalModule';
import type { DealType } from '../../components/deal/sections/ExitCapitalModule';
import { computeExitReturns } from '../../shared/calculations/returns';
import { apiClient } from '../../services/api.client';

const MONO = BT.font.mono;

const TAB_LABELS = [
  'FINANCIAL DASHBOARD',
  'PRO FORMA',
  'TAX INTELLIGENCE',
  'CAPITAL STRUCTURE',
  'EXIT ANALYSIS',
];

const fmt$ = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtX = (n: number) => `${n.toFixed(2)}×`;

interface DashboardKpi {
  irr: number;
  equityMultiple: number;
  cashOnCash: number;
  noi: number;
  dscr: number;
}

interface TaxSummary {
  projected_total_tax: number;
  projected_tax_per_unit: number;
  effective_tax_rate: number;
  current_annual_tax: number | null;
}

interface PlatformData {
  exitCap?: number;
  occupancy?: number[];
  rentGrowth?: number[];
  capRate?: number;
  purchasePrice?: number;
}

interface FinancialEnginePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const EXIT_SCENARIOS: Array<{ key: string; label: string; fwdIdx: number; color: string }> = [
  { key: 'sell_now',   label: 'SELL NOW',      fwdIdx: 0,  color: BT.text.amber    },
  { key: 'refi',       label: 'REFI + HOLD',   fwdIdx: 8,  color: BT.text.cyan     },
  { key: 'hold',       label: 'HOLD 5Y',       fwdIdx: 20, color: BT.text.purple   },
  { key: 'stabilize',  label: 'SELL @ STABLE', fwdIdx: 12, color: BT.met.financial },
];

const SENSITIVITY_CAPS   = [4.5, 5.0, 5.5];
const SENSITIVITY_GROWTH = [2.0, 3.0, 4.0];

function collisionDot(broker: number | null, platform: number | null): React.ReactNode {
  if (broker == null || platform == null || platform === 0) return null;
  const diverge = Math.abs((broker - platform) / platform);
  if (diverge <= 0.10) return null;
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: BT.text.amber,
      display: 'inline-block', marginLeft: 4, flexShrink: 0,
      boxShadow: `0 0 4px ${BT.text.amber}88`,
    }} title={`${(diverge * 100).toFixed(0)}% divergence`} />
  );
}

const TRANCHE_PRESETS = {
  sr:  { label: 'SENIOR DEBT', color: BT.text.cyan,   pct: 65, type: 'Bridge',  rate: 8.5,  term: '3yr' },
  mz:  { label: 'MEZZ',        color: BT.text.orange,  pct: 10, type: 'Mezz',    rate: 12.0, term: '2yr' },
  eq:  { label: 'EQUITY',      color: BT.met.financial, pct: 25, type: '—',      rate: 0,    term: '—'   },
};

export function FinancialEnginePage({ dealId, deal: propDeal, dealType: propDealType }: FinancialEnginePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [taxData, setTaxData] = useState<TaxSummary | null>(null);
  const [platformData, setPlatformData] = useState<PlatformData>({});
  const [kpiLoading, setKpiLoading] = useState(false);

  const resolvedDealType: DealType = (propDealType as DealType) || 'existing';

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setKpiLoading(true);

    Promise.allSettled([
      apiClient.get(`/api/v1/financial-dashboard/${resolvedDealId}/summary`),
      apiClient.get(`/deals/${resolvedDealId}/tax/projection`),
      apiClient.get(`/api/v1/strategy-analyses/${resolvedDealId}`),
    ]).then(([summaryRes, taxRes, stratRes]) => {
      if (cancelled) return;

      if (summaryRes.status === 'fulfilled') {
        const s = (summaryRes.value as { data?: { data?: { model?: { scenarios?: { base?: DashboardKpi } } } } })?.data?.data?.model?.scenarios?.base;
        if (s && typeof s.irr === 'number') {
          setKpi({
            irr:            s.irr,
            equityMultiple: s.equityMultiple ?? 0,
            cashOnCash:     s.cashOnCash ?? 0,
            noi:            s.noi ?? 0,
            dscr:           s.dscr ?? 0,
          });
        }
      }

      if (taxRes.status === 'fulfilled') {
        const body = (taxRes.value as { data?: { success?: boolean; data?: TaxSummary } })?.data;
        if (body?.success && body?.data) setTaxData(body.data);
      }

      if (stratRes.status === 'fulfilled') {
        const raw = (stratRes.value as { data?: unknown })?.data;
        const strats = (raw as { data?: unknown[] })?.data ?? (raw as unknown[]);
        if (Array.isArray(strats) && strats.length > 0) {
          const s = strats[0] as { assumptions?: { exitCap?: number; capRate?: number } };
          const pd: PlatformData = {};
          if (s?.assumptions?.exitCap) pd.exitCap = s.assumptions.exitCap / 100;
          if (s?.assumptions?.capRate) pd.capRate = s.assumptions.capRate / 100;
          setPlatformData(pd);
        }
      }

      setKpiLoading(false);
    }).catch(() => setKpiLoading(false));

    return () => { cancelled = true; };
  }, [resolvedDealId]);

  // Deal broker values extracted from deal prop
  const dealData = propDeal?.deal_data as Record<string, unknown> | undefined;
  const brokerCapRate = typeof dealData?.broker_cap_rate === 'number' ? dealData.broker_cap_rate / 100
    : typeof propDeal?.cap_rate === 'number' ? (propDeal.cap_rate as number) / 100 : null;
  const brokerPurchasePrice = typeof propDeal?.purchase_price === 'number' ? propDeal.purchase_price as number
    : typeof propDeal?.asking_price === 'number' ? propDeal.asking_price as number : null;

  // Pro Forma assumption rows with raw numbers for per-row collision computation
  type ProFormaRow = { label: string; brokerFmt: string; platformFmt: string; brokerRaw: number | null; platformRaw: number | null };
  const proFormaRows: ProFormaRow[] = [
    {
      label:       'EXIT CAP RATE',
      brokerFmt:   brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—',
      platformFmt: platformData.exitCap != null ? fmtPct(platformData.exitCap * 100) : '—',
      brokerRaw:   brokerCapRate,
      platformRaw: platformData.exitCap ?? null,
    },
    {
      label:       'ACQUISITION CAP RATE',
      brokerFmt:   brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—',
      platformFmt: platformData.capRate != null ? fmtPct(platformData.capRate * 100) : '—',
      brokerRaw:   brokerCapRate,
      platformRaw: platformData.capRate ?? null,
    },
    {
      label:       'PURCHASE PRICE',
      brokerFmt:   brokerPurchasePrice != null ? fmt$(brokerPurchasePrice) : '—',
      platformFmt: '—',
      brokerRaw:   brokerPurchasePrice,
      platformRaw: null,
    },
    { label: 'VACANCY RATE',  brokerFmt: '—', platformFmt: '—', brokerRaw: null, platformRaw: null },
    { label: 'EXPENSE RATIO', brokerFmt: '—', platformFmt: '—', brokerRaw: null, platformRaw: null },
  ];
  const anyCollision = proFormaRows.some(r => collisionDot(r.brokerRaw, r.platformRaw) != null);

  // Capital structure — sourced from deal.purchase_price and API KPI data
  const totalBasis: number | null = typeof propDeal?.purchase_price === 'number'
    ? propDeal.purchase_price as number
    : null;
  const srAmt  = totalBasis != null ? totalBasis * TRANCHE_PRESETS.sr.pct / 100 : null;
  const mzAmt  = totalBasis != null ? totalBasis * TRANCHE_PRESETS.mz.pct / 100 : null;
  const eqAmt  = totalBasis != null ? totalBasis * TRANCHE_PRESETS.eq.pct / 100 : null;
  // DSCR from API (kpi); annual debt service back-computed when basis is known
  const capDscr = kpi?.dscr ?? null;
  const capNoi  = kpi?.noi  ?? null;
  const annualDS = srAmt != null && mzAmt != null
    ? srAmt * (TRANCHE_PRESETS.sr.rate / 100) + mzAmt * (TRANCHE_PRESETS.mz.rate / 100)
    : null;
  const capHorizonReturns = computeExitReturns(12, resolvedDealType);
  const ltv = srAmt != null && capHorizonReturns.grossValue > 0
    ? Math.round((srAmt / capHorizonReturns.grossValue) * 100)
    : null;
  const ltc = srAmt != null && totalBasis != null
    ? Math.round((srAmt / totalBasis) * 100)
    : TRANCHE_PRESETS.sr.pct;

  // Exit scenarios
  const exitScenarios = EXIT_SCENARIOS.map(s => ({
    ...s,
    returns: computeExitReturns(s.fwdIdx, resolvedDealType),
  }));
  const bestScenarioKey = [...exitScenarios].sort((a, b) => b.returns.irr - a.returns.irr)[0]?.key;
  const maxExitFwdIdx = Math.max(...EXIT_SCENARIOS.map(s => s.fwdIdx)) || 1;

  // Sensitivity table: IRR at [exit cap rate] × [rent growth]
  const sensitivityGrid = SENSITIVITY_CAPS.map(cap =>
    SENSITIVITY_GROWTH.map(growth =>
      computeExitReturns(16, resolvedDealType, growth, cap).irr
    )
  );
  const allSensIrr = sensitivityGrid.flat();
  const minIrr = Math.min(...allSensIrr);
  const maxIrr = Math.max(...allSensIrr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="FINANCIAL ENGINE"
        subtitle="M08 · 3-LAYER MODEL + DASHBOARD + TAX + CAPITAL + EXIT"
        borderColor={BT.met.financial}
        metrics={[
          { l: 'F_IRR',  c: BT.met.financial },
          { l: 'F_EM',   c: BT.text.amber    },
          { l: 'F_YOC',  c: BT.met.occupancy  },
          { l: 'F_CAP',  c: BT.text.cyan      },
        ]}
        right={
          kpiLoading
            ? <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>LOADING...</span>
            : kpi
              ? <Bd c={BT.met.financial}>LIVE MODEL</Bd>
              : <Bd c={BT.text.secondary}>NO MODEL</Bd>
        }
      />

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.met.financial}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {/* ── Tab 0: Financial Dashboard ── */}
        {activeTab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <KpiTile label="IRR"          value={kpi ? fmtPct(kpi.irr)                 : '—'} color={BT.met.financial} sub="base case" />
              </div>
              <div style={{ flex: 1 }}>
                <KpiTile label="EQUITY MULT"  value={kpi ? fmtX(kpi.equityMultiple)         : '—'} color={BT.text.amber}    sub="base case" />
              </div>
              <div style={{ flex: 1 }}>
                <KpiTile label="CASH-ON-CASH" value={kpi ? fmtPct(kpi.cashOnCash)           : '—'} color={BT.met.occupancy}  sub="year 1" />
              </div>
              <div style={{ flex: 1 }}>
                <KpiTile label="NOI"          value={kpi ? fmt$(kpi.noi)                    : '—'} color={BT.text.cyan}      sub="year 1" />
              </div>
              <div style={{ flex: 1 }}>
                <KpiTile label="DSCR"         value={kpi ? `${kpi.dscr.toFixed(2)}×`        : '—'} color={BT.text.green}     sub="base case" />
              </div>
            </div>
            <BtTabWrapper>
              <FinancialDashboard dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

        {/* ── Tab 1: Pro Forma ── */}
        {activeTab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              {anyCollision && (
                <AlertBanner
                  label="COLLISION DETECTED"
                  text="Broker and platform assumptions diverge >10% on highlighted rows"
                  color={BT.text.amber}
                  badge={<Bd c={BT.text.amber}>REVIEW REQUIRED</Bd>}
                />
              )}
              {!anyCollision && (
                <AlertBanner
                  label="3-LAYER MODEL"
                  text="BROKER · PLATFORM · YOU — No divergences detected above threshold"
                  color={BT.met.financial}
                  badge={<Bd c={BT.met.financial}>ALIGNED</Bd>}
                />
              )}
              <TableHeader cols={[
                { label: 'ASSUMPTION', flex: 2, color: BT.text.muted    },
                { label: 'BROKER',     flex: 1, color: BT.text.cyan     },
                { label: 'PLATFORM',   flex: 1, color: BT.text.purple   },
                { label: 'YOU',        flex: 1, color: BT.text.amber    },
              ]} />
              {proFormaRows.map((row, i) => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center',
                  background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  <div style={{ flex: 2, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {row.label}
                    {collisionDot(row.brokerRaw, row.platformRaw)}
                  </div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.cyan,   textAlign: 'right' as const }}>{row.brokerFmt}</div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.purple, textAlign: 'right' as const }}>{row.platformFmt}</div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.amber,  textAlign: 'right' as const }}>—</div>
                </div>
              ))}
              {/* Returns row */}
              <div style={{ display: 'flex', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
                <div style={{ flex: 2, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.primary }}>
                  RETURNS
                </div>
                <div style={{ flex: 1, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.met.financial, textAlign: 'right' as const }}>
                  {kpi ? fmtPct(kpi.irr) : '—'} <span style={{ color: BT.text.muted, fontWeight: 400 }}>IRR</span>
                </div>
                <div style={{ flex: 1, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.amber, textAlign: 'right' as const }}>
                  {kpi ? fmtX(kpi.equityMultiple) : '—'} <span style={{ color: BT.text.muted, fontWeight: 400 }}>EM</span>
                </div>
                <div style={{ flex: 1, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.met.occupancy, textAlign: 'right' as const }}>
                  {kpi ? fmtPct(kpi.cashOnCash) : '—'} <span style={{ color: BT.text.muted, fontWeight: 400 }}>CoC</span>
                </div>
              </div>
              {/* Sensitivity grid */}
              <div style={{ padding: '6px 10px 8px', background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 5, letterSpacing: 0.5 }}>
                  SENSITIVITY: IRR by Exit Cap Rate × Rent Growth
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 60 }} />
                  {SENSITIVITY_GROWTH.map(g => (
                    <div key={g} style={{ flex: 1, textAlign: 'center' as const, fontFamily: MONO, fontSize: 7, color: BT.text.muted, paddingBottom: 3 }}>
                      {g}% RG
                    </div>
                  ))}
                </div>
                {SENSITIVITY_CAPS.map((cap, ri) => (
                  <div key={cap} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: 60, fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{cap}% Cap</div>
                    {sensitivityGrid[ri].map((irr, ci) => {
                      const norm = maxIrr > minIrr ? (irr - minIrr) / (maxIrr - minIrr) : 0.5;
                      const cellColor = norm >= 0.66 ? BT.met.financial : norm >= 0.33 ? BT.text.amber : BT.text.red;
                      return (
                        <div key={ci} style={{
                          flex: 1, textAlign: 'center' as const, padding: '2px 0',
                          fontFamily: MONO, fontSize: 8, fontWeight: 700, color: cellColor,
                        }}>
                          {fmtPct(irr)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <BtTabWrapper>
              <ProFormaTab dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

        {/* ── Tab 2: Tax Intelligence ── */}
        {activeTab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              <SectionPanel
                title="TAX SUMMARY"
                subtitle="M26 · Property Tax Intelligence"
                borderColor={BT.text.orange}
                right={
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Bd c={BT.text.muted}>OZ</Bd>
                    <Bd c={BT.text.muted}>ABATEMENT</Bd>
                  </div>
                }
              >
                <DataRow
                  label="JURISDICTION"
                  value={[propDeal?.county, propDeal?.state].filter(Boolean).join(', ') || '—'}
                  valueColor={BT.text.secondary}
                />
                <DataRow
                  label="ASSESSED VALUE"
                  value={typeof propDeal?.assessed_value === 'number' ? fmt$(propDeal.assessed_value as number) : '—'}
                  valueColor={BT.text.primary}
                />
                <DataRow
                  label="PROJECTED ANNUAL TAX"
                  value={taxData ? fmt$(taxData.projected_total_tax) : '—'}
                  valueColor={BT.text.red}
                />
                <DataRow
                  label="TAX PER UNIT"
                  value={taxData ? fmt$(taxData.projected_tax_per_unit) : '—'}
                  valueColor={BT.text.amber}
                />
                <DataRow
                  label="EFFECTIVE RATE"
                  value={taxData ? fmtPct(taxData.effective_tax_rate * 100) : '—'}
                  valueColor={BT.met.occupancy}
                />
                <DataRow
                  label="CURRENT ANNUAL TAX"
                  value={taxData?.current_annual_tax != null ? fmt$(taxData.current_annual_tax) : '—'}
                  valueColor={BT.text.secondary}
                />
                <DataRow
                  label="ABATEMENT STATUS"
                  value={<Bd c={BT.text.muted}>NOT SET</Bd>}
                  valueColor={BT.text.secondary}
                />
                <DataRow
                  label="OPPORTUNITY ZONE"
                  value={<Bd c={BT.text.muted}>NOT SET</Bd>}
                  valueColor={BT.text.secondary}
                  border={false}
                />
              </SectionPanel>
            </div>
            <BtTabWrapper>
              <TaxModule dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

        {/* ── Tab 3: Capital Structure ── */}
        {activeTab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1 }}>
                <div style={{ flex: 1 }}><KpiTile label="LTV"  value={ltv != null ? `${ltv}%` : '—'}            color={BT.text.cyan}     /></div>
                <div style={{ flex: 1 }}><KpiTile label="LTC"  value={`${ltc}%`}                               color={BT.met.financial} /></div>
                <div style={{ flex: 1 }}><KpiTile label="DSCR" value={capDscr != null ? `${capDscr.toFixed(2)}×` : '—'} color={BT.text.amber} sub="from model" /></div>
              </div>
              <SectionPanel
                title="CAPITAL STACK"
                subtitle={totalBasis != null ? `Total Basis ${fmt$(totalBasis)}` : 'Awaiting deal data'}
                borderColor={BT.text.cyan}
              >
                {/* Stacked bar */}
                <div style={{ padding: '8px 10px 6px' }}>
                  <div style={{ display: 'flex', height: 20, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                    {[TRANCHE_PRESETS.sr, TRANCHE_PRESETS.mz, TRANCHE_PRESETS.eq].map(t => (
                      <div key={t.label} style={{
                        width: `${t.pct}%`, background: t.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.bg.terminal }}>
                          {t.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Tranche DataRow table — amounts from deal.purchase_price × tranche pct */}
                <DataRow label="SENIOR DEBT"   value={srAmt != null ? fmt$(srAmt) : '—'}    valueColor={BT.text.cyan}     sub={`${TRANCHE_PRESETS.sr.rate}% / ${TRANCHE_PRESETS.sr.term}`} />
                <DataRow label="MEZZ"          value={mzAmt != null ? fmt$(mzAmt) : '—'}    valueColor={BT.text.orange}   sub={`${TRANCHE_PRESETS.mz.rate}% / ${TRANCHE_PRESETS.mz.term}`} />
                <DataRow label="EQUITY"        value={eqAmt != null ? fmt$(eqAmt) : '—'}    valueColor={BT.met.financial} sub={`${TRANCHE_PRESETS.eq.pct}% of stack`} />
                <DataRow label="TOTAL BASIS"   value={totalBasis != null ? fmt$(totalBasis) : '—'} valueColor={BT.text.primary} />
                <DataRow label="DSCR"
                  value={capDscr != null ? `${capDscr.toFixed(2)}×` : '—'}
                  valueColor={BT.text.amber}
                  sub={capNoi != null && annualDS != null ? `NOI ${fmt$(capNoi)} / DS ${fmt$(annualDS)}` : undefined}
                  border={false}
                />
              </SectionPanel>
            </div>
            <BtTabWrapper>
              <ExitCapitalModule
                dealId={resolvedDealId}
                deal={propDeal}
                dealType={resolvedDealType}
                initialTab="stack"
                embedded
              />
            </BtTabWrapper>
          </div>
        )}

        {/* ── Tab 4: Exit Analysis ── */}
        {activeTab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: BT.border.subtle, padding: 1 }}>
                {exitScenarios.map(s => {
                  const r = s.returns;
                  const isRec = s.key === bestScenarioKey;
                  return (
                    <SectionPanel
                      key={s.key}
                      title={s.label}
                      borderColor={s.color}
                      right={isRec ? <Bd c={BT.met.financial}>RECOMMENDED</Bd> : undefined}
                    >
                      <DataRow label="IRR"          value={fmtPct(r.irr)}        valueColor={BT.met.financial} />
                      <DataRow label="EM"           value={fmtX(r.em)}           valueColor={BT.text.amber}    />
                      <DataRow label="NET PROCEEDS" value={fmt$(r.netProceeds)}   valueColor={BT.text.cyan}    border={false} />
                    </SectionPanel>
                  );
                })}
              </div>
              <SectionPanel
                title="EXIT TIMING HORIZON"
                subtitle="Forward quarter index relative to current position"
                borderColor={BT.text.amber}
              >
                <div style={{ padding: '8px 12px 10px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  {exitScenarios.map(s => {
                    const barH = Math.max(10, ((s.fwdIdx + 1) / (maxExitFwdIdx + 1)) * 48);
                    return (
                      <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontFamily: MONO, fontSize: 7, color: s.color, fontWeight: 700 }}>
                          {fmtPct(s.returns.irr)}
                        </span>
                        <div style={{
                          width: '100%', height: barH, background: s.color,
                          borderRadius: '2px 2px 0 0', opacity: 0.85,
                        }} />
                        <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>
                          {s.fwdIdx === 0 ? 'NOW' : `+${(s.fwdIdx / 4).toFixed(0)}Y`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionPanel>
            </div>
            <BtTabWrapper>
              <ExitCapitalModule
                dealId={resolvedDealId}
                deal={propDeal}
                dealType={resolvedDealType}
                initialTab="exit"
                embedded
              />
            </BtTabWrapper>
          </div>
        )}

      </div>
    </div>
  );
}

export default FinancialEnginePage;
