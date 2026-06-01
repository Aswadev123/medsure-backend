// src/medicine/medicine.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MedicineDocument = Medicine & Document;

@Schema({ timestamps: true })
export class Medicine {
  @Prop({ required: true })
  name: string;

  @Prop()
  genericName: string;

  @Prop()
  strength: string;

  @Prop()
  purpose: string;

  @Prop([String])
  sideEffects: string[];

  @Prop([String])
  warnings: string[];

  @Prop()
  price: string;

  @Prop({ default: 'Available' })
  availability: string;

  @Prop([String])
  alternatives: string[];
}

export const MedicineSchema = SchemaFactory.createForClass(Medicine);