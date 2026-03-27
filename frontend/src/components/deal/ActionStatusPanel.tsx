import React, { useEffect, useState } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
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
      case 'initializing': return '🔄';
      case 'analyzing': return '🔍';
      case 'generating': return '✨';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '🔄';
    }
  };

  const getAccentColor = () => {
    switch (status.phase) {
      case 'complete': return BT.text.green;
      case 'error': return BT.text.red;
      default: return BT.text.cyan;
    }
  };

  const accent = getAccentColor();

  return (
    <div
      className="p-6 transition-all duration-300"
      style={{
        background: BT.bg.panel,
        border: `1px solid ${accent}33`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 0,
        fontFamily: BT.font.mono,
        opacity: autoHiding ? 0.5 : 1,
        transform: autoHiding ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getPhaseIcon()}</div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary }}>
              {status.phase === 'complete'
                ? 'Analysis Complete'
                : status.phase === 'error'
                ? 'Analysis Failed'
                : 'Analyzing Deal'}
            </h3>
            <p style={{ fontSize: 10, color: BT.text.secondary }}>
              {dealType} • {propertyType}
            </p>
          </div>
        </div>
        {status.currentAction && (
          <div style={{ fontSize: 10, fontWeight: 500, color: BT.text.secondary }}>{status.currentAction}</div>
        )}
      </div>

      {status.phase !== 'complete' && status.phase !== 'error' && (
        <div className="mb-4">
          <div className="flex justify-between mb-2" style={{ fontSize: 10, color: BT.text.secondary }}>
            <span>{status.message}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full h-2 overflow-hidden" style={{ background: BT.bg.header }}>
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{ width: `${status.progress}%`, background: accent }}
            >
              <div className="w-full h-full opacity-20" style={{ animation: 'pulse 2s infinite', background: BT.text.primary }}></div>
            </div>
          </div>
        </div>
      )}

      {status.phase === 'complete' && (
        <div style={{ fontSize: 10 }}>
          <p style={{ fontWeight: 500, color: BT.text.green, marginBottom: 4 }}>Strategy recommendations are ready!</p>
          <p style={{ color: BT.text.green }}>View results below</p>
        </div>
      )}

      {status.phase === 'error' && status.error && (
        <div style={{ fontSize: 10 }}>
          <p style={{ fontWeight: 500, color: BT.text.red, marginBottom: 4 }}>An error occurred:</p>
          <p style={{ color: BT.text.red }}>{status.error}</p>
        </div>
      )}

      {status.phase === 'analyzing' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2" style={{ fontSize: 10, color: BT.text.secondary }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: BT.text.cyan, animation: 'glow 2s infinite' }}></div>
            <span>Processing property data...</span>
          </div>
          {status.progress > 30 && (
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: BT.text.secondary }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: BT.text.cyan, animation: 'glow 2s infinite' }}></div>
              <span>Evaluating market conditions...</span>
            </div>
          )}
          {status.progress > 60 && (
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: BT.text.secondary }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: BT.text.cyan, animation: 'glow 2s infinite' }}></div>
              <span>Generating strategy recommendations...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionStatusPanel;
