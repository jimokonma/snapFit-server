import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum FitnessGoal {
  FAT_LOSS = 'fat_loss',
  MUSCLE_GAIN = 'muscle_gain',
  ENDURANCE = 'endurance',
  TONING = 'toning',
  GENERAL_FITNESS = 'general_fitness',
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

  @Prop({ type: Object })
  bodyPhotos: {
    front?: string;
    back?: string;
    left?: string;
    fullBody?: string;
  };

  @Prop([String])
  equipmentPhotos: string[];

  @Prop([String])
  selectedEquipment: string[];

  @Prop({ default: false })
  onboardingCompleted: boolean;

  @Prop({ type: Object })
  onboardingProgress: {
    profileInfoCompleted: boolean;
    bodyPhotosCompleted: boolean;
    equipmentPhotosCompleted: boolean;
    currentStep: number;
  };

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  googleId: string;

  @Prop()
  facebookId: string;

  @Prop()
  refreshToken: string;

  @Prop({ default: Date.now })
  freeTrialStartDate: Date;

  @Prop({ default: false })
  hasUsedFreeTrial: boolean;

  @Prop({ default: 0 })
  freeTrialInstructionsUsed: number;

  // AI Body Analysis Data
  @Prop({ type: Object })
  bodyAnalysis: {
    overallAssessment: string;
    bodyComposition: {
      estimatedBodyFat: string;
      muscleDevelopment: string;
      posture: string;
      symmetry: string;
    };
    strengths: string[];
    areasForImprovement: string[];
    recommendations: {
      primaryFocus: string;
      secondaryFocus: string;
      workoutIntensity: string;
      exerciseTypes: string[];
    };
    detailedDescription: string;
    analyzedAt: Date;
    analyzedFromPhoto: string; // URL of the photo that was analyzed
  };

  // AI-Generated Workout Foundation
  @Prop({ type: Object })
  workoutFoundation: {
    personalizedAdvice: string;
    recommendedWorkoutStyle: string;
    keyFocusAreas: string[];
    intensityGuidelines: string;
    progressionStrategy: string;
    generatedAt: Date;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
