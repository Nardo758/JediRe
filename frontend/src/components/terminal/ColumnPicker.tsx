import React, { useState, useMemo, useRef } from "react";
import {
  ColumnDef,
  ViewId,
  CATEGORY_META,
  ColumnCategory,
  getColumnsForView,
  getColumnById,
} from "../../config/columnRegistry";
import { BT } from "./theme";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface ColumnPickerProps {
  viewId: ViewId;
  activeColumns: string[];
  onToggle: (colId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
  onClose: () => void;
  isDefault: boolean;
}

export function ColumnPicker({ viewId, activeColumns, onToggle, onReorder, onReset, onClose, isDefault }: ColumnPickerProps) {
  const [search, setSearch] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const available = useMemo(() => getColumnsForView(viewId), [viewId]);

  const grouped = useMemo(() => {
    const g: Record<string, ColumnDef[]> = {};
    for (const col of available) {
      if (search && !col.label.toLowerCase().includes(search.toLowerCase()) && !(col.description || "").toLowerCase().includes(search.toLowerCase())) continue;
      if (!g[col.category]) g[col.category] = [];
      g[col.category].push(col);
    }
    return g;
  }, [available, search]);

  const activeColDefs = activeColumns.map(id => getColumnById(id)).filter(Boolean) as ColumnDef[];

  return (
    <div style={{
      position: "absolute", top: 28, right: 0, width: 320, maxHeight: "calc(100vh - 120px)",
      background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, zIndex: 100,
      display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <div style={{ padding: "8px 10px", borderBottom: `1px solid ${BT.border.subtle}`, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: BT.text.amber, flex: 1 }}>COLUMN EDITOR</span>
        {!isDefault && (
          <button onClick={onReset} style={{ ...mono, fontSize: 8, color: BT.text.muted, background: "transparent", border: `1px solid ${BT.border.subtle}`, padding: "2px 6px", cursor: "pointer" }}>
            RESET
          </button>
        )}
        <button onClick={onClose} style={{ ...mono, fontSize: 10, color: BT.text.muted, background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px" }}>✕</button>
      </div>

      <div style={{ padding: "4px 10px", borderBottom: `1px solid ${BT.border.subtle}` }}>
        <input
          type="text"
          placeholder="Search metrics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...mono, fontSize: 9, width: "100%", background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, padding: "4px 8px", outline: "none" }}
        />
      </div>

      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{ ...mono, fontSize: 8, fontWeight: 700, color: BT.text.muted, marginBottom: 4, letterSpacing: 0.5 }}>
          ACTIVE ({activeColumns.length}) — drag to reorder
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          {activeColDefs.map((col, idx) => (
            <span
              key={col.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragEnd={() => {
                if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
                  onReorder(dragIdx, dragOverIdx);
                }
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              style={{
                ...mono, fontSize: 8, fontWeight: 600,
                padding: "2px 5px", cursor: "grab",
                background: dragOverIdx === idx ? BT.text.amber + "33" : CATEGORY_META[col.category as ColumnCategory]?.color + "22",
                color: CATEGORY_META[col.category as ColumnCategory]?.color || BT.text.primary,
                border: `1px solid ${CATEGORY_META[col.category as ColumnCategory]?.color || BT.border.subtle}44`,
                opacity: dragIdx === idx ? 0.5 : 1,
              }}
            >
              {col.label}
              <span
                onClick={e => { e.stopPropagation(); onToggle(col.id); }}
                style={{ marginLeft: 3, cursor: "pointer", opacity: 0.6, fontSize: 7 }}
              >✕</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {Object.entries(grouped).map(([cat, cols]) => (
          <div key={cat} style={{ marginBottom: 2 }}>
            <div style={{
              ...mono, fontSize: 8, fontWeight: 700, letterSpacing: 0.5, padding: "4px 10px",
              color: CATEGORY_META[cat as ColumnCategory]?.color || BT.text.muted,
              background: BT.bg.hover,
            }}>
              {CATEGORY_META[cat as ColumnCategory]?.label || cat.toUpperCase()}
            </div>
            {cols.map(col => {
              const isActive = activeColumns.includes(col.id);
              return (
                <div
                  key={col.id}
                  onClick={() => onToggle(col.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "3px 10px",
                    cursor: "pointer", borderBottom: `1px solid ${BT.border.subtle}22`,
                    background: isActive ? BT.bg.active : "transparent",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = BT.bg.hover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 12, height: 12, border: `1.5px solid ${isActive ? BT.text.green : BT.border.medium}`,
                    background: isActive ? BT.text.green + "22" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: BT.text.green, flexShrink: 0,
                  }}>
                    {isActive ? "✓" : ""}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...mono, fontSize: 9, fontWeight: 600, color: isActive ? BT.text.primary : BT.text.secondary }}>
                      {col.label}
                      {col.catalogMetricId && (
                        <span style={{ fontSize: 7, color: BT.text.muted, marginLeft: 4 }}>[{col.catalogMetricId}]</span>
                      )}
                    </div>
                    {col.description && (
                      <div style={{ ...mono, fontSize: 7, color: BT.text.muted, marginTop: 1 }}>{col.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 10px", borderTop: `1px solid ${BT.border.subtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ ...mono, fontSize: 8, color: BT.text.muted }}>{activeColumns.length} cols · {available.length} available</span>
        <span style={{ ...mono, fontSize: 8, color: isDefault ? BT.text.muted : BT.text.green }}>{isDefault ? "DEFAULT" : "CUSTOM"}</span>
      </div>
    </div>
  );
}
