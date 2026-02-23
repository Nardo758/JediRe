import React from 'react';
import { GeographicScope } from '../../types/trade-area';

interface GeographicScopeTabsProps {
  activeScope: GeographicScope;
  onChange: (scope: GeographicScope) => void;
  tradeAreaEnabled?: boolean;
  stats?: {
    trade_area?: { occupancy?: number; avg_rent?: number };
    submarket?: { occupancy?: number; avg_rent?: number };
    msa?: { occupancy?: number; avg_rent?: number };
  };
}

const scopeLabels: Record<GeographicScope, string> = {
  trade_area: 'Trade Area',
  submarket: 'Submarket',
  msa: 'MSA',
};

const scopeIcons: Record<GeographicScope, string> = {
  trade_area: '📍',
  submarket: '🏙️',
  msa: '🗺️',
};

export const GeographicScopeTabs: React.FC<GeographicScopeTabsProps> = ({
  activeScope,
  onChange,
  tradeAreaEnabled = true,
  stats,
}) => {
  const scopes: GeographicScope[] = ['trade_area', 'submarket', 'msa'];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {scopes.map((scope) => {
          const isActive = activeScope === scope;
          const isDisabled = scope === 'trade_area' && !tradeAreaEnabled;
          const scopeStats = stats?.[scope];

          return (
            <button
              key={scope}
              onClick={() => !isDisabled && onChange(scope)}
              disabled={isDisabled}
              className={`
                flex-1 px-4 py-3 font-medium transition-all
                ${isActive
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                  : isDisabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{scopeIcons[scope]}</span>
                <span>{scopeLabels[scope]}</span>
                {isDisabled && <span className="text-xs">(None)</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-3 divide-x divide-gray-200">
          {scopes.map((scope) => {
            const scopeStats = stats[scope];
            const isActive = activeScope === scope;
            const isDisabled = scope === 'trade_area' && !tradeAreaEnabled;

            if (isDisabled) {
              return (
                <div key={scope} className="p-3 bg-gray-50">
                  <div className="text-xs text-gray-400 text-center">
                    No trade area defined
                  </div>
                </div>
              );
            }

            return (
              <div
                key={scope}
                className={`p-3 ${isActive ? 'bg-blue-50' : 'bg-white'}`}
              >
                {scopeStats ? (
                  <div className="space-y-1">
                    {scopeStats.occupancy !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Occupancy:</span>
                        <span className={`font-semibold ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                          {scopeStats.occupancy.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {scopeStats.avg_rent !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Avg Rent:</span>
                        <span className={`font-semibold ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                          ${scopeStats.avg_rent.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center">
                    Loading stats...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
