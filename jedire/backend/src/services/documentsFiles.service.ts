/**
 * Unified Documents & Files Service
 * Handles file uploads, versioning, categorization, and storage analytics
 * Context-aware for Pipeline (pre-purchase) vs Portfolio (post-purchase) deals
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';

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
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_TOTAL_STORAGE_PER_DEAL = 5 * 1024 * 1024 * 1024; // 5 GB

// Pipeline categories
const PIPELINE_CATEGORIES = [
  'acquisition',
  'financial-analysis',
  'due-diligence',
  'property-info',
  'correspondence',
  'financing',
  'legal-preliminary',
];

// Portfolio categories
const PORTFOLIO_CATEGORIES = [
  'legal',
  'financial',
  'leasing',
  'operations',
  'property-media',
  'marketing',
  'compliance',
  'maintenance',
  'tenant-files',
];

// Shared categories
const SHARED_CATEGORIES = ['contracts', 'reports', 'presentations', 'photos', 'other'];

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class DocumentsFilesService {
  /**
   * Upload a file for a deal with smart categorization
   */
  async uploadFile(options: FileUploadOptions): Promise<DealFile> {
    const { dealId, file, userId, folderPath = '/', tags = [] } = options;

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024} MB`);
      }

      // Check deal storage limit
      const analytics = await this.getStorageAnalytics(dealId);
      if (analytics && analytics.total_size_bytes + file.size > MAX_TOTAL_STORAGE_PER_DEAL) {
        throw new Error('Deal storage limit exceeded');
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;

      // Determine category (auto or manual)
      let category = options.category;
      let autoConfidence = null;

      if (!category) {
        const suggested = await this.suggestCategory(
          file.originalname,
          file.mimetype,
          dealId
        );
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
      let parentFileId = null;

      if (existingFile) {
        // Create new version
        version = existingFile.version + 1;
        parentFileId = existingFile.parent_file_id || existingFile.id;

        // Mark old version as not latest
        await supabase
          .from('deal_files')
          .update({ is_latest_version: false })
          .eq('id', existingFile.id);
      }

      // Insert file record
      const { data, error } = await supabase
        .from('deal_files')
        .insert({
          deal_id: dealId,
          filename: uniqueFilename,
          original_filename: file.originalname,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.mimetype,
          file_extension: fileExtension,
          category: category || 'other',
          folder_path: folderPath,
          tags,
          version,
          parent_file_id: parentFileId,
          is_latest_version: true,
          status: options.status || 'draft',
          is_required: options.isRequired || false,
          expiration_date: options.expirationDate || null,
          description: options.description || null,
          auto_category_confidence: autoConfidence,
          uploaded_by: userId,
          shared_with: [],
          is_public: false,
        })
        .select()
        .single();

      if (error) {
        // Clean up uploaded file on error
        await fs.unlink(filePath).catch(() => {});
        throw error;
      }

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
      let query = supabase
        .from('deal_files')
        .select('*')
        .eq('deal_id', dealId)
        .is('deleted_at', null);

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.folderPath) {
        query = query.eq('folder_path', filters.folderPath);
      }

      if (filters.onlyLatestVersions !== false) {
        query = query.eq('is_latest_version', true);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      // Full-text search
      if (filters.search) {
        query = query.or(
          `original_filename.ilike.%${filters.search}%,description.ilike.%${filters.search}%,extracted_text.ilike.%${filters.search}%`
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting files:', error);
      throw error;
    }
  }

  /**
   * Get a single file by ID
   */
  async getFileById(fileId: string): Promise<DealFile | null> {
    try {
      const { data, error } = await supabase
        .from('deal_files')
        .select('*')
        .eq('id', fileId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Error getting file:', error);
      throw error;
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    updates: Partial<Pick<DealFile, 'category' | 'folder_path' | 'tags' | 'description' | 'status' | 'is_required' | 'expiration_date' | 'version_notes'>>
  ): Promise<DealFile> {
    try {
      const { data, error } = await supabase
        .from('deal_files')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`File updated: ${fileId}`, { updates });

      return data;
    } catch (error) {
      logger.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file (soft delete)
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      // Soft delete
      const { error } = await supabase
        .from('deal_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);

      if (error) throw error;

      // Log access
      await this.logAccess(fileId, userId, 'deleted');

      logger.info(`File deleted: ${fileId}`);

      return true;
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Upload a new version of an existing file
   */
  async uploadNewVersion(
    existingFileId: string,
    file: Express.Multer.File,
    userId: string,
    versionNotes?: string
  ): Promise<DealFile> {
    try {
      const existingFile = await this.getFileById(existingFileId);
      if (!existingFile) {
        throw new Error('Original file not found');
      }

      return await this.uploadFile({
        dealId: existingFile.deal_id,
        file,
        userId,
        category: existingFile.category,
        folderPath: existingFile.folder_path,
        tags: existingFile.tags,
        description: existingFile.description || undefined,
        isRequired: existingFile.is_required,
        expirationDate: existingFile.expiration_date || undefined,
        status: existingFile.status,
      });
    } catch (error) {
      logger.error('Error uploading new version:', error);
      throw error;
    }
  }

  /**
   * Get version history for a file
   */
  async getVersionHistory(fileId: string): Promise<DealFile[]> {
    try {
      const file = await this.getFileById(fileId);
      if (!file) throw new Error('File not found');

      // Find the root parent
      const rootParentId = file.parent_file_id || file.id;

      // Get all versions
      const { data, error } = await supabase
        .from('deal_files')
        .select('*')
        .or(`id.eq.${rootParentId},parent_file_id.eq.${rootParentId}`)
        .is('deleted_at', null)
        .order('version', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting version history:', error);
      throw error;
    }
  }

  /**
   * Search files with full-text search
   */
  async searchFiles(dealId: string, query: string): Promise<DealFile[]> {
    return this.getFiles(dealId, { search: query });
  }

  /**
   * Get storage analytics for a deal
   */
  async getStorageAnalytics(dealId: string): Promise<StorageAnalytics | null> {
    try {
      const { data, error } = await supabase
        .from('deal_storage_analytics')
        .select('*')
        .eq('deal_id', dealId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore not found error

      return data;
    } catch (error) {
      logger.error('Error getting storage analytics:', error);
      throw error;
    }
  }

  /**
   * Smart category suggestion based on filename and deal context
   */
  async suggestCategory(
    filename: string,
    mimeType: string,
    dealId: string
  ): Promise<{ category: string; confidence: number }> {
    try {
      // Get deal to determine pipeline vs portfolio
      const { data: deal } = await supabase
        .from('deals')
        .select('category, stage')
        .eq('id', dealId)
        .single();

      const dealCategory = deal?.category || 'pipeline';

      // Get matching categorization rules
      const { data: rules } = await supabase
        .from('file_categorization_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!rules || rules.length === 0) {
        return { category: 'other', confidence: 0.5 };
      }

      // Test each rule
      for (const rule of rules) {
        // Check if rule applies to this deal category
        if (rule.deal_category && !rule.deal_category.includes(dealCategory)) {
          continue;
        }

        // Test filename pattern
        const filenameRegex = new RegExp(rule.filename_pattern);
        const filenameMatch = filenameRegex.test(filename);

        // Test MIME type if specified
        let mimeMatch = true;
        if (rule.mime_type_pattern) {
          const mimeRegex = new RegExp(rule.mime_type_pattern);
          mimeMatch = mimeRegex.test(mimeType);
        }

        if (filenameMatch && mimeMatch) {
          return {
            category: rule.suggested_category,
            confidence: rule.confidence_threshold || 0.75,
          };
        }
      }

      return { category: 'other', confidence: 0.5 };
    } catch (error) {
      logger.error('Error suggesting category:', error);
      return { category: 'other', confidence: 0.5 };
    }
  }

  /**
   * Get context-aware suggestions for missing files
   */
  async getMissingFileSuggestions(dealId: string): Promise<string[]> {
    try {
      const { data: deal } = await supabase
        .from('deals')
        .select('category, stage')
        .eq('id', dealId)
        .single();

      if (!deal) return [];

      const suggestions: string[] = [];

      // Pipeline-specific suggestions based on stage
      if (deal.category === 'pipeline') {
        if (deal.stage === 'UNDERWRITING') {
          suggestions.push(
            'Appraisal Report',
            'Rent Roll (T-12)',
            'Operating Statements',
            'Property Inspection Report',
            'Environmental Phase I'
          );
        } else if (deal.stage === 'LOI_SUBMITTED' || deal.stage === 'UNDER_CONTRACT') {
          suggestions.push(
            'Purchase & Sale Agreement',
            'Title Commitment',
            'Property Survey',
            'Loan Term Sheet'
          );
        }
      }

      // Portfolio-specific suggestions
      if (deal.category === 'portfolio') {
        suggestions.push(
          'Current Month P&L',
          'Active Lease Agreements',
          'Insurance Certificates',
          'Recent Inspection Reports'
        );
      }

      return suggestions;
    } catch (error) {
      logger.error('Error getting missing file suggestions:', error);
      return [];
    }
  }

  /**
   * Get file path for download
   */
  getFilePath(dealId: string, filename: string): string {
    return path.join(UPLOAD_BASE_PATH, 'deals', dealId, filename);
  }

  /**
   * Generate download URL
   */
  generateDownloadUrl(dealId: string, fileId: string): string {
    return `/api/v1/deals/${dealId}/files/${fileId}/download`;
  }

  /**
   * Find file by original filename (for versioning)
   */
  private async findFileByOriginalName(
    dealId: string,
    originalFilename: string
  ): Promise<DealFile | null> {
    try {
      const { data, error } = await supabase
        .from('deal_files')
        .select('*')
        .eq('deal_id', dealId)
        .eq('original_filename', originalFilename)
        .eq('is_latest_version', true)
        .is('deleted_at', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Log file access
   */
  private async logAccess(
    fileId: string,
    userId: string,
    action: 'viewed' | 'downloaded' | 'shared' | 'deleted' | 'uploaded' | 'edited'
  ): Promise<void> {
    try {
      await supabase.from('deal_file_access_log').insert({
        file_id: fileId,
        user_id: userId,
        action,
      });
    } catch (error) {
      logger.error('Error logging file access:', error);
      // Don't throw - logging should not break main functionality
    }
  }

  /**
   * Get available categories for a deal (context-aware)
   */
  async getAvailableCategories(dealId: string): Promise<string[]> {
    try {
      const { data: deal } = await supabase
        .from('deals')
        .select('category')
        .eq('id', dealId)
        .single();

      if (!deal) return SHARED_CATEGORIES;

      if (deal.category === 'pipeline') {
        return [...PIPELINE_CATEGORIES, ...SHARED_CATEGORIES];
      } else {
        return [...PORTFOLIO_CATEGORIES, ...SHARED_CATEGORIES];
      }
    } catch (error) {
      logger.error('Error getting available categories:', error);
      return SHARED_CATEGORIES;
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const documentsFilesService = new DocumentsFilesService();
