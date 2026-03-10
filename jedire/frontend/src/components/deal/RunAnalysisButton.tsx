/**
 * Run Analysis Button Component
 * Triggers zoning/supply/cashflow/full analysis tasks from the UI
 */

import React, { useState } from 'react';
import { Play, Zap, TrendingUp, DollarSign, Target, Loader2 } from 'lucide-react';
import { runAnalysis } from '@/services/api';

interface RunAnalysisButtonProps {
  dealId: string;
  onTaskCreated?: (taskId: string, taskType: string) => void;
  compact?: boolean;
}

type AnalysisType = 'zoning' | 'supply' | 'cashflow' | 'full';

interface AnalysisOption {
  type: AnalysisType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  duration: string;
}

const analysisOptions: AnalysisOption[] = [
  {
    type: 'zoning',
    label: 'Zoning Analysis',
    description: 'Calculate buildable units, FAR, and development constraints',
    icon: Target,
    color: '#58a6ff',
    duration: '~2 min'
  },
  {
    type: 'supply',
    label: 'Supply Analysis',
    description: 'Analyze competitive supply pipeline and absorption',
    icon: TrendingUp,
    color: '#3fb950',
    duration: '~3 min'
  },
  {
    type: 'cashflow',
    label: 'Cashflow Analysis',
    description: 'Project NOI, returns, and financial feasibility',
    icon: DollarSign,
    color: '#d29922',
    duration: '~4 min'
  },
  {
    type: 'full',
    label: 'Full Analysis',
    description: 'Complete analysis: zoning + supply + cashflow',
    icon: Zap,
    color: '#a371f7',
    duration: '~8 min'
  }
];

export const RunAnalysisButton: React.FC<RunAnalysisButtonProps> = ({
  dealId,
  onTaskCreated,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<AnalysisType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async (type: AnalysisType) => {
    setLoading(type);
    setError(null);

    try {
      const result = await runAnalysis(dealId, type);
      
      if (result.taskId) {
        console.log(`[RunAnalysis] Task created:`, { taskId: result.taskId, type });
        onTaskCreated?.(result.taskId, type);
        setIsOpen(false);
      } else {
        throw new Error('No task ID returned');
      }
    } catch (err) {
      console.error(`[RunAnalysis] Error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to start analysis');
    } finally {
      setLoading(null);
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: '#58a6ff',
          color: '#0a0e14',
          border: 'none',
          borderRadius: 4,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: 0.5
        }}
      >
        <Play size={14} />
        RUN ANALYSIS
      </button>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #58a6ff 0%, #3fb950 100%)',
          color: '#0a0e14',
          border: 'none',
          borderRadius: 4,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: 1,
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(88, 166, 255, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(88, 166, 255, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(88, 166, 255, 0.3)';
        }}
      >
        <Play size={16} fill="currentColor" />
        RUN ANALYSIS
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: '#12171e',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: 24,
              maxWidth: 600,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 18,
                fontWeight: 700,
                color: '#e6edf3',
                marginBottom: 8,
                letterSpacing: 1
              }}>
                SELECT ANALYSIS TYPE
              </h2>
              <p style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                color: '#8b949e',
                margin: 0
              }}>
                Choose the type of analysis to run on this deal
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div style={{
                padding: 12,
                background: '#f85149',
                color: '#0a0e14',
                borderRadius: 4,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                marginBottom: 16
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Analysis Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analysisOptions.map((option) => {
                const Icon = option.icon;
                const isLoading = loading === option.type;

                return (
                  <button
                    key={option.type}
                    onClick={() => handleRunAnalysis(option.type)}
                    disabled={loading !== null}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 16,
                      background: isLoading ? '#1a1f28' : '#0d1117',
                      border: `1px solid ${isLoading ? option.color : '#30363d'}`,
                      borderRadius: 6,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: loading && !isLoading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = '#1a1f28';
                        e.currentTarget.style.borderColor = option.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = '#0d1117';
                        e.currentTarget.style.borderColor = '#30363d';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        background: `${option.color}20`,
                        border: `1px solid ${option.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isLoading ? (
                        <Loader2 size={24} color={option.color} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Icon size={24} color={option.color} />
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#e6edf3',
                        marginBottom: 4,
                        letterSpacing: 0.5
                      }}>
                        {option.label}
                      </div>
                      <div style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 11,
                        color: '#8b949e'
                      }}>
                        {option.description}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 10,
                      color: option.color,
                      fontWeight: 600
                    }}>
                      {isLoading ? 'RUNNING...' : option.duration}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setIsOpen(false)}
              disabled={loading !== null}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #30363d',
                borderRadius: 4,
                color: '#8b949e',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                width: '100%',
                letterSpacing: 0.5
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
