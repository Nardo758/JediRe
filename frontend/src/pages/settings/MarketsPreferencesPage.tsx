import { useState, useEffect } from 'react';
import { MapPin, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface Market {
  name: string;
  display_name: string;
  state: string;
  metro_area: string;
  coverage_status: 'active' | 'beta' | 'coming_soon';
  property_count: number;
  data_freshness: string;
}

interface PropertyType {
  type_key: string;
  display_name: string;
  description: string;
  icon: string;
}

export default function MarketsPreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [primaryMarket, setPrimaryMarket] = useState<string>('');
  const [primaryUseCase, setPrimaryUseCase] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load available options
      const [marketsRes, typesRes, prefsRes] = await Promise.all([
        api.get('/preferences/available-markets'),
        api.get('/preferences/property-types'),
        api.get('/preferences/user')
      ]);
      
      setMarkets(marketsRes.data.markets);
      setPropertyTypes(typesRes.data.property_types);
      
      // Load current preferences
      const prefs = prefsRes.data.preferences;
      setSelectedMarkets(prefs.preferred_markets || []);
      setSelectedPropertyTypes(prefs.property_types || []);
      setPrimaryMarket(prefs.primary_market || '');
      setPrimaryUseCase(prefs.primary_use_case || '');
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      await api.put('/preferences/user', {
        preferred_markets: selectedMarkets,
        property_types: selectedPropertyTypes,
        primary_market: primaryMarket,
        primary_use_case: primaryUseCase
      });
      
      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleMarket = (marketName: string) => {
    if (selectedMarkets.includes(marketName)) {
      setSelectedMarkets(selectedMarkets.filter(m => m !== marketName));
      if (primaryMarket === marketName) {
        setPrimaryMarket('');
      }
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
      if (!primaryMarket) {
        setPrimaryMarket(marketName);
      }
    }
  };

  const togglePropertyType = (typeKey: string) => {
    if (selectedPropertyTypes.includes(typeKey)) {
      setSelectedPropertyTypes(selectedPropertyTypes.filter(t => t !== typeKey));
    } else {
      setSelectedPropertyTypes([...selectedPropertyTypes, typeKey]);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      beta: 'bg-blue-100 text-blue-800',
      coming_soon: 'bg-gray-100 text-gray-600'
    };
    
    const labels = {
      active: 'Active',
      beta: 'Beta',
      coming_soon: 'Coming Soon'
    };
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Markets & Coverage</h1>
        <p className="text-gray-600 mt-2">
          Select which markets you want to track and what property types you focus on
        </p>
      </div>

      {/* Markets Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <MapPin className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Markets</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Select the markets you want coverage for. Market Research will focus on your selected markets.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <button
              key={market.name}
              onClick={() => toggleMarket(market.name)}
              disabled={market.coverage_status === 'coming_soon'}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${selectedMarkets.includes(market.name)
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
                ${market.coverage_status === 'coming_soon'
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{market.display_name}</h3>
                  <p className="text-xs text-gray-500">{market.metro_area}</p>
                </div>
                {selectedMarkets.includes(market.name) && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
              
              <div className="flex items-center justify-between">
                {getStatusBadge(market.coverage_status)}
                {market.property_count > 0 && (
                  <span className="text-xs text-gray-600">
                    {(market.property_count / 1000).toFixed(0)}K properties
                  </span>
                )}
              </div>
              
              {selectedMarkets.includes(market.name) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="primary_market"
                      checked={primaryMarket === market.name}
                      onChange={() => setPrimaryMarket(market.name)}
                      className="text-blue-600"
                    />
                    <span className="text-gray-700">Set as primary market</span>
                  </label>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Property Types Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Property Types</h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          Select the property types you focus on. We'll tailor analytics and insights accordingly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {propertyTypes.map((type) => (
            <button
              key={type.type_key}
              onClick={() => togglePropertyType(type.type_key)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${selectedPropertyTypes.includes(type.type_key)
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{type.icon}</span>
                    <h3 className="font-semibold text-gray-900">{type.display_name}</h3>
                  </div>
                  <p className="text-xs text-gray-600">{type.description}</p>
                </div>
                {selectedPropertyTypes.includes(type.type_key) && (
                  <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Use Case */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Primary Use Case</h2>
        
        <select
          value={primaryUseCase}
          onChange={(e) => setPrimaryUseCase(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select your role...</option>
          <option value="investor">Investor</option>
          <option value="developer">Developer</option>
          <option value="broker">Broker/Agent</option>
          <option value="lender">Lender</option>
          <option value="property_manager">Property Manager</option>
          <option value="analyst">Analyst/Research</option>
        </select>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Changes will update your Market Research dashboard and analytics
        </p>
        
        <button
          onClick={handleSave}
          disabled={saving || selectedMarkets.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </div>
  );
}
