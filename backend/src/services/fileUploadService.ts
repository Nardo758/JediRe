/**
 * File Upload Service
 * Handles local filesystem storage for note attachments
 * Maximum 50 MB total per note
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import {
  FileUploadInput,
  FileUploadResult,
  Attachment,
} from '../types/assetMapIntelligence.types';
import {
  validateFileUpload,
  generateUniqueFilename,
  getFileCategory,
} from '../utils/fileValidation';

class FileUploadService {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    // Use environment variable or default to uploads directory
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'note-attachments');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info(`Upload directory ready: ${this.uploadDir}`);
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
      throw new Error('Upload directory initialization failed');
    }
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    input: FileUploadInput,
    userId: string,
    currentTotalSize: number = 0
  ): Promise<FileUploadResult> {
    // Validate file
    const validation = await validateFileUpload(
      input.file,
      input.filename,
      input.mimeType,
      currentTotalSize
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(input.filename, userId);
    const filePath = path.join(this.uploadDir, uniqueFilename);

    try {
      // Write file to disk
      await fs.writeFile(filePath, input.file);

      // Generate URL
      const url = `${this.baseUrl}/uploads/note-attachments/${uniqueFilename}`;

      logger.info(`File uploaded successfully: ${uniqueFilename} (${input.size} bytes)`);

      return {
        url,
        filename: uniqueFilename,
        size: input.size,
        mimeType: input.mimeType,
      };
    } catch (error) {
      logger.error('Failed to write file:', error);
      throw new Error('Failed to save file');
    }
  }

  /**
   * Upload multiple files for a note
   */
  async uploadMultipleFiles(
    files: FileUploadInput[],
    userId: string,
    currentTotalSize: number = 0
  ): Promise<Attachment[]> {
    const attachments: Attachment[] = [];
    let totalSize = currentTotalSize;

    for (const file of files) {
      const result = await this.uploadFile(file, userId, totalSize);

      attachments.push({
        type: getFileCategory(file.mimeType),
        url: result.url,
        name: file.filename,
        size: result.size,
        mimeType: result.mimeType,
        uploadedAt: new Date(),
      });

      totalSize += result.size;
    }

    return attachments;
  }

  /**
   * Delete a file
   */
  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.uploadDir, filename);

    try {
      await fs.unlink(filePath);
      logger.info(`File deleted successfully: ${filename}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`File not found for deletion: ${filename}`);
      } else {
        logger.error('Failed to delete file:', error);
        throw new Error('Failed to delete file');
      }
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(attachments: Attachment[]): Promise<void> {
    for (const attachment of attachments) {
      try {
        // Extract filename from URL
        const filename = path.basename(attachment.url);
        await this.deleteFile(filename);
      } catch (error) {
        logger.error(`Failed to delete attachment: ${attachment.url}`, error);
        // Continue with other files
      }
    }
  }

  /**
   * Get file path from URL
   */
  getFilePathFromUrl(url: string): string {
    const filename = path.basename(url);
    return path.join(this.uploadDir, filename);
  }

  /**
   * Check if file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.uploadDir, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filename: string): Promise<{ size: number; createdAt: Date } | null> {
    const filePath = path.join(this.uploadDir, filename);
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        createdAt: stats.birthtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Clean up orphaned files (files not referenced in database)
   * Should be run periodically as a maintenance task
   */
  async cleanupOrphanedFiles(referencedFilenames: string[]): Promise<number> {
    try {
      const files = await fs.readdir(this.uploadDir);
      let deletedCount = 0;

      for (const file of files) {
        // Extract original filename pattern from generated filename
        if (!referencedFilenames.includes(file)) {
          await this.deleteFile(file);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} orphaned files`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup orphaned files:', error);
      return 0;
    }
  }

  /**
   * Get total size of all files in upload directory
   */
  async getTotalStorageUsed(): Promise<number> {
    try {
      const files = await fs.readdir(this.uploadDir);
      let totalSize = 0;

      for (const file of files) {
        const stats = await this.getFileStats(file);
        if (stats) {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to calculate total storage:', error);
      return 0;
    }
  }
}

export const fileUploadService = new FileUploadService();
