/**
 * ProgrammingTab — F3 Market → Programming sub-tab for defining approved program targets.
 *
 * This is where the acquisitions/development user sets:
 *   - Unit count, GFA, FAR, floors, height, parking ratio
 *   - Unit mix % (studio/1BR/2BR/3BR)
 *   - Approved amenities (checkboxes + custom)
 *   - Construction budget
 *
 * These targets flow into F7 DesignTargetsPanel sidebar.
 *
 * Persistence: on mount, hydrates from the backend via loadProgram(dealId).
 * On any change, debounces a PUT call via saveProgram(dealId) so the program
 * survives page refresh and the "Import from F3" button in UnitMixTab always
 * reflects the latest saved data.
 *
 * Layout (minimalist, matches Bloomberg terminal aesthetic):
 * ┌─── TARGETS ───────────────────────────────────────────────┐
 * │  Units      [ 280  ]  max 320 from zoning                │
 * │  GFA (sf)   [300000]  max 350000                         │
 * │  FAR        [  3.0 ]  max 3.5                            │
 * │  Floors     [   8  ]  max 10                             │
 * │  Height (ft)[  85  ]  max 110                            │
 * │  Parking    [  1.5 ]  spaces/unit                        │
 * ├─── UNIT MIX ───────────────────────────────────────────────┤
 * │  Studio  [10]%  1BR [40]%  2BR [35]%  3BR [15]%  = 100% │
 * ├─── AMENITIES ──────────────────────────────────────────────┤
 * │  [?] Pool & Sundeck                          ✓ $450,000  │
 * │  [?] Fitness Center                          ✓ $320,000  │
 * │  [?] Co-Working Lounge                      ✓ $280,000  │
 * │  [?] Rooftop Lounge                          ✓ $350,000  │
 * │  [?] Pet Spa                                 ✓ $80,000   │
 * │  [+ Add Amenity]                                          │
 * ├─── BUDGET ─────────────────────────────────────────────────┤
 * │  Total:  [$68,000,000]  Cost/SF:  [$227]                 │
 * │  Budget Status:  Within range ▲                           │
 * └────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef } from 'react';
import { useDesignProgramStore } from '../../stores/designProgram.store';
import { useDealStore } from '../../stores/dealStore';
import type { ApprovedAmenity, AmenityCategory } from '../../types/designTargets.types';

// ─── Preset Amenity Options ─────────────────────────────────────────────────

const AMENITY_PRESETS: { name: string; category: AmenityCategory; defaultCost: number }[] = [
  { name: 'Pool & Sundeck',         category: 'pool',     defaultCost: 450_000 },
  { name: 'Fitness Center',         category: 'fitness',  defaultCost: 320_000 },
  { name: 'Co-Working Lounge',      category: 'coworking',defaultCost: 280_000 },
  { name: 'Rooftop Lounge',         category: 'lounge',   defaultCost: 350_000 },
  { name: 'Pet Spa',                category: 'pet',      defaultCost: 80_000  },
  { name: 'Concierge Desk',         category: 'concierge',defaultCost: 120_000 },
  { name: 'Resident Theater',       category: 'theatre',  defaultCost: 200_000 },
  { name: 'Outdoor Kitchen & Grills',category: 'outdoor', defaultCost: 150_000 },
  { name: 'Package Lockers',        category: 'security', defaultCost: 50_000  },
  { name: 'Bike Storage',           category: 'storage',  defaultCost: 30_000  },
  { name: 'Covered Parking',        category: 'parking',  defaultCost: 1_200_000 },
  { name: 'EV Charging Stations',   category: 'parking',  defaultCost: 90_000 },
];

const AMENITY_CATEGORY_ICON: Record<AmenityCategory, string> = {
  pool:      '🏊',
  fitness:   '💪',
  coworking: '💼',
  lounge:    '🍸',
  pet:       '🐾',
  concierge: '🛎️',
  parking:   '🅿️',
  storage:   '📦',
  theatre:   '🎬',
  outdoor:   '🌳',
  security:  '🔒',
  other:     '📋',
};

// ─── Numeric Input ──────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, max, suffix, small,
}: {
  label: string; value: number; onChange: (v: number) => void;
  max?: number; suffix?: string; small?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className="text-gray-400 w-24 text-right shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono text-right w-24 ${
          small ? 'text-xs' : 'text-sm'
        }`}
      />
      {suffix && <span className="text-gray-500">{suffix}</span>}
      {max !== undefined && (
        <span className="text-gray-500 text-xs">max {max.toLocaleString()}</span>
      )}
    </div>
  );
}

// ─── Amenity Row ────────────────────────────────────────────────────────────

function AmenityRow({
  amenity,
  onToggle,
  onRemove,
}: {
  amenity: typeof AMENITY_PRESETS[0] & { enabled: boolean };
  onToggle: (name: string, enabled: boolean) => void;
  onRemove: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <input
        type="checkbox"
        checked={amenity.enabled}
        onChange={(e) => onToggle(amenity.name, e.target.checked)}
        className="accent-emerald-500"
      />
      <span className="text-xs">{AMENITY_CATEGORY_ICON[amenity.category]}</span>
      <span className={`text-sm flex-1 ${amenity.enabled ? 'text-white' : 'text-gray-500 line-through'}`}>
        {amenity.name}
      </span>
      <span className="text-xs text-gray-500 font-mono">
        ${(amenity.defaultCost / 1000).toFixed(0)}K
      </span>
      <button
        onClick={() => onRemove(amenity.name)}
        className="text-gray-600 hover:text-red-400 text-xs"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface ProgrammingTabProps {
  dealId?: string;
}

export const ProgrammingTab: React.FC<ProgrammingTabProps> = ({ dealId }) => {
  const { program, setTargetUnits, setTargetGFA, setTargetFAR, setTargetFloors,
    setTargetHeight, setTargetParkingRatio, setUnitMix, upsertAmenity,
    removeAmenity, setBudget, loadProgram, saveProgram, lastUpdated, hydrateStatus,
    saveStatus } = useDesignProgramStore();

  const env = useDealStore((s) => s.developmentEnvelope);

  // ── Hydrate on mount / dealId change ──────────────────────────────────────
  useEffect(() => {
    if (dealId) {
      loadProgram(dealId);
    }
  }, [dealId]);

  // ── Debounce-save on every program change ─────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render (initial load / hydration)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Also skip while still loading from DB to avoid overwriting with defaults
    if (hydrateStatus === 'loading') return;
    if (!dealId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgram(dealId);
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [lastUpdated]);

  // Track which presets are enabled
  const [amenityStates, setAmenityStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    program.approvedAmenities.forEach((a) => { states[a.name] = true; });
    return states;
  });

  // Sync amenity checkbox state when program is hydrated from DB
  useEffect(() => {
    if (hydrateStatus === 'loaded') {
      const states: Record<string, boolean> = {};
      program.approvedAmenities.forEach((a) => { states[a.name] = true; });
      setAmenityStates(states);
    }
  }, [hydrateStatus]);

  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');

  const handleToggleAmenity = (name: string, enabled: boolean) => {
    setAmenityStates((prev) => ({ ...prev, [name]: enabled }));
    const preset = AMENITY_PRESETS.find((p) => p.name === name);
    if (enabled && preset) {
      upsertAmenity({
        id: `amenity-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        category: preset.category,
        estimatedCost: preset.defaultCost,
      });
    } else {
      removeAmenity(`amenity-${name.toLowerCase().replace(/\s+/g, '-')}`);
    }
  };

  const handleAddCustomAmenity = () => {
    if (!customName.trim()) return;
    const id = `amenity-custom-${customName.toLowerCase().replace(/\s+/g, '-')}`;
    upsertAmenity({ id, name: customName.trim(), category: 'other' });
    setAmenityStates((prev) => ({ ...prev, [customName.trim()]: true }));
    setCustomName('');
    setShowCustom(false);
  };

  const handleRemoveAmenity = (name: string) => {
    setAmenityStates((prev) => ({ ...prev, [name]: false }));
    removeAmenity(`amenity-${name.toLowerCase().replace(/\s+/g, '-')}`);
  };

  const mix = program.unitMix || { studio: 10, oneBed: 40, twoBed: 35, threeBed: 15 };
  const mixTotal = mix.studio + mix.oneBed + mix.twoBed + mix.threeBed;
  const mixOk = Math.abs(mixTotal - 100) <= 1;

  return (
    <div className="bg-gray-900 p-4 text-sm space-y-5 overflow-y-auto" style={{ height: '100%' }}>
      {/* ── Save status indicator ── */}
      <div className="flex items-center justify-end h-4">
        {saveStatus === 'saving' && (
          <span className="text-xs text-gray-400 animate-pulse">Saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-emerald-400">Saved ✓</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-400">Save failed</span>
        )}
      </div>

      {hydrateStatus === 'loading' && (
        <div className="text-xs text-gray-500 italic">Loading saved program…</div>
      )}

      {/* ── TARGETS ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📐 Program Targets</h3>
        <div className="space-y-1">
          <NumField
            label="Units"
            value={program.targetUnits}
            onChange={setTargetUnits}
            max={env?.max_units}
          />
          <NumField
            label="GFA (sf)"
            value={program.targetGFA}
            onChange={setTargetGFA}
            max={env ? (env.max_gfa || env.buildable_area_sf) : undefined}
            suffix="sf"
          />
          <NumField
            label="FAR"
            value={program.targetFAR}
            onChange={setTargetFAR}
            max={env ? (program.targetGFA / (env.buildable_area_sf || program.targetGFA)) : undefined}
            suffix=":1"
          />
          <NumField
            label="Floors"
            value={program.targetFloors}
            onChange={setTargetFloors}
            max={env?.max_stories}
          />
          <NumField
            label="Height"
            value={program.targetHeight}
            onChange={setTargetHeight}
            suffix="ft"
          />
          <NumField
            label="Parking"
            value={program.targetParkingRatio}
            onChange={setTargetParkingRatio}
            max={env?.max_units ? Math.min(3, env.max_units / (program.targetUnits || 1) + 1) : undefined}
            suffix="sp/u"
          />
        </div>
      </section>

      {/* ── UNIT MIX ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📊 Unit Mix</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {(['studio', 'oneBed', 'twoBed', 'threeBed'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-xs text-gray-400">
                {k === 'studio' ? 'Studio' : k === 'oneBed' ? '1BR' : k === 'twoBed' ? '2BR' : '3BR'}
              </span>
              <input
                type="number"
                value={mix[k]}
                onChange={(e) => setUnitMix({ ...mix, [k]: Number(e.target.value) })}
                className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white font-mono text-xs text-right w-12"
                min={0}
                max={100}
              />
              <span className="text-gray-500 text-xs">%</span>
            </div>
          ))}
          <span className={`text-xs font-mono ${mixOk ? 'text-emerald-400' : 'text-red-400'}`}>
            = {mixTotal}%
          </span>
        </div>
      </section>

      {/* ── AMENITIES ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">🏗️ Approved Amenities</h3>
        <div className="space-y-0.5">
          {AMENITY_PRESETS.map((preset) => (
            <AmenityRow
              key={preset.name}
              amenity={{ ...preset, enabled: amenityStates[preset.name] || false }}
              onToggle={handleToggleAmenity}
              onRemove={handleRemoveAmenity}
            />
          ))}
        </div>
        {showCustom ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom amenity name..."
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomAmenity()}
            />
            <button
              onClick={handleAddCustomAmenity}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded"
            >
              Add
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="text-gray-500 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="text-blue-400 hover:text-blue-300 text-xs mt-1"
          >
            + Add Custom Amenity
          </button>
        )}
      </section>

      {/* ── BUDGET ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">💰 Budget</h3>
        <div className="flex items-center gap-4">
          <NumField
            label="Total"
            value={program.budget?.total || 68_000_000}
            onChange={(v) => setBudget(v, program.budget?.costPerSqft || 227)}
            suffix="$"
          />
          <NumField
            label="Cost/SF"
            value={program.budget?.costPerSqft || 227}
            onChange={(v) => setBudget(program.budget?.total || 68_000_000, v)}
            suffix="$/sf"
            small
          />
        </div>
        {program.budget && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  program.budget.total / program.targetGFA > program.budget.costPerSqft * 1.1
                    ? 'bg-red-500'
                    : program.budget.total / program.targetGFA > program.budget.costPerSqft * 0.9
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (program.budget.total / program.targetGFA / program.budget.costPerSqft) * 100)}%` }}
              />
            </div>
            <span className="text-gray-500">
              ${(program.budget.total / program.targetGFA).toFixed(0)}/sf actual
            </span>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProgrammingTab;
