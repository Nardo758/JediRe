import { useState, useEffect, useCallback } from "react";
import { ViewId, DEFAULT_COLUMNS } from "../config/columnRegistry";
import api from "../services/api";

export function useColumnPreferences(viewId: ViewId) {
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS[viewId]);
  const [columnConfig, setColumnConfig] = useState<Record<string, any>>({});
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
          if (res.data.columnConfig) setColumnConfig(res.data.columnConfig);
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

  const saveColumns = useCallback(async (newColumns: string[], newConfig?: Record<string, any>) => {
    setColumns(newColumns);
    setIsDefault(false);
    try {
      await api.put(`/column-preferences/${viewId}`, { columns: newColumns, columnConfig: newConfig || columnConfig });
    } catch (err) {
      console.error("Failed to save column preferences:", err);
    }
  }, [viewId, columnConfig]);

  const saveColumnConfig = useCallback(async (config: Record<string, any>) => {
    setColumnConfig(config);
    try {
      await api.put(`/column-preferences/${viewId}`, { columns, columnConfig: config });
    } catch (err) {
      console.error("Failed to save column config:", err);
    }
  }, [viewId, columns]);

  const resetToDefaults = useCallback(async () => {
    const defaults = DEFAULT_COLUMNS[viewId];
    setColumns(defaults);
    setColumnConfig({});
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
        api.put(`/column-preferences/${viewId}`, { columns: next, columnConfig }).catch(() => {});
        setIsDefault(false);
      }
      return next.length > 0 ? next : prev;
    });
  }, [viewId, columnConfig]);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      api.put(`/column-preferences/${viewId}`, { columns: next, columnConfig }).catch(() => {});
      setIsDefault(false);
      return next;
    });
  }, [viewId, columnConfig]);

  return { columns, columnConfig, isDefault, loading, saveColumns, saveColumnConfig, resetToDefaults, toggleColumn, reorderColumns };
}
