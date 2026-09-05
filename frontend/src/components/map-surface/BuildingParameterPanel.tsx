/**
 * ═══════════════════════════════════════════════════════════════════
 * BUILDING PARAMETER PANEL — Real-time 3D design controls
 * ═══════════════════════════════════════════════════════════════════
 */

import React from 'react';
import type { BuildingParameters, FacadeType, RoofType, TimeOfDay } from '../../lib/building-engine';

interface BuildingParameterPanelProps {
  params: BuildingParameters;
  onChange: (params: BuildingParameters) => void;
}

export const BuildingParameterPanel: React.FC<BuildingParameterPanelProps> = ({
  params,
  onChange,
}) => {
  const update = <K extends keyof BuildingParameters>(key: K, value: BuildingParameters[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
        Building Design
      </h3>

      {/* Levels */}
      <ControlRow label="Levels" value={params.levels} unit="floors">
        <input
          type="range"
          min={1}
          max={20}
          value={params.levels}
          onChange={(e) => update('levels', Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </ControlRow>

      {/* Floor Height */}
      <ControlRow label="Floor Height" value={params.floorHeight} unit="ft">
        <input
          type="range"
          min={8}
          max={16}
          step={0.5}
          value={params.floorHeight}
          onChange={(e) => update('floorHeight', Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </ControlRow>

      {/* Facade */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Facade</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(['brick', 'glass', 'concrete', 'wood_panel', 'stucco', 'mixed'] as FacadeType[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => update('facade', f)}
                className={`text-xs py-1.5 px-2 rounded border transition ${
                  params.facade === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Roof Type */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Roof</label>
        <div className="flex gap-1.5">
          {(['flat', 'pitched', 'terraced'] as RoofType[]).map((r) => (
            <button
              key={r}
              onClick={() => update('roofType', r)}
              className={`flex-1 text-xs py-1.5 px-2 rounded border transition ${
                params.roofType === r
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Setbacks */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Setbacks</h4>
        <ControlRow label="Front" value={params.setbackFront} unit="ft">
          <input
            type="range"
            min={0}
            max={50}
            value={params.setbackFront}
            onChange={(e) => update('setbackFront', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </ControlRow>
        <ControlRow label="Rear" value={params.setbackRear} unit="ft">
          <input
            type="range"
            min={0}
            max={50}
            value={params.setbackRear}
            onChange={(e) => update('setbackRear', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </ControlRow>
        <ControlRow label="Side" value={params.setbackSide} unit="ft">
          <input
            type="range"
            min={0}
            max={30}
            value={params.setbackSide}
            onChange={(e) => update('setbackSide', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </ControlRow>
      </div>

      {/* Windows */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Windows</h4>
        <ControlRow label="Window Ratio" value={Math.round(params.windowRatio * 100)} unit="%">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(params.windowRatio * 100)}
            onChange={(e) => update('windowRatio', Number(e.target.value) / 100)}
            className="w-full accent-blue-600"
          />
        </ControlRow>
      </div>

      {/* Balconies */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Balconies</h4>
        <ControlRow label="Depth" value={params.balconyDepth} unit="ft">
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={params.balconyDepth}
            onChange={(e) => update('balconyDepth', Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </ControlRow>
      </div>

      {/* Lighting */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lighting</h4>
        <div className="flex gap-1.5">
          {(['golden_hour', 'midday', 'dusk', 'overcast'] as TimeOfDay[]).map((t) => (
            <button
              key={t}
              onClick={() => update('timeOfDay', t)}
              className={`flex-1 text-xs py-1.5 px-1 rounded border transition ${
                params.timeOfDay === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-component ───────────────────────────────────────────────── */

const ControlRow: React.FC<{
  label: string;
  value: number;
  unit: string;
  children: React.ReactNode;
}> = ({ label, value, unit, children }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <span className="text-xs text-gray-500 font-mono">
        {value} {unit}
      </span>
    </div>
    {children}
  </div>
);

export default BuildingParameterPanel;
