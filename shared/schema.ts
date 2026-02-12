import { pgTable, text, integer, boolean, timestamp, uuid, json, decimal, varchar, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================================
// AGENT CRM TABLES
// =====================================================

/**
 * Agent Clients Table
 * Stores client information for real estate agents
 */
export const agentClients = pgTable("agent_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Basic Information
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }),
  alternatePhone: varchar("alternate_phone", { length: 50 }),
  
  // Contact Details
  mailingAddress: varchar("mailing_address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  
  // Client Status & Type
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, inactive, archived, prospect
  clientType: varchar("client_type", { length: 50 }).notNull().default("buyer"), // buyer, seller, both, investor, landlord
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, vip
  
  // Preferences
  preferredContactMethod: varchar("preferred_contact_method", { length: 50 }).default("email"), // email, phone, text, whatsapp
  bestTimeToContact: varchar("best_time_to_contact", { length: 100 }),
  communicationPreferences: json("communication_preferences").$type<{
    frequency?: string;
    channels?: string[];
    doNotContact?: boolean;
    preferredLanguage?: string;
  }>().default({}),
  
  // Buyer/Seller Preferences
  searchCriteria: json("search_criteria").$type<{
    propertyTypes?: string[];
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    locations?: string[];
    mustHaveFeatures?: string[];
    timeframe?: string;
  }>().default({}),
  
  // Agent Assignment
  assignedAgentId: uuid("assigned_agent_id"), // FK to users table if you have one
  assignedAgentName: varchar("assigned_agent_name", { length: 255 }),
  referralSource: varchar("referral_source", { length: 255 }),
  
  // Financial Info
  preApprovalStatus: varchar("pre_approval_status", { length: 50 }), // none, pending, approved, expired
  preApprovalAmount: decimal("pre_approval_amount", { precision: 12, scale: 2 }),
  preApprovalDate: timestamp("pre_approval_date"),
  lenderName: varchar("lender_name", { length: 255 }),
  lenderContact: varchar("lender_contact", { length: 255 }),
  
  // Additional Info
  tags: json("tags").$type<string[]>().default([]),
  notes: text("notes"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: timestamp("date_of_birth"),
  occupation: varchar("occupation", { length: 255 }),
  
  // Timestamps
  firstContactDate: timestamp("first_contact_date").defaultNow(),
  lastContactDate: timestamp("last_contact_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailIdx: index("agent_clients_email_idx").on(table.email),
  statusIdx: index("agent_clients_status_idx").on(table.status),
  assignedAgentIdx: index("agent_clients_assigned_agent_idx").on(table.assignedAgentId),
  createdAtIdx: index("agent_clients_created_at_idx").on(table.createdAt),
}));

/**
 * Agent Deals Table
 * Tracks real estate deals through the pipeline
 */
export const agentDeals = pgTable("agent_deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Deal Identification
  dealName: varchar("deal_name", { length: 255 }).notNull(),
  dealNumber: varchar("deal_number", { length: 100 }).unique(),
  
  // Client & Property Info
  clientId: uuid("client_id").notNull().references(() => agentClients.id, { onDelete: 'cascade' }),
  propertyAddress: varchar("property_address", { length: 500 }).notNull(),
  propertyCity: varchar("property_city", { length: 100 }),
  propertyState: varchar("property_state", { length: 50 }),
  propertyZipCode: varchar("property_zip_code", { length: 20 }),
  propertyType: varchar("property_type", { length: 100 }), // single-family, condo, townhouse, land, commercial
  
  // Deal Details
  dealType: varchar("deal_type", { length: 50 }).notNull().default("purchase"), // purchase, sale, lease, both
  dealStage: varchar("deal_stage", { length: 50 }).notNull().default("lead"), // lead, viewing, offer, negotiation, under_contract, closing, closed, dead
  dealStatus: varchar("deal_status", { length: 50 }).notNull().default("active"), // active, pending, closed_won, closed_lost, cancelled
  
  // Financial Information
  listingPrice: decimal("listing_price", { precision: 12, scale: 2 }),
  offerPrice: decimal("offer_price", { precision: 12, scale: 2 }),
  finalPrice: decimal("final_price", { precision: 12, scale: 2 }),
  
  // Commission Tracking
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // e.g., 3.00 for 3%
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }),
  commissionSplit: decimal("commission_split", { precision: 5, scale: 2 }), // Agent's split percentage
  estimatedCommission: decimal("estimated_commission", { precision: 12, scale: 2 }),
  actualCommission: decimal("actual_commission", { precision: 12, scale: 2 }),
  commissionPaid: boolean("commission_paid").default(false),
  commissionPaidDate: timestamp("commission_paid_date"),
  commissionTemplateId: uuid("commission_template_id").references(() => agentCommissionTemplates.id),
  
  // Co-Agent/Split Info
  coAgent: varchar("co_agent", { length: 255 }),
  coAgentBrokerage: varchar("co_agent_brokerage", { length: 255 }),
  referralFee: decimal("referral_fee", { precision: 12, scale: 2 }),
  
  // Important Dates
  listingDate: timestamp("listing_date"),
  offerDate: timestamp("offer_date"),
  contractDate: timestamp("contract_date"),
  inspectionDate: timestamp("inspection_date"),
  appraisalDate: timestamp("appraisal_date"),
  closingDate: timestamp("closing_date"),
  expectedCloseDate: timestamp("expected_close_date"),
  
  // Additional Details
  mlsNumber: varchar("mls_number", { length: 100 }),
  loanType: varchar("loan_type", { length: 100 }), // conventional, fha, va, cash, etc.
  contingencies: json("contingencies").$type<string[]>().default([]),
  documents: json("documents").$type<Array<{
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>>().default([]),
  
  // Workflow & Management
  probability: integer("probability").default(50), // 0-100 probability of closing
  daysInStage: integer("days_in_stage").default(0),
  nextAction: text("next_action"),
  nextActionDate: timestamp("next_action_date"),
  notes: text("notes"),
  tags: json("tags").$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
}, (table) => ({
  clientIdx: index("agent_deals_client_idx").on(table.clientId),
  dealStageIdx: index("agent_deals_stage_idx").on(table.dealStage),
  dealStatusIdx: index("agent_deals_status_idx").on(table.dealStatus),
  closingDateIdx: index("agent_deals_closing_date_idx").on(table.closingDate),
  expectedCloseDateIdx: index("agent_deals_expected_close_date_idx").on(table.expectedCloseDate),
  createdAtIdx: index("agent_deals_created_at_idx").on(table.createdAt),
}));

/**
 * Agent Leads Table
 * Captures and tracks lead sources and conversion
 */
export const agentLeads = pgTable("agent_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Basic Lead Info
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  
  // Lead Source & Tracking
  source: varchar("source", { length: 100 }).notNull(), // website, referral, zillow, realtor.com, facebook, open_house, cold_call, etc.
  sourceDetails: varchar("source_details", { length: 255 }), // Specific campaign, ad, or referrer name
  medium: varchar("medium", { length: 100 }), // organic, paid, social, email, direct
  campaign: varchar("campaign", { length: 255 }),
  
  // Lead Status & Quality
  status: varchar("status", { length: 50 }).notNull().default("new"), // new, contacted, qualified, unqualified, nurturing, converted, dead
  leadQuality: varchar("lead_quality", { length: 50 }).default("unknown"), // hot, warm, cold, unknown
  leadScore: integer("lead_score").default(0), // 0-100 scoring system
  
  // Interest & Intent
  interestedIn: varchar("interested_in", { length: 50 }).default("buying"), // buying, selling, renting, investing
  propertyTypes: json("property_types").$type<string[]>().default([]),
  priceRange: json("price_range").$type<{
    min?: number;
    max?: number;
  }>().default({}),
  locations: json("locations").$type<string[]>().default([]),
  timeframe: varchar("timeframe", { length: 100 }), // immediate, 1-3 months, 3-6 months, 6-12 months, exploring
  
  // Follow-up & Engagement
  followUpStatus: varchar("follow_up_status", { length: 50 }).default("pending"), // pending, scheduled, completed, no_answer, do_not_contact
  followUpDate: timestamp("follow_up_date"),
  lastContactDate: timestamp("last_contact_date"),
  nextContactDate: timestamp("next_contact_date"),
  contactAttempts: integer("contact_attempts").default(0),
  
  // Assignment & Conversion
  assignedAgentId: uuid("assigned_agent_id"),
  assignedAgentName: varchar("assigned_agent_name", { length: 255 }),
  convertedToClientId: uuid("converted_to_client_id").references(() => agentClients.id),
  convertedAt: timestamp("converted_at"),
  
  // Additional Info
  notes: text("notes"),
  tags: json("tags").$type<string[]>().default([]),
  customFields: json("custom_fields").$type<Record<string, unknown>>().default({}),
  
  // Timestamps
  capturedAt: timestamp("captured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailIdx: index("agent_leads_email_idx").on(table.email),
  statusIdx: index("agent_leads_status_idx").on(table.status),
  sourceIdx: index("agent_leads_source_idx").on(table.source),
  followUpDateIdx: index("agent_leads_follow_up_date_idx").on(table.followUpDate),
  assignedAgentIdx: index("agent_leads_assigned_agent_idx").on(table.assignedAgentId),
  capturedAtIdx: index("agent_leads_captured_at_idx").on(table.capturedAt),
}));

/**
 * Agent Activities Table
 * Activity log for tracking interactions with clients and deals
 */
export const agentActivities = pgTable("agent_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Activity Type & Description
  activityType: varchar("activity_type", { length: 50 }).notNull(), // call, email, meeting, showing, text, note, task, follow_up
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  
  // Related Entities
  clientId: uuid("client_id").references(() => agentClients.id, { onDelete: 'cascade' }),
  dealId: uuid("deal_id").references(() => agentDeals.id, { onDelete: 'cascade' }),
  leadId: uuid("lead_id").references(() => agentLeads.id, { onDelete: 'cascade' }),
  
  // Activity Details
  direction: varchar("direction", { length: 20 }), // inbound, outbound
  duration: integer("duration"), // in minutes
  outcome: varchar("outcome", { length: 100 }), // successful, no_answer, voicemail, reschedule, etc.
  
  // Agent & Participants
  performedByAgentId: uuid("performed_by_agent_id"),
  performedByAgentName: varchar("performed_by_agent_name", { length: 255 }),
  participants: json("participants").$type<Array<{
    name: string;
    email?: string;
    role?: string;
  }>>().default([]),
  
  // Status & Scheduling
  status: varchar("status", { length: 50 }).default("completed"), // scheduled, completed, cancelled, missed
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  
  // Location (for meetings/showings)
  location: varchar("location", { length: 500 }),
  propertyAddress: varchar("property_address", { length: 500 }),
  
  // Task Management
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  isCompleted: boolean("is_completed").default(false),
  
  // Follow-up
  requiresFollowUp: boolean("requires_follow_up").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  
  // Additional Info
  attachments: json("attachments").$type<Array<{
    name: string;
    url: string;
    type: string;
  }>>().default([]),
  tags: json("tags").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientIdx: index("agent_activities_client_idx").on(table.clientId),
  dealIdx: index("agent_activities_deal_idx").on(table.dealId),
  leadIdx: index("agent_activities_lead_idx").on(table.leadId),
  activityTypeIdx: index("agent_activities_type_idx").on(table.activityType),
  statusIdx: index("agent_activities_status_idx").on(table.status),
  scheduledAtIdx: index("agent_activities_scheduled_at_idx").on(table.scheduledAt),
  dueDateIdx: index("agent_activities_due_date_idx").on(table.dueDate),
  createdAtIdx: index("agent_activities_created_at_idx").on(table.createdAt),
}));

/**
 * Agent Commission Templates Table
 * Reusable commission calculation templates
 */
export const agentCommissionTemplates = pgTable("agent_commission_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Template Identification
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  // Commission Structure
  commissionType: varchar("commission_type", { length: 50 }).notNull().default("percentage"), // percentage, flat_fee, tiered, hybrid
  
  // Percentage-based
  buyerAgentRate: decimal("buyer_agent_rate", { precision: 5, scale: 2 }), // e.g., 3.00 for 3%
  listingAgentRate: decimal("listing_agent_rate", { precision: 5, scale: 2 }), // e.g., 3.00 for 3%
  
  // Flat Fee
  flatFee: decimal("flat_fee", { precision: 12, scale: 2 }),
  
  // Tiered Structure
  tiers: json("tiers").$type<Array<{
    minPrice: number;
    maxPrice: number;
    rate: number;
    flatAmount?: number;
  }>>().default([]),
  
  // Split Structure
  agentSplit: decimal("agent_split", { precision: 5, scale: 2 }).default("100.00"), // Agent's percentage of commission
  brokerageSplit: decimal("brokerage_split", { precision: 5, scale: 2 }).default("0.00"), // Brokerage's percentage
  
  // Additional Fees
  transactionFee: decimal("transaction_fee", { precision: 10, scale: 2 }),
  additionalFees: json("additional_fees").$type<Array<{
    name: string;
    amount: number;
    type: 'fixed' | 'percentage';
  }>>().default([]),
  
  // Calculation Rules
  calculationRules: json("calculation_rules").$type<{
    applyToGrossCommission?: boolean;
    deductFeesFirst?: boolean;
    minimumCommission?: number;
    maximumCommission?: number;
    roundingRule?: string;
  }>().default({}),
  
  // Property Type Restrictions
  applicablePropertyTypes: json("applicable_property_types").$type<string[]>().default([]),
  applicableDealTypes: json("applicable_deal_types").$type<string[]>().default([]),
  priceRange: json("price_range").$type<{
    min?: number;
    max?: number;
  }>().default({}),
  
  // Usage Tracking
  timesUsed: integer("times_used").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("agent_commission_templates_name_idx").on(table.name),
  isDefaultIdx: index("agent_commission_templates_is_default_idx").on(table.isDefault),
  isActiveIdx: index("agent_commission_templates_is_active_idx").on(table.isActive),
}));

// =====================================================
// RELATIONS - Drizzle ORM Relations for Easy Querying
// =====================================================

export const agentClientsRelations = relations(agentClients, ({ many, one }) => ({
  deals: many(agentDeals),
  activities: many(agentActivities),
  convertedFromLead: one(agentLeads, {
    fields: [agentClients.id],
    references: [agentLeads.convertedToClientId],
  }),
}));

export const agentDealsRelations = relations(agentDeals, ({ one, many }) => ({
  client: one(agentClients, {
    fields: [agentDeals.clientId],
    references: [agentClients.id],
  }),
  activities: many(agentActivities),
  commissionTemplate: one(agentCommissionTemplates, {
    fields: [agentDeals.commissionTemplateId],
    references: [agentCommissionTemplates.id],
  }),
}));

export const agentLeadsRelations = relations(agentLeads, ({ one, many }) => ({
  activities: many(agentActivities),
  convertedToClient: one(agentClients, {
    fields: [agentLeads.convertedToClientId],
    references: [agentClients.id],
  }),
}));

export const agentActivitiesRelations = relations(agentActivities, ({ one }) => ({
  client: one(agentClients, {
    fields: [agentActivities.clientId],
    references: [agentClients.id],
  }),
  deal: one(agentDeals, {
    fields: [agentActivities.dealId],
    references: [agentDeals.id],
  }),
  lead: one(agentLeads, {
    fields: [agentActivities.leadId],
    references: [agentLeads.id],
  }),
}));

export const agentCommissionTemplatesRelations = relations(agentCommissionTemplates, ({ many }) => ({
  deals: many(agentDeals),
}));

// =====================================================
// ZOID SCHEMAS & TYPESCRIPT TYPES
// =====================================================

// Insert Schemas (for validation)
export const insertAgentClientSchema = createInsertSchema(agentClients).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertAgentDealSchema = createInsertSchema(agentDeals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  closedAt: true
});

export const insertAgentLeadSchema = createInsertSchema(agentLeads).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  convertedAt: true
});

export const insertAgentActivitySchema = createInsertSchema(agentActivities).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertAgentCommissionTemplateSchema = createInsertSchema(agentCommissionTemplates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Insert Types
export type InsertAgentClient = z.infer<typeof insertAgentClientSchema>;
export type InsertAgentDeal = z.infer<typeof insertAgentDealSchema>;
export type InsertAgentLead = z.infer<typeof insertAgentLeadSchema>;
export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;
export type InsertAgentCommissionTemplate = z.infer<typeof insertAgentCommissionTemplateSchema>;

// Select Types (full table types)
export type AgentClient = typeof agentClients.$inferSelect;
export type AgentDeal = typeof agentDeals.$inferSelect;
export type AgentLead = typeof agentLeads.$inferSelect;
export type AgentActivity = typeof agentActivities.$inferSelect;
export type AgentCommissionTemplate = typeof agentCommissionTemplates.$inferSelect;

// =====================================================
// UTILITY TYPES FOR BUSINESS LOGIC
// =====================================================

export type DealStage = 
  | "lead"
  | "viewing"
  | "offer"
  | "negotiation"
  | "under_contract"
  | "closing"
  | "closed"
  | "dead";

export type DealStatus = 
  | "active"
  | "pending"
  | "closed_won"
  | "closed_lost"
  | "cancelled";

export type ClientStatus = 
  | "active"
  | "inactive"
  | "archived"
  | "prospect";

export type LeadStatus = 
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "nurturing"
  | "converted"
  | "dead";

export type ActivityType = 
  | "call"
  | "email"
  | "meeting"
  | "showing"
  | "text"
  | "note"
  | "task"
  | "follow_up";
