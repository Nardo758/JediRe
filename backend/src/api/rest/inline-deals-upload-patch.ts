/**
 * PATCH FOR inline-deals.routes.ts
 * Add this code to enable document uploads
 * 
 * INSTRUCTIONS:
 * 1. First run: npm install multer @types/multer
 * 2. Add these imports at the top of inline-deals.routes.ts
 * 3. Add the upload route before "export default router"
 */

// ========== ADD TO TOP OF FILE (IMPORTS) ==========
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Configure multer for deal documents
const DEAL_UPLOAD_DIR = path.join(__dirname, '../../uploads/deals');

// Ensure upload directory exists
if (!fs.existsSync(DEAL_UPLOAD_DIR)) {
  fs.mkdirSync(DEAL_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DEAL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

const dealDocumentUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/plain',
      'text/csv',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT, CSV allowed.'));
    }
  }
});

// ========== ADD THIS ROUTE BEFORE "export default router" ==========

/**
 * POST /api/v1/deals/upload-document
 * Upload a document for a deal
 * 
 * Body: multipart/form-data
 * - file: The document file
 * - dealId: (optional) UUID of the deal
 * - documentType: (optional) Type of document (financial, legal, site_plan, general)
 * - description: (optional) Document description
 */
router.post('/upload-document', requireAuth, dealDocumentUpload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const { dealId, documentType, description } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Create document metadata
    const documentInfo = {
      id: crypto.randomBytes(16).toString('hex'),
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      relativePath: `/uploads/deals/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      dealId: dealId || null,
      documentType: documentType || 'general',
      description: description || '',
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user!.userId,
    };

    // Optional: Store in database if deal_documents table exists
    try {
      const client = req.dbClient || pool;
      await client.query(`
        INSERT INTO deal_documents (
          id, deal_id, user_id, filename, original_name, file_path,
          file_size, mime_type, document_type, description, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT DO NOTHING
      `, [
        documentInfo.id,
        documentInfo.dealId,
        documentInfo.uploadedBy,
        documentInfo.filename,
        documentInfo.originalName,
        documentInfo.path,
        documentInfo.size,
        documentInfo.mimeType,
        documentInfo.documentType,
        documentInfo.description
      ]);
    } catch (dbError) {
      // Silently ignore if table doesn't exist yet
      console.log('deal_documents table not found, skipping DB insert');
    }

    res.json({
      success: true,
      document: documentInfo,
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up file if it was uploaded
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload document'
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/documents
 * Get all documents for a deal
 */
router.get('/:dealId/documents', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const client = req.dbClient || pool;

    const result = await client.query(`
      SELECT 
        id, filename, original_name as "originalName", file_path as "filePath",
        file_size as "fileSize", mime_type as "mimeType", 
        document_type as "documentType", description,
        uploaded_at as "uploadedAt"
      FROM deal_documents
      WHERE deal_id = $1 AND user_id = $2
      ORDER BY uploaded_at DESC
    `, [dealId, req.user!.userId]);

    res.json({
      success: true,
      documents: result.rows
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      documents: [],
      error: 'Failed to fetch documents'
    });
  }
});

/**
 * DELETE /api/v1/deals/documents/:documentId
 * Delete a document
 */
router.delete('/documents/:documentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { documentId } = req.params;
    const client = req.dbClient || pool;

    // Get file path before deleting
    const result = await client.query(`
      SELECT file_path FROM deal_documents
      WHERE id = $1 AND user_id = $2
    `, [documentId, req.user!.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const filePath = result.rows[0].file_path;

    // Delete from database
    await client.query(`
      DELETE FROM deal_documents
      WHERE id = $1 AND user_id = $2
    `, [documentId, req.user!.userId]);

    // Delete physical file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});
