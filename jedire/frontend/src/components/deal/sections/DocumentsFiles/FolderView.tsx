/**
 * Folder View Component
 * Hierarchical folder navigation with breadcrumb trail
 */

import React from 'react';
import { DealFile } from '../DocumentsFilesSection';
import { formatFileSize, getFileIcon, formatDate } from './utils';

interface FolderViewProps {
  files: DealFile[];
  currentFolder: string;
  onFolderChange: (path: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (file: DealFile) => void;
  onUpdate: (fileId: string, updates: Partial<DealFile>) => void;
  isPipeline: boolean;
}

export const FolderView: React.FC<FolderViewProps> = ({
  files,
  currentFolder,
  onFolderChange,
  onDelete,
  onDownload,
}) => {
  // Get folders in current path
  const folders = Array.from(
    new Set(
      files
        .filter((f) => f.folder_path.startsWith(currentFolder) && f.folder_path !== currentFolder)
        .map((f) => {
          const relativePath = f.folder_path.substring(currentFolder.length).replace(/^\//, '');
          const parts = relativePath.split('/');
          return parts[0];
        })
        .filter(Boolean)
    )
  );

  // Get files in current folder
  const currentFiles = files.filter((f) => f.folder_path === currentFolder);

  // Breadcrumb navigation
  const pathParts = currentFolder.split('/').filter(Boolean);
  const breadcrumbs = ['Home', ...pathParts];

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      onFolderChange('/');
    } else {
      onFolderChange('/' + pathParts.slice(0, index).join('/'));
    }
  };

  return (
    <div className="folder-view">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        {breadcrumbs.map((part, index) => (
          <React.Fragment key={index}>
            <button
              className={index === breadcrumbs.length - 1 ? 'active' : ''}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {part}
            </button>
            {index < breadcrumbs.length - 1 && <span className="separator">/</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="folders-grid">
          {folders.map((folder) => (
            <div
              key={folder}
              className="folder-card"
              onClick={() => {
                const newPath = currentFolder === '/' ? `/${folder}` : `${currentFolder}/${folder}`;
                onFolderChange(newPath);
              }}
            >
              <div className="folder-icon">📁</div>
              <span className="folder-name">{folder}</span>
              <span className="folder-count">
                {files.filter((f) => f.folder_path.startsWith(currentFolder + '/' + folder)).length} files
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Files */}
      {currentFiles.length > 0 && (
        <div className="files-list">
          <h4>Files</h4>
          {currentFiles.map((file) => (
            <div key={file.id} className="file-row">
              <div className="file-icon">{getFileIcon(file.file_extension)}</div>
              <div className="file-info">
                <span className="file-name">{file.original_filename}</span>
                <span className="file-meta">
                  {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                </span>
              </div>
              <div className="file-actions">
                <button onClick={() => onDownload(file)} title="Download">⬇</button>
                <button onClick={() => onDelete(file.id)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {folders.length === 0 && currentFiles.length === 0 && (
        <div className="empty-folder">
          <div className="empty-icon">📂</div>
          <p>This folder is empty</p>
        </div>
      )}

      <style jsx>{`
        .folder-view {
          margin-top: 20px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .breadcrumb button {
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #2563eb;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .breadcrumb button:hover {
          background: #e0e7ff;
        }

        .breadcrumb button.active {
          color: #1f2937;
          cursor: default;
        }

        .breadcrumb button.active:hover {
          background: transparent;
        }

        .separator {
          color: #9ca3af;
        }

        .folders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .folder-card {
          padding: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .folder-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
          border-color: #2563eb;
        }

        .folder-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .folder-name {
          display: block;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .folder-count {
          display: block;
          font-size: 13px;
          color: #6b7280;
        }

        .files-list h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #6b7280;
        }

        .file-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 8px;
          transition: all 0.2s;
        }

        .file-row:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }

        .file-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .file-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-name {
          font-weight: 500;
          color: #1f2937;
        }

        .file-meta {
          font-size: 13px;
          color: #6b7280;
        }

        .file-actions {
          display: flex;
          gap: 8px;
        }

        .file-actions button {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 6px;
          background: #f3f4f6;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .file-actions button:hover {
          background: #e5e7eb;
        }

        .empty-folder {
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 64px;
          opacity: 0.3;
          margin-bottom: 16px;
        }

        .empty-folder p {
          color: #9ca3af;
          margin: 0;
        }
      `}</style>
    </div>
  );
};
