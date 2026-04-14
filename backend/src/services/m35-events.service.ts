/**
 * M35 Event Impact Engine — Events Service
 *
 * CRUD, lifecycle state machine, taxonomy queries, and metric watchlist management.
 * Publishes Kafka events on create/status-change/verify.
 *
 * Status machine:
 *   draft → announced → in_progress → materialized
 *              ↓             ↓              ↓
 *           delayed       delayed        reversed
 *              ↓
 *           cancelled
 */

import { randomUUID } from 'crypto';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';
import {
  KAFKA_TOPICS,
  type M35EventIngestedMessage,
  type M35EventStatusChangedMessage,
  type M35EventVerifiedMessage,
  type M35EventCategory,
  type M35EventScope,
  type M35EventStatus,
} from './kafka/event-schemas';

// Re-export so consumers can import everything M35 from one place
export type { M35EventCategory, M35EventScope, M35EventStatus };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateEventInput {
  category: M35EventCategory;
  subtype?: string;
  name: string;
  description?: string;
  tags?: string[];
  scope: M35EventScope;
  msaId?: string;
  msaName?: string;
  submarketId?: string;
  submarketName?: string;
  propertyId?: string;
  lat?: number;
  lng?: number;
  magnitudeScore?: number;
  magnitudeValue?: number;
  magnitudeUnit?: string;
  announcedDate?: Date | string;
  materializationDate?: Date | string;
  completionDate?: Date | string;
  confidence?: number;
  ingestionSource?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  rawPayload?: Record<string, unknown>;
  newsItemIds?: string[];
  createdBy?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  id: string;
}

export interface EventSearchParams {
  msaId?: string;
  submarketId?: string;
  category?: M35EventCategory;
  subtype?: string;
  status?: M35EventStatus | M35EventStatus[];
  scope?: M35EventScope;
  minConfidence?: number;
  isVerified?: boolean;
  fromDate?: Date | string;
  toDate?: Date | string;
  dealId?: string;
  limit?: number;
  offset?: number;
}

export interface KeyEvent {
  id: string;
  category: string;
  subtype?: string;
  name: string;
  description?: string;
  scope: string;
  msaId?: string;
  msaName?: string;
  submarketId?: string;
  submarketName?: string;
  magnitudeScore: number;
  status: string;
  confidence: number;
  isVerified: boolean;
  announcedDate?: string;
  materializationDate?: string;
  ingestionSource?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomySubtype {
  id: string;
  category: string;
  subtype: string;
  displayName: string;
  description?: string;
  defaultMetrics: string[];
  typicalLagMonths: number;
  measureWindowMonths: number;
  primaryMagnitudeUnit?: string;
}

// ─── Valid status transitions ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<M35EventStatus, M35EventStatus[]> = {
  draft:        ['announced', 'cancelled'],
  announced:    ['in_progress', 'delayed', 'cancelled'],
  in_progress:  ['materialized', 'delayed', 'cancelled'],
  materialized: ['reversed'],
  delayed:      ['announced', 'in_progress', 'cancelled'],
  cancelled:    [],
  reversed:     [],
};

function isValidTransition(from: M35EventStatus, to: M35EventStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

export async function getTaxonomy(category?: M35EventCategory): Promise<TaxonomySubtype[]> {
  const pool = getPool();
  const params: unknown[] = [];
  let where = 'WHERE is_active = true';
  if (category) { where += ` AND category = $1`; params.push(category); }

  const result = await pool.query(
    `SELECT id, category, subtype, display_name, description,
            default_metrics, typical_lag_months, measure_window_months,
            primary_magnitude_unit
     FROM event_taxonomy ${where}
     ORDER BY category, sort_order, display_name`,
    params
  );

  return result.rows.map(r => ({
    id: r.id,
    category: r.category,
    subtype: r.subtype,
    displayName: r.display_name,
    description: r.description,
    defaultMetrics: r.default_metrics ?? [],
    typicalLagMonths: r.typical_lag_months,
    measureWindowMonths: r.measure_window_months,
    primaryMagnitudeUnit: r.primary_magnitude_unit,
  }));
}

export async function getTaxonomySubtype(subtype: string): Promise<TaxonomySubtype | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, category, subtype, display_name, description,
            default_metrics, typical_lag_months, measure_window_months,
            primary_magnitude_unit
     FROM event_taxonomy WHERE subtype = $1`,
    [subtype]
  );
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return {
    id: r.id,
    category: r.category,
    subtype: r.subtype,
    displayName: r.display_name,
    description: r.description,
    defaultMetrics: r.default_metrics ?? [],
    typicalLagMonths: r.typical_lag_months,
    measureWindowMonths: r.measure_window_months,
    primaryMagnitudeUnit: r.primary_magnitude_unit,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createEvent(input: CreateEventInput): Promise<KeyEvent> {
  const pool = getPool();

  // Look up taxonomy subtype ID if subtype provided
  let taxonomySubtypeId: string | null = null;
  if (input.subtype) {
    const tx = await pool.query(`SELECT id FROM event_taxonomy WHERE subtype = $1`, [input.subtype]);
    taxonomySubtypeId = tx.rows[0]?.id ?? null;
  }

  const id = randomUUID();
  const now = new Date();

  const result = await pool.query(
    `INSERT INTO key_events (
       id, category, subtype, taxonomy_subtype_id, name, description, tags,
       scope, msa_id, msa_name, submarket_id, submarket_name, property_id,
       lat, lng, magnitude_score, magnitude_value, magnitude_unit,
       announced_date, materialization_date, completion_date,
       status, confidence, ingestion_source, source_url, source_record_id,
       raw_payload, news_item_ids, created_by, created_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
       $19,$20,$21,'draft',$22,$23,$24,$25,$26,$27,$28,$29,$30
     ) RETURNING *`,
    [
      id,
      input.category,
      input.subtype ?? null,
      taxonomySubtypeId,
      input.name,
      input.description ?? null,
      JSON.stringify(input.tags ?? []),
      input.scope,
      input.msaId ?? null,
      input.msaName ?? null,
      input.submarketId ?? null,
      input.submarketName ?? null,
      input.propertyId ?? null,
      input.lat ?? null,
      input.lng ?? null,
      input.magnitudeScore ?? 2,
      input.magnitudeValue ?? null,
      input.magnitudeUnit ?? null,
      input.announcedDate ? new Date(input.announcedDate) : null,
      input.materializationDate ? new Date(input.materializationDate) : null,
      input.completionDate ? new Date(input.completionDate) : null,
      input.confidence ?? 0.5,
      input.ingestionSource ?? 'manual',
      input.sourceUrl ?? null,
      input.sourceRecordId ?? null,
      input.rawPayload ? JSON.stringify(input.rawPayload) : null,
      JSON.stringify(input.newsItemIds ?? []),
      input.createdBy ?? null,
      now,
      now,
    ]
  );

  const event = rowToKeyEvent(result.rows[0]);

  // Seed default metric watchlist from taxonomy
  if (taxonomySubtypeId) {
    await seedDefaultWatchlist(id, input.subtype!);
  }

  // Publish Kafka — fire-and-forget so Kafka unavailability never blocks the API
  const msg: M35EventIngestedMessage = {
    eventId: id,
    eventType: 'M35_EVENT_INGESTED',
    timestamp: now.toISOString(),
    version: '1.0',
    msaId: input.msaId ?? '',
    submarketId: input.submarketId,
    category: input.category,
    subtype: input.subtype ?? '',
    scope: input.scope,
    name: input.name,
    announcedDate: input.announcedDate ? new Date(input.announcedDate).toISOString() : undefined,
    materializationDate: input.materializationDate ? new Date(input.materializationDate).toISOString() : undefined,
    magnitudeScore: input.magnitudeScore ?? 2,
    confidence: input.confidence ?? 0.5,
    ingestionSource: input.ingestionSource ?? 'manual',
  };
  void kafkaProducer.publish(KAFKA_TOPICS.M35_EVENT_INGESTED, msg, { key: id })
    .catch((err: Error) => logger.warn('[M35 Events] Kafka publish failed (non-fatal)', { err: err.message }));

  logger.info('[M35 Events] Created event', { id, name: input.name, category: input.category });
  return event;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getEventById(id: string): Promise<KeyEvent | null> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM key_events WHERE id = $1`, [id]);
  return result.rows.length ? rowToKeyEvent(result.rows[0]) : null;
}

export async function searchEvents(params: EventSearchParams): Promise<{ items: KeyEvent[]; total: number }> {
  const pool = getPool();
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const push = (cond: string, val: unknown) => { conditions.push(cond); values.push(val); i++; };

  if (params.msaId)        push(`msa_id = $${i}`, params.msaId);
  if (params.submarketId)  push(`submarket_id = $${i}`, params.submarketId);
  if (params.category)     push(`category = $${i}`, params.category);
  if (params.subtype)      push(`subtype = $${i}`, params.subtype);
  if (params.scope)        push(`scope = $${i}`, params.scope);
  if (params.isVerified !== undefined) push(`is_verified = $${i}`, params.isVerified);
  if (params.minConfidence !== undefined) push(`confidence >= $${i}`, params.minConfidence);
  if (params.fromDate)     push(`announced_date >= $${i}`, new Date(params.fromDate));
  if (params.toDate)       push(`announced_date <= $${i}`, new Date(params.toDate));

  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    push(`status = ANY($${i}::m35_event_status[])`, statuses);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = params.limit  ?? 25;
  const offset = params.offset ?? 0;

  const [rows, countRow] = await Promise.all([
    pool.query(
      `SELECT * FROM key_events ${where} ORDER BY announced_date DESC NULLS LAST, created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...values, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) as total FROM key_events ${where}`, values),
  ]);

  return {
    items: rows.rows.map(rowToKeyEvent),
    total: parseInt(countRow.rows[0].total, 10),
  };
}

export async function getEventsByDeal(dealId: string): Promise<KeyEvent[]> {
  const pool = getPool();
  // Events whose geographic impacts include this deal's property or submarket
  // For now: return events where deal's property_id is referenced
  // Full proximity engine is Task #187 — this is a shell implementation
  const result = await pool.query(
    `SELECT ke.* FROM key_events ke
     WHERE ke.property_id = $1
        OR ke.status NOT IN ('cancelled','reversed')
     ORDER BY ke.announced_date DESC NULLS LAST
     LIMIT 20`,
    [dealId]
  );
  return result.rows.map(rowToKeyEvent);
}

export async function getActiveEventsBySubmarket(submarketId: string): Promise<KeyEvent[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT ke.* FROM key_events ke
     WHERE ke.submarket_id = $1
       AND ke.status NOT IN ('cancelled','reversed')
     ORDER BY ke.materialization_date ASC NULLS LAST
     LIMIT 50`,
    [submarketId]
  );
  return result.rows.map(rowToKeyEvent);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateEvent(input: UpdateEventInput): Promise<KeyEvent | null> {
  const pool = getPool();

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const set = (col: string, val: unknown) => { fields.push(`${col} = $${i++}`); values.push(val); };

  if (input.name !== undefined)             set('name', input.name);
  if (input.description !== undefined)      set('description', input.description);
  if (input.tags !== undefined)             set('tags', JSON.stringify(input.tags));
  if (input.magnitudeScore !== undefined)   set('magnitude_score', input.magnitudeScore);
  if (input.magnitudeValue !== undefined)   set('magnitude_value', input.magnitudeValue);
  if (input.magnitudeUnit !== undefined)    set('magnitude_unit', input.magnitudeUnit);
  if (input.confidence !== undefined)       set('confidence', input.confidence);
  if (input.announcedDate !== undefined)    set('announced_date', input.announcedDate ? new Date(input.announcedDate) : null);
  if (input.materializationDate !== undefined) set('materialization_date', input.materializationDate ? new Date(input.materializationDate) : null);
  if (input.sourceUrl !== undefined)        set('source_url', input.sourceUrl);

  if (!fields.length) return getEventById(input.id);

  set('updated_at', new Date());
  values.push(input.id);

  const result = await pool.query(
    `UPDATE key_events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows.length ? rowToKeyEvent(result.rows[0]) : null;
}

// ─── Status transitions ───────────────────────────────────────────────────────

export async function transitionStatus(
  eventId: string,
  toStatus: M35EventStatus,
  options: { reason?: string; changedBy?: string } = {}
): Promise<{ event: KeyEvent; historyId: string }> {
  const pool = getPool();

  const existing = await pool.query(`SELECT status, msa_id FROM key_events WHERE id = $1`, [eventId]);
  if (!existing.rows.length) throw new Error(`Event ${eventId} not found`);

  const fromStatus = existing.rows[0].status as M35EventStatus;
  const msaId: string = existing.rows[0].msa_id ?? '';

  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(`Invalid status transition: ${fromStatus} → ${toStatus}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE key_events SET status = $1, updated_at = now() WHERE id = $2`,
      [toStatus, eventId]
    );

    const historyResult = await client.query(
      `INSERT INTO event_status_history (event_id, from_status, to_status, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [eventId, fromStatus, toStatus, options.reason ?? null, options.changedBy ?? null]
    );

    await client.query('COMMIT');

    const historyId: string = historyResult.rows[0].id;
    const event = (await getEventById(eventId))!;

    // Publish Kafka — fire-and-forget
    const statusMsg: M35EventStatusChangedMessage = {
      eventId,
      eventType: 'M35_EVENT_STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      version: '1.0',
      msaId,
      fromStatus,
      toStatus,
      reason: options.reason,
      changedBy: options.changedBy,
    };
    void kafkaProducer.publish(KAFKA_TOPICS.M35_EVENT_STATUS_CHANGED, statusMsg, { key: eventId })
      .catch((err: Error) => logger.warn('[M35 Events] Kafka status publish failed', { err: err.message }));

    logger.info('[M35 Events] Status transition', { eventId, fromStatus, toStatus });
    return { event, historyId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifyEvent(
  eventId: string,
  verifiedBy: string,
  confidenceOverride?: number
): Promise<KeyEvent> {
  const pool = getPool();

  const updates: string[] = ['is_verified = true', 'verified_by = $2', 'verified_at = now()', 'updated_at = now()'];
  const values: unknown[] = [eventId, verifiedBy];

  if (confidenceOverride !== undefined) {
    updates.push(`confidence = $${values.length + 1}`);
    values.push(confidenceOverride);
  }

  const result = await pool.query(
    `UPDATE key_events SET ${updates.join(', ')} WHERE id = $1 RETURNING *, msa_id`,
    values
  );
  if (!result.rows.length) throw new Error(`Event ${eventId} not found`);

  const event = rowToKeyEvent(result.rows[0]);

  // Publish Kafka — fire-and-forget
  const verifyMsg: M35EventVerifiedMessage = {
    eventId,
    eventType: 'M35_EVENT_VERIFIED',
    timestamp: new Date().toISOString(),
    version: '1.0',
    msaId: result.rows[0].msa_id ?? '',
    verifiedBy,
    verifiedAt: new Date().toISOString(),
    confidence: parseFloat(result.rows[0].confidence ?? '0.5'),
  };
  void kafkaProducer.publish(KAFKA_TOPICS.M35_EVENT_VERIFIED, verifyMsg, { key: eventId })
    .catch((err: Error) => logger.warn('[M35 Events] Kafka verify publish failed', { err: err.message }));

  return event;
}

// ─── Metric watchlist ─────────────────────────────────────────────────────────

async function seedDefaultWatchlist(eventId: string, subtype: string): Promise<void> {
  const pool = getPool();
  const tx = await getTaxonomySubtype(subtype);
  if (!tx?.defaultMetrics.length) return;

  for (const metric of tx.defaultMetrics) {
    await pool.query(
      `INSERT INTO m35_metric_watchlist_config (event_id, metric_key, display_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [eventId, metric, metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())]
    );
  }
}

export async function getWatchlist(eventId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM m35_metric_watchlist_config WHERE event_id = $1 AND is_active = true ORDER BY metric_key`,
    [eventId]
  );
  return result.rows;
}

export async function addWatchlistMetric(eventId: string, metricKey: string, displayName?: string, addedBy?: string) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO m35_metric_watchlist_config (event_id, metric_key, display_name, added_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, metric_key) DO UPDATE SET is_active = true
     RETURNING *`,
    [eventId, metricKey, displayName ?? metricKey, addedBy ?? null]
  );
  return result.rows[0];
}

// ─── Promote from draft queue ─────────────────────────────────────────────────
// Called by the connector promote endpoint when an analyst approves a m35_draft_event

export async function promoteFromDraftQueue(
  draftEventId: string,
  overrides: Partial<CreateEventInput> = {},
  promotedBy?: string
): Promise<KeyEvent> {
  const pool = getPool();
  const draft = await pool.query(`SELECT * FROM m35_draft_events WHERE id = $1`, [draftEventId]);
  if (!draft.rows.length) throw new Error(`Draft event ${draftEventId} not found`);

  const d = draft.rows[0];
  const input: CreateEventInput = {
    category:         (overrides.category ?? d.category) as M35EventCategory,
    subtype:          overrides.subtype ?? d.subtype,
    name:             overrides.name ?? d.name,
    description:      overrides.description ?? d.description,
    scope:            (overrides.scope ?? d.scope ?? 'SUBMARKET') as M35EventScope,
    msaId:            overrides.msaId ?? d.msa_id,
    submarketId:      overrides.submarketId ?? d.submarket_hint,
    lat:              overrides.lat ?? (d.lat ? parseFloat(d.lat) : undefined),
    lng:              overrides.lng ?? (d.lng ? parseFloat(d.lng) : undefined),
    magnitudeScore:   overrides.magnitudeScore ?? d.estimated_magnitude,
    confidence:       overrides.confidence ?? parseFloat(d.confidence ?? '0.5'),
    ingestionSource:  d.source_connector,
    sourceUrl:        d.source_url,
    sourceRecordId:   d.source_record_id,
    rawPayload:       d.raw_payload,
    createdBy:        promotedBy,
    announcedDate:    d.signal_date,
  };

  const event = await createEvent(input);

  await pool.query(
    `UPDATE m35_draft_events SET status = 'PROMOTED', promoted_event_id = $2, reviewed_by = $3, reviewed_at = now()
     WHERE id = $1`,
    [draftEventId, event.id, promotedBy ?? null]
  );

  return event;
}

// ─── Status history ───────────────────────────────────────────────────────────

export async function getStatusHistory(eventId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM event_status_history WHERE event_id = $1 ORDER BY changed_at DESC`,
    [eventId]
  );
  return result.rows;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rowToKeyEvent(row: Record<string, unknown>): KeyEvent {
  return {
    id:                  row.id as string,
    category:            row.category as string,
    subtype:             row.subtype as string | undefined,
    name:                row.name as string,
    description:         row.description as string | undefined,
    scope:               row.scope as string,
    msaId:               row.msa_id as string | undefined,
    msaName:             row.msa_name as string | undefined,
    submarketId:         row.submarket_id as string | undefined,
    submarketName:       row.submarket_name as string | undefined,
    magnitudeScore:      (row.magnitude_score as number) ?? 2,
    status:              row.status as string,
    confidence:          parseFloat(String(row.confidence ?? '0.5')),
    isVerified:          Boolean(row.is_verified),
    announcedDate:       row.announced_date ? new Date(row.announced_date as string).toISOString() : undefined,
    materializationDate: row.materialization_date ? new Date(row.materialization_date as string).toISOString() : undefined,
    ingestionSource:     row.ingestion_source as string | undefined,
    createdAt:           new Date(row.created_at as string).toISOString(),
    updatedAt:           new Date(row.updated_at as string).toISOString(),
  };
}
