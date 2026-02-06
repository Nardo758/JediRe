import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealStore } from '../stores/dealStore';
import { PageHeader } from '../components/layout/PageHeader';
import { architectureMetadata } from '../data/architectureMetadata';

const stages = ['Lead', 'Qualified', 'Due Diligence', 'Under Contract', 'Closing', 'Closed'];

const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  qualified: 'bg-blue-100 text-blue-700',
  due_diligence: 'bg-yellow-100 text-yellow-700',
  under_contract: 'bg-orange-100 text-orange-700',
  closing: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
};

export function DealsPage() {
  const navigate = useNavigate();
  const { deals, fetchDeals, isLoading, error } = useDealStore();

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Calculate pipeline progress (percentage in each stage)
  const pipelineProgress = stages.map((stage) => {
    const stageKey = stage.toLowerCase().replace(' ', '_');
    const count = deals.filter((d) => d.status === stageKey).length;
    return { stage, count };
  });

  const totalDeals = deals.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Deal Pipeline"
        description="Track and manage your active deals"
        icon="📋"
        architectureInfo={architectureMetadata.pipeline}
        actions={
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create Deal
          </button>
        }
      />

      <div className="p-6">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">⚠️ {error}</p>
          </div>
        )}

        {/* Pipeline Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Pipeline Progress</h2>
          
          <div className="grid grid-cols-6 gap-1 mb-6">
            {pipelineProgress.map(({ stage, count }) => (
              <div key={stage} className="text-center">
                <div
                  className={`h-16 rounded-lg flex items-center justify-center transition-all ${
                    count > 0
                      ? 'bg-blue-600 text-white font-bold text-xl'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {count}
                </div>
                <div className="text-xs text-gray-600 mt-2 font-medium">{stage}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{totalDeals}</div>
              <div className="text-sm text-gray-600">Total Deals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {deals.filter((d) => d.status === 'qualified').length}
              </div>
              <div className="text-sm text-gray-600">Qualified</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {deals.filter((d) => d.status === 'due_diligence').length}
              </div>
              <div className="text-sm text-gray-600">In DD</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {deals.filter((d) => d.status === 'closed').length}
              </div>
              <div className="text-sm text-gray-600">Closed</div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && deals.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading deals...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && deals.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No deals yet</h3>
            <p className="text-gray-600 mb-6">Create your first deal to get started</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Create Deal
            </button>
          </div>
        )}

        {/* Deals List */}
        {deals.length > 0 && (
          <div className="space-y-4">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/deals/${deal.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{deal.name}</h3>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full ${
                          stageColors[deal.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {deal.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          deal.tier === 'basic'
                            ? 'bg-yellow-100 text-yellow-800'
                            : deal.tier === 'pro'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {deal.tier.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>🏢 {deal.propertyCount} properties</span>
                      <span>📏 {deal.acres.toFixed(1)} acres</span>
                      {deal.budget && <span>💰 ${(deal.budget / 1000000).toFixed(1)}M budget</span>}
                      <span>📅 {deal.projectType}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/deals/${deal.id}`);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/deals/${deal.id}/analysis`);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
