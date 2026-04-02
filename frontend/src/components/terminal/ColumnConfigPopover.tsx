import React, { useState } from "react";
import { BT } from "./theme";
import { ColumnDef } from "../../config/columnRegistry";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export interface ColumnConfig {
  aggregation: "latest" | "yoy" | "3mo_avg" | "6mo_avg";
  geoScope: "all" | "msa" | "submarket" | "property";
  displayFormat: "raw" | "pct" | "delta" | "rank";
}

export const DEFAULT_COLUMN_CONFIG: ColumnConfig = {
  aggregation: "latest",
  geoScope: "all",
  displayFormat: "raw",
};

interface ColumnConfigPopoverProps {
  colDef: ColumnDef;
  config: ColumnConfig;
  onConfigChange: (config: ColumnConfig) => void;
  onClose: () => void;
  insight?: {
    pearsonR: number;
    rSquared: number;
    lagWeeks: number;
    direction: string;
    outcomeMetricId: string;
    driverName: string;
  } | null;
}

export function ColumnConfigPopover({ colDef, config, onConfigChange, onClose, insight }: ColumnConfigPopoverProps) {
  const [localConfig, setLocalConfig] = useState<ColumnConfig>({ ...config });

  const handleApply = () => {
    onConfigChange(localConfig);
    onClose();
  };

  const C = {
    panel: BT.bg.panel,
    border: BT.border.medium,
    borderS: BT.border.subtle,
    primary: BT.text.primary,
    secondary: BT.text.secondary,
    muted: BT.text.muted,
    amber: BT.text.amber,
    green: BT.text.green || "#4CAF50",
    red: "#FF5252",
    blue: "#2196F3",
    bg: BT.bg.terminal,
  };

  const rStrength = insight ? Math.abs(insight.pearsonR) : 0;
  const strengthLabel = rStrength >= 0.7 ? "STRONG" : rStrength >= 0.4 ? "MODERATE" : "WEAK";
  const strengthColor = rStrength >= 0.7 ? C.green : rStrength >= 0.4 ? C.amber : C.muted;

  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, width: 240, background: C.panel,
      border: `1px solid ${C.border}`, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      padding: 0,
    }}>
      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${C.borderS}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.blue }}>
          {colDef.label} CONFIG
        </span>
        <button onClick={onClose} style={{ ...mono, fontSize: 9, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ padding: "6px 10px" }}>
        <div style={{ ...mono, fontSize: 8, color: C.muted, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>AGGREGATION</div>
        {(["latest", "yoy", "3mo_avg", "6mo_avg"] as const).map(agg => (
          <label key={agg} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "2px 0", cursor: "pointer",
          }}>
            <input
              type="radio" name="aggregation" checked={localConfig.aggregation === agg}
              onChange={() => setLocalConfig({ ...localConfig, aggregation: agg })}
              style={{ accentColor: C.blue }}
            />
            <span style={{ ...mono, fontSize: 8, color: localConfig.aggregation === agg ? C.primary : C.secondary }}>
              {{ latest: "Latest Value", yoy: "Year-over-Year %", "3mo_avg": "3-Month Average", "6mo_avg": "6-Month Average" }[agg]}
            </span>
          </label>
        ))}
      </div>

      <div style={{ padding: "6px 10px", borderTop: `1px solid ${C.borderS}` }}>
        <div style={{ ...mono, fontSize: 8, color: C.muted, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>GEO SCOPE</div>
        {(["all", "msa", "submarket", "property"] as const).map(scope => (
          <label key={scope} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "2px 0", cursor: "pointer",
          }}>
            <input
              type="radio" name="geoScope" checked={localConfig.geoScope === scope}
              onChange={() => setLocalConfig({ ...localConfig, geoScope: scope })}
              style={{ accentColor: C.blue }}
            />
            <span style={{ ...mono, fontSize: 8, color: localConfig.geoScope === scope ? C.primary : C.secondary }}>
              {{ all: "All Geographies", msa: "MSA Only", submarket: "Submarket Only", property: "Property Only" }[scope]}
            </span>
          </label>
        ))}
      </div>

      <div style={{ padding: "6px 10px", borderTop: `1px solid ${C.borderS}` }}>
        <div style={{ ...mono, fontSize: 8, color: C.muted, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>DISPLAY FORMAT</div>
        {(["raw", "pct", "delta", "rank"] as const).map(fmt => (
          <label key={fmt} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "2px 0", cursor: "pointer",
          }}>
            <input
              type="radio" name="displayFormat" checked={localConfig.displayFormat === fmt}
              onChange={() => setLocalConfig({ ...localConfig, displayFormat: fmt })}
              style={{ accentColor: C.blue }}
            />
            <span style={{ ...mono, fontSize: 8, color: localConfig.displayFormat === fmt ? C.primary : C.secondary }}>
              {{ raw: "Raw Value", pct: "Percentage", delta: "Change (Δ)", rank: "Rank (#)" }[fmt]}
            </span>
          </label>
        ))}
      </div>

      {insight && (
        <div style={{ padding: "6px 10px", borderTop: `1px solid ${C.blue}44`, background: C.blue + "08" }}>
          <div style={{ ...mono, fontSize: 8, color: C.blue, fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>DRIVER INSIGHT</div>
          <div style={{ ...mono, fontSize: 8, color: C.primary, marginBottom: 2 }}>
            r = {insight.pearsonR > 0 ? "+" : ""}{insight.pearsonR.toFixed(3)}
            <span style={{ color: strengthColor, marginLeft: 6, fontWeight: 700 }}>{strengthLabel}</span>
          </div>
          <div style={{ ...mono, fontSize: 7, color: C.secondary }}>
            R² = {insight.rSquared.toFixed(3)} · {insight.direction} · {insight.lagWeeks}w lead
          </div>
          <div style={{ ...mono, fontSize: 7, color: C.muted, marginTop: 2 }}>
            Predicts: {insight.outcomeMetricId.replace('OP_', '')}
          </div>
        </div>
      )}

      <div style={{ padding: "6px 10px", borderTop: `1px solid ${C.borderS}`, display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ ...mono, fontSize: 8, color: C.muted, background: "transparent", border: `1px solid ${C.borderS}`, padding: "2px 8px", cursor: "pointer" }}>CANCEL</button>
        <button onClick={handleApply} style={{ ...mono, fontSize: 8, color: "#000", background: C.blue, border: "none", padding: "2px 8px", cursor: "pointer", fontWeight: 700 }}>APPLY</button>
      </div>
    </div>
  );
}
