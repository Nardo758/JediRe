import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  GitCompareArrows,
  Clock,
  Lock,
} from 'lucide-react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { ZoningAgentChat } from '../../zoning/ZoningAgentChat';
import { apiClient } from '../../../services/api.client';
import BoundaryTab from '../../zoning/tabs/BoundaryTab';
import ZoningConfirmTab from '../../zoning/tabs/ZoningConfirmTab';
import EntitlementTrackerTab from '../../zoning/tabs/EntitlementTrackerTab';
import DevelopmentCapacityTab from '../../zoning/tabs/DevelopmentCapacityTab';
import RegulatoryRiskTab from '../../zoning/tabs/RegulatoryRiskTab';
import ZoningComparatorTab from '../../zoning/tabs/ZoningComparatorTab';
import TimeToShovelTab from '../../zoning/tabs/TimeToShovelTab';
import type { ZoningTabId } from '../../../types/zoning.types';

interface ZoningModuleSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

type ExtendedTabId = 'boundary' | 'confirm' | ZoningTabId;

const TABS: { id: ExtendedTabId; label: string; icon: React.ReactNode; step: number }[] = [
  { id: 'boundary', label: 'Property Boundary', icon: <MapPin className="w-4 h-4" />, step: 1 },
  { id: 'confirm', label: 'Confirm Zoning', icon: <CheckCircle2 className="w-4 h-4" />, step: 2 },
  { id: 'tracker', label: 'Entitlement Tracker', icon: <ClipboardList className="w-4 h-4" />, step: 3 },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" />, step: 4 },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" />, step: 5 },
  { id: 'comparator', label: 'Zoning Comparator', icon: <GitCompareArrows className="w-4 h-4" />, step: 6 },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" />, step: 7 },
];

export function ZoningModuleSection({ deal, dealId: propDealId, onUpdate }: ZoningModuleSectionProps) {
  const resolvedDealId = propDealId || deal?.id;
  const [activeTab, setActiveTab] = useState<ExtendedTabId>('boundary');
  const [boundaryComplete, setBoundaryComplete] = useState(false);
  const [zoningConfirmed, setZoningConfirmed] = useState(false);
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
      // Check if boundary exists
      console.log('[ZoningModule] Fetching boundary for deal:', resolvedDealId);
      const boundaryRes = await apiClient.get(`/deals/${resolvedDealId}/boundary`);
      const hasBoundary = !!boundaryRes.data?.id;
      console.log('[ZoningModule] Boundary check:', { 
        hasBoundary, 
        boundaryId: boundaryRes.data?.id,
        dealId: boundaryRes.data?.deal_id,
        fullResponse: boundaryRes.data 
      });
      setBoundaryComplete(hasBoundary);

      // Check if zoning confirmed
      let isConfirmed = false;
      try {
        const zoningRes = await apiClient.get(`/deals/${resolvedDealId}/zoning-confirmation`);
        isConfirmed = !!zoningRes.data?.confirmed_at;
        console.log('[ZoningModule] Zoning confirmation check:', { isConfirmed, zoningData: zoningRes.data });
      } catch (err) {
        console.log('[ZoningModule] No zoning confirmation found (expected for new deals)');
      }

      // If boundary already exists, treat zoning as confirmed so all tabs are accessible
      // The confirm step is for new deals; existing deals with boundaries should have full access
      if (!isConfirmed && hasBoundary) {
        console.log('[ZoningModule] Boundary exists, unlocking all tabs');
        isConfirmed = true;
      }

      setZoningConfirmed(isConfirmed);
      console.log('[ZoningModule] Final state:', { boundaryComplete: hasBoundary, zoningConfirmed: isConfirmed });

      // Set initial tab based on completion
      if (isConfirmed) {
        setActiveTab('boundary');
      } else {
        setActiveTab('boundary');
      }
    } catch (error: any) {
      console.error('[ZoningModule] Error checking completion status:', {
        error,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
        dealId: resolvedDealId
      });
      
      // If boundary API returns 404, it means no boundary exists yet
      if (error?.response?.status === 404) {
        console.log('[ZoningModule] No boundary found (404), starting at Step 1');
        setStatusMessage('Draw property boundary to unlock zoning analysis');
        setBoundaryComplete(false);
        setZoningConfirmed(false);
      } else {
        // Other errors (401, 500, network, etc.)
        console.error('[ZoningModule] Unexpected error:', error?.response?.status || 'network error');
        setStatusMessage(`Error loading boundary data: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
        setBoundaryComplete(false);
        setZoningConfirmed(false);
      }
      setActiveTab('boundary');
    } finally {
      setLoading(false);
    }
  };

  const handleBoundaryComplete = () => {
    setBoundaryComplete(true);
    setStatusMessage('Boundary complete! Confirm zoning to unlock analysis');
    setActiveTab('confirm');
    if (onUpdate) onUpdate();
  };

  const handleZoningConfirm = () => {
    setZoningConfirmed(true);
    setStatusMessage(null);
    setActiveTab('tracker');
    if (onUpdate) onUpdate();
  };

  const isTabUnlocked = (tabId: ExtendedTabId): boolean => {
    if (tabId === 'boundary') return true;
    if (tabId === 'confirm') return boundaryComplete;
    // All other tabs require zoning confirmation
    return zoningConfirmed;
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'boundary':
        return <BoundaryTab dealId={resolvedDealId} deal={deal} onComplete={handleBoundaryComplete} />;
      case 'confirm':
        return <ZoningConfirmTab dealId={resolvedDealId} deal={deal} onConfirm={handleZoningConfirm} />;
      case 'tracker':
        return <EntitlementTrackerTab dealId={resolvedDealId} deal={deal} />;
      case 'capacity':
        return <DevelopmentCapacityTab dealId={resolvedDealId} deal={deal} />;
      case 'risk':
        return <RegulatoryRiskTab dealId={resolvedDealId} deal={deal} />;
      case 'comparator':
        return <ZoningComparatorTab dealId={resolvedDealId} deal={deal} />;
      case 'timeline':
        return <TimeToShovelTab dealId={resolvedDealId} deal={deal} />;
      default:
        return <BoundaryTab dealId={resolvedDealId} deal={deal} onComplete={handleBoundaryComplete} />;
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
    <div className="relative flex flex-col h-full -m-6">
      <div className="bg-white border-b border-gray-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Property & Zoning Intelligence</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Boundary, development capacity, and entitlement tracking
              {deal?.strategy && <><span className="ml-2 text-gray-400">•</span> <span className="ml-2 text-blue-600 font-medium">{deal.strategy} Strategy</span></>}
            </p>
          </div>
        </div>

        {/* Status Banner */}
        {statusMessage && !zoningConfirmed && (
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center gap-2">
            <Lock className="w-3 h-3" />
            {statusMessage}
          </div>
        )}

        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(tab => {
            const unlocked = isTabUnlocked(tab.id);
            const completed = 
              (tab.id === 'boundary' && boundaryComplete) || 
              (tab.id === 'confirm' && zoningConfirmed);

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
                title={!unlocked ? 'Complete previous steps to unlock' : ''}
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

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 pb-16">
        {renderActiveTab()}
      </div>

      <ZoningAgentChat
        activeTab={activeTab as any}
        dealId={resolvedDealId}
      />
    </div>
  );
}
