// ============================================================================
// ProjectionsHubTab — Projections cluster shell with sub-tab strip
// ============================================================================
//
// Sub-tabs:
//   PROJECTIONS    — read-only operating-statement projections grid (ProjectionsTab)
//   LEASE VELOCITY — Lease Velocity Engine (LVE) panel (LeaseVelocitySection)
//
// The LVE state lives here so the engine persists across sub-tab switches and
// so ProjectionsTab is a pure read-only grid with no write side-effects.
//
// Auto-seed: re-runs whenever f9Financials is a new object reference (e.g.
// after onF9Refresh or a treatment change).  Uses object-identity comparison
// to avoid redundant re-runs in React StrictMode.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { ProjectionsTab } from './ProjectionsTab';
import {
  LeaseVelocitySection,
  type LVInputs,
  type LeaseVelocityResult,
  type LeaseMode,
} from './LeaseVelocitySection';
import { apiClient } from '../../../services/api.client';
import { useDealStore } from '../../../stores/dealStore';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

type SubTab = 'projections' | 'lease-velocity';

interface ProjectionsHubTabProps extends FinancialEngineTabProps {
  integrityWarning?: boolean;
}

const DEFAULT_LV_INPUTS: LVInputs = {
  total_units: 100,
  target_occupancy: 0.95,
  current_occupancy: 0,
  mode: 'LEASE_UP_NEW_CONSTRUCTION' as LeaseMode,
  avg_market_rent: 1500,
  avg_in_place_rent: 1500,
  property_class: 'B',
  time_horizon_months: 36,
  concession_strategy: 'MARKET',
  marketing_intensity: 'MARKET',
  pre_leased_count: 0,
  leasing_cost_treatment: 'OPERATING',
};

export function ProjectionsHubTab({ integrityWarning, ...props }: ProjectionsHubTabProps) {
  const { dealId, deal, f9Financials, lvCostTreatmentView } = props;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('projections');

  // ── Lease Velocity Engine state ─────────────────────────────────────────
  const [lvInputs,     setLvInputs]     = useState<LVInputs>(DEFAULT_LV_INPUTS);
  const [lvResult,     setLvResult]     = useState<LeaseVelocityResult | null>(null);
  const [lvLoading,    setLvLoading]    = useState(false);
  const [lvError,      setLvError]      = useState<string | null>(null);
  const [lvShowConfig, setLvShowConfig] = useState(false);
  const [lvResolvedMode, setLvResolvedMode] = useState<LeaseMode>('LEASE_UP_NEW_CONSTRUCTION');

  // Track last seeded f9Financials reference to avoid redundant re-runs
  const lvLastSeedRef = useRef<typeof f9Financials>(null);

  // Stable ref to lvInputs — lets the DOM event handler always see the latest
  // inputs without being re-registered on every state change.
  const lvInputsRef = useRef<LVInputs>(DEFAULT_LV_INPUTS);
  useEffect(() => { lvInputsRef.current = lvInputs; }, [lvInputs]);

  // Core engine runner — accepts inputs directly to avoid stale-closure issues.
  // emitEvent=true only for user-triggered runs to prevent auto-seed feedback loop.
  const runLvEngine = useCallback(async (inputs: LVInputs, emitEvent = false) => {
    if (!dealId) return;
    setLvLoading(true);
    setLvError(null);
    try {
      const resp = await apiClient.post<{ success: boolean; data: LeaseVelocityResult; error?: string }>(
        '/api/v1/lease-velocity/run',
        { inputs },
      );
      if (resp.data?.success) {
        setLvResult(resp.data.data);
        if (emitEvent) {
          useDealStore.getState().emitLeaseVelocityUpdated();
        }
      } else {
        setLvError(resp.data?.error ?? 'Engine returned an error');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error
        ?? (err as { message?: string }).message
        ?? 'Request failed';
      setLvError(msg);
    } finally {
      setLvLoading(false);
    }
  }, [dealId]);

  // Re-run LVE when FloorPlanGrid positioning changes are persisted.
  // Positioning edits (percentile / capture rate) change the per-unit walk
  // absorption assumptions; dispatched by FloorPlanGrid after 800ms debounce
  // write-back succeeds (spec § data-flow: positioning → per-unit walk → Projections).
  useEffect(() => {
    const handler = () => { void runLvEngine(lvInputsRef.current, false); };
    window.addEventListener('gpr_grid.positioning_changed', handler);
    return () => window.removeEventListener('gpr_grid.positioning_changed', handler);
  }, [runLvEngine]);

  // Re-seed and re-run whenever f9Financials is a new object reference
  useEffect(() => {
    if (!f9Financials || !dealId) return;
    if (lvLastSeedRef.current === f9Financials) return;
    lvLastSeedRef.current = f9Financials;

    const occ = f9Financials.rentRollSummary?.weightedOccupancyPct ?? null;
    const autoMode: LeaseMode =
      occ == null || occ < 0.5  ? 'LEASE_UP_NEW_CONSTRUCTION'
      : occ < 0.85              ? 'OCCUPANCY_RECOVERY'
      :                           'STABILIZED_MAINTENANCE';
    const gprRow = f9Financials.proforma?.year1?.find((r: { field: string }) => r.field === 'gpr');
    const autoMktRent = gprRow?.resolved != null && f9Financials.totalUnits > 0
      ? Math.round(gprRow.resolved / f9Financials.totalUnits / 12)
      : 1500;

    const seedInputs: LVInputs = {
      ...DEFAULT_LV_INPUTS,
      total_units:           f9Financials.totalUnits || DEFAULT_LV_INPUTS.total_units,
      avg_market_rent:       autoMktRent,
      avg_in_place_rent:     Math.round(f9Financials.rentRollSummary?.avgInPlaceRent ?? autoMktRent),
      current_occupancy:     occ ?? 0,
      mode:                  autoMode,
      leasing_cost_treatment: lvCostTreatmentView ?? DEFAULT_LV_INPUTS.leasing_cost_treatment,
    };
    setLvResolvedMode(autoMode);
    setLvInputs(seedInputs);
    void runLvEngine(seedInputs);
  }, [f9Financials, dealId, runLvEngine, lvCostTreatmentView]);

  const handleModeOverride = useCallback(async (mode: LeaseMode) => {
    const next = { ...lvInputs, mode };
    setLvInputs(next);
    if (dealId) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/context`, { lease_mode_override: mode });
      } catch (err) {
        console.error('[LV] Failed to save lease_mode_override:', err);
      }
    }
    void runLvEngine(next, true);
  }, [lvInputs, dealId, runLvEngine]);

  const handleClearModeOverride = useCallback(async () => {
    const next = { ...lvInputs, mode: lvResolvedMode };
    setLvInputs(next);
    if (dealId) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/context`, { lease_mode_override: null });
      } catch (err) {
        console.error('[LV] Failed to clear lease_mode_override:', err);
      }
    }
    void runLvEngine(next, true);
  }, [lvInputs, lvResolvedMode, dealId, runLvEngine]);

  const leaseOverride = (deal?.['deal_data'] as Record<string, unknown> | null | undefined)
    ?.['lease_mode_override'] as LeaseMode | null | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Sub-tab strip ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '3px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        flexShrink: 0,
      }}>
        {([
          { key: 'projections',    label: 'PROJECTIONS' },
          { key: 'lease-velocity', label: 'LEASE VELOCITY' },
        ] as { key: SubTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              fontFamily: MONO, fontSize: 8, letterSpacing: 0.6,
              padding: '2px 10px',
              background: activeSubTab === tab.key ? BT.bg.active : 'transparent',
              color:      activeSubTab === tab.key ? BT.text.cyan : BT.text.muted,
              border:     activeSubTab === tab.key ? `1px solid ${BT.text.cyan}40` : '1px solid transparent',
              borderRadius: 2, cursor: 'pointer',
              fontWeight: activeSubTab === tab.key ? 700 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* Phase 1A: window-undefined signal — show when deal never reaches stabilization */}
        {(() => {
          const at = (f9Financials as Record<string, unknown> | null | undefined)?.adoptionTimeline as
            { effectiveStabilizationYear?: number | null; stabilizationYearOverride?: number | null } | null | undefined;
          if (!at) return null;
          if (at.effectiveStabilizationYear != null) return null;
          if ((at.stabilizationYearOverride ?? null) != null) return null;
          return (
            <span
              title="Pro Forma window undefined — deal does not reach stabilization threshold within hold period. Set an override in INPUTS."
              style={{
                marginLeft: 8,
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                color: '#d97706', background: '#1a0f00',
                border: '1px solid #f59e0b44',
                borderRadius: 2, padding: '2px 8px',
                cursor: 'default',
              }}
            >
              WINDOW UNDEFINED
            </span>
          );
        })()}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {activeSubTab === 'projections' ? (
          <ProjectionsTab {...props} integrityWarning={integrityWarning} />
        ) : (
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {!!dealId && (
              <LeaseVelocitySection
                result={lvResult}
                loading={lvLoading}
                inputs={lvInputs}
                onInputsChange={setLvInputs}
                onRun={() => void runLvEngine(lvInputs, true)}
                showConfig={lvShowConfig}
                onToggleConfig={() => setLvShowConfig(v => !v)}
                runError={lvError}
                resolvedMode={lvResolvedMode}
                leaseOverride={leaseOverride}
                onModeOverride={handleModeOverride}
                onClearOverride={handleClearModeOverride}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
}
