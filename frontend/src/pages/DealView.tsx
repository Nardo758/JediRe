import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDealStore } from '../stores/dealStore';
import { DealSidebar } from '../components/deal/DealSidebar';
import { DealMapView } from '../components/deal/DealMapView';
import { DealProperties } from '../components/deal/DealProperties';
import { DealStrategy } from '../components/deal/DealStrategy';
import { DealPipeline } from '../components/deal/DealPipeline';
import { Button } from '../components/shared/Button';

export const DealView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedDeal, fetchDealById, isLoading } = useDealStore();
  const [currentModule, setCurrentModule] = useState('map');
  const [modules, setModules] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchDealById(id);
      // Fetch modules
      fetchModules(id);
    }
  }, [id]);

  const fetchModules = async (dealId: string) => {
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/modules`);
      const data = await response.json();
      setModules(data);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    }
  };

  const renderModule = () => {
    if (!selectedDeal) return null;

    switch (currentModule) {
      case 'map':
        return <DealMapView deal={selectedDeal} />;
      case 'properties':
        return <DealProperties dealId={selectedDeal.id} />;
      case 'strategy':
        return <DealStrategy dealId={selectedDeal.id} />;
      case 'pipeline':
        return <DealPipeline dealId={selectedDeal.id} />;
      case 'market':
        return <div className="p-6">Market Intelligence (Coming Soon)</div>;
      case 'reports':
        return <div className="p-6">Reports (Coming Soon)</div>;
      case 'team':
        return <div className="p-6">Team Collaboration (Coming Soon)</div>;
      default:
        return <div className="p-6">Module not found</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (!selectedDeal) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Deal not found</p>
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{selectedDeal.name}</h1>
                <span
                  className="px-3 py-1 text-xs font-semibold rounded-full"
                  style={{
                    backgroundColor: selectedDeal.tier === 'basic' ? '#fef3c7' :
                                    selectedDeal.tier === 'pro' ? '#dbeafe' : '#d1fae5',
                    color: selectedDeal.tier === 'basic' ? '#92400e' :
                           selectedDeal.tier === 'pro' ? '#1e40af' : '#065f46'
                  }}
                >
                  {selectedDeal.tier.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedDeal.projectType} • {selectedDeal.acres.toFixed(1)} acres
                {selectedDeal.budget && ` • $${(selectedDeal.budget / 1000000).toFixed(1)}M budget`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Quick stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedDeal.propertyCount}</div>
                <div className="text-xs text-gray-600">Properties</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedDeal.taskCount}</div>
                <div className="text-xs text-gray-600">Tasks</div>
              </div>
              {selectedDeal.pipelineStage && (
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">
                    {selectedDeal.pipelineStage.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-gray-600">
                    {selectedDeal.daysInStage} days in stage
                  </div>
                </div>
              )}
            </div>
            
            <Button variant="secondary" size="sm">
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Deal Modules */}
        <DealSidebar
          deal={selectedDeal}
          modules={modules}
          currentModule={currentModule}
          onModuleChange={setCurrentModule}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {renderModule()}
        </div>
      </div>
    </div>
  );
};
