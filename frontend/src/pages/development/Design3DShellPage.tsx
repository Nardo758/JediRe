import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { Building3DEditor } from '../../components/design/Building3DEditor';
import { ThreeDErrorBoundary } from '../../components/3DErrorBoundary';
import { geoJsonToParcelBoundary } from '../../utils/geoJsonToParcel';
import { useDesignTargets } from '../../stores/designProgram.store';

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

  // Read design targets from store (program + zoning envelope auto-combined)
  const designTargets = useDesignTargets();

  // Derive metrics from design targets for the header panel
  const headerMetrics = useMemo(() => [
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
  ], [designTargets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="3D DESIGN & MASSING"
        subtitle={`M03: BUILDING ENVELOPE + MASSING + METRICS  |  ${designTargets.program.targetUnits}u / ${Math.round(designTargets.program.targetGFA / 1000)}K GFA`}
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
