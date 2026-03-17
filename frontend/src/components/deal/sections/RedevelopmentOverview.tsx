import React, { useState } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { T, mono, sans } from '../bloomberg-tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, pre = '$'): string => {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `${pre}${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${pre}${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${pre}${Math.round(n / 1e3)}K`;
  return `${pre}${n.toLocaleString()}`;
};
const pct = (n: number | null | undefined): string => n != null ? `${(n * 100).toFixed(1)}%` : '—';
const num = (n: number | null | undefined): string => n != null ? n.toLocaleString() : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ n, title, subtitle, color }: { n: string; title: string; subtitle?: string; color?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: color || T.amberL, letterSpacing: 2, ...mono }}>§{n}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text, ...sans }}>{title}</span>
      </div>
      {subtitle && <p style={{ fontSize: 12, color: T.td, marginLeft: 28, ...sans }}>{subtitle}</p>}
    </div>
  );
}

function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.bgCard, borderRadius: 10, border: `1px solid ${T.border}`, padding: 20, ...s }}>
      {children}
    </div>
  );
}

function Metric({ label, value, sub, color, small }: { label: string; value: string; sub?: string; color?: string; small?: boolean }) {
  return (
    <div style={{ padding: small ? '8px 0' : '10px 0' }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.td, marginBottom: 3, ...mono }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color || T.text, ...sans }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.td, marginTop: 2, ...sans }}>{sub}</div>}
    </div>
  );
}

function DataRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.text, fontWeight: bold ? 700 : 400, ...sans }}>{label}</span>
      <span style={{ fontSize: 12, color: color || (bold ? T.amberL : T.text), fontWeight: bold ? 700 : 500, ...mono }}>{value}</span>
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, padding: '3px 10px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40`, ...mono, display: 'inline-flex', alignItems: 'center' }}>
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = { complete: T.green, 'in-progress': T.amber, 'not-started': T.td };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c[status] || T.td, display: 'inline-block', flexShrink: 0 }} />;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface RedevelopmentOverviewProps {
  deal: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
  onTabChange?: (tabId: string) => void;
  onStrategySelected?: (strategyId: string) => void;
}

// ─── Default DD items ─────────────────────────────────────────────────────────
// 3×3 module access grid — canonical redevelopment set M02…M20
const DEFAULT_DD = [
  { module: 'M02', label: 'Property & Zoning',    status: 'not-started', link: 'zoning' },
  { module: 'M05', label: 'Market Intelligence',  status: 'not-started', link: 'market-intelligence' },
  { module: 'M07', label: 'Traffic Intelligence', status: 'not-started', link: 'traffic-module' },
  { module: 'M09', label: 'Pro Forma',            status: 'not-started', link: 'proforma' },
  { module: 'M11', label: 'Capital Structure',    status: 'not-started', link: 'debt' },
  { module: 'M14', label: 'Risk Intelligence',    status: 'not-started', link: 'risk-intelligence' },
  { module: 'M15', label: 'Competition',          status: 'not-started', link: 'competition' },
  { module: 'M16', label: 'Environmental & ESG',  status: 'not-started', link: 'due-diligence' },
  { module: 'M20', label: 'Project Timeline',     status: 'not-started', link: 'timeline' },
];

const BUDGET_PALETTE = [T.amberL, T.blueL, T.violL, T.redL, T.greenL, T.td, T.cyan];

// ─── Component ────────────────────────────────────────────────────────────────
export const RedevelopmentOverview: React.FC<RedevelopmentOverviewProps> = ({ deal, onTabChange }) => {
  const { capitalStructure, debtTerms } = useDealModule();
  const [_ep, setEp] = useState<number | null>(null);

  // ── Field extraction ──────────────────────────────────────────────────────
  const name              = deal?.name ?? deal?.dealName ?? '—';
  const address           = deal?.address ?? deal?.propertyAddress ?? '—';
  const city              = deal?.city ?? '';
  const state             = deal?.state ?? '';
  const county            = deal?.county ?? '';
  const propClass         = deal?.propertyClass ?? deal?.assetClass ?? '';
  const parcelId          = deal?.parcelId ?? deal?.apn ?? '—';
  const lotAcres          = deal?.lotSizeAcres ?? deal?.lotAcres ?? null;
  const lotSf             = deal?.lotSizeSf ?? deal?.lotAreaSf ?? null;
  const zoning            = deal?.zoning ?? deal?.zoningCode ?? '—';
  const zoningDesc        = deal?.zoningDesc ?? deal?.zoningDescription ?? '';
  const yearBuilt         = deal?.yearBuilt ?? null;
  const stories           = deal?.stories ?? deal?.numStories ?? null;
  const buildings         = deal?.buildings ?? deal?.numBuildings ?? null;
  const assessedValue     = deal?.assessedValue ?? null;
  const lastSaleDate      = deal?.lastSaleDate ?? null;
  const lastSalePrice     = deal?.lastSalePrice ?? null;
  const parkingSpaces     = deal?.parking?.spaces ?? deal?.parkingSpaces ?? null;
  const parkingRatio      = deal?.parking?.ratio ?? deal?.parkingRatio ?? null;

  // §1 — Acquisition / As-Is
  const askPrice          = deal?.askPrice ?? deal?.purchasePrice ?? deal?.listPrice ?? null;
  const existingUnits     = deal?.existingUnits ?? deal?.units ?? deal?.targetUnits ?? null;
  const existingNoi       = deal?.existingNoi ?? deal?.currentNoi ?? null;
  const existingOcc       = deal?.existingOccupancy ?? deal?.occupancy ?? null;
  const existingCapRate   = deal?.existingCapRate ?? deal?.capRate ?? null;
  const existingRent      = deal?.existingRentPerUnit ?? deal?.rentPerUnit ?? null;
  const existingExpRatio  = deal?.existingExpenseRatio ?? deal?.expenseRatio ?? null;
  const pricePerUnit      = askPrice && existingUnits ? Math.round(askPrice / existingUnits) : (deal?.pricePerUnit ?? null);
  const pricePerSf        = deal?.pricePerSf ?? null;
  const roofAge           = deal?.roofAge ?? null;
  const hvacAge           = deal?.hvacAge ?? null;
  const plumbing          = deal?.plumbingCondition ?? '—';
  const electrical        = deal?.electricalCondition ?? '—';
  const deferred          = deal?.deferred ?? deal?.deferredMaintenance ?? null;

  // §2 — Stabilized
  const stabNoi           = deal?.stabilizedNoi ?? deal?.proformaNoi ?? null;
  const stabOcc           = deal?.stabilizedOccupancy ?? null;
  const stabRent          = deal?.stabilizedRentPerUnit ?? deal?.proformaRentPerUnit ?? null;

  // §3 — Zoning capacity
  const maxDensity        = deal?.maxDensity ?? null;
  const maxHeight         = deal?.maxHeight ?? null;
  const maxLotCoverage    = deal?.maxLotCoverage ?? null;
  const addlByRight       = deal?.additionalByRight ?? 0;
  const addlVariance      = deal?.additionalWithVariance ?? deal?.expansionUnits ?? null;
  const addlRezone        = deal?.additionalIfRezoned ?? null;
  const needsVariance     = deal?.expansionRequiresVariance ?? false;

  // §4 — Renovation + Expansion
  const renovBudget       = deal?.renovationBudget ?? null;
  const renovPerUnit      = deal?.renovPerUnit ?? (renovBudget && existingUnits ? Math.round(renovBudget / existingUnits) : null);
  const renovUnits        = deal?.unitRenovations ?? existingUnits ?? null;
  const renovScope: any[] = deal?.renovScope ?? [];
  const expUnits          = deal?.expansionUnits ?? null;
  const expSqft           = deal?.expansionSqft ?? null;
  const expCost           = deal?.expansionCost ?? null;
  const expCostPerUnit    = deal?.expansionCostPerUnit ?? (expCost && expUnits ? Math.round(expCost / expUnits) : null);
  const expType           = deal?.expansionType ?? '—';
  const expParkingAdd     = deal?.expansionParkingAdd ?? null;
  const existSqft         = deal?.existingSqft ?? deal?.sqft ?? deal?.squareFeet ?? null;

  // §5 — Unit mix
  const existMix: any[]   = deal?.existingMix ?? [];
  const expMix: any[]     = deal?.expansionMix ?? [];

  // §6 — Budget / timeline
  const softCosts         = deal?.softCosts ?? deal?.soft_costs ?? deal?.closingCosts ?? null;
  const totalInvestment   = deal?.totalInvestment ?? (
    askPrice != null
      ? askPrice + (renovBudget ?? 0) + (expCost ?? 0) + (deferred ?? 0) + (softCosts ?? 0)
      : null
  );
  const rawBudget: any[]  = deal?.budgetBreakdown ?? [];
  const budgetRows        = rawBudget.length > 0 ? rawBudget : [
    askPrice    != null ? { category: 'Acquisition',    amount: askPrice,    color: T.amberL } : null,
    renovBudget != null ? { category: 'Renovation',     amount: renovBudget, color: T.blueL  } : null,
    expCost     != null ? { category: 'Expansion',      amount: expCost,     color: T.violL  } : null,
    deferred    != null ? { category: 'Deferred Maint', amount: deferred,    color: T.redL   } : null,
    softCosts   != null ? { category: 'Soft & Closing', amount: softCosts,   color: T.td     } : null,
  ].filter((x): x is { category: string; amount: number; color: string } => x !== null);
  const renovMonths       = deal?.renovationMonths ?? null;
  const totalMonths       = deal?.totalTimelineMonths ?? null;
  const phases: any[]     = deal?.phases ?? [];

  // §7 — Capital (prefer context)
  const seniorDebt        = capitalStructure?.loanBalance?.[0] ?? deal?.seniorDebt ?? null;
  const ltv               = capitalStructure?.ltv ?? deal?.ltv ?? null;
  const rate              = debtTerms?.interestRate ?? deal?.rate ?? deal?.interestRate ?? null;
  const loanTerm          = debtTerms?.term != null ? `${debtTerms.term}mo` : (deal?.term ?? '—');
  const equityReq         = capitalStructure?.totalEquity ?? deal?.equityRequired ?? null;
  const equitySplit       = deal?.equitySplit ?? '—';
  const prefReturn        = deal?.prefReturn ?? null;
  const promote           = deal?.promote ?? '—';
  const lender            = deal?.lender ?? '—';
  const drawSched: any[]  = deal?.drawSchedule ?? [];

  // §8 — Returns
  const exitValue         = deal?.exitValue ?? deal?.exitPrice ?? null;
  const irr               = deal?.irr ?? deal?.projectedIrr ?? null;
  const em                = deal?.equityMultiple ?? deal?.projectedEm ?? null;
  const coc               = deal?.cashOnCash ?? deal?.coc ?? null;

  // Computed
  const totalUnits        = (existingUnits ?? 0) + (expUnits ?? 0);
  const noiDelta          = stabNoi != null && existingNoi != null ? stabNoi - existingNoi : null;
  const rentDelta         = stabRent != null && existingRent != null ? stabRent - existingRent : null;
  const renovROI          = noiDelta != null && renovBudget != null ? noiDelta / (renovBudget + (expCost ?? 0)) : null;

  // §9 always uses canonical M02–M20 set; merge status from deal.ddItems if present
  const ddItems = DEFAULT_DD.map(canonical => {
    const override = (deal?.ddItems ?? []).find((d: any) => d.module === canonical.module);
    return override ? { ...canonical, status: override.status ?? canonical.status } : canonical;
  });

  return (
    <div style={{ background: T.bg, padding: '20px 24px', color: T.text, ...sans }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ──────────────────────── HEADER ──────────────────────────────── */}
        <div style={{ background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {/* Name / price row */}
          <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: T.text, ...sans }}>{name}</span>
                <Badge label="REDEVELOPMENT" color={T.violL} bg={T.violBg} />
                {propClass && <Badge label={propClass} color={T.amberL} bg={T.amberBg} />}
              </div>
              <div style={{ fontSize: 12, color: T.tm, ...sans }}>
                📍 {address}{city ? ` · ${city}` : ''}{county ? `, ${county} County` : ''}{state ? `, ${state}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 16 }}>
              <div style={{ fontSize: 10, color: T.td, ...mono }}>ASK PRICE</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.amberL, ...sans }}>{fmt(askPrice)}</div>
              <div style={{ fontSize: 11, color: T.td, ...mono }}>
                {pricePerUnit != null ? `${fmt(pricePerUnit)}/unit` : ''}
                {pricePerSf != null ? ` · ${fmt(pricePerSf)}/SF` : ''}
              </div>
            </div>
          </div>

          {/* Property detail grid */}
          <div style={{ padding: '10px 24px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: `1px solid ${T.border}` }}>
            {[
              { l: 'PARCEL ID',  v: parcelId },
              { l: 'LOT SIZE',   v: lotAcres != null ? `${lotAcres} ac${lotSf ? ` (${num(lotSf)} SF)` : ''}` : '—' },
              { l: 'ZONING',     v: zoning },
              { l: 'YEAR BUILT', v: yearBuilt ?? '—' },
              { l: 'BUILDINGS',  v: buildings != null ? `${buildings} bldg${stories ? ` · ${stories}-story` : ''}` : '—' },
              { l: 'PARKING',    v: parkingSpaces != null ? `${parkingSpaces} sp${parkingRatio ? ` (${parkingRatio}/unit)` : ''}` : '—' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginTop: 2, ...sans }}>{String(f.v)}</div>
              </div>
            ))}
          </div>

          {/* Footer strip */}
          <div style={{ padding: '8px 24px', display: 'flex', gap: 24, background: T.bg, flexWrap: 'wrap' }}>
            {assessedValue  && <span style={{ fontSize: 10, color: T.td, ...mono }}>Assessed: <span style={{ color: T.text }}>{fmt(assessedValue)}</span></span>}
            {lastSalePrice  && <span style={{ fontSize: 10, color: T.td, ...mono }}>Last Sale: <span style={{ color: T.text }}>{fmt(lastSalePrice)}{lastSaleDate ? ` (${new Date(lastSaleDate).getFullYear()})` : ''}</span></span>}
            {zoningDesc     && <span style={{ fontSize: 10, color: T.td, ...mono }}>Zoning: <span style={{ color: T.text }}>{zoningDesc}</span></span>}
          </div>
        </div>

        {/* ──────────────────── §1 ACQUISITION + AS-IS ─────────────────── */}
        <div>
          <SectionHeader n="1" title="Acquisition + As-Is Metrics" subtitle="What you're buying today — current operations baseline" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Card><Metric label="GOING-IN CAP RATE" value={existingCapRate != null ? pct(existingCapRate) : '—'} sub="T-12 NOI basis" /></Card>
            <Card><Metric label="CURRENT NOI" value={fmt(existingNoi)} sub={existingExpRatio != null ? `Expense ratio: ${pct(existingExpRatio)}` : undefined} /></Card>
            <Card><Metric label="OCCUPANCY" value={existingOcc != null ? pct(existingOcc) : '—'} sub="Physical" color={existingOcc != null && existingOcc < 0.9 ? T.amberL : undefined} /></Card>
            <Card><Metric label="AVG RENT / UNIT" value={existingRent != null ? `${fmt(existingRent)}/mo` : '—'} sub="Blended all types" /></Card>
          </div>

          {/* Condition strip */}
          <div style={{ marginTop: 12 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { l: 'Roof Age',   v: roofAge != null ? `${roofAge} yrs`  : '—', warn: roofAge != null && roofAge > 10 },
                    { l: 'HVAC Age',   v: hvacAge != null ? `${hvacAge} yrs`  : '—', warn: hvacAge != null && hvacAge > 10 },
                    { l: 'Plumbing',   v: plumbing,   warn: plumbing   === 'Poor' },
                    { l: 'Electrical', v: electrical, warn: electrical === 'Poor' },
                  ].map((c, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{c.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.warn ? T.amberL : T.text, ...sans }}>{c.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>DEFERRED MAINTENANCE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.redL, ...sans }}>{fmt(deferred)}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ──────────────────── §2 NOI TRANSFORMATION ──────────────────── */}
        <div>
          <SectionHeader n="2" title="NOI Transformation" subtitle="The value story — as-is → stabilized" color={T.greenL} />
          <Card style={{ background: `linear-gradient(135deg, ${T.bgCard} 0%, ${T.greenBg}25 100%)`, border: `1px solid ${T.green}25` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center' }}>
              {/* As-Is */}
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 10, color: T.td, marginBottom: 6, ...mono }}>AS-IS NOI</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.text, ...sans }}>{fmt(existingNoi)}</div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  {existingUnits != null ? `${existingUnits} units` : ''}
                  {existingOcc  != null ? ` · ${pct(existingOcc)} occ` : ''}
                  {existingRent != null ? ` · ${fmt(existingRent)}/mo` : ''}
                </div>
              </div>
              <div style={{ fontSize: 24, color: T.td, padding: '0 8px' }}>→</div>
              {/* Stabilized */}
              <div style={{ textAlign: 'center', padding: 20, background: T.greenBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: T.greenL, marginBottom: 6, ...mono }}>STABILIZED NOI</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.greenL, ...sans }}>{fmt(stabNoi)}</div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  {totalUnits > 0 ? `${totalUnits} units` : ''}
                  {stabOcc != null ? ` · ${pct(stabOcc)} occ` : ''}
                  {stabRent != null ? ` · ${fmt(stabRent)}/mo` : ''}
                </div>
              </div>
              <div style={{ fontSize: 24, color: T.td, padding: '0 8px' }}>=</div>
              {/* Uplift */}
              <div style={{ textAlign: 'center', padding: 20, background: T.amberBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: T.amberL, marginBottom: 6, ...mono }}>NOI UPLIFT</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.amberL, ...sans }}>
                  {noiDelta != null ? `+${fmt(noiDelta)}` : '—'}
                </div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  {noiDelta != null && existingNoi != null ? `+${pct(noiDelta / existingNoi)} increase` : ''}
                  {rentDelta != null ? ` · +${fmt(rentDelta)}/unit rent lift` : ''}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ──────────────────── §3 SITE + ZONING CAPACITY ─────────────── */}
        <div>
          <SectionHeader n="3" title="Site + Zoning Capacity" subtitle="What the entitlements allow — expansion feasibility" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>DENSITY ANALYSIS</div>
              {existingUnits != null && addlRezone != null && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: T.tm, ...sans }}>Existing: {existingUnits} units</span>
                    <span style={{ fontSize: 10, color: T.tm, ...sans }}>Max (rezoned): {existingUnits + addlRezone}</span>
                  </div>
                  <div style={{ height: 20, background: T.bg, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${(existingUnits / (existingUnits + addlRezone)) * 100}%`, height: '100%', background: T.blue, borderRadius: '6px 0 0 6px' }} />
                    {addlVariance != null && (
                      <div style={{ position: 'absolute', left: `${(existingUnits / (existingUnits + addlRezone)) * 100}%`, width: `${(addlVariance / (existingUnits + addlRezone)) * 100}%`, height: '100%', background: `${T.violet}60`, top: 0 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: T.blueL, ...mono }}>● Existing ({existingUnits})</span>
                    {addlVariance != null && <span style={{ fontSize: 9, color: T.violL, ...mono }}>● Variance (+{addlVariance})</span>}
                    {addlVariance != null && <span style={{ fontSize: 9, color: T.td, ...mono }}>○ Rezone (+{addlRezone - addlVariance} more)</span>}
                  </div>
                </div>
              )}
              <DataRow label="Current Zoning" value={`${zoning}${zoningDesc ? ` — ${zoningDesc}` : ''}`} />
              {maxDensity != null   && <DataRow label="Max Density" value={`${maxDensity} DU/acre`} />}
              <DataRow label="By-Right Additional" value={addlByRight > 0 ? `+${addlByRight} units` : '0 — nonconforming'} />
              {addlVariance != null && <DataRow label="With Variance" value={`+${addlVariance} units`} />}
              {addlRezone   != null && <DataRow label="Full Rezone" value={`+${addlRezone} units`} />}
            </Card>

            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>ZONING ENVELOPE</div>
              <DataRow label="Max Height"       value={maxHeight      != null ? `${maxHeight} ft` : '—'} />
              <DataRow label="Max Lot Coverage" value={maxLotCoverage != null ? pct(maxLotCoverage) : '—'} />
              <DataRow label="Lot Size"         value={lotAcres != null ? `${lotAcres} ac${lotSf ? ` (${num(lotSf)} SF)` : ''}` : '—'} />

              {needsVariance && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: T.amberBg, border: `1px solid ${T.amber}40` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.amberL, marginBottom: 4, ...mono }}>⚠ VARIANCE REQUIRED</div>
                  <p style={{ fontSize: 11, color: T.amberL, lineHeight: 1.5, margin: 0, ...sans }}>
                    {existingUnits != null ? `Existing ${existingUnits} units are legally nonconforming under ${zoning} zoning. ` : ''}
                    {addlVariance != null ? `Expansion of +${addlVariance} units requires variance approval. Entitlement timeline: ~6–9 months.` : 'Variance approval required before expansion.'}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ──────────────── §4 RENOVATION + EXPANSION SCOPE ───────────── */}
        <div>
          <SectionHeader n="4" title="Renovation + Expansion Scope" subtitle="Dual-track: interior upgrades on existing + new construction" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Renovation */}
            <Card style={{ borderLeft: `3px solid ${T.blue}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: T.blueL, ...mono }}>RENOVATION</div>
                  {renovUnits != null && existingUnits != null && (
                    <div style={{ fontSize: 11, color: T.tm, marginTop: 2, ...sans }}>{renovUnits} of {existingUnits} units</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{fmt(renovBudget)}</div>
                  {renovPerUnit != null && <div style={{ fontSize: 11, color: T.td, ...mono }}>{fmt(renovPerUnit)}/unit</div>}
                </div>
              </div>

              {renovScope.length > 0 ? renovScope.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: Math.max(4, (s.percentage || 0.1) * 56), height: 5, borderRadius: 3, background: T.blue }} />
                    <span style={{ fontSize: 12, color: T.text, ...sans }}>{s.item ?? s.name ?? s.category ?? '—'}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.text, ...mono }}>{fmt(s.costPerUnit ?? s.cost)}/unit</span>
                </div>
              )) : (
                <div style={{ fontSize: 12, color: T.td, ...sans }}>Renovation scope not yet defined</div>
              )}

              {rentDelta != null && existingRent != null && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: T.blueBg, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: T.blueL, ...sans }}>Post-reno rent uplift</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.blueL, ...mono }}>+{fmt(rentDelta)}/mo (+{pct(rentDelta / existingRent)})</span>
                </div>
              )}
            </Card>

            {/* Expansion */}
            <Card style={{ borderLeft: `3px solid ${T.violet}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: T.violL, ...mono }}>EXPANSION</div>
                  <div style={{ fontSize: 11, color: T.tm, marginTop: 2, ...sans }}>
                    {expUnits != null ? `+${expUnits} new units` : ''}
                    {expType !== '—' ? ` · ${expType}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{fmt(expCost)}</div>
                  {expCostPerUnit != null && <div style={{ fontSize: 11, color: T.td, ...mono }}>{fmt(expCostPerUnit)}/unit</div>}
                </div>
              </div>

              {expUnits     != null && <DataRow label="New Units"         value={`+${expUnits}`} />}
              {expSqft      != null && <DataRow label="New SF"            value={`${num(expSqft)} SF`} />}
              {expType !== '—'      && <DataRow label="Building Type"     value={expType} />}
              {expParkingAdd!= null && <DataRow label="Added Parking"     value={`+${expParkingAdd} spaces`} />}
              {expCost != null && expSqft != null && <DataRow label="Cost / SF" value={fmt(Math.round(expCost / expSqft))} />}
              <DataRow label="Entitlement" value={needsVariance ? 'Variance needed' : 'By-right'} />

              <div style={{ marginTop: 12, padding: '10px 12px', background: T.violBg, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: T.violL, ...sans }}>Total post-expansion</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.violL, ...mono }}>
                    {totalUnits > 0 ? `${totalUnits} units` : '—'}
                    {existSqft != null && expSqft != null ? ` · ${num(existSqft + expSqft)} SF` : ''}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ──────────────────── §5 UNIT MIX PROGRAM ────────────────────── */}
        <div>
          <SectionHeader n="5" title="Unit Mix Program" subtitle="Existing mix + expansion additions → blended stabilized portfolio" />
          <Card>
            {existMix.length > 0 || expMix.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                {/* Headers */}
                {['Type', 'Count', 'Avg SF', 'Current Rent', 'Target Rent', 'Δ Rent', 'Δ %'].map((h, i) => (
                  <div key={i} style={{ padding: '8px 10px', fontSize: 9, color: T.td, borderBottom: `2px solid ${T.borderL}`, textAlign: i > 0 ? 'right' : 'left', ...mono }}>{h}</div>
                ))}

                {existMix.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '5px 10px', fontSize: 9, letterSpacing: 1.5, color: T.blueL, background: T.bg, ...mono }}>
                    EXISTING ({existingUnits ?? 0} UNITS)
                  </div>
                )}
                {existMix.map((u: any, i: number) => {
                  const d = (u.targetRent ?? 0) - (u.currentRent ?? 0);
                  const cells = [
                    { v: u.type ?? '—', c: T.text, r: false, f: sans },
                    { v: String(u.count ?? '—'), c: T.text, r: true, f: mono },
                    { v: String(u.avgSf ?? '—'), c: T.text, r: true, f: mono },
                    { v: fmt(u.currentRent), c: T.text, r: true, f: mono },
                    { v: fmt(u.targetRent), c: T.greenL, r: true, f: mono },
                    { v: d > 0 ? `+${fmt(d)}` : fmt(d), c: T.greenL, r: true, f: mono },
                    { v: u.currentRent ? `+${pct(d / u.currentRent)}` : '—', c: T.greenL, r: true, f: mono },
                  ];
                  return cells.map((c, j) => (
                    <div key={`e${i}${j}`} style={{ padding: '6px 10px', fontSize: 11, color: c.c, textAlign: c.r ? 'right' : 'left', borderBottom: `1px solid ${T.border}`, ...c.f }}>{c.v}</div>
                  ));
                })}

                {expMix.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', padding: '5px 10px', fontSize: 9, letterSpacing: 1.5, color: T.violL, background: T.bg, ...mono }}>
                    EXPANSION (+{expUnits ?? 0} UNITS)
                  </div>
                )}
                {expMix.map((u: any, i: number) => {
                  const cells = [
                    { v: u.type ?? '—', c: T.text, r: false, f: sans },
                    { v: u.count != null ? `+${u.count}` : '—', c: T.violL, r: true, f: mono },
                    { v: String(u.avgSf ?? '—'), c: T.text, r: true, f: mono },
                    { v: '—', c: T.td, r: true, f: mono },
                    { v: fmt(u.targetRent), c: T.violL, r: true, f: mono },
                    { v: '—', c: T.td, r: true, f: mono },
                    { v: '—', c: T.td, r: true, f: mono },
                  ];
                  return cells.map((c, j) => (
                    <div key={`x${i}${j}`} style={{ padding: '6px 10px', fontSize: 11, color: c.c, textAlign: c.r ? 'right' : 'left', borderBottom: `1px solid ${T.border}`, ...c.f }}>{c.v}</div>
                  ));
                })}

                <div style={{ gridColumn: '1 / -1', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${T.amber}`, background: T.bg }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text, ...sans }}>Stabilized Portfolio: {totalUnits} units</span>
                  {stabRent != null && <span style={{ fontSize: 12, fontWeight: 700, color: T.amberL, ...mono }}>Blended: {fmt(stabRent)}/mo</span>}
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: T.td, fontSize: 13, ...sans }}>
                Unit mix not yet defined — add unit types to populate this table
              </div>
            )}
          </Card>
        </div>

        {/* ──────────────── §6 BUDGET + TIMELINE ───────────────────────── */}
        <div>
          <SectionHeader n="6" title="Development Budget + Timeline" subtitle="Full cost breakdown and phased execution schedule" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Budget */}
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>TOTAL INVESTMENT</div>
              {budgetRows.length > 0 && totalInvestment != null ? (
                <>
                  <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                    {budgetRows.map((b: any, i: number) => (
                      <div key={i} style={{ width: `${(b.amount / totalInvestment) * 100}%`, background: b.color ?? BUDGET_PALETTE[i % BUDGET_PALETTE.length], opacity: 0.8 }} title={`${b.category}: ${fmt(b.amount)}`} />
                    ))}
                  </div>
                  {budgetRows.map((b: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: b.color ?? BUDGET_PALETTE[i % BUDGET_PALETTE.length] }} />
                        <span style={{ fontSize: 12, color: T.text, ...sans }}>{b.category}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, ...mono }}>{fmt(b.amount)}</span>
                        <span style={{ fontSize: 10, color: T.td, ...mono }}>{pct(b.amount / totalInvestment)}</span>
                      </div>
                    </div>
                  ))}
                  <DataRow label="Total Investment" value={fmt(totalInvestment)} bold />
                </>
              ) : (
                <div style={{ color: T.td, fontSize: 13, ...sans }}>Budget breakdown not yet defined</div>
              )}
            </Card>

            {/* Timeline */}
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>EXECUTION TIMELINE</div>
              {phases.length > 0 ? (
                <>
                  <div style={{ position: 'relative', height: phases.length * 32 + 10, marginBottom: 12 }}>
                    {phases.map((p: any, i: number) => {
                      const totalM = totalMonths ?? 24;
                      const col = BUDGET_PALETTE[i % BUDGET_PALETTE.length];
                      return (
                        <div key={i} onClick={() => setEp(i)} style={{ position: 'absolute', left: `${((p.start ?? 0) / totalM) * 100}%`, width: `${((p.months ?? 1) / totalM) * 100}%`, top: i * 30, height: 24, background: `${col}20`, border: `1px solid ${col}50`, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: 'pointer' }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: col, ...mono, whiteSpace: 'nowrap' }}>{p.label} ({p.months}mo)</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                    <span style={{ fontSize: 9, color: T.td, ...mono }}>Month 0</span>
                    {totalMonths != null && <span style={{ fontSize: 9, color: T.td, ...mono }}>Stabilized — Month {totalMonths}</span>}
                  </div>
                </>
              ) : (
                <div style={{ color: T.td, fontSize: 13, ...sans }}>
                  {renovMonths != null ? (
                    <>
                      <DataRow label="Renovation Period" value={`${renovMonths} months`} />
                      {totalMonths != null && <DataRow label="Total Timeline" value={`${totalMonths} months`} />}
                    </>
                  ) : 'Timeline phases not yet defined'}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ──────────────────── §7 CAPITAL STRUCTURE ───────────────────── */}
        <div>
          <SectionHeader n="7" title="Capital Structure" subtitle="Bridge-to-perm with renovation + expansion draw schedules" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>SOURCES</div>
              {seniorDebt != null && <DataRow label="Senior Debt (Bridge)" value={fmt(seniorDebt)} />}
              {ltv        != null && <DataRow label="LTV" value={pct(ltv)} />}
              {rate       != null && <DataRow label="Interest Rate" value={pct(rate)} />}
              {loanTerm   !== '—' && <DataRow label="Term" value={loanTerm} />}
              {lender     !== '—' && <DataRow label="Lender Type" value={lender} />}
              <div style={{ height: 12 }} />
              {equityReq  != null && <DataRow label="Sponsor Equity" value={fmt(equityReq)} />}
              {equitySplit!== '—' && <DataRow label="LP/GP Split" value={equitySplit} />}
              {prefReturn != null && <DataRow label="Pref Return" value={pct(prefReturn)} />}
              {promote    !== '—' && <DataRow label="Promote" value={promote} />}
              {seniorDebt != null && equityReq != null && <DataRow label="Total Capitalization" value={fmt(seniorDebt + equityReq)} bold />}
              {seniorDebt == null && equityReq == null && (
                <div style={{ color: T.td, fontSize: 13, ...sans }}>Capital structure not yet configured — run M11</div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>DRAW SCHEDULE</div>
              {drawSched.length > 0 ? drawSched.map((d: any, i: number) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text, ...sans }}>{d.milestone}</span>
                    <span style={{ fontSize: 11, color: T.text, ...mono }}>{fmt(d.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: T.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.pctDrawn ?? 0) * 100}%`, height: '100%', background: T.amber, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 9, color: T.td, marginTop: 2, textAlign: 'right', ...mono }}>{pct(d.pctDrawn)} drawn</div>
                </div>
              )) : (
                <div style={{ color: T.td, fontSize: 13, ...sans }}>Draw schedule not yet defined</div>
              )}
            </Card>
          </div>
        </div>

        {/* ──────────────── §8 VALUE BRIDGE + RETURNS ──────────────────── */}
        <div>
          <SectionHeader n="8" title="Value Bridge + Returns" subtitle="Total basis → stabilized value → value creation" />

          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
              {([
                askPrice    != null ? { label: 'Acquisition', value: askPrice,    color: T.amberL } : null,
                renovBudget != null ? { op: '+' } : null,
                renovBudget != null ? { label: 'Renovation',  value: renovBudget, color: T.blueL  } : null,
                deferred    != null ? { op: '+' } : null,
                deferred    != null ? { label: 'Deferred',    value: deferred,    color: T.redL   } : null,
                expCost     != null ? { op: '+' } : null,
                expCost     != null ? { label: 'Expansion',   value: expCost,     color: T.violL  } : null,
                softCosts   != null ? { op: '+' } : null,
                softCosts   != null ? { label: 'Soft + Closing', value: softCosts, color: T.td    } : null,
                totalInvestment != null ? { op: '=' } : null,
                totalInvestment != null ? { label: 'Total Basis',  value: totalInvestment, color: T.amberL, bold: true } : null,
                exitValue   != null ? { op: '→' } : null,
                exitValue   != null ? { label: 'Exit Value',   value: exitValue,   color: T.greenL, bold: true } : null,
              ] as ({ op: string } | { label: string; value: number | null; color: string; bold?: boolean } | null)[]).filter(Boolean).map((step, i: number) =>
                step.op ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontSize: 18, color: T.td }}>{step.op}</div>
                ) : (
                  <div key={i} style={{ textAlign: 'center', padding: '10px 8px', minWidth: 80 }}>
                    <div style={{ fontSize: 9, color: T.td, marginBottom: 3, ...mono }}>{step.label}</div>
                    <div style={{ fontSize: step.bold ? 18 : 14, fontWeight: 700, color: step.color, ...sans }}>{fmt(step.value)}</div>
                  </div>
                )
              )}
            </div>

            {exitValue != null && totalInvestment != null && (
              <div style={{ marginTop: 12, background: T.greenBg, border: `1px solid ${T.green}30`, borderRadius: 8, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.greenL, ...sans }}>Value Creation</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: T.greenL, ...mono }}>
                  {exitValue - totalInvestment >= 0 ? '+' : ''}{fmt(exitValue - totalInvestment)}
                </span>
              </div>
            )}

            {totalInvestment == null && exitValue == null && (
              <div style={{ padding: '16px 0', textAlign: 'center', color: T.td, fontSize: 13, ...sans }}>
                Complete Pro Forma (M09) and Capital Structure (M11) to see the value bridge
              </div>
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Card><Metric label="PROJ. IRR" value={irr != null ? `${typeof irr === 'number' ? irr.toFixed(1) : irr}%` : '—'} sub="Levered, 5-yr hold" color={irr != null ? T.greenL : undefined} /></Card>
            <Card><Metric label="EQUITY MULTIPLE" value={em != null ? `${typeof em === 'number' ? em.toFixed(2) : em}x` : '—'} sub={equityReq != null ? `On ${fmt(equityReq)} equity` : undefined} color={em != null ? T.greenL : undefined} /></Card>
            <Card><Metric label="RENOVATION ROI" value={renovROI != null ? pct(renovROI) : '—'} sub={noiDelta != null && renovBudget != null ? `${fmt(noiDelta)} NOI uplift` : undefined} color={renovROI != null ? T.greenL : undefined} /></Card>
            <Card><Metric label="CASH-ON-CASH (Y1)" value={coc != null ? `${typeof coc === 'number' ? coc.toFixed(1) : coc}%` : '—'} sub="Year 1 levered yield" /></Card>
          </div>
        </div>

        {/* ──────────────── §9 DUE DILIGENCE + MODULE ACCESS ───────────── */}
        <div>
          <SectionHeader n="9" title="Due Diligence + Module Access" subtitle="Jump into any module — status tracked across the deal lifecycle" />
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {ddItems.map((item: any, i: number) => (
                <div
                  key={i}
                  onClick={() => onTabChange?.(item.link)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, cursor: onTabChange ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onTabChange) (e.currentTarget as HTMLElement).style.borderColor = T.amber; }}
                  onMouseLeave={e => { if (onTabChange) (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
                >
                  <StatusDot status={item.status ?? 'not-started'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, ...sans }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: T.td, ...mono }}>{item.module}</div>
                  </div>
                  <span style={{ fontSize: 10, color: T.td, textTransform: 'capitalize', ...sans }}>
                    {(item.status ?? 'not-started').replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default RedevelopmentOverview;
