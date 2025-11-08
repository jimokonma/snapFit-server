import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

export enum AuditEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  FILE_UPLOAD = 'FILE_UPLOAD',
  WORKOUT_GENERATION = 'WORKOUT_GENERATION',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

@Injectable()
export class AuditLoggerService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async logEvent(
    eventType: AuditEventType,
    userId?: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const auditLog = new this.auditLogModel({
        eventType,
        userId,
        details: this.sanitizeDetails(details),
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });

      await auditLog.save();
    } catch (error) {
      // Don't throw errors in audit logging to avoid breaking main functionality
      console.error('Audit logging failed:', error.message);
    }
  }

  async logSecurityEvent(
    eventType: AuditEventType,
    details: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent(eventType, null, details, ipAddress, userAgent);
  }

  async getSecurityEvents(
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const query: any = {
      eventType: {
        $in: [
          AuditEventType.LOGIN_FAILED,
          AuditEventType.SUSPICIOUS_ACTIVITY,
          AuditEventType.FILE_UPLOAD,
        ],
      },
    };

    if (startDate) {
      query.timestamp = { ...query.timestamp, $gte: startDate };
    }
    if (endDate) {
      query.timestamp = { ...query.timestamp, $lte: endDate };
    }

    return this.auditLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  private sanitizeDetails(details: any): any {
    if (!details) return details;

    // Remove sensitive information
    const sanitized = { ...details };
    
    // Remove password fields
    delete sanitized.password;
    delete sanitized.confirmPassword;
    delete sanitized.newPassword;
    
    // Remove tokens
    delete sanitized.token;
    delete sanitized.accessToken;
    delete sanitized.refreshToken;
    
    // Remove file buffers
    if (sanitized.file) {
      sanitized.file = {
        originalname: sanitized.file.originalname,
        mimetype: sanitized.file.mimetype,
        size: sanitized.file.size,
      };
    }

    return sanitized;
  }
}









