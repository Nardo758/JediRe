import React, { useCallback, useState, useEffect } from 'react';
import { BT, SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtPctRaw } from './types';
import { apiClient } from '../../../services/api.client';

const MONO = BT.font.mono;

// ─── Inline editable cell ────────────────────────────────────────────────────

interface EditableCellProps {
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
}

function EditableCell({ value, onCommit, placeholder = '+ Add' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = useCallback(() => {
    setRaw(value != null ? String(value) : '');
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    const num = raw.trim() === '' ? null : Number(raw.replace(/[$,]/g, ''));
    onCommit(!num || isNaN(num) ? null : num);
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
          fontFamily: MONO, fontSize: 9, color: BT.text.amber,
          background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}`,
          borderRadius: 2, padding: '1px 4px', width: 90, textAlign: 'right', outline: 'none',
        }}
      />
    );
  }
  return (
    <span onClick={start} title="Click to edit" style={{
      fontFamily: MONO, fontSize: 9, cursor: 'text',
      color: value != null ? BT.text.amber : BT.text.muted,
      borderBottom: `1px dashed ${BT.border.medium}`, minWidth: 50, display: 'inline-block', textAlign: 'right',
    }}>
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

// ─── Color maps ──────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  seniorDebt:      BT.text.cyan,
  mezzDebt:        '#b78fff',
  sellerFinancing: BT.text.amber,
  lpEquity:        BT.met.financial,
  gpEquity:        BT.text.orange,
};

const USE_COLORS: Record<string, string> = {
  purchasePrice:  BT.text.white,
  closingCosts:   BT.text.secondary,
  transferTax:    BT.text.red,
  originationFee: BT.text.amber,
  lenderReserves: '#b78fff',
  capex:          BT.text.orange,
  workingCapital: BT.text.cyan,
  preopeningCosts:BT.text.orange,
  otherUses:      BT.text.secondary,
};

// ─── Benchmark peer thresholds (Florida multifamily) ────────────────────────

const BENCH_THRESHOLDS = {
  closingCostsPct: { lo: 0.008, hi: 0.05 },  // 0.8%–5.0% of total uses
  debtPct:         { lo: 0.50,  hi: 0.80 },  // 50%–80% of total sources
  costPerUnit:     { lo: 80000, hi: 300000 }, // $80K–$300K/unit
};

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function SourcesUsesTab({
  dealId, deal, assumptions, modelResults, f9Financials, onF9Refresh,
}: FinancialEngineTabProps) {

  const su = f9Financials?.sourcesUses ?? null;

  // ── Local state for pending overrides (optimistic UI) ─────────────────────
  const [pendingOvr, setPendingOvr] = useState<Record<string, number | null>>({});
  const [useActualCapex, setUseActualCapex] = useState(false);
  const [actualCapexItems, setActualCapexItems] = useState<Array<{
    id: string; category: string; description: string | null; vendor: string | null;
    budgeted: number; actual: number; remaining: number;
    completionPct: number | null; status: string | null;
  }>>([]);
  const [actualCapexLoading, setActualCapexLoading] = useState(false);

  const handleOvr = useCallback(async (key: string, v: number | null) => {
    setPendingOvr(prev => ({ ...prev, [key]: v }));
    await patchSuOverride(dealId, key, v);
    onF9Refresh?.();
    // Clear pending after refresh
    setPendingOvr(prev => { const next = { ...prev }; delete next[key]; return next; });
  }, [dealId, onF9Refresh]);

  // Resolve override value: pending → backend persisted → null
  const ovr = useCallback((key: string): number | null => {
    if (key in pendingOvr) return pendingOvr[key];
    return (su?.userOverrides as Record<string, number | null> | undefined)?.[key] ?? null;
  }, [pendingOvr, su]);

  // ── Fallback values when backend su is null ───────────────────────────────
  const purchasePriceFb = f9Financials?.capitalStack?.purchasePrice
    ?? assumptions?.acquisition?.purchasePrice
    ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);

  const loanAmountFb  = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount ?? purchasePriceFb * 0.65;
  const equityFb      = f9Financials?.capitalStack?.equityAtClose ?? Math.max(0, purchasePriceFb - loanAmountFb);
  const totalUnitsFb  = f9Financials?.totalUnits ?? (typeof deal?.unit_count === 'number' ? deal.unit_count as number : 0);
  const mezzAmtFb     = f9Financials?.debt?.loans?.find(l => l.id === 'mezz')?.loanAmount?.platform ?? 0;

  const capexLineItems   = assumptions?.capex?.lineItems ?? [];
  const capexTotalFb     = capexLineItems.reduce((s, i) => s + i.amount, 0);
  const contingencyPct   = assumptions?.capex?.contingencyPct ?? 0.05;
  const reservesPerUnit  = assumptions?.capex?.reservesPerUnit ?? 250;
  const totalCapexFb     = capexTotalFb * (1 + contingencyPct) + totalUnitsFb * reservesPerUnit;
  const closingCostsFb   = Object.values(assumptions?.acquisition?.closingCosts ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  const origFeePct       = f9Financials?.capitalStack?.originationFeePct ?? assumptions?.financing?.originationFee ?? 0.01;
  const origFeeFb        = loanAmountFb * origFeePct;
  const transferTaxFb    = f9Financials?.taxes?.transferTax?.totalTransferTax ?? 0;

  const lpShareFb = assumptions?.waterfall?.lpShare ?? 0.90;
  const gpShareFb = assumptions?.waterfall?.gpShare ?? 0.10;

  // ── Display values: backend su wins ─────────────────────────────────────
  const totalSources = su?.totalSources ?? (loanAmountFb + mezzAmtFb + equityFb);
  const totalUses    = su?.totalUses    ?? (purchasePriceFb + closingCostsFb + transferTaxFb + origFeeFb + totalCapexFb);
  const delta        = su?.delta        ?? (totalSources - totalUses);
  const balanced     = su?.balanced     ?? (Math.abs(delta) < 1000);
  const totalUnits   = totalUnitsFb;
  const bench        = su?.benchmarks;

  // ── Build source rows ─────────────────────────────────────────────────────
  type RowItem = { id: string; label: string; amount: number; pct: number; sub: string; color: string; userOverridable: boolean };

  const buildSourceRows = (): RowItem[] => {
    if (su && su.sources.length > 0) {
      return su.sources
        .filter(s => s.userOverridable ? true : (s.amount ?? 0) > 0)
        .map(s => ({
          id: s.id, label: s.label, amount: s.amount ?? 0, pct: s.pct ?? 0,
          sub: s.sub ?? '', color: SOURCE_COLORS[s.id] ?? BT.met.financial,
          userOverridable: s.userOverridable ?? false,
        }));
    }
    const items: RowItem[] = [];
    const total = Math.max(loanAmountFb + mezzAmtFb + equityFb, 1);
    if (loanAmountFb > 0) items.push({ id: 'seniorDebt', label: 'SENIOR DEBT', amount: loanAmountFb, pct: loanAmountFb / total, color: BT.text.cyan, sub: `${fmtPct((loanAmountFb / Math.max(purchasePriceFb, 1)) * 100)} LTV`, userOverridable: false });
    if (mezzAmtFb > 0)    items.push({ id: 'mezzDebt',   label: 'MEZZ / B-NOTE', amount: mezzAmtFb,  pct: mezzAmtFb / total,   color: '#b78fff', sub: 'Subordinate debt', userOverridable: false });
    if (equityFb > 0)     items.push({ id: 'lpEquity',   label: 'LP EQUITY',   amount: equityFb * lpShareFb, pct: (equityFb * lpShareFb) / total, color: BT.met.financial, sub: `${fmtPct(lpShareFb * 100)} LP split`, userOverridable: false });
    if (equityFb > 0)     items.push({ id: 'gpEquity',   label: 'GP EQUITY',   amount: equityFb * gpShareFb, pct: (equityFb * gpShareFb) / total, color: BT.text.orange,   sub: `${fmtPct(gpShareFb * 100)} GP co-invest`, userOverridable: false });
    return items;
  };

  const buildUseRows = (): RowItem[] => {
    if (su && su.uses.length > 0) {
      return su.uses
        // Keep non-overridable only when > 0; always keep overridable rows (editable)
        .filter(u => u.userOverridable ? true : (u.amount ?? 0) > 0)
        .map(u => ({
          id: u.id, label: u.label, amount: u.amount ?? 0, pct: u.pct ?? 0,
          sub: u.sub ?? '', color: USE_COLORS[u.id] ?? BT.text.secondary,
          userOverridable: u.userOverridable,
        }));
    }
    const items: RowItem[] = [];
    const total = Math.max(purchasePriceFb + closingCostsFb + transferTaxFb + origFeeFb + totalCapexFb, 1);
    if (purchasePriceFb > 0) items.push({ id: 'purchasePrice',  label: 'PURCHASE PRICE',   amount: purchasePriceFb, pct: purchasePriceFb / total, color: BT.text.white,     sub: totalUnits > 0 ? `${fmt$(purchasePriceFb / totalUnits)}/unit` : '', userOverridable: false });
    if (closingCostsFb > 0)  items.push({ id: 'closingCosts',   label: 'CLOSING COSTS',    amount: closingCostsFb,  pct: closingCostsFb / total,  color: BT.text.secondary, sub: 'Title, legal, survey', userOverridable: true });
    if (transferTaxFb > 0)   items.push({ id: 'transferTax',    label: 'TRANSFER TAXES',   amount: transferTaxFb,   pct: transferTaxFb / total,   color: BT.text.red,       sub: 'Doc stamps + intangible tax — from Taxes tab', userOverridable: false });
    if (origFeeFb > 0)       items.push({ id: 'originationFee', label: 'LOAN ORIGINATION', amount: origFeeFb,       pct: origFeeFb / total,       color: BT.text.amber,     sub: `${fmtPct(origFeePct * 100)} of loan`, userOverridable: false });
    if (totalCapexFb > 0)    items.push({ id: 'capex',          label: 'RENOVATION / CAPEX', amount: totalCapexFb, pct: totalCapexFb / total,     color: BT.text.orange,    sub: 'Renovation & value-add budget', userOverridable: true });
    return items;
  };

  const sourceRows = buildSourceRows();
  const useRows    = buildUseRows();

  // ── IDs already present in backend rows (to avoid duplicating editable rows) ─
  const sourcesHasId = new Set(su?.sources?.map(s => s.id) ?? []);
  const usesHasId    = new Set(su?.uses?.map(u => u.id) ?? []);

  // ── Lease-up reserve line (LEASE-UP-RESERVE-IS-S&U rule) ─────────────────
  // When mode = LEASE_UP_NEW_CONSTRUCTION and the backend has not already
  // included the line in su.uses, inject it from the LV engine output.
  // The reserve is ALWAYS a use-of-funds regardless of leasing_cost_treatment.
  //
  // Contract invariant: peakCumulativeReserve is the cumulative sum of
  // monthly cash-shortfall reserves from the LV engine monthly table.
  // It is treatment-invariant — cost treatment only affects whether concessions
  // flow through ops or are capitalized, but the required cash reserve to fund
  // the lease-up period does not change with treatment classification.
  // Backend guarantee: when M07 + engine ship, peakCumulativeReserve will
  // mirror max(cumulativeShortfall) from the monthly table regardless of
  // the leasing_cost_treatment query param.
  const lv = f9Financials?.leaseVelocity ?? null;
  const showLeaseUpReserve =
    lv?.resolvedMode === 'LEASE_UP_NEW_CONSTRUCTION' &&
    !usesHasId.has('leaseUpReserve');
  const leaseUpReserveAmount = lv?.peakCumulativeReserve ?? null;

  // Effective total uses includes the reserve line when injected on the frontend.
  // effectiveDelta and effectiveBalanced must also account for the injected reserve
  // so that the balance status row and header badge remain internally consistent.
  const injectedReserve = showLeaseUpReserve && leaseUpReserveAmount != null ? leaseUpReserveAmount : 0;
  const effectiveTotalUses = (su?.totalUses ?? totalUses) + injectedReserve;
  const effectiveDelta    = delta - injectedReserve;
  const effectiveBalanced = Math.abs(effectiveDelta) < 1000;

  // Editable rows that should appear as ADD placeholders (only when not already in the grid)
  const sourceEditableRows: { key: string; id: string; label: string }[] = [
    { key: 'sellerFinancing', id: 'sellerFinancing', label: 'SELLER FINANCING' },
  ].filter(r => !sourcesHasId.has(r.id));

  const useEditableRows: { key: string; id: string; label: string }[] = [
    { key: 'closingCosts',    id: 'closingCosts',   label: 'CLOSING COSTS' },
    { key: 'capexTotal',      id: 'capex',          label: 'RENOVATION / CAPEX' },
    { key: 'workingCapital',  id: 'workingCapital', label: 'WORKING CAPITAL' },
    { key: 'preopeningCosts', id: 'preopeningCosts',label: 'PRE-OPENING COSTS' },
    { key: 'otherUses',       id: 'otherUses',      label: 'OTHER USES' },
  ].filter(r => !usesHasId.has(r.id));

  // Fetch actual capex items from DB when toggle is on
  useEffect(() => {
    if (!useActualCapex || !dealId) return;
    setActualCapexLoading(true);
    apiClient.get(`/api/v1/deals/${dealId}/renovation`)
      .then(res => {
        const items = res.data?.data?.capexItems || [];
        setActualCapexItems(items);
      })
      .catch(err => {
        console.warn('Failed to load actual capex items:', err.message);
        setActualCapexItems([]);
      })
      .finally(() => setActualCapexLoading(false));
  }, [useActualCapex, dealId]);

  const modelSu = modelResults?.sourcesAndUses;

  // ── Benchmark flag helper ────────────────────────────────────────────────
  const benchFlag = (val: number | null, lo: number, hi: number): string | null => {
    if (val == null) return null;
    if (val < lo) return `⬇ Below peer range (${fmtPct(lo * 100)}–${fmtPct(hi * 100)})`;
    if (val > hi) return `⬆ Above peer range (${fmtPct(lo * 100)}–${fmtPct(hi * 100)})`;
    return null;
  };

  const closingCostsPct = bench?.closingCostsPct ?? (totalUses > 0 && (closingCostsFb + transferTaxFb) > 0 ? (closingCostsFb + transferTaxFb) / totalUses : null);
  const debtPct         = bench?.debtPct ?? (totalSources > 0 ? (loanAmountFb + mezzAmtFb) / totalSources : null);
  const costPerUnit     = bench?.totalCostPerUnit ?? (totalUnits > 0 && totalUses > 0 ? Math.round(totalUses / totalUnits) : null);
  const equityPct       = bench?.equityPct ?? (totalSources > 0 ? Math.max(0, totalSources - (loanAmountFb + mezzAmtFb)) / totalSources : null);
  const capexPerUnit    = bench?.capexPerUnit ?? (totalUnits > 0 && totalCapexFb > 0 ? Math.round(totalCapexFb / totalUnits) : null);

  const ccFlag    = benchFlag(closingCostsPct, BENCH_THRESHOLDS.closingCostsPct.lo, BENCH_THRESHOLDS.closingCostsPct.hi);
  const debtFlag  = benchFlag(debtPct, BENCH_THRESHOLDS.debtPct.lo, BENCH_THRESHOLDS.debtPct.hi);
  const cpuFlag   = costPerUnit != null ? benchFlag(costPerUnit / 1000, BENCH_THRESHOLDS.costPerUnit.lo / 1000, BENCH_THRESHOLDS.costPerUnit.hi / 1000) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>CAPITAL DEPLOYMENT · DAY-ONE CLOSE</span>
        <Bd c={BT.text.cyan}>SOURCES & USES</Bd>
        {effectiveBalanced
          ? <Bd c={BT.met.financial}>BALANCED</Bd>
          : <Bd c={BT.text.red}>IMBALANCE {effectiveDelta > 0 ? '+' : ''}{fmt$(effectiveDelta)}</Bd>
        }
        {su && <Bd c={BT.text.muted}>BACKEND</Bd>}
        {showLeaseUpReserve && <Bd c={BT.text.teal}>LEASE-UP</Bd>}
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL SOURCES" value={totalSources > 0 ? fmt$(totalSources) : '—'} color={BT.met.financial} />
        <KpiTile label="TOTAL USES"    value={effectiveTotalUses > 0 ? fmt$(effectiveTotalUses) : '—'} color={BT.text.white} />
        <KpiTile label="LTV AT CLOSE"  value={debtPct != null ? fmtPctRaw(debtPct) : (loanAmountFb > 0 && purchasePriceFb > 0 ? fmtPct((loanAmountFb / purchasePriceFb) * 100) : '—')} color={BT.text.cyan} />
        <KpiTile label="EQUITY REQ'D"  value={
          (equityFb > 0 || (su?.sources?.some(s => s.id.includes('Equity')))) ? fmt$(su ? su.sources.filter(s => s.id === 'lpEquity' || s.id === 'gpEquity').reduce((a, b) => a + (b.amount ?? 0), 0) : equityFb) : '—'
        } color={BT.met.financial} />
        <KpiTile label="COST / UNIT"   value={costPerUnit != null ? fmt$(costPerUnit) : '—'} color={BT.text.secondary} />
      </div>

      {/* ── Sources + Uses side by side ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>

        {/* Sources */}
        <SectionPanel title="SOURCES OF FUNDS" subtitle="Capital raised at close" borderColor={BT.met.financial}>
          {sourceRows.map((s, i) => {
            if (s.userOverridable) {
              return (
                <div key={s.id} style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < sourceRows.length - 1 ? `1px solid ${BT.border.subtle}` : undefined }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{fmtPct(s.pct * 100)} of total · {s.sub}</div>
                  </div>
                  <EditableCell value={ovr(s.id === 'sellerFinancing' ? 'sellerFinancing' : s.id)} onCommit={v => handleOvr(s.id === 'sellerFinancing' ? 'sellerFinancing' : s.id, v)} />
                </div>
              );
            }
            return (
              <DataRow key={s.id} label={s.label} value={fmt$(s.amount)} valueColor={s.color}
                sub={`${fmtPct(s.pct * 100)} of total · ${s.sub}`}
                border={i < sourceRows.length - 1} />
            );
          })}

          {/* Add-only editable rows (id not yet in sources) */}
          {sourceEditableRows.map(r => (
            <div key={r.id} style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{r.label}</span>
              <EditableCell value={ovr(r.key)} onCommit={v => handleOvr(r.key, v)} />
            </div>
          ))}

          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL SOURCES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>{totalSources > 0 ? fmt$(totalSources) : '—'}</span>
          </div>

          {/* Stacked bar */}
          {sourceRows.length > 0 && (
            <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
              {sourceRows.map(s => (
                <div key={s.id} title={`${s.label}: ${fmt$(s.amount)}`} style={{ flex: Math.max(s.pct, 0.01), height: 12, background: s.color, opacity: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{s.pct > 0.15 ? s.label.split(' ')[0] : ''}</span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* Uses */}
        <SectionPanel title="USES OF FUNDS" subtitle="Capital deployed at close" borderColor={BT.text.amber}>
          {useRows.map((u, i) => {
            if (u.userOverridable) {
              const ovrKey = u.id === 'capex' ? 'capexTotal' : u.id;
              return (
                <div key={u.id} style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < useRows.length - 1 ? `1px solid ${BT.border.subtle}` : undefined }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: u.color, fontWeight: 600 }}>{u.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{fmtPct(u.pct * 100)} of total · {u.sub}</div>
                  </div>
                  <EditableCell value={ovr(ovrKey)} onCommit={v => handleOvr(ovrKey, v)} placeholder={fmt$(u.amount)} />
                </div>
              );
            }
            return (
              <DataRow key={u.id} label={u.label} value={fmt$(u.amount)} valueColor={u.color}
                sub={`${fmtPct(u.pct * 100)} of total · ${u.sub}`}
                border={i < useRows.length - 1} />
            );
          })}

          {/* Add-only editable rows (id not yet in uses) */}
          {useEditableRows.map(r => (
            <div key={r.id} style={{ padding: '3px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{r.label}</span>
              <EditableCell value={ovr(r.key)} onCommit={v => handleOvr(r.key, v)} />
            </div>
          ))}

          {/* Lease-Up Reserve — injected when LV engine reports LEASE_UP mode */}
          {showLeaseUpReserve && (
            <div style={{
              padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: `1px solid ${BT.text.teal}40`,
              background: `${BT.text.teal}08`,
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.teal, fontWeight: 600 }}>
                  LEASE-UP RESERVE
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  Peak cumulative negative cash position · S&U regardless of cost treatment · LV engine
                </div>
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.teal, fontWeight: 600 }}>
                {leaseUpReserveAmount != null ? fmt$(leaseUpReserveAmount) : '—  pending engine'}
              </span>
            </div>
          )}

          <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}`, background: `${BT.text.cyan}10` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, fontWeight: 700 }}>TOTAL USES</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, fontWeight: 700 }}>{effectiveTotalUses > 0 ? fmt$(effectiveTotalUses) : '—'}</span>
          </div>

          {/* Stacked bar */}
          {useRows.length > 0 && (
            <div style={{ padding: '8px', display: 'flex', gap: 2 }}>
              {useRows.map(u => (
                <div key={u.id} title={`${u.label}: ${fmt$(u.amount)}`} style={{ flex: Math.max(u.pct, 0.01), height: 12, background: u.color, opacity: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: BT.bg.base }}>{u.pct > 0.15 ? u.label.split(' ')[0] : ''}</span>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      {/* ── Reconciliation row ─────────────────────────────────────────────── */}
      <div style={{ padding: '4px 12px', background: effectiveBalanced ? `${BT.met.financial}12` : `${BT.text.red}12`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: effectiveBalanced ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
          {effectiveBalanced ? 'SOURCES = USES · BALANCED' : `EQUITY GAP ${fmt$(Math.abs(effectiveDelta))}`}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: effectiveBalanced ? BT.met.financial : BT.text.red, fontWeight: 700 }}>
          {effectiveBalanced ? '✓' : `${effectiveDelta >= 0 ? '+' : ''}${fmt$(effectiveDelta)}`}
        </span>
      </div>

      {/* ── Benchmarks ─────────────────────────────────────────────────────── */}
      <SectionPanel title="DEAL BENCHMARKS" subtitle="Cost metrics and capital structure ratios vs FL multifamily peers" borderColor={BT.text.cyan}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          <KpiTile label="COST / UNIT"         value={costPerUnit != null ? fmt$(costPerUnit) : '—'}                       color={cpuFlag  ? BT.text.red : BT.text.white}    sub={cpuFlag  ?? undefined} />
          <KpiTile label="COST / SF"           value={bench?.totalCostPerSf != null ? fmt$(bench.totalCostPerSf) : '—'}   color={BT.text.secondary} />
          <KpiTile label="CLOSING COSTS %"     value={closingCostsPct != null ? fmtPctRaw(closingCostsPct) : '—'}         color={ccFlag   ? BT.text.amber : BT.text.red}    sub={ccFlag   ?? undefined} />
          <KpiTile label="DEBT % OF SOURCES"   value={debtPct != null ? fmtPctRaw(debtPct) : '—'}                         color={debtFlag ? BT.text.amber : BT.text.cyan}   sub={debtFlag ?? undefined} />
          <KpiTile label="EQUITY % OF SOURCES" value={equityPct != null ? fmtPctRaw(equityPct) : '—'}                     color={BT.met.financial} />
          <KpiTile label="CAPEX / UNIT"        value={capexPerUnit != null ? fmt$(capexPerUnit) : '—'}                    color={BT.text.orange} />
        </div>
      </SectionPanel>

      {/* ── Capex line items with Model/Actual toggle ───────────────────── */}
      {(capexLineItems.length > 0 || useActualCapex) && (
        <SectionPanel
          title={useActualCapex ? 'CAPEX LINE ITEMS (actual)' : 'CAPEX LINE ITEMS (model)'}
          subtitle={useActualCapex
            ? 'From deal_capex_items table — vendor, dates, completion %'
            : 'Renovation & value-add budget detail — from financial assumptions'
          }
          borderColor={BT.text.orange}
        >
          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setUseActualCapex(false)}
              style={{
                padding: '3px 8px', fontSize: 9, fontFamily: 'system-ui, sans-serif',
                background: !useActualCapex ? '#1d4ed8' : '#1e293b',
                color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Modeled
            </button>
            <button
              onClick={() => setUseActualCapex(true)}
              style={{
                padding: '3px 8px', fontSize: 9, fontFamily: 'system-ui, sans-serif',
                background: useActualCapex ? '#1d4ed8' : '#1e293b',
                color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Actual (DB)
            </button>
            {actualCapexLoading && (
              <span style={{ fontSize: 8, color: '#64748b' }}>Loading…</span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            {!useActualCapex ? (
              /* Model-based capex */
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
                      <td style={{ padding: '3px 8px', color: BT.text.amber, textAlign: 'right' }}>{capexTotalFb > 0 ? fmtPct((item.amount / capexTotalFb) * 100) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: `${BT.text.orange}10`, borderTop: `2px solid ${BT.border.medium}` }}>
                    <td style={{ padding: '4px 8px', color: BT.text.orange, fontWeight: 700 }}>TOTAL CAPEX + RESERVES</td>
                    <td style={{ padding: '4px 8px', color: BT.text.orange, textAlign: 'right', fontWeight: 700 }}>{fmt$(totalCapexFb)}</td>
                    <td style={{ padding: '4px 8px', color: BT.text.secondary, textAlign: 'right' }}>{totalUnits > 0 ? fmt$(totalCapexFb / totalUnits) : '—'}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            ) : (
              /* Actual capex from deal_capex_items */
              actualCapexItems.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                      {['CATEGORY', 'DESCRIPTION', 'VENDOR', 'BUDGETED', 'ACTUAL', 'REMAINING', '% DONE', 'STATUS'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'CATEGORY' || h === 'DESCRIPTION' || h === 'VENDOR' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actualCapexItems.map((item, i) => (
                      <tr key={item.id} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                        <td style={{ padding: '3px 8px', color: BT.text.secondary }}>{item.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                        <td style={{ padding: '3px 8px', color: BT.text.primary }}>{item.description || '—'}</td>
                        <td style={{ padding: '3px 8px', color: BT.text.secondary }}>{item.vendor || '—'}</td>
                        <td style={{ padding: '3px 8px', color: BT.text.orange, textAlign: 'right' }}>{fmt$(item.budgeted)}</td>
                        <td style={{ padding: '3px 8px', color: '#10b981', textAlign: 'right' }}>{item.actual > 0 ? fmt$(item.actual) : '—'}</td>
                        <td style={{ padding: '3px 8px', color: '#f59e0b', textAlign: 'right' }}>{item.remaining > 0 ? fmt$(item.remaining) : '—'}</td>
                        <td style={{ padding: '3px 8px', color: BT.text.secondary, textAlign: 'right' }}>{item.completionPct != null ? item.completionPct + '%' : '—'}</td>
                        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                          <span style={{
                            color: item.status === 'completed' ? '#10b981'
                              : item.status === 'in_progress' ? '#3b82f6'
                              : item.status === 'planned' ? '#f59e0b' : '#64748b',
                          }}>
                            {item.status ? item.status.replace(/_/g, ' ') : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: `${BT.text.orange}10`, borderTop: `2px solid ${BT.border.medium}` }}>
                      <td colSpan={3} style={{ padding: '4px 8px', color: BT.text.orange, fontWeight: 700 }}>TOTAL</td>
                      <td style={{ padding: '4px 8px', color: BT.text.orange, textAlign: 'right', fontWeight: 700 }}>
                        {fmt$(actualCapexItems.reduce((s, i) => s + i.budgeted, 0))}
                      </td>
                      <td style={{ padding: '4px 8px', color: '#10b981', textAlign: 'right', fontWeight: 700 }}>
                        {fmt$(actualCapexItems.reduce((s, i) => s + (i.actual || 0), 0))}
                      </td>
                      <td style={{ padding: '4px 8px', color: '#f59e0b', textAlign: 'right', fontWeight: 700 }}>
                        {fmt$(actualCapexItems.reduce((s, i) => s + (i.remaining || 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: BT.text.muted, fontSize: 9 }}>
                  No actual capex items in the database. Add them via the Assumptions tab (Renovation section) or the renovation API.
                </div>
              )
            )}
          </div>
        </SectionPanel>
      )}

      {/* ── Equity Structure ───────────────────────────────────────────────── */}
      <SectionPanel title="EQUITY STRUCTURE" subtitle="LP / GP split at close" borderColor={BT.met.financial}>
        {(() => {
          const lpShare = assumptions?.waterfall?.lpShare ?? 0.90;
          const gpShare = assumptions?.waterfall?.gpShare ?? 0.10;
          const totalEq = su
            ? su.sources.filter(s => s.id === 'lpEquity' || s.id === 'gpEquity').reduce((a, b) => a + (b.amount ?? 0), 0)
            : equityFb;
          const lpEq  = totalEq * lpShare;
          const gpEq  = totalEq * gpShare;
          return (
            <>
              <DataRow label="TOTAL EQUITY"         value={fmt$(totalEq)} valueColor={BT.text.white}  sub={`${fmtPct((totalEq / Math.max(totalSources, 1)) * 100)} of total sources`} />
              <DataRow label="LP EQUITY"             value={fmt$(lpEq)}   valueColor={BT.text.cyan}   sub={`${fmtPct(lpShare * 100)} LP split`} />
              <DataRow label="GP EQUITY (CO-INVEST)" value={fmt$(gpEq)}   valueColor={BT.text.orange} sub={`${fmtPct(gpShare * 100)} GP split`} border={false} />
            </>
          );
        })()}
      </SectionPanel>

      {/* ── Model sources & uses (if financial model was run) ─────────────── */}
      {(() => {
        const mSrc = Array.isArray(modelSu?.sources) ? modelSu!.sources : [];
        const mUse = Array.isArray(modelSu?.uses)    ? modelSu!.uses    : [];
        return mSrc.length > 0 || mUse.length > 0 ? (
          <SectionPanel title="MODEL SOURCES & USES" subtitle="From financial model run" borderColor={'#b78fff'}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}` }}>SOURCES</div>
                {mSrc.map((s, i) => (
                  <DataRow key={i} label={s.label} value={fmt$(s.amount)} valueColor={BT.met.financial} border={i < mSrc.length - 1} />
                ))}
              </div>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}` }}>USES</div>
                {mUse.map((u, i) => (
                  <DataRow key={i} label={u.label} value={fmt$(u.amount)} valueColor={BT.text.amber} border={i < mUse.length - 1} />
                ))}
              </div>
            </div>
          </SectionPanel>
        ) : null;
      })()}

    </div>
  );
}

export default SourcesUsesTab;
