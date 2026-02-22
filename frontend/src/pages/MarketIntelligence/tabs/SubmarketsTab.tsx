// SubmarketsTab.tsx - Enhanced Submarket supply/demand analysis with Dev Capacity metrics
// Created: 2026-02-21
// Enhanced: 2026-02-22 - Added DC-01, DC-02, DC-03, DC-04, DC-07, T-02 columns

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpDown } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface SubmarketsTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

interface SubmarketData {
  name: string;
  supply: string; // High/Medium/Low
  demand: string; // Very High/High/Medium
  balance: string; // +30%, Balanced, -20%
  score: number; // JEDI score
  // NEW COLUMNS ★
  capacityRatio: number; // DC-01 percentage
  buildoutYears: number; // DC-02 years
  constraintScore: number; // DC-03 0-100
  overhangRisk: string; // DC-04 HIGH/MEDIUM/LOW
  pricingPower: number; // DC-07 0-100
  trafficScore: number; // T-02 avg 0-100
}

// Enhanced mock submarket data with Dev Capacity metrics
const mockSubmarkets: SubmarketData[] = [
  {
    name: 'Buckhead',
    supply: 'High',
    demand: 'Very High',
    balance: '+30%',
    score: 92,
    capacityRatio: 22,
    buildoutYears: 12.4,
    constraintScore: 72,
    overhangRisk: 'LOW',
    pricingPower: 74,
    trafficScore: 78
  },
  {
    name: 'Midtown',
    supply: 'Medium',
    demand: 'High',
    balance: '+15%',
    score: 85,
    capacityRatio: 18,
    buildoutYears: 15.2,
    constraintScore: 68,
    overhangRisk: 'MEDIUM',
    pricingPower: 71,
    trafficScore: 82
  },
  {
    name: 'Downtown',
    supply: 'Medium',
    demand: 'Medium',
    balance: 'Balanced',
    score: 75,
    capacityRatio: 15,
    buildoutYears: 18.5,
    constraintScore: 62,
    overhangRisk: 'MEDIUM',
    pricingPower: 65,
    trafficScore: 74
  },
  {
    name: 'Sandy Springs',
    supply: 'Low',
    demand: 'High',
    balance: '+40%',
    score: 88,
    capacityRatio: 28,
    buildoutYears: 9.8,
    constraintScore: 78,
    overhangRisk: 'LOW',
    pricingPower: 80,
    trafficScore: 71
  },
  {
    name: 'Decatur',
    supply: 'Low',
    demand: 'Medium',
    balance: '+20%',
    score: 80,
    capacityRatio: 20,
    buildoutYears: 13.6,
    constraintScore: 70,
    overhangRisk: 'LOW',
    pricingPower: 68,
    trafficScore: 76
  },
  {
    name: 'Perimeter Center',
    supply: 'High',
    demand: 'Medium',
    balance: '-10%',
    score: 68,
    capacityRatio: 12,
    buildoutYears: 22.3,
    constraintScore: 55,
    overhangRisk: 'HIGH',
    pricingPower: 58,
    trafficScore: 69
  }
];

type SortField = keyof SubmarketData;
type SortDirection = 'asc' | 'desc';

const SubmarketsTab: React.FC<SubmarketsTabProps> = ({ marketId, summary }) => {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSubmarkets = [...mockSubmarkets].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  const getBalanceIcon = (balance: string) => {
    if (balance.startsWith('+')) {
      return <TrendingUp size={18} className="icon-positive" />;
    } else if (balance.startsWith('-')) {
      return <TrendingDown size={18} className="icon-negative" />;
    }
    return <Minus size={18} className="icon-neutral" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'score-excellent';
    if (score >= 75) return 'score-good';
    return 'score-fair';
  };

  const getCapacityColor = (ratio: number) => {
    if (ratio >= 25) return 'capacity-high';
    if (ratio >= 15) return 'capacity-medium';
    return 'capacity-low';
  };

  const getBuildoutColor = (years: number) => {
    if (years <= 10) return 'buildout-fast';
    if (years <= 15) return 'buildout-medium';
    return 'buildout-slow';
  };

  const getConstraintColor = (score: number) => {
    if (score >= 70) return 'constraint-high';
    if (score >= 60) return 'constraint-medium';
    return 'constraint-low';
  };

  const getOverhangColor = (risk: string) => {
    if (risk === 'LOW') return 'overhang-low';
    if (risk === 'MEDIUM') return 'overhang-medium';
    return 'overhang-high';
  };

  const getPowerColor = (power: number) => {
    if (power >= 70) return 'power-high';
    if (power >= 60) return 'power-medium';
    return 'power-low';
  };

  const getTrafficColor = (score: number) => {
    if (score >= 75) return 'traffic-high';
    if (score >= 65) return 'traffic-medium';
    return 'traffic-low';
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th onClick={() => handleSort(field)} className="sortable">
      <div className="header-content">
        {children}
        <ArrowUpDown size={14} className={sortField === field ? 'active' : ''} />
      </div>
    </th>
  );

  return (
    <div className="submarkets-tab">
      {/* Header */}
      <div className="submarkets-header">
        <h2>Submarket Analysis - Enhanced with Dev Capacity Metrics</h2>
        <p>Supply vs Demand analysis for submarkets in {summary.market.display_name}</p>
      </div>

      {/* Submarkets Table */}
      <div className="submarkets-table-wrapper">
        <div className="submarkets-table">
          <table>
            <thead>
              <tr>
                <SortableHeader field="name">Submarket</SortableHeader>
                <SortableHeader field="supply">Supply</SortableHeader>
                <SortableHeader field="demand">Demand</SortableHeader>
                <SortableHeader field="balance">Balance</SortableHeader>
                <SortableHeader field="score">Score</SortableHeader>
                <SortableHeader field="capacityRatio">
                  <span className="new-badge">★ NEW</span> DC-01<br/>Capacity
                </SortableHeader>
                <SortableHeader field="buildoutYears">
                  <span className="new-badge">★ NEW</span> DC-02<br/>Buildout
                </SortableHeader>
                <SortableHeader field="constraintScore">
                  <span className="new-badge">★ NEW</span> DC-03<br/>Constraint
                </SortableHeader>
                <SortableHeader field="overhangRisk">
                  <span className="new-badge">★ NEW</span> DC-04<br/>Overhang
                </SortableHeader>
                <SortableHeader field="pricingPower">
                  <span className="new-badge">★ NEW</span> DC-07<br/>Pricing
                </SortableHeader>
                <SortableHeader field="trafficScore">
                  <span className="new-badge">★ NEW</span> T-02<br/>Traffic
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {sortedSubmarkets.map((submarket, idx) => (
                <tr key={idx}>
                  <td className="submarket-name">{submarket.name}</td>
                  <td>
                    <span className={`supply-badge ${submarket.supply.toLowerCase()}`}>
                      {submarket.supply}
                    </span>
                  </td>
                  <td>
                    <span className={`demand-badge ${submarket.demand.toLowerCase().replace(' ', '-')}`}>
                      {submarket.demand}
                    </span>
                  </td>
                  <td>
                    <span className="balance-indicator">
                      {getBalanceIcon(submarket.balance)}
                      {submarket.balance}
                    </span>
                  </td>
                  <td>
                    <span className={`score ${getScoreColor(submarket.score)}`}>
                      {submarket.score}
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getCapacityColor(submarket.capacityRatio)}`}>
                      {submarket.capacityRatio}%
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getBuildoutColor(submarket.buildoutYears)}`}>
                      {submarket.buildoutYears}yr
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getConstraintColor(submarket.constraintScore)}`}>
                      {submarket.constraintScore}
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getOverhangColor(submarket.overhangRisk)}`}>
                      {submarket.overhangRisk}
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getPowerColor(submarket.pricingPower)}`}>
                      {submarket.pricingPower}
                    </span>
                  </td>
                  <td>
                    <span className={`metric-badge ${getTrafficColor(submarket.trafficScore)}`}>
                      {submarket.trafficScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Cards */}
      <div className="info-cards">
        <div className="info-card">
          <h3>📊 Core Metrics</h3>
          <ul>
            <li><strong>Supply:</strong> Current inventory levels</li>
            <li><strong>Demand:</strong> Market absorption strength</li>
            <li><strong>Balance:</strong> Supply/demand equilibrium</li>
            <li><strong>Score:</strong> Overall JEDI ranking</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>🏗️ Development Capacity (DC)</h3>
          <ul>
            <li><strong>DC-01 Capacity:</strong> Available development capacity %</li>
            <li><strong>DC-02 Buildout:</strong> Years to full buildout</li>
            <li><strong>DC-03 Constraint:</strong> Supply constraint score (0-100)</li>
            <li><strong>DC-04 Overhang:</strong> Future supply risk level</li>
            <li><strong>DC-07 Pricing:</strong> Pricing power index (0-100)</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>🚗 Traffic Analysis</h3>
          <ul>
            <li><strong>T-02 Traffic:</strong> Average traffic score (0-100)</li>
            <li>Higher scores indicate better accessibility</li>
            <li>Impacts retail viability and visibility</li>
          </ul>
        </div>
      </div>

      <style>{`
        .submarkets-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .submarkets-header {
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        .submarkets-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .submarkets-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .submarkets-table-wrapper {
          background: white;
          border-radius: 12px;
          overflow-x: auto;
        }

        .submarkets-table {
          min-width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1400px;
        }

        th, td {
          padding: 16px 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        th {
          background: #f8fafc;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        th.sortable {
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }

        th.sortable:hover {
          background: #f1f5f9;
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .header-content svg {
          color: #cbd5e1;
          transition: color 0.2s;
        }

        .header-content svg.active {
          color: #3b82f6;
        }

        .new-badge {
          display: inline-block;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-right: 4px;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
        }

        td {
          font-size: 14px;
        }

        .submarket-name {
          font-weight: 600;
          color: #0f172a;
          position: sticky;
          left: 0;
          background: white;
          z-index: 5;
        }

        .supply-badge,
        .demand-badge,
        .metric-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .supply-badge.high {
          background: #fee2e2;
          color: #991b1b;
        }

        .supply-badge.medium {
          background: #fef3c7;
          color: #92400e;
        }

        .supply-badge.low {
          background: #dcfce7;
          color: #15803d;
        }

        .demand-badge.very-high {
          background: #dcfce7;
          color: #15803d;
        }

        .demand-badge.high {
          background: #dbeafe;
          color: #1e40af;
        }

        .demand-badge.medium {
          background: #f1f5f9;
          color: #475569;
        }

        .balance-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }

        .icon-positive {
          color: #22c55e;
        }

        .icon-negative {
          color: #ef4444;
        }

        .icon-neutral {
          color: #94a3b8;
        }

        .score {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 16px;
        }

        .score-excellent {
          background: #dcfce7;
          color: #15803d;
        }

        .score-good {
          background: #dbeafe;
          color: #1e40af;
        }

        .score-fair {
          background: #fef3c7;
          color: #92400e;
        }

        /* Dev Capacity Metrics Color Coding */
        .capacity-high {
          background: #dcfce7;
          color: #15803d;
        }

        .capacity-medium {
          background: #dbeafe;
          color: #1e40af;
        }

        .capacity-low {
          background: #fee2e2;
          color: #991b1b;
        }

        .buildout-fast {
          background: #dcfce7;
          color: #15803d;
        }

        .buildout-medium {
          background: #fef3c7;
          color: #92400e;
        }

        .buildout-slow {
          background: #fee2e2;
          color: #991b1b;
        }

        .constraint-high {
          background: #dcfce7;
          color: #15803d;
        }

        .constraint-medium {
          background: #fef3c7;
          color: #92400e;
        }

        .constraint-low {
          background: #fee2e2;
          color: #991b1b;
        }

        .overhang-low {
          background: #dcfce7;
          color: #15803d;
        }

        .overhang-medium {
          background: #fef3c7;
          color: #92400e;
        }

        .overhang-high {
          background: #fee2e2;
          color: #991b1b;
        }

        .power-high {
          background: #dcfce7;
          color: #15803d;
        }

        .power-medium {
          background: #dbeafe;
          color: #1e40af;
        }

        .power-low {
          background: #fef3c7;
          color: #92400e;
        }

        .traffic-high {
          background: #dcfce7;
          color: #15803d;
        }

        .traffic-medium {
          background: #dbeafe;
          color: #1e40af;
        }

        .traffic-low {
          background: #fef3c7;
          color: #92400e;
        }

        .info-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .info-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .info-card h3 {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 12px 0;
        }

        .info-card ul {
          margin: 0;
          padding-left: 20px;
          color: #475569;
          font-size: 13px;
        }

        .info-card li {
          margin-bottom: 6px;
        }

        .info-card strong {
          color: #0f172a;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .submarkets-table-wrapper {
            border-radius: 12px;
            box-shadow: inset -4px 0 8px -4px rgba(0, 0, 0, 0.1);
          }

          th, td {
            padding: 12px 8px;
            font-size: 12px;
          }

          .new-badge {
            font-size: 8px;
            padding: 1px 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default SubmarketsTab;
