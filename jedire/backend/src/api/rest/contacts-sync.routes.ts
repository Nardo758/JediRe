import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import {
  fetchMicrosoftContacts,
  fetchMicrosoftPeople,
  fetchGoogleContacts,
  getConnectionStatus,
  UnifiedContact,
} from '../../services/contacts-sync.service';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

router.get('/contacts/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const status = await getConnectionStatus(userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.get('/contacts/microsoft', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const includeRelevant = req.query.includeRelevant === 'true';

    let contacts: UnifiedContact[] = [];

    try {
      contacts = await fetchMicrosoftContacts(userId);
    } catch (err: any) {
      logger.warn('Failed to fetch Microsoft contacts, trying People API:', err.message);
    }

    if (includeRelevant || contacts.length === 0) {
      try {
        const people = await fetchMicrosoftPeople(userId);
        const existingEmails = new Set(contacts.map(c => c.email.toLowerCase()));
        for (const person of people) {
          if (!existingEmails.has(person.email.toLowerCase())) {
            contacts.push(person);
          }
        }
      } catch (err: any) {
        logger.warn('Failed to fetch Microsoft People:', err.message);
      }
    }

    res.json({ contacts, count: contacts.length });
  } catch (error) {
    next(error);
  }
});

router.get('/contacts/google', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const contacts = await fetchGoogleContacts(userId);
    res.json({ contacts, count: contacts.length });
  } catch (error) {
    next(error);
  }
});

router.post('/deals/:dealId/team/members/import', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { dealId } = req.params;
    const { contacts } = req.body as { contacts: UnifiedContact[] };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'No contacts provided' });
    }

    const imported: any[] = [];
    const skipped: { email: string; reason: string }[] = [];

    for (const contact of contacts) {
      if (!contact.name || !contact.email) {
        skipped.push({ email: contact.email || 'unknown', reason: 'Missing name or email' });
        continue;
      }

      try {
        const existing = await pool.query(
          'SELECT id FROM deal_team_members WHERE deal_id = $1 AND email = $2',
          [dealId, contact.email]
        );

        if (existing.rows.length > 0) {
          skipped.push({ email: contact.email, reason: 'Already a team member' });
          continue;
        }

        const result = await pool.query(
          `INSERT INTO deal_team_members (deal_id, name, email, phone, role, title, company, permissions, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            dealId,
            contact.name,
            contact.email,
            contact.phone || null,
            'Reviewer',
            contact.title || null,
            contact.company || null,
            JSON.stringify({ read: true, write: false, admin: false }),
            'active',
          ]
        );

        await pool.query(
          `INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, target_id, details)
           VALUES ($1, $2, 'member_added', 'member', $3, $4)`,
          [dealId, 'System', result.rows[0].id, JSON.stringify({
            name: contact.name,
            role: 'Reviewer',
            source: contact.source,
            importedFrom: contact.source === 'microsoft' ? 'Outlook' : 'Google',
          })]
        );

        imported.push(result.rows[0]);
      } catch (err: any) {
        logger.error(`Failed to import contact ${contact.email}:`, err);
        skipped.push({ email: contact.email, reason: err.message || 'Import failed' });
      }
    }

    res.json({
      imported,
      skipped,
      summary: {
        total: contacts.length,
        imported: imported.length,
        skipped: skipped.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
