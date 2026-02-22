/**
 * Grid View Component
 * Visual cards with thumbnails, category badges, quick actions
 */

import React from 'react';
import { DealFile } from '../DocumentsFilesSection';
import { formatFileSize, getFileIcon, formatDate } from './utils';

interface GridViewProps {
  files: DealFile[];
  onDelete: (fileId: string) => void;
  onDownload: (file: DealFile) => void;
  onUpdate: (fileId: string, updates: Partial<DealFile>) => void;
  isPipeline: boolean;
}

export const GridView: React.FC<GridViewProps> = ({
  files,
  onDelete,
  onDownload,
  onUpdate,
  isPipeline,
}) => {
  return (
    <div className="grid-view">
      {files.map((file) => (
        <div key={file.id} className="file-card">
          {/* Thumbnail */}
          <div className="file-thumbnail">
            {file.mime_type?.startsWith('image/') ? (
              <img
                src={`/api/v1/deals/${file.deal_id}/files/${file.id}/download`}
                alt={file.original_filename}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={file.mime_type?.startsWith('image/') ? 'hidden file-icon-fallback' : 'file-icon-fallback'}>
              {getFileIcon(file.file_extension)}
            </div>
          </div>

          {/* File Info */}
          <div className="file-details">
            <h4 className="file-name" title={file.original_filename}>
              {file.original_filename}
            </h4>

            <div className="file-meta">
              <span className={`category-badge category-${file.category}`}>
                {file.category.replace(/-/g, ' ')}
              </span>
              <span className="file-size">{formatFileSize(file.file_size)}</span>
            </div>

            <p className="file-date">{formatDate(file.created_at)}</p>

            {file.version > 1 && (
              <span className="version-badge">v{file.version}</span>
            )}

            {file.is_required && (
              <span className="required-badge">Required</span>
            )}

            {file.tags && file.tags.length > 0 && (
              <div className="file-tags">
                {file.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="tag">
                    {tag}
                  </span>
                ))}
                {file.tags.length > 3 && (
                  <span className="tag-more">+{file.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="file-actions">
            <button
              onClick={() => onDownload(file)}
              className="action-btn download"
              title="Download"
            >
              ⬇
            </button>
            <button
              onClick={() => onDelete(file.id)}
              className="action-btn delete"
              title="Delete"
            >
              🗑
            </button>
          </div>
        </div>
      ))}

      <style jsx>{`
        .grid-view {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .file-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s;
          position: relative;
        }

        .file-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .file-thumbnail {
          width: 100%;
          height: 180px;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .file-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .file-icon-fallback {
          font-size: 64px;
          opacity: 0.5;
        }

        .hidden {
          display: none !important;
        }

        .file-details {
          padding: 16px;
        }

        .file-name {
          margin: 0 0 8px 0;
          font-size: 15px;
          font-weight: 600;
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .category-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          background: #e0e7ff;
          color: #3730a3;
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

        .file-size {
          font-size: 12px;
          color: #9ca3af;
        }

        .file-date {
          margin: 0;
          font-size: 12px;
          color: #6b7280;
        }

        .version-badge,
        .required-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          margin-top: 8px;
          margin-right: 4px;
        }

        .version-badge {
          background: #e0e7ff;
          color: #4338ca;
        }

        .required-badge {
          background: #fef3c7;
          color: #92400e;
        }

        .file-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }

        .tag {
          padding: 2px 8px;
          background: #f3f4f6;
          color: #6b7280;
          border-radius: 8px;
          font-size: 11px;
        }

        .tag-more {
          padding: 2px 8px;
          background: #e5e7eb;
          color: #6b7280;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .file-actions {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .file-card:hover .file-actions {
          opacity: 1;
        }

        .action-btn {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .action-btn:hover {
          transform: scale(1.1);
        }

        .action-btn.download:hover {
          background: #dbeafe;
        }

        .action-btn.delete:hover {
          background: #fee2e2;
        }
      `}</style>
    </div>
  );
};
