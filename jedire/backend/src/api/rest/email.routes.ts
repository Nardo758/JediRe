/**
 * Email AI Integration Routes
 * Action item detection and task creation from emails
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';

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
router.get('/:id/action-items', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/:id/create-task', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
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

    const taskData = await taskResponse.json();

    if (!taskData.success) {
      throw new Error(taskData.message || 'Failed to create task');
    }

    logger.info(`Task created from email ${id}:`, { taskId: taskData.data.id, title });

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
router.post('/:id/quick-task', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { emailBody, dealId } = req.body;

    if (!emailBody) {
      return res.status(400).json({
        success: false,
        message: 'Email body is required',
      });
    }

    // Detect action items
    const actionItems = detectActionItems(emailBody);

    if (actionItems.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No action items detected',
      });
    }

    // Use first action item
    const firstItem = actionItems[0];

    // Create task
    const userId = (req as any).user?.userId || 1;

    const taskResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || '',
      },
      body: JSON.stringify({
        title: firstItem.suggestedTask,
        description: `From email: ${firstItem.text}`,
        category: firstItem.category,
        priority: firstItem.priority,
        dealId: dealId ? parseInt(dealId) : undefined,
        emailId: id,
        assignedToId: userId,
        dueDate: firstItem.dueDate,
        source: 'email_ai',
        tags: ['email', 'ai-detected'],
      }),
    });

    const taskData = await taskResponse.json();

    if (!taskData.success) {
      throw new Error(taskData.message || 'Failed to create task');
    }

    logger.info(`Quick task created from email ${id}:`, { taskId: taskData.data.id });

    res.status(201).json({
      success: true,
      data: {
        task: taskData.data,
        detectedItems: actionItems,
      },
      message: 'Quick task created successfully',
    });
  } catch (error) {
    logger.error('Error creating quick task from email:', error);
    next(error);
  }
});

export default router;
