/**
 * Email News Extraction Service
 * Extracts market intelligence and news events from emails
 * Creates entries in news_items table with source_type='email_private'
 */

import { logger } from '../utils/logger';
import { query, getPool } from '../database/connection';
import axios from 'axios';
import { createEvent, type M35EventCategory, type M35EventScope } from './m35-events.service';

export interface ExtractedNewsEvent {
  // Event details
  title: string;
  summary: string;
  eventType: string; // 'employment', 'development', 'transaction', 'infrastructure', 'regulation', etc.
  
  // Location
  location?: string; // Full address if available
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Magnitude/Impact
  magnitude?: string; // "$50M investment", "500 jobs", "200 units"
  employeeCount?: number;
  investmentAmount?: number;
  units?: number;
  sqft?: number;
  
  // Source credibility
  source: string;
  sourceEmail: string;
  credibility: number; // 0.0 to 1.0
  
  // AI analysis
  sentiment?: number; // -1.0 (negative) to 1.0 (positive)
  impactScore?: number; // 0 to 100
  
  // Confidence
  confidence: number; // 0.0 to 1.0
}

interface GeocodedLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Extract news events from email using AI
 */
export async function extractNewsFromEmail(
  emailId: string,
  subject: string,
  body: string,
  from: string,
  receivedAt: Date
): Promise<ExtractedNewsEvent | null> {
  try {
    const emailContent = `
Subject: ${subject}
From: ${from}
Body: ${body}
    `.trim();

    const { generateCompletion } = require('./llm.service');
    
    const prompt = `Extract market intelligence news from this email. Return JSON only.

Email:
${emailContent.substring(0, 2000)}

Extract news events such as:
- Employment: New company offices, job creation, headquarters moves
- Development: New construction projects, redevelopment, groundbreaking
- Transaction: Property sales, acquisitions, major leases
- Infrastructure: Transit, roads, utilities, public projects
- Regulation: Zoning changes, policy updates, incentives

Return JSON:
{
  "title": "Brief headline (50 chars max)",
  "summary": "1-2 sentence summary",
  "eventType": "employment|development|transaction|infrastructure|regulation|other",
  "location": "Full address if mentioned, else city",
  "city": "City name",
  "state": "2-letter state code",
  "magnitude": "Magnitude description (e.g. '$50M investment', '500 jobs')",
  "employeeCount": number or null,
  "investmentAmount": number (dollars) or null,
  "units": number of housing/office units or null,
  "sqft": square footage or null,
  "sentiment": -1.0 to 1.0 (negative to positive impact),
  "impactScore": 0-100 (how significant is this news),
  "confidence": 0.0-1.0 (how confident are you this is real news)
}

If no clear news event is mentioned, return {"confidence": 0.0}.
Return valid JSON only.`;

    const response = await generateCompletion({
      prompt,
      maxTokens: 600,
      temperature: 0.2,
    });

    const extracted = JSON.parse(response.text);
    
    if (extracted.confidence < 0.3) {
      logger.debug('Email does not contain significant news', { emailId });
      return null;
    }

    return {
      ...extracted,
      source: from,
      sourceEmail: from,
      credibility: assessSourceCredibility(from),
    } as ExtractedNewsEvent;
  } catch (error) {
    logger.error('Error extracting news from email:', error);
    return null;
  }
}

/**
 * Assess source credibility based on sender
 */
function assessSourceCredibility(from: string): number {
  const email = from.toLowerCase();
  
  // Trusted industry sources
  const trustedDomains = [
    'bisnow.com',
    'costar.com',
    'reis.com',
    'yardi.com',
    'bloomberg.com',
    'wsj.com',
    'nytimes.com',
    'bizjournals.com',
    'cbre.com',
    'jll.com',
    'cushwake.com',
    'colliers.com',
  ];
  
  for (const domain of trustedDomains) {
    if (email.includes(domain)) {
      return 0.9;
    }
  }
  
  // Newsletter/digest patterns
  if (email.includes('newsletter') || email.includes('digest') || email.includes('news')) {
    return 0.7;
  }
  
  // Known broker/investor
  if (email.includes('realty') || email.includes('capital') || email.includes('properties')) {
    return 0.6;
  }
  
  // Default for unknown sources
  return 0.5;
}

/**
 * Geocode location using Mapbox
 */
async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
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
 * Find or get market ID based on location
 */
async function findMarketId(city?: string, state?: string): Promise<string | null> {
  if (!city && !state) return null;

  try {
    const result = await query(
      `SELECT id FROM markets 
       WHERE ($1::text IS NULL OR LOWER(city) = LOWER($1))
       AND ($2::text IS NULL OR state_code = UPPER($2))
       ORDER BY priority DESC, population DESC
       LIMIT 1`,
      [city, state]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (error) {
    logger.error('Error finding market:', error);
    return null;
  }
}

/**
 * Store news event to database
 */
export async function storeNewsEvent(
  newsEvent: ExtractedNewsEvent,
  emailId: string,
  userId: string
): Promise<string | null> {
  try {
    // Geocode location
    let location: GeocodedLocation | null = null;
    let locationGeometry = null;
    
    if (newsEvent.location) {
      location = await geocodeAddress(newsEvent.location);
      if (location) {
        locationGeometry = `POINT(${location.lng} ${location.lat})`;
      }
    }

    // Find market
    const marketId = await findMarketId(newsEvent.city, newsEvent.state);

    // Store to news_items table
    const result = await query(
      `INSERT INTO news_items (
        market_id,
        title,
        summary,
        source,
        author,
        published_date,
        location,
        category,
        tags,
        sentiment_score,
        sentiment_label,
        impact_score,
        raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 
        ${locationGeometry ? `ST_GeomFromText('${locationGeometry}', 4326)` : 'NULL'},
        $7, $8, $9, $10, $11, $12
      ) RETURNING id`,
      [
        marketId,
        newsEvent.title,
        newsEvent.summary,
        'email_private', // Mark as private intelligence source
        newsEvent.sourceEmail,
        new Date(),
        newsEvent.eventType,
        [newsEvent.eventType, 'email_intelligence'], // Tags
        newsEvent.sentiment || 0,
        getSentimentLabel(newsEvent.sentiment || 0),
        newsEvent.impactScore || 50,
        {
          emailId,
          magnitude: newsEvent.magnitude,
          employeeCount: newsEvent.employeeCount,
          investmentAmount: newsEvent.investmentAmount,
          units: newsEvent.units,
          sqft: newsEvent.sqft,
          credibility: newsEvent.credibility,
          confidence: newsEvent.confidence,
        },
      ]
    );

    const newsItemId = result.rows[0].id;

    logger.info('News event stored', {
      newsItemId,
      emailId,
      title: newsEvent.title,
      eventType: newsEvent.eventType,
    });

    return newsItemId;
  } catch (error) {
    logger.error('Error storing news event:', error);
    return null;
  }
}

/**
 * Get sentiment label from score
 */
function getSentimentLabel(score: number): string {
  if (score >= 0.5) return 'very_positive';
  if (score >= 0.2) return 'positive';
  if (score >= -0.2) return 'neutral';
  if (score >= -0.5) return 'negative';
  return 'very_negative';
}

/**
 * Link email to news item
 */
export async function linkEmailToNews(
  emailId: string,
  newsItemId: string
): Promise<void> {
  try {
    await query(
      `UPDATE emails 
       SET raw_data = jsonb_set(
         COALESCE(raw_data, '{}'::jsonb),
         '{linkedNewsItemId}',
         to_jsonb($2::text)
       )
       WHERE id = $1`,
      [emailId, newsItemId]
    );

    logger.debug('Email linked to news item', { emailId, newsItemId });
  } catch (error) {
    logger.error('Error linking email to news:', error);
  }
}

/**
 * Main function: Extract and store news from email
 */
export async function processEmailForNews(
  emailId: string,
  subject: string,
  body: string,
  from: string,
  receivedAt: Date,
  userId: string
): Promise<{ success: boolean; newsItemId?: string; reason?: string }> {
  try {
    logger.info('Processing email for news extraction', {
      emailId,
      subject,
      from,
    });

    // Extract news event
    const newsEvent = await extractNewsFromEmail(emailId, subject, body, from, receivedAt);

    if (!newsEvent) {
      return {
        success: false,
        reason: 'No news event found in email',
      };
    }

    // Store news event
    const newsItemId = await storeNewsEvent(newsEvent, emailId, userId);

    if (!newsItemId) {
      return {
        success: false,
        reason: 'Failed to store news event',
      };
    }

    // Link email to news item
    await linkEmailToNews(emailId, newsItemId);

    // ── M35 Event Impact Engine classifier ────────────────────────────────────
    // Run async (non-blocking); failures do not affect the news pipeline result.
    void classifyNewsEventForM35(newsEvent, newsItemId, emailId, userId).catch((err: Error) =>
      logger.warn('[M35 Classifier] non-fatal error', { err: err.message, newsItemId })
    );

    return {
      success: true,
      newsItemId,
    };
  } catch (error) {
    logger.error('Error processing email for news:', error);
    return {
      success: false,
      reason: 'Internal error: ' + (error as Error).message,
    };
  }
}

// ─── M35 Event Impact Engine — Taxonomy Classifier ───────────────────────────
// Maps M06 eventType strings → M35 category.  Runs after news_item is stored.
// High confidence (≥0.6): auto-creates a key_event (status=draft).
// Medium confidence (0.3–0.59): logs to event_ingestion_log for analyst review.

const M06_TO_M35_CATEGORY: Record<string, M35EventCategory> = {
  employment:     'EMPLOYMENT',
  jobs:           'EMPLOYMENT',
  headquarters:   'EMPLOYMENT',
  layoff:         'EMPLOYMENT',
  infrastructure: 'INFRASTRUCTURE',
  transit:        'INFRASTRUCTURE',
  development:    'INFRASTRUCTURE',
  stadium:        'INFRASTRUCTURE',
  regulation:     'REGULATORY_POLICY',
  zoning:         'REGULATORY_POLICY',
  policy:         'REGULATORY_POLICY',
  incentive:      'REGULATORY_POLICY',
  transaction:    'MARKET_STRUCTURE',
  acquisition:    'MARKET_STRUCTURE',
  portfolio:      'MARKET_STRUCTURE',
  supply:         'MARKET_STRUCTURE',
  demographic:    'MACRO_DEMOGRAPHIC',
  migration:      'MACRO_DEMOGRAPHIC',
  disaster:       'DISASTER_DISRUPTION',
  flood:          'DISASTER_DISRUPTION',
  wildfire:       'DISASTER_DISRUPTION',
  hurricane:      'DISASTER_DISRUPTION',
  technology:     'TECHNOLOGY_INDUSTRY',
  biotech:        'TECHNOLOGY_INDUSTRY',
  'data center':  'TECHNOLOGY_INDUSTRY',
  manufacturing:  'TECHNOLOGY_INDUSTRY',
};

function inferM35Category(eventType: string): M35EventCategory | null {
  const lower = eventType.toLowerCase();
  for (const [key, category] of Object.entries(M06_TO_M35_CATEGORY)) {
    if (lower.includes(key)) return category;
  }
  return null;
}

async function classifyNewsEventForM35(
  newsEvent: ExtractedNewsEvent,
  newsItemId: string,
  emailId: string,
  userId: string
): Promise<void> {
  const category = inferM35Category(newsEvent.eventType);
  if (!category) {
    logger.debug('[M35 Classifier] No M35 category match', { eventType: newsEvent.eventType, newsItemId });
    return;
  }

  const confidence = newsEvent.confidence ?? 0;
  const pool = getPool();

  if (confidence >= 0.6) {
    // Auto-create a draft key_event
    const event = await createEvent({
      category,
      name: newsEvent.title,
      description: newsEvent.summary,
      scope: 'MSA' as M35EventScope,
      msaName: newsEvent.city ? `${newsEvent.city}, ${newsEvent.state ?? ''}`.trim() : undefined,
      magnitudeScore: Math.round((newsEvent.impactScore ?? 50) / 20), // 0-100 → 0-5
      confidence,
      ingestionSource: 'email_m06',
      sourceUrl: undefined,
      newsItemIds: [newsItemId],
      createdBy: userId,
      lat: undefined,
      lng: undefined,
    });
    logger.info('[M35 Classifier] Auto-created draft key_event from email', {
      eventId: event.id, newsItemId, category, confidence,
    });
    return;
  }

  if (confidence >= 0.3) {
    // Log for analyst review
    await pool.query(
      `INSERT INTO event_ingestion_log
         (source_type, source_record_id, raw_payload, inferred_category, confidence, status, error_message)
       VALUES ('email_m06', $1, $2, $3, $4, 'pending_review', 'Medium confidence — analyst review required')`,
      [
        newsItemId,
        JSON.stringify({ emailId, newsItemId, eventType: newsEvent.eventType, title: newsEvent.title }),
        category,
        confidence,
      ]
    );
    logger.info('[M35 Classifier] Logged to ingestion queue (medium confidence)', {
      newsItemId, category, confidence,
    });
  }
}
