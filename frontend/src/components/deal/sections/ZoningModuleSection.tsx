import React, { useState, useEffect, useMemo } from 'react';
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
import { BT as BT2, BtTabWrapper, PanelHeader, SubTabBar } from '../bloomberg-ui';
import { useDealType } from '../../../stores/dealStore';
import { getZoningDepth } from '../../../shared/config/deal-type-visibility';

interface ZoningModuleSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

const SIMPLIFIED_TABS: ZoningTabId[] = ['boundary_zoning', 'risk', 'entitlements'];
const FULL_TABS: ZoningTabId[] = ['boundary_zoning', 'capacity', 'hbu', 'risk', 'timeline', 'entitlements'];

const ALL_TABS: { id: ZoningTabId; label: string; icon: React.ReactNode; step: number }[] = [
  { id: 'boundary_zoning', label: 'Boundary & Zoning', icon: <MapPin className="w-4 h-4" />, step: 1 },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" />, step: 2 },
  { id: 'hbu', label: 'Highest & Best Use', icon: <TrendingUp className="w-4 h-4" />, step: 3 },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" />, step: 4 },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" />, step: 5 },
  { id: 'entitlements', label: 'Entitlements', icon: <CheckCircle2 className="w-4 h-4" />, step: 6 },
];

export function ZoningModuleSection({ deal, dealId: propDealId, onUpdate }: ZoningModuleSectionProps) {
  const dealType = useDealType();
  const zoningDepth = useMemo(() => {
    const explicitType = deal?.projectType || deal?.project_type || deal?.identity?.mode;
    if (!explicitType) return 'full';
    return getZoningDepth(dealType);
  }, [dealType, deal]);

  const visibleTabs = useMemo(() => {
    const tabIds = zoningDepth === 'simplified' ? SIMPLIFIED_TABS : FULL_TABS;
    return ALL_TABS.filter(tab => tabIds.includes(tab.id));
  }, [zoningDepth]);

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

  const isTabUnlocked = (_tabId: ZoningTabId): boolean => {
    return true;
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
      <PanelHeader
        title="PROPERTY & ZONING"
        subtitle="M02 · ENTITLEMENT ENGINE"
        borderColor={BT2.text.amber}
        metrics={deal?.strategy ? [{ l: deal.strategy, c: BT2.text.amber }] : undefined}
        right={!boundaryAndZoningComplete ? (
          <button
            onClick={() => checkCompletionStatus()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: MONO, fontSize: 9, color: BT2.text.secondary,
              background: 'transparent', border: `1px solid ${BT2.border.subtle}`,
              padding: '2px 8px', cursor: 'pointer',
            }}
          >
            <RefreshCw size={10} />
            REFRESH
          </button>
        ) : undefined}
      />

      {/* Status Banner */}
      {statusMessage && !boundaryAndZoningComplete && (
        <div style={{
          padding: '4px 10px',
          background: `${BT2.text.amber}08`,
          borderLeft: `3px solid ${BT2.text.amber}`,
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}>
          <Lock size={10} style={{ color: BT2.text.amber }} />
          <span style={{ fontSize: 9, color: BT2.text.secondary, fontFamily: MONO }}>{statusMessage}</span>
        </div>
      )}

      <SubTabBar
        tabs={visibleTabs.map(t =>
          (t.id === 'boundary_zoning' && boundaryAndZoningComplete ? '✓ ' : '') +
          t.label.toUpperCase()
        )}
        active={visibleTabs.findIndex(t => t.id === activeTab)}
        setActive={(i) => setActiveTab(visibleTabs[i].id)}
        color={BT2.text.amber}
      />

      <BtTabWrapper>
        {renderActiveTab()}
      </BtTabWrapper>
    </div>
  );
}
