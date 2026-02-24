import { useState, useCallback } from 'react';
import axios from 'axios';
import type {
  ComparisonMode,
  ZoningComparison,
  ZoningDistrict,
  Parcel,
  JurisdictionSummary,
} from '../types/zoning.types';
import { useZoningModuleStore } from '../stores/zoningModuleStore';

interface SearchResult {
  id: string;
  label: string;
  data: ZoningDistrict | Parcel | JurisdictionSummary;
}

export function useZoningComparison() {
  const {
    comparisonMode,
    comparisonA,
    comparisonB,
    setComparisonMode,
    setComparisonItems,
  } = useZoningModuleStore();

  const [comparison, setComparison] = useState<ZoningComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResultsA, setSearchResultsA] = useState<SearchResult[]>([]);
  const [searchResultsB, setSearchResultsB] = useState<SearchResult[]>([]);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);

  const getEndpoint = (mode: ComparisonMode) => {
    switch (mode) {
      case 'district':
        return '/api/v1/zoning-comparator/compare-districts';
      case 'parcel':
        return '/api/v1/zoning-comparator/compare-parcels';
      case 'jurisdiction':
        return '/api/v1/zoning-comparator/compare-jurisdictions';
    }
  };

  const getSearchEndpoint = (mode: ComparisonMode) => {
    switch (mode) {
      case 'district':
        return '/api/v1/zoning-comparator/search-districts';
      case 'parcel':
        return '/api/v1/zoning-comparator/search-parcels';
      case 'jurisdiction':
        return '/api/v1/zoning-comparator/search-jurisdictions';
    }
  };

  const searchItems = useCallback(
    async (query: string, side: 'a' | 'b') => {
      if (!query || query.length < 2) {
        if (side === 'a') setSearchResultsA([]);
        else setSearchResultsB([]);
        return;
      }

      const setSearcing = side === 'a' ? setSearchingA : setSearchingB;
      const setResults = side === 'a' ? setSearchResultsA : setSearchResultsB;

      setSearcing(true);
      try {
        const { data } = await axios.get(getSearchEndpoint(comparisonMode), {
          params: { q: query },
        });
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearcing(false);
      }
    },
    [comparisonMode]
  );

  const selectItem = useCallback(
    (item: any, side: 'a' | 'b') => {
      if (side === 'a') {
        setComparisonItems(item, comparisonB);
        setSearchResultsA([]);
      } else {
        setComparisonItems(comparisonA, item);
        setSearchResultsB([]);
      }
    },
    [comparisonA, comparisonB, setComparisonItems]
  );

  const compare = useCallback(async () => {
    if (!comparisonA || !comparisonB) {
      setError('Please select both items to compare.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.post(getEndpoint(comparisonMode), {
        itemA: comparisonA,
        itemB: comparisonB,
      });
      setComparison(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Comparison failed. Please try again.');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [comparisonA, comparisonB, comparisonMode]);

  const changeMode = useCallback(
    (mode: ComparisonMode) => {
      setComparisonMode(mode);
      setComparisonItems(null, null);
      setComparison(null);
      setError(null);
      setSearchResultsA([]);
      setSearchResultsB([]);
    },
    [setComparisonMode, setComparisonItems]
  );

  const clearSelection = useCallback(
    (side: 'a' | 'b') => {
      if (side === 'a') {
        setComparisonItems(null, comparisonB);
      } else {
        setComparisonItems(comparisonA, null);
      }
      setComparison(null);
    },
    [comparisonA, comparisonB, setComparisonItems]
  );

  return {
    comparisonMode,
    comparisonA,
    comparisonB,
    comparison,
    loading,
    error,
    searchResultsA,
    searchResultsB,
    searchingA,
    searchingB,
    searchItems,
    selectItem,
    compare,
    changeMode,
    clearSelection,
  };
}
