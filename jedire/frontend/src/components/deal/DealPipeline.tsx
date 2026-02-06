import React, { useEffect, useState } from 'react';

interface DealPipelineProps {
  dealId: string;
}

interface Pipeline {
  stage: string;
  daysInStage: number;
  stageHistory: Array<{ stage: string; timestamp: string }>;
}

const stages = [
  { key: 'lead', label: 'Lead', color: 'bg-gray-200 text-gray-800' },
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-200 text-blue-800' },
  { key: 'due_diligence', label: 'Due Diligence', color: 'bg-yellow-200 text-yellow-800' },
  { key: 'under_contract', label: 'Under Contract', color: 'bg-orange-200 text-orange-800' },
  { key: 'closing', label: 'Closing', color: 'bg-purple-200 text-purple-800' },
  { key: 'closed', label: 'Closed', color: 'bg-green-200 text-green-800' }
];

export const DealPipeline: React.FC<DealPipelineProps> = ({ dealId }) => {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPipeline();
  }, [dealId]);

  const fetchPipeline = async () => {
    setIsLoading(true);
    try {
      // This endpoint would need to be created in the backend
      const response = await fetch(`/api/v1/deals/${dealId}/pipeline`);
      if (response.ok) {
        const data = await response.json();
        setPipeline(data);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStage = async (newStage: string) => {
    try {
      await fetch(`/api/v1/deals/${dealId}/pipeline/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });
      fetchPipeline();
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  };

  const getCurrentStageIndex = () => {
    return stages.findIndex(s => s.key === pipeline?.stage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Deal Pipeline</h2>
          <p className="text-gray-600">Track your deal's progression through each stage</p>
        </div>

        {/* Pipeline Visual */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="relative">
            {/* Progress bar background */}
            <div className="absolute top-5 left-0 right-0 h-2 bg-gray-200 rounded-full" />
            
            {/* Progress bar fill */}
            <div
              className="absolute top-5 left-0 h-2 bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
            />

            {/* Stage nodes */}
            <div className="relative flex justify-between">
              {stages.map((stage, index) => {
                const isActive = index === currentStageIndex;
                const isPast = index < currentStageIndex;
                const isFuture = index > currentStageIndex;

                return (
                  <div key={stage.key} className="flex flex-col items-center">
                    {/* Node */}
                    <button
                      onClick={() => updateStage(stage.key)}
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-white font-bold
                        transition-all duration-300 relative z-10
                        ${isActive ? 'bg-blue-600 ring-4 ring-blue-200 scale-110' : ''}
                        ${isPast ? 'bg-green-500' : ''}
                        ${isFuture ? 'bg-gray-300 hover:bg-gray-400' : ''}
                      `}
                    >
                      {isPast ? '✓' : index + 1}
                    </button>

                    {/* Label */}
                    <div className="mt-3 text-center">
                      <div className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>
                        {stage.label}
                      </div>
                      {isActive && pipeline && (
                        <div className="text-xs text-gray-500 mt-1">
                          {pipeline.daysInStage} days
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current Stage Info */}
        {pipeline && (
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-bold text-blue-900 mb-4">
              Current Stage: {stages[currentStageIndex]?.label}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-700 font-medium mb-1">Days in Stage</div>
                <div className="text-2xl font-bold text-blue-900">{pipeline.daysInStage}</div>
              </div>
              <div>
                <div className="text-blue-700 font-medium mb-1">Total Stages Completed</div>
                <div className="text-2xl font-bold text-blue-900">
                  {currentStageIndex} of {stages.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage History */}
        {pipeline?.stageHistory && pipeline.stageHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Stage History</h3>
            <div className="space-y-3">
              {pipeline.stageHistory.map((entry, index) => (
                <div key={index} className="flex items-center gap-4 pb-3 border-b border-gray-200 last:border-0">
                  <div className="w-32 text-sm text-gray-600">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      stages.find(s => s.key === entry.stage)?.color || 'bg-gray-200 text-gray-800'
                    }`}>
                      {stages.find(s => s.key === entry.stage)?.label || entry.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
              Add Task
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
              Add Note
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
              Upload Document
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm">
              Set Reminder
            </button>
          </div>
        </div>

        {/* Stage Tips */}
        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <h3 className="text-lg font-bold text-yellow-900 mb-3">
            💡 Tips for {stages[currentStageIndex]?.label}
          </h3>
          <ul className="space-y-2 text-yellow-800 text-sm">
            {currentStageIndex === 0 && (
              <>
                <li>• Research comparable properties in the area</li>
                <li>• Review zoning regulations</li>
                <li>• Assess preliminary feasibility</li>
              </>
            )}
            {currentStageIndex === 1 && (
              <>
                <li>• Conduct initial site visit</li>
                <li>• Review financial projections</li>
                <li>• Identify potential lenders</li>
              </>
            )}
            {currentStageIndex === 2 && (
              <>
                <li>• Order Phase I Environmental Site Assessment</li>
                <li>• Review title report</li>
                <li>• Conduct detailed market analysis</li>
              </>
            )}
            {currentStageIndex === 3 && (
              <>
                <li>• Finalize loan documents</li>
                <li>• Complete inspections</li>
                <li>• Prepare for closing</li>
              </>
            )}
            {currentStageIndex === 4 && (
              <>
                <li>• Review closing documents</li>
                <li>• Coordinate with title company</li>
                <li>• Prepare funds for closing</li>
              </>
            )}
            {currentStageIndex === 5 && (
              <>
                <li>• Begin construction/renovation</li>
                <li>• Set up property management</li>
                <li>• Start marketing to tenants</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
