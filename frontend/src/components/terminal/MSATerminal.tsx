/**
 * MSATerminal - Bloomberg-style MSA/Metro analytics dashboard
 * Top level in the hierarchy: MSA → Submarket → Property
 * 
 * Tabs:
 * [0] OVERVIEW    - Metro stats, health score, key metrics
 * [1] SUBMARKETS  - All submarkets with rankings (drill-down)
 * [2] SUPPLY      - Metro-wide supply pipeline
 * [3] CAPITAL     - Transaction volume, cap rate trends
 * [4] ECONOMICS   - Employment, population, income trends
 * [5] TRENDS      - Historical rent/occupancy charts
 * [6] NEWS        - Metro market news
 * [7] COMPARE     - Compare to peer MSAs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BT } from './theme';
import { TerminalTabs, TabDef, useTabKeyboard } from './TerminalTabs';
import { MSAHeader } from './MSAHeader';
import { MSAOverviewTab } from './tabs/msa/MSAOverviewTab';
import { MSASubmarketsTab } from './tabs/msa/MSASubmarketsTab';
import { MSASupplyTab } from './tabs/msa/MSASupplyTab';
import { MSACapitalTab } from './tabs/msa/MSACapitalTab';
import { MSAEconomicsTab } from './tabs/msa/MSAEconomicsTab';
import { MSATrendsTab } from './tabs/msa/MSATrendsTab';
import { MSANewsTab } from './tabs/msa/MSANewsTab';
import { MSACompareTab } from './tabs/msa/MSACompareTab';

// Tab configuration for MSA level
export const MSA_TABS: TabDef[] = [
  { key: 'overview', label: 'OVERVIEW', num: 0 },
  { key: 'submarkets', label: 'SUBMARKETS', num: 1 },
  { key: 'supply', label: 'SUPPLY', num: 2 },
  { key: 'capital', label: 'CAPITAL', num: 3 },
  { key: 'economics', label: 'ECONOMICS', num: 4 },
  { key: 'trends', label: 'TRENDS', num: 5 },
  { key: 'news', label: 'NEWS', num: 6 },
  { key: 'compare', label: 'COMPARE', num: 7 },
];

export type MSATabKey = 'overview' | 'submarkets' | 'supply' | 'capital' | 'economics' | 'trends' | 'news' | 'compare';

export interface MSAData {
  id: string;
  name: string;
  state: string;
  region: string;
  population: number;
  populationGrowth: number;
  employment: number;
  employmentGrowth: number;
  medianIncome: number;
  incomeGrowth: number;
  submarketCount: number;
  propertyCount: number;
  totalUnits: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  occupancyChange: number;
  avgCapRate: number;
  pipelineUnits: number;
  transactionVolume: number;
  healthScore: number;
  rank: number;
  totalRank: number;
}

interface MSATerminalProps {
  msaId: string;
  msa?: MSAData;
  onSubmarketSelect?: (submarketId: string) => void;
  onBackToMarkets?: () => void;
}

export const MSATerminal: React.FC<MSATerminalProps> = ({
  msaId,
  msa: msaProp,
  onSubmarketSelect,
  onBackToMarkets,
}) => {
  const [activeTab, setActiveTab] = useState<MSATabKey>('overview');
  const [msa, setMsa] = useState<MSAData | null>(msaProp || null);
  const [loading, setLoading] = useState(!msaProp);
  const [error, setError] = useState<string | null>(null);

  // Keyboard navigation
  useTabKeyboard(activeTab, setActiveTab, MSA_TABS);

  // Load MSA data if not provided
  useEffect(() => {
    if (msaProp) {
      setMsa(msaProp);
      setLoading(false);
      return;
    }

    const loadMSA = async () => {
      try {
        setLoading(true);
        // Mock data - would come from API
        const mockMSA: MSAData = {
          id: msaId,
          name: 'Atlanta',
          state: 'GA',
          region: 'Southeast',
          population: 6200000,
          populationGrowth: 1.8,
          employment: 3100000,
          employmentGrowth: 2.9,
          medianIncome: 72500,
          incomeGrowth: 3.2,
          submarketCount: 24,
          propertyCount: 1847,
          totalUnits: 485000,
          avgRent: 1680,
          rentGrowth: 4.2,
          occupancy: 94.1,
          occupancyChange: 0.6,
          avgCapRate: 5.3,
          pipelineUnits: 28500,
          transactionVolume: 4200000000,
          healthScore: 82,
          rank: 5,
          totalRank: 50,
        };
        setMsa(mockMSA);
      } catch (err: any) {
        console.error('Failed to load MSA:', err);
        setError(err.message || 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    loadMSA();
  }, [msaId, msaProp]);

  // Sparkline data for header
  const sparklineData = useMemo(() => 
    [1580, 1610, 1625, 1640, 1635, 1655, 1670, 1680, 1695, 1705, 1690, 1680],
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
            <div style={{ fontSize: 12 }}>Loading market data...</div>
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
  if (error || !msa) {
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
            <div style={{ fontSize: 14, marginBottom: 8 }}>Failed to load market</div>
            <div style={{ fontSize: 12, color: BT.text.muted }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Render tab content
  const renderTabContent = () => {
    const tabProps = { 
      msaId, 
      msa,
      onSubmarketSelect,
    };

    switch (activeTab) {
      case 'overview':
        return <MSAOverviewTab {...tabProps} />;
      case 'submarkets':
        return <MSASubmarketsTab {...tabProps} />;
      case 'supply':
        return <MSASupplyTab {...tabProps} />;
      case 'capital':
        return <MSACapitalTab {...tabProps} />;
      case 'economics':
        return <MSAEconomicsTab {...tabProps} />;
      case 'trends':
        return <MSATrendsTab {...tabProps} />;
      case 'news':
        return <MSANewsTab {...tabProps} />;
      case 'compare':
        return <MSACompareTab {...tabProps} />;
      default:
        return <MSAOverviewTab {...tabProps} />;
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

      {/* Breadcrumb Navigation */}
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
          onClick={onBackToMarkets}
          style={{ 
            color: BT.text.cyan, 
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          F4 Markets
        </span>
        <span style={{ color: BT.text.dim }}>›</span>
        <span style={{ color: BT.text.amber, fontWeight: 600 }}>
          {msa.name}, {msa.state}
        </span>
        <span style={{ 
          marginLeft: 'auto', 
          color: BT.text.muted,
          fontSize: 10,
        }}>
          Rank #{msa.rank} of {msa.totalRank} • {msa.region}
        </span>
      </div>

      {/* Header - MSA ticker */}
      <MSAHeader
        msa={msa}
        sparklineData={sparklineData}
      />

      {/* Tab navigation */}
      <TerminalTabs
        tabs={MSA_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab as any}
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

      {/* Footer ticker */}
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
        <span style={{ color: BT.text.green }}>● {msa.submarketCount} Submarkets</span>
        <span>|</span>
        <span style={{ color: BT.text.cyan }}>{msa.propertyCount.toLocaleString()} Properties</span>
        <span>|</span>
        <span style={{ color: BT.text.amber }}>{(msa.totalUnits / 1000).toFixed(0)}K Units</span>
        <span>|</span>
        <span>Pipeline: {(msa.pipelineUnits / 1000).toFixed(1)}K units</span>
        <span>|</span>
        <span style={{ color: BT.text.green }}>YTD Volume ${(msa.transactionVolume / 1000000000).toFixed(1)}B</span>
      </div>
    </div>
  );
};

export default MSATerminal;
