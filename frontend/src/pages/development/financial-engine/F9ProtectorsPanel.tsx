/**
 * F9 Protectors Panel — Pro Forma Tier-1
 * ======================================
 *
 * Surfaces three protectors from the F9 spec inside the Assumptions tab:
 *
 *   1. Gordon Growth coupling (spec §8) — implied cap rate & divergence
 *      banner attached to the exit-cap field.
 *   2. NOI growth identity (spec §7) — live computed NOI growth derived
 *      from current rent + OPEX assumptions and the broker's NOI margin.
 *   3. Override 3-band warnings (spec §9) — collated list of soft / hard
 *      flags raised by the dealStore when user overrides leave the
 *      P25-P75 / P10-P90 bands.
 *
 * Source of truth: docs/architecture/f9-proforma-spec.md §7-§9 and
 * frontend/src/services/proforma/validators.ts.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, ScatterChart as ScatterIcon, X } from 'lucide-react';
import { useDealStore } from '../../../stores/dealStore';
import {
  validateGordonGrowth,
  buildGordonChartSeries,
  noiGrowthIdentity,
} from '../../../services/proforma/validators';
import type { ValidationFlag } from '../../../services/proforma/types';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Line, ComposedChart, Tooltip,
} from 'recharts';

const MONO = "'JetBrains Mono','Fira Code',monospace";

export interface F9ProtectorsPanelProps {
  /** Current exit cap from the row grid (decimal, e.g. 0.055). */
  exitCap: number | null;
  /** Terminal-year rent growth from the row grid (decimal). Pairs with `exitCap` for Gordon. */
  terminalRentGrowth: number | null;
  /**
   * Same-period rent growth used for the NOI identity. Defaults to
   * `terminalRentGrowth` so callers that don't care about horizon
   * alignment keep the old behavior; pass a stabilized-year value
   * (typically Y2) to keep the identity algebraically honest.
   */
  noiIdentityRentGrowth?: number | null;
  /** Total OPEX growth used for the NOI identity (decimal). Same-period as `noiIdentityRentGrowth`. */
  opexGrowth: number | null;
  /**
   * Buyer's required return k (decimal). Until M14 / RSS is wired in,
   * we let the caller pass a deal-level default — typical MF buyer
   * hurdles range 8-10%.
   */
  requiredReturn?: number;
  /**
   * NOI margin (NOI / EGI) from the broker layer for the NOI identity.
   * Defaults to 0.6 — typical FL MF stabilized margin.
   */
  noiMargin?: number;
  /**
   * Callback invoked when a hard-warning override flag is ACK'd with a
   * justification. The parent persists the rationale alongside the user
   * override (spec §9). Only fired for `source === 'override'` +
   * `severity === 'high'` flags.
   */
  onAckOverride?: (field: string, year: number, rationale: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Gordon banner — sits above the grid, attached to exit-cap context
// ────────────────────────────────────────────────────────────────────────────

function GordonBanner({
  exitCap,
  terminalGrowth,
  requiredReturn,
}: {
  exitCap: number | null;
  terminalGrowth: number | null;
  requiredReturn: number;
}) {
  const [showChart, setShowChart] = useState(false);
  const result = useMemo(
    () =>
      validateGordonGrowth({
        exitCap,
        terminalGrowth,
        requiredReturn,
      }),
    [exitCap, terminalGrowth, requiredReturn],
  );

  const chart = useMemo(
    () => buildGordonChartSeries(exitCap, terminalGrowth, requiredReturn),
    [exitCap, terminalGrowth, requiredReturn],
  );

  // No banner when validation cannot run.
  if (result.impliedCap === null) {
    return null;
  }

  const isOverPromise = result.flag === 'GORDON_OVER_PROMISE';
  const isConservative = result.flag === 'GORDON_CONSERVATIVE';
  const isValid = result.valid && !result.flag;

  const colorClass = isOverPromise
    ? 'bg-red-900/20 border-red-500/40 text-red-300'
    : isConservative
      ? 'bg-blue-900/20 border-blue-500/40 text-blue-300'
      : 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300';

  const icon = isOverPromise ? (
    <AlertTriangle className="w-3 h-3 shrink-0" />
  ) : isConservative ? (
    <Info className="w-3 h-3 shrink-0" />
  ) : (
    <Check className="w-3 h-3 shrink-0" />
  );

  return (
    <div className={`flex items-start gap-2 px-4 py-1.5 border-b ${colorClass}`} style={{ fontFamily: MONO }}>
      {icon}
      <div className="flex-1 text-[10px] leading-tight">
        <div className="font-bold tracking-wide">
          GORDON COUPLING ·{' '}
          {isOverPromise
            ? 'OVER-PROMISE'
            : isConservative
              ? 'CONSERVATIVE'
              : 'BALANCED'}
        </div>
        <div className="opacity-80">
          k {(requiredReturn * 100).toFixed(2)}% − g{' '}
          {((terminalGrowth ?? 0) * 100).toFixed(2)}% ⇒ implied cap{' '}
          <span className="font-bold">
            {(result.impliedCap * 100).toFixed(2)}%
          </span>{' '}
          · deal exit cap{' '}
          <span className="font-bold">
            {((exitCap ?? 0) * 100).toFixed(2)}%
          </span>{' '}
          · divergence{' '}
          <span className="font-bold">
            {result.divergenceBps! > 0 ? '+' : ''}
            {result.divergenceBps}bps
          </span>
        </div>
        {result.message && !isValid && (
          <div className="opacity-90 mt-0.5">{result.message}</div>
        )}
      </div>
      <button
        onClick={() => setShowChart((s) => !s)}
        className="text-[9px] px-2 py-0.5 border border-current rounded opacity-70 hover:opacity-100 shrink-0 flex items-center gap-1"
      >
        <ScatterIcon className="w-2.5 h-2.5" />
        {showChart ? 'HIDE' : 'SHOW'} VALID RANGE
      </button>

      {showChart && chart.line.length > 0 && (
        <div className="absolute right-4 top-12 z-50 bg-[#0a0a0a] border border-[#1e1e1e] rounded p-2 w-[320px] h-[200px] shadow-xl">
          <div className="text-[9px] text-slate-500 font-bold mb-1">
            (g, cap) — Gordon line at k = {(requiredReturn * 100).toFixed(2)}%
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <ComposedChart data={chart.line} margin={{ top: 4, right: 8, bottom: 16, left: 8 }}>
              <XAxis
                dataKey="g"
                type="number"
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                tick={{ fontSize: 8, fill: '#64748b' }}
                stroke="#334155"
                label={{ value: 'g', fontSize: 9, fill: '#475569', dy: 12 }}
              />
              <YAxis
                dataKey="cap"
                type="number"
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                tick={{ fontSize: 8, fill: '#64748b' }}
                stroke="#334155"
                label={{ value: 'cap', fontSize: 9, fill: '#475569', angle: -90, dx: -12 }}
              />
              <Tooltip
                formatter={(v: number | string) => typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : v}
                contentStyle={{ background: '#0a0a0a', border: '1px solid #1e1e1e', fontSize: 9 }}
              />
              <Line type="monotone" dataKey="cap" stroke="#64748b" strokeWidth={1} dot={false} />
              {chart.user && (
                <Scatter
                  data={[chart.user]}
                  fill={isOverPromise ? '#ef4444' : isConservative ? '#3b82f6' : '#10b981'}
                />
              )}
              <ZAxis range={[60, 60]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Validation flag rail item
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse the (field, year) tuple out of an override flag id.
 *
 * The flag id is built in AssumptionsTab as
 *   `override:{field}:{year}:{valueHash}`
 * (see the override-classification effect). We parse from the right
 * because `field` is allowed to contain `:` characters in the future
 * (e.g. nested OPEX line keys); positional split-from-the-left would
 * silently misparse those. Returns null for non-override flags.
 */
function parseOverrideFlagId(id: string): { field: string; year: number } | null {
  const PREFIX = 'override:';
  if (!id.startsWith(PREFIX)) return null;
  const rest = id.slice(PREFIX.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const beforeValue = rest.slice(0, lastColon);
  const yearSepIdx = beforeValue.lastIndexOf(':');
  if (yearSepIdx <= 0) return null;
  const yearStr = beforeValue.slice(yearSepIdx + 1);
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || !/^-?\d+$/.test(yearStr)) return null;
  const field = beforeValue.slice(0, yearSepIdx);
  if (!field) return null;
  return { field, year };
}

function FlagRow({
  flag,
  onAckOverride,
}: {
  flag: ValidationFlag;
  onAckOverride?: (field: string, year: number, rationale: string) => void;
}) {
  const dismiss = useDealStore((s) => s.dismissValidationFlag);
  const remove = useDealStore((s) => s.removeValidationFlag);
  const [note, setNote] = useState(flag.justification ?? '');
  // F9 Tier-1: hard warnings (severity 'high') CANNOT be silently
  // dismissed — the note panel is forced open and stays open until a
  // non-empty justification is submitted (spec §9 hard-warning rule).
  const isHardWarning = flag.severity === 'high';
  const [showNote, setShowNote] = useState(isHardWarning);

  const tone =
    flag.severity === 'high'
      ? 'border-red-500/40 text-red-300 bg-red-900/10'
      : flag.severity === 'medium'
        ? 'border-amber-500/40 text-amber-300 bg-amber-900/10'
        : 'border-blue-500/40 text-blue-300 bg-blue-900/10';

  const handleAck = () => {
    const trimmed = note.trim();
    if (isHardWarning && !trimmed) return; // Enforced: empty rationale rejected.
    // For override hard warnings, persist the rationale to the
    // user-assumption layer via the parent callback (writes through
    // to per_year_overrides `rationale:{field}:{year}` JSONB key).
    if (isHardWarning && flag.source === 'override' && onAckOverride) {
      const parsed = parseOverrideFlagId(flag.id);
      if (parsed) onAckOverride(parsed.field, parsed.year, trimmed);
    }
    dismiss(flag.id, trimmed);
    if (!isHardWarning) setShowNote(false);
  };

  return (
    <div className={`px-2 py-1 border-l-2 ${tone} ${flag.dismissed ? 'opacity-50' : ''}`} style={{ fontFamily: MONO, fontSize: 9 }}>
      <div className="flex items-start gap-1">
        <span className="font-bold tracking-wide">{flag.source.toUpperCase()}</span>
        {isHardWarning && !flag.dismissed && (
          <span className="px-1 py-px text-[7px] font-bold tracking-widest bg-red-500/30 border border-red-500/50 rounded">
            JUSTIFICATION REQUIRED
          </span>
        )}
        <span className="ml-auto flex gap-1 shrink-0">
          {!flag.dismissed && !isHardWarning && (
            <button
              onClick={() => setShowNote((s) => !s)}
              className="text-[8px] opacity-70 hover:opacity-100 underline"
            >
              note
            </button>
          )}
          {/* Hard warnings cannot be silently removed — only ACK with note clears them. */}
          {!isHardWarning && (
            <button onClick={() => remove(flag.id)} className="opacity-50 hover:opacity-100">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      </div>
      <div className="mt-0.5 leading-tight">{flag.message}</div>
      {flag.justification && (
        <div className="mt-1 italic opacity-80">"{flag.justification}"</div>
      )}
      {showNote && !flag.dismissed && (
        <div className="mt-1 flex gap-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isHardWarning ? 'Justification (required)…' : 'Justification…'}
            className="flex-1 bg-[#060606] border border-current rounded px-1 py-0.5 text-[9px] text-slate-200"
          />
          <button
            onClick={handleAck}
            disabled={isHardWarning && !note.trim()}
            className="px-1.5 py-0.5 text-[8px] font-bold border border-current rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ACK
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NOI identity row (small inline display)
// ────────────────────────────────────────────────────────────────────────────

function NoiIdentityRow({
  rentGrowth,
  opexGrowth,
  noiMargin,
}: {
  rentGrowth: number | null;
  opexGrowth: number | null;
  noiMargin: number;
}) {
  const noiG = noiGrowthIdentity(rentGrowth, opexGrowth, noiMargin);
  if (rentGrowth === null || opexGrowth === null) {
    return (
      <div className="px-3 py-1 text-[9px] text-slate-500" style={{ fontFamily: MONO }}>
        NOI growth identity — incomplete inputs (need rent growth, OPEX growth, NOI margin)
      </div>
    );
  }
  const opexShare = 1 - noiMargin;
  const negative = noiG !== null && noiG < 0;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-1 border-y border-[#1e1e1e] ${negative ? 'bg-red-900/10 text-red-300' : 'bg-[#0d0d0d] text-slate-400'}`}
      style={{ fontFamily: MONO, fontSize: 10 }}
    >
      <span className="font-bold tracking-wide text-[9px]">NOI GROWTH IDENTITY</span>
      <span className="opacity-80 text-[9px]">
        ({(rentGrowth * 100).toFixed(2)}% − {(opexGrowth * 100).toFixed(2)}% × {(opexShare * 100).toFixed(0)}%) /{' '}
        {(noiMargin * 100).toFixed(0)}%
      </span>
      <span className="font-bold text-[11px] ml-auto">
        = {noiG !== null ? `${(noiG * 100).toFixed(2)}% NOI growth` : '—'}
      </span>
      {negative && <AlertTriangle className="w-3 h-3" />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level panel
// ────────────────────────────────────────────────────────────────────────────

export function F9ProtectorsPanel({
  exitCap,
  terminalRentGrowth,
  noiIdentityRentGrowth,
  opexGrowth,
  requiredReturn = 0.09,
  noiMargin = 0.6,
  onAckOverride,
}: F9ProtectorsPanelProps) {
  const validationFlags = useDealStore((s) => s.validationFlags);
  const runGordon = useDealStore((s) => s.runGordonValidation);

  // Re-run Gordon validation whenever the relevant inputs change. The
  // result is also kept in dealStore.validationFlags for cross-component
  // visibility.
  React.useEffect(() => {
    runGordon({
      exitCap,
      terminalGrowth: terminalRentGrowth,
      requiredReturn,
    });
  }, [exitCap, terminalRentGrowth, requiredReturn, runGordon]);

  const activeFlags = validationFlags.filter((f) => !f.dismissed);
  const identityRentGrowth =
    noiIdentityRentGrowth !== undefined ? noiIdentityRentGrowth : terminalRentGrowth;

  return (
    <div className="relative">
      <GordonBanner
        exitCap={exitCap}
        terminalGrowth={terminalRentGrowth}
        requiredReturn={requiredReturn}
      />
      <NoiIdentityRow
        rentGrowth={identityRentGrowth}
        opexGrowth={opexGrowth}
        noiMargin={noiMargin}
      />
      {activeFlags.length > 0 && (
        <div className="px-2 py-1 bg-[#0a0a0a] border-b border-[#1e1e1e] flex flex-col gap-1">
          <div className="text-[8px] font-bold tracking-widest text-slate-500" style={{ fontFamily: MONO }}>
            ACTIVE PROTECTOR FLAGS · {activeFlags.length}
          </div>
          {activeFlags.map((f) => (
            <FlagRow key={f.id} flag={f} onAckOverride={onAckOverride} />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Cell override badge — small severity indicator for grid cells
// ────────────────────────────────────────────────────────────────────────────

export function OverrideBadge({
  classification,
}: {
  classification: 'within' | 'soft_warning' | 'hard_warning' | null;
}) {
  if (!classification || classification === 'within') return null;
  const color =
    classification === 'hard_warning'
      ? 'bg-red-500'
      : 'bg-amber-500';
  const title =
    classification === 'hard_warning'
      ? 'Override outside P10–P90 band — justification required'
      : 'Override outside P25–P75 (soft warning)';
  return (
    <span
      title={title}
      className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${color}`}
    />
  );
}
