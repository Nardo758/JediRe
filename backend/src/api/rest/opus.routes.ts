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
      const conversation = await opus.createConversation(dealId, (req as any).userId, title);
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

  return router;
}
