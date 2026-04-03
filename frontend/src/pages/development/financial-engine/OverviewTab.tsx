import React, { useState, useEffect } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile, AlertBanner, TableHeader } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, AnnualCashFlowRow } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

const MONO = BT.font.mono;

interface PlatformData {
  exitCap?: number;
  capRate?: number;
}

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

type OverviewSubTab = 'summary' | 'insights';

export function OverviewTab({ dealId, deal, dealType, assumptions, modelResults }: FinancialEngineTabProps) {
  const [subTab, setSubTab] = useState<OverviewSubTab>('summary');
  const summary = modelResults?.summary;
  const su = modelResults?.sourcesAndUses;
  const cf = modelResults?.annualCashFlow ?? [];

  const dealData = deal?.deal_data as Record<string, unknown> | undefined;
  const brokerCapRate = typeof dealData?.broker_cap_rate === 'number' ? dealData.broker_cap_rate / 100
    : typeof deal?.cap_rate === 'number' ? (deal.cap_rate as number) / 100 : null;
  const brokerPurchasePrice = typeof deal?.purchase_price === 'number' ? deal.purchase_price as number
    : typeof deal?.asking_price === 'number' ? deal.asking_price as number : null;

  const [platformData, setPlatformData] = useState<PlatformData>({});

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/strategy-analyses/${dealId}`).then((res: any) => {
      const raw = res?.data;
      const strats = raw?.data ?? raw?.analyses ?? raw;
      if (Array.isArray(strats) && strats.length > 0) {
        const s = strats[0] as any;
        const pd: PlatformData = {};
        if (s?.assumptions?.exitCap) pd.exitCap = s.assumptions.exitCap / 100;
        if (s?.assumptions?.capRate) pd.capRate = s.assumptions.capRate / 100;
        setPlatformData(pd);
      }
    }).catch(() => {});
  }, [dealId]);

  type ProFormaRow = { label: string; brokerFmt: string; platformFmt: string; brokerRaw: number | null; platformRaw: number | null };
  const proFormaRows: ProFormaRow[] = [
    { label: 'EXIT CAP RATE', brokerFmt: brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—', platformFmt: platformData.exitCap != null ? fmtPct(platformData.exitCap * 100) : '—', brokerRaw: brokerCapRate, platformRaw: platformData.exitCap ?? null },
    { label: 'ACQUISITION CAP RATE', brokerFmt: brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—', platformFmt: platformData.capRate != null ? fmtPct(platformData.capRate * 100) : '—', brokerRaw: brokerCapRate, platformRaw: platformData.capRate ?? null },
    { label: 'PURCHASE PRICE', brokerFmt: brokerPurchasePrice != null ? fmt$(brokerPurchasePrice) : '—', platformFmt: '—', brokerRaw: brokerPurchasePrice, platformRaw: null },
    { label: 'VACANCY RATE', brokerFmt: '—', platformFmt: '—', brokerRaw: null, platformRaw: null },
    { label: 'EXPENSE RATIO', brokerFmt: '—', platformFmt: '—', brokerRaw: null, platformRaw: null },
  ];
  const anyCollision = proFormaRows.some(r => collisionDot(r.brokerRaw, r.platformRaw) != null);

  const totalSources = su?.sources?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const totalUses = su?.uses?.reduce((s, r) => s + r.amount, 0) ?? 0;

  const SUB_TABS: { k: OverviewSubTab; l: string }[] = [
    { k: 'summary', l: 'EXECUTIVE SUMMARY' },
    { k: 'insights', l: 'AI INSIGHTS' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
        {SUB_TABS.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)} style={{
            background: subTab === t.k ? BT.bg.active : 'transparent',
            color: subTab === t.k ? BT.met.financial : BT.text.muted,
            border: 'none', padding: '3px 10px', fontFamily: MONO, fontSize: 9,
            cursor: 'pointer', letterSpacing: 0.5, borderBottom: subTab === t.k ? `1px solid ${BT.met.financial}` : '1px solid transparent',
          }}>{t.l}</button>
        ))}
      </div>

      {subTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
            {[
              { label: 'IRR', value: summary?.irr != null ? fmtPct(summary.irr) : '—', color: BT.met.financial },
              { label: 'EQUITY MULT', value: summary?.equityMultiple != null ? fmtX(summary.equityMultiple) : '—', color: BT.text.amber },
              { label: 'CASH-ON-CASH', value: summary?.cashOnCash != null ? fmtPct(summary.cashOnCash) : '—', color: BT.met.occupancy },
              { label: 'YEAR 1 NOI', value: summary?.noi != null ? fmt$(summary.noi) : '—', color: BT.text.cyan },
              { label: 'DSCR', value: summary?.dscr != null ? `${summary.dscr.toFixed(2)}×` : '—', color: BT.text.green },
            ].map(k => (
              <div key={k.label} style={{ flex: 1 }}><KpiTile label={k.label} value={k.value} color={k.color} /></div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="SOURCES" subtitle="Capital Structure" borderColor={BT.met.financial}>
              {su?.sources?.map((r, i) => (
                <DataRow key={i} label={r.label} value={fmt$(r.amount)} valueColor={BT.met.financial} border={i < (su.sources.length - 1)} />
              )) ?? <DataRow label="—" value="Awaiting model build" valueColor={BT.text.muted} border={false} />}
              {su && <DataRow label="TOTAL SOURCES" value={fmt$(totalSources)} valueColor={BT.text.white} border={false} />}
            </SectionPanel>

            <SectionPanel title="USES" subtitle="Capital Deployment" borderColor={BT.text.cyan}>
              {su?.uses?.map((r, i) => (
                <DataRow key={i} label={r.label} value={fmt$(r.amount)} valueColor={BT.text.cyan} border={i < (su.uses.length - 1)} />
              )) ?? <DataRow label="—" value="Awaiting model build" valueColor={BT.text.muted} border={false} />}
              {su && <DataRow label="TOTAL USES" value={fmt$(totalUses)} valueColor={BT.text.white} border={false} />}
            </SectionPanel>
          </div>

          <SectionPanel title="RETURNS BREAKDOWN" subtitle="Full Deal Period" borderColor={BT.text.amber}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>DEAL LEVEL</div>
                <DataRow label="IRR" value={summary?.irr != null ? fmtPct(summary.irr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="EQUITY MULTIPLE" value={summary?.equityMultiple != null ? fmtX(summary.equityMultiple) : '—'} valueColor={BT.text.amber} />
                <DataRow label="CASH-ON-CASH" value={summary?.cashOnCash != null ? fmtPct(summary.cashOnCash) : '—'} valueColor={BT.met.occupancy} />
                <DataRow label="TOTAL PROFIT" value={summary?.totalProfit != null ? fmt$(summary.totalProfit) : '—'} valueColor={BT.text.white} border={false} />
              </div>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.cyan, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>LP RETURNS</div>
                <DataRow label="LP IRR" value={summary?.lpIrr != null ? fmtPct(summary.lpIrr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="LP EM" value={summary?.lpEm != null ? fmtX(summary.lpEm) : '—'} valueColor={BT.text.amber} />
                <DataRow label="LP DISTRIBUTIONS" value={summary?.lpTotalDistributions != null ? fmt$(summary.lpTotalDistributions) : '—'} valueColor={BT.text.cyan} />
                <DataRow label="LP PROFIT" value={summary?.lpProfit != null ? fmt$(summary.lpProfit) : '—'} valueColor={BT.text.white} border={false} />
              </div>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.orange, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>GP RETURNS</div>
                <DataRow label="GP IRR" value={summary?.gpIrr != null ? fmtPct(summary.gpIrr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="GP EM" value={summary?.gpEm != null ? fmtX(summary.gpEm) : '—'} valueColor={BT.text.amber} />
                <DataRow label="GP DISTRIBUTIONS" value={summary?.gpTotalDistributions != null ? fmt$(summary.gpTotalDistributions) : '—'} valueColor={BT.text.orange} />
                <DataRow label="PROMOTE EARNED" value={summary?.gpPromoteEarned != null ? fmt$(summary.gpPromoteEarned) : '—'} valueColor={BT.text.white} border={false} />
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title="RETURNS BY YEAR" subtitle="Annual Breakdown — Deal + LP + GP" borderColor={BT.text.purple}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
                    {['YEAR', 'NOI', 'DEBT SVC', 'CASH FLOW', 'LP DIST', 'GP DIST', 'CUM RETURN', 'EM'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', color: BT.text.muted, textAlign: h === 'YEAR' ? 'left' : 'right', fontWeight: 500, letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cf.length > 0 ? cf.map((row: AnnualCashFlowRow, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 6px', color: BT.text.secondary }}>{row.year}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.noi)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.debtService)}</td>
                      <td style={{ padding: '3px 6px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.cashFlow)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{row.lpDistribution != null ? fmt$(row.lpDistribution) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.orange, textAlign: 'right' }}>{row.gpDistribution != null ? fmt$(row.gpDistribution) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.amber, textAlign: 'right' }}>{row.cumulativeReturn != null ? fmt$(row.cumulativeReturn) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.purple, textAlign: 'right' }}>{row.runningEM != null ? fmtX(row.runningEM) : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} style={{ padding: '12px 6px', color: BT.text.muted, textAlign: 'center' }}>Build model to generate annual projections</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionPanel>

          <SectionPanel title="DISPOSITION SUMMARY" subtitle="Exit Strategy Overview" borderColor={BT.text.amber}>
            <DataRow label="EXIT CAP RATE" value={assumptions?.disposition?.exitCapRate != null ? fmtPct(assumptions.disposition.exitCapRate * 100) : '—'} valueColor={BT.text.amber} />
            <DataRow label="HOLD PERIOD" value={assumptions?.holdPeriod != null ? `${assumptions.holdPeriod} years` : '—'} valueColor={BT.text.secondary} />
            <DataRow label="SELLING COSTS" value={assumptions?.disposition?.sellingCosts != null ? fmtPct(assumptions.disposition.sellingCosts * 100) : '—'} valueColor={BT.text.secondary} />
            <DataRow label="EXIT VALUE" value={summary?.exitValue != null ? fmt$(summary.exitValue) : '—'} valueColor={BT.met.financial} />
            <DataRow label="TOTAL PROFIT" value={summary?.totalProfit != null ? fmt$(summary.totalProfit) : '—'} valueColor={BT.text.white} border={false} />
          </SectionPanel>

          <div style={{ flexShrink: 0 }}>
            {anyCollision ? (
              <AlertBanner label="COLLISION DETECTED" text="Broker and platform assumptions diverge >10% on highlighted rows" color={BT.text.amber} badge={<Bd c={BT.text.amber}>REVIEW REQUIRED</Bd>} />
            ) : (
              <AlertBanner label="3-LAYER MODEL" text="BROKER · PLATFORM · YOU — No divergences detected above threshold" color={BT.met.financial} badge={<Bd c={BT.met.financial}>ALIGNED</Bd>} />
            )}
            <TableHeader cols={[
              { label: 'ASSUMPTION', flex: 2, color: BT.text.muted },
              { label: 'BROKER', flex: 1, color: BT.text.cyan },
              { label: 'PLATFORM', flex: 1, color: BT.text.purple },
              { label: 'YOU', flex: 1, color: BT.text.amber },
            ]} />
            {proFormaRows.map((row, i) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center',
                background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <div style={{ flex: 2, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {row.label}{collisionDot(row.brokerRaw, row.platformRaw)}
                </div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.cyan, textAlign: 'right' as const }}>{row.brokerFmt}</div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.purple, textAlign: 'right' as const }}>{row.platformFmt}</div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.amber, textAlign: 'right' as const }}>—</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'insights' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SectionPanel title="JEDI AI INSIGHTS" subtitle="Opus-powered deal intelligence" borderColor={BT.met.financial}>
            <div style={{ padding: '12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8, color: BT.text.muted, fontSize: 9, letterSpacing: 0.5 }}>SOURCE: ENGINE + AI</div>
              <div style={{ color: BT.text.primary }}>
                Build the financial model to generate AI-powered insights. Opus will analyze your assumptions,
                identify risks, and provide data-driven commentary on deal performance.
              </div>
            </div>
          </SectionPanel>
        </div>
      )}
    </div>
  );
}

export default OverviewTab;
