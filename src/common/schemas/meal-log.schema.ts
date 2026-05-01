import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MealLogDocument = MealLog & Document;

@Schema({ _id: true })
export class MealLogItem {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) quantity: number;
  @Prop({ required: true }) unit: string;
  @Prop({ required: true }) calories: number;
  @Prop({ default: 0 }) proteinG: number;
  @Prop({ default: 0 }) carbsG: number;
  @Prop({ default: 0 }) fatG: number;
  @Prop({ min: 0, max: 1, default: 1 }) confidence: number;
}

export const MealLogItemSchema = SchemaFactory.createForClass(MealLogItem);

@Schema({ timestamps: true, collection: 'meal_logs' })
export class MealLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ default: null }) imageUrl: string | null;
  @Prop({ type: [MealLogItemSchema], default: [] }) items: MealLogItem[];
  @Prop({ required: true }) totalCalories: number;
  @Prop({ default: 0 }) totalProteinG: number;
  @Prop({ default: 0 }) totalCarbsG: number;
  @Prop({ default: 0 }) totalFatG: number;
  @Prop({ enum: ['breakfast', 'lunch', 'dinner', 'snack'], required: true }) mealType: string;
  @Prop({ required: true }) loggedAt: Date;
  @Prop({ enum: ['photo', 'manual', 'suggestion'], default: 'manual' }) source: string;
  @Prop({ default: null }) notes: string | null;
}

export const MealLogSchema = SchemaFactory.createForClass(MealLog);
MealLogSchema.index({ userId: 1, loggedAt: -1 });
