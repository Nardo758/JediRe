import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrafficIntelligenceSection } from '../../components/deal/sections/TrafficIntelligenceSection';

const MARKET_CONTEXT_DEAL = {
  id: 'market-traffic',
  name: 'Atlanta Market',
  address: 'Atlanta, GA',
  market: 'Atlanta',
  submarket: 'Midtown',
} as any;

const TrafficIntelligencePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/market-intelligence')}
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              {'\u2190'} Market Intelligence
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Traffic Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">
              Physical and digital traffic analysis, walk-in predictions, and resident sentiment
            </p>
          </div>
        </div>

        <TrafficIntelligenceSection deal={MARKET_CONTEXT_DEAL} />
      </div>
    </div>
  );
};

export default TrafficIntelligencePage;
