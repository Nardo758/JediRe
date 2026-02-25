/**
 * Pro Forma Intelligence Panel (M09 Enhancement)
 *
 * Three-layer assumption model, 10-year income projection, and returns summary.
 * Every assumption shows: Baseline → Platform-Adjusted → User Override
 * with source attribution and confidence indicators.
 *
 * Decision: "Do the numbers work? What assumptions am I betting on?"
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  proFormaAssumptions,
  incomeProjections,
  returnsSummary,
  type ProFormaAssumption,
  type YearProjection,
  type ReturnsSummary,
} from '@/data/enhancedProFormaMockData';
import { useDealModule } from '../../../contexts/DealModuleContext';

interface ProFormaIntelligenceProps {
  deal?: any;
}

export const ProFormaIntelligence: React.FC<ProFormaIntelligenceProps> = () => {
  const [assumptionView, setAssumptionView] = useState<'all' | 'overrides'>('all');
  const { capitalStructure, financial, updateFinancial, emitEvent, lastEvent } = useDealModule();

  // M11+ → M09: When capital structure updates, recalculate cash-flow metrics
  // This resolves the circular dependency: M09 provides NOI, M11+ sizes debt,
  // then M11+ pushes debt service back here so we can calculate IRR/CoC/equity multiple.
  const adjustedReturns = useMemo<ReturnsSummary>(() => {
    if (!capitalStructure || !capitalStructure.annualDebtService) return returnsSummary;
    const noi = returnsSummary.noi;
    const cashFlow = noi - capitalStructure.annualDebtService;
    const totalEquity = capitalStructure.totalEquity || returnsSummary.noi * 5;
    const coc = totalEquity > 0 ? (cashFlow / totalEquity) * 100 : 0;
    return {
      ...returnsSummary,
      dscr: capitalStructure.dscr,
      cashOnCash: parseFloat(coc.toFixed(1)),
    };
  }, [capitalStructure, returnsSummary]);

  // M09 → M11+: Emit financial-updated when NOI changes so Capital Structure can recalc DSCR
  useEffect(() => {
    if (adjustedReturns.noi && financial?.noi !== adjustedReturns.noi) {
      updateFinancial({ noi: adjustedReturns.noi });
      emitEvent({
        source: 'M09-proforma',
        type: 'financial-updated',
        payload: {
          noi: adjustedReturns.noi,
          irr: adjustedReturns.irr,
          equityMultiple: adjustedReturns.equityMultiple,
          cashOnCash: adjustedReturns.cashOnCash,
        },
      });
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* Decision Banner */}
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">Do the numbers work? What assumptions am I betting on?</div>
      </div>

      {/* 3-Layer Assumption Panel */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-stone-900">Assumption Panel (3-Layer)</h3>
          <div className="flex items-center gap-2">
            <button
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                assumptionView === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
              onClick={() => setAssumptionView('all')}
            >
              All
            </button>
            <button
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                assumptionView === 'overrides' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
              onClick={() => setAssumptionView('overrides')}
            >
              Overrides Only
            </button>
          </div>
        </div>
        <p className="text-xs text-stone-500 mb-4">
          Every assumption shows its source. Black = formula, blue = platform-adjusted, purple = your override.
        </p>

        <div className="border border-stone-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 bg-stone-50 text-[10px] font-mono text-stone-400 tracking-wider border-b border-stone-200">
            <div className="col-span-2 px-3 py-2">ASSUMPTION</div>
            <div className="col-span-2 px-3 py-2">BASELINE</div>
            <div className="col-span-3 px-3 py-2">PLATFORM ADJUSTED</div>
            <div className="col-span-3 px-3 py-2">USER OVERRIDE</div>
            <div className="col-span-2 px-3 py-2 text-right">EFFECTIVE</div>
          </div>

          {/* Rows */}
          {proFormaAssumptions
            .filter(a => assumptionView === 'all' || a.userOverride !== null)
            .map((assumption) => (
            <AssumptionRow key={assumption.id} assumption={assumption} />
          ))}
        </div>

        {/* Insight */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Platform sees 0.9% rent growth upside vs historical because of the Amazon demand event.
            Your override of 3.5% rent growth is 60bps below platform — are you being too conservative?
            Toggle &ldquo;Use Platform&rdquo; to see the impact on IRR.
          </p>
        </div>
      </div>

      {/* 10-Year Income Statement */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-lg font-bold text-stone-900 mb-1">Income Statement (10-Year)</h3>
        <p className="text-xs text-stone-500 mb-4">NOI projection from current assumptions. All figures in $000s.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-stone-200 text-[10px] font-mono text-stone-400">
                <th className="text-left py-2 px-2 sticky left-0 bg-white">Metric</th>
                {incomeProjections.map(p => (
                  <th key={p.year} className="text-right py-2 px-2 min-w-[80px]">Y{p.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <IncomeRow label="Gross Rent" values={incomeProjections.map(p => p.grossRent)} color="text-stone-900" />
              <IncomeRow label="Vacancy" values={incomeProjections.map(p => -p.vacancy)} color="text-red-500" />
              <IncomeRow label="EGI" values={incomeProjections.map(p => p.effectiveGrossIncome)} color="text-stone-900" bold />
              <IncomeRow label="OpEx" values={incomeProjections.map(p => -p.opex)} color="text-red-500" />
              <IncomeRow label="NOI" values={incomeProjections.map(p => p.noi)} color="text-emerald-700" bold />
              <IncomeRow label="Debt Service" values={incomeProjections.map(p => -p.debtService)} color="text-blue-600" />
              <IncomeRow label="Cash Flow" values={incomeProjections.map(p => p.cashFlowAfterDebt)} color="text-emerald-700" bold />
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns Summary */}
      <ReturnsSummaryCard summary={returnsSummary} />
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

const AssumptionRow: React.FC<{ assumption: ProFormaAssumption }> = ({ assumption }) => {
  const formatVal = (val: number | null, format: string): string => {
    if (val === null) return '--';
    if (format === 'currency') return `$${(val / 1000000).toFixed(1)}M`;
    if (format === 'percentage') return `${val}%`;
    return val.toString();
  };

  return (
    <div className={`grid grid-cols-12 border-b border-stone-100 hover:bg-stone-50 transition-colors ${
      assumption.deviationWarning ? 'bg-yellow-50/50' : ''
    }`}>
      {/* Label */}
      <div className="col-span-2 px-3 py-2.5 text-xs font-medium text-stone-700 flex items-center gap-1">
        {assumption.deviationWarning && <span className="text-amber-500 text-sm">!</span>}
        {assumption.label}
      </div>
      {/* Baseline */}
      <div className="col-span-2 px-3 py-2.5">
        <div className="text-xs font-mono text-stone-900">{formatVal(assumption.baseline, assumption.format)}</div>
        <div className="text-[9px] text-stone-400 leading-tight mt-0.5">{assumption.baselineSource}</div>
      </div>
      {/* Platform Adjusted */}
      <div className="col-span-3 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-blue-700">{formatVal(assumption.platformAdjusted, assumption.format)}</span>
          {assumption.platformDelta !== 0 && (
            <span className={`text-[9px] font-mono ${assumption.platformDelta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              ({assumption.platformDelta > 0 ? '+' : ''}{assumption.platformDelta}{assumption.unit})
            </span>
          )}
        </div>
        <div className="text-[9px] text-blue-500 leading-tight mt-0.5">{assumption.platformReason}</div>
      </div>
      {/* User Override */}
      <div className="col-span-3 px-3 py-2.5">
        {assumption.userOverride !== null ? (
          <>
            <div className="text-xs font-mono text-violet-700 font-semibold">
              {formatVal(assumption.userOverride, assumption.format)}
            </div>
            <div className="text-[9px] text-violet-500 leading-tight mt-0.5">{assumption.overrideReason}</div>
          </>
        ) : (
          <div className="text-[9px] text-stone-300 font-mono">Using platform value</div>
        )}
      </div>
      {/* Effective */}
      <div className="col-span-2 px-3 py-2.5 text-right">
        <div className="text-xs font-bold text-stone-900">{formatVal(assumption.effective, assumption.format)}</div>
      </div>
    </div>
  );
};

const IncomeRow: React.FC<{
  label: string;
  values: number[];
  color: string;
  bold?: boolean;
}> = ({ label, values, color, bold }) => (
  <tr className={`border-b border-stone-100 ${bold ? 'font-bold' : ''}`}>
    <td className={`py-1.5 px-2 sticky left-0 bg-white text-stone-700 ${bold ? 'font-semibold' : ''}`}>{label}</td>
    {values.map((v, i) => (
      <td key={i} className={`py-1.5 px-2 text-right font-mono ${color}`}>
        {v < 0 ? `(${(Math.abs(v) / 1000).toFixed(0)})` : (v / 1000).toFixed(0)}
      </td>
    ))}
  </tr>
);

const ReturnsSummaryCard: React.FC<{ summary: ReturnsSummary }> = ({ summary }) => (
  <div className="bg-white rounded-xl border border-stone-200 p-6">
    <h3 className="text-lg font-bold text-stone-900 mb-4">Returns Summary</h3>

    <div className="grid grid-cols-5 gap-4 mb-5">
      <MetricCell label="IRR" value={`${summary.irr}%`} color="text-emerald-700" />
      <MetricCell label="Equity Multiple" value={`${summary.equityMultiple}x`} color="text-emerald-700" />
      <MetricCell label="Cash-on-Cash (Y1)" value={`${summary.cashOnCash_y1}%`} color="text-blue-700" />
      <MetricCell label="DSCR (Min)" value={`${summary.dscrMin}x`} subtext={`Year ${summary.dscrMinYear}`} color={summary.dscrMin < 1.25 ? 'text-red-600' : 'text-amber-600'} />
      <MetricCell label="Prob-Weighted IRR" value={`${summary.probWeightedIRR}%`} subtext="Risk-adjusted" color="text-violet-700" />
    </div>

    {/* Hurdle Check */}
    <div className={`rounded-lg p-4 border ${
      summary.meetsHurdle ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-sm font-bold ${summary.meetsHurdle ? 'text-emerald-800' : 'text-red-800'}`}>
            {summary.meetsHurdle ? 'Meets Hurdle Rate' : 'Below Hurdle Rate'}
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Base case IRR is {summary.irr}%, but probability-weighted drops to {summary.probWeightedIRR}%
            because Bear scenario has 25% probability. The {summary.riskPremium}% gap IS your risk premium.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-stone-400">Hurdle: {summary.hurdleRate}%</div>
          <div className={`text-2xl font-bold ${summary.meetsHurdle ? 'text-emerald-600' : 'text-red-600'}`}>
            {summary.meetsHurdle ? '+' : ''}{(summary.probWeightedIRR - summary.hurdleRate).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MetricCell: React.FC<{
  label: string;
  value: string;
  color: string;
  subtext?: string;
}> = ({ label, value, color, subtext }) => (
  <div className="text-center">
    <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    {subtext && <div className="text-[9px] text-stone-400 mt-0.5">{subtext}</div>}
  </div>
);

export default ProFormaIntelligence;
