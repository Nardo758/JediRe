/**
 * GoalSeekRoadmap — Step-by-step roadmap from the goal-seeking solver
 *
 * Displays each adjustment step with:
 * - Variable name and current → suggested value
 * - IRR lift in percentage points
 * - d cost
 * - Feasibility badge
 *
 * One "Apply to Proforma" button at the bottom sends the full applyPayload
 * to the parent handler.
 */

import React from 'react';
import { CheckCircle2, ArrowRight, AlertTriangle, Thermometer } from 'lucide-react';

export interface RoadmapStep {
  varId: string;
  label: string;
  category: 'revenue' | 'expense' | 'capital' | 'disposition';
  currentValue: number;
  suggestedValue: number;
  irrLiftPp: number;
  dCost: number;
  isExpenseLineItem: boolean;
  locked: boolean;
  feasibility: 'straightforward' | 'moderate' | 'aggressive' | 'heroic';
}

export interface ApplyPayload {
  assumptions: Record<string, number>;
  expenseOverrides: Record<string, number>;
  changed: string[];
  summary: string;
}

export interface GoalSeekRoadmapProps {
  steps: RoadmapStep[];
  currentIRR: number;
  projectedIRR: number;
  targetIRR: number;
  recommendation: string;
  applyPayload: ApplyPayload;
  onApply: (payload: ApplyPayload) => void;
  onDismiss: () => void;
}

const FEASIBILITY_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  straightforward: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 size={10} /> },
  moderate: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <ArrowRight size={10} /> },
  aggressive: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertTriangle size={10} /> },
  heroic: { bg: 'bg-red-100', text: 'text-red-700', icon: <Thermometer size={10} /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'text-emerald-600',
  expense: 'text-red-500',
  capital: 'text-blue-600',
  disposition: 'text-purple-600',
};

const GoalSeekRoadmap: React.FC<GoalSeekRoadmapProps> = ({
  steps,
  currentIRR,
  projectedIRR,
  targetIRR,
  recommendation,
  applyPayload,
  onApply,
  onDismiss,
}) => {
  if (steps.length === 0) return null;

  const sortedSteps = [...steps].sort((a, b) => {
    const order = ['straightforward', 'moderate', 'aggressive', 'heroic'];
    return order.indexOf(a.feasibility) - order.indexOf(b.feasibility);
  });

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Goal-Seeking Roadmap</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-[10px] text-blue-500 hover:text-blue-700 underline"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Target Summary */}
        <div className="flex items-center justify-between mb-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
          <div className="text-center">
            <div className="text-[10px] text-stone-500 uppercase">Current IRR</div>
            <div className="text-lg font-bold font-mono text-stone-700">{(currentIRR * 100).toFixed(1)}%</div>
          </div>
          <ArrowRight size={18} className="text-stone-400" />
          <div className="text-center">
            <div className="text-[10px] text-stone-500 uppercase">Target IRR</div>
            <div className="text-lg font-bold font-mono text-blue-600">{(targetIRR * 100).toFixed(1)}%</div>
          </div>
          <ArrowRight size={18} className="text-stone-400" />
          <div className="text-center">
            <div className="text-[10px] text-stone-500 uppercase">Projected</div>
            <div className="text-lg font-bold font-mono text-emerald-600">{(projectedIRR * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Recommendation */}
        <p className="text-xs text-stone-600 mb-4 italic bg-blue-50 p-2 rounded">{recommendation}</p>

        {/* Steps */}
        <div className="space-y-2 mb-4">
          <h4 className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Adjustment Steps ({sortedSteps.length})
          </h4>
          {sortedSteps.map((step, i) => {
            const fc = FEASIBILITY_COLORS[step.feasibility] || FEASIBILITY_COLORS.moderate;
            const catColor = CATEGORY_COLORS[step.category] || '';
            return (
              <div
                key={step.varId}
                className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${
                  step.locked ? 'bg-stone-50 border-stone-200 opacity-60' : 'bg-white border-stone-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Step Number */}
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* Variable Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold uppercase ${catColor}`}>
                        {step.category}
                      </span>
                      {step.locked && (
                        <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded">locked</span>
                      )}
                    </div>
                    <div className="font-medium text-stone-800 truncate">{step.label}</div>
                    <div className="text-[10px] text-stone-500 font-mono">
                      {(step.currentValue * 100).toFixed(1)}% → {(step.suggestedValue * 100).toFixed(1)}%
                    </div>
                  </div>

                  {/* Delta Bar */}
                  <div className="flex-1 max-w-[120px]">
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          step.irrLiftPp > 0 ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(Math.abs(step.irrLiftPp) * 25, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <div className="text-[9px] text-stone-400">IRR</div>
                    <div className={`text-xs font-mono font-semibold ${
                      step.irrLiftPp > 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {step.irrLiftPp > 0 ? '+' : ''}{step.irrLiftPp.toFixed(1)}pp
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-stone-400">d-Cost</div>
                    <div className="text-xs font-mono text-stone-600">{(step.dCost).toFixed(2)}</div>
                  </div>
                  <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${fc.bg} ${fc.text}`}>
                    {fc.icon}
                    {step.feasibility === 'straightforward' ? 'Easy' :
                     step.feasibility === 'moderate' ? 'Mod' :
                     step.feasibility === 'aggressive' ? 'Agg' : 'Hrd'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply Button */}
        <button
          onClick={() => onApply(applyPayload)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-all"
        >
          <CheckCircle2 size={16} />
          Apply to Proforma ({applyPayload.changed.length} changes)
        </button>
        <p className="text-[9px] text-stone-400 text-center mt-1">
          {applyPayload.changed.length > 0
            ? `Will modify: ${applyPayload.changed.map(c => c.replace('expense:', '')).join(', ')}`
            : 'No changes to apply'}
        </p>
      </div>
    </div>
  );
};

export default GoalSeekRoadmap;
