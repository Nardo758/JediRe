import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { RegulatoryAlert, RegulatoryCategory, AlertSeverity } from '../types/zoning.types';

interface UseRegulatoryAlertsReturn {
  alerts: RegulatoryAlert[];
  loading: boolean;
  error: string | null;
  fetchAlerts: (params?: FetchAlertsParams) => Promise<void>;
  filterByCategory: (category: RegulatoryCategory | null) => void;
  filterBySeverity: (severity: AlertSeverity | null) => void;
  selectedCategory: RegulatoryCategory | null;
  selectedSeverity: AlertSeverity | null;
  filteredAlerts: RegulatoryAlert[];
  jurisdictions: string[];
}

interface FetchAlertsParams {
  municipality?: string;
  category?: RegulatoryCategory;
  severity?: AlertSeverity;
}

export function useRegulatoryAlerts(jurisdiction?: string | null): UseRegulatoryAlertsReturn {
  const [alerts, setAlerts] = useState<RegulatoryAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RegulatoryCategory | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<AlertSeverity | null>(null);

  const fetchAlerts = useCallback(async (params?: FetchAlertsParams) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams: Record<string, string> = {};
      if (params?.municipality) queryParams.municipality = params.municipality;
      if (params?.category) queryParams.category = params.category;
      if (params?.severity) queryParams.severity = params.severity;

      const response = await axios.get<RegulatoryAlert[]>('/api/v1/regulatory-alerts', {
        params: queryParams,
      });
      setAlerts(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch regulatory alerts';
      setError(message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (jurisdiction) {
      fetchAlerts({ municipality: jurisdiction });
    } else {
      fetchAlerts();
    }
  }, [jurisdiction, fetchAlerts]);

  const filterByCategory = useCallback((category: RegulatoryCategory | null) => {
    setSelectedCategory(category);
  }, []);

  const filterBySeverity = useCallback((severity: AlertSeverity | null) => {
    setSelectedSeverity(severity);
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (selectedCategory && alert.category !== selectedCategory) return false;
    if (selectedSeverity && alert.severity !== selectedSeverity) return false;
    return true;
  });

  const jurisdictions = Array.from(new Set(alerts.map((a) => a.municipality))).sort();

  return {
    alerts,
    loading,
    error,
    fetchAlerts,
    filterByCategory,
    filterBySeverity,
    selectedCategory,
    selectedSeverity,
    filteredAlerts,
    jurisdictions,
  };
}
