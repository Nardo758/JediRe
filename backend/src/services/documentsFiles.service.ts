/**
 * Unified Documents & Files Service
 * Handles file uploads, versioning, categorization, and storage analytics
 * Context-aware for Pipeline (pre-purchase) vs Portfolio (post-purchase) deals
 */

import { query } from '../database/connection';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface DealFile {
  id: string;
  deal_id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_extension: string;
  category: string;
  folder_path: string;
  tags: string[];
  version: number;
  parent_file_id: string | null;
  is_latest_version: boolean;
  version_notes: string | null;
  status: 'draft' | 'final' | 'archived' | 'expired' | 'pending-review';
  is_required: boolean;
  expiration_date: Date | null;
  description: string | null;
  auto_category_confidence: number | null;
  extracted_text: string | null;
  thumbnail_path: string | null;
  uploaded_by: string;
  shared_with: string[];
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface FileUploadOptions {
  dealId: string;
  file: Express.Multer.File;
  userId: string;
  category?: string;
  folderPath?: string;
  tags?: string[];
  description?: string;
  isRequired?: boolean;
  expirationDate?: Date;
  status?: string;
}

export interface FileFilters {
  category?: string;
  status?: string;
  folderPath?: string;
  tags?: string[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  onlyLatestVersions?: boolean;
}

export interface StorageAnalytics {
  deal_id: string;
  total_files: number;
  total_size_bytes: number;
  files_by_category: Record<string, number>;
  size_by_category: Record<string, number>;
  total_versions: number;
  files_with_versions: number;
  files_uploaded_last_7d: number;
  files_uploaded_last_30d: number;
  most_active_uploader_id: string;
  required_files_count: number;
  missing_required_files: string[];
  expired_files_count: number;
  computed_at: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const UPLOAD_BASE_PATH = process.env.UPLOAD_PATH || './uploads';

// Category mappings for auto-detection
const CATEGORY_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /t12|trailing|income.statement|p&l|profit.loss/i, category: 'financial' },
  { pattern: /rent.roll|unit.mix|lease/i, category: 'financial' },
  { pattern: /bpi|financial.package|balance.sheet|cash.flow|general.ledger/i, category: 'financial' },
  { pattern: /appraisal|valuation/i, category: 'appraisals' },
  { pattern: /pca|property.condition|inspection|due.diligence/i, category: 'inspections' },
  { pattern: /phase|environmental|esa/i, category: 'environmental' },
  { pattern: /insurance|policy|certificate/i, category: 'insurance' },
  { pattern: /psa|purchase|contract|agreement|legal/i, category: 'legal' },
  { pattern: /permit|zoning|entitlement/i, category: 'permits' },
  { pattern: /om|offering.memorandum|marketing/i, category: 'marketing' },
];

// ============================================================================
// SERVICE CLASS
// ============================================================================

class DocumentsFilesService {
  /**
   * Upload a file for a deal
   */
  async uploadFile(options: FileUploadOptions): Promise<DealFile> {
    const { dealId, file, userId, folderPath = '/', tags = [] } = options;

    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;

      // Determine category (auto or manual)
      let category = options.category;
      let autoConfidence: number | null = null;

      if (!category) {
        const suggested = this.suggestCategory(file.originalname);
        category = suggested.category;
        autoConfidence = suggested.confidence;
      }

      // Create deal-specific upload directory
      const dealUploadPath = path.join(UPLOAD_BASE_PATH, 'deals', dealId);
      await fs.mkdir(dealUploadPath, { recursive: true });

      // Move file to final location
      const filePath = path.join(dealUploadPath, uniqueFilename);
      await fs.rename(file.path, filePath);

      // Check for duplicate filename and handle versioning
      const existingFile = await this.findFileByOriginalName(dealId, file.originalname);
      let version = 1;
      let parentFileId: string | null = null;

      if (existingFile) {
        // Create new version
        version = existingFile.version + 1;
        parentFileId = existingFile.parent_file_id || existingFile.id;

        // Mark old version as not latest
        await query(
          'UPDATE deal_files SET is_latest_version = false WHERE id = $1',
          [existingFile.id]
        );
      }

      // Insert file record
      const result = await query(
        `INSERT INTO deal_files (
          deal_id, filename, original_filename, file_path, file_size,
          mime_type, file_extension, category, folder_path, tags,
          version, parent_file_id, is_latest_version, status,
          is_required, expiration_date, description, auto_category_confidence,
          uploaded_by, shared_with, is_public
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21
        ) RETURNING *`,
        [
          dealId, uniqueFilename, file.originalname, filePath, file.size,
          file.mimetype, fileExtension, category || 'other', folderPath, tags,
          version, parentFileId, true, options.status || 'draft',
          options.isRequired || false, options.expirationDate || null, options.description || null, autoConfidence,
          userId, [], false
        ]
      );

      const data = result.rows[0];

      // Log access
      await this.logAccess(data.id, userId, 'uploaded');

      logger.info(`File uploaded: ${file.originalname}`, {
        dealId,
        fileId: data.id,
        category,
        version,
      });

      return data;
    } catch (error) {
      logger.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Get files for a deal with filters
   */
  async getFiles(dealId: string, filters: FileFilters = {}): Promise<DealFile[]> {
    try {
      let sql = `
        SELECT * FROM deal_files 
        WHERE deal_id = $1 AND deleted_at IS NULL
      `;
      const params: any[] = [dealId];
      let paramIndex = 2;

      if (filters.category) {
        sql += ` AND category = $${paramIndex++}`;
        params.push(filters.category);
      }

      if (filters.status) {
        sql += ` AND status = $${paramIndex++}`;
        params.push(filters.status);
      }

      if (filters.folderPath) {
        sql += ` AND folder_path = $${paramIndex++}`;
        params.push(filters.folderPath);
      }

      if (filters.onlyLatestVersions !== false) {
        sql += ` AND is_latest_version = true`;
      }

      if (filters.search) {
        sql += ` AND (original_filename ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern);
      }

      if (filters.dateFrom) {
        sql += ` AND created_at >= $${paramIndex++}`;
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        sql += ` AND created_at <= $${paramIndex++}`;
        params.push(filters.dateTo);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting files:', error);
      throw error;
    }
  }

  /**
   * Get a single file by ID
   */
  async getFile(fileId: string): Promise<DealFile | null> {
    try {
      const result = await query(
        'SELECT * FROM deal_files WHERE id = $1 AND deleted_at IS NULL',
        [fileId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting file:', error);
      throw error;
    }
  }

  /**
   * Find file by original name (for versioning)
   */
  async findFileByOriginalName(dealId: string, originalFilename: string): Promise<DealFile | null> {
    try {
      const result = await query(
        `SELECT * FROM deal_files 
         WHERE deal_id = $1 AND original_filename = $2 
         AND is_latest_version = true AND deleted_at IS NULL
         LIMIT 1`,
        [dealId, originalFilename]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding file by name:', error);
      throw error;
    }
  }

  /**
   * Delete a file (soft delete)
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      await query(
        'UPDATE deal_files SET deleted_at = NOW() WHERE id = $1',
        [fileId]
      );
      await this.logAccess(fileId, userId, 'deleted');
      logger.info(`File deleted: ${fileId}`);
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(fileId: string, updates: Partial<DealFile>): Promise<DealFile> {
    try {
      const allowedFields = ['category', 'description', 'tags', 'status', 'is_required', 'expiration_date', 'folder_path'];
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (updates[field as keyof DealFile] !== undefined) {
          setClauses.push(`${field} = $${paramIndex++}`);
          params.push(updates[field as keyof DealFile]);
        }
      }

      if (setClauses.length === 0) {
        const existing = await this.getFile(fileId);
        if (!existing) throw new Error('File not found');
        return existing;
      }

      params.push(fileId);
      const result = await query(
        `UPDATE deal_files SET ${setClauses.join(', ')}, updated_at = NOW() 
         WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileId: string): Promise<DealFile[]> {
    try {
      // First get the file to find its parent chain
      const file = await this.getFile(fileId);
      if (!file) return [];

      const rootId = file.parent_file_id || file.id;

      const result = await query(
        `SELECT * FROM deal_files 
         WHERE (id = $1 OR parent_file_id = $1) AND deleted_at IS NULL
         ORDER BY version DESC`,
        [rootId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting file versions:', error);
      throw error;
    }
  }

  /**
   * Log file access for audit trail
   */
  async logAccess(
    fileId: string,
    userId: string,
    action: 'viewed' | 'downloaded' | 'uploaded' | 'deleted' | 'shared' | 'version_created',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO deal_file_access_log (file_id, user_id, action, metadata)
         VALUES ($1, $2, $3, $4)`,
        [fileId, userId, action, JSON.stringify(metadata)]
      );
    } catch (error) {
      // Don't throw on logging errors
      logger.warn('Failed to log file access:', error);
    }
  }

  /**
   * Auto-suggest category based on filename
   */
  suggestCategory(filename: string): { category: string; confidence: number } {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(filename)) {
        return { category, confidence: 0.85 };
      }
    }
    return { category: 'other', confidence: 0.5 };
  }

  /**
   * Get storage analytics for a deal
   */
  async getStorageAnalytics(dealId: string): Promise<StorageAnalytics> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_files,
          COALESCE(SUM(file_size), 0) as total_size,
          COUNT(*) FILTER (WHERE version > 1) as files_with_versions,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as files_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as files_30d,
          COUNT(*) FILTER (WHERE is_required = true) as required_count,
          COUNT(*) FILTER (WHERE expiration_date < NOW()) as expired_count
        FROM deal_files
        WHERE deal_id = $1 AND deleted_at IS NULL AND is_latest_version = true`,
        [dealId]
      );

      const stats = result.rows[0];

      // Get category breakdown
      const categoryResult = await query(
        `SELECT category, COUNT(*) as count, COALESCE(SUM(file_size), 0) as size
         FROM deal_files 
         WHERE deal_id = $1 AND deleted_at IS NULL AND is_latest_version = true
         GROUP BY category`,
        [dealId]
      );

      const filesByCategory: Record<string, number> = {};
      const sizeByCategory: Record<string, number> = {};
      for (const row of categoryResult.rows) {
        filesByCategory[row.category] = parseInt(row.count);
        sizeByCategory[row.category] = parseInt(row.size);
      }

      return {
        deal_id: dealId,
        total_files: parseInt(stats.total_files),
        total_size_bytes: parseInt(stats.total_size),
        files_by_category: filesByCategory,
        size_by_category: sizeByCategory,
        total_versions: 0, // Would need separate query
        files_with_versions: parseInt(stats.files_with_versions),
        files_uploaded_last_7d: parseInt(stats.files_7d),
        files_uploaded_last_30d: parseInt(stats.files_30d),
        most_active_uploader_id: '', // Would need separate query
        required_files_count: parseInt(stats.required_count),
        missing_required_files: [],
        expired_files_count: parseInt(stats.expired_count),
        computed_at: new Date(),
      };
    } catch (error) {
      logger.error('Error getting storage analytics:', error);
      throw error;
    }
  }
}

export const documentsFilesService = new DocumentsFilesService();
export default documentsFilesService;
