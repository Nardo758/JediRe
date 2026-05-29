import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ----------------------------------------------------------------
// property_characteristics
// Time-varying physical state. One row per change event.
// Query current state: WHERE effective_to IS NULL
// ----------------------------------------------------------------

export const propertyCharacteristics = pgTable('property_characteristics', {
  id:                   uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId:           uuid('property_id').notNull(),

  effectiveFrom:        date('effective_from').notNull(),
  effectiveTo:          date('effective_to'),

  currentBuildingClass: text('current_building_class'),
  unitCount:            integer('unit_count'),
  buildingSf:           numeric('building_sf', { precision: 12, scale: 2 }),
  unitMix:              jsonb('unit_mix'),
  condition:            text('condition'),
  lastRenovationYear:   integer('last_renovation_year'),
  renovationScope:      text('renovation_scope'),

  source:               text('source'),
  sourceDate:           date('source_date'),
  confidence:           numeric('confidence', { precision: 4, scale: 3 }),
  provenance:           jsonb('provenance'),

  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propertyIdx:  index('idx_prop_char_property_id').on(t.propertyId),
  effectiveIdx: index('idx_prop_char_effective').on(t.propertyId, t.effectiveFrom),
}));

// ----------------------------------------------------------------
// property_operating_data
// Period-specific operating metrics (TTM, monthly, point-in-time).
// ----------------------------------------------------------------

export const propertyOperatingData = pgTable('property_operating_data', {
  id:                     uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId:             uuid('property_id').notNull(),

  periodType:             text('period_type').notNull(),
  periodEnd:              date('period_end').notNull(),
  periodStart:            date('period_start'),

  avgRentPerUnit:         numeric('avg_rent_per_unit', { precision: 10, scale: 2 }),
  askingRentPerUnit:      numeric('asking_rent_per_unit', { precision: 10, scale: 2 }),
  effectiveRentPerUnit:   numeric('effective_rent_per_unit', { precision: 10, scale: 2 }),
  occupancy:              numeric('occupancy', { precision: 6, scale: 4 }),
  concessions:            numeric('concessions', { precision: 6, scale: 4 }),
  grossPotentialRent:     numeric('gross_potential_rent', { precision: 14, scale: 2 }),
  effectiveGrossRevenue:  numeric('effective_gross_revenue', { precision: 14, scale: 2 }),
  totalOpex:              numeric('total_opex', { precision: 14, scale: 2 }),
  noi:                    numeric('noi', { precision: 14, scale: 2 }),
  opexByLine:             jsonb('opex_by_line'),

  source:                 text('source').notNull(),
  sourceDate:             date('source_date'),
  confidence:             numeric('confidence', { precision: 4, scale: 3 }),

  isOwned:                boolean('is_owned').notNull().default(false),
  operatorId:             uuid('operator_id'),

  createdAt:              timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propertyIdx: index('idx_prop_opdata_property_id').on(t.propertyId),
  periodIdx:   index('idx_prop_opdata_period').on(t.propertyId, t.periodEnd),
  sourceIdx:   index('idx_prop_opdata_source').on(t.source),
}));

// ----------------------------------------------------------------
// property_sales (canonical transaction table)
// Replaces property_sales_legacy stub + eventual market_sale_comps.
// ----------------------------------------------------------------

export const propertySales = pgTable('property_sales', {
  id:                     uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId:             uuid('property_id').notNull(),

  saleDate:               date('sale_date'),
  salePrice:              numeric('sale_price', { precision: 16, scale: 2 }),
  pricePerUnit:           numeric('price_per_unit', { precision: 12, scale: 2 }),
  pricePerSf:             numeric('price_per_sf', { precision: 10, scale: 2 }),

  buyer:                  text('buyer'),
  seller:                 text('seller'),
  buyerOperatorId:        uuid('buyer_operator_id'),
  sellerOperatorId:       uuid('seller_operator_id'),

  deedType:               text('deed_type'),
  deedBookPage:           text('deed_book_page'),
  financingType:          text('financing_type'),
  loanAmount:             numeric('loan_amount', { precision: 16, scale: 2 }),
  loanTerms:              jsonb('loan_terms'),

  impliedCapRate:         numeric('implied_cap_rate', { precision: 6, scale: 4 }),
  relatedOperatingDataId: uuid('related_operating_data_id'),

  source:                 text('source').notNull(),
  sourceId:               text('source_id'),
  sourceDate:             date('source_date'),
  confidence:             numeric('confidence', { precision: 4, scale: 3 }),

  isJediTracked:          boolean('is_jedi_tracked').notNull().default(false),
  qualified:              boolean('qualified'),

  createdAt:              timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  propertyIdx: index('idx_prop_sales_property_id').on(t.propertyId),
  dateIdx:     index('idx_prop_sales_date').on(t.saleDate),
  sourceIdx:   index('idx_prop_sales_source').on(t.source),
}));

// ----------------------------------------------------------------
// Type exports for use in services
// ----------------------------------------------------------------

export type PropertyCharacteristic = typeof propertyCharacteristics.$inferSelect;
export type NewPropertyCharacteristic = typeof propertyCharacteristics.$inferInsert;

export type PropertyOperatingData = typeof propertyOperatingData.$inferSelect;
export type NewPropertyOperatingData = typeof propertyOperatingData.$inferInsert;

export type PropertySale = typeof propertySales.$inferSelect;
export type NewPropertySale = typeof propertySales.$inferInsert;
