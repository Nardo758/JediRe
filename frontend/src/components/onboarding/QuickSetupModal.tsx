import { useState, useEffect } from 'react';
import { X, MapPin, Building2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

interface Market {
  name: string;
  display_name: string;
  coverage_status: string;
  property_count: number;
}

interface PropertyType {
  type_key: string;
  display_name: string;
  icon: string;
}

interface QuickSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function QuickSetupModal({ isOpen, onClose, onComplete }: QuickSetupModalProps) {
  const [step, setStep] = useState(1);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    try {
      const [marketsRes, typesRes] = await Promise.all([
        api.get('/preferences/available-markets'),
        api.get('/preferences/property-types')
      ]);
      
      // Only show active and beta markets for onboarding
      setMarkets(marketsRes.data.markets.filter((m: Market) => 
        m.coverage_status === 'active' || m.coverage_status === 'beta'
      ));
      setPropertyTypes(typesRes.data.property_types);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await api.put('/preferences/user', { onboarding_completed: true });
      onClose();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      onClose();
    }
  };

  const handleComplete = async () => {
    try {
      setSaving(true);
      
      await api.put('/preferences/user', {
        preferred_markets: selectedMarkets,
        property_types: selectedPropertyTypes,
        primary_market: selectedMarkets[0] || null,
        onboarding_completed: true
      });
      
      onComplete();
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
    } else {
      setSelectedMarkets([...selectedMarkets, marketName]);
    }
  };

  const togglePropertyType = (typeKey: string) => {
    if (selectedPropertyTypes.includes(typeKey)) {
      setSelectedPropertyTypes(selectedPropertyTypes.filter(t => t !== typeKey));
    } else {
      setSelectedPropertyTypes([...selectedPropertyTypes, typeKey]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quick Setup</h2>
            <p className="text-sm text-gray-600 mt-1">
              Help us personalize JEDI RE for you (optional)
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>Markets</span>
            <span>Property Types</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Which markets do you want to track?</h3>
                  <p className="text-sm text-gray-600">Select all that apply</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {markets.map((market) => (
                  <button
                    key={market.name}
                    onClick={() => toggleMarket(market.name)}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all
                      ${selectedMarkets.includes(market.name)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{market.display_name}</h4>
                        {market.property_count > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            {(market.property_count / 1000).toFixed(0)}K properties
                          </p>
                        )}
                      </div>
                      {market.coverage_status === 'active' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">What property types do you focus on?</h3>
                  <p className="text-sm text-gray-600">Select all that apply</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{type.display_name}</h4>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            Skip for now
          </button>
          
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Back
              </button>
            )}
            
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={selectedMarkets.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving || selectedPropertyTypes.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
