import React, { useState } from 'react';
import { Button } from '../shared/Button';
import { AnalysisStatus, AnalysisTask } from '../../services/dealAnalysis.service';

interface ActionStatusPanelProps {
  status: AnalysisStatus;
  dealType?: string;
  propertyType?: string;
  onSkipSetup?: () => void;
  onViewFullAnalysis?: () => void;
}

const StatusIcon: React.FC<{ status: AnalysisTask }> = ({ status }) => {
  if (status.status === 'complete') {
    return <span className="text-green-500 font-bold">✅</span>;
  }
  if (status.status === 'in_progress') {
    return <span className="text-blue-500">🔄</span>;
  }
  if (status.status === 'error') {
    return <span className="text-red-500">❌</span>;
  }
  return <span className="text-gray-400">⏳</span>;
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden inline-block ml-2">
      <div
        className="h-full bg-blue-500 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export const ActionStatusPanel: React.FC<ActionStatusPanelProps> = ({
  status,
  dealType,
  propertyType,
  onSkipSetup,
  onViewFullAnalysis,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const isComplete = 
    status.zoningAnalysis.status === 'complete' &&
    status.comparables.status === 'complete' &&
    status.strategies.status === 'complete' &&
    status.financialModels.status === 'complete';

  const isExisting = dealType === 'existing' || propertyType === 'existing';

  const getTimeRemaining = (): string => {
    if (status.completedAt) return 'Complete';
    
    const tasks = [
      status.zoningAnalysis,
      status.comparables,
      status.strategies,
      status.financialModels,
    ];
    
    const remaining = tasks.filter(t => t.status !== 'complete').length;
    return `~${remaining * 3} min remaining`;
  };

  const getUserActions = (): Array<{ label: string; ready: boolean }> => {
    const actions: Array<{ label: string; ready: boolean }> = [];

    if (isExisting) {
      actions.push({
        label: 'Review zoning & redevelopment options',
        ready: status.zoningAnalysis.status === 'complete',
      });
      actions.push({
        label: 'Choose investment strategy',
        ready: status.strategies.status === 'complete',
      });
      actions.push({
        label: 'Build financial model',
        ready: status.financialModels.status === 'complete',
      });
    } else {
      actions.push({
        label: 'Design project in 3D',
        ready: status.zoningAnalysis.status === 'complete',
      });
      actions.push({
        label: 'Define development features',
        ready: status.zoningAnalysis.status === 'complete',
      });
      actions.push({
        label: 'Build construction timeline',
        ready: status.strategies.status === 'complete',
      });
    }

    return actions;
  };

  if (isMinimized) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mx-6 mt-4">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Deal Setup Progress
            </span>
            {isComplete ? (
              <span className="text-green-600 font-semibold text-sm">✓ Complete</span>
            ) : (
              <span className="text-gray-500 text-sm">{getTimeRemaining()}</span>
            )}
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg mx-6 mt-4">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Deal Setup Progress</h2>
          {isComplete && (
            <span className="text-green-600 font-semibold">✓ Complete</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-500 hover:text-gray-700 px-3 py-1 text-sm font-medium"
          >
            Minimize
          </button>
          {isComplete && (
            <button
              onClick={() => {}}
              className="text-green-600 hover:text-green-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Platform Analysis Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">
            Platform Analysis
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <StatusIcon status={{ status: 'complete' }} />
              <span className="text-gray-700">Deal created</span>
              <span className="text-gray-500 text-xs">
                ({status.startedAt ? new Date(status.startedAt).toLocaleTimeString() : 'just now'})
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <StatusIcon status={status.zoningAnalysis} />
              <span className="text-gray-700">
                {isExisting ? 'Analyzing zoning & development potential' : 'Analyzing zoning requirements'}
              </span>
              {status.zoningAnalysis.status === 'in_progress' && (
                <>
                  <ProgressBar progress={status.zoningAnalysis.progress || 0} />
                  <span className="text-gray-500 text-xs">
                    {status.zoningAnalysis.progress || 0}%
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <StatusIcon status={status.comparables} />
              <span className="text-gray-700">Finding comparable properties</span>
              {status.comparables.status === 'in_progress' && (
                <>
                  <span className="text-gray-600 text-xs">
                    {status.comparables.itemsFound || 0} of {status.comparables.totalItems || 12} found
                  </span>
                  <ProgressBar progress={status.comparables.progress || 0} />
                </>
              )}
              {status.comparables.status === 'complete' && (
                <span className="text-gray-600 text-xs">
                  {status.comparables.totalItems || 12} comps found
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <StatusIcon status={status.strategies} />
              <span className="text-gray-700">Calculate investment strategies</span>
              {status.strategies.status === 'in_progress' && (
                <>
                  <ProgressBar progress={status.strategies.progress || 0} />
                  <span className="text-gray-500 text-xs">
                    {status.strategies.progress || 0}%
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <StatusIcon status={status.financialModels} />
              <span className="text-gray-700">Generate financial models</span>
              {status.financialModels.status === 'in_progress' && (
                <>
                  <ProgressBar progress={status.financialModels.progress || 0} />
                  <span className="text-gray-500 text-xs">
                    {status.financialModels.progress || 0}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* User Actions Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">
            Your Next Actions
          </h3>
          <div className="space-y-2">
            {getUserActions().map((action, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <div className="mt-0.5">
                  {action.ready ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-gray-400">☐</span>
                  )}
                </div>
                <span className={action.ready ? 'text-gray-700' : 'text-gray-500'}>
                  {action.label}
                  {!action.ready && (
                    <span className="text-gray-400 text-xs ml-2">
                      (ready in {getTimeRemaining()})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {onViewFullAnalysis && (
            <Button variant="outline" size="sm" onClick={onViewFullAnalysis}>
              View Full Analysis
            </Button>
          )}
          {onSkipSetup && (
            <Button variant="ghost" size="sm" onClick={onSkipSetup}>
              Skip Setup → Go to Overview
            </Button>
          )}
          {!isComplete && (
            <div className="ml-auto text-xs text-gray-500">
              {getTimeRemaining()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
