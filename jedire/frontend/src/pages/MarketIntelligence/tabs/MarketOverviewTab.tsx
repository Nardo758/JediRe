// MarketOverviewTab.tsx - Market overview dashboard
// Created: 2026-02-21
// Shows: Market vitals, coverage, active deals summary

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, DollarSign, Home, Building2 } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface MarketOverviewTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

const MarketOverviewTab: React.FC<MarketOverviewTabProps> = ({ marketId, summary, onUpdate }) => {
  const navigate = useNavigate();
  const { market, vitals, active_deals_count } = summary;

  return (
    <div className="market-overview-tab">
      {/* Market Vitals Section */}
      <section className="vitals-section">
        <h2>📍 Market Vitals</h2>
        <div className="vitals-grid">
          <div className="vital-card">
            <div className="vital-icon">
              <Users size={24} />
            </div>
            <div className="vital-content">
              <label>Population</label>
              <span className="vital-value">
                {vitals?.population?.toLocaleString() || 'N/A'}
              </span>
              {vitals?.population_growth_yoy && (
                <span className="vital-change positive">
                  +{vitals.population_growth_yoy.toFixed(1)}% YoY
                </span>
              )}
            </div>
          </div>

          <div className="vital-card">
            <div className="vital-icon">
              <TrendingUp size={24} />
            </div>
            <div className="vital-content">
              <label>Job Growth</label>
              <span className="vital-value">
                {vitals?.job_growth_yoy ? `+${vitals.job_growth_yoy.toFixed(1)}%` : 'N/A'}
              </span>
              <span className="vital-label">Year over year</span>
            </div>
          </div>

          <div className="vital-card">
            <div className="vital-icon">
              <DollarSign size={24} />
            </div>
            <div className="vital-content">
              <label>Median Income</label>
              <span className="vital-value">
                {vitals?.median_income ? `$${vitals.median_income.toLocaleString()}` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="vital-card">
            <div className="vital-icon">
              <Home size={24} />
            </div>
            <div className="vital-content">
              <label>Avg Rent / Unit</label>
              <span className="vital-value">
                {vitals?.avg_rent_per_unit ? `$${vitals.avg_rent_per_unit.toLocaleString()}` : 'N/A'}
              </span>
              {vitals?.rent_growth_yoy && (
                <span className="vital-change positive">
                  +{vitals.rent_growth_yoy.toFixed(1)}% YoY
                </span>
              )}
            </div>
          </div>

          <div className="vital-card">
            <div className="vital-icon">
              <Building2 size={24} />
            </div>
            <div className="vital-content">
              <label>Occupancy Rate</label>
              <span className="vital-value">
                {vitals?.occupancy_rate ? `${vitals.occupancy_rate.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>

          {vitals?.jedi_score && (
            <div className="vital-card jedi-card">
              <div className="vital-icon jedi">
                🎯
              </div>
              <div className="vital-content">
                <label>JEDI Score</label>
                <span className="vital-value jedi-score">{vitals.jedi_score}</span>
                <span className="vital-rating">{vitals.jedi_rating}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Market Research Data Coverage */}
      <section className="coverage-section">
        <h2>📊 Market Research Data Coverage</h2>
        <div className="coverage-card">
          <div className="coverage-header">
            <div>
              <label>Total Parcels in Market</label>
              <span className="coverage-stat">
                {market.total_parcels?.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div>
              <label>JEDI Coverage</label>
              <span className="coverage-stat">
                {market.covered_parcels?.toLocaleString() || 'N/A'} parcels
              </span>
            </div>
          </div>

          <div className="coverage-bar-container">
            <div className="coverage-bar">
              <div 
                className="coverage-fill" 
                style={{ width: `${market.coverage_percentage || 0}%` }}
              ></div>
            </div>
            <span className="coverage-percentage">
              {market.coverage_percentage?.toFixed(1)}% Coverage
            </span>
          </div>

          <div className="data-points-grid">
            <div className="data-point">
              <label>Research Data Points</label>
              <span>{market.data_points_count.toLocaleString()} properties</span>
            </div>
            <div className="data-point">
              <label>Total Units Tracked</label>
              <span>{market.total_units.toLocaleString()} units</span>
            </div>
            <div className="data-point">
              <label>With Owner Info</label>
              <span>{market.data_points_count.toLocaleString()} (100%)</span>
            </div>
            <div className="data-point">
              <label>Sales History</label>
              <span>292 transactions (2018-2022)</span>
            </div>
          </div>

          <div className="use-cases">
            <h3>💡 Use Cases:</h3>
            <ul>
              <li>Identify acquisition targets</li>
              <li>Owner outreach campaigns</li>
              <li>Comparable sales analysis</li>
              <li>Market rent benchmarking</li>
              <li>Vintage cohort analysis (year built)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Active Deals Section */}
      <section className="deals-section">
        <div className="section-header">
          <h2>💼 Active Deals</h2>
          <button 
            className="view-all-button"
            onClick={() => navigate(`/markets/${marketId}/deals`)}
          >
            View All Deals →
          </button>
        </div>
        
        <div className="deals-summary">
          <div className="deals-stat">
            <span className="stat-value">{active_deals_count}</span>
            <span className="stat-label">deals in {market.display_name}</span>
          </div>
          {active_deals_count > 0 && (
            <p className="deals-hint">
              Click "View All Deals" to see your active deals in this market
            </p>
          )}
        </div>
      </section>

      <style jsx>{`
        .market-overview-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        section {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }

        h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 20px 0;
        }

        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .vital-card {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .vital-card.jedi-card {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #bfdbfe;
        }

        .vital-icon {
          display: flex;
          align-items: center;
          justify-center;
          width: 48px;
          height: 48px;
          background: white;
          border-radius: 8px;
          color: #3b82f6;
        }

        .vital-icon.jedi {
          font-size: 28px;
          background: transparent;
        }

        .vital-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .vital-content label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .vital-value {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
        }

        .vital-value.jedi-score {
          color: #3b82f6;
          font-size: 32px;
        }

        .vital-change {
          font-size: 13px;
          font-weight: 600;
        }

        .vital-change.positive {
          color: #22c55e;
        }

        .vital-label,
        .vital-rating {
          font-size: 12px;
          color: #64748b;
        }

        .coverage-card {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .coverage-header {
          display: flex;
          justify-content: space-around;
          gap: 24px;
        }

        .coverage-header > div {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .coverage-header label {
          font-size: 13px;
          color: #64748b;
        }

        .coverage-stat {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        .coverage-bar-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .coverage-bar {
          flex: 1;
          height: 12px;
          background: #f1f5f9;
          border-radius: 6px;
          overflow: hidden;
        }

        .coverage-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          transition: width 0.3s ease;
        }

        .coverage-percentage {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
        }

        .data-points-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .data-point {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .data-point label {
          font-size: 13px;
          color: #64748b;
        }

        .data-point span {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }

        .use-cases {
          padding: 16px;
          background: #fef3c7;
          border-radius: 8px;
          border-left: 4px solid #f59e0b;
        }

        .use-cases h3 {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin: 0 0 8px 0;
        }

        .use-cases ul {
          margin: 0;
          padding-left: 20px;
          color: #78350f;
          font-size: 13px;
        }

        .use-cases li {
          margin-bottom: 4px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h2 {
          margin: 0;
        }

        .view-all-button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .view-all-button:hover {
          background: #2563eb;
        }

        .deals-summary {
          text-align: center;
          padding: 32px;
        }

        .deals-stat {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .stat-value {
          font-size: 48px;
          font-weight: 700;
          color: #3b82f6;
        }

        .stat-label {
          font-size: 16px;
          color: #64748b;
        }

        .deals-hint {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default MarketOverviewTab;
