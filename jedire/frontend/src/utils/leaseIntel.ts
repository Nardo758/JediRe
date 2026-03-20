import { Property } from '../types';

export function calculateNegotiationPower(property: Property): {
  score: number;
  signal: 'high' | 'medium' | 'low';
  reason: string;
} {
  const expirationDate = property.lease_expiration_date
    ? new Date(property.lease_expiration_date)
    : null;

  if (!expirationDate) {
    return { score: 0, signal: 'low', reason: 'No lease data available' };
  }

  const daysUntilExpiration = Math.floor(
    (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration <= 30 && daysUntilExpiration >= 0) {
    return {
      score: 85,
      signal: 'high',
      reason: 'Lease expiring soon - landlord motivated to fill'
    };
  }

  if (daysUntilExpiration <= 60 && daysUntilExpiration > 30) {
    return {
      score: 60,
      signal: 'medium',
      reason: 'Lease expiring in 2 months - good timing for negotiation'
    };
  }

  return { score: 20, signal: 'low', reason: 'Lease not expiring soon' };
}

export function calculateBelowMarketGap(
  currentLease: number,
  marketRate: number
): number {
  return Math.max(0, marketRate - currentLease);
}
