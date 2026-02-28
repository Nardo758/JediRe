import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/services/api.client';
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2,
  Layers, Target, ArrowRight, RefreshCw, Loader2,
  DollarSign, Activity, Zap, Shield
} from 'lucide-react';

interface DealProps {
  deal?: any;
  dealId?: string;
}

interface ModelScenario {
  id: string;
  name: string;
  source: string;
  assumptions: {
    purchasePrice: number;
    occupancy: number;
    rentGrowth: number;
    expenseRatio: number;
    exitCap: number;
    holdPeriod: number;
    capex: number;
    ltv: number;
    interestRate: number;
    rentPerUnit: number;
    units: number;
    managementFee: number;
  };
  results: {
    irr: number;
    equityMultiple: number;
    cashOnCash: number;
    noi: number;
    netProceeds: number;
    exitValue: number;
    totalEquity: number;
    annualDebtService: number;
    dscr: number;
    yieldOnCost: number;
  };
}

interface SensitivityItem {
  variable: string;
  delta: string;
  irrImpact: number;
  direction: 'positive' | 'negative';
}

interface UpstreamData {
  strategy: any;
  traffic: any;
  proforma: any;
  debt: any;
}

function computeModel(a: ModelScenario['assumptions']): ModelScenario['results'] {
  const grossRevenue = a.rentPerUnit * a.units * 12;
  const egi = grossRevenue * (a.occupancy / 100);
  const opex = egi * (a.expenseRatio / 100);
  const mgmt = egi * (a.managementFee / 100);
  const noi = egi - opex - mgmt;
  const loanAmount = a.purchasePrice * (a.ltv / 100);
  const totalEquity = a.purchasePrice - loanAmount + a.capex;
  const annualDebtService = loanAmount * (a.interestRate / 100) * 1.05;
  const btcf = noi - annualDebtService;
  const cashOnCash = totalEquity > 0 ? (btcf / totalEquity) * 100 : 0;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;

  const exitNoi = noi * Math.pow(1 + a.rentGrowth / 100, a.holdPeriod);
  const exitValue = a.exitCap > 0 ? exitNoi / (a.exitCap / 100) : 0;
  const exitLoanBalance = loanAmount * 0.92;
  const netProceeds = exitValue - exitLoanBalance;

  const totalCashFlows = btcf * a.holdPeriod + netProceeds;
  const equityMultiple = totalEquity > 0 ? totalCashFlows / totalEquity : 0;

  const irrEstimate = totalEquity > 0
    ? (Math.pow(totalCashFlows / totalEquity, 1 / a.holdPeriod) - 1) * 100
    : 0;

  const yieldOnCost = (a.purchasePrice + a.capex) > 0
    ? (noi / (a.purchasePrice + a.capex)) * 100 : 0;

  return {
    irr: Math.round(irrEstimate * 10) / 10,
    equityMultiple: Math.round(equityMultiple * 100) / 100,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    noi: Math.round(noi),
    netProceeds: Math.round(netProceeds),
    exitValue: Math.round(exitValue),
    totalEquity: Math.round(totalEquity),
    annualDebtService: Math.round(annualDebtService),
    dscr: Math.round(dscr * 100) / 100,
    yieldOnCost: Math.round(yieldOnCost * 10) / 10,
  };
}

function buildScenarios(upstream: UpstreamData): ModelScenario[] {
  const strategy = upstream.strategy;
  const traffic = upstream.traffic;
  const proforma = upstream.proforma;
  const debt = upstream.debt;

  const baseAssumptions = {
    purchasePrice: proforma?.purchasePrice || strategy?.capex || 15000000,
    occupancy: traffic?.occupancyY1 || proforma?.occupancy || 93,
    rentGrowth: traffic?.rentGrowthY1 || proforma?.rentGrowth || 3.0,
    expenseRatio: proforma?.expenseRatio || 38,
    exitCap: strategy?.exitCap || proforma?.exitCap || 5.25,
    holdPeriod: strategy?.holdPeriod || proforma?.holdPeriod || 7,
    capex: strategy?.capexBudget || proforma?.capex || 1500000,
    ltv: debt?.ltv || proforma?.ltv || 65,
    interestRate: debt?.interestRate || proforma?.interestRate || 6.5,
    rentPerUnit: traffic?.effRentY1 || proforma?.rentPerUnit || 1800,
    units: proforma?.units || 200,
    managementFee: proforma?.managementFee || 3.5,
  };

  const base: ModelScenario = {
    id: 'base',
    name: 'Base Case',
    source: 'Pro Forma + Strategy + Traffic',
    assumptions: { ...baseAssumptions },
    results: computeModel(baseAssumptions),
  };

  const bestAssumptions = {
    ...baseAssumptions,
    occupancy: Math.min(97, baseAssumptions.occupancy + 2),
    rentGrowth: baseAssumptions.rentGrowth + 1.0,
    exitCap: Math.max(4.0, baseAssumptions.exitCap - 0.5),
    expenseRatio: Math.max(30, baseAssumptions.expenseRatio - 3),
  };
  const best: ModelScenario = {
    id: 'best',
    name: 'Best Case',
    source: 'Optimistic traffic + tight market',
    assumptions: bestAssumptions,
    results: computeModel(bestAssumptions),
  };

  const worstAssumptions = {
    ...baseAssumptions,
    occupancy: Math.max(82, baseAssumptions.occupancy - 4),
    rentGrowth: Math.max(0, baseAssumptions.rentGrowth - 1.5),
    exitCap: baseAssumptions.exitCap + 0.75,
    expenseRatio: Math.min(50, baseAssumptions.expenseRatio + 4),
    interestRate: baseAssumptions.interestRate + 0.5,
  };
  const worst: ModelScenario = {
    id: 'worst',
    name: 'Worst Case',
    source: 'Weak traffic + rate pressure',
    assumptions: worstAssumptions,
    results: computeModel(worstAssumptions),
  };

  const scenarios = [base, best, worst];

  if (strategy?.selectedStrategy && strategy.selectedStrategy !== 'rental') {
    const stratAssumptions = { ...baseAssumptions };
    let stratName = '';
    let stratSource = '';

    if (strategy.selectedStrategy === 'bts' || strategy.selectedStrategy === 'build-to-sell') {
      stratName = 'Build-to-Sell';
      stratSource = 'Strategy Module: BTS path';
      stratAssumptions.holdPeriod = 3;
      stratAssumptions.exitCap = Math.max(4.5, baseAssumptions.exitCap - 0.25);
      stratAssumptions.capex = baseAssumptions.capex * 2;
    } else if (strategy.selectedStrategy === 'flip') {
      stratName = 'Flip / Value-Add';
      stratSource = 'Strategy Module: Quick-turn path';
      stratAssumptions.holdPeriod = 2;
      stratAssumptions.capex = baseAssumptions.capex * 1.5;
      stratAssumptions.exitCap = baseAssumptions.exitCap - 0.5;
    } else if (strategy.selectedStrategy === 'str') {
      stratName = 'Short-Term Rental';
      stratSource = 'Strategy Module: STR path';
      stratAssumptions.rentPerUnit = baseAssumptions.rentPerUnit * 1.4;
      stratAssumptions.expenseRatio = baseAssumptions.expenseRatio + 8;
      stratAssumptions.occupancy = Math.max(75, baseAssumptions.occupancy - 10);
    }

    if (stratName) {
      scenarios.push({
        id: 'strategy',
        name: stratName,
        source: stratSource,
        assumptions: stratAssumptions,
        results: computeModel(stratAssumptions),
      });
    }
  }

  return scenarios;
}

function computeSensitivity(base: ModelScenario): SensitivityItem[] {
  const items: SensitivityItem[] = [];
  const baseIrr = base.results.irr;

  const tests: { variable: string; delta: string; key: keyof ModelScenario['assumptions']; change: number }[] = [
    { variable: 'Occupancy', delta: '-2%', key: 'occupancy', change: -2 },
    { variable: 'Occupancy', delta: '+2%', key: 'occupancy', change: 2 },
    { variable: 'Rent Growth', delta: '-1%', key: 'rentGrowth', change: -1 },
    { variable: 'Rent Growth', delta: '+1%', key: 'rentGrowth', change: 1 },
    { variable: 'Exit Cap', delta: '+50bps', key: 'exitCap', change: 0.5 },
    { variable: 'Exit Cap', delta: '-50bps', key: 'exitCap', change: -0.5 },
    { variable: 'Interest Rate', delta: '+50bps', key: 'interestRate', change: 0.5 },
    { variable: 'Capex', delta: '+25%', key: 'capex', change: base.assumptions.capex * 0.25 },
    { variable: 'Expense Ratio', delta: '+3%', key: 'expenseRatio', change: 3 },
  ];

  for (const t of tests) {
    const adj = { ...base.assumptions, [t.key]: (base.assumptions[t.key] as number) + t.change };
    const result = computeModel(adj);
    const impact = Math.round((result.irr - baseIrr) * 10) / 10;
    items.push({
      variable: t.variable,
      delta: t.delta,
      irrImpact: impact,
      direction: impact >= 0 ? 'positive' : 'negative',
    });
  }

  items.sort((a, b) => Math.abs(b.irrImpact) - Math.abs(a.irrImpact));
  return items;
}

const FinancialDashboard: React.FC<DealProps> = ({ deal, dealId }) => {
  const id = dealId || deal?.id;
  const [loading, setLoading] = useState(true);
  const [upstream, setUpstream] = useState<UpstreamData>({ strategy: null, traffic: null, proforma: null, debt: null });
  const [activeTab, setActiveTab] = useState<'comparison' | 'sensitivity' | 'decision'>('comparison');
  const [highlightScenario, setHighlightScenario] = useState<string>('base');

  useEffect(() => {
    loadUpstreamData();
  }, [id]);

  const loadUpstreamData = async () => {
    setLoading(true);
    try {
      const [stratRes, trafficRes, proformaRes, debtRes] = await Promise.allSettled([
        apiClient.get(`/api/v1/strategy-analyses/${id}`).then(r => r.data),
        apiClient.get(`/api/v1/leasing-traffic/v2/intelligence/${id}`).then(r => r.data),
        apiClient.get(`/api/v1/proforma/${id}`).then(r => r.data),
        apiClient.post(`/api/v1/capital-structure/stack`, { dealId: id }).then(r => r.data).catch(() => null),
      ]);

      const strategy = stratRes.status === 'fulfilled' ? parseStrategy(stratRes.value) : null;
      const traffic = trafficRes.status === 'fulfilled' ? parseTraffic(trafficRes.value) : null;
      const proforma = proformaRes.status === 'fulfilled' ? parseProforma(proformaRes.value) : null;
      const debt = debtRes.status === 'fulfilled' ? parseDebt(debtRes.value) : null;

      setUpstream({ strategy, traffic, proforma, debt });
    } catch (err) {
      console.error('Failed to load upstream data:', err);
    } finally {
      setLoading(false);
    }
  };

  const scenarios = useMemo(() => buildScenarios(upstream), [upstream]);
  const baseScenario = scenarios.find(s => s.id === 'base') || scenarios[0];
  const sensitivity = useMemo(() => baseScenario ? computeSensitivity(baseScenario) : [], [baseScenario]);
  const highlighted = scenarios.find(s => s.id === highlightScenario) || baseScenario;

  const dataSources = [
    { name: 'Strategy', loaded: !!upstream.strategy, icon: Target },
    { name: 'Traffic', loaded: !!upstream.traffic, icon: Activity },
    { name: 'Pro Forma', loaded: !!upstream.proforma, icon: DollarSign },
    { name: 'Debt', loaded: !!upstream.debt, icon: Shield },
  ];
  const liveCount = dataSources.filter(d => d.loaded).length;

  if (loading) {
    return (
      <div className="space-y-5">
        <DashboardHeader />
        <div className="bg-white rounded-xl border border-stone-200 p-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto mb-3" />
          <div className="text-xs text-stone-400">Building financial models from Strategy, Traffic, Pro Forma & Debt...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardHeader />

      <div className="flex items-center gap-3 flex-wrap">
        {dataSources.map(ds => (
          <div key={ds.name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
            ds.loaded ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-400'
          }`}>
            <ds.icon size={12} />
            <span className="font-medium">{ds.name}</span>
            {ds.loaded ? <CheckCircle2 size={10} /> : <span className="text-[9px]">no data</span>}
          </div>
        ))}
        <span className="text-[10px] text-stone-400 ml-auto">{liveCount}/4 modules feeding the model</span>
        <button onClick={loadUpstreamData} className="text-[10px] text-stone-500 hover:text-stone-700 flex items-center gap-1">
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
        {[
          { id: 'comparison' as const, label: 'Model Comparison', icon: BarChart3 },
          { id: 'sensitivity' as const, label: 'Sensitivity Analysis', icon: TrendingUp },
          { id: 'decision' as const, label: 'Decision Summary', icon: Zap },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'comparison' && (
        <ComparisonView scenarios={scenarios} highlighted={highlightScenario} onHighlight={setHighlightScenario} />
      )}
      {activeTab === 'sensitivity' && (
        <SensitivityView items={sensitivity} base={baseScenario} />
      )}
      {activeTab === 'decision' && (
        <DecisionView scenarios={scenarios} upstream={upstream} sensitivity={sensitivity} />
      )}
    </div>
  );
};

const DashboardHeader: React.FC = () => (
  <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-blue-500">
    <div className="text-[10px] font-mono text-blue-400 tracking-widest mb-1">FINANCIAL MODULE DASHBOARD</div>
    <div className="text-lg font-semibold">Strategy + Traffic + Pro Forma + Debt → Model Variations</div>
    <div className="text-xs text-stone-400 mt-1">Auto-builds Base, Best, Worst, and strategy-specific scenarios from all upstream modules</div>
  </div>
);

const ComparisonView: React.FC<{
  scenarios: ModelScenario[];
  highlighted: string;
  onHighlight: (id: string) => void;
}> = ({ scenarios, highlighted, onHighlight }) => {
  const metrics: { key: keyof ModelScenario['results']; label: string; format: (v: number) => string; goodDirection: 'higher' | 'lower' }[] = [
    { key: 'irr', label: 'IRR', format: v => `${v}%`, goodDirection: 'higher' },
    { key: 'equityMultiple', label: 'Equity Multiple', format: v => `${v}x`, goodDirection: 'higher' },
    { key: 'cashOnCash', label: 'Cash-on-Cash', format: v => `${v}%`, goodDirection: 'higher' },
    { key: 'noi', label: 'Year 1 NOI', format: v => `$${(v / 1000).toFixed(0)}K`, goodDirection: 'higher' },
    { key: 'dscr', label: 'DSCR', format: v => `${v}x`, goodDirection: 'higher' },
    { key: 'yieldOnCost', label: 'Yield on Cost', format: v => `${v}%`, goodDirection: 'higher' },
    { key: 'exitValue', label: 'Exit Value', format: v => `$${(v / 1000000).toFixed(1)}M`, goodDirection: 'higher' },
    { key: 'netProceeds', label: 'Net Proceeds', format: v => `$${(v / 1000000).toFixed(1)}M`, goodDirection: 'higher' },
  ];

  const base = scenarios.find(s => s.id === 'base');

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100">
        <h3 className="text-sm font-bold text-stone-900">Side-by-Side Model Comparison</h3>
        <p className="text-[10px] text-stone-400 mt-0.5">{scenarios.length} scenarios generated from upstream data</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-4 py-3 text-stone-500 font-medium w-36">Metric</th>
              {scenarios.map(s => (
                <th key={s.id}
                  onClick={() => onHighlight(s.id)}
                  className={`text-center px-4 py-3 cursor-pointer transition-colors ${
                    highlighted === s.id ? 'bg-blue-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="font-bold text-stone-900">{s.name}</div>
                  <div className="text-[9px] text-stone-400 font-normal mt-0.5">{s.source}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const values = scenarios.map(s => s.results[m.key]);
              const best = m.goodDirection === 'higher' ? Math.max(...values) : Math.min(...values);
              return (
                <tr key={m.key} className="border-b border-stone-50 hover:bg-stone-50/50">
                  <td className="px-4 py-2.5 text-stone-600 font-medium">{m.label}</td>
                  {scenarios.map(s => {
                    const val = s.results[m.key];
                    const isBest = val === best;
                    const baseVal = base ? base.results[m.key] : val;
                    const delta = s.id !== 'base' && baseVal !== 0 ? ((val - baseVal) / Math.abs(baseVal)) * 100 : 0;
                    return (
                      <td key={s.id} className={`text-center px-4 py-2.5 ${highlighted === s.id ? 'bg-blue-50' : ''}`}>
                        <div className={`font-mono font-bold ${isBest ? 'text-emerald-600' : 'text-stone-900'}`}>
                          {m.format(val)}
                        </div>
                        {s.id !== 'base' && delta !== 0 && (
                          <div className={`text-[9px] font-mono ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 bg-stone-50 border-t border-stone-100">
        <div className="text-[10px] text-stone-500">
          <strong>Key Assumptions (Base Case):</strong>{' '}
          {base && `${base.assumptions.occupancy}% occ · ${base.assumptions.rentGrowth}% rent growth · ${base.assumptions.exitCap}% exit cap · ${base.assumptions.ltv}% LTV · ${base.assumptions.interestRate}% rate · ${base.assumptions.holdPeriod}yr hold`}
        </div>
      </div>
    </div>
  );
};

const SensitivityView: React.FC<{ items: SensitivityItem[]; base: ModelScenario }> = ({ items, base }) => {
  const maxImpact = Math.max(...items.map(i => Math.abs(i.irrImpact)), 1);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-stone-900">What Moves IRR the Most?</h3>
        <p className="text-[10px] text-stone-400 mt-0.5">Base IRR: {base.results.irr}% — showing impact of individual variable changes</p>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-32 text-right text-[11px] text-stone-600">
              {item.variable} <span className="text-stone-400">{item.delta}</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-5 bg-stone-50 rounded relative overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
                <div
                  className={`absolute inset-y-0 h-full rounded ${
                    item.direction === 'positive' ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                  style={{
                    left: item.irrImpact >= 0 ? '50%' : `${50 - (Math.abs(item.irrImpact) / maxImpact) * 45}%`,
                    width: `${(Math.abs(item.irrImpact) / maxImpact) * 45}%`,
                  }}
                />
              </div>
              <span className={`text-xs font-mono font-bold w-16 text-right ${
                item.direction === 'positive' ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {item.irrImpact > 0 ? '+' : ''}{item.irrImpact}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-amber-800">
            <strong>Biggest risk factor:</strong> {items[0]?.variable} ({items[0]?.delta}) moves IRR by {items[0]?.irrImpact > 0 ? '+' : ''}{items[0]?.irrImpact}%.
            {items[0]?.direction === 'negative' && ' Monitor this closely and consider hedging strategies.'}
          </div>
        </div>
      </div>
    </div>
  );
};

const DecisionView: React.FC<{
  scenarios: ModelScenario[];
  upstream: UpstreamData;
  sensitivity: SensitivityItem[];
}> = ({ scenarios, upstream, sensitivity }) => {
  const base = scenarios.find(s => s.id === 'base');
  const best = scenarios.find(s => s.id === 'best');
  const worst = scenarios.find(s => s.id === 'worst');
  const stratScenario = scenarios.find(s => s.id === 'strategy');

  if (!base) return null;

  const passesHurdle = base.results.irr >= 12;
  const dscrSafe = base.results.dscr >= 1.25;
  const worstCasePositive = worst && worst.results.irr > 0;
  const bestUpside = best ? best.results.irr - base.results.irr : 0;

  const strategyName = upstream.strategy?.selectedStrategy || 'Rental Value-Add';
  const trafficConfidence = upstream.traffic?.confidence || 0;
  const topRisk = sensitivity[0];

  const verdict = passesHurdle && dscrSafe && worstCasePositive
    ? 'proceed' : passesHurdle && dscrSafe ? 'cautious' : 'review';

  const verdictConfig = {
    proceed: { color: 'emerald', icon: CheckCircle2, label: 'Proceed', desc: 'Deal meets return thresholds across scenarios' },
    cautious: { color: 'amber', icon: AlertTriangle, label: 'Proceed with Caution', desc: 'Base case works but downside risk needs mitigation' },
    review: { color: 'red', icon: AlertTriangle, label: 'Needs Review', desc: 'Returns below target or debt capacity tight' },
  }[verdict];

  return (
    <div className="space-y-4">
      <div className={`bg-${verdictConfig.color === 'emerald' ? 'emerald' : verdictConfig.color === 'amber' ? 'amber' : 'red'}-50 border border-${verdictConfig.color === 'emerald' ? 'emerald' : verdictConfig.color === 'amber' ? 'amber' : 'red'}-200 rounded-xl p-5`}>
        <div className="flex items-start gap-3">
          <verdictConfig.icon size={24} className={`text-${verdictConfig.color === 'emerald' ? 'emerald' : verdictConfig.color === 'amber' ? 'amber' : 'red'}-600 flex-shrink-0`} />
          <div>
            <div className="text-lg font-bold text-stone-900">{verdictConfig.label}</div>
            <div className="text-sm text-stone-600 mt-0.5">{verdictConfig.desc}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-bold text-stone-900 font-mono">{base.results.irr}%</div>
            <div className="text-[10px] text-stone-500">Base Case IRR</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <VerdictCard label="Strategy" value={strategyName} sub={upstream.strategy ? 'from Strategy Module' : 'default'} />
        <VerdictCard label="Traffic Confidence" value={trafficConfidence > 0 ? `${trafficConfidence}%` : 'N/A'} sub={upstream.traffic ? 'from Traffic Module' : 'no traffic data'} />
        <VerdictCard label="DSCR" value={`${base.results.dscr}x`} sub={dscrSafe ? 'above 1.25x threshold' : 'below 1.25x — tight'} color={dscrSafe ? 'emerald' : 'red'} />
        <VerdictCard label="Worst Case IRR" value={`${worst?.results.irr || 0}%`} sub={worstCasePositive ? 'stays positive' : 'negative — high risk'} color={worstCasePositive ? 'emerald' : 'red'} />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="text-sm font-bold text-stone-900 mb-3">Decision Factors</h3>
        <div className="space-y-3">
          <Factor
            pass={passesHurdle}
            label="Return Threshold"
            detail={`Base case IRR of ${base.results.irr}% ${passesHurdle ? 'exceeds' : 'falls below'} the 12% hurdle rate`}
          />
          <Factor
            pass={dscrSafe}
            label="Debt Capacity"
            detail={`DSCR of ${base.results.dscr}x ${dscrSafe ? 'provides adequate coverage' : 'is below the 1.25x minimum'}`}
          />
          <Factor
            pass={!!worstCasePositive}
            label="Downside Protection"
            detail={`Worst case produces ${worst?.results.irr || 0}% IRR — ${worstCasePositive ? 'no capital loss' : 'risk of principal loss'}`}
          />
          <Factor
            pass={bestUpside > 3}
            label="Upside Potential"
            detail={`Best case adds ${bestUpside.toFixed(1)}% IRR above base — ${bestUpside > 3 ? 'meaningful upside' : 'limited upside'}`}
          />
          {topRisk && (
            <Factor
              pass={Math.abs(topRisk.irrImpact) < 3}
              label="Key Risk"
              detail={`${topRisk.variable} (${topRisk.delta}) is the largest swing factor at ${topRisk.irrImpact > 0 ? '+' : ''}${topRisk.irrImpact}% IRR impact`}
            />
          )}
          {stratScenario && (
            <Factor
              pass={stratScenario.results.irr > base.results.irr}
              label="Strategy Variant"
              detail={`${stratScenario.name} produces ${stratScenario.results.irr}% IRR — ${stratScenario.results.irr > base.results.irr ? 'outperforms' : 'underperforms'} the base case by ${Math.abs(stratScenario.results.irr - base.results.irr).toFixed(1)}%`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const VerdictCard: React.FC<{ label: string; value: string; sub: string; color?: string }> = ({ label, value, sub, color = 'stone' }) => (
  <div className="bg-white rounded-xl border border-stone-200 p-4">
    <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-1">{label.toUpperCase()}</div>
    <div className={`text-lg font-bold ${color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-stone-900'}`}>{value}</div>
    <div className="text-[10px] text-stone-500 mt-0.5">{sub}</div>
  </div>
);

const Factor: React.FC<{ pass: boolean; label: string; detail: string }> = ({ pass, label, detail }) => (
  <div className="flex items-start gap-3">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
      pass ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
    }`}>
      {pass ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
    </div>
    <div>
      <div className="text-xs font-semibold text-stone-900">{label}</div>
      <div className="text-[11px] text-stone-500">{detail}</div>
    </div>
  </div>
);

function parseStrategy(data: any): any {
  if (!data) return null;
  const analyses = data.data || data.analyses || data;
  const arr = Array.isArray(analyses) ? analyses : [analyses];
  if (arr.length === 0) return null;
  const latest = arr[arr.length - 1];
  return {
    selectedStrategy: latest?.strategy || latest?.selected_strategy || 'rental',
    holdPeriod: latest?.hold_period || latest?.assumptions?.holdPeriod || 7,
    capexBudget: latest?.capex || latest?.assumptions?.capex || 1500000,
    exitCap: latest?.exit_cap || latest?.assumptions?.exitCap || 5.25,
    riskLevel: latest?.risk_level || 'medium',
  };
}

function parseTraffic(data: any): any {
  if (!data) return null;
  const d = data.data || data;
  const predictions = d?.predictions || d?.rawTraffic || [];
  if (predictions.length === 0) return null;
  return {
    occupancyY1: predictions[0]?.occPct || 93,
    rentGrowthY1: predictions.length > 1
      ? ((predictions[1]?.effRent / predictions[0]?.effRent - 1) * 100) || 3
      : 3,
    effRentY1: predictions[0]?.effRent || 1800,
    confidence: d?.modelConfidence || predictions[0]?.confidence || 0,
  };
}

function parseProforma(data: any): any {
  if (!data) return null;
  const d = data.data || data;
  return {
    purchasePrice: d?.purchase_price || d?.purchasePrice || 15000000,
    occupancy: d?.occupancy || d?.stabilized_occupancy || 93,
    rentGrowth: d?.rent_growth || d?.rentGrowth || 3,
    expenseRatio: d?.expense_ratio || d?.expenseRatio || 38,
    exitCap: d?.exit_cap || d?.exitCap || 5.25,
    holdPeriod: d?.hold_period || d?.holdPeriod || 7,
    capex: d?.capex || 1500000,
    ltv: d?.ltv || 65,
    interestRate: d?.interest_rate || d?.interestRate || 6.5,
    rentPerUnit: d?.rent_per_unit || d?.rentPerUnit || 1800,
    units: d?.units || d?.total_units || 200,
    managementFee: d?.management_fee || d?.managementFee || 3.5,
  };
}

function parseDebt(data: any): any {
  if (!data) return null;
  const d = data.data || data;
  const layers = d?.layers || d?.stack || [];
  const debtLayer = layers.find((l: any) => l.type === 'debt' || l.label?.toLowerCase().includes('debt'));
  return {
    ltv: debtLayer?.ltv || d?.ltv || 65,
    interestRate: debtLayer?.rate || debtLayer?.interestRate || d?.interestRate || 6.5,
    loanAmount: debtLayer?.amount || 0,
    wacc: d?.wacc || d?.weightedCostOfCapital || 0,
  };
}

export default FinancialDashboard;
