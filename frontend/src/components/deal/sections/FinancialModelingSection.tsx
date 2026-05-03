import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.client';

interface FinancialModelingSectionProps {
  deal?: any;
  dealId?: string;
}

interface Assumption {
  key: string;
  label: string;
  value: number;
  unit: '%' | '$' | 'x' | 'yrs' | 'bps';
}

interface ScenarioResults {
  irr: number;
  equityMultiple: number;
  cashOnCash: number;
  noi: number;
  capRate: number;
  netProceeds: number;
}

interface Scenario {
  id: string;
  name: string;
  assumptions: Assumption[];
  results: ScenarioResults;
}

const defaultAssumptions: Assumption[] = [
  { key: 'purchase_price', label: 'Purchase Price', value: 15000000, unit: '$' },
  { key: 'occupancy', label: 'Stabilized Occupancy', value: 92, unit: '%' },
  { key: 'rent_growth', label: 'Annual Rent Growth', value: 3.0, unit: '%' },
  { key: 'expense_ratio', label: 'Expense Ratio', value: 42, unit: '%' },
  { key: 'exit_cap', label: 'Exit Cap Rate', value: 5.25, unit: '%' },
  { key: 'hold_period', label: 'Hold Period', value: 5, unit: 'yrs' },
  { key: 'ltv', label: 'Loan-to-Value', value: 70, unit: '%' },
  { key: 'interest_rate', label: 'Interest Rate', value: 6.5, unit: '%' },
];

function computeResults(assumptions: Assumption[]): ScenarioResults {
  const get = (key: string) => assumptions.find(a => a.key === key)?.value || 0;
  const price = get('purchase_price');
  const occ = get('occupancy') / 100;
  const rentGrowth = get('rent_growth') / 100;
  const expRatio = get('expense_ratio') / 100;
  const exitCap = get('exit_cap') / 100;
  const hold = get('hold_period');
  const ltv = get('ltv') / 100;
  const rate = get('interest_rate') / 100;

  const grossRev = price * 0.08;
  const egi = grossRev * occ;
  const noi = egi * (1 - expRatio);
  const capRate = price > 0 ? noi / price : 0;

  const debt = price * ltv;
  const equity = price - debt;
  const annualDS = debt * (rate + 0.02);
  const cashFlow = noi - annualDS;
  const cashOnCash = equity > 0 ? (cashFlow / equity) * 100 : 0;

  const exitNoi = noi * Math.pow(1 + rentGrowth, hold);
  const exitValue = exitCap > 0 ? exitNoi / exitCap : 0;
  const netProceeds = exitValue - debt;

  const totalReturn = (cashFlow * hold) + netProceeds - equity;
  const avgAnnual = hold > 0 ? totalReturn / hold : 0;
  const irr = equity > 0 ? (avgAnnual / equity) * 100 : 0;
  const em = equity > 0 ? ((cashFlow * hold) + netProceeds) / equity : 0;

  return {
    irr: Math.round(irr * 100) / 100,
    equityMultiple: Math.round(em * 100) / 100,
    cashOnCash: Math.round(cashOnCash * 100) / 100,
    noi: Math.round(noi),
    capRate: Math.round(capRate * 10000) / 100,
    netProceeds: Math.round(netProceeds),
  };
}

function createScenario(name: string, modifiers: Record<string, number> = {}): Scenario {
  const assumptions = defaultAssumptions.map(a => ({
    ...a,
    value: modifiers[a.key] !== undefined ? modifiers[a.key] : a.value,
  }));
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    assumptions,
    results: computeResults(assumptions),
  };
}

const defaultScenarios: Scenario[] = [
  createScenario('Base Case'),
  createScenario('Best Case', { occupancy: 95, rent_growth: 4.0, exit_cap: 4.75 }),
  createScenario('Worst Case', { occupancy: 85, rent_growth: 1.5, exit_cap: 6.0, interest_rate: 7.5 }),
];

export const FinancialModelingSection: React.FC<FinancialModelingSectionProps> = ({ deal, dealId }) => {
  const id = deal?.id || dealId;
  const [scenarios, setScenarios] = useState<Scenario[]>(defaultScenarios);
  const [activeScenario, setActiveScenario] = useState<string>('base-case');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    loadModel();
  }, [id]);

  const loadModel = async () => {
    try {
      const response = await apiClient.get(`/api/v1/financial-models/${id}`);
      if (response.data?.success && response.data?.data) {
        const model = response.data.data;
        const saved = model.components || model.assumptions?.scenarios;
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setScenarios(saved.map((s: any) => ({
            ...s,
            results: computeResults(s.assumptions || defaultAssumptions),
          })));
          setIsLiveData(true);
        }
      }
    } catch {
      console.warn('No saved financial model, using defaults');
    } finally {
      setLoading(false);
    }
  };

  const saveModel = useCallback(async (updatedScenarios: Scenario[]) => {
    if (!id) return;
    setSaving(true);
    try {
      await apiClient.post('/api/v1/financial-models', {
        dealId: id,
        name: 'Financial Model',
        version: 1,
        components: updatedScenarios,
        assumptions: { scenarios: updatedScenarios.map(s => s.name) },
        results: Object.fromEntries(updatedScenarios.map(s => [s.id, s.results])),
      });
      setIsLiveData(true);
    } catch (err) {
      console.error('Failed to save financial model:', err);
    } finally {
      setSaving(false);
    }
  }, [id]);

  const updateAssumption = (scenarioId: string, key: string, value: number) => {
    const updated = scenarios.map(s => {
      if (s.id !== scenarioId) return s;
      const newAssumptions = s.assumptions.map(a => a.key === key ? { ...a, value } : a);
      return { ...s, assumptions: newAssumptions, results: computeResults(newAssumptions) };
    });
    setScenarios(updated);
    saveModel(updated);
  };

  const current = scenarios.find(s => s.id === activeScenario) || scenarios[0];

  const sensitivityData = [
    { label: 'Occupancy -2%', key: 'occupancy', delta: -2, impact: 0 },
    { label: 'Rent Growth +1%', key: 'rent_growth', delta: 1, impact: 0 },
    { label: 'Exit Cap +25bps', key: 'exit_cap', delta: 0.25, impact: 0 },
    { label: 'Interest Rate +50bps', key: 'interest_rate', delta: 0.5, impact: 0 },
  ].map(item => {
    const modified = current.assumptions.map(a => a.key === item.key ? { ...a, value: a.value + item.delta } : a);
    const modResults = computeResults(modified);
    return { ...item, impact: Math.round((modResults.irr - current.results.irr) * 100) / 100 };
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-48 mx-auto mb-3"></div>
            <div className="text-xs text-stone-400">Loading financial model...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Financial Modeling</h2>
          <p className="text-sm text-stone-500">Scenario analysis and sensitivity testing</p>
        </div>
        <div className="flex items-center gap-2">
          {isLiveData && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">SAVED</span>
          )}
          {saving && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">SAVING...</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveScenario(s.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeScenario === s.id
                ? 'bg-stone-900 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {scenarios.map(s => {
          const isActive = s.id === activeScenario;
          return (
            <div key={s.id} className={`bg-white rounded-xl border p-5 ${isActive ? 'border-stone-400 ring-1 ring-stone-300' : 'border-stone-200'}`}>
              <div className="text-sm font-semibold text-stone-900 mb-3">{s.name}</div>
              <div className="space-y-2">
                <ResultRow label="IRR" value={`${s.results.irr.toFixed(1)}%`} good={s.results.irr > 15} />
                <ResultRow label="Equity Multiple" value={`${s.results.equityMultiple.toFixed(2)}x`} good={s.results.equityMultiple > 1.5} />
                <ResultRow label="Cash-on-Cash" value={`${s.results.cashOnCash.toFixed(1)}%`} good={s.results.cashOnCash > 8} />
                <ResultRow label="NOI" value={`$${(s.results.noi / 1000).toFixed(0)}K`} />
                <ResultRow label="Going-In Cap" value={`${s.results.capRate.toFixed(2)}%`} />
                <ResultRow label="Net Proceeds" value={`$${(s.results.netProceeds / 1000000).toFixed(1)}M`} good={s.results.netProceeds > 0} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-semibold text-stone-900 mb-4">
          Assumptions — {current.name}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {current.assumptions.map(a => (
            <div key={a.key} className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-xs text-stone-600">{a.label}</span>
              {editingKey === `${current.id}-${a.key}` ? (
                <input
                  type="number"
                  step={a.unit === '$' ? 100000 : 0.1}
                  defaultValue={a.value}
                  autoFocus
                  className="w-32 text-right text-xs font-mono border border-stone-300 rounded px-2 py-1"
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) updateAssumption(current.id, a.key, val);
                    setEditingKey(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                />
              ) : (
                <button
                  onClick={() => setEditingKey(`${current.id}-${a.key}`)}
                  className="text-xs font-mono font-semibold text-stone-900 hover:text-blue-600 cursor-pointer"
                >
                  {a.unit === '$' ? `$${a.value.toLocaleString()}` : `${a.value}${a.unit}`}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-400 mt-3">Click any value to edit. Changes auto-save and recompute returns.</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h3 className="text-sm font-semibold text-stone-900 mb-4">Sensitivity Analysis</h3>
        <div className="space-y-3">
          {sensitivityData.map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-xs text-stone-600 w-40">{item.label}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-stone-100 rounded-full h-2 relative">
                  <div
                    className={`h-2 rounded-full absolute ${item.impact >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{
                      width: `${Math.min(Math.abs(item.impact) * 10, 100)}%`,
                      left: item.impact >= 0 ? '50%' : `${50 - Math.min(Math.abs(item.impact) * 10, 50)}%`,
                    }}
                  />
                  <div className="absolute left-1/2 top-0 w-px h-2 bg-stone-400" />
                </div>
                <span className={`text-xs font-mono font-bold w-16 text-right ${
                  item.impact >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {item.impact >= 0 ? '+' : ''}{item.impact.toFixed(1)}% IRR
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Exit cap rate has the largest downside impact. A 25bps widening reduces IRR by {Math.abs(sensitivityData[2]?.impact || 0).toFixed(1)} points.
            Rent growth has the strongest upside lever.
          </p>
        </div>
      </div>
    </div>
  );
};

const ResultRow: React.FC<{ label: string; value: string; good?: boolean }> = ({ label, value, good }) => (
  <div className="flex justify-between items-center">
    <span className="text-[11px] text-stone-500">{label}</span>
    <span className={`text-xs font-mono font-bold ${
      good === undefined ? 'text-stone-900' : good ? 'text-emerald-600' : 'text-red-500'
    }`}>{value}</span>
  </div>
);

export default FinancialModelingSection;
