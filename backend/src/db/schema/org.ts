import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  ownerId: uuid('owner_id').notNull(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  ownerIdx: index('idx_orgs_owner').on(table.ownerId),
  slugIdx: index('idx_orgs_slug').on(table.slug),
}));

export const orgMembers = pgTable('org_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('viewer'),
  invitedBy: uuid('invited_by'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgUserUnique: uniqueIndex('org_members_org_id_user_id_key').on(table.orgId, table.userId),
  orgIdx: index('idx_org_members_org').on(table.orgId),
  userIdx: index('idx_org_members_user').on(table.userId),
}));

export const orgInvitations = pgTable('org_invitations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid('org_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('analyst'),
  token: varchar('token', { length: 64 }).notNull().unique(),
  invitedBy: uuid('invited_by').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('idx_org_invitations_org').on(table.orgId),
  tokenIdx: index('idx_org_invitations_token').on(table.token),
  emailIdx: index('idx_org_invitations_email').on(table.email),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  invitations: many(orgInvitations),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, { fields: [orgMembers.orgId], references: [organizations.id] }),
}));

export const orgInvitationsRelations = relations(orgInvitations, ({ one }) => ({
  organization: one(organizations, { fields: [orgInvitations.orgId], references: [organizations.id] }),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;
export type OrgInvitation = typeof orgInvitations.$inferSelect;
export type NewOrgInvitation = typeof orgInvitations.$inferInsert;
