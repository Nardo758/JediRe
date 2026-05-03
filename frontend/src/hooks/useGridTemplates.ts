import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { logSwallowedError } from '../utils/swallowedError';

export interface GridTemplate {
  id: string;
  name: string;
  view_id: string;
  columns: string[];
  column_config: Record<string, any>;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export function useGridTemplates(viewId: string) {
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get(`/grid-templates?viewId=${viewId}`);
      if (res.data.success) {
        setTemplates(res.data.templates);
      }
    } catch (err) { logSwallowedError('hooks/useGridTemplates', err); } finally {
      setLoading(false);
    }
  }, [viewId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = useCallback(async (name: string, columns: string[], columnConfig?: Record<string, any>) => {
    try {
      const res = await api.post('/grid-templates', {
        name, viewId, columns, columnConfig: columnConfig || {},
      });
      if (res.data.success) {
        setTemplates(prev => [res.data.template, ...prev]);
        setActiveTemplate(res.data.template.id);
        return res.data.template;
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
    return null;
  }, [viewId]);

  const updateTemplate = useCallback(async (id: string, updates: { name?: string; columns?: string[]; columnConfig?: Record<string, any> }) => {
    try {
      const res = await api.put(`/grid-templates/${id}`, updates);
      if (res.data.success) {
        setTemplates(prev => prev.map(t => t.id === id ? res.data.template : t));
        return res.data.template;
      }
    } catch (err) {
      console.error("Failed to update template:", err);
    }
    return null;
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const res = await api.delete(`/grid-templates/${id}`);
      if (res.data.success) {
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (activeTemplate === id) setActiveTemplate(null);
        return true;
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
    return false;
  }, [activeTemplate]);

  return { templates, loading, activeTemplate, setActiveTemplate, saveTemplate, updateTemplate, deleteTemplate, refetch: fetchTemplates };
}
