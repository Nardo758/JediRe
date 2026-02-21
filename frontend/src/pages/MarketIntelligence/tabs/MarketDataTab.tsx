import React, { useState, useEffect, useCallback } from 'react';
import { Download, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, Building2, MapPin } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface PropertyRecord {
  id: string;
  parcel_id: string;
  address: string;
  city: string;
  zip_code: string;
  county: string;
  state: string;
  owner_name: string;
  units: number;
  land_acres: number;
  year_built: string;
  stories: number;
  building_sqft: number;
  assessed_value: number;
  appraised_value: number;
  land_use_code: string;
  class_code: string;
  subdivision: string;
  value_per_unit: number | null;
  value_per_sqft: number | null;
  scraped_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MarketDataTabProps {
  marketId: string;
  summary: MarketSummaryResponse;
  onUpdate: () => void;
}

const MarketDataTab: React.FC<MarketDataTabProps> = ({ marketId, summary }) => {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [sortBy, setSortBy] = useState('assessed_value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [counties, setCounties] = useState<string[]>([]);
  const [noMapping, setNoMapping] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadProperties(1);
  }, [marketId, debouncedSearch, sortBy, sortOrder]);

  const loadProperties = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/v1/market-intelligence/${marketId}/properties?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setProperties(data.properties || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
      setCounties(data.counties || []);
      setNoMapping(!!data.message);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  }, [marketId, debouncedSearch, sortBy, sortOrder]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value && value !== 0) return 'N/A';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (!value && value !== 0) return 'N/A';
    return value.toLocaleString();
  };

  return (
    <div className="market-data-tab">
      <div className="data-header">
        <div>
          <h2>Property Research Data</h2>
          <p>
            {pagination.total > 0 ? (
              <>{pagination.total.toLocaleString()} properties from {counties.join(', ') || 'county assessor records'}</>
            ) : (
              <>Market research data for analysis and acquisition targeting</>
            )}
          </p>
        </div>
        <div className="data-actions">
          <button className="export-button">
            <Download size={18} />
            Export Data
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by address or owner name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {noMapping ? (
        <div className="no-data-state">
          <Building2 size={48} />
          <h3>No Property Data Available</h3>
          <p>County assessor data has not been imported for this market yet. Property records will appear here once data is scraped and imported.</p>
        </div>
      ) : loading ? (
        <div className="data-loading">Loading property records...</div>
      ) : (
        <>
          <div className="properties-table">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('address')} className="sortable-th">
                    Address {sortBy === 'address' && <ArrowUpDown size={14} />}
                  </th>
                  <th>Location</th>
                  <th onClick={() => handleSort('units')} className="sortable-th">
                    Units {sortBy === 'units' && <ArrowUpDown size={14} />}
                  </th>
                  <th onClick={() => handleSort('owner_name')} className="sortable-th">
                    Owner {sortBy === 'owner_name' && <ArrowUpDown size={14} />}
                  </th>
                  <th onClick={() => handleSort('year_built')} className="sortable-th">
                    Year Built {sortBy === 'year_built' && <ArrowUpDown size={14} />}
                  </th>
                  <th onClick={() => handleSort('building_sqft')} className="sortable-th">
                    Sq Ft {sortBy === 'building_sqft' && <ArrowUpDown size={14} />}
                  </th>
                  <th onClick={() => handleSort('assessed_value')} className="sortable-th">
                    Assessed Value {sortBy === 'assessed_value' && <ArrowUpDown size={14} />}
                  </th>
                  <th>$/Unit</th>
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      {debouncedSearch
                        ? 'No properties match your search.'
                        : 'No properties found in this market.'}
                    </td>
                  </tr>
                ) : (
                  properties.map(property => (
                    <tr key={property.id}>
                      <td className="property-address">
                        <span className="address-text">{property.address || 'No Address'}</span>
                        {property.parcel_id && <span className="parcel-id">Parcel: {property.parcel_id}</span>}
                      </td>
                      <td>
                        <span className="location-cell">
                          <MapPin size={14} />
                          {property.city ? `${property.city}, ${property.state}` : `${property.county} Co, ${property.state}`}
                          {property.zip_code && ` ${property.zip_code}`}
                        </span>
                      </td>
                      <td className="number-cell">{formatNumber(property.units)}</td>
                      <td className="owner-cell">{property.owner_name || 'N/A'}</td>
                      <td className="number-cell">{property.year_built || 'N/A'}</td>
                      <td className="number-cell">{formatNumber(property.building_sqft)}</td>
                      <td className="value-cell">{formatCurrency(property.assessed_value)}</td>
                      <td className="value-cell">{formatCurrency(property.value_per_unit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination-bar">
              <span className="page-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)
              </span>
              <div className="page-buttons">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => loadProperties(pagination.page - 1)}
                  className="page-btn"
                >
                  <ChevronLeft size={18} /> Prev
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadProperties(pagination.page + 1)}
                  className="page-btn"
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="info-box">
        <h3>About Property Research Data</h3>
        <p>
          This is county assessor research data used to analyze markets and find opportunities.
          It is NOT your portfolio - those are tracked in the "Deals" section.
        </p>
        <ul>
          <li><strong>Acquisition Targeting:</strong> Find properties that meet your criteria</li>
          <li><strong>Owner Outreach:</strong> Use owner information for direct outreach campaigns</li>
          <li><strong>Valuation Benchmarks:</strong> Compare assessed values across properties</li>
          <li><strong>Market Analysis:</strong> Analyze vintage cohorts, unit mixes, and density</li>
        </ul>
      </div>

      <style>{`
        .market-data-tab {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .data-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: white;
          padding: 24px;
          border-radius: 12px;
        }

        .data-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .data-header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .export-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .export-button:hover {
          background: #2563eb;
        }

        .search-bar {
          display: flex;
          gap: 12px;
          background: white;
          padding: 16px 24px;
          border-radius: 12px;
        }

        .search-input {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .search-input input {
          flex: 1;
          border: none;
          background: none;
          font-size: 14px;
          outline: none;
        }

        .no-data-state {
          background: white;
          padding: 64px 32px;
          text-align: center;
          border-radius: 12px;
          color: #94a3b8;
        }

        .no-data-state h3 {
          margin: 16px 0 8px;
          font-size: 18px;
          color: #475569;
        }

        .no-data-state p {
          font-size: 14px;
          max-width: 400px;
          margin: 0 auto;
        }

        .properties-table {
          background: white;
          border-radius: 12px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        th, td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .sortable-th {
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sortable-th:hover {
          color: #3b82f6;
        }

        td {
          font-size: 14px;
          color: #0f172a;
        }

        .property-address {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .address-text {
          font-weight: 600;
          font-size: 14px;
        }

        .parcel-id {
          font-size: 11px;
          color: #94a3b8;
        }

        .location-cell {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #64748b;
        }

        .number-cell {
          font-variant-numeric: tabular-nums;
        }

        .owner-cell {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .value-cell {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: #059669;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 12px 24px;
          border-radius: 12px;
        }

        .page-info {
          font-size: 14px;
          color: #64748b;
        }

        .page-buttons {
          display: flex;
          gap: 8px;
        }

        .page-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 14px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .data-loading {
          background: white;
          padding: 48px;
          text-align: center;
          color: #64748b;
          border-radius: 12px;
        }

        .info-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px;
          padding: 20px;
        }

        .info-box h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1e40af;
          margin: 0 0 12px 0;
        }

        .info-box p {
          font-size: 14px;
          color: #1e3a8a;
          margin: 0 0 12px 0;
        }

        .info-box ul {
          margin: 0;
          padding-left: 20px;
          color: #1e3a8a;
          font-size: 14px;
        }

        .info-box li {
          margin-bottom: 6px;
        }

        .info-box strong {
          color: #1e40af;
        }
      `}</style>
    </div>
  );
};

export default MarketDataTab;
