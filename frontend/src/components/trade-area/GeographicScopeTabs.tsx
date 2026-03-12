import React from 'react';
import { Pencil } from 'lucide-react';
import { GeographicScope } from '../../types/trade-area';

interface GeographicScopeTabsProps {
  activeScope: GeographicScope;
  onChange: (scope: GeographicScope) => void;
  tradeAreaEnabled?: boolean;
  onDefineTradeArea?: () => void;
  stats?: {
    trade_area?: { occupancy?: number; avg_rent?: number };
    submarket?: { occupancy?: number; avg_rent?: number };
    msa?: { occupancy?: number; avg_rent?: number };
  };
  compact?: boolean;
}

const scopeLabels: Record<GeographicScope, string> = {
  trade_area: 'Trade Area',
  submarket: 'Submarket',
  msa: 'MSA',
};

const scopeIcons: Record<GeographicScope, string> = {
  trade_area: '\uD83D\uDCCD',
  submarket: '\uD83C\uDFD9\uFE0F',
  msa: '\uD83D\uDDFA\uFE0F',
};

export const GeographicScopeTabs: React.FC<GeographicScopeTabsProps> = ({
  activeScope,
  onChange,
  tradeAreaEnabled = true,
  onDefineTradeArea,
  stats,
  compact = false,
}) => {
  const scopes: GeographicScope[] = ['trade_area', 'submarket', 'msa'];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {scopes.map((scope) => {
          const isActive = activeScope === scope;
          const isDisabled = scope === 'trade_area' && !tradeAreaEnabled;
          const scopeStats = stats?.[scope];

          if (isDisabled) {
            return (
              <button
                key={scope}
                onClick={() => onDefineTradeArea?.()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <span className="text-sm">{scopeIcons[scope]}</span>
                <span>+ Define</span>
              </button>
            );
          }

          const hasStats = scopeStats && (scopeStats.occupancy !== undefined || scopeStats.avg_rent !== undefined);
          const tooltipParts: string[] = [];
          if (scopeStats?.occupancy !== undefined) tooltipParts.push(`Occupancy: ${scopeStats.occupancy.toFixed(1)}%`);
          if (scopeStats?.avg_rent !== undefined) tooltipParts.push(`Avg Rent: $${scopeStats.avg_rent.toLocaleString()}`);

          return (
            <div key={scope} className="flex items-center">
              <button
                onClick={() => onChange(scope)}
                title={hasStats ? tooltipParts.join('  |  ') : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent'
                } ${scope === 'trade_area' && onDefineTradeArea ? 'rounded-r-none border-r-0' : ''}`}
              >
                <span className="text-sm">{scopeIcons[scope]}</span>
                <span>{scopeLabels[scope]}</span>
                {hasStats && (
                  <span className={`text-xs font-normal ml-0.5 ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                    {scopeStats.occupancy !== undefined && `${scopeStats.occupancy.toFixed(1)}%`}
                    {scopeStats.occupancy !== undefined && scopeStats.avg_rent !== undefined && ' \u00B7 '}
                    {scopeStats.avg_rent !== undefined && `$${scopeStats.avg_rent.toLocaleString()}`}
                  </span>
                )}
              </button>
              {scope === 'trade_area' && onDefineTradeArea && (
                <button
                  onClick={() => onDefineTradeArea()}
                  title="Edit trade area boundary"
                  className={`flex items-center px-1.5 py-1.5 text-[13px] font-medium rounded-lg rounded-l-none transition-colors border ${
                    isActive
                      ? 'bg-blue-50 text-blue-500 border-blue-200 hover:bg-blue-100'
                      : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex border-b border-gray-200">
        {scopes.map((scope) => {
          const isActive = activeScope === scope;
          const isDisabled = scope === 'trade_area' && !tradeAreaEnabled;

          return (
            <button
              key={scope}
              onClick={() => {
                if (isDisabled && onDefineTradeArea) {
                  onDefineTradeArea();
                } else if (!isDisabled) {
                  onChange(scope);
                }
              }}
              className={`
                flex-1 px-4 py-3 font-medium transition-all
                ${isActive
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                  : isDisabled
                  ? onDefineTradeArea
                    ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 cursor-pointer border-b-2 border-transparent'
                    : 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{scopeIcons[scope]}</span>
                <span>{scopeLabels[scope]}</span>
                {isDisabled && (
                  onDefineTradeArea
                    ? <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">+ Define</span>
                    : <span className="text-xs">(None)</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

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
                {scopeStats && (scopeStats.occupancy !== undefined || scopeStats.avg_rent !== undefined) ? (
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
                    No stats available
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
