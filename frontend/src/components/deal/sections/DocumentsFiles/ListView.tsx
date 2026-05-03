/**
 * List View Component
 * Sortable table with bulk selection and version history column
 */

import React, { useState } from 'react';
import { DealFile } from '../DocumentsFilesSection';
import { formatFileSize, getFileIcon, formatDate } from './utils';

const ExtractionBadge: React.FC<{ file: DealFile }> = ({ file }) => {
  if (!file.extraction_status) return <span style={{ color: '#9ca3af' }}>—</span>;
  const status = file.extraction_status;
  const labels: Record<string, string> = {
    queued: 'Queued',
    running: 'Extracting…',
    done: 'Extracted',
    failed: 'Failed',
    skipped: 'Skipped',
  };
  const tooltip =
    status === 'failed'
      ? file.extraction_error || 'Extraction failed'
      : status === 'done' && file.extraction_skill
      ? `via ${file.extraction_skill}`
      : status === 'running' && file.extraction_skill
      ? `running ${file.extraction_skill}`
      : labels[status];
  return (
    <span className={`ext-badge ext-${status}`} title={tooltip}>
      {status === 'running' && <span className="ext-spinner" />}
      {labels[status]}
    </span>
  );
};

interface ListViewProps {
  files: DealFile[];
  onDelete: (fileId: string) => void;
  onDownload: (file: DealFile) => void;
  onUpdate: (fileId: string, updates: Partial<DealFile>) => void;
  /** Task #517 — re-run extraction pipeline for a single file. */
  onReextract?: (fileId: string) => void;
  isPipeline: boolean;
}

export const ListView: React.FC<ListViewProps> = ({
  files,
  onDelete,
  onDownload,
  onUpdate,
  onReextract,
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let aVal, bVal;

    switch (sortBy) {
      case 'name':
        aVal = a.original_filename.toLowerCase();
        bVal = b.original_filename.toLowerCase();
        break;
      case 'size':
        aVal = a.file_size;
        bVal = b.file_size;
        break;
      case 'category':
        aVal = a.category;
        bVal = b.category;
        break;
      case 'date':
      default:
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.id)));
    }
  };

  return (
    <div className="list-view">
      {selected.size > 0 && (
        <div className="bulk-actions">
          <span>{selected.size} selected</span>
          <button onClick={() => {
            selected.forEach(id => onDelete(id));
            setSelected(new Set());
          }}>
            Delete Selected
          </button>
        </div>
      )}

      <table className="files-table">
        <thead>
          <tr>
            <th className="checkbox-col">
              <input
                type="checkbox"
                checked={selected.size === files.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th className="icon-col"></th>
            <th className="name-col sortable" onClick={() => handleSort('name')}>
              Name {sortBy === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th className="category-col sortable" onClick={() => handleSort('category')}>
              Category {sortBy === 'category' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th className="size-col sortable" onClick={() => handleSort('size')}>
              Size {sortBy === 'size' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th className="date-col sortable" onClick={() => handleSort('date')}>
              Modified {sortBy === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
            </th>
            <th className="version-col">Version</th>
            <th className="extract-col">Extraction</th>
            <th className="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file) => (
            <tr key={file.id} className={selected.has(file.id) ? 'selected' : ''}>
              <td className="checkbox-col">
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                />
              </td>
              <td className="icon-col">{getFileIcon(file.file_extension)}</td>
              <td className="name-col">
                <div className="file-name-cell">
                  <span className="file-name">{file.original_filename}</span>
                  {file.is_required && <span className="required-badge">Required</span>}
                </div>
              </td>
              <td className="category-col">
                <span className={`category-badge category-${file.category}`}>
                  {file.category.replace(/-/g, ' ')}
                </span>
              </td>
              <td className="size-col">{formatFileSize(file.file_size)}</td>
              <td className="date-col">{formatDate(file.created_at)}</td>
              <td className="version-col">
                {file.version > 1 ? `v${file.version}` : '—'}
              </td>
              <td className="extract-col">
                <ExtractionBadge file={file} />
              </td>
              <td className="actions-col">
                <button onClick={() => onDownload(file)} className="action-btn" title="Download">
                  ⬇
                </button>
                {onReextract && (
                  <button
                    onClick={() => onReextract(file.id)}
                    className="action-btn reextract"
                    title={
                      file.extraction_status === 'queued' || file.extraction_status === 'running'
                        ? 'Extraction already in progress'
                        : 'Re-extract this file'
                    }
                    disabled={file.extraction_status === 'queued' || file.extraction_status === 'running'}
                  >
                    ⟳
                  </button>
                )}
                <button onClick={() => onDelete(file.id)} className="action-btn delete" title="Delete">
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style jsx>{`
        .list-view {
          margin-top: 20px;
        }

        .bulk-actions {
          padding: 12px 16px;
          background: #eff6ff;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .bulk-actions button {
          padding: 8px 16px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .files-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .files-table thead {
          background: #f9fafb;
        }

        .files-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          color: #6b7280;
          border-bottom: 2px solid #e5e7eb;
        }

        .files-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .files-table th.sortable:hover {
          color: #2563eb;
        }

        .files-table tbody tr {
          border-bottom: 1px solid #e5e7eb;
          transition: background 0.2s;
        }

        .files-table tbody tr:hover {
          background: #f9fafb;
        }

        .files-table tbody tr.selected {
          background: #eff6ff;
        }

        .files-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #1f2937;
        }

        .checkbox-col {
          width: 40px;
        }

        .icon-col {
          width: 50px;
          font-size: 24px;
        }

        .name-col {
          min-width: 250px;
        }

        .file-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .file-name {
          font-weight: 500;
        }

        .required-badge {
          padding: 2px 8px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
        }

        .category-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          display: inline-block;
        }

        .category-acquisition {
          background: #dbeafe;
          color: #1e40af;
        }

        .category-financial,
        .category-financial-analysis {
          background: #d1fae5;
          color: #065f46;
        }

        .category-due-diligence {
          background: #fef3c7;
          color: #92400e;
        }

        .category-legal {
          background: #fce7f3;
          color: #9f1239;
        }

        .category-col {
          width: 150px;
        }

        .size-col,
        .version-col {
          width: 100px;
        }

        .date-col {
          width: 150px;
        }

        .actions-col {
          width: 100px;
        }

        .action-btn {
          padding: 6px 10px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #f3f4f6;
        }

        .action-btn.delete:hover {
          background: #fee2e2;
        }

        .extract-col {
          width: 130px;
        }

        .ext-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          border: 1px solid transparent;
        }
        .ext-queued {
          background: #f3f4f6;
          color: #4b5563;
          border-color: #e5e7eb;
        }
        .ext-running {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        .ext-done {
          background: #d1fae5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .ext-failed {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .ext-skipped {
          background: #f5f5f4;
          color: #78716c;
          border-color: #e7e5e4;
        }
        .ext-spinner {
          width: 8px;
          height: 8px;
          border: 2px solid #1d4ed8;
          border-top-color: transparent;
          border-radius: 50%;
          animation: ext-spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes ext-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
