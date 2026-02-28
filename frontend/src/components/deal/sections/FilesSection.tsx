/**
 * Files & Documents Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode: DD files, contracts, financials, photos
 * - owned → Performance mode: Operational files, leases, reports, work orders
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { apiClient } from '../../../services/api.client';
import {
  acquisitionStats,
  acquisitionFolderStructure,
  acquisitionRecentFiles,
  performanceStats,
  performanceFolderStructure,
  performanceRecentFiles,
  quickActions,
  FileItem,
  FileStats,
  RecentFile,
  QuickAction,
  getFileIcon,
  formatFileSize,
  getStatusBadgeColor
} from '../../../data/filesMockData';

interface FilesSectionProps {
  deal: Deal;
}

interface ApiFile {
  id: string;
  deal_id: string;
  original_filename: string;
  filename: string;
  mime_type: string;
  file_size: number;
  category?: string;
  folder_path?: string;
  tags?: string[];
  description?: string;
  status?: string;
  is_required?: boolean;
  version?: number;
  uploaded_by?: string;
  uploaded_by_name?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

interface ApiStatsResponse {
  success: boolean;
  analytics?: {
    total_files?: number;
    total_size?: number;
    categories?: Record<string, number>;
    by_status?: Record<string, number>;
    recent_uploads?: number;
  };
  missing_file_suggestions?: any[];
  available_categories?: string[];
}

function mapMimeToFileType(mimeType: string): FileItem['fileType'] {
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('word') || mimeType?.includes('msword')) return 'doc';
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'xls';
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'jpg';
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('zip')) return 'zip';
  if (mimeType?.includes('text')) return 'txt';
  return 'pdf';
}

function mapApiFileToFileItem(apiFile: ApiFile): FileItem {
  const fileType = mapMimeToFileType(apiFile.mime_type || '');
  return {
    id: apiFile.id,
    name: apiFile.original_filename,
    type: 'file',
    fileType,
    size: apiFile.file_size,
    modified: apiFile.updated_at
      ? new Date(apiFile.updated_at).toLocaleDateString()
      : new Date().toLocaleDateString(),
    modifiedBy: apiFile.uploaded_by_name || 'Unknown',
    path: apiFile.folder_path ? apiFile.folder_path.split('/').filter(Boolean) : [],
    tags: apiFile.tags || [],
    status: (apiFile.status as FileItem['status']) || 'draft',
  };
}

function mapApiFilesToFolderStructure(apiFiles: ApiFile[]): FileItem[] {
  const folderMap = new Map<string, FileItem>();

  for (const apiFile of apiFiles) {
    const folderPath = apiFile.folder_path || '/';
    const parts = folderPath.split('/').filter(Boolean);

    if (parts.length === 0) {
      const rootFolder = folderMap.get('__root__') || {
        id: '__root__',
        name: 'Uploaded Files',
        type: 'folder' as const,
        modified: new Date().toLocaleDateString(),
        modifiedBy: 'System',
        path: ['Uploaded Files'],
        children: [],
      };
      rootFolder.children = rootFolder.children || [];
      rootFolder.children.push(mapApiFileToFileItem(apiFile));
      folderMap.set('__root__', rootFolder);
    } else {
      const topKey = parts[0];
      if (!folderMap.has(topKey)) {
        folderMap.set(topKey, {
          id: `folder-${topKey}`,
          name: topKey,
          type: 'folder',
          modified: new Date().toLocaleDateString(),
          modifiedBy: 'System',
          path: [topKey],
          children: [],
        });
      }
      const folder = folderMap.get(topKey)!;
      folder.children = folder.children || [];
      folder.children.push(mapApiFileToFileItem(apiFile));
    }
  }

  return Array.from(folderMap.values());
}

function mapApiStatsToFileStats(analytics: ApiStatsResponse['analytics']): FileStats[] {
  if (!analytics) return [];
  return [
    {
      label: 'Total Files',
      value: analytics.total_files || 0,
      icon: '📄',
      format: 'number',
    },
    {
      label: 'Storage Used',
      value: analytics.total_size
        ? formatFileSize(analytics.total_size)
        : '0 Bytes',
      icon: '💾',
      format: 'size',
    },
    {
      label: 'Categories',
      value: analytics.categories
        ? Object.keys(analytics.categories).length
        : 0,
      icon: '🏷️',
      format: 'number',
    },
    {
      label: 'Pending Review',
      value: analytics.by_status?.review || analytics.by_status?.draft || 0,
      icon: '⏱️',
      format: 'number',
    },
    {
      label: 'Recent Uploads',
      value: analytics.recent_uploads || 0,
      icon: '📤',
      format: 'number',
    },
  ];
}

function mapApiFilesToRecentFiles(apiFiles: ApiFile[]): RecentFile[] {
  return apiFiles
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((f) => ({
      id: f.id,
      name: f.original_filename,
      fileType: mapMimeToFileType(f.mime_type || '') || 'pdf',
      action: 'uploaded',
      timestamp: f.updated_at
        ? formatRelativeTime(new Date(f.updated_at))
        : 'recently',
      user: f.uploaded_by_name || 'Unknown',
    }));
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export const FilesSection: React.FC<FilesSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FileItem | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [liveFiles, setLiveFiles] = useState<ApiFile[]>([]);
  const [liveStats, setLiveStats] = useState<FileStats[] | null>(null);
  const [liveFolderStructure, setLiveFolderStructure] = useState<FileItem[] | null>(null);
  const [liveRecentFiles, setLiveRecentFiles] = useState<RecentFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dealId = (deal as any).id;

  const fetchFiles = useCallback(async () => {
    if (!dealId) return;
    try {
      setIsLoading(true);
      setError(null);

      const [filesRes, statsRes] = await Promise.all([
        apiClient.get(`/api/v1/deals/${dealId}/files`).catch(() => null),
        apiClient.get(`/api/v1/deals/${dealId}/files/stats`).catch(() => null),
      ]);

      const filesData = filesRes?.data;
      const statsData = statsRes?.data as ApiStatsResponse | undefined;

      if (filesData?.success && filesData.files && filesData.files.length > 0) {
        const apiFiles: ApiFile[] = filesData.files;
        setLiveFiles(apiFiles);
        setLiveFolderStructure(mapApiFilesToFolderStructure(apiFiles));
        setLiveRecentFiles(mapApiFilesToRecentFiles(apiFiles));
        setHasLiveData(true);
      } else {
        setHasLiveData(false);
      }

      if (statsData?.success && statsData.analytics) {
        setLiveStats(mapApiStatsToFileStats(statsData.analytics));
      }
    } catch (err: any) {
      console.warn('Files API not available, using mock data:', err?.message);
      setHasLiveData(false);
    } finally {
      setIsLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!dealId || !files || files.length === 0) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      formData.append('folderPath', currentPath.length > 0 ? '/' + currentPath.join('/') : '/');
      formData.append('status', 'draft');

      await apiClient.post(`/api/v1/deals/${dealId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchFiles();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!dealId) return;
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/files/${fileId}`);
      await fetchFiles();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err?.response?.data?.message || 'Delete failed');
    }
  };

  const handleDownloadFile = async (fileId: string, filename: string) => {
    if (!dealId) return;
    try {
      const response = await apiClient.get(
        `/api/v1/deals/${dealId}/files/${fileId}/download`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed:', err);
    }
  };

  const stats = liveStats || (isPipeline ? acquisitionStats : performanceStats);
  const folderStructure = hasLiveData && liveFolderStructure
    ? [...liveFolderStructure, ...(isPipeline ? acquisitionFolderStructure : performanceFolderStructure)]
    : (isPipeline ? acquisitionFolderStructure : performanceFolderStructure);
  const recentFiles = hasLiveData && liveRecentFiles
    ? liveRecentFiles
    : (isPipeline ? acquisitionRecentFiles : performanceRecentFiles);

  const navigateToFolder = (folder: FileItem) => {
    setSelectedFolder(folder);
    setCurrentPath(folder.path);
  };

  const navigateBack = () => {
    if (currentPath.length === 0) {
      setSelectedFolder(null);
      return;
    }

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);

    if (newPath.length === 0) {
      setSelectedFolder(null);
      return;
    }

    let currentFolder: FileItem | null = null;
    for (const rootFolder of folderStructure) {
      if (rootFolder.path[0] === newPath[0]) {
        currentFolder = rootFolder;
        for (let i = 1; i < newPath.length; i++) {
          const found = currentFolder?.children?.find(child => child.path[i] === newPath[i]);
          if (found) currentFolder = found;
        }
        break;
      }
    }
    setSelectedFolder(currentFolder);
  };

  const navigateToRoot = () => {
    setCurrentPath([]);
    setSelectedFolder(null);
  };

  const getCurrentFiles = (): FileItem[] => {
    if (!selectedFolder) {
      return folderStructure;
    }
    return selectedFolder.children || [];
  };

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '📋 Acquisition Files' : '📂 Property Files'}
          </div>

          {hasLiveData && (
            <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 animate-pulse">
              ● LIVE DATA
            </span>
          )}

          {isLoading && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Loading...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            ≡
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <StatsGrid stats={stats} />

      <QuickActionsBar actions={quickActions} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="lg:col-span-1">
          <FolderTreeCard 
            folders={folderStructure} 
            currentPath={currentPath}
            onNavigate={navigateToFolder}
          />
          
          <StorageCard mode={mode} />
        </div>

        <div className="lg:col-span-3 space-y-6">
          
          <FileBrowserCard
            files={getCurrentFiles()}
            viewMode={viewMode}
            currentPath={currentPath}
            onNavigate={navigateToFolder}
            onNavigateBack={navigateBack}
            onNavigateToRoot={navigateToRoot}
            hasLiveData={hasLiveData}
            onDelete={handleDeleteFile}
            onDownload={handleDownloadFile}
          />

          <UploadZoneCard
            isUploading={isUploading}
            onUpload={handleUploadFiles}
            fileInputRef={fileInputRef}
          />

          <RecentFilesCard
            files={recentFiles}
            hasLiveData={hasLiveData}
            onDownload={handleDownloadFile}
          />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
};

interface StatsGridProps {
  stats: FileStats[];
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">File Repository Overview</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
              {stat.trend && (
                <span className={`text-xs font-medium ${
                  stat.trend.direction === 'up' ? 'text-green-600' : 
                  stat.trend.direction === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {stat.trend.direction === 'up' ? '↑' : stat.trend.direction === 'down' ? '↓' : '→'} {stat.trend.value}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface QuickActionsBarProps {
  actions: QuickAction[];
}

const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ actions }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    orange: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3 flex-wrap">
        {actions.map((action) => (
          <button
            key={action.id}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${colorClasses[action.color]}`}
          >
            <span className="mr-2">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface FolderTreeCardProps {
  folders: FileItem[];
  currentPath: string[];
  onNavigate: (folder: FileItem) => void;
}

const FolderTreeCard: React.FC<FolderTreeCardProps> = ({ folders, currentPath, onNavigate }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderFolder = (folder: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isActive = currentPath.join('/') === folder.path.join('/');
    const hasChildren = folder.children && folder.children.length > 0;
    const folderChildren = folder.children?.filter(child => child.type === 'folder') || [];

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer hover:bg-gray-50 ${
            isActive ? 'bg-blue-50 text-blue-700 font-medium' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            if (hasChildren) toggleFolder(folder.id);
            onNavigate(folder);
          }}
        >
          {hasChildren && (
            <span className="text-xs text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          <span className="text-lg">📁</span>
          <span className="text-sm truncate flex-1">{folder.name}</span>
          {folder.children && (
            <span className="text-xs text-gray-400">
              {folder.children.length}
            </span>
          )}
        </div>
        {isExpanded && folderChildren.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Folders</h3>
      </div>
      <div className="p-2 max-h-96 overflow-y-auto">
        {folders.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
};

interface StorageCardProps {
  mode: string;
}

const StorageCard: React.FC<StorageCardProps> = ({ mode }) => {
  const usedStorage = mode === 'acquisition' ? 4.2 : 18.7;
  const totalStorage = 50;
  const percentage = (usedStorage / totalStorage) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Storage Usage</h3>
      
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              percentage < 50 ? 'bg-green-500' :
              percentage < 80 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{usedStorage} GB used</span>
        <span className="text-gray-900 font-medium">{totalStorage} GB total</span>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Documents</span>
          <span className="font-medium">{(usedStorage * 0.4).toFixed(1)} GB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Images</span>
          <span className="font-medium">{(usedStorage * 0.35).toFixed(1)} GB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Spreadsheets</span>
          <span className="font-medium">{(usedStorage * 0.15).toFixed(1)} GB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Other</span>
          <span className="font-medium">{(usedStorage * 0.1).toFixed(1)} GB</span>
        </div>
      </div>
    </div>
  );
};

interface FileBrowserCardProps {
  files: FileItem[];
  viewMode: 'grid' | 'list';
  currentPath: string[];
  onNavigate: (folder: FileItem) => void;
  onNavigateBack: () => void;
  onNavigateToRoot: () => void;
  hasLiveData?: boolean;
  onDelete?: (fileId: string) => void;
  onDownload?: (fileId: string, filename: string) => void;
}

const FileBrowserCard: React.FC<FileBrowserCardProps> = ({ 
  files, 
  viewMode, 
  currentPath,
  onNavigate,
  onNavigateBack,
  onNavigateToRoot,
  hasLiveData,
  onDelete,
  onDownload,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">File Browser</h3>
          <div className="flex items-center gap-2">
            {currentPath.length > 0 && (
              <button
                onClick={onNavigateBack}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                ← Back
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button 
            onClick={onNavigateToRoot}
            className="hover:text-blue-600 font-medium"
          >
            🏠 Root
          </button>
          {currentPath.map((pathPart, idx) => (
            <React.Fragment key={idx}>
              <span>/</span>
              <span className={idx === currentPath.length - 1 ? 'text-gray-900 font-medium' : ''}>
                {pathPart}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="p-4">
        {files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>No files in this folder</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map(file => (
              <FileCardGrid
                key={file.id}
                file={file}
                onNavigate={onNavigate}
                hasLiveData={hasLiveData}
                onDelete={onDelete}
                onDownload={onDownload}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => (
              <FileCardList
                key={file.id}
                file={file}
                onNavigate={onNavigate}
                hasLiveData={hasLiveData}
                onDelete={onDelete}
                onDownload={onDownload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface FileCardGridProps {
  file: FileItem;
  onNavigate: (folder: FileItem) => void;
  hasLiveData?: boolean;
  onDelete?: (fileId: string) => void;
  onDownload?: (fileId: string, filename: string) => void;
}

const FileCardGrid: React.FC<FileCardGridProps> = ({ file, onNavigate, hasLiveData, onDelete, onDownload }) => {
  const icon = file.type === 'folder' ? '📁' : getFileIcon(file.fileType || '');

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
      onClick={() => file.type === 'folder' && onNavigate(file)}
    >
      <div className="text-center">
        <div className="text-4xl mb-2">{file.thumbnail || icon}</div>
        <div className="text-sm font-medium text-gray-900 truncate mb-1">
          {file.name}
        </div>
        {file.type === 'file' && file.size && (
          <div className="text-xs text-gray-500">
            {formatFileSize(file.size)}
          </div>
        )}
        {file.status && (
          <div className="mt-2">
            <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(file.status)}`}>
              {file.status}
            </span>
          </div>
        )}
        {file.tags && file.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 justify-center">
            {file.tags.slice(0, 2).map((tag, idx) => (
              <span key={idx} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="truncate">{file.modifiedBy}</div>
        <div>{file.modified}</div>
      </div>
      {hasLiveData && file.type === 'file' && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-1 justify-center">
          {onDownload && (
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(file.id, file.name); }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              ⬇️
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface FileCardListProps {
  file: FileItem;
  onNavigate: (folder: FileItem) => void;
  hasLiveData?: boolean;
  onDelete?: (fileId: string) => void;
  onDownload?: (fileId: string, filename: string) => void;
}

const FileCardList: React.FC<FileCardListProps> = ({ file, onNavigate, hasLiveData, onDelete, onDownload }) => {
  const icon = file.type === 'folder' ? '📁' : getFileIcon(file.fileType || '');

  return (
    <div
      className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => file.type === 'folder' && onNavigate(file)}
    >
      <div className="text-2xl">{file.thumbnail || icon}</div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </div>
          {file.status && (
            <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadgeColor(file.status)}`}>
              {file.status}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Modified by {file.modifiedBy} • {file.modified}
          {file.type === 'file' && file.size && ` • ${formatFileSize(file.size)}`}
        </div>
      </div>

      {file.tags && file.tags.length > 0 && (
        <div className="flex gap-1">
          {file.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {hasLiveData && file.type === 'file' && onDownload && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(file.id, file.name); }}
            className="p-2 hover:bg-blue-100 rounded text-blue-600"
          >
            <span className="text-sm">⬇️</span>
          </button>
        )}
        {hasLiveData && file.type === 'file' && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
            className="p-2 hover:bg-red-100 rounded text-red-600"
          >
            <span className="text-sm">🗑️</span>
          </button>
        )}
        <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
          <span className="text-sm">⋮</span>
        </button>
      </div>
    </div>
  );
};

interface UploadZoneCardProps {
  isUploading: boolean;
  onUpload: (files: FileList | File[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const UploadZoneCard: React.FC<UploadZoneCardProps> = ({ isUploading, onUpload, fileInputRef }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      className={`bg-white border-2 border-dashed rounded-lg p-8 transition-all ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50' 
          : isUploading
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onUpload(e.dataTransfer.files);
        }
      }}
    >
      <div className="text-center">
        {isUploading ? (
          <>
            <div className="text-5xl mb-3 animate-bounce">⏳</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Uploading files...
            </h3>
            <p className="text-sm text-gray-600">Please wait while your files are being uploaded</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">📤</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Drop files here to upload
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              or click to browse files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select Files
            </button>
            <p className="text-xs text-gray-500 mt-3">
              Supports: PDF, DOC, XLS, JPG, PNG, ZIP (Max 50MB per file)
            </p>
          </>
        )}
      </div>
    </div>
  );
};

interface RecentFilesCardProps {
  files: RecentFile[];
  hasLiveData?: boolean;
  onDownload?: (fileId: string, filename: string) => void;
}

const RecentFilesCard: React.FC<RecentFilesCardProps> = ({ files, hasLiveData, onDownload }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        {hasLiveData && (
          <span className="text-xs text-emerald-600 font-medium">Live</span>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {files.map((file) => (
          <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="text-2xl">{getFileIcon(file.fileType)}</div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate mb-1">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="capitalize">{file.action}</span> by {file.user} • {file.timestamp}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded text-gray-600 text-sm">
                  👁️
                </button>
                <button
                  onClick={() => hasLiveData && onDownload ? onDownload(file.id, file.name) : undefined}
                  className="p-2 hover:bg-gray-100 rounded text-gray-600 text-sm"
                >
                  ⬇️
                </button>
                <button className="p-2 hover:bg-gray-100 rounded text-gray-600 text-sm">
                  ⋮
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
