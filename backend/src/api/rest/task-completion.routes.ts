/**
 * Task Completion Detection API Routes
 * Endpoints for scanning emails and suggesting task completions
 */

import { Router, Request, Response } from 'express';
import { taskCompletionDetector } from '../../services/task-completion-detector';

const router = Router();

/**
 * POST /api/v1/tasks/scan-completions
 * Scan recent emails for task completion signals
 */
router.post('/scan-completions', async (req: Request, res: Response) => {
  try {
    const { emailIds, taskIds, daysBack = 7 } = req.body;

    // TODO: Fetch emails from database
    // For now, return mock data
    const mockEmails = [
      {
        id: 'email-101',
        subject: 'Re: Phase I Environmental Report - COMPLETED',
        body: 'Hi Leon, Just wanted to let you know that the Phase I environmental report for Buckhead Tower has been completed and submitted to the lender. All clear on environmental concerns. Report attached. Best, Sarah',
        sender: 'Sarah Johnson <sarah@example.com>',
        recipients: ['Leon D <leon@example.com>'],
        timestamp: new Date('2026-02-14T15:30:00Z').toISOString(),
      },
      {
        id: 'email-102',
        subject: 'Property Inspection Scheduled - Feb 12',
        body: 'Leon, I scheduled the structural engineer for the Buckhead Tower inspection on Feb 12 at 10 AM. Will send you the report when done. Mike',
        sender: 'Mike Chen <mike@example.com>',
        recipients: ['Leon D <leon@example.com>'],
        timestamp: new Date('2026-02-10T09:15:00Z').toISOString(),
      },
      {
        id: 'email-103',
        subject: 'Rent Roll Update - Buckhead Tower',
        body: 'Attached is the updated rent roll you requested for Buckhead Tower. All tenant information is current as of Feb 1st. Let me know if you need anything else. Thanks, Property Manager',
        sender: 'Property Manager <pm@example.com>',
        recipients: ['Leon D <leon@example.com>'],
        timestamp: new Date('2026-02-05T14:20:00Z').toISOString(),
      },
      {
        id: 'email-104',
        subject: 'Loan Application Package Submitted',
        body: 'Good news! I just submitted the complete loan application package to Regions Bank. They confirmed receipt and said they\'ll have preliminary approval within 5 business days. All supporting docs included. Leon',
        sender: 'Leon D <leon@example.com>',
        recipients: ['Regions Bank <loan@regions.com>'],
        timestamp: new Date('2026-02-15T11:00:00Z').toISOString(),
      },
      {
        id: 'email-105',
        subject: 'Decatur Office - Tenant Improvement Work Completed',
        body: 'The tenant improvement work for Suite 300 at Decatur Office Building has been completed ahead of schedule. Final walkthrough passed inspection. Ready for tenant move-in next week. Contractor',
        sender: 'Tom Wilson <tom@buildco.com>',
        recipients: ['Leon D <leon@example.com>'],
        timestamp: new Date('2026-02-13T16:45:00Z').toISOString(),
      },
    ];

    // TODO: Fetch tasks from database
    // For now, return mock tasks
    const mockTasks = [
      {
        id: 'task-1',
        name: 'Submit Phase I Environmental Report',
        description: 'Phase I environmental assessment required by lender',
        status: 'open',
        linkedEntity: {
          id: 'deal-1',
          name: 'Buckhead Tower Development',
          type: 'pipeline-deal',
        },
        assignedTo: {
          userId: 'user-1',
          name: 'Leon D',
        },
      },
      {
        id: 'task-2',
        name: 'Schedule Property Inspection',
        description: 'Coordinate with structural engineer for full building inspection',
        status: 'in_progress',
        linkedEntity: {
          id: 'deal-1',
          name: 'Buckhead Tower Development',
          type: 'pipeline-deal',
        },
        assignedTo: {
          userId: 'user-2',
          name: 'Sarah Johnson',
        },
      },
      {
        id: 'task-3',
        name: 'Request Updated Rent Roll',
        description: 'Obtain current rent roll from seller',
        status: 'open',
        linkedEntity: {
          id: 'deal-1',
          name: 'Buckhead Tower Development',
          type: 'pipeline-deal',
        },
        assignedTo: {
          userId: 'user-1',
          name: 'Leon D',
        },
      },
      {
        id: 'task-4',
        name: 'Submit Loan Application Package',
        description: 'Complete loan application with Regions Bank',
        status: 'open',
        linkedEntity: {
          id: 'deal-1',
          name: 'Buckhead Tower Development',
          type: 'pipeline-deal',
        },
        assignedTo: {
          userId: 'user-1',
          name: 'Leon D',
        },
      },
      {
        id: 'task-7',
        name: 'Complete Tenant Improvement Work',
        description: 'Finish Suite 300 TI work at Decatur Office',
        status: 'in_progress',
        linkedEntity: {
          id: 'deal-4',
          name: 'Decatur Office Building',
          type: 'assets-owned-property',
        },
        assignedTo: {
          userId: 'user-3',
          name: 'Mike Chen',
        },
      },
    ];

    // Scan emails for completion signals
    const signals = await taskCompletionDetector.scanEmails(mockEmails, mockTasks);

    // Filter by confidence threshold if provided
    const minConfidence = req.body.minConfidence || 40;
    const filteredSignals = signals.filter(s => s.confidence >= minConfidence);

    res.json({
      success: true,
      data: {
        scanned: {
          emails: mockEmails.length,
          tasks: mockTasks.length,
        },
        signals: filteredSignals,
        summary: {
          total: filteredSignals.length,
          highConfidence: filteredSignals.filter(s => s.confidence >= 80).length,
          mediumConfidence: filteredSignals.filter(s => s.confidence >= 60 && s.confidence < 80).length,
          lowConfidence: filteredSignals.filter(s => s.confidence < 60).length,
        },
      },
    });
  } catch (error) {
    console.error('Error scanning for task completions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for task completions',
    });
  }
});

/**
 * POST /api/v1/tasks/:taskId/complete-from-email
 * Mark a task as complete based on email detection
 */
router.post('/:taskId/complete-from-email', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { emailId, completionDate, source = 'email-detection' } = req.body;

    // TODO: Update task in database
    // For now, return mock success
    const updatedTask = {
      id: taskId,
      status: 'complete',
      completedAt: completionDate || new Date().toISOString(),
      source: {
        type: 'email',
        referenceId: emailId,
        sourceUrl: `/emails/${emailId}`,
      },
    };

    res.json({
      success: true,
      data: updatedTask,
      message: 'Task marked as complete from email',
    });
  } catch (error) {
    console.error('Error completing task from email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete task from email',
    });
  }
});

/**
 * POST /api/v1/tasks/:taskId/reject-completion
 * Reject an auto-detected task completion
 */
router.post('/:taskId/reject-completion', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { emailId, reason } = req.body;

    // TODO: Log rejection in database for learning
    // This helps improve the detection algorithm over time

    res.json({
      success: true,
      message: 'Completion suggestion rejected',
    });
  } catch (error) {
    console.error('Error rejecting completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject completion',
    });
  }
});

/**
 * GET /api/v1/tasks/completion-suggestions
 * Get pending completion suggestions (not yet reviewed)
 */
router.get('/completion-suggestions', async (req: Request, res: Response) => {
  try {
    // TODO: Fetch from database
    // For now, return empty array
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('Error fetching completion suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch completion suggestions',
    });
  }
});

export default router;
