import { OCRResult, SUPPORTED_IMAGE_TYPES, SUPPORTED_DOCUMENT_TYPES } from '../types';
import { ImageProcessor } from './imageProcessor';
import { PDFProcessor } from './pdfProcessor';

export class OCRProcessor {
  static async processFile(
    buffer: Buffer, 
    mimeType: string, 
    language: string = 'eng'
  ): Promise<OCRResult> {
    
    if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
      return await ImageProcessor.processImage(buffer, language);
    } 
    
    if (SUPPORTED_DOCUMENT_TYPES.includes(mimeType)) {
      return await PDFProcessor.processPDF(buffer);
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  static getSupportedTypes(): { images: string[]; documents: string[] } {
    return {
      images: SUPPORTED_IMAGE_TYPES,
      documents: SUPPORTED_DOCUMENT_TYPES
    };
  }

  static getSupportedLanguages(): string[] {
    return ImageProcessor.getSupportedLanguages();
  }
}
