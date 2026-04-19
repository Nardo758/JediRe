/**
 * Inngest Client — Durable function execution for JediRE agents
 *
 * Inngest provides durable execution with automatic retry, step-level
 * idempotency, and fan-out/fan-in patterns.
 *
 * Functions registered:
 *   - researchOnDealCreated: triggers on deal.created, Principal+ tier
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

export type JediEvents = DealCreatedEvent | ResearchCompletedEvent;
