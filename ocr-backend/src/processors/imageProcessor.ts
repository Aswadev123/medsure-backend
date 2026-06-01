import Tesseract from 'tesseract.js';
import { OCRResult } from '../types';

export class ImageProcessor {
  static async processImage(buffer: Buffer, language: string = 'eng'): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      const { data } = await Tesseract.recognize(buffer, language, {
        logger: m => {
          // Optional: log progress
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        text: data.text.trim(),
        confidence: data.confidence,
        language: language,
        processingTime
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static getSupportedLanguages(): string[] {
    return [
      'eng', // English
      'spa', // Spanish
      'fra', // French
      'deu', // German
      'ita', // Italian
      'por', // Portuguese
      'rus', // Russian
      'chi_sim', // Chinese Simplified
      'chi_tra', // Chinese Traditional
      'jpn', // Japanese
      'kor', // Korean
      'ara', // Arabic
      'hin', // Hindi
    ];
  }
}
