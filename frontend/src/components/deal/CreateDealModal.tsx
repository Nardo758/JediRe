import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../../stores/dealStore';
import { Button } from '../shared/Button';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated?: (deal: any) => void;
}

type DealCategory = 'portfolio' | 'pipeline';
type DevelopmentType = 'new' | 'existing';

const STEPS = {
  CATEGORY: 1,
  TYPE: 2,
  ADDRESS: 3,
  BOUNDARY: 4,
  DETAILS: 5,
} as const;

export const CreateDealModal: React.FC<CreateDealModalProps> = ({ isOpen, onClose, onDealCreated }) => {
  const { createDeal, isLoading } = useDealStore();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(STEPS.CATEGORY);
  const [dealCategory, setDealCategory] = useState<DealCategory | null>(null);
  const [developmentType, setDevelopmentType] = useState<DevelopmentType | null>(null);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [dealName, setDealName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [error, setError] = useState<string | null>(null);
  
  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);

  // Initialize map when we reach boundary step
  useEffect(() => {
    if (currentStep !== STEPS.BOUNDARY || !mapContainer.current || map.current) return;

    const centerCoords = coordinates || [-84.388, 33.749]; // Default to Atlanta

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: centerCoords,
      zoom: coordinates ? 16 : 11,
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl());

    // Add marker if we have coordinates
    if (coordinates) {
      new mapboxgl.Marker()
        .setLngLat(coordinates)
        .addTo(map.current);
    }

    // Listen for polygon completion
    map.current.on('draw.create', (e: any) => {
      setBoundary(e.features[0].geometry);
    });

    map.current.on('draw.update', (e: any) => {
      setBoundary(e.features[0].geometry);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [currentStep, coordinates]);

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
        
        // Auto-advance to boundary step
        if (developmentType === 'new') {
          setCurrentStep(STEPS.BOUNDARY);
        } else {
          // For existing properties, try to fetch parcel boundary
          // For now, just use a point and move to details
          setBoundary({
            type: 'Point',
            coordinates: [lng, lat],
          });
          setCurrentStep(STEPS.DETAILS);
        }
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
    setCurrentStep((prev) => prev - 1);
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
      const newDeal = await createDeal({
        name: dealName,
        description,
        tier,
        deal_category: dealCategory!,
        development_type: developmentType!,
        address,
        boundary,
      });
      onDealCreated?.(newDeal);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create deal');
    }
  };

  const handleClose = () => {
    // Reset all state
    setCurrentStep(STEPS.CATEGORY);
    setDealCategory(null);
    setDevelopmentType(null);
    setAddress('');
    setCoordinates(null);
    setBoundary(null);
    setDealName('');
    setDescription('');
    setTier('basic');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
              { num: STEPS.CATEGORY, label: 'Category' },
              { num: STEPS.TYPE, label: 'Type' },
              { num: STEPS.ADDRESS, label: 'Address' },
              { num: STEPS.BOUNDARY, label: 'Boundary' },
              { num: STEPS.DETAILS, label: 'Details' },
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      currentStep >= step.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {step.num}
                  </div>
                  <span className="text-xs mt-1 text-gray-600">{step.label}</span>
                </div>
                {idx < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
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
          {/* Step 1: Category */}
          {currentStep === STEPS.CATEGORY && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                How do you want to categorize this deal?
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setDealCategory('portfolio');
                    handleNext();
                  }}
                  className={`p-6 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition ${
                    dealCategory === 'portfolio' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-4xl mb-3">📁</div>
                  <h4 className="font-semibold text-gray-900 mb-2">Add to Portfolio</h4>
                  <p className="text-sm text-gray-600">
                    Properties you currently own or manage
                  </p>
                </button>
                <button
                  onClick={() => {
                    setDealCategory('pipeline');
                    handleNext();
                  }}
                  className={`p-6 border-2 rounded-lg hover:border-green-500 hover:bg-green-50 transition ${
                    dealCategory === 'pipeline' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-4xl mb-3">📊</div>
                  <h4 className="font-semibold text-gray-900 mb-2">Add to Pipeline</h4>
                  <p className="text-sm text-gray-600">
                    Deals you're prospecting or analyzing
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Development Type */}
          {currentStep === STEPS.TYPE && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                What type of development is this?
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setDevelopmentType('new');
                    handleNext();
                  }}
                  className={`p-6 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition ${
                    developmentType === 'new' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-4xl mb-3">🏗️</div>
                  <h4 className="font-semibold text-gray-900 mb-2">New Development</h4>
                  <p className="text-sm text-gray-600">
                    Vacant land or ground-up construction
                  </p>
                </button>
                <button
                  onClick={() => {
                    setDevelopmentType('existing');
                    handleNext();
                  }}
                  className={`p-6 border-2 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition ${
                    developmentType === 'existing' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="text-4xl mb-3">🏢</div>
                  <h4 className="font-semibold text-gray-900 mb-2">Existing Property</h4>
                  <p className="text-sm text-gray-600">
                    Existing building or developed property
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Address */}
          {currentStep === STEPS.ADDRESS && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                What's the property address?
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Peachtree St NE, Atlanta, GA 30303"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleGeocodeAddress();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Enter a full address including city and state for best results
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Boundary */}
          {currentStep === STEPS.BOUNDARY && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {developmentType === 'new'
                  ? 'Draw the property boundary'
                  : 'Verify property location'}
              </h3>
              <div
                ref={mapContainer}
                className="w-full h-[400px] rounded-lg border-2 border-gray-200"
              />
              {developmentType === 'new' && (
                <p className="text-sm text-gray-600">
                  Use the polygon tool to draw the property boundary. Click to add points,
                  double-click to complete.
                </p>
              )}
              {boundary && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✓ {developmentType === 'new' ? 'Boundary drawn' : 'Location set'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Details */}
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
                  type="text"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  placeholder="e.g., Buckhead Mixed-Use Development"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the deal..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subscription Tier
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as any)}
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
            {currentStep > STEPS.CATEGORY && (
              <Button onClick={handleBack} disabled={isLoading}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            {currentStep === STEPS.ADDRESS && (
              <Button onClick={handleGeocodeAddress} disabled={isLoading || !address.trim()}>
                Locate on Map →
              </Button>
            )}
            {currentStep === STEPS.BOUNDARY && developmentType === 'new' && (
              <Button onClick={handleNext} disabled={isLoading || !boundary}>
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
