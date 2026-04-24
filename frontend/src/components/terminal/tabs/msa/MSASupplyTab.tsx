/**
 * MSASupplyTab - Metro-wide supply pipeline, construction tracker, lease-up
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Building2, Hammer, Clock, CheckCircle2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { apiClient } from '../../../../api/client';
import { SupplyNarrative, SignalCommentary } from '../../commentary';

interface MSASupplyTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSASupplyTab: React.FC<MSASupplyTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);

  const [pipelineBySubmarket, setPipelineBySubmarket] = useState<any[]>([]);
  const [constructionTracker, setConstructionTracker] = useState<any[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [totalPipelineUnits, setTotalPipelineUnits] = useState<number | null>(null);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  useEffect(() => {
    setPipelineLoading(true);
    apiClient.get('/georgia/supply/pipeline?state=GA&limit=100')
      .then((data: any) => {
        if (data.success) {
          if (Array.isArray(data.bySubmarket) && data.bySubmarket.length > 0) {
            setPipelineBySubmarket(data.bySubmarket);
          }
          if (Array.isArray(data.projects) && data.projects.length > 0) {
            setConstructionTracker(data.projects.slice(0, 20).map((p: any) => ({
              project: p.project,
              submarket: p.submarket,
              units: p.units,
              class: p.class || 'B',
              delivery: p.delivery,
              pctComplete: null,
              developer: null,
            })));
          }
          if (data.totalUnits) setTotalPipelineUnits(data.totalUnits);
        }
      })
      .catch(() => {})
      .finally(() => setPipelineLoading(false));
  }, []);

  const deliveryData: ChartDataPoint[] = useMemo(() => {
    return [
      { date: 'Q1 25', delivered: 4200, absorbed: 4500 },
      { date: 'Q2 25', delivered: 5100, absorbed: 4800 },
      { date: 'Q3 25', delivered: 6200, absorbed: 5500 },
      { date: 'Q4 25', delivered: 5800, absorbed: 6100 },
      { date: 'Q1 26', delivered: 4500, absorbed: 4200 },
      { date: 'Q2 26', delivered: 3800, absorbed: 4100 },
    ];
  }, []);

  const leaseUpTracker = useMemo(() => [
    { project: 'The Hamilton', submarket: 'Midtown', units: 310, monthsOpen: 8, occupancy: 82, velocity: 22, targetDate: 'Aug 2026' },
    { project: 'Broadstone Perimeter', submarket: 'Perimeter', units: 260, monthsOpen: 5, occupancy: 64, velocity: 28, targetDate: 'Nov 2026' },
    { project: 'Elan Sandy Springs', submarket: 'Sandy Springs', units: 200, monthsOpen: 3, occupancy: 42, velocity: 18, targetDate: 'Feb 2027' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Supply Pipeline
          </h2>
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

      <TerminalChart
        title="Delivery vs Absorption (Units)"
        data={deliveryData}
        series={[
          { key: 'delivered', name: 'Delivered', color: BT.text.amber, data: [] },
          { key: 'absorbed', name: 'Absorbed', color: BT.text.green, data: [] },
        ]}
        height={200}
        valueFormatter={(v) => v.toLocaleString()}
      />

      <TerminalSection title="Under Construction Tracker" icon={<Hammer size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Project</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Class</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Delivery</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Developer</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', width: 120 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {constructionTracker.map((proj) => (
              <tr key={proj.project} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{proj.project}</td>
                <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>{proj.submarket}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{proj.units}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                  <span style={{ padding: '2px 6px', background: BT.bg.elevated, fontSize: 10, fontWeight: 600 }}>{proj.class}</span>
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.amber }}>{proj.delivery}</td>
                <td style={{ ...terminalStyles.tableCell, color: BT.text.muted, fontSize: 10 }}>{proj.developer}</td>
                <td style={{ ...terminalStyles.tableCell }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 6, background: BT.bg.elevated, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${proj.pctComplete}%`, background: BT.text.cyan }} />
                    </div>
                    <span style={{ fontSize: 10, color: BT.text.primary, fontFamily: "'JetBrains Mono'" }}>{proj.pctComplete}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TerminalSection>

      <TerminalSection title="Active Lease-Up Tracker" icon={<CheckCircle2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Project</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Months Open</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Occupancy</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Velocity/mo</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Stabilize By</th>
            </tr>
          </thead>
          <tbody>
            {leaseUpTracker.map((proj) => (
              <tr key={proj.project} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{proj.project}</td>
                <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>{proj.submarket}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{proj.units}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{proj.monthsOpen}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                  <span style={{ color: proj.occupancy >= 90 ? BT.text.green : proj.occupancy >= 70 ? BT.text.amber : BT.text.primary, fontWeight: 600 }}>
                    {proj.occupancy}%
                  </span>
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.cyan }}>
                  {proj.velocity}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>{proj.targetDate}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
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
