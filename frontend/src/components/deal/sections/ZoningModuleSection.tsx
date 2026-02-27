import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  GitCompareArrows,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import BoundaryAndZoningTab from '../../zoning/tabs/BoundaryAndZoningTab';
import DevelopmentCapacityTab from '../../zoning/tabs/DevelopmentCapacityTab';
import RegulatoryRiskTab from '../../zoning/tabs/RegulatoryRiskTab';
import ZoningComparatorTab from '../../zoning/tabs/ZoningComparatorTab';
import TimeToShovelTab from '../../zoning/tabs/TimeToShovelTab';
import HighestBestUseTab from '../../zoning/tabs/HighestBestUseTab';
import type { ZoningTabId } from '../../../types/zoning.types';

interface ZoningModuleSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

const TABS: { id: ZoningTabId; label: string; icon: React.ReactNode; step: number }[] = [
  { id: 'boundary_zoning', label: 'Boundary & Zoning', icon: <MapPin className="w-4 h-4" />, step: 1 },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" />, step: 2 },
  { id: 'hbu', label: 'Highest & Best Use', icon: <TrendingUp className="w-4 h-4" />, step: 3 },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" />, step: 4 },
  { id: 'comparator', label: 'Zoning Comparator', icon: <GitCompareArrows className="w-4 h-4" />, step: 5 },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" />, step: 6 },
];

export function ZoningModuleSection({ deal, dealId: propDealId, onUpdate }: ZoningModuleSectionProps) {
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
      case 'comparator':
        return <ZoningComparatorTab dealId={resolvedDealId} deal={deal} />;
      case 'timeline':
        return <TimeToShovelTab dealId={resolvedDealId} deal={deal} />;
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
        <div className="text-sm text-gray-500">Loading zoning analysis...</div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full -m-6 -mr-10">
      <div className="bg-white border-b border-gray-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Property & Zoning Intelligence</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Boundary, zoning verification, development capacity & entitlement timeline
              {deal?.strategy && <><span className="ml-2 text-gray-400">•</span> <span className="ml-2 text-blue-600 font-medium">{deal.strategy} Strategy</span></>}
            </p>
          </div>

          {/* Refresh button */}
          {!boundaryAndZoningComplete && (
            <button
              onClick={() => checkCompletionStatus()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh tab status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Status Banner */}
        {statusMessage && !boundaryAndZoningComplete && (
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center gap-2">
            <Lock className="w-3 h-3" />
            {statusMessage}
          </div>
        )}

        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(tab => {
            const unlocked = isTabUnlocked(tab.id);
            const completed =
              tab.id === 'boundary_zoning' && boundaryAndZoningComplete;

            return (
              <button
                key={tab.id}
                onClick={() => unlocked && setActiveTab(tab.id)}
                disabled={!unlocked}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : unlocked
                    ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    : 'border-transparent text-gray-300 cursor-not-allowed'
                }`}
                title={!unlocked ? 'Complete boundary & zoning verification to unlock' : ''}
              >
                {!unlocked && <Lock className="w-3 h-3" />}
                {completed && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                {!completed && unlocked && tab.icon}
                <span>{tab.label}</span>
                <span className="ml-1 text-[10px] text-gray-400">{tab.step}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 pr-10 pb-6">
        {renderActiveTab()}
      </div>
    </div>
  );
}
