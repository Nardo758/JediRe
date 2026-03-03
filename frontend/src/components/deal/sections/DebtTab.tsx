import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  StrategyType,
  CapitalLayer,
  CapitalScenario,
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
  defaultWaterfall,
  waterfallResult,
  stackInsights,
  strategyMismatchWarnings,
  calcSourcesEqualsUses,
  calcRateSensitivity,
} from '../../../data/capitalStructureMockData';

const API_BASE = '/api/v1/capital-structure';

interface DebtTabProps {
  deal: any;
  isPremium?: boolean;
  dealStatus?: 'pipeline' | 'owned';
}

type TabId = 'stack' | 'debt' | 'rates' | 'metrics' | 'waterfall';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'stack', label: 'Capital Stack', icon: '◈' },
  { id: 'waterfall', label: 'Equity Waterfall', icon: '▽' },
  { id: 'debt', label: 'Debt Products', icon: '◇' },
  { id: 'rates', label: 'Rate Strategy', icon: '◆' },
  { id: 'metrics', label: 'Key Metrics', icon: '⬡' },
];

const fmt = (v: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

const fmtM = (v: number): string => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return fmt(v);
};

export const DebtTab: React.FC<DebtTabProps> = ({
  deal,
  isPremium = false,
  dealStatus = 'pipeline',
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('stack');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('rental_value_add');
  const [layers, setLayers] = useState<CapitalLayer[]>(defaultCapitalStack.layers);

  const [liveStack, setLiveStack] = useState<any>(null);
  const [liveDebtProducts, setLiveDebtProducts] = useState<any>(null);
  const [liveRateData, setLiveRateData] = useState<any>(null);
  const [liveWaterfall, setLiveWaterfall] = useState<any>(null);
  const [liveInsights, setLiveInsights] = useState<any>(null);

  const [liveRates, setLiveRates] = useState<any>(null);
  const [rateHistory, setRateHistory] = useState<any>(null);
  const [historyPeriod, setHistoryPeriod] = useState('2y');

  const [waterfalls, setWaterfalls] = useState<any[]>([{
    id: 'default',
    name: 'Default Structure',
    ...defaultWaterfall,
    tiers: defaultWaterfall.tiers.map(t => ({ ...t })),
  }]);
  const [activeWaterfallId, setActiveWaterfallId] = useState('default');

  const [sentToProForma, setSentToProForma] = useState(false);

  const [rateSheetFile, setRateSheetFile] = useState<File | null>(null);
  const [rateSheetParsed, setRateSheetParsed] = useState<any>(null);
  const [rateSheetLoading, setRateSheetLoading] = useState(false);

  const [aiStrategy, setAiStrategy] = useState<any>(null);
  const [aiStrategyLoading, setAiStrategyLoading] = useState(false);

  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    stack: false, debt: false, rates: false, metrics: false, waterfall: false,
  });
  const [liveDataSources, setLiveDataSources] = useState<Set<TabId>>(new Set());
  const fetchedTabs = useRef<Set<TabId>>(new Set());

  const {
    financial,
    capitalStructure,
    updateCapitalStructure,
    updateDebtTerms,
    strategy: strategyCtx,
    emitEvent,
    lastEvent,
  } = useDealModule();

  const template = strategyTemplates[selectedStrategy];
  const stack = liveStack || defaultCapitalStack;

  const activeWaterfall = useMemo(() => waterfalls.find(w => w.id === activeWaterfallId) || waterfalls[0], [waterfalls, activeWaterfallId]);

  const markTabLoading = useCallback((tab: TabId, loading: boolean) => {
    setTabLoading(prev => ({ ...prev, [tab]: loading }));
  }, []);

  const markTabLive = useCallback((tab: TabId) => {
    setLiveDataSources(prev => new Set(prev).add(tab));
  }, []);

  useEffect(() => {
    const fetchStack = async () => {
      markTabLoading('stack', true);
      try {
        const res = await apiClient.post(`${API_BASE}/stack`, {
          dealId: deal.id,
          strategy: selectedStrategy,
          layers: defaultCapitalStack.layers,
          uses: defaultCapitalStack.uses,
          noi: financial?.noi || 3000000,
          propertyValue: defaultCapitalStack.uses.acquisitionPrice,
        });
        if (res.data?.stack) {
          setLiveStack(res.data.stack);
          if (res.data.stack.layers) setLayers(res.data.stack.layers);
          markTabLive('stack');
        }
      } catch {
      } finally {
        markTabLoading('stack', false);
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
    fetchedTabs.current.add('stack');
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
    if (activeTab === 'waterfall' && !fetchedTabs.current.has('waterfall')) {
      fetchedTabs.current.add('waterfall');
      const fetchWaterfall = async () => {
        markTabLoading('waterfall', true);
        try {
          const res = await apiClient.post(`${API_BASE}/waterfall`, {
            config: defaultWaterfall,
            exitProceeds: waterfallResult.exitProceeds,
            holdYears: 5,
            annualCashFlows: [],
          });
          if (res.data?.waterfall) {
            setLiveWaterfall(res.data.waterfall);
            markTabLive('waterfall');
          }
        } catch {
        } finally {
          markTabLoading('waterfall', false);
        }
      };
      fetchWaterfall();
    }
  }, [activeTab]);

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
      structureSummary: `${ltv.toFixed(0)}% LTV ${template.label} │ ${stack.metrics.cocReturn.toFixed(1)}% CoC │ ${dscr.toFixed(2)}x DSCR`,
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

  const totalSources = useMemo(() => layers.reduce((s, l) => s + l.amount, 0), [layers]);
  const balance = useMemo(() => calcSourcesEqualsUses(totalSources, stack.uses.total), [totalSources, stack.uses.total]);

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

  const computeWaterfallResult = useCallback((wf: any) => {
    const totalEquity = wf.lpCapital + wf.gpCapital;
    const exitProceeds = waterfallResult.exitProceeds;
    const profit = exitProceeds - totalEquity;
    if (profit <= 0) {
      return {
        distributions: wf.tiers.map((t: any) => ({
          tierId: t.id, tierName: t.name, lpDistribution: 0, gpDistribution: 0,
          totalDistribution: 0, cumulativeLPReturn: 0, cumulativeGPReturn: 0, irr: 0,
        })),
        lpTotalReturn: Math.min(exitProceeds, wf.lpCapital),
        gpTotalReturn: Math.max(0, exitProceeds - wf.lpCapital),
        lpIRR: 0, gpIRR: 0, lpEquityMultiple: wf.lpCapital > 0 ? Math.min(exitProceeds, wf.lpCapital) / wf.lpCapital : 0,
        gpEquityMultiple: 0, gpEffectiveShare: 0, totalDistributed: exitProceeds, exitProceeds,
      };
    }
    const prefAmount = wf.lpCapital * (wf.preferredReturn / 100);
    let remaining = profit;
    const dists: any[] = [];
    let cumLP = wf.lpCapital;
    let cumGP = wf.gpCapital;

    for (let i = 0; i < wf.tiers.length; i++) {
      const tier = wf.tiers[i];
      const nextHurdle = i < wf.tiers.length - 1 ? wf.tiers[i + 1]?.hurdleRate || 1 : 1;
      const tierAmount = Math.min(remaining, totalEquity * (nextHurdle - tier.hurdleRate));
      const lpDist = tierAmount * tier.lpSplit;
      const gpDist = tierAmount * tier.gpSplit;
      cumLP += lpDist;
      cumGP += gpDist;
      remaining -= tierAmount;
      dists.push({
        tierId: tier.id, tierName: tier.name,
        lpDistribution: lpDist, gpDistribution: gpDist,
        totalDistribution: lpDist + gpDist,
        cumulativeLPReturn: cumLP, cumulativeGPReturn: cumGP,
        irr: tier.hurdleRate * 100,
      });
      if (remaining <= 0) break;
    }

    const lpTotal = dists.reduce((s: number, d: any) => s + d.lpDistribution, 0) + wf.lpCapital;
    const gpTotal = dists.reduce((s: number, d: any) => s + d.gpDistribution, 0) + wf.gpCapital;
    const totalDist = lpTotal + gpTotal;

    return {
      distributions: dists,
      lpTotalReturn: lpTotal,
      gpTotalReturn: gpTotal,
      lpIRR: wf.lpCapital > 0 ? ((lpTotal / wf.lpCapital) - 1) * 100 / 5 : 0,
      gpIRR: wf.gpCapital > 0 ? ((gpTotal / wf.gpCapital) - 1) * 100 / 5 : 0,
      lpEquityMultiple: wf.lpCapital > 0 ? lpTotal / wf.lpCapital : 0,
      gpEquityMultiple: wf.gpCapital > 0 ? gpTotal / wf.gpCapital : 0,
      gpEffectiveShare: totalDist > 0 ? gpTotal / totalDist : 0,
      totalDistributed: totalDist,
      exitProceeds,
    };
  }, []);

  const handleSendToProForma = useCallback(() => {
    const totalDebt = layers
      .filter(l => l.layerType === 'senior' || l.layerType === 'mezz')
      .reduce((s, l) => s + l.amount, 0);
    const seniorLayer = layers.find(l => l.layerType === 'senior');

    const isFloating = seniorLayer?.source?.toLowerCase().includes('bridge') ||
      seniorLayer?.source?.toLowerCase().includes('floating');

    const terms = {
      loanAmount: totalDebt,
      loanType: seniorLayer?.source || 'bridge',
      rateType: isFloating ? 'floating' : 'fixed',
      interestRate: seniorLayer?.rate || 0,
      spread: (seniorLayer as any)?.spread || 0,
      term: seniorLayer?.term || 0,
      amortization: 360,
      ioPeriod: (seniorLayer as any)?.ioMonths || 0,
      originationFee: (seniorLayer as any)?.originationFee || 0,
      rateCapCost: (seniorLayer as any)?.rateCapCost || 0,
      indexRate: (seniorLayer as any)?.indexRate || '',
      waterfall: activeWaterfall,
      source: 'debt-equity-module',
    };

    updateDebtTerms(terms);

    emitEvent({
      source: 'M11-capital-structure',
      type: 'debt-terms-selected',
      payload: terms,
    });

    setSentToProForma(true);
    setTimeout(() => setSentToProForma(false), 3000);
  }, [layers, activeWaterfall, updateDebtTerms, emitEvent]);

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
        noi: financial?.noi || 3000000,
        holdPeriod: template.holdPeriod,
        strategy: selectedStrategy,
        loanAmount: totalDebt,
      });
      if (res.data) setAiStrategy(res.data);
    } catch {} finally {
      setAiStrategyLoading(false);
    }
  }, [layers, deal, financial, template, selectedStrategy]);

  const updateWaterfall = useCallback((id: string, updates: any) => {
    setWaterfalls(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  const updateWaterfallTier = useCallback((waterfallId: string, tierIdx: number, updates: any) => {
    setWaterfalls(prev => prev.map(w => {
      if (w.id !== waterfallId) return w;
      const newTiers = w.tiers.map((t: any, i: number) => i === tierIdx ? { ...t, ...updates } : t);
      return { ...w, tiers: newTiers };
    }));
  }, []);

  const addWaterfallTier = useCallback((waterfallId: string) => {
    setWaterfalls(prev => prev.map(w => {
      if (w.id !== waterfallId) return w;
      return {
        ...w,
        tiers: [...w.tiers, {
          id: `tier-${Date.now()}`,
          name: `Tier ${w.tiers.length + 1}`,
          hurdleRate: 0.20,
          lpSplit: 0.50,
          gpSplit: 0.50,
          description: '',
        }],
      };
    }));
  }, []);

  const removeWaterfallTier = useCallback((waterfallId: string, tierIdx: number) => {
    setWaterfalls(prev => prev.map(w => {
      if (w.id !== waterfallId) return w;
      return { ...w, tiers: w.tiers.filter((_: any, i: number) => i !== tierIdx) };
    }));
  }, []);

  const addNewWaterfall = useCallback(() => {
    const newId = `wf-${Date.now()}`;
    setWaterfalls(prev => [...prev, {
      id: newId,
      name: `Waterfall ${prev.length + 1}`,
      ...defaultWaterfall,
      dealId: deal.id,
      tiers: defaultWaterfall.tiers.map(t => ({ ...t, id: `${t.id}-${Date.now()}` })),
    }]);
    setActiveWaterfallId(newId);
  }, [deal.id]);

  const deleteWaterfall = useCallback((id: string) => {
    if (waterfalls.length <= 1) return;
    setWaterfalls(prev => prev.filter(w => w.id !== id));
    if (activeWaterfallId === id) {
      setActiveWaterfallId(waterfalls.find(w => w.id !== id)?.id || waterfalls[0].id);
    }
  }, [waterfalls, activeWaterfallId]);

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

  const renderCapitalStack = () => {
    const totalHeight = stack.uses.total;
    return (
      <div className="space-y-6">
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
          balance.balanced ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${balance.balanced ? 'text-green-600' : 'text-red-600'}`}>
              {balance.balanced ? '=' : '!'}
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Sources {fmtM(totalSources)} {balance.balanced ? '=' : '≠'} Uses {fmtM(stack.uses.total)}
              </div>
              {!balance.balanced && (
                <div className="text-xs text-red-600 mt-1">
                  {balance.imbalance > 0 ? `${fmtM(balance.imbalance)} excess sources` : `${fmtM(Math.abs(balance.imbalance))} funding gap`}
                </div>
              )}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            balance.balanced ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
          }`}>
            {balance.balanced ? 'BALANCED' : 'IMBALANCED'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Capital Stack</h4>
            <div className="flex rounded-lg overflow-hidden h-12 border border-gray-300">
              {layers.map((layer) => {
                const widthPct = (layer.amount / totalHeight) * 100;
                return (
                  <div
                    key={layer.id}
                    className={`${layer.color} relative group cursor-pointer transition-opacity hover:opacity-90`}
                    style={{ width: `${widthPct}%` }}
                    title={`${layer.name}: ${fmtM(layer.amount)} (${widthPct.toFixed(0)}%)`}
                  >
                    {widthPct > 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
                        {widthPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${layer.color}`} />
                    <span className="text-gray-700">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">{fmtPct(layer.rate)}</span>
                    <span className="font-semibold text-gray-900">{fmtM(layer.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Uses of Capital</h4>
            <div className="space-y-3">
              {[
                { label: 'Acquisition Price', value: stack.uses.acquisitionPrice },
                { label: 'Closing Costs', value: stack.uses.closingCosts },
                { label: 'Renovation Budget', value: stack.uses.renovationBudget },
                { label: 'Carrying Costs', value: stack.uses.carryingCosts },
                { label: 'Reserves', value: stack.uses.reserves },
                { label: 'Developer Fee', value: stack.uses.developerFee },
              ].map((u) => (
                <div key={u.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">{u.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{fmtM(u.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-900">Total Uses</span>
                <span className="text-lg font-bold text-gray-900">{fmtM(stack.uses.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {renderInsights(liveInsights || stackInsights)}

        <div className="flex items-center gap-4">
          <button
            onClick={handleSendToProForma}
            className="px-6 py-3 rounded-lg text-white font-semibold text-sm transition-all bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg"
          >
            Send to Pro Forma →
          </button>
          {sentToProForma && (
            <span className="text-sm font-semibold text-green-600 animate-pulse">Sent to Pro Forma ✓</span>
          )}
        </div>
      </div>
    );
  };

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
          { label: 'DSCR', value: `${stack.metrics.dscr.toFixed(2)}x`, color: stack.metrics.dscr < 1.25 ? 'text-red-600' : 'text-green-600', desc: 'Debt Service Coverage Ratio' },
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
            { label: 'Structure', value: `${stack.metrics.ltv.toFixed(0)}% LTV` },
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

  const renderEquityWaterfall = () => {
    const wf = activeWaterfall;
    const result = computeWaterfallResult(wf);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={activeWaterfallId}
            onChange={(e) => setActiveWaterfallId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white"
          >
            {waterfalls.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={addNewWaterfall}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50 transition-all"
          >
            + Add Waterfall
          </button>
          {waterfalls.length > 1 && (
            <button
              onClick={() => deleteWaterfall(activeWaterfallId)}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-300 hover:bg-red-50 transition-all"
            >
              🗑 Delete
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Waterfall Name</h4>
          <input
            type="text"
            value={wf.name}
            onChange={(e) => updateWaterfall(wf.id, { name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Equity Structure</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">LP %</span>
                <input type="number" value={wf.lpPercentage} min={0} max={100}
                  onChange={(e) => {
                    const lp = Number(e.target.value);
                    const gp = 100 - lp;
                    const totalEq = wf.lpCapital + wf.gpCapital;
                    updateWaterfall(wf.id, {
                      lpPercentage: lp, gpPercentage: gp,
                      lpCapital: totalEq * (lp / 100), gpCapital: totalEq * (gp / 100),
                    });
                  }}
                  className="w-20 px-2 py-1 rounded border border-gray-300 text-sm text-right" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">GP %</span>
                <input type="number" value={wf.gpPercentage} min={0} max={100}
                  onChange={(e) => {
                    const gp = Number(e.target.value);
                    const lp = 100 - gp;
                    const totalEq = wf.lpCapital + wf.gpCapital;
                    updateWaterfall(wf.id, {
                      lpPercentage: lp, gpPercentage: gp,
                      lpCapital: totalEq * (lp / 100), gpCapital: totalEq * (gp / 100),
                    });
                  }}
                  className="w-20 px-2 py-1 rounded border border-gray-300 text-sm text-right" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">LP Capital</span>
                <input type="number" value={wf.lpCapital} min={0} step={100000}
                  onChange={(e) => updateWaterfall(wf.id, {
                    lpCapital: Number(e.target.value),
                    totalEquity: Number(e.target.value) + wf.gpCapital,
                  })}
                  className="w-32 px-2 py-1 rounded border border-gray-300 text-sm text-right" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">GP Capital</span>
                <input type="number" value={wf.gpCapital} min={0} step={100000}
                  onChange={(e) => updateWaterfall(wf.id, {
                    gpCapital: Number(e.target.value),
                    totalEquity: wf.lpCapital + Number(e.target.value),
                  })}
                  className="w-32 px-2 py-1 rounded border border-gray-300 text-sm text-right" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-semibold text-gray-900">Total Equity</span>
                <span className="text-sm font-bold text-gray-900">{fmtM(wf.lpCapital + wf.gpCapital)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Pref Return %</span>
                <input type="number" value={wf.preferredReturn} min={0} max={30} step={0.25}
                  onChange={(e) => updateWaterfall(wf.id, { preferredReturn: Number(e.target.value) })}
                  className="w-20 px-2 py-1 rounded border border-gray-300 text-sm text-right" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">LP Returns</h4>
            <div className="text-3xl font-bold text-green-600">{fmtPct(result.lpIRR)} IRR</div>
            <div className="text-lg font-semibold text-gray-700 mt-1">{result.lpEquityMultiple.toFixed(2)}x Multiple</div>
            <div className="text-sm text-gray-600 mt-2">Total: {fmtM(result.lpTotalReturn)}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">GP Returns</h4>
            <div className="text-3xl font-bold text-purple-600">{fmtPct(result.gpIRR)} IRR</div>
            <div className="text-lg font-semibold text-gray-700 mt-1">{(result.gpEffectiveShare * 100).toFixed(0)}% Effective Share</div>
            <div className="text-sm text-gray-600 mt-2">Total: {fmtM(result.gpTotalReturn)}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Distribution Waterfall</h4>
          <div className="space-y-4">
            {result.distributions.map((dist: any) => {
              const total = result.totalDistributed || 1;
              const lpWidth = (dist.lpDistribution / total) * 100;
              const gpWidth = (dist.gpDistribution / total) * 100;
              return (
                <div key={dist.tierId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{dist.tierName}</span>
                    <span className="text-sm text-gray-600">{fmtM(dist.totalDistribution)}</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-8 bg-gray-100">
                    {lpWidth > 0 && (
                      <div className="bg-green-500 flex items-center justify-center" style={{ width: `${lpWidth}%` }}>
                        {lpWidth > 8 && <span className="text-white text-xs font-semibold">LP {fmtM(dist.lpDistribution)}</span>}
                      </div>
                    )}
                    {gpWidth > 0 && (
                      <div className="bg-purple-500 flex items-center justify-center" style={{ width: `${gpWidth}%` }}>
                        {gpWidth > 8 && <span className="text-white text-xs font-semibold">GP {fmtM(dist.gpDistribution)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {result.distributions.length > 0 && (
            <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm text-purple-900">
                <span className="font-semibold">At projected {fmtPct(result.distributions[result.distributions.length - 1]?.irr || 0)} IRR:</span>{' '}
                GP earns {(result.gpEffectiveShare * 100).toFixed(0)}% effective share on {wf.gpPercentage}% equity contribution.
                LP still nets {fmtPct(result.lpIRR)} IRR and {result.lpEquityMultiple.toFixed(2)}x multiple.
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Promote Structure</h4>
            <button
              onClick={() => addWaterfallTier(wf.id)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              + Add Tier
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">IRR Hurdle</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">LP Split</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">GP Split</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {wf.tiers.map((tier: any, idx: number) => (
                  <tr key={tier.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <input type="text" value={tier.name}
                        onChange={(e) => updateWaterfallTier(wf.id, idx, { name: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-gray-200 text-sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <input type="number" value={(tier.hurdleRate * 100).toFixed(1)} step={0.5} min={0} max={100}
                        onChange={(e) => updateWaterfallTier(wf.id, idx, { hurdleRate: Number(e.target.value) / 100 })}
                        className="w-20 px-2 py-1 rounded border border-gray-200 text-sm text-right" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <input type="number" value={(tier.lpSplit * 100).toFixed(0)} step={5} min={0} max={100}
                        onChange={(e) => {
                          const lp = Number(e.target.value) / 100;
                          updateWaterfallTier(wf.id, idx, { lpSplit: lp, gpSplit: 1 - lp });
                        }}
                        className="w-20 px-2 py-1 rounded border border-gray-200 text-sm text-right" />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <input type="number" value={(tier.gpSplit * 100).toFixed(0)} step={5} min={0} max={100}
                        onChange={(e) => {
                          const gp = Number(e.target.value) / 100;
                          updateWaterfallTier(wf.id, idx, { gpSplit: gp, lpSplit: 1 - gp });
                        }}
                        className="w-20 px-2 py-1 rounded border border-gray-200 text-sm text-right" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {idx > 0 && (
                        <button
                          onClick={() => removeWaterfallTier(wf.id, idx)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

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

      {activeTab === 'stack' && (tabLoading.stack ? renderTabLoading() : renderCapitalStack())}
      {activeTab === 'debt' && (tabLoading.debt ? renderTabLoading() : renderDebtSelector())}
      {activeTab === 'rates' && (tabLoading.rates ? renderTabLoading() : renderRateStrategy())}
      {activeTab === 'metrics' && renderKeyMetrics()}
      {activeTab === 'waterfall' && (tabLoading.waterfall ? renderTabLoading() : renderEquityWaterfall())}
    </div>
  );
};

export default DebtTab;
