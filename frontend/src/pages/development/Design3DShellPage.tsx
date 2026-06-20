import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { Building3DEditor } from '../../components/design/Building3DEditor';
import { ThreeDErrorBoundary } from '../../components/3DErrorBoundary';
import { geoJsonToParcelBoundary } from '../../utils/geoJsonToParcel';
import { useDesignTargets, useDesignProgramStore } from '../../stores/designProgram.store';
import { dispatchModuleApplied } from '../../utils/moduleEvents';
import { apiClient } from '../../services/api.client';

interface Design3DShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function Design3DShellPage({ dealId: propDealId, deal }: Design3DShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const rawGeom = deal?.parcel_geometry ?? deal?.geometry ?? deal?.boundary ?? null;
  const parcelGeometry = rawGeom != null ? geoJsonToParcelBoundary(rawGeom) : undefined;

  // Hydrate the F3 program from the backend on mount (cold-start guard).
  // hydrateStatus guard inside loadProgram prevents duplicate calls when F3 is also open.
  const loadProgram = useDesignProgramStore((s) => s.loadProgram);
  useEffect(() => {
    if (resolvedDealId) {
      loadProgram(resolvedDealId);
    }
  }, [resolvedDealId, loadProgram]);

  // Read design targets from store (program + zoning envelope auto-combined)
  const designTargets = useDesignTargets();
  const hydrateStatus = useDesignProgramStore((s) => s.hydrateStatus);
  const isLoading = hydrateStatus === 'loading' || hydrateStatus === null;

  // ── Push to F9 ──
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'pushed'>('idle');
  const handlePushToF9 = async () => {
    if (!resolvedDealId || pushStatus === 'pushing') return;
    const units = designTargets.program.targetUnits;
    if (units <= 0) return;
    setPushStatus('pushing');
    try {
      await apiClient.patch(`/api/v1/deals/${resolvedDealId}/financials/override`, {
        field: 'totalUnits',
        value: units,
      });
      dispatchModuleApplied('design:3d', ['totalUnits']);
      setPushStatus('pushed');
      setTimeout(() => setPushStatus('idle'), 3000);
    } catch (err) {
      console.error('[Design3D] Push to F9 failed:', err);
      setPushStatus('idle');
    }
  };

  // Derive metrics from design targets for the header panel
  const headerMetrics = useMemo(() => {
    if (isLoading) {
      return [
        { l: 'FAR —', c: BT.text.purple },
        { l: '— UNITS', c: BT.text.cyan },
        { l: '— FL', c: BT.text.amber },
        { l: '—', c: BT.met.financial },
      ];
    }
    return [
      {
        l: `FAR ${designTargets.program.targetFAR.toFixed(1)}`,
        c: BT.text.purple,
      },
      {
        l: `${designTargets.program.targetUnits} UNITS`,
        c: BT.text.cyan,
      },
      {
        l: `${designTargets.program.targetFloors} FL`,
        c: BT.text.amber,
      },
      {
        l: designTargets.zoningEnvelope
          ? `${designTargets.zoningEnvelope.bindingConstraint.toUpperCase()}`
          : 'NO ZONING',
        c: BT.met.financial,
      },
    ];
  }, [designTargets, isLoading]);

  const headerSubtitle = isLoading
    ? 'M03: BUILDING ENVELOPE + MASSING + METRICS  |  LOADING…'
    : `M03: BUILDING ENVELOPE + MASSING + METRICS  |  ${designTargets.program.targetUnits}u / ${Math.round(designTargets.program.targetGFA / 1000)}K GFA`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="3D DESIGN & MASSING"
        subtitle={headerSubtitle}
        borderColor={BT.text.purple}
        metrics={headerMetrics}
        right={
          <button
            onClick={handlePushToF9}
            disabled={isLoading || designTargets.program.targetUnits <= 0 || pushStatus === 'pushing'}
            style={{
              padding: '4px 12px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: 0.5,
              color: pushStatus === 'pushed' ? BT.text.green : BT.text.purple,
              background: pushStatus === 'pushed' ? '#0f2e1f' : '#1a0a2e',
              border: `1px solid ${pushStatus === 'pushed' ? BT.text.green : BT.text.purple}`,
              borderRadius: 3,
              cursor: pushStatus === 'pushing' ? 'wait' : 'pointer',
              opacity: isLoading || designTargets.program.targetUnits <= 0 ? 0.4 : 1,
              transition: 'all 0.2s',
            }}
          >
            {pushStatus === 'idle' && 'PUSH TO F9'}
            {pushStatus === 'pushing' && 'PUSHING...'}
            {pushStatus === 'pushed' && 'PUSHED ✓'}
          </button>
        }
      />

      <BtTabWrapper>
        <ThreeDErrorBoundary>
          <Building3DEditor
            dealId={resolvedDealId}
            parcelGeometry={parcelGeometry}
            fullScreen={false}
            showMetricsPanel={false}
            designTargets={designTargets}
          />
        </ThreeDErrorBoundary>
      </BtTabWrapper>
    </div>
  );
}

export default Design3DShellPage;
