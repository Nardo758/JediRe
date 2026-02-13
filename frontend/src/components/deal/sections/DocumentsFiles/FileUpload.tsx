/**
 * File Upload Component
 * Drag & drop upload with progress, auto-categorization preview, version detection
 */

import React, { useState, useCallback } from 'react';
import { DealFile } from '../DocumentsFilesSection';
import axios from 'axios';

interface FileUploadProps {
  dealId: string;
  categories: string[];
  currentFolder: string;
  isPipeline: boolean;
  onUploadComplete: (files: DealFile[]) => void;
  onClose: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  suggestedCategory?: string;
  confidence?: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  dealId,
  categories,
  currentFolder,
  isPipeline,
  onUploadComplete,
  onClose,
}) => {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadingFiles: UploadingFile[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...uploadingFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();

    files.forEach((f) => {
      formData.append('files', f.file);
    });

    if (selectedCategory) formData.append('category', selectedCategory);
    if (currentFolder) formData.append('folderPath', currentFolder);
    if (tags) formData.append('tags', JSON.stringify(tags.split(',').map((t) => t.trim())));
    if (description) formData.append('description', description);

    try {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'uploading' as const }))
      );

      const response = await axios.post(
        `/api/v1/deals/${dealId}/files`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;

            setFiles((prev) =>
              prev.map((f) => ({ ...f, progress: percentCompleted }))
            );
          },
        }
      );

      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'complete' as const, progress: 100 }))
      );

      // Notify parent
      onUploadComplete(response.data.files);

      // Reset form
      setTimeout(() => {
        setFiles([]);
        setSelectedCategory('');
        setTags('');
        setDescription('');
      }, 1000);
    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error' as const,
          error: error.message || 'Upload failed',
        }))
      );
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="file-upload">
      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <div className="upload-icon">📤</div>
          <p className="primary-text">
            Drag & drop files here, or{' '}
            <label className="file-input-label">
              browse
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
          </p>
          <p className="secondary-text">
            Max 50 MB per file • PDF, Images, Excel, Word, PowerPoint
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, idx) => (
            <div key={idx} className={`file-item status-${f.status}`}>
              <div className="file-info">
                <span className="file-name">{f.file.name}</span>
                <span className="file-size">
                  {(f.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              {f.status === 'uploading' && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              )}

              {f.status === 'complete' && (
                <span className="status-badge success">✓ Uploaded</span>
              )}

              {f.status === 'error' && (
                <span className="status-badge error">✗ {f.error}</span>
              )}

              {f.status === 'pending' && (
                <button
                  className="remove-btn"
                  onClick={() => removeFile(idx)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      {files.length > 0 && files.some((f) => f.status === 'pending') && (
        <div className="upload-options">
          <div className="option-group">
            <label>Category (Optional)</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div className="option-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. important, financial, 2024"
            />
          </div>

          <div className="option-group full-width">
            <label>Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about these files..."
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && files.some((f) => f.status === 'pending') && (
        <div className="upload-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleUpload}>
            Upload {files.length} File{files.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .file-upload {
          margin: 20px 0;
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px dashed #d1d5db;
        }

        .drop-zone {
          padding: 40px;
          background: white;
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          text-align: center;
          transition: all 0.3s;
          cursor: pointer;
        }

        .drop-zone.dragging {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .primary-text {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #374151;
        }

        .file-input-label {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }

        .secondary-text {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .file-list {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .file-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .file-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .file-name {
          font-weight: 500;
          color: #1f2937;
        }

        .file-size {
          font-size: 12px;
          color: #9ca3af;
        }

        .progress-bar {
          width: 200px;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #2563eb;
          transition: width 0.3s;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.success {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .remove-btn {
          padding: 4px 8px;
          background: #fee2e2;
          color: #991b1b;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .upload-options {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .option-group.full-width {
          grid-column: 1 / -1;
        }

        .option-group label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .option-group select,
        .option-group input,
        .option-group textarea {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
        }

        .upload-actions {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
};
