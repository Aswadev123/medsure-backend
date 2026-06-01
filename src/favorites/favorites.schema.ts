import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FavoriteDocument = Favorite & Document;

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  medicineId: string;

  @Prop({ default: Date.now })
  addedAt: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
