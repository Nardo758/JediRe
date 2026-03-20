import React, { useState } from 'react';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import type { ScenarioType } from '@/types/design/scenarios.types';
import { SCENARIO_COLORS } from '@/types/design/scenarios.types';

const TABS: { key: ScenarioType; label: string }[] = [
  { key: 'by-right', label: 'By-Right' },
  { key: 'variance', label: 'Variance' },
  { key: 'rezone', label: 'Rezone' },
  { key: 'custom', label: 'Custom' },
];

export const ScenarioSelectorPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const scenarios = useDesign3DStore((s) => s.scenarios);
  const activeScenarioId = useDesign3DStore((s) => s.activeScenarioId);
  const showOverlay = useDesign3DStore((s) => s.showScenarioOverlay);
  const setActiveScenario = useDesign3DStore((s) => s.setActiveScenario);
  const toggleOverlay = useDesign3DStore((s) => s.toggleScenarioOverlay);

  const [selectedTab, setSelectedTab] = useState<ScenarioType>('by-right');

  React.useEffect(() => {
    const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
    if (activeScenario) {
      setSelectedTab(activeScenario.type);
    }
  }, [activeScenarioId, scenarios]);

  if (scenarios.length === 0) return null;

  const filteredScenarios = scenarios.filter((s) => s.type === selectedTab);

  const riskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[level] || 'bg-gray-100 text-gray-700'}`}>
        {level}
      </span>
    );
  };

  return (
    <div className="absolute bottom-16 left-4 z-10 max-w-md">
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white text-sm font-medium flex items-center gap-2"
          >
            <span>{isCollapsed ? '▶' : '▼'}</span>
            Scenarios
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={() => setCompareMode(!compareMode)}
                className="rounded"
              />
              Compare
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={toggleOverlay}
                className="rounded"
              />
              Show
            </label>
          </div>
        </div>

        {!isCollapsed && (
          <>
            <div className="flex border-b border-gray-700">
              {TABS.map((tab) => {
                const count = scenarios.filter((s) => s.type === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedTab(tab.key)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                      selectedTab === tab.key
                        ? 'text-white border-b-2'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                    style={
                      selectedTab === tab.key
                        ? { borderColor: SCENARIO_COLORS[tab.key] }
                        : undefined
                    }
                  >
                    {tab.label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredScenarios.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-500 text-xs">
                  No {selectedTab} scenarios available
                </div>
              ) : (
                filteredScenarios.map((scenario) => {
                  const isActive = scenario.id === activeScenarioId;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => setActiveScenario(isActive ? null : scenario.id)}
                      className={`w-full px-3 py-2 text-left border-b border-gray-700 last:border-0 transition-colors ${
                        isActive ? 'bg-gray-700' : 'hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: SCENARIO_COLORS[scenario.type] }}
                          />
                          <span className="text-white text-sm font-medium">{scenario.name}</span>
                        </div>
                        {riskBadge(scenario.riskLevel)}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mt-1">
                        <div>
                          <div className="text-gray-500">Units</div>
                          <div className="text-white">{scenario.maxUnits}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Stories</div>
                          <div className="text-white">{scenario.maxStories}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">FAR</div>
                          <div className="text-white">{scenario.far.toFixed(1)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Timeline</div>
                          <div className="text-white">{scenario.timelineMonths}mo</div>
                        </div>
                      </div>
                      {scenario.bindingConstraint && (
                        <div className="text-xs text-gray-500 mt-1">
                          Binding: {scenario.bindingConstraint}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScenarioSelectorPanel;
