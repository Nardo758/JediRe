/**
 * DataGrid Component
 * Theme-aware reusable grid with sorting, filtering, and export
 */

import React, { useState } from 'react';
import { ColumnDef, GridSort } from '../../types/grid';
import { useTheme } from '../../contexts/ThemeContext';

// ─── Theme Tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg: {
    page: '#0A0E17',
    panel: '#0F1319',
    header: '#1A1F2E',
    row: '#0F1319',
    rowAlt: '#131821',
    rowHover: '#1E2538',
  },
  text: {
    primary: '#E8ECF1',
    secondary: '#8B95A5',
    muted: '#4A5568',
    accent: '#F5A623',
    link: '#00BCD4',
  },
  border: {
    subtle: '#1E2538',
    medium: '#2A3348',
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  },
};

const LIGHT = {
  bg: {
    page: '#F8FAFC',
    panel: '#FFFFFF',
    header: '#F1F5F9',
    row: '#FFFFFF',
    rowAlt: '#F8FAFC',
    rowHover: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    accent: '#D97706',
    link: '#0284C7',
  },
  border: {
    subtle: '#E2E8F0',
    medium: '#CBD5E1',
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  },
};

interface DataGridProps {
  columns: ColumnDef[];
  data: any[];
  onRowClick?: (row: any) => void;
  onSort?: (sort: GridSort) => void;
  onExport?: () => void;
  loading?: boolean;
  className?: string;
}

export function DataGrid({
  columns,
  data,
  onRowClick,
  onSort,
  onExport,
  loading = false,
  className = ''
}: DataGridProps) {
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  const isDark = theme === 'dark';
  
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const handleSort = (columnKey: string) => {
    const newDirection = sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort?.({ column: columnKey, direction: newDirection });
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const styles = {
    container: {
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
    },
    header: {
      padding: '12px 16px',
      borderBottom: `1px solid ${T.border.subtle}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: T.bg.header,
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: T.text.primary,
      fontFamily: T.font.mono,
      letterSpacing: 0.5,
    },
    exportButton: {
      padding: '6px 12px',
      background: T.text.accent,
      color: isDark ? '#0A0E17' : '#FFFFFF',
      border: 'none',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.font.mono,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      letterSpacing: 0.5,
    },
    tableWrapper: {
      flex: 1,
      overflowX: 'auto' as const,
      overflowY: 'auto' as const,
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontFamily: T.font.mono,
    },
    th: (sortable: boolean, align?: string) => ({
      padding: '10px 12px',
      fontSize: 9,
      fontWeight: 700,
      color: T.text.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      textAlign: (align || 'left') as 'left' | 'right' | 'center',
      borderBottom: `1px solid ${T.border.medium}`,
      background: T.bg.header,
      cursor: sortable ? 'pointer' : 'default',
      userSelect: 'none' as const,
      whiteSpace: 'nowrap' as const,
      position: 'sticky' as const,
      top: 0,
      zIndex: 1,
    }),
    thContent: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    sortIcon: (active: boolean) => ({
      color: active ? T.text.accent : T.text.muted,
      fontSize: 10,
    }),
    td: (align?: string) => ({
      padding: '10px 12px',
      fontSize: 11,
      color: T.text.primary,
      textAlign: (align || 'left') as 'left' | 'right' | 'center',
      borderBottom: `1px solid ${T.border.subtle}`,
      whiteSpace: 'nowrap' as const,
    }),
    row: (index: number, hovered: boolean) => ({
      background: hovered ? T.bg.rowHover : (index % 2 === 0 ? T.bg.row : T.bg.rowAlt),
      cursor: onRowClick ? 'pointer' : 'default',
      transition: 'background 0.1s',
    }),
    emptyState: {
      padding: 48,
      textAlign: 'center' as const,
      background: T.bg.panel,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
      opacity: 0.5,
    },
    emptyTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: T.text.primary,
      marginBottom: 8,
      fontFamily: T.font.mono,
    },
    emptyText: {
      fontSize: 11,
      color: T.text.secondary,
      fontFamily: T.font.mono,
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 64,
      gap: 16,
    },
    spinner: {
      width: 32,
      height: 32,
      border: `2px solid ${T.border.subtle}`,
      borderTop: `2px solid ${T.text.accent}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
    loadingText: {
      fontSize: 11,
      color: T.text.secondary,
      fontFamily: T.font.mono,
    },
    nullValue: {
      color: T.text.muted,
    },
  };

  if (loading) {
    return (
      <div style={styles.container} className={className}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>LOADING DATA...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className={className}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          {data.length} {data.length === 1 ? 'RESULT' : 'RESULTS'}
        </span>
        {onExport && (
          <button onClick={onExport} style={styles.exportButton}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            EXPORT CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ ...styles.th(!!col.sortable, col.align), width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div style={styles.thContent}>
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span style={styles.sortIcon(sortColumn === col.key)}>
                        {sortColumn === col.key ? (
                          sortDirection === 'asc' ? '▲' : '▼'
                        ) : '○'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                onClick={() => onRowClick?.(row)}
                onMouseEnter={() => setHoveredRow(index)}
                onMouseLeave={() => setHoveredRow(null)}
                style={styles.row(index, hoveredRow === index)}
              >
                {columns.map((col) => {
                  const value = row[col.key];
                  
                  return (
                    <td key={col.key} style={styles.td(col.align)}>
                      {col.render
                        ? col.render(value, row)
                        : col.format
                        ? col.format(value)
                        : value !== null && value !== undefined
                        ? value
                        : <span style={styles.nullValue}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <h3 style={styles.emptyTitle}>NO DATA FOUND</h3>
          <p style={styles.emptyText}>Try adjusting your filters or create a new item.</p>
        </div>
      )}
    </div>
  );
}

export default DataGrid;
