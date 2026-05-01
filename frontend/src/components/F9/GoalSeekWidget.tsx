/**
 * GoalSeekWidget — "Solve for IRR" control panel
 *
 * Input field for target IRR, bundle selector, and action buttons.
 * Appears inside the Model Results section of ProFormaTab.
 */

import React, { useState } from 'react';
import { Loader2, Target, ChevronDown, ChevronUp, Zap } from 'lucide-react';

export interface GoalSeekWidgetProps {
  /** Current model IRR (for placeholder/context) */
  currentIRR: number;
  /** Called when user clicks "Solve" — returns the target and bundle */
  onSolve: (targetIRR: number, bundleId: string) => void;
  /** Whether the solver is currently running */
  solving: boolean;
  /** Result returned by the solver (for feedback) */
  result: {
    targetIRR: number;
    currentIRR: number;
    projectedIRR: number;
    targetReachable: boolean;
    recommendation: string;
    bundleId: string;
    bundleName: string;
  } | null;
}

const DEBT_BUNDLE_OPTIONS = [
  { id: 'hud', name: 'HUD 221(d)(4)' },
  { id: 'agency', name: 'Agency (Fannie/Freddie)' },
  { id: 'cmbs', name: 'CMBS' },
  { id: 'bridge', name: 'Bridge / Transitional' },
  { id: 'construction', name: 'Construction' },
  { id: 'all', name: 'All (cross-bundle)' },
];

const GoalSeekWidget: React.FC<GoalSeekWidgetProps> = ({
  currentIRR,
  onSolve,
  solving,
  result,
}) => {
  const [targetIRR, setTargetIRR] = useState<number>(Math.round((currentIRR + 0.03) * 100));
  const [bundleId, setBundleId] = useState('hud');
  const [expanded, setExpanded] = useState(false);

  const handleSolve = () => {
    onSolve(targetIRR / 100, bundleId);
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Goal Seeking</span>
          <span className="text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full font-medium">
            Solve for IRR
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Target IRR Input */}
          <div>
            <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider block mb-1">
              Target IRR
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={targetIRR}
                onChange={(e) => setTargetIRR(Number(e.target.value))}
                min={1}
                max={50}
                step={0.5}
                className="w-24 px-3 py-2 text-sm font-mono border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              />
              <span className="text-sm text-stone-500 font-medium">%</span>
              <span className="text-[10px] text-stone-400 ml-1">
                (Current: {(currentIRR * 100).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Bundle Selector */}
          <div>
            <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider block mb-1">
              Debt Bundle
            </label>
            <select
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              {DEBT_BUNDLE_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
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
                Solving...
              </>
            ) : (
              <>
                <Zap size={14} />
                Solve for {(targetIRR / 100 * 100).toFixed(1)}% IRR
              </>
            )}
          </button>

          {/* Result Feedback */}
          {result && (
            <div className={`p-3 rounded-lg text-sm border ${
              result.targetReachable
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">
                  {result.targetReachable ? '✓ Reachable' : '⚠ Target Unreachable'}
                </span>
                <span className="text-[10px] text-stone-500">({result.bundleName})</span>
              </div>
              <p className="text-xs text-stone-600">{result.recommendation}</p>
              <div className="flex gap-4 mt-2 text-xs text-stone-500">
                <span>Current: <strong className="text-stone-700">{(result.currentIRR * 100).toFixed(1)}%</strong></span>
                <span>→</span>
                <span>Projected: <strong className="text-stone-700">{(result.projectedIRR * 100).toFixed(1)}%</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalSeekWidget;
