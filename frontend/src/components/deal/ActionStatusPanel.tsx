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
        return 'bg-[#022c22] border-green-800/50';
      case 'error':
        return 'bg-[#1c0a0a] border-red-800/50';
      default:
        return 'bg-[#0d1e3d] border-blue-900/50';
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
            <h3 className="text-lg font-semibold text-[#E8E6E1]">
              {status.phase === 'complete'
                ? 'Analysis Complete'
                : status.phase === 'error'
                ? 'Analysis Failed'
                : 'Analyzing Deal'}
            </h3>
            <p className="text-sm text-[#9EA8B4]">
              {dealType} • {propertyType}
            </p>
          </div>
        </div>
        {status.currentAction && (
          <div className="text-sm font-medium text-[#9EA8B4]">{status.currentAction}</div>
        )}
      </div>

      {status.phase !== 'complete' && status.phase !== 'error' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-[#9EA8B4] mb-2">
            <span>{status.message}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-[#1e2a3d] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
              style={{ width: `${status.progress}%` }}
            >
              <div className="w-full h-full animate-pulse bg-[#0F1319] opacity-20"></div>
            </div>
          </div>
        </div>
      )}

      {status.phase === 'complete' && (
        <div className="text-sm text-green-400">
          <p className="font-medium mb-2">Strategy recommendations are ready!</p>
          <p className="text-green-600">View results below</p>
        </div>
      )}

      {status.phase === 'error' && status.error && (
        <div className="text-sm text-red-400">
          <p className="font-medium mb-1">An error occurred:</p>
          <p className="text-red-400">{status.error}</p>
        </div>
      )}

      {status.phase === 'analyzing' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-[#9EA8B4]">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Processing property data...</span>
          </div>
          {status.progress > 30 && (
            <div className="flex items-center gap-2 text-sm text-[#9EA8B4]">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Evaluating market conditions...</span>
            </div>
          )}
          {status.progress > 60 && (
            <div className="flex items-center gap-2 text-sm text-[#9EA8B4]">
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
