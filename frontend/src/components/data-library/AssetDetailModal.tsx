/**
 * Asset Detail Modal
 * 
 * Pops up after custom-label uploads to let users fill in key property details.
 * This enables proper categorization for the underwriting agent to use as comps.
 */

import React, { useState } from 'react';
import { X, Building2, MapPin, DollarSign, Percent, Calendar, Layers, CheckCircle } from 'lucide-react';
import { apiClient } from '../../services/api.client';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const C = {
  bg: '#0F1117',
  panel: '#161B27',
  input: '#1A2236',
  border: '#1E2D45',
  borderHover: '#2A3F5F',
  amber: '#F5A623',
  cyan: '#00BCD4',
  green: '#00D26A',
  red: '#FF4757',
  muted: '#475569',
  secondary: '#94A3B8',
  primary: '#E2E8F0',
};

interface AssetDetailModalProps {
  assetId: string;
  customLabel: string;
  onClose: () => void;
  onSave: () => void;
}

interface AssetDetails {
  propertyName: string;
  address: string;
  city: string;
  state: string;
  propertyType: string;
  assetClass: string;
  dealType: string;
  units: string;
  yearBuilt: string;
  stories: string;
  avgRent: string;
  occupancyPct: string;
  capRate: string;
  askingPrice: string;
  noi: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const PROPERTY_TYPES = [
  { value: 'garden', label: 'Garden (1-3 stories)' },
  { value: 'mid-rise', label: 'Mid-Rise (4-6 stories)' },
  { value: 'high-rise', label: 'High-Rise (7+ stories)' },
  { value: 'mixed-use', label: 'Mixed-Use' },
  { value: 'townhome', label: 'Townhome / Build-to-Rent' },
  { value: 'senior', label: 'Senior Living' },
  { value: 'student', label: 'Student Housing' },
];

const ASSET_CLASSES = [
  { value: 'A', label: 'Class A — Luxury / New Construction' },
  { value: 'B', label: 'Class B — Market Rate / Well-Maintained' },
  { value: 'C', label: 'Class C — Workforce / Value-Add Opportunity' },
  { value: 'D', label: 'Class D — Distressed / Heavy Lift' },
];

const DEAL_TYPES = [
  { value: 'stabilized', label: 'Stabilized — 90%+ occupancy' },
  { value: 'value-add', label: 'Value-Add — Renovation / Repositioning' },
  { value: 'lease-up', label: 'Lease-Up — New construction filling' },
  { value: 'development', label: 'Development — Ground-up or entitled' },
  { value: 'distressed', label: 'Distressed — REO / Foreclosure' },
];

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  customLabel,
  onClose,
  onSave,
}) => {
  const [details, setDetails] = useState<AssetDetails>({
    propertyName: customLabel,
    address: '',
    city: '',
    state: '',
    propertyType: '',
    assetClass: '',
    dealType: '',
    units: '',
    yearBuilt: '',
    stories: '',
    avgRent: '',
    occupancyPct: '',
    capRate: '',
    askingPrice: '',
    noi: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateField = (field: keyof AssetDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const calculateDQScore = (): number => {
    let score = 0;
    // Required fields (10 pts each, max 50)
    if (details.city && details.state) score += 10;
    if (details.propertyType) score += 10;
    if (details.assetClass) score += 10;
    if (details.units) score += 10;
    if (details.yearBuilt) score += 10;
    // Financial fields (10 pts each, max 50)
    if (details.avgRent) score += 10;
    if (details.occupancyPct) score += 10;
    if (details.capRate || details.noi) score += 10;
    if (details.askingPrice) score += 10;
    if (details.dealType) score += 10;
    return Math.min(score, 100);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Build the update payload
      const payload: Record<string, unknown> = {
        property_name: details.propertyName || customLabel,
        address: details.address || null,
        city: details.city || null,
        state: details.state || null,
        property_type: details.propertyType || null,
        asset_class: details.assetClass || null,
        deal_type: details.dealType || null,
        unit_count: details.units ? parseInt(details.units) : null,
        year_built: details.yearBuilt ? parseInt(details.yearBuilt) : null,
        stories: details.stories ? parseInt(details.stories) : null,
        avg_rent: details.avgRent ? parseFloat(details.avgRent) : null,
        occupancy_pct: details.occupancyPct ? parseFloat(details.occupancyPct) / 100 : null,
        cap_rate: details.capRate ? parseFloat(details.capRate) / 100 : null,
        sale_price: details.askingPrice ? parseFloat(details.askingPrice.replace(/,/g, '')) : null,
        noi: details.noi ? parseFloat(details.noi.replace(/,/g, '')) : null,
        data_quality_score: calculateDQScore(),
      };

      // Calculate vintage band
      if (details.yearBuilt) {
        const year = parseInt(details.yearBuilt);
        if (year < 1980) payload.vintage_band = 'pre-1980';
        else if (year < 2000) payload.vintage_band = '1980-1999';
        else if (year < 2010) payload.vintage_band = '2000-2009';
        else if (year < 2020) payload.vintage_band = '2010-2019';
        else payload.vintage_band = '2020+';
      }

      // Calculate unit count band
      if (details.units) {
        const units = parseInt(details.units);
        if (units < 100) payload.unit_count_band = '<100';
        else if (units < 200) payload.unit_count_band = '100-199';
        else if (units < 300) payload.unit_count_band = '200-299';
        else if (units < 400) payload.unit_count_band = '300-399';
        else payload.unit_count_band = '400+';
      }

      await apiClient.patch(`/api/v1/data-library-assets/${assetId}`, payload);
      setSuccess(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: C.input,
    border: `1px solid ${C.border}`,
    color: C.primary,
    fontFamily: MONO,
    fontSize: 11,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 9,
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };

  const dqScore = calculateDQScore();
  const dqColor = dqScore >= 70 ? C.green : dqScore >= 40 ? C.amber : C.red;

  if (success) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{
          background: C.panel, border: `1px solid ${C.green}`, padding: 40,
          textAlign: 'center', maxWidth: 400,
        }}>
          <CheckCircle size={48} style={{ color: C.green, marginBottom: 16 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 8 }}>
            Asset Details Saved!
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Data Quality Score: <span style={{ color: dqColor, fontWeight: 700 }}>{dqScore}</span>/100
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.panel, border: `1px solid ${C.border}`,
          maxWidth: 600, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.bg,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, letterSpacing: 0.5, fontFamily: MONO }}>
              ADD ASSET DETAILS
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              Fill in property details for better comp matching
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* DQ Score Preview */}
        <div style={{
          padding: '10px 18px', background: `${dqColor}11`, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 10, color: C.secondary }}>
            Data Quality Score
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 6, background: C.input, borderRadius: 3 }}>
              <div style={{ width: `${dqScore}%`, height: '100%', background: dqColor, borderRadius: 3, transition: 'all 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: dqColor, fontFamily: MONO }}>{dqScore}</span>
          </div>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: `${C.red}18`, border: `1px solid ${C.red}44`, fontSize: 11, color: '#FCA5A5' }}>
              {error}
            </div>
          )}

          {/* Property Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
              Property Name
            </label>
            <input
              value={details.propertyName}
              onChange={e => updateField('propertyName', e.target.value)}
              placeholder="e.g. The Arbors at Midtown"
              style={inputStyle}
            />
          </div>

          {/* Location Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />
                City
              </label>
              <input
                value={details.city}
                onChange={e => updateField('city', e.target.value)}
                placeholder="Atlanta"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Address</label>
              <input
                value={details.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="123 Main St"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <select value={details.state} onChange={e => updateField('state', e.target.value)} style={selectStyle}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Property Classification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <Layers size={10} style={{ display: 'inline', marginRight: 4 }} />
                Property Type
              </label>
              <select value={details.propertyType} onChange={e => updateField('propertyType', e.target.value)} style={selectStyle}>
                <option value="">Select type...</option>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Asset Class</label>
              <select value={details.assetClass} onChange={e => updateField('assetClass', e.target.value)} style={selectStyle}>
                <option value="">Select class...</option>
                {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Deal Type</label>
            <select value={details.dealType} onChange={e => updateField('dealType', e.target.value)} style={selectStyle}>
              <option value="">Select deal type...</option>
              {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Physical Attributes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>
                <Building2 size={10} style={{ display: 'inline', marginRight: 4 }} />
                Units
              </label>
              <input
                type="number"
                value={details.units}
                onChange={e => updateField('units', e.target.value)}
                placeholder="200"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Calendar size={10} style={{ display: 'inline', marginRight: 4 }} />
                Year Built
              </label>
              <input
                type="number"
                value={details.yearBuilt}
                onChange={e => updateField('yearBuilt', e.target.value)}
                placeholder="1998"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Stories</label>
              <input
                type="number"
                value={details.stories}
                onChange={e => updateField('stories', e.target.value)}
                placeholder="3"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Financial Metrics */}
          <div style={{ fontSize: 10, fontWeight: 600, color: C.amber, marginBottom: 10, marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={12} />
            FINANCIAL METRICS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Avg Rent ($/unit/mo)</label>
              <input
                type="number"
                value={details.avgRent}
                onChange={e => updateField('avgRent', e.target.value)}
                placeholder="1,450"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Percent size={10} style={{ display: 'inline', marginRight: 4 }} />
                Occupancy %
              </label>
              <input
                type="number"
                value={details.occupancyPct}
                onChange={e => updateField('occupancyPct', e.target.value)}
                placeholder="94"
                max={100}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Cap Rate %</label>
              <input
                type="number"
                value={details.capRate}
                onChange={e => updateField('capRate', e.target.value)}
                placeholder="5.25"
                step="0.01"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Asking Price ($)</label>
              <input
                value={details.askingPrice}
                onChange={e => updateField('askingPrice', e.target.value)}
                placeholder="25,000,000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>NOI ($)</label>
              <input
                value={details.noi}
                onChange={e => updateField('noi', e.target.value)}
                placeholder="1,312,500"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.bg,
        }}>
          <div style={{ fontSize: 9, color: C.muted }}>
            Fill in more fields to improve comp matching accuracy
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', background: 'transparent',
                border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
            >
              SKIP
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px', background: C.green,
                border: 'none', color: '#000',
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'SAVING...' : 'SAVE DETAILS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal;
