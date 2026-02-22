import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Share2, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DealCapsule {
  id: string;
  property_address: string;
  asset_class: string;
  asking_price: number;
  jedi_score: number;
  status: string;
  created_at: string;
  broker_name?: string;
}

const DealCapsulesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mock data for demonstration
  const mockCapsules: DealCapsule[] = [
    {
      id: '1',
      property_address: '3500 Peachtree Rd NE, Atlanta, GA',
      asset_class: 'Multifamily',
      asking_price: 45000000,
      jedi_score: 87,
      status: 'DISCOVER',
      created_at: '2026-02-15T10:30:00Z',
      broker_name: 'Colliers International'
    },
    {
      id: '2',
      property_address: '1050 Piedmont Ave NE, Atlanta, GA',
      asset_class: 'Multifamily',
      asking_price: 32500000,
      jedi_score: 92,
      status: 'ANALYZE',
      created_at: '2026-02-14T14:20:00Z',
      broker_name: 'CBRE'
    },
    {
      id: '3',
      property_address: '725 Ponce de Leon Ave NE, Atlanta, GA',
      asset_class: 'Mixed-Use',
      asking_price: 18750000,
      jedi_score: 76,
      status: 'RESEARCH',
      created_at: '2026-02-12T09:15:00Z'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DISCOVER': 'bg-blue-100 text-blue-700',
      'RESEARCH': 'bg-purple-100 text-purple-700',
      'ANALYZE': 'bg-indigo-100 text-indigo-700',
      'MODEL': 'bg-cyan-100 text-cyan-700',
      'EXECUTE': 'bg-orange-100 text-orange-700',
      'TRACK': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Deal Capsules</h1>
            <p className="text-gray-600">
              Intelligent deal packages with enriched market data and personalized analysis
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Capsule
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address, broker, or deal characteristics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Capsules</div>
            <div className="text-2xl font-bold text-gray-900">{mockCapsules.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Avg JEDI Score</div>
            <div className="text-2xl font-bold text-gray-900">85</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Deal Value</div>
            <div className="text-2xl font-bold text-gray-900">$96.3M</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Active Analysis</div>
            <div className="text-2xl font-bold text-gray-900">1</div>
          </div>
        </div>
      </div>

      {/* Capsules Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 gap-4">
          {mockCapsules.map((capsule) => (
            <div
              key={capsule.id}
              onClick={() => navigate(`/capsules/${capsule.id}`)}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {capsule.property_address}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{capsule.asset_class}</span>
                    <span>•</span>
                    <span>${(capsule.asking_price / 1000000).toFixed(1)}M</span>
                    {capsule.broker_name && (
                      <>
                        <span>•</span>
                        <span>{capsule.broker_name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(capsule.jedi_score)}`}>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {capsule.jedi_score}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(capsule.status)}`}>
                    {capsule.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Created {new Date(capsule.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Share functionality');
                    }}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Export functionality');
                    }}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create Deal Capsule</h2>
            <p className="text-gray-600 mb-6">Choose how to create your capsule:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="text-4xl mb-2">📄</div>
                <div className="font-semibold mb-1">Upload OM</div>
                <div className="text-sm text-gray-600">Drag & drop offering memorandum</div>
              </button>
              
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="text-4xl mb-2">✍️</div>
                <div className="font-semibold mb-1">Manual Entry</div>
                <div className="text-sm text-gray-600">Enter deal details manually</div>
              </button>
              
              <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="text-4xl mb-2">🔗</div>
                <div className="font-semibold mb-1">From Email</div>
                <div className="text-sm text-gray-600">Extract from broker email</div>
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealCapsulesPage;
