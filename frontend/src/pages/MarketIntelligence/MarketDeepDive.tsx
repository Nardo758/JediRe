// MarketDeepDive.tsx - Unified per-market view
// Created: 2026-02-21
// Phase 4: Consolidates Market Data + Market Research into tabbed interface

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Database, Map, LineChart, Building2 } from 'lucide-react';
import type { MarketSummaryResponse } from '../../types/marketIntelligence.types';

// Tab Components (will import existing or create new)
import MarketOverviewTab from './tabs/MarketOverviewTab';
import MarketDataTab from './tabs/MarketDataTab';
import SubmarketsTab from './tabs/SubmarketsTab';
import TrendsTab from './tabs/TrendsTab';
import DealsTab from './tabs/DealsTab';

type TabId = 'overview' | 'market-data' | 'submarkets' | 'trends' | 'deals';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
}

const MarketDeepDive: React.FC = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (marketId) {
      loadMarketSummary(marketId);
    }
  }, [marketId]);

  const loadMarketSummary = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/markets/${id}/summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error loading market summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <TrendingUp size={18} />,
      component: MarketOverviewTab
    },
    {
      id: 'market-data',
      label: 'Market Data',
      icon: <Database size={18} />,
      component: MarketDataTab
    },
    {
      id: 'submarkets',
      label: 'Submarkets',
      icon: <Map size={18} />,
      component: SubmarketsTab
    },
    {
      id: 'trends',
      label: 'Trends',
      icon: <LineChart size={18} />,
      component: TrendsTab
    },
    {
      id: 'deals',
      label: 'Deals',
      icon: <Building2 size={18} />,
      component: DealsTab
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component || MarketOverviewTab;

  if (loading) {
    return (
      <div className="market-loading">
        <div className="spinner">Loading market data...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="market-error">
        <h2>Market not found</h2>
        <button onClick={() => navigate('/markets')}>Back to Markets</button>
      </div>
    );
  }

  return (
    <div className="market-deep-dive">
      {/* Header */}
      <header className="market-header">
        <button className="back-button" onClick={() => navigate('/markets')}>
          <ArrowLeft size={18} />
          Back to My Markets
        </button>

        <div className="market-title">
          <h1>{summary.market.display_name}</h1>
          <div className="market-meta">
            {summary.market.state_code && (
              <span className="state-badge">{summary.market.state_code}</span>
            )}
            <span className="separator">•</span>
            <span>Research Data: {summary.market.data_points_count.toLocaleString()}</span>
            <span className="separator">•</span>
            <span>Coverage: {summary.market.coverage_percentage?.toFixed(0)}%</span>
            {summary.vitals?.jedi_score && (
              <>
                <span className="separator">•</span>
                <span className="jedi-score">
                  JEDI Score: <strong>{summary.vitals.jedi_score}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Track Market Toggle */}
        {!summary.is_tracked && (
          <button className="track-button">
            + Track This Market
          </button>
        )}
      </header>

      {/* Tabs Navigation */}
      <nav className="tabs-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main className="tab-content">
        <ActiveComponent 
          marketId={marketId!}
          summary={summary}
          onUpdate={() => loadMarketSummary(marketId!)}
        />
      </main>

      <style jsx>{`
        .market-deep-dive {
          min-height: 100vh;
          background: #f8fafc;
        }

        .market-header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 20px 24px;
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
          transition: color 0.2s;
        }

        .back-button:hover {
          color: #334155;
        }

        .market-title h1 {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .market-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: #64748b;
          flex-wrap: wrap;
        }

        .state-badge {
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: 500;
          color: #475569;
        }

        .separator {
          color: #cbd5e1;
        }

        .jedi-score strong {
          color: #3b82f6;
          font-weight: 600;
        }

        .track-button {
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .track-button:hover {
          background: #2563eb;
        }

        .tabs-nav {
          display: flex;
          background: white;
          border-bottom: 2px solid #e2e8f0;
          padding: 0 24px;
          overflow-x: auto;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-button:hover {
          color: #334155;
          background: #f8fafc;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          background: #f8fafc;
        }

        .tab-content {
          padding: 24px;
        }

        .market-loading,
        .market-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 16px;
        }

        .spinner {
          font-size: 18px;
          color: #64748b;
        }

        .market-error button {
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

export default MarketDeepDive;
