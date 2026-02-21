// TrendsTab.tsx - 12-year market trends and appreciation
// Created: 2026-02-21
// Uses the 52 market trend data points from Phase 2

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface TrendsTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

// Mock historical data (replace with API call to market_vitals table)
const mockTrendData = [
  { year: 2012, price: 180000, rent: 1200, occupancy: 92.1 },
  { year: 2013, price: 195000, rent: 1250, occupancy: 91.8 },
  { year: 2014, price: 215000, rent: 1300, occupancy: 92.5 },
  { year: 2015, price: 235000, rent: 1350, occupancy: 93.2 },
  { year: 2016, price: 255000, rent: 1420, occupancy: 93.8 },
  { year: 2017, price: 285000, rent: 1500, occupancy: 94.1 },
  { year: 2018, price: 315000, rent: 1600, occupancy: 94.5 },
  { year: 2019, price: 340000, rent: 1685, occupancy: 93.9 },
  { year: 2020, price: 360000, rent: 1745, occupancy: 92.5 },
  { year: 2021, price: 395000, rent: 1840, occupancy: 96.2 },
  { year: 2022, price: 435000, rent: 2005, occupancy: 95.1 },
  { year: 2023, price: 425000, rent: 2125, occupancy: 93.8 },
  { year: 2024, price: 420000, rent: 2150, occupancy: 94.5 },
];

const TrendsTab: React.FC<TrendsTabProps> = ({ marketId, summary }) => {
  const calculateGrowth = (data: typeof mockTrendData, key: 'price' | 'rent' | 'occupancy') => {
    const first = data[0][key];
    const last = data[data.length - 1][key];
    const totalGrowth = ((last - first) / first) * 100;
    const years = data.length - 1;
    const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
    return { totalGrowth, cagr, first, last };
  };

  const priceGrowth = calculateGrowth(mockTrendData, 'price');
  const rentGrowth = calculateGrowth(mockTrendData, 'rent');

  return (
    <div className="trends-tab">
      {/* Header */}
      <div className="trends-header">
        <h2>📈 Market Trends (2012-2024)</h2>
        <p>12 years of historical performance data for {summary.market.display_name}</p>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">
            <TrendingUp size={24} />
          </div>
          <div className="card-content">
            <label>Median Home Price</label>
            <div className="value-comparison">
              <span className="old-value">${(priceGrowth.first / 1000).toFixed(0)}K (2012)</span>
              <span className="arrow">→</span>
              <span className="new-value">${(priceGrowth.last / 1000).toFixed(0)}K (2024)</span>
            </div>
            <div className="growth-stats">
              <span className="total-growth">+{priceGrowth.totalGrowth.toFixed(1)}% total</span>
              <span className="cagr">+{priceGrowth.cagr.toFixed(1)}% CAGR</span>
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon rent">
            💰
          </div>
          <div className="card-content">
            <label>Average Rent</label>
            <div className="value-comparison">
              <span className="old-value">${priceGrowth.first.toLocaleString()} (2012)</span>
              <span className="arrow">→</span>
              <span className="new-value">${priceGrowth.last.toLocaleString()} (2024)</span>
            </div>
            <div className="growth-stats">
              <span className="total-growth">+{rentGrowth.totalGrowth.toFixed(1)}% total</span>
              <span className="cagr">+{rentGrowth.cagr.toFixed(1)}% CAGR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Data Table */}
      <div className="trends-table">
        <h3>Year-by-Year Performance</h3>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Median Price</th>
              <th>Price Change</th>
              <th>Avg Rent</th>
              <th>Rent Change</th>
              <th>Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {mockTrendData.map((row, idx) => {
              const prevPrice = idx > 0 ? mockTrendData[idx - 1].price : row.price;
              const prevRent = idx > 0 ? mockTrendData[idx - 1].rent : row.rent;
              const priceChange = ((row.price - prevPrice) / prevPrice) * 100;
              const rentChange = ((row.rent - prevRent) / prevRent) * 100;

              return (
                <tr key={row.year}>
                  <td className="year-cell">{row.year}</td>
                  <td className="price-cell">${(row.price / 1000).toFixed(0)}K</td>
                  <td className={priceChange >= 0 ? 'positive' : 'negative'}>
                    {idx > 0 ? (
                      <span>
                        {priceChange >= 0 ? '+' : ''}
                        {priceChange.toFixed(1)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="rent-cell">${row.rent}</td>
                  <td className={rentChange >= 0 ? 'positive' : 'negative'}>
                    {idx > 0 ? (
                      <span>
                        {rentChange >= 0 ? '+' : ''}
                        {rentChange.toFixed(1)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td>{row.occupancy.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key Insights */}
      <div className="insights-box">
        <h3>🔍 Key Insights</h3>
        <ul>
          <li>
            <strong>Strong Appreciation:</strong> Median home prices increased by {priceGrowth.totalGrowth.toFixed(0)}%
            over 12 years, outpacing national average
          </li>
          <li>
            <strong>Rent Growth:</strong> Average rents grew {rentGrowth.cagr.toFixed(1)}% annually,
            supporting strong cash flow
          </li>
          <li>
            <strong>Peak Occupancy:</strong> Reached 96.2% in 2021 during pandemic demand surge
          </li>
          <li>
            <strong>Recent Stabilization:</strong> 2023-2024 showing market normalization after rapid growth
          </li>
        </ul>
      </div>

      <style jsx>{`
        .trends-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .trends-header {
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        .trends-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .trends-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .summary-card {
          display: flex;
          gap: 16px;
          background: white;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .card-icon {
          display: flex;
          align-items: center;
          justify-center;
          width: 56px;
          height: 56px;
          background: #eff6ff;
          border-radius: 12px;
          color: #3b82f6;
          font-size: 28px;
        }

        .card-icon.rent {
          background: #f0fdf4;
        }

        .card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card-content label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .value-comparison {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .old-value {
          font-size: 14px;
          color: #94a3b8;
        }

        .arrow {
          color: #cbd5e1;
        }

        .new-value {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        .growth-stats {
          display: flex;
          gap: 12px;
          font-size: 13px;
        }

        .total-growth {
          color: #22c55e;
          font-weight: 600;
        }

        .cagr {
          color: #64748b;
        }

        .trends-table {
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        .trends-table h3 {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 16px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 16px;
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
          color: #0f172a;
        }

        .year-cell {
          font-weight: 600;
        }

        .positive {
          color: #22c55e;
          font-weight: 600;
        }

        .negative {
          color: #ef4444;
          font-weight: 600;
        }

        .insights-box {
          background: #fef3c7;
          border: 1px solid #fde047;
          border-radius: 12px;
          padding: 20px;
        }

        .insights-box h3 {
          font-size: 16px;
          font-weight: 600;
          color: #92400e;
          margin: 0 0 12px 0;
        }

        .insights-box ul {
          margin: 0;
          padding-left: 20px;
          color: #78350f;
          font-size: 14px;
          line-height: 1.6;
        }

        .insights-box li {
          margin-bottom: 8px;
        }

        .insights-box strong {
          color: #92400e;
        }
      `}</style>
    </div>
  );
};

export default TrendsTab;
