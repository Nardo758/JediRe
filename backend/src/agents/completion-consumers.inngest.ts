/**
 * S2: Completion Event Consumers
 *
 * Consumes zoning.completed, supply.completed, cashflow.completed, commentary.completed
 * events and updates the deals table with completion timestamps.
 *
 * These consumers ensure that:
 *   1. The deal's agent status is updated when each agent finishes
 *   2. Downstream orchestration can react to completions
 *   3. The "fire into void" issue is resolved
 */

import { inngest } from '../lib/inngest';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

// ── Helper: update deal completion timestamp ───────────────────────────────

async function updateDealCompletion(
  dealId: string,
  agentType: 'zoning' | 'supply' | 'cashflow' | 'commentary',
  runId: string
): Promise<void> {
  try {
    await query(
      `UPDATE deals
       SET agent_status = COALESCE(agent_status, '{}'::jsonb)
         || jsonb_build_object($2, jsonb_build_object('completed_at', NOW(), 'run_id', $3))
       WHERE id = $1`,
      [dealId, agentType, runId]
    );
    logger.info(`[S2] ${agentType}.completed processed`, { dealId, runId });
  } catch (err) {
    logger.error(`[S2] Failed to update deal completion for ${agentType}`, { dealId, runId, err });
  }
}

// ── Zoning Completion Consumer ─────────────────────────────────────────────

export const zoningOnCompleted = inngest.createFunction(
  {
    id: 'zoning-on-completed',
    name: 'Zoning Agent: on zoning.completed',
    triggers: [{ event: 'zoning.completed' }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { dealId, runId } = event.data;
    await step.run('update-deal-zoning-completion', async () => {
      await updateDealCompletion(dealId, 'zoning', runId);
    });
  }
);

// ── Supply Completion Consumer ─────────────────────────────────────────────

export const supplyOnCompleted = inngest.createFunction(
  {
    id: 'supply-on-completed',
    name: 'Supply Agent: on supply.completed',
    triggers: [{ event: 'supply.completed' }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { dealId, runId } = event.data;
    await step.run('update-deal-supply-completion', async () => {
      await updateDealCompletion(dealId, 'supply', runId);
    });
  }
);

// ── CashFlow Completion Consumer ───────────────────────────────────────────

export const cashflowOnCompleted = inngest.createFunction(
  {
    id: 'cashflow-on-completed',
    name: 'CashFlow Agent: on cashflow.completed',
    triggers: [{ event: 'cashflow.completed' }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { dealId, runId } = event.data;
    await step.run('update-deal-cashflow-completion', async () => {
      await updateDealCompletion(dealId, 'cashflow', runId);
    });
  }
);

// ── Commentary Completion Consumer ─────────────────────────────────────────

export const commentaryOnCompleted = inngest.createFunction(
  {
    id: 'commentary-on-completed',
    name: 'Commentary Agent: on commentary.completed',
    triggers: [{ event: 'commentary.completed' }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { dealId, runId } = event.data;
    await step.run('update-deal-commentary-completion', async () => {
      await updateDealCompletion(dealId, 'commentary', runId);
    });
  }
);
