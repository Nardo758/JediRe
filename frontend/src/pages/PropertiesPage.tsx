import React from 'react';

export function PropertiesPage() {
  const sampleProperties = [
    { address: '100 Peachtree St', rent: 2100, beds: 2, baths: 2, sqft: 1100, class: 'A' },
    { address: '250 Pharr Rd', rent: 2400, beds: 2, baths: 2, sqft: 1250, class: 'A' },
    { address: '150 E Paces Ferry', rent: 2800, beds: 3, baths: 2, sqft: 1500, class: 'A+' },
    { address: '1065 Peachtree St', rent: 1800, beds: 1, baths: 1, sqft: 850, class: 'B+' },
    { address: '1280 W Peachtree St', rent: 1900, beds: 2, baths: 2, sqft: 950, class: 'B+' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Properties</h1>
        <p className="text-gray-600">Manage and analyze your property portfolio</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search properties..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>All Classes</option>
            <option>A+</option>
            <option>A</option>
            <option>B+</option>
            <option>B</option>
            <option>C+</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>All Neighborhoods</option>
            <option>Buckhead</option>
            <option>Midtown</option>
            <option>Virginia Highland</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Filter
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">23</div>
          <div className="text-sm text-gray-600">Total Properties</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">$1,845</div>
          <div className="text-sm text-gray-600">Avg Rent</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">94%</div>
          <div className="text-sm text-gray-600">Occupancy</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">8</div>
          <div className="text-sm text-gray-600">Opportunities</div>
        </div>
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-3 gap-6">
        {sampleProperties.map((property, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
            {/* Property Image Placeholder */}
            <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <span className="text-6xl">🏢</span>
            </div>

            {/* Property Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{property.address}</h3>
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  property.class === 'A+' ? 'bg-green-100 text-green-800' :
                  property.class === 'A' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {property.class}
                </span>
              </div>

              <div className="text-2xl font-bold text-blue-600 mb-2">
                ${property.rent.toLocaleString()}/mo
              </div>

              <div className="flex gap-4 text-sm text-gray-600 mb-3">
                <span>{property.beds} bd</span>
                <span>{property.baths} ba</span>
                <span>{property.sqft} sqft</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Analyze
                </button>
                <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
