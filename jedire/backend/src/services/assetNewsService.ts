/**
 * Asset News Service
 * Handles auto-linking news events to assets and manual management
 */

import { PoolClient } from 'pg';
import { logger } from '../utils/logger';
import {
  AssetNewsLink,
  AssetNewsLinkWithEvent,
  CreateAssetNewsLinkInput,
  UpdateAssetNewsLinkInput,
  AssetNewsResponse,
  NewsLinkType,
  Location,
} from '../types/assetMapIntelligence.types';
import {
  findNewsEventsWithinRadius,
  calculateImpactScore,
} from '../utils/spatialHelpers';

class AssetNewsService {
  /**
   * Get all news events linked to an asset
   */
  async getAssetNews(
    client: PoolClient,
    assetId: string,
    options: {
      radius?: number;
      type?: string;
      excludeDismissed?: boolean;
      includeLink?: boolean;
    } = {}
  ): Promise<AssetNewsResponse> {
    try {
      const { radius, type, excludeDismissed = true, includeLink = true } = options;

      const whereClauses: string[] = ['anl.asset_id = $1'];
      const params: any[] = [assetId];
      let paramIndex = 2;

      // Filter by event type
      if (type) {
        whereClauses.push(`ne.type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }

      // Exclude dismissed links
      if (excludeDismissed) {
        whereClauses.push(`anl.link_type != 'dismissed'`);
      }

      const query = `
        SELECT 
          anl.id,
          anl.asset_id,
          anl.news_event_id,
          anl.link_type,
          anl.distance_miles,
          anl.impact_score,
          anl.user_notes,
          anl.linked_by,
          anl.linked_at,
          anl.dismissed_by,
          anl.dismissed_at,
          ne.id as event_id,
          ne.title as event_title,
          ne.published_at as event_date,
          ne.type as event_type,
          ne.description as event_description,
          ST_Y(ne.location::geometry) as event_lat,
          ST_X(ne.location::geometry) as event_lng
        FROM asset_news_links anl
        JOIN news_events ne ON ne.id = anl.news_event_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY anl.impact_score DESC, anl.distance_miles ASC
      `;

      const result = await client.query(query, params);

      const newsEvents: AssetNewsLinkWithEvent[] = result.rows.map(row => ({
        id: row.id,
        assetId: row.asset_id,
        newsEventId: row.news_event_id,
        linkType: row.link_type as NewsLinkType,
        distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
        impactScore: row.impact_score,
        userNotes: row.user_notes,
        linkedBy: row.linked_by,
        linkedAt: new Date(row.linked_at),
        dismissedBy: row.dismissed_by,
        dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : null,
        createdAt: new Date(row.linked_at),
        updatedAt: new Date(row.linked_at),
        newsEvent: {
          id: row.event_id,
          title: row.event_title,
          date: new Date(row.event_date),
          type: row.event_type,
          location: row.event_lat && row.event_lng
            ? { lat: parseFloat(row.event_lat), lng: parseFloat(row.event_lng) }
            : null,
          description: row.event_description,
        },
      }));

      // Get counts by link type
      const countQuery = `
        SELECT 
          link_type,
          COUNT(*) as count
        FROM asset_news_links
        WHERE asset_id = $1
        GROUP BY link_type
      `;

      const countResult = await client.query(countQuery, [assetId]);
      const counts = {
        autoLinked: 0,
        manualLinked: 0,
        dismissed: 0,
      };

      for (const row of countResult.rows) {
        if (row.link_type === 'auto') counts.autoLinked = parseInt(row.count);
        if (row.link_type === 'manual') counts.manualLinked = parseInt(row.count);
        if (row.link_type === 'dismissed') counts.dismissed = parseInt(row.count);
      }

      return {
        assetId,
        newsEvents,
        total: newsEvents.length,
        autoLinked: counts.autoLinked,
        manualLinked: counts.manualLinked,
        dismissed: counts.dismissed,
      };
    } catch (error) {
      logger.error('Error fetching asset news:', error);
      throw new Error('Failed to fetch asset news');
    }
  }

  /**
   * Manually link a news event to an asset
   */
  async linkNewsToAsset(
    client: PoolClient,
    input: CreateAssetNewsLinkInput
  ): Promise<AssetNewsLink> {
    try {
      // Check if link already exists
      const existingQuery = `
        SELECT id, link_type FROM asset_news_links
        WHERE asset_id = $1 AND news_event_id = $2
      `;
      const existing = await client.query(existingQuery, [input.assetId, input.newsEventId]);

      if (existing.rows.length > 0) {
        const existingLink = existing.rows[0];

        // If dismissed, update to manual
        if (existingLink.link_type === 'dismissed') {
          return await this.updateLinkType(
            client,
            existingLink.id,
            'manual',
            input.linkedBy || null
          );
        }

        throw new Error('News event is already linked to this asset');
      }

      // Insert new link
      const query = `
        INSERT INTO asset_news_links (
          asset_id,
          news_event_id,
          link_type,
          distance_miles,
          impact_score,
          user_notes,
          linked_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await client.query(query, [
        input.assetId,
        input.newsEventId,
        input.linkType,
        input.distanceMiles || null,
        input.impactScore || null,
        input.userNotes || null,
        input.linkedBy || null,
      ]);

      const row = result.rows[0];

      logger.info(`News link created: ${row.id} (${input.linkType})`);

      return {
        id: row.id,
        assetId: row.asset_id,
        newsEventId: row.news_event_id,
        linkType: row.link_type as NewsLinkType,
        distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
        impactScore: row.impact_score,
        userNotes: row.user_notes,
        linkedBy: row.linked_by,
        linkedAt: new Date(row.linked_at),
        dismissedBy: row.dismissed_by,
        dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (error: any) {
      logger.error('Error linking news to asset:', error);
      throw error;
    }
  }

  /**
   * Update news link (user notes, impact score)
   */
  async updateNewsLink(
    client: PoolClient,
    linkId: string,
    input: UpdateAssetNewsLinkInput
  ): Promise<AssetNewsLink> {
    try {
      const updates: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.userNotes !== undefined) {
        updates.push(`user_notes = $${paramIndex}`);
        params.push(input.userNotes);
        paramIndex++;
      }

      if (input.impactScore !== undefined) {
        if (input.impactScore < 1 || input.impactScore > 10) {
          throw new Error('Impact score must be between 1 and 10');
        }
        updates.push(`impact_score = $${paramIndex}`);
        params.push(input.impactScore);
        paramIndex++;
      }

      params.push(linkId);

      const query = `
        UPDATE asset_news_links
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('News link not found');
      }

      const row = result.rows[0];

      logger.info(`News link updated: ${linkId}`);

      return {
        id: row.id,
        assetId: row.asset_id,
        newsEventId: row.news_event_id,
        linkType: row.link_type as NewsLinkType,
        distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
        impactScore: row.impact_score,
        userNotes: row.user_notes,
        linkedBy: row.linked_by,
        linkedAt: new Date(row.linked_at),
        dismissedBy: row.dismissed_by,
        dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (error: any) {
      logger.error('Error updating news link:', error);
      throw error;
    }
  }

  /**
   * Dismiss a news link
   */
  async dismissNewsLink(
    client: PoolClient,
    assetId: string,
    newsEventId: string,
    userId: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE asset_news_links
        SET 
          link_type = 'dismissed',
          dismissed_by = $3,
          dismissed_at = NOW(),
          updated_at = NOW()
        WHERE asset_id = $1 AND news_event_id = $2
      `;

      const result = await client.query(query, [assetId, newsEventId, userId]);

      if (result.rowCount === 0) {
        throw new Error('News link not found');
      }

      logger.info(`News link dismissed: asset=${assetId}, news=${newsEventId}`);
    } catch (error: any) {
      logger.error('Error dismissing news link:', error);
      throw error;
    }
  }

  /**
   * Auto-link news events to assets within radius
   */
  async autoLinkNewsToAssets(
    client: PoolClient,
    newsEventId: string,
    radiusMiles: number = 5.0
  ): Promise<number> {
    try {
      // Call the database function to auto-link
      const query = `SELECT auto_link_news_to_assets($1, $2) as linked_count`;
      const result = await client.query(query, [newsEventId, radiusMiles]);

      const linkedCount = result.rows[0]?.linked_count || 0;

      logger.info(`Auto-linked news event ${newsEventId} to ${linkedCount} assets`);

      return linkedCount;
    } catch (error) {
      logger.error('Error auto-linking news to assets:', error);
      throw new Error('Failed to auto-link news to assets');
    }
  }

  /**
   * Update link type (helper method)
   */
  private async updateLinkType(
    client: PoolClient,
    linkId: string,
    linkType: NewsLinkType,
    userId: string | null
  ): Promise<AssetNewsLink> {
    const query = `
      UPDATE asset_news_links
      SET 
        link_type = $1,
        linked_by = $2,
        linked_at = NOW(),
        dismissed_by = NULL,
        dismissed_at = NULL,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await client.query(query, [linkType, userId, linkId]);
    const row = result.rows[0];

    return {
      id: row.id,
      assetId: row.asset_id,
      newsEventId: row.news_event_id,
      linkType: row.link_type as NewsLinkType,
      distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
      impactScore: row.impact_score,
      userNotes: row.user_notes,
      linkedBy: row.linked_by,
      linkedAt: new Date(row.linked_at),
      dismissedBy: row.dismissed_by,
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const assetNewsService = new AssetNewsService();
