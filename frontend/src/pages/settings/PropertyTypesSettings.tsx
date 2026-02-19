import { useState, useEffect } from 'react';
import {
  Home, Building, House, Columns3, Caravan, Users,
  Trees, GraduationCap, HeartHandshake, ShieldCheck, Hammer,
  Briefcase, Stethoscope, Palette,
  Store, ShoppingBag, Zap, ShoppingCart, FileSignature, Sparkles, Tag,
  Warehouse, Package, Factory, Snowflake, Server, Layout, Truck,
  Bed, Hotel, CalendarClock, Palmtree, Key,
  Archive, Car, HeartPulse, FlaskConical, Ticket, Church, School, Fuel,
  Mountain, FileCheck, Wheat, MapPin as MapPinIcon,
  Layers, LayoutGrid, Loader2, CheckCircle2, Building2
} from 'lucide-react';
import api from '@/lib/api';

// Icon mapping for property types
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

// Category colors for visual grouping
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

// Strategy strength colors
const STRENGTH_COLORS = {
  strong: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-600' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-600' },
  weak: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400' },
};

interface PropertyType {
  type_key: string;
  display_name: string;
  description: string;
  icon: string;
  category: string;
  sort_order: number;
}

interface Strategy {
  slug: string;
  name: string;
  description: string;
  color: string;
  strength?: 'strong' | 'moderate' | 'weak';
  rationale?: string;
}

// Lucide Icon component that renders actual React components
function LucideIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return <Building2 className={className} />;
  }
  return <IconComponent className={className} />;
}

export default function PropertyTypesSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<PropertyType | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadStrategiesForType(selectedType.type_key);
    }
  }, [selectedType]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesRes, prefsRes] = await Promise.all([
        api.get('/preferences/property-types'),
        api.get('/preferences/user')
      ]);
      
      setPropertyTypes(typesRes.data.property_types);
      const prefs = prefsRes.data.data || prefsRes.data;
      setSelectedTypes(prefs.property_types || []);
      
      // Auto-select first type if there are selected types
      if (prefs.property_types && prefs.property_types.length > 0) {
        const firstType = typesRes.data.property_types.find(
          (t: PropertyType) => t.type_key === prefs.property_types[0]
        );
        if (firstType) {
          setSelectedType(firstType);
        }
      }
    } catch (error) {
      console.error('Failed to load property types:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStrategiesForType = async (typeKey: string) => {
    try {
      setLoadingStrategies(true);
      const res = await api.get(`/property-type-strategies/${typeKey}`);
      setStrategies(res.data.strategies || []);
    } catch (error) {
      console.error('Failed to load strategies:', error);
      setStrategies([]);
    } finally {
      setLoadingStrategies(false);
    }
  };

  const toggleType = (typeKey: string) => {
    if (selectedTypes.includes(typeKey)) {
      setSelectedTypes(selectedTypes.filter(t => t !== typeKey));
    } else {
      setSelectedTypes([...selectedTypes, typeKey]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/preferences/user', {
        property_types: selectedTypes
      });
      alert('Property type preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Group property types by category
  const groupedTypes = propertyTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, PropertyType[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900">Property Types & Strategies</h2>
        <p className="text-sm text-gray-600 mt-1">
          Select property types you focus on and view applicable investment strategies
        </p>
      </div>

      {/* Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Property Types List */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-6">
          <div className="space-y-4">
            {Object.entries(groupedTypes).map(([category, types]) => {
              const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS['Commercial'];
              const selectedCount = types.filter(t => selectedTypes.includes(t.type_key)).length;

              return (
                <div key={category} className={`rounded-lg border ${colors.border} overflow-hidden`}>
                  {/* Category Header */}
                  <div className={`${colors.bg} px-4 py-3 border-b ${colors.border}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold ${colors.text}`}>{category}</h3>
                      <span className="text-xs text-gray-600">
                        {selectedCount}/{types.length} selected
                      </span>
                    </div>
                  </div>

                  {/* Property Types */}
                  <div className="bg-white p-2 space-y-1">
                    {types.map((type) => {
                      const isSelected = selectedTypes.includes(type.type_key);
                      const isActive = selectedType?.type_key === type.type_key;

                      return (
                        <div
                          key={type.type_key}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                            ${isActive ? 'bg-blue-50 border-2 border-blue-500' : 'border border-transparent hover:bg-gray-50'}
                          `}
                          onClick={() => setSelectedType(type)}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleType(type.type_key);
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />

                          {/* Icon */}
                          <LucideIcon
                            name={type.icon}
                            className={`w-5 h-5 flex-shrink-0 ${isSelected ? colors.icon : 'text-gray-400'}`}
                          />

                          {/* Name */}
                          <span className={`text-sm flex-1 ${isSelected ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {type.display_name}
                          </span>

                          {/* Selection indicator */}
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Selected Type Details & Strategies */}
        <div className="w-1/2 overflow-y-auto p-6 bg-gray-50">
          {selectedType ? (
            <div className="space-y-6">
              {/* Selected Property Type Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${CATEGORY_COLORS[selectedType.category]?.bg || 'bg-gray-100'}`}>
                    <LucideIcon
                      name={selectedType.icon}
                      className={`w-8 h-8 ${CATEGORY_COLORS[selectedType.category]?.icon || 'text-gray-500'}`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{selectedType.display_name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[selectedType.category]?.bg} ${CATEGORY_COLORS[selectedType.category]?.text}`}>
                        {selectedType.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{selectedType.description}</p>
                  </div>
                </div>
              </div>

              {/* Applicable Strategies */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-3">
                  Applicable Investment Strategies
                </h4>

                {loadingStrategies ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : strategies.length > 0 ? (
                  <div className="space-y-3">
                    {strategies.map((strategy) => {
                      const strengthColor = STRENGTH_COLORS[strategy.strength || 'weak'];

                      return (
                        <div
                          key={strategy.slug}
                          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900">{strategy.name}</h5>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1.5 ${strengthColor.bg} ${strengthColor.text} border ${strengthColor.border}`}>
                              <span className={`w-2 h-2 rounded-full ${strengthColor.dot}`}></span>
                              {strategy.strength?.charAt(0).toUpperCase() + strategy.strength?.slice(1)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                          {strategy.rationale && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500 italic">
                                <strong>Rationale:</strong> {strategy.rationale}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>No strategies available for this property type.</p>
                  </div>
                )}
              </div>

              {/* Strategy Legend */}
              {strategies.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">Strategy Strength Guide</h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-600"></span>
                      <span className="text-gray-700"><strong>Strong:</strong> Highly applicable, proven track record</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-600"></span>
                      <span className="text-gray-700"><strong>Moderate:</strong> Can work with right conditions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                      <span className="text-gray-700"><strong>Weak:</strong> Limited applicability or high challenges</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a property type</p>
                <p className="text-sm">Click on any property type to view applicable strategies</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Save Button */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {selectedTypes.length} property type{selectedTypes.length !== 1 ? 's' : ''} selected
        </p>
        
        <button
          onClick={handleSave}
          disabled={saving || selectedTypes.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
