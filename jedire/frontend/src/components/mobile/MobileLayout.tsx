import { useState } from 'react';
import MobileNavigation, { MobileTab } from './MobileNavigation';
import MobileHeader from './MobileHeader';
import MobileListView from './MobileListView';
import MobileSavedView from './MobileSavedView';
import MobileSettingsView from './MobileSettingsView';
import MobileBottomSheet from './MobileBottomSheet';
import MapView from '@/components/map/MapView';
import { Crosshair, SlidersHorizontal } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city?: string;
  price: number;
  strategy: string;
  roi: number;
  score: number;
}

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('map');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const getTitle = () => {
    switch (activeTab) {
      case 'map': return 'JediRe';
      case 'list': return 'Properties';
      case 'saved': return 'Saved';
      case 'settings': return 'Settings';
    }
  };

  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
  };

  const handleViewDetails = () => {
    console.log('View details for:', selectedProperty);
  };

  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      <MobileHeader title={getTitle()} />

      {activeTab === 'map' && (
        <div className="h-full pt-14 pb-16">
          <div className="h-full relative">
            <MapView />
            
            <div className="absolute bottom-32 left-4 right-4 flex justify-between">
              <button className="flex items-center gap-2 px-4 py-2 bg-white shadow-lg rounded-full text-sm font-medium text-gray-700">
                <Crosshair className="w-4 h-4" />
                My Location
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-white shadow-lg rounded-full text-sm font-medium text-gray-700"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <MobileListView onPropertySelect={handlePropertySelect} />
      )}

      {activeTab === 'saved' && (
        <MobileSavedView />
      )}

      {activeTab === 'settings' && (
        <MobileSettingsView />
      )}

      {activeTab === 'map' && (
        <MobileBottomSheet
          property={selectedProperty || {
            id: '1',
            address: '456 Oak St',
            price: 285000,
            strategy: 'Flip',
            roi: 24,
            score: 92,
          }}
          onClose={() => setSelectedProperty(null)}
          onViewDetails={handleViewDetails}
        />
      )}

      <MobileNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
