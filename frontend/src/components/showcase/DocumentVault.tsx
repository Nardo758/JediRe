import React, { useState } from 'react';
import type { Document } from '../../types/showcase.types';

interface Props {
  documents: Document[];
}

export function DocumentVault({ documents }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['all', 'financial', 'legal', 'due-diligence', 'property', 'other'];
  
  const filteredDocs = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      review: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.pending;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedDocs).map(([category, docs]) => (
          <div key={category}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
              {category.replace('-', ' ')} ({docs.length})
            </h4>
            
            <div className="space-y-2">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center text-blue-600 font-semibold text-xs">
                      {doc.type}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm truncate">{doc.name}</h5>
                        <p className="text-xs text-gray-500 mt-0.5">
                          v{doc.version} • {formatFileSize(doc.size)} • {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {doc.aiExtracted && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                            ✨ AI
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(doc.status)}`}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
