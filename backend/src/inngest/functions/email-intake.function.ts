/**
 * Email Intake Inngest Function
 *
 * Triggered on `gmail.message_received`. Implements the broker email →
 * draft deal pipeline:
 *
 *   Step 1: Tier gate — Principal+/Professional+/Enterprise only; skip otherwise
 *   Step 2: Dedupe — skip if this message already created a deal
 *   Step 3: Broker filter — skip if sender not in user's broker allow-list
 *           (when list is empty, all senders are allowed)
 *   Step 4: Read full thread + attachments from Gmail
 *   Step 5: Classify with full subject + body + sender (confidence > 0.7 required)
 *   Step 6: OCR any PDF attachments
 *   Step 7: Extract structured deal fields
 *   Step 8: Score fit against investment profile
 *   Step 9: Create draft deal (status = awaiting_review, source = email_intake)
 *   Step 10: Emit deal.created → Research Agent chains from here
 *   Step 11: Log to audit_log
 *
 * Idempotent by gmail_message_id (stored in deal_data JSONB).
 * Retries: 3 (Inngest default backoff).
 * Tier gating: auto-intake is Principal+/Professional+/Enterprise only.
 *   Operator/Scout users skip this pipeline (manual import path to be added separately).
 */

import { inngest, GmailMessageReceivedEvent, JediEvents } from '../../lib/inngest';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { readGmailThread } from '../../agents/tools/read_gmail_thread';
import { classifyAsDealOpportunity } from '../../agents/tools/classify_as_deal_opportunity';
import { extractDealFields, ExtractedDealFields } from '../../agents/tools/extract_deal_fields';
import { scoreFitAgainstProfile, FitScoreResult } from '../../agents/tools/score_fit_against_profile';
import { createDealDraft } from '../../agents/tools/create_deal_draft';
import { ocrDocument } from '../../agents/tools/ocr_document';

const CONFIDENCE_THRESHOLD = 0.7;

// Tier values that qualify for automated email-intake deal creation.
// Operator and Scout users are directed to the manual import path instead.
const AUTO_INTAKE_TIERS = new Set([
  'professional',
  'enterprise',
  'principal',
  'institutional',
]);

/**
 * Returns the user's subscription tier.
 */
async function getUserTier(userId: string): Promise<string> {
  const res = await query(
    `SELECT COALESCE(ucb.subscription_tier, u.subscription_tier, 'scout') AS tier
     FROM users u
     LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return String(res.rows[0]?.tier ?? 'scout').toLowerCase();
}

/**
 * Returns the user's broker sender domain allow-list from preferences.
 * Empty array = no filter (all senders are allowed).
 */
async function getBrokerAllowList(userId: string): Promise<string[]> {
  const res = await query(
    `SELECT notification_preferences FROM users WHERE id = $1`,
    [userId]
  );
  const prefs = res.rows[0]?.notification_preferences as Record<string, unknown> | null;
  const list = prefs?.broker_sender_domains;
  if (!Array.isArray(list)) return [];
  return list.map(String).map(d => d.toLowerCase().trim()).filter(Boolean);
}

export const emailIntakeFunction = inngest.createFunction(
  {
    id: 'email-intake-from-gmail',
    name: 'Deal Intake: from Gmail message',
    triggers: [{ event: 'gmail.message_received' }],
    retries: 3,
    concurrency: {
      limit: 3,
      key: 'event.data.user_id',
    },
  },
  async ({ event, step }) => {
    const { message_id, user_id, from_address, subject, has_attachments } =
      (event as unknown as GmailMessageReceivedEvent).data;

    // ── Step 1: Tier gate ────────────────────────────────────────────────
    // Auto-intake is restricted to Principal+/Professional+/Enterprise.
    // Operator and Scout users must use the manual import path (to be built
    // as a separate feature — see follow-up task #260).
    const tierResult = await step.run('tier-gate', async () => {
      const tier = await getUserTier(user_id);
      return { tier, allowed: AUTO_INTAKE_TIERS.has(tier) };
    });

    if (!tierResult.allowed) {
      logger.info('email-intake: tier gate — user not on auto-intake tier', {
        tier: tierResult.tier,
        user_id,
        message_id,
      });
      return { status: 'skipped', reason: 'tier_not_allowed', tier: tierResult.tier };
    }

    // ── Step 2: Dedupe — bail if a deal already exists for this message ──
    const dedupeResult = await step.run('dedupe-check', async () => {
      const existing = await query(
        `SELECT id FROM deals
         WHERE user_id = $1 AND deal_data->>'gmail_message_id' = $2
         LIMIT 1`,
        [user_id, message_id]
      );
      return { already_processed: existing.rows.length > 0 };
    });

    if (dedupeResult.already_processed) {
      logger.info('email-intake: dedupe — message already processed', { message_id, user_id });
      return { status: 'skipped', reason: 'already_processed' };
    }

    // ── Step 3: Broker filter ────────────────────────────────────────────
    const filterResult = await step.run('broker-filter', async () => {
      const allowList = await getBrokerAllowList(user_id);
      if (allowList.length === 0) return { allowed: true };
      const fromDomain = from_address.split('@')[1]?.toLowerCase() ?? '';
      const allowed = allowList.some(d => fromDomain === d || fromDomain.endsWith(`.${d}`));
      return { allowed };
    });

    if (!filterResult.allowed) {
      logger.info('email-intake: broker filter — sender not in allow-list', { from_address, user_id });
      return { status: 'skipped', reason: 'sender_not_in_allow_list' };
    }

    // ── Step 4: Read full thread + attachments ───────────────────────────
    // Read the thread BEFORE classification so we can classify with the
    // full message body, not just the subject line.
    const thread = await step.run('read-gmail-thread', async () => {
      return readGmailThread(message_id, user_id);
    });

    // ── Step 5: Classify with full subject + body + sender ───────────────
    const classification = await step.run('classify-email', async () => {
      return classifyAsDealOpportunity(thread.subject, thread.body_text, thread.from);
    });

    if (!classification.is_deal || classification.confidence < CONFIDENCE_THRESHOLD) {
      logger.info('email-intake: not a deal opportunity', {
        is_deal: classification.is_deal,
        confidence: classification.confidence,
        reason: classification.reason,
        message_id,
      });
      return { status: 'skipped', reason: 'not_a_deal', classification };
    }

    // ── Step 6: OCR PDF/Excel attachments ───────────────────────────────
    // Gate on thread.attachments.length (populated by readGmailThread which
    // recursively traverses the full MIME tree). We do NOT use `has_attachments`
    // from the event payload because that flag is computed from only top-level
    // payload.parts in gmail-sync and misses nested multipart attachments.
    const ocrResults = await step.run('ocr-attachments', async () => {
      if (thread.attachments.length === 0) return { combined_text: '' };

      const texts: string[] = [];
      for (const att of thread.attachments.slice(0, 3)) {
        const mimeType = att.mime_type.split(';')[0].trim();
        if (att.size_bytes < 20_000_000) {
          const text = await ocrDocument(att.content_base64, mimeType, att.name);
          if (text.trim()) texts.push(text);
        }
      }
      return { combined_text: texts.join('\n\n') };
    });

    // ── Step 7: Extract structured deal fields ───────────────────────────
    // Cast: Inngest wraps step results in JsonifyObject<T> which widens
    // optional → undefined; cast back to concrete type for downstream steps.
    const fields = await step.run('extract-deal-fields', async () => {
      return extractDealFields(thread.subject, thread.body_text, ocrResults.combined_text);
    }) as ExtractedDealFields;

    // ── Step 8: Score fit against investment profile ─────────────────────
    const fitScore = await step.run('score-fit', async () => {
      return scoreFitAgainstProfile(fields, user_id);
    }) as FitScoreResult;

    // ── Step 9: Create draft deal ────────────────────────────────────────
    const draft = await step.run('create-draft-deal', async () => {
      return createDealDraft(fields, user_id, {
        gmail_message_id: message_id,
        from_address,
        classification_confidence: classification.confidence,
        asset_class_hint: classification.asset_class_hint,
        fit_score: fitScore.fit_score,
        fit_breakdown: fitScore.fit_breakdown,
      });
    });

    // ── Step 10: Notify user — new deal arrived in inbox ─────────────────
    await step.run('notify-user', async () => {
      const dealName = draft.deal_name || fields.address || 'New Deal';
      const fitPct = Math.round((fitScore.fit_score ?? 0) * 100);
      await query(
        `INSERT INTO deal_notifications
           (deal_id, user_id, type, message, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          draft.deal_id,
          user_id,
          'deal_from_email',
          `New broker email: "${subject}" — ${dealName} (fit score ${fitPct}%)`,
          JSON.stringify({
            from_address,
            subject,
            fit_score: fitScore.fit_score,
            classification_confidence: classification.confidence,
          }),
        ]
      );
      return { notified: true };
    });

    // ── Step 11: Emit deal.created → Research Agent ──────────────────────
    await step.sendEvent('emit-deal-created', {
      name: 'deal.created' as const,
      data: {
        dealId: draft.deal_id,
        userId: user_id,
        userTier: tierResult.tier,
        address: fields.address ?? undefined,
        triggeredBy: 'event',
      },
    } satisfies JediEvents);

    // ── Step 12: Audit log ───────────────────────────────────────────────
    await step.run('write-audit-log', async () => {
      await query(
        `INSERT INTO audit_log
           (actor_id, actor_type, action, resource_type, resource_id, metadata)
         VALUES ('email_intake', 'system', 'deal.intake_from_email', 'deal', $1, $2)`,
        [
          draft.deal_id,
          JSON.stringify({
            gmail_message_id: message_id,
            from_address,
            subject,
            classification_confidence: classification.confidence,
            asset_class_hint: classification.asset_class_hint,
            fit_score: fitScore.fit_score,
            deal_fits: fitScore.deal_fits,
            fields_extracted: Object.keys(fields as object).filter(
              k => (fields as unknown as Record<string, unknown>)[k] != null
            ),
          }),
        ]
      );
      return { logged: true };
    });

    logger.info('email-intake: draft deal created from email', {
      dealId: draft.deal_id,
      dealName: draft.deal_name,
      fitScore: fitScore.fit_score,
      confidence: classification.confidence,
      user_id,
    });

    return {
      status: 'created',
      deal_id: draft.deal_id,
      deal_name: draft.deal_name,
      fit_score: fitScore.fit_score,
      classification_confidence: classification.confidence,
      fields_extracted: fields,
    };
  }
);
