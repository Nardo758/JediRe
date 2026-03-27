/**
 * SubmarketTerminal - Bloomberg-style submarket analytics dashboard
 * Level 2 in the hierarchy: MSA → Submarket → Property
 * 
 * Tabs (same structure as PropertyTerminal, different data):
 * [0] OVERVIEW   - Submarket stats, health score, trends
 * [1] TRAFFIC    - Aggregate traffic patterns, demand signals
 * [2] FINANCIALS - Avg rents, cap rates, NOI by property type
 * [3] CAPITAL    - Debt market activity, recent transactions
 * [4] MARKET     - Supply pipeline, absorption, employment
 * [5] PROPERTIES - All properties in submarket (drill-down)
 * [6] NEWS       - Local market news, development announcements
 * [7] COMPARE    - Peer submarket comparison
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BT } from './theme';
import { TerminalTabs, useTabKeyboard } from './TerminalTabs';
import { SubmarketHeader } from './SubmarketHeader';
import { SubmarketOverviewTab } from './tabs/submarket/SubmarketOverviewTab';
import { SubmarketTrafficTab } from './tabs/submarket/SubmarketTrafficTab';
import { SubmarketFinancialsTab } from './tabs/submarket/SubmarketFinancialsTab';
import { SubmarketCapitalTab } from './tabs/submarket/SubmarketCapitalTab';
import { SubmarketMarketTab } from './tabs/submarket/SubmarketMarketTab';
import { SubmarketPropertiesTab } from './tabs/submarket/SubmarketPropertiesTab';
import { SubmarketNewsTab } from './tabs/submarket/SubmarketNewsTab';
import { SubmarketCompareTab } from './tabs/submarket/SubmarketCompareTab';

// Tab configuration for submarket level
export const SUBMARKET_TABS = [
  { key: 'overview', label: 'OVERVIEW', shortcut: '0' },
  { key: 'traffic', label: 'TRAFFIC', shortcut: '1' },
  { key: 'financials', label: 'FINANCIALS', shortcut: '2' },
  { key: 'capital', label: 'CAPITAL', shortcut: '3' },
  { key: 'market', label: 'MARKET', shortcut: '4' },
  { key: 'properties', label: 'PROPERTIES', shortcut: '5' },
  { key: 'news', label: 'NEWS', shortcut: '6' },
  { key: 'compare', label: 'COMPARE', shortcut: '7' },
] as const;

export type SubmarketTabKey = typeof SUBMARKET_TABS[number]['key'];

export interface SubmarketData {
  id: string;
  name: string;
  msaId: string;
  msaName: string;
  propertyCount: number;
  totalUnits: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  occupancyChange: number;
  avgCapRate: number;
  medianAge: number;
  classAPercent: number;
  classBPercent: number;
  classCPercent: number;
  pipelineUnits: number;
  absorptionRate: number;
  employmentGrowth: number;
  medianIncome: number;
  population: number;
  populationGrowth: number;
}

interface SubmarketTerminalProps {
  submarketId: string;
  submarket?: SubmarketData;
  onPropertySelect?: (propertyId: string) => void;
  onMsaNavigate?: () => void;
  embedded?: boolean; // Hide header/footer when embedded in F4MarketsView
}

export const SubmarketTerminal: React.FC<SubmarketTerminalProps> = ({
  submarketId,
  submarket: submarketProp,
  onPropertySelect,
  embedded = false,
  onMsaNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<SubmarketTabKey>('overview');
  const [submarket, setSubmarket] = useState<SubmarketData | null>(submarketProp || null);
  const [loading, setLoading] = useState(!submarketProp);
  const [error, setError] = useState<string | null>(null);

  // Keyboard navigation
  useTabKeyboard(activeTab, setActiveTab as any);

  // Load submarket data if not provided
  useEffect(() => {
    if (submarketProp) {
      setSubmarket(submarketProp);
      setLoading(false);
      return;
    }

    const loadSubmarket = async () => {
      try {
        setLoading(true);
        // Mock data for now - would come from API
        const mockSubmarket: SubmarketData = {
          id: submarketId,
          name: 'Buckhead',
          msaId: 'atlanta',
          msaName: 'Atlanta Metro',
          propertyCount: 127,
          totalUnits: 38450,
          avgRent: 1895,
          rentGrowth: 4.2,
          occupancy: 94.3,
          occupancyChange: 0.8,
          avgCapRate: 5.1,
          medianAge: 2012,
          classAPercent: 45,
          classBPercent: 38,
          classCPercent: 17,
          pipelineUnits: 2840,
          absorptionRate: 92,
          employmentGrowth: 3.1,
          medianIncome: 92500,
          population: 185000,
          populationGrowth: 2.4,
        };
        setSubmarket(mockSubmarket);
      } catch (err: any) {
        console.error('Failed to load submarket:', err);
        setError(err.message || 'Failed to load submarket data');
      } finally {
        setLoading(false);
      }
    };

    loadSubmarket();
  }, [submarketId, submarketProp]);

  // Sparkline data for header
  const sparklineData = useMemo(() => 
    [92, 93, 93.5, 94, 93.8, 94.2, 94.5, 94.3, 94.8, 95, 94.6, 94.3],
    []
  );

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
            <div style={{ fontSize: 12 }}>Loading submarket data...</div>
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
  if (error || !submarket) {
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
            <div style={{ fontSize: 14, marginBottom: 8 }}>Failed to load submarket</div>
            <div style={{ fontSize: 12, color: BT.text.muted }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    const tabProps = { 
      submarketId, 
      submarket,
      onPropertySelect,
    };

    switch (activeTab) {
      case 'overview':
        return <SubmarketOverviewTab {...tabProps} />;
      case 'traffic':
        return <SubmarketTrafficTab {...tabProps} />;
      case 'financials':
        return <SubmarketFinancialsTab {...tabProps} />;
      case 'capital':
        return <SubmarketCapitalTab {...tabProps} />;
      case 'market':
        return <SubmarketMarketTab {...tabProps} />;
      case 'properties':
        return <SubmarketPropertiesTab {...tabProps} />;
      case 'news':
        return <SubmarketNewsTab {...tabProps} />;
      case 'compare':
        return <SubmarketCompareTab {...tabProps} />;
      default:
        return <SubmarketOverviewTab {...tabProps} />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BT.bg.terminal,
      borderRadius: embedded ? 0 : 10,
      overflow: 'hidden',
      fontFamily: embedded ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
    }}>
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
      `}</style>

      {/* Breadcrumb Navigation - hidden when embedded */}
      {!embedded && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
          fontSize: 11,
        }}>
          <span 
            onClick={onMsaNavigate}
            style={{ 
              color: BT.text.cyan, 
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            {submarket.msaName}
          </span>
          <span style={{ color: BT.text.dim }}>›</span>
          <span style={{ color: BT.text.amber, fontWeight: 600 }}>
            {submarket.name}
          </span>
        </div>
      )}

      {/* Header - Submarket ticker - hidden when embedded */}
      {!embedded && (
        <SubmarketHeader
          submarket={submarket}
          sparklineData={sparklineData}
        />
      )}

      {/* Tab navigation */}
      <TerminalTabs
        tabs={SUBMARKET_TABS as any}
        activeTab={activeTab}
        onTabChange={setActiveTab as any}
        searchPlaceholder="Press 0-7 to navigate"
      />

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: embedded ? 12 : 20,
      }}>
        {renderTabContent()}
      </div>

      {/* Footer ticker - hidden when embedded */}
      {!embedded && (
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
          <span style={{ color: BT.text.green }}>● {submarket.propertyCount} Properties</span>
          <span>|</span>
          <span style={{ color: BT.text.cyan }}>{submarket.totalUnits.toLocaleString()} Units</span>
          <span>|</span>
          <span style={{ color: BT.text.amber }}>Pipeline: {submarket.pipelineUnits.toLocaleString()} units</span>
          <span>|</span>
          <span>Absorption: {submarket.absorptionRate}%</span>
          <span>|</span>
          <span style={{ color: BT.text.green }}>Emp Growth +{submarket.employmentGrowth}%</span>
        </div>
      )}
    </div>
  );
};

export default SubmarketTerminal;
