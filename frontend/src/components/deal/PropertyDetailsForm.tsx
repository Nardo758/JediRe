import React, { useState, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { useDealModule } from '../../contexts/DealModuleContext';
import { BT } from '@/components/deal/bloomberg-ui';

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
  // Get canonical site data from context (single source of truth)
  const { siteData, dealInputs } = useDealModule();

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
  // Task #425: useEffect intentionally omits `loadPropertyData` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, propertyId, dealProp, siteData, dealInputs]);

  const loadPropertyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Priority 1: Use canonical site data from context (from municipal API)
      if (siteData && siteData.source !== 'pending') {
        const data: PropertyDetails = {
          parcelId: siteData.parcelId || '',
          lotSizeAcres: siteData.lotSizeAcres ?? undefined,
          landCost: dealInputs?.landCost ?? dealInputs?.purchasePrice ?? undefined,
          zoningCode: siteData.zoningCode || '',
        };
        setFormData(data);
        setSavedData(data);
        setLoading(false);
        return;
      }

      // Priority 2: If deal object was passed directly, use it
      if (dealProp && !propertyId) {
        const deal = dealProp;
        const pd = deal.property_data || {};
        const property = deal.properties?.[0];

        const rawAcres = property?.lot_size_acres ?? pd.lot_size_acres ?? deal.lot_size_acres ?? deal.lotSizeAcres ?? deal.acres;
        const lotSizeAcres = (rawAcres && rawAcres < 100) ? rawAcres : undefined;

        const data: PropertyDetails = {
          parcelId: property?.parcel_id || pd.parcel_id || deal.parcel_id || deal.parcelId || '',
          lotSizeAcres,
          landCost: property?.land_cost ?? pd.land_cost ?? deal.land_cost ?? deal.landCost ?? deal.purchasePrice,
          zoningCode: property?.zoning_code || pd.zoning_code || deal.zoning_code || deal.zoningCode || deal.zoningProfile?.baseDistrictCode || '',
        };
        setFormData(data);
        setSavedData(data);
        setLoading(false);
        return;
      }

      if (propertyId) {
        const response = await apiClient.get(`/api/v1/properties/${propertyId}`);
        const data: PropertyDetails = {
          parcelId: response.data.parcel_id || '',
          lotSizeAcres: response.data.lot_size_acres,
          landCost: response.data.land_cost,
          zoningCode: response.data.zoning_code || '',
        };
        setFormData(data);
        setSavedData(data);
      } else if (dealId) {
        const response = await apiClient.get(`/api/v1/deals/${dealId}`);
        const body = response.data;
        const deal = body?.deal || body?.data || body;
        const pd = deal.property_data || {};

        const property = deal.properties?.[0];

        const rawAcres = property?.lot_size_acres ?? pd.lot_size_acres ?? deal.lot_size_acres ?? deal.lotSizeAcres ?? deal.acres;
        const lotSizeAcres = (rawAcres && rawAcres < 100) ? rawAcres : undefined;

        const data: PropertyDetails = {
          parcelId: property?.parcel_id || pd.parcel_id || deal.parcel_id || deal.parcelId || '',
          lotSizeAcres,
          landCost: property?.land_cost ?? pd.land_cost ?? deal.land_cost ?? deal.landCost ?? deal.purchasePrice,
          zoningCode: property?.zoning_code || pd.zoning_code || deal.zoning_code || deal.zoningCode || deal.zoningProfile?.baseDistrictCode || '',
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
      await apiClient.patch(`/api/v1/deals/${dealId}/property`, {
        parcel_id: formData.parcelId,
        lot_size_acres: formData.lotSizeAcres,
        land_cost: formData.landCost,
        zoning_code: formData.zoningCode,
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
          <span style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.1em' }}>PROPERTY ESSENTIALS</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="mb-2 animate-pulse" style={{ height: 12, width: 64, background: BT.bg.hover, borderRadius: 0 }} />
              <div className="mb-1 animate-pulse" style={{ height: 24, width: 96, background: BT.bg.hover, borderRadius: 0 }} />
              <div className="animate-pulse" style={{ height: 12, width: 80, background: BT.bg.panelAlt, borderRadius: 0 }} />
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
          <span style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.1em' }}>PROPERTY ESSENTIALS</span>
          {success && (
            <span className="flex items-center gap-1" style={{ fontSize: 11, color: BT.text.green, fontWeight: 500, fontFamily: BT.font.mono }}>
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {error && (
            <span style={{ fontSize: 11, color: BT.text.red, fontWeight: 500, fontFamily: BT.font.mono }}>
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
                className="px-2 py-1 transition-colors"
                style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: BT.font.mono }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                style={{
                  background: saving ? BT.bg.hover : BT.text.cyan,
                  color: saving ? BT.text.muted : BT.bg.terminal,
                  fontSize: BT.fontSize.xs,
                  fontWeight: 500,
                  fontFamily: BT.font.mono,
                  borderRadius: 0,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
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
              className="flex items-center gap-1 px-2 py-1 transition-colors"
              style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: BT.font.mono }}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.05em', marginBottom: 4 }}>Parcel ID</div>
          {editing ? (
            <input
              type="text"
              value={formData.parcelId || ''}
              onChange={(e) => updateField('parcelId', e.target.value)}
              placeholder="14-0087-001"
              className="w-full px-2.5 py-1.5"
              style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, borderRadius: 0, outline: 'none' }}
            />
          ) : (
            <div className="truncate" style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: 4 }}>
              {formData.parcelId || <span style={{ color: BT.text.muted, fontWeight: 400, fontSize: BT.fontSize.base }}>Not set</span>}
            </div>
          )}
        </div>

        <div className="p-4 transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.05em', marginBottom: 4 }}>Lot Size</div>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={formData.lotSizeAcres ?? ''}
              onChange={(e) => updateField('lotSizeAcres', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
              className="w-full px-2.5 py-1.5"
              style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, borderRadius: 0, outline: 'none' }}
            />
          ) : (
            <div style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: 4 }}>
              {formData.lotSizeAcres ? (
                `${Number(formData.lotSizeAcres).toFixed(2)} ac`
              ) : (
                <span style={{ color: BT.text.muted, fontWeight: 400, fontSize: BT.fontSize.base }}>Not set</span>
              )}
            </div>
          )}
          {computedSF && (
            <div style={{ fontSize: 11, color: BT.text.secondary, fontFamily: BT.font.mono }}>{computedSF}</div>
          )}
        </div>

        <div className="p-4 transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.05em', marginBottom: 4 }}>Land Cost</div>
          {editing ? (
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: BT.text.muted, fontSize: BT.fontSize.base, fontFamily: BT.font.mono }}>$</span>
              <input
                type="number"
                step="1000"
                value={formData.landCost ?? ''}
                onChange={(e) => updateField('landCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
                className="w-full pl-6 pr-2.5 py-1.5"
                style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, borderRadius: 0, outline: 'none' }}
              />
            </div>
          ) : (
            <div style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: 4 }}>
              {formData.landCost ? (
                formatFullCurrency(formData.landCost)
              ) : (
                <span style={{ color: BT.text.muted, fontWeight: 400, fontSize: BT.fontSize.base }}>Not set</span>
              )}
            </div>
          )}
          {computedPerAcre && (
            <div style={{ fontSize: 11, color: BT.text.secondary, fontFamily: BT.font.mono }}>{computedPerAcre}</div>
          )}
        </div>

        <div className="p-4 transition-colors" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <div style={{ fontSize: 10, fontFamily: BT.font.mono, color: BT.text.muted, letterSpacing: '0.05em', marginBottom: 4 }}>Zoning</div>
          {editing ? (
            <input
              type="text"
              value={formData.zoningCode || ''}
              onChange={(e) => updateField('zoningCode', e.target.value)}
              placeholder="MR-5, C-2"
              className="w-full px-2.5 py-1.5"
              style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base, borderRadius: 0, outline: 'none' }}
            />
          ) : (
            <div style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: 4 }}>
              {formData.zoningCode || <span style={{ color: BT.text.muted, fontWeight: 400, fontSize: BT.fontSize.base }}>Not set</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
