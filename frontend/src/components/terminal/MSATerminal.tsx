/**
 * MSATerminal - Bloomberg-style MSA/Metro analytics dashboard
 * Top level in the hierarchy: MSA → Submarket → Property
 * 
 * Tabs (12 total):
 * [0] OVERVIEW      - Signal chart+metrics, commentary, alerts, supply, dev capacity
 * [1] SUBMARKETS    - 14-column matrix with Dev Capacity signals
 * [2] DEALS         - Pipeline kanban, quadrant filter, opportunities
 * [3] RANKINGS      - Power Rankings with PCS scores
 * [4] PROPERTIES    - Property listings and search
 * [5] OWNERS        - Owner analysis and portfolio data
 * [6] SUPPLY        - Supply wave forecast, phases
 * [7] CAPITAL       - Transaction volume, cap rate trends
 * [8] ECONOMICS     - Employment, population, income trends
 * [9] TRENDS        - Correlation, rent by vintage, JEDI history
 * [10] NEWS         - Metro market news
 * [11] COMPARE      - Compare to peer MSAs
 */

import React, { useState, useEffect } from 'react';
import { BT } from './theme';
import { TerminalTabs, TabDef, useTabKeyboard } from './TerminalTabs';
import { MSAHeader } from './MSAHeader';
import { MSAOverviewTab } from './tabs/msa/MSAOverviewTab';
import { MSASubmarketsTab } from './tabs/msa/MSASubmarketsTab';
import { MSADealsTab } from './tabs/msa/MSADealsTab';
import { MSAPowerRankingsTab } from './tabs/msa/MSAPowerRankingsTab';
import { MSASupplyTab } from './tabs/msa/MSASupplyTab';
import { MSACapitalTab } from './tabs/msa/MSACapitalTab';
import { MSAEconomicsTab } from './tabs/msa/MSAEconomicsTab';
import { MSATrendsTab } from './tabs/msa/MSATrendsTab';
import { MSANewsTab } from './tabs/msa/MSANewsTab';
import { MSACompareTab } from './tabs/msa/MSACompareTab';
import { MSAOwnersTab } from './tabs/msa/MSAOwnersTab';
import { MSAPropertiesTab } from './tabs/msa/MSAPropertiesTab';
import { MSAEventsTab } from './tabs/msa/MSAEventsTab';

export const MSA_TABS: TabDef[] = [
  { key: 'overview', label: 'OVERVIEW', num: 0 },
  { key: 'submarkets', label: 'SUBMARKETS', num: 1 },
  { key: 'deals', label: 'DEALS', num: 2 },
  { key: 'rankings', label: 'RANKINGS', num: 3 },
  { key: 'properties', label: 'PROPERTIES', num: 4 },
  { key: 'owners', label: 'OWNERS', num: 5 },
  { key: 'supply', label: 'SUPPLY', num: 6 },
  { key: 'capital', label: 'CAPITAL', num: 7 },
  { key: 'economics', label: 'ECONOMICS', num: 8 },
  { key: 'trends', label: 'TRENDS', num: 9 },
  { key: 'news', label: 'NEWS', num: 10 },
  { key: 'compare', label: 'COMPARE', num: 11 },
  { key: 'events', label: 'EVENTS ⚡', num: 12 },
];

export type MSATabKey = 'overview' | 'submarkets' | 'deals' | 'rankings' | 'properties' | 'owners' | 'supply' | 'capital' | 'economics' | 'trends' | 'news' | 'compare' | 'events';

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
  onPropertySelect?: (propertyId: string, propertyName?: string) => void;
  onDealSelect?: (dealId: string) => void;
  onBackToMarkets?: () => void;
  embedded?: boolean; // Hide header/footer when embedded in F4MarketsView
}

export const MSATerminal: React.FC<MSATerminalProps> = ({
  msaId,
  msa: msaProp,
  onSubmarketSelect,
  onPropertySelect,
  onDealSelect,
  onBackToMarkets,
  embedded = false,
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
        // Mock data for now - would fetch from API
        const mockMSA: MSAData = {
          id: msaId,
          name: msaId === 'atlanta' ? 'Atlanta' : msaId.charAt(0).toUpperCase() + msaId.slice(1),
          state: 'GA',
          region: 'Southeast',
          population: 6200000,
          populationGrowth: 1.8,
          employment: 3100000,
          employmentGrowth: 2.4,
          medianIncome: 72400,
          incomeGrowth: 3.2,
          submarketCount: 24,
          propertyCount: 1028,
          totalUnits: 249964,
          avgRent: 1580,
          rentGrowth: 4.2,
          occupancy: 93.2,
          occupancyChange: 0.4,
          avgCapRate: 5.2,
          pipelineUnits: 32400,
          transactionVolume: 2800000000,
          healthScore: 72,
          rank: 3,
          totalRank: 50,
        };
        setMsa(mockMSA);
        setError(null);
      } catch (err) {
        setError('Failed to load MSA data');
        console.error('Error loading MSA:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMSA();
  }, [msaId, msaProp]);

  // Render active tab content
  const renderTabContent = () => {
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 400,
          color: BT.text.muted,
        }}>
          Loading MSA data...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 400,
          color: BT.accent.red,
        }}>
          {error}
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <MSAOverviewTab msaId={msaId} msa={msa} />;
      case 'submarkets':
        return <MSASubmarketsTab msaId={msaId} msa={msa} onSelectSubmarket={onSubmarketSelect} />;
      case 'deals':
        return <MSADealsTab msaId={msaId} msa={msa} onSelectDeal={onDealSelect} />;
      case 'rankings':
        return <MSAPowerRankingsTab msaId={msaId} msa={msa} onSelectProperty={onPropertySelect} />;
      case 'properties':
        return <MSAPropertiesTab msaId={msaId} msa={msa} onSelectProperty={onPropertySelect} />;
      case 'owners':
        return <MSAOwnersTab msaId={msaId} msa={msa} onSelectProperty={onPropertySelect} />;
      case 'supply':
        return <MSASupplyTab msaId={msaId} msa={msa} />;
      case 'capital':
        return <MSACapitalTab msaId={msaId} msa={msa} />;
      case 'economics':
        return <MSAEconomicsTab msaId={msaId} msa={msa} />;
      case 'trends':
        return <MSATrendsTab msaId={msaId} msa={msa} />;
      case 'news':
        return <MSANewsTab msaId={msaId} msa={msa} />;
      case 'compare':
        return <MSACompareTab msaId={msaId} msa={msa} />;
      case 'events':
        return <MSAEventsTab msaId={msaId} msa={msa} />;
      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: embedded ? BT.bg.terminal : BT.bg.panel,
      color: BT.text.primary,
      fontFamily: embedded ? "'JetBrains Mono', monospace" : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Header - hidden when embedded */}
      {!embedded && (
        <MSAHeader 
          msa={msa} 
        />
      )}

      {/* Tab Bar */}
      <TerminalTabs
        tabs={MSA_TABS}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as MSATabKey)}
      />

      {/* Tab Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: embedded ? 12 : 20,
      }}>
        {renderTabContent()}
      </div>

      {/* Footer Status Bar - hidden when embedded */}
      {!embedded && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: BT.bg.elevated,
          borderTop: `1px solid ${BT.border.subtle}`,
          fontSize: 11,
          color: BT.text.muted,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>MSA: {msa?.name || msaId}</span>
            <span>·</span>
            <span>{msa?.submarketCount || 0} Submarkets</span>
            <span>·</span>
            <span>{msa?.propertyCount?.toLocaleString() || 0} Properties</span>
            <span>·</span>
            <span>{msa?.totalUnits?.toLocaleString() || 0} Units</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Health: <span style={{ color: BT.text.green, fontWeight: 600 }}>{msa?.healthScore || 0}</span></span>
            <span>·</span>
            <span>Rank: #{msa?.rank || 0}/{msa?.totalRank || 0}</span>
            <span>·</span>
            <span style={{ color: BT.text.cyan }}>Use 0-9 for tabs</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MSATerminal;
