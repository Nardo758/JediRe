import { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface Market {
  name: string;
  display_name: string;
  state: string;
  metro_area: string;
  coverage_status: 'active' | 'beta' | 'coming_soon';
  property_count: number;
  data_freshness: string;
  region: string;
}

const REGION_ORDER = ['Southeast', 'Texas', 'West', 'Midwest', 'Northeast'];

const REGION_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  'Southeast': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-600' },
  'Texas': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-600' },
  'West': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-600' },
  'Midwest': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-600' },
  'Northeast': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-600' },
};

export default function MarketsPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [primaryMarket, setPrimaryMarket] = useState<string>('');
  const [expandedRegions, setExpandedRegions] = useState<string[]>(REGION_ORDER);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [marketsRes, prefsRes] = await Promise.all([
        api.get('/preferences/available-markets'),
        api.get('/preferences/user')
      ]);
      
      setMarkets(marketsRes.data.markets);
      const prefs = prefsRes.data.data || prefsRes.data.preferences || prefsRes.data;
      setSelectedMarkets(prefs.preferred_markets || []);
      setPrimaryMarket(prefs.primary_market || '');
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/preferences/user', {
        preferred_markets: selectedMarkets,
        primary_market: primaryMarket
      });
      alert('Market preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
      if (primaryMarket === marketName) {
        setPrimaryMarket('');
      }
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
      if (!primaryMarket) {
        setPrimaryMarket(marketName);
      }
    }
  };

  const toggleRegion = (region: string) => {
    if (expandedRegions.includes(region)) {
      setExpandedRegions(expandedRegions.filter(r => r !== region));
    } else {
      setExpandedRegions([...expandedRegions, region]);
    }
  };

  const groupedMarkets = markets.reduce((acc, market) => {
    const region = market.region || 'Other';
    if (!acc[region]) acc[region] = [];
    acc[region].push(market);
    return acc;
  }, {} as Record<string, Market[]>);

  const getSelectableMarkets = (regionMarkets: Market[]) =>
    regionMarkets.filter(m => m.coverage_status !== 'coming_soon');

  const isRegionFullySelected = (region: string) => {
    const selectable = getSelectableMarkets(groupedMarkets[region] || []);
    return selectable.length > 0 && selectable.every(m => selectedMarkets.includes(m.name));
  };

  const isRegionPartiallySelected = (region: string) => {
    const selectable = getSelectableMarkets(groupedMarkets[region] || []);
    const selectedCount = selectable.filter(m => selectedMarkets.includes(m.name)).length;
    return selectedCount > 0 && selectedCount < selectable.length;
  };

  const toggleSelectAllRegion = (region: string) => {
    const selectable = getSelectableMarkets(groupedMarkets[region] || []);
    const selectableNames = selectable.map(m => m.name);
    
    if (isRegionFullySelected(region)) {
      setSelectedMarkets(selectedMarkets.filter(m => !selectableNames.includes(m)));
      if (selectableNames.includes(primaryMarket)) {
        setPrimaryMarket('');
      }
    } else {
      const newSelected = [...new Set([...selectedMarkets, ...selectableNames])];
      setSelectedMarkets(newSelected);
      if (!primaryMarket && selectableNames.length > 0) {
        setPrimaryMarket(selectableNames[0]);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      beta: 'bg-blue-100 text-blue-800',
      coming_soon: 'bg-gray-100 text-gray-600'
    };
    const labels: Record<string, string> = {
      active: 'Active',
      beta: 'Beta',
      coming_soon: 'Coming Soon'
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const sortedRegions = [
    ...REGION_ORDER.filter(r => groupedMarkets[r]),
    ...Object.keys(groupedMarkets).filter(r => !REGION_ORDER.includes(r))
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Markets & Coverage</h1>
        <p className="text-gray-600 mt-2">
          Select which markets you want to track. Click a region header to select all markets in that region.
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
          <span>{selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected</span>
          {primaryMarket && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Primary: <strong className="text-gray-700">{markets.find(m => m.name === primaryMarket)?.display_name}</strong>
            </span>
          )}
        </div>
      </div>

      {sortedRegions.map((region) => {
        const regionMarkets = groupedMarkets[region];
        const colors = REGION_COLORS[region] || REGION_COLORS['Southeast'];
        const isExpanded = expandedRegions.includes(region);
        const selectable = getSelectableMarkets(regionMarkets);
        const selectedCount = selectable.filter(m => selectedMarkets.includes(m.name)).length;
        const allSelected = isRegionFullySelected(region);
        const partiallySelected = isRegionPartiallySelected(region);

        return (
          <div key={region} className={`rounded-lg border ${colors.border} overflow-hidden`}>
            <div
              className={`${colors.bg} px-5 py-3 flex items-center justify-between cursor-pointer select-none`}
              onClick={() => toggleRegion(region)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${colors.text}`} />
                )}
                <h2 className={`text-lg font-bold ${colors.text}`}>{region}</h2>
                <span className="text-sm text-gray-500">
                  {regionMarkets.length} market{regionMarkets.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedCount}/{selectable.length} selected
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectAllRegion(region);
                  }}
                  className={`
                    px-3 py-1 text-xs font-medium rounded-full transition-colors
                    ${allSelected
                      ? `${colors.accent} text-white`
                      : partiallySelected
                        ? `border-2 ${colors.border} ${colors.text} bg-white`
                        : 'border border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
                    }
                  `}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="bg-white p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {regionMarkets.map((market) => {
                    const isSelected = selectedMarkets.includes(market.name);
                    const isDisabled = market.coverage_status === 'coming_soon';

                    return (
                      <button
                        key={market.name}
                        onClick={() => !isDisabled && toggleMarket(market.name)}
                        disabled={isDisabled}
                        className={`
                          p-3 rounded-lg border-2 text-left transition-all
                          ${isSelected
                            ? `${colors.border} ${colors.bg}`
                            : 'border-gray-200 hover:border-gray-300'
                          }
                          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{market.display_name}</h3>
                            <p className="text-xs text-gray-500">{market.metro_area}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className={`w-4 h-4 ${colors.text} flex-shrink-0 ml-2`} />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          {getStatusBadge(market.coverage_status)}
                          {market.property_count > 0 && (
                            <span className="text-xs text-gray-500">
                              {(market.property_count / 1000).toFixed(0)}K props
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <label className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="radio"
                                name="primary_market"
                                checked={primaryMarket === market.name}
                                onChange={() => setPrimaryMarket(market.name)}
                                className="text-blue-600"
                              />
                              <span className="text-gray-600">Primary market</span>
                            </label>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-gray-600">
          Changes will update your Market Research dashboard and analytics
        </p>
        
        <button
          onClick={handleSave}
          disabled={saving || selectedMarkets.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  );
}
