/**
 * SupplyTimelineSection
 *
 * Forward-looking unit deliveries chart + project list, scoped to either an MSA
 * or a Submarket. Backed by GET /api/v1/supply/pipeline-timeline.
 *
 * Used in:
 *   - MSASupplyTab (scope = "msa")
 *   - SubmarketMarketTab (scope = "submarket")
 *
 * Empty / loading / error states are first-class so users can always tell
 * "no projects yet" apart from "still loading" and "API error".
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Hammer } from 'lucide-react';
import { BT, terminalStyles } from './theme';
import { TerminalSection, DataTable } from './TerminalLayouts';
import { apiClient } from '../../api/client';

export interface SupplyTimelineProject {
  id: string;
  name: string;
  address: string | null;
  submarket: string | null;
  developer: string | null;
  units: number;
  unitsDelivering: number;
  weightedUnits: number;
  status: 'lease_up' | 'under_construction' | 'approved' | 'planned';
  deliveryDate: string | null;
  deliveryQuarter: string | null;
  propertyClass: string | null;
  propertyId: string | null;
}

export interface SupplyTimelineQuarter {
  quarter: string;
  totalUnits: number;
  weightedUnits: number;
  projectCount: number;
}

export interface SupplyTimelineResponse {
  success: boolean;
  resolved: {
    scope: 'msa' | 'submarket';
    label: string;
    msaId: string | null;
    msaName: string | null;
    state: string;
    submarketName: string | null;
    submarketId: string | null;
  };
  totals: {
    projectCount: number;
    totalUnits: number;
    weightedUnits: number;
    leaseUpUnits: number;
    underConstructionUnits: number;
    approvedUnits: number;
    plannedUnits: number;
  };
  byQuarter: SupplyTimelineQuarter[];
  projects: SupplyTimelineProject[];
}

interface SupplyTimelineSectionProps {
  scope: 'msa' | 'submarket';
  msaId: string;
  msaName?: string;
  state?: string;
  submarketId?: string;
  submarketName?: string;
  quarters?: number;
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
}

const STATUS_LABELS: Record<SupplyTimelineProject['status'], string> = {
  lease_up: 'Lease-Up',
  under_construction: 'Under Const.',
  approved: 'Approved',
  planned: 'Planned',
};

const statusColor = (status: SupplyTimelineProject['status']): string => {
  switch (status) {
    case 'lease_up': return BT.text.green;
    case 'under_construction': return BT.text.amber;
    case 'approved': return BT.text.cyan;
    case 'planned': return BT.text.muted;
  }
};

export const SupplyTimelineSection: React.FC<SupplyTimelineSectionProps> = ({
  scope,
  msaId,
  state,
  submarketId,
  submarketName,
  quarters = 8,
  onPropertySelect,
}) => {
  const [data, setData] = useState<SupplyTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (msaId) params.set('msaId', msaId);
    if (state) params.set('state', state);
    if (scope === 'submarket' && submarketName) params.set('submarketName', submarketName);
    if (scope === 'submarket' && submarketId) params.set('submarketId', submarketId);
    params.set('quarters', String(quarters));

    apiClient
      .get(`/pipeline-timeline?${params.toString()}`)
      .then((res: SupplyTimelineResponse) => {
        if (cancelled) return;
        if (!res?.success) {
          setError('Pipeline data unavailable');
          setData(null);
        } else {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load pipeline data';
        setError(msg);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [scope, msaId, state, submarketId, submarketName, quarters]);

  const chartMax = useMemo(() => {
    if (!data) return 0;
    return data.byQuarter.reduce((m, q) => Math.max(m, q.totalUnits), 0);
  }, [data]);

  const handleProjectClick = (proj: SupplyTimelineProject) => {
    if (proj.propertyId && onPropertySelect) {
      onPropertySelect(proj.propertyId, proj.name);
    }
  };

  const sectionTitle = scope === 'msa' ? 'Unit Deliveries Over Time' : 'Pipeline & Deliveries';

  if (loading) {
    return (
      <TerminalSection title={sectionTitle} icon={<Calendar size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ padding: '32px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
          Loading pipeline data…
        </div>
      </TerminalSection>
    );
  }

  if (error) {
    return (
      <TerminalSection title={sectionTitle} icon={<Calendar size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ padding: 16, borderLeft: `3px solid ${BT.accent.red}`, color: BT.text.muted, fontSize: 11 }}>
          Couldn't load pipeline data: {error}
        </div>
      </TerminalSection>
    );
  }

  if (!data || data.totals.projectCount === 0) {
    return (
      <TerminalSection title={sectionTitle} icon={<Calendar size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>
            No forward-looking pipeline projects on record for this {scope === 'msa' ? 'MSA' : 'submarket'}.
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>
            Deliveries will appear here once apartment-pipeline records are synced
            {scope === 'submarket' ? ` matching "${submarketName ?? '—'}".` : '.'}
          </div>
        </div>
      </TerminalSection>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TerminalSection title={sectionTitle} icon={<Calendar size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
        {/* Totals strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          padding: 12,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <Stat label="PROJECTS" value={data.totals.projectCount.toLocaleString()} color={BT.text.primary} />
          <Stat label="TOTAL UNITS" value={data.totals.totalUnits.toLocaleString()} color={BT.text.amber} />
          <Stat label="WEIGHTED" value={Math.round(data.totals.weightedUnits).toLocaleString()} color={BT.text.cyan} />
          <Stat
            label="UNDER CONST."
            value={data.totals.underConstructionUnits.toLocaleString()}
            color={BT.text.amber}
          />
        </div>

        {/* Quarterly bars chart */}
        <div style={{ padding: 16 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 10,
            color: BT.text.muted,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span>Total Units (amber) · Probability-Weighted (cyan)</span>
            <span>Next {data.byQuarter.length} quarters</span>
          </div>
          {chartMax === 0 ? (
            <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center', padding: '24px 0' }}>
              No projects fall within the next {data.byQuarter.length} quarters.
              {data.totals.projectCount > 0 && ' All known projects deliver beyond the chart window or have no scheduled date.'}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
              {data.byQuarter.map(q => {
                const totalH = chartMax > 0 ? Math.max(2, (q.totalUnits / chartMax) * 140) : 0;
                const weightedH = chartMax > 0 ? Math.max(0, (q.weightedUnits / chartMax) * 140) : 0;
                return (
                  <div key={q.quarter} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {q.totalUnits > 0 ? q.totalUnits.toLocaleString() : ''}
                    </div>
                    <div style={{
                      width: '100%',
                      height: 140,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: 3,
                    }}>
                      <div
                        title={`Total: ${q.totalUnits.toLocaleString()} units`}
                        style={{
                          width: '40%',
                          height: totalH,
                          background: BT.text.amber,
                          opacity: 0.85,
                        }}
                      />
                      <div
                        title={`Weighted: ${Math.round(q.weightedUnits).toLocaleString()} units`}
                        style={{
                          width: '40%',
                          height: weightedH,
                          background: BT.text.cyan,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                      {q.quarter.replace('-Q', "'").replace(/^20/, '')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TerminalSection>

      <TerminalSection
        title="Pipeline Projects"
        icon={<Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
      >
        <DataTable>
          <thead>
            <tr>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Project</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Weighted</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Class</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Status</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Delivery</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Developer</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map(proj => {
              const clickable = !!proj.propertyId && !!onPropertySelect;
              return (
                <tr
                  key={proj.id}
                  onClick={() => handleProjectClick(proj)}
                  title={
                    clickable
                      ? `Open Property Terminal for ${proj.name}`
                      : 'No linked asset for this project yet'
                  }
                  style={{
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>
                    {proj.name}
                    {proj.address && (
                      <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 2 }}>
                        {proj.address}
                      </div>
                    )}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>
                    {proj.submarket || '—'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                    {proj.units > 0 ? proj.units.toLocaleString() : '—'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                    {proj.weightedUnits > 0 ? Math.round(proj.weightedUnits).toLocaleString() : '—'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 6px',
                      background: BT.bg.elevated,
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {proj.propertyClass || '—'}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: `${statusColor(proj.status)}22`,
                      color: statusColor(proj.status),
                      fontSize: 10,
                      fontWeight: 600,
                    }}>
                      {STATUS_LABELS[proj.status]}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.amber }}>
                    {proj.deliveryQuarter || 'TBD'}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, color: BT.text.muted, fontSize: 10 }}>
                    {proj.developer || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        {data.projects.some(p => !p.propertyId) && (
          <div style={{ padding: '8px 12px', fontSize: 10, color: BT.text.muted, borderTop: `1px solid ${BT.border.subtle}` }}>
            <Hammer size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Pipeline projects without a linked asset are read-only. Asset linkage is added once an
            OM or property record is matched.
          </div>
        )}
      </TerminalSection>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 9, color: BT.text.muted, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
      {value}
    </div>
  </div>
);

export default SupplyTimelineSection;
