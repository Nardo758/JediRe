/**
 * Search & Filters Component
 * Full-text search, category dropdowns, date pickers, tag filters
 */

import React from 'react';

interface SearchFiltersProps {
  categories: string[];
  selectedCategory: string;
  selectedStatus: string;
  searchQuery: string;
  selectedTags: string[];
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (query: string) => void;
  onTagsChange: (tags: string[]) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  categories,
  selectedCategory,
  selectedStatus,
  searchQuery,
  onCategoryChange,
  onStatusChange,
  onSearchChange,
}) => {
  return (
    <div className="search-filters">
      {/* Search */}
      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Category Filter */}
      <select
        className="filter-select"
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="all">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        className="filter-select"
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="all">All Status</option>
        <option value="draft">Draft</option>
        <option value="final">Final</option>
        <option value="archived">Archived</option>
        <option value="expired">Expired</option>
      </select>

      <style jsx>{`
        .search-filters {
          display: flex;
          gap: 12px;
          align-items: center;
          margin: 20px 0;
        }

        .search-box {
          flex: 1;
          position: relative;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
          opacity: 0.5;
        }

        .search-box input {
          width: 100%;
          padding: 10px 14px 10px 44px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .search-box input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .filter-select {
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-select:hover {
          border-color: #9ca3af;
        }

        .filter-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </div>
  );
};
