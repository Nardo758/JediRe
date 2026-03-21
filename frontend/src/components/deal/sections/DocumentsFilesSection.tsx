/**
 * Unified Documents & Files Section
 * Intelligent module that adapts for Pipeline (pre-purchase) vs Assets Owned (post-purchase)
 * Features: Grid/List/Folder views, drag & drop upload, version control, smart categorization
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { FileUpload } from './DocumentsFiles/FileUpload';
import { GridView } from './DocumentsFiles/GridView';
import { ListView } from './DocumentsFiles/ListView';
import { FolderView } from './DocumentsFiles/FolderView';
import { SearchFilters } from './DocumentsFiles/SearchFilters';
import { StorageStats } from './DocumentsFiles/StorageStats';
import { MissingFileSuggestions } from './DocumentsFiles/MissingFileSuggestions';
import { apiClient as axios } from '../../../services/api.client';
import { useDealType } from '../../../stores/dealStore';
import { MODULE_TABS } from '@/shared/config/deal-type-visibility';

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
  const dealType = useDealType();

  // Get allowed document categories for this deal type
  const allowedCategories = useMemo(() => {
    const m18 = MODULE_TABS.find(t => t.moduleId === 'M18');
    const variant = m18?.variants?.[dealType];
    if (variant?.documentCategories) {
      return variant.documentCategories;
    }
    return []; // Will allow all categories if not specified
  }, [dealType]);

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

        // Filter categories based on deal type variant
        let availableCategories = statsResponse.data.available_categories || [];
        if (allowedCategories.length > 0) {
          availableCategories = availableCategories.filter((cat: string) =>
            allowedCategories.includes(cat)
          );
        }
        setCategories(availableCategories);
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
          padding: 20px;
          background: #0F1319;
          border-radius: 0;
          box-shadow: none;
          color: #C8D8E8;
          font-family: 'IBM Plex Mono', 'Courier New', monospace;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #1E2D3D;
        }

        .header-left h2 {
          margin: 0 0 2px 0;
          font-size: 13px;
          font-weight: 700;
          color: #C8D8E8;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-family: 'IBM Plex Mono', 'Courier New', monospace;
        }

        .context-label {
          margin: 0;
          font-size: 10px;
          color: #5A6A7A;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .btn-primary {
          padding: 6px 14px;
          background: transparent;
          color: #4A9EFF;
          border: 1px solid #4A9EFF;
          border-radius: 2px;
          font-weight: 600;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: 'IBM Plex Mono', 'Courier New', monospace;
          transition: all 0.15s;
        }

        .btn-primary:hover {
          background: #4A9EFF22;
        }

        .view-mode-selector {
          display: flex;
          gap: 2px;
          margin: 12px 0;
          padding: 0;
          background: transparent;
          border-radius: 0;
          width: fit-content;
          border-bottom: 1px solid #1E2D3D;
        }

        .view-mode-selector button {
          padding: 6px 14px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          border-radius: 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #5A6A7A;
          cursor: pointer;
          font-family: 'IBM Plex Mono', 'Courier New', monospace;
          transition: all 0.15s;
          margin-bottom: -1px;
        }

        .view-mode-selector button.active {
          background: transparent;
          color: #C8D8E8;
          border-bottom: 2px solid #4A9EFF;
        }

        .view-mode-selector button:hover:not(.active) {
          color: #8A9EAE;
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
          width: 32px;
          height: 32px;
          border: 2px solid #1E2D3D;
          border-top-color: #4A9EFF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.3;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #C8D8E8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          color: #5A6A7A;
          max-width: 400px;
          font-size: 11px;
        }

        .error-state p {
          color: #E85555;
          margin-bottom: 16px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};
