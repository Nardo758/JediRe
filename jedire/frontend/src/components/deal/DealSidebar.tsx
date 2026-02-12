import React from 'react';
import { DealSidebarProps } from '../../types';

const moduleIcons: Record<string, string> = {
  map: '🗺️',
  overview: '📊',
  properties: '🏢',
  financial: '💰',
  strategy: '🎯',
  'due-diligence': '✅',
  market: '📈',
  documents: '📄',
  team: '👥',
  context: '🧭',
  notes: '💬',
  pipeline: '📉',
};

const moduleLabels: Record<string, string> = {
  map: 'Map View',
  overview: 'Overview',
  properties: 'Properties',
  financial: 'Financial Analysis',
  strategy: 'Strategy & Arbitrage',
  'due-diligence': 'Due Diligence',
  market: 'Market Analysis',
  documents: 'Documents',
  team: 'Team & Comms',
  context: 'Context Tracker',
  notes: 'Notes & Comments',
  pipeline: 'Pipeline',
};

const moduleOrder = [
  'map',
  'overview',
  'properties',
  'financial',
  'strategy',
  'due-diligence',
  'market',
  'documents',
  'team',
  'context',
  'notes',
  'pipeline',
];

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  modules,
  currentModule,
  onModuleChange
}) => {
  const isModuleEnabled = (moduleName: string) => {
    const module = modules.find(m => m.moduleName === moduleName || m.module_name === moduleName);
    if (module) return module?.isEnabled || module?.is_enabled || false;
    return true;
  };

  const getModuleUpgradeMessage = (moduleName: string) => {
    if (deal.tier === 'basic') {
      if (['strategy', 'market', 'financial'].includes(moduleName)) {
        return 'Upgrade to Pro';
      }
      if (['pipeline', 'team'].includes(moduleName)) {
        return 'Upgrade to Enterprise';
      }
    }
    if (deal.tier === 'pro') {
      if (['pipeline', 'team'].includes(moduleName)) {
        return 'Upgrade to Enterprise';
      }
    }
    return null;
  };

  const handleModuleClick = (moduleName: string) => {
    onModuleChange(moduleName);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Deal Modules
        </h3>
        
        <div className="space-y-1">
          {moduleOrder.map(moduleName => {
            const enabled = isModuleEnabled(moduleName);
            const upgradeMsg = getModuleUpgradeMessage(moduleName);
            const isActive = currentModule === moduleName;

            return (
              <button
                key={moduleName}
                onClick={() => handleModuleClick(moduleName)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : enabled
                      ? 'text-gray-700 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-xl">{moduleIcons[moduleName] || '📦'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{moduleLabels[moduleName] || moduleName}</span>
                    {!enabled && upgradeMsg && (
                      <span className="text-xs text-blue-600">🔒</span>
                    )}
                  </div>
                  {!enabled && upgradeMsg && (
                    <span className="text-xs text-gray-500">{upgradeMsg}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Created:</span>
            <span className="font-medium">
              {new Date(deal.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last Updated:</span>
            <span className="font-medium">
              {new Date(deal.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
