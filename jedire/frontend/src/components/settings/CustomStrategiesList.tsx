/**
 * CustomStrategiesList - Manage user's custom investment strategies
 * 
 * Features:
 * - List all custom strategies
 * - Create new strategies
 * - Edit existing strategies
 * - Delete strategies
 * - Duplicate strategies
 * - Export strategies as JSON
 * - View property type assignments
 * - Badge for custom vs built-in strategies
 * 
 * Location: Settings → Property Types & Strategies
 */

import React, { useState, useEffect } from 'react';
import { CustomStrategyModal } from './CustomStrategyModal';
import { Button } from '../shared/Button';

interface Strategy {
  id: string;
  name: string;
  description: string;
  exit_type: string;
  hold_period_min: number;
  hold_period_max: number | null;
  assigned_types: string[];
  assigned_property_types_count: number;
  times_used: number;
  created_at: string;
  is_template: boolean;
}

export const CustomStrategiesList: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [duplicatingStrategy, setDuplicatingStrategy] = useState<Strategy | null>(null);
  const [deletingStrategyId, setDeletingStrategyId] = useState<string | null>(null);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/custom-strategies', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load strategies');
      }

      const result = await response.json();
      setStrategies(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingStrategy(null);
    setDuplicatingStrategy(null);
    setIsModalOpen(true);
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setDuplicatingStrategy(null);
    setIsModalOpen(true);
  };

  const handleDuplicate = (strategy: Strategy) => {
    setEditingStrategy(null);
    setDuplicatingStrategy(strategy);
    setIsModalOpen(true);
  };

  const handleDelete = async (strategyId: string) => {
    if (!confirm('Are you sure you want to delete this strategy? This action cannot be undone.')) {
      return;
    }

    setDeletingStrategyId(strategyId);

    try {
      const response = await fetch(`/api/v1/custom-strategies/${strategyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete strategy');
      }

      // Remove from list
      setStrategies(strategies.filter(s => s.id !== strategyId));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingStrategyId(null);
    }
  };

  const handleExport = async (strategyId: string) => {
    try {
      const response = await fetch(`/api/v1/custom-strategies/${strategyId}/export`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json' }),
      });

      if (!response.ok) {
        throw new Error('Failed to export strategy');
      }

      const result = await response.json();
      
      // Download as JSON file
      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `strategy-${result.data.strategy.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    loadStrategies(); // Refresh list
  };

  const formatExitType = (exitType: string) => {
    return exitType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatHoldPeriod = (min: number, max: number | null) => {
    if (max) {
      return `${min}-${max} years`;
    }
    return `${min}+ years`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading strategies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Custom Strategies</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage custom investment strategies for your property types
          </p>
        </div>
        <Button variant="default" onClick={handleCreateNew}>
          + Create Custom Strategy
        </Button>
      </div>

      {/* Strategies List */}
      {strategies.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No custom strategies</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new custom strategy.
          </p>
          <div className="mt-6">
            <Button variant="default" onClick={handleCreateNew}>
              + Create Custom Strategy
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {strategy.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Custom
                    </span>
                    {strategy.is_template && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Template
                      </span>
                    )}
                  </div>

                  {strategy.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {strategy.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Hold Period:</span>{' '}
                      {formatHoldPeriod(strategy.hold_period_min, strategy.hold_period_max)}
                    </div>
                    <div>
                      <span className="font-medium">Exit:</span>{' '}
                      {formatExitType(strategy.exit_type)}
                    </div>
                    {strategy.assigned_property_types_count > 0 && (
                      <div>
                        <span className="font-medium">Applied to:</span>{' '}
                        {strategy.assigned_property_types_count} property type(s)
                      </div>
                    )}
                    {strategy.times_used > 0 && (
                      <div>
                        <span className="font-medium">Used:</span>{' '}
                        {strategy.times_used} time(s)
                      </div>
                    )}
                  </div>

                  {strategy.assigned_types && strategy.assigned_types.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strategy.assigned_types.map(type => (
                        <span
                          key={type}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(strategy)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDuplicate(strategy)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleExport(strategy.id)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Export as JSON"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDelete(strategy.id)}
                    disabled={deletingStrategyId === strategy.id}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingStrategyId === strategy.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <CustomStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        editStrategy={editingStrategy}
        duplicateFrom={duplicatingStrategy}
      />
    </div>
  );
};
