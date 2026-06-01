import { ALL_SUPPORTED_TYPES, FileInfo } from '../types';
import path from 'path';

export class FileValidator {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  static validateFile(file: Express.Multer.File): { isValid: boolean; error?: string; fileInfo?: FileInfo } {
    // Check if file exists
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        error: `File size too large. Maximum allowed size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB` 
      };
    }

    // Check MIME type
    if (!ALL_SUPPORTED_TYPES.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `Unsupported file type: ${file.mimetype}. Supported types: ${ALL_SUPPORTED_TYPES.join(', ')}` 
      };
    }

    // Get file extension
    const extension = path.extname(file.originalname).toLowerCase();

    const fileInfo: FileInfo = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extension
    };

    return { isValid: true, fileInfo };
  }

  static getSupportedTypes(): string[] {
    return ALL_SUPPORTED_TYPES;
  }

  static getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }
}
