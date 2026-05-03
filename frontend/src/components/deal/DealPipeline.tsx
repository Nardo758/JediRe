import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface DealPipelineProps {
  dealId: string;
}

interface Pipeline {
  stage: string;
  daysInStage: number;
  stageHistory: Array<{ stage: string; timestamp: string }>;
}

const stageColors: Record<string, { bg: string; text: string }> = {
  lead: { bg: BT.bg.active, text: BT.text.secondary },
  qualified: { bg: BT.bg.active, text: BT.text.cyan },
  due_diligence: { bg: BT.bg.active, text: BT.text.amber },
  under_contract: { bg: BT.bg.active, text: BT.text.orange },
  closing: { bg: BT.bg.active, text: BT.text.purple },
  closed: { bg: BT.bg.active, text: BT.text.green },
};

const stages = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'due_diligence', label: 'Due Diligence' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'closing', label: 'Closing' },
  { key: 'closed', label: 'Closed' }
];

export const DealPipeline: React.FC<DealPipelineProps> = ({ dealId }) => {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchPipeline();
  // hook intentionally omits fetchPipeline — it's an inline function recreated each render; including it would cause an infinite re-fetch loop. The function close over the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const fetchPipeline = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.deals.pipeline(dealId);
      setPipeline(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch pipeline data';
      setError(errorMsg);
      console.error('Failed to fetch pipeline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStage = async (newStage: string) => {
    setIsUpdating(true);

    try {
      await api.deals.update(dealId, { pipelineStage: newStage });
      await fetchPipeline();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to update stage';
      setError(errorMsg);
      console.error('Failed to update stage:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentStageIndex = () => {
    return stages.findIndex(s => s.key === pipeline?.stage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 mx-auto mb-4" style={{ borderRadius: '50%', borderBottom: `2px solid ${BT.text.cyan}` }}></div>
          <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Loading pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div style={{ fontSize: '48px' }} className="mb-4">⚠️</div>
          <p style={{ color: BT.text.primary, fontWeight: 600, fontFamily: BT.font.mono, fontSize: '12px', marginBottom: '8px' }}>Failed to load pipeline</p>
          <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={fetchPipeline}
            className="px-4 py-2"
            style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, fontFamily: BT.font.mono, fontSize: '10px', fontWeight: 600, border: 'none' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div style={{ fontSize: '48px' }} className="mb-4">📋</div>
          <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>No pipeline data available</p>
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
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '8px' }}>Deal Pipeline</h2>
          <p style={{ color: BT.text.secondary, fontFamily: BT.font.label, fontSize: '11px' }}>Track your deal's progression through each stage</p>
        </div>

        {/* Pipeline Visual */}
        <div className="p-8" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
          <div className="relative">
            {/* Progress bar background */}
            <div className="absolute top-5 left-0 right-0 h-2" style={{ background: BT.bg.active, borderRadius: '1px' }} />

            {/* Progress bar fill */}
            <div
              className="absolute top-5 left-0 h-2 transition-all duration-500"
              style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%`, background: BT.text.cyan, borderRadius: '1px' }}
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
                      className="w-12 h-12 flex items-center justify-center transition-all duration-300 relative z-10"
                      style={{
                        borderRadius: '50%',
                        fontWeight: 700,
                        fontFamily: BT.font.mono,
                        fontSize: '11px',
                        color: BT.text.primary,
                        background: isActive ? BT.text.cyan : isPast ? BT.text.green : BT.bg.active,
                        border: isActive ? `3px solid ${BT.text.cyan}` : 'none',
                        transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {isPast ? '✓' : index + 1}
                    </button>

                    {/* Label */}
                    <div className="mt-3 text-center">
                      <div style={{ fontSize: '10px', fontWeight: 600, fontFamily: BT.font.mono, color: isActive ? BT.text.cyan : BT.text.secondary }}>
                        {stage.label}
                      </div>
                      {isActive && pipeline && (
                        <div style={{ fontSize: '9px', color: BT.text.muted, fontFamily: BT.font.label, marginTop: '4px' }}>
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
          <div className="p-6" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.cyan, fontFamily: BT.font.mono, marginBottom: '16px' }}>
              Current Stage: {stages[currentStageIndex]?.label}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Days in Stage</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>{pipeline.daysInStage}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: '4px' }}>Total Stages Completed</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                  {currentStageIndex} of {stages.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage History */}
        {pipeline?.stageHistory && pipeline.stageHistory.length > 0 && (
          <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '16px' }}>Stage History</h3>
            <div className="space-y-3">
              {pipeline.stageHistory.map((entry, index) => {
                const sc = stageColors[entry.stage] || stageColors.lead;
                return (
                  <div key={index} className="flex items-center gap-4 pb-3" style={{ borderBottom: index < pipeline.stageHistory.length - 1 ? `1px solid ${BT.border.subtle}` : 'none' }}>
                    <div className="w-32" style={{ fontSize: '10px', color: BT.text.muted, fontFamily: BT.font.mono }}>
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <span
                        className="inline-block px-3 py-1"
                        style={{
                          background: sc.bg,
                          color: sc.text,
                          borderRadius: '2px',
                          fontSize: '10px',
                          fontWeight: 500,
                          fontFamily: BT.font.mono,
                        }}
                      >
                        {stages.find(s => s.key === entry.stage)?.label || entry.stage}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage Actions */}
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: '16px' }}>Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {['Add Task', 'Add Note', 'Upload Document', 'Set Reminder'].map((label) => (
              <button
                key={label}
                className="px-4 py-2 transition"
                style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: '10px', background: 'transparent' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage Tips */}
        <div className="p-6" style={{ background: BT.bg.panelAlt, borderRadius: 0, border: `1px solid ${BT.border.medium}`, borderLeft: `4px solid ${BT.text.amber}` }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: '12px' }}>
            Tips for {stages[currentStageIndex]?.label}
          </h3>
          <ul className="space-y-2" style={{ fontSize: '11px', color: BT.text.secondary, fontFamily: BT.font.label }}>
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
