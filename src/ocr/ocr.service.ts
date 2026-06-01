// src/ocr/ocr.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

export interface OCRResult {
  text: string;
  confidence: number;
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
  }>;
  patientInfo?: {
    name?: string;
    age?: number;
    gender?: string;
  };
  doctorInfo?: {
    name?: string;
  };
  rawData: {
    lines: string[];
    words: Array<{ text: string; confidence: number }>;
  };
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private worker: Worker | null = null;
  private isInitialized = false;

  async initializeWorker() {
    if (!this.isInitialized) {
      try {
        this.logger.log('Initializing Tesseract worker...');
        this.worker = await createWorker('eng');
        this.isInitialized = true;
        this.logger.log('Tesseract worker initialized successfully');
      } catch (error) {
        this.logger.error(`Failed to initialize Tesseract: ${error.message}`);
        throw error;
      }
    }
    return this.worker;
  }

  async extractTextFromImage(filePath: string): Promise<OCRResult> {
    try {
      this.logger.log(`Starting OCR for file: ${filePath}`);
      
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check file stats
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error(`File is empty: ${filePath}`);
      }

      this.logger.log(`File size: ${stats.size} bytes`);

      // Initialize worker if not already done
      await this.initializeWorker();

      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);
      this.logger.log(`Image preprocessed: ${processedImagePath}`);

      // Perform OCR with detailed output
      if (!this.worker) {
        throw new Error('Worker not initialized');
      }
      
      const { data } = await this.worker.recognize(processedImagePath);
      
      // Clean up temp file
      await fs.unlink(processedImagePath).catch(err => 
        this.logger.warn(`Failed to delete temp file: ${err.message}`)
      );

      // Get words from data - handle different Tesseract versions safely
      let words: any[] = [];
      
      const pageData = data as any;
      
      if (pageData.words && Array.isArray(pageData.words)) {
        words = pageData.words;
      } else if (pageData.symbols && Array.isArray(pageData.symbols)) {
        words = pageData.symbols;
      } else if (pageData.lines && Array.isArray(pageData.lines)) {
        words = pageData.lines;
      }
      
      // Parse the extracted text
      const parsedData = this.parsePrescriptionText(data.text, words);

      this.logger.log(`OCR completed with confidence: ${parsedData.confidence}%`);
      
      return parsedData;
    } catch (error) {
      this.logger.error(`OCR failed: ${error.message}`);
      throw error;
    }
  }

  private async preprocessImage(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_processed.jpg';
    
    try {
      // Read the file first to ensure it exists and has content
      const inputBuffer = await fs.readFile(inputPath);
      
      if (!inputBuffer || inputBuffer.length === 0) {
        throw new Error('Input file is empty');
      }

      // Process the image
      await sharp(inputBuffer)
        .grayscale()
        .normalise()
        .sharpen()
        .resize(2000, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .toFile(outputPath);
      
      // Verify the output file was created
      if (!fsSync.existsSync(outputPath)) {
        throw new Error('Failed to create processed image');
      }

      const outputStats = await fs.stat(outputPath);
      this.logger.log(`Processed image size: ${outputStats.size} bytes`);
      
      return outputPath;
    } catch (error) {
      this.logger.error(`Image preprocessing failed: ${error.message}`);
      // Return original if preprocessing fails
      return inputPath;
    }
  }

  private parsePrescriptionText(text: string, words: any[]): OCRResult {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Common medical patterns
    const patterns = {
      patientName: [
        /patient(?:\s*name)?\s*:?\s*([A-Za-z\s]+)(?:\n|,|\s\d)/i,
        /name\s*:?\s*([A-Za-z\s]+)(?:\n|,|\s(?:age|dob))/i,
        /pt\.?\s*:?\s*([A-Za-z\s]+)/i
      ],
      age: [
        /age\s*:?\s*(\d{1,3})(?:\s*y(?:ea)?rs?)?/i,
        /(\d{1,3})\s*(?:y(?:ea)?rs?)(?:\s*old)?/i,
        /dob\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i
      ],
      gender: [
        /gender\s*:?\s*([MF])/i,
        /sex\s*:?\s*([MF])/i,
        /\b(male|female)\b/i
      ],
      doctorName: [
        /dr\.?\s*:?\s*([A-Za-z\s]+)/i,
        /doctor\s*:?\s*([A-Za-z\s]+)/i,
        /physician\s*:?\s*([A-Za-z\s]+)/i
      ],
      date: [
        /date\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
        /prescribed(?:\s*on)?\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i
      ]
    };

    // Extract medications
    const medications: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
    }> = [];
    
    const medicationPatterns = [
      /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablet|capsule|tab|cap))/gi,
      /(?:Rx|Take|Prescribe)\s+([A-Za-z\s]+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))/gi,
      /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?\s*mg)/gi
    ];

    for (const pattern of medicationPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        const dosage = match[2];
        
        // Check if medication already exists
        if (!medications.some(m => m.name && m.name.toLowerCase() === name.toLowerCase())) {
          medications.push({
            name,
            dosage,
            frequency: this.extractFrequency(text, name),
            duration: this.extractDuration(text, name)
          });
        }
      }
    }

    // If no medications found with patterns, try to identify drug names
    if (medications.length === 0) {
      const commonDrugs = [
        'amoxicillin', 'ibuprofen', 'paracetamol', 'aspirin', 'lisinopril',
        'metformin', 'atorvastatin', 'amlodipine', 'omeprazole', 'metoprolol'
      ];
      
      lines.forEach(line => {
        commonDrugs.forEach(drug => {
          if (line.toLowerCase().includes(drug)) {
            if (!medications.some(m => m.name && m.name.toLowerCase() === drug.toLowerCase())) {
              medications.push({
                name: drug,
                dosage: this.extractDosage(line),
                frequency: this.extractFrequency(line, drug)
              });
            }
          }
        });
      });
    }

    // Extract patient info
    let patientName: string | undefined;
    let patientAge: number | undefined;
    let patientGender: string | undefined;
    let doctorName: string | undefined;

    for (const pattern of patterns.patientName) {
      const match = text.match(pattern);
      if (match) {
        patientName = match[1].trim();
        break;
      }
    }

    for (const pattern of patterns.age) {
      const match = text.match(pattern);
      if (match) {
        const ageMatch = match[1].match(/\d+/);
        if (ageMatch) {
          patientAge = parseInt(ageMatch[0]);
          break;
        }
      }
    }

    for (const pattern of patterns.gender) {
      const match = text.match(pattern);
      if (match) {
        patientGender = match[1].toUpperCase();
        break;
      }
    }

    for (const pattern of patterns.doctorName) {
      const match = text.match(pattern);
      if (match) {
        doctorName = match[1].trim();
        break;
      }
    }

    const avgWordConfidence = words && words.length > 0 
      ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length
      : 70;

    const hasMedications = medications.length > 0 ? 15 : 0;
    const hasPatientInfo = patientName || patientAge ? 10 : 0;
    const hasDoctorInfo = doctorName ? 5 : 0;

    const confidence = Math.min(
      Math.round(avgWordConfidence * 0.7 + hasMedications + hasPatientInfo + hasDoctorInfo),
      98
    );

    return {
      text,
      confidence,
      medications,
      patientInfo: {
        name: patientName,
        age: patientAge,
        gender: patientGender
      },
      doctorInfo: {
        name: doctorName
      },
      rawData: {
        lines,
        words: words ? words.map(w => ({ 
          text: w.text || w.symbol || '', 
          confidence: w.confidence || 0 
        })) : []
      }
    };
  }

  private extractFrequency(text: string, medicationName: string): string | undefined {
    const contextWindow = 100;
    const medIndex = text.toLowerCase().indexOf(medicationName.toLowerCase());
    
    if (medIndex === -1) return undefined;
    
    const start = Math.max(0, medIndex - contextWindow);
    const end = Math.min(text.length, medIndex + medicationName.length + contextWindow);
    const context = text.substring(start, end);
    
    const frequencyPatterns = [
      /(\d+\s*(?:times?|x)\s*(?:daily|day|a\.?m\.?|p\.?m\.?))/i,
      /(?:every|q)\s*(\d+)\s*(?:hours?|h)/i,
      /\b(?:bid|tid|qid|od|hs|prn|q\d+h)\b/i,
      /(\d+)\s*(?:time|x)\s*(?:per|a)\s*(?:day|daily)/i
    ];

    for (const pattern of frequencyPatterns) {
      const match = context.match(pattern);
      if (match) {
        let freq = match[0];
        freq = freq.replace(/\bbid\b/i, 'twice daily')
                   .replace(/\btid\b/i, 'three times daily')
                   .replace(/\bqid\b/i, 'four times daily')
                   .replace(/\bod\b/i, 'once daily')
                   .replace(/\bhs\b/i, 'at bedtime')
                   .replace(/\bprn\b/i, 'as needed');
        return freq;
      }
    }
    
    return undefined;
  }

  private extractDuration(text: string, medicationName: string): string | undefined {
    const contextWindow = 100;
    const medIndex = text.toLowerCase().indexOf(medicationName.toLowerCase());
    
    if (medIndex === -1) return undefined;
    
    const start = Math.max(0, medIndex - contextWindow);
    const end = Math.min(text.length, medIndex + medicationName.length + contextWindow);
    const context = text.substring(start, end);
    
    const durationPatterns = [
      /for\s+(\d+)\s*(?:days?|weeks?|months?)/i,
      /(\d+)\s*-?\s*day\s+course/i,
      /take\s+for\s+(\d+)\s*(?:days?)/i
    ];

    for (const pattern of durationPatterns) {
      const match = context.match(pattern);
      if (match) return match[0];
    }
    
    return undefined;
  }

  private extractDosage(line: string): string | undefined {
    const dosagePattern = /(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablet|capsule|tab|cap))/i;
    const match = line.match(dosagePattern);
    return match ? match[1] : undefined;
  }

  async terminateWorker() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.logger.log('Tesseract worker terminated');
    }
  }
}