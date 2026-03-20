import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketTrend {
  metric: string;
  currentValue: string | number;
  previousValue: string | number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  category: 'rental' | 'supply' | 'demand' | 'economic';
}

export const MarketTrendsTable: React.FC = () => {
  // Mock data - would come from API in production
  const trends: MarketTrend[] = [
    {
      metric: 'Average Rent (1BR)',
      currentValue: '$2,450',
      previousValue: '$2,380',
      change: 2.9,
      trend: 'up',
      category: 'rental',
    },
    {
      metric: 'Vacancy Rate',
      currentValue: '4.2%',
      previousValue: '5.1%',
      change: -0.9,
      trend: 'down',
      category: 'supply',
    },
    {
      metric: 'New Units Delivered',
      currentValue: '1,250',
      previousValue: '980',
      change: 27.6,
      trend: 'up',
      category: 'supply',
    },
    {
      metric: 'Absorption Rate',
      currentValue: '96%',
      previousValue: '92%',
      change: 4.0,
      trend: 'up',
      category: 'demand',
    },
    {
      metric: 'Population Growth',
      currentValue: '2.1%',
      previousValue: '1.8%',
      change: 0.3,
      trend: 'up',
      category: 'economic',
    },
    {
      metric: 'Employment Growth',
      currentValue: '3.5%',
      previousValue: '3.4%',
      change: 0.1,
      trend: 'flat',
      category: 'economic',
    },
    {
      metric: 'Median Income',
      currentValue: '$78,500',
      previousValue: '$75,200',
      change: 4.4,
      trend: 'up',
      category: 'economic',
    },
    {
      metric: 'Cap Rates',
      currentValue: '5.25%',
      previousValue: '5.50%',
      change: -0.25,
      trend: 'down',
      category: 'rental',
    },
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'flat') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'flat':
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'rental':
        return 'bg-blue-100 text-blue-800';
      case 'supply':
        return 'bg-purple-100 text-purple-800';
      case 'demand':
        return 'bg-green-100 text-green-800';
      case 'economic':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Metric</th>
            <th className="text-left px-4 py-2 text-sm font-medium text-gray-700">Category</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Current</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Previous</th>
            <th className="text-right px-4 py-2 text-sm font-medium text-gray-700">Change</th>
            <th className="text-center px-4 py-2 text-sm font-medium text-gray-700">Trend</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="font-medium text-sm">{trend.metric}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(trend.category)}`}>
                  {trend.category}
                </span>
              </td>
              <td className="text-right px-4 py-3 text-sm font-medium">{trend.currentValue}</td>
              <td className="text-right px-4 py-3 text-sm text-gray-600">{trend.previousValue}</td>
              <td className="text-right px-4 py-3">
                <span className={`text-sm font-medium ${
                  trend.change > 0 ? 'text-green-600' : 
                  trend.change < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {trend.change > 0 && '+'}{trend.change}%
                </span>
              </td>
              <td className="text-center px-4 py-3">
                {getTrendIcon(trend.trend)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="p-4 bg-gray-50 border-t">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Data as of {new Date().toLocaleDateString()} • Source: CoStar, Census
          </p>
          <button className="text-sm text-blue-600 hover:text-blue-700">
            Download Full Report
          </button>
        </div>
      </div>
    </div>
  );
};