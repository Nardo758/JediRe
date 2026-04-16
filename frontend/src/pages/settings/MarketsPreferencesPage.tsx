import { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

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

const REGION_ACCENT: Record<string, string> = {
  'Southeast': BT.text.green,
  'Texas': BT.text.amber,
  'West': BT.text.cyan,
  'Midwest': BT.text.purple,
  'Northeast': BT.text.violet,
};

export default function MarketsPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
      setSaveMessage(null);
      await api.put('/preferences/user', {
        preferred_markets: selectedMarkets,
        primary_market: primaryMarket
      });
      setSaveMessage({ type: 'success', text: 'Market preferences saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
      if (primaryMarket === marketName) setPrimaryMarket('');
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
      if (!primaryMarket) setPrimaryMarket(marketName);
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
      if (selectableNames.includes(primaryMarket)) setPrimaryMarket('');
    } else {
      const newSelected = [...new Set([...selectedMarkets, ...selectableNames])];
      setSelectedMarkets(newSelected);
      if (!primaryMarket && selectableNames.length > 0) setPrimaryMarket(selectableNames[0]);
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { label: string; color: string }> = {
      active: { label: 'Active', color: BT.text.green },
      beta: { label: 'Beta', color: BT.text.cyan },
      coming_soon: { label: 'Coming Soon', color: BT.text.muted },
    };
    const s = cfg[status] || cfg.coming_soon;
    return (
      <span style={{ fontSize: 10, padding: '2px 8px', fontWeight: 600, color: s.color, background: BT.bg.panelAlt, ...mono }}>{s.label}</span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ height: 32, width: 32, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const sortedRegions = [
    ...REGION_ORDER.filter(r => groupedMarkets[r]),
    ...Object.keys(groupedMarkets).filter(r => !REGION_ORDER.includes(r))
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary, letterSpacing: '0.04em' }}>Markets & Coverage</h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
          Select which markets you want to track. Click a region header to select all markets in that region.
        </p>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: BT.text.muted }}>
          <span>{selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected</span>
          {primaryMarket && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin style={{ width: 12, height: 12 }} />
              Primary: <strong style={{ color: BT.text.primary }}>{markets.find(m => m.name === primaryMarket)?.display_name}</strong>
            </span>
          )}
        </div>
      </div>

      {sortedRegions.map((region) => {
        const regionMarkets = groupedMarkets[region];
        const accent = REGION_ACCENT[region] || BT.text.cyan;
        const isExpanded = expandedRegions.includes(region);
        const selectable = getSelectableMarkets(regionMarkets);
        const selectedCount = selectable.filter(m => selectedMarkets.includes(m.name)).length;
        const allSelected = isRegionFullySelected(region);

        return (
          <div key={region} style={{ border: `1px solid ${BT.border.subtle}`, overflow: 'hidden' }}>
            <div
              onClick={() => toggleRegion(region)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: BT.bg.panelAlt,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isExpanded
                  ? <ChevronDown style={{ width: 16, height: 16, color: accent }} />
                  : <ChevronRight style={{ width: 16, height: 16, color: accent }} />
                }
                <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{region}</span>
                <span style={{ fontSize: 11, color: BT.text.muted }}>{regionMarkets.length} market{regionMarkets.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: BT.text.secondary, ...mono }}>{selectedCount}/{selectable.length}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelectAllRegion(region); }}
                  style={{
                    padding: '4px 12px',
                    fontSize: 10,
                    fontWeight: 600,
                    background: allSelected ? accent : 'transparent',
                    color: allSelected ? BT.bg.terminal : BT.text.secondary,
                    border: allSelected ? 'none' : `1px solid ${BT.border.subtle}`,
                    cursor: 'pointer',
                    ...mono,
                  }}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: 12, background: BT.bg.panel }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {regionMarkets.map((market) => {
                    const isSelected = selectedMarkets.includes(market.name);
                    const isDisabled = market.coverage_status === 'coming_soon';

                    return (
                      <button
                        key={market.name}
                        onClick={() => !isDisabled && toggleMarket(market.name)}
                        disabled={isDisabled}
                        style={{
                          textAlign: 'left' as const,
                          padding: 10,
                          border: `1px solid ${isSelected ? accent : BT.border.subtle}`,
                          background: isSelected ? BT.bg.active : BT.bg.panelAlt,
                          opacity: isDisabled ? 0.4 : 1,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{market.display_name}</div>
                            <div style={{ fontSize: 10, color: BT.text.muted }}>{market.metro_area}</div>
                          </div>
                          {isSelected && <CheckCircle2 style={{ width: 14, height: 14, color: accent, flexShrink: 0, marginLeft: 6 }} />}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          {getStatusBadge(market.coverage_status)}
                          {market.property_count > 0 && (
                            <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{(market.property_count / 1000).toFixed(0)}K</span>
                          )}
                        </div>

                        {isSelected && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BT.border.subtle}` }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="radio"
                                name="primary_market"
                                checked={primaryMarket === market.name}
                                onChange={() => setPrimaryMarket(market.name)}
                                style={{ accentColor: BT.text.cyan }}
                              />
                              <span style={{ color: BT.text.secondary }}>Primary market</span>
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

      {saveMessage && (
        <div style={{
          padding: '10px 16px',
          fontSize: 12,
          background: BT.bg.panelAlt,
          color: saveMessage.type === 'success' ? BT.text.green : BT.text.red,
          border: `1px solid ${saveMessage.type === 'success' ? BT.text.green : BT.text.red}`,
        }}>
          {saveMessage.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
        <span style={{ fontSize: 11, color: BT.text.muted }}>Changes will update your Market Research dashboard and analytics</span>
        <button
          onClick={handleSave}
          disabled={saving || selectedMarkets.length === 0}
          style={{
            padding: '8px 20px',
            background: saving || selectedMarkets.length === 0 ? BT.bg.active : BT.text.cyan,
            color: saving || selectedMarkets.length === 0 ? BT.text.muted : BT.bg.terminal,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            cursor: saving || selectedMarkets.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            ...mono,
          }}
        >
          {saving ? (
            <>
              <div style={{ height: 14, width: 14, border: '2px solid transparent', borderBottom: `2px solid ${BT.bg.terminal}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
