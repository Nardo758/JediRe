import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, DataRow, SectionPanel, Bd,
} from '../../components/deal/bloomberg-ui';
import { Building3DEditor } from '../../components/design/Building3DEditor';
import { ThreeDErrorBoundary } from '../../components/3DErrorBoundary';
import { useDesign3DStore } from '../../stores/design/design3d.store';
import { geoJsonToParcelBoundary } from '../../utils/geoJsonToParcel';
import { apiClient } from '../../services/api.client';
import type { Design3D } from '../../types/financial.types';

interface Design3DShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

interface Metrics {
  far: number | null;
  units: number | null;
  stories: number | null;
  cover: number | null;
}

export function Design3DShellPage({ dealId: propDealId, deal: propDeal }: Design3DShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const [design3D, setDesign3D] = useState<Design3D | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({ far: null, units: null, stories: null, cover: null });

  const rawGeometry = propDeal?.parcel_geometry ?? propDeal?.geometry ?? null;
  const parcelGeometry = rawGeometry != null
    ? geoJsonToParcelBoundary(rawGeometry)
    : undefined;

  const activeScenarioId = useDesign3DStore((s) => s.activeScenarioId);

  const handleSave = useCallback(async (silent = false) => {
    if (!resolvedDealId) return;
    try {
      await useDesign3DStore.getState().saveToServer(resolvedDealId, activeScenarioId ?? undefined);
      if (!silent) setHasUnsavedChanges(false);
    } catch (_) {}
  }, [resolvedDealId, activeScenarioId]);

  useEffect(() => {
    if (!resolvedDealId) return;
    apiClient
      .get<{ data?: { design3d?: Design3D } }>(`/api/v1/deals/${resolvedDealId}/design3d`)
      .then((res) => {
        const d = res.data?.data?.design3d;
        if (d) setDesign3D(d);
      })
      .catch(() => {});
  }, [resolvedDealId]);

  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || !design3D) return;
    const t = setTimeout(() => handleSave(true), 5000);
    return () => clearTimeout(t);
  }, [design3D, hasUnsavedChanges, autoSaveEnabled, handleSave]);

  const handleMetricsChange = useCallback((m: Record<string, number>) => {
    const updated: Design3D = {
      id: design3D?.id ?? `${resolvedDealId}-design`,
      dealId: resolvedDealId,
      totalUnits: m.totalUnits ?? 0,
      unitMix: design3D?.unitMix ?? { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0 },
      rentableSF: m.rentableSF ?? 0,
      grossSF: m.grossSF ?? 0,
      efficiency: m.efficiency ?? 0.85,
      parkingSpaces: m.parkingSpaces ?? 0,
      parkingType: (design3D?.parkingType ?? 'surface') as Design3D['parkingType'],
      amenitySF: m.amenitySF ?? 0,
      stories: m.stories ?? 1,
      farUtilized: m.farUtilized ?? 0,
      farMax: design3D?.farMax,
      lastModified: new Date().toISOString(),
    };
    setDesign3D(updated);
    setHasUnsavedChanges(true);
    setMetrics({
      far:    m.farUtilized != null ? +m.farUtilized.toFixed(2) : null,
      units:  m.totalUnits  != null ? Math.round(m.totalUnits)  : null,
      stories: m.stories    != null ? Math.round(m.stories)     : null,
      cover:  m.lotCoverage != null ? +m.lotCoverage.toFixed(2) : null,
    });
  }, [design3D, resolvedDealId]);

  const fmtNum = (v: number | null, suffix = '') =>
    v != null ? `${v}${suffix}` : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="3D DESIGN & MASSING"
        subtitle="M03 · BUILDING ENVELOPE + MASSING + METRICS"
        borderColor={BT.text.purple}
        metrics={[
          { l: 'FAR',    c: BT.text.purple   },
          { l: 'UNITS',  c: BT.text.cyan     },
          { l: 'HEIGHT', c: BT.text.amber    },
          { l: 'COVER',  c: BT.met.financial },
        ]}
        right={
          hasUnsavedChanges
            ? <Bd c={BT.text.amber}>UNSAVED</Bd>
            : <Bd c={BT.text.purple}>DEV ONLY</Bd>
        }
      />

      <div style={{ display: 'flex', gap: 1, background: BT.border.subtle, padding: 1, flexShrink: 0 }}>
        <SectionPanel title="MASSING METRICS" subtitle="LIVE · EDITOR OUTPUT" borderColor={BT.text.purple} style={{ flex: 1, minWidth: 0 }}>
          <DataRow label="FAR UTILIZED"    value={fmtNum(metrics.far)}              valueColor={BT.text.purple}   />
          <DataRow label="TOTAL UNITS"     value={fmtNum(metrics.units)}            valueColor={BT.text.cyan}     />
          <DataRow label="STORIES"         value={fmtNum(metrics.stories)}          valueColor={BT.text.amber}    />
          <DataRow label="LOT COVERAGE"    value={fmtNum(metrics.cover, 'x')}       valueColor={BT.met.financial} />
        </SectionPanel>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ThreeDErrorBoundary>
          <Building3DEditor
            dealId={resolvedDealId}
            parcelGeometry={parcelGeometry}
            fullScreen={false}
            showMetricsPanel
            onMetricsChange={handleMetricsChange}
            onSave={() => handleSave(false)}
          />
        </ThreeDErrorBoundary>
      </div>
    </div>
  );
}

export default Design3DShellPage;
