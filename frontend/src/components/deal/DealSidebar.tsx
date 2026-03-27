import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { DealSidebarProps } from '../../types';
import { Badge } from '../shared/Badge';

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
  'post-close': '📡',
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
  'post-close': 'Post-Close Intel',
};

const PIPELINE_MODULES = [
  'map', 'overview', 'ai-agent', 'competition', 'supply', 'market', 'debt',
  'financial', 'strategy', 'due-diligence', 'team', 'documents', 'timeline',
  'notes', 'files', 'exit', 'context'
];

const ASSET_MODULES = [
  'overview', 'post-close', 'ai-agent', 'financial', 'market', 'competition', 'strategy',
  'exit', 'team', 'documents', 'timeline', 'notes', 'files', 'context'
];

const PRO_MODULES: string[] = [];
const ENTERPRISE_MODULES: string[] = [];

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  modules,
  currentModule,
  onModuleChange,
}) => {
  const isPortfolio = deal.dealCategory === 'portfolio' || (deal as any).state === 'POST_CLOSE';
  const isOwned = isPortfolio;
  const visibleModules = isPortfolio ? ASSET_MODULES : PIPELINE_MODULES;

  const isModuleEnabled = (moduleName: string) => {
    if (moduleName === 'post-close') return true;
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

  const getModuleBadge = (_moduleName: string) => {
    return null;
  };

  const isModuleUnlocked = (_moduleName: string) => {
    return true;
  };

  const handleModuleClick = (moduleName: string) => {
    const unlocked = isModuleUnlocked(moduleName);

    if (!unlocked) {
      alert('This module will be available once the analysis is complete.');
      return;
    }

    if (isModuleEnabled(moduleName)) {
      onModuleChange(moduleName);
    } else {
      alert(getModuleUpgradeMessage(moduleName) || 'Module not available');
    }
  };

  return (
    <div className="w-64 flex flex-col" style={{ background: BT.bg.panel, borderRight: `1px solid ${BT.border.subtle}`, fontFamily: BT.font.mono }}>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 style={{ fontSize: 9, fontWeight: 600, color: BT.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          {isOwned ? 'Asset Modules' : 'Deal Modules'}
        </h3>

        <div className="space-y-1">
          {visibleModules.map(moduleName => {
            const enabled = isModuleEnabled(moduleName);
            const unlocked = isModuleUnlocked(moduleName);
            const upgradeMsg = getModuleUpgradeMessage(moduleName);
            const isActive = currentModule === moduleName;
            const badge = getModuleBadge(moduleName);
            const isLocked = !enabled || !unlocked;

            return (
              <button
                key={moduleName}
                onClick={() => handleModuleClick(moduleName)}
                disabled={isLocked}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition"
                style={{
                  background: isActive ? BT.bg.active : 'transparent',
                  color: isActive ? BT.text.cyan : enabled && unlocked ? BT.text.secondary : BT.text.muted,
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: 0,
                  borderLeft: isActive ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                }}
              >
                <span className="text-xl">{moduleIcons[moduleName] || '📋'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 10 }}>{moduleLabels[moduleName] || moduleName}</span>
                    <div className="flex items-center gap-1">
                      {badge}
                      {!enabled && upgradeMsg && (
                        <span style={{ fontSize: 9, color: BT.text.cyan }}>🔒</span>
                      )}
                    </div>
                  </div>
                  {!enabled && upgradeMsg && (
                    <span style={{ fontSize: 9, color: BT.text.muted }}>{upgradeMsg}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4" style={{ borderTop: `1px solid ${BT.border.subtle}`, background: BT.bg.panelAlt }}>
        <div className="space-y-1" style={{ fontSize: 9, color: BT.text.secondary }}>
          {isOwned && (
            <div className="flex justify-between mb-2">
              <span style={{ padding: '2px 6px', borderRadius: 2, fontSize: 9, fontWeight: 700, background: `${BT.text.green}22`, color: BT.text.green, letterSpacing: 0.5 }}>
                Owned Asset
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Created:</span>
            <span style={{ fontWeight: 500 }}>
              {new Date(deal.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last Updated:</span>
            <span style={{ fontWeight: 500 }}>
              {new Date(deal.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
