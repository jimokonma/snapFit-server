import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgressDocument = Progress & Document;

@Schema({ timestamps: true })
export class Progress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  photoUrl: string;

  @Prop()
  weight: number; // in kg

  @Prop()
  bodyFatPercentage: number;

  @Prop()
  muscleMass: number;

  @Prop({ type: Object })
  measurements: {
    chest: number;
    waist: number;
    hips: number;
    arms: number;
    thighs: number;
  };

  @Prop()
  aiAnalysis: string;

  @Prop()
  notes: string;

  @Prop({ default: false })
  isBaseline: boolean; // first progress photo

  @Prop()
  previousProgressId: Types.ObjectId; // reference to previous progress
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);
