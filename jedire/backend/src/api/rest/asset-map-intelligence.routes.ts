/**
 * Asset Map Intelligence Routes - Master Router
 * Combines all Asset Map Intelligence endpoints:
 * - Asset News Links
 * - Asset Notes
 * - Note Replies
 * - Note Categories
 * - Note Permissions
 */

import { Router } from 'express';
import assetNewsRoutes from './assetNews.routes';
import assetNotesRoutes from './assetNotes.routes';
import noteRepliesRoutes from './noteReplies.routes';
import noteCategoriesRoutes from './noteCategories.routes';

const router = Router();

// Asset News Links: /api/v1/assets/:assetId/news
router.use('/', assetNewsRoutes);

// Asset Notes: /api/v1/assets/:assetId/notes
router.use('/', assetNotesRoutes);

// Note Replies: /api/v1/assets/:assetId/notes/:noteId/replies
router.use('/', noteRepliesRoutes);

// Note Categories: /api/v1/note-categories
// This is a special case - it's not under /assets
// We need to export it separately for the main router to mount at /api/v1/note-categories

export { noteCategoriesRoutes };

export default router;
