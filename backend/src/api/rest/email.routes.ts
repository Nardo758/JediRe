/**
 * Email AI Integration Routes
 * Action item detection and task creation from emails
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';
import { classifyAsDealOpportunity } from '../../agents/tools/classify_as_deal_opportunity';
import { extractDealFields } from '../../agents/tools/extract_deal_fields';
import { scoreFitAgainstProfile } from '../../agents/tools/score_fit_against_profile';
import { createDealDraft } from '../../agents/tools/create_deal_draft';
import { readGmailThread } from '../../agents/tools/read_gmail_thread';
import { ocrDocument } from '../../agents/tools/ocr_document';

const router = Router();

// Action item detection patterns
const ACTION_PATTERNS = [
  // Action verbs
  /(?:please|can you|could you|need to|should|must|have to)\s+(send|provide|submit|schedule|review|complete|prepare|update|contact|call|email)/gi,
  // Deadline phrases
  /(by|before|until|no later than)\s+(\w+day|this week|next week|\d{1,2}\/\d{1,2})/gi,
  // Document requests
  /(phase\s+i|rent\s+roll|t-12|financial|OM|PSA|contract|agreement|report)/gi,
];

const DEADLINE_PATTERNS = [
  /by\s+(\w+day)/gi, // by Friday
  /before\s+(\w+)/gi, // before closing
  /within\s+(\d+)\s+(hours?|days?|weeks?)/gi, // within 48 hours
  /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g, // 2/15 or 2/15/2026
];

interface ActionItem {
  text: string;
  suggestedTask: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  dueDate?: string;
}

/**
 * Detect action items in email text
 */
function detectActionItems(emailBody: string): ActionItem[] {
  const items: ActionItem[] = [];
  const sentences = emailBody.split(/[.!?]+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Check for action patterns
    let hasAction = false;
    let actionVerb = '';
    
    for (const pattern of ACTION_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match) {
        hasAction = true;
        actionVerb = match[0];
        break;
      }
    }

    if (!hasAction) continue;

    // Extract deadline
    let dueDate: string | undefined;
    for (const pattern of DEADLINE_PATTERNS) {
      const match = pattern.exec(trimmed);
      if (match) {
        dueDate = match[0];
        break;
      }
    }

    // Determine priority based on urgency words
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    if (/urgent|asap|immediately|critical/i.test(trimmed)) {
      priority = 'urgent';
    } else if (/important|soon|priority/i.test(trimmed)) {
      priority = 'high';
    }

    // Determine category based on keywords
    let category = 'communication';
    if (/phase\s+i|environmental|site/i.test(trimmed)) {
      category = 'due_diligence';
    } else if (/loan|lender|financing|bank/i.test(trimmed)) {
      category = 'financing';
    } else if (/contract|legal|attorney|psa/i.test(trimmed)) {
      category = 'legal';
    } else if (/rent\s+roll|financial|t-12|income/i.test(trimmed)) {
      category = 'reporting';
    }

    // Generate suggested task title
    const suggestedTask = trimmed
      .replace(/^(please|can you|could you|need to|should)\s+/i, '')
      .trim()
      .replace(/^(\w)/, (c) => c.toUpperCase());

    items.push({
      text: trimmed,
      suggestedTask: suggestedTask.slice(0, 200), // Limit length
      priority,
      category,
      dueDate,
    });
  }

  return items;
}

/**
 * GET /api/v1/emails/:id/action-items
 * Detect action items in an email
 */
router.get('/:id/action-items', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { body } = req.query;

    if (!body) {
      return res.status(400).json({
        success: false,
        message: 'Email body is required',
      });
    }

    const actionItems = detectActionItems(body as string);

    logger.info(`Detected ${actionItems.length} action items in email ${id}`);

    res.json({
      success: true,
      data: actionItems,
      count: actionItems.length,
    });
  } catch (error) {
    logger.error('Error detecting action items:', error);
    next(error);
  }
});

/**
 * POST /api/v1/emails/:id/create-task
 * Create a task from an email
 */
router.post('/:id/create-task', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      priority = 'medium',
      dealId,
      dueDate,
      tags = [],
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and category are required',
      });
    }

    const userId = (req as any).user?.userId || 1;

    // Create task via tasks API
    const taskResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || '',
      },
      body: JSON.stringify({
        title,
        description,
        category,
        priority,
        dealId: dealId ? parseInt(dealId) : undefined,
        emailId: id,
        assignedToId: userId,
        dueDate,
        source: 'email_ai',
        tags,
      }),
    });

    const taskData = await taskResponse.json() as { success: boolean; message?: string; data?: { id: string } };

    if (!taskData.success) {
      throw new Error(taskData.message || 'Failed to create task');
    }

    logger.info(`Task created from email ${id}:`, { taskId: taskData.data?.id, title });

    res.status(201).json({
      success: true,
      data: taskData.data,
      message: 'Task created from email successfully',
    });
  } catch (error) {
    logger.error('Error creating task from email:', error);
    next(error);
  }
});

/**
 * POST /api/v1/emails/:id/quick-task
 * Quick task creation with AI-suggested values
 */
router.post('/:id/quick-task', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { emailBody, dealId, specificTask, specificPriority } = req.body;

    if (!emailBody && !specificTask) {
      return res.status(400).json({
        success: false,
        message: 'Email body or specificTask is required',
      });
    }

    let firstItem: any;

    if (specificTask) {
      firstItem = {
        suggestedTask: specificTask,
        text: specificTask,
        priority: specificPriority || 'medium',
        category: 'general',
        dueDate: null,
      };
    } else {
      const actionItems = detectActionItems(emailBody);
      if (actionItems.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No action items detected',
        });
      }
      firstItem = actionItems[0];
    }

    const userId = (req as any).user?.userId || 1;
    const pool = getPool();
    let createdTask: any = null;

    if (dealId) {
      const dealCheck = await pool.query(
        'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
        [dealId, userId]
      );
      if (dealCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied: deal not found or not owned by user' });
      }
      const result = await pool.query(
        `INSERT INTO deal_tasks (deal_id, title, description, status, priority, due_date, tags, created_by_name)
         VALUES ($1, $2, $3, 'pending', $4, $5, $6, 'AI Agent') RETURNING *`,
        [
          dealId,
          firstItem.suggestedTask,
          `From email #${id}: ${firstItem.text}`,
          firstItem.priority || 'medium',
          firstItem.dueDate || null,
          ['email', 'ai-detected'],
        ]
      );
      createdTask = result.rows[0];
    } else {
      try {
        const result = await pool.query(
          `INSERT INTO tasks (user_id, email_id, title, description, category, priority, status, source, tags, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'todo', 'email_ai', $7, NOW(), NOW()) RETURNING *`,
          [
            userId,
            parseInt(id),
            firstItem.suggestedTask,
            `From email: ${firstItem.text}`,
            firstItem.category || 'general',
            firstItem.priority || 'medium',
            ['email', 'ai-detected'],
          ]
        );
        createdTask = result.rows[0];
      } catch (dbError: any) {
        if (dbError.code === '42P01') {
          logger.warn('tasks table does not exist, creating task in deal_tasks');
        } else {
          throw dbError;
        }
      }
    }

    logger.info(`Quick task created from email ${id}`, { taskId: createdTask?.id });

    res.status(201).json({
      success: true,
      data: {
        task: createdTask,
        detectedItem: firstItem,
      },
      message: 'Quick task created successfully',
    });
  } catch (error) {
    logger.error('Error creating quick task from email:', error);
    next(error);
  }
});

/**
 * POST /api/v1/emails/:id/reply
 * Save a reply to an email (stores in DB with sent_at set)
 */
router.post('/:id/reply', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emailId = parseInt(req.params.id, 10);
    if (isNaN(emailId) || emailId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid email ID' });
    }

    const userId = (req as any).user?.userId;
    const { body, cc, to, subjectOverride } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Reply body is required' });
    }
    if (body.length > 100000) {
      return res.status(400).json({ success: false, message: 'Reply body too long' });
    }

    const pool = getPool();

    const originalResult = await pool.query(
      'SELECT id, subject, from_address, thread_id, deal_id, email_account_id FROM emails WHERE id = $1 AND user_id = $2',
      [emailId, userId]
    );
    if (originalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Original email not found' });
    }

    const original = originalResult.rows[0];
    const replySubject = subjectOverride?.trim()
      || (original.subject?.startsWith('Re:') ? original.subject : `Re: ${original.subject || ''}`);
    const threadId = original.thread_id || `thread-${emailId}`;

    const accountResult = await pool.query(
      'SELECT email_address FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [original.email_account_id, userId]
    );
    if (accountResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No connected email account found for this email' });
    }
    const senderAddress = accountResult.rows[0].email_address;

    const replyBody = body.trim();
    const preview = replyBody.slice(0, 200);

    const parseCsv = (val: any): string[] =>
      Array.isArray(val) ? val.map(String).map(s => s.trim()).filter(Boolean)
        : val ? String(val).split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const toAddresses = parseCsv(to).length > 0 ? parseCsv(to) : [original.from_address];
    const rawCc = parseCsv(cc);

    const insertResult = await pool.query(
      `INSERT INTO emails
         (email_account_id, user_id, thread_id, subject, from_address, to_addresses, cc_addresses,
          body_text, body_preview, is_read, sent_at, deal_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), $10, NOW(), NOW())
       RETURNING id, subject, to_addresses, cc_addresses, sent_at`,
      [
        original.email_account_id,
        userId,
        threadId,
        replySubject,
        senderAddress,
        toAddresses,
        rawCc,
        replyBody,
        preview,
        original.deal_id || null,
      ]
    );

    logger.info(`Reply saved for email ${emailId}`, { replyId: insertResult.rows[0].id });

    res.status(201).json({
      success: true,
      data: insertResult.rows[0],
      message: 'Reply saved to sent items',
    });
  } catch (error) {
    logger.error('Error saving reply:', error);
    next(error);
  }
});

/**
 * POST /api/v1/emails/:emailId/import-as-deal
 *
 * Manual deal import path — available to ALL tiers (including Operator).
 * Runs the same classify → read thread → OCR → extract → score → create
 * pipeline as the auto-intake Inngest workflow, but triggered by explicit
 * user action rather than an incoming email event.
 *
 * Thread enrichment is attempted via Gmail API (using stored OAuth tokens).
 * If the user has no connected Gmail account, falls back to the stored
 * body_text from the emails table — still useful for basic extraction.
 */
router.post('/:emailId/import-as-deal', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  const { emailId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    // Load the email from DB.
    // external_id is the Gmail message ID (consistent with how gmail-sync stores it).
    const emailResult = await pool.query(
      `SELECT id, subject, body_text, from_address, external_id
       FROM emails WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [emailId, userId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];
    const { subject, body_text, from_address, external_id } = email;

    // Attempt to enrich with full Gmail thread + attachments (best-effort).
    // Falls back to stored body_text if Gmail OAuth is not available.
    let enrichedBodyText: string = body_text ?? '';
    let ocrText = '';

    if (external_id) {
      try {
        const thread = await readGmailThread(external_id, userId);
        enrichedBodyText = thread.body_text || enrichedBodyText;

        // OCR any PDF/Excel attachments from the thread
        for (const att of thread.attachments.slice(0, 3)) {
          const mimeType = att.mime_type.split(';')[0].trim();
          if (att.size_bytes < 20_000_000) {
            const text = await ocrDocument(att.content_base64, mimeType, att.name);
            if (text.trim()) ocrText += `\n\n${text}`;
          }
        }
      } catch {
        // Gmail OAuth not available or call failed — continue with stored body
        logger.debug('email.routes: import-as-deal — Gmail enrichment unavailable, using stored body', { emailId });
      }
    }

    // Step 1: Classify with enriched content
    const classification = await classifyAsDealOpportunity(
      subject ?? '', enrichedBodyText, from_address ?? ''
    );

    if (!classification.is_deal) {
      return res.status(422).json({
        error: 'Email does not appear to be a deal opportunity',
        classification,
      });
    }

    // Step 2: Extract deal fields (body + any OCR text)
    const fields = await extractDealFields(subject ?? '', enrichedBodyText, ocrText);

    // Step 3: Score fit against profile
    const fitScore = await scoreFitAgainstProfile(fields, userId);

    // Step 4: Create draft (idempotent by external_id stored as gmail_message_id)
    const draft = await createDealDraft(fields, userId, {
      gmail_message_id: external_id ?? emailId,
      from_address: from_address ?? '',
      classification_confidence: classification.confidence,
      asset_class_hint: classification.asset_class_hint,
      fit_score: fitScore.fit_score,
      fit_breakdown: fitScore.fit_breakdown,
    });

    logger.info('email.routes: manual deal import completed', {
      dealId: draft.deal_id,
      emailId,
      userId,
      fitScore: fitScore.fit_score,
      enrichedViaGmail: !!external_id,
    });

    return res.status(201).json({
      success: true,
      deal_id: draft.deal_id,
      deal_name: draft.deal_name,
      fit_score: fitScore.fit_score,
      classification_confidence: classification.confidence,
      fields,
    });
  } catch (error) {
    logger.error('email.routes: import-as-deal failed', { emailId, userId, error });
    next(error);
  }
});

export default router;
