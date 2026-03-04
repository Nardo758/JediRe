/**
 * User Preference Matching Service
 * Matches extracted properties against user-defined acquisition criteria
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';

// Type definitions
export interface ExtractedProperty {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  propertyType?: string; // 'multifamily', 'retail', 'office', 'industrial', 'mixed-use', 'land'
  units?: number; // For multifamily
  yearBuilt?: number;
  sqft?: number;
  capRate?: number;
  occupancy?: number;
  condition?: string; // 'excellent', 'good', 'fair', 'value-add', 'distressed'
  confidence: number; // 0.0 - 1.0 extraction confidence
}

export interface AcquisitionPreferences {
  id: string;
  user_id: string;
  property_types: string[];
  min_units?: number;
  max_units?: number;
  min_year_built?: number;
  max_year_built?: number;
  markets: string[]; // City names or general markets
  cities: string[];
  states: string[]; // 2-letter state codes
  zip_codes: string[];
  min_price?: number;
  max_price?: number;
  min_sqft?: number;
  max_sqft?: number;
  min_cap_rate?: number;
  max_cap_rate?: number;
  min_occupancy?: number;
  conditions: string[];
  deal_types: string[];
  custom_criteria: Record<string, any>;
  auto_create_on_match: boolean;
  notify_on_mismatch: boolean;
  confidence_threshold: number; // 0.00 - 1.00
  is_active: boolean;
}

export interface PreferenceMatchResult {
  matches: boolean;
  score: number; // 0.0 - 1.0 overall match score
  reasons: Array<{
    criterion: string;
    matched: boolean;
    weight: number;
    details?: string;
  }>;
  decision: 'auto-create' | 'requires-review' | 'rejected' | 'ignored';
  decision_reason: string;
}

/**
 * Get active user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<AcquisitionPreferences | null> {
  try {
    const result = await query(
      `SELECT * FROM user_acquisition_preferences 
       WHERE user_id = $1 AND is_active = true 
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      logger.debug('No active preferences found for user', { userId });
      return null;
    }

    return result.rows[0] as AcquisitionPreferences;
  } catch (error) {
    logger.error('Error getting user preferences:', error);
    return null;
  }
}

/**
 * Match extracted property against user preferences
 */
export async function matchPropertyToPreferences(
  property: ExtractedProperty,
  preferences: AcquisitionPreferences
): Promise<PreferenceMatchResult> {
  const checks: Array<{
    criterion: string;
    matched: boolean;
    weight: number;
    details?: string;
  }> = [];

  // 1. Property type check (HIGH PRIORITY)
  if (preferences.property_types && preferences.property_types.length > 0) {
    const typeMatched = property.propertyType 
      ? preferences.property_types.includes(property.propertyType.toLowerCase())
      : false;
    
    checks.push({
      criterion: 'property_type',
      matched: typeMatched,
      weight: 15,
      details: typeMatched 
        ? `Type ${property.propertyType} is in target types`
        : `Type ${property.propertyType} not in ${preferences.property_types.join(', ')}`,
    });
  }

  // 2. Geographic market check (HIGH PRIORITY)
  let locationMatched = false;
  let locationDetails = '';

  // Check states
  if (preferences.states && preferences.states.length > 0 && property.state) {
    const stateMatch = preferences.states.some(s => 
      s.toUpperCase() === property.state?.toUpperCase()
    );
    if (stateMatch) {
      locationMatched = true;
      locationDetails = `State ${property.state} is a target market`;
    }
  }

  // Check cities
  if (preferences.cities && preferences.cities.length > 0 && property.city) {
    const cityMatch = preferences.cities.some(c => 
      c.toLowerCase() === property.city?.toLowerCase()
    );
    if (cityMatch) {
      locationMatched = true;
      locationDetails = `City ${property.city} is a target market`;
    }
  }

  // Check markets (could be cities or states)
  if (preferences.markets && preferences.markets.length > 0) {
    const marketMatch = preferences.markets.some(m => {
      const market = m.toLowerCase();
      return (
        market === property.city?.toLowerCase() ||
        market === property.state?.toLowerCase()
      );
    });
    if (marketMatch) {
      locationMatched = true;
      locationDetails = `Location matches target market`;
    }
  }

  // Check zip codes
  if (preferences.zip_codes && preferences.zip_codes.length > 0 && property.zipCode) {
    const zipMatch = preferences.zip_codes.includes(property.zipCode);
    if (zipMatch) {
      locationMatched = true;
      locationDetails = `Zip code ${property.zipCode} is a target market`;
    }
  }

  checks.push({
    criterion: 'location',
    matched: locationMatched,
    weight: 15,
    details: locationDetails || `Location not in target markets`,
  });

  // 3. Unit count check (MEDIUM PRIORITY - for multifamily)
  if (property.units !== undefined) {
    let unitsMatched = true;
    let unitsDetails = '';

    if (preferences.min_units && property.units < preferences.min_units) {
      unitsMatched = false;
      unitsDetails = `${property.units} units below minimum ${preferences.min_units}`;
    } else if (preferences.max_units && property.units > preferences.max_units) {
      unitsMatched = false;
      unitsDetails = `${property.units} units above maximum ${preferences.max_units}`;
    } else {
      unitsDetails = `${property.units} units within target range`;
    }

    checks.push({
      criterion: 'units',
      matched: unitsMatched,
      weight: 10,
      details: unitsDetails,
    });
  }

  // 4. Year built check (MEDIUM PRIORITY)
  if (property.yearBuilt !== undefined) {
    let yearMatched = true;
    let yearDetails = '';

    if (preferences.min_year_built && property.yearBuilt < preferences.min_year_built) {
      yearMatched = false;
      yearDetails = `Built ${property.yearBuilt}, older than minimum ${preferences.min_year_built}`;
    } else if (preferences.max_year_built && property.yearBuilt > preferences.max_year_built) {
      yearMatched = false;
      yearDetails = `Built ${property.yearBuilt}, newer than maximum ${preferences.max_year_built}`;
    } else {
      yearDetails = `Built ${property.yearBuilt}, within target range`;
    }

    checks.push({
      criterion: 'year_built',
      matched: yearMatched,
      weight: 8,
      details: yearDetails,
    });
  }

  // 5. Price range check (HIGH PRIORITY)
  if (property.price !== undefined) {
    let priceMatched = true;
    let priceDetails = '';

    if (preferences.min_price && property.price < preferences.min_price) {
      priceMatched = false;
      priceDetails = `$${property.price.toLocaleString()} below minimum $${preferences.min_price.toLocaleString()}`;
    } else if (preferences.max_price && property.price > preferences.max_price) {
      priceMatched = false;
      priceDetails = `$${property.price.toLocaleString()} above maximum $${preferences.max_price.toLocaleString()}`;
    } else {
      priceDetails = `$${property.price.toLocaleString()} within budget`;
    }

    checks.push({
      criterion: 'price',
      matched: priceMatched,
      weight: 12,
      details: priceDetails,
    });
  }

  // 6. Square footage check (LOW PRIORITY)
  if (property.sqft !== undefined) {
    let sqftMatched = true;
    let sqftDetails = '';

    if (preferences.min_sqft && property.sqft < preferences.min_sqft) {
      sqftMatched = false;
      sqftDetails = `${property.sqft.toLocaleString()} sqft below minimum`;
    } else if (preferences.max_sqft && property.sqft > preferences.max_sqft) {
      sqftMatched = false;
      sqftDetails = `${property.sqft.toLocaleString()} sqft above maximum`;
    } else {
      sqftDetails = `${property.sqft.toLocaleString()} sqft within range`;
    }

    checks.push({
      criterion: 'sqft',
      matched: sqftMatched,
      weight: 5,
      details: sqftDetails,
    });
  }

  // 7. Cap rate check (MEDIUM PRIORITY)
  if (property.capRate !== undefined) {
    let capMatched = true;
    let capDetails = '';

    if (preferences.min_cap_rate && property.capRate < preferences.min_cap_rate) {
      capMatched = false;
      capDetails = `${property.capRate}% cap rate below minimum`;
    } else if (preferences.max_cap_rate && property.capRate > preferences.max_cap_rate) {
      capMatched = false;
      capDetails = `${property.capRate}% cap rate above maximum`;
    } else {
      capDetails = `${property.capRate}% cap rate within range`;
    }

    checks.push({
      criterion: 'cap_rate',
      matched: capMatched,
      weight: 8,
      details: capDetails,
    });
  }

  // 8. Occupancy check (LOW PRIORITY)
  if (property.occupancy !== undefined) {
    let occMatched = true;
    let occDetails = '';

    if (preferences.min_occupancy && property.occupancy < preferences.min_occupancy) {
      occMatched = false;
      occDetails = `${property.occupancy}% occupancy below minimum`;
    } else {
      occDetails = `${property.occupancy}% occupancy acceptable`;
    }

    checks.push({
      criterion: 'occupancy',
      matched: occMatched,
      weight: 5,
      details: occDetails,
    });
  }

  // 9. Condition check (LOW PRIORITY)
  if (property.condition && preferences.conditions && preferences.conditions.length > 0) {
    const conditionMatched = preferences.conditions.includes(property.condition.toLowerCase());
    checks.push({
      criterion: 'condition',
      matched: conditionMatched,
      weight: 5,
      details: conditionMatched 
        ? `Condition ${property.condition} is acceptable`
        : `Condition ${property.condition} not in target conditions`,
    });
  }

  // Calculate overall match score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const matchedWeight = checks.filter(c => c.matched).reduce((sum, c) => sum + c.weight, 0);
  const matchScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  // Determine decision based on extraction confidence + match score
  let decision: PreferenceMatchResult['decision'];
  let decision_reason: string;

  const extractionConfident = property.confidence >= preferences.confidence_threshold;
  const highMatch = matchScore >= 0.70; // 70%+ match
  const mediumMatch = matchScore >= 0.50; // 50-69% match

  if (!extractionConfident) {
    decision = 'ignored';
    decision_reason = `Low extraction confidence (${(property.confidence * 100).toFixed(0)}% < ${(preferences.confidence_threshold * 100).toFixed(0)}%)`;
  } else if (highMatch) {
    decision = preferences.auto_create_on_match ? 'auto-create' : 'requires-review';
    decision_reason = `High match score (${(matchScore * 100).toFixed(0)}%) and confident extraction`;
  } else if (mediumMatch) {
    decision = 'requires-review';
    decision_reason = `Medium match score (${(matchScore * 100).toFixed(0)}%), requires manual review`;
  } else {
    decision = preferences.notify_on_mismatch ? 'requires-review' : 'rejected';
    decision_reason = `Low match score (${(matchScore * 100).toFixed(0)}%), doesn't meet criteria`;
  }

  return {
    matches: highMatch,
    score: matchScore,
    reasons: checks,
    decision,
    decision_reason,
  };
}

/**
 * Save property extraction to queue with preference match result
 */
export async function queuePropertyExtraction(
  userId: string,
  emailId: string,
  emailSubject: string,
  emailFrom: string,
  emailReceivedAt: Date,
  extractedData: ExtractedProperty,
  matchResult: PreferenceMatchResult
): Promise<string> {
  try {
    const result = await query(
      `INSERT INTO property_extraction_queue (
        user_id,
        email_id,
        email_subject,
        email_from,
        email_received_at,
        extracted_data,
        extraction_confidence,
        preference_match_score,
        preference_match_reasons,
        status,
        decision_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        userId,
        emailId,
        emailSubject,
        emailFrom,
        emailReceivedAt,
        JSON.stringify(extractedData),
        extractedData.confidence,
        matchResult.score,
        JSON.stringify(matchResult.reasons),
        matchResult.decision === 'auto-create' ? 'pending' : matchResult.decision,
        matchResult.decision_reason,
      ]
    );

    const extractionId = result.rows[0].id;

    // Log the match decision
    await query(
      `INSERT INTO preference_match_log (
        user_id,
        extraction_id,
        matched,
        match_score,
        match_reasons,
        action_taken
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        extractionId,
        matchResult.matches,
        matchResult.score,
        JSON.stringify(matchResult.reasons),
        matchResult.decision,
      ]
    );

    logger.info('Property extraction queued', {
      userId,
      extractionId,
      decision: matchResult.decision,
      matchScore: matchResult.score,
    });

    return extractionId;
  } catch (error) {
    logger.error('Error queuing property extraction:', error);
    throw error;
  }
}

/**
 * Get pending property reviews for user
 */
export async function getPendingReviews(
  userId: string
): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM pending_property_reviews 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting pending reviews:', error);
    return [];
  }
}

/**
 * Approve or reject a property extraction
 */
export async function reviewPropertyExtraction(
  extractionId: string,
  userId: string,
  approved: boolean
): Promise<boolean> {
  try {
    await query(
      `UPDATE property_extraction_queue 
       SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3 AND user_id = $2`,
      [approved ? 'auto-created' : 'rejected', userId, extractionId]
    );

    logger.info('Property extraction reviewed', {
      extractionId,
      userId,
      approved,
    });

    return true;
  } catch (error) {
    logger.error('Error reviewing property extraction:', error);
    return false;
  }
}
