import { InterpretationDecision } from '../components/zoning/tabs/components/InterpretationPanel';

/**
 * Generate interpretation decisions from a zoning profile and existing property
 */
export function generateInterpretationDecisions(
  zoningProfile: any,
  existingProperty?: any,
  proposedUse?: string
): {
  decisions: InterpretationDecision[];
  warnings: string[];
} {
  const decisions: InterpretationDecision[] = [];
  const warnings: string[] = [];

  if (!zoningProfile) {
    return { decisions, warnings };
  }

  // ── FAR ──
  if (zoningProfile.applied_far !== undefined) {
    const farType = proposedUse === 'multifamily' ? 'residential' : 'combined';
    decisions.push({
      parameter: 'FAR',
      value_used: zoningProfile.applied_far,
      interpretation: 'moderate',
      rationale: `Using ${farType} FAR for ${proposedUse || 'proposed'} use. FAR measures total building floor area relative to lot size.`,
      source: zoningProfile.far_source || null,
      confidence: zoningProfile.far_confidence || 'medium',
      ambiguity: zoningProfile.far_note?.includes('ambiguous') ? 'Code does not explicitly define floor area measurement basis (gross vs net).' : undefined,
    });
  }

  // ── COMMON AREA FACTOR ──
  if (zoningProfile.common_area_factor !== undefined) {
    decisions.push({
      parameter: 'Common Area Factor',
      value_used: zoningProfile.common_area_factor,
      interpretation: 'moderate',
      rationale: zoningProfile.common_area_note || 'Percentage of residential floor area reserved for common amenities, not unit count.',
      source: zoningProfile.common_area_source || null,
      confidence: zoningProfile.common_area_confidence || 'medium',
      alternative_value: 0.10,
      alternative_rationale: 'Some code interpretations allow 10% minimum.',
    });
  }

  // ── DENSITY ──
  if (zoningProfile.max_density_per_acre !== undefined) {
    const basis = zoningProfile.density_basis || 'gross_lot_area';
    decisions.push({
      parameter: 'Density',
      value_used: zoningProfile.max_density_per_acre,
      interpretation: 'moderate',
      rationale: `Max ${zoningProfile.max_density_per_acre} units/acre based on ${basis === 'gross_lot_area' ? 'full lot area' : 'buildable area after setbacks'}.`,
      source: zoningProfile.density_source || null,
      confidence: zoningProfile.density_confidence || 'high',
      ambiguity: basis === 'net_buildable' ? 'Density calculated on buildable area (after setbacks) not gross lot — reduces effective units.' : undefined,
    });
  }

  // ── HEIGHT ──
  if (zoningProfile.max_height_ft !== undefined) {
    decisions.push({
      parameter: 'Height',
      value_used: zoningProfile.max_height_ft,
      interpretation: 'moderate',
      rationale: `Maximum ${zoningProfile.max_height_ft} feet. Ground floor assumed 14ft, upper floors 9.5ft — affects story count.`,
      source: zoningProfile.height_source || null,
      confidence: zoningProfile.height_confidence || 'high',
      alternative_value: zoningProfile.max_height_ft,
      alternative_rationale: 'Conservative interpretation: upper floors 10ft reduces story count by 1.',
    });
  }

  // ── SETBACKS ──
  if (zoningProfile.setback_front_ft !== undefined || zoningProfile.setback_side_ft !== undefined) {
    const frontStr = zoningProfile.setback_front_ft !== undefined ? `${zoningProfile.setback_front_ft}ft front` : '';
    const sideStr = zoningProfile.setback_side_ft !== undefined ? `${zoningProfile.setback_side_ft}ft side` : '';
    const rearStr = zoningProfile.setback_rear_ft !== undefined ? `${zoningProfile.setback_rear_ft}ft rear` : '';
    const parts = [frontStr, sideStr, rearStr].filter(Boolean);

    decisions.push({
      parameter: 'Setbacks',
      value_used: zoningProfile.setback_front_ft || 0,
      interpretation: 'moderate',
      rationale: `Building must be set back: ${parts.join(', ')}. Reduces buildable lot area.`,
      source: zoningProfile.setback_source || null,
      confidence: zoningProfile.setback_confidence || 'high',
      ambiguity:
        existingProperty?.is_corner_lot && zoningProfile.setback_front_ft !== undefined
          ? 'Corner lot interpretation: second street face uses front setback (more restrictive) not side setback.'
          : undefined,
    });
  }

  // ── PARKING ──
  if (zoningProfile.min_parking_per_unit !== undefined) {
    const hasTransitReduction = zoningProfile.transit_reduction_applied;
    const reductionText = hasTransitReduction ? `${zoningProfile.transit_reduction_pct || 20}% transit reduction applied` : 'No transit reduction';

    decisions.push({
      parameter: 'Parking',
      value_used: zoningProfile.min_parking_per_unit,
      interpretation: 'moderate',
      rationale: `${zoningProfile.min_parking_per_unit} spaces/unit. ${reductionText}. ${zoningProfile.parking_note || ''}`,
      source: zoningProfile.parking_source || null,
      confidence: zoningProfile.parking_confidence || 'medium',
      ambiguity:
        !hasTransitReduction && zoningProfile.transit_distance_ft
          ? `Property is ${zoningProfile.transit_distance_ft}ft from transit — may qualify for 15–25% reduction.`
          : undefined,
    });
  }

  // ── LOT COVERAGE ──
  if (zoningProfile.max_lot_coverage_pct !== undefined) {
    decisions.push({
      parameter: 'Lot Coverage',
      value_used: zoningProfile.max_lot_coverage_pct,
      interpretation: 'moderate',
      rationale: `Building footprint limited to ${zoningProfile.max_lot_coverage_pct}% of lot area. Includes balconies, overhangs per code.`,
      source: zoningProfile.coverage_source || null,
      confidence: zoningProfile.coverage_confidence || 'medium',
      ambiguity: zoningProfile.coverage_note?.includes('ambiguous') ? 'Code unclear on whether balconies and canopies count toward coverage.' : undefined,
    });
  }

  // ── WARNINGS ──
  // 1. Impervious surface data unavailable
  if (!zoningProfile.impervious_surface_data) {
    warnings.push(
      'County stormwater impervious limit not checked. This parcel may be further constrained by stormwater runoff regulations before zoning lot coverage is reached.'
    );
  }

  // 2. Parking is binding constraint
  if (zoningProfile.parking_is_binding_constraint) {
    warnings.push(
      'Parking is your binding constraint — transit reduction or structured parking (rather than surface) could unlock additional units.'
    );
  }

  // 3. Low-confidence interpretations
  const lowConfidenceParams = decisions.filter(d => d.confidence === 'low');
  if (lowConfidenceParams.length > 0) {
    lowConfidenceParams.forEach(param => {
      warnings.push(
        `${param.parameter} interpretation has low confidence and potential ambiguity — confirm with planning department before finalizing project underwriting.`
      );
    });
  }

  // 4. Nonconforming items (only for existing properties)
  if (existingProperty?.has_nonconforming_items || existingProperty?.nonconformingItems?.length > 0) {
    warnings.push(
      'Existing building has nonconforming items (grandfathered under prior code). Expansion exceeding 50% of existing building value may trigger full code compliance, potentially adding significant costs or restricting uses.'
    );
  }

  return { decisions, warnings };
}

/**
 * Get interpretation overrides for a given mode (conservative/moderate/aggressive)
 */
export function getInterpretationOverrides(
  mode: 'conservative' | 'moderate' | 'aggressive',
  baseProfile: any
): Record<string, number> {
  const overrides: Record<string, number> = {};

  if (!baseProfile) return overrides;

  switch (mode) {
    case 'conservative':
      // Worst-case interpretation
      if (baseProfile.applied_far) {
        overrides['FAR'] = baseProfile.applied_far * 0.85; // Reduce by 15%
      }
      if (baseProfile.min_parking_per_unit) {
        overrides['Parking'] = baseProfile.min_parking_per_unit * 1.1; // Increase by 10%
      }
      if (baseProfile.common_area_factor) {
        overrides['Common Area Factor'] = baseProfile.common_area_factor * 1.2; // Increase by 20%
      }
      if (baseProfile.max_density_per_acre) {
        overrides['Density'] = baseProfile.max_density_per_acre * 0.9; // Reduce by 10%
      }
      break;

    case 'aggressive':
      // Developer-favorable interpretation
      if (baseProfile.applied_far) {
        overrides['FAR'] = baseProfile.applied_far * 1.15; // Increase by 15%
      }
      if (baseProfile.min_parking_per_unit) {
        overrides['Parking'] = baseProfile.min_parking_per_unit * 0.8; // Reduce by 20%
      }
      if (baseProfile.common_area_factor) {
        overrides['Common Area Factor'] = baseProfile.common_area_factor * 0.85; // Reduce by 15%
      }
      if (baseProfile.max_density_per_acre) {
        overrides['Density'] = baseProfile.max_density_per_acre * 1.1; // Increase by 10%
      }
      break;

    case 'moderate':
    default:
      // No overrides — use base profile
      break;
  }

  return overrides;
}

/**
 * Calculate unit count for a given interpretation mode
 * This would normally call the envelope calculation engine with mode-specific overrides
 */
export function estimateUnitCountForMode(
  baseProfile: any,
  mode: 'conservative' | 'moderate' | 'aggressive',
  baseLotSF?: number
): number {
  if (!baseProfile || !baseLotSF) return 0;

  const overrides = getInterpretationOverrides(mode, baseProfile);
  const far = overrides['FAR'] ?? baseProfile.applied_far ?? 3.0;
  const density = overrides['Density'] ?? baseProfile.max_density_per_acre ?? 100;
  const parking = overrides['Parking'] ?? baseProfile.min_parking_per_unit ?? 1.0;
  const lotAcres = baseLotSF / 43560;

  // Simple heuristic: constrained by FAR, density, and parking
  const farUnits = Math.floor((baseLotSF * far) / 900); // Assume 900 SF/unit average
  const densityUnits = Math.floor(lotAcres * density);

  // For now, return the more conservative of the two
  return Math.min(farUnits, densityUnits);
}
