import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { OpusService } from '../../services/opus.service';

export function createOpusRoutes(pool: Pool): Router {
  const router = Router();
  const opus = new OpusService(pool);

  router.get('/conversations', async (req: Request, res: Response) => {
    try {
      const dealId = req.query.dealId as string;
      if (!dealId) return res.status(400).json({ error: 'dealId required' });
      const conversations = await opus.getConversations(dealId);
      res.json(conversations);
    } catch (err: any) {
      console.error('Opus conversations error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/conversations', async (req: Request, res: Response) => {
    try {
      const { dealId, title } = req.body;
      if (!dealId) return res.status(400).json({ error: 'dealId required' });
      const conversation = await opus.createConversation(dealId, (req as any).user?.userId, title);
      res.status(201).json(conversation);
    } catch (err: any) {
      console.error('Opus create conversation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await opus.getConversation(id);
      if (!conversation) return res.status(404).json({ error: 'Not found' });
      const messages = await opus.getMessages(id);
      res.json({ ...conversation, messages });
    } catch (err: any) {
      console.error('Opus get conversation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await opus.deleteConversation(id);
      res.status(204).send();
    } catch (err: any) {
      console.error('Opus delete conversation error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content, dealId } = req.body;
      if (!content || !dealId) return res.status(400).json({ error: 'content and dealId required' });

      const conversation = await opus.getConversation(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      await opus.streamChat(
        conversationId,
        content,
        dealId,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        (fullResponse) => {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
      );
    } catch (err: any) {
      console.error('Opus chat error:', err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.get('/proforma-versions', async (req: Request, res: Response) => {
    try {
      const dealId = req.query.dealId as string;
      if (!dealId) return res.status(400).json({ error: 'dealId required' });
      const versions = await opus.getProformaVersions(dealId);
      res.json(versions);
    } catch (err: any) {
      console.error('Opus proforma versions error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/proforma-versions/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const version = await opus.getProformaVersion(id);
      if (!version) return res.status(404).json({ error: 'Not found' });
      res.json(version);
    } catch (err: any) {
      console.error('Opus proforma version error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/proforma-versions', async (req: Request, res: Response) => {
    try {
      const { dealId, conversationId, versionName, proformaData, assumptions } = req.body;
      if (!dealId || !proformaData) return res.status(400).json({ error: 'dealId and proformaData required' });
      const version = await opus.saveProformaVersion(dealId, conversationId || null, versionName || 'Manual Model', proformaData, assumptions);
      res.status(201).json(version);
    } catch (err: any) {
      console.error('Opus save proforma error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/proforma-versions/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await opus.deleteProformaVersion(id);
      res.status(204).send();
    } catch (err: any) {
      console.error('Opus delete proforma error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Custom Tabs (Task #451) — CRUD + refresh + manual generate
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Resolve a stable userId for the request. Mirrors the streamChat fallback
   * so manual REST CRUD lands in the same row as Opus-emitted tabs.
   *
   * IMPORTANT: do NOT trust client-supplied identity headers (x-user-id) here
   * — they would let any caller spoof a different user's tab namespace inside
   * the same deal, since custom-tab rows are keyed by (deal_id,user_id,tab_id).
   * We accept only authenticated identity from req.user, falling back to a
   * deterministic per-deal bucket so unauthenticated dev/preview environments
   * stay functional but every caller in that bucket sees the same tabs.
   */
  const resolveUserId = (req: Request, dealId: string): string => {
    const u = (req as any).user?.userId;
    if (u && typeof u === 'string') return u;
    return `deal:${dealId}`;
  };

  router.get('/deals/:dealId/custom-tabs', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = resolveUserId(req, dealId);
      const tabs = await opus.listCustomTabs(dealId, userId);
      res.json({ tabs });
    } catch (err: any) {
      console.error('Opus list custom tabs error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/deals/:dealId/custom-tabs', async (req: Request, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = resolveUserId(req, dealId);
      const { payload, generationPrompt, conversationId } = req.body ?? {};
      const result = await opus.createCustomTab({
        dealId,
        userId,
        payload,
        generationPrompt: generationPrompt ?? null,
        conversationId: conversationId ?? null,
      });
      if (!result.saved) {
        return res.status(422).json({
          error: 'Custom tab payload failed validation',
          issues: result.validation.issues,
          unknownFields: result.validation.unknownFields,
        });
      }
      res.status(201).json({ tab: result.row });
    } catch (err: any) {
      console.error('Opus create custom tab error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/deals/:dealId/custom-tabs/:tabId', async (req: Request, res: Response) => {
    try {
      const { dealId, tabId } = req.params;
      const userId = resolveUserId(req, dealId);
      const { title, payload } = req.body ?? {};
      if (payload) {
        const result = await opus.replaceCustomTab({ dealId, userId, tabId, payload });
        if (!result.saved) {
          return res.status(422).json({
            error: 'Custom tab payload failed validation',
            issues: result.validation.issues,
            unknownFields: result.validation.unknownFields,
          });
        }
        return res.json({ tab: result.row });
      }
      if (typeof title === 'string') {
        const ok = await opus.renameCustomTab(dealId, userId, tabId, title);
        if (!ok) return res.status(404).json({ error: 'tab not found or invalid title' });
        const row = await opus.getCustomTab(dealId, userId, tabId);
        return res.json({ tab: row });
      }
      res.status(400).json({ error: 'PATCH requires `title` or `payload` in body' });
    } catch (err: any) {
      console.error('Opus update custom tab error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/deals/:dealId/custom-tabs/:tabId/refresh', async (req: Request, res: Response) => {
    try {
      const { dealId, tabId } = req.params;
      const userId = resolveUserId(req, dealId);
      const { conversationId } = req.body ?? {};
      const result = await opus.refreshCustomTab({ dealId, userId, tabId, conversationId: conversationId ?? null });
      if (!result.refreshed) {
        return res.status(result.row ? 422 : 404).json({
          error: result.error ?? 'refresh failed',
          issues: result.validation?.issues,
          unknownFields: result.validation?.unknownFields,
          tab: result.row,
        });
      }
      res.json({ tab: result.row });
    } catch (err: any) {
      console.error('Opus refresh custom tab error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/deals/:dealId/custom-tabs/:tabId', async (req: Request, res: Response) => {
    try {
      const { dealId, tabId } = req.params;
      const userId = resolveUserId(req, dealId);
      const ok = await opus.deleteCustomTab(dealId, userId, tabId);
      if (!ok) return res.status(404).json({ error: 'tab not found' });
      res.status(204).send();
    } catch (err: any) {
      console.error('Opus delete custom tab error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
