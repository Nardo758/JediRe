// MarketComparison.tsx - Side-by-side market comparison
// Created: 2026-02-21
// Phase 3: Market Intelligence UI

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import type { MarketComparisonResponse } from '../../types/marketIntelligence.types';

const MarketComparison: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [comparison, setComparison] = useState<MarketComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  useEffect(() => {
    const markets = searchParams.get('markets');
    if (markets) {
      setSelectedMarkets(markets.split(','));
      loadComparison(markets);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const loadComparison = async (marketIds: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/markets/compare?markets=${marketIds}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setComparison(data);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeMarket = (marketId: string) => {
    const updated = selectedMarkets.filter(id => id !== marketId);
    setSelectedMarkets(updated);
    if (updated.length > 0) {
      navigate(`/markets/compare?markets=${updated.join(',')}`);
    } else {
      navigate('/markets');
    }
  };

  if (loading) {
    return <div className="comparison-loading">Loading comparison...</div>;
  }

  if (!comparison || selectedMarkets.length === 0) {
    return (
      <div className="comparison-empty">
        <h2>No markets selected</h2>
        <p>Select markets to compare from your Markets page</p>
        <button onClick={() => navigate('/markets')}>Go to Markets</button>
      </div>
    );
  }

  return (
    <div className="market-comparison">
      <header className="comparison-header">
        <button className="back-button" onClick={() => navigate('/markets')}>
          <ArrowLeft size={18} />
          Back to Markets
        </button>
        <h1>Market Comparison</h1>
        <p>{comparison.markets.length} markets selected</p>
      </header>

      <div className="comparison-table">
        <table>
          <thead>
            <tr>
              <th className="metric-column">Metric</th>
              {comparison.markets.map(market => (
                <th key={market.market_id} className="market-column">
                  <div className="market-header">
                    <span>{market.display_name}</span>
                    <button 
                      className="remove-market"
                      onClick={() => removeMarket(market.market_id)}
                      title="Remove from comparison"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Coverage */}
            <tr className="section-header">
              <td colSpan={comparison.markets.length + 1}>Data Coverage</td>
            </tr>
            <tr>
              <td className="metric-name">Coverage %</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.coverage.coverage_percentage?.toFixed(1)}%
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Data Points</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.coverage.data_points_count.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Total Units</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.coverage.total_units.toLocaleString()}
                </td>
              ))}
            </tr>

            {/* Market Vitals */}
            <tr className="section-header">
              <td colSpan={comparison.markets.length + 1}>Market Performance</td>
            </tr>
            <tr>
              <td className="metric-name">Population</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.vitals?.population?.toLocaleString() || 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Population Growth (YoY)</td>
              {comparison.markets.map(market => (
                <td key={market.market_id} className={market.vitals?.population_growth_yoy ? 'positive' : ''}>
                  {market.vitals?.population_growth_yoy ? 
                    `+${market.vitals.population_growth_yoy.toFixed(1)}%` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Job Growth (YoY)</td>
              {comparison.markets.map(market => (
                <td key={market.market_id} className={market.vitals?.job_growth_yoy ? 'positive' : ''}>
                  {market.vitals?.job_growth_yoy ? 
                    `+${market.vitals.job_growth_yoy.toFixed(1)}%` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Median Income</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.vitals?.median_income ? 
                    `$${market.vitals.median_income.toLocaleString()}` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Rent Growth (YoY)</td>
              {comparison.markets.map(market => (
                <td key={market.market_id} className={market.vitals?.rent_growth_yoy ? 'positive' : ''}>
                  {market.vitals?.rent_growth_yoy ? 
                    `+${market.vitals.rent_growth_yoy.toFixed(1)}%` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Avg Rent / Unit</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.vitals?.avg_rent_per_unit ? 
                    `$${market.vitals.avg_rent_per_unit.toLocaleString()}` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Occupancy Rate</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.vitals?.occupancy_rate?.toFixed(1)}%
                </td>
              ))}
            </tr>

            {/* JEDI Score */}
            <tr className="section-header">
              <td colSpan={comparison.markets.length + 1}>Investment Analysis</td>
            </tr>
            <tr>
              <td className="metric-name">JEDI Score</td>
              {comparison.markets.map(market => (
                <td key={market.market_id} className="jedi-score">
                  <span className="score-value">{market.vitals?.jedi_score || 'N/A'}</span>
                  {market.vitals?.jedi_rating && (
                    <span className="rating">{market.vitals.jedi_rating}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="metric-name">Active Deals</td>
              {comparison.markets.map(market => (
                <td key={market.market_id}>
                  {market.active_deals_count}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        .market-comparison {
          min-height: 100vh;
          background: #f8fafc;
        }

        .comparison-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 24px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .back-button:hover {
          color: #334155;
        }

        .comparison-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .comparison-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .comparison-table {
          padding: 24px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          background: white;
          border-radius: 12px;
          border-collapse: collapse;
          overflow: hidden;
        }

        th, td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-weight: 600;
          color: #0f172a;
        }

        .metric-column {
          width: 200px;
          position: sticky;
          left: 0;
          background: #f8fafc;
          z-index: 10;
        }

        .market-column {
          min-width: 180px;
        }

        .market-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .remove-market {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }

        .remove-market:hover {
          background: #f1f5f9;
          color: #64748b;
        }

        .section-header td {
          background: #f1f5f9;
          font-weight: 600;
          color: #475569;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-name {
          font-weight: 500;
          color: #64748b;
        }

        td {
          font-weight: 600;
          color: #0f172a;
        }

        .positive {
          color: #22c55e;
        }

        .jedi-score {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .score-value {
          font-size: 20px;
          color: #3b82f6;
        }

        .rating {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .comparison-loading,
        .comparison-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 16px;
        }

        .comparison-empty button {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default MarketComparison;
