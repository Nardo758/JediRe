import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { Button } from '../components/shared/Button';
import { GooglePlacesInput } from '../components/shared/GooglePlacesInput';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import { apiClient } from '../services/api.client';
import { Building3DEditor } from '../components/design';
import { FinancialModelDisplay } from '../components/financial';
import { designOptimizerService } from '../services/designOptimizer.service';
import { financialAutoSync } from '../services/financialAutoSync.service';
import type { Design3D, ProForma, FinancialAssumptions } from '../types/financial.types';
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
  CATEGORY: 1,
  TYPE: 2,
  PROPERTY_TYPE: 3,
  DOCUMENTS: 4,
  DETAILS: 5,
  ADDRESS: 6,
  TRADE_AREA: 7,
  BOUNDARY: 8,
  DESIGN_3D: 9,           // New: 3D Building Design (development only)
  NEIGHBORS: 10,          // New: Neighboring Property Recommendations (development only)
  OPTIMIZE: 11,           // New: Design Optimization (development only)
  FINANCIAL: 12,          // New: Financial Review (development only)
} as const;

export const CreateDealPage: React.FC = () => {
  const navigate = useNavigate();
  const { createDeal, isLoading } = useDealStore();
  const { startDrawing, drawnGeometry, clearDrawing } = useMapDrawingStore();

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

  // ============================================================================
  // 3D DEVELOPMENT FLOW STATE (Steps 9-12)
  // ============================================================================
  const [design3D, setDesign3D] = useState<Design3D | null>(null);
  const [selectedNeighbors, setSelectedNeighbors] = useState<any[]>([]);
  const [neighboringProperties, setNeighboringProperties] = useState<any[]>([]);
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState(false);
  const [optimizedDesign, setOptimizedDesign] = useState<any | null>(null);
  const [optimizationResults, setOptimizationResults] = useState<any | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [proForma, setProForma] = useState<ProForma | null>(null);
  const [financialAssumptions, setFinancialAssumptions] = useState<FinancialAssumptions | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    const loadPropertyTypes = async () => {
      try {
        const response = await apiClient.get('/api/v1/property-types');
        if (response.data.success) {
          setAvailablePropertyTypes(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load property types:', err);
      }
    };
    loadPropertyTypes();
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

  const handleSelectCategory = (category: DealCategory) => {
    setDealCategory(category);
    setCurrentStep(STEPS.TYPE);
    setError(null);
  };

  const handleSelectType = (type: DevelopmentType) => {
    setDevelopmentType(type);
    setCurrentStep(STEPS.PROPERTY_TYPE);
    setError(null);
  };

  const handleSelectPropertyType = (type: PropertyType) => {
    setPropertyType(type);
    setCurrentStep(STEPS.DOCUMENTS);
    setError(null);
  };

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

  const handleProceedToAddress = () => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }
    setError(null);
    setCurrentStep(STEPS.ADDRESS);
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

      if (developmentType === 'existing') {
        setBoundary({
          type: 'Point',
          coordinates: coords,
        });
      }

      setCurrentStep(STEPS.TRADE_AREA);
    }
  };

  const handleTradeAreaSave = (id: number) => {
    setTradeAreaId(id);
    
    if (developmentType === 'new') {
      setCurrentStep(STEPS.BOUNDARY);
    } else {
      handleSubmit();
    }
  };

  const handleSkipTradeArea = () => {
    setTradeAreaId(null);
    
    if (developmentType === 'new') {
      setCurrentStep(STEPS.BOUNDARY);
    } else {
      handleSubmit();
    }
  };

  const handleSkipBoundary = () => {
    if (coordinates) {
      setBoundary({
        type: 'Point',
        coordinates: coordinates,
      });
    }
    
    // For development deals, proceed to 3D design step
    if (developmentType === 'new') {
      setCurrentStep(STEPS.DESIGN_3D);
    } else {
      handleSubmit();
    }
  };

  // ============================================================================
  // 3D DEVELOPMENT FLOW HANDLERS
  // ============================================================================

  /**
   * Step 9: Handle 3D design completion
   * Captures design metrics from Building3DEditor and proceeds to neighbor recommendations
   */
  const handle3DDesignComplete = (designData: Design3D) => {
    setDesign3D(designData);
    setError(null);
    setCurrentStep(STEPS.NEIGHBORS);
  };

  /**
   * Step 10: Load neighboring property recommendations
   * Calls API to get properties within assemblage distance
   */
  const loadNeighboringProperties = async () => {
    if (!propertyId && !coordinates) {
      setError('Property location not available');
      return;
    }

    setIsLoadingNeighbors(true);
    setError(null);

    try {
      const [lng, lat] = coordinates!;
      const response = await apiClient.get(`/api/v1/properties/neighbors`, {
        params: {
          lat,
          lng,
          radius: 500, // 500 feet default assemblage radius
          limit: 10,
        },
      });

      if (response.data.success) {
        setNeighboringProperties(response.data.data || []);
      } else {
        setNeighboringProperties([]);
      }
    } catch (err: any) {
      console.error('Failed to load neighboring properties:', err);
      setError(err.message || 'Failed to load neighboring properties');
      setNeighboringProperties([]);
    } finally {
      setIsLoadingNeighbors(false);
    }
  };

  /**
   * Step 10: Handle neighbor selection and proceed to optimization
   */
  const handleNeighborsComplete = () => {
    setError(null);
    setCurrentStep(STEPS.OPTIMIZE);
  };

  /**
   * Step 10: Skip neighbor recommendations
   */
  const handleSkipNeighbors = () => {
    setSelectedNeighbors([]);
    setCurrentStep(STEPS.OPTIMIZE);
  };

  /**
   * Step 11: Run design optimization
   * Uses designOptimizer service to optimize unit mix, parking, and amenities
   */
  const handleOptimizeDesign = async () => {
    if (!design3D) {
      setError('3D design data not available');
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      // Prepare market demand data (would come from API in production)
      const marketDemand = {
        studioAbsorption: 2,
        oneBrAbsorption: 5,
        twoBrAbsorption: 4,
        threeBrAbsorption: 2,
        studioRentPSF: 2.5,
        oneBrRentPSF: 2.2,
        twoBrRentPSF: 2.0,
        threeBrRentPSF: 1.9,
        vacancy: 5,
      };

      // Prepare parcel data
      const parcelData = {
        lotSizeSqft: design3D.grossSF || 50000,
        zoningFAR: design3D.farMax || 3.0,
        maxHeight: design3D.stories * 12, // Assuming 12ft per story
        geometry: boundary?.type === 'Polygon' ? boundary : undefined,
      };

      // Run optimization
      const results = await designOptimizerService.optimizeDesign({
        marketDemand,
        parcelData,
        existingDesign: design3D,
        selectedNeighbors,
      });

      setOptimizationResults(results);
      
      // Store optimized design for financial modeling
      if (results.optimizedDesign) {
        setOptimizedDesign(results.optimizedDesign);
      }
    } catch (err: any) {
      console.error('Design optimization failed:', err);
      setError(err.message || 'Failed to optimize design');
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * Step 11: Accept optimization results
   */
  const handleAcceptOptimization = () => {
    if (optimizedDesign) {
      setDesign3D(optimizedDesign);
    }
    setError(null);
    setCurrentStep(STEPS.FINANCIAL);
  };

  /**
   * Step 11: Skip optimization and use current design
   */
  const handleSkipOptimization = () => {
    setOptimizedDesign(null);
    setOptimizationResults(null);
    setCurrentStep(STEPS.FINANCIAL);
  };

  /**
   * Step 12: Generate financial pro forma
   * Auto-generates financial model from 3D design
   */
  useEffect(() => {
    if (currentStep === STEPS.FINANCIAL && design3D && !financialAssumptions) {
      // Initialize default financial assumptions
      const defaultAssumptions: FinancialAssumptions = {
        marketRents: {
          studio: 1800,
          oneBed: 2200,
          twoBed: 2800,
          threeBed: 3500,
        },
        constructionCosts: {
          residentialPerSF: 250,
          parkingSurface: 5000,
          parkingStructured: 60000,
          parkingUnderground: 80000,
          amenityPerSF: 150,
          siteWork: 500000,
          contingency: 0.05,
        },
        softCosts: {
          architectureEngineering: 0.05,
          legalPermitting: 0.02,
          financing: 0.015,
          marketing: 50000,
          developerFee: 0.03,
        },
        operatingAssumptions: {
          vacancyRate: 0.05,
          managementFee: 0.04,
          operatingExpensesPerUnit: 5000,
          propertyTaxRate: 0.012,
          insurancePerUnit: 800,
          utilitiesPerUnit: 600,
          repairsMaintenancePerUnit: 1200,
          payrollPerUnit: 1000,
        },
        debtAssumptions: {
          loanToValue: 0.65,
          interestRate: 0.075,
          loanTerm: 30,
          amortization: 30,
          constructionLoanRate: 0.08,
          constructionPeriod: 24,
        },
        exitAssumptions: {
          holdPeriod: 10,
          exitCapRate: 0.05,
          sellingCosts: 0.02,
        },
      };

      setFinancialAssumptions(defaultAssumptions);

      // Trigger auto-generation
      financialAutoSync.onDesignChange(design3D);
    }
  }, [currentStep, design3D, financialAssumptions]);

  /**
   * Load neighboring properties when reaching Step 10
   */
  useEffect(() => {
    if (currentStep === STEPS.NEIGHBORS && neighboringProperties.length === 0) {
      loadNeighboringProperties();
    }
  }, [currentStep]);

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
      // Prepare deal creation payload
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

      // Include 3D development data if available (for new development deals)
      if (developmentType === 'new' && design3D) {
        dealPayload.design3D = design3D;
        dealPayload.selectedNeighbors = selectedNeighbors;
        dealPayload.optimizationResults = optimizationResults;
        dealPayload.proForma = proForma;
        dealPayload.financialAssumptions = financialAssumptions;
        
        // Override units with 3D design data
        dealPayload.units = design3D.totalUnits;
      }

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
      case STEPS.DESIGN_3D:
        setCurrentStep(STEPS.BOUNDARY);
        setDesign3D(null);
        break;
      case STEPS.NEIGHBORS:
        setCurrentStep(STEPS.DESIGN_3D);
        setSelectedNeighbors([]);
        setNeighboringProperties([]);
        break;
      case STEPS.OPTIMIZE:
        setCurrentStep(STEPS.NEIGHBORS);
        setOptimizedDesign(null);
        setOptimizationResults(null);
        break;
      case STEPS.FINANCIAL:
        setCurrentStep(STEPS.OPTIMIZE);
        setProForma(null);
        setFinancialAssumptions(null);
        break;
      default:
        break;
    }
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
                Step {currentStep} of {developmentType === 'new' ? STEPS.FINANCIAL : STEPS.BOUNDARY} &bull; {
                  currentStep <= STEPS.TYPE ? 'Setup' :
                  currentStep === STEPS.PROPERTY_TYPE ? 'Property Type' :
                  currentStep === STEPS.DOCUMENTS ? 'Documents & Deal Data' :
                  currentStep === STEPS.DETAILS ? 'Deal Details' :
                  currentStep === STEPS.ADDRESS ? 'Location' :
                  currentStep === STEPS.TRADE_AREA ? 'Trade Area' :
                  currentStep === STEPS.BOUNDARY ? 'Boundary' :
                  currentStep === STEPS.DESIGN_3D ? '3D Design' :
                  currentStep === STEPS.NEIGHBORS ? 'Neighboring Properties' :
                  currentStep === STEPS.OPTIMIZE ? 'Design Optimization' :
                  currentStep === STEPS.FINANCIAL ? 'Financial Review' :
                  'Location'
                }
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-2">
                {Array.from({ length: developmentType === 'new' ? STEPS.FINANCIAL : STEPS.BOUNDARY }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      idx + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

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
                        <div className="text-4xl">&#128193;</div>
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
                        <div className="text-4xl">&#128202;</div>
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
                        <div className="text-4xl">&#127959;&#65039;</div>
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
                        <div className="text-4xl">&#127970;</div>
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
                                <div className="text-2xl">&#127970;</div>
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
                    Upload Documents & Enter Deal Data
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
                        <div className="text-4xl mb-2">&#128196;</div>
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
                                &#10005;
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

                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-3">Optional (can be extracted from documents):</p>

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

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleProceedFromDocuments}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Continue to Deal Details &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === STEPS.DETAILS && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Name Your Deal
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
                  </div>
                </div>
              </div>
            )}

            {currentStep === STEPS.ADDRESS && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Property Location
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Property Address
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
                    Set the competitive radius around your property for market analysis.
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
                    <div className="text-5xl mb-3">&#128506;&#65039;</div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      Drawing Tools Active
                    </h3>
                    <p className="text-sm text-blue-700 mb-4">
                      Use the polygon tool on the map to outline your property boundary.
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <div>&bull; Click to add points around the property</div>
                      <div>&bull; Double-click to finish the polygon</div>
                      <div>&bull; Use the trash icon to start over</div>
                    </div>
                  </div>

                  {boundary && boundary.type !== 'Point' && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                      <p className="text-sm text-green-800 font-semibold text-center">
                        &#10003; Boundary drawn successfully!
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-center gap-3">
                    <Button
                      onClick={handleSkipBoundary}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Continue to 3D Design &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================================ */}
            {/* STEP 9: 3D BUILDING DESIGN (Development Only) */}
            {/* ============================================================================ */}
            {currentStep === STEPS.DESIGN_3D && developmentType === 'new' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Design Your Building in 3D
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Use the 3D editor to design your building. Define unit mix, massing, parking, and amenities.
                  </p>

                  <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden" style={{ height: '600px' }}>
                    <Building3DEditor
                      dealId={propertyId || undefined}
                      onMetricsChange={(metrics) => {
                        // Update design3D state with metrics from editor
                        const designData: Design3D = {
                          id: propertyId || `temp-${Date.now()}`,
                          dealId: propertyId || '',
                          totalUnits: metrics.totalUnits || 0,
                          unitMix: metrics.unitMix || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0 },
                          rentableSF: metrics.rentableSF || 0,
                          grossSF: metrics.grossSF || 0,
                          efficiency: metrics.efficiency || 0.85,
                          parkingSpaces: metrics.parkingSpaces || 0,
                          parkingType: metrics.parkingType || 'surface',
                          amenitySF: metrics.amenitySF || 0,
                          stories: metrics.stories || 1,
                          farUtilized: metrics.farUtilized || 0,
                          farMax: metrics.farMax,
                          lastModified: new Date().toISOString(),
                        };
                        setDesign3D(designData);
                      }}
                      onSave={() => {
                        if (design3D) {
                          handle3DDesignComplete(design3D);
                        } else {
                          setError('Please complete your 3D design before proceeding');
                        }
                      }}
                    />
                  </div>

                  {design3D && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-green-900">Total Units:</span>
                          <span className="ml-2 text-green-700">{design3D.totalUnits}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-green-900">Rentable SF:</span>
                          <span className="ml-2 text-green-700">{design3D.rentableSF.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-green-900">Stories:</span>
                          <span className="ml-2 text-green-700">{design3D.stories}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-green-900">Parking:</span>
                          <span className="ml-2 text-green-700">{design3D.parkingSpaces} spaces</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={() => {
                        if (design3D) {
                          handle3DDesignComplete(design3D);
                        } else {
                          setError('Please complete your 3D design before proceeding');
                        }
                      }}
                      disabled={!design3D}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Continue to Neighbor Analysis &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================================ */}
            {/* STEP 10: NEIGHBORING PROPERTY RECOMMENDATIONS */}
            {/* ============================================================================ */}
            {currentStep === STEPS.NEIGHBORS && developmentType === 'new' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Neighboring Property Recommendations
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Consider assembling adjacent properties to maximize development potential.
                  </p>

                  {isLoadingNeighbors ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">&#8987;</div>
                      <p className="text-gray-600">Loading neighboring properties...</p>
                    </div>
                  ) : neighboringProperties.length === 0 ? (
                    <div className="p-6 bg-gray-50 border-2 border-gray-200 rounded-xl text-center">
                      <div className="text-5xl mb-3">&#127970;</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No Adjacent Properties Found
                      </h3>
                      <p className="text-sm text-gray-600">
                        No neighboring properties available for assemblage at this location.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto">
                      {neighboringProperties.map((neighbor, idx) => (
                        <div
                          key={idx}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                            selectedNeighbors.find(n => n.id === neighbor.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => {
                            const isSelected = selectedNeighbors.find(n => n.id === neighbor.id);
                            if (isSelected) {
                              setSelectedNeighbors(selectedNeighbors.filter(n => n.id !== neighbor.id));
                            } else {
                              setSelectedNeighbors([...selectedNeighbors, neighbor]);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">
                                {neighbor.address || `Property ${idx + 1}`}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {neighbor.lotSize ? `${neighbor.lotSize.toLocaleString()} SF lot` : 'Lot size unknown'}
                              </p>
                              {neighbor.benefits && (
                                <div className="flex gap-2 mt-2">
                                  {neighbor.benefits.additionalUnits && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      +{neighbor.benefits.additionalUnits} units potential
                                    </span>
                                  )}
                                  {neighbor.benefits.costSavings && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      ${neighbor.benefits.costSavings.toLocaleString()} savings
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              {selectedNeighbors.find(n => n.id === neighbor.id) ? (
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex justify-between">
                    <Button
                      onClick={handleSkipNeighbors}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700"
                    >
                      Skip Neighbor Analysis
                    </Button>
                    <Button
                      onClick={handleNeighborsComplete}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {selectedNeighbors.length > 0 
                        ? `Continue with ${selectedNeighbors.length} Selected &rarr;`
                        : 'Continue without Neighbors &rarr;'
                      }
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================================ */}
            {/* STEP 11: DESIGN OPTIMIZATION */}
            {/* ============================================================================ */}
            {currentStep === STEPS.OPTIMIZE && developmentType === 'new' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Optimize Your Design
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Use AI-powered optimization to maximize returns based on market data and zoning constraints.
                  </p>

                  {!optimizationResults ? (
                    <div className="space-y-4">
                      <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl text-center">
                        <div className="text-5xl mb-3">&#129302;</div>
                        <h3 className="text-lg font-semibold text-purple-900 mb-2">
                          Ready to Optimize
                        </h3>
                        <p className="text-sm text-purple-700 mb-4">
                          Our AI will analyze market demand, zoning rules, and construction costs to suggest the optimal unit mix, parking configuration, and amenity package.
                        </p>
                        <Button
                          onClick={handleOptimizeDesign}
                          disabled={isOptimizing}
                          className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                        >
                          {isOptimizing ? 'Optimizing...' : '✨ Optimize Design'}
                        </Button>
                      </div>

                      {design3D && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <h4 className="font-semibold text-gray-900 mb-3">Current Design:</h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Total Units:</span>
                              <span className="ml-2 font-medium">{design3D.totalUnits}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Parking Spaces:</span>
                              <span className="ml-2 font-medium">{design3D.parkingSpaces}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Amenity SF:</span>
                              <span className="ml-2 font-medium">{design3D.amenitySF.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-6 bg-green-50 border-2 border-green-200 rounded-xl">
                        <div className="flex items-start gap-4">
                          <div className="text-4xl">&#9989;</div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-900 mb-2">
                              Optimization Complete!
                            </h3>
                            <p className="text-sm text-green-700 mb-4">
                              {optimizationResults.summary || 'Your design has been optimized for maximum returns.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {optimizationResults.comparison && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <h4 className="font-semibold text-gray-900 mb-3">Before Optimization:</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total Units:</span>
                                <span className="font-medium">{optimizationResults.comparison.before.totalUnits}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Parking:</span>
                                <span className="font-medium">{optimizationResults.comparison.before.parkingSpaces}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estimated NOI:</span>
                                <span className="font-medium">${(optimizationResults.comparison.before.estimatedNOI || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                            <h4 className="font-semibold text-green-900 mb-3">After Optimization:</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Total Units:</span>
                                <span className="font-semibold text-green-900">{optimizationResults.comparison.after.totalUnits}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">Parking:</span>
                                <span className="font-semibold text-green-900">{optimizationResults.comparison.after.parkingSpaces}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-700">Estimated NOI:</span>
                                <span className="font-semibold text-green-900">${(optimizationResults.comparison.after.estimatedNOI || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-green-300">
                              <div className="flex justify-between text-sm font-semibold text-green-900">
                                <span>Improvement:</span>
                                <span className="text-lg">+{optimizationResults.improvementPercent || 0}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          onClick={handleAcceptOptimization}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          &#10003; Accept Optimized Design
                        </Button>
                        <Button
                          onClick={handleSkipOptimization}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
                        >
                          Keep Original Design
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================================ */}
            {/* STEP 12: FINANCIAL REVIEW */}
            {/* ============================================================================ */}
            {currentStep === STEPS.FINANCIAL && developmentType === 'new' && design3D && financialAssumptions && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Financial Pro Forma Review
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Review the auto-generated financial model based on your 3D design.
                  </p>

                  <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                    <FinancialModelDisplay
                      design3D={design3D}
                      assumptions={financialAssumptions}
                      onProFormaChange={(newProForma) => {
                        setProForma(newProForma);
                      }}
                    />
                  </div>

                  {proForma && (
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-900">
                          ${(proForma.totalDevCost || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-700 mt-1">Total Development Cost</div>
                      </div>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-900">
                          {((proForma.leveragedIRR || 0) * 100).toFixed(2)}%
                        </div>
                        <div className="text-sm text-green-700 mt-1">Levered IRR</div>
                      </div>
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-900">
                          {((proForma.equityMultiple || 0)).toFixed(2)}x
                        </div>
                        <div className="text-sm text-purple-700 mt-1">Equity Multiple</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      {isLoading ? 'Creating Deal...' : '🎉 Finalize & Create Deal'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              {currentStep > STEPS.CATEGORY && currentStep !== STEPS.BOUNDARY && currentStep !== STEPS.DESIGN_3D && currentStep !== STEPS.NEIGHBORS && currentStep !== STEPS.OPTIMIZE && currentStep !== STEPS.FINANCIAL && (
                <Button onClick={handleBack} disabled={isLoading}>
                  &larr; Back
                </Button>
              )}
              {currentStep === STEPS.DESIGN_3D && (
                <Button onClick={handleBack} disabled={isLoading}>
                  &larr; Back
                </Button>
              )}
              {currentStep === STEPS.NEIGHBORS && (
                <Button onClick={handleBack} disabled={isLoading}>
                  &larr; Back to 3D Design
                </Button>
              )}
              {currentStep === STEPS.OPTIMIZE && (
                <Button onClick={handleBack} disabled={isLoading}>
                  &larr; Back to Neighbors
                </Button>
              )}
              {currentStep === STEPS.FINANCIAL && (
                <Button onClick={handleBack} disabled={isLoading}>
                  &larr; Back to Optimization
                </Button>
              )}
              {currentStep === STEPS.DETAILS && (
                <Button
                  onClick={handleProceedToAddress}
                  disabled={!dealName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  Continue to Location &rarr;
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
                <div className="text-6xl mb-4">&#128506;&#65039;</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Map Preview
                </h3>
                <p className="text-gray-600">
                  The map will show your property location once you enter an address in Step 6.
                </p>
              </div>
            </div>
          )}

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
