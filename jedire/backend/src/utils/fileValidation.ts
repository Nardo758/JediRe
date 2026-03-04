/**
 * File Upload and Validation Utilities
 * Handles file type validation, size limits, and virus scanning
 */

import path from 'path';
import { logger } from './logger';
import { FileValidationResult } from '../types/assetMapIntelligence.types';

// Maximum file size: 50 MB
export const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB in bytes
export const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file

// Allowed file types and MIME types
export const ALLOWED_FILE_TYPES = {
  images: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
  },
  documents: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
    ],
  },
  spreadsheets: {
    extensions: ['.xls', '.xlsx', '.csv'],
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
  },
};

/**
 * Validate file type by extension and MIME type
 */
export function validateFileType(filename: string, mimeType: string): FileValidationResult {
  const ext = path.extname(filename).toLowerCase();

  // Check if extension is allowed
  const isExtensionAllowed = Object.values(ALLOWED_FILE_TYPES).some(category =>
    category.extensions.includes(ext)
  );

  if (!isExtensionAllowed) {
    return {
      valid: false,
      error: `File type ${ext} is not allowed. Allowed types: ${getAllowedExtensions().join(', ')}`,
    };
  }

  // Check if MIME type matches
  const isMimeTypeAllowed = Object.values(ALLOWED_FILE_TYPES).some(category =>
    category.mimeTypes.includes(mimeType)
  );

  if (!isMimeTypeAllowed) {
    return {
      valid: false,
      error: `MIME type ${mimeType} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size > MAX_SINGLE_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(size)}) exceeds maximum allowed size (${formatFileSize(
        MAX_SINGLE_FILE_SIZE
      )})`,
    };
  }

  return { valid: true };
}

/**
 * Validate total attachment size for a note
 */
export function validateTotalAttachmentSize(
  currentSize: number,
  newFileSize: number
): FileValidationResult {
  const totalSize = currentSize + newFileSize;

  if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: `Total attachment size (${formatFileSize(totalSize)}) exceeds maximum allowed (${formatFileSize(
        MAX_TOTAL_ATTACHMENT_SIZE
      )})`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename);

  // Remove special characters except dots, dashes, underscores
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Ensure filename is not empty
  if (!sanitized || sanitized.trim().length === 0) {
    return `file_${Date.now()}${path.extname(filename)}`;
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = sanitized.substring(0, 255 - ext.length);
    return `${name}${ext}`;
  }

  return sanitized;
}

/**
 * Get file category based on MIME type
 */
export function getFileCategory(mimeType: string): 'photo' | 'pdf' | 'document' | 'spreadsheet' {
  if (ALLOWED_FILE_TYPES.images.mimeTypes.includes(mimeType)) {
    return 'photo';
  } else if (mimeType === 'application/pdf') {
    return 'pdf';
  } else if (ALLOWED_FILE_TYPES.spreadsheets.mimeTypes.includes(mimeType)) {
    return 'spreadsheet';
  } else {
    return 'document';
  }
}

/**
 * Virus scan placeholder
 * In production, integrate with ClamAV or cloud-based virus scanning service
 */
export async function scanFileForViruses(fileBuffer: Buffer, filename: string): Promise<boolean> {
  try {
    logger.debug(`[Virus Scan] Scanning file: ${filename} (${fileBuffer.length} bytes)`);

    // TODO: Integrate with actual virus scanning service
    // Examples:
    // - ClamAV (clamav.js npm package)
    // - AWS GuardDuty/Macie
    // - VirusTotal API
    // - Microsoft Defender API

    // For now, implement basic checks
    const suspiciousPatterns = [
      // Executable signatures
      Buffer.from([0x4d, 0x5a]), // MZ (DOS/Windows executables)
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executables)
    ];

    for (const pattern of suspiciousPatterns) {
      if (fileBuffer.slice(0, pattern.length).equals(pattern)) {
        logger.warn(`[Virus Scan] Suspicious file detected: ${filename}`);
        return false;
      }
    }

    logger.debug(`[Virus Scan] File passed basic checks: ${filename}`);
    return true;
  } catch (error) {
    logger.error('[Virus Scan] Error scanning file:', error);
    // Fail closed - reject file if scan fails
    return false;
  }
}

/**
 * Validate complete file upload
 */
export async function validateFileUpload(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  currentTotalSize: number = 0
): Promise<FileValidationResult> {
  // Validate file type
  const typeValidation = validateFileType(filename, mimeType);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // Validate file size
  const sizeValidation = validateFileSize(fileBuffer.length);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Validate total attachment size
  const totalSizeValidation = validateTotalAttachmentSize(currentTotalSize, fileBuffer.length);
  if (!totalSizeValidation.valid) {
    return totalSizeValidation;
  }

  // Scan for viruses
  const virusScanPassed = await scanFileForViruses(fileBuffer, filename);
  if (!virusScanPassed) {
    return {
      valid: false,
      error: 'File failed virus scan',
      virusScanPassed: false,
    };
  }

  return { valid: true, virusScanPassed: true };
}

/**
 * Format file size for human-readable display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get all allowed file extensions
 */
export function getAllowedExtensions(): string[] {
  return Object.values(ALLOWED_FILE_TYPES).flatMap(category => category.extensions);
}

/**
 * Get all allowed MIME types
 */
export function getAllowedMimeTypes(): string[] {
  return Object.values(ALLOWED_FILE_TYPES).flatMap(category => category.mimeTypes);
}

/**
 * Generate unique filename to prevent collisions
 */
export function generateUniqueFilename(originalFilename: string, userId: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const nameWithoutExt = path.basename(sanitized, ext);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return `${userId}_${timestamp}_${randomSuffix}_${nameWithoutExt}${ext}`;
}
