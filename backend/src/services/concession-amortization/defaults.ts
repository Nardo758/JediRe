/**
 * concession-amortization/defaults.ts
 *
 * §4 Platform default amortization method table.
 *
 * Maps a LeaseEventType (produced by the LV Engine per monthly signing event)
 * to the default AmortizationMethod applied to the resulting ConcessionRecord.
 *
 * Override hierarchy (lowest to highest priority):
 *   Platform default (this table) → deal-level setting → per-record expert override (future UI)
 *
 * LEASE_EVENT_TYPE_TO_METHOD is intentionally a plain object (not a function)
 * so callers can inspect it for display/documentation without instantiation.
 */

import type { AmortizationMethod } from '../../types/concessions';

/**
 * Internal lease event classification used by the LV Engine when
 * assembling ConcessionRecord entries from monthly signing outputs.
 *
 *   NEW_LEASE_ONETIME    — one-time concession on a new lease (e.g. first-month-free)
 *   NEW_LEASE_ONGOING    — recurring concession on a new lease (e.g. ongoing reduced rent)
 *   RENEWAL_ONETIME      — one-time concession on a renewal
 *   RENEWAL_ONGOING      — recurring concession on a renewal
 *   LEASE_UP_INCENTIVE   — new-lease concession incurred during the lease-up window
 *                          (delivery_month → stabilization_achieved_month, LEASE_UP mode only)
 *   PRE_LEASE_BONUS      — signing incentive paid before the property delivery month
 */
export type LeaseEventType =
  | 'NEW_LEASE_ONETIME'
  | 'NEW_LEASE_ONGOING'
  | 'RENEWAL_ONETIME'
  | 'RENEWAL_ONGOING'
  | 'LEASE_UP_INCENTIVE'
  | 'PRE_LEASE_BONUS';

/**
 * §4 Platform default method table.
 *
 * Keyed by LeaseEventType. Each value is the AmortizationMethod applied
 * to ConcessionRecords of that event type unless overridden by the caller.
 */
export const PLATFORM_DEFAULT_AMORTIZATION_METHOD: Readonly<Record<LeaseEventType, AmortizationMethod>> = {
  NEW_LEASE_ONETIME:  'STRAIGHT_LINE_GAAP',
  NEW_LEASE_ONGOING:  'STRAIGHT_LINE_GAAP',
  RENEWAL_ONETIME:    'STRAIGHT_LINE_GAAP',
  RENEWAL_ONGOING:    'STRAIGHT_LINE_GAAP',
  LEASE_UP_INCENTIVE: 'FRONT_LOADED',
  PRE_LEASE_BONUS:    'CASH_AT_COMMENCEMENT',
} as const;

/**
 * Resolve the default AmortizationMethod for a given LeaseEventType.
 * Returns 'STRAIGHT_LINE_GAAP' as a safe fallback for unknown types.
 */
export function defaultMethodForEventType(eventType: LeaseEventType): AmortizationMethod {
  return PLATFORM_DEFAULT_AMORTIZATION_METHOD[eventType] ?? 'STRAIGHT_LINE_GAAP';
}
