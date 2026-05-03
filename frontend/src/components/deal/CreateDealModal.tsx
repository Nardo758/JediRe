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
import { BT } from '@/components/deal/bloomberg-ui';

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
  // hook intentionally captures currentStep, startDrawing via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted values are read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div
      className={`fixed inset-0 z-50 ${isDrawingMode ? '' : 'flex items-center justify-center'}`}
      style={{ backgroundColor: isDrawingMode ? undefined : 'rgba(0,0,0,0.5)' }}
    >
      <div
        className={`overflow-y-auto ${
          isDrawingMode
            ? 'absolute right-0 top-0 bottom-0 w-96'
            : 'max-w-4xl w-full max-h-[90vh]'
        }`}
        style={{ background: BT.bg.panel, borderRadius: 0 }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div>
            <h2 style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.xl, fontWeight: 700 }}>Create New Deal</h2>
            <p style={{ color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: BT.fontSize.sm, marginTop: 4 }}>
              Step {currentStep} of {STEPS.DETAILS}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{ color: BT.text.muted, fontSize: 20, fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3" style={{ background: BT.bg.panelAlt }}>
          <div className="flex items-center justify-between">
            {[
              { num: STEPS.SETUP, label: 'Setup' },
              { num: STEPS.LOCATION, label: 'Location (Optional)' },
              { num: STEPS.DETAILS, label: 'Details' },
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className="w-10 h-10 flex items-center justify-center transition-all"
                    style={{
                      borderRadius: '50%',
                      fontSize: BT.fontSize.base,
                      fontWeight: 600,
                      fontFamily: BT.font.mono,
                      background: currentStep >= step.num ? BT.text.cyan : BT.bg.hover,
                      color: currentStep >= step.num ? BT.bg.terminal : BT.text.muted,
                    }}
                  >
                    {step.num}
                  </div>
                  <span style={{ fontSize: BT.fontSize.xs, marginTop: 8, textAlign: 'center', color: BT.text.secondary, fontFamily: BT.font.label, fontWeight: 500 }}>{step.label}</span>
                </div>
                {idx < 2 && (
                  <div
                    className="flex-1 h-1 mx-2 mb-6 transition-all"
                    style={{ background: currentStep > step.num ? BT.text.cyan : BT.bg.hover }}
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
                <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 12 }}>
                  1. Deal Category
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDealCategory('portfolio')}
                    className="p-4 transition"
                    style={{
                      border: `2px solid ${dealCategory === 'portfolio' ? BT.text.cyan : BT.border.subtle}`,
                      background: dealCategory === 'portfolio' ? `${BT.text.cyan}12` : BT.bg.panel,
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                    <h4 style={{ fontWeight: 600, color: BT.text.primary, fontSize: BT.fontSize.base, fontFamily: BT.font.mono, marginBottom: 4 }}>Portfolio</h4>
                    <p style={{ fontSize: BT.fontSize.xs, color: BT.text.secondary, fontFamily: BT.font.label }}>Properties you own or manage</p>
                  </button>
                  <button
                    onClick={() => setDealCategory('pipeline')}
                    className="p-4 transition"
                    style={{
                      border: `2px solid ${dealCategory === 'pipeline' ? BT.text.green : BT.border.subtle}`,
                      background: dealCategory === 'pipeline' ? `${BT.text.green}12` : BT.bg.panel,
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
                    <h4 style={{ fontWeight: 600, color: BT.text.primary, fontSize: BT.fontSize.base, fontFamily: BT.font.mono, marginBottom: 4 }}>Pipeline</h4>
                    <p style={{ fontSize: BT.fontSize.xs, color: BT.text.secondary, fontFamily: BT.font.label }}>Deals you're prospecting</p>
                  </button>
                </div>
              </div>

              {/* Development Type (shown after category selected) */}
              {dealCategory && (
                <div className="animate-fadeIn">
                  <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 12 }}>
                    2. Development Type
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setDevelopmentType('new')}
                      className="p-4 transition"
                      style={{
                        border: `2px solid ${developmentType === 'new' ? BT.text.purple : BT.border.subtle}`,
                        background: developmentType === 'new' ? `${BT.text.purple}12` : BT.bg.panel,
                        borderRadius: 0,
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🏗️</div>
                      <h4 style={{ fontWeight: 600, color: BT.text.primary, fontSize: BT.fontSize.base, fontFamily: BT.font.mono, marginBottom: 4 }}>New Development</h4>
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.secondary, fontFamily: BT.font.label }}>Ground-up construction</p>
                    </button>
                    <button
                      onClick={() => setDevelopmentType('existing')}
                      className="p-4 transition"
                      style={{
                        border: `2px solid ${developmentType === 'existing' ? BT.text.orange : BT.border.subtle}`,
                        background: developmentType === 'existing' ? `${BT.text.orange}12` : BT.bg.panel,
                        borderRadius: 0,
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🏢</div>
                      <h4 style={{ fontWeight: 600, color: BT.text.primary, fontSize: BT.fontSize.base, fontFamily: BT.font.mono, marginBottom: 4 }}>Existing Property</h4>
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.secondary, fontFamily: BT.font.label }}>Existing building</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Address (shown after type selected) */}
              {dealCategory && developmentType && (
                <div className="animate-fadeIn">
                  <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 12 }}>
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
                    <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label, marginTop: 8 }}>
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
                    <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 8 }}>
                      Define Trade Area <span style={{ fontSize: BT.fontSize.sm, fontWeight: 400, color: BT.text.muted }}>(Optional)</span>
                    </h3>
                    <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label }}>
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
                      style={{ background: BT.bg.hover, color: BT.text.secondary }}
                    >
                      ⏭️ Skip - System will define later
                    </Button>
                  </div>
                </div>
              )}

              {showBoundary && developmentType === 'new' && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 8 }}>
                      Draw Property Boundary <span style={{ fontSize: BT.fontSize.sm, fontWeight: 400, color: BT.text.muted }}>(Optional)</span>
                    </h3>
                    <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 12 }}>
                      Draw the exact property boundary on the map, or skip to use the address point.
                    </p>
                  </div>

                  <div className="p-6 text-center" style={{ background: `${BT.text.cyan}08`, border: `2px solid ${BT.text.cyan}33`, borderRadius: 0 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
                    <h4 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono, marginBottom: 8 }}>
                      Drawing on Dashboard Map
                    </h4>
                    <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 16 }}>
                      The map is now in drawing mode. Use the drawing tools to outline your property boundary.
                    </p>
                    <div className="space-y-1" style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label }}>
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
                        className="px-6 py-3"
                        style={{ background: BT.text.cyan, color: BT.bg.terminal, fontWeight: 600, fontFamily: BT.font.mono, borderRadius: 0, border: 'none', cursor: 'pointer' }}
                      >
                        🗺️ Start Drawing
                      </button>
                      <Button
                        onClick={handleSkipBoundary}
                        style={{ background: BT.bg.hover, color: BT.text.secondary }}
                      >
                        ⏭️ Skip - Use point location
                      </Button>
                    </div>
                  )}

                  {boundary && boundary.type !== 'Point' && (
                    <div className="p-4" style={{ background: `${BT.text.green}08`, border: `2px solid ${BT.text.green}33`, borderRadius: 0 }}>
                      <p style={{ fontSize: BT.fontSize.base, color: BT.text.green, fontWeight: 600, fontFamily: BT.font.mono, textAlign: 'center' }}>
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
              <h3 style={{ fontSize: BT.fontSize.lg, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, marginBottom: 16 }}>
                Deal Info
              </h3>
              <div>
                <label style={{ display: 'block', fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 8 }}>
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
                  className="w-full px-4 py-3"
                  style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 8 }}>
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
                  className="w-full px-4 py-3"
                  style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: BT.fontSize.base, fontWeight: 500, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 8 }}>
                  Subscription Tier
                </label>
                <select
                  id="create-deal-tier"
                  name="tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as any)}
                  aria-label="Subscription tier"
                  className="w-full px-4 py-3"
                  style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary, fontFamily: BT.font.mono, borderRadius: 0 }}
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="p-4" style={{ background: `${BT.text.cyan}08`, border: `1px solid ${BT.text.cyan}33`, borderRadius: 0 }}>
                <h4 style={{ fontWeight: 600, color: BT.text.cyan, fontFamily: BT.font.mono, marginBottom: 8 }}>Summary</h4>
                <div className="space-y-1" style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label }}>
                  <p>
                    <strong style={{ color: BT.text.primary }}>Category:</strong>{' '}
                    {dealCategory === 'portfolio' ? 'Portfolio (Owned)' : 'Pipeline (Prospecting)'}
                  </p>
                  <p>
                    <strong style={{ color: BT.text.primary }}>Type:</strong>{' '}
                    {developmentType === 'new' ? 'New Development' : 'Existing Property'}
                  </p>
                  <p>
                    <strong style={{ color: BT.text.primary }}>Address:</strong> {address}
                  </p>
                  <p>
                    <strong style={{ color: BT.text.primary }}>Trade Area:</strong>{' '}
                    {tradeAreaId ? 'Custom defined' : 'System default'}
                  </p>
                  <p>
                    <strong style={{ color: BT.text.primary }}>Boundary:</strong>{' '}
                    {boundary?.type === 'Point' ? 'Point location' : 'Custom drawn'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4" style={{ background: `${BT.text.red}08`, border: `1px solid ${BT.text.red}33`, borderRadius: 0 }}>
              <p style={{ fontSize: BT.fontSize.base, color: BT.text.red, fontFamily: BT.font.label }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>
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
