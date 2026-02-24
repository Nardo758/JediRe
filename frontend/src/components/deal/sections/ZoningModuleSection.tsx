import React from 'react';
import {
  Search,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  GitCompareArrows,
  Clock,
} from 'lucide-react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { ZoningAgentChat } from '../../zoning/ZoningAgentChat';
import ZoningLookupTab from '../../zoning/tabs/ZoningLookupTab';
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

const TABS: { id: ZoningTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'lookup', label: 'Zoning Lookup', icon: <Search className="w-4 h-4" /> },
  { id: 'tracker', label: 'Entitlement Tracker', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'comparator', label: 'Zoning Comparator', icon: <GitCompareArrows className="w-4 h-4" /> },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" /> },
];

export function ZoningModuleSection({ deal, dealId: propDealId }: ZoningModuleSectionProps) {
  const resolvedDealId = propDealId || deal?.id;
  const { activeTab, setActiveTab } = useZoningModuleStore();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'lookup':
        return <ZoningLookupTab dealId={resolvedDealId} deal={deal} />;
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
        return <ZoningLookupTab dealId={resolvedDealId} deal={deal} />;
    }
  };

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="bg-white border-b border-gray-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Zoning & Entitlements Intelligence</h2>
            <p className="text-xs text-gray-500 mt-0.5">Regulatory analysis, development capacity, and entitlement tracking</p>
          </div>
        </div>

        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {renderActiveTab()}
      </div>

      <ZoningAgentChat
        activeTab={activeTab}
        dealId={resolvedDealId}
      />
    </div>
  );
}
