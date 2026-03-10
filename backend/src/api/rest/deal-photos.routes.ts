import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// Get photos for a deal
router.get('/:dealId/photos', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT deal_data->'photos' as photos FROM deals WHERE id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const photos = result.rows[0].photos || [];
    res.json({ success: true, photos });
  } catch (error: any) {
    logger.error('Error fetching deal photos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch photos' });
  }
});

// Add a photo to a deal
router.post('/:dealId/photos', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { url, label, caption, source } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'Photo URL is required' });
    }

    const pool = getPool();

    // Get current photos
    const currentResult = await pool.query(
      `SELECT deal_data->'photos' as photos FROM deals WHERE id = $1`,
      [dealId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const currentPhotos = currentResult.rows[0].photos || [];

    // Add new photo
    const newPhoto = {
      id: Date.now().toString(),
      url,
      label: label || 'Property Photo',
      caption: caption || null,
      source: source || 'manual',
      aspect: '16:9',
      addedAt: new Date().toISOString(),
    };

    const updatedPhotos = [...currentPhotos, newPhoto];

    // Update deal_data
    await pool.query(
      `UPDATE deals 
       SET deal_data = jsonb_set(COALESCE(deal_data, '{}'), '{photos}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(updatedPhotos), dealId]
    );

    res.json({ success: true, photo: newPhoto, total: updatedPhotos.length });
  } catch (error: any) {
    logger.error('Error adding photo:', error);
    res.status(500).json({ success: false, error: 'Failed to add photo' });
  }
});

// Delete a photo from a deal
router.delete('/:dealId/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { dealId, photoId } = req.params;
    const pool = getPool();

    // Get current photos
    const currentResult = await pool.query(
      `SELECT deal_data->'photos' as photos FROM deals WHERE id = $1`,
      [dealId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const currentPhotos = currentResult.rows[0].photos || [];
    const updatedPhotos = currentPhotos.filter((p: any) => p.id !== photoId);

    if (currentPhotos.length === updatedPhotos.length) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    // Update deal_data
    await pool.query(
      `UPDATE deals 
       SET deal_data = jsonb_set(COALESCE(deal_data, '{}'), '{photos}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(updatedPhotos), dealId]
    );

    res.json({ success: true, total: updatedPhotos.length });
  } catch (error: any) {
    logger.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

// Update photo metadata
router.patch('/:dealId/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const { dealId, photoId } = req.params;
    const { label, caption } = req.body;
    const pool = getPool();

    // Get current photos
    const currentResult = await pool.query(
      `SELECT deal_data->'photos' as photos FROM deals WHERE id = $1`,
      [dealId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const currentPhotos = currentResult.rows[0].photos || [];
    const photoIndex = currentPhotos.findIndex((p: any) => p.id === photoId);

    if (photoIndex === -1) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    // Update photo metadata
    if (label !== undefined) currentPhotos[photoIndex].label = label;
    if (caption !== undefined) currentPhotos[photoIndex].caption = caption;
    currentPhotos[photoIndex].updatedAt = new Date().toISOString();

    // Update deal_data
    await pool.query(
      `UPDATE deals 
       SET deal_data = jsonb_set(COALESCE(deal_data, '{}'), '{photos}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(currentPhotos), dealId]
    );

    res.json({ success: true, photo: currentPhotos[photoIndex] });
  } catch (error: any) {
    logger.error('Error updating photo:', error);
    res.status(500).json({ success: false, error: 'Failed to update photo' });
  }
});

export default router;
