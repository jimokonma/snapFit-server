import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum FitnessGoal {
  FAT_LOSS = 'fat_loss',
  MUSCLE_GAIN = 'muscle_gain',
  ENDURANCE = 'endurance',
  TONING = 'toning',
  GENERAL_FITNESS = 'general_fitness',
  BIGGER_GLUTES = 'bigger_glutes',
  GET_SHREDDED = 'get_shredded',
  FLAT_TUMMY = 'flat_tummy',
  BODY_RECOMPOSITION = 'body_recomposition',
  TONED_ARMS = 'toned_arms',
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum WorkoutHistory {
  NEVER = 'never',
  LESS_THAN_6_MONTHS = '<6_months',
  SIX_TO_12_MONTHS = '6-12_months',
  ONE_TO_3_YEARS = '1-3_years',
  THREE_PLUS_YEARS = '3+_years',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ enum: ['male', 'female'] })
  gender: 'male' | 'female';

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  emailVerificationToken: string;

  @Prop()
  emailVerificationExpires: Date;

  @Prop()
  passwordResetToken: string;

  @Prop()
  passwordResetExpires: Date;

  @Prop()
  age: number;

  @Prop()
  height: number; // in cm

  @Prop()
  weight: number; // in kg

  @Prop({ enum: FitnessGoal })
  fitnessGoal: FitnessGoal;

  @Prop({ enum: ExperienceLevel })
  experienceLevel: ExperienceLevel;

  @Prop({ enum: WorkoutHistory })
  workoutHistory: WorkoutHistory;

  @Prop()
  daysPerWeek: number;

  @Prop()
  injuries: string;

  @Prop({ type: Object })
  bodyPhotos: {
    upper_front?: string;
    upper_back?: string;
    side_profile?: string;
    full_body?: string;
  };

  @Prop({ default: false })
  onboardingCompleted: boolean;

  // Tracks the status of the MediaPipe/AI analysis flow that gates onboarding completion
  @Prop({ enum: ['pending', 'completed', 'failed'], default: 'pending' })
  bodyAnalysisStatus: 'pending' | 'completed' | 'failed';

  @Prop({ type: Object })
  onboarding: {
    profileInfo: boolean;
    fitnessGoal: boolean;
    bodyAnalysis: boolean;
  };

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  googleId: string;

  @Prop()
  facebookId: string;

  @Prop()
  refreshToken: string;

  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop({ default: Date.now })
  freeTrialStartDate: Date;

  @Prop({ default: false })
  hasUsedFreeTrial: boolean;

  @Prop({ default: 0 })
  freeTrialInstructionsUsed: number;

  // AI Body Analysis + Workout Plan (generated after photo analysis)
  @Prop({ type: Object })
  bodyAnalysis: {
    overallAssessment: string;
    bodyComposition: {
      muscleDevelopment: string;
      posture: string;
      symmetry: string;
      priorityAreas: string[];
    };
    strengths: string[];
    areasForImprovement: string[];
    analyzedAt: Date;
  };

  @Prop({ default: 0, min: 0 })
  auraPoints: number;

}

export const UserSchema = SchemaFactory.createForClass(User);
