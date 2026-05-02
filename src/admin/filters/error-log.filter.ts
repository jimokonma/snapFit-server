import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ErrorLog, ErrorLogDocument } from '../../common/schemas/error-log.schema';

@Catch()
@Injectable()
export class ErrorLogFilter implements ExceptionFilter {
  constructor(
    @InjectModel(ErrorLog.name) private errorLogModel: Model<ErrorLogDocument>,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : exception instanceof Error
        ? exception.message
        : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    // Only log 5xx errors and unexpected 4xx (not 401/403/404 noise)
    const shouldLog = status >= 500 || (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 404);

    if (shouldLog) {
      const userId = request.user?.sub || request.user?.id;
      const userEmail = request.user?.email;

      const level = status >= 500 ? 'critical' : 'error';

      // Fire-and-forget to avoid blocking the response
      this.errorLogModel
        .create({
          message: Array.isArray(message) ? message.join(', ') : String(message),
          stack,
          endpoint: request.url,
          method: request.method,
          userId,
          userEmail,
          statusCode: status,
          requestBody: this.sanitizeBody(request.body),
          level,
          context: request.headers?.['x-context'] || undefined,
        })
        .catch(() => {
          // Silently fail — logging must not crash the app
        });
    }

    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'refreshToken', 'accessToken', 'secret', 'key'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });
    return sanitized;
  }
}
