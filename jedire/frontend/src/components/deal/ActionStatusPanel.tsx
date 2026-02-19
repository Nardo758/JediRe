import React, { useEffect, useState } from 'react';
import { AnalysisStatus } from '@/services/dealAnalysis.service';

export interface ActionStatusPanelProps {
  status: AnalysisStatus;
  dealType: string;
  propertyType: string;
  onComplete?: () => void;
}

export const ActionStatusPanel: React.FC<ActionStatusPanelProps> = ({
  status,
  dealType,
  propertyType,
  onComplete,
}) => {
  const [autoHiding, setAutoHiding] = useState(false);

  useEffect(() => {
    if (status.phase === 'complete' && !autoHiding) {
      setAutoHiding(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status.phase, autoHiding, onComplete]);

  const getPhaseIcon = () => {
    switch (status.phase) {
      case 'initializing':
        return '🔄';
      case 'analyzing':
        return '🔍';
      case 'generating':
        return '✨';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🔄';
    }
  };

  const getPhaseColor = () => {
    switch (status.phase) {
      case 'complete':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getProgressColor = () => {
    switch (status.phase) {
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className={`rounded-lg border-2 p-6 ${getPhaseColor()} transition-all duration-300 ${
        autoHiding ? 'opacity-50 scale-95' : 'opacity-100'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getPhaseIcon()}</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {status.phase === 'complete'
                ? 'Analysis Complete'
                : status.phase === 'error'
                ? 'Analysis Failed'
                : 'Analyzing Deal'}
            </h3>
            <p className="text-sm text-gray-600">
              {dealType} • {propertyType}
            </p>
          </div>
        </div>
        {status.currentAction && (
          <div className="text-sm font-medium text-gray-700">{status.currentAction}</div>
        )}
      </div>

      {/* Progress Bar */}
      {status.phase !== 'complete' && status.phase !== 'error' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{status.message}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
              style={{ width: `${status.progress}%` }}
            >
              <div className="w-full h-full animate-pulse bg-white opacity-20"></div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {status.phase === 'complete' && (
        <div className="text-sm text-green-700">
          <p className="font-medium mb-2">Strategy recommendations are ready!</p>
          <p className="text-green-600">View results below</p>
        </div>
      )}

      {/* Error Message */}
      {status.phase === 'error' && status.error && (
        <div className="text-sm text-red-700">
          <p className="font-medium mb-1">An error occurred:</p>
          <p className="text-red-600">{status.error}</p>
        </div>
      )}

      {/* Activity Log */}
      {status.phase === 'analyzing' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Processing property data...</span>
          </div>
          {status.progress > 30 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Evaluating market conditions...</span>
            </div>
          )}
          {status.progress > 60 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Generating strategy recommendations...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionStatusPanel;
