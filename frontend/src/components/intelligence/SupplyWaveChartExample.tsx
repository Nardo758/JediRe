import React from 'react';
import SupplyWaveChart from './SupplyWaveChart';

/**
 * Example/Demo component for SupplyWaveChart
 * This shows how to use the component with mock DC-08 data
 */

const mockSupplyData = [
  { year: 2026, pipeline: 400, capacity: 45, phase: 'CRESTING' },
  { year: 2027, pipeline: 200, capacity: 52, phase: 'TROUGH' },
  { year: 2028, pipeline: 0, capacity: 48, phase: 'TROUGH' },
  { year: 2029, pipeline: 150, capacity: 55, phase: 'BUILDING' },
  { year: 2030, pipeline: 350, capacity: 60, phase: 'BUILDING' },
  { year: 2031, pipeline: 500, capacity: 58, phase: 'PEAKING' },
  { year: 2032, pipeline: 450, capacity: 50, phase: 'CRESTING' },
  { year: 2033, pipeline: 250, capacity: 45, phase: 'TROUGH' },
  { year: 2034, pipeline: 100, capacity: 42, phase: 'TROUGH' },
  { year: 2035, pipeline: 200, capacity: 50, phase: 'BUILDING' },
];

const SupplyWaveChartExample: React.FC = () => {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            JEDI RE Market Intelligence
          </h1>
          <p className="text-gray-600">
            10-Year Supply Wave Forecast - Future Supply Analysis
          </p>
        </div>

        {/* Main Chart */}
        <SupplyWaveChart 
          marketId="DC-08-Washington" 
          data={mockSupplyData} 
        />

        {/* Usage Example */}
        <div className="mt-8 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Usage Example</h2>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import SupplyWaveChart from './components/intelligence/SupplyWaveChart';

// With API data
const { data: supplyData } = useQuery(['supplyForecast', marketId], 
  () => fetchSupplyForecast(marketId)
);

// Render
<SupplyWaveChart 
  marketId={marketId} 
  data={supplyData} 
/>`}
          </pre>
        </div>

        {/* Key Features */}
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Dual-Layer Visualization
            </h3>
            <p className="text-sm text-gray-600">
              Stacked bars showing Pipeline (red) and Capacity Conversion (orange) 
              with gradient fills for visual depth.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="text-3xl mb-3">🌊</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Phase Annotations
            </h3>
            <p className="text-sm text-gray-600">
              Real-time phase indicators (PEAKING, CRESTING, TROUGH, BUILDING) 
              that highlight market conditions per year.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="text-3xl mb-3">💡</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Interactive Tooltips
            </h3>
            <p className="text-sm text-gray-600">
              Hover over any year to see detailed breakdown of supply sources 
              and total projections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplyWaveChartExample;
