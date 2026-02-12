/**
 * Documents Section - Dual-Mode (Acquisition & Performance)
 * Comprehensive document management with search, filters, and version tracking
 * Switches content based on deal status:
 * - pipeline → Acquisition mode (DD docs, contracts, reports, presentations)
 * - owned → Performance mode (operational docs, leases, maintenance records)
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import {
  acquisitionDocuments,
  acquisitionDocumentCategories,
  acquisitionStats,
  acquisitionRecentActivity,
  performanceDocuments,
  performanceDocumentCategories,
  performanceStats,
  performanceRecentActivity,
  Document,
  DocumentCategory,
  DocumentStats,
  RecentActivity
} from '../../../data/documentsMockData';

interface DocumentsSectionProps {
  deal: Deal;
}

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  
  // Select data based on mode
  const documents = isPipeline ? acquisitionDocuments : performanceDocuments;
  const categories = isPipeline ? acquisitionDocumentCategories : performanceDocumentCategories;
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const recentActivity = isPipeline ? acquisitionRecentActivity : performanceRecentActivity;

  // State management
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesCategory && matchesSearch && matchesStatus;
  });

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return parseFloat(a.size) - parseFloat(b.size);
      case 'date':
      default:
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
  });

  return (
    <div className="space-y-6">
      
      {/* Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPipeline 
            ? 'bg-blue-100 text-blue-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {isPipeline ? '📄 Acquisition Documents' : '📋 Operational Documents'}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Search and Filters */}
      <SearchAndFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        isPipeline={isPipeline}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar - Categories */}
        <div className="lg:col-span-1">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
        </div>

        {/* Main Document Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Document Grid/List */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {selectedCategory === 'all' 
                  ? 'All Documents' 
                  : categories.find(c => c.id === selectedCategory)?.name
                } ({sortedDocuments.length})
              </h3>
              {sortedDocuments.length === 0 && (
                <span className="text-xs text-gray-500">No documents match your filters</span>
              )}
            </div>

            {viewMode === 'grid' ? (
              <DocumentGrid documents={sortedDocuments} />
            ) : (
              <DocumentList documents={sortedDocuments} />
            )}
          </div>

          {/* Recent Activity */}
          <RecentActivityCard activity={recentActivity} />
        </div>
      </div>

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: DocumentStats[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stat.value}
            </div>
            {stat.trend && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-2 ${
                stat.trend.direction === 'up' 
                  ? 'text-green-600' 
                  : stat.trend.direction === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}>
                <span>{stat.trend.direction === 'up' ? '↗' : stat.trend.direction === 'down' ? '↘' : '→'}</span>
                <span>{stat.trend.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface SearchAndFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  sortBy: 'date' | 'name' | 'size';
  setSortBy: (sort: 'date' | 'name' | 'size') => void;
  isPipeline: boolean;
}

const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  isPipeline
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search documents by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="approved">✅ Approved</option>
          <option value="pending review">⏳ Pending Review</option>
          <option value="needs revision">🔄 Needs Revision</option>
          <option value="archived">📦 Archived</option>
        </select>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size')}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
          <option value="size">Sort by Size</option>
        </select>

        {/* View Toggle */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'grid' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg">▦</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg">☰</span>
          </button>
        </div>

        {/* Upload Button */}
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap">
          📤 Upload
        </button>
      </div>
    </div>
  );
};

interface CategoryFilterProps {
  categories: DocumentCategory[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory
}) => {
  const getCategoryColorClass = (color: string, isSelected: boolean) => {
    if (isSelected) {
      const selectedColors = {
        gray: 'bg-gray-100 border-gray-400 text-gray-900',
        blue: 'bg-blue-50 border-blue-500 text-blue-900',
        purple: 'bg-purple-50 border-purple-500 text-purple-900',
        green: 'bg-green-50 border-green-500 text-green-900',
        orange: 'bg-orange-50 border-orange-500 text-orange-900',
        indigo: 'bg-indigo-50 border-indigo-500 text-indigo-900'
      };
      return selectedColors[color as keyof typeof selectedColors] || selectedColors.gray;
    }
    return 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Categories</h3>
      <div className="space-y-2">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${getCategoryColorClass(category.color, selectedCategory === category.id)}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
              selectedCategory === category.id 
                ? 'bg-white bg-opacity-50' 
                : 'bg-gray-100'
            }`}>
              {category.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface DocumentGridProps {
  documents: Document[];
}

const DocumentGrid: React.FC<DocumentGridProps> = ({ documents }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      'approved': 'text-green-600 bg-green-50',
      'pending review': 'text-yellow-600 bg-yellow-50',
      'needs revision': 'text-orange-600 bg-orange-50',
      'archived': 'text-gray-600 bg-gray-50'
    };
    return colors[status as keyof typeof colors] || colors['approved'];
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'approved': '✅',
      'pending review': '⏳',
      'needs revision': '🔄',
      'archived': '📦'
    };
    return icons[status as keyof typeof icons] || '📄';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {documents.map(doc => (
        <div
          key={doc.id}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
        >
          {/* Document Icon & Type */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{doc.icon}</div>
              <div>
                <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {doc.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">{doc.type} • {doc.size}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {doc.description && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">{doc.description}</p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {doc.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* Status & Version */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
              <span>{getStatusIcon(doc.status)}</span>
              <span className="capitalize">{doc.status}</span>
            </div>
            <span className="text-xs text-gray-500">v{doc.version}</span>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">{doc.uploadedBy}</span>
            <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-3">
            <button className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
              👁️ Preview
            </button>
            <button className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
              ⬇️ Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

interface DocumentListProps {
  documents: Document[];
}

const DocumentList: React.FC<DocumentListProps> = ({ documents }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      'approved': 'text-green-600',
      'pending review': 'text-yellow-600',
      'needs revision': 'text-orange-600',
      'archived': 'text-gray-600'
    };
    return colors[status as keyof typeof colors] || colors['approved'];
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'approved': '✅',
      'pending review': '⏳',
      'needs revision': '🔄',
      'archived': '📦'
    };
    return icons[status as keyof typeof icons] || '📄';
  };

  return (
    <div className="space-y-2">
      {documents.map(doc => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
        >
          {/* Left Side - Icon & Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="text-3xl flex-shrink-0">{doc.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                {doc.name}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">{doc.type}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{doc.size}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{doc.uploadedBy}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Center - Tags */}
          <div className="hidden lg:flex items-center gap-2 px-4">
            {doc.tags.slice(0, 2).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* Right Side - Status, Version, Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className={`flex items-center gap-1 text-xs font-medium ${getStatusColor(doc.status)}`}>
              <span>{getStatusIcon(doc.status)}</span>
              <span className="hidden md:inline capitalize">{doc.status}</span>
            </div>
            <span className="text-xs text-gray-500 hidden sm:inline">v{doc.version}</span>
            <div className="flex gap-2">
              <button className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Preview">
                👁️
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-50 rounded transition-colors" title="Download">
                ⬇️
              </button>
              <button className="p-2 text-gray-400 hover:bg-gray-50 rounded transition-colors" title="More">
                ⋮
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface RecentActivityCardProps {
  activity: RecentActivity[];
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({ activity }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          View All
        </button>
      </div>
      <div className="space-y-3">
        {activity.map(item => (
          <div 
            key={item.id} 
            className="flex gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
          >
            <div className="flex-shrink-0 text-lg">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                <span className="font-medium">{item.user}</span>{' '}
                <span className="text-gray-600">{item.action}</span>{' '}
                <span className="font-medium text-blue-600 truncate">{item.document}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentsSection;
