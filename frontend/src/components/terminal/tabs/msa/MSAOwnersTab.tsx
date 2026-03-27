/**
 * MSAOwnersTab - Active Owners intelligence with buy/sell signals
 * Integrated from pre-Bloomberg ActiveOwnersPage (27KB)
 * Features: Owner rankings, portfolios, motivation signals, land positions
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { scoreColor } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { RiskOpportunity } from '../../commentary';

interface MSAOwnersTabProps {
  msaId: string;
  msa: any;
  onSelectProperty?: (propertyId: string) => void;
}

type SignalType = 'BUY' | 'SELL' | 'SELL?' | 'HOLD';
type OwnerType = 'REIT' | 'Private Equity' | 'Family Office' | 'Syndicator' | 'Developer' | 'Institution';

interface Owner {
  id: string;
  name: string;
  type: OwnerType;
  propertyCount: number;
  totalUnits: number;
  avgHoldPeriod: number;
  avgPcsPercentile: number;
  signal: SignalType;
  signalConfidence: number;
  markets: string[];
  recentActivity: string;
  landPositions?: { parcel: string; acres: number; capacity: string; probability: string; status: string }[];
}

interface OwnerProperty {
  name: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: string;
  purchaseDate: string;
  holdYears: number;
  pcsRank: number;
  pcsPercentile: number;
  debtMaturity: string;
  motivation: number;
}

const SIGNAL_STYLES: Record<SignalType, { bg: string; text: string; label: string }> = {
  'BUY': { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Likely Buyer' },
  'SELL': { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Likely Seller' },
  'SELL?': { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Potential Seller' },
  'HOLD': { bg: 'rgba(107,114,128,0.15)', text: '#6b7280', label: 'Holding' },
};

const OWNER_TYPE_COLORS: Record<OwnerType, string> = {
  'REIT': '#3b82f6',
  'Private Equity': '#8b5cf6',
  'Family Office': '#14b8a6',
  'Syndicator': '#f97316',
  'Developer': '#ec4899',
  'Institution': '#6b7280',
};

// Mock owner data
const MOCK_OWNERS: Owner[] = [
  {
    id: 'greystone',
    name: 'Greystone Capital Partners',
    type: 'Private Equity',
    propertyCount: 8,
    totalUnits: 2240,
    avgHoldPeriod: 5.8,
    avgPcsPercentile: 31,
    signal: 'SELL',
    signalConfidence: 84,
    markets: ['Atlanta', 'Charlotte', 'Nashville'],
    recentActivity: 'Sold 2 assets in Q4 2025',
    landPositions: [
      { parcel: 'Parcel A — Midtown ATL', acres: 4.2, capacity: '380 units', probability: '72%', status: 'Entitled' },
      { parcel: 'Parcel B — SouthEnd CLT', acres: 2.8, capacity: '220 units', probability: '58%', status: 'Pre-zoning' },
    ],
  },
  {
    id: 'cortland',
    name: 'Cortland Partners',
    type: 'REIT',
    propertyCount: 12,
    totalUnits: 3840,
    avgHoldPeriod: 4.2,
    avgPcsPercentile: 68,
    signal: 'BUY',
    signalConfidence: 76,
    markets: ['Atlanta', 'Dallas', 'Denver', 'Phoenix'],
    recentActivity: 'Acquired 3 assets YTD 2026',
  },
  {
    id: 'trammell',
    name: 'Trammell Crow Residential',
    type: 'Developer',
    propertyCount: 5,
    totalUnits: 1680,
    avgHoldPeriod: 3.1,
    avgPcsPercentile: 82,
    signal: 'SELL?',
    signalConfidence: 62,
    markets: ['Atlanta', 'Austin', 'Nashville'],
    recentActivity: 'Stabilizing 2 new developments',
  },
  {
    id: 'peachtree',
    name: 'Peachtree Residential',
    type: 'Syndicator',
    propertyCount: 6,
    totalUnits: 1120,
    avgHoldPeriod: 6.4,
    avgPcsPercentile: 28,
    signal: 'SELL',
    signalConfidence: 91,
    markets: ['Atlanta'],
    recentActivity: 'Debt maturing Q2-Q3 2026',
  },
  {
    id: 'starwood',
    name: 'Starwood Capital',
    type: 'Institution',
    propertyCount: 4,
    totalUnits: 1480,
    avgHoldPeriod: 7.2,
    avgPcsPercentile: 45,
    signal: 'HOLD',
    signalConfidence: 58,
    markets: ['Atlanta', 'Tampa', 'Orlando'],
    recentActivity: 'No recent transactions',
  },
  {
    id: 'bridge',
    name: 'Bridge Investment Group',
    type: 'Private Equity',
    propertyCount: 7,
    totalUnits: 2080,
    avgHoldPeriod: 4.8,
    avgPcsPercentile: 54,
    signal: 'BUY',
    signalConfidence: 68,
    markets: ['Atlanta', 'Charlotte', 'Raleigh'],
    recentActivity: 'Active acquirer, closed 2 deals',
  },
];

// Mock portfolio properties
const MOCK_PORTFOLIO: Record<string, OwnerProperty[]> = {
  'greystone': [
    { name: 'Pines at Midtown', submarket: 'Midtown', units: 180, yearBuilt: 1992, class: 'B', purchaseDate: 'Mar 2019', holdYears: 6.9, pcsRank: 3, pcsPercentile: 31, debtMaturity: 'Q3 2026', motivation: 78 },
    { name: 'Decatur Station', submarket: 'Decatur', units: 156, yearBuilt: 1985, class: 'C+', purchaseDate: 'Jun 2020', holdYears: 5.7, pcsRank: 12, pcsPercentile: 28, debtMaturity: 'Q4 2026', motivation: 72 },
    { name: 'Sandy Springs Gardens', submarket: 'Sandy Springs', units: 240, yearBuilt: 1998, class: 'B+', purchaseDate: 'Sep 2018', holdYears: 7.4, pcsRank: 8, pcsPercentile: 35, debtMaturity: 'Q1 2026', motivation: 85 },
  ],
  'cortland': [
    { name: 'Buckhead Grand', submarket: 'Buckhead', units: 320, yearBuilt: 2020, class: 'A', purchaseDate: 'Jan 2023', holdYears: 3.1, pcsRank: 2, pcsPercentile: 92, debtMaturity: 'Q2 2028', motivation: 22 },
    { name: 'Midtown Tower', submarket: 'Midtown', units: 280, yearBuilt: 2019, class: 'A', purchaseDate: 'Apr 2022', holdYears: 3.9, pcsRank: 5, pcsPercentile: 78, debtMaturity: 'Q4 2027', motivation: 18 },
  ],
};

export const MSAOwnersTab: React.FC<MSAOwnersTabProps> = ({ msaId, msa, onSelectProperty }) => {
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<string>('All');
  const [signalFilter, setSignalFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<'propertyCount' | 'totalUnits' | 'signalConfidence'>('signalConfidence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  // Filter and sort owners
  const filteredOwners = useMemo(() => {
    let result = MOCK_OWNERS.filter(o => {
      if (ownerTypeFilter !== 'All' && o.type !== ownerTypeFilter) return false;
      if (signalFilter !== 'All' && o.signal !== signalFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [ownerTypeFilter, signalFilter, sortKey, sortDir]);

  // Summary stats
  const stats = useMemo(() => ({
    totalOwners: MOCK_OWNERS.length,
    totalProperties: MOCK_OWNERS.reduce((sum, o) => sum + o.propertyCount, 0),
    totalUnits: MOCK_OWNERS.reduce((sum, o) => sum + o.totalUnits, 0),
    likelySellers: MOCK_OWNERS.filter(o => o.signal === 'SELL' || o.signal === 'SELL?').length,
    likelyBuyers: MOCK_OWNERS.filter(o => o.signal === 'BUY').length,
  }), []);

  const ownerTypes = ['All', ...Array.from(new Set(MOCK_OWNERS.map(o => o.type)))];
  const signals = ['All', 'BUY', 'SELL', 'SELL?', 'HOLD'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Active Owners
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {stats.totalOwners} owners · {stats.totalProperties} properties · {stats.totalUnits.toLocaleString()} units
          </span>
        </div>
      </div>

      {/* Signal Summary */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{
          flex: 1,
          padding: 16,
          background: SIGNAL_STYLES.SELL.bg,
          borderRadius: 0,
          borderLeft: `4px solid ${SIGNAL_STYLES.SELL.text}`,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: SIGNAL_STYLES.SELL.text }}>
            {stats.likelySellers}
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Likely Sellers</div>
          <div style={{ fontSize: 10, color: SIGNAL_STYLES.SELL.text, marginTop: 4 }}>
            {MOCK_OWNERS.filter(o => o.signal === 'SELL').reduce((sum, o) => sum + o.totalUnits, 0).toLocaleString()} units at risk
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: 16,
          background: SIGNAL_STYLES.BUY.bg,
          borderRadius: 0,
          borderLeft: `4px solid ${SIGNAL_STYLES.BUY.text}`,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: SIGNAL_STYLES.BUY.text }}>
            {stats.likelyBuyers}
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Active Buyers</div>
          <div style={{ fontSize: 10, color: SIGNAL_STYLES.BUY.text, marginTop: 4 }}>
            Strong acquisition appetite
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: 16,
          background: BT.bg.elevated,
          borderRadius: 0,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.primary }}>
            5.2yr
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Avg Hold Period</div>
          <div style={{ fontSize: 10, color: BT.text.cyan, marginTop: 4 }}>
            Market average
          </div>
        </div>
        <div style={{
          flex: 1,
          padding: 16,
          background: BT.bg.elevated,
          borderRadius: 0,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.primary }}>
            42%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted }}>Concentration (Top 5)</div>
          <div style={{ fontSize: 10, color: BT.accent.amber, marginTop: 4 }}>
            Moderate concentration
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Type:</span>
          <select
            value={ownerTypeFilter}
            onChange={(e) => setOwnerTypeFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: BT.bg.elevated,
              color: BT.text.primary,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 0,
              fontSize: 11,
            }}
          >
            {ownerTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Signal:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {signals.map(s => {
              const style = s === 'All' ? null : SIGNAL_STYLES[s as SignalType];
              return (
                <button
                  key={s}
                  onClick={() => setSignalFilter(s)}
                  style={{
                    padding: '4px 10px',
                    background: signalFilter === s 
                      ? (style?.bg || BT.accent.blue) 
                      : BT.bg.elevated,
                    color: signalFilter === s 
                      ? (style?.text || '#fff') 
                      : BT.text.secondary,
                    border: 'none',
                    borderRadius: 0,
                    fontSize: 11,
                    fontWeight: signalFilter === s ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Owners Table */}
      <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
        <DataTable>
          <thead>
            <tr style={{ background: BT.bg.elevated }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', minWidth: 200 }}>Owner</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Type</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Signal</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Properties</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Avg Hold</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>PCS %ile</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {filteredOwners.map((owner) => {
              const signalStyle = SIGNAL_STYLES[owner.signal];
              const isExpanded = expandedOwner === owner.id;
              const portfolio = MOCK_PORTFOLIO[owner.id] || [];

              return (
                <React.Fragment key={owner.id}>
                  <tr
                    style={{
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                      background: isExpanded ? BT.bg.elevated : 'transparent',
                    }}
                    onClick={() => setExpandedOwner(isExpanded ? null : owner.id)}
                  >
                    <td style={{ ...terminalStyles.tableCell }}>
                      <div style={{ fontWeight: 600 }}>{owner.name}</div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>
                        {owner.markets.join(', ')}
                      </div>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        background: `${OWNER_TYPE_COLORS[owner.type]}20`,
                        color: OWNER_TYPE_COLORS[owner.type],
                        borderRadius: 0,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {owner.type}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{
                          padding: '4px 10px',
                          background: signalStyle.bg,
                          color: signalStyle.text,
                          borderRadius: 0,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {owner.signal}
                        </span>
                        <span style={{ fontSize: 9, color: BT.text.muted }}>
                          {owner.signalConfidence}% conf
                        </span>
                      </div>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600 }}>
                      {owner.propertyCount}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      {owner.totalUnits.toLocaleString()}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      {owner.avgHoldPeriod.toFixed(1)}yr
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      <span style={{
                        color: owner.avgPcsPercentile < 40 ? BT.accent.red : owner.avgPcsPercentile > 70 ? BT.text.green : BT.text.primary,
                        fontWeight: 600,
                      }}>
                        {owner.avgPcsPercentile}%
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.tableCell, color: BT.text.muted, fontSize: 11 }}>
                      {owner.recentActivity}
                    </td>
                  </tr>

                  {/* Expanded Portfolio */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div style={{
                          padding: 20,
                          background: BT.bg.card,
                          borderBottom: `2px solid ${signalStyle.text}`,
                        }}>
                          <div style={{ display: 'flex', gap: 24 }}>
                            {/* Portfolio Table */}
                            <div style={{ flex: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 12 }}>
                                Portfolio ({portfolio.length} properties)
                              </div>
                              {portfolio.length > 0 ? (
                                <DataTable>
                                  <thead>
                                    <tr>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'left' }}>Property</th>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Units</th>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Hold</th>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>PCS</th>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'center' }}>Debt Mat.</th>
                                      <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Motiv.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {portfolio.map((prop, i) => (
                                      <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11 }}>
                                          <div style={{ fontWeight: 500 }}>{prop.name}</div>
                                          <div style={{ fontSize: 9, color: BT.text.muted }}>
                                            {prop.submarket} · {prop.class} · {prop.yearBuilt}
                                          </div>
                                        </td>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>{prop.units}</td>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>{prop.holdYears}yr</td>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>
                                          <span style={{ color: prop.pcsPercentile < 40 ? BT.accent.red : BT.text.primary }}>
                                            #{prop.pcsRank}
                                          </span>
                                        </td>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'center', color: BT.accent.amber }}>
                                          {prop.debtMaturity}
                                        </td>
                                        <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>
                                          <span style={{
                                            padding: '2px 6px',
                                            background: prop.motivation > 70 ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
                                            color: prop.motivation > 70 ? BT.accent.red : BT.text.muted,
                                            borderRadius: 0,
                                            fontWeight: 600,
                                          }}>
                                            {prop.motivation}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </DataTable>
                              ) : (
                                <div style={{ color: BT.text.muted, fontSize: 11 }}>
                                  Portfolio details not available
                                </div>
                              )}
                            </div>

                            {/* Land Positions */}
                            {owner.landPositions && owner.landPositions.length > 0 && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.violet, marginBottom: 12 }}>
                                  Land Positions ★
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {owner.landPositions.map((land, i) => (
                                    <div key={i} style={{
                                      padding: 10,
                                      background: 'rgba(139,92,246,0.1)',
                                      borderRadius: 0,
                                      borderLeft: `3px solid ${BT.text.violet}`,
                                    }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>
                                        {land.parcel}
                                      </div>
                                      <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
                                        {land.acres} acres · {land.capacity}
                                      </div>
                                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <span style={{
                                          fontSize: 9,
                                          padding: '2px 6px',
                                          background: BT.bg.elevated,
                                          borderRadius: 0,
                                          color: BT.text.violet,
                                        }}>
                                          DC-06: {land.probability}
                                        </span>
                                        <span style={{
                                          fontSize: 9,
                                          padding: '2px 6px',
                                          background: BT.bg.elevated,
                                          borderRadius: 0,
                                          color: BT.text.cyan,
                                        }}>
                                          {land.status}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 24,
        padding: '12px 16px',
        background: BT.bg.card,
        borderRadius: 0,
        border: `1px solid ${BT.border.subtle}`,
        fontSize: 11,
      }}>
        <div style={{ color: BT.text.muted }}>
          Signals based on: Hold period · Debt maturity · PCS performance · Transaction history
        </div>
        <div style={{ marginLeft: 'auto', color: BT.text.cyan }}>
          Land positions from DC-06 Development Probability ★
        </div>
      </div>

      {commentary?.riskOpportunity && (
        <div style={{ ...terminalStyles.card, padding: 16 }}>
          <RiskOpportunity
            risks={commentary.riskOpportunity.risks}
            opportunities={commentary.riskOpportunity.opportunities}
          />
        </div>
      )}
    </div>
  );
};

export default MSAOwnersTab;
