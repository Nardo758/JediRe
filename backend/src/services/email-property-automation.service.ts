/**
 * Email → Property Automation Service
 * Automatically detect properties in emails and create pins on maps
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';
import axios from 'axios';

// Type definitions
interface EmailData {
  id: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  bodyPreview: string;
  body?: {
    content: string;
  };
  receivedDateTime: string;
}

interface ExtractedProperty {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  propertyType?: string;
  confidence: number;
}

interface GeocodedLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface UserPreferences {
  deal_types: any;
  target_locations: Array<{
    city: string;
    state: string;
    priority: string;
  }>;
  criteria: {
    min_price?: number;
    max_price?: number;
    min_roi?: number;
    property_size_acres?: { min: number; max: number };
  };
}

/**
 * Extract property information from email content using AI
 */
export async function extractPropertyFromEmail(
  email: EmailData
): Promise<ExtractedProperty | null> {
  try {
    const emailContent = `
Subject: ${email.subject}
From: ${email.from.name} <${email.from.address}>
Body: ${email.body?.content || email.bodyPreview}
    `.trim();

    // Use Claude AI to extract property information
    const { generateCompletion } = require('./llm.service');
    
    const prompt = `Extract property information from this real estate email. Return JSON only.

Email:
${emailContent}

Extract:
- address (full street address if mentioned)
- city
- state (2-letter code)
- zipCode
- price (number only, no formatting)
- propertyType (single-family, multifamily, commercial, land, or unknown)
- confidence (0.0-1.0, how confident are you this is a real property listing)

If no clear property is mentioned, return {"confidence": 0.0}.
Return valid JSON only, no explanation.`;

    const response = await generateCompletion({
      prompt,
      maxTokens: 500,
      temperature: 0.3, // Low temperature for structured extraction
    });

    // Parse AI response
    const extracted = JSON.parse(response.text);
    
    if (extracted.confidence < 0.5) {
      logger.debug('Email does not contain property information', { emailId: email.id });
      return null;
    }

    return extracted as ExtractedProperty;
  } catch (error) {
    logger.error('Error extracting property from email:', error);
    return null;
  }
}

/**
 * Geocode address using Mapbox
 */
export async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  const mapboxToken = process.env.MAPBOX_TOKEN;
  
  if (!mapboxToken) {
    logger.warn('Mapbox token not configured, skipping geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;
    
    const response = await axios.get(url);
    
    if (response.data.features && response.data.features.length > 0) {
      const feature = response.data.features[0];
      return {
        lng: feature.center[0],
        lat: feature.center[1],
        formattedAddress: feature.place_name,
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Check if property matches user preferences
 */
export async function matchesUserPreferences(
  property: ExtractedProperty,
  userId: string
): Promise<{ matches: boolean; reason?: string }> {
  try {
    // Get user preferences
    const result = await query(
      'SELECT preferences FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { matches: true }; // No preferences = accept all
    }
    
    const prefs: UserPreferences = result.rows[0].preferences || {};
    
    // Check target locations
    if (prefs.target_locations && prefs.target_locations.length > 0) {
      const locationMatch = prefs.target_locations.some(loc => 
        (!property.city || loc.city.toLowerCase() === property.city.toLowerCase()) &&
        (!property.state || loc.state.toLowerCase() === property.state.toLowerCase())
      );
      
      if (!locationMatch) {
        return { 
          matches: false, 
          reason: `Location ${property.city}, ${property.state} not in target markets` 
        };
      }
    }
    
    // Check price range
    if (property.price && prefs.criteria) {
      if (prefs.criteria.min_price && property.price < prefs.criteria.min_price) {
        return { 
          matches: false, 
          reason: `Price $${property.price} below minimum $${prefs.criteria.min_price}` 
        };
      }
      
      if (prefs.criteria.max_price && property.price > prefs.criteria.max_price) {
        return { 
          matches: false, 
          reason: `Price $${property.price} above maximum $${prefs.criteria.max_price}` 
        };
      }
    }
    
    // Check property type (if preferences specify it)
    if (prefs.deal_types && property.propertyType) {
      // This would need more complex logic based on actual deal_types structure
      // For now, accept all
    }
    
    return { matches: true };
  } catch (error) {
    logger.error('Error checking user preferences:', error);
    return { matches: true }; // Default to accepting if error
  }
}

/**
 * Get user's active map (or create one)
 */
export async function getUserActiveMap(userId: string): Promise<string | null> {
  try {
    // Get user's most recently updated map
    const result = await query(
      `SELECT m.id 
       FROM maps m
       JOIN users u ON m.owner_id = u.id
       WHERE u.id = $1
       ORDER BY m.updated_at DESC
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    // Create default map if none exists
    const createResult = await query(
      `INSERT INTO maps (name, owner_id, map_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`${userId}'s Deals`, userId, 'acquisition']
    );
    
    // Create default pipeline stages
    await query(
      'SELECT create_default_pipeline_stages($1, $2)',
      [createResult.rows[0].id, 'acquisition']
    );
    
    return createResult.rows[0].id;
  } catch (error) {
    logger.error('Error getting user active map:', error);
    return null;
  }
}

/**
 * Create property pin on map
 */
export async function createPropertyPin(
  mapId: string,
  property: ExtractedProperty,
  location: GeocodedLocation,
  emailId: string,
  userId: string
): Promise<string | null> {
  try {
    // Create map pin
    const pinResult = await query(
      `INSERT INTO map_pins (map_id, type, location, created_by, data)
       VALUES ($1, $2, ST_SetSRID(ST_Point($3, $4), 4326), $5, $6)
       RETURNING id`,
      [
        mapId,
        'property',
        location.lng,
        location.lat,
        userId,
        { source: 'email', emailId, extractedData: property },
      ]
    );
    
    const pinId = pinResult.rows[0].id;
    
    // Create property pin details
    await query(
      `INSERT INTO property_pins (
        map_pin_id, address_line1, city, state_code, zip_code,
        source, status, color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        pinId,
        property.address,
        property.city,
        property.state,
        property.zipCode,
        'email',
        'active',
        '#10b981', // Green for new leads
      ]
    );
    
    // Get first pipeline stage for this map
    const stageResult = await query(
      `SELECT id FROM pipeline_stages 
       WHERE map_id = $1 
       ORDER BY stage_order ASC 
       LIMIT 1`,
      [mapId]
    );
    
    // Create deal silo
    const siloResult = await query(
      `INSERT INTO deal_silos (
        property_pin_id, 
        current_stage_id,
        email_ids,
        purchase_price
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [
        pinResult.rows[0].id,
        stageResult.rows[0]?.id,
        [emailId],
        property.price,
      ]
    );
    
    logger.info('Property pin created', {
      mapId,
      pinId,
      address: property.address,
      source: 'email',
    });
    
    return pinId;
  } catch (error) {
    logger.error('Error creating property pin:', error);
    return null;
  }
}

/**
 * Send notification to user about new property
 */
export async function notifyUserNewProperty(
  userId: string,
  property: ExtractedProperty,
  mapId: string
): Promise<void> {
  try {
    // Create notification (you would implement notification system)
    // For now, just log it
    logger.info('New property notification', {
      userId,
      address: property.address,
      mapId,
    });
    
    // TODO: Implement actual notification system
    // - In-app notification
    // - Email digest
    // - Push notification
    // - Slack/Discord webhook
  } catch (error) {
    logger.error('Error sending notification:', error);
  }
}

/**
 * Main automation function: Process email and create property if relevant
 */
export async function processEmailForProperty(
  email: EmailData,
  userId: string
): Promise<{ created: boolean; pinId?: string; reason?: string }> {
  try {
    logger.info('Processing email for property detection', {
      emailId: email.id,
      userId,
    });
    
    // Step 1: Extract property information
    const property = await extractPropertyFromEmail(email);
    
    if (!property) {
      return { created: false, reason: 'No property information found in email' };
    }
    
    logger.debug('Property extracted', property);
    
    // Step 2: Check if matches user preferences
    const prefCheck = await matchesUserPreferences(property, userId);
    
    if (!prefCheck.matches) {
      logger.info('Property does not match user preferences', {
        reason: prefCheck.reason,
      });
      return { created: false, reason: prefCheck.reason };
    }
    
    // Step 3: Geocode address
    const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
    const location = await geocodeAddress(fullAddress);
    
    if (!location) {
      logger.warn('Could not geocode address', { address: fullAddress });
      return { created: false, reason: 'Could not find location on map' };
    }
    
    logger.debug('Address geocoded', location);
    
    // Step 4: Get user's active map
    const mapId = await getUserActiveMap(userId);
    
    if (!mapId) {
      return { created: false, reason: 'No active map found' };
    }
    
    // Step 5: Create property pin
    const pinId = await createPropertyPin(
      mapId,
      property,
      location,
      email.id,
      userId
    );
    
    if (!pinId) {
      return { created: false, reason: 'Failed to create property pin' };
    }
    
    // Step 6: Notify user
    await notifyUserNewProperty(userId, property, mapId);
    
    return { created: true, pinId };
  } catch (error) {
    logger.error('Error in email property automation:', error);
    return { created: false, reason: 'Internal error processing email' };
  }
}

/**
 * Batch process multiple emails
 */
export async function batchProcessEmails(
  emails: EmailData[],
  userId: string
): Promise<{
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  const results = {
    processed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };
  
  for (const email of emails) {
    try {
      const result = await processEmailForProperty(email, userId);
      results.processed++;
      
      if (result.created) {
        results.created++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.errors++;
      logger.error('Error processing email in batch:', error);
    }
  }
  
  logger.info('Batch email processing complete', results);
  
  return results;
}
