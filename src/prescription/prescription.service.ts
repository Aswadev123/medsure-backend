// src/prescription/prescription.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiService, Warning as AiWarning } from '../ai/ai.service';
import { Document } from '../document/document.schema';
import { OCRResult } from '../ocr/ocr.service';

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    @InjectModel('Document') private documentModel: Model<Document>,
    private readonly aiService: AiService,
  ) {}

  async uploadPrescription(file: Express.Multer.File, userId: string): Promise<any> {
    this.logger.log(`Uploading prescription for user: ${userId}`);
    
    const document = new this.documentModel({
      filename: file.originalname,
      originalName: file.originalname,
      fileType: file.originalname.split('.').pop(),
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.originalname}`,
      documentType: 'prescription',
      userId: new Types.ObjectId(userId),
      status: 'pending',
      uploadDate: new Date(),
    });

    const savedDocument = await document.save();

    this.analyzePrescription(savedDocument._id.toString()).catch(err => {
      this.logger.error(`Prescription analysis failed: ${err.message}`);
    });

    return {
      id: savedDocument._id,
      message: 'Prescription uploaded successfully',
      status: 'pending',
    };
  }

  async analyzePrescription(prescriptionId: string): Promise<any> {
    this.logger.log(`Analyzing prescription: ${prescriptionId}`);
    
    const document = await this.documentModel.findById(prescriptionId);
    if (!document) {
      throw new NotFoundException('Prescription not found');
    }

    document.status = 'processing';
    await document.save();

    const mockOCRResult: OCRResult = {
      text: 'Extracted text from prescription',
      confidence: 75,
      medications: [],
      rawData: {
        lines: ['Extracted text from prescription'],
        words: []
      }
    };
    
    const analysis = await this.aiService.analyzePrescription(mockOCRResult);

    // Map warnings to match Document schema
    const mappedWarnings = (analysis.warnings || []).map(w => ({
      type: w.type,
      severity: this.mapSeverity(w.severity),
      message: w.message,
      suggestion: w.suggestion
    }));

    document.analysis = {
      status: 'completed',
      confidence: analysis.confidence,
      summary: analysis.summary,
      medicines: analysis.medicines || [],
      warnings: mappedWarnings,
      patientInfo: analysis.patientInfo,
      doctorInfo: analysis.doctorInfo,
      recommendations: analysis.recommendations || [],
      insights: analysis.insights || [],
      extractedAt: new Date()
    };
    
    document.status = 'analyzed';
    await document.save();

    return analysis;
  }

  private mapSeverity(severity: string): 'Low' | 'Medium' | 'High' {
    const severityLower = severity.toLowerCase();
    if (severityLower === 'high') return 'High';
    if (severityLower === 'medium') return 'Medium';
    return 'Low';
  }

  async getRecentAnalyses(userId: string): Promise<any[]> {
    this.logger.log(`Getting recent analyses for user: ${userId}`);
    
    const documents = await this.documentModel
      .find({ 
        userId: new Types.ObjectId(userId),
        documentType: 'prescription',
        status: 'analyzed'
      })
      .sort({ uploadDate: -1 })
      .limit(10)
      .select('_id originalName uploadDate analysis.doctorInfo analysis.confidence analysis.medicines')
      .exec();

    return documents.map(doc => ({
      id: doc._id,
      title: doc.originalName,
      date: doc.uploadDate,
      doctor: doc.analysis?.doctorInfo?.name || 'Unknown',
      confidence: doc.analysis?.confidence || 0,
      medicines: doc.analysis?.medicines?.length || 0,
    }));
  }

  async getPrescriptionById(id: string, userId: string): Promise<any> {
    this.logger.log(`Getting prescription by ID: ${id}`);
    
    const document = await this.documentModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      documentType: 'prescription',
    }).exec();

    if (!document) {
      throw new NotFoundException('Prescription not found');
    }

    return {
      id: document._id,
      name: document.originalName,
      date: document.uploadDate,
      doctor: document.doctorName || document.analysis?.doctorInfo?.name || 'Unknown',
      notes: document.notes,
      analysis: document.analysis,
    };
  }

  async deletePrescription(id: string, userId: string): Promise<any> {
    this.logger.log(`Deleting prescription: ${id}`);
    
    const result = await this.documentModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      documentType: 'prescription',
    }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Prescription not found');
    }

    return { message: 'Prescription deleted successfully' };
  }
}