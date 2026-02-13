import React from 'react';
import { DealSidebarProps } from '../../types';

const moduleIcons: Record<string, string> = {
  map: '🗺️',
  overview: '📊',
  competition: '🏆',
  supply: '📦',
  market: '📈',
  debt: '💳',
  financial: '💰',
  strategy: '🎯',
  'due-diligence': '✅',
  'ai-agent': '🤖',
  team: '👥',
  documents: '📄',
  timeline: '📅',
  notes: '💬',
  files: '📁',
  exit: '🚪',
  context: '🧭',
};

const moduleLabels: Record<string, string> = {
  map: 'Map View',
  overview: 'Overview',
  competition: 'Competition',
  supply: 'Supply',
  market: 'Market',
  debt: 'Debt',
  financial: 'Financial',
  strategy: 'Strategy',
  'due-diligence': 'Due Diligence',
  'ai-agent': 'AI Agent',
  team: 'Team',
  documents: 'Documents',
  timeline: 'Timeline',
  notes: 'Notes',
  files: 'Files',
  exit: 'Exit Analysis',
  context: 'Context',
};

const PIPELINE_MODULES = [
  'map', 'overview', 'ai-agent', 'competition', 'supply', 'market', 'debt',
  'financial', 'strategy', 'due-diligence', 'team', 'documents', 'timeline',
  'notes', 'files', 'exit', 'context'
];

const ASSET_MODULES = [
  'overview', 'ai-agent', 'financial', 'market', 'competition', 'strategy',
  'exit', 'team', 'documents', 'timeline', 'notes', 'files', 'context'
];

const PRO_MODULES = ['competition', 'supply', 'debt', 'ai-agent', 'financial', 'strategy', 'market'];
const ENTERPRISE_MODULES = ['team'];

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  modules,
  currentModule,
  onModuleChange
}) => {
  const isPortfolio = deal.dealCategory === 'portfolio' || (deal as any).state === 'POST_CLOSE';
  const isOwned = isPortfolio;
  const visibleModules = isPortfolio ? ASSET_MODULES : PIPELINE_MODULES;

  const isModuleEnabled = (moduleName: string) => {
    const module = modules.find(m =>
      m.moduleName === moduleName ||
      m.module_name === moduleName
    );
    return module?.isEnabled || module?.is_enabled || false;
  };

  const getModuleUpgradeMessage = (moduleName: string) => {
    if (deal.tier === 'basic') {
      if (PRO_MODULES.includes(moduleName)) return 'Upgrade to Pro';
      if (ENTERPRISE_MODULES.includes(moduleName)) return 'Upgrade to Enterprise';
    }
    if (deal.tier === 'pro') {
      if (ENTERPRISE_MODULES.includes(moduleName)) return 'Upgrade to Enterprise';
    }
    return null;
  };

  const handleModuleClick = (moduleName: string) => {
    if (isModuleEnabled(moduleName)) {
      onModuleChange(moduleName);
    } else {
      alert(getModuleUpgradeMessage(moduleName) || 'Module not available');
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {isOwned ? 'Asset Modules' : 'Deal Modules'}
        </h3>
        
        <div className="space-y-1">
          {visibleModules.map(moduleName => {
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
                <span className="text-xl">{moduleIcons[moduleName] || '📋'}</span>
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
          {isOwned && (
            <div className="flex justify-between mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Owned Asset
              </span>
            </div>
          )}
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
