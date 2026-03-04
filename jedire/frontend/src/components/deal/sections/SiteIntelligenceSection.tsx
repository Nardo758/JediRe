import React, { useState, useEffect } from 'react';
import {
  Loader2, CheckCircle, AlertCircle, TrendingUp,
  MapPin, Zap, Shield, Activity, Users, Save
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface SiteIntelligenceSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface SiteIntelligenceData {
  environmental?: any;
  infrastructure?: any;
  accessibility?: any;
  regulatory?: any;
  natural_hazards?: any;
  market_context?: any;
  overall_score?: number;
  data_completeness?: number;
}

type TabId = 'environmental' | 'infrastructure' | 'accessibility' | 'regulatory' | 'hazards' | 'market';

const TABS: { id: TabId; label: string; icon: React.ReactNode; category: string }[] = [
  { id: 'environmental', label: 'Environmental', icon: <MapPin size={16} />, category: 'environmental' },
  { id: 'infrastructure', label: 'Infrastructure', icon: <Zap size={16} />, category: 'infrastructure' },
  { id: 'accessibility', label: 'Access', icon: <TrendingUp size={16} />, category: 'accessibility' },
  { id: 'regulatory', label: 'Regulatory', icon: <Shield size={16} />, category: 'regulatory' },
  { id: 'hazards', label: 'Hazards', icon: <AlertCircle size={16} />, category: 'natural_hazards' },
  { id: 'market', label: 'Market', icon: <Users size={16} />, category: 'market_context' },
];

const RISK_LEVELS = ['minimal', 'moderate', 'high', 'very-high'];
const SEWER_TYPES = ['municipal', 'septic', 'package-plant', 'unknown'];
const ROAD_ACCESS_TYPES = ['direct', 'easement', 'limited', 'none'];

export const SiteIntelligenceSection: React.FC<SiteIntelligenceSectionProps> = ({ deal, dealId: propDealId, onUpdate }) => {
  const resolvedDealId = propDealId || deal?.id || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [data, setData] = useState<SiteIntelligenceData>({});
  const [activeTab, setActiveTab] = useState<TabId>('environmental');

  useEffect(() => {
    if (resolvedDealId) fetchSiteIntelligence();
  }, [resolvedDealId]);

  const fetchSiteIntelligence = async () => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${resolvedDealId}/site-intelligence`);
      setData(response.data || {});
    } catch (error) {
      console.error('Error fetching site intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSiteIntelligence = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await apiClient.post(`/api/v1/deals/${resolvedDealId}/site-intelligence`, data);
      setData(response.data);
      setSaveMessage(`Saved! Score: ${response.data.overall_score}/100 | Completeness: ${response.data.data_completeness}%`);
      setTimeout(() => setSaveMessage(null), 4000);
      onUpdate?.();
    } catch (error) {
      setSaveMessage('Failed to save. Please try again.');
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (category: string, field: string, value: any) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...(prev as any)[category],
        [field]: value,
      },
    }));
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (!score && score !== 0) return 'bg-slate-100 text-slate-600';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getScoreBadge = (score: number | null | undefined) => {
    if (!score && score !== 0) return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500 border border-slate-200">Not Scored</span>
    );
    return (
      <span className={`px-2 py-1 text-xs font-bold rounded-full ${getScoreColor(score)}`}>
        {score}/100
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  const renderInput = (label: string, value: any, onChange: (val: string) => void, opts?: { type?: string; placeholder?: string; min?: string; max?: string; step?: string }) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={opts?.type || 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        min={opts?.min}
        max={opts?.max}
        step={opts?.step}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );

  const renderSelect = (label: string, value: any, onChange: (val: string) => void, options: string[], placeholder?: string) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1).replace('-', ' ')}</option>
        ))}
      </select>
    </div>
  );

  const renderToggle = (label: string, checked: boolean, onChange: (val: boolean) => void) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <label className="text-sm text-slate-700">{label}</label>
    </div>
  );

  const renderScoreInput = (category: string, score: any) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">Category Score (0-100)</label>
      <input
        type="number"
        value={score || ''}
        onChange={(e) => updateCategory(category, 'score', e.target.value ? parseInt(e.target.value) : null)}
        placeholder="0-100"
        min="0"
        max="100"
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity size={20} />
              Site Intelligence
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Comprehensive site analysis and due diligence</p>
          </div>
          <div className="flex items-center gap-4">
            {data.data_completeness !== undefined && data.data_completeness > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-400">Completeness</div>
                <div className="text-xl font-bold text-slate-900">{data.data_completeness}%</div>
              </div>
            )}
            {data.overall_score !== undefined && data.overall_score > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-400">Overall Score</div>
                <div className="text-xl font-bold text-slate-900">{data.overall_score}/100</div>
              </div>
            )}
            <button
              onClick={saveSiteIntelligence}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
        {saveMessage && (
          <div className={`mt-2 text-sm px-3 py-1.5 rounded-lg ${saveMessage.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="border-b border-slate-200">
        <div className="flex px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="ml-1">{getScoreBadge((data as any)[tab.category]?.score)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'environmental' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-slate-900">Environmental Analysis</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderInput('Soil Type', data.environmental?.soilType, (v) => updateCategory('environmental', 'soilType', v), { placeholder: 'e.g., Clay, Sand, Loam' })}
              {renderInput('Soil Bearing Capacity (PSF)', data.environmental?.soilBearingCapacity, (v) => updateCategory('environmental', 'soilBearingCapacity', v ? parseFloat(v) : null), { type: 'number', placeholder: 'e.g., 2000' })}
              {renderInput('Tree Canopy Coverage (%)', data.environmental?.treeCanopyCoverage, (v) => updateCategory('environmental', 'treeCanopyCoverage', v ? parseFloat(v) : null), { type: 'number', placeholder: '0-100', min: '0', max: '100' })}
              {renderToggle('Wetlands Present', data.environmental?.wetlandsPresent || false, (v) => updateCategory('environmental', 'wetlandsPresent', v))}
              {renderScoreInput('environmental', data.environmental?.score)}
            </div>
          </div>
        )}

        {activeTab === 'infrastructure' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Infrastructure & Utilities</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderInput('Water Capacity', data.infrastructure?.waterCapacity, (v) => updateCategory('infrastructure', 'waterCapacity', v), { placeholder: 'e.g., 500 GPM' })}
              {renderSelect('Sewer Type', data.infrastructure?.sewerType, (v) => updateCategory('infrastructure', 'sewerType', v), SEWER_TYPES, 'Select type')}
              {renderInput('Power Grid Capacity', data.infrastructure?.powerGridCapacity, (v) => updateCategory('infrastructure', 'powerGridCapacity', v), { placeholder: 'e.g., 200A, 3-phase' })}
              {renderToggle('Natural Gas Available', data.infrastructure?.gasAvailable || false, (v) => updateCategory('infrastructure', 'gasAvailable', v))}
              {renderToggle('Fiber Internet Available', data.infrastructure?.fiberAvailable || false, (v) => updateCategory('infrastructure', 'fiberAvailable', v))}
              {renderScoreInput('infrastructure', data.infrastructure?.score)}
            </div>
          </div>
        )}

        {activeTab === 'accessibility' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Accessibility & Transportation</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderSelect('Road Access', data.accessibility?.roadAccess, (v) => updateCategory('accessibility', 'roadAccess', v), ROAD_ACCESS_TYPES, 'Select access type')}
              {renderInput('Road Type', data.accessibility?.roadType, (v) => updateCategory('accessibility', 'roadType', v), { placeholder: 'e.g., Paved, Collector' })}
              {renderInput('Walkability Score', data.accessibility?.walkabilityScore, (v) => updateCategory('accessibility', 'walkabilityScore', v ? parseInt(v) : null), { type: 'number', placeholder: '0-100', min: '0', max: '100' })}
              {renderInput('Bike Score', data.accessibility?.bikeScore, (v) => updateCategory('accessibility', 'bikeScore', v ? parseInt(v) : null), { type: 'number', placeholder: '0-100', min: '0', max: '100' })}
              {renderInput('Transit Distance (miles)', data.accessibility?.transitDistance, (v) => updateCategory('accessibility', 'transitDistance', v ? parseFloat(v) : null), { type: 'number', placeholder: 'e.g., 0.5', step: '0.1' })}
              {renderScoreInput('accessibility', data.accessibility?.score)}
            </div>
          </div>
        )}

        {activeTab === 'regulatory' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Regulatory & Compliance</h3>
            <div className="grid grid-cols-1 gap-4">
              {renderToggle('Located in Historic District', data.regulatory?.historicDistrict || false, (v) => updateCategory('regulatory', 'historicDistrict', v))}
              {renderInput('Required Permits (comma-separated)', data.regulatory?.permitsRequired?.join(', '), (v) => updateCategory('regulatory', 'permitsRequired', v.split(',').map((s: string) => s.trim()).filter(Boolean)), { placeholder: 'e.g., Building, Zoning, Environmental' })}
              {renderInput('Easements (comma-separated)', data.regulatory?.easements?.join(', '), (v) => updateCategory('regulatory', 'easements', v.split(',').map((s: string) => s.trim()).filter(Boolean)), { placeholder: 'e.g., Utility, Access, Drainage' })}
              {renderScoreInput('regulatory', data.regulatory?.score)}
            </div>
          </div>
        )}

        {activeTab === 'hazards' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Natural Hazards</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderInput('Flood Zone', data.natural_hazards?.floodZone, (v) => updateCategory('natural_hazards', 'floodZone', v), { placeholder: 'e.g., X, AE, A' })}
              {renderSelect('Flood Risk', data.natural_hazards?.floodRisk, (v) => updateCategory('natural_hazards', 'floodRisk', v), RISK_LEVELS, 'Select risk level')}
              {renderSelect('Seismic Risk', data.natural_hazards?.seismicRisk, (v) => updateCategory('natural_hazards', 'seismicRisk', v), RISK_LEVELS, 'Select risk level')}
              {renderSelect('Wildfire Risk', data.natural_hazards?.wildfireRisk, (v) => updateCategory('natural_hazards', 'wildfireRisk', v), RISK_LEVELS, 'Select risk level')}
              {renderScoreInput('natural_hazards', data.natural_hazards?.score)}
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Market Context</h3>
            <div className="grid grid-cols-2 gap-4">
              {renderInput('Median Income', data.market_context?.medianIncome, (v) => updateCategory('market_context', 'medianIncome', v ? parseFloat(v) : null), { type: 'number', placeholder: 'e.g., 65000' })}
              {renderInput('Population', data.market_context?.population, (v) => updateCategory('market_context', 'population', v ? parseInt(v) : null), { type: 'number', placeholder: 'e.g., 50000' })}
              {renderInput('Population Growth (%)', data.market_context?.populationGrowth, (v) => updateCategory('market_context', 'populationGrowth', v ? parseFloat(v) : null), { type: 'number', placeholder: 'e.g., 2.5', step: '0.1' })}
              {renderInput('Employment Rate (%)', data.market_context?.employmentRate, (v) => updateCategory('market_context', 'employmentRate', v ? parseFloat(v) : null), { type: 'number', placeholder: 'e.g., 96.5', step: '0.1', min: '0', max: '100' })}
              {renderInput('Average Daily Traffic', data.market_context?.trafficCount, (v) => updateCategory('market_context', 'trafficCount', v ? parseInt(v) : null), { type: 'number', placeholder: 'e.g., 15000' })}
              {renderInput('School Rating (1-10)', data.market_context?.schoolRating, (v) => updateCategory('market_context', 'schoolRating', v ? parseInt(v) : null), { type: 'number', placeholder: '1-10', min: '1', max: '10' })}
              {renderScoreInput('market_context', data.market_context?.score)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteIntelligenceSection;
