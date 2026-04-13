import React, { useCallback, useState } from 'react';
import { BT, SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtPctRaw } from './types';

const MONO = BT.font.mono;

// ─── Inline editable cell ───────────────────────────────────────────────────

interface EditableCellProps {
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
}

function EditableCell({ value, onCommit, placeholder = '—' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = useCallback(() => {
    setRaw(value != null ? String(value) : '');
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    const parsed = raw.trim() === '' ? null : Number(raw.replace(/[,$]/g, ''));
    onCommit(isNaN(parsed as number) ? null : parsed);
    setEditing(false);
  }, [raw, onCommit]);

  if (editing) {
    return (
      <input
        autoFocus
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          fontFamily: MONO, fontSize: 9, color: BT.text.amber, background: `${BT.text.amber}15`,
          border: `1px solid ${BT.text.amber}`, borderRadius: 2, padding: '1px 4px',
          width: 90, textAlign: 'right', outline: 'none',
        }}
      />
    );
  }
  return (
    <span
      title="Click to edit"
      onClick={start}
      style={{
        fontFamily: MONO, fontSize: 9, cursor: 'text',
        color: value != null ? BT.text.amber : BT.text.muted,
        borderBottom: `1px dashed ${BT.border.medium}`,
      }}
    >
      {value != null ? fmt$(value) : placeholder}
    </span>
  );
}

// ─── PATCH helper ────────────────────────────────────────────────────────────

async function patchSuOverride(dealId: string, key: string, value: number | null): Promise<void> {
  await fetch(`/api/v1/deals/${dealId}/financials/override`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field: `su:${key}`, year: 0, value }),
  });
}

// ─── Color mapping ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  seniorDebt:      BT.text.cyan,
  mezzDebt:        BT.text.purple ?? '#b78fff',
  sellerFinancing: BT.text.amber,
  lpEquity:        BT.met.financial,
  gpEquity:        BT.text.orange,
};

const USE_COLORS: Record<string, string> = {
  purchasePrice:  BT.text.white,
  closingCosts:   BT.text.secondary,
  transferTax:    BT.text.red,
  originationFee: BT.text.amber,
  lenderReserves: BT.text.purple ?? '#b78fff',
  workingCapital: BT.text.cyan,
  preopeningCosts:BT.text.orange,
  otherUses:      BT.text.secondary,
};

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function SourcesUsesTab({
  dealId, deal, assumptions, modelResults, f9Financials, onF9Refresh,
}: FinancialEngineTabProps) {

  // ── Prefer backend sourcesUses when available ──────────────────────────────
  const su = f9Financials?.sourcesUses;

  // ── Local overrides state (before backend refresh) ─────────────────────────
  const [localOvr, setLocalOvr] = useState<Record<string, number | null>>({});

  const handleOvr = useCallback(async (key: string, v: number | null) => {
    setLocalOvr(prev => ({ ...prev, [key]: v }));
    await patchSuOverride(dealId, key, v);
    onF9Refresh?.();
  }, [dealId, onF9Refresh]);

  // ── Fallback: derive locally from capitalStack + taxes + debt when su is null ──
  const purchasePriceFb  = f9Financials?.capitalStack?.purchasePrice
    ?? assumptions?.acquisition?.purchasePrice
    ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);

  const loanAmountFb     = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? purchasePriceFb * 0.65;

  const equityFb         = f9Financials?.capitalStack?.equityAtClose
    ?? (purchasePriceFb - loanAmountFb);

  const totalUnitsFb     = f9Financials?.totalUnits
    ?? (typeof deal?.unit_count === 'number' ? deal.unit_count as number : 0);

  const capexLineItems   = assumptions?.capex?.lineItems ?? [];
  const capexTotal       = capexLineItems.reduce((s, i) => s + i.amount, 0);
  const contingencyPct   = assumptions?.capex?.contingencyPct ?? 0.05;
  const capexContingency = capexTotal * contingencyPct;
  const reservesPerUnit  = assumptions?.capex?.reservesPerUnit ?? 250;
  const capexReserves    = totalUnitsFb * reservesPerUnit;
  const totalCapexFb     = capexTotal + capexContingency + capexReserves;

  const closingCostsFb   = Object.values(assumptions?.acquisition?.closingCosts ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  const origFeePct       = f9Financials?.capitalStack?.originationFeePct ?? assumptions?.financing?.originationFee ?? 0.01;
  const origFeeFb        = loanAmountFb * origFeePct;
  const transferTaxFb    = f9Financials?.taxes?.transferTax?.totalTransferTax ?? 0;

  // Mezz from debt stack
  const mezzLoan         = f9Financials?.debt?.loans?.find(l => l.id === 'mezz');
  const mezzAmtFb        = mezzLoan?.loanAmount?.platform ?? 0;

  // LP/GP split
  const lpShareFb        = assumptions?.waterfall?.lpShare ?? 0.90;
  const gpShareFb        = assumptions?.waterfall?.gpShare ?? 0.10;

  const totalUsesFb      = purchasePriceFb + closingCostsFb + transferTaxFb + origFeeFb + totalCapexFb;
  const totalSourcesFb   = loanAmountFb + mezzAmtFb + equityFb;
  const deltaFb          = totalSourcesFb - totalUsesFb;
  const balancedFb       = Math.abs(deltaFb) < 1000;

  // ── Display values — backend su wins where populated ──────────────────────
  const totalSources = su?.totalSources ?? totalSourcesFb;
  const totalUses    = su?.totalUses    ?? totalUsesFb;
  const delta        = su?.delta        ?? deltaFb;
  const balanced     = su?.balanced     ?? balancedFb;
  const totalUnits   = totalUnitsFb;

  const bench = su?.benchmarks;

  // ── Resolve override values (local pending → backend persisted → 0) ────────
  const ovr = (key: keyof NonNullable<typeof su>['userOverrides']): number | null =>
    key in localOvr ? localOvr[key] : (su?.userOverrides?.[key] ?? null);

  // ── Build sources display ─────────────────────────────────────────────────
  type DisplayItem = { id: string; label: string; amount: number; pct: number; sub: string; color: string };

  const buildSources = (): DisplayItem[] => {
    if (su && su.sources.length > 0) {
      return su.sources
        .filter(s => (s.amount ?? 0) > 0)
        .map(s => ({
          id: s.id, label: s.label, amount: s.amount!, pct: s.pct ?? 0,
          sub: s.sub ?? '', color: SOURCE_COLORS[s.id] ?? BT.met.financial,
        }));
    }
    const items: DisplayItem[] = [];
    const total = Math.max(totalSourcesFb, 1);
    if (loanAmountFb > 0) items.push({ id: 'seniorDebt', label: 'SENIOR DEBT', amount: loanAmountFb, pct: loanAmountFb / total, color: BT.text.cyan, sub: `${fmtPct((loanAmountFb / Math.max(purchasePriceFb, 1)) * 100)} LTV` });
    if (mezzAmtFb > 0)    items.push({ id: 'mezzDebt',   label: 'MEZZ / B-NOTE', amount: mezzAmtFb, pct: mezzAmtFb / total, color: '#b78fff', sub: 'Subordinate debt' });
    if (equityFb > 0)     items.push({ id: 'lpEquity',   label: 'LP EQUITY', amount: equityFb * lpShareFb, pct: (equityFb * lpShareFb) / total, color: BT.met.financial, sub: `${fmtPct(lpShareFb * 100)} LP split` });
    if (equityFb > 0)     items.push({ id: 'gpEquity',   label: 'GP EQUITY',  amount: equityFb * gpShareFb, pct: (equityFb * gpShareFb) / total, color: BT.text.orange, sub: `${fmtPct(gpShareFb * 100)} GP co-invest` });
    return items;
  };

  const buildUses = (): DisplayItem[] => {
    if (su && su.uses.length > 0) {
      return su.uses
        .filter(u => (u.amount ?? 0) > 0)
        .map(u => ({
          id: u.id, label: u.label, amount: u.amount!, pct: u.pct ?? 0,
          sub: u.sub ?? '', color: USE_COLORS[u.id] ?? BT.text.secondary,
        }));
    }
    const items: DisplayItem[] = [];
    const total = Math.max(totalUsesFb, 1);
    if (purchasePriceFb > 0)  items.push({ id: 'purchasePrice',  label: 'PURCHASE PRICE',    amount: purchasePriceFb,  pct: purchasePriceFb / total,  color: BT.text.white,     sub: totalUnits > 0 ? `${fmt$(purchasePriceFb / totalUnits)}/unit` : '' });
    if (closingCostsFb > 0)   items.push({ id: 'closingCosts',   label: 'CLOSING COSTS',     amount: closingCostsFb,   pct: closingCostsFb / total,   color: BT.text.secondary, sub: 'Title, legal, survey' });
    if (transferTaxFb > 0)    items.push({ id: 'transferTax',    label: 'TRANSFER TAXES',    amount: transferTaxFb,    pct: transferTaxFb / total,    color: BT.text.red,       sub: 'Doc stamps + intangible — from Taxes tab' });
    if (origFeeFb > 0)        items.push({ id: 'originationFee', label: 'LOAN ORIGINATION',  amount: origFeeFb,        pct: origFeeFb / total,        color: BT.text.amber,     sub: `${fmtPct(origFeePct * 100)} of loan` });
    if (totalCapexFb > 0)     items.push({ id: 'lenderReserves', label: 'CAPEX / RESERVES',  amount: totalCapexFb,     pct: totalCapexFb / total,     color: BT.text.orange,    sub: `${fmt$(capexTotal)} capex + ${fmt$(capexContingency)} contingency + ${fmt$(capexReserves)} reserves` });
    return items;
  };

  const sourceItems  = buildSources();
  const useItems     = buildUses();
  const modelSu      = modelResults?.sourcesAndUses;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>CAPITAL DEPLOYMENT · DAY-ONE CLOSE</span>
        <Bd c={BT.text.cyan}>SOURCES & USES</Bd>
        {balanced
          ? <Bd c={BT.met.financial}>BALANCED</Bd>
          : <Bd c={BT.text.red}>IMBALANCE {delta > 0 ? '+' : ''}{fmt$(delta)}</Bd>
        }
        {su && <Bd c={BT.text.muted}>BACKEND</Bd>}
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL SOURCES" value={totalSources > 0 ? fmt$(totalSources) : '—'} color={BT.met.financial} />
        <KpiTile label="TOTAL USES"    value={totalUses > 0    ? fmt$(totalUses)    : '—'} color={BT.text.white} />
        <KpiTile label="LTV AT CLOSE"  value={
          (su?.benchmarks?.debtPct != null)
            ? fmtPctRaw(su.benchmarks.debtPct)
            : (loanAmountFb > 0 && purchasePriceFb > 0 ? fmtPct((loanAmountFb / purchasePriceFb) * 100) : '—')
        } color={BT.text.cyan} />
        <KpiTile label="EQUITY REQ'D"  value={
          su ? (su.sources.find(s => s.id === 'lpEquity' || s.id === 'gpEquity') ? fmt$((su.sources.filter(s => s.id === 'lpEquity' || s.id === 'gpEquity').reduce((a, b) => a + (b.amount ?? 0), 0))) : '—')
             : (equityFb > 0 ? fmt$(equityFb) : '—')
        } color={BT.met.financial} />
        <KpiTile label="COST / UNIT"   value={bench?.totalCostPerUnit != null ? fmt$(bench.totalCostPerUnit) : (totalUnits > 0 && totalUses > 0 ? fmt$(totalUses / totalUnits) : '—')} color={BT.text.secondary} />
      </div>

      {/* ── Sources + Uses side by side ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>

        {/* Sources */}
        <SectionPanel title="SOURCES OF FUNDS" subtitle="Capital raised at close" borderColor={BT.met.financial}>
          {sourceItems.map((s, i) => (
            <DataRow key={s.id} label={s.label} value={fmt$(s.amount)} valueColor={s.color}
              sub={`${fmtPct(s.pct * 100)} of total · ${s.sub}`}
              border={i < sourceItems.length - 1} />
          ))}

          {/* Seller Financing override row */}
          <div style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>SELLER FINANCING</span>
            <EditableCell value={ovr('sellerFinancing')} onCommit={v => handleOvr('sellerFinancing', v)} placeholder="+ Add" />
          </div>

          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL SOURCES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>{totalSources > 0 ? fmt$(totalSources) : '—'}</span>
          </div>

          {/* Stacked bar */}
          <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
            {sourceItems.map(s => (
              <div key={s.id} title={s.label} style={{ flex: Math.max(s.pct, 0.01), height: 12, background: s.color, opacity: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{s.pct > 0.15 ? s.label.split(' ')[0] : ''}</span>
              </div>
            ))}
          </div>
        </SectionPanel>

        {/* Uses */}
        <SectionPanel title="USES OF FUNDS" subtitle="Capital deployed at close" borderColor={BT.text.amber}>
          {useItems.map((u, i) => (
            <DataRow key={u.id} label={u.label} value={fmt$(u.amount)} valueColor={u.color}
              sub={`${fmtPct(u.pct * 100)} of total · ${u.sub}`}
              border={i < useItems.length - 1} />
          ))}

          {/* User-editable Uses */}
          {(
            [
              { key: 'workingCapital',  label: 'WORKING CAPITAL',   color: BT.text.cyan },
              { key: 'preopeningCosts', label: 'PRE-OPENING COSTS',  color: BT.text.orange },
              { key: 'otherUses',       label: 'OTHER USES',         color: BT.text.secondary },
            ] as { key: keyof NonNullable<typeof su>['userOverrides']; label: string; color: string }[]
          ).map(row => (
            <div key={row.key} style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{row.label}</span>
              <EditableCell value={ovr(row.key)} onCommit={v => handleOvr(row.key, v)} placeholder="+ Add" />
            </div>
          ))}

          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL USES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, fontWeight: 700 }}>{totalUses > 0 ? fmt$(totalUses) : '—'}</span>
          </div>

          {/* Stacked bar */}
          <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
            {useItems.map(u => (
              <div key={u.id} title={u.label} style={{ flex: Math.max(u.pct, 0.01), height: 12, background: u.color, opacity: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{u.pct > 0.15 ? u.label.split(' ')[0] : ''}</span>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>

      {/* ── Reconciliation row ─────────────────────────────────────────────── */}
      <div style={{ padding: '4px 12px', background: balanced ? `${BT.met.financial}12` : `${BT.text.red}12`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: balanced ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
          {balanced ? 'SOURCES = USES · BALANCED' : 'SOURCES ≠ USES · ADJUST EQUITY OR DEBT'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: balanced ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
          {delta > 0 ? '+' : ''}{fmt$(delta)}
        </span>
      </div>

      {/* ── Benchmarks ─────────────────────────────────────────────────────── */}
      <SectionPanel title="DEAL BENCHMARKS" subtitle="Cost metrics and capital structure ratios" borderColor={BT.text.cyan}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          <KpiTile label="COST / UNIT"        value={bench?.totalCostPerUnit != null ? fmt$(bench.totalCostPerUnit) : (totalUnits > 0 && totalUses > 0 ? fmt$(Math.round(totalUses / totalUnits)) : '—')} color={BT.text.white} />
          <KpiTile label="COST / SF"          value={bench?.totalCostPerSf != null ? fmt$(bench.totalCostPerSf) : '—'} color={BT.text.secondary} />
          <KpiTile label="CLOSING COSTS %"    value={bench?.closingCostsPct != null ? fmtPctRaw(bench.closingCostsPct) : (totalUses > 0 && transferTaxFb > 0 ? fmtPct((transferTaxFb / totalUses) * 100) : '—')} color={BT.text.red} />
          <KpiTile label="DEBT % OF SOURCES"  value={bench?.debtPct != null ? fmtPctRaw(bench.debtPct) : (totalSources > 0 ? fmtPct(((loanAmountFb + mezzAmtFb) / totalSources) * 100) : '—')} color={BT.text.cyan} />
          <KpiTile label="EQUITY % OF SOURCES" value={bench?.equityPct != null ? fmtPctRaw(bench.equityPct) : (totalSources > 0 ? fmtPct((equityFb / totalSources) * 100) : '—')} color={BT.met.financial} />
          <KpiTile label="CAPEX / UNIT"       value={bench?.capexPerUnit != null ? fmt$(bench.capexPerUnit) : (totalUnits > 0 && totalCapexFb > 0 ? fmt$(Math.round(totalCapexFb / totalUnits)) : '—')} color={BT.text.orange} />
        </div>
      </SectionPanel>

      {/* ── Lender Reserves detail (from Debt tab) ─────────────────────────── */}
      {su?.uses?.some(u => u.id === 'lenderReserves' && (u.amount ?? 0) > 0) && (() => {
        const lrRow = su.uses.find(u => u.id === 'lenderReserves')!;
        return (
          <SectionPanel title="LENDER RESERVES AT CLOSE" subtitle="From Debt tab — senior loan requirements" borderColor={'#b78fff'}>
            <DataRow label="T&I ESCROW" value="—" sub="Taxes & insurance escrow (estimated)" valueColor={BT.text.secondary} />
            <DataRow label="REPLACEMENT RESERVE" value="—" sub="Per-unit annual replacement reserve" valueColor={BT.text.secondary} />
            <DataRow label="OPERATING RESERVE" value="—" sub="Debt service operating reserve" valueColor={BT.text.secondary} />
            <DataRow label="TOTAL LENDER RESERVES" value={fmt$(lrRow.amount!)} valueColor={'#b78fff'} sub={lrRow.sub ?? ''} border={false} />
          </SectionPanel>
        );
      })()}

      {/* ── Capex breakdown (from assumptions) ─────────────────────────────── */}
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
                  <td style={{ padding: '4px 8px', color: BT.text.orange, textAlign: 'right', fontWeight: 700 }}>{fmt$(totalCapexFb)}</td>
                  <td style={{ padding: '4px 8px', color: BT.text.secondary, textAlign: 'right' }}>{totalUnits > 0 ? fmt$(totalCapexFb / totalUnits) : '—'}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </SectionPanel>
      )}

      {/* ── Equity Structure ───────────────────────────────────────────────── */}
      <SectionPanel title="EQUITY STRUCTURE" subtitle="LP / GP split at close" borderColor={BT.met.financial}>
        {(() => {
          const lpShare = assumptions?.waterfall?.lpShare ?? 0.90;
          const gpShare = assumptions?.waterfall?.gpShare ?? 0.10;
          const totalEq = su ? (su.sources.filter(s => s.id === 'lpEquity' || s.id === 'gpEquity').reduce((a, b) => a + (b.amount ?? 0), 0)) : equityFb;
          const lpEq    = totalEq * lpShare;
          const gpEq    = totalEq * gpShare;
          return (
            <>
              <DataRow label="TOTAL EQUITY"        value={fmt$(totalEq)} valueColor={BT.text.white}    sub={`${fmtPct((totalEq / Math.max(totalSources, 1)) * 100)} of total sources`} />
              <DataRow label="LP EQUITY"            value={fmt$(lpEq)}   valueColor={BT.text.cyan}     sub={`${fmtPct(lpShare * 100)} LP split`} />
              <DataRow label="GP EQUITY (CO-INVEST)" value={fmt$(gpEq)}  valueColor={BT.text.orange}   sub={`${fmtPct(gpShare * 100)} GP split`} border={false} />
            </>
          );
        })()}
      </SectionPanel>

      {/* ── Model sources & uses if available ─────────────────────────────── */}
      {modelSu && (modelSu.sources.length > 0 || modelSu.uses.length > 0) && (
        <SectionPanel title="MODEL SOURCES & USES" subtitle="From financial model" borderColor={BT.text.purple ?? '#b78fff'}>
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

    </div>
  );
}

export default SourcesUsesTab;
