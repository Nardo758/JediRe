import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  TooltipProps,
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface SupplyWaveChartProps {
  marketId: string;
  data: Array<{
    year: number;
    pipeline: number;
    capacity: number;
    phase: string;
  }>;
}

interface PhaseConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  PEAKING: {
    label: 'PEAKING',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-300',
    icon: '📈',
  },
  CRESTING: {
    label: 'CRESTING',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-300',
    icon: '🌊',
  },
  TROUGH: {
    label: 'TROUGH',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-300',
    icon: '📉',
  },
  BUILDING: {
    label: 'BUILDING',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-300',
    icon: '📊',
  },
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const pipeline = payload.find(p => p.dataKey === 'pipeline')?.value || 0;
    const capacity = payload.find(p => p.dataKey === 'capacity')?.value || 0;
    const total = Number(pipeline) + Number(capacity);
    const phaseData = payload[0]?.payload as { phase: string };
    const phase = phaseData?.phase || 'UNKNOWN';
    const phaseConfig = PHASE_CONFIGS[phase] || PHASE_CONFIGS.BUILDING;

    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 min-w-[200px]">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
          <p className="text-lg font-bold text-gray-900">{label}</p>
          <span className="text-xl">{phaseConfig.icon}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-red-600 to-red-700 shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">Pipeline</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{pipeline.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">Capacity Conv.</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{capacity.toLocaleString()}</span>
          </div>
          
          <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-800">Total Supply</span>
            <span className="text-base font-bold text-indigo-600">{total.toLocaleString()}</span>
          </div>
        </div>
        
        <div className={`mt-3 pt-2 border-t border-gray-200 flex items-center justify-center gap-2 px-2 py-1 rounded ${phaseConfig.bgColor} border`}>
          <span className={`text-xs font-bold ${phaseConfig.color} tracking-wide`}>
            {phaseConfig.label}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

const CustomLegend = () => {
  return (
    <div className="flex items-center justify-center gap-6 mt-4 pb-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-gradient-to-br from-red-600 to-red-700 shadow-sm"></div>
        <span className="text-sm font-medium text-gray-700">Pipeline Development</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm"></div>
        <span className="text-sm font-medium text-gray-700">Capacity Conversion</span>
      </div>
    </div>
  );
};

const SupplyWaveChart: React.FC<SupplyWaveChartProps> = ({ marketId, data }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleMouseEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  // Calculate max value for Y-axis with some padding
  const maxValue = Math.max(
    ...data.map(d => d.pipeline + d.capacity)
  );
  const yAxisMax = Math.ceil(maxValue * 1.15 / 100) * 100;

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-gray-900">
            10-Year Supply Wave Forecast
          </h3>
          <div className="text-sm text-gray-500 font-medium">
            Market: <span className="text-indigo-600 font-semibold">{marketId}</span>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Pipeline development and capacity conversion projections (2026-2035)
        </p>
      </div>

      {/* Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 100, left: 20, bottom: 60 }}
            onMouseMove={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Gradient for Pipeline bars */}
              <linearGradient id="pipelineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={1} />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity={1} />
              </linearGradient>
              
              {/* Gradient for Capacity bars */}
              <linearGradient id="capacityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity={1} />
                <stop offset="100%" stopColor="#ea580c" stopOpacity={1} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            
            <XAxis
              dataKey="year"
              stroke="#6b7280"
              style={{ fontSize: '13px', fontWeight: 600 }}
              tick={{ fill: '#374151' }}
              tickLine={{ stroke: '#9ca3af' }}
            />
            
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '13px', fontWeight: 600 }}
              tick={{ fill: '#374151' }}
              tickLine={{ stroke: '#9ca3af' }}
              domain={[0, yAxisMax]}
              label={{
                value: 'Units',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: '14px', fontWeight: 700, fill: '#374151' }
              }}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
            
            {/* Pipeline Bar (bottom layer) */}
            <Bar
              dataKey="pipeline"
              stackId="supply"
              fill="url(#pipelineGradient)"
              radius={[0, 0, 4, 4]}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`pipeline-cell-${index}`}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                />
              ))}
            </Bar>
            
            {/* Capacity Bar (top layer) */}
            <Bar
              dataKey="capacity"
              stackId="supply"
              fill="url(#capacityGradient)"
              radius={[4, 4, 0, 0]}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`capacity-cell-${index}`}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Phase Badges - Positioned to the right of each bar */}
        <div className="absolute top-5 right-0 flex flex-col gap-[30px] mt-3">
          {data.map((item, index) => {
            const phaseConfig = PHASE_CONFIGS[item.phase] || PHASE_CONFIGS.BUILDING;
            return (
              <div
                key={`phase-${index}`}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide
                  ${phaseConfig.bgColor} ${phaseConfig.color}
                  transition-all duration-200 shadow-sm
                  ${activeIndex === index ? 'scale-110 shadow-md' : 'scale-100'}
                `}
                style={{ minWidth: '90px', justifyContent: 'center' }}
              >
                <span>{phaseConfig.icon}</span>
                <span>{phaseConfig.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <CustomLegend />

      {/* Phase Legend Reference */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Market Phase Indicators
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(PHASE_CONFIGS).map(([key, config]) => (
            <div
              key={key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor}`}
            >
              <span className="text-lg">{config.icon}</span>
              <span className={`text-xs font-bold ${config.color}`}>
                {config.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupplyWaveChart;
