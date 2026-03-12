import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { dataUploads } from './dataPipeline';

export const pstEmailImports = pgTable('pst_email_imports', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  uploadId: uuid('upload_id').notNull().references(() => dataUploads.id, { onDelete: 'cascade' }),
  emailIndex: integer('email_index').notNull(),
  subject: text('subject'),
  sender: text('sender'),
  recipients: text('recipients').array(),
  emailDate: timestamp('email_date', { withTimezone: true }),
  rawBody: text('raw_body'),
  hasSignal: boolean('has_signal').default(false),
  hasAttachments: boolean('has_attachments').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uploadIdx: index('idx_pst_emails_upload').on(table.uploadId),
  signalIdx: index('idx_pst_emails_signal').on(table.hasSignal).where(sql`has_signal = TRUE`),
  dateIdx: index('idx_pst_emails_date').on(table.emailDate),
}));

export const pstExtractedEntities = pgTable('pst_extracted_entities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  emailId: uuid('email_id').notNull().references(() => pstEmailImports.id, { onDelete: 'cascade' }),
  uploadId: uuid('upload_id').notNull().references(() => dataUploads.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull().default('property'),
  propertyAddress: text('property_address'),
  dealName: text('deal_name'),
  unitCount: integer('unit_count'),
  askingPrice: numeric('asking_price', { precision: 15, scale: 2 }),
  rentFigures: text('rent_figures'),
  capRate: numeric('cap_rate', { precision: 5, scale: 2 }),
  contactName: text('contact_name'),
  organization: text('organization'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  rawSnippet: text('raw_snippet'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  emailIdx: index('idx_pst_entities_email').on(table.emailId),
  uploadIdx: index('idx_pst_entities_upload').on(table.uploadId),
  typeIdx: index('idx_pst_entities_type').on(table.entityType),
  confidenceIdx: index('idx_pst_entities_confidence').on(table.confidence),
}));

export const pstEmailImportsRelations = relations(pstEmailImports, ({ one, many }) => ({
  upload: one(dataUploads, { fields: [pstEmailImports.uploadId], references: [dataUploads.id] }),
  entities: many(pstExtractedEntities),
}));

export const pstExtractedEntitiesRelations = relations(pstExtractedEntities, ({ one }) => ({
  email: one(pstEmailImports, { fields: [pstExtractedEntities.emailId], references: [pstEmailImports.id] }),
  upload: one(dataUploads, { fields: [pstExtractedEntities.uploadId], references: [dataUploads.id] }),
}));

export type PstEmailImport = typeof pstEmailImports.$inferSelect;
export type NewPstEmailImport = typeof pstEmailImports.$inferInsert;
export type PstExtractedEntity = typeof pstExtractedEntities.$inferSelect;
export type NewPstExtractedEntity = typeof pstExtractedEntities.$inferInsert;
