import React from 'react';
import {
  Search,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  GitCompareArrows,
  Clock,
} from 'lucide-react';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import { ZoningAgentChat } from '../components/zoning/ZoningAgentChat';
import MapPlaceholder from '../components/zoning/MapPlaceholder';
import ZoningLookupTab from '../components/zoning/tabs/ZoningLookupTab';
import EntitlementTrackerTab from '../components/zoning/tabs/EntitlementTrackerTab';
import DevelopmentCapacityTab from '../components/zoning/tabs/DevelopmentCapacityTab';
import RegulatoryRiskTab from '../components/zoning/tabs/RegulatoryRiskTab';
import ZoningComparatorTab from '../components/zoning/tabs/ZoningComparatorTab';
import TimeToShovelTab from '../components/zoning/tabs/TimeToShovelTab';
import type { ZoningTabId } from '../types/zoning.types';

const TABS: { id: ZoningTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'lookup', label: 'Zoning Lookup', icon: <Search className="w-4 h-4" /> },
  { id: 'tracker', label: 'Entitlement Tracker', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'capacity', label: 'Dev Capacity', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'risk', label: 'Regulatory Risk', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'comparator', label: 'Zoning Comparator', icon: <GitCompareArrows className="w-4 h-4" /> },
  { id: 'timeline', label: 'Time-to-Shovel', icon: <Clock className="w-4 h-4" /> },
];

export const ZoningEntitlementsPage: React.FC = () => {
  const { activeTab, setActiveTab } = useZoningModuleStore();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'lookup':
        return <ZoningLookupTab />;
      case 'tracker':
        return <EntitlementTrackerTab />;
      case 'capacity':
        return <DevelopmentCapacityTab />;
      case 'risk':
        return <RegulatoryRiskTab />;
      case 'comparator':
        return <ZoningComparatorTab />;
      case 'timeline':
        return <TimeToShovelTab />;
      default:
        return <ZoningLookupTab />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zoning & Entitlements Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">Regulatory analysis, development capacity, and entitlement tracking</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-200 -mb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-2/5 overflow-y-auto border-r border-gray-200 bg-white">
          <div className="p-6">
            {renderActiveTab()}
          </div>
        </div>

        <div className="w-3/5 overflow-hidden">
          <MapPlaceholder />
        </div>
      </div>

      <ZoningAgentChat
        activeTab={activeTab}
      />
    </div>
  );
};
