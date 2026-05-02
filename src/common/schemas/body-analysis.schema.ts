import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { encryptionPlugin } from '../plugins/encryption.plugin';

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

  /** Stores the encrypted Cloudinary public_id (new uploads) or legacy full URL (old uploads). */
  @Prop()
  cloudinaryPublicId: string;

  @Prop({ required: true, default: false })
  validationPassed: boolean;

  @Prop({ type: [String], default: [] })
  validationIssues: string[];

  @Prop()
  validationFeedback: string;
}

export const BodyAnalysisSchema = SchemaFactory.createForClass(BodyAnalysis);

BodyAnalysisSchema.plugin(encryptionPlugin, [{ path: 'cloudinaryPublicId' }]);

BodyAnalysisSchema.index({ userId: 1, photoType: 1 });
BodyAnalysisSchema.index({ userId: 1, createdAt: -1 });
