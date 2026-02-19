/**
 * Module Library Service
 * 
 * Handles file uploads, parsing, and pattern detection for module libraries.
 * Mocks Opus learning initially; will integrate with real Opus API later.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import db from '../database/connection';

export interface UploadFileParams {
  userId: number;
  module: string;
  category: string;
  file: {
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
}

export interface ModuleLibraryFile {
  id: number;
  userId: number;
  moduleName: string;
  category: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedAt: Date;
  parsingStatus: 'pending' | 'parsing' | 'complete' | 'error';
  parsedAt?: Date;
  parsingErrors?: string;
}

export interface LearnedPattern {
  id: number;
  patternType: string;
  patternValue: any;
  sourceFileIds: number[];
  confidenceScore: number;
  sampleSize: number;
}

export interface LearningStatus {
  filesAnalyzed: number;
  totalFiles: number;
  patterns: LearnedPattern[];
  templates: any[];
}

class ModuleLibraryService {
  private uploadDir = process.env.UPLOAD_DIR || '/tmp/jedire-uploads';

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Upload a file to module library
   */
  async uploadFile(params: UploadFileParams): Promise<ModuleLibraryFile> {
    const { userId, module, category, file } = params;

    try {
      // Create user-specific subdirectory
      const userDir = path.join(this.uploadDir, `user_${userId}`, module);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${sanitizedName}`;
      const filePath = path.join(userDir, filename);

      // Save file
      fs.writeFileSync(filePath, file.buffer);
      logger.info(`[ModuleLibrary] File saved: ${filePath}`);

      // Insert into database
      const result = await db.query(`
        INSERT INTO module_library_files (
          user_id, module_name, category, file_name, file_path, 
          file_size, mime_type, uploaded_by, parsing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING *
      `, [
        userId,
        module,
        category,
        file.originalname,
        filePath,
        file.size,
        file.mimetype,
        userId,
      ]);

      const dbFile = result.rows[0];

      // Trigger async parsing for Excel files
      if (this.isExcelFile(file.mimetype)) {
        this.parseExcelFileAsync(dbFile.id);
      }

      return this.mapDbFileToModel(dbFile);
    } catch (error) {
      logger.error('[ModuleLibrary] Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Get files in a module library
   */
  async getFiles(userId: number, module: string, category?: string): Promise<ModuleLibraryFile[]> {
    try {
      let query = `
        SELECT * FROM module_library_files
        WHERE user_id = $1 AND module_name = $2
      `;
      const params: any[] = [userId, module];

      if (category) {
        query += ` AND category = $3`;
        params.push(category);
      }

      query += ` ORDER BY uploaded_at DESC`;

      const result = await db.query(query, params);
      return result.rows.map(this.mapDbFileToModel);
    } catch (error) {
      logger.error('[ModuleLibrary] Error fetching files:', error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId: number): Promise<ModuleLibraryFile | null> {
    try {
      const result = await db.query(
        'SELECT * FROM module_library_files WHERE id = $1',
        [fileId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDbFileToModel(result.rows[0]);
    } catch (error) {
      logger.error('[ModuleLibrary] Error fetching file:', error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: number, userId: number): Promise<boolean> {
    try {
      // Get file info
      const file = await this.getFileById(fileId);
      if (!file || file.userId !== userId) {
        return false;
      }

      // Delete from filesystem
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }

      // Delete from database
      await db.query('DELETE FROM module_library_files WHERE id = $1', [fileId]);

      logger.info(`[ModuleLibrary] File deleted: ${fileId}`);
      return true;
    } catch (error) {
      logger.error('[ModuleLibrary] Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get learning status for a module
   */
  async getLearningStatus(userId: number, module: string): Promise<LearningStatus> {
    try {
      // Get file counts
      const filesResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN parsing_status = 'complete' THEN 1 ELSE 0 END) as analyzed
        FROM module_library_files
        WHERE user_id = $1 AND module_name = $2
      `, [userId, module]);

      const { total, analyzed } = filesResult.rows[0];

      // Get learned patterns
      const patternsResult = await db.query(`
        SELECT 
          id, pattern_type, pattern_value, source_file_ids,
          confidence_score, sample_size
        FROM opus_learned_patterns
        WHERE user_id = $1 AND module_name = $2
        ORDER BY detected_at DESC
      `, [userId, module]);

      const patterns = patternsResult.rows.map(row => ({
        id: row.id,
        patternType: row.pattern_type,
        patternValue: row.pattern_value,
        sourceFileIds: row.source_file_ids,
        confidenceScore: parseFloat(row.confidence_score),
        sampleSize: row.sample_size,
      }));

      // Get learned templates
      const templatesResult = await db.query(`
        SELECT 
          id, template_name, property_type, measurement_unit,
          structure_schema, formula_patterns, usage_count
        FROM opus_template_structures
        WHERE user_id = $1 AND module_name = $2
        ORDER BY usage_count DESC
      `, [userId, module]);

      const templates = templatesResult.rows.map(row => ({
        id: row.id,
        templateName: row.template_name,
        propertyType: row.property_type,
        measurementUnit: row.measurement_unit,
        structureSchema: row.structure_schema,
        formulaPatterns: row.formula_patterns,
        usageCount: row.usage_count,
      }));

      return {
        filesAnalyzed: parseInt(analyzed) || 0,
        totalFiles: parseInt(total) || 0,
        patterns,
        templates,
      };
    } catch (error) {
      logger.error('[ModuleLibrary] Error fetching learning status:', error);
      throw error;
    }
  }

  /**
   * Parse Excel file (async, mocked initially)
   */
  private async parseExcelFileAsync(fileId: number): Promise<void> {
    try {
      // Update status to parsing
      await db.query(
        `UPDATE module_library_files 
         SET parsing_status = 'parsing' 
         WHERE id = $1`,
        [fileId]
      );

      // Simulate parsing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get file info
      const file = await this.getFileById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Mock pattern detection
      const patterns = this.mockPatternDetection(file);

      // Save patterns to database
      for (const pattern of patterns) {
        await db.query(`
          INSERT INTO opus_learned_patterns (
            user_id, module_name, pattern_type, pattern_value,
            source_file_ids, confidence_score, sample_size
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          file.userId,
          file.moduleName,
          pattern.type,
          JSON.stringify(pattern.value),
          [fileId],
          pattern.confidence,
          1,
        ]);
      }

      // Update status to complete
      await db.query(
        `UPDATE module_library_files 
         SET parsing_status = 'complete', parsed_at = NOW() 
         WHERE id = $1`,
        [fileId]
      );

      logger.info(`[ModuleLibrary] File parsed successfully: ${fileId}`);
    } catch (error) {
      logger.error(`[ModuleLibrary] Error parsing file ${fileId}:`, error);

      // Update status to error
      await db.query(
        `UPDATE module_library_files 
         SET parsing_status = 'error', parsing_errors = $2 
         WHERE id = $1`,
        [fileId, (error as Error).message]
      );
    }
  }

  /**
   * Mock pattern detection (to be replaced with real Opus integration)
   */
  private mockPatternDetection(file: ModuleLibraryFile): any[] {
    const patterns: any[] = [];

    if (file.moduleName === 'financial') {
      patterns.push(
        {
          type: 'opex_per_unit',
          value: { avg: 5200, min: 4800, max: 5800, unit: '$/unit/year' },
          confidence: 0.75,
        },
        {
          type: 'rent_growth',
          value: { avg: 0.042, min: 0.03, max: 0.055, unit: 'annual %' },
          confidence: 0.80,
        },
        {
          type: 'cap_rate',
          value: { avg: 0.055, min: 0.045, max: 0.065, unit: '%' },
          confidence: 0.70,
        }
      );
    } else if (file.moduleName === 'market') {
      patterns.push(
        {
          type: 'vacancy_rate',
          value: { avg: 0.06, min: 0.04, max: 0.08, unit: '%' },
          confidence: 0.65,
        },
        {
          type: 'market_rent_growth',
          value: { avg: 0.038, min: 0.02, max: 0.05, unit: 'annual %' },
          confidence: 0.72,
        }
      );
    }

    return patterns;
  }

  /**
   * Helper: Check if file is Excel
   */
  private isExcelFile(mimetype: string): boolean {
    return [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    ].includes(mimetype);
  }

  /**
   * Helper: Map database row to model
   */
  private mapDbFileToModel(row: any): ModuleLibraryFile {
    return {
      id: row.id,
      userId: row.user_id,
      moduleName: row.module_name,
      category: row.category,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      parsingStatus: row.parsing_status,
      parsedAt: row.parsed_at,
      parsingErrors: row.parsing_errors,
    };
  }
}

export const moduleLibraryService = new ModuleLibraryService();
