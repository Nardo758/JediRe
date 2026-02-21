/**
 * Unified Documents & Files Section
 * Intelligent module that adapts for Pipeline (pre-purchase) vs Assets Owned (post-purchase)
 * Features: Grid/List/Folder views, drag & drop upload, version control, smart categorization
 */

import React, { useState, useEffect } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { FileUpload } from './DocumentsFiles/FileUpload';
import { GridView } from './DocumentsFiles/GridView';
import { ListView } from './DocumentsFiles/ListView';
import { FolderView } from './DocumentsFiles/FolderView';
import { SearchFilters } from './DocumentsFiles/SearchFilters';
import { StorageStats } from './DocumentsFiles/StorageStats';
import { MissingFileSuggestions } from './DocumentsFiles/MissingFileSuggestions';
import axios from 'axios';

// ============================================================================
// TYPES
// ============================================================================

export interface DealFile {
  id: string;
  deal_id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_extension: string;
  category: string;
  folder_path: string;
  tags: string[];
  version: number;
  parent_file_id: string | null;
  is_latest_version: boolean;
  version_notes: string | null;
  status: 'draft' | 'final' | 'archived' | 'expired' | 'pending-review';
  is_required: boolean;
  expiration_date: string | null;
  description: string | null;
  auto_category_confidence: number | null;
  extracted_text: string | null;
  thumbnail_path: string | null;
  uploaded_by: string;
  shared_with: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StorageAnalytics {
  total_files: number;
  total_size_bytes: number;
  files_by_category: Record<string, number>;
  size_by_category: Record<string, number>;
  total_versions: number;
  files_with_versions: number;
  files_uploaded_last_7d: number;
  files_uploaded_last_30d: number;
  required_files_count: number;
  expired_files_count: number;
}

interface DocumentsFilesSectionProps {
  deal: Deal;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DocumentsFilesSection: React.FC<DocumentsFilesSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);

  // State
  const [files, setFiles] = useState<DealFile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'folder'>('grid');
  const [currentFolder, setCurrentFolder] = useState('/');

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [deal.id, selectedCategory, selectedStatus, searchQuery, currentFolder]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filter params
      const params: any = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      if (viewMode === 'folder' && currentFolder !== '/') params.folderPath = currentFolder;

      // Fetch files
      const filesResponse = await axios.get(`/api/v1/deals/${deal.id}/files`, { params });
      setFiles(filesResponse.data.files || []);

      // Fetch stats (only once)
      if (!analytics) {
        const statsResponse = await axios.get(`/api/v1/deals/${deal.id}/files/stats`);
        setAnalytics(statsResponse.data.analytics);
        setSuggestions(statsResponse.data.missing_file_suggestions || []);
        setCategories(statsResponse.data.available_categories || []);
      }
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleUploadComplete = (uploadedFiles: DealFile[]) => {
    setFiles((prev) => [...uploadedFiles, ...prev]);
    setShowUpload(false);
    loadData(); // Refresh analytics
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await axios.delete(`/api/v1/deals/${deal.id}/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      loadData(); // Refresh analytics
    } catch (err: any) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const handleDownload = async (file: DealFile) => {
    try {
      const response = await axios.get(
        `/api/v1/deals/${deal.id}/files/${file.id}/download`,
        {
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Failed to download file: ' + err.message);
    }
  };

  const handleUpdate = async (fileId: string, updates: Partial<DealFile>) => {
    try {
      await axios.put(`/api/v1/deals/${deal.id}/files/${fileId}`, updates);
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
      );
    } catch (err: any) {
      alert('Failed to update file: ' + err.message);
    }
  };

  const handleFolderChange = (path: string) => {
    setCurrentFolder(path);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="documents-files-section">
      {/* Header */}
      <div className="section-header">
        <div className="header-left">
          <h2>
            {isPipeline ? '📋 Documents & Files' : '📁 Asset Documents'}
          </h2>
          <p className="context-label">
            {isPipeline ? 'Acquisition & Due Diligence' : 'Operations & Compliance'}
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? '✕ Close' : '⬆ Upload Files'}
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      {analytics && (
        <StorageStats
          analytics={analytics}
          isPipeline={isPipeline}
        />
      )}

      {/* Missing File Suggestions */}
      {suggestions.length > 0 && (
        <MissingFileSuggestions
          suggestions={suggestions}
          onUploadClick={() => setShowUpload(true)}
        />
      )}

      {/* Upload Area */}
      {showUpload && (
        <FileUpload
          dealId={deal.id}
          categories={categories}
          currentFolder={currentFolder}
          isPipeline={isPipeline}
          onUploadComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Search & Filters */}
      <SearchFilters
        categories={categories}
        selectedCategory={selectedCategory}
        selectedStatus={selectedStatus}
        searchQuery={searchQuery}
        selectedTags={selectedTags}
        onCategoryChange={setSelectedCategory}
        onStatusChange={setSelectedStatus}
        onSearchChange={setSearchQuery}
        onTagsChange={setSelectedTags}
      />

      {/* View Mode Selector */}
      <div className="view-mode-selector">
        <button
          className={viewMode === 'grid' ? 'active' : ''}
          onClick={() => setViewMode('grid')}
          title="Grid View"
        >
          ▦ Grid
        </button>
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
          title="List View"
        >
          ☰ List
        </button>
        <button
          className={viewMode === 'folder' ? 'active' : ''}
          onClick={() => setViewMode('folder')}
          title="Folder View"
        >
          📁 Folders
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading files...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>⚠️ {error}</p>
          <button onClick={loadData}>Retry</button>
        </div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No files yet</h3>
          <p>
            {isPipeline
              ? 'Upload acquisition documents, financials, and due diligence reports'
              : 'Upload lease agreements, financial statements, and property media'}
          </p>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            Upload Your First File
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' && (
            <GridView
              files={files}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onUpdate={handleUpdate}
              isPipeline={isPipeline}
            />
          )}

          {viewMode === 'list' && (
            <ListView
              files={files}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onUpdate={handleUpdate}
              isPipeline={isPipeline}
            />
          )}

          {viewMode === 'folder' && (
            <FolderView
              files={files}
              currentFolder={currentFolder}
              onFolderChange={handleFolderChange}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onUpdate={handleUpdate}
              isPipeline={isPipeline}
            />
          )}
        </>
      )}

      {/* Styles */}
      <style jsx>{`
        .documents-files-section {
          padding: 24px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-left h2 {
          margin: 0 0 4px 0;
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .context-label {
          margin: 0;
          font-size: 14px;
          color: #666;
        }

        .btn-primary {
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }

        .view-mode-selector {
          display: flex;
          gap: 8px;
          margin: 20px 0;
          padding: 4px;
          background: #f3f4f6;
          border-radius: 8px;
          width: fit-content;
        }

        .view-mode-selector button {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-mode-selector button.active {
          background: white;
          color: #2563eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .view-mode-selector button:hover:not(.active) {
          color: #374151;
        }

        .loading-state,
        .error-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a1a1a;
        }

        .empty-state p {
          margin: 0 0 24px 0;
          color: #6b7280;
          max-width: 400px;
        }

        .error-state p {
          color: #dc2626;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
};
