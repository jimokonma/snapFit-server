import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BodyAnalysisDocument = BodyAnalysis & Document;

export enum PhotoType {
  UPPER_FRONT = 'upper_front',
  UPPER_BACK = 'upper_back',
  UPPER_SIDE = 'upper_side',
  LOWER_FRONT = 'lower_front',
  LOWER_BACK = 'lower_back',
  LOWER_SIDE = 'lower_side',
}

@Schema({ timestamps: true })
export class MediaPipeLandmark {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  z: number;

  @Prop({ required: true })
  visibility: number;

  @Prop({ required: true })
  presence: number;
}

@Schema({ timestamps: true })
export class BodyAnalysis {
  @Prop({ required: true, type: String, ref: 'User' })
  userId: string;

  @Prop({ required: true, enum: PhotoType })
  photoType: PhotoType;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ type: [Object], required: true })
  landmarks: MediaPipeLandmark[]; // 33 landmarks

  @Prop({ type: [Object], required: true })
  worldLandmarks: MediaPipeLandmark[]; // 3D coordinates

  @Prop({ type: Object })
  measurements: {
    shoulderWidth?: number;
    hipWidth?: number;
    shoulderToHipRatio?: number;
    legLength?: number;
    torsoLength?: number;
    legToTorsoRatio?: number;
  };

  @Prop({ type: Object })
  posture: {
    forwardHeadAngle?: number;
    shoulderAsymmetry?: number;
    hipAsymmetry?: number;
    spinalCurvature?: number;
  };

  @Prop({ type: Object })
  symmetry: {
    leftRightShoulderDiff?: number;
    leftRightHipDiff?: number;
    leftRightLegDiff?: number;
    symmetryScore: number; // 0-100
  };

  @Prop({ required: true, default: false })
  validationPassed: boolean;

  @Prop({ type: [String], default: [] })
  validationIssues: string[];

  @Prop({ default: 0 })
  landmarkConfidenceAverage: number; // Average visibility score
}

export const BodyAnalysisSchema = SchemaFactory.createForClass(BodyAnalysis);

// Create index for efficient queries
BodyAnalysisSchema.index({ userId: 1, photoType: 1 });
BodyAnalysisSchema.index({ userId: 1, createdAt: -1 });

