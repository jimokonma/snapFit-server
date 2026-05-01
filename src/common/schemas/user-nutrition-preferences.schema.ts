import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserNutritionPreferencesDocument = UserNutritionPreferences & Document;

@Schema({ timestamps: true, collection: 'user_nutrition_preferences' })
export class UserNutritionPreferences {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ default: 'NG' }) countryCode: string;
  @Prop({ enum: ['local', 'international', 'mixed'], default: 'mixed' }) cuisinePreference: string;
  @Prop({ type: [String], default: [] }) dietaryRestrictions: string[];
  @Prop({ type: [String], default: [] }) allergies: string[];
  @Prop({ default: null }) dailyCalorieTarget: number | null;
}

export const UserNutritionPreferencesSchema = SchemaFactory.createForClass(UserNutritionPreferences);

// ── User Budget ────────────────────────────────────────────────────────

export type UserBudgetDocument = UserBudget & Document;

@Schema({ timestamps: true, collection: 'user_budgets' })
export class UserBudget {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ enum: ['daily', 'weekly', 'per_meal'], default: 'daily' }) mode: string;
  @Prop({ required: true }) amount: number;
  @Prop({ default: 'NGN' }) currency: string;
  @Prop({ required: true }) effectiveFrom: Date;
  @Prop({ default: null }) effectiveTo: Date | null;
}

export const UserBudgetSchema = SchemaFactory.createForClass(UserBudget);
UserBudgetSchema.index({ userId: 1, effectiveTo: 1 });
