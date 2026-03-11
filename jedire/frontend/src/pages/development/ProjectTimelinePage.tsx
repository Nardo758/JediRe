/**
 * ProjectTimelinePage - Development Project Tracking & Timeline Visualization
 * 
 * Comprehensive development project management with:
 * - Gantt Chart for 6 development phases
 * - Milestone tracking (Land → Design → Entitlements → Construction → Lease-up)
 * - Critical Path visualization
 * - Team & Vendor management
 * - Budget tracking by phase
 * - 3D Progress Integration
 * 
 * Based on: DEV_OPERATIONS_MODULES_DESIGN.md - Timeline & Milestones Module
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ==================== TYPES ====================

export type DevelopmentPhase = 
  | 'land-acquisition' 
  | 'design-entitlements' 
  | 'financing' 
  | 'construction' 
  | 'lease-up' 
  | 'hold-exit';

export type MilestoneStatus = 
  | 'completed' 
  | 'in-progress' 
  | 'upcoming' 
  | 'at-risk' 
  | 'blocked';

export type ScenarioType = 'fast-track' | 'expected' | 'slow-case';

export interface DevelopmentMilestone {
  id: string;
  phase: DevelopmentPhase;
  title: string;
  description?: string;
  targetDate: string;
  actualDate?: string;
  status: MilestoneStatus;
  isCritical: boolean;
  dependencies?: string[];
  owner?: string;
  daysUntil?: number;
  progress?: number;
}

export interface PhaseTimeline {
  phase: DevelopmentPhase;
  name: string;
  icon: string;
  color: string;
  startDate: string;
  endDate: string;
  status: 'complete' | 'in-progress' | 'upcoming';
  progress: number;
  milestones: DevelopmentMilestone[];
  budget: {
    planned: number;
    actual: number;
    variance: number;
  };
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  phases: DevelopmentPhase[];
}

export interface Scenario {
  type: ScenarioType;
  name: string;
  icon: string;
  completionDate: string;
  firstRentDate: string;
  irrImpact: string;
  description: string;
  assumptions: string[];
}

export interface CriticalPathItem {
  id: string;
  task: string;
  deadline: string;
  daysRemaining: number;
  owner: string;
  blockers?: string[];
  floatDays: number;
}

// ==================== MOCK DATA ====================

const mockPhases: PhaseTimeline[] = [
  {
    phase: 'land-acquisition',
    name: 'Land Acquisition',
    icon: '🏞️',
    color: 'bg-blue-500',
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    status: 'complete',
    progress: 100,
    milestones: [
      {
        id: 'm1',
        phase: 'land-acquisition',
        title: 'Main Parcel Closed',
        targetDate: '2024-03-15',
        actualDate: '2024-03-12',
        status: 'completed',
        isCritical: true,
        owner: 'Sarah Williams',
        progress: 100,
      },
      {
        id: 'm2',
        phase: 'land-acquisition',
        title: 'Adjacent Parcel Closing',
        targetDate: '2024-06-30',
        status: 'at-risk',
        isCritical: true,
        owner: 'Mike Chen',
        daysUntil: 45,
        progress: 75,
      },
    ],
    budget: {
      planned: 12500000,
      actual: 12350000,
      variance: -1.2,
    },
  },
  {
    phase: 'design-entitlements',
    name: 'Design & Entitlements',
    icon: '📐',
    color: 'bg-purple-500',
    startDate: '2024-04-01',
    endDate: '2024-12-15',
    status: 'in-progress',
    progress: 55,
    milestones: [
      {
        id: 'm3',
        phase: 'design-entitlements',
        title: 'Schematic Design Complete',
        targetDate: '2024-06-15',
        actualDate: '2024-06-18',
        status: 'completed',
        isCritical: false,
        owner: 'SBA Design',
        progress: 100,
      },
      {
        id: 'm4',
        phase: 'design-entitlements',
        title: 'Zoning Variance Approval',
        targetDate: '2024-10-01',
        status: 'in-progress',
        isCritical: true,
        owner: 'Sarah Williams',
        daysUntil: 75,
        progress: 60,
      },
      {
        id: 'm5',
        phase: 'design-entitlements',
        title: 'Building Permit Issued',
        targetDate: '2024-12-15',
        status: 'upcoming',
        isCritical: true,
        owner: 'Mike Chen',
        daysUntil: 135,
        dependencies: ['m4'],
        progress: 0,
      },
    ],
    budget: {
      planned: 3200000,
      actual: 1800000,
      variance: 43.8,
    },
  },
  {
    phase: 'financing',
    name: 'Financing',
    icon: '💰',
    color: 'bg-green-500',
    startDate: '2024-08-01',
    endDate: '2025-01-30',
    status: 'in-progress',
    progress: 35,
    milestones: [
      {
        id: 'm6',
        phase: 'financing',
        title: 'Loan Commitment',
        targetDate: '2024-11-15',
        status: 'in-progress',
        isCritical: true,
        owner: 'John Davis',
        daysUntil: 90,
        progress: 50,
      },
      {
        id: 'm7',
        phase: 'financing',
        title: 'Construction Loan Close',
        targetDate: '2025-01-30',
        status: 'upcoming',
        isCritical: true,
        owner: 'John Davis',
        daysUntil: 165,
        dependencies: ['m5', 'm6'],
        progress: 0,
      },
    ],
    budget: {
      planned: 52100000,
      actual: 0,
      variance: 100,
    },
  },
  {
    phase: 'construction',
    name: 'Construction',
    icon: '🏗️',
    color: 'bg-orange-500',
    startDate: '2025-02-15',
    endDate: '2026-05-30',
    status: 'upcoming',
    progress: 0,
    milestones: [
      {
        id: 'm8',
        phase: 'construction',
        title: 'Groundbreaking',
        targetDate: '2025-02-15',
        status: 'upcoming',
        isCritical: true,
        owner: 'Turner Construction',
        daysUntil: 200,
        dependencies: ['m7'],
        progress: 0,
      },
      {
        id: 'm9',
        phase: 'construction',
        title: 'Top Off',
        targetDate: '2025-10-30',
        status: 'upcoming',
        isCritical: true,
        owner: 'Turner Construction',
        daysUntil: 457,
        progress: 0,
      },
      {
        id: 'm10',
        phase: 'construction',
        title: 'TCO (Temporary Certificate of Occupancy)',
        targetDate: '2026-05-15',
        status: 'upcoming',
        isCritical: true,
        owner: 'Turner Construction',
        daysUntil: 654,
        progress: 0,
      },
    ],
    budget: {
      planned: 59500000,
      actual: 0,
      variance: 100,
    },
  },
  {
    phase: 'lease-up',
    name: 'Lease-up/Stabilization',
    icon: '🏘️',
    color: 'bg-teal-500',
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'upcoming',
    progress: 0,
    milestones: [
      {
        id: 'm11',
        phase: 'lease-up',
        title: 'Pre-Leasing Launch',
        targetDate: '2026-03-01',
        status: 'upcoming',
        isCritical: false,
        owner: 'Leasing Team',
        daysUntil: 639,
        progress: 0,
      },
      {
        id: 'm12',
        phase: 'lease-up',
        title: 'First Move-Ins',
        targetDate: '2026-06-01',
        status: 'upcoming',
        isCritical: true,
        owner: 'Property Management',
        daysUntil: 731,
        progress: 0,
      },
      {
        id: 'm13',
        phase: 'lease-up',
        title: '90% Stabilization',
        targetDate: '2026-12-31',
        status: 'upcoming',
        isCritical: true,
        owner: 'Property Management',
        daysUntil: 944,
        progress: 0,
      },
    ],
    budget: {
      planned: 1200000,
      actual: 0,
      variance: 100,
    },
  },
  {
    phase: 'hold-exit',
    name: 'Hold/Exit',
    icon: '🎯',
    color: 'bg-indigo-500',
    startDate: '2027-01-01',
    endDate: '2032-01-01',
    status: 'upcoming',
    progress: 0,
    milestones: [
      {
        id: 'm14',
        phase: 'hold-exit',
        title: 'Full Stabilization',
        targetDate: '2027-06-30',
        status: 'upcoming',
        isCritical: false,
        owner: 'Asset Management',
        daysUntil: 1125,
        progress: 0,
      },
      {
        id: 'm15',
        phase: 'hold-exit',
        title: 'Exit Window Opens',
        targetDate: '2030-01-01',
        status: 'upcoming',
        isCritical: false,
        owner: 'Asset Management',
        daysUntil: 2557,
        progress: 0,
      },
    ],
    budget: {
      planned: 8500000,
      actual: 0,
      variance: 100,
    },
  },
];

const mockTeam: TeamMember[] = [
  {
    id: 't1',
    name: 'Sarah Williams',
    role: 'Development Manager',
    company: 'JEDI RE',
    email: 'sarah.williams@jedire.com',
    phone: '(555) 123-4567',
    phases: ['land-acquisition', 'design-entitlements', 'financing'],
  },
  {
    id: 't2',
    name: 'Mike Chen',
    role: 'Project Manager',
    company: 'JEDI RE',
    email: 'mike.chen@jedire.com',
    phone: '(555) 234-5678',
    phases: ['design-entitlements', 'construction'],
  },
  {
    id: 't3',
    name: 'John Davis',
    role: 'Financial Analyst',
    company: 'JEDI RE',
    email: 'john.davis@jedire.com',
    phone: '(555) 345-6789',
    phases: ['financing'],
  },
  {
    id: 't4',
    name: 'Jennifer Park',
    role: 'Principal Architect',
    company: 'SBA Design',
    email: 'jpark@sbadesign.com',
    phone: '(555) 456-7890',
    phases: ['design-entitlements'],
  },
  {
    id: 't5',
    name: 'Robert Martinez',
    role: 'Construction Superintendent',
    company: 'Turner Construction',
    email: 'rmartinez@turner.com',
    phone: '(555) 567-8901',
    phases: ['construction'],
  },
  {
    id: 't6',
    name: 'Emily Thompson',
    role: 'Leasing Director',
    company: 'JEDI RE',
    email: 'emily.thompson@jedire.com',
    phone: '(555) 678-9012',
    phases: ['lease-up', 'hold-exit'],
  },
];

const mockScenarios: Scenario[] = [
  {
    type: 'fast-track',
    name: 'Fast Track',
    icon: '🚀',
    completionDate: 'Mar 2026',
    firstRentDate: 'Apr 2026',
    irrImpact: '+2.1%',
    description: 'All goes perfectly, no delays',
    assumptions: [
      'Permits approved on first submission',
      'No weather delays',
      'All materials arrive on time',
      'No labor shortages',
    ],
  },
  {
    type: 'expected',
    name: 'Expected',
    icon: '📊',
    completionDate: 'May 2026',
    firstRentDate: 'Jun 2026',
    irrImpact: 'Base',
    description: 'Current plan with normal delays',
    assumptions: [
      'One permit revision cycle',
      '2 weeks of weather delays',
      'Standard material lead times',
      'Normal inspection schedule',
    ],
  },
  {
    type: 'slow-case',
    name: 'Slow Case',
    icon: '🐌',
    completionDate: 'Aug 2026',
    firstRentDate: 'Oct 2026',
    irrImpact: '-3.4%',
    description: 'Permitting delays, weather, etc.',
    assumptions: [
      'Multiple permit revision cycles',
      '6 weeks of weather delays',
      'Supply chain disruptions',
      'Extended inspection times',
    ],
  },
];

const mockCriticalPath: CriticalPathItem[] = [
  {
    id: 'cp1',
    task: 'Adjacent parcel closing',
    deadline: 'Jun 30, 2024',
    daysRemaining: 45,
    owner: 'Mike Chen',
    floatDays: 0,
  },
  {
    id: 'cp2',
    task: 'Zoning variance hearing',
    deadline: 'Oct 1, 2024',
    daysRemaining: 75,
    owner: 'Sarah Williams',
    blockers: ['Community engagement incomplete'],
    floatDays: 5,
  },
  {
    id: 'cp3',
    task: 'Construction loan close',
    deadline: 'Jan 30, 2025',
    daysRemaining: 165,
    owner: 'John Davis',
    dependencies: ['Building permit', 'Zoning approval'],
    floatDays: 12,
  },
];

// ==================== MAIN COMPONENT ====================

export const ProjectTimelinePage: React.FC = () => {
  const { dealId } = useParams();
  const navigate = useNavigate();
  
  const [selectedView, setSelectedView] = useState<'timeline' | 'milestones' | 'team' | 'budget'>('timeline');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('expected');
  const [expandedPhases, setExpandedPhases] = useState<Set<DevelopmentPhase>>(new Set(['design-entitlements', 'financing']));
  const [show3DProgress, setShow3DProgress] = useState(false);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const totalPhases = mockPhases.length;
    const weightedProgress = mockPhases.reduce((sum, phase) => sum + phase.progress, 0) / totalPhases;
    return Math.round(weightedProgress);
  }, []);

  const totalBudget = useMemo(() => {
    return mockPhases.reduce((sum, phase) => sum + phase.budget.planned, 0);
  }, []);

  const activeMilestones = useMemo(() => {
    return mockPhases
      .flatMap(p => p.milestones)
      .filter(m => m.status === 'in-progress' || m.status === 'at-risk' || m.status === 'blocked')
      .sort((a, b) => (a.daysUntil || 999) - (b.daysUntil || 999));
  }, []);

  const togglePhase = (phase: DevelopmentPhase) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phase)) {
      newExpanded.delete(phase);
    } else {
      newExpanded.add(phase);
    }
    setExpandedPhases(newExpanded);
  };

  const selectedScenarioData = mockScenarios.find(s => s.type === selectedScenario)!;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900 transition"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Development Project Timeline</h1>
                <p className="text-sm text-gray-600 mt-1">
                  123 Main Street • 12-Story Multifamily • 287 Units
                </p>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{overallProgress}%</div>
                <div className="text-xs text-gray-600">Complete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">${(totalBudget / 1000000).toFixed(1)}M</div>
                <div className="text-xs text-gray-600">Total Budget</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">May '26</div>
                <div className="text-xs text-gray-600">Est. Completion</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShow3DProgress(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                🏗️ 3D Progress
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium">
                📥 Export Report
              </button>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex items-center gap-2">
            {[
              { id: 'timeline', label: '📊 Timeline', icon: '📊' },
              { id: 'milestones', label: '🎯 Milestones', icon: '🎯' },
              { id: 'team', label: '👥 Team', icon: '👥' },
              { id: 'budget', label: '💰 Budget', icon: '💰' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedView(tab.id as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  selectedView === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* Active Milestones Alert Bar */}
        {activeMilestones.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                  Active Attention Required ({activeMilestones.length} items)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeMilestones.slice(0, 4).map(milestone => (
                    <div key={milestone.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${
                        milestone.status === 'blocked' ? 'bg-red-500' :
                        milestone.status === 'at-risk' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} />
                      <span className="font-medium text-gray-900">{milestone.title}</span>
                      {milestone.daysUntil !== undefined && (
                        <span className="text-gray-600">• {milestone.daysUntil}d remaining</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline View */}
        {selectedView === 'timeline' && (
          <TimelineView
            phases={mockPhases}
            expandedPhases={expandedPhases}
            togglePhase={togglePhase}
            selectedScenario={selectedScenario}
            setSelectedScenario={setSelectedScenario}
            scenarioData={selectedScenarioData}
            criticalPath={mockCriticalPath}
          />
        )}

        {/* Milestones View */}
        {selectedView === 'milestones' && (
          <MilestonesView phases={mockPhases} />
        )}

        {/* Team View */}
        {selectedView === 'team' && (
          <TeamView team={mockTeam} phases={mockPhases} />
        )}

        {/* Budget View */}
        {selectedView === 'budget' && (
          <BudgetView phases={mockPhases} />
        )}

      </div>

      {/* 3D Progress Modal */}
      {show3DProgress && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">3D Construction Progress</h2>
              <button
                onClick={() => setShow3DProgress(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-100 rounded-lg h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">🏗️</div>
                  <p className="text-gray-600">
                    3D visualization integrated with Pipeline3DProgress component
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Link to: /components/pipeline/Pipeline3DProgress.tsx
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ==================== TIMELINE VIEW ====================

interface TimelineViewProps {
  phases: PhaseTimeline[];
  expandedPhases: Set<DevelopmentPhase>;
  togglePhase: (phase: DevelopmentPhase) => void;
  selectedScenario: ScenarioType;
  setSelectedScenario: (scenario: ScenarioType) => void;
  scenarioData: Scenario;
  criticalPath: CriticalPathItem[];
}

const TimelineView: React.FC<TimelineViewProps> = ({
  phases,
  expandedPhases,
  togglePhase,
  selectedScenario,
  setSelectedScenario,
  scenarioData,
  criticalPath,
}) => {
  const today = new Date();
  
  // Calculate date range for Gantt
  const dateRange = useMemo(() => {
    const allDates = phases.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    return { minDate, maxDate };
  }, [phases]);

  const totalDays = Math.ceil(
    (dateRange.maxDate.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const getPosition = (date: Date) => {
    const days = Math.ceil((date.getTime() - dateRange.minDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  const todayPosition = getPosition(today);

  return (
    <div className="space-y-6">
      
      {/* Scenario Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Scenario Planning</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {mockScenarios.map(scenario => (
            <button
              key={scenario.type}
              onClick={() => setSelectedScenario(scenario.type)}
              className={`p-4 rounded-lg border-2 transition text-left ${
                selectedScenario === scenario.type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{scenario.icon}</span>
                <span className={`text-sm font-bold ${
                  scenario.type === 'fast-track' ? 'text-green-600' :
                  scenario.type === 'slow-case' ? 'text-red-600' :
                  'text-blue-600'
                }`}>
                  {scenario.irrImpact}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">{scenario.name}</h4>
              <p className="text-xs text-gray-600 mb-2">{scenario.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>🏁 {scenario.completionDate}</span>
                <span>🏠 {scenario.firstRentDate}</span>
              </div>
            </button>
          ))}
        </div>
        
        {/* Selected Scenario Details */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            {scenarioData.name} Assumptions:
          </h4>
          <ul className="grid grid-cols-2 gap-2">
            {scenarioData.assumptions.map((assumption, idx) => (
              <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Development Gantt Chart</h3>
        </div>
        
        <div className="p-6">
          {/* Timeline Header */}
          <div className="relative h-16 mb-8 border-b-2 border-gray-300">
            {/* Year/Quarter markers */}
            <div className="absolute inset-0 flex justify-between text-xs text-gray-500">
              <div>
                <div className="font-semibold">{dateRange.minDate.getFullYear()}</div>
                <div className="text-gray-400">
                  {dateRange.minDate.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold">2025</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">2026</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{dateRange.maxDate.getFullYear()}</div>
                <div className="text-gray-400">
                  {dateRange.maxDate.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
            </div>
            
            {/* Today marker */}
            {todayPosition >= 0 && todayPosition <= 100 && (
              <div 
                className="absolute bottom-0 w-1 h-full bg-blue-600 z-10"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-600 text-white text-xs rounded whitespace-nowrap font-medium">
                  TODAY
                </div>
              </div>
            )}
          </div>

          {/* Phase Bars */}
          <div className="space-y-4">
            {phases.map((phase, index) => {
              const startPos = getPosition(new Date(phase.startDate));
              const endPos = getPosition(new Date(phase.endDate));
              const width = endPos - startPos;
              const isExpanded = expandedPhases.has(phase.phase);

              return (
                <div key={phase.phase}>
                  {/* Phase Bar */}
                  <div className="relative h-16">
                    {/* Background line */}
                    <div className="absolute inset-0 bg-gray-50 rounded border border-gray-200" />
                    
                    {/* Phase timeline bar */}
                    <div
                      className={`absolute top-2 h-12 ${phase.color} rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer group`}
                      style={{
                        left: `${startPos}%`,
                        width: `${width}%`,
                      }}
                      onClick={() => togglePhase(phase.phase)}
                    >
                      {/* Progress fill */}
                      {phase.progress > 0 && (
                        <div
                          className="absolute inset-0 bg-white/30 rounded-l-lg"
                          style={{ width: `${phase.progress}%` }}
                        />
                      )}
                      
                      {/* Phase label */}
                      <div className="absolute inset-0 flex items-center px-3 text-white">
                        <span className="text-lg mr-2">{phase.icon}</span>
                        <span className="font-semibold text-sm">{phase.name}</span>
                        <span className="ml-auto text-xs font-medium">{phase.progress}%</span>
                      </div>

                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="font-semibold mb-1">{phase.name}</div>
                        <div className="text-gray-300">
                          {new Date(phase.startDate).toLocaleDateString()} → {new Date(phase.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-gray-300 mt-1">
                          Budget: ${(phase.budget.planned / 1000000).toFixed(1)}M
                        </div>
                      </div>
                    </div>

                    {/* Phase name on left */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-700 pointer-events-none">
                      <span className="text-lg mr-2">{phase.icon}</span>
                      {phase.name}
                    </div>

                    {/* Dates on right */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                      {new Date(phase.startDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                      {' → '}
                      {new Date(phase.endDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    </div>
                  </div>

                  {/* Expanded Milestones */}
                  {isExpanded && phase.milestones.length > 0 && (
                    <div className="ml-8 mt-2 space-y-2 pb-4">
                      {phase.milestones.map(milestone => (
                        <MilestoneCard key={milestone.id} milestone={milestone} compact />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Critical Path Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
          <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-2">
            <span>🎯</span>
            Critical Path Analysis
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {criticalPath.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-orange-200 bg-orange-50/30"
              >
                <div className="text-2xl font-bold text-orange-600">#{index + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">{item.task}</h4>
                    {item.floatDays === 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                        Zero Float
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>📅 {item.deadline}</span>
                    <span className={`font-medium ${
                      item.daysRemaining <= 30 ? 'text-red-600' :
                      item.daysRemaining <= 60 ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      ⏰ {item.daysRemaining} days remaining
                    </span>
                    <span>👤 {item.owner}</span>
                    <span>Float: {item.floatDays} days</span>
                  </div>
                  {item.blockers && item.blockers.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-red-700">🚫 Blockers:</span>
                      {item.blockers.map((blocker, idx) => (
                        <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                          {blocker}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Total Float: 12 days • Risk Level: MEDIUM
                </h4>
                <p className="text-xs text-blue-700">
                  The adjacent parcel closing is on the critical path with zero float. 
                  Consider contingency plans if this deadline slips.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// ==================== MILESTONES VIEW ====================

interface MilestonesViewProps {
  phases: PhaseTimeline[];
}

const MilestonesView: React.FC<MilestonesViewProps> = ({ phases }) => {
  const allMilestones = phases.flatMap(p => p.milestones);
  
  const grouped = useMemo(() => {
    return {
      completed: allMilestones.filter(m => m.status === 'completed'),
      inProgress: allMilestones.filter(m => m.status === 'in-progress'),
      upcoming: allMilestones.filter(m => m.status === 'upcoming'),
      atRisk: allMilestones.filter(m => m.status === 'at-risk'),
      blocked: allMilestones.filter(m => m.status === 'blocked'),
    };
  }, [allMilestones]);

  return (
    <div className="space-y-6">
      
      {/* Milestone Progress Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Milestone Progress</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MilestoneStatCard label="Completed" count={grouped.completed.length} color="green" icon="✅" />
          <MilestoneStatCard label="In Progress" count={grouped.inProgress.length} color="blue" icon="🔄" />
          <MilestoneStatCard label="Upcoming" count={grouped.upcoming.length} color="gray" icon="📅" />
          <MilestoneStatCard label="At Risk" count={grouped.atRisk.length} color="yellow" icon="⚠️" />
          <MilestoneStatCard label="Blocked" count={grouped.blocked.length} color="red" icon="🚫" />
        </div>
      </div>

      {/* Blocked/At Risk (Priority) */}
      {(grouped.blocked.length > 0 || grouped.atRisk.length > 0) && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800">
              🚨 Priority Attention Required ({grouped.blocked.length + grouped.atRisk.length})
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {[...grouped.blocked, ...grouped.atRisk].map(milestone => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {grouped.inProgress.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800">
              🔄 In Progress ({grouped.inProgress.length})
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {grouped.inProgress.map(milestone => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {grouped.upcoming.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              📅 Upcoming ({grouped.upcoming.length})
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {grouped.upcoming.map(milestone => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {grouped.completed.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <h3 className="text-sm font-semibold text-green-800">
              ✅ Completed ({grouped.completed.length})
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {grouped.completed.map(milestone => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

interface MilestoneStatCardProps {
  label: string;
  count: number;
  color: 'green' | 'blue' | 'gray' | 'yellow' | 'red';
  icon: string;
}

const MilestoneStatCard: React.FC<MilestoneStatCardProps> = ({ label, count, color, icon }) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-3xl font-bold">{count}</span>
      </div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
};

// ==================== MILESTONE CARD ====================

interface MilestoneCardProps {
  milestone: DevelopmentMilestone;
  compact?: boolean;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, compact = false }) => {
  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'blocked':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in-progress':
        return '🔄';
      case 'at-risk':
        return '⚠️';
      case 'blocked':
        return '🚫';
      default:
        return '📅';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition">
        <span className="text-xl">{getStatusIcon(milestone.status)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">{milestone.title}</span>
            {milestone.isCritical && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>📅 {milestone.targetDate}</span>
            {milestone.daysUntil !== undefined && (
              <span className={`font-medium ${
                milestone.daysUntil <= 30 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {milestone.daysUntil}d remaining
              </span>
            )}
            {milestone.owner && <span>👤 {milestone.owner}</span>}
          </div>
        </div>
        {milestone.progress !== undefined && milestone.progress > 0 && (
          <div className="text-sm font-semibold text-gray-600">
            {milestone.progress}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-1">{getStatusIcon(milestone.status)}</span>
        
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-gray-900">{milestone.title}</h4>
                {milestone.isCritical && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                    Critical Path
                  </span>
                )}
              </div>
              {milestone.description && (
                <p className="text-xs text-gray-600 mb-2">{milestone.description}</p>
              )}
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(milestone.status)}`}>
              {milestone.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>

          {/* Progress Bar */}
          {milestone.progress !== undefined && milestone.progress > 0 && milestone.progress < 100 && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span className="font-medium">{milestone.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    milestone.progress >= 80 ? 'bg-green-500' :
                    milestone.progress >= 50 ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`}
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
            <span>📅 Target: {milestone.targetDate}</span>
            {milestone.actualDate && (
              <span className="text-green-600">✅ Completed: {milestone.actualDate}</span>
            )}
            {milestone.daysUntil !== undefined && !milestone.actualDate && (
              <span className={`font-medium ${
                milestone.daysUntil <= 7 ? 'text-red-600' :
                milestone.daysUntil <= 30 ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                ⏰ {milestone.daysUntil} days remaining
              </span>
            )}
            {milestone.owner && <span>👤 {milestone.owner}</span>}
          </div>

          {/* Dependencies */}
          {milestone.dependencies && milestone.dependencies.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">Dependencies:</span> {milestone.dependencies.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== TEAM VIEW ====================

interface TeamViewProps {
  team: TeamMember[];
  phases: PhaseTimeline[];
}

const TeamView: React.FC<TeamViewProps> = ({ team, phases }) => {
  return (
    <div className="space-y-6">
      
      {/* Team Directory */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">👥 Team Directory ({team.length})</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {team.map(member => (
              <div key={member.id} className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-0.5">{member.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{member.role}</p>
                    <p className="text-xs text-gray-500 mb-3">{member.company}</p>
                    
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>📧</span>
                        <a href={`mailto:${member.email}`} className="hover:text-blue-600">
                          {member.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>📱</span>
                        <a href={`tel:${member.phone}`} className="hover:text-blue-600">
                          {member.phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {member.phases.map(phase => {
                        const phaseData = phases.find(p => p.phase === phase);
                        return (
                          <span
                            key={phase}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded flex items-center gap-1"
                          >
                            {phaseData?.icon} {phaseData?.name.split(' ')[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team by Phase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {phases.map(phase => {
          const phaseTeam = team.filter(m => m.phases.includes(phase.phase));
          if (phaseTeam.length === 0) return null;
          
          return (
            <div key={phase.phase} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className={`px-4 py-3 ${phase.color} bg-opacity-10 border-b border-gray-200`}>
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span>{phase.icon}</span>
                  {phase.name}
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {phaseTeam.map(member => (
                  <div key={member.id} className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-gray-600">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

// ==================== BUDGET VIEW ====================

interface BudgetViewProps {
  phases: PhaseTimeline[];
}

const BudgetView: React.FC<BudgetViewProps> = ({ phases }) => {
  const totalPlanned = phases.reduce((sum, p) => sum + p.budget.planned, 0);
  const totalActual = phases.reduce((sum, p) => sum + p.budget.actual, 0);
  const overallVariance = ((totalActual - totalPlanned) / totalPlanned) * 100;

  return (
    <div className="space-y-6">
      
      {/* Budget Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Budget Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-gray-600 mb-1">Total Budget</div>
            <div className="text-3xl font-bold text-gray-900">
              ${(totalPlanned / 1000000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Spent to Date</div>
            <div className="text-3xl font-bold text-blue-600">
              ${(totalActual / 1000000).toFixed(1)}M
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Overall Variance</div>
            <div className={`text-3xl font-bold ${
              overallVariance <= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {overallVariance > 0 ? '+' : ''}{overallVariance.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Budget by Phase Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Budget by Phase</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Phase</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Planned</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actual</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Remaining</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Variance</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {phases.map(phase => {
                const remaining = phase.budget.planned - phase.budget.actual;
                return (
                  <tr key={phase.phase} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{phase.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{phase.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      ${(phase.budget.planned / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      ${(phase.budget.actual / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      ${(remaining / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-semibold ${
                        phase.budget.variance <= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {phase.budget.variance > 0 ? '+' : ''}{phase.budget.variance.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        phase.status === 'complete' ? 'bg-green-100 text-green-700' :
                        phase.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {phase.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                  ${(totalPlanned / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                  ${(totalActual / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-gray-600">
                  ${((totalPlanned - totalActual) / 1000000).toFixed(2)}M
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`text-sm font-bold ${
                    overallVariance <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {overallVariance > 0 ? '+' : ''}{overallVariance.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Budget Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {phases.filter(p => p.budget.variance > 5 || p.budget.variance < -5).map(phase => (
          <div
            key={phase.phase}
            className={`p-4 rounded-lg border ${
              phase.budget.variance > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {phase.budget.variance > 0 ? '⚠️' : '✅'}
              </span>
              <div>
                <h4 className={`text-sm font-semibold mb-1 ${
                  phase.budget.variance > 0 ? 'text-red-900' : 'text-green-900'
                }`}>
                  {phase.icon} {phase.name}
                </h4>
                <p className={`text-xs ${
                  phase.budget.variance > 0 ? 'text-red-700' : 'text-green-700'
                }`}>
                  {phase.budget.variance > 0 ? 'Over budget by' : 'Under budget by'} {' '}
                  {Math.abs(phase.budget.variance).toFixed(1)}% 
                  (${Math.abs((phase.budget.actual - phase.budget.planned) / 1000000).toFixed(2)}M)
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ProjectTimelinePage;
