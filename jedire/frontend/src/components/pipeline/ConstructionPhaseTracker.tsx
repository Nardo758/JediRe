import React, { useState } from 'react';
import { ConstructionPhase, CompletionMetrics, PhaseType } from '../../types/construction';

interface ConstructionPhaseTrackerProps {
  dealId: string;
  onPhaseSelect: (phase: ConstructionPhase) => void;
  selectedPhase: ConstructionPhase | null;
  metrics: CompletionMetrics;
  onProgressUpdate?: (sectionId: string, percent: number) => void;
}

const PHASES: ConstructionPhase[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    description: 'Site prep, excavation, and foundation work',
    order: 1,
    percentComplete: 100,
    status: 'complete',
    sections: [],
    milestones: [
      { id: 'm1', name: 'Site clearing', targetDate: '2024-01-15', actualDate: '2024-01-12', status: 'completed', phase: 'foundation' },
      { id: 'm2', name: 'Foundation pour', targetDate: '2024-02-01', actualDate: '2024-01-28', status: 'completed', phase: 'foundation' },
    ],
  },
  {
    id: 'structure',
    name: 'Vertical Structure',
    description: 'Structural framing and floor systems',
    order: 2,
    percentComplete: 45,
    status: 'inProgress',
    sections: [],
    milestones: [
      { id: 'm3', name: 'Floor 1-4 complete', targetDate: '2024-05-01', actualDate: '2024-04-28', status: 'completed', phase: 'structure' },
      { id: 'm4', name: 'Floor 5-8 framing', targetDate: '2024-07-15', status: 'onTrack', phase: 'structure' },
      { id: 'm5', name: 'Top-off celebration', targetDate: '2024-08-30', status: 'upcoming', phase: 'structure' },
    ],
  },
  {
    id: 'skin',
    name: 'Building Envelope',
    description: 'Exterior walls, windows, and waterproofing',
    order: 3,
    percentComplete: 0,
    status: 'notStarted',
    sections: [],
    milestones: [
      { id: 'm6', name: 'Window installation', targetDate: '2024-10-15', status: 'upcoming', phase: 'skin' },
      { id: 'm7', name: 'Weather-tight', targetDate: '2024-11-30', status: 'upcoming', phase: 'skin' },
    ],
  },
  {
    id: 'mep',
    name: 'MEP Systems',
    description: 'Mechanical, electrical, and plumbing rough-in',
    order: 4,
    percentComplete: 0,
    status: 'notStarted',
    sections: [],
    milestones: [
      { id: 'm8', name: 'MEP rough-in complete', targetDate: '2025-01-15', status: 'upcoming', phase: 'mep' },
    ],
  },
  {
    id: 'interior',
    name: 'Interior Finishes',
    description: 'Drywall, flooring, and interior fixtures',
    order: 5,
    percentComplete: 0,
    status: 'notStarted',
    sections: [],
    milestones: [
      { id: 'm9', name: 'Model unit complete', targetDate: '2025-03-01', status: 'upcoming', phase: 'interior' },
      { id: 'm10', name: 'All units complete', targetDate: '2025-04-30', status: 'upcoming', phase: 'interior' },
    ],
  },
  {
    id: 'exterior',
    name: 'Exterior Finishes',
    description: 'Landscaping, paving, and exterior amenities',
    order: 6,
    percentComplete: 0,
    status: 'notStarted',
    sections: [],
    milestones: [
      { id: 'm11', name: 'Landscaping complete', targetDate: '2025-05-15', status: 'upcoming', phase: 'exterior' },
      { id: 'm12', name: 'TCO received', targetDate: '2025-05-30', status: 'upcoming', phase: 'exterior' },
    ],
  },
];

const STATUS_STYLES = {
  complete: 'bg-green-500 text-white',
  inProgress: 'bg-yellow-400 text-gray-900',
  notStarted: 'bg-gray-300 text-gray-600',
};

const MILESTONE_STYLES = {
  completed: 'bg-green-100 text-green-800 border-green-300',
  onTrack: 'bg-blue-100 text-blue-800 border-blue-300',
  atRisk: 'bg-orange-100 text-orange-800 border-orange-300',
  delayed: 'bg-red-100 text-red-800 border-red-300',
  upcoming: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const ConstructionPhaseTracker: React.FC<ConstructionPhaseTrackerProps> = ({
  dealId,
  onPhaseSelect,
  selectedPhase,
  metrics,
  onProgressUpdate,
}) => {
  const [expandedPhase, setExpandedPhase] = useState<PhaseType | null>('structure');

  // Update phases with metrics
  const phasesWithMetrics = PHASES.map(phase => ({
    ...phase,
    percentComplete: metrics.phaseMetrics[phase.id] || 0,
    status: metrics.phaseMetrics[phase.id] === 100 
      ? 'complete' as const
      : metrics.phaseMetrics[phase.id] > 0 
      ? 'inProgress' as const
      : 'notStarted' as const,
  }));

  const handlePhaseClick = (phase: ConstructionPhase) => {
    setExpandedPhase(expandedPhase === phase.id ? null : phase.id);
    onPhaseSelect(phase);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Construction Phases</h2>
        <p className="text-sm text-gray-600 mt-1">Track progress by development phase</p>
      </div>

      {/* Phase Timeline Overview */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-1">
          {phasesWithMetrics.map((phase, idx) => (
            <React.Fragment key={phase.id}>
              <div 
                className="flex-1 cursor-pointer group"
                onClick={() => handlePhaseClick(phase)}
                title={phase.name}
              >
                <div className="relative">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        phase.status === 'complete' ? 'bg-green-500' :
                        phase.status === 'inProgress' ? 'bg-yellow-400' :
                        'bg-gray-300'
                      }`}
                      style={{ width: `${phase.percentComplete}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-600 truncate group-hover:text-gray-900">
                    {phase.name.split(' ')[0]}
                  </div>
                </div>
              </div>
              {idx < phasesWithMetrics.length - 1 && (
                <div className="text-gray-400">→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Phase List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-200">
          {phasesWithMetrics.map((phase) => (
            <div key={phase.id} className="bg-white">
              {/* Phase Header */}
              <div
                onClick={() => handlePhaseClick(phase)}
                className={`
                  px-6 py-4 cursor-pointer transition hover:bg-gray-50
                  ${selectedPhase?.id === phase.id ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${STATUS_STYLES[phase.status].split(' ')[0]}`} />
                    <h3 className="font-semibold text-gray-900">{phase.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {phase.percentComplete}%
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedPhase === phase.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      phase.status === 'complete' ? 'bg-green-500' :
                      phase.status === 'inProgress' ? 'bg-yellow-400' :
                      'bg-gray-300'
                    }`}
                    style={{ width: `${phase.percentComplete}%` }}
                  />
                </div>

                <p className="text-sm text-gray-600 mt-2">{phase.description}</p>
              </div>

              {/* Expanded Content */}
              {expandedPhase === phase.id && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  {/* Milestones */}
                  {phase.milestones && phase.milestones.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Milestones</h4>
                      <div className="space-y-2">
                        {phase.milestones.map((milestone) => (
                          <div
                            key={milestone.id}
                            className={`
                              flex items-center justify-between p-3 rounded-lg border
                              ${MILESTONE_STYLES[milestone.status]}
                            `}
                          >
                            <div className="flex items-center gap-2">
                              {milestone.status === 'completed' && <span>✅</span>}
                              {milestone.status === 'onTrack' && <span>🟢</span>}
                              {milestone.status === 'atRisk' && <span>⚠️</span>}
                              {milestone.status === 'delayed' && <span>🔴</span>}
                              {milestone.status === 'upcoming' && <span>⏳</span>}
                              <span className="text-sm font-medium">{milestone.name}</span>
                            </div>
                            <div className="text-xs">
                              {milestone.actualDate ? (
                                <span>✓ {formatDate(milestone.actualDate)}</span>
                              ) : (
                                <span>{formatDate(milestone.targetDate)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tasks or Actions */}
                  <div className="flex items-center gap-2 text-sm">
                    <button className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition text-gray-700">
                      📊 View Gantt
                    </button>
                    <button className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition text-gray-700">
                      📸 View Photos
                    </button>
                    <button className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition text-gray-700">
                      📝 Add Note
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Summary */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="font-semibold text-gray-900">Overall Progress</div>
            <div className="text-gray-600">
              {phasesWithMetrics.filter(p => p.status === 'complete').length} of {phasesWithMetrics.length} phases complete
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{metrics.overallPercent.toFixed(0)}%</div>
            <div className="text-xs text-gray-600">Total Complete</div>
          </div>
        </div>
      </div>
    </div>
  );
};
