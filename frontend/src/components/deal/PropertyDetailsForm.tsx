import React, { useState, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface PropertyDetailsFormProps {
  dealId: string;
  deal?: any; // Pass deal directly to avoid extra API call
  propertyId?: string;
  onSave?: () => void;
}

interface PropertyDetails {
  parcelId?: string;
  lotSizeAcres?: number;
  landCost?: number;
  zoningCode?: string;
}

export const PropertyDetailsForm: React.FC<PropertyDetailsFormProps> = ({
  dealId,
  deal: dealProp,
  propertyId,
  onSave,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editing, setEditing] = useState(false);

  const [formData, setFormData] = useState<PropertyDetails>({
    parcelId: '',
    lotSizeAcres: undefined,
    landCost: undefined,
    zoningCode: '',
  });

  const [savedData, setSavedData] = useState<PropertyDetails>({
    parcelId: '',
    lotSizeAcres: undefined,
    landCost: undefined,
    zoningCode: '',
  });

  useEffect(() => {
    loadPropertyData();
  }, [dealId, propertyId, dealProp]);

  const loadPropertyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // If deal object was passed directly, use it
      if (dealProp && !propertyId) {
        const deal = dealProp;
        const property = deal.properties?.[0];
        const data: PropertyDetails = {
          parcelId: property?.parcel_id || deal.parcel_id || deal.parcelId || '',
          lotSizeAcres: property?.lot_size_acres ?? deal.lot_size_acres ?? deal.acres ?? deal.lotSizeAcres,
          landCost: property?.land_cost ?? deal.land_cost ?? deal.landCost ?? deal.purchasePrice,
          zoningCode: property?.zoning_code || deal.zoning_code || deal.zoningCode || '',
        };
        setFormData(data);
        setSavedData(data);
        setLoading(false);
        return;
      }

      if (propertyId) {
        const response = await apiClient.get(`/properties/${propertyId}`);
        const data: PropertyDetails = {
          parcelId: response.data.parcel_id || '',
          lotSizeAcres: response.data.lot_size_acres,
          landCost: response.data.land_cost,
          zoningCode: response.data.zoning_code || '',
        };
        setFormData(data);
        setSavedData(data);
      } else if (dealId) {
        const response = await apiClient.get(`/deals/${dealId}`);
        const deal = response.data;
        
        // Try properties array first, then fall back to deal-level fields
        const property = deal.properties?.[0];
        const data: PropertyDetails = {
          parcelId: property?.parcel_id || deal.parcel_id || deal.parcelId || '',
          lotSizeAcres: property?.lot_size_acres ?? deal.lot_size_acres ?? deal.acres ?? deal.lotSizeAcres,
          landCost: property?.land_cost ?? deal.land_cost ?? deal.landCost ?? deal.purchasePrice,
          zoningCode: property?.zoning_code || deal.zoning_code || deal.zoningCode || '',
        };
        setFormData(data);
        setSavedData(data);
      }
    } catch (err: any) {
      console.error('Failed to load property data:', err);
      setError(err.response?.data?.message || 'Failed to load property data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await apiClient.post('/clawdbot/command', {
        command: 'update_property',
        params: {
          dealId,
          propertyId,
          parcel_id: formData.parcelId,
          lot_size_acres: formData.lotSizeAcres,
          land_cost: formData.landCost,
          zoning_code: formData.zoningCode,
        },
      });

      setSavedData({ ...formData });
      setSuccess(true);
      setEditing(false);

      if (onSave) {
        onSave();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save property:', err);
      setError(err.response?.data?.message || 'Failed to save property data');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...savedData });
    setEditing(false);
    setError(null);
  };

  const updateField = (field: keyof PropertyDetails, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return null;
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatFullCurrency = (value?: number) => {
    if (!value) return null;
    return `$${value.toLocaleString()}`;
  };

  const computedSF = formData.lotSizeAcres
    ? `${Math.round(formData.lotSizeAcres * 43560).toLocaleString()} SF`
    : null;

  const computedPerAcre =
    formData.landCost && formData.lotSizeAcres
      ? `${formatCurrency(formData.landCost / formData.lotSizeAcres)}/acre`
      : null;

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">PROPERTY ESSENTIALS</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-stone-200 p-4">
              <div className="h-3 w-16 bg-stone-100 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-stone-100 rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-stone-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-stone-400 tracking-widest">PROPERTY ESSENTIALS</span>
          {success && (
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {error && (
            <span className="text-[11px] text-red-600 font-medium">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-xs text-stone-500 hover:text-stone-700 transition-colors px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-stone-900 text-white text-xs font-medium rounded-lg px-3 py-1.5 hover:bg-stone-800 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Save
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-stone-500 hover:text-stone-700 transition-colors flex items-center gap-1 px-2 py-1"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-stone-200 p-4 hover:border-stone-300 transition-colors">
          <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Parcel ID</div>
          {editing ? (
            <input
              type="text"
              value={formData.parcelId || ''}
              onChange={(e) => updateField('parcelId', e.target.value)}
              placeholder="14-0087-001"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-stone-900 focus:ring-1 focus:ring-stone-400 focus:border-stone-400 outline-none"
            />
          ) : (
            <div className="text-xl font-bold text-stone-900 mb-1 truncate">
              {formData.parcelId || <span className="text-stone-300 font-normal text-base">Not set</span>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-4 hover:border-stone-300 transition-colors">
          <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Lot Size</div>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={formData.lotSizeAcres ?? ''}
              onChange={(e) => updateField('lotSizeAcres', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-stone-900 focus:ring-1 focus:ring-stone-400 focus:border-stone-400 outline-none"
            />
          ) : (
            <div className="text-xl font-bold text-stone-900 mb-1">
              {formData.lotSizeAcres ? (
                `${formData.lotSizeAcres} ac`
              ) : (
                <span className="text-stone-300 font-normal text-base">Not set</span>
              )}
            </div>
          )}
          {computedSF && (
            <div className="text-[11px] text-stone-500">{computedSF}</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-4 hover:border-stone-300 transition-colors">
          <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Land Cost</div>
          {editing ? (
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-mono">$</span>
              <input
                type="number"
                step="1000"
                value={formData.landCost ?? ''}
                onChange={(e) => updateField('landCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
                className="w-full border border-stone-200 rounded-lg pl-6 pr-2.5 py-1.5 text-sm font-mono text-stone-900 focus:ring-1 focus:ring-stone-400 focus:border-stone-400 outline-none"
              />
            </div>
          ) : (
            <div className="text-xl font-bold text-stone-900 mb-1">
              {formData.landCost ? (
                formatFullCurrency(formData.landCost)
              ) : (
                <span className="text-stone-300 font-normal text-base">Not set</span>
              )}
            </div>
          )}
          {computedPerAcre && (
            <div className="text-[11px] text-stone-500">{computedPerAcre}</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-4 hover:border-stone-300 transition-colors">
          <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">Zoning</div>
          {editing ? (
            <input
              type="text"
              value={formData.zoningCode || ''}
              onChange={(e) => updateField('zoningCode', e.target.value)}
              placeholder="MR-5, C-2"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-stone-900 focus:ring-1 focus:ring-stone-400 focus:border-stone-400 outline-none"
            />
          ) : (
            <div className="text-xl font-bold text-stone-900 mb-1">
              {formData.zoningCode || <span className="text-stone-300 font-normal text-base">Not set</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
