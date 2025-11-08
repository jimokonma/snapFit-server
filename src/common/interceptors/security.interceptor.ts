import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuditLoggerService, AuditEventType } from '../services/audit-logger.service';

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityInterceptor.name);

  constructor(private auditLogger: AuditLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'];
    const userId = request.user?.sub;

    // Log suspicious patterns
    this.checkForSuspiciousActivity(request);

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `${method} ${url} - ${response.statusCode} - ${duration}ms - IP: ${ip}`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log failed requests
        this.logger.error(
          `${method} ${url} - ${error.status || 500} - ${duration}ms - IP: ${ip} - Error: ${error.message}`,
        );

        // Log security events for failed auth attempts
        if (error.status === 401 || error.status === 403) {
          this.auditLogger.logSecurityEvent(
            AuditEventType.LOGIN_FAILED,
            {
              method,
              url,
              error: error.message,
              userAgent,
            },
            ip,
            userAgent,
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private checkForSuspiciousActivity(request: any): void {
    const { method, url, headers, body } = request;
    const userAgent = headers['user-agent'];
    const ip = request.ip;

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript injection
      /eval\(/i, // Code injection
    ];

    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
    ];

    // Check URL for suspicious patterns
    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
      this.auditLogger.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        {
          type: 'suspicious_url',
          url,
          userAgent,
        },
        ip,
        userAgent,
      );
    }

    // Check for suspicious user agents
    if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
      this.auditLogger.logSecurityEvent(
        AuditEventType.SUSPICIOUS_ACTIVITY,
        {
          type: 'suspicious_user_agent',
          userAgent,
        },
        ip,
        userAgent,
      );
    }

    // Check for rapid requests (basic rate limiting detection)
    // This would be better handled by a proper rate limiting service
    if (method === 'POST' && (url.includes('/auth/login') || url.includes('/auth/register'))) {
      // Log authentication attempts for monitoring
      this.auditLogger.logEvent(
        AuditEventType.LOGIN,
        null,
        { method, url, userAgent },
        ip,
        userAgent,
      );
    }
  }
}








