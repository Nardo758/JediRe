import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { Button } from '../components/shared/Button';
import { GooglePlacesInput } from '../components/shared/GooglePlacesInput';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import { api } from '../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type DealCategory = 'portfolio' | 'pipeline';
type DevelopmentType = 'new' | 'existing';

interface PropertyType {
  id: number;
  type_key: string;
  display_name: string;
  category: string;
  description: string;
  icon: string;
}

const STEPS = {
  CATEGORY: 1,        // Deal Category
  TYPE: 2,            // Development Type (progressive reveal after category)
  PROPERTY_TYPE: 3,   // Property Type Selection
  DOCUMENTS: 4,       // Documents & Deal Data (Purchase Price, Offer Date, etc.)
  DETAILS: 5,         // Deal Name + Description
  ADDRESS: 6,         // Property Address
  TRADE_AREA: 7,      // Trade Area (optional)
  BOUNDARY: 8,        // Boundary (optional, new dev only)
} as const;

export const CreateDealPage: React.FC = () => {
  const navigate = useNavigate();
  const { createDeal, isLoading } = useDealStore();
  const { startDrawing, drawnGeometry, clearDrawing } = useMapDrawingStore();

  // Form state
  const [currentStep, setCurrentStep] = useState<number>(STEPS.CATEGORY);
  const [dealCategory, setDealCategory] = useState<DealCategory | null>(null);
  const [developmentType, setDevelopmentType] = useState<DevelopmentType | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [availablePropertyTypes, setAvailablePropertyTypes] = useState<PropertyType[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [dealName, setDealName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Deal data state (Step 4)
  const [purchasePrice, setPurchasePrice] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [units, setUnits] = useState('');
  const [occupancy, setOccupancy] = useState('');
  const [rentPerSf, setRentPerSf] = useState('');
  const [capRate, setCapRate] = useState('');
  const [renovationBudget, setRenovationBudget] = useState('');

  // Geographic context
  const [tradeAreaId, setTradeAreaId] = useState<number | null>(null);
  const [submarketId, setSubmarketId] = useState<number | null>(null);
  const [msaId, setMsaId] = useState<number | null>(null);

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  // Load property types on mount
  useEffect(() => {
    const loadPropertyTypes = async () => {
      try {
        const response = await api.get('/property-types');
        if (response.data.success) {
          setAvailablePropertyTypes(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load property types:', err);
      }
    };
    loadPropertyTypes();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11,
      });

      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
      });

      map.current.addControl(draw.current, 'top-left');
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('draw.create', (e: any) => {
        const geometry = e.features[0].geometry;
        setBoundary(geometry);
      });

      map.current.on('draw.update', (e: any) => {
        const geometry = e.features[0].geometry;
        setBoundary(geometry);
      });

      map.current.on('draw.delete', () => {
        setBoundary(null);
      });
    } catch (err) {
      console.error('Map initialization error:', err);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle boundary drawing mode
  useEffect(() => {
    if (!map.current || !draw.current) return;

    if (currentStep === STEPS.BOUNDARY && developmentType === 'new' && coordinates) {
      draw.current.deleteAll();
      draw.current.changeMode('draw_polygon');
      
      map.current.flyTo({
        center: coordinates,
        zoom: 18,
        duration: 1500,
      });
    } else {
      draw.current.changeMode('simple_select');
    }
  }, [currentStep, developmentType, coordinates]);

  // Update map when coordinates change
  useEffect(() => {
    if (!map.current || !coordinates) return;

    // Add marker
    if (marker.current) {
      marker.current.remove();
    }
    marker.current = new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat(coordinates)
      .addTo(map.current);

    // Fly to location
    map.current.flyTo({
      center: coordinates,
      zoom: 16,
      duration: 1500,
    });
  }, [coordinates]);

  // Handle category selection
  const handleSelectCategory = (category: DealCategory) => {
    setDealCategory(category);
    setCurrentStep(STEPS.TYPE);
    setError(null);
  };

  // Handle development type selection
  const handleSelectType = (type: DevelopmentType) => {
    setDevelopmentType(type);
    setCurrentStep(STEPS.PROPERTY_TYPE);
    setError(null);
  };

  // Handle property type selection
  const handleSelectPropertyType = (type: PropertyType) => {
    setPropertyType(type);
    setCurrentStep(STEPS.DOCUMENTS);
    setError(null);
  };

  // Handle documents & data step continuation
  const handleProceedFromDocuments = () => {
    if (!purchasePrice.trim()) {
      setError('Purchase Price is required');
      return;
    }
    if (!offerDate.trim()) {
      setError('Call for Offer Date is required');
      return;
    }
    setError(null);
    setCurrentStep(STEPS.DETAILS);
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    setError(null);

    const uploadedFiles: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/deals/upload-document', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          uploadedFiles.push({
            id: response.data.data.id,
            name: file.name,
            type: file.type,
            size: file.size,
          });
        }
      }

      setUploadedDocuments([...uploadedDocuments, ...uploadedFiles]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle proceeding to address entry
  const handleProceedToAddress = () => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }
    setError(null);
    setCurrentStep(STEPS.ADDRESS);
  };

  // Handle address selection
  const handleAddressSelected = async (value: string, coords: [number, number] | null) => {
    setAddress(value);
    
    if (coords) {
      setCoordinates(coords);
      setError(null);

      const [lng, lat] = coords;

      // Lookup submarket and MSA
      try {
        const submarketResponse = await api.get('/submarkets/lookup', {
          params: { lat, lng },
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
          coordinates: coords,
        });
      }

      // Move to trade area step
      setCurrentStep(STEPS.TRADE_AREA);
    }
  };

  // Handle trade area save
  const handleTradeAreaSave = (id: number) => {
    setTradeAreaId(id);
    
    if (developmentType === 'new') {
      setCurrentStep(STEPS.BOUNDARY);
    } else {
      // Existing property - we're done, submit
      handleSubmit();
    }
  };

  // Handle skip trade area
  const handleSkipTradeArea = () => {
    setTradeAreaId(null);
    
    if (developmentType === 'new') {
      setCurrentStep(STEPS.BOUNDARY);
    } else {
      // Existing property - we're done, submit
      handleSubmit();
    }
  };

  // Handle skip boundary
  const handleSkipBoundary = () => {
    if (coordinates) {
      setBoundary({
        type: 'Point',
        coordinates: coordinates,
      });
    }
    // Submit the deal
    handleSubmit();
  };

  // Handle form submission
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
        deal_category: dealCategory!,
        development_type: developmentType!,
        property_type_id: propertyType?.id,
        property_type_key: propertyType?.type_key,
        address,
        boundary,
        // New deal data fields
        purchase_price: purchasePrice ? parseFloat(purchasePrice.replace(/[^0-9.]/g, '')) : undefined,
        call_for_offer_date: offerDate || undefined,
        units: units ? parseInt(units) : undefined,
        occupancy: occupancy ? parseFloat(occupancy) : undefined,
        rent_per_sf: rentPerSf ? parseFloat(rentPerSf) : undefined,
        cap_rate: capRate ? parseFloat(capRate) : undefined,
        renovation_budget: renovationBudget ? parseFloat(renovationBudget.replace(/[^0-9.]/g, '')) : undefined,
        uploaded_documents: uploadedDocuments.map(doc => doc.id),
      });

      // Link geographic context if available
      if (result && (submarketId || msaId || tradeAreaId)) {
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

      // Navigate based on deal category
      if (dealCategory === 'pipeline') {
        navigate('/deals');
      } else if (dealCategory === 'portfolio') {
        navigate('/assets-owned');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create deal');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    setError(null);
    
    switch (currentStep) {
      case STEPS.TYPE:
        setCurrentStep(STEPS.CATEGORY);
        setDevelopmentType(null);
        break;
      case STEPS.PROPERTY_TYPE:
        setCurrentStep(STEPS.TYPE);
        setPropertyType(null);
        break;
      case STEPS.DOCUMENTS:
        setCurrentStep(STEPS.PROPERTY_TYPE);
        setPurchasePrice('');
        setOfferDate('');
        setUnits('');
        setOccupancy('');
        setRentPerSf('');
        setCapRate('');
        setRenovationBudget('');
        setUploadedDocuments([]);
        break;
      case STEPS.DETAILS:
        setCurrentStep(STEPS.DOCUMENTS);
        setDealName('');
        setDescription('');
        break;
      case STEPS.ADDRESS:
        setCurrentStep(STEPS.DETAILS);
        setAddress('');
        setCoordinates(null);
        break;
      case STEPS.TRADE_AREA:
        setCurrentStep(STEPS.ADDRESS);
        setTradeAreaId(null);
        break;
      case STEPS.BOUNDARY:
        setCurrentStep(STEPS.TRADE_AREA);
        setBoundary(null);
        if (draw.current) {
          draw.current.deleteAll();
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-6 bg-white z-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Dashboard</span>
        </button>
      </div>

      {/* Main Content: 40/60 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form Content (40%) */}
        <div className="w-2/5 overflow-y-auto bg-gray-50 border-r border-gray-200">
          <div className="max-w-2xl mx-auto p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Deal</h1>
              <p className="text-gray-600">
                Step {currentStep} of {STEPS.BOUNDARY} • {
                  currentStep <= STEPS.TYPE ? 'Setup' :
                  currentStep === STEPS.PROPERTY_TYPE ? 'Property Type' :
                  currentStep === STEPS.DOCUMENTS ? 'Documents & Deal Data' :
                  currentStep === STEPS.DETAILS ? 'Deal Details' :
                  'Location'
                }
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex items-center gap-2">
                {Array.from({ length: STEPS.BOUNDARY }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      idx + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Step 1: Deal Category */}
            {currentStep === STEPS.CATEGORY && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    What type of deal is this?
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSelectCategory('portfolio')}
                      className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">📁</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            Portfolio
                          </h3>
                          <p className="text-gray-600">
                            Properties you own or manage. Track performance, documents, and operations.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleSelectCategory('pipeline')}
                      className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">📊</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            Pipeline
                          </h3>
                          <p className="text-gray-600">
                            Deals you're prospecting. Track opportunities, analysis, and due diligence.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Development Type */}
            {currentStep === STEPS.TYPE && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Is this a new development or existing property?
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSelectType('new')}
                      className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">🏗️</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            New Development
                          </h3>
                          <p className="text-gray-600">
                            Ground-up construction. You'll define the property boundary.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleSelectType('existing')}
                      className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">🏢</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            Existing Property
                          </h3>
                          <p className="text-gray-600">
                            Existing building or site. We'll use the address location.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Property Type */}
            {currentStep === STEPS.PROPERTY_TYPE && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    What type of property is this?
                  </h2>
                  <div className="max-h-[500px] overflow-y-auto pr-2 space-y-6">
                    {Object.entries(
                      availablePropertyTypes.reduce((acc, type) => {
                        if (!acc[type.category]) acc[type.category] = [];
                        acc[type.category].push(type);
                        return acc;
                      }, {} as Record<string, PropertyType[]>)
                    ).map(([category, types]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          {category}
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {types.map((type) => (
                            <button
                              key={type.id}
                              onClick={() => handleSelectPropertyType(type)}
                              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-2xl">🏢</div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 text-sm">
                                    {type.display_name}
                                  </h4>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {type.description}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Documents & Deal Data */}
            {currentStep === STEPS.DOCUMENTS && propertyType && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Upload Documents & Enter Deal Data
                  </h2>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Property Type:</span> {propertyType.display_name}
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column: Document Upload */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Document Upload</h3>
                      
                      {/* Drag & Drop Zone */}
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer"
                        onDrop={(e) => {
                          e.preventDefault();
                          handleFileUpload(e.dataTransfer.files);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <div className="text-4xl mb-2">📄</div>
                        <p className="text-sm text-gray-600 mb-2">
                          Drag & drop files here, or click to browse
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, Excel, Word, Images
                        </p>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              handleFileUpload(e.target.files);
                            }
                          }}
                        />
                      </div>

                      {/* Document Type Suggestions */}
                      <div className="text-xs text-gray-500 space-y-1">
                        <p className="font-semibold">Suggested Documents:</p>
                        <ul className="list-disc list-inside pl-2">
                          <li>Offering Memorandum (OM)</li>
                          <li>Rent Roll</li>
                          <li>T-12 Operating Statements</li>
                          <li>Broker Package</li>
                          <li>Photos</li>
                          <li>Other</li>
                        </ul>
                      </div>

                      {/* Uploaded Files List */}
                      {uploadedDocuments.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">Uploaded Files:</h4>
                          {uploadedDocuments.map((doc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-xs"
                            >
                              <span className="truncate flex-1">{doc.name}</span>
                              <button
                                onClick={() => {
                                  setUploadedDocuments(uploadedDocuments.filter((_, i) => i !== idx));
                                }}
                                className="text-red-600 hover:text-red-800 ml-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {isUploading && (
                        <div className="text-sm text-blue-600 text-center">
                          Uploading...
                        </div>
                      )}
                    </div>

                    {/* Right Column: Required Manual Inputs */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Deal Data</h3>

                      {/* Purchase Price - REQUIRED */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Purchase Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-500">$</span>
                          <input
                            type="text"
                            value={purchasePrice}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              setPurchasePrice(value ? parseFloat(value).toLocaleString() : '');
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Call for Offer Date - REQUIRED */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Call for Offer Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={offerDate}
                          onChange={(e) => setOfferDate(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Optional Fields */}
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-3">Optional (can be extracted from documents):</p>

                        {/* Number of Units */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Number of Units
                          </label>
                          <input
                            type="number"
                            value={units}
                            onChange={(e) => setUnits(e.target.value)}
                            placeholder="e.g., 150"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Current Occupancy % */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Occupancy %
                          </label>
                          <input
                            type="number"
                            value={occupancy}
                            onChange={(e) => setOccupancy(e.target.value)}
                            placeholder="e.g., 95"
                            step="0.1"
                            min="0"
                            max="100"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Current Rent/SF */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Rent/SF or Avg Rent
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={rentPerSf}
                              onChange={(e) => setRentPerSf(e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Cap Rate % */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cap Rate %
                          </label>
                          <input
                            type="number"
                            value={capRate}
                            onChange={(e) => setCapRate(e.target.value)}
                            placeholder="e.g., 5.5"
                            step="0.1"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Renovation Budget */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Renovation Budget
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="text"
                              value={renovationBudget}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                setRenovationBudget(value ? parseFloat(value).toLocaleString() : '');
                              }}
                              placeholder="0"
                              className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleProceedFromDocuments}
                      disabled={!purchasePrice.trim() || !offerDate.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Continue to Deal Details →
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    You can skip document upload and enter data manually, but Purchase Price and Offer Date are required.
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Deal Details */}
            {currentStep === STEPS.DETAILS && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Tell us about this deal
                  </h2>

                  <div className="space-y-4">
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
                        Description (Optional)
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the deal..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Setup Summary</h4>
                      <div className="text-sm text-gray-700 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category:</span>
                          <span className="font-medium">
                            {dealCategory === 'portfolio' ? 'Portfolio (Owned)' : 'Pipeline (Prospecting)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">
                            {developmentType === 'new' ? 'New Development' : 'Existing Property'}
                          </span>
                        </div>
                        {propertyType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Property:</span>
                            <span className="font-medium">{propertyType.display_name}</span>
                          </div>
                        )}
                        {purchasePrice && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Purchase Price:</span>
                            <span className="font-medium">${purchasePrice}</span>
                          </div>
                        )}
                        {offerDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Offer Date:</span>
                            <span className="font-medium">{new Date(offerDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Property Address */}
            {currentStep === STEPS.ADDRESS && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Where is the property located?
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Address
                    </label>
                    <GooglePlacesInput
                      id="create-deal-address"
                      name="address"
                      value={address}
                      onChange={handleAddressSelected}
                      placeholder="Start typing address... (e.g., 123 Peachtree St NE, Atlanta, GA)"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Start typing and select from the dropdown
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Trade Area (Optional) */}
            {currentStep === STEPS.TRADE_AREA && coordinates && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Define Trade Area{' '}
                    <span className="text-base font-normal text-gray-500">(Optional)</span>
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Define the geographic area you want to analyze, or skip to continue.
                  </p>
                  <TradeAreaDefinitionPanel
                    propertyLat={coordinates[1]}
                    propertyLng={coordinates[0]}
                    onSave={handleTradeAreaSave}
                    onSkip={handleSkipTradeArea}
                    onCustomDraw={() => {
                      if (developmentType === 'new') {
                        setCurrentStep(STEPS.BOUNDARY);
                      } else {
                        handleSubmit();
                      }
                    }}
                  />
                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={handleSkipTradeArea}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      Skip - Use System Defaults
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 8: Boundary (Optional, New Dev Only) */}
            {currentStep === STEPS.BOUNDARY && developmentType === 'new' && coordinates && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Draw Property Boundary{' '}
                    <span className="text-base font-normal text-gray-500">(Optional)</span>
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Use the map tools to draw the exact property boundary, or skip to use the address point.
                  </p>

                  <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl text-center">
                    <div className="text-5xl mb-3">🗺️</div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      Drawing Tools Active
                    </h3>
                    <p className="text-sm text-blue-700 mb-4">
                      Use the polygon tool on the map to outline your property boundary.
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <div>• Click to add points around the property</div>
                      <div>• Double-click to finish the polygon</div>
                      <div>• Use the trash icon to start over</div>
                    </div>
                  </div>

                  {boundary && boundary.type !== 'Point' && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                      <p className="text-sm text-green-800 font-semibold text-center">
                        ✓ Boundary drawn successfully!
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-center gap-3">
                    {boundary && boundary.type !== 'Point' ? (
                      <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      >
                        {isLoading ? 'Creating Deal...' : 'Create Deal with Boundary'}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSkipBoundary}
                        disabled={isLoading}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                      >
                        Skip - Use Point Location & Create
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex items-center gap-3">
              {currentStep > STEPS.CATEGORY && (
                <Button onClick={handleBack} disabled={isLoading}>
                  ← Back
                </Button>
              )}
              {currentStep === STEPS.DETAILS && (
                <Button
                  onClick={handleProceedToAddress}
                  disabled={!dealName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  Continue to Location →
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Map (60%) */}
        <div className="w-3/5 relative bg-gray-100">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Map Instructions Overlay */}
          {!coordinates && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl p-8 shadow-2xl max-w-md text-center">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Map Preview
                </h3>
                <p className="text-gray-600">
                  The map will show your property location once you enter an address in Step 4.
                </p>
              </div>
            </div>
          )}

          {/* Drawing Mode Instructions */}
          {currentStep === STEPS.BOUNDARY && developmentType === 'new' && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
              <h4 className="font-semibold text-gray-900 mb-2">Drawing Tools</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Click the polygon tool to start drawing</p>
                <p>Click points around your property</p>
                <p>Double-click to finish</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
