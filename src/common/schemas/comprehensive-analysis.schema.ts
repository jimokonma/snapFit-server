import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComprehensiveAnalysisDocument = ComprehensiveAnalysis & Document;

@Schema({ timestamps: true })
export class ComprehensiveAnalysis {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'BodyAnalysis', required: true })
  bodyAnalysisIds: Types.ObjectId[]; // References to 6 BodyAnalysis documents

  @Prop({ required: true })
  overallAssessment: string;

  @Prop({ type: Object, required: true })
  bodyComposition: {
    estimatedBodyFat: string;
    muscleDevelopment: string;
    posture: string;
    symmetry: string;
    bodyType: 'ectomorph' | 'mesomorph' | 'endomorph' | 'balanced';
  };

  @Prop({ type: Object, required: true })
  measurements: {
    shoulderToHipRatio: number;
    legToTorsoRatio: number;
    shoulderWidth: number;
    hipWidth: number;
    overallProportions: string;
  };

  @Prop({ type: Object, required: true })
  postureAnalysis: {
    forwardHeadPosture: string; // normal, mild, moderate, severe
    shoulderAlignment: string; // balanced, slight_asymmetry, significant_asymmetry
    spinalAlignment: string; // normal, hyperlordosis, flat_spine
    hipAlignment: string; // balanced, anterior_tilt, posterior_tilt
    overallPostureScore: number; // 0-100
  };

  @Prop({ type: Object, required: true })
  symmetryAnalysis: {
    upperBodySymmetry: number; // 0-100
    lowerBodySymmetry: number; // 0-100
    overallSymmetry: number; // 0-100
    asymmetryAreas: string[];
  };

  @Prop({ type: [String], required: true })
  strengths: string[];

  @Prop({ type: [String], required: true })
  areasForImprovement: string[];

  @Prop({ type: Object, required: true })
  recommendations: {
    primaryFocus: string;
    secondaryFocus: string;
    workoutIntensity: 'beginner' | 'intermediate' | 'advanced';
    exerciseTypes: string[];
    correctiveExercises: string[];
  };

  @Prop({ required: true })
  detailedDescription: string;

  @Prop({ type: Object, required: true })
  mediaPipeData: {
    allPhotosAnalyzed: boolean;
    missingPhotos: string[];
    photoQualityIssues: string[];
    landmarkConfidenceAverage: number;
  };

  @Prop({ type: Object })
  aiAnalysis?: {
    visualObservations?: any;
    aiRecommendations?: any;
  };
}

export const ComprehensiveAnalysisSchema = SchemaFactory.createForClass(ComprehensiveAnalysis);

// Create index for efficient queries
ComprehensiveAnalysisSchema.index({ userId: 1, createdAt: -1 });

