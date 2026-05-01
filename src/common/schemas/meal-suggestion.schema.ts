import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MealSuggestionDocument = MealSuggestion & Document;

@Schema({ timestamps: { createdAt: 'generatedAt', updatedAt: false }, collection: 'meal_suggestions' })
export class MealSuggestion {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) cuisineOrigin: string;
  @Prop({ default: false }) isLocal: boolean;
  @Prop({ default: '' }) imageUrl: string;
  @Prop({ type: [String], default: [] }) recipeSteps: string[];
  @Prop({ type: [Object], default: [] }) ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    estCost: number;
  }>;
  @Prop({ default: 0 }) estimatedCost: number;
  @Prop({ default: 'NGN' }) currency: string;
  @Prop({ required: true }) totalCalories: number;
  @Prop({ default: 0 }) proteinG: number;
  @Prop({ default: 0 }) carbsG: number;
  @Prop({ default: 0 }) fatG: number;
  @Prop({ enum: ['bulking', 'cutting', 'maintenance', 'recomp'], required: true }) alignedWorkoutGoal: string;
  @Prop({ required: true }) expiresAt: Date;
}

export const MealSuggestionSchema = SchemaFactory.createForClass(MealSuggestion);
MealSuggestionSchema.index({ userId: 1, expiresAt: 1 });
