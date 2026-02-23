import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Validation Schemas
const NoteSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1),
  content_html: z.string().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
  category: z.string().max(100).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string(),
  })).optional(),
  linked_modules: z.array(z.string()).optional(),
  mentioned_user_ids: z.array(z.string()).optional(),
  author_id: z.string(),
  author_name: z.string(),
});

const ContactSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(100),
  company: z.string().max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  linkedin_url: z.string().url().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_primary: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

const KeyDateSchema = z.object({
  title: z.string().min(1).max(255),
  date: z.string(), // ISO date string
  date_type: z.enum(['deadline', 'milestone', 'scheduled']),
  status: z.enum(['upcoming', 'completed', 'missed', 'cancelled']).optional(),
  description: z.string().optional(),
  reminder_days_before: z.array(z.number()).optional(),
  related_contacts: z.array(z.string()).optional(),
});

const DecisionSchema = z.object({
  title: z.string().min(1).max(500),
  decision_type: z.enum(['go-no-go', 'budget', 'design', 'strategy', 'vendor']).optional(),
  status: z.enum(['approved', 'rejected', 'pending', 'tabled']),
  rationale: z.string().optional(),
  alternatives_considered: z.string().optional(),
  impact_description: z.string().optional(),
  budget_impact: z.number().optional(),
  timeline_impact_days: z.number().int().optional(),
  decided_by: z.array(z.string()).optional(),
  decision_date: z.string().optional(), // ISO date
  next_actions: z.array(z.string()).optional(),
  next_review_date: z.string().optional(), // ISO date
});

const RiskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.enum(['financial', 'legal', 'environmental', 'construction', 'market']).optional(),
  impact: z.enum(['low', 'medium', 'high']),
  likelihood: z.enum(['low', 'medium', 'high']),
  mitigation_strategy: z.string().optional(),
  contingency_plan: z.string().optional(),
  budget_contingency: z.number().optional(),
  status: z.enum(['active', 'monitoring', 'mitigated', 'realized']).optional(),
  assigned_to_id: z.string().optional(),
  assigned_to_name: z.string().optional(),
  review_date: z.string().optional(), // ISO date
});

// Helper: Log activity
async function logActivity(
  dealId: string,
  activityType: string,
  title: string,
  description?: string,
  moduleName?: string,
  userId?: string,
  userName?: string,
  changes?: any
) {
  await db.query(
    `
    INSERT INTO deal_activity (
      deal_id, activity_type, title, description, module_name, user_id, user_name, changes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [dealId, activityType, title, description, moduleName, userId, userName, changes ? JSON.stringify(changes) : null]
  );
}

// GET: Fetch all context data for a deal
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab');

    // If specific tab requested, return only that data
    if (tab === 'notes') {
      const notes = await db.query(
        `SELECT * FROM deal_notes WHERE deal_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, created_at DESC`,
        [dealId]
      );
      return NextResponse.json({ notes: notes.rows });
    }

    if (tab === 'activity') {
      const activity = await db.query(
        `SELECT * FROM deal_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [dealId]
      );
      return NextResponse.json({ activity: activity.rows });
    }

    if (tab === 'contacts') {
      const contacts = await db.query(
        `SELECT * FROM deal_contacts WHERE deal_id = $1 ORDER BY is_primary DESC, created_at DESC`,
        [dealId]
      );
      return NextResponse.json({ contacts: contacts.rows });
    }

    if (tab === 'dates') {
      const dates = await db.query(
        `SELECT * FROM deal_key_dates WHERE deal_id = $1 ORDER BY date ASC`,
        [dealId]
      );
      return NextResponse.json({ dates: dates.rows });
    }

    if (tab === 'decisions') {
      const decisions = await db.query(
        `SELECT * FROM deal_decisions WHERE deal_id = $1 ORDER BY created_at DESC`,
        [dealId]
      );
      return NextResponse.json({ decisions: decisions.rows });
    }

    if (tab === 'risks') {
      const risks = await db.query(
        `SELECT * FROM deal_risks WHERE deal_id = $1 ORDER BY 
          CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          created_at DESC`,
        [dealId]
      );
      return NextResponse.json({ risks: risks.rows });
    }

    // Return all context data
    const [notes, activity, contacts, dates, decisions, risks] = await Promise.all([
      db.query(`SELECT * FROM deal_notes WHERE deal_id = $1 AND deleted_at IS NULL ORDER BY pinned DESC, created_at DESC LIMIT 20`, [dealId]),
      db.query(`SELECT * FROM deal_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 50`, [dealId]),
      db.query(`SELECT * FROM deal_contacts WHERE deal_id = $1 ORDER BY is_primary DESC, created_at DESC`, [dealId]),
      db.query(`SELECT * FROM deal_key_dates WHERE deal_id = $1 ORDER BY date ASC`, [dealId]),
      db.query(`SELECT * FROM deal_decisions WHERE deal_id = $1 ORDER BY created_at DESC`, [dealId]),
      db.query(`SELECT * FROM deal_risks WHERE deal_id = $1 ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`, [dealId]),
    ]);

    return NextResponse.json({
      notes: notes.rows,
      activity: activity.rows,
      contacts: contacts.rows,
      dates: dates.rows,
      decisions: decisions.rows,
      risks: risks.rows,
    });
  } catch (error) {
    console.error('Error fetching context data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context data' },
      { status: 500 }
    );
  }
}

// POST: Create context item
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
      case 'note':
        const noteData = NoteSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_notes (
            deal_id, author_id, author_name, title, content, content_html, 
            tags, pinned, category, attachments, linked_modules, mentioned_user_ids
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
          `,
          [
            dealId,
            noteData.author_id,
            noteData.author_name,
            noteData.title,
            noteData.content,
            noteData.content_html,
            noteData.tags || [],
            noteData.pinned || false,
            noteData.category,
            noteData.attachments ? JSON.stringify(noteData.attachments) : '[]',
            noteData.linked_modules || [],
            noteData.mentioned_user_ids || [],
          ]
        );
        await logActivity(dealId, 'note_added', `Note added: ${noteData.title || 'Untitled'}`, undefined, 'Context Tracker', noteData.author_id, noteData.author_name);
        break;

      case 'contact':
        const contactData = ContactSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_contacts (
            deal_id, name, role, company, email, phone, linkedin_url, website, 
            notes, tags, is_primary, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
          `,
          [
            dealId,
            contactData.name,
            contactData.role,
            contactData.company,
            contactData.email,
            contactData.phone,
            contactData.linkedin_url,
            contactData.website,
            contactData.notes,
            contactData.tags || [],
            contactData.is_primary || false,
            contactData.status || 'active',
          ]
        );
        await logActivity(dealId, 'contact_added', `Contact added: ${contactData.name}`, `Role: ${contactData.role}`, 'Context Tracker');
        break;

      case 'date':
        const dateData = KeyDateSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_key_dates (
            deal_id, title, date, date_type, status, description, 
            reminder_days_before, related_contacts
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
          `,
          [
            dealId,
            dateData.title,
            dateData.date,
            dateData.date_type,
            dateData.status || 'upcoming',
            dateData.description,
            dateData.reminder_days_before || [],
            dateData.related_contacts || [],
          ]
        );
        await logActivity(dealId, 'date_added', `Key date added: ${dateData.title}`, `Date: ${dateData.date}`, 'Context Tracker');
        break;

      case 'decision':
        const decisionData = DecisionSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_decisions (
            deal_id, title, decision_type, status, rationale, alternatives_considered,
            impact_description, budget_impact, timeline_impact_days, decided_by,
            decision_date, next_actions, next_review_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
          `,
          [
            dealId,
            decisionData.title,
            decisionData.decision_type,
            decisionData.status,
            decisionData.rationale,
            decisionData.alternatives_considered,
            decisionData.impact_description,
            decisionData.budget_impact,
            decisionData.timeline_impact_days,
            decisionData.decided_by || [],
            decisionData.decision_date,
            decisionData.next_actions || [],
            decisionData.next_review_date,
          ]
        );
        await logActivity(dealId, 'decision_made', `Decision: ${decisionData.title}`, `Status: ${decisionData.status}`, 'Context Tracker');
        break;

      case 'risk':
        const riskData = RiskSchema.parse(data);
        result = await db.query(
          `
          INSERT INTO deal_risks (
            deal_id, title, description, category, impact, likelihood,
            mitigation_strategy, contingency_plan, budget_contingency,
            status, assigned_to_id, assigned_to_name, review_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
          `,
          [
            dealId,
            riskData.title,
            riskData.description,
            riskData.category,
            riskData.impact,
            riskData.likelihood,
            riskData.mitigation_strategy,
            riskData.contingency_plan,
            riskData.budget_contingency,
            riskData.status || 'active',
            riskData.assigned_to_id,
            riskData.assigned_to_name,
            riskData.review_date,
          ]
        );
        await logActivity(dealId, 'risk_added', `Risk identified: ${riskData.title}`, `Severity: ${result.rows[0].severity}`, 'Context Tracker');
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

    console.error('Error creating context item:', error);
    return NextResponse.json(
      { error: 'Failed to create context item' },
      { status: 500 }
    );
  }
}

// PUT: Update context item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { type, itemId, data } = body;

    let result;

    switch (type) {
      case 'note':
        result = await db.query(
          `
          UPDATE deal_notes SET
            title = COALESCE($1, title),
            content = COALESCE($2, content),
            content_html = COALESCE($3, content_html),
            tags = COALESCE($4, tags),
            pinned = COALESCE($5, pinned),
            category = COALESCE($6, category),
            updated_at = NOW()
          WHERE id = $7
          RETURNING *
          `,
          [data.title, data.content, data.content_html, data.tags, data.pinned, data.category, itemId]
        );
        break;

      case 'contact':
        result = await db.query(
          `
          UPDATE deal_contacts SET
            name = COALESCE($1, name),
            role = COALESCE($2, role),
            company = COALESCE($3, company),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            linkedin_url = COALESCE($6, linkedin_url),
            website = COALESCE($7, website),
            notes = COALESCE($8, notes),
            is_primary = COALESCE($9, is_primary),
            status = COALESCE($10, status),
            updated_at = NOW()
          WHERE id = $11
          RETURNING *
          `,
          [data.name, data.role, data.company, data.email, data.phone, data.linkedin_url, data.website, data.notes, data.is_primary, data.status, itemId]
        );
        break;

      case 'date':
        result = await db.query(
          `
          UPDATE deal_key_dates SET
            title = COALESCE($1, title),
            date = COALESCE($2, date),
            status = COALESCE($3, status),
            description = COALESCE($4, description),
            updated_at = NOW()
          WHERE id = $5
          RETURNING *
          `,
          [data.title, data.date, data.status, data.description, itemId]
        );
        break;

      case 'decision':
        result = await db.query(
          `
          UPDATE deal_decisions SET
            title = COALESCE($1, title),
            status = COALESCE($2, status),
            rationale = COALESCE($3, rationale),
            updated_at = NOW()
          WHERE id = $4
          RETURNING *
          `,
          [data.title, data.status, data.rationale, itemId]
        );
        break;

      case 'risk':
        result = await db.query(
          `
          UPDATE deal_risks SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            impact = COALESCE($3, impact),
            likelihood = COALESCE($4, likelihood),
            mitigation_strategy = COALESCE($5, mitigation_strategy),
            status = COALESCE($6, status),
            updated_at = NOW()
          WHERE id = $7
          RETURNING *
          `,
          [data.title, data.description, data.impact, data.likelihood, data.mitigation_strategy, data.status, itemId]
        );
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating context item:', error);
    return NextResponse.json(
      { error: 'Failed to update context item' },
      { status: 500 }
    );
  }
}

// DELETE: Delete context item
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
      case 'note':
        // Soft delete notes
        await db.query(`UPDATE deal_notes SET deleted_at = NOW() WHERE id = $1`, [itemId]);
        return NextResponse.json({ success: true });
      case 'contact':
        tableName = 'deal_contacts';
        break;
      case 'date':
        tableName = 'deal_key_dates';
        break;
      case 'decision':
        tableName = 'deal_decisions';
        break;
      case 'risk':
        tableName = 'deal_risks';
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [itemId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting context item:', error);
    return NextResponse.json(
      { error: 'Failed to delete context item' },
      { status: 500 }
    );
  }
}
