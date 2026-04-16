import React from 'react';
import { GeographicScope } from '../../types/trade-area';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const AMBER       = '#F5A623';
const AMBER_DIM   = '#C48A1F';
const TEXT_DIM    = '#A0AABA';
const TEXT_SEC    = '#BCC5D0';
const TEXT_ACTIVE = '#F5A623';
const BORDER      = '#1E2538';
const BG_HOVER    = 'rgba(245,166,35,0.06)';

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
  trade_area: 'TRADE AREA',
  submarket:  'SUBMARKET',
  msa:        'MSA',
};

const scopeIcons: Record<GeographicScope, string> = {
  trade_area: '\uD83D\uDCCD',
  submarket: '\uD83C\uDFD9\uFE0F',
  msa: '\uD83D\uDDFA\uFE0F',
};

function fmtStats(s?: { occupancy?: number; avg_rent?: number }): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.occupancy !== undefined) parts.push(`${s.occupancy.toFixed(1)}%`);
  if (s.avg_rent  !== undefined) parts.push(`$${s.avg_rent.toLocaleString()}`);
  return parts.length ? parts.join('  ·  ') : null;
}

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
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100%',
        borderLeft: `1px solid ${BORDER}`,
      }}>
        {/* Define trade area — shown when trade_area not enabled */}
        {!tradeAreaEnabled && (
          <button
            onClick={() => onDefineTradeArea?.()}
            title="Define a trade area boundary for this deal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 10px',
              background: 'none',
              border: 'none',
              borderRight: `1px solid ${BORDER}`,
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: '0.08em',
              color: AMBER_DIM,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = AMBER; (e.currentTarget as HTMLElement).style.background = BG_HOVER; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = AMBER_DIM; (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <span style={{ fontSize: 9, opacity: 0.7 }}>+</span>
            <span>TRADE AREA</span>
          </button>
        )}

        {/* Scope selector items */}
        {scopes.filter(s => s !== 'trade_area' || tradeAreaEnabled).map((scope, idx, arr) => {
          const isActive   = activeScope === scope;
          const statLine   = fmtStats(stats?.[scope]);
          const isLast     = idx === arr.length - 1;

          return (
            <button
              key={scope}
              onClick={() => onChange(scope)}
              title={statLine ?? undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                background: isActive ? 'rgba(245,166,35,0.07)' : 'none',
                border: 'none',
                borderRight: isLast ? 'none' : `1px solid ${BORDER}`,
                borderBottom: isActive ? `2px solid ${AMBER}` : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: MONO,
                whiteSpace: 'nowrap',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = BG_HOVER; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {/* Scope label */}
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: isActive ? TEXT_ACTIVE : TEXT_SEC,
              }}>
                {scopeLabels[scope]}
              </span>

              {/* Stat line */}
              {statLine && (
                <span style={{
                  fontSize: 9,
                  letterSpacing: '0.04em',
                  color: isActive ? '#C8922A' : TEXT_DIM,
                  fontWeight: 400,
                }}>
                  {statLine}
                </span>
              )}
            </button>
          );
        })}

        {/* Edit trade area — shown alongside tabs when trade_area is enabled */}
        {tradeAreaEnabled && onDefineTradeArea && (
          <button
            onClick={() => onDefineTradeArea()}
            title="Edit trade area boundary"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              background: 'none',
              border: 'none',
              borderLeft: `1px solid ${BORDER}`,
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              color: TEXT_DIM,
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = AMBER; (e.currentTarget as HTMLElement).style.background = BG_HOVER; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT_DIM; (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            EDIT
          </button>
        )}
      </div>
    );
  }

  /* ── Full (non-compact) mode — unchanged ── */
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex border-b border-gray-200">
        {scopes.map((scope) => {
          const isActive   = activeScope === scope;
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
            const isActive   = activeScope === scope;
            const isDisabled = scope === 'trade_area' && !tradeAreaEnabled;

            if (isDisabled) {
              return (
                <div key={scope} className="p-3 bg-gray-50">
                  <div className="text-xs text-gray-400 text-center">No trade area defined</div>
                </div>
              );
            }

            return (
              <div key={scope} className={`p-3 ${isActive ? 'bg-blue-50' : 'bg-white'}`}>
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
                  <div className="text-xs text-gray-400 text-center">No stats available</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
