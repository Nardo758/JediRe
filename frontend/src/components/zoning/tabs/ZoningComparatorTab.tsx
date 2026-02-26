import React, { useState, useMemo } from 'react';
import type { ComparisonMode, ComparisonDelta } from '../../../types/zoning.types';
import { useZoningComparison } from '../../../hooks/useZoningComparison';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import SourceCitation from '../SourceCitation';

const MODE_OPTIONS: { mode: ComparisonMode; label: string }[] = [
  { mode: 'district', label: 'District vs District' },
  { mode: 'parcel', label: 'Parcel vs Parcel' },
  { mode: 'jurisdiction', label: 'Jurisdiction vs Jurisdiction' },
];

function getItemLabel(item: any, mode: ComparisonMode): string {
  if (!item) return '';
  if (mode === 'district') return item.code ? `${item.code} — ${item.name}` : item.name || item.id;
  if (mode === 'parcel') return item.address || item.parcelNumber || item.id;
  if (mode === 'jurisdiction') return `${item.municipality}, ${item.state}`;
  return String(item.id ?? item.name ?? '');
}

function formatValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  return val;
}

function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toLocaleString()}`;
}

function formatDeltaPercent(delta: number | null | undefined, valueA: string | number | null | undefined): string {
  if (delta === null || delta === undefined) return '—';
  if (typeof valueA === 'number' && valueA !== 0) {
    const pct = ((delta / valueA) * 100).toFixed(1);
    const sign = delta > 0 ? '+' : '';
    return `${sign}${pct}%`;
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toLocaleString()}`;
}

interface SelectionPanelProps {
  side: 'a' | 'b';
  label: string;
  selectedItem: any;
  mode: ComparisonMode;
  searchResults: any[];
  searching: boolean;
  onSearch: (query: string, side: 'a' | 'b') => void;
  onSelect: (item: any, side: 'a' | 'b') => void;
  onClear: (side: 'a' | 'b') => void;
}

function SelectionPanel({
  side,
  label,
  selectedItem,
  mode,
  searchResults,
  searching,
  onSearch,
  onSelect,
  onClear,
}: SelectionPanelProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);
    onSearch(val, side);
  };

  const handleSelect = (item: any) => {
    onSelect(item.data || item, side);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </div>

      {selectedItem ? (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-sm text-gray-900 font-medium truncate">
            {getItemLabel(selectedItem, mode)}
          </span>
          <button
            onClick={() => {
              onClear(side);
              setQuery('');
            }}
            className="ml-2 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder={`Search ${mode}s...`}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {searchResults.map((result: any, idx: number) => (
                <button
                  key={result.id || idx}
                  onMouseDown={() => handleSelect(result)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {result.label || getItemLabel(result.data || result, mode)}
                </button>
              ))}
            </div>
          )}
          {showDropdown && query.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl px-3 py-3 text-sm text-gray-500">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ deltas, labelA, labelB }: { deltas: ComparisonDelta[]; labelA?: string; labelB?: string }) {
  if (!deltas || deltas.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[28%]">Parameter</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-blue-600 uppercase tracking-wider w-[26%]">{labelA || 'Side A'}</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-purple-600 uppercase tracking-wider w-[26%]">{labelB || 'Side B'}</th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[20%]">Delta</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((row, idx) => {
            const isAdvA = row.advantage === 'a';
            const isAdvB = row.advantage === 'b';
            return (
              <tr
                key={row.field || idx}
                className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
              >
                <td className="py-3 px-4 text-gray-700 font-medium">{row.label}</td>
                <td
                  className={`py-3 px-4 text-center font-mono text-sm ${
                    isAdvA ? 'text-emerald-700 bg-emerald-50 font-semibold' : 'text-gray-600'
                  }`}
                >
                  {formatValue(row.valueA)}
                  {isAdvA && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-[10px]">✓</span>
                  )}
                  {row.citationA && (
                    <span className="ml-1"><SourceCitation section={row.citationA.section} url={row.citationA.url} sourceType="code" /></span>
                  )}
                </td>
                <td
                  className={`py-3 px-4 text-center font-mono text-sm ${
                    isAdvB ? 'text-emerald-700 bg-emerald-50 font-semibold' : 'text-gray-600'
                  }`}
                >
                  {formatValue(row.valueB)}
                  {isAdvB && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-[10px]">✓</span>
                  )}
                  {row.citationB && (
                    <span className="ml-1"><SourceCitation section={row.citationB.section} url={row.citationB.url} sourceType="code" /></span>
                  )}
                </td>
                <td className={`py-3 px-4 text-center font-mono text-sm ${
                  row.delta !== null && row.delta !== undefined
                    ? row.delta > 0 ? 'text-emerald-600' : row.delta < 0 ? 'text-red-500' : 'text-gray-400'
                    : 'text-gray-400'
                }`}>
                  {formatDeltaPercent(row.delta, row.valueA)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModeDescription({ mode }: { mode: ComparisonMode }) {
  const descriptions: Record<ComparisonMode, string> = {
    district: 'Compare density, height, FAR, permitted uses, parking requirements, and setbacks between two zoning districts.',
    parcel: 'Compare lot-specific development capacity including buildable area, unit counts, and site constraints.',
    jurisdiction: 'Compare permit timelines, impact fees, and regulatory environment between two jurisdictions.',
  };
  return (
    <p className="text-xs text-gray-500 mt-2">{descriptions[mode]}</p>
  );
}

// ============================================================================
// Next-Best Zoning Section
// ============================================================================

interface NextBestDistrict {
  code: string;
  name: string;
  densityBoost: string;
  heightBoost: string;
  farBoost: string;
  additionalUnits: number;
  revenueUplift: string;
  distance: string;
  feasibility: 'High' | 'Medium' | 'Low';
}

const MOCK_NEXT_BEST: NextBestDistrict[] = [
  { code: 'MRC-3-C', name: 'Mixed Residential Commercial 3-C', densityBoost: '+40%', heightBoost: '+60 ft', farBoost: '+1.2', additionalUnits: 98, revenueUplift: '+$12.4M', distance: 'Rezone required', feasibility: 'Medium' },
  { code: 'SPI-1', name: 'Special Public Interest 1', densityBoost: '+25%', heightBoost: '+40 ft', farBoost: '+0.8', additionalUnits: 61, revenueUplift: '+$7.8M', distance: 'Overlay available', feasibility: 'High' },
  { code: 'MR-5A', name: 'Multi-Res 5A (High-Density)', densityBoost: '+60%', heightBoost: '+90 ft', farBoost: '+2.0', additionalUnits: 147, revenueUplift: '+$18.6M', distance: 'Rezone required', feasibility: 'Low' },
];

function NextBestZoningSection() {
  const { development_path } = useZoningModuleStore();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200 flex items-center justify-between"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Next-Best Zoning Analysis</h3>
          <p className="text-xs text-gray-500 mt-0.5">What if this parcel had a different zoning code?</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">District</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Density</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Height</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">FAR</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">+Units</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Feasibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_NEXT_BEST.map(d => (
                  <tr key={d.code} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3">
                      <div className="text-xs font-bold text-gray-900">{d.code}</div>
                      <div className="text-[10px] text-gray-500">{d.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{d.distance}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-green-700 font-medium">{d.densityBoost}</td>
                    <td className="py-2.5 px-3 text-center text-xs text-green-700 font-medium">{d.heightBoost}</td>
                    <td className="py-2.5 px-3 text-center text-xs text-green-700 font-medium">{d.farBoost}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-gray-900">+{d.additionalUnits}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-bold text-green-700">{d.revenueUplift}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        d.feasibility === 'High' ? 'bg-green-50 text-green-700' :
                        d.feasibility === 'Medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>{d.feasibility}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-base">💡</span>
              <div>
                <p className="text-xs text-blue-900 font-medium">AI Recommendation</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  SPI-1 overlay offers the best risk-adjusted return: +61 units with high feasibility
                  through an overlay application rather than full rezone. Estimated 2-4 month process.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Rezoning Pathway Section
// ============================================================================

function RezoningPathwaySection() {
  const [expanded, setExpanded] = useState(false);

  const steps = [
    { step: 1, name: 'Pre-Application Meeting', duration: '2-4 weeks', cost: '$0', status: 'required', description: 'Meet with planning staff to discuss feasibility and requirements' },
    { step: 2, name: 'Community Engagement', duration: '4-8 weeks', cost: '$5-15K', status: 'recommended', description: 'NPU meetings, neighborhood outreach, address concerns early' },
    { step: 3, name: 'Rezone Application Filing', duration: '1-2 weeks', cost: '$2,500', status: 'required', description: 'Submit formal application with site plan, impact studies, traffic analysis' },
    { step: 4, name: 'Staff Review', duration: '6-12 weeks', cost: '$15-25K (studies)', status: 'required', description: 'Planning department technical review, may require revisions' },
    { step: 5, name: 'Zoning Review Board', duration: '2-4 weeks', cost: '$0', status: 'required', description: 'Public hearing, staff recommendation, conditional approval possible' },
    { step: 6, name: 'City Council Vote', duration: '2-6 weeks', cost: '$50-100K (legal)', status: 'required', description: 'Final approval, may include conditions/proffers' },
    { step: 7, name: 'Post-Approval Compliance', duration: '2-4 weeks', cost: 'Varies', status: 'if applicable', description: 'Record conditions, update permits, begin site plan under new zoning' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Rezoning Pathway Guide</h3>
          <p className="text-xs text-gray-500 mt-0.5">Step-by-step process, costs, and timeline for rezoning in this jurisdiction</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4">
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">{s.step}</div>
                  {i < steps.length - 1 && <div className="w-px flex-1 bg-purple-200 mt-1" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      s.status === 'required' ? 'bg-blue-50 text-blue-700' :
                      s.status === 'recommended' ? 'bg-green-50 text-green-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] text-gray-400">⏱ {s.duration}</span>
                    <span className="text-[10px] text-gray-400">💰 {s.cost}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Total Timeline</div>
              <div className="text-lg font-bold text-gray-900">8-18 months</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Total Est. Cost</div>
              <div className="text-lg font-bold text-gray-900">$75-145K</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Success Rate (County)</div>
              <div className="text-lg font-bold text-gray-900">38%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ZoningComparatorTabProps {
  dealId?: string;
  deal?: any;
}

export default function ZoningComparatorTab({ dealId, deal }: ZoningComparatorTabProps = {}) {
  const {
    comparisonMode,
    comparisonA,
    comparisonB,
    comparison,
    loading,
    error,
    searchResultsA,
    searchResultsB,
    searchingA,
    searchingB,
    searchItems,
    selectItem,
    compare,
    changeMode,
    clearSelection,
  } = useZoningComparison();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Zoning Comparator</h2>
        <p className="text-sm text-gray-500">
          Compare zoning districts, parcels, or jurisdictions side-by-side
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Comparison Mode
        </div>
        <div className="flex gap-6 flex-wrap">
          {MODE_OPTIONS.map(({ mode, label }) => (
            <label
              key={mode}
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => changeMode(mode)}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                comparisonMode === mode
                  ? 'border-blue-600'
                  : 'border-gray-300 group-hover:border-gray-400'
              }`}>
                {comparisonMode === mode && (
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                )}
              </span>
              <span className={`text-sm transition-colors ${
                comparisonMode === mode
                  ? 'text-gray-900 font-medium'
                  : 'text-gray-600 group-hover:text-gray-900'
              }`}>
                {label}
              </span>
            </label>
          ))}
        </div>
        <ModeDescription mode={comparisonMode} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-4 items-start">
          <SelectionPanel
            side="a"
            label="Side A"
            selectedItem={comparisonA}
            mode={comparisonMode}
            searchResults={searchResultsA}
            searching={searchingA}
            onSearch={searchItems}
            onSelect={selectItem}
            onClear={clearSelection}
          />

          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-6 rounded-full bg-gray-100 border border-gray-200 text-gray-500 text-sm font-bold">
            vs
          </div>

          <SelectionPanel
            side="b"
            label="Side B"
            selectedItem={comparisonB}
            mode={comparisonMode}
            searchResults={searchResultsB}
            searching={searchingB}
            onSearch={searchItems}
            onSelect={selectItem}
            onClear={clearSelection}
          />
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={compare}
            disabled={!comparisonA || !comparisonB || loading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {comparison && comparison.deltas && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Side-by-Side Comparison</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {getItemLabel(comparison.itemA, comparisonMode)} vs{' '}
              {getItemLabel(comparison.itemB, comparisonMode)}
            </p>
          </div>
          <ComparisonTable
            deltas={comparison.deltas}
            labelA={getItemLabel(comparison.itemA, comparisonMode)}
            labelB={getItemLabel(comparison.itemB, comparisonMode)}
          />
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span>📊</span> Export Comparison
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span>📎</span> Attach to Deal
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <span>🗺️</span> Show Both on Map
            </button>
          </div>
        </div>
      )}

      {comparison?.aiSynthesis && (
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-base">🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">AI Synthesis</h3>
              <p className="text-sm text-gray-600 leading-relaxed italic">
                "{comparison.aiSynthesis}"
              </p>
            </div>
          </div>
        </div>
      )}

      <NextBestZoningSection />
      <RezoningPathwaySection />

      {!comparison && !loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-gray-500">
            Select two items above and click Compare to see side-by-side analysis
          </p>
        </div>
      )}
    </div>
  );
}
