import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BodyAnalysisRecordDocument = BodyAnalysisRecord & Document;

@Schema({ timestamps: true })
export class BodyAnalysisRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  analysisNumber: number;

  @Prop({ type: Object })
  photoUrls: {
    upper_front?: string;
    upper_back?: string;
    side_profile?: string;
    full_body?: string;
  };

  @Prop({ type: Object, required: true })
  analysis: {
    overallAssessment: string;
    bodyComposition: {
      muscleDevelopment: string;
      posture: string;
      symmetry: string;
      priorityAreas: string[];
    };
    strengths: string[];
    areasForImprovement: string[];
  };
}

export const BodyAnalysisRecordSchema = SchemaFactory.createForClass(BodyAnalysisRecord);
