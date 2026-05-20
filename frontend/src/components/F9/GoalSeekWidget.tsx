/**
 * GoalSeekWidget — expanded Goal Seek control panel
 *
 * Supports any numeric input/output pair:
 *   Solve-for variables: purchase price, exit cap, rent/NOI growth, hold period, LTV, interest rate
 *   Target metrics:      IRR, equity multiple, cash-on-cash
 *
 * Shows:
 *   - Convergence status (solved value vs original, iterations)
 *   - No-solution message with the range tried
 *   - Inline overlay section with current vs solved assumption highlight
 */

import React, { useState } from 'react';
import { Loader2, Target, ChevronDown, ChevronUp, Zap, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

// ─── Variable + metric config ─────────────────────────────────────────────────

export type SolveVariable =
  | 'purchase_price'
  | 'exit_cap_rate'
  | 'rent_growth'
  | 'hold_period'
  | 'ltv'
  | 'interest_rate';

export type TargetMetric = 'irr' | 'equity_multiple' | 'cash_on_cash';

interface VariableOption {
  id: SolveVariable;
  label: string;
  unit: 'percent' | 'dollars' | 'years';
  category: 'acquisition' | 'disposition' | 'revenue' | 'financing';
  targetHint?: string;
}

interface MetricOption {
  id: TargetMetric;
  label: string;
  placeholder: string;
  unit: string;
  scale: number;
  toDisplay: (v: number) => string;
  fromDisplay: (v: number) => number;
}

const VARIABLE_OPTIONS: VariableOption[] = [
  { id: 'purchase_price', label: 'Purchase Price', unit: 'dollars',  category: 'acquisition',  targetHint: 'e.g. 8500000' },
  { id: 'exit_cap_rate',  label: 'Exit Cap Rate',  unit: 'percent',  category: 'disposition',  targetHint: 'e.g. 5.5' },
  { id: 'rent_growth',    label: 'Rent / NOI Growth', unit: 'percent', category: 'revenue',   targetHint: 'e.g. 3.0' },
  { id: 'hold_period',    label: 'Hold Period',    unit: 'years',    category: 'acquisition',  targetHint: 'e.g. 7' },
  { id: 'ltv',            label: 'LTV',            unit: 'percent',  category: 'financing',    targetHint: 'e.g. 72' },
  { id: 'interest_rate',  label: 'Interest Rate',  unit: 'percent',  category: 'financing',    targetHint: 'e.g. 6.5' },
];

const METRIC_OPTIONS: MetricOption[] = [
  {
    id: 'irr',
    label: 'IRR',
    placeholder: '15.0',
    unit: '%',
    scale: 100,
    toDisplay: (v) => parseFloat((v * 100).toFixed(2)),
    fromDisplay: (v) => v / 100,
  },
  {
    id: 'equity_multiple',
    label: 'Equity Multiple',
    placeholder: '2.0',
    unit: '×',
    scale: 1,
    toDisplay: (v) => parseFloat(v.toFixed(3)),
    fromDisplay: (v) => v,
  },
  {
    id: 'cash_on_cash',
    label: 'Cash-on-Cash',
    placeholder: '6.0',
    unit: '%',
    scale: 100,
    toDisplay: (v) => parseFloat((v * 100).toFixed(2)),
    fromDisplay: (v) => v / 100,
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  acquisition: 'text-blue-600',
  disposition: 'text-purple-600',
  revenue:     'text-emerald-600',
  financing:   'text-amber-600',
};

// ─── Result types ─────────────────────────────────────────────────────────────

export interface BroaderGoalSeekResult {
  solveFor: SolveVariable;
  targetMetric: TargetMetric;
  targetValue: number;
  solvedValue: number | null;
  originalValue: number;
  achievedMetricValue: number | null;
  converged: boolean;
  iterations: number;
  noSolution: boolean;
  noSolutionReason: string | null;
  rangeTriedLo: number;
  rangeTriedHi: number;
  metricAtLo: number | null;
  metricAtHi: number | null;
}

export interface GoalSeekWidgetProps {
  currentIRR: number;
  currentEquityMultiple?: number;
  currentCashOnCash?: number;
  currentPurchasePrice?: number;
  currentExitCapRate?: number;
  currentRentGrowth?: number;
  currentHoldYears?: number;
  currentLtv?: number;
  currentInterestRate?: number;
  onSolveBroader: (
    solveFor: SolveVariable,
    targetMetric: TargetMetric,
    targetValue: number,
  ) => void;
  solving: boolean;
  result: BroaderGoalSeekResult | null;
  /** Legacy: still supported for backward compat */
  onSolve?: (targetIRR: number, bundleId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSolvedValue(variable: SolveVariable, value: number): string {
  switch (variable) {
    case 'purchase_price': return `$${Math.round(value).toLocaleString()}`;
    case 'exit_cap_rate':  return `${(value * 100).toFixed(2)}%`;
    case 'rent_growth':    return `${(value * 100).toFixed(2)}%`;
    case 'hold_period':    return `${Math.round(value)} yr`;
    case 'ltv':            return `${(value * 100).toFixed(1)}%`;
    case 'interest_rate':  return `${(value * 100).toFixed(2)}%`;
    default:               return String(value);
  }
}

function getCurrentValue(variable: SolveVariable, props: GoalSeekWidgetProps): number | undefined {
  switch (variable) {
    case 'purchase_price': return props.currentPurchasePrice;
    case 'exit_cap_rate':  return props.currentExitCapRate;
    case 'rent_growth':    return props.currentRentGrowth;
    case 'hold_period':    return props.currentHoldYears;
    case 'ltv':            return props.currentLtv;
    case 'interest_rate':  return props.currentInterestRate;
    default:               return undefined;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const GoalSeekWidget: React.FC<GoalSeekWidgetProps> = (props) => {
  const { currentIRR, solving, result, onSolveBroader } = props;

  const [expanded,      setExpanded]      = useState(false);
  const [solveFor,      setSolveFor]      = useState<SolveVariable>('purchase_price');
  const [targetMetric,  setTargetMetric]  = useState<TargetMetric>('irr');
  const [targetDisplay, setTargetDisplay] = useState<string>('15.0');

  const selectedVar    = VARIABLE_OPTIONS.find(v => v.id === solveFor)!;
  const selectedMetric = METRIC_OPTIONS.find(m => m.id === targetMetric)!;

  const handleSolve = () => {
    const displayVal = parseFloat(targetDisplay);
    if (isNaN(displayVal)) return;
    const targetValue = selectedMetric.fromDisplay(displayVal);
    onSolveBroader(solveFor, targetMetric, targetValue);
  };

  const handleMetricChange = (metric: TargetMetric) => {
    setTargetMetric(metric);
    const m = METRIC_OPTIONS.find(o => o.id === metric)!;
    // Reset to current metric value as default target
    let currentVal: number | undefined;
    if (metric === 'irr') currentVal = currentIRR;
    else if (metric === 'equity_multiple') currentVal = props.currentEquityMultiple;
    else if (metric === 'cash_on_cash') currentVal = props.currentCashOnCash;
    if (currentVal !== undefined) {
      setTargetDisplay(String(m.toDisplay(currentVal + (metric === 'irr' ? 0.03 : 0))));
    } else {
      setTargetDisplay(m.placeholder);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Goal Seek</span>
          <span className="text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full font-medium">
            Solve any variable
          </span>
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-blue-500" />
          : <ChevronDown size={14} className="text-blue-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">

          {/* Row 1: What to solve for */}
          <div>
            <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
              Find the required…
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {VARIABLE_OPTIONS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSolveFor(v.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-left ${
                    solveFor === v.id
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className={`text-[9px] font-bold uppercase ${solveFor === v.id ? 'text-blue-200' : CATEGORY_COLOR[v.category]}`}>
                    {v.category.slice(0, 3)}
                  </span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Target metric */}
          <div>
            <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
              …to achieve this target
            </label>
            <div className="flex gap-2 mb-2">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleMetricChange(m.id)}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    targetMetric === m.id
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={targetDisplay}
                onChange={(e) => setTargetDisplay(e.target.value)}
                step={selectedMetric.id === 'equity_multiple' ? '0.1' : '0.5'}
                className="w-28 px-3 py-2 text-sm font-mono border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                placeholder={selectedMetric.placeholder}
              />
              <span className="text-sm text-stone-500 font-medium">{selectedMetric.unit}</span>
              {currentIRR > 0 && targetMetric === 'irr' && (
                <span className="text-[10px] text-stone-400 ml-1">
                  Current IRR: {(currentIRR * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {/* Solve Button */}
          <button
            onClick={handleSolve}
            disabled={solving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {solving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Solving…
              </>
            ) : (
              <>
                <Zap size={14} />
                Find required {selectedVar.label}
              </>
            )}
          </button>

          {/* Result panel */}
          {result && <GoalSeekResult result={result} props={props} />}
        </div>
      )}
    </div>
  );
};

// ─── Result display ───────────────────────────────────────────────────────────

const GoalSeekResult: React.FC<{ result: BroaderGoalSeekResult; props: GoalSeekWidgetProps }> = ({ result, props }) => {
  const varMeta    = VARIABLE_OPTIONS.find(v => v.id === result.solveFor)!;
  const metricMeta = METRIC_OPTIONS.find(m => m.id === result.targetMetric)!;

  const currentVal = getCurrentValue(result.solveFor, props);

  if (result.noSolution) {
    return (
      <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
        <div className="flex items-center gap-1.5 mb-1.5">
          <XCircle size={14} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-800">No Solution in Range</span>
        </div>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          {result.noSolutionReason}
        </p>
        {result.metricAtLo !== null && result.metricAtHi !== null && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-amber-600">
            <div>
              <div className="text-amber-400">At {formatSolvedValue(result.solveFor, result.rangeTriedLo)}</div>
              <div className="font-mono font-semibold">
                {metricMeta.toDisplay(result.metricAtLo)}{metricMeta.unit}
              </div>
            </div>
            <div>
              <div className="text-amber-400">At {formatSolvedValue(result.solveFor, result.rangeTriedHi)}</div>
              <div className="font-mono font-semibold">
                {metricMeta.toDisplay(result.metricAtHi)}{metricMeta.unit}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!result.converged || result.solvedValue === null) {
    return (
      <div className="p-3 rounded-lg border bg-red-50 border-red-200">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-red-600" />
          <span className="text-xs font-semibold text-red-800">Solver did not converge</span>
        </div>
        <p className="text-[11px] text-red-600 mt-1">
          {result.noSolutionReason ?? 'Try adjusting the target or search range.'}
        </p>
      </div>
    );
  }

  const solvedDisplay  = formatSolvedValue(result.solveFor, result.solvedValue);
  const currentDisplay = currentVal !== undefined ? formatSolvedValue(result.solveFor, currentVal) : null;
  const achievedDisplay = result.achievedMetricValue !== null
    ? `${metricMeta.toDisplay(result.achievedMetricValue)}${metricMeta.unit}`
    : '—';
  const targetDisplay = `${metricMeta.toDisplay(result.targetValue)}${metricMeta.unit}`;

  return (
    <div className="rounded-lg border bg-emerald-50 border-emerald-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 border-b border-emerald-200">
        <CheckCircle2 size={13} className="text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-800">
          Solved in {result.iterations} iteration{result.iterations !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Inline overlay — assumption change */}
      <div className="px-3 py-2.5">
        <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">
          Required {varMeta.label}
        </div>
        <div className="flex items-center gap-2 mb-2">
          {currentDisplay && (
            <>
              <span className="font-mono text-sm text-stone-500 line-through">{currentDisplay}</span>
              <ArrowRight size={12} className="text-stone-400" />
            </>
          )}
          <span className="font-mono text-base font-bold text-emerald-700">{solvedDisplay}</span>
          {currentDisplay && (
            <DeltaBadge current={currentVal!} solved={result.solvedValue} variable={result.solveFor} />
          )}
        </div>

        {/* Metric achieved */}
        <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
          <div className="text-[10px] text-emerald-600">
            Target {metricMeta.label}
            <span className="font-mono font-semibold ml-1">{targetDisplay}</span>
          </div>
          <div className="text-[10px] text-emerald-700">
            Achieved
            <span className="font-mono font-semibold ml-1">{achievedDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeltaBadge: React.FC<{ current: number; solved: number; variable: SolveVariable }> = ({ current, solved, variable }) => {
  const delta = solved - current;
  if (Math.abs(delta) < 1e-8) return null;

  let label: string;
  switch (variable) {
    case 'purchase_price':
      label = `${delta > 0 ? '+' : ''}$${Math.round(Math.abs(delta)).toLocaleString()}`;
      break;
    case 'hold_period':
      label = `${delta > 0 ? '+' : ''}${Math.round(delta)} yr`;
      break;
    default:
      label = `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(2)}pp`;
  }

  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
      delta > 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {label}
    </span>
  );
};

export default GoalSeekWidget;
