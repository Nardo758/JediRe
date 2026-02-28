import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, TrendingUp, BarChart3, Edit3, RotateCcw,
  ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, Info,
} from 'lucide-react';
import { Deal } from '@/types';
import { apiClient } from '@/services/api.client';

interface AssumptionRow {
  id: string;
  label: string;
  category: 'revenue' | 'expense' | 'capital' | 'exit';
  unit: '%' | '$' | 'yrs' | 'units';
  perYear: boolean;
  dataRecommendation: {
    values: number[];
    source: string;
    confidence: number;
    module: string | null;
  };
  userOverride: {
    values: (number | null)[];
    active: boolean;
  };
}

interface ProFormaYear {
  year: number;
  gpr: number;
  vacancyLoss: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  btcf: number;
  capRate: string;
}

interface ProFormaTabProps {
  deal?: Deal;
  dealId?: string;
}

const DEFAULT_UNITS = 200;
const DEFAULT_ACQ_PRICE = 30_000_000;
const DEFAULT_BASE_RENT = 1650;
const DEFAULT_DEBT_SERVICE = 1_800_000;

function fmt$(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtNum(n: number, unit: string): string {
  if (unit === '$') return fmt$(n);
  if (unit === '%') return `${n.toFixed(1)}%`;
  if (unit === 'yrs') return `${n}`;
  return `${n}`;
}

function buildDefaultAssumptions(): AssumptionRow[] {
  return [
    {
      id: 'purchasePrice', label: 'Purchase Price', category: 'capital', unit: '$', perYear: false,
      dataRecommendation: { values: [DEFAULT_ACQ_PRICE], source: 'Deal input / Comp analysis', confidence: 85, module: null },
      userOverride: { values: [null], active: false },
    },
    {
      id: 'occupancyRate', label: 'Occupancy Rate', category: 'revenue', unit: '%', perYear: true,
      dataRecommendation: {
        values: [93.5, 94.0, 94.5, 94.8, 95.0, 95.0, 94.8, 94.5, 94.2, 94.0],
        source: 'Traffic Module occupancy trajectory', confidence: 88, module: 'Traffic',
      },
      userOverride: { values: Array(10).fill(null), active: false },
    },
    {
      id: 'rentGrowth', label: 'Rent Growth', category: 'revenue', unit: '%', perYear: true,
      dataRecommendation: {
        values: [3.5, 3.2, 3.0, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2],
        source: 'Traffic Module rent trajectory', confidence: 85, module: 'Traffic',
      },
      userOverride: { values: Array(10).fill(null), active: false },
    },
    {
      id: 'expenseRatio', label: 'Expense Ratio', category: 'expense', unit: '%', perYear: true,
      dataRecommendation: {
        values: [42.0, 42.5, 43.0, 43.0, 43.5, 43.5, 44.0, 44.0, 44.5, 44.5],
        source: 'Market comps (submarket avg)', confidence: 70, module: null,
      },
      userOverride: { values: Array(10).fill(null), active: false },
    },
    {
      id: 'exitCapRate', label: 'Exit Cap Rate', category: 'exit', unit: '%', perYear: false,
      dataRecommendation: { values: [5.25], source: 'Strategy Module target exit', confidence: 65, module: 'Strategy' },
      userOverride: { values: [null], active: false },
    },
    {
      id: 'holdPeriod', label: 'Hold Period', category: 'exit', unit: 'yrs', perYear: false,
      dataRecommendation: { values: [5], source: 'Strategy Module hold period', confidence: 90, module: 'Strategy' },
      userOverride: { values: [null], active: false },
    },
    {
      id: 'capexBudget', label: 'CapEx Budget', category: 'capital', unit: '$', perYear: false,
      dataRecommendation: { values: [2_500_000], source: 'Strategy Module capex estimate', confidence: 72, module: 'Strategy' },
      userOverride: { values: [null], active: false },
    },
    {
      id: 'absorptionRate', label: 'Absorption Rate', category: 'revenue', unit: 'units', perYear: true,
      dataRecommendation: {
        values: [145, 150, 148, 146, 144, 142, 140, 138, 136, 134],
        source: 'Traffic Module leasing velocity', confidence: 82, module: 'Traffic',
      },
      userOverride: { values: Array(10).fill(null), active: false },
    },
    {
      id: 'vacancyLoss', label: 'Vacancy Loss', category: 'revenue', unit: '%', perYear: true,
      dataRecommendation: {
        values: [6.5, 6.0, 5.5, 5.2, 5.0, 5.0, 5.2, 5.5, 5.8, 6.0],
        source: 'Derived from occupancy trajectory', confidence: 88, module: 'Traffic',
      },
      userOverride: { values: Array(10).fill(null), active: false },
    },
    {
      id: 'managementFee', label: 'Management Fee', category: 'expense', unit: '%', perYear: false,
      dataRecommendation: { values: [3.5], source: 'Market standard (3-4% EGI)', confidence: 80, module: null },
      userOverride: { values: [null], active: false },
    },
  ];
}

function getActiveValue(row: AssumptionRow, yearIndex: number): number {
  if (row.userOverride.active) {
    const idx = row.perYear ? yearIndex : 0;
    const ov = row.userOverride.values[idx];
    if (ov !== null && ov !== undefined) return ov;
  }
  const idx = row.perYear ? yearIndex : 0;
  return row.dataRecommendation.values[idx] ?? row.dataRecommendation.values[0] ?? 0;
}

function buildIncomeStatement(assumptions: AssumptionRow[], units: number): ProFormaYear[] {
  const getRow = (id: string) => assumptions.find(r => r.id === id);
  const years: ProFormaYear[] = [];
  let rent = DEFAULT_BASE_RENT;
  const acqPrice = getActiveValue(getRow('purchasePrice')!, 0);
  const debtService = DEFAULT_DEBT_SERVICE;

  for (let y = 0; y < 10; y++) {
    const vacPct = getActiveValue(getRow('vacancyLoss')!, y) / 100;
    const rentGrowth = getActiveValue(getRow('rentGrowth')!, y) / 100;
    const expRatio = getActiveValue(getRow('expenseRatio')!, y) / 100;

    if (y > 0) rent = rent * (1 + rentGrowth);

    const gpr = units * rent * 12;
    const vacLoss = gpr * vacPct;
    const egi = gpr - vacLoss;
    const opex = egi * expRatio;
    const noi = egi - opex;
    const btcf = noi - debtService;
    const capRate = acqPrice > 0 ? ((noi / acqPrice) * 100).toFixed(2) : '0.00';

    years.push({
      year: y + 1,
      gpr: Math.round(gpr),
      vacancyLoss: Math.round(vacLoss),
      egi: Math.round(egi),
      opex: Math.round(opex),
      noi: Math.round(noi),
      debtService,
      btcf: Math.round(btcf),
      capRate,
    });
  }
  return years;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  revenue: { label: 'Revenue', color: 'emerald' },
  expense: { label: 'Expenses', color: 'amber' },
  capital: { label: 'Capital', color: 'blue' },
  exit: { label: 'Exit', color: 'violet' },
};

export const ProFormaTab: React.FC<ProFormaTabProps> = ({ deal, dealId }) => {
  const id = deal?.id || dealId;
  const units = (deal as any)?.units || DEFAULT_UNITS;
  const [assumptions, setAssumptions] = useState<AssumptionRow[]>(buildDefaultAssumptions());
  const [activeTab, setActiveTab] = useState<'assumptions' | 'income'>('assumptions');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isLiveData, setIsLiveData] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [proformaRes, trafficRes, strategyRes] = await Promise.allSettled([
          apiClient.get(`/api/v1/proforma/${id}`),
          apiClient.get(`/api/v1/leasing-traffic/v2/intelligence/${id}`),
          apiClient.get(`/api/v1/strategy-analyses/${id}`),
        ]);

        if (cancelled) return;

        let updated = buildDefaultAssumptions();
        let hasLive = false;

        if (proformaRes.status === 'fulfilled' && proformaRes.value?.data) {
          const raw = proformaRes.value.data;
          const pf = raw.data || raw;
          if (pf?.assumptions) {
            hasLive = true;
            for (const key of Object.keys(pf.assumptions)) {
              const row = updated.find(r => r.id === key);
              if (row && pf.assumptions[key]?.values) {
                row.dataRecommendation.values = pf.assumptions[key].values;
                row.dataRecommendation.source = pf.assumptions[key].source || row.dataRecommendation.source;
                row.dataRecommendation.confidence = pf.assumptions[key].confidence || row.dataRecommendation.confidence;
              }
            }
          }
        }

        if (trafficRes.status === 'fulfilled' && trafficRes.value?.data) {
          const rawTraffic = trafficRes.value.data;
          const traffic = rawTraffic.data || rawTraffic;
          hasLive = true;
          if (traffic?.occupancyTrajectory) {
            const occRow = updated.find(r => r.id === 'occupancyRate');
            const vacRow = updated.find(r => r.id === 'vacancyLoss');
            if (occRow) {
              occRow.dataRecommendation.values = traffic.occupancyTrajectory.map((p: any) => p.occ);
              occRow.dataRecommendation.source = 'Traffic Module occupancy trajectory (live)';
              occRow.dataRecommendation.confidence = traffic.modelConfidence || 88;
              occRow.dataRecommendation.module = 'Traffic';
            }
            if (vacRow) {
              vacRow.dataRecommendation.values = traffic.occupancyTrajectory.map((p: any) => 100 - p.occ);
              vacRow.dataRecommendation.source = 'Traffic Module vacancy (live)';
              vacRow.dataRecommendation.confidence = traffic.modelConfidence || 88;
              vacRow.dataRecommendation.module = 'Traffic';
            }
          }
          if (traffic?.rentTrajectory) {
            const rentRow = updated.find(r => r.id === 'rentGrowth');
            if (rentRow) {
              rentRow.dataRecommendation.values = traffic.rentTrajectory.map((p: any) => p.growth);
              rentRow.dataRecommendation.source = 'Traffic Module rent trajectory (live)';
              rentRow.dataRecommendation.confidence = traffic.modelConfidence || 85;
              rentRow.dataRecommendation.module = 'Traffic';
            }
          }
          if (traffic?.leasingVelocity) {
            const absRow = updated.find(r => r.id === 'absorptionRate');
            if (absRow) {
              absRow.dataRecommendation.values[0] = traffic.leasingVelocity.annualized;
              absRow.dataRecommendation.source = 'Traffic Module leasing velocity (live)';
              absRow.dataRecommendation.module = 'Traffic';
            }
          }
        }

        if (strategyRes.status === 'fulfilled' && strategyRes.value?.data) {
          const rawStrat = strategyRes.value.data;
          const stratData = rawStrat.data || rawStrat.analyses || rawStrat;
          if (stratData && Array.isArray(stratData) && stratData.length > 0) {
            hasLive = true;
            const strat = stratData[0];
            if (strat.assumptions?.exitCap) {
              const exitRow = updated.find(r => r.id === 'exitCapRate');
              if (exitRow) {
                exitRow.dataRecommendation.values = [strat.assumptions.exitCap];
                exitRow.dataRecommendation.module = 'Strategy';
              }
            }
            if (strat.assumptions?.holdPeriod) {
              const holdRow = updated.find(r => r.id === 'holdPeriod');
              if (holdRow) {
                holdRow.dataRecommendation.values = [strat.assumptions.holdPeriod];
                holdRow.dataRecommendation.module = 'Strategy';
              }
            }
            if (strat.assumptions?.capex) {
              const capexRow = updated.find(r => r.id === 'capexBudget');
              if (capexRow) {
                capexRow.dataRecommendation.values = [strat.assumptions.capex];
                capexRow.dataRecommendation.module = 'Strategy';
              }
            }
          }
        }

        setAssumptions(updated);
        setIsLiveData(hasLive);
      } catch {
        console.warn('ProFormaTab: using default assumptions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  const incomeStatement = useMemo(
    () => buildIncomeStatement(assumptions, units),
    [assumptions, units]
  );

  const handleOverride = useCallback((rowId: string, yearIndex: number, value: number | null) => {
    setAssumptions(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const newValues = [...row.userOverride.values];
      newValues[yearIndex] = value;
      const hasAnyOverride = newValues.some(v => v !== null);
      return { ...row, userOverride: { values: newValues, active: hasAnyOverride } };
    }));
  }, []);

  const clearOverride = useCallback((rowId: string) => {
    setAssumptions(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      return { ...row, userOverride: { values: row.perYear ? Array(10).fill(null) : [null], active: false } };
    }));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const overrideCount = assumptions.filter(r => r.userOverride.active).length;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto mb-3" />
          <div className="text-xs text-stone-400">Loading Pro Forma data...</div>
        </div>
      </div>
    );
  }

  const categories = ['revenue', 'expense', 'capital', 'exit'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Pro Forma</h2>
          <p className="text-sm text-stone-500">
            Dual-column assumptions with data recommendations and 10-year income statement
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLiveData && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono border border-emerald-300">
              LIVE DATA
            </span>
          )}
          {overrideCount > 0 && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono border border-blue-300">
              {overrideCount} OVERRIDE{overrideCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('assumptions')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'assumptions'
              ? 'bg-stone-900 text-white'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Edit3 size={14} />
          Assumptions
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'income'
              ? 'bg-stone-900 text-white'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          }`}
        >
          <BarChart3 size={14} />
          10-Year Income Statement
        </button>
      </div>

      {activeTab === 'assumptions' && (
        <div className="space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex items-start gap-2">
            <Info size={14} className="text-stone-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-stone-600 leading-relaxed">
              Each assumption shows two columns: <strong>Data Recommendation</strong> (pre-filled from Strategy, Traffic, and Market modules) and <strong>Your Override</strong> (editable). The active value used in calculations is your override if set, otherwise the data recommendation.
            </p>
          </div>

          {categories.map(cat => {
            const catInfo = CATEGORY_LABELS[cat];
            const catRows = assumptions.filter(r => r.category === cat);
            if (catRows.length === 0) return null;

            return (
              <div key={cat} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className={`px-4 py-2 bg-${catInfo.color}-50 border-b border-${catInfo.color}-100`}>
                  <span className={`text-xs font-bold text-${catInfo.color}-700 uppercase tracking-wider`}>
                    {catInfo.label}
                  </span>
                </div>

                {catRows.map(row => {
                  const isExpanded = expandedRows.has(row.id);
                  const activeVal = getActiveValue(row, 0);
                  const hasOverride = row.userOverride.active;
                  const recVal = row.dataRecommendation.values[0];

                  return (
                    <div key={row.id} className="border-b border-stone-100 last:border-b-0">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => toggleExpand(row.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-800">{row.label}</span>
                            {row.dataRecommendation.module && (
                              <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-bold">
                                {row.dataRecommendation.module}
                              </span>
                            )}
                            {hasOverride && (
                              <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                OVERRIDE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400 mt-0.5">{row.dataRecommendation.source}</div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[9px] text-stone-400 uppercase tracking-wider">Data Rec</div>
                            <div className="text-xs font-mono text-stone-500">{fmtNum(recVal, row.unit)}</div>
                          </div>

                          <ArrowRight size={12} className="text-stone-300" />

                          <div className="text-right">
                            <div className="text-[9px] text-stone-400 uppercase tracking-wider">Active</div>
                            <div className={`text-sm font-mono font-bold ${hasOverride ? 'text-blue-700' : 'text-stone-900'}`}>
                              {fmtNum(activeVal, row.unit)}
                            </div>
                          </div>

                          <div className="text-right min-w-[36px]">
                            <div className={`text-[10px] font-bold ${
                              row.dataRecommendation.confidence > 80 ? 'text-emerald-600' :
                              row.dataRecommendation.confidence > 60 ? 'text-amber-600' : 'text-stone-400'
                            }`}>
                              {row.dataRecommendation.confidence}%
                            </div>
                            <div className="text-[8px] text-stone-400">conf</div>
                          </div>

                          {isExpanded ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-stone-100 bg-stone-50">
                          {row.perYear ? (
                            <div className="overflow-x-auto mt-3">
                              <table className="w-full text-[10px] font-mono">
                                <thead>
                                  <tr className="text-stone-400">
                                    <th className="text-left py-1 pr-3 font-medium w-28">Year</th>
                                    {[1,2,3,4,5,6,7,8,9,10].map(y => (
                                      <th key={y} className="text-right py-1 px-1 font-medium">Y{y}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="text-stone-600">
                                    <td className="py-1.5 pr-3 text-stone-500 font-semibold">Data Rec</td>
                                    {row.dataRecommendation.values.map((v, i) => (
                                      <td key={i} className="text-right py-1.5 px-1">{v !== null ? v : '—'}</td>
                                    ))}
                                  </tr>
                                  <tr className="text-blue-700">
                                    <td className="py-1.5 pr-3 font-semibold flex items-center gap-1">
                                      Your Override
                                      {hasOverride && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); clearOverride(row.id); }}
                                          className="text-stone-400 hover:text-red-500"
                                          title="Clear all overrides"
                                        >
                                          <RotateCcw size={10} />
                                        </button>
                                      )}
                                    </td>
                                    {row.userOverride.values.map((v, i) => (
                                      <td key={i} className="text-right py-1.5 px-1">
                                        {editingCell === `${row.id}-${i}` ? (
                                          <input
                                            type="number"
                                            step={row.unit === '$' ? 10000 : 0.1}
                                            defaultValue={v ?? ''}
                                            placeholder={String(row.dataRecommendation.values[i] ?? '')}
                                            autoFocus
                                            className="w-14 text-right text-[10px] font-mono border border-blue-300 rounded px-1 py-0.5 bg-white"
                                            onBlur={(e) => {
                                              const val = e.target.value ? parseFloat(e.target.value) : null;
                                              handleOverride(row.id, i, val);
                                              setEditingCell(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                              if (e.key === 'Escape') setEditingCell(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                        ) : (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingCell(`${row.id}-${i}`); }}
                                            className={`cursor-pointer hover:bg-blue-100 rounded px-1 py-0.5 ${
                                              v !== null ? 'text-blue-700 font-bold' : 'text-stone-300'
                                            }`}
                                          >
                                            {v !== null ? v : '—'}
                                          </button>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                  <tr className="text-stone-900 font-bold border-t border-stone-200">
                                    <td className="py-1.5 pr-3">
                                      <CheckCircle2 size={10} className="inline mr-1 text-emerald-500" />
                                      Active
                                    </td>
                                    {Array.from({ length: 10 }, (_, i) => {
                                      const av = getActiveValue(row, i);
                                      const isOverridden = row.userOverride.active && row.userOverride.values[i] !== null;
                                      return (
                                        <td key={i} className={`text-right py-1.5 px-1 ${isOverridden ? 'text-blue-700' : 'text-stone-900'}`}>
                                          {av}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mt-3 flex items-center gap-6">
                              <div>
                                <div className="text-[9px] text-stone-400 uppercase tracking-wider mb-1">Data Recommendation</div>
                                <div className="text-sm font-mono text-stone-600">{fmtNum(recVal, row.unit)}</div>
                              </div>
                              <ArrowRight size={14} className="text-stone-300" />
                              <div>
                                <div className="text-[9px] text-stone-400 uppercase tracking-wider mb-1">Your Override</div>
                                {editingCell === `${row.id}-0` ? (
                                  <input
                                    type="number"
                                    step={row.unit === '$' ? 100000 : 0.1}
                                    defaultValue={row.userOverride.values[0] ?? ''}
                                    placeholder={String(recVal)}
                                    autoFocus
                                    className="w-32 text-sm font-mono border border-blue-300 rounded px-2 py-1 bg-white"
                                    onBlur={(e) => {
                                      const val = e.target.value ? parseFloat(e.target.value) : null;
                                      handleOverride(row.id, 0, val);
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditingCell(`${row.id}-0`)}
                                    className={`text-sm font-mono cursor-pointer hover:text-blue-600 ${
                                      row.userOverride.values[0] !== null ? 'text-blue-700 font-bold' : 'text-stone-300'
                                    }`}
                                  >
                                    {row.userOverride.values[0] !== null ? fmtNum(row.userOverride.values[0]!, row.unit) : 'Click to set'}
                                  </button>
                                )}
                                {hasOverride && (
                                  <button
                                    onClick={() => clearOverride(row.id)}
                                    className="ml-2 text-stone-400 hover:text-red-500"
                                    title="Clear override"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">10-Year Income Statement</h3>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  GPR → Vacancy Loss → EGI → OpEx → NOI → Debt Service → BTCF → Cap Rate
                </p>
              </div>
              <div className="text-[10px] text-stone-400 font-mono">
                {units} units · {fmt$(getActiveValue(assumptions.find(r => r.id === 'purchasePrice')!, 0))} acquisition
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left py-2 px-3 font-semibold text-stone-600 sticky left-0 bg-stone-50 min-w-[140px]">Line Item</th>
                    {incomeStatement.map(yr => (
                      <th key={yr.year} className="text-right py-2 px-3 font-semibold text-stone-600 min-w-[90px]">
                        Year {yr.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <IncomeRow label="Gross Potential Rent" values={incomeStatement.map(y => y.gpr)} format="$" bold />
                  <IncomeRow label="Vacancy Loss" values={incomeStatement.map(y => -y.vacancyLoss)} format="$" negative />
                  <IncomeRow label="Effective Gross Income" values={incomeStatement.map(y => y.egi)} format="$" bold highlight="emerald" />
                  <IncomeRow label="Operating Expenses" values={incomeStatement.map(y => -y.opex)} format="$" negative />
                  <IncomeRow label="Net Operating Income" values={incomeStatement.map(y => y.noi)} format="$" bold highlight="blue" />
                  <IncomeRow label="Debt Service" values={incomeStatement.map(y => -y.debtService)} format="$" negative />
                  <IncomeRow label="Before-Tax Cash Flow" values={incomeStatement.map(y => y.btcf)} format="$" bold highlight={incomeStatement[0].btcf >= 0 ? 'emerald' : 'red'} />
                  <tr className="border-t border-stone-200">
                    <td className="py-2 px-3 text-stone-600 font-medium sticky left-0 bg-white">Cap Rate</td>
                    {incomeStatement.map(yr => (
                      <td key={yr.year} className="text-right py-2 px-3 font-mono text-stone-700">
                        {yr.capRate}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <SummaryCard
              label="Year 1 NOI"
              value={fmt$(incomeStatement[0].noi)}
              sub={`Cap Rate: ${incomeStatement[0].capRate}%`}
              color="blue"
            />
            <SummaryCard
              label="Year 5 NOI"
              value={fmt$(incomeStatement[4].noi)}
              sub={`Cap Rate: ${incomeStatement[4].capRate}%`}
              color="emerald"
            />
            <SummaryCard
              label="Year 10 NOI"
              value={fmt$(incomeStatement[9].noi)}
              sub={`Cap Rate: ${incomeStatement[9].capRate}%`}
              color="violet"
            />
            <SummaryCard
              label="10-Yr NOI Growth"
              value={`${((incomeStatement[9].noi / incomeStatement[0].noi - 1) * 100).toFixed(1)}%`}
              sub={`${fmt$(incomeStatement[0].noi)} → ${fmt$(incomeStatement[9].noi)}`}
              color="amber"
            />
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <h4 className="text-xs font-bold text-stone-700 mb-2">NOI Trend (10-Year)</h4>
            <div className="flex items-end gap-1 h-24">
              {incomeStatement.map(yr => {
                const maxNoi = Math.max(...incomeStatement.map(y => y.noi));
                const pct = maxNoi > 0 ? (yr.noi / maxNoi) * 100 : 0;
                return (
                  <div key={yr.year} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[8px] font-mono text-stone-500">{fmt$(yr.noi)}</div>
                    <div
                      className="w-full bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                      style={{ height: `${Math.max(pct * 0.8, 4)}px` }}
                      title={`Year ${yr.year}: ${fmt$(yr.noi)}`}
                    />
                    <div className="text-[8px] text-stone-400">Y{yr.year}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IncomeRow: React.FC<{
  label: string;
  values: number[];
  format: '$' | '%';
  bold?: boolean;
  negative?: boolean;
  highlight?: 'emerald' | 'blue' | 'red' | 'amber' | 'violet';
}> = ({ label, values, format, bold, negative, highlight }) => {
  const bgClass = highlight ? `bg-${highlight}-50` : '';
  return (
    <tr className={`border-b border-stone-100 ${bgClass}`}>
      <td className={`py-2 px-3 sticky left-0 ${bgClass || 'bg-white'} ${bold ? 'font-semibold text-stone-900' : negative ? 'text-red-600' : 'text-stone-600'}`}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className={`text-right py-2 px-3 font-mono ${bold ? 'font-semibold text-stone-900' : negative ? 'text-red-500' : 'text-stone-700'}`}>
          {format === '$' ? (v < 0 ? `(${fmt$(Math.abs(v))})` : fmt$(v)) : `${v.toFixed(1)}%`}
        </td>
      ))}
    </tr>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  sub: string;
  color: string;
}> = ({ label, value, sub, color }) => (
  <div className={`bg-white rounded-xl border border-stone-200 p-4`}>
    <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">{label}</div>
    <div className={`text-xl font-bold font-mono text-${color}-700`}>{value}</div>
    <div className="text-[10px] text-stone-400 mt-1">{sub}</div>
  </div>
);

export default ProFormaTab;
