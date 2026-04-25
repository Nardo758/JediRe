/**
 * MSASupplyTab - Metro-wide supply pipeline, construction tracker, lease-up
 */

import React, { useEffect, useState } from 'react';
import { Building2, Hammer, Clock, CheckCircle2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SupplyNarrative, SignalCommentary } from '../../commentary';
import { SupplyTimelineSection } from '../../SupplyTimelineSection';

interface SupplySubmarketRow { name: string; units: number; pctOfTotal: number; status: 'HIGH' | 'MOD' | 'LOW'; projectCount?: number; }
interface SupplyApiProject { project: string; submarket?: string; units?: number; class?: string; delivery?: string; }
interface SupplyApiResponse { success: boolean; totalUnits: number; projectCount: number; bySubmarket: SupplySubmarketRow[]; projects: SupplyApiProject[]; }

interface MSASupplyTabProps {
  msaId: string;
  msa: MSAData;
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
}

export const MSASupplyTab: React.FC<MSASupplyTabProps> = ({ msaId, msa, onPropertySelect }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);

  const [pipelineBySubmarket, setPipelineBySubmarket] = useState<SupplySubmarketRow[]>([]);
  const [totalPipelineUnits, setTotalPipelineUnits] = useState<number | null>(null);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  useEffect(() => {
    apiClient.get('/georgia/supply/pipeline?state=GA&limit=100')
      .then((data: SupplyApiResponse) => {
        if (data.success) {
          if (Array.isArray(data.bySubmarket) && data.bySubmarket.length > 0) {
            setPipelineBySubmarket(data.bySubmarket);
          }
          if (data.totalUnits) setTotalPipelineUnits(data.totalUnits);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ ...terminalStyles.sectionTitle }}>
              {msaName} — Supply Pipeline
            </h2>
            {totalPipelineUnits != null && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            )}
          </div>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            Construction, deliveries, lease-up tracking
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.amber, marginBottom: 8 }}>
            TOTAL PIPELINE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            {((totalPipelineUnits ?? msa.pipelineUnits) / 1000).toFixed(1)}K
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>
            {(((totalPipelineUnits ?? msa.pipelineUnits) / msa.totalUnits) * 100).toFixed(1)}% of stock
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            LEASE-UP
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            {(msa.pipelineUnits * 0.12 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Hammer size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            UNDER CONST.
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {(msa.pipelineUnits * 0.45 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            PLANNED
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.muted }}>
            {(msa.pipelineUnits * 0.43 / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      <SupplyTimelineSection
        scope="msa"
        msaId={msaId}
        msaName={msaName}
        state={msa.state}
        onPropertySelect={onPropertySelect}
      />

      <TerminalSection title="Active Lease-Up Tracker" icon={<CheckCircle2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>No lease-up data available</div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Lease-up velocity tracking requires occupancy feed integration.</div>
        </div>
      </TerminalSection>

      <TerminalSection title="Pipeline by Submarket" icon={<Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Pipeline Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% of Total</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Pressure</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', width: 200 }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {pipelineBySubmarket.length === 0 && (
              <tr><td colSpan={5} style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>No submarket data available</td></tr>
            )}
            {pipelineBySubmarket.map((sub) => (
              <tr key={sub.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{sub.name}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {sub.units.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>
                  {sub.pctOfTotal.toFixed(1)}%
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 6px',
                    fontSize: 9,
                    fontWeight: 700,
                    background: sub.status === 'HIGH' ? `${BT.accent.red}22` : sub.status === 'MOD' ? `${BT.text.amber}22` : `${BT.text.green}22`,
                    color: sub.status === 'HIGH' ? BT.accent.red : sub.status === 'MOD' ? BT.text.amber : BT.text.green,
                  }}>
                    {sub.status}
                  </span>
                </td>
                <td style={{ ...terminalStyles.tableCell }}>
                  <div style={{ height: 8, background: BT.bg.cardHover, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sub.pctOfTotal * 2}%`, background: BT.text.amber }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TerminalSection>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating supply analysis...</span>
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
          {commentary.signalCommentary?.supply && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary
                signalKey="supply"
                commentary={commentary.signalCommentary.supply}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSASupplyTab;
