import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop({ default: 'USER' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLogin: Date;

  @Prop({ type: [String], default: [] })
  // favorites moved to separate collection (favorites module)
  favorites?: string[];

  @Prop({ type: Array, default: [] })
  routines?: any[];

  @Prop()
  occupation?: string;

  @Prop()
  education?: string;

  @Prop({ type: [String], default: [] })
  languages?: string[];

  @Prop({ type: [String], default: [] })
  hobbies?: string[];

  @Prop({ type: [String], default: [] })
  interests?: string[];

  @Prop()
  website?: string;

  @Prop()
  nationality?: string;

  @Prop()
  gender?: string;

  @Prop()
  maritalStatus?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: Object, default: {} })
  socialLinks?: Record<string, any>;

  @Prop({ type: Object, default: {} })
  preferences?: Record<string, any>;

  @Prop()
  bio?: string;

  @Prop({ type: [String], default: [] })
  allergies?: string[];

  @Prop()
  bloodType?: string;

  @Prop({ type: Object, default: null })
  emergencyContact?: { name?: string; phone?: string; relation?: string } | null;
}

export const UserSchema = SchemaFactory.createForClass(User);