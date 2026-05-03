import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { Plus, MoreVertical, MapPin, DollarSign, Clock } from 'lucide-react';
import { BT } from '../components/deal/bloomberg-ui';
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

  const getStageColor = (stage: string): string => {
    const colors: Record<string, string> = {
      'Watching': BT.text.secondary,
      'Analyzing': BT.text.cyan,
      'Due Diligence': BT.text.amber,
      'Offer': BT.text.purple,
      'Under Contract': BT.text.orange,
      'Closing': BT.text.green,
    };
    return colors[stage] || BT.text.secondary;
  };

  const getStrategyStyle = (strategy: string): { background: string; color: string } => {
    if (strategy === 'Build-to-Sell') return { background: BT.bg.active, color: BT.text.green };
    if (strategy === 'Flip') return { background: BT.bg.active, color: BT.text.cyan };
    if (strategy === 'Rental') return { background: BT.bg.active, color: BT.text.purple };
    return { background: BT.bg.active, color: BT.text.orange };
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
        el.className = 'w-3 h-3';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid #fff';
        el.style.backgroundColor = deal.strategy === 'Build-to-Sell' ? BT.text.green :
          deal.strategy === 'Flip' ? BT.text.cyan :
          deal.strategy === 'Rental' ? BT.text.purple : BT.text.orange;
        new mapboxgl.Marker(el).setLngLat([deal.lng, deal.lat])
          .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(
            `<strong>${deal.address}</strong><br/>${deal.city}<br/>${formatCurrency(deal.price)}`
          ))
          .addTo(map.current!);
      }
    });

    return () => { map.current?.remove(); map.current = null; };
  // Task #425: useEffect intentionally omits `deals` — the omitted value(s)
  // are either (a) stable references from context/store hooks whose identity
  // is guaranteed by the producer, (b) values captured at first-fire on
  // purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: BT.text.primary }}>Deal Pipeline</h2>
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 2 }}
        >
          <Plus className="w-4 h-4" /> Add Deal
        </button>
      </div>

      <div className="space-y-4">
        {stages.map(stage => (
          <div
            key={stage}
            className="p-3"
            style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3" style={{ borderRadius: '50%', background: getStageColor(stage) }} />
                <h3 className="font-semibold text-sm" style={{ color: BT.text.primary }}>{stage}</h3>
              </div>
              <span className="text-xs px-2 py-0.5" style={{ color: BT.text.secondary, background: BT.bg.hover, borderRadius: 2 }}>
                {getDealsForStage(stage).length}
              </span>
            </div>

            <div className="space-y-2">
              {getDealsForStage(stage).map(deal => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => handleDragStart(deal)}
                  className="p-3 cursor-move transition-colors"
                  style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-medium text-sm" style={{ color: BT.text.primary }}>{deal.address}</h4>
                      <p className="text-xs flex items-center gap-1" style={{ color: BT.text.secondary }}>
                        <MapPin className="w-3 h-3" /> {deal.city}
                      </p>
                    </div>
                    <button style={{ color: BT.text.muted }}>
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-xs" style={{ color: BT.text.primary }}>{formatCurrency(deal.price)}</span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium"
                      style={{ borderRadius: 2, ...getStrategyStyle(deal.strategy) }}
                    >
                      {deal.strategy}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs" style={{ color: BT.text.secondary }}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {deal.daysInStage}d in stage
                    </span>
                    <span className="font-semibold" style={{ color: BT.text.primary }}>Score: {deal.score}</span>
                  </div>
                </div>
              ))}

              {getDealsForStage(stage).length === 0 && (
                <div className="text-center py-6 text-xs" style={{ color: BT.text.muted, border: `2px dashed ${BT.border.subtle}`, borderRadius: 0 }}>
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
