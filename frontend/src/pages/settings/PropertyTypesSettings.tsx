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
  Layers, LayoutGrid, Building2, CheckCircle2
} from 'lucide-react';
import api from '@/lib/api';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'home': Home, 'building-2': Building2, 'building': Building, 'house': House,
  'columns': Columns3, 'caravan': Caravan, 'users': Users, 'trees': Trees,
  'graduation-cap': GraduationCap, 'heart-handshake': HeartHandshake,
  'shield-check': ShieldCheck, 'hammer': Hammer, 'briefcase': Briefcase,
  'stethoscope': Stethoscope, 'palette': Palette, 'store': Store,
  'shopping-bag': ShoppingBag, 'zap': Zap, 'shopping-cart': ShoppingCart,
  'file-signature': FileSignature, 'sparkles': Sparkles, 'tag': Tag,
  'warehouse': Warehouse, 'package': Package, 'factory': Factory,
  'snowflake': Snowflake, 'server': Server, 'layout': Layout, 'truck': Truck,
  'bed': Bed, 'hotel': Hotel, 'calendar-clock': CalendarClock,
  'palm-tree': Palmtree, 'key': Key, 'archive': Archive, 'car': Car,
  'heart-pulse': HeartPulse, 'flask-conical': FlaskConical, 'ticket': Ticket,
  'church': Church, 'school': School, 'fuel': Fuel, 'mountain': Mountain,
  'file-check': FileCheck, 'wheat': Wheat, 'map-pin': MapPinIcon,
  'layers': Layers, 'layout-grid': LayoutGrid,
};

const CATEGORY_ACCENT: Record<string, string> = {
  'Residential': BT.text.cyan, 'Multifamily': BT.text.violet,
  'Commercial': BT.text.green, 'Retail': BT.text.amber,
  'Industrial': BT.text.secondary, 'Hospitality': BT.text.red,
  'Special Purpose': BT.text.purple, 'Land': BT.text.amber,
  'Mixed-Use': BT.text.cyan,
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

function LucideIcon({ name, style }: { name: string; style?: React.CSSProperties }) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return <Building2 style={style} />;
  return <IconComponent style={style} />;
}

export default function PropertyTypesSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<PropertyType | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [primaryUseCase, setPrimaryUseCase] = useState<string>('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedType) loadStrategiesForType(selectedType.type_key); }, [selectedType]);

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
      setPrimaryUseCase(prefs.primary_use_case || '');
      if (prefs.property_types?.length > 0) {
        const firstType = typesRes.data.property_types.find((t: PropertyType) => t.type_key === prefs.property_types[0]);
        if (firstType) setSelectedType(firstType);
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
      setSaveMessage(null);
      await api.put('/preferences/user', { property_types: selectedTypes, primary_use_case: primaryUseCase });
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const groupedTypes = propertyTypes.reduce((acc, type) => {
    if (!acc[type.category]) acc[type.category] = [];
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, PropertyType[]>);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ height: 32, width: 32, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const strengthColors: Record<string, { color: string; dot: string }> = {
    strong: { color: BT.text.green, dot: BT.text.green },
    moderate: { color: BT.text.amber, dot: BT.text.amber },
    weak: { color: BT.text.muted, dot: BT.text.muted },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>Property Types & Strategies</h2>
            <p style={{ fontSize: 11, color: BT.text.secondary, marginTop: 4 }}>
              Select property types you focus on and view applicable investment strategies
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: BT.text.secondary, whiteSpace: 'nowrap' }}>Primary Role:</label>
            <select
              value={primaryUseCase}
              onChange={(e) => setPrimaryUseCase(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: BT.bg.input,
                color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`,
                outline: 'none',
              }}
            >
              <option value="">Select role...</option>
              <option value="investor">Investor</option>
              <option value="developer">Developer</option>
              <option value="broker">Broker/Agent</option>
              <option value="lender">Lender</option>
              <option value="property_manager">Property Manager</option>
              <option value="analyst">Analyst/Research</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '50%', borderRight: `1px solid ${BT.border.subtle}`, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(groupedTypes).map(([category, types]) => {
              const accent = CATEGORY_ACCENT[category] || BT.text.cyan;
              const selectedCount = types.filter(t => selectedTypes.includes(t.type_key)).length;

              return (
                <div key={category} style={{ border: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ padding: '8px 12px', background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: accent }}>{category}</span>
                    <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{selectedCount}/{types.length}</span>
                  </div>

                  <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2, background: BT.bg.panel }}>
                    {types.map((type) => {
                      const isSelected = selectedTypes.includes(type.type_key);
                      const isActive = selectedType?.type_key === type.type_key;

                      return (
                        <div
                          key={type.type_key}
                          onClick={() => setSelectedType(type)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            cursor: 'pointer',
                            background: isActive ? BT.bg.active : 'transparent',
                            border: isActive ? `1px solid ${BT.text.cyan}` : '1px solid transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => { e.stopPropagation(); toggleType(type.type_key); }}
                            style={{ accentColor: BT.text.cyan }}
                          />
                          <LucideIcon name={type.icon} style={{ width: 16, height: 16, color: isSelected ? accent : BT.text.muted, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, flex: 1, fontWeight: isSelected ? 600 : 400, color: isSelected ? BT.text.primary : BT.text.secondary }}>{type.display_name}</span>
                          {isSelected && <CheckCircle2 style={{ width: 14, height: 14, color: BT.text.green, flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: '50%', overflowY: 'auto', padding: 16, background: BT.bg.terminal }}>
          {selectedType ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ padding: 10, background: BT.bg.panelAlt }}>
                    <LucideIcon name={selectedType.icon} style={{ width: 28, height: 28, color: CATEGORY_ACCENT[selectedType.category] || BT.text.cyan }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>{selectedType.display_name}</span>
                      <span style={{ padding: '2px 8px', fontSize: 9, fontWeight: 600, color: CATEGORY_ACCENT[selectedType.category] || BT.text.cyan, background: BT.bg.panelAlt, ...mono }}>{selectedType.category}</span>
                    </div>
                    <p style={{ fontSize: 12, color: BT.text.secondary }}>{selectedType.description}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, marginBottom: 10 }}>Applicable Investment Strategies</h4>

                {loadingStrategies ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                    <div style={{ height: 24, width: 24, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : strategies.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {strategies.map((strategy) => {
                      const sc = strengthColors[strategy.strength || 'weak'];
                      return (
                        <div key={strategy.slug} style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: BT.text.primary }}>{strategy.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 9, fontWeight: 600, color: sc.color, background: BT.bg.panelAlt, ...mono }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                              {strategy.strength?.charAt(0).toUpperCase()}{strategy.strength?.slice(1)}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 4 }}>{strategy.description}</p>
                          {strategy.rationale && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BT.border.subtle}` }}>
                              <p style={{ fontSize: 10, color: BT.text.muted, fontStyle: 'italic' }}>
                                <strong>Rationale:</strong> {strategy.rationale}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 48, color: BT.text.muted, fontSize: 12 }}>
                    No strategies available for this property type.
                  </div>
                )}
              </div>

              {strategies.length > 0 && (
                <div style={{ padding: 14, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.secondary, marginBottom: 8 }}>Strategy Strength Guide</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                    {[
                      { key: 'strong', label: 'Strong', desc: 'Highly applicable, proven track record' },
                      { key: 'moderate', label: 'Moderate', desc: 'Can work with right conditions' },
                      { key: 'weak', label: 'Weak', desc: 'Limited applicability or high challenges' },
                    ].map(item => (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: strengthColors[item.key].dot, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: BT.text.secondary }}><strong style={{ color: BT.text.primary }}>{item.label}:</strong> {item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <Building2 style={{ width: 48, height: 48, color: BT.text.muted, margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: BT.text.secondary }}>Select a property type</div>
                <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>Click on any property type to view applicable strategies</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${BT.border.subtle}`, background: BT.bg.panel }}>
        {saveMessage && (
          <div style={{
            padding: '8px 14px',
            fontSize: 12,
            marginBottom: 10,
            background: BT.bg.panelAlt,
            color: saveMessage.type === 'success' ? BT.text.green : BT.text.red,
            border: `1px solid ${saveMessage.type === 'success' ? BT.text.green : BT.text.red}`,
          }}>
            {saveMessage.text}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>
            {selectedTypes.length} property type{selectedTypes.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleSave}
            disabled={saving || selectedTypes.length === 0}
            style={{
              padding: '8px 20px',
              background: saving || selectedTypes.length === 0 ? BT.bg.active : BT.text.cyan,
              color: saving || selectedTypes.length === 0 ? BT.text.muted : BT.bg.terminal,
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: saving || selectedTypes.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              ...mono,
            }}
          >
            {saving ? (
              <>
                <div style={{ height: 14, width: 14, border: '2px solid transparent', borderBottom: `2px solid ${BT.bg.terminal}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
