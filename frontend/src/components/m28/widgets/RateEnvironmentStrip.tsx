/**
 * RateEnvironmentStrip - Horizontal ticker showing current rates
 * Usage: <RateEnvironmentStrip />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { RateEnvironment } from '../../../types/m28.types';

const policyStanceColors = {
  easing: 'text-green-600',
  neutral: 'text-blue-600',
  tightening: 'text-red-600',
  emergency: 'text-purple-600',
};

export const RateEnvironmentStrip: React.FC = () => {
  const [rates, setRates] = useState<RateEnvironment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await m28Client.getRateEnvironment();
        setRates(data);
      } catch (err) {
        console.error('Error fetching rate environment:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    // Refresh every 5 minutes
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !rates) {
    return (
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-6 text-sm animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-20"></div>
          <div className="h-4 bg-gray-300 rounded w-20"></div>
          <div className="h-4 bg-gray-300 rounded w-20"></div>
        </div>
      </div>
    );
  }

  const policyColor = policyStanceColors[rates.policy_stance];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
      <div className="flex items-center gap-6 text-sm font-medium text-gray-700 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">FFR:</span>
          <span className="font-semibold">{rates.ffr}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">10Y:</span>
          <span className="font-semibold">{rates.t10y}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">30Y Mtg:</span>
          <span className="font-semibold">{rates.t30y_mtg}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">M2 YoY:</span>
          <span className="font-semibold">{rates.m2_yoy}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Policy:</span>
          <span className={`font-semibold capitalize ${policyColor}`}>
            {rates.policy_stance}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500">Curve:</span>
          <span className="font-semibold capitalize">
            {rates.forward_direction === 'rising' && '📈 Rising'}
            {rates.forward_direction === 'falling' && '📉 Falling'}
            {rates.forward_direction === 'flat' && '➡️ Flat'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            Updated: {new Date(rates.snapshot_date).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
