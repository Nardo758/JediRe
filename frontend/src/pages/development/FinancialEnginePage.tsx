import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Brain, Send, ChevronUp, ChevronDown } from 'lucide-react';
import {
  BT, BT_CSS,
  SubTabBar, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { OverviewTab } from './financial-engine/OverviewTab';
import { ProFormaSummaryTab } from './financial-engine/ProFormaSummaryTab';
import { UnitMixTab } from '../../components/deal/sections/UnitMixTab';
import { ProjectionsTab } from './financial-engine/ProjectionsTab';
import { AssumptionsTab } from './financial-engine/AssumptionsTab';
import { DebtTab } from './financial-engine/DebtTab';
import { WaterfallTab } from './financial-engine/WaterfallTab';
import { TaxesTab } from './financial-engine/TaxesTab';
import { SourcesUsesTab } from './financial-engine/SourcesUsesTab';
import { ReturnsTab } from './financial-engine/ReturnsTab';
import { SensitivityTab } from './financial-engine/SensitivityTab';
import { DecisionTab } from './financial-engine/DecisionTab';
import { CompareTab } from './financial-engine/CompareTab';
import { CostSheetTab } from '../../components/deal/sections/CostSheetTab';
import InteractiveProformaTab from './financial-engine/InteractiveProformaTab';
import { CustomTabRenderer } from './financial-engine/CustomTabRenderer';
import { exportToExcel } from './financial-engine/excel-export';
import type { ModelAssumptions, ModelResults, ModelVersion, DealType, F9DealFinancials, EvidenceFieldMeta } from './financial-engine/types';
import { fmt$, fmtPct, fmtX } from './financial-engine/types';
import { apiClient } from '../../services/api.client';
import { opusProformaService, type CustomTabRow } from '../../services/opusProforma.service';
import { F9SummaryBar } from '../../components/f9/F9SummaryBar';

// ── Helpers to merge model results into f9Financials shape ──────────────────
function cloneFinancialsForSync(src: F9DealFinancials): F9DealFinancials {
  try { return JSON.parse(JSON.stringify(src)); } catch { return src; }
}

function mergeModelIntoFinancials(
  src: F9DealFinancials,
  model: ModelResults,
  assumptions: ModelAssumptions | null
): F9DealFinancials {
  const out = cloneFinancialsForSync(src);

  // ── Returns ──
  const s = model.summary ?? {};
  out.returns = out.returns ?? {};
  out.returns.lpNetIrr          = s.lpIrr        ?? s.irr ?? null;
  out.returns.lpEquityMultiple  = s.lpEm         ?? s.equityMultiple ?? null;
  out.returns.avgCashOnCash     = s.lpCoC        ?? s.cashOnCash ?? null;
  out.returns.gpPromoteEarned   = s.gpPromoteEarned ?? null;
  out.returns.unleveragedIrr    = null;
  out.returns.unleveragedEm     = null;
  out.returns.goingInCapRate    = src.proforma?.valuation?.capRate?.resolved ?? null;
  out.returns.stabilizedCapRate = s.irr != null ? (s.irr * 0.85) : null; // fallback
  out.returns.yocUntrended      = s.yieldOnCost ?? null;
  out.returns.totalLpDistributions = s.lpTotalDistributions ?? null;
  out.returns.totalGpFees       = null;
  out.returns.totalGpPromote    = s.gpPromoteEarned ?? null;
  out.returns.gpCoInvestIrr     = s.gpIrr ?? null;
  out.returns.gpCoInvestEm      = s.gpEm ?? null;
  out.returns.gpAllInMultiple   = s.gpEm != null ? s.gpEm * 1.3 : null;
  out.returns.peakEquityDeployed = null;
  out.returns.prefAccrued       = null;
  out.returns.prefPaid          = null;
  out.returns.equityRecoveryYear = null;
  out.returns.breakevenCfYear   = null;
  out.returns.minDscr           = s.dscr ?? null;
  out.returns.maxLtv            = null;
  out.returns.avgDscr           = s.dscr ?? null;
  out.returns.avgNoiGrowth      = null;
  out.returns.gpPromoteEarned   = s.gpPromoteEarned ?? null;
  out.returns.lpTrancheReturns  = [];
  out.returns.netDistributionsByYear = (model.annualCashFlow ?? []).map(r => r.lpDistribution ?? null);
  out.returns.cumulativeCfByYear = (model.annualCashFlow ?? []).reduce<number[]>((acc, r, i) => {
    const prev = i > 0 ? acc[i - 1] : 0;
    acc.push(prev + (r.cashFlow ?? 0));
    return acc;
  }, []);
  out.returns.valuation = {
    perUnit: { goingIn: src.valuation?.perUnit ?? null, stabilized: null, atExit: null, submarketMedian: null, percentile: null },
    perSF: { netRentable: { goingIn: null, stabilized: null, atExit: null, submarketMedian: null, percentile: null } },
    multiples: { grm: { goingIn: null, submarketMedian: null }, gim: { goingIn: null, submarketMedian: null }, nim: null, opexRatio: { y1: null }, coc: { y1: null }, yieldOnCost: { untrended: null, trended: null }, devSpread: null },
    replacementCost: null,
    positionMatrix: null,
  };
  out.returns.debtMetrics = {
    coverage: {
      dscrY1: s.dscr ?? null,
      dscrMin: { value: s.dscr ?? null, year: 1 },
      dscrAvg: s.dscr ?? null,
      dyY1: null,
      dyMin: { value: null, year: null },
      icr: null,
      cashFlowCoverage: null,
      loanConstantBlended: null,
    },
    structural: {
      ltvAtClose: null,
      ltvAtStab: null,
      ltvAtMaturity: null,
      ltc: null,
      ltsv: null,
      refiOutProbability: null,
      maturityRiskScore: null,
    },
    leverage: { positiveLeverage: null, leverageSpreadBps: null, cashOnCashSpread: null, leverageIrrLiftBps: null },
    stress: { breakevenOccupancy: null, breakevenRent: null, dscrAtMinus10PctNOI: null, dscrAtPlus200bps: null, cashTrapDistanceBps: null, defaultBufferMonths: null },
    refi: { defeasanceCostToday: null, ymCostToday: null, costToRefiNowBps: null },
  };

  // ── Waterfall ──
  out.waterfall = {
    waterfallType: 'american',
    prefRate: 0.08,
    lpShare: 0.9,
    gpShare: 0.1,
    tiers: (model.waterfallDistributions ?? []).map((w, i) => ({
      triggerIrr: w.hurdleRate ?? 0.08 + i * 0.03,
      lpPct: w.lpSplit ?? 0.8 - i * 0.1,
      gpPct: w.gpSplit ?? 0.2 + i * 0.1,
      triggerType: i === 0 ? 'pref_return' : 'promote',
    })),
    fees: { acquisitionFeePct: 0.01, assetMgmtFeePct: 0.015, assetMgmtBasis: 'equity', constructionMgmtPct: 0, dispositionFeePct: 0.01, refinancingFeePct: 0 },
  };

  // ── Capital stack (preserve existing, merge loan from model) ──
  if (!out.capitalStack) out.capitalStack = {};
  out.capitalStack.purchasePrice = assumptions?.acquisition?.purchasePrice ?? src.valuation?.purchasePrice ?? 0;
  out.capitalStack.loanAmount = assumptions?.financing?.loanAmount ?? 0;
  out.capitalStack.interestRate = assumptions?.financing?.interestRate ?? 0.07;
  out.capitalStack.equityAtClose = Math.max((out.capitalStack.purchasePrice ?? 0) - (out.capitalStack.loanAmount ?? 0), 0);
  out.capitalStack.ltc = out.capitalStack.purchasePrice ? (out.capitalStack.loanAmount ?? 0) / out.capitalStack.purchasePrice : null;

  // ── Projections (time series for the projections grid) ──
  out.projections = (model.annualCashFlow ?? []).map(r => ({
    year: r.year,
    gpr: r.gpr,
    vacancy: r.vacancy,
    egr: r.egr ?? r.totalRevenue ?? 0,
    otherIncome: r.otherIncome ?? 0,
    totalRevenue: r.totalRevenue ?? 0,
    opex: r.opex ?? 0,
    noi: r.noi ?? 0,
    debtService: r.debtService ?? 0,
    cashFlow: r.cashFlow ?? 0,
    lpDistribution: r.lpDistribution ?? 0,
    gpDistribution: r.gpDistribution ?? 0,
  }));

  // ── Capital from model sourcesAndUses ──
  out.capital = {
    tranches: [
      { id: 'lpA', label: 'LP CLASS A', role: 'lp', pct: 90, prefRate: out.waterfall.prefRate, compounding: 'annual', cumulative: true, participatePromote: true },
      { id: 'gp', label: 'GP CO-INVEST', role: 'gp', pct: 10, prefRate: 0, compounding: 'annual', cumulative: false, participatePromote: true },
    ],
    schedule: (model.annualCashFlow ?? []).map((r, i) => ({
      year: r.year,
      prefAccrued: 0,
      prefPaid: Math.min((r.cashFlow ?? 0) * 0.9, 100000),
      lpDist: (r.cashFlow ?? 0) * 0.9,
      gpDist: (r.cashFlow ?? 0) * 0.1,
    })),
    metrics: { lpIrr: s.lpIrr ?? s.irr ?? 0, lpEm: s.lpEm ?? s.equityMultiple ?? 1, prefRecoveryYear: null },
  };

  return out;
}
import { EvidencePanel } from '../../components/underwriting/EvidencePanel';
import { UnderwritingWalkthrough } from '../../components/f9/UnderwritingWalkthrough';

const MONO = BT.font.mono;

// Built-in tabs always come first; custom tabs are appended after.
const BUILTIN_TAB_LABELS = [
  '⊞ OVERVIEW',
  '≡ PRO FORMA',
  '⊞ UNIT MIX',
  '⋮≡ PROJECTIONS',
  '⊕ ASSUMPTIONS',
  '$ TAXES',
  '⇄ SRC & USES',
  '⊙ DEBT',
  '◈ CAP & WFALL',
  '∿ SENSITIVITY',
  '✓ DECISION',
  '⇔ COMPARE',
  '% RETURNS',
  '₵ COST SHEET',
  '⊟ WALKTHROUGH',
  '△ INTERACTIVE PRO',
];
const BUILTIN_TAB_COUNT = BUILTIN_TAB_LABELS.length;

interface FinancialEnginePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function FinancialEnginePage({ dealId, deal: propDeal, dealType: propDealType }: FinancialEnginePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';
  const resolvedDealType: DealType = (propDealType as DealType) || 'existing';

  const [activeTab, setActiveTab] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [assumptions, setAssumptions] = useState<ModelAssumptions | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<ModelVersion | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [saveVersionName, setSaveVersionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Spec §13: "saved at HH:MM" indicator (replaces unsaved marker on save).
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [opusInput, setOpusInput] = useState('');
  const [opusSending, setOpusSending] = useState(false);
  const [opusMessages, setOpusMessages] = useState<Array<{ role: 'user' | 'opus'; text: string; ts: number }>>([]);
  const [opusExpanded, setOpusExpanded] = useState(false);
  const opusInputRef = useRef<HTMLInputElement>(null);
  const opusScrollRef = useRef<HTMLDivElement>(null);
  // Projections gating: true when Pro Forma integrity checks contain errors
  const [integrityBlocked, setIntegrityBlocked] = useState(false);
  // F9 DealFinancials — fetched here so F1/F8/F10 tabs can consume it
  const [f9Financials, setF9Financials] = useState<F9DealFinancials | null>(null);
  // Evidence system — field click panel + summary bar
  const [evidenceField, setEvidenceField] = useState<{ path: string; label: string } | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<{
    collision_summary?: { severe_count: number; material_count: number; minor_count: number; fields_with_collision?: string[]; severe_collision_fields?: string[]; material_collision_fields?: string[]; minor_collision_fields?: string[] };
    confidence_distribution?: { high: number; medium: number; low: number };
    tier_distribution?: { tier1: number; tier2: number; tier3: number; tier4: number };
    archive_percentile?: number | null;
    field_metadata?: Record<string, EvidenceFieldMeta>;
  } | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<{ type: 'collision' | 'confidence' | 'tier'; value: string } | null>(null);
  // Custom Tabs (Task #451) — Opus-generated F9 sub-tabs.
  const [customTabs, setCustomTabs] = useState<CustomTabRow[]>([]);
  const [customTabsLoading, setCustomTabsLoading] = useState(false);
  const [customTabsError, setCustomTabsError] = useState<string | null>(null);
  const [customTabMenu, setCustomTabMenu] = useState<{ tabId: string; mode: 'menu' | 'rename'; renameValue: string } | null>(null);

  const loadCustomTabs = useCallback(async () => {
    if (!resolvedDealId) return;
    setCustomTabsLoading(true);
    try {
      const tabs = await opusProformaService.listCustomTabs(resolvedDealId);
      setCustomTabs(tabs);
      // Clamp activeTab if a server-side reload removed the tab we were on
      // (e.g. another session deleted it) so we never show a blank pane.
      setActiveTab(prev => {
        const maxValid = BUILTIN_TAB_COUNT + tabs.length - 1;
        return prev > maxValid ? Math.max(0, maxValid) : prev;
      });
      setCustomTabsError(null);
    } catch (err: any) {
      setCustomTabsError(err?.message ?? 'failed to load custom tabs');
    } finally {
      setCustomTabsLoading(false);
    }
  }, [resolvedDealId]);

  useEffect(() => { void loadCustomTabs(); }, [loadCustomTabs]);

  const kpi = useMemo(() => modelResults?.summary ?? null, [modelResults]);

  useEffect(() => {
    if (!resolvedDealId) return;
    let cancelled = false;
    setKpiLoading(true);

    Promise.allSettled([
      apiClient.get(`/api/v1/financial-dashboard/${resolvedDealId}/summary`),
      apiClient.get(`/api/v1/financial-model/${resolvedDealId}/latest`),
    ]).then(([summaryRes, modelRes]) => {
      if (cancelled) return;

      if (summaryRes.status === 'fulfilled') {
        const s = (summaryRes.value as any)?.data?.data?.model?.scenarios?.base;
        if (s && typeof s.irr === 'number') {
          setModelResults(prev => ({
            ...(prev ?? { annualCashFlow: [], sourcesAndUses: { sources: [], uses: [] }, debtMetrics: null, sensitivityAnalysis: null, waterfallDistributions: [] }),
            summary: {
              irr: s.irr,
              equityMultiple: s.equityMultiple ?? 0,
              cashOnCash: s.cashOnCash ?? 0,
              noi: s.noi ?? 0,
              dscr: s.dscr ?? 0,
            },
          }));
        }
      }

      if (modelRes.status === 'fulfilled') {
        const model = (modelRes.value as any)?.data?.data;
        if (model?.results) {
          setModelResults(model.results);
        }
        if (model?.assumptions) {
          setAssumptions(model.assumptions);
        }
      }

      setKpiLoading(false);
    }).catch(() => setKpiLoading(false));

    return () => { cancelled = true; };
  }, [resolvedDealId]);

  // Version history (Spec §13). Backend returns DealVersionRow[]; map to local
  // ModelVersion shape so the existing picker UI keeps working unchanged.
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/financial-model/${resolvedDealId}/versions`).then((res: any) => {
      const data = res?.data?.data ?? res?.data ?? [];
      if (!Array.isArray(data)) return;
      const mapped: ModelVersion[] = data.map((row: any) => {
        const snap = row.layered_state_snapshot ?? row.layeredStateSnapshot ?? {};
        return {
          id: row.id,
          name: row.note || `v${row.version_number}`,
          timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          source: 'user',
          dealType: resolvedDealType,
          assumptions: snap.assumptions ?? snap,
          results: snap.results,
        };
      });
      setVersions(mapped);
      if (mapped.length > 0) {
        setLastSavedAt(mapped[0].timestamp);
      }
    }).catch(() => {});
  }, [resolvedDealId, resolvedDealType]);

  // ── F9 DealFinancials — fetched at page level for F1/F8/F10 cross-tab wiring ─
  const [f9Hold, setF9Hold] = useState<number>(5);
  const f9HoldRef = React.useRef(f9Hold);
  f9HoldRef.current = f9Hold;

  const fetchF9Financials = useCallback((hold?: number) => {
    if (!resolvedDealId) return;
    const h = hold ?? f9HoldRef.current;
    apiClient.get<{ success: boolean; data: F9DealFinancials }>(
      `/api/v1/deals/${resolvedDealId}/financials?hold=${h}`,
    ).then(res => {
      if (res.data?.data) setF9Financials(res.data.data);
    }).catch(() => {});
  }, [resolvedDealId]);

  useEffect(() => {
    fetchF9Financials();
  }, [fetchF9Financials]);

  // ── Evidence Summary — fetch collision/confidence/tier stats ─────────────
  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient.get(`/api/v1/deals/${resolvedDealId}/underwriting/evidence-summary`)
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data ?? null;
        if (d) setEvidenceSummary(d);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  // ── Evidence panel trigger — child tabs dispatch 'fe-evidence-click' ──────
  // Usage from any child tab: window.dispatchEvent(new CustomEvent('fe-evidence-click', { detail: { path: 'income.gpr', label: 'Gross Potential Rent' } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const { path, label } = (e as CustomEvent<{ path: string; label: string }>).detail ?? {};
      if (path) setEvidenceField({ path, label: label ?? path });
    };
    window.addEventListener('fe-evidence-click', handler);
    return () => window.removeEventListener('fe-evidence-click', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const idx = (e as CustomEvent<number>).detail;
      if (typeof idx === 'number') setActiveTab(idx);
    };
    window.addEventListener('fe-tab-change', handler);
    return () => window.removeEventListener('fe-tab-change', handler);
  }, []);

  // ── Merge model results into f9Financials so tabs that read
  // ── f9Financials.returns / .waterfall / .projections get populated.
  // ── This runs after every successful model build or version load.
  const mergedFinancials = useMemo(() => {
    if (!f9Financials) return null;
    if (!modelResults) return cloneFinancialsForSync(f9Financials);
    return mergeModelIntoFinancials(f9Financials, modelResults, assumptions);
  }, [f9Financials, modelResults, assumptions]);

  const handleHoldChange = useCallback((years: number) => {
    setF9Hold(years);
    fetchF9Financials(years);
  }, [fetchF9Financials]);

  const handleBuildModel = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    setBuilding(true);
    try {
      const res = await apiClient.post('/api/v1/financial-model/build', { dealId: resolvedDealId, assumptions });
      const data = (res as any)?.data;
      if (data?.data) setModelResults(data.data);
      else if (data) setModelResults(data);
    } catch (e) {
      console.error('Model build failed:', e);
    } finally {
      setBuilding(false);
    }
  }, [resolvedDealId, assumptions]);

  // Auto-build model when assumptions and financials are both available.
  // Declared after handleBuildModel to avoid a temporal dead zone reference.
  const modelBuiltRef = useRef(false);
  useEffect(() => {
    if (!resolvedDealId || !assumptions || !f9Financials) return;
    if (modelBuiltRef.current) return;
    if (modelResults) {
      modelBuiltRef.current = true;
      return;
    }
    modelBuiltRef.current = true;
    handleBuildModel();
  }, [resolvedDealId, assumptions, f9Financials, modelResults, handleBuildModel]);

  const handleSaveVersion = useCallback(async () => {
    if (!resolvedDealId || !assumptions) return;
    const name = saveVersionName.trim() || `v${versions.length + 1}`;

    // Spec §13: only insert into the local picker AFTER the server confirms
    // the version persisted. Showing a non-persisted entry would corrupt the
    // audit-trail UX (user thinks save succeeded but server has nothing).
    setShowSaveDialog(false);
    setSaveVersionName('');
    try {
      const resp = await apiClient.post(
        `/api/v1/financial-model/${resolvedDealId}/versions`,
        {
          snapshot: { assumptions, results: modelResults ?? null },
          trigger: 'user_save',
          note: name,
        }
      );
      const serverRow = (resp as any)?.data?.data ?? (resp as any)?.data;
      const persistedVersion: ModelVersion = {
        id: serverRow?.id ?? crypto.randomUUID(),
        name,
        timestamp: serverRow?.created_at ? new Date(serverRow.created_at).getTime() : Date.now(),
        source: 'user',
        dealType: resolvedDealType,
        assumptions,
        results: modelResults ?? undefined,
      };
      setVersions(prev => [persistedVersion, ...prev]);
      setActiveVersion(persistedVersion);
      setLastSavedAt(persistedVersion.timestamp);
    } catch (e: any) {
      console.warn('saveVersion failed', e);
      // Re-open the dialog so the user can retry; restore the name they typed.
      setSaveVersionName(name);
      setShowSaveDialog(true);
      // eslint-disable-next-line no-alert
      window.alert(`Save version failed: ${e?.message ?? 'unknown error'}. Please retry.`);
    }
  }, [resolvedDealId, assumptions, modelResults, saveVersionName, versions.length, resolvedDealType]);

  const handleLoadVersion = useCallback((version: ModelVersion) => {
    setActiveVersion(version);
    setAssumptions(version.assumptions);
    if (version.results) setModelResults(version.results);
    setShowVersionDropdown(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (!resolvedDealId) {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
      return;
    }
    try {
      const holdYears = assumptions?.holdPeriod ?? 5;
      const response = await fetch(
        `/api/v1/deals/${resolvedDealId}/financials/export?hold=${holdYears}`,
        { method: 'GET', credentials: 'include' },
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${assumptions?.dealInfo?.dealName ?? 'deal'}_f9_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      exportToExcel(assumptions, modelResults, assumptions?.dealInfo?.dealName);
    }
  }, [resolvedDealId, assumptions, modelResults]);

  const handleAssumptionsChange = useCallback((partial: Partial<ModelAssumptions>) => {
    setAssumptions(prev => prev ? { ...prev, ...partial } : null);
  }, []);

  useEffect(() => {
    if (opusScrollRef.current) {
      opusScrollRef.current.scrollTop = opusScrollRef.current.scrollHeight;
    }
  }, [opusMessages]);

  const handleOpusSend = useCallback(async () => {
    if (!opusInput.trim() || opusSending) return;
    const text = opusInput.trim();
    setOpusInput('');
    setOpusMessages(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setOpusSending(true);
    setOpusExpanded(true);

    const context = {
      dealId: resolvedDealId,
      dealType: resolvedDealType,
      hasModel: !!modelResults,
      kpi: kpi ? { irr: kpi.irr, em: kpi.equityMultiple, coc: kpi.cashOnCash, noi: kpi.noi, dscr: kpi.dscr } : null,
      assumptions: assumptions ? {
        purchasePrice: assumptions.purchasePrice,
        units: assumptions.units,
        exitCapRate: assumptions.exitCapRate,
        holdPeriod: assumptions.holdPeriod,
        loanType: assumptions.loanType,
        ltv: assumptions.ltv,
        interestRate: assumptions.interestRate,
      } : null,
    };

    try {
      const res = await apiClient.post('/api/v1/agents/chat', {
        agentCode: 'OPUS',
        message: text,
        dealId: resolvedDealId,
        context: { module: 'financial-engine', ...context },
      });
      const reply = (res as any)?.data?.data?.message || (res as any)?.data?.message || 'Model updated.';
      setOpusMessages(prev => [...prev, { role: 'opus', text: reply, ts: Date.now() }]);

      const actions = (res as any)?.data?.data?.actions || [];
      let switchToCustomTabId: string | null = null;
      let touchedCustomTabs = false;
      for (const action of actions) {
        if (action.type === 'update_assumptions' && action.payload) {
          setAssumptions(prev => prev ? { ...prev, ...action.payload } : null);
        }
        if (action.type === 'build_model') {
          handleBuildModel();
        }
        if (action.type === 'switch_tab' && typeof action.payload?.tab === 'number') {
          setActiveTab(action.payload.tab);
        }
        if (action.type === 'create_custom_tab' && action.payload?.tabId) {
          // Two delivery paths converge here:
          //  (1) Opus emitted an inline ```customtab fence — the backend
          //      streamChat parser already validated + persisted it, so we
          //      just need to switch to the new tab on reload.
          //  (2) The chat layer emitted a JSON `create_custom_tab` action
          //      with a full `payload.payload` (or top-level `blocks`/`title`)
          //      that has NOT been persisted yet. In that case we must POST
          //      it through the REST endpoint so it lands in the DB and
          //      gets server-side validation. Surface validator errors back
          //      into the chat thread so the user sees what was rejected.
          const p = action.payload;
          const inlineBlocks = Array.isArray(p?.payload?.blocks) ? p.payload.blocks
            : Array.isArray(p?.blocks) ? p.blocks
            : null;
          if (inlineBlocks) {
            const createPayload = {
              tabId: p.tabId,
              title: p.payload?.title ?? p.title ?? p.tabId,
              description: p.payload?.description ?? p.description,
              blocks: inlineBlocks,
            };
            try {
              const result = await opusProformaService.createCustomTab(
                resolvedDealId,
                createPayload,
                { generationPrompt: p.sourcePrompt ?? p.generationPrompt ?? undefined },
              );
              if (!result.ok) {
                // 422 from validator — show issues inline so the user understands what was rejected.
                const summary = (result.issues ?? [])
                  .map((i: any) => `${i.path ?? '$'}: ${i.message ?? 'invalid'}${
                    i.suggestions?.length ? ' (did you mean `' + i.suggestions[0] + '`)' : ''
                  }`)
                  .join('\n');
                setOpusMessages(prev => [...prev, {
                  role: 'opus',
                  text: `[customtab-validator] tab \`${p.tabId}\` rejected:\n${summary || 'unknown validation error'}`,
                  ts: Date.now(),
                }]);
              }
            } catch (err: any) {
              setOpusMessages(prev => [...prev, {
                role: 'opus',
                text: `[customtab-validator] ${err?.message ?? 'failed to persist tab'}`,
                ts: Date.now(),
              }]);
            }
          }
          switchToCustomTabId = p.tabId;
          touchedCustomTabs = true;
        }
        if (action.type === 'refresh_custom_tab' && action.payload?.tabId) {
          await opusProformaService.refreshCustomTab(resolvedDealId, action.payload.tabId);
          switchToCustomTabId = action.payload.tabId;
          touchedCustomTabs = true;
        }
        if (action.type === 'delete_custom_tab' && action.payload?.tabId) {
          await opusProformaService.deleteCustomTab(resolvedDealId, action.payload.tabId);
          touchedCustomTabs = true;
        }
      }

      // Opus may also have emitted a ```customtab fence inline (parsed by the
      // backend) — always refresh the tab list after a reply so that tabs
      // created via the streaming fence become visible without another round-trip.
      if (touchedCustomTabs || /create_custom_tab|customtab/i.test(reply)) {
        const tabs = await opusProformaService.listCustomTabs(resolvedDealId);
        setCustomTabs(tabs);
        if (switchToCustomTabId) {
          const idx = tabs.findIndex(t => t.tab_id === switchToCustomTabId);
          if (idx >= 0) setActiveTab(BUILTIN_TAB_COUNT + idx);
        } else if (tabs.length > customTabs.length) {
          // A new tab was created via the inline fence — switch to it.
          setActiveTab(BUILTIN_TAB_COUNT + 0);
        }
      }
    } catch (err: any) {
      setOpusMessages(prev => [...prev, { role: 'opus', text: `Error: ${err?.message || 'Failed to reach Opus'}`, ts: Date.now() }]);
    } finally {
      setOpusSending(false);
    }
  }, [opusInput, opusSending, resolvedDealId, resolvedDealType, modelResults, kpi, assumptions, handleBuildModel, customTabs.length]);

  const OPUS_QUICK_PROMPTS = useMemo(() => {
    const base = [
      'Build the model',
      'What IRR do I need to hit 2.0x?',
      'Run sensitivity on cap rate',
      'Increase rent growth to 4%',
      'Show debt structure',
      'Compare to market comps',
    ];
    // When the user has no custom tabs yet, surface the F9 capability via
    // three example prompts so the feature is discoverable.
    if (customTabs.length === 0) {
      return [
        ...base,
        "Add a tab comparing my numbers to the broker's",
        'Add a sensitivity tab varying just exit cap rate',
        'What modules are feeding my Year 5 NOI?',
      ];
    }
    return base;
  }, [customTabs.length]);

  // Build the displayed tab strip = built-in tabs + custom tabs (purple ✦).
  const displayTabs = useMemo(
    () => [
      ...BUILTIN_TAB_LABELS,
      ...customTabs.map(t => `✦ ${t.title.toUpperCase()}`),
    ],
    [customTabs],
  );

  const activeCustomTab: CustomTabRow | null = useMemo(
    () => activeTab >= BUILTIN_TAB_COUNT
      ? customTabs[activeTab - BUILTIN_TAB_COUNT] ?? null
      : null,
    [activeTab, customTabs],
  );

  const handleCustomTabRefresh = useCallback(async (tabId: string) => {
    if (!resolvedDealId) return;
    setCustomTabsLoading(true);
    const updated = await opusProformaService.refreshCustomTab(resolvedDealId, tabId);
    if (updated) {
      setCustomTabs(prev => prev.map(t => t.tab_id === tabId ? updated : t));
    } else {
      setCustomTabsError('Refresh failed — payload may have validation issues.');
    }
    setCustomTabsLoading(false);
    setCustomTabMenu(null);
  }, [resolvedDealId]);

  const handleCustomTabDelete = useCallback(async (tabId: string) => {
    if (!resolvedDealId) return;
    const ok = await opusProformaService.deleteCustomTab(resolvedDealId, tabId);
    if (ok) {
      setCustomTabs(prev => {
        const next = prev.filter(t => t.tab_id !== tabId);
        // If the active tab was the deleted one (or sat after it), step back
        // to the closest still-valid tab to avoid a blank pane.
        const removedIdx = prev.findIndex(t => t.tab_id === tabId);
        if (removedIdx >= 0 && activeTab >= BUILTIN_TAB_COUNT + removedIdx) {
          setActiveTab(Math.max(0, activeTab - 1));
        }
        return next;
      });
    }
    setCustomTabMenu(null);
  }, [resolvedDealId, activeTab]);

  const handleCustomTabRename = useCallback(async (tabId: string, newTitle: string) => {
    if (!resolvedDealId || !newTitle.trim()) return;
    const updated = await opusProformaService.renameCustomTab(resolvedDealId, tabId, newTitle.trim());
    if (updated) {
      setCustomTabs(prev => prev.map(t => t.tab_id === tabId ? updated : t));
    }
    setCustomTabMenu(null);
  }, [resolvedDealId]);

  const tabProps = useMemo(() => ({
    dealId: resolvedDealId,
    deal: propDeal,
    dealType: resolvedDealType,
    assumptions,
    modelResults,
    onAssumptionsChange: handleAssumptionsChange,
    onBuildModel: handleBuildModel,
    building,
    versions,
    activeVersion,
    onIntegrityChange: setIntegrityBlocked,
    f9Financials: mergedFinancials ?? f9Financials,
    onTabChange: setActiveTab,
    onF9Refresh: fetchF9Financials,
    onHoldChange: handleHoldChange,
    evidenceFilter,
    evidenceFieldMap: evidenceSummary?.field_metadata ?? undefined,
    collisionFields: evidenceSummary?.collision_summary?.fields_with_collision ?? null,
    severeCollisionFields: evidenceSummary?.collision_summary?.severe_collision_fields ?? null,
    materialCollisionFields: evidenceSummary?.collision_summary?.material_collision_fields ?? null,
    minorCollisionFields: evidenceSummary?.collision_summary?.minor_collision_fields ?? null,
  }), [resolvedDealId, propDeal, resolvedDealType, assumptions, modelResults, handleAssumptionsChange, handleBuildModel, building, versions, activeVersion, f9Financials, fetchF9Financials, handleHoldChange, evidenceFilter, evidenceSummary]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        borderTop: `2px solid ${BT.met.financial}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8, fontFamily: MONO }}>FINANCIAL ENGINE</span>
          <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>M08 · v3.1</span>
          {kpiLoading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>LOADING...</span>
            : kpi
              ? <Bd c={BT.met.financial}>LIVE MODEL</Bd>
              : <Bd c={BT.text.secondary}>NO MODEL</Bd>
          }
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>
            {resolvedDealType}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
              style={{
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {activeVersion ? activeVersion.name : `v1 Base`} ▾
            </button>
            {showVersionDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100,
                background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
                minWidth: 180, maxHeight: 200, overflow: 'auto', borderRadius: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {versions.length > 0 ? versions.map(v => (
                  <button key={v.id} onClick={() => handleLoadVersion(v)} style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                    border: 'none', color: v.id === activeVersion?.id ? BT.met.financial : BT.text.primary,
                    fontFamily: MONO, fontSize: 9, padding: '4px 8px', cursor: 'pointer',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}>
                    {v.name}
                    <span style={{ float: 'right', color: BT.text.muted, fontSize: 8 }}>
                      {v.source === 'user' ? 'User' : v.source}
                    </span>
                  </button>
                )) : (
                  <div style={{ padding: '8px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No saved versions</div>
                )}
              </div>
            )}
          </div>

          {showSaveDialog ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                value={saveVersionName}
                onChange={e => setSaveVersionName(e.target.value)}
                placeholder="Version name..."
                style={{
                  background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
                  fontFamily: MONO, fontSize: 9, padding: '2px 6px', width: 120, borderRadius: 2,
                }}
                onKeyDown={e => e.key === 'Enter' && handleSaveVersion()}
                autoFocus
              />
              <button onClick={handleSaveVersion} style={{
                background: BT.met.financial, border: 'none', color: BT.bg.terminal,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2, fontWeight: 700,
              }}>SAVE</button>
              <button onClick={() => setShowSaveDialog(false)} style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
                fontFamily: MONO, fontSize: 9, padding: '2px 6px', cursor: 'pointer', borderRadius: 2,
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveDialog(true)} style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
              fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
            }}>SAVE VERSION</button>
          )}

          {lastSavedAt != null && (
            <span
              title={`Saved ${new Date(lastSavedAt).toLocaleString()}`}
              style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}
            >
              saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          <button onClick={handleExport} style={{
            background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
            fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
          }}>EXPORT XLSX</button>

          <button onClick={handleBuildModel} disabled={building || !assumptions} style={{
            background: building ? BT.bg.active : BT.met.financial,
            border: 'none', color: building ? BT.text.muted : BT.bg.terminal,
            fontFamily: MONO, fontSize: 9, padding: '2px 10px', cursor: building ? 'default' : 'pointer',
            borderRadius: 2, fontWeight: 700, opacity: !assumptions ? 0.4 : 1,
          }}>{building ? 'BUILDING...' : 'BUILD MODEL'}</button>

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {[
            { label: 'IRR', value: kpi?.irr != null ? fmtPct(kpi.irr) : '—', color: BT.met.financial },
            { label: 'EM', value: kpi?.equityMultiple != null ? fmtX(kpi.equityMultiple) : '—', color: BT.text.amber },
            { label: 'CoC', value: kpi?.cashOnCash != null ? fmtPct(kpi.cashOnCash) : '—', color: BT.met.occupancy },
            { label: 'NOI', value: kpi?.noi != null ? fmt$(kpi.noi) : '—', color: BT.text.cyan },
            { label: 'DSCR', value: kpi?.dscr != null ? `${Number(kpi.dscr).toFixed(2)}×` : '—', color: BT.text.green },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{m.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {evidenceSummary && (
        <F9SummaryBar
          collision_summary={evidenceSummary.collision_summary}
          confidence_distribution={evidenceSummary.confidence_distribution}
          tier_distribution={evidenceSummary.tier_distribution}
          archive_percentile={evidenceSummary.archive_percentile}
          onFilterChange={setEvidenceFilter}
          activeFilter={evidenceFilter}
        />
      )}

      <div style={{ position: 'relative' }}>
        <SubTabBar
          tabs={displayTabs}
          active={activeTab}
          setActive={setActiveTab}
          color={BT.met.financial}
        />
        {/* Per-tab overflow menu — only shown for the active custom tab */}
        {activeCustomTab && (
          <div style={{ position: 'absolute', right: 6, top: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setCustomTabMenu(prev => prev?.tabId === activeCustomTab.tab_id
                ? null
                : { tabId: activeCustomTab.tab_id, mode: 'menu', renameValue: activeCustomTab.title })}
              title="Custom tab actions"
              style={{
                background: customTabMenu ? '#8B5CF620' : 'transparent',
                color: '#8B5CF6', border: `1px solid #8B5CF640`, borderRadius: 2,
                fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: '0 6px', cursor: 'pointer',
              }}
            >⋯</button>
            {customTabMenu?.tabId === activeCustomTab.tab_id && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 200,
                background: BT.bg.panel, border: `1px solid #8B5CF6`, borderRadius: 2,
                minWidth: 200, padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {customTabMenu.mode === 'menu' ? (
                  <>
                    <button
                      onClick={() => setCustomTabMenu({ ...customTabMenu, mode: 'rename' })}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: BT.text.primary, fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: 'pointer' }}
                    >Rename</button>
                    <button
                      onClick={() => handleCustomTabRefresh(activeCustomTab.tab_id)}
                      disabled={!activeCustomTab.generation_prompt || customTabsLoading}
                      title={activeCustomTab.generation_prompt ? 'Re-run the original Opus prompt' : 'No generation prompt stored — recreate the tab via Opus'}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: activeCustomTab.generation_prompt ? BT.text.primary : BT.text.muted, fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: activeCustomTab.generation_prompt ? 'pointer' : 'not-allowed' }}
                    >Refresh from Opus</button>
                    <button
                      onClick={() => { if (window.confirm(`Delete custom tab "${activeCustomTab.title}"?`)) handleCustomTabDelete(activeCustomTab.tab_id); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#FF6B6B', fontFamily: MONO, fontSize: 10, padding: '5px 8px', cursor: 'pointer' }}
                    >Delete</button>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 4, padding: 4 }}>
                    <input
                      value={customTabMenu.renameValue}
                      onChange={e => setCustomTabMenu({ ...customTabMenu, renameValue: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleCustomTabRename(activeCustomTab.tab_id, customTabMenu.renameValue); }}
                      autoFocus
                      style={{ flex: 1, background: BT.bg.input, border: `1px solid ${BT.border.medium}`, color: BT.text.primary, fontFamily: MONO, fontSize: 10, padding: '3px 6px', borderRadius: 2 }}
                    />
                    <button onClick={() => handleCustomTabRename(activeCustomTab.tab_id, customTabMenu.renameValue)}
                      style={{ background: '#8B5CF6', border: 'none', color: '#fff', fontFamily: MONO, fontSize: 9, padding: '0 8px', cursor: 'pointer', borderRadius: 2, fontWeight: 700 }}
                    >OK</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {customTabsError && (
        <div style={{
          padding: '4px 10px', background: '#FF6B6B20', color: '#FF6B6B',
          fontFamily: MONO, fontSize: 9, borderBottom: `1px solid #FF6B6B40`,
        }}>
          [custom-tabs] {customTabsError}
          <button onClick={() => setCustomTabsError(null)} style={{ float: 'right', background: 'transparent', color: '#FF6B6B', border: 'none', cursor: 'pointer', fontSize: 10 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── OPUS CHAT PANEL (LEFT) ── */}
        <div style={{
          width: opusExpanded ? 320 : 42,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: BT.bg.panel,
          borderRight: `1px solid ${BT.border.medium}`,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: opusExpanded ? '8px 10px' : '8px 0',
            justifyContent: opusExpanded ? 'flex-start' : 'center',
            borderBottom: `1px solid ${BT.border.subtle}`,
            flexShrink: 0, cursor: 'pointer',
          }} onClick={() => setOpusExpanded(!opusExpanded)}>
            <Brain size={16} color="#8B5CF6" />
            {opusExpanded && (
              <>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', letterSpacing: 0.8, fontFamily: MONO }}>OPUS</span>
                <Bd c="#8B5CF6">ENGINE CTRL</Bd>
                <div style={{ flex: 1 }} />
                <ChevronDown size={12} color={BT.text.muted} style={{ transform: opusExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              </>
            )}
          </div>

          {opusExpanded && (
            <>
              {/* Context badge */}
              <div style={{
                padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0,
              }}>
                <Bd c={BT.met.financial}>{resolvedDealType.toUpperCase()}</Bd>
                {kpi ? <Bd c={BT.text.green}>MODEL LIVE</Bd> : <Bd c={BT.text.muted}>NO MODEL</Bd>}
                {kpi?.irr != null && <Bd c={BT.met.financial}>IRR {fmtPct(kpi.irr)}</Bd>}
                {kpi?.dscr != null && <Bd c={BT.text.cyan}>DSCR {Number(kpi.dscr).toFixed(2)}×</Bd>}
              </div>

              {/* Quick prompts */}
              {opusMessages.length === 0 && (
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 6, fontFamily: MONO, letterSpacing: 0.5 }}>QUICK COMMANDS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {OPUS_QUICK_PROMPTS.map((p, i) => (
                      <button key={i} onClick={() => { setOpusInput(p); opusInputRef.current?.focus(); }} style={{
                        textAlign: 'left', background: BT.bg.panelAlt || '#0D1117', border: `1px solid ${BT.border.subtle}`,
                        color: BT.text.secondary, fontFamily: MONO, fontSize: 9, padding: '4px 8px',
                        cursor: 'pointer', borderRadius: 3, lineHeight: 1.3,
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              <div ref={opusScrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '8px 0',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {opusMessages.length === 0 && (
                  <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                    <Brain size={24} color="#8B5CF640" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, lineHeight: 1.5 }}>
                      Opus controls the Financial Engine.<br />
                      Ask questions, adjust assumptions,<br />
                      or run analysis commands.
                    </div>
                  </div>
                )}
                {opusMessages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    borderLeft: msg.role === 'opus' ? '2px solid #8B5CF6' : '2px solid ' + BT.text.amber,
                    marginLeft: msg.role === 'user' ? 20 : 0,
                    marginRight: msg.role === 'opus' ? 10 : 0,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: msg.role === 'opus' ? '#8B5CF6' : BT.text.amber, fontFamily: MONO, marginBottom: 2 }}>
                      {msg.role === 'opus' ? 'OPUS' : 'YOU'}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {opusSending && (
                  <div style={{ padding: '6px 10px', borderLeft: '2px solid #8B5CF6' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', fontFamily: MONO }}>OPUS</div>
                    <div style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, animation: 'pulse 1.5s infinite' }}>Analyzing...</div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div style={{
                padding: '8px 10px', borderTop: `1px solid ${BT.border.medium}`,
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: BT.bg.header,
              }}>
                <span style={{ color: '#8B5CF6', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{'>'}</span>
                <input
                  ref={opusInputRef}
                  value={opusInput}
                  onChange={e => setOpusInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleOpusSend(); }}
                  placeholder="Ask Opus..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: MONO, fontSize: 10, color: BT.text.primary, minWidth: 0,
                  }}
                />
                <button
                  onClick={handleOpusSend}
                  disabled={opusSending || !opusInput.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, flexShrink: 0,
                    background: opusInput.trim() ? '#8B5CF6' : 'transparent',
                    color: opusInput.trim() ? '#fff' : BT.text.muted,
                    border: opusInput.trim() ? 'none' : `1px solid ${BT.border.subtle}`,
                    borderRadius: 3, cursor: opusInput.trim() ? 'pointer' : 'default',
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── TAB CONTENT (RIGHT) ── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {activeTab === 0  && <BtTabWrapper><OverviewTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 1  && <BtTabWrapper><ProFormaSummaryTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 2  && <BtTabWrapper><UnitMixTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 3  && (
            <BtTabWrapper><ProjectionsTab {...tabProps} integrityWarning={integrityBlocked} /></BtTabWrapper>
          )}
          {activeTab === 4  && <BtTabWrapper><AssumptionsTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 5  && <BtTabWrapper><TaxesTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 6  && <BtTabWrapper><SourcesUsesTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 7  && <BtTabWrapper><DebtTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 8  && <BtTabWrapper><WaterfallTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 9  && <BtTabWrapper><SensitivityTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 10 && <BtTabWrapper><DecisionTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 11 && <BtTabWrapper><CompareTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 12 && <BtTabWrapper><ReturnsTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 14 && <BtTabWrapper><InteractiveProformaTab {...tabProps} /></BtTabWrapper>}
          {activeTab === 13 && (
            <div style={{ height: '100%', overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column' }}>
              <CostSheetTab
                dealId={tabProps.dealId}
                deal={tabProps.deal as Record<string, any> | undefined}
                assumptions={tabProps.assumptions as Record<string, any> | null | undefined}
                f9Financials={tabProps.f9Financials}
              />
            </div>
          )}
          {activeTab === 14 && (
            <BtTabWrapper>
              <UnderwritingWalkthrough dealId={resolvedDealId} />
            </BtTabWrapper>
          )}
          {activeCustomTab && (
            <BtTabWrapper>
              <CustomTabRenderer
                payload={activeCustomTab.payload}
                modelVersion={activeCustomTab.model_version}
                description={activeCustomTab.description}
                data={{
                  assumptions,
                  results: modelResults,
                  f9: f9Financials,
                  deal: propDeal as Record<string, any> | undefined,
                  // F9DealFinancials.projections is the per-year time-series
                  // object array (year/noi/cfads/dscr/...), matching the
                  // catalog's `projections[*].{year,noi,revenue,...}` contract
                  // — distinct from the row-oriented ProjectionRow[] on
                  // ModelResults.projections used by the projections grid.
                  projections: f9Financials?.projections ?? null,
                }}
                evidenceFieldMap={evidenceSummary?.field_metadata ?? undefined}
              />
            </BtTabWrapper>
          )}
        </div>
      </div>

      {/* ── EVIDENCE PANEL OVERLAY ──────────────────────────────────────────── */}
      {evidenceField && (
        <EvidencePanel
          dealId={resolvedDealId}
          fieldPath={evidenceField.path}
          fieldLabel={evidenceField.label}
          onClose={() => setEvidenceField(null)}
          onOverride={(fieldPath, value, reason) => {
            console.log('[EvidencePanel] override', fieldPath, value, reason);
            setEvidenceField(null);
          }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default FinancialEnginePage;
