import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ErrorLogDocument = ErrorLog & Document;

@Schema({ timestamps: true })
export class ErrorLog {
  @Prop({ required: true })
  message: string;

  @Prop()
  stack: string;

  @Prop()
  endpoint: string;

  @Prop()
  method: string;

  @Prop()
  userId: string;

  @Prop()
  userEmail: string;

  @Prop({ default: 500 })
  statusCode: number;

  @Prop({ type: Object })
  requestBody: Record<string, any>;

  @Prop({ type: Object })
  headers: Record<string, any>;

  @Prop({ default: 'error', enum: ['error', 'warn', 'critical'] })
  level: 'error' | 'warn' | 'critical';

  @Prop()
  context: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ErrorLogSchema = SchemaFactory.createForClass(ErrorLog);
