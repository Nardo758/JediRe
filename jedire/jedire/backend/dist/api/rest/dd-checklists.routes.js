"use strict";
/**
 * Due Diligence Checklists API Routes
 * Handle DD checklists and tasks for deals
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.requireAuth);
/**
 * POST /api/v1/dd-checklists
 * Create a new DD checklist
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { dealId, checklistType } = req.body;
        // Validation
        if (!dealId || !checklistType) {
            return res.status(400).json({
                success: false,
                error: 'dealId and checklistType are required'
            });
        }
        // Verify user has access to this deal
        const dealCheck = await (0, connection_1.query)('SELECT id FROM deals WHERE id = $1 AND user_id = $2', [dealId, userId]);
        if (dealCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Deal not found or access denied'
            });
        }
        // Check if checklist already exists for this deal
        const existingCheck = await (0, connection_1.query)('SELECT id FROM dd_checklists WHERE deal_id = $1', [dealId]);
        if (existingCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Checklist already exists for this deal'
            });
        }
        // Create DD checklist
        const result = await (0, connection_1.query)(`INSERT INTO dd_checklists 
       (deal_id, checklist_type, tasks, completion_pct, risk_score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [dealId, checklistType, JSON.stringify([]), 0, 0]);
        logger_1.logger.info('DD checklist created:', {
            userId,
            dealId,
            checklistId: result.rows[0].id
        });
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating DD checklist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create DD checklist'
        });
    }
});
/**
 * GET /api/v1/dd-checklists/:dealId
 * Get DD checklist for a deal with all tasks
 */
router.get('/:dealId', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { dealId } = req.params;
        // Verify user has access to this deal
        const dealCheck = await (0, connection_1.query)('SELECT id FROM deals WHERE id = $1 AND user_id = $2', [dealId, userId]);
        if (dealCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Deal not found or access denied'
            });
        }
        // Get checklist
        const checklistResult = await (0, connection_1.query)('SELECT * FROM dd_checklists WHERE deal_id = $1', [dealId]);
        if (checklistResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'DD checklist not found'
            });
        }
        const checklist = checklistResult.rows[0];
        // Get all tasks for this checklist
        const tasksResult = await (0, connection_1.query)(`SELECT * FROM dd_tasks 
       WHERE checklist_id = $1
       ORDER BY 
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         created_at ASC`, [checklist.id]);
        // Calculate completion percentage
        const totalTasks = tasksResult.rows.length;
        const completedTasks = tasksResult.rows.filter(task => task.status === 'complete').length;
        const completionPct = totalTasks > 0
            ? (completedTasks / totalTasks) * 100
            : 0;
        // Update completion percentage if changed
        if (Math.abs(completionPct - (checklist.completion_pct || 0)) > 0.01) {
            await (0, connection_1.query)('UPDATE dd_checklists SET completion_pct = $1 WHERE id = $2', [completionPct, checklist.id]);
            checklist.completion_pct = completionPct;
        }
        res.json({
            success: true,
            data: {
                checklist,
                tasks: tasksResult.rows,
                stats: {
                    total: totalTasks,
                    completed: completedTasks,
                    in_progress: tasksResult.rows.filter(t => t.status === 'in_progress').length,
                    pending: tasksResult.rows.filter(t => t.status === 'pending').length,
                    blocked: tasksResult.rows.filter(t => t.status === 'blocked').length,
                    completion_pct: completionPct
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching DD checklist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch DD checklist'
        });
    }
});
/**
 * POST /api/v1/dd-tasks
 * Add a new task to a checklist
 */
router.post('/tasks', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { checklistId, title, category, priority, status, dueDate, assignedTo, notes } = req.body;
        // Validation
        if (!checklistId || !title) {
            return res.status(400).json({
                success: false,
                error: 'checklistId and title are required'
            });
        }
        // Verify user has access to this checklist's deal
        const accessCheck = await (0, connection_1.query)(`SELECT c.id FROM dd_checklists c
       JOIN deals d ON c.deal_id = d.id
       WHERE c.id = $1 AND d.user_id = $2`, [checklistId, userId]);
        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Checklist not found or access denied'
            });
        }
        // Create task
        const result = await (0, connection_1.query)(`INSERT INTO dd_tasks 
       (checklist_id, title, category, priority, status, due_date, assigned_to, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [
            checklistId,
            title,
            category || null,
            priority || 'medium',
            status || 'pending',
            dueDate || null,
            assignedTo || null,
            notes || null
        ]);
        logger_1.logger.info('DD task created:', {
            userId,
            checklistId,
            taskId: result.rows[0].id
        });
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating DD task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create DD task'
        });
    }
});
/**
 * PATCH /api/v1/dd-tasks/:id
 * Update a task (status, priority, etc.)
 */
router.patch('/tasks/:id', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { title, category, priority, status, dueDate, assignedTo, notes } = req.body;
        // Verify user has access to this task's checklist/deal
        const accessCheck = await (0, connection_1.query)(`SELECT t.id FROM dd_tasks t
       JOIN dd_checklists c ON t.checklist_id = c.id
       JOIN deals d ON c.deal_id = d.id
       WHERE t.id = $1 AND d.user_id = $2`, [id, userId]);
        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Task not found or access denied'
            });
        }
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            values.push(category);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            values.push(priority);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
            // If status is 'complete', set completed_at
            if (status === 'complete') {
                updates.push(`completed_at = NOW()`);
            }
        }
        if (dueDate !== undefined) {
            updates.push(`due_date = $${paramIndex++}`);
            values.push(dueDate);
        }
        if (assignedTo !== undefined) {
            updates.push(`assigned_to = $${paramIndex++}`);
            values.push(assignedTo);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
        values.push(id);
        const result = await (0, connection_1.query)(`UPDATE dd_tasks 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`, values);
        logger_1.logger.info('DD task updated:', {
            userId,
            taskId: id
        });
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating DD task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update DD task'
        });
    }
});
/**
 * DELETE /api/v1/dd-tasks/:id
 * Delete a task
 */
router.delete('/tasks/:id', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        // Verify user has access to this task's checklist/deal
        const accessCheck = await (0, connection_1.query)(`SELECT t.id FROM dd_tasks t
       JOIN dd_checklists c ON t.checklist_id = c.id
       JOIN deals d ON c.deal_id = d.id
       WHERE t.id = $1 AND d.user_id = $2`, [id, userId]);
        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Task not found or access denied'
            });
        }
        await (0, connection_1.query)('DELETE FROM dd_tasks WHERE id = $1', [id]);
        logger_1.logger.info('DD task deleted:', {
            userId,
            taskId: id
        });
        res.json({
            success: true,
            message: 'DD task deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting DD task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete DD task'
        });
    }
});
exports.default = router;
//# sourceMappingURL=dd-checklists.routes.js.map