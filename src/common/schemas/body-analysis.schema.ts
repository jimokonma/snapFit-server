import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BodyAnalysisDocument = BodyAnalysis & Document;

export enum PhotoType {
  UPPER_FRONT = 'upper_front',
  UPPER_BACK = 'upper_back',
  SIDE_PROFILE = 'side_profile',
  FULL_BODY = 'full_body',
}

@Schema({ timestamps: true })
export class BodyAnalysis {
  @Prop({ required: true, type: String, ref: 'User' })
  userId: string;

  @Prop({ required: true, enum: PhotoType })
  photoType: PhotoType;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ required: true, default: false })
  validationPassed: boolean;

  @Prop({ type: [String], default: [] })
  validationIssues: string[];

  @Prop()
  validationFeedback: string;
}

export const BodyAnalysisSchema = SchemaFactory.createForClass(BodyAnalysis);

BodyAnalysisSchema.index({ userId: 1, photoType: 1 });
BodyAnalysisSchema.index({ userId: 1, createdAt: -1 });
