/**
 * Property Details Form
 * Edit essential property inputs required for analysis automation
 */

import React, { useState, useEffect } from 'react';
import { Save, Loader2, DollarSign, MapPin, Ruler } from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface PropertyDetailsFormProps {
  dealId: string;
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
  propertyId,
  onSave,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<PropertyDetails>({
    parcelId: '',
    lotSizeAcres: undefined,
    landCost: undefined,
    zoningCode: '',
  });

  useEffect(() => {
    loadPropertyData();
  }, [dealId, propertyId]);

  const loadPropertyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // If we have a propertyId, fetch it directly
      if (propertyId) {
        const response = await apiClient.get(`/properties/${propertyId}`);
        setFormData({
          parcelId: response.data.parcel_id || '',
          lotSizeAcres: response.data.lot_size_acres,
          landCost: response.data.land_cost,
          zoningCode: response.data.zoning_code || '',
        });
      } else {
        // Otherwise, get the first property for this deal
        const response = await apiClient.get(`/deals/${dealId}`);
        if (response.data.properties && response.data.properties.length > 0) {
          const property = response.data.properties[0];
          setFormData({
            parcelId: property.parcel_id || '',
            lotSizeAcres: property.lot_size_acres,
            landCost: property.land_cost,
            zoningCode: property.zoning_code || '',
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load property data:', err);
      setError(err.response?.data?.message || 'Failed to load property data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Use Clawdbot API to update property
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

      setSuccess(true);
      
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

  const updateField = (field: keyof PropertyDetails, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading property data...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Property Details</h3>
        <p className="text-sm text-gray-600 mt-1">
          Essential property information required for automated analysis
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parcel ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MapPin className="w-4 h-4 inline mr-1" />
            Parcel ID / APN
          </label>
          <input
            type="text"
            value={formData.parcelId || ''}
            onChange={(e) => updateField('parcelId', e.target.value)}
            placeholder="e.g., 14-0087-001-1234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            County assessor parcel number (find on tax records)
          </p>
        </div>

        {/* Lot Size (Acres) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Ruler className="w-4 h-4 inline mr-1" />
            Lot Size (Acres)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.lotSizeAcres || ''}
            onChange={(e) => updateField('lotSizeAcres', parseFloat(e.target.value) || undefined)}
            placeholder="e.g., 2.5"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Total site area in acres
            {formData.lotSizeAcres && (
              <span className="ml-2 text-blue-600">
                ≈ {(formData.lotSizeAcres * 43560).toLocaleString()} SF
              </span>
            )}
          </p>
        </div>

        {/* Land Cost */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Land Acquisition Cost
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              step="1000"
              value={formData.landCost || ''}
              onChange={(e) => updateField('landCost', parseFloat(e.target.value) || undefined)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Purchase price or current market value
            {formData.landCost && formData.lotSizeAcres && (
              <span className="ml-2 text-blue-600">
                ≈ ${(formData.landCost / formData.lotSizeAcres).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}/acre
              </span>
            )}
          </p>
        </div>

        {/* Zoning Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MapPin className="w-4 h-4 inline mr-1" />
            Zoning Code
          </label>
          <input
            type="text"
            value={formData.zoningCode || ''}
            onChange={(e) => updateField('zoningCode', e.target.value)}
            placeholder="e.g., MR-5, C-2, SPI-16"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Current zoning district designation
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✓ Property details saved successfully
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Property Details
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
