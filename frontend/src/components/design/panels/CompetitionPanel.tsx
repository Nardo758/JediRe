import React, { useState } from 'react';
import { useDesignDashboardStore } from '../../../stores/DesignDashboardStore';
import { Eye, EyeOff, Plus, Trash2, Filter, MapPin } from 'lucide-react';

export const CompetitionPanel: React.FC = () => {
  const {
    competingProperties,
    selectedCompetitor,
    addCompetitor,
    removeCompetitor,
    toggleCompetitorVisibility,
    selectCompetitor,
  } = useDesignDashboardStore();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minUnits: 0,
    maxUnits: 999,
    maxDistance: 5,
    minOccupancy: 0,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({
    name: '',
    units: 100,
    monthlyRent: 2000,
    occupancy: 95,
    yearBuilt: 2020,
  });

  const handleAddCompetitor = () => {
    const id = Date.now().toString();
    addCompetitor({
      id,
      name: newCompetitor.name || 'New Competitor',
      location: [-118.2437, 34.0522], // Default location
      units: newCompetitor.units,
      yearBuilt: newCompetitor.yearBuilt,
      monthlyRent: newCompetitor.monthlyRent,
      occupancy: newCompetitor.occupancy,
      distance: Math.random() * 5, // Random distance for demo
      visible: true,
    });
    setNewCompetitor({
      name: '',
      units: 100,
      monthlyRent: 2000,
      occupancy: 95,
      yearBuilt: 2020,
    });
    setShowAddForm(false);
  };

  const filteredProperties = competingProperties.filter((prop) => {
    return (
      prop.units >= filters.minUnits &&
      prop.units <= filters.maxUnits &&
      prop.distance <= filters.maxDistance &&
      prop.occupancy >= filters.minOccupancy
    );
  });

  const averageRent = filteredProperties.length > 0
    ? filteredProperties.reduce((sum, p) => sum + p.monthlyRent, 0) / filteredProperties.length
    : 0;

  const averageOccupancy = filteredProperties.length > 0
    ? filteredProperties.reduce((sum, p) => sum + p.occupancy, 0) / filteredProperties.length
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Competition Analysis</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 text-blue-600 hover:text-blue-700"
            title="Add Competitor"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600 text-xs">Avg Rent</div>
            <div className="font-semibold">${averageRent.toFixed(0)}/mo</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-gray-600 text-xs">Avg Occupancy</div>
            <div className="font-semibold">{averageOccupancy.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-blue-50 border-b">
          <h4 className="text-sm font-medium mb-2">Add Competitor</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Property Name"
              value={newCompetitor.name}
              onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Units"
                value={newCompetitor.units}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, units: parseInt(e.target.value) })}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="number"
                placeholder="Year Built"
                value={newCompetitor.yearBuilt}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, yearBuilt: parseInt(e.target.value) })}
                className="px-2 py-1 text-sm border rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Monthly Rent"
                value={newCompetitor.monthlyRent}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, monthlyRent: parseInt(e.target.value) })}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="number"
                placeholder="Occupancy %"
                value={newCompetitor.occupancy}
                onChange={(e) => setNewCompetitor({ ...newCompetitor, occupancy: parseInt(e.target.value) })}
                className="px-2 py-1 text-sm border rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddCompetitor}
                className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          Filters ({filteredProperties.length}/{competingProperties.length})
        </button>
        
        {showFilters && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600">Min Units</label>
                <input
                  type="number"
                  value={filters.minUnits}
                  onChange={(e) => setFilters({ ...filters, minUnits: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Max Units</label>
                <input
                  type="number"
                  value={filters.maxUnits}
                  onChange={(e) => setFilters({ ...filters, maxUnits: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600">Max Distance (mi)</label>
                <input
                  type="number"
                  value={filters.maxDistance}
                  onChange={(e) => setFilters({ ...filters, maxDistance: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border rounded"
                  step="0.5"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Min Occupancy %</label>
                <input
                  type="number"
                  value={filters.minOccupancy}
                  onChange={(e) => setFilters({ ...filters, minOccupancy: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Properties List */}
      <div className="flex-1 overflow-y-auto">
        {filteredProperties.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No competing properties found
          </div>
        ) : (
          <div className="divide-y">
            {filteredProperties.map((property) => (
              <div
                key={property.id}
                className={`p-3 hover:bg-gray-50 cursor-pointer ${
                  selectedCompetitor === property.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectCompetitor(property.id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h4 className="font-medium text-sm">{property.name}</h4>
                    <p className="text-xs text-gray-600">
                      {property.units} units • Built {property.yearBuilt}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompetitorVisibility(property.id);
                      }}
                      className="p-1 text-gray-600 hover:text-gray-800"
                    >
                      {property.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCompetitor(property.id);
                      }}
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Rent:</span>
                    <span className="font-medium ml-1">${property.monthlyRent}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Occ:</span>
                    <span className="font-medium ml-1">{property.occupancy}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Dist:</span>
                    <span className="font-medium ml-1">{property.distance.toFixed(1)}mi</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-gray-50">
        <button className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Import from CoStar/Apartments
        </button>
      </div>
    </div>
  );
};