import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import { T } from '../../styles/terminal-tokens';

interface Strategy {
  id: string;
  name: string;
  type: 'preset' | 'custom';
  description?: string;
  last_match_count?: number;
}

interface StrategyResult {
  geography_name: string;
  score: number;
}

interface RunningStrategy {
  id: string;
  loading: boolean;
  results?: StrategyResult[];
  matchCount?: number;
  error?: string;
}

interface CommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [runningStrategies, setRunningStrategies] = useState<Record<string, RunningStrategy>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadStrategies();
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    onClose();
  // Task #425: useEffect intentionally omits `onClose` — the omitted value(s)
  // are either (a) stable references from context/store hooks whose identity
  // is guaranteed by the producer, (b) values captured at first-fire on
  // purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const loadStrategies = async () => {
    setStrategiesLoading(true);
    try {
      const response = await api.get('/strategies');
      setStrategies(response.data.data || []);
    } catch (error) {
      console.error('Failed to load strategies:', error);
    } finally {
      setStrategiesLoading(false);
    }
  };

  const runStrategy = async (strategyId: string) => {
    setRunningStrategies(prev => ({
      ...prev,
      [strategyId]: { id: strategyId, loading: true }
    }));

    try {
      const response = await api.post(`/strategies/${strategyId}/run`);
      const data = response.data.data;

      const topResults = (data.results || []).slice(0, 3);
      const matchCount = data.match_count || data.results?.length || 0;

      setRunningStrategies(prev => ({
        ...prev,
        [strategyId]: {
          id: strategyId,
          loading: false,
          results: topResults,
          matchCount
        }
      }));
    } catch (error) {
      console.error('Failed to run strategy:', error);
      setRunningStrategies(prev => ({
        ...prev,
        [strategyId]: {
          id: strategyId,
          loading: false,
          error: 'Failed to run strategy'
        }
      }));
    }
  };

  const navigationItems = [
    { label: 'Dashboard',         path: '/dashboard',                icon: '📊' },
    { label: 'Pipeline',          path: '/deals',                    icon: '📋' },
    { label: 'Portfolio Assets',  path: '/assets-owned',             icon: '🏢' },
    { label: 'Market Intelligence', path: '/market-intelligence',    icon: '📈' },
    { label: 'Compete',           path: '/competitive-intelligence', icon: '🎯' },
    { label: 'News Intelligence', path: '/news-intel',               icon: '📰' },
    { label: 'Opportunities',     path: '/opportunities',            icon: '⚡' },
    { label: 'Reports',           path: '/reports',                  icon: '📄' },
    { label: 'Settings',          path: '/settings',                 icon: '⚙️' },
    { label: 'Email',             path: '/dashboard/email',          icon: '📧' },
    { label: 'Tasks',             path: '/tasks',                    icon: '✅' },
    { label: 'Team Management',   path: '/team',                     icon: '👥' },
    { label: 'Strategy Builder',  path: '/strategy-builder',         icon: '🔬' },
    { label: 'Create New Deal',   path: '/deals/create',             icon: '➕' },
  ];

  const filteredStrategies = strategies.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNavItems = navigationItems.filter(item =>
    !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-96 z-50 flex flex-col overflow-hidden"
        style={{
          background: T.bg.panel,
          borderLeft: `1px solid ${T.border.medium}`,
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${T.border.subtle}`,
          background: T.bg.header,
        }}>
          <h2 style={{
            fontSize: T.fontSize.md,
            fontFamily: T.font.mono,
            fontWeight: 700,
            color: T.text.amber,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>Commands</h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: T.text.muted,
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: T.font.mono,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border.subtle}` }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search strategies, navigation..."
            style={{
              width: '100%',
              padding: '8px 12px',
              background: T.bg.input,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: T.text.primary,
              fontSize: T.fontSize.base,
              fontFamily: T.font.mono,
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = T.text.amber; }}
            onBlur={e => { e.currentTarget.style.borderColor = T.border.medium; }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: 16 }}>
            <h3 style={{
              fontSize: T.fontSize.xs,
              fontFamily: T.font.mono,
              fontWeight: 700,
              color: T.text.muted,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Strategies
            </h3>

            {strategiesLoading ? (
              <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: '16px 0', fontFamily: T.font.mono }}>
                Loading strategies...
              </div>
            ) : filteredStrategies.length === 0 && searchQuery ? (
              <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: '16px 0', fontFamily: T.font.mono }}>
                No strategies found
              </div>
            ) : filteredStrategies.length === 0 ? (
              <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: '16px 0', fontFamily: T.font.mono }}>
                <p>No strategies yet.</p>
                <button
                  onClick={() => { navigate('/strategies?tab=builder'); onClose(); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: T.text.amber,
                    fontFamily: T.font.mono,
                    fontSize: T.fontSize.sm,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  + Create New
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredStrategies.map(strategy => {
                  const running = runningStrategies[strategy.id];
                  const hasResults = running?.results && running.results.length > 0;

                  return (
                    <div
                      key={strategy.id}
                      style={{
                        border: `1px solid ${T.border.subtle}`,
                        borderRadius: 2,
                        padding: 12,
                        background: T.bg.panelAlt,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{
                            fontSize: T.fontSize.base,
                            fontWeight: 600,
                            color: T.text.primary,
                            fontFamily: T.font.mono,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {strategy.name}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              fontSize: T.fontSize.xs,
                              fontFamily: T.font.mono,
                              fontWeight: 700,
                              borderRadius: 2,
                              border: `1px solid ${strategy.type === 'preset' ? T.text.cyan : T.text.purple}`,
                              background: `${strategy.type === 'preset' ? T.text.cyan : T.text.purple}22`,
                              color: strategy.type === 'preset' ? T.text.cyan : T.text.purple,
                            }}>
                              {strategy.type}
                            </span>
                            {strategy.last_match_count != null && (
                              <span style={{ fontSize: T.fontSize.xs, color: T.text.muted, fontFamily: T.font.mono }}>
                                {strategy.last_match_count} matches
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!hasResults ? (
                        <button
                          onClick={() => runStrategy(strategy.id)}
                          disabled={running?.loading}
                          style={{
                            width: '100%',
                            padding: '6px 0',
                            borderRadius: 2,
                            border: `1px solid ${T.text.amber}44`,
                            background: `${T.text.amber}15`,
                            color: T.text.amber,
                            fontSize: T.fontSize.sm,
                            fontFamily: T.font.mono,
                            fontWeight: 600,
                            cursor: running?.loading ? 'not-allowed' : 'pointer',
                            opacity: running?.loading ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          {running?.loading ? (
                            <>
                              <span style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                border: `2px solid ${T.text.amber}`,
                                borderTopColor: 'transparent',
                                animation: 'spin 1s linear infinite',
                              }} />
                              Running...
                            </>
                          ) : (
                            <>▶ Run</>
                          )}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{
                            fontSize: T.fontSize.sm,
                            fontWeight: 600,
                            color: T.text.green,
                            background: `${T.text.green}15`,
                            padding: '4px 8px',
                            borderRadius: 2,
                            fontFamily: T.font.mono,
                          }}>
                            ✓ {running!.matchCount} matches
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {running!.results!.map((result, idx) => (
                              <div
                                key={idx}
                                style={{
                                  fontSize: T.fontSize.xs,
                                  background: T.bg.header,
                                  padding: '4px 8px',
                                  borderRadius: 2,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontFamily: T.font.mono,
                                }}
                              >
                                <span style={{ color: T.text.primary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {result.geography_name}
                                </span>
                                <span style={{ color: T.text.secondary, marginLeft: 8, flexShrink: 0 }}>
                                  {(result.score * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => { navigate(`/strategies/${strategy.id}`); onClose(); }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: T.text.amber,
                              fontSize: T.fontSize.xs,
                              fontFamily: T.font.mono,
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '4px 0',
                              textAlign: 'center',
                            }}
                          >
                            View All →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredStrategies.length > 0 && (
                  <button
                    onClick={() => { navigate('/strategies?tab=builder'); onClose(); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: T.text.amber,
                      fontSize: T.fontSize.xs,
                      fontFamily: T.font.mono,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '8px 0',
                      textAlign: 'center',
                    }}
                  >
                    + Create New Strategy
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredNavItems.length > 0 && (
            <div style={{
              padding: '16px',
              borderTop: `1px solid ${T.border.subtle}`,
            }}>
              <h3 style={{
                fontSize: T.fontSize.xs,
                fontFamily: T.font.mono,
                fontWeight: 700,
                color: T.text.muted,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}>
                Navigation
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredNavItems.map(item => (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); onClose(); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 2,
                      border: 'none',
                      background: 'transparent',
                      color: T.text.secondary,
                      fontSize: T.fontSize.base,
                      fontFamily: T.font.mono,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = T.bg.hover;
                      e.currentTarget.style.color = T.text.amber;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = T.text.secondary;
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 16px',
          borderTop: `1px solid ${T.border.subtle}`,
          background: T.bg.header,
          fontSize: T.fontSize.xs,
          fontFamily: T.font.mono,
          color: T.text.muted,
        }}>
          <div>
            Press <kbd style={{
              padding: '2px 6px',
              background: T.bg.active,
              border: `1px solid ${T.border.medium}`,
              borderRadius: 2,
              color: T.text.amber,
              fontFamily: T.font.mono,
              fontSize: T.fontSize.xs,
            }}>Esc</kbd> to close
          </div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
};

export default CommandPanel;
