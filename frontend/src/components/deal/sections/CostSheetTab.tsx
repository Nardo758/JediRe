import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { F9DealFinancials } from '../../../pages/development/financial-engine/types';

const MONO = "'JetBrains Mono', monospace";

const C = {
  bg:      '#0A0A0A',
  panel:   'rgba(255,255,255,0.025)',
  border:  'rgba(255,255,255,0.06)',
  text:    '#E8E6E1',
  muted:   'rgba(232,230,225,0.35)',
  dim:     'rgba(232,230,225,0.18)',
  green:   '#68D391',
  blue:    '#63B3ED',
  purple:  '#B794F4',
  amber:   '#F6AD55',
  red:     '#FC8181',
  yellow:  '#F6E05E',
  teal:    '#4FD1C5',
  cyan:    '#76E4F7',
};

export const SECTIONS = [
  { id: 'acquisition', label: 'Acquisition',            short: 'ACQ',  color: C.blue,   icon: '⌂' },
  { id: 'sponsor',     label: 'Sponsor / Dev Fees',     short: 'SPFEE',color: C.purple, icon: '◉' },
  { id: 'debt',        label: 'Debt Fees',               short: 'DFEE', color: C.amber,  icon: '⊙' },
  { id: 'closing',     label: 'Closing Costs',           short: 'CLOSE',color: C.teal,   icon: '◎' },
  { id: 'renovation',  label: 'Renovation / CapEx',      short: 'CAPEX',color: C.green,  icon: '⚙' },
  { id: 'carry',       label: 'Carry / Operating',       short: 'CARRY',color: C.red,    icon: '⏱' },
  { id: 'disposition', label: 'Disposition (Dispo)',      short: 'DISPO',color: C.yellow, icon: '→' },
];

export const TIMING_OPTIONS = [
  { id: 'closing',      label: 'Closing (T=0)'   },
  { id: 'month_1_6',    label: 'Month 1–6'       },
  { id: 'month_7_12',   label: 'Month 7–12'      },
  { id: 'month_13_18',  label: 'Month 13–18'     },
  { id: 'month_19_24',  label: 'Month 19–24'     },
  { id: 'month_25_plus',label: 'Month 25+'       },
  { id: 'disposition',  label: 'Disposition'     },
];

export interface CostLineItem {
  id: string;
  section: string;
  name: string;
  amount: number;
  timing: string;
  pctBasis?: boolean;
  pctValue?: number;
  note?: string;
  locked?: boolean;
  sourceKey?: string;
  synced?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function stableId(sourceKey: string) {
  return `src_${sourceKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Maps legacy name patterns → their canonical sourceKey and stableId.
 * Run once when loading saved data so that old cost sheets can sync in-place
 * instead of accumulating duplicate synced rows alongside old unlinked ones.
 */
const LEGACY_NAME_TO_SOURCE: Array<{ test: RegExp; sourceKey: string }> = [
  { test: /^Acquisition Fee/i,         sourceKey: 'wf:acquisitionFee'  },
  { test: /^Asset Mgmt Fee/i,          sourceKey: 'wf:assetMgmtFee'    },
  { test: /^Construction Mgmt Fee/i,   sourceKey: 'wf:constructionMgmt'},
  { test: /^Disposition Fee/i,         sourceKey: 'wf:dispositionFee'  },
  { test: /^Refinancing Fee/i,         sourceKey: 'wf:refinancingFee'  },
  ...(['A','B','C','D','E'].flatMap(letter => [
    { test: new RegExp(`^Origination Fee.*LOAN ${letter}`, 'i'), sourceKey: `debt:${letter}:origFee` },
    { test: new RegExp(`^Exit Fee.*LOAN ${letter}`, 'i'),        sourceKey: `debt:${letter}:exitFee` },
    { test: new RegExp(`^Rate Cap.*LOAN ${letter}`, 'i'),        sourceKey: `debt:${letter}:rateCap` },
  ])),
];

function migrateLegacyItems(items: CostLineItem[]): CostLineItem[] {
  // Collect stableIds already present so we don't assign the same one twice
  const usedIds = new Set(items.map(i => i.id));
  return items.map(item => {
    if (item.sourceKey) return item; // already migrated
    for (const { test, sourceKey } of LEGACY_NAME_TO_SOURCE) {
      if (test.test(item.name)) {
        const sid = stableId(sourceKey);
        // Only assign if the stableId isn't already claimed by another item
        if (!usedIds.has(sid)) {
          usedIds.add(sid);
          return { ...item, id: sid, sourceKey };
        }
        break; // stableId already exists — leave this item as user-owned
      }
    }
    return item;
  });
}

function buildDefaults(totalBasis: number, loanAmt: number): CostLineItem[] {
  const pct = (n: number) => Math.round(totalBasis * n);
  const lp  = (n: number) => Math.round(loanAmt  * n);
  return [
    // ACQUISITION
    { id: uid(), section: 'acquisition', name: 'Purchase Price',           amount: totalBasis,   timing: 'closing',    locked: true  },
    { id: uid(), section: 'acquisition', name: 'Survey',                   amount: 8500,          timing: 'closing'   },
    { id: uid(), section: 'acquisition', name: 'Environmental (Phase I)',   amount: 4500,          timing: 'closing'   },
    { id: uid(), section: 'acquisition', name: 'Inspection / Property Cond.',amount: 12000,        timing: 'closing'   },
    // SPONSOR FEES — sourceKey links to waterfall engine data
    { id: stableId('wf:acquisitionFee'),   section: 'sponsor', name: 'Acquisition Fee (1.00%)',             amount: pct(0.010), timing: 'closing',      sourceKey: 'wf:acquisitionFee'   },
    { id: stableId('wf:assetMgmtFee'),     section: 'sponsor', name: 'Asset Mgmt Fee (1.50%/yr)',           amount: pct(0.015), timing: 'month_1_6',    sourceKey: 'wf:assetMgmtFee'     },
    { id: stableId('wf:constructionMgmt'), section: 'sponsor', name: 'Construction Mgmt Fee (0.00%)',       amount: 0,          timing: 'month_1_6',    sourceKey: 'wf:constructionMgmt' },
    { id: uid(),                            section: 'sponsor', name: 'Promote / Incentive Fee',             amount: 0,          timing: 'disposition',  note: 'TBD at exit' },
    // DEBT FEES — sourceKey links to debt engine data (LOAN A = first/senior loan)
    { id: stableId('debt:A:origFee'),  section: 'debt', name: 'Origination Fee — LOAN A (1.00%)', amount: lp(0.010), timing: 'closing', sourceKey: 'debt:A:origFee'  },
    { id: stableId('debt:A:exitFee'),  section: 'debt', name: 'Exit Fee — LOAN A (0.00%)',         amount: 0,          timing: 'disposition', sourceKey: 'debt:A:exitFee'  },
    { id: stableId('debt:A:rateCap'),  section: 'debt', name: 'Rate Cap — LOAN A (0.00%)',          amount: 0,          timing: 'closing',  sourceKey: 'debt:A:rateCap'  },
    { id: uid(), section: 'debt', name: 'Processing / Admin Fee',    amount: 10000, timing: 'closing'   },
    { id: uid(), section: 'debt', name: 'Lender Title Insurance',    amount: 25000, timing: 'closing'   },
    { id: uid(), section: 'debt', name: 'Lender Legal',              amount: 20000, timing: 'closing'   },
    { id: uid(), section: 'debt', name: 'Appraisal',                 amount: 6500,  timing: 'closing'   },
    // CLOSING COSTS
    { id: uid(), section: 'closing', name: 'Title Insurance (Buyer)',   amount: pct(0.005), timing: 'closing' },
    { id: uid(), section: 'closing', name: 'Intangible Tax (0.2%)',     amount: pct(0.002), timing: 'closing' },
    { id: uid(), section: 'closing', name: 'Documentary Stamps (0.7%)', amount: pct(0.007), timing: 'closing' },
    { id: uid(), section: 'closing', name: 'Recording Fees',            amount: 5000,        timing: 'closing' },
    { id: uid(), section: 'closing', name: 'Buyer Legal / Attorney',    amount: 25000,       timing: 'closing' },
    { id: uid(), section: 'closing', name: 'Due Diligence Reserve',     amount: 30000,       timing: 'closing' },
    // RENOVATION / CAPEX
    { id: uid(), section: 'renovation', name: 'Unit Renovations',     amount: 0, timing: 'month_1_6',  note: 'Enter renovation budget' },
    { id: uid(), section: 'renovation', name: 'Common Areas',         amount: 0, timing: 'month_1_6'  },
    { id: uid(), section: 'renovation', name: 'Exterior / Roofing',   amount: 0, timing: 'month_7_12' },
    { id: uid(), section: 'renovation', name: 'FF&E',                 amount: 0, timing: 'month_1_6'  },
    { id: uid(), section: 'renovation', name: 'Contingency (5%)',     amount: 0, timing: 'month_7_12', note: 'Auto: 5% of renovation subtotal' },
    // CARRY / OPERATING
    { id: uid(), section: 'carry', name: 'Property Tax (carry)',    amount: 0,               timing: 'month_1_6' },
    { id: uid(), section: 'carry', name: 'Insurance (carry)',       amount: 0,               timing: 'month_1_6' },
    { id: uid(), section: 'carry', name: 'Utilities (carry)',       amount: 0,               timing: 'month_1_6' },
    { id: uid(), section: 'carry', name: 'Interest Reserve (est.)', amount: lp(0.085) / 4,  timing: 'month_1_6', note: '~3mo interest' },
    // DISPOSITION
    { id: stableId('wf:dispositionFee'), section: 'disposition', name: 'Disposition Fee (1.00%)',      amount: pct(0.010), timing: 'disposition', sourceKey: 'wf:dispositionFee' },
    { id: uid(),                          section: 'disposition', name: 'Broker Commission (3.00%)',    amount: pct(0.030), timing: 'disposition' },
    { id: uid(),                          section: 'disposition', name: 'Transfer Tax (Dispo)',         amount: pct(0.007), timing: 'disposition' },
    { id: uid(),                          section: 'disposition', name: 'Legal (Dispo)',                amount: 15000,       timing: 'disposition' },
    { id: uid(),                          section: 'disposition', name: 'Marketing / Signage',         amount: 10000,       timing: 'disposition' },
  ];
}

function computeSyncItems(f9: F9DealFinancials, totalBasis: number): CostLineItem[] {
  const out: CostLineItem[] = [];
  const loans = f9.debt?.loans ?? [];
  const totalDebt = f9.debt?.aggregate?.totalLoanAmount ?? 0;
  const equity = Math.max(totalBasis - totalDebt, 0);
  const holdYears = f9.projections?.length ?? 3;

  loans.forEach((loan, i) => {
    const letter = LETTERS[i] ?? `${i + 1}`;
    const loanAmt = loan.loanAmount.platform ?? 0;
    const origFeePct = loan.origFee.platform ?? 0;
    const exitFeePct = loan.exitFee.platform ?? 0;
    const rateCapPct = loan.rateCapCost.platform ?? 0;

    const origKey = `debt:${letter}:origFee`;
    const exitKey = `debt:${letter}:exitFee`;
    const capKey  = `debt:${letter}:rateCap`;

    if (loanAmt > 0) {
      out.push({
        id: stableId(origKey), section: 'debt',
        name: `Origination Fee — LOAN ${letter} (${(origFeePct * 100).toFixed(2)}%)`,
        amount: Math.round(loanAmt * origFeePct),
        timing: 'closing',
        sourceKey: origKey, synced: true,
      });
      if (exitFeePct > 0) {
        out.push({
          id: stableId(exitKey), section: 'debt',
          name: `Exit Fee — LOAN ${letter} (${(exitFeePct * 100).toFixed(2)}%)`,
          amount: Math.round(loanAmt * exitFeePct),
          timing: 'disposition',
          sourceKey: exitKey, synced: true,
        });
      } else {
        out.push({ id: stableId(exitKey), section: 'debt', name: `Exit Fee — LOAN ${letter} (0.00%)`, amount: 0, timing: 'disposition', sourceKey: exitKey, synced: true });
      }
      if (loan.rateType === 'Floating' && rateCapPct > 0) {
        out.push({
          id: stableId(capKey), section: 'debt',
          name: `Rate Cap — LOAN ${letter} (${(rateCapPct * 100).toFixed(2)}%)`,
          amount: Math.round(loanAmt * rateCapPct),
          timing: 'closing',
          sourceKey: capKey, synced: true,
        });
      } else if (loan.rateType === 'Floating') {
        out.push({ id: stableId(capKey), section: 'debt', name: `Rate Cap — LOAN ${letter} (0.00%)`, amount: 0, timing: 'closing', sourceKey: capKey, synced: true });
      }
    }
  });

  const wf = f9.waterfall?.fees;
  if (wf) {
    // Always emit acquisition, asset mgmt, construction mgmt, disposition — even at 0%
    // so they slot into the right place in buildDefaults and show live % labels.
    out.push({
      id: stableId('wf:acquisitionFee'), section: 'sponsor',
      name: `Acquisition Fee (${(wf.acquisitionFeePct * 100).toFixed(2)}%)`,
      amount: Math.round(equity * wf.acquisitionFeePct),
      timing: 'closing',
      sourceKey: 'wf:acquisitionFee', synced: true,
    });
    // EGI basis uses a proxy of ~7% of total basis; real EGI requires projection data.
    const amBase = wf.assetMgmtBasis === 'egi' ? totalBasis * 0.07 : equity;
    const egiBasisNote = wf.assetMgmtBasis === 'egi' ? ' ~est.' : '';
    out.push({
      id: stableId('wf:assetMgmtFee'), section: 'sponsor',
      name: `Asset Mgmt Fee (${(wf.assetMgmtFeePct * 100).toFixed(2)}%/${wf.assetMgmtBasis ?? 'equity'}${egiBasisNote} × ${holdYears}yr)`,
      amount: Math.round(amBase * wf.assetMgmtFeePct * holdYears),
      timing: 'month_7_12',
      sourceKey: 'wf:assetMgmtFee', synced: true,
    });
    // Construction mgmt fee is equity-based (consistent with Waterfall tab display)
    out.push({
      id: stableId('wf:constructionMgmt'), section: 'sponsor',
      name: `Construction Mgmt Fee (${(wf.constructionMgmtPct * 100).toFixed(2)}%)`,
      amount: Math.round(equity * wf.constructionMgmtPct),
      timing: 'month_1_6',
      sourceKey: 'wf:constructionMgmt', synced: true,
    });
    out.push({
      id: stableId('wf:dispositionFee'), section: 'disposition',
      name: `Disposition Fee (${(wf.dispositionFeePct * 100).toFixed(2)}%)`,
      amount: Math.round(totalBasis * wf.dispositionFeePct),
      timing: 'disposition',
      sourceKey: 'wf:dispositionFee', synced: true,
    });
    if (wf.refinancingFeePct > 0) {
      // Use actual refi loan amount when available; fall back to total basis
      const refiAmt = f9.closing?.refi?.refiLoanAmount ?? totalBasis;
      out.push({
        id: stableId('wf:refinancingFee'), section: 'debt',
        name: `Refinancing Fee (${(wf.refinancingFeePct * 100).toFixed(2)}%)`,
        amount: Math.round(refiAmt * wf.refinancingFeePct),
        timing: 'month_19_24',
        sourceKey: 'wf:refinancingFee', synced: true,
      });
    }
  }
  return out;
}

function mergeSynced(existing: CostLineItem[], synced: CostLineItem[]): CostLineItem[] {
  const syncedById = new Map(synced.map(s => [s.id, s]));
  const sectionOrder = SECTIONS.map(s => s.id);
  const result: CostLineItem[] = [];
  const resultIds = new Set<string>();

  for (const item of existing) {
    if (item.sourceKey) {
      // Still linked — replace with fresh synced value if available
      const updated = syncedById.get(item.id);
      if (updated) {
        result.push(updated);
        resultIds.add(updated.id);
        syncedById.delete(item.id);
      }
      // If synced no longer produces this item (e.g. loan removed), drop it silently
    } else {
      // User-owned item (manually edited, or never had a sourceKey)
      result.push(item);
      resultIds.add(item.id);
      // Remove from syncedById so we don't re-append a duplicate with the same stableId
      syncedById.delete(item.id);
    }
  }
  // Append any newly produced synced items that didn't exist before
  for (const [id, item] of syncedById) {
    if (!resultIds.has(id)) {
      result.push(item);
    }
  }

  result.sort((a, b) => {
    const ai = sectionOrder.indexOf(a.section);
    const bi = sectionOrder.indexOf(b.section);
    if (ai !== bi) return ai - bi;
    if (a.locked && !b.locked) return -1;
    if (!a.locked && b.locked) return 1;
    if (a.sourceKey && !b.sourceKey) return -1;
    if (!a.sourceKey && b.sourceKey) return 1;
    return 0;
  });
  return result;
}

function fmt$(n: number) { return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`; }
function parseDollar(s: string) { const n = parseFloat(s.replace(/[$,KkMm]/g, '')); if (isNaN(n)) return 0; if (/[Mm]$/.test(s.trim())) return n * 1e6; if (/[Kk]$/.test(s.trim())) return n * 1e3; return n; }

function InlineEdit({ value, onSave, prefix = '' }: { value: number; onSave: (v: number) => void; prefix?: string }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  if (editing) {
    return (
      <input
        autoFocus
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { onSave(parseDollar(raw)); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(parseDollar(raw)); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        style={{ fontFamily: MONO, fontSize: 11, background: 'rgba(99,179,237,0.12)', border: '1px solid #63B3ED', borderRadius: 3, padding: '1px 6px', color: C.blue, width: 90, textAlign: 'right' }}
      />
    );
  }
  return (
    <span
      onClick={() => { setRaw(String(value)); setEditing(true); }}
      title="Click to edit"
      style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: value > 0 ? C.text : C.dim, cursor: 'text', padding: '2px 4px', borderRadius: 3, userSelect: 'none' }}
    >
      {prefix}{fmt$(value)}
    </span>
  );
}

function TimelineChart({ items }: { items: CostLineItem[] }) {
  const buckets = TIMING_OPTIONS.map(t => ({
    ...t,
    total: items.filter(i => i.timing === t.id).reduce((s, i) => s + i.amount, 0),
    bySection: SECTIONS.map(sec => ({
      ...sec,
      amt: items.filter(i => i.timing === t.id && i.section === sec.id).reduce((s, i) => s + i.amount, 0),
    })).filter(s => s.amt > 0),
  })).filter(b => b.total > 0);

  if (!buckets.length) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: C.dim, fontSize: 10, fontFamily: MONO }}>
      No costs entered yet
    </div>
  );

  const maxTotal = Math.max(...buckets.map(b => b.total));
  const totalUses = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 160, padding: '0 8px' }}>
        {buckets.map(bucket => {
          const h = Math.max(6, (bucket.total / maxTotal) * 140);
          let stack = 0;
          return (
            <div key={bucket.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 8, fontFamily: MONO, color: C.muted, marginBottom: 3 }}>{fmt$(bucket.total)}</div>
              <div style={{ width: '100%', height: h, position: 'relative', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                {bucket.bySection.map(sec => {
                  const secH = (sec.amt / bucket.total) * h;
                  const bottom = stack;
                  stack += secH;
                  return (
                    <div key={sec.id} title={`${sec.label}: ${fmt$(sec.amt)}`} style={{
                      position: 'absolute', bottom, left: 0, right: 0, height: secH,
                      background: sec.color + '55', borderTop: `1px solid ${sec.color}66`,
                    }} />
                  );
                })}
              </div>
              <div style={{ fontSize: 7, fontFamily: MONO, color: C.dim, marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>{bucket.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SECTIONS.filter(s => items.some(i => i.section === s.id && i.amount > 0)).map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, background: s.color + '55', border: `1px solid ${s.color}`, borderRadius: 2 }} />
            <span style={{ fontSize: 8, fontFamily: MONO, color: C.muted }}>{s.short}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 8, fontFamily: MONO, color: C.muted }}>Total uses: {fmt$(totalUses)}</span>
      </div>
    </div>
  );
}

interface CostSheetTabProps {
  dealId: string;
  deal?: Record<string, any>;
  assumptions?: Record<string, any> | null;
  f9Financials?: F9DealFinancials | null;
}

export function CostSheetTab({ dealId, deal, assumptions, f9Financials }: CostSheetTabProps) {
  const storageKey = `jedire_cost_sheet_${dealId}`;

  const totalBasis = useMemo(() => {
    if (assumptions?.purchasePrice) return Number(assumptions.purchasePrice);
    if (deal?.ask_price) return Number(deal.ask_price);
    return 46420000;
  }, [deal, assumptions]);

  const seniorLTV = assumptions?.seniorLTV ?? assumptions?.ltv ?? 65;
  const loanAmt = totalBasis * (seniorLTV / 100);

  // Set synchronously inside useState initializer (before any effects) to reliably
  // distinguish "loaded from prior user session" vs "freshly initialized from defaults".
  const loadedFromStorage = React.useRef(false);

  const [items, setItems] = useState<CostLineItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        loadedFromStorage.current = true;
        // Migrate old saves that predate sourceKey/stableId so sync can update in-place
        return migrateLegacyItems(JSON.parse(saved));
      }
    } catch {}
    return buildDefaults(totalBasis, loanAmt);
  });

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newRowSection, setNewRowSection] = useState<string | null>(null);
  const [newRowName, setNewRowName] = useState('');
  const [newRowAmt, setNewRowAmt] = useState('');
  const [newRowTiming, setNewRowTiming] = useState('closing');
  const [equityAmount, setEquityAmount] = useState(() => Math.round(totalBasis * 0.35));
  const [debtAmount, setDebtAmount] = useState(() => Math.round(loanAmt));
  const [syncFlash, setSyncFlash] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const syncFromEngine = useCallback(() => {
    if (!f9Financials) return;
    const synced = computeSyncItems(f9Financials, totalBasis);
    setItems(prev => {
      const merged = mergeSynced(prev, synced);
      return merged;
    });
    setSyncCount(synced.length);
    setSyncFlash(true);
    setTimeout(() => setSyncFlash(false), 2500);

    const totalDebt = f9Financials.debt?.aggregate?.totalLoanAmount ?? 0;
    if (totalDebt > 0) setDebtAmount(Math.round(totalDebt));
    const eq = Math.max(totalBasis - totalDebt, 0);
    if (eq > 0) setEquityAmount(Math.round(eq));
  }, [f9Financials, totalBasis]);

  useEffect(() => {
    if (!f9Financials) return;
    // Auto-sync only when starting from defaults (no prior user session in localStorage).
    // loadedFromStorage.current is set synchronously during useState, before any effects,
    // so this correctly reflects whether the user has prior saved data.
    if (!loadedFromStorage.current) {
      syncFromEngine();
    }
  }, [f9Financials]);

  const updateAmount = useCallback((id: string, v: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, amount: v, synced: false, sourceKey: undefined } : i));
  }, []);

  const updateTiming = useCallback((id: string, t: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, timing: t, synced: false, sourceKey: undefined } : i));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addItem = useCallback((section: string) => {
    if (!newRowName.trim()) return;
    const item: CostLineItem = {
      id: uid(), section, name: newRowName.trim(),
      amount: parseDollar(newRowAmt) || 0, timing: newRowTiming,
    };
    setItems(prev => [...prev, item]);
    setNewRowSection(null); setNewRowName(''); setNewRowAmt(''); setNewRowTiming('closing');
  }, [newRowName, newRowAmt, newRowTiming]);

  const resetToDefaults = useCallback(() => {
    if (confirm('Reset all line items to defaults? This cannot be undone.')) {
      const defaults = buildDefaults(totalBasis, loanAmt);
      setItems(defaults);
    }
  }, [totalBasis, loanAmt]);

  const syncedCount = useMemo(() => items.filter(i => i.synced).length, [items]);

  const sectionTotals = useMemo(() =>
    Object.fromEntries(SECTIONS.map(s => [s.id, items.filter(i => i.section === s.id).reduce((sum, i) => sum + i.amount, 0)])),
    [items]
  );

  const grandTotal = Object.values(sectionTotals).reduce((a, b) => a + b, 0);
  const totalSources = equityAmount + debtAmount;
  const variance = totalSources - grandTotal;
  const isBalanced = Math.abs(variance) < 1000;

  const selectStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 8,
    background: '#111111', border: `1px solid ${C.border}`, borderRadius: 3,
    padding: '2px 4px', color: C.muted, cursor: 'pointer', colorScheme: 'dark',
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>

      {/* ── Left: Line Item Grid ── */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: C.dim, fontFamily: MONO }}>₵ DEAL COST SHEET</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              Click any amount to edit · {items.length} line items · Basis: {fmt$(totalBasis)}
              {syncedCount > 0 && (
                <span style={{ marginLeft: 8, color: C.cyan, fontSize: 8 }}>⛓ {syncedCount} LIVE FROM ENGINE</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {f9Financials && (
              <button
                onClick={syncFromEngine}
                style={{
                  fontSize: 8, fontFamily: MONO, cursor: 'pointer', borderRadius: 4, padding: '3px 10px',
                  background: syncFlash ? `${C.cyan}22` : 'none',
                  border: `1px solid ${syncFlash ? C.cyan : C.border}`,
                  color: syncFlash ? C.cyan : C.muted,
                  transition: 'all 0.3s',
                }}
                title="Pull live fee values from DEBT and CAP & WFALL tabs"
              >
                {syncFlash ? `⛓ SYNCED ${syncCount} ITEMS` : '⛓ SYNC FROM ENGINE'}
              </button>
            )}
            <button onClick={resetToDefaults} style={{ fontSize: 8, fontFamily: MONO, color: C.dim, background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
              ↺ RESET
            </button>
          </div>
        </div>

        {/* Column header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 24px', gap: 4, padding: '4px 8px', borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
          {['COST ITEM', 'TIMING', 'AMOUNT', ''].map(h => (
            <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: C.dim, fontFamily: MONO }}>{h}</span>
          ))}
        </div>

        {SECTIONS.map(sec => {
          const secItems = items.filter(i => i.section === sec.id);
          const secTotal = sectionTotals[sec.id] ?? 0;
          const isCollapsed = collapsed[sec.id];
          return (
            <div key={sec.id} style={{ marginBottom: 8 }}>
              {/* Section header */}
              <div
                onClick={() => setCollapsed(c => ({ ...c, [sec.id]: !c[sec.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: sec.color + '0F', border: `1px solid ${sec.color}22`, borderRadius: 5, cursor: 'pointer', marginBottom: isCollapsed ? 0 : 2 }}
              >
                <span style={{ fontSize: 10, color: sec.color }}>{sec.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: sec.color, flex: 1, fontFamily: MONO, letterSpacing: 0.5 }}>{sec.label.toUpperCase()}</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: secTotal > 0 ? sec.color : C.dim }}>{fmt$(secTotal)}</span>
                <span style={{ fontSize: 9, color: C.dim, marginLeft: 4 }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>

              {!isCollapsed && (
                <>
                  {secItems.map(item => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 24px', gap: 4, padding: '4px 8px', alignItems: 'center', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                      {/* Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                        {item.synced && (
                          <span title="Live value from engine — click amount to override" style={{ fontSize: 6, color: C.cyan, fontFamily: MONO, letterSpacing: 0.5, flexShrink: 0, border: `1px solid ${C.cyan}55`, borderRadius: 2, padding: '1px 3px' }}>⛓</span>
                        )}
                        {editingName === item.id ? (
                          <input
                            autoFocus
                            value={editingNameVal}
                            onChange={e => setEditingNameVal(e.target.value)}
                            onBlur={() => { setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: editingNameVal.trim() || i.name, synced: false, sourceKey: undefined } : i)); setEditingName(null); }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(null); }}
                            style={{ fontFamily: MONO, fontSize: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 4px', color: C.text, width: '100%' }}
                          />
                        ) : (
                          <span
                            onDoubleClick={() => { setEditingName(item.id); setEditingNameVal(item.name); }}
                            title="Double-click to rename"
                            style={{ fontSize: 10, color: item.amount === 0 ? C.dim : C.text, cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {item.name}
                            {item.note && <span style={{ fontSize: 8, color: C.dim, marginLeft: 4 }}>· {item.note}</span>}
                          </span>
                        )}
                      </div>
                      {/* Timing */}
                      <select
                        value={item.timing}
                        onChange={e => updateTiming(item.id, e.target.value)}
                        style={selectStyle}
                      >
                        {TIMING_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      {/* Amount */}
                      <div style={{ textAlign: 'right' }}>
                        <InlineEdit value={item.amount} onSave={v => updateAmount(item.id, v)} />
                      </div>
                      {/* Delete */}
                      {!item.locked ? (
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{ fontSize: 10, color: C.dim, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
                          title="Remove line"
                        >×</button>
                      ) : <div />}
                    </div>
                  ))}

                  {/* Add row */}
                  {newRowSection === sec.id ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 24px', gap: 4, padding: '4px 8px', alignItems: 'center', background: 'rgba(99,179,237,0.04)', borderRadius: 4, marginTop: 2 }}>
                      <input
                        autoFocus
                        placeholder="Cost item name…"
                        value={newRowName}
                        onChange={e => setNewRowName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem(sec.id)}
                        style={{ fontFamily: MONO, fontSize: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 6px', color: C.text }}
                      />
                      <select value={newRowTiming} onChange={e => setNewRowTiming(e.target.value)} style={selectStyle}>
                        {TIMING_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <input
                        placeholder="$0"
                        value={newRowAmt}
                        onChange={e => setNewRowAmt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem(sec.id)}
                        style={{ fontFamily: MONO, fontSize: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 6px', color: C.text, textAlign: 'right' }}
                      />
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button onClick={() => addItem(sec.id)} style={{ fontSize: 10, color: C.green, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✓</button>
                        <button onClick={() => setNewRowSection(null)} style={{ fontSize: 10, color: C.dim, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewRowSection(sec.id)}
                      style={{ fontSize: 8, color: C.dim, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', fontFamily: MONO, letterSpacing: 0.5 }}
                    >
                      + ADD LINE
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Grand Total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 24px', gap: 4, padding: '10px 8px', borderTop: `2px solid rgba(255,255,255,0.1)`, marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: MONO }}>TOTAL USES</span>
          <span />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: MONO, textAlign: 'right' }}>{fmt$(grandTotal)}</span>
          <span />
        </div>
      </div>

      {/* ── Right: Summary + S&U + Timeline ── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>

        {/* Section breakdown */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: C.dim, fontFamily: MONO, marginBottom: 10 }}>COST BREAKDOWN BY SECTION</div>
          {SECTIONS.map(sec => {
            const v = sectionTotals[sec.id] ?? 0;
            const pct = grandTotal > 0 ? (v / grandTotal) * 100 : 0;
            return (
              <div key={sec.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: sec.color, fontFamily: MONO }}>{sec.icon} {sec.short}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 8, color: C.dim, fontFamily: MONO }}>{pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: v > 0 ? C.text : C.dim }}>{fmt$(v)}</span>
                  </div>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: sec.color + '60', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.text, fontFamily: MONO }}>GRAND TOTAL</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text, fontFamily: MONO }}>{fmt$(grandTotal)}</span>
          </div>
        </div>

        {/* Sources & Uses Reconciliation */}
        <div style={{ background: C.panel, border: `1px solid ${isBalanced ? C.green + '33' : C.amber + '33'}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: isBalanced ? C.green : C.amber, fontFamily: MONO, marginBottom: 10 }}>
            ⇄ SOURCES & USES — {isBalanced ? '✓ BALANCED' : `⚠ ${fmt$(Math.abs(variance))} GAP`}
          </div>

          {/* SOURCES */}
          <div style={{ fontSize: 8, color: C.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 0.8 }}>SOURCES</div>
          <div style={{ marginBottom: 10 }}>
            {[
              { label: 'Senior Debt', key: 'debt',   color: C.amber,  value: debtAmount,   setter: setDebtAmount   },
              { label: 'Equity',      key: 'equity',  color: C.purple, value: equityAmount, setter: setEquityAmount },
            ].map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, background: s.color + '55', border: `1px solid ${s.color}`, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: C.muted, flex: 1 }}>{s.label}</span>
                <InlineEdit value={s.value} onSave={s.setter} prefix="" />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 0', borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: C.text, fontFamily: MONO }}>Total Sources</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: MONO }}>{fmt$(totalSources)}</span>
            </div>
          </div>

          {/* USES summary */}
          <div style={{ fontSize: 8, color: C.dim, fontFamily: MONO, marginBottom: 6, letterSpacing: 0.8 }}>USES (from cost sheet)</div>
          {SECTIONS.filter(s => (sectionTotals[s.id] ?? 0) > 0).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: C.muted }}>{s.icon} {s.label}</span>
              <span style={{ fontSize: 9, fontFamily: MONO, color: C.text }}>{fmt$(sectionTotals[s.id] ?? 0)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 0', borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.text, fontFamily: MONO }}>Total Uses</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: MONO }}>{fmt$(grandTotal)}</span>
          </div>

          {/* Variance */}
          <div style={{ marginTop: 8, padding: '8px 10px', background: isBalanced ? 'rgba(104,211,145,0.07)' : 'rgba(246,173,85,0.07)', borderRadius: 5, border: `1px solid ${isBalanced ? C.green + '33' : C.amber + '33'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: isBalanced ? C.green : C.amber, fontFamily: MONO }}>Variance</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: isBalanced ? C.green : C.amber, fontFamily: MONO }}>
                {variance > 0 ? '+' : ''}{fmt$(variance)}
              </span>
            </div>
            <div style={{ fontSize: 8, color: C.dim, marginTop: 3 }}>
              {isBalanced
                ? 'Sources = Uses · deal is fully funded'
                : variance > 0
                  ? 'Sources exceed uses · consider reducing equity'
                  : 'Uses exceed sources · additional funding required'}
            </div>
          </div>
        </div>

        {/* Deployment Timeline */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: C.dim, fontFamily: MONO, marginBottom: 12 }}>
            CAPITAL DEPLOYMENT TIMELINE
          </div>
          <TimelineChart items={items} />
        </div>

        {/* % of Basis table */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: C.dim, fontFamily: MONO, marginBottom: 8 }}>% OF TOTAL BASIS</div>
          {SECTIONS.filter(s => (sectionTotals[s.id] ?? 0) > 0).map(s => {
            const v = sectionTotals[s.id] ?? 0;
            const pct = totalBasis > 0 ? (v / totalBasis) * 100 : 0;
            return (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: C.muted }}>{s.label}</span>
                <span style={{ fontSize: 9, fontFamily: MONO, color: pct > 10 ? C.amber : C.muted }}>{pct.toFixed(2)}%</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.text }}>Total / Basis</span>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.text }}>
              {totalBasis > 0 ? ((grandTotal / totalBasis) * 100).toFixed(1) : '—'}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
