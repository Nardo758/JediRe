import React, { useState, useEffect, useMemo } from 'react';
import { propertyMetricsService } from '@/services/propertyMetrics.service';
import type { MarketSummary, NeighborhoodBenchmark } from '@/services/propertyMetrics.service';
import { propertyScoringService } from '@/services/propertyScoring.service';
import type { CapRateEstimate } from '@/services/propertyScoring.service';

interface FinancialModelingSectionProps {
  deal?: any;
  dealId?: string;
}

interface FinancialInputs {
  rentPerSf: number;
  avgUnitSize: number;
  occupancyPct: number;
  concessionPct: number;
  opexRatio: number;
  capRate: number;
  purchasePricePerUnit: number;
  capexPerUnit: number;
  rentGrowthPct: number;
  holdYears: number;
  exitCapRate: number;
  ltvPct: number;
  debtRate: number;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const fmtPct = (val: number) => `${val.toFixed(1)}%`;

export const FinancialModelingSection: React.FC<FinancialModelingSectionProps> = ({ deal }) => {
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [benchmarks, setBenchmarks] = useState<NeighborhoodBenchmark[]>([]);
  const [capRates, setCapRates] = useState<CapRateEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inputs, setInputs] = useState<FinancialInputs>({
    rentPerSf: 3.80,
    avgUnitSize: 850,
    occupancyPct: 93,
    concessionPct: 2.0,
    opexRatio: 45,
    capRate: 5.5,
    purchasePricePerUnit: 140000,
    capexPerUnit: 15000,
    rentGrowthPct: 3.0,
    holdYears: 5,
    exitCapRate: 5.75,
    ltvPct: 70,
    debtRate: 6.5,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summary, bmarks, caps] = await Promise.all([
          propertyMetricsService.getMarketSummary().catch(() => null),
          propertyMetricsService.getNeighborhoodBenchmarks().catch(() => []),
          propertyScoringService.getCapRateEstimates().catch(() => []),
        ]);
        setMarketSummary(summary);
        setBenchmarks(bmarks);
        setCapRates(caps);

        if (summary || bmarks.length > 0 || caps.length > 0) {
          setInputs(prev => {
            const updated = { ...prev };
            if (summary) {
              updated.rentPerSf = Number(summary.avgRentPerSf.toFixed(2));
              updated.avgUnitSize = Math.round(summary.avgUnitSize);
              updated.occupancyPct = Number(summary.avgOccupancy.toFixed(1));
              updated.concessionPct = Number(summary.avgConcession.toFixed(1));
            }
            if (bmarks.length > 0) {
              const avgPerUnit = bmarks.reduce((s, b) => s + (b.avgPerUnit || 0), 0) / bmarks.filter(b => b.avgPerUnit != null).length;
              if (avgPerUnit > 0) updated.purchasePricePerUnit = Math.round(avgPerUnit);
            }
            if (caps.length > 0) {
              const avgCap = caps.reduce((s, c) => s + c.impliedCapRate, 0) / caps.length;
              if (avgCap > 0) {
                updated.capRate = Number(avgCap.toFixed(2));
                updated.exitCapRate = Number((avgCap + 0.25).toFixed(2));
              }
            }
            return updated;
          });
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load financial data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const dealUnits = deal?.units || 250;

  const proForma = useMemo(() => {
    const { rentPerSf, avgUnitSize, occupancyPct, concessionPct, opexRatio, capRate, purchasePricePerUnit, capexPerUnit, rentGrowthPct, holdYears, exitCapRate, ltvPct, debtRate } = inputs;

    const grossRentPerUnit = rentPerSf * avgUnitSize * 12;
    const effectiveRentPerUnit = grossRentPerUnit * (occupancyPct / 100) * (1 - concessionPct / 100);
    const egi = effectiveRentPerUnit * dealUnits;
    const opex = egi * (opexRatio / 100);
    const noi = egi - opex;
    const noiPerUnit = noi / dealUnits;

    const purchasePrice = purchasePricePerUnit * dealUnits;
    const totalCapex = capexPerUnit * dealUnits;
    const totalCost = purchasePrice + totalCapex;
    const debtAmount = purchasePrice * (ltvPct / 100);
    const equityRequired = totalCost - debtAmount;
    const annualDebtService = debtAmount * (debtRate / 100);

    const cashFlowYear1 = noi - annualDebtService;
    const cashOnCash = equityRequired > 0 ? (cashFlowYear1 / equityRequired) * 100 : 0;

    const exitNoi = noi * Math.pow(1 + rentGrowthPct / 100, holdYears);
    const exitValue = exitCapRate > 0 ? exitNoi / (exitCapRate / 100) : 0;
    const exitEquity = exitValue - debtAmount;
    const totalProfit = exitEquity - equityRequired + (cashFlowYear1 * holdYears);
    const equityMultiple = equityRequired > 0 ? (equityRequired + totalProfit) / equityRequired : 0;

    const irrEstimate = equityRequired > 0 ? (Math.pow(equityMultiple, 1 / holdYears) - 1) * 100 : 0;
    const goingInCap = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;

    return {
      grossRentPerUnit, effectiveRentPerUnit, egi, opex, noi, noiPerUnit,
      purchasePrice, totalCapex, totalCost, debtAmount, equityRequired,
      annualDebtService, cashFlowYear1, cashOnCash, exitNoi, exitValue,
      exitEquity, totalProfit, equityMultiple, irrEstimate, goingInCap,
    };
  }, [inputs, dealUnits]);

  const updateInput = (key: keyof FinancialInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading market data into financial model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="Going-In Cap" value={fmtPct(proForma.goingInCap)} color="blue" />
        <MetricCard label="Est. IRR" value={fmtPct(proForma.irrEstimate)} color="green" />
        <MetricCard label="Cash-on-Cash" value={fmtPct(proForma.cashOnCash)} color="purple" />
        <MetricCard label="Equity Multiple" value={`${proForma.equityMultiple.toFixed(2)}x`} color="amber" />
        <MetricCard label="NOI" value={fmtCurrency(proForma.noi)} color="teal" />
        <MetricCard label="Exit Value" value={fmtCurrency(proForma.exitValue)} color="indigo" />
      </div>

      {marketSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-700 font-semibold text-sm">Auto-Populated from Market Data</span>
          </div>
          <p className="text-xs text-blue-600">
            Rent/SF, occupancy, concession, and unit size pre-filled from {marketSummary.propertyCount} rent comps.
            Cap rate from {capRates.length} neighborhood estimates. Purchase price from {benchmarks.length} submarket benchmarks.
            Adjust any input below to refine.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Assumptions</h3>
          <div className="space-y-3">
            <InputRow label="Market Rent/SF" value={inputs.rentPerSf} onChange={v => updateInput('rentPerSf', v)} prefix="$" step={0.05} source="Rent Comps" />
            <InputRow label="Avg Unit Size (SF)" value={inputs.avgUnitSize} onChange={v => updateInput('avgUnitSize', v)} step={25} source="Rent Comps" />
            <InputRow label="Occupancy %" value={inputs.occupancyPct} onChange={v => updateInput('occupancyPct', v)} suffix="%" step={0.5} source="Rent Comps" />
            <InputRow label="Concession %" value={inputs.concessionPct} onChange={v => updateInput('concessionPct', v)} suffix="%" step={0.5} source="Rent Comps" />
            <InputRow label="Rent Growth/Yr" value={inputs.rentGrowthPct} onChange={v => updateInput('rentGrowthPct', v)} suffix="%" step={0.25} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase & Capital</h3>
          <div className="space-y-3">
            <InputRow label="Purchase Price/Unit" value={inputs.purchasePricePerUnit} onChange={v => updateInput('purchasePricePerUnit', v)} prefix="$" step={5000} source="Atlanta Benchmarks" />
            <InputRow label="Capex/Unit" value={inputs.capexPerUnit} onChange={v => updateInput('capexPerUnit', v)} prefix="$" step={1000} />
            <InputRow label="Going-In Cap Rate" value={inputs.capRate} onChange={v => updateInput('capRate', v)} suffix="%" step={0.25} source="Cap Rate Engine" />
            <InputRow label="LTV %" value={inputs.ltvPct} onChange={v => updateInput('ltvPct', v)} suffix="%" step={5} />
            <InputRow label="Debt Rate" value={inputs.debtRate} onChange={v => updateInput('debtRate', v)} suffix="%" step={0.25} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Operating Pro Forma ({dealUnits} units)</h3>
          <div className="space-y-2 text-sm">
            <ProFormaRow label="Gross Rent/Unit" value={fmtCurrency(proForma.grossRentPerUnit)} />
            <ProFormaRow label="Effective Rent/Unit" value={fmtCurrency(proForma.effectiveRentPerUnit)} />
            <ProFormaRow label="Effective Gross Income" value={fmtCurrency(proForma.egi)} bold />
            <ProFormaRow label={`Operating Expenses (${inputs.opexRatio}%)`} value={`(${fmtCurrency(proForma.opex)})`} red />
            <div className="border-t border-gray-300 pt-2 mt-2">
              <ProFormaRow label="Net Operating Income" value={fmtCurrency(proForma.noi)} bold green />
            </div>
            <ProFormaRow label="NOI/Unit" value={fmtCurrency(proForma.noiPerUnit)} />
            <ProFormaRow label="Annual Debt Service" value={`(${fmtCurrency(proForma.annualDebtService)})`} red />
            <div className="border-t border-gray-300 pt-2 mt-2">
              <ProFormaRow label="Cash Flow (Year 1)" value={fmtCurrency(proForma.cashFlowYear1)} bold green />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Capital Stack & Exit</h3>
          <div className="space-y-2 text-sm">
            <ProFormaRow label="Purchase Price" value={fmtCurrency(proForma.purchasePrice)} />
            <ProFormaRow label="Total Capex" value={fmtCurrency(proForma.totalCapex)} />
            <ProFormaRow label="Total Cost Basis" value={fmtCurrency(proForma.totalCost)} bold />
            <ProFormaRow label={`Debt (${inputs.ltvPct}% LTV)`} value={fmtCurrency(proForma.debtAmount)} />
            <ProFormaRow label="Equity Required" value={fmtCurrency(proForma.equityRequired)} bold />
            <div className="border-t border-gray-300 pt-2 mt-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Exit ({inputs.holdYears}-Year Hold)</h4>
              <InputRow label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => updateInput('exitCapRate', v)} suffix="%" step={0.25} />
              <InputRow label="Hold Period (Years)" value={inputs.holdYears} onChange={v => updateInput('holdYears', v)} step={1} />
            </div>
            <ProFormaRow label="Exit NOI" value={fmtCurrency(proForma.exitNoi)} />
            <ProFormaRow label="Exit Value" value={fmtCurrency(proForma.exitValue)} bold green />
            <ProFormaRow label="Exit Equity (after debt)" value={fmtCurrency(proForma.exitEquity)} />
            <ProFormaRow label="Total Profit" value={fmtCurrency(proForma.totalProfit)} bold green />
          </div>
        </div>
      </div>

      {capRates.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Neighborhood Cap Rate Comparison</h3>
          <p className="text-xs text-gray-500 mb-4">Implied cap rates from assessed values — use to validate your assumptions</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {capRates.slice(0, 12).map((cr, idx) => (
              <div key={idx} className={`rounded-lg p-3 text-center ${cr.tier === 'premium' ? 'bg-purple-50' : cr.tier === 'value' ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="text-xs text-gray-600 mb-1 truncate" title={cr.neighborhoodCode}>{cr.neighborhoodCode}</div>
                <div className="text-lg font-bold text-gray-900">{cr.impliedCapRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">{cr.totalUnits.toLocaleString()} units</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className={`bg-${color}-50 rounded-lg border border-${color}-200 p-4`}>
    <p className={`text-xs font-medium text-${color}-600 uppercase tracking-wide`}>{label}</p>
    <p className={`text-2xl font-bold text-${color}-900 mt-1`}>{value}</p>
  </div>
);

const InputRow: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  source?: string;
}> = ({ label, value, onChange, prefix, suffix, step = 1, source }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex-1">
      <span className="text-sm text-gray-700">{label}</span>
      {source && <span className="ml-1 text-xs text-blue-500 font-medium">({source})</span>}
    </div>
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        step={step}
        className="w-24 text-right text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  </div>
);

const ProFormaRow: React.FC<{
  label: string;
  value: string;
  bold?: boolean;
  green?: boolean;
  red?: boolean;
}> = ({ label, value, bold, green, red }) => (
  <div className="flex items-center justify-between">
    <span className={`text-gray-${bold ? '900' : '600'} ${bold ? 'font-semibold' : ''}`}>{label}</span>
    <span className={`${bold ? 'font-bold' : 'font-medium'} ${green ? 'text-green-700' : red ? 'text-red-600' : 'text-gray-900'}`}>
      {value}
    </span>
  </div>
);

export default FinancialModelingSection;
