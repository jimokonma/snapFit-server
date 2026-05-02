import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkoutDocument = Workout & Document;
export type ExerciseDocument = Exercise & Document;
export type WorkoutDayDocument = WorkoutDay & Document;

export enum SubscriptionPlan {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Schema({ timestamps: true })
export class Exercise {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  category: string;

  @Prop()
  sets: number;

  @Prop()
  reps: string;

  @Prop()
  duration: number;

  @Prop()
  restTime: string;

  @Prop()
  weight: number;

  @Prop()
  difficulty: number;

  @Prop()
  description: string;

  @Prop()
  instructions: string;

  @Prop()
  tips: string;

  @Prop()
  notes: string;

  @Prop()
  instructionImageUrl: string;

  @Prop()
  instructionVideoUrl: string;

  @Prop()
  homeVariantInstructions: string;

  @Prop({ enum: ['pending', 'done', 'skipped'], default: 'pending' })
  status: string;

  @Prop({ enum: ['idle', 'processing', 'ready', 'failed'], default: 'idle' })
  videoGenerationStatus: string;
}

@Schema({ timestamps: true })
export class WorkoutDay {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  dayNumber: number;

  @Prop({ required: true })
  dayName: string;

  @Prop()
  focus: string;

  @Prop({ default: false })
  isRestDay: boolean;

  @Prop([Exercise])
  exercises: Exercise[];

  @Prop()
  notes: string;

  @Prop()
  estimatedDuration: number;

  @Prop()
  completedAt: Date;
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
