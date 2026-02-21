// MarketDataTab.tsx - Research data points for market analysis
// Created: 2026-02-21
// This replaces/refactors the existing MarketDataPageV2

import React, { useState, useEffect } from 'react';
import { Download, Search, Filter } from 'lucide-react';
import type { MarketSummaryResponse } from '../../../types/marketIntelligence.types';

interface PropertyRecord {
  id: number;
  property_name: string;
  address: string;
  units: number;
  owner_name: string;
  year_built: number;
  assessed_value: number;
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

  useEffect(() => {
    loadProperties();
  }, [marketId]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      // This would call the existing property records API
      const response = await fetch(`/api/v1/property-records?market_id=${marketId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setProperties(data.properties || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(p =>
    p.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="market-data-tab">
      {/* Header */}
      <div className="data-header">
        <div>
          <h2>Market Research Data</h2>
          <p>
            {summary.market.data_points_count.toLocaleString()} data points for market analysis
            • Used to assess trends, find acquisition targets, and benchmark deals
          </p>
        </div>
        <div className="data-actions">
          <button className="export-button">
            <Download size={18} />
            Export Data
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="search-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search properties, owners, addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="filter-button">
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* Properties Table */}
      {loading ? (
        <div className="data-loading">Loading properties...</div>
      ) : (
        <div className="properties-table">
          <table>
            <thead>
              <tr>
                <th>Property Name</th>
                <th>Address</th>
                <th>Units</th>
                <th>Owner</th>
                <th>Year Built</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {properties.length === 0 
                      ? 'No properties loaded yet. Import data to get started.'
                      : 'No properties match your search.'}
                  </td>
                </tr>
              ) : (
                filteredProperties.slice(0, 50).map(property => (
                  <tr key={property.id}>
                    <td className="property-name">{property.property_name || 'Unnamed'}</td>
                    <td>{property.address}</td>
                    <td>{property.units}</td>
                    <td>{property.owner_name || 'N/A'}</td>
                    <td>{property.year_built || 'N/A'}</td>
                    <td>
                      {property.assessed_value 
                        ? `$${(property.assessed_value / 1000000).toFixed(1)}M` 
                        : 'N/A'}
                    </td>
                    <td>
                      <button className="view-button">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {filteredProperties.length > 50 && (
            <div className="pagination-info">
              Showing 50 of {filteredProperties.length.toLocaleString()} properties
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <h3>💡 About Market Data</h3>
        <p>
          This research data is used to analyze market trends and identify opportunities.
          It is NOT your portfolio - those are tracked in the "Deals" tab.
        </p>
        <ul>
          <li><strong>Acquisition Targeting:</strong> Find properties that meet your criteria</li>
          <li><strong>Owner Outreach:</strong> Contact information for direct outreach campaigns</li>
          <li><strong>Comparable Sales:</strong> Historical transactions for valuation</li>
          <li><strong>Market Analysis:</strong> Rent benchmarking, vintage cohorts, cap rates</li>
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

        .filter-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-button:hover {
          background: #f8fafc;
        }

        .properties-table {
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        td {
          font-size: 14px;
          color: #0f172a;
        }

        .property-name {
          font-weight: 600;
        }

        .view-button {
          padding: 6px 12px;
          background: #f1f5f9;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          color: #3b82f6;
          cursor: pointer;
          transition: background 0.2s;
        }

        .view-button:hover {
          background: #e2e8f0;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }

        .pagination-info {
          padding: 16px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
          background: #f8fafc;
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
