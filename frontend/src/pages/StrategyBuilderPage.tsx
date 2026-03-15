import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  formula: string;
  higherIsBetter: boolean;
}

interface MetricCategory {
  id: string;
  name: string;
  color: string;
}

interface Condition {
  id: string;
  metricId: string;
  operator: string;
  value: number | null;
  weight: number;
  required: boolean;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'preset' | 'custom';
  scope: string;
  conditions: Condition[];
  assetClasses: string[];
  tags: string[];
  lastRunAt?: string;
  matchCount?: number;
}

interface PreviewResult {
  name: string;
  market: string;
  score: number;
  metrics: Record<string, number>;
}

const COLORS = {
  bg: '#0B0E13',
  surface: 'rgba(255,255,255,0.025)',
  border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  text: '#E8E6E1',
  textMuted: 'rgba(232,230,225,0.5)',
  textDim: 'rgba(232,230,225,0.22)',
  accent: '#63B3ED',
  success: '#68D391',
  error: '#FC8181',
  warning: '#F6E05E',
  purple: '#B794F4',
  orange: '#F6AD55',
  cyan: '#4FD1C5',
};

const OPERATORS = [
  { id: 'gt', label: '>', desc: 'greater than' },
  { id: 'gte', label: '>=', desc: 'greater or equal' },
  { id: 'lt', label: '<', desc: 'less than' },
  { id: 'lte', label: '<=', desc: 'less or equal' },
  { id: 'between', label: 'between', desc: 'between two values' },
  { id: 'top_pct', label: 'top %', desc: 'top N percentile' },
  { id: 'bottom_pct', label: 'bottom %', desc: 'bottom N percentile' },
  { id: 'increasing', label: 'trending up', desc: 'increasing over lookback' },
  { id: 'decreasing', label: 'trending down', desc: 'decreasing over lookback' },
];

const SCOPES = ['property', 'submarket', 'zip', 'county', 'msa'];
const ASSET_CLASSES = ['multifamily', 'single_family', 'industrial', 'office', 'retail'];

const METRIC_COLORS: Record<string, string> = {
  traffic_composite: COLORS.purple,
  traffic_physical: COLORS.accent,
  traffic_digital: COLORS.orange,
  financial: COLORS.success,
  supply: COLORS.error,
  demand: COLORS.cyan,
  market: COLORS.warning,
  competition: COLORS.orange,
  risk: COLORS.error,
  ownership: COLORS.purple,
};

export const StrategyBuilderPage: React.FC = () => {
  const { id: strategyId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'library' | 'builder' | 'deal'>('library');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricCategories, setMetricCategories] = useState<MetricCategory[]>([]);

  // Builder state
  const [strategyName, setStrategyName] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');
  const [scope, setScope] = useState('submarket');
  const [selectedAssetClasses, setSelectedAssetClasses] = useState<string[]>(['multifamily']);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch strategies on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [strategiesRes, catalogRes] = await Promise.all([
          api.get('/strategies'),
          api.get('/metrics/catalog'),
        ]);

        const raw = strategiesRes.data;
        setStrategies(Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []);

        if (catalogRes.data) {
          setMetrics(catalogRes.data.metrics || []);
          setMetricCategories(catalogRes.data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Load strategy for editing
  useEffect(() => {
    if (strategyId) {
      const strategy = strategies.find(s => s.id === strategyId);
      if (strategy) {
        setStrategyName(strategy.name);
        setStrategyDescription(strategy.description);
        setScope(strategy.scope);
        setSelectedAssetClasses(strategy.assetClasses);
        setConditions(strategy.conditions);
        setActiveTab('builder');
      }
    }
  }, [strategyId, strategies]);

  // Live preview debounce
  const debouncedPreview = useCallback(async () => {
    if (conditions.length === 0) {
      setPreviewResults([]);
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await api.post('/strategies/preview', {
        conditions,
        scope,
        assetClasses: selectedAssetClasses,
        maxResults: 10,
      });
      setPreviewResults(response.data.results || []);
    } catch (error) {
      console.error('Error fetching preview:', error);
      setPreviewResults([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [conditions, scope, selectedAssetClasses]);

  useEffect(() => {
    const timer = setTimeout(debouncedPreview, 500);
    return () => clearTimeout(timer);
  }, [debouncedPreview]);

  const addCondition = (metricId: string) => {
    const metric = metrics.find(m => m.id === metricId);
    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      metricId,
      operator: metric?.higherIsBetter ? 'gt' : 'lt',
      value: 0,
      weight: 20,
      required: false,
    };
    setConditions([...conditions, newCondition]);
    setShowCatalog(false);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, field: string, value: any) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const loadPreset = (strategy: Strategy) => {
    setStrategyName(strategy.name);
    setStrategyDescription(strategy.description);
    setScope(strategy.scope);
    setSelectedAssetClasses(strategy.assetClasses);
    setConditions(strategy.conditions);
    setActiveTab('builder');
  };

  const usedMetricIds = new Set(conditions.map(c => c.metricId));
  const filteredMetrics = catalogFilter
    ? metrics.filter(m => m.category === catalogFilter)
    : metrics;

  const availableMetrics = filteredMetrics.filter(m => !usedMetricIds.has(m.id));

  const handleSaveStrategy = async () => {
    if (!strategyName.trim()) {
      alert('Please enter a strategy name');
      return;
    }

    try {
      const payload = {
        name: strategyName,
        description: strategyDescription,
        scope,
        conditions,
        assetClasses: selectedAssetClasses,
        type: 'custom',
      };

      if (strategyId) {
        await api.put(`/strategies/${strategyId}`, payload);
      } else {
        await api.post('/strategies', payload);
      }

      navigate('/strategies');
    } catch (error) {
      console.error('Error saving strategy:', error);
      alert('Failed to save strategy');
    }
  };

  const handleDeleteStrategy = async () => {
    if (!strategyId) return;
    if (!confirm('Are you sure you want to delete this strategy?')) return;

    try {
      await api.delete(`/strategies/${strategyId}`);
      navigate('/strategies');
    } catch (error) {
      console.error('Error deleting strategy:', error);
      alert('Failed to delete strategy');
    }
  };

  const handleRunStrategy = async (id: string) => {
    try {
      const response = await api.post(`/strategies/${id}/run`);
      console.log('Strategy run results:', response.data);
      // TODO: Show results in modal or expand inline
    } catch (error) {
      console.error('Error running strategy:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.5px', color: COLORS.textDim }}>
            M08
          </span>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Strategy Engine</h2>
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 12,
            background: `${COLORS.accent}15`,
            color: COLORS.accent,
          }}>
            {metrics.length} metrics available
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        padding: '0 24px',
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
      }}>
        {[
          { id: 'library', label: 'Strategy Library' },
          { id: 'builder', label: 'Custom Builder' },
          { id: 'deal', label: 'Deal Scoring (M08)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 16px',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${activeTab === tab.id ? COLORS.accent : 'transparent'}`,
              color: activeTab === tab.id ? COLORS.text : COLORS.textDim,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 24px 24px' }}>
        {/* ═══ STRATEGY LIBRARY ═══ */}
        {activeTab === 'library' && (
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Platform-provided strategies and your saved custom strategies. Click any to load into the builder, or run directly.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}>
              {strategies.map(strategy => (
                <div
                  key={strategy.id}
                  onClick={() => loadPreset(strategy)}
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 14 }}>📊</span>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: strategy.type === 'preset' ? `${COLORS.success}15` : `${COLORS.accent}15`,
                      color: strategy.type === 'preset' ? COLORS.success : COLORS.accent,
                    }}>
                      {strategy.type.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
                    {strategy.name}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
                    {strategy.description}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {strategy.conditions.slice(0, 3).map((cond, i) => {
                      const metric = metrics.find(m => m.id === cond.metricId);
                      const color = metric ? METRIC_COLORS[metric.category] || COLORS.textMuted : COLORS.textMuted;
                      return (
                        <span
                          key={i}
                          style={{
                            fontSize: 8,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: `${color}10`,
                            color,
                            fontFamily: 'monospace',
                            border: `1px solid ${color}20`,
                          }}
                        >
                          {metric?.name?.split(' ').slice(0, 2).join(' ')} {cond.operator} {cond.value}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: COLORS.success,
                    }}>
                      {strategy.matchCount || 0} matches
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          loadPreset(strategy);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 4,
                          fontSize: 8,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${COLORS.accent}40`,
                          background: `${COLORS.accent}08`,
                          color: COLORS.accent,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleRunStrategy(strategy.id);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 4,
                          fontSize: 8,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${COLORS.success}40`,
                          background: `${COLORS.success}08`,
                          color: COLORS.success,
                        }}
                      >
                        Run
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Create Custom Strategy Card */}
              <div
                onClick={() => setActiveTab('builder')}
                style={{
                  background: 'transparent',
                  border: `1px dashed ${COLORS.borderHover}`,
                  borderRadius: 8,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 200,
                }}
              >
                <span style={{ fontSize: 24, color: COLORS.textDim }}>+</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim }}>Create Custom Strategy</span>
                <span style={{ fontSize: 9, color: COLORS.textDim, textAlign: 'center' }}>
                  Combine any platform metrics into your own quantitative screen
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CUSTOM BUILDER ═══ */}
        {activeTab === 'builder' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            {/* Left: Builder */}
            <div>
              {/* Strategy name + scope */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={strategyName}
                  onChange={e => setStrategyName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: 'rgba(255,255,255,0.02)',
                    color: COLORS.text,
                    fontSize: 14,
                    fontWeight: 700,
                    outline: 'none',
                    minWidth: 200,
                  }}
                  placeholder="Strategy name..."
                />
                <div style={{ display: 'flex', gap: 2 }}>
                  {SCOPES.map(s => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${scope === s ? COLORS.accent + '40' : COLORS.border}`,
                        background: scope === s ? COLORS.accent + '08' : 'transparent',
                        color: scope === s ? COLORS.accent : COLORS.textDim,
                        textTransform: 'capitalize',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset classes */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6 }}>
                  Asset Classes
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ASSET_CLASSES.map(cls => (
                    <button
                      key={cls}
                      onClick={() => {
                        setSelectedAssetClasses(prev =>
                          prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
                        );
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${selectedAssetClasses.includes(cls) ? COLORS.accent + '40' : COLORS.border}`,
                        background: selectedAssetClasses.includes(cls) ? COLORS.accent + '08' : 'transparent',
                        color: selectedAssetClasses.includes(cls) ? COLORS.accent : COLORS.textDim,
                        textTransform: 'capitalize',
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div style={{ marginBottom: 12 }}>
                {conditions.map((cond, idx) => {
                  const metric = metrics.find(m => m.id === cond.metricId);
                  const metricColor = metric ? METRIC_COLORS[metric.category] || COLORS.textMuted : COLORS.textMuted;

                  return (
                    <div key={cond.id}>
                      {idx > 0 && (
                        <div style={{
                          textAlign: 'center',
                          padding: '4px 0',
                          fontSize: 9,
                          fontWeight: 700,
                          color: COLORS.textDim,
                          letterSpacing: '2px',
                        }}>
                          AND
                        </div>
                      )}
                      <div style={{
                        background: COLORS.surface,
                        border: `1px solid ${metricColor}25`,
                        borderLeft: `3px solid ${metricColor}`,
                        borderRadius: '0 8px 8px 0',
                        padding: '12px 16px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 12,
                        alignItems: 'start',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{
                              fontSize: 8,
                              color: metricColor,
                              padding: '1px 6px',
                              borderRadius: 3,
                              background: `${metricColor}10`,
                            }}>
                              {metric?.category?.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                              {metric?.name || cond.metricId}
                            </span>
                            {cond.required && (
                              <span style={{ fontSize: 7, fontWeight: 700, color: COLORS.error }}>
                                REQUIRED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 8 }}>
                            {metric?.description}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                              value={cond.operator}
                              onChange={e => updateCondition(cond.id, 'operator', e.target.value)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: `1px solid ${COLORS.border}`,
                                background: 'rgba(255,255,255,0.02)',
                                color: COLORS.text,
                                fontSize: 10,
                                fontFamily: 'monospace',
                              }}
                            >
                              {OPERATORS.map(o => (
                                <option key={o.id} value={o.id}>
                                  {o.label} ({o.desc})
                                </option>
                              ))}
                            </select>

                            {!['increasing', 'decreasing'].includes(cond.operator) && (
                              <input
                                type="number"
                                step="0.1"
                                value={cond.value || ''}
                                onChange={e => updateCondition(cond.id, 'value', parseFloat(e.target.value) || 0)}
                                style={{
                                  width: 80,
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: `1px solid ${COLORS.border}`,
                                  background: 'rgba(255,255,255,0.02)',
                                  color: COLORS.text,
                                  fontSize: 11,
                                  textAlign: 'center',
                                }}
                              />
                            )}

                            <span style={{ fontSize: 9, color: COLORS.textDim }}>Weight:</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={cond.weight}
                              onChange={e => updateCondition(cond.id, 'weight', parseInt(e.target.value))}
                              style={{
                                width: 80,
                                accentColor: metricColor,
                              }}
                            />
                            <span style={{
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: metricColor,
                              minWidth: 28,
                            }}>
                              {cond.weight}%
                            </span>

                            <button
                              onClick={() => updateCondition(cond.id, 'required', !cond.required)}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 3,
                                fontSize: 8,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: `1px solid ${cond.required ? COLORS.error + '40' : COLORS.border}`,
                                background: cond.required ? COLORS.error + '08' : 'transparent',
                                color: cond.required ? COLORS.error : COLORS.textDim,
                              }}
                            >
                              {cond.required ? 'Required' : 'Optional'}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => removeCondition(cond.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: `1px solid ${COLORS.error}30`,
                            background: 'transparent',
                            color: COLORS.error,
                            cursor: 'pointer',
                            fontSize: 10,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add condition button */}
              {!showCatalog ? (
                <button
                  onClick={() => setShowCatalog(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 8,
                    border: `1px dashed ${COLORS.borderHover}`,
                    background: 'transparent',
                    color: COLORS.textDim,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  + Add condition from metrics catalog
                </button>
              ) : (
                <div style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.text }}>Select a metric</span>
                    <button
                      onClick={() => setShowCatalog(false)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: COLORS.textDim,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Category filters */}
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 10 }}>
                    <button
                      onClick={() => setCatalogFilter(null)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${!catalogFilter ? COLORS.accent + '40' : COLORS.border}`,
                        background: !catalogFilter ? COLORS.accent + '08' : 'transparent',
                        color: !catalogFilter ? COLORS.accent : COLORS.textDim,
                      }}
                    >
                      All
                    </button>
                    {Array.from(new Set(metrics.map(m => m.category))).map(cat => {
                      const color = METRIC_COLORS[cat] || COLORS.textMuted;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCatalogFilter(cat)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: `1px solid ${catalogFilter === cat ? color + '40' : COLORS.border}`,
                            background: catalogFilter === cat ? color + '08' : 'transparent',
                            color: catalogFilter === cat ? color : COLORS.textDim,
                          }}
                        >
                          {cat.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>

                  {/* Metric list */}
                  <div style={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}>
                    {availableMetrics.length > 0 ? (
                      availableMetrics.map(m => {
                        const color = METRIC_COLORS[m.category] || COLORS.textMuted;
                        return (
                          <div
                            key={m.id}
                            onClick={() => addCondition(m.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 5,
                              border: `1px solid ${COLORS.border}`,
                              cursor: 'pointer',
                              background: COLORS.surface,
                              transition: 'all 0.1s',
                            }}
                          >
                            <span style={{
                              fontSize: 8,
                              fontFamily: 'monospace',
                              color,
                              padding: '1px 6px',
                              borderRadius: 3,
                              background: `${color}10`,
                              minWidth: 40,
                              textAlign: 'center',
                            }}>
                              {m.id.split('_')[0]}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.text }}>
                                {m.name}
                              </div>
                              <div style={{ fontSize: 8, color: COLORS.textDim }}>
                                {m.description.slice(0, 80)}...
                              </div>
                            </div>
                            <span style={{ fontSize: 9, fontFamily: 'monospace', color: COLORS.textDim }}>
                              {m.unit}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontSize: 9, color: COLORS.textDim, textAlign: 'center', padding: '10px' }}>
                        All available metrics are already used
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save / Delete buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                <button
                  onClick={handleSaveStrategy}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: `1px solid ${COLORS.success}40`,
                    background: COLORS.success + '08',
                    color: COLORS.success,
                  }}
                >
                  Save Strategy
                </button>
                {strategyId && (
                  <button
                    onClick={handleDeleteStrategy}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${COLORS.error}40`,
                      background: COLORS.error + '08',
                      color: COLORS.error,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Right: Live Preview */}
            <div>
              <div style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: '14px 16px',
                position: 'sticky',
                top: 16,
                maxHeight: '80vh',
                overflowY: 'auto',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1,
                    color: COLORS.textDim,
                  }}>
                    LIVE PREVIEW
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: COLORS.success,
                    fontFamily: 'monospace',
                  }}>
                    {previewResults.length} matches
                  </span>
                </div>
                <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 10 }}>
                  Scanning {scope}s across markets
                </div>

                {/* Condition summary */}
                <div style={{
                  marginBottom: 10,
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.015)',
                  borderRadius: 5,
                }}>
                  {conditions.length > 0 ? (
                    conditions.map((c, i) => {
                      const m = metrics.find(x => x.id === c.metricId);
                      const color = m ? METRIC_COLORS[m.category] : COLORS.textMuted;
                      return (
                        <div key={c.id} style={{
                          fontSize: 8,
                          color: c.required ? COLORS.text : COLORS.textMuted,
                          padding: '2px 0',
                          fontFamily: 'monospace',
                        }}>
                          {i > 0 && <span style={{ color: COLORS.textDim }}> AND </span>}
                          <span style={{ color }}>{m?.name?.split(' ').slice(0, 3).join(' ')}</span>
                          <span style={{ color: COLORS.textDim }}> {c.operator} </span>
                          <span style={{ color: COLORS.text }}>{c.value}</span>
                          {c.required && <span style={{ color: COLORS.error, marginLeft: 4 }}>*</span>}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 8, color: COLORS.textDim }}>Add conditions to see preview</div>
                  )}
                </div>

                {/* Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {previewLoading ? (
                    <div style={{ fontSize: 9, color: COLORS.textMuted, textAlign: 'center', padding: '10px' }}>
                      Loading...
                    </div>
                  ) : previewResults.length > 0 ? (
                    previewResults.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '18px 1fr 48px',
                          gap: 6,
                          alignItems: 'center',
                          padding: '6px 8px',
                          borderRadius: 4,
                          background: i < 3 ? COLORS.success + '06' : 'transparent',
                          border: `1px solid ${i < 3 ? COLORS.success + '15' : COLORS.border}`,
                        }}
                      >
                        <span style={{
                          fontSize: 9,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: i < 3 ? COLORS.success : COLORS.textDim,
                          textAlign: 'center',
                        }}>
                          {i + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.text }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: 8, color: COLORS.textDim }}>
                            {r.market}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: r.score >= 80 ? COLORS.success : r.score >= 70 ? COLORS.accent : COLORS.warning,
                          }}>
                            {r.score}
                          </div>
                          <div style={{ fontSize: 7, color: COLORS.textDim }}>score</div>
                        </div>
                      </div>
                    ))
                  ) : conditions.length > 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 10px' }}>
                      <div style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 4 }}>No matching geographies found.</div>
                      <div style={{ fontSize: 8, color: COLORS.textDim }}>Ensure market data has been ingested for the selected scope.</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 5,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${COLORS.success}40`,
                      background: COLORS.success + '08',
                      color: COLORS.success,
                    }}
                  >
                    Run Full Scan
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 5,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${COLORS.accent}40`,
                      background: COLORS.accent + '08',
                      color: COLORS.accent,
                    }}
                  >
                    View on Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DEAL SCORING (M08) ═══ */}
        {activeTab === 'deal' && (
          <div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 16 }}>
              Score strategies against specific deals in the Deal Capsule → Strategy tab
            </div>
            <div style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.accent,
              }}>
                Coming soon: Score deals against all strategies
              </div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8 }}>
                Navigate to a deal in the Deal Capsule and click the Strategy tab to see strategy scores.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
