/**
 * M07: Rent Roll Validator
 *
 * Scores each lease event row for extraction confidence (0.0–1.0)
 * and computes an overall snapshot confidence score.
 *
 * Rules:
 *   - Missing required field: -0.2 per field
 *   - Implausible value (negative rent, future lease_start > 5 yrs out): -0.1 per issue
 *   - Rows with confidence < 0.5 are stored but flagged low-confidence
 */

import type { RentRollLeaseEvent } from '../../types/traffic-calibration.types';

const NOW = new Date();
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export interface ValidationResult {
  row_confidence: number;    // 0.0–1.0
  issues: string[];
}

export class RentRollValidatorService {

  validateRow(event: Partial<RentRollLeaseEvent>): ValidationResult {
    let confidence = 1.0;
    const issues: string[] = [];

    // Required fields
    if (!event.unit_id) {
      confidence -= 0.1;
      issues.push('missing unit_id');
    }
    if (!event.unit_type) {
      confidence -= 0.1;
      issues.push('missing unit_type');
    }
    if (!event.unit_status) {
      confidence -= 0.1;
      issues.push('missing unit_status');
    }

    // Rent plausibility
    if (event.contract_rent !== undefined) {
      if (event.contract_rent <= 0) {
        confidence -= 0.2;
        issues.push('non-positive contract_rent');
      } else if (event.contract_rent > 30000) {
        confidence -= 0.1;
        issues.push('implausibly high contract_rent (>30k)');
      }
    }

    if (event.market_rent !== undefined && event.market_rent <= 0) {
      confidence -= 0.1;
      issues.push('non-positive market_rent');
    }

    // Date plausibility
    if (event.lease_start) {
      const msOut = event.lease_start.getTime() - NOW.getTime();
      if (msOut > FIVE_YEARS_MS) {
        confidence -= 0.1;
        issues.push('lease_start > 5 years in future');
      }
    }

    if (event.lease_end && event.lease_start) {
      if (event.lease_end < event.lease_start) {
        confidence -= 0.2;
        issues.push('lease_end before lease_start');
      }
    }

    // Days vacant plausibility
    if (event.days_vacant !== undefined && event.days_vacant < 0) {
      confidence -= 0.1;
      issues.push('negative days_vacant');
    }

    return {
      row_confidence: Math.max(0, Math.round(confidence * 100) / 100),
      issues,
    };
  }

  computeSnapshotConfidence(rowConfidences: number[], missingFieldCount: number): number {
    if (rowConfidences.length === 0) return 0;
    const avg = rowConfidences.reduce((a, b) => a + b, 0) / rowConfidences.length;
    // Penalize for missing required fields in mapping
    const mappingPenalty = Math.min(0.3, missingFieldCount * 0.05);
    return Math.max(0, Math.round((avg - mappingPenalty) * 1000) / 1000);
  }
}

export const rentRollValidatorService = new RentRollValidatorService();
