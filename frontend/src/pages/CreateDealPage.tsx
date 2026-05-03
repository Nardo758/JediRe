import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useTradeAreaStore } from '../stores/tradeAreaStore';
import { useTheme } from '../contexts/ThemeContext';
import { GooglePlacesInput } from '../components/shared/GooglePlacesInput';
import { TradeAreaDefinitionPanel } from '../components/trade-area';
import { apiClient } from '../services/api.client';
import { DealType } from '../shared/config/deal-type-visibility';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

// ─── Theme Tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg: {
    page: '#0A0E17',
    panel: '#0F1319',
    panelAlt: '#131821',
    header: '#1A1F2E',
    input: '#0D1117',
    hover: '#1E2538',
    card: '#0F1319',
    cardHover: '#1A1F2E',
  },
  text: {
    primary: '#E8ECF1',
    secondary: '#8B95A5',
    muted: '#4A5568',
    accent: '#F5A623',
    accentHover: '#FFD166',
    success: '#00D26A',
    error: '#FF4757',
    link: '#00BCD4',
  },
  border: {
    subtle: '#1E2538',
    medium: '#2A3348',
    bright: '#3B4A6B',
    focus: '#F5A623',
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  },
};

const LIGHT = {
  bg: {
    page: '#F8FAFC',
    panel: '#FFFFFF',
    panelAlt: '#F1F5F9',
    header: '#FFFFFF',
    input: '#FFFFFF',
    hover: '#F1F5F9',
    card: '#FFFFFF',
    cardHover: '#F8FAFC',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    accent: '#D97706',
    accentHover: '#B45309',
    success: '#059669',
    error: '#DC2626',
    link: '#0284C7',
  },
  border: {
    subtle: '#E2E8F0',
    medium: '#CBD5E1',
    bright: '#94A3B8',
    focus: '#D97706',
  },
  font: {
    mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  },
};

type DealCategory = 'portfolio' | 'pipeline';

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
  PROJECT_TYPE: 2,
  CATEGORY: 3,
  PROPERTY_TYPE: 4,
  DOCUMENTS: 5,
  TRADE_AREA: 6,
} as const;

export const CreateDealPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const T = theme === 'dark' ? DARK : LIGHT;
  const isDark = theme === 'dark';
  
  const { createDeal, isLoading } = useDealStore();

  const locationState = location.state as { dealCategory?: DealCategory } | null;
  const [currentStep, setCurrentStep] = useState<number>(STEPS.DETAILS_ADDRESS);
  const [dealCategory, setDealCategory] = useState<DealCategory | null>(locationState?.dealCategory || null);
  const [projectType, setProjectType] = useState<DealType | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [availablePropertyTypes, setAvailablePropertyTypes] = useState<PropertyType[]>([]);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [dealName, setDealName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const DRAFT_DOCS_KEY = 'jedire_create_deal_draft_docs';
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_DOCS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isUploading, setIsUploading] = useState(false);

  const [purchasePrice, setPurchasePrice] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [units, setUnits] = useState('');
  const [occupancy, setOccupancy] = useState('');
  const [rentPerSf, setRentPerSf] = useState('');
  const [capRate, setCapRate] = useState('');
  const [renovationBudget, setRenovationBudget] = useState('');

  const [tradeAreaId, setTradeAreaId] = useState<string | null>(null);
  const [submarketId, setSubmarketId] = useState<number | null>(null);
  const [msaId, setMsaId] = useState<number | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const drawHandlerRef = useRef<(() => void) | null>(null);

  const cleanupDraw = useCallback(() => {
    if (!map.current || !drawRef.current) return;
    try {
      if (drawHandlerRef.current) {
        map.current.off('draw.create', drawHandlerRef.current);
        map.current.off('draw.update', drawHandlerRef.current);
        drawHandlerRef.current = null;
      }
      map.current.removeControl(drawRef.current as any);
    } catch (e) {}
    drawRef.current = null;
  }, []);

  const handleCustomDraw = useCallback(() => {
    if (!map.current) return;
    if (drawRef.current) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'draw_polygon',
    });

    map.current.addControl(draw as any, 'top-left');
    drawRef.current = draw;

    const onDraw = () => {
      if (!drawRef.current) return;
      const data = drawRef.current.getAll();
      if (data.features.length > 1) {
        const keep = data.features[data.features.length - 1];
        const toDelete = data.features.slice(0, -1).map(f => f.id as string);
        toDelete.forEach(id => drawRef.current!.delete(id));
        if (keep.geometry.type === 'Polygon') {
          useTradeAreaStore.getState().updateDraftGeometry(keep.geometry as any);
        }
      } else if (data.features.length === 1 && data.features[0].geometry.type === 'Polygon') {
        useTradeAreaStore.getState().updateDraftGeometry(data.features[0].geometry as any);
      }
    };
    const onDelete = () => {
      useTradeAreaStore.getState().clearDraft();
    };
    drawHandlerRef.current = onDraw;

    map.current.on('draw.create', onDraw);
    map.current.on('draw.update', onDraw);
    map.current.on('draw.delete', onDelete);
  }, []);

  const handleCustomDrawCancel = useCallback(() => {
    cleanupDraw();
  }, [cleanupDraw]);

  useEffect(() => {
    const fetchPropertyTypes = async () => {
      try {
        const response = await apiClient.get('/api/v1/property-types') as any;
        const body = response?.data || response;
        const types = body?.data || body || [];
        if (Array.isArray(types) && types.length > 0) {
          setAvailablePropertyTypes(types);
        }
      } catch (err) {
        console.error('Error fetching property types:', err);
        const fallbackTypes = [
          { id: 1, type_key: 'multifamily', display_name: 'Multifamily', category: 'Multifamily', description: 'Multi-unit residential building', icon: '🏢' },
        ];
        setAvailablePropertyTypes(fallbackTypes);
      }
    };
    fetchPropertyTypes();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch (err) {
      console.error('Map initialization error:', err);
    }

    return () => {
      cleanupDraw();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  // Task #425: useEffect intentionally omits `cleanupDraw` and `isDark` — the
  // omitted value(s) are either (a) stable references from context/store
  // hooks whose identity is guaranteed by the producer, (b) values captured
  // at first-fire on purpose to prevent re-fetch loops, or (c) inline
  // closures over already-tracked state. Adding them would change observable
  // behavior (extra fetches / lost user input / loops). See task #425 triage
  // notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12');
    }
  }, [isDark]);

  useEffect(() => {
    if (!map.current || !coordinates) return;

    if (marker.current) {
      marker.current.remove();
    }
    marker.current = new mapboxgl.Marker({ color: T.text.accent })
      .setLngLat(coordinates)
      .addTo(map.current);

    map.current.flyTo({
      center: coordinates,
      zoom: 16,
      duration: 1500,
    });
  }, [coordinates, T.text.accent]);

  const handleSelectProjectType = (type: DealType) => {
    setProjectType(type);
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
          headers: { 'Content-Type': 'multipart/form-data' },
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

      const merged = [...uploadedDocuments, ...uploadedFiles];
      setUploadedDocuments(merged);
      localStorage.setItem(DRAFT_DOCS_KEY, JSON.stringify(merged));
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

  const handleTradeAreaSave = (id: string) => {
    setTradeAreaId(id);
    handleSubmit(id);
  };

  const handleSkipTradeArea = () => {
    setTradeAreaId(null);
    handleSubmit(null);
  };

  const handleSubmit = async (tradeAreaIdOverride?: string | null) => {
    if (!dealName.trim()) {
      setError('Please enter a deal name');
      return;
    }

    if (!address.trim() || !coordinates) {
      setError('Please enter a property address');
      return;
    }

    try {
      const boundary = {
        type: 'Point',
        coordinates: coordinates,
      };

      const dealPayload: any = {
        name: dealName,
        description,
        deal_category: dealCategory!,
        development_type: projectType === 'development' ? 'new' : 'existing',
        property_type_id: propertyType?.id,
        property_type_key: propertyType?.type_key,
        project_type: projectType,
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

      const effectiveTradeAreaId = tradeAreaIdOverride !== undefined ? tradeAreaIdOverride : tradeAreaId;
      if (result && (submarketId || msaId || effectiveTradeAreaId)) {
        try {
          await apiClient.post(`/api/v1/deals/${result.id}/geographic-context`, {
            trade_area_id: effectiveTradeAreaId,
            submarket_id: submarketId,
            msa_id: msaId,
            active_scope: effectiveTradeAreaId ? 'trade_area' : 'submarket',
          });
        } catch (contextErr) {
          console.error('Failed to link geographic context:', contextErr);
        }
      }

      localStorage.removeItem(DRAFT_DOCS_KEY);

      if (result?.id) {
        navigate(`/deals/${result.id}/detail`);
      } else {
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
      case STEPS.PROJECT_TYPE:
        setCurrentStep(STEPS.DETAILS_ADDRESS);
        setProjectType(null);
        break;
      case STEPS.CATEGORY:
        setCurrentStep(STEPS.PROJECT_TYPE);
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
    setCurrentStep(STEPS.PROJECT_TYPE);
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const styles = {
    page: {
      position: 'fixed' as const,
      inset: 0,
      background: T.bg.page,
      display: 'flex',
      flexDirection: 'column' as const,
    },
    header: {
      height: 48,
      borderBottom: `1px solid ${T.border.subtle}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      background: T.bg.header,
      flexShrink: 0,
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: T.text.secondary,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: T.font.mono,
      fontSize: 11,
      fontWeight: 500,
      transition: 'color 0.15s',
    },
    main: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
    },
    sidebar: {
      width: '40%',
      overflowY: 'auto' as const,
      background: T.bg.panelAlt,
      borderRight: `1px solid ${T.border.subtle}`,
    },
    sidebarContent: {
      maxWidth: 560,
      margin: '0 auto',
      padding: 32,
    },
    title: {
      fontSize: 24,
      fontWeight: 700,
      color: T.text.primary,
      marginBottom: 8,
      fontFamily: T.font.mono,
    },
    subtitle: {
      fontSize: 12,
      color: T.text.secondary,
      fontFamily: T.font.mono,
    },
    progressBar: {
      display: 'flex',
      gap: 6,
      marginTop: 24,
      marginBottom: 32,
    },
    progressStep: (active: boolean) => ({
      flex: 1,
      height: 3,
      background: active ? T.text.accent : T.border.subtle,
      transition: 'background 0.2s',
    }),
    sectionTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: T.text.primary,
      marginBottom: 20,
      fontFamily: T.font.mono,
    },
    label: {
      display: 'block',
      fontSize: 10,
      fontWeight: 600,
      color: T.text.secondary,
      marginBottom: 8,
      fontFamily: T.font.mono,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      background: T.bg.input,
      border: `1px solid ${T.border.subtle}`,
      color: T.text.primary,
      fontSize: 13,
      fontFamily: T.font.mono,
      outline: 'none',
      transition: 'border-color 0.15s',
    },
    textarea: {
      width: '100%',
      padding: '12px 14px',
      background: T.bg.input,
      border: `1px solid ${T.border.subtle}`,
      color: T.text.primary,
      fontSize: 13,
      fontFamily: T.font.mono,
      outline: 'none',
      resize: 'vertical' as const,
      minHeight: 80,
    },
    button: {
      padding: '10px 20px',
      background: T.text.accent,
      color: isDark ? '#0A0E17' : '#FFFFFF',
      border: 'none',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: T.font.mono,
      cursor: 'pointer',
      letterSpacing: 0.5,
      transition: 'background 0.15s',
    },
    buttonSecondary: {
      padding: '10px 20px',
      background: 'transparent',
      color: T.text.secondary,
      border: `1px solid ${T.border.subtle}`,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: T.font.mono,
      cursor: 'pointer',
      transition: 'all 0.15s',
    },
    card: {
      padding: 20,
      background: T.bg.card,
      border: `1px solid ${T.border.subtle}`,
      cursor: 'pointer',
      transition: 'all 0.15s',
      marginBottom: 12,
    },
    cardHover: {
      borderColor: T.text.accent,
      background: T.bg.cardHover,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: T.text.primary,
      marginBottom: 6,
      fontFamily: T.font.mono,
    },
    cardDescription: {
      fontSize: 12,
      color: T.text.secondary,
      lineHeight: 1.5,
    },
    cardIcon: {
      fontSize: 28,
      marginBottom: 12,
    },
    error: {
      marginTop: 20,
      padding: 14,
      background: isDark ? '#FF475715' : '#FEE2E2',
      border: `1px solid ${T.text.error}33`,
      color: T.text.error,
      fontSize: 12,
      fontFamily: T.font.mono,
    },
    mapContainer: {
      width: '60%',
      position: 'relative' as const,
      background: T.bg.panel,
    },
    mapOverlay: {
      position: 'absolute' as const,
      inset: 0,
      background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none' as const,
    },
    mapPlaceholder: {
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      padding: 32,
      textAlign: 'center' as const,
      maxWidth: 320,
    },
  };

  const TypeCard = ({ icon, title, description, onClick, color }: { icon: string; title: string; description: string; onClick: () => void; color: string }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.card,
          ...(hovered ? { borderColor: color, background: T.bg.cardHover } : {}),
        }}
      >
        <div style={styles.cardIcon}>{icon}</div>
        <div style={{ ...styles.cardTitle, color: hovered ? color : T.text.primary }}>{title}</div>
        <div style={styles.cardDescription}>{description}</div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.text.primary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.text.secondary)}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>BACK TO DASHBOARD</span>
        </button>
      </div>

      <div style={styles.main}>
        {/* Sidebar Form */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarContent}>
            <h1 style={styles.title}>CREATE NEW DEAL</h1>
            <p style={styles.subtitle}>
              STEP {currentStep} OF 6 • {
                currentStep === STEPS.DETAILS_ADDRESS ? 'DEAL INFO & ADDRESS' :
                currentStep === STEPS.PROJECT_TYPE ? 'DEAL TYPE' :
                currentStep === STEPS.CATEGORY ? 'DEAL CATEGORY' :
                currentStep === STEPS.PROPERTY_TYPE ? 'PROPERTY TYPE' :
                currentStep === STEPS.DOCUMENTS ? 'DOCUMENTS & DATA' :
                'TRADE AREA'
              }
            </p>

            {/* Progress Bar */}
            <div style={styles.progressBar}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} style={styles.progressStep(idx + 1 <= currentStep)} />
              ))}
            </div>

            {/* Step 1: Details & Address */}
            {currentStep === STEPS.DETAILS_ADDRESS && (
              <div>
                <h2 style={styles.sectionTitle}>Deal Info & Address</h2>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={styles.label}>
                    DEAL NAME <span style={{ color: T.text.error }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={dealName}
                    onChange={(e) => setDealName(e.target.value)}
                    placeholder="e.g., Midtown Crossing Apartments"
                    style={styles.input}
                    onFocus={(e) => (e.target.style.borderColor = T.border.focus)}
                    onBlur={(e) => (e.target.style.borderColor = T.border.subtle)}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={styles.label}>DESCRIPTION (OPTIONAL)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the deal..."
                    style={styles.textarea}
                    onFocus={(e) => (e.target.style.borderColor = T.border.focus)}
                    onBlur={(e) => (e.target.style.borderColor = T.border.subtle)}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={styles.label}>
                    PROPERTY ADDRESS <span style={{ color: T.text.error }}>*</span>
                  </label>
                  <GooglePlacesInput
                    value={address}
                    onChange={handleAddressSelected}
                    placeholder="Start typing an address..."
                  />
                  <p style={{ marginTop: 8, fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
                    Start typing and select from the dropdown
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
                  <button
                    onClick={handleProceedToType}
                    disabled={!dealName.trim() || !address.trim()}
                    style={{
                      ...styles.button,
                      opacity: (!dealName.trim() || !address.trim()) ? 0.5 : 1,
                      cursor: (!dealName.trim() || !address.trim()) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    CONTINUE →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Project Type */}
            {currentStep === STEPS.PROJECT_TYPE && (
              <div>
                <h2 style={styles.sectionTitle}>What type of deal is this?</h2>
                
                <TypeCard
                  icon="🏢"
                  title="Existing Acquisition"
                  description="Buying an operating property (stabilized or value-add)."
                  onClick={() => handleSelectProjectType('existing')}
                  color={T.text.link}
                />
                <TypeCard
                  icon="🏗️"
                  title="Development"
                  description="Ground-up new construction on vacant or cleared land."
                  onClick={() => handleSelectProjectType('development')}
                  color={T.text.success}
                />
                <TypeCard
                  icon="🔄"
                  title="Redevelopment"
                  description="Tear-down, gut-rehab, or major repositioning of existing structure."
                  onClick={() => handleSelectProjectType('redevelopment')}
                  color={T.text.accent}
                />
              </div>
            )}

            {/* Step 3: Category */}
            {currentStep === STEPS.CATEGORY && (
              <div>
                <h2 style={styles.sectionTitle}>Deal Category</h2>
                
                <TypeCard
                  icon="📁"
                  title="Portfolio"
                  description="Properties you own or manage. Track performance, documents, and operations."
                  onClick={() => handleSelectCategory('portfolio')}
                  color={T.text.link}
                />
                <TypeCard
                  icon="📈"
                  title="Pipeline"
                  description="Deals you're prospecting. Track opportunities, analysis, and due diligence."
                  onClick={() => handleSelectCategory('pipeline')}
                  color={T.text.success}
                />
              </div>
            )}

            {/* Step 4: Property Type */}
            {currentStep === STEPS.PROPERTY_TYPE && (
              <div>
                <h2 style={styles.sectionTitle}>Property Type</h2>
                
                <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                  {Object.entries(
                    availablePropertyTypes.reduce((acc, type) => {
                      if (!acc[type.category]) acc[type.category] = [];
                      acc[type.category].push(type);
                      return acc;
                    }, {} as Record<string, PropertyType[]>)
                  ).map(([category, types]) => (
                    <div key={category} style={{ marginBottom: 24 }}>
                      <div style={{ 
                        fontSize: 10, 
                        fontWeight: 700, 
                        color: T.text.muted, 
                        marginBottom: 12,
                        fontFamily: T.font.mono,
                        letterSpacing: 1,
                      }}>
                        {category.toUpperCase()}
                      </div>
                      {types.map((type) => (
                        <TypeCard
                          key={type.id}
                          icon={type.icon || '🏠'}
                          title={type.display_name}
                          description={type.description}
                          onClick={() => handleSelectPropertyType(type)}
                          color={T.text.accent}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === STEPS.DOCUMENTS && propertyType && (
              <div>
                <h2 style={styles.sectionTitle}>
                  Documents & Data <span style={{ fontWeight: 400, color: T.text.muted }}>(Optional)</span>
                </h2>
                
                <div style={{ 
                  marginBottom: 20, 
                  padding: 12, 
                  background: isDark ? `${T.text.link}15` : '#EFF6FF',
                  border: `1px solid ${T.text.link}33`,
                }}>
                  <span style={{ fontSize: 11, color: T.text.link, fontFamily: T.font.mono }}>
                    <strong>Property Type:</strong> {propertyType.display_name}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* Document Upload */}
                  <div>
                    <div style={{ ...styles.label, marginBottom: 12 }}>DOCUMENT UPLOAD</div>
                    
                    <div
                      style={{
                        border: `2px dashed ${T.border.medium}`,
                        padding: 24,
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.text.accent)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border.medium)}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                      <p style={{ fontSize: 11, color: T.text.secondary, marginBottom: 4, fontFamily: T.font.mono }}>
                        Drag & drop or click to browse
                      </p>
                      <p style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
                        PDF, Excel, Word, Images
                      </p>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={(e) => { if (e.target.files) handleFileUpload(e.target.files); }}
                      />
                    </div>

                    {uploadedDocuments.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: T.text.secondary, marginBottom: 8, fontFamily: T.font.mono }}>
                          UPLOADED FILES:
                        </div>
                        {uploadedDocuments.map((doc, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: 8,
                              background: isDark ? `${T.text.success}15` : '#ECFDF5',
                              border: `1px solid ${T.text.success}33`,
                              marginBottom: 6,
                              fontSize: 10,
                              fontFamily: T.font.mono,
                            }}
                          >
                            <span style={{ color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
                            <button
                              onClick={() => {
                                const updated = uploadedDocuments.filter((_, i) => i !== idx);
                                setUploadedDocuments(updated);
                                localStorage.setItem(DRAFT_DOCS_KEY, JSON.stringify(updated));
                              }}
                              style={{ background: 'none', border: 'none', color: T.text.error, cursor: 'pointer', fontSize: 12 }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {isUploading && (
                      <div style={{ marginTop: 12, fontSize: 11, color: T.text.link, fontFamily: T.font.mono }}>
                        Uploading...
                      </div>
                    )}
                  </div>

                  {/* Deal Data */}
                  <div>
                    <div style={{ ...styles.label, marginBottom: 12 }}>DEAL DATA</div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ ...styles.label, fontSize: 9 }}>PURCHASE PRICE</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: 12, color: T.text.muted, fontFamily: T.font.mono }}>$</span>
                        <input
                          type="text"
                          value={purchasePrice}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setPurchasePrice(value ? parseFloat(value).toLocaleString() : '');
                          }}
                          placeholder="Enter amount"
                          style={{ ...styles.input, paddingLeft: 28 }}
                          onFocus={(e) => (e.target.style.borderColor = T.border.focus)}
                          onBlur={(e) => (e.target.style.borderColor = T.border.subtle)}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ ...styles.label, fontSize: 9 }}>CALL FOR OFFER DATE</label>
                      <input
                        type="date"
                        value={offerDate}
                        onChange={(e) => setOfferDate(e.target.value)}
                        style={styles.input}
                        onFocus={(e) => (e.target.style.borderColor = T.border.focus)}
                        onBlur={(e) => (e.target.style.borderColor = T.border.subtle)}
                      />
                    </div>

                    <div style={{ borderTop: `1px solid ${T.border.subtle}`, paddingTop: 16, marginTop: 16 }}>
                      <p style={{ fontSize: 9, color: T.text.muted, marginBottom: 12, fontFamily: T.font.mono }}>
                        ADDITIONAL DATA (ALL OPTIONAL)
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ ...styles.label, fontSize: 9 }}>UNITS</label>
                          <input type="number" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="150" style={styles.input} />
                        </div>
                        <div>
                          <label style={{ ...styles.label, fontSize: 9 }}>OCCUPANCY %</label>
                          <input type="number" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} placeholder="92" style={styles.input} />
                        </div>
                        <div>
                          <label style={{ ...styles.label, fontSize: 9 }}>RENT/SF</label>
                          <input type="text" value={rentPerSf} onChange={(e) => setRentPerSf(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="1.85" style={styles.input} />
                        </div>
                        <div>
                          <label style={{ ...styles.label, fontSize: 9 }}>CAP RATE %</label>
                          <input type="number" value={capRate} onChange={(e) => setCapRate(e.target.value)} placeholder="5.5" step="0.1" style={styles.input} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                  <button onClick={handleProceedFromDocuments} style={styles.buttonSecondary}>
                    SKIP FOR NOW
                  </button>
                  <button onClick={handleProceedFromDocuments} style={styles.button}>
                    CONTINUE →
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Trade Area */}
            {currentStep === STEPS.TRADE_AREA && coordinates && (
              <div>
                <h2 style={styles.sectionTitle}>
                  Define Trade Area <span style={{ fontWeight: 400, color: T.text.muted }}>(Optional)</span>
                </h2>
                <p style={{ fontSize: 12, color: T.text.secondary, marginBottom: 24, lineHeight: 1.6 }}>
                  Set the competitive radius around your property for market analysis. You can skip this and define it later.
                </p>

                <TradeAreaDefinitionPanel
                  propertyLat={coordinates[1]}
                  propertyLng={coordinates[0]}
                  onSave={handleTradeAreaSave}
                  onSkip={handleSkipTradeArea}
                  onCustomDraw={handleCustomDraw}
                  onCustomDrawCancel={handleCustomDrawCancel}
                />
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}

            {/* Back Button */}
            {currentStep > STEPS.DETAILS_ADDRESS && (
              <div style={{ marginTop: 24 }}>
                <button onClick={handleBack} disabled={isLoading} style={styles.buttonSecondary}>
                  ← BACK
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={styles.mapContainer}>
          <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
          
          {!coordinates && (
            <div style={styles.mapOverlay}>
              <div style={styles.mapPlaceholder}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, marginBottom: 8, fontFamily: T.font.mono }}>
                  MAP PREVIEW
                </h3>
                <p style={{ fontSize: 11, color: T.text.secondary, fontFamily: T.font.mono }}>
                  The map will show your property location once you enter an address.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateDealPage;
