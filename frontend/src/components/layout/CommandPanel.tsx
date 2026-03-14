import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';

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

  // Load strategies when panel opens
  useEffect(() => {
    if (isOpen) {
      loadStrategies();
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  // Close panel on location change
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
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
      const response = await api.get('/api/v1/strategies');
      setStrategies(response.data.data || []);
    } catch (error) {
      console.error('Failed to load strategies:', error);
    } finally {
      setStrategiesLoading(false);
    }
  };

  const runStrategy = async (strategyId: string) => {
    // Set loading state
    setRunningStrategies(prev => ({
      ...prev,
      [strategyId]: { id: strategyId, loading: true }
    }));

    try {
      const response = await api.post(`/api/v1/strategies/${strategyId}/run`);
      const data = response.data.data;

      // Extract top 3 results
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
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Pipeline', path: '/deals', icon: '📊' },
    { label: 'Market Intelligence', path: '/market-intelligence', icon: '🧠' },
    { label: 'Strategies', path: '/strategies', icon: '⚡' },
    { label: 'Assets Owned', path: '/assets-owned', icon: '🏢' }
  ];

  const filteredStrategies = strategies.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-40"
        onClick={onClose}
      />

      {/* Command Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Commands</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search strategies, navigation..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Strategies Group */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Strategies
            </h3>

            {strategiesLoading ? (
              <div className="text-sm text-gray-500 py-4">Loading strategies...</div>
            ) : filteredStrategies.length === 0 && searchQuery ? (
              <div className="text-sm text-gray-500 py-4">No strategies found</div>
            ) : filteredStrategies.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">
                <p>No strategies yet.</p>
                <button
                  onClick={() => {
                    navigate('/strategies?tab=builder');
                    onClose();
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  + Create New
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStrategies.map(strategy => {
                  const running = runningStrategies[strategy.id];
                  const hasResults = running?.results && running.results.length > 0;

                  return (
                    <div
                      key={strategy.id}
                      className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {strategy.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                              strategy.type === 'preset'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {strategy.type}
                            </span>
                            {strategy.last_match_count && (
                              <span className="text-xs text-gray-500">
                                {strategy.last_match_count} matches
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Run Button / Results */}
                      {!hasResults ? (
                        <button
                          onClick={() => runStrategy(strategy.id)}
                          disabled={running?.loading}
                          className="w-full text-left text-sm px-2 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          {running?.loading ? (
                            <>
                              <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              ▶ Run
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-green-700 bg-green-50 px-2 py-1.5 rounded">
                            ✓ {running.matchCount} matches
                          </div>
                          <div className="space-y-1">
                            {running.results.map((result, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-gray-50 px-2 py-1.5 rounded flex items-start justify-between"
                              >
                                <span className="text-gray-900 truncate font-medium flex-1">
                                  {result.geography_name}
                                </span>
                                <span className="text-gray-600 ml-2 flex-shrink-0">
                                  {(result.score * 100).toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              navigate(`/strategies/${strategy.id}`);
                              onClose();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center py-1"
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
                    onClick={() => {
                      navigate('/strategies?tab=builder');
                      onClose();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center py-2"
                  >
                    + Create New Strategy
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Navigation Group */}
          {!searchQuery && (
            <div className="px-4 pb-4 border-t border-gray-200 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Navigation
              </h3>
              <div className="space-y-1">
                {navigationItems.map(item => (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div>Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-900 font-mono">Esc</kbd> to close</div>
        </div>
      </div>
    </>
  );
};

export default CommandPanel;
