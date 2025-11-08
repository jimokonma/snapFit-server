import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, enum: ['LOGIN', 'LOGOUT', 'REGISTER', 'LOGIN_FAILED', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'FILE_UPLOAD', 'WORKOUT_GENERATION', 'PROFILE_UPDATE', 'SUSPICIOUS_ACTIVITY'] })
  eventType: string;

  @Prop({ type: String })
  userId?: string;

  @Prop({ type: Object })
  details?: any;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Add indexes for better query performance
AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });








