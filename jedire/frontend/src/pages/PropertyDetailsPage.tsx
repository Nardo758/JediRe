/**
 * Property Details Page - Bloomberg Terminal Style
 * Enhanced with Terminal UI Components
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Share2,
  Star,
  ExternalLink,
  Calendar,
  AlertCircle,
} from 'lucide-react';

// Import Terminal UI Components
import {
  TerminalTheme as T,
  Badge,
  SectionHeader,
  DataRow,
  MiniBar,
  MiniSparkline,
  ScoreRing,
  PhotoGallery,
  formatCompact,
  formatPercent,
  formatCurrency,
} from '@/components/ui/terminal';

// Import API Service
import { fetchDealById, mapDealToProperty } from '@/services/api';

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  
  // Basic Info
  propertyType: string;
  yearBuilt?: number;
  units?: number;
  totalSqft?: number;
  lotSize?: number;
  
  // Financial
  askingPrice?: number;
  estimatedValue?: number;
  monthlyRent?: number;
  annualIncome?: number;
  noi?: number;
  capRate?: number;
  occupancyRate?: number;
  
  // Zoning
  zoningCode?: string;
  zoningDescription?: string;
  maxDensity?: number;
  maxHeight?: number;
  
  // Features
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  amenities?: string[];
  
  // Media
  photos?: { url: string; source: 'scraped' | 'google' | 'placeholder' }[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  dataSource?: string;
}

type TabType = 'overview' | 'financial' | 'comparables' | 'zoning' | 'market' | 'documents';

export default function PropertyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPropertyData();
  }, [id]);

  const buildPropertyFromRow = (row: any): PropertyData => {
    const addrParts = (row.address || '').split(',').map((s: string) => s.trim());
    const stateZip = (addrParts[2] || '').split(' ');
    const rentNum = parseFloat((row.rent || '').replace(/[^0-9.]/g, '')) || 0;
    return {
      id: id || row.rawPropertyId || `P-${row.id}`,
      name: row.property || 'Unknown Property',
      address: row.address || '',
      city: addrParts[1] || '',
      state: stateZip[0] || '',
      zip: stateZip[1] || '',
      propertyType: 'Multifamily',
      units: row.units || 0,
      yearBuilt: row.year || 0,
      totalSqft: row.buildingSf || 0,
      lotSize: row.lotAcres || row.acres || 0,
      estimatedValue: row.appraisedValue || 0,
      monthlyRent: rentNum,
      occupancyRate: parseFloat(row.occ) || 0,
      zoningCode: row.zoning || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataSource: row.enrichmentSource || 'Market Intelligence',
    };
  };

  const fetchPropertyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try fetching from JediRe API first
      if (id) {
        const deal = await fetchDealById(id);
        if (deal) {
          const mappedProperty = mapDealToProperty(deal);
          setProperty(mappedProperty);
          return;
        }
      }
      
      // Fallback to local API
      const response = await fetch(`/api/v1/properties/${id}`);
      if (!response.ok) throw new Error('Failed to fetch property');
      
      const data = await response.json();
      setProperty(data);
    } catch (err) {
      const stateRow = (location.state as any)?.propertyRow;
      if (stateRow) {
        setProperty(buildPropertyFromRow(stateRow));
        setError(null);
      } else {
        console.error('Error fetching property:', err);
        setError(err instanceof Error ? err.message : 'Failed to load property');
      }
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: '▣' },
    { id: 'financial', label: 'FINANCIALS', icon: '▲' },
    { id: 'comparables', label: 'COMPS', icon: '≈' },
    { id: 'zoning', label: 'ZONING', icon: '⬒' },
    { id: 'market', label: 'MARKET', icon: '↗' },
    { id: 'documents', label: 'DOCS', icon: '◫' },
  ];

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: T.bg.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            border: `3px solid ${T.text.blue}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: T.text.secondary, fontFamily: T.font.mono }}>
            LOADING PROPERTY DATA...
          </p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: T.bg.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}>
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.text.red}`,
          borderRadius: 4,
          padding: 32,
          textAlign: 'center',
          maxWidth: 480
        }}>
          <AlertCircle style={{ 
            width: 48, 
            height: 48, 
            color: T.text.red, 
            margin: '0 auto 16px' 
          }} />
          <h2 style={{ 
            fontFamily: T.font.mono,
            fontSize: 18,
            fontWeight: 600,
            color: T.text.primary,
            marginBottom: 8
          }}>
            PROPERTY NOT FOUND
          </h2>
          <p style={{ 
            color: T.text.secondary, 
            marginBottom: 24,
            fontFamily: T.font.mono,
            fontSize: 13
          }}>
            {error || 'Unable to load property details'}
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              background: T.text.blue,
              color: T.bg.primary,
              border: 'none',
              borderRadius: 4,
              fontFamily: T.font.mono,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ← GO BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg.primary }}>
      {/* Terminal Header */}
      <div style={{ 
        background: T.bg.panel,
        borderBottom: `1px solid ${T.border.subtle}`,
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ 
          maxWidth: 1400, 
          margin: '0 auto', 
          padding: '0 20px'
        }}>
          {/* Top Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: `1px solid ${T.border.subtle}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: `1px solid ${T.border.default}`,
                  color: T.text.secondary,
                  padding: '6px 12px',
                  borderRadius: 2,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: 0.5
                }}
              >
                <ArrowLeft size={14} />
                BACK
              </button>
              
              <div style={{ 
                height: 24, 
                width: 1, 
                background: T.border.subtle 
              }} />
              
              <div>
                <h1 style={{
                  fontFamily: T.font.mono,
                  fontSize: 16,
                  fontWeight: 600,
                  color: T.text.primary,
                  marginBottom: 4,
                  letterSpacing: 0.5
                }}>
                  {property.name.toUpperCase()}
                </h1>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.text.secondary
                }}>
                  <span>◉</span>
                  <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge color={T.text.green}>LIVE</Badge>
              <button style={{ 
                padding: 8, 
                background: 'transparent',
                border: `1px solid ${T.border.default}`,
                borderRadius: 2,
                color: T.text.secondary,
                cursor: 'pointer'
              }}>
                <Star size={16} />
              </button>
              <button style={{ 
                padding: 8, 
                background: 'transparent',
                border: `1px solid ${T.border.default}`,
                borderRadius: 2,
                color: T.text.secondary,
                cursor: 'pointer'
              }}>
                <Share2 size={16} />
              </button>
              <button style={{ 
                padding: 8, 
                background: 'transparent',
                border: `1px solid ${T.border.default}`,
                borderRadius: 2,
                color: T.text.secondary,
                cursor: 'pointer'
              }}>
                <Download size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            overflowX: 'auto'
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    background: isActive ? T.bg.hover : 'transparent',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${T.text.blue}` : '2px solid transparent',
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    color: isActive ? T.text.blue : T.text.secondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        maxWidth: 1400, 
        margin: '0 auto', 
        padding: '24px 20px'
      }}>
        {activeTab === 'overview' && <OverviewTab property={property} />}
        {activeTab === 'financial' && <FinancialTab property={property} />}
        {activeTab === 'comparables' && <ComparablesTab property={property} />}
        {activeTab === 'zoning' && <ZoningTab property={property} />}
        {activeTab === 'market' && <MarketTab property={property} />}
        {activeTab === 'documents' && <DocumentsTab property={property} />}
      </div>
    </div>
  );
}

// ============================================================================
// TAB: OVERVIEW
// ============================================================================

function OverviewTab({ property }: { property: PropertyData }) {
  // Mock sparkline data for trends
  const rentTrend = [2100, 2150, 2200, 2180, 2250, 2300, 2350, 2400, 2420, 2450];
  const occTrend = [92, 93, 94, 93, 95, 94, 96, 95, 97, 96];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Photo Gallery */}
      {property.photos && property.photos.length > 0 && (
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="PROPERTY IMAGES"
            icon="◫"
          />
          <div style={{ padding: 16 }}>
            <PhotoGallery 
              photos={property.photos.map(p => ({ 
                url: p.url, 
                caption: p.source.toUpperCase() 
              }))}
            />
          </div>
        </div>
      )}

      {/* Key Metrics Dashboard */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        {/* Price */}
        {property.askingPrice && (
          <div style={{ 
            background: T.bg.panel,
            border: `1px solid ${T.border.default}`,
            borderRadius: 4,
            padding: 16
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginBottom: 8,
              letterSpacing: 1
            }}>
              ASKING PRICE
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 24,
              fontWeight: 700,
              color: T.text.blue,
              marginBottom: 4
            }}>
              {formatCurrency(property.askingPrice)}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary
            }}>
              ${(property.askingPrice / (property.units || 1)).toFixed(0)}/UNIT
            </div>
          </div>
        )}

        {/* Units */}
        {property.units && (
          <div style={{ 
            background: T.bg.panel,
            border: `1px solid ${T.border.default}`,
            borderRadius: 4,
            padding: 16
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginBottom: 8,
              letterSpacing: 1
            }}>
              TOTAL UNITS
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 24,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {property.units}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary
            }}>
              {property.propertyType.toUpperCase()}
            </div>
          </div>
        )}

        {/* Cap Rate */}
        {property.capRate && (
          <div style={{ 
            background: T.bg.panel,
            border: `1px solid ${T.border.default}`,
            borderRadius: 4,
            padding: 16
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginBottom: 8,
              letterSpacing: 1
            }}>
              CAP RATE
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 24,
                fontWeight: 700,
                color: T.text.green
              }}>
                {formatPercent(property.capRate)}
              </div>
              <ScoreRing score={property.capRate * 10} size={40} />
            </div>
          </div>
        )}

        {/* Occupancy */}
        {property.occupancyRate && (
          <div style={{ 
            background: T.bg.panel,
            border: `1px solid ${T.border.default}`,
            borderRadius: 4,
            padding: 16
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginBottom: 8,
              letterSpacing: 1
            }}>
              OCCUPANCY
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 24,
              fontWeight: 700,
              color: T.text.green,
              marginBottom: 8
            }}>
              {formatPercent(property.occupancyRate)}
            </div>
            <MiniBar 
              value={property.occupancyRate} 
              max={100}
              color={T.text.green}
            />
          </div>
        )}
      </div>

      {/* Property Details Grid */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16
      }}>
        {/* Property Information */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="PROPERTY INFO"
            icon="▣"
          />
          <div style={{ padding: '12px 16px' }}>
            <DataRow label="TYPE" value={property.propertyType.toUpperCase()} />
            <DataRow label="YEAR BUILT" value={property.yearBuilt?.toString()} />
            <DataRow label="TOTAL UNITS" value={property.units?.toString()} />
            <DataRow 
              label="BUILDING SF" 
              value={property.totalSqft ? formatCompact(property.totalSqft) : undefined}
            />
            <DataRow 
              label="LOT SIZE" 
              value={property.lotSize ? `${formatCompact(property.lotSize)} SF` : undefined}
            />
            <DataRow label="BEDROOMS" value={property.bedrooms?.toString()} />
            <DataRow label="BATHROOMS" value={property.bathrooms?.toString()} />
            <DataRow label="PARKING" value={property.parking?.toString()} />
          </div>
        </div>

        {/* Financial Summary */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="FINANCIALS"
            icon="▲"
            action={<Badge color={T.text.blue}>ESTIMATED</Badge>}
          />
          <div style={{ padding: '12px 16px' }}>
            <DataRow 
              label="ASKING PRICE" 
              value={property.askingPrice ? formatCurrency(property.askingPrice) : undefined}
              highlight
            />
            <DataRow 
              label="EST. VALUE" 
              value={property.estimatedValue ? formatCurrency(property.estimatedValue) : undefined}
            />
            <DataRow 
              label="MONTHLY RENT" 
              value={property.monthlyRent ? formatCurrency(property.monthlyRent) : undefined}
            />
            <DataRow 
              label="ANNUAL INCOME" 
              value={property.annualIncome ? formatCurrency(property.annualIncome) : undefined}
            />
            <DataRow 
              label="NOI" 
              value={property.noi ? formatCurrency(property.noi) : undefined}
              highlight
            />
            <DataRow 
              label="CAP RATE" 
              value={property.capRate ? formatPercent(property.capRate) : undefined}
            />
            <DataRow 
              label="OCCUPANCY" 
              value={property.occupancyRate ? formatPercent(property.occupancyRate) : undefined}
            />
          </div>
        </div>

        {/* Market Performance */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="PERFORMANCE"
            icon="↗"
            action={<Badge color={T.text.green}>+3.2% YTD</Badge>}
          />
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 10,
                color: T.text.secondary,
                marginBottom: 8,
                letterSpacing: 0.5
              }}>
                RENT TREND (12MO)
              </div>
              <MiniSparkline 
                data={rentTrend}
                color={T.text.green}
                height={40}
              />
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 11,
                color: T.text.green,
                marginTop: 4
              }}>
                ↑ ${rentTrend[rentTrend.length - 1]} AVG
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 10,
                color: T.text.secondary,
                marginBottom: 8,
                letterSpacing: 0.5
              }}>
                OCCUPANCY TREND (12MO)
              </div>
              <MiniSparkline 
                data={occTrend}
                color={T.text.blue}
                height={40}
              />
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 11,
                color: T.text.blue,
                marginTop: 4
              }}>
                {occTrend[occTrend.length - 1]}% CURRENT
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amenities */}
      {property.amenities && property.amenities.length > 0 && (
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="AMENITIES"
            icon="⚡"
          />
          <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {property.amenities.map((amenity, idx) => (
              <Badge key={idx} color={T.text.secondary}>
                {amenity.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality Indicator */}
      {property.dataQuality && (
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 12
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            DATA QUALITY BREAKDOWN
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Badge color={T.text.green}>
                {property.dataQuality.real?.length || 0} REAL
              </Badge>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginTop: 4
              }}>
                From API
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Badge color={T.text.blue}>
                {property.dataQuality.calculated?.length || 0} CALCULATED
              </Badge>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginTop: 4
              }}>
                Market-based
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Badge color={T.text.orange}>
                {property.dataQuality.estimated?.length || 0} ESTIMATED
              </Badge>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginTop: 4
              }}>
                Industry avg
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Source */}
      <div style={{
        fontFamily: T.font.mono,
        fontSize: 10,
        color: T.text.dim,
        textAlign: 'right',
        padding: '8px 0'
      }}>
        DATA SOURCE: {property.dataSource?.toUpperCase() || 'MARKET INTELLIGENCE'} | 
        UPDATED: {new Date(property.updatedAt).toLocaleString().toUpperCase()}
      </div>
    </div>
  );
}

// ============================================================================
// TAB: FINANCIAL
// ============================================================================

function FinancialTab({ property }: { property: PropertyData }) {
  // Mock rent roll data
  const rentRoll = [
    { unit: '101', bedrooms: 2, bathrooms: 2, sqft: 1200, rent: 2400, status: 'Occupied', leaseEnd: '2026-12-31' },
    { unit: '102', bedrooms: 2, bathrooms: 2, sqft: 1200, rent: 2400, status: 'Occupied', leaseEnd: '2026-08-15' },
    { unit: '103', bedrooms: 1, bathrooms: 1, sqft: 850, rent: 1900, status: 'Occupied', leaseEnd: '2026-10-20' },
    { unit: '201', bedrooms: 1, bathrooms: 1, sqft: 800, rent: 1800, status: 'Vacant', leaseEnd: '-' },
    { unit: '202', bedrooms: 1, bathrooms: 1, sqft: 800, rent: 1800, status: 'Occupied', leaseEnd: '2026-11-30' },
    { unit: '203', bedrooms: 2, bathrooms: 2, sqft: 1150, rent: 2300, status: 'Occupied', leaseEnd: '2027-01-15' },
  ];

  const income = [
    { category: 'Gross Rental Income', monthly: 48000, annual: 576000 },
    { category: 'Parking Revenue', monthly: 1500, annual: 18000 },
    { category: 'Other Income', monthly: 500, annual: 6000 },
  ];

  const expenses = [
    { category: 'Property Management', monthly: 4200, annual: 50400 },
    { category: 'Repairs & Maintenance', monthly: 3000, annual: 36000 },
    { category: 'Property Taxes', monthly: 5000, annual: 60000 },
    { category: 'Insurance', monthly: 1500, annual: 18000 },
    { category: 'Utilities', monthly: 2000, annual: 24000 },
    { category: 'Marketing & Leasing', monthly: 800, annual: 9600 },
  ];

  const totalIncome = income.reduce((sum, item) => sum + item.annual, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.annual, 0);
  const noi = totalIncome - totalExpenses;
  const occupiedUnits = rentRoll.filter(u => u.status === 'Occupied').length;
  const occupancyRate = (occupiedUnits / rentRoll.length) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* NOI Dashboard */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            GROSS INCOME
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.green,
            marginBottom: 4
          }}>
            {formatCurrency(totalIncome)}
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary
          }}>
            {formatCurrency(totalIncome / 12)}/MO
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            TOTAL EXPENSES
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.orange,
            marginBottom: 4
          }}>
            {formatCurrency(totalExpenses)}
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary
          }}>
            {formatCurrency(totalExpenses / 12)}/MO
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            NET OPERATING INCOME
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.blue,
            marginBottom: 4
          }}>
            {formatCurrency(noi)}
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary
          }}>
            {formatCurrency(noi / 12)}/MO
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            EXPENSE RATIO
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 24,
              fontWeight: 700,
              color: T.text.primary
            }}>
              {formatPercent((totalExpenses / totalIncome) * 100)}
            </div>
            <ScoreRing score={100 - ((totalExpenses / totalIncome) * 100)} size={40} />
          </div>
        </div>
      </div>

      {/* Rent Roll */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="RENT ROLL"
          icon="◫"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge color={T.text.green}>{occupiedUnits} OCCUPIED</Badge>
              <Badge color={T.text.orange}>{rentRoll.length - occupiedUnits} VACANT</Badge>
            </div>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            fontFamily: T.font.mono,
            fontSize: 11
          }}>
            <thead style={{ 
              background: T.bg.hover,
              borderBottom: `1px solid ${T.border.default}`
            }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>UNIT</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>BD/BA</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>SQ FT</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>RENT</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>STATUS</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: T.text.secondary, fontWeight: 600 }}>LEASE END</th>
              </tr>
            </thead>
            <tbody>
              {rentRoll.map((unit, idx) => (
                <tr key={unit.unit} style={{ 
                  borderBottom: `1px solid ${T.border.subtle}`,
                  background: idx % 2 === 0 ? 'transparent' : T.bg.hover
                }}>
                  <td style={{ padding: '12px 16px', color: T.text.primary, fontWeight: 600 }}>{unit.unit}</td>
                  <td style={{ padding: '12px 16px', color: T.text.secondary }}>{unit.bedrooms}bd / {unit.bathrooms}ba</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: T.text.secondary }}>
                    {unit.sqft.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: T.text.primary, fontWeight: 600 }}>
                    {formatCurrency(unit.rent)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge color={unit.status === 'Occupied' ? T.text.green : T.text.orange}>
                      {unit.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 16px', color: T.text.secondary }}>{unit.leaseEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Income & Expenses */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: 16
      }}>
        {/* Income Breakdown */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="INCOME"
            icon="▲"
            action={<Badge color={T.text.green}>{formatCurrency(totalIncome)}</Badge>}
          />
          <div style={{ padding: '12px 16px' }}>
            {income.map((item, idx) => (
              <div key={idx}>
                <DataRow 
                  label={item.category.toUpperCase()}
                  value={formatCurrency(item.annual)}
                />
                <div style={{
                  fontFamily: T.font.mono,
                  fontSize: 9,
                  color: T.text.dim,
                  textAlign: 'right',
                  marginTop: -8,
                  marginBottom: 8
                }}>
                  {formatCurrency(item.monthly)}/MO
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="EXPENSES"
            icon="▼"
            action={<Badge color={T.text.orange}>{formatCurrency(totalExpenses)}</Badge>}
          />
          <div style={{ padding: '12px 16px' }}>
            {expenses.map((item, idx) => (
              <div key={idx}>
                <DataRow 
                  label={item.category.toUpperCase()}
                  value={formatCurrency(item.annual)}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: -8,
                  marginBottom: 8
                }}>
                  <MiniBar 
                    value={(item.annual / totalExpenses) * 100}
                    max={100}
                    color={T.text.orange}
                    width={120}
                  />
                  <span style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim
                  }}>
                    {formatCurrency(item.monthly)}/MO
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparablesTab({ property }: { property: PropertyData }) {
  // Mock comparable properties
  const comps = [
    {
      id: '1',
      name: 'Riverside Apartments',
      address: '456 River Rd',
      distance: 0.3,
      units: 48,
      price: 8500000,
      pricePerUnit: 177083,
      capRate: 5.2,
      yearBuilt: 2018,
      occupancy: 95,
    },
    {
      id: '2',
      name: 'Park Place Residences',
      address: '789 Park Ave',
      distance: 0.5,
      units: 52,
      price: 9200000,
      pricePerUnit: 176923,
      capRate: 5.0,
      yearBuilt: 2019,
      occupancy: 97,
    },
    {
      id: '3',
      name: 'Downtown Lofts',
      address: '321 Main St',
      distance: 0.8,
      units: 45,
      price: 7900000,
      pricePerUnit: 175556,
      capRate: 5.3,
      yearBuilt: 2017,
      occupancy: 93,
    },
    {
      id: '4',
      name: 'Metro Heights',
      address: '555 Central Blvd',
      distance: 1.2,
      units: 60,
      price: 10800000,
      pricePerUnit: 180000,
      capRate: 4.9,
      yearBuilt: 2020,
      occupancy: 98,
    },
  ];

  const avgPricePerUnit = comps.reduce((sum, c) => sum + c.pricePerUnit, 0) / comps.length;
  const avgCapRate = comps.reduce((sum, c) => sum + c.capRate, 0) / comps.length;
  const avgOccupancy = comps.reduce((sum, c) => sum + c.occupancy, 0) / comps.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Comp Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            COMPS ANALYZED
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.primary
          }}>
            {comps.length}
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            AVG PRICE/UNIT
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.blue
          }}>
            {formatCurrency(avgPricePerUnit)}
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            AVG CAP RATE
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.green
          }}>
            {formatPercent(avgCapRate)}
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            AVG OCCUPANCY
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.green
          }}>
            {formatPercent(avgOccupancy)}
          </div>
        </div>
      </div>

      {/* Comp List */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="COMPARABLE PROPERTIES"
          icon="≈"
          action={<Badge color={T.text.blue}>WITHIN 1.5MI</Badge>}
        />
        
        <div style={{ padding: 0 }}>
          {comps.map((comp, idx) => (
            <div 
              key={comp.id}
              style={{
                padding: 16,
                borderBottom: idx < comps.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                background: idx % 2 === 0 ? 'transparent' : T.bg.hover
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12
              }}>
                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.text.primary,
                    marginBottom: 4
                  }}>
                    {comp.name.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 10,
                    color: T.text.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>◉</span>
                    <span>{comp.address} • {comp.distance}mi</span>
                  </div>
                </div>
                <Badge color={T.text.blue}>VIEW →</Badge>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12
              }}>
                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    PRICE
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {formatCurrency(comp.price)}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    PRICE/UNIT
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {formatCurrency(comp.pricePerUnit)}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    UNITS
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {comp.units}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    CAP RATE
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text.green
                  }}>
                    {formatPercent(comp.capRate)}
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    OCCUPANCY
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text.green
                    }}>
                      {formatPercent(comp.occupancy)}
                    </div>
                    <MiniBar value={comp.occupancy} max={100} color={T.text.green} width={40} />
                  </div>
                </div>

                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 9,
                    color: T.text.dim,
                    marginBottom: 4,
                    letterSpacing: 0.5
                  }}>
                    YEAR BUILT
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text.primary
                  }}>
                    {comp.yearBuilt}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoningTab({ property }: { property: PropertyData }) {
  // Mock zoning data
  const zoningDetails = {
    code: property.zoningCode || 'R-4',
    description: property.zoningDescription || 'High-Density Residential',
    district: 'Central Business District',
    overlay: 'Historic Preservation District',
    maxDensity: property.maxDensity || 100,
    maxHeight: property.maxHeight || 75,
    maxFAR: 3.5,
    minSetback: 15,
    maxCoverage: 75,
    parkingRatio: 1.5,
  };

  const permitHistory = [
    { date: '2024-01-15', type: 'Building Permit', status: 'Approved', description: 'Roof replacement', cost: 85000 },
    { date: '2023-08-22', type: 'Electrical Permit', status: 'Approved', description: 'Panel upgrade', cost: 12000 },
    { date: '2023-03-10', type: 'Plumbing Permit', status: 'Approved', description: 'Water heater replacement', cost: 8500 },
    { date: '2022-11-05', type: 'Building Permit', status: 'Approved', description: 'HVAC system upgrade', cost: 125000 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Zoning Code Header */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4,
        padding: 20
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginBottom: 8,
              letterSpacing: 1
            }}>
              ZONING CLASSIFICATION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge 
                color={T.text.blue}
                style={{ 
                  fontSize: 18, 
                  padding: '8px 16px',
                  fontWeight: 700
                }}
              >
                {zoningDetails.code}
              </Badge>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 13,
                color: T.text.primary
              }}>
                {zoningDetails.description.toUpperCase()}
              </div>
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 10,
              color: T.text.secondary,
              marginTop: 8
            }}>
              DISTRICT: {zoningDetails.district.toUpperCase()} | OVERLAY: {zoningDetails.overlay.toUpperCase()}
            </div>
          </div>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'transparent',
            border: `1px solid ${T.border.default}`,
            borderRadius: 2,
            color: T.text.blue,
            fontFamily: T.font.mono,
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 0.5
          }}>
            <ExternalLink size={12} />
            ZONING MAP
          </button>
        </div>
      </div>

      {/* Development Standards */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="DEVELOPMENT STANDARDS"
          icon="⬒"
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          padding: 16
        }}>
          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              MAX DENSITY
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.maxDensity}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              UNITS/ACRE
            </div>
          </div>

          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              MAX HEIGHT
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.maxHeight}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              FEET
            </div>
          </div>

          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              MAX FAR
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.maxFAR}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              FLOOR AREA RATIO
            </div>
          </div>

          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              MIN SETBACK
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.minSetback}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              FEET
            </div>
          </div>

          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              MAX COVERAGE
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.maxCoverage}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              PERCENT
            </div>
          </div>

          <div style={{ 
            padding: 16,
            background: T.bg.hover,
            borderRadius: 4,
            border: `1px solid ${T.border.subtle}`
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.dim,
              marginBottom: 8,
              letterSpacing: 0.5
            }}>
              PARKING RATIO
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 28,
              fontWeight: 700,
              color: T.text.primary,
              marginBottom: 4
            }}>
              {zoningDetails.parkingRatio}
            </div>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 9,
              color: T.text.secondary
            }}>
              SPACES/UNIT
            </div>
          </div>
        </div>
      </div>

      {/* Permit History */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="PERMIT HISTORY"
          icon="◫"
          action={<Badge color={T.text.green}>{permitHistory.length} PERMITS</Badge>}
        />
        <div style={{ padding: 0 }}>
          {permitHistory.map((permit, idx) => (
            <div
              key={idx}
              style={{
                padding: 16,
                borderBottom: idx < permitHistory.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                background: idx % 2 === 0 ? 'transparent' : T.bg.hover
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 6
                }}>
                  <Calendar size={14} style={{ color: T.text.dim }} />
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 10,
                    color: T.text.secondary
                  }}>
                    {permit.date}
                  </div>
                  <Badge color={T.text.green}>{permit.status.toUpperCase()}</Badge>
                </div>
                <div style={{
                  fontFamily: T.font.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.text.primary,
                  marginBottom: 4
                }}>
                  {permit.type.toUpperCase()}
                </div>
                <div style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.text.secondary
                }}>
                  {permit.description}
                </div>
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                fontWeight: 600,
                color: T.text.blue,
                textAlign: 'right'
              }}>
                {formatCurrency(permit.cost)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketTab({ property }: { property: PropertyData }) {
  // Mock market data
  const marketMetrics = [
    { label: 'Submarket Avg Rent', value: '$2,250', change: 3.2, period: 'YoY' },
    { label: 'Submarket Occupancy', value: '94.5%', change: 1.8, period: 'YoY' },
    { label: 'Submarket Cap Rate', value: '5.1%', change: -0.2, period: 'YoY' },
    { label: 'Population Growth', value: '2.8%', change: 0.5, period: 'Annual' },
  ];

  const demographics = [
    { label: 'Median Household Income', value: '$78,500', icon: '💰' },
    { label: 'Population (3mi radius)', value: '45,230', icon: '👥' },
    { label: 'Employment Rate', value: '96.2%', icon: '💼' },
    { label: 'Average Age', value: '34.5 years', icon: '📊' },
    { label: 'College Educated', value: '68%', icon: '🎓' },
    { label: 'Renter Occupied', value: '72%', icon: '🏠' },
  ];

  const rentTrend = [2100, 2120, 2150, 2180, 2200, 2220, 2250, 2280, 2300, 2320, 2350, 2380];
  const occupancyTrend = [91, 92, 93, 92, 94, 93, 95, 94, 95, 96, 94, 95];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Market Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16
      }}>
        {marketMetrics.map((metric, idx) => {
          const isPositive = metric.change > 0;
          return (
            <div 
              key={idx}
              style={{ 
                background: T.bg.panel,
                border: `1px solid ${T.border.default}`,
                borderRadius: 4,
                padding: 16
              }}
            >
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 10,
                color: T.text.secondary,
                marginBottom: 8,
                letterSpacing: 1
              }}>
                {metric.label.toUpperCase()}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  fontFamily: T.font.mono,
                  fontSize: 24,
                  fontWeight: 700,
                  color: T.text.primary
                }}>
                  {metric.value}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  color: isPositive ? T.text.green : T.text.red
                }}>
                  <span>{isPositive ? '↑' : '↓'}</span>
                  <span>{Math.abs(metric.change).toFixed(1)}%</span>
                </div>
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginTop: 4
              }}>
                {metric.period.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Market Trends */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16
      }}>
        {/* Rent Trend */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="RENT TREND"
            icon="↗"
            action={<Badge color={T.text.green}>+3.2% YOY</Badge>}
          />
          <div style={{ padding: 16 }}>
            <MiniSparkline 
              data={rentTrend}
              color={T.text.green}
              height={60}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 12,
              fontFamily: T.font.mono,
              fontSize: 11
            }}>
              <div>
                <div style={{ color: T.text.dim }}>12MO LOW</div>
                <div style={{ color: T.text.primary, fontWeight: 600 }}>
                  ${rentTrend[0].toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.text.dim }}>CURRENT</div>
                <div style={{ color: T.text.green, fontWeight: 600 }}>
                  ${rentTrend[rentTrend.length - 1].toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Occupancy Trend */}
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4
        }}>
          <SectionHeader 
            title="OCCUPANCY TREND"
            icon="↗"
            action={<Badge color={T.text.blue}>+1.8% YOY</Badge>}
          />
          <div style={{ padding: 16 }}>
            <MiniSparkline 
              data={occupancyTrend}
              color={T.text.blue}
              height={60}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 12,
              fontFamily: T.font.mono,
              fontSize: 11
            }}>
              <div>
                <div style={{ color: T.text.dim }}>12MO LOW</div>
                <div style={{ color: T.text.primary, fontWeight: 600 }}>
                  {Math.min(...occupancyTrend)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.text.dim }}>CURRENT</div>
                <div style={{ color: T.text.blue, fontWeight: 600 }}>
                  {occupancyTrend[occupancyTrend.length - 1]}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demographics */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="DEMOGRAPHICS"
          icon="👥"
          action={<Badge color={T.text.blue}>3-MILE RADIUS</Badge>}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 12,
          padding: 16
        }}>
          {demographics.map((demo, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                background: T.bg.hover,
                borderRadius: 4,
                border: `1px solid ${T.border.subtle}`
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 20 }}>{demo.icon}</span>
                <span style={{
                  fontFamily: T.font.mono,
                  fontSize: 11,
                  color: T.text.secondary
                }}>
                  {demo.label}
                </span>
              </div>
              <span style={{
                fontFamily: T.font.mono,
                fontSize: 13,
                fontWeight: 600,
                color: T.text.primary
              }}>
                {demo.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Submarket Analysis */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="SUBMARKET ANALYSIS"
          icon="📊"
        />
        <div style={{ padding: 16 }}>
          <div style={{
            background: T.bg.hover,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            padding: 16,
            marginBottom: 16
          }}>
            <div style={{
              fontFamily: T.font.mono,
              fontSize: 11,
              color: T.text.secondary,
              lineHeight: 1.6
            }}>
              <strong style={{ color: T.text.primary }}>
                {property.city?.toUpperCase()} CENTRAL SUBMARKET
              </strong>
              {' '}has shown strong fundamentals with{' '}
              <strong style={{ color: T.text.green }}>increasing rents (+3.2% YoY)</strong>
              {' '}and{' '}
              <strong style={{ color: T.text.green }}>stable occupancy (94.5%)</strong>
              . The area benefits from proximity to major employment centers and ongoing infrastructure improvements. 
              New supply remains balanced with demand, supporting continued rent growth.
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12
          }}>
            <div style={{
              textAlign: 'center',
              padding: 16,
              background: T.bg.hover,
              borderRadius: 4,
              border: `1px solid ${T.border.subtle}`
            }}>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginBottom: 8,
                letterSpacing: 0.5
              }}>
                RENT GROWTH (YOY)
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 24,
                fontWeight: 700,
                color: T.text.green
              }}>
                +3.2%
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: 16,
              background: T.bg.hover,
              borderRadius: 4,
              border: `1px solid ${T.border.subtle}`
            }}>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginBottom: 8,
                letterSpacing: 0.5
              }}>
                MARKET ABSORPTION
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 24,
                fontWeight: 700,
                color: T.text.primary
              }}>
                850
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.secondary,
                marginTop: 4
              }}>
                UNITS (12MO)
              </div>
            </div>

            <div style={{
              textAlign: 'center',
              padding: 16,
              background: T.bg.hover,
              borderRadius: 4,
              border: `1px solid ${T.border.subtle}`
            }}>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.dim,
                marginBottom: 8,
                letterSpacing: 0.5
              }}>
                NEW SUPPLY (12MO)
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 24,
                fontWeight: 700,
                color: T.text.orange
              }}>
                420
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 9,
                color: T.text.secondary,
                marginTop: 4
              }}>
                UNITS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ property }: { property: PropertyData }) {
  // Mock documents
  const documents = [
    { 
      name: 'Property Inspection Report.pdf', 
      type: 'Inspection', 
      date: '2024-02-15', 
      size: '2.4 MB',
      icon: '📋'
    },
    { 
      name: 'Environmental Assessment.pdf', 
      type: 'Environmental', 
      date: '2024-01-20', 
      size: '1.8 MB',
      icon: '🌱'
    },
    { 
      name: 'Title Report.pdf', 
      type: 'Legal', 
      date: '2023-12-10', 
      size: '945 KB',
      icon: '⚖️'
    },
    { 
      name: 'Operating Statements 2023.xlsx', 
      type: 'Financial', 
      date: '2024-01-05', 
      size: '156 KB',
      icon: '📊'
    },
    { 
      name: 'Appraisal Report.pdf', 
      type: 'Valuation', 
      date: '2023-11-22', 
      size: '3.2 MB',
      icon: '💰'
    },
    { 
      name: 'Site Plan.pdf', 
      type: 'Engineering', 
      date: '2023-10-15', 
      size: '5.8 MB',
      icon: '📐'
    },
  ];

  const notes = [
    { 
      date: '2024-03-01 14:35', 
      author: 'John Smith', 
      text: 'Roof replacement completed. All units updated with new HVAC filters. Property in excellent condition.',
      priority: 'normal'
    },
    { 
      date: '2024-02-15 10:20', 
      author: 'Jane Doe', 
      text: 'Inspection showed excellent property condition. Minor electrical panel upgrades recommended for compliance.',
      priority: 'normal'
    },
    { 
      date: '2024-01-28 16:45', 
      author: 'Mike Johnson', 
      text: 'URGENT: Water leak in Unit 202 needs immediate attention. Coordinating with maintenance team.',
      priority: 'high'
    },
  ];

  const documentsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Document Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16
      }}>
        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            TOTAL DOCUMENTS
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.primary
          }}>
            {documents.length}
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            NOTES
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 24,
            fontWeight: 700,
            color: T.text.primary
          }}>
            {notes.length}
          </div>
        </div>

        <div style={{ 
          background: T.bg.panel,
          border: `1px solid ${T.border.default}`,
          borderRadius: 4,
          padding: 16
        }}>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 10,
            color: T.text.secondary,
            marginBottom: 8,
            letterSpacing: 1
          }}>
            LAST UPDATED
          </div>
          <div style={{
            fontFamily: T.font.mono,
            fontSize: 13,
            fontWeight: 600,
            color: T.text.primary,
            marginTop: 6
          }}>
            {documents[0].date}
          </div>
        </div>
      </div>

      {/* Documents by Type */}
      {Object.entries(documentsByType).map(([type, docs]) => (
        <div 
          key={type}
          style={{ 
            background: T.bg.panel,
            border: `1px solid ${T.border.default}`,
            borderRadius: 4
          }}
        >
          <SectionHeader 
            title={`${type.toUpperCase()} DOCUMENTS`}
            icon="◫"
            action={<Badge color={T.text.blue}>{docs.length} FILES</Badge>}
          />
          <div style={{ padding: 0 }}>
            {docs.map((doc, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderBottom: idx < docs.length - 1 ? `1px solid ${T.border.subtle}` : 'none',
                  background: idx % 2 === 0 ? 'transparent' : T.bg.hover,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = T.bg.hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : T.bg.hover;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <span style={{ fontSize: 24 }}>{doc.icon}</span>
                  <div>
                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text.primary,
                      marginBottom: 4
                    }}>
                      {doc.name}
                    </div>
                    <div style={{
                      fontFamily: T.font.mono,
                      fontSize: 10,
                      color: T.text.secondary
                    }}>
                      {doc.date} • {doc.size}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button style={{
                    padding: 8,
                    background: 'transparent',
                    border: `1px solid ${T.border.default}`,
                    borderRadius: 2,
                    color: T.text.secondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Download size={16} />
                  </button>
                  <button style={{
                    padding: 8,
                    background: 'transparent',
                    border: `1px solid ${T.border.default}`,
                    borderRadius: 2,
                    color: T.text.secondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Notes */}
      <div style={{ 
        background: T.bg.panel,
        border: `1px solid ${T.border.default}`,
        borderRadius: 4
      }}>
        <SectionHeader 
          title="ACTIVITY NOTES"
          icon="📝"
          action={
            <button style={{
              padding: '6px 12px',
              background: T.text.blue,
              border: 'none',
              borderRadius: 2,
              color: T.bg.primary,
              fontFamily: T.font.mono,
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.5
            }}>
              + ADD NOTE
            </button>
          }
        />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map((note, idx) => (
            <div
              key={idx}
              style={{
                padding: 16,
                background: T.bg.hover,
                borderRadius: 4,
                border: `1px solid ${note.priority === 'high' ? T.text.red : T.border.subtle}`,
                borderLeft: note.priority === 'high' ? `4px solid ${T.text.red}` : `4px solid ${T.text.blue}`
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10
              }}>
                <div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.text.primary,
                    marginBottom: 4
                  }}>
                    {note.author.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: T.font.mono,
                    fontSize: 10,
                    color: T.text.dim
                  }}>
                    {note.date}
                  </div>
                </div>
                {note.priority === 'high' && (
                  <Badge color={T.text.red}>URGENT</Badge>
                )}
              </div>
              <div style={{
                fontFamily: T.font.mono,
                fontSize: 12,
                color: T.text.secondary,
                lineHeight: 1.6
              }}>
                {note.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
