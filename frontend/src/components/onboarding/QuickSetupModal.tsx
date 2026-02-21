import { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Building2, ArrowRight, Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import {
  Home, Building, House, Columns3, Caravan, Users,
  Trees, GraduationCap, HeartHandshake, ShieldCheck, Hammer,
  Briefcase, Stethoscope, Palette,
  Store, ShoppingBag, Zap, ShoppingCart, FileSignature, Sparkles, Tag,
  Warehouse, Package, Factory, Snowflake, Server, Layout, Truck,
  Bed, Hotel, CalendarClock, Palmtree, Key,
  Archive, Car, HeartPulse, FlaskConical, Ticket, Church, School, Fuel,
  Mountain, FileCheck, Wheat, MapPin as MapPinIcon,
  Layers, LayoutGrid
} from 'lucide-react';
import api from '@/lib/api';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'home': Home,
  'building-2': Building2,
  'building': Building,
  'house': House,
  'columns': Columns3,
  'caravan': Caravan,
  'users': Users,
  'trees': Trees,
  'graduation-cap': GraduationCap,
  'heart-handshake': HeartHandshake,
  'shield-check': ShieldCheck,
  'hammer': Hammer,
  'briefcase': Briefcase,
  'stethoscope': Stethoscope,
  'palette': Palette,
  'store': Store,
  'shopping-bag': ShoppingBag,
  'zap': Zap,
  'shopping-cart': ShoppingCart,
  'file-signature': FileSignature,
  'sparkles': Sparkles,
  'tag': Tag,
  'warehouse': Warehouse,
  'package': Package,
  'factory': Factory,
  'snowflake': Snowflake,
  'server': Server,
  'layout': Layout,
  'truck': Truck,
  'bed': Bed,
  'hotel': Hotel,
  'calendar-clock': CalendarClock,
  'palm-tree': Palmtree,
  'key': Key,
  'archive': Archive,
  'car': Car,
  'heart-pulse': HeartPulse,
  'flask-conical': FlaskConical,
  'ticket': Ticket,
  'church': Church,
  'school': School,
  'fuel': Fuel,
  'mountain': Mountain,
  'file-check': FileCheck,
  'wheat': Wheat,
  'map-pin': MapPinIcon,
  'layers': Layers,
  'layout-grid': LayoutGrid,
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  'Residential': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  'Multifamily': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-500' },
  'Commercial': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
  'Retail': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  'Industrial': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: 'text-slate-500' },
  'Hospitality': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500' },
  'Special Purpose': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', icon: 'text-violet-500' },
  'Land': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
  'Mixed-Use': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-500' },
};

interface Market {
  name: string;
  display_name: string;
  state: string;
  coverage_status: string;
  property_count: number;
}

interface PropertyType {
  type_key: string;
  display_name: string;
  icon: string;
  category: string;
  sort_order: number;
}

interface QuickSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return <Building2 className={className} />;
  }
  return <IconComponent className={className} />;
}

export default function QuickSetupModal({ isOpen, onClose, onComplete }: QuickSetupModalProps) {
  const [step, setStep] = useState(1);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [marketSearch, setMarketSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (propertyTypes.length > 0) {
      const cats = new Set(propertyTypes.map(t => t.category));
      setExpandedCategories(cats);
    }
  }, [propertyTypes]);

  const loadOptions = async () => {
    try {
      const [marketsRes, typesRes] = await Promise.all([
        api.get('/preferences/available-markets'),
        api.get('/preferences/property-types')
      ]);
      
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

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const selectAllInCategory = (category: string) => {
    const typesInCategory = propertyTypes
      .filter(t => t.category === category)
      .map(t => t.type_key);
    const allSelected = typesInCategory.every(tk => selectedPropertyTypes.includes(tk));
    if (allSelected) {
      setSelectedPropertyTypes(selectedPropertyTypes.filter(t => !typesInCategory.includes(t)));
    } else {
      const newSelected = new Set([...selectedPropertyTypes, ...typesInCategory]);
      setSelectedPropertyTypes(Array.from(newSelected));
    }
  };

  const filteredMarkets = useMemo(() => {
    if (!marketSearch.trim()) return markets;
    const q = marketSearch.toLowerCase();
    return markets.filter(m => 
      m.display_name.toLowerCase().includes(q) || 
      m.state.toLowerCase().includes(q)
    );
  }, [markets, marketSearch]);

  const marketsByRegion = useMemo(() => {
    const regions: Record<string, Market[]> = {
      'Southeast': [],
      'Texas': [],
      'West': [],
      'Midwest': [],
      'Northeast': [],
    };
    const stateToRegion: Record<string, string> = {
      'GA': 'Southeast', 'FL': 'Southeast', 'NC': 'Southeast', 'SC': 'Southeast',
      'TN': 'Southeast', 'VA': 'Southeast', 'AL': 'Southeast', 'LA': 'Southeast',
      'TX': 'Texas',
      'AZ': 'West', 'CO': 'West', 'NV': 'West', 'CA': 'West', 'WA': 'West',
      'OR': 'West', 'UT': 'West', 'ID': 'West', 'HI': 'West', 'NM': 'West',
      'IL': 'Midwest', 'MN': 'Midwest', 'OH': 'Midwest', 'IN': 'Midwest',
      'MO': 'Midwest', 'MI': 'Midwest', 'WI': 'Midwest', 'IA': 'Midwest',
      'NE': 'Midwest',
      'NY': 'Northeast', 'MA': 'Northeast', 'PA': 'Northeast', 'DC': 'Northeast',
      'MD': 'Northeast', 'CT': 'Northeast', 'RI': 'Northeast',
    };
    filteredMarkets.forEach(m => {
      const region = stateToRegion[m.state] || 'Other';
      if (!regions[region]) regions[region] = [];
      regions[region].push(m);
    });
    return Object.entries(regions).filter(([_, ms]) => ms.length > 0);
  }, [filteredMarkets]);

  const groupedPropertyTypes = useMemo(() => {
    const groups: Record<string, PropertyType[]> = {};
    propertyTypes.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return Object.entries(groups);
  }, [propertyTypes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
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

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>Markets ({selectedMarkets.length} selected)</span>
            <span>Property Types ({selectedPropertyTypes.length} selected)</span>
          </div>
        </div>

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

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {marketsByRegion.map(([region, regionMarkets]) => (
                <div key={region} className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                    {region} ({regionMarkets.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {regionMarkets.map((market) => (
                      <button
                        key={market.name}
                        onClick={() => toggleMarket(market.name)}
                        className={`
                          p-3 rounded-lg border-2 text-left transition-all text-sm
                          ${selectedMarkets.includes(market.name)
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {selectedMarkets.includes(market.name) && (
                                <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              )}
                              <h4 className="font-medium text-gray-900 truncate">{market.display_name}</h4>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {market.state} {market.property_count > 0 && `- ${(market.property_count / 1000).toFixed(1)}K`}
                            </p>
                          </div>
                          {market.coverage_status === 'beta' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0 ml-1">
                              Beta
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">What property types do you focus on?</h3>
                  <p className="text-sm text-gray-600">Select all that apply - click a category header to select all in that group</p>
                </div>
              </div>

              <div className="space-y-3">
                {groupedPropertyTypes.map(([category, types]) => {
                  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Commercial'];
                  const isExpanded = expandedCategories.has(category);
                  const selectedCount = types.filter(t => selectedPropertyTypes.includes(t.type_key)).length;
                  const allSelected = selectedCount === types.length;

                  return (
                    <div key={category} className={`rounded-lg border ${colors.border} overflow-hidden`}>
                      <div className={`flex items-center justify-between px-4 py-2.5 ${colors.bg} cursor-pointer`}
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className={`w-4 h-4 ${colors.text}`} />
                          ) : (
                            <ChevronRight className={`w-4 h-4 ${colors.text}`} />
                          )}
                          <span className={`font-semibold text-sm ${colors.text}`}>{category}</span>
                          <span className="text-xs text-gray-500">({types.length})</span>
                          {selectedCount > 0 && (
                            <span className="text-xs bg-white/80 rounded-full px-2 py-0.5 text-gray-700">
                              {selectedCount} selected
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(category);
                          }}
                          className={`text-xs font-medium px-2 py-1 rounded ${colors.text} hover:bg-white/50 transition-colors`}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-white">
                          {types.map((type) => {
                            const isSelected = selectedPropertyTypes.includes(type.type_key);
                            return (
                              <button
                                key={type.type_key}
                                onClick={() => togglePropertyType(type.type_key)}
                                className={`
                                  p-2.5 rounded-lg border text-left transition-all text-sm flex items-center gap-2
                                  ${isSelected
                                    ? `border-2 ${colors.border} ${colors.bg}`
                                    : 'border border-gray-200 hover:border-gray-300'
                                  }
                                `}
                              >
                                <LucideIcon
                                  name={type.icon}
                                  className={`w-4 h-4 flex-shrink-0 ${isSelected ? colors.icon : 'text-gray-400'}`}
                                />
                                <span className={`truncate ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                                  {type.display_name}
                                </span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0 ml-auto" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
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
