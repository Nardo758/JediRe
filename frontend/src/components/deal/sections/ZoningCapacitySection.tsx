import React, { useState, useEffect } from 'react';
import {
  Loader2, Building2, TrendingUp, Save, AlertTriangle,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

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

const BASE_ZONING_OPTIONS = [
  { value: 'residential', label: 'Residential' },
  { value: 'mixed-use', label: 'Mixed-Use' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
];

const LIMITING_FACTOR_LABELS: Record<string, string> = {
  density: 'Density (units/acre)',
  far: 'FAR (floor area ratio)',
  height: 'Height limit',
  parking: 'Parking requirement',
};

export function ZoningCapacitySection({ deal, dealId: propDealId }: ZoningCapacitySectionProps) {
  const resolvedDealId = propDealId || deal?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
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

  const fetchData = async () => {
    try {
      const response = await apiClient.get(`/api/v1/deals/${resolvedDealId}/zoning-capacity`);
      if (response.data) setData(response.data);
    } catch (error) {
      console.error('Error fetching zoning capacity:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    if (!resolvedDealId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const response = await apiClient.post(`/api/v1/deals/${resolvedDealId}/zoning-capacity`, data);
      const result = response.data;
      setData(result);
      setSaveMsg(`Saved — Max Units: ${result.max_units_with_incentives || 0} | Limiting Factor: ${result.limiting_factor || 'N/A'}`);
      setTimeout(() => setSaveMsg(''), 5000);
    } catch (error) {
      setSaveMsg('Failed to save');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNumField = (field: string, value: string) => {
    setData((prev) => ({ ...prev, [field]: value ? parseFloat(value) : null }));
  };

  const updateIntField = (field: string, value: string) => {
    setData((prev) => ({ ...prev, [field]: value ? parseInt(value) : null }));
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
        <span className="ml-3 text-gray-500">Loading zoning capacity...</span>
      </div>
    );
  }

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
            Multi-constraint analysis with density bonuses, unit mix, and revenue projection
          </p>
        </div>
        <button
          onClick={saveData}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Calculate & Save'}
        </button>
      </div>

      {saveMsg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${saveMsg.includes('Failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zoning Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Zoning Code</label>
                <input type="text" value={data.zoning_code || ''} onChange={(e) => updateField('zoning_code', e.target.value)}
                  placeholder="e.g. MR-4A" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Base Zoning</label>
                <select value={data.base_zoning || ''} onChange={(e) => updateField('base_zoning', e.target.value || null)}
                  className={inputClass}>
                  <option value="">Select...</option>
                  {BASE_ZONING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Max Density (units/acre)</label>
                <input type="number" step="0.1" value={data.max_density ?? ''} onChange={(e) => updateNumField('max_density', e.target.value)}
                  placeholder="e.g. 80" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max FAR</label>
                <input type="number" step="0.1" value={data.max_far ?? ''} onChange={(e) => updateNumField('max_far', e.target.value)}
                  placeholder="e.g. 3.2" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max Height (ft)</label>
                <input type="number" value={data.max_height_feet ?? ''} onChange={(e) => updateIntField('max_height_feet', e.target.value)}
                  placeholder="e.g. 65" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max Stories</label>
                <input type="number" value={data.max_stories ?? ''} onChange={(e) => updateIntField('max_stories', e.target.value)}
                  placeholder="e.g. 5" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Min Parking per Unit</label>
                <input type="number" step="0.1" value={data.min_parking_per_unit ?? ''} onChange={(e) => updateNumField('min_parking_per_unit', e.target.value)}
                  placeholder="e.g. 1.5" className={inputClass} />
              </div>
            </div>
          </div>

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
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {item?.count || 0} units
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Projection</h3>
            <div>
              <label className={labelClass}>Average Rent per Unit ($/month)</label>
              <input type="number" step="50" value={data.avg_rent_per_unit ?? ''}
                onChange={(e) => updateNumField('avg_rent_per_unit', e.target.value)}
                placeholder="e.g. 1850" className={inputClass} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes & Restrictions</h3>
            <textarea value={data.zoning_notes || ''} onChange={(e) => updateField('zoning_notes', e.target.value)}
              placeholder="Enter notes about zoning conditions, variances, or special considerations..."
              rows={3} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="space-y-6">

          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" />
              By Right
            </h3>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-blue-700">{formatNumber(data.max_units_by_right)}</p>
              <p className="text-xs text-gray-500 mt-1">Maximum Units</p>
            </div>
            {data.limiting_factor && data.limiting_factor !== 'unknown' && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-xs text-amber-700">
                  Limited by: {LIMITING_FACTOR_LABELS[data.limiting_factor] || data.limiting_factor}
                </span>
              </div>
            )}
            <div className="mt-3 space-y-2 text-sm">
              {data.max_density && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Density:</span>
                  <span className="text-gray-900 font-medium">{data.max_density} units/acre</span>
                </div>
              )}
              {data.max_far && (
                <div className="flex justify-between">
                  <span className="text-gray-500">FAR:</span>
                  <span className="text-gray-900 font-medium">{data.max_far}</span>
                </div>
              )}
              {data.max_stories && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Stories:</span>
                  <span className="text-gray-900 font-medium">{data.max_stories}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              With Incentives
            </h3>
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-green-700">{formatNumber(data.max_units_with_incentives)}</p>
              <p className="text-xs text-gray-500 mt-1">Maximum Units</p>
            </div>
            {(data.max_units_by_right && data.max_units_with_incentives) ? (
              <div className="text-center mb-3">
                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                  +{data.max_units_with_incentives - data.max_units_by_right} units ({Math.round(((data.max_units_with_incentives - data.max_units_by_right) / data.max_units_by_right) * 100)}% increase)
                </span>
              </div>
            ) : null}
            <div className="mt-3 space-y-2 text-sm">
              {data.affordable_housing_bonus && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Affordable:</span>
                  <span className="text-green-700 font-medium">+{data.affordable_bonus_percent || 25}%</span>
                </div>
              )}
              {data.tdr_available && (
                <div className="flex justify-between">
                  <span className="text-gray-500">TDR:</span>
                  <span className="text-green-700 font-medium">+{data.tdr_bonus_percent || 15}%</span>
                </div>
              )}
            </div>
          </div>

          {(data.annual_revenue || data.avg_rent_per_unit) && (
            <div className="bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Rent:</span>
                  <span className="text-gray-900 font-medium">{formatCurrency(data.avg_rent_per_unit)}/mo</span>
                </div>
                {data.annual_revenue && (
                  <>
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

          {data.buildable_sq_ft ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Buildable Area</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Buildable:</span>
                  <span className="text-gray-900 font-medium">{(data.buildable_sq_ft / 43560).toFixed(2)} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Coverage:</span>
                  <span className="text-gray-900 font-medium">{data.coverage_ratio?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gross Sq Ft:</span>
                  <span className="text-gray-900 font-medium">{formatNumber(data.buildable_sq_ft)}</span>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
