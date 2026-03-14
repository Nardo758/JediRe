/**
 * Strategy Builder Page
 * Three-tab interface: Library | Custom Builder | Deal Scoring
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrategyCondition {
  id: string;
  metricId: string;
  operator: string;
  value: number | null;
  weight: number;
  required: boolean;
  label?: string;
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: 'preset' | 'custom';
  isPreset: boolean;
  scope: string;
  conditions: StrategyCondition[];
  combinator: 'AND' | 'OR';
  assetClasses: string[];
  dealTypes: string[];
  tags: string[];
  isPublic: boolean;
  matchCount?: number;
  lastRunAt?: string;
  createdAt?: string;
}

interface MetricCatalogEntry {
  id: string;
  label: string;
  description: string;
  category: string;
  unit?: string;
  higherIsBetter?: boolean;
}

interface PreviewResult {
  geographyId: string;
  geographyName?: string;
  score: number;
  metrics: Record<string, { value: number }>;
}

type PageTab = 'library' | 'builder' | 'scoring';

const OPERATORS = [
  { value: 'gt', label: '> Greater than' },
  { value: 'gte', label: '≥ At least' },
  { value: 'lt', label: '< Less than' },
  { value: 'lte', label: '≤ At most' },
  { value: 'between', label: '↔ Between' },
  { value: 'top_pct', label: '▲ Top %' },
  { value: 'bottom_pct', label: '▼ Bottom %' },
  { value: 'increasing', label: '↗ Increasing' },
  { value: 'decreasing', label: '↘ Decreasing' },
];

const SCOPES = [
  { value: 'submarket', label: 'Submarket / Metro' },
  { value: 'zip', label: 'ZIP Code' },
  { value: 'county', label: 'County' },
  { value: 'msa', label: 'MSA' },
];

const ASSET_CLASSES = ['multifamily', 'single_family', 'industrial', 'office', 'retail', 'mixed_use'];

const CATEGORY_COLORS: Record<string, string> = {
  traffic_physical: 'bg-blue-100 text-blue-700',
  traffic_digital: 'bg-purple-100 text-purple-700',
  traffic_composite: 'bg-indigo-100 text-indigo-700',
  financial: 'bg-green-100 text-green-700',
  supply: 'bg-orange-100 text-orange-700',
  market: 'bg-amber-100 text-amber-700',
  demand: 'bg-rose-100 text-rose-700',
  economic: 'bg-teal-100 text-teal-700',
};

function newConditionId() {
  return `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export const StrategyBuilderPage: React.FC = () => {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<PageTab>(routeId ? 'builder' : 'library');

  // Library state
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // Builder state
  const [editingId, setEditingId] = useState<string | null>(routeId || null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('submarket');
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<StrategyCondition[]>([]);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMetricCatalog, setShowMetricCatalog] = useState(false);

  // Metrics catalog
  const [catalog, setCatalog] = useState<MetricCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Live preview
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load library ──
  const loadStrategies = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const res = await apiClient.get('/api/v1/strategies');
      if (res.data?.success) setStrategies(res.data.strategies || []);
    } catch (e: any) {
      setLibraryError(e.message || 'Failed to load strategies');
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => { loadStrategies(); }, [loadStrategies]);

  // ── Load metrics catalog ──
  const loadCatalog = useCallback(async () => {
    if (catalog.length > 0) return;
    setCatalogLoading(true);
    try {
      const res = await apiClient.get('/api/v1/metrics/catalog');
      if (res.data?.success) setCatalog(res.data.metrics || []);
    } catch {
      // fallback: empty catalog
    } finally {
      setCatalogLoading(false);
    }
  }, [catalog.length]);

  useEffect(() => {
    if (activeTab === 'builder') loadCatalog();
  }, [activeTab, loadCatalog]);

  // ── Load strategy for editing ──
  useEffect(() => {
    if (!routeId) return;
    const found = strategies.find(s => s.id === routeId);
    if (found) populateBuilder(found);
  }, [routeId, strategies]);

  const populateBuilder = (s: Strategy) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description || '');
    setScope(s.scope || 'submarket');
    setCombinator(s.combinator || 'AND');
    setConditions(s.conditions || []);
    setAssetClasses(s.assetClasses || []);
  };

  // ── Live preview ──
  useEffect(() => {
    if (conditions.length === 0) {
      setPreviewResults([]);
      setPreviewCount(null);
      return;
    }
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await apiClient.post('/api/v1/strategies/preview', {
          scope, combinator, conditions, maxResults: 10,
        });
        if (res.data?.success) {
          setPreviewResults(res.data.results || []);
          setPreviewCount(res.data.matchCount ?? null);
        }
      } catch { /* silent */ } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [conditions, scope, combinator]);

  // ── Condition helpers ──
  const addCondition = (metricId?: string) => {
    const metric = catalog.find(m => m.id === metricId);
    setConditions(prev => [...prev, {
      id: newConditionId(),
      metricId: metricId || '',
      operator: 'gt',
      value: null,
      weight: 50,
      required: false,
      label: metric?.label,
    }]);
    setShowMetricCatalog(false);
  };

  const updateCondition = (id: string, updates: Partial<StrategyCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  // ── Save strategy ──
  const handleSave = async () => {
    if (!name.trim()) { setSaveError('Name is required'); return; }
    if (conditions.length === 0) { setSaveError('Add at least one condition'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload = { name, description, scope, combinator, conditions, assetClasses };
      if (editingId) {
        await apiClient.put(`/api/v1/strategies/${editingId}`, payload);
      } else {
        const res = await apiClient.post('/api/v1/strategies', payload);
        if (res.data?.strategy?.id) setEditingId(res.data.strategy.id);
      }
      setSaveSuccess(true);
      loadStrategies();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.response?.data?.error || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete strategy ──
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this strategy?')) return;
    try {
      await apiClient.delete(`/api/v1/strategies/${id}`);
      setStrategies(prev => prev.filter(s => s.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setName(''); setDescription(''); setConditions([]);
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Delete failed');
    }
  };

  // ── Edit strategy ──
  const handleEdit = (strategy: Strategy) => {
    populateBuilder(strategy);
    setActiveTab('builder');
  };

  // ── New strategy ──
  const handleNew = () => {
    setEditingId(null);
    setName(''); setDescription(''); setScope('submarket');
    setCombinator('AND'); setConditions([]); setAssetClasses([]);
    setSaveError(null); setSaveSuccess(false);
    setActiveTab('builder');
  };

  // ── Catalog helpers ──
  const categories = ['all', ...Array.from(new Set(catalog.map(m => m.category)))];
  const filteredCatalog = catalog.filter(m => {
    const matchCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchText = !catalogFilter ||
      m.label.toLowerCase().includes(catalogFilter.toLowerCase()) ||
      m.id.toLowerCase().includes(catalogFilter.toLowerCase());
    return matchCat && matchText;
  });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Strategy Builder</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Build custom market screening strategies and score deals
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create Strategy
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 mt-4">
          {([
            { id: 'library', label: 'Strategy Library', emoji: '📚' },
            { id: 'builder', label: 'Custom Builder', emoji: '🔧' },
            { id: 'scoring', label: 'Deal Scoring', emoji: '🎯' },
          ] as { id: PageTab; label: string; emoji: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'library' && (
          <LibraryTab
            strategies={strategies}
            loading={libraryLoading}
            error={libraryError}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={handleNew}
          />
        )}
        {activeTab === 'builder' && (
          <BuilderTab
            editingId={editingId}
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            scope={scope} setScope={setScope}
            combinator={combinator} setCombinator={setCombinator}
            conditions={conditions}
            assetClasses={assetClasses} setAssetClasses={setAssetClasses}
            onAddCondition={addCondition}
            onUpdateCondition={updateCondition}
            onRemoveCondition={removeCondition}
            onSave={handleSave}
            onDelete={editingId ? () => handleDelete(editingId) : undefined}
            saving={saving}
            saveError={saveError}
            saveSuccess={saveSuccess}
            showMetricCatalog={showMetricCatalog}
            setShowMetricCatalog={setShowMetricCatalog}
            catalog={catalog}
            catalogLoading={catalogLoading}
            catalogFilter={catalogFilter}
            setCatalogFilter={setCatalogFilter}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            filteredCatalog={filteredCatalog}
            previewResults={previewResults}
            previewCount={previewCount}
            previewLoading={previewLoading}
          />
        )}
        {activeTab === 'scoring' && <ScoringTab />}
      </div>
    </div>
  );
};

// ── Library Tab ───────────────────────────────────────────────────────────────

interface LibraryTabProps {
  strategies: Strategy[];
  loading: boolean;
  error: string | null;
  onEdit: (s: Strategy) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const LibraryTab: React.FC<LibraryTabProps> = ({
  strategies, loading, error, onEdit, onDelete, onNew,
}) => {
  const presets = strategies.filter(s => s.isPreset);
  const custom = strategies.filter(s => !s.isPreset);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading strategies...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Presets */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-gray-900">Preset Strategies</h2>
          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
            {presets.length}
          </span>
        </div>
        {presets.length === 0 ? (
          <p className="text-sm text-gray-500">No preset strategies loaded.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {presets.map(s => (
              <StrategyCard key={s.id} strategy={s} onEdit={onEdit} readOnly />
            ))}
          </div>
        )}
      </div>

      {/* Custom */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Custom Strategies</h2>
            <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-full">
              {custom.length}
            </span>
          </div>
          <button
            onClick={onNew}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Create Custom Strategy
          </button>
        </div>
        {custom.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">🔧</div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">No custom strategies yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Build your own market screening strategy using the Custom Builder.
            </p>
            <button
              onClick={onNew}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Build Your First Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {custom.map(s => (
              <StrategyCard key={s.id} strategy={s} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface StrategyCardProps {
  strategy: Strategy;
  onEdit: (s: Strategy) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy, onEdit, onDelete, readOnly }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{strategy.name}</h3>
          {strategy.isPreset && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
              PRESET
            </span>
          )}
        </div>
        {strategy.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{strategy.description}</p>
        )}
      </div>
    </div>

    {/* Conditions preview */}
    {strategy.conditions?.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {strategy.conditions.slice(0, 3).map((c, i) => (
          <span
            key={i}
            className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
          >
            {c.metricId} {c.operator} {c.value ?? '–'}
          </span>
        ))}
        {strategy.conditions.length > 3 && (
          <span className="text-[10px] text-gray-400">+{strategy.conditions.length - 3} more</span>
        )}
      </div>
    )}

    <div className="mt-auto flex items-center gap-2">
      <span className="text-xs text-gray-400 flex-1">
        {strategy.conditions?.length || 0} conditions · {strategy.scope}
      </span>
      {!readOnly && onDelete && (
        <button
          onClick={() => onDelete(strategy.id)}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
        >
          Delete
        </button>
      )}
      <button
        onClick={() => onEdit(strategy)}
        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
      >
        {readOnly ? 'View' : 'Edit'}
      </button>
    </div>
  </div>
);

// ── Builder Tab ───────────────────────────────────────────────────────────────

interface BuilderTabProps {
  editingId: string | null;
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  scope: string; setScope: (v: string) => void;
  combinator: 'AND' | 'OR'; setCombinator: (v: 'AND' | 'OR') => void;
  conditions: StrategyCondition[];
  assetClasses: string[]; setAssetClasses: (v: string[]) => void;
  onAddCondition: (metricId?: string) => void;
  onUpdateCondition: (id: string, updates: Partial<StrategyCondition>) => void;
  onRemoveCondition: (id: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  showMetricCatalog: boolean;
  setShowMetricCatalog: (v: boolean) => void;
  catalog: MetricCatalogEntry[];
  catalogLoading: boolean;
  catalogFilter: string;
  setCatalogFilter: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  categories: string[];
  filteredCatalog: MetricCatalogEntry[];
  previewResults: PreviewResult[];
  previewCount: number | null;
  previewLoading: boolean;
}

const BuilderTab: React.FC<BuilderTabProps> = ({
  editingId, name, setName, description, setDescription,
  scope, setScope, combinator, setCombinator, conditions, assetClasses, setAssetClasses,
  onAddCondition, onUpdateCondition, onRemoveCondition,
  onSave, onDelete, saving, saveError, saveSuccess,
  showMetricCatalog, setShowMetricCatalog,
  catalog, catalogLoading, catalogFilter, setCatalogFilter,
  selectedCategory, setSelectedCategory, categories, filteredCatalog,
  previewResults, previewCount, previewLoading,
}) => (
  <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

    {/* LEFT: Builder form */}
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
          {editingId ? 'Edit Strategy' : 'New Strategy'}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Strategy Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Rent Runway Detector"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this strategy detect?"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Scope</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Combinator</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['AND', 'OR'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCombinator(v)}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      combinator === v
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Asset classes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Asset Classes</label>
            <div className="flex flex-wrap gap-2">
              {ASSET_CLASSES.map(ac => (
                <button
                  key={ac}
                  onClick={() => setAssetClasses(
                    assetClasses.includes(ac)
                      ? assetClasses.filter(x => x !== ac)
                      : [...assetClasses, ac]
                  )}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    assetClasses.includes(ac)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {ac.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
            Conditions
            {conditions.length > 0 && (
              <span className="ml-2 text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {conditions.length}
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowMetricCatalog(!showMetricCatalog)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            + Add Condition
          </button>
        </div>

        {conditions.length === 0 && !showMetricCatalog && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm">No conditions yet. Click "+ Add Condition" to start.</p>
          </div>
        )}

        {/* Conditions list */}
        <div className="space-y-3">
          {conditions.map((cond, idx) => {
            const metric = catalog.find(m => m.id === cond.metricId);
            return (
              <div key={cond.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}.</span>
                  <select
                    value={cond.metricId}
                    onChange={e => {
                      const m = catalog.find(m => m.id === e.target.value);
                      onUpdateCondition(cond.id, { metricId: e.target.value, label: m?.label });
                    }}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">— Select metric —</option>
                    {catalog.map(m => (
                      <option key={m.id} value={m.id}>{m.label} ({m.id})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemoveCondition(cond.id)}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                {metric && (
                  <p className="text-[11px] text-gray-400 ml-7">{metric.description}</p>
                )}

                <div className="flex items-center gap-2 ml-7">
                  <select
                    value={cond.operator}
                    onChange={e => onUpdateCondition(cond.id, { operator: e.target.value })}
                    className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {!['increasing', 'decreasing'].includes(cond.operator) && (
                    <input
                      type="number"
                      value={cond.value ?? ''}
                      onChange={e => onUpdateCondition(cond.id, { value: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="value"
                      className="w-24 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  )}

                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={cond.required}
                      onChange={e => onUpdateCondition(cond.id, { required: e.target.checked })}
                      className="rounded"
                    />
                    Required
                  </label>
                </div>

                <div className="ml-7 flex items-center gap-3">
                  <span className="text-[11px] text-gray-400">Weight:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={cond.weight}
                    onChange={e => onUpdateCondition(cond.id, { weight: Number(e.target.value) })}
                    className="flex-1 h-1.5 accent-blue-500"
                  />
                  <span className="text-[11px] font-mono text-gray-600 w-6">{cond.weight}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Metric catalog dropdown */}
        {showMetricCatalog && (
          <div className="mt-3 border border-blue-200 rounded-xl bg-blue-50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={catalogFilter}
                onChange={e => setCatalogFilter(e.target.value)}
                placeholder="Search metrics..."
                className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                autoFocus
              />
              <button
                onClick={() => setShowMetricCatalog(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1 mb-2">
              {categories.slice(0, 8).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {catalogLoading ? (
              <div className="text-xs text-gray-500 py-2 text-center">Loading catalog...</div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredCatalog.slice(0, 30).map(m => (
                  <button
                    key={m.id}
                    onClick={() => onAddCondition(m.id)}
                    className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-white transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-800 group-hover:text-blue-700">
                          {m.label}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[m.category] || 'bg-gray-100 text-gray-600'}`}>
                          {m.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{m.id}</div>
                    </div>
                  </button>
                ))}
                {filteredCatalog.length === 0 && (
                  <div className="text-xs text-gray-400 py-4 text-center">No metrics match your search</div>
                )}
              </div>
            )}
            <button
              onClick={() => onAddCondition()}
              className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 py-1.5 border border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
            >
              + Add blank condition
            </button>
          </div>
        )}
      </div>

      {/* Save / Delete */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : editingId ? 'Update Strategy' : 'Save Strategy'}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          ✓ Strategy saved successfully
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
    </div>

    {/* RIGHT: Live preview (sticky) */}
    <div className="lg:sticky lg:top-6 self-start space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Live Preview</h2>
          {previewLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Scanning…
            </div>
          )}
        </div>

        {conditions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">⚡</div>
            <p className="text-sm">Add conditions to see live results</p>
          </div>
        ) : (
          <>
            {/* Match count */}
            {previewCount !== null && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                <div>
                  <div className="text-2xl font-bold text-blue-700">{previewCount.toLocaleString()}</div>
                  <div className="text-xs text-blue-600">markets matched</div>
                </div>
                <div className="flex-1 text-xs text-blue-700 leading-relaxed">
                  {combinator === 'AND' ? 'All' : 'Any'} of your {conditions.length} condition{conditions.length !== 1 ? 's' : ''} must pass
                </div>
              </div>
            )}

            {/* Top results */}
            {previewResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Top {previewResults.length} Markets
                </div>
                {previewResults.map((r, idx) => (
                  <div
                    key={r.geographyId}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-xs font-mono text-gray-400 w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {r.geographyName || r.geographyId}
                      </div>
                      {Object.entries(r.metrics).slice(0, 1).map(([k, v]) => (
                        <div key={k} className="text-[10px] text-gray-400 font-mono">
                          {k}: {typeof v.value === 'number' ? v.value.toFixed(2) : v.value}
                        </div>
                      ))}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-bold text-blue-700">{r.score}%</div>
                      <div className="w-12 bg-gray-200 rounded-full h-1 mt-1">
                        <div
                          className="h-1 rounded-full bg-blue-500"
                          style={{ width: `${Math.min(r.score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!previewLoading && previewCount === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">
                No markets match these conditions. Try relaxing your thresholds.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

// ── Deal Scoring Tab ──────────────────────────────────────────────────────────

const ScoringTab: React.FC = () => (
  <div className="p-6 max-w-2xl mx-auto">
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="text-5xl mb-4">🎯</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Deal Scoring (M08)</h2>
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        Score any deal against all your strategies to instantly see which market theses apply.
        Strategy scoring is available directly inside each Deal Capsule under the{' '}
        <strong>Strategy tab → ⚙️ Custom Screen</strong>.
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2 mb-6">
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">How it works</div>
        <ul className="text-sm text-blue-800 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">1.</span>
            Open any deal from the Deals page
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">2.</span>
            Click the <strong>Strategy tab (F5)</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">3.</span>
            Switch to the <strong>⚙️ Custom Screen</strong> sub-tab
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">4.</span>
            See all your strategies scored with ✓/✗ indicators and match percentages
          </li>
        </ul>
      </div>
      <a
        href="/deals"
        className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Deals →
      </a>
    </div>
  </div>
);

export default StrategyBuilderPage;
