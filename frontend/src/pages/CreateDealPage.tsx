import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../stores/dealStore';
import { Button } from '../components/shared/Button';
import { GooglePlacesInput } from '../components/shared/GooglePlacesInput';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import { apiClient } from '../services/api.client';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  DETAILS_ADDRESS: 1,
  TYPE: 2,
  CATEGORY: 3,
  PROPERTY_TYPE: 4,
  DOCUMENTS: 5,
  TRADE_AREA: 6,
} as const;

export const CreateDealPage: React.FC = () => {
  const navigate = useNavigate();
  const { createDeal, isLoading } = useDealStore();

  const [currentStep, setCurrentStep] = useState<number>(STEPS.DETAILS_ADDRESS);
  const [dealCategory, setDealCategory] = useState<DealCategory | null>(null);
  const [developmentType, setDevelopmentType] = useState<DevelopmentType | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [availablePropertyTypes, setAvailablePropertyTypes] = useState<PropertyType[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [dealName, setDealName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [purchasePrice, setPurchasePrice] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [units, setUnits] = useState('');
  const [occupancy, setOccupancy] = useState('');
  const [rentPerSf, setRentPerSf] = useState('');
  const [capRate, setCapRate] = useState('');
  const [renovationBudget, setRenovationBudget] = useState('');

  const [tradeAreaId, setTradeAreaId] = useState<number | null>(null);
  const [submarketId, setSubmarketId] = useState<number | null>(null);
  const [msaId, setMsaId] = useState<number | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    // Simplified property types for development deals
    const developmentPropertyTypes = [
      {
        id: 1,
        type_key: 'multifamily',
        display_name: 'Multifamily',
        category: 'Residential',
        description: 'Multi-unit residential building',
        icon: '🏢',
      },
      // Add more if needed in the future:
      // { id: 2, type_key: 'mixed-use', display_name: 'Mixed-Use', category: 'Mixed', description: 'Residential with ground floor retail', icon: '🏪' },
      // { id: 3, type_key: 'senior-housing', display_name: 'Senior Housing', category: 'Specialized', description: 'Age-restricted housing', icon: '🏥' },
    ];
    setAvailablePropertyTypes(developmentPropertyTypes);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
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

  useEffect(() => {
    if (!map.current || !coordinates) return;

    if (marker.current) {
      marker.current.remove();
    }
    marker.current = new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat(coordinates)
      .addTo(map.current);

    map.current.flyTo({
      center: coordinates,
      zoom: 16,
      duration: 1500,
    });
  }, [coordinates]);

  const handleSelectType = (type: DevelopmentType) => {
    setDevelopmentType(type);
    setCurrentStep(STEPS.CATEGORY);
    setError(null);
  };

  const handleSelectCategory = (category: DealCategory) => {
    setDealCategory(category);
    setCurrentStep(STEPS.PROPERTY_TYPE);
    setError(null);
  };

  const handleSelectPropertyType = (type: PropertyType) => {
    setPropertyType(type);
    setCurrentStep(STEPS.DOCUMENTS);
    setError(null);
  };

  const handleProceedFromDocuments = () => {
    // All fields are now optional - user can skip
    setError(null);
    setCurrentStep(STEPS.TRADE_AREA);
  };

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    setError(null);

    const uploadedFiles: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post('/api/v1/deals/upload-document', formData, {
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

  const handleAddressSelected = async (value: string, coords: [number, number] | null) => {
    setAddress(value);
    
    if (coords) {
      setCoordinates(coords);
      setError(null);

      const [lng, lat] = coords;

      try {
        const submarketResponse = await apiClient.get('/api/v1/submarkets/lookup', {
          params: { lat, lng },
        });
        if (submarketResponse.data.success) {
          setSubmarketId(submarketResponse.data.data.id);
          setMsaId(submarketResponse.data.data.msa_id);
        }
      } catch (err) {
        console.error('Failed to lookup submarket:', err);
      }
    }
  };

  const handleTradeAreaSave = (id: number) => {
    setTradeAreaId(id);
    handleSubmit();
  };

  const handleSkipTradeArea = () => {
    setTradeAreaId(null);
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }

    if (!address.trim() || !coordinates) {
      setError('Please enter a property address');
      return;
    }

    try {
      // Prepare deal creation payload
      const boundary = {
        type: 'Point',
        coordinates: coordinates,
      };

      const dealPayload: any = {
        name: dealName,
        description,
        deal_category: dealCategory!,
        development_type: developmentType!,
        property_type_id: propertyType?.id,
        property_type_key: propertyType?.type_key,
        address,
        boundary,
        purchase_price: purchasePrice ? parseFloat(purchasePrice.replace(/[^0-9.]/g, '')) : undefined,
        call_for_offer_date: offerDate || undefined,
        units: units ? parseInt(units) : undefined,
        occupancy: occupancy ? parseFloat(occupancy) : undefined,
        rent_per_sf: rentPerSf ? parseFloat(rentPerSf) : undefined,
        cap_rate: capRate ? parseFloat(capRate) : undefined,
        renovation_budget: renovationBudget ? parseFloat(renovationBudget.replace(/[^0-9.]/g, '')) : undefined,
        uploaded_documents: uploadedDocuments.map(doc => doc.id),
      };

      const result = await createDeal(dealPayload);

      if (result && (submarketId || msaId || tradeAreaId)) {
        try {
          await apiClient.post(`/api/v1/deals/${result.id}/geographic-context`, {
            trade_area_id: tradeAreaId,
            submarket_id: submarketId,
            msa_id: msaId,
            active_scope: tradeAreaId ? 'trade_area' : 'submarket',
          });
        } catch (contextErr) {
          console.error('Failed to link geographic context:', contextErr);
        }
      }

      // Redirect to the deal detail page
      if (result?.id) {
        navigate(`/deals/${result.id}`);
      } else {
        // Fallback to list view
        if (dealCategory === 'pipeline') {
          navigate('/deals');
        } else if (dealCategory === 'portfolio') {
          navigate('/assets-owned');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create deal');
    }
  };

  const handleBack = () => {
    setError(null);
    
    switch (currentStep) {
      case STEPS.TYPE:
        setCurrentStep(STEPS.DETAILS_ADDRESS);
        setDevelopmentType(null);
        break;
      case STEPS.CATEGORY:
        setCurrentStep(STEPS.TYPE);
        setDealCategory(null);
        break;
      case STEPS.PROPERTY_TYPE:
        setCurrentStep(STEPS.CATEGORY);
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
      case STEPS.TRADE_AREA:
        setCurrentStep(STEPS.DOCUMENTS);
        setTradeAreaId(null);
        break;
      default:
        break;
    }
  };

  const handleProceedToType = () => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }
    if (!address.trim()) {
      setError('Please enter a property address');
      return;
    }
    setError(null);
    setCurrentStep(STEPS.TYPE);
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-2/5 overflow-y-auto bg-gray-50 border-r border-gray-200">
          <div className="max-w-2xl mx-auto p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Deal</h1>
              <p className="text-gray-600">
                Step {currentStep} of {STEPS.TRADE_AREA} &bull; {
                  currentStep === STEPS.DETAILS_ADDRESS ? 'Deal Details & Address' :
                  currentStep === STEPS.TYPE ? 'Development Type' :
                  currentStep === STEPS.CATEGORY ? 'Deal Category' :
                  currentStep === STEPS.PROPERTY_TYPE ? 'Property Type' :
                  currentStep === STEPS.DOCUMENTS ? 'Documents & Data' :
                  currentStep === STEPS.TRADE_AREA ? 'Trade Area' :
                  'Setup'
                }
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2">
                {Array.from({ length: STEPS.TRADE_AREA }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      idx + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {currentStep === STEPS.DETAILS_ADDRESS && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Deal Details & Property Location
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deal Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={dealName}
                        onChange={(e) => setDealName(e.target.value)}
                        placeholder="e.g., Midtown Crossing Apartments"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
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
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Property Address <span className="text-red-500">*</span>
                      </label>
                      <GooglePlacesInput
                        value={address}
                        onChange={handleAddressSelected}
                        placeholder="Start typing an address..."
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Start typing and select from the dropdown
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleProceedToType}
                      disabled={!dealName.trim() || !address.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Continue to Development Type &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
                            Ground-up construction or major redevelopment.
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleSelectType('existing')}
                      className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">🏠</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">
                            Existing Property
                          </h3>
                          <p className="text-gray-600">
                            Existing building or site acquisition.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                        <div className="text-4xl">📈</div>
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
                                <div className="text-2xl">🏠</div>
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

            {currentStep === STEPS.DOCUMENTS && propertyType && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Upload Documents & Enter Deal Data{' '}
                    <span className="text-base font-normal text-gray-500">(Optional)</span>
                  </h2>
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Property Type:</span> {propertyType.display_name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Document Upload</h3>
                      
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

                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Deal Data</h3>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Purchase Price
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
                            placeholder="Enter now or skip"
                            className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Call for Offer Date
                        </label>
                        <input
                          type="date"
                          value={offerDate}
                          onChange={(e) => setOfferDate(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-3">Additional data (all fields are optional):</p>

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

                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Occupancy %
                          </label>
                          <input
                            type="number"
                            value={occupancy}
                            onChange={(e) => setOccupancy(e.target.value)}
                            placeholder="e.g., 92"
                            min="0"
                            max="100"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Avg Rent per SF
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="text"
                              value={rentPerSf}
                              onChange={(e) => setRentPerSf(e.target.value.replace(/[^0-9.]/g, ''))}
                              placeholder="e.g., 1.85"
                              className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

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

                        <div className="mb-3">
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

                  <div className="mt-6 flex justify-between">
                    <Button
                      onClick={handleProceedFromDocuments}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      Skip for now
                    </Button>
                    <Button
                      onClick={handleProceedFromDocuments}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Continue to Trade Area &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === STEPS.TRADE_AREA && coordinates && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Define Trade Area{' '}
                    <span className="text-base font-normal text-gray-500">(Optional)</span>
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Set the competitive radius around your property for market analysis. You can skip this and define it later.
                  </p>

                  <TradeAreaDefinitionPanel
                    propertyLat={coordinates[1]}
                    propertyLng={coordinates[0]}
                    onSave={handleTradeAreaSave}
                    onSkip={handleSkipTradeArea}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              {currentStep > STEPS.DETAILS_ADDRESS && (
                <Button onClick={handleBack} disabled={isLoading}>
                  ← Back
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="w-3/5 relative bg-gray-100">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {!coordinates && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl p-8 shadow-2xl max-w-md text-center">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Map Preview
                </h3>
                <p className="text-gray-600">
                  The map will show your property location once you enter an address in Step 1.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
