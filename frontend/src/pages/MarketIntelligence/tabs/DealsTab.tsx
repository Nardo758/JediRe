// DealsTab.tsx - User's active deals in this market
// Created: 2026-02-21
// Shows YOUR portfolio deals (not research data)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Calendar, DollarSign } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface Deal {
  id: number;
  name: string;
  property_type: string;
  status: string;
  jedi_score: number | null;
  units: number | null;
  created_at: string;
}

interface DealsTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

const DealsTab: React.FC<DealsTabProps> = ({ marketId, summary }) => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, [marketId]);

  const loadDeals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/deals?market=${marketId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setDeals(data.deals || []);
    } catch (error) {
      console.error('Error loading deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      active: 'status-active',
      pipeline: 'status-pipeline',
      closed: 'status-closed',
      archived: 'status-archived',
    };
    return statusClasses[status.toLowerCase()] || 'status-default';
  };

  if (loading) {
    return <div className="deals-loading">Loading deals...</div>;
  }

  return (
    <div className="deals-tab">
      {/* Header */}
      <div className="deals-header">
        <div>
          <h2>💼 Your Deals in {summary.market.display_name}</h2>
          <p>
            {summary.active_deals_count} active {summary.active_deals_count === 1 ? 'deal' : 'deals'}
            • These are properties you own or are pursuing
          </p>
        </div>
        <button 
          className="create-deal-button"
          onClick={() => navigate('/deals/create')}
        >
          <Plus size={18} />
          Create Deal
        </button>
      </div>

      {/* Deals Grid/List */}
      {deals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Building2 size={48} />
          </div>
          <h3>No deals yet in this market</h3>
          <p>Create your first deal to start tracking properties in {summary.market.display_name}</p>
          <button 
            className="create-deal-button"
            onClick={() => navigate('/deals/create')}
          >
            <Plus size={18} />
            Create Your First Deal
          </button>
        </div>
      ) : (
        <div className="deals-grid">
          {deals.map(deal => (
            <div 
              key={deal.id} 
              className="deal-card"
              onClick={() => navigate(`/deals/${deal.id}`)}
            >
              <div className="deal-header">
                <h3>{deal.name}</h3>
                <span className={`status-badge ${getStatusBadge(deal.status)}`}>
                  {deal.status}
                </span>
              </div>

              <div className="deal-meta">
                <div className="meta-item">
                  <Building2 size={14} />
                  <span>{deal.property_type || 'multifamily'}</span>
                </div>
                {deal.units && (
                  <div className="meta-item">
                    <DollarSign size={14} />
                    <span>{deal.units} units</span>
                  </div>
                )}
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{new Date(deal.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {deal.jedi_score && (
                <div className="jedi-score-badge">
                  <span>JEDI Score:</span>
                  <strong>{deal.jedi_score}</strong>
                </div>
              )}

              <div className="deal-footer">
                <button 
                  className="view-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/deals/${deal.id}`);
                  }}
                >
                  View Deal →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <h3>📌 About Your Deals</h3>
        <p>
          This tab shows properties in your portfolio that are located in {summary.market.display_name}.
          These are separate from the "Market Data" tab, which shows research data points for analysis.
        </p>
        <div className="info-grid">
          <div>
            <strong>Market Data:</strong> Research data for analysis (1,028 properties)
          </div>
          <div>
            <strong>Deals:</strong> Your active portfolio ({summary.active_deals_count} deals)
          </div>
        </div>
      </div>

      <style>{`
        .deals-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .deals-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        .deals-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .deals-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .create-deal-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .create-deal-button:hover {
          background: #2563eb;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          padding: 64px 24px;
          border-radius: 12px;
          text-align: center;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-center;
          width: 96px;
          height: 96px;
          background: #f8fafc;
          border-radius: 50%;
          color: #cbd5e1;
          margin-bottom: 24px;
        }

        .empty-state h3 {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .empty-state p {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 24px 0;
        }

        .deals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .deal-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .deal-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .deal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .deal-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-active {
          background: #dcfce7;
          color: #15803d;
        }

        .status-pipeline {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-closed {
          background: #f1f5f9;
          color: #64748b;
        }

        .deal-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #64748b;
        }

        .jedi-score-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #eff6ff;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .jedi-score-badge strong {
          color: #3b82f6;
          font-size: 16px;
          font-weight: 700;
        }

        .deal-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 16px;
        }

        .view-button {
          width: 100%;
          padding: 8px;
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

        .info-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          padding: 20px;
        }

        .info-box h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1e40af;
          margin: 0 0 12px 0;
        }

        .info-box p {
          font-size: 14px;
          color: #1e3a8a;
          margin: 0 0 12px 0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 12px;
          font-size: 13px;
          color: #1e3a8a;
        }

        .info-grid strong {
          color: #1e40af;
        }

        .deals-loading {
          background: white;
          padding: 48px;
          text-align: center;
          color: #64748b;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
};

export default DealsTab;
