// ============================================================================
// DealTermsTab — Console > DEAL TERMS sub-tab (#XXX, structure-only scaffold)
// ============================================================================
//
// Repurposed from the former Projections > INTERACTIVE slot. Consolidates the
// four operator-decision input groups that today are scattered across F9:
// Acquisition / Entry, Hold & Targets, Exit / Disposition, and (optionally)
// Capital Structure.
//
// SCOPE — STRUCTURE ONLY:
//   - No backend wiring, no apiClient calls, no dealStore reads/writes.
//   - All cells render placeholder values ('--', '$0', 'Not Provided').
//   - Local useState only — values reset on unmount, that's correct.
//   - LayeredValue columns render as static badges, not live data.
//   - Claude Code will wire data in a follow-up task.
//
// COLUMN STRUCTURE (every row):
//   Line Item | Broker | Platform | User Override | Resolved | Source |
//   Derived | Flag
//
// VISUAL CONTRACT:
//   - Token system: BT (bloomberg-ui) — no Tailwind colors.
//   - Section header pattern matches StanceTab.SectionHeader (mono 8px caps,
//     accent color, letterSpacing 1, header bg, subtle border).
//   - Editable input border: BT.text.teal (#00E5A0) — the established
//     "user override / editable cell" convention.
//   - Source badges: amber=Override, agent-teal=Platform, cyan=OM Narrative,
//     purple=Computed, muted=Not Provided.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';

const MONO  = BT.font.mono;
const TEAL  = BT.text.teal;
const AMBER = BT.text.amber;
const CYAN  = BT.text.cyan;
const GREEN = BT.text.green;

// ─── Source badge ──────────────────────────────────────────────────────────────

type SourceKind = 'Override' | 'Platform' | 'OM Narrative' | 'Computed' | 'Not Provided';

const SOURCE_COLOR: Record<SourceKind, string> = {
  'Override':      BT.accent.user,    // amber
  'Platform':      BT.accent.agent,   // teal
  'OM Narrative':  BT.accent.doc,     // cyan
  'Computed':      BT.text.purple,
  'Not Provided':  BT.text.muted,
};

function SourceBadge({ kind }: { kind: SourceKind }) {
  const c = SOURCE_COLOR[kind];
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, fontWeight: 700, color: c,
      background: `${c}18`, border: `1px solid ${c}44`,
      padding: '1px 5px', letterSpacing: 0.5,
      whiteSpace: 'nowrap',
    }}>
      {kind.toUpperCase()}
    </span>
  );
}

// ─── LV cell — placeholder rendering for Broker / Platform / Resolved cols ────

function LvCell({ value, muted = false, accent }: {
  value?: string | null;
  muted?: boolean;
  accent?: string;
}) {
  const v = value ?? '--';
  const isEmpty = v === '--' || v === '';
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9,
      color: isEmpty ? BT.text.muted : (accent ?? (muted ? BT.text.muted : BT.text.primary)),
      fontWeight: isEmpty ? 400 : 600,
      letterSpacing: 0.3,
    }}>
      {v}
    </span>
  );
}

function NaCell() {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, color: BT.text.muted,
      letterSpacing: 0.5, opacity: 0.6,
    }}>
      N/A
    </span>
  );
}

// ─── Editable override input — teal border per spec ───────────────────────────

function OverrideInput({
  value, onChange, placeholder = '--', width = 96, type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  type?: 'text' | 'number' | 'date';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        color: value ? TEAL : BT.text.muted,
        background: BT.bg.input,
        border: `1px solid ${TEAL}55`,
        padding: '3px 6px', width,
        textAlign: 'right',
        outline: 'none',
        letterSpacing: 0.3,
      }}
    />
  );
}

function DropdownSelect({
  value, options, onChange, width = 110,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        color: value ? TEAL : BT.text.muted,
        background: BT.bg.input,
        border: `1px solid ${TEAL}55`,
        padding: '3px 6px', width,
        outline: 'none',
        letterSpacing: 0.3,
      }}
    >
      <option value="">--</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}

// ─── Section header — accent-colored, matches StanceTab pattern ───────────────

function SectionHeader({ label, accent, sub }: { label: string; accent: string; sub?: string }) {
  return (
    <tr>
      <td colSpan={8} style={{
        padding: '10px 14px 5px',
        background: BT.bg.header,
        borderTop: `2px solid ${accent}`,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: accent,
            letterSpacing: 1.2, fontWeight: 700,
          }}>
            {label}
          </span>
          {sub && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>
              {sub}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function SpacerRow() {
  return (
    <tr>
      <td colSpan={8} style={{ height: 8, background: BT.bg.terminal, borderBottom: 'none' }} />
    </tr>
  );
}

// ─── Row primitives ───────────────────────────────────────────────────────────
//
// LvRow renders the canonical 8-column structure. Children pass cell content
// via props; cells default to '--' when null. The Override column owns local
// state via the `override` / `setOverride` props passed from the parent.

interface LvRowProps {
  label: string;
  hint?: string;
  broker?: string;          // null → renders '--'
  platform?: string;
  override: string;         // local state
  setOverride: (v: string) => void;
  resolved?: string;        // null → renders '--' (resolution unwired)
  source: SourceKind;
  derived?: string;
  flag?: React.ReactNode;
  // When true, Broker/Platform render N/A styling (operator-decision rows).
  operatorOnly?: boolean;
  // Override column variant: input | dropdown | passthrough text
  overrideKind?: 'text' | 'number' | 'date' | 'pct';
  overrideOptions?: string[]; // for dropdown rows (Exit Strategy)
  // Display-only row treatment
  readOnly?: boolean;
  readOnlyValue?: string;
  // Bold subtotal/total treatment
  emphasis?: 'subtotal' | 'total' | null;
}

function LvRow({
  label, hint, broker, platform, override, setOverride, resolved, source,
  derived, flag, operatorOnly = false, overrideKind = 'text', overrideOptions,
  readOnly = false, readOnlyValue,
  emphasis = null,
}: LvRowProps) {
  const rowBg = emphasis === 'total'
    ? `${AMBER}10`
    : emphasis === 'subtotal'
      ? `${AMBER}06`
      : 'transparent';
  const labelColor = emphasis === 'total'
    ? AMBER
    : emphasis === 'subtotal'
      ? AMBER
      : BT.text.secondary;
  const labelWeight = emphasis ? 700 : 500;

  return (
    <tr style={{ background: rowBg, borderBottom: `1px solid ${BT.border.subtle}` }}>
      {/* Line Item — sticky-left feel (no real sticky in scrollable container) */}
      <td style={{ padding: '6px 14px', minWidth: 220 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: labelWeight,
          color: labelColor, letterSpacing: 0.5,
        }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 1 }}>
            {hint}
          </div>
        )}
      </td>

      {/* Broker */}
      <td style={td()}>
        {operatorOnly ? <NaCell /> : <LvCell value={broker} muted />}
      </td>

      {/* Platform */}
      <td style={td()}>
        {operatorOnly ? <NaCell /> : <LvCell value={platform} muted />}
      </td>

      {/* User Override */}
      <td style={td()}>
        {readOnly ? (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>
        ) : overrideKind === 'date' ? (
          <OverrideInput value={override} onChange={setOverride} type="date" width={120} />
        ) : overrideOptions ? (
          <DropdownSelect value={override} options={overrideOptions} onChange={setOverride} />
        ) : overrideKind === 'pct' ? (
          <OverrideInput value={override} onChange={setOverride} placeholder="--%" />
        ) : overrideKind === 'number' ? (
          <OverrideInput value={override} onChange={setOverride} type="number" />
        ) : (
          <OverrideInput value={override} onChange={setOverride} />
        )}
      </td>

      {/* Resolved — highlighted column */}
      <td style={{ ...td(), background: emphasis ? 'transparent' : `${BT.text.amber}06` }}>
        {readOnly ? (
          <LvCell value={readOnlyValue} accent={emphasis === 'total' ? AMBER : BT.text.primary} />
        ) : (
          <LvCell value={resolved} accent={emphasis === 'total' ? AMBER : BT.text.amber} />
        )}
      </td>

      {/* Source */}
      <td style={td()}>
        <SourceBadge kind={source} />
      </td>

      {/* Derived */}
      <td style={td()}>
        {derived
          ? <LvCell value={derived} muted />
          : <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>}
      </td>

      {/* Flag */}
      <td style={td()}>
        {flag ?? <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>}
      </td>
    </tr>
  );
}

function td(): React.CSSProperties {
  return {
    padding: '6px 10px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };
}

// ─── Column header row ────────────────────────────────────────────────────────

function ColumnHeader() {
  const cells: Array<[string, number, React.CSSProperties?]> = [
    ['LINE ITEM',     220, { textAlign: 'left',  paddingLeft: 14 }],
    ['BROKER',        110],
    ['PLATFORM',      110],
    ['USER OVERRIDE', 120],
    ['RESOLVED',      120, { background: `${BT.text.amber}10` }],
    ['SOURCE',        90],
    ['DERIVED',       110],
    ['FLAG',          70],
  ];
  return (
    <tr style={{
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.medium}`,
    }}>
      {cells.map(([label, width, extra]) => (
        <th key={label} style={{
          padding: '6px 10px',
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          color: BT.text.muted, letterSpacing: 1,
          textAlign: 'right',
          minWidth: width,
          position: 'sticky', top: 0, zIndex: 5,
          backgroundClip: 'padding-box',
          background: BT.bg.header,
          ...extra,
        }}>
          {label}
        </th>
      ))}
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const QUICK_HOLD_CHIPS = [3, 5, 7, 10];

export function DealTermsTab(props: FinancialEngineTabProps) {
  // Header context — values left placeholder per scope rules. We do read
  // dealName / totalUnits from props if they happen to be present, since
  // those are passive prop reads (not fetches / not store writes).
  const dealName = (props.f9Financials?.dealName)
    ?? (props.assumptions?.dealInfo?.dealName as string | undefined)
    ?? '—';
  const totalUnits = (props.f9Financials?.totalUnits)
    ?? (props.assumptions?.dealInfo?.totalUnits as number | undefined)
    ?? null;

  // ── ACQUISITION / ENTRY local state ─────────────────────────────────────────
  const [purchasePrice, setPurchasePrice]       = useState('');
  const [closeBrokerFee, setCloseBrokerFee]     = useState('');
  const [closeLegalDD,   setCloseLegalDD]       = useState('');
  const [closeLender,    setCloseLender]        = useState('');
  const [closeReserves,  setCloseReserves]      = useState('');
  const [closeOther,     setCloseOther]         = useState('');
  const [goingInCap,     setGoingInCap]         = useState('');
  const [stabilizedCap,  setStabilizedCap]      = useState('');
  const [closeDate,      setCloseDate]          = useState('');

  // ── HOLD & TARGETS ─────────────────────────────────────────────────────────
  const [holdYears,      setHoldYears]          = useState('');
  const [targetIrr,      setTargetIrr]          = useState('');
  const [targetEm,       setTargetEm]           = useState('');
  const [targetCoc,      setTargetCoc]          = useState('');

  // ── EXIT / DISPOSITION ─────────────────────────────────────────────────────
  const [exitStrategy,   setExitStrategy]       = useState('');
  const [exitCap,        setExitCap]            = useState('');
  const [sellingCosts,   setSellingCosts]       = useState('');

  // Derived (read-only display) — Exit Date + Exit Value + Net Proceeds.
  // Formulas intentionally not implemented (no wiring); values stay '--'.
  // The frame is here so the data-wiring task can drop computations in.
  const exitDateDerived  = useMemo(() => '--', [closeDate, holdYears]);
  const exitValueDerived = '--';
  const netProceedsDerived = '--';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: BT.bg.terminal, overflow: 'hidden',
    }}>

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: AMBER, letterSpacing: 1,
        }}>
          DEAL TERMS
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
          {dealName}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
          {totalUnits != null ? `${totalUnits} Units` : '— Units'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
          At-Acquisition Snapshot
        </span>

        {/* KPI pill set — placeholder values per spec */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {[
            { label: 'IRR',  v: '--' },
            { label: 'EM',   v: '--' },
            { label: 'DSCR', v: '--' },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'baseline', gap: 4,
              padding: '2px 8px',
              background: BT.bg.panelAlt,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 2,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6 }}>
                {p.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>
                {p.v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hold-period quick chips — sit ABOVE the table per spec ────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px',
        background: BT.bg.panelAlt,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1,
        }}>
          HOLD PERIOD QUICK-SELECT:
        </span>
        {QUICK_HOLD_CHIPS.map(yr => {
          const active = holdYears === String(yr);
          return (
            <button
              key={yr}
              onClick={() => setHoldYears(String(yr))}
              style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                color: active ? CYAN : BT.text.muted,
                background: active ? `${CYAN}18` : 'transparent',
                border: `1px solid ${active ? CYAN : BT.border.subtle}`,
                padding: '2px 10px', borderRadius: 2,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              {yr}Y
            </button>
          );
        })}
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: BT.bg.panel,
        }}>
          <thead>
            <ColumnHeader />
          </thead>
          <tbody>

            {/* ════════════ SECTION 1 — ACQUISITION / ENTRY ════════════ */}
            <SectionHeader label="ACQUISITION / ENTRY" accent={AMBER} sub="Going-in basis & cap rate" />

            <LvRow label="Purchase Price"
              broker="--" platform="--"
              override={purchasePrice} setOverride={setPurchasePrice}
              resolved="--"
              source={purchasePrice ? 'Override' : 'Not Provided'}
              derived="-- $/unit · -- $/SF"
            />
            <LvRow label="Closing Costs — Broker Fee"
              broker="--" platform="--"
              override={closeBrokerFee} setOverride={setCloseBrokerFee}
              resolved="--"
              source={closeBrokerFee ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Closing Costs — Legal & DD"
              broker="--" platform="--"
              override={closeLegalDD} setOverride={setCloseLegalDD}
              resolved="--"
              source={closeLegalDD ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Closing Costs — Lender / Orig"
              broker="--" platform="--"
              override={closeLender} setOverride={setCloseLender}
              resolved="--"
              source={closeLender ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Closing Costs — Reserves"
              broker="--" platform="--"
              override={closeReserves} setOverride={setCloseReserves}
              resolved="--"
              source={closeReserves ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Closing Costs — Other / Cont."
              broker="--" platform="--"
              override={closeOther} setOverride={setCloseOther}
              resolved="--"
              source={closeOther ? 'Override' : 'Not Provided'}
            />

            <LvRow label="─── TOTAL CLOSING COSTS ───"
              broker="--" platform="--"
              override="" setOverride={() => {}}
              readOnly readOnlyValue="--"
              source="Computed"
              emphasis="subtotal"
            />
            <LvRow label="═══ ALL-IN BASIS ═══"
              broker="--" platform="--"
              override="" setOverride={() => {}}
              readOnly readOnlyValue="--"
              source="Computed"
              derived="-- $/unit · -- $/SF"
              emphasis="total"
            />

            <SpacerRow />

            <LvRow label="Going-in Cap Rate"
              hint="T12 NOI / Purchase"
              broker="--" platform="--"
              override={goingInCap} setOverride={setGoingInCap}
              overrideKind="pct"
              resolved="--"
              source={goingInCap ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Stabilized Cap Rate"
              hint="Estimate at stabilization"
              broker="--" platform="--"
              override={stabilizedCap} setOverride={setStabilizedCap}
              overrideKind="pct"
              resolved="--"
              source={stabilizedCap ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Close Date"
              broker="--" platform="--"
              override={closeDate} setOverride={setCloseDate}
              overrideKind="date"
              resolved={closeDate || '--'}
              source={closeDate ? 'Override' : 'Not Provided'}
            />

            {/* ════════════ SECTION 2 — HOLD & TARGETS ════════════ */}
            <SectionHeader label="HOLD & TARGETS" accent={CYAN} sub="Operator decisions — N/A in extracted layers" />

            <LvRow label="Hold Period (years)"
              operatorOnly
              override={holdYears} setOverride={setHoldYears}
              overrideKind="number"
              resolved={holdYears || '--'}
              source={holdYears ? 'Override' : 'Not Provided'}
              derived={holdYears ? `${holdYears} yr` : undefined}
            />
            <LvRow label="Target Levered IRR"
              operatorOnly
              override={targetIrr} setOverride={setTargetIrr}
              overrideKind="pct"
              resolved={targetIrr ? `${targetIrr}%` : '--'}
              source={targetIrr ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Target Equity Multiple"
              operatorOnly
              override={targetEm} setOverride={setTargetEm}
              overrideKind="number"
              resolved={targetEm ? `${targetEm}x` : '--'}
              source={targetEm ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Target Cash-on-Cash (Y1)"
              operatorOnly
              override={targetCoc} setOverride={setTargetCoc}
              overrideKind="pct"
              resolved={targetCoc ? `${targetCoc}%` : '--'}
              source={targetCoc ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Investment Strategy"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue="From THESIS §1 — not yet wired"
              source="Not Provided"
            />

            {/* ════════════ SECTION 3 — EXIT / DISPOSITION ════════════ */}
            <SectionHeader label="EXIT / DISPOSITION" accent={GREEN} sub="Disposition assumptions & exit math" />

            <LvRow label="Exit Strategy"
              operatorOnly
              override={exitStrategy} setOverride={setExitStrategy}
              overrideOptions={['Sale', 'Refinance', 'Hold']}
              resolved={exitStrategy || '--'}
              source={exitStrategy ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Exit Cap Rate"
              broker="--" platform="--"
              override={exitCap} setOverride={setExitCap}
              overrideKind="pct"
              resolved={exitCap ? `${exitCap}%` : '--'}
              source={exitCap ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Selling Costs %"
              broker="--" platform="2.00%"
              override={sellingCosts} setOverride={setSellingCosts}
              overrideKind="pct"
              resolved={sellingCosts ? `${sellingCosts}%` : '2.00%'}
              source={sellingCosts ? 'Override' : 'Platform'}
            />

            <SpacerRow />

            <LvRow label="Exit Date"
              hint="Close Date + Hold Period"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={exitDateDerived}
              source="Computed"
            />
            <LvRow label="Stabilized NOI at Exit"
              hint="From F9 Pro Forma Y[hold] — not wired"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue="--"
              source="Not Provided"
            />
            <LvRow label="Exit Value"
              hint="Exit NOI / Exit Cap"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={exitValueDerived}
              source="Computed"
              emphasis="total"
            />
            <LvRow label="Net Sale Proceeds"
              hint="Exit Value × (1 − Selling Costs) − Loan Payoff"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={netProceedsDerived}
              source="Computed"
              emphasis="subtotal"
            />

          </tbody>
        </table>

        {/* Footer note */}
        <div style={{
          padding: '12px 14px 24px',
          fontFamily: MONO, fontSize: 8, color: BT.text.muted,
          letterSpacing: 0.5, lineHeight: 1.5,
        }}>
          STRUCTURE-ONLY SCAFFOLD · No backend wiring · Local state only ·
          Resolution column shows '--' until data wiring task lands.
        </div>
      </div>

      {/* TODO: Section 4 (Capital Structure) deliberately omitted pending
          Leon's decision on duplication with F9 Capital tab. See thread.
          If approved, rows: Loan Amount, LTV, LTC, Interest Rate, Loan Term,
          IO Period, Amortization, Origination Fee %, Equity Required,
          LP/GP Split, Preferred Return. */}
    </div>
  );
}

export default DealTermsTab;
