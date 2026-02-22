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
import { useDealStore } from '../../stores/dealStore';
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

export const DueDiligencePage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { selectedDeal: currentDeal, fetchDealById: loadDeal } = useDealStore();

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
  const [activeTab, setActiveTab] = useState<'overview' | 'entitlements' | 'environmental' | 'utilities' | 'risk'>('overview');
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Load all due diligence data
  useEffect(() => {
    const loadDueDiligenceData = async () => {
      if (!dealId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Load deal if not in store
        if (!currentDeal || currentDeal.id !== dealId) {
          await loadDeal(dealId);
        }

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
  }, [dealId, currentDeal, loadDeal]);

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
                <p className="text-sm text-gray-600">{currentDeal?.name || 'Loading...'}</p>
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

export default DueDiligencePage;
