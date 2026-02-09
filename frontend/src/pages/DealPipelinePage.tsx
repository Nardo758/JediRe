import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { Plus, MoreVertical, MapPin, DollarSign, Clock } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface Deal {
  id: string;
  address: string;
  city: string;
  price: number;
  stage: string;
  daysInStage: number;
  score: number;
  strategy: string;
  lat?: number;
  lng?: number;
}

const stages = ['Watching', 'Analyzing', 'Due Diligence', 'Offer', 'Under Contract', 'Closing'];

const initialDeals: Deal[] = [
  { id: '1', address: '123 Oak Street', city: 'Austin, TX', price: 425000, stage: 'Watching', daysInStage: 3, score: 92, strategy: 'Build-to-Sell', lat: 30.2672, lng: -97.7431 },
  { id: '2', address: '456 Pine Avenue', city: 'Austin, TX', price: 385000, stage: 'Watching', daysInStage: 7, score: 85, strategy: 'Rental', lat: 30.2750, lng: -97.7400 },
  { id: '3', address: '789 Cedar Lane', city: 'Austin, TX', price: 510000, stage: 'Analyzing', daysInStage: 2, score: 88, strategy: 'Flip', lat: 30.2600, lng: -97.7500 },
  { id: '4', address: '321 Maple Drive', city: 'Austin, TX', price: 295000, stage: 'Due Diligence', daysInStage: 5, score: 78, strategy: 'Airbnb', lat: 30.2800, lng: -97.7350 },
  { id: '5', address: '555 Elm Court', city: 'Austin, TX', price: 475000, stage: 'Offer', daysInStage: 1, score: 90, strategy: 'Build-to-Sell', lat: 30.2550, lng: -97.7600 },
  { id: '6', address: '777 Birch Road', city: 'Austin, TX', price: 620000, stage: 'Under Contract', daysInStage: 12, score: 94, strategy: 'Flip', lat: 30.2900, lng: -97.7200 },
];

export default function DealPipelinePage() {
  const location = useLocation();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDrop = (stage: string) => {
    if (draggedDeal) {
      setDeals(deals.map(d => 
        d.id === draggedDeal.id ? { ...d, stage, daysInStage: 0 } : d
      ));
      setDraggedDeal(null);
    }
  };

  const getDealsForStage = (stage: string) => deals.filter(d => d.stage === stage);
  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Watching': 'bg-gray-500',
      'Analyzing': 'bg-blue-500',
      'Due Diligence': 'bg-yellow-500',
      'Offer': 'bg-purple-500',
      'Under Contract': 'bg-orange-500',
      'Closing': 'bg-green-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-97.7431, 30.2672],
      zoom: 12,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    deals.forEach(deal => {
      if (deal.lat && deal.lng) {
        const el = document.createElement('div');
        el.className = 'w-3 h-3 rounded-full border-2 border-white shadow-md';
        el.style.backgroundColor = deal.strategy === 'Build-to-Sell' ? '#22c55e' :
          deal.strategy === 'Flip' ? '#3b82f6' :
          deal.strategy === 'Rental' ? '#a855f7' : '#f97316';
        new mapboxgl.Marker(el).setLngLat([deal.lng, deal.lat])
          .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
            `<strong>${deal.address}</strong><br/>${deal.city}<br/>${formatCurrency(deal.price)}`
          ))
          .addTo(map.current!);
      }
    });

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Deal Pipeline</h2>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Deal
        </button>
      </div>

      <div className="space-y-4">
        {stages.map(stage => (
          <div
            key={stage}
            className="bg-white rounded-xl p-3 border border-gray-200"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStageColor(stage)}`} />
                <h3 className="font-semibold text-gray-900 text-sm">{stage}</h3>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {getDealsForStage(stage).length}
              </span>
            </div>

            <div className="space-y-2">
              {getDealsForStage(stage).map(deal => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => handleDragStart(deal)}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-100 cursor-move hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{deal.address}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {deal.city}
                      </p>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-900 font-semibold text-xs">{formatCurrency(deal.price)}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      deal.strategy === 'Build-to-Sell' ? 'bg-green-100 text-green-700' :
                      deal.strategy === 'Flip' ? 'bg-blue-100 text-blue-700' :
                      deal.strategy === 'Rental' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {deal.strategy}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {deal.daysInStage}d in stage
                    </span>
                    <span className="font-semibold text-gray-700">Score: {deal.score}</span>
                  </div>
                </div>
              ))}

              {getDealsForStage(stage).length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg">
                  Drop deals here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderMap = () => (
    <div ref={mapContainer} className="absolute inset-0" />
  );

  return (
    <ThreePanelLayout
      storageKey="pipeline"
      showViewsPanel={false}
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}
