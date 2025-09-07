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
}

export const UserSchema = SchemaFactory.createForClass(User);
