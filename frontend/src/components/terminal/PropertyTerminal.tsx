/**
 * PropertyTerminal - Bloomberg-style property analytics dashboard
 * 
 * Tabs:
 * [0] OVERVIEW   - Key metrics, exit score, convergence
 * [1] TRAFFIC    - Leasing predictions, digital traffic
 * [2] FINANCIALS - Pro forma, projections, assumptions
 * [3] CAPITAL    - Debt comparison, waterfall, equity
 * [4] MARKET     - Market intel, sensitivity analysis
 * [5] COMPS      - Comparable properties + future supply
 * [6] NEWS       - Market news, rate changes
 * [7] STRATEGY   - Investment decision, action items
 */

import React, { useState, useEffect } from 'react';
import { BT, TabKey, TERMINAL_TABS } from './theme';
import { TerminalHeader } from './TerminalHeader';
import { TerminalTabs, useTabKeyboard } from './TerminalTabs';
import { OverviewTab } from './tabs/OverviewTab';
import { TrafficTab } from './tabs/TrafficTab';
import { FinancialsTab } from './tabs/FinancialsTab';
import { CapitalTab } from './tabs/CapitalTab';
import { MarketTab } from './tabs/MarketTab';
import { CompsTab } from './tabs/CompsTab';
import { NewsTab } from './tabs/NewsTab';
import { StrategyTab } from './tabs/StrategyTab';
import { apiClient } from '@/services/api.client';

interface PropertyTerminalProps {
  dealId: string;
  deal?: any;
}

export const PropertyTerminal: React.FC<PropertyTerminalProps> = ({
  dealId,
  deal: dealProp,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [deal, setDeal] = useState<any>(dealProp || null);
  const [loading, setLoading] = useState(!dealProp);
  const [error, setError] = useState<string | null>(null);

  // Keyboard navigation
  useTabKeyboard(activeTab, setActiveTab);

  // Load deal data if not provided
  useEffect(() => {
    if (dealProp) {
      setDeal(dealProp);
      setLoading(false);
      return;
    }

    const loadDeal = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/api/v1/deals/${dealId}`);
        const data = response.data?.deal || response.data?.data || response.data;
        setDeal(data);
      } catch (err: any) {
        console.error('Failed to load deal:', err);
        setError(err.message || 'Failed to load deal data');
      } finally {
        setLoading(false);
      }
    };

    loadDeal();
  }, [dealId, dealProp]);

  // Extract property metrics for header
  const propertyMetrics = React.useMemo(() => {
    if (!deal) {
      return {
        name: 'Loading...',
        avgRent: 0,
        rentChange: 0,
        occupancy: 0,
        occupancyChange: 0,
        units: 0,
      };
    }

    const marketContext = deal.marketContext || {};
    const property = deal.properties?.[0] || {};
    
    return {
      name: deal.name || deal.deal_name || 'Untitled Property',
      address: deal.address || property.address,
      avgRent: marketContext.avg_rent || property.avg_rent || 1850,
      rentChange: (marketContext.rent_growth || 0.04) * 100,
      occupancy: marketContext.occupancy_rate || property.occupancy || 0.94,
      occupancyChange: 0.8, // Mock for now
      units: deal.target_units || property.units || 300,
      noi: deal.proforma?.noi || property.noi,
      capRate: marketContext.cap_rate || property.cap_rate,
      lastUpdated: deal.updated_at ? new Date(deal.updated_at).toLocaleDateString() : undefined,
    };
  }, [deal]);

  // Mock sparkline data (would come from historical API)
  const sparklineData = [100, 102, 105, 103, 108, 110, 112, 115, 118, 120, 122, 125];

  // Render loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: BT.bg.terminal,
        borderRadius: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: BT.text.muted,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 40,
              height: 40,
              border: `3px solid ${BT.border.subtle}`,
              borderTopColor: BT.text.amber,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 12 }}>Loading property data...</div>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: BT.bg.terminal,
        borderRadius: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: BT.text.red,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Failed to load property</div>
            <div style={{ fontSize: 12, color: BT.text.muted }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    const tabProps = { dealId, deal };

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...tabProps} />;
      case 'traffic':
        return <TrafficTab {...tabProps} />;
      case 'financials':
        return <FinancialsTab {...tabProps} />;
      case 'capital':
        return <CapitalTab {...tabProps} />;
      case 'market':
        return <MarketTab {...tabProps} />;
      case 'comps':
        return <CompsTab {...tabProps} />;
      case 'news':
        return <NewsTab {...tabProps} />;
      case 'strategy':
        return <StrategyTab {...tabProps} />;
      default:
        return <OverviewTab {...tabProps} />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BT.bg.terminal,
      borderRadius: 10,
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
      `}</style>

      {/* Header - Property ticker */}
      <TerminalHeader
        property={propertyMetrics}
        sparklineData={sparklineData}
        isLive={true}
      />

      {/* Tab navigation */}
      <TerminalTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchPlaceholder="Press 0-7 to navigate"
      />

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 20,
      }}>
        {renderTabContent()}
      </div>

      {/* Footer ticker (optional) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 20px',
        background: BT.bg.header,
        borderTop: `1px solid ${BT.border.subtle}`,
        fontSize: 10,
        color: BT.text.dim,
        gap: 16,
        overflow: 'hidden',
      }}>
        <span style={{ color: BT.text.green }}>● FEDRATE 4.25%</span>
        <span>|</span>
        <span style={{ color: BT.text.cyan }}>10Y 4.18% (+0.02)</span>
        <span>|</span>
        <span style={{ color: BT.text.amber }}>SOFR 4.31%</span>
        <span>|</span>
        <span>ATL Vacancy 6.2%</span>
        <span>|</span>
        <span style={{ color: BT.text.green }}>Rent Growth +4.1% YoY</span>
      </div>
    </div>
  );
};

export default PropertyTerminal;
