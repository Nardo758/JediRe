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

interface TaxSummary {
  projected_total_tax: number;
  projected_tax_per_unit: number;
  effective_tax_rate: number;
  current_annual_tax: number | null;
}

interface FinancialEnginePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const EXIT_SCENARIOS: Array<{ key: string; label: string; fwdIdx: number; color: string }> = [
  { key: 'sell_now',    label: 'SELL NOW',      fwdIdx: 0,  color: BT.text.amber      },
  { key: 'refi',        label: 'REFI + HOLD',   fwdIdx: 8,  color: BT.text.cyan       },
  { key: 'hold',        label: 'HOLD 5Y',       fwdIdx: 20, color: BT.text.purple     },
  { key: 'stabilize',   label: 'SELL @ STABLE', fwdIdx: 12, color: BT.met.financial   },
];

const PRO_FORMA_ASSUMPTIONS = [
  'MARKET RENT / UNIT',
  'VACANCY RATE',
  'EXPENSE RATIO',
  'CAP RATE (EXIT)',
  'RENT GROWTH / YR',
];

export function FinancialEnginePage({ dealId, deal: propDeal, dealType: propDealType }: FinancialEnginePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';

  const [activeTab, setActiveTab] = useState(0);
  const [taxData, setTaxData] = useState<TaxSummary | null>(null);

  const resolvedDealType: DealType = (propDealType as DealType) || 'existing';

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    apiClient.get(`/deals/${resolvedDealId}/tax/projection`).then((res: unknown) => {
      const r = res as { success?: boolean; data?: TaxSummary } | null;
      if (!cancelled && r?.success && r?.data) setTaxData(r.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [resolvedDealId]);

  const exitScenarios = EXIT_SCENARIOS.map(s => ({
    ...s,
    returns: computeExitReturns(s.fwdIdx, resolvedDealType),
  }));
  const bestScenarioKey = [...exitScenarios].sort((a, b) => b.returns.irr - a.returns.irr)[0]?.key;

  const baseNOI = resolvedDealType === 'development' ? 2800000 : 3420000;
  const totalBasis = resolvedDealType === 'development' ? 52000000 : 46420000;
  const equityAmt = resolvedDealType === 'development' ? 18200000 : 14920000;
  const debtAmt = totalBasis - equityAmt;
  const annualDS = 2340000;
  const dscr = baseNOI / annualDS;
  const capHorizonReturns = computeExitReturns(12, resolvedDealType);
  const ltv = Math.round((debtAmt / capHorizonReturns.grossValue) * 100);
  const ltc = Math.round((debtAmt / totalBasis) * 100);
  const debtPct = Math.round((debtAmt / totalBasis) * 100);
  const equityPct = 100 - debtPct;
  const maxExitFwdIdx = Math.max(...EXIT_SCENARIOS.map(s => s.fwdIdx)) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="FINANCIAL ENGINE"
        subtitle="M08 · 3-LAYER MODEL + DASHBOARD + TAX + CAPITAL + EXIT"
        borderColor={BT.met.financial}
        metrics={[
          { l: 'IRR',      c: BT.met.financial },
          { l: 'EM',       c: BT.text.amber },
          { l: 'YOC',      c: BT.met.occupancy },
          { l: 'CAP RATE', c: BT.text.cyan },
        ]}
      />

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.met.financial}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

        {activeTab === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
              <div style={{ flex: 1 }}><KpiTile label="IRR"          value="—" color={BT.met.financial} /></div>
              <div style={{ flex: 1 }}><KpiTile label="EQUITY MULT"  value="—" color={BT.text.amber}    /></div>
              <div style={{ flex: 1 }}><KpiTile label="CASH-ON-CASH" value="—" color={BT.met.occupancy}  /></div>
              <div style={{ flex: 1 }}><KpiTile label="NOI"          value="—" color={BT.text.cyan}      /></div>
              <div style={{ flex: 1 }}><KpiTile label="DSCR"         value="—" color={BT.text.green}     /></div>
            </div>
            <BtTabWrapper>
              <FinancialDashboard dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

        {activeTab === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              <AlertBanner
                label="3-LAYER MODEL"
                text="BROKER · PLATFORM · YOU — Collision flag triggers on assumptions diverging >10%"
                color={BT.text.amber}
                badge={<Bd c={BT.text.amber}>MONITORING</Bd>}
              />
              <TableHeader cols={[
                { label: 'ASSUMPTION', flex: 2, color: BT.text.muted    },
                { label: 'BROKER',     flex: 1, color: BT.text.cyan     },
                { label: 'PLATFORM',   flex: 1, color: BT.text.purple   },
                { label: 'YOU',        flex: 1, color: BT.text.amber    },
              ]} />
              {PRO_FORMA_ASSUMPTIONS.map((row, i) => (
                <div key={row} style={{
                  display: 'flex',
                  background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  <div style={{ flex: 2, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                    {row}
                  </div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.cyan,   textAlign: 'right' as const }}>—</div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.purple, textAlign: 'right' as const }}>—</div>
                  <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.amber,  textAlign: 'right' as const }}>—</div>
                </div>
              ))}
              <div style={{ display: 'flex', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
                <div style={{ flex: 2, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.primary }}>
                  RETURNS
                </div>
                {(['IRR', 'EM', 'CASH YIELD'] as const).map((r, i) => (
                  <div key={r} style={{
                    flex: 1, padding: '5px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700,
                    color: [BT.met.financial, BT.text.amber, BT.met.occupancy][i],
                    textAlign: 'right' as const,
                  }}>
                    <span style={{ color: BT.text.muted, fontWeight: 400 }}>{r}</span>{' '}—
                  </div>
                ))}
              </div>
            </div>
            <BtTabWrapper>
              <ProFormaTab dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

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
                <DataRow label="PROJECTED ANNUAL TAX"    value={taxData ? fmt$(taxData.projected_total_tax)        : '—'} valueColor={BT.text.red}       />
                <DataRow label="TAX PER UNIT"            value={taxData ? fmt$(taxData.projected_tax_per_unit)      : '—'} valueColor={BT.text.amber}     />
                <DataRow label="EFFECTIVE RATE"          value={taxData ? fmtPct(taxData.effective_tax_rate * 100) : '—'} valueColor={BT.met.occupancy}   />
                <DataRow label="CURRENT ANNUAL TAX"      value={taxData?.current_annual_tax != null ? fmt$(taxData.current_annual_tax) : '—'} valueColor={BT.text.secondary} />
                <DataRow label="OPPORTUNITY ZONE STATUS" value={<Bd c={BT.text.muted}>NOT SET</Bd>} valueColor={BT.text.secondary} border={false} />
              </SectionPanel>
            </div>
            <BtTabWrapper>
              <TaxModule dealId={resolvedDealId} />
            </BtTabWrapper>
          </div>
        )}

        {activeTab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1 }}>
                <div style={{ flex: 1 }}><KpiTile label="LTV"  value={`${ltv}%`}          color={BT.text.cyan}     /></div>
                <div style={{ flex: 1 }}><KpiTile label="LTC"  value={`${ltc}%`}          color={BT.met.financial} /></div>
                <div style={{ flex: 1 }}><KpiTile label="DSCR" value={`${dscr.toFixed(2)}x`} color={BT.text.amber} /></div>
              </div>
              <SectionPanel
                title="CAPITAL STACK"
                subtitle={`Total Basis ${fmt$(totalBasis)}`}
                borderColor={BT.text.cyan}
              >
                <div style={{ padding: '8px 10px 6px' }}>
                  <div style={{ display: 'flex', height: 20, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      width: `${debtPct}%`, background: BT.text.cyan,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.bg.terminal }}>
                        DEBT {debtPct}%
                      </span>
                    </div>
                    <div style={{
                      width: `${equityPct}%`, background: BT.met.financial,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.bg.terminal }}>
                        EQ {equityPct}%
                      </span>
                    </div>
                  </div>
                </div>
                <DataRow label="SENIOR DEBT"  value={fmt$(debtAmt)}   valueColor={BT.text.cyan}    sub={`${debtPct}% of stack`} />
                <DataRow label="EQUITY"       value={fmt$(equityAmt)} valueColor={BT.met.financial} sub={`${equityPct}% of stack`} />
                <DataRow label="TOTAL BASIS"  value={fmt$(totalBasis)} valueColor={BT.text.primary} border={false} />
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
                      <DataRow label="IRR"          value={fmtPct(r.irr)}             valueColor={BT.met.financial} />
                      <DataRow label="EM"           value={`${r.em.toFixed(2)}×`}     valueColor={BT.text.amber}   />
                      <DataRow label="NET PROCEEDS" value={fmt$(r.netProceeds)}        valueColor={BT.text.cyan}    border={false} />
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
