import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Plus, MoreVertical, MapPin, DollarSign, Clock, ChevronRight } from 'lucide-react';

interface Deal {
  id: string;
  address: string;
  city: string;
  price: number;
  stage: string;
  daysInStage: number;
  score: number;
  strategy: string;
}

const stages = ['Watching', 'Analyzing', 'Due Diligence', 'Offer', 'Under Contract', 'Closing'];

const initialDeals: Deal[] = [
  { id: '1', address: '123 Oak Street', city: 'Austin, TX', price: 425000, stage: 'Watching', daysInStage: 3, score: 92, strategy: 'Build-to-Sell' },
  { id: '2', address: '456 Pine Avenue', city: 'Austin, TX', price: 385000, stage: 'Watching', daysInStage: 7, score: 85, strategy: 'Rental' },
  { id: '3', address: '789 Cedar Lane', city: 'Austin, TX', price: 510000, stage: 'Analyzing', daysInStage: 2, score: 88, strategy: 'Flip' },
  { id: '4', address: '321 Maple Drive', city: 'Austin, TX', price: 295000, stage: 'Due Diligence', daysInStage: 5, score: 78, strategy: 'Airbnb' },
  { id: '5', address: '555 Elm Court', city: 'Austin, TX', price: 475000, stage: 'Offer', daysInStage: 1, score: 90, strategy: 'Build-to-Sell' },
  { id: '6', address: '777 Birch Road', city: 'Austin, TX', price: 620000, stage: 'Under Contract', daysInStage: 12, score: 94, strategy: 'Flip' },
];

export default function DealPipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Deal Pipeline</span>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Deal
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {stages.map(stage => (
            <div
              key={stage}
              className="w-80 bg-gray-200 rounded-xl p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStageColor(stage)}`} />
                  <h3 className="font-semibold text-gray-900">{stage}</h3>
                </div>
                <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded">
                  {getDealsForStage(stage).length}
                </span>
              </div>

              <div className="space-y-3">
                {getDealsForStage(stage).map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal)}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{deal.address}</h4>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {deal.city}
                        </p>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-gray-900 font-semibold">{formatCurrency(deal.price)}</span>
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
                  <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-300 rounded-lg">
                    Drop deals here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
