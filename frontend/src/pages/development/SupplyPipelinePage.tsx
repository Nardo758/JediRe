/**
 * Supply Pipeline Page - Development Analysis Module
 * 
 * PURPOSE: Track future supply to time market entry and identify windows of opportunity
 * Focuses on "when to deliver" not just "what's coming"
 * 
 * KEY FEATURES:
 * 1. 10-Year Supply Wave Visualization (reused from Market Intelligence)
 * 2. Pipeline by Phase (Planned, Under Construction, Delivered)
 * 3. Developer Activity Tracking
 * 4. Absorption Impact Analysis
 * 5. Risk Scoring (oversupply detection)
 * 
 * DESIGN REFERENCE: /jedire/DEV_ANALYSIS_MODULES_DESIGN.md - Section 3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface SupplyWaveData {
  year: number;
  quarter: string;
  confirmed: number;
  underConstruction: number;
  planned: number;
  total: number;
}

interface PipelineProject {
  id: string;
  name: string;
  developer: string;
  units: number;
  phase: 'planned' | 'under_construction' | 'delivered';
  expectedDelivery: string;
  submarket: string;
  distanceMiles: number;
  unitMix: {
    studio: number;
    oneBed: number;
    twoBed: number;
    threeBed: number;
  };
  status: string;
  delayMonths?: number;
}

interface DeveloperActivity {
  developer: string;
  activeProjects: number;
  totalUnits: number;
  pipelineShare: number;
  avgDeliveryTime: number;
  delayRate: number;
  marketShare: number;
}

interface AbsorptionAnalysis {
  currentRate: number; // units per month
  historicalAvg: number;
  projectedRate: number;
  monthsToAbsorb: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  demandSupplyGap: number;
  peakSupplyQuarter: string;
}

interface RiskScore {
  overall: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    pipelineConcentration: number;
    absorptionRisk: number;
    timingRisk: number;
    unitMixCompetition: number;
  };
  recommendations: string[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SupplyPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { dealId } = useParams();
  
  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wave' | 'pipeline' | 'developers' | 'absorption' | 'risk'>('wave');
  const [timeHorizon, setTimeHorizon] = useState<'3yr' | '5yr' | '10yr'>('5yr');
  const [submarketFilter, setSubmarketFilter] = useState<string>('all');
  
  // Data state
  const [supplyWave, setSupplyWave] = useState<SupplyWaveData[]>([]);
  const [pipelineProjects, setPipelineProjects] = useState<PipelineProject[]>([]);
  const [developerActivity, setDeveloperActivity] = useState<DeveloperActivity[]>([]);
  const [absorption, setAbsorption] = useState<AbsorptionAnalysis | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    fetchSupplyData();
  }, [dealId, timeHorizon]);

  const fetchSupplyData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API calls
      // Simulating data for now
      setTimeout(() => {
        setSupplyWave(generateMockSupplyWave());
        setPipelineProjects(generateMockPipeline());
        setDeveloperActivity(generateMockDevelopers());
        setAbsorption(generateMockAbsorption());
        setRiskScore(generateMockRiskScore());
        setLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error fetching supply data:', error);
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getPhaseColor = (phase: string): string => {
    switch (phase) {
      case 'planned': return '#3b82f6';
      case 'under_construction': return '#f59e0b';
      case 'delivered': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading supply pipeline data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Supply Pipeline Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Track future supply to time market entry and identify delivery windows
                </p>
              </div>
            </div>
            
            {/* Time Horizon Selector */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">Time Horizon:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['3yr', '5yr', '10yr'] as const).map((horizon) => (
                  <button
                    key={horizon}
                    onClick={() => setTimeHorizon(horizon)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      timeHorizon === horizon
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {horizon === '3yr' ? '3 Years' : horizon === '5yr' ? '5 Years' : '10 Years'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mt-6 border-b border-gray-200">
            {[
              { id: 'wave', label: 'Supply Wave', icon: '📊' },
              { id: 'pipeline', label: 'Pipeline by Phase', icon: '🏗️' },
              { id: 'developers', label: 'Developer Activity', icon: '👷' },
              { id: 'absorption', label: 'Absorption Impact', icon: '📈' },
              { id: 'risk', label: 'Risk Scoring', icon: '⚠️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 1. SUPPLY WAVE VISUALIZATION */}
        {activeTab === 'wave' && (
          <SupplyWaveSection 
            data={supplyWave} 
            riskScore={riskScore}
            timeHorizon={timeHorizon}
          />
        )}

        {/* 2. PIPELINE BY PHASE */}
        {activeTab === 'pipeline' && (
          <PipelinePhaseSection 
            projects={pipelineProjects}
            submarketFilter={submarketFilter}
            onSubmarketChange={setSubmarketFilter}
          />
        )}

        {/* 3. DEVELOPER ACTIVITY */}
        {activeTab === 'developers' && (
          <DeveloperActivitySection developers={developerActivity} />
        )}

        {/* 4. ABSORPTION IMPACT */}
        {activeTab === 'absorption' && (
          <AbsorptionImpactSection absorption={absorption} supplyWave={supplyWave} />
        )}

        {/* 5. RISK SCORING */}
        {activeTab === 'risk' && (
          <RiskScoringSection riskScore={riskScore} />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// ---------------------------------------------------------------------------
// 1. Supply Wave Section (10-Year Visualization)
// ---------------------------------------------------------------------------

interface SupplyWaveSectionProps {
  data: SupplyWaveData[];
  riskScore: RiskScore | null;
  timeHorizon: '3yr' | '5yr' | '10yr';
}

const SupplyWaveSection: React.FC<SupplyWaveSectionProps> = ({ data, riskScore, timeHorizon }) => {
  const maxSupply = Math.max(...data.map(d => d.total));
  const peakQuarter = data.reduce((max, d) => d.total > max.total ? d : max, data[0]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Total Pipeline</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatNumber(data.reduce((sum, d) => sum + d.total, 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">units over {timeHorizon}</div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Peak Supply Quarter</div>
          <div className="text-3xl font-bold text-orange-600">
            {peakQuarter?.quarter || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatNumber(peakQuarter?.total || 0)} units delivering
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Under Construction</div>
          <div className="text-3xl font-bold text-yellow-600">
            {formatNumber(data.reduce((sum, d) => sum + d.underConstruction, 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">confirmed starts</div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Risk Level</div>
          <div className="text-3xl font-bold" style={{ color: getRiskColor(riskScore?.level || 'low') }}>
            {riskScore?.level.toUpperCase() || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Score: {riskScore?.overall.toFixed(0) || 0}/100
          </div>
        </div>
      </div>

      {/* Supply Wave Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">10-Year Supply Wave</h3>
            <p className="text-sm text-gray-500 mt-1">
              Quarterly delivery timeline by project phase
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Delivered</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-600">Under Construction</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Planned</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="quarter" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ value: 'Units', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Bar dataKey="confirmed" stackId="a" fill="#10b981" name="Delivered" radius={[0, 0, 0, 0]} />
            <Bar dataKey="underConstruction" stackId="a" fill="#f59e0b" name="Under Construction" radius={[0, 0, 0, 0]} />
            <Bar dataKey="planned" stackId="a" fill="#3b82f6" name="Planned" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* AI Insight */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Optimal Delivery Window</h4>
              <p className="text-sm text-blue-800">
                Based on supply analysis, Q2-Q3 2026 shows a supply gap window. 
                Consider timing your delivery to avoid the peak in {peakQuarter?.quarter || 'Q1 2027'}. 
                Delays in competing projects may create additional opportunities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Supply Gap Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Supply Gap Opportunities</h3>
        <div className="space-y-3">
          {data.filter(d => d.total < maxSupply * 0.3).slice(0, 3).map((gap, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-semibold text-gray-900">{gap.quarter}</div>
                  <div className="text-sm text-gray-600">
                    Only {formatNumber(gap.total)} units delivering
                  </div>
                </div>
              </div>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                Target This Window
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Pipeline Phase Section
// ---------------------------------------------------------------------------

interface PipelinePhaseSectionProps {
  projects: PipelineProject[];
  submarketFilter: string;
  onSubmarketChange: (submarket: string) => void;
}

const PipelinePhaseSection: React.FC<PipelinePhaseSectionProps> = ({ 
  projects, 
  submarketFilter, 
  onSubmarketChange 
}) => {
  const phaseStats = {
    planned: projects.filter(p => p.phase === 'planned'),
    underConstruction: projects.filter(p => p.phase === 'under_construction'),
    delivered: projects.filter(p => p.phase === 'delivered'),
  };

  const [selectedPhase, setSelectedPhase] = useState<'all' | 'planned' | 'under_construction' | 'delivered'>('all');

  const filteredProjects = selectedPhase === 'all' 
    ? projects 
    : projects.filter(p => p.phase === selectedPhase);

  return (
    <div className="space-y-6">
      {/* Phase Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedPhase('planned')}
          className={`bg-white rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'planned' ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📋</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">PLANNED</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatNumber(phaseStats.planned.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {phaseStats.planned.length} projects
          </div>
        </button>

        <button
          onClick={() => setSelectedPhase('under_construction')}
          className={`bg-white rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'under_construction' ? 'border-orange-500 shadow-lg' : 'border-gray-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🏗️</span>
            <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">UNDER CONSTRUCTION</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatNumber(phaseStats.underConstruction.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {phaseStats.underConstruction.length} projects
          </div>
        </button>

        <button
          onClick={() => setSelectedPhase('delivered')}
          className={`bg-white rounded-lg border-2 p-6 text-left transition-all ${
            selectedPhase === 'delivered' ? 'border-green-500 shadow-lg' : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">✅</span>
            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">DELIVERED</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatNumber(phaseStats.delivered.reduce((sum, p) => sum + p.units, 0))}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {phaseStats.delivered.length} projects (last 12mo)
          </div>
        </button>
      </div>

      {/* Project Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pipeline Projects</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filteredProjects.length} projects • {formatNumber(filteredProjects.reduce((sum, p) => sum + p.units, 0))} units
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedPhase('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPhase === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Show All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Developer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Units</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Submarket</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Distance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{project.name}</div>
                    {project.delayMonths && project.delayMonths > 0 && (
                      <div className="text-xs text-red-600 mt-1">
                        ⚠️ Delayed {project.delayMonths} months
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.developer}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatNumber(project.units)}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="px-2 py-1 text-xs font-semibold rounded-full"
                      style={{
                        backgroundColor: `${getPhaseColor(project.phase)}20`,
                        color: getPhaseColor(project.phase)
                      }}
                    >
                      {project.phase.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.expectedDelivery}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.submarket}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.distanceMiles.toFixed(1)} mi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Developer Activity Section
// ---------------------------------------------------------------------------

interface DeveloperActivitySectionProps {
  developers: DeveloperActivity[];
}

const DeveloperActivitySection: React.FC<DeveloperActivitySectionProps> = ({ developers }) => {
  const topDevelopers = [...developers].sort((a, b) => b.totalUnits - a.totalUnits).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Developers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topDevelopers.slice(0, 3).map((dev, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
              <span className="text-xs font-semibold text-gray-500">
                {dev.pipelineShare.toFixed(1)}% of pipeline
              </span>
            </div>
            <h4 className="font-bold text-gray-900 text-lg mb-2">{dev.developer}</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Units:</span>
                <span className="font-semibold text-gray-900">{formatNumber(dev.totalUnits)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Projects:</span>
                <span className="font-semibold text-gray-900">{dev.activeProjects}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg Delivery:</span>
                <span className="font-semibold text-gray-900">{dev.avgDeliveryTime} months</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delay Rate:</span>
                <span className={`font-semibold ${dev.delayRate > 30 ? 'text-red-600' : 'text-green-600'}`}>
                  {dev.delayRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Developer Activity Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Developer Activity Tracker</h3>
          <p className="text-sm text-gray-500 mt-1">
            Track major developers' pipeline and execution history
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Developer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Units</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pipeline %</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Market Share</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Delay Rate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {developers.map((dev, idx) => {
                const reliability = 100 - dev.delayRate;
                const reliabilityColor = reliability >= 80 ? 'text-green-600' : reliability >= 60 ? 'text-yellow-600' : 'text-red-600';
                
                return (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{dev.developer}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {dev.activeProjects}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {formatNumber(dev.totalUnits)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${dev.pipelineShare}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {dev.pipelineShare.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dev.marketShare.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {dev.avgDeliveryTime} mo
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${dev.delayRate > 30 ? 'text-red-600' : dev.delayRate > 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {dev.delayRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${reliabilityColor}`}>
                        {reliability >= 80 ? '✅ High' : reliability >= 60 ? '⚠️ Medium' : '❌ Low'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 Developer Intelligence</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-yellow-900">High-Delay Developer Alert</div>
              <div className="text-sm text-yellow-800 mt-1">
                {topDevelopers.find(d => d.delayRate > 30)?.developer || 'Metro Development'} has a 35% delay rate. 
                Their projects typically deliver 4-6 months late, creating market timing opportunities.
              </div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <div className="font-semibold text-blue-900">Market Concentration</div>
              <div className="text-sm text-blue-800 mt-1">
                Top 3 developers control {topDevelopers.slice(0, 3).reduce((sum, d) => sum + d.pipelineShare, 0).toFixed(0)}% 
                of pipeline. Monitor their delivery schedules closely for timing advantages.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Absorption Impact Section
// ---------------------------------------------------------------------------

interface AbsorptionImpactSectionProps {
  absorption: AbsorptionAnalysis | null;
  supplyWave: SupplyWaveData[];
}

const AbsorptionImpactSection: React.FC<AbsorptionImpactSectionProps> = ({ absorption, supplyWave }) => {
  if (!absorption) {
    return <div className="text-center py-12 text-gray-500">Loading absorption data...</div>;
  }

  // Calculate absorption scenarios
  const scenarios = [
    { name: 'Conservative', rate: absorption.currentRate * 0.8, months: (absorption.monthsToAbsorb / 0.8) },
    { name: 'Current Trend', rate: absorption.currentRate, months: absorption.monthsToAbsorb },
    { name: 'Optimistic', rate: absorption.currentRate * 1.2, months: (absorption.monthsToAbsorb / 1.2) },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Current Absorption</div>
          <div className="text-3xl font-bold text-gray-900">
            {absorption.currentRate.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">units/month</div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Historical Average</div>
          <div className="text-3xl font-bold text-gray-900">
            {absorption.historicalAvg.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">units/month (3yr)</div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Months to Absorb</div>
          <div className="text-3xl font-bold text-orange-600">
            {absorption.monthsToAbsorb.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">at current rate</div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-1">Demand-Supply Gap</div>
          <div className={`text-3xl font-bold ${absorption.demandSupplyGap > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {absorption.demandSupplyGap > 0 ? '+' : ''}{absorption.demandSupplyGap.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">units/quarter</div>
        </div>
      </div>

      {/* Absorption Scenarios */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Absorption Scenarios</h3>
        <div className="space-y-4">
          {scenarios.map((scenario, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-900">{scenario.name}</div>
                <div className="text-sm text-gray-600">
                  {scenario.rate.toFixed(0)} units/month
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((scenario.rate / (absorption.currentRate * 1.5)) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="text-sm font-semibold text-gray-900 min-w-[80px]">
                  {scenario.months.toFixed(1)} months
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Absorption Risk Assessment</h3>
        <div 
          className="p-6 rounded-lg border-l-4"
          style={{ 
            borderColor: getRiskColor(absorption.riskLevel),
            backgroundColor: `${getRiskColor(absorption.riskLevel)}10`
          }}
        >
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-3xl">
              {absorption.riskLevel === 'low' ? '🟢' : absorption.riskLevel === 'medium' ? '🟡' : absorption.riskLevel === 'high' ? '🟠' : '🔴'}
            </span>
            <div>
              <div className="text-xl font-bold" style={{ color: getRiskColor(absorption.riskLevel) }}>
                {absorption.riskLevel.toUpperCase()} RISK
              </div>
              <div className="text-sm text-gray-600">Peak supply in {absorption.peakSupplyQuarter}</div>
            </div>
          </div>
          
          <div className="text-sm text-gray-700 space-y-2">
            {absorption.riskLevel === 'low' && (
              <p>Healthy absorption environment. Current demand exceeds incoming supply. Market can absorb new deliveries within 18 months.</p>
            )}
            {absorption.riskLevel === 'medium' && (
              <p>Moderate absorption pressure. Monitor lease-up velocity closely and consider concession strategies if absorption slows.</p>
            )}
            {absorption.riskLevel === 'high' && (
              <p>Elevated absorption risk. Supply surge expected to exceed demand. Plan for extended lease-up period (24+ months) and competitive concessions.</p>
            )}
            {absorption.riskLevel === 'critical' && (
              <p>Critical oversupply condition. Substantial excess supply relative to demand. Consider delaying delivery or repositioning unit mix to differentiate.</p>
            )}
          </div>
        </div>
      </div>

      {/* Impact Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Supply Impact Timeline</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={supplyWave}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Absorption (mo)', angle: 90, position: 'insideRight' }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total Supply" dot={{ r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="absorptionMonths" stroke="#ef4444" strokeWidth={2} name="Months to Absorb" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Risk Scoring Section
// ---------------------------------------------------------------------------

interface RiskScoringSectionProps {
  riskScore: RiskScore | null;
}

const RiskScoringSection: React.FC<RiskScoringSectionProps> = ({ riskScore }) => {
  if (!riskScore) {
    return <div className="text-center py-12 text-gray-500">Loading risk assessment...</div>;
  }

  const riskFactors = [
    { name: 'Pipeline Concentration', score: riskScore.factors.pipelineConcentration, description: 'Multiple projects delivering in same quarter' },
    { name: 'Absorption Risk', score: riskScore.factors.absorptionRisk, description: 'Ability of market to absorb new supply' },
    { name: 'Timing Risk', score: riskScore.factors.timingRisk, description: 'Delivery timing relative to peak supply' },
    { name: 'Unit Mix Competition', score: riskScore.factors.unitMixCompetition, description: 'Overlap with competing unit types' },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-40 h-40 rounded-full border-8 mb-6"
            style={{ borderColor: getRiskColor(riskScore.level) }}>
            <div>
              <div className="text-5xl font-bold" style={{ color: getRiskColor(riskScore.level) }}>
                {riskScore.overall.toFixed(0)}
              </div>
              <div className="text-sm font-semibold uppercase mt-2 text-gray-600">
                Risk Score
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <span 
              className="px-6 py-3 rounded-full text-lg font-bold inline-block"
              style={{
                backgroundColor: `${getRiskColor(riskScore.level)}20`,
                color: getRiskColor(riskScore.level)
              }}
            >
              {riskScore.level.toUpperCase()} RISK
            </span>
          </div>
          
          <p className="text-gray-600 max-w-2xl mx-auto">
            Supply pipeline risk assessment based on delivery timing, absorption capacity, 
            competitive positioning, and market concentration factors.
          </p>
        </div>
      </div>

      {/* Risk Factor Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Risk Factor Analysis</h3>
        <div className="space-y-6">
          {riskFactors.map((factor, idx) => {
            const percentage = (factor.score / 100) * 100;
            const color = factor.score > 70 ? '#ef4444' : factor.score > 40 ? '#f59e0b' : '#10b981';
            
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{factor.name}</div>
                    <div className="text-sm text-gray-500">{factor.description}</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color }}>
                    {factor.score.toFixed(0)}
                  </div>
                </div>
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: color 
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Strategic Recommendations</h3>
        <div className="space-y-3">
          {riskScore.recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xl flex-shrink-0">💡</span>
              <p className="text-sm text-blue-900">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Matrix</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-semibold text-green-900 mb-2">✅ Low Risk Factors</div>
            <ul className="text-sm text-green-800 space-y-1">
              {riskFactors.filter(f => f.score < 40).map((f, i) => (
                <li key={i}>• {f.name} ({f.score.toFixed(0)})</li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm font-semibold text-red-900 mb-2">⚠️ High Risk Factors</div>
            <ul className="text-sm text-red-800 space-y-1">
              {riskFactors.filter(f => f.score >= 40).map((f, i) => (
                <li key={i}>• {f.name} ({f.score.toFixed(0)})</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MOCK DATA GENERATORS (Replace with real API calls)
// ============================================================================

function generateMockSupplyWave(): SupplyWaveData[] {
  const quarters = [];
  const startYear = 2025;
  const startQuarter = 1;
  
  for (let i = 0; i < 20; i++) {
    const year = startYear + Math.floor((startQuarter + i - 1) / 4);
    const quarter = ((startQuarter + i - 1) % 4) + 1;
    
    // Simulate wave pattern with peak in middle
    const waveFactor = Math.sin((i / 20) * Math.PI);
    const confirmed = Math.floor(waveFactor * 800 + Math.random() * 200);
    const underConstruction = Math.floor(waveFactor * 600 + Math.random() * 150);
    const planned = Math.floor(waveFactor * 400 + Math.random() * 100);
    
    quarters.push({
      year,
      quarter: `${year}Q${quarter}`,
      confirmed,
      underConstruction,
      planned,
      total: confirmed + underConstruction + planned,
    });
  }
  
  return quarters;
}

function generateMockPipeline(): PipelineProject[] {
  const developers = ['Greystar', 'Avalon Bay', 'Camden', 'Lincoln Property', 'Mill Creek', 'Trammell Crow'];
  const submarkets = ['Downtown', 'Midtown', 'East Village', 'West End', 'Uptown'];
  const phases: ('planned' | 'under_construction' | 'delivered')[] = ['planned', 'under_construction', 'delivered'];
  
  return Array.from({ length: 15 }, (_, i) => ({
    id: `proj-${i}`,
    name: `Project ${String.fromCharCode(65 + i)}`,
    developer: developers[Math.floor(Math.random() * developers.length)],
    units: Math.floor(Math.random() * 400) + 100,
    phase: phases[Math.floor(Math.random() * phases.length)],
    expectedDelivery: `Q${Math.floor(Math.random() * 4) + 1} 202${Math.floor(Math.random() * 3) + 5}`,
    submarket: submarkets[Math.floor(Math.random() * submarkets.length)],
    distanceMiles: Math.random() * 5 + 0.5,
    unitMix: {
      studio: Math.random() * 20,
      oneBed: Math.random() * 50 + 20,
      twoBed: Math.random() * 30 + 20,
      threeBed: Math.random() * 15,
    },
    status: Math.random() > 0.7 ? 'On Track' : 'Delayed',
    delayMonths: Math.random() > 0.7 ? Math.floor(Math.random() * 6) + 1 : 0,
  }));
}

function generateMockDevelopers(): DeveloperActivity[] {
  const developers = ['Greystar', 'Avalon Bay', 'Camden', 'Lincoln Property', 'Mill Creek', 'Trammell Crow', 'Cortland'];
  
  return developers.map(name => ({
    developer: name,
    activeProjects: Math.floor(Math.random() * 5) + 2,
    totalUnits: Math.floor(Math.random() * 2000) + 500,
    pipelineShare: Math.random() * 20 + 5,
    avgDeliveryTime: Math.floor(Math.random() * 6) + 18,
    delayRate: Math.random() * 40,
    marketShare: Math.random() * 15 + 5,
  })).sort((a, b) => b.totalUnits - a.totalUnits);
}

function generateMockAbsorption(): AbsorptionAnalysis {
  return {
    currentRate: 45 + Math.random() * 20,
    historicalAvg: 52,
    projectedRate: 48,
    monthsToAbsorb: 28 + Math.random() * 10,
    riskLevel: 'medium',
    demandSupplyGap: (Math.random() - 0.3) * 100,
    peakSupplyQuarter: '2026Q2',
  };
}

function generateMockRiskScore(): RiskScore {
  const overall = Math.random() * 40 + 30;
  
  return {
    overall,
    level: overall > 70 ? 'critical' : overall > 50 ? 'high' : overall > 30 ? 'medium' : 'low',
    factors: {
      pipelineConcentration: Math.random() * 100,
      absorptionRisk: Math.random() * 100,
      timingRisk: Math.random() * 100,
      unitMixCompetition: Math.random() * 100,
    },
    recommendations: [
      'Consider targeting Q3 2026 delivery to avoid peak supply in Q2',
      'Increase 1BR allocation to differentiate from competing projects',
      'Monitor Greystar and Avalon Bay projects for potential delays',
      'Plan for 24-month lease-up period given absorption risk',
    ],
  };
}

// Helper functions at module level
function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return '#10b981';
    case 'medium': return '#f59e0b';
    case 'high': return '#ef4444';
    case 'critical': return '#dc2626';
    default: return '#6b7280';
  }
}

function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'planned': return '#3b82f6';
    case 'under_construction': return '#f59e0b';
    case 'delivered': return '#10b981';
    default: return '#6b7280';
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

export default SupplyPipelinePage;
