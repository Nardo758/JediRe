import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import BoundaryAndZoningTab from '../../zoning/tabs/BoundaryAndZoningTab';
import DevelopmentCapacityTab from '../../zoning/tabs/DevelopmentCapacityTab';
import RegulatoryRiskTab from '../../zoning/tabs/RegulatoryRiskTab';
import TimeToShovelTab from '../../zoning/tabs/TimeToShovelTab';
import HighestBestUseTab from '../../zoning/tabs/HighestBestUseTab';
import EntitlementTrackerTab from '../../zoning/tabs/EntitlementTrackerTab';
import type { ZoningTabId } from '../../../types/zoning.types';
import { T as BT, mono as bMono, sans as bSans } from '../bloomberg-tokens';
import { BT as BT2 } from '../bloomberg-ui';

interface ZoningModuleSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

const ALL_TABS: { id: ZoningTabId; label: string; icon: React.ReactNode; step: number }[] = [
  { id: 'boundary_zoning', label: 'Boundary & Zoning', icon: <MapPin className="w-4 h-4" />, step: 1 },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" />, step: 2 },
  { id: 'hbu', label: 'Highest & Best Use', icon: <TrendingUp className="w-4 h-4" />, step: 3 },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" />, step: 4 },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" />, step: 5 },
  { id: 'entitlements', label: 'Entitlements', icon: <CheckCircle2 className="w-4 h-4" />, step: 6 },
];

export function ZoningModuleSection({ deal, dealId: propDealId, onUpdate }: ZoningModuleSectionProps) {
  // All 6 tabs are always visible regardless of deal type
  const visibleTabs = ALL_TABS;

  const resolvedDealId = propDealId || deal?.id;
  const [activeTab, setActiveTab] = useState<ZoningTabId>('boundary_zoning');
  const [boundaryAndZoningComplete, setBoundaryAndZoningComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check completion status on mount
  useEffect(() => {
    checkCompletionStatus();
  }, [resolvedDealId]);

  const checkCompletionStatus = async () => {
    if (!resolvedDealId) {
      setLoading(false);
      return;
    }

    try {
      const boundaryRes = await apiClient.get(`/api/v1/deals/${resolvedDealId}/boundary`);

      const hasBoundary = !!(
        boundaryRes.data?.id ||
        boundaryRes.data?.boundary_geojson
      );

      let isConfirmed = false;
      if (hasBoundary) {
        try {
          const zoningRes = await apiClient.get(`/api/v1/deals/${resolvedDealId}/zoning-confirmation`);
          isConfirmed = !!zoningRes.data?.confirmed_at;
        } catch {
          // Treat boundary existence as implicit confirmation for legacy deals
          isConfirmed = true;
        }
      }

      setBoundaryAndZoningComplete(isConfirmed);

      if (!hasBoundary) {
        setStatusMessage('Draw property boundary to unlock zoning analysis');
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setStatusMessage('Draw property boundary to unlock zoning analysis');
      } else {
        setStatusMessage(`Error loading boundary data: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
      }
      setBoundaryAndZoningComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBoundaryAndZoningComplete = (zoningData?: any) => {
    setBoundaryAndZoningComplete(true);
    setStatusMessage(null);
    setActiveTab('capacity');
    checkCompletionStatus();
    if (onUpdate) onUpdate();
  };

  const isTabUnlocked = (tabId: ZoningTabId): boolean => {
    if (tabId === 'boundary_zoning') return true;
    return boundaryAndZoningComplete;
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'boundary_zoning':
        return (
          <BoundaryAndZoningTab
            dealId={resolvedDealId}
            deal={deal}
            onComplete={handleBoundaryAndZoningComplete}
          />
        );
      case 'capacity':
        return <DevelopmentCapacityTab dealId={resolvedDealId} deal={deal} />;
      case 'hbu':
        return <HighestBestUseTab dealId={resolvedDealId} deal={deal} />;
      case 'risk':
        return <RegulatoryRiskTab dealId={resolvedDealId} deal={deal} />;
      case 'timeline':
        return <TimeToShovelTab dealId={resolvedDealId} deal={deal} />;
      case 'entitlements':
        return <EntitlementTrackerTab dealId={resolvedDealId} deal={deal} />;
      default:
        return (
          <BoundaryAndZoningTab
            dealId={resolvedDealId}
            deal={deal}
            onComplete={handleBoundaryAndZoningComplete}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-[#7f8ea3]">Loading zoning analysis...</div>
      </div>
    );
  }

  const MONO = BT2.font.mono;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT2.bg.terminal }}>
      {/* Bloomberg v0.34 PanelHeader */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px',
        background: BT2.bg.header,
        borderBottom: `1px solid ${BT2.border.subtle}`,
        borderTop: `2px solid ${BT2.text.cyan}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.white, letterSpacing: 0.8, fontFamily: MONO }}>PROPERTY &amp; ZONING</span>
          <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: MONO }}>M02 | Verification-First</span>
          {deal?.strategy && (
            <span style={{ fontSize: 8, color: BT2.text.cyan, fontFamily: MONO }}>{deal.strategy}</span>
          )}
        </div>
        {!boundaryAndZoningComplete && (
          <button
            onClick={() => checkCompletionStatus()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: MONO, fontSize: 8, color: BT2.text.secondary,
              background: 'transparent', border: `1px solid ${BT2.border.subtle}`,
              padding: '2px 8px', cursor: 'pointer',
            }}
          >
            <RefreshCw size={10} />
            REFRESH
          </button>
        )}
      </div>

      {/* Status Banner */}
      {statusMessage && !boundaryAndZoningComplete && (
        <div style={{
          padding: '4px 10px',
          background: `${BT2.text.cyan}08`,
          borderLeft: `3px solid ${BT2.text.cyan}`,
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}>
          <Lock size={10} style={{ color: BT2.text.cyan }} />
          <span style={{ fontSize: 8, color: BT2.text.secondary, fontFamily: MONO }}>{statusMessage}</span>
        </div>
      )}

      {/* Bloomberg v0.34 sub-tab bar */}
      <div style={{
        display: 'flex',
        background: BT2.bg.header,
        borderBottom: `1px solid ${BT2.border.medium}`,
        flexShrink: 0,
        overflowX: 'auto',
        height: 28,
        alignItems: 'stretch',
      }}>
        {visibleTabs.map(tab => {
          const unlocked = isTabUnlocked(tab.id);
          const completed = tab.id === 'boundary_zoning' && boundaryAndZoningComplete;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => unlocked && setActiveTab(tab.id)}
              disabled={!unlocked}
              title={!unlocked ? 'Complete boundary & zoning verification to unlock' : ''}
              style={{
                fontFamily: MONO,
                fontSize: 8,
                fontWeight: isActive ? 700 : 500,
                padding: '0 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${BT2.text.cyan}` : '2px solid transparent',
                color: isActive ? BT2.text.cyan : unlocked ? BT2.text.secondary : BT2.text.muted,
                cursor: unlocked ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap' as const,
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'color 0.1s',
              }}
            >
              {!unlocked && <Lock size={9} />}
              {completed && <CheckCircle2 size={9} style={{ color: BT2.text.green }} />}
              {tab.label.toUpperCase()}
              <span style={{ fontSize: 6, color: BT2.text.muted }}>{tab.step}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: BT2.bg.terminal, padding: '12px 16px' }}>
        {renderActiveTab()}
      </div>
    </div>
  );
}
