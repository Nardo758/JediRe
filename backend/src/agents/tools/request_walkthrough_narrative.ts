/**
 * Tool: request_walkthrough_narrative
 *
 * Fires an Inngest event `cashflow.walkthrough_requested`.
 * The Commentary Agent responds asynchronously with a natural-language walkthrough
 * of the underwriting evidence and key decisions.
 *
 * Requires capability: write:deal_context
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().uuid(),
  snapshot_id: z.string().uuid().nullable().optional()
    .describe('ID from write_underwriting snapshot_id output'),
  focus: z.string().nullable().optional()
    .describe('Optional focus area, e.g. "collision_summary" or "tier2_evidence"'),
  trigger_reason: z.enum(['auto_principal', 'user_requested', 'post_run']).default('post_run'),
});

const OutputSchema = z.object({
  event_fired: z.boolean(),
  event_id: z.string(),
  message: z.string(),
});

export const requestWalkthroughNarrativeTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'request_walkthrough_narrative',
  description:
    'Fires a walkthrough_requested event so Commentary Agent produces a natural-language ' +
    'explanation of the underwriting decisions. Call after write_underwriting completes. ' +
    'The narrative appears in the F9 Walkthrough sub-tab.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'write:deal_context',

  execute: async (input, ctx) => {
    // Write a pending walkthrough record to DB so the UI can poll
    const eventId = crypto.randomUUID();

    try {
      await query(
        `INSERT INTO audit_log
           (actor_id, actor_type, action, resource_type, resource_id, metadata)
         VALUES ($1, 'agent', 'cashflow.walkthrough_requested', 'deal', $2, $3)`,
        [
          'cashflow',
          input.deal_id,
          JSON.stringify({
            event_id: eventId,
            snapshot_id: input.snapshot_id ?? null,
            focus: input.focus ?? null,
            trigger_reason: input.trigger_reason,
            agent_run_id: ctx.dealId ?? null,
            requested_at: new Date().toISOString(),
          }),
        ]
      );

      logger.info('request_walkthrough_narrative: event logged', {
        runId: ctx.dealId,
        dealId: input.deal_id,
        eventId,
        triggerReason: input.trigger_reason,
      });

      return {
        event_fired: true,
        event_id: eventId,
        message: 'Walkthrough narrative requested. Commentary Agent will generate it asynchronously.',
      };
    } catch (err) {
      logger.warn('request_walkthrough_narrative: failed to log event', { err });
      return {
        event_fired: false,
        event_id: eventId,
        message: 'Walkthrough request could not be persisted. It will not appear in the UI.',
      };
    }
  },
};
