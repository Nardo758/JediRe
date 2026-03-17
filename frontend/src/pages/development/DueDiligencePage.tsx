import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  TrendingUp,
  MapPin,
  Zap,
  Shield,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  MultiParcelDashboard,
  ZoningEntitlementsTracker,
  EnvironmentalChecklist,
  GeotechnicalAnalysis,
  UtilityCapacityGrid,
  AssemblageDD,
  RiskMatrixHeatmap,
  AIInsightsPanel,
} from '../../components/development';
import { apiClient } from '../../services/api.client';
import type {
  DueDiligenceState,
  ZoningAnalysis,
  EnvironmentalAssessment,
  GeotechnicalReport,
  UtilityCapacity,
  AssemblageDueDiligence,
  RiskMatrix,
  DDInsights,
} from '../../types/development/dueDiligence.types';

interface DueDiligencePageProps {
  deal?: any;
  dealId?: string;
  embedded?: boolean;
}

export const DueDiligencePage: React.FC<DueDiligencePageProps> = ({ deal: propDeal, dealId: propDealId }) => {
  const { dealId: routeDealId } = useParams<{ dealId: string }>();
  const dealId = propDealId || routeDealId;
  const navigate = useNavigate();

  // State management
  const [dueDiligence, setDueDiligence] = useState<DueDiligenceState | null>(null);
  const [zoningAnalysis, setZoningAnalysis] = useState<ZoningAnalysis | null>(null);
  const [environmental, setEnvironmental] = useState<EnvironmentalAssessment[]>([]);
  const [geotechnical, setGeotechnical] = useState<GeotechnicalReport[]>([]);
  const [utilities, setUtilities] = useState<UtilityCapacity | null>(null);
  const [assemblageDD, setAssemblageDD] = useState<AssemblageDueDiligence | null>(null);
  const [riskMatrix, setRiskMatrix] = useState<RiskMatrix | null>(null);
  const [aiInsights, setAIInsights] = useState<DDInsights | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'entitlements' | 'environmental' | 'utilities' | 'risk' | 'physical_dd'>('overview');
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Load all due diligence data
  useEffect(() => {
    const loadDueDiligenceData = async () => {
      if (!dealId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Load all DD data in parallel
        const [ddResponse, zoningResponse, envResponse, geoResponse, utilResponse, riskResponse] = await Promise.all([
          apiClient.get(`/api/v1/deals/${dealId}/due-diligence`),
          apiClient.get(`/api/v1/deals/${dealId}/zoning-analysis`),
          apiClient.get(`/api/v1/deals/${dealId}/environmental`),
          apiClient.get(`/api/v1/deals/${dealId}/geotechnical`),
          apiClient.get(`/api/v1/deals/${dealId}/utilities`),
          apiClient.get(`/api/v1/deals/${dealId}/risk-matrix`),
        ]);

        if (ddResponse.data.success) {
          setDueDiligence(ddResponse.data.data);
        }
        if (zoningResponse.data.success) {
          setZoningAnalysis(zoningResponse.data.data);
        }
        if (envResponse.data.success) {
          setEnvironmental(envResponse.data.data || []);
        }
        if (geoResponse.data.success) {
          setGeotechnical(geoResponse.data.data || []);
        }
        if (utilResponse.data.success) {
          setUtilities(utilResponse.data.data);
        }
        if (riskResponse.data.success) {
          setRiskMatrix(riskResponse.data.data);
        }

        // Check if this is a multi-parcel assemblage
        if (dueDiligence && dueDiligence.parcels.length > 1) {
          const assemblageResponse = await apiClient.get(`/api/v1/deals/${dealId}/assemblage-dd`);
          if (assemblageResponse.data.success) {
            setAssemblageDD(assemblageResponse.data.data);
          }
        }

        // Generate AI insights
        await generateAIInsights();
      } catch (err: any) {
        console.error('Failed to load due diligence data:', err);
        setError(err.message || 'Failed to load due diligence data');
      } finally {
        setIsLoading(false);
      }
    };

    loadDueDiligenceData();
  }, [dealId]);

  const generateAIInsights = async () => {
    if (!dealId) return;

    try {
      const response = await apiClient.post(`/api/v1/deals/${dealId}/dd-insights`);
      if (response.data.success) {
        setAIInsights(response.data.data);
      }
    } catch (err) {
      console.warn('Failed to generate AI insights:', err);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await generateAIInsights();
    setIsLoading(false);
  };

  const handleGenerateReport = async () => {
    if (!dealId) return;

    try {
      const response = await apiClient.post(`/api/v1/deals/${dealId}/dd-report`, {
        format: 'pdf',
        includeAIInsights: true,
      });

      if (response.data.success && response.data.data.downloadUrl) {
        window.open(response.data.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'issue':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'blocked':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading due diligence data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/deals/${dealId}`)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Due Diligence</h1>
                <p className="text-sm text-gray-600">{propDeal?.name || 'Loading...'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Overall Progress */}
              {dueDiligence && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs text-gray-600">Overall Progress</div>
                    <div className="text-lg font-semibold text-gray-900">{dueDiligence.overallProgress}%</div>
                  </div>
                </div>
              )}

              {/* Risk Level */}
              {dueDiligence && (
                <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${getRiskColor(dueDiligence.overallRisk)}`}>
                  <Shield className="w-5 h-5" />
                  <div>
                    <div className="text-xs">Risk Level</div>
                    <div className="text-lg font-semibold capitalize">{dueDiligence.overallRisk}</div>
                  </div>
                </div>
              )}

              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Generate Report</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'entitlements', label: 'Entitlements', icon: CheckCircle },
              { id: 'environmental', label: 'Environmental', icon: Zap },
              { id: 'physical_dd', label: 'Physical DD', icon: Shield },
              { id: 'utilities', label: 'Utilities', icon: Zap },
              { id: 'risk', label: 'Risk Matrix', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Multi-Parcel Dashboard */}
                {dueDiligence && (
                  <MultiParcelDashboard
                    dueDiligence={dueDiligence}
                    onUpdate={(updated) => setDueDiligence(updated)}
                  />
                )}

                {/* Assemblage DD (if multiple parcels) */}
                {assemblageDD && (
                  <AssemblageDD
                    assemblageDD={assemblageDD}
                    onUpdate={(updated) => setAssemblageDD(updated)}
                  />
                )}

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Entitlement Status</h3>
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {zoningAnalysis?.upzoningPotential ? 'Upzoning Pending' : 'By-Right'}
                    </p>
                    {zoningAnalysis && (
                      <p className="text-sm text-gray-600 mt-1">
                        {zoningAnalysis.byRightUnits} units current
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Environmental</h3>
                      <Zap className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {environmental.filter(e => e.phaseI.findings === 'clean').length}/{environmental.length}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Parcels clean</p>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Geotechnical</h3>
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {geotechnical.filter(g => g.status === 'complete').length}/{geotechnical.length}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Reports complete</p>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Utility Capacity</h3>
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 capitalize">
                      {utilities?.overallStatus.replace('_', ' ') || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {utilities?.water.upgradeRequired || utilities?.sewer.upgradeRequired
                        ? 'Upgrades needed'
                        : 'No upgrades'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Entitlements Tab */}
            {activeTab === 'entitlements' && zoningAnalysis && (
              <ZoningEntitlementsTracker
                zoningAnalysis={zoningAnalysis}
                dealId={dealId!}
                onUpdate={(updated) => setZoningAnalysis(updated)}
              />
            )}

            {/* Environmental Tab */}
            {activeTab === 'environmental' && (
              <div className="space-y-6">
                <EnvironmentalChecklist
                  environmental={environmental}
                  dealId={dealId!}
                  onUpdate={(updated) => setEnvironmental(updated)}
                />

                {geotechnical.length > 0 && (
                  <GeotechnicalAnalysis
                    geotechnical={geotechnical}
                    dealId={dealId!}
                    onUpdate={(updated) => setGeotechnical(updated)}
                  />
                )}
              </div>
            )}

            {/* Physical DD Tab */}
            {activeTab === 'physical_dd' && (
              <EnvironmentalPhysicalDDSection
                deal={propDeal}
                dealId={dealId}
              />
            )}

            {/* Utilities Tab */}
            {activeTab === 'utilities' && utilities && (
              <UtilityCapacityGrid
                utilities={utilities}
                dealId={dealId!}
                onUpdate={(updated) => setUtilities(updated)}
              />
            )}

            {/* Risk Tab */}
            {activeTab === 'risk' && riskMatrix && (
              <RiskMatrixHeatmap
                riskMatrix={riskMatrix}
                dealId={dealId!}
                onUpdate={(updated) => setRiskMatrix(updated)}
              />
            )}
          </div>

          {/* Sidebar - AI Insights */}
          <div className="lg:col-span-1">
            {showAIInsights && aiInsights && (
              <AIInsightsPanel
                insights={aiInsights}
                onRefresh={generateAIInsights}
              />
            )}

            {/* Critical Path Indicator */}
            {dueDiligence?.criticalPathItem && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-1">Critical Path Item</h3>
                    <p className="text-sm text-orange-800">{dueDiligence.criticalPathItem}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

type DDItemStatus = 'pending' | 'in_progress' | 'complete' | 'na';

interface DDChecklistItem {
  id: string;
  label: string;
  status: DDItemStatus;
  assignedParty: string;
  dueDate: string;
  notes: string;
}

interface EnvironmentalPhysicalDDSectionProps {
  deal?: any;
  dealId?: string;
}

function getDealTypeFromDeal(deal: any): 'existing' | 'development' | 'redevelopment' {
  const raw = (deal?.projectType || deal?.dealType || deal?.deal_data?.project_type || '').toLowerCase().trim();
  if (['development', 'ground_up', 'ground-up', 'new_construction', 'land'].includes(raw)) return 'development';
  if (['redevelopment', 'redev', 'rehab', 'repositioning', 'adaptive_reuse', 'conversion'].includes(raw)) return 'redevelopment';
  return 'existing';
}

const CHECKLIST_BY_TYPE: Record<string, { label: string; items: string[] }> = {
  existing: {
    label: 'Existing Acquisition',
    items: [
      'Phase I Environmental Site Assessment (ESA)',
      'Physical condition report / property inspection',
      'Roof, HVAC, plumbing assessment',
      'ADA compliance audit',
      'Insurance review (property + liability)',
    ],
  },
  development: {
    label: 'Development (Ground-Up)',
    items: [
      'Phase I Environmental Site Assessment',
      'Phase II ESA (if Phase I identifies RECs)',
      'Geotechnical / soil report',
      'Wetlands / floodplain delineation',
      'Utility capacity study',
      'Traffic impact study',
    ],
  },
  redevelopment: {
    label: 'Redevelopment',
    items: [
      'Phase I Environmental Site Assessment',
      'Phase II ESA (if applicable)',
      'Hazardous materials / asbestos survey (pre-demolition)',
      'Structural / engineering assessment',
      'Seismic evaluation (if applicable)',
      'ADA upgrade assessment',
    ],
  },
};

const STATUS_OPTIONS: { value: DDItemStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'complete', label: 'Complete', color: 'bg-green-100 text-green-700' },
  { value: 'na', label: 'N/A', color: 'bg-gray-50 text-gray-400' },
];

const EnvironmentalPhysicalDDSection: React.FC<EnvironmentalPhysicalDDSectionProps> = ({ deal, dealId }) => {
  const dt = getDealTypeFromDeal(deal);
  const config = CHECKLIST_BY_TYPE[dt] || CHECKLIST_BY_TYPE.existing;

  const [items, setItems] = useState<DDChecklistItem[]>(() =>
    config.items.map((label, i) => ({
      id: `dd-env-${i}`,
      label,
      status: 'pending' as DDItemStatus,
      assignedParty: '',
      dueDate: '',
      notes: '',
    }))
  );

  const updateItem = (id: string, field: keyof DDChecklistItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const completedCount = items.filter(i => i.status === 'complete').length;
  const naCount = items.filter(i => i.status === 'na').length;
  const activeItems = items.length - naCount;
  const progressPct = activeItems > 0 ? Math.round((completedCount / activeItems) * 100) : 0;

  const getStatusIcon = (status: DDItemStatus) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'na': return <XCircle className="w-4 h-4 text-gray-300" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Environmental & Physical Due Diligence</h3>
            <p className="text-sm text-gray-500 mt-1">
              {config.label} checklist — {completedCount}/{activeItems} items complete
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700">{progressPct}%</span>
          </div>
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 transition-colors ${
                item.status === 'complete' ? 'bg-green-50 border-green-200' :
                item.status === 'in_progress' ? 'bg-blue-50 border-blue-200' :
                item.status === 'na' ? 'bg-gray-50 border-gray-100 opacity-60' :
                'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${item.status === 'na' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.label}
                    </span>
                    <select
                      value={item.status}
                      onChange={e => updateItem(item.id, 'status', e.target.value)}
                      className={`text-xs rounded-full px-3 py-1 border-0 font-medium cursor-pointer ${
                        STATUS_OPTIONS.find(s => s.value === item.status)?.color || ''
                      }`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-0.5">Assigned Party</label>
                      <input
                        type="text"
                        value={item.assignedParty}
                        onChange={e => updateItem(item.id, 'assignedParty', e.target.value)}
                        placeholder="e.g., ECS Environmental"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-0.5">Due Date</label>
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={e => updateItem(item.id, 'dueDate', e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-0.5">Notes / Attachment</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Notes or file ref..."
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              setItems(prev => [...prev, {
                id: `dd-env-custom-${Date.now()}`,
                label: 'New DD Item',
                status: 'pending',
                assignedParty: '',
                dueDate: '',
                notes: '',
              }]);
            }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add Custom DD Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default DueDiligencePage;
