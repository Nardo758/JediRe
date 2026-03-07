import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Building2, TrendingUp, AlertTriangle,
  ToggleLeft, ToggleRight, Search, CheckCircle2, Info,
  BarChart3, Zap, MapPin, Crown, Layers,
  Calculator, ChevronDown, ChevronUp, Sparkles, Target
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { ZoningIntelligencePanel } from './ZoningIntelligencePanel';
import { ZoningLearningPanel } from './ZoningLearningPanel';
import { useDealModule } from '../../../contexts/DealModuleContext';

interface ZoningCapacitySectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface UnitMixItem {
  percent: number;
  count: number;
}

interface UnitMix {
  studio?: UnitMixItem;
  oneBR?: UnitMixItem;
  twoBR?: UnitMixItem;
  threeBR?: UnitMixItem;
}

interface ZoningCapacityData {
  zoning_code?: string;
  base_zoning?: string;
  max_density?: number | null;
  max_far?: number | null;
  max_height_feet?: number | null;
  max_stories?: number | null;
  min_parking_per_unit?: number | null;
  affordable_housing_bonus?: boolean;
  affordable_bonus_percent?: number;
  tdr_available?: boolean;
  tdr_bonus_percent?: number;
  overlay_zones?: string[];
  special_restrictions?: string[];
  zoning_notes?: string;
  max_units_by_right?: number;
  max_units_with_incentives?: number;
  limiting_factor?: string;
  buildable_sq_ft?: number;
  coverage_ratio?: number;
  unit_mix?: UnitMix;
  avg_rent_per_unit?: number | null;
  annual_revenue?: number;
  pro_forma_noi?: number;
  estimated_value?: number;
}

interface AvailableDistrict {
  id: string;
  district_code: string;
  district_name: string;
  description: string;
  max_building_height_ft: number | null;
  max_stories: number | null;
  max_far: number | null;
  max_units_per_acre: number | null;
}

interface EnvelopeResult {
  buildableArea: number;
  maxFootprint: number;
  maxGFA: number;
  maxFloors: number;
  maxCapacity: number;
  limitingFactor: string;
  capacityByConstraint: { byDensity: number | null; byFAR: number | null; byHeight: number | null; byParking: number | null };
  parkingRequired: number;
  parkingArea: { surface: number; structured: number };
}

interface HBUResult {
  propertyType: string;
  maxCapacity: number;
  maxGFA: number;
  annualGrossRevenue: number;
  estimatedNOI: number;
  estimatedValue: number;
  capRate: number;
  expenseRatio: number;
  limitingFactor: string;
  recommended: boolean;
  reasoning: string;
}

const LIMITING_FACTOR_LABELS: Record<string, string> = {
  density: 'Density (units/acre)',
  far: 'FAR (floor area ratio)',
  height: 'Height limit',
  parking: 'Parking requirement',
  unknown: 'Not calculated',
  none: 'No constraint',
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  multifamily: 'Multifamily',
  office: 'Office',
  retail: 'Retail',
  industrial: 'Industrial',
  'mixed-use': 'Mixed-Use',
  hospitality: 'Hospitality',
};

const PROPERTY_TYPE_ICONS: Record<string, string> = {
  multifamily: '🏢',
  office: '🏛️',
  retail: '🏪',
  industrial: '🏭',
  'mixed-use': '🏗️',
  hospitality: '🏨',
};

export function ZoningCapacitySection({ deal, dealId: propDealId }: ZoningCapacitySectionProps) {
  const resolvedDealId = propDealId || deal?.id;
  const { updateZoningProfile, updateActiveScenario, emitEvent } = useDealModule();
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [availableDistricts, setAvailableDistricts] = useState<AvailableDistrict[]>([]);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [autoFillSource, setAutoFillSource] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'verified' | 'ai_retrieved' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const [envelopeLoading, setEnvelopeLoading] = useState(false);
  const [envelope, setEnvelope] = useState<EnvelopeResult | null>(null);
  const [hbuResults, setHbuResults] = useState<HBUResult[] | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [showHBU, setShowHBU] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [selectedPropertyType, setSelectedPropertyType] = useState('multifamily');

  const [zoningCode, setZoningCode] = useState('');

  const [data, setData] = useState<ZoningCapacityData>({
    affordable_bonus_percent: 25,
    tdr_bonus_percent: 15,
    unit_mix: {
      studio: { percent: 10, count: 0 },
      oneBR: { percent: 40, count: 0 },
      twoBR: { percent: 35, count: 0 },
      threeBR: { percent: 15, count: 0 },
    },
  });

  useEffect(() => {
    if (resolvedDealId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [resolvedDealId]);

  const recalculateLocally = useCallback((currentData: ZoningCapacityData) => {
    const totalUnits = currentData.max_units_with_incentives || currentData.max_units_by_right || 0;
    const avgRent = currentData.avg_rent_per_unit || 0;
    const annualRevenue = avgRent * totalUnits * 12;
    const noi = annualRevenue * 0.60;
    const estimatedValue = noi > 0 ? noi / 0.05 : 0;

    const unitMix = { ...currentData.unit_mix };
    for (const key of ['studio', 'oneBR', 'twoBR', 'threeBR'] as const) {
      if (unitMix[key]) {
        unitMix[key] = {
          percent: unitMix[key]!.percent,
          count: Math.floor((unitMix[key]!.percent / 100) * totalUnits),
        };
      }
    }

    return {
      ...currentData,
      unit_mix: unitMix,
      annual_revenue: annualRevenue > 0 ? Math.round(annualRevenue) : undefined,
      pro_forma_noi: noi > 0 ? Math.round(noi) : undefined,
      estimated_value: estimatedValue > 0 ? Math.round(estimatedValue) : undefined,
    };
  }, []);

  const pushZoningToContext = useCallback((zoningData: ZoningCapacityData, source: string) => {
    updateZoningProfile({
      baseDistrictCode: zoningData.zoning_code || zoningData.base_zoning || null,
      municipality: deal?.city || null,
      appliedFar: zoningData.max_far ?? null,
      lotAreaSf: zoningData.buildable_sq_ft ?? null,
      buildableAreaSf: zoningData.buildable_sq_ft ?? null,
      constraintSource: source,
    });
  }, [updateZoningProfile, deal?.city]);

  const pushScenarioToContext = useCallback((envelopeResult: EnvelopeResult, zoningData: ZoningCapacityData) => {
    const avgUnitSize = 900;
    const efficiencyFactor = 0.85;
    updateActiveScenario({
      id: resolvedDealId || '',
      name: `${zoningData.zoning_code || 'Custom'} Envelope`,
      maxGba: envelopeResult.maxGFA || null,
      maxUnits: envelopeResult.maxCapacity || null,
      netLeasableSf: envelopeResult.maxGFA ? Math.round(envelopeResult.maxGFA * efficiencyFactor) : null,
      parkingRequired: envelopeResult.parkingRequired || null,
      maxStories: zoningData.max_stories ?? null,
      bindingConstraint: envelopeResult.limitingFactor || null,
      appliedFar: zoningData.max_far ?? null,
      avgUnitSize,
      efficiencyFactor,
    });
    emitEvent({ source: 'zoning-capacity', type: 'capacity-updated', payload: { maxUnits: envelopeResult.maxCapacity, maxGba: envelopeResult.maxGFA, bindingConstraint: envelopeResult.limitingFactor } });
  }, [updateActiveScenario, emitEvent, resolvedDealId]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${resolvedDealId}/zoning-capacity`);
      if (response.data) {
        setData(response.data);
        setZoningCode(response.data.zoning_code || '');
        if (response.data.zoning_code) {
          setDataSource('verified');
        }
        pushZoningToContext(response.data, 'database');
      } else {
        autoFillFromDeal();
      }
    } catch (error) {
      console.error('Error fetching zoning capacity:', error);
      autoFillFromDeal();
    } finally {
      setLoading(false);
    }
  };

  const autoFillFromDeal = async () => {
    if (!resolvedDealId) return;
    try {
      const response = await apiClient.post(`/api/v1/deals/${resolvedDealId}/zoning-capacity/auto-fill`, {});
      const result = response.data;
      if (result.auto_filled && result.data) {
        const merged = {
          ...data,
          zoning_code: result.data.zoning_code || data.zoning_code,
          base_zoning: result.data.base_zoning || data.base_zoning,
          max_density: result.data.max_density ?? data.max_density,
          max_far: result.data.max_far ?? data.max_far,
          max_height_feet: result.data.max_height_feet ?? data.max_height_feet,
          max_stories: result.data.max_stories ?? data.max_stories,
          min_parking_per_unit: result.data.min_parking_per_unit ?? data.min_parking_per_unit,
        };
        setData(merged);
        setZoningCode(result.data.zoning_code || '');
        setAutoFillSource(result.data.district_name);
        setDataSource(result.data.source === 'ai_retrieved' ? 'ai_retrieved' : 'verified');
        pushZoningToContext(merged, result.data.source === 'ai_retrieved' ? 'ai' : 'auto-fill');
      } else if (result.available_districts) {
        setAvailableDistricts(result.available_districts);
        setShowDistrictPicker(true);
      }
    } catch (error) {
      console.error('Auto-fill failed:', error);
    }
  };

  const lookupZoningCode = async (code?: string) => {
    const zc = code || zoningCode;
    if (!zc || !resolvedDealId) return;

    setLookingUp(true);
    setAutoFillSource(null);
    try {
      const response = await apiClient.post(`/api/v1/deals/${resolvedDealId}/zoning-capacity/auto-fill`, {
        zoning_code: zc,
      });
      const result = response.data;
      if (result.auto_filled && result.data) {
        const merged = {
          ...data,
          zoning_code: result.data.zoning_code,
          base_zoning: result.data.base_zoning || data.base_zoning,
          max_density: result.data.max_density ?? data.max_density,
          max_far: result.data.max_far ?? data.max_far,
          max_height_feet: result.data.max_height_feet ?? data.max_height_feet,
          max_stories: result.data.max_stories ?? data.max_stories,
          min_parking_per_unit: result.data.min_parking_per_unit ?? data.min_parking_per_unit,
        };
        setData(merged);
        setZoningCode(result.data.zoning_code || zc);
        setAutoFillSource(result.data.district_name);
        setDataSource(result.data.source === 'ai_retrieved' ? 'ai_retrieved' : 'verified');
        setShowDistrictPicker(false);
        pushZoningToContext(merged, result.data.source === 'ai_retrieved' ? 'ai' : 'lookup');
      } else {
        setStatusMsg(`No matching district found for "${zc}"`);
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (error) {
      console.error('Zoning lookup failed:', error);
    } finally {
      setLookingUp(false);
    }
  };

  const loadAvailableDistricts = async () => {
    try {
      const city = deal?.city || 'Atlanta';
      const response = await apiClient.get('/api/v1/zoning-districts/lookup', {
        params: { municipality: city },
      });
      if (Array.isArray(response.data)) {
        setAvailableDistricts(response.data);
        setShowDistrictPicker(true);
      }
    } catch (error) {
      console.error('Failed to load districts:', error);
    }
  };

  const selectDistrict = (district: AvailableDistrict) => {
    setZoningCode(district.district_code);
    lookupZoningCode(district.district_code);
  };

  const analyzeEnvelope = async () => {
    if (!resolvedDealId) return;
    setEnvelopeLoading(true);
    setStatusMsg('');
    try {
      const saveResponse = await apiClient.post(`/api/v1/deals/${resolvedDealId}/zoning-capacity`, data);
      const savedData = saveResponse.data;
      setData(savedData);

      const response = await apiClient.post(`/api/v1/deals/${resolvedDealId}/building-envelope`, {
        propertyType: selectedPropertyType,
        includeHBU: true,
        includeAI: true,
        maxDensity: savedData.max_density || null,
        maxFAR: savedData.max_far || null,
        maxHeight: savedData.max_height_feet || null,
        maxStories: savedData.max_stories || null,
        minParkingPerUnit: savedData.min_parking_per_unit || null,
      });
      const result = response.data;
      setEnvelope(result.envelope);
      setHbuResults(result.highestBestUse);
      setAiRecommendations(result.aiRecommendations);
      setShowHBU(true);
      setShowAI(true);

      if (result.envelope) {
        const updatedData = {
          ...savedData,
          max_units_by_right: result.envelope.maxCapacity,
          limiting_factor: result.envelope.limitingFactor,
          buildable_sq_ft: result.envelope.buildableArea,
        };
        setData((prev) => ({
          ...prev,
          max_units_by_right: result.envelope.maxCapacity,
          limiting_factor: result.envelope.limitingFactor,
          buildable_sq_ft: result.envelope.buildableArea,
        }));
        pushZoningToContext(updatedData, 'envelope-analysis');
        pushScenarioToContext(result.envelope, updatedData);
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to analyze. Make sure a property boundary is drawn first.';
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(''), 5000);
    } finally {
      setEnvelopeLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setData((prev) => {
      const updated = { ...prev, [field]: value };
      return recalculateLocally(updated);
    });
  };

  const updateNumField = (field: string, value: string) => {
    setData((prev) => {
      const updated = { ...prev, [field]: value ? parseFloat(value) : null };
      return recalculateLocally(updated);
    });
  };

  const updateUnitMixPercent = (type: string, percent: number) => {
    const totalUnits = data.max_units_with_incentives || data.max_units_by_right || 0;
    const count = Math.floor((percent / 100) * totalUnits);
    setData((prev) => ({
      ...prev,
      unit_mix: {
        ...prev.unit_mix,
        [type]: { percent, count },
      },
    }));
  };

  const formatCurrency = (value?: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value?: number | null) => {
    if (!value) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading zoning data...</span>
      </div>
    );
  }

  const hasParams = !!(data.max_density || data.max_far || data.max_height_feet || data.max_stories || data.min_parking_per_unit);
  const byRightUnits = data.max_units_by_right || 0;
  const withIncentivesUnits = data.max_units_with_incentives || 0;

  const constraintValues: Record<string, number> = {};
  if (envelope?.capacityByConstraint) {
    const cbc = envelope.capacityByConstraint;
    if (cbc.byDensity != null && cbc.byDensity > 0) constraintValues['density'] = cbc.byDensity;
    if (cbc.byFAR != null && cbc.byFAR > 0) constraintValues['far'] = cbc.byFAR;
    if (cbc.byHeight != null && cbc.byHeight > 0) constraintValues['height'] = cbc.byHeight;
    if (cbc.byParking != null && cbc.byParking > 0) constraintValues['parking'] = cbc.byParking;
  }
  const maxConstraintVal = Math.max(...Object.values(constraintValues).filter(v => v > 0), 1);

  const unitMixTotal = (data.unit_mix?.studio?.percent || 0) +
    (data.unit_mix?.oneBR?.percent || 0) +
    (data.unit_mix?.twoBR?.percent || 0) +
    (data.unit_mix?.threeBR?.percent || 0);

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22} className="text-blue-600" />
            Zoning & Development Capacity
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Auto-populated from Property Boundary and zoning database
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPropertyType}
            onChange={(e) => setSelectedPropertyType(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={analyzeEnvelope}
            disabled={envelopeLoading}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {envelopeLoading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            {envelopeLoading ? 'Analyzing...' : 'Analyze Envelope'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${statusMsg.includes('Failed') || statusMsg.includes('No matching') || statusMsg.includes('No land') || statusMsg.includes('boundary') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Zoning Code</h3>
              {dataSource && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  dataSource === 'verified'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {dataSource === 'verified' ? '✓ Database Verified' : '⚡ AI-Retrieved'}
                </span>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <input type="text" value={zoningCode} onChange={(e) => setZoningCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupZoningCode()}
                placeholder="Enter zoning code (e.g. MR-4A)" className={`${inputClass} flex-1`} />
              <button onClick={() => lookupZoningCode()} disabled={lookingUp || !zoningCode}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                {lookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Look Up
              </button>
            </div>
            <button onClick={loadAvailableDistricts}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
              Browse all {deal?.city || 'Atlanta'} districts
            </button>

            {autoFillSource && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle2 size={14} className="text-blue-600" />
                <span className="text-sm text-blue-800">
                  Loaded from <strong>{autoFillSource}</strong>
                </span>
              </div>
            )}

            {hasParams && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {data.max_density && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Max Density</p>
                    <p className="text-lg font-semibold text-gray-900">{data.max_density} <span className="text-xs text-gray-400">units/acre</span></p>
                  </div>
                )}
                {data.max_far && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Max FAR</p>
                    <p className="text-lg font-semibold text-gray-900">{data.max_far}</p>
                  </div>
                )}
                {data.max_height_feet && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Max Height</p>
                    <p className="text-lg font-semibold text-gray-900">{data.max_height_feet} <span className="text-xs text-gray-400">ft</span></p>
                  </div>
                )}
                {data.max_stories && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Max Stories</p>
                    <p className="text-lg font-semibold text-gray-900">{data.max_stories}</p>
                  </div>
                )}
                {data.min_parking_per_unit && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Parking / Unit</p>
                    <p className="text-lg font-semibold text-gray-900">{data.min_parking_per_unit} <span className="text-xs text-gray-400">spaces</span></p>
                  </div>
                )}
                {data.base_zoning && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Base Zoning</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">{data.base_zoning}</p>
                  </div>
                )}
              </div>
            )}

            {!hasParams && !showDistrictPicker && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <MapPin size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Look up a zoning code to load parameters automatically,</p>
                <p className="text-sm text-gray-500">or draw a property boundary to detect the zoning district.</p>
              </div>
            )}
          </div>

          {showDistrictPicker && availableDistricts.length > 0 && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Info size={18} className="text-blue-600" />
                  Select a Zoning District
                </h3>
                <button onClick={() => setShowDistrictPicker(false)}
                  className="text-xs text-gray-500 hover:text-gray-700">Close</button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {availableDistricts.map((d) => (
                  <button key={d.id} onClick={() => selectDistrict(d)}
                    className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{d.district_code}</span>
                        <span className="text-sm text-gray-500 ml-2">— {d.district_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {d.max_far && <span>FAR {parseFloat(String(d.max_far)).toFixed(1)}</span>}
                        {d.max_building_height_ft && <span>{d.max_building_height_ft} ft</span>}
                        {d.max_units_per_acre && <span>{parseFloat(String(d.max_units_per_acre))} u/ac</span>}
                      </div>
                    </div>
                    {d.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{d.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Density Bonuses</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Affordable Housing Bonus</p>
                  <p className="text-xs text-gray-500">Increase density for affordable units</p>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" value={data.affordable_bonus_percent || 25}
                    onChange={(e) => updateNumField('affordable_bonus_percent', e.target.value)}
                    className="w-16 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm text-center" />
                  <span className="text-xs text-gray-500">%</span>
                  <button onClick={() => updateField('affordable_housing_bonus', !data.affordable_housing_bonus)}
                    className="text-gray-500 hover:text-gray-700">
                    {data.affordable_housing_bonus ? (
                      <ToggleRight size={28} className="text-green-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Transfer of Development Rights (TDR)</p>
                  <p className="text-xs text-gray-500">Purchase development rights from other parcels</p>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" value={data.tdr_bonus_percent || 15}
                    onChange={(e) => updateNumField('tdr_bonus_percent', e.target.value)}
                    className="w-16 px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm text-center" />
                  <span className="text-xs text-gray-500">%</span>
                  <button onClick={() => updateField('tdr_available', !data.tdr_available)}
                    className="text-gray-500 hover:text-gray-700">
                    {data.tdr_available ? (
                      <ToggleRight size={28} className="text-green-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Unit Mix Distribution</h3>
            {unitMixTotal !== 100 && unitMixTotal > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-xs text-amber-700">Total is {unitMixTotal}% — should equal 100%</span>
              </div>
            )}
            <div className="space-y-3">
              {[
                { key: 'studio', label: 'Studio', color: 'bg-blue-500' },
                { key: 'oneBR', label: '1 Bedroom', color: 'bg-indigo-500' },
                { key: 'twoBR', label: '2 Bedroom', color: 'bg-purple-500' },
                { key: 'threeBR', label: '3 Bedroom', color: 'bg-violet-500' },
              ].map(({ key, label, color }) => {
                const item = data.unit_mix?.[key as keyof UnitMix];
                return (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm text-gray-700 w-24">{label}</span>
                    <input type="number" min="0" max="100" value={item?.percent ?? 0}
                      onChange={(e) => updateUnitMixPercent(key, parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1.5 bg-white border border-gray-300 rounded text-gray-900 text-sm text-center" />
                    <span className="text-xs text-gray-400">%</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${color} rounded-full h-3 transition-all`}
                        style={{ width: `${item?.percent || 0}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-20 text-right">
                      {item?.count || 0} units
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Projection</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Average Rent per Unit ($/month)</label>
                <input type="number" step="50" value={data.avg_rent_per_unit ?? ''}
                  onChange={(e) => updateNumField('avg_rent_per_unit', e.target.value)}
                  placeholder="e.g. 1850" className={inputClass} />
              </div>
              <div className="flex items-end">
                {data.avg_rent_per_unit && (data.max_units_with_incentives || data.max_units_by_right) ? (
                  <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly</span>
                      <span className="font-medium text-gray-900">{formatCurrency((data.avg_rent_per_unit || 0) * (withIncentivesUnits || byRightUnits))}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Annual</span>
                      <span className="font-bold text-green-700">{formatCurrency(data.annual_revenue)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-400">
                    Enter rent to see revenue
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes & Restrictions</h3>
            <textarea value={data.zoning_notes || ''} onChange={(e) => updateField('zoning_notes', e.target.value)}
              placeholder="Notes about zoning conditions, variances, or special considerations..."
              rows={3} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="space-y-6">

          {envelope ? (
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Layers size={18} className="text-blue-600" />
                Building Envelope
              </h3>
              <div className="text-center mb-4">
                <p className="text-4xl font-bold text-blue-700">{formatNumber(envelope.maxCapacity)}</p>
                <p className="text-xs text-gray-500 mt-1">Max Capacity ({PROPERTY_TYPE_LABELS[selectedPropertyType]})</p>
              </div>
              {envelope.limitingFactor && envelope.limitingFactor !== 'none' && (
                <div className="flex items-center gap-2 p-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span className="text-xs text-amber-700">
                    Bottleneck: {LIMITING_FACTOR_LABELS[envelope.limitingFactor] || envelope.limitingFactor}
                  </span>
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Buildable Area:</span>
                  <span className="text-gray-900 font-medium">{(envelope.buildableArea / 43560).toFixed(2)} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Footprint:</span>
                  <span className="text-gray-900 font-medium">{formatNumber(envelope.maxFootprint)} sq ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max GFA:</span>
                  <span className="text-gray-900 font-medium">{formatNumber(envelope.maxGFA)} sq ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Floors:</span>
                  <span className="text-gray-900 font-medium">{envelope.maxFloors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parking:</span>
                  <span className="text-gray-900 font-medium">{envelope.parkingRequired} spaces</span>
                </div>
              </div>

              {Object.keys(constraintValues).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Constraint Breakdown</p>
                  <div className="space-y-2">
                    {Object.entries(constraintValues)
                      .filter(([, v]) => v > 0)
                      .sort(([, a], [, b]) => a - b)
                      .map(([constraint, value]) => (
                        <div key={constraint}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className={`${constraint === envelope.limitingFactor ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>
                              {constraint === envelope.limitingFactor ? '⚠ ' : ''}{LIMITING_FACTOR_LABELS[constraint] || constraint}
                            </span>
                            <span className="font-medium">{formatNumber(value)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`rounded-full h-2 transition-all ${
                              constraint === envelope.limitingFactor ? 'bg-amber-500' : 'bg-blue-400'
                            }`} style={{ width: `${(value / maxConstraintVal) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                Building Envelope
              </h3>
              <div className="text-center py-6">
                <Target size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Click <strong>Analyze Envelope</strong> to calculate</p>
                <p className="text-xs text-gray-400 mt-1">Uses data from Property Boundary + Zoning Code</p>
              </div>
            </div>
          )}

          {hasParams && (
            <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                Capacity Summary
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">By Right</span>
                    <span className="font-medium text-blue-700">{formatNumber(byRightUnits)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div className="bg-blue-500 rounded-full h-4 transition-all" style={{
                      width: `${(byRightUnits / Math.max(withIncentivesUnits, byRightUnits, 1)) * 100}%`
                    }} />
                  </div>
                </div>
                {withIncentivesUnits > byRightUnits && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">With Incentives</span>
                      <span className="font-medium text-green-700">{formatNumber(withIncentivesUnits)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div className="bg-green-500 rounded-full h-4 transition-all" style={{
                        width: `${(withIncentivesUnits / Math.max(withIncentivesUnits, byRightUnits, 1)) * 100}%`
                      }} />
                    </div>
                  </div>
                )}
                {withIncentivesUnits > byRightUnits && byRightUnits > 0 && (
                  <div className="text-center">
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                      +{withIncentivesUnits - byRightUnits} units ({Math.round(((withIncentivesUnits - byRightUnits) / byRightUnits) * 100)}% increase)
                    </span>
                  </div>
                )}
                <div className="space-y-1 text-sm pt-2 border-t border-gray-200">
                  {data.affordable_housing_bonus && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Affordable Bonus:</span>
                      <span className="text-green-700 font-medium">+{data.affordable_bonus_percent || 25}%</span>
                    </div>
                  )}
                  {data.tdr_available && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">TDR Bonus:</span>
                      <span className="text-green-700 font-medium">+{data.tdr_bonus_percent || 15}%</span>
                    </div>
                  )}
                  {data.limiting_factor && data.limiting_factor !== 'unknown' && data.limiting_factor !== 'none' && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Limited by:</span>
                      <span className="text-amber-700 font-medium">{LIMITING_FACTOR_LABELS[data.limiting_factor] || data.limiting_factor}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(data.annual_revenue || data.avg_rent_per_unit) && (
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Rent:</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(data.avg_rent_per_unit)}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Units:</span>
                  <span className="text-gray-900 font-medium">{formatNumber(withIncentivesUnits || byRightUnits)}</span>
                </div>
                {data.annual_revenue && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Annual Revenue:</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(data.annual_revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pro Forma NOI:</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(data.pro_forma_noi)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-700 font-medium">Est. Value (5% cap):</span>
                      <span className="text-lg font-bold text-purple-700">{formatCurrency(data.estimated_value)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {hbuResults && hbuResults.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <button onClick={() => setShowHBU(!showHBU)}
            className="w-full flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Crown size={18} className="text-amber-500" />
              Highest & Best Use Analysis
            </h3>
            {showHBU ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>
          {showHBU && (
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">Property Type</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Max Capacity</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Annual Revenue</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">NOI</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">Estimated Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hbuResults.map((result, idx) => (
                      <tr key={result.propertyType}
                        className={`border-b border-gray-100 ${result.recommended ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span>{PROPERTY_TYPE_ICONS[result.propertyType] || '🏢'}</span>
                            <span className={`font-medium ${result.recommended ? 'text-amber-800' : 'text-gray-900'}`}>
                              {PROPERTY_TYPE_LABELS[result.propertyType] || result.propertyType}
                            </span>
                            {result.recommended && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200">
                                Best Use
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">
                          {formatNumber(result.maxCapacity)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">
                          {formatCurrency(result.annualGrossRevenue)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">
                          {formatCurrency(result.estimatedNOI)}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${result.recommended ? 'text-amber-700' : 'text-gray-900'}`}>
                          {formatCurrency(result.estimatedValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hbuResults[0]?.reasoning && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-700 mb-1">Recommendation</p>
                  <p className="text-sm text-amber-800">{hbuResults[0].reasoning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {aiRecommendations && (
        <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 p-5 shadow-sm">
          <button onClick={() => setShowAI(!showAI)}
            className="w-full flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              AI Optimization Recommendations
            </h3>
            {showAI ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>
          {showAI && (
            <div className="mt-4 prose prose-sm max-w-none text-gray-700">
              {aiRecommendations.split('\n').filter(line => line.trim()).map((line, i) => (
                <p key={i} className="mb-2 text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <ZoningIntelligencePanel
        deal={deal}
        dealId={resolvedDealId}
        districtCode={data.zoning_code}
        municipality={deal?.city}
        state={deal?.state}
        landAreaSf={deal?.lot_size_sqft}
      />

      <ZoningLearningPanel
        deal={deal}
        dealId={resolvedDealId}
        districtCode={data.zoning_code}
        municipality={deal?.city}
        state={deal?.state}
      />
    </div>
  );
}
