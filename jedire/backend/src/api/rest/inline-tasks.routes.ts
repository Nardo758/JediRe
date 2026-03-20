import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, createTaskSchema, updateTaskSchema } from './validation';

const router = Router();

const taskStore: any[] = [
  {
    id: 1, title: 'Review Phase I Environmental Report',
    description: 'Review the Phase I Environmental Site Assessment for potential contamination issues',
    category: 'due_diligence', priority: 'high', status: 'todo', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'manual', tags: ['environmental', 'urgent'],
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 2, title: 'Submit Rent Roll to Lender',
    description: 'Prepare and submit current rent roll to lender for financing review',
    category: 'financing', priority: 'medium', status: 'in_progress', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'email_ai', tags: ['financing', 'documentation'],
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 3, title: 'Schedule Property Tour',
    description: 'Coordinate with broker to schedule property walkthrough',
    category: 'due_diligence', priority: 'medium', status: 'todo', dealId: 1,
    assignedToId: 1, createdById: 1, source: 'manual', tags: ['site-visit'],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
let nextTaskId = 4;

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, dealId, category, priority } = req.query;
    let filtered = [...taskStore];
    if (status) filtered = filtered.filter(t => t.status === status);
    if (dealId) filtered = filtered.filter(t => t.dealId === parseInt(dealId as string));
    if (category) filtered = filtered.filter(t => t.category === category);
    if (priority) filtered = filtered.filter(t => t.priority === priority);
    const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const byStatus = {
      todo: taskStore.filter(t => t.status === 'todo').length,
      in_progress: taskStore.filter(t => t.status === 'in_progress').length,
      blocked: taskStore.filter(t => t.status === 'blocked').length,
      done: taskStore.filter(t => t.status === 'done').length,
      cancelled: taskStore.filter(t => t.status === 'cancelled').length,
    };
    res.json({
      success: true,
      data: {
        total: taskStore.length,
        byStatus,
        overdue: taskStore.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done').length,
        dueToday: taskStore.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()).length,
        dueSoon: taskStore.filter(t => t.dueDate && new Date(t.dueDate) > today && new Date(t.dueDate) < new Date(today.getTime() + 7 * 86400000)).length,
      },
    });
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task stats' });
  }
});

router.post('/', requireAuth, validate(createTaskSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, category, priority = 'medium', status = 'todo', dealId, dueDate, source = 'manual', tags = [] } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'Title and category are required' });
    }
    const newTask = {
      id: nextTaskId++, title, description, category, priority, status,
      dealId: dealId ? parseInt(dealId) : undefined,
      assignedToId: req.user!.userId, createdById: req.user!.userId,
      dueDate, source, tags,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    taskStore.push(newTask);
    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

router.patch('/:id', requireAuth, validate(updateTaskSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const idx = taskStore.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: 'Task not found' });
    const updates = req.body;
    if (updates.status === 'done' && taskStore[idx].status !== 'done') {
      updates.completedAt = new Date().toISOString();
    }
    taskStore[idx] = { ...taskStore[idx], ...updates, updatedAt: new Date().toISOString() };
    res.json({ success: true, data: taskStore[idx] });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const idx = taskStore.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: 'Task not found' });
    taskStore.splice(idx, 1);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

export default router;
