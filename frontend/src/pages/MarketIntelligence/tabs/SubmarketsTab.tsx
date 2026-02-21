// SubmarketsTab.tsx - Submarket supply/demand analysis
// Created: 2026-02-21
// This incorporates the existing Market Research page functionality

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface SubmarketsTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

// Mock submarket data (replace with API call)
const mockSubmarkets = [
  { name: 'Buckhead', supply: 'High', demand: 'Very High', balance: '+30%', score: 92 },
  { name: 'Midtown', supply: 'Medium', demand: 'High', balance: '+15%', score: 85 },
  { name: 'Downtown', supply: 'Medium', demand: 'Medium', balance: 'Balanced', score: 75 },
  { name: 'Sandy Springs', supply: 'Low', demand: 'High', balance: '+40%', score: 88 },
  { name: 'Decatur', supply: 'Low', demand: 'Medium', balance: '+20%', score: 80 },
];

const SubmarketsTab: React.FC<SubmarketsTabProps> = ({ marketId, summary }) => {
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

  return (
    <div className="submarkets-tab">
      {/* Header */}
      <div className="submarkets-header">
        <h2>Submarket Analysis</h2>
        <p>Supply vs Demand analysis for submarkets in {summary.market.display_name}</p>
      </div>

      {/* Submarkets Table */}
      <div className="submarkets-table">
        <table>
          <thead>
            <tr>
              <th>Submarket</th>
              <th>Supply</th>
              <th>Demand</th>
              <th>Balance</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {mockSubmarkets.map((submarket, idx) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Cards */}
      <div className="info-cards">
        <div className="info-card">
          <h3>📊 Supply Levels</h3>
          <ul>
            <li><strong>High:</strong> Abundant inventory, more competition</li>
            <li><strong>Medium:</strong> Balanced inventory levels</li>
            <li><strong>Low:</strong> Limited inventory, less competition</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>🎯 Demand Indicators</h3>
          <ul>
            <li><strong>Very High:</strong> Strong absorption, high occupancy</li>
            <li><strong>High:</strong> Good demand fundamentals</li>
            <li><strong>Medium:</strong> Stable demand patterns</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>⚖️ Market Balance</h3>
          <ul>
            <li><strong>Positive (+):</strong> Undersupplied, favorable for investors</li>
            <li><strong>Balanced:</strong> Supply meets demand</li>
            <li><strong>Negative (-):</strong> Oversupplied, more challenging</li>
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

        .submarkets-table {
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        td {
          font-size: 14px;
        }

        .submarket-name {
          font-weight: 600;
          color: #0f172a;
        }

        .supply-badge,
        .demand-badge {
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
      `}</style>
    </div>
  );
};

export default SubmarketsTab;
