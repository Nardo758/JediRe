/**
 * Hero Metrics - Top row KPI cards
 */

import React from 'react';

export interface MetricCard {
  label: string;
  value: string;
  subtitle?: string;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
  icon?: React.ReactNode;
}

interface HeroMetricsProps {
  metrics: MetricCard[];
}

export function HeroMetrics({ metrics }: HeroMetricsProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'good': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'bad': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getTextColor = (status?: string) => {
    switch (status) {
      case 'good': return 'text-green-900';
      case 'warning': return 'text-yellow-900';
      case 'bad': return 'text-red-900';
      default: return 'text-gray-900';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, idx) => (
        <div
          key={idx}
          className={`rounded-lg border p-4 ${getStatusColor(metric.status)}`}
        >
          {metric.icon && (
            <div className="mb-2">{metric.icon}</div>
          )}
          <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
          <div className={`text-2xl font-bold ${getTextColor(metric.status)}`}>
            {metric.value}
          </div>
          {metric.subtitle && (
            <div className="text-xs text-gray-600 mt-1">{metric.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}
