/**
 * M15: Tiered Comp Discovery
 * Geographic 3-tier comp discovery: Trade Area → Submarket → MSA
 */

import { useState, useEffect } from 'react';
import {
  MapPin, Loader, AlertCircle, Plus, X,
  Building2, TrendingUp
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface TieredComp {
  address: string;
  name: string;
  units: number;
  year_built: number | null;
  stories: number | null;
  class_code: string | null;
  distance_miles: number | null;
  match_score: number;
  avg_rent: number | null;
  occupancy: number | null;
  geographic_tier: 'trade_area' | 'submarket' | 'msa';
  in_comp_set: boolean;
  comp_set_id: string | null;
}

interface TieredCompDiscoveryProps {
  dealId: string;
  deal?: any;
  onCompSelected?: (comp: TieredComp) => void;
  onCompRemoved?: (comp: TieredComp) => void;
  compact?: boolean;
}

const tierConfig = {
  trade_area: { label: 'Trade Area', color: 'bg-blue-50 border-blue-200' },
  submarket: { label: 'Submarket', color: 'bg-purple-50 border-purple-200' },
  msa: { label: 'Metro (MSA)', color: 'bg-amber-50 border-amber-200' },
};

export default function TieredCompDiscovery({
  dealId,
  deal,
  onCompSelected,
  onCompRemoved,
  compact = false
}: TieredCompDiscoveryProps) {
  const [discoveredComps, setDiscoveredComps] = useState<{
    trade_area: TieredComp[];
    submarket: TieredComp[];
    msa: TieredComp[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [selectedComps, setSelectedComps] = useState<Set<string>>(new Set());

  const loadDiscoveredComps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.compDiscovery.discoverTieredComps(dealId, radiusMiles);
      if (response.data) {
        setDiscoveredComps(response.data);
        // Mark already-selected comps
        const allComps = [
          ...(response.data.trade_area || []),
          ...(response.data.submarket || []),
          ...(response.data.msa || [])
        ];
        setSelectedComps(new Set(
          allComps.filter(c => c.in_comp_set).map(c => c.address.toLowerCase())
        ));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to discover comps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscoveredComps();
  }, [dealId, radiusMiles]);

  const toggleCompSelection = async (comp: TieredComp) => {
    const isSelected = selectedComps.has(comp.address.toLowerCase());

    try {
      if (!isSelected) {
        // Add to comp set
        await apiClient.compDiscovery.addCompToSet(dealId, {
          address: comp.address,
          name: comp.name,
          units: comp.units,
          year_built: comp.year_built,
          stories: comp.stories,
          class_code: comp.class_code,
          distance_miles: comp.distance_miles,
          match_score: comp.match_score,
          geographic_tier: comp.geographic_tier,
        });
        setSelectedComps(prev => new Set([...prev, comp.address.toLowerCase()]));
        onCompSelected?.(comp);
      } else {
        // Remove from comp set
        await apiClient.compDiscovery.removeCompFromSet(dealId, comp.address);
        setSelectedComps(prev => {
          const updated = new Set(prev);
          updated.delete(comp.address.toLowerCase());
          return updated;
        });
        onCompRemoved?.(comp);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update comp selection');
    }
  };

  const renderCompCard = (comp: TieredComp) => {
    const isSelected = selectedComps.has(comp.address.toLowerCase());

    return (
      <div
        key={`${comp.geographic_tier}-${comp.address}`}
        className={`p-3 rounded-lg border-2 transition-all ${
          isSelected
            ? 'border-green-500 bg-green-50'
            : tierConfig[comp.geographic_tier as keyof typeof tierConfig].color
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{comp.name}</div>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <MapPin size={12} />
              <span>{comp.distance_miles || '—'}mi</span>
            </div>
          </div>
          <button
            onClick={() => toggleCompSelection(comp)}
            className={`flex-shrink-0 p-1.5 rounded transition-colors ${
              isSelected
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {isSelected ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div>
            <span className="text-slate-500">Units:</span>
            <div className="font-bold text-slate-800">{comp.units}</div>
          </div>
          <div>
            <span className="text-slate-500">Year:</span>
            <div className="font-bold text-slate-800">{comp.year_built || '—'}</div>
          </div>
          <div>
            <span className="text-slate-500">Match:</span>
            <div className="font-bold text-slate-800">{Math.round(comp.match_score)}%</div>
          </div>
        </div>
      </div>
    );
  };

  const TierSection = ({ tier, label, comps }: { tier: keyof typeof tierConfig; label: string; comps: TieredComp[] }) => {
    if (!comps || comps.length === 0) return null;

    const selected = comps.filter(c => selectedComps.has(c.address.toLowerCase())).length;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <Building2 size={14} className="text-slate-600" />
          <span className="text-xs font-bold text-slate-700 flex-1">
            {label}
            <span className="ml-1 text-slate-500">({selected}/{comps.length})</span>
          </span>
        </div>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {comps.map(comp => renderCompCard(comp))}
        </div>
      </div>
    );
  };

  if (loading && !discoveredComps) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <p className="text-sm text-slate-500">Discovering comparable properties...</p>
      </div>
    );
  }

  if (error && !discoveredComps) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Failed to load comps</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!discoveredComps) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500">No comparables discovered</p>
      </div>
    );
  }

  const tradeAreaCount = discoveredComps.trade_area?.length || 0;
  const submarketCount = discoveredComps.submarket?.length || 0;
  const msaCount = discoveredComps.msa?.length || 0;
  const totalCount = tradeAreaCount + submarketCount + msaCount;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Search Radius:</label>
          <select
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
            className="text-xs px-2 py-1 border border-slate-300 rounded bg-white"
          >
            <option value={1}>1 mile</option>
            <option value={2}>2 miles</option>
            <option value={3}>3 miles</option>
            <option value={5}>5 miles</option>
            <option value={10}>10 miles</option>
          </select>
        </div>
        <p className="text-xs text-slate-600">
          Found {totalCount} comparables across geographic tiers
        </p>
      </div>

      {/* Results by Tier */}
      <div className="space-y-4">
        <TierSection
          tier="trade_area"
          label="Trade Area"
          comps={discoveredComps.trade_area || []}
        />
        <TierSection
          tier="submarket"
          label="Submarket"
          comps={discoveredComps.submarket || []}
        />
        <TierSection
          tier="msa"
          label="Metropolitan Area"
          comps={discoveredComps.msa || []}
        />
      </div>

      {/* Summary */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <TrendingUp size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <p className="font-medium">
              {selectedComps.size} of {totalCount} comparables selected
            </p>
            <p className="text-blue-700 mt-1">
              Use the controls above to add or remove properties from your comp set.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
