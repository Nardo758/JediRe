import React, { useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct } from './types';

const MONO = BT.font.mono;

interface SourceItem { label: string; amount: number; pct: number; color: string; sub?: string }
interface UseItem    { label: string; amount: number; pct: number; color: string; sub?: string }

export function SourcesUsesTab({ dealId, deal, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const purchasePrice = f9Financials?.capitalStack?.purchasePrice
    ?? assumptions?.acquisition?.purchasePrice
    ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);

  const loanAmount = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? purchasePrice * 0.65;

  const equity = f9Financials?.capitalStack?.equityAtClose
    ?? (purchasePrice - loanAmount);

  const totalUnits = f9Financials?.totalUnits ?? (typeof deal?.unit_count === 'number' ? deal.unit_count as number : 0);

  const capexLineItems = assumptions?.capex?.lineItems ?? [];
  const capexTotal = capexLineItems.reduce((s, i) => s + i.amount, 0);
  const contingencyPct = assumptions?.capex?.contingencyPct ?? 0.05;
  const capexContingency = capexTotal * contingencyPct;
  const reservesPerUnit = assumptions?.capex?.reservesPerUnit ?? 250;
  const capexReserves = totalUnits * reservesPerUnit;
  const totalCapex = capexTotal + capexContingency + capexReserves;

  const closingCosts = Object.values(assumptions?.acquisition?.closingCosts ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  const originationFeePct = f9Financials?.capitalStack?.originationFeePct ?? assumptions?.financing?.originationFee ?? 0.01;
  const originationFee = loanAmount * originationFeePct;

  const transferTaxAmount = f9Financials?.taxes?.transferTax?.totalTransferTax ?? 0;

  const totalUses = purchasePrice + closingCosts + transferTaxAmount + originationFee + totalCapex;
  const totalSources = loanAmount + equity;
  const delta = totalSources - totalUses;

  const sources: SourceItem[] = useMemo(() => {
    const items: SourceItem[] = [];
    const total = Math.max(totalSources, 1);
    if (loanAmount > 0) items.push({ label: 'SENIOR DEBT', amount: loanAmount, pct: loanAmount / total, color: BT.text.cyan, sub: `${fmtPct((loanAmount / purchasePrice) * 100)} LTV` });
    if (equity > 0)    items.push({ label: 'LP/GP EQUITY', amount: equity, pct: equity / total, color: BT.met.financial, sub: 'Investor capital at close' });
    return items;
  }, [loanAmount, equity, totalSources, purchasePrice]);

  const uses: UseItem[] = useMemo(() => {
    const items: UseItem[] = [];
    const total = Math.max(totalUses, 1);
    if (purchasePrice > 0)    items.push({ label: 'PURCHASE PRICE',    amount: purchasePrice,    pct: purchasePrice / total,    color: BT.text.white,     sub: totalUnits > 0 ? `${fmt$(purchasePrice / totalUnits)}/unit` : undefined });
    if (closingCosts > 0)     items.push({ label: 'CLOSING COSTS',      amount: closingCosts,     pct: closingCosts / total,     color: BT.text.secondary, sub: 'Title, legal' });
    if (transferTaxAmount > 0) items.push({ label: 'TRANSFER TAXES',    amount: transferTaxAmount, pct: transferTaxAmount / total, color: BT.text.red,      sub: 'Doc stamps + intangible tax (FL) — from Taxes tab' });
    if (originationFee > 0)   items.push({ label: 'LOAN ORIGINATION',   amount: originationFee,   pct: originationFee / total,   color: BT.text.amber,   sub: `${fmtPct(originationFeePct * 100)} of loan` });
    if (totalCapex > 0)       items.push({ label: 'CAPEX / RESERVES',   amount: totalCapex,       pct: totalCapex / total,       color: BT.text.orange,    sub: `${fmt$(capexTotal)} capex + ${fmt$(capexContingency)} contingency + ${fmt$(capexReserves)} reserves` });
    return items;
  }, [purchasePrice, closingCosts, transferTaxAmount, originationFee, totalCapex, totalUses, totalUnits]);

  const modelSu = modelResults?.sourcesAndUses;

  const BALANCED = Math.abs(delta) < 1000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>CAPITAL DEPLOYMENT · DAY-ONE CLOSE</span>
        <Bd c={BT.text.cyan}>SOURCES & USES</Bd>
        {BALANCED
          ? <Bd c={BT.met.financial}>BALANCED</Bd>
          : <Bd c={BT.text.red}>IMBALANCE {delta > 0 ? '+' : ''}{fmt$(delta)}</Bd>
        }
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL SOURCES" value={totalSources > 0 ? fmt$(totalSources) : '—'} color={BT.met.financial} />
        <KpiTile label="TOTAL USES" value={totalUses > 0 ? fmt$(totalUses) : '—'} color={BT.text.white} />
        <KpiTile label="LTV AT CLOSE" value={purchasePrice > 0 ? fmtPct((loanAmount / purchasePrice) * 100) : '—'} color={BT.text.cyan} />
        <KpiTile label="EQUITY REQUIRED" value={equity > 0 ? fmt$(equity) : '—'} color={BT.met.financial} />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {/* Sources */}
        <SectionPanel title="SOURCES OF FUNDS" subtitle="Capital raised at close" borderColor={BT.met.financial}>
          {sources.map((s, i) => (
            <DataRow key={s.label} label={s.label} value={fmt$(s.amount)} valueColor={s.color}
              sub={`${fmtPct(s.pct * 100)} of total · ${s.sub ?? ''}`}
              border={i < sources.length - 1} />
          ))}
          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL SOURCES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>{fmt$(totalSources)}</span>
          </div>

          {/* Visual bar */}
          <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
            {sources.map(s => (
              <div key={s.label} title={s.label} style={{
                flex: s.pct, height: 12, background: s.color, opacity: 0.7, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{s.pct > 0.15 ? s.label : ''}</span>
              </div>
            ))}
          </div>
        </SectionPanel>

        {/* Uses */}
        <SectionPanel title="USES OF FUNDS" subtitle="Capital deployed at close" borderColor={BT.text.amber}>
          {uses.map((u, i) => (
            <DataRow key={u.label} label={u.label} value={fmt$(u.amount)} valueColor={u.color}
              sub={`${fmtPct(u.pct * 100)} of total · ${u.sub ?? ''}`}
              border={i < uses.length - 1} />
          ))}
          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL USES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 700 }}>{fmt$(totalUses)}</span>
          </div>

          {/* Visual bar */}
          <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
            {uses.map(u => (
              <div key={u.label} title={u.label} style={{
                flex: u.pct, height: 12, background: u.color, opacity: 0.7, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{u.pct > 0.15 ? u.label.split(' ')[0] : ''}</span>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>

      {/* Capex breakdown */}
      {capexLineItems.length > 0 && (
        <SectionPanel title="CAPEX LINE ITEMS" subtitle="Renovation & value-add budget" borderColor={BT.text.orange}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                  {['ITEM', 'AMOUNT', '$/UNIT', '% OF CAPEX'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'ITEM' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {capexLineItems.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 8px', color: BT.text.primary }}>{item.description}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.orange, textAlign: 'right' }}>{fmt$(item.amount)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{totalUnits > 0 ? fmt$(item.amount / totalUnits) : '—'}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.amber, textAlign: 'right' }}>{capexTotal > 0 ? fmtPct((item.amount / capexTotal) * 100) : '—'}</td>
                  </tr>
                ))}
                <tr style={{ background: `${BT.text.orange}10`, borderTop: `2px solid ${BT.border.medium}` }}>
                  <td style={{ padding: '3px 8px', color: BT.text.orange, fontWeight: 700 }}>SUBTOTAL CAPEX</td>
                  <td style={{ padding: '3px 8px', color: BT.text.orange, textAlign: 'right', fontWeight: 700 }}>{fmt$(capexTotal)}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{totalUnits > 0 ? fmt$(capexTotal / totalUnits) : '—'}</td>
                  <td style={{ padding: '3px 8px', color: BT.text.amber, textAlign: 'right', fontWeight: 700 }}>100.0%</td>
                </tr>
                {capexContingency > 0 && (
                  <tr style={{ background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary }}>CONTINGENCY ({fmtPct(contingencyPct * 100)})</td>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{fmt$(capexContingency)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
                {capexReserves > 0 && (
                  <tr style={{ background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary }}>RESERVES ({fmt$(reservesPerUnit)}/unit)</td>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{fmt$(capexReserves)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
                <tr style={{ background: `${BT.text.orange}15`, borderTop: `2px solid ${BT.border.medium}` }}>
                  <td style={{ padding: '4px 8px', color: BT.text.orange, fontWeight: 700 }}>TOTAL CAPEX + RESERVES</td>
                  <td style={{ padding: '4px 8px', color: BT.text.orange, textAlign: 'right', fontWeight: 700 }}>{fmt$(totalCapex)}</td>
                  <td style={{ padding: '4px 8px', color: BT.text.secondary, textAlign: 'right' }}>{totalUnits > 0 ? fmt$(totalCapex / totalUnits) : '—'}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </SectionPanel>
      )}

      {/* Model sources & uses if available */}
      {modelSu && (modelSu.sources.length > 0 || modelSu.uses.length > 0) && (
        <SectionPanel title="MODEL SOURCES & USES" subtitle="From financial model" borderColor={BT.text.purple}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <div>
              <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}` }}>SOURCES</div>
              {modelSu.sources.map((s, i) => (
                <DataRow key={i} label={s.label} value={fmt$(s.amount)} valueColor={BT.met.financial} border={i < modelSu.sources.length - 1} />
              ))}
            </div>
            <div>
              <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}` }}>USES</div>
              {modelSu.uses.map((u, i) => (
                <DataRow key={i} label={u.label} value={fmt$(u.amount)} valueColor={BT.text.amber} border={i < modelSu.uses.length - 1} />
              ))}
            </div>
          </div>
        </SectionPanel>
      )}

      {/* Equity waterfall summary */}
      <SectionPanel title="EQUITY STRUCTURE" subtitle="LP / GP split at close" borderColor={BT.met.financial}>
        {(() => {
          const lpShare  = assumptions?.waterfall?.lpShare  ?? 0.90;
          const gpShare  = assumptions?.waterfall?.gpShare  ?? 0.10;
          const lpEquity = equity * lpShare;
          const gpEquity = equity * gpShare;
          return (
            <>
              <DataRow label="TOTAL EQUITY" value={fmt$(equity)} valueColor={BT.text.white} sub={`${fmtPct((equity / totalSources) * 100)} of total sources`} />
              <DataRow label="LP EQUITY" value={fmt$(lpEquity)} valueColor={BT.text.cyan} sub={`${fmtPct(lpShare * 100)} LP split`} />
              <DataRow label="GP EQUITY (CO-INVEST)" value={fmt$(gpEquity)} valueColor={BT.text.orange} sub={`${fmtPct(gpShare * 100)} GP split`} border={false} />
            </>
          );
        })()}
      </SectionPanel>
    </div>
  );
}

export default SourcesUsesTab;
