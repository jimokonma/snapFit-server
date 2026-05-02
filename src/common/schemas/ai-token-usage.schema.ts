import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiTokenUsageDocument = AiTokenUsage & Document;

export enum AiOperation {
  VALIDATE_PHOTO = 'validate_photo',
  ANALYZE_BODY = 'analyze_body',
  GENERATE_WORKOUT = 'generate_workout',
  GENERATE_EXERCISE_INSTRUCTIONS = 'generate_exercise_instructions',
  GENERATE_EXERCISE_IMAGE = 'generate_exercise_image',
  GENERATE_EXERCISE_IMAGE_PROMPT = 'generate_exercise_image_prompt',
  GENERATE_EXERCISE_VIDEO_PROMPT = 'generate_exercise_video_prompt',
  CONVERT_TO_HOME = 'convert_to_home',
  COMPARE_ANALYSES = 'compare_analyses',
  CHAT = 'chat',
  GENERATE_WORKOUT_WITH_OPTIONS = 'generate_workout_with_options',
  NUTRITION_ANALYSIS = 'nutrition_analysis',
  MEAL_SUGGESTION = 'meal_suggestion',
}

export enum AiProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
}

@Schema({ timestamps: true })
export class AiTokenUsage {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: AiOperation })
  operation: AiOperation;

  @Prop({ required: true, enum: AiProvider })
  provider: AiProvider;

  @Prop({ required: true })
  model: string;

  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  @Prop({ default: 0 })
  totalTokens: number;

  // Estimated cost in USD (micro-dollars stored as float)
  @Prop({ default: 0 })
  estimatedCostUsd: number;

  createdAt: Date;
  updatedAt: Date;
}

export const AiTokenUsageSchema = SchemaFactory.createForClass(AiTokenUsage);

// Index for fast admin queries
AiTokenUsageSchema.index({ userId: 1, createdAt: -1 });
AiTokenUsageSchema.index({ operation: 1, createdAt: -1 });
AiTokenUsageSchema.index({ createdAt: -1 });
