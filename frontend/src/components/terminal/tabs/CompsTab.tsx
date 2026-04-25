/**
 * CompsTab - Comparable properties + future supply pipeline
 * NEW: Includes future supply tracking for competitive analysis
 */

import React, { useState, useMemo } from 'react';
import { Building2, MapPin, TrendingUp, TrendingDown, Clock, Hammer } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../TerminalChart';
import { ContextIndicator } from '../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';

interface CompsTabProps {
  dealId: string;
  deal: any;
}

interface CompProperty {
  id: string;
  name: string;
  address: string;
  distance: number;
  units: number;
  yearBuilt: number;
  avgRent: number;
  rentPSF: number;
  occupancy: number;
  capRate?: number;
  lastSale?: number;
  saleDate?: string;
  class: 'A' | 'B' | 'C';
}

interface FutureSupply {
  id: string;
  name: string;
  address: string;
  developer: string;
  units: number;
  expectedDelivery: string;
  status: 'planning' | 'approved' | 'under_construction' | 'lease_up';
  class: 'A' | 'B' | 'C';
  distance: number;
}

export const CompsTab: React.FC<CompsTabProps> = ({ dealId, deal }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'comp_analysis', dealId }
  );

  const [activeView, setActiveView] = useState<'comps' | 'supply' | 'chart'>('comps');
  const [sortBy, setSortBy] = useState<string>('distance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Mock comp properties (would come from API)
  const comps: CompProperty[] = useMemo(() => [
    { id: '1', name: 'The Metropolitan at Phipps', address: '3630 Peachtree Rd NE', distance: 0.3, units: 320, yearBuilt: 2019, avgRent: 2150, rentPSF: 2.45, occupancy: 0.96, capRate: 0.048, lastSale: 85000000, saleDate: '2023-06', class: 'A' },
    { id: '2', name: 'Hanover Buckhead Village', address: '3035 Peachtree Rd NE', distance: 0.5, units: 370, yearBuilt: 2020, avgRent: 2280, rentPSF: 2.65, occupancy: 0.94, capRate: 0.052, class: 'A' },
    { id: '3', name: 'Alexan Buckhead', address: '2850 Piedmont Rd NE', distance: 0.7, units: 290, yearBuilt: 2018, avgRent: 1950, rentPSF: 2.28, occupancy: 0.95, capRate: 0.055, lastSale: 62000000, saleDate: '2022-11', class: 'A' },
    { id: '4', name: 'The Residence Buckhead', address: '3195 Mathieson Dr NE', distance: 0.8, units: 245, yearBuilt: 2015, avgRent: 1780, rentPSF: 2.12, occupancy: 0.93, capRate: 0.058, class: 'B' },
    { id: '5', name: 'Park at Buckhead', address: '3060 Pharr Ct North', distance: 1.0, units: 280, yearBuilt: 2016, avgRent: 1820, rentPSF: 2.18, occupancy: 0.94, class: 'B' },
    { id: '6', name: 'Gables Brookhaven', address: '686 Brookhaven Ave', distance: 1.2, units: 350, yearBuilt: 2017, avgRent: 1720, rentPSF: 2.05, occupancy: 0.96, capRate: 0.054, class: 'B' },
  ], []);

  // Mock future supply
  const futureSupply: FutureSupply[] = useMemo(() => [
    { id: '1', name: 'Tower at Buckhead Station', address: '3000 Piedmont Rd', developer: 'Wood Partners', units: 400, expectedDelivery: 'Q3 2026', status: 'under_construction', class: 'A', distance: 0.4 },
    { id: '2', name: 'Lenox Park Residences', address: '3355 Lenox Rd', developer: 'Greystar', units: 280, expectedDelivery: 'Q1 2027', status: 'under_construction', class: 'A', distance: 0.6 },
    { id: '3', name: 'Peachtree Living', address: '3400 Peachtree Rd', developer: 'Mill Creek', units: 220, expectedDelivery: 'Q4 2026', status: 'approved', class: 'A', distance: 0.8 },
    { id: '4', name: 'Brookhaven Station', address: '710 Brookhaven Dr', developer: 'Hines', units: 310, expectedDelivery: 'Q2 2027', status: 'under_construction', class: 'B', distance: 1.1 },
    { id: '5', name: 'The Lindberg', address: '2300 Lindberg Dr', developer: 'Portman Holdings', units: 450, expectedDelivery: 'Q3 2027', status: 'planning', class: 'A', distance: 1.5 },
  ], []);

  // Sort comps
  const sortedComps = useMemo(() => {
    return [...comps].sort((a, b) => {
      const aVal = a[sortBy as keyof CompProperty];
      const bVal = b[sortBy as keyof CompProperty];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [comps, sortBy, sortDir]);

  // Chart data - rent comparison
  const chartData: ChartDataPoint[] = comps.map(c => ({
    date: c.name.substring(0, 15),
    avgRent: c.avgRent,
    occupancy: c.occupancy * 100,
  }));

  const chartSeries: ChartSeries[] = [
    { key: 'avgRent', name: 'Avg Rent', color: BT.text.green, data: [] },
  ];

  // Summary stats
  const stats = useMemo(() => {
    const avgRent = comps.reduce((s, c) => s + c.avgRent, 0) / comps.length;
    const avgOcc = comps.reduce((s, c) => s + c.occupancy, 0) / comps.length;
    const totalSupply = futureSupply.reduce((s, f) => s + f.units, 0);
    const underConstruction = futureSupply.filter(f => f.status === 'under_construction').reduce((s, f) => s + f.units, 0);
    
    return { avgRent, avgOcc, totalSupply, underConstruction };
  }, [comps, futureSupply]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_construction': return BT.text.amber;
      case 'approved': return BT.text.cyan;
      case 'planning': return BT.text.muted;
      case 'lease_up': return BT.text.green;
      default: return BT.text.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'under_construction': return 'Under Construction';
      case 'approved': return 'Approved';
      case 'planning': return 'Planning';
      case 'lease_up': return 'Lease-Up';
      default: return status;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={terminalStyles.card}>
          <div style={terminalStyles.metricLabel}>COMP AVG RENT</div>
          <div style={{ ...terminalStyles.metricValue, marginTop: 8 }}>${Math.round(stats.avgRent)}</div>
        </div>
        <div style={terminalStyles.card}>
          <div style={terminalStyles.metricLabel}>COMP AVG OCC</div>
          <div style={{ ...terminalStyles.metricValue, marginTop: 8 }}>{(stats.avgOcc * 100).toFixed(1)}%</div>
        </div>
        <div style={terminalStyles.card}>
          <div style={terminalStyles.metricLabel}>FUTURE SUPPLY</div>
          <div style={{ ...terminalStyles.metricValue, marginTop: 8, color: BT.text.amber }}>{stats.totalSupply.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>units planned</div>
        </div>
        <div style={terminalStyles.card}>
          <div style={terminalStyles.metricLabel}>UNDER CONSTRUCTION</div>
          <div style={{ ...terminalStyles.metricValue, marginTop: 8 }}>{stats.underConstruction.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>units</div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'comps', label: 'Comp Properties' },
          { key: 'supply', label: 'Future Supply' },
          { key: 'chart', label: 'Rent Comparison' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${activeView === v.key ? BT.border.highlight : BT.border.subtle}`,
              background: activeView === v.key ? BT.bg.active : BT.bg.panel,
              color: activeView === v.key ? BT.text.amber : BT.text.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'comps' && (
        <div>
          <div style={terminalStyles.sectionLabel}>PEER COMPARISON</div>
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 8,
            overflow: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ ...terminalStyles.th, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    Name (BI Peers)
                  </th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('units')}>Units</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('avgRent')}>Avg Rent</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('rentPSF')}>Rent/SF</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('occupancy')}>Occ %</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('yearBuilt')}>Year Built</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('capRate')}>Cap Rate</th>
                  <th style={{ ...terminalStyles.th, cursor: 'pointer' }} onClick={() => handleSort('distance')}>Distance</th>
                  <th style={terminalStyles.th}>Class</th>
                </tr>
              </thead>
              <tbody>
                {/* Subject property row */}
                <tr style={{ background: BT.bg.panelAlt, borderBottom: `2px solid ${BT.text.amber}` }}>
                  <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.amber }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={14} />
                      {deal?.name || 'Subject Property'}
                    </div>
                    <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 2 }}>
                      {deal?.address || '1950 Piedmont Circle NE'}
                    </div>
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                    {deal?.target_units || 300}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontWeight: 600, color: BT.text.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                    ${deal?.marketContext?.avg_rent || 1850}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    $2.15
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmt.percent(deal?.marketContext?.occupancy_rate || 0.94)}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    2024
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmt.percent(deal?.marketContext?.cap_rate || 0.052)}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center', color: BT.text.amber }}>—</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: BT.text.green + '22',
                      color: BT.text.green,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>A</span>
                  </td>
                </tr>

                {/* Comp properties */}
                {sortedComps.map((comp, i) => (
                  <tr key={comp.id}>
                    <td style={terminalStyles.td}>
                      <div style={{ fontWeight: 500, color: BT.text.primary }}>{i + 1}) {comp.name}</div>
                      <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 2 }}>{comp.address}</div>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{comp.units}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>${comp.avgRent}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>${comp.rentPSF.toFixed(2)}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{fmt.percent(comp.occupancy)}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{comp.yearBuilt}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      {comp.capRate ? fmt.percent(comp.capRate) : '—'}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>{comp.distance} mi</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: comp.class === 'A' ? BT.text.green + '22' : BT.text.cyan + '22',
                        color: comp.class === 'A' ? BT.text.green : BT.text.cyan,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>{comp.class}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'supply' && (
        <div>
          <div style={terminalStyles.sectionLabel}>FUTURE SUPPLY PIPELINE</div>
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 8,
            overflow: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Project</th>
                  <th style={terminalStyles.th}>Developer</th>
                  <th style={terminalStyles.th}>Units</th>
                  <th style={terminalStyles.th}>Expected Delivery</th>
                  <th style={terminalStyles.th}>Status</th>
                  <th style={terminalStyles.th}>Distance</th>
                  <th style={terminalStyles.th}>Class</th>
                </tr>
              </thead>
              <tbody>
                {futureSupply.map(project => (
                  <tr key={project.id}>
                    <td style={terminalStyles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Hammer size={14} style={{ color: getStatusColor(project.status) }} />
                        <div>
                          <div style={{ fontWeight: 500, color: BT.text.primary }}>{project.name}</div>
                          <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 2 }}>{project.address}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>{project.developer}</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {project.units}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Clock size={12} style={{ color: BT.text.muted }} />
                        {project.expectedDelivery}
                      </div>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 4,
                        background: getStatusColor(project.status) + '22',
                        color: getStatusColor(project.status),
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {getStatusLabel(project.status)}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      {project.distance} mi
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: project.class === 'A' ? BT.text.green + '22' : BT.text.cyan + '22',
                        color: project.class === 'A' ? BT.text.green : BT.text.cyan,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>{project.class}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Supply Impact Analysis */}
          <div style={{
            marginTop: 16,
            padding: 16,
            background: `linear-gradient(135deg, ${BT.bg.panelAlt} 0%, ${BT.bg.panel} 100%)`,
            border: `1px solid ${BT.text.amber}33`,
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: BT.text.amber, fontWeight: 700, fontSize: 12 }}>
              ⚡ Supply Impact Analysis
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
                <span style={{ color: BT.text.cyan }}>→</span>
                <span>
                  <strong style={{ color: BT.text.primary }}>{stats.totalSupply.toLocaleString()} units</strong> expected to deliver within 2 years in 1.5mi radius.
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
                <span style={{ color: BT.text.cyan }}>→</span>
                <span>
                  <strong style={{ color: BT.text.primary }}>Peak delivery Q1-Q2 2027</strong> — consider timing exit before major lease-up competition.
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
                <span style={{ color: BT.text.amber }}>⚠</span>
                <span>
                  Class A concentration may pressure rents temporarily during absorption period.
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeView === 'chart' && (
        <TerminalChart
          title="Comp Rent Comparison"
          data={chartData}
          series={chartSeries}
          height={300}
          valueFormatter={(v) => `$${v.toLocaleString()}`}
          timeRanges={['All']}
          defaultRange="All"
        />
      )}
    </div>
  );
};

export default CompsTab;
