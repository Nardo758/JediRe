/**
 * Events API Routes
 * 
 * Endpoints for viewing event logs, consumer health, event replay,
 * and cascade tracing.
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Router } from 'express';
import { query } from '../../database/connection';
import { consumerManager } from '../../services/kafka/kafka-consumer-manager.service';
import { retryHandler } from '../../services/kafka/retry-handler.service';
import { kafkaProducer } from '../../services/kafka/kafka-producer.service';

const router = Router();

// ============================================================================
// GET /api/v1/events/log
// Get event processing log with filters
// ============================================================================

router.get('/log', async (req, res) => {
  try {
    const {
      topic,
      eventType,
      dealId,
      tradeAreaId,
      publishedBy,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    let sql = `
      SELECT 
        id,
        event_id,
        topic,
        event_type,
        published_by,
        published_at,
        partition,
        offset,
        magnitude,
        confidence_score,
        deal_id,
        trade_area_ids,
        submarket_ids,
        msa_ids,
        payload
      FROM kafka_events_log
      WHERE 1=1
    `;

    const params: any[] = [];

    if (topic) {
      params.push(topic);
      sql += ` AND topic = $${params.length}`;
    }

    if (eventType) {
      params.push(eventType);
      sql += ` AND event_type = $${params.length}`;
    }

    if (dealId) {
      params.push(dealId);
      sql += ` AND deal_id = $${params.length}`;
    }

    if (tradeAreaId) {
      params.push(tradeAreaId);
      sql += ` AND $${params.length} = ANY(trade_area_ids)`;
    }

    if (publishedBy) {
      params.push(publishedBy);
      sql += ` AND published_by = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      sql += ` AND published_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      sql += ` AND published_at <= $${params.length}`;
    }

    sql += ` ORDER BY published_at DESC`;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // Get total count
    const countSql = sql.split('ORDER BY')[0];
    const countResult = await query(
      countSql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM'),
      params.slice(0, -2)
    );

    res.json({
      events: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    console.error('Error fetching event log:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/v1/events/status
// Get consumer health status
// ============================================================================

router.get('/status', async (req, res) => {
  try {
    // Get consumer status from manager
    const consumers = consumerManager.getConsumerStatus();

    // Get health metrics from database
    const healthResult = await query(`
      SELECT 
        consumer_group,
        consumer_name,
        topic,
        partition,
        status,
        lag,
        messages_processed_last_minute,
        avg_processing_time_ms,
        error_rate_percent,
        last_heartbeat
      FROM consumer_health_status
      ORDER BY consumer_group, consumer_name, topic, partition
    `);

    // Get retry statistics
    const retryStats = await retryHandler.getRetryStatistics();

    // Producer health check
    const producerHealthy = await kafkaProducer.healthCheck();

    res.json({
      producer: {
        healthy: producerHealthy,
      },
      consumers: consumers.map((c) => ({
        id: c.id,
        groupId: c.groupId,
        name: c.name,
        topics: c.topics,
        isRunning: c.isRunning,
        health: healthResult.rows.filter(
          (h) => h.consumer_group === c.groupId && h.consumer_name === c.name
        ),
      })),
      retry: retryStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching consumer status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/v1/events/replay/:eventId
// Replay a failed event
// ============================================================================

router.post('/replay/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await retryHandler.manualRetry(eventId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        eventId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        eventId,
      });
    }
  } catch (error: any) {
    console.error('Error replaying event:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/v1/events/trace/:eventId
// Get full cascade trace for an event
// ============================================================================

router.get('/trace/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    // Get the root event
    const rootResult = await query(
      `SELECT 
        kel.*,
        ect.root_event_id,
        ect.cascade_path
       FROM kafka_events_log kel
       LEFT JOIN event_cascade_trace ect ON ect.event_id = kel.event_id
       WHERE kel.event_id = $1
       LIMIT 1`,
      [eventId]
    );

    if (rootResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const rootEvent = rootResult.rows[0];
    const rootEventId = rootEvent.root_event_id || eventId;

    // Get all events in the cascade
    const cascadeResult = await query(
      `SELECT 
        kel.*,
        ect.parent_event_id,
        ect.depth,
        ect.cascade_path,
        eps.status as processing_status,
        eps.consumer_group,
        eps.consumer_name,
        eps.error_message,
        eps.duration_ms
       FROM event_cascade_trace ect
       JOIN kafka_events_log kel ON kel.event_id = ect.event_id
       LEFT JOIN event_processing_status eps ON eps.event_id = ect.event_id
       WHERE ect.root_event_id = $1
       ORDER BY ect.depth, ect.created_at`,
      [rootEventId]
    );

    // Build cascade tree
    const cascadeTree = buildCascadeTree(cascadeResult.rows);

    res.json({
      rootEventId,
      rootEvent: {
        eventId: rootEvent.event_id,
        topic: rootEvent.topic,
        eventType: rootEvent.event_type,
        publishedAt: rootEvent.published_at,
        publishedBy: rootEvent.published_by,
        payload: rootEvent.payload,
      },
      cascade: cascadeTree,
      totalEvents: cascadeResult.rows.length,
    });
  } catch (error: any) {
    console.error('Error tracing event:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/v1/events/analytics
// Get event analytics and statistics
// ============================================================================

router.get('/analytics', async (req, res) => {
  try {
    const { period = '24h' } = req.query;

    // Calculate time interval
    const intervalMap: Record<string, string> = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    const interval = intervalMap[period as string] || '24 hours';

    // Events by topic
    const topicStats = await query(
      `SELECT topic, COUNT(*) as count
       FROM kafka_events_log
       WHERE published_at > NOW() - INTERVAL '${interval}'
       GROUP BY topic
       ORDER BY count DESC`
    );

    // Events by hour (last 24h)
    const hourlyStats = await query(
      `SELECT 
        date_trunc('hour', published_at) as hour,
        COUNT(*) as count
       FROM kafka_events_log
       WHERE published_at > NOW() - INTERVAL '24 hours'
       GROUP BY hour
       ORDER BY hour`
    );

    // Processing success rate
    const processingStats = await query(
      `SELECT 
        status,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration
       FROM event_processing_status
       WHERE completed_at > NOW() - INTERVAL '${interval}'
       GROUP BY status`
    );

    // Top publishers
    const publisherStats = await query(
      `SELECT 
        published_by,
        COUNT(*) as count
       FROM kafka_events_log
       WHERE published_at > NOW() - INTERVAL '${interval}'
       GROUP BY published_by
       ORDER BY count DESC
       LIMIT 10`
    );

    res.json({
      period,
      byTopic: topicStats.rows,
      byHour: hourlyStats.rows,
      processing: processingStats.rows,
      topPublishers: publisherStats.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build cascade tree from flat array
 */
function buildCascadeTree(events: any[]): any[] {
  const eventMap = new Map<string, any>();

  // First pass: create event nodes
  events.forEach((event) => {
    eventMap.set(event.event_id, {
      eventId: event.event_id,
      topic: event.topic,
      eventType: event.event_type,
      publishedAt: event.published_at,
      publishedBy: event.published_by,
      depth: event.depth,
      parentEventId: event.parent_event_id,
      processingStatus: event.processing_status,
      consumerGroup: event.consumer_group,
      consumerName: event.consumer_name,
      errorMessage: event.error_message,
      durationMs: event.duration_ms,
      payload: event.payload,
      children: [],
    });
  });

  // Second pass: build tree
  const roots: any[] = [];

  eventMap.forEach((node) => {
    if (node.parentEventId) {
      const parent = eventMap.get(node.parentEventId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export default router;
