import React, { useState } from 'react';
import { T } from '../../styles/terminal-tokens';

interface Column {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'right';
}

interface DataGridProps {
  columns: Column[];
  rows: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  onRowDoubleClick?: (row: Record<string, any>) => void;
  selectedId?: string | number;
  idKey?: string;
  style?: React.CSSProperties;
  rowStyle?: (row: Record<string, any>, i: number) => React.CSSProperties;
}

type SortDir = 'asc' | 'desc' | null;

export const DataGrid: React.FC<DataGridProps> = ({
  columns, rows, onRowClick, onRowDoubleClick, selectedId, idKey = 'id', style, rowStyle,
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [hoverId, setHoverId] = useState<string | number | null>(null);

  const handleHeaderClick = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey !== key) { setSortKey(key); setSortDir('desc'); return; }
    if (sortDir === 'desc') { setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir(null); setSortKey(null); }
  };

  const sorted = [...rows].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const av = a[sortKey], bv = b[sortKey];
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av ?? '').localeCompare(String(bv ?? ''));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const gridTemplate = columns.map(c => c.width ?? '1fr').join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.medium}`,
        flexShrink: 0,
      }}>
        {columns.map(col => (
          <div
            key={col.key}
            onClick={() => handleHeaderClick(col.key, col.sortable)}
            style={{
              padding: '4px 6px',
              fontSize: '7px',
              fontWeight: 700,
              fontFamily: T.font.mono,
              letterSpacing: 0.6,
              color: sortKey === col.key ? T.text.amber : T.text.muted,
              textAlign: col.align ?? 'left',
              borderRight: `1px solid ${T.border.subtle}`,
              cursor: col.sortable ? 'pointer' : 'default',
              userSelect: 'none',
              textTransform: 'uppercase',
            }}
          >
            {col.label}{col.sortable && sortKey === col.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: T.fontSize.sm, color: T.text.muted, fontFamily: T.font.mono }}>
            No data
          </div>
        ) : (
          sorted.map((row, i) => {
            const id = row[idKey];
            const isSelected = id === selectedId;
            const isHovered = id === hoverId;
            return (
              <div
                key={id ?? i}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
                onMouseEnter={() => setHoverId(id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridTemplate,
                  background: isSelected ? T.bg.active : isHovered ? T.bg.hover : i % 2 === 0 ? T.bg.panel : T.bg.panelAlt,
                  borderBottom: `1px solid ${T.border.subtle}`,
                  borderLeft: isSelected ? `2px solid ${T.text.amber}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  ...(rowStyle ? rowStyle(row, i) : {}),
                }}
              >
                {columns.map(col => (
                  <div
                    key={col.key}
                    style={{
                      padding: '3px 6px',
                      fontSize: T.fontSize.lg,
                      fontFamily: T.font.mono,
                      color: T.text.primary,
                      textAlign: col.align ?? 'left',
                      borderRight: `1px solid ${T.border.subtle}`,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row[col.key] ?? '—'}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
