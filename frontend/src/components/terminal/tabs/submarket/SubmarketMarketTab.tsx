/**
 * SubmarketMarketTab - Supply pipeline, absorption, employment
 */

import React, { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SupplyNarrative, SignalCommentary } from '../../commentary';
import { SupplyTimelineSection } from '../../SupplyTimelineSection';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface SubmarketMarketTabProps {
  submarketId: string;
  submarket: SubmarketData;
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
}

export const SubmarketMarketTab: React.FC<SubmarketMarketTabProps> = ({ submarketId, submarket, onPropertySelect }) => {
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);

  // Neural-network context analysis for the rent/supply view. Hook lives in
  // the component body (not at module scope) so it has access to submarketId.
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'rent_trends', submarketId },
  );

  useEffect(() => {
    fetchCommentary('submarket', submarketId, submarket.name);
  // hook intentionally captures fetchCommentary via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submarketId, submarket.name]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness — neural-network-backed analyst hints, rendered
          ahead of the timeline so the user sees the "why look here" before
          the raw pipeline data. */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Pipeline & Deliveries — chart + project list driven by /api/v1/supply/pipeline-timeline */}
      <SupplyTimelineSection
        scope="submarket"
        msaId={submarket.msaId}
        msaName={submarket.msaName}
        submarketId={submarketId}
        submarketName={submarket.name}
        onPropertySelect={onPropertySelect}
      />

      {/* Market Impact Summary */}
      <div style={{
        background: `linear-gradient(135deg, ${BT.bg.panelAlt} 0%, ${BT.bg.panel} 100%)`,
        border: `1px solid ${BT.text.amber}33`,
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          color: BT.text.amber,
          fontWeight: 700,
          fontSize: 12,
        }}>
          <TrendingUp size={16} />
          Supply Impact Analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Pipeline % of Stock</div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              color: (submarket.pipelineUnits / submarket.totalUnits) < 0.08 ? BT.text.green : BT.text.amber 
            }}>
              {((submarket.pipelineUnits / submarket.totalUnits) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Est. Absorption Timeline</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.cyan }}>
              18-24 mo
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Supply Risk</div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              color: (submarket.pipelineUnits / submarket.totalUnits) < 0.08 ? BT.text.green : BT.text.amber 
            }}>
              {(submarket.pipelineUnits / submarket.totalUnits) < 0.08 ? 'Low' : 'Moderate'}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating market analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.supplyNarrative && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SupplyNarrative narrative={commentary.supplyNarrative} />
            </div>
          )}
          {commentary.signalCommentary?.momentum && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="momentum" commentary={commentary.signalCommentary.momentum} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketMarketTab;
