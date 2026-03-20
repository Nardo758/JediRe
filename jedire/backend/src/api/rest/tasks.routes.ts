/**
 * Tasks API Routes
 * Global task management system integrated with deals, properties, and email
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// Temporary in-memory store (replace with database later)
interface Task {
  id: number;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  dealId?: number;
  propertyId?: number;
  emailId?: string;
  assignedToId?: number;
  createdById?: number;
  dueDate?: string;
  completedAt?: string;
  source: string;
  blockedReason?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// In-memory store
let tasks: Task[] = [
  {
    id: 1,
    title: 'Review Phase I Environmental Report',
    description: 'Review the Phase I Environmental Site Assessment for potential contamination issues',
    category: 'due_diligence',
    priority: 'high',
    status: 'todo',
    dealId: 1,
    assignedToId: 1,
    createdById: 1,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'manual',
    tags: ['environmental', 'urgent'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Submit Rent Roll to Lender',
    description: 'Prepare and submit current rent roll to lender for financing review',
    category: 'financing',
    priority: 'medium',
    status: 'in_progress',
    dealId: 1,
    assignedToId: 1,
    createdById: 1,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'email_ai',
    tags: ['financing', 'documentation'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: 'Schedule Property Tour',
    description: 'Coordinate with broker to schedule property walkthrough',
    category: 'due_diligence',
    priority: 'medium',
    status: 'todo',
    dealId: 1,
    assignedToId: 1,
    createdById: 1,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'manual',
    tags: ['site-visit'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let nextTaskId = 4;

// GET /api/v1/tasks - Get all tasks with optional filters
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, dealId, assignedToId, category, priority } = req.query;

    let filteredTasks = [...tasks];

    if (status) {
      filteredTasks = filteredTasks.filter(t => t.status === status);
    }
    if (dealId) {
      filteredTasks = filteredTasks.filter(t => t.dealId === parseInt(dealId as string));
    }
    if (assignedToId) {
      filteredTasks = filteredTasks.filter(t => t.assignedToId === parseInt(assignedToId as string));
    }
    if (category) {
      filteredTasks = filteredTasks.filter(t => t.category === category);
    }
    if (priority) {
      filteredTasks = filteredTasks.filter(t => t.priority === priority);
    }

    // Sort by priority and due date
    filteredTasks.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

    res.json({
      success: true,
      data: filteredTasks,
      count: filteredTasks.length,
    });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    next(error);
  }
});

// GET /api/v1/tasks/stats - Get task statistics
router.get('/stats', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId ? parseInt(userId as string) : (req as any).user?.userId;

    let userTasks = tasks;
    if (targetUserId) {
      userTasks = tasks.filter(t => t.assignedToId === targetUserId);
    }

    const byStatus = {
      todo: userTasks.filter(t => t.status === 'todo').length,
      in_progress: userTasks.filter(t => t.status === 'in_progress').length,
      blocked: userTasks.filter(t => t.status === 'blocked').length,
      done: userTasks.filter(t => t.status === 'done').length,
      cancelled: userTasks.filter(t => t.status === 'cancelled').length,
    };

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    const overdue = userTasks.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) < today && 
      t.status !== 'done'
    ).length;

    const dueToday = userTasks.filter(t => 
      t.dueDate && 
      new Date(t.dueDate).toDateString() === today.toDateString() &&
      t.status !== 'done'
    ).length;

    const dueSoon = userTasks.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) > today &&
      new Date(t.dueDate) < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) &&
      t.status !== 'done'
    ).length;

    res.json({
      success: true,
      data: {
        total: userTasks.length,
        byStatus,
        overdue,
        dueToday,
        dueSoon,
      },
    });
  } catch (error) {
    logger.error('Error fetching task stats:', error);
    next(error);
  }
});

// GET /api/v1/tasks/:id - Get single task
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const task = tasks.find(t => t.id === parseInt(id));

    if (!task) {
      return res.status(404).json({
        success: false,
        message: `Task with ID ${id} not found`,
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Error fetching task:', error);
    next(error);
  }
});

// POST /api/v1/tasks - Create new task
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      category,
      priority = 'medium',
      status = 'todo',
      dealId,
      propertyId,
      emailId,
      assignedToId,
      dueDate,
      source = 'manual',
      tags = [],
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and category are required',
      });
    }

    const userId = (req as any).user?.userId || 1;

    const newTask: Task = {
      id: nextTaskId++,
      title,
      description,
      category,
      priority,
      status,
      dealId: dealId ? parseInt(dealId) : undefined,
      propertyId: propertyId ? parseInt(propertyId) : undefined,
      emailId,
      assignedToId: assignedToId ? parseInt(assignedToId) : userId,
      createdById: userId,
      dueDate,
      source,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);

    logger.info(`Task created: ${title}`, { taskId: newTask.id, userId });

    res.status(201).json({
      success: true,
      data: newTask,
      message: 'Task created successfully',
    });
  } catch (error) {
    logger.error('Error creating task:', error);
    next(error);
  }
});

// PATCH /api/v1/tasks/:id - Update task
router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const taskIndex = tasks.findIndex(t => t.id === parseInt(id));

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Task with ID ${id} not found`,
      });
    }

    const oldTask = tasks[taskIndex];

    // Auto-set completedAt when moving to done
    if (updates.status === 'done' && oldTask.status !== 'done') {
      updates.completedAt = new Date().toISOString();
    }

    tasks[taskIndex] = {
      ...oldTask,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    logger.info(`Task updated: ${tasks[taskIndex].title}`, {
      taskId: tasks[taskIndex].id,
      changes: Object.keys(updates),
    });

    res.json({
      success: true,
      data: tasks[taskIndex],
      message: 'Task updated successfully',
    });
  } catch (error) {
    logger.error('Error updating task:', error);
    next(error);
  }
});

// DELETE /api/v1/tasks/:id - Delete task
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const taskIndex = tasks.findIndex(t => t.id === parseInt(id));

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Task with ID ${id} not found`,
      });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];

    logger.info(`Task deleted: ${deletedTask.title}`, { taskId: deletedTask.id });

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting task:', error);
    next(error);
  }
});

export default router;
