/**
 * PeerComparisonDataGrid — M87
 * Bloomberg-styled sortable DataGrid comparing subject deal vs peer properties.
 * Columns: Rank, Property, Units, Year, Class, Avg Rent, Cap Rate, Price/Unit, Occupancy, Distance, Match
 */

import React, { useState, useMemo } from 'react';

export interface PeerProperty {
  id: string;
  name: string;
  address?: string;
  units: number;
  yearBuilt: number | null;
  class: string | null;
  avgRent: number | null;
  capRate: number | null;
  pricePerUnit: number | null;
  occupancy: number | null;
  distance: number | null;
  matchScore: number | null;
  isSubject?: boolean;
}

type SortKey = keyof Omit<PeerProperty, 'id' | 'address' | 'isSubject'>;
type SortDir = 'asc' | 'desc';

interface ColDef {
  key: SortKey;
  label: string;
  format: (v: any) => string;
  align: 'left' | 'right' | 'center';
  highlight?: boolean;
}

const COLS: ColDef[] = [
  { key: 'name',         label: 'PROPERTY',   format: v => v || '—',                     align: 'left' },
  { key: 'units',        label: 'UNITS',      format: v => v != null ? v.toLocaleString() : '—',    align: 'right' },
  { key: 'yearBuilt',    label: 'YEAR',       format: v => v != null ? String(v) : '—',  align: 'center' },
  { key: 'class',        label: 'CLASS',      format: v => v || '—',                     align: 'center' },
  { key: 'avgRent',      label: 'AVG RENT',   format: v => v != null ? `$${Math.round(v).toLocaleString()}` : '—',  align: 'right', highlight: true },
  { key: 'capRate',      label: 'CAP RATE',   format: v => v != null ? `${v.toFixed(2)}%` : '—',  align: 'right', highlight: true },
  { key: 'pricePerUnit', label: '$/UNIT',     format: v => v != null ? `$${Math.round(v).toLocaleString()}` : '—', align: 'right', highlight: true },
  { key: 'occupancy',    label: 'OCC%',       format: v => v != null ? `${v.toFixed(1)}%` : '—',  align: 'right' },
  { key: 'distance',     label: 'DIST (mi)',  format: v => v != null ? `${v.toFixed(1)}` : '—',    align: 'right' },
  { key: 'matchScore',   label: 'MATCH',      format: v => v != null ? `${Math.round(v)}` : '—',  align: 'right' },
];

function sortProperties(props: PeerProperty[], key: SortKey, dir: SortDir): PeerProperty[] {
  return [...props].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = Number(av);
    const bn = Number(bv);
    return dir === 'asc' ? an - bn : bn - an;
  });
}

function getRelativeColor(val: number | null, allVals: (number | null)[], key: string, isSubject?: boolean): string {
  if (!isSubject || val == null) return '';
  const valid = allVals.filter(v => v != null) as number[];
  if (valid.length < 2) return '';
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  if (range === 0) return '';
  const pct = (val - min) / range;
  const higherIsBetter = !['capRate', 'distance'].includes(key);
  const score = higherIsBetter ? pct : 1 - pct;
  if (score >= 0.7) return 'text-[#10B981]';
  if (score >= 0.4) return 'text-[#F5A623]';
  return 'text-[#EF4444]';
}

interface PeerComparisonDataGridProps {
  properties: PeerProperty[];
  title?: string;
}

export const PeerComparisonDataGrid: React.FC<PeerComparisonDataGridProps> = ({
  properties,
  title = 'PEER COMPARISON',
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('matchScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [highlightSubject, setHighlightSubject] = useState(true);

  const subject = properties.find(p => p.isSubject) || null;
  const peers = properties.filter(p => !p.isSubject);

  const sortedPeers = useMemo(() => sortProperties(peers, sortKey, sortDir), [peers, sortKey, sortDir]);

  const allRows: PeerProperty[] = subject
    ? [subject, ...sortedPeers]
    : sortedPeers;

  const handleColClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const allVals: Record<string, (number | null)[]> = {};
  for (const col of COLS) {
    allVals[col.key] = allRows.map(r => {
      const v = r[col.key];
      return typeof v === 'number' ? v : null;
    });
  }

  if (allRows.length === 0) {
    return (
      <div className="rounded border border-[#1a2233] bg-[#0d1424] px-6 py-10 text-center">
        <p className="font-mono text-xs text-[#4a5568]">NO PEER DATA AVAILABLE</p>
        <p className="text-xs text-[#4a5568] mt-1">Add comparable properties to see peer comparison.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-[#1a2233] bg-[#0A0E17] overflow-hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#1a2233] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-[#F5A623] tracking-wider">{title}</span>
          <span className="text-[9px] text-[#4a5568]">{allRows.length} PROPERTIES</span>
          {subject && (
            <span className="text-[9px] text-[#7f8ea3]">
              SUBJECT: <span className="text-[#F5A623]">{subject.name}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHighlightSubject(h => !h)}
            className={`text-[9px] px-2 py-0.5 rounded border transition ${
              highlightSubject
                ? 'border-[#F5A623]/40 text-[#F5A623] bg-[#F5A623]/5'
                : 'border-[#1a2233] text-[#4a5568]'
            }`}
          >
            HIGHLIGHT SUBJECT
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1a2233] bg-[#0d1424]">
              <th className="px-3 py-2 text-left text-[9px] text-[#4a5568] w-7">#</th>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.key !== 'name' ? handleColClick(col.key) : null}
                  className={`px-3 py-2 text-[9px] text-[#7f8ea3] tracking-wider select-none whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.key !== 'name' ? 'cursor-pointer hover:text-[#F5A623]' : ''} ${
                    sortKey === col.key ? 'text-[#F5A623]' : ''
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, idx) => {
              const isSubj = !!row.isSubject;
              const rank = isSubj ? '★' : String(idx + (subject ? 0 : 1));

              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#1a2233]/60 transition-colors ${
                    isSubj && highlightSubject
                      ? 'bg-[#F5A623]/5 border-b-[#F5A623]/20'
                      : 'hover:bg-[#0d1424]'
                  }`}
                >
                  {/* Rank */}
                  <td className={`px-3 py-2.5 text-center text-[9px] ${
                    isSubj ? 'text-[#F5A623] font-bold' : 'text-[#4a5568]'
                  }`}>
                    {rank}
                  </td>

                  {COLS.map(col => {
                    const rawVal = row[col.key];
                    const formatted = col.format(rawVal);
                    const relColor = col.highlight
                      ? getRelativeColor(typeof rawVal === 'number' ? rawVal : null, allVals[col.key], col.key, isSubj)
                      : '';

                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${
                          col.align === 'right' ? 'text-right' :
                          col.align === 'center' ? 'text-center' : ''
                        } ${
                          col.key === 'name'
                            ? isSubj
                              ? 'font-semibold text-[#F5A623]'
                              : 'text-[#c8cdd4]'
                            : col.key === 'class'
                            ? ''
                            : isSubj && relColor
                            ? relColor + ' font-semibold'
                            : 'text-[#c8cdd4]'
                        }`}
                      >
                        {col.key === 'class' ? (
                          rawVal ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              String(rawVal).startsWith('A') ? 'bg-[#3B82F6]/10 text-[#60A5FA]' :
                              String(rawVal).startsWith('B') ? 'bg-[#F5A623]/10 text-[#F5A623]' :
                              'bg-[#1a2233] text-[#7f8ea3]'
                            }`}>
                              {String(rawVal)}
                            </span>
                          ) : <span className="text-[#4a5568]">—</span>
                        ) : col.key === 'matchScore' && typeof rawVal === 'number' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-[#1a2233] rounded overflow-hidden">
                              <div
                                className="h-full rounded"
                                style={{
                                  width: `${rawVal}%`,
                                  backgroundColor: rawVal >= 70 ? '#10B981' : rawVal >= 50 ? '#F5A623' : '#EF4444',
                                }}
                              />
                            </div>
                            <span>{formatted}</span>
                          </div>
                        ) : (
                          formatted
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {subject && peers.length > 0 && (
        <div className="px-4 py-2 border-t border-[#1a2233] bg-[#0d1424] flex items-center gap-6">
          {(['avgRent', 'capRate', 'pricePerUnit'] as const).map(key => {
            const col = COLS.find(c => c.key === key);
            if (!col) return null;
            const vals = peers.map(p => {
              const v = p[key];
              return typeof v === 'number' ? v : null;
            }).filter((v): v is number => v !== null);
            if (vals.length === 0) return null;
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            const subVal = subject[key];
            const pct = typeof subVal === 'number' ? ((subVal - avg) / avg) * 100 : null;

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[9px] text-[#4a5568]">{col.label} vs PEERS:</span>
                <span className={`text-[9px] font-bold ${
                  pct == null ? 'text-[#7f8ea3]' :
                  pct > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}>
                  {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeerComparisonDataGrid;
