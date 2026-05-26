import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { Building3DEditor } from '../../components/design/Building3DEditor';
import { ThreeDErrorBoundary } from '../../components/3DErrorBoundary';
import { geoJsonToParcelBoundary } from '../../utils/geoJsonToParcel';
import { useDesignTargets, useDesignProgramStore } from '../../stores/designProgram.store';

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
