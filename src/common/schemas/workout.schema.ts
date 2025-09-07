import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkoutDocument = Workout & Document;

export enum SubscriptionPlan {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Schema({ timestamps: true })
export class Exercise {
  @Prop({ required: true })
  name: string;

  @Prop()
  sets: number;

  @Prop()
  reps: number;

  @Prop()
  duration: number; // in seconds for time-based exercises

  @Prop()
  restTime: number; // in seconds

  @Prop()
  weight: number; // in kg

  @Prop()
  notes: string;

  @Prop()
  instructionImageUrl: string;

  @Prop()
  instructionVideoUrl: string;
}

@Schema({ timestamps: true })
export class WorkoutDay {
  @Prop({ required: true })
  dayNumber: number;

  @Prop({ required: true })
  dayName: string;

  @Prop({ default: false })
  isRestDay: boolean;

  @Prop([Exercise])
  exercises: Exercise[];

  @Prop()
  notes: string;

  @Prop()
  estimatedDuration: number; // in minutes
}

@Schema({ timestamps: true })
export class Workout {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop([WorkoutDay])
  days: WorkoutDay[];

  @Prop({ required: true })
  weekNumber: number;

  @Prop({ default: Date.now })
  generatedAt: Date;

  @Prop()
  aiAnalysis: string;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ default: 0 })
  completionPercentage: number;

  @Prop({ enum: SubscriptionPlan })
  planType: SubscriptionPlan;

  @Prop({ default: 0 })
  instructionsGenerated: number;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
export const WorkoutDaySchema = SchemaFactory.createForClass(WorkoutDay);
export const WorkoutSchema = SchemaFactory.createForClass(Workout);
