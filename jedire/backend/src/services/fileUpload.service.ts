/**
 * File Upload Service
 * Handles file uploads for Asset Map Intelligence note attachments
 * - Local filesystem storage
 * - 50 MB total limit per note
 * - File type validation
 * - Virus scanning placeholder
 * - Filename sanitization
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Allowed file types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // PDFs
  'application/pdf',
  // Office documents
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  // Text files
  'text/plain',
  'text/csv',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.txt', '.csv'
];

// 50 MB max per note (total of all attachments)
const MAX_TOTAL_SIZE_PER_NOTE = 50 * 1024 * 1024; // 50 MB in bytes
const MAX_SINGLE_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file

// Storage configuration
const UPLOAD_BASE_DIR = path.join(__dirname, '../../uploads/notes');

export interface FileUploadMetadata {
  originalName: string;
  sanitizedName: string;
  storagePath: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  assetId: string;
  noteId: string;
}

export class FileUploadService {
  private uploadDir: string;

  constructor(uploadBaseDir: string = UPLOAD_BASE_DIR) {
    this.uploadDir = uploadBaseDir;
    this.ensureUploadDirectoryExists();
  }

  /**
   * Ensure the upload directory exists
   */
  private ensureUploadDirectoryExists(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Sanitize filename to prevent path traversal and special characters
   */
  public sanitizeFilename(filename: string): string {
    // Remove path components
    const basename = path.basename(filename);
    
    // Remove non-alphanumeric characters except dots, dashes, and underscores
    const sanitized = basename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    
    // If filename is empty after sanitization, generate a random one
    if (!sanitized || sanitized === '') {
      const ext = path.extname(basename);
      return `file_${Date.now()}${ext}`;
    }
    
    return sanitized;
  }

  /**
   * Generate unique filename with timestamp and random hash
   */
  private generateUniqueFilename(originalFilename: string): string {
    const sanitized = this.sanitizeFilename(originalFilename);
    const ext = path.extname(sanitized);
    const nameWithoutExt = path.basename(sanitized, ext);
    const hash = crypto.randomBytes(6).toString('hex');
    const timestamp = Date.now();
    
    return `${nameWithoutExt}_${timestamp}_${hash}${ext}`;
  }

  /**
   * Get storage path for a note's attachments
   */
  public getNotePath(assetId: string, noteId: string): string {
    return path.join(this.uploadDir, assetId, noteId);
  }

  /**
   * Validate file type
   */
  public isFileTypeAllowed(mimetype: string, filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_MIME_TYPES.includes(mimetype) && ALLOWED_EXTENSIONS.includes(ext);
  }

  /**
   * Get total size of all attachments for a note
   */
  public async getTotalNoteAttachmentSize(assetId: string, noteId: string): Promise<number> {
    const notePath = this.getNotePath(assetId, noteId);
    
    if (!fs.existsSync(notePath)) {
      return 0;
    }

    const files = fs.readdirSync(notePath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(notePath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }

  /**
   * Check if adding new files would exceed the note's size limit
   */
  public async canAddFiles(assetId: string, noteId: string, newFilesSizes: number[]): Promise<boolean> {
    const currentSize = await this.getTotalNoteAttachmentSize(assetId, noteId);
    const newFilesTotalSize = newFilesSizes.reduce((sum, size) => sum + size, 0);
    return (currentSize + newFilesTotalSize) <= MAX_TOTAL_SIZE_PER_NOTE;
  }

  /**
   * Placeholder for virus scanning
   * TODO: Integrate with ClamAV or similar antivirus service
   */
  private async scanFileForViruses(filePath: string): Promise<boolean> {
    // Placeholder - always returns true for now
    // In production, integrate with antivirus service:
    // - ClamAV
    // - VirusTotal API
    // - AWS S3 scanning
    logger.info(`[TODO] Virus scan for file: ${filePath}`);
    return true;
  }

  /**
   * Create Multer storage configuration
   */
  public createMulterStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: (req: Request, file: Express.Multer.File, cb) => {
        const assetId = req.params.assetId || req.body.assetId;
        const noteId = req.params.noteId || req.body.noteId;

        if (!assetId || !noteId) {
          return cb(new Error('assetId and noteId are required'), '');
        }

        const notePath = this.getNotePath(assetId, noteId);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(notePath)) {
          fs.mkdirSync(notePath, { recursive: true });
        }

        cb(null, notePath);
      },
      filename: (req: Request, file: Express.Multer.File, cb) => {
        const uniqueFilename = this.generateUniqueFilename(file.originalname);
        cb(null, uniqueFilename);
      },
    });
  }

  /**
   * Create Multer file filter
   */
  public createFileFilter(): multer.Options['fileFilter'] {
    return (req: Request, file: Express.Multer.File, cb) => {
      if (!this.isFileTypeAllowed(file.mimetype, file.originalname)) {
        return cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: images, PDFs, Office documents.`));
      }
      cb(null, true);
    };
  }

  /**
   * Create configured Multer instance
   */
  public createUploadMiddleware(): multer.Multer {
    return multer({
      storage: this.createMulterStorage(),
      fileFilter: this.createFileFilter(),
      limits: {
        fileSize: MAX_SINGLE_FILE_SIZE,
        files: 10, // Max 10 files per upload
      },
    });
  }

  /**
   * Delete a file
   */
  public async deleteFile(assetId: string, noteId: string, filename: string): Promise<boolean> {
    try {
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(this.getNotePath(assetId, noteId), sanitizedFilename);
      
      // Verify the path is within the allowed directory
      const resolvedPath = path.resolve(filePath);
      const resolvedBaseDir = path.resolve(this.getNotePath(assetId, noteId));
      
      if (!resolvedPath.startsWith(resolvedBaseDir)) {
        logger.error(`Path traversal attempt detected: ${filename}`);
        return false;
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted file: ${filePath}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Delete all attachments for a note
   */
  public async deleteNoteAttachments(assetId: string, noteId: string): Promise<boolean> {
    try {
      const notePath = this.getNotePath(assetId, noteId);
      
      if (fs.existsSync(notePath)) {
        fs.rmSync(notePath, { recursive: true, force: true });
        logger.info(`Deleted all attachments for note: ${noteId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deleting note attachments:', error);
      return false;
    }
  }

  /**
   * Get file path for download
   */
  public getFilePath(assetId: string, noteId: string, filename: string): string | null {
    try {
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(this.getNotePath(assetId, noteId), sanitizedFilename);
      
      // Verify the path is within the allowed directory
      const resolvedPath = path.resolve(filePath);
      const resolvedBaseDir = path.resolve(this.getNotePath(assetId, noteId));
      
      if (!resolvedPath.startsWith(resolvedBaseDir)) {
        logger.error(`Path traversal attempt detected: ${filename}`);
        return null;
      }

      if (fs.existsSync(filePath)) {
        return filePath;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting file path:', error);
      return null;
    }
  }

  /**
   * List all attachments for a note
   */
  public async listNoteAttachments(assetId: string, noteId: string): Promise<FileUploadMetadata[]> {
    const notePath = this.getNotePath(assetId, noteId);
    
    if (!fs.existsSync(notePath)) {
      return [];
    }

    const files = fs.readdirSync(notePath);
    const attachments: FileUploadMetadata[] = [];

    for (const file of files) {
      const filePath = path.join(notePath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        attachments.push({
          originalName: file,
          sanitizedName: file,
          storagePath: filePath,
          size: stats.size,
          mimeType: this.getMimeType(file),
          uploadedAt: stats.birthtime,
          assetId,
          noteId,
        });
      }
    }

    return attachments;
  }

  /**
   * Get MIME type from filename extension
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate secure download URL
   */
  public generateDownloadUrl(assetId: string, noteId: string, filename: string): string {
    const sanitizedFilename = encodeURIComponent(path.basename(filename));
    return `/api/v1/files/notes/${assetId}/${noteId}/${sanitizedFilename}`;
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();
export const uploadMiddleware = fileUploadService.createUploadMiddleware();
