/**
 * SubmarketMarketTab - Supply pipeline, absorption, employment
 */

import React, { useMemo, useEffect } from 'react';
import { Building2, TrendingUp, TrendingDown, Hammer, Clock, CheckCircle2 } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../../TerminalChart';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SupplyNarrative, SignalCommentary } from '../../commentary';

interface SubmarketMarketTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

interface PipelineProject {
  id: string;
  name: string;
  developer: string;
  units: number;
  expectedDelivery: string;
  status: 'planned' | 'approved' | 'under_construction' | 'lease_up';
  class: 'A' | 'B';
  percentComplete?: number;
}

export const SubmarketMarketTab: React.FC<SubmarketMarketTabProps> = ({ submarketId, submarket }) => {
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);

  useEffect(() => {
    fetchCommentary('submarket', submarketId, submarket.name);
  }, [submarketId, submarket.name]);
  // Pipeline projects
  const pipelineProjects: PipelineProject[] = useMemo(() => [
    { id: '1', name: 'Tower at Buckhead Station', developer: 'Wood Partners', units: 400, expectedDelivery: 'Q3 2026', status: 'under_construction', class: 'A', percentComplete: 65 },
    { id: '2', name: 'Lenox Park Residences', developer: 'Greystar', units: 280, expectedDelivery: 'Q1 2027', status: 'under_construction', class: 'A', percentComplete: 35 },
    { id: '3', name: 'Peachtree Living', developer: 'Mill Creek', units: 220, expectedDelivery: 'Q4 2026', status: 'approved', class: 'A' },
    { id: '4', name: 'Brookhaven Station', developer: 'Hines', units: 310, expectedDelivery: 'Q2 2027', status: 'under_construction', class: 'B', percentComplete: 20 },
    { id: '5', name: 'The Lindberg', developer: 'Portman Holdings', units: 450, expectedDelivery: 'Q3 2027', status: 'planned', class: 'A' },
    { id: '6', name: 'Phipps Plaza Residences', developer: 'Simon Property', units: 180, expectedDelivery: 'Q4 2026', status: 'lease_up', class: 'A', percentComplete: 100 },
  ], []);

  // Absorption data
  const absorptionData: ChartDataPoint[] = useMemo(() => {
    const quarters = ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25'];
    return quarters.map((q, i) => ({
      date: q,
      delivered: 200 + Math.floor(Math.random() * 300),
      absorbed: 180 + Math.floor(Math.random() * 350),
    }));
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'lease_up') return BT.text.green;
    if (status === 'under_construction') return BT.text.amber;
    if (status === 'approved') return BT.text.cyan;
    return BT.text.muted;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'lease_up') return 'Lease-Up';
    if (status === 'under_construction') return 'Under Const.';
    if (status === 'approved') return 'Approved';
    return 'Planned';
  };

  // Summary by status
  const summary = useMemo(() => ({
    leaseUp: pipelineProjects.filter(p => p.status === 'lease_up').reduce((sum, p) => sum + p.units, 0),
    underConstruction: pipelineProjects.filter(p => p.status === 'under_construction').reduce((sum, p) => sum + p.units, 0),
    approved: pipelineProjects.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.units, 0),
    planned: pipelineProjects.filter(p => p.status === 'planned').reduce((sum, p) => sum + p.units, 0),
  }), [pipelineProjects]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Supply Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            LEASE-UP
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            {summary.leaseUp.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>units</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.amber, marginBottom: 8 }}>
            <Hammer size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            UNDER CONST.
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            {summary.underConstruction.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>units</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            APPROVED
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {summary.approved.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>units</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            PLANNED
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.muted }}>
            {summary.planned.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>units</div>
        </div>
      </div>

      {/* Absorption Chart */}
      <TerminalChart
        title="Delivery vs Absorption (Units)"
        data={absorptionData}
        series={[
          { key: 'delivered', name: 'Delivered', color: BT.text.amber, data: [] },
          { key: 'absorbed', name: 'Absorbed', color: BT.text.green, data: [] },
        ]}
        height={200}
        valueFormatter={(v) => v.toLocaleString()}
      />

      {/* Pipeline Projects Table */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Supply Pipeline Projects
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Project</th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Developer</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.th, textAlign: 'center' }}>Class</th>
              <th style={{ ...terminalStyles.th, textAlign: 'center' }}>Status</th>
              <th style={{ ...terminalStyles.th, textAlign: 'center' }}>Delivery</th>
              <th style={{ ...terminalStyles.th, textAlign: 'center' }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {pipelineProjects.map((project) => (
              <tr key={project.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, fontWeight: 600, color: BT.text.primary }}>
                  {project.name}
                </td>
                <td style={{ ...terminalStyles.td, color: BT.text.secondary }}>
                  {project.developer}
                </td>
                <td style={{ 
                  ...terminalStyles.td, 
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}>
                  {project.units}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: project.class === 'A' ? `${BT.text.green}22` : `${BT.text.amber}22`,
                    color: project.class === 'A' ? BT.text.green : BT.text.amber,
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    {project.class}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 3,
                    background: `${getStatusColor(project.status)}22`,
                    color: getStatusColor(project.status),
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    {getStatusLabel(project.status)}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center', color: BT.text.muted }}>
                  {project.expectedDelivery}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                  {project.percentComplete !== undefined ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 60,
                        height: 6,
                        background: BT.bg.cardHover,
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${project.percentComplete}%`,
                          height: '100%',
                          background: getStatusColor(project.status),
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: BT.text.muted }}>
                        {project.percentComplete}%
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: BT.text.dim }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
