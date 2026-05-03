import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle, ArrowRight, Building2, DollarSign, FileText, Users, TrendingUp, Database, FlaskConical } from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface DealStatusSectionProps {
  deal?: any;
  onUpdate?: () => void;
  onBack?: () => void;
}

type Phase = 'land' | 'design' | 'finance' | 'construction' | 'lease-up' | 'exit';
type PhaseStatus = 'complete' | 'active' | 'upcoming';

interface LifecyclePhase {
  id: Phase;
  label: string;
  status: PhaseStatus;
  progress: number;
  startDate?: string;
  endDate?: string;
}

const defaultLifecyclePhases: LifecyclePhase[] = [
  { id: 'land', label: 'Land Acquisition', status: 'active', progress: 25 },
  { id: 'design', label: 'Design & Entitlements', status: 'upcoming', progress: 0 },
  { id: 'finance', label: 'Financing', status: 'upcoming', progress: 0 },
  { id: 'construction', label: 'Construction', status: 'upcoming', progress: 0 },
  { id: 'lease-up', label: 'Lease-Up', status: 'upcoming', progress: 0 },
  { id: 'exit', label: 'Stabilization / Exit', status: 'upcoming', progress: 0 },
];

const healthIndicators = [
  { label: 'Schedule', status: 'green', detail: 'On Track' },
  { label: 'Budget', status: 'green', detail: 'Within 2%' },
  { label: 'Permits', status: 'yellow', detail: 'Pending Review' },
  { label: 'Financing', status: 'green', detail: 'Secured' },
];

const constructionPhases = [
  { name: 'Site Preparation', progress: 100, status: 'complete' },
  { name: 'Foundation', progress: 100, status: 'complete' },
  { name: 'Structural Framing', progress: 65, status: 'active' },
  { name: 'MEP Rough-In', progress: 20, status: 'active' },
  { name: 'Exterior Envelope', progress: 0, status: 'upcoming' },
  { name: 'Interior Finishes', progress: 0, status: 'upcoming' },
];

const recentMilestones = [
  { date: '2024-01-15', event: 'Site acquisition closed', type: 'financial' },
  { date: '2024-02-01', event: 'Zoning approval received', type: 'regulatory' },
  { date: '2024-03-10', event: 'Construction loan funded', type: 'financial' },
  { date: '2024-04-01', event: 'Ground breaking ceremony', type: 'construction' },
  { date: '2024-06-15', event: 'Foundation complete', type: 'construction' },
];

function deriveLifecycleFromDeal(deal: any, dealState: any): { phases: LifecyclePhase[]; isLive: boolean } {
  const phases = defaultLifecyclePhases.map(p => ({ ...p }));
  let isLive = false;

  if (dealState) {
    isLive = true;
  }

  if (deal?.status) {
    isLive = true;
    const statusMap: Record<string, number> = {
      'prospecting': 0, 'prospect': 0, 'sourcing': 0,
      'design': 1, 'entitlements': 1, 'entitlement': 1, 'planning': 1,
      'financing': 2, 'finance': 2, 'underwriting': 2,
      'construction': 3, 'building': 3,
      'lease-up': 4, 'leasing': 4, 'marketing': 4,
      'stabilized': 5, 'exit': 5, 'disposition': 5, 'closed': 5,
    };
    const dealStatus = (deal.status || '').toLowerCase();
    const activeIdx = statusMap[dealStatus] ?? -1;
    if (activeIdx >= 0) {
      phases.forEach((p, i) => {
        if (i < activeIdx) {
          p.status = 'complete';
          p.progress = 100;
        } else if (i === activeIdx) {
          p.status = 'active';
          p.progress = Math.max(p.progress, 25);
        } else {
          p.status = 'upcoming';
          p.progress = 0;
        }
      });
    }
  }

  if (deal?.zoningCode || deal?.propertyTypeKey) {
    phases[0] = { ...phases[0], status: phases[0].status === 'complete' ? 'complete' : 'active', progress: Math.max(phases[0].progress, deal.address ? 50 : 25) };
  }

  if (dealState?.design_3d) {
    phases[0] = { ...phases[0], status: 'complete', progress: 100 };
    phases[1] = { ...phases[1], status: phases[1].status === 'complete' ? 'complete' : 'active', progress: Math.max(phases[1].progress, 40) };
  }

  if (dealState?.timeline_data) {
    const timeline = typeof dealState.timeline_data === 'string' ? JSON.parse(dealState.timeline_data) : dealState.timeline_data;
    if (timeline?.phases) {
      timeline.phases.forEach((tp: any) => {
        const idx = phases.findIndex(p => p.id === tp.id || p.label.toLowerCase().includes(tp.name?.toLowerCase()));
        if (idx >= 0 && tp.progress !== undefined) {
          phases[idx] = {
            ...phases[idx],
            progress: tp.progress,
            status: tp.progress >= 100 ? 'complete' : tp.progress > 0 ? 'active' : 'upcoming',
            startDate: tp.startDate,
            endDate: tp.endDate,
          };
        }
      });
    }
  }

  if (dealState?.financial_assumptions || dealState?.proforma_data) {
    if (phases[2].status === 'upcoming') {
      phases[2] = { ...phases[2], status: 'active', progress: 20 };
    }
  }

  return { phases, isLive };
}

export const DealStatusSection: React.FC<DealStatusSectionProps> = ({ deal }) => {
  const [expandedPhase, setExpandedPhase] = useState<Phase | null>(null);
  const [lifecyclePhases, setLifecyclePhases] = useState<LifecyclePhase[]>(defaultLifecyclePhases);
  const [dealState, setDealState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'loading' | 'live' | 'defaults'>('loading');

  useEffect(() => {
    if (!deal?.id) {
      setDataSource('defaults');
      setLoading(false);
      return;
    }
    loadDealState();
  }, [deal?.id]);

  const loadDealState = async () => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${deal.id}/state`);
      const state = response.data;
      setDealState(state);
      const { phases, isLive } = deriveLifecycleFromDeal(deal, state);
      setLifecyclePhases(phases);
      setDataSource(isLive ? 'live' : 'defaults');
      const activePhase = phases.find(p => p.status === 'active');
      if (activePhase) setExpandedPhase(activePhase.id);
    } catch (err) {
      console.warn('Could not load deal state, using defaults');
      const { phases, isLive } = deriveLifecycleFromDeal(deal, null);
      setLifecyclePhases(phases);
      setDataSource(isLive ? 'live' : 'defaults');
      const activePhase = phases.find(p => p.status === 'active');
      if (activePhase) setExpandedPhase(activePhase.id);
    } finally {
      setLoading(false);
    }
  };

  const overallProgress = Math.round(
    lifecyclePhases.reduce((sum, p) => sum + p.progress, 0) / lifecyclePhases.length
  );

  const getStatusIcon = (status: string) => {
    if (status === 'green') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'yellow') return <AlertTriangle size={14} className="text-yellow-500" />;
    return <Clock size={14} className="text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Deal Status & Lifecycle</h2>
          <p className="text-sm text-slate-500">Project progress tracking and health monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {dataSource !== 'loading' && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
              dataSource === 'live'
                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
            }`}>
              {dataSource === 'live' ? (
                <><Database size={10} /> LIVE DATA</>
              ) : (
                <><FlaskConical size={10} /> DEFAULT DATA</>
              )}
            </span>
          )}
          <button className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            Export Report
          </button>
          <button className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            Share Status
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Project Lifecycle</h3>
          <span className="text-sm text-slate-600">Overall: <strong>{overallProgress}%</strong></span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
          <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {lifecyclePhases.map((phase, i) => (
            <React.Fragment key={phase.id}>
              <button
                onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                className={`flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 ${
                  expandedPhase === phase.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  phase.status === 'complete' ? 'bg-green-100 text-green-600' :
                  phase.status === 'active' ? 'bg-blue-100 text-blue-600' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {phase.status === 'complete' ? <CheckCircle size={20} /> :
                   phase.status === 'active' ? `${phase.progress}%` :
                   <Clock size={18} />}
                </div>
                <span className={`text-xs font-medium text-center ${
                  phase.status === 'upcoming' ? 'text-slate-400' : 'text-slate-700'
                }`}>
                  {phase.label}
                </span>
                {phase.startDate && (
                  <span className="text-[10px] text-slate-400">{phase.startDate}</span>
                )}
              </button>
              {i < lifecyclePhases.length - 1 && (
                <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {healthIndicators.map(indicator => (
          <div key={indicator.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(indicator.status)}
              <span className="text-sm font-medium text-slate-700">{indicator.label}</span>
            </div>
            <span className={`text-sm font-semibold ${
              indicator.status === 'green' ? 'text-green-600' :
              indicator.status === 'yellow' ? 'text-yellow-600' : 'text-slate-600'
            }`}>
              {indicator.detail}
            </span>
          </div>
        ))}
      </div>

      {expandedPhase === 'construction' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Construction Phase Details</h3>
          <div className="space-y-3">
            {constructionPhases.map(phase => (
              <div key={phase.name} className="flex items-center gap-4">
                <span className="text-sm text-slate-700 w-40 flex-shrink-0">{phase.name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      phase.progress === 100 ? 'bg-green-500' :
                      phase.progress > 0 ? 'bg-blue-500' : 'bg-slate-200'
                    }`}
                    style={{ width: `${phase.progress}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-12 text-right ${
                  phase.progress === 100 ? 'text-green-600' :
                  phase.progress > 0 ? 'text-blue-600' : 'text-slate-400'
                }`}>
                  {phase.progress}%
                </span>
                {phase.status === 'complete' && <CheckCircle size={14} className="text-green-500" />}
                {phase.status === 'active' && <Clock size={14} className="text-blue-500" />}
                {phase.status === 'upcoming' && <Clock size={14} className="text-slate-300" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Milestones</h3>
        <div className="space-y-3">
          {recentMilestones.map((milestone, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="text-xs text-slate-400 w-28 flex-shrink-0">{milestone.date}</span>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                milestone.type === 'construction' ? 'bg-blue-400' :
                milestone.type === 'financial' ? 'bg-green-400' : 'bg-purple-400'
              }`} />
              <span className="text-sm text-slate-700">{milestone.event}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                milestone.type === 'construction' ? 'bg-blue-50 text-blue-600' :
                milestone.type === 'financial' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
              }`}>
                {milestone.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DealStatusSection;
