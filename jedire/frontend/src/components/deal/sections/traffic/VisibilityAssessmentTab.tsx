import { useState, useEffect } from 'react';
import {
  Eye, Save, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface VisibilityAssessmentTabProps {
  dealId: string;
  propertyId?: string;
}

interface AssessmentForm {
  is_corner: boolean;
  corner_type: string;
  intersection_type: string;
  distance_to_light_feet: number;
  frontage_feet: number;
  setback_feet: number;
  building_stories: number;
  elevation_vs_street_feet: number;
  sightline_north_feet: number;
  sightline_south_feet: number;
  sightline_east_feet: number;
  sightline_west_feet: number;
  obstruction_trees_pct: number;
  obstruction_buildings_pct: number;
  obstruction_street_furniture_pct: number;
  obstruction_parked_cars_pct: number;
  obstruction_topography_pct: number;
  has_signage: boolean;
  signage_size_sq_ft: number;
  signage_type: string;
  signage_is_lit: boolean;
  signage_visible_from_feet: number;
  glass_to_wall_ratio: number;
  interior_visible: boolean;
  has_window_displays: boolean;
  entrance_type: string;
  has_glass_doors: boolean;
  has_overhang: boolean;
  entrance_count: number;
  is_ada_compliant: boolean;
  facade_condition: string;
  architectural_distinctiveness: string;
  color_contrast_vs_neighbors: string;
}

const defaultForm: AssessmentForm = {
  is_corner: false, corner_type: '', intersection_type: '', distance_to_light_feet: 0,
  frontage_feet: 50, setback_feet: 10, building_stories: 1, elevation_vs_street_feet: 0,
  sightline_north_feet: 200, sightline_south_feet: 200, sightline_east_feet: 200, sightline_west_feet: 200,
  obstruction_trees_pct: 0, obstruction_buildings_pct: 0, obstruction_street_furniture_pct: 0,
  obstruction_parked_cars_pct: 0, obstruction_topography_pct: 0,
  has_signage: false, signage_size_sq_ft: 0, signage_type: '', signage_is_lit: false, signage_visible_from_feet: 0,
  glass_to_wall_ratio: 0.3, interior_visible: false, has_window_displays: false,
  entrance_type: 'standard', has_glass_doors: false, has_overhang: false, entrance_count: 1, is_ada_compliant: true,
  facade_condition: 'good', architectural_distinctiveness: 'moderate', color_contrast_vs_neighbors: 'moderate',
};

interface PreviewScores {
  overall_visibility_score: number;
  visibility_tier: string;
  capture_rate: number;
  positional_score: number;
  sightline_score: number;
  setback_score: number;
  signage_score: number;
  transparency_score: number;
  entrance_score: number;
  obstruction_penalty: number;
}

function SliderField({ label, value, onChange, max = 100 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-stone-600">{label}</label>
        <span className="text-xs font-mono text-stone-700">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div>
      <label className="text-xs text-stone-600 block mb-1">{label}{unit && <span className="text-stone-400 ml-1">({unit})</span>}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div>
      <label className="text-xs text-stone-600 block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-stone-300" />
      <span className="text-xs text-stone-700">{label}</span>
    </label>
  );
}

function ScoreBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-stone-500 w-24 truncate">{label}</span>
      <div className="flex-1 bg-stone-100 rounded-full h-2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-stone-700 w-6 text-right">{score}</span>
    </div>
  );
}

export default function VisibilityAssessmentTab({ dealId, propertyId }: VisibilityAssessmentTabProps) {
  const [form, setForm] = useState<AssessmentForm>(defaultForm);
  const [preview, setPreview] = useState<PreviewScores | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [resolvedPropertyId, setResolvedPropertyId] = useState(propertyId || '');

  useEffect(() => {
    if (!dealId) return;
    if (!resolvedPropertyId) {
      apiClient.get(`/api/v1/leasing-traffic/data-sources/${dealId}`)
        .then(res => {
          if (res.data.property_id) setResolvedPropertyId(res.data.property_id);
        })
        .catch(() => {});
      return;
    }
    apiClient.get(`/api/v1/visibility/assessment/${resolvedPropertyId}`)
      .then(res => {
        if (res.data && res.data.property_id) {
          const d = res.data;
          setForm({
            is_corner: d.is_corner || false, corner_type: d.corner_type || '', intersection_type: d.intersection_type || '',
            distance_to_light_feet: d.distance_to_light_feet || 0, frontage_feet: d.frontage_feet || 50,
            setback_feet: d.setback_feet || 10, building_stories: d.building_stories || 1,
            elevation_vs_street_feet: d.elevation_vs_street_feet || 0,
            sightline_north_feet: d.sightline_north_feet || 200, sightline_south_feet: d.sightline_south_feet || 200,
            sightline_east_feet: d.sightline_east_feet || 200, sightline_west_feet: d.sightline_west_feet || 200,
            obstruction_trees_pct: d.obstruction_trees_pct || 0, obstruction_buildings_pct: d.obstruction_buildings_pct || 0,
            obstruction_street_furniture_pct: d.obstruction_street_furniture_pct || 0,
            obstruction_parked_cars_pct: d.obstruction_parked_cars_pct || 0, obstruction_topography_pct: d.obstruction_topography_pct || 0,
            has_signage: d.has_signage || false, signage_size_sq_ft: d.signage_size_sq_ft || 0,
            signage_type: d.signage_type || '', signage_is_lit: d.signage_is_lit || false,
            signage_visible_from_feet: d.signage_visible_from_feet || 0, glass_to_wall_ratio: d.glass_to_wall_ratio || 0.3,
            interior_visible: d.interior_visible || false, has_window_displays: d.has_window_displays || false,
            entrance_type: d.entrance_type || 'standard', has_glass_doors: d.has_glass_doors || false,
            has_overhang: d.has_overhang || false, entrance_count: d.entrance_count || 1,
            is_ada_compliant: d.is_ada_compliant !== false, facade_condition: d.facade_condition || 'good',
            architectural_distinctiveness: d.architectural_distinctiveness || 'moderate',
            color_contrast_vs_neighbors: d.color_contrast_vs_neighbors || 'moderate',
          });
          setHasExisting(true);
          setPreview({
            overall_visibility_score: d.overall_visibility_score, visibility_tier: d.visibility_tier,
            capture_rate: d.capture_rate || 0, positional_score: d.positional_score || 0,
            sightline_score: d.sightline_score || 0, setback_score: d.setback_score || 0,
            signage_score: d.signage_score || 0, transparency_score: d.transparency_score || 0,
            entrance_score: d.entrance_score || 0, obstruction_penalty: d.obstruction_penalty || 0,
          });
        }
      })
      .catch(() => {});
  }, [dealId, resolvedPropertyId]);

  const update = (key: keyof AssessmentForm, value: any) => {
    const next = { ...form, [key]: value };
    setForm(next);
    setSaved(false);
    apiClient.post('/api/v1/visibility/preview', next)
      .then(res => setPreview(res.data))
      .catch(() => {});
  };

  const handleSave = async () => {
    if (!resolvedPropertyId) return;
    setSaving(true);
    try {
      const endpoint = hasExisting ? `/api/v1/visibility/update/${resolvedPropertyId}` : '/api/v1/visibility/assess';
      const method = hasExisting ? 'put' : 'post';
      await apiClient[method](endpoint, { property_id: resolvedPropertyId, ...form });
      setSaved(true);
      setHasExisting(true);
    } catch (err) {
      console.error('[Visibility] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!resolvedPropertyId) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <AlertCircle size={32} className="mx-auto text-stone-300 mb-3" />
        <p className="text-sm text-stone-500">No property linked to this deal. Add a property to assess visibility.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
            <Eye size={14} /> Positional Attributes
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <CheckboxField label="Corner Property" checked={form.is_corner} onChange={v => update('is_corner', v)} />
            <SelectField label="Intersection Type" value={form.intersection_type} onChange={v => update('intersection_type', v)}
              options={[{ value: '', label: 'Select...' }, { value: 'signalized', label: 'Signalized' }, { value: 'stop_sign', label: 'Stop Sign' }, { value: 'uncontrolled', label: 'Uncontrolled' }, { value: 'roundabout', label: 'Roundabout' }]} />
            <NumberField label="Distance to Traffic Light" value={form.distance_to_light_feet} onChange={v => update('distance_to_light_feet', v)} unit="ft" />
            {form.is_corner && (
              <SelectField label="Corner Type" value={form.corner_type} onChange={v => update('corner_type', v)}
                options={[{ value: '', label: 'Select...' }, { value: 'hard', label: 'Hard Corner' }, { value: 'soft', label: 'Soft Corner' }, { value: 'outparcel', label: 'Outparcel' }]} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Sightlines (Distance Visible)</h4>
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="North" value={form.sightline_north_feet} onChange={v => update('sightline_north_feet', v)} unit="ft" />
            <NumberField label="South" value={form.sightline_south_feet} onChange={v => update('sightline_south_feet', v)} unit="ft" />
            <NumberField label="East" value={form.sightline_east_feet} onChange={v => update('sightline_east_feet', v)} unit="ft" />
            <NumberField label="West" value={form.sightline_west_feet} onChange={v => update('sightline_west_feet', v)} unit="ft" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Physical Attributes</h4>
          <div className="grid grid-cols-3 gap-4">
            <NumberField label="Frontage" value={form.frontage_feet} onChange={v => update('frontage_feet', v)} unit="ft" />
            <NumberField label="Setback" value={form.setback_feet} onChange={v => update('setback_feet', v)} unit="ft" />
            <NumberField label="Stories" value={form.building_stories} onChange={v => update('building_stories', v)} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Obstructions</h4>
          <div className="space-y-3">
            <SliderField label="Trees" value={form.obstruction_trees_pct} onChange={v => update('obstruction_trees_pct', v)} />
            <SliderField label="Buildings" value={form.obstruction_buildings_pct} onChange={v => update('obstruction_buildings_pct', v)} />
            <SliderField label="Street Furniture" value={form.obstruction_street_furniture_pct} onChange={v => update('obstruction_street_furniture_pct', v)} />
            <SliderField label="Parked Cars" value={form.obstruction_parked_cars_pct} onChange={v => update('obstruction_parked_cars_pct', v)} />
            <SliderField label="Topography" value={form.obstruction_topography_pct} onChange={v => update('obstruction_topography_pct', v)} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Signage</h4>
          <div className="space-y-4">
            <CheckboxField label="Has Signage" checked={form.has_signage} onChange={v => update('has_signage', v)} />
            {form.has_signage && (
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Sign Size" value={form.signage_size_sq_ft} onChange={v => update('signage_size_sq_ft', v)} unit="sq ft" />
                <SelectField label="Sign Type" value={form.signage_type} onChange={v => update('signage_type', v)}
                  options={[{ value: '', label: 'Select...' }, { value: 'monument', label: 'Monument' }, { value: 'pylon', label: 'Pylon' }, { value: 'wall', label: 'Wall Mount' }, { value: 'awning', label: 'Awning' }, { value: 'digital', label: 'Digital' }]} />
                <CheckboxField label="Illuminated" checked={form.signage_is_lit} onChange={v => update('signage_is_lit', v)} />
                <NumberField label="Visible From" value={form.signage_visible_from_feet} onChange={v => update('signage_visible_from_feet', v)} unit="ft" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Storefront & Entrance</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-stone-600 block mb-1">Glass-to-Wall Ratio</label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.glass_to_wall_ratio * 100}
                onChange={e => update('glass_to_wall_ratio', parseInt(e.target.value) / 100)}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
              />
              <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                <span>0%</span>
                <span className="font-mono">{(form.glass_to_wall_ratio * 100).toFixed(0)}%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <CheckboxField label="Interior Visible" checked={form.interior_visible} onChange={v => update('interior_visible', v)} />
              <CheckboxField label="Window Displays" checked={form.has_window_displays} onChange={v => update('has_window_displays', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Entrance Type" value={form.entrance_type} onChange={v => update('entrance_type', v)}
                options={[{ value: 'standard', label: 'Standard' }, { value: 'recessed', label: 'Recessed' }, { value: 'flush', label: 'Flush' }, { value: 'vestibule', label: 'Vestibule' }, { value: 'lobby', label: 'Lobby' }]} />
              <NumberField label="Entrance Count" value={form.entrance_count} onChange={v => update('entrance_count', v)} />
              <CheckboxField label="Glass Doors" checked={form.has_glass_doors} onChange={v => update('has_glass_doors', v)} />
              <CheckboxField label="ADA Compliant" checked={form.is_ada_compliant} onChange={v => update('is_ada_compliant', v)} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Architectural Character</h4>
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Facade Condition" value={form.facade_condition} onChange={v => update('facade_condition', v)}
              options={[{ value: 'excellent', label: 'Excellent' }, { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'poor', label: 'Poor' }]} />
            <SelectField label="Distinctiveness" value={form.architectural_distinctiveness} onChange={v => update('architectural_distinctiveness', v)}
              options={[{ value: 'iconic', label: 'Iconic' }, { value: 'distinctive', label: 'Distinctive' }, { value: 'moderate', label: 'Moderate' }, { value: 'generic', label: 'Generic' }]} />
            <SelectField label="Color Contrast" value={form.color_contrast_vs_neighbors} onChange={v => update('color_contrast_vs_neighbors', v)}
              options={[{ value: 'high', label: 'High' }, { value: 'moderate', label: 'Moderate' }, { value: 'low', label: 'Low' }, { value: 'blends_in', label: 'Blends In' }]} />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <><CheckCircle2 size={16} /> Assessment Saved</>
          ) : (
            <><Save size={16} /> Save Assessment</>
          )}
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5 sticky top-6">
          <h4 className="text-sm font-bold text-stone-900 mb-4">Live Score Preview</h4>
          {preview ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-stone-900">{preview.overall_visibility_score}</div>
                <span className={`text-xs px-3 py-1 rounded-full font-mono mt-2 inline-block ${
                  preview.visibility_tier === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                  preview.visibility_tier === 'Good' ? 'bg-blue-100 text-blue-700' :
                  preview.visibility_tier === 'Fair' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{preview.visibility_tier}</span>
              </div>

              <div className="bg-stone-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-stone-500 uppercase">Derived Capture Rate</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">{(preview.capture_rate * 100).toFixed(1)}%</div>
              </div>

              <div className="space-y-2">
                <ScoreBar label="Positional" score={preview.positional_score} />
                <ScoreBar label="Sightline" score={preview.sightline_score} />
                <ScoreBar label="Setback" score={preview.setback_score} />
                <ScoreBar label="Signage" score={preview.signage_score} />
                <ScoreBar label="Transparency" score={preview.transparency_score} />
                <ScoreBar label="Entrance" score={preview.entrance_score} />
                <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                  <span className="text-[10px] text-red-500 w-24">Obstruction</span>
                  <div className="flex-1 bg-stone-100 rounded-full h-2">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${preview.obstruction_penalty}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-red-500 w-6 text-right">-{preview.obstruction_penalty}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Eye size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs text-stone-400">Fill in the form to see live score preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
