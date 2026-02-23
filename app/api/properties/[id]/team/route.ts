import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Validation Schemas
const TeamMemberSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  role: z.string().min(1).max(100),
  specialization: z.string().max(255).optional(),
  bio: z.string().optional(),
  permissions: z.object({
    view: z.boolean().optional(),
    edit: z.boolean().optional(),
    delete: z.boolean().optional(),
    invite: z.boolean().optional(),
    financial: z.boolean().optional(),
    documents: z.boolean().optional(),
    team_management: z.boolean().optional(),
  }).optional(),
});

const TaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  assigned_to_id: z.string().uuid().optional(),
  assigned_to_name: z.string().max(255).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'completed', 'cancelled']).optional(),
  due_date: z.string().optional(), // ISO date
  estimated_hours: z.number().positive().optional(),
  progress_percent: z.number().min(0).max(100).optional(),
});

const CommentSchema = z.object({
  context_type: z.enum(['task', 'module', 'document', 'general']),
  context_id: z.string().uuid().optional(),
  author_id: z.string().uuid(),
  author_name: z.string().min(1).max(255),
  content: z.string().min(1),
  parent_comment_id: z.string().uuid().optional(),
  mentioned_user_ids: z.array(z.string().uuid()).optional(),
});

// Helper: Send notification
async function sendNotification(
  dealId: string,
  recipientId: string,
  type: string,
  title: string,
  message: string,
  linkUrl?: string
) {
  await db.query(
    `SELECT notify_team_member($1, $2, $3, $4, $5, $6)`,
    [dealId, recipientId, type, title, message, linkUrl]
  );
}

// GET: Fetch team data
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    // Team stats
    if (section === 'stats') {
      const stats = await db.query(
        `SELECT * FROM get_team_stats($1)`,
        [dealId]
      );
      return NextResponse.json(stats.rows[0]);
    }

    // Members
    if (section === 'members') {
      const members = await db.query(
        `SELECT * FROM deal_team_members WHERE deal_id = $1 ORDER BY 
          CASE status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
          created_at DESC`,
        [dealId]
      );
      return NextResponse.json({ members: members.rows });
    }

    // Tasks
    if (section === 'tasks') {
      const status = searchParams.get('status');
      const assignedTo = searchParams.get('assignedTo');
      
      let query = `SELECT * FROM deal_team_tasks WHERE deal_id = $1`;
      const params: any[] = [dealId];
      
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      
      if (assignedTo) {
        params.push(assignedTo);
        query += ` AND assigned_to_id = $${params.length}`;
      }
      
      query += ` ORDER BY 
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        due_date ASC NULLS LAST`;
      
      const tasks = await db.query(query, params);
      return NextResponse.json({ tasks: tasks.rows });
    }

    // Comments
    if (section === 'comments') {
      const contextType = searchParams.get('contextType');
      const contextId = searchParams.get('contextId');
      
      let query = `SELECT * FROM deal_team_comments WHERE deal_id = $1 AND deleted_at IS NULL`;
      const params: any[] = [dealId];
      
      if (contextType) {
        params.push(contextType);
        query += ` AND context_type = $${params.length}`;
      }
      
      if (contextId) {
        params.push(contextId);
        query += ` AND context_id = $${params.length}`;
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const comments = await db.query(query, params);
      return NextResponse.json({ comments: comments.rows });
    }

    // Activity
    if (section === 'activity') {
      const activity = await db.query(
        `SELECT * FROM deal_team_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [dealId]
      );
      return NextResponse.json({ activity: activity.rows });
    }

    // Notifications
    if (section === 'notifications') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
      }
      
      const notifications = await db.query(
        `SELECT * FROM deal_team_notifications 
         WHERE deal_id = $1 AND recipient_id = $2 AND dismissed_at IS NULL
         ORDER BY created_at DESC LIMIT 50`,
        [dealId, userId]
      );
      return NextResponse.json({ notifications: notifications.rows });
    }

    // Return all team data
    const [members, tasks, activity, stats] = await Promise.all([
      db.query(`SELECT * FROM deal_team_members WHERE deal_id = $1 ORDER BY created_at DESC`, [dealId]),
      db.query(`SELECT * FROM deal_team_tasks WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 20`, [dealId]),
      db.query(`SELECT * FROM deal_team_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 20`, [dealId]),
      db.query(`SELECT * FROM get_team_stats($1)`, [dealId]),
    ]);

    return NextResponse.json({
      members: members.rows,
      tasks: tasks.rows,
      activity: activity.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error('Error fetching team data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}

// POST: Create team item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;
    const body = await request.json();
    const { type, data } = body;

    let result;

    switch (type) {
      case 'member':
        const memberData = TeamMemberSchema.parse(data);
        
        // Get default permissions for role
        const roleTemplate = await db.query(
          `SELECT permissions FROM team_role_templates WHERE name = $1`,
          [memberData.role.toLowerCase()]
        );
        
        const permissions = memberData.permissions || 
          (roleTemplate.rows.length > 0 ? roleTemplate.rows[0].permissions : {
            view: true,
            edit: false,
            delete: false,
            invite: false,
            financial: false,
            documents: true,
          });
        
        result = await db.query(
          `
          INSERT INTO deal_team_members (
            deal_id, name, email, phone, company, role, specialization, bio,
            permissions, status, invited_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          RETURNING *
          `,
          [
            dealId,
            memberData.name,
            memberData.email,
            memberData.phone,
            memberData.company,
            memberData.role,
            memberData.specialization,
            memberData.bio,
            JSON.stringify(permissions),
            'pending', // Awaiting acceptance
          ]
        );
        
        // Send invitation notification
        await sendNotification(
          dealId,
          result.rows[0].id,
          'invitation',
          'Team Invitation',
          `You've been invited to join the team as ${memberData.role}`,
          `/deals/${dealId}/team`
        );
        break;

      case 'task':
        const taskData = TaskSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_team_tasks (
            deal_id, title, description, category, assigned_to_id, assigned_to_name,
            priority, status, due_date, estimated_hours, progress_percent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
          `,
          [
            dealId,
            taskData.title,
            taskData.description,
            taskData.category,
            taskData.assigned_to_id,
            taskData.assigned_to_name,
            taskData.priority || 'medium',
            taskData.status || 'todo',
            taskData.due_date,
            taskData.estimated_hours,
            taskData.progress_percent || 0,
          ]
        );
        
        // Notify assignee
        if (taskData.assigned_to_id) {
          await sendNotification(
            dealId,
            taskData.assigned_to_id,
            'task_assigned',
            'New Task Assigned',
            `You've been assigned: ${taskData.title}`,
            `/deals/${dealId}/team?tab=tasks&taskId=${result.rows[0].id}`
          );
        }
        break;

      case 'comment':
        const commentData = CommentSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_team_comments (
            deal_id, context_type, context_id, author_id, author_name,
            content, parent_comment_id, mentioned_user_ids
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
          `,
          [
            dealId,
            commentData.context_type,
            commentData.context_id,
            commentData.author_id,
            commentData.author_name,
            commentData.content,
            commentData.parent_comment_id,
            commentData.mentioned_user_ids || [],
          ]
        );
        
        // Notify mentioned users
        if (commentData.mentioned_user_ids && commentData.mentioned_user_ids.length > 0) {
          for (const userId of commentData.mentioned_user_ids) {
            await sendNotification(
              dealId,
              userId,
              'mention',
              'You were mentioned',
              `${commentData.author_name} mentioned you in a comment`,
              `/deals/${dealId}/team?tab=comments&commentId=${result.rows[0].id}`
            );
          }
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating team item:', error);
    return NextResponse.json(
      { error: 'Failed to create team item' },
      { status: 500 }
    );
  }
}

// PUT: Update team item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { type, itemId, data } = body;

    let result;

    switch (type) {
      case 'member':
        result = await db.query(
          `
          UPDATE deal_team_members SET
            name = COALESCE($1, name),
            email = COALESCE($2, email),
            phone = COALESCE($3, phone),
            role = COALESCE($4, role),
            status = COALESCE($5, status),
            permissions = COALESCE($6, permissions),
            last_active_at = NOW(),
            updated_at = NOW()
          WHERE id = $7
          RETURNING *
          `,
          [data.name, data.email, data.phone, data.role, data.status, 
           data.permissions ? JSON.stringify(data.permissions) : null, itemId]
        );
        break;

      case 'task':
        const updateFields: any = {};
        if (data.status === 'completed' && !data.completed_at) {
          updateFields.completed_at = 'NOW()';
        }
        if (data.status === 'in-progress' && !data.started_at) {
          updateFields.started_at = 'NOW()';
        }
        
        result = await db.query(
          `
          UPDATE deal_team_tasks SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            status = COALESCE($3, status),
            priority = COALESCE($4, priority),
            progress_percent = COALESCE($5, progress_percent),
            due_date = COALESCE($6, due_date),
            assigned_to_id = COALESCE($7, assigned_to_id),
            assigned_to_name = COALESCE($8, assigned_to_name),
            ${data.status === 'completed' ? 'completed_at = NOW(),' : ''}
            ${data.status === 'in-progress' ? 'started_at = NOW(),' : ''}
            actual_hours = COALESCE($9, actual_hours),
            updated_at = NOW()
          WHERE id = $10
          RETURNING *
          `,
          [data.title, data.description, data.status, data.priority, 
           data.progress_percent, data.due_date, data.assigned_to_id, 
           data.assigned_to_name, data.actual_hours, itemId]
        );
        break;

      case 'comment':
        result = await db.query(
          `
          UPDATE deal_team_comments SET
            content = COALESCE($1, content),
            edited_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [data.content, itemId]
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating team item:', error);
    return NextResponse.json(
      { error: 'Failed to update team item' },
      { status: 500 }
    );
  }
}

// DELETE: Remove team item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const itemId = searchParams.get('itemId');

    if (!type || !itemId) {
      return NextResponse.json({ error: 'Missing type or itemId' }, { status: 400 });
    }

    let tableName;
    switch (type) {
      case 'member':
        // Soft remove - set status to removed
        await db.query(
          `UPDATE deal_team_members SET status = 'removed', updated_at = NOW() WHERE id = $1`,
          [itemId]
        );
        return NextResponse.json({ success: true });
      case 'task':
        tableName = 'deal_team_tasks';
        break;
      case 'comment':
        // Soft delete comments
        await db.query(
          `UPDATE deal_team_comments SET deleted_at = NOW() WHERE id = $1`,
          [itemId]
        );
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [itemId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team item:', error);
    return NextResponse.json(
      { error: 'Failed to delete team item' },
      { status: 500 }
    );
  }
}
