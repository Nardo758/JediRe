/**
 * @deprecated This modal has been replaced by CreateDealPage (full-screen experience)
 * 
 * Route: /deals/create
 * File: frontend/src/pages/CreateDealPage.tsx
 * 
 * This file is kept for reference but should not be used in new code.
 * All deal creation should now use the full-screen CreateDealPage instead.
 */

import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../../stores/dealStore';
import { useMapDrawingStore } from '../../stores/mapDrawingStore';
import { Button } from '../shared/Button';
import { GooglePlacesInput } from '../shared/GooglePlacesInput';
import { TradeAreaDefinitionPanel } from '../trade-area';
import { api } from '../../services/api';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated?: (deal: any) => void;
}

type DealCategory = 'portfolio' | 'pipeline';
type DevelopmentType = 'new' | 'existing';

const STEPS = {
  SETUP: 1,           // Category + Type + Address
  LOCATION: 2,        // Trade Area (optional) + Boundary (optional)
  DETAILS: 3,         // Name, description, tier
} as const;

export const CreateDealModal: React.FC<CreateDealModalProps> = ({ isOpen, onClose, onDealCreated }) => {
  const { createDeal, isLoading } = useDealStore();
  const { startDrawing, drawnGeometry, clearDrawing } = useMapDrawingStore();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(STEPS.SETUP);
  const [dealCategory, setDealCategory] = useState<DealCategory | null>(null);
  const [developmentType, setDevelopmentType] = useState<DevelopmentType | null>(null);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [dealName, setDealName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [error, setError] = useState<string | null>(null);
  
  // Trade area state
  const [tradeAreaId, setTradeAreaId] = useState<number | null>(null);
  const [submarketId, setSubmarketId] = useState<number | null>(null);
  const [msaId, setMsaId] = useState<number | null>(null);
  
  // Location step sub-state
  const [showTradeArea, setShowTradeArea] = useState(true);
  const [showBoundary, setShowBoundary] = useState(false);

  // Trigger drawing mode when reaching boundary sub-step
  useEffect(() => {
    if (currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new') {
      console.log('[CreateDeal] Starting drawing mode');
      startDrawing('boundary', coordinates || undefined);
    }
  }, [showBoundary, developmentType, coordinates]);
  
  // Sync drawn boundary from shared store
  useEffect(() => {
    if (drawnGeometry) {
      console.log('[CreateDeal] Boundary drawn:', drawnGeometry);
      setBoundary(drawnGeometry);
    }
  }, [drawnGeometry]);

  // Geocode address
  const handleGeocodeAddress = async () => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setError(null);
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        setCoordinates([lng, lat]);
        
        // Lookup submarket and MSA for this location
        try {
          const submarketResponse = await api.get('/submarkets/lookup', {
            params: { lat, lng }
          });
          if (submarketResponse.data.success) {
            setSubmarketId(submarketResponse.data.data.id);
            setMsaId(submarketResponse.data.data.msa_id);
          }
        } catch (err) {
          console.error('Failed to lookup submarket:', err);
        }
        
        // For existing properties, set point geometry
        if (developmentType === 'existing') {
          setBoundary({
            type: 'Point',
            coordinates: [lng, lat],
          });
        }
        
        // Advance to location step
        setCurrentStep(STEPS.LOCATION);
        setShowTradeArea(true);
        setShowBoundary(false);
      } else {
        setError('Address not found. Please try a different address.');
      }
    } catch (err) {
      setError('Failed to geocode address. Please try again.');
    }
  };

  const handleNext = () => {
    setError(null);
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === STEPS.LOCATION && showBoundary) {
      // Go back to trade area within location step
      setShowBoundary(false);
      setShowTradeArea(true);
      clearDrawing();
    } else {
      setCurrentStep((prev) => prev - 1);
      if (currentStep === STEPS.LOCATION) {
        setShowTradeArea(true);
        setShowBoundary(false);
      }
    }
  };

  const handleSkipTradeArea = () => {
    setTradeAreaId(null);
    // Skip to boundary step if new development, otherwise skip to details
    if (developmentType === 'new') {
      setShowTradeArea(false);
      setShowBoundary(true);
    } else {
      // Existing property: skip entire location step
      setCurrentStep(STEPS.DETAILS);
    }
  };

  const handleSkipBoundary = () => {
    // Skip boundary drawing - system will use point location
    setBoundary({
      type: 'Point',
      coordinates: coordinates!,
    });
    setCurrentStep(STEPS.DETAILS);
  };

  const handleSubmit = async () => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }

    if (!boundary) {
      setError('Please draw a boundary or locate the property');
      return;
    }

    try {
      const result = await createDeal({
        name: dealName,
        description,
        tier,
        deal_category: dealCategory!,
        development_type: developmentType!,
        address,
        boundary,
      });
      onDealCreated?.(result);
      
      // Link geographic context if we have submarket/MSA
      if (result && submarketId && msaId) {
        try {
          await api.post(`/deals/${result.id}/geographic-context`, {
            trade_area_id: tradeAreaId,
            submarket_id: submarketId,
            msa_id: msaId,
            active_scope: tradeAreaId ? 'trade_area' : 'submarket',
          });
        } catch (contextErr) {
          console.error('Failed to link geographic context:', contextErr);
        }
      }
      
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create deal');
    }
  };

  const handleClose = () => {
    clearDrawing();
    setCurrentStep(STEPS.SETUP);
    setDealCategory(null);
    setDevelopmentType(null);
    setAddress('');
    setCoordinates(null);
    setBoundary(null);
    setDealName('');
    setDescription('');
    setTier('basic');
    setError(null);
    setTradeAreaId(null);
    setSubmarketId(null);
    setMsaId(null);
    setShowTradeArea(true);
    setShowBoundary(false);
    onClose();
  };

  if (!isOpen) return null;

  // Minimize modal when in drawing mode
  const isDrawingMode = currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new';

  return (
    <div className={`fixed inset-0 z-50 ${isDrawingMode ? '' : 'bg-black bg-opacity-50 flex items-center justify-center'}`}>
      <div className={`bg-white shadow-2xl overflow-y-auto ${
        isDrawingMode 
          ? 'absolute right-0 top-0 bottom-0 w-96 rounded-l-xl' 
          : 'rounded-xl max-w-4xl w-full max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Deal</h2>
            <p className="text-sm text-gray-500 mt-1">
              Step {currentStep} of {STEPS.DETAILS}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light"
          >
            ×
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between">
            {[
              { num: STEPS.SETUP, label: 'Setup' },
              { num: STEPS.LOCATION, label: 'Location (Optional)' },
              { num: STEPS.DETAILS, label: 'Details' },
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      currentStep >= step.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {step.num}
                  </div>
                  <span className="text-xs mt-2 text-center text-gray-600 font-medium">{step.label}</span>
                </div>
                {idx < 2 && (
                  <div
                    className={`flex-1 h-1 mx-2 mb-6 transition-all ${
                      currentStep > step.num ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[400px]">
          {/* Step 1: Setup (Category + Type + Address) */}
          {currentStep === STEPS.SETUP && (
            <div className="space-y-6">
              {/* Category Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  1. Deal Category
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDealCategory('portfolio')}
                    className={`p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition ${
                      dealCategory === 'portfolio' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-3xl mb-2">📁</div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Portfolio</h4>
                    <p className="text-xs text-gray-600">Properties you own or manage</p>
                  </button>
                  <button
                    onClick={() => setDealCategory('pipeline')}
                    className={`p-4 border-2 rounded-lg hover:border-green-500 hover:bg-green-50 transition ${
                      dealCategory === 'pipeline' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-3xl mb-2">📊</div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Pipeline</h4>
                    <p className="text-xs text-gray-600">Deals you're prospecting</p>
                  </button>
                </div>
              </div>

              {/* Development Type (shown after category selected) */}
              {dealCategory && (
                <div className="animate-fadeIn">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    2. Development Type
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setDevelopmentType('new')}
                      className={`p-4 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition ${
                        developmentType === 'new' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-3xl mb-2">🏗️</div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">New Development</h4>
                      <p className="text-xs text-gray-600">Ground-up construction</p>
                    </button>
                    <button
                      onClick={() => setDevelopmentType('existing')}
                      className={`p-4 border-2 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition ${
                        developmentType === 'existing' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-3xl mb-2">🏢</div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">Existing Property</h4>
                      <p className="text-xs text-gray-600">Existing building</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Address (shown after type selected) */}
              {dealCategory && developmentType && (
                <div className="animate-fadeIn">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    3. Property Address
                  </h3>
                  <div>
                    <GooglePlacesInput
                      id="create-deal-address"
                      name="address"
                      value={address}
                      onChange={(value, coords) => {
                        setAddress(value);
                        if (coords) {
                          setCoordinates(coords);
                          setError(null);
                          
                          const [lng, lat] = coords;
                          api.get('/submarkets/lookup', { params: { lat, lng } })
                            .then((res) => {
                              if (res.data.success) {
                                setSubmarketId(res.data.data.id);
                                setMsaId(res.data.data.msa_id);
                              }
                            })
                            .catch((err) => console.error('Submarket lookup failed:', err));
                          
                          if (developmentType === 'existing') {
                            setBoundary({ type: 'Point', coordinates: coords });
                          }
                          
                          // Auto-advance to location step
                          setCurrentStep(STEPS.LOCATION);
                          setShowTradeArea(true);
                          setShowBoundary(false);
                        }
                      }}
                      placeholder="Start typing address... (e.g., 123 Peachtree St NE, Atlanta, GA)"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Start typing and select from dropdown, or enter manually and click "Locate on Map"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Location (Trade Area + Boundary - both optional) */}
          {currentStep === STEPS.LOCATION && coordinates && (
            <div>
              {showTradeArea && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Define Trade Area <span className="text-sm font-normal text-gray-500">(Optional)</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      Define the geographic area you want to analyze, or skip to use system defaults.
                    </p>
                  </div>
                  <TradeAreaDefinitionPanel
                    propertyLat={coordinates[1]}
                    propertyLng={coordinates[0]}
                    onSave={(id) => {
                      setTradeAreaId(id);
                      if (developmentType === 'new') {
                        setShowTradeArea(false);
                        setShowBoundary(true);
                      } else {
                        setCurrentStep(STEPS.DETAILS);
                      }
                    }}
                    onSkip={handleSkipTradeArea}
                    onCustomDraw={() => {
                      setShowTradeArea(false);
                      setShowBoundary(true);
                    }}
                  />
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={handleSkipTradeArea}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      ⏭️ Skip - System will define later
                    </Button>
                  </div>
                </div>
              )}

              {showBoundary && developmentType === 'new' && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Draw Property Boundary <span className="text-sm font-normal text-gray-500">(Optional)</span>
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Draw the exact property boundary on the map, or skip to use the address point.
                    </p>
                  </div>
                  
                  <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg text-center">
                    <div className="text-6xl mb-4">🗺️</div>
                    <h4 className="text-lg font-semibold text-blue-900 mb-2">
                      Drawing on Dashboard Map
                    </h4>
                    <p className="text-sm text-blue-700 mb-4">
                      The map is now in drawing mode. Use the drawing tools to outline your property boundary.
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <div>• Click to add points</div>
                      <div>• Double-click to finish</div>
                      <div>• Use trash icon to start over</div>
                    </div>
                  </div>
                  
                  {!boundary && (
                    <div className="flex justify-center mt-4 gap-3">
                      <button
                        onClick={() => {
                          startDrawing('boundary', coordinates || undefined);
                        }}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        🗺️ Start Drawing
                      </button>
                      <Button
                        onClick={handleSkipBoundary}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                      >
                        ⏭️ Skip - Use point location
                      </Button>
                    </div>
                  )}
                  
                  {boundary && boundary.type !== 'Point' && (
                    <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-semibold text-center">
                        ✓ Boundary drawn successfully! Click "Continue" below.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {currentStep === STEPS.DETAILS && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Deal Details
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deal Name *
                </label>
                <input
                  id="create-deal-name"
                  name="dealName"
                  type="text"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  placeholder="e.g., Buckhead Mixed-Use Development"
                  aria-label="Deal name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="create-deal-description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the deal..."
                  aria-label="Deal description"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  id="create-deal-tier"
                  name="tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as any)}
                  aria-label="Subscription tier"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    <strong>Category:</strong>{' '}
                    {dealCategory === 'portfolio' ? 'Portfolio (Owned)' : 'Pipeline (Prospecting)'}
                  </p>
                  <p>
                    <strong>Type:</strong>{' '}
                    {developmentType === 'new' ? 'New Development' : 'Existing Property'}
                  </p>
                  <p>
                    <strong>Address:</strong> {address}
                  </p>
                  <p>
                    <strong>Trade Area:</strong>{' '}
                    {tradeAreaId ? 'Custom defined' : 'System default'}
                  </p>
                  <p>
                    <strong>Boundary:</strong>{' '}
                    {boundary?.type === 'Point' ? 'Point location' : 'Custom drawn'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div>
            {(currentStep > STEPS.SETUP || (currentStep === STEPS.LOCATION && showBoundary)) && (
              <Button onClick={handleBack} disabled={isLoading}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            {currentStep === STEPS.SETUP && address.trim() && !coordinates && (
              <Button onClick={handleGeocodeAddress} disabled={isLoading}>
                Locate on Map →
              </Button>
            )}
            {currentStep === STEPS.LOCATION && showBoundary && developmentType === 'new' && boundary && boundary.type !== 'Point' && (
              <Button onClick={() => setCurrentStep(STEPS.DETAILS)} disabled={isLoading}>
                Continue →
              </Button>
            )}
            {currentStep === STEPS.DETAILS && (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Deal'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
