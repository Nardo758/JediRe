import React, { useEffect, useState } from 'react';
import type { SiteCriteria, SiteCounty } from '../../../../shared/site-finder';
import { SITE_COUNTIES } from '../../../../shared/site-finder';

export interface SiteFinderCatalog {
  propertyTypes: { type_key: string; display_name: string; category: string }[];
  counties: string[];
}

interface Props {
  criteria: SiteCriteria;
  setCriteria: React.Dispatch<React.SetStateAction<SiteCriteria>>;
  catalog: SiteFinderCatalog | null;
  busy: boolean;
  onRun: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', border: '1px solid var(--sf-border)',
  background: 'var(--sf-input)', color: 'var(--sf-text)', padding: '9px 10px',
  fontFamily: 'var(--sf-mono)', fontSize: 11, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--sf-muted)', fontSize: 9, letterSpacing: 1,
  fontWeight: 700, textTransform: 'uppercase', marginBottom: 6,
};

export function SiteFinderWidget({ criteria, setCriteria, catalog, busy, onRun }: Props) {
  const [areaUnit, setAreaUnit] = useState<NonNullable<SiteCriteria['area']>['unit']>(criteria.area?.unit ?? 'acres');
  const [minInclusive, setMinInclusive] = useState(criteria.area?.minInclusive ?? true);
  const [maxInclusive, setMaxInclusive] = useState(criteria.area?.maxInclusive ?? true);
  const [zoningCode, setZoningCode] = useState(criteria.zoning?.code ?? '');
  const [zoningJurisdiction, setZoningJurisdiction] = useState(criteria.zoning?.jurisdiction ?? '');
  const patch = (next: Partial<SiteCriteria>) => setCriteria(current => ({ ...current, ...next }));
  useEffect(() => {
    setAreaUnit(criteria.area?.unit ?? 'acres');
    setMinInclusive(criteria.area?.minInclusive ?? true);
    setMaxInclusive(criteria.area?.maxInclusive ?? true);
  }, [criteria.area?.unit, criteria.area?.minInclusive, criteria.area?.maxInclusive]);
  useEffect(() => {
    setZoningCode(criteria.zoning?.code ?? '');
    setZoningJurisdiction(criteria.zoning?.jurisdiction ?? '');
  }, [criteria.zoning?.code, criteria.zoning?.jurisdiction]);
  const toggleCounty = (county: SiteCounty) => {
    const current = criteria.counties;
    patch({ counties: current.includes(county) ? current.filter(value => value !== county) : [...current, county] });
  };
  const area = criteria.area ?? { unit: areaUnit, minInclusive, maxInclusive };
  const zoningIncomplete = Boolean(zoningCode.trim()) !== Boolean(zoningJurisdiction.trim());
  const setArea = (next: Partial<NonNullable<SiteCriteria['area']>>) => {
    if (next.unit) setAreaUnit(next.unit);
    if (next.minInclusive !== undefined) setMinInclusive(next.minInclusive);
    if (next.maxInclusive !== undefined) setMaxInclusive(next.maxInclusive);
    setCriteria(current => {
      const prior = current.area;
      const updated = {
        unit: next.unit ?? prior?.unit ?? areaUnit,
        min: Object.prototype.hasOwnProperty.call(next, 'min') ? next.min : prior?.min,
        max: Object.prototype.hasOwnProperty.call(next, 'max') ? next.max : prior?.max,
        minInclusive: next.minInclusive ?? prior?.minInclusive ?? minInclusive,
        maxInclusive: next.maxInclusive ?? prior?.maxInclusive ?? maxInclusive,
      };
      if (updated.min === undefined && updated.max === undefined) {
        const withoutArea = { ...current };
        delete withoutArea.area;
        return withoutArea;
      }
      return { ...current, area: updated };
    });
  };
  const updateZoning = (code: string, jurisdiction: string) => {
    setZoningCode(code);
    setZoningJurisdiction(jurisdiction);
    setCriteria(current => {
      if (code.trim() && jurisdiction.trim()) return { ...current, zoning: { code: code.trim(), jurisdiction: jurisdiction.trim() } };
      const withoutZoning = { ...current };
      delete withoutZoning.zoning;
      return withoutZoning;
    });
  };
  const field = (label: string, child: React.ReactNode) => <div><label style={labelStyle}>{label}</label>{child}</div>;

  return <section className="sf-panel">
    <div className="sf-panel-head"><div><span className="sf-eyebrow">02 / OPTIONAL STRUCTURED FILTERS</span><h2>Site Finder</h2></div><span className="sf-panel-index">SFL · 02</span></div>
    <div className="sf-search-form">
      <div className="sf-grid sf-grid-two">
        {field('Property type · assessor category', <select style={inputStyle} value={criteria.propertyType ?? ''} onChange={e => patch({ propertyType: e.target.value || undefined, typeSemantics: e.target.value ? criteria.typeSemantics ?? 'current' : undefined })}>
          <option value="">Any catalog type</option>
          {[...new Set(catalog?.propertyTypes.map(item=>item.category) || [])].map(category => <option key={category} value={`category:${category}`}>All {category} catalog types</option>)}
          {catalog?.propertyTypes.map(item => <option key={item.type_key} value={item.type_key}>{item.display_name} · {item.category}</option>)}
        </select>)}
        {field('Type semantics', <div className="sf-segment">
          <button type="button" disabled={!criteria.propertyType} className={criteria.typeSemantics !== 'proposed' ? 'selected' : ''} onClick={() => patch({ typeSemantics: 'current' })}>Current use</button>
          <button type="button" disabled={!criteria.propertyType} className={criteria.typeSemantics === 'proposed' ? 'selected' : ''} onClick={() => patch({ typeSemantics: 'proposed' })}>Proposed use</button>
        </div>)}
      </div>
      {field('Intended use · describe the specific program', <input style={inputStyle} value={criteria.intendedUse ?? ''} onChange={e => patch({ intendedUse: e.target.value || undefined })} placeholder="e.g. independent senior housing" />)}
      <p className="sf-hint">Keep proposed permission distinct from the parcel’s current assessor classification. “Senior living” needs a precise use such as assisted living or independent senior housing.</p>

      <div className="sf-grid sf-grid-two">
        {field('Zoning code', <input style={inputStyle} value={zoningCode} onChange={e => updateZoning(e.target.value, zoningJurisdiction)} placeholder="Authority-specific code" />)}
        {field('Zoning jurisdiction', <input style={inputStyle} value={zoningJurisdiction} onChange={e => updateZoning(zoningCode, e.target.value)} placeholder="Municipality / authority" />)}
      </div>
      {zoningIncomplete && <p className="sf-hint">A zoning code must be paired with its jurisdiction. Complete both values or clear the partial entry before running.</p>}
      <div className="sf-grid sf-grid-two sf-area-row">
        {field('Parcel area · minimum', <div className="sf-inline-field"><input type="number" min="0" style={inputStyle} value={criteria.area?.min ?? ''} onChange={e => setArea({ min: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="No minimum" /><select aria-label="Minimum boundary" style={inputStyle} value={area.minInclusive ? 'inclusive' : 'exclusive'} onChange={e => setArea({ minInclusive: e.target.value === 'inclusive' })}><option value="inclusive">≥</option><option value="exclusive">&gt;</option></select></div>)}
        {field('Parcel area · maximum', <div className="sf-inline-field"><input type="number" min="0" style={inputStyle} value={criteria.area?.max ?? ''} onChange={e => setArea({ max: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="No maximum" /><select aria-label="Maximum boundary" style={inputStyle} value={area.maxInclusive ? 'inclusive' : 'exclusive'} onChange={e => setArea({ maxInclusive: e.target.value === 'inclusive' })}><option value="inclusive">≤</option><option value="exclusive">&lt;</option></select></div>)}
      </div>
      {field('Area unit', <div className="sf-segment sf-unit">
        <button type="button" className={areaUnit === 'acres' ? 'selected' : ''} onClick={() => setArea({ unit: 'acres' })}>Acres</button>
        <button type="button" className={areaUnit === 'sqft' ? 'selected' : ''} onClick={() => setArea({ unit: 'sqft' })}>Square feet</button>
      </div>)}

      <div className="sf-field">
        <label style={labelStyle}>County coverage</label>
        <div className="sf-county-list">{SITE_COUNTIES.map(county => <button type="button" key={county} className={`sf-county ${criteria.counties.includes(county) ? 'active' : ''}`} onClick={() => toggleCounty(county)}><span className="sf-checkbox">{criteria.counties.includes(county) ? '✓' : ''}</span>{county}</button>)}</div>
        <div className="sf-grid sf-grid-two sf-municipality">
          {field('Optional municipality', <input style={inputStyle} value={criteria.municipality ?? ''} onChange={e => patch({ municipality: e.target.value || undefined })} placeholder="Any municipality" />)}
          {field('Result cap per county', <select style={inputStyle} value={criteria.limit} onChange={e => patch({ limit: Number(e.target.value) })}>{[25, 50, 100].map(value => <option key={value} value={value}>{value} parcels</option>)}</select>)}
        </div>
      </div>
      <div className="sf-field">{field('Situs address contains · optional', <input style={inputStyle} value={criteria.addressText ?? ''} onChange={e => patch({ addressText: e.target.value.trim() || undefined })} placeholder="Literal situs address substring" />)}</div>
      <button type="button" className="sf-run-button" onClick={onRun} disabled={busy || criteria.counties.length === 0 || zoningIncomplete}>
        <span>{busy ? 'SCREENING SOURCES…' : 'RUN PARCEL SCREEN'}</span><span aria-hidden="true">↗</span>
      </button>
      <div className="sf-disclaimer">Preliminary screening only. Not legal zoning, licensing, availability, or for-sale advice.</div>
    </div>
  </section>;
}

export default SiteFinderWidget;