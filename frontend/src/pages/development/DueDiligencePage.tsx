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
import { getDDChecklistPreset, DD_CHECKLISTS, getDealType } from '../../shared/config/deal-type-visibility';
import type { DDChecklistPreset, DDChecklistCategory } from '../../shared/config/deal-type-visibility';
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
        return 'text-green-400 bg-green-900/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'high':
        return 'text-orange-400 bg-orange-900/20';
      case 'critical':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-[#6B7585] bg-[#131920]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-300" />;
      case 'issue':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'blocked':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-[#4a5568]" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-300 animate-spin mx-auto mb-4" />
          <p className="text-[#6B7585]">Loading due diligence data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#E8E6E1] mb-2">Error Loading Data</h2>
          <p className="text-[#6B7585] mb-4">{error}</p>
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
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: "#0F1319", borderBottom: "1px solid #1e2a3d" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/deals/${dealId}`)}
                className="p-2 text-[#6B7585] hover:bg-[#1e2a3d] rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#E8E6E1]">Due Diligence</h1>
                <p className="text-sm text-[#6B7585]">{propDeal?.name || 'Loading...'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Overall Progress */}
              {dueDiligence && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-[#131920] rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-300" />
                  <div>
                    <div className="text-xs text-[#6B7585]">Overall Progress</div>
                    <div className="text-lg font-semibold text-[#E8E6E1]">{dueDiligence.overallProgress}%</div>
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
                className="px-4 py-2 text-[#9EA8B4] hover:bg-[#1e2a3d] rounded-lg flex items-center space-x-2"
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
              { id: 'overview' as const, label: 'Overview', icon: FileText },
              { id: 'entitlements' as const, label: 'Entitlements', icon: CheckCircle },
              { id: 'environmental' as const, label: 'Environmental', icon: Zap },
              { id: 'physical_dd' as const, label: 'Physical DD', icon: Shield },
              { id: 'utilities' as const, label: 'Utilities', icon: Zap },
              { id: 'risk' as const, label: 'Risk Matrix', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-[#6B7585] hover:bg-[#1e2a3d]'
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
                  <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[#6B7585]">Entitlement Status</h3>
                      <CheckCircle className="w-5 h-5 text-blue-300" />
                    </div>
                    <p className="text-2xl font-bold text-[#E8E6E1]">
                      {zoningAnalysis?.upzoningPotential ? 'Upzoning Pending' : 'By-Right'}
                    </p>
                    {zoningAnalysis && (
                      <p className="text-sm text-[#6B7585] mt-1">
                        {zoningAnalysis.byRightUnits} units current
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[#6B7585]">Environmental</h3>
                      <Zap className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-[#E8E6E1]">
                      {environmental.filter(e => e.phaseI.findings === 'clean').length}/{environmental.length}
                    </p>
                    <p className="text-sm text-[#6B7585] mt-1">Parcels clean</p>
                  </div>

                  <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[#6B7585]">Geotechnical</h3>
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-[#E8E6E1]">
                      {geotechnical.filter(g => g.status === 'complete').length}/{geotechnical.length}
                    </p>
                    <p className="text-sm text-[#6B7585] mt-1">Reports complete</p>
                  </div>

                  <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[#6B7585]">Utility Capacity</h3>
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-[#E8E6E1] capitalize">
                      {utilities?.overallStatus.replace('_', ' ') || 'Unknown'}
                    </p>
                    <p className="text-sm text-[#6B7585] mt-1">
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

interface DDAttachment {
  fileName: string;
  fileUrl: string;
}

interface DDChecklistItem {
  id: string;
  category: string;
  label: string;
  status: DDItemStatus;
  assignedParty: string;
  dueDate: string;
  notes: string;
  attachments: DDAttachment[];
}

interface EnvironmentalPhysicalDDSectionProps {
  deal?: any;
  dealId?: string;
}

const PRESET_LABELS: Record<DDChecklistPreset, string> = {
  existing_acquisition: 'Existing Acquisition',
  ground_up: 'Development (Ground-Up)',
  redevelopment: 'Redevelopment',
};

const ENVIRONMENTAL_PHYSICAL_CATEGORIES = new Set([
  'Physical Inspection',
  'Environmental',
  'Insurance',
  'Environmental & Hazmat',
  'Geotechnical',
  'Site & Engineering',
  'Existing Structure',
]);

function buildChecklistFromPreset(preset: DDChecklistPreset): DDChecklistItem[] {
  const categories = DD_CHECKLISTS[preset] || DD_CHECKLISTS.existing_acquisition;
  const items: DDChecklistItem[] = [];
  const filtered = categories.filter((cat: DDChecklistCategory) =>
    ENVIRONMENTAL_PHYSICAL_CATEGORIES.has(cat.category)
  );
  filtered.forEach((cat: DDChecklistCategory) => {
    cat.items.forEach((label: string, idx: number) => {
      items.push({
        id: `dd-${cat.category.replace(/\s+/g, '-').toLowerCase()}-${idx}`,
        category: cat.category,
        label,
        status: 'pending',
        assignedParty: '',
        dueDate: '',
        notes: '',
        attachments: [],
      });
    });
  });
  return items;
}

const STATUS_OPTIONS: { value: DDItemStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-[#1e2a3d] text-[#9EA8B4]' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-900/20 text-blue-300' },
  { value: 'complete', label: 'Complete', color: 'bg-green-900/20 text-green-300' },
  { value: 'na', label: 'N/A', color: 'bg-[#131920] text-[#4a5568]' },
];

const EnvironmentalPhysicalDDSection: React.FC<EnvironmentalPhysicalDDSectionProps> = ({ deal: propDeal, dealId }) => {
  const [loadedDeal, setLoadedDeal] = useState<any>(propDeal);

  useEffect(() => {
    if (propDeal) {
      setLoadedDeal(propDeal);
      return;
    }
    if (!dealId) return;
    apiClient.get(`/api/v1/capsules/${dealId}`)
      .then(res => {
        if (res.data?.data) setLoadedDeal(res.data.data);
        else if (res.data) setLoadedDeal(res.data);
      })
      .catch(() => {});
  }, [propDeal, dealId]);

  const dealType = getDealType(loadedDeal || {});
  const preset = getDDChecklistPreset(dealType);
  const presetLabel = PRESET_LABELS[preset];

  const [items, setItems] = useState<DDChecklistItem[]>(() => buildChecklistFromPreset(preset));

  useEffect(() => {
    setItems(buildChecklistFromPreset(preset));
  }, [preset]);

  const updateItem = (id: string, field: keyof DDChecklistItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addAttachment = (itemId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const fileUrl = URL.createObjectURL(file);
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, attachments: [...item.attachments, { fileName: file.name, fileUrl }] }
          : item
      ));
    };
    input.click();
  };

  const removeAttachment = (itemId: string, attachmentIdx: number) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, attachments: item.attachments.filter((_, i) => i !== attachmentIdx) }
        : item
    ));
  };

  const completedCount = items.filter(i => i.status === 'complete').length;
  const naCount = items.filter(i => i.status === 'na').length;
  const activeItems = items.length - naCount;
  const progressPct = activeItems > 0 ? Math.round((completedCount / activeItems) * 100) : 0;

  const getStatusIcon = (status: DDItemStatus) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-300" />;
      case 'na': return <XCircle className="w-4 h-4 text-[#4a5568]" />;
      default: return <AlertCircle className="w-4 h-4 text-[#4a5568]" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-6" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#E8E6E1]">Environmental & Physical Due Diligence</h3>
            <p className="text-sm text-[#6B7585] mt-1">
              {presetLabel} checklist — {completedCount}/{activeItems} items complete
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 bg-[#253347] rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-[#9EA8B4]">{progressPct}%</span>
          </div>
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 transition-colors ${
                item.status === 'complete' ? 'bg-green-900/10 border-green-800' :
                item.status === 'in_progress' ? 'bg-blue-900/10 border-blue-800' :
                item.status === 'na' ? 'bg-[#131920] border-[#1e2a3d] opacity-60' :
                ' border-[#1e2a3d]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${item.status === 'na' ? 'text-[#4a5568] line-through' : 'text-[#E8E6E1]'}`}>
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
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-[#6B7585] uppercase tracking-wider block mb-0.5">Assigned Party</label>
                      <input
                        type="text"
                        value={item.assignedParty}
                        onChange={e => updateItem(item.id, 'assignedParty', e.target.value)}
                        placeholder="e.g., ECS Environmental"
                        className="w-full text-xs border border-[#1e2a3d] rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6B7585] uppercase tracking-wider block mb-0.5">Due Date</label>
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={e => updateItem(item.id, 'dueDate', e.target.value)}
                        className="w-full text-xs border border-[#1e2a3d] rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6B7585] uppercase tracking-wider block mb-0.5">Notes</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Internal notes..."
                        className="w-full text-xs border border-[#1e2a3d] rounded px-2 py-1.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6B7585] uppercase tracking-wider block mb-0.5">Documents</label>
                      <div className="space-y-1">
                        {item.attachments.map((att, attIdx) => (
                          <div key={attIdx} className="flex items-center gap-1 text-xs">
                            <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <a
                              href={att.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline truncate max-w-[120px]"
                              title={att.fileName}
                            >
                              {att.fileName}
                            </a>
                            <button
                              onClick={() => removeAttachment(item.id, attIdx)}
                              className="text-[#4a5568] hover:text-red-500 flex-shrink-0"
                              title="Remove"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addAttachment(item.id)}
                          className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-blue-300"
                        >
                          <Upload className="w-3 h-3" /> Attach file
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-[#1e2a3d]">
          <button
            onClick={() => {
              setItems(prev => [...prev, {
                id: `dd-env-custom-${Date.now()}`,
                category: 'Custom',
                label: 'New DD Item',
                status: 'pending',
                assignedParty: '',
                dueDate: '',
                notes: '',
                attachments: [],
              }]);
            }}
            className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-300 font-medium"
          >
            <Plus className="w-4 h-4" /> Add Custom DD Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default DueDiligencePage;
