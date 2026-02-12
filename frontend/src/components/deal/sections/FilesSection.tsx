/**
 * Files & Documents Section - Dual-Mode (Acquisition & Performance)
 * Switches content based on deal status:
 * - pipeline → Acquisition mode: DD files, contracts, financials, photos
 * - owned → Performance mode: Operational files, leases, reports, work orders
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
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

export const FilesSection: React.FC<FilesSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FileItem | null>(null);

  // Select data based on mode
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const folderStructure = isPipeline ? acquisitionFolderStructure : performanceFolderStructure;
  const recentFiles = isPipeline ? acquisitionRecentFiles : performanceRecentFiles;

  // Navigate to folder
  const navigateToFolder = (folder: FileItem) => {
    setSelectedFolder(folder);
    setCurrentPath(folder.path);
  };

  // Navigate back
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

    // Find the parent folder
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

  // Navigate to root
  const navigateToRoot = () => {
    setCurrentPath([]);
    setSelectedFolder(null);
  };

  // Get current files to display
  const getCurrentFiles = (): FileItem[] => {
    if (!selectedFolder) {
      return folderStructure;
    }
    return selectedFolder.children || [];
  };

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '📋 Acquisition Files' : '📂 Property Files'}
        </div>

        {/* View Toggle */}
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

      {/* Quick Stats */}
      <StatsGrid stats={stats} />

      {/* Quick Actions */}
      <QuickActionsBar actions={quickActions} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left: Folder Tree */}
        <div className="lg:col-span-1">
          <FolderTreeCard 
            folders={folderStructure} 
            currentPath={currentPath}
            onNavigate={navigateToFolder}
          />
          
          {/* Storage Usage */}
          <StorageCard mode={mode} />
        </div>

        {/* Right: File Browser & Recent Files */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* File Browser */}
          <FileBrowserCard
            files={getCurrentFiles()}
            viewMode={viewMode}
            currentPath={currentPath}
            onNavigate={navigateToFolder}
            onNavigateBack={navigateBack}
            onNavigateToRoot={navigateToRoot}
          />

          {/* Upload Zone */}
          <UploadZoneCard />

          {/* Recent Files */}
          <RecentFilesCard files={recentFiles} />
        </div>
      </div>

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

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
      
      {/* Progress Bar */}
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

      {/* Stats */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{usedStorage} GB used</span>
        <span className="text-gray-900 font-medium">{totalStorage} GB total</span>
      </div>

      {/* Breakdown */}
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
}

const FileBrowserCard: React.FC<FileBrowserCardProps> = ({ 
  files, 
  viewMode, 
  currentPath,
  onNavigate,
  onNavigateBack,
  onNavigateToRoot
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      
      {/* Header with Breadcrumbs */}
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

        {/* Breadcrumb Navigation */}
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

      {/* Files Display */}
      <div className="p-4">
        {files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>No files in this folder</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map(file => (
              <FileCardGrid key={file.id} file={file} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(file => (
              <FileCardList key={file.id} file={file} onNavigate={onNavigate} />
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
}

const FileCardGrid: React.FC<FileCardGridProps> = ({ file, onNavigate }) => {
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
    </div>
  );
};

interface FileCardListProps {
  file: FileItem;
  onNavigate: (folder: FileItem) => void;
}

const FileCardList: React.FC<FileCardListProps> = ({ file, onNavigate }) => {
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
        <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
          <span className="text-sm">⋮</span>
        </button>
      </div>
    </div>
  );
};

const UploadZoneCard: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      className={`bg-white border-2 border-dashed rounded-lg p-8 transition-all ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50' 
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
        // Handle file upload (UI only)
        alert('File upload functionality (UI only)');
      }}
    >
      <div className="text-center">
        <div className="text-5xl mb-3">📤</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Drop files here to upload
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          or click to browse files
        </p>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Select Files
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Supports: PDF, DOC, XLS, JPG, PNG, ZIP (Max 50MB per file)
        </p>
      </div>
    </div>
  );
};

interface RecentFilesCardProps {
  files: RecentFile[];
}

const RecentFilesCard: React.FC<RecentFilesCardProps> = ({ files }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
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
                <button className="p-2 hover:bg-gray-100 rounded text-gray-600 text-sm">
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
