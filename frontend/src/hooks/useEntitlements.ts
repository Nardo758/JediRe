import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useZoningModuleStore } from '../stores/zoningModuleStore';
import type {
  Entitlement,
  EntitlementStatus,
  EntitlementType,
  EntitlementMilestone,
} from '../types/zoning.types';

export interface EntitlementFilters {
  market?: string | null;
  status?: EntitlementStatus | null;
  type?: EntitlementType | null;
  dealId?: string | null;
  sortBy?: string;
}

export interface EntitlementFormData {
  dealId?: string | null;
  parcelAddress: string;
  type: EntitlementType;
  fromDistrict?: string | null;
  toDistrict?: string | null;
  status: EntitlementStatus;
  riskLevel: 'low' | 'medium' | 'high';
  filedDate?: string | null;
  hearingDate?: string | null;
  estCostLow?: number | null;
  estCostHigh?: number | null;
  estTimelineMonths?: number | null;
  notes?: string | null;
}

export interface KanbanData {
  pre_application: Entitlement[];
  submitted: Entitlement[];
  under_review: Entitlement[];
  hearing: Entitlement[];
  approved: Entitlement[];
}

export function useEntitlements() {
  const [entitlements, setEntitlementsLocal] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<Entitlement | null>(null);

  const { entitlementFilter, setEntitlements: setStoreEntitlements } = useZoningModuleStore();

  const fetchEntitlements = useCallback(async (filters?: EntitlementFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      const f = filters || entitlementFilter;
      if (f.market) params.market = f.market;
      if (f.status) params.status = f.status;
      if (f.type) params.type = f.type;
      if (f.dealId) params.dealId = f.dealId;
      if (f.sortBy) params.sortBy = f.sortBy;

      const { data } = await apiClient.get<Entitlement[]>('/entitlements', { params });
      setEntitlementsLocal(data);
      setStoreEntitlements(data);
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch entitlements';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [entitlementFilter, setStoreEntitlements]);

  const fetchEntitlementById = useCallback(async (id: string) => {
    try {
      const { data } = await apiClient.get<Entitlement>(`/entitlements/${id}`);
      setSelectedEntitlement(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch entitlement');
      return null;
    }
  }, []);

  const createEntitlement = useCallback(async (formData: EntitlementFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<Entitlement>('/entitlements', formData);
      setEntitlementsLocal((prev) => [...prev, data]);
      setStoreEntitlements([...entitlements, data]);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create entitlement');
      return null;
    } finally {
      setLoading(false);
    }
  }, [entitlements, setStoreEntitlements]);

  const updateEntitlement = useCallback(async (id: string, formData: Partial<EntitlementFormData>) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.patch<Entitlement>(`/entitlements/${id}`, formData);
      setEntitlementsLocal((prev) => prev.map((e) => (e.id === id ? data : e)));
      setStoreEntitlements(entitlements.map((e) => (e.id === id ? data : e)));
      if (selectedEntitlement?.id === id) setSelectedEntitlement(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update entitlement');
      return null;
    } finally {
      setLoading(false);
    }
  }, [entitlements, selectedEntitlement, setStoreEntitlements]);

  const deleteEntitlement = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/entitlements/${id}`);
      setEntitlementsLocal((prev) => prev.filter((e) => e.id !== id));
      setStoreEntitlements(entitlements.filter((e) => e.id !== id));
      if (selectedEntitlement?.id === id) setSelectedEntitlement(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete entitlement');
      return false;
    } finally {
      setLoading(false);
    }
  }, [entitlements, selectedEntitlement, setStoreEntitlements]);

  const updateMilestone = useCallback(async (
    entitlementId: string,
    milestoneId: string,
    updates: Partial<EntitlementMilestone>
  ) => {
    try {
      const { data } = await apiClient.patch<EntitlementMilestone>(
        `/entitlements/${entitlementId}/milestones/${milestoneId}`,
        updates
      );
      if (selectedEntitlement?.id === entitlementId) {
        setSelectedEntitlement({
          ...selectedEntitlement,
          milestones: selectedEntitlement.milestones.map((m) =>
            m.id === milestoneId ? data : m
          ),
        });
      }
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update milestone');
      return null;
    }
  }, [selectedEntitlement]);

  const kanbanData: KanbanData = {
    pre_application: entitlements.filter((e) => e.status === 'pre_application'),
    submitted: entitlements.filter((e) => e.status === 'submitted'),
    under_review: entitlements.filter((e) => e.status === 'under_review'),
    hearing: entitlements.filter((e) => e.status === 'hearing'),
    approved: entitlements.filter((e) => e.status === 'approved'),
  };

  useEffect(() => {
    fetchEntitlements();
  }, []);

  return {
    entitlements,
    kanbanData,
    loading,
    error,
    selectedEntitlement,
    setSelectedEntitlement,
    fetchEntitlements,
    fetchEntitlementById,
    createEntitlement,
    updateEntitlement,
    deleteEntitlement,
    updateMilestone,
  };
}
