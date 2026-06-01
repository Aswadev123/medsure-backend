// src/document/document.service.ts
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Document } from './document.schema';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { AiService, Warning as AiWarning } from '../ai/ai.service';
import { OcrService, OCRResult } from '../ocr/ocr.service';
import { FreeOcrService } from '../ai/freeocr.service';
import * as fs from 'fs';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectModel(Document.name) private documentModel: Model<Document>,
    private readonly aiService: AiService,
    private readonly ocrService: OcrService,
    private readonly freeOcrService: FreeOcrService,
  ) {}

  async createDocument(userId: string, createDocumentDto: CreateDocumentDto): Promise<Document> {
    this.logger.log(`Creating document for user: ${userId}`);
    
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      throw new BadRequestException('Invalid user ID format');
    }
    
    const document = new this.documentModel({
      ...createDocumentDto,
      userId: new Types.ObjectId(userId),
      uploadDate: new Date(),
      status: 'pending',
    });

    const savedDocument = await document.save();
    
    // Trigger OCR and analysis in background
    this.processDocument(savedDocument._id.toString()).catch(err => {
      this.logger.error(`Background processing failed: ${err.message}`);
    });

    return savedDocument;
  }

  async processDocument(documentId: string): Promise<Document> {
    this.logger.log(`Starting processing for document: ${documentId}`);
    
    const document = await this.documentModel.findById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    try {
      // Update status to processing
      document.status = 'processing';
      await document.save();

      // Process documents (images and PDFs) with Free OCR when available
      if (document.mimeType.startsWith('image/') || document.mimeType === 'application/pdf') {
        this.logger.log(`Running OCR for document: ${documentId}`);

        // Prefer local file buffer when available
        let buffer: Buffer | null = null;
        if (document.filename && fs.existsSync(document.filename)) {
          buffer = fs.readFileSync(document.filename);
        }

        let ocrResultData: any = null;

        // Try FreeOcrService first
        if (this.freeOcrService && this.freeOcrService.enabled) {
          try {
            const input: any = {};
            if (buffer) input.base64 = buffer.toString('base64');
            else if (document.url) input.url = document.url;
            input.filename = document.originalName || document.filename;
            input.mimetype = document.mimeType;

            this.logger.log('Calling FreeOcrService.extract');
            const extracted = await this.freeOcrService.extract(input);
            if (extracted) {
              ocrResultData = {
                text: extracted.summary || (extracted.raw?.text || ''),
                confidence: extracted.confidence || null,
                medications: extracted.medicines || [],
                patientInfo: extracted.patientInfo || null,
                doctorInfo: extracted.doctorInfo || null,
                rawData: extracted.raw || null,
                processedAt: new Date(),
              };
            }
          } catch (e) {
            this.logger.warn(`FreeOcrService failed: ${e.message}`);
          }
        }

        // Fallback to local OcrService for images if FreeOcrService didn't return data
        if (!ocrResultData && buffer && document.mimeType.startsWith('image/')) {
          try {
            await this.ocrService.initializeWorker();
            const localResult = await this.ocrService.extractTextFromImage(document.filename);
            await this.ocrService.terminateWorker();
            ocrResultData = {
              text: localResult.text,
              confidence: localResult.confidence,
              medications: localResult.medications,
              patientInfo: localResult.patientInfo,
              doctorInfo: localResult.doctorInfo,
              rawData: localResult.rawData,
              processedAt: new Date(),
            };
          } catch (e) {
            this.logger.warn(`Local OCR fallback failed: ${e.message}`);
          }
        }

        if (!ocrResultData) {
          this.logger.warn(`OCR produced no data for document: ${documentId}`);
        } else {
          // Store OCR results
          document.ocrData = ocrResultData;
          await document.save();

          // Run AI analysis using extracted text
          let analysisResult: any = null;
          try {
            const aiInput = { text: ocrResultData.text, filename: document.filename, url: document.url };
            const aiAnalysis = await this.aiService.analyzeDocument(aiInput as any);
            if (aiAnalysis && Array.isArray(aiAnalysis.medicines) && aiAnalysis.medicines.length > 0) {
              analysisResult = aiAnalysis;
            }
          } catch (e) {
            this.logger.warn(`AiService.analyzeDocument failed: ${e.message}`);
          }

          // Fallback to prescription-specific analyzer if general AI didn't provide medicines
          if (!analysisResult) {
            analysisResult = await this.aiService.analyzePrescription(ocrResultData as OCRResult);
          }

          // Update document with analysis results
          document.analysis = {
            status: 'completed',
            confidence: analysisResult.confidence || ocrResultData.confidence || 0,
            summary: analysisResult.summary || 'Prescription analysis completed',
            medicines: analysisResult.medicines || ocrResultData.medications || [],
            warnings: (analysisResult.warnings || []).map(w => this.mapWarningSeverity(w)),
            patientInfo: analysisResult.patientInfo || ocrResultData.patientInfo || null,
            doctorInfo: analysisResult.doctorInfo || ocrResultData.doctorInfo || null,
            recommendations: analysisResult.recommendations || [],
            insights: analysisResult.insights || [],
          } as any;
          (document.analysis as any).rawData = (analysisResult as any).raw || ocrResultData.rawData || null;
          (document.analysis as any).extractedAt = new Date();

          document.status = 'analyzed';
          document.processedAt = new Date();
          await document.save();
          this.logger.log(`Analysis completed for document: ${documentId}`);
        }
      } else {
        // For non-image files, just use AI analysis
        const analysisResult = await this.aiService.analyzeDocument(document);

        document.analysis = {
          status: 'completed',
          confidence: analysisResult.confidence || 85,
          summary: analysisResult.summary || 'Document analysis completed',
          medicines: analysisResult.medicines || [],
          warnings: (analysisResult.warnings || []).map(w => this.mapWarningSeverity(w)),
          patientInfo: analysisResult.patientInfo,
          doctorInfo: analysisResult.doctorInfo,
          recommendations: analysisResult.recommendations || [],
          insights: analysisResult.insights || [],
          // Preserve raw adapter output for UI inspection (DocStrangein)
        } as any;
        (document.analysis as any).rawData = (analysisResult as any).raw || (analysisResult as any).rawData || null;
        (document.analysis as any).extractedAt = new Date();
        
        document.status = 'analyzed';
        document.processedAt = new Date();
        
        await document.save();
      }
      
      return document;
    } catch (error) {
      this.logger.error(`Processing failed for document ${documentId}:`, error);
      document.status = 'failed';
      document.analysis = {
        status: 'failed',
        confidence: 0,
        summary: 'Analysis failed',
        medicines: [],
        warnings: [],
        recommendations: [],
        insights: []
      };
      await document.save();
      throw error;
    }
  }

  // Helper method to map warning severity
  private mapWarningSeverity(warning: any): { type: string; severity: 'Low' | 'Medium' | 'High'; message: string; suggestion: string } {
    let severity: 'Low' | 'Medium' | 'High' = 'Medium';
    
    if (warning.severity) {
      const severityLower = warning.severity.toLowerCase();
      if (severityLower === 'high') severity = 'High';
      else if (severityLower === 'medium') severity = 'Medium';
      else if (severityLower === 'low') severity = 'Low';
    }
    
    return {
      type: warning.type || 'Warning',
      severity,
      message: warning.message || 'Please consult your doctor',
      suggestion: warning.suggestion || 'Monitor for side effects'
    };
  }

  async analyzeDocument(documentId: string): Promise<Document> {
    this.logger.log(`Analyzing document: ${documentId}`);
    return this.processDocument(documentId);
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    this.logger.log(`Fetching documents for user: ${userId}`);
    
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      return [];
    }
    
    return this.documentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ uploadDate: -1 })
      .exec();
  }

  async getDocumentById(id: string): Promise<Document> {
    this.logger.log(`Fetching document by ID: ${id}`);
    const document = await this.documentModel.findById(id).exec();
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async getDocumentsByType(userId: string, type: string): Promise<Document[]> {
    this.logger.log(`Fetching documents of type ${type} for user: ${userId}`);
    
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      return [];
    }
    
    return this.documentModel
      .find({ 
        userId: new Types.ObjectId(userId),
        documentType: type 
      })
      .sort({ uploadDate: -1 })
      .exec();
  }

  async updateDocument(id: string, updateDocumentDto: UpdateDocumentDto | any): Promise<Document> {
    this.logger.log(`Updating document: ${id}`);
    const document = await this.documentModel
      .findByIdAndUpdate(id, updateDocumentDto, { new: true })
      .exec();
    
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async updateDocumentStatus(id: string, status: string): Promise<Document> {
    this.logger.log(`Updating document status: ${id} -> ${status}`);
    return this.updateDocument(id, { status });
  }

  async markAsAnalyzed(id: string, analysisResults: any): Promise<Document> {
    this.logger.log(`Marking document as analyzed: ${id}`);
    return this.updateDocument(id, {
      status: 'analyzed',
      analysis: analysisResults,
    });
  }

  async deleteDocument(id: string): Promise<Document> {
    this.logger.log(`Deleting document: ${id}`);
    const document = await this.documentModel.findByIdAndDelete(id).exec();
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    
    // Optionally delete the file
    if (document.filename && fs.existsSync(document.filename)) {
      fs.unlinkSync(document.filename);
    }
    
    return document;
  }

  async getTotalStorageUsed(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      return 0;
    }
    
    const documents = await this.documentModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('size')
      .exec();
    
    return documents.reduce((total, doc) => total + (doc.size || 0), 0);
  }

  async getTotalCount(): Promise<number> {
    this.logger.log('Getting total document count');
    try {
      return await this.documentModel.countDocuments().exec();
    } catch (error) {
      this.logger.error('Error counting documents:', error);
      return 0;
    }
  }

  async getCountForUser(userId: string): Promise<number> {
    this.logger.log(`Getting document count for user: ${userId}`);
    try {
      if (!Types.ObjectId.isValid(userId)) return 0;
      return await this.documentModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
    } catch (error) {
      this.logger.error('Error counting documents for user:', error);
      return 0;
    }
  }

  async getAnalysesCountForUser(userId: string): Promise<number> {
    this.logger.log(`Getting analyses count for user: ${userId}`);
    try {
      if (!Types.ObjectId.isValid(userId)) return 0;
      // Count documents with analysis field present and status 'completed'
      return await this.documentModel.countDocuments({
        userId: new Types.ObjectId(userId),
        'analysis.status': { $exists: true, $eq: 'completed' },
      }).exec();
    } catch (error) {
      this.logger.error('Error counting analyses for user:', error);
      return 0;
    }
  }

  async getRecentDocuments(userId: string, limit: number = 5): Promise<Document[]> {
    this.logger.log(`Fetching recent documents for user: ${userId}`);
    
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      return [];
    }
    
    return this.documentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ uploadDate: -1 })
      .limit(limit)
      .exec();
  }

  async getDocumentStats(userId: string): Promise<any> {
    this.logger.log(`Getting document stats for user: ${userId}`);
    
    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`Invalid userId format: ${userId}`);
      return {};
    }
    
    const stats = await this.documentModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }}
    ]);
    
    return stats;
  }
}