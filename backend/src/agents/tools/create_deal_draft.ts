/**
 * create_deal_draft
 *
 * Creates an awaiting_review deal from email intake.
 *
 * Design note — why direct DB instead of POST /api/v1/deals:
 *   The platform API's deal-create endpoint requires a geographic boundary
 *   (GeoJSON geometry) that is not available from broker emails.  It also
 *   sets status='active' and applies user-auth middleware — neither correct
 *   for auto-intake drafts.  This tool inserts directly into `deals` (the
 *   same table the route writes to) to set status='awaiting_review' and
 *   store intake provenance in the `deal_data` JSONB column, which already
 *   exists and has a GIN index.  After creation it calls autoDiscoverComps
 *   to match the side-effect that the route handler also fires.
 *
 * The `deal_data` column (not `deal_metadata`) is the correct column name;
 * the deals table has no `deal_metadata` column.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { ExtractedDealFields } from './extract_deal_fields';
import { FitScoreResult } from './score_fit_against_profile';
import { autoDiscoverComps } from '../../services/comp-set-discovery.service';

export interface IntakeMetadata {
  gmail_message_id: string;
  from_address: string;
  classification_confidence: number;
  asset_class_hint: string;
  fit_score: number;
  fit_breakdown: FitScoreResult['fit_breakdown'];
}

export interface CreateDealDraftResult {
  deal_id: string;
  deal_name: string;
  status: 'awaiting_review';
}

/**
 * Creates a draft deal from email intake metadata.
 * Idempotent by gmail_message_id stored in deal_data — if a deal with this
 * message ID already exists for this user, returns the existing deal ID.
 */
export async function createDealDraft(
  fields: ExtractedDealFields,
  userId: string,
  metadata: IntakeMetadata
): Promise<CreateDealDraftResult> {
  const existing = await query(
    `SELECT id, name FROM deals
     WHERE user_id = $1 AND deal_data->>'gmail_message_id' = $2
     LIMIT 1`,
    [userId, metadata.gmail_message_id]
  );

  if (existing.rows.length > 0) {
    logger.info('create_deal_draft: idempotent — deal already exists', {
      dealId: existing.rows[0].id,
      messageId: metadata.gmail_message_id,
    });
    return {
      deal_id: existing.rows[0].id,
      deal_name: existing.rows[0].name,
      status: 'awaiting_review',
    };
  }

  const dealName =
    fields.deal_name ??
    fields.address ??
    `Email Intake — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const dealData = {
    source: 'email_intake',
    gmail_message_id: metadata.gmail_message_id,
    from_address: metadata.from_address,
    classification_confidence: metadata.classification_confidence,
    asset_class_hint: metadata.asset_class_hint,
    fit_score: metadata.fit_score,
    fit_breakdown: metadata.fit_breakdown,
    intake_at: new Date().toISOString(),
    ...(fields.sqft != null && { sqft: fields.sqft }),
    ...(fields.year_built != null && { year_built: fields.year_built }),
    ...(fields.noi != null && { noi: fields.noi }),
    ...(fields.cap_rate != null && { cap_rate: fields.cap_rate }),
    ...(fields.occupancy != null && { occupancy: fields.occupancy }),
    ...(fields.asking_price != null && { asking_price: fields.asking_price }),
  };

  const result = await query(
    `INSERT INTO deals (
       user_id, name, status, deal_category,
       address, property_address, city, state_code,
       unit_count, strategy, deal_data
     ) VALUES ($1, $2, 'awaiting_review', 'pipeline', $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, name`,
    [
      userId,
      dealName,
      fields.address,
      fields.address,
      fields.city,
      fields.state,
      fields.units,
      fields.asset_class,
      JSON.stringify(dealData),
    ]
  );

  const row = result.rows[0];

  logger.info('create_deal_draft: draft deal created', {
    dealId: row.id,
    dealName: row.name,
    messageId: metadata.gmail_message_id,
    fitScore: metadata.fit_score,
  });

  // Write intake notification so the inbox surface can surface this deal.
  // A second notification (type='cashflow.collision_severe') is written by
  // the CashFlow Inngest step if underwriting detects severe collisions.
  query(
    `INSERT INTO deal_notifications (deal_id, user_id, type, message, metadata)
     VALUES ($1, $2, 'email_intake', $3, $4)
     ON CONFLICT DO NOTHING`,
    [
      row.id,
      userId,
      `Broker email deal imported: ${row.name}. Underwriting analysis will run automatically — check back for collision alerts.`,
      JSON.stringify({
        gmail_message_id: metadata.gmail_message_id,
        from_address: metadata.from_address,
        fit_score: metadata.fit_score,
      }),
    ]
  ).catch(err => {
    logger.warn('create_deal_draft: deal_notifications insert failed (non-fatal)', { dealId: row.id, err });
  });

  // Fire comp discovery in background (same side-effect as POST /api/v1/deals).
  autoDiscoverComps(row.id).catch(err => {
    logger.warn('create_deal_draft: autoDiscoverComps failed (non-fatal)', { dealId: row.id, err });
  });

  return {
    deal_id: row.id,
    deal_name: row.name,
    status: 'awaiting_review',
  };
}
