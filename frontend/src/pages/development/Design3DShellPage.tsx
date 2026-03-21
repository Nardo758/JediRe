import React from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, BtTabWrapper, SectionPanel, Bd,
} from '../../components/deal/bloomberg-ui';
import { Building3DEditor } from '../../components/design/Building3DEditor';

interface Design3DShellPageProps {
  dealId?: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

export function Design3DShellPage({ dealId: propDealId, deal }: Design3DShellPageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = propDealId || params.dealId || params.id || '';

  const parcelGeometry = (deal?.parcel_geometry ?? deal?.geometry ?? null) as unknown;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="3D DESIGN & MASSING"
        subtitle="M03 · BUILDING ENVELOPE + MASSING + METRICS"
        borderColor={BT.text.purple}
        metrics={[
          { l: 'FAR',    c: BT.text.purple },
          { l: 'UNITS',  c: BT.text.cyan   },
          { l: 'HEIGHT', c: BT.text.amber  },
          { l: 'COVER',  c: BT.met.financial },
        ]}
        right={<Bd c={BT.text.purple}>DEV ONLY</Bd>}
      />

      <BtTabWrapper>
        <Building3DEditor
          dealId={resolvedDealId}
          parcelGeometry={parcelGeometry}
          fullScreen={false}
          showMetricsPanel
        />
      </BtTabWrapper>
    </div>
  );
}

export default Design3DShellPage;
