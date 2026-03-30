import { useState, useEffect, useCallback } from "react";
import { ViewId, DEFAULT_COLUMNS } from "../config/columnRegistry";
import api from "../services/api";

export function useColumnPreferences(viewId: ViewId) {
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS[viewId]);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/column-preferences/${viewId}`);
        if (!cancelled && res.data.success) {
          setColumns(res.data.columns);
          setIsDefault(res.data.isDefault);
        }
      } catch {
        if (!cancelled) {
          setColumns(DEFAULT_COLUMNS[viewId]);
          setIsDefault(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [viewId]);

  const saveColumns = useCallback(async (newColumns: string[]) => {
    setColumns(newColumns);
    setIsDefault(false);
    try {
      await api.put(`/column-preferences/${viewId}`, { columns: newColumns });
    } catch (err) {
      console.error("Failed to save column preferences:", err);
    }
  }, [viewId]);

  const resetToDefaults = useCallback(async () => {
    const defaults = DEFAULT_COLUMNS[viewId];
    setColumns(defaults);
    setIsDefault(true);
    try {
      await api.delete(`/column-preferences/${viewId}`);
    } catch (err) {
      console.error("Failed to reset column preferences:", err);
    }
  }, [viewId]);

  const toggleColumn = useCallback((colId: string) => {
    setColumns(prev => {
      const next = prev.includes(colId)
        ? prev.filter(c => c !== colId)
        : [...prev, colId];
      if (next.length > 0) {
        api.put(`/column-preferences/${viewId}`, { columns: next }).catch(() => {});
        setIsDefault(false);
      }
      return next.length > 0 ? next : prev;
    });
  }, [viewId]);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      api.put(`/column-preferences/${viewId}`, { columns: next }).catch(() => {});
      setIsDefault(false);
      return next;
    });
  }, [viewId]);

  return { columns, isDefault, loading, saveColumns, resetToDefaults, toggleColumn, reorderColumns };
}
