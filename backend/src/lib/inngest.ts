/**
 * Inngest Client — Durable function execution for JediRE agents
 *
 * Inngest provides durable execution with automatic retry, step-level
 * idempotency, and fan-out/fan-in patterns.
 *
 * Functions registered:
 *   - researchOnDealCreated:       triggers on deal.created, Principal+ tier
 *   - zoningOnDealCreated:         triggers on deal.created, Principal+ tier
 *   - supplyOnDealCreated:         triggers on deal.created, Principal+ tier
 *   - cashflowOnResearchCompleted: triggers on research.completed
 *   - commentaryOnResearchCompleted: triggers on research.completed
 *   - emailIntakeFunction:         triggers on gmail.message_received
 *
 * In dev mode (no INNGEST_EVENT_KEY): Inngest operates in local mode
 * using the Dev Server or the built-in serve() middleware.
 *
 * Environment variables:
 *   INNGEST_EVENT_KEY  — required in production; optional in dev
 *   INNGEST_SIGNING_KEY — for signature verification in production
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'jedire-platform',
  name: 'JediRE Platform',
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: !process.env.INNGEST_EVENT_KEY,
  baseUrl: !process.env.INNGEST_EVENT_KEY
    ? (process.env.INNGEST_BASE_URL || 'http://localhost:8099')
    : undefined,
});

// ── Event type definitions ─────────────────────────────────────────

export type DealCreatedEvent = {
  name: 'deal.created';
  data: {
    dealId: string;
    userId: string;
    userTier: string;
    address?: string;
    triggeredBy: 'user' | 'event' | 'cron';
  };
};

export type ResearchCompletedEvent = {
  name: 'research.completed';
  data: {
    dealId: string;
    runId: string;
    confidence_score: number;
    fields_written: string[];
  };
};

export type ZoningCompletedEvent = {
  name: 'zoning.completed';
  data: {
    dealId: string;
    runId: string;
    confidence_score: number;
    zoning_code: string;
    entitlement_risk: 'low' | 'medium' | 'high' | null;
  };
};

export type SupplyCompletedEvent = {
  name: 'supply.completed';
  data: {
    dealId: string;
    runId: string;
    confidence_score: number;
    fields_written: string[];
    supply_risk_level: 'low' | 'moderate' | 'high' | 'severe' | null;
  };
};

export type CashflowCompletedEvent = {
  name: 'cashflow.completed';
  data: {
    dealId: string;
    runId: string;
    confidence_score: number;
    fields_written: string[];
    investment_rating: 'strong' | 'adequate' | 'marginal' | 'weak' | null;
  };
};

export type CommentaryCompletedEvent = {
  name: 'commentary.completed';
  data: {
    dealId: string;
    runId: string;
    confidence_score: number;
    jedi_score: number;
    entity_id: string;
    entity_type: string;
  };
};

export type CashflowWalkthroughRequestedEvent = {
  name: 'cashflow.walkthrough_requested';
  data: {
    dealId: string;
    agentRunId: string | null;
    snapshotId: string | null;
    focus: string | null;
    triggerReason: 'auto_principal' | 'user_requested' | 'post_run';
    eventId: string;
  };
};

export type GmailMessageReceivedEvent = {
  name: 'gmail.message_received';
  data: {
    message_id: string;
    user_id: string;
    account_id: string;
    from_address: string;
    subject: string;
    received_at: string;
    has_attachments: boolean;
  };
};

export type JediEvents =
  | DealCreatedEvent
  | ResearchCompletedEvent
  | ZoningCompletedEvent
  | SupplyCompletedEvent
  | CashflowCompletedEvent
  | CashflowWalkthroughRequestedEvent
  | CommentaryCompletedEvent
  | GmailMessageReceivedEvent;
