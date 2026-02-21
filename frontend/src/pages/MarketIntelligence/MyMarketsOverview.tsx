// MyMarketsOverview.tsx - Central hub for all tracked markets
// Created: 2026-02-21
// Phase 3: Market Intelligence UI

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Settings, BarChart3, TrendingUp, Building2, 
  AlertCircle, CheckCircle, Clock, MapPin 
} from 'lucide-react';
import type { MarketOverviewResponse, MarketCardData, MarketAlert } from '../../types/marketIntelligence.types';

interface MyMarketsOverviewProps {}

const MyMarketsOverview: React.FC<MyMarketsOverviewProps> = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null);
  const [showAddMarket, setShowAddMarket] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/markets/overview', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setOverview(data);
    } catch (error) {
      console.error('Error loading markets overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={16} className="status-icon active" />;
      case 'pending':
        return <Clock size={16} className="status-icon pending" />;
      default:
        return <AlertCircle size={16} className="status-icon inactive" />;
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'alert-success';
      case 'warning':
        return 'alert-warning';
      default:
        return 'alert-info';
    }
  };

  if (loading) {
    return (
      <div className="markets-loading">
        <div className="spinner">Loading markets...</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="markets-error">
        <h2>Unable to load markets</h2>
        <button onClick={loadOverview}>Retry</button>
      </div>
    );
  }

  return (
    <div className="my-markets-overview">
      {/* Header */}
      <header className="markets-header">
        <div className="header-content">
          <h1>Market Intelligence</h1>
          <div className="header-actions">
            <button 
              className="btn-add-market"
              onClick={() => setShowAddMarket(true)}
            >
              <Plus size={18} />
              Add Market
            </button>
            <button 
              className="btn-preferences"
              onClick={() => navigate('/settings/markets')}
            >
              <Settings size={18} />
              Preferences
            </button>
            <button 
              className="btn-compare"
              onClick={() => navigate('/markets/compare')}
            >
              <BarChart3 size={18} />
              Compare Markets
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat">
            <label>Active Markets</label>
            <span className="stat-value">{overview.active_markets_count}</span>
          </div>
          <div className="stat">
            <label>Data Points</label>
            <span className="stat-value">{overview.total_data_points.toLocaleString()}</span>
          </div>
          <div className="stat">
            <label>Active Deals</label>
            <span className="stat-value">{overview.active_deals_count}</span>
          </div>
        </div>
      </header>

      {/* Market Cards Grid */}
      <section className="markets-grid">
        {overview.markets.map(market => (
          <MarketCard 
            key={market.market_id} 
            market={market}
            onViewMarket={(id) => navigate(`/markets/${id}`)}
          />
        ))}

        {/* Add Market Card */}
        <div className="market-card add-market-card" onClick={() => setShowAddMarket(true)}>
          <div className="add-market-content">
            <Plus size={48} className="add-icon" />
            <h3>Add New Market</h3>
            <p>Start tracking a new market</p>
          </div>
        </div>
      </section>

      {/* Alerts Section */}
      {overview.alerts.length > 0 && (
        <section className="alerts-section">
          <h2>🔔 Alerts & Opportunities</h2>
          <div className="alerts-list">
            {overview.alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-card ${getAlertSeverityColor(alert.severity)}`}
                onClick={() => alert.action_url && navigate(alert.action_url)}
              >
                <div className="alert-icon">
                  {alert.type === 'opportunity' && '💡'}
                  {alert.type === 'new_data' && '⚠️'}
                  {alert.type === 'market_update' && '📊'}
                  {alert.type === 'threshold_met' && '🎯'}
                </div>
                <div className="alert-content">
                  <h4>{alert.market_name}: {alert.title}</h4>
                  <p>{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Market Modal */}
      {showAddMarket && (
        <AddMarketModal 
          onClose={() => setShowAddMarket(false)}
          onAdded={loadOverview}
        />
      )}

      <style>{`
        .my-markets-overview {
          min-height: 100vh;
          background: #f8fafc;
          padding-bottom: 48px;
        }

        .markets-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 24px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-content h1 {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn-add-market,
        .btn-preferences,
        .btn-compare {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add-market {
          background: #3b82f6;
          color: white;
          border: none;
        }

        .btn-add-market:hover {
          background: #2563eb;
        }

        .btn-preferences,
        .btn-compare {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-preferences:hover,
        .btn-compare:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .stats-bar {
          display: flex;
          gap: 48px;
          padding: 20px 24px;
          background: #f8fafc;
          border-radius: 12px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
        }

        .markets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
          padding: 24px;
        }

        .market-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .market-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .add-market-card {
          border: 2px dashed #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 280px;
        }

        .add-market-card:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }

        .add-market-content {
          text-align: center;
          color: #64748b;
        }

        .add-icon {
          color: #cbd5e1;
          margin-bottom: 12px;
        }

        .add-market-content h3 {
          font-size: 16px;
          font-weight: 600;
          color: #475569;
          margin: 0 0 8px 0;
        }

        .add-market-content p {
          font-size: 14px;
          margin: 0;
        }

        .alerts-section {
          padding: 24px;
        }

        .alerts-section h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 16px 0;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .alert-card {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: white;
          border-radius: 8px;
          border-left: 4px solid;
          cursor: pointer;
          transition: all 0.2s;
        }

        .alert-info {
          border-left-color: #3b82f6;
        }

        .alert-success {
          border-left-color: #22c55e;
        }

        .alert-warning {
          border-left-color: #f59e0b;
        }

        .alert-card:hover {
          background: #f8fafc;
        }

        .alert-icon {
          font-size: 24px;
        }

        .alert-content {
          flex: 1;
        }

        .alert-content h4 {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .alert-content p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .markets-loading,
        .markets-error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }

        .spinner {
          font-size: 18px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

// Market Card Component
interface MarketCardProps {
  market: MarketCardData;
  onViewMarket: (marketId: string) => void;
}

const MarketCard: React.FC<MarketCardProps> = ({ market, onViewMarket }) => {
  const getStatusBadge = () => {
    switch (market.status) {
      case 'active':
        return <span className="status-badge active">Active</span>;
      case 'pending':
        return <span className="status-badge pending">Pending</span>;
      default:
        return <span className="status-badge inactive">Inactive</span>;
    }
  };

  const getCoverageBar = () => {
    const percentage = Math.round(market.coverage_percentage);
    return (
      <div className="coverage-bar">
        <div className="coverage-fill" style={{ width: `${percentage}%` }}></div>
      </div>
    );
  };

  return (
    <div className="market-card-content" onClick={() => onViewMarket(market.market_id)}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <h3>🏙️ {market.display_name}</h3>
          {market.state_code && <span className="state-code">{market.state_code}</span>}
        </div>
        {getStatusBadge()}
      </div>

      {/* Coverage */}
      <div className="coverage-section">
        <div className="coverage-label">
          <span>Coverage</span>
          <span className="coverage-percentage">{Math.round(market.coverage_percentage)}%</span>
        </div>
        {getCoverageBar()}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-item">
          <label>Data Points</label>
          <span>{market.data_points_count.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>Total Units</label>
          <span>{market.total_units.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>Active Deals</label>
          <span>{market.active_deals_count}</span>
        </div>
      </div>

      {/* Market Vitals */}
      {market.vitals && (
        <div className="vitals-section">
          <div className="vital">
            <span className="vital-icon">📈</span>
            <span className="vital-label">Rent Growth:</span>
            <span className="vital-value positive">
              {market.vitals.rent_growth_yoy > 0 ? '+' : ''}
              {market.vitals.rent_growth_yoy?.toFixed(1)}% YoY
            </span>
          </div>
          <div className="vital">
            <span className="vital-icon">📊</span>
            <span className="vital-label">Occupancy:</span>
            <span className="vital-value">{market.vitals.occupancy_rate?.toFixed(1)}%</span>
          </div>
          {market.vitals.jedi_score && (
            <div className="vital jedi-score">
              <span className="vital-icon">🎯</span>
              <span className="vital-label">JEDI Score:</span>
              <span className="vital-value score">{market.vitals.jedi_score}</span>
              <span className="rating">{market.vitals.jedi_rating}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="card-footer">
        <button className="view-button">
          View Market →
        </button>
      </div>

      <style>{`
        .market-card-content {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-title h3 {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .state-code {
          font-size: 12px;
          color: #64748b;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .status-badge {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.inactive {
          background: #f1f5f9;
          color: #64748b;
        }

        .coverage-section {
          margin-bottom: 20px;
        }

        .coverage-label {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .coverage-percentage {
          font-weight: 600;
          color: #0f172a;
        }

        .coverage-bar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
        }

        .coverage-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          transition: width 0.3s ease;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-item label {
          font-size: 12px;
          color: #64748b;
        }

        .stat-item span {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }

        .vitals-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }

        .vital {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .vital-icon {
          font-size: 16px;
        }

        .vital-label {
          color: #64748b;
        }

        .vital-value {
          font-weight: 600;
          color: #0f172a;
        }

        .vital-value.positive {
          color: #22c55e;
        }

        .vital.jedi-score {
          padding: 8px;
          background: #f8fafc;
          border-radius: 6px;
        }

        .vital-value.score {
          color: #3b82f6;
          font-size: 16px;
        }

        .rating {
          margin-left: auto;
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }

        .card-footer {
          margin-top: auto;
        }

        .view-button {
          width: 100%;
          padding: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          color: #3b82f6;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-button:hover {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
};

// Add Market Modal (placeholder - will implement next)
interface AddMarketModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddMarketModal: React.FC<AddMarketModalProps> = ({ onClose, onAdded }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Market</h2>
        <p>Market selection coming soon...</p>
        <button onClick={onClose}>Close</button>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 32px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
        }

        .modal-content h2 {
          margin: 0 0 16px 0;
        }

        .modal-content button {
          margin-top: 16px;
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

export default MyMarketsOverview;
