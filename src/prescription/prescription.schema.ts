// src/prescription/prescription.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PrescriptionDocument = Prescription & Document;

@Schema({ timestamps: true })
export class Prescription {
  @Prop({ required: true })
  userId: string;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop()
  extractedText: string;

  @Prop()
  originalFilename: string;

  @Prop()
  fileType: string;

  @Prop()
  doctorName: string;

  @Prop()
  hospitalName: string;

  @Prop()
  issueDate: Date;

  @Prop({ 
    type: String, 
    enum: ['uploaded', 'analyzing', 'analyzed', 'failed'], 
    default: 'uploaded' 
  })
  status: string;

  @Prop({ default: false })
  analysisCompleted: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  // Explicitly define timestamp fields for TypeScript
  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);