const pdf: any = require('pdf-parse');
import { OCRResult } from '../types';

export class PDFProcessor {
  static async processPDF(buffer: Buffer): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      const data = await pdf(buffer);
      const processingTime = Date.now() - startTime;

      return {
        text: (data.text || '').trim(),
        language: 'auto-detected',
        processingTime
      };
    } catch (error) {
      console.error('PDF processing error:', error);
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPDFInfo(buffer: Buffer): Promise<{ pages: number; info: any }> {
    try {
      const data = await pdf(buffer);
      return {
        pages: typeof data.numpages === 'number' ? data.numpages : 0,
        info: data.info
      };
    } catch (error) {
      console.error('PDF info extraction error:', error);
      throw new Error(`Failed to extract PDF info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
