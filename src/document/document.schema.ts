// src/document/document.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument, Types } from 'mongoose';

export interface Medicine {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  purpose?: string;
  warnings?: string[];
  verified?: boolean;
  interactions?: string[];
}

export interface Warning {
  type: string;
  severity: 'Low' | 'Medium' | 'High';  // This is the correct type
  message: string;
  suggestion: string;
}

export interface AnalysisResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence: number;
  summary: string;
  medicines: Medicine[];
  warnings: Warning[];  // This expects the Warning type with specific severity values
  patientInfo?: {
    name?: string;
    age?: number;
    gender?: string;
    conditions?: string[];
  };
  doctorInfo?: {
    name?: string;
    specialty?: string;
    license?: string;
    verified?: boolean;
  };
  recommendations: string[];
  insights: string[];
  extractedAt?: Date;
}

export interface OCRData {
  text: string;
  confidence: number;
  medications: Medicine[];
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
  processedAt: Date;
}

@Schema({ timestamps: true })
export class Document extends MongooseDocument {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  fileType: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  url: string;

  @Prop()
  cloudinaryId: string;

  @Prop({ default: 'general' })
  documentType: string;

  @Prop()
  notes: string;

  @Prop()
  doctorName: string;

  @Prop({ default: 'pending' })
  status: string; // pending, processing, analyzed, failed

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Object })
  analysis: AnalysisResult;

  @Prop({ type: Object })
  ocrData: OCRData;

  @Prop({ default: Date.now })
  uploadDate: Date;

  @Prop()
  processedAt: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);