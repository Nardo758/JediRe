/**
 * Zoning Confirmation Tab - Step 2 of Zoning Analysis
 * Confirms zoning district and triggers full analysis
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface ZoningConfirmTabProps {
  deal?: any;
  dealId?: string;
  onConfirm?: (zoningData: any) => void;
}

interface DetectedZoning {
  code: string;
  name: string;
  municipality: string;
  state: string;
  confidence: number;
  source: 'boundary' | 'address' | 'manual';
}

export default function ZoningConfirmTab({ deal, dealId, onConfirm }: ZoningConfirmTabProps) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedZoning, setDetectedZoning] = useState<DetectedZoning | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    fetchZoningFromBoundary();
  }, [dealId]);

  const fetchZoningFromBoundary = async () => {
    if (!dealId) {
      setError('No deal ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if boundary exists
      const boundaryRes = await apiClient.get(`/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

      if (!boundary?.centroid) {
        setError('No property boundary found. Please complete Step 1 first.');
        setLoading(false);
        return;
      }

      // Use boundary centroid for reverse geocode + zoning lookup
      const [lng, lat] = boundary.centroid.match(/\(([^,]+),([^)]+)\)/).slice(1).map(parseFloat);

      const reverseGeoRes = await apiClient.get('/reverse-geocode', {
        params: { lat, lng },
      });

      const location = reverseGeoRes.data;

      if (!location?.municipality?.id) {
        setError('Could not determine municipality from boundary location.');
        setLoading(false);
        return;
      }

      // Lookup zoning at this location
      const zoningRes = await apiClient.get('/zoning/lookup', {
        params: {
          city: location.city,
          address: deal?.address || boundary.address,
        },
      });

      const zoningData = zoningRes.data;

      if (zoningData?.found && zoningData.districts?.length > 0) {
        const primaryDistrict = zoningData.districts[0];
        setDetectedZoning({
          code: primaryDistrict.district_code,
          name: primaryDistrict.district_name,
          municipality: location.city,
          state: location.state,
          confidence: 0.95,
          source: 'boundary',
        });
      } else {
        setError(`No zoning data found for ${location.city}, ${location.state}. You can enter it manually.`);
      }
    } catch (err: any) {
      console.error('Error fetching zoning:', err);
      setError(err.response?.data?.error || 'Failed to detect zoning. Try manual entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!detectedZoning && !manualCode) return;

    setAnalyzing(true);
    setError(null);

    try {
      const zoneCode = detectedZoning?.code || manualCode;

      // Fetch boundary data
      const boundaryRes = await apiClient.get(`/deals/${dealId}/boundary`);
      const boundary = boundaryRes.data;

      // Trigger full zoning analysis with deal type
      const analysisPayload = {
        dealId,
        zoningCode: zoneCode,
        municipality: detectedZoning?.municipality,
        state: detectedZoning?.state,
        landAreaSf: boundary.parcelAreaSF || boundary.parcelArea * 43560,
        dealType: deal?.strategy || deal?.dealType || 'BTS', // ← DEAL TYPE INTEGRATION
        boundaryId: boundary.id,
        setbacks: boundary.setbacks,
      };

      const analysisRes = await apiClient.post('/zoning-intelligence/analyze', analysisPayload);

      const enrichedZoning = {
        ...detectedZoning,
        code: zoneCode,
        analysisData: analysisRes.data,
        confirmed: true,
      };

      // Store confirmation
      await apiClient.post(`/deals/${dealId}/zoning-confirmation`, {
        zoning_code: zoneCode,
        municipality: detectedZoning?.municipality,
        state: detectedZoning?.state,
        confirmed_at: new Date().toISOString(),
      });

      if (onConfirm) {
        onConfirm(enrichedZoning);
      }
    } catch (err: any) {
      console.error('Error analyzing zoning:', err);
      setError(err.response?.data?.error || 'Failed to analyze zoning');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Detecting zoning from property boundary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Confirm Zoning District</h3>
            <p className="text-sm text-gray-600">
              We detected the zoning district from your property boundary. Confirm it to unlock development capacity analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Could not auto-detect zoning</p>
            <p className="text-sm text-amber-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Detected Zoning */}
      {detectedZoning && !manualEntry && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Detected Location</span>
              </div>
              <p className="text-base font-medium text-gray-900">
                {detectedZoning.municipality}, {detectedZoning.state}
              </p>
            </div>
            <div className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">
              {Math.round(detectedZoning.confidence * 100)}% confidence
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Zoning District</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">{detectedZoning.code}</p>
                <p className="text-sm text-gray-600">{detectedZoning.name}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setManualEntry(true)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Not correct? Enter manually
            </button>
            <button
              onClick={handleConfirm}
              disabled={analyzing}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Confirm & Analyze
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry */}
      {(manualEntry || (!detectedZoning && !loading)) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Enter Zoning Manually</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoning District Code *
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. MRC-3, R-4, C-2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this on your municipality's zoning map or planning department website
              </p>
            </div>

            <div className="flex gap-3">
              {detectedZoning && (
                <button
                  onClick={() => {
                    setManualEntry(false);
                    setManualCode('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={!manualCode.trim() || analyzing}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Confirm & Analyze
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-600">
          <strong className="text-gray-900">What happens next:</strong> Once confirmed, our AI agent will analyze the zoning code and calculate your maximum development capacity based on your <strong>{deal?.strategy || 'investment'}</strong> strategy.
        </p>
      </div>
    </div>
  );
}
