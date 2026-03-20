import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  StrategyType,
  CapitalLayer,
  MetricInsight,
} from '../../../types/capital-structure.types';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';
import {
  strategyTemplates,
  defaultCapitalStack,
  debtProducts,
  currentRates,
  rateForecast,
  lockVsFloatAnalysis,
  spreadAnalysis,
  stackInsights,
  strategyMismatchWarnings,
  calcRateSensitivity,
} from '../../../data/capitalStructureMockData';
import ExitDrivesCapital from './ExitDrivesCapital';
import { ExitWindowsTab, SensitivityTab, MonitorTab } from './ExitStrategyTabs';
import type { ExitStrategyConfig } from './ExitStrategyTabs';
import DebtCycleChart from './DebtCycleChart';
import DebtProductsChart from './DebtProductsChart';

const API_BASE = '/api/v1/capital-structure';

interface DebtTabProps {
  deal: any;
  isPremium?: boolean;
  dealStatus?: 'pipeline' | 'owned';
}

type TabId = 'exit-overview' | 'debt' | 'rates' | 'metrics' | 'exit' | 'sensitivity' | 'monitor';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'exit-overview', label: 'Exit & Capital', icon: '⊕' },
  { id: 'debt', label: 'Debt Products', icon: '◇' },
  { id: 'rates', label: 'Rate Strategy', icon: '◆' },
  { id: 'metrics', label: 'Key Metrics', icon: '⬡' },
  { id: 'exit', label: 'Exit Windows', icon: '◉' },
  { id: 'sensitivity', label: 'Sensitivity', icon: '∿' },
  { id: 'monitor', label: 'Monitor', icon: '◎' },
];

const fmt = (v: number | undefined | null): string => {
  if (v == null || isNaN(v)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | undefined | null): string => {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(2)}%`;
};

const fmtM = (v: number | undefined | null): string => {
  if (v == null || isNaN(v)) return '$0';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return fmt(v);
};

export const DebtTab: React.FC<DebtTabProps> = ({
  deal,
  isPremium = false,
  dealStatus = 'pipeline',
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('exit-overview');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('rental_value_add');
  const [layers, setLayers] = useState<CapitalLayer[]>(defaultCapitalStack.layers);

  const [liveStack, setLiveStack] = useState<any>(null);
  const [liveDebtProducts, setLiveDebtProducts] = useState<any>(null);
  const [liveRateData, setLiveRateData] = useState<any>(null);
  const [liveInsights, setLiveInsights] = useState<any>(null);

  const [liveRates, setLiveRates] = useState<any>(null);
  const [rateHistory, setRateHistory] = useState<any>(null);
  const [historyPeriod, setHistoryPeriod] = useState('2y');

  const [rateSheetFile, setRateSheetFile] = useState<File | null>(null);
  const [rateSheetParsed, setRateSheetParsed] = useState<any>(null);
  const [rateSheetLoading, setRateSheetLoading] = useState(false);

  const [aiStrategy, setAiStrategy] = useState<any>(null);
  const [aiStrategyLoading, setAiStrategyLoading] = useState(false);

  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    'exit-overview': false, debt: false, rates: false, metrics: false, exit: false, sensitivity: false, monitor: false,
  });
  const [liveDataSources, setLiveDataSources] = useState<Set<TabId>>(new Set());
  const fetchedTabs = useRef<Set<TabId>>(new Set());

  const {
    financial,
    capitalStructure,
    updateCapitalStructure,
    strategy: strategyCtx,
    emitEvent,
    lastEvent,
  } = useDealModule();

  const template = strategyTemplates[selectedStrategy];
  const stack = liveStack || defaultCapitalStack;

  const exitConfig = useMemo<ExitStrategyConfig>(() => ({
    baseNOI: financial?.noi || 0,
    equityInvested: capitalStructure?.totalEquity || stack?.metrics?.totalEquity || 8000000,
    loanBalance: capitalStructure?.loanBalance?.[0] ?? stack?.metrics?.totalDebt ?? 19200000,
    dealStatus: dealStatus || 'pipeline',
  }), [financial?.noi, capitalStructure?.totalEquity, capitalStructure?.loanBalance, stack?.metrics?.totalEquity, stack?.metrics?.totalDebt, dealStatus]);

  const markTabLoading = useCallback((tab: TabId, loading: boolean) => {
    setTabLoading(prev => ({ ...prev, [tab]: loading }));
  }, []);

  const markTabLive = useCallback((tab: TabId) => {
    setLiveDataSources(prev => new Set(prev).add(tab));
  }, []);

  useEffect(() => {
    const fetchStack = async () => {
      try {
        const res = await apiClient.post(`${API_BASE}/stack`, {
          dealId: deal.id,
          strategy: selectedStrategy,
          layers: defaultCapitalStack.layers,
          uses: defaultCapitalStack.uses,
          noi: financial?.noi || 0,
          propertyValue: defaultCapitalStack.uses.acquisitionPrice,
        });
        if (res.data?.stack) {
          setLiveStack(res.data.stack);
          if (res.data.stack.layers) setLayers(res.data.stack.layers);
        }
      } catch {
      }

      try {
        const insRes = await apiClient.post(`${API_BASE}/insights`, {
          metrics: defaultCapitalStack.metrics,
        });
        if (insRes.data?.insights) {
          setLiveInsights(insRes.data.insights);
        }
      } catch {
      }
    };
    fetchStack();
  }, [deal.id]);

  useEffect(() => {
    if (activeTab === 'debt' && !fetchedTabs.current.has('debt')) {
      fetchedTabs.current.add('debt');
      const fetchDebt = async () => {
        markTabLoading('debt', true);
        try {
          const res = await apiClient.post(`${API_BASE}/debt-products/recommend`, {
            strategy: selectedStrategy,
            products: debtProducts,
          });
          if (res.data) {
            setLiveDebtProducts(res.data);
            markTabLive('debt');
          }
        } catch {
        } finally {
          markTabLoading('debt', false);
        }
      };
      fetchDebt();
    }
  }, [activeTab, selectedStrategy]);

  useEffect(() => {
    if (activeTab === 'rates' && !fetchedTabs.current.has('rates')) {
      fetchedTabs.current.add('rates');
      const fetchRates = async () => {
        markTabLoading('rates', true);
        try {
          const [cycleRes, lockFloatRes, sensitivityRes, liveRatesRes, historyRes] = await Promise.allSettled([
            apiClient.post(`${API_BASE}/rate/cycle-phase`, {
              fedDirection: currentRates.fedDirection,
              durationMonths: 6,
              yieldCurveSlope: currentRates.treasury10Y - currentRates.treasury2Y,
            }),
            apiClient.post(`${API_BASE}/rate/lock-vs-float`, {
              loanAmount: 33750000,
              lockRate: lockVsFloatAnalysis.lockNow.rate,
              expectedFloatRates: [],
              termMonths: 36,
            }),
            apiClient.post(`${API_BASE}/rate/sensitivity`, {
              loanAmount: 33750000,
              holdYears: 5,
            }),
            apiClient.get(`${API_BASE}/rates/live`),
            apiClient.get(`${API_BASE}/rates/history`, { params: { period: historyPeriod } }),
          ]);
          const rateData: any = {};
          if (cycleRes.status === 'fulfilled' && cycleRes.value.data) {
            rateData.cyclePhase = cycleRes.value.data.cyclePhase;
          }
          if (lockFloatRes.status === 'fulfilled' && lockFloatRes.value.data?.analysis) {
            rateData.lockVsFloat = lockFloatRes.value.data.analysis;
          }
          if (sensitivityRes.status === 'fulfilled' && sensitivityRes.value.data?.sensitivityMatrix) {
            rateData.sensitivityMatrix = sensitivityRes.value.data.sensitivityMatrix;
          }
          if (Object.keys(rateData).length > 0) {
            setLiveRateData(rateData);
            markTabLive('rates');
          }
          if (liveRatesRes.status === 'fulfilled' && liveRatesRes.value.data) {
            setLiveRates(liveRatesRes.value.data);
          }
          if (historyRes.status === 'fulfilled' && historyRes.value.data) {
            setRateHistory(historyRes.value.data);
          }
        } catch {
        } finally {
          markTabLoading('rates', false);
        }
      };
      fetchRates();
    }
  }, [activeTab]);

  useEffect(() => {
    if (historyPeriod && fetchedTabs.current.has('rates')) {
      const fetchHistory = async () => {
        try {
          const res = await apiClient.get(`${API_BASE}/rates/history`, { params: { period: historyPeriod } });
          if (res.data) setRateHistory(res.data);
        } catch {}
      };
      fetchHistory();
    }
  }, [historyPeriod]);

  useEffect(() => {
    const fetchLatestRateSheet = async () => {
      try {
        const res = await apiClient.get(`${API_BASE}/rate-sheet/${deal.id}/latest`);
        if (res.data) setRateSheetParsed(res.data);
      } catch {}
    };
    fetchLatestRateSheet();
  }, [deal.id]);

  const isAnyLive = liveDataSources.size > 0;

  const renderTabLoading = () => (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading live data...</span>
      </div>
    </div>
  );

  useEffect(() => {
    if (lastEvent?.type === 'strategy-selected' && lastEvent.payload?.strategy) {
      const incoming = lastEvent.payload.strategy as StrategyType;
      if (incoming !== selectedStrategy && strategyTemplates[incoming]) {
        setSelectedStrategy(incoming);
        setLayers(strategyTemplates[incoming].defaultStack?.layers || defaultCapitalStack.layers);
      }
    }
  }, [lastEvent]);

  const emitCapitalUpdate = useCallback(() => {
    const totalDebt = layers
      .filter(l => l.layerType === 'senior' || l.layerType === 'mezz')
      .reduce((s, l) => s + l.amount, 0);
    const totalEquity = layers
      .filter(l => ['lpEquity', 'gpEquity', 'prefEquity'].includes(l.layerType))
      .reduce((s, l) => s + l.amount, 0);
    const seniorLayer = layers.find(l => l.layerType === 'senior');
    const seniorRate = seniorLayer?.rate || 0;
    const seniorTerm = seniorLayer?.term || 0;

    const annualDebtService = totalDebt * (seniorRate / 100);
    const noi = financial?.noi || stack.metrics.dscr * annualDebtService || 0;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
    const totalValue = layers.reduce((s, l) => s + l.amount, 0);
    const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    const capitalPayload = {
      annualDebtService,
      interestOnlyPeriod: (seniorLayer as any)?.ioMonths || 0,
      amortizationSchedule: [],
      totalEquity,
      lpEquity: layers.find(l => l.layerType === 'lpEquity')?.amount || 0,
      gpEquity: layers.find(l => l.layerType === 'gpEquity')?.amount || 0,
      weightedCostOfCapital: stack.metrics.wacc,
      loanMaturityYear: seniorTerm,
      dscr,
      ltv,
      ltc: stack.metrics.ltc,
      debtYield: stack.metrics.debtYield,
      loanBalance: [],
      prepaymentPenalty: 0,
      capitalRiskScore: 0,
      structureSummary: `${(ltv ?? 0).toFixed(0)}% LTV ${template.label} │ ${(stack.metrics.cocReturn ?? 0).toFixed(1)}% CoC │ ${(dscr ?? 0).toFixed(2)}x DSCR`,
    };

    updateCapitalStructure(capitalPayload);

    emitEvent({
      source: 'M11-capital-structure',
      type: 'capital-updated',
      payload: capitalPayload,
    });
  }, [layers, financial, selectedStrategy, template, stack, updateCapitalStructure, emitEvent]);

  useEffect(() => {
    emitCapitalUpdate();
  }, [selectedStrategy, layers]);

  const filteredProducts = useMemo(
    () => debtProducts.filter((p) => p.bestForStrategies.includes(selectedStrategy)),
    [selectedStrategy],
  );
  const otherProducts = useMemo(
    () => debtProducts.filter((p) => !p.bestForStrategies.includes(selectedStrategy)),
    [selectedStrategy],
  );

  const activeWarnings = useMemo(
    () => strategyMismatchWarnings.filter((w) => w.strategy === selectedStrategy),
    [selectedStrategy],
  );

  const handleUploadRateSheet = useCallback(async () => {
    if (!rateSheetFile) return;
    setRateSheetLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', rateSheetFile);
      formData.append('dealId', deal.id);
      const res = await apiClient.post(`${API_BASE}/rate-sheet/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data) setRateSheetParsed(res.data);
    } catch {} finally {
      setRateSheetLoading(false);
    }
  }, [rateSheetFile, deal.id]);

  const handleGetAiStrategy = useCallback(async () => {
    setAiStrategyLoading(true);
    try {
      const seniorLayer = layers.find(l => l.layerType === 'senior');
      const totalDebt = layers
        .filter(l => l.layerType === 'senior' || l.layerType === 'mezz')
        .reduce((s, l) => s + l.amount, 0);
      const res = await apiClient.post(`${API_BASE}/optimal-strategy`, {
        propertyType: deal.propertyType || 'multifamily',
        propertyValue: defaultCapitalStack.uses.acquisitionPrice,
        noi: financial?.noi || 0,
        holdPeriod: template.holdPeriod,
        strategy: selectedStrategy,
        loanAmount: totalDebt,
      });
      if (res.data) setAiStrategy(res.data);
    } catch {} finally {
      setAiStrategyLoading(false);
    }
  }, [layers, deal, financial, template, selectedStrategy]);

  const applyRateSheetProduct = useCallback((product: any) => {
    const seniorIdx = layers.findIndex(l => l.layerType === 'senior');
    if (seniorIdx >= 0) {
      const updated = [...layers];
      updated[seniorIdx] = {
        ...updated[seniorIdx],
        rate: product.rate || product.rateRange?.min || updated[seniorIdx].rate,
        source: product.lender || product.name || updated[seniorIdx].source,
        name: product.name || updated[seniorIdx].name,
      };
      setLayers(updated);
    }
  }, [layers]);

  const renderStrategySelector = () => (
    <div className="flex gap-2 flex-wrap">
      {(Object.keys(strategyTemplates) as StrategyType[]).map((key) => {
        const t = strategyTemplates[key];
        const isActive = selectedStrategy === key;
        return (
          <button
            key={key}
            onClick={() => {
              setSelectedStrategy(key);
              setLayers(strategyTemplates[key].defaultStack?.layers || defaultCapitalStack.layers);
              emitEvent({
                source: 'M11-capital-structure',
                type: 'strategy-selected',
                payload: { strategy: key },
              });
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
              isActive
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const renderDebtSelector = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{template.label} Capital Template</h3>
            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase">Key Metric</div>
            <div className="text-sm font-semibold text-blue-700">{template.keyMetric}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-xs text-gray-500">Primary Debt</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.productType.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Rate Range</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.rateRange.min}–{template.defaultStack.seniorDebt.rateRange.max}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Hold Period</div>
            <div className="text-sm font-semibold">{template.holdPeriod}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Exit</div>
            <div className="text-sm font-semibold">{template.exitStrategy}</div>
          </div>
        </div>
      </div>

      {activeWarnings.map((w, i) => (
        <div key={i} className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg font-bold">!</span>
            <div>
              <div className="text-sm font-semibold text-red-800">Strategy Mismatch: {w.debtProduct}</div>
              <div className="text-sm text-red-700 mt-1">{w.issue}</div>
              <div className="text-sm text-red-600 mt-2 font-medium">Suggestion: {w.suggestion}</div>
            </div>
          </div>
        </div>
      ))}

      <div>
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Recommended for {template.label} ({filteredProducts.length} products)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border-2 border-blue-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.lender}</div>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                  {product.rateType === 'fixed' ? 'Fixed' : 'Floating'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <div className="text-xs text-gray-500">Rate</div>
                  <div className="text-sm font-semibold">{product.rateRange.min}–{product.rateRange.max}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Max LTV</div>
                  <div className="text-sm font-semibold">{product.ltvMax}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Term</div>
                  <div className="text-sm font-semibold">{product.term.min}–{product.term.max}mo</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">{product.keyBenefit}</div>
              <div className="mt-2 p-3 bg-red-50 rounded text-xs text-red-700">{product.keyRisk}</div>
            </div>
          ))}
        </div>
      </div>

      {otherProducts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Not Recommended for {template.label} ({otherProducts.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            {otherProducts.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="font-semibold text-gray-600">{product.name}</div>
                <div className="text-xs text-gray-400">{product.lender} — {product.rateRange.min}–{product.rateRange.max}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoricalChart = () => {
    const hasSofr = rateHistory?.sofr?.length > 0;
    const hasEffr = rateHistory?.effr?.length > 0;
    const hasTreasury = rateHistory?.treasury10Y?.length > 0;
    const hasPrime = rateHistory?.prime?.length > 0;
    const hasAnyData = hasSofr || hasEffr || hasTreasury || hasPrime;

    if (!hasAnyData) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Historical Rates</h4>
            <div className="flex gap-1">
              {['6m', '1y', '2y'].map(p => (
                <button key={p} onClick={() => setHistoryPeriod(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded ${historyPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-400 text-center py-8">Loading historical rate data...</div>
        </div>
      );
    }

    const allValues: number[] = [];
    const series: Record<string, number[]> = { sofr: [], effr: [], treasury10Y: [], prime: [] };
    if (hasSofr) rateHistory.sofr.forEach((d: any) => { series.sofr.push(d.rate); allValues.push(d.rate); });
    if (hasEffr) rateHistory.effr.forEach((d: any) => { series.effr.push(d.rate); allValues.push(d.rate); });
    if (hasTreasury) rateHistory.treasury10Y.forEach((d: any) => { series.treasury10Y.push(d.rate); allValues.push(d.rate); });
    if (hasPrime) rateHistory.prime.forEach((d: any) => { series.prime.push(d.rate); allValues.push(d.rate); });

    const minV = Math.min(...allValues) - 0.2;
    const maxV = Math.max(...allValues) + 0.2;
    const range = maxV - minV || 1;
    const W = 800;
    const H = 300;
    const pad = 40;

    const makePoints = (vals: number[]) => {
      if (vals.length === 0) return '';
      return vals.map((v, i) => {
        const x = pad + (i / Math.max(vals.length - 1, 1)) * (W - 2 * pad);
        const y = H - pad - ((v - minV) / range) * (H - 2 * pad);
        return `${x},${y}`;
      }).join(' ');
    };

    const lineConfig = [
      { key: 'sofr', color: '#3B82F6', label: 'SOFR' },
      { key: 'effr', color: '#EF4444', label: 'EFFR' },
      { key: 'treasury10Y', color: '#8B5CF6', label: 'Treasury 10Y' },
      { key: 'prime', color: '#F97316', label: 'Prime' },
    ];

    const todayX = W - pad;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Historical Rates</h4>
          <div className="flex gap-1">
            {['6m', '1y', '2y'].map(p => (
              <button key={p} onClick={() => setHistoryPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded ${historyPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#E5E7EB" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#E5E7EB" strokeWidth="1" />
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = H - pad - f * (H - 2 * pad);
            const val = minV + f * range;
            return (
              <g key={f}>
                <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#F3F4F6" strokeWidth="0.5" />
                <text x={pad - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{val.toFixed(1)}%</text>
              </g>
            );
          })}
          <line x1={todayX} y1={pad} x2={todayX} y2={H - pad} stroke="#6B7280" strokeWidth="1" strokeDasharray="4 3" />
          <text x={todayX} y={pad - 5} textAnchor="middle" fontSize="9" fill="#6B7280">Today</text>
          {lineConfig.map(lc => {
            const pts = makePoints(series[lc.key as keyof typeof series]);
            if (!pts) return null;
            return <polyline key={lc.key} points={pts} fill="none" stroke={lc.color} strokeWidth="2" />;
          })}
        </svg>
        <div className="flex items-center gap-4 mt-3 justify-center">
          {lineConfig.map(lc => (
            <div key={lc.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lc.color }} />
              <span className="text-xs text-gray-600">{lc.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRateStrategy = () => {
    const rates = liveRates || currentRates;
    const isLive = !!liveRates;

    // Guard against missing data
    if (!currentRates || !lockVsFloatAnalysis || !spreadAnalysis || !rateForecast) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-gray-500">Loading rate data...</div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {renderHistoricalChart()}

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Current Rate Environment</h3>
              {isLive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300">
                  LIVE
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">Updated: {rates.lastUpdated}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Fed Funds', value: fmtPct(rates.fedFunds), color: 'text-blue-600' },
              { label: '10Y Treasury', value: fmtPct(rates.treasury10Y), color: 'text-purple-600' },
              { label: 'SOFR', value: fmtPct(rates.sofr), color: 'text-indigo-600' },
              { label: 'Prime', value: fmtPct(rates.prime), color: 'text-green-600' },
            ].map((r) => (
              <div key={r.label} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-500 uppercase">{r.label}</div>
                <div className={`text-2xl font-bold mt-1 ${r.color}`}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Cycle Position</h4>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                rates.cyclePhase === 'easing' ? 'bg-green-100 text-green-700' :
                rates.cyclePhase === 'tightening' ? 'bg-red-100 text-red-700' :
                rates.cyclePhase === 'peak' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {rates.cyclePhase === 'easing' ? '↓' : rates.cyclePhase === 'tightening' ? '↑' : '→'}
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900 capitalize">{rates.cyclePhase}</div>
                <div className="text-sm text-gray-600">Fed {rates.fedDirection} — Next meeting: {rates.nextFedMeeting}</div>
                <div className="text-sm text-gray-600 mt-1">{rates.cutProbability6mo}% probability of cut within 6mo</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              {rates.marketSentiment}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Lock vs Float Analysis</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'lock' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                <div className="text-xs text-gray-500 uppercase">Lock Now</div>
                <div className="text-xl font-bold text-gray-900 mt-1">{fmtPct(lockVsFloatAnalysis.lockNow.rate)}</div>
                <div className="text-sm text-gray-600 mt-1">NPV: {fmtM(lockVsFloatAnalysis.lockNow.npv)}</div>
              </div>
              <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'float' ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                <div className="text-xs text-gray-500 uppercase">Float & Wait</div>
                <div className="text-xl font-bold text-gray-900 mt-1">{fmtPct(lockVsFloatAnalysis.floatAndWait.expectedRate)}</div>
                <div className="text-sm text-gray-600 mt-1">NPV: {fmtM(lockVsFloatAnalysis.floatAndWait.npv)}</div>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              lockVsFloatAnalysis.recommendation === 'float' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <span className="font-semibold">Recommendation: {lockVsFloatAnalysis.recommendation === 'float' ? 'Float' : 'Lock'}</span>
              <span className="ml-1">— {lockVsFloatAnalysis.rationale.slice(0, 120)}...</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Spread Analysis vs 5-Year Average</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {spreadAnalysis.map((s) => (
              <div key={s.productType} className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 uppercase">{s.productType}</div>
                <div className="text-xl font-bold text-gray-900 mt-1">{s.currentSpread} bps</div>
                <div className="text-xs text-gray-500 mt-1">5yr avg: {s.fiveYearAvg} bps</div>
                <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold inline-block ${
                  s.position === 'tight' ? 'bg-green-100 text-green-700' :
                  s.position === 'wide' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {s.position.toUpperCase()} ({s.percentile}th pctl)
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Rate Forecast</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Horizon</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">10Y Treasury</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">SOFR</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate Impact ($33.75M loan)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rateForecast.map((f) => {
                  const rateDelta = (rates.treasury10Y - f.treasury10Y) * 100;
                  const impact = calcRateSensitivity(33750000, rateDelta, f.months / 12);
                  return (
                    <tr key={f.months} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.months}mo</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPct(f.treasury10Y)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPct(f.sofr)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          f.confidence >= 60 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {f.confidence}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                        {impact > 0 ? `Save ${fmtM(impact)}` : `Cost ${fmtM(Math.abs(impact))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {renderAiStrategy()}
        {renderRateSheetUpload()}
      </div>
    );
  };

  const renderAiStrategy = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">AI Optimal Strategy</h4>
        <button
          onClick={handleGetAiStrategy}
          disabled={aiStrategyLoading}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 transition-all"
        >
          {aiStrategyLoading ? 'Analyzing...' : 'Get AI Strategy'}
        </button>
      </div>

      {aiStrategy && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
              <svg viewBox="0 0 120 120" width="100" height="100">
                {(() => {
                  const score = aiStrategy.costOfCapitalScore ?? 75;
                  const radius = 45;
                  const circumference = 2 * Math.PI * radius;
                  const offset = circumference - (score / 100) * circumference;
                  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#EAB308' : '#EF4444';
                  return (
                    <>
                      <circle cx="60" cy="60" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
                      <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round" transform="rotate(-90 60 60)" />
                      <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>{score}</text>
                      <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#6B7280">Score</text>
                    </>
                  );
                })()}
              </svg>
              <span className="text-xs font-semibold text-gray-600 mt-1">Cost of Capital Score</span>
            </div>

            <div className="space-y-3 p-4">
              {aiStrategy.recommendedProduct && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Recommended Product</div>
                  <span className="inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700">{aiStrategy.recommendedProduct}</span>
                </div>
              )}
              {aiStrategy.rateType && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Rate Type</div>
                  <span className="inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-700">{aiStrategy.rateType}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 p-4">
              {aiStrategy.lockVsFloat && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Lock vs Float</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{aiStrategy.lockVsFloat.recommendation}</div>
                  {aiStrategy.lockVsFloat.dollarImpact && (
                    <div className="text-xs text-green-600 mt-0.5">{fmtM(aiStrategy.lockVsFloat.dollarImpact)} impact</div>
                  )}
                </div>
              )}
              {aiStrategy.entryTiming && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Entry Timing</div>
                  <div className="text-sm font-semibold text-gray-900 mt-1">{aiStrategy.entryTiming}</div>
                </div>
              )}
            </div>
          </div>

          {aiStrategy.exitSignal && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-xs text-yellow-600 uppercase font-semibold">Exit Signal</div>
              <div className="text-sm text-yellow-800 mt-1">{aiStrategy.exitSignal}</div>
            </div>
          )}

          {aiStrategy.keyRisks && aiStrategy.keyRisks.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-xs text-red-600 uppercase font-semibold mb-1">Key Risks</div>
              <ul className="space-y-1">
                {aiStrategy.keyRisks.map((risk: string, i: number) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiStrategy.executiveSummary && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-600 uppercase font-semibold mb-1">Executive Summary</div>
              <div className="text-sm text-blue-900">{aiStrategy.executiveSummary}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRateSheetUpload = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Upload Rate Sheet</h4>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setRateSheetFile(e.target.files?.[0] || null)}
          className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={handleUploadRateSheet}
          disabled={!rateSheetFile || rateSheetLoading}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
        >
          {rateSheetLoading ? 'Parsing...' : 'Upload & Parse'}
        </button>
      </div>

      {rateSheetParsed && rateSheetParsed.products && (
        <div className="space-y-4">
          {Object.entries(
            (rateSheetParsed.products as any[]).reduce((acc: Record<string, any[]>, p: any) => {
              const cat = p.category || p.productType || 'Other';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(p);
              return acc;
            }, {})
          ).map(([category, products]) => (
            <div key={category}>
              <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">{category}</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Lender</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Rate</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Max LTV</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(products as any[]).map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 text-gray-600">{p.lender}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.rate ? fmtPct(p.rate) : `${p.rateRange?.min}–${p.rateRange?.max}%`}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{p.ltvMax || p.maxLtv || '—'}%</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => applyRateSheetProduct(p)}
                            className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                          >
                            Apply to Stack
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderKeyMetrics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'LTV', value: fmtPct(stack.metrics.ltv), color: stack.metrics.ltv > 75 ? 'text-orange-600' : 'text-green-600', desc: 'Loan-to-Value ratio' },
          { label: 'LTC', value: fmtPct(stack.metrics.ltc), color: 'text-gray-900', desc: 'Loan-to-Cost ratio' },
          { label: 'DSCR', value: `${(stack.metrics.dscr ?? 0).toFixed(2)}x`, color: (stack.metrics.dscr ?? 0) < 1.25 ? 'text-red-600' : 'text-green-600', desc: 'Debt Service Coverage Ratio' },
          { label: 'Debt Yield', value: fmtPct(stack.metrics.debtYield), color: 'text-gray-900', desc: 'NOI / Total Debt' },
          { label: 'Total Debt', value: fmtM(stack.metrics.totalDebt), color: 'text-blue-600', desc: 'Senior + Mezzanine' },
          { label: 'Total Equity', value: fmtM(stack.metrics.totalEquity), color: 'text-green-600', desc: 'LP + GP equity' },
          { label: 'WACC', value: fmtPct(stack.metrics.weightedAvgCostOfCapital), color: 'text-gray-900', desc: 'Weighted Avg Cost of Capital' },
          { label: 'Cash-on-Cash', value: fmtPct(stack.metrics.cocReturn), color: 'text-purple-600', desc: 'Annual cash flow / equity' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-xs text-gray-500 uppercase">{m.label}</div>
            <div className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</div>
            <div className="text-xs text-gray-400 mt-2">{m.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Strategy Template Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600 uppercase font-semibold">Strategy</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{template.label}</div>
            <div className="text-sm text-gray-600 mt-1">{template.description}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-purple-600 uppercase font-semibold">Hold Period & Exit</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{template.holdPeriod}</div>
            <div className="text-sm text-gray-600 mt-1">{template.exitStrategy}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs text-green-600 uppercase font-semibold">Promote Structure</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{template.typicalPromote}</div>
            <div className="text-sm text-gray-600 mt-1">Key: {template.keyMetric}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Debt Output for Financial Dashboard</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Annual Debt Service', value: fmtM(stack.metrics.totalDebt * (layers.find(l => l.layerType === 'senior')?.rate || 0) / 100) },
            { label: 'WACC', value: fmtPct(stack.metrics.weightedAvgCostOfCapital) },
            { label: 'Equity Required', value: fmtM(stack.metrics.equityRequired) },
            { label: 'Senior Rate', value: fmtPct(layers.find(l => l.layerType === 'senior')?.rate || 0) },
            { label: 'Senior Term', value: `${layers.find(l => l.layerType === 'senior')?.term || 0} months` },
            { label: 'Structure', value: `${(stack.metrics.ltv ?? 0).toFixed(0)}% LTV` },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-500 uppercase">{item.label}</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          These values are consumed by the Financial Dashboard to build Base/Best/Worst model variations.
        </div>
      </div>

      {renderInsights(liveInsights || stackInsights)}
    </div>
  );

  const renderInsights = (insights: MetricInsight[]) => (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div key={i} className={`p-4 rounded-lg border ${
          insight.severity === 'success' ? 'border-green-200 bg-green-50' :
          insight.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
          insight.severity === 'danger' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{insight.metric}: {insight.value}</div>
              <div className="text-sm text-gray-700 mt-1">{insight.insight}</div>
            </div>
            {insight.action && (
              <button className="text-xs text-blue-600 font-semibold hover:text-blue-700 whitespace-nowrap ml-4">
                {insight.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {renderStrategySelector()}
          {isAnyLive && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300 animate-pulse">
              LIVE DATA
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Template: <span className="font-semibold text-gray-700">{template.label}</span> — {template.holdPeriod}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'exit-overview' && (
        <ExitDrivesCapital
          deal={deal}
          dealId={deal?.id}
          financial={financial}
          capitalStructure={capitalStructure}
          dealStatus={dealStatus}
        />
      )}
      {activeTab === 'debt' && (tabLoading.debt ? renderTabLoading() : (
        <div className="space-y-6">
          <DebtProductsChart products={debtProducts} targetRate={template.rateRange?.[0] || 5.0} exitWindowMonths={42} />
          {renderDebtSelector()}
        </div>
      ))}
      {activeTab === 'rates' && (tabLoading.rates ? renderTabLoading() : (
        <div className="space-y-6">
          <DebtCycleChart currentRates={liveRates || currentRates} rateForecast={rateForecast} />
          {renderRateStrategy()}
        </div>
      ))}
      {activeTab === 'metrics' && renderKeyMetrics()}
      {activeTab === 'exit' && <ExitWindowsTab config={exitConfig} />}
      {activeTab === 'sensitivity' && <SensitivityTab config={exitConfig} />}
      {activeTab === 'monitor' && <MonitorTab dealStatus={dealStatus || 'pipeline'} />}
    </div>
  );
};

export default DebtTab;
