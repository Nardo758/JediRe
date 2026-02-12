import React from 'react';
import { DealSidebarProps } from '../../types';

const moduleIcons = {
  map: '🗺️',
  overview: '📊',
  marketCompetition: '🏆',
  supplyTracking: '📦',
  debtMarket: '💳',
  aiAgent: '🤖',
  financial: '💰',
  strategy: '🎯',
  dueDiligence: '✅',
  properties: '🏢',
  market: '📈',
  documents: '📄',
  team: '👥',
  contextTracker: '🧭',
  notes: '💬'
};

const moduleLabels = {
  map: 'Map View',
  overview: 'Overview',
  marketCompetition: 'Market Competition',
  supplyTracking: 'Supply Tracking',
  debtMarket: 'Debt Market',
  aiAgent: 'AI Agent (Opus)',
  financial: 'Financial Analysis',
  strategy: 'Strategy & Arbitrage',
  dueDiligence: 'Due Diligence',
  properties: 'Properties',
  market: 'Market Analysis',
  documents: 'Documents',
  team: 'Team & Comms',
  contextTracker: 'Context Tracker',
  notes: 'Notes & Comments'
};

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  modules,
  currentModule,
  onModuleChange
}) => {
  const isModuleEnabled = (moduleName: string) => {
    const module = modules.find(m => m.moduleName === moduleName || m.module_name === moduleName);
    return module?.isEnabled || module?.is_enabled || false;
  };

  const getModuleUpgradeMessage = (moduleName: string) => {
    if (deal.tier === 'basic') {
      if (['marketCompetition', 'supplyTracking', 'debtMarket', 'aiAgent', 'financial', 'strategy', 'market'].includes(moduleName)) {
        return 'Upgrade to Pro';
      }
      if (['team'].includes(moduleName)) {
        return 'Upgrade to Enterprise';
      }
    }
    if (deal.tier === 'pro') {
      if (['team'].includes(moduleName)) {
        return 'Upgrade to Enterprise';
      }
    }
    return null;
  };

  const handleModuleClick = (moduleName: string) => {
    if (isModuleEnabled(moduleName)) {
      onModuleChange(moduleName);
    } else {
      // Show upgrade prompt
      alert(getModuleUpgradeMessage(moduleName) || 'Module not available');
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Deal Modules */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Deal Modules
        </h3>
        
        <div className="space-y-1">
          {Object.keys(moduleIcons).map(moduleName => {
            const enabled = isModuleEnabled(moduleName);
            const upgradeMsg = getModuleUpgradeMessage(moduleName);
            const isActive = currentModule === moduleName;

            return (
              <button
                key={moduleName}
                onClick={() => handleModuleClick(moduleName)}
                disabled={!enabled}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : enabled
                      ? 'text-gray-700 hover:bg-gray-50'
                      : 'text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <span className="text-xl">{moduleIcons[moduleName as keyof typeof moduleIcons]}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{moduleLabels[moduleName as keyof typeof moduleLabels]}</span>
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

      {/* Deal Info Footer */}
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
