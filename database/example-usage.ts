/**
 * Example Usage of Agent Dashboard Schema
 * 
 * This file demonstrates how to use the Drizzle ORM schema
 * for the Agent Dashboard in a real application.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { Pool } from "pg";
import {
  agentClients,
  agentDeals,
  agentLeads,
  agentActivities,
  agentCommissionTemplates,
  type InsertAgentClient,
  type InsertAgentDeal,
  type InsertAgentLead,
  type InsertAgentActivity,
} from "../shared/schema";

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// =====================================================
// CLIENT OPERATIONS
// =====================================================

/**
 * Create a new client
 */
async function createClient(clientData: InsertAgentClient) {
  const [client] = await db
    .insert(agentClients)
    .values(clientData)
    .returning();
  
  return client;
}

/**
 * Get active clients with their deals
 */
async function getActiveClientsWithDeals() {
  const clients = await db.query.agentClients.findMany({
    where: eq(agentClients.status, "active"),
    with: {
      deals: {
        where: eq(agentDeals.dealStatus, "active"),
        orderBy: [desc(agentDeals.createdAt)],
      },
    },
  });
  
  return clients;
}

/**
 * Update client search criteria
 */
async function updateClientSearchCriteria(
  clientId: string,
  searchCriteria: Record<string, unknown>
) {
  await db
    .update(agentClients)
    .set({
      searchCriteria,
      updatedAt: new Date(),
    })
    .where(eq(agentClients.id, clientId));
}

// =====================================================
// DEAL OPERATIONS
// =====================================================

/**
 * Create a new deal
 */
async function createDeal(dealData: InsertAgentDeal) {
  const [deal] = await db
    .insert(agentDeals)
    .values(dealData)
    .returning();
  
  // Log activity
  await logActivity({
    activityType: "note",
    subject: `New deal created: ${dealData.dealName}`,
    clientId: dealData.clientId,
    dealId: deal.id,
    status: "completed",
    completedAt: new Date(),
  });
  
  return deal;
}

/**
 * Get deals by stage with client info
 */
async function getDealsByStage(stage: string) {
  const deals = await db.query.agentDeals.findMany({
    where: and(
      eq(agentDeals.dealStage, stage),
      eq(agentDeals.dealStatus, "active")
    ),
    with: {
      client: true,
      commissionTemplate: true,
    },
    orderBy: [desc(agentDeals.createdAt)],
  });
  
  return deals;
}

/**
 * Move deal to next stage
 */
async function moveDealToStage(dealId: string, newStage: string) {
  await db
    .update(agentDeals)
    .set({
      dealStage: newStage,
      daysInStage: 0,
      updatedAt: new Date(),
    })
    .where(eq(agentDeals.id, dealId));
}

/**
 * Calculate and update commission
 */
async function calculateCommission(dealId: string) {
  const deal = await db.query.agentDeals.findFirst({
    where: eq(agentDeals.id, dealId),
    with: {
      commissionTemplate: true,
    },
  });
  
  if (!deal) throw new Error("Deal not found");
  
  const salePrice = deal.finalPrice || deal.offerPrice || deal.listingPrice;
  if (!salePrice) return;
  
  let commissionAmount = 0;
  
  if (deal.commissionTemplate) {
    const template = deal.commissionTemplate;
    
    if (template.commissionType === "percentage") {
      const rate = deal.dealType === "purchase" 
        ? template.buyerAgentRate 
        : template.listingAgentRate;
      
      if (rate) {
        commissionAmount = Number(salePrice) * (Number(rate) / 100);
      }
    } else if (template.commissionType === "flat_fee" && template.flatFee) {
      commissionAmount = Number(template.flatFee);
    }
    
    // Apply agent split
    if (template.agentSplit) {
      commissionAmount *= (Number(template.agentSplit) / 100);
    }
  } else if (deal.commissionRate) {
    // Use deal-specific rate
    commissionAmount = Number(salePrice) * (Number(deal.commissionRate) / 100);
  }
  
  await db
    .update(agentDeals)
    .set({
      estimatedCommission: commissionAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(agentDeals.id, dealId));
  
  return commissionAmount;
}

/**
 * Get pipeline summary
 */
async function getPipelineSummary() {
  const summary = await db
    .select({
      stage: agentDeals.dealStage,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`sum(COALESCE(${agentDeals.finalPrice}, ${agentDeals.offerPrice}, ${agentDeals.listingPrice}))`,
      totalCommission: sql<number>`sum(${agentDeals.estimatedCommission})`,
    })
    .from(agentDeals)
    .where(eq(agentDeals.dealStatus, "active"))
    .groupBy(agentDeals.dealStage);
  
  return summary;
}

// =====================================================
// LEAD OPERATIONS
// =====================================================

/**
 * Capture a new lead
 */
async function captureLead(leadData: InsertAgentLead) {
  const [lead] = await db
    .insert(agentLeads)
    .values(leadData)
    .returning();
  
  return lead;
}

/**
 * Convert lead to client
 */
async function convertLeadToClient(leadId: string) {
  const lead = await db.query.agentLeads.findFirst({
    where: eq(agentLeads.id, leadId),
  });
  
  if (!lead) throw new Error("Lead not found");
  
  // Create client
  const [client] = await db
    .insert(agentClients)
    .values({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email || "",
      phoneNumber: lead.phoneNumber,
      status: "active",
      clientType: lead.interestedIn === "selling" ? "seller" : "buyer",
      referralSource: `Lead: ${lead.source}`,
      searchCriteria: {
        propertyTypes: lead.propertyTypes,
        locations: lead.locations,
        priceRange: lead.priceRange,
      },
      tags: lead.tags,
      notes: lead.notes,
    })
    .returning();
  
  // Update lead
  await db
    .update(agentLeads)
    .set({
      status: "converted",
      convertedToClientId: client.id,
      convertedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentLeads.id, leadId));
  
  return client;
}

/**
 * Get leads requiring follow-up
 */
async function getLeadsForFollowUp() {
  const today = new Date();
  const leads = await db.query.agentLeads.findMany({
    where: and(
      eq(agentLeads.status, "contacted"),
      lte(agentLeads.followUpDate, today)
    ),
    orderBy: [agentLeads.followUpDate],
  });
  
  return leads;
}

/**
 * Score and qualify lead
 */
async function scoreAndQualifyLead(leadId: string) {
  const lead = await db.query.agentLeads.findFirst({
    where: eq(agentLeads.id, leadId),
  });
  
  if (!lead) throw new Error("Lead not found");
  
  let score = 0;
  let quality = "unknown";
  
  // Scoring logic
  if (lead.email) score += 20;
  if (lead.phoneNumber) score += 20;
  if (lead.timeframe === "immediate") score += 30;
  else if (lead.timeframe === "1-3 months") score += 20;
  else if (lead.timeframe === "3-6 months") score += 10;
  
  if (lead.priceRange && typeof lead.priceRange === "object") {
    const range = lead.priceRange as { min?: number; max?: number };
    if (range.min || range.max) score += 15;
  }
  
  if (lead.locations && Array.isArray(lead.locations) && lead.locations.length > 0) {
    score += 15;
  }
  
  // Determine quality
  if (score >= 70) quality = "hot";
  else if (score >= 50) quality = "warm";
  else if (score >= 30) quality = "cold";
  
  await db
    .update(agentLeads)
    .set({
      leadScore: score,
      leadQuality: quality,
      status: score >= 50 ? "qualified" : "nurturing",
      updatedAt: new Date(),
    })
    .where(eq(agentLeads.id, leadId));
  
  return { score, quality };
}

// =====================================================
// ACTIVITY OPERATIONS
// =====================================================

/**
 * Log an activity
 */
async function logActivity(activityData: InsertAgentActivity) {
  const [activity] = await db
    .insert(agentActivities)
    .values({
      ...activityData,
      completedAt: activityData.completedAt || new Date(),
    })
    .returning();
  
  // Update last contact date on related entities
  if (activityData.clientId) {
    await db
      .update(agentClients)
      .set({ lastContactDate: new Date() })
      .where(eq(agentClients.id, activityData.clientId));
  }
  
  if (activityData.leadId) {
    await db
      .update(agentLeads)
      .set({ lastContactDate: new Date() })
      .where(eq(agentLeads.id, activityData.leadId));
  }
  
  return activity;
}

/**
 * Get upcoming tasks
 */
async function getUpcomingTasks() {
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const tasks = await db.query.agentActivities.findMany({
    where: and(
      eq(agentActivities.isCompleted, false),
      gte(agentActivities.dueDate, now),
      lte(agentActivities.dueDate, oneWeekFromNow)
    ),
    with: {
      client: true,
      deal: true,
    },
    orderBy: [agentActivities.dueDate],
  });
  
  return tasks;
}

/**
 * Get activity timeline for a client
 */
async function getClientActivityTimeline(clientId: string, limit = 50) {
  const activities = await db.query.agentActivities.findMany({
    where: eq(agentActivities.clientId, clientId),
    orderBy: [desc(agentActivities.createdAt)],
    limit,
  });
  
  return activities;
}

// =====================================================
// COMMISSION TEMPLATE OPERATIONS
// =====================================================

/**
 * Get default commission template
 */
async function getDefaultCommissionTemplate() {
  const template = await db.query.agentCommissionTemplates.findFirst({
    where: eq(agentCommissionTemplates.isDefault, true),
  });
  
  return template;
}

/**
 * Apply commission template to deal
 */
async function applyCommissionTemplate(dealId: string, templateId: string) {
  await db
    .update(agentDeals)
    .set({
      commissionTemplateId: templateId,
      updatedAt: new Date(),
    })
    .where(eq(agentDeals.id, dealId));
  
  // Recalculate commission
  await calculateCommission(dealId);
}

// =====================================================
// REPORTING & ANALYTICS
// =====================================================

/**
 * Get monthly sales report
 */
async function getMonthlySalesReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const closedDeals = await db.query.agentDeals.findMany({
    where: and(
      eq(agentDeals.dealStatus, "closed_won"),
      gte(agentDeals.closedAt, startDate),
      lte(agentDeals.closedAt, endDate)
    ),
    with: {
      client: true,
    },
  });
  
  const totalSales = closedDeals.reduce((sum, deal) => {
    return sum + (Number(deal.finalPrice) || 0);
  }, 0);
  
  const totalCommission = closedDeals.reduce((sum, deal) => {
    return sum + (Number(deal.actualCommission) || Number(deal.estimatedCommission) || 0);
  }, 0);
  
  return {
    month,
    year,
    closedDeals: closedDeals.length,
    totalSales,
    totalCommission,
    averageSalePrice: closedDeals.length > 0 ? totalSales / closedDeals.length : 0,
    deals: closedDeals,
  };
}

/**
 * Get lead conversion rate
 */
async function getLeadConversionRate(startDate: Date, endDate: Date) {
  const allLeads = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentLeads)
    .where(and(
      gte(agentLeads.capturedAt, startDate),
      lte(agentLeads.capturedAt, endDate)
    ));
  
  const convertedLeads = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentLeads)
    .where(and(
      eq(agentLeads.status, "converted"),
      gte(agentLeads.capturedAt, startDate),
      lte(agentLeads.capturedAt, endDate)
    ));
  
  const total = Number(allLeads[0]?.count || 0);
  const converted = Number(convertedLeads[0]?.count || 0);
  const conversionRate = total > 0 ? (converted / total) * 100 : 0;
  
  return {
    totalLeads: total,
    convertedLeads: converted,
    conversionRate: conversionRate.toFixed(2),
  };
}

// =====================================================
// EXPORTS
// =====================================================

export {
  // Client operations
  createClient,
  getActiveClientsWithDeals,
  updateClientSearchCriteria,
  
  // Deal operations
  createDeal,
  getDealsByStage,
  moveDealToStage,
  calculateCommission,
  getPipelineSummary,
  
  // Lead operations
  captureLead,
  convertLeadToClient,
  getLeadsForFollowUp,
  scoreAndQualifyLead,
  
  // Activity operations
  logActivity,
  getUpcomingTasks,
  getClientActivityTimeline,
  
  // Commission template operations
  getDefaultCommissionTemplate,
  applyCommissionTemplate,
  
  // Reporting
  getMonthlySalesReport,
  getLeadConversionRate,
};
