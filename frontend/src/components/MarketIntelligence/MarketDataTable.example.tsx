/**
 * EXAMPLE INTEGRATION: MarketDataTab.tsx
 * 
 * This file shows how to integrate the MarketDataTable component
 * into your MarketDataTab component.
 */

import { useState } from 'react';
import MarketDataTable from './MarketDataTable';
// import PropertyIntelligenceModal from './PropertyIntelligenceModal'; // You'll create this

interface MarketDataTabProps {
  marketId: string;
}

export default function MarketDataTab({ marketId }: MarketDataTabProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  
  const handlePropertyClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    // This will open your PropertyIntelligenceModal
    console.log('Opening property details for:', propertyId);
  };
  
  const handleCloseModal = () => {
    setSelectedPropertyId(null);
  };
  
  return (
    <div className="space-y-6">
      {/* Market Overview Cards (if any) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add your market summary cards here */}
      </div>
      
      {/* Property Data Table */}
      <MarketDataTable 
        marketId={marketId}
        onPropertyClick={handlePropertyClick}
      />
      
      {/* Property Intelligence Modal */}
      {selectedPropertyId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Content */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Property Intelligence</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="text-gray-600">
                Property ID: {selectedPropertyId}
              </div>
              
              {/* 
                TODO: Add PropertyIntelligenceModal content here:
                - Property details
                - Owner information
                - Sales history
                - Comparable properties
                - Market analysis
                - Investment metrics
              */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * API INTEGRATION NOTES:
 * 
 * When ready to connect to real API, replace the mock data in MarketDataTable.tsx:
 * 
 * 1. Create API endpoint in backend:
 *    GET /api/market-intelligence/properties?marketId={marketId}
 * 
 * 2. Query the property_records table:
 *    SELECT 
 *      pr.*,
 *      CASE 
 *        WHEN pr.units > 0 AND pr.building_sqft > 0 
 *        THEN pr.building_sqft / pr.units 
 *        ELSE NULL 
 *      END AS sqft_per_unit,
 *      ps.sale_year AS last_sale_year,
 *      ps.sale_price AS last_sale_price,
 *      (EXTRACT(YEAR FROM NOW()) - ps.sale_year) AS hold_period_years
 *    FROM property_records pr
 *    LEFT JOIN (
 *      SELECT DISTINCT ON (parcel_id) 
 *        parcel_id, sale_year, sale_price
 *      FROM property_sales
 *      ORDER BY parcel_id, sale_year DESC
 *    ) ps ON pr.parcel_id = ps.parcel_id
 *    WHERE pr.county = 'Fulton' AND pr.state = 'GA'
 *    ORDER BY pr.address;
 * 
 * 3. Replace useMemo() in MarketDataTable with useEffect + API call:
 *    const [properties, setProperties] = useState<PropertyIntelligenceRecord[]>([]);
 *    const [loading, setLoading] = useState(true);
 *    
 *    useEffect(() => {
 *      fetchProperties();
 *    }, [marketId]);
 *    
 *    async function fetchProperties() {
 *      const response = await fetch(`/api/market-intelligence/properties?marketId=${marketId}`);
 *      const data = await response.json();
 *      setProperties(data.properties);
 *      setLoading(false);
 *    }
 * 
 * 4. Update data_source badge logic to show REAL vs MOCK per property
 */
