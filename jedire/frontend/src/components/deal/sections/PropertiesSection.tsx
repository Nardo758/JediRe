import React, { useState } from 'react';
import { Search, Filter, MapPin, Plus, Upload, AlertCircle, Clock, TrendingUp, Target } from 'lucide-react';
import { Deal, Property } from '@/types';
import { PropertyCard } from '@/components/property/PropertyCard';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';

interface PropertiesSectionProps {
  deal: Deal;
  enhanced?: boolean;
  onToggleModule?: () => void;
}

export function PropertiesSection({ deal, enhanced = false, onToggleModule }: PropertiesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBeds, setSelectedBeds] = useState<string>('all');
  const [rentRange, setRentRange] = useState<[number, number]>([0, 10000]);
  const [properties, setProperties] = useState<Property[]>([]);

  const buildingClasses = ['all', 'A', 'B', 'C', 'D'];
  const bedsOptions = ['all', '1', '2', '3', '4+'];

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || property.class === selectedClass;
    const matchesBeds = selectedBeds === 'all' || 
      (selectedBeds === '4+' ? property.beds >= 4 : property.beds === parseInt(selectedBeds));
    const matchesRent = property.rent >= rentRange[0] && property.rent <= rentRange[1];
    
    return matchesSearch && matchesClass && matchesBeds && matchesRent;
  });

  if (!enhanced) {
    return (
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3">
              {/* Building Class Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Building Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {buildingClasses.map(cls => (
                    <option key={cls} value={cls}>
                      {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Beds Filter */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bedrooms
                </label>
                <select
                  value={selectedBeds}
                  onChange={(e) => setSelectedBeds(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {bedsOptions.map(beds => (
                    <option key={beds} value={beds}>
                      {beds === 'all' ? 'All' : `${beds} bed${beds === '1' ? '' : 's'}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rent Range */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rent Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={rentRange[0]}
                    onChange={(e) => setRentRange([parseInt(e.target.value) || 0, rentRange[1]])}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={rentRange[1]}
                    onChange={(e) => setRentRange([rentRange[0], parseInt(e.target.value) || 10000])}
                    className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <MapPin className="w-4 h-4" />
            Search Nearby
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Add Property
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" />
            Import from Map
          </button>
        </div>

        {/* Properties List or Empty State */}
        {filteredProperties.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No properties found yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Start building your portfolio by searching nearby or adding properties manually
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}

        {/* Module Upsell */}
        {onToggleModule && (
          <ModuleUpsellBanner
            moduleName="Property Intelligence"
            benefits={[
              'Lease expiration alerts and timelines',
              'Negotiation power scores',
              'Rent gap analysis vs. market rates',
              'Distance calculations from deal center'
            ]}
            price="$29"
            onAddModule={onToggleModule}
            onLearnMore={() => {}}
          />
        )}
      </div>
    );
  }

  // Enhanced version with Property Intelligence
  return (
    <div className="space-y-6">
      {/* Search and Filters - Same as basic */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Building Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {buildingClasses.map(cls => (
                  <option key={cls} value={cls}>
                    {cls === 'all' ? 'All Classes' : `Class ${cls}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrooms
              </label>
              <select
                value={selectedBeds}
                onChange={(e) => setSelectedBeds(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {bedsOptions.map(beds => (
                  <option key={beds} value={beds}>
                    {beds === 'all' ? 'All' : `${beds} bed${beds === '1' ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rent Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={rentRange[0]}
                  onChange={(e) => setRentRange([parseInt(e.target.value) || 0, rentRange[1]])}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={rentRange[1]}
                  onChange={(e) => setRentRange([rentRange[0], parseInt(e.target.value) || 10000])}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">Expiring Soon</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">3</p>
          <p className="text-xs text-gray-500">Next 90 days</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">High Power</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">5</p>
          <p className="text-xs text-gray-500">Strong negotiation position</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Below Market</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">8</p>
          <p className="text-xs text-gray-500">Rent gap opportunities</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">Avg Distance</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">0.8mi</p>
          <p className="text-xs text-gray-500">From deal center</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
          <MapPin className="w-4 h-4" />
          Search Nearby
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Property
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
          <Upload className="w-4 h-4" />
          Import from Map
        </button>
      </div>

      {/* Enhanced Properties List */}
      {filteredProperties.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No properties found yet
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Start building your portfolio by searching nearby or adding properties manually
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map(property => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
