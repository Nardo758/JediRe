import React, { useState } from 'react';
import type { ComparisonMode, ComparisonDelta } from '../../../types/zoning.types';
import { useZoningComparison } from '../../../hooks/useZoningComparison';

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

function ComparisonTable({ deltas }: { deltas: ComparisonDelta[] }) {
  if (!deltas || deltas.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-gray-500 font-medium w-1/4">Metric</th>
            <th className="text-center py-3 px-4 text-blue-600 font-medium w-1/4">Side A</th>
            <th className="text-center py-3 px-4 text-purple-600 font-medium w-1/4">Side B</th>
            <th className="text-center py-3 px-4 text-gray-500 font-medium w-1/4">Delta</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((row, idx) => {
            const isAdvA = row.advantage === 'a';
            const isAdvB = row.advantage === 'b';
            return (
              <tr
                key={row.field || idx}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td className="py-3 px-4 text-gray-600 font-medium">{row.label}</td>
                <td
                  className={`py-3 px-4 text-center font-mono ${
                    isAdvA ? 'text-emerald-600 bg-emerald-50' : 'text-gray-600'
                  }`}
                >
                  {formatValue(row.valueA)}
                  {isAdvA && (
                    <span className="ml-1.5 text-xs text-emerald-600">▲</span>
                  )}
                </td>
                <td
                  className={`py-3 px-4 text-center font-mono ${
                    isAdvB ? 'text-emerald-600 bg-emerald-50' : 'text-gray-600'
                  }`}
                >
                  {formatValue(row.valueB)}
                  {isAdvB && (
                    <span className="ml-1.5 text-xs text-emerald-600">▲</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-mono text-gray-500">
                  {formatDelta(row.delta)}
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

export default function ZoningComparatorTab() {
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

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Comparison Mode
        </div>
        <div className="flex gap-2 flex-wrap">
          {MODE_OPTIONS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => changeMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                comparisonMode === mode
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <ModeDescription mode={comparisonMode} />
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
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

          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 mt-6 rounded-full bg-white border border-gray-200 text-gray-500 text-sm font-bold">
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
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Comparison Results</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {getItemLabel(comparison.itemA, comparisonMode)} vs{' '}
              {getItemLabel(comparison.itemB, comparisonMode)}
            </p>
          </div>
          <ComparisonTable deltas={comparison.deltas} />
        </div>
      )}

      {comparison?.aiSynthesis && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-semibold text-blue-900">AI Synthesis</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {comparison.aiSynthesis}
          </p>
        </div>
      )}

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
