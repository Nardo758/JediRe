/**
 * M35 Event Impact Engine — Drizzle Schema
 *
 * 6 tables:
 *   key_events                  — canonical structured event records
 *   event_taxonomy              — 7 categories × 40+ subtypes, with metric watchlists
 *   event_status_history        — audit log of every status transition
 *   event_ingestion_log         — staging/review queue for auto-ingested events
 *   m35_metric_watchlist_config — per-event metric observation windows
 *   event_geographic_impacts    — scope cascade: MSA → submarket → property radius
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const m35EventCategoryEnum = pgEnum('m35_event_category', [
  'EMPLOYMENT',
  'INFRASTRUCTURE',
  'REGULATORY_POLICY',
  'MARKET_STRUCTURE',
  'MACRO_DEMOGRAPHIC',
  'DISASTER_DISRUPTION',
  'TECHNOLOGY_INDUSTRY',
]);

export const m35EventScopeEnum = pgEnum('m35_event_scope', [
  'MSA',
  'SUBMARKET',
  'PROPERTY',
  'STATE',
  'NATIONAL',
]);

export const m35EventStatusEnum = pgEnum('m35_event_status', [
  'draft',
  'announced',
  'in_progress',
  'materialized',
  'delayed',
  'cancelled',
  'reversed',
]);

export const m35IngestionSourceEnum = pgEnum('m35_ingestion_source', [
  'manual',
  'email_pipeline',
  'rss_pipeline',
  'atlanta_permits',
  'atlanta_rezoning',
  'gdelt_backtest',
  'api_submission',
]);

// ─── key_events ───────────────────────────────────────────────────────────────

export const keyEvents = pgTable('key_events', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  // Taxonomy
  category:          m35EventCategoryEnum('category').notNull(),
  subtype:           varchar('subtype', { length: 64 }),         // e.g. 'MAJOR_EMPLOYER_ARRIVAL'
  taxonomySubtypeId: uuid('taxonomy_subtype_id'),                // FK → event_taxonomy

  // Identity
  name:              varchar('name', { length: 512 }).notNull(),
  description:       text('description'),
  tags:              jsonb('tags').$type<string[]>().default(sql`'[]'::jsonb`),

  // Geography
  scope:             m35EventScopeEnum('scope').notNull().default('SUBMARKET'),
  msaId:             varchar('msa_id', { length: 128 }),          // e.g. 'atlanta-sandy-springs-roswell-ga'
  msaName:           varchar('msa_name', { length: 256 }),
  submarketId:       varchar('submarket_id', { length: 128 }),
  submarketName:     varchar('submarket_name', { length: 256 }),
  propertyId:        uuid('property_id'),
  lat:               numeric('lat', { precision: 10, scale: 7 }),
  lng:               numeric('lng', { precision: 10, scale: 7 }),

  // Magnitude & timing
  magnitudeScore:    smallint('magnitude_score').default(2),      // 1–5
  magnitudeValue:    numeric('magnitude_value', { precision: 14, scale: 2 }),
  magnitudeUnit:     varchar('magnitude_unit', { length: 32 }),   // 'jobs', 'units', 'sqft', 'usd'
  announcedDate:     timestamp('announced_date', { withTimezone: true }),
  materializationDate: timestamp('materialization_date', { withTimezone: true }),
  completionDate:    timestamp('completion_date', { withTimezone: true }),

  // Lifecycle
  status:            m35EventStatusEnum('status').notNull().default('draft'),
  confidence:        numeric('confidence', { precision: 4, scale: 3 }).default('0.5'), // 0–1
  isVerified:        boolean('is_verified').default(false),
  verifiedBy:        varchar('verified_by', { length: 128 }),
  verifiedAt:        timestamp('verified_at', { withTimezone: true }),

  // Source tracking
  ingestionSource:   m35IngestionSourceEnum('ingestion_source').default('manual'),
  sourceUrl:         text('source_url'),
  sourceRecordId:    varchar('source_record_id', { length: 256 }),
  rawPayload:        jsonb('raw_payload'),

  // M06 cross-reference
  newsItemIds:       jsonb('news_item_ids').$type<string[]>().default(sql`'[]'::jsonb`),

  // Audit
  createdBy:         varchar('created_by', { length: 128 }),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  msaIdx:       index('idx_key_events_msa').on(t.msaId),
  statusIdx:    index('idx_key_events_status').on(t.status),
  categoryIdx:  index('idx_key_events_category').on(t.category),
  announcedIdx: index('idx_key_events_announced').on(t.announcedDate),
}));

// ─── event_taxonomy ───────────────────────────────────────────────────────────

export const eventTaxonomy = pgTable('event_taxonomy', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  category:          m35EventCategoryEnum('category').notNull(),
  subtype:           varchar('subtype', { length: 64 }).notNull(),   // machine key
  displayName:       varchar('display_name', { length: 128 }).notNull(),
  description:       text('description'),

  // Default metric watchlist for this subtype
  defaultMetrics:    jsonb('default_metrics').$type<string[]>().notNull(),
  // e.g. ['rent_growth_yoy', 'net_absorption', 'vacancy_rate', 'permits_issued']

  // Lag window defaults (months)
  typicalLagMonths:  smallint('typical_lag_months').default(6),
  measureWindowMonths: smallint('measure_window_months').default(24),

  // Standard magnitude units for this subtype
  primaryMagnitudeUnit: varchar('primary_magnitude_unit', { length: 32 }), // 'jobs', 'units', 'usd'

  // Playbook reference
  playbookTemplateId: uuid('playbook_template_id'),

  isActive:          boolean('is_active').default(true),
  sortOrder:         smallint('sort_order').default(0),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  subtypeUnique: uniqueIndex('idx_event_taxonomy_subtype').on(t.subtype),
  categoryIdx:   index('idx_event_taxonomy_category').on(t.category),
}));

// ─── event_status_history ─────────────────────────────────────────────────────

export const eventStatusHistory = pgTable('event_status_history', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  eventId:     uuid('event_id').notNull().references(() => keyEvents.id, { onDelete: 'cascade' }),
  fromStatus:  m35EventStatusEnum('from_status'),
  toStatus:    m35EventStatusEnum('to_status').notNull(),
  reason:      text('reason'),
  changedBy:   varchar('changed_by', { length: 128 }),
  changedAt:   timestamp('changed_at', { withTimezone: true }).defaultNow(),
  metadata:    jsonb('metadata'),
}, (t) => ({
  eventIdx: index('idx_event_status_history_event').on(t.eventId),
  changedIdx: index('idx_event_status_history_changed').on(t.changedAt),
}));

// ─── event_ingestion_log ──────────────────────────────────────────────────────
// Staging / analyst review queue for auto-ingested events (0.3–0.6 confidence)

export const eventIngestionLog = pgTable('event_ingestion_log', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  source:           m35IngestionSourceEnum('source').notNull(),
  sourceRecordId:   varchar('source_record_id', { length: 256 }),
  rawTitle:         varchar('raw_title', { length: 512 }),
  rawDescription:   text('raw_description'),
  detectedCategory: m35EventCategoryEnum('detected_category'),
  detectedSubtype:  varchar('detected_subtype', { length: 64 }),
  detectedScope:    m35EventScopeEnum('detected_scope'),
  detectedMsaId:    varchar('detected_msa_id', { length: 128 }),
  confidence:       numeric('confidence', { precision: 4, scale: 3 }),
  classifierOutput: jsonb('classifier_output'),   // full LLM output
  rawPayload:       jsonb('raw_payload'),
  status:           varchar('status', { length: 32 }).notNull().default('pending'), // pending | promoted | rejected
  promotedEventId:  uuid('promoted_event_id'),
  reviewedBy:       varchar('reviewed_by', { length: 128 }),
  reviewedAt:       timestamp('reviewed_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  statusIdx: index('idx_event_ingestion_log_status').on(t.status),
  sourceIdx: index('idx_event_ingestion_log_source').on(t.source),
}));

// ─── m35_metric_watchlist_config ──────────────────────────────────────────────

export const m35MetricWatchlistConfig = pgTable('m35_metric_watchlist_config', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  eventId:          uuid('event_id').notNull().references(() => keyEvents.id, { onDelete: 'cascade' }),
  metricKey:        varchar('metric_key', { length: 64 }).notNull(),
  // e.g. 'rent_growth_yoy', 'net_absorption', 'vacancy_rate', 'cap_rate', 'permits_issued'
  displayName:      varchar('display_name', { length: 128 }),
  observationStartMonths: smallint('observation_start_months').default(-18), // relative to materialization
  observationEndMonths:   smallint('observation_end_months').default(24),
  isActive:         boolean('is_active').default(true),
  addedBy:          varchar('added_by', { length: 128 }),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  eventIdx:   index('idx_m35_watchlist_event').on(t.eventId),
  metricUniq: uniqueIndex('idx_m35_watchlist_unique').on(t.eventId, t.metricKey),
}));

// ─── event_impacts ────────────────────────────────────────────────────────────
// One row per event × metric_key × geography_id × window_months
// Populated by the nightly M35 Impact Measurement Job (OLS + DiD engine)

export const eventImpacts = pgTable('event_impacts', {
  id:                 uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  eventId:            uuid('event_id').notNull().references(() => keyEvents.id, { onDelete: 'cascade' }),
  metricKey:          varchar('metric_key', { length: 64 }).notNull(),
  geographyType:      varchar('geography_type', { length: 32 }).notNull().default('metro'),
  geographyId:        varchar('geography_id', { length: 128 }).notNull(),
  windowMonths:       smallint('window_months').notNull(),           // 3 | 12 | 24 | 36
  measurementDate:    timestamp('measurement_date', { withTimezone: true }).notNull(),

  // OLS baseline (T-12mo → T0)
  baselineSlope:      numeric('baseline_slope', { precision: 18, scale: 8 }),
  baselineIntercept:  numeric('baseline_intercept', { precision: 18, scale: 8 }),
  baselineR2:         numeric('baseline_r2', { precision: 6, scale: 4 }),
  baselineN:          smallint('baseline_n').notNull().default(0),

  // Extrapolation vs actual
  projectedValue:     numeric('projected_value', { precision: 18, scale: 4 }),
  actualValue:        numeric('actual_value', { precision: 18, scale: 4 }),
  delta:              numeric('delta', { precision: 18, scale: 4 }),           // actual - projected
  deltaPct:           numeric('delta_pct', { precision: 10, scale: 4 }),       // % vs projected

  // Difference-in-Differences
  controlAvgDelta:    numeric('control_avg_delta', { precision: 18, scale: 4 }),
  attributedDelta:    numeric('attributed_delta', { precision: 18, scale: 4 }), // delta - controlAvgDelta
  attributedDeltaPct: numeric('attributed_delta_pct', { precision: 10, scale: 4 }),
  didConfidence:      numeric('did_confidence', { precision: 6, scale: 4 }).notNull().default('0'),
  pValue:             numeric('p_value', { precision: 8, scale: 6 }),
  controlGroupN:      smallint('control_group_n').notNull().default(0),

  // Data quality
  dataQuality:        varchar('data_quality', { length: 16 }).notNull().default('insufficient'),
  // 'complete' | 'partial' | 'insufficient'
  dataGaps:           jsonb('data_gaps').default(sql`'[]'::jsonb`),

  computedAt:         timestamp('computed_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  eventIdx:       index('idx_event_impacts_event').on(t.eventId),
  metricIdx:      index('idx_event_impacts_metric').on(t.metricKey),
  windowIdx:      index('idx_event_impacts_window').on(t.windowMonths),
  eventMetricUniq: uniqueIndex('idx_event_impacts_unique')
    .on(t.eventId, t.metricKey, t.geographyId, t.windowMonths),
}));

// ─── event_control_groups ─────────────────────────────────────────────────────
// Control submarkets selected for each event's DiD computation.
// Re-computed idempotently each time computeEventImpact() runs.

export const eventControlGroups = pgTable('event_control_groups', {
  id:                     uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  eventId:                uuid('event_id').notNull().references(() => keyEvents.id, { onDelete: 'cascade' }),
  controlGeographyType:   varchar('control_geography_type', { length: 32 }).notNull().default('submarket'),
  controlGeographyId:     varchar('control_geography_id', { length: 128 }).notNull(),
  controlGeographyName:   varchar('control_geography_name', { length: 256 }),
  matchScore:             numeric('match_score', { precision: 6, scale: 4 }).notNull(),
  matchCriteria:          jsonb('match_criteria').default(sql`'{}'::jsonb`),
  // {no_confounding_event, pre_event_trend_similarity, class_similarity, rent_level_similarity, occupancy_similarity}
  isIncluded:             boolean('is_included').notNull().default(true),
  exclusionReason:        text('exclusion_reason'),
  createdAt:              timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  eventIdx:    index('idx_event_control_groups_event').on(t.eventId),
  controlUniq: uniqueIndex('idx_event_control_groups_unique').on(t.eventId, t.controlGeographyId),
}));

// ─── event_geographic_impacts ─────────────────────────────────────────────────

export const eventGeographicImpacts = pgTable('event_geographic_impacts', {
  id:                uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  eventId:           uuid('event_id').notNull().references(() => keyEvents.id, { onDelete: 'cascade' }),

  // Scope cascade
  impactScope:       m35EventScopeEnum('impact_scope').notNull(),
  msaId:             varchar('msa_id', { length: 128 }),
  submarketId:       varchar('submarket_id', { length: 128 }),
  propertyId:        uuid('property_id'),

  // Radius decay
  epicenterLat:      numeric('epicenter_lat', { precision: 10, scale: 7 }),
  epicenterLng:      numeric('epicenter_lng', { precision: 10, scale: 7 }),
  primaryRadiusMi:   numeric('primary_radius_mi', { precision: 6, scale: 2 }),   // full impact
  secondaryRadiusMi: numeric('secondary_radius_mi', { precision: 6, scale: 2 }), // 50% decay
  tertiaryRadiusMi:  numeric('tertiary_radius_mi', { precision: 6, scale: 2 }),  // 20% decay

  // Polygon override (for non-radial impacts like zoning)
  polygon:           jsonb('polygon'),

  proximityDecayFn:  varchar('proximity_decay_fn', { length: 32 }).default('linear'),
  // 'linear' | 'exponential' | 'step'

  estimatedImpactWeight: numeric('estimated_impact_weight', { precision: 4, scale: 3 }).default('1.0'),

  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  eventIdx:    index('idx_event_geo_impacts_event').on(t.eventId),
  msaIdx:      index('idx_event_geo_impacts_msa').on(t.msaId),
  submarketIdx: index('idx_event_geo_impacts_submarket').on(t.submarketId),
}));
