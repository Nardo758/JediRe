/**
 * Property Details Page - Bloomberg Terminal Style
 * 
 * Full-featured property analysis with 6 tabs:
 * 1. Overview - Photos, metrics, basic info
 * 2. Financial - Rent roll, cash flow, NOI
 * 3. Comparables - Comp set, analysis
 * 4. Zoning - Codes, permits, buildable
 * 5. Market - Submarket analytics
 * 6. Documents - Files, notes
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  FileText,
  Map,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Download,
  Share2,
  Star,
  Calendar,
  Users,
  Bed,
  Bath,
  Maximize,
  Home,
  Zap,
  Target,
  BarChart3,
  PieChart,
  LineChart,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPropertyData();
  }, [id]);

  const fetchPropertyData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/properties/${id}`);
      if (!response.ok) throw new Error('Failed to fetch property');
      
      const data = await response.json();
      setProperty(data);
    } catch (err) {
      console.error('Error fetching property:', err);
      setError(err instanceof Error ? err.message : 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'comparables', label: 'Comparables', icon: BarChart3 },
    { id: 'zoning', label: 'Zoning', icon: Map },
    { id: 'market', label: 'Market', icon: TrendingUp },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading property data...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Property Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'Unable to load property details'}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{property.name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{property.address}, {property.city}, {property.state} {property.zip}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Star className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
  return (
    <div className="space-y-6">
      {/* Photos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Photos</h2>
        
        {property.photos && property.photos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {property.photos.slice(0, 6).map((photo, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={photo.url}
                  alt={`${property.name} - Photo ${idx + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                  {photo.source}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No photos available</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {property.askingPrice && (
          <StatCard
            label="Asking Price"
            value={`$${(property.askingPrice / 1000000).toFixed(2)}M`}
            icon={DollarSign}
            color="blue"
          />
        )}
        {property.units && (
          <StatCard
            label="Units"
            value={property.units.toString()}
            icon={Building2}
            color="purple"
          />
        )}
        {property.capRate && (
          <StatCard
            label="Cap Rate"
            value={`${property.capRate.toFixed(2)}%`}
            icon={TrendingUp}
            color="green"
          />
        )}
        {property.occupancyRate && (
          <StatCard
            label="Occupancy"
            value={`${property.occupancyRate.toFixed(1)}%`}
            icon={Users}
            color="orange"
          />
        )}
      </div>

      {/* Property Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
          <div className="space-y-3">
            <InfoRow label="Property Type" value={property.propertyType} />
            <InfoRow label="Year Built" value={property.yearBuilt?.toString()} />
            <InfoRow label="Total Units" value={property.units?.toString()} />
            <InfoRow label="Total Sq Ft" value={property.totalSqft?.toLocaleString()} />
            <InfoRow label="Lot Size" value={property.lotSize ? `${property.lotSize.toLocaleString()} sqft` : undefined} />
            <InfoRow label="Bedrooms" value={property.bedrooms?.toString()} />
            <InfoRow label="Bathrooms" value={property.bathrooms?.toString()} />
            <InfoRow label="Parking Spaces" value={property.parking?.toString()} />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
          <div className="space-y-3">
            <InfoRow 
              label="Asking Price" 
              value={property.askingPrice ? `$${property.askingPrice.toLocaleString()}` : undefined}
            />
            <InfoRow 
              label="Estimated Value" 
              value={property.estimatedValue ? `$${property.estimatedValue.toLocaleString()}` : undefined}
            />
            <InfoRow 
              label="Monthly Rent" 
              value={property.monthlyRent ? `$${property.monthlyRent.toLocaleString()}` : undefined}
            />
            <InfoRow 
              label="Annual Income" 
              value={property.annualIncome ? `$${property.annualIncome.toLocaleString()}` : undefined}
            />
            <InfoRow 
              label="NOI" 
              value={property.noi ? `$${property.noi.toLocaleString()}` : undefined}
            />
            <InfoRow 
              label="Cap Rate" 
              value={property.capRate ? `${property.capRate.toFixed(2)}%` : undefined}
            />
            <InfoRow 
              label="Occupancy Rate" 
              value={property.occupancyRate ? `${property.occupancyRate.toFixed(1)}%` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Amenities */}
      {property.amenities && property.amenities.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h3>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" />
                {amenity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB: FINANCIAL
// ============================================================================

function FinancialTab({ property }: { property: PropertyData }) {
  // Mock data - will be replaced with real data
  const rentRoll = [
    { unit: '101', bedrooms: 2, bathrooms: 2, sqft: 1200, rent: 2400, status: 'Occupied', leaseEnd: '2026-12-31' },
    { unit: '102', bedrooms: 2, bathrooms: 2, sqft: 1200, rent: 2400, status: 'Occupied', leaseEnd: '2026-08-15' },
    { unit: '201', bedrooms: 1, bathrooms: 1, sqft: 800, rent: 1800, status: 'Vacant', leaseEnd: '-' },
    { unit: '202', bedrooms: 1, bathrooms: 1, sqft: 800, rent: 1800, status: 'Occupied', leaseEnd: '2026-11-30' },
  ];

  const income = [
    { category: 'Gross Rental Income', monthly: 48000, annual: 576000 },
    { category: 'Other Income', monthly: 2000, annual: 24000 },
  ];

  const expenses = [
    { category: 'Property Management', monthly: 4200, annual: 50400 },
    { category: 'Repairs & Maintenance', monthly: 3000, annual: 36000 },
    { category: 'Property Taxes', monthly: 5000, annual: 60000 },
    { category: 'Insurance', monthly: 1500, annual: 18000 },
    { category: 'Utilities', monthly: 2000, annual: 24000 },
  ];

  const totalIncome = income.reduce((sum, item) => sum + item.annual, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.annual, 0);
  const noi = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      {/* NOI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Gross Income"
          value={`$${(totalIncome / 1000).toFixed(0)}K`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Total Expenses"
          value={`$${(totalExpenses / 1000).toFixed(0)}K`}
          icon={TrendingUp}
          color="red"
        />
        <StatCard
          label="NOI"
          value={`$${(noi / 1000).toFixed(0)}K`}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          label="Cap Rate"
          value={property.capRate ? `${property.capRate.toFixed(2)}%` : 'N/A'}
          icon={Target}
          color="purple"
        />
      </div>

      {/* Rent Roll */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rent Roll</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Bed/Bath</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Sq Ft</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">Rent</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Lease End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rentRoll.map((unit) => (
                <tr key={unit.unit} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{unit.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.bedrooms}bd / {unit.bathrooms}ba</td>
                  <td className="px-4 py-3 text-right text-gray-600">{unit.sqft.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">${unit.rent.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      unit.status === 'Occupied' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{unit.leaseEnd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Income & Expenses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income</h3>
          <div className="space-y-3">
            {income.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{item.category}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${item.annual.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">${item.monthly.toLocaleString()}/mo</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-gray-200">
              <span className="font-semibold text-gray-900">Total Income</span>
              <div className="text-right">
                <div className="font-bold text-green-600 text-lg">${totalIncome.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses</h3>
          <div className="space-y-3">
            {expenses.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{item.category}</span>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${item.annual.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">${item.monthly.toLocaleString()}/mo</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 pt-3 border-t-2 border-gray-200">
              <span className="font-semibold text-gray-900">Total Expenses</span>
              <div className="text-right">
                <div className="font-bold text-red-600 text-lg">${totalExpenses.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOI Calculation */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Net Operating Income (NOI)</h3>
            <p className="text-sm text-gray-600">Gross Income - Operating Expenses</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">${noi.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Annual NOI</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: COMPARABLES
// ============================================================================

function ComparablesTab({ property }: { property: PropertyData }) {
  // Mock comp data
  const comps = [
    {
      id: '1',
      name: 'Riverside Apartments',
      address: '456 River Rd',
      distance: 0.3,
      units: 48,
      price: 8500000,
      pricePerUnit: 177000,
      capRate: 5.2,
      yearBuilt: 2018,
    },
    {
      id: '2',
      name: 'Park Place Residences',
      address: '789 Park Ave',
      distance: 0.5,
      units: 52,
      price: 9200000,
      pricePerUnit: 177000,
      capRate: 5.0,
      yearBuilt: 2019,
    },
    {
      id: '3',
      name: 'Downtown Lofts',
      address: '321 Main St',
      distance: 0.8,
      units: 45,
      price: 7900000,
      pricePerUnit: 176000,
      capRate: 5.3,
      yearBuilt: 2017,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Comp Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparable Properties Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{comps.length}</div>
            <div className="text-sm text-gray-600">Comparables</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              ${Math.round(comps.reduce((sum, c) => sum + c.pricePerUnit, 0) / comps.length / 1000)}K
            </div>
            <div className="text-sm text-gray-600">Avg Price/Unit</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {(comps.reduce((sum, c) => sum + c.capRate, 0) / comps.length).toFixed(2)}%
            </div>
            <div className="text-sm text-gray-600">Avg Cap Rate</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">0.5mi</div>
            <div className="text-sm text-gray-600">Avg Distance</div>
          </div>
        </div>
      </div>

      {/* Comp List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Comparable Properties</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {comps.map((comp) => (
            <div key={comp.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{comp.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{comp.address} • {comp.distance} mi away</span>
                  </div>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Details →
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Price</div>
                  <div className="font-semibold text-gray-900">
                    ${(comp.price / 1000000).toFixed(2)}M
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Price/Unit</div>
                  <div className="font-semibold text-gray-900">
                    ${(comp.pricePerUnit / 1000).toFixed(0)}K
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Units</div>
                  <div className="font-semibold text-gray-900">{comp.units}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Cap Rate</div>
                  <div className="font-semibold text-green-600">{comp.capRate.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Year Built</div>
                  <div className="font-semibold text-gray-900">{comp.yearBuilt}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: ZONING
// ============================================================================

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
    { date: '2024-01-15', type: 'Building Permit', status: 'Approved', description: 'Roof replacement' },
    { date: '2023-08-22', type: 'Electrical Permit', status: 'Approved', description: 'Panel upgrade' },
    { date: '2023-03-10', type: 'Plumbing Permit', status: 'Approved', description: 'Water heater replacement' },
  ];

  return (
    <div className="space-y-6">
      {/* Zoning Code */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Zoning Classification</h3>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-blue-100 text-blue-700 font-bold text-lg rounded-lg">
                {zoningDetails.code}
              </span>
              <span className="text-gray-700">{zoningDetails.description}</span>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg">
            <ExternalLink className="w-4 h-4" />
            View Zoning Map
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">District Information</h4>
            <div className="space-y-2">
              <InfoRow label="Zoning District" value={zoningDetails.district} />
              <InfoRow label="Overlay District" value={zoningDetails.overlay} />
            </div>
          </div>
        </div>
      </div>

      {/* Development Standards */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Development Standards</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Max Density</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.maxDensity}</div>
            <div className="text-xs text-gray-500">units/acre</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Max Height</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.maxHeight}</div>
            <div className="text-xs text-gray-500">feet</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Max FAR</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.maxFAR}</div>
            <div className="text-xs text-gray-500">floor area ratio</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Min Setback</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.minSetback}</div>
            <div className="text-xs text-gray-500">feet</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Max Coverage</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.maxCoverage}</div>
            <div className="text-xs text-gray-500">percent</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Parking Ratio</div>
            <div className="text-2xl font-bold text-gray-900">{zoningDetails.parkingRatio}</div>
            <div className="text-xs text-gray-500">spaces/unit</div>
          </div>
        </div>
      </div>

      {/* Permit History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Permit History</h3>
        <div className="space-y-3">
          {permitHistory.map((permit, idx) => (
            <div key={idx} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold text-gray-900">{permit.type}</div>
                    <div className="text-sm text-gray-600">{permit.description}</div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    {permit.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{permit.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: MARKET
// ============================================================================

function MarketTab({ property }: { property: PropertyData }) {
  // Mock market data
  const marketMetrics = [
    { label: 'Submarket Avg Rent', value: '$2,250/mo', change: '+3.2%', trend: 'up' },
    { label: 'Submarket Occupancy', value: '94.5%', change: '+1.8%', trend: 'up' },
    { label: 'Submarket Cap Rate', value: '5.1%', change: '-0.2%', trend: 'down' },
    { label: 'Population Growth', value: '2.8%', change: '+0.5%', trend: 'up' },
  ];

  const demographics = [
    { label: 'Median Household Income', value: '$78,500' },
    { label: 'Population (3mi radius)', value: '45,230' },
    { label: 'Employment Rate', value: '96.2%' },
    { label: 'Average Age', value: '34.5 years' },
  ];

  return (
    <div className="space-y-6">
      {/* Market Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketMetrics.map((metric, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-2">{metric.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.trend === 'up' ? '↑' : '↓'} {metric.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Demographics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Demographics (3-mile radius)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demographics.map((demo, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-700">{demo.label}</span>
              <span className="font-semibold text-gray-900">{demo.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Submarket Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Submarket Analysis</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">
            This property is located in the <strong>{property.city} Central</strong> submarket, 
            which has shown strong fundamentals with increasing rents and stable occupancy. 
            The area benefits from proximity to major employment centers and ongoing infrastructure improvements.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <LineChart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-sm text-gray-600 mb-1">Rent Growth (YoY)</div>
            <div className="text-xl font-bold text-green-600">+3.2%</div>
          </div>
          
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <PieChart className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-sm text-gray-600 mb-1">Market Absorption</div>
            <div className="text-xl font-bold text-gray-900">850 units</div>
          </div>
          
          <div className="text-center p-4 border border-gray-200 rounded-lg">
            <BarChart3 className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-sm text-gray-600 mb-1">New Supply (12mo)</div>
            <div className="text-xl font-bold text-gray-900">420 units</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: DOCUMENTS
// ============================================================================

function DocumentsTab({ property }: { property: PropertyData }) {
  // Mock documents
  const documents = [
    { name: 'Property Inspection Report.pdf', type: 'Inspection', date: '2024-02-15', size: '2.4 MB' },
    { name: 'Environmental Assessment.pdf', type: 'Environmental', date: '2024-01-20', size: '1.8 MB' },
    { name: 'Title Report.pdf', type: 'Legal', date: '2023-12-10', size: '945 KB' },
    { name: 'Operating Statements 2023.xlsx', type: 'Financial', date: '2024-01-05', size: '156 KB' },
  ];

  const notes = [
    { date: '2024-03-01', author: 'John Smith', text: 'Roof replacement completed. All units updated.' },
    { date: '2024-02-15', author: 'Jane Doe', text: 'Inspection showed excellent property condition.' },
  ];

  return (
    <div className="space-y-6">
      {/* Documents */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <FileText className="w-4 h-4" />
            Upload Document
          </button>
        </div>
        
        <div className="space-y-2">
          {documents.map((doc, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{doc.name}</div>
                  <div className="text-sm text-gray-500">
                    {doc.type} • {doc.date} • {doc.size}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                  <Download className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Add Note
          </button>
        </div>
        
        <div className="space-y-4">
          {notes.map((note, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-gray-900">{note.author}</div>
                  <div className="text-sm text-gray-500">{note.date}</div>
                </div>
              </div>
              <p className="text-gray-700">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: any;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{label}</div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
