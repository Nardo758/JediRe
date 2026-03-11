/**
 * Source Credibility Service
 * Tracks which private intelligence (emails) gets confirmed by public sources,
 * scoring source credibility over time.
 */

import { Pool, PoolClient } from 'pg';
import pool from '../database';

// Types
export interface SourceCredibility {
  id: string;
  userId: string;
  contactEmail: string;
  contactName: string | null;
  contactCompany: string | null;
  contactRole: string | null;
  totalSignals: number;
  corroboratedSignals: number;
  failedSignals: number;
  pendingSignals: number;
  credibilityScore: number; // 0-1
  avgLeadTimeDays: number;
  avgCorroborationTimeDays: number;
  intelligenceValueScore: number; // 0-100
  consistencyScore: number;
  avgImpactMagnitude: number;
  specialties: SpecialtyInfo[];
  lastSignalAt: Date | null;
  lastCorroborationAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecialtyInfo {
  category: string;
  score: number;
  signalCount: number;
  accuracy: number;
}

export interface CorroborationMatch {
  id: string;
  privateEventId: string;
  publicEventId: string;
  matchScore: number;
  locationScore: number;
  entityScore: number;
  magnitudeScore: number;
  temporalScore: number;
  typeScore: number;
  leadTimeDays: number;
  matchConfidence: 'low' | 'medium' | 'high' | 'very_high';
  createdAt: Date;
}

export interface SpecialtyScore {
  id: string;
  category: string;
  eventType: string | null;
  totalSignals: number;
  corroboratedSignals: number;
  failedSignals: number;
  pendingSignals: number;
  specialtyScore: number;
  baseAccuracy: number;
  specialtyBonus: number;
  avgImpactMagnitude: number;
  avgLeadTimeDays: number;
}

export interface IntelligenceValue {
  contactEmail: string;
  contactName: string | null;
  intelligenceValueScore: number;
  tier: 'top' | 'mid' | 'low';
  avgLeadTimeDays: number;
  accuracy: number;
  avgImpact: number;
  consistency: number;
  totalSignals: number;
}

export interface PredictiveCredibility {
  eventId: string;
  predictedAccuracy: number;
  predictedCorroborationDays: number | null;
  confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
  historicalAccuracy: number;
  specialtyMatch: boolean;
  specialtyAccuracy: number | null;
  sampleSize: number;
  appliedWeight: number;
}

export interface MatchScoreComponents {
  matchScore: number;
  locationScore: number;
  entityScore: number;
  magnitudeScore: number;
  temporalScore: number;
  typeScore: number;
}

class SourceCredibilityService {
  private pool: Pool;

  constructor(dbPool: Pool = pool) {
    this.pool = dbPool;
  }

  /**
   * Find potential corroborations between private and public events
   * This is the core matching algorithm
   */
  async findPotentialCorroborations(
    lookbackDays: number = 90,
    minMatchScore: number = 0.75
  ): Promise<CorroborationMatch[]> {
    const client = await this.pool.connect();
    try {
      // Get unconfirmed private events
      const privateEvents = await client.query(`
        SELECT id, event_category, event_type, extracted_data, 
               location_geocoded, published_at, city, state
        FROM news_events
        WHERE source_type = 'email_private'
          AND corroborated_by_public = FALSE
          AND published_at > NOW() - INTERVAL '${lookbackDays} days'
      `);

      // Get public events from same timeframe (after private events)
      const publicEvents = await client.query(`
        SELECT id, event_category, event_type, extracted_data,
               location_geocoded, published_at, city, state
        FROM news_events
        WHERE source_type = 'public'
          AND published_at > NOW() - INTERVAL '${lookbackDays} days'
      `);

      const matches: CorroborationMatch[] = [];

      // Compare each private event to each public event
      for (const privateEvent of privateEvents.rows) {
        for (const publicEvent of publicEvents.rows) {
          // Skip if public event is before private event
          if (new Date(publicEvent.published_at) <= new Date(privateEvent.published_at)) {
            continue;
          }

          const matchScore = await this.calculateMatchScore(
            privateEvent,
            publicEvent,
            client
          );

          if (matchScore.matchScore >= minMatchScore) {
            const leadTimeDays = Math.floor(
              (new Date(publicEvent.published_at).getTime() - 
               new Date(privateEvent.published_at).getTime()) / 
              (1000 * 60 * 60 * 24)
            );

            matches.push({
              id: '', // Will be generated on insert
              privateEventId: privateEvent.id,
              publicEventId: publicEvent.id,
              ...matchScore,
              leadTimeDays,
              matchConfidence: this.getConfidenceLevel(matchScore.matchScore),
              createdAt: new Date()
            });
          }
        }
      }

      return matches;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate similarity match score between two events
   */
  private async calculateMatchScore(
    event1: any,
    event2: any,
    client: PoolClient
  ): Promise<MatchScoreComponents> {
    let locationScore = 0;
    let entityScore = 0;
    let magnitudeScore = 0;
    let temporalScore = 0;
    let typeScore = 0;

    // Location similarity (30%)
    if (event1.location_geocoded && event2.location_geocoded) {
      const distanceResult = await client.query(`
        SELECT ST_Distance($1::geography, $2::geography) / 1609.34 AS distance_miles
      `, [event1.location_geocoded, event2.location_geocoded]);
      
      const distanceMiles = distanceResult.rows[0].distance_miles;
      locationScore = Math.max(0, 1 - (distanceMiles / 10)); // 0 score at 10+ miles
    } else if (event1.city === event2.city && event1.state === event2.state) {
      locationScore = 0.7; // Same city = 0.7 score
    }

    // Entity similarity (30%)
    const company1 = event1.extracted_data?.company_name?.toLowerCase();
    const company2 = event2.extracted_data?.company_name?.toLowerCase();
    
    if (company1 && company2) {
      if (company1 === company2) {
        entityScore = 1.0;
      } else if (company1.includes(company2) || company2.includes(company1)) {
        entityScore = 0.7;
      } else {
        // Use Levenshtein distance for fuzzy matching
        entityScore = this.calculateStringSimilarity(company1, company2);
      }
    }

    // Magnitude similarity (20%)
    const mag1 = parseFloat(event1.extracted_data?.magnitude);
    const mag2 = parseFloat(event2.extracted_data?.magnitude);
    
    if (!isNaN(mag1) && !isNaN(mag2)) {
      const diff = Math.abs(mag1 - mag2);
      const max = Math.max(mag1, mag2);
      magnitudeScore = 1 - Math.min(1, diff / max);
    }

    // Temporal proximity (10%)
    const daysDiff = Math.abs(
      (new Date(event1.published_at).getTime() - 
       new Date(event2.published_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    temporalScore = Math.max(0, 1 - (daysDiff / 90)); // 0 score at 90+ days

    // Event type matching (10%)
    if (event1.event_type === event2.event_type) {
      typeScore = 1.0;
    } else if (event1.event_category === event2.event_category) {
      typeScore = 0.5;
    }

    // Weighted total
    const matchScore = 
      (locationScore * 0.30) +
      (entityScore * 0.30) +
      (magnitudeScore * 0.20) +
      (temporalScore * 0.10) +
      (typeScore * 0.10);

    return {
      matchScore,
      locationScore,
      entityScore,
      magnitudeScore,
      temporalScore,
      typeScore
    };
  }

  /**
   * Simple string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Record a corroboration match
   */
  async recordCorroboration(match: Omit<CorroborationMatch, 'id' | 'createdAt'>): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert corroboration match
      const matchResult = await client.query(`
        INSERT INTO corroboration_matches (
          private_event_id, public_event_id, match_score,
          location_score, entity_score, magnitude_score,
          temporal_score, type_score, lead_time_days,
          match_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (private_event_id, public_event_id) DO NOTHING
        RETURNING id
      `, [
        match.privateEventId,
        match.publicEventId,
        match.matchScore,
        match.locationScore,
        match.entityScore,
        match.magnitudeScore,
        match.temporalScore,
        match.typeScore,
        match.leadTimeDays,
        match.matchConfidence
      ]);

      if (matchResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Corroboration already exists');
      }

      const matchId = matchResult.rows[0].id;

      // Update private event
      await client.query(`
        UPDATE news_events
        SET 
          corroborated_by_public = TRUE,
          early_signal_days = $1,
          source_credibility_score = LEAST(1.0, source_credibility_score + 0.2),
          corroboration_count = corroboration_count + 1,
          updated_at = NOW()
        WHERE id = $2
      `, [match.leadTimeDays, match.privateEventId]);

      // Get source contact
      const eventResult = await client.query(`
        SELECT source_user_id, source_name, event_category, event_type,
               extracted_data->>'magnitude' as magnitude
        FROM news_events
        WHERE id = $1
      `, [match.privateEventId]);

      const event = eventResult.rows[0];
      const contactEmail = event.source_name?.replace('Email: ', '');

      if (contactEmail) {
        // Update contact credibility
        const credResult = await client.query(`
          SELECT id FROM news_contact_credibility
          WHERE user_id = $1 AND contact_email = $2
        `, [event.source_user_id, contactEmail]);

        if (credResult.rows.length > 0) {
          const credId = credResult.rows[0].id;

          // Increment corroborated signals
          await client.query(`
            UPDATE news_contact_credibility
            SET 
              corroborated_signals = corroborated_signals + 1,
              pending_signals = GREATEST(0, pending_signals - 1),
              last_corroboration_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
          `, [credId]);

          // Update specialty scores
          await client.query(`
            INSERT INTO specialty_scores (
              contact_credibility_id, event_category, event_type,
              total_signals, corroborated_signals, last_corroboration_at
            ) VALUES ($1, $2, $3, 1, 1, NOW())
            ON CONFLICT (contact_credibility_id, event_category, event_type)
            DO UPDATE SET
              corroborated_signals = specialty_scores.corroborated_signals + 1,
              pending_signals = GREATEST(0, specialty_scores.pending_signals - 1),
              last_corroboration_at = NOW(),
              updated_at = NOW()
          `, [credId, event.event_category, event.event_type]);

          // Record intelligence value
          const magnitude = parseFloat(event.magnitude) || 0;
          await client.query(`
            INSERT INTO competitive_intelligence_value (
              contact_credibility_id, private_event_id, corroboration_match_id,
              lead_time_days, impact_magnitude, impact_category,
              private_signal_date, public_confirmation_date
            )
            SELECT 
              $1, $2, $3, $4, $5, $6,
              pe.published_at, pub.published_at
            FROM news_events pe
            CROSS JOIN news_events pub
            WHERE pe.id = $2 AND pub.id = $7
          `, [
            credId,
            match.privateEventId,
            matchId,
            match.leadTimeDays,
            magnitude,
            event.event_category,
            match.publicEventId
          ]);

          // Record credibility history
          await client.query(`
            INSERT INTO credibility_history (
              contact_credibility_id, event_id, corroboration_match_id,
              credibility_score, total_signals, corroborated_signals,
              failed_signals, pending_signals, change_type, change_reason
            )
            SELECT 
              id, $1, $2,
              credibility_score * 100, total_signals, corroborated_signals,
              failed_signals, pending_signals, 'corroborated',
              'Event corroborated after ' || $3 || ' days'
            FROM news_contact_credibility
            WHERE id = $4
          `, [match.privateEventId, matchId, match.leadTimeDays, credId]);

          // Recalculate all scores
          await client.query('SELECT update_source_credibility_scores($1)', [credId]);
        }
      }

      await client.query('COMMIT');
      return matchId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run automated corroboration detection
   */
  async detectCorroborations(): Promise<CorroborationMatch[]> {
    const potentialMatches = await this.findPotentialCorroborations(90, 0.75);
    const recorded: CorroborationMatch[] = [];

    for (const match of potentialMatches) {
      try {
        const matchId = await this.recordCorroboration(match);
        recorded.push({ ...match, id: matchId, createdAt: new Date() });
      } catch (error) {
        console.error('Failed to record corroboration:', error);
      }
    }

    return recorded;
  }

  /**
   * Get source credibility profile
   */
  async getSourceCredibility(
    userId: string,
    contactEmail: string
  ): Promise<SourceCredibility | null> {
    const result = await this.pool.query(`
      SELECT 
        ncc.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'category', event_category,
            'score', specialty_score,
            'signalCount', total_signals,
            'accuracy', base_accuracy
          ))
          FROM specialty_scores
          WHERE contact_credibility_id = ncc.id),
          '[]'::json
        ) as specialties
      FROM news_contact_credibility ncc
      WHERE user_id = $1 AND contact_email = $2
    `, [userId, contactEmail]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      contactEmail: row.contact_email,
      contactName: row.contact_name,
      contactCompany: row.contact_company,
      contactRole: row.contact_role,
      totalSignals: row.total_signals,
      corroboratedSignals: row.corroborated_signals,
      failedSignals: row.failed_signals,
      pendingSignals: row.pending_signals,
      credibilityScore: parseFloat(row.credibility_score),
      avgLeadTimeDays: parseFloat(row.avg_lead_time_days) || 0,
      avgCorroborationTimeDays: parseFloat(row.avg_corroboration_time_days) || 0,
      intelligenceValueScore: parseFloat(row.intelligence_value_score) || 0,
      consistencyScore: parseFloat(row.consistency_score) || 0,
      avgImpactMagnitude: parseFloat(row.avg_impact_magnitude) || 0,
      specialties: row.specialties,
      lastSignalAt: row.last_signal_at,
      lastCorroborationAt: row.last_corroboration_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * List all sources with credibility scores
   */
  async listSources(userId: string): Promise<SourceCredibility[]> {
    const result = await this.pool.query(`
      SELECT 
        ncc.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'category', event_category,
            'score', specialty_score,
            'signalCount', total_signals,
            'accuracy', base_accuracy
          ))
          FROM specialty_scores
          WHERE contact_credibility_id = ncc.id),
          '[]'::json
        ) as specialties
      FROM news_contact_credibility ncc
      WHERE user_id = $1
      ORDER BY intelligence_value_score DESC NULLS LAST, credibility_score DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      contactEmail: row.contact_email,
      contactName: row.contact_name,
      contactCompany: row.contact_company,
      contactRole: row.contact_role,
      totalSignals: row.total_signals,
      corroboratedSignals: row.corroborated_signals,
      failedSignals: row.failed_signals,
      pendingSignals: row.pending_signals,
      credibilityScore: parseFloat(row.credibility_score),
      avgLeadTimeDays: parseFloat(row.avg_lead_time_days) || 0,
      avgCorroborationTimeDays: parseFloat(row.avg_corroboration_time_days) || 0,
      intelligenceValueScore: parseFloat(row.intelligence_value_score) || 0,
      consistencyScore: parseFloat(row.consistency_score) || 0,
      avgImpactMagnitude: parseFloat(row.avg_impact_magnitude) || 0,
      specialties: row.specialties,
      lastSignalAt: row.last_signal_at,
      lastCorroborationAt: row.last_corroboration_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Get network intelligence value rankings
   */
  async getNetworkIntelligenceValue(userId: string): Promise<IntelligenceValue[]> {
    const result = await this.pool.query(`
      SELECT 
        contact_email,
        contact_name,
        intelligence_value_score,
        CASE 
          WHEN intelligence_value_score > 80 THEN 'top'
          WHEN intelligence_value_score >= 60 THEN 'mid'
          ELSE 'low'
        END as tier,
        avg_lead_time_days,
        CASE 
          WHEN (corroborated_signals + failed_signals) > 0
          THEN (corroborated_signals::DECIMAL / (corroborated_signals + failed_signals)::DECIMAL) * 100
          ELSE 0
        END as accuracy,
        avg_impact_magnitude,
        consistency_score,
        total_signals
      FROM news_contact_credibility
      WHERE user_id = $1
        AND total_signals > 0
      ORDER BY intelligence_value_score DESC NULLS LAST
    `, [userId]);

    return result.rows.map(row => ({
      contactEmail: row.contact_email,
      contactName: row.contact_name,
      intelligenceValueScore: parseFloat(row.intelligence_value_score) || 0,
      tier: row.tier,
      avgLeadTimeDays: parseFloat(row.avg_lead_time_days) || 0,
      accuracy: parseFloat(row.accuracy) || 0,
      avgImpact: parseFloat(row.avg_impact_magnitude) || 0,
      consistency: parseFloat(row.consistency_score) || 0,
      totalSignals: row.total_signals
    }));
  }

  /**
   * Generate predictive credibility for a new event
   */
  async generatePrediction(eventId: string): Promise<PredictiveCredibility | null> {
    const client = await this.pool.connect();
    try {
      // Get event details
      const eventResult = await client.query(`
        SELECT source_user_id, source_name, event_category, event_type
        FROM news_events
        WHERE id = $1
      `, [eventId]);

      if (eventResult.rows.length === 0) return null;

      const event = eventResult.rows[0];
      const contactEmail = event.source_name?.replace('Email: ', '');

      if (!contactEmail) return null;

      // Get contact credibility
      const credResult = await client.query(`
        SELECT id, credibility_score, total_signals, corroborated_signals,
               failed_signals, avg_corroboration_time_days
        FROM news_contact_credibility
        WHERE user_id = $1 AND contact_email = $2
      `, [event.source_user_id, contactEmail]);

      if (credResult.rows.length === 0) return null;

      const cred = credResult.rows[0];
      const historicalAccuracy = (cred.corroborated_signals + cred.failed_signals) > 0
        ? (cred.corroborated_signals / (cred.corroborated_signals + cred.failed_signals)) * 100
        : 50;

      // Check specialty match
      const specialtyResult = await client.query(`
        SELECT specialty_score, total_signals
        FROM specialty_scores
        WHERE contact_credibility_id = $1
          AND event_category = $2
          AND (event_type = $3 OR event_type IS NULL)
        ORDER BY event_type NULLS LAST
        LIMIT 1
      `, [cred.id, event.event_category, event.event_type]);

      const specialtyMatch = specialtyResult.rows.length > 0;
      const specialtyAccuracy = specialtyMatch 
        ? parseFloat(specialtyResult.rows[0].specialty_score)
        : null;

      const predictedAccuracy = specialtyMatch && specialtyAccuracy
        ? specialtyAccuracy
        : historicalAccuracy;

      const confidenceLevel = this.getConfidenceLevel(
        predictedAccuracy / 100,
        cred.total_signals
      );

      const appliedWeight = predictedAccuracy / 100;

      // Insert prediction
      await client.query(`
        INSERT INTO predictive_credibility (
          event_id, contact_credibility_id, predicted_accuracy,
          predicted_corroboration_days, confidence_level,
          historical_accuracy, specialty_match, specialty_accuracy,
          sample_size, applied_weight
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (event_id) DO UPDATE SET
          predicted_accuracy = $3,
          predicted_corroboration_days = $4,
          confidence_level = $5,
          updated_at = NOW()
      `, [
        eventId,
        cred.id,
        predictedAccuracy,
        Math.round(cred.avg_corroboration_time_days) || null,
        confidenceLevel,
        historicalAccuracy,
        specialtyMatch,
        specialtyAccuracy,
        cred.total_signals,
        appliedWeight
      ]);

      return {
        eventId,
        predictedAccuracy,
        predictedCorroborationDays: Math.round(cred.avg_corroboration_time_days) || null,
        confidenceLevel,
        historicalAccuracy,
        specialtyMatch,
        specialtyAccuracy,
        sampleSize: cred.total_signals,
        appliedWeight
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get recent corroborations
   */
  async getRecentCorroborations(
    userId: string,
    limit: number = 20
  ): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT 
        cm.*,
        pe.extracted_data->>'company_name' as private_company,
        pe.published_at as private_date,
        pub.extracted_data->>'company_name' as public_company,
        pub.published_at as public_date,
        pub.source_name as public_source,
        ncc.contact_email,
        ncc.contact_name
      FROM corroboration_matches cm
      JOIN news_events pe ON pe.id = cm.private_event_id
      JOIN news_events pub ON pub.id = cm.public_event_id
      JOIN news_contact_credibility ncc ON ncc.contact_email = REPLACE(pe.source_name, 'Email: ', '')
      WHERE ncc.user_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2
    `, [userId, limit]);

    return result.rows;
  }

  /**
   * Determine confidence level based on score and sample size
   */
  private getConfidenceLevel(
    score: number,
    sampleSize: number = 0
  ): 'low' | 'medium' | 'high' | 'very_high' {
    if (sampleSize < 3) return 'low';
    if (score >= 0.85 && sampleSize >= 10) return 'very_high';
    if (score >= 0.75 && sampleSize >= 5) return 'high';
    if (score >= 0.60) return 'medium';
    return 'low';
  }
}

export default new SourceCredibilityService();
